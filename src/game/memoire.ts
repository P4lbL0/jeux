import {
  Archives,
  seSouvenir,
  suitesDeLaMort,
  type Evenement,
  type Souvenir,
} from "../core/memoire";
import { estPositive, Relations, type Lien, type TypeRelation } from "../core/relations";
import { gagnerTrait, voirMourir, type Personne } from "../core/personne";

/**
 * La memoire du village, cote partie (DESIGN.md §4.26, bloc 11).
 *
 * `core/relations.ts` sait ce qu'un lien vaut, `core/memoire.ts` sait ce qu'un
 * souvenir et une archive contiennent. **Ce fichier-ci sait quand ils bougent.**
 * Il est le seul endroit qui traduise un evenement de partie — une journee au
 * meme poste, une nuit passee a se battre, une mort, un don qui s'eveille — en
 * liens et en souvenirs.
 *
 * ⚠️ **Rien ici n'est appele par image** (§4.17, §4.26). Les liens bougent a
 * l'aube (une passe, une fois par journee) et sur evenement. La passe de l'aube
 * est en n² sur les vivants : trente habitants font 435 paires **une fois par
 * jour**, ce qui est sans commune mesure avec 435 paires soixante fois par
 * seconde.
 *
 * Il ne connait pas Phaser : il ne voit que des personnes, des postes et des
 * journees. C'est ce qui permet de le tester.
 */

/**
 * **La table de reglages de ce qui rapproche les gens.**
 *
 * *Chiffres tranches par le code, a corriger en jouant.* Le §4.26 n'en donnait
 * qu'un — « +2 par nuit passee ensemble, -1 par journee separes », qui vit dans
 * `relations.ts` — et un exemple : « le forgeron sauve le fils du chasseur →
 * +20 ». Les autres s'alignent sur ces deux-la.
 */
export const REGLAGES_MEMOIRE = {
  /** Une journee entiere au meme poste : on finit par se parler */
  parJourneeAuMemePoste: 3,
  /** Une nuit passee a tenir la meme ligne : ca ne s'oublie pas pareil */
  parNuitCoteACote: 4,
  /** Celui qu'on ramene vivant doit quelque chose a celui qui est venu */
  pourUnSauvetage: 20,
  /**
   * Deux gros tueurs de la meme nuit se mesurent l'un a l'autre.
   *
   * Plus fort qu'une nuit cote a cote (4) : une rivalite qui naitrait plus
   * faible que le respect de la meme nuit serait mangee avant d'exister.
   */
  parNuitDeRivalite: 8,
  /** Il faut avoir vraiment tue pour qu'une rivalite naisse */
  killsPourUneRivalite: 6,
  /** Voir quelqu'un craquer et s'en prendre aux siens */
  pourUneRage: 25,
  /** Voir un don s'eveiller sous ses yeux */
  pourUnEveil: 18,
  /**
   * Au-dela de cette amitie, elle peut devenir autre chose.
   *
   * ⚠️ **Une chance par journee, pas un tirage par image ni par paire.** Le
   * village compte ses amities fortes une fois a l'aube ; au-dela d'une par
   * jour, l'amour cesserait d'etre une histoire pour devenir du bruit.
   */
  amitiePourUnAmour: 70,
  chanceDAmourParJour: 0.12,
};

/** Ce que la memoire a besoin de savoir de quelqu'un, une fois par journee. */
export interface GensDuJour {
  personne: Personne;
  /** Ou il a passe sa journee : l'identifiant du poste, ou `null` */
  poste: string | null;
  /** A-t-il tenu une ligne cette nuit ? */
  sestBattu: boolean;
  /** Ce qu'il a tue cette nuit */
  kills: number;
}

/** Ce qu'une mort a produit, une fois tout applique. */
export interface Deuil {
  /** L'identite de celui qui peut heriter, s'il y en a un */
  heritier: string | null;
  evenement: Evenement | null;
}

export class MemoireDuVillage {
  readonly relations = new Relations();
  readonly archives = new Archives();

  /**
   * ⚠️ **Ce qu'un mort laisse a quelqu'un, en attente d'etre choisi.**
   *
   * *Decision d'Angelos, 21 septembre 2026* : l'heritage est **propose a la
   * montee de niveau**, jamais donne. « Le proche voit la competence du mort
   * apparaitre dans son choix suivant, marquee heritage de Marc » — c'est un
   * arbitrage du joueur, pas un cadeau, et ca reutilise l'ecran qui existe.
   */
  private readonly legs = new Map<string, { de: string; competence: string }>();

  /** Ce que quelqu'un a en attente, s'il a quelque chose. */
  legsDe(identite: string): { de: string; competence: string } | null {
    return this.legs.get(identite) ?? null;
  }

  /** Il l'a pris : le legs est consomme, et il laisse une trace. */
  prendreLeLegs(personne: Personne, jour: number): { de: string; competence: string } | null {
    const legs = this.legs.get(personne.identite);
    if (!legs) return null;
    this.legs.delete(personne.identite);
    gagnerTrait(personne, "heritier");
    seSouvenir(personne.souvenirs, { cle: "a-herite", jour, qui: legs.de });
    return legs;
  }

  // ------------------------------------------------------------ la journee

  /**
   * L'aube : les liens se tissent, s'usent, et ceux qui sont trop faibles
   * disparaissent (§4.26).
   *
   * @returns ce qu'il faut annoncer, s'il y a quelque chose a dire
   */
  passerUneJournee(gens: readonly GensDuJour[], jour: number, tirage: () => number): string[] {
    const annonces: string[] = [];
    const ensemble: [string, string][] = [];

    // ⚠️ **La rivalite se pose AVANT la passe des paires, et pas apres.** Vu en
    // test : posee ensuite, elle se heurtait au respect que la meme nuit venait
    // de creer, les deux s'annulaient, et il ne restait rien. Elle passe donc
    // d'abord, sur un lien vierge — et la passe qui suit voit un lien negatif
    // et n'essaie plus d'y mettre de l'amitie.
    const rivalite = this.chercherUneRivalite(gens, jour);
    if (rivalite) annonces.push(rivalite);

    // ⚠️ Une seule passe en n², une fois par jour. On la fait sur les vivants
    // et on en tire tout d'un coup : les paires au meme poste, celles qui se
    // sont battues cote a cote, et la liste de ce qui a passe la nuit ensemble.
    for (let i = 0; i < gens.length; i++) {
      for (let j = i + 1; j < gens.length; j++) {
        const a = gens[i]!;
        const b = gens[j]!;
        const memePoste = a.poste !== null && a.poste === b.poste;
        const memeLigne = a.sestBattu && b.sestBattu;
        if (!memePoste && !memeLigne) continue;

        // ⚠️ **Un lien negatif n'est jamais adouci par une journee de travail.**
        // Travailler cote a cote ne reconcilie personne : ca ne fait que rendre
        // la journee plus longue. Sans cette regle, une rivalite ou une haine
        // passait son temps a etre rongee par l'amitie du poste commun, et
        // aucun sentiment negatif ne tenait plus de deux nuits.
        const deja = this.relations.lien(a.personne.identite, b.personne.identite);
        const brouilles = deja !== null && !estPositive(deja.type);
        if (!brouilles) {
          if (memePoste) {
            this.relations.poser(
              a.personne.identite,
              b.personne.identite,
              "amitie",
              REGLAGES_MEMOIRE.parJourneeAuMemePoste,
              jour,
            );
          }
          if (memeLigne) {
            this.relations.poser(
              a.personne.identite,
              b.personne.identite,
              "respect",
              REGLAGES_MEMOIRE.parNuitCoteACote,
              jour,
            );
          }
        }
        ensemble.push([a.personne.identite, b.personne.identite]);
      }
    }

    // La nuit passee ensemble renforce ce qui existe, quel qu'en soit le signe :
    // deux ennemis qui tiennent la meme porte se detestent un peu plus fort.
    this.relations.passerUneJournee(ensemble, jour);
    this.archives.avancerAuJour(jour);

    const amour = this.chercherUnAmour(gens, jour, tirage);
    if (amour) annonces.push(amour);

    return annonces;
  }

  /**
   * **Deux rivaux cherchent a tuer plus que l'autre** (§4.26).
   *
   * Les deux meilleurs tueurs de la nuit, et seulement s'ils ont vraiment tue.
   * Une rivalite entre deux personnes qui n'ont rien fait ne raconterait rien.
   */
  private chercherUneRivalite(gens: readonly GensDuJour[], jour: number): string | null {
    const tueurs = gens
      .filter((g) => g.kills >= REGLAGES_MEMOIRE.killsPourUneRivalite)
      .sort((a, b) => b.kills - a.kills);
    if (tueurs.length < 2) return null;

    const [un, deux] = tueurs as [GensDuJour, GensDuJour];
    const avant = this.relations.lien(un.personne.identite, deux.personne.identite);
    this.relations.poser(
      un.personne.identite,
      deux.personne.identite,
      "rivalite",
      REGLAGES_MEMOIRE.parNuitDeRivalite,
      jour,
    );
    const apres = this.relations.lien(un.personne.identite, deux.personne.identite);
    // On n'annonce que la naissance du lien, pas chacune de ses journees.
    if (apres?.type !== "rivalite" || avant?.type === "rivalite") return null;
    return `${un.personne.nom} et ${deux.personne.nom} se comptent leurs morts`;
  }

  /** Une amitie assez forte peut devenir autre chose. Rarement. */
  private chercherUnAmour(
    gens: readonly GensDuJour[],
    jour: number,
    tirage: () => number,
  ): string | null {
    if (tirage() > REGLAGES_MEMOIRE.chanceDAmourParJour) return null;
    const parIdentite = new Map(gens.map((g) => [g.personne.identite, g.personne]));

    for (const [identite, personne] of parIdentite) {
      for (const lien of this.relations.lesLiensDe(identite)) {
        if (lien.type !== "amitie") continue;
        if (lien.intensite < REGLAGES_MEMOIRE.amitiePourUnAmour) continue;
        const autre = parIdentite.get(lien.avec);
        if (!autre) continue;
        this.relations.poser(identite, lien.avec, "amour", lien.intensite, jour);
        return `${personne.nom} et ${autre.nom} ne se quittent plus`;
      }
    }
    return null;
  }

  // ------------------------------------------------------------- une mort

  /**
   * Une mort, et tout ce qu'elle produit **en une fois** (§4.26).
   *
   * > Une mort ne doit jamais etre `pv = 0 → retirer(personnage)`.
   *
   * @param temoins ceux qui etaient assez pres pour voir (§4.23, rayon du deuil)
   * @param vivants tout le monde, temoins ou non — c'est la que se trouve l'heritier
   * @param competence ce que le mort savait faire, s'il savait quelque chose
   */
  mourir(
    mort: Personne,
    temoins: readonly Personne[],
    vivants: readonly Personne[],
    jour: number,
    competence: string | null,
    /**
     * Ce qu'on sait de sa mort : son metier, s'il s'etait arme, ou il est
     * tombe. **Ce qu'on ne sait pas ne sera pas raconte** (§4.26).
     */
    details: Partial<Evenement> = {},
  ): Deuil {
    const parIdentite = new Map(vivants.map((p) => [p.identite, p]));
    const courageDe = (identite: string): number =>
      parIdentite.get(identite)?.stats.courage ?? 50;

    const suites = suitesDeLaMort(
      mort.identite,
      mort.nom,
      temoins.map((p) => p.identite),
      vivants.map((p) => p.identite),
      this.relations,
      jour,
      courageDe,
      details,
    );

    for (const endeuille of suites.endeuilles) {
      const personne = parIdentite.get(endeuille.qui);
      if (!personne) continue;
      voirMourir(personne, endeuille.facteurStress);
      if (endeuille.trait) {
        gagnerTrait(personne, endeuille.trait);
        // Un proche qui tombe est un souvenir **fondateur** : il ne s'efface
        // jamais, quelle que soit la longueur de la partie (§4.26).
        seSouvenir(personne.souvenirs, { cle: "a-perdu-un-proche", jour, qui: mort.nom });
      } else {
        seSouvenir(personne.souvenirs, { cle: "a-vu-mourir", jour, qui: mort.nom });
      }
    }

    if (suites.evenement) this.archives.inscrire(suites.evenement);

    const heritier = suites.heritier?.avec ?? null;
    if (heritier !== null && competence !== null) {
      this.legs.set(heritier, { de: mort.nom, competence });
    }

    // Ses liens partent avec lui : ils viennent d'etre lus, ils ne servent plus.
    this.relations.oublier(mort.identite);
    this.legs.delete(mort.identite);

    return { heritier, evenement: suites.evenement };
  }

  // ------------------------------------------------ les autres evenements

  /** Celui qu'on ramene vivant doit quelque chose a celui qui est venu (§4.18). */
  sauvetage(sauve: Personne, sauveur: Personne, jour: number): void {
    this.relations.poser(
      sauve.identite,
      sauveur.identite,
      "dette",
      REGLAGES_MEMOIRE.pourUnSauvetage,
      jour,
    );
    seSouvenir(sauve.souvenirs, { cle: "a-ete-sauve", jour, qui: sauveur.nom });
    seSouvenir(sauveur.souvenirs, { cle: "a-sauve", jour, qui: sauve.nom });
  }

  /**
   * Quelqu'un craque et s'en prend aux siens : on ne le regarde plus pareil
   * (§4.23, §4.26).
   */
  rage(qui: Personne, temoins: readonly Personne[], jour: number): void {
    seSouvenir(qui.souvenirs, { cle: "a-craque", jour, combien: jour });
    for (const temoin of temoins) {
      if (temoin === qui) continue;
      this.relations.poser(
        temoin.identite,
        qui.identite,
        "peur",
        REGLAGES_MEMOIRE.pourUneRage,
        jour,
      );
    }
  }

  /** Un don s'eveille sous les yeux du village (§4.1, bloc 9). */
  eveil(qui: Personne, temoins: readonly Personne[], jour: number): void {
    seSouvenir(qui.souvenirs, { cle: "s-est-eveille", jour });
    for (const temoin of temoins) {
      if (temoin === qui) continue;
      this.relations.poser(
        temoin.identite,
        qui.identite,
        "admiration",
        REGLAGES_MEMOIRE.pourUnEveil,
        jour,
      );
    }
  }

  /** On l'a laisse entrer : le village est sa date de naissance (§4.18). */
  accueil(qui: Personne, jour: number): void {
    seSouvenir(qui.souvenirs, { cle: "a-ete-accueilli", jour, combien: jour });
  }

  /** Il a passe la nuit, et elle comptait. */
  survivreALaNuit(gens: readonly Personne[], nuit: number): void {
    for (const personne of gens) {
      seSouvenir(personne.souvenirs, { cle: "a-survecu", jour: nuit, combien: nuit });
    }
  }

  /** Il en est revenu : un souvenir de plus, et un seul (§4.23, les sequelles). */
  enEstRevenu(qui: Personne, jour: number): void {
    seSouvenir(qui.souvenirs, { cle: "a-failli-mourir", jour });
  }

  /** Il a tenu une ligne tout seul : c'est de ca que les legendes sont faites. */
  aTenuSeul(qui: Personne, jour: number): void {
    seSouvenir(qui.souvenirs, { cle: "a-tenu-seul", jour });
  }

  /** Le village se souvient d'une nuit, d'une famine, d'une premiere fois. */
  inscrire(evenement: Evenement): void {
    this.archives.inscrire(evenement);
  }

  /** Quelqu'un s'en va sans mourir : ses liens ne servent plus a rien. */
  oublier(identite: string): void {
    this.relations.oublier(identite);
    this.legs.delete(identite);
  }

  // ---------------------------------------------------------- la sauvegarde

  exporter(): { relations: [string, Lien][]; archives: Evenement[] } {
    return { relations: this.relations.exporter(), archives: this.archives.exporter() };
  }

  importer(
    relations: readonly [string, Lien][] | undefined,
    archives: readonly Evenement[] | undefined,
    jour: number,
  ): void {
    if (relations) this.relations.importer(relations);
    if (archives) this.archives.importer(archives, jour);
  }
}

/** Le type d'un lien, pour ceux qui n'ont pas besoin du reste. */
export type { TypeRelation, Souvenir };
