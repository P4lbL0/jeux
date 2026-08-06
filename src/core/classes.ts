/**
 * Donnees des classes.
 *
 * Ce fichier est du *contenu*, pas de la logique : c'est ici qu'on equilibre.
 * Il est volontairement separe du code de jeu pour qu'on puisse changer les
 * chiffres sans toucher a un seul systeme, et voir dans Git ce qu'on a modifie.
 *
 * Voir DESIGN.md §4.1 et §4.2.
 */

export type ClassId = "guerrier" | "chevalier" | "mage" | "assassin";

export type EffetUltime = "tourbillon" | "rempart" | "meteore" | "ombre";

/**
 * Le trait est ce qui differencie vraiment les classes manette en main.
 * Les chiffres seuls ne suffisent pas : deux classes aux stats differentes mais
 * au meme comportement se jouent pareil (DESIGN.md §4.2).
 */
export type TraitClasse = "arc-large" | "riposte" | "explosion" | "critique";

export interface UltimeDef {
  nom: string;
  /** Une phrase, affichee en jeu sous l'icone */
  description: string;
  /** Rechargement en millisecondes */
  rechargement: number;
  effet: EffetUltime;
}

export interface ClasseDef {
  id: ClassId;
  nom: string;
  /** Couleur dominante : c'est elle qui rend le sprite reconnaissable de loin (DESIGN.md §4.11) */
  couleur: number;
  accent: number;
  pvMax: number;
  /** Pixels par seconde */
  vitesse: number;
  /** Portee de l'attaque automatique, en pixels. <= 60 = corps a corps */
  portee: number;
  /** Millisecondes entre deux attaques */
  cadence: number;
  degats: number;
  /** Probabilite d'esquiver, de 0 a 1. C'est une statistique, pas un reflexe. */
  esquive: number;
  /**
   * Rappel de design : chaque classe doit se jouer a une distance differente,
   * sinon le deplacement ne veut plus rien dire (DESIGN.md §4.2).
   */
  distanceIdeale: string;
  trait: TraitClasse;
  traitNom: string;
  traitTexte: string;
  /** Le rang du heros determinera combien d'ultimes sont disponibles (DESIGN.md §4.1) */
  ultimes: UltimeDef[];
}

export const CLASSES: Record<ClassId, ClasseDef> = {
  guerrier: {
    id: "guerrier",
    nom: "Guerrier",
    couleur: 0xc0392b,
    accent: 0xf0b27a,
    pvMax: 130,
    vitesse: 108,
    portee: 58,
    cadence: 520,
    degats: 13,
    esquive: 0.05,
    distanceIdeale: "Au contact, toujours en mouvement",
    trait: "arc-large",
    traitNom: "Fauchage",
    traitTexte: "Frappe tout un demi-cercle devant lui",
    ultimes: [
      {
        nom: "Tourbillon",
        description: "Fauche tout ce qui l'entoure et le repousse au loin",
        rechargement: 7000,
        effet: "tourbillon",
      },
    ],
  },
  chevalier: {
    id: "chevalier",
    nom: "Chevalier",
    couleur: 0x4a86c8,
    accent: 0xd5dbe3,
    pvMax: 210,
    vitesse: 82,
    portee: 44,
    cadence: 760,
    degats: 9,
    esquive: 0.02,
    distanceIdeale: "En premiere ligne, il encaisse",
    trait: "riposte",
    traitNom: "Riposte",
    traitTexte: "Blesse quiconque le touche : plus on l'attaque, plus il tue",
    ultimes: [
      {
        nom: "Rempart",
        description: "Invulnerable 3,5 s et degage toute la place autour de lui",
        rechargement: 9000,
        effet: "rempart",
      },
    ],
  },
  mage: {
    id: "mage",
    nom: "Mage",
    couleur: 0x8e44ad,
    accent: 0x5ec8f0,
    pvMax: 76,
    vitesse: 96,
    portee: 260,
    cadence: 800,
    degats: 16,
    esquive: 0.05,
    distanceIdeale: "Le plus loin possible, jamais rattrape",
    trait: "explosion",
    traitNom: "Deflagration",
    traitTexte: "Chaque tir explose et touche tout le groupe",
    ultimes: [
      {
        nom: "Meteore",
        description: "Ecrase a distance le groupe d'ennemis le plus dense",
        rechargement: 8000,
        effet: "meteore",
      },
    ],
  },
  assassin: {
    id: "assassin",
    nom: "Assassin",
    couleur: 0x2c3e50,
    accent: 0x7ee0a0,
    pvMax: 84,
    vitesse: 142,
    portee: 34,
    cadence: 250,
    degats: 7,
    esquive: 0.1,
    distanceIdeale: "Dans le dos, il pique et il repart",
    trait: "critique",
    traitNom: "Mise a mort",
    traitTexte: "25% de coups critiques, et la cadence la plus rapide du jeu",
    ultimes: [
      {
        nom: "Ombre",
        description: "Traverse la melee en tuant tout sur son passage",
        rechargement: 6500,
        effet: "ombre",
      },
    ],
  },
};

export const ORDRE_CLASSES: ClassId[] = ["guerrier", "chevalier", "mage", "assassin"];

/** Seuil critique : verrouille le changement de heros et declenche le repli de l'IA (DESIGN.md §4.3) */
export const SEUIL_CRITIQUE = 0.2;

/**
 * Etat d'un heros pendant une vague.
 *
 * - `combat` : il se bat, il peut etre cible et blesse
 * - `repli`  : il a decroche et rentre a la cite, plus personne ne le vise
 * - `cite`   : il est a l'abri dans la cite, il se soigne
 * - `mort`   : definitivement perdu (DESIGN.md §4.3)
 */
export type EtatHero = "combat" | "repli" | "cite" | "mort";

/** XP necessaire pour passer du niveau donne au suivant */
export function xpPourNiveauSuivant(niveau: number): number {
  return 5 + niveau * 3;
}
