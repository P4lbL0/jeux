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

/** Epaisseur des bandes de terrain, en pixels */
export const TERRAIN = {
  /** x < MER : infranchissable */
  mer: 250,
  /** MER..PLAGE : praticable, c'est le poste du pecheur */
  plage: 340,
  /** FORET..MONTAGNE : praticable, c'est le poste du bucheron */
  foret: 870,
  /** y > MONTAGNE : infranchissable */
  montagne: 970,
};

/**
 * Le rectangle ou l'on peut marcher. Tout le reste est mer ou roche.
 * La plage et la lisiere de foret en font partie : ce sont des lieux de
 * travail, pas des murs.
 */
export const PRATICABLE: Rectangle = {
  x: TERRAIN.mer,
  y: 16,
  largeur: MONDE.largeur - 16 - TERRAIN.mer,
  hauteur: TERRAIN.montagne - 16,
};

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
