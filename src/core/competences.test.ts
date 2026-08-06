import { describe, expect, it } from "vitest";
import { Rng } from "./rng";
import { ORDRE_CLASSES } from "./classes";
import { bonusVierge, COMPETENCES, tirerCompetences } from "./competences";

describe("Competences", () => {
  it("n'a pas deux fois le meme identifiant", () => {
    const ids = COMPETENCES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("ne propose jamais une competence reservee a une autre classe", () => {
    const rng = new Rng(11);
    for (const classe of ORDRE_CLASSES) {
      for (let i = 0; i < 200; i++) {
        for (const c of tirerCompetences(rng, classe, {}, 3)) {
          if (c.classes) expect(c.classes).toContain(classe);
        }
      }
    }
  });

  it("ne propose jamais deux fois la meme competence dans un tirage", () => {
    const rng = new Rng(3);
    for (let i = 0; i < 200; i++) {
      const choix = tirerCompetences(rng, "mage", {}, 3);
      expect(new Set(choix.map((c) => c.id)).size).toBe(choix.length);
    }
  });

  it("respecte le nombre maximum de prises d'une competence", () => {
    const limitee = COMPETENCES.find((c) => c.maximum !== undefined);
    expect(limitee).toBeDefined();
    const rng = new Rng(5);
    const dejaPrises = { [limitee!.id]: limitee!.maximum! };
    for (let i = 0; i < 200; i++) {
      const choix = tirerCompetences(rng, "guerrier", dejaPrises, 3);
      expect(choix.map((c) => c.id)).not.toContain(limitee!.id);
    }
  });

  /**
   * Ce que fera une montee de rang : rendre les raretes elevees plus probables
   * (DESIGN.md §4.1). Le test verrouille cette promesse.
   */
  it("la faveur augmente bien la part des raretes elevees", () => {
    const compter = (faveur: number): number => {
      const rng = new Rng(99);
      let rares = 0;
      for (let i = 0; i < 1000; i++) {
        for (const c of tirerCompetences(rng, "guerrier", {}, 1, faveur)) {
          if (c.rarete === "epique" || c.rarete === "legendaire") rares += 1;
        }
      }
      return rares;
    };
    expect(compter(1.5)).toBeGreaterThan(compter(0));
  });

  it("applique ses effets sur les bonus", () => {
    const bonus = bonusVierge();
    const lame = COMPETENCES.find((c) => c.id === "lame-affutee");
    lame?.appliquer(bonus);
    lame?.appliquer(bonus);
    expect(bonus.degats).toBe(8);
  });
});
