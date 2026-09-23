import type { ClassId, Rang } from "./classes";
import { COULEURS_RANG, ORDRE_RANGS } from "./classes";
import { BASES } from "./elements";
import type { CleTrait } from "./traits";

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
  | "jugement"
  | "jugement-croisade"
  | "jugement-absolution"
  | "bouclier-des-ames"
  // Guerrier
  | "moulinet"
  | "moulinet-aspirant"
  | "moulinet-sanglant"
  | "charge"
  | "charge-sismique"
  | "charge-sanglante"
  | "cri-de-guerre"
  // Mage
  | "dome"
  | "exil"
  | "clignement"
  | "sablier"
  // Assassin
  | "invisibilite"
  | "hecatombe"
  | "croc-en-jambe"
  | "doppelganger"
  | "contrat"
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
  | "heure-sombre"
  // Les bases elementaires (§4.13) : les quatre premieres partent toutes seules
  | "boule-de-feu"
  | "vent"
  | "eau"
  | "nature"
  | "teleportation"
  // Les fusions actives (§4.25, jalon 6.5, morceau 3)
  | "tourbillon-infernal"
  | "forteresse-mobile"
  | "temps-fracture"
  | "neant"
  | "exil-des-morts";

export type TypeCompetence = "passive" | "active" | "auto";

// ------------------------------------------------------------------ les tags

/**
 * Les tags (§4.25) : le socle des builds. Chaque competence en porte
 * quelques-uns, et tout le reste s'appuie dessus — les passives qui parlent a
 * plusieurs competences a la fois, les fusions, les synergies, la pioche
 * ponderee par la classe et par les traits.
 *
 * ⚠️ **Un tag est un bit, jamais une chaine** : « ce build contient-il FEU et
 * VENT ? » est un `&` sur un entier, pas un parcours de tableau a chaque image.
 * Vingt-sept aujourd'hui, trente et un au plus : les operations binaires de
 * JavaScript travaillent sur 32 bits signes.
 *
 * ⚠️ **Un element est un tag, jamais un type de degats.** Les monstres n'ont
 * aucune resistance elementaire, et il n'y a qu'une statistique de degats
 * (§4.2) : FEU ne veut rien dire d'autre que « cette competence est du feu ».
 *
 * ACTIVE, AUTO et PASSIVE ne sont pas des tags : la nature d'une competence
 * les dit deja (`type`).
 */
export const TAGS = {
  // Les elements
  FEU: 1 << 0,
  GLACE: 1 << 1,
  FOUDRE: 1 << 2,
  POISON: 1 << 3,
  OMBRE: 1 << 4,
  SACRE: 1 << 5,
  EAU: 1 << 6,
  VENT: 1 << 7,
  NATURE: 1 << 8,
  SANG: 1 << 9,
  LAME: 1 << 10,
  MORT: 1 << 11,
  // Les formes
  PROJECTILE: 1 << 12,
  ZONE: 1 << 13,
  CHAINE: 1 << 14,
  MELEE: 1 << 15,
  EXPLOSION: 1 << 16,
  SOL: 1 << 17,
  // Les roles
  MAGIE: 1 << 18,
  DEFENSE: 1 << 19,
  BOUCLIER: 1 << 20,
  MOBILITE: 1 << 21,
  ESQUIVE: 1 << 22,
  RAGE: 1 << 23,
  SOIN: 1 << 24,
  INVOCATION: 1 << 25,
  ENTRAVE: 1 << 26,
} as const;

export type NomDeTag = keyof typeof TAGS;

/** Les noms, dans l'ordre des bits : l'ordre ou une carte les affiche. */
const ORDRE_DES_TAGS = Object.keys(TAGS) as NomDeTag[];

/** Les tags d'un masque, dans l'ordre des bits. */
export function nomsDesTags(masque: number): NomDeTag[] {
  return ORDRE_DES_TAGS.filter((nom) => (masque & TAGS[nom]) !== 0);
}

/** Ce qui separe deux tags sur une carte : c'est la que la ligne peut se couper. */
export const SEPARATEUR_DES_TAGS = "  ·  ";

/** Ce qu'une carte affiche : « FEU · ZONE ». Vide pour une competence sans tag. */
export function texteDesTags(masque: number): string {
  return nomsDesTags(masque).join(SEPARATEUR_DES_TAGS);
}

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
  /**
   * Monstres traverses en plus par toute attaque qui traverse — projectiles
   * et frappes en ligne (§4.25, la penetration).
   */
  penetration: number;
  /** Monstres traverses en plus par les seuls projectiles : Ricochet, Fleche perforante. */
  penetrationProjectiles: number;

  // --- Les statistiques du §4.13 (tranche le 23 septembre 2026) ---
  /** Multiplicateur de la duree des effets des competences : Concentration */
  dureeEffets: number;
  /** Multiplicateur du rayon des competences ZONE : Expansion */
  tailleZones: number;
  /** Part de la vie maximale rendue chaque seconde : Regeneration */
  regeneration: number;
  /** Multiplicateur de la duree de vie des invocations : Persistance */
  dureeInvocations: number;
  /** Projectiles en plus a chaque tir et a chaque salve d'eclats : Proliferation */
  projectiles: number;
  /** Multiplicateur de l'experience gagnee : Erudition */
  xp: number;
  /** Multiplicateur de l'or que laissent ses morts : Cupidite */
  or: number;
  /** Fleches supplementaires dans la volee du Rodeur */
  flechesSupplementaires: number;

  // --- Le Bouclier, base elementaire (§4.13, 23 septembre 2026) ---
  /** Ce que l'ecran absorbe plein, en part de la vie maximale ; 0 = aucun ecran */
  bouclier: number;
  /** Brise, il revient au bout de... (ms) */
  bouclierRetour: number;

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

  // --- Familier du mage ---
  /** Puissance du familier ; 0 = aucun familier */
  familier: number;
  familierGolem: boolean;
  familierSpectre: boolean;
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
    penetration: 0,
    penetrationProjectiles: 0,
    dureeEffets: 1,
    tailleZones: 1,
    regeneration: 0,
    dureeInvocations: 1,
    projectiles: 0,
    xp: 1,
    or: 1,
    flechesSupplementaires: 0,
    bouclier: 0,
    bouclierRetour: 0,
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
    familier: 0,
    familierGolem: false,
    familierSpectre: false,
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
  /** Les tags qu'elle ajoute a ceux de sa competence : des satellites de feu sont du FEU (§4.25) */
  tags?: number;
  appliquer?(bonus: Bonus): void;
}

export interface PalierDef {
  texte: string;
  /** Rechargement en millisecondes, pour les capacites */
  rechargement?: number;
  appliquer?(bonus: Bonus, palier: number): void;
  /**
   * La premiere moitie d'un palier de fusion (§4.25) : on l'a choisie une
   * fois, il faut la choisir encore pour gagner le palier. Rien ne change.
   */
  demi?: boolean;
}

/** Ce qu'une fusion consomme : une competence a son palier maximum, et parfois une evolution precise. */
export interface IngredientDef {
  competence: string;
  /** Absente : n'importe laquelle de ses evolutions, ou aucune. */
  evolution?: string;
}

export interface CompetenceDef {
  id: string;
  nom: string;
  rang: Rang;
  type: TypeCompetence;
  /** Ses tags, en masque de bits (`TAGS`) : ce qu'elle est, pour les builds (§4.25) */
  tags: number;
  /** Absente = proposee a toutes les classes ; presente = sa classe, et les autres en rare (§4.13) */
  classes?: ClassId[];
  /**
   * Reservee a sa classe, meme depuis que les competences de classe s'ouvrent
   * aux autres (§4.13, 23 septembre 2026) : elle n'a pas de sens ailleurs — les
   * morts-vivants du necromancien, la volee du rodeur.
   */
  fermee?: boolean;
  /** Une phrase qui dit ce que la competence fait */
  description: string;
  /** Cle de texture de l'icone, pour les capacites */
  icone?: string;
  effet?: EffetCapacite;
  /** Un palier par prise ; la longueur donne le nombre de prises possibles */
  paliers: PalierDef[];
  /** Choix qui s'ouvre en atteignant ce palier */
  evolutions?: { auPalier: number; options: EvolutionDef[] };
  /**
   * Une fusion (§4.25) : elle ne sort jamais de la pioche avant d'etre prise.
   * Elle se propose en carte a part quand tous ses ingredients sont a leur
   * maximum, et les consomme.
   */
  fusion?: { ingredients: IngredientDef[] };
}

/**
 * **Le double prix d'une fusion** (§4.25, tranche le 23 septembre 2026 par
 * Angelos) : « puisque c'est deux competences fusionnees », il faut la choisir
 * deux fois pour gagner un palier. Entre deux vrais paliers se glisse une
 * moitie, qui ne change rien et reprend le rechargement d'avant.
 *
 * Un palier reste une prise : la pioche, la sauvegarde et les capacites lisent
 * une fusion comme n'importe quelle competence, sans le savoir.
 */
export function enDoublePrix(paliers: PalierDef[]): PalierDef[] {
  const tous: PalierDef[] = [];
  paliers.forEach((palier, i) => {
    if (i > 0) {
      const avant = paliers[i - 1];
      tous.push({ texte: palier.texte, rechargement: avant?.rechargement, demi: true });
    }
    tous.push(palier);
  });
  return tous;
}

/** Le vrai palier atteint apres tant de prises : les moities ne comptent pas. */
export function palierAtteint(competence: CompetenceDef, prises: number): number {
  let n = 0;
  for (let i = 0; i < Math.min(prises, competence.paliers.length); i++) {
    if (!competence.paliers[i]?.demi) n++;
  }
  return n;
}

/** Combien de vrais paliers elle a en tout. */
export function paliersReels(competence: CompetenceDef): number {
  return palierAtteint(competence, competence.paliers.length);
}

// ---------------------------------------------------------------- le contenu

export const COMPETENCES: CompetenceDef[] = [
  // =========================== Communes ===========================
  {
    id: "lame-affutee",
    nom: "Lame affutee",
    rang: "F",
    type: "passive",
    tags: TAGS.LAME,
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
    tags: TAGS.MOBILITE,
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
    tags: TAGS.DEFENSE,
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
    tags: TAGS.MELEE,
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
    tags: TAGS.ESQUIVE,
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
    tags: TAGS.PROJECTILE,
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
    tags: TAGS.LAME,
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
    tags: TAGS.SANG,
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
    tags: TAGS.SANG,
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
    tags: TAGS.DEFENSE,
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
    tags: TAGS.RAGE,
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
    tags: TAGS.SOIN,
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
    tags: TAGS.MAGIE,
    description: "Toutes tes capacites reviennent plus vite.",
    paliers: [
      { texte: "Rechargements -25%", appliquer: (b) => void (b.rechargementCapacites *= 0.75) },
      { texte: "Rechargements -25%", appliquer: (b) => void (b.rechargementCapacites *= 0.75) },
    ],
  },

  // ================= Les statistiques qui manquaient =================
  // §4.13, tranche le 23 septembre 2026 par Angelos : les communes ci-dessus
  // SONT les statistiques (Amplification = Lame affutee, Hate = Bottes usees,
  // Vigueur = Cuirasse rapiecee, Portee = Longue vue, Precision = Point
  // faible). On n'ajoute que celles qui manquaient, plus la Penetration
  // (l'ancienne Reserve), l'experience et l'or. ⚠️ Leurs chiffres sont tranches
  // par le code, a regler en jouant.
  {
    id: "celerite",
    nom: "Celerite",
    rang: "E",
    type: "passive",
    tags: TAGS.MAGIE,
    description: "Tes capacites reviennent un peu plus vite.",
    paliers: [
      { texte: "Rechargements -8%", appliquer: (b) => void (b.rechargementCapacites *= 0.92) },
      { texte: "Rechargements -8%", appliquer: (b) => void (b.rechargementCapacites *= 0.92) },
      { texte: "Rechargements -8%", appliquer: (b) => void (b.rechargementCapacites *= 0.92) },
    ],
  },
  {
    id: "concentration",
    nom: "Concentration",
    rang: "E",
    type: "passive",
    tags: TAGS.MAGIE,
    description: "Ce que font tes capacites dure plus longtemps.",
    paliers: [
      { texte: "Effets 10% plus longs", appliquer: (b) => void (b.dureeEffets += 0.1) },
      { texte: "Effets 10% plus longs", appliquer: (b) => void (b.dureeEffets += 0.1) },
      { texte: "Effets 15% plus longs", appliquer: (b) => void (b.dureeEffets += 0.15) },
    ],
  },
  {
    id: "expansion",
    nom: "Expansion",
    rang: "E",
    type: "passive",
    tags: TAGS.ZONE,
    description: "Tes zones s'elargissent.",
    paliers: [
      { texte: "Zones 10% plus larges", appliquer: (b) => void (b.tailleZones += 0.1) },
      { texte: "Zones 10% plus larges", appliquer: (b) => void (b.tailleZones += 0.1) },
      { texte: "Zones 15% plus larges", appliquer: (b) => void (b.tailleZones += 0.15) },
    ],
  },
  {
    id: "regeneration",
    nom: "Regeneration",
    rang: "F",
    type: "passive",
    tags: TAGS.SOIN,
    description: "Tes plaies se referment toutes seules, lentement, meme au combat.",
    paliers: [
      { texte: "+0,5% de vie max par seconde", appliquer: (b) => void (b.regeneration += 0.005) },
      { texte: "+0,25% de vie max par seconde", appliquer: (b) => void (b.regeneration += 0.0025) },
      { texte: "+0,25% de vie max par seconde", appliquer: (b) => void (b.regeneration += 0.0025) },
    ],
  },
  {
    id: "persistance",
    nom: "Persistance",
    rang: "E",
    type: "passive",
    tags: TAGS.INVOCATION,
    description: "Ce que tu invoques tient plus longtemps.",
    paliers: [
      { texte: "Invocations 10% plus durables", appliquer: (b) => void (b.dureeInvocations += 0.1) },
      { texte: "Invocations 10% plus durables", appliquer: (b) => void (b.dureeInvocations += 0.1) },
      { texte: "Invocations 15% plus durables", appliquer: (b) => void (b.dureeInvocations += 0.15) },
    ],
  },
  {
    id: "proliferation",
    nom: "Proliferation",
    rang: "E",
    type: "passive",
    tags: TAGS.PROJECTILE,
    description: "Un projectile de plus a chaque tir, a chaque salve d'eclats, a chaque boule de feu.",
    paliers: [
      { texte: "+1 projectile", appliquer: (b) => void (b.projectiles += 1) },
      { texte: "+1 projectile", appliquer: (b) => void (b.projectiles += 1) },
    ],
  },
  {
    id: "penetration",
    nom: "Penetration",
    rang: "F",
    type: "passive",
    tags: TAGS.PROJECTILE,
    description: "Ce qui traverse — tirs, charges, fleches — traverse un monstre de plus.",
    paliers: [
      { texte: "+1 de penetration", appliquer: (b) => void (b.penetration += 1) },
      { texte: "+1 de penetration", appliquer: (b) => void (b.penetration += 1) },
      { texte: "+1 de penetration", appliquer: (b) => void (b.penetration += 1) },
    ],
  },
  {
    id: "erudition",
    nom: "Erudition",
    rang: "F",
    type: "passive",
    // L'experience n'est ni un element, ni une forme, ni un role : aucun tag.
    tags: 0,
    description: "Chaque monstre abattu t'apprend un peu plus.",
    paliers: [
      { texte: "+10% d'experience", appliquer: (b) => void (b.xp += 0.1) },
      { texte: "+10% d'experience", appliquer: (b) => void (b.xp += 0.1) },
      { texte: "+15% d'experience", appliquer: (b) => void (b.xp += 0.15) },
    ],
  },
  {
    id: "cupidite",
    nom: "Cupidite",
    rang: "F",
    type: "passive",
    // L'or non plus : aucun tag.
    tags: 0,
    description: "Tu fouilles mieux les cadavres de ceux que tu abats.",
    paliers: [
      { texte: "+10% d'or", appliquer: (b) => void (b.or += 0.1) },
      { texte: "+10% d'or", appliquer: (b) => void (b.or += 0.1) },
      { texte: "+15% d'or", appliquer: (b) => void (b.or += 0.15) },
    ],
  },

  // ================= Les six bases elementaires (§4.13) =================
  // Sans elles, dix des vingt-six fusions du §4.25 etaient incodables. Tranche
  // le 23 septembre 2026 par Angelos : les quatre premieres partent TOUTES
  // SEULES — sans touche, sans emplacement. Ce sont des ingredients : un Vent
  // qui couterait une des quatre touches ne serait jamais pris. Vent, Eau et
  // Nature sont faibles seules, et c'est voulu. Leurs chiffres sont dans
  // `elements.ts`, tranches par le code.
  {
    id: "boule-de-feu",
    nom: "Boule de feu",
    rang: "F",
    type: "auto",
    // Les tags de l'exemple du §4.25, repris tels quels.
    tags: TAGS.FEU | TAGS.PROJECTILE | TAGS.ZONE | TAGS.MAGIE | TAGS.EXPLOSION,
    description: "Toute seule, elle lance une boule de feu sur le monstre le plus proche. Elle eclate au premier contact.",
    icone: "cap-boule-de-feu",
    effet: "boule-de-feu",
    paliers: [
      { texte: "Une boule toutes les 3 s", rechargement: 3000 },
      { texte: "Toutes les 2,6 s, explosion plus large", rechargement: 2600 },
      { texte: "Toutes les 2,2 s, explosion devastatrice", rechargement: 2200 },
    ],
  },
  {
    id: "vent",
    nom: "Vent",
    rang: "E",
    type: "auto",
    tags: TAGS.VENT | TAGS.ZONE,
    description:
      "Tout seul, une bourrasque part vers le groupe le plus serre. Elle repousse les monstres, et emporte ce qui traine au sol.",
    icone: "cap-vent",
    effet: "vent",
    paliers: [
      { texte: "Une bourrasque toutes les 5 s", rechargement: 5000 },
      { texte: "Toutes les 4,2 s, elle porte plus loin", rechargement: 4200 },
      { texte: "Toutes les 3,5 s, elle souffle plus fort", rechargement: 3500 },
    ],
  },
  {
    id: "eau",
    nom: "Eau",
    rang: "E",
    type: "auto",
    tags: TAGS.EAU | TAGS.ZONE | TAGS.SOL,
    description:
      "Toute seule, elle pose une flaque sous le groupe le plus serre. Ce qui la traverse est ralenti, et en ressort mouille.",
    icone: "cap-eau",
    effet: "eau",
    paliers: [
      { texte: "Une flaque toutes les 6 s, qui tient 6 s", rechargement: 6000 },
      { texte: "Plus large, elle tient 8 s", rechargement: 5500 },
      { texte: "Plus large encore, elle tient 10 s", rechargement: 5000 },
    ],
  },
  {
    id: "nature",
    nom: "Nature",
    rang: "D",
    type: "auto",
    tags: TAGS.NATURE | TAGS.ZONE | TAGS.ENTRAVE,
    description:
      "Toute seule, elle fait jaillir des racines sous le groupe le plus serre : ils restent sur place. Les geants, eux, ne sont que ralentis.",
    icone: "cap-nature",
    effet: "nature",
    paliers: [
      { texte: "Retient 1,5 s, toutes les 7 s", rechargement: 7000 },
      { texte: "Retient 2 s, zone plus large", rechargement: 6500 },
      { texte: "Retient 2,5 s, zone plus large encore", rechargement: 6000 },
    ],
  },
  {
    id: "bouclier",
    nom: "Bouclier",
    rang: "D",
    type: "passive",
    tags: TAGS.BOUCLIER | TAGS.DEFENSE,
    description:
      "Un ecran l'entoure et encaisse a sa place. Il se referme quand on le laisse souffler — et quand il se brise, tout le monde l'entend.",
    paliers: [
      {
        texte: "Absorbe 20% de la vie max, revient 10 s apres s'etre brise",
        appliquer: (b) => {
          b.bouclier += BASES.bouclier.part[0];
          b.bouclierRetour = BASES.bouclier.retour[0];
        },
      },
      {
        texte: "Absorbe 30%, revient en 8 s",
        appliquer: (b) => {
          b.bouclier += BASES.bouclier.part[1];
          b.bouclierRetour = BASES.bouclier.retour[1];
        },
      },
      {
        texte: "Absorbe 40%, revient en 6 s",
        appliquer: (b) => {
          b.bouclier += BASES.bouclier.part[2];
          b.bouclierRetour = BASES.bouclier.retour[2];
        },
      },
    ],
  },
  {
    id: "teleportation",
    nom: "Teleportation",
    rang: "C",
    type: "active",
    tags: TAGS.MOBILITE | TAGS.OMBRE,
    description: "Un saut court et instantane, la ou tu vises. Aucun degat : juste etre ailleurs.",
    icone: "cap-teleportation",
    effet: "teleportation",
    paliers: [
      { texte: "Saut de 160 pixels", rechargement: 6000 },
      { texte: "Saut de 200 pixels", rechargement: 5000 },
      { texte: "Saut de 240 pixels", rechargement: 4000 },
    ],
  },

  // ====================== Chevalier Sacre ======================
  {
    id: "sursaut-sacre",
    nom: "Sursaut sacre",
    rang: "F",
    type: "auto",
    tags: TAGS.SACRE | TAGS.SOIN | TAGS.DEFENSE,
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
    tags: TAGS.DEFENSE,
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
    tags: TAGS.SACRE | TAGS.SOIN | TAGS.ZONE,
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
    tags: TAGS.SACRE | TAGS.DEFENSE,
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
    tags: TAGS.RAGE,
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
    tags: TAGS.LAME | TAGS.ZONE | TAGS.MELEE,
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
          tags: TAGS.SANG,
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
    tags: TAGS.LAME,
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
    tags: TAGS.RAGE,
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
    tags: TAGS.MAGIE,
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
          tags: TAGS.FEU,
          nom: "Satellites de feu",
          description: "Ils brulent : degats doubles, et ils laissent une trainee ardente.",
          teinte: 0xff8a3d,
          appliquer: (b) => void (b.satelliteFeu = true),
        },
        {
          id: "satellite-glace",
          tags: TAGS.GLACE,
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
    tags: TAGS.MAGIE,
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
    tags: TAGS.MAGIE | TAGS.DEFENSE | TAGS.BOUCLIER,
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
    tags: TAGS.MAGIE,
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
    tags: TAGS.OMBRE | TAGS.MOBILITE | TAGS.ESQUIVE,
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
    tags: TAGS.SANG,
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
    tags: TAGS.LAME | TAGS.OMBRE,
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
    tags: TAGS.LAME,
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
          tags: TAGS.FEU,
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
    tags: TAGS.FEU | TAGS.ZONE,
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
    tags: TAGS.PROJECTILE | TAGS.MAGIE,
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
    tags: TAGS.FOUDRE | TAGS.CHAINE | TAGS.MAGIE,
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
    tags: TAGS.PROJECTILE,
    description: "Tes projectiles traversent trois ennemis de plus avant de s'arreter.",
    paliers: [
      { texte: "+3 de penetration aux projectiles", appliquer: (b) => void (b.penetrationProjectiles += 3) },
    ],
  },
  {
    id: "pas-leger",
    nom: "Pas leger",
    rang: "F",
    type: "passive",
    tags: TAGS.MOBILITE | TAGS.ESQUIVE,
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
    tags: TAGS.MORT | TAGS.SOIN,
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
    // L'experience d'une vie, en un niveau : rien de ce qu'elle donne n'a de nom.
    tags: 0,
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
    tags: TAGS.MAGIE,
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
    tags: TAGS.DEFENSE,
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
    tags: TAGS.RAGE,
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
    tags: TAGS.FOUDRE | TAGS.ZONE | TAGS.MAGIE,
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
    tags: TAGS.MAGIE,
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
    tags: TAGS.DEFENSE | TAGS.SACRE,
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
    tags: TAGS.SACRE | TAGS.DEFENSE,
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
    tags: TAGS.SANG | TAGS.RAGE,
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
    tags: TAGS.RAGE,
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
    tags: TAGS.SANG | TAGS.LAME,
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
    tags: TAGS.OMBRE,
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
    tags: TAGS.PROJECTILE,
    classes: ["rodeur"],
    description: "Ses fleches traversent trois corps de plus avant de tomber.",
    paliers: [
      { texte: "+3 de penetration aux fleches", appliquer: (b) => void (b.penetrationProjectiles += 3) },
    ],
  },
  {
    id: "piege",
    nom: "Piege a machoires",
    rang: "D",
    type: "active",
    tags: TAGS.SOL | TAGS.ENTRAVE,
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
    tags: TAGS.PROJECTILE,
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
    tags: TAGS.PROJECTILE,
    classes: ["rodeur"],
    fermee: true,
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
    tags: TAGS.PROJECTILE,
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
    tags: TAGS.SACRE | TAGS.SOIN,
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
    tags: TAGS.ESQUIVE,
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
    tags: TAGS.RAGE,
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
    tags: TAGS.SACRE | TAGS.SOIN,
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
    tags: TAGS.MORT | TAGS.INVOCATION,
    classes: ["necromancien"],
    fermee: true,
    description: "Il apprend a parler plus fort aux morts. Plus de cadavres se relevent.",
    paliers: [
      { texte: "+3% de chance de relever", appliquer: (b) => void (b.chanceRelevement += 0.03) },
      { texte: "+3% de chance de relever", appliquer: (b) => void (b.chanceRelevement += 0.03) },
      { texte: "+4% de chance de relever", appliquer: (b) => void (b.chanceRelevement += 0.04) },
    ],
  },
  {
    id: "armee-des-ombres",
    nom: "Armee des ombres",
    rang: "D",
    type: "passive",
    tags: TAGS.MORT | TAGS.OMBRE | TAGS.INVOCATION,
    classes: ["necromancien"],
    fermee: true,
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
    tags: TAGS.MORT | TAGS.EXPLOSION | TAGS.INVOCATION,
    classes: ["necromancien"],
    fermee: true,
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
    tags: TAGS.MORT | TAGS.INVOCATION,
    classes: ["necromancien"],
    fermee: true,
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
    tags: TAGS.MORT | TAGS.INVOCATION,
    classes: ["necromancien"],
    fermee: true,
    description:
      "Il sacrifie tous ses mort-vivants d'un coup pour dresser un colosse fait de leurs restes.",
    icone: "cap-appel",
    effet: "appel-des-morts",
    paliers: [{ texte: "Fusionne toute l'armee en un colosse", rechargement: 70000 }],
  },

  // ================= Chevalier Sacre : le reste du serment =================
  {
    id: "jugement",
    nom: "Jugement",
    rang: "B",
    type: "active",
    tags: TAGS.SACRE | TAGS.ZONE,
    classes: ["chevalier"],
    description: "Il plante son epee, et une colonne de lumiere ecrase la zone.",
    icone: "cap-jugement",
    effet: "jugement",
    paliers: [
      { texte: "Colonne de lumiere", rechargement: 11000 },
      { texte: "Colonne plus large et plus lourde", rechargement: 10000 },
      { texte: "Colonne devastatrice", rechargement: 9000 },
    ],
    evolutions: {
      auPalier: 2,
      options: [
        {
          id: "jugement-croisade",
          nom: "Croisade",
          description: "La colonne ne reste plus au sol : elle te suit partout pendant 6 secondes.",
          effet: "jugement-croisade",
          teinte: 0xfff0a0,
        },
        {
          id: "jugement-absolution",
          tags: TAGS.SOIN,
          nom: "Absolution",
          description: "La lumiere cesse de blesser : elle soigne d'un coup tous les allies dedans.",
          effet: "jugement-absolution",
          teinte: 0xa8ffc8,
        },
      ],
    },
  },
  {
    id: "bouclier-des-ames",
    nom: "Bouclier des ames",
    rang: "SR",
    type: "auto",
    tags: TAGS.SACRE | TAGS.SOIN,
    classes: ["chevalier"],
    description:
      "Des qu'un allie est au plus mal, il lui donne de sa propre vie. Personne ne le lui demande.",
    icone: "cap-bouclier-ames",
    effet: "bouclier-des-ames",
    paliers: [
      { texte: "Partage sa vie avec les allies sous 30%", rechargement: 12000 },
      { texte: "Partage davantage, plus souvent", rechargement: 10000 },
    ],
  },

  // ==================== Guerrier : le reste de la rage ====================
  {
    id: "charge",
    nom: "Charge",
    rang: "D",
    type: "active",
    tags: TAGS.MELEE | TAGS.MOBILITE,
    classes: ["guerrier"],
    description: "Il fonce en ligne droite et renverse tout ce qui se trouve sur son chemin.",
    icone: "cap-charge",
    effet: "charge",
    paliers: [
      { texte: "Charge de 260 pixels", rechargement: 9000 },
      { texte: "Charge plus longue et plus lourde", rechargement: 8000 },
      { texte: "Charge devastatrice", rechargement: 7000 },
    ],
    evolutions: {
      auPalier: 2,
      options: [
        {
          id: "charge-sismique",
          tags: TAGS.ZONE | TAGS.SOL,
          nom: "Charge sismique",
          description: "Le sol se fissure a l'arrivee : tout ce qui est autour est souffle.",
          effet: "charge-sismique",
          teinte: 0xc9a06b,
        },
        {
          id: "charge-sanglante",
          tags: TAGS.SANG,
          nom: "Charge sanglante",
          description: "Il traverse, puis revient aussitot sur ses pas en fauchant a nouveau.",
          effet: "charge-sanglante",
          teinte: 0xff8080,
        },
      ],
    },
  },
  {
    id: "cri-de-guerre",
    nom: "Cri de guerre",
    rang: "C",
    type: "active",
    tags: TAGS.RAGE | TAGS.ZONE,
    classes: ["guerrier"],
    description: "Il hurle. Les monstres reculent, et l'equipe entiere se met a frapper plus fort.",
    icone: "cap-cri",
    effet: "cri-de-guerre",
    paliers: [
      { texte: "Repousse tout, +20% de degats a l'equipe pendant 6 s", rechargement: 16000 },
      { texte: "+30% de degats a l'equipe pendant 8 s", rechargement: 14000 },
    ],
  },

  // ===================== Mage : le reste du savoir =====================
  {
    id: "clignement",
    nom: "Clignement",
    rang: "E",
    type: "active",
    tags: TAGS.MAGIE | TAGS.MOBILITE | TAGS.EXPLOSION,
    classes: ["mage"],
    description:
      "Il disparait et reapparait plus loin, en laissant une deflagration a l'endroit qu'il quitte.",
    icone: "cap-clignement",
    effet: "clignement",
    paliers: [
      { texte: "Teleportation courte", rechargement: 7000 },
      { texte: "Portee accrue, explosion plus forte", rechargement: 6000 },
      { texte: "Portee maximale, explosion devastatrice", rechargement: 5000 },
    ],
  },
  {
    id: "sablier",
    nom: "Sablier",
    rang: "A",
    type: "active",
    tags: TAGS.MAGIE | TAGS.ENTRAVE | TAGS.ZONE,
    classes: ["mage"],
    description: "Le temps ralentit dans une large zone — pour les monstres seulement.",
    icone: "cap-sablier",
    effet: "sablier",
    paliers: [
      { texte: "Ralentit de 60% pendant 5 s", rechargement: 24000 },
      { texte: "Ralentit de 75% pendant 7 s", rechargement: 21000 },
    ],
  },
  {
    id: "familier",
    nom: "Familier",
    rang: "S",
    type: "passive",
    tags: TAGS.INVOCATION | TAGS.MAGIE,
    classes: ["mage"],
    description:
      "Une creature liee a lui se bat a ses cotes en permanence, et grandit a chacun de ses niveaux.",
    paliers: [
      { texte: "Un familier permanent", appliquer: (b) => void (b.familier += 1) },
      { texte: "Familier nettement plus puissant", appliquer: (b) => void (b.familier += 1) },
      { texte: "Familier redoutable", appliquer: (b) => void (b.familier += 1) },
    ],
    evolutions: {
      auPalier: 2,
      options: [
        {
          id: "familier-golem",
          tags: TAGS.DEFENSE,
          nom: "Golem",
          description: "Lourd, tres resistant, et il attire sur lui tout ce qui passe a portee.",
          teinte: 0xc9a06b,
          appliquer: (b) => void (b.familierGolem = true),
        },
        {
          id: "familier-spectre",
          tags: TAGS.OMBRE,
          nom: "Spectre",
          description: "Rapide, invisible aux monstres, et il acheve tout ce qui agonise.",
          teinte: 0x9fd8ff,
          appliquer: (b) => void (b.familierSpectre = true),
        },
      ],
    },
  },

  // =================== Assassin : le reste du contrat ===================
  {
    id: "croc-en-jambe",
    nom: "Croc-en-jambe",
    rang: "C",
    type: "active",
    tags: TAGS.LAME | TAGS.SANG | TAGS.SOL | TAGS.ZONE,
    classes: ["assassin"],
    description: "Il seme des lames au sol. Tout ce qui passe dessus saigne longtemps.",
    icone: "cap-croc",
    effet: "croc-en-jambe",
    paliers: [
      { texte: "Zone de lames pendant 6 s", rechargement: 12000 },
      { texte: "Zone plus large, saignement plus fort", rechargement: 11000 },
      { texte: "Zone devastatrice", rechargement: 10000 },
    ],
  },
  {
    id: "doppelganger",
    nom: "Doppelganger",
    rang: "B",
    type: "active",
    tags: TAGS.OMBRE | TAGS.EXPLOSION,
    classes: ["assassin"],
    description:
      "Il laisse un double immobile qui attire toute l'attention, puis explose quand on le detruit.",
    icone: "cap-doppelganger",
    effet: "doppelganger",
    paliers: [
      { texte: "Double provocateur, explose au bout de 5 s", rechargement: 18000 },
      { texte: "Double plus resistant, explosion plus forte", rechargement: 16000 },
    ],
  },
  {
    id: "contrat",
    nom: "Contrat",
    rang: "SSR",
    type: "active",
    tags: TAGS.OMBRE | TAGS.MORT,
    classes: ["assassin"],
    description:
      "Il designe une cible : elle mourra dans dix secondes, quoi qu'il arrive. Mais tant que le contrat court, il ne peut attaquer personne d'autre.",
    icone: "cap-contrat",
    effet: "contrat",
    paliers: [
      { texte: "Mort certaine en 10 s", rechargement: 50000 },
      { texte: "Mort certaine en 7 s", rechargement: 45000 },
    ],
  },

  // ======================= Les fusions (§4.25) =======================
  // Jalon 6.5, morceau 3. Elles ne sortent jamais de la pioche avant d'etre
  // prises : elles se proposent en carte a part quand tous leurs ingredients
  // sont a leur maximum (`fusions.ts`). Elles gardent ce que faisaient leurs
  // ingredients — ceux-ci restent tenus, « fondus », et continuent d'agir — et
  // y ajoutent leur comportement. Chaque palier apres le premier se choisit
  // deux fois (`enDoublePrix`).
  //
  // ⚠️ Rangs, tags et chiffres **tranches par le code**, soumis a Angelos dans
  // le Grimoire (https://claude.ai/artifact/MMgy33ybsQJQGEWQpzj2yV).
  {
    id: "soleil-d-acier",
    nom: "Soleil d'acier",
    rang: "B",
    type: "passive",
    tags: TAGS.LAME | TAGS.FEU | TAGS.ZONE,
    fusion: { ingredients: [{ competence: "epee-tournoyante" }, { competence: "aura-de-flammes" }] },
    description:
      "Les lames chauffent a blanc et leur ronde devient l'aura : tout ce qui entre dans le cercle des epees brule.",
    paliers: enDoublePrix([
      { texte: "Epees incandescentes, l'aura s'etend jusqu'au cercle des epees" },
      { texte: "L'aura brule 50% plus fort" },
      { texte: "Une epee de plus, l'aura brule deux fois plus fort", appliquer: (b) => void (b.epees += 1) },
    ]),
  },
  {
    id: "moulin-a-lames",
    nom: "Moulin a lames",
    rang: "C",
    type: "passive",
    tags: TAGS.LAME | TAGS.PROJECTILE | TAGS.CHAINE,
    fusion: { ingredients: [{ competence: "epee-tournoyante" }, { competence: "ricochet" }] },
    description: "Regulierement, chaque epee quitte sa ronde, rebondit d'ennemi en ennemi, puis revient.",
    paliers: enDoublePrix([
      { texte: "3 rebonds par epee, toutes les 3 s" },
      { texte: "4 rebonds, toutes les 2,5 s" },
      { texte: "5 rebonds, toutes les 2 s" },
    ]),
  },
  {
    id: "reseau-electrique",
    nom: "Reseau electrique",
    rang: "B",
    type: "passive",
    tags: TAGS.FOUDRE | TAGS.CHAINE | TAGS.MAGIE,
    fusion: { ingredients: [{ competence: "chaine-eclairs" }, { competence: "ricochet" }] },
    description:
      "Les eclairs peuvent revenir sur un ennemi deja frappe : dans une foule serree, le courant tourne en boucle.",
    paliers: enDoublePrix([
      { texte: "+2 rebonds, qui peuvent revenir sur une cible deja frappee" },
      { texte: "+3 rebonds, un saut porte plus loin" },
      { texte: "+4 rebonds, qui ne faiblissent plus" },
    ]),
  },
  {
    id: "satellites-conducteurs",
    nom: "Satellites conducteurs",
    rang: "B",
    type: "passive",
    tags: TAGS.FOUDRE | TAGS.CHAINE | TAGS.MAGIE,
    fusion: { ingredients: [{ competence: "satellite" }, { competence: "chaine-eclairs" }] },
    description: "Chaque satellite qui touche un ennemi fait partir un eclair qui saute a ses voisins.",
    paliers: enDoublePrix([
      { texte: "Un eclair par contact, une fois par seconde et par satellite" },
      { texte: "Un satellite de plus", appliquer: (b) => void (b.satellites += 1) },
      { texte: "Eclairs 50% plus forts, deux fois par seconde" },
    ]),
  },
  {
    id: "tourbillon-infernal",
    nom: "Tourbillon infernal",
    rang: "C",
    type: "active",
    tags: TAGS.LAME | TAGS.FEU | TAGS.ZONE | TAGS.MELEE,
    fusion: { ingredients: [{ competence: "moulinet" }, { competence: "aura-de-flammes" }] },
    description:
      "Le moulinet s'embrase : il tourne plus large et plus longtemps, tout ce qu'il frole brule, et il court plus vite pendant.",
    icone: "cap-tourbillon-infernal",
    effet: "tourbillon-infernal",
    paliers: enDoublePrix([
      { texte: "Tourne 4 s, plus large, l'aura brule deux fois plus fort pendant", rechargement: 8000 },
      { texte: "Tourne 5 s", rechargement: 8000 },
      { texte: "Tourne 5 s, plus large encore", rechargement: 7000 },
    ]),
  },
  {
    id: "forteresse-mobile",
    nom: "Forteresse mobile",
    rang: "C",
    type: "active",
    tags: TAGS.MELEE | TAGS.MOBILITE | TAGS.ZONE | TAGS.SOL | TAGS.DEFENSE | TAGS.BOUCLIER,
    fusion: { ingredients: [{ competence: "charge", evolution: "charge-sismique" }, { competence: "dome" }] },
    description:
      "A chaque charge, un dome se dresse la ou il s'arrete. Il tient quelques secondes, ou jusqu'a ce qu'on le brise.",
    icone: "cap-forteresse-mobile",
    effet: "forteresse-mobile",
    paliers: enDoublePrix([
      { texte: "Un dome de 180 PV a l'arrivee, qui tient 6 s", rechargement: 7000 },
      { texte: "Dome de 260 PV, qui tient 8 s", rechargement: 7000 },
      { texte: "Dome de 360 PV, 10 s, le souffle porte plus loin", rechargement: 6000 },
    ]),
  },
  {
    id: "temps-fracture",
    nom: "Temps fracture",
    rang: "A",
    type: "active",
    tags: TAGS.MAGIE | TAGS.ENTRAVE | TAGS.ZONE | TAGS.OMBRE,
    fusion: { ingredients: [{ competence: "sablier" }, { competence: "danse-des-ombres" }] },
    description:
      "Chaque monstre tue dans le ralenti rend du temps au Sablier lui-meme : une bonne vague, et il revient presque aussitot.",
    icone: "cap-temps-fracture",
    effet: "temps-fracture",
    paliers: enDoublePrix([
      { texte: "-1 s au Sablier par mort dans sa zone", rechargement: 21000 },
      { texte: "-1,5 s par mort, zone plus large", rechargement: 21000 },
      { texte: "-2 s par mort, le ralenti dure 9 s", rechargement: 21000 },
    ]),
  },
  {
    id: "general-des-morts",
    nom: "General des morts",
    rang: "S",
    type: "passive",
    tags: TAGS.MORT | TAGS.OMBRE | TAGS.INVOCATION | TAGS.MAGIE,
    fusion: { ingredients: [{ competence: "familier" }, { competence: "armee-des-ombres" }] },
    description:
      "Le familier prend la tete des morts-vivants : ils le suivent, et frappent plus fort autour de lui. Le necromancien ne quitte pas la cite — son armee, si.",
    paliers: enDoublePrix([
      { texte: "Les morts-vivants suivent le familier, +30% de degats pres de lui" },
      { texte: "+50%, et le familier revient deux fois plus vite" },
      { texte: "+80%, et le familier a deux fois plus de vie" },
    ]),
  },
  {
    id: "neant",
    nom: "Neant",
    rang: "SSR",
    type: "active",
    tags: TAGS.MAGIE,
    fusion: { ingredients: [{ competence: "exil" }, { competence: "heure-sombre" }] },
    description:
      "Le monde s'arrete, et toi seul bouges. Quand le temps repart, tout ce qui est hostile est banni. Tu restes ensuite une minute a 1 PV, immobile.",
    icone: "cap-neant",
    effet: "neant",
    paliers: enDoublePrix([
      { texte: "Fige 4,5 s, puis bannit tout", rechargement: 120000 },
      { texte: "Fige 6 s", rechargement: 100000 },
    ]),
  },
  {
    id: "berserker-terminal",
    nom: "Berserker terminal",
    rang: "SSR",
    type: "passive",
    tags: TAGS.RAGE,
    fusion: { ingredients: [{ competence: "apotheose" }, { competence: "fardeau" }] },
    description: "Une puissance enorme — et elle le consume. Chaque aube, il perd 8% de sa vie maximale, pour toujours.",
    paliers: enDoublePrix([
      {
        texte: "+50% de degats, il frappe 25% plus vite",
        appliquer: (b) => {
          b.multiplicateurDegats *= 1.5;
          b.cadence *= 0.8;
        },
      },
      { texte: "+100% de degats", appliquer: (b) => void (b.multiplicateurDegats *= 4 / 3) },
    ]),
  },
  {
    id: "revenant",
    nom: "Revenant",
    rang: "SSR",
    type: "passive",
    tags: TAGS.SANG | TAGS.RAGE | TAGS.MORT,
    fusion: { ingredients: [{ competence: "sang-pour-sang" }, { competence: "resurrection" }] },
    description:
      "Il peut mourir une fois : il se releve a pleine vie, mais avec une sequelle tiree au sort. La Resurrection de l'equipe tient toujours.",
    paliers: enDoublePrix([
      { texte: "Se releve une fois, a pleine vie" },
      { texte: "En se relevant, il souffle tout ce qui l'entoure et reste 5 s invulnerable" },
    ]),
  },
  {
    id: "exil-des-morts",
    nom: "Exil des morts",
    rang: "SSR",
    type: "active",
    tags: TAGS.MAGIE | TAGS.MORT | TAGS.OMBRE | TAGS.INVOCATION,
    fusion: { ingredients: [{ competence: "armee-des-ombres" }, { competence: "exil" }] },
    description:
      "Il bannit tout sans rien payer de sa vie. Mais les bannis reviennent la nuit suivante, en revenants, en plus de la horde.",
    icone: "cap-exil-des-morts",
    effet: "exil-des-morts",
    paliers: enDoublePrix([
      { texte: "Bannit tout, sans y laisser sa vie", rechargement: 120000 },
      { texte: "Recharge plus courte", rechargement: 90000 },
    ]),
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

/**
 * Les ingredients fondus (§4.25) : l'identifiant de chacun, et celui de la
 * fusion qui l'a consomme.
 *
 * ⚠️ **Un ingredient fondu reste tenu, a son maximum.** C'est ce qui fait
 * qu'une fusion « garde ce que les deux faisaient » sans une ligne de plus :
 * ses bonus restent, la sauvegarde le rejoue, ses tags restent dans le build,
 * et il ne ressort jamais de la pioche puisqu'il est au bout de ses paliers.
 * Il perd seulement sa touche et sa capacite : c'est la fusion qui agit.
 */
export type CompetencesFondues = Record<string, string>;

export function competenceParId(id: string): CompetenceDef | undefined {
  return COMPETENCES.find((c) => c.id === id);
}

/**
 * Une competence d'une autre classe sort **cinq fois moins souvent** que chez
 * elle (§4.13, tranche le 23 septembre 2026) — sauf celles qui restent fermees.
 */
export const PART_HORS_DE_SA_CLASSE = 0.2;

/** Est-elle d'une autre classe que celle-ci ? */
export function horsDeSaClasse(competence: CompetenceDef, classe: ClassId): boolean {
  return competence.classes !== undefined && !competence.classes.includes(classe);
}

export function estDisponible(
  competence: CompetenceDef,
  classe: ClassId,
  possedees: CompetencesPossedees,
): boolean {
  // Les competences de classe s'ouvrent aux autres, en rare, sauf les fermees.
  if (horsDeSaClasse(competence, classe) && competence.fermee) return false;
  const prises = possedees[competence.id] ?? 0;
  // Une fusion ne sort jamais de la pioche avant d'etre prise : elle se propose
  // a part (§4.25). Prise, elle revient comme les autres, pour monter.
  if (competence.fusion && prises === 0) return false;
  return prises < competence.paliers.length;
}

/**
 * Les tags d'un build (§4.25) : ceux de chaque competence tenue, plus ceux
 * qu'ajoute son evolution.
 *
 * ⚠️ **Agreges une fois**, quand le heros gagne, fait evoluer ou oublie une
 * competence — jamais a chaque image, exactement comme les traits (§4.23).
 */
export function tagsDuBuild(
  possedees: CompetencesPossedees,
  evolutions: Readonly<Record<string, EvolutionDef>>,
): number {
  let tags = 0;
  for (const id of Object.keys(possedees)) {
    const competence = competenceParId(id);
    if (competence) tags |= competence.tags;
    const evolution = evolutions[id];
    if (evolution?.tags) tags |= evolution.tags;
  }
  return tags;
}

// ------------------------------------------------------- la pioche ponderee

/** « Ce qui porte l'un de ces tags pese tant de fois plus lourd dans la pioche. » */
export interface Penchant {
  masque: number;
  facteur: number;
}

/**
 * Ce qu'une classe voit plus souvent parmi les competences **ouvertes a toutes**
 * (§4.13 : « un Mage voit les bases elementaires beaucoup plus souvent qu'un
 * Guerrier — mais un Guerrier peut les tirer »). Ses propres competences de
 * classe ne sont pas concernees : elles sont deja a elle seule.
 *
 * ⚠️ **Tranche par le code**, a regler en jouant : x2 sur ce qui ressemble a la
 * classe, x3 pour le Mage sur les elements.
 */
export const PENCHANTS_DE_CLASSE: Record<ClassId, readonly Penchant[]> = {
  guerrier: [{ masque: TAGS.LAME | TAGS.RAGE | TAGS.MELEE, facteur: 2 }],
  chevalier: [{ masque: TAGS.SACRE | TAGS.DEFENSE | TAGS.SOIN | TAGS.BOUCLIER, facteur: 2 }],
  mage: [
    { masque: TAGS.MAGIE, facteur: 2 },
    { masque: TAGS.FEU | TAGS.GLACE | TAGS.FOUDRE | TAGS.EAU | TAGS.VENT | TAGS.NATURE, facteur: 3 },
  ],
  assassin: [{ masque: TAGS.OMBRE | TAGS.SANG | TAGS.ESQUIVE, facteur: 2 }],
  rodeur: [{ masque: TAGS.PROJECTILE | TAGS.ENTRAVE | TAGS.NATURE, facteur: 2 }],
  oracle: [{ masque: TAGS.SACRE | TAGS.SOIN, facteur: 2 }],
  necromancien: [{ masque: TAGS.MORT | TAGS.INVOCATION, facteur: 2 }],
};

/**
 * La table du §4.25, « les traits pesent sur ce qu'on te propose ». Un trait
 * ne debloque rien et ne bloque rien : il **pondere** — un ancien pompier
 * devenu pyromane finit mage de feu parce que c'est ce qu'il a vecu.
 *
 * Le x3 du Pyromane est ecrit au design ; les x2 des autres sont **tranches par
 * le code**.
 */
export const PENCHANTS_DES_TRAITS: Partial<Record<CleTrait, readonly Penchant[]>> = {
  pyromane: [{ masque: TAGS.FEU, facteur: 3 }],
  peureux: [{ masque: TAGS.MOBILITE | TAGS.ESQUIVE, facteur: 2 }],
  colerique: [{ masque: TAGS.RAGE | TAGS.LAME, facteur: 2 }],
  boucher: [{ masque: TAGS.RAGE | TAGS.LAME, facteur: 2 }],
  hante: [{ masque: TAGS.OMBRE | TAGS.MORT, facteur: 2 }],
  marque: [{ masque: TAGS.OMBRE | TAGS.MORT, facteur: 2 }],
  devot: [{ masque: TAGS.SACRE | TAGS.SOIN, facteur: 2 }],
  pieux: [{ masque: TAGS.SACRE | TAGS.SOIN, facteur: 2 }],
  veteran: [{ masque: TAGS.DEFENSE, facteur: 2 }],
  endurci: [{ masque: TAGS.DEFENSE, facteur: 2 }],
};

/**
 * Ce que la classe et les traits font peser sur une competence (§4.25).
 *
 * Un penchant qui touche la competence la multiplie par son facteur. Deux
 * penchants **identiques** ne s'empilent pas — Colerique et Boucher disent la
 * meme chose, un heros qui porte les deux ne voit pas la LAME quatre fois plus ;
 * deux penchants **differents** se multiplient — un Pyromane colerique voit une
 * lame de feu six fois plus.
 */
export function penchantPour(
  competence: CompetenceDef,
  classe: ClassId,
  traits: readonly CleTrait[] = [],
): number {
  const retenus: Penchant[] = [];
  const retenir = (penchants: readonly Penchant[] | undefined) => {
    for (const p of penchants ?? []) {
      if ((p.masque & competence.tags) === 0) continue;
      const deja = retenus.find((r) => r.masque === p.masque);
      if (!deja) retenus.push({ ...p });
      else if (p.facteur > deja.facteur) deja.facteur = p.facteur;
    }
  };
  // La classe : seulement sur ce qui est ouvert a toutes, et son meilleur penchant.
  if (!competence.classes) {
    let meilleur = 1;
    for (const p of PENCHANTS_DE_CLASSE[classe]) {
      if ((p.masque & competence.tags) !== 0 && p.facteur > meilleur) meilleur = p.facteur;
    }
    if (meilleur > 1) retenus.push({ masque: -1, facteur: meilleur });
  }
  for (const trait of traits) retenir(PENCHANTS_DES_TRAITS[trait]);
  // Chez une autre classe, elle sort cinq fois moins souvent (§4.13).
  let poids = horsDeSaClasse(competence, classe) ? PART_HORS_DE_SA_CLASSE : 1;
  for (const r of retenus) poids *= r.facteur;
  return poids;
}

export function tirerCompetences(
  rng: SourceAleatoire,
  classe: ClassId,
  possedees: CompetencesPossedees,
  nombre = 3,
  faveur = 0,
  traits: readonly CleTrait[] = [],
): CompetenceDef[] {
  const restantes = COMPETENCES.filter((c) => estDisponible(c, classe, possedees));
  const tirees: CompetenceDef[] = [];

  while (tirees.length < nombre && restantes.length > 0) {
    const poids = restantes.map((c) => poidsDe(c.rang, faveur) * penchantPour(c, classe, traits));
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

// ------------------------------------------------------------ la penetration

/**
 * Combien de monstres chaque attaque qui traverse touche avant de s'arreter
 * (§4.25, la penetration — decision d'Angelos du 22 septembre 2026).
 *
 * Contre soixante monstres, un trait qui traversait tout ne coutait rien ;
 * contre des milliers, un trait de deux mille pixels en toucherait des
 * centaines. La penetration borne ca, et elle monte avec le build.
 *
 * ⚠️ **Tranche par le code**, a regler en jouant : aucun de ces chiffres n'a
 * ete soumis.
 */
export const PENETRATION = {
  /** Le tir des classes a distance : il s'arrete au premier monstre. */
  projectile: 1,
  /** La Charge renverse les premiers de la file, pas la file entiere. */
  charge: (palier: number) => 6 + palier * 2,
  /** La Fleche du Jugement traverse l'ecran, pas une horde entiere. */
  flecheDuJugement: (palier: number) => 20 + palier * 10,
  /** L'Ombre, l'ultime de l'assassin. */
  ombre: 12,
} as const;

/** La penetration d'une attaque : sa base, plus ce que le build y ajoute (§4.25). */
export function penetrationDe(base: number, bonus: Bonus, projectile: boolean): number {
  return base + bonus.penetration + (projectile ? bonus.penetrationProjectiles : 0);
}

// --------------------------------------------------- affichage (sans Phaser)

/** Ce que l'interface a besoin de savoir pour dessiner une carte de choix. */
export interface Proposition {
  id: string;
  nom: string;
  description: string;
  etiquette: string;
  couleur: number;
  /** Ses tags, en clair (« FEU  ·  ZONE ») : absent quand la carte n'est pas une competence */
  tags?: string;
  /**
   * Une carte de fusion (§4.25) : ce qu'elle consomme, en clair
   * (« Epee tournoyante 5 + Aura de flammes 3 »). La carte le montre a part :
   * c'est le prix du choix.
   */
  fusionne?: string;
}

// ------------------------------------------------- les emplacements d'actives

/**
 * Quatre competences actives au maximum (§4.1, §4.13, tranche le 9 septembre
 * 2026) — une limite de clavier autant que de lisibilite : les touches 2 a 5.
 * Angelos a precise le 19 septembre : quand c'est plein, on **achete un
 * emplacement** de plus, on **fusionne** deux competences (§4.25, avec les
 * builds), ou on **remplace** une des quatre. Les automatiques ne comptent pas :
 * elles ne prennent pas de touche.
 */
export const EMPLACEMENTS_ACTIFS = 4;

/**
 * Au plus deux emplacements **achetes** : quatre, plus deux. Le trait
 * Touche-a-tout (§4.23) en donne jusqu'a trois autres, gratuits, qui passent
 * avant l'achat : un heros tient donc neuf actives au plus, touches 2 a 0.
 */
export const EMPLACEMENTS_ACTIFS_MAX = 6;

/** La touche d'une active selon son rang, 1 etant l'ultime : 2 a 9, puis 0. */
export function toucheDeLActive(rang: number): string {
  return rang === 10 ? "0" : String(rang);
}

/** Le prix du cinquieme emplacement, puis du sixieme, en pieces (§4.8). */
export const PRIX_DES_EMPLACEMENTS = [150, 400];

/** L'identifiant de la carte « un emplacement de plus » sur l'ecran de remplacement. */
export const ID_EMPLACEMENT = "emplacement";

/**
 * Ses competences dans l'ordre ou il les tient — celui des touches — sans les
 * ingredients fondus.
 *
 * Une fusion **reprend la place de son premier ingredient qui avait une
 * touche** : le Moulinet devenu Tourbillon infernal reste sur la touche 3, il
 * ne file pas en derniere position (§4.25). Une fusion de passives prend sa
 * place d'apprentissage.
 */
export function ordreDesCompetences(
  possedees: CompetencesPossedees,
  fondues: Readonly<CompetencesFondues> = {},
): string[] {
  const ordre: string[] = [];
  const placees = new Set<string>();
  for (const id of Object.keys(possedees)) {
    const fusion = fondues[id];
    if (fusion !== undefined) {
      const avaitUneTouche = competenceParId(id)?.type === "active";
      if (avaitUneTouche && !placees.has(fusion) && (possedees[fusion] ?? 0) > 0) {
        ordre.push(fusion);
        placees.add(fusion);
      }
      continue;
    }
    if (placees.has(id)) continue;
    ordre.push(id);
    placees.add(id);
  }
  return ordre;
}

/** Les actives possedees, dans l'ordre des touches, sans les ingredients fondus. */
export function activesPossedees(
  possedees: CompetencesPossedees,
  fondues: Readonly<CompetencesFondues> = {},
): CompetenceDef[] {
  return ordreDesCompetences(possedees, fondues)
    .map((id) => competenceParId(id))
    .filter((c): c is CompetenceDef => c !== undefined && c.type === "active");
}

/** Combien de ses ingredients avaient une touche. */
function ingredientsActifs(fusion: CompetenceDef): number {
  return (fusion.fusion?.ingredients ?? []).filter((i) => competenceParId(i.competence)?.type === "active").length;
}

/**
 * Combien de touches une fusion libere : ses ingredients actifs, moins la
 * sienne si elle en prend une. La Forteresse mobile (Charge et Dome, une seule
 * touche) en libere une ; le Tourbillon infernal (Moulinet et Aura) aucune.
 */
export function touchesLiberees(fusion: CompetenceDef): number {
  return ingredientsActifs(fusion) - (fusion.type === "active" ? 1 : 0);
}

/**
 * Une competence neuve qui demanderait un emplacement de plus qu'on n'en a.
 *
 * @param emplacements tous ceux qu'il a : quatre, ceux du trait, ceux achetes
 */
export function demandeUnePlace(
  competence: CompetenceDef,
  possedees: CompetencesPossedees,
  emplacements: number,
  fondues: Readonly<CompetencesFondues> = {},
): boolean {
  if (competence.type !== "active") return false;
  if ((possedees[competence.id] ?? 0) > 0) return false;
  // Une fusion active reprend la touche d'un ingredient : elle ne demande une
  // place que si aucun n'en avait.
  if (competence.fusion && touchesLiberees(competence) >= 0) return false;
  return activesPossedees(possedees, fondues).length >= emplacements;
}

/** Le prix de l'emplacement suivant, ou null quand on est au maximum. */
export function prixDuProchainEmplacement(emplacements: number): number | null {
  if (emplacements >= EMPLACEMENTS_ACTIFS_MAX) return null;
  return PRIX_DES_EMPLACEMENTS[emplacements - EMPLACEMENTS_ACTIFS] ?? null;
}

/**
 * Les cartes de l'ecran « laquelle oublier ? » : les actives tenues, les
 * fusions qui liberent une touche (§4.25), puis l'emplacement a acheter quand
 * on a de quoi. Oublier perd les paliers.
 *
 * @param emplacements quatre, plus ceux qu'il a achetes — c'est ce qui fixe le prix
 * @param enPlus ceux que lui donne son trait (Touche-a-tout), gratuits
 * @param fusions les cartes des fusions possibles qui liberent une touche
 */
export function propositionsDeRemplacement(
  possedees: CompetencesPossedees,
  emplacements: number,
  argent: number,
  enPlus = 0,
  fondues: Readonly<CompetencesFondues> = {},
  fusions: Proposition[] = [],
): Proposition[] {
  const cartes: Proposition[] = activesPossedees(possedees, fondues).map((c) => ({
    id: c.id,
    nom: `${c.nom} ${palierAtteint(c, possedees[c.id] ?? 1)}`,
    description: `Oubliee, paliers perdus. ${c.description}`,
    etiquette: `${c.rang}  ·  OUBLIER`,
    couleur: COULEURS_RANG[c.rang],
    tags: texteDesTags(c.tags),
  }));
  cartes.push(...fusions);
  const prix = prixDuProchainEmplacement(emplacements);
  if (prix !== null && argent >= prix) {
    cartes.push({
      id: ID_EMPLACEMENT,
      nom: "Un emplacement de plus",
      description: `${prix} pieces. Rien n'est oublie : la nouvelle s'ajoute, touche ${toucheDeLActive(emplacements + enPlus + 2)}.`,
      etiquette: "PIECES  ·  ACHETER",
      couleur: COULEURS_RANG.SSR,
    });
  }
  return cartes;
}

export function propositionCompetence(
  competence: CompetenceDef,
  possedees: CompetencesPossedees,
): Proposition {
  const palierActuel = possedees[competence.id] ?? 0;
  const palier = competence.paliers[palierActuel];
  const nouvelle = palierActuel === 0;
  // Le palier vise, et ou on en est : une fusion se choisit deux fois par
  // palier (§4.25), et la carte dit laquelle des deux fois c'est.
  const vise = palierAtteint(competence, palierActuel) + 1;
  const description = nouvelle
    ? competence.description
    : palier?.demi
      ? `1 sur 2 : a reprendre une fois pour gagner ce palier. ${palier.texte}`
      : competence.paliers[palierActuel - 1]?.demi
        ? `2 sur 2. ${palier?.texte ?? ""}`
        : (palier?.texte ?? "");

  return {
    id: competence.id,
    nom: nouvelle ? competence.nom : `${competence.nom} ${vise}`,
    description,
    etiquette: `${competence.rang}  ·  ${etiquetteType(competence.type)}`,
    couleur: COULEURS_RANG[competence.rang],
    tags: texteDesTags(competence.tags),
  };
}

export function propositionEvolution(competence: CompetenceDef, evolution: EvolutionDef): Proposition {
  return {
    id: evolution.id,
    nom: evolution.nom,
    description: evolution.description,
    etiquette: `EVOLUTION  ·  ${competence.nom}`,
    couleur: evolution.teinte ?? COULEURS_RANG[competence.rang],
    tags: texteDesTags(competence.tags | (evolution.tags ?? 0)),
  };
}

function etiquetteType(type: TypeCompetence): string {
  if (type === "active") return "ACTIVE";
  if (type === "auto") return "AUTOMATIQUE";
  return "PASSIVE";
}
