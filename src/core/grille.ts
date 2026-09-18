/**
 * La carte en grille modifiable (DESIGN.md §4.21).
 *
 * Jusqu'ici le terrain etait une **formule** : `carte.ts` calculait la nature du
 * sol d'un point a la demande. C'est ce qui rend la carte identique a chaque
 * partie, donc apprenable par coeur — et c'est une bonne propriete qu'on garde.
 *
 * Mais un mur qu'on pose, un champ qu'on laboure et, plus tard, un cratere de
 * meteore n'ont pas leur place dans une formule. La grille repond a ca sans rien
 * jeter : **les formules cuisent la grille au demarrage**, puis on ecrit
 * par-dessus. La carte de depart ne bouge donc pas d'un pixel, et tout ce que le
 * joueur ou le ciel y ajoutent tient dans une seconde couche.
 *
 * Ce fichier ne connait pas Phaser.
 */

import { MONDE, estTerreFerme, terrainEn, type Terrain } from "./carte";

/**
 * Cote d'une case, en pixels.
 *
 * 32 px, soit la taille d'un personnage : assez fin pour qu'un mur se pose ou on
 * le vise, assez grossier pour que toute la carte tienne dans ~3000 cases — un
 * parcours complet de la grille coute alors moins qu'une seule image de combat.
 */
export const CASE = 32;

export const COLONNES = Math.ceil(MONDE.largeur / CASE);
export const LIGNES = Math.ceil(MONDE.hauteur / CASE);

/**
 * Ce qu'on a pose sur une case, par-dessus son terrain.
 *
 * `libre` n'est pas un vide : c'est l'etat de tout ce que la formule a produit
 * et que personne n'a touche.
 *
 * `batiment` et `maison` sont neufs : rien de tout ca n'etait dans la grille a
 * aucun titre, ce qui interdisait toute regle de pose qui parle d'eux.
 *
 * ⚠️ **Les deux sont separes pour une seule raison, et elle vient de la mesure.**
 * `batiment` (l'eglise et le port) impose **trois cases libres autour** ;
 * `maison` ne prend que **sa propre case**. Appliquer la distance aux maisons
 * aussi repoussait la palissade a 256 px du centre du village contre 82 px
 * avant — les neuf maisons sont en couronne, et leurs anneaux interdits se
 * recouvraient. L'enceinte peut donc passer entre les maisons (§4.24).
 */
export type Occupation =
  | "libre"
  | "mur"
  | "tour"
  | "porte"
  | "champ"
  | "ruine"
  | "batiment"
  | "maison"
  /**
   * Une maison tombee (§4.24, 19 septembre 2026). Elle ne bloque plus, on n'y
   * bati rien d'autre qu'une maison — la relever — et la demolir rend la place.
   * Distincte de `ruine` (un mur tombe, sur lequel on rebatit ce qu'on veut).
   */
  | "decombres";

/** Les occupations qui arretent un corps, quoi qu'il arrive. */
const BLOQUANTES: Occupation[] = ["mur", "tour", "batiment", "maison"];

/**
 * Ce qui se raccorde : un mur regarde ses quatre voisines et dessine un pan
 * vers chacune qui porte l'une de ces occupations (§4.30, les murs en poteaux
 * et pans). Une ruine n'en fait pas partie — un mur ne se raccorde pas a ce
 * qui est tombe.
 */
export const RACCORDABLES: Occupation[] = ["mur", "tour", "porte"];

/**
 * Ce qui exige trois cases libres autour de soi (§4.24).
 *
 * L'eglise et le port, jamais les maisons : voir le commentaire d'`Occupation`.
 */
export const IMPOSENT_UNE_DISTANCE: Occupation[] = ["batiment"];

/**
 * Les occupations sur lesquelles on peut batir.
 *
 * **Une ruine en fait partie, et c'est une correction, pas un ajout** (§4.24).
 * `detruire` et `pietiner` ecrivaient `ruine` et rien ne remettait jamais
 * `libre` : chaque mur tombe sterilisait definitivement son emplacement, et
 * chaque champ pietine le sien. Ca rongeait exactement la ligne de front et
 * exactement la zone des champs — les deux seuls endroits ou on veut rebatir.
 */
const REBATISSABLES: Occupation[] = ["libre", "ruine"];

export interface Case {
  colonne: number;
  ligne: number;
  /** La nature du sol, cuite depuis `carte.ts` : elle ne change jamais */
  readonly terrain: Terrain;
  /** Ce que le jeu y a pose ; c'est la seule chose qui bouge */
  occupation: Occupation;
}

/**
 * La grille du monde.
 *
 * Une seule instance par partie. Elle se cuit en une passe au demarrage, puis
 * elle ne fait plus que lire et ecrire des cases — jamais recalculer un terrain.
 */
export class Grille {
  private readonly cases: Case[] = [];

  /**
   * Les portes du village sont-elles fermees ? (§4.20)
   *
   * **Toutes ensemble** : c'est la cloche qui les ferme, et l'aube qui les
   * rouvre. Une porte ouverte est un passage pour tout le monde, monstres
   * compris — c'est le dilemme du §4.20, pas un oubli. Une porte fermee arrete
   * tout le monde, et les monstres la frappent comme un mur.
   */
  portesFermees = false;

  constructor() {
    for (let ligne = 0; ligne < LIGNES; ligne++) {
      for (let colonne = 0; colonne < COLONNES; colonne++) {
        // On echantillonne au centre de la case : un coin tomberait pile sur une
        // limite de terrain une fois sur deux, et la grille serait bruitee le
        // long du littoral.
        const x = colonne * CASE + CASE / 2;
        const y = ligne * CASE + CASE / 2;
        this.cases.push({ colonne, ligne, terrain: terrainEn(x, y), occupation: "libre" });
      }
    }
  }

  colonneDe(x: number): number {
    return Math.floor(x / CASE);
  }

  ligneDe(y: number): number {
    return Math.floor(y / CASE);
  }

  /** Le centre en pixels de la case qui contient ce point : c'est l'aimant. */
  centreDe(x: number, y: number): { x: number; y: number } {
    return {
      x: this.colonneDe(x) * CASE + CASE / 2,
      y: this.ligneDe(y) * CASE + CASE / 2,
    };
  }

  dedans(colonne: number, ligne: number): boolean {
    return colonne >= 0 && colonne < COLONNES && ligne >= 0 && ligne < LIGNES;
  }

  case(colonne: number, ligne: number): Case | null {
    if (!this.dedans(colonne, ligne)) return null;
    return this.cases[ligne * COLONNES + colonne]!;
  }

  caseEn(x: number, y: number): Case | null {
    return this.case(this.colonneDe(x), this.ligneDe(y));
  }

  occupationEn(x: number, y: number): Occupation {
    return this.caseEn(x, y)?.occupation ?? "libre";
  }

  /** Ecrit dans la couche modifiable. C'est le seul moyen de changer la carte. */
  poser(x: number, y: number, occupation: Occupation): boolean {
    const c = this.caseEn(x, y);
    if (!c) return false;
    c.occupation = occupation;
    return true;
  }

  /**
   * Peut-on batir ici ?
   *
   * Deux conditions seulement : le sol porte (ni eau, ni roche — c'est la regle
   * du §4.6, et on ne construit pas un rempart dans la mer), et la case est
   * libre. Le cout, la distance au village et le reste sont des regles de jeu,
   * pas des regles de terrain : elles vivent ailleurs.
   */
  constructible(x: number, y: number): boolean {
    const c = this.caseEn(x, y);
    if (!c) return false;
    if (!REBATISSABLES.includes(c.occupation)) return false;
    return c.terrain === "sable" || c.terrain === "herbe" || c.terrain === "sous-bois";
  }

  /** Rend la case a la carte. C'est ce qui manquait a `poser`. */
  liberer(x: number, y: number): boolean {
    return this.poser(x, y, "libre");
  }

  /**
   * Y a-t-il une de ces occupations a portee de ce point ?
   *
   * La distance se compte **en cases et en carre** (Tchebychev) et non a vol
   * d'oiseau : une regle de pose se lit sur la grille qu'on voit, pas sur un
   * cercle qu'il faudrait deviner. `rayon` de 3 laisse donc trois cases vides
   * entre les deux — c'est la regle du §4.24.
   *
   * On balaye au plus (2r+1)^2 cases, soit 49 a rayon 3. C'est fait a la pose,
   * jamais par image (§4.17).
   */
  aProximite(x: number, y: number, rayon: number, occupations: Occupation[]): boolean {
    const colonne = this.colonneDe(x);
    const ligne = this.ligneDe(y);
    for (let dl = -rayon; dl <= rayon; dl++) {
      for (let dc = -rayon; dc <= rayon; dc++) {
        const c = this.case(colonne + dc, ligne + dl);
        if (c && occupations.includes(c.occupation)) return true;
      }
    }
    return false;
  }

  /**
   * Marque l'emprise d'un batiment, en cases.
   *
   * L'eglise fait 96 px de large : elle couvre trois cases, pas une. Poser un
   * seul point ferait qu'on peut batir contre son flanc.
   */
  poserEmprise(x: number, y: number, largeur: number, hauteur: number, occupation: Occupation): void {
    // Toutes les cases que le rectangle touche, et pas un rayon en cases : une
    // emprise de 48 px couvre deux cases de 32, ce qu'un demi-rayon arrondi vers
    // le bas ramenerait a une seule.
    const premiereC = this.colonneDe(x - largeur / 2);
    const derniereC = this.colonneDe(x + largeur / 2);
    const premiereL = this.ligneDe(y - hauteur / 2);
    const derniereL = this.ligneDe(y + hauteur / 2);
    for (let ligne = premiereL; ligne <= derniereL; ligne++) {
      for (let colonne = premiereC; colonne <= derniereC; colonne++) {
        const c = this.case(colonne, ligne);
        if (c) c.occupation = occupation;
      }
    }
  }

  /** Vrai si un corps ne peut pas traverser ce point. */
  bloque(x: number, y: number): boolean {
    const occupation = this.occupationEn(x, y);
    if (occupation === "porte") return this.portesFermees;
    return BLOQUANTES.includes(occupation);
  }

  /**
   * Le raccord d'une case : quelles voisines portent un mur, une tour ou une
   * porte — nord, est, sud, ouest. C'est ce que le dessin d'un mur lit pour
   * choisir son raccord (§4.30). En cases, jamais en pixels.
   */
  voisinesRaccordees(colonne: number, ligne: number): { nord: boolean; est: boolean; sud: boolean; ouest: boolean } {
    const raccorde = (c: number, l: number) => {
      const voisine = this.case(c, l);
      return voisine !== null && RACCORDABLES.includes(voisine.occupation);
    };
    return {
      nord: raccorde(colonne, ligne - 1),
      est: raccorde(colonne + 1, ligne),
      sud: raccorde(colonne, ligne + 1),
      ouest: raccorde(colonne - 1, ligne),
    };
  }

  /** Toutes les cases portant une occupation donnee. Pour l'affichage, hors boucle. */
  toutesLes(occupation: Occupation): Case[] {
    return this.cases.filter((c) => c.occupation === occupation);
  }

  /** Le centre en pixels d'une case, par ses coordonnees de grille. */
  static centreCase(colonne: number, ligne: number): { x: number; y: number } {
    return { x: colonne * CASE + CASE / 2, y: ligne * CASE + CASE / 2 };
  }
}

/**
 * Verifie que la grille dit la meme chose que la formule.
 *
 * Sert au test : c'est la promesse du §4.21 — cuire la carte ne doit pas la
 * changer. On echantillonne les centres de case, seuls points ou les deux
 * representations sont censees coincider exactement.
 */
export function grilleFideleALaFormule(grille: Grille): boolean {
  for (let ligne = 0; ligne < LIGNES; ligne++) {
    for (let colonne = 0; colonne < COLONNES; colonne++) {
      const centre = Grille.centreCase(colonne, ligne);
      const c = grille.case(colonne, ligne)!;
      if (c.terrain !== terrainEn(centre.x, centre.y)) return false;
      if (
        (c.terrain === "sable" || c.terrain === "herbe" || c.terrain === "sous-bois") !==
        estTerreFerme(centre.x, centre.y)
      ) {
        return false;
      }
    }
  }
  return true;
}
