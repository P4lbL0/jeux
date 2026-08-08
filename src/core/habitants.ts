/**
 * Les habitants et l'economie du village (DESIGN.md §4.18).
 *
 * Un habitant a un **metier**, un **rang** et un **niveau** — et rang et niveau
 * ne font qu'une seule chose : la **cadence de production**. Pas de statistique
 * de combat, pas d'arbre de competences, pas de second ecran de personnage. Le
 * §4.18 explique pourquoi on se l'interdit : un habitant qui aurait un vrai
 * build, ce serait un deuxieme jeu de collection a cote de celui des heros.
 *
 * Ce fichier ne connait pas Phaser. Il ne sait meme pas ou sont les postes : il
 * ne fait que produire, manger et compter.
 */

import { ORDRE_RANGS, type Rang } from "./classes";

export type Metier =
  | "pecheur"
  | "fermier"
  | "bucheron"
  | "mineur"
  | "forgeron"
  | "charpentier"
  | "guetteur";

/** Les quatre ressources recoltees (DESIGN.md §4.18). */
export type Ressource = "poisson" | "ble" | "bois" | "minerai";

export const RESSOURCES: Ressource[] = ["poisson", "ble", "bois", "minerai"];

export type Stocks = Record<Ressource, number>;

export function stocksVides(): Stocks {
  return { poisson: 0, ble: 0, bois: 0, minerai: 0 };
}

/** Ce que chaque metier produit, ou `null` s'il transforme au lieu de recolter. */
export const PRODUCTION: Record<Metier, Ressource | null> = {
  pecheur: "poisson",
  bucheron: "bois",
  mineur: "minerai",
  /**
   * Le fermier ne recolte **rien directement**, et c'est voulu.
   *
   * Le ble ne tombe pas a la seconde : on seme, ca murit, on moissonne
   * (§4.18). Sa cadence sert donc a faire **pousser les champs**
   * (`game/champs.ts`), et le ble arrive par la moisson. Lui donner en plus une
   * production continue le compterait deux fois.
   */
  fermier: null,
  // Ceux-la ne recoltent rien non plus : ils transforment (forge, charpente) ou
  // ils veillent. Leur travail arrive plus tard.
  forgeron: null,
  charpentier: null,
  guetteur: null,
};

export const NOMS_METIER: Record<Metier, string> = {
  pecheur: "Pecheur",
  fermier: "Fermier",
  bucheron: "Bucheron",
  mineur: "Mineur",
  forgeron: "Forgeron",
  charpentier: "Charpentier",
  guetteur: "Guetteur",
};

export const NOMS_RESSOURCE: Record<Ressource, string> = {
  poisson: "Poisson",
  ble: "Ble",
  bois: "Bois",
  minerai: "Minerai",
};

/**
 * Les postures civiles (DESIGN.md §4.18).
 *
 * Le §4.4 gere deja deux populations avec un seul systeme — les heros IA et les
 * sbires. Les habitants sont la troisieme, et ils reutilisent le meme
 * vocabulaire plutot que d'en inventer un.
 */
export type PostureCivile = "travail" | "prudent" | "abri";

export const NOMS_POSTURE_CIVILE: Record<PostureCivile, string> = {
  travail: "AU TRAVAIL",
  prudent: "PRUDENT",
  abri: "A L'ABRI",
};

/**
 * **La table de reglages de l'economie.** Comme celle du cycle, c'est le seul
 * endroit a toucher pour changer l'equilibre.
 */
export const REGLAGES_VILLAGE = {
  /** Ce qu'un habitant de rang F et de niveau 1 produit par minute de travail */
  productionDeBase: 6,

  /** Ce que chaque niveau ajoute a la cadence, en part de la production de base */
  gainParNiveau: 0.08,

  /** Ce que chaque rang multiplie la cadence */
  multiplicateurParRang: 1.35,

  /** Niveaux gagnes par minute de travail effectif */
  niveauxParMinute: 0.12,

  /** Niveau maximum au rang F ; chaque rang au-dessus ajoute autant */
  plafondParRang: 10,

  /** Ce qu'un habitant mange par jour, toutes nourritures confondues */
  appetit: 8,

  /**
   * Distance a laquelle un habitant "prudent" lache son poste, en pixels.
   *
   * Genereuse : le §4.18 veut qu'un habitant ne meure que si le joueur a laisse
   * ce flanc sans personne. S'il ne partait qu'au dernier moment, il mourrait
   * de sa lenteur et non d'une decision.
   */
  distanceDeFuite: 260,

  /** Vitesse d'un habitant qui travaille, puis quand il court, en px/s */
  vitesseTravail: 34,
  vitesseFuite: 96,
};

/**
 * Un habitant, cote regles.
 *
 * La partie visible (le sprite, le chemin vers le poste, la fuite) vit dans
 * `src/game/`. Ici il n'y a que ce qui se teste.
 */
export interface Habitant {
  id: number;
  nom: string;
  metier: Metier;
  rang: Rang;
  /** Niveau dans le metier ; il monte tout seul en travaillant (§4.18) */
  niveau: number;
  /** Progression fractionnaire vers le niveau suivant */
  progression: number;
  posture: PostureCivile;
  vivant: boolean;
  /** Faux quand il a faim : il ne produit plus tant qu'il n'a pas mange */
  rassasie: boolean;
}

let prochainId = 1;

/** Remet le compteur d'identifiants a zero — pour que les tests soient isoles. */
export function reinitialiserIdentifiants(): void {
  prochainId = 1;
}

export function creerHabitant(nom: string, metier: Metier, rang: Rang = "F"): Habitant {
  return {
    id: prochainId++,
    nom,
    metier,
    rang,
    niveau: 1,
    progression: 0,
    posture: "prudent",
    vivant: true,
    rassasie: true,
  };
}

/** Le plafond de niveau accorde par un rang (meme principe qu'au §4.1). */
export function plafondDeNiveau(rang: Rang): number {
  return (ORDRE_RANGS.indexOf(rang) + 1) * REGLAGES_VILLAGE.plafondParRang;
}

/**
 * Ce que l'habitant produit par minute de travail.
 *
 * **C'est la seule chose que son rang et son niveau changent** (§4.18). Le rang
 * multiplie, le niveau ajoute : deux habitants de meme rang se ressemblent, mais
 * un rang d'ecart se voit immediatement.
 */
export function cadence(habitant: Habitant): number {
  if (!habitant.vivant || !habitant.rassasie) return 0;

  const { productionDeBase, gainParNiveau, multiplicateurParRang } = REGLAGES_VILLAGE;
  const rang = ORDRE_RANGS.indexOf(habitant.rang);
  return (
    productionDeBase *
    (1 + (habitant.niveau - 1) * gainParNiveau) *
    Math.pow(multiplicateurParRang, rang)
  );
}

/**
 * Fait travailler un habitant pendant `minutes`, et le fait progresser.
 *
 * @returns ce qu'il a produit, ou null s'il n'a rien produit
 */
export function travailler(
  habitant: Habitant,
  minutes: number,
): { ressource: Ressource; quantite: number } | null {
  const quantite = cadence(habitant) * minutes;
  if (quantite <= 0) return null;

  // Le niveau se gagne au travail, pas a la recolte : un fermier qui fait
  // pousser et un forgeron qui forge progressent comme les autres, meme si rien
  // ne tombe dans les stocks a cet instant.
  faireMonter(habitant, minutes);

  const ressource = PRODUCTION[habitant.metier];
  if (ressource === null) return null;
  return { ressource, quantite };
}

/**
 * Le niveau se gagne en travaillant, tout seul.
 *
 * Personne n'a envie de distribuer des points a quinze villageois : un habitant
 * qu'on laisse tranquille doit s'ameliorer de lui-meme (§4.18). Ce qui se decide,
 * c'est le **rang**, et lui se paie.
 */
function faireMonter(habitant: Habitant, minutes: number): void {
  const plafond = plafondDeNiveau(habitant.rang);
  if (habitant.niveau >= plafond) return;

  habitant.progression += minutes * REGLAGES_VILLAGE.niveauxParMinute;
  while (habitant.progression >= 1 && habitant.niveau < plafond) {
    habitant.progression -= 1;
    habitant.niveau += 1;
  }
  // Au plafond, la progression ne s'accumule pas en attendant un rang : sinon
  // acheter un rang ferait gagner cinq niveaux d'un coup, sans rien avoir fait.
  if (habitant.niveau >= plafond) habitant.progression = 0;
}

/** Le rang suivant, ou null si l'habitant est deja au sommet de l'echelle. */
export function rangSuivant(rang: Rang): Rang | null {
  return ORDRE_RANGS[ORDRE_RANGS.indexOf(rang) + 1] ?? null;
}

/**
 * Le repas du soir.
 *
 * Chaque habitant mange ; s'il n'y a pas assez, ceux qui n'ont rien eu cessent
 * de travailler jusqu'au repas suivant. **Ils ne meurent pas de faim** : le
 * §4.18 refuse qu'un habitant meure autrement que sous les coups d'un monstre.
 *
 * Le poisson est mange avant le ble, parce que la peche est la source sure : on
 * garde ainsi en reserve celle qu'une horde peut detruire.
 *
 * @returns le nombre d'habitants qui n'ont pas mange
 */
export function nourrir(habitants: Habitant[], stocks: Stocks): number {
  let affames = 0;

  for (const habitant of habitants) {
    if (!habitant.vivant) continue;

    let reste = REGLAGES_VILLAGE.appetit;
    for (const ressource of ["poisson", "ble"] as const) {
      const pris = Math.min(stocks[ressource], reste);
      stocks[ressource] -= pris;
      reste -= pris;
      if (reste <= 0) break;
    }

    habitant.rassasie = reste <= 0;
    if (!habitant.rassasie) affames += 1;
  }

  return affames;
}

/** Le total de nourriture disponible, poisson et ble confondus. */
export function nourritureDisponible(stocks: Stocks): number {
  return stocks.poisson + stocks.ble;
}

/** Combien de jours le stock actuel peut encore nourrir tout le monde. */
export function joursDeVivres(habitants: Habitant[], stocks: Stocks): number {
  const bouches = habitants.filter((h) => h.vivant).length;
  if (bouches === 0) return Infinity;
  return nourritureDisponible(stocks) / (bouches * REGLAGES_VILLAGE.appetit);
}
