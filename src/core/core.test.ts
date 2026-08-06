import { describe, expect, it } from "vitest";
import { Rng } from "./rng";
import { CLASSES, ORDRE_CLASSES, xpPourNiveauSuivant } from "./classes";

describe("Rng", () => {
  it("rejoue exactement la meme suite avec la meme graine", () => {
    const a = new Rng(42);
    const b = new Rng(42);
    const suiteA = Array.from({ length: 20 }, () => a.next());
    const suiteB = Array.from({ length: 20 }, () => b.next());
    expect(suiteA).toEqual(suiteB);
  });

  it("donne des suites differentes avec des graines differentes", () => {
    expect(new Rng(1).next()).not.toBe(new Rng(2).next());
  });

  it("reste dans les bornes demandees", () => {
    const rng = new Rng(7);
    for (let i = 0; i < 500; i++) {
      const n = rng.int(3, 9);
      expect(n).toBeGreaterThanOrEqual(3);
      expect(n).toBeLessThanOrEqual(9);
    }
  });
});

describe("Progression", () => {
  it("demande de plus en plus d'XP a chaque niveau", () => {
    for (let niveau = 1; niveau < 40; niveau++) {
      expect(xpPourNiveauSuivant(niveau + 1)).toBeGreaterThan(xpPourNiveauSuivant(niveau));
    }
  });
});

describe("Classes", () => {
  it("declare des valeurs coherentes", () => {
    for (const id of ORDRE_CLASSES) {
      const classe = CLASSES[id];
      expect(classe.pvMax).toBeGreaterThan(0);
      expect(classe.vitesse).toBeGreaterThan(0);
      expect(classe.cadence).toBeGreaterThan(0);
      expect(classe.esquive).toBeGreaterThanOrEqual(0);
      expect(classe.esquive).toBeLessThanOrEqual(1);
      expect(classe.ultimes.length).toBeGreaterThan(0);
    }
  });

  /**
   * Garde-fou de design (DESIGN.md §4.2) : si deux classes se jouent a la meme
   * distance, le deplacement — seul geste du joueur — perd son sens. Ce test
   * echouera si un futur reequilibrage les rapproche trop.
   */
  it("se jouent toutes a des distances distinctes", () => {
    const portees = ORDRE_CLASSES.map((id) => CLASSES[id].portee).sort((a, b) => a - b);
    expect(new Set(portees).size).toBe(portees.length);
  });

  it("ont toutes un lore, un trait et un ultime", () => {
    for (const id of ORDRE_CLASSES) {
      const classe = CLASSES[id];
      expect(classe.lore.length).toBeGreaterThan(40);
      expect(classe.traitNom.length).toBeGreaterThan(0);
      expect(classe.traitTexte.length).toBeGreaterThan(0);
      expect(classe.ultimes[0]?.description.length).toBeGreaterThan(0);
    }
  });

  it("ont toutes un trait different", () => {
    const traits = ORDRE_CLASSES.map((id) => CLASSES[id].trait);
    expect(new Set(traits).size).toBe(traits.length);
  });

  /**
   * Le Necromancien ne se bat jamais lui-meme : ce sont ses morts qui
   * travaillent (DESIGN.md §4.14). Une portee nulle garantit qu'il n'attaquera
   * aucune cible.
   */
  it("laisse le Necromancien sans attaque et confine a la cite", () => {
    expect(CLASSES.necromancien.portee).toBe(0);
    expect(CLASSES.necromancien.resteEnCite).toBe(true);
  });
});
