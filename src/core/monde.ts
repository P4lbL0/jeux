/**
 * Le monde d'une partie (DESIGN.md §4.29, jalon 5.5 — 20 septembre 2026).
 *
 * Jusqu'ici la carte etait **une seule formule** : la mer a l'ouest, la
 * montagne au sud, le village blotti dans l'angle, et tout le reste en
 * constantes de `carte.ts`. Angelos l'a refuse le 20 septembre : « les villages
 * et le sol peuvent etre differents — un lac, la mer a droite, pas de montagne,
 * un massif montagneux au milieu ». D'ou ce fichier : **une graine, un monde**.
 *
 * Ce qu'il tire, et dans cet ordre — **par assemblage de regles**, jamais case
 * par case (§4.29) :
 *
 * 1. **La mer**, sur un bord ou absente. Sans mer, il y a toujours un lac : le
 *    pecheur et le port ont besoin d'une eau.
 * 2. **Le relief** : une chaine le long d'un bord, un massif au milieu, ou un
 *    simple piton. Jamais rien du tout : la mine a besoin d'une roche.
 * 3. **Les lacs**, un ou aucun, loin du relief.
 * 4. **Les bois** : une bande au pied de la chaine, un anneau au pied du
 *    massif, et un ou deux bosquets ailleurs. Le bucheron a besoin d'arbres.
 * 5. **Le village**, la ou il y a de l'herbe autour et une eau pas loin.
 * 6. **Les postes** (§4.18), cherches sur le terrain : le port et la plage sur
 *    le sable au bord de l'eau, la mine au pied de la roche, la foret dans les
 *    arbres, les champs en terrain ouvert. Tous atteignables a pied, en ligne
 *    droite depuis l'eglise.
 * 7. **Les fronts** : chaque bord par lequel on peut entrer a pied. De un a
 *    quatre (§4.29).
 *
 * La graine **zero** rend le monde classique — celui d'avant, exactement, pour
 * les sauvegardes d'avant le 20 septembre et pour les tests qui le connaissent.
 *
 * Ce fichier ne connait pas Phaser, et `carte.ts` n'est plus que sa facade.
 */

import type { Point } from "./carte";
import { Rng } from "./rng";

/** Une zone jouable, en pixels. */
export interface Taille {
  largeur: number;
  hauteur: number;
}

/** La zone jouable du monde classique : la carte d'avant le 20 septembre 2026. */
export const TAILLE_CLASSIQUE: Taille = { largeur: 2000, hauteur: 1500 };

/**
 * La zone qui se ferme quand on s'installe (§4.29) : **le double** du classique.
 *
 * Le design demandait « x2 a x3, en mesurant ». Mesure du 20 septembre 2026 au
 * soir (`.tmp/mesurer-taille.ts`), sur quatre graines :
 *
 * | zone | tirage | grille | peinture de la carte | texture |
 * |------|--------|--------|----------------------|---------|
 * | x1   |  36 ms |  1,5ms |   492 ms             | 11,4 Mo |
 * | x2   |  64 ms |  2,6ms | **1033 ms**          | 22,9 Mo |
 * | x3   |  91 ms |  2,7ms |  1447 ms             | 34,3 Mo |
 *
 * Tout monte **avec la surface**, et le tirage comme la grille restent
 * negligeables. Ce qui decide, c'est la **peinture de la carte** : elle peint un
 * pixel par pixel du monde, une fois au chargement. A x3 elle fige le jeu une
 * seconde et demie et reserve trente-quatre megaoctets de texture ; a x2 elle
 * tient dans la seconde que le test de `carte.ts` s'impose deja.
 *
 * ⚠️ **x3 n'est pas refuse pour toujours** : il le sera le jour ou la carte se
 * peindra par morceaux au lieu d'un bloc. Tant qu'elle est monolithique, c'est
 * elle le plafond, pas la memoire ni le tirage.
 *
 * ⚠️ **Pas encore appliquee au demarrage** : la zone ne se ferme qu'a
 * l'installation, et l'installation n'est pas codee. Une partie commence
 * aujourd'hui sur `TAILLE_CLASSIQUE`.
 */
export const TAILLE_JOUABLE: Taille = { largeur: 2828, hauteur: 2121 };

/**
 * La zone jouable **du monde charge**, et non plus une constante du jeu.
 *
 * ⚠️ C'est une **facade**, comme `VILLAGE` et `EGLISE` dans `carte.ts` : un objet
 * qu'on remplit au chargement (`poserLaTaille`), jamais une valeur qu'on lit
 * avant. Le §4.29 veut une zone qui grandit — « on monte de x1 a x3 en
 * mesurant » —, et une constante ne peut pas grandir.
 *
 * Tout ce qui recoit un `Monde` lit **`m.largeur` / `m.hauteur`**, pas ceci :
 * generer un monde ne doit pas dependre de celui qui est charge.
 */
export const MONDE: Taille = { largeur: TAILLE_CLASSIQUE.largeur, hauteur: TAILLE_CLASSIQUE.hauteur };

/** Cote d'une case, en pixels — le meme que `grille.ts`, qui l'importe d'ici. */
export const CASE = 32;

/**
 * La grille de la zone chargee. **Liaisons vivantes** : un `import` les suit.
 *
 * ⚠️ Une `Grille` alloue `COLONNES * LIGNES` cases a sa construction — elle doit
 * donc naitre **apres** `poserLaTaille`, et mourir avec son monde.
 */
export let COLONNES = Math.ceil(MONDE.largeur / CASE);
export let LIGNES = Math.ceil(MONDE.hauteur / CASE);

/** La grille **d'un monde donne** — celui qu'on genere n'est pas celui qu'on joue. */
export function colonnesDe(m: { largeur: number }): number {
  return Math.ceil(m.largeur / CASE);
}
export function lignesDe(m: { hauteur: number }): number {
  return Math.ceil(m.hauteur / CASE);
}

/** Pose la zone jouable. Appelee par `chargerLeMonde`, et par personne d'autre. */
export function poserLaTaille(largeur: number, hauteur: number): void {
  MONDE.largeur = largeur;
  MONDE.hauteur = hauteur;
  COLONNES = Math.ceil(largeur / CASE);
  LIGNES = Math.ceil(hauteur / CASE);
}

export type Cote = "nord" | "est" | "sud" | "ouest";
export const COTES: readonly Cote[] = ["nord", "est", "sud", "ouest"];

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

// ------------------------------------------------------------- l'ondulation

/**
 * Ondulation lisse et deterministe.
 *
 * Trois sinus de periodes incommensurables : le motif ne se repete jamais a
 * l'oeil, et pourtant la fonction est pure — la meme graine redonne la meme
 * carte, donc on peut apprendre son terrain.
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

export interface Ondulation {
  echelle: number;
  amplitude: number;
  /** Un decalage le long de la ligne : deux bandes ne serpentent pas pareil */
  decalage: number;
}

const ondule = (o: Ondulation, t: number): number => ondulation(t + o.decalage, o.echelle, o.amplitude);

// ---------------------------------------------------------------- les formes

/**
 * Une bande le long d'un bord : la mer, une chaine de montagnes, la foret a
 * son pied. `position` est la coordonnee de sa ligne dans le monde (un x pour
 * un bord ouest ou est, un y pour un bord nord ou sud), et la ligne ondule le
 * long du bord.
 */
export interface Bande {
  cote: Cote;
  position: number;
  ondulation: Ondulation;
}

/**
 * Une tache : un lac, un massif, un bosquet. Une ellipse dont le rayon ondule
 * avec l'angle — `relief` est la part du rayon qui ondule, et les phases
 * changent le dessin d'une tache a l'autre.
 */
export interface Tache {
  x: number;
  y: number;
  rx: number;
  ry: number;
  relief: number;
  phases: readonly [number, number, number];
}

/**
 * La distance signee a la ligne d'une bande : **negative dedans** (dans l'eau,
 * dans la roche, dans les arbres), positive dehors.
 */
export function distanceABande(b: Bande, x: number, y: number): number {
  switch (b.cote) {
    case "ouest":
      return x - (b.position + ondule(b.ondulation, y));
    case "est":
      return b.position + ondule(b.ondulation, y) - x;
    case "nord":
      return y - (b.position + ondule(b.ondulation, x));
    case "sud":
      return b.position + ondule(b.ondulation, x) - y;
  }
}

/** Ou passe la ligne d'une bande, a une abscisse (nord, sud) ou une hauteur (est, ouest) donnee. */
export function ligneDeBande(b: Bande, t: number): number {
  return b.position + ondule(b.ondulation, t);
}

/**
 * La distance signee au bord d'une tache : negative dedans. Approchee — c'est
 * le rayon de l'ellipse dans la direction du point qui sert d'echelle —, mais
 * exacte la ou ca compte, pres du bord.
 */
/** Jusqu'ou, au-dela du bord d'une tache, on lit encore sa distance : l'anneau d'arbres le plus large, et de la marge. */
const MARGE_DE_TACHE = 130;

export function distanceATache(t: Tache, x: number, y: number): number {
  const dx = x - t.x;
  const dy = y - t.y;
  // Loin de la tache, on ne calcule rien : c'est ce qui rend la peinture de la
  // carte abordable avec plusieurs taches. La marge couvre la bande la plus
  // large qu'on lit autour d'une tache — l'anneau d'arbres d'un massif.
  const marge = 1 + t.relief;
  if (Math.abs(dx) > t.rx * marge + MARGE_DE_TACHE || Math.abs(dy) > t.ry * marge + MARGE_DE_TACHE) return 1e6;
  const angle = Math.atan2(dy, dx);
  const rho = Math.hypot(dx / t.rx, dy / t.ry);
  const bord =
    1 +
    t.relief *
      (Math.sin(3 * angle + t.phases[0]) * 0.5 +
        Math.sin(5 * angle + t.phases[1]) * 0.3 +
        Math.sin(7 * angle + t.phases[2]) * 0.2);
  const c = Math.cos(angle) / t.rx;
  const s = Math.sin(angle) / t.ry;
  const rayon = 1 / Math.sqrt(c * c + s * s);
  return (rho - bord) * rayon;
}

// ---------------------------------------------------------------- le monde

/** Un lieu de travail (§4.18). */
export interface PosteDuMonde {
  id: "plage" | "mine" | "foret" | "champs";
  nom: string;
  metier: "pecheur" | "mineur" | "bucheron" | "fermier";
  position: Point;
}

export interface Monde {
  graine: number;
  /** La zone jouable de ce monde-la : le §4.29 la fait grandir, elle n'est plus fixe. */
  largeur: number;
  hauteur: number;
  mer: Bande | null;
  /** La largeur de la plage au bord de la mer, et son ondulation */
  plage: { largeur: number; ondulation: Ondulation };
  lacs: Tache[];
  montagne: Bande | null;
  /** La foret au pied de la chaine : une bande a elle, qui ondule autrement */
  lisiere: Bande | null;
  /** Massifs et pitons : de la roche en pleine terre */
  massifs: Tache[];
  /** La largeur de l'anneau d'arbres au pied d'un massif */
  anneauDeBois: number;
  bois: Tache[];
  /** L'eglise, centre du village */
  village: Point;
  /** Le port, sur le sable, et la direction du large depuis le quai */
  port: Point & { versLeLarge: Point };
  postes: PosteDuMonde[];
  /** Les bords par lesquels on entre a pied, du plus loin du village au plus pres */
  fronts: Cote[];
  /** Ou l'on peut paraitre, par bord : des points au bord, sur la terre, relies au village */
  bords: Record<Cote, Point[]>;
  /** La premiere terre reliee au village depuis chaque bord : la ou paraissent les survivants */
  lisieres: Record<Cote, Point[]>;
}

/** La graine du monde classique : la carte d'avant le 20 septembre 2026. */
export const GRAINE_CLASSIQUE = 0;

// ---------------------------------------------------------------- le terrain

/** Les seuils des bandes d'eau et de roche, en pixels depuis la ligne. */
const EAU = { abysse: -104, mer: -38 };
const ROCHE = { roche: -44 };
/** La plage d'un lac : etroite, et elle ondule peu. */
const PLAGE_DE_LAC = { largeur: 22, ondulation: { echelle: 60, amplitude: 6, decalage: 0 } };

/** La distance signee a l'eau la plus proche : negative dans l'eau. */
export function distanceALEau(m: Monde, x: number, y: number): number {
  let d = m.mer ? distanceABande(m.mer, x, y) : 1e6;
  for (const lac of m.lacs) {
    const dl = distanceATache(lac, x, y);
    if (dl < d) d = dl;
  }
  return d;
}

/**
 * De combien on est **dans** la roche : positif dans l'eboulis et la roche,
 * negatif dehors. C'est ce que le relief lit pour faire monter la montagne.
 */
export function profondeurDeRoche(m: Monde, x: number, y: number): number {
  let p = m.montagne ? -distanceABande(m.montagne, x, y) : -1e6;
  for (const massif of m.massifs) {
    const pm = -distanceATache(massif, x, y);
    if (pm > p) p = pm;
  }
  return p;
}

/** La distance signee aux arbres : negative dans le sous-bois. */
export function distanceAuBois(m: Monde, x: number, y: number): number {
  let d = m.lisiere ? distanceABande(m.lisiere, x, y) : 1e6;
  for (const massif of m.massifs) {
    const dm = distanceATache(massif, x, y) - m.anneauDeBois;
    if (dm < d) d = dm;
  }
  for (const b of m.bois) {
    const db = distanceATache(b, x, y);
    if (db < d) d = db;
  }
  return d;
}

/**
 * La nature du sol en un point.
 *
 * L'eau est testee avant la roche : une montagne descend donc jusqu'au rivage
 * et s'y arrete, au lieu de couper le littoral en deux. Puis le sable, puis
 * les arbres, puis l'herbe — c'est l'ordre de la formule d'avant, conserve
 * pour que la graine zero rende la meme carte.
 */
export function terrainDuMonde(m: Monde, x: number, y: number): Terrain {
  // L'eau.
  let dEau = 1e6;
  let plage = 0;
  if (m.mer) {
    dEau = distanceABande(m.mer, x, y);
    const t = m.mer.cote === "nord" || m.mer.cote === "sud" ? x : y;
    plage = m.plage.largeur + ondule(m.plage.ondulation, t);
  }
  for (const lac of m.lacs) {
    const dl = distanceATache(lac, x, y);
    if (dl < dEau) {
      dEau = dl;
      plage = PLAGE_DE_LAC.largeur + ondule(PLAGE_DE_LAC.ondulation, x + y);
    }
  }
  if (dEau < EAU.abysse) return "abysse";
  if (dEau < EAU.mer) return "mer";
  if (dEau < 0) return "haut-fond";

  // La roche.
  const roche = profondeurDeRoche(m, x, y);
  if (roche > -ROCHE.roche) return "roche";
  if (roche > 0) return "eboulis";

  if (dEau < plage) return "sable";
  if (distanceAuBois(m, x, y) < 0) return "sous-bois";
  return "herbe";
}

export function estTerreFermeDans(m: Monde, x: number, y: number): boolean {
  const sol = terrainDuMonde(m, x, y);
  return sol === "sable" || sol === "herbe" || sol === "sous-bois";
}

// ------------------------------------------------------- le monde classique

/** Position moyenne de chaque limite du monde classique, en pixels. */
export const TERRAIN_CLASSIQUE = { mer: 250, plage: 62, foret: 1150, montagne: 1260 };
export const AMPLITUDE_CLASSIQUE = { cote: 34, plage: 18, foret: 30, montagne: 26 };

/**
 * Le monde d'avant le 20 septembre 2026 : la mer a l'ouest, la montagne au sud,
 * la foret a son pied, le village dans l'angle. Les memes formules qu'avant,
 * au chiffre pres — un test le verifie.
 */
export function mondeClassique(): Monde {
  const village = { x: 470, y: 1070 };
  const m: Monde = {
    graine: GRAINE_CLASSIQUE,
    // ⚠️ Le classique garde **sa** taille quoi qu'on demande : c'est la carte
    // d'avant, au chiffre pres, et les tests qui la connaissent tournent dessus.
    largeur: TAILLE_CLASSIQUE.largeur,
    hauteur: TAILLE_CLASSIQUE.hauteur,
    mer: { cote: "ouest", position: TERRAIN_CLASSIQUE.mer, ondulation: { echelle: 130, amplitude: AMPLITUDE_CLASSIQUE.cote, decalage: 0 } },
    plage: { largeur: TERRAIN_CLASSIQUE.plage, ondulation: { echelle: 88, amplitude: AMPLITUDE_CLASSIQUE.plage, decalage: 480 } },
    lacs: [],
    montagne: { cote: "sud", position: TERRAIN_CLASSIQUE.montagne, ondulation: { echelle: 152, amplitude: AMPLITUDE_CLASSIQUE.montagne, decalage: 0 } },
    lisiere: { cote: "sud", position: TERRAIN_CLASSIQUE.foret, ondulation: { echelle: 118, amplitude: AMPLITUDE_CLASSIQUE.foret, decalage: 910 } },
    massifs: [],
    anneauDeBois: 0,
    bois: [],
    village,
    port: { x: 288, y: village.y, versLeLarge: { x: -1, y: 0 } },
    postes: [
      { id: "plage", nom: "La plage", metier: "pecheur", position: { x: 295, y: 770 } },
      { id: "mine", nom: "La mine", metier: "mineur", position: { x: 760, y: 1215 } },
      { id: "foret", nom: "La foret", metier: "bucheron", position: { x: 1180, y: 1205 } },
      { id: "champs", nom: "Les champs", metier: "fermier", position: { x: 720, y: 960 } },
    ],
    fronts: ["nord", "est"],
    bords: { nord: [], est: [], sud: [], ouest: [] },
    lisieres: { nord: [], est: [], sud: [], ouest: [] },
  };
  const atteint = relierAuVillage(m);
  m.bords = releverLesBords(m, atteint);
  m.lisieres = releverLesLisieres(m, atteint);
  return m;
}

// ------------------------------------------------------------ la generation

/** Ce qui tient un village : une plage de cases d'herbe autour de l'eglise. */
const VILLAGE_MARGE_DU_BORD = 240;
/** Le rayon, en cases, dans lequel on compte l'herbe autour d'un site. */
const RAYON_DE_SITE = 4;

/** Les mondes qu'on tire avant de se rabattre sur le classique. */
const ESSAIS_DE_MONDE = 12;

/**
 * Le monde d'une graine.
 *
 * Une graine peut tomber sur un tirage impossible — pas de roche accessible,
 * pas de sable au bord de l'eau. On retire alors, avec la suite du meme tirage,
 * jusqu'a douze fois ; au-dela, le monde classique. Pure : la meme graine
 * redonne le meme monde.
 */
export function genererMonde(graine: number, taille = TAILLE_CLASSIQUE): Monde {
  if (graine === GRAINE_CLASSIQUE) return mondeClassique();
  const rng = new Rng(graine);
  for (let essai = 0; essai < ESSAIS_DE_MONDE; essai++) {
    const monde = tirerUnMonde(rng, graine, taille);
    if (monde) return monde;
  }
  return mondeClassique();
}

function tirerUnMonde(rng: Rng, graine: number, taille: Taille): Monde | null {
  const { largeur, hauteur } = taille;
  const ond = (echelle: number, amplitude: number): Ondulation => ({ echelle, amplitude, decalage: rng.int(0, 4000) });
  const phases = (): [number, number, number] => [rng.range(0, 6.28), rng.range(0, 6.28), rng.range(0, 6.28)];
  /** La coordonnee d'une ligne a `p` pixels d'un bord. */
  const depuisLeBord = (cote: Cote, p: number) =>
    cote === "ouest" || cote === "nord" ? p : cote === "est" ? largeur - p : hauteur - p;

  // 1. La mer : sur un bord, ou pas du tout.
  const mer: Bande | null = rng.chance(0.72)
    ? { cote: rng.pick([...COTES]), position: 0, ondulation: ond(130, 34) }
    : null;
  if (mer) mer.position = depuisLeBord(mer.cote, rng.int(200, 320));

  // La boite ou l'on peut poser une tache sans toucher la mer.
  const boite = { x0: 260, x1: largeur - 260, y0: 260, y1: hauteur - 260 };
  if (mer) {
    const large = 460;
    if (mer.cote === "ouest") boite.x0 = large;
    if (mer.cote === "est") boite.x1 = largeur - large;
    if (mer.cote === "nord") boite.y0 = large;
    if (mer.cote === "sud") boite.y1 = hauteur - large;
  }

  // 2. Le relief : une chaine, un massif, ou un piton.
  const tirage = rng.next();
  const genre: "chaine" | "massif" | "piton" = tirage < 0.5 ? "chaine" : tirage < 0.8 ? "massif" : "piton";
  let montagne: Bande | null = null;
  let lisiere: Bande | null = null;
  const massifs: Tache[] = [];
  let anneauDeBois = 0;
  const taches: Tache[] = [];
  const loinDesAutres = (t: Tache, marge: number) =>
    taches.every((autre) => Math.hypot(autre.x - t.x, autre.y - t.y) > Math.max(autre.rx, autre.ry) + Math.max(t.rx, t.ry) + marge);
  const poserUneTache = (rx: number, ry: number, relief: number, marge: number): Tache | null => {
    for (let essai = 0; essai < 30; essai++) {
      const t: Tache = { x: rng.range(boite.x0, boite.x1), y: rng.range(boite.y0, boite.y1), rx, ry, relief, phases: phases() };
      if (loinDesAutres(t, marge)) {
        taches.push(t);
        return t;
      }
    }
    return null;
  };

  if (genre === "chaine") {
    const cote = rng.pick(COTES.filter((c) => c !== mer?.cote));
    const p = rng.int(200, 300);
    montagne = { cote, position: depuisLeBord(cote, p), ondulation: ond(152, 26) };
    lisiere = { cote, position: depuisLeBord(cote, p + rng.int(90, 140)), ondulation: ond(118, 30) };
    if (cote === "ouest") boite.x0 = Math.max(boite.x0, p + 220);
    if (cote === "est") boite.x1 = Math.min(boite.x1, largeur - p - 220);
    if (cote === "nord") boite.y0 = Math.max(boite.y0, p + 220);
    if (cote === "sud") boite.y1 = Math.min(boite.y1, hauteur - p - 220);
  } else if (genre === "massif") {
    const massif = poserUneTache(rng.int(200, 320), rng.int(150, 260), 0.22, 0);
    if (!massif) return null;
    massifs.push(massif);
    anneauDeBois = rng.int(70, 110);
  } else {
    const piton = poserUneTache(rng.int(80, 130), rng.int(60, 110), 0.3, 0);
    if (!piton) return null;
    massifs.push(piton);
    anneauDeBois = rng.int(30, 50);
  }

  // 3. Les lacs : toujours un sans mer, parfois un avec.
  const lacs: Tache[] = [];
  if (!mer || rng.chance(0.35)) {
    const lac = poserUneTache(rng.int(110, 240), rng.int(90, 200), 0.2, 140);
    if (!lac) return null;
    lacs.push(lac);
  }

  // 4. Les bois : un bosquet toujours, deux parfois — et un piton n'a presque
  // pas d'arbres au pied, il lui faut un vrai bois.
  const bois: Tache[] = [];
  const bosquets = genre === "chaine" ? (rng.chance(0.5) ? 1 : 0) : rng.chance(0.5) ? 2 : 1;
  for (let i = 0; i < bosquets; i++) {
    const b = poserUneTache(rng.int(150, 260), rng.int(120, 220), 0.3, 40);
    if (b) bois.push(b);
  }
  if (genre !== "chaine" && bois.length === 0) return null;

  const monde: Monde = {
    graine,
    largeur,
    hauteur,
    mer,
    plage: { largeur: 62, ondulation: ond(88, 18) },
    lacs,
    montagne,
    lisiere,
    massifs,
    anneauDeBois,
    bois,
    village: { x: 0, y: 0 },
    port: { x: 0, y: 0, versLeLarge: { x: -1, y: 0 } },
    postes: [],
    fronts: [],
    bords: { nord: [], est: [], sud: [], ouest: [] },
    lisieres: { nord: [], est: [], sud: [], ouest: [] },
  };

  // 5. Le village.
  const site = choisirLeSite(monde, rng);
  if (!site) return null;
  monde.village = site;

  // 6. Les postes, sur le terrain.
  const atteint = relierAuVillage(monde);
  if (!placerLesPostes(monde, atteint)) return null;

  // 7. Les fronts, et les lisieres pour les survivants.
  monde.bords = releverLesBords(monde, atteint);
  monde.lisieres = releverLesLisieres(monde, atteint);
  monde.fronts = COTES.filter((c) => monde.bords[c].length >= 6).sort(
    (a, b) => distanceAuBord(monde, monde.village, b) - distanceAuBord(monde, monde.village, a),
  );
  if (monde.fronts.length === 0) return null;
  return monde;
}

function distanceAuBord(m: Monde, p: Point, cote: Cote): number {
  switch (cote) {
    case "nord":
      return p.y;
    case "sud":
      return m.hauteur - p.y;
    case "ouest":
      return p.x;
    case "est":
      return m.largeur - p.x;
  }
}

/**
 * Ou poser l'eglise : sur l'herbe, avec de l'herbe autour, une eau pas trop
 * loin, et si possible la roche et les arbres a portee de marche. On tire des
 * sites au hasard et on garde le meilleur — le hasard vient du tirage, pas du
 * choix, pour que le meme monde ait toujours le meme village.
 */
function choisirLeSite(m: Monde, rng: Rng): Point | null {
  let meilleur: Point | null = null;
  let meilleurScore = -Infinity;
  const marge = VILLAGE_MARGE_DU_BORD;
  for (let essai = 0; essai < 320; essai++) {
    // Au centre d'une case, tout de suite : c'est la que l'eglise se pose, et
    // c'est ce point-la qu'on juge — pas un voisin a quelques pixels.
    const x = Math.round(rng.range(marge, m.largeur - marge) / CASE) * CASE + CASE / 2;
    const y = Math.round(rng.range(marge, m.hauteur - marge) / CASE) * CASE + CASE / 2;
    if (terrainDuMonde(m, x, y) !== "herbe") continue;
    // L'herbe autour : un village a besoin d'une place.
    let herbe = 0;
    let total = 0;
    for (let dl = -RAYON_DE_SITE; dl <= RAYON_DE_SITE; dl++) {
      for (let dc = -RAYON_DE_SITE; dc <= RAYON_DE_SITE; dc++) {
        total += 1;
        if (terrainDuMonde(m, x + dc * CASE, y + dl * CASE) === "herbe") herbe += 1;
      }
    }
    if (herbe < total * 0.55) continue;
    const eau = distanceALEau(m, x, y);
    const roche = -profondeurDeRoche(m, x, y);
    const arbres = distanceAuBois(m, x, y);
    // Pres de l'eau, mais pas les pieds dedans ; la roche et les arbres a
    // portee de marche — et le bruit, pour que deux mondes proches ne posent
    // pas leur village au meme endroit.
    const score =
      herbe * 2 -
      Math.abs(eau - 220) * 0.6 -
      Math.max(0, roche - 380) * 0.25 -
      Math.max(0, arbres - 300) * 0.25 +
      rng.range(0, 40);
    if (score > meilleurScore) {
      meilleurScore = score;
      meilleur = { x, y };
    }
  }
  return meilleur;
}

// ------------------------------------------------------------ le terrain, en cases

/** Le terrain au centre d'une case. */
export function terrainDeCase(m: Monde, colonne: number, ligne: number): Terrain {
  return terrainDuMonde(m, colonne * CASE + CASE / 2, ligne * CASE + CASE / 2);
}

const TERRE_FERME: readonly Terrain[] = ["sable", "herbe", "sous-bois"];

/**
 * Les cases qu'on atteint a pied depuis l'eglise, par la terre ferme, en
 * quatre voisins. Un `Uint8Array` de la taille de la grille : 1 si atteinte.
 */
export function relierAuVillage(m: Monde): Uint8Array {
  const COLONNES = colonnesDe(m);
  const LIGNES = lignesDe(m);
  const atteint = new Uint8Array(COLONNES * LIGNES);
  const terre = new Uint8Array(COLONNES * LIGNES);
  for (let l = 0; l < LIGNES; l++) {
    for (let c = 0; c < COLONNES; c++) terre[l * COLONNES + c] = TERRE_FERME.includes(terrainDeCase(m, c, l)) ? 1 : 0;
  }
  const c0 = Math.floor(m.village.x / CASE);
  const l0 = Math.floor(m.village.y / CASE);
  const pile = [l0 * COLONNES + c0];
  atteint[l0 * COLONNES + c0] = 1;
  while (pile.length > 0) {
    const i = pile.pop()!;
    const c = i % COLONNES;
    const l = (i - c) / COLONNES;
    for (const [dc, dl] of [
      [0, -1],
      [1, 0],
      [0, 1],
      [-1, 0],
    ] as const) {
      const cc = c + dc;
      const ll = l + dl;
      if (cc < 0 || ll < 0 || cc >= COLONNES || ll >= LIGNES) continue;
      const j = ll * COLONNES + cc;
      if (atteint[j] || !terre[j]) continue;
      atteint[j] = 1;
      pile.push(j);
    }
  }
  return atteint;
}

/** Le segment entre deux points ne traverse-t-il que de la terre ferme ? Echantillonne tous les 8 px. */
export function segmentSurTerre(m: Monde, de: Point, a: Point): boolean {
  const longueur = Math.hypot(a.x - de.x, a.y - de.y);
  const pas = Math.max(1, Math.ceil(longueur / 8));
  for (let i = 0; i <= pas; i++) {
    const t = i / pas;
    if (!estTerreFermeDans(m, de.x + (a.x - de.x) * t, de.y + (a.y - de.y) * t)) return false;
  }
  return true;
}

/**
 * Les postes, cherches sur le terrain (§4.18). Chacun est la case atteignable
 * la plus proche de l'eglise qui remplit sa condition, a plus de cinq cases
 * d'elle, et qu'on rejoint en ligne droite sans traverser d'eau ni de roche —
 * les habitants marchent droit vers leur poste.
 *
 * @returns faux s'il manque un poste : le monde est alors rejete
 */
function placerLesPostes(m: Monde, atteint: Uint8Array): boolean {
  const eglise = m.village;
  const centre = (c: number, l: number): Point => ({ x: c * CASE + CASE / 2, y: l * CASE + CASE / 2 });
  const voisine = (c: number, l: number, dc: number, dl: number): Terrain | null => {
    const cc = c + dc;
    const ll = l + dl;
    if (cc < 0 || ll < 0 || cc >= COLONNES || ll >= LIGNES) return null;
    return terrainDeCase(m, cc, ll);
  };
  const toucheLEau = (c: number, l: number) =>
    [voisine(c, l, 0, -1), voisine(c, l, 1, 0), voisine(c, l, 0, 1), voisine(c, l, -1, 0)].includes("haut-fond");
  const toucheLaRoche = (c: number, l: number) => {
    for (let dl = -1; dl <= 1; dl++) {
      for (let dc = -1; dc <= 1; dc++) if (voisine(c, l, dc, dl) === "eboulis") return true;
    }
    return false;
  };
  const arbresAutour = (c: number, l: number) => {
    let n = 0;
    for (let dl = -1; dl <= 1; dl++) {
      for (let dc = -1; dc <= 1; dc++) if ((dc !== 0 || dl !== 0) && voisine(c, l, dc, dl) === "sous-bois") n += 1;
    }
    return n;
  };
  const herbeAutour = (c: number, l: number, rayon: number) => {
    let n = 0;
    for (let dl = -rayon; dl <= rayon; dl++) {
      for (let dc = -rayon; dc <= rayon; dc++) if (voisine(c, l, dc, dl) === "herbe") n += 1;
    }
    return n;
  };

  /** La meilleure case atteignable selon un score (plus haut = mieux), ou null. */
  const chercher = (
    minCases: number,
    condition: (c: number, l: number, t: Terrain) => boolean,
    score: (c: number, l: number, distance: number) => number,
  ): Point | null => {
    let meilleure: Point | null = null;
    let meilleurScore = -Infinity;
    for (let l = 0; l < LIGNES; l++) {
      for (let c = 0; c < COLONNES; c++) {
        if (!atteint[l * COLONNES + c]) continue;
        const p = centre(c, l);
        const distance = Math.hypot(p.x - eglise.x, p.y - eglise.y) / CASE;
        if (distance < minCases) continue;
        const t = terrainDeCase(m, c, l);
        if (!condition(c, l, t)) continue;
        const s = score(c, l, distance);
        if (s <= meilleurScore) continue;
        if (!segmentSurTerre(m, eglise, p)) continue;
        meilleurScore = s;
        meilleure = p;
      }
    }
    return meilleure;
  };

  // Le port : sur le sable, contre l'eau, au plus pres de l'eglise.
  const port = chercher(5, (c, l, t) => t === "sable" && toucheLEau(c, l), (_c, _l, d) => -d);
  if (!port) return false;
  const g = 6;
  const gx = distanceALEau(m, port.x + g, port.y) - distanceALEau(m, port.x - g, port.y);
  const gy = distanceALEau(m, port.x, port.y + g) - distanceALEau(m, port.x, port.y - g);
  const n = Math.hypot(gx, gy) || 1;
  m.port = { x: port.x, y: port.y, versLeLarge: { x: -gx / n, y: -gy / n } };

  // La plage : du sable au bord de l'eau, a l'ecart du port.
  const plage = chercher(
    5,
    (c, l, t) => t === "sable" && toucheLEau(c, l) && Math.hypot(centre(c, l).x - port.x, centre(c, l).y - port.y) >= 110,
    (_c, _l, d) => -d,
  );
  if (!plage) return false;

  // La mine : au pied de la roche.
  const mine = chercher(5, (c, l) => toucheLaRoche(c, l), (_c, _l, d) => -d);
  if (!mine) return false;

  // La foret : dans les arbres, avec des arbres tout autour.
  const foret = chercher(5, (c, l, t) => t === "sous-bois" && arbresAutour(c, l) >= 5, (_c, _l, d) => -d);
  if (!foret) return false;

  // Les champs : en terrain ouvert, entre huit et douze cases de l'eglise — le
  // ble se paie en risque (§4.18).
  const champs = chercher(
    8,
    (_c, _l, t) => t === "herbe",
    (c, l, d) => (d > 12 ? -1e9 : herbeAutour(c, l, 3) * 2 - d),
  );
  if (!champs) return false;

  m.postes = [
    { id: "plage", nom: "La plage", metier: "pecheur", position: plage },
    { id: "mine", nom: "La mine", metier: "mineur", position: mine },
    { id: "foret", nom: "La foret", metier: "bucheron", position: foret },
    { id: "champs", nom: "Les champs", metier: "fermier", position: champs },
  ];
  return true;
}

/** A combien de pixels du bord on parait. Le meme 24 qu'avant. */
const MARGE_D_APPARITION = 24;

/**
 * Les points du bord ou l'on peut paraitre, par cote : le centre de chaque
 * case de la premiere rangee qui est de la terre ferme reliee au village. Un
 * bord sans aucune n'est pas un front.
 */
export function releverLesBords(m: Monde, atteint: Uint8Array): Record<Cote, Point[]> {
  const bords: Record<Cote, Point[]> = { nord: [], est: [], sud: [], ouest: [] };
  const COLONNES = colonnesDe(m);
  const LIGNES = lignesDe(m);
  const marge = MARGE_D_APPARITION;
  // Le centre d'une case, ramene dans la carte : la derniere colonne deborde
  // du monde (2000 n'est pas un multiple de 32).
  const dansLaCarte = (v: number, max: number) => Math.min(max - 16 - marge, Math.max(16 + marge, v));
  // Le point est a 40 px du bord : c'est la case **de ce point** qui doit
  // etre reliee au village, pas la toute premiere rangee.
  const relie = (x: number, y: number) => atteint[Math.floor(y / CASE) * COLONNES + Math.floor(x / CASE)] === 1;
  const haut = 16 + marge;
  const bas = m.hauteur - 16 - marge;
  const gauche = 16 + marge;
  const droite = m.largeur - 16 - marge;
  for (let c = 0; c < COLONNES; c++) {
    const x = dansLaCarte(c * CASE + CASE / 2, m.largeur);
    if (relie(x, haut) && estTerreFermeDans(m, x, haut)) bords.nord.push({ x, y: haut });
    if (relie(x, bas) && estTerreFermeDans(m, x, bas)) bords.sud.push({ x, y: bas });
  }
  for (let l = 0; l < LIGNES; l++) {
    const y = dansLaCarte(l * CASE + CASE / 2, m.hauteur);
    if (relie(gauche, y) && estTerreFermeDans(m, gauche, y)) bords.ouest.push({ x: gauche, y });
    if (relie(droite, y) && estTerreFermeDans(m, droite, y)) bords.est.push({ x: droite, y });
  }
  return bords;
}

/** Jusqu'ou, depuis un bord, une lisiere compte encore comme « de ce cote » : un tiers de la carte. */
const PROFONDEUR_DE_LISIERE = 1 / 3;

/**
 * Les lisieres : pour chaque cote, la premiere terre ferme reliee au village
 * qu'on rencontre depuis ce bord, rangee par rangee — la plage a l'ouest du
 * classique, le pied des eboulis au sud. C'est la que paraissent les
 * survivants (§4.18) : « quelque part a l'ouest » peut etre au bord de l'eau,
 * la ou aucun monstre ne vient. Une lisiere trop loin du bord (plus d'un tiers
 * de la carte) n'est plus de ce cote : on ne la garde pas.
 */
export function releverLesLisieres(m: Monde, atteint: Uint8Array): Record<Cote, Point[]> {
  const lisieres: Record<Cote, Point[]> = { nord: [], est: [], sud: [], ouest: [] };
  const COLONNES = colonnesDe(m);
  const LIGNES = lignesDe(m);
  // Le centre de la case, ramene dans la carte sans changer de case : la
  // derniere colonne deborde du monde.
  const centre = (c: number, l: number): Point => ({
    x: Math.min(m.largeur - 16, Math.max(16, c * CASE + CASE / 2)),
    y: Math.min(m.hauteur - 16, Math.max(16, l * CASE + CASE / 2)),
  });
  const maxLignes = Math.floor(LIGNES * PROFONDEUR_DE_LISIERE);
  const maxColonnes = Math.floor(COLONNES * PROFONDEUR_DE_LISIERE);
  for (let c = 0; c < COLONNES; c++) {
    for (let l = 0; l < maxLignes; l++) {
      if (atteint[l * COLONNES + c]) {
        lisieres.nord.push(centre(c, l));
        break;
      }
    }
    for (let l = LIGNES - 1; l >= LIGNES - maxLignes; l--) {
      if (atteint[l * COLONNES + c]) {
        lisieres.sud.push(centre(c, l));
        break;
      }
    }
  }
  for (let l = 0; l < LIGNES; l++) {
    for (let c = 0; c < maxColonnes; c++) {
      if (atteint[l * COLONNES + c]) {
        lisieres.ouest.push(centre(c, l));
        break;
      }
    }
    for (let c = COLONNES - 1; c >= COLONNES - maxColonnes; c--) {
      if (atteint[l * COLONNES + c]) {
        lisieres.est.push(centre(c, l));
        break;
      }
    }
  }
  return lisieres;
}

/** Un point de lisiere d'un cote, pour un tirage dans [0, 1) ; null si ce cote n'en a pas. */
export function pointDeLisiere(m: Monde, cote: Cote, tirage: number): Point | null {
  const points = m.lisieres[cote];
  if (points.length === 0) return null;
  const i = Math.min(points.length - 1, Math.floor(Math.max(0, tirage) * points.length));
  return { ...points[i]! };
}

/**
 * Un point d'apparition sur un bord, pour un tirage dans [0, 1) : on choisit
 * la case par le tirage, et on glisse dedans avec ce qui reste — deux monstres
 * ne surgissent pas pile au meme pixel. Un bord vide rend le premier front.
 */
export function pointDuBord(m: Monde, cote: Cote, tirage: number): Point {
  let points = m.bords[cote];
  if (points.length === 0) {
    const repli = m.fronts.find((f) => m.bords[f].length > 0);
    points = repli ? m.bords[repli] : [{ x: m.largeur / 2, y: 16 + MARGE_D_APPARITION }];
  }
  const t = Math.min(0.999999, Math.max(0, tirage)) * points.length;
  const i = Math.floor(t);
  const reste = t - i - 0.5;
  const p = points[i]!;
  const horizontal = cote === "nord" || cote === "sud";
  const marge = 16 + MARGE_D_APPARITION;
  const glisse = horizontal
    ? { x: Math.min(m.largeur - marge, Math.max(marge, p.x + reste * (CASE - 8))), y: p.y }
    : { x: p.x, y: Math.min(m.hauteur - marge, Math.max(marge, p.y + reste * (CASE - 8))) };
  // Le glissement peut mordre sur l'eau au bord d'une case : on reste alors au point sur.
  return estTerreFermeDans(m, glisse.x, glisse.y) ? glisse : { ...p };
}

/** Une graine de monde neuve, tiree de l'horloge. Jamais zero : zero est le monde classique. */
export function graineDeMonde(maintenant: number = Date.now()): number {
  return (maintenant % 999_999) + 1;
}

/** Ce qu'on peut dire d'un monde en une ligne, pour la console et le journal. */
export function decrireLeMonde(m: Monde): string {
  const mer = m.mer ? `mer ${m.mer.cote}` : "pas de mer";
  const relief = m.montagne ? `chaine ${m.montagne.cote}` : m.massifs.length > 0 ? (m.massifs[0]!.rx >= 150 ? "massif" : "piton") : "pas de relief";
  const lacs = m.lacs.length > 0 ? `${m.lacs.length} lac` : "pas de lac";
  return `graine ${m.graine} : ${mer}, ${relief}, ${lacs}, ${m.bois.length} bois, fronts ${m.fronts.join("+")}, village en ${Math.round(m.village.x)},${Math.round(m.village.y)}`;
}
