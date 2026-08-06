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
  // Chevalier Sacre
  | "sursaut-sacre"
  | "benediction"
  // Guerrier
  | "moulinet"
  | "moulinet-aspirant"
  | "moulinet-sanglant"
  // Mage
  | "dome"
  | "exil"
  // Assassin
  | "invisibilite"
  | "hecatombe";

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
    pvParTranche: 0,
    degatsParTranche: 0,
    volDeVieParTranche: 0,
    satellites: 0,
    satelliteFeu: false,
    satelliteGlace: false,
    provocation: 0,
    rageParPvManquant: 0,
    discretion: false,
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
      "Tout ce qui l'approche ne voit plus que lui. Chaque ennemi qui le cible le rend plus dur, chaque mort a ses pieds le rend plus solide.",
    paliers: [
      {
        texte: "Rayon 90 : +1 resistance par ennemi, +1 PV max par mort a ses pieds",
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
