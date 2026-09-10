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
