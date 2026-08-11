/**
 * L'eglise, coeur du village (DESIGN.md §4.22).
 *
 * Elle porte quatre roles a elle seule : le refuge ou les civils **entrent**,
 * le seul lieu de soin, le lieu de la purge des etats, et le **cap des
 * monstres**. Tout le village converge dessus, y compris ce qui vient le
 * detruire.
 *
 * Ce fichier ne connait pas Phaser. Il ne sait ni ou elle est posee, ni a quoi
 * elle ressemble : il ne fait que tenir ses points de vie, son niveau et les
 * quatre conditions qui la font monter. C'est ce qui permet de tester la regle
 * la plus delicate du bloc — « elle tombe, elle se releve » — sans lancer le
 * moteur.
 */

import type { Ressource, Stocks } from "./habitants";

/** Les quatre niveaux du §4.22. Le niveau 1 est debout des la premiere minute. */
export type NiveauEglise = 1 | 2 | 3 | 4;

export const NIVEAU_MAX: NiveauEglise = 4;

/**
 * Dans quel etat elle est.
 *
 * `relevement` n'est pas un detail d'affichage : pendant tout ce temps elle ne
 * soigne pas, n'abrite personne et ne purge rien. C'est le vrai prix de sa
 * chute (§4.22).
 */
export type EtatEglise = "debout" | "ruine" | "relevement";

export interface PalierEglise {
  niveau: NiveauEglise;
  pvMax: number;
  /** Rayon de soin autour d'elle, en pixels */
  rayonSoin: number;
  /** Ce qu'elle rend de vie par seconde a un heros dans son rayon */
  soinParSeconde: number;
  /** Combien de blesses elle traite a la fois — la purge des etats viendra s'y brancher */
  lits: number;
  /**
   * Ce que ce niveau ajoute a la chance de tirer une competence rare.
   *
   * Le parametre `faveur` existe deja dans `tirerCompetences()` : le §4.22
   * promet que l'eglise l'alimente, il n'y a qu'a le brancher au jalon 9.
   */
  faveur: number;
}

/**
 * **La table de reglages de l'eglise.** Comme celle du cycle et celle de
 * l'economie, c'est le seul endroit a toucher pour la re-regler.
 *
 * Les chiffres viennent du §4.22 : 1200 PV et +600 par niveau, 90 px de rayon
 * de soin et +30 par niveau.
 *
 * Le rayon de soin est **plus petit que l'ancien cercle du village** (150 px) :
 * se soigner veut desormais dire rentrer sur la place, pas trainer au bord du
 * village. C'est le changement qu'on sentira le plus.
 */
export const PALIERS: Record<NiveauEglise, PalierEglise> = {
  1: { niveau: 1, pvMax: 1200, rayonSoin: 90, soinParSeconde: 9, lits: 1, faveur: 0 },
  2: { niveau: 2, pvMax: 1800, rayonSoin: 120, soinParSeconde: 12, lits: 2, faveur: 0.05 },
  3: { niveau: 3, pvMax: 2400, rayonSoin: 150, soinParSeconde: 15, lits: 3, faveur: 0.1 },
  4: { niveau: 4, pvMax: 3000, rayonSoin: 180, soinParSeconde: 18, lits: 4, faveur: 0.2 },
};

/**
 * Ce que coute son relevement une fois a terre (§4.22).
 *
 * 120 bois, c'est environ une journee de travail d'un bucheron ; une journee
 * entiere sans soin ni refuge, c'est assez lourd pour qu'on se batte a
 * l'eviter, pas assez pour que la partie soit finie.
 */
export const RELEVEMENT = {
  cout: { bois: 120 } as Partial<Record<Ressource, number>>,
  /** Duree en millisecondes : une journee complete du §4.19 */
  duree: 30 * 60_000,
};

/**
 * Les quatre conditions d'un niveau (§4.22).
 *
 * Ce n'est **pas un prix** : il faut les reunir toutes les quatre en meme
 * temps. Un cout unique se farme — on repete la meme action jusqu'a l'avoir ;
 * quatre conditions de natures differentes obligent a faire tourner tout le
 * village.
 */
export interface ConditionsNiveau {
  /** Ce qu'il faut payer en argent (§4.8, alimente par le port au bloc 6) */
  argent: number;
  /** Ce qu'il faut payer en materiaux */
  materiaux: Partial<Record<Ressource, number>>;
  /** Combien d'habitants vivants il faut : on ne batit pas une cathedrale a cinq */
  population: number;
  /** Le niveau de satisfaction exige, entre 0 et 100 (§4.23, alimente au bloc 5) */
  satisfaction: number;
}

/** Ce qu'il faut reunir pour passer **au** niveau indique. */
export const CONDITIONS: Record<2 | 3 | 4, ConditionsNiveau> = {
  2: { argent: 150, materiaux: { bois: 120, minerai: 40 }, population: 6, satisfaction: 40 },
  3: { argent: 400, materiaux: { bois: 260, minerai: 120 }, population: 12, satisfaction: 55 },
  4: { argent: 900, materiaux: { bois: 500, minerai: 300 }, population: 20, satisfaction: 70 },
};

/**
 * Ce que l'eglise a besoin de savoir du village pour dire si elle peut monter.
 *
 * `argent` et `satisfaction` sont **volontairement optionnels** : ils viennent
 * du port (bloc 6) et du stress (bloc 5), qui n'existent pas encore. Absents,
 * la condition correspondante est **neutralisee** plutot que bloquante — sinon
 * l'eglise ne monterait jamais d'ici le bloc 6. Le jour ou ces deux systemes
 * arrivent, ils n'ont qu'a remplir le champ : rien a recoder ici (§4.22).
 */
export interface ContexteMontee {
  stocks: Stocks;
  population: number;
  argent?: number;
  satisfaction?: number;
}

/** Pourquoi un niveau est refuse. Une par condition, pour que l'interface le dise. */
export type BlocageMontee = "niveau-max" | "a-terre" | "argent" | "materiaux" | "population" | "satisfaction";

export interface VerdictMontee {
  possible: boolean;
  /** Vide si c'est possible ; sinon tout ce qui manque, dans l'ordre du §4.22 */
  manque: BlocageMontee[];
}

/**
 * L'eglise, cote regles.
 *
 * Elle est **debout au niveau 1 des la construction** : sans elle il n'y aurait
 * ni refuge ni soins, et la partie serait injouable avant qu'on ait eu le temps
 * de batir quoi que ce soit (§4.22).
 */
export class Eglise {
  niveau: NiveauEglise = 1;
  etat: EtatEglise = "debout";
  pv: number = PALIERS[1].pvMax;
  /** Combien d'habitants sont dedans en ce moment (§4.18) */
  refugies = 0;
  /** Avancement du relevement en cours, en millisecondes */
  private avancement = 0;

  get palier(): PalierEglise {
    return PALIERS[this.niveau];
  }

  get pvMax(): number {
    return this.palier.pvMax;
  }

  get ratioPv(): number {
    return this.pv / this.pvMax;
  }

  /** Debout et en etat de rendre ses services. C'est le seul test a faire ailleurs. */
  get fonctionne(): boolean {
    return this.etat === "debout";
  }

  /** Le rayon de soin, nul quand elle est a terre : plus aucun soin (§4.22). */
  get rayonSoin(): number {
    return this.fonctionne ? this.palier.rayonSoin : 0;
  }

  /** Avancement du relevement, entre 0 et 1. Vaut 0 tant qu'il n'a pas commence. */
  get partRelevement(): number {
    return this.etat === "relevement" ? Math.min(1, this.avancement / RELEVEMENT.duree) : 0;
  }

  /**
   * Elle encaisse.
   *
   * @returns vrai si elle vient de tomber a cet instant precis
   */
  encaisser(degats: number): boolean {
    if (!this.fonctionne) return false;

    this.pv -= degats;
    if (this.pv > 0) return false;

    this.pv = 0;
    this.etat = "ruine";
    // Ceux qui s'etaient mis dedans se retrouvent dehors, au milieu d'eux.
    this.refugies = 0;
    return true;
  }

  /**
   * On commence a la relever (§4.22).
   *
   * Le bois est preleve **au demarrage** et non a l'arrivee : sinon le joueur
   * pourrait lancer le chantier, depenser son bois ailleurs pendant la journee,
   * et recuperer son eglise gratuitement.
   *
   * @returns vrai si le chantier a demarre
   */
  lancerRelevement(stocks: Stocks): boolean {
    if (this.etat !== "ruine") return false;
    if (!aDeQuoiPayer(RELEVEMENT.cout, stocks)) return false;

    prelever(RELEVEMENT.cout, stocks);
    this.etat = "relevement";
    this.avancement = 0;
    return true;
  }

  /**
   * Le chantier avance.
   *
   * @param delta millisecondes ecoulees
   * @returns vrai si elle vient de se remettre debout
   */
  majorer(delta: number): boolean {
    if (this.etat !== "relevement") return false;

    this.avancement += delta;
    if (this.avancement < RELEVEMENT.duree) return false;

    // Elle repart au meme niveau : la chute coute une journee et beaucoup de
    // bois, elle ne fait pas perdre la progression d'une partie entiere.
    this.etat = "debout";
    this.pv = this.pvMax;
    this.avancement = 0;
    return true;
  }

  /** Elle se repare toute seule au calme, mais lentement. */
  reparer(montant: number): void {
    if (!this.fonctionne) return;
    this.pv = Math.min(this.pvMax, this.pv + montant);
  }

  /**
   * Peut-elle monter d'un niveau ?
   *
   * Les quatre conditions sont evaluees ensemble, et **tout** ce qui manque est
   * renvoye : l'interface doit pouvoir dire au joueur ce qui bloque, pas
   * seulement qu'il manque quelque chose.
   */
  peutMonter(ctx: ContexteMontee): VerdictMontee {
    const manque: BlocageMontee[] = [];

    if (this.niveau >= NIVEAU_MAX) return { possible: false, manque: ["niveau-max"] };
    if (!this.fonctionne) return { possible: false, manque: ["a-terre"] };

    const requis = CONDITIONS[(this.niveau + 1) as 2 | 3 | 4];

    // Neutralisees tant que le port (bloc 6) et le stress (bloc 5) n'existent
    // pas : `undefined` veut dire « ce systeme n'est pas la », pas « zero ».
    if (ctx.argent !== undefined && ctx.argent < requis.argent) manque.push("argent");
    if (!aDeQuoiPayer(requis.materiaux, ctx.stocks)) manque.push("materiaux");
    if (ctx.population < requis.population) manque.push("population");
    if (ctx.satisfaction !== undefined && ctx.satisfaction < requis.satisfaction) {
      manque.push("satisfaction");
    }

    return { possible: manque.length === 0, manque };
  }

  /**
   * Elle monte d'un niveau, et elle paie.
   *
   * Ses points de vie montent du **meme montant** que son maximum plutot que de
   * se remplir : une eglise qu'on ameliore a moitie cassee ne doit pas se
   * reparer gratuitement au passage.
   *
   * @returns vrai si elle a monte
   */
  monter(ctx: ContexteMontee): boolean {
    if (!this.peutMonter(ctx).possible) return false;

    const suivant = (this.niveau + 1) as NiveauEglise;
    prelever(CONDITIONS[suivant as 2 | 3 | 4].materiaux, ctx.stocks);
    // ⚠️ **L'argent n'est pas preleve ici, et c'est l'appelant qui doit le
    // faire** (voir `coutEnArgent`). `ctx.argent` est un nombre, pas la bourse
    // du village : ce fichier n'a aucun moyen d'ecrire dedans, et lui en donner
    // un voudrait dire faire entrer l'economie entiere dans l'eglise.

    const gain = PALIERS[suivant].pvMax - this.pvMax;
    this.niveau = suivant;
    this.pv += gain;
    return true;
  }

  /**
   * L'avancement du chantier, en millisecondes (§4.28).
   *
   * Il est prive parce que rien, en jeu, n'a de raison de l'ecrire — sauf la
   * sauvegarde, qui doit reprendre un relevement la ou il en etait plutot que
   * de le faire recommencer une journee entiere.
   */
  get chantier(): number {
    return this.avancement;
  }

  /** Reprend l'etat d'une sauvegarde. **Aucun autre appelant que la reprise.** */
  reprendre(niveau: NiveauEglise, etat: EtatEglise, pv: number, chantier: number): void {
    this.niveau = niveau;
    this.etat = etat;
    this.pv = Math.max(0, Math.min(pv, this.pvMax));
    this.avancement = chantier;
    this.refugies = 0;
  }
}

// ------------------------------------------------------------------ paiement

/** A-t-on de quoi payer ce cout ? */
/**
 * Ce que coute en argent le passage a ce niveau (DESIGN.md §4.22, §4.18).
 *
 * Il vit a cote de `monter` et non dedans : l'argent du village est tenu par la
 * scene (§4.8 le range avec l'XP et les materiaux, pas avec les ressources
 * recoltees), et `monter` ne recoit qu'un nombre. L'appelant preleve donc
 * lui-meme — mais il n'a pas a savoir ou le chiffre est ecrit.
 */
export function coutEnArgent(niveauVise: NiveauEglise): number {
  return niveauVise === 1 ? 0 : CONDITIONS[niveauVise].argent;
}

export function aDeQuoiPayer(
  cout: Partial<Record<Ressource, number>>,
  stocks: Stocks,
): boolean {
  return Object.entries(cout).every(
    ([ressource, montant]) => stocks[ressource as Ressource] >= (montant ?? 0),
  );
}

/** Retire le cout des stocks. A n'appeler qu'apres `aDeQuoiPayer`. */
export function prelever(
  cout: Partial<Record<Ressource, number>>,
  stocks: Stocks,
): void {
  for (const [ressource, montant] of Object.entries(cout)) {
    stocks[ressource as Ressource] -= montant ?? 0;
  }
}

/**
 * Le cout, ecrit pour un humain : « 120 bois, 40 minerai ».
 *
 * Nomme `lireCout` et non `coutLisible` : `core/constructions.ts` a deja une
 * fonction de ce nom, mais qui prend une *definition* de construction. Deux
 * fonctions homonymes aux signatures differentes dans le meme fichier appelant,
 * c'est la garantie d'appeler la mauvaise un jour.
 */
export function lireCout(cout: Partial<Record<Ressource, number>>): string {
  return Object.entries(cout)
    .map(([ressource, montant]) => `${montant} ${ressource}`)
    .join(", ");
}
