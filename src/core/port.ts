/**
 * Le port et le commerce maritime (DESIGN.md §4.18).
 *
 * Il donne enfin ses deux bouts a l'argent du §4.8 : on en gagne en vendant son
 * surplus, on en depense pour monter l'eglise (§4.22). Et surtout, il donne une
 * **raison de produire au-dela de ses besoins** — jusqu'ici un village qui
 * mangeait a sa faim n'avait plus rien a faire de son bois.
 *
 * Trois idees, et elles se tiennent l'une l'autre :
 *
 * 1. **La vente est a sens unique.** On vend des ressources contre de l'argent,
 *    on n'en rachete jamais. C'est ce qui preserve la regle du §4.8 : manquer de
 *    bois se paie toujours en bois, jamais en pieces.
 * 2. **Chaque ressource a son cours**, qui derive lentement. Un cours global
 *    n'aurait dit que « vendre ou pas » ; un cours par ressource dit **quoi**
 *    charger, et c'est la que vit la decision.
 * 3. **Vendre fait baisser le cours de ce qu'on vend.** C'est ce qui remplace le
 *    plafond de cargaison : le frein est economique, pas arbitraire.
 *
 * ⚠️ **Et le navire n'a pas d'horaire.** Des prix qui bougent creent normalement
 * de l'attente optimale — on ne vend plus, on guette le bon cours. Une voile
 * imprevisible la supprime : on vend a celui qui est la, parce que rien ne dit
 * quand paraitra le suivant. **Aucune des deux idees ne marcherait seule.**
 *
 * Ce fichier ne connait pas Phaser : il tient un cours, il vend, il compte.
 */

import { RESSOURCES, type Ressource, type Stocks } from "./habitants";
import { REGLAGES_SATISFACTION } from "./satisfaction";
import type { Rng } from "./rng";

/**
 * **La table de reglages du port.** Comme celles du cycle, de l'economie, du
 * stress et de la porte, c'est le seul endroit a toucher pour tout re-regler.
 */
export const REGLAGES_PORT = {
  /** Ce que coute le relevement du port, et ce qu'il dure (§4.18) */
  cout: { bois: 80 },
  /** Une demi-journee de chantier, en millisecondes reelles */
  duree: 15 * 60 * 1000,

  /**
   * Combien d'unites il faut pour une piece, par ressource.
   *
   * **Le prix suit le risque et la peine** : le minerai est le plus dur a
   * sortir, le poisson est adosse au flanc ferme et rien ne l'atteint jamais.
   * Le ble se place entre les deux — une horde peut ruiner un champ.
   */
  unitesParPiece: {
    minerai: 2,
    bois: 4,
    ble: 5,
    poisson: 6,
    // La pierre est lourde et sort de la mine sans qu'on s'en occupe : elle
    // vaut moins que tout, et c'est en mur qu'elle vaut (bloc 7b).
    pierre: 8,
  } as Record<Ressource, number>,

  /** Bornes du cours, en part du prix de base */
  coursMin: 0.6,
  coursMax: 1.6,
  /** De combien un cours peut bouger en une journee */
  deriveParJournee: 0.12,
  /**
   * Vers quoi un cours revient tout seul.
   *
   * Sans ce rappel, une marche aleatoire finit collee a une borne et y reste :
   * le cours cesserait de raconter quoi que ce soit.
   */
  retourALaMoyenne: 0.15,

  /**
   * De combien vendre **une piece** de marchandise pousse son cours vers le bas.
   *
   * C'est le remplacant du plafond de cargaison. A 0,0016, ecouler de quoi
   * gagner 100 pieces coute 0,16 de cours — le dernier lot d'une grosse vente
   * rapporte donc nettement moins que le premier, sans qu'aucune regle
   * n'interdise rien.
   */
  impactParPiece: 0.0016,
  /** Ce qu'un cours regagne par journee apres avoir ete enfonce */
  remonteeParJournee: 0.08,

  /** Chance qu'une voile paraisse, par journee calme (§4.18) */
  chanceParJournee: 1 / 3,
  /**
   * Journees pendant lesquelles un mort ecarte les navires.
   *
   * ⚠️ **Volontairement la memoire courte du village** (celle de la
   * satisfaction), et non les huit journees de la rumeur du §4.18. Le calme
   * conditionne deja les arrivees : avec la memoire longue, une mauvaise nuit
   * couperait le peuplement **et** le commerce pour plus d'une semaine. Une
   * mauvaise nuit doit se payer, pas verrouiller la partie.
   */
  memoireDesMorts: REGLAGES_SATISFACTION.memoireDesMorts,
} as const;

export type EtatPort = "ruine" | "chantier" | "debout";

/** Le cours de chaque ressource, en part de son prix de base. */
export type Cours = Record<Ressource, number>;

export function coursNeutre(): Cours {
  return { poisson: 1, ble: 1, bois: 1, minerai: 1, pierre: 1 };
}

/**
 * Ce que rapporte une quantite, au cours actuel.
 *
 * On arrondit **vers le bas** : vendre trois unites de poisson quand il en faut
 * six pour une piece ne doit pas rapporter une piece par la grace d'un arrondi.
 */
export function valeurDe(ressource: Ressource, quantite: number, cours: Cours): number {
  const base = REGLAGES_PORT.unitesParPiece[ressource];
  return Math.floor((quantite / base) * cours[ressource]);
}

/** Combien d'unites il faut vendre pour gagner une piece, au cours actuel. */
export function unitesPourUnePiece(ressource: Ressource, cours: Cours): number {
  return REGLAGES_PORT.unitesParPiece[ressource] / cours[ressource];
}

/**
 * Le port, cote regles.
 *
 * Il n'a **pas de points de vie** et il ne peut pas tomber : il est sur la
 * plage, adossee au flanc ferme de l'ouest, donc rien ne l'atteint jamais
 * (§4.6, §4.18). C'est ce qui le separe de l'eglise, qui lui est un objectif.
 */
export class Port {
  etat: EtatPort = "ruine";
  /** Le cours de chaque ressource, entre `coursMin` et `coursMax` */
  readonly cours: Cours = coursNeutre();
  /** Un navire est-il a quai en ce moment ? */
  navireAQuai = false;
  /** Avancement du chantier en cours, en millisecondes */
  private avancement = 0;

  get debout(): boolean {
    return this.etat === "debout";
  }

  /** Avancement du chantier entre 0 et 1. Vaut 0 tant qu'il n'a pas commence. */
  get partChantier(): number {
    return this.etat === "chantier" ? Math.min(1, this.avancement / REGLAGES_PORT.duree) : 0;
  }

  /**
   * On commence a le relever.
   *
   * Le bois est preleve **au demarrage**, comme pour l'eglise : sinon on
   * lancerait le chantier, on depenserait son bois ailleurs pendant la
   * demi-journee, et on recupererait le port gratuitement.
   *
   * @returns vrai si le chantier a demarre
   */
  lancerLeChantier(stocks: Stocks): boolean {
    if (this.etat !== "ruine") return false;
    if (stocks.bois < REGLAGES_PORT.cout.bois) return false;

    stocks.bois -= REGLAGES_PORT.cout.bois;
    this.etat = "chantier";
    this.avancement = 0;
    return true;
  }

  /** @returns vrai s'il vient de se mettre debout a cet instant precis */
  majorer(delta: number): boolean {
    if (this.etat !== "chantier") return false;

    this.avancement += delta;
    if (this.avancement < REGLAGES_PORT.duree) return false;

    this.etat = "debout";
    this.avancement = 0;
    return true;
  }

  /**
   * L'avancement du chantier, en millisecondes (§4.28).
   *
   * Prive a l'ecriture : rien en jeu n'a de raison de le poser, sauf la reprise,
   * qui doit retrouver un chantier la ou il en etait plutot que de le faire
   * recommencer une demi-journee.
   */
  get chantier(): number {
    return this.avancement;
  }

  /** Il reprend l'etat d'une sauvegarde (§4.28). */
  reprendre(etat: EtatPort, avancement: number, cours: Partial<Cours>): void {
    this.etat = etat;
    this.avancement = avancement;
    for (const ressource of RESSOURCES) {
      this.cours[ressource] = borner(cours[ressource] ?? 1);
    }
  }

  /**
   * Une journee passe : les cours derivent.
   *
   * Une marche aleatoire **avec rappel vers 1** : sans le rappel, un cours finit
   * colle a une borne et y reste, et il cesse de raconter quoi que ce soit.
   */
  passerLaJournee(rng: Rng): void {
    const r = REGLAGES_PORT;
    for (const ressource of RESSOURCES) {
      const actuel = this.cours[ressource];
      const rappel = (1 - actuel) * r.retourALaMoyenne;
      // La remontee apres une grosse vente est incluse dans le rappel : un cours
      // enfonce revient vers 1, donc il se releve tout seul.
      const bruit = rng.range(-r.deriveParJournee, r.deriveParJournee);
      this.cours[ressource] = borner(actuel + rappel + bruit + this.remontee(actuel));
    }
  }

  /** Ce qu'un cours enfonce regagne en plus du rappel, une journee durant. */
  private remontee(actuel: number): number {
    return actuel < 1 ? REGLAGES_PORT.remonteeParJournee : 0;
  }

  /**
   * On vend.
   *
   * @param quantite ce qu'on charge, borne au stock disponible
   * @returns les pieces gagnees et ce qui est reellement parti
   */
  vendre(
    ressource: Ressource,
    quantite: number,
    stocks: Stocks,
  ): { pieces: number; unites: number } {
    if (!this.debout || !this.navireAQuai) return { pieces: 0, unites: 0 };

    const demande = Math.min(Math.floor(quantite), Math.floor(stocks[ressource]));
    if (demande <= 0) return { pieces: 0, unites: 0 };

    // ⚠️ **La vente s'ecoule par tranches, et ce n'est pas un detail.** Une
    // premiere version calculait le prix une fois puis baissait le cours a la
    // fin : solder deux mille bois **en un seul clic** rapportait donc le plein
    // tarif, quand les vendre en dix fois rapportait moins. Le joueur n'aurait
    // eu qu'a tout vendre d'un coup pour echapper entierement a l'impact — soit
    // exactement la faille que le plafond de cargaison fermait (§4.18). Trouve
    // par un test, pas en jouant.
    //
    // Le nombre de tranches est borne : une vente reste un geste du joueur, pas
    // une boucle par image, mais rien ne justifie d'iterer cent mille fois.
    const base = REGLAGES_PORT.unitesParPiece[ressource];
    const tranche = Math.max(base, Math.ceil(demande / 200));

    // ⚠️ On accumule en **flottant**, et on n'arrondit qu'a la fin. Arrondir
    // chaque tranche vers le bas la vidait de sa valeur des que le cours passait
    // sous 1 : la vente s'arretait toute seule au milieu du chargement.
    let gainExact = 0;
    let unites = 0;
    while (unites < demande) {
      const lot = Math.min(tranche, demande - unites);
      const gain = (lot / base) * this.cours[ressource];
      gainExact += gain;
      unites += lot;
      this.cours[ressource] = borner(
        this.cours[ressource] - gain * REGLAGES_PORT.impactParPiece,
      );
    }

    const pieces = Math.floor(gainExact);
    // Trop peu pour valoir une piece : on ne prend pas la marchandise. Sinon on
    // brade gratuitement, et le port devient une poubelle.
    if (pieces <= 0) return { pieces: 0, unites: 0 };

    stocks[ressource] -= unites;
    return { pieces, unites };
  }
}

function borner(valeur: number): number {
  return Math.max(REGLAGES_PORT.coursMin, Math.min(REGLAGES_PORT.coursMax, valeur));
}

/**
 * Le village est-il assez calme pour qu'une voile approche ? (§4.18)
 *
 * Trois conditions a la fois, et la troisieme est celle qui coute : **les marins
 * evitent ce qui saigne**. Une mauvaise nuit coupe donc le commerce en meme
 * temps que les arrivees — c'est assumé, et c'est pourquoi la memoire employee
 * ici est la courte, celle du village.
 */
export function calmePourUnNavire(etat: {
  phase: "jour" | "nuit";
  monstresDebout: number;
  journeesDesMorts: readonly number[];
  journee: number;
}): boolean {
  if (etat.phase !== "jour") return false;
  if (etat.monstresDebout > 0) return false;
  return !etat.journeesDesMorts.some(
    (jour) => etat.journee - jour < REGLAGES_PORT.memoireDesMorts,
  );
}

/**
 * Une voile veut-elle paraitre aujourd'hui ?
 *
 * Tire **une fois par journee, a l'aube**, et non a chaque image : le calme
 * decide seulement *quand* le navire accoste dans la journee, jamais s'il
 * vient. Sans ce tirage unique, un village calme en verrait un toutes les
 * secondes, et un village agite n'en verrait jamais.
 */
export function unNavireVeutVenir(rng: Rng): boolean {
  return rng.chance(REGLAGES_PORT.chanceParJournee);
}

/** Le cours, ecrit pour un humain. Il se lit sans legende. */
export function lireCours(valeur: number): string {
  if (valeur >= 1.35) return "au plus haut";
  if (valeur >= 1.1) return "en hausse";
  if (valeur > 0.9) return "stable";
  if (valeur > 0.75) return "en baisse";
  return "au plus bas";
}
