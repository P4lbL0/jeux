import type Phaser from "phaser";
import { Toile } from "./pinceau";
import {
  ARDOISE,
  BOIS,
  FER,
  LAITON,
  PIERRE,
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

  // La nef : basse, large, elle ne bouge pas d'un niveau a l'autre.
  const hautNef = sol - 22;
  pan(toile, 3, hautNef, largeur - 16, sol - hautNef, PIERRE);
  toit(toile, 3, hautNef - 8, largeur - 16, 8, TOIT_EGLISE);

  // Le portail et les vitraux. **Des accents, pas des aplats** : le §4.30
  // demande moins de rouge que la planche d'origine.
  ouverture(toile, 9, sol - 11, 7, 11);
  toile.rect(11, sol - 9, 3, 3, melanger(TOIT_EGLISE.corps, PIERRE.sombre, 0.4));
  ouverture(toile, 22, sol - 17, 4, 5);
  toile.point(24, sol - 15, TOIT_EGLISE.corps);

  // Le clocher, sur le flanc droit. **Sa hauteur est le niveau.**
  const largeurClocher = 13;
  const xClocher = largeur - largeurClocher - 3;
  // ⚠️ **Le clocher tient dans le carre de 2 x 2.** La planche du 11 aout le dit
  // en toutes lettres : « dans un carre, un clocher decentre desequilibre
  // l'ensemble ». Il monte donc de six pixels par niveau et non de treize — la
  // hauteur totale doit rester sous les 64 px de l'emprise.
  const hautClocher = sol - (24 + palier * 6);
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

/**
 * ⚠️ **L'est-ouest et le nord-sud sont deux dessins differents**, jamais le meme
 * bloc tourne (§4.30). Un mur qui court vers l'horizon montre son **arete**, pas
 * sa face. C'est ce qui regle le « je ne peux pas mettre de mur en verticale ».
 *
 * ⚠️ **Et l'angle est le troisieme dessin**, que la planche du 11 aout demandait
 * en toutes lettres — « chaque proposition est dessinee en est-ouest, en nord-sud
 * et en angle ». Sans lui, une enceinte qui tourne montre deux bouts de mur
 * poses cote a cote : la face du premier reste visible au coin, et le rempart
 * s'ouvre exactement la ou il devrait etre le plus epais.
 */
export type SensMur = "est-ouest" | "nord-sud" | "angle";

/** La largeur d'un mur vu par la tranche. C'est aussi celle du pilier d'angle. */
const PILE = 18;

/**
 * Un carreau de long, un sous-carreau de large — la forme ne change pas.
 *
 * ⚠️ **L'angle emprunte sa largeur a l'est-ouest et sa hauteur au nord-sud**, et
 * ce n'est pas un compromis : c'est ce qui fait que les trois carreaux se
 * raccordent une fois **centres sur leur case**. Un angle a ses propres mesures
 * ferait un decrochement d'un ou deux pixels a chaque coin — visible, et
 * impossible a rattraper a la pose.
 */
export const MUR = {
  "est-ouest": { largeur: CASE, hauteur: 30 },
  "nord-sud": { largeur: PILE, hauteur: CASE + 8 },
  angle: { largeur: CASE, hauteur: CASE + 8 },
} as const;

const MATIERE_MUR: Record<MatiereMur, Matiere> = {
  bois: BOIS,
  fer: FER,
  pierre: PIERRE,
};

/** Les trois dessins d'un mur, et ses trois paliers de matiere. */
export const SENS_MUR: readonly SensMur[] = ["est-ouest", "nord-sud", "angle"];
export const MATIERES_MUR: readonly MatiereMur[] = ["bois", "fer", "pierre"];

/**
 * Le rempart, **entierement refait**.
 *
 * ⚠️ Les trois propositions du 11 aout ont ete refusees : *« trop plates, ca fait
 * une texture, pas un rempart »*. Le defaut etait exact — elles lisaient comme un
 * motif de briques pose a plat sur l'herbe. Ce que ca demande, et chaque point
 * compte :
 *
 * - une **crete claire** qui accroche la lumiere, nettement plus claire que le corps ;
 * - un **corps** qui occupe la hauteur ;
 * - un **pied sombre**, franc, et une **ombre portee** qui decolle le mur du terrain ;
 * - de la **hauteur** : un rempart qu'on longe doit paraitre infranchissable.
 */
export function peindreMur(toile: Toile, sens: SensMur, matiere: MatiereMur): void {
  const m = MATIERE_MUR[matiere];
  const { largeur, hauteur } = MUR[sens];
  const sol = hauteur - MARGE_BASSE;

  if (sens === "est-ouest") {
    poser(toile, 1, largeur - 2, sol);
    face(toile, 0, HAUT_FACE, largeur, sol, m);
    return;
  }

  if (sens === "nord-sud") {
    poser(toile, 2, largeur - 4, sol);
    pile(toile, 0, HAUT_PILE, sol, m);
    return;
  }

  // L'angle. **La face part vers l'est, le pilier monte au nord** ; l'autre
  // paire de coins s'obtient au miroir horizontal, qui ne coute rien et ne
  // deplace pas la lumiere.
  //
  // ⚠️ **La face se dessine en premier et le pilier par-dessus.** Dans l'autre
  // ordre, la face traverse le coin et on lit deux murs qui se croisent au lieu
  // d'un rempart qui tourne. C'est le pilier qui doit manger le bout de la face.
  const solFace = sol - DECALAGE_ANGLE;
  const gauchePile = (largeur - PILE) / 2;

  poser(toile, gauchePile + 1, PILE - 2, sol);
  face(toile, gauchePile + 5, HAUT_FACE + DECALAGE_ANGLE, largeur - gauchePile - 5, solFace, m);
  pile(toile, gauchePile, HAUT_PILE, sol, m);
}

/** Ou commence la crete d'une face, et ou commence celle d'une tranche. */
const HAUT_FACE = 5;
const HAUT_PILE = 3;

/**
 * De combien l'angle descend sa face pour retrouver celle du carreau voisin.
 *
 * C'est exactement la demi-difference de hauteur entre les deux carreaux : posés
 * tous les deux au centre de leur case, ils tombent alors sur la meme ligne.
 */
const DECALAGE_ANGLE = (MUR.angle.hauteur - MUR["est-ouest"].hauteur) / 2;

/** Un mur vu **de face** : crete claire, corps en degrade, pied sombre. */
function face(
  toile: Toile,
  x: number,
  haut: number,
  largeur: number,
  sol: number,
  m: Matiere,
): void {
  // Le corps, en degrade : c'est la hauteur.
  pan(toile, x + 1, haut + 3, largeur - 2, sol - haut - 3, m);
  // **La crete**, franchement plus claire, et debordante d'un pixel : c'est
  // elle qui accroche la lumiere et fait qu'on voit le dessus du mur.
  toile.rect(x, haut, largeur, 3, m.clair);
  toile.rect(x, haut + 3, largeur, 1, melanger(m.corps, m.clair, 0.4));
  // **Le pied sombre**, franc. Sans lui le mur flotte.
  toile.rect(x + 1, sol - 3, largeur - 2, 3, melanger(m.sombre, PIERRE.sombre, 0.35));

  // L'appareil : deux rangs decales, jamais un quadrillage regulier — c'est ce
  // qui faisait « texture » sur les propositions refusees.
  for (let rang = 0; rang < 2; rang += 1) {
    const y = haut + 7 + rang * 7;
    const decalage = rang % 2 === 0 ? 0 : 5;
    for (let i = decalage + 1; i < largeur - 2; i += 10) {
      toile.rect(x + i, y, 1, 5, m.sombre);
    }
    toile.rect(x + 1, y + 5, largeur - 2, 1, melanger(m.sombre, m.corps, 0.5));
  }
}

/**
 * Un mur vu **par la tranche** : etroit, et sa crete court sur toute la hauteur
 * au lieu de barrer la largeur.
 */
function pile(toile: Toile, x: number, haut: number, sol: number, m: Matiere): void {
  pan(toile, x + 3, haut, PILE - 6, sol - haut, m);
  // La crete vue de biais : une bande claire verticale, du cote de la lumiere.
  toile.rect(x + 2, haut, 3, sol - haut, m.clair);
  toile.rect(x + 5, haut, 1, sol - haut, melanger(m.corps, m.clair, 0.4));
  // Le cote a l'ombre, et le pied.
  toile.rect(x + PILE - 4, haut, 2, sol - haut, m.sombre);
  toile.rect(x + 2, sol - 2, PILE - 4, 2, melanger(m.sombre, PIERRE.sombre, 0.35));

  // Les assises, en travers : elles courent vers l'horizon.
  for (let y = haut + 5; y < sol - 4; y += 7) {
    toile.rect(x + 3, y, PILE - 6, 1, m.sombre);
  }
}

// ----------------------------------------------------------------- la cuisson

/** La cle de texture d'un batiment. */
export function cleMaison(variante: number): string {
  return `bati-maison-${variante}`;
}
export function cleEglise(niveau: number): string {
  return `bati-eglise-${niveau}`;
}
export function cleMur(sens: SensMur, matiere: MatiereMur): string {
  return `bati-mur-${sens}-${matiere}`;
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

  const graver = (cle: string, largeur: number, hauteur: number, tracer: (t: Toile) => void) => {
    if (scene.textures.exists(cle)) return;
    const toile = new Toile(largeur, hauteur);
    tracer(toile);
    toile.contour();
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
  for (const sens of SENS_MUR) {
    for (const matiere of MATIERES_MUR) {
      graver(cleMur(sens, matiere), MUR[sens].largeur, MUR[sens].hauteur, (t) =>
        peindreMur(t, sens, matiere),
      );
    }
  }
  return compte;
}
