import type { Phase } from "./cycle";
import type { Rng } from "./rng";

/**
 * Le temps qu'il fait (DESIGN.md §4.21).
 *
 * **Le premier morceau du jalon 6**, et celui qui porte la plomberie : l'orage,
 * l'incendie et le meteore viendront se brancher ici plutot que d'inventer
 * chacun leur horloge.
 *
 * Elle ne sait rien du jeu : on lui pousse une graine une fois par journee,
 * elle dit le temps qu'il fait et ce que ca change. Comme le cycle (§4.19),
 * tout y est pur, donc tout se teste sans faire tourner une partie de 45
 * minutes.
 *
 * Le principe tient en deux phrases : **deux journees de pluie sont un cadeau,
 * la troisieme est l'addition** — et **un orage est une pluie qui se retourne
 * contre vous**.
 */

export type Temps = "sec" | "pluie" | "orage";

/**
 * **LA table de reglages du ciel.** Seul endroit a toucher pour changer le
 * temps qu'il fait, comme `REGLAGES_CYCLE` pour le rythme.
 */
export const REGLAGES_METEO = {
  /**
   * La chance qu'une journee soit pluvieuse, tiree a l'aube.
   *
   * Un tiers (Angelos, 22 septembre 2026) : assez pour qu'on en voie une par
   * partie courte, assez rare pour qu'elle reste une bonne nouvelle.
   */
  chancePluie: 1 / 3,
  /**
   * Le nombre de journees pluvieuses d'affilee qui declenche la **crue**.
   *
   * A un tiers, trois d'affilee tombent environ une fois toutes les vingt-sept
   * journees : un evenement, pas un rythme. Et on le voit venir de deux
   * journees, ce que le §4.17 exige de tout ce qui fait mal.
   */
  journeesPourLaCrue: 3,
  /**
   * La part des journees pluvieuses qui tournent a l'**orage**.
   *
   * Un quart (Angelos, 22 septembre 2026), soit environ une journee sur douze.
   * L'orage mouille comme la pluie — il compte donc pour la crue — mais il ne
   * cesse pas a midi : il tient jusqu'au bout de la nuit, sinon « les monstres
   * sont plus forts la nuit » ne se verrait nulle part.
   */
  partDOrage: 1 / 4,
  /** Ce que la pluie fait aux champs : ils murissent deux fois plus vite */
  pousseSousLaPluie: 2,
  /**
   * A quel moment de la journee l'averse cesse, en part de la journee.
   *
   * Une pluie normale mouille la matinee et s'arrete un peu apres le milieu du
   * jour : le cadeau est reel, mais il ne dure pas toute la journee. **Le jour
   * de crue fait exception** : ce jour-la, ca ne s'arrete plus.
   */
  finDeLAverse: 0.55,
  /**
   * Ce que la pluie fait a un feu : il s'eteint deux fois plus vite (§4.21,
   * l'incendie). Rien ne brule encore — la regle est posee maintenant pour
   * qu'il n'y ait pas a revenir dans le ciel quand le feu arrivera.
   */
  extinctionSousLaPluie: 2,

  // ------------------------------------------------------------- l'orage

  /**
   * Ce que la nuit d'orage ajoute a l'effectif, en part.
   *
   * ⚠️ **C'est la seule entorse consentie a la regle n°2 du §4.17** (« la
   * difficulte monte par la force, pas par le nombre »), et elle est bornee :
   * l'effectif d'une nuit monte de moitie, **le plafond technique a l'ecran ne
   * bouge pas**. Ce plafond a ete ecrit apres que le jeu se soit mis a ramer,
   * et celui-la ne se negocie pas (Angelos, 22 septembre 2026 : « plus
   * nombreux et plus forts »).
   */
  effectifDOrage: 1.5,
  /**
   * Ce que la nuit d'orage ajoute a la puissance, en nuits d'avance.
   *
   * Deux nuits : on se bat contre les monstres d'apres-demain. C'est le levier
   * que le §4.21 appelle « le meilleur du jeu » — les memes betes, en pire.
   */
  nuitsDAvanceEnOrage: 2,
  /** Entre deux eclairs pendant un orage, en millisecondes (tire entre les deux) */
  eclairMin: 8_000,
  eclairMax: 25_000,
  /**
   * La chance qu'un eclair mette le feu quelque part (§4.21, l'incendie).
   *
   * **Rare, et c'est le mot d'Angelos** : un eclair sur vingt, soit environ un
   * depart de feu toutes les trois ou quatre nuits d'orage. Assez pour que ca
   * arrive, assez peu pour que ce soit la mecanique de l'orage.
   */
  chanceIncendieParEclair: 0.05,
};

/** Ce que la sauvegarde garde du ciel (§4.28). */
export interface EtatMeteo {
  temps: Temps;
  /** Journees pluvieuses d'affilee, celle en cours comprise */
  journeesPluvieuses: number;
}

/**
 * Le ciel d'une partie.
 *
 * Une instance par partie, avancee **une fois par journee** a l'aube — jamais
 * par image. C'est un tirage : le rejouer a chaque image consommerait la graine
 * et rendrait le temps illisible (meme raison qu'au §4.6 pour les fronts).
 */
export class Meteo {
  temps: Temps = "sec";
  /** Journees pluvieuses d'affilee, celle en cours comprise */
  journeesPluvieuses = 0;

  /**
   * Le temps de la journee qui se leve. **A appeler une seule fois, a l'aube.**
   *
   * @returns le temps qu'il fera aujourd'hui
   */
  passerLaJournee(rng: Rng): Temps {
    // Au lendemain d'une crue, l'eau se retire : la journee est seche quoi que
    // dise le tirage. Sans ca, une quatrieme journee pluvieuse rendrait la crue
    // quotidienne, et l'evenement rare deviendrait le decor.
    if (this.crue) {
      this.temps = "sec";
      this.journeesPluvieuses = 0;
      return this.temps;
    }

    if (!rng.chance(REGLAGES_METEO.chancePluie)) {
      this.temps = "sec";
      this.journeesPluvieuses = 0;
      return this.temps;
    }

    // Il pleuvra : reste a savoir si le ciel se contente de mouiller.
    this.temps = rng.chance(REGLAGES_METEO.partDOrage) ? "orage" : "pluie";
    this.journeesPluvieuses += 1;
    return this.temps;
  }

  /** Le ciel mouille-t-il aujourd'hui ? La pluie et l'orage, pas le sec. */
  get pluvieux(): boolean {
    return this.temps !== "sec";
  }

  /**
   * La crue : la troisieme journee pluvieuse d'affilee (§4.21).
   *
   * C'est elle qui noie les champs, acheve les batiments deja abimes, fait
   * deborder les douves et fait sortir de l'eau ce qui attaque la nuit venue.
   */
  get crue(): boolean {
    return this.journeesPluvieuses >= REGLAGES_METEO.journeesPourLaCrue;
  }

  /**
   * Pleut-il **a cet instant** ?
   *
   * La journee sait s'il doit pleuvoir ; l'instant sait s'il pleut encore. Les
   * deux sont separes parce que le rendu, le son et la pousse posent tous la
   * meme question plusieurs fois par seconde, et qu'aucun d'eux ne doit avoir a
   * connaitre la table de reglages.
   */
  ilPleut(phase: Phase, part: number): boolean {
    if (!this.pluvieux) return false;
    // Le jour de crue, ca ne cesse ni a midi ni a la nuit : c'est ce qui rend
    // la troisieme journee reconnaissable sans lire une ligne de texte. Un
    // orage non plus ne cesse pas — il tient jusqu'au bout de sa nuit.
    if (this.crue || this.orage) return true;
    return phase === "jour" && part < REGLAGES_METEO.finDeLAverse;
  }

  /**
   * Le multiplicateur de pousse des champs a cet instant (§4.18, §4.21).
   *
   * C'est le seul effet de la pluie qui se mesure en une seule journee, et donc
   * le seul qui se juge manette en main.
   */
  pousse(phase: Phase, part: number): number {
    return this.ilPleut(phase, part) ? REGLAGES_METEO.pousseSousLaPluie : 1;
  }

  /**
   * Ce que la pluie fait a un feu, en multiplicateur d'extinction (§4.21).
   *
   * Rien ne brule encore : c'est le crochet de l'incendie, pose d'avance.
   */
  extinction(phase: Phase, part: number): number {
    return this.ilPleut(phase, part) ? REGLAGES_METEO.extinctionSousLaPluie : 1;
  }

  // ------------------------------------------------------------- l'orage

  /**
   * L'orage tient-il ? (§4.21)
   *
   * Il couvre **la journee et sa nuit** : le temps est tire a l'aube, et la
   * nuit N tombe a la fin du jour N — les deux portent le meme numero, donc le
   * meme ciel. On se bat sous l'orage qu'on a vu se lever le matin.
   */
  get orage(): boolean {
    return this.temps === "orage";
  }

  /**
   * L'effectif d'une nuit d'orage (§4.21, §4.17).
   *
   * ⚠️ Le plafond technique du nombre d'ennemis **a l'ecran** est ailleurs et
   * ne bouge pas : ce qui monte ici, c'est le total que la nuit envoie, donc la
   * duree et la pression de l'assaut, pas le nombre de corps simultanes.
   */
  effectif(base: number): number {
    return this.orage ? Math.round(base * REGLAGES_METEO.effectifDOrage) : base;
  }

  /**
   * La nuit contre laquelle on se bat vraiment : deux crans plus loin sous
   * l'orage (§4.21). Les memes betes, en pire — jamais d'archetype offert.
   *
   * @param nuit le numero de la nuit, tel que le cycle le compte
   */
  nuitEquivalente(nuit: number): number {
    return this.orage ? nuit + REGLAGES_METEO.nuitsDAvanceEnOrage : nuit;
  }

  /**
   * Les hordes de jour ne s'arretent plus pendant un orage (§4.21).
   *
   * C'est exactement le mecanisme du village qui **attire** au-dela de
   * soixante-cinq habitants (§4.18) : on le reutilise au lieu d'en ecrire un
   * deuxieme. Un orage, c'est un village qui attire pour une journee.
   */
  get hordesDeJour(): boolean {
    return this.orage;
  }

  /** Le delai avant le prochain eclair, en millisecondes. */
  delaiProchainEclair(rng: Rng): number {
    return rng.range(REGLAGES_METEO.eclairMin, REGLAGES_METEO.eclairMax);
  }

  /**
   * Cet eclair-la met-il le feu ? (§4.21, l'incendie)
   *
   * Le crochet de l'incendie, pose d'avance comme `extinction` : rien ne brule
   * encore, mais le jour ou le feu existera, c'est cette fonction qui
   * l'allumera et rien d'autre ne changera.
   */
  unEclairAllumeUnFeu(rng: Rng): boolean {
    return this.orage && rng.chance(REGLAGES_METEO.chanceIncendieParEclair);
  }

  /** Ce que la sauvegarde garde (§4.28). */
  get instantane(): EtatMeteo {
    return { temps: this.temps, journeesPluvieuses: this.journeesPluvieuses };
  }

  /**
   * Le ciel d'une partie qu'on reprend.
   *
   * `undefined` est le cas normal d'une sauvegarde d'avant le jalon 6 : elle
   * reprend par temps sec, ce qui ne lui fait rien perdre — la pluie est un
   * etat de la journee, pas un acquis.
   */
  static reprendre(etat: EtatMeteo | undefined): Meteo {
    const meteo = new Meteo();
    meteo.reprendreDe(etat);
    return meteo;
  }

  /**
   * Repose un ciel enregistre **sur place**.
   *
   * Comme le cycle (§4.28) : la scene tient cette reference depuis sa
   * construction, la remplacer laisserait des objets pointer vers l'ancienne.
   */
  reprendreDe(etat: EtatMeteo | undefined): void {
    const temps = etat?.temps;
    this.temps = temps === "pluie" || temps === "orage" ? temps : "sec";
    this.journeesPluvieuses = Math.max(0, Math.floor(etat?.journeesPluvieuses || 0));
  }
}

/**
 * Ce que le ciel annonce au lever, ou `null` s'il n'y a rien a dire.
 *
 * Une journee seche ne dit rien : une ligne par matin dans la discussion
 * chasserait les cinq autres (§4.10, la boite ne garde que six lignes). Le ciel
 * ne parle que quand il change quelque chose.
 */
export function annonceDuMatin(meteo: Meteo): string | null {
  if (!meteo.pluvieux) return null;
  // L'orage passe devant : c'est la nouvelle qui change la journee, et celle
  // qui doit tenir la ligne meme un jour de crue.
  if (meteo.orage && meteo.crue) return "L'orage sur l'eau qui monte — tenez-vous prets";
  if (meteo.orage) return "Le ciel gronde — ils seront plus nombreux cette nuit";
  if (meteo.crue) return "L'eau monte — le ciel ne se vide plus";
  if (meteo.journeesPluvieuses >= 2) return "Il pleut encore — la terre est gorgee";
  return "Le ciel est bas — il pleuvra ce matin";
}
