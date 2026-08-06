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

export interface UltimeDef {
  nom: string;
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
  /** Le rang du heros determinera combien d'ultimes sont disponibles (DESIGN.md §4.1) */
  ultimes: UltimeDef[];
}

export const CLASSES: Record<ClassId, ClasseDef> = {
  guerrier: {
    id: "guerrier",
    nom: "Guerrier",
    couleur: 0xc0392b,
    accent: 0xf0b27a,
    pvMax: 120,
    vitesse: 105,
    portee: 48,
    cadence: 520,
    degats: 11,
    esquive: 0.05,
    distanceIdeale: "Au contact, toujours en mouvement",
    ultimes: [{ nom: "Tourbillon", rechargement: 7000, effet: "tourbillon" }],
  },
  chevalier: {
    id: "chevalier",
    nom: "Chevalier",
    couleur: 0x4a86c8,
    accent: 0xd5dbe3,
    pvMax: 185,
    vitesse: 86,
    portee: 42,
    cadence: 720,
    degats: 9,
    esquive: 0.02,
    distanceIdeale: "En premiere ligne, il encaisse",
    ultimes: [{ nom: "Rempart", rechargement: 9000, effet: "rempart" }],
  },
  mage: {
    id: "mage",
    nom: "Mage",
    couleur: 0x8e44ad,
    accent: 0x5ec8f0,
    pvMax: 78,
    vitesse: 95,
    portee: 250,
    cadence: 780,
    degats: 17,
    esquive: 0.05,
    distanceIdeale: "Le plus loin possible, jamais rattrape",
    ultimes: [{ nom: "Meteore", rechargement: 8000, effet: "meteore" }],
  },
  assassin: {
    id: "assassin",
    nom: "Assassin",
    couleur: 0x2c3e50,
    accent: 0x7ee0a0,
    pvMax: 88,
    vitesse: 132,
    portee: 36,
    cadence: 300,
    degats: 8,
    esquive: 0.1,
    distanceIdeale: "Dans le dos, il pique et il repart",
    ultimes: [{ nom: "Ombre", rechargement: 6500, effet: "ombre" }],
  },
};

export const ORDRE_CLASSES: ClassId[] = ["guerrier", "chevalier", "mage", "assassin"];

/** Seuil critique : verrouille le changement de heros et declenche le repli de l'IA (DESIGN.md §4.3) */
export const SEUIL_CRITIQUE = 0.2;

/** XP necessaire pour passer du niveau donne au suivant */
export function xpPourNiveauSuivant(niveau: number): number {
  return 5 + niveau * 3;
}
