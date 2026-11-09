/**
 * La cadence des images (jalon 6.4, étape 2, 9 novembre 2026).
 *
 * Phaser dessine une image à chaque `requestAnimationFrame`, donc au rythme de l'écran — et
 * Chrome sous Windows cale toutes ses fenêtres sur l'écran **principal** : chez Angelos, un
 * écran à 240 Hz. Mesuré sans limite d'écran le 9 novembre (`.tmp/cadence-mesure.mjs`) :
 * l'écran-titre dessinait 2 355 images par seconde, la partie 309, la pause 340, la fenêtre
 * en arrière-plan 339 — le fil principal occupé à 99 %, 2,5 à 3,5 cœurs de processeur.
 * C'est la cause qui faisait chauffer BELLEVUE, l'autre jeu d'Angelos, le 29 octobre ; la
 * même règle y tourne (`src/lib/cadence.ts` de The Circle).
 *
 * La limite de Phaser (`fps.limit`) ne convient pas : elle remet son compteur à zéro à chaque
 * image dessinée et n'accorde aucune marge. Sur un écran à 60 Hz, une image qui arrive 0,1 ms
 * trop tôt saute ; à 240 Hz, on tombe vers 48 images par seconde au lieu de 60.
 */

/** Une image toutes les 1/60 s au plus : quand on joue. */
export const PAS_60 = 1000 / 60;
/** 30 images par seconde : les menus, la pause, les fenêtres de choix. */
export const PAS_30 = 2 * PAS_60;
/** 5 images par seconde : la fenêtre n'a plus le focus (le jeu est déjà en pause). */
export const PAS_HORS_FOCUS = 200;
/**
 * 10 images par seconde : le robot qui joue accéléré (jalon 6.4). Personne ne regarde, et
 * toutes les parties d'une série passent par **un seul** processus graphique de Chromium :
 * à 60 images chacune, c'était lui qui plafonnait la série (~185 secondes de jeu par seconde
 * réelle, qu'on lance 6 ou 10 parties à la fois — mesuré le 9 novembre 2026).
 */
export const PAS_ROBOT = 100;

/**
 * Tri des images d'une boucle `requestAnimationFrame` : `true` quand l'heure prévue est
 * atteinte, **à 2 ms près** (un écran à 60 Hz n'en saute aucune ; à 75, 144 ou 240 Hz, la
 * cadence voulue est gardée en moyenne). `pas` (ms) peut changer d'une image à l'autre :
 * s'il baisse (retour au premier plan, reprise de la partie), l'image suivante part sans
 * attendre.
 */
export function creerCadence(): (t: number, pas?: number) => boolean {
  let prochaine = 0;
  return (t, pas = PAS_60) => {
    if (prochaine > t + pas) prochaine = t;
    if (t < prochaine - 2) return false;
    prochaine += pas;
    // Plus d'une image de retard (départ, onglet revenu, machine lente) : on repart d'ici.
    if (prochaine < t) prochaine = t + pas;
    return true;
  };
}

/** Ce que la cadence a besoin de savoir du jeu, à chaque battement. */
export interface EtatDeLaCadence {
  /** La fenêtre a le focus (les événements `BLUR` / `FOCUS` de Phaser). */
  auPremierPlan: boolean;
  /** L'arène tourne : pas en pause, ou en mode d'aménagement, qu'on manie à la souris. */
  partieQuiTourne: boolean;
  /** Le robot joue la partie en accéléré : on dessine juste assez pour la capture de fin. */
  accelere?: boolean;
}

/**
 * Le pas voulu : 60 images par seconde quand on joue ou qu'on aménage, 30 dans les menus, la
 * pause et les fenêtres de choix (le décor y est figé), 5 hors du premier plan. Les mêmes
 * chiffres que BELLEVUE, choisis par Angelos le 29 octobre 2026. Le robot accéléré : 10.
 */
export function pasVoulu(etat: EtatDeLaCadence): number {
  if (etat.accelere) return PAS_ROBOT;
  if (!etat.auPremierPlan) return PAS_HORS_FOCUS;
  return etat.partieQuiTourne ? PAS_60 : PAS_30;
}
