import type { ClassId, Rang } from "./classes";
import { COULEURS_RANG, ORDRE_RANGS } from "./classes";

/**
 * Competences (DESIGN.md §4.13).
 *
 * Trois natures :
 *
 * - **passive** : un effet permanent, sans touche ;
 * - **active**  : une capacite declenchee par le joueur, avec son rechargement ;
 * - **auto**    : une capacite qui part toute seule des qu'elle est rechargee.
 *
 * Une competence se **reprend** pour monter d'un palier : elle devient plus
 * forte a chaque fois. A certains paliers elle propose une **evolution**, qui
 * change sa nature — et parfois l'allure du heros.
 *
 * Comme classes.ts, ce fichier est du *contenu* : aucune dependance a Phaser,
 * aucune logique de jeu. On peut donc l'equilibrer et le tester tout seul.
 */

/** Tous les combien de kills les competences "par tranche" progressent */
export const TRANCHE_KILLS = 25;

/** Les capacites que la scene de jeu sait jouer */
export type EffetCapacite =
  // Ultimes de classe
  | "tourbillon"
  | "rempart"
  | "meteore"
  | "ombre"
  | "pluie-de-fleches"
  | "aube"
  | "levee-des-morts"
  // Chevalier Sacre
  | "sursaut-sacre"
  | "benediction"
  | "martyre"
  // Guerrier
  | "moulinet"
  | "moulinet-aspirant"
  | "moulinet-sanglant"
  // Mage
  | "dome"
  | "exil"
  // Assassin
  | "invisibilite"
  | "hecatombe"
  // Rodeur
  | "piege"
  | "fleche-du-jugement"
  // Oracle
  | "priere"
  | "chant-de-guerre"
  // Necromancien
  | "appel-des-morts"
  // Communes de haut rang
  | "orage-final"
  | "heure-sombre";

export type TypeCompetence = "passive" | "active" | "auto";

/** Les bonus accumules par un heros. Toujours partir de bonusVierge(). */
export interface Bonus {
  pvMax: number;
  degats: number;
  vitesse: number;
  /** Multiplicateur de cadence : 0.9 = 10% plus rapide */
  cadence: number;
  portee: number;
  esquive: number;
  critChance: number;
  critMultiplicateur: number;
  /** Points de vie rendus a chaque ennemi tue */
  soinParKill: number;
  /** Multiplicateur du rechargement des capacites : 0.7 = 30% plus court */
  rechargementCapacites: number;
  /** Part des degats infliges rendue en points de vie */
  volDeVie: number;
  /** Reduction plate des degats subis */
  resistance: number;
  /** Multiplicateur applique a tout : c'est l'Apotheose du guerrier */
  multiplicateurGlobal: number;
  /** Multiplicateurs separes, pour les competences a double tranchant */
  multiplicateurPv: number;
  multiplicateurDegats: number;

  // --- Croissances par tranche de kills ---
  pvParTranche: number;
  /** Fraction de degats gagnee par tranche : 0.01 = +1% */
  degatsParTranche: number;
  volDeVieParTranche: number;

  // --- Mecaniques particulieres ---
  /** Nombre de satellites en orbite autour du mage */
  satellites: number;
  /** Effet des satellites, choisi par evolution */
  satelliteFeu: boolean;
  satelliteGlace: boolean;
  /** Rayon de provocation du Chevalier Sacre, 0 = aucune */
  provocation: number;
  /** Cadence gagnee par point de pourcentage de vie manquante */
  rageParPvManquant: number;
  /** L'assassin n'est pas vise en priorite quand un defenseur est proche */
  discretion: boolean;

  // --- Armes autonomes : elles se battent sans qu'on s'en occupe ---
  /** Epees qui tournent autour du heros */
  epees: number;
  epeeArdente: boolean;
  /** Degats par seconde infliges a tout ce qui s'approche */
  auraFeu: number;
  /** Eclats tires au hasard, par salve */
  eclats: number;
  /** Nombre de rebonds electriques d'une attaque */
  chaineEclairs: number;
  chaineDiffuse: boolean;
  chaineFulgurante: boolean;
  /** Les projectiles traversent les ennemis */
  perforant: boolean;
  /** Fleches supplementaires dans la volee du Rodeur */
  flechesSupplementaires: number;

  // --- Regles de partie ---
  /** Chance qu'un ennemi tue laisse un soin */
  charognard: number;
  /** Chance qu'une capacite ne parte pas en rechargement */
  echo: number;
  /** Bonus multiplicatif tant qu'on se bat pres de la cite */
  sermentProtecteur: number;
  /** Premiere attaque sur une cible jamais touchee : multiplicateur */
  marqueDeSang: number;
  /** Degats en plus par allie mort ou replie */
  dernierDebout: number;
  /** Ne peut plus etre soigne, mais chaque kill rend une part de la vie max */
  sangPourSang: number;
  /** Secondes retirees aux rechargements a chaque kill */
  danseDesOmbres: number;
  /** Un heros de l'equipe se relevera une fois dans la partie */
  resurrection: boolean;
  /** Resistance gagnee definitivement a chaque passage sous 50% de vie */
  sermentDeFer: number;
  /** Esquive offerte a toute l'equipe */
  presage: number;

  // --- Necromancien ---
  /** Chance qu'un cadavre se releve */
  chanceRelevement: number;
  /** Multiplicateur de puissance des mort-vivants */
  puissanceMortsVivants: number;
  /** Les mort-vivants explosent en mourant */
  mortsVivantsExplosifs: boolean;
  /** Les mort-vivants ne se decomposent plus */
  mortsVivantsEternels: boolean;
}

export function bonusVierge(): Bonus {
  return {
    pvMax: 0,
    degats: 0,
    vitesse: 0,
    cadence: 1,
    portee: 0,
    esquive: 0,
    critChance: 0,
    critMultiplicateur: 2,
    soinParKill: 0,
    rechargementCapacites: 1,
    volDeVie: 0,
    resistance: 0,
    multiplicateurGlobal: 1,
    multiplicateurPv: 1,
    multiplicateurDegats: 1,
    pvParTranche: 0,
    degatsParTranche: 0,
    volDeVieParTranche: 0,
    satellites: 0,
    satelliteFeu: false,
    satelliteGlace: false,
    provocation: 0,
    rageParPvManquant: 0,
    discretion: false,
    epees: 0,
    epeeArdente: false,
    auraFeu: 0,
    eclats: 0,
    chaineEclairs: 0,
    chaineDiffuse: false,
    chaineFulgurante: false,
    perforant: false,
    flechesSupplementaires: 0,
    charognard: 0,
    echo: 0,
    sermentProtecteur: 0,
    marqueDeSang: 0,
    dernierDebout: 0,
    sangPourSang: 0,
    danseDesOmbres: 0,
    resurrection: false,
    sermentDeFer: 0,
    presage: 0,
    chanceRelevement: 0,
    puissanceMortsVivants: 1,
    mortsVivantsExplosifs: false,
    mortsVivantsEternels: false,
  };
}

export interface EvolutionDef {
  id: string;
  nom: string;
  description: string;
  /** Change la nature de la capacite */
  effet?: EffetCapacite;
  /** Change l'allure du heros : le build se voit a l'ecran */
  teinte?: number;
  appliquer?(bonus: Bonus): void;
}

export interface PalierDef {
  texte: string;
  /** Rechargement en millisecondes, pour les capacites */
  rechargement?: number;
  appliquer?(bonus: Bonus, palier: number): void;
}

export interface CompetenceDef {
  id: string;
  nom: string;
  rang: Rang;
  type: TypeCompetence;
  /** Absente = proposee a toutes les classes */
  classes?: ClassId[];
  /** Une phrase qui dit ce que la competence fait */
  description: string;
  /** Cle de texture de l'icone, pour les capacites */
  icone?: string;
  effet?: EffetCapacite;
  /** Un palier par prise ; la longueur donne le nombre de prises possibles */
  paliers: PalierDef[];
  /** Choix qui s'ouvre en atteignant ce palier */
  evolutions?: { auPalier: number; options: EvolutionDef[] };
}

// ---------------------------------------------------------------- le contenu

export const COMPETENCES: CompetenceDef[] = [
  // =========================== Communes ===========================
  {
    id: "lame-affutee",
    nom: "Lame affutee",
    rang: "F",
    type: "passive",
    description: "Des degats en plus, tout simplement.",
    paliers: [
      { texte: "+4 degats", appliquer: (b) => void (b.degats += 4) },
      { texte: "+5 degats", appliquer: (b) => void (b.degats += 5) },
      { texte: "+7 degats", appliquer: (b) => void (b.degats += 7) },
    ],
  },
  {
    id: "bottes-usees",
    nom: "Bottes usees",
    rang: "F",
    type: "passive",
    description: "On se deplace plus vite. Dans ce jeu, c'est survivre plus longtemps.",
    paliers: [
      { texte: "+14 vitesse", appliquer: (b) => void (b.vitesse += 14) },
      { texte: "+14 vitesse", appliquer: (b) => void (b.vitesse += 14) },
      { texte: "+18 vitesse", appliquer: (b) => void (b.vitesse += 18) },
    ],
  },
  {
    id: "cuirasse",
    nom: "Cuirasse rapiecee",
    rang: "E",
    type: "passive",
    description: "De la vie en plus.",
    paliers: [
      { texte: "+25 vie maximum", appliquer: (b) => void (b.pvMax += 25) },
      { texte: "+30 vie maximum", appliquer: (b) => void (b.pvMax += 30) },
      { texte: "+40 vie maximum", appliquer: (b) => void (b.pvMax += 40) },
    ],
  },
  {
    id: "entrainement",
    nom: "Entrainement",
    rang: "E",
    type: "passive",
    description: "On frappe plus souvent.",
    paliers: [
      { texte: "Attaque 10% plus vite", appliquer: (b) => void (b.cadence *= 0.9) },
      { texte: "Attaque 10% plus vite", appliquer: (b) => void (b.cadence *= 0.9) },
      { texte: "Attaque 12% plus vite", appliquer: (b) => void (b.cadence *= 0.88) },
    ],
  },
  {
    id: "reflexes",
    nom: "Reflexes",
    rang: "D",
    type: "passive",
    description: "Une chance d'annuler completement un coup.",
    paliers: [
      { texte: "+6% d'esquive", appliquer: (b) => void (b.esquive += 0.06) },
      { texte: "+6% d'esquive", appliquer: (b) => void (b.esquive += 0.06) },
      { texte: "+8% d'esquive", appliquer: (b) => void (b.esquive += 0.08) },
    ],
  },
  {
    id: "longue-vue",
    nom: "Longue vue",
    rang: "D",
    type: "passive",
    description: "On frappe de plus loin — donc on encaisse moins.",
    paliers: [
      { texte: "+30 de portee", appliquer: (b) => void (b.portee += 30) },
      { texte: "+30 de portee", appliquer: (b) => void (b.portee += 30) },
      { texte: "+40 de portee", appliquer: (b) => void (b.portee += 40) },
    ],
  },
  {
    id: "point-faible",
    nom: "Point faible",
    rang: "C",
    type: "passive",
    description: "Des coups critiques plus frequents.",
    paliers: [
      { texte: "+12% de critique", appliquer: (b) => void (b.critChance += 0.12) },
      { texte: "+12% de critique", appliquer: (b) => void (b.critChance += 0.12) },
      { texte: "+15% de critique", appliquer: (b) => void (b.critChance += 0.15) },
    ],
  },
  {
    id: "sang-froid",
    nom: "Sang-froid",
    rang: "C",
    type: "passive",
    description: "Chaque mort ennemie te remet debout.",
    paliers: [
      { texte: "+2 vie par ennemi tue", appliquer: (b) => void (b.soinParKill += 2) },
      { texte: "+2 vie par ennemi tue", appliquer: (b) => void (b.soinParKill += 2) },
      { texte: "+3 vie par ennemi tue", appliquer: (b) => void (b.soinParKill += 3) },
    ],
  },
  {
    id: "sangsue",
    nom: "Sangsue",
    rang: "B",
    type: "passive",
    description: "Une part de tes degats revient en vie. Plus tu tapes fort, plus tu tiens.",
    paliers: [
      { texte: "+6% de vol de vie", appliquer: (b) => void (b.volDeVie += 0.06) },
      { texte: "+6% de vol de vie", appliquer: (b) => void (b.volDeVie += 0.06) },
      { texte: "+8% de vol de vie", appliquer: (b) => void (b.volDeVie += 0.08) },
    ],
  },
  {
    id: "peau-de-pierre",
    nom: "Peau de pierre",
    rang: "B",
    type: "passive",
    description: "Chaque coup recu fait moins mal. Redoutable contre les petits ennemis nombreux.",
    paliers: [
      { texte: "-3 degats subis par coup", appliquer: (b) => void (b.resistance += 3) },
      { texte: "-3 degats subis par coup", appliquer: (b) => void (b.resistance += 3) },
      { texte: "-4 degats subis par coup", appliquer: (b) => void (b.resistance += 4) },
    ],
  },
  {
    id: "fureur",
    nom: "Fureur",
    rang: "A",
    type: "passive",
    description: "Plus fort et plus rapide a la fois.",
    paliers: [
      {
        texte: "+9 degats, attaque 5% plus vite",
        appliquer: (b) => {
          b.degats += 9;
          b.cadence *= 0.95;
        },
      },
      {
        texte: "+11 degats, attaque 5% plus vite",
        appliquer: (b) => {
          b.degats += 11;
          b.cadence *= 0.95;
        },
      },
    ],
  },
  {
    id: "second-souffle",
    nom: "Second souffle",
    rang: "S",
    type: "passive",
    description: "Beaucoup de vie d'un coup, et une remise a neuf immediate.",
    paliers: [
      { texte: "+70 vie maximum et soin complet", appliquer: (b) => void (b.pvMax += 70) },
      { texte: "+90 vie maximum et soin complet", appliquer: (b) => void (b.pvMax += 90) },
    ],
  },
  {
    id: "capacites-affinees",
    nom: "Capacites affinees",
    rang: "S",
    type: "passive",
    description: "Toutes tes capacites reviennent plus vite.",
    paliers: [
      { texte: "Rechargements -25%", appliquer: (b) => void (b.rechargementCapacites *= 0.75) },
      { texte: "Rechargements -25%", appliquer: (b) => void (b.rechargementCapacites *= 0.75) },
    ],
  },

  // ====================== Chevalier Sacre ======================
  {
    id: "sursaut-sacre",
    nom: "Sursaut sacre",
    rang: "F",
    type: "auto",
    classes: ["chevalier"],
    description:
      "Regulierement et tout seul : il prie une seconde, devient invincible, se soigne et repousse tout.",
    icone: "cap-sursaut",
    effet: "sursaut-sacre",
    paliers: [
      { texte: "Toutes les 30 s, rend 25% des PV max", rechargement: 30000 },
      { texte: "Toutes les 25 s, rend 30% des PV max", rechargement: 25000 },
      { texte: "Toutes les 20 s, rend 35% des PV max", rechargement: 20000 },
    ],
  },
  {
    id: "provocation",
    nom: "Provocation",
    rang: "SR",
    type: "passive",
    classes: ["chevalier"],
    description:
      "Tout ce qui l'approche ne voit plus que lui. Chaque ennemi qui le cible le rend plus dur, et chaque mort a ses pieds le remet un peu debout.",
    paliers: [
      {
        texte: "Rayon 90 : +1 resistance par ennemi, +1 PV rendu par mort a ses pieds",
        appliquer: (b) => void (b.provocation = 90),
      },
      { texte: "Rayon 130", appliquer: (b) => void (b.provocation = 130) },
      { texte: "Rayon 170", appliquer: (b) => void (b.provocation = 170) },
    ],
  },
  {
    id: "benediction",
    nom: "Benediction",
    rang: "S",
    type: "active",
    classes: ["chevalier"],
    description: "Un dome de lumiere qui soigne tous les allies a l'interieur.",
    icone: "cap-benediction",
    effet: "benediction",
    paliers: [
      { texte: "Soigne 1 PV/s pendant 5 s", rechargement: 14000 },
      { texte: "Soigne 2 PV/s pendant 6 s", rechargement: 13000 },
      { texte: "Soigne 3 PV/s pendant 7 s", rechargement: 12000 },
    ],
  },
  {
    id: "endurance-sacree",
    nom: "Endurance sacree",
    rang: "A",
    type: "passive",
    classes: ["chevalier"],
    description: "Il grossit a mesure qu'il tue. Une competence qui recompense les longues parties.",
    paliers: [
      { texte: `+1 PV max tous les ${TRANCHE_KILLS} kills`, appliquer: (b) => void (b.pvParTranche += 1) },
      { texte: `+1 PV max tous les ${TRANCHE_KILLS} kills`, appliquer: (b) => void (b.pvParTranche += 1) },
      { texte: `+2 PV max tous les ${TRANCHE_KILLS} kills`, appliquer: (b) => void (b.pvParTranche += 2) },
    ],
  },

  // ============================ Guerrier ============================
  {
    id: "rage",
    nom: "Rage",
    rang: "S",
    type: "passive",
    classes: ["guerrier"],
    description:
      "Plus il est blesse, plus il frappe vite. Elle recompense exactement ce que le jeu punit d'habitude.",
    paliers: [
      {
        texte: "+1% de vitesse d'attaque par % de vie manquante",
        appliquer: (b) => void (b.rageParPvManquant += 0.01),
      },
      {
        texte: "+0,5% supplementaire par % de vie manquante",
        appliquer: (b) => void (b.rageParPvManquant += 0.005),
      },
      {
        texte: "+0,5% supplementaire par % de vie manquante",
        appliquer: (b) => void (b.rageParPvManquant += 0.005),
      },
    ],
  },
  {
    id: "moulinet",
    nom: "Moulinet",
    rang: "E",
    type: "active",
    classes: ["guerrier"],
    description: "Il tourne sur lui-meme et fauche tout ce qui l'entoure.",
    icone: "cap-moulinet",
    effet: "moulinet",
    paliers: [
      { texte: "Tourne 2,5 s", rechargement: 9000 },
      { texte: "Tourne 3 s, degats accrus", rechargement: 8500 },
      { texte: "Tourne 3,5 s, degats accrus", rechargement: 8000 },
    ],
    evolutions: {
      auPalier: 2,
      options: [
        {
          id: "moulinet-aspirant",
          nom: "Tourbillon d'acier",
          description: "Le moulinet aspire les ennemis vers toi au lieu de les repousser.",
          effet: "moulinet-aspirant",
          teinte: 0x9fc7ff,
        },
        {
          id: "moulinet-sanglant",
          nom: "Lames rouges",
          description: "Pendant le moulinet, tout ce que tu infliges te revient en vie.",
          effet: "moulinet-sanglant",
          teinte: 0xff8080,
        },
      ],
    },
  },
  {
    id: "entaille",
    nom: "Entaille",
    rang: "A",
    type: "passive",
    classes: ["guerrier"],
    description: "Chaque tranche de morts le rend definitivement plus dangereux.",
    paliers: [
      {
        texte: `+1% de degats tous les ${TRANCHE_KILLS} kills`,
        appliquer: (b) => void (b.degatsParTranche += 0.01),
      },
      {
        texte: `+1% de degats tous les ${TRANCHE_KILLS} kills`,
        appliquer: (b) => void (b.degatsParTranche += 0.01),
      },
    ],
  },
  {
    id: "apotheose",
    nom: "Apotheose",
    rang: "SSR",
    type: "passive",
    classes: ["guerrier"],
    description:
      "Toutes ses statistiques sont doublees, maintenant et pour tout ce qui viendra apres.",
    paliers: [
      {
        texte: "Toutes les statistiques x2",
        appliquer: (b) => void (b.multiplicateurGlobal *= 2),
      },
    ],
  },

  // ============================== Mage ==============================
  {
    id: "satellite",
    nom: "Satellite",
    rang: "B",
    type: "passive",
    classes: ["mage"],
    description: "Un eclat d'energie tourne autour de lui et blesse tout ce qu'il traverse.",
    paliers: [
      { texte: "1 satellite", appliquer: (b) => void (b.satellites += 1) },
      { texte: "2 satellites", appliquer: (b) => void (b.satellites += 1) },
      { texte: "3 satellites", appliquer: (b) => void (b.satellites += 1) },
      { texte: "4 satellites", appliquer: (b) => void (b.satellites += 1) },
    ],
    evolutions: {
      auPalier: 2,
      options: [
        {
          id: "satellite-feu",
          nom: "Satellites de feu",
          description: "Ils brulent : degats doubles, et ils laissent une trainee ardente.",
          teinte: 0xff8a3d,
          appliquer: (b) => void (b.satelliteFeu = true),
        },
        {
          id: "satellite-glace",
          nom: "Satellites de givre",
          description: "Ils ralentissent de moitie tout ce qu'ils touchent.",
          teinte: 0x8ed6ff,
          appliquer: (b) => void (b.satelliteGlace = true),
        },
      ],
    },
  },
  {
    id: "savoir-arcanique",
    nom: "Savoir arcanique",
    rang: "A",
    type: "passive",
    classes: ["mage"],
    description: "Son savoir grandit avec le nombre de creatures qu'il a etudiees de pres.",
    paliers: [
      {
        texte: `+1% de degats tous les ${TRANCHE_KILLS} kills`,
        appliquer: (b) => void (b.degatsParTranche += 0.01),
      },
      {
        texte: `+1% de degats tous les ${TRANCHE_KILLS} kills`,
        appliquer: (b) => void (b.degatsParTranche += 0.01),
      },
    ],
  },
  {
    id: "dome",
    nom: "Dome",
    rang: "D",
    type: "active",
    classes: ["mage"],
    description:
      "Pose un dome la ou tu le decides. Il a ses propres points de vie et arrete ce qui passe.",
    icone: "cap-dome",
    effet: "dome",
    paliers: [
      { texte: "Dome de 60 PV", rechargement: 20000 },
      { texte: "Dome de 110 PV", rechargement: 18000 },
      { texte: "Dome de 180 PV", rechargement: 16000 },
    ],
  },
  {
    id: "exil",
    nom: "Exil",
    rang: "SSR",
    type: "active",
    classes: ["mage"],
    description:
      "Il sacrifie 99% de sa vie pour bannir toutes les creatures hostiles vers un autre monde. Personne ne gagne d'experience. Il reste immobilise a 1 PV pendant 30 s, insoignable, et le moindre contact le tue.",
    icone: "cap-exil",
    effet: "exil",
    paliers: [{ texte: "Bannit tout le champ de bataille", rechargement: 120000 }],
  },

  // ============================ Assassin ============================
  {
    id: "invisibilite",
    nom: "Invisibilite",
    rang: "D",
    type: "active",
    classes: ["assassin"],
    description: "Il disparait. Plus rien ne le vise, et il court plus vite.",
    icone: "cap-invisibilite",
    effet: "invisibilite",
    paliers: [
      { texte: "Invisible 5 s, +10% de vitesse", rechargement: 16000 },
      { texte: "Invisible 6 s, +15% de vitesse", rechargement: 15000 },
      { texte: "Invisible 7 s, +20% de vitesse", rechargement: 14000 },
    ],
  },
  {
    id: "saignee",
    nom: "Saignee",
    rang: "A",
    type: "passive",
    classes: ["assassin"],
    description: "Plus il tue, plus chaque coup le nourrit.",
    paliers: [
      {
        texte: `+1% de vol de vie tous les ${TRANCHE_KILLS} kills`,
        appliquer: (b) => void (b.volDeVieParTranche += 0.01),
      },
      {
        texte: `+1% de vol de vie tous les ${TRANCHE_KILLS} kills`,
        appliquer: (b) => void (b.volDeVieParTranche += 0.01),
      },
    ],
  },
  {
    id: "hecatombe",
    nom: "Hecatombe",
    rang: "SSR",
    type: "active",
    classes: ["assassin"],
    description:
      "Tout ennemi sous 10% de vie qu'il touche est execute sur-le-champ, et chaque execution le projette sur sa cible suivante.",
    icone: "cap-hecatombe",
    effet: "hecatombe",
    paliers: [
      { texte: "Execute sous 10% de vie", rechargement: 45000 },
      { texte: "Execute sous 15% de vie", rechargement: 40000 },
    ],
  },

  // ================== Armes autonomes (toutes classes) ==================
  // Elles se battent sans qu'on s'en occupe. Comme le joueur ne controle que
  // son deplacement, ce sont elles qui donnent le sentiment de monter en
  // puissance sans ajouter une touche de plus.
  {
    id: "epee-tournoyante",
    nom: "Epee tournoyante",
    rang: "F",
    type: "passive",
    description: "Une epee flotte autour de toi et fauche ce qu'elle croise. Elle ne s'arrete jamais.",
    paliers: [
      { texte: "1 epee", appliquer: (b) => void (b.epees += 1) },
      { texte: "2 epees", appliquer: (b) => void (b.epees += 1) },
      { texte: "3 epees", appliquer: (b) => void (b.epees += 1) },
      { texte: "4 epees", appliquer: (b) => void (b.epees += 1) },
      { texte: "5 epees", appliquer: (b) => void (b.epees += 1) },
    ],
    evolutions: {
      auPalier: 2,
      options: [
        {
          id: "epee-ardente",
          nom: "Lames ardentes",
          description: "Elles chauffent au rouge : degats doubles.",
          teinte: 0xff8a3d,
          appliquer: (b) => void (b.epeeArdente = true),
        },
        {
          id: "epee-nuee",
          nom: "Nuee de lames",
          description: "Deux epees de plus, immediatement.",
          teinte: 0xd5dbe3,
          appliquer: (b) => void (b.epees += 2),
        },
      ],
    },
  },
  {
    id: "aura-de-flammes",
    nom: "Aura de flammes",
    rang: "E",
    type: "passive",
    description: "Tout ce qui s'approche de toi brule, en continu, sans que tu aies rien a faire.",
    paliers: [
      { texte: "6 degats par seconde autour de toi", appliquer: (b) => void (b.auraFeu += 6) },
      { texte: "+6 degats par seconde", appliquer: (b) => void (b.auraFeu += 6) },
      { texte: "+8 degats par seconde", appliquer: (b) => void (b.auraFeu += 8) },
    ],
  },
  {
    id: "eclats",
    nom: "Eclats",
    rang: "E",
    type: "passive",
    description: "Regulierement, des eclats partent au hasard autour de toi. Ils finissent par trouver.",
    paliers: [
      { texte: "3 eclats par salve", appliquer: (b) => void (b.eclats += 3) },
      { texte: "+2 eclats", appliquer: (b) => void (b.eclats += 2) },
      { texte: "+3 eclats", appliquer: (b) => void (b.eclats += 3) },
    ],
  },
  {
    id: "chaine-eclairs",
    nom: "Chaine d'eclairs",
    rang: "C",
    type: "passive",
    description: "Tes attaques sautent d'un ennemi a l'autre en arc electrique.",
    paliers: [
      { texte: "Rebondit sur 1 ennemi", appliquer: (b) => void (b.chaineEclairs += 1) },
      { texte: "Rebondit sur 2 ennemis", appliquer: (b) => void (b.chaineEclairs += 1) },
      { texte: "Rebondit sur 3 ennemis", appliquer: (b) => void (b.chaineEclairs += 1) },
    ],
    evolutions: {
      auPalier: 2,
      options: [
        {
          id: "chaine-diffuse",
          nom: "Foudre diffuse",
          description: "Les rebonds deviennent illimites, mais chaque saut divise les degats.",
          teinte: 0x8ed6ff,
          appliquer: (b) => void (b.chaineDiffuse = true),
        },
        {
          id: "chaine-fulgurante",
          nom: "Fulguration",
          description: "Deux rebonds seulement, mais chacun frappe 60% plus fort que le precedent.",
          teinte: 0xfff06a,
          appliquer: (b) => void (b.chaineFulgurante = true),
        },
      ],
    },
  },
  {
    id: "ricochet",
    nom: "Ricochet",
    rang: "D",
    type: "passive",
    description: "Tes projectiles traversent les ennemis au lieu de s'arreter au premier.",
    paliers: [{ texte: "Les projectiles transpercent", appliquer: (b) => void (b.perforant = true) }],
  },
  {
    id: "pas-leger",
    nom: "Pas leger",
    rang: "F",
    type: "passive",
    description: "Un peu plus vif, un peu plus difficile a toucher.",
    paliers: [
      {
        texte: "+8 vitesse, +3% d'esquive",
        appliquer: (b) => {
          b.vitesse += 8;
          b.esquive += 0.03;
        },
      },
      {
        texte: "+8 vitesse, +3% d'esquive",
        appliquer: (b) => {
          b.vitesse += 8;
          b.esquive += 0.03;
        },
      },
      {
        texte: "+10 vitesse, +4% d'esquive",
        appliquer: (b) => {
          b.vitesse += 10;
          b.esquive += 0.04;
        },
      },
    ],
  },
  {
    id: "charognard",
    nom: "Charognard",
    rang: "E",
    type: "passive",
    description: "Les cadavres laissent parfois de quoi tenir debout.",
    paliers: [
      { texte: "12% de chance de recuperer un soin", appliquer: (b) => void (b.charognard += 0.12) },
      { texte: "+10% de chance", appliquer: (b) => void (b.charognard += 0.1) },
    ],
  },
  {
    id: "veteran",
    nom: "Veteran",
    rang: "D",
    type: "passive",
    description: "L'experience de toute une vie, d'un coup. Un niveau immediat.",
    paliers: [
      { texte: "Gagne un niveau tout de suite" },
      { texte: "Gagne un niveau tout de suite" },
    ],
  },
  {
    id: "echo",
    nom: "Echo",
    rang: "B",
    type: "passive",
    description: "Il arrive qu'une capacite ne parte pas en rechargement. On ne sait pas pourquoi.",
    paliers: [
      { texte: "20% de chance de ne pas consommer le rechargement", appliquer: (b) => void (b.echo += 0.2) },
      { texte: "+15% de chance", appliquer: (b) => void (b.echo += 0.15) },
    ],
  },
  {
    id: "serment-du-protecteur",
    nom: "Serment du protecteur",
    rang: "A",
    type: "passive",
    description:
      "Tant que tu te bats a portee de la cite, tout te reussit. Loin d'elle, tu n'es qu'un mercenaire de plus.",
    paliers: [
      { texte: "+25% a tout pres de la cite", appliquer: (b) => void (b.sermentProtecteur += 0.25) },
      { texte: "+20% supplementaires", appliquer: (b) => void (b.sermentProtecteur += 0.2) },
    ],
  },
  {
    id: "fardeau",
    nom: "Fardeau",
    rang: "S",
    type: "passive",
    description: "Tu portes une arme trop lourde pour ton armure. Tu frappes beaucoup plus fort, et tu tiens beaucoup moins.",
    paliers: [
      {
        texte: "-30% de vie maximum, +60% de degats",
        appliquer: (b) => {
          b.multiplicateurPv *= 0.7;
          b.multiplicateurDegats *= 1.6;
        },
      },
    ],
  },
  {
    id: "orage-final",
    nom: "Orage final",
    rang: "SR",
    type: "active",
    description:
      "Un orage se leve au-dessus de toi et te suit. Pendant dix secondes, la foudre s'abat sans repit sur tout ce qui t'entoure.",
    icone: "cap-orage",
    effet: "orage-final",
    paliers: [
      { texte: "10 s de foudre continue", rechargement: 40000 },
      { texte: "14 s de foudre continue", rechargement: 36000 },
    ],
  },
  {
    id: "heure-sombre",
    nom: "Heure sombre",
    rang: "SSR",
    type: "active",
    description:
      "Le monde s'arrete. Pendant trois secondes, plus rien ne bouge — sauf toi. Ce que tu en fais te regarde.",
    icone: "cap-heure-sombre",
    effet: "heure-sombre",
    paliers: [
      { texte: "Fige tout pendant 3 s", rechargement: 60000 },
      { texte: "Fige tout pendant 4,5 s", rechargement: 55000 },
    ],
  },

  // ==================== Chevalier Sacre (suite) ====================
  {
    id: "serment-de-fer",
    nom: "Serment de fer",
    rang: "C",
    type: "passive",
    classes: ["chevalier"],
    description:
      "Chaque fois qu'il tombe sous la moitie de sa vie, il jure a nouveau — et il en ressort plus dur. Definitivement.",
    paliers: [
      { texte: "+8 resistance a chaque passage sous 50% de vie", appliquer: (b) => void (b.sermentDeFer += 8) },
      { texte: "+4 resistance supplementaire par passage", appliquer: (b) => void (b.sermentDeFer += 4) },
    ],
  },
  {
    id: "martyre",
    nom: "Martyre",
    rang: "SSR",
    type: "active",
    classes: ["chevalier"],
    description:
      "Pendant 8 secondes, tous les degats subis par l'equipe entiere lui sont transferes, et il ne peut pas mourir. Apres, on verra.",
    icone: "cap-martyre",
    effet: "martyre",
    paliers: [
      { texte: "8 s de transfert total", rechargement: 60000 },
      { texte: "11 s de transfert total", rechargement: 55000 },
    ],
  },

  // ======================== Guerrier (suite) ========================
  {
    id: "sang-pour-sang",
    nom: "Sang pour sang",
    rang: "B",
    type: "passive",
    classes: ["guerrier"],
    description:
      "Il refuse d'etre soigne par qui que ce soit. Il ne recupere plus qu'en tuant — mais alors, beaucoup.",
    paliers: [
      { texte: "Plus aucun soin, mais +4% de vie max par ennemi tue", appliquer: (b) => void (b.sangPourSang += 0.04) },
      { texte: "+2% supplementaires par ennemi tue", appliquer: (b) => void (b.sangPourSang += 0.02) },
    ],
  },
  {
    id: "dernier-debout",
    nom: "Le dernier debout",
    rang: "SR",
    type: "passive",
    classes: ["guerrier"],
    description:
      "Plus l'equipe s'effondre, plus il devient terrifiant. Il n'a jamais aussi bien combattu que seul.",
    paliers: [
      { texte: "+25% de degats par allie mort ou replie", appliquer: (b) => void (b.dernierDebout += 0.25) },
      { texte: "+15% supplementaires par allie absent", appliquer: (b) => void (b.dernierDebout += 0.15) },
    ],
  },

  // ========================== Assassin (suite) ==========================
  {
    id: "marque-de-sang",
    nom: "Marque de sang",
    rang: "D",
    type: "passive",
    classes: ["assassin"],
    description: "Sa premiere attaque sur une cible qu'il n'a jamais touchee frappe bien plus fort.",
    paliers: [
      { texte: "Premiere attaque x2,5", appliquer: (b) => void (b.marqueDeSang = 2.5) },
      { texte: "Premiere attaque x3,5", appliquer: (b) => void (b.marqueDeSang = 3.5) },
    ],
  },
  {
    id: "danse-des-ombres",
    nom: "Danse des ombres",
    rang: "SR",
    type: "passive",
    classes: ["assassin"],
    description:
      "Chaque mort raccourcit ses rechargements. Enchaine assez vite, et il ne s'arrete plus jamais.",
    paliers: [
      { texte: "-0,4 s de rechargement par ennemi tue", appliquer: (b) => void (b.danseDesOmbres += 400) },
      { texte: "-0,3 s supplementaires par ennemi tue", appliquer: (b) => void (b.danseDesOmbres += 300) },
    ],
  },

  // ============================== Rodeur ==============================
  {
    id: "fleche-perforante",
    nom: "Fleche perforante",
    rang: "E",
    type: "passive",
    classes: ["rodeur"],
    description: "Ses fleches traversent les corps et continuent leur route.",
    paliers: [{ texte: "Les fleches transpercent", appliquer: (b) => void (b.perforant = true) }],
  },
  {
    id: "piege",
    nom: "Piege a machoires",
    rang: "D",
    type: "active",
    classes: ["rodeur"],
    description: "Pose un piege au sol : le premier qui marche dessus reste sur place.",
    icone: "cap-piege",
    effet: "piege",
    paliers: [
      { texte: "Immobilise 2 s", rechargement: 11000 },
      { texte: "Immobilise 3 s et blesse", rechargement: 10000 },
      { texte: "Immobilise 4 s et blesse fort", rechargement: 9000 },
    ],
  },
  {
    id: "oeil-de-lynx",
    nom: "Oeil de lynx",
    rang: "C",
    type: "passive",
    classes: ["rodeur"],
    description: "Il voit plus loin, et il vise mieux.",
    paliers: [
      {
        texte: "+45 de portee, +8% de critique",
        appliquer: (b) => {
          b.portee += 45;
          b.critChance += 0.08;
        },
      },
      {
        texte: "+45 de portee, +8% de critique",
        appliquer: (b) => {
          b.portee += 45;
          b.critChance += 0.08;
        },
      },
    ],
  },
  {
    id: "carquois-sans-fin",
    nom: "Carquois sans fin",
    rang: "SR",
    type: "passive",
    classes: ["rodeur"],
    description: "Sa volee passe de trois fleches a un mur de fleches.",
    paliers: [
      { texte: "+2 fleches par volee", appliquer: (b) => void (b.flechesSupplementaires += 2) },
      { texte: "+2 fleches par volee", appliquer: (b) => void (b.flechesSupplementaires += 2) },
    ],
  },
  {
    id: "fleche-du-jugement",
    nom: "Fleche du jugement",
    rang: "SSR",
    type: "active",
    classes: ["rodeur"],
    description:
      "Une seule fleche, qui traverse tout l'ecran d'un bout a l'autre et acheve net tout ce qui est deja blesse.",
    icone: "cap-fleche-jugement",
    effet: "fleche-du-jugement",
    paliers: [
      { texte: "Acheve tout ce qui est sous 40% de vie", rechargement: 50000 },
      { texte: "Acheve tout ce qui est sous 55% de vie", rechargement: 45000 },
    ],
  },

  // ============================== Oracle ==============================
  {
    id: "priere",
    nom: "Priere",
    rang: "E",
    type: "active",
    classes: ["oracle"],
    description: "Elle soigne l'allie le plus mal en point, ou qu'il soit sur le champ de bataille.",
    icone: "cap-priere",
    effet: "priere",
    paliers: [
      { texte: "Rend 25% de la vie maximum", rechargement: 12000 },
      { texte: "Rend 35% de la vie maximum", rechargement: 11000 },
      { texte: "Rend 50% de la vie maximum", rechargement: 10000 },
    ],
  },
  {
    id: "presage",
    nom: "Presage",
    rang: "C",
    type: "passive",
    classes: ["oracle"],
    description: "Elle voit les coups arriver, et le dit assez fort pour que les autres esquivent.",
    paliers: [
      { texte: "+5% d'esquive pour toute l'equipe", appliquer: (b) => void (b.presage += 0.05) },
      { texte: "+5% d'esquive pour toute l'equipe", appliquer: (b) => void (b.presage += 0.05) },
    ],
  },
  {
    id: "chant-de-guerre",
    nom: "Chant de guerre",
    rang: "B",
    type: "active",
    classes: ["oracle"],
    description: "Toute l'equipe frappe nettement plus vite pendant huit secondes.",
    icone: "cap-chant",
    effet: "chant-de-guerre",
    paliers: [
      { texte: "+30% de vitesse d'attaque, 8 s", rechargement: 20000 },
      { texte: "+45% de vitesse d'attaque, 10 s", rechargement: 18000 },
    ],
  },
  {
    id: "resurrection",
    nom: "Resurrection",
    rang: "SSR",
    type: "passive",
    classes: ["oracle"],
    description:
      "Une fois dans la partie — une seule — un heros qui tombe se releve. Elle ne peut pas expliquer comment.",
    paliers: [{ texte: "Un heros se relevera une fois", appliquer: (b) => void (b.resurrection = true) }],
  },

  // =========================== Necromancien ===========================
  {
    id: "charnier",
    nom: "Charnier",
    rang: "E",
    type: "passive",
    classes: ["necromancien"],
    description: "Il apprend a parler plus fort aux morts. Plus de cadavres se relevent.",
    paliers: [
      { texte: "+10% de chance de relever", appliquer: (b) => void (b.chanceRelevement += 0.1) },
      { texte: "+10% de chance de relever", appliquer: (b) => void (b.chanceRelevement += 0.1) },
      { texte: "+15% de chance de relever", appliquer: (b) => void (b.chanceRelevement += 0.15) },
    ],
  },
  {
    id: "armee-des-ombres",
    nom: "Armee des ombres",
    rang: "D",
    type: "passive",
    classes: ["necromancien"],
    description: "Ses mort-vivants tiennent mieux debout et frappent plus fort.",
    paliers: [
      { texte: "Mort-vivants +40% plus puissants", appliquer: (b) => void (b.puissanceMortsVivants += 0.4) },
      { texte: "Mort-vivants +40% plus puissants", appliquer: (b) => void (b.puissanceMortsVivants += 0.4) },
      { texte: "Mort-vivants +50% plus puissants", appliquer: (b) => void (b.puissanceMortsVivants += 0.5) },
    ],
  },
  {
    id: "lien-necrotique",
    nom: "Lien necrotique",
    rang: "C",
    type: "passive",
    classes: ["necromancien"],
    description: "Quand un de ses morts retombe, il explose. Rien ne se perd.",
    paliers: [
      {
        texte: "Les mort-vivants explosent en mourant",
        appliquer: (b) => void (b.mortsVivantsExplosifs = true),
      },
    ],
  },
  {
    id: "seigneur-des-tombes",
    nom: "Seigneur des tombes",
    rang: "SR",
    type: "passive",
    classes: ["necromancien"],
    description: "Ses mort-vivants ne se decomposent plus. Ils restent tant qu'on ne les detruit pas.",
    paliers: [
      {
        texte: "Les mort-vivants ne disparaissent plus",
        appliquer: (b) => void (b.mortsVivantsEternels = true),
      },
    ],
  },
  {
    id: "appel-des-morts",
    nom: "L'Appel",
    rang: "SSR",
    type: "active",
    classes: ["necromancien"],
    description:
      "Il sacrifie tous ses mort-vivants d'un coup pour dresser un colosse fait de leurs restes.",
    icone: "cap-appel",
    effet: "appel-des-morts",
    paliers: [{ texte: "Fusionne toute l'armee en un colosse", rechargement: 70000 }],
  },
];

// ------------------------------------------------------------- le tirage

/**
 * Poids de tirage par rang. Le rang du heros augmentera la part des rangs
 * eleves (DESIGN.md §4.1, troisieme effet d'une montee de rang) : c'est le role
 * du parametre `faveur`.
 */
const POIDS: Record<Rang, number> = {
  F: 100,
  E: 80,
  D: 60,
  C: 45,
  B: 32,
  A: 20,
  S: 10,
  SR: 4,
  SSR: 1,
};

export interface SourceAleatoire {
  next(): number;
}

/** Palier atteint pour chaque competence possedee, par identifiant */
export type CompetencesPossedees = Record<string, number>;

export function competenceParId(id: string): CompetenceDef | undefined {
  return COMPETENCES.find((c) => c.id === id);
}

export function estDisponible(
  competence: CompetenceDef,
  classe: ClassId,
  possedees: CompetencesPossedees,
): boolean {
  if (competence.classes && !competence.classes.includes(classe)) return false;
  return (possedees[competence.id] ?? 0) < competence.paliers.length;
}

export function tirerCompetences(
  rng: SourceAleatoire,
  classe: ClassId,
  possedees: CompetencesPossedees,
  nombre = 3,
  faveur = 0,
): CompetenceDef[] {
  const restantes = COMPETENCES.filter((c) => estDisponible(c, classe, possedees));
  const tirees: CompetenceDef[] = [];

  while (tirees.length < nombre && restantes.length > 0) {
    const poids = restantes.map((c) => poidsDe(c.rang, faveur));
    const total = poids.reduce((a, b) => a + b, 0);
    let seuil = rng.next() * total;

    let index = restantes.length - 1;
    for (let i = 0; i < restantes.length; i++) {
      seuil -= poids[i] ?? 0;
      if (seuil <= 0) {
        index = i;
        break;
      }
    }

    const choisie = restantes.splice(index, 1)[0];
    if (choisie) tirees.push(choisie);
  }

  return tirees;
}

function poidsDe(rang: Rang, faveur: number): number {
  return POIDS[rang] * Math.pow(1 + faveur, ORDRE_RANGS.indexOf(rang));
}

// --------------------------------------------------- affichage (sans Phaser)

/** Ce que l'interface a besoin de savoir pour dessiner une carte de choix. */
export interface Proposition {
  id: string;
  nom: string;
  description: string;
  etiquette: string;
  couleur: number;
}

export function propositionCompetence(
  competence: CompetenceDef,
  possedees: CompetencesPossedees,
): Proposition {
  const palierActuel = possedees[competence.id] ?? 0;
  const palier = competence.paliers[palierActuel];
  const nouvelle = palierActuel === 0;

  return {
    id: competence.id,
    nom: nouvelle ? competence.nom : `${competence.nom} ${palierActuel + 1}`,
    description: nouvelle ? competence.description : (palier?.texte ?? ""),
    etiquette: `${competence.rang}  ·  ${etiquetteType(competence.type)}`,
    couleur: COULEURS_RANG[competence.rang],
  };
}

export function propositionEvolution(competence: CompetenceDef, evolution: EvolutionDef): Proposition {
  return {
    id: evolution.id,
    nom: evolution.nom,
    description: evolution.description,
    etiquette: `EVOLUTION  ·  ${competence.nom}`,
    couleur: evolution.teinte ?? COULEURS_RANG[competence.rang],
  };
}

function etiquetteType(type: TypeCompetence): string {
  if (type === "active") return "ACTIVE";
  if (type === "auto") return "AUTOMATIQUE";
  return "PASSIVE";
}
