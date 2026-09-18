/**
 * Le pont entre la partie en cours et sa sauvegarde (DESIGN.md §4.28).
 *
 * `src/core/sauvegarde.ts` decrit **la forme** d'une partie enregistree ; ce
 * fichier-ci sait la remplir a partir du monde vivant, et la reverser dedans.
 * C'est aussi lui qui parle au `localStorage` — la sauvegarde de reference,
 * celle qui n'a besoin ni de compte ni de reseau.
 *
 * Deux directions, une seule forme au milieu : si un champ manque d'un cote, il
 * manque des deux, et le test d'aller-retour du noyau le voit.
 */

import Phaser from "phaser";
import { CLASSES, type ClassId } from "../core/classes";
import { CONSTRUCTIONS } from "../core/constructions";
import { POSTES } from "../core/carte";
import { competenceParId } from "../core/competences";
import { Cycle } from "../core/cycle";
import type { Fou } from "../core/arrivants";
import type { BatimentPort } from "./port";
import { reserverIdentifiants, stocksVides, type Habitant } from "../core/habitants";
import { Rng } from "../core/rng";
import {
  EMPLACEMENTS,
  capturerPersonne,
  lire,
  restaurerPersonne,
  serialiser,
  tientEnBase,
  VERSION_SAUVEGARDE,
  type Emplacement,
  type EtatHabitant,
  type EtatHeros,
  type Lecture,
  type Sauvegarde,
} from "../core/sauvegarde";
import { Hero } from "./entities";
import type { BatimentEglise } from "./eglise";
import type { Champs } from "./champs";
import type { Constructions } from "./constructions";
import type { Maisons } from "./maisons";
import type { Village } from "./village";
import { EGLISE } from "../core/carte";

/**
 * Ce qu'il faut d'une partie pour l'enregistrer ou la reprendre.
 *
 * C'est volontairement une **interface**, pas la scene : `ArenaScene` fait 4000
 * lignes, et ce fichier n'a aucune raison de les connaitre. Ce contrat-la tient
 * en quinze champs, et il se lit.
 */
export interface PartieEnCours {
  scene: Phaser.Scene;
  equipe: Phaser.Physics.Arcade.Group;
  rng: Rng;
  cycle: Cycle;
  village: Village;
  eglise: BatimentEglise;
  constructions: Constructions;
  champs: Champs;
  /**
   * Les fous acceptes. Modifie **sur place** a la reprise, comme `heros` : la
   * scene tient cette meme reference (§4.18).
   */
  fous: Fou[];
  /** La journee de la prochaine arrivee, ou null. Relu par la scene a la reprise */
  prochaineArrivee: number | null;
  port: BatimentPort;
  /** L'argent du village. Relu par la scene a la reprise, comme `prochaineArrivee` */
  argent: number;
  /** Modifie **sur place** a la reprise : d'autres objets tiennent la reference */
  heros: Hero[];
  indexIncarne: number;
  kills: number;
  /** Millisecondes de jeu cumulees */
  dureeJouee: number;
  /** L'identite de la partie : elle traverse les enregistrements sans changer */
  partie: string;
  revision: number;
  /** La graine du village : elle non plus ne change jamais (§4.24) */
  graineVillage: number;
  /** Les maisons, debout ou en ruine : la scene les reprend a la construction (§4.24) */
  maisons: Maisons;
}

/** La memoire des morts qu'on garde : au-dela, la satisfaction ne la lit plus. */
const MORTS_MEMORISES = 32;

// ------------------------------------------------------------------ capturer

export function capturer(partie: PartieEnCours, maintenant: number): Sauvegarde {
  return {
    version: VERSION_SAUVEGARDE,
    partie: partie.partie,
    revision: partie.revision,
    horodatage: Date.now(),
    dureeJouee: partie.dureeJouee,
    rng: partie.rng.instantane,
    graineVillage: partie.graineVillage,
    cycle: {
      jour: partie.cycle.jour,
      phase: partie.cycle.phase,
      ecoule: partie.cycle.ecoule,
    },
    stocks: { ...partie.village.stocks },
    kills: partie.kills,
    morts: partie.village.memoireDesMorts.slice(-MORTS_MEMORISES),
    habitants: partie.village.habitants
      // Les morts ne sont plus que des corps au sol : leur fiche entiere ne sert
      // plus a rien, et c'est ce qui fait grossir une sauvegarde pour rien.
      .filter((villageois) => villageois.regles.vivant)
      .map((villageois) => capturerHabitant(villageois.regles, villageois.poste?.id ?? null, maintenant)),
    // Ceux dont on ne garde le secret que parce qu'ils sont encore la : un fou
    // dont l'habitant est mort ou parti ne sert plus a rien (§4.18).
    fous: partie.fous
      .filter((fou) => partie.village.parId(fou.id)?.regles.vivant === true)
      .map((fou) => ({ ...fou })),
    prochaineArrivee: partie.prochaineArrivee,
    argent: partie.argent,
    port: {
      etat: partie.port.regles.etat,
      avancement: partie.port.regles.chantier,
      cours: { ...partie.port.regles.cours },
    },
    heros: partie.heros.map((hero) => capturerHeros(hero, maintenant)),
    incarne: partie.indexIncarne,
    eglise: {
      niveau: partie.eglise.regles.niveau,
      etat: partie.eglise.regles.etat,
      pv: partie.eglise.regles.pv,
      avancement: partie.eglise.regles.chantier,
    },
    constructions: partie.constructions.toutes.map((construction) => ({
      x: construction.x,
      y: construction.y,
      type: construction.def.id,
      pv: construction.pv,
    })),
    maisons: partie.maisons.toutes.map((maison) => ({
      colonne: maison.colonne,
      ligne: maison.ligne,
      variante: maison.variante,
      ferme: maison.ferme,
      pv: maison.pv,
      debout: maison.debout,
    })),
    champs: partie.champs.tous.map((champ) => ({
      x: champ.x,
      y: champ.y,
      maturite: champ.maturite,
    })),
  };
}

function capturerHabitant(
  regles: Habitant,
  poste: string | null,
  maintenant: number,
): EtatHabitant {
  return {
    id: regles.id,
    metier: regles.metier,
    rang: regles.rang,
    niveau: regles.niveau,
    progression: regles.progression,
    posture: regles.posture,
    vivant: regles.vivant,
    rassasie: regles.rassasie,
    pv: regles.pv,
    poste,
    personne: capturerPersonne(regles.personne, maintenant),
  };
}

function capturerHeros(hero: Hero, maintenant: number): EtatHeros {
  const evolutions: Record<string, string> = {};
  for (const [competence, evolution] of Object.entries(hero.evolutions)) {
    evolutions[competence] = evolution.id;
  }

  return {
    classe: hero.classe.id,
    niveau: hero.niveau,
    xp: hero.xp,
    pv: hero.pv,
    kills: hero.kills,
    etat: hero.etat,
    choixEnAttente: hero.choixEnAttente,
    competences: { ...hero.competences },
    evolutions,
    posture: hero.ordre.posture,
    ancre: hero.ordre.ancre ? { x: hero.ordre.ancre.x, y: hero.ordre.ancre.y } : null,
    pvGagnesProvocation: hero.pvGagnesProvocation,
    personne: capturerPersonne(hero.personne, maintenant),
  };
}

// ------------------------------------------------------------------ reprendre

/**
 * Reverse une sauvegarde dans une partie **deja construite**.
 *
 * L'ordre compte : le monde est monte normalement par la scene (village de
 * depart compris), puis on le remplace piece par piece. Dupliquer la
 * construction en deux chemins — un neuf, un repris — aurait garanti qu'ils
 * divergent au premier systeme ajoute.
 *
 * @returns l'index du heros a incarner
 */
export function appliquer(
  sauvegarde: Sauvegarde,
  partie: PartieEnCours,
  maintenant: number,
): number {
  partie.rng = new Rng(sauvegarde.rng);
  partie.cycle.jour = sauvegarde.cycle.jour;
  partie.cycle.phase = sauvegarde.cycle.phase;
  partie.cycle.ecoule = sauvegarde.cycle.ecoule;

  // Les stocks sont un objet partage : on ecrit dedans, on ne le remplace pas.
  for (const cle of Object.keys(partie.village.stocks) as (keyof typeof partie.village.stocks)[]) {
    partie.village.stocks[cle] = sauvegarde.stocks[cle] ?? 0;
  }

  reprendreLesHabitants(sauvegarde, partie, maintenant);
  reprendreLesHeros(sauvegarde, partie, maintenant);

  // Sur place, comme les heros : la scene tient cette liste. Une sauvegarde
  // d'avant le bloc 6a n'a pas le champ, et « pas de champ » veut dire
  // « personne » — ce qui etait exactement vrai a l'epoque.
  partie.fous.length = 0;
  partie.fous.push(...(sauvegarde.fous ?? []).map((fou) => ({ ...fou })));
  partie.prochaineArrivee = sauvegarde.prochaineArrivee ?? null;

  partie.argent = sauvegarde.argent ?? 0;
  // Une partie d'avant le bloc 6b n'a pas de port : il repart en ruine, cours
  // neutres. C'est exactement ce qu'elle avait.
  const port = sauvegarde.port;
  partie.port.reprendre(port?.etat ?? "ruine", port?.avancement ?? 0, port?.cours ?? {});

  partie.eglise.reprendre(
    sauvegarde.eglise.niveau,
    sauvegarde.eglise.etat,
    sauvegarde.eglise.pv,
    sauvegarde.eglise.avancement,
  );

  reprendreLeBati(sauvegarde, partie);

  partie.kills = sauvegarde.kills;
  partie.dureeJouee = sauvegarde.dureeJouee;
  partie.partie = sauvegarde.partie;
  partie.revision = sauvegarde.revision;

  const incarne = partie.heros.findIndex((hero, index) => index === sauvegarde.incarne && hero.etat !== "mort");
  if (incarne !== -1) return incarne;
  // Le heros enregistre comme incarne est mort entre-temps : on prend le
  // premier debout plutot que de rendre un index qui ne designe personne.
  const secours = partie.heros.findIndex((hero) => hero.etat !== "mort");
  return secours === -1 ? 0 : secours;
}

function reprendreLesHabitants(
  sauvegarde: Sauvegarde,
  partie: PartieEnCours,
  maintenant: number,
): void {
  partie.village.vider();

  let dernierId = 0;
  for (const etat of sauvegarde.habitants) {
    const regles: Habitant = {
      id: etat.id,
      metier: etat.metier,
      rang: etat.rang,
      niveau: etat.niveau,
      progression: etat.progression,
      posture: etat.posture,
      vivant: etat.vivant,
      rassasie: etat.rassasie,
      pv: etat.pv,
      personne: restaurerPersonne(etat.personne, maintenant),
    };
    dernierId = Math.max(dernierId, etat.id);
    partie.village.ajouter(regles, POSTES.find((poste) => poste.id === etat.poste) ?? null);
  }

  reserverIdentifiants(dernierId);
  partie.village.reprendre(sauvegarde.cycle.jour, sauvegarde.morts);
}

function reprendreLesHeros(
  sauvegarde: Sauvegarde,
  partie: PartieEnCours,
  maintenant: number,
): void {
  for (const hero of partie.heros) hero.destroy();
  // Sur place : `Commandement` et la scene tiennent cette meme reference.
  partie.heros.length = 0;

  sauvegarde.heros.forEach((etat, index) => {
    const classe = CLASSES[etat.classe as ClassId];
    if (!classe) return;

    const angle = (index / Math.max(1, sauvegarde.heros.length)) * Math.PI * 2;
    const hero = new Hero(
      partie.scene,
      EGLISE.x + Math.cos(angle) * 60,
      EGLISE.y + Math.sin(angle) * 60,
      classe,
    );

    // Les competences se **rejouent**, palier par palier : c'est leur
    // application qui construit `bonus`, et un bonus recopie a la main aurait
    // derive au premier equilibrage.
    for (const [id, palier] of Object.entries(etat.competences)) {
      const def = competenceParId(id);
      if (!def) continue;
      for (let p = 0; p < palier; p++) hero.apprendre(def);
    }
    for (const [competenceId, evolutionId] of Object.entries(etat.evolutions)) {
      const def = competenceParId(competenceId);
      const evolution = def?.evolutions?.options.find((o) => o.id === evolutionId);
      if (evolution) hero.appliquerEvolution(competenceId, evolution);
    }

    // Apres les competences : `apprendre` touche aux points de vie et au compte
    // de choix en attente, c'est donc l'etat enregistre qui doit avoir le
    // dernier mot.
    hero.niveau = etat.niveau;
    hero.xp = etat.xp;
    hero.kills = etat.kills;
    hero.choixEnAttente = etat.choixEnAttente;
    hero.pvGagnesProvocation = etat.pvGagnesProvocation;
    hero.ordre = { posture: etat.posture, ancre: etat.ancre };
    Object.assign(hero.personne, restaurerPersonne(etat.personne, maintenant));
    hero.pv = Math.max(0, Math.min(etat.pv, hero.pvMax));

    if (etat.etat === "mort") hero.mourir();
    else hero.etat = etat.etat;
    hero.estIncarne = false;

    partie.heros.push(hero);
    partie.equipe.add(hero);
  });
}

function reprendreLeBati(sauvegarde: Sauvegarde, partie: PartieEnCours): void {
  // Une bourse fictive : `batir` et `semer` facturent, et ce qui est deja bati a
  // deja ete paye. Les vrais stocks ont ete poses juste avant, on n'y touche
  // plus.
  const bourse = stocksVides();
  const remplir = () => {
    bourse.bois = 9_999_999;
    bourse.minerai = 9_999_999;
    bourse.ble = 9_999_999;
    bourse.poisson = 9_999_999;
  };

  for (const etat of sauvegarde.constructions) {
    remplir();
    const construction = partie.constructions.batir(etat.x, etat.y, etat.type, bourse);
    if (construction) {
      construction.pv = Math.max(1, Math.min(etat.pv, CONSTRUCTIONS[etat.type].pvMax));
    }
  }

  for (const etat of sauvegarde.champs) {
    remplir();
    const champ = partie.champs.semer(etat.x, etat.y, bourse);
    if (champ) champ.maturite = etat.maturite;
  }
}

// ------------------------------------------------------------ le localStorage

/**
 * La sauvegarde de reference (§4.28).
 *
 * ⚠️ **Tout est enveloppe.** Un navigateur en navigation privee, un quota
 * plein, un `localStorage` desactive : ca lance, et un jeu ne doit pas mourir
 * parce qu'il n'a pas pu s'enregistrer. On perd la sauvegarde, pas la partie.
 */
const PREFIXE = "protecteur:sauvegarde:";

function cle(emplacement: Emplacement): string {
  return `${PREFIXE}${emplacement}`;
}

function rangement(): Storage | null {
  try {
    // L'acces lui-meme jette dans certains navigateurs : ce n'est pas une
    // verification qu'on peut faire autrement qu'en essayant.
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function ecrireEnLocal(emplacement: Emplacement, sauvegarde: Sauvegarde): boolean {
  const local = rangement();
  if (!local) return false;

  const texte = serialiser(sauvegarde);
  if (!tientEnBase(texte)) {
    console.warn("[sauvegarde] trop volumineuse pour la base, gardee en local seulement");
  }

  try {
    local.setItem(cle(emplacement), texte);
    return true;
  } catch {
    return false;
  }
}

export function relireEnLocal(emplacement: Emplacement): Lecture {
  const local = rangement();
  if (!local) return { ok: false, raison: "vide", message: "Aucune sauvegarde sur cet appareil." };

  try {
    return lire(local.getItem(cle(emplacement)));
  } catch {
    return { ok: false, raison: "illisible", message: "Cette sauvegarde n'a pas pu etre relue." };
  }
}

export function effacerEnLocal(emplacement: Emplacement): void {
  try {
    rangement()?.removeItem(cle(emplacement));
  } catch {
    // Rien a faire de plus : ne pas pouvoir effacer n'empeche pas de jouer.
  }
}

/** Ce qu'il y a dans les trois emplacements, pour l'ecran de depart. */
export function inventaire(): Map<Emplacement, Sauvegarde | null> {
  const tout = new Map<Emplacement, Sauvegarde | null>();
  for (const emplacement of EMPLACEMENTS) {
    const lecture = relireEnLocal(emplacement);
    tout.set(emplacement, lecture.ok ? lecture.sauvegarde : null);
  }
  return tout;
}

/**
 * L'identifiant d'une partie neuve.
 *
 * Il n'a besoin ni d'etre secret ni d'etre unique au monde : il doit seulement
 * distinguer deux parties du meme joueur, pour que `comparer` sache faire la
 * difference entre « le cloud est en retard » et « ce sont deux parties
 * differentes » (§4.28).
 */
export function nouvelleIdentitePartie(): string {
  return `${Date.now().toString(36)}-${Math.floor(Math.random() * 0xffffff).toString(36)}`;
}
