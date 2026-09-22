/**
 * La carte du village (DESIGN.md §4.6, §4.29).
 *
 * Jusqu'au 20 septembre 2026, ce fichier **etait** la carte : la mer a
 * l'ouest, la montagne au sud, le village dans l'angle, tout en constantes. Il
 * n'en est plus que la **facade** : le monde d'une partie est tire par
 * `monde.ts` (une graine, un monde), charge ici par `chargerLeMonde`, et tout
 * le code qui lisait `VILLAGE`, `EGLISE`, `PORT`, `POSTES` ou `terrainEn`
 * continue de le faire sans savoir que ca change d'une partie a l'autre.
 *
 * ⚠️ **Les constantes sont donc des objets qu'on remplit**, pas des valeurs
 * figees : `VILLAGE.x` change quand on charge un autre monde. C'est ce qui
 * evite de faire descendre un parametre a cent cinquante endroits. Rien ne
 * doit en copier la valeur au chargement d'un module.
 *
 * Au chargement, le monde courant est le **classique** — celui d'avant —, pour
 * que les tests qui le connaissent le retrouvent, et que rien ne se casse tant
 * qu'une scene n'a pas charge le sien.
 *
 * Les regles qui restent vraies quel que soit le monde (§4.6) :
 *
 * - les monstres n'arrivent que par les **fronts**, les bords ouverts ;
 * - **l'eglise** est le refuge et le cap des monstres (§4.22) ;
 * - le port est **un acquis** sur le sable, jamais un objectif.
 */

import {
  CASE,
  GRAINE_CLASSIQUE,
  MONDE,
  distanceALEau as distanceALEauDans,
  estTerreFermeDans,
  genererMonde,
  mondeClassique,
  pointDuBord,
  poserLaTaille,
  profondeurDeRoche as profondeurDeRocheDans,
  terrainDuMonde,
  type Cote,
  type Monde,
  type PosteDuMonde,
  type Taille,
  type Terrain,
} from "./monde";

export { MONDE, CASE, COLONNES, LIGNES, ondulation, GRAINE_CLASSIQUE, COTES, TAILLE_CLASSIQUE } from "./monde";
export type { Terrain, Cote, Monde, Taille } from "./monde";

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

/** Les chiffres du monde classique, gardes pour ceux qui les lisent (tests, relief). */
export { TERRAIN_CLASSIQUE as TERRAIN, AMPLITUDE_CLASSIQUE as AMPLITUDE } from "./monde";

// ------------------------------------------------------------ le monde courant

let courant: Monde = mondeClassique();

/** Le monde de la partie en cours. */
export function mondeCourant(): Monde {
  return courant;
}

/**
 * Charge un monde : c'est **le** point d'entree d'une nouvelle partie, et de
 * la reprise d'une ancienne. Tout ce qui suit lit ce monde-la.
 */
export function chargerLeMonde(monde: Monde): Monde {
  courant = monde;
  // ⚠️ **La taille d'abord** : `PRATICABLE`, la grille et tout ce qui borne un
  // deplacement en descendent. Un monde charge apres elles jouerait sur les
  // bornes du precedent.
  poserLaTaille(monde.largeur, monde.hauteur);
  PRATICABLE.largeur = monde.largeur - 32;
  PRATICABLE.hauteur = monde.hauteur - 32;
  VILLAGE.x = monde.village.x;
  VILLAGE.y = monde.village.y;
  EGLISE.x = monde.village.x;
  EGLISE.y = monde.village.y;
  PORT.x = monde.port.x;
  PORT.y = monde.port.y;
  PORT.versLeLarge = { ...monde.port.versLeLarge };
  POSTES.length = 0;
  for (const p of monde.postes) POSTES.push({ ...p, position: { ...p.position } });
  return monde;
}

/** Charge le monde d'une graine, et le rend. */
export function chargerLaGraine(graine: number | undefined, taille?: Taille): Monde {
  return chargerLeMonde(genererMonde(graine ?? GRAINE_CLASSIQUE, taille));
}

// ----------------------------------------------------------------- le terrain

/**
 * Le rectangle ou l'on peut marcher : tout le monde, a seize pixels des bords.
 *
 * ⚠️ Ce n'est plus lui qui tient la mer et la montagne a l'ecart : depuis que
 * l'eau et la roche peuvent etre n'importe ou (un lac, un massif au milieu),
 * c'est le **terrain** qui arrete les corps, case par case. Ce rectangle ne
 * dit plus que « pas hors de la carte ».
 */
export const PRATICABLE: Rectangle = { x: 16, y: 16, largeur: MONDE.largeur - 32, hauteur: MONDE.hauteur - 32 };

/** La nature du sol en un point du monde courant. */
export function terrainEn(x: number, y: number): Terrain {
  return terrainDuMonde(courant, x, y);
}

/** Vrai si le sol porte : ni eau, ni roche. */
export function estTerreFerme(x: number, y: number): boolean {
  return estTerreFermeDans(courant, x, y);
}

/** Vrai si on peut y marcher : dans la carte, et sur la terre ferme. */
export function estPraticable(x: number, y: number): boolean {
  return (
    x >= PRATICABLE.x &&
    x <= PRATICABLE.x + PRATICABLE.largeur &&
    y >= PRATICABLE.y &&
    y <= PRATICABLE.y + PRATICABLE.hauteur &&
    estTerreFerme(x, y)
  );
}

/** La distance signee a l'eau la plus proche : negative dans l'eau. */
export function distanceALEau(x: number, y: number): number {
  return distanceALEauDans(courant, x, y);
}

/** De combien on est dans la roche : positif dans l'eboulis et la roche. */
export function profondeurDeRoche(x: number, y: number): number {
  return profondeurDeRocheDans(courant, x, y);
}

// ------------------------------------------------------------------ les lieux

/**
 * Le village : l'etendue du bati et du sol de place, toujours un cercle —
 * c'est la forme que tout le code de refuge attend.
 */
export const VILLAGE = { x: 470, y: 1070, rayon: 150 };

/**
 * L'eglise, au centre du village (DESIGN.md §4.22).
 *
 * **C'est elle le refuge et le cap des monstres.** Tout ce qui converge — les
 * habitants qui fuient, les heros qui rentrent soigner, les monstres —
 * converge sur ce point-ci.
 *
 * `emprise` est son occupation au sol, en pixels : le sprite monte bien plus
 * haut (jusqu'a 96 px au niveau 4) mais son corps ne grandit jamais, sinon un
 * batiment ameliore ne tiendrait plus a l'endroit ou on l'a pose (§4.24).
 */
export const EGLISE = { x: VILLAGE.x, y: VILLAGE.y, emprise: 48 };

/**
 * Le port, sur le sable au bord de l'eau (DESIGN.md §4.18).
 *
 * Un acquis, pas un objectif : il n'a **pas de points de vie**, et ce n'est pas
 * un oubli. `versLeLarge` dit de quel cote est l'eau : c'est la que mouille le
 * navire.
 */
export const PORT: Point & { emprise: number; versLeLarge: Point } = {
  x: 288,
  y: VILLAGE.y,
  emprise: 40,
  versLeLarge: { x: -1, y: 0 },
};

/** Les postes de travail des habitants (DESIGN.md §4.18). */
export type PosteTravail = PosteDuMonde;

export const POSTES: PosteTravail[] = [];

chargerLeMonde(courant);

// --------------------------------------------------------------- geometrie

/**
 * Est-on dans l'etendue batie du village ?
 *
 * ⚠️ **Ce n'est pas une zone de securite.** Ce qui protege, c'est **d'entrer
 * dans l'eglise**, et rien d'autre (§4.22). Cette fonction ne sert qu'a savoir
 * ou s'arrete le bati.
 */
export function dansLeVillage(x: number, y: number): boolean {
  return Math.hypot(x - VILLAGE.x, y - VILLAGE.y) <= VILLAGE.rayon;
}

/** Distance au parvis de l'eglise — le point vers lequel tout converge. */
export function distanceALEglise(x: number, y: number): number {
  return Math.hypot(x - EGLISE.x, y - EGLISE.y);
}

/**
 * Est-on assez pres pour entrer dans l'eglise ?
 *
 * Genereux d'une demi-emprise : on entre en touchant le batiment, pas en
 * atteignant un pixel precis.
 */
export function auPiedDeLEglise(x: number, y: number): boolean {
  return distanceALEglise(x, y) <= EGLISE.emprise * 0.75;
}

// ------------------------------------------------------------------ fronts

/** Un front, c'est un bord de la carte par lequel on entre a pied. */
export type Front = Cote;

export const NOMS_FRONT: Record<Front, string> = {
  nord: "au NORD",
  est: "a l'EST",
  sud: "au SUD",
  ouest: "a l'OUEST",
};

/** Les fronts du monde courant, du plus loin du village au plus pres. */
export function frontsOuverts(): Front[] {
  return courant.fronts;
}

/**
 * Les fronts ouverts a une vague donnee (DESIGN.md §4.6, §4.29).
 *
 * Ouvrir un flanc est un levier de difficulte a part entiere : il ne change
 * aucun chiffre, il change **ou il faut etre**. Les quatre premieres nuits
 * n'ouvrent que le premier front — le plus loin du village, celui qui laisse
 * le temps de reagir ; jusqu'a la neuvieme, un seul, tire au sort ; ensuite
 * deux. Un monde qui n'a qu'un bord ouvert (une presqu'ile) n'en ouvre jamais
 * qu'un : c'est le plus gros cadeau du jeu (§4.29).
 *
 * @param tirage aleatoire dans [0,1)
 * @param ouverts les fronts du monde ; ceux du monde courant par defaut
 */
export function frontsDeLaVague(vague: number, tirage: number, ouverts: readonly Front[] = courant.fronts): Front[] {
  const premier = ouverts[0] ?? "nord";
  if (ouverts.length <= 1) return [premier];
  if (vague <= 4) return [premier];
  const i = Math.min(ouverts.length - 1, Math.floor(tirage * ouverts.length));
  if (vague <= 9) return [ouverts[i]!];
  // Deux fronts : les deux s'il n'y en a que deux, sinon le tire au sort et
  // son suivant — jamais le meme deux fois.
  if (ouverts.length === 2) return [...ouverts];
  return [ouverts[i]!, ouverts[(i + 1) % ouverts.length]!];
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
 * Il surgit au bord de la carte, jamais au milieu, et toujours sur une terre
 * qui mene au village : le joueur doit pouvoir regarder dans une direction et
 * savoir ce qui arrive.
 *
 * @param tirage aleatoire dans [0,1), la position le long du bord
 */
export function pointDApparition(front: Front, tirage: number): Point {
  return pointDuBord(courant, front, tirage);
}

// ------------------------------------------------------------------ les rives

/**
 * Les rives autour d'un point : la terre ferme qui touche l'eau (§4.21).
 *
 * C'est de la que sortent les betes d'eau, la nuit de crue. On ne les fait pas
 * paraitre **dans** l'eau : rien ne nage dans ce jeu, et un monstre pose sur la
 * mer serait un monstre qui flotte. Il sort donc **sur la berge**, la ou il
 * pourrait poser une patte.
 *
 * ⚠️ **Le tri se fait par distance, une seule fois, a la nuit tombee** — jamais
 * par image (regle 5 du §4.17). Et la liste peut revenir **vide** : un village
 * sans lac ni mer a portee ne voit rien sortir, ce qui est la seule reponse
 * honnete. Un village loin de l'eau ne craint pas la crue.
 *
 * @param centre le point autour duquel chercher (le village)
 * @param rayon la distance maximale, en pixels
 * @param combien le nombre de rives voulues, au plus
 */
export function rivesAutour(
  centre: Point,
  rayon: number,
  combien: number,
): Point[] {
  const trouvees: { point: Point; distance: number }[] = [];
  // Un pas d'une case et demie : assez fin pour trouver la berge d'un lac,
  // assez grossier pour que la passe ne coute rien.
  const pas = CASE * 1.5;

  for (let y = centre.y - rayon; y <= centre.y + rayon; y += pas) {
    for (let x = centre.x - rayon; x <= centre.x + rayon; x += pas) {
      if (!estPraticable(x, y)) continue;
      const distance = Math.hypot(x - centre.x, y - centre.y);
      if (distance > rayon) continue;
      // Une berge, c'est de la terre qui **touche** l'eau : on regarde ses
      // quatre voisines a une case.
      const auBord =
        estEau(x + CASE, y) || estEau(x - CASE, y) || estEau(x, y + CASE) || estEau(x, y - CASE);
      if (!auBord) continue;
      trouvees.push({ point: { x, y }, distance });
    }
  }

  trouvees.sort((a, b) => a.distance - b.distance);
  return trouvees.slice(0, combien).map((t) => t.point);
}

/** Vrai si ce point est de l'eau — n'importe laquelle, du haut-fond a l'abysse. */
function estEau(x: number, y: number): boolean {
  const sol = terrainEn(x, y);
  return sol === "haut-fond" || sol === "mer" || sol === "abysse";
}
