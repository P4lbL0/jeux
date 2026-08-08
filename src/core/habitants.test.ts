import { beforeEach, describe, expect, it } from "vitest";
import {
  PRODUCTION,
  REGLAGES_VILLAGE,
  cadence,
  creerHabitant,
  joursDeVivres,
  nourrir,
  plafondDeNiveau,
  rangSuivant,
  reinitialiserIdentifiants,
  stocksVides,
  travailler,
} from "./habitants";

beforeEach(() => reinitialiserIdentifiants());

describe("Un habitant", () => {
  it("nait au rang F, niveau 1, et il est prudent", () => {
    const h = creerHabitant("Ombeline", "mineur");
    expect(h.rang).toBe("F");
    expect(h.niveau).toBe(1);
    expect(h.posture).toBe("prudent");
    expect(h.vivant).toBe(true);
  });

  it("produit ce que son metier produit", () => {
    const h = creerHabitant("Gaspard", "bucheron");
    expect(travailler(h, 1)?.ressource).toBe("bois");
  });

  it("ne produit rien s'il est mort", () => {
    const h = creerHabitant("Nine", "pecheur");
    h.vivant = false;
    expect(travailler(h, 1)).toBeNull();
  });

  it("ne produit rien s'il a faim", () => {
    const h = creerHabitant("Nine", "pecheur");
    h.rassasie = false;
    expect(cadence(h)).toBe(0);
  });

  it("ne verse rien dans les stocks s'il ne recolte pas", () => {
    // Le forgeron transforme, le guetteur veille, et le fermier fait **pousser**
    // — le ble arrive a la moisson, pas a la seconde (§4.18).
    for (const metier of ["forgeron", "charpentier", "guetteur", "fermier"] as const) {
      expect(PRODUCTION[metier]).toBeNull();
      expect(travailler(creerHabitant("X", metier), 10)).toBeNull();
    }
  });

  it("garde quand meme une cadence quand il ne recolte pas", () => {
    // C'est elle qui fait pousser les champs : un fermier sans cadence ne ferait
    // rien murir du tout.
    expect(cadence(creerHabitant("Fermier", "fermier"))).toBeGreaterThan(0);
  });

  it("progresse en travaillant meme sans rien verser dans les stocks", () => {
    const fermier = creerHabitant("Fermier", "fermier");
    travailler(fermier, 30);
    expect(fermier.niveau).toBeGreaterThan(1);
  });
});

describe("Le rang et le niveau ne changent que la cadence (§4.18)", () => {
  it("un rang d'ecart se voit immediatement", () => {
    const f = creerHabitant("F", "mineur", "F");
    const d = creerHabitant("D", "mineur", "D");
    expect(cadence(d)).toBeGreaterThan(cadence(f) * 1.5);
  });

  it("le niveau ajoute, il ne multiplie pas", () => {
    const bas = creerHabitant("Bas", "mineur");
    const haut = creerHabitant("Haut", "mineur");
    haut.niveau = 10;
    const attendu = cadence(bas) * (1 + 9 * REGLAGES_VILLAGE.gainParNiveau);
    expect(cadence(haut)).toBeCloseTo(attendu);
  });

  it("le rang debloque un plafond de niveau, comme pour les heros (§4.1)", () => {
    expect(plafondDeNiveau("F")).toBe(REGLAGES_VILLAGE.plafondParRang);
    expect(plafondDeNiveau("E")).toBeGreaterThan(plafondDeNiveau("F"));
    expect(rangSuivant("F")).toBe("E");
    expect(rangSuivant("SSR")).toBeNull();
  });
});

describe("Le niveau se gagne en travaillant", () => {
  it("monte tout seul, sans qu'on distribue quoi que ce soit", () => {
    const h = creerHabitant("Aubin", "bucheron");
    travailler(h, 20);
    expect(h.niveau).toBeGreaterThan(1);
  });

  it("s'arrete net au plafond du rang", () => {
    const h = creerHabitant("Aubin", "bucheron");
    travailler(h, 10_000);
    expect(h.niveau).toBe(plafondDeNiveau("F"));
  });

  it("n'accumule pas de progression une fois au plafond", () => {
    // Sinon acheter un rang ferait gagner cinq niveaux d'un coup, gratuitement.
    const h = creerHabitant("Aubin", "bucheron");
    travailler(h, 10_000);
    expect(h.progression).toBe(0);
  });
});

describe("La faim (§4.18)", () => {
  it("nourrit tout le monde quand il y a de quoi", () => {
    const habitants = [creerHabitant("A", "mineur"), creerHabitant("B", "pecheur")];
    const stocks = stocksVides();
    stocks.poisson = 100;
    expect(nourrir(habitants, stocks)).toBe(0);
    expect(habitants.every((h) => h.rassasie)).toBe(true);
  });

  it("mange le poisson avant le ble", () => {
    // La peche est la source sure ; on garde en reserve celle qu'une horde peut
    // detruire.
    const habitants = [creerHabitant("A", "mineur")];
    const stocks = stocksVides();
    stocks.poisson = REGLAGES_VILLAGE.appetit;
    stocks.ble = 50;
    nourrir(habitants, stocks);
    expect(stocks.poisson).toBe(0);
    expect(stocks.ble).toBe(50);
  });

  it("complete avec le ble quand le poisson ne suffit pas", () => {
    const habitants = [creerHabitant("A", "mineur")];
    const stocks = stocksVides();
    stocks.poisson = 3;
    stocks.ble = 50;
    nourrir(habitants, stocks);
    expect(stocks.poisson).toBe(0);
    expect(stocks.ble).toBe(50 - (REGLAGES_VILLAGE.appetit - 3));
  });

  it("arrete de faire travailler ceux qui n'ont pas mange, sans les tuer", () => {
    const habitants = [creerHabitant("A", "mineur"), creerHabitant("B", "pecheur")];
    const stocks = stocksVides();
    stocks.poisson = REGLAGES_VILLAGE.appetit;

    expect(nourrir(habitants, stocks)).toBe(1);
    expect(habitants[0]!.rassasie).toBe(true);
    expect(habitants[1]!.rassasie).toBe(false);
    expect(cadence(habitants[1]!)).toBe(0);
    // Le §4.18 refuse une mort qui ne vienne pas d'un monstre.
    expect(habitants.every((h) => h.vivant)).toBe(true);
  });

  it("ne nourrit pas les morts", () => {
    const habitants = [creerHabitant("A", "mineur")];
    habitants[0]!.vivant = false;
    const stocks = stocksVides();
    stocks.poisson = 100;
    nourrir(habitants, stocks);
    expect(stocks.poisson).toBe(100);
  });

  it("dit combien de jours le stock tient encore", () => {
    const habitants = [creerHabitant("A", "mineur"), creerHabitant("B", "pecheur")];
    const stocks = stocksVides();
    stocks.ble = REGLAGES_VILLAGE.appetit * 2 * 3;
    expect(joursDeVivres(habitants, stocks)).toBeCloseTo(3);
  });

  it("ne divise jamais par zero quand le village est vide", () => {
    expect(joursDeVivres([], stocksVides())).toBe(Infinity);
  });
});
