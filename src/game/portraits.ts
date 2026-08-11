import Phaser from "phaser";
import { pireEtat } from "../core/etats";
import { REGLAGES_STRESS, type Personne } from "../core/personne";
import { SEQUELLES } from "../core/traits";

/**
 * Les portraits, **assembles par morceaux en code** (DESIGN.md §4.23).
 *
 * Une banque de pieces — silhouettes, teints, coupes, yeux, nez, bouches,
 * barbes, couvre-chefs, accessoires — combinees selon la personne. Des millions
 * de visages coherents, **zero cout par habitant** en memoire d'assets : la
 * population n'a pas de plafond (§4.18), un PNG par personne etait donc exclu.
 *
 * > **Pourquoi assemble et pas genere.** Un portrait fige ne peut rien raconter.
 * > Assemble, il **change avec la personne** : la paleur du malade, les cernes
 * > de l'insomniaque, la grosse balafre du Miracule, le regard fuyant de celui
 * > qui ment a la porte (§4.10, bloc 6). Le portrait devient une lecture d'etat,
 * > pas une decoration.
 *
 * ⚠️ **Ce qui a un plafond ici, ce n'est pas le nombre de pieces — c'est le
 * nombre de textures vivantes.** Chaque portrait est une texture Phaser ; en
 * fabriquer une par personne et par changement d'humeur, sans jamais en
 * detruire, viderait la memoire en une partie longue. Le §4.17 exige un
 * plafond : c'est `MAX_PORTRAITS`, et l'entree la plus vieille est detruite.
 */

/** Taille du portrait, en pixels de texture. Il s'affiche agrandi x4 ou x6. */
export const TAILLE_PORTRAIT = { largeur: 24, hauteur: 28 };

/**
 * Combien de portraits vivent en meme temps.
 *
 * Trente habitants plus dix heros font quarante ; on double pour absorber les
 * changements d'humeur en cours de partie sans rien detruire tout de suite.
 */
const MAX_PORTRAITS = 96;

// ------------------------------------------------------------ la banque

/**
 * Les teints de peau. Ils ne disent rien du personnage : c'est le seul choix
 * purement esthetique du fichier.
 */
const TEINTS = [0xf2d0b0, 0xe8c39a, 0xd9ac86, 0xc08e63, 0xa06f4c, 0x7d5336, 0x5f3d28, 0xefe0cc];

const COULEURS_CHEVEUX = [
  0x2b1d16, 0x4a3423, 0x6b4a2c, 0x8c6239, 0xb07f43, 0xd4b070, 0xe8dcc0, 0x8a8a8a, 0xd8d8d8,
  0x7a2f28, 0x3a3a4a,
];

const COULEURS_YEUX = [0x3b2a1a, 0x5a4630, 0x2f5a4a, 0x2f4a6b, 0x6b6b6b, 0x4a2f5a];

const COULEURS_VETEMENT = [
  0x6b5a44, 0x4a5a6b, 0x5a6b4a, 0x6b4a52, 0x7a6a4a, 0x44506b, 0x5f4a6b, 0x8a7550,
];

/**
 * Les coupes de cheveux, decrites en rectangles.
 *
 * Chaque coupe est une liste de bandes `[x, y, largeur, hauteur]` dans le repere
 * du portrait. Les decrire en donnees plutot qu'en code fait qu'en ajouter une
 * ne demande pas de toucher au dessinateur.
 */
type Bandes = [number, number, number, number][];

const COUPES: Bandes[] = [
  [], // chauve
  [[6, 4, 12, 3]], // ras
  [
    [6, 3, 12, 4],
    [5, 6, 2, 5],
    [17, 6, 2, 5],
  ], // au bol
  [
    [6, 3, 12, 3],
    [4, 5, 3, 9],
    [17, 5, 3, 9],
  ], // longs
  [
    [6, 2, 12, 5],
    [6, 1, 5, 2],
  ], // banane
  [
    [7, 3, 10, 3],
    [16, 5, 3, 4],
  ], // raie sur le cote
  [
    [6, 3, 12, 4],
    [3, 6, 3, 12],
    [18, 6, 3, 12],
  ], // tres longs
  [
    [6, 4, 12, 2],
    [8, 2, 3, 3],
    [13, 2, 3, 3],
  ], // en pics
  [
    [6, 3, 12, 4],
    [10, 1, 4, 3],
  ], // chignon
  [
    [5, 4, 14, 3],
    [5, 7, 2, 3],
    [17, 7, 2, 3],
  ], // carre
  [
    [7, 2, 10, 4],
    [6, 6, 2, 3],
  ], // dégarni
  [
    [6, 3, 12, 5],
    [4, 7, 2, 6],
    [18, 7, 2, 6],
    [9, 1, 6, 2],
  ], // crinière
];

const BARBES: Bandes[] = [
  [], // glabre
  [[10, 17, 4, 2]], // bouc
  [
    [7, 16, 10, 3],
    [7, 14, 2, 3],
    [15, 14, 2, 3],
  ], // pleine
  [[9, 14, 6, 1]], // moustache
  [
    [7, 15, 10, 5],
    [9, 20, 6, 2],
  ], // longue
  [
    [8, 16, 8, 2],
    [9, 14, 6, 1],
  ], // taillee
  [
    [7, 15, 10, 2],
    [7, 17, 2, 2],
    [15, 17, 2, 2],
  ], // collier
];

const COUVRE_CHEFS: { bandes: Bandes; couleur: number }[] = [
  { bandes: [], couleur: 0 }, // tete nue — le plus frequent
  { bandes: [], couleur: 0 },
  { bandes: [], couleur: 0 },
  {
    bandes: [
      [5, 3, 14, 2],
      [7, 1, 10, 2],
    ],
    couleur: 0x6b4a2c,
  }, // chapeau de paille
  {
    bandes: [
      [6, 2, 12, 4],
      [4, 5, 16, 1],
    ],
    couleur: 0x4a4a5a,
  }, // capuche
  {
    bandes: [[6, 3, 12, 3]],
    couleur: 0x7a2f28,
  }, // bandeau
  {
    bandes: [
      [6, 1, 12, 5],
      [5, 5, 14, 1],
    ],
    couleur: 0x8a8f9a,
  }, // casque
  {
    bandes: [
      [6, 2, 12, 4],
      [16, 2, 4, 8],
    ],
    couleur: 0x5a6b4a,
  }, // bonnet a pan
];

const NEZ: Bandes[] = [
  [[11, 12, 2, 2]],
  [[11, 11, 2, 4]],
  [[11, 12, 3, 2]],
  [[10, 12, 2, 3]],
  [[11, 13, 2, 1]],
];

const BOUCHES: Bandes[] = [
  [[10, 16, 4, 1]],
  [[9, 16, 6, 1]],
  [[11, 16, 2, 1]],
  [
    [10, 16, 4, 1],
    [9, 15, 1, 1],
    [14, 15, 1, 1],
  ], // sourire
  [
    [10, 16, 4, 1],
    [9, 17, 1, 1],
    [14, 17, 1, 1],
  ], // moue
];

const SOURCILS: Bandes[] = [
  [
    [7, 9, 3, 1],
    [14, 9, 3, 1],
  ],
  [
    [7, 8, 4, 2],
    [13, 8, 4, 2],
  ], // epais
  [
    [7, 9, 3, 1],
    [14, 8, 3, 1],
  ], // dissymetriques
  [
    [8, 9, 2, 1],
    [15, 9, 2, 1],
  ], // fins
];

/** Les silhouettes de visage : etroit, ordinaire, large, carre. */
const VISAGES: { x: number; largeur: number; hauteur: number }[] = [
  { x: 8, largeur: 9, hauteur: 15 },
  { x: 7, largeur: 11, hauteur: 15 },
  { x: 6, largeur: 13, hauteur: 15 },
  { x: 7, largeur: 11, hauteur: 17 },
];

const ACCESSOIRES: { bandes: Bandes; couleur: number }[] = [
  { bandes: [], couleur: 0 },
  { bandes: [], couleur: 0 },
  { bandes: [], couleur: 0 },
  { bandes: [[18, 11, 2, 2]], couleur: 0xd4b070 }, // boucle d'oreille
  { bandes: [[4, 11, 2, 2]], couleur: 0xd4b070 },
  {
    bandes: [
      [6, 10, 5, 4],
      [13, 10, 5, 4],
      [11, 11, 2, 1],
    ],
    couleur: 0x8a8f9a,
  }, // besicles
];

/**
 * Le nombre de visages differents que la banque peut produire.
 *
 * Utile a une seule chose, mais elle vaut le coup : repondre a la question du
 * §6, « combien de pieces pour que deux habitants ne se ressemblent jamais ».
 */
export const COMBINAISONS =
  VISAGES.length *
  TEINTS.length *
  COUPES.length *
  COULEURS_CHEVEUX.length *
  COULEURS_YEUX.length *
  SOURCILS.length *
  NEZ.length *
  BOUCHES.length *
  BARBES.length *
  COUVRE_CHEFS.length *
  ACCESSOIRES.length *
  COULEURS_VETEMENT.length;

// ------------------------------------------------------- l'etat du visage

/**
 * Ce que le portrait montre de l'etat du moment.
 *
 * C'est la couche qui fait tout l'interet du systeme : un portrait qui ne
 * changerait pas ne raconterait rien.
 */
interface Humeur {
  /** Le teint tire vers le gris : malade, blesse */
  paleur: number;
  /** Des cernes sous les yeux : le stress, l'insomnie */
  cernes: boolean;
  /** Une balafre en travers : le Miracule, la main mutilee */
  cicatrice: boolean;
  /** Les yeux qui ne regardent pas droit : la peur, le mensonge (§4.10) */
  regardFuyant: boolean;
  /** Les yeux mi-clos, la bouche tombante : l'abattement */
  eteint: boolean;
  /** Mort : tout vire au gris */
  mort: boolean;
}

function humeurDe(personne: Personne, vivant: boolean, regardForce = false): Humeur {
  const pire = pireEtat(personne.etats);
  const sequellesVisibles = personne.sequelles.some((id) => SEQUELLES[id]?.visible);

  return {
    paleur: pire ? 0.18 + pire.palier * 0.22 : 0,
    cernes: personne.stress >= REGLAGES_STRESS.seuilVisible,
    cicatrice: sequellesVisibles,
    regardFuyant:
      regardForce || personne.rupture === "paranoia" || personne.rupture === "terreur",
    eteint: personne.rupture === "abattement" || !vivant,
    mort: !vivant,
  };
}

/**
 * La signature d'un visage : la graine, plus tout ce qui le fait changer.
 *
 * Elle sert de cle de texture. Tant qu'elle ne bouge pas, on ne redessine rien —
 * et elle ne bouge que quand la personne change vraiment d'etat, soit quelques
 * fois par partie et par personne.
 */
function signature(personne: Personne, humeur: Humeur): string {
  return [
    personne.grainePortrait,
    Math.round(humeur.paleur * 10),
    humeur.cernes ? 1 : 0,
    humeur.cicatrice ? 1 : 0,
    humeur.regardFuyant ? 1 : 0,
    humeur.eteint ? 1 : 0,
    humeur.mort ? 1 : 0,
  ].join("-");
}

// ---------------------------------------------------------------- le cache

/** Les cles vivantes, dans leur ordre de creation : la plus vieille sort d'abord. */
const vivantes: string[] = [];

/**
 * La texture du portrait de cette personne, fabriquee si besoin.
 *
 * @returns la cle de texture, a poser sur un `scene.add.image`
 */
export function portraitDe(
  scene: Phaser.Scene,
  personne: Personne,
  vivant = true,
  /**
   * Force le regard a glisser sur le cote, quelle que soit l'humeur.
   *
   * C'est **le portrait qui trahit le mensonge**, pas une ligne de texte
   * (§4.10) : a la porte, quelqu'un qui vient de se contredire regarde ailleurs.
   * Le §4.23 ne connait que la paranoia et la terreur ; la porte a besoin de le
   * demander directement, et la signature de texture en tient compte, donc les
   * deux visages du meme homme coexistent dans le cache sans se marcher dessus.
   */
  regardFuyant = false,
): string {
  const humeur = humeurDe(personne, vivant, regardFuyant);
  const cle = `portrait-${signature(personne, humeur)}`;
  if (scene.textures.exists(cle)) return cle;

  dessiner(scene, cle, personne.grainePortrait, humeur);

  vivantes.push(cle);
  while (vivantes.length > MAX_PORTRAITS) {
    const vieille = vivantes.shift()!;
    if (scene.textures.exists(vieille)) scene.textures.remove(vieille);
  }
  return cle;
}

/** Vide le cache. A appeler entre deux parties, sinon les visages s'accumulent. */
export function oublierLesPortraits(scene: Phaser.Scene): void {
  for (const cle of vivantes) {
    if (scene.textures.exists(cle)) scene.textures.remove(cle);
  }
  vivantes.length = 0;
}

// ------------------------------------------------------------ le dessin

/**
 * Un tirage deterministe a partir de la graine.
 *
 * Volontairement plus simple que `Rng` : on ne veut pas d'objet a construire
 * pour dessiner un visage, et surtout la **meme graine doit toujours donner le
 * meme visage**, quel que soit l'ordre dans lequel les portraits sont demandes.
 */
function piece<T>(graine: number, rang: number, banque: readonly T[]): T {
  let x = (graine + rang * 0x9e3779b9) >>> 0;
  x ^= x >>> 16;
  x = Math.imul(x, 0x85ebca6b) >>> 0;
  x ^= x >>> 13;

  // ⚠️ `>>> 0` **obligatoire**, et il a coute un plantage trouve en jouant :
  // en JavaScript, `^` rend un entier **signe** sur 32 bits. Sans ce dernier
  // rappel a l'unsigned, `x` finissait negatif une fois sur deux, `x % longueur`
  // aussi, et `banque[-3]` vaut `undefined`. TypeScript ne voit rien : le type
  // de `x` est `number` dans les deux cas.
  return banque[(x >>> 0) % banque.length]!;
}

function dessiner(
  scene: Phaser.Scene,
  cle: string,
  graine: number,
  humeur: Humeur,
): void {
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  const { largeur, hauteur } = TAILLE_PORTRAIT;

  const visage = piece(graine, 1, VISAGES);
  const teint = melanger(piece(graine, 2, TEINTS), 0x9a94a0, humeur.paleur);
  const coupe = piece(graine, 3, COUPES);
  const cheveux = piece(graine, 4, COULEURS_CHEVEUX);
  const oeil = piece(graine, 5, COULEURS_YEUX);
  const sourcils = piece(graine, 6, SOURCILS);
  const nez = piece(graine, 7, NEZ);
  const bouche = piece(graine, 8, BOUCHES);
  const barbe = piece(graine, 9, BARBES);
  const chapeau = piece(graine, 10, COUVRE_CHEFS);
  const accessoire = piece(graine, 11, ACCESSOIRES);
  const vetement = piece(graine, 12, COULEURS_VETEMENT);

  const gris = humeur.mort ? 0.6 : 0;

  // Le fond : il fait le cadre, et il change avec l'humeur sans qu'on ait a
  // dessiner un cadre.
  g.fillStyle(melanger(0x2a2433, 0x3a2f3a, humeur.paleur), 1);
  g.fillRect(0, 0, largeur, hauteur);

  // Les epaules, sous le menton.
  g.fillStyle(melanger(vetement, 0x6b6478, gris), 1);
  g.fillRect(3, 22, largeur - 6, hauteur - 22);
  g.fillStyle(melanger(teint, 0x6b6478, gris), 1);
  g.fillRect(10, 20, 4, 3); // le cou

  // Le visage.
  g.fillRect(visage.x, 6, visage.largeur, visage.hauteur);

  // Les cheveux, puis les sourcils, puis les yeux : l'ordre fait la lisibilite.
  bandes(g, coupe, melanger(cheveux, 0x6b6478, gris));
  bandes(g, sourcils, melanger(cheveux, 0x000000, 0.25));

  dessinerYeux(g, melanger(oeil, 0x6b6478, gris), humeur);

  bandes(g, nez, melanger(teint, 0x000000, 0.22));
  // La barbe **avant** la bouche : dans l'autre sens elle la recouvrait
  // entierement, et un visage sans bouche ne peut plus rien exprimer.
  bandes(g, barbe, melanger(cheveux, 0x000000, 0.15));
  bandes(g, humeur.eteint ? BOUCHES[4]! : bouche, 0x7a4a44);
  if (chapeau.bandes.length > 0) bandes(g, chapeau.bandes, melanger(chapeau.couleur, 0x6b6478, gris));
  if (accessoire.bandes.length > 0) bandes(g, accessoire.bandes, accessoire.couleur);

  // La grosse balafre du Miracule : elle passe par-dessus tout le reste, parce
  // que c'est ce qu'on doit voir en premier (§4.23).
  if (humeur.cicatrice) {
    g.fillStyle(0xb05a54, 1);
    for (let i = 0; i < 9; i++) g.fillRect(7 + i, 6 + i, 1, 1);
  }

  g.generateTexture(cle, largeur, hauteur);
  g.destroy();
}

/**
 * Les yeux, en trois pixels de large.
 *
 * ⚠️ Ils en faisaient quatre, et vu en jouant : sur un visage de 24 px, ca
 * donnait deux grands rectangles blancs qu'on lisait comme un masque. Le blanc
 * doit rester **plus etroit que la pupille n'est petite**, sinon le regard
 * devient le seul element visible du portrait.
 */
function dessinerYeux(g: Phaser.GameObjects.Graphics, couleur: number, humeur: Humeur): void {
  const haut = humeur.eteint ? 1 : 2;

  g.fillStyle(0xd8d0c4, 1);
  g.fillRect(9, 10, 2, haut);
  g.fillRect(14, 10, 2, haut);

  // Le regard fuyant : les deux pupilles glissent du meme cote. C'est ce qui
  // portera le mensonge a la porte, au bloc 6 (§4.10) — pas une ligne de texte.
  const decalage = humeur.regardFuyant ? 1 : 0;
  g.fillStyle(couleur, 1);
  g.fillRect(9 + decalage, 10, 1, haut);
  g.fillRect(14 + decalage, 10, 1, haut);

  if (humeur.cernes) {
    g.fillStyle(0x5a4a58, 0.7);
    g.fillRect(9, 12, 2, 1);
    g.fillRect(14, 12, 2, 1);
  }
}

function bandes(g: Phaser.GameObjects.Graphics, liste: Bandes, couleur: number): void {
  if (liste.length === 0) return;
  g.fillStyle(couleur, 1);
  for (const [x, y, l, h] of liste) g.fillRect(x, y, l, h);
}

/** Deux couleurs melangees, `part` valant 0 pour la premiere et 1 pour la seconde. */
function melanger(a: number, b: number, part: number): number {
  if (part <= 0) return a;
  const p = Math.min(1, part);
  const r = Math.round(((a >> 16) & 0xff) * (1 - p) + ((b >> 16) & 0xff) * p);
  const v = Math.round(((a >> 8) & 0xff) * (1 - p) + ((b >> 8) & 0xff) * p);
  const bl = Math.round((a & 0xff) * (1 - p) + (b & 0xff) * p);
  return (r << 16) | (v << 8) | bl;
}
