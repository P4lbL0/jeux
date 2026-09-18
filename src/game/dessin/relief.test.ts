import { describe, expect, it } from "vitest";
import { MONDE, ligneDeMontagne } from "../../core/carte";
import { altitude, releverLeRelief } from "./relief";

describe("Relief — les facettes du sol", () => {
  const relief = releverLeRelief(MONDE.largeur, MONDE.hauteur);

  it("rend toujours la meme marche au meme endroit, entre -2 et 2", () => {
    const autre = releverLeRelief(MONDE.largeur, MONDE.hauteur);
    for (let i = 0; i < 400; i += 1) {
      const x = (i * 97) % MONDE.largeur;
      const y = (i * 61) % MONDE.hauteur;
      const m = relief.marche(x, y);
      expect(m).toBe(autre.marche(x, y));
      expect(m).toBeGreaterThanOrEqual(-2);
      expect(m).toBeLessThanOrEqual(2);
    }
  });

  it("est constant dans une facette : un aplat par triangle, pas un degrade", () => {
    // Deux pixels voisins au coeur d'une meme facette ont la meme marche.
    let pareils = 0;
    for (let i = 0; i < 300; i += 1) {
      const x = 300 + ((i * 53) % 1500);
      const y = 50 + ((i * 37) % 800);
      if (relief.marche(x, y) === relief.marche(x + 1, y)) pareils += 1;
    }
    expect(pareils).toBeGreaterThan(270);
  });

  it("donne de la forme a la prairie : des versants clairs et des versants sombres", () => {
    const vus = new Set<number>();
    for (let y = 60; y < 700; y += 7) for (let x = 500; x < 1900; x += 7) vus.add(relief.marche(x, y));
    expect(vus.has(-1) || vus.has(-2)).toBe(true);
    expect(vus.has(1) || vus.has(2)).toBe(true);
  });

  it("fait monter la montagne au-dessus de la prairie", () => {
    const x = 1000;
    const pied = ligneDeMontagne(x);
    const loin = [0, 60, 120, 180].map((d) => altitude(x + d, pied + 250));
    const prairie = [0, 60, 120, 180].map((d) => altitude(x + d, pied - 300));
    const moyenne = (t: number[]) => t.reduce((a, b) => a + b, 0) / t.length;
    expect(moyenne(loin)).toBeGreaterThan(moyenne(prairie) + 40);
  });
});
