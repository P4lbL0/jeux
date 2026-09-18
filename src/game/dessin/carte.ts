import type Phaser from "phaser";
import {
  MONDE,
  ligneDEau,
  ligneDeForet,
  ligneDeMontagne,
  ligneDeSable,
  type Terrain,
} from "../../core/carte";
import { C } from "../ui/couleurs";
import { bruit, bruitLisse, ligneDeBruit } from "./bruit";
import { releverLeRelief } from "./relief";
import { BRULE, CRATERE, TERRE } from "./sol";
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
 * Les lignes de `core/carte.ts`, calculees une fois par rangee et par colonne.
 *
 * ⚠️ **Ce sont les formules du core, pas une copie.** Elles sont seulement
 * echantillonnees d'avance : appeler `terrainEn` pour chacun des trois millions
 * de pixels coutait une demi-seconde de sinus. Un test verifie que la
 * classification d'ici rend exactement `terrainEn`.
 */
interface Lignes {
  eau: Float32Array;
  sable: Float32Array;
  foret: Float32Array;
  montagne: Float32Array;
}

function echantillonner(largeur: number, hauteur: number): Lignes {
  const marge = TREMBLEMENT + 1;
  const eau = new Float32Array(hauteur + marge * 2);
  const sable = new Float32Array(hauteur + marge * 2);
  for (let y = -marge; y < hauteur + marge; y += 1) {
    eau[y + marge] = ligneDEau(y);
    sable[y + marge] = ligneDeSable(y);
  }
  const foret = new Float32Array(largeur + marge * 2);
  const montagne = new Float32Array(largeur + marge * 2);
  for (let x = -marge; x < largeur + marge; x += 1) {
    foret[x + marge] = ligneDeForet(x);
    montagne[x + marge] = ligneDeMontagne(x);
  }
  return { eau, sable, foret, montagne };
}

/**
 * La nature du sol en un point, lue dans les lignes echantillonnees.
 *
 * Meme ordre que `terrainEn` : l'eau avant la roche, pour que la montagne
 * descende jusqu'au rivage et s'y arrete au lieu de couper le littoral.
 */
export function classer(lignes: Lignes, x: number, y: number): Terrain {
  const marge = TREMBLEMENT + 1;
  const eau = lignes.eau[y + marge] ?? 0;
  if (x < eau - 104) return "abysse";
  if (x < eau - 38) return "mer";
  if (x < eau) return "haut-fond";

  const montagne = lignes.montagne[x + marge] ?? Infinity;
  if (y > montagne + 44) return "roche";
  if (y > montagne) return "eboulis";

  if (x < (lignes.sable[y + marge] ?? 0)) return "sable";
  if (y > (lignes.foret[x + marge] ?? Infinity)) return "sous-bois";
  return "herbe";
}

/** Les lignes du monde, pour les tests. */
export function lignesDuMonde(): Lignes {
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
  const lignes = echantillonner(largeur, hauteur);
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
      rangee[x] = INDEX[classer(lignes, jx, jy)];
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
  if (scene.textures.exists(CLE_CARTE)) return false;

  const texture = scene.textures.createCanvas(CLE_CARTE, MONDE.largeur, MONDE.hauteur);
  const ctx = texture?.getContext();
  if (!texture || !ctx) return false;

  const carte = peindreLaCarte();
  ctx.putImageData(new ImageData(carte.pixels, carte.largeur, carte.hauteur), 0, 0);
  texture.refresh();
  return true;
}

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
