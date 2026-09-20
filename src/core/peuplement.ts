/**
 * Le village deja peuple (DESIGN.md §4.29, jalon 5.5).
 *
 * Jusqu'ici tout village commencait a **trois** habitants — un pecheur, un
 * bucheron, un mineur —, quel que soit le monde et quelle que soit la graine.
 * C'etait le village de ruines du §4.6, et c'etait le seul qui existait.
 *
 * Le §4.29 veut autre chose : on marche, on tombe sur un village, et **ce
 * qu'on voit de loin decide**. Sa taille est la premiere chose qui se voit —
 * avant les murs, avant le terrain. Il faut donc qu'elle change d'un monde a
 * l'autre, et qu'un village de seize ne ressemble pas a un village de deux.
 *
 * **De un a vingt** (decision d'Angelos, 20 septembre 2026) : du dernier
 * survivant — « Je suis le dernier ici », que `marche.ts` sait deja dire — au
 * village dont presque toutes les maisons tiennent encore debout.
 *
 * Ce fichier ne fabrique **personne**. Il dit seulement **combien ils sont**,
 * **ce que chacun fait** et **ce qu'il reste dans les reserves** ; les noms,
 * les visages et les traits sont distribues par `game/village.ts`, qui sait
 * seul quels prenoms sont deja portes (§4.18, `prenomLibre`).
 *
 * ⚠️ **Le tirage d'ici est provisoire, et c'est voulu.** Le §4.29 dit que la
 * population est un **cadeau qui se paie** : c'est le budget cadeaux/menaces
 * qui la decidera. `peuplerLeVillage` tire donc ce que le budget achetera
 * demain, et les deux entrees qu'il utilisera — `population` et `aisance` —
 * sont deja separees du reste pour qu'il n'y ait rien a defaire.
 */

import { REGLAGES_VILLAGE, stocksVides, type Metier, type Stocks } from "./habitants";
import { Rng } from "./rng";

export const REGLAGES_PEUPLEMENT = {
  /** Le dernier survivant d'un village : c'est une rencontre, pas un bug */
  min: 1,
  /** Le plus grand village qu'on puisse trouver (decision d'Angelos) */
  max: 20,
  /**
   * Combien de gens vivent sous un meme toit (decision d'Angelos, 20 septembre
   * 2026 : « trois ou quatre villageois peuvent partager la meme maison pour
   * les familles »).
   *
   * C'est la reponse a une mesure : un plan de village vise seize a vingt
   * maisons mais n'en pose que **six en moyenne, et jamais plus de quatorze**
   * (`.tmp/mesurer-maisons.ts`) — les regles de pose (jamais sur la rue, jamais
   * trois a la file, jamais contre l'eglise) laissent peu de places. Un toit
   * par tete etait donc impossible au-dela de six habitants.
   *
   * **Quatre**, le haut de la fourchette : c'est ce qui laisse toujours des
   * ruines a relever, meme dans un village de vingt (cinq foyers sur les six
   * maisons d'un plan moyen). A trois, un gros village n'aurait plus rien a
   * reconstruire.
   */
  parToit: 4,
  /**
   * De combien le tirage penche vers les petits villages.
   *
   * Le monde du jeu est un monde de ruines (§4.6) : un village de seize doit
   * etre une trouvaille, pas la moyenne. A 2, la moitie des villages tient
   * sous six habitants et les tres gros restent rares — sans jamais etre
   * impossibles, sinon la borne haute ne servirait a rien.
   */
  penteDuTirage: 2,
  /**
   * Les vivres d'un village au plus plein, en **jours** (§4.18).
   *
   * Trois jours : de quoi voir venir, jamais de quoi se passer de produire.
   * C'est compte avec le vrai appetit du §4.18, pour que le chiffre veuille
   * dire quelque chose au lieu d'etre un stock en l'air.
   */
  vivresMax: 3,
  /** Le bois garde par habitant, au plus : trois quarts d'une palissade par tete */
  boisParHabitant: 9,
  /** Le minerai garde par habitant, au plus */
  mineraiParHabitant: 3,
  /** La pierre gardee par habitant, au plus : elle sort de la mine, elle est rare */
  pierreParHabitant: 2,
};

/**
 * L'ordre dans lequel un village trouve distribue ses metiers.
 *
 * Ce n'est pas un tirage : c'est **ce qu'un village fait quand il ne reste
 * plus que trois personnes**, puis cinq, puis douze. On garde donc le trio
 * d'avant en tete — pecheur, bucheron, mineur —, pour qu'un village de trois
 * soit exactement celui qu'on connaissait.
 *
 * - **Le pecheur d'abord** : la peche est la source sure, celle qu'une horde
 *   ne pietine pas (`nourrir`, §4.18).
 * - **Le guetteur en quatrieme** : le premier luxe qu'on s'offre est quelqu'un
 *   qui regarde l'horizon.
 * - **Le fermier en cinquieme, et pas avant.** Les champs restent vides tant
 *   qu'on est trois : y mettre quelqu'un veut dire le retirer du bois ou du
 *   minerai, et c'est **la seule decision de production que le §4.18 accorde
 *   au joueur**. Elle ne vaudrait rien si le poste etait deja tenu.
 */
export const ORDRE_DES_METIERS: readonly Metier[] = [
  "pecheur",
  "bucheron",
  "mineur",
  "guetteur",
  "fermier",
  "charpentier",
  "forgeron",
];

/**
 * Les quatre metiers qui sortent travailler : ils ont un poste sur la carte.
 */
export const METIERS_QUI_RECOLTENT: readonly Metier[] = ["pecheur", "bucheron", "mineur", "fermier"];

/**
 * Les trois qui restent au village. Leur travail viendra au bloc 8 (§4.4) ;
 * d'ici la, ils sont **une presence**, et c'est deja beaucoup : un village se
 * juge de loin a ce qu'on voit vivre dedans (§4.29).
 */
export const METIERS_DU_VILLAGE: readonly Metier[] = ["guetteur", "charpentier", "forgeron"];

/** Ce qu'un village trouve a de gens et de reserves. */
export interface Peuplement {
  /** La graine de ce village-la : ses gens en sortent aussi (noms, visages, traits) */
  graine: number;
  /** Combien ils sont encore */
  population: number;
  /** Ce que fait chacun, dans l'ordre ou on les cree */
  metiers: Metier[];
  /** Ce qui reste dans les reserves */
  stocks: Stocks;
  /**
   * Ce qu'il leur reste, entre 0 (ils n'ont plus rien) et 1 (les reserves
   * sont pleines). Garde a part : c'est l'autre entree du budget.
   */
  aisance: number;
}

/**
 * Combien de toits il faut pour abriter tout ce monde (§4.29).
 *
 * Une maison est un **foyer**, pas un lit : trois ou quatre personnes y vivent.
 * Les autres maisons du plan restent en ruine — le village en est plein
 * (§4.6), et c'est ce que le joueur releve ou demolit.
 */
export function toitsPour(population: number): number {
  return Math.ceil(Math.max(0, population) / REGLAGES_PEUPLEMENT.parToit);
}

/**
 * Combien ils sont encore.
 *
 * Le tirage penche vers les petits villages (voir `penteDuTirage`) : le §4.29
 * fait du gros village un **cadeau**, et un cadeau qui tombe une fois sur deux
 * n'en est pas un.
 */
export function tirerLaPopulation(rng: Rng): number {
  const { min, max, penteDuTirage } = REGLAGES_PEUPLEMENT;
  const t = rng.next() ** penteDuTirage;
  return Math.round(min + (max - min) * t);
}

/**
 * Ce que fait chacun, pour une population donnee.
 *
 * Les sept premiers prennent les sept metiers, dans l'ordre. **Au-dela, un sur
 * deux sort et un sur deux reste** — un bras de plus a la mine, puis quelqu'un
 * de plus sur la place.
 *
 * ⚠️ **La moitie qui reste n'est pas un oubli, c'est le sujet.** Premiere
 * version : tous les bras en trop partaient recolter. Vu en capture — un
 * village de vingt montrait **quatre personnes**, les seize autres etant
 * eparpillees a la plage, a la mine et aux champs, hors de l'ecran. Un village
 * qu'on vient regarder de loin doit **se voir plein** (§4.29) ; et des bras
 * inoccupes sont exactement ce que le §4.18 donne au joueur a decider — c'est
 * meme la seule decision de production qu'il ait.
 */
export function metiersDe(population: number): Metier[] {
  const metiers: Metier[] = [];
  for (let i = 0; i < population; i++) {
    if (i < ORDRE_DES_METIERS.length) {
      metiers.push(ORDRE_DES_METIERS[i]!);
      continue;
    }
    const rang = i - ORDRE_DES_METIERS.length;
    const liste = rang % 2 === 0 ? METIERS_QUI_RECOLTENT : METIERS_DU_VILLAGE;
    metiers.push(liste[Math.floor(rang / 2) % liste.length]!);
  }
  return metiers;
}

/**
 * Ce qui reste dans les reserves.
 *
 * Les vivres se comptent **en jours** et non en unites : c'est le chiffre que
 * le joueur surveille (`joursDeVivres`, §4.10), et c'est le seul qui veuille
 * dire quelque chose quand la population change du simple au vingtuple.
 *
 * Le reste — bois, minerai, pierre — se compte par habitant : un village qui
 * a du monde a eu des bras pour rentrer du bois.
 *
 * @param aisance entre 0 (plus rien) et 1 (les reserves sont pleines)
 */
export function stocksDeDepart(population: number, aisance: number): Stocks {
  const r = REGLAGES_PEUPLEMENT;
  const part = Math.max(0, Math.min(1, aisance));
  const stocks = stocksVides();
  if (population <= 0) return stocks;

  // La nourriture, en jours de vivres pour tout le village. Le poisson d'abord
  // parce que c'est lui qu'on mange en premier (§4.18) : un village qui n'a
  // plus qu'un fond de reserve a du poisson, pas du ble en grange.
  const vivres = Math.round(population * REGLAGES_VILLAGE.appetit * r.vivresMax * part);
  stocks.poisson = Math.ceil(vivres * 0.6);
  stocks.ble = vivres - stocks.poisson;

  stocks.bois = Math.round(population * r.boisParHabitant * part);
  stocks.minerai = Math.round(population * r.mineraiParHabitant * part);
  stocks.pierre = Math.round(population * r.pierreParHabitant * part);
  return stocks;
}

/**
 * Le village d'une graine : combien ils sont, ce qu'ils font, ce qu'il leur
 * reste.
 *
 * ⚠️ **Deterministe** : une meme graine rend le meme village, comme la carte
 * (§4.6, §4.29). C'est ce qui fait qu'on peut revenir sur un monde et le
 * retrouver tel qu'on l'a quitte — et c'est ce qui rend les captures et les
 * verifications au navigateur comparables d'une passe a l'autre.
 */
export function peuplerLeVillage(graine: number): Peuplement {
  const rng = new Rng(graine);
  const population = tirerLaPopulation(rng);
  // Les reserves se tirent a part de la population : un grand village affame
  // et un couple de survivants assis sur trois jours de vivres sont deux
  // rencontres que le §4.29 veut pouvoir produire.
  const aisance = rng.next();
  return {
    graine,
    population,
    metiers: metiersDe(population),
    stocks: stocksDeDepart(population, aisance),
    aisance,
  };
}
