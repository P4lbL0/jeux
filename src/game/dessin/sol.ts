import type Phaser from "phaser";
import { Toile } from "./pinceau";
import { BOIS, FEUILLE, PIERRE, SOL_VERT, melanger, type Matiere } from "./palette";
import { C } from "../ui/couleurs";

/**
 * Le sol, dessine par le code (DESIGN.md §4.30, §4.21).
 *
 * ⚠️ **Un seul carreau de 32 px repete fait un damier.** C'est le defaut trouve
 * sur la premiere planche du socle — *« ca se repete de fou furieux »* — et il
 * n'etait pas dans la couleur. Deux reponses, et la seconde compte plus que la
 * premiere :
 *
 * 1. **Plusieurs variantes par etat**, choisies par la **position de la case** et
 *    non au hasard. Le meme endroit doit donner le meme carreau a chaque
 *    lancement, sinon la carte scintille au rechargement et deux captures ne se
 *    comparent plus.
 * 2. **Des touffes rares.** Un bruit uniforme reparti partout se voit encore
 *    comme un bruit uniforme : c'est l'irregularite qui casse l'oeil, pas la
 *    quantite. Une case sur sept porte un detail, les autres non.
 *
 * ⚠️ **Et tout doit pouvoir etre detruit.** Le §4.21 promet des crateres de
 * meteore et des terres brulees, le §4.24 des chemins qui s'usent. Un etat de sol
 * est donc une **valeur de case**, au meme titre qu'un mur ou qu'un champ — pas
 * un decalque pose par-dessus. Un decalque ne survivrait ni a la sauvegarde, ni
 * au mode d'amenagement, ni au recalcul de la carte.
 *
 * **Rien n'est encore branche sur un systeme** : aucun meteore ne tombe au
 * jalon 5. Ce qui est livre, c'est le dessin de ces etats et le chemin qui les
 * ecrit. Cout aujourd'hui : quelques carreaux de plus dans la meme cuisson.
 */

/** Les etats qu'une case de sol peut prendre. */
export type EtatDuSol = "herbe" | "terre" | "brule" | "cratere";

/**
 * Combien de variantes par etat.
 *
 * Quatre suffisent : au-dela, l'oeil ne distingue plus, et chaque variante est
 * une texture de plus a cuire. En deca, le damier revient — mesure a deux, ou il
 * se voyait encore.
 */
export const VARIANTES = 4;

/** Cote d'un carreau, en pixels. C'est la case de la grille (§4.21). */
export const CARREAU = 32;

/** La cle de texture d'un carreau. */
export function cleDuSol(etat: EtatDuSol, variante: number): string {
  return `sol-${etat}-${variante}`;
}

/**
 * Quelle variante une case porte.
 *
 * ⚠️ **Determine, jamais aleatoire.** Deux lancements doivent peindre la meme
 * carte : sinon le terrain change a chaque rechargement de sauvegarde, et deux
 * captures d'ecran ne se comparent plus. C'est le meme principe que le grain de
 * `carte.ts`, et la meme raison.
 */
export function varianteDe(colonne: number, ligne: number): number {
  // ⚠️ **`Math.imul` et non `*`** : une multiplication ordinaire de deux grands
  // entiers passe par un flottant, perd ses bits de poids faible, et le melangeur
  // se met a privilegier une variante sur quatre — le damier revient par la
  // porte de derriere. Mesure : 433 cases sur 900 attendues pour une variante.
  let h = Math.imul(colonne, 0x27d4eb2d) ^ Math.imul(ligne, 0x165667b1);
  h = Math.imul(h ^ (h >>> 15), 0x2545f491);
  // ⚠️ Et le `>>> 0` **avant le modulo**, pas apres : en JavaScript `^` rend un
  // entier **signe**, donc `h % 4` peut valoir -2. C'est exactement le bug qui a
  // fait planter la fiche de personnage au bloc 5, et je l'ai refait en ecrivant
  // le commentaire qui en met en garde.
  return ((h ^ (h >>> 13)) >>> 0) % VARIANTES;
}

/**
 * Cuit tous les carreaux de sol, une fois au demarrage (§4.17 regle 3).
 *
 * @returns le nombre de textures produites.
 */
export function cuireLesSols(scene: Phaser.Scene): number {
  let compte = 0;
  for (const etat of ["herbe", "terre", "brule", "cratere"] as const) {
    for (let v = 0; v < VARIANTES; v += 1) {
      const cle = cleDuSol(etat, v);
      if (scene.textures.exists(cle)) continue;

      const toile = new Toile(CARREAU, CARREAU);
      peindreCarreau(toile, etat, v);

      const texture = scene.textures.createCanvas(cle, CARREAU, CARREAU);
      if (!texture) continue;
      texture.getContext().putImageData(toile.versImageData(), 0, 0);
      texture.refresh();
      compte += 1;
    }
  }
  return compte;
}

export function peindreCarreau(toile: Toile, etat: EtatDuSol, variante: number): void {
  const sol = matiereDe(etat);
  toile.rect(0, 0, CARREAU, CARREAU, sol.corps);

  switch (etat) {
    case "herbe":
      semer(toile, sol, variante, 9);
      // Les touffes : une case sur deux en porte, les autres non.
      if (variante % 2 === 0) peindreTouffes(toile, variante);
      break;
    case "terre":
      semer(toile, sol, variante, 9);
      peindreOrnieres(toile, variante);
      break;
    case "brule":
      // ⚠️ Une terre brulee est une **matiere**, pas un assemblage d'objets. Deux
      // essais l'ont ratee en dessinant des taches de suie rondes : ca donnait
      // des pois. Ce qu'il faut est un marbrage — des zones sombres irregulieres
      // qui se fondent — et un ecart clair **rare**, sinon la cendre fait de la
      // neige.
      marbrer(toile, sol, variante, 0.42, 0.88);
      if (variante % 3 === 0) peindreSouche(toile, variante);
      break;
    case "cratere":
      marbrer(toile, sol, variante + 11, 0.44, 0.86);
      peindreGravats(toile, sol, variante);
      break;
  }
}

function matiereDe(etat: EtatDuSol): Matiere {
  switch (etat) {
    case "herbe":
      return SOL_VERT;
    case "terre":
      return terreBattue();
    case "brule":
      return terreBrulee();
    case "cratere":
      return terreRetournee();
  }
}

/** L'herbe qui a perdu sa vie : la meme, tiree vers le bois et desaturee. */
function terreBattue(): Matiere {
  const corps = melanger(SOL_VERT.corps, BOIS.corps, 0.62);
  return {
    sombre: melanger(corps, SOL_VERT.sombre, 0.5),
    corps,
    clair: melanger(corps, BOIS.clair, 0.3),
  };
}

/**
 * La terre brulee.
 *
 * ⚠️ **Elle descend de la terre, pas de l'ardoise.** Le premier jet la peignait
 * en ardoise — un gris **bleu**, la matiere d'un toit — et le resultat ne
 * ressemblait a rien : du metal froid pose au milieu d'un pre. Ce qui brule
 * noircit **en restant chaud**, et surtout ca reste du **sol** : ca doit pouvoir
 * toucher de l'herbe sans qu'on voie une decoupe.
 */
function terreBrulee(): Matiere {
  const base = terreBattue();
  const corps = melanger(base.corps, C.fer, 0.62);
  return {
    sombre: melanger(corps, C.fer, 0.55),
    corps,
    // La cendre est le seul eclat, et elle est grise : c'est ce qui separe une
    // terre brulee d'une terre simplement sombre.
    clair: melanger(corps, PIERRE.clair, 0.42),
  };
}

/** La terre retournee d'un cratere : plus sombre et plus froide que la battue. */
function terreRetournee(): Matiere {
  const base = terreBattue();
  const corps = melanger(base.corps, C.fer, 0.42);
  return {
    sombre: melanger(corps, C.fer, 0.6),
    corps,
    clair: melanger(corps, PIERRE.clair, 0.28),
  };
}

function semer(toile: Toile, sol: Matiere, variante: number, rarete: number): void {
  // Le decalage par variante est ce qui fait que quatre carreaux voisins ne
  // montrent pas le meme grain : sans lui, quatre textures identiques.
  const sel = variante * 37;
  for (let y = 0; y < CARREAU; y += 1) {
    for (let x = 0; x < CARREAU; x += 1) {
      const g = (x * 7 + y * 13 + ((x * y) % 11) + sel) % rarete;
      if (g === 0) toile.point(x, y, sol.sombre);
      else if (g === 4) toile.point(x, y, sol.clair);
    }
  }
}

function peindreTouffes(toile: Toile, variante: number): void {
  // Trois brins par touffe, deux touffes par carreau, places par la variante.
  const places = [
    [7, 20],
    [22, 11],
    [13, 26],
    [26, 24],
  ] as const;
  for (let i = 0; i < 2; i += 1) {
    const place = places[(variante + i * 2) % places.length]!;
    const [x, y] = place;
    toile.segment(x, y, x - 1, y - 3, 1, FEUILLE.corps);
    toile.segment(x + 1, y, x + 2, y - 4, 1, FEUILLE.clair);
    toile.segment(x + 2, y, x + 3, y - 2, 1, FEUILLE.sombre);
  }
}

function peindreOrnieres(toile: Toile, variante: number): void {
  // Deux sillons dans le sens du passage : c'est ce qui fait lire « on marche
  // ici » plutot que « la terre est nue ».
  const y = 10 + (variante % 3) * 4;
  toile.rect(0, y, CARREAU, 1, melanger(BOIS.sombre, SOL_VERT.sombre, 0.4));
  toile.rect(0, y + 9, CARREAU, 1, melanger(BOIS.sombre, SOL_VERT.sombre, 0.5));
}

/**
 * Un bruit fixe, de 0 a 1. Il ne depend que de ses entrees.
 *
 * `Math.imul` et le `>>> 0` **avant** la division : la meme discipline que
 * `varianteDe`, et pour la meme raison.
 */
function bruit(x: number, y: number, sel: number): number {
  let h = Math.imul(x + sel * 131, 0x27d4eb2d) ^ Math.imul(y + sel * 57, 0x165667b1);
  h = Math.imul(h ^ (h >>> 15), 0x2545f491);
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
}

/**
 * Le marbrage : deux echelles de bruit, et **aucun objet**.
 *
 * ⚠️ **C'est la lecon de deux essais rates.** La terre brulee a d'abord ete
 * peinte en disques de suie — elle a donne des pois — puis le cratere en
 * entailles droites — il a donne des brindilles. Une surface de terre n'est pas
 * faite d'objets poses dessus : c'est une **matiere**, et une matiere se fabrique
 * avec du bruit a plusieurs echelles. Le gros dessine les zones, le fin casse
 * leurs bords pour qu'aucune ne paraisse decoupee.
 *
 * @param plancher en dessous, le pixel passe en sombre.
 * @param plafond au-dessus, il passe en clair. **Le tenir haut** : sur du sombre,
 *        l'oeil compte chaque pixel clair, et a 20 % ca fait de la neige.
 */
function marbrer(
  toile: Toile,
  sol: Matiere,
  variante: number,
  plancher: number,
  plafond: number,
): void {
  for (let y = 0; y < CARREAU; y += 1) {
    for (let x = 0; x < CARREAU; x += 1) {
      const gros = bruitLisse(x, y, 7, variante * 3 + 1);
      const moyen = bruitLisse(x, y, 3, variante * 5 + 2);
      const fin = bruit(x, y, variante * 7 + 3);
      const v = gros * 0.58 + moyen * 0.3 + fin * 0.12;
      if (v < plancher) toile.point(x, y, sol.sombre);
      else if (v > plafond) toile.point(x, y, sol.clair);
    }
  }
}

/**
 * Le meme bruit, **interpole** entre ses points de grille.
 *
 * ⚠️ **C'est le troisieme essai de la terre brulee, et le defaut etait la.**
 * Prendre le bruit par blocs (`bruit(floor(x/6), ...)`) donne des **carres a
 * bords francs** : le resultat ne ressemblait plus a de la terre mais a du
 * **camouflage numerique**. Une matiere n'a pas d'aretes droites. On interpole
 * donc entre les quatre coins, avec un adoucissement aux extremites — sans lui,
 * les diagonales de la grille restent visibles.
 */
function bruitLisse(x: number, y: number, echelle: number, sel: number): number {
  const fx = x / echelle;
  const fy = y / echelle;
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const tx = adoucir(fx - x0);
  const ty = adoucir(fy - y0);

  const haut = melangeLineaire(bruit(x0, y0, sel), bruit(x0 + 1, y0, sel), tx);
  const bas = melangeLineaire(bruit(x0, y0 + 1, sel), bruit(x0 + 1, y0 + 1, sel), tx);
  return melangeLineaire(haut, bas, ty);
}

/** La courbe en S qui efface les aretes de la grille du bruit. */
function adoucir(t: number): number {
  return t * t * (3 - 2 * t);
}

function melangeLineaire(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Ce qui est reste debout apres le feu.
 *
 * **Une case sur trois seulement**, et c'est le point : un moignon sur chaque
 * carreau redonne un motif, donc un damier. C'est ce detail rare, et non la
 * couleur, qui fait lire « ca a brule » plutot que « c'est sombre ».
 */
function peindreSouche(toile: Toile, variante: number): void {
  const sol = terreBrulee();
  const x = 8 + bruit(7, 3, variante) * (CARREAU - 16);
  const y = 14 + bruit(3, 7, variante) * (CARREAU - 20);
  const haut = 4 + bruit(1, 1, variante) * 3;

  toile.segment(x, y, x + 1, y - haut, 1.6, C.fer);
  // Une branche, pour que ce ne soit pas un piquet.
  toile.segment(x + 1, y - haut, x + 3, y - haut - 1.5, 1, C.fer);
  // Le cote eclaire du tronc : sans lui, c'est une rayure.
  toile.point(x - 1, y - haut + 1, sol.clair);
}

/**
 * Les gravats d'un cratere : de la terre retournee, et rien de plus.
 *
 * ⚠️ **Une case ne montre pas un cratere entier.** Le premier jet dessinait un
 * disque complet et centre dans les 32 px : quatre cases cote a cote donnaient
 * quatre rondelles alignees, et c'est exactement ce que ca avait l'air d'etre. Un
 * impact de meteore est **plus grand qu'un carreau**.
 *
 * ⚠️ **Et le rebord ne peut pas se dessiner ici.** Ce qui fait lire un trou,
 * c'est la crete claire **au bord de la zone** — donc un carreau qui sait qu'il
 * est en bordure. Ca demande de connaitre les cases voisines, c'est-a-dire que le
 * sol soit ecrit dans la grille : **c'est l'etage 4**. Ce carreau-ci n'est que le
 * remplissage, et il est fait pour ne pas jurer une fois le rebord ajoute.
 */
function peindreGravats(toile: Toile, sol: Matiere, variante: number): void {
  // Des mottes, pas des entailles : elles accrochent la lumiere en haut a gauche
  // et portent leur ombre en bas a droite, comme tout le reste du jeu.
  for (let i = 0; i < 5; i += 1) {
    const x = 3 + bruit(i + 20, 1, variante) * (CARREAU - 6);
    const y = 3 + bruit(1, i + 20, variante) * (CARREAU - 6);
    const rayon = 1 + bruit(i, 13, variante) * 1.2;
    toile.disque(x, y, rayon, sol.corps);
    toile.point(x - rayon * 0.8, y - rayon * 0.8, sol.clair);
    toile.point(x + rayon * 0.8, y + rayon * 0.8, sol.sombre);
  }
}
