/**
 * Les caches de la route : ce qu'on gagne a ne pas aller tout droit
 * (DESIGN.md §4.31, jalon 5.6 — tranche le 21 septembre 2026).
 *
 * Elles naissent d'un defaut que le jalon 5.5 a **cree** : depuis que refuser
 * un village fait traverser un, puis trois, puis sept mondes muets, l'errance
 * dispose d'un grand espace vide. Sans rien dedans, le chemin optimal est la
 * ligne droite, et l'errance devient un couloir qu'on subit.
 *
 * Le principe du §4.31 tient en une phrase : **le monde existait avant toi, et
 * il en reste des choses**. Ce qu'on trouve ne se voit pas de loin, ne se
 * marque pas sur une carte, et ne se ramasse pas toujours sans se battre.
 *
 * Ce fichier ne connait pas Phaser. Il **seme** et il **chiffre** :
 *
 * 1. **Ou elles sont** (`semerLesCaches`) : tire de la graine du monde, donc
 *    deux parties sur la meme graine trouvent les memes, au pixel pres.
 * 2. **Ce qu'elles rendent** (`butinDUneCache`) : de l'or, qui reste d'un monde
 *    a l'autre, et des ressources, qui deviennent les reserves du jour ou l'on
 *    s'installe.
 * 3. **Ce qui les garde** (`garde`) : rien sur une petite, un camp de betes sur
 *    une grosse — visible de loin, parce que c'est lui qui fait du detour un
 *    pari et non un ramassage.
 *
 * ⚠️ **Jamais dans une partie installee** (§4.31, point 4). La restauration du
 * village (jalon 8) est le systeme qui recompense l'exploration une fois qu'on
 * a un village ; deux systemes pour la meme chose, ce serait un de trop.
 */

import { type Monde, type Point } from "./carte";
import { stocksVides, type Stocks } from "./habitants";
import { estTerreFermeDans } from "./monde";
import type { Rng } from "./rng";

// ---------------------------------------------------------------- les reglages

/**
 * **La table de reglages des trouvailles.** Comme celles du cycle, du port et
 * des survivants, c'est le seul endroit a toucher pour re-regler tout le bloc —
 * et c'est ce qui se trancherait en jouant (§6).
 */
export const REGLAGES_CACHES = {
  /**
   * Combien de caches par **million de pixels de carte**, dans un monde muet.
   *
   * ⚠️ **Par megapixel, et pas un nombre absolu** : c'est la regle 1 du §4.17,
   * la meme que le decor depuis le 20 septembre. Agrandir le monde ne doit pas
   * le vider.
   *
   * Le chiffre vient d'un calcul, pas d'un gout. Une traversee en ligne droite
   * fait environ 3 000 px de long sur 800 px de large vus par le heros, soit le
   * quart d'une carte de neuf megapixels. A 0,8 par megapixel — sept caches sur
   * la zone ×3 — un joueur qui va tout droit en croise une ou deux, et un
   * joueur qui s'ecarte en trouve cinq ou six. C'est exactement l'ecart que le
   * §4.31 cherche a creer.
   */
  parMegapixelMuet: 0.8,
  /**
   * Dans un monde **habite**, plus rare (§4.31, point 4) : le village est deja
   * une raison d'y aller.
   */
  parMegapixelHabite: 0.3,
  /**
   * Le plafond dur, quelle que soit la taille de la carte (§4.17, regle 1).
   *
   * Sans lui, une zone deux fois plus grande un jour donnerait vingt-cinq
   * caches, et la route redeviendrait un tapis de ramassage.
   */
  plafond: 12,

  /**
   * La part de **grosses** caches — celles qu'un camp de betes garde.
   *
   * Une sur quatre : deux par monde muet. Le §4.31 explique pourquoi on ne
   * garde pas tout — un heros seul au debut du jeu ne peut pas se permettre
   * beaucoup de combats evitables, et si chaque trouvaille demandait de se
   * battre, le joueur finirait par toutes les ignorer.
   */
  partDeGrosses: 0.25,

  /** Ce qu'une petite cache rend en pieces, quand elle rend de l'or */
  orPetite: { min: 10, max: 24 },
  /** Ce qu'une grosse rend en pieces — elle en rend **toujours** */
  orGrosse: { min: 50, max: 110 },
  /**
   * La chance qu'une petite cache rende de l'or plutot que des ressources.
   *
   * A la moitie, les deux se rencontrent autant. L'or paie la route (il reste
   * d'un monde a l'autre), les ressources paient l'installation : ce sont deux
   * monnaies differentes, et il faut croiser les deux pour comprendre qu'elles
   * le sont.
   */
  chanceDOrPetite: 0.5,

  /**
   * La meute qui garde une grosse cache.
   *
   * ⚠️ **Petite, et c'est volontaire.** La meute d'un survivant monte a
   * quarante (§4.18) parce qu'elle est tiree a plat et qu'un sauvetage sur deux
   * doit etre infaisable. Ici, on peut **voir le camp avant de s'engager** : un
   * camp qu'on voit et qu'on juge doit etre franchissable la moitie du temps,
   * sinon on ne le juge plus, on le contourne toujours.
   */
  garde: { min: 3, max: 8 },
  /**
   * Jusqu'ou une bete de camp s'ecarte de ce qu'elle garde, en pixels.
   *
   * ⚠️ **C'est ce qui rend le detour reversible** (decision d'Angelos) : on
   * voit le camp de loin, on approche, on juge, et on peut faire demi-tour.
   * 340 px, c'est le rayon de vue du §4.6 : elles nous lachent exactement au
   * moment ou l'on cesse de les voir, ce qui est la seule frontiere que le
   * joueur puisse lire sans qu'on la lui dessine.
   */
  rayonDuCamp: 340,

  /** A quelle distance du bord de la carte, au plus pres */
  margeDuBord: 90,
  /**
   * A quelle distance du village, au plus pres.
   *
   * Le §4.31 veut recompenser **le detour**. Une cache posee sur la place du
   * village serait sur le chemin de tout le monde : elle ne recompenserait
   * rien. L'enceinte fait 150 px de rayon (`VILLAGE.rayon`) ; on se tient a
   * bonne distance de ses murs.
   */
  margeDuVillage: 300,
  /** A quelle distance les unes des autres : deux caches cote a cote n'en font qu'une */
  ecartEntreCaches: 340,
  /**
   * A quelle distance de l'endroit ou l'on parait.
   *
   * Sans elle, une cache tombait parfois sous les pieds du heros a la premiere
   * image : on ramassait avant d'avoir compris qu'on marchait.
   */
  margeDuDepart: 420,

  /** A quelle distance on peut fouiller — et a laquelle le lisere parait (§4.31, point 3) */
  portee: 46,
  /**
   * Combien de temps la fouille prend, en millisecondes (decision d'Angelos,
   * 21 septembre 2026 : « ca prend un moment »).
   *
   * ⚠️ **C'est ce qui donne sa dent au camp de betes.** Une fouille instantanee
   * se fait sous le nez d'une meute sans rien risquer, et le camp ne garde plus
   * rien. A 1,2 s, fouiller devant des betes reveillees est une decision.
   */
  dureeDeFouille: 1200,
} as const;

// ------------------------------------------------------------------ les caches

/**
 * Sa silhouette (§4.31, point 3) : **une cache a son propre dessin**.
 *
 * Elle se lit de loin sans que rien ne clignote, parce que sa forme dit qu'un
 * humain l'a laissee la. Ce qu'on refuse explicitement : une lueur visible
 * depuis l'autre bout de l'ecran — on ne raterait rien, et c'est justement le
 * probleme.
 */
export type GenreDeCache = "coffre" | "trappe" | "charrette";

/** Petite : on fouille et on repart. Grosse : un camp de betes est dessus. */
export type TailleDeCache = "petite" | "grosse";

export interface Cache {
  /** Un numero stable dans le monde : c'est lui qui dit « celle-la est fouillee » */
  id: number;
  point: Point;
  genre: GenreDeCache;
  taille: TailleDeCache;
  /** Les pieces qu'elle rend. Elles restent d'un monde a l'autre (§4.29) */
  or: number;
  /** Ce qu'elle rend en matiere : ca devient les reserves de depart (§4.31) */
  ressources: Stocks;
  /** Combien de betes la gardent. Zero sur une petite */
  garde: number;
}

/** Les trois silhouettes, dans l'ordre ou elles ont ete dessinees. */
export const GENRES_DE_CACHE: readonly GenreDeCache[] = ["coffre", "trappe", "charrette"];

/**
 * Combien de caches un monde porte.
 *
 * @param habite un monde ou quelqu'un vit encore en porte moins (§4.31)
 */
export function combienDeCaches(largeur: number, hauteur: number, habite: boolean): number {
  const r = REGLAGES_CACHES;
  const megapixels = (largeur * hauteur) / 1_000_000;
  const parMegapixel = habite ? r.parMegapixelHabite : r.parMegapixelMuet;
  return Math.min(r.plafond, Math.max(0, Math.round(megapixels * parMegapixel)));
}

/**
 * Ce qu'une cache contient.
 *
 * Une **grosse** rend toujours de l'or, et de la matiere avec : elle a coute un
 * combat, elle paie les deux monnaies. Une **petite** rend l'une ou l'autre —
 * c'est ce qui fait qu'on ne sait pas d'avance ce qu'on ouvre.
 */
export function butinDUneCache(taille: TailleDeCache, rng: Rng): { or: number; ressources: Stocks } {
  const r = REGLAGES_CACHES;
  if (taille === "grosse") {
    return {
      or: rng.int(r.orGrosse.min, r.orGrosse.max),
      ressources: lotDeRessources(rng, 2),
    };
  }
  if (rng.chance(r.chanceDOrPetite)) {
    return { or: rng.int(r.orPetite.min, r.orPetite.max), ressources: stocksVides() };
  }
  return { or: 0, ressources: lotDeRessources(rng, 1) };
}

/**
 * Un lot de matiere, d'une seule sorte.
 *
 * ⚠️ **Une seule sorte, et c'est voulu.** Un lot qui rendrait un peu de tout
 * serait un lot moyen, toujours le meme ; une trappe qui ne rend que du bois se
 * raconte (« j'ai trouve de quoi refaire la palissade »). Les quantites sont
 * calees sur ce qui se construit : douze bois font une palissade, et un village
 * de six commence avec cinquante-quatre bois.
 *
 * @param facteur 1 pour une petite cache, 2 pour une grosse
 */
function lotDeRessources(rng: Rng, facteur: number): Stocks {
  const stocks = stocksVides();
  const tirage = rng.next();
  if (tirage < 0.34) stocks.bois = rng.int(10, 22) * facteur;
  else if (tirage < 0.56) stocks.pierre = rng.int(5, 12) * facteur;
  else if (tirage < 0.78) stocks.minerai = rng.int(5, 11) * facteur;
  else if (tirage < 0.9) stocks.poisson = rng.int(4, 10) * facteur;
  else stocks.ble = rng.int(4, 10) * facteur;
  return stocks;
}

/**
 * Les caches d'un monde, semees sur la terre ferme.
 *
 * ⚠️ **Deterministe** : une meme graine rend les memes caches, au meme endroit,
 * avec le meme contenu — comme la carte (§4.6) et comme le village (§4.29).
 * C'est ce qui rend une verification au navigateur comparable d'une passe a
 * l'autre, et ce qui fait qu'un monde est un lieu et non un tirage.
 *
 * Trois refus a la pose, et ils disent tout le §4.31 :
 *
 * - **pas dans l'eau ni dans la roche** — une cache qu'on ne peut pas atteindre
 *   n'est pas une trouvaille, c'est une moquerie ;
 * - **pas au village** — il est sur le chemin de tout le monde, il ne
 *   recompense aucun detour ;
 * - **pas la ou l'on parait** — on ramasserait avant d'avoir compris qu'on
 *   marche.
 *
 * @param depart l'endroit ou le heros parait, s'il est connu
 */
export function semerLesCaches(
  monde: Monde,
  rng: Rng,
  habite: boolean,
  depart?: Point,
): Cache[] {
  const r = REGLAGES_CACHES;
  const voulues = combienDeCaches(monde.largeur, monde.hauteur, habite);
  const caches: Cache[] = [];
  // Un nombre d'essais borne, comme partout ou l'on tire une place sur le
  // terrain (`survivants.ts`, `monde.ts`) : une boucle sans borne dans un
  // tirage seede est un gel de partie qui n'arrive qu'une fois sur mille.
  const essaisMax = voulues * 60;
  for (let essai = 0; essai < essaisMax && caches.length < voulues; essai++) {
    const point = {
      x: rng.range(r.margeDuBord, monde.largeur - r.margeDuBord),
      y: rng.range(r.margeDuBord, monde.hauteur - r.margeDuBord),
    };
    if (!estTerreFermeDans(monde, point.x, point.y)) continue;
    if (distance(point, monde.village) < r.margeDuVillage) continue;
    if (depart && distance(point, depart) < r.margeDuDepart) continue;
    if (caches.some((c) => distance(point, c.point) < r.ecartEntreCaches)) continue;

    const taille: TailleDeCache = rng.chance(r.partDeGrosses) ? "grosse" : "petite";
    const butin = butinDUneCache(taille, rng);
    caches.push({
      id: caches.length,
      point,
      genre: rng.pick(GENRES_DE_CACHE),
      taille,
      or: butin.or,
      ressources: butin.ressources,
      garde: taille === "grosse" ? rng.int(r.garde.min, r.garde.max) : 0,
    });
  }
  return caches;
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// ------------------------------------------------------------- ce qu'on en dit

/** Les noms des ressources, tels que la discussion les dit (§4.10). */
const NOMS_RESSOURCE: Record<keyof Stocks, string> = {
  poisson: "poisson",
  ble: "ble",
  bois: "bois",
  minerai: "minerai",
  pierre: "pierre",
};

/**
 * Ce que la discussion annonce quand on a fini de fouiller.
 *
 * Une ligne, et elle dit **ce qu'on a pris**, pas ce que c'etait : le joueur a
 * deja vu la silhouette, il veut savoir ce qu'il emporte.
 */
export function phraseDeFouille(cache: Cache): string {
  const parts: string[] = [];
  if (cache.or > 0) parts.push(`${cache.or} pieces`);
  for (const [cle, valeur] of Object.entries(cache.ressources) as [keyof Stocks, number][]) {
    if (valeur > 0) parts.push(`${valeur} ${NOMS_RESSOURCE[cle]}`);
  }
  if (parts.length === 0) return "Vide. Quelqu'un est passe avant toi.";
  return `Tu fouilles : ${parts.join(", ")}`;
}

/** Tout ce qu'un ensemble de caches a rendu, additionne. */
export function totalDesRessources(lots: readonly Stocks[]): Stocks {
  const total = stocksVides();
  for (const lot of lots) {
    for (const cle of Object.keys(total) as (keyof Stocks)[]) total[cle] += lot[cle];
  }
  return total;
}
