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
import type { EtatMeteo } from "./meteo";
import type { EtatEglise, NiveauEglise } from "./eglise";
import type { Matiere, TypeConstruction } from "./constructions";
import type { Fou } from "./arrivants";
import type { Cours, EtatPort } from "./port";
import type { EtatSubi } from "./etats";
import type { EtatCourSauve as EtatCour } from "../game/cour";
import type { Don } from "./dons";
import type { Evenement, Souvenir } from "./memoire";
import type { Lien } from "./relations";
import type { Metier, PostureCivile, Stocks } from "./habitants";
import type { Exploits, Personne, Rupture, Stats } from "./personne";
import { reagreger } from "./personne";
import { agreger } from "./traits";
import type { Posture } from "./ordres";
import type { CaseFouleeSauvee } from "./chemins";

/**
 * La version du format.
 *
 * ⚠️ **A monter des qu'un champ change de sens** — pas quand on en ajoute un
 * qu'on sait combler par un defaut. C'est ce numero qui permet de refuser
 * honnetement une sauvegarde qu'on ne sait pas lire.
 *
 * **2 — la nuit du 20 septembre 2026.** Aucun champ n'a change de sens : c'est
 * le **monde** qui a change. Le tirage se disait pur et dependait en fait du
 * monde deja charge (`monde.ts`, `placerLesPostes`) ; repare, il ne rend plus
 * la meme carte pour la meme graine. Or une sauvegarde ne garde pas sa carte,
 * elle garde **sa graine** : une partie d'avant reprendrait avec son heros, ses
 * habitants et ses murs poses sur une geographie qui n'est plus la leur — un
 * village au milieu d'un lac, des postes dans la roche. Mieux vaut la refuser,
 * et le dire.
 */
export const VERSION_SAUVEGARDE = 2;

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
  /**
   * Son identite sociale (§4.26). **Optionnelle** : une sauvegarde d'avant le
   * 21 septembre 2026 au soir n'en portait pas, et on lui en donne une neuve —
   * elle n'a de toute facon aucune relation a retrouver.
   */
  identite?: string;
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
  /**
   * Son don (§4.1). Absent d'une sauvegarde d'avant le 21 septembre 2026 :
   * elle n'en portait pas, et le retirer au sort au rechargement ferait
   * apparaitre des heros la ou il n'y en avait pas.
   */
  don?: Don | null;
  /**
   * Ses souvenirs (§4.26, bloc 11). Absents d'une sauvegarde d'avant le
   * 21 septembre 2026 au soir : elle reprend avec une memoire vierge, ce qui
   * est le seul comportement honnete — on ne fabrique pas un passe.
   */
  souvenirs?: Souvenir[];
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
  /** Les emplacements d'actives (§4.13). Absent dans une sauvegarde d'avant le 19 septembre 2026 : quatre. */
  emplacements?: number;
  /** L'evolution choisie, par identifiant de competence. On garde l'id, pas la definition */
  evolutions: Record<string, string>;
  posture: Posture;
  ancre: { x: number; y: number } | null;
  /**
   * Le poste auquel on l'a affecte (§4.4, bloc 8). Absent d'une sauvegarde
   * d'avant le 21 septembre 2026 : il se bat, comme avant.
   */
  travail?: Metier | null;
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
  /** Le palier du segment (§4.20). Absent dans une sauvegarde d'avant le 19 septembre 2026 : du bois. */
  matiere?: Matiere;
  /** Une douve en eau (§4.20, bloc 7b). Absent : seche. */
  eau?: boolean;
  /** Une porte devenue pont-levis (§4.20, bloc 7b). Absent : une porte. */
  pontLevis?: boolean;
}

export interface EtatChamp {
  x: number;
  y: number;
  maturite: number;
}

/** Une maison du village : debout avec ses points de vie, ou en ruine (§4.24). */
export interface EtatMaison {
  colonne: number;
  ligne: number;
  variante: number;
  ferme: boolean;
  pv: number;
  debout: boolean;
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
  /**
   * La graine du village (§4.24) : c'est elle qui redonne la meme enceinte et
   * les memes maisons a la reprise. **Optionnelle** : une partie d'avant le
   * generateur (18 septembre 2026) n'en a pas, et prend la graine zero.
   */
  graineVillage?: number;
  /**
   * La graine du monde (§4.29, 20 septembre 2026) : la mer, le relief, les
   * lacs, l'emplacement du village et des postes. **Optionnelle** : une partie
   * d'avant en a pas, et prend le monde classique — la carte d'avant.
   */
  graineMonde?: number;
  /**
   * La zone jouable de ce monde-la (§4.29, 20 septembre 2026) : elle s'est
   * **fermee a l'installation**, et elle ne change plus.
   *
   * **Optionnelle** : une partie d'avant ce jour a ete jouee sur la taille
   * classique, et doit la retrouver — la meme graine sur une autre zone rend
   * un autre monde, donc un village ailleurs et une sauvegarde qui ne colle
   * plus a sa carte.
   */
  zone?: { largeur: number; hauteur: number };
  /**
   * La consigne des portes (§4.20, bloc 7b) : fermees par la cloche, ou
   * ouvertes. Absent dans une sauvegarde d'avant le 20 septembre 2026 :
   * ouvertes — une partie enregistree a la tombee de la nuit a ses portes
   * ouvertes, la cloche n'a pas encore sonne.
   */
  portesFermees?: boolean;
  cycle: EtatCycle;
  /**
   * Le temps qu'il fait (§4.21, jalon 6). **Optionnel** : une sauvegarde
   * d'avant le ciel n'en a pas, et reprend au sec — la pluie est l'etat d'une
   * journee, pas un acquis qu'on perdrait.
   */
  meteo?: EtatMeteo;
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
  /**
   * La memoire du village (§4.26, bloc 11). **Optionnelles** : une partie
   * d'avant le 21 septembre 2026 au soir reprend sans passe social, ce qui est
   * le seul comportement honnete — on ne fabrique pas des liens qui n'ont pas
   * ete vecus.
   */
  relations?: [string, Lien][];
  archives?: Evenement[];
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
  /**
   * Les maisons, debout ou en ruine (§4.24). **Optionnel** : une partie d'avant
   * le 19 septembre 2026 n'en a pas, et reprend alors celles de son plan.
   */
  maisons?: EtatMaison[];
  /**
   * La cour d'entrainement et ses eleves (§4.18, bloc 9). **Optionnel** : une
   * partie d'avant le 21 septembre 2026 n'en a pas, et n'en avait pas.
   */
  cour?: EtatCour | null;
  /**
   * Les chemins qui s'usent (§4.24) : les cases visibles, leurs passages et
   * leur derniere journee. **Optionnel** : une partie d'avant le 20 septembre
   * 2026 n'en a pas, et repart de l'herbe.
   */
  chemins?: CaseFouleeSauvee[];
}

// ------------------------------------------------------------ ecrire et relire

export function serialiser(sauvegarde: Sauvegarde): string {
  return JSON.stringify(sauvegarde);
}

/** Pourquoi une sauvegarde n'a pas pu etre relue. */
export type RefusLecture = "vide" | "illisible" | "trop-recente" | "perimee" | "incomplete";

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

  // ⚠️ **Une sauvegarde d'un format plus ancien n'est pas rattrapable ici.**
  // Elle garde une graine, pas une carte : si le tirage du monde a change, son
  // village n'est plus au meme endroit que ses murs. On la refuse, et
  // `purgerLesPerimees` l'efface au demarrage plutot que de la laisser hanter
  // l'ecran des emplacements.
  if (candidat.version < VERSION_SAUVEGARDE) {
    return {
      ok: false,
      raison: "perimee",
      message: "Cette partie vient d'une ancienne version du monde et ne peut plus etre reprise.",
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

/**
 * Pour les sauvegardes d'avant les identites sociales (§4.26).
 *
 * Un nombre tres haut : il ne peut pas entrer en collision avec les identites
 * qu'une partie neuve distribue, et une vieille sauvegarde n'a de toute facon
 * aucune relation a retrouver.
 */
let prochaineIdentiteDeSecours = 900_000;

export function capturerPersonne(personne: Personne, maintenant: number): EtatPersonne {
  return {
    identite: personne.identite,
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
    don: personne.don ? { ...personne.don } : null,
    souvenirs: personne.souvenirs.map((s) => ({ ...s })),
  };
}

export function restaurerPersonne(etat: EtatPersonne, maintenant: number): Personne {
  const personne: Personne = {
    identite: etat.identite ?? `p${prochaineIdentiteDeSecours++}`,
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
    // Une sauvegarde d avant le 21 septembre 2026 n en portait pas : sans don,
    // et surtout pas un don tire au rechargement.
    don: etat.don ? { ...etat.don } : null,
    ruptures: etat.ruptures,
    exploits: { ...etat.exploits },
    souvenirs: (etat.souvenirs ?? []).map((s) => ({ ...s })),
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
