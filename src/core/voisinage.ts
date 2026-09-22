/**
 * Le voisinage de la horde (DESIGN.md §4.33, palier 1 — 22 septembre 2026).
 *
 * Jusqu'ici, « le monstre le plus proche » et « les monstres dans ce rayon »
 * parcouraient **toute** la horde a chaque question — et on les pose partout :
 * l'IA de chaque heros, la menace autour de chaque habitant, chaque epee qui
 * orbite, chaque explosion. A soixante monstres, ca ne se voyait pas ; a trois
 * mille, c'est trois mille distances par question.
 *
 * La reponse est une grille uniforme : le monde decoupe en cellules carrees,
 * chaque entite rangee dans celle ou elle se tient, et une question ne regarde
 * plus que les cellules qu'elle touche. On la reconstruit **une fois par
 * image**, d'un bloc, par un tri par comptage : deux passes sur les entites,
 * une sur les cellules, aucune allocation. C'est moins cher que de suivre qui
 * change de cellule, et ca ne peut pas se desynchroniser.
 *
 * Deux structures, parce que deux choses a ranger :
 *
 * - `Voisinage` range des **points** — les monstres ;
 * - `Emprises` range des **rectangles** — ce qui ne bouge pas et arrete les
 *   corps (l'eau, la roche, les murs, les maisons, l'eglise), inscrits dans
 *   chaque cellule qu'ils touchent.
 *
 * Aucune des deux ne sait ce qu'elle range : elles rendent des **index**, et
 * c'est l'appelant qui fait le test exact et qui sait ce qu'il y a derriere.
 *
 * ⚠️ **Une recherche efface la precedente.** Les resultats vivent dans un tampon
 * interne, relu par `trouve(k)`, pour ne rien allouer par question. Qui doit
 * appeler du code qui pourrait interroger a son tour la grille — une frappe qui
 * declenche une explosion — copie d'abord ce qu'il a trouve.
 *
 * Ce fichier ne connait pas Phaser.
 */

/** Une cellule de 64 px, soit deux cases : un monstre y tient, un heros en touche quatre au plus. */
export const COTE_VOISINAGE = 64;

/** Le decoupage commun aux deux structures : combien de cellules, et ou tombe un point. */
class Decoupage {
  readonly colonnes: number;
  readonly lignes: number;

  constructor(
    largeur: number,
    hauteur: number,
    readonly cote: number,
  ) {
    this.colonnes = Math.max(1, Math.ceil(largeur / cote));
    this.lignes = Math.max(1, Math.ceil(hauteur / cote));
  }

  get cellules(): number {
    return this.colonnes * this.lignes;
  }

  /** Ce qui deborde du monde est range dans la cellule du bord : rien ne se perd. */
  colonneDe(x: number): number {
    const c = Math.floor(x / this.cote);
    return c < 0 ? 0 : c >= this.colonnes ? this.colonnes - 1 : c;
  }

  ligneDe(y: number): number {
    const l = Math.floor(y / this.cote);
    return l < 0 ? 0 : l >= this.lignes ? this.lignes - 1 : l;
  }
}

/**
 * La distance d'un point au **segment** [a, b] — pas a la droite.
 *
 * ⚠️ C'est la difference qui comptait (22 septembre 2026) : les frappes en ligne
 * mesuraient avec `Phaser.Geom.Line.GetNearestPoint`, qui projette sur la
 * **droite infinie**. Le Fauchage, la Fleche du Jugement et l'Ombre frappaient
 * donc aussi derriere le heros et au-dela de leur bout, a travers toute la
 * carte. Decision d'Angelos : « c'est juste devant ».
 */
export function distanceAuSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const longueur2 = dx * dx + dy * dy;
  if (longueur2 === 0) return Math.hypot(px - ax, py - ay);
  // La projection bornee au segment : avant le depart, c'est le depart ; apres
  // le bout, c'est le bout.
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / longueur2));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Double un tampon trop court, en gardant ce qu'il contenait. */
function agrandir<T extends Int32Array | Float32Array>(tampon: T, minimum: number): T {
  if (tampon.length >= minimum) return tampon;
  let taille = Math.max(16, tampon.length);
  while (taille < minimum) taille *= 2;
  const neuf = new (tampon.constructor as new (n: number) => T)(taille);
  neuf.set(tampon);
  return neuf;
}

/**
 * Des points ranges par cellule.
 *
 * Les index sont ceux de la liste que l'appelant a donnee a `ranger` : il garde
 * sa liste, la grille ne garde que des positions.
 */
export class Voisinage {
  private readonly decoupage: Decoupage;
  /** Pour chaque cellule, ou commencent ses entites dans `rangees` (une case de plus pour la fin). */
  private readonly debuts: Int32Array;
  private readonly curseurs: Int32Array;
  private rangees = new Int32Array(0);
  private cellulesDe = new Int32Array(0);
  private px = new Float32Array(0);
  private py = new Float32Array(0);
  private n = 0;
  private trouves = new Int32Array(64);
  /** Les cellules marquees : « un heros est dans les parages » (le niveau de detail temporel). */
  private readonly marques: Uint8Array;

  constructor(largeur: number, hauteur: number, cote = COTE_VOISINAGE) {
    this.decoupage = new Decoupage(largeur, hauteur, cote);
    this.debuts = new Int32Array(this.decoupage.cellules + 1);
    this.curseurs = new Int32Array(this.decoupage.cellules);
    this.marques = new Uint8Array(this.decoupage.cellules);
  }

  /** Efface toutes les marques : a refaire a chaque image, avant de marquer. */
  effacerLesMarques(): void {
    this.marques.fill(0);
  }

  /**
   * Marque toute cellule qui touche le disque. C'est **large** par construction :
   * une cellule marquee peut deborder du disque, jamais l'inverse — on se
   * trompe du cote ou l'on decide trop souvent, pas trop rarement.
   */
  marquer(x: number, y: number, rayon: number): void {
    const d = this.decoupage;
    const c0 = d.colonneDe(x - rayon);
    const c1 = d.colonneDe(x + rayon);
    const l0 = d.ligneDe(y - rayon);
    const l1 = d.ligneDe(y + rayon);
    const cote = d.cote;
    const r2 = rayon * rayon;
    for (let l = l0; l <= l1; l++) {
      const haut = l * cote;
      const dy = y < haut ? haut - y : y > haut + cote ? y - haut - cote : 0;
      for (let c = c0; c <= c1; c++) {
        const gauche = c * cote;
        const dx = x < gauche ? gauche - x : x > gauche + cote ? x - gauche - cote : 0;
        if (dx * dx + dy * dy <= r2) this.marques[l * d.colonnes + c] = 1;
      }
    }
  }

  /** La cellule de ce point est-elle marquee ? */
  estMarque(x: number, y: number): boolean {
    const d = this.decoupage;
    return this.marques[d.ligneDe(y) * d.colonnes + d.colonneDe(x)] === 1;
  }

  /** Combien d'entites la derniere reconstruction a rangees. */
  get taille(): number {
    return this.n;
  }

  get cote(): number {
    return this.decoupage.cote;
  }

  /** La position rangee de l'entite `i` — celle du moment de `ranger`. */
  x(i: number): number {
    return this.px[i]!;
  }

  y(i: number): number {
    return this.py[i]!;
  }

  /** Le k-ieme resultat de la derniere recherche. */
  trouve(k: number): number {
    return this.trouves[k]!;
  }

  /**
   * Range `n` entites d'apres leurs positions : un tri par comptage.
   *
   * L'ordre d'une cellule est l'ordre de la liste — c'est ce qui permet de
   * rendre les resultats dans l'ordre ou l'ancien parcours les rendait.
   */
  ranger(n: number, xs: ArrayLike<number>, ys: ArrayLike<number>): void {
    const d = this.decoupage;
    this.rangees = agrandir(this.rangees, n);
    this.cellulesDe = agrandir(this.cellulesDe, n);
    this.px = agrandir(this.px, n);
    this.py = agrandir(this.py, n);
    this.trouves = agrandir(this.trouves, n);
    const debuts = this.debuts;
    debuts.fill(0);
    for (let i = 0; i < n; i++) {
      const x = xs[i]!;
      const y = ys[i]!;
      this.px[i] = x;
      this.py[i] = y;
      const cellule = d.ligneDe(y) * d.colonnes + d.colonneDe(x);
      this.cellulesDe[i] = cellule;
      debuts[cellule + 1]! += 1;
    }
    for (let c = 1; c <= d.cellules; c++) debuts[c]! += debuts[c - 1]!;
    this.curseurs.set(debuts.subarray(0, d.cellules));
    for (let i = 0; i < n; i++) {
      const cellule = this.cellulesDe[i]!;
      this.rangees[this.curseurs[cellule]!] = i;
      this.curseurs[cellule]! += 1;
    }
    this.n = n;
  }

  /**
   * Toutes les entites rangees dans une cellule que touche le rectangle, **sans
   * test exact** : c'est l'appelant qui connait les corps.
   *
   * @returns combien il y en a ; elles se lisent par `trouve(k)`, triees par index
   */
  rechercher(x0: number, y0: number, x1: number, y1: number): number {
    const d = this.decoupage;
    const c0 = d.colonneDe(x0);
    const c1 = d.colonneDe(x1);
    const l0 = d.ligneDe(y0);
    const l1 = d.ligneDe(y1);
    let k = 0;
    for (let l = l0; l <= l1; l++) {
      const base = l * d.colonnes;
      for (let c = c0; c <= c1; c++) {
        const fin = this.debuts[base + c + 1]!;
        for (let r = this.debuts[base + c]!; r < fin; r++) this.trouves[k++] = this.rangees[r]!;
      }
    }
    // Plusieurs cellules : l'ordre de la liste se perd, on le remet.
    if (c1 > c0 || l1 > l0) this.trouves.subarray(0, k).sort();
    return k;
  }

  /**
   * Les entites a `rayon` au plus de (x, y), bord compris.
   *
   * @returns combien ; elles se lisent par `trouve(k)`, dans l'ordre de la liste
   */
  autour(x: number, y: number, rayon: number, accepte?: (i: number) => boolean): number {
    const brut = this.rechercher(x - rayon, y - rayon, x + rayon, y + rayon);
    const r2 = rayon * rayon;
    let k = 0;
    for (let j = 0; j < brut; j++) {
      const i = this.trouves[j]!;
      const dx = this.px[i]! - x;
      const dy = this.py[i]! - y;
      if (dx * dx + dy * dy > r2) continue;
      if (accepte && !accepte(i)) continue;
      this.trouves[k++] = i;
    }
    return k;
  }

  /** Combien d'entites a `rayon` au plus de (x, y). */
  combien(x: number, y: number, rayon: number, accepte?: (i: number) => boolean): number {
    return this.autour(x, y, rayon, accepte);
  }

  /**
   * L'entite la plus proche, **strictement** a moins de `portee` — la regle du
   * parcours qu'elle remplace. A distance egale, la premiere de la liste.
   *
   * @returns son index, ou -1
   */
  laPlusProche(x: number, y: number, portee: number, accepte?: (i: number) => boolean): number {
    const d = this.decoupage;
    const c0 = d.colonneDe(x - portee);
    const c1 = d.colonneDe(x + portee);
    const l0 = d.ligneDe(y - portee);
    const l1 = d.ligneDe(y + portee);
    const cote = d.cote;
    let meilleur = -1;
    let meilleure = portee * portee;
    for (let l = l0; l <= l1; l++) {
      // La distance du point a la bande de cellules : si elle depasse deja le
      // meilleur, aucune cellule de la bande ne peut faire mieux.
      const hautBande = l * cote;
      const dyBande = y < hautBande ? hautBande - y : y > hautBande + cote ? y - hautBande - cote : 0;
      if (dyBande * dyBande > meilleure) continue;
      const base = l * d.colonnes;
      for (let c = c0; c <= c1; c++) {
        const gauche = c * cote;
        const dx = x < gauche ? gauche - x : x > gauche + cote ? x - gauche - cote : 0;
        if (dx * dx + dyBande * dyBande > meilleure) continue;
        const fin = this.debuts[base + c + 1]!;
        for (let r = this.debuts[base + c]!; r < fin; r++) {
          const i = this.rangees[r]!;
          const ex = this.px[i]! - x;
          const ey = this.py[i]! - y;
          const d2 = ex * ex + ey * ey;
          if (d2 > meilleure) continue;
          // Strictement plus pres, ou aussi pres mais plus tot dans la liste.
          if (d2 === meilleure && (meilleur === -1 || i > meilleur)) continue;
          if (accepte && !accepte(i)) continue;
          meilleure = d2;
          meilleur = i;
        }
      }
    }
    return meilleur;
  }
}

/**
 * Des rectangles inscrits dans chaque cellule qu'ils touchent.
 *
 * Un rectangle a cheval sur quatre cellules y est inscrit quatre fois : une
 * recherche qui les touche toutes ne le rend pourtant qu'une fois.
 */
export class Emprises {
  private readonly decoupage: Decoupage;
  private readonly debuts: Int32Array;
  private readonly curseurs: Int32Array;
  private inscrits = new Int32Array(0);
  /** Le numero de la derniere recherche qui a rendu chaque rectangle : le dedoublonnage. */
  private tampons = new Int32Array(0);
  private recherche = 0;
  private trouves = new Int32Array(16);
  private n = 0;

  constructor(largeur: number, hauteur: number, cote = COTE_VOISINAGE) {
    this.decoupage = new Decoupage(largeur, hauteur, cote);
    this.debuts = new Int32Array(this.decoupage.cellules + 1);
    this.curseurs = new Int32Array(this.decoupage.cellules);
  }

  get taille(): number {
    return this.n;
  }

  trouve(k: number): number {
    return this.trouves[k]!;
  }

  /** Range `n` rectangles, donnes par leurs coins (x0, y0) et (x1, y1). */
  ranger(
    n: number,
    x0: ArrayLike<number>,
    y0: ArrayLike<number>,
    x1: ArrayLike<number>,
    y1: ArrayLike<number>,
  ): void {
    const d = this.decoupage;
    const debuts = this.debuts;
    debuts.fill(0);
    for (let i = 0; i < n; i++) {
      const c0 = d.colonneDe(x0[i]!);
      const c1 = d.colonneDe(x1[i]!);
      const l0 = d.ligneDe(y0[i]!);
      const l1 = d.ligneDe(y1[i]!);
      for (let l = l0; l <= l1; l++) for (let c = c0; c <= c1; c++) debuts[l * d.colonnes + c + 1]! += 1;
    }
    for (let c = 1; c <= d.cellules; c++) debuts[c]! += debuts[c - 1]!;
    this.inscrits = agrandir(this.inscrits, debuts[d.cellules]!);
    this.curseurs.set(debuts.subarray(0, d.cellules));
    for (let i = 0; i < n; i++) {
      const c0 = d.colonneDe(x0[i]!);
      const c1 = d.colonneDe(x1[i]!);
      const l0 = d.ligneDe(y0[i]!);
      const l1 = d.ligneDe(y1[i]!);
      for (let l = l0; l <= l1; l++) {
        for (let c = c0; c <= c1; c++) {
          const cellule = l * d.colonnes + c;
          this.inscrits[this.curseurs[cellule]!] = i;
          this.curseurs[cellule]! += 1;
        }
      }
    }
    if (this.tampons.length < n) {
      this.tampons = agrandir(this.tampons, n);
      this.tampons.fill(0);
      this.recherche = 0;
    }
    this.trouves = agrandir(this.trouves, n);
    this.n = n;
  }

  /**
   * Les rectangles inscrits dans une cellule que touche celui-ci — sans test
   * exact, chacun une seule fois.
   *
   * @returns combien ; ils se lisent par `trouve(k)`, tries par index
   */
  rechercher(x0: number, y0: number, x1: number, y1: number): number {
    const d = this.decoupage;
    this.recherche += 1;
    // Apres deux milliards de recherches, on remet les compteurs a zero plutot
    // que de laisser un vieux numero passer pour le courant.
    if (this.recherche === 0x7fffffff) {
      this.tampons.fill(0);
      this.recherche = 1;
    }
    const numero = this.recherche;
    const c0 = d.colonneDe(x0);
    const c1 = d.colonneDe(x1);
    const l0 = d.ligneDe(y0);
    const l1 = d.ligneDe(y1);
    let k = 0;
    for (let l = l0; l <= l1; l++) {
      const base = l * d.colonnes;
      for (let c = c0; c <= c1; c++) {
        const fin = this.debuts[base + c + 1]!;
        for (let r = this.debuts[base + c]!; r < fin; r++) {
          const i = this.inscrits[r]!;
          if (this.tampons[i] === numero) continue;
          this.tampons[i] = numero;
          this.trouves[k++] = i;
        }
      }
    }
    if (c1 > c0 || l1 > l0) this.trouves.subarray(0, k).sort();
    return k;
  }
}
