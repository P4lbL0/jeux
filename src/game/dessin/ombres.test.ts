import { describe, expect, it } from "vitest";
import {
  FORCES,
  MARGE_D_OMBRE,
  fabriquerLOmbre,
  opaciteDOmbre,
  peindreDesOmbresDansLeSol,
  pixelsDeLOmbre,
  reglageDOmbre,
  type OmbreFabriquee,
  type ReglageDOmbre,
} from "./ombres";

/** Un sprite fait d'un rectangle plein, dans un cadre vide. */
function boite(largeur: number, hauteur: number, x0: number, y0: number, x1: number, y1: number): Uint8Array {
  const alpha = new Uint8Array(largeur * hauteur);
  for (let y = y0; y < y1; y += 1) for (let x = x0; x < x1; x += 1) alpha[y * largeur + x] = 255;
  return alpha;
}

/** La force de l'ombre en un point du sprite (coordonnees du sprite, pas du cadre elargi). */
function force(o: OmbreFabriquee, x: number, y: number): number {
  return o.force[(y + o.marge) * o.largeur + x + o.marge]!;
}

const SANS: ReglageDOmbre = { portee: 0, mare: null, voisinSud: false };

describe("Ombres — ce que chaque sprite jette (§4.30)", () => {
  it("rien pour ce qui est a plat ou sur l'eau, une mare sous les arbres, une ombre portee pour l'enceinte", () => {
    expect(reglageDOmbre("bati-douve-eau-5")).toBeNull();
    expect(reglageDOmbre("bati-champ-jeune")).toBeNull();
    expect(reglageDOmbre("bati-navire")).toBeNull();
    expect(reglageDOmbre("heros-guerrier")).toBeNull();
    // Les sprites Blender ont deja leur ombre portee : contact et halo seulement.
    expect(reglageDOmbre("bati-maison-0")).toEqual(SANS);
    expect(reglageDOmbre("decor-rocher-1")).toEqual(SANS);
    expect(reglageDOmbre("decor-arbre-2")?.mare?.part).toBe(1);
    expect(reglageDOmbre("decor-conifere-0")?.mare?.part).toBe(1);
    expect(reglageDOmbre("decor-arbre-mort-3")?.mare?.part).toBe(0.6);
    // Ce que le code dessine : une boite de sa hauteur.
    expect(reglageDOmbre("bati-mur-bois-0")).toEqual({ portee: 14, mare: null, voisinSud: false });
    expect(reglageDOmbre("bati-mur-pierre-5")?.voisinSud).toBe(true); // nord + sud
    expect(reglageDOmbre("bati-mur-fer-10")?.voisinSud).toBe(false); // est + ouest
    expect(reglageDOmbre("bati-tour")?.portee).toBeGreaterThan(reglageDOmbre("bati-mur-pierre-0")!.portee);
    expect(reglageDOmbre("bati-porte-bois-nord-sud-fermee")?.voisinSud).toBe(true);
    expect(reglageDOmbre("bati-pont-levis-fer-est-ouest-ouverte")?.portee).toBe(16);
  });

  it("un sprite vide ne jette rien", () => {
    const o = fabriquerLOmbre(new Uint8Array(20 * 20), 20, 20, SANS);
    expect(o.vide).toBe(true);
  });

  it("l'ombre que Blender met dans son sprite (30 %) ne fait pas partie de la silhouette", () => {
    const alpha = new Uint8Array(20 * 20).fill(76);
    expect(fabriquerLOmbre(alpha, 20, 20, SANS).vide).toBe(true);
  });

  it("le contact est au pied : plus sombre en bas de la silhouette qu'en haut, jamais au-dela du plafond", () => {
    const o = fabriquerLOmbre(boite(20, 30, 5, 4, 15, 26), 20, 30, SANS);
    expect(o.largeur).toBe(20 + 2 * MARGE_D_OMBRE);
    expect(force(o, 10, 26)).toBeGreaterThan(force(o, 10, 2) + 0.15);
    expect(force(o, 10, 25)).toBeGreaterThan(FORCES.contact * 0.8);
    for (const f of o.force) expect(f).toBeLessThanOrEqual(FORCES.plafond);
  });

  it("l'ombre portee part vers l'est et un peu vers le nord, jamais vers le sud-ouest", () => {
    const reglage: ReglageDOmbre = { portee: 14, mare: null, voisinSud: false };
    const avec = fabriquerLOmbre(boite(32, 50, 8, 20, 24, 48), 32, 50, reglage);
    const sans = fabriquerLOmbre(boite(32, 50, 8, 20, 24, 48), 32, 50, SANS);
    // A l'est du bord, a mi-hauteur de la face : l'ombre portee y est.
    expect(force(avec, 27, 44) - force(sans, 27, 44)).toBeCloseTo(FORCES.portee, 5);
    // A l'ouest, a la meme distance : rien de plus que le halo.
    expect(force(avec, 4, 44)).toBeCloseTo(force(sans, 4, 44), 5);
    // Sous le pied, au sud : rien de plus non plus.
    expect(force(avec, 16, 52)).toBeCloseTo(force(sans, 16, 52), 5);
  });

  it("une voisine au sud : l'ombre de la face s'arrete avant sa bande, pour ne pas la doubler", () => {
    const seul = fabriquerLOmbre(boite(32, 50, 10, 20, 22, 48), 32, 50, { portee: 14, mare: null, voisinSud: false });
    const suivi = fabriquerLOmbre(boite(32, 50, 10, 20, 22, 48), 32, 50, { portee: 14, mare: null, voisinSud: true });
    // Juste a l'est du pied de la face : la voisine du sud y jette deja la sienne.
    expect(force(seul, 24, 45) - force(suivi, 24, 45)).toBeCloseTo(FORCES.portee, 5);
    // Plus au nord, l'ombre du dessus reste.
    expect(force(suivi, 26, 30) - force(fabriquerLOmbre(boite(32, 50, 10, 20, 22, 48), 32, 50, SANS), 26, 30)).toBeCloseTo(
      FORCES.portee,
      5,
    );
  });

  it("la mare d'un arbre tombe sous son pied, un peu a l'est", () => {
    const alpha = boite(40, 46, 18, 20, 22, 43);
    const o = fabriquerLOmbre(alpha, 40, 46, { portee: 0, mare: { rx: 11, ry: 5, part: 1 }, voisinSud: false }, 43);
    const nu = fabriquerLOmbre(alpha, 40, 46, SANS, 43);
    expect(force(o, 30, 42) - force(nu, 30, 42)).toBeGreaterThan(0.08);
    expect(force(o, 30, 30)).toBeCloseTo(force(nu, 30, 30), 5);
  });
});

describe("Ombres — les marches", () => {
  it("une force qui tombe sur une marche reste unie : l'ombre portee est un aplat, comme celle d'une maison", () => {
    for (let i = 0; i < 300; i += 1) expect(opaciteDOmbre(FORCES.portee, i * 7, i * 3)).toBeCloseTo(0.3, 6);
    expect(opaciteDOmbre(0, 5, 5)).toBe(0);
  });

  it("entre deux marches, le grain les melange dans la bonne proportion", () => {
    let somme = 0;
    const n = 4000;
    for (let i = 0; i < n; i += 1) {
      const a = opaciteDOmbre(0.137, i % 71, Math.floor(i / 71));
      expect([0.1, 0.2].some((m) => Math.abs(a - m) < 1e-9)).toBe(true);
      somme += a;
    }
    expect(somme / n).toBeGreaterThan(0.12);
    expect(somme / n).toBeLessThan(0.155);
  });

  it("une texture d'ombre est du fer, transparent la ou il n'y a rien", () => {
    const o = fabriquerLOmbre(boite(20, 30, 5, 4, 15, 26), 20, 30, SANS);
    const pixels = pixelsDeLOmbre(o);
    expect(pixels[3]).toBe(0);
    const pied = ((26 + o.marge) * o.largeur + 10 + o.marge) * 4;
    expect(pixels[pied + 3]).toBeGreaterThan(50);
  });
});

describe("Ombres — peintes dans le sol", () => {
  const o = fabriquerLOmbre(boite(20, 30, 5, 4, 15, 26), 20, 30, SANS);
  const sol = () => new Uint8ClampedArray(64 * 64 * 4).fill(200);

  it("assombrit sous l'ombre et ne touche pas ailleurs", () => {
    const pixels = sol();
    peindreDesOmbresDansLeSol(pixels, 64, 64, 100, 100, [{ x0: 100, y0: 100, ombre: o, miroir: false }]);
    const pied = ((26 + o.marge) * 64 + 10 + o.marge) * 4;
    expect(pixels[pied]).toBeLessThan(170);
    expect(pixels[(63 * 64 + 63) * 4]).toBe(200);
  });

  it("deux ombres superposees ne s'additionnent pas : la foret ne devient pas un trou noir", () => {
    const une = sol();
    const deux = sol();
    const pose = { x0: 100, y0: 100, ombre: o, miroir: false };
    peindreDesOmbresDansLeSol(une, 64, 64, 100, 100, [pose]);
    peindreDesOmbresDansLeSol(deux, 64, 64, 100, 100, [pose, { ...pose }]);
    expect(deux).toEqual(une);
  });

  it("une ombre a cheval sur deux morceaux donne les memes pixels que d'un bloc", () => {
    const bloc = new Uint8ClampedArray(128 * 64 * 4).fill(200);
    const pose = { x0: 40, y0: 10, ombre: o, miroir: true };
    peindreDesOmbresDansLeSol(bloc, 128, 64, 0, 0, [pose]);
    const gauche = new Uint8ClampedArray(64 * 64 * 4).fill(200);
    const droite = new Uint8ClampedArray(64 * 64 * 4).fill(200);
    peindreDesOmbresDansLeSol(gauche, 64, 64, 0, 0, [pose]);
    peindreDesOmbresDansLeSol(droite, 64, 64, 64, 0, [pose]);
    for (let y = 0; y < 64; y += 1) {
      for (let x = 0; x < 128; x += 1) {
        const morceau = x < 64 ? gauche : droite;
        const k = (y * 64 + (x % 64)) * 4;
        expect(morceau[k]).toBe(bloc[(y * 128 + x) * 4]);
      }
    }
  });
});
