import { describe, expect, it } from "vitest";
import {
  CASES_LIBRES_AUTOUR_DES_BATIMENTS,
  CONSTRUCTIONS,
  amelioration,
  coutCumule,
  coutReparation,
  matiereSuivante,
  palierDe,
  remboursementDemolition,
} from "./constructions";

/**
 * Les paliers de mur du §4.20, tranches le 9 septembre 2026 : ×4 par palier,
 * segment par segment ; la pierre attend sa ressource (Angelos, 19 septembre).
 */
describe("Les paliers de mur", () => {
  it("montent d'environ ×4 par palier, pour le mur comme pour la porte", () => {
    for (const def of [CONSTRUCTIONS.palissade, CONSTRUCTIONS.porte]) {
      const bois = palierDe(def, "bois").pvMax;
      const fer = palierDe(def, "fer").pvMax;
      const pierre = palierDe(def, "pierre").pvMax;
      expect(fer / bois).toBeGreaterThanOrEqual(4);
      expect(fer / bois).toBeLessThan(4.5);
      expect(pierre / fer).toBeGreaterThanOrEqual(4);
      expect(pierre / fer).toBeLessThan(4.5);
    }
  });

  it("la porte reste plus solide que le mur au meme palier, et le mur garde ses 12 bois", () => {
    expect(palierDe(CONSTRUCTIONS.porte, "fer").pvMax).toBeGreaterThan(palierDe(CONSTRUCTIONS.palissade, "fer").pvMax);
    expect(CONSTRUCTIONS.palissade.cout).toEqual({ bois: 12 });
  });

  it("vend le fer, pas encore la pierre, et jamais rien pour la tour", () => {
    const fer = amelioration(CONSTRUCTIONS.palissade, "bois");
    expect(fer?.matiere).toBe("fer");
    expect(fer?.palier.cout.bois).toBeGreaterThan(0);
    expect(fer?.palier.cout.minerai).toBeGreaterThan(0);
    expect(amelioration(CONSTRUCTIONS.palissade, "fer")).toBeNull();
    expect(amelioration(CONSTRUCTIONS.palissade, "pierre")).toBeNull();
    expect(amelioration(CONSTRUCTIONS.tour, "bois")).toBeNull();
    expect(palierDe(CONSTRUCTIONS.tour, "fer").pvMax).toBe(CONSTRUCTIONS.tour.pvMax);
  });

  it("enchaine bois, fer, pierre, puis rien", () => {
    expect(matiereSuivante("bois")).toBe("fer");
    expect(matiereSuivante("fer")).toBe("pierre");
    expect(matiereSuivante("pierre")).toBeNull();
  });

  it("cumule ce qu'on a paye jusqu'au palier atteint", () => {
    expect(coutCumule(CONSTRUCTIONS.palissade, "bois")).toEqual({ bois: 12 });
    expect(coutCumule(CONSTRUCTIONS.palissade, "fer")).toEqual({ bois: 72, minerai: 25 });
  });

  it("rembourse et repare sur ce qu'on a paye et sur les points de vie du palier", () => {
    const fer = palierDe(CONSTRUCTIONS.palissade, "fer");
    expect(remboursementDemolition(CONSTRUCTIONS.palissade, fer.pvMax, "fer")).toEqual({ bois: 36, minerai: 12 });
    // A moitie cassee : la reparation coute la moitie de la moitie du cumule.
    expect(coutReparation(CONSTRUCTIONS.palissade, fer.pvMax / 2, "fer")).toEqual({ bois: 18, minerai: 7 });
    // Sans matiere, tout se comporte comme avant : du bois.
    expect(remboursementDemolition(CONSTRUCTIONS.palissade, 120)).toEqual({ bois: 6 });
  });
});

describe("La regle des cases", () => {
  it("laisse deux cases entre un mur et un batiment depuis le 19 septembre 2026", () => {
    expect(CASES_LIBRES_AUTOUR_DES_BATIMENTS).toBe(2);
  });
});
