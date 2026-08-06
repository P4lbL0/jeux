import type { EtatHero } from "./classes";

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
 * Au jalon 4, le joueur pourra lui donner des ordres — position, posture,
 * formation (DESIGN.md §4.4). Pour l'instant elle applique le comportement par
 * defaut de la classe.
 */

export interface Vecteur {
  x: number;
  y: number;
}

/** Au-dela de cette distance de la cite, un heros IA revient : il la defend. */
export const LAISSE = 430;

/** Part de vie a partir de laquelle un heros soigne repart au combat */
export const SEUIL_RETOUR = 0.7;

/** Nombre d'ennemis autour qui declenche un ultime */
export const ENNEMIS_POUR_ULTIME = 3;

/** Ce dont l'IA a besoin pour decider. Un Hero satisfait cette forme. */
export interface HeroPilote {
  x: number;
  y: number;
  etat: EtatHero;
  ratioPv: number;
  portee: number;
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

  if (hero.etat === "mort") return immobile;

  // 1. Repli : rien d'autre ne compte.
  if (hero.etat === "repli") {
    return { direction: normaliser(versCite), lancerUltime: false };
  }

  // 2. A l'abri dans la cite : il se soigne tant qu'il n'est pas remis.
  if (hero.etat === "cite" && hero.ratioPv < SEUIL_RETOUR) return immobile;

  const cible = ctx.ennemiLePlusProche(hero.x, hero.y, 1000);

  // 3. Rien a combattre : il retourne monter la garde autour de la cite.
  if (!cible) {
    return {
      direction: distanceCite > ctx.cite.rayon ? normaliser(versCite) : { x: 0, y: 0 },
      lancerUltime: false,
    };
  }

  // 4. Trop loin de la cite : il la defend, il ne part pas a l'aventure.
  if (distanceCite > LAISSE) {
    return { direction: normaliser(versCite), lancerUltime: false };
  }

  // 5. Combat : tenir la distance ideale de sa classe.
  const versCible = { x: cible.x - hero.x, y: cible.y - hero.y };
  const distance = longueur(versCible);
  const ideale = distanceIdeale(hero);

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
    lancerUltime: ctx.nombreEnnemisAutour(hero.x, hero.y, 110) >= ENNEMIS_POUR_ULTIME,
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
