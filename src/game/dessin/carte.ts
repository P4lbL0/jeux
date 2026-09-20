import { MONDE, terrainEn as terrainDuMonde, type Terrain } from "../../core/carte";
import { C } from "../ui/couleurs";
import { bruit, bruitLisse, ligneDeBruit } from "./bruit";
import { releverLeRelief, type Relief } from "./relief";
import { BRULE, CRATERE, TERRE } from "./sol";
import { cleCase, type Segment } from "../../core/village";
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
 * La carte, peinte par le code **morceau par morceau** (DESIGN.md §4.30, §4.29).
 *
 * ⚠️ **Ce fichier est pur** : ni Phaser, ni hasard, ni texture. Tout ce qui
 * depose des pixels dans le moteur vit dans [`morceaux.ts`](morceaux.ts). Il
 * n'en a pas toujours ete ainsi — la carte etait peinte ici **d'un seul bloc**
 * et poussee dans une unique texture de deux millions de pixels. Ce bloc-la
 * etait le dernier verrou d'architecture du projet : il coutait **1,0 s a x2 et
 * 1,5 s a x3** (mesure hors navigateur, donc un plancher), et il gelait le jeu
 * a chaque village refuse. Il posait en plus un **plafond dur** : une texture
 * unique ne depasse pas 4 096 pixels de cote sur beaucoup de cartes
 * graphiques, ce qui bloquait la carte a deux fois sa largeur classique. x3 en
 * surface passe encore (3 464 px) ; x4 n'aurait jamais pu.
 *
 * Depuis la nuit du 20 septembre 2026, on peint donc des **morceaux** : des carres du
 * monde, chacun avec son coin en pixels du monde (`x0`, `y0`), peints
 * independamment et raccordes sans couture. Les trois pieges du raccord sont
 * traites ici, et ils sont tout le sujet :
 *
 * 1. **Le bruit part d'un x du monde** (`ligneDeBruit`, parametre `depart`) :
 *    une tache doit tomber au meme endroit quel que soit le morceau qui la
 *    peint.
 * 2. **Une rangee connait celle du dessus**, meme la premiere : la crete de la
 *    montagne et l'ombre au pied de l'eboulis se lisent d'une rangee a
 *    l'autre. On classe donc la rangee juste au-dessus du morceau avant de
 *    commencer, sans la peindre.
 * 3. **Une rangee deborde de trois pixels a droite** : l'ecume regarde devant
 *    elle (`rangee[x + 3]`), et sans ce debord le dernier pixel d'un morceau
 *    n'aurait pas d'ecume.
 *
 * Les details, eux, se sement par **case du monde** : un morceau peint toutes
 * les cases qui le touchent, y compris celles qui debordent d'un cote ou de
 * l'autre, et chacun garde la part qui tombe chez lui. Un os a cheval sur deux
 * morceaux est donc peint deux fois, en deux moities qui se rejoignent.
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
 * ⚠️ **Des millions de pixels, cuits une fois, jamais retouches par image**
 * (§4.17 regle 3). Un etat de case (cratere, chemin) s'ecrit **dans la texture
 * du morceau**, case par case, exactement comme un mur s'ecrit dans la grille.
 */

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
  /** Le point du monde que porte l'index (0, 0) du treillis. */
  ox: number;
  oy: number;
  colonnes: number;
  lignes: number;
  /** L'index dans `TERRAINS` de chaque point du treillis */
  terrains: Uint8Array;
}

/**
 * Echantillonne le terrain sur un rectangle du monde, avec la marge que le
 * tremblement des lisieres, le debord d'ecume et la rangee du dessus reclament.
 *
 * ⚠️ **Un champ par morceau, pas un pour le monde.** Un treillis sur la zone x3
 * entiere pese 3,4 Mo et coute 280 ms d'un coup — c'est-a-dire exactement le gel
 * qu'on vient supprimer. Celui d'un morceau de 512 coute six millisemes.
 */
function echantillonner(x0: number, y0: number, largeur: number, hauteur: number): Champ {
  const pas = PAS_DU_CHAMP;
  // ⚠️ **Une case entiere de marge, pas seulement le tremblement.** Un morceau
  // doit pouvoir semer les details des cases qui le **touchent** sans lui
  // appartenir : leur graine tombe chez le voisin, mais leurs pixels debordent
  // chez lui (voir `terrainSeme`). Sans cette marge, un os a cheval sur deux
  // morceaux serait coupe net sur la couture.
  const marge = Math.ceil((CASE + TREMBLEMENT + 1 + DEBORD_A_DROITE) / pas);
  const ox = x0 - marge * pas;
  const oy = y0 - marge * pas;
  const colonnes = Math.ceil(largeur / pas) + marge * 2 + 1;
  const lignes = Math.ceil(hauteur / pas) + marge * 2 + 1;
  const terrains = new Uint8Array(colonnes * lignes);
  for (let j = 0; j < lignes; j += 1) {
    const y = oy + j * pas;
    for (let i = 0; i < colonnes; i += 1) {
      terrains[j * colonnes + i] = INDEX[terrainDuMonde(ox + i * pas, y)];
    }
  }
  return { pas, ox, oy, colonnes, lignes, terrains };
}

/**
 * La nature du sol en un point du monde, lue dans le treillis : le point le
 * plus proche. Hors du treillis, le bord le plus proche.
 */
export function classer(champ: Champ, x: number, y: number): Terrain {
  let i = Math.round((x - champ.ox) / champ.pas);
  let j = Math.round((y - champ.oy) / champ.pas);
  if (i < 0) i = 0;
  else if (i >= champ.colonnes) i = champ.colonnes - 1;
  if (j < 0) j = 0;
  else if (j >= champ.lignes) j = champ.lignes - 1;
  return TERRAINS[champ.terrains[j * champ.colonnes + i]!]!;
}

/** Le champ du monde courant, pour les tests. */
export function champDuMonde(): Champ {
  return echantillonner(0, 0, MONDE.largeur, MONDE.hauteur);
}

// ------------------------------------------------------------- la peinture

/**
 * De combien une rangee deborde a droite : l'ecume regarde trois pixels devant
 * elle pour savoir si le sable approche.
 */
const DEBORD_A_DROITE = 3;

/**
 * Un morceau de carte peint : son coin dans le monde, ses pixels, et la nature
 * de sol de chacun.
 *
 * ⚠️ **Tout ce qui s'y ecrit se parle en pixels du monde**, jamais en pixels du
 * morceau : un cratere, une rue, un pave ne savent pas dans quel morceau ils
 * tombent, et ne doivent pas avoir a le savoir. C'est `index` qui traduit.
 */
export interface CartePeinte {
  /** Le coin haut-gauche du morceau, en pixels du monde. */
  x0: number;
  y0: number;
  largeur: number;
  hauteur: number;
  pixels: Uint8ClampedArray<ArrayBuffer>;
  /** L'index dans `TERRAINS` de chaque pixel — pour les tests et les details. */
  terrains: Uint8Array;
}

/** L'index d'un point du monde dans un morceau, ou -1 s'il tombe dehors. */
function index(carte: CartePeinte, x: number, y: number): number {
  const i = x - carte.x0;
  const j = y - carte.y0;
  if (i < 0 || j < 0 || i >= carte.largeur || j >= carte.hauteur) return -1;
  return j * carte.largeur + i;
}

/** Un morceau vide, pret a etre peint. */
export function preparerUnMorceau(x0: number, y0: number, largeur: number, hauteur: number): CartePeinte {
  return {
    x0,
    y0,
    largeur,
    hauteur,
    pixels: new Uint8ClampedArray(new ArrayBuffer(largeur * hauteur * 4)),
    terrains: new Uint8Array(largeur * hauteur),
  };
}

/**
 * Ce qu'un morceau doit avoir sous la main pour se peindre : le treillis de
 * terrain de son coin de monde, et le relief, qui lui est **commun a tous**.
 */
export interface Atelier {
  champ: Champ;
  relief: Relief;
  /** Les tampons d'une rangee, alloues une fois pour tout le morceau. */
  tampons: Tampons;
}

interface Tampons {
  tremblementX: Float32Array;
  tremblementY: Float32Array;
  regions: Float32Array;
  taches: Float32Array;
  tachesFines: Float32Array;
  rangee: Uint8Array;
  rangeeDuDessus: Uint8Array;
}

function tamponsPour(largeur: number): Tampons {
  const l = largeur + DEBORD_A_DROITE;
  return {
    tremblementX: new Float32Array(l),
    tremblementY: new Float32Array(l),
    regions: new Float32Array(l),
    taches: new Float32Array(l),
    tachesFines: new Float32Array(l),
    rangee: new Uint8Array(l),
    rangeeDuDessus: new Uint8Array(l),
  };
}

/**
 * Ouvre l'atelier d'un morceau : le treillis de terrain de son coin de monde,
 * la rangee juste au-dessus de lui deja classee, et les tampons.
 *
 * @param relief le relief du monde, commun a tous les morceaux — il coute
 *        quarante millisemes pour la zone x3 entiere, on ne le refait pas
 *        soixante-trois fois.
 */
export function ouvrirLAtelier(morceau: CartePeinte, relief: Relief): Atelier {
  const champ = echantillonner(morceau.x0, morceau.y0, morceau.largeur, morceau.hauteur);
  const tampons = tamponsPour(morceau.largeur);
  // ⚠️ **La rangee du dessus, meme pour la premiere rangee du morceau.** La
  // crete de roche et l'ombre au pied de l'eboulis se lisent d'une rangee a
  // l'autre : sans elle, chaque morceau aurait un trait plat en haut.
  classerUneRangee(morceau, champ, tampons, morceau.y0 - 1, tampons.rangeeDuDessus);
  return { champ, relief, tampons };
}

/** Classe la nature du sol d'une rangee entiere, tremblement compris. */
function classerUneRangee(
  morceau: CartePeinte,
  champ: Champ,
  tampons: Tampons,
  y: number,
  sortie: Uint8Array,
): void {
  const large = morceau.largeur + DEBORD_A_DROITE;
  const { tremblementX, tremblementY } = tampons;
  ligneDeBruit(y, 11, 1, large, tremblementX, morceau.x0);
  ligneDeBruit(y, 11, 2, large, tremblementY, morceau.x0);
  for (let i = 0; i < large; i += 1) {
    const x = morceau.x0 + i;
    const jx = x + Math.round((tremblementX[i]! - 0.5) * 2 * TREMBLEMENT);
    const jy = y + Math.round((tremblementY[i]! - 0.5) * 2 * TREMBLEMENT);
    sortie[i] = INDEX[classer(champ, jx, jy)];
  }
}

/**
 * Peint une tranche de rangees d'un morceau, de `j0` a `j1` (indices du
 * morceau, `j1` exclu). **Pure.**
 *
 * C'est le grain de la cuisson : on en fait autant qu'il en tient dans le
 * budget d'une image, et pas une de plus (§4.17 regle 3).
 */
export function peindreDesRangees(morceau: CartePeinte, atelier: Atelier, j0: number, j1: number): void {
  const { champ, relief, tampons } = atelier;
  const { largeur, pixels, terrains } = morceau;
  const large = largeur + DEBORD_A_DROITE;
  const { regions, taches, tachesFines, rangee, rangeeDuDessus } = tampons;

  for (let j = j0; j < j1; j += 1) {
    const y = morceau.y0 + j;
    ligneDeBruit(y, 52, 5, large, regions, morceau.x0);
    ligneDeBruit(y, 22, 3, large, taches, morceau.x0);
    ligneDeBruit(y, 8, 4, large, tachesFines, morceau.x0);

    // 1. La nature du sol, avec la lisiere qui tremble.
    classerUneRangee(morceau, champ, tampons, y, rangee);

    // 2. Le sol, puis les lisieres qui ont besoin de leurs voisins.
    for (let i = 0; i < largeur; i += 1) {
      const x = morceau.x0 + i;
      const terrain = TERRAINS[rangee[i]!]!;
      const m = MATIERES[terrain];
      // Trois echelles : les regions, les taches, le grain. Les grandes
      // dessinent des zones, les petites cassent leurs bords.
      const v = regions[i]! * 0.45 + taches[i]! * 0.35 + tachesFines[i]! * 0.2;

      // Les taches : douces, rares, et plus timides sur l'eau, ou la houle fait
      // deja le travail. ⚠️ Mesure sur planche : a 0,5 de sombre et un seuil a
      // 0,36, la prairie tournait au camouflage.
      const eau = rangee[i]! <= 2;
      let couleur = m.corps;
      if (eau) {
        // L'eau garde ses taches : elle est plate, et elle bouge par-dessus
        // (`mer.ts`).
        if (v < 0.3) couleur = melanger(m.corps, m.sombre, 0.35);
        else if (v > 0.74) couleur = melanger(m.corps, m.clair, 0.22);
      } else {
        // La terre prend le ton de sa facette : c'est le relief (`relief.ts`).
        couleur = TONS[rangee[i]!]![relief.marche(x, y) + 2]!;
      }

      // La crete de la montagne : la roche accroche la lumiere la ou elle
      // sort de l'eboulis. C'est ce qui fait lire une falaise et non une bande.
      if (terrain === "roche" && rangeeDuDessus[i] === INDEX.eboulis) {
        couleur = ROCHE.clair;
      } else if (terrain === "eboulis" && rangeeDuDessus[i]! >= INDEX.sable && rangeeDuDessus[i]! <= INDEX["sous-bois"]) {
        // L'ombre de l'herbe sur l'eboulis : un pied de pente.
        couleur = EBOULIS.sombre;
      }

      // L'ecume : le haut-fond qui touche le sable, trouee, jamais un trait.
      if (terrain === "haut-fond") {
        const sable = rangee[i + 1] === INDEX.sable || rangee[i + 2] === INDEX.sable;
        if (sable && bruit(x, y, 31) > 0.3) couleur = ECUME;
        else if (rangee[i + 3] === INDEX.sable && bruit(x, y, 32) > 0.65) couleur = HAUT_FOND.clair;
      }

      const o = (j * largeur + i) * 4;
      pixels[o] = (couleur >> 16) & 0xff;
      pixels[o + 1] = (couleur >> 8) & 0xff;
      pixels[o + 2] = couleur & 0xff;
      pixels[o + 3] = 255;
      terrains[j * largeur + i] = rangee[i]!;
    }

    rangeeDuDessus.set(rangee);
  }
}

/**
 * Seme les details d'un morceau, une fois ses rangees peintes.
 *
 * ⚠️ **Une case de marge de chaque cote.** Un os fait sept pixels de long : a
 * cheval sur la frontiere de deux morceaux, il faut que les **deux** le
 * peignent, chacun gardant sa moitie. `point` refuse tout ce qui tombe hors du
 * morceau, la couture se fait donc toute seule.
 */
export function semerLesDetailsDuMorceau(morceau: CartePeinte, atelier: Atelier): void {
  const c0 = Math.floor(morceau.x0 / CASE) - 1;
  const l0 = Math.floor(morceau.y0 / CASE) - 1;
  const c1 = Math.floor((morceau.x0 + morceau.largeur - 1) / CASE) + 1;
  const l1 = Math.floor((morceau.y0 + morceau.hauteur - 1) / CASE) + 1;
  for (let cy = l0; cy <= l1; cy += 1) {
    for (let cx = c0; cx <= c1; cx += 1) semerLesDetails(morceau, atelier.champ, cx, cy);
  }
}

/**
 * Peint un morceau d'un coup. **Pure** : ni Phaser, ni hasard.
 *
 * C'est le chemin des tests, des planches et de la vignette — en jeu, la
 * cuisson passe par `ouvrirLAtelier` + `peindreDesRangees`, qui savent
 * s'arreter au milieu.
 */
export function peindreUnMorceau(
  x0: number,
  y0: number,
  largeur: number,
  hauteur: number,
  relief = releverLeRelief(x0 + largeur, y0 + hauteur),
): CartePeinte {
  const morceau = preparerUnMorceau(x0, y0, largeur, hauteur);
  const atelier = ouvrirLAtelier(morceau, relief);
  peindreDesRangees(morceau, atelier, 0, hauteur);
  semerLesDetailsDuMorceau(morceau, atelier);
  return morceau;
}

/** La carte entiere, d'un bloc : les tests, `scripts/planche.ts`. */
export function peindreLaCarte(largeur = MONDE.largeur, hauteur = MONDE.hauteur): CartePeinte {
  return peindreUnMorceau(0, 0, largeur, hauteur);
}

// -------------------------------------------------------------- la vignette

/**
 * Un pixel de vignette pour huit pixels du monde.
 *
 * ⚠️ **Huit et pas seize, et c'est une capture qui l'a tranche.** A seize, la
 * vignette faisait 177 pixels de large : etiree sur la carte et sur le fond du
 * menu, elle se lisait en **gros blocs** qui accrochaient l'oeil. Le filtrage
 * doux n'est pas une option — le jeu est en `pixelArt`, et Phaser reimpose le
 * plus proche voisin a chaque envoi de texture. Il n'y avait donc qu'un levier,
 * la finesse : huit coute quatre fois plus, soit une trentaine de millisemes a
 * x2, ce qui reste vingt fois moins que la carte qu'on vient de supprimer.
 */
export const PAS_DE_VIGNETTE = 8;

/**
 * Le monde entier, en tout petit (decision d'Angelos, 20 septembre 2026, dans la nuit).
 *
 * **C'est ce qu'on voit d'un morceau pas encore peint.** Elle est etiree sous
 * les morceaux : le monde a donc sa forme et ses couleurs des la premiere
 * image, floue, et chaque morceau net s'y pose en s'approchant. Sans elle, un
 * coup de molette pendant les deux premieres secondes montrerait un trou noir
 * autour du heros.
 *
 * Elle ne coute presque rien — un pixel pour seize, soit 53 000 points pour la
 * zone x3, une dizaine de millisemes — parce qu'elle ne fait qu'une chose : la
 * couleur de corps de la matiere. Ni relief, ni lisiere, ni detail : tout ce
 * qui s'y verrait serait un pixel de large.
 *
 * Elle sert aussi de **fond aux deux ecrans d'avant-partie** (menu, choix de
 * classe), qui affichaient jusqu'ici la carte entiere — et payaient donc sa
 * cuisson pour un monde qu'on n'allait meme pas jouer.
 */
export function peindreLaVignette(
  largeur = MONDE.largeur,
  hauteur = MONDE.hauteur,
  pas = PAS_DE_VIGNETTE,
): { largeur: number; hauteur: number; pixels: Uint8ClampedArray<ArrayBuffer> } {
  const l = Math.max(1, Math.ceil(largeur / pas));
  const h = Math.max(1, Math.ceil(hauteur / pas));
  const pixels = new Uint8ClampedArray(new ArrayBuffer(l * h * 4));
  for (let j = 0; j < h; j += 1) {
    const y = Math.min(hauteur - 1, j * pas + pas / 2);
    for (let i = 0; i < l; i += 1) {
      const x = Math.min(largeur - 1, i * pas + pas / 2);
      const couleur = MATIERES[terrainDuMonde(x, y)].corps;
      const o = (j * l + i) * 4;
      pixels[o] = (couleur >> 16) & 0xff;
      pixels[o + 1] = (couleur >> 8) & 0xff;
      pixels[o + 2] = couleur & 0xff;
      pixels[o + 3] = 255;
    }
  }
  return { largeur: l, hauteur: h, pixels };
}

/**
 * La nature du sol au point ou se seme un detail — **meme juste a cote du
 * morceau**.
 *
 * Dedans, c'est ce que la peinture a ecrit, au pixel pres. Dehors, on **refait
 * le calcul du voisin** : le meme tremblement, tire du meme bruit du monde, sur
 * le meme treillis. Les deux morceaux choisissent donc le meme detail pour une
 * case a cheval, et chacun en garde sa moitie.
 *
 * ⚠️ `ligneDeBruit(y, e, sel, …)` et `bruitLisse(x, y, e, sel)` rendent la meme
 * valeur — c'est la meme interpolation bilineaire, prise dans l'autre ordre.
 * C'est ce qui permet de refaire ici, point par point, ce que la peinture fait
 * par rangees.
 */
function terrainSeme(carte: CartePeinte, champ: Champ, x: number, y: number): Terrain {
  const i = index(carte, x, y);
  if (i >= 0) return TERRAINS[carte.terrains[i]!]!;
  const jx = x + Math.round((bruitLisse(x, y, 11, 1) - 0.5) * 2 * TREMBLEMENT);
  const jy = y + Math.round((bruitLisse(x, y, 11, 2) - 0.5) * 2 * TREMBLEMENT);
  return classer(champ, jx, jy);
}

/**
 * Pose un pixel de detail — **seulement sur son propre terrain**.
 *
 * Une touffe d'herbe a cheval sur le rivage aurait trois pixels dans l'eau. Le
 * detail s'arrete donc la ou le sol change, sans qu'on ait a le savoir.
 */
function point(carte: CartePeinte, x: number, y: number, couleur: number, terrain: Terrain): void {
  const j = index(carte, x, y);
  if (j < 0 || TERRAINS[carte.terrains[j]!] !== terrain) return;
  const i = j * 4;
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
function semerLesDetails(carte: CartePeinte, champ: Champ, cx: number, cy: number): void {
  const de = bruit(cx, cy, 41);
  const x = cx * CASE + 4 + Math.floor(bruit(cx, cy, 42) * (CASE - 8));
  const y = cy * CASE + 4 + Math.floor(bruit(cx, cy, 43) * (CASE - 8));
  const terrain = terrainSeme(carte, champ, x, y);

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

  // La boite de tout ce qui se peint, pour ne pas parcourir deux millions de
  // pixels. ⚠️ Elle est en pixels du **monde**, et se rabat ensuite sur le
  // morceau : un village est a cheval sur six ou sept morceaux, et chacun n'a
  // le droit d'ecrire que chez lui.
  let x0 = carte.x0 + largeur;
  let y0 = carte.y0 + hauteur;
  let x1 = carte.x0;
  let y1 = carte.y0;
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
  x0 = Math.max(carte.x0, Math.floor(x0));
  y0 = Math.max(carte.y0, Math.floor(y0));
  x1 = Math.min(carte.x0 + largeur, Math.ceil(x1));
  y1 = Math.min(carte.y0 + hauteur, Math.ceil(y1));
  if (x1 <= x0 || y1 <= y0) return;

  const teinte = (m: Matiere, x: number, y: number, decalage: number): number => {
    const v = bruitLisse(x + (sel + decalage) * 3, y + (sel + decalage) * 5, 5, 13);
    return v < 0.38 ? m.sombre : v > 0.76 ? m.clair : m.corps;
  };

  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const i = (y - carte.y0) * largeur + (x - carte.x0);
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
