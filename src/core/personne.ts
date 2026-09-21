/**
 * Ce qu'un heros et un habitant ont en commun (DESIGN.md §4.23).
 *
 * **Les deux populations partagent le meme systeme**, et c'est le point de tout
 * le bloc 5 : trois statistiques, des traits, des sequelles, une jauge de
 * stress, des etats. Un heros a en plus ses competences et sa classe ; un
 * habitant a en plus son metier et sa cadence. Le reste est ici, une seule fois.
 *
 * Ce fichier ne connait pas Phaser. Il compte en **minutes reelles** pour le
 * stress et en **journees de jeu** pour les etats — deux unites, parce que ce
 * sont deux rythmes differents et que les melanger a toujours fini en bug.
 */

import type { Rng } from "./rng";
import type { Souvenir } from "./memoire";
import { tirerLeDon, type Don } from "./dons";
import {
  agreger,
  idTrait,
  traitParId,
  TRAITS_DE_NAISSANCE,
  type CleTrait,
  type Modificateurs,
} from "./traits";
import {
  avancerEtats,
  contracter,
  effetsDesEtats,
  soigner,
  stressDesEtats,
  type CleEtat,
  type EtatSubi,
  type EvenementEtat,
} from "./etats";

/**
 * Les trois statistiques (DESIGN.md §4.23).
 *
 * ⚠️ **Elles sont en pourcentage**, et c'est une decision du 10 aout 2026 qui
 * remplace l'echelle 1-20 ecrite dans le document : un pourcentage se compare
 * d'un coup d'oeil entre deux fiches, un entier sans unite ne se compare a rien.
 * 100 % est le niveau d'un tres bon element ; rien n'interdit de le depasser, et
 * un veteran le depasse.
 */
export interface Stats {
  /** Les degats au combat, et la vitesse de recolte a la main */
  force: number;
  /** A quel seuil il decroche, s'il sort defendre, sa resistance au stress */
  courage: number;
  /** Il batit moins cher et monte de niveau plus vite */
  intelligence: number;
}

/**
 * Ce qui arrive quand la jauge est pleine (§4.23).
 *
 * **Seuls les heros deviennent dangereux.** Un villageois qui craque ne frappe
 * jamais personne — au pire il fuit son poste. Avec vingt habitants, l'autre
 * regle declencherait une spirale de meurtres internes qu'aucun joueur ne peut
 * arreter, et la partie se finirait sans qu'il ait rien decide.
 */
export type Rupture = "paranoia" | "terreur" | "rage" | "abattement" | "transcendance";

export const NOMS_RUPTURE: Record<Rupture, string> = {
  paranoia: "PARANOIA",
  terreur: "TERREUR",
  rage: "RAGE",
  abattement: "ABATTEMENT",
  transcendance: "TRANSCENDANCE",
};

/** Ce que chaque rupture fait, ecrit pour un humain, heros et civil separes. */
export const EFFETS_RUPTURE: Record<Rupture, { hero: string; civil: string }> = {
  paranoia: { hero: "refuse les ordres", civil: "refuse de sortir travailler" },
  terreur: { hero: "fuit le combat", civil: "lache son poste et se terre" },
  rage: { hero: "frappe les allies", civil: "se dispute, et stresse ses voisins" },
  abattement: { hero: "ne fait plus rien", civil: "ne fait plus rien" },
  transcendance: { hero: "se surpasse", civil: "travaille comme jamais" },
};

/**
 * **La table de reglages du stress.** Comme celle du cycle et celle de
 * l'economie, c'est le seul endroit a toucher pour la re-regler.
 *
 * Le calibrage retenu (decision du 10 aout 2026) : **six mauvaises nuits pour
 * craquer**. Une nuit dure 15 minutes reelles ; passee dehors avec des monstres
 * en vue, elle coute (0,5 + 0,35) x 15 ≈ 13 points, plus les coups encaisses,
 * soit environ 16. Une journee de repos complet en rend une dizaine — donc
 * quelqu'un qu'on laisse souffler s'en remet, et **seul celui qu'on n'arrete
 * jamais monte**. C'est exactement la pression que le §4.23 veut : faire tourner
 * les equipes plutot qu'exploiter les trois meilleurs.
 */
export const REGLAGES_STRESS = {
  /** A ce niveau, il craque */
  rupture: 100,
  /** A ce niveau, le coeur lache */
  coeur: 200,

  // ---- ce qui la fait monter, en points par minute reelle
  dehorsLaNuit: 0.5,
  menaceEnVue: 0.35,
  travailSansRepos: 0.1,
  faim: 0.4,
  /** Par coup encaisse — un horodatage, jamais une minuterie (§4.17) */
  parCoupEncaisse: 1.5,
  /** Un gros pic, pour tous ceux qui etaient la */
  parMortVue: 14,
  /** Rayon dans lequel on « etait la » quand quelqu'un meurt, en pixels */
  rayonDuDeuil: 420,

  // ---- ce qui la fait descendre, en points par minute reelle
  reposAuVillage: 0.35,
  /** Ce que l'eglise multiplie ; elle monte encore avec son niveau (§4.22) */
  multiplicateurEglise: 2.5,
  /** Manger a sa faim, une fois par jour */
  parRepas: 6,

  /**
   * Ce que le rang et le niveau ralentissent.
   *
   * « Plus le heros est puissant, plus sa jauge est lente a se remplir » —
   * et sa rupture n'en est que plus destructrice quand elle arrive (§4.23).
   */
  ralentissementParRang: 0.15,
  ralentissementParNiveau: 0.01,

  /** Combien de temps dure une rupture, en millisecondes reelles */
  dureeRupture: 120_000,

  /** Au-dela, la jauge se voit au-dessus de la tete — et seulement au-dela (§4.23) */
  seuilVisible: 60,
};

/**
 * Ce qu'une personne a fait, pour les traits d'exploit (§4.23).
 *
 * **La condition est toujours quelque chose que le joueur a fait**, jamais un
 * tirage : ces compteurs sont donc la seule source des traits gagnes.
 */
export interface Exploits {
  kills: number;
  /** Morts vues de ses propres yeux, dans le rayon du deuil */
  mortsVues: number;
  nuitsDehors: number;
  /** A-t-il deja passe une nuit entiere sous 20 % de vie ? */
  nuitSousLeSeuil: boolean;
  soinsRecus: number;
  /** Journees consecutives au meme poste */
  journeesAuPoste: number;
  incendiesEteints: number;
  dernierSurvivant: boolean;
  frontTenuSeul: boolean;
  posteDetruit: boolean;
}

function exploitsVierges(): Exploits {
  return {
    kills: 0,
    mortsVues: 0,
    nuitsDehors: 0,
    nuitSousLeSeuil: false,
    soinsRecus: 0,
    journeesAuPoste: 0,
    incendiesEteints: 0,
    dernierSurvivant: false,
    frontTenuSeul: false,
    posteDetruit: false,
  };
}

/**
 * La couche commune : ce que porte tout etre vivant du village.
 *
 * `mods` est **l'agregat**, et il est le seul champ que le code de jeu lit a
 * chaque image. Tout le reste ne sert qu'a le recalculer quand quelque chose
 * change — c'est la regle de fluidite du §4.23, et elle ne souffre aucune
 * exception.
 */
export interface Personne {
  /**
   * Son identite sociale, stable pour toute la partie (DESIGN.md §4.26).
   *
   * ⚠️ **Elle vit ici et pas sur le heros ni sur l'habitant**, et c'est tout
   * l'interet : un villageois qui s'eveille au bloc 9 garde sa `Personne`, donc
   * il **garde ses liens**. Un identifiant pose sur le corps aurait fait
   * disparaitre l'histoire de quelqu'un au moment precis ou elle devient
   * interessante.
   *
   * Elle ne remplace pas `hero.identifiant` : celui-la sert a l'**affinite**
   * (§4.16), qui est militaire, ne concerne que les heros et ne doit surtout
   * pas se confondre avec la relation, qui est sociale (§4.26).
   */
  identite: string;
  nom: string;
  /** Vrai si le joueur l'a renomme : on ne lui repropose pas un nom tire au sort */
  nomChoisi: boolean;
  stats: Stats;
  /** Identifiants numeriques, jamais du texte (§4.23) */
  traits: number[];
  /** Journees restantes pour les traits temporaires, par identifiant */
  traitsTemporaires: Map<number, number>;
  sequelles: number[];
  etats: EtatSubi[];
  /** De 0 a 200 ; a 100 il craque, a 200 le coeur lache */
  stress: number;
  rupture: Rupture | null;
  /** Instant reel de fin de la rupture en cours, en millisecondes */
  ruptureJusqua: number;
  /** Combien de fois il a craque. Le §4.12 s'en servira pour la bascule */
  ruptures: number;
  exploits: Exploits;
  /**
   * Ce qu'il garde de sa vie (DESIGN.md §4.26, bloc 11).
   *
   * ⚠️ **Huit au plus**, et les plus anciens sortent — sauf les fondateurs.
   * Sans ce plafond, trente habitants sur cinquante nuits produisent des
   * milliers d'entrees que personne ne lira jamais et qu'il faudra pourtant
   * parcourir. C'est `memoire.ts` qui tient la regle, jamais l'appelant.
   */
  souvenirs: Souvenir[];
  /** La graine de son portrait : deux personnes n'ont jamais la meme */
  grainePortrait: number;
  /**
   * Ce qu'elle porte sans le savoir (DESIGN.md §4.1, §4.29, `dons.ts`).
   *
   * ⚠️ **Un habitant sur dix**, et **personne ne le sait au depart** : rien ne
   * se lit sur sa fiche tant qu'il ne s'est pas eveille. C'est la seule source
   * de heros du jeu depuis le §4.29 — on ne devient pas heros a l'usure, on
   * nait avec un don.
   *
   * Un heros, lui, a le sien deja eveille : c'est ce qui le rend heros.
   */
  don: Don | null;
  /** L'agregat de tout ce qui precede. **Ne jamais l'ecrire a la main.** */
  mods: Modificateurs;
}

/**
 * Les prenoms qu'on tire, heros et habitants confondus.
 *
 * ⚠️ **Un heros porte un prenom, pas le nom de sa classe.** Vu en jouant : la
 * fiche affichait « Guerrier » en titre et « Guerrier · niveau 1 » juste en
 * dessous. Et surtout, le §4.18 promet qu'on s'attache a ses gens — on ne
 * s'attache pas a « Guerrier », on s'attache a Merlin. La classe reste, en
 * sous-titre, la ou elle sert : a dire ce qu'il sait faire.
 */
export const PRENOMS = [
  "Aubin", "Nine", "Gaspard", "Ombeline", "Merlin", "Sidonie", "Aldric",
  "Perrine", "Ysoret", "Colin", "Maelis", "Thibaut", "Enora", "Firmin",
  "Bertille", "Anselme", "Guenievre", "Tancrede", "Alix", "Renaud",
  "Jehanne", "Eudes", "Berthe", "Gauvain", "Isaure", "Foulques",
];

/**
 * Les syllabes, quand les vingt-six prenoms ecrits a la main sont tous portes.
 *
 * ⚠️ **La liste ecrite a la main passe toujours en premier**, et ce n'est pas
 * de la politesse : « Guenievre » et « Foulques » portent une epoque et un
 * pays qu'aucun assemblage de syllabes ne retrouve tout seul. Le generateur
 * n'est pas la pour faire mieux, il est la pour que le vingt-septieme habitant
 * ait un nom au lieu d'un homonyme — et le §4.18 ne pose **aucun plafond** de
 * population.
 *
 * Les tables sont taillees pour la meme phonologie que la liste : des attaques
 * qui existent en francais medieval, des finales qui sonnent nom propre. Deux
 * ou trois syllabes, plus quelques noms composes.
 */
const SYLLABES = {
  /** Ce par quoi un nom commence */
  tete: [
    "Al", "An", "Ar", "Au", "Ber", "Bau", "Cle", "Col", "Cons", "Del", "Eu",
    "Fal", "Flo", "Gar", "Gau", "Ger", "Gis", "Guil", "Hel", "Her", "Isa",
    "Jehan", "Lam", "Mar", "Mau", "Mel", "Nor", "Ode", "Per", "Rai", "Ren",
    "Rob", "Sil", "Tan", "Thi", "Ur", "Val", "Ver", "Yol", "Ys",
  ],
  /**
   * La liaison, posee **seulement quand la jointure la reclame**.
   *
   * ⚠️ Premiere version corrigee en regardant la sortie : une syllabe du milieu
   * tiree a chaque fois donnait « Robvasende » et « Isasehelm ». La regle est
   * phonologique, pas aleatoire — une voyelle ne s'intercale qu'entre deux
   * consonnes, sinon les deux morceaux se collent tres bien tout seuls.
   */
  liaison: ["e", "i", "o", "au", "ai", "e", "i"],
  /** L'autre jointure qui se heurte : deux voyelles qui se suivent */
  liant: ["l", "r", "n", "d", "b", "m"],
  /** Ce par quoi il finit */
  queue: [
    "aud", "ain", "ard", "as", "bert", "burge", "din", "gonde", "in", "is",
    "lin", "mond", "nard", "on", "quin", "rand", "sier", "son", "tin", "trude",
    "vine", "win", "gard", "lie", "mar", "nou", "rec", "sende",
  ],
} as const;

/** Un nom compose sur deux cents : assez pour surprendre, pas pour lasser. */
const CHANCE_COMPOSE = 0.005;

const VOYELLES = "aeiouy";

/**
 * Un prenom que personne ne porte deja.
 *
 * **C'est le seul endroit du jeu qui distribue un nom** — heros, habitants,
 * arrivants et survivants passent tous par ici. Avant, trois fichiers filtraient
 * chacun leur liste, et chacun oubliait une population : l'equipe de depart
 * ignorait le village, le village ignorait l'equipe, et un survivant ramene
 * pouvait s'appeler comme un heros. Vu en jouant, les trois fois.
 *
 * @param nomsPris tous les prenoms deja portes, toutes populations confondues
 */
export function prenomLibre(rng: Rng, nomsPris: readonly string[] = []): string {
  const ecrits = PRENOMS.filter((prenom) => !nomsPris.includes(prenom));
  if (ecrits.length > 0) return rng.pick(ecrits);

  // La liste est epuisee : on assemble. La borne d'essais existe parce qu'un
  // tirage seede qui boucle sans fin est un gel de partie, pas un ralenti.
  for (let essai = 0; essai < 60; essai++) {
    const propose = assemblerUnPrenom(rng);
    if (!nomsPris.includes(propose)) return propose;
  }
  return `${assemblerUnPrenom(rng)} ${assemblerUnPrenom(rng)}`;
}

function assemblerUnPrenom(rng: Rng): string {
  const simple = coller(rng.pick(SYLLABES.tete), rng.pick(SYLLABES.queue), rng);
  if (!rng.chance(CHANCE_COMPOSE)) return simple;
  return `${simple}-${coller(rng.pick(SYLLABES.tete), rng.pick(SYLLABES.queue), rng)}`;
}

/**
 * Deux morceaux, et ce qu'il faut entre eux — **rien, la plupart du temps**.
 *
 * Une jointure se heurte dans les deux sens, et les deux ont ete vues dans la
 * sortie avant d'etre corrigees : deux consonnes donnaient « Robsende », deux
 * voyelles donnaient « Auon ». Chaque cas recoit ce qui lui manque, et le cas
 * normal — consonne contre voyelle, ou l'inverse — ne recoit rien.
 */
function coller(tete: string, queue: string, rng: Rng): string {
  const finit = VOYELLES.includes(tete[tete.length - 1]!.toLowerCase());
  const commence = VOYELLES.includes(queue[0]!.toLowerCase());
  if (!finit && !commence) return tete + rng.pick(SYLLABES.liaison) + queue;
  if (finit && commence) return tete + rng.pick(SYLLABES.liant) + queue;
  return tete + queue;
}

/**
 * Le compteur des identites sociales (§4.26).
 *
 * ⚠️ **Il ne se remet pas a zero entre deux parties d'une meme session** — et
 * c'est voulu : deux identites egales dans deux parties differentes ne se
 * croisent jamais, mais une remise a zero au milieu d'une partie ferait se
 * confondre deux personnes vivantes. Les tests l'appellent explicitement.
 */
let prochaineIdentite = 1;

/** Pour les tests, et pour repositionner le compteur au-dessus d'une reprise. */
export function reserverIdentites(dernier: number): void {
  prochaineIdentite = Math.max(prochaineIdentite, dernier + 1);
}

/** Le numero d'une identite : `p12` rend 12. Zero si elle n'en a pas. */
export function numeroDIdentite(identite: string): number {
  const n = Number.parseInt(identite.slice(1), 10);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Combien de traits on nait avec.
 *
 * Deux en moyenne : assez pour que deux habitants ne se ressemblent pas, pas
 * assez pour qu'une fiche neuve soit deja illisible.
 */
const TRAITS_A_LA_NAISSANCE = { min: 1, max: 3 };

/**
 * Poids du tirage de naissance, par humeur du trait.
 *
 * ⚠️ Le §4.23 promet que **la plupart des traits sont mauvais**, mais la table
 * de naissance qu'il donne compte sept bons pour trois mauvais. Plutot que de
 * reecrire sa liste, on penche le tirage : un trait mauvais sort deux fois plus
 * souvent qu'un bon. L'intention est tenue, la liste du document aussi.
 */
const POIDS_HUMEUR = { bon: 1, mixte: 1.5, mauvais: 2 } as const;

/**
 * Une personne neuve.
 *
 * @param rng seede par l'appelant : une meme graine redonne le meme village,
 *   traits et portrait compris (§4.6 — on apprend son village comme sa carte)
 */
export function creerPersonne(nom: string, rng: Rng): Personne {
  const personne: Personne = {
    identite: `p${prochaineIdentite++}`,
    nom,
    nomChoisi: false,
    stats: {
      // Une fourchette large : c'est elle qui fait qu'on regarde une fiche
      // d'arrivant en se demandant ce qu'on va en faire (§4.10).
      force: Math.round(rng.range(20, 70)),
      courage: Math.round(rng.range(20, 70)),
      intelligence: Math.round(rng.range(20, 70)),
    },
    traits: [],
    traitsTemporaires: new Map(),
    sequelles: [],
    etats: [],
    stress: 0,
    rupture: null,
    ruptureJusqua: 0,
    ruptures: 0,
    exploits: exploitsVierges(),
    souvenirs: [],
    grainePortrait: Math.floor(rng.next() * 0x7fffffff),
    don: null,
    mods: agreger([], []),
  };

  const combien = rng.int(TRAITS_A_LA_NAISSANCE.min, TRAITS_A_LA_NAISSANCE.max);
  for (let i = 0; i < combien; i++) tirerTraitDeNaissance(personne, rng);

  // ⚠️ **Le don se tire ici et nulle part ailleurs**, et **en dernier**. Tout le
  // monde passe par `creerPersonne` — l'habitant du depart, l'arrivant a la
  // porte, le survivant de la route : le tirer ailleurs voudrait dire l'oublier
  // quelque part, et une des trois portes d'entree ne donnerait jamais de heros.
  //
  // En dernier, parce qu'un tirage de plus **decale toute la suite** : place
  // avant les traits, il changeait les traits de naissance de tout le monde a
  // graine egale. Vu en test, et c'est exactement ce que les tests seedes
  // servent a attraper.
  personne.don = tirerLeDon(rng);

  reagreger(personne);
  return personne;
}

function tirerTraitDeNaissance(personne: Personne, rng: Rng): void {
  const possibles = TRAITS_DE_NAISSANCE.filter((id) => !personne.traits.includes(id));
  if (possibles.length === 0) return;

  const poids = possibles.map((id) => POIDS_HUMEUR[traitParId(id)!.humeur]);
  const total = poids.reduce((a, b) => a + b, 0);
  let tirage = rng.next() * total;
  for (let i = 0; i < possibles.length; i++) {
    tirage -= poids[i]!;
    if (tirage <= 0) {
      personne.traits.push(possibles[i]!);
      return;
    }
  }
  personne.traits.push(possibles[possibles.length - 1]!);
}

/**
 * Recalcule l'agregat.
 *
 * ⚠️ **A appeler uniquement quand quelque chose change** : un trait gagne ou
 * perdu, une sequelle posee, un etat contracte, aggrave ou soigne. Jamais par
 * image (§4.23, §4.17).
 */
export function reagreger(personne: Personne): void {
  personne.mods = agreger(personne.traits, personne.sequelles, effetsDesEtats(personne.etats));
}

/**
 * Il gagne un trait.
 *
 * @returns vrai s'il ne l'avait pas deja
 */
export function gagnerTrait(personne: Personne, cle: CleTrait): boolean {
  const id = idTrait(cle);
  if (personne.traits.includes(id)) return false;

  personne.traits.push(id);
  const def = traitParId(id)!;
  if (def.duree !== undefined) personne.traitsTemporaires.set(id, def.duree);
  reagreger(personne);
  return true;
}

/** Il gagne une sequelle. Il n'y a **aucune** autre porte d'entree que le soin. */
export function poserSequelle(personne: Personne, id: number): void {
  if (personne.sequelles.includes(id)) return;
  personne.sequelles.push(id);
  reagreger(personne);
}

// ------------------------------------------------------------------- stress

/**
 * Le stress monte.
 *
 * @param points deja multiplies par le temps ecoule par l'appelant
 */
export function monterStress(personne: Personne, points: number): void {
  if (points <= 0) return;
  personne.stress = Math.min(REGLAGES_STRESS.coeur, personne.stress + points * personne.mods.monteeStress);
}

/**
 * Le stress descend — mais jamais sous son plancher.
 *
 * Le plancher vaut zero pour presque tout le monde ; un Regard vide le met a
 * 30 %, et cette sequelle-la ne s'efface jamais (§4.23).
 */
export function descendreStress(personne: Personne, points: number): void {
  if (points <= 0) return;
  const plancher = personne.mods.plancherStress;
  personne.stress = Math.max(plancher, personne.stress - points * personne.mods.descenteStress);
}

/**
 * Ce qui ralentit sa jauge, du fait de son rang et de son niveau.
 *
 * A multiplier par la montee. Un veteran tient bien plus longtemps que les
 * autres — et quand il tombe, il emporte la nuit avec lui (§4.23).
 */
export function resistanceAuStress(rang: number, niveau: number, stats: Stats): number {
  const { ralentissementParRang, ralentissementParNiveau } = REGLAGES_STRESS;
  const dur =
    1 +
    rang * ralentissementParRang +
    (niveau - 1) * ralentissementParNiveau +
    // Le Courage sert enfin a autre chose qu'a sortir defendre : a 100 % il
    // divise la montee par deux.
    stats.courage / 100;
  return 1 / dur;
}

/**
 * Ce que ses etats lui coutent en stress, par minute. Un simple relais, pour que
 * l'appelant n'ait pas a connaitre `etats.ts`.
 */
export function stressDesEtatsDe(personne: Personne): number {
  return stressDesEtats(personne.etats);
}

/**
 * Une mort sous ses yeux.
 *
 * C'est le gros pic du §4.23 — celui qui fait qu'une mauvaise nuit se paie
 * pendant des jours. Un Sang-Froid la paie moitie moins.
 *
 * @param facteur ce que la **relation** au mort multiplie (§4.26, bloc 11) : un
 *   ami se pleure deux fois plus, un frere davantage, et celui qu'on haissait
 *   moitie moins. Omis, la mort est celle d'un inconnu.
 */
export function voirMourir(personne: Personne, facteur = 1): void {
  personne.exploits.mortsVues += 1;
  monterStress(personne, REGLAGES_STRESS.parMortVue * personne.mods.stressParMort * facteur);
}

/**
 * Est-il en train de craquer, et si oui de quelle facon ?
 *
 * A appeler apres avoir fait monter la jauge. La rupture ne se declenche qu'une
 * fois par franchissement : tant qu'elle dure, on n'en tire pas une autre.
 *
 * @param maintenant l'horloge reelle, en millisecondes
 * @returns la rupture qui vient de commencer, ou null
 */
export function verifierRupture(personne: Personne, maintenant: number, rng: Rng): Rupture | null {
  if (personne.rupture !== null) {
    if (maintenant < personne.ruptureJusqua) return null;
    personne.rupture = null;
    // Craquer redescend la jauge sous le seuil : sinon il recraquerait dans
    // l'image suivante, indefiniment. Il reste haut, il n'est pas gueri.
    personne.stress = Math.max(personne.mods.plancherStress, REGLAGES_STRESS.rupture * 0.75);
    return null;
  }

  if (personne.stress < REGLAGES_STRESS.rupture) return null;

  const rupture = tirerRupture(rng);
  personne.rupture = rupture;
  personne.ruptureJusqua = maintenant + REGLAGES_STRESS.dureeRupture;
  personne.ruptures += 1;
  return rupture;
}

/**
 * Le tirage de la rupture.
 *
 * La transcendance est rare a dessein : si se surpasser tombait une fois sur
 * cinq, laisser quelqu'un craquer deviendrait une strategie.
 */
const POIDS_RUPTURE: [Rupture, number][] = [
  ["paranoia", 25],
  ["terreur", 25],
  ["rage", 20],
  ["abattement", 25],
  ["transcendance", 5],
];

function tirerRupture(rng: Rng): Rupture {
  const total = POIDS_RUPTURE.reduce((a, [, p]) => a + p, 0);
  let tirage = rng.next() * total;
  for (const [rupture, poids] of POIDS_RUPTURE) {
    tirage -= poids;
    if (tirage <= 0) return rupture;
  }
  return "abattement";
}

/** Le coeur lache : a 200 %, il meurt. */
export function coeurLache(personne: Personne): boolean {
  return personne.stress >= REGLAGES_STRESS.coeur;
}

// -------------------------------------------------------------------- etats

/** Il attrape quelque chose. */
export function contracterEtat(personne: Personne, cle: CleEtat): boolean {
  const change = contracter(personne.etats, cle);
  if (change) reagreger(personne);
  return change;
}

/**
 * L'eglise le soigne (§4.22).
 *
 * @returns l'identifiant de la sequelle laissee, ou null. **Non nul uniquement
 *   quand il etait Mourant** : c'est le prix de la survie in extremis.
 */
export function soignerEtat(personne: Personne, cle: CleEtat, rng: Rng): number | null {
  const resultat = soigner(personne.etats, cle, rng.next());
  if (!resultat.soigne) return null;

  personne.exploits.soinsRecus += 1;
  if (resultat.sequelle !== null) poserSequelle(personne, resultat.sequelle);
  reagreger(personne);
  return resultat.sequelle;
}

/**
 * Une journee passe : les etats s'aggravent, les traits temporaires s'usent.
 *
 * @param journees temps ecoule en journees de jeu
 * @returns ce qui est arrive aux etats, pour que l'appelant l'annonce
 */
export function avancerLaJournee(personne: Personne, journees: number): EvenementEtat[] {
  const evenements = avancerEtats(personne.etats, journees, personne.mods);

  let change = evenements.length > 0;
  for (const [id, restant] of personne.traitsTemporaires) {
    const reste = restant - journees;
    if (reste > 0) {
      personne.traitsTemporaires.set(id, reste);
      continue;
    }
    personne.traitsTemporaires.delete(id);
    personne.traits = personne.traits.filter((t) => t !== id);
    change = true;
  }

  if (change) reagreger(personne);
  return evenements;
}

// ----------------------------------------------------------------- exploits

/**
 * Les conditions des traits d'exploit (§4.23), toutes au meme endroit.
 *
 * Aucune n'est un tirage : chacune se lit dans les compteurs, et chaque
 * compteur est incremente par quelque chose que le joueur a fait.
 */
const CONDITIONS_EXPLOIT: [CleTrait, (e: Exploits) => boolean][] = [
  ["veteran", (e) => e.kills >= 200],
  ["boucher", (e) => e.kills >= 500],
  ["endurci", (e) => e.nuitSousLeSeuil],
  ["hante", (e) => e.mortsVues >= 3],
  ["insomniaque", (e) => e.nuitsDehors >= 10],
  ["pyromane", (e) => e.incendiesEteints >= 1],
  ["devot", (e) => e.soinsRecus >= 5],
  ["routinier", (e) => e.journeesAuPoste >= 30],
  ["marque", (e) => e.dernierSurvivant],
  ["legende-locale", (e) => e.frontTenuSeul],
  ["deracine", (e) => e.posteDetruit],
];

/**
 * Il vient peut-etre de gagner un trait.
 *
 * @returns les traits gagnes a cet instant, pour que l'appelant les annonce.
 *   Vide la plupart du temps — c'est un appel bon marche, mais il n'a pas sa
 *   place dans la boucle par image : on l'appelle a l'aube et sur evenement.
 */
export function verifierExploits(personne: Personne): CleTrait[] {
  const gagnes: CleTrait[] = [];
  for (const [cle, condition] of CONDITIONS_EXPLOIT) {
    if (!condition(personne.exploits)) continue;
    if (gagnerTrait(personne, cle)) gagnes.push(cle);
  }
  // Le Deracine est temporaire : une fois pose, on desarme la condition, sinon
  // il se reposerait a chaque aube pendant toute la partie.
  if (personne.exploits.posteDetruit) personne.exploits.posteDetruit = false;
  return gagnes;
}
