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

export type TypeConstruction = "palissade" | "porte" | "tour" | "douve";

/**
 * Les trois matieres d'un rempart, dans l'ordre ou on l'ameliore (§4.20) : la
 * palissade de bois se renforce au fer, puis a la pierre. Le dessin
 * (`game/dessin/murs.ts`) connait les trois ; le jeu ne vend que ce qui a un
 * cout — et depuis le bloc 7b (20 septembre 2026) les trois en ont un : la
 * pierre sort de la mine avec le minerai.
 */
export type Matiere = "bois" | "fer" | "pierre";

export const MATIERES: readonly Matiere[] = ["bois", "fer", "pierre"];

/** Un palier de matiere : ce qu'il tient, et ce qu'il coute — `null` s'il n'est pas a vendre. */
export interface Palier {
  pvMax: number;
  cout: Partial<Record<Ressource, number>> | null;
}

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
  /**
   * Vrai pour ce qu'on ne peut pas casser : une douve est un trou, les
   * monstres ne la frappent pas, ils la franchissent ou la contournent.
   */
  indestructible?: boolean;
  /**
   * Les paliers au-dessus du bois, pour ce qui s'ameliore (§4.20, tranche le
   * 9 septembre 2026 : les points de vie montent d'environ ×4 par palier, et
   * chaque segment s'ameliore separement). Le bois, c'est `pvMax` et `cout`
   * ci-dessus. Absent : ca ne s'ameliore pas.
   */
  paliers?: { fer: Palier; pierre: Palier };
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
    // 120 → 500 → 2000 (×4). Le prix suit depuis les 12 bois joues — les
    // 40 bois du depouillage etaient poses sans jouer (Angelos, 19 septembre
    // 2026). La pierre (bloc 7b) : la pierre de la mine, plus du minerai pour
    // les agrafes ; environ deux fois le fer en valeur au port, pour ×4 de PV.
    paliers: {
      fer: { pvMax: 500, cout: { bois: 60, minerai: 25 } },
      pierre: { pvMax: 2000, cout: { pierre: 160, minerai: 40 } },
    },
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
    // Memes paliers que le mur, et toujours un peu plus solide que lui au meme
    // palier — mais un mur de fer force les monstres vers la porte de bois d'a
    // cote : c'est le point faible qu'on choisit (Angelos, 19 septembre 2026).
    paliers: {
      fer: { pvMax: 660, cout: { bois: 100, minerai: 40 } },
      pierre: { pvMax: 2660, cout: { pierre: 240, minerai: 60 } },
    },
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
  douve: {
    id: "douve",
    nom: "Douve",
    texture: "bati-douve",
    // Creuser ne coute que des etais ; c'est le temps qui devrait couter, et
    // le batisseur qu'un chantier occupe attend le bloc 8 (§4.20, bloc 7b).
    cout: { bois: 6 },
    pvMax: 1,
    occupable: false,
    bonusPortee: 0,
    description: "Un fosse devant le mur : on le franchit lentement, a decouvert. En eau, plus du tout.",
    indestructible: true,
  },
};

export const ORDRE_CONSTRUCTIONS: TypeConstruction[] = ["palissade", "porte", "tour", "douve"];

/**
 * Remplir une douve d'eau (§4.20) : une vanne de bois depuis la mer ou depuis
 * une douve deja en eau. Elle bloque alors pour de bon ce qui ne nage pas.
 */
export const REMPLISSAGE = { cout: { bois: 12 } as Partial<Record<Ressource, number>> };

/**
 * Le pont-levis (§4.20) : une porte qui se leve au-dessus d'une douve en eau.
 * Tard et cher : le tablier, les chaines, le treuil. Fermee, il n'y a plus de
 * passage du tout — et plus personne ne sort produire non plus.
 */
export const PONT_LEVIS = { cout: { bois: 80, minerai: 30 } as Partial<Record<Ressource, number>> };

/** L'occupation qu'une construction ecrit dans la grille. */
export function occupationDe(type: TypeConstruction): "mur" | "porte" | "tour" | "douve" {
  return type === "palissade" ? "mur" : type;
}

/**
 * Cases vides exigees entre ce qu'on batit et un batiment (§4.24) : **deux**
 * depuis le 19 septembre 2026 — trois avant, mesure trop lache au bloc 7a, la
 * palissade partait tres loin et creusait le village.
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
export const CASES_LIBRES_AUTOUR_DES_BATIMENTS = 2;

type Cout = Partial<Record<Ressource, number>>;

/** A-t-on de quoi payer ce cout ? */
export function peutPayer(cout: Cout, stocks: Stocks): boolean {
  return Object.entries(cout).every(
    ([ressource, montant]) => stocks[ressource as Ressource] >= (montant ?? 0),
  );
}

/** Retire un cout des stocks. A n'appeler qu'apres `peutPayer`. */
export function regler(cout: Cout, stocks: Stocks): void {
  for (const [ressource, montant] of Object.entries(cout)) {
    stocks[ressource as Ressource] -= montant ?? 0;
  }
}

/** Un cout, ecrit pour un humain : « 40 bois, 15 minerai ». */
export function coutEnClair(cout: Cout): string {
  return Object.entries(cout)
    .map(([ressource, montant]) => `${montant} ${ressource}`)
    .join(", ");
}

/** A-t-on de quoi la batir ? */
export function abordable(def: ConstructionDef, stocks: Stocks): boolean {
  return peutPayer(def.cout, stocks);
}

/** Retire le cout des stocks. A n'appeler qu'apres `abordable`. */
export function payer(def: ConstructionDef, stocks: Stocks): void {
  regler(def.cout, stocks);
}

/** Le cout, ecrit pour un humain : « 40 bois, 15 minerai ». */
export function coutLisible(def: ConstructionDef): string {
  return coutEnClair(def.cout);
}

// ------------------------------------------------------------- les paliers

/** Ce qu'une construction tient et coute a une matiere donnee. */
export function palierDe(def: ConstructionDef, matiere: Matiere): Palier {
  if (matiere === "bois" || !def.paliers) return { pvMax: def.pvMax, cout: def.cout };
  return def.paliers[matiere];
}

export function matiereSuivante(matiere: Matiere): Matiere | null {
  return MATIERES[MATIERES.indexOf(matiere) + 1] ?? null;
}

/**
 * L'amelioration possible depuis cette matiere : le palier suivant, s'il existe
 * et s'il est a vendre (un cout `null` n'est pas a vendre).
 */
export function amelioration(
  def: ConstructionDef,
  matiere: Matiere,
): { matiere: Matiere; palier: { pvMax: number; cout: Cout } } | null {
  const suivante = matiereSuivante(matiere);
  if (!suivante || suivante === "bois" || !def.paliers) return null;
  const palier = def.paliers[suivante];
  if (!palier.cout) return null;
  return { matiere: suivante, palier: { pvMax: palier.pvMax, cout: palier.cout } };
}

/** Tout ce qu'on a paye pour une construction a cette matiere : le bois, puis chaque palier franchi. */
export function coutCumule(def: ConstructionDef, matiere: Matiere): Cout {
  const total: Cout = { ...def.cout };
  const rang = MATIERES.indexOf(matiere);
  for (const m of ["fer", "pierre"] as const) {
    if (MATIERES.indexOf(m) > rang) break;
    for (const [ressource, montant] of Object.entries(def.paliers?.[m].cout ?? {})) {
      total[ressource as Ressource] = (total[ressource as Ressource] ?? 0) + (montant ?? 0);
    }
  }
  return total;
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
  matiere: Matiere = "bois",
): Partial<Record<Ressource, number>> {
  const manque = 1 - pv / palierDe(def, matiere).pvMax;
  const cout: Partial<Record<Ressource, number>> = {};
  for (const [ressource, montant] of Object.entries(coutCumule(def, matiere))) {
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
  matiere: Matiere = "bois",
): Partial<Record<Ressource, number>> {
  const reste = Math.max(0, Math.min(1, pv / palierDe(def, matiere).pvMax));
  const rendu: Partial<Record<Ressource, number>> = {};
  for (const [ressource, montant] of Object.entries(coutCumule(def, matiere))) {
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
