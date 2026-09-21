import { describe, expect, it } from "vitest";
import {
  Affinites,
  BONUS_MAX,
  FACTEUR_OUBLI,
  PLANCHER_ACQUIS,
  SECONDES_POUR_PLAFOND,
} from "./affinites";

const EQUIPE = ["a", "b", "c"];

/** Fait combattre ensemble les heros donnes pendant un certain temps. */
function ensemble(affinites: Affinites, qui: string[], secondes: number): void {
  affinites.ecouler(EQUIPE, qui, secondes);
}

describe("Affinites — l'apprentissage", () => {
  it("monte avec le temps passe a se battre cote a cote", () => {
    const a = new Affinites();
    ensemble(a, ["a", "b"], 60);
    expect(a.affinite("a", "b")).toBeCloseTo(60 / SECONDES_POUR_PLAFOND, 5);
    // Le troisieme n'etait pas la : il n'a rien appris.
    expect(a.affinite("a", "c")).toBe(0);
  });

  it("plafonne a dix minutes de combat partage", () => {
    const a = new Affinites();
    ensemble(a, ["a", "b"], SECONDES_POUR_PLAFOND * 5);
    expect(a.affinite("a", "b")).toBe(1);
  });

  it("ne compte pas un heros seul contre lui-meme", () => {
    const a = new Affinites();
    ensemble(a, ["a"], 300);
    expect(a.affinite("a", "a")).toBe(0);
    expect(a.bonus("a", ["a"])).toBe(0);
  });

  it("ignore l'ordre des deux heros", () => {
    const a = new Affinites();
    ensemble(a, ["a", "b"], 120);
    expect(a.affinite("b", "a")).toBe(a.affinite("a", "b"));
  });
});

describe("Affinites — le bonus", () => {
  /** La promesse chiffree du §4.16 : confortable, jamais decisif. */
  it("ne depasse jamais 10%, meme avec une equipe entierement rodee", () => {
    const a = new Affinites();
    ensemble(a, EQUIPE, SECONDES_POUR_PLAFOND * 3);
    for (const hero of EQUIPE) {
      expect(a.bonus(hero, EQUIPE)).toBeCloseTo(BONUS_MAX, 6);
      expect(a.bonus(hero, EQUIPE)).toBeLessThanOrEqual(BONUS_MAX);
    }
  });

  it("moyenne les liens au lieu de les additionner", () => {
    const a = new Affinites();
    // Rode avec b, inconnu de c.
    ensemble(a, ["a", "b"], SECONDES_POUR_PLAFOND);
    // Un seul compagnon rode : plein bonus. Deux, dont un inconnu : la moitie.
    expect(a.bonus("a", ["a", "b"])).toBeCloseTo(BONUS_MAX, 6);
    expect(a.bonus("a", ["a", "b", "c"])).toBeCloseTo(BONUS_MAX / 2, 6);
  });

  it("ne donne rien a un heros qui sort seul", () => {
    const a = new Affinites();
    ensemble(a, EQUIPE, SECONDES_POUR_PLAFOND);
    expect(a.bonus("a", ["a"])).toBe(0);
    expect(a.bonus("a", [])).toBe(0);
  });
});

describe("Affinites — l'oubli", () => {
  it("s'efface six fois plus lentement qu'elle ne se gagne", () => {
    const a = new Affinites();
    ensemble(a, ["a", "b"], 300);
    const avant = a.affinite("a", "b");
    // b reste dehors, a rentre : le lien s'erode.
    ensemble(a, ["b"], 60);
    const perdu = (avant - a.affinite("a", "b")) * SECONDES_POUR_PLAFOND;
    expect(perdu).toBeCloseTo(60 * FACTEUR_OUBLI, 5);
  });

  it("ne perd rien quand toute l'equipe se repose", () => {
    const a = new Affinites();
    ensemble(a, ["a", "b"], 300);
    const avant = a.affinite("a", "b");
    ensemble(a, [], 10_000);
    expect(a.affinite("a", "b")).toBe(avant);
  });

  /**
   * Le garde-fou du §4.16 : on rouille, on ne desapprend pas. Sans ce plancher,
   * l'oubli punirait la rotation que la regle des 20% encourage.
   */
  it("ne redescend jamais sous le quart du meilleur niveau atteint", () => {
    const a = new Affinites();
    ensemble(a, ["a", "b"], SECONDES_POUR_PLAFOND);
    expect(a.affinite("a", "b")).toBe(1);

    // Des heures a se battre chacun de son cote.
    ensemble(a, ["b"], 100_000);
    expect(a.affinite("a", "b")).toBeCloseTo(PLANCHER_ACQUIS, 6);
  });

  it("remonte son plancher des qu'un nouveau record est atteint", () => {
    const a = new Affinites();
    ensemble(a, ["a", "b"], 120);
    ensemble(a, ["b"], 100_000);
    const premierPlancher = a.affinite("a", "b");

    ensemble(a, ["a", "b"], 600);
    ensemble(a, ["b"], 100_000);
    expect(a.affinite("a", "b")).toBeGreaterThan(premierPlancher);
  });

  it("n'erode jamais un lien en dessous de zero", () => {
    const a = new Affinites();
    ensemble(a, ["a"], 100_000);
    expect(a.affinite("a", "b")).toBe(0);
    expect(a.bonus("a", EQUIPE)).toBe(0);
  });
});

describe("le veto de la relation (§4.26)", () => {
  it("efface ce que deux ennemis avaient appris ensemble", () => {
    const a = new Affinites();
    a.ecouler(["h1", "h2"], ["h1", "h2"], SECONDES_POUR_PLAFOND);
    expect(a.affinite("h1", "h2")).toBe(1);

    a.oublier([["h1", "h2"]]);
    expect(a.affinite("h1", "h2")).toBe(0);
  });

  it("efface aussi le record : le plancher d'acquis ne leur rend rien", () => {
    const a = new Affinites();
    a.ecouler(["h1", "h2"], ["h1", "h2"], SECONDES_POUR_PLAFOND);
    a.oublier([["h1", "h2"]]);
    // Une seconde separes : sans record, rien a remonter.
    a.ecouler(["h1", "h2"], ["h1"], 1);
    expect(a.affinite("h1", "h2")).toBe(0);
  });

  it("ne touche pas aux autres paires", () => {
    const a = new Affinites();
    a.ecouler(["h1", "h2", "h3"], ["h1", "h2", "h3"], 60);
    a.oublier([["h1", "h2"]]);
    expect(a.affinite("h1", "h2")).toBe(0);
    expect(a.affinite("h1", "h3")).toBeGreaterThan(0);
  });
});
