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

export type TypeConstruction = "palissade" | "porte" | "tour";

export interface ConstructionDef {
  id: TypeConstruction;
  nom: string;
  /**
   * Le prefixe de la famille de textures.
   *
   * ⚠️ Un mur a **seize dessins par matiere** depuis le 11 septembre 2026 — un
   * par raccord a ses voisines — et une porte en a quatre : c'est
   * `game/constructions.ts` qui choisit lequel, d'apres la grille. Le core ne
   * nomme que la famille.
   */
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
    // La famille que `dessin/murs.ts` cuit au demarrage. Ecrite en clair et
    // non importee — `core/` ne remonte jamais vers `game/`.
    texture: "bati-mur-bois",
    cout: { bois: 12 },
    pvMax: 120,
    occupable: false,
    bonusPortee: 0,
    description: "Bloque le passage. Les monstres la frappent — et elle cede.",
  },
  porte: {
    id: "porte",
    nom: "Porte",
    texture: "bati-porte-bois",
    // Plus chere qu'une palissade, et plus solide : c'est le point faible qu'on
    // a choisi soi-meme, il doit valoir qu'on le defende (§4.20).
    cout: { bois: 20 },
    pvMax: 160,
    occupable: false,
    bonusPortee: 0,
    description: "Ouverte le jour, tout le monde passe. La cloche la ferme ; l'aube la rouvre.",
  },
  tour: {
    id: "tour",
    nom: "Tour de guet",
    texture: "bati-tour",
    cout: { bois: 40, minerai: 15 },
    pvMax: 260,
    occupable: true,
    // Voir loin, c'est tout ce qu'une tour donne a qui ne sait rien faire — et
    // c'est enorme pour qui sait.
    bonusPortee: 120,
    description: "Une position, pas une arme : c'est l'occupant qui la rend utile.",
  },
};

export const ORDRE_CONSTRUCTIONS: TypeConstruction[] = ["palissade", "porte", "tour"];

/** L'occupation qu'une construction ecrit dans la grille. */
export function occupationDe(type: TypeConstruction): "mur" | "porte" | "tour" {
  return type === "palissade" ? "mur" : type;
}

/**
 * Cases vides exigees entre ce qu'on batit et un batiment (§4.24).
 *
 * Ca remplace le disque interdit de 55 % du rayon du village, qui contredisait
 * « la carte entiere est constructible » et ne voudra plus rien dire du tout au
 * jalon 5.5, ou le village change de place d'une partie a l'autre.
 *
 * ⚠️ La regle vaut pour **tout ce que le joueur batit**, tour comprise, et pas
 * seulement pour les murs : une file de tours collees a l'eglise contournerait
 * sinon la regle en produisant exactement ce qu'elle interdit. Ce qu'on protege,
 * c'est la cour — l'endroit ou on se bat.
 */
export const CASES_LIBRES_AUTOUR_DES_BATIMENTS = 3;

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

/** Part du prix rendue quand on demolit soi-meme (§4.24). */
export const PART_REMBOURSEE = 0.5;

/**
 * Ce que la demolition rend.
 *
 * La moitie du prix, et **proportionnellement a ce qui tient encore debout** :
 * demolir une palissade a moitie cassee ne rend pas ce qu'elle a coute neuve.
 * Sans ca, rebatir sur une ruine serait gratuit — on encaisserait le
 * remboursement plein d'un mur qui ne valait plus rien.
 *
 * Rien du tout punirait l'essai dans le seul mode fait pour essayer ; tout
 * rendre viderait le placement de son enjeu (§4.24).
 */
export function remboursementDemolition(
  def: ConstructionDef,
  pv: number,
): Partial<Record<Ressource, number>> {
  const reste = Math.max(0, Math.min(1, pv / def.pvMax));
  const rendu: Partial<Record<Ressource, number>> = {};
  for (const [ressource, montant] of Object.entries(def.cout)) {
    rendu[ressource as Ressource] = Math.floor((montant ?? 0) * reste * PART_REMBOURSEE);
  }
  return rendu;
}

/** Verse un remboursement dans les stocks. */
export function crediter(rendu: Partial<Record<Ressource, number>>, stocks: Stocks): void {
  for (const [ressource, montant] of Object.entries(rendu)) {
    stocks[ressource as Ressource] += montant ?? 0;
  }
}
