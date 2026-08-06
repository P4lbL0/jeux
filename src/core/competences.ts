import type { ClassId } from "./classes";

/**
 * Competences proposees a chaque montee de niveau (DESIGN.md §4.1).
 *
 * Comme classes.ts, ce fichier est du *contenu* : aucune dependance a Phaser,
 * aucune logique de jeu. On peut donc l'equilibrer et le tester tout seul.
 */

export type Rarete = "commune" | "rare" | "epique" | "legendaire";

/** Les bonus accumules par un heros. Toujours partir de bonusVierge(). */
export interface Bonus {
  pvMax: number;
  degats: number;
  vitesse: number;
  /** Multiplicateur : 0.9 = 10% plus rapide */
  cadence: number;
  portee: number;
  esquive: number;
  critChance: number;
  critMultiplicateur: number;
  /** Points de vie rendus a chaque ennemi tue */
  soinParKill: number;
  /** Multiplicateur du rechargement des ultimes : 0.7 = 30% plus court */
  rechargementUltime: number;
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
    rechargementUltime: 1,
  };
}

export interface CompetenceDef {
  id: string;
  nom: string;
  description: string;
  rarete: Rarete;
  /** Absent = proposee a toutes les classes */
  classes?: ClassId[];
  /** Une competence sans limite peut etre reprise plusieurs fois */
  maximum?: number;
  /** Remet les points de vie au maximum en plus de son effet */
  soinComplet?: boolean;
  appliquer(bonus: Bonus): void;
}

export const COULEURS_RARETE: Record<Rarete, number> = {
  commune: 0xb8b2a4,
  rare: 0x5ec8f0,
  epique: 0xc86bff,
  legendaire: 0xf0c419,
};

/**
 * Poids de tirage. Le rang du heros augmentera la part des raretes elevees
 * (DESIGN.md §4.1, troisieme effet d'une montee de rang) : c'est le role du
 * parametre `faveur` de tirerCompetences().
 */
const POIDS: Record<Rarete, number> = {
  commune: 60,
  rare: 26,
  epique: 11,
  legendaire: 3,
};

export const COMPETENCES: CompetenceDef[] = [
  {
    id: "lame-affutee",
    nom: "Lame affutee",
    description: "+4 degats",
    rarete: "commune",
    appliquer: (b) => void (b.degats += 4),
  },
  {
    id: "bottes-usees",
    nom: "Bottes usees",
    description: "+14 vitesse",
    rarete: "commune",
    appliquer: (b) => void (b.vitesse += 14),
  },
  {
    id: "cuirasse",
    nom: "Cuirasse rapiecee",
    description: "+25 vie maximum",
    rarete: "commune",
    appliquer: (b) => void (b.pvMax += 25),
  },
  {
    id: "entrainement",
    nom: "Entrainement",
    description: "Attaque 10% plus vite",
    rarete: "commune",
    appliquer: (b) => void (b.cadence *= 0.9),
  },
  {
    id: "reflexes",
    nom: "Reflexes",
    description: "+6% d'esquive",
    rarete: "rare",
    appliquer: (b) => void (b.esquive += 0.06),
  },
  {
    id: "longue-vue",
    nom: "Longue vue",
    description: "+30 de portee",
    rarete: "rare",
    appliquer: (b) => void (b.portee += 30),
  },
  {
    id: "point-faible",
    nom: "Point faible",
    description: "+12% de coup critique",
    rarete: "rare",
    appliquer: (b) => void (b.critChance += 0.12),
  },
  {
    id: "sang-froid",
    nom: "Sang-froid",
    description: "+2 vie a chaque ennemi tue",
    rarete: "rare",
    appliquer: (b) => void (b.soinParKill += 2),
  },
  {
    id: "fureur",
    nom: "Fureur",
    description: "+9 degats et attaque 5% plus vite",
    rarete: "epique",
    appliquer: (b) => {
      b.degats += 9;
      b.cadence *= 0.95;
    },
  },
  {
    id: "rage-guerrier",
    nom: "Rage du sang",
    description: "+8 degats, +14 de portee",
    rarete: "epique",
    classes: ["guerrier"],
    appliquer: (b) => {
      b.degats += 8;
      b.portee += 14;
    },
  },
  {
    id: "muraille",
    nom: "Muraille",
    description: "+60 vie maximum",
    rarete: "epique",
    classes: ["chevalier"],
    appliquer: (b) => void (b.pvMax += 60),
  },
  {
    id: "arcanes",
    nom: "Arcanes profondes",
    description: "+13 degats",
    rarete: "epique",
    classes: ["mage"],
    appliquer: (b) => void (b.degats += 13),
  },
  {
    id: "coup-fatal",
    nom: "Coup fatal",
    description: "Les critiques font x1 de degats en plus",
    rarete: "epique",
    classes: ["assassin"],
    appliquer: (b) => void (b.critMultiplicateur += 1),
  },
  {
    id: "second-souffle",
    nom: "Second souffle",
    description: "+70 vie maximum et soin complet",
    rarete: "legendaire",
    soinComplet: true,
    maximum: 2,
    appliquer: (b) => void (b.pvMax += 70),
  },
  {
    id: "ultime-affine",
    nom: "Ultime affine",
    description: "Ultimes recharges 30% plus vite",
    rarete: "legendaire",
    maximum: 2,
    appliquer: (b) => void (b.rechargementUltime *= 0.7),
  },
];

/** Interface minimale attendue : evite de dependre de la classe Rng ici. */
export interface SourceAleatoire {
  next(): number;
}

/**
 * Tire les competences a proposer au joueur.
 *
 * @param faveur 0 = poids normaux. Plus la valeur monte, plus les raretes
 *               elevees sont probables. C'est par la que le rang d'un heros
 *               influencera ses choix (DESIGN.md §4.1).
 */
export function tirerCompetences(
  rng: SourceAleatoire,
  classe: ClassId,
  dejaPrises: Record<string, number>,
  nombre = 3,
  faveur = 0,
): CompetenceDef[] {
  const disponibles = COMPETENCES.filter((c) => {
    if (c.classes && !c.classes.includes(classe)) return false;
    const prises = dejaPrises[c.id] ?? 0;
    return c.maximum === undefined || prises < c.maximum;
  });

  const tirees: CompetenceDef[] = [];
  const restantes = [...disponibles];

  while (tirees.length < nombre && restantes.length > 0) {
    const poids = restantes.map((c) => poidsDe(c.rarete, faveur));
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

function poidsDe(rarete: Rarete, faveur: number): number {
  const base = POIDS[rarete];
  const rang = { commune: 0, rare: 1, epique: 2, legendaire: 3 }[rarete];
  return base * Math.pow(1 + faveur, rang);
}
