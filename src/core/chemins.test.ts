import { describe, expect, it } from "vitest";
import { EGLISE, terrainEn } from "./carte";
import { Chemins, REGLAGES_CHEMINS, cleDeCase, estMarquable, usureDe } from "./chemins";
import { CASE } from "./grille";

/**
 * Les chemins qui s'usent (§4.24) : visibles a 30 passages, effaces apres
 * 4 journees sans passage, et un passage c'est entrer dans une case.
 */

// Un bout d'herbe pres de l'eglise : de la terre qu'un pas peut marquer.
const x0 = EGLISE.x + 4 * CASE;
const y0 = EGLISE.y;
const colonne = Math.floor(x0 / CASE);
const ligne = Math.floor(y0 / CASE);

/** Fait entrer `n` marcheurs distincts dans la case, chacun venant de la mer (qui ne se marque pas). */
function fouler(chemins: Chemins, n: number, jour: number) {
  let dernier = null;
  for (let i = 0; i < n; i += 1) {
    const marcheur = {};
    chemins.passer(marcheur, 10, 1000, jour);
    dernier = chemins.passer(marcheur, x0 + 3, y0 - 2, jour);
  }
  return dernier;
}

describe("Les chemins qui s'usent", () => {
  it("le bout d'herbe des tests est bien marquable, pas l'eau", () => {
    expect(terrainEn(x0, y0)).toBe("herbe");
    expect(estMarquable(x0, y0)).toBe(true);
    expect(estMarquable(10, 1000)).toBe(false);
  });

  it("un passage, c'est entrer dans une case : pietiner sur place n'use rien", () => {
    const chemins = new Chemins();
    const marcheur = {};
    for (let i = 0; i < 200; i += 1) chemins.passer(marcheur, x0 + (i % 3), y0, 1);
    expect(chemins.visibles).toHaveLength(0);
  });

  it("devient visible au trentieme passage, et se dessine la ou l'on marche vraiment", () => {
    const chemins = new Chemins();
    expect(fouler(chemins, REGLAGES_CHEMINS.passagesVisibles - 1, 1)).toBeNull();
    expect(chemins.visibles).toHaveLength(0);
    const changement = fouler(chemins, 1, 1);
    expect(changement?.quoi).toBe("redessiner");
    expect(chemins.visibles).toHaveLength(1);
    const cas = chemins.visibles[0]!;
    expect(cas.colonne).toBe(colonne);
    expect(cas.ligne).toBe(ligne);
    // Le centre est la moyenne des pas, pas le centre de la case.
    expect(cas.x).toBeCloseTo(x0 + 3, 5);
    expect(cas.y).toBeCloseTo(y0 - 2, 5);
  });

  it("ne se redessine pas a chaque pas, mais par paliers de passages", () => {
    const chemins = new Chemins();
    fouler(chemins, REGLAGES_CHEMINS.passagesVisibles, 1);
    let redessins = 0;
    for (let i = 0; i < REGLAGES_CHEMINS.pasDeRedessin * 2; i += 1) {
      if (fouler(chemins, 1, 1)) redessins += 1;
    }
    expect(redessins).toBe(2);
  });

  it("l'usure monte avec les passages et palit par journee sans passage", () => {
    const r = REGLAGES_CHEMINS;
    expect(usureDe({ passages: r.passagesVisibles - 1, dernierJour: 1 }, 1)).toBe(0);
    const neuve = usureDe({ passages: r.passagesVisibles, dernierJour: 1 }, 1);
    const creusee = usureDe({ passages: r.passagesCreuses, dernierJour: 1 }, 1);
    expect(neuve).toBeGreaterThan(0);
    expect(creusee).toBe(1);
    expect(creusee).toBeGreaterThan(neuve);
    const unJour = usureDe({ passages: r.passagesCreuses, dernierJour: 1 }, 2);
    expect(unJour).toBeLessThan(creusee);
    expect(unJour).toBeGreaterThan(0);
    expect(usureDe({ passages: r.passagesCreuses, dernierJour: 1 }, 1 + r.journeesAvantEffacement)).toBe(0);
  });

  it("s'efface apres quatre journees sans passage, et pas avant", () => {
    const chemins = new Chemins();
    fouler(chemins, REGLAGES_CHEMINS.passagesVisibles, 1);
    for (let jour = 2; jour < 1 + REGLAGES_CHEMINS.journeesAvantEffacement; jour += 1) {
      const changements = chemins.seLever(jour);
      expect(changements).toHaveLength(1);
      expect(changements[0]!.quoi).toBe("redessiner");
    }
    const derniers = chemins.seLever(1 + REGLAGES_CHEMINS.journeesAvantEffacement);
    expect(derniers).toHaveLength(1);
    expect(derniers[0]!.quoi).toBe("effacer");
    expect(chemins.visibles).toHaveLength(0);
    expect(chemins.seLever(9)).toHaveLength(0);
  });

  it("un passage apres des jours d'oubli ranime la case tout de suite", () => {
    const chemins = new Chemins();
    fouler(chemins, REGLAGES_CHEMINS.passagesVisibles, 1);
    chemins.seLever(3);
    const changement = fouler(chemins, 1, 3);
    expect(changement?.quoi).toBe("redessiner");
    expect(usureDe(chemins.visibles[0]!, 3)).toBe(usureDe({ passages: REGLAGES_CHEMINS.passagesVisibles + 1, dernierJour: 3 }, 3));
  });

  it("ne marque ni la place exclue, ni l'eau", () => {
    const chemins = new Chemins();
    chemins.exclure([cleDeCase(colonne, ligne)]);
    expect(fouler(chemins, REGLAGES_CHEMINS.passagesVisibles + 5, 1)).toBeNull();
    expect(chemins.visibles).toHaveLength(0);
    const marcheur = {};
    for (let i = 0; i < 100; i += 1) {
      chemins.passer(marcheur, 10, 1000, 1);
      chemins.passer(marcheur, 10 + CASE, 1000, 1);
    }
    expect(chemins.visibles).toHaveLength(0);
  });

  it("se sauve et se reprend : les memes cases, la meme usure", () => {
    const chemins = new Chemins();
    fouler(chemins, REGLAGES_CHEMINS.passagesVisibles + 10, 2);
    const sauve = chemins.sauver();
    expect(sauve).toHaveLength(1);
    const repris = new Chemins();
    repris.reprendre(JSON.parse(JSON.stringify(sauve)));
    expect(repris.sauver()).toEqual(sauve);
    expect(repris.autour(x0, y0, CASE)).toHaveLength(1);
    expect(repris.autour(x0 + 10 * CASE, y0, CASE)).toHaveLength(0);
  });
});
