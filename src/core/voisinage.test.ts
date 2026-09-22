import { describe, expect, it } from "vitest";
import { Rng } from "./rng";
import { COTE_VOISINAGE, distanceAuSegment, Emprises, Voisinage } from "./voisinage";

/**
 * Le voisinage de la horde (§4.33, palier 1).
 *
 * La grille remplace des parcours de toute la horde : elle doit rendre
 * **exactement** ce qu'ils rendaient — le meme ensemble, dans le meme ordre, avec
 * la meme regle aux bords. Chaque recherche est donc comparee a un parcours
 * brut, sur des nuages tires au sort.
 */

const LARGEUR = 3464;
const HAUTEUR = 2598;

/** Un nuage de points, dont une part hors du monde et une part empilee au meme endroit. */
function nuage(graine: number, n: number): { xs: Float32Array; ys: Float32Array } {
  const rng = new Rng(graine);
  const xs = new Float32Array(n);
  const ys = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const sorte = rng.next();
    if (sorte < 0.05) {
      // Hors du monde : un monstre pousse au-dela du bord existe encore.
      xs[i] = rng.range(-200, LARGEUR + 200);
      ys[i] = rng.next() < 0.5 ? -50 : HAUTEUR + 50;
    } else if (sorte < 0.25) {
      // Une melee : beaucoup de monde sur peu de place, comme au pied d'un mur.
      xs[i] = 1500 + rng.range(-40, 40);
      ys[i] = 1200 + rng.range(-40, 40);
    } else {
      xs[i] = rng.range(0, LARGEUR);
      ys[i] = rng.range(0, HAUTEUR);
    }
  }
  return { xs, ys };
}

function lire(v: { trouve(k: number): number }, n: number): number[] {
  const r: number[] = [];
  for (let k = 0; k < n; k++) r.push(v.trouve(k));
  return r;
}

describe("Le voisinage — des points", () => {
  it("rend, autour d'un point, exactement ce que rend le parcours brut, dans l'ordre de la liste", () => {
    const { xs, ys } = nuage(7, 3000);
    const v = new Voisinage(LARGEUR, HAUTEUR);
    v.ranger(xs.length, xs, ys);
    const rng = new Rng(11);
    for (let q = 0; q < 300; q++) {
      const x = rng.range(-100, LARGEUR + 100);
      const y = rng.range(-100, HAUTEUR + 100);
      const rayon = rng.range(0, 500);
      const attendu: number[] = [];
      for (let i = 0; i < xs.length; i++) {
        if (Math.hypot(xs[i]! - x, ys[i]! - y) <= rayon) attendu.push(i);
      }
      expect(lire(v, v.autour(x, y, rayon))).toEqual(attendu);
    }
  });

  it("garde le bord du disque : a la distance exacte, on est dedans", () => {
    const v = new Voisinage(LARGEUR, HAUTEUR);
    v.ranger(2, [100, 164], [100, 100]);
    expect(lire(v, v.autour(100, 100, 64))).toEqual([0, 1]);
    expect(lire(v, v.autour(100, 100, 63.9))).toEqual([0]);
  });

  it("rend le plus proche comme l'ancien parcours : strictement sous la portee, le premier a distance egale", () => {
    const { xs, ys } = nuage(19, 2000);
    const v = new Voisinage(LARGEUR, HAUTEUR);
    v.ranger(xs.length, xs, ys);
    const rng = new Rng(23);
    for (let q = 0; q < 400; q++) {
      const x = rng.range(0, LARGEUR);
      const y = rng.range(0, HAUTEUR);
      const portee = rng.range(1, 900);
      let attendu = -1;
      let meilleure = portee;
      for (let i = 0; i < xs.length; i++) {
        const d = Math.hypot(xs[i]! - x, ys[i]! - y);
        if (d < meilleure) {
          meilleure = d;
          attendu = i;
        }
      }
      expect(v.laPlusProche(x, y, portee)).toBe(attendu);
    }
  });

  it("departage deux voisins a egale distance par l'ordre de la liste, quel que soit l'ordre des cellules", () => {
    // Deux points a 100 px de part et d'autre de x = 800, dans deux cellules : la
    // grille visite la colonne de gauche d'abord.
    const v = new Voisinage(LARGEUR, HAUTEUR);
    // Le premier de la liste est a droite, donc visite en second : il doit gagner quand meme.
    v.ranger(3, [900, 700, 800], [500, 500, 500]);
    expect(v.laPlusProche(800, 500, 400, (i) => i !== 2)).toBe(0);
    // Le premier de la liste est a gauche, visite d'abord : il garde sa place.
    v.ranger(3, [700, 900, 800], [500, 500, 500]);
    expect(v.laPlusProche(800, 500, 400, (i) => i !== 2)).toBe(0);
    // A la portee exacte, on n'est pas « a moins de ».
    expect(v.laPlusProche(800, 500, 100, (i) => i !== 2)).toBe(-1);
    expect(v.laPlusProche(800, 500, 0)).toBe(-1);
  });

  it("filtre sans perdre le suivant : un monstre mort ne cache pas celui de derriere", () => {
    const v = new Voisinage(LARGEUR, HAUTEUR);
    v.ranger(3, [100, 110, 300], [100, 100, 100]);
    const vivant = (i: number) => i !== 0 && i !== 1;
    expect(v.laPlusProche(100, 100, 1000, vivant)).toBe(2);
    expect(v.combien(100, 100, 50)).toBe(2);
    expect(v.combien(100, 100, 50, vivant)).toBe(0);
  });

  it("ne perd rien de ce qui deborde du monde : c'est range au bord", () => {
    const v = new Voisinage(LARGEUR, HAUTEUR);
    v.ranger(2, [-80, LARGEUR + 80], [-80, HAUTEUR + 80]);
    expect(lire(v, v.rechercher(-100, -100, 10, 10))).toEqual([0]);
    expect(v.laPlusProche(0, 0, 200)).toBe(0);
    expect(v.laPlusProche(LARGEUR, HAUTEUR, 200)).toBe(1);
  });

  it("se reconstruit d'une image a l'autre, et grandit sans rien perdre", () => {
    const v = new Voisinage(LARGEUR, HAUTEUR);
    v.ranger(1, [10], [10]);
    expect(v.taille).toBe(1);
    const { xs, ys } = nuage(31, 25000);
    v.ranger(xs.length, xs, ys);
    expect(v.taille).toBe(25000);
    let total = 0;
    total += v.rechercher(-1, -1, LARGEUR + 1, HAUTEUR + 1);
    expect(total).toBe(25000);
    v.ranger(0, [], []);
    expect(v.rechercher(-1, -1, LARGEUR + 1, HAUTEUR + 1)).toBe(0);
    expect(v.laPlusProche(10, 10, 1000)).toBe(-1);
  });

  it("rend la position du moment ou elle a range", () => {
    const xs = new Float32Array([12, 34]);
    const ys = new Float32Array([56, 78]);
    const v = new Voisinage(LARGEUR, HAUTEUR);
    v.ranger(2, xs, ys);
    xs[0] = 999;
    expect(v.x(0)).toBe(12);
    expect(v.y(1)).toBe(78);
  });

  it("marque large autour d'un heros : tout point du disque est marque, rien de tres loin ne l'est", () => {
    const v = new Voisinage(LARGEUR, HAUTEUR);
    v.effacerLesMarques();
    v.marquer(1000, 1000, 340);
    const rng = new Rng(53);
    for (let q = 0; q < 2000; q++) {
      const angle = rng.range(0, Math.PI * 2);
      const r = rng.range(0, 340);
      expect(v.estMarque(1000 + Math.cos(angle) * r, 1000 + Math.sin(angle) * r)).toBe(true);
    }
    // Au-dela du disque et d'une cellule entiere de marge, plus rien.
    expect(v.estMarque(1000 + 340 + 2 * 64, 1000)).toBe(false);
    expect(v.estMarque(1000, 1000 - 340 - 2 * 64)).toBe(false);
    // Effacer oublie tout.
    v.effacerLesMarques();
    expect(v.estMarque(1000, 1000)).toBe(false);
  });

  it("decoupe le monde en cellules de deux cases", () => {
    expect(COTE_VOISINAGE).toBe(64);
    expect(new Voisinage(LARGEUR, HAUTEUR).cote).toBe(64);
  });
});

describe("Les emprises — des rectangles", () => {
  /** Des rectangles de une case a l'eglise, dont certains a cheval sur plusieurs cellules. */
  function rectangles(graine: number, n: number) {
    const rng = new Rng(graine);
    const x0 = new Float32Array(n);
    const y0 = new Float32Array(n);
    const x1 = new Float32Array(n);
    const y1 = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const w = rng.next() < 0.1 ? rng.range(64, 200) : 32;
      const h = rng.next() < 0.1 ? rng.range(64, 200) : 32;
      x0[i] = rng.range(0, LARGEUR - w);
      y0[i] = rng.range(0, HAUTEUR - h);
      x1[i] = x0[i]! + w;
      y1[i] = y0[i]! + h;
    }
    return { x0, y0, x1, y1 };
  }

  it("rend tout rectangle qui recoupe la recherche, et chacun une seule fois", () => {
    const r = rectangles(41, 400);
    const e = new Emprises(LARGEUR, HAUTEUR);
    e.ranger(400, r.x0, r.y0, r.x1, r.y1);
    const rng = new Rng(43);
    for (let q = 0; q < 300; q++) {
      const qx = rng.range(0, LARGEUR);
      const qy = rng.range(0, HAUTEUR);
      const qw = rng.range(4, 120);
      const qh = rng.range(4, 120);
      const trouves = lire(e, e.rechercher(qx, qy, qx + qw, qy + qh));
      // Sans doublon, et trie.
      expect(new Set(trouves).size).toBe(trouves.length);
      expect([...trouves].sort((a, b) => a - b)).toEqual(trouves);
      // Tout ce qui recoupe vraiment y est : la grille peut rendre plus, jamais moins.
      for (let i = 0; i < 400; i++) {
        const recoupe = r.x0[i]! <= qx + qw && r.x1[i]! >= qx && r.y0[i]! <= qy + qh && r.y1[i]! >= qy;
        if (recoupe) expect(trouves).toContain(i);
      }
    }
  });

  it("ne rend un grand batiment qu'une fois, meme quand on le touche par quatre cellules", () => {
    const e = new Emprises(LARGEUR, HAUTEUR);
    // L'eglise : une emprise qui couvre plusieurs cellules.
    e.ranger(2, [600, 1000], [600, 1000], [760, 1032], [760, 1032]);
    expect(lire(e, e.rechercher(590, 590, 770, 770))).toEqual([0]);
    expect(lire(e, e.rechercher(590, 590, 770, 770))).toEqual([0]);
  });

  it("oublie ce qui a disparu d'une reconstruction a l'autre", () => {
    const e = new Emprises(LARGEUR, HAUTEUR);
    e.ranger(2, [100, 300], [100, 100], [132, 332], [132, 132]);
    expect(e.rechercher(90, 90, 340, 140)).toBe(2);
    e.ranger(1, [300], [100], [332], [132]);
    expect(lire(e, e.rechercher(90, 90, 340, 140))).toEqual([0]);
    expect(e.taille).toBe(1);
  });
});

describe("Les frappes en ligne — juste devant", () => {
  it("mesure au trait : sur le segment, a cote, et au bout", () => {
    // Un trait de (0, 0) a (100, 0).
    expect(distanceAuSegment(50, 0, 0, 0, 100, 0)).toBe(0);
    expect(distanceAuSegment(50, 30, 0, 0, 100, 0)).toBe(30);
    expect(distanceAuSegment(130, 40, 0, 0, 100, 0)).toBe(50);
  });

  it("ne touche plus derriere le heros ni au-dela du bout, meme sur la droite", () => {
    // Le bug : sur la droite du trait mais derriere son depart, la droite
    // infinie disait zero ; le segment dit la distance au depart.
    expect(distanceAuSegment(-300, 0, 0, 0, 100, 0)).toBe(300);
    expect(distanceAuSegment(2000, 0, 0, 0, 100, 0)).toBe(1900);
  });

  it("tient un trait de longueur nulle : c'est la distance au point", () => {
    expect(distanceAuSegment(3, 4, 0, 0, 0, 0)).toBe(5);
  });
});
