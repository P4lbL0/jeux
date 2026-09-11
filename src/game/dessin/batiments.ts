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
  for (const chantier of Object.values(CHANTIERS)) {
    graver(chantier.cle, chantier.largeur, chantier.hauteur, (t) =>
      peindreChantier(t, chantier.largeur, chantier.hauteur),
    );
  }
  graver(CLES_CHAMP.jeune, CASE, CASE, (t) => peindreChamp(t, "jeune"), false);
  graver(CLES_CHAMP.mur, CASE, CASE, (t) => peindreChamp(t, "mur"), false);
  graver(CLES_PORT.ruine, PORT_DESSIN.largeur, PORT_DESSIN.hauteur, (t) => peindrePort(t, "ruine"));
  graver(CLES_PORT.debout, PORT_DESSIN.largeur, PORT_DESSIN.hauteur, (t) => peindrePort(t, "debout"));
  graver(CLES_PORT.navire, NAVIRE.largeur, NAVIRE.hauteur, peindreNavire);
  return compte;
}
