import { describe, expect, it } from "vitest";
import { absorber, auPalier, BASES, bouclierNeuf, dansLeSouffle, decalerBouclier, reformer } from "./elements";

describe("Les bases elementaires (§4.13, 23 septembre 2026)", () => {
  it("lit la valeur d'un palier, bornee aux paliers qui existent", () => {
    expect(auPalier([10, 20, 30], 1)).toBe(10);
    expect(auPalier([10, 20, 30], 3)).toBe(30);
    expect(auPalier([10, 20, 30], 0)).toBe(10);
    expect(auPalier([10, 20, 30], 7)).toBe(30);
  });

  it("fait grandir chaque base avec ses paliers, jamais l'inverse", () => {
    const croissants = [
      BASES.bouleDeFeu.degats,
      BASES.bouleDeFeu.rayon,
      BASES.vent.longueur,
      BASES.vent.force,
      BASES.eau.rayon,
      BASES.eau.duree,
      BASES.nature.rayon,
      BASES.nature.tenue,
      BASES.teleportation.distance,
    ];
    for (const serie of croissants) {
      for (let i = 1; i < serie.length; i++) expect(serie[i]!).toBeGreaterThan(serie[i - 1]!);
    }
    // Le bouclier revient de plus en plus vite apres s'etre brise.
    const retour = BASES.bouclier.retour;
    for (let i = 1; i < retour.length; i++) expect(retour[i]!).toBeLessThan(retour[i - 1]!);
  });
});

describe("Le Bouclier — un ecran qui encaisse, se reforme, et se brise", () => {
  it("se remplit des qu'on le regarde la premiere fois", () => {
    const b = bouclierNeuf();
    expect(reformer(b, 30, 0)).toBe("rempli");
    expect(b.pv).toBe(30);
  });

  it("encaisse a la place du heros, et ne rend que ce qui passe au travers", () => {
    const b = bouclierNeuf();
    reformer(b, 30, 0);
    expect(absorber(b, 12, 100, 10000)).toBe(0);
    expect(b.pv).toBe(18);
    expect(b.brise).toBe(false);
    // Le coup de trop : il prend ce qui reste, et le surplus passe.
    expect(absorber(b, 25, 200, 10000)).toBe(7);
    expect(b.pv).toBe(0);
    expect(b.brise).toBe(true);
  });

  it("brise, il ne protege plus, et ne revient qu'a son heure", () => {
    const b = bouclierNeuf();
    reformer(b, 30, 0);
    absorber(b, 40, 1000, 8000);
    expect(absorber(b, 9, 2000, 8000)).toBe(9);
    // Meme sans coup pendant longtemps, il attend son heure.
    expect(reformer(b, 30, 8999)).toBeNull();
    expect(b.pv).toBe(0);
    expect(reformer(b, 30, 9000)).toBe("revenu");
    expect(b.pv).toBe(30);
  });

  it("entame, il se referme quand on le laisse souffler — pas avant", () => {
    const b = bouclierNeuf();
    reformer(b, 30, 0);
    absorber(b, 10, 1000, 10000);
    expect(reformer(b, 30, 1000 + BASES.bouclier.souffle - 1)).toBeNull();
    expect(b.pv).toBe(20);
    // Un coup de plus relance l'attente.
    absorber(b, 1, 3000, 10000);
    expect(reformer(b, 30, 1000 + BASES.bouclier.souffle)).toBeNull();
    expect(reformer(b, 30, 3000 + BASES.bouclier.souffle)).toBe("rempli");
    expect(b.pv).toBe(30);
  });

  it("suit la vie maximale, et disparait avec la competence", () => {
    const b = bouclierNeuf();
    reformer(b, 30, 0);
    // La vie max baisse (le Fardeau) : l'ecran ne garde pas plus que son plafond.
    reformer(b, 20, 10);
    expect(b.pv).toBe(20);
    expect(reformer(b, 0, 20)).toBeNull();
    expect(b.pv).toBe(0);
  });

  it("ne se recharge pas pendant un menu", () => {
    const b = bouclierNeuf();
    reformer(b, 30, 0);
    absorber(b, 40, 1000, 6000);
    decalerBouclier(b, 60000);
    expect(reformer(b, 30, 7000)).toBeNull();
    expect(reformer(b, 30, 67000)).toBe("revenu");
  });
});

describe("Le Vent — ce qui est dans le couloir du souffle", () => {
  it("donne la distance le long du souffle, a gauche comme a droite", () => {
    expect(dansLeSouffle(100, 0, 0, 0, 1, 0, 200, 40)).toBe(100);
    expect(dansLeSouffle(100, 39, 0, 0, 1, 0, 200, 40)).toBe(100);
    expect(dansLeSouffle(100, -39, 0, 0, 1, 0, 200, 40)).toBe(100);
  });

  it("ignore ce qui est derriere, trop loin, ou a cote", () => {
    expect(dansLeSouffle(-5, 0, 0, 0, 1, 0, 200, 40)).toBeNull();
    expect(dansLeSouffle(201, 0, 0, 0, 1, 0, 200, 40)).toBeNull();
    expect(dansLeSouffle(100, 41, 0, 0, 1, 0, 200, 40)).toBeNull();
  });

  it("marche dans toutes les directions", () => {
    const d = Math.SQRT1_2;
    const avance = dansLeSouffle(50, 50, 0, 0, d, d, 200, 10);
    expect(avance).toBeCloseTo(Math.hypot(50, 50));
    expect(dansLeSouffle(50, -50, 0, 0, d, d, 200, 10)).toBeNull();
  });
});
