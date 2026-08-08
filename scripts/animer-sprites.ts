/**
 * Fabrique les planches d'animation a partir des sprites existants.
 *
 * Le principe, et pourquoi c'est celui-la : on ne **genere** rien, on
 * **recompose**. Chaque sprite est coupe en deux morceaux — le haut (tete,
 * torse, arme) et le bas (jambes ou pan de robe) — puis chaque frame est
 * obtenue en reposant ces morceaux a quelques pixels d'ecart. Les pixels
 * sortis sont exactement les pixels d'entree : la direction artistique ne peut
 * pas deriver, ce qui serait inevitable avec une image generee frame par frame.
 *
 * C'est gratuit, hors-ligne, instantane et rejouable autant qu'on veut. Et le
 * script se fiche de la taille de la source : le jour ou les heros repassent en
 * 64 px, on relance sans rien changer.
 *
 * Usage :
 *
 *   npx tsx scripts/animer-sprites.ts            # regenere tout
 *   npx tsx scripts/animer-sprites.ts --planche  # + une planche de controle
 *
 * Contrainte a ne jamais perdre de vue : **la frame fait la meme taille que la
 * source**. Le corps physique du jeu est cale sur les dimensions de la texture
 * (`calerCorps`, entities.ts) — une frame plus grande deplacerait les hitbox de
 * tout le monde.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ecrirePng, imageVide, lirePng, pixel, poser, type Image } from "./png";

const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCES = join(RACINE, "src", "assets");
const SORTIE = join(SOURCES, "anims");

/**
 * Part de la hauteur du contenu occupee par le bas du corps.
 *
 * On ne cherche pas la hanche anatomique : les armes debordent tellement
 * (l'epee du guerrier descend jusqu'a la ceinture, le baton du mage monte plus
 * haut que sa tete) qu'aucune mesure de largeur ne la trouve de facon fiable.
 * Une fraction fixe tombe juste sur le guerrier, et a cette echelle un decalage
 * d'une ligne ne se voit pas — ce qui se voit, c'est que le bas bouge.
 */
const PART_DU_BAS = 0.22;

/** Ce qu'on anime : tout ce qui marche et se bat. */
const SPRITES = [
  "hero-guerrier",
  "hero-chevalier",
  "hero-mage",
  "hero-assassin",
  "hero-rodeur",
  "hero-oracle",
  "hero-necromancien",
  "ennemi",
  "mort-vivant",
  "familier",
  "familier-golem",
  "familier-spectre",
];

/**
 * Une frame, decrite par des **pivots** et non par des translations.
 *
 * C'est la correction du premier jet, et elle est structurante. Deplacer le
 * haut du corps de 1 px vers le haut pendant que les jambes restent en place
 * ouvre une ligne de vide a la ceinture : le personnage se **coupe en deux**.
 * On ne translate donc plus les morceaux les uns par rapport aux autres — on
 * les fait pivoter autour de la hanche, ce qui laisse toujours les deux bandes
 * jointes sur la ligne de partage.
 *
 * Tout est en **pixels entiers**. Un demi-pixel demanderait d'interpoler, et
 * interpoler du pixel-art le rend flou : c'est precisement ce qu'on evite en
 * recomposant plutot qu'en faisant tourner un sprite.
 */
interface Frame {
  /** Rebond vertical du corps **entier** : sans tearing, puisque tout suit */
  dy?: number;
  /** Inclinaison du buste, nulle a la hanche et maximale a la tete */
  penche?: number;
  /** Balancement des jambes, nul a la hanche et maximal aux pieds */
  jambes?: number;
  /**
   * Basculement de tout le corps, pivotant sur les pieds : la chute.
   * Exprime en **pixels de deplacement du sommet du crane** — les pieds ne
   * bougent pas, et les lignes intermediaires se repartissent entre les deux.
   */
  bascule?: number;
  /** Opacite de la frame, de 0 a 1 */
  opacite?: number;
}

interface Animation {
  /** Suffixe de la cle de texture : `hero-guerrier-marche` */
  nom: string;
  /** Images par seconde */
  cadence: number;
  /** Vrai si elle tourne en boucle */
  boucle: boolean;
  frames: Frame[];
}

/**
 * Les animations, en clair.
 *
 * Les amplitudes sont volontairement minuscules — un ou deux pixels. Sur un
 * personnage de 32 px affiche a une quarantaine de pixels a l'ecran, deplacer
 * un membre de trois pixels ne le fait pas marcher, ca le disloque.
 */
const ANIMATIONS: Animation[] = [
  {
    // Le repos n'est pas l'immobilite : une respiration tres lente, pour que le
    // personnage a l'arret ne soit pas une statue. Un seul pixel, trois fois
    // par seconde — au-dela, il ne respire plus, il flotte.
    nom: "repos",
    cadence: 3,
    boucle: true,
    frames: [{ dy: 0 }, { dy: -1 }, { dy: 0 }, { dy: 0 }],
  },
  {
    // Le cycle de marche. Deux choses le portent : le rebond du corps entier,
    // et les jambes qui balancent depuis la hanche. Six frames — appui,
    // passage, relance, de chaque cote.
    nom: "marche",
    cadence: 10,
    boucle: true,
    frames: [
      { dy: -1, jambes: 2 },
      { dy: 0, jambes: 1 },
      { dy: 0, jambes: 0 },
      { dy: -1, jambes: -2 },
      { dy: 0, jambes: -1 },
      { dy: 0, jambes: 0 },
    ],
  },
  {
    // L'attaque : il se ramasse, il se fend, il revient. Le premier temps part
    // en arriere — c'est l'armement, et sans lui le coup n'a pas de poids.
    nom: "attaque",
    cadence: 14,
    boucle: false,
    frames: [
      { penche: -2, jambes: -1 },
      { penche: 3, dy: -1, jambes: 1 },
      { penche: 2, jambes: 1 },
      { penche: 1, jambes: 0 },
    ],
  },
  {
    // L'armement d'un monstre : il se cabre et **il tient la pose**. La derniere
    // frame reste affichee jusqu'a ce que le coup parte, ce qui laisse la meme
    // animation servir un essaim (150 ms) et une brute (620 ms).
    nom: "charge",
    cadence: 8,
    boucle: false,
    frames: [{ penche: -1, jambes: -1 }, { penche: -3, jambes: -2 }],
  },
  {
    // L'incantation : plus ample que l'attaque, et on doit la voir venir.
    nom: "incantation",
    cadence: 9,
    boucle: false,
    frames: [
      { penche: -2, dy: -1 },
      { penche: -4, dy: -1 },
      { penche: -3 },
    ],
  },
  {
    // L'encaissement : un sursaut en arriere, et c'est tout. Bref par
    // necessite — on le joue a chaque coup recu.
    nom: "touche",
    cadence: 12,
    boucle: false,
    frames: [
      { penche: -3, dy: -1, jambes: -1 },
      { penche: -1, jambes: 0 },
    ],
  },
  {
    // La chute. Le corps bascule sur ses pieds en s'affaissant, puis s'efface.
    // Le basculement est un cisaillement ligne par ligne : ca garde les pixels
    // nets, la ou une vraie rotation les melangerait.
    nom: "mort",
    cadence: 12,
    boucle: false,
    // La tete part d'une douzaine de pixels, pas davantage : au-dela elle sort
    // de la frame, et le personnage se termine en trainee diagonale.
    frames: [
      { dy: -1, penche: -1 },
      { bascule: 2 },
      { bascule: 5, dy: 1, opacite: 0.9 },
      { bascule: 8, dy: 2, opacite: 0.7 },
      { bascule: 11, dy: 3, opacite: 0.45 },
      { bascule: 13, dy: 4, opacite: 0.2 },
    ],
  },
];

// ------------------------------------------------------------------ decoupe

interface Corps {
  /** Premiere et derniere ligne contenant quelque chose */
  haut: number;
  bas: number;
  /** Ligne a partir de laquelle commence le bas du corps */
  hanche: number;
}

function decouper(image: Image): Corps {
  let premiere = -1;
  let derniere = -1;
  for (let y = 0; y < image.hauteur; y++) {
    let vide = true;
    for (let x = 0; x < image.largeur; x++) {
      if (pixel(image, x, y)[3] > 0) {
        vide = false;
        break;
      }
    }
    if (vide) continue;
    if (premiere < 0) premiere = y;
    derniere = y;
  }
  if (premiere < 0) throw new Error("Sprite entierement transparent");

  const hauteur = derniere - premiere + 1;
  const hanche = Math.max(premiere + 1, derniere - Math.round(hauteur * PART_DU_BAS) + 1);
  return { haut: premiere, bas: derniere, hanche };
}

// -------------------------------------------------------------- composition

/**
 * Compose une frame.
 *
 * Chaque ligne de l'image se voit attribuer **un seul** decalage horizontal,
 * somme de trois pivots. Comme les trois valent zero sur la ligne de hanche et
 * croissent progressivement en s'en eloignant, deux lignes voisines ne peuvent
 * jamais s'ecarter de plus d'un pixel : le personnage se deforme, il ne se
 * disloque pas.
 */
function composer(source: Image, corps: Corps, frame: Frame): Image {
  const sortie = imageVide(source.largeur, source.hauteur);
  const dy = frame.dy ?? 0;
  const penche = frame.penche ?? 0;
  const jambes = frame.jambes ?? 0;
  const bascule = frame.bascule ?? 0;
  const opacite = frame.opacite ?? 1;

  // Bras de levier : de la hanche a la tete, de la hanche aux pieds, et des
  // pieds a la tete pour la chute.
  const buste = Math.max(1, corps.hanche - corps.haut);
  const bas = Math.max(1, corps.bas - corps.hanche);
  const stature = Math.max(1, corps.bas - corps.haut);

  for (let y = corps.haut; y <= corps.bas; y++) {
    // Le buste s'incline autour de la hanche ; les jambes balancent autour de
    // la meme ligne, en sens inverse. La chute, elle, pivote sur les pieds.
    const glissement =
      y < corps.hanche
        ? Math.round((penche * (corps.hanche - y)) / buste)
        : Math.round((jambes * (y - corps.hanche)) / bas);
    const chute = Math.round((bascule * (corps.bas - y)) / stature);

    for (let x = 0; x < source.largeur; x++) {
      const p = pixel(source, x, y);
      if (p[3] === 0) continue;
      poser(sortie, x + glissement + chute, y + dy, [
        p[0],
        p[1],
        p[2],
        Math.round(p[3] * opacite),
      ]);
    }
  }
  return sortie;
}

/** Assemble les frames cote a cote : c'est le format qu'attend Phaser. */
function planche(frames: Image[]): Image {
  const largeur = frames[0]!.largeur;
  const hauteur = frames[0]!.hauteur;
  const sortie = imageVide(largeur * frames.length, hauteur);
  frames.forEach((frame, i) => {
    for (let y = 0; y < hauteur; y++)
      for (let x = 0; x < largeur; x++) poser(sortie, i * largeur + x, y, pixel(frame, x, y));
  });
  return sortie;
}

// ------------------------------------------------------------------- sortie

/**
 * Une planche, et les animations qu'elle contient.
 *
 * Toutes les animations d'un personnage vivent dans **une seule** texture, et
 * c'est une contrainte de rendu, pas de rangement : le moteur ne peut grouper
 * en un seul lot que des sprites qui partagent leur texture. Avec une planche
 * par animation, 240 monstres dont certains marchent et d'autres se cabrent
 * forcaient autant de changements de texture — mesure faite, le framerate
 * tombait d'un quart.
 */
interface EntreeManifeste {
  /** Cle de la texture : `ennemi-anim` */
  cle: string;
  fichier: string;
  /** Cote d'une frame, en pixels : elles sont carrees */
  taille: number;
  /** Nombre total de frames de la planche */
  frames: number;
  animations: {
    /** Cle de l'animation : `ennemi-marche` */
    cle: string;
    debut: number;
    fin: number;
    cadence: number;
    boucle: boolean;
  }[];
}

function main(): void {
  if (!existsSync(SORTIE)) mkdirSync(SORTIE, { recursive: true });
  const manifeste: EntreeManifeste[] = [];
  const controle: Image[] = [];

  for (const nom of SPRITES) {
    const chemin = join(SOURCES, `${nom}.png`);
    if (!existsSync(chemin)) {
      console.log(`  (absent) ${nom}`);
      continue;
    }
    const source = lirePng(readFileSync(chemin));
    const corps = decouper(source);

    // Toutes les animations bout a bout dans une seule bande, et le manifeste
    // note ou chacune commence et finit.
    const toutes: Image[] = [];
    const plages: EntreeManifeste["animations"] = [];
    for (const animation of ANIMATIONS) {
      const debut = toutes.length;
      for (const f of animation.frames) toutes.push(composer(source, corps, f));
      plages.push({
        cle: `${nom}-${animation.nom}`,
        debut,
        fin: toutes.length - 1,
        cadence: animation.cadence,
        boucle: animation.boucle,
      });
      if (animation.nom === "marche") {
        controle.push(planche(toutes.slice(debut)));
      }
    }

    const fichier = `${nom}.png`;
    writeFileSync(join(SORTIE, fichier), ecrirePng(planche(toutes)));
    manifeste.push({
      cle: `${nom}-anim`,
      fichier,
      taille: source.largeur,
      frames: toutes.length,
      animations: plages,
    });
    console.log(
      `  ${nom.padEnd(20)} contenu ${corps.haut}-${corps.bas}, hanche ${corps.hanche}, ` +
        `${plages.length} animations en ${toutes.length} frames`,
    );
  }

  writeFileSync(join(SORTIE, "manifeste.json"), `${JSON.stringify(manifeste, null, 2)}\n`);
  console.log(`\n${manifeste.length} planches ecrites dans src/assets/anims/`);

  if (process.argv.includes("--planche")) ecrireControle(controle);
}

/**
 * Une image de controle, agrandie : a 32 px on ne juge rien a l'oeil nu, et
 * une animation qui disloque un personnage doit se voir tout de suite.
 */
function ecrireControle(feuilles: Image[]): void {
  const Z = 5;
  const largeur = Math.max(...feuilles.map((f) => f.largeur)) * Z;
  const hauteur = feuilles.reduce((somme, f) => somme + f.hauteur * Z, 0);
  const sortie = imageVide(largeur, hauteur);
  for (let y = 0; y < hauteur; y++)
    for (let x = 0; x < largeur; x++) {
      const c = (Math.floor(x / 10) + Math.floor(y / 10)) % 2 ? 44 : 62;
      poser(sortie, x, y, [c, c, c, 255]);
    }

  let decalage = 0;
  for (const feuille of feuilles) {
    for (let y = 0; y < feuille.hauteur; y++)
      for (let x = 0; x < feuille.largeur; x++) {
        const p = pixel(feuille, x, y);
        if (p[3] === 0) continue;
        for (let dy = 0; dy < Z; dy++)
          for (let dx = 0; dx < Z; dx++)
            poser(sortie, x * Z + dx, decalage + y * Z + dy, p);
      }
    decalage += feuille.hauteur * Z;
  }
  const chemin = join(RACINE, ".tmp", "controle-marche.png");
  mkdirSync(dirname(chemin), { recursive: true });
  writeFileSync(chemin, ecrirePng(sortie));
  console.log(`Planche de controle : ${chemin}`);
}

main();
