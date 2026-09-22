/**
 * Les archetypes de monstres.
 *
 * Jusqu'ici il n'existait qu'un seul ennemi, pilote par un scalaire
 * `puissance` : tous identiques, tous plus durs a mesure que le temps passe.
 * Un archetype **module** cette montee en puissance, il ne la remplace pas —
 * les statistiques restent calculees depuis `puissance`, puis multipliees.
 *
 * Chaque archetype a **sa propre silhouette**, dessinee par le code et cuite au
 * demarrage (`dessin/monstres.ts`) : plus de teinte ni d'echelle pour les
 * distinguer. Le champ `texture` nomme sa famille de planche.
 *
 * Ce fichier ne connait ni Phaser ni la scene : c'est une table de donnees, et
 * `choisirArchetype` est une fonction pure — donc testable (`ennemis.test.ts`).
 */

import { REGLAGES_BUTIN } from "../core/butin";
import { C } from "./ui/couleurs";

/**
 * Ce que le monstre fait de son corps.
 *
 * - `fonceur` : il court dessus et frappe au contact ;
 * - `brute` : pareil, mais lourd, lent, et son armement se voit de loin ;
 * - `essaim` : petit, rapide, frappe souvent, meurt vite ;
 * - `cracheur` : il s'arrete a distance et tire ;
 * - `kamikaze` : il colle a sa cible et explose.
 */
export type Comportement = "fonceur" | "brute" | "essaim" | "cracheur" | "kamikaze";

export interface Archetype {
  id: string;
  nom: string;
  /** Cle de texture : un sprite deja livre, ou celui d'un futur pack */
  texture: string;
  /** Teinte appliquee au sprite ; `BLANC` pour le laisser tel quel */
  teinte: number;
  /** Multiplie l'echelle des personnages ; recale la hitbox avec elle */
  echelle: number;
  multPv: number;
  multVitesse: number;
  multDegats: number;
  comportement: Comportement;
  /** Teinte des particules d'impact et du pouf de mort */
  couleurImpact: number;
  /** Duree du telegraphe, en millisecondes : le temps qu'on a pour s'ecarter */
  armement: number;
  /** Delai entre la frappe et l'armement suivant, en millisecondes */
  recuperation: number;
  /**
   * Distance a laquelle il engage, en pixels. Au corps a corps elle est courte
   * — c'est elle qui decide si un coup arme dans le vide ou touche vraiment.
   */
  portee: number;
  /** Experience laissee en mourant */
  xp: number;
  /** Puissance de vague a partir de laquelle il peut apparaitre */
  seuil: number;
  /** Poids de tirage une fois le seuil franchi */
  poids: number;
}

/** Pas de teinte : le sprite garde ses couleurs d'origine. */
const BLANC = 0xffffff;

/**
 * Note sur les teintes : **il n'y en a plus.**
 *
 * Les sprites sont dessines dans la palette du monde (§4.30) ; une teinte les
 * en sortirait. Ce qui distingue les archetypes est leur silhouette, et les
 * couleurs d'impact ci-dessous sont les seules qui restent — celles des
 * particules, prises dans les neuf couleurs : le sang frais de ce qui blesse,
 * l'os de ce qui est mort, la bile de ce qui crache.
 */
const IMPACT = {
  sang: 0xe0402a,
  os: 0xd9c9b0,
  bile: 0x7f9440,
  laiton: 0xc99a3a,
} as const;

/**
 * Portee de frappe au corps a corps.
 *
 * Volontairement un peu plus courte que la distance a laquelle le contact se
 * declenche : un coup arme peut donc **partir dans le vide** si sa cible s'est
 * ecartee entre-temps. C'est tout l'interet du telegraphe — sans ce trou, le
 * voir venir ne servirait a rien.
 */
const CORPS_A_CORPS = 36;

export const ARCHETYPES: Archetype[] = [
  {
    id: "fonceur",
    nom: "Rodeur",
    texture: "monstre-fonceur",
    teinte: BLANC,
    echelle: 1,
    multPv: 1,
    multVitesse: 1,
    multDegats: 1,
    comportement: "fonceur",
    couleurImpact: IMPACT.sang,
    armement: 240,
    recuperation: 700,
    portee: CORPS_A_CORPS,
    xp: 1,
    seuil: 0,
    poids: 10,
  },
  {
    id: "essaim",
    nom: "Nuee",
    texture: "monstre-essaim",
    teinte: BLANC,
    echelle: 0.8,
    multPv: 0.55,
    multVitesse: 1.35,
    multDegats: 0.6,
    comportement: "essaim",
    couleurImpact: IMPACT.os,
    // Petit et nerveux : il arme a peine, mais il ne fait pas mal.
    armement: 150,
    recuperation: 420,
    portee: CORPS_A_CORPS,
    xp: 1,
    seuil: 0.8,
    poids: 5,
  },
  {
    id: "revenant",
    nom: "Revenant",
    texture: "monstre-revenant",
    teinte: BLANC,
    echelle: 1.05,
    multPv: 1.8,
    multVitesse: 0.72,
    multDegats: 1.1,
    comportement: "fonceur",
    couleurImpact: IMPACT.os,
    armement: 320,
    recuperation: 820,
    portee: CORPS_A_CORPS,
    xp: 2,
    seuil: 1.5,
    poids: 3,
  },
  {
    id: "cracheur",
    nom: "Cracheur",
    texture: "monstre-cracheur",
    teinte: BLANC,
    echelle: 0.95,
    multPv: 0.8,
    multVitesse: 0.85,
    multDegats: 0.85,
    comportement: "cracheur",
    couleurImpact: IMPACT.bile,
    // Le tir se voit venir de loin : c'est ce qui laisse le temps de charger.
    armement: 480,
    recuperation: 1500,
    portee: 260,
    xp: 2,
    seuil: 2.2,
    poids: 3,
  },
  {
    id: "brute",
    nom: "Brute",
    texture: "monstre-brute",
    teinte: BLANC,
    echelle: 1.4,
    multPv: 3,
    multVitesse: 0.62,
    multDegats: 2.1,
    comportement: "brute",
    couleurImpact: IMPACT.sang,
    // Le coup le plus telegraphe du jeu : lourd, lent, et evitable.
    armement: 620,
    recuperation: 1100,
    portee: 52,
    xp: 4,
    seuil: 3,
    poids: 2,
  },
  {
    id: "kamikaze",
    nom: "Fielleux",
    texture: "monstre-kamikaze",
    teinte: BLANC,
    echelle: 0.9,
    multPv: 0.7,
    multVitesse: 1.25,
    multDegats: 1.6,
    comportement: "kamikaze",
    couleurImpact: IMPACT.laiton,
    armement: 520,
    recuperation: 900,
    // Il se colle a sa cible avant de s'ouvrir : il doit arriver au contact.
    portee: 44,
    xp: 2,
    seuil: 4,
    poids: 2,
  },
];

/** Celui qu'on prend quand personne n'a rien demande. */
export const ARCHETYPE_DEFAUT: Archetype = ARCHETYPES[0]!;

/**
 * Les betes d'eau (DESIGN.md §4.21, la nuit de crue — 22 septembre 2026).
 *
 * ⚠️ **Elles ne sont pas dans `ARCHETYPES`, et c'est volontaire** : cette table
 * est celle des vagues ordinaires, et elle est tiree au sort. Une bete d'eau
 * n'apparait **jamais** dans une horde normale — elle n'existe que la nuit qui
 * suit trois journees de pluie, et elle sort **de l'eau**, pas d'un front. Meme
 * raison qu'`ARCHETYPE_HUMAIN` : un archetype qui ne se tire pas n'a rien a
 * faire dans la table qu'on tire.
 *
 * Les deux ne font pas le meme metier, et leurs chiffres le disent :
 *
 * - l'**ecumeur** est le plus rapide du jeu et frappe plus fort qu'un rodeur,
 *   mais il tient moins qu'une nuee : il traverse, il tape, il tombe ;
 * - l'**engloutisseur** est le plus lent, il encaisse comme une brute et son
 *   coup est le plus telegraphe de tous — on a le temps de s'ecarter, mais pas
 *   celui de le tuer.
 *
 * Aucun des deux ne porte de comportement neuf : ils reutilisent ceux qui
 * existent. Un comportement de plus, c'est une IA de plus a regler, et le §4.17
 * en a assez.
 */
export const ARCHETYPES_DEAU: Archetype[] = [
  {
    id: "ecumeur",
    nom: "Ecumeur",
    texture: "monstre-ecumeur",
    teinte: BLANC,
    echelle: 1,
    multPv: 0.6,
    multVitesse: 1.5,
    multDegats: 1.4,
    comportement: "fonceur",
    couleurImpact: IMPACT.os,
    armement: 220,
    recuperation: 600,
    portee: CORPS_A_CORPS,
    xp: 2,
    // ⚠️ `seuil` et `poids` ne servent a rien ici — ils ne sont lus que par le
    // tirage des vagues, qui ne verra jamais ces deux-la. Ils sont poses a zero
    // pour que ca se voie.
    seuil: 0,
    poids: 0,
  },
  {
    id: "engloutisseur",
    nom: "Engloutisseur",
    texture: "monstre-engloutisseur",
    teinte: BLANC,
    echelle: 1.35,
    multPv: 3.4,
    multVitesse: 0.5,
    multDegats: 2.2,
    comportement: "brute",
    couleurImpact: IMPACT.sang,
    armement: 700,
    recuperation: 1200,
    portee: 52,
    xp: 5,
    seuil: 0,
    poids: 0,
  },
];

/**
 * Celle qui sort de l'eau cette fois-ci.
 *
 * Deux sur trois sont des ecumeurs : c'est le nombre qui doit faire peur, et un
 * mur d'engloutisseurs serait impossible a tenir autant qu'ennuyeux a jouer.
 */
export function beteDEau(tirage: number): Archetype {
  return tirage < 0.66 ? ARCHETYPES_DEAU[0]! : ARCHETYPES_DEAU[1]!;
}

/**
 * L'habitant qui se jette sur nous (DESIGN.md §4.29, 20 septembre 2026 au soir).
 *
 * ⚠️ **Il n'est pas dans `ARCHETYPES`, et c'est volontaire** : cette table est
 * celle des vagues, et elle est tiree au sort. Un villageois enrage n'apparait
 * jamais dans une horde — il n'existe que le jour ou on refuse un village en
 * face. Il n'a pas non plus de planche a lui : il porte **le visage de celui
 * qu'il etait**, c'est-a-dire la planche de son metier (`Ennemi` accepte une
 * apparence).
 *
 * Ses chiffres disent ce qu'il est : un civil arme de son outil. Il frappe plus
 * lentement et moins fort qu'un rodeur, il tient a peine plus, et il court a peu
 * pres aussi vite. Ce qui fait peur, c'est qu'ils viennent **tous ensemble**.
 */
export const ARCHETYPE_HUMAIN: Archetype = {
  id: "humain",
  nom: "Habitant",
  texture: "villageois",
  teinte: BLANC,
  echelle: 1,
  multPv: 1.1,
  multVitesse: 0.95,
  multDegats: 0.8,
  comportement: "fonceur",
  couleurImpact: IMPACT.sang,
  // Un homme qui leve sa hache se voit venir de loin : le telegraphe le plus
  // long du jeu. On peut s'ecarter — c'est ce qui rend le nombre supportable.
  armement: 380,
  recuperation: 900,
  portee: CORPS_A_CORPS,
  xp: REGLAGES_BUTIN.xpDUnHumain,
  // Jamais tire : il ne vient pas d'une vague.
  seuil: Infinity,
  poids: 0,
};

export function archetypeParId(id: string): Archetype | undefined {
  return ARCHETYPES.find((a) => a.id === id);
}

/**
 * Tire un archetype pour une vague donnee.
 *
 * Les archetypes durs sont **verrouilles** derriere un seuil de puissance : les
 * premieres minutes n'envoient que des fonceurs, puis la nuee, puis le reste.
 * Le fonceur garde le plus gros poids partout — c'est le fond de la vague, les
 * autres en sont l'assaisonnement.
 *
 * @param puissance la meme que celle qui calcule les statistiques
 * @param tirage un aleatoire dans [0,1) ; injecte pour rester pur et testable
 */
export function choisirArchetype(puissance: number, tirage: number): Archetype {
  const ouverts = ARCHETYPES.filter((a) => puissance >= a.seuil);
  const total = ouverts.reduce((somme, a) => somme + a.poids, 0);

  let curseur = Math.min(Math.max(tirage, 0), 0.999_999) * total;
  for (const archetype of ouverts) {
    curseur -= archetype.poids;
    if (curseur < 0) return archetype;
  }
  return ARCHETYPE_DEFAUT;
}

// ------------------------------------------------------------ la nuee (§4.33)

/**
 * Qui entre dans la nuee (DESIGN.md §4.33, palier 2) : les six archetypes des
 * vagues, dessines en orcs, en une passe.
 *
 * ⚠️ **Ce qui reste un sprite a part, et pourquoi** : l'humain enrage (§4.29) a
 * le visage et le nom d'un habitant qu'on a refuse — c'est tout son sens ; les
 * betes d'eau (§4.21) ne sortent qu'une nuit de crue, et leur silhouette dit
 * d'ou elles viennent. Elles sont rares : les garder a part ne coute rien au
 * rendu, et ce sont deux silhouettes validees exprès, le jour meme.
 */
export function estDeLaNuee(archetype: Archetype, humain: boolean): boolean {
  return !humain && ARCHETYPES.some((a) => a.id === archetype.id);
}

/**
 * La teinte d'un orc de la nuee : ce qu'il **fait**, pas ce qu'il est (§4.33).
 *
 * Tranche sur planches par Angelos le 22 septembre 2026 : la bile pour
 * l'ordinaire (le fonceur, l'essaim, le revenant, la brute), le laiton pour le
 * cracheur, le ciel sale pour le kamikaze. Pas d'orange : il se confondrait avec
 * le rouge du coup encaisse, qui est le seul rouge de la horde.
 */
export function teinteDeNuee(archetype: Archetype): number {
  if (archetype.comportement === "cracheur") return C.laiton;
  if (archetype.comportement === "kamikaze") return C.cielSale;
  return C.bile;
}
