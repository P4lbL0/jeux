import type { EtatHero } from "./classes";
import { LAISSE, ORDRE_PAR_DEFAUT, REGLAGES, TOLERANCE_ANCRE, type Ordre, type Point } from "./ordres";

/**
 * L'IA qui joue les heros que le joueur n'incarne pas (DESIGN.md §4.3).
 *
 * Deux regles la gouvernent :
 *
 * 1. **Elle ne perd jamais un heros.** Des qu'un heros passe au seuil critique,
 *    elle decroche et rentre a la cite, sans discuter.
 * 2. **Elle ne choisit jamais une amelioration.** Elle fait monter le heros de
 *    niveau, et les choix attendent le joueur.
 *
 * Elle joue chaque classe a *sa* distance : c'est ce qui rend une equipe
 * lisible a l'ecran. Le mage recule pendant que le chevalier avance.
 *
 * Ce fichier ne connait pas Phaser : c'est une fonction pure, donc testable
 * sans lancer le jeu. La garantie « l'IA ne perd jamais un heros » merite
 * d'etre verifiee autrement qu'a l'oeil.
 *
 * Le joueur la commande par des ordres (DESIGN.md §4.4). Un ordre ne remplace
 * jamais cette logique : il en regle les chiffres, et il ne peut rien contre le
 * repli des 20%.
 */

export interface Vecteur {
  x: number;
  y: number;
}

export { LAISSE };

/** Part de vie a partir de laquelle un heros soigne repart au combat */
export const SEUIL_RETOUR = 0.7;

/** Nombre d'ennemis autour qui declenche un ultime, en posture par defaut */
export const ENNEMIS_POUR_ULTIME = REGLAGES.temporiser.ennemisPourCapacite;

/** Ce dont l'IA a besoin pour decider. Un Hero satisfait cette forme. */
export interface HeroPilote {
  x: number;
  y: number;
  etat: EtatHero;
  ratioPv: number;
  portee: number;
  /** Ne sort jamais de la cite : le Necromancien laisse ses morts se battre */
  resteEnCite?: boolean;
  /** L'ordre en cours ; absent, il temporise autour de la cite */
  ordre?: Ordre;
  /** Sa place dans la formation, si l'equipe en tient une (DESIGN.md §4.4) */
  poste?: Point | null;
}

export interface ContexteIA {
  cite: { x: number; y: number; rayon: number };
  ennemiLePlusProche(x: number, y: number, portee: number): Vecteur | null;
  nombreEnnemisAutour(x: number, y: number, rayon: number): number;
}

export interface DecisionIA {
  /** Direction normalisee, ou vecteur nul pour rester sur place */
  direction: Vecteur;
  lancerUltime: boolean;
}

export function piloter(hero: HeroPilote, ctx: ContexteIA): DecisionIA {
  const immobile = { direction: { x: 0, y: 0 }, lancerUltime: false };
  const versCite = { x: ctx.cite.x - hero.x, y: ctx.cite.y - hero.y };
  const distanceCite = longueur(versCite);
  const ordre = hero.ordre ?? ORDRE_PAR_DEFAUT;

  if (hero.etat === "mort") return immobile;

  // 1. Repli : rien d'autre ne compte. Aucune posture ne peut l'annuler — c'est
  //    la garantie que l'IA ne perd jamais un heros (DESIGN.md §4.3 et §4.4).
  if (hero.etat === "repli" || ordre.posture === "repli") {
    if (hero.etat === "cite") return immobile;
    return { direction: normaliser(versCite), lancerUltime: false };
  }

  // 2. Le Necromancien ne sort jamais. Il rentre s'il est dehors, sinon il
  //    attend au milieu des siens.
  if (hero.resteEnCite) {
    return {
      direction: distanceCite > ctx.cite.rayon * 0.6 ? normaliser(versCite) : { x: 0, y: 0 },
      lancerUltime:
        ctx.nombreEnnemisAutour(hero.x, hero.y, 400) >= REGLAGES[ordre.posture].ennemisPourCapacite,
    };
  }

  // 3. A l'abri dans la cite : il se soigne tant qu'il n'est pas remis.
  if (hero.etat === "cite" && hero.ratioPv < SEUIL_RETOUR) return immobile;

  // 4. Ou il se tient. Son poste de formation prime sur l'ancre qu'on lui a
  //    donnee, qui prime sur la cite.
  const reglage = REGLAGES[ordre.posture];
  const ancre = hero.poste ?? ordre.ancre ?? ctx.cite;
  const tolerance = hero.poste || ordre.ancre ? TOLERANCE_ANCRE : ctx.cite.rayon;
  const versAncre = { x: ancre.x - hero.x, y: ancre.y - hero.y };
  const distanceAncre = longueur(versAncre);

  const cible = ctx.ennemiLePlusProche(hero.x, hero.y, 1000);

  // 5. Rien a combattre : il retourne tenir sa place.
  if (!cible) {
    return {
      direction: distanceAncre > tolerance ? normaliser(versAncre) : { x: 0, y: 0 },
      lancerUltime: false,
    };
  }

  // 6. Trop loin de son ancre : il la tient, il ne part pas a l'aventure.
  if (distanceAncre > reglage.laisse) {
    return { direction: normaliser(versAncre), lancerUltime: false };
  }

  // 7. Combat : tenir la distance ideale de sa classe, resserree en agressif.
  const versCible = { x: cible.x - hero.x, y: cible.y - hero.y };
  const distance = longueur(versCible);
  const ideale = distanceIdeale(hero) * reglage.distance;

  let direction: Vecteur;
  if (distance > ideale * 1.15) {
    direction = normaliser(versCible); // se rapprocher
  } else if (distance < ideale * 0.7) {
    direction = normaliser({ x: -versCible.x, y: -versCible.y }); // reculer
  } else {
    // A bonne distance : contourner plutot que de se figer. Un heros immobile
    // se fait encercler, et c'est laid a regarder.
    direction = normaliser({ x: -versCible.y, y: versCible.x });
  }

  return {
    direction,
    lancerUltime: ctx.nombreEnnemisAutour(hero.x, hero.y, 110) >= reglage.ennemisPourCapacite,
  };
}

/**
 * La distance a laquelle une classe veut se tenir. Les combattants au contact
 * collent leur cible ; les distants se tiennent juste dans leur portee, ce qui
 * les rend visiblement craintifs a l'ecran.
 */
export function distanceIdeale(hero: Pick<HeroPilote, "portee">): number {
  return hero.portee <= 90 ? hero.portee * 0.55 : hero.portee * 0.85;
}

function longueur(v: Vecteur): number {
  return Math.hypot(v.x, v.y);
}

function normaliser(v: Vecteur): Vecteur {
  const l = longueur(v);
  return l === 0 ? { x: 0, y: 0 } : { x: v.x / l, y: v.y / l };
}
