/**
 * Les habitants et l'economie du village (DESIGN.md §4.18).
 *
 * Un habitant a un **metier**, un **rang** et un **niveau** — et rang et niveau
 * ne font qu'une seule chose : la **cadence de production**. Ce qui le rend
 * unique n'est pas ici : ses trois statistiques, ses traits, son stress et ses
 * etats vivent dans `personne.ts`, **partages avec les heros** (§4.23).
 *
 * ⚠️ **Deux vieilles regles de ce fichier sont mortes**, et il vaut mieux le
 * dire que le taire :
 *
 * - « pas de statistiques de combat » est tombee au bloc 4 (voir `combatDe`) ;
 * - « pas de second ecran de personnage » est tombee au bloc 5 : la fiche est
 *   desormais unique et commune aux deux populations (§4.10). La raison qui
 *   l'emporte est la meme dans les deux cas — **les futurs heros sortent du
 *   village** (§4.18, jalon 9), donc un habitant sans rien de mesurable
 *   deviendrait heros par magie.
 *
 * Ce fichier ne connait pas Phaser. Il ne sait meme pas ou sont les postes : il
 * ne fait que produire, manger et compter.
 */

import { ORDRE_RANGS, type Rang } from "./classes";
import { creerPersonne, type Personne } from "./personne";
import { Rng } from "./rng";

export type Metier =
  | "pecheur"
  | "fermier"
  | "bucheron"
  | "mineur"
  | "forgeron"
  | "charpentier"
  | "guetteur";

/**
 * Les ressources recoltees (DESIGN.md §4.18) — quatre, puis **la pierre**
 * depuis le bloc 7b (20 septembre 2026) : c'est la matiere du dernier palier
 * de mur (§4.20), et elle sort de la mine avec le minerai.
 */
export type Ressource = "poisson" | "ble" | "bois" | "minerai" | "pierre";

export const RESSOURCES: Ressource[] = ["poisson", "ble", "bois", "minerai", "pierre"];

export type Stocks = Record<Ressource, number>;

export function stocksVides(): Stocks {
  return { poisson: 0, ble: 0, bois: 0, minerai: 0, pierre: 0 };
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

/**
 * Ce qu'un metier rapporte **en plus** de sa production, et dans quelle part.
 *
 * Le mineur sort de la pierre avec le minerai : une unite de pierre pour deux
 * de minerai (bloc 7b, 20 septembre 2026). Un seul poste, une seule cadence,
 * et la pierre arrive sans qu'on affecte personne de plus — c'est le prix du
 * mur de pierre qui fait le choix, pas un metier de plus a gerer.
 */
export const SOUS_PRODUIT: Partial<Record<Metier, { ressource: Ressource; part: number }>> = {
  mineur: { ressource: "pierre", part: 0.5 },
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
  pierre: "Pierre",
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
  /** Ce qu'il lui reste de vie quand il se bat ; plein tant qu'il travaille */
  pv: number;
  /**
   * Ce qu'il a de commun avec un heros : ses trois statistiques, ses traits,
   * ses sequelles, son stress et ses etats (§4.23).
   *
   * ⚠️ **Son nom vit la-dedans, plus ici.** Le renommage est commun aux deux
   * populations (§4.18) ; le dupliquer aurait garanti qu'un des deux champs
   * finisse perime. `habitant.nom` reste lisible via le getter `nomDe`.
   */
  personne: Personne;
}

/** Son nom, la ou il vit vraiment. Un raccourci, pas une copie. */
export function nomDe(habitant: Habitant): string {
  return habitant.personne.nom;
}

/**
 * Ce qu'un habitant vaut au combat (DESIGN.md §4.18).
 *
 * ⚠️ **Ce bloc annule la vieille regle « pas de statistiques de combat ».** Le
 * §4.18 explique pourquoi on la paie : les futurs heros sortent du village, et
 * un habitant sans rien de mesurable deviendrait heros par magie.
 *
 * Les chiffres sont **derisoires**, et c'est le garde-fou principal : dix
 * miliciens ne tiennent pas une nuit. Ils ralentissent, ils grignotent, ils
 * gagnent des secondes.
 */
export interface CombatHabitant {
  pvMax: number;
  degats: number;
  /** En pixels : de quoi frapper ce qui le touche, pas de quoi tenir un front */
  portee: number;
  /** Millisecondes entre deux coups */
  recharge: number;
}

/**
 * La table de reglages du combat civil. Volontairement separee de
 * `REGLAGES_VILLAGE` : ce sont deux equilibrages differents, on ne veut pas
 * qu'un reglage de production touche par accident a la defense.
 */
export const REGLAGES_COMBAT_CIVIL = {
  /** Un habitant de rang F, niveau 1 */
  pvDeBase: 30,
  degatsDeBase: 3,
  portee: 34,
  recharge: 1400,

  /** Ce que chaque niveau ajoute, en part de la valeur de base */
  gainParNiveau: 0.06,
  /** Ce que chaque rang multiplie */
  multiplicateurParRang: 1.3,
};

/**
 * Ce que cet habitant vaut au combat, une fois son rang et son niveau appliques.
 *
 * Meme forme que `cadence()` — le rang multiplie, le niveau ajoute — pour qu'il
 * n'y ait qu'une seule courbe a comprendre dans tout le village.
 */
export function combatDe(habitant: Habitant): CombatHabitant {
  const r = REGLAGES_COMBAT_CIVIL;
  const rang = ORDRE_RANGS.indexOf(habitant.rang);
  const facteur =
    (1 + (habitant.niveau - 1) * r.gainParNiveau) * Math.pow(r.multiplicateurParRang, rang);

  // La Force et l'agregat des traits, sequelles et etats entrent ici et nulle
  // part ailleurs (§4.23). L'agregat est deja calcule : on ne parcourt aucune
  // liste de traits.
  const { mods, stats } = habitant.personne;
  const force = 0.7 + stats.force / 100;

  return {
    pvMax: Math.max(1, Math.round(r.pvDeBase * facteur * mods.pvMax)),
    degats: r.degatsDeBase * facteur * force * mods.degats,
    portee: r.portee,
    // Le rang le rend plus fort, jamais plus rapide : une cadence qui monte
    // aussi ferait exploser la courbe en la multipliant deux fois.
    recharge: r.recharge,
  };
}

let prochainId = 1;

/** Remet le compteur d'identifiants a zero — pour que les tests soient isoles. */
export function reinitialiserIdentifiants(): void {
  prochainId = 1;
}

/**
 * Repositionne le compteur au-dessus d'une sauvegarde rechargee (§4.28).
 *
 * Sans ca, le premier arrivant d'une partie reprise porterait l'identifiant 1 —
 * deja pris par un habitant du depart — et les deux se confondraient partout ou
 * le code compare des identifiants.
 */
export function reserverIdentifiants(dernierId: number): void {
  prochainId = Math.max(prochainId, dernierId + 1);
}

/**
 * @param rng seede par l'appelant : une meme graine redonne le meme village,
 *   statistiques, traits et portraits compris (§4.6)
 */
export function creerHabitant(
  nom: string,
  metier: Metier,
  rang: Rang = "F",
  rng?: Rng,
): Habitant {
  return habitantDe(creerPersonne(nom, rng ?? grainePourLesTests()), metier, rang);
}

/**
 * Un habitant bati autour d'une personne **qui existe deja**.
 *
 * C'est la porte d'entree des arrivants (§4.18) : celui qui attend a la porte a
 * deja un visage, des traits et un nom, et le joueur les a regardes avant de
 * dire oui. Lui en fabriquer d'autres en le faisant entrer trahirait la seule
 * chose que la fiche d'observation promet — que c'est bien **lui** qu'on
 * accepte.
 */
export function habitantDe(personne: Personne, metier: Metier, rang: Rang = "F"): Habitant {
  const habitant: Habitant = {
    id: prochainId++,
    metier,
    rang,
    niveau: 1,
    progression: 0,
    posture: "prudent",
    vivant: true,
    rassasie: true,
    pv: 0,
    personne,
  };
  habitant.pv = combatDe(habitant).pvMax;
  return habitant;
}

/**
 * Une graine par defaut, pour les tests et pour un appel qui n'en fournit pas.
 *
 * Elle avance a chaque appel : deux habitants crees sans graine explicite ne
 * doivent pas etre des jumeaux, sinon un test qui compare deux personnes ne
 * verifie plus rien.
 */
let graineParDefaut = 20260810;
function grainePourLesTests(): Rng {
  return new Rng(graineParDefaut++);
}

/**
 * Sort-il defendre l'eglise, ou reste-t-il au fond ? (DESIGN.md §4.22)
 *
 * Le joueur ne commande rien de tout ca : c'est ce que l'habitant **est** qui
 * decide. Un affame, un blesse ou quelqu'un qui a craque ne sort jamais — se
 * battre le tuerait, et le §4.18 refuse une mort qui ne vienne pas d'un
 * arbitrage du joueur.
 *
 * ⚠️ Le seuil est passe de `0,6` a `60` sans changer une seule decision : le
 * Courage est desormais un **pourcentage** comme les deux autres statistiques
 * (§4.23), pour qu'on puisse comparer deux fiches d'un coup d'oeil.
 */
export const SEUIL_COURAGE = 60;

export function sortDefendre(habitant: Habitant): boolean {
  if (!habitant.vivant || !habitant.rassasie) return false;
  if (habitant.pv < combatDe(habitant).pvMax * 0.5) return false;
  // Celui qui craque ne tient pas une porte, quel que soit son cran.
  if (habitant.personne.rupture !== null) return false;
  return habitant.personne.stats.courage >= SEUIL_COURAGE;
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

  const { personne } = habitant;
  // Un abattu ne fait plus rien, un transcende travaille comme jamais (§4.23).
  // Les autres ruptures sortent l'habitant de son poste, elles ne sont donc pas
  // traitees ici : c'est `village.ts` qui l'en retire.
  if (personne.rupture === "abattement") return 0;
  const elan = personne.rupture === "transcendance" ? 1.6 : 1;

  const { productionDeBase, gainParNiveau, multiplicateurParRang } = REGLAGES_VILLAGE;
  const rang = ORDRE_RANGS.indexOf(habitant.rang);
  return (
    productionDeBase *
    (1 + (habitant.niveau - 1) * gainParNiveau) *
    Math.pow(multiplicateurParRang, rang) *
    personne.mods.cadence *
    elan
  );
}

/**
 * Fait travailler un habitant pendant `minutes`, et le fait progresser.
 *
 * @returns ce qu'il a produit — et `aussi`, le sous-produit du metier s'il en
 *          a un —, ou null s'il n'a rien produit
 */
export function travailler(
  habitant: Habitant,
  minutes: number,
): { ressource: Ressource; quantite: number; aussi?: { ressource: Ressource; quantite: number } } | null {
  const quantite = cadence(habitant) * minutes;
  if (quantite <= 0) return null;

  // Le niveau se gagne au travail, pas a la recolte : un fermier qui fait
  // pousser et un forgeron qui forge progressent comme les autres, meme si rien
  // ne tombe dans les stocks a cet instant.
  faireMonter(habitant, minutes);

  const ressource = PRODUCTION[habitant.metier];
  if (ressource === null) return null;
  const sous = SOUS_PRODUIT[habitant.metier];
  if (!sous) return { ressource, quantite };
  return { ressource, quantite, aussi: { ressource: sous.ressource, quantite: quantite * sous.part } };
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

  // C'est le second usage de l'Intelligence, celui qui l'empeche d'etre une
  // ligne morte sur trente fiches : elle monte plus vite (§4.23).
  const { mods, stats } = habitant.personne;
  const vivacite = mods.monteeNiveau * (0.75 + stats.intelligence / 200);
  habitant.progression += minutes * REGLAGES_VILLAGE.niveauxParMinute * vivacite;
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

    // Le Gourmand mange deux fois plus — et manger le calme d'autant (§4.23).
    let reste = REGLAGES_VILLAGE.appetit * habitant.personne.mods.appetit;
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
  // On compte les rations, pas les tetes : un Gourmand en mange deux, et le
  // joueur doit le voir dans le chiffre qu'il surveille (§4.23).
  const rations = habitants
    .filter((h) => h.vivant)
    .reduce((total, h) => total + h.personne.mods.appetit, 0);
  if (rations === 0) return Infinity;
  return nourritureDisponible(stocks) / (rations * REGLAGES_VILLAGE.appetit);
}
