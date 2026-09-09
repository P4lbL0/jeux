/**
 * Le cycle jour/nuit (DESIGN.md §4.19).
 *
 * Le jeu ne s'organise plus en "phase de village" et "vague", mais en journees.
 * Le jour on produit, on repare, on accueille ; la nuit on encaisse un effectif
 * defini d'avance. Le coucher de soleil est l'annonce que le §4.6 exigeait — un
 * ciel qui baisse ne peut pas etre manque.
 *
 * Ce fichier ne connait pas Phaser : tout y est du temps en millisecondes et des
 * fonctions pures, donc tout se teste sans lancer le moteur.
 */

export type Phase = "jour" | "nuit";

/** Ce qui vient de changer a l'instant, s'il s'est passe quelque chose. */
export type Bascule = "aube" | "crepuscule" | null;

const MINUTE = 60_000;

/**
 * **LA table de reglages.** C'est le seul endroit a toucher pour changer le
 * rythme du jeu.
 *
 * Le §5 de DESIGN.md le dit : le bloc 2 du jalon 5 porte tout le risque du
 * jalon, et la question "30 minutes de jour et 15 de nuit, est-ce le bon
 * chiffre ?" a ete tranchee le 9 septembre 2026 : c'etait non. On est passe a
 * 10 + 5, parce qu'aucun chiffre du jeu — stress, eglise, port, arrivees —
 * n'avait jamais pu etre mesure faute d'une partie assez longue pour en voir
 * l'effet. Le reste se re-regle ici aussi. Elle doit donc se re-regler sans lire
 * une ligne de code — d'ou cette table, et d'ou le fait que rien ailleurs
 * n'ecrive une duree en dur.
 */
export const REGLAGES_CYCLE = {
  /** Duree d'un jour, en millisecondes */
  jour: 10 * MINUTE,
  /** Duree d'une nuit, en millisecondes */
  nuit: 5 * MINUTE,

  /**
   * Monstres de la premiere nuit, puis ce que chaque nuit ajoute.
   *
   * Volontairement bas : le §4.17 interdit de faire monter la difficulte par le
   * nombre, et l'ancienne vague sans fin en crachait des centaines. Ce qui monte
   * vraiment d'une nuit a l'autre, c'est `puissanceParNuit`.
   */
  effectifPremiereNuit: 30,
  effectifParNuit: 12,

  /**
   * De combien la puissance des monstres monte a chaque nuit.
   *
   * Cale sur les seuils de `ennemis.ts` : a 0,9 par nuit, la nuee arrive la
   * nuit 2, le revenant la nuit 3, le cracheur la 4, la brute la 5 et le
   * kamikaze la 6. Une espece nouvelle par nuit pendant six nuits, sans qu'on
   * ait a ecrire ce calendrier nulle part.
   */
  puissanceParNuit: 0.9,

  /**
   * Part de la nuit pendant laquelle les monstres arrivent.
   *
   * Le reste est le silence de fin de nuit : quand l'effectif est epuise et que
   * le dernier tombe, plus rien ne vient. C'est la recompense du §4.19 — avoir
   * nettoye vite se paie en temps libre, et ca ne coute aucune ligne
   * d'equilibrage.
   */
  partArrivees: 0.65,

  /**
   * Plafond de monstres vivants a l'ecran.
   *
   * Il valait 240. Le §4.17 en fait une regle de fluidite, mais c'est aussi une
   * regle de lisibilite : a 240 on ne voit plus le terrain qu'on defend.
   */
  plafondEcran: 60,

  /**
   * Ecart entre deux hordes de jour, en millisecondes (tire entre les deux).
   *
   * Cale sur la duree du jour : il en faut deux a cinq par journee, sinon le
   * jour redevient le temps mort que le §4.19 refuse. Valait 6-12 minutes quand
   * le jour en durait 30 ; il en dure 10 depuis le 9 septembre 2026.
   */
  hordeMin: 2 * MINUTE,
  hordeMax: 4 * MINUTE,

  /** Monstres de la premiere horde de jour, puis ce que chaque jour ajoute */
  hordePremierJour: 5,
  hordeParJour: 1.5,

  /**
   * Preavis d'une horde, en millisecondes.
   *
   * Assez pour rappeler un heros ou sonner la cloche, trop peu pour tout
   * reorganiser (§4.19). Un preavis d'une minute en referait une petite nuit
   * previsible ; aucun preavis en ferait un coup du sort.
   */
  preavisHorde: 6_000,
};

/**
 * L'horloge de la partie.
 *
 * Elle ne sait rien du jeu : on lui pousse des millisecondes, elle dit ou on en
 * est et ce qui vient de basculer. C'est ce qui permet de la tester au
 * millieme de seconde pres sans faire tourner une partie de 45 minutes.
 */
export class Cycle {
  /** Le numero de la journee en cours, a partir de 1 */
  jour = 1;
  phase: Phase = "jour";
  /** Temps ecoule dans la phase en cours, en millisecondes */
  ecoule = 0;

  /**
   * @param delta millisecondes ecoulees depuis l'appel precedent
   * @returns la bascule qui vient de se produire, ou null
   */
  avancer(delta: number): Bascule {
    this.ecoule += delta;
    const duree = this.duree;
    if (this.ecoule < duree) return null;

    // Le report evite qu'une image longue ne fasse perdre du temps de jeu.
    this.ecoule -= duree;

    if (this.phase === "jour") {
      this.phase = "nuit";
      return "crepuscule";
    }

    this.phase = "jour";
    this.jour += 1;
    return "aube";
  }

  /** Duree de la phase en cours, en millisecondes */
  get duree(): number {
    return this.phase === "jour" ? REGLAGES_CYCLE.jour : REGLAGES_CYCLE.nuit;
  }

  /** Avancement dans la phase en cours, entre 0 et 1 */
  get part(): number {
    return Math.min(1, this.ecoule / this.duree);
  }

  /** Temps restant avant la bascule, en millisecondes */
  get restant(): number {
    return Math.max(0, this.duree - this.ecoule);
  }

  /**
   * Le numero de la nuit en cours ou a venir.
   *
   * La nuit N tombe a la fin du jour N : les deux portent donc le meme numero,
   * et "nuit 5" veut dire la meme chose partout.
   */
  get nuit(): number {
    return this.jour;
  }
}

/**
 * Combien de monstres la nuit N envoie en tout.
 *
 * Un effectif, pas un robinet : c'est ce qui permet a la nuit de se terminer
 * avant l'aube, et donc a la recompense du §4.19 d'exister.
 */
export function effectifDeLaNuit(nuit: number): number {
  return Math.round(
    REGLAGES_CYCLE.effectifPremiereNuit + (nuit - 1) * REGLAGES_CYCLE.effectifParNuit,
  );
}

/**
 * La puissance des monstres de la nuit N.
 *
 * C'est le meme scalaire qu'avant — celui qui calcule les statistiques et qui
 * ouvre les archetypes — mais il ne depend plus du temps ecoule depuis le debut
 * de la partie. Une nuit a desormais une difficulte, pas une horloge.
 */
export function puissanceDeLaNuit(nuit: number): number {
  return (nuit - 1) * REGLAGES_CYCLE.puissanceParNuit;
}

/**
 * L'ecart entre deux apparitions, pour que l'effectif tombe en `partArrivees`.
 *
 * @returns un intervalle en millisecondes, jamais nul
 */
export function intervalleDeLaNuit(nuit: number): number {
  const fenetre = REGLAGES_CYCLE.nuit * REGLAGES_CYCLE.partArrivees;
  return Math.max(200, fenetre / effectifDeLaNuit(nuit));
}

/** Combien de monstres une horde de jour amene, le jour N. */
export function tailleDeLaHorde(jour: number): number {
  return Math.round(
    REGLAGES_CYCLE.hordePremierJour + (jour - 1) * REGLAGES_CYCLE.hordeParJour,
  );
}

/**
 * Dans combien de temps la prochaine horde, a partir de maintenant.
 *
 * @param tirage aleatoire dans [0,1) ; injecte pour rester pur et testable
 */
export function delaiProchaineHorde(tirage: number): number {
  const { hordeMin, hordeMax } = REGLAGES_CYCLE;
  return hordeMin + tirage * (hordeMax - hordeMin);
}
