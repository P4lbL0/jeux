import type Phaser from "phaser";
import { Toile } from "./pinceau";
import { C } from "../ui/couleurs";
import {
  ARDOISE,
  BOIS,
  ECORCE,
  FER,
  FEUILLE,
  LAITON,
  PIERRE,
  SOL_VERT,
  TOILE,
  TOIT_EGLISE,
  melanger,
  type Matiere,
} from "./palette";

/**
 * Les batiments, dessines par le code (DESIGN.md §4.30).
 *
 * ⚠️ **Tout est vu de face, et c'est geometrique, pas cosmetique.** Les anciennes
 * maisons etaient dessinees **en isometrie** alors que la grille est orthogonale :
 * un objet isometrique ne *peut pas* s'aligner sur une grille droite. C'est toute
 * l'explication du « tout est de biais » et du « rien ne tombe dans les
 * carreaux ».
 *
 * **Un batiment monte dans l'image sans occuper un pouce de sol de plus.** Sa
 * largeur est son emprise au sol — un multiple de la case de 32 — et sa hauteur
 * ne regarde personne : la grille n'inscrit que l'emprise (§4.24, bloc 7a).
 */

/** La case de la grille. Toute emprise en est un multiple. */
export const CASE = 32;

/** Ou le sol tombe dans une texture de batiment : deux pixels sous le pied. */
const MARGE_BASSE = 2;

// ------------------------------------------------------------------ le socle

/**
 * L'ombre portee et le pied sombre, communs a tout ce qui est bati.
 *
 * ⚠️ **C'est ce qui decolle un batiment du terrain.** Le defaut des trois murs
 * refuses — « trop plates, ca fait une texture, pas un rempart » — venait
 * exactement de la : sans ombre au sol ni pied sombre, une facade se lit comme un
 * motif peint sur l'herbe.
 */
function poser(toile: Toile, x: number, largeur: number, sol: number): void {
  toile.ombreAuSol(x + largeur / 2, sol + 1, largeur / 2 + 1, 2.5);
}

/** Le pied de tout ce qui est bati : franc, et plus sombre que la matiere. */
function pied(toile: Toile, x: number, largeur: number, sol: number, m: Matiere): void {
  toile.rect(x, sol - 3, largeur, 3, melanger(m.sombre, PIERRE.sombre, 0.35));
}

/**
 * Un pan de mur vu de face : clair en haut, sombre en bas.
 *
 * Le degrade n'est pas decoratif — c'est lui qui donne la hauteur. Une facade
 * d'une seule valeur est un rectangle.
 */
function pan(
  toile: Toile,
  x: number,
  y: number,
  largeur: number,
  hauteur: number,
  m: Matiere,
): void {
  for (let j = 0; j < hauteur; j += 1) {
    const part = j / Math.max(1, hauteur - 1);
    const couleur = part < 0.18 ? m.clair : part > 0.78 ? m.sombre : m.corps;
    toile.rect(x, y + j, largeur, 1, couleur);
  }
  // L'arete verticale du cote ombre : sans elle, deux pans accoles se fondent.
  toile.rect(x + largeur - 1, y, 1, hauteur, m.sombre);
}

/**
 * Un toit a deux pentes, vu de face : un triangle.
 *
 * Il **deborde** du mur d'un pixel de chaque cote — un toit a fleur de facade
 * n'est pas un toit, c'est un pignon.
 */
function toit(
  toile: Toile,
  x: number,
  y: number,
  largeur: number,
  hauteur: number,
  m: Matiere,
): void {
  for (let j = 0; j < hauteur; j += 1) {
    const part = j / Math.max(1, hauteur - 1);
    const demi = Math.round((largeur / 2 + 1) * part);
    const gauche = x + largeur / 2 - demi;
    toile.rect(gauche, y + j, demi * 2, 1, part < 0.35 ? m.clair : m.corps);
  }
  // Le bord bas du toit, franc : c'est lui qui separe le toit du mur.
  toile.rect(x - 1, y + hauteur - 1, largeur + 2, 1, m.sombre);
}

/** Une ouverture : creusee dans le fer, avec un rebord clair en haut. */
function ouverture(toile: Toile, x: number, y: number, largeur: number, hauteur: number): void {
  toile.rect(x, y, largeur, hauteur, melanger(PIERRE.sombre, FER.sombre, 0.6));
  toile.rect(x, y, largeur, 1, PIERRE.clair);
}

// ----------------------------------------------------------------- la maison

/**
 * **L'emprise d'une maison fait 2 x 2 carreaux**, et le bati n'en remplit qu'un
 * coin (planche du 11 aout, famille 3).
 *
 * ⚠️ **La maison se cale contre le coin haut-gauche de son emprise et laisse le
 * reste en jardin.** C'est une regle de **pose**, pas de dessin, et le §4.30 ne
 * l'avait pas enregistree : c'est elle qui fait que deux voisines ne se touchent
 * jamais et que **le village respire**. Une maison centree dans son emprise
 * donnerait une rangee reguliere, c'est-a-dire un lotissement.
 */
export const EMPRISE_MAISON = CASE * 2;

/** Le bati lui-meme : 42 x 40 dans les 64 x 64 de l'emprise. */
export const MAISON = { largeur: 42, hauteur: 40 };

/**
 * Proposition A : **colombages sombres sur torchis clair, toit gris.**
 *
 * « La plus pauvre des trois, et c'est un compliment : elle dit qu'on survit. Le
 * contraste bois/torchis porte la lecture sans une seule couleur vive. »
 *
 * ⚠️ **Son prix est ecrit, et il faut le surveiller a l'oeil** : le toit gris et
 * la pierre de l'eglise se ressemblent, donc de loin le village peut devenir
 * monochrome. Un test tient l'ardoise plus sombre que la pierre et a plus de 24
 * unites d'elle — c'est le garde-fou, il ne remplace pas le coup d'oeil.
 *
 * Trois variantes, pour qu'une rangee de maisons ne soit pas une rangee de
 * copies — c'est la meme regle que les carreaux de sol.
 */
export function peindreMaison(toile: Toile, variante: number): void {
  const { largeur, hauteur } = MAISON;
  const sol = hauteur - MARGE_BASSE;
  const hauteurToit = 15;
  const hautMur = sol - 21;

  poser(toile, 1, largeur - 2, sol);

  // Le torchis, puis les colombages par-dessus : l'ordre est du contenu, pas du
  // detail — l'inverse effacerait les poutres.
  pan(toile, 2, hautMur, largeur - 4, sol - hautMur, TOILE);

  const poutres = BOIS.sombre;
  toile.rect(2, hautMur, largeur - 4, 1, poutres);
  toile.rect(2, sol - 1, largeur - 4, 1, poutres);
  toile.rect(2, hautMur, 1, sol - hautMur, poutres);
  toile.rect(largeur - 3, hautMur, 1, sol - hautMur, poutres);
  // Une croix de Saint-Andre, decalee par la variante : c'est elle qui dit
  // « pans de bois » d'un coup d'oeil.
  // Un poteau median, plus la croix : a 42 px de large, une seule croix laisse un
  // grand vide de torchis qui fait mur nu.
  toile.rect(2 + Math.floor((largeur - 4) / 2), hautMur, 1, sol - hautMur, poutres);
  const biais = 4 + (variante % 3) * 5;
  toile.segment(biais, hautMur + 2, biais + 9, sol - 3, 1, poutres);
  toile.segment(biais + 9, hautMur + 2, biais, sol - 3, 1, poutres);

  // La porte, decalee elle aussi.
  const porteX = variante % 2 === 0 ? 6 : largeur - 13;
  ouverture(toile, porteX, sol - 11, 7, 11);
  toile.point(porteX + 6, sol - 6, LAITON.corps);
  // Deux fenetres, de l'autre cote.
  const fenetreX = variante % 2 === 0 ? largeur - 14 : 6;
  ouverture(toile, fenetreX, sol - 17, 5, 4);
  ouverture(toile, fenetreX + 7, sol - 17, 5, 4);

  toit(toile, 1, hautMur - hauteurToit + 1, largeur - 2, hauteurToit, ARDOISE);
}

// ------------------------------------------------------- la maison de fermier

/** Le logis plus sa remise : bati de 44 x 40, meme emprise de 2 x 2 (§4.30). */
export const FERME = { largeur: 44, hauteur: 40 };

/**
 * Proposition C, aux couleurs de la A : un logis et une **remise** accolee.
 *
 * ⚠️ **Celui qui y vit ou y travaille voit son stress baisser** (§4.23). C'est le
 * premier batiment du jeu qui agit sur le moral, et il ouvre la famille que les
 * fontaines et les paves rejoindront. Rien ne le branche encore : ce fichier ne
 * dessine que sa forme.
 */
export function peindreFerme(toile: Toile): void {
  const { largeur, hauteur } = FERME;
  const sol = hauteur - MARGE_BASSE;
  const logis = 28;

  poser(toile, 1, largeur - 2, sol);

  // La remise d'abord, plus basse et derriere : elle doit passer sous le toit du
  // logis, pas devant.
  const hautRemise = sol - 20;
  pan(toile, logis - 2, hautRemise, largeur - logis, sol - hautRemise, BOIS);
  // Un toit en appentis : une seule pente, c'est ce qui la distingue du logis.
  for (let j = 0; j < 7; j += 1) {
    toile.rect(logis - 3 + j, hautRemise - 7 + j, largeur - logis - j + 4, 1, ARDOISE.corps);
  }
  toile.rect(logis - 3, hautRemise - 1, largeur - logis + 4, 1, ARDOISE.sombre);
  // La grande ouverture de la remise : c'est elle qui dit « on stocke ici ».
  ouverture(toile, logis + 3, sol - 13, 12, 13);

  const hautMur = sol - 20;
  pan(toile, 2, hautMur, logis - 4, sol - hautMur, TOILE);

  const poutres = BOIS.sombre;
  toile.rect(2, hautMur, logis - 4, 1, poutres);
  toile.rect(2, sol - 1, logis - 4, 1, poutres);
  toile.rect(2, hautMur, 1, sol - hautMur, poutres);
  toile.segment(9, hautMur + 2, 16, sol - 3, 1, poutres);
  toile.segment(16, hautMur + 2, 9, sol - 3, 1, poutres);

  ouverture(toile, 5, sol - 10, 6, 10);
  toile.point(10, sol - 6, LAITON.corps);
  ouverture(toile, 20, sol - 15, 5, 4);

  toit(toile, 1, hautMur - 14, logis - 2, 14, ARDOISE);
}

// ----------------------------------------------------------------- l'eglise

/** **Deux cases au sol**, tranche le 12 aout 2026 (§4.30, §4.22). */
export const EGLISE = { largeur: CASE * 2, hauteur: CASE * 2 };

/**
 * Proposition A, **moins coloree** : une nef basse, un **clocher sur le flanc
 * droit**, une croix de laiton.
 *
 * Les quatre niveaux du §4.22 se lisent en **faisant monter le clocher** — c'est
 * la silhouette qui porte le niveau, pas un ornement qu'il faudrait chercher.
 *
 * ⚠️ **Elle tient entierement dans 64 x 64**, fleche comprise. La planche du
 * 11 aout tranchait deja ce point, et le §4.30 ne l'avait pas enregistre : le
 * clocher doit rester **dans** le carre de son emprise, sinon deux eglises cote a
 * cote ne s'alignent pas et le clocher decentre desequilibre l'ensemble.
 *
 * ⚠️ **Le toit est en sang seche desature, et c'est le seul du village.** Les
 * maisons sont en ardoise (§4.30) : ca donne a l'eglise une couleur qui
 * n'appartient qu'a elle, donc elle domine par la teinte autant que par la
 * hauteur — et ca se lit de bien plus loin qu'une silhouette.
 *
 * @param niveau de 1 a 4.
 */
export function peindreEglise(toile: Toile, niveau: number): void {
  const { largeur, hauteur } = EGLISE;
  const sol = hauteur - MARGE_BASSE;
  const palier = Math.max(1, Math.min(4, niveau));

  poser(toile, 2, largeur - 4, sol);

  // La nef : large, et **plus haute qu'une maison des le niveau 1**. Vu en
  // jeu le 13 aout : « au niveau 1, l'eglise ne domine pas » — son toit montait
  // moins haut que celui d'une maison. Le §4.22 lui demande l'inverse.
  const hautNef = sol - 25;
  pan(toile, 3, hautNef, largeur - 16, sol - hautNef, PIERRE);
  toit(toile, 3, hautNef - 11, largeur - 16, 11, TOIT_EGLISE);

  // Le portail et les vitraux. **Des accents, pas des aplats** : le §4.30
  // demande moins de rouge que la planche d'origine.
  ouverture(toile, 9, sol - 11, 7, 11);
  toile.rect(11, sol - 9, 3, 3, melanger(TOIT_EGLISE.corps, PIERRE.sombre, 0.4));
  // Un vitrail en ogive au-dessus du portail : la seule fenetre pointue du
  // village, et c'est elle qui dit « eglise » de pres.
  ouverture(toile, 22, sol - 19, 4, 7);
  toile.point(23, sol - 20, PIERRE.clair);
  toile.point(24, sol - 20, PIERRE.clair);
  toile.point(23, sol - 16, TOIT_EGLISE.corps);
  toile.point(24, sol - 15, TOIT_EGLISE.corps);

  // Le clocher, sur le flanc droit. **Sa hauteur est le niveau.**
  const largeurClocher = 13;
  const xClocher = largeur - largeurClocher - 3;
  // ⚠️ **Le clocher tient dans le carre de 2 x 2.** La planche du 11 aout le dit
  // en toutes lettres : « dans un carre, un clocher decentre desequilibre
  // l'ensemble ». Il monte donc de six pixels par niveau et non de treize — la
  // hauteur totale doit rester sous les 64 px de l'emprise.
  const hautClocher = sol - (28 + palier * 6);
  pan(toile, xClocher, hautClocher, largeurClocher, sol - hautClocher, PIERRE);

  // Les abat-sons : un rang par niveau, ils montent avec lui.
  for (let i = 0; i < palier; i += 1) {
    ouverture(toile, xClocher + 4, hautClocher + 5 + i * 6, 5, 4);
  }

  // La fleche et la croix de laiton — ce qui vaut quelque chose (§4.30).
  const hautFleche = hautClocher - 7;
  toit(toile, xClocher, hautFleche, largeurClocher, 8, TOIT_EGLISE);
  const croix = xClocher + largeurClocher / 2;
  toile.rect(croix, hautFleche - 4, 1, 4, LAITON.corps);
  toile.rect(croix - 1, hautFleche - 3, 3, 1, LAITON.clair);
}

// -------------------------------------------------------------------- le mur

/** Les trois matieres d'un rempart, dans l'ordre ou on l'ameliore (§4.20). */
export type MatiereMur = "bois" | "fer" | "pierre";

/** Les trois paliers de matiere. */
export const MATIERES_MUR: readonly MatiereMur[] = ["bois", "fer", "pierre"];

/**
 * Un mur est un **bloc plein** : sa case vue de dessus, soulevee de sa hauteur
 * (tranche le 10 septembre 2026, apres les captures).
 *
 * ⚠️ **Ca annule les trois dessins du §4.30** — est-ouest, nord-sud, angle. Ils
 * etaient justes en geometrie et faux a l'oeil : vus en jeu, les carreaux se
 * lisaient comme des planches plantees et des clotures de jardin, pas comme un
 * rempart. « Je n'aime pas du tout comment ils rendent. »
 *
 * Le bloc, lui, marche comme les murs de Clash of Clans, et pour la meme
 * raison : **c'est la profondeur qui fait le raccord**, pas le dessin.
 *
 * - Deux blocs cote a cote joignent leurs dessus, pleine largeur, sans couture.
 * - Deux blocs l'un au-dessus de l'autre : le dessus de celui du bas — qui est
 *   dessine apres, puisqu'il est plus bas — **recouvre la face** de celui du
 *   haut. Un mur nord-sud est donc une colonne de dessus continue, exactement
 *   ce qu'on voit d'en haut. C'est pour ca que le dessus fait **toute la case**
 *   (32 px) et pas une bande : plus court, une fente de sol reapparaitrait
 *   entre deux blocs.
 * - Un bloc seul est un cube : une borne, pas un bout de cloture.
 *
 * Il n'y a donc **plus qu'un dessin par matiere**, et aucun miroir.
 */
export const MUR = { largeur: CASE, hauteur: CASE + 20 } as const;

/** La hauteur de la face de chaque matiere : un rempart de pierre est plus haut. */
export const HAUTEUR_MUR: Record<MatiereMur, number> = { bois: 13, fer: 15, pierre: 17 };

/** Ou tombe le sol dans la texture : deux pixels de marge, comme partout. */
const SOL_MUR = MUR.hauteur - MARGE_BASSE;

/**
 * L'origine verticale a donner au sprite d'un mur pour que **le centre de sa
 * case** tombe au milieu de son emprise au sol — le pied du bloc etant le bord
 * avant de la case.
 */
export const ORIGINE_MUR_Y = (SOL_MUR - CASE / 2) / MUR.hauteur;

const MATIERE_MUR: Record<MatiereMur, Matiere> = {
  bois: BOIS,
  fer: FER,
  pierre: PIERRE,
};

/**
 * Le dessus d'un bloc : sa matiere, a peine eclaircie.
 *
 * ⚠️ Vu en jeu : a 0,55 de clair, le dessus d'une palissade etait la chose la
 * plus claire de l'ecran — plus que les visages — et un bloc seul se lisait
 * comme une **caisse**. Le dessus prend la lumiere, il ne la vole pas.
 */
function dessusDe(m: Matiere): Matiere {
  return {
    sombre: m.sombre,
    corps: melanger(m.corps, m.clair, 0.22),
    clair: m.clair,
  };
}

/** La ruine d'un mur : ce qu'il en reste quand la palissade est tombee. */
export const CLE_MUR_RUINE = "bati-mur-ruine";

/**
 * Une palissade effondree : des moignons de pieux de hauteurs inegales, deux
 * pieux couches en travers. Pas de dessus — c'est le sol qu'on voit.
 *
 * C'est ce qui remplit les breches de l'enceinte de depart : le village est en
 * ruine (§4.6), et une breche faite d'un bloc entier sur trois se lisait comme
 * des caisses posees en ligne, pas comme un rempart tombe.
 */
export function peindreMurRuine(toile: Toile, variante: number): void {
  const m = BOIS;
  const sol = SOL_MUR;
  const largeur = MUR.largeur;
  const pas = 4;

  poser(toile, 2, largeur - 4, sol);
  for (let i = 0; i * pas < largeur; i += 1) {
    // Un moignon sur trois manque, et aucun n'a la meme hauteur.
    const g = (i * 7 + variante * 5) % 9;
    if (g < 3) continue;
    const x = i * pas;
    const haut = sol - 3 - (g % 5) - 2;
    toile.rect(x, haut, pas, sol - 2 - haut, m.corps);
    toile.rect(x, haut, 1, sol - 2 - haut, m.clair);
    toile.rect(x + pas - 1, haut, 1, sol - 2 - haut, m.sombre);
    // Le haut est casse : un pixel d'ecorce claire sur l'echarde.
    toile.point(x + 1 + (g % 2), haut - 1, ECORCE.clair);
  }
  // Deux pieux couches sur le sol, derriere.
  const y = sol - CASE + 8 + (variante % 3) * 4;
  toile.segment(3, y, 20, y + 4, 2, ECORCE.corps);
  toile.segment(14, y + 9, 30, y + 6, 2, ECORCE.sombre);
  toile.rect(0, sol - 2, largeur, 2, melanger(m.sombre, PIERRE.sombre, 0.35));
}

export function peindreMur(toile: Toile, matiere: MatiereMur): void {
  const m = MATIERE_MUR[matiere];
  const h = HAUTEUR_MUR[matiere];
  const largeur = MUR.largeur;
  const sol = SOL_MUR;
  const hautFace = sol - h;
  const hautDessus = hautFace - CASE;

  // Le dessus, puis la face, puis ce qui depasse du dessus (pointes, creneaux).
  const dessus = dessusDe(m);
  toile.rect(0, hautDessus, largeur, CASE, dessus.corps);
  if (matiere === "bois") dessusDePieux(toile, hautDessus, largeur, dessus);
  else if (matiere === "fer") dessusDePlaques(toile, hautDessus, largeur, dessus);
  else dessusDeDalles(toile, hautDessus, largeur, dessus);

  // L'arete avant du dessus : la crete, franchement claire.
  toile.rect(0, hautFace - 1, largeur, 1, m.clair);

  if (matiere === "bois") faceDePieux(toile, hautFace, largeur, sol, m);
  else if (matiere === "fer") faceDeFer(toile, hautFace, largeur, sol, m);
  else faceDePierre(toile, hautFace, largeur, sol, m);

  // Le pied sombre, franc. Sans lui le mur flotte.
  toile.rect(0, sol - 2, largeur, 2, melanger(m.sombre, PIERRE.sombre, 0.35));
}

// ---- le bois : les bouts des pieux sur le dessus, des pieux en facade

function dessusDePieux(toile: Toile, haut: number, largeur: number, d: Matiere): void {
  // Vue d'en haut, une palissade est un champ de bouts de troncs : un point de
  // lumiere et son ombre, tous les quatre pixels, en quinconce. C'est ce qui
  // dit « des pieux » et non « une caisse ».
  for (let y = haut + 2; y < haut + CASE - 1; y += 4) {
    const decalage = ((y - haut) / 4) % 2 === 0 ? 0 : 2;
    for (let x = decalage + 1; x < largeur - 1; x += 4) {
      toile.point(x, y, d.clair);
      toile.point(x + 1, y + 1, d.sombre);
    }
  }
  toile.rect(0, haut, 1, CASE, d.clair);
  toile.rect(largeur - 1, haut, 1, CASE, d.sombre);
}

function faceDePieux(toile: Toile, haut: number, largeur: number, sol: number, m: Matiere): void {
  const pas = 4;
  for (let i = 0; i * pas < largeur; i += 1) {
    const x = i * pas;
    toile.rect(x, haut, pas, sol - haut - 2, m.corps);
    toile.rect(x, haut, 1, sol - haut - 2, m.clair);
    toile.rect(x + pas - 1, haut, 1, sol - haut - 2, m.sombre);
    // La pointe du pieu depasse du dessus, a des hauteurs inegales : des
    // troncs plantes, pas des barreaux usines.
    const pointe = haut - 2 - ((i * 7) % 3);
    toile.rect(x + 1, pointe + 1, pas - 2, haut - pointe - 1, m.corps);
    toile.rect(x + 1, pointe, 2, 1, m.clair);
  }
  // La corde qui les tient, a mi-hauteur.
  const y = haut + Math.floor((sol - haut) / 2);
  toile.rect(0, y, largeur, 2, m.sombre);
  for (let x = 1; x < largeur; x += 8) toile.point(x, y, m.clair);
}

// ---- le fer : des plaques rivetees, herissees de pointes

function dessusDePlaques(toile: Toile, haut: number, largeur: number, d: Matiere): void {
  // Quatre plaques, un joint en croix, un rivet dans chaque coin.
  toile.rect(0, haut + CASE / 2, largeur, 1, d.sombre);
  toile.rect(largeur / 2, haut, 1, CASE, d.sombre);
  toile.rect(0, haut, largeur, 1, d.clair);
  toile.rect(0, haut, 1, CASE, d.clair);
  for (const [x, y] of [
    [3, 3],
    [largeur - 4, 3],
    [3, CASE - 4],
    [largeur - 4, CASE - 4],
    [largeur / 2 - 4, CASE / 2 - 4],
    [largeur / 2 + 3, CASE / 2 + 3],
  ] as const) {
    toile.point(x, haut + y, d.clair);
    toile.point(x + 1, haut + y + 1, d.sombre);
  }
}

function faceDeFer(toile: Toile, haut: number, largeur: number, sol: number, m: Matiere): void {
  pan(toile, 0, haut, largeur, sol - haut - 2, m);
  // Les joints verticaux entre les plaques, et deux rangs de rivets.
  for (let x = 8; x < largeur; x += 8) toile.rect(x, haut, 1, sol - haut - 2, m.sombre);
  for (const y of [haut + 4, sol - 6]) {
    toile.rect(0, y, largeur, 1, m.sombre);
    for (let x = 3; x < largeur; x += 8) toile.point(x, y, m.clair);
  }
  // Les pointes, plantees dans l'arete avant : elles montent sur le dessus.
  for (let x = 3; x < largeur; x += 8) {
    toile.rect(x, haut - 4, 1, 3, m.clair);
    toile.rect(x - 1, haut - 1, 3, 1, m.corps);
  }
}

// ---- la pierre : un chemin de ronde crenele

function dessusDeDalles(toile: Toile, haut: number, largeur: number, d: Matiere): void {
  // Les dalles du chemin de ronde : des rangs decales.
  for (let rang = 0; rang < 4; rang += 1) {
    const y = haut + 7 + rang * 7;
    if (y < haut + CASE) toile.rect(0, y, largeur, 1, d.sombre);
    const decalage = rang % 2 === 0 ? 0 : 6;
    for (let x = decalage + 5; x < largeur; x += 12) {
      toile.rect(x, y - 6, 1, 6, d.sombre);
    }
  }
  toile.rect(0, haut, 1, CASE, d.clair);
  // Les merlons du fond : la silhouette est dentelee des deux cotes.
  for (const x of [1, 12, 23]) {
    toile.rect(x, haut - 3, 8, 4, d.corps);
    toile.rect(x, haut - 3, 8, 1, d.clair);
    toile.rect(x + 7, haut - 3, 1, 4, d.sombre);
  }
}

function faceDePierre(toile: Toile, haut: number, largeur: number, sol: number, m: Matiere): void {
  pan(toile, 0, haut, largeur, sol - haut - 2, m);
  // L'appareil : des rangs de blocs decales, jamais un quadrillage.
  for (let rang = 0; rang * 6 + haut + 5 < sol - 2; rang += 1) {
    const y = haut + 5 + rang * 6;
    toile.rect(0, y, largeur, 1, melanger(m.sombre, m.corps, 0.5));
    const decalage = rang % 2 === 0 ? 0 : 5;
    for (let x = decalage + 4; x < largeur; x += 10) toile.rect(x, y - 5, 1, 5, m.sombre);
  }
  // Les merlons de l'avant, poses sur l'arete : trois pleins, deux creneaux.
  for (const x of [1, 12, 23]) {
    toile.rect(x, haut - 4, 8, 4, m.corps);
    toile.rect(x, haut - 4, 8, 1, m.clair);
    toile.rect(x, haut - 4, 1, 4, m.clair);
    toile.rect(x + 7, haut - 4, 1, 4, m.sombre);
  }
}

// ------------------------------------------------------------- le chantier

/** Les chantiers qu'on cuit : un par emprise a couvrir. */
export const CHANTIERS = {
  case: { cle: "bati-chantier-case", largeur: CASE, hauteur: CASE + 8 },
  eglise: { cle: "bati-chantier-eglise", largeur: EGLISE.largeur, hauteur: EGLISE.hauteur },
  port: { cle: "bati-chantier-port", largeur: 56, hauteur: 40 },
} as const;

/**
 * L'echafaudage : ce qu'on voit tant qu'un chantier n'est pas fini.
 *
 * Tranche le 10 septembre 2026, dans l'esprit des chantiers de Clash of Clans :
 * **on voit qu'on batit.** Des perches, des planches, un tas de bois ou de
 * pierres au pied. Il se pose **par-dessus** ce qui se construit — un mur qu'on
 * pose, l'eglise qu'on releve, le port qu'on rebatit — et disparait quand c'est
 * fini.
 */
export function peindreChantier(toile: Toile, largeur: number, hauteur: number): void {
  const sol = hauteur - MARGE_BASSE;
  const haut = 4;
  const perches = Math.max(2, Math.round(largeur / 24));
  const etages = Math.max(2, Math.round((sol - haut) / 12));

  poser(toile, 2, largeur - 4, sol);

  // Les perches, puis les planches, puis la croix qui les tient.
  for (let i = 0; i < perches; i += 1) {
    const x = 2 + Math.round((i * (largeur - 6)) / (perches - 1));
    toile.rect(x, haut, 2, sol - haut, ECORCE.corps);
    toile.rect(x, haut, 1, sol - haut, ECORCE.clair);
  }
  for (let e = 0; e < etages; e += 1) {
    const y = haut + 4 + Math.round((e * (sol - haut - 10)) / Math.max(1, etages - 1));
    toile.rect(1, y, largeur - 2, 2, BOIS.corps);
    toile.rect(1, y, largeur - 2, 1, BOIS.clair);
  }
  toile.segment(3, sol - 6, largeur - 4, haut + 6, 1, ECORCE.corps);

  // Le tas de bois a gauche, les pierres a droite.
  for (let i = 0; i < 3; i += 1) {
    const x = 5 + i * 4;
    const y = sol - 3 - (i === 1 ? 3 : 0);
    toile.disque(x, y, 2, ECORCE.corps);
    toile.point(x - 1, y - 1, ECORCE.clair);
    toile.point(x, y, ECORCE.sombre);
  }
  toile.rect(largeur - 12, sol - 4, 6, 4, PIERRE.corps);
  toile.rect(largeur - 10, sol - 7, 5, 3, PIERRE.corps);
  toile.rect(largeur - 12, sol - 4, 6, 1, PIERRE.clair);
  toile.rect(largeur - 10, sol - 7, 5, 1, PIERRE.clair);
}

// ----------------------------------------------------------------- la tour

/** La tour de guet : une case au sol, et elle monte (§4.20). */
export const TOUR = { largeur: CASE, hauteur: 52 };
export const CLE_TOUR = "bati-tour";

/**
 * Plus haute que large, et plus haute que tout le reste du village : une
 * position ne se lit qu'a sa hauteur. Un socle de pierre, une plateforme de
 * bois, quatre poteaux et un petit toit d'ardoise — **et rien dedans** : la
 * place vide est celle de l'occupant, et c'est lui qui la rend utile.
 */
export function peindreTour(toile: Toile): void {
  const { largeur, hauteur } = TOUR;
  const sol = hauteur - MARGE_BASSE;

  poser(toile, 4, largeur - 8, sol);

  // Le socle de pierre, avec son appareil et une porte.
  const hautSocle = sol - 24;
  pan(toile, 6, hautSocle, 20, sol - hautSocle, PIERRE);
  for (let rang = 0; rang < 3; rang += 1) {
    const y = hautSocle + 4 + rang * 6;
    toile.rect(7, y + 5, 18, 1, melanger(PIERRE.sombre, PIERRE.corps, 0.5));
    const decalage = rang % 2 === 0 ? 0 : 4;
    for (let i = decalage + 1; i < 18; i += 8) toile.rect(7 + i, y, 1, 5, PIERRE.sombre);
  }
  ouverture(toile, 13, sol - 9, 6, 9);
  pied(toile, 7, 18, sol, PIERRE);

  // La plateforme de bois, qui deborde du socle.
  const hautPlateforme = hautSocle - 5;
  toile.rect(2, hautPlateforme, 28, 5, BOIS.corps);
  toile.rect(2, hautPlateforme, 28, 1, BOIS.clair);
  toile.rect(2, hautPlateforme + 4, 28, 1, BOIS.sombre);
  for (let x = 6; x < 30; x += 6) toile.rect(x, hautPlateforme + 1, 1, 3, BOIS.sombre);

  // Les quatre poteaux et la rambarde : on voit a travers, c'est un poste.
  const hautToit = 9;
  for (const x of [3, 28]) {
    toile.rect(x, hautToit, 2, hautPlateforme - hautToit, ECORCE.corps);
    toile.rect(x, hautToit, 1, hautPlateforme - hautToit, ECORCE.clair);
  }
  toile.rect(3, hautPlateforme - 7, 27, 1, ECORCE.corps);
  toile.rect(3, hautPlateforme - 7, 27, 1, ECORCE.clair);

  // Le toit d'ardoise, pointu : la silhouette qu'on reconnait de loin.
  toit(toile, 2, 2, 28, hautToit - 1, ARDOISE);
}

// ---------------------------------------------------------------- le champ

export const CLES_CHAMP = { jeune: "bati-champ-jeune", mur: "bati-champ-mur" } as const;

/**
 * Le champ de ble (DESIGN.md §4.18) : le seul decor qui change en jouant.
 *
 * Le jeune est une terre retournee ou pointent des pousses ; le mur est une
 * paille claire, la seule chose blonde du monde. La difference doit se voir de
 * loin — c'est elle qui dit quand on va manger.
 *
 * ⚠️ **Pas de contour** : un champ est du sol, pas un objet pose dessus.
 */
export function peindreChamp(toile: Toile, etat: "jeune" | "mur"): void {
  const terre = melanger(BOIS.corps, SOL_VERT.sombre, 0.45);
  const sillon = melanger(terre, C.fer, 0.35);
  toile.rect(0, 0, CASE, CASE, terre);
  for (let y = 3; y < CASE; y += 6) toile.rect(0, y, CASE, 1, sillon);

  if (etat === "jeune") {
    // Des pousses, une rangee sur deux, decalees : ca leve.
    for (let y = 6; y < CASE; y += 6) {
      for (let x = (y / 6) % 2 === 0 ? 2 : 5; x < CASE; x += 6) {
        toile.point(x, y, FEUILLE.corps);
        toile.point(x, y - 1, FEUILLE.clair);
        toile.point(x + 1, y, FEUILLE.sombre);
      }
    }
    return;
  }

  // Le ble : des tiges de paille, et un epi plus clair en haut de chacune.
  const paille = melanger(C.os, C.laiton, 0.42);
  const epi = melanger(paille, C.os, 0.35);
  const ombre = melanger(paille, C.fer, 0.35);
  for (let y = 5; y < CASE; y += 6) {
    for (let x = (y / 6) % 2 === 0 ? 1 : 3; x < CASE - 1; x += 3) {
      toile.rect(x, y - 4, 1, 5, paille);
      toile.point(x + 1, y, ombre);
      toile.point(x, y - 5, epi);
      toile.point(x + 1, y - 4, epi);
    }
  }
}

// ----------------------------------------------------------------- le port

export const PORT_DESSIN = { largeur: 56, hauteur: 40 };
export const NAVIRE = { largeur: 48, hauteur: 40 };
export const CLES_PORT = { ruine: "bati-port-ruine", debout: "bati-port", navire: "bati-navire" } as const;

/**
 * Le port, et le navire qui y accoste (DESIGN.md §4.18).
 *
 * Le port est **en bois** quand tout le reste du village est en pierre : c'est
 * ce qui le fait lire comme un appontement, et ca dit du premier coup d'oeil
 * que ce n'est pas une chose qu'on defend (§4.6). Le ponton part vers la
 * **gauche**, donc vers la mer ; un port symetrique ne dirait pas de quel cote
 * arrive la mer.
 */
export function peindrePort(toile: Toile, etat: "ruine" | "debout"): void {
  const { largeur, hauteur } = PORT_DESSIN;
  const sol = hauteur - MARGE_BASSE;

  poser(toile, 4, largeur - 8, sol);

  if (etat === "ruine") {
    // Des pieux casses de hauteurs inegales, qui penchent : une ruine ne
    // s'aligne pas.
    const pieux: [number, number, number][] = [
      [8, 12, 0.2],
      [16, 9, -0.15],
      [26, 14, 0.1],
      [35, 8, -0.3],
      [44, 11, 0.15],
    ];
    for (const [x, h, penche] of pieux) {
      toile.membre(x, sol, h, Math.PI + penche, 3, ECORCE.corps);
      toile.point(x - 1, sol - 2, ECORCE.clair);
    }
    // Une planche tombee en travers, la seule chose horizontale qui reste.
    toile.segment(12, sol - 4, 34, sol - 7, 2, BOIS.corps);
    return;
  }

  // Les pilotis d'abord : ils passent **sous** le ponton.
  for (const x of [5, 13, 21, 29]) {
    toile.rect(x, sol - 12, 2, 12, ECORCE.corps);
    toile.rect(x, sol - 12, 1, 12, ECORCE.clair);
  }
  // Le ponton, vers la mer, planche par planche.
  toile.rect(2, sol - 16, 36, 6, BOIS.corps);
  toile.rect(2, sol - 16, 36, 1, BOIS.clair);
  toile.rect(2, sol - 11, 36, 1, BOIS.sombre);
  for (let x = 6; x < 38; x += 6) toile.rect(x, sol - 15, 1, 5, BOIS.sombre);

  // Le hangar, cote terre : un mur de planches, un toit en appentis, une
  // grande ouverture noire — c'est elle qui dit qu'on y depose quelque chose.
  const hautHangar = sol - 20;
  pan(toile, 34, hautHangar, 20, sol - hautHangar, BOIS);
  for (let y = hautHangar + 4; y < sol - 2; y += 4) toile.rect(35, y, 18, 1, BOIS.sombre);
  ouverture(toile, 40, sol - 12, 8, 12);
  for (let j = 0; j < 7; j += 1) {
    toile.rect(33 + j, hautHangar - 7 + j, 22 - j, 1, ARDOISE.corps);
  }
  toile.rect(33, hautHangar - 1, 22, 1, ARDOISE.sombre);
  toile.rect(33, hautHangar - 7, 15, 1, ARDOISE.clair);
  pied(toile, 35, 18, sol, BOIS);
}

/** Le navire : une coque, un mat, deux voiles. On ne le voit que de loin. */
export function peindreNavire(toile: Toile): void {
  const { largeur, hauteur } = NAVIRE;
  const sol = hauteur - MARGE_BASSE;

  // La coque : un trapeze, plus sombre dessous, une lisse claire dessus.
  for (let j = 0; j < 8; j += 1) {
    const retrait = Math.round(j * 0.9);
    toile.rect(3 + retrait, sol - 8 + j, largeur - 6 - retrait * 2 + 2, 1, j < 2 ? BOIS.clair : j < 6 ? BOIS.corps : BOIS.sombre);
  }
  toile.rect(3, sol - 8, largeur - 6, 1, BOIS.clair);

  // Le mat, et la vergue.
  toile.rect(22, 3, 2, sol - 10, ECORCE.corps);
  toile.rect(22, 3, 1, sol - 10, ECORCE.clair);

  // La grand-voile et le foc : deux formes valent mieux qu'une, la silhouette
  // se lit meme a zoom faible (§4.11).
  for (let y = 5; y < sol - 12; y += 1) {
    const part = (y - 5) / (sol - 17);
    const l = Math.round(2 + part * 16);
    toile.rect(24, y, l, 1, part < 0.5 ? TOILE.clair : TOILE.corps);
    const f = Math.round(1 + part * 11);
    toile.rect(21 - f, y + 2, f, 1, TOILE.corps);
  }
  toile.rect(24, sol - 12, 18, 1, TOILE.sombre);
}

// ----------------------------------------------------------------- la cuisson

/** La cle de texture d'un batiment. */
export function cleMaison(variante: number): string {
  return `bati-maison-${variante}`;
}
export function cleEglise(niveau: number): string {
  return `bati-eglise-${niveau}`;
}
export function cleMur(matiere: MatiereMur): string {
  return `bati-mur-${matiere}`;
}
export const CLE_FERME = "bati-ferme";

/** Combien de maisons differentes. Trois suffisent a casser la rangee de copies. */
export const VARIANTES_MAISON = 3;

/**
 * Cuit tous les batiments, une fois au demarrage (§4.17 regle 3).
 *
 * @returns le nombre de textures produites.
 */
export function cuireLesBatiments(scene: Phaser.Scene): number {
  let compte = 0;

  const graver = (
    cle: string,
    largeur: number,
    hauteur: number,
    tracer: (t: Toile) => void,
    cerner = true,
  ) => {
    if (scene.textures.exists(cle)) return;
    const toile = new Toile(largeur, hauteur);
    tracer(toile);
    if (cerner) toile.contour();
    const texture = scene.textures.createCanvas(cle, largeur, hauteur);
    if (!texture) return;
    texture.getContext().putImageData(toile.versImageData(), 0, 0);
    texture.refresh();
    compte += 1;
  };

  for (let v = 0; v < VARIANTES_MAISON; v += 1) {
    graver(cleMaison(v), MAISON.largeur, MAISON.hauteur, (t) => peindreMaison(t, v));
  }
  graver(CLE_FERME, FERME.largeur, FERME.hauteur, peindreFerme);
  for (let n = 1; n <= 4; n += 1) {
    graver(cleEglise(n), EGLISE.largeur, EGLISE.hauteur, (t) => peindreEglise(t, n));
  }
  for (const matiere of MATIERES_MUR) {
    graver(cleMur(matiere), MUR.largeur, MUR.hauteur, (t) => peindreMur(t, matiere));
  }
  graver(CLE_MUR_RUINE, MUR.largeur, MUR.hauteur, (t) => peindreMurRuine(t, 0));
  for (const chantier of Object.values(CHANTIERS)) {
    graver(chantier.cle, chantier.largeur, chantier.hauteur, (t) =>
      peindreChantier(t, chantier.largeur, chantier.hauteur),
    );
  }
  graver(CLE_TOUR, TOUR.largeur, TOUR.hauteur, peindreTour);
  graver(CLES_CHAMP.jeune, CASE, CASE, (t) => peindreChamp(t, "jeune"), false);
  graver(CLES_CHAMP.mur, CASE, CASE, (t) => peindreChamp(t, "mur"), false);
  graver(CLES_PORT.ruine, PORT_DESSIN.largeur, PORT_DESSIN.hauteur, (t) => peindrePort(t, "ruine"));
  graver(CLES_PORT.debout, PORT_DESSIN.largeur, PORT_DESSIN.hauteur, (t) => peindrePort(t, "debout"));
  graver(CLES_PORT.navire, NAVIRE.largeur, NAVIRE.hauteur, peindreNavire);
  return compte;
}
