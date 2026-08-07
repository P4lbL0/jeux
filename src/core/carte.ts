/**
 * La carte du village (DESIGN.md §4.6).
 *
 * Le village est adosse a la **mer** a l'ouest et a la **montagne** au sud. Ces
 * deux bords sont infranchissables : les monstres ne peuvent donc arriver que
 * du **nord** ou de l'**est**.
 *
 * Ce n'est pas du decor. C'est la regle qui structure tout le combat :
 *
 * - elle donne un sens aux defenses, qui cessent d'etre un encerclement ;
 * - elle rend les ordres du jalon 4 necessaires — deux fronts, un seul heros
 *   incarne, il faut deleguer ;
 * - elle ancre les ressources dans le terrain : on recolte a un endroit, et cet
 *   endroit se defend.
 *
 * Ce fichier ne connait pas Phaser : la geometrie et le calendrier des fronts
 * se testent sans lancer le moteur.
 */

export interface Point {
  x: number;
  y: number;
}

export interface Rectangle {
  x: number;
  y: number;
  largeur: number;
  hauteur: number;
}

export const MONDE = { largeur: 1600, hauteur: 1200 };

/** Position moyenne de chaque limite de terrain, en pixels */
export const TERRAIN = {
  /** Ligne d'eau moyenne, a l'ouest */
  mer: 250,
  /** Largeur moyenne de la plage : c'est le poste du pecheur */
  plage: 62,
  /** Lisiere moyenne de la foret, au sud : c'est le poste du bucheron */
  foret: 850,
  /** Pied moyen de la montagne, au sud */
  montagne: 960,
};

/**
 * De combien chaque limite serpente autour de sa position moyenne.
 *
 * Une cote droite se lit comme un mur d'editeur de niveau. Un littoral qui
 * ondule se lit comme un lieu (DESIGN.md §4.11, reference WorldBox).
 */
export const AMPLITUDE = { cote: 34, plage: 18, foret: 30, montagne: 26 };

/**
 * Ondulation lisse et deterministe.
 *
 * Trois sinus de periodes incommensurables : le motif ne se repete jamais a
 * l'oeil, et pourtant la fonction est pure — la carte est la meme a chaque
 * partie, donc on peut apprendre son terrain.
 *
 * @returns une valeur dans [-amplitude, amplitude]
 */
export function ondulation(t: number, echelle: number, amplitude: number): number {
  return (
    (Math.sin(t / echelle) * 0.5 +
      Math.sin(t / (echelle * 0.37) + 1.7) * 0.3 +
      Math.sin(t / (echelle * 0.17) + 4.1) * 0.2) *
    amplitude
  );
}

/** La ligne d'eau a une hauteur donnee. */
export function ligneDEau(y: number): number {
  return TERRAIN.mer + ondulation(y, 130, AMPLITUDE.cote);
}

/** La limite entre le sable et l'herbe. */
export function ligneDeSable(y: number): number {
  return ligneDEau(y) + TERRAIN.plage + ondulation(y + 480, 88, AMPLITUDE.plage);
}

/** La lisiere de la foret a une abscisse donnee. */
export function ligneDeForet(x: number): number {
  return TERRAIN.foret + ondulation(x + 910, 118, AMPLITUDE.foret);
}

/** Le pied de la montagne a une abscisse donnee. */
export function ligneDeMontagne(x: number): number {
  return TERRAIN.montagne + ondulation(x, 152, AMPLITUDE.montagne);
}

/**
 * Le rectangle ou l'on peut marcher.
 *
 * Il se tient en deca du point le plus **avance** de chaque limite qui
 * ondule : c'est ce qui garantit qu'aucun pas praticable ne tombe dans l'eau
 * ni dans la roche, sans avoir a gerer une collision au pixel pres.
 */
const MARGE_LIMITE = 8;
const BAS_PRATICABLE = TERRAIN.montagne - AMPLITUDE.montagne - MARGE_LIMITE;
const GAUCHE_PRATICABLE = TERRAIN.mer + AMPLITUDE.cote + MARGE_LIMITE;

export const PRATICABLE: Rectangle = {
  x: GAUCHE_PRATICABLE,
  y: 16,
  largeur: MONDE.largeur - 16 - GAUCHE_PRATICABLE,
  hauteur: BAS_PRATICABLE - 16,
};

/** Les natures de sol de la carte, du large jusqu'au sommet. */
export type Terrain =
  | "abysse"
  | "mer"
  | "haut-fond"
  | "sable"
  | "herbe"
  | "sous-bois"
  | "eboulis"
  | "roche";

/**
 * La nature du sol en un point.
 *
 * L'eau est testee avant la roche : la montagne descend donc jusqu'au rivage
 * et s'y arrete, au lieu de couper le littoral en deux.
 */
export function terrainEn(x: number, y: number): Terrain {
  const eau = ligneDEau(y);
  if (x < eau - 104) return "abysse";
  if (x < eau - 38) return "mer";
  if (x < eau) return "haut-fond";

  const montagne = ligneDeMontagne(x);
  if (y > montagne + 44) return "roche";
  if (y > montagne) return "eboulis";

  if (x < ligneDeSable(y)) return "sable";
  if (y > ligneDeForet(x)) return "sous-bois";
  return "herbe";
}

/** Vrai si le sol porte : ni eau, ni roche. */
export function estTerreFerme(x: number, y: number): boolean {
  const sol = terrainEn(x, y);
  return sol === "sable" || sol === "herbe" || sol === "sous-bois";
}

/**
 * Le village, blotti dans l'angle sud-ouest, dos a la mer et a la montagne.
 * Toujours un cercle : c'est la forme que tout le code de refuge attend, et
 * l'angle protege deja ses deux flancs sans qu'on ait besoin de murs.
 */
export const VILLAGE = { x: 470, y: 770, rayon: 150 };

export type Front = "nord" | "est";

export const NOMS_FRONT: Record<Front, string> = { nord: "au NORD", est: "a l'EST" };

/** Les postes de travail des habitants (DESIGN.md §4.18). */
export interface PosteTravail {
  id: string;
  nom: string;
  metier: "pecheur" | "bucheron" | "mineur";
  position: Point;
}

export const POSTES: PosteTravail[] = [
  // Sur la plage, au nord du village : le plus expose au front nord.
  { id: "plage", nom: "La plage", metier: "pecheur", position: { x: 295, y: 470 } },
  // Au pied de la montagne : le mieux abrite des deux fronts.
  { id: "mine", nom: "La mine", metier: "mineur", position: { x: 760, y: 915 } },
  // A la lisiere est de la foret : le plus expose au front est.
  { id: "foret", nom: "La foret", metier: "bucheron", position: { x: 1180, y: 905 } },
];

// --------------------------------------------------------------- geometrie

export function estPraticable(x: number, y: number): boolean {
  return (
    x >= PRATICABLE.x &&
    x <= PRATICABLE.x + PRATICABLE.largeur &&
    y >= PRATICABLE.y &&
    y <= PRATICABLE.y + PRATICABLE.hauteur
  );
}

export function dansLeVillage(x: number, y: number): boolean {
  return Math.hypot(x - VILLAGE.x, y - VILLAGE.y) <= VILLAGE.rayon;
}

// ------------------------------------------------------------------ fronts

/**
 * Les fronts ouverts a une vague donnee (DESIGN.md §4.6).
 *
 * Ouvrir un flanc est un levier de difficulte a part entiere, et le meilleur
 * des trois : il ne change aucun chiffre, il change **ou il faut etre**. Le
 * §4.17 interdit de faire monter la difficulte par le nombre — celui-ci fait
 * exactement l'inverse d'un ajout d'ennemis.
 *
 * @param tirage aleatoire dans [0,1), pour la periode ou un seul front s'ouvre
 */
export function frontsDeLaVague(vague: number, tirage: number): Front[] {
  if (vague <= 4) return ["nord"];
  if (vague <= 9) return [tirage < 0.5 ? "nord" : "est"];
  return ["nord", "est"];
}

/**
 * Repartition des ennemis entre les fronts ouverts.
 *
 * Deux fronts egaux se defendent en se placant au milieu ; deux fronts
 * desequilibres obligent a choisir lequel on sacrifie. C'est la seule version
 * qui produit une decision.
 *
 * @param tirage aleatoire dans [0,1)
 * @returns la part du premier front, entre 0,25 et 0,75
 */
export function repartition(fronts: Front[], tirage: number): number {
  if (fronts.length < 2) return 1;
  return 0.25 + tirage * 0.5;
}

/**
 * Ou un ennemi apparait sur un front donne.
 *
 * Il surgit au bord de la carte, jamais au milieu : le joueur doit pouvoir
 * regarder dans une direction et savoir ce qui arrive.
 *
 * @param tirage aleatoire dans [0,1), la position le long du bord
 */
export function pointDApparition(front: Front, tirage: number): Point {
  const marge = 24;
  if (front === "nord") {
    return {
      x: PRATICABLE.x + marge + tirage * (PRATICABLE.largeur - marge * 2),
      y: PRATICABLE.y + marge,
    };
  }
  return {
    x: PRATICABLE.x + PRATICABLE.largeur - marge,
    y: PRATICABLE.y + marge + tirage * (PRATICABLE.hauteur - marge * 2),
  };
}
