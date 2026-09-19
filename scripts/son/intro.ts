import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  aCrete,
  aNiveau,
  adoucir,
  boucler,
  copie,
  crete,
  decouper,
  duree,
  ecrire,
  enveloppe,
  lire,
  niveau,
  passeBas,
  passeHaut,
  poser,
  ralentir,
  rampe,
  reverberer,
  silence,
  type Son,
} from "./dsp";
import { chercherRaccord, preparerLaBoucle, type Raccord } from "./raccord";
import { cloche, grondement } from "./synthese";

/**
 * Fabrique la bande-son du jeu (DESIGN.md §4.10), de bout en bout.
 *
 *     npm run son               -> sources (une fois), mixage, boucles, encodage, fichiers d'ecoute
 *     npm run son -- --chercher -> cherche les raccords des musiques sur tout le morceau (lent)
 *
 * 1. Les sources libres de droits arrivent dans `.tmp/son/sources/` (voir
 *    SOURCES) — une seule fois. OpenGameArt demande dix secondes entre deux
 *    requetes, on en laisse onze.
 * 2. La cloche et le grondement du feu sont fabriques (`synthese.ts`).
 * 3. Tout est mixe en memoire (`dsp.ts`) et encode en OGG et en MP3 dans
 *    `src/assets/son/` : la piste du film, le glas du titre, le feu du menu,
 *    la musique de guerre, les deux bruits de l'interface.
 * 4. Chaque musique est **preparee pour tourner sans fin** (`raccord.ts`) : on
 *    cherche deux instants ou elle joue la meme chose, on coupe au second et
 *    on fond la couture ; les deux points partent dans `boucles.json`, que le
 *    jeu donne a la Web Audio.
 * 5. Des fichiers d'ecoute partent dans `captures/son/<date>-musiques/` : chaque
 *    musique jouee jusqu'a sa couture, puis 30 s de plus apres le saut — c'est la
 *    que l'oreille doit chercher la coupure, et ne pas la trouver.
 * 6. `src/assets/son/CREDITS.md` est reecrit a partir de SOURCES.
 *
 * ⚠️ **Les niveaux se reglent ici, pas dans le jeu.** `son.ts` joue chaque
 * fichier a plein volume (la musique un cran plus bas, puis le curseur du
 * joueur) : c'est ce script qui dit combien le feu pese contre le glas.
 *
 * Demande ffmpeg (libvorbis, libmp3lame) et `tar` (Windows 10 et plus l'ont)
 * pour ouvrir les archives.
 */

const RACINE = resolve(".");
const SOURCES_DIR = resolve(".tmp/son/sources");
const SORTIE = resolve("src/assets/son");
const DATE = new Date().toISOString().slice(0, 10);
const ECOUTE = resolve(`captures/son/${DATE}-musiques`);

// ------------------------------------------------------------------ sources

interface Source {
  /** Le nom du fichier dans `.tmp/son/sources/`. */
  fichier: string;
  /** Ce qu'on telecharge : le fichier, ou l'archive qui le contient. */
  url: string;
  /** Le chemin du fichier dans l'archive, quand `url` est une archive. */
  dansArchive?: string;
  titre: string;
  auteur: string;
  licence: string;
  page: string;
  role: string;
}

const OGA = "https://opengameart.org/sites/default/files";

const SOURCES = {
  feu: {
    fichier: "feu-cheminee.wav",
    url: `${OGA}/fire.wav`,
    titre: "Fireplace Sound loop",
    auteur: "PagDev",
    licence: "CC0",
    page: "https://opengameart.org/content/fireplace-sound-loop",
    role: "le crepitement du feu (film et menu)",
  },
  vent1: {
    fichier: "vent-1.wav",
    url: `${OGA}/wind1.wav`,
    titre: "wind1",
    auteur: "Luke.RUSTLTD",
    licence: "CC0",
    page: "https://opengameart.org/content/wind1",
    role: "le vent, oreille gauche",
  },
  vent3: {
    fichier: "vent-3.wav",
    url: `${OGA}/wind3.wav`,
    titre: "wind1 (piste 3)",
    auteur: "Luke.RUSTLTD",
    licence: "CC0",
    page: "https://opengameart.org/content/wind1",
    role: "le vent, oreille droite",
  },
  criFemme: {
    fichier: "cri-femme.ogg",
    url: `${OGA}/female_scream_1.ogg`,
    titre: "Female Scream 1",
    auteur: "Nocturnal_Vanguard (AuraVoice)",
    licence: "CC0",
    page: "https://opengameart.org/content/female-scream-1",
    role: "le premier cri, au loin a gauche",
  },
  crisFemme: {
    fichier: "cris-femme.ogg",
    url: `${OGA}/screams.ogg`,
    titre: "Female high-pitched scream SFX",
    auteur: "WuxiaScrub",
    licence: "CC0",
    page: "https://opengameart.org/content/female-high-pitched-scream-sfx",
    role: "le troisieme cri, tres loin",
  },
  criHomme: {
    fichier: "cri-homme.wav",
    url: `${OGA}/yelling%20sounds.zip`,
    dansArchive: "yelling sounds/yell1.wav",
    titre: "Male Grunt/Yelling sounds",
    auteur: "HaelDB",
    licence: "CC0",
    page: "https://opengameart.org/content/male-gruntyelling-sounds",
    role: "le deuxieme cri, au loin a droite",
  },
  boum: {
    fichier: "boum.wav",
    url: `${OGA}/NenadSimic%20-%20Muffled%20Distant%20Explosion.wav`,
    titre: "Muffled Distant Explosion",
    auteur: "NenadSimic",
    licence: "CC0",
    page: "https://opengameart.org/content/muffled-distant-explosion",
    role: "le coup sourd sous le glas du titre",
  },
  survol: {
    fichier: "ui-survol.ogg",
    url: "https://kenney.nl/media/pages/assets/impact-sounds/87b4ddecda-1677589768/kenney_impact-sounds.zip",
    dansArchive: "Audio/impactMetal_light_002.ogg",
    titre: "Impact Sounds (impactMetal_light_002)",
    auteur: "Kenney",
    licence: "CC0",
    page: "https://kenney.nl/assets/impact-sounds",
    role: "le survol d'une entree du menu",
  },
  clic: {
    fichier: "ui-clic.ogg",
    url: "https://kenney.nl/media/pages/assets/rpg-audio/8e99002d76-1677590336/kenney_rpg-audio.zip",
    dansArchive: "Audio/metalLatch.ogg",
    titre: "RPG Audio (metalLatch)",
    auteur: "Kenney",
    licence: "CC0",
    page: "https://kenney.nl/assets/rpg-audio",
    role: "le clic d'une entree du menu",
  },
  guerre: {
    fichier: "musique-guerre.flac",
    url: `${OGA}/Lament%20of%20the%20War%20-%20Lossless%20FLAC.flac`,
    titre: "Lament of the War",
    auteur: "Cethiel",
    licence: "CC0",
    page: "https://opengameart.org/content/laments-of-the-war",
    role: "la musique de guerre : sous le titre, et plus tard pendant les attaques",
  },
  calme1: {
    fichier: "calme-1.ogg",
    url: `${OGA}/Village%20Ruins%20-%20isaiah658.ogg`,
    titre: "Village Ruins",
    auteur: "isaiah658",
    licence: "CC0",
    page: "https://opengameart.org/content/village-ruins",
    role: "musique calme n° 1, a l'essai",
  },
  calme2: {
    fichier: "calme-2.mp3",
    url: `${OGA}/Lament_for_a_Warriors_Soul_REUPLOAD.mp3`,
    titre: "Fantasy: Lament for a Warrior's Soul",
    auteur: "RandomMind",
    licence: "CC0",
    page: "https://opengameart.org/content/fantasy-lament-for-a-warriors-soul",
    role: "musique calme n° 2, a l'essai",
  },
  calme3: {
    fichier: "calme-3.wav",
    url: `${OGA}/Exploration.wav`,
    titre: "Medieval: Exploration",
    auteur: "RandomMind",
    licence: "CC0",
    page: "https://opengameart.org/content/medieval-exploration",
    role: "musique calme n° 3, a l'essai",
  },
} satisfies Record<string, Source>;

/**
 * Les musiques, et ou chercher leur raccord (secondes) : A dans `a`, B dans `b`.
 * Les fenetres etroites viennent d'une recherche sur tout le morceau
 * (`--chercher`) ; on les garde serrees pour que le script reste rapide. Une
 * fenetre a zero veut dire « pas encore cherche » : on cherche large.
 *
 * `livree` : dans le jeu. Les autres ne partent qu'en fichiers d'ecoute, en
 * attendant qu'Angelos choisisse.
 */
interface Musique {
  nom: string;
  source: Source;
  a: [number, number];
  b: [number, number];
  livree: boolean;
}

const MUSIQUES: Musique[] = [
  // Mesure le 19 septembre 2026 (ressemblance des formes d'onde a la couture, sur 2 s) :
  // 29,0 s et 149,0 s jouent la meme mesure (0,98).
  { nom: "musique-guerre", source: SOURCES.guerre, a: [28, 30], b: [148, 150], livree: true },
  // 26,1 s et 93,8 s (0,87).
  { nom: "calme-1-village-en-ruines", source: SOURCES.calme1, a: [25, 27], b: [93, 95], livree: false },
  // 63,5 s et 114,1 s (0,61) : couture moins sure, fondu long.
  { nom: "calme-2-complainte", source: SOURCES.calme2, a: [62.5, 64.5], b: [113, 115], livree: false },
  // 83,5 s et 162,0 s (0,34, le meilleur du morceau entier) : couture la plus fragile.
  { nom: "calme-3-exploration", source: SOURCES.calme3, a: [82.5, 84.5], b: [161, 163], livree: false },
];

const attendre = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Telecharge ce qui manque, poliment : onze secondes entre deux requetes au meme site. */
async function recupererLesSources(): Promise<void> {
  mkdirSync(SOURCES_DIR, { recursive: true });
  const derniere = new Map<string, number>();
  const archives = new Map<string, string>();
  for (const source of Object.values(SOURCES) as Source[]) {
    const cible = `${SOURCES_DIR}/${source.fichier}`;
    if (existsSync(cible)) continue;
    let fichier = archives.get(source.url);
    if (!fichier) {
      const site = new URL(source.url).host;
      const ecoule = Date.now() - (derniere.get(site) ?? 0);
      if (ecoule < 11000) await attendre(11000 - ecoule);
      console.log(`[son] telechargement : ${source.url}`);
      const r = await fetch(source.url, {
        headers: { "User-Agent": "le-protecteur-sons/1.0 (projet de jeu personnel, assets CC0)" },
      });
      derniere.set(site, Date.now());
      if (!r.ok) throw new Error(`[son] ${r.status} sur ${source.url}`);
      fichier = source.dansArchive ? `${SOURCES_DIR}/archive-${archives.size}.zip` : cible;
      writeFileSync(fichier, Buffer.from(await r.arrayBuffer()));
      if (source.dansArchive) archives.set(source.url, fichier);
    }
    if (source.dansArchive) {
      // Le fichier sort de l'archive tel quel, dans son format d'origine.
      const dossier = `${SOURCES_DIR}/archive-extraite`;
      mkdirSync(dossier, { recursive: true });
      const r = spawnSync("tar", ["-xf", fichier, "-C", dossier, source.dansArchive]);
      if (r.status !== 0) throw new Error(`[son] archive illisible : ${fichier}\n${r.stderr}`);
      copyFileSync(`${dossier}/${source.dansArchive}`, cible);
    }
  }
}

const src = (s: Source, debut = 0, longueur?: number) => lire(`${SOURCES_DIR}/${s.fichier}`, debut, longueur);

// ----------------------------------------------------------------- les sons

/** Le film dure 9 s ; sa piste deborde de 3 s, le temps que le glas s'eteigne sous le titre. */
const FILM_S = 9;
const DEBORD = 3;

/** Les moments du film (secondes depuis sa premiere image). */
const MOMENTS = {
  /** Trois cris, avant les cloches : un a gauche, un a droite, un tres loin. */
  cris: [1.9, 3.9, 6.3],
  /** Deux coups de glas ; le troisieme sonne avec le titre (`TitreScene`, 420 ms apres la fin). */
  glas: [4.6, 7.0],
  /** Quand le titre se pose, dans le jeu. */
  titre: FILM_S + 0.42,
};

/** Le feu : le crepitement enregistre, et le grondement fabrique dessous. */
function feu(debut: number, longueur: number, graine: number): Son {
  const crepite = adoucir(aNiveau(src(SOURCES.feu, debut, longueur), -26), -15);
  const gronde = aNiveau(grondement(longueur, graine), -29);
  poser(crepite, gronde, 0);
  return crepite;
}

/** Le vent : deux prises differentes, une par oreille, pour qu'il soit large. */
function vent(debut: number, longueur: number): Son {
  const g = src(SOURCES.vent1, debut, longueur);
  const d = src(SOURCES.vent3, debut, longueur);
  return aNiveau({ g: g.g, d: d.d }, -33);
}

/** Eloigne un cri : plus de grave ni d'aigu, et beaucoup plus de murs que de voix. */
function auLoin(cri: Son, aigu: number): Son {
  const s = passeBas(passeHaut(copie(cri), 320), aigu);
  return reverberer(aNiveau(s, -20), { piece: 0.82, amorti: 0.6, humide: 0.55, sec: 0.35, queue: 2.5 });
}

/** Un coup de glas, dans le village : un peu de pierre autour, et la distance qui mange l'aigu. */
function coupDeGlas(graine: number, sec: number): Son {
  const s = passeBas(cloche(98, 13, graine), 6000);
  return reverberer(aNiveau(s, -20), { piece: 0.86, amorti: 0.45, humide: 0.32, sec, queue: 1 });
}

function pisteDuFilm(): Son {
  const longueur = FILM_S + DEBORD;
  const piste = silence(longueur);

  // Le vent tout du long ; il cede la place au feu du menu a la fin du film.
  const souffle = enveloppe(vent(0, longueur), (t) => rampe(t, 0, 1.2) * (1 - rampe(t, FILM_S, FILM_S + 2)));
  poser(piste, souffle, 0, 1);

  // Le feu grossit a mesure qu'on remonte le chemin entre les maisons.
  const brasier = enveloppe(feu(17, longueur, 3), (t) =>
    rampe(t, 0, 1) * (0.45 + 0.55 * rampe(t, 0.5, 7.5)) * (1 - rampe(t, FILM_S, FILM_S + 2)),
  );
  poser(piste, brasier, 0, 1);

  // Trois cris, au loin : a peine au-dessus du feu, on doit les chercher.
  const cri1 = auLoin(src(SOURCES.criFemme), 2600);
  const cri2 = auLoin(decouper(src(SOURCES.criHomme), 1.1, 2.3), 2200);
  const cri3 = auLoin(decouper(src(SOURCES.crisFemme), 1.75, 1.1), 1700);
  poser(piste, cri1, MOMENTS.cris[0], 0.2, -0.55);
  poser(piste, cri2, MOMENTS.cris[1], 0.3, 0.5);
  poser(piste, cri3, MOMENTS.cris[2], 0.16, -0.15);

  // Deux coups de glas.
  poser(piste, coupDeGlas(11, 0.8), MOMENTS.glas[0], 0.62, 0.1);
  poser(piste, coupDeGlas(12, 0.8), MOMENTS.glas[1], 0.7, 0.1);

  // Rien ne s'arrete net.
  enveloppe(piste, (t) => 1 - rampe(t, longueur - 0.6, longueur));
  return aCrete(piste, -3);
}

/** Le troisieme coup, plus pres, et un coup sourd dessous : le titre se pose. */
function glasDuTitre(): Son {
  const coup = coupDeGlas(13, 0.95);
  const boum = passeBas(ralentir(src(SOURCES.boum), 0.82), 240);
  const s = silence(Math.max(duree(coup), duree(boum)));
  poser(s, coup, 0, 1);
  poser(s, aNiveau(boum, niveau(coup) + 1), 0.01, 1);
  enveloppe(s, (t) => 1 - rampe(t, duree(s) - 1, duree(s)));
  return aCrete(s, -1.5);
}

/** Le feu et le vent du menu : 26 secondes qui bouclent sans couture. */
function feuDuMenu(): Son {
  const longueur = 26;
  const croisement = 3;
  const s = feu(0, longueur + croisement, 5);
  poser(s, vent(20, longueur + croisement), 0, 1);
  return aNiveau(boucler(s, longueur, croisement), -27);
}

/** Une musique, ramenee au niveau commun, coupee et fondue pour boucler. */
function preparerMusique(m: Musique, chercher: boolean): { son: Son; raccord: Raccord } {
  const brut = aNiveau(src(m.source), -21);
  const D = duree(brut);
  const large = chercher || m.a[1] === 0;
  const a: [number, number] = large ? [D * 0.08, D * 0.4] : m.a;
  const b: [number, number] = large ? [D * 0.55, D * 0.93] : m.b;
  const raccord = chercherRaccord(brut, a, b);
  // Deux passages presque identiques se raccordent en un souffle ; deux passages
  // qui ne jouent pas les memes notes, en un vrai fondu enchaine.
  const son = preparerLaBoucle(brut, raccord, raccord.correlation >= 0.8 ? 1.5 : 4);
  // Un morceau trop fort par endroits (le Lament depasse 0 dB) : on arrondit ses cretes.
  if (crete(son) > 0.97) adoucir(son, -0.5);
  return { son, raccord };
}

/** Un bruit d'interface : court, net, sans rien de grave qui gronde. */
function bruit(source: Source, creteDb: number): Son {
  return aCrete(passeHaut(src(source), 250), creteDb);
}

/**
 * Le fichier d'ecoute d'une musique : jouee jusqu'a sa couture B, puis reprise
 * en A pendant `apres` secondes — ce que le jeu fera a chaque tour. Pour une
 * musique deja connue, on ne garde que les `avant` secondes d'avant B.
 */
function ecouteDeLaBoucle(s: Son, r: Raccord, apres: number, avant?: number): Son {
  const B = r.fin;
  const debut = avant === undefined ? 0 : Math.max(0, B - avant);
  const tete = decouper(s, debut, B - debut);
  const suite = decouper(s, r.debut, apres);
  const tout = silence(duree(tete) + duree(suite));
  poser(tout, tete, 0);
  poser(tout, suite, duree(tete));
  enveloppe(tout, (t) => 1 - rampe(t, duree(tout) - 2, duree(tout)));
  return tout;
}

const minutes = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;

// ----------------------------------------------------------------- credits

function credits(): string {
  const livrees = new Set(MUSIQUES.filter((m) => m.livree).map((m) => m.source));
  const enMusique = new Set(MUSIQUES.map((m) => m.source));
  const lignes = (Object.values(SOURCES) as Source[])
    .filter((s) => !enMusique.has(s) || livrees.has(s))
    .map((s) => `| ${s.role} | [${s.titre}](${s.page}) | ${s.auteur} | ${s.licence} |`);
  return [
    "# Les sons du jeu",
    "",
    "Fabriques par `npm run son` (`scripts/son/intro.ts`). Ce fichier est reecrit a chaque",
    "passage : ne pas le modifier a la main.",
    "",
    "Tous les enregistrements sont **libres de droits (CC0)** : aucune attribution n'est",
    "exigee, on credite quand meme. **La cloche et le grondement du feu ne viennent de",
    "personne** : ils sont fabriques par le code (`scripts/son/synthese.ts`), faute d'un glas",
    "libre de droits propre.",
    "",
    "| Sert a | Son | Auteur | Licence |",
    "|---|---|---|---|",
    ...lignes,
    "",
  ].join("\n");
}

// -------------------------------------------------------------------- tout

async function main(): Promise<void> {
  const chercher = process.argv.includes("--chercher");

  await recupererLesSources();
  mkdirSync(SORTIE, { recursive: true });
  mkdirSync(ECOUTE, { recursive: true });

  console.log("[son] mixage");
  const OGG = ["-c:a", "libvorbis", "-q:a", "4"];
  const MP3 = ["-c:a", "libmp3lame", "-b:a", "128k"];
  const OGG_MUSIQUE = ["-c:a", "libvorbis", "-q:a", "3"];
  const MP3_MUSIQUE = ["-c:a", "libmp3lame", "-b:a", "112k"];
  const livrer = (s: Son, nom: string, ogg = OGG, mp3 = MP3) => {
    ecrire(s, `${SORTIE}/${nom}.ogg`, ogg);
    ecrire(s, `${SORTIE}/${nom}.mp3`, mp3);
    console.log(`[son] ${nom} : ${duree(s).toFixed(1)} s, ${niveau(s).toFixed(1)} dB eff., crete ${(20 * Math.log10(crete(s))).toFixed(1)} dB`);
  };
  livrer(pisteDuFilm(), "intro-approche");
  livrer(glasDuTitre(), "titre-glas");
  livrer(feuDuMenu(), "titre-feu");
  livrer(bruit(SOURCES.survol, -14), "ui-survol");
  livrer(bruit(SOURCES.clic, -8), "ui-clic");

  console.log("[son] musiques");
  const boucles: Record<string, { depuis: number; jusqua: number }> = {};
  for (const m of MUSIQUES) {
    const { son, raccord } = preparerMusique(m, chercher);
    const r3 = (x: number) => Math.round(x * 1000) / 1000;
    console.log(
      `[son] ${m.nom} : ${minutes(duree(son))}, boucle de ${minutes(raccord.debut)} a ${minutes(raccord.fin)} ` +
        `(${raccord.debut.toFixed(3)} -> ${raccord.fin.toFixed(3)} s, ecart ${raccord.ecart.toFixed(1)} dB, ressemblance ${raccord.correlation.toFixed(2)})`,
    );
    if (m.livree) {
      livrer(son, m.nom, OGG_MUSIQUE, MP3_MUSIQUE);
      boucles[m.nom] = { depuis: r3(raccord.debut), jusqua: r3(raccord.fin) };
    }
    // L'ecoute : la guerre est connue, on n'en garde que la couture ; les calmes en entier.
    const ecoute = m.livree ? ecouteDeLaBoucle(son, raccord, 30, 30) : ecouteDeLaBoucle(son, raccord, 30);
    const couture = m.livree ? 30 : raccord.fin;
    const fichier = `${ECOUTE}/${m.nom}-couture-a-${minutes(couture).replace(":", "m")}s.mp3`;
    ecrire(ecoute, fichier, ["-c:a", "libmp3lame", "-b:a", "160k"]);
    console.log(`[son]   ecoute : ${fichier.replace(RACINE, ".")}`);
  }
  writeFileSync(`${SORTIE}/boucles.json`, JSON.stringify(boucles, null, 2) + "\n");
  writeFileSync(`${SORTIE}/CREDITS.md`, credits());
}

void main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
