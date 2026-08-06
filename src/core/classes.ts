/**
 * Donnees des classes.
 *
 * Ce fichier est du *contenu*, pas de la logique : c'est ici qu'on equilibre.
 * Il est volontairement separe du code de jeu pour qu'on puisse changer les
 * chiffres sans toucher a un seul systeme, et voir dans Git ce qu'on a modifie.
 *
 * Voir DESIGN.md §4.1 et §4.2.
 */

export type ClassId =
  | "guerrier"
  | "chevalier"
  | "mage"
  | "assassin"
  | "rodeur"
  | "oracle"
  | "necromancien";

/**
 * Echelle de rang des competences.
 *
 * Elle reprend les lettres du systeme de rang des heros (DESIGN.md §4.1) : plus
 * le rang d'un heros est eleve, plus il a de chances de se voir proposer une
 * competence de rang eleve. L'echelle des heros est plus longue (A+, S++,
 * SRR...) ; celle des competences s'arrete a SSR.
 */
export type Rang = "F" | "E" | "D" | "C" | "B" | "A" | "S" | "SR" | "SSR";

export const ORDRE_RANGS: Rang[] = ["F", "E", "D", "C", "B", "A", "S", "SR", "SSR"];

export const COULEURS_RANG: Record<Rang, number> = {
  F: 0x9a948a,
  E: 0xa8b0a0,
  D: 0x8fc0a9,
  C: 0x6fb8d6,
  B: 0x5ec8f0,
  A: 0xa87ce8,
  S: 0xd06bff,
  SR: 0xff9d4a,
  SSR: 0xf0c419,
};

export type EffetUltime =
  | "tourbillon"
  | "rempart"
  | "meteore"
  | "ombre"
  | "pluie-de-fleches"
  | "aube"
  | "levee-des-morts";

/**
 * Le trait est ce qui differencie vraiment les classes manette en main.
 * Les chiffres seuls ne suffisent pas : deux classes aux stats differentes mais
 * au meme comportement se jouent pareil (DESIGN.md §4.2).
 */
export type TraitClasse =
  | "arc-large"
  | "riposte"
  | "explosion"
  | "critique"
  | "volee"
  | "soin-de-zone"
  | "necromancie";

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
  /** Deux ou trois phrases : qui est ce personnage dans ce monde */
  lore: string;
  /** Couleur dominante : c'est elle qui rend le sprite reconnaissable de loin (DESIGN.md §4.11) */
  couleur: number;
  accent: number;
  pvMax: number;
  /** Pixels par seconde */
  vitesse: number;
  /** Portee de l'attaque automatique, en pixels. 0 = n'attaque jamais */
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
  /** Ne quitte jamais la cite : l'IA le garde a l'abri (le Necromancien) */
  resteEnCite?: boolean;
  /** Le rang du heros determinera combien d'ultimes sont disponibles (DESIGN.md §4.1) */
  ultimes: UltimeDef[];
}

export const CLASSES: Record<ClassId, ClasseDef> = {
  guerrier: {
    id: "guerrier",
    nom: "Guerrier",
    lore:
      "Il se battait deja avant l'effondrement, pour des seigneurs dont plus personne ne se souvient. " +
      "Il n'a jamais su faire autre chose, et il a cesse de s'en excuser.",
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
    nom: "Chevalier Sacre",
    lore:
      "Son ordre a brule avec le vieux monde. Il en reste le serment, une armure trop lourde, " +
      "et l'habitude de se mettre devant les autres sans qu'on le lui demande.",
    couleur: 0x4a86c8,
    accent: 0xd5dbe3,
    pvMax: 210,
    vitesse: 82,
    portee: 44,
    cadence: 760,
    degats: 9,
    esquive: 0.02,
    distanceIdeale: "En premiere ligne, il encaisse pour les autres",
    trait: "riposte",
    traitNom: "Serment",
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
    lore:
      "Il a appris seul, dans une bibliotheque a moitie ensevelie. Il sait des choses " +
      "que personne n'a plus le niveau de lui contester, et ca l'inquiete plus que ca ne le flatte.",
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
    lore:
      "Personne ne sait d'ou il vient, et il laisse courir : ca lui evite d'avoir a mentir. " +
      "Il prend le contrat, il le remplit, il repart avant qu'on ait fini de le remercier.",
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
  rodeur: {
    id: "rodeur",
    nom: "Rodeur",
    lore:
      "Dix ans a traquer dans les ruines, seul, a economiser chaque fleche. " +
      "Il tire avant qu'on l'ait vu, et il a du mal a s'habituer a avoir des allies dans le dos.",
    couleur: 0x4e8b52,
    accent: 0xd8c48a,
    pvMax: 82,
    vitesse: 118,
    portee: 310,
    cadence: 620,
    degats: 11,
    esquive: 0.07,
    distanceIdeale: "Loin et mobile, il ne s'arrete jamais",
    trait: "volee",
    traitNom: "Volee",
    traitTexte: "Tire trois fleches en eventail a chaque attaque",
    ultimes: [
      {
        nom: "Pluie de fleches",
        description: "Crible une large zone d'une averse de traits",
        rechargement: 8500,
        effet: "pluie-de-fleches",
      },
    ],
  },
  oracle: {
    id: "oracle",
    nom: "Oracle",
    lore:
      "Elle lit dans la poussiere ce qui va arriver, et ca ne l'aide pas a dormir. " +
      "Ses mots recousent les corps ; elle prefererait qu'ils recousent le reste.",
    couleur: 0xd9b3e6,
    accent: 0xfff0c0,
    pvMax: 96,
    vitesse: 100,
    portee: 200,
    cadence: 700,
    degats: 8,
    esquive: 0.04,
    distanceIdeale: "Derriere la ligne, a portee de ses blesses",
    trait: "soin-de-zone",
    traitNom: "Verbe",
    traitTexte: "Chaque attaque soigne aussi l'allie le plus blesse autour d'elle",
    ultimes: [
      {
        nom: "Aube",
        description: "Soigne toute l'equipe et la rend invulnerable un instant",
        rechargement: 12000,
        effet: "aube",
      },
    ],
  },
  necromancien: {
    id: "necromancien",
    nom: "Necromancien",
    lore:
      "Il ne leve jamais la main sur personne. Il attend que les autres tombent, il s'accroupit, " +
      "et il leur parle. Le village le tolere parce qu'il rend des bras — mais personne ne mange a sa table.",
    couleur: 0x5a4a7a,
    accent: 0x9ee8a0,
    pvMax: 70,
    vitesse: 88,
    // Il n'attaque jamais lui-meme : ce sont ses mort-vivants qui se battent.
    portee: 0,
    cadence: 1200,
    degats: 10,
    esquive: 0.03,
    distanceIdeale: "Dans la cite, a l'abri, pendant que ses morts travaillent",
    trait: "necromancie",
    traitNom: "Relevement",
    traitTexte: "Chaque cadavre a une chance de se relever pour se battre a ses cotes",
    resteEnCite: true,
    ultimes: [
      {
        nom: "Levee des morts",
        description: "Tous les cadavres du champ de bataille se relevent d'un coup",
        rechargement: 30000,
        effet: "levee-des-morts",
      },
    ],
  },
};

export const ORDRE_CLASSES: ClassId[] = [
  "guerrier",
  "chevalier",
  "mage",
  "assassin",
  "rodeur",
  "oracle",
  "necromancien",
];

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

/**
 * XP necessaire pour passer du niveau donne au suivant.
 *
 * Courbe volontairement raide : plus le niveau est haut, plus il coute cher.
 * Sans ca, un jeu sans fin voit ses niveaux defiler et perdre tout sens.
 */
export function xpPourNiveauSuivant(niveau: number): number {
  return Math.round(6 * Math.pow(niveau, 1.45)) + 4;
}

/**
 * Un choix de competence tous les 5 niveaux (et non a chaque niveau).
 *
 * Les niveaux intermediaires donnent une progression discrete de statistiques ;
 * les paliers de 5 sont des moments de decision. Ca rend chaque choix rare, donc
 * important, et ca laisse respirer le combat.
 */
export const NIVEAUX_PAR_CHOIX = 5;

export function donneUnChoix(niveau: number): boolean {
  return niveau % NIVEAUX_PAR_CHOIX === 0;
}
