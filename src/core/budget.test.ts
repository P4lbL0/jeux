import { describe, expect, it } from "vitest";
import {
  REGLAGES_BUDGET,
  menacesDuMonde,
  phraseDuMonde,
  valeurDesCadeaux,
  type CeQueLeMondeOffre,
} from "./budget";
import { peuplerLeVillage } from "./peuplement";

/**
 * Le budget (§4.29, point 4). Ce qui se verifie ici est ce que le design
 * promet, et rien d'autre : **un beau village annonce les pires nuits**, un
 * monde ouvert et vide les adoucit, et la phrase ne dit jamais ce qui ne se
 * voit pas de loin.
 */

/** Le monde de reference : la partie qu'on jouait jusqu'ici. */
const REFERENCE: CeQueLeMondeOffre = {
  habitants: 6,
  aisance: 0.5,
  fronts: 2,
  // L'enceinte d'un vrai village : presque entiere, deux breches (mesure sur
  // 180 villages, `.tmp/mesurer-murs.ts`).
  mursDebout: 44,
  breches: 2,
  douves: false,
};

const avec = (change: Partial<CeQueLeMondeOffre>): CeQueLeMondeOffre => ({ ...REFERENCE, ...change });

describe("Ce que le monde offre", () => {
  it("ne compte ni cadeau ni menace sur le monde de reference", () => {
    expect(valeurDesCadeaux(REFERENCE)).toBe(0);
  });

  it("fait de la presqu'ile le plus gros cadeau du jeu (§4.29)", () => {
    const presquIle = valeurDesCadeaux(avec({ fronts: 1 }));
    expect(presquIle).toBeGreaterThan(valeurDesCadeaux(avec({ habitants: 20 })));
    expect(presquIle).toBeGreaterThan(valeurDesCadeaux(avec({ breches: 0 })));
    expect(presquIle).toBeGreaterThan(valeurDesCadeaux(avec({ aisance: 1 })));
  });

  it("traite la plaine ouverte comme une menace majeure, pas comme un detail", () => {
    // ⚠️ A quatre fronts, la baliste du jalon 7 ne couvre plus rien (§4.29,
    // §4.7) : le monde doit rendre beaucoup en echange.
    const ouvert = valeurDesCadeaux(avec({ fronts: 4 }));
    expect(ouvert).toBeLessThan(0);
    expect(Math.abs(ouvert)).toBeGreaterThan(valeurDesCadeaux(avec({ aisance: 1 })));
  });

  it("paie chaque cadeau : du monde, des reserves, des murs, un fosse", () => {
    expect(valeurDesCadeaux(avec({ habitants: 20 }))).toBeGreaterThan(0);
    expect(valeurDesCadeaux(avec({ habitants: 1 }))).toBeLessThan(0);
    expect(valeurDesCadeaux(avec({ aisance: 1 }))).toBeGreaterThan(0);
    expect(valeurDesCadeaux(avec({ aisance: 0 }))).toBeLessThan(0);
    expect(valeurDesCadeaux(avec({ breches: 0 }))).toBeGreaterThan(0);
    expect(valeurDesCadeaux(avec({ breches: 4 }))).toBeLessThan(0);
    expect(valeurDesCadeaux(avec({ douves: true }))).toBeGreaterThan(0);
  });

  it("compte un village sans la moindre enceinte comme pire qu'un mur troue", () => {
    const sansMur = valeurDesCadeaux(avec({ mursDebout: 0, breches: 0 }));
    expect(sansMur).toBeLessThan(valeurDesCadeaux(avec({ breches: 4 })));
    expect(Number.isFinite(sansMur)).toBe(true);
  });
});

describe("Ce que le monde reclame", () => {
  it("laisse le monde de reference exactement ou il etait", () => {
    const menaces = menacesDuMonde(0);
    expect(menaces).toEqual({ effectifEnPlus: 0, nuitsDAvance: 0, malades: 0 });
  });

  it("fait payer le beau village : plus nombreux, plus forts, et des malades", () => {
    const beau = menacesDuMonde(valeurDesCadeaux(avec({ fronts: 1, habitants: 18, aisance: 1, breches: 0, douves: true })));
    expect(beau.effectifEnPlus).toBeGreaterThan(0.3);
    expect(beau.nuitsDAvance).toBeGreaterThanOrEqual(2);
    expect(beau.malades).toBeGreaterThan(0);
  });

  it("adoucit la ruine ouverte a tous les vents, sans jamais la rendre vide", () => {
    const ruine = menacesDuMonde(valeurDesCadeaux(avec({ fronts: 4, habitants: 1, aisance: 0, breches: 4 })));
    expect(ruine.effectifEnPlus).toBeLessThan(0);
    expect(ruine.nuitsDAvance).toBe(0);
    expect(ruine.malades).toBe(0);
    // Un monde pauvre reste un monde : il n'offre pas des nuits vides.
    expect(ruine.effectifEnPlus).toBeGreaterThanOrEqual(-REGLAGES_BUDGET.adoucissementMax);
  });

  it("ne depasse jamais ses plafonds, quelle que soit la generosite", () => {
    const fou = menacesDuMonde(10_000);
    expect(fou.effectifEnPlus).toBe(REGLAGES_BUDGET.durcissementMax);
    expect(fou.nuitsDAvance).toBe(REGLAGES_BUDGET.nuitsDAvanceMax);
    expect(fou.malades).toBe(REGLAGES_BUDGET.maladesMax);
  });

  it("ne laisse aucun village reel sortir des bornes (§4.17)", () => {
    // Les vrais mondes : la population et les reserves sortent du peuplement.
    for (let graine = 0; graine < 200; graine++) {
      const p = peuplerLeVillage(graine);
      for (const fronts of [1, 2, 3, 4]) {
        const m = menacesDuMonde(
          valeurDesCadeaux(avec({ habitants: p.population, aisance: p.aisance, fronts })),
        );
        expect(m.effectifEnPlus).toBeGreaterThanOrEqual(-REGLAGES_BUDGET.adoucissementMax);
        expect(m.effectifEnPlus).toBeLessThanOrEqual(REGLAGES_BUDGET.durcissementMax);
        expect(m.nuitsDAvance).toBeLessThanOrEqual(REGLAGES_BUDGET.nuitsDAvanceMax);
        expect(m.malades).toBeLessThanOrEqual(REGLAGES_BUDGET.maladesMax);
      }
    }
  });
});

describe("La phrase qu'on annonce avant d'entrer", () => {
  const phraseDe = (offre: CeQueLeMondeOffre) => phraseDuMonde(offre, menacesDuMonde(valeurDesCadeaux(offre)));

  it("tient en une phrase, et dit les deux moities", () => {
    const phrase = phraseDe(avec({ habitants: 16 }));
    expect(phrase).toContain(" — ");
    expect(phrase.length).toBeLessThan(90);
  });

  it("ne dit jamais ce qui ne se voit pas de loin (§4.29)", () => {
    // Maladie, stress, reserves comptees : interdits, comme pour le gardien.
    const interdits = ["malad", "fievre", "toux", "stress", "reserve", "vivre", "grain"];
    for (let graine = 0; graine < 120; graine++) {
      const p = peuplerLeVillage(graine);
      for (const fronts of [1, 2, 3, 4]) {
        const phrase = phraseDe(avec({ habitants: p.population, aisance: p.aisance, fronts })).toLowerCase();
        for (const mot of interdits) expect(phrase).not.toContain(mot);
      }
    }
  });

  it("annonce les pires nuits sur le plus beau village", () => {
    const beau = phraseDe(avec({ fronts: 1, habitants: 18, aisance: 1, breches: 0, douves: true }));
    expect(beau).toContain("presqu'ile");
    expect(beau).toContain("ne pardonne rien");
  });

  it("annonce des nuits calmes sur une ruine ouverte", () => {
    const ruine = phraseDe(avec({ fronts: 4, habitants: 1, aisance: 0, breches: 4 }));
    expect(ruine).toContain("calmes");
  });
});
