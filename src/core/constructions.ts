/**
 * Ce qu'on bâtit (DESIGN.md §4.20).
 *
 * Deux familles, et c'est toute la distinction :
 *
 * - **les positions occupees** ne font rien toutes seules. Une tour de guet est
 *   un point haut ; c'est **l'occupant** qui decide de ce qui en sort. Un mage
 *   niveau 100 y lance ses capacites a couvert, un villageois n'y fait que voir
 *   loin et donner l'alerte ;
 * - **les engins autonomes** (baliste, canon) tirent sans personne. Ils sont du
 *   jalon 7 : ce fichier n'en contient aucun, et c'est volontaire.
 *
 * Une table de donnees, pas du code : le §"contenu separe du systeme" de la
 * facon de travailler s'applique ici comme aux classes et aux competences.
 */

import type { Ressource, Stocks } from "./habitants";

export type TypeConstruction = "palissade" | "tour";

export interface ConstructionDef {
  id: TypeConstruction;
  nom: string;
  /** Cle de texture */
  texture: string;
  /** Ce qu'elle coute a batir, et la moitie de ca a reparer entierement */
  cout: Partial<Record<Ressource, number>>;
  pvMax: number;
  /**
   * Vrai si quelqu'un peut y monter.
   *
   * C'est la ligne de partage du §4.20. Une palissade se tient devant ; une tour
   * se tient dedans.
   */
  occupable: boolean;
  /** Ce que la position ajoute a la portee de son occupant, en pixels */
  bonusPortee: number;
  description: string;
}

export const CONSTRUCTIONS: Record<TypeConstruction, ConstructionDef> = {
  palissade: {
    id: "palissade",
    nom: "Palissade",
    texture: "mur",
    cout: { bois: 12 },
    pvMax: 120,
    occupable: false,
    bonusPortee: 0,
    description: "Bloque le passage. Les monstres la frappent — et elle cede.",
  },
  tour: {
    id: "tour",
    nom: "Tour de guet",
    texture: "tour",
    cout: { bois: 40, minerai: 15 },
    pvMax: 260,
    occupable: true,
    // Voir loin, c'est tout ce qu'une tour donne a qui ne sait rien faire — et
    // c'est enorme pour qui sait.
    bonusPortee: 120,
    description: "Une position, pas une arme : c'est l'occupant qui la rend utile.",
  },
};

export const ORDRE_CONSTRUCTIONS: TypeConstruction[] = ["palissade", "tour"];

/** A-t-on de quoi la batir ? */
export function abordable(def: ConstructionDef, stocks: Stocks): boolean {
  return Object.entries(def.cout).every(
    ([ressource, montant]) => stocks[ressource as Ressource] >= (montant ?? 0),
  );
}

/** Retire le cout des stocks. A n'appeler qu'apres `abordable`. */
export function payer(def: ConstructionDef, stocks: Stocks): void {
  for (const [ressource, montant] of Object.entries(def.cout)) {
    stocks[ressource as Ressource] -= montant ?? 0;
  }
}

/** Le cout, ecrit pour un humain : « 40 bois, 15 minerai ». */
export function coutLisible(def: ConstructionDef): string {
  return Object.entries(def.cout)
    .map(([ressource, montant]) => `${montant} ${ressource}`)
    .join(", ");
}

/**
 * Ce que coute la reparation d'une construction abimee.
 *
 * Proportionnel aux degats subis, et **moitie moins cher que de rebatir** : il
 * doit toujours valoir mieux entretenir que laisser tomber et recommencer,
 * sinon personne ne repare jamais rien.
 */
export function coutReparation(
  def: ConstructionDef,
  pv: number,
): Partial<Record<Ressource, number>> {
  const manque = 1 - pv / def.pvMax;
  const cout: Partial<Record<Ressource, number>> = {};
  for (const [ressource, montant] of Object.entries(def.cout)) {
    cout[ressource as Ressource] = Math.ceil((montant ?? 0) * manque * 0.5);
  }
  return cout;
}
