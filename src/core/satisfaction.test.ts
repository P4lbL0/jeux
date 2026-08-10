import { describe, expect, it } from "vitest";
import { CONDITIONS, Eglise } from "./eglise";
import { stocksVides } from "./habitants";
import {
  lireSatisfaction,
  mortsRecents,
  satisfactionDuVillage,
  type ContexteSatisfaction,
} from "./satisfaction";

function village(modifications: Partial<ContexteSatisfaction> = {}): ContexteSatisfaction {
  return {
    stress: [10, 10, 10],
    affames: 0,
    malades: 0,
    mortsRecents: 0,
    joursDeVivres: 5,
    niveauEglise: 1,
    egliseDebout: true,
    decorations: 0,
    ...modifications,
  };
}

describe("La satisfaction", () => {
  it("reste entre 0 et 100 quoi qu'on lui donne", () => {
    const pire = satisfactionDuVillage(
      village({ stress: [200, 200], affames: 40, malades: 40, mortsRecents: 20, joursDeVivres: 0, egliseDebout: false }),
    );
    const meilleur = satisfactionDuVillage(
      village({ stress: [0, 0], joursDeVivres: 99, niveauEglise: 4, decorations: 40 }),
    );
    expect(pire).toBe(0);
    expect(meilleur).toBe(100);
  });

  it("rend zero pour un village vide plutot que NaN", () => {
    expect(satisfactionDuVillage(village({ stress: [] }))).toBe(0);
  });

  it("baisse quand le stress moyen monte", () => {
    const calme = satisfactionDuVillage(village({ stress: [5, 5, 5] }));
    const tendu = satisfactionDuVillage(village({ stress: [90, 90, 90] }));
    expect(tendu).toBeLessThan(calme);
  });

  it("est plombee par les morts recents", () => {
    expect(satisfactionDuVillage(village({ mortsRecents: 3 }))).toBeLessThan(
      satisfactionDuVillage(village()),
    );
  });

  it("monte avec le niveau de l'eglise, et chute quand elle est a terre", () => {
    const belle = satisfactionDuVillage(village({ niveauEglise: 3 }));
    const simple = satisfactionDuVillage(village({ niveauEglise: 1 }));
    const aTerre = satisfactionDuVillage(village({ niveauEglise: 3, egliseDebout: false }));
    expect(belle).toBeGreaterThan(simple);
    expect(aTerre).toBeLessThan(simple);
  });

  it("recompense les vivres d'avance, jusqu'a un point et pas au-dela", () => {
    const juste = satisfactionDuVillage(village({ joursDeVivres: 5 }));
    const enorme = satisfactionDuVillage(village({ joursDeVivres: 50 }));
    expect(enorme).toBe(juste);
    expect(satisfactionDuVillage(village({ joursDeVivres: 0 }))).toBeLessThan(juste);
  });
});

/**
 * ⚠️ C'est le test qui compte le plus de ce fichier : la satisfaction n'existe
 * que pour debloquer l'eglise (§4.22), et un seuil inatteignable ferait un
 * systeme mort. Un village bien tenu doit franchir 40 sans effort particulier,
 * et un village qui souffre doit echouer.
 */
describe("La boucle avec l'eglise", () => {
  it("laisse un village bien tenu franchir le seuil du niveau 2", () => {
    expect(satisfactionDuVillage(village())).toBeGreaterThanOrEqual(CONDITIONS[2].satisfaction);
  });

  it("bloque le niveau 2 d'un village qui souffre", () => {
    const malmene = satisfactionDuVillage(
      village({ stress: [80, 90, 70], mortsRecents: 2, affames: 2, joursDeVivres: 0 }),
    );
    expect(malmene).toBeLessThan(CONDITIONS[2].satisfaction);
  });

  it("est bien lue par l'eglise, et la bloque quand elle manque", () => {
    const eglise = new Eglise();
    const stocks = stocksVides();
    stocks.bois = 999;
    stocks.minerai = 999;

    const contexte = { stocks, population: 9, argent: 9999 };
    expect(eglise.peutMonter({ ...contexte, satisfaction: 10 }).manque).toContain("satisfaction");
    expect(eglise.peutMonter({ ...contexte, satisfaction: 80 }).possible).toBe(true);
  });
});

describe("La memoire des morts", () => {
  it("oublie ceux d'il y a plus de trois journees", () => {
    expect(mortsRecents([1, 4, 5, 6], 6)).toBe(3);
    expect(mortsRecents([], 6)).toBe(0);
  });
});

describe("La lecture", () => {
  it("dit l'etat du village en une phrase", () => {
    expect(lireSatisfaction(95)).toContain("heureux");
    expect(lireSatisfaction(5)).toContain("se meurt");
  });
});
