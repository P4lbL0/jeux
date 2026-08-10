import { describe, expect, it } from "vitest";
import {
  ETATS,
  avancerEtats,
  contracter,
  estMourant,
  lireEtat,
  pireEtat,
  soigner,
  stressDesEtats,
  type EtatSubi,
} from "./etats";
import { agreger, idTrait, modificateursVierges } from "./traits";

const SAIN = modificateursVierges();

describe("Contracter un etat", () => {
  it("le pose au premier palier", () => {
    const etats: EtatSubi[] = [];
    expect(contracter(etats, "maladie")).toBe(true);
    expect(etats).toHaveLength(1);
    expect(lireEtat(etats[0]!)).toBe("Malade");
  });

  /**
   * Un heros au contact d'une horde encaisse dix coups par seconde. Sans cette
   * regle il porterait dix hemorragies et mourrait dans l'image suivante — ni
   * lisible, ni juste.
   */
  it("aggrave au lieu de cumuler quand il l'a deja", () => {
    const etats: EtatSubi[] = [];
    contracter(etats, "blessure");
    contracter(etats, "blessure");
    expect(etats).toHaveLength(1);
    expect(etats[0]!.palier).toBe(1);
  });

  it("ne fait plus rien une fois au stade Mourant", () => {
    const etats: EtatSubi[] = [];
    contracter(etats, "blessure");
    contracter(etats, "blessure");
    contracter(etats, "blessure");
    expect(etats[0]!.palier).toBe(2);
    expect(contracter(etats, "blessure")).toBe(false);
  });
});

describe("La mort lente", () => {
  it("tue une maladie non soignee en six journees, comme promet le §4.23", () => {
    const etats: EtatSubi[] = [];
    contracter(etats, "maladie");

    // Cinq journees : il est Mourant, mais vivant. Le joueur a le temps.
    const avant = avancerEtats(etats, 5, SAIN);
    expect(avant.some((e) => e.quoi === "mort")).toBe(false);
    expect(estMourant(etats)).toBe(true);

    const apres = avancerEtats(etats, 2, SAIN);
    expect(apres.some((e) => e.quoi === "mort")).toBe(true);
  });

  it("annonce chaque palier en le franchissant", () => {
    const etats: EtatSubi[] = [];
    contracter(etats, "maladie");
    const evenements = avancerEtats(etats, 4.5, SAIN);
    expect(evenements.map((e) => e.nom)).toEqual(["Gravement malade", "Mourant"]);
  });

  it("laisse un Robuste tenir bien plus longtemps qu'un Hemophile", () => {
    const robuste = agreger([idTrait("robuste")], []);
    const hemophile = agreger([idTrait("hemophile")], []);

    const chezLeRobuste: EtatSubi[] = [];
    contracter(chezLeRobuste, "blessure");
    const chezLHemophile: EtatSubi[] = [];
    contracter(chezLHemophile, "blessure");

    avancerEtats(chezLeRobuste, 3, robuste);
    const mortHemophile = avancerEtats(chezLHemophile, 3, hemophile);

    expect(mortHemophile.some((e) => e.quoi === "mort")).toBe(true);
    expect(chezLeRobuste[0]!.palier).toBeLessThan(2);
  });

  /**
   * ⚠️ Elle contredit sciemment le principe « lentement et visiblement ». C'est
   * le contraste qui la rend lisible : la maladie est une gestion, l'hemorragie
   * est une urgence (§4.23).
   */
  it("tue une hemorragie en une seule journee", () => {
    const etats: EtatSubi[] = [];
    contracter(etats, "hemorragie");
    expect(avancerEtats(etats, 0.9, SAIN).some((e) => e.quoi === "mort")).toBe(false);
    expect(avancerEtats(etats, 0.3, SAIN).some((e) => e.quoi === "mort")).toBe(true);
  });

  it("ne tue jamais avec une infection ni une lethargie", () => {
    for (const cle of ["infection", "lethargie"] as const) {
      const etats: EtatSubi[] = [];
      contracter(etats, cle);
      const evenements = avancerEtats(etats, 60, SAIN);
      expect(evenements.some((e) => e.quoi === "mort")).toBe(false);
      expect(etats[0]!.palier).toBe(2);
    }
  });

  it("arrete tout des qu'un etat tue : il n'y a plus personne a aggraver", () => {
    const etats: EtatSubi[] = [];
    contracter(etats, "hemorragie");
    contracter(etats, "maladie");
    const evenements = avancerEtats(etats, 1.2, SAIN);
    const mort = evenements.findIndex((e) => e.quoi === "mort");
    expect(mort).toBe(evenements.length - 1);
  });
});

describe("Le soin, et le prix de la survie", () => {
  it("ne laisse aucune sequelle quand il n'etait pas Mourant", () => {
    const etats: EtatSubi[] = [];
    contracter(etats, "maladie");
    expect(soigner(etats, "maladie", 0.9)).toEqual({ soigne: true, sequelle: null });
    expect(etats).toHaveLength(0);
  });

  /**
   * C'est le meilleur dilemme du document : tu l'as sauve, il est devenu un
   * fardeau. Une sequelle ne s'obtient **jamais** au hasard et **jamais** hors
   * du stade Mourant — ce test tient les deux bouts.
   */
  it("laisse toujours une sequelle quand on le sauve au stade Mourant", () => {
    for (const tirage of [0, 0.25, 0.5, 0.75, 0.999]) {
      const etats: EtatSubi[] = [];
      contracter(etats, "blessure");
      avancerEtats(etats, 4.5, SAIN);
      expect(etats[0]!.palier).toBe(2);
      expect(soigner(etats, "blessure", tirage).sequelle).not.toBeNull();
    }
  });

  it("ne soigne pas ce qu'il n'a pas", () => {
    expect(soigner([], "maladie", 0.5)).toEqual({ soigne: false, sequelle: null });
  });
});

describe("La lecture des etats", () => {
  it("remonte le pire palier, pas le premier venu", () => {
    const etats: EtatSubi[] = [];
    contracter(etats, "infection");
    contracter(etats, "blessure");
    contracter(etats, "blessure");
    expect(pireEtat(etats)?.cle).toBe("blessure");
    expect(pireEtat([])).toBeNull();
  });

  it("fait monter le stress d'autant plus que le palier est haut", () => {
    const leger: EtatSubi[] = [{ cle: "maladie", palier: 0, avancement: 0 }];
    const grave: EtatSubi[] = [{ cle: "maladie", palier: 2, avancement: 0 }];
    expect(stressDesEtats(grave)).toBeGreaterThan(stressDesEtats(leger));
    expect(stressDesEtats([])).toBe(0);
  });

  it("garde une infection contagieuse et une maladie qui ne l'est pas", () => {
    expect(ETATS.infection.contagieux).toBe(true);
    expect(ETATS.maladie.contagieux).toBe(false);
  });
});
