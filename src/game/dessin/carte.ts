import type Phaser from "phaser";
import { MONDE, mondeCourant, terrainEn as terrainDuMonde, type Terrain, EGLISE } from "../../core/carte";
import { C } from "../ui/couleurs";
import { bruit, bruitLisse, ligneDeBruit } from "./bruit";
import { releverLeRelief } from "./relief";
import { BRULE, CRATERE, TERRE } from "./sol";
import { cleCase, type PlanVillage, type Segment } from "../../core/village";
import {
  EAU,
  EBOULIS,
  ECORCE,
  FEUILLE,
  PIERRE,
  ROCHE,
  SABLE,
  SOL_VERT,
  SOUS_BOIS,
  matiere,
  melanger,
  type Matiere,
} from "./palette";

/**
 * La carte entiere, peinte par le code en une seule passe (DESIGN.md §4.30).
 *
 * **Une matiere, pas des carreaux.** La premiere carte etait un pavage de
 * carreaux de 8 px pioches dans une planche : elle se lisait comme un damier de
 * bruit, et c'etait le defaut numero un des captures. Ici il n'y a plus de
 * carreau du tout : chaque pixel du monde demande sa nature de sol aux formules
 * de `core/carte.ts`, et sa valeur a un bruit **continu sur toute la carte**.
 * Rien ne peut se repeter, puisque rien n'est repete.
 *
 * Trois couches, de la plus grande a la plus petite :
 *
 * 1. **Le sol** : la matiere, dans le ton de sa **facette de relief**
 *    (`relief.ts`, depuis le 18 septembre 2026) — des collines et une montagne
 *    eclairees par le soleil des sprites Blender. Les larges taches d'avant ne
 *    restent que sur l'eau, qui est plate.
 * 2. **Les lisieres** : le rivage tremble d'un pixel ou deux au lieu de suivre
 *    un escalier de tuiles ; l'ecume se pose ou le haut-fond touche le sable ;
 *    une crete claire souligne le haut de la roche.
 * 3. **Les details, rares** : une touffe, un caillou, un os, une fissure — une
 *    case sur six, jamais toutes. C'est l'irregularite qui casse l'oeil, pas
 *    la quantite (§4.30).
 *
 * ⚠️ **Deux millions de pixels, cuits une fois, jamais retouches par image**
 * (§4.17 regle 3). Un etat de case (cratere, chemin) s'ecrira plus tard **dans
 * cette texture**, case par case, exactement comme un mur s'ecrit dans la
 * grille. Ce fichier ne connait Phaser que pour deposer l'image.
 */

export const CLE_CARTE = "carte";

/** La case de la grille, en pixels : c'est le pas des details rares. */
const CASE = 32;

/** De combien un rivage peut trembler autour de sa formule, en pixels. */
const TREMBLEMENT = 6;

// ------------------------------------------------------------- les matieres

/**
 * Les trois eaux : l'abysse, la mer, le haut-fond.
 *
 * Toutes descendent de l'eau du socle — l'acier assombri, tire vers le ciel
 * sale. Elles ne sont pas dans la table des matieres : ce sont trois valeurs
 * d'une seule etendue, pas trois matieres.
 */
const ABYSSE = matiere(melanger(EAU.corps, C.fer, 0.42));
const MER = EAU;
const HAUT_FOND = matiere(melanger(EAU.corps, C.cielSale, 0.26));

const MATIERES: Record<Terrain, Matiere> = {
  abysse: ABYSSE,
  mer: MER,
  "haut-fond": HAUT_FOND,
  sable: SABLE,
  herbe: SOL_VERT,
  "sous-bois": SOUS_BOIS,
  eboulis: EBOULIS,
  roche: ROCHE,
};

/** L'ordre des terrains, pour les stocker en un octet par pixel. */
const TERRAINS: readonly Terrain[] = [
  "abysse",
  "mer",
  "haut-fond",
  "sable",
  "herbe",
  "sous-bois",
  "eboulis",
  "roche",
];
const INDEX: Record<Terrain, number> = Object.fromEntries(
  TERRAINS.map((t, i) => [t, i]),
) as Record<Terrain, number>;

/**
 * Les cinq tons d'une matiere, du plus sombre au plus clair : c'est ce que le
 * relief choisit pour chaque facette. Les memes marches que `reduire.py` pour
 * les sprites Blender, pour que le sol et ce qui est pose dessus s'eclairent
 * pareil.
 */
function cinqTons(m: Matiere): readonly number[] {
  return [m.sombre, melanger(m.sombre, m.corps, 0.5), m.corps, melanger(m.corps, m.clair, 0.5), m.clair];
}
const TONS: readonly (readonly number[])[] = TERRAINS.map((t) => cinqTons(MATIERES[t]));

/** L'ecume du rivage : de l'eau claire poussee vers l'os. */
const ECUME = melanger(HAUT_FOND.clair, C.os, 0.55);
/** Un os par terre : de l'os, sali a peine. */
const OS = melanger(C.os, C.fer, 0.12);

// ------------------------------------------------------------ les formules

/**
 * Le terrain du monde, echantillonne d'avance sur un treillis de deux pixels.
 *
 * ⚠️ **C'est la formule du core, pas une copie.** Depuis que le monde se tire
 * (§4.29 — une mer sur n'importe quel bord, des lacs, un massif), il n'y a
 * plus quatre lignes a echantillonner mais une fonction du point ; l'appeler
 * pour chacun des trois millions de pixels coutait une demi-seconde. Un point
 * sur deux dans chaque sens en coute un quart, et le tremblement des lisieres
 * (six pixels) cache le pas du treillis. Un test verifie que la
 * classification d'ici rend `terrainEn` sur les points du treillis.
 */
export const PAS_DU_CHAMP = 2;

export interface Champ {
  pas: number;
  colonnes: number;
  lignes: number;
  /** L'index dans `TERRAINS` de chaque point du treillis */
  terrains: Uint8Array;
  /** La marge, en points, autour du monde : le tremblement peut sortir */
  marge: number;
}

function echantillonner(largeur: number, hauteur: number): Champ {
  const pas = PAS_DU_CHAMP;
  const marge = Math.ceil((TREMBLEMENT + 1) / pas);
  const colonnes = Math.ceil(largeur / pas) + marge * 2;
  const lignes = Math.ceil(hauteur / pas) + marge * 2;
  const terrains = new Uint8Array(colonnes * lignes);
  for (let j = 0; j < lignes; j += 1) {
    const y = (j - marge) * pas;
    for (let i = 0; i < colonnes; i += 1) {
      terrains[j * colonnes + i] = INDEX[terrainDuMonde((i - marge) * pas, y)];
    }
  }
  return { pas, colonnes, lignes, terrains, marge };
}

/**
 * La nature du sol en un point, lue dans le treillis : le point le plus
 * proche. Hors du treillis, le bord le plus proche.
 */
export function classer(champ: Champ, x: number, y: number): Terrain {
  let i = Math.round(x / champ.pas) + champ.marge;
  let j = Math.round(y / champ.pas) + champ.marge;
  if (i < 0) i = 0;
  else if (i >= champ.colonnes) i = champ.colonnes - 1;
  if (j < 0) j = 0;
  else if (j >= champ.lignes) j = champ.lignes - 1;
  return TERRAINS[champ.terrains[j * champ.colonnes + i]!]!;
}

/** Le champ du monde courant, pour les tests. */
export function champDuMonde(): Champ {
  return echantillonner(MONDE.largeur, MONDE.hauteur);
}

// ------------------------------------------------------------- la peinture

/** Une carte peinte : ses pixels, et la nature de sol de chacun. */
export interface CartePeinte {
  largeur: number;
  hauteur: number;
  pixels: Uint8ClampedArray<ArrayBuffer>;
  /** L'index dans `TERRAINS` de chaque pixel — pour les tests et les details. */
  terrains: Uint8Array;
}

/**
 * Peint la carte. **Pure** : ni Phaser, ni hasard.
 */
export function peindreLaCarte(largeur = MONDE.largeur, hauteur = MONDE.hauteur): CartePeinte {
  const champ = echantillonner(largeur, hauteur);
  const pixels = new Uint8ClampedArray(new ArrayBuffer(largeur * hauteur * 4));
  const terrains = new Uint8Array(largeur * hauteur);

  const carte: CartePeinte = { largeur, hauteur, pixels, terrains };
  const relief = releverLeRelief(largeur, hauteur);

  // Les tampons d'une rangee : le tremblement des lisieres, les deux echelles
  // de taches. Alloues une fois, remplis a chaque rangee.
  const tremblementX = new Float32Array(largeur);
  const tremblementY = new Float32Array(largeur);
  const regions = new Float32Array(largeur);
  const taches = new Float32Array(largeur);
  const tachesFines = new Float32Array(largeur);
  const rangee = new Uint8Array(largeur);
  const rangeeDuDessus = new Uint8Array(largeur);

  for (let y = 0; y < hauteur; y += 1) {
    ligneDeBruit(y, 11, 1, largeur, tremblementX);
    ligneDeBruit(y, 11, 2, largeur, tremblementY);
    ligneDeBruit(y, 52, 5, largeur, regions);
    ligneDeBruit(y, 22, 3, largeur, taches);
    ligneDeBruit(y, 8, 4, largeur, tachesFines);

    // 1. La nature du sol, avec la lisiere qui tremble.
    for (let x = 0; x < largeur; x += 1) {
      const jx = x + Math.round((tremblementX[x]! - 0.5) * 2 * TREMBLEMENT);
      const jy = y + Math.round((tremblementY[x]! - 0.5) * 2 * TREMBLEMENT);
      rangee[x] = INDEX[classer(champ, jx, jy)];
    }

    // 2. Le sol, puis les lisieres qui ont besoin de leurs voisins.
    for (let x = 0; x < largeur; x += 1) {
      const terrain = TERRAINS[rangee[x]!]!;
      const m = MATIERES[terrain];
      // Trois echelles : les regions, les taches, le grain. Les grandes
      // dessinent des zones, les petites cassent leurs bords.
      const v = regions[x]! * 0.45 + taches[x]! * 0.35 + tachesFines[x]! * 0.2;

      // Les taches : douces, rares, et plus timides sur l'eau, ou la houle fait
      // deja le travail. ⚠️ Mesure sur planche : a 0,5 de sombre et un seuil a
      // 0,36, la prairie tournait au camouflage.
      const eau = rangee[x]! <= 2;
      let couleur = m.corps;
      if (eau) {
        // L'eau garde ses taches : elle est plate, et elle bouge par-dessus
        // (`mer.ts`).
        if (v < 0.3) couleur = melanger(m.corps, m.sombre, 0.35);
        else if (v > 0.74) couleur = melanger(m.corps, m.clair, 0.22);
      } else {
        // La terre prend le ton de sa facette : c'est le relief (`relief.ts`).
        couleur = TONS[rangee[x]!]![relief.marche(x, y) + 2]!;
      }

      // La crete de la montagne : la roche accroche la lumiere la ou elle
      // sort de l'eboulis. C'est ce qui fait lire une falaise et non une bande.
      if (y > 0 && terrain === "roche" && rangeeDuDessus[x] === INDEX.eboulis) {
        couleur = ROCHE.clair;
      } else if (y > 0 && terrain === "eboulis" && rangeeDuDessus[x]! >= INDEX.sable && rangeeDuDessus[x]! <= INDEX["sous-bois"]) {
        // L'ombre de l'herbe sur l'eboulis : un pied de pente.
        couleur = EBOULIS.sombre;
      }

      // L'ecume : le haut-fond qui touche le sable, trouee, jamais un trait.
      if (terrain === "haut-fond") {
        const sable = rangee[x + 1] === INDEX.sable || rangee[x + 2] === INDEX.sable;
        if (sable && bruit(x, y, 31) > 0.3) couleur = ECUME;
        else if (rangee[x + 3] === INDEX.sable && bruit(x, y, 32) > 0.65) couleur = HAUT_FOND.clair;
      }

      const i = (y * largeur + x) * 4;
      pixels[i] = (couleur >> 16) & 0xff;
      pixels[i + 1] = (couleur >> 8) & 0xff;
      pixels[i + 2] = couleur & 0xff;
      pixels[i + 3] = 255;
      terrains[y * largeur + x] = rangee[x]!;
    }

    rangeeDuDessus.set(rangee);
  }

  // 3. Les details rares, case par case.
  for (let cy = 0; cy * CASE < hauteur; cy += 1) {
    for (let cx = 0; cx * CASE < largeur; cx += 1) semerLesDetails(carte, cx, cy);
  }

  return carte;
}

/** Le terrain d'un pixel, ou `null` hors de la carte. */
function terrainEn(carte: CartePeinte, x: number, y: number): Terrain | null {
  if (x < 0 || y < 0 || x >= carte.largeur || y >= carte.hauteur) return null;
  return TERRAINS[carte.terrains[y * carte.largeur + x]!]!;
}

/**
 * Pose un pixel de detail — **seulement sur son propre terrain**.
 *
 * Une touffe d'herbe a cheval sur le rivage aurait trois pixels dans l'eau. Le
 * detail s'arrete donc la ou le sol change, sans qu'on ait a le savoir.
 */
function point(carte: CartePeinte, x: number, y: number, couleur: number, terrain: Terrain): void {
  if (terrainEn(carte, x, y) !== terrain) return;
  const i = (y * carte.largeur + x) * 4;
  carte.pixels[i] = (couleur >> 16) & 0xff;
  carte.pixels[i + 1] = (couleur >> 8) & 0xff;
  carte.pixels[i + 2] = couleur & 0xff;
}

/** Un trait de detail, par pas entiers. */
function trait(
  carte: CartePeinte,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  couleur: number,
  terrain: Terrain,
): void {
  const pas = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (let i = 0; i <= pas; i += 1) {
    point(
      carte,
      Math.round(x0 + ((x1 - x0) * i) / pas),
      Math.round(y0 + ((y1 - y0) * i) / pas),
      couleur,
      terrain,
    );
  }
}

/**
 * Les details d'une case, tires par sa position.
 *
 * **Une case sur six environ en porte un, les autres rien.** Un detail par case
 * redonnerait un motif, donc un damier — c'est la lecon du sol du 13 aout.
 */
function semerLesDetails(carte: CartePeinte, cx: number, cy: number): void {
  const de = bruit(cx, cy, 41);
  const x = cx * CASE + 4 + Math.floor(bruit(cx, cy, 42) * (CASE - 8));
  const y = cy * CASE + 4 + Math.floor(bruit(cx, cy, 43) * (CASE - 8));
  const terrain = terrainEn(carte, x, y);
  if (!terrain) return;

  switch (terrain) {
    case "herbe": {
      if (de < 0.16) touffe(carte, x, y, terrain, FEUILLE);
      else if (de < 0.24) caillou(carte, x, y, terrain);
      else if (de < 0.33) herbeSeche(carte, x, y, terrain);
      else if (de < 0.355) ossement(carte, x, y, terrain);
      break;
    }
    case "sous-bois": {
      if (de < 0.22) feuillesMortes(carte, x, y, terrain);
      else if (de < 0.34) racine(carte, x, y, terrain);
      else if (de < 0.4) touffe(carte, x, y, terrain, FEUILLE);
      break;
    }
    case "sable": {
      if (de < 0.26) ride(carte, x, y, terrain);
      else if (de < 0.3) coquille(carte, x, y, terrain);
      else if (de < 0.33) ossement(carte, x, y, terrain);
      break;
    }
    case "eboulis": {
      if (de < 0.36) caillou(carte, x, y, terrain);
      else if (de < 0.44) caillou(carte, x + 6, y + 3, terrain);
      break;
    }
    case "roche": {
      // ⚠️ Rares : une fissure par case faisait un semis de glyphes, c'est-a-dire
      // des objets poses sur la roche et non une roche fissuree.
      if (de < 0.12) fissure(carte, x, y, terrain);
      else if (de < 0.24) arete(carte, x, y, terrain);
      break;
    }
    default:
      break;
  }
}

function touffe(carte: CartePeinte, x: number, y: number, t: Terrain, m: Matiere): void {
  trait(carte, x, y, x - 1, y - 3, m.corps, t);
  trait(carte, x + 1, y, x + 2, y - 4, m.clair, t);
  trait(carte, x + 2, y, x + 3, y - 2, m.sombre, t);
}

function caillou(carte: CartePeinte, x: number, y: number, t: Terrain): void {
  point(carte, x, y, PIERRE.corps, t);
  point(carte, x + 1, y, PIERRE.corps, t);
  point(carte, x, y - 1, PIERRE.clair, t);
  point(carte, x + 1, y + 1, PIERRE.sombre, t);
  point(carte, x + 2, y + 1, PIERRE.sombre, t);
}

function herbeSeche(carte: CartePeinte, x: number, y: number, t: Terrain): void {
  const c = ECORCE.clair;
  trait(carte, x, y, x + 1, y - 3, c, t);
  trait(carte, x + 3, y, x + 3, y - 2, c, t);
  trait(carte, x + 5, y + 1, x + 6, y - 2, c, t);
}

/** Un os par terre. Rare, et c'est ce qui lui donne son poids. */
function ossement(carte: CartePeinte, x: number, y: number, t: Terrain): void {
  trait(carte, x, y, x + 5, y - 1, OS, t);
  point(carte, x - 1, y - 1, OS, t);
  point(carte, x - 1, y + 1, OS, t);
  point(carte, x + 6, y - 2, OS, t);
  point(carte, x + 6, y, OS, t);
  trait(carte, x, y + 1, x + 5, y, melanger(OS, C.fer, 0.45), t);
}

function feuillesMortes(carte: CartePeinte, x: number, y: number, t: Terrain): void {
  const c = melanger(SOUS_BOIS.clair, ECORCE.clair, 0.5);
  point(carte, x, y, c, t);
  point(carte, x + 3, y + 1, c, t);
  point(carte, x + 1, y + 3, SOUS_BOIS.clair, t);
  point(carte, x + 5, y - 1, SOUS_BOIS.clair, t);
}

function racine(carte: CartePeinte, x: number, y: number, t: Terrain): void {
  trait(carte, x, y, x + 6, y + 2, ECORCE.sombre, t);
  trait(carte, x + 6, y + 2, x + 9, y + 1, ECORCE.sombre, t);
  point(carte, x + 2, y, ECORCE.corps, t);
}

function ride(carte: CartePeinte, x: number, y: number, t: Terrain): void {
  trait(carte, x, y, x + 4, y - 1, SABLE.clair, t);
  trait(carte, x + 5, y - 1, x + 9, y, SABLE.clair, t);
  trait(carte, x + 2, y + 5, x + 7, y + 4, SABLE.clair, t);
}

function coquille(carte: CartePeinte, x: number, y: number, t: Terrain): void {
  point(carte, x, y, OS, t);
  point(carte, x + 1, y, OS, t);
  point(carte, x, y + 1, melanger(OS, C.fer, 0.3), t);
}

function fissure(carte: CartePeinte, x: number, y: number, t: Terrain): void {
  const c = melanger(ROCHE.sombre, C.fer, 0.5);
  trait(carte, x, y, x + 3, y + 3, c, t);
  trait(carte, x + 3, y + 3, x + 4, y + 7, c, t);
  trait(carte, x + 3, y + 3, x + 6, y + 4, c, t);
}

function arete(carte: CartePeinte, x: number, y: number, t: Terrain): void {
  trait(carte, x, y, x + 5, y, ROCHE.clair, t);
  trait(carte, x, y + 1, x + 5, y + 1, ROCHE.sombre, t);
}

// -------------------------------------------------------------- la cuisson

/**
 * Depose la carte peinte dans une texture, une fois (§4.17 regle 3).
 *
 * Recommencer une partie relance `create()` : sans ce garde, on refabriquerait
 * une carte de deux millions de pixels a chaque fois.
 */
export function cuireLaCarte(scene: Phaser.Scene): boolean {
  // Un monde par partie (§4.29) : la carte se recuit quand le monde change,
  // et seulement la. Recommencer le meme monde ne recuit rien.
  const graine = mondeCourant().graine;
  if (scene.textures.exists(CLE_CARTE) && carteCuitePour === graine) return false;
  if (scene.textures.exists(CLE_CARTE)) scene.textures.remove(CLE_CARTE);
  if (scene.textures.exists(CLE_MASQUE_EAU)) scene.textures.remove(CLE_MASQUE_EAU);

  const texture = scene.textures.createCanvas(CLE_CARTE, MONDE.largeur, MONDE.hauteur);
  const ctx = texture?.getContext();
  if (!texture || !ctx) return false;

  const carte = peindreLaCarte();
  ctx.putImageData(new ImageData(carte.pixels, carte.largeur, carte.hauteur), 0, 0);
  texture.refresh();
  // La carte vierge reste en memoire : chaque partie repart d'elle avant d'y
  // peindre son village (`dessinerLeSolDuVillage`). Douze Mo, une fois par monde.
  carteVierge = carte;
  carteCuitePour = graine;

  // Le masque d'eau, pour la houle (`mer.ts`) : opaque sur l'eau, rien
  // ailleurs, a un point sur deux — trois Mo au lieu de douze.
  const masque = scene.textures.createCanvas(
    CLE_MASQUE_EAU,
    Math.ceil(MONDE.largeur / ECHELLE_DU_MASQUE),
    Math.ceil(MONDE.hauteur / ECHELLE_DU_MASQUE),
  );
  const ctxMasque = masque?.getContext();
  if (masque && ctxMasque) {
    const image = ctxMasque.createImageData(masque.width, masque.height);
    for (let j = 0; j < masque.height; j += 1) {
      for (let i = 0; i < masque.width; i += 1) {
        const x = Math.min(carte.largeur - 1, i * ECHELLE_DU_MASQUE);
        const y = Math.min(carte.hauteur - 1, j * ECHELLE_DU_MASQUE);
        if (carte.terrains[y * carte.largeur + x]! <= INDEX["haut-fond"]) {
          const k = (j * masque.width + i) * 4;
          image.data[k] = 255;
          image.data[k + 1] = 255;
          image.data[k + 2] = 255;
          image.data[k + 3] = 255;
        }
      }
    }
    ctxMasque.putImageData(image, 0, 0);
    masque.refresh();
  }
  return true;
}

/** La carte telle que cuite, avant tout village et tout degat. */
let carteVierge: CartePeinte | null = null;
/** La graine du monde dont la carte est cuite, ou null. */
let carteCuitePour: number | null = null;

/** Le masque d'eau du monde courant, pour la houle : une texture a l'echelle 1/2. */
export const CLE_MASQUE_EAU = "carte-masque-eau";
export const ECHELLE_DU_MASQUE = 2;

/** Le nom du terrain d'un index, pour les tests. */
export function terrainDIndex(index: number): Terrain {
  return TERRAINS[index]!;
}

// ------------------------------------------------------------ le sol abime

/**
 * Ce qu'on peut faire au sol (§4.21, §4.24) : le retourner, le bruler, le
 * creuser.
 *
 * **Le sol est une ecriture dans la carte**, pas un decalque pose dessus : un
 * degat se peint **dans la texture cuite**, pixel par pixel, avec un bord
 * irregulier qui se fond dans la matiere autour. Il survit donc au zoom, a la
 * profondeur et a tout ce qui marche dessus — et il ne coute aucun objet.
 */
export type DegatDuSol = "terre" | "brule" | "cratere";

const MATIERE_DEGAT: Record<DegatDuSol, Matiere> = {
  terre: TERRE,
  brule: BRULE,
  cratere: CRATERE,
};

/**
 * Peint un degat dans un tampon de pixels. **Pure**, testee.
 *
 * Le bord n'est pas un cercle : il tremble d'un tiers du rayon au bruit, et il
 * se fond sur le dernier quart — une tache de terre a bords francs ferait une
 * pastille. Un cratere a en plus un **rebord clair** et un fond plus sombre :
 * c'est le rebord qui fait lire un trou, et il n'existait pas tant que le sol
 * etait fait de carreaux qui ne connaissaient pas leurs voisins.
 *
 * @param pixels le tampon RVBA, ligne par ligne
 * @param cx, cy le centre du degat, dans le tampon
 * @param sel une graine : deux crateres au meme endroit ne sont pas jumeaux
 */
export function peindreDegat(
  pixels: Uint8ClampedArray,
  largeur: number,
  hauteur: number,
  cx: number,
  cy: number,
  rayon: number,
  degat: DegatDuSol,
  sel: number,
): void {
  const m = MATIERE_DEGAT[degat];
  for (let y = 0; y < hauteur; y += 1) {
    for (let x = 0; x < largeur; x += 1) {
      const d = Math.hypot(x - cx, y - cy) / rayon;
      if (d > 1.15) continue;
      const bord = 0.72 + bruitLisse(x + sel * 17, y + sel * 31, 6, 9) * 0.4;
      if (d > bord) continue;
      // La fonte du bord : plein au centre, transparent sur le dernier quart.
      const part = Math.min(1, (bord - d) / 0.26) * 0.92;

      // Le marbrage de la matiere, comme sur le sol.
      const v = bruitLisse(x + sel * 3, y + sel * 5, 5, 13);
      let couleur = v < 0.38 ? m.sombre : v > 0.76 ? m.clair : m.corps;
      if (degat === "cratere") {
        // Le fond est sombre, et le rebord accroche la lumiere.
        if (d < 0.4) couleur = m.sombre;
        else if (d > bord - 0.22) couleur = melanger(m.clair, C.os, 0.25);
      } else if (degat === "brule" && bruit(x, y, sel + 1) > 0.94) {
        // Une escarbille de cendre, rare : sur du sombre, l'oeil compte chaque
        // pixel clair.
        couleur = m.clair;
      }

      const i = (y * largeur + x) * 4;
      pixels[i] = Math.round(pixels[i]! + (((couleur >> 16) & 0xff) - pixels[i]!) * part);
      pixels[i + 1] = Math.round(pixels[i + 1]! + (((couleur >> 8) & 0xff) - pixels[i + 1]!) * part);
      pixels[i + 2] = Math.round(pixels[i + 2]! + ((couleur & 0xff) - pixels[i + 2]!) * part);
    }
  }
}

/** Les scenes dont la carte attend d'etre renvoyee au moteur. */
const rafraichissements = new WeakSet<Phaser.Scene>();

/**
 * Abime le sol du monde, a cet endroit.
 *
 * ⚠️ **Un seul envoi de texture par image, quel que soit le nombre de degats.**
 * `refresh()` renvoie deux millions de pixels au moteur ; vingt murs qui
 * tombent dans la meme image le feraient vingt fois. On peint tout de suite
 * dans le canevas, et on ne le renvoie qu'a la fin de l'image.
 *
 * @param rayon en pixels du monde ; le bord tremble autour.
 */
export function abimerLeSol(
  scene: Phaser.Scene,
  x: number,
  y: number,
  degat: DegatDuSol,
  rayon: number,
): void {
  const texture = scene.textures.get(CLE_CARTE) as Phaser.Textures.CanvasTexture;
  if (!texture || typeof texture.getContext !== "function") return;
  const ctx = texture.getContext();

  const marge = Math.ceil(rayon * 1.2);
  const x0 = Math.max(0, Math.round(x) - marge);
  const y0 = Math.max(0, Math.round(y) - marge);
  const x1 = Math.min(MONDE.largeur, Math.round(x) + marge);
  const y1 = Math.min(MONDE.hauteur, Math.round(y) + marge);
  if (x1 <= x0 || y1 <= y0) return;

  const image = ctx.getImageData(x0, y0, x1 - x0, y1 - y0);
  const sel = Math.round(x * 7 + y * 13) & 0xffff;
  peindreDegat(image.data, x1 - x0, y1 - y0, x - x0, y - y0, rayon, degat, sel);
  ctx.putImageData(image, x0, y0);

  if (rafraichissements.has(scene)) return;
  rafraichissements.add(scene);
  scene.events.once("postupdate", () => {
    rafraichissements.delete(scene);
    texture.refresh();
  });
}

// ------------------------------------------------------ le sol du village

/**
 * Le sol du village (§4.24, 19 septembre 2026) : **la place en terre battue**,
 * **les rues** vers les portes et les lieux de travail, et **le parvis pave**
 * autour de l'eglise, aux paves uses. Tout se peint dans la carte cuite, une
 * fois par partie, comme un degat (§4.30 : « la place et les chemins
 * reviennent comme etats de case ») — aucun objet, aucun cout par image.
 *
 * Les bords tremblent au bruit et la terre est marbree comme un degat ; le
 * relief reste visible dessous, parce que la terre prend la clarte du pixel
 * qu'elle recouvre. On ne peint que sur l'herbe, le sable et le sous-bois :
 * jamais sur l'eau ni la roche.
 */

/** Les terrains sur lesquels un village foule son sol. */
const TERRAINS_FOULES = new Set<Terrain>(["herbe", "sable", "sous-bois"]);

/** Ce que le sol du village demande au peintre, en cases et en pixels du monde. */
export interface SolDuVillage {
  /** Les cases de la place, sans son bord — l'enceinte n'est pas de la terre. */
  place: { colonne: number; ligne: number }[];
  rues: Segment[];
  /** Le parvis pave : son centre et son rayon. */
  parvis: { x: number; y: number; rayon: number };
}

/**
 * Le rayon du parvis, en pixels : un pas autour de l'eglise, pas une esplanade.
 * A 60, mesure sur capture, la dalle grise mangeait le tiers du village.
 */
export const RAYON_DU_PARVIS = 44;

/** La demi-largeur d'une rue, en pixels : un peu plus d'un tiers de case, avant le tremblement. */
const DEMI_RUE = 6;

/** Un pave fait six pixels, joint compris. */
const PAVE = 6;

/** La terre battue de la place : la terre, un peu sechee par le sable. */
const PLACE: Matiere = {
  sombre: melanger(TERRE.sombre, SABLE.sombre, 0.12),
  corps: melanger(TERRE.corps, SABLE.corps, 0.12),
  clair: melanger(TERRE.clair, SABLE.clair, 0.14),
};

/** La terre d'une rue : plus claire que la place, foulee et seche. */
const RUE: Matiere = {
  sombre: melanger(TERRE.sombre, SABLE.corps, 0.26),
  corps: melanger(TERRE.corps, SABLE.corps, 0.3),
  clair: melanger(TERRE.clair, SABLE.clair, 0.32),
};

/** Les paves du parvis : de la pierre qui a pris la couleur de la terre autour. */
export const PAVES: Matiere = {
  sombre: melanger(PIERRE.sombre, TERRE.sombre, 0.3),
  corps: melanger(PIERRE.corps, TERRE.corps, 0.3),
  clair: melanger(PIERRE.clair, TERRE.clair, 0.25),
};

const borner = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

function luminance(r: number, v: number, b: number): number {
  return 0.299 * r + 0.587 * v + 0.114 * b;
}

function luminanceDe(couleur: number): number {
  return luminance((couleur >> 16) & 0xff, (couleur >> 8) & 0xff, couleur & 0xff);
}

/**
 * Peint le sol du village dans un tampon de pixels. **Pure**, testee.
 *
 * Trois couches, dans l'ordre : la place, les rues, le parvis. Chacune se
 * fond dans le pixel qu'elle recouvre avec sa part, et prend sa clarte — la
 * facette de relief se voit encore a travers la terre.
 *
 * @param sel une graine : deux villages n'ont pas les memes bords
 */
export function peindreLeSolDuVillage(carte: CartePeinte, sol: SolDuVillage, sel: number): void {
  const { largeur, hauteur, pixels, terrains } = carte;

  // La place, en cases : on lit vite « est-ce de la place ? ».
  const place = new Set(sol.place.map((c) => cleCase(c.colonne, c.ligne)));
  const dansLaPlace = (c: number, l: number) => place.has(cleCase(c, l));

  /**
   * La distance signee au bord de la place, en pixels : positive dedans,
   * negative dehors, sur les quatre cotes de la case. `null` loin de tout.
   */
  const distanceAuBord = (x: number, y: number): number | null => {
    const c = Math.floor(x / CASE);
    const l = Math.floor(y / CASE);
    const dedans = dansLaPlace(c, l);
    const gauche = x - c * CASE;
    const droite = (c + 1) * CASE - x;
    const haut = y - l * CASE;
    const bas = (l + 1) * CASE - y;
    let d = Number.POSITIVE_INFINITY;
    const cotes: [boolean, number][] = [
      [dansLaPlace(c - 1, l), gauche],
      [dansLaPlace(c + 1, l), droite],
      [dansLaPlace(c, l - 1), haut],
      [dansLaPlace(c, l + 1), bas],
    ];
    for (const [voisineDedans, distance] of cotes) {
      if (voisineDedans !== dedans && distance < d) d = distance;
    }
    if (dedans) return d === Number.POSITIVE_INFINITY ? CASE : d;
    return d === Number.POSITIVE_INFINITY ? null : -d;
  };

  const distanceAuSegment = (x: number, y: number, s: Segment): number => {
    const dx = s.a.x - s.de.x;
    const dy = s.a.y - s.de.y;
    const longueur2 = dx * dx + dy * dy;
    const t = longueur2 === 0 ? 0 : borner(((x - s.de.x) * dx + (y - s.de.y) * dy) / longueur2);
    return Math.hypot(x - (s.de.x + dx * t), y - (s.de.y + dy * t));
  };

  // La boite de tout ce qui se peint, pour ne pas parcourir deux millions de pixels.
  let x0 = largeur;
  let y0 = hauteur;
  let x1 = 0;
  let y1 = 0;
  const etendre = (ax: number, ay: number, bx: number, by: number) => {
    x0 = Math.min(x0, ax);
    y0 = Math.min(y0, ay);
    x1 = Math.max(x1, bx);
    y1 = Math.max(y1, by);
  };
  for (const c of sol.place) etendre(c.colonne * CASE - 8, c.ligne * CASE - 8, (c.colonne + 1) * CASE + 8, (c.ligne + 1) * CASE + 8);
  for (const s of sol.rues) {
    etendre(Math.min(s.de.x, s.a.x) - 10, Math.min(s.de.y, s.a.y) - 10, Math.max(s.de.x, s.a.x) + 10, Math.max(s.de.y, s.a.y) + 10);
  }
  etendre(sol.parvis.x - sol.parvis.rayon - 8, sol.parvis.y - sol.parvis.rayon - 8, sol.parvis.x + sol.parvis.rayon + 8, sol.parvis.y + sol.parvis.rayon + 8);
  x0 = Math.max(0, Math.floor(x0));
  y0 = Math.max(0, Math.floor(y0));
  x1 = Math.min(largeur, Math.ceil(x1));
  y1 = Math.min(hauteur, Math.ceil(y1));
  if (x1 <= x0 || y1 <= y0) return;

  const teinte = (m: Matiere, x: number, y: number, decalage: number): number => {
    const v = bruitLisse(x + (sel + decalage) * 3, y + (sel + decalage) * 5, 5, 13);
    return v < 0.38 ? m.sombre : v > 0.76 ? m.clair : m.corps;
  };

  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const i = y * largeur + x;
      const terrain = TERRAINS[terrains[i]!];
      if (!terrain || !TERRAINS_FOULES.has(terrain)) continue;

      // 1. La place : une terre battue au bord irregulier, usee par endroits.
      let partPlace = 0;
      const d = distanceAuBord(x, y);
      if (d !== null) {
        const tremblement = (bruitLisse(x, y, 9, sel + 1) - 0.5) * 16;
        partPlace = borner((d - tremblement + 2) / 4);
        const usure = bruitLisse(x, y, 16, sel + 3);
        partPlace *= 0.7 + 0.3 * borner((usure - 0.25) / 0.25);
      }

      // 2. Les rues : une bande qui tremble d'un pixel ou deux. **Dans la
      //    place, elles sont pavees** (Angelos, 20 septembre 2026) : les memes
      //    paves que le parvis, un peu plus uses ; dehors, un chemin de terre.
      let partRue = 0;
      let couleurRue = 0;
      if (sol.rues.length > 0) {
        let proche = Number.POSITIVE_INFINITY;
        for (const s of sol.rues) {
          const ds = distanceAuSegment(x, y, s);
          if (ds < proche) proche = ds;
        }
        const demi = DEMI_RUE + (bruitLisse(x, y, 6, sel + 7) - 0.5) * 4;
        partRue = borner((demi - proche + 1) / 3) * 0.92;
        if (partRue > 0) {
          if (dansLaPlace(Math.floor(x / CASE), Math.floor(y / CASE))) {
            const rangee = Math.floor(y / PAVE);
            const xx = x + (rangee % 2) * 3;
            const u = ((xx % PAVE) + PAVE) % PAVE;
            const v = ((y % PAVE) + PAVE) % PAVE;
            const n = bruit(Math.floor(xx / PAVE), rangee, sel + 13);
            if (n < 0.22) couleurRue = teinte(RUE, x, y, 1); // un pave parti
            else if (u === 0 || v === 0) couleurRue = PAVES.sombre;
            else if (n < 0.66) couleurRue = PAVES.corps;
            else if (n < 0.9) couleurRue = PAVES.clair;
            else couleurRue = PAVES.sombre;
          } else {
            couleurRue = teinte(RUE, x, y, 1);
          }
        }
      }

      // 3. Le parvis : des paves a joints sombres, dont il manque d'autant
      //    plus qu'on s'eloigne de l'eglise — la pierre se dissout dans la terre.
      let partParvis = 0;
      let couleurParvis = 0;
      const dp = Math.hypot(x - sol.parvis.x, y - sol.parvis.y);
      if (dp < sol.parvis.rayon + 8) {
        const rayon = sol.parvis.rayon + (bruitLisse(x, y, 8, sel + 11) - 0.5) * 10;
        partParvis = borner((rayon - dp + 2) / 4);
        if (partParvis > 0) {
          const rangee = Math.floor(y / PAVE);
          const xx = x + (rangee % 2) * 3;
          const u = ((xx % PAVE) + PAVE) % PAVE;
          const v = ((y % PAVE) + PAVE) % PAVE;
          const n = bruit(Math.floor(xx / PAVE), rangee, sel + 5);
          const usure = 0.1 + 0.55 * (dp / sol.parvis.rayon) ** 2;
          if (n < usure) couleurParvis = teinte(PLACE, x, y, 2); // un pave parti
          else if (u === 0 || v === 0) couleurParvis = PAVES.sombre;
          else if (n < 0.62) couleurParvis = PAVES.corps;
          else if (n < 0.88) couleurParvis = PAVES.clair;
          else couleurParvis = PAVES.sombre;
        }
      }

      if (partPlace <= 0 && partRue <= 0 && partParvis <= 0) continue;

      // La clarte du pixel d'origine, pour que le relief se voie encore.
      const o = i * 4;
      const r = pixels[o]!;
      const g = pixels[o + 1]!;
      const b = pixels[o + 2]!;
      const base = luminanceDe(MATIERES[terrain].corps);
      const facteur = base > 0 ? Math.max(0.78, Math.min(1.22, luminance(r, g, b) / base)) : 1;

      let cr = r;
      let cg = g;
      let cb = b;
      const poser = (couleur: number, part: number) => {
        if (part <= 0) return;
        const rr = Math.min(255, ((couleur >> 16) & 0xff) * facteur);
        const gg = Math.min(255, ((couleur >> 8) & 0xff) * facteur);
        const bb = Math.min(255, (couleur & 0xff) * facteur);
        cr += (rr - cr) * part;
        cg += (gg - cg) * part;
        cb += (bb - cb) * part;
      };
      poser(teinte(PLACE, x, y, 0), partPlace);
      poser(couleurRue, partRue);
      poser(couleurParvis, partParvis);

      pixels[o] = Math.round(cr);
      pixels[o + 1] = Math.round(cg);
      pixels[o + 2] = Math.round(cb);
    }
  }
}

/**
 * Peint le sol de ce village dans la carte du monde.
 *
 * La carte redevient d'abord vierge : la place de la partie d'avant, ses
 * brulures et ses crateres s'en vont avec elle — la scene est reutilisee a
 * chaque partie, la texture aussi.
 */
export function dessinerLeSolDuVillage(scene: Phaser.Scene, plan: PlanVillage, rues: Segment[]): void {
  const texture = scene.textures.get(CLE_CARTE) as Phaser.Textures.CanvasTexture;
  if (!texture || typeof texture.getContext !== "function" || !carteVierge) return;
  const ctx = texture.getContext();
  const { largeur, hauteur } = carteVierge;

  ctx.putImageData(new ImageData(carteVierge.pixels, largeur, hauteur), 0, 0);
  const image = ctx.getImageData(0, 0, largeur, hauteur);

  const enceinte = new Set(plan.enceinte.map((m) => cleCase(m.colonne, m.ligne)));
  const place = [...plan.place]
    .filter((clef) => !enceinte.has(clef))
    .map((clef) => {
      const [colonne, ligne] = clef.split(",").map(Number) as [number, number];
      return { colonne, ligne };
    });
  peindreLeSolDuVillage(
    { largeur, hauteur, pixels: image.data as Uint8ClampedArray<ArrayBuffer>, terrains: carteVierge.terrains },
    { place, rues, parvis: { x: EGLISE.x, y: EGLISE.y, rayon: RAYON_DU_PARVIS } },
    plan.graine,
  );
  ctx.putImageData(image, 0, 0);
  texture.refresh();
}
