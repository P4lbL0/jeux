import { describe, expect, it } from "vitest";
import { REGLAGES_BUTIN, encaisser, orDUneBete } from "./butin";
import { coursNeutre, valeurDe } from "./port";

/**
 * Le butin (§4.29, 20 septembre 2026) : l'or a une deuxieme source, et le
 * design pose une seule condition — **elle ne doit pas tuer le port**.
 */

/** Une cargaison de bois honnete : ce qu'on emmene au navire apres deux journees. */
const CARGAISON = valeurDe("bois", 200, coursNeutre());

describe("Ce qu'un mort met dans la bourse", () => {
  it("laisse une cargaison valoir plus qu'un mort, quel qu'il soit", () => {
    expect(CARGAISON).toBeGreaterThan(REGLAGES_BUTIN.orDUnHumain * 2);
    expect(CARGAISON).toBeGreaterThan(orDUneBete(4) * 10);
  });

  it("garde une nuit entiere de monstres sous une cargaison", () => {
    // Soixante monstres, deux points d'experience en moyenne : le plafond du
    // §4.17 pour une nuit chargee.
    const nuit = orDUneBete(2) * 60;
    expect(nuit).toBeLessThan(CARGAISON);
  });

  it("fait qu'un village entier qui nous attaque paie la route", () => {
    // Trois habitants au depart : de quoi repartir, pas de quoi s'installer.
    const village = REGLAGES_BUTIN.orDUnHumain * 3;
    expect(village).toBeGreaterThan(orDUneBete(2) * 20);
    expect(village).toBeLessThan(CARGAISON);
  });
});

describe("La monnaie qu'on garde", () => {
  it("ne rend rien tant qu'on n'a pas une piece entiere", () => {
    const un = encaisser(0, 0.25);
    expect(un.pieces).toBe(0);
    expect(un.reste).toBeCloseTo(0.25);
  });

  it("rend la piece au quatrieme fonceur, et repart de zero", () => {
    let reste = 0;
    let total = 0;
    for (let i = 0; i < 4; i++) {
      const gain = encaisser(reste, orDUneBete(1));
      reste = gain.reste;
      total += gain.pieces;
    }
    expect(total).toBe(1);
    expect(reste).toBeCloseTo(0);
  });

  it("n'egare jamais une piece : cent morts rendent exactement leur valeur", () => {
    let reste = 0;
    let total = 0;
    for (let i = 0; i < 100; i++) {
      const gain = encaisser(reste, orDUneBete(3));
      reste = gain.reste;
      total += gain.pieces;
    }
    expect(total + reste).toBeCloseTo(orDUneBete(3) * 100);
  });

  it("encaisse d'un coup ce qui vaut plusieurs pieces", () => {
    expect(encaisser(0, REGLAGES_BUTIN.orDUnHumain).pieces).toBe(REGLAGES_BUTIN.orDUnHumain);
  });
});
