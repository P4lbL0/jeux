import type Phaser from "phaser";
import { Toile } from "./pinceau";
import { bruit } from "./bruit";
import { ECORCE, FEUILLE, PIERRE, ROCHE, melanger, type Matiere,
  ARDOISE,
  BOIS,
  EAU,
  FER,
  SABLE,
  TISSU,
  TOILE,
} from "./palette";

/**
 * Le decor qui pousse et qui traine : arbres, rochers, souches (DESIGN.md §4.30).
 *
 * **Une foret d'apres la fin du monde.** Un arbre sur deux est mort — un tronc
 * tordu, des branches nues qui griffent — et les autres ont garde un feuillage
 * sombre, de la bile salie. C'est ce melange qui fait lire un monde qui a brule
 * sans etre un desert : il reste de quoi couper du bois, et il reste des
 * endroits ou l'on n'a pas envie d'aller la nuit.
 *
 * Tout est **vu de face** et monte dans l'image : le pied de l'arbre est son
 * point d'ancrage, et c'est lui qui decide de la profondeur (§4.30). Chaque
 * silhouette est dessinee **par le code, a partir de quelques nombres** : la
 * variete vient de ces nombres, pas de cinq dessins faits a la main.
 */

/** Une texture de decor : sa cle, sa taille, et ou tombe son pied. */
export interface Decor {
  cle: string;
  largeur: number;
  hauteur: number;
  /** L'origine verticale a donner au sprite pour que le pied touche le sol. */
  origineY: number;
}

/**
 * Ou le pied tombe dans chaque toile.
 *
 * ⚠️ Il faut de la place **sous** le pied : un tronc a bouts ronds descend de
 * deux pixels, et le contour en prend un de plus. Un pied pose au bord bas sort
 * du cadre, son contour est coupe, et le test du bord le dit.
 */
// Le cadre de l'arbre est celui du sprite rendu par Blender (bloc 7z, etage 6) :
// l'ombre portee deborde a droite, et le chene y est plus large. Le dessin au
// code, qui sert encore de secours, s'y centre sans changer de taille.
const ARBRE = { largeur: 40, hauteur: 46, pied: 40 };
const ROCHER = { largeur: 28, hauteur: 20, pied: 16 };
const SOUCHE = { largeur: 14, hauteur: 14, pied: 10 };
// Les details de vie (§4.24, 19 septembre 2026), rendus par Blender comme le
// reste du decor : un puits, un tonneau, un tas de bois, une charrette. Les
// tailles sont celles de `rendre.py` (le pied y est un de plus).
const PUITS = { largeur: 26, hauteur: 30, pied: 26 };
const TONNEAU = { largeur: 14, hauteur: 16, pied: 13 };
const TAS_DE_BOIS = { largeur: 26, hauteur: 18, pied: 15 };
const CHARRETTE = { largeur: 36, hauteur: 22, pied: 19 };
// Les deux derniers (20 septembre 2026) : du linge devant les maisons debout,
// des filets qui sechent au poste de peche et contre le port.
const CORDE_A_LINGE = { largeur: 40, hauteur: 20, pied: 16 };
const FILETS = { largeur: 36, hauteur: 24, pied: 20 };

/** Les arbres morts, les vivants, les coniferes, les rochers : leurs cles. */
export const ARBRES_MORTS = [0, 1, 2, 3].map((i) => `decor-arbre-mort-${i}`);
export const ARBRES_VIVANTS = [0, 1, 2].map((i) => `decor-arbre-${i}`);
export const CONIFERES = [0, 1].map((i) => `decor-conifere-${i}`);
export const ROCHERS = [0, 1, 2].map((i) => `decor-rocher-${i}`);
export const CLE_SOUCHE = "decor-souche";
export const CLE_PUITS = "decor-puits";
export const CLE_TONNEAU = "decor-tonneau";
export const CLE_TAS_DE_BOIS = "decor-tas-de-bois";
export const CLE_CHARRETTE = "decor-charrette";
export const CLE_CORDE_A_LINGE = "decor-corde-a-linge";
export const CLE_FILETS = "decor-filets";

/** Tous les arbres, morts et vivants, pour semer une foret. */
export const ARBRES = [...ARBRES_MORTS, ...ARBRES_VIVANTS, ...CONIFERES];

// --------------------------------------------------------------- les arbres

/** Une branche : un segment qui se casse en deux, comme du bois mort. */
function branche(
  toile: Toile,
  x: number,
  y: number,
  longueur: number,
  angle: number,
  epaisseur: number,
  m: Matiere,
  graine: number,
): void {
  const milieu = toile.membre(x, y, longueur * 0.55, angle, epaisseur, m.corps);
  const casse = (bruit(graine, 3, 5) - 0.5) * 0.9;
  const bout = toile.membre(
    milieu.x,
    milieu.y,
    longueur * 0.45,
    angle + casse,
    Math.max(1, epaisseur - 0.6),
    m.corps,
  );
  // Une brindille au bout, du cote ou le vent l'a laissee.
  if (longueur > 6) {
    toile.membre(bout.x, bout.y, 3, angle + casse + (casse > 0 ? 0.9 : -0.9), 1, m.sombre);
  }
}

/**
 * Un arbre mort : un tronc qui penche, des branches nues.
 *
 * ⚠️ Les angles sont ceux de `membre` : 0 vers le bas. Une branche qui monte
 * est donc autour de PI, et elle part a gauche ou a droite selon son signe.
 */
function peindreArbreMort(toile: Toile, variante: number): void {
  const { largeur, pied: sol } = ARBRE;
  const pied = largeur / 2;
  const g = variante * 17;

  toile.ombreAuSol(pied, sol + 1, 8, 2.5);

  // Le tronc penche d'un cote : un arbre mort n'est jamais droit.
  const penche = (bruit(g, 1, 1) - 0.5) * 0.5;
  const haut = 17 + Math.floor(bruit(g, 2, 1) * 7);
  const cime = toile.membre(pied, sol, haut, Math.PI + penche, 4, ECORCE.corps);
  // L'evasement du pied : des racines qui affleurent.
  toile.segment(pied - 4, sol, pied + 4, sol - 1, 2, ECORCE.corps);
  toile.point(pied - 4, sol - 1, ECORCE.sombre);
  toile.point(pied + 4, sol - 1, ECORCE.sombre);

  // Les branches, de la plus basse a la plus haute. Elles griffent vers le
  // haut : une branche qui pend est celle d'un saule, pas d'un mort.
  const nombre = 3 + Math.floor(bruit(g, 4, 1) * 2);
  for (let i = 0; i < nombre; i += 1) {
    const part = 0.35 + (i / nombre) * 0.6;
    const x = pied + Math.sin(Math.PI + penche) * haut * part;
    const y = sol + Math.cos(Math.PI + penche) * haut * part;
    const cote = i % 2 === 0 ? 1 : -1;
    const angle = Math.PI + cote * (0.55 + bruit(g, 10 + i, 1) * 0.5);
    branche(toile, x, y, 5 + bruit(g, 20 + i, 1) * 5, angle, 2, ECORCE, g + i);
  }
  // La cime se fend en deux.
  branche(toile, cime.x, cime.y, 4, Math.PI + penche - 0.5, 1.6, ECORCE, g + 9);
  branche(toile, cime.x, cime.y, 5, Math.PI + penche + 0.4, 1.6, ECORCE, g + 11);

  // La lumiere sur le flanc gauche du tronc : sans elle, c'est une rayure.
  for (let i = 2; i < haut - 2; i += 3) {
    const x = pied + Math.sin(Math.PI + penche) * i;
    const y = sol + Math.cos(Math.PI + penche) * i;
    toile.point(x - 1.5, y, ECORCE.clair);
  }
}

/**
 * Un arbre vivant : un tronc, et un houppier fait de plusieurs boules qui se
 * chevauchent a des hauteurs differentes.
 *
 * Une seule boule est un sucre d'orge ; c'est le decalage des boules qui donne
 * une silhouette qu'on reconnait de loin, et le §4.11 rappelle que c'est la
 * silhouette qui porte tout quand on dezoome.
 */
function peindreArbreVivant(toile: Toile, variante: number): void {
  const { largeur, pied: sol } = ARBRE;
  const pied = largeur / 2;
  const g = 100 + variante * 13;

  toile.ombreAuSol(pied, sol + 1, 9, 2.5);

  const tronc = 11 + Math.floor(bruit(g, 1, 2) * 4);
  toile.segment(pied, sol, pied, sol - tronc, 4, ECORCE.corps);
  toile.segment(pied - 1.5, sol, pied - 1.5, sol - tronc + 2, 1, ECORCE.clair);
  toile.segment(pied + 1.5, sol, pied + 1.5, sol - tronc + 2, 1, ECORCE.sombre);
  toile.segment(pied - 4, sol, pied + 4, sol - 1, 2, ECORCE.corps);

  // Le houppier : trois a quatre boules, la plus haute au milieu.
  const boules: { x: number; y: number; r: number }[] = [
    { x: pied, y: sol - tronc - 8, r: 6.5 + bruit(g, 5, 2) * 2 },
    { x: pied - 6, y: sol - tronc - 3, r: 5 + bruit(g, 6, 2) * 2 },
    { x: pied + 6, y: sol - tronc - 4, r: 5 + bruit(g, 7, 2) * 2 },
  ];
  if (bruit(g, 8, 2) > 0.4) boules.push({ x: pied + 2, y: sol - tronc - 12, r: 4.5 });

  // Les boules sombres d'abord, puis le corps, puis la lumiere en haut a
  // gauche : trois valeurs, et l'ordre fait le volume.
  for (const b of boules) toile.disque(b.x + 1, b.y + 1.5, b.r, FEUILLE.sombre);
  for (const b of boules) toile.disque(b.x, b.y, b.r - 1, FEUILLE.corps);
  for (const b of boules) {
    toile.disque(b.x - b.r * 0.35, b.y - b.r * 0.4, b.r * 0.38, FEUILLE.clair);
  }
  // Quelques trous dans le feuillage : un arbre qui a perdu des feuilles.
  for (let i = 0; i < 4; i += 1) {
    const b = boules[i % boules.length]!;
    const a = bruit(g, 30 + i, 2) * Math.PI * 2;
    toile.point(b.x + Math.cos(a) * b.r * 0.6, b.y + Math.sin(a) * b.r * 0.6, FEUILLE.sombre);
  }
}

/** Un conifere : une pile de triangles sombres. La foret du sud en est faite. */
function peindreConifere(toile: Toile, variante: number): void {
  const { largeur, pied: sol } = ARBRE;
  const pied = Math.round(largeur / 2);
  const g = 200 + variante * 7;

  toile.ombreAuSol(pied, sol + 1, 7, 2.2);
  toile.segment(pied, sol, pied, sol - 7, 3, ECORCE.corps);

  const etages = 3 + Math.floor(bruit(g, 1, 3) * 2);
  const haut = sol - 5;
  const cime = haut - 22 - Math.floor(bruit(g, 2, 3) * 5);
  const pas = (haut - cime) / etages;
  for (let e = 0; e < etages; e += 1) {
    const bas = haut - e * pas;
    const sommet = bas - pas * 1.6;
    const demi = 9 - e * (6 / etages);
    for (let y = Math.round(sommet); y <= Math.round(bas); y += 1) {
      const part = (y - sommet) / Math.max(1, bas - sommet);
      const largeurLigne = Math.round(demi * part);
      toile.rect(pied - largeurLigne, y, largeurLigne * 2 + 1, 1, FEUILLE.sombre);
      // La lumiere, a gauche, sur un pixel : c'est ce qui separe deux etages.
      if (largeurLigne > 1) toile.point(pied - largeurLigne + 1, y, FEUILLE.corps);
    }
  }
  toile.point(pied, cime - 1, FEUILLE.corps);
}

// -------------------------------------------------------------- les rochers

function peindreRocher(toile: Toile, variante: number): void {
  const { largeur, hauteur, pied: sol } = ROCHER;
  const g = 300 + variante * 5;

  toile.ombreAuSol(largeur / 2, sol, largeur / 2 - 2, 2.2);

  // Un bloc irregulier : deux disques qui se chevauchent, coupes au sol.
  const r1 = 6 + bruit(g, 1, 4) * 2;
  const r2 = 5 + bruit(g, 2, 4) * 2;
  const x1 = largeur / 2 - 3;
  const x2 = largeur / 2 + 4;
  const y1 = sol - r1 + 1;
  const y2 = sol - r2 + 1;

  const dessous = melanger(ROCHE.sombre, PIERRE.sombre, 0.4);
  toile.disque(x1 + 1, y1 + 1, r1, dessous);
  toile.disque(x2 + 1, y2 + 1, r2, dessous);
  toile.disque(x1, y1, r1 - 0.8, PIERRE.corps);
  toile.disque(x2, y2, r2 - 0.8, PIERRE.corps);
  toile.disque(x1 - r1 * 0.35, y1 - r1 * 0.4, r1 * 0.35, PIERRE.clair);
  toile.disque(x2 - r2 * 0.3, y2 - r2 * 0.45, r2 * 0.3, PIERRE.clair);
  // Une fissure.
  toile.segment(x2 - 1, y2 - 2, x2 + 1, y2 + 2, 1, dessous);
  // Rien ne depasse sous le sol : un rocher est pose, pas enfonce.
  toile.gommer(0, sol + 1, largeur, hauteur - sol - 1);
  toile.ombreAuSol(largeur / 2, sol + 1, largeur / 2 - 2, 1.5);
}

function peindreSouche(toile: Toile): void {
  const { largeur, pied: sol } = SOUCHE;
  toile.ombreAuSol(largeur / 2, sol + 1, 5, 1.6);
  toile.rect(4, sol - 6, 6, 6, ECORCE.corps);
  toile.rect(4, sol - 6, 1, 6, ECORCE.clair);
  toile.rect(9, sol - 6, 1, 6, ECORCE.sombre);
  // Le dessus, coupe : les cernes.
  toile.segment(3, sol - 6, 10, sol - 6, 2, ECORCE.clair);
  toile.point(7, sol - 6, ECORCE.corps);
  toile.rect(2, sol - 1, 3, 1, ECORCE.corps);
}

// --------------------------------------------------------------- la cuisson

function decor(cle: string, forme: { largeur: number; hauteur: number; pied: number }): Decor {
  // Le pied visible est un pixel sous le point d'ancrage : c'est la ou le
  // contour s'arrete.
  return { cle, largeur: forme.largeur, hauteur: forme.hauteur, origineY: (forme.pied + 2) / forme.hauteur };
}

/** Les decors, dans leur ordre de cuisson, avec leur taille. */
export const DECORS: readonly Decor[] = [
  ...ARBRES_MORTS.map((cle) => decor(cle, ARBRE)),
  ...ARBRES_VIVANTS.map((cle) => decor(cle, ARBRE)),
  ...CONIFERES.map((cle) => decor(cle, ARBRE)),
  ...ROCHERS.map((cle) => decor(cle, ROCHER)),
  decor(CLE_SOUCHE, SOUCHE),
  decor(CLE_PUITS, PUITS),
  decor(CLE_TONNEAU, TONNEAU),
  decor(CLE_TAS_DE_BOIS, TAS_DE_BOIS),
  decor(CLE_CHARRETTE, CHARRETTE),
  decor(CLE_CORDE_A_LINGE, CORDE_A_LINGE),
  decor(CLE_FILETS, FILETS),
];

export function decorParCle(cle: string): Decor {
  return DECORS.find((d) => d.cle === cle) ?? DECORS[0]!;
}

/** Peint un decor dans une toile neuve. Exporte pour la planche et les tests. */
export function peindreDecor(cle: string): Toile {
  const forme = decorParCle(cle);
  const toile = new Toile(forme.largeur, forme.hauteur);
  const index = Number(cle.slice(cle.lastIndexOf("-") + 1)) || 0;
  if (cle.startsWith("decor-arbre-mort")) peindreArbreMort(toile, index);
  else if (cle.startsWith("decor-arbre")) peindreArbreVivant(toile, index);
  else if (cle.startsWith("decor-conifere")) peindreConifere(toile, index);
  else if (cle.startsWith("decor-rocher")) peindreRocher(toile, index);
  else if (cle === CLE_PUITS) peindrePuits(toile);
  else if (cle === CLE_TONNEAU) peindreTonneau(toile);
  else if (cle === CLE_TAS_DE_BOIS) peindreTasDeBois(toile);
  else if (cle === CLE_CHARRETTE) peindreCharrette(toile);
  else if (cle === CLE_CORDE_A_LINGE) peindreCordeALinge(toile);
  else if (cle === CLE_FILETS) peindreFilets(toile);
  else peindreSouche(toile);
  toile.contour();
  return toile;
}

// ------------------------------------------------- les details de vie, en secours

/** Le secours du puits : le toit, deux poteaux, la margelle et l'eau. */
function peindrePuits(t: Toile): void {
  const { pied } = PUITS;
  t.rect(4, 3, 18, 3, ARDOISE.sombre);
  t.rect(6, 6, 2, pied - 12, BOIS.corps);
  t.rect(18, 6, 2, pied - 12, BOIS.corps);
  t.rect(5, pied - 8, 16, 7, PIERRE.corps);
  t.rect(8, pied - 7, 10, 3, EAU.corps);
}

/** Le secours du tonneau : une douve et deux cercles. */
function peindreTonneau(t: Toile): void {
  const { pied } = TONNEAU;
  t.rect(3, pied - 11, 8, 10, BOIS.corps);
  t.rect(3, pied - 9, 8, 1, FER.corps);
  t.rect(3, pied - 4, 8, 1, FER.corps);
}

/** Le secours du tas de bois : trois rangs de buches. */
function peindreTasDeBois(t: Toile): void {
  const { pied } = TAS_DE_BOIS;
  t.rect(3, pied - 4, 20, 3, ECORCE.corps);
  t.rect(3, pied - 8, 20, 3, ECORCE.sombre);
  t.rect(5, pied - 12, 16, 3, ECORCE.corps);
}

/** Le secours de la charrette : la caisse, deux roues, les brancards. */
function peindreCharrette(t: Toile): void {
  const { pied } = CHARRETTE;
  t.rect(12, pied - 10, 18, 7, BOIS.corps);
  t.disque(16, pied - 3, 3, ECORCE.sombre);
  t.disque(27, pied - 3, 3, ECORCE.sombre);
  t.rect(3, pied - 5, 9, 1, BOIS.sombre);
}

/** Le secours de la corde a linge : deux piquets, la corde, trois pieces en deux tons. */
function peindreCordeALinge(t: Toile): void {
  const { pied } = CORDE_A_LINGE;
  t.rect(5, pied - 13, 2, 13, BOIS.corps);
  t.rect(33, pied - 13, 2, 13, BOIS.corps);
  t.rect(7, pied - 12, 26, 1, ECORCE.sombre);
  t.rect(9, pied - 12, 5, 8, TOILE.corps);
  t.rect(17, pied - 12, 4, 7, TISSU.corps);
  t.rect(24, pied - 12, 6, 9, TOILE.corps);
}

/** Le secours des filets : deux perches, la traverse, une maille sombre et ses flotteurs. */
function peindreFilets(t: Toile): void {
  const { pied } = FILETS;
  t.rect(4, pied - 17, 2, 17, BOIS.corps);
  t.rect(30, pied - 17, 2, 17, BOIS.corps);
  t.rect(3, pied - 17, 30, 1, BOIS.sombre);
  for (let y = pied - 16; y < pied - 5; y += 1) {
    for (let x = 6; x < 30; x += 1) {
      if ((x + y) % 2 === 0) t.point(x, y, ECORCE.sombre);
    }
  }
  for (const x of [9, 15, 21, 27]) t.point(x, pied - 17, SABLE.clair);
}

/**
 * Cuit tout le decor, une fois au demarrage (§4.17 regle 3).
 *
 * @returns le nombre de textures produites.
 */
export function cuireLeDecor(scene: Phaser.Scene): number {
  let compte = 0;
  for (const forme of DECORS) {
    if (scene.textures.exists(forme.cle)) continue;
    const toile = peindreDecor(forme.cle);
    const texture = scene.textures.createCanvas(forme.cle, forme.largeur, forme.hauteur);
    if (!texture) continue;
    texture.getContext().putImageData(toile.versImageData(), 0, 0);
    texture.refresh();
    compte += 1;
  }
  return compte;
}
