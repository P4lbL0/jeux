import { describe, expect, it } from "vitest";
import { ORDRE_CLASSES } from "./classes";
import { creerPersonne } from "./personne";
import { Rng } from "./rng";
import {
  CHANCE_DANGER,
  NIVEAUX_PAR_FORMATION,
  PART_MAJEURS,
  PART_PORTEURS,
  SEUIL_DANGER,
  entrainer,
  reveilParLeDanger,
  rituel,
  tirerLeDon,
  type Don,
} from "./dons";

describe("Le don, seule source de heros (§4.1, §4.29)", () => {
  it("n'en donne qu'a un habitant sur dix, a une poignee pres", () => {
    const rng = new Rng(7);
    let porteurs = 0;
    const total = 20_000;
    for (let i = 0; i < total; i++) if (tirerLeDon(rng)) porteurs++;

    const part = porteurs / total;
    expect(part).toBeGreaterThan(PART_PORTEURS * 0.85);
    expect(part).toBeLessThan(PART_PORTEURS * 1.15);
  });

  it("garde le don majeur exceptionnel : un sur vingt, donc un habitant sur deux cents", () => {
    const rng = new Rng(11);
    let porteurs = 0;
    let majeurs = 0;
    for (let i = 0; i < 40_000; i++) {
      const don = tirerLeDon(rng);
      if (!don) continue;
      porteurs++;
      if (don.majeur) majeurs++;
    }

    const part = majeurs / porteurs;
    expect(part).toBeGreaterThan(PART_MAJEURS * 0.7);
    expect(part).toBeLessThan(PART_MAJEURS * 1.3);
  });

  it("tire une classe reelle, et pas toujours la meme", () => {
    const rng = new Rng(3);
    const classes = new Set<string>();
    for (let i = 0; i < 4000; i++) {
      const don = tirerLeDon(rng);
      if (don) classes.add(don.classe);
    }
    // Les sept classes doivent sortir : un don qui ne donnerait que des
    // guerriers ferait de chaque reveil la meme histoire.
    expect(classes.size).toBe(ORDRE_CLASSES.length);
    for (const classe of classes) expect(ORDRE_CLASSES).toContain(classe);
  });

  it("nait endormi : personne ne le sait au depart", () => {
    const rng = new Rng(5);
    for (let i = 0; i < 500; i++) {
      const don = tirerLeDon(rng);
      if (don) expect(don.eveille).toBe(false);
    }
  });

  it("suit la personne, et se retire de la meme graine", () => {
    const un = creerPersonne("Ysoret", new Rng(42));
    const deux = creerPersonne("Ysoret", new Rng(42));
    expect(deux.don).toEqual(un.don);
    // Il est porte par la personne, donc il traverse tout ce qui la porte :
    // l'arrivant a la porte, l'habitant, et le heros qu'elle deviendra.
    expect(un).toHaveProperty("don");
  });
});

describe("Les trois voies du reveil (§4.1, §6)", () => {
  const dormant = (): Don => ({ classe: "mage", majeur: false, eveille: false });

  it("l'entrainement tranche : on sait, dans un sens comme dans l'autre", () => {
    const avec = entrainer(dormant());
    expect(avec.don).not.toBeNull();
    expect(avec.don!.eveille).toBe(true);
    expect(avec.don!.classe).toBe("mage");

    const sans = entrainer(null);
    expect(sans.don).toBeNull();
  });

  it("l'entrainement n'est jamais perdu : il fait monter en combat de toute facon", () => {
    expect(entrainer(null).niveauxGagnes).toBe(NIVEAUX_PAR_FORMATION);
    expect(entrainer(dormant()).niveauxGagnes).toBe(NIVEAUX_PAR_FORMATION);
    // Deja eveille : il gagne des niveaux, il ne redevient pas heros deux fois.
    expect(entrainer({ ...dormant(), eveille: true }).don).toBeNull();
  });

  it("le danger ne reveille rien tant qu'on n'a pas failli mourir", () => {
    const rng = new Rng(1);
    // Au-dessus du seuil des 20 %, jamais — meme en mille essais.
    for (let i = 0; i < 1000; i++) {
      expect(reveilParLeDanger(dormant(), SEUIL_DANGER + 0.01, rng)).toBe(false);
    }
  });

  it("le danger finit par reveiller, sous le seuil, et seulement un porteur", () => {
    const rng = new Rng(2);
    let reveils = 0;
    const essais = 20_000;
    for (let i = 0; i < essais; i++) {
      if (reveilParLeDanger(dormant(), 0.05, rng)) reveils++;
    }
    const part = reveils / essais;
    expect(part).toBeGreaterThan(CHANCE_DANGER * 0.85);
    expect(part).toBeLessThan(CHANCE_DANGER * 1.15);

    // Celui qui ne porte rien ne transcende jamais, quoi qu'il traverse : c'est
    // toute la regle « on ne devient pas heros a l'usure ».
    for (let i = 0; i < 2000; i++) expect(reveilParLeDanger(null, 0, rng)).toBe(false);
  });

  it("le rituel est sur : il ne tire rien du tout", () => {
    for (let i = 0; i < 100; i++) {
      const sorti = rituel(dormant());
      expect(sorti).not.toBeNull();
      expect(sorti!.eveille).toBe(true);
    }
    expect(rituel(null)).toBeNull();
    expect(rituel({ ...dormant(), eveille: true })).toBeNull();
  });

  it("ne reveille jamais deux fois le meme don", () => {
    const eveille = { ...dormant(), eveille: true };
    expect(entrainer(eveille).don).toBeNull();
    expect(rituel(eveille)).toBeNull();
    expect(reveilParLeDanger(eveille, 0, new Rng(9))).toBe(false);
  });
});
