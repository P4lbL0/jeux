import { choisirCarte, type CarteVue } from "./robot";

const carte = (c: Partial<CarteVue> = {}): CarteVue => ({
  fusion: false,
  palier: 0,
  deSaClasse: false,
  oublier: false,
  achat: false,
  ...c,
});

describe("Le robot choisit ses cartes (jalon 6.4)", () => {
  it("prend une fusion avant tout", () => {
    expect(choisirCarte([carte({ palier: 3, deSaClasse: true }), carte({ fusion: true }), carte()], "regle", 0)).toBe(1);
  });

  it("monte ce qu'il a déjà plutôt que de s'éparpiller", () => {
    expect(choisirCarte([carte({ deSaClasse: true }), carte({ palier: 2 }), carte()], "regle", 0)).toBe(1);
  });

  it("préfère sa classe entre deux nouveautés, et la première à égalité", () => {
    expect(choisirCarte([carte(), carte({ deSaClasse: true }), carte()], "regle", 0)).toBe(1);
    expect(choisirCarte([carte(), carte(), carte()], "regle", 0.99)).toBe(0);
  });

  it("plus de place : fusionner, sinon acheter, sinon oublier la moins montée", () => {
    const oublis = [carte({ oublier: true, palier: 4 }), carte({ oublier: true, palier: 1 }), carte({ oublier: true, palier: 2 })];
    expect(choisirCarte(oublis, "regle", 0)).toBe(1);
    expect(choisirCarte([...oublis, carte({ achat: true })], "regle", 0)).toBe(3);
    expect(choisirCarte([...oublis, carte({ fusion: true }), carte({ achat: true })], "regle", 0)).toBe(3);
  });

  it("au hasard, chaque carte peut sortir, et jamais hors de la liste", () => {
    const cartes = [carte(), carte(), carte()];
    expect(choisirCarte(cartes, "hasard", 0)).toBe(0);
    expect(choisirCarte(cartes, "hasard", 0.5)).toBe(1);
    expect(choisirCarte(cartes, "hasard", 0.9999)).toBe(2);
    expect(choisirCarte([], "hasard", 0.5)).toBe(-1);
  });
});
