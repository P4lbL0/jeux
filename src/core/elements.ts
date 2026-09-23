/**
 * Les six bases elementaires (DESIGN.md §4.13, §4.25 — jalon 6.5, morceau 2b).
 *
 * Boule de feu, Vent, Eau, Nature, Bouclier, Teleportation. Elles n'existaient
 * pas, et sans elles dix des vingt-six fusions etaient incodables.
 *
 * **Tranche le 23 septembre 2026 par Angelos** : la Boule de feu, le Vent,
 * l'Eau et la Nature **partent toutes seules** — pas de touche, aucun des
 * emplacements d'actives. Ce sont des ingredients : un Vent qui couterait une
 * des quatre touches ne serait jamais pris, et les fusions n'arriveraient pas.
 * Le Bouclier est permanent, la Teleportation reste sur une touche. Et
 * **« mouille » ne fait rien seul** : il se voit, et ce sont l'Orage conducteur,
 * le Maitre de l'orage et la synergie Tempete qui s'en serviront.
 *
 * ⚠️ **Tous les chiffres de ce fichier sont tranches par le code**, a regler en
 * jouant — aucun n'a ete soumis.
 *
 * Ce fichier ne connait pas Phaser.
 */

/** La valeur d'un palier (1, 2, 3...) dans un tableau qui en donne une par palier. */
export function auPalier<T>(valeurs: readonly T[], palier: number): T {
  const i = Math.min(valeurs.length, Math.max(1, Math.floor(palier))) - 1;
  return valeurs[i]!;
}

export const BASES = {
  /** Toute seule, sur le monstre le plus proche ; elle eclate au premier contact. */
  bouleDeFeu: {
    /** Elle ne part que si un monstre est a portee : jamais dans le vide. */
    portee: 320,
    /** En pixels par seconde : assez lente pour qu'on la voie voler. */
    vitesse: 300,
    /** Ses degats, en multiple de ceux du heros. */
    degats: [1.5, 1.8, 2.1],
    /** Le rayon de l'explosion — c'est une ZONE : Expansion l'elargit. */
    rayon: [44, 52, 60],
  },
  /** Toute seule, vers le groupe le plus serre : elle repousse et emporte ce qui traine au sol. */
  vent: {
    portee: 260,
    /** Jusqu'ou le souffle porte. */
    longueur: [220, 260, 300],
    /** La moitie de sa largeur — une ZONE : Expansion l'elargit. */
    demiLargeur: [40, 46, 52],
    /** La vitesse imprimee a un monstre, divisee par sa taille pour un geant (§4.33). */
    force: [300, 340, 380],
    /** Combien de temps la poussee l'emporte sur sa marche, en ms. */
    tenue: 180,
    /** La vitesse du front, en pixels par seconde. */
    vitesse: 650,
    /** « Le Vent ne fait presque rien tant qu'il n'a pas de feu a pousser » : un effleurement. */
    degats: 0.4,
  },
  /** Toute seule, sous le groupe le plus serre : on y est ralenti, on en sort mouille. */
  eau: {
    portee: 240,
    rayon: [48, 56, 64],
    /** Combien de temps la flaque reste au sol — ce qui aide : Concentration l'allonge. */
    duree: [6000, 8000, 10000],
    /** La part de vitesse gardee dans la flaque. */
    ralenti: 0.6,
    /** Combien de temps un monstre reste mouille apres en etre sorti. */
    mouille: 4000,
    /** Tous les combien la flaque regarde qui est dedans, en ms. */
    battement: 250,
  },
  /** Toute seule, sous le groupe le plus serre : les racines les tiennent sur place. */
  nature: {
    portee: 220,
    rayon: [50, 60, 70],
    /** Combien de temps ils restent pris — ce qui aide : Concentration l'allonge. */
    tenue: [1500, 2000, 2500],
    /**
     * Un geant n'est jamais cloue au sol, il est ralenti (la regle de
     * l'etourdissement, §4.13) : la part de vitesse qu'il garde.
     */
    ralentiDesGeants: 0.5,
    /** Au-dela, les monstres sont tenus mais leurs racines ne se dessinent pas (§4.17). */
    racinesDessinees: 40,
  },
  /** Permanent : un ecran qui encaisse a sa place, se reforme, et se brise bruyamment. */
  bouclier: {
    /** Ce qu'il absorbe, en part de la vie maximale, cumule par palier. */
    part: [0.2, 0.1, 0.1],
    /** Brise, il revient au bout de... (ms) */
    retour: [10000, 8000, 6000],
    /** Entame, il se reforme quand on le laisse souffler autant (ms). */
    souffle: 4000,
  },
  /** Sur une touche : un saut court et instantane, sans degats. */
  teleportation: {
    distance: [160, 200, 240],
    /** Le temps de reapparaitre, en ms. */
    invulnerable: 250,
  },
} as const;

// ------------------------------------------------------------------ le bouclier

/**
 * L'ecran du Bouclier. Il tient en trois nombres et un drapeau, sans minuterie :
 * la scene le compare a l'horloge une fois par image.
 */
export interface EtatBouclier {
  /** Ce qu'il peut encore encaisser. */
  pv: number;
  /** Brise : il ne revient qu'a `revientA`, quoi qu'il arrive entre-temps. */
  brise: boolean;
  revientA: number;
  /** L'instant du dernier coup : entame, il se reforme `souffle` ms apres. */
  dernierCoup: number;
}

export function bouclierNeuf(): EtatBouclier {
  // Aucun coup encore : le premier passage de la scene le remplit aussitot.
  return { pv: 0, brise: false, revientA: 0, dernierCoup: -Infinity };
}

/**
 * Un coup arrive : l'ecran en prend ce qu'il peut, et rend ce qui passe au
 * travers. A zero, il se brise, et ne reviendra qu'au bout de `retour`.
 */
export function absorber(etat: EtatBouclier, degats: number, maintenant: number, retour: number): number {
  etat.dernierCoup = maintenant;
  if (etat.brise || etat.pv <= 0 || degats <= 0) return degats;
  const pris = Math.min(etat.pv, degats);
  etat.pv -= pris;
  if (etat.pv <= 0) {
    etat.pv = 0;
    etat.brise = true;
    etat.revientA = maintenant + retour;
  }
  return degats - pris;
}

/** Ce qui vient de se passer quand on regarde l'ecran : il revient, il se referme, ou rien. */
export type Reforme = "revenu" | "rempli" | null;

/**
 * Une image : l'ecran revient s'il etait brise et que son heure est passee, ou
 * se referme s'il etait entame et qu'on l'a laisse souffler.
 *
 * @param max ce qu'il absorbe plein — une part de la vie maximale, qui bouge
 */
export function reformer(
  etat: EtatBouclier,
  max: number,
  maintenant: number,
  souffle: number = BASES.bouclier.souffle,
): Reforme {
  if (max <= 0) {
    etat.pv = 0;
    etat.brise = false;
    return null;
  }
  if (etat.brise) {
    if (maintenant < etat.revientA) return null;
    etat.brise = false;
    etat.pv = max;
    return "revenu";
  }
  if (etat.pv > max) {
    etat.pv = max;
    return null;
  }
  if (etat.pv < max && maintenant - etat.dernierCoup >= souffle) {
    etat.pv = max;
    return "rempli";
  }
  return null;
}

/** Le jeu s'est fige pour un choix : le temps de menu ne recharge pas l'ecran. */
export function decalerBouclier(etat: EtatBouclier, millisecondes: number): void {
  etat.revientA += millisecondes;
  etat.dernierCoup += millisecondes;
}

// ---------------------------------------------------------------------- le vent

/**
 * Ou tombe un point dans le couloir d'une bourrasque : la distance qu'il a devant
 * lui depuis le depart du souffle, ou null s'il est derriere, trop loin, ou sur
 * le cote.
 *
 * @param dx, dy la direction du souffle, **unitaire**
 */
export function dansLeSouffle(
  px: number,
  py: number,
  ox: number,
  oy: number,
  dx: number,
  dy: number,
  longueur: number,
  demiLargeur: number,
): number | null {
  const rx = px - ox;
  const ry = py - oy;
  const avance = rx * dx + ry * dy;
  if (avance < 0 || avance > longueur) return null;
  const ecart = Math.abs(rx * dy - ry * dx);
  return ecart <= demiLargeur ? avance : null;
}
