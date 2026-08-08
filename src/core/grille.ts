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
 */
export type Occupation = "libre" | "mur" | "tour" | "champ" | "ruine";

/** Les occupations qui arretent un corps. */
const BLOQUANTES: Occupation[] = ["mur", "tour"];

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
    if (c.occupation !== "libre") return false;
    return c.terrain === "sable" || c.terrain === "herbe" || c.terrain === "sous-bois";
  }

  /** Vrai si un corps ne peut pas traverser ce point. */
  bloque(x: number, y: number): boolean {
    return BLOQUANTES.includes(this.occupationEn(x, y));
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
