/**
 * La sauvegarde (DESIGN.md §4.28).
 *
 * Ce fichier ne connait ni Phaser, ni le reseau, ni le `localStorage` : il
 * decrit **la forme** d'une partie enregistree, il sait l'ecrire, la relire et
 * comparer deux copies. Qui la range ou l'envoie, c'est l'affaire de
 * `src/game/sauvegarde.ts` et de `src/en-ligne/`.
 *
 * Trois regles portent tout le reste :
 *
 * - **un etat, jamais un journal.** Tout ce qui se recalcule reste dehors : la
 *   grille cuite, les textures, l'agregat des traits (`mods`, refait par
 *   `reagreger`), et les monstres vivants — une nuit se reconstitue a partir du
 *   cycle, elle ne se stocke pas monstre par monstre ;
 * - **le format a une version.** Une sauvegarde plus recente que le code qui la
 *   lit se refuse proprement, elle ne se charge jamais a moitie ;
 * - **on n'ecrase jamais une partie tout seul.** `comparer` ne choisit pas : il
 *   decrit les deux cotes et laisse le joueur trancher.
 */

import type { ClassId, EtatHero, Rang } from "./classes";
import type { Phase } from "./cycle";
import type { EtatEglise, NiveauEglise } from "./eglise";
import type { TypeConstruction } from "./constructions";
import type { Fou } from "./arrivants";
import type { Cours, EtatPort } from "./port";
import type { EtatSubi } from "./etats";
import type { Metier, PostureCivile, Stocks } from "./habitants";
import type { Exploits, Personne, Rupture, Stats } from "./personne";
import { reagreger } from "./personne";
import { agreger } from "./traits";
import type { Posture } from "./ordres";

/**
 * La version du format.
 *
 * ⚠️ **A monter des qu'un champ change de sens** — pas quand on en ajoute un
 * qu'on sait combler par un defaut. C'est ce numero qui permet de refuser
 * honnetement une sauvegarde qu'on ne sait pas lire.
 */
export const VERSION_SAUVEGARDE = 1;

/** Trois parties en parallele (§4.28). La base en accepte trois, pas une de plus. */
export const EMPLACEMENTS = [1, 2, 3] as const;
export type Emplacement = (typeof EMPLACEMENTS)[number];

/**
 * Le plafond de la colonne `data` en base, en octets.
 *
 * Il est ecrit en dur dans une contrainte cote Supabase. Si on s'en approche,
 * c'est qu'on stocke de l'historique ou du recalculable : on allege, on ne
 * demande pas plus de place.
 */
export const TAILLE_MAX = 256 * 1024;

// ------------------------------------------------------------------- la forme

export interface EtatCycle {
  jour: number;
  phase: Phase;
  /** Millisecondes ecoulees dans la phase en cours */
  ecoule: number;
}

/**
 * La couche commune heros/habitants (§4.23).
 *
 * `mods` n'y est pas : c'est un agregat, `reagreger` le refait. `ruptureJusqua`
 * non plus — c'est un instant de l'horloge reelle, il ne veut rien dire d'une
 * session a l'autre. On enregistre **ce qu'il reste a tenir**, et la reprise le
 * recale sur son horloge a elle : sans ca, sauvegarder pendant une rupture
 * suffirait a l'annuler.
 */
export interface EtatPersonne {
  nom: string;
  nomChoisi: boolean;
  stats: Stats;
  traits: number[];
  /** La `Map` mise a plat : le JSON ne connait pas les `Map` */
  traitsTemporaires: [number, number][];
  sequelles: number[];
  etats: EtatSubi[];
  stress: number;
  rupture: Rupture | null;
  /** Millisecondes qu'il reste a tenir de la rupture en cours */
  ruptureRestante: number;
  ruptures: number;
  exploits: Exploits;
  grainePortrait: number;
}

export interface EtatHabitant {
  id: number;
  metier: Metier;
  rang: Rang;
  niveau: number;
  progression: number;
  posture: PostureCivile;
  vivant: boolean;
  rassasie: boolean;
  pv: number;
  /** L'identifiant du poste de travail (`POSTES`), ou null s'il n'en a pas */
  poste: string | null;
  personne: EtatPersonne;
}

export interface EtatHeros {
  classe: ClassId;
  niveau: number;
  xp: number;
  pv: number;
  kills: number;
  /** Un heros mort le reste : c'est la regle des 20% qui en depend (§4.3) */
  etat: EtatHero;
  choixEnAttente: number;
  /** Palier atteint pour chaque competence, par identifiant */
  competences: Record<string, number>;
  /** L'evolution choisie, par identifiant de competence. On garde l'id, pas la definition */
  evolutions: Record<string, string>;
  posture: Posture;
  ancre: { x: number; y: number } | null;
  pvGagnesProvocation: number;
  personne: EtatPersonne;
}

export interface EtatEgliseSauvee {
  niveau: NiveauEglise;
  etat: EtatEglise;
  pv: number;
  /** Avancement du relevement en cours, en millisecondes */
  avancement: number;
}

export interface EtatPortSauve {
  etat: EtatPort;
  /** Avancement du chantier en cours, en millisecondes */
  avancement: number;
  /** Le cours de chaque ressource, en part du prix de base */
  cours: Partial<Cours>;
}

export interface EtatConstruction {
  x: number;
  y: number;
  type: TypeConstruction;
  pv: number;
}

export interface EtatChamp {
  x: number;
  y: number;
  maturite: number;
}

/** Une partie enregistree, en entier. */
export interface Sauvegarde {
  version: number;
  /**
   * L'identifiant de la partie. Il ne change **jamais** tant qu'on joue la meme
   * partie, et c'est lui qui permet de distinguer « le cloud est en retard » de
   * « ce sont deux parties differentes » (§4.28).
   */
  partie: string;
  /** Monte de 1 a chaque enregistrement local. C'est la lignee, pas l'heure */
  revision: number;
  /** `Date.now()` de l'ecriture : sert a *dire* au joueur, jamais a decider */
  horodatage: number;
  /** Millisecondes de jeu cumulees sur cette partie */
  dureeJouee: number;
  /** L'etat du tirage, pour que la reprise continue la suite exacte */
  rng: number;
  cycle: EtatCycle;
  stocks: Stocks;
  kills: number;
  /**
   * Les journees ou quelqu'un est mort.
   *
   * C'est de l'etat, pas du journal : la satisfaction lit les morts recents
   * (§4.23). Sans elle, une nuit desastreuse serait oubliee au premier
   * rechargement. Bornee — au-dela de la fenetre de memoire, plus personne ne
   * la lit.
   */
  morts: number[];
  habitants: EtatHabitant[];
  /**
   * Ceux qu'on a laisses entrer et qui preparent quelque chose (§4.18).
   *
   * ⚠️ **C'est ce qui protege la porte de la regle ironman.** Sans ce champ,
   * recharger effacerait le meurtrier qu'on vient d'accepter : la seule
   * decision du bloc 6a s'annulerait d'un rafraichissement, exactement comme la
   * mort d'un heros s'annulerait sans le §4.28.
   *
   * **Optionnel** : une partie enregistree avant le bloc 6a n'a pas ce champ, et
   * son absence veut dire « personne » — ce qui est exactement vrai. Rien a
   * deviner, donc rien a versionner.
   */
  fous?: Fou[];
  /** La journee ou quelqu'un se presentera, ou null quand plus personne ne vient */
  prochaineArrivee?: number | null;
  /**
   * L'argent du village, gagne au port (§4.18) et depense a l'eglise (§4.22).
   *
   * **Optionnel**, comme `fous` : une partie d'avant le bloc 6b n'en a pas, et
   * son absence veut dire zero — ce qui est exactement vrai, puisque rien n'en
   * produisait.
   */
  argent?: number;
  /**
   * Le port : son etat, son chantier, et le cours de chaque ressource.
   *
   * ⚠️ **Le navire n'est pas enregistre**, et c'est volontaire : c'est un
   * instant, pas un etat. Il reparaitra quand le village sera calme — ce qui est
   * exactement sa regle (§4.18). L'enregistrer aurait fige une voile a quai pour
   * l'eternite chez un joueur qui ferme l'onglet au mauvais moment.
   */
  port?: EtatPortSauve;
  heros: EtatHeros[];
  /** L'index du heros incarne dans `heros` */
  incarne: number;
  eglise: EtatEgliseSauvee;
  constructions: EtatConstruction[];
  champs: EtatChamp[];
}

// ------------------------------------------------------------ ecrire et relire

export function serialiser(sauvegarde: Sauvegarde): string {
  return JSON.stringify(sauvegarde);
}

/** Pourquoi une sauvegarde n'a pas pu etre relue. */
export type RefusLecture = "vide" | "illisible" | "trop-recente" | "incomplete";

export type Lecture =
  | { ok: true; sauvegarde: Sauvegarde }
  | { ok: false; raison: RefusLecture; message: string };

/**
 * Relit une sauvegarde.
 *
 * ⚠️ **Elle ne jette jamais.** Une sauvegarde abimee doit donner un ecran qui
 * l'explique, pas une page blanche : c'est peut-etre quarante heures de jeu, le
 * joueur a droit a une phrase.
 */
export function lire(texte: string | null | undefined): Lecture {
  if (texte === null || texte === undefined || texte.trim() === "") {
    return { ok: false, raison: "vide", message: "Aucune partie enregistree ici." };
  }

  let brut: unknown;
  try {
    brut = JSON.parse(texte);
  } catch {
    return {
      ok: false,
      raison: "illisible",
      message: "Cette sauvegarde est abimee et n'a pas pu etre relue.",
    };
  }

  if (typeof brut !== "object" || brut === null) {
    return { ok: false, raison: "illisible", message: "Cette sauvegarde est abimee." };
  }

  const candidat = brut as Partial<Sauvegarde>;
  if (typeof candidat.version !== "number") {
    return { ok: false, raison: "illisible", message: "Cette sauvegarde n'a pas de version." };
  }

  if (candidat.version > VERSION_SAUVEGARDE) {
    return {
      ok: false,
      raison: "trop-recente",
      message:
        "Cette sauvegarde vient d'une version plus recente du jeu. Mettez le jeu a jour pour la reprendre.",
    };
  }

  if (!complete(candidat)) {
    return {
      ok: false,
      raison: "incomplete",
      message: "Cette sauvegarde est incomplete et ne peut pas etre reprise.",
    };
  }

  return { ok: true, sauvegarde: candidat };
}

/**
 * Le controle de completude.
 *
 * On ne devine **aucun** champ manquant en silence : mieux vaut refuser une
 * sauvegarde entiere que reprendre une partie a laquelle il manque ses
 * habitants.
 */
function complete(candidat: Partial<Sauvegarde>): candidat is Sauvegarde {
  return (
    typeof candidat.partie === "string" &&
    typeof candidat.revision === "number" &&
    typeof candidat.horodatage === "number" &&
    typeof candidat.rng === "number" &&
    typeof candidat.incarne === "number" &&
    typeof candidat.cycle === "object" &&
    candidat.cycle !== null &&
    typeof candidat.cycle.jour === "number" &&
    typeof candidat.stocks === "object" &&
    candidat.stocks !== null &&
    typeof candidat.eglise === "object" &&
    candidat.eglise !== null &&
    Array.isArray(candidat.habitants) &&
    Array.isArray(candidat.heros) &&
    Array.isArray(candidat.constructions) &&
    Array.isArray(candidat.champs)
  );
}

/** Le poids d'une sauvegarde une fois ecrite, en octets. */
export function taille(texte: string): number {
  // `TextEncoder` existe dans le navigateur comme dans Node : c'est le seul
  // compte juste, `length` compterait un accent pour un octet.
  return new TextEncoder().encode(texte).length;
}

/** Tient-elle dans la colonne `data` ? (§4.28) */
export function tientEnBase(texte: string): boolean {
  return taille(texte) <= TAILLE_MAX;
}

// --------------------------------------------------------------- la personne

export function capturerPersonne(personne: Personne, maintenant: number): EtatPersonne {
  return {
    nom: personne.nom,
    nomChoisi: personne.nomChoisi,
    stats: { ...personne.stats },
    traits: [...personne.traits],
    traitsTemporaires: [...personne.traitsTemporaires.entries()],
    sequelles: [...personne.sequelles],
    etats: personne.etats.map((etat) => ({ ...etat })),
    stress: personne.stress,
    rupture: personne.rupture,
    ruptureRestante:
      personne.rupture === null ? 0 : Math.max(0, personne.ruptureJusqua - maintenant),
    ruptures: personne.ruptures,
    exploits: { ...personne.exploits },
    grainePortrait: personne.grainePortrait,
  };
}

export function restaurerPersonne(etat: EtatPersonne, maintenant: number): Personne {
  const personne: Personne = {
    nom: etat.nom,
    nomChoisi: etat.nomChoisi,
    stats: { ...etat.stats },
    traits: [...etat.traits],
    traitsTemporaires: new Map(etat.traitsTemporaires),
    sequelles: [...etat.sequelles],
    etats: etat.etats.map((subi) => ({ ...subi })),
    stress: etat.stress,
    rupture: etat.rupture,
    ruptureJusqua: etat.rupture === null ? 0 : maintenant + etat.ruptureRestante,
    ruptures: etat.ruptures,
    exploits: { ...etat.exploits },
    grainePortrait: etat.grainePortrait,
    // Un agregat vierge, refait juste apres : `reagreger` est la seule ecriture
    // legitime de ce champ (§4.23).
    mods: agreger([], []),
  };
  reagreger(personne);
  return personne;
}

// ------------------------------------------------------------- la comparaison

/** De quoi decrire une sauvegarde a quelqu'un sans la charger. */
export interface Resume {
  jour: number;
  phase: Phase;
  population: number;
  /** La classe du heros incarne, pour la reconnaitre d'un coup d'oeil */
  classe: ClassId | null;
  herosVivants: number;
  horodatage: number;
  revision: number;
  partie: string;
}

export function resumer(sauvegarde: Sauvegarde): Resume {
  return {
    jour: sauvegarde.cycle.jour,
    phase: sauvegarde.cycle.phase,
    population: sauvegarde.habitants.filter((h) => h.vivant).length,
    classe: sauvegarde.heros[sauvegarde.incarne]?.classe ?? null,
    herosVivants: sauvegarde.heros.length,
    horodatage: sauvegarde.horodatage,
    revision: sauvegarde.revision,
    partie: sauvegarde.partie,
  };
}

/** « jour 14, 6 habitants, il y a 3 minutes » — la phrase qu'on met sous les yeux. */
export function decrire(resume: Resume, maintenant: number): string {
  const gens = resume.population > 1 ? "habitants" : "habitant";
  return `jour ${resume.jour}, ${resume.population} ${gens}, ${ilYA(resume.horodatage, maintenant)}`;
}

export function ilYA(horodatage: number, maintenant: number): string {
  const secondes = Math.max(0, Math.round((maintenant - horodatage) / 1000));
  if (secondes < 60) return "a l'instant";
  const minutes = Math.round(secondes / 60);
  if (minutes < 60) return `il y a ${minutes} min`;
  const heures = Math.round(minutes / 60);
  if (heures < 24) return `il y a ${heures} h`;
  const jours = Math.round(heures / 24);
  return jours === 1 ? "hier" : `il y a ${jours} jours`;
}

/**
 * Ce que deux copies racontent l'une par rapport a l'autre.
 *
 * `conflit` est le seul cas ou le joueur doit trancher — et c'est aussi le seul
 * cas ou une partie pourrait etre perdue. Tous les autres sont sans risque : on
 * n'ecrase que ce qui est **strictement en retard sur la meme lignee**.
 */
export type Divergence =
  | { genre: "rien" }
  | { genre: "local-seul"; local: Resume }
  | { genre: "cloud-seul"; cloud: Resume }
  | { genre: "identiques"; local: Resume; cloud: Resume }
  | { genre: "local-devant"; local: Resume; cloud: Resume }
  | { genre: "conflit"; local: Resume; cloud: Resume };

export function comparer(
  local: Sauvegarde | null,
  cloud: Sauvegarde | null,
): Divergence {
  if (local === null && cloud === null) return { genre: "rien" };
  if (cloud === null) return { genre: "local-seul", local: resumer(local!) };
  if (local === null) return { genre: "cloud-seul", cloud: resumer(cloud) };

  const a = resumer(local);
  const b = resumer(cloud);

  // Deux parties differentes : personne ne peut deviner laquelle compte.
  if (a.partie !== b.partie) return { genre: "conflit", local: a, cloud: b };
  if (a.revision === b.revision) return { genre: "identiques", local: a, cloud: b };

  // Le cloud est en retard sur la meme lignee : il n'a rien qu'on n'ait deja,
  // l'ecraser ne peut rien couter. C'est le seul ecrasement automatique du jeu.
  if (a.revision > b.revision) return { genre: "local-devant", local: a, cloud: b };

  // Le cloud est devant : on a joue ailleurs. Ca ne s'ecrase pas tout seul —
  // la partie locale est peut-etre celle qu'on voulait garder.
  return { genre: "conflit", local: a, cloud: b };
}
