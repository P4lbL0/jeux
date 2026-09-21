/**
 * Les relations entre les gens du village (DESIGN.md §4.26).
 *
 * **Ce n'est pas l'affinite du §4.16, et il ne faut jamais les confondre.**
 * L'affinite est **militaire** : elle se gagne en combattant ensemble, elle vaut
 * +10 % de degats au plafond, et elle ne concerne que les heros qui sortent. La
 * relation est **sociale** : elle se gagne en vivant ensemble, elle a un type et
 * une intensite, et elle concerne **tout le monde**, habitants compris.
 *
 * > Le doublon etait le vrai risque, et il est ecarte : deux heros peuvent
 * > parfaitement avoir une affinite maximale et se detester — et c'est meme une
 * > des situations les plus interessantes que le systeme puisse produire.
 *
 * Trois regles de ce fichier viennent directement du §4.26, et elles portent
 * tout le cout :
 *
 * 1. **Une relation est une paire, pas deux fiches.** Une seule entree par
 *    couple, indexee par les deux identifiants — sinon trente habitants font
 *    900 entrees a tenir a jour.
 * 2. **Elles ne se recalculent pas par image.** Elles bougent sur **evenement**
 *    (une mort, un sauvetage, une nuit passee ensemble), jamais en continu.
 * 3. **Les liens faibles n'existent pas.** Sous un seuil, la relation est
 *    effacee au lieu d'etre stockee a zero.
 *
 * Ce fichier ne connait pas Phaser.
 */

/**
 * Les onze types, dont un qui ne se gagne pas.
 *
 * ⚠️ **La famille ne se gagne pas** : elle vient des naissances (§4.18) et d'un
 * survivant ramene avec les siens. Elle ne s'use pas non plus — on ne cesse pas
 * d'etre le frere de quelqu'un parce qu'on a passe trois jours sans le voir.
 */
export type TypeRelation =
  // les positives
  | "amitie"
  | "amour"
  | "admiration"
  | "respect"
  | "dette"
  // les negatives
  | "rivalite"
  | "haine"
  | "peur"
  | "jalousie"
  | "trahison"
  // celle qui ne se gagne pas
  | "famille";

export const NOMS_RELATION: Record<TypeRelation, string> = {
  amitie: "Amitie",
  amour: "Amour",
  admiration: "Admiration",
  respect: "Respect",
  dette: "Dette",
  rivalite: "Rivalite",
  haine: "Haine",
  peur: "Peur",
  jalousie: "Jalousie",
  trahison: "Trahison",
  famille: "Famille",
};

/** Ce que chaque lien dit, en une ligne, sur la fiche. */
export const RESUMES_RELATION: Record<TypeRelation, string> = {
  amitie: "se protegent, et se pleurent deux fois plus",
  amour: "se protegent, et se pleurent deux fois plus",
  admiration: "il le suit des yeux",
  respect: "ils se valent, et le savent",
  dette: "il lui doit quelque chose, et il obeira quand meme",
  rivalite: "ils frappent plus fort cote a cote",
  haine: "ils refusent de cooperer",
  peur: "il s'ecarte quand l'autre approche",
  jalousie: "il compte ce que l'autre recoit",
  trahison: "il ne lui tournera plus le dos",
  famille: "le sang",
};

export const POSITIVES: readonly TypeRelation[] = [
  "amitie",
  "amour",
  "admiration",
  "respect",
  "dette",
  "famille",
];

export function estPositive(type: TypeRelation): boolean {
  return POSITIVES.includes(type);
}

/**
 * **La table de reglages des relations.** Comme celles du cycle, de l'economie
 * et du stress, c'est le seul endroit a toucher pour les re-regler.
 */
export const REGLAGES_RELATIONS = {
  /** L'intensite maximale d'un lien */
  plafond: 100,

  /**
   * Sous cette intensite, le lien est **efface** au lieu d'etre garde a zero
   * (§4.26). C'est ce qui empeche une partie longue d'accumuler des centaines
   * de paires a un point chacune.
   */
  plancher: 5,

  /**
   * A partir d'ou une relation debloque une competence de groupe.
   *
   * *Tranche le 9 septembre 2026 avec Angelos* : 60 sur 100.
   */
  seuilDeGroupe: 60,

  /** Ce qu'une nuit passee ensemble ajoute, et ce qu'une journee separes retire */
  parNuitEnsemble: 2,
  parJourSepares: 1,

  /**
   * Combien de paires on garde au plus.
   *
   * ⚠️ **Une borne dure, et elle n'est pas decorative.** Trente habitants font
   * 435 paires possibles ; une partie de cinquante nuits en produirait plus que
   * ce que la fiche montrera jamais. Au-dela, les plus faibles sortent — et le
   * plancher fait deja la plus grosse part du travail.
   */
  paquesMax: 600,
};

export interface Lien {
  type: TypeRelation;
  /** De 0 a 100 ; sous le plancher, le lien n'existe plus */
  intensite: number;
  /** La journee ou il a bouge pour la derniere fois — pour l'usure */
  dernierJour: number;
}

/** La cle d'une paire : les deux identifiants, toujours dans le meme ordre. */
export function clePaire(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

export interface LienVu extends Lien {
  /** L'autre, vu depuis celui a qui on demande ses liens */
  avec: string;
}

export class Relations {
  private readonly liens = new Map<string, Lien>();

  get taille(): number {
    return this.liens.size;
  }

  /** Le lien entre deux personnes, ou `null` s'il n'y en a pas. */
  lien(a: string, b: string): Lien | null {
    if (a === b) return null;
    return this.liens.get(clePaire(a, b)) ?? null;
  }

  /**
   * Un evenement les rapproche ou les eloigne.
   *
   * ⚠️ **Un seul type par paire, et il se dispute la place.** Poser de la haine
   * sur une amitie ne cree pas une deuxieme entree : ca **use** l'amitie, et si
   * elle tombe a zero le reste passe en haine. C'est ce qui donne les
   * retournements que le §4.26 cherche — le forgeron qui sauve le fils du
   * chasseur, puis le laisse mourir trois jours plus tard.
   *
   * **La famille est la seule exception** : elle ne se dispute rien. Elle
   * s'installe et elle reste, parce qu'on ne cesse pas d'etre le frere de
   * quelqu'un.
   */
  poser(a: string, b: string, type: TypeRelation, intensite: number, jour = 1): Lien | null {
    if (a === b || intensite <= 0) return null;
    const k = clePaire(a, b);
    const existant = this.liens.get(k);

    if (!existant) {
      const neuf: Lien = {
        type,
        intensite: Math.min(REGLAGES_RELATIONS.plafond, intensite),
        dernierJour: jour,
      };
      this.liens.set(k, neuf);
      this.elaguer();
      return neuf;
    }

    // La famille ne se perd pas, et rien ne prend sa place.
    if (existant.type === "famille") {
      existant.dernierJour = jour;
      return existant;
    }
    if (type === "famille") {
      existant.type = "famille";
      existant.intensite = Math.max(existant.intensite, intensite);
      existant.dernierJour = jour;
      return existant;
    }

    existant.dernierJour = jour;
    if (existant.type === type) {
      existant.intensite = Math.min(REGLAGES_RELATIONS.plafond, existant.intensite + intensite);
      return existant;
    }

    // Deux sentiments de meme signe se remplacent au lieu de s'annuler : passer
    // de l'amitie a l'amour n'efface pas ce qu'on a vecu.
    if (estPositive(existant.type) === estPositive(type)) {
      if (intensite >= existant.intensite) existant.type = type;
      existant.intensite = Math.min(REGLAGES_RELATIONS.plafond, existant.intensite + intensite);
      return existant;
    }

    // De signes opposes : ils se mangent.
    const reste = intensite - existant.intensite;
    if (reste <= 0) {
      existant.intensite = -reste;
      if (existant.intensite < REGLAGES_RELATIONS.plancher) {
        this.liens.delete(k);
        return null;
      }
      return existant;
    }
    existant.type = type;
    existant.intensite = Math.min(REGLAGES_RELATIONS.plafond, reste);
    if (existant.intensite < REGLAGES_RELATIONS.plancher) {
      this.liens.delete(k);
      return null;
    }
    return existant;
  }

  /**
   * L'usure d'une journee (§4.26) : **+2 par nuit ensemble, -1 par jour
   * separes**, et ce qui tombe sous le plancher disparait.
   *
   * @param ensemble les paires qui ont passe la nuit au meme endroit, deja
   *   reduites par l'appelant : ce fichier ne sait pas ou sont les gens.
   */
  passerUneJournee(ensemble: Iterable<[string, string]>, jour: number): void {
    const vus = new Set<string>();
    for (const [a, b] of ensemble) {
      if (a === b) continue;
      const k = clePaire(a, b);
      vus.add(k);
      const lien = this.liens.get(k);
      if (!lien) continue;
      // Une nuit ensemble renforce ce qui existe, quel qu'il soit : deux
      // ennemis qui tiennent la meme porte se detestent un peu plus fort.
      lien.intensite = Math.min(
        REGLAGES_RELATIONS.plafond,
        lien.intensite + REGLAGES_RELATIONS.parNuitEnsemble,
      );
      lien.dernierJour = jour;
    }

    for (const [k, lien] of this.liens) {
      if (vus.has(k) || lien.type === "famille") continue;
      lien.intensite -= REGLAGES_RELATIONS.parJourSepares;
      if (lien.intensite < REGLAGES_RELATIONS.plancher) this.liens.delete(k);
    }
  }

  /** Tous les liens d'une personne, du plus fort au plus faible. */
  lesLiensDe(qui: string): LienVu[] {
    const vus: LienVu[] = [];
    for (const [k, lien] of this.liens) {
      const [a, b] = k.split("|") as [string, string];
      if (a === qui) vus.push({ ...lien, avec: b });
      else if (b === qui) vus.push({ ...lien, avec: a });
    }
    return vus.sort((x, y) => y.intensite - x.intensite);
  }

  /** Quelqu'un meurt : ses liens partent avec lui, mais on les rend d'abord. */
  oublier(qui: string): LienVu[] {
    const partis = this.lesLiensDe(qui);
    for (const lien of partis) this.liens.delete(clePaire(qui, lien.avec));
    return partis;
  }

  // ------------------------------------------- ce que ca change vraiment

  /**
   * Ce que la mort de `mort` coute a `temoin`, en part du pic normal.
   *
   * **Deux amis se pleurent deux fois plus** (§4.26). C'est le premier effet
   * mecanique du systeme, et le moins cher : il se lit a la mort, jamais par
   * image.
   */
  facteurDeDeuil(temoin: string, mort: string): number {
    const lien = this.lien(temoin, mort);
    if (!lien) return 1;
    if (lien.type === "famille") return 2.5;
    if (lien.type === "amitie" || lien.type === "amour") return 2;
    // On ne pleure pas celui qu'on haissait — mais on a quand meme vu mourir.
    if (lien.type === "haine" || lien.type === "trahison") return 0.5;
    return 1;
  }

  /**
   * **Deux ennemis refusent de cooperer** (§4.26) : pas d'affinite qui monte,
   * pas de formation commune.
   */
  refusentDeCooperer(a: string, b: string): boolean {
    const lien = this.lien(a, b);
    if (!lien) return false;
    return (
      (lien.type === "haine" || lien.type === "trahison") &&
      lien.intensite >= REGLAGES_RELATIONS.seuilDeGroupe
    );
  }

  /**
   * **Deux rivaux cherchent a tuer plus que l'autre** (§4.26) : les deux
   * frappent plus fort quand ils se battent cote a cote.
   *
   * Plafonne au meme endroit que l'affinite (§4.16) : dix pour cent. Les deux
   * s'additionnent — une equipe rodee **et** qui se tire la bourre tape 20 % de
   * plus, et c'est exactement le genre d'histoire que le §4.26 veut produire.
   */
  bonusDeRivalite(qui: string, auCombat: readonly string[]): number {
    let meilleur = 0;
    for (const autre of auCombat) {
      if (autre === qui) continue;
      const lien = this.lien(qui, autre);
      if (!lien || lien.type !== "rivalite") continue;
      meilleur = Math.max(meilleur, lien.intensite / REGLAGES_RELATIONS.plafond);
    }
    return meilleur * 0.1;
  }

  /**
   * **La dette fait accepter un ordre qu'on aurait refuse** (§4.26).
   *
   * Le seul refus qui existe aujourd'hui est la **paranoia** (§4.23) : elle
   * refuse les ordres, et pour un civil elle refuse de sortir travailler.
   * Quelqu'un qui doit quelque chose a un vivant obeit quand meme.
   */
  obeitMalgreTout(qui: string, vivants: readonly string[]): boolean {
    for (const autre of vivants) {
      if (autre === qui) continue;
      const lien = this.lien(qui, autre);
      if (lien?.type === "dette" && lien.intensite >= REGLAGES_RELATIONS.seuilDeGroupe) return true;
    }
    return false;
  }

  /**
   * **La peur fait fuir un poste quand l'autre s'en approche** (§4.26).
   *
   * ⚠️ Cette question se pose **au tour de role, jamais par image** : c'est la
   * regle de fluidite du §4.27, et c'est le bloc 12 qui la respecte en ne
   * reveillant que quelques habitants par image. Ce fichier ne fait que
   * repondre.
   */
  craint(qui: string, autre: string): boolean {
    const lien = this.lien(qui, autre);
    return lien?.type === "peur" && lien.intensite >= REGLAGES_RELATIONS.seuilDeGroupe;
  }

  /** Le plus proche des vivants, pour l'heritage (§4.26). */
  leProche(qui: string, vivants: readonly string[]): LienVu | null {
    const candidats = this.lesLiensDe(qui).filter(
      (lien) => vivants.includes(lien.avec) && estPositive(lien.type),
    );
    if (candidats.length === 0) return null;
    // La famille passe devant, a intensite egale ou non : c'est elle qui herite.
    const famille = candidats.filter((lien) => lien.type === "famille");
    return (famille.length > 0 ? famille : candidats)[0]!;
  }

  // ---------------------------------------------------- la sauvegarde

  /** Tout ce qu'il y a, pour l'enregistrement (§4.28). */
  exporter(): [string, Lien][] {
    return [...this.liens.entries()];
  }

  importer(entrees: readonly [string, Lien][]): void {
    this.liens.clear();
    for (const [k, lien] of entrees) {
      if (typeof k !== "string" || !k.includes("|")) continue;
      if (!lien || typeof lien.intensite !== "number") continue;
      if (lien.intensite < REGLAGES_RELATIONS.plancher) continue;
      this.liens.set(k, { ...lien });
    }
  }

  /** La borne dure : au-dela, les plus faibles sortent. */
  private elaguer(): void {
    if (this.liens.size <= REGLAGES_RELATIONS.paquesMax) return;
    const tries = [...this.liens.entries()].sort((x, y) => x[1].intensite - y[1].intensite);
    const aJeter = this.liens.size - REGLAGES_RELATIONS.paquesMax;
    for (let i = 0; i < aJeter; i++) this.liens.delete(tries[i]![0]);
  }
}
