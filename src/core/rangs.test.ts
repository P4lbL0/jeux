import { describe, expect, it } from "vitest";
import { bossDeLaNuit, enormesDeLaNuit, NON_PROMUS, RANGS, rendezvousDeLaNuit } from "./rangs";

/**
 * Les rangs de la horde (§4.33) : la piétaille, le boss et l'énorme, et le
 * calendrier qui fait que chaque nuit a son boss.
 */

describe("Les rangs — ce qu'ils multiplient", () => {
  it("tient les quatre decisions d'Angelos", () => {
    expect(RANGS.boss).toEqual({ taille: 2, pv: 10, degats: 3, vitesse: 0.7, butin: 10 });
    expect(RANGS.enorme).toEqual({ taille: 3, pv: 30, degats: 6, vitesse: 0.5, butin: 30 });
    expect(RANGS.pietaille).toEqual({ taille: 1, pv: 1, degats: 1, vitesse: 1, butin: 1 });
  });

  it("ne promeut ni l'essaim ni le kamikaze", () => {
    expect(NON_PROMUS.has("essaim")).toBe(true);
    expect(NON_PROMUS.has("kamikaze")).toBe(true);
    expect(NON_PROMUS.has("cracheur")).toBe(false);
  });
});

describe("Chaque nuit a son boss", () => {
  it("un boss des la deuxieme nuit, un de plus toutes les cinq", () => {
    expect([1, 2, 6, 7, 11, 12, 21].map(bossDeLaNuit)).toEqual([0, 1, 1, 2, 2, 3, 4]);
  });

  it("un enorme toutes les cinq nuits, et jamais avant la cinquieme", () => {
    expect([1, 4, 5, 6, 9, 10, 15].map(enormesDeLaNuit)).toEqual([0, 0, 1, 0, 0, 1, 1]);
  });

  it("repartit les boss sur la nuit, et pose l'enorme aux trois quarts", () => {
    expect(rendezvousDeLaNuit(1)).toEqual([]);
    expect(rendezvousDeLaNuit(2)).toEqual([{ part: 0.5, rang: "boss" }]);
    expect(rendezvousDeLaNuit(10)).toEqual([
      { part: 1 / 3, rang: "boss" },
      { part: 2 / 3, rang: "boss" },
      { part: 0.75, rang: "enorme" },
    ]);
  });

  it("ne pose jamais un rendez-vous hors de la nuit : ni avant le premier monstre, ni apres le dernier", () => {
    for (let nuit = 1; nuit <= 60; nuit++) {
      for (const r of rendezvousDeLaNuit(nuit)) {
        expect(r.part).toBeGreaterThan(0);
        expect(r.part).toBeLessThan(1);
      }
    }
  });
});
