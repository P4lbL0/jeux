import { describe, expect, it } from "vitest";
import { CHEMIN, RAYON_CHEMIN, RAYON_VOISINAGE, peindreLePas, selDe, zoneDe, type Tampon } from "./chemins";
import { REGLAGES_CHEMINS, usureDe } from "../../core/chemins";

/**
 * Le peintre des chemins qui s'usent (§4.24) : un pas transparent au bord
 * tremblant, plus opaque a mesure qu'on le foule, et deux pas qui se
 * recouvrent ne font pas plus sombre.
 */

function tampon(largeur: number, hauteur: number, x0 = 0, y0 = 0): Tampon {
  return { pixels: new Uint8ClampedArray(largeur * hauteur * 4), largeur, hauteur, x0, y0 };
}

function alphaMoyen(t: Tampon): number {
  let somme = 0;
  for (let i = 3; i < t.pixels.length; i += 4) somme += t.pixels[i]!;
  return somme / (t.pixels.length / 4);
}

describe("Le peintre des chemins", () => {
  it("ne peint rien pour une usure nulle", () => {
    const t = tampon(64, 64);
    peindreLePas(t, 32, 32, 0, 5);
    expect(alphaMoyen(t)).toBe(0);
  });

  it("peint un pas rond, plein au centre, transparent loin du bord", () => {
    const t = tampon(64, 64);
    peindreLePas(t, 32, 32, 1, 5);
    const alpha = (x: number, y: number) => t.pixels[(y * 64 + x) * 4 + 3]!;
    expect(alpha(32, 32)).toBeGreaterThan(120);
    expect(alpha(2, 2)).toBe(0);
    expect(alpha(32 + RAYON_CHEMIN + 10, 32)).toBe(0);
    // La couleur posee est une des trois teintes de la matiere.
    const i = (32 * 64 + 32) * 4;
    const couleur = (t.pixels[i]! << 16) | (t.pixels[i + 1]! << 8) | t.pixels[i + 2]!;
    expect([CHEMIN.sombre, CHEMIN.corps, CHEMIN.clair]).toContain(couleur);
  });

  it("est d'autant plus opaque que l'usure est grande", () => {
    const faible = tampon(64, 64);
    const forte = tampon(64, 64);
    const r = REGLAGES_CHEMINS;
    peindreLePas(faible, 32, 32, usureDe({ passages: r.passagesVisibles, dernierJour: 1 }, 1), 5);
    peindreLePas(forte, 32, 32, usureDe({ passages: r.passagesCreuses, dernierJour: 1 }, 1), 5);
    expect(alphaMoyen(forte)).toBeGreaterThan(alphaMoyen(faible) * 1.5);
    expect(alphaMoyen(faible)).toBeGreaterThan(0);
  });

  it("deux pas qui se recouvrent ne font pas plus sombre que le plus opaque des deux", () => {
    const seul = tampon(96, 64);
    peindreLePas(seul, 40, 32, 1, 5);
    const deux = tampon(96, 64);
    peindreLePas(deux, 40, 32, 1, 5);
    peindreLePas(deux, 56, 32, 1, 6);
    for (let y = 0; y < 64; y += 1) {
      for (let x = 0; x < 48; x += 1) {
        const i = (y * 96 + x) * 4 + 3;
        expect(deux.pixels[i]).toBeGreaterThanOrEqual(seul.pixels[i]!);
      }
    }
    let max = 0;
    for (let i = 3; i < deux.pixels.length; i += 4) max = Math.max(max, deux.pixels[i]!);
    expect(max).toBeLessThanOrEqual(255 * 0.82 + 1);
  });

  it("peint la meme chose quel que soit le tampon : les bruits se lisent dans le monde", () => {
    // Deux zones qui se chevauchent doivent donner les memes pixels dans le
    // recouvrement, sinon chaque redessin laisserait une couture.
    const a = tampon(60, 60, 100, 100);
    const b = tampon(60, 60, 120, 110);
    peindreLePas(a, 140, 135, 0.8, 9);
    peindreLePas(b, 140, 135, 0.8, 9);
    for (let y = 120; y < 160; y += 1) {
      for (let x = 120; x < 160; x += 1) {
        const ia = ((y - 100) * 60 + (x - 100)) * 4;
        const ib = ((y - 110) * 60 + (x - 120)) * 4;
        for (let k = 0; k < 4; k += 1) expect(a.pixels[ia + k]).toBe(b.pixels[ib + k]);
      }
    }
  });

  it("la zone d'un pas et le rayon de voisinage se repondent", () => {
    const z = zoneDe({ x: 500, y: 500 });
    expect(z.x1 - z.x0).toBeLessThanOrEqual(RAYON_VOISINAGE);
    expect(selDe({ colonne: 3, ligne: 4 })).toBe(selDe({ colonne: 3, ligne: 4 }));
    expect(selDe({ colonne: 3, ligne: 4 })).not.toBe(selDe({ colonne: 4, ligne: 3 }));
  });
});
