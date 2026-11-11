import { describe, expect, it } from "vitest";
import { MONDE, TERRAIN, chargerLaGraine, profondeurDeRoche } from "../../core/carte";
import { altitude, releverLeRelief } from "./relief";

describe("Relief — la clarte du sol", () => {
  const relief = releverLeRelief(MONDE.largeur, MONDE.hauteur);

  it("rend toujours la meme clarte au meme endroit, entre 0,25 et 1,6", () => {
    const autre = releverLeRelief(MONDE.largeur, MONDE.hauteur);
    for (let i = 0; i < 400; i += 1) {
      const x = (i * 97) % MONDE.largeur;
      const y = (i * 61) % MONDE.hauteur;
      const c = relief.lumiere(x, y);
      expect(c).toBe(autre.lumiere(x, y));
      expect(c).toBeGreaterThanOrEqual(0.25);
      expect(c).toBeLessThanOrEqual(1.6);
      expect(Math.abs(relief.bosse(x, y))).toBeLessThanOrEqual(1);
    }
  });

  it("est lisse : plus de facettes, deux pixels voisins ont presque la meme clarte", () => {
    // ⚠️ C'est le test de la refonte du 11 novembre 2026 (§4.30). Le premier
    // relief rendait un aplat par triangle de 26 px, avec un saut d'un ton
    // entier a chaque arete : « on dirait un tapis de jeu ».
    let pire = 0;
    for (let i = 0; i < 600; i += 1) {
      const x = 300 + ((i * 53) % 1500);
      const y = 50 + ((i * 37) % 800);
      pire = Math.max(pire, Math.abs(relief.lumiere(x, y) - relief.lumiere(x + 1, y)));
      pire = Math.max(pire, Math.abs(relief.lumiere(x, y) - relief.lumiere(x, y + 1)));
    }
    expect(pire).toBeLessThan(0.05);
  });

  it("donne de la forme a la prairie : des versants clairs et des versants sombres", () => {
    let clair = 0;
    let sombre = 0;
    for (let y = 60; y < 700; y += 7) {
      for (let x = 500; x < 1900; x += 7) {
        const c = relief.lumiere(x, y);
        if (c > 1.08) clair += 1;
        if (c < 0.92) sombre += 1;
      }
    }
    expect(clair).toBeGreaterThan(50);
    expect(sombre).toBeGreaterThan(50);
  });

  it("ne saute nulle part : aucune marche droite dans l'altitude, meme loin d'un lac", () => {
    // ⚠️ La distance a un lac n'est connue du noyau que dans une boite de 130 px
    // autour de lui. Tant que la terre montait sur 240 px depuis le rivage,
    // l'altitude sautait d'une vingtaine de pixels au bord de cette boite.
    for (const graine of [21, 7, 404]) {
      chargerLaGraine(graine);
      let pire = 0;
      for (let y = 40; y < MONDE.hauteur - 40; y += 9) {
        for (let x = 40; x < MONDE.largeur - 40; x += 9) {
          if (profondeurDeRoche(x, y) > -40 || profondeurDeRoche(x + 1, y) > -40) continue;
          pire = Math.max(pire, Math.abs(altitude(x + 1, y) - altitude(x, y)));
        }
      }
      expect(pire, `monde ${graine}`).toBeLessThan(3);
    }
    chargerLaGraine(undefined);
  });

  it("fait monter la montagne au-dessus de la prairie", () => {
    const x = 1000;
    // Le pied moyen de la montagne du monde classique : l'ondulation fait
    // moins de trente pixels, les deux echantillons sont a 250 et 300 de la.
    const pied = TERRAIN.montagne;
    const loin = [0, 60, 120, 180].map((d) => altitude(x + d, pied + 250));
    const prairie = [0, 60, 120, 180].map((d) => altitude(x + d, pied - 300));
    const moyenne = (t: number[]) => t.reduce((a, b) => a + b, 0) / t.length;
    expect(moyenne(loin)).toBeGreaterThan(moyenne(prairie) + 40);
  });
});
