/**
 * Les survivants : la seule raison de sortir du village (DESIGN.md §4.18).
 *
 * Jusqu'ici le jour ne servait qu'a produire et a reparer, et tout se jouait
 * autour de l'eglise. Ce fichier est ce qui met le joueur **dehors,
 * volontairement, en plein jour**.
 *
 * Trois idees, et elles tiennent tout le bloc :
 *
 * 1. **On ne sait que la direction.** Pas de carte, pas de marqueur, pas de
 *    fleche : la discussion (§4.10) dit « quelque part au nord » et rien de
 *    plus. Un point sur une carte transformerait le sauvetage en trajet ; une
 *    direction en fait une **sortie**.
 * 2. **La meute est tiree au visu**, pas a l'apparition. Zero cout tant que le
 *    joueur ne regarde pas, et une decouverte brutale au lieu de progressive.
 * 3. **La fiche se rejoue a l'arrivee** : c'est le meme `Arrivant` que la
 *    porte, donc le meme code, les memes six indices et la meme part de fous.
 *    Ce qui change, c'est que **son etat est ecrit noir sur blanc** — la folie
 *    se devine, la maladie se lit.
 *
 * Ce fichier ne connait pas Phaser : il tire et il decrit. Ce qui marche, suit
 * et meurt vit dans `src/game/survivants.ts`.
 */

import { creerArrivant, type Arrivant } from "./arrivants";
import { CASE, COTES, estTerreFerme, MONDE, mondeCourant, VILLAGE, type Point } from "./carte";
import { pointDeLisiere, pointDuBord } from "./monde";
import type { CleEtat } from "./etats";
import type { Rng } from "./rng";

// --------------------------------------------------------------- les reglages

/**
 * **La table de reglages des survivants.** Comme celles du cycle, du port, du
 * stress et de la porte, c'est le seul endroit a toucher pour re-regler tout le
 * bloc — et c'est justement ce qu'il faut trancher en jouant (§6).
 */
export const REGLAGES_SURVIVANTS = {
  /**
   * Comment les trois situations se repartissent (§4.18).
   *
   * `seul` domine legerement : c'est celle qui laisse le joueur juger le trajet
   * sans autre variable. Si les trois se valaient, chaque sortie serait un
   * tirage a trois inconnues et plus personne ne saurait ce qu'il apprend.
   */
  poidsDesSituations: { seul: 40, poursuivi: 30, blesse: 30 },

  /**
   * Ce que porte un blesse, et ca ne coute pas du tout la meme chose.
   *
   * ⚠️ **La fongique n'est pas un troisieme etat, c'est un autre probleme.** Les
   * deux premiers sont un probleme qu'on ramene **pour soi** ; celui-la est un
   * probleme qu'on ramene **aux autres** (§4.23, la contagion entre voisins de
   * travail). C'est le premier usage reel de la contagion, ecrite au bloc 5 et
   * que rien ne declenchait.
   */
  poidsDesEtats: { hemorragie: 30, blessure: 45, infection: 25 },

  /**
   * La meute, tirage **plat** entre ces deux bornes (§4.18).
   *
   * Plat, donc environ **un sauvetage sur deux est infaisable** : on arrive, on
   * voit, on fait demi-tour — avec ce qu'on a reveille dans le dos. Le jeu est
   * assume hardcore et infinissable ; ce qui le rend juste, c'est que le tirage
   * est le meme a chaque fois et qu'il n'est jamais truque.
   *
   * ⚠️ **Le plafond est a 40 pour le §4.17 regle 1**, pas par gout : l'ecran est
   * limite a 60 monstres depuis le bloc 2, et une meute de 40 en mange les deux
   * tiers.
   */
  meute: { min: 2, max: 40 },

  /**
   * Le plancher que la porte n'a pas : un survivant tous les cinq jours, quoi
   * qu'il arrive.
   *
   * **Sans lui, un village sous 25 de reputation n'a plus aucune voie de
   * peuplement** — la porte se ferme (§4.18) et les naissances n'existent pas
   * avant le bloc 7 (§4.24). C'est un cul-de-sac dont rien ne le sort, et une
   * partie perdue une heure avant qu'elle s'arrete. Le plancher est la corde qui
   * reste : fine, dangereuse a saisir, mais reelle.
   */
  delaiPlancher: 5,

  /**
   * Ce qu'une mort en chemin coute a la rumeur : la **moitie** d'un habitant
   * tue (§4.18).
   *
   * A zero, echouer ne couterait que du temps et le sauvetage deviendrait un
   * ticket de loterie qu'on gratte sans reflechir. A plein tarif, echouer
   * couterait autant que perdre un des siens, on ne sortirait plus jamais, et le
   * bloc mourrait avec.
   */
  partDeRumeurDUneMortEnChemin: 0.5,

  /**
   * A quelle distance il se leve et se met a suivre.
   *
   * Un peu plus que la portee d'une attaque : on va **jusqu'a lui**, on ne le
   * ramasse pas en passant.
   */
  distanceDeContact: 40,

  /**
   * Sa vitesse, en part de celle du heros (§4.18).
   *
   * **Il est plus lent, et c'est tout le bloc** : c'est le trajet du retour qui
   * est dangereux, pas l'aller. A vitesse egale, ramener quelqu'un ne couterait
   * rien de plus que d'aller le voir.
   */
  partDeVitesse: 0.72,

  /** A quelle distance de lui il se colle, une fois qu'il suit */
  distanceDeSuite: 28,

  /** Ce qu'il encaisse avant de tomber. Derisoire : il ne se defend pas */
  pointsDeVie: 24,

  /** Marge depuis le bord de la carte : il parait au bord, pas dans le vide */
  margeDuBord: 26,
} as const;

// -------------------------------------------------------------- les situations

/** Dans quel etat on le trouve (§4.18). */
export type Situation = "seul" | "poursuivi" | "blesse";

/** Ce qu'un blesse porte. Ce sont des `CleEtat` de `etats.ts`, pas des noms neufs. */
export type EtatDuBlesse = Extract<CleEtat, "hemorragie" | "blessure" | "infection">;

/**
 * Ce qui s'affiche noir sur blanc sur sa fiche, a l'arrivee.
 *
 * ⚠️ **Ces phrases ne sont pas des indices.** Les six axes du §4.18 se lisent et
 * se doutent ; ceci se **constate**. Elles disent donc ce qu'il a, sans detour et
 * sans nuance — c'est ce qui rend le refus d'un malade une decision assumee et
 * non un pari de plus.
 */
export const ETAT_ANNONCE: Record<EtatDuBlesse, string> = {
  hemorragie: "Il saigne, et ca ne s'arrete pas. Il n'a pas la journee.",
  blessure: "Sa jambe est ouverte jusqu'a l'os. Il boitera longtemps.",
  infection: "Sa peau porte des plaques grises. Ca se transmet.",
};

/** Les quatre directions cardinales, telles que la discussion les dit (§4.10). */
export const NOMS_DIRECTION = {
  nord: "au nord",
  sud: "au sud",
  est: "a l'est",
  ouest: "a l'ouest",
} as const;

export type Direction = keyof typeof NOMS_DIRECTION;

// -------------------------------------------------------------- le survivant

/**
 * Quelqu'un qui appelle, au bord de la carte.
 *
 * ⚠️ **Il porte un `Arrivant`, il n'en est pas une copie.** La fiche
 * d'observation, les six indices, la banque de questions et les trois degres de
 * folie sont exactement ceux de la porte (§4.18) : un survivant peut etre fou
 * dans la meme proportion, et le joueur qui accepte tout ce qu'il a sauve par
 * attachement se fera avoir comme celui qui ouvre sa porte a tout le monde.
 */
export interface Survivant {
  arrivant: Arrivant;
  situation: Situation;
  /** `null` sauf s'il est blesse */
  etat: EtatDuBlesse | null;
  /** Ou il attend */
  point: Point;
  /** Ce que la discussion en dit, et la seule information donnee */
  direction: Direction;
  /**
   * La taille de la meute, **tiree au visu** et pas avant (§4.18).
   *
   * `null` veut dire « le joueur ne l'a pas encore vu », jamais « il n'y a
   * personne » — un survivant seul a une meute de 0 une fois vu.
   */
  meute: number | null;
}

/**
 * Quelqu'un parait, quelque part au bord.
 *
 * @param rng seede par l'appelant : une meme graine redonne le meme survivant,
 *   au meme endroit, avec le meme visage et les memes mensonges (§4.6)
 */
export function creerSurvivant(
  rng: Rng,
  journee: number,
  nomsPris: readonly string[] = [],
): Survivant {
  const situation = tirerSituation(rng);
  const point = tirerLePoint(rng);
  return {
    arrivant: creerArrivant(rng, journee, nomsPris),
    situation,
    etat: situation === "blesse" ? tirerLEtat(rng) : null,
    point,
    direction: directionDepuis(point),
    meute: null,
  };
}

/**
 * La meute, au moment ou le joueur a le visu.
 *
 * Un survivant **seul** n'en a pas ; un **blesse** non plus — ce qui le menace
 * est en lui. Seul le **poursuivi** en tire une, et c'est ce qui donne son sens
 * a la situation : les trois ne different pas par l'ambiance mais par ce qu'il
 * faut faire.
 */
export function tirerLaMeute(survivant: Survivant, rng: Rng): number {
  if (survivant.meute !== null) return survivant.meute;
  const { min, max } = REGLAGES_SURVIVANTS.meute;
  survivant.meute = survivant.situation === "poursuivi" ? rng.int(min, max) : 0;
  return survivant.meute;
}

/**
 * La journee ou le prochain survivant paraitra.
 *
 * Meme calcul que la porte — la reputation decide du rythme — **sauf qu'il ne
 * rend jamais `null`** : le plancher du §4.18 s'applique quoi qu'il arrive.
 *
 * @param delaiDeLaPorte ce que `delaiEntreArrivees` a rendu, `null` compris
 */
export function prochainSurvivant(
  delaiDeLaPorte: number | null,
  journee: number,
  rng: Rng,
): number {
  const plancher = REGLAGES_SURVIVANTS.delaiPlancher;
  const delai = delaiDeLaPorte === null ? plancher : Math.min(delaiDeLaPorte, plancher);
  // Meme bruit que la porte : sans lui, le joueur lirait l'horloge au lieu de
  // lire son village et saurait la veille qu'on appellera demain.
  return journee + Math.max(1, Math.round(delai * rng.range(0.8, 1.2)));
}

// ------------------------------------------------------------- les tirages

function tirerSituation(rng: Rng): Situation {
  const poids = REGLAGES_SURVIVANTS.poidsDesSituations;
  return tirerPondere(
    [
      ["seul", poids.seul],
      ["poursuivi", poids.poursuivi],
      ["blesse", poids.blesse],
    ],
    rng,
  );
}

function tirerLEtat(rng: Rng): EtatDuBlesse {
  const poids = REGLAGES_SURVIVANTS.poidsDesEtats;
  return tirerPondere(
    [
      ["hemorragie", poids.hemorragie],
      ["blessure", poids.blessure],
      ["infection", poids.infection],
    ],
    rng,
  );
}

function tirerPondere<T>(entrees: readonly (readonly [T, number])[], rng: Rng): T {
  const total = entrees.reduce((somme, [, poids]) => somme + poids, 0);
  let tirage = rng.next() * total;
  for (const [valeur, poids] of entrees) {
    tirage -= poids;
    if (tirage < 0) return valeur;
  }
  return entrees[entrees.length - 1]![0];
}

/**
 * Un point au bord de la carte, sur du sol qui porte.
 *
 * **N'importe quel bord praticable, pas seulement les deux fronts** (§4.18) : la
 * plage a l'ouest et les eboulis au sud comptent. C'est ce qui fait sortir le
 * joueur ailleurs que la ou les monstres entrent — sinon le sauvetage se
 * confondrait avec la defense.
 *
 * ⚠️ Le littoral et la montagne **ondulent** : un point calcule sur le rectangle
 * praticable peut tomber dans l'eau ou dans la roche. On tire donc jusqu'a
 * trouver de la terre ferme, avec un nombre d'essais borne — une boucle sans
 * borne dans un tirage seede est un gel de la partie qui n'arrive qu'une fois
 * sur mille.
 */
function tirerLePoint(rng: Rng): Point {
  const marge = REGLAGES_SURVIVANTS.margeDuBord;
  for (let essai = 0; essai < 40; essai++) {
    const point = pointDUnBord(rng, marge);
    if (point && estTerreFerme(point.x, point.y)) return point;
  }
  // Le repli : un point d'apparition du premier front, qui mene toujours au
  // village. Mieux vaut un survivant a un endroit banal qu'un survivant dans
  // la roche.
  const monde = mondeCourant();
  const front = monde.fronts[0] ?? "nord";
  return pointDuBord(monde, front, rng.next());
}

/**
 * Un point de lisiere tire au sort, **sur n'importe quel cote qui a une terre
 * reliee au village** (§4.29) : la premiere terre depuis le bord — la plage a
 * l'ouest du classique, le pied des eboulis au sud. Depuis que l'eau et la
 * roche peuvent border n'importe quel cote, un cote peut n'en avoir aucune :
 * on tire parmi ceux qui en ont, et on glisse d'un peu dans la case pour ne
 * pas toujours paraitre en son centre.
 */
function pointDUnBord(rng: Rng, marge: number): Point | null {
  const monde = mondeCourant();
  const cotes = COTES.filter((c) => monde.lisieres[c].length > 0);
  if (cotes.length === 0) return null;
  const cote = rng.pick(cotes);
  const point = pointDeLisiere(monde, cote, rng.next());
  if (!point) return null;
  const glisse = rng.range(-CASE / 2 + 4, CASE / 2 - 4);
  const horizontal = cote === "nord" || cote === "sud";
  const p = horizontal ? { x: point.x + glisse, y: point.y } : { x: point.x, y: point.y + glisse };
  return {
    x: Math.min(MONDE.largeur - marge, Math.max(marge, p.x)),
    y: Math.min(MONDE.hauteur - marge, Math.max(marge, p.y)),
  };
}

/**
 * Ou c'est, vu du village — et c'est **tout** ce que le joueur saura (§4.10).
 *
 * On compare les ecarts en valeur absolue : l'axe le plus marque gagne. Une
 * direction composee (« au nord-est ») serait plus juste et moins utile — elle
 * donnerait presque une position, ce que le §4.10 refuse explicitement.
 */
export function directionDepuis(point: Point, origine: Point = VILLAGE): Direction {
  const dx = point.x - origine.x;
  const dy = point.y - origine.y;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? "est" : "ouest";
  return dy > 0 ? "sud" : "nord";
}

/**
 * Ce que la discussion annonce a son apparition.
 *
 * Une ligne, et une seule. Elle ne dit ni la situation, ni l'etat, ni la
 * distance : les trois se decouvrent en allant voir.
 */
export function ligneDApparition(survivant: Survivant): string {
  return `Quelqu'un appelle, quelque part ${NOMS_DIRECTION[survivant.direction]}`;
}

/** Le rectangle du monde, pour qui veut borner un deplacement. */
export const BORNES_DU_MONDE = MONDE;
