/**
 * Generation hors-ligne des sprites, via l'API PixelLab.
 *
 * Ce script ne tourne **jamais** pendant une partie. Il produit des PNG dans
 * `src/assets/`, on les commite, et le jeu se contente ensuite de les charger.
 * Consequence : aucune dependance reseau au runtime, et rien a payer quand on
 * joue.
 *
 * Usage :
 *
 *   npx tsx scripts/generer-assets.ts                 # etat des lieux, ne depense rien
 *   npx tsx scripts/generer-assets.ts --solde
 *   npx tsx scripts/generer-assets.ts --cle hero-guerrier
 *   npx tsx scripts/generer-assets.ts --groupe heros
 *   npx tsx scripts/generer-assets.ts --tout
 *   npx tsx scripts/generer-assets.ts --cle mur --force   # refaire un rate
 *   npx tsx scripts/generer-assets.ts --tout --style      # style calque sur le temoin
 *
 * Trois garde-fous, parce qu'une generation ratee est une generation perdue :
 *
 * 1. **Rien sans ordre explicite.** Sans `--cle`, `--groupe` ou `--tout`, le
 *    script affiche seulement ce qui manque et ce que ca couterait.
 * 2. **Idempotence.** Un PNG deja present est saute, jamais repaye. Il faut
 *    `--force` pour ecraser.
 * 3. **Solde verifie avant.** On s'arrete si le quota ne couvre pas le lot.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  chargerImage,
  ClientPixelLab,
  enregistrer,
  type Contour,
  type Detail,
  type ImageApi,
  type Ombrage,
} from "./pixellab";
import {
  CATALOGUE,
  INTERDIT_COMMUN,
  REFERENCE_STYLE,
  STYLE,
  type Asset,
  type Groupe,
} from "./catalogue-assets";

const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..");
const DOSSIER_ASSETS = join(RACINE, "src", "assets");
const JOURNAL = join(RACINE, "scripts", "journal-assets.json");

/** Ce que le journal retient de chaque generation. */
interface Ligne {
  cle: string;
  taille: number;
  methode: "pixflux" | "bitforge";
  cout: string;
  date: string;
}

// --------------------------------------------------------------- arguments

interface Options {
  cles: string[];
  groupes: Groupe[];
  tout: boolean;
  force: boolean;
  soldeSeul: boolean;
  style: boolean;
}

function lireArguments(argv: string[]): Options {
  const options: Options = {
    cles: [],
    groupes: [],
    tout: false,
    force: false,
    soldeSeul: false,
    style: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--tout") options.tout = true;
    else if (arg === "--force") options.force = true;
    else if (arg === "--style") options.style = true;
    else if (arg === "--solde") options.soldeSeul = true;
    else if (arg === "--cle") options.cles.push(argv[++i] ?? "");
    else if (arg === "--groupe") options.groupes.push((argv[++i] ?? "") as Groupe);
    else throw new Error(`Argument inconnu : ${arg}`);
  }
  return options;
}

function selection(options: Options): Asset[] {
  if (options.tout) return CATALOGUE;
  return CATALOGUE.filter(
    (a) => options.cles.includes(a.cle) || options.groupes.includes(a.groupe),
  );
}

// ------------------------------------------------------------------ reglages

/**
 * Les reglages de rendu, identiques pour tout le lot.
 *
 * `low detail` n'est pas une economie : a 32 px, le detail mange la silhouette
 * et le sprite cesse d'etre lisible des qu'on dezoome (DESIGN.md §4.11).
 */
const RENDU = {
  personnage: {
    outline: "single color black outline" as Contour,
    shading: "basic shading" as Ombrage,
    detail: "low detail" as Detail,
  },
  sol: {
    // Un sol ne se detoure pas : un contour noir dessinerait la grille.
    outline: "lineless" as Contour,
    shading: "basic shading" as Ombrage,
    detail: "low detail" as Detail,
  },
};

/** Part du cadre que le sujet doit remplir. */
function couverture(asset: Asset): number {
  if (asset.cle === "mur") return 100; // une palissade doit se juxtaposer
  if (asset.groupe === "decor") return 92;
  return 86;
}

function chemin(cle: string): string {
  return join(DOSSIER_ASSETS, `${cle}.png`);
}

/** Hash deterministe d'une cle vers une graine entiere. */
function graine(cle: string): number {
  let h = 2166136261;
  for (let i = 0; i < cle.length; i++) h = Math.imul(h ^ cle.charCodeAt(i), 16777619);
  return (h >>> 0) % 1_000_000;
}

// ---------------------------------------------------------------- generation

/**
 * Un sprite.
 *
 * Par defaut **tout part en Pixflux**, et la coherence vient du vocabulaire de
 * style partage (`STYLE`) plus des reglages de rendu identiques. Ce n'etait pas
 * le plan de depart : le premier essai passait tout le lot en Bitforge avec le
 * guerrier en image de reference, et le resultat a tranche la question — le
 * rouge sombre du guerrier repeignait chaque classe. Le mage n'etait plus
 * violet, l'Oracle plus blanc-or. Or c'est la **couleur dominante** qui
 * identifie une classe au premier coup d'oeil (DESIGN.md §4.11) : une palette
 * homogene qui mange les couleurs de classe est un mauvais echange.
 *
 * `--style` rebranche Bitforge pour qui veut retenter l'experience, avec une
 * force volontairement basse.
 */
async function generer(
  client: ClientPixelLab,
  asset: Asset,
  style: ImageApi | null,
): Promise<Ligne> {
  const commun = {
    description: `${asset.invite}, ${STYLE}`,
    negativeDescription: [asset.interdit, INTERDIT_COMMUN].filter(Boolean).join(", "),
    imageSize: { width: asset.taille, height: asset.taille },
    ...(asset.seamless ? RENDU.sol : RENDU.personnage),
    view: "high top-down" as const,
    noBackground: !asset.seamless,
    // La graine derive de la cle : relancer le script sur le meme sprite
    // redonne la meme image, on compare donc des invites, pas du hasard.
    seed: graine(asset.cle),
  };
  // Un sol se repete : ni sujet centre, ni direction de regard.
  const cadrage = asset.seamless
    ? {}
    : { direction: "south" as const, coveragePercentage: couverture(asset) };

  const utiliserStyle = style !== null && !asset.seamless;
  const reponse = utiliserStyle
    ? await client.bitforge({ ...commun, ...cadrage, styleImage: style, styleStrength: 25 })
    : await client.pixflux({ ...commun, ...cadrage });

  await enregistrer(reponse.image, chemin(asset.cle));

  return {
    cle: asset.cle,
    taille: asset.taille,
    methode: utiliserStyle ? "bitforge" : "pixflux",
    cout:
      reponse.usage.type === "usd"
        ? `${reponse.usage.usd.toFixed(4)} $`
        : `${reponse.usage.generations} generation(s)`,
    date: new Date().toISOString().slice(0, 10),
  };
}

// ------------------------------------------------------------------- journal

function lireJournal(): Ligne[] {
  if (!existsSync(JOURNAL)) return [];
  return JSON.parse(readFileSync(JOURNAL, "utf8")) as Ligne[];
}

function ecrireJournal(lignes: Ligne[]): void {
  writeFileSync(JOURNAL, `${JSON.stringify(lignes, null, 2)}\n`, "utf8");
}

// ---------------------------------------------------------------------- main

async function main(): Promise<void> {
  const options = lireArguments(process.argv.slice(2));
  mkdirSync(DOSSIER_ASSETS, { recursive: true });

  const client = await ClientPixelLab.depuisEnv(join(RACINE, ".env"));
  const avant = await client.solde();
  console.log(
    `Solde : ${avant.generations}/${avant.generationsTotal} generations ` +
      `(${avant.statut}) et ${avant.usd.toFixed(4)} $ de credits.`,
  );
  if (options.soldeSeul) return;

  const demandes = selection(options);
  if (demandes.length === 0) {
    const manquants = CATALOGUE.filter((a) => !existsSync(chemin(a.cle)));
    console.log(
      `\n${CATALOGUE.length - manquants.length}/${CATALOGUE.length} sprites deja presents.`,
    );
    if (manquants.length > 0) {
      console.log(`Manquent (${manquants.length} generations) :`);
      for (const a of manquants) console.log(`  [${a.groupe}] ${a.cle} (${a.taille} px)`);
    }
    console.log("\nRien n'a ete genere. Ajoute --cle <cle>, --groupe <groupe> ou --tout.");
    return;
  }

  const aFaire = options.force ? demandes : demandes.filter((a) => !existsSync(chemin(a.cle)));
  const sautes = demandes.length - aFaire.length;
  if (sautes > 0) console.log(`${sautes} sprite(s) deja la : sautes.`);
  if (aFaire.length === 0) {
    console.log("Rien a generer.");
    return;
  }

  // Le compte peut etre approvisionne en dollars **ou** en generations : on
  // n'exige un quota que si c'est la seule ressource disponible.
  if (avant.usd <= 0 && avant.generations < aFaire.length) {
    console.error(
      `Quota insuffisant : ${avant.generations} generation(s) pour un lot de ${aFaire.length}.`,
    );
    process.exitCode = 1;
    return;
  }
  console.log(`${aFaire.length} sprite(s) a generer.\n`);

  // L'image de reference n'est chargee que si on la demande : sans `--style`,
  // tout part en Pixflux (voir le commentaire de `generer`).
  const cheminReference = chemin(REFERENCE_STYLE);
  let style: ImageApi | null =
    options.style && existsSync(cheminReference) && !aFaire.some((a) => a.cle === REFERENCE_STYLE)
      ? await chargerImage(cheminReference)
      : null;

  const journal = lireJournal();
  for (const asset of aFaire) {
    process.stdout.write(`  ${asset.cle} … `);
    try {
      const ligne = await generer(client, asset, style);
      console.log(`ok (${ligne.methode}, ${ligne.cout})`);
      journal.push(ligne);
      ecrireJournal(journal);
      if (options.style && asset.cle === REFERENCE_STYLE) {
        style = await chargerImage(cheminReference);
      }
    } catch (erreur) {
      console.log(`ECHEC — ${(erreur as Error).message}`);
    }
  }

  const apres = await client.solde();
  console.log(
    `\nSolde a la fin : ${apres.generations}/${apres.generationsTotal} generations ` +
      `(consommees : ${avant.generations - apres.generations}).`,
  );
}

main().catch((erreur) => {
  console.error(erreur);
  process.exitCode = 1;
});
