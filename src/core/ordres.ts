import type { Role } from "./classes";
import { NOMS_METIER, type Metier, type PostureCivile } from "./habitants";

/**
 * Les ordres du joueur a ses subordonnes (DESIGN.md §4.4).
 *
 * Un seul systeme sert deux populations : les heros joues par l'IA et les
 * mort-vivants du Necromancien (§4.14). Ils recoivent le meme objet `Ordre`,
 * et c'est ce qui evite d'avoir deux logiques de commandement a deboguer.
 *
 * Une posture ne fait que regler trois chiffres — la laisse, la distance de
 * combat, le seuil de declenchement des capacites. Volontairement : un systeme
 * d'ordres qui aurait sa propre logique de combat en parallele de l'IA, ce
 * serait une seconde IA a maintenir.
 *
 * Ce fichier ne connait pas Phaser.
 */

export interface Point {
  x: number;
  y: number;
}

export type Posture = "temporiser" | "agressif" | "repli";

export type Formation = "libre" | "mur" | "cercle";

export interface Ordre {
  posture: Posture;
  /**
   * Ou il se tient. Un point de la carte, ou rien — il s'ancre alors sur la
   * cite. La scene y recopie chaque image la position de l'allie a proteger
   * quand l'ancre a ete posee sur quelqu'un.
   */
  ancre: Point | null;
}

export const POSTURES: Posture[] = ["temporiser", "agressif", "repli"];

export const NOMS_POSTURE: Record<Posture, string> = {
  temporiser: "Temporiser",
  agressif: "Agressif",
  repli: "Repli",
};

export const FORMATIONS: Formation[] = ["libre", "mur", "cercle"];

export const NOMS_FORMATION: Record<Formation, string> = {
  libre: "Libre",
  mur: "Mur",
  cercle: "Cercle",
};

export const ORDRE_PAR_DEFAUT: Ordre = { posture: "temporiser", ancre: null };

export interface ReglagePosture {
  /** Jusqu'ou il accepte de s'eloigner de son ancre */
  laisse: number;
  /** Multiplie la distance de combat ideale de sa classe */
  distance: number;
  /** Ennemis autour a partir desquels il declenche une capacite */
  ennemisPourCapacite: number;
}

/** Au-dela de cette distance de son ancre, un subordonne revient. */
export const LAISSE = 430;

export const REGLAGES: Record<Posture, ReglagePosture> = {
  // Le defaut reproduit exactement le comportement d'avant les ordres : c'est
  // ce qui garantit qu'un joueur qui ne commande rien ne perd rien.
  temporiser: { laisse: LAISSE, distance: 1, ennemisPourCapacite: 3 },
  agressif: { laisse: 900, distance: 0.8, ennemisPourCapacite: 2 },
  repli: { laisse: 0, distance: 1, ennemisPourCapacite: Infinity },
};

/** Tolerance autour d'un poste ou d'une ancre posee : il n'a pas a etre au pixel. */
export const TOLERANCE_ANCRE = 26;

/** Ecart entre deux voisins de rangee, en pixels */
const ESPACEMENT = 44;

/** Profondeur de chaque rangee, en multiples de l'espacement, face a la menace */
const PROFONDEUR: Record<Role, number> = {
  avant: 1.3,
  flanc: 0.2,
  centre: -0.5,
  arriere: -1.4,
};

/** L'assassin prend a revers : son poste est ecarte sur les cotes */
const ECART_FLANC = 1.6;

const RAYON_EXTERIEUR = 82;
const RAYON_INTERIEUR = 42;

export function postureSuivante(actuelle: Posture, pas = 1): Posture {
  const i = POSTURES.indexOf(actuelle);
  return POSTURES[(i + pas + POSTURES.length) % POSTURES.length]!;
}

export function formationSuivante(actuelle: Formation, pas = 1): Formation {
  const i = FORMATIONS.indexOf(actuelle);
  return FORMATIONS[(i + pas + FORMATIONS.length) % FORMATIONS.length]!;
}

/**
 * Attribue a chaque membre sa place dans la formation.
 *
 * Renvoie un tableau parallele a `roles` : un point, ou `null` quand le membre
 * n'a pas de poste (formation libre). L'ordre est stable — deux appels de suite
 * avec les memes roles donnent les memes places, sans quoi les heros
 * echangeraient leurs postes d'une image a l'autre.
 *
 * @param menace vers quoi la formation fait face ; sans elle, elle regarde vers
 *        le bas de l'ecran, ce qui reste lisible.
 */
export function calculerPostes(
  roles: Role[],
  formation: Formation,
  ancre: Point,
  menace: Point | null,
): (Point | null)[] {
  if (formation === "libre") return roles.map(() => null);

  const avant = orientation(ancre, menace);
  const cote = { x: -avant.y, y: avant.x };

  // Rang de chaque membre au sein de son propre role : c'est lui qui decide de
  // l'ecartement lateral, et il doit rester stable d'une image a l'autre.
  const effectifs: Record<Role, number> = { avant: 0, flanc: 0, centre: 0, arriere: 0 };
  const rangs = roles.map((role) => effectifs[role]++);

  if (formation === "cercle") {
    // En cercle, les avants forment l'anneau exterieur tourne vers la menace,
    // et tout le reste se serre a l'interieur. C'est la formation de siege.
    const anneaux = { exterieur: 0, interieur: 0 };
    const totalInterieur = effectifs.flanc + effectifs.centre + effectifs.arriere;
    const base = Math.atan2(avant.y, avant.x);

    return roles.map((role) => {
      const dehors = role === "avant";
      const index = dehors ? anneaux.exterieur++ : anneaux.interieur++;
      const total = Math.max(1, dehors ? effectifs.avant : totalInterieur);
      const rayon = dehors ? RAYON_EXTERIEUR : RAYON_INTERIEUR;
      const angle = base + (2 * Math.PI * index) / total;
      return { x: ancre.x + Math.cos(angle) * rayon, y: ancre.y + Math.sin(angle) * rayon };
    });
  }

  return roles.map((role, i) => {
    const total = effectifs[role];
    const rang = rangs[i]!;
    const profondeur = PROFONDEUR[role] * ESPACEMENT;
    // Les flancs s'ecartent de part et d'autre ; les autres s'alignent centres.
    const lateral =
      role === "flanc"
        ? (rang % 2 === 0 ? 1 : -1) * (ECART_FLANC + Math.floor(rang / 2)) * ESPACEMENT
        : (rang - (total - 1) / 2) * ESPACEMENT;

    return {
      x: ancre.x + avant.x * profondeur + cote.x * lateral,
      y: ancre.y + avant.y * profondeur + cote.y * lateral,
    };
  });
}

function orientation(ancre: Point, menace: Point | null): Point {
  if (!menace) return { x: 0, y: 1 };
  const dx = menace.x - ancre.x;
  const dy = menace.y - ancre.y;
  const l = Math.hypot(dx, dy);
  return l === 0 ? { x: 0, y: 1 } : { x: dx / l, y: dy / l };
}

// --------------------------------------------------- le menu d'ordres (§4.4)

/**
 * Les deux populations qui obeissent (DESIGN.md §4.4).
 *
 * **Rien ne distingue plus un heros d'un habitant du point de vue des ordres**
 * — seulement de ce qu'il sait faire. C'est tout ce que ce type dit : quelles
 * lignes du menu ont un sens pour celui qu'on a selectionne. Le commandement,
 * lui, n'en connait qu'une seule liste.
 */
export type Population = "civil" | "combattant";

/**
 * Ce qu'on peut demander a quelqu'un.
 *
 * ⚠️ **Le menu montre tout**, meme ce qui ne sert pas maintenant : c'est la
 * raison pour laquelle le §4.4 a ecarte le clic droit contextuel. Avec une
 * quinzaine de taches et d'autres qui s'ajoutent a chaque jalon, deviner ce
 * qu'une cible declenche est un pari qu'on perd.
 */
export type TacheId =
  | `poste-${Metier}`
  | "civil-travail"
  | "civil-prudent"
  | "civil-abri"
  | "posture-temporiser"
  | "posture-agressif"
  | "posture-repli"
  | "suivre"
  | "rompez"
  | "entrainer"
  | "rituel";

/** Les quatre paquets du menu, dans l'ordre ou ils s'affichent. */
export type GroupeTache = "travail" | "civil" | "combat" | "moi" | "don";

export interface TacheDef {
  id: TacheId;
  libelle: string;
  groupe: GroupeTache;
  /** A qui elle s'adresse ; `tous` quand les deux populations la comprennent */
  pour: Population | "tous";
  /** Le metier vise, pour une tache de travail */
  metier?: Metier;
  /** La posture visee, quand c'en est une */
  posture?: Posture;
  postureCivile?: PostureCivile;
}

/**
 * Ce qu'un metier donne comme ligne de menu.
 *
 * Le libelle dit **ce qu'il va faire**, pas le nom du metier : « Couper du
 * bois » se comprend d'un coup d'oeil la ou « Bucheron » demande de traduire.
 */
const LIBELLE_TRAVAIL: Record<Metier, string> = {
  pecheur: "Aller pecher",
  bucheron: "Couper du bois",
  mineur: "A la mine",
  fermier: "Aux champs",
  forgeron: "A la forge",
  charpentier: "A l'atelier",
  guetteur: "Tenir une tour",
  milicien: "Prendre les armes",
};

const METIERS_DU_MENU: Metier[] = [
  "pecheur",
  "bucheron",
  "mineur",
  "fermier",
  "forgeron",
  "charpentier",
  "guetteur",
  "milicien",
];

/**
 * Le catalogue complet, dans l'ordre du menu.
 *
 * **Le travail passe en premier** : c'est ce qu'on vient demander neuf fois sur
 * dix. Les conduites viennent ensuite — ce sont des reglages, pas des ordres —
 * et « me suivre » ferme la liste parce que c'est le seul qui deplace vraiment
 * quelqu'un.
 */
export const TACHES: TacheDef[] = [
  ...METIERS_DU_MENU.map<TacheDef>((metier) => ({
    id: `poste-${metier}` as TacheId,
    libelle: LIBELLE_TRAVAIL[metier],
    groupe: "travail",
    // Un heros affecte a un poste produit beaucoup plus vite qu'un habitant,
    // seulement le jour, et ca le fatigue (§4.4).
    pour: "tous",
    metier,
  })),
  { id: "civil-travail", libelle: "Au travail", groupe: "civil", pour: "civil", postureCivile: "travail" },
  { id: "civil-prudent", libelle: "Prudent", groupe: "civil", pour: "civil", postureCivile: "prudent" },
  { id: "civil-abri", libelle: "A l'abri", groupe: "civil", pour: "civil", postureCivile: "abri" },
  { id: "posture-temporiser", libelle: "Temporiser", groupe: "combat", pour: "combattant", posture: "temporiser" },
  { id: "posture-agressif", libelle: "Agressif", groupe: "combat", pour: "combattant", posture: "agressif" },
  { id: "posture-repli", libelle: "Repli", groupe: "combat", pour: "combattant", posture: "repli" },
  { id: "suivre", libelle: "Me suivre", groupe: "moi", pour: "tous" },
  { id: "rompez", libelle: "Rompez", groupe: "moi", pour: "tous" },
  // Les deux voies que le joueur **choisit** (§4.1). La troisieme — le danger
  // de mort — ne se commande pas : c'est ce qui en fait la voie noble.
  { id: "entrainer", libelle: "L'entrainer", groupe: "don", pour: "civil" },
  { id: "rituel", libelle: "Le rituel", groupe: "don", pour: "civil" },
];

const PAR_ID = new Map(TACHES.map((t) => [t.id, t]));

export function tache(id: TacheId): TacheDef | null {
  return PAR_ID.get(id) ?? null;
}

/**
 * Ce que le menu affiche pour une selection donnee.
 *
 * Une selection **melangee** — un rectangle prend les heros et les villageois
 * ensemble (§4.4) — voit l'union des deux vocabulaires, et chaque ligne ne
 * s'applique qu'a ceux qui la comprennent. Cacher ce qui ne vaut que pour la
 * moitie de la selection obligerait a selectionner deux fois.
 */
export function tachesPour(populations: Iterable<Population>): TacheDef[] {
  const presentes = new Set(populations);
  if (presentes.size === 0) return [];
  return TACHES.filter((t) => t.pour === "tous" || presentes.has(t.pour));
}

/** Le nom du metier derriere une tache de travail, pour les annonces. */
export function metierDe(id: TacheId): Metier | null {
  return PAR_ID.get(id)?.metier ?? null;
}

/** « Bucheron », pour le journal — le menu, lui, dit ce qu'on va faire. */
export function nomDuMetier(metier: Metier): string {
  return NOMS_METIER[metier];
}
