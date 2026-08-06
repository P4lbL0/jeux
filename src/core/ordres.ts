import type { Role } from "./classes";

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
