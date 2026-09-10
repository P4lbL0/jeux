import { describe, expect, it } from "vitest";
import { MONDE, terrainEn } from "../../core/carte";
import { classer, lignesDuMonde, peindreDegat, peindreLaCarte, terrainDIndex } from "./carte";
import { DECORS, peindreDecor } from "./decor";
import { bruit, bruitLisse, ligneDeBruit } from "./bruit";
import { EAU, SABLE, SOL_VERT, clarte, ecart } from "./palette";

describe("Le bruit", () => {
  it("rend toujours la meme valeur pour les memes entrees, entre 0 et 1", () => {
    for (let i = 0; i < 200; i += 1) {
      const v = bruit(i * 7 - 300, i * 3, 5);
      expect(v).toBe(bruit(i * 7 - 300, i * 3, 5));
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("calcule une ligne entiere exactement comme le point par point", () => {
    // La ligne n'existe que pour aller vite : si elle derivait du bruit lisse,
    // la carte cuite ne ressemblerait plus a ce que la planche montre.
    const sortie = new Float32Array(64);
    ligneDeBruit(17, 9, 3, 64, sortie);
    for (let x = 0; x < 64; x += 1) {
      expect(sortie[x]).toBeCloseTo(bruitLisse(x, 17, 9, 3), 5);
    }
  });
});

describe("La carte peinte", () => {
  it("classe le sol exactement comme la formule du core", () => {
    // Les lignes sont echantillonnees d'avance pour aller vite ; si elles
    // divergeaient de `terrainEn`, la carte ne serait plus celle que la grille
    // et les corps physiques connaissent.
    const lignes = lignesDuMonde();
    for (let i = 0; i < 4000; i += 1) {
      const x = Math.floor(bruit(i, 1, 9) * MONDE.largeur);
      const y = Math.floor(bruit(1, i, 9) * MONDE.hauteur);
      expect(classer(lignes, x, y), `${x},${y}`).toBe(terrainEn(x, y));
    }
  });

  it("peint une petite carte sans jamais laisser un pixel vide", () => {
    const carte = peindreLaCarte(96, 96);
    for (let i = 3; i < carte.pixels.length; i += 4) expect(carte.pixels[i]).toBe(255);
  });

  it("donne a chaque terrain la couleur de sa matiere, a une tache pres", () => {
    const carte = peindreLaCarte(MONDE.largeur, 400);
    const lire = (x: number, y: number) => {
      const i = (y * carte.largeur + x) * 4;
      return ((carte.pixels[i]! << 16) | (carte.pixels[i + 1]! << 8) | carte.pixels[i + 2]!) >>> 0;
    };
    // Le large est de l'eau, le milieu est de l'herbe ; chacun a droit a ses
    // trois valeurs et aux taches entre elles, pas a la couleur d'un autre sol.
    expect(terrainDIndex(carte.terrains[200 * carte.largeur + 180]!)).toBe("mer");
    expect(ecart(lire(180, 200), EAU.corps)).toBeLessThan(60);
    expect(terrainDIndex(carte.terrains[200 * carte.largeur + 1200]!)).toBe("herbe");
    expect(ecart(lire(1200, 200), SOL_VERT.corps)).toBeLessThan(60);
    // Et le sable est bien plus clair que l'herbe, pour que le rivage se lise.
    expect(ecart(SABLE.corps, SOL_VERT.corps)).toBeGreaterThan(80);
  });

  it("se peint en moins d'une seconde", () => {
    // Elle est cuite a chaque demarrage : une carte qui prend trois secondes
    // ferait passer le menu pour un ecran fige.
    const debut = performance.now();
    peindreLaCarte();
    expect(performance.now() - debut).toBeLessThan(1000);
  });
});

describe("Le sol abime", () => {
  /** Un tampon d'herbe unie, pour y ecrire un degat. */
  function herbe(cote: number): Uint8ClampedArray {
    const pixels = new Uint8ClampedArray(cote * cote * 4);
    for (let i = 0; i < cote * cote; i += 1) {
      pixels[i * 4] = (SOL_VERT.corps >> 16) & 0xff;
      pixels[i * 4 + 1] = (SOL_VERT.corps >> 8) & 0xff;
      pixels[i * 4 + 2] = SOL_VERT.corps & 0xff;
      pixels[i * 4 + 3] = 255;
    }
    return pixels;
  }
  const lire = (pixels: Uint8ClampedArray, cote: number, x: number, y: number) => {
    const i = (y * cote + x) * 4;
    return ((pixels[i]! << 16) | (pixels[i + 1]! << 8) | pixels[i + 2]!) >>> 0;
  };

  it("ecrit le degat au centre et laisse le sol intact au-dela du rayon", () => {
    const cote = 96;
    const pixels = herbe(cote);
    peindreDegat(pixels, cote, cote, 48, 48, 20, "brule", 3);
    expect(ecart(lire(pixels, cote, 48, 48), SOL_VERT.corps)).toBeGreaterThan(40);
    expect(lire(pixels, cote, 4, 4)).toBe(SOL_VERT.corps);
    expect(lire(pixels, cote, 48, 4)).toBe(SOL_VERT.corps);
  });

  it("creuse un cratere plus sombre au fond que sur son rebord", () => {
    const cote = 96;
    const pixels = herbe(cote);
    peindreDegat(pixels, cote, cote, 48, 48, 24, "cratere", 5);
    const fond = lire(pixels, cote, 48, 48);
    // Le rebord, juste a l'interieur du bord minimal (0,72 du rayon).
    const rebord = lire(pixels, cote, 48 + 15, 48);
    expect(clarte(fond)).toBeLessThan(clarte(rebord));
  });

  it("ne dessine jamais deux fois le meme bord pour deux graines", () => {
    const cote = 64;
    const a = herbe(cote);
    const b = herbe(cote);
    peindreDegat(a, cote, cote, 32, 32, 18, "terre", 1);
    peindreDegat(b, cote, cote, 32, 32, 18, "terre", 2);
    expect(Array.from(a)).not.toEqual(Array.from(b));
  });
});

describe("Le decor", () => {
  it("tient dans sa toile, contour compris, pour chaque piece", () => {
    for (const decor of DECORS) {
      const toile = peindreDecor(decor.cle);
      expect(toile.compterOpaques(), decor.cle).toBeGreaterThan(20);
      expect(toile.pixelsDuBord(), `${decor.cle} touche le bord`).toBe(0);
    }
  });

  it("ne dessine jamais deux arbres identiques", () => {
    const rendus = DECORS.filter((d) => d.cle.includes("arbre")).map((d) => peindreDecor(d.cle).rendu());
    expect(new Set(rendus).size).toBe(rendus.length);
  });
});
