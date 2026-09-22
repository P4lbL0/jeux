import { describe, expect, it } from "vitest";
import {
  Incendie,
  REGLAGES_INCENDIE,
  unCoupAllumeLeFeu,
  type Combustible,
  type PassageDuFeu,
} from "./incendie";
import { CASE } from "./grille";
import { Rng } from "./rng";

/**
 * Un tirage pilote a la main, comme celui du ciel (`meteo.test.ts`) : la suite
 * est imposee, donc une propagation precise se rejoue a l'identique. Une suite
 * vide rend 1 — c'est-a-dire **jamais rien** : aucune etincelle ne prend, ce
 * qui laisse tester l'usure d'un feu sans qu'il se repande.
 */
class RngTruque extends Rng {
  private suite: number[];

  constructor(suite: number[] = []) {
    super(0);
    this.suite = [...suite];
  }

  override next(): number {
    const valeur = this.suite.shift();
    return valeur === undefined ? 1 : valeur;
  }
}

const MAISON: Combustible = { id: "maison-1", x: 0, y: 0, sorte: "maison" };
const VOISINE: Combustible = { id: "maison-2", x: CASE, y: 0, sorte: "maison" };
const LOINTAINE: Combustible = { id: "maison-3", x: 10 * CASE, y: 0, sorte: "maison" };
const CHAMP: Combustible = { id: "champ-1", x: 0, y: CASE, sorte: "champ" };

/** Fait passer des secondes entieres, une par tick, et rend le dernier passage. */
function secondes(feu: Incendie, combien: number, options: { ciel?: number; autour?: Combustible[]; rng?: Rng } = {}) {
  const rng = options.rng ?? new RngTruque();
  let dernier: PassageDuFeu | null = null;
  for (let i = 0; i < combien; i++) {
    dernier = feu.avancer(i * REGLAGES_INCENDIE.tick, options.ciel ?? 1, options.autour ?? [], rng) ?? dernier;
  }
  return dernier;
}

describe("Incendie — ce qui prend feu", () => {
  it("commence sans rien qui brule", () => {
    const feu = new Incendie();
    expect(feu.actif).toBe(false);
    expect(feu.foyers).toHaveLength(0);
  });

  it("allume un foyer avec toute son ardeur", () => {
    const feu = new Incendie();
    const foyer = feu.allumer(MAISON, 0);
    expect(foyer?.ardeur).toBe(REGLAGES_INCENDIE.ardeurAuDepart);
    expect(feu.actif).toBe(true);
    expect(feu.brule("maison-1")).toBe(true);
  });

  it("ne fait qu'un feu quand deux sources tombent sur la meme maison", () => {
    const feu = new Incendie();
    feu.allumer(MAISON, 0);
    expect(feu.allumer(MAISON, 0)).toBeNull();
    expect(feu.foyers).toHaveLength(1);
  });

  it("rend le feu le plus proche, et rien au-dela de la portee demandee", () => {
    const feu = new Incendie();
    feu.allumer(LOINTAINE, 0);
    feu.allumer(VOISINE, 0);
    expect(feu.leProcheDe(0, 0)?.cible).toBe("maison-2");
    expect(feu.leProcheDe(0, 0, CASE / 2)).toBeNull();
  });
});

describe("Incendie — ce qu'un feu ronge", () => {
  it("ne fait rien tant que la seconde n'est pas passee", () => {
    const feu = new Incendie();
    feu.allumer(MAISON, 0);
    expect(feu.avancer(0, 1, [], new RngTruque())).not.toBeNull();
    expect(feu.avancer(500, 1, [], new RngTruque())).toBeNull();
  });

  it("ronge des points de vie sur une maison, de la maturite sur un champ", () => {
    const feu = new Incendie();
    feu.allumer(MAISON, 0);
    feu.allumer(CHAMP, 0);
    const passage = feu.avancer(0, 1, [], new RngTruque());
    expect(passage?.degats).toEqual([
      { cible: "maison-1", sorte: "maison", degats: REGLAGES_INCENDIE.degatsParSeconde.maison },
      { cible: "champ-1", sorte: "champ", degats: REGLAGES_INCENDIE.degatsParSeconde.champ },
    ]);
  });

  it("compte ce qu'il a mange : un champ n'en a plus rien au bout de huit secondes", () => {
    const feu = new Incendie();
    feu.allumer(CHAMP, 0);
    secondes(feu, 8);
    expect(feu.foyerDe("champ-1")?.ronge).toBeGreaterThanOrEqual(1);
  });

  it("abat une maison de 200 points de vie en une quarantaine de secondes", () => {
    const feu = new Incendie();
    feu.allumer(MAISON, 0);
    let vie = 200;
    for (let i = 0; i < 40; i++) {
      const passage = feu.avancer(i * REGLAGES_INCENDIE.tick, 1, [], new RngTruque());
      for (const degat of passage?.degats ?? []) vie -= degat.degats;
    }
    expect(vie).toBeLessThanOrEqual(0);
  });

  it("finit par s'epuiser tout seul, bien apres avoir mange sa maison", () => {
    const feu = new Incendie();
    feu.allumer(MAISON, 0);
    const attendu = Math.ceil(REGLAGES_INCENDIE.ardeurAuDepart / REGLAGES_INCENDIE.epuisementParSeconde);
    secondes(feu, attendu - 1);
    expect(feu.actif).toBe(true);
    const dernier = feu.avancer((attendu - 1) * REGLAGES_INCENDIE.tick, 1, [], new RngTruque());
    expect(dernier?.eteints.map((f) => f.cible)).toEqual(["maison-1"]);
    expect(feu.actif).toBe(false);
  });

  it("s'epuise deux fois plus vite sous la pluie", () => {
    const feu = new Incendie();
    feu.allumer(MAISON, 0);
    const moitie = Math.ceil(REGLAGES_INCENDIE.ardeurAuDepart / REGLAGES_INCENDIE.epuisementParSeconde / 2);
    secondes(feu, moitie, { ciel: 2 });
    expect(feu.actif).toBe(false);
  });
});

describe("Incendie — ce qui l'eteint", () => {
  it("neuf seaux viennent a bout d'un feu neuf, huit n'y suffisent pas", () => {
    const feu = new Incendie();
    feu.allumer(MAISON, 0);
    for (let i = 0; i < 8; i++) feu.arroser("maison-1", REGLAGES_INCENDIE.pointsParSeau);
    expect(feu.actif).toBe(true);
    expect(feu.arroser("maison-1", REGLAGES_INCENDIE.pointsParSeau)).toBe(true);
    expect(feu.actif).toBe(false);
  });

  it("compte les seaux double sous la pluie", () => {
    const feu = new Incendie();
    feu.allumer(MAISON, 0);
    for (let i = 0; i < 5; i++) feu.arroser("maison-1", REGLAGES_INCENDIE.pointsParSeau, 2);
    expect(feu.actif).toBe(false);
  });

  it("laisse un heros eteindre un feu neuf en cinq secondes", () => {
    const feu = new Incendie();
    feu.allumer(MAISON, 0);
    for (let i = 0; i < 5; i++) feu.arroser("maison-1", REGLAGES_INCENDIE.pointsHerosParSeconde);
    expect(feu.actif).toBe(false);
  });

  it("arroser ce qui ne brule pas ne fait rien", () => {
    const feu = new Incendie();
    expect(feu.arroser("maison-1", 1000)).toBe(false);
  });

  it("s'eteint quand la maison tombe : il n'a plus rien a manger", () => {
    const feu = new Incendie();
    feu.allumer(MAISON, 0);
    feu.eteindre("maison-1");
    expect(feu.actif).toBe(false);
  });
});

describe("Incendie — la propagation", () => {
  it("prend chez la voisine a deux cases, et jamais chez la lointaine", () => {
    const feu = new Incendie();
    feu.allumer(MAISON, 0);
    const autour = [VOISINE, LOINTAINE];
    // La premiere etincelle est tentee a la quatrieme seconde ; le tirage a 0
    // la fait prendre a coup sur.
    const passage = secondes(feu, 6, { autour, rng: new RngTruque([0, 0, 0, 0, 0, 0]) });
    expect(passage?.departs.map((f) => f.cible) ?? []).not.toContain("maison-3");
    expect(feu.brule("maison-2")).toBe(true);
    expect(feu.brule("maison-3")).toBe(false);
  });

  it("ne tente rien avant la quatrieme seconde", () => {
    const feu = new Incendie();
    feu.allumer(MAISON, 0);
    secondes(feu, 4, { autour: [VOISINE], rng: new RngTruque([0, 0, 0]) });
    expect(feu.brule("maison-2")).toBe(false);
  });

  it("ne rallume pas ce qui brule deja", () => {
    const feu = new Incendie();
    feu.allumer(MAISON, 0);
    feu.allumer(VOISINE, 0);
    secondes(feu, 6, { autour: [MAISON, VOISINE], rng: new RngTruque(Array(20).fill(0)) });
    expect(feu.foyers).toHaveLength(2);
  });

  it("ne fait pas jouer son tour a un feu ne dans le meme passage", () => {
    const feu = new Incendie();
    feu.allumer(MAISON, 0);
    const trois: Combustible = { id: "maison-4", x: 2 * CASE, y: 0, sorte: "maison" };
    // Cinq secondes : la voisine prend a la quatrieme, et si elle jouait son
    // tour dans la foulee, la troisieme maison serait deja en feu.
    secondes(feu, 5, { autour: [VOISINE, trois], rng: new RngTruque(Array(20).fill(0)) });
    expect(feu.brule("maison-2")).toBe(true);
    expect(feu.brule("maison-4")).toBe(false);
  });

  it("sauve la voisine sous la pluie : la chance de prendre est divisee", () => {
    const entreLesDeux = REGLAGES_INCENDIE.chanceDEtincelle / 1.5;
    const auSec = new Incendie();
    auSec.allumer(MAISON, 0);
    secondes(auSec, 6, { autour: [VOISINE], rng: new RngTruque(Array(20).fill(entreLesDeux)) });
    expect(auSec.brule("maison-2")).toBe(true);

    const sousLaPluie = new Incendie();
    sousLaPluie.allumer(MAISON, 0);
    secondes(sousLaPluie, 6, { ciel: 2, autour: [VOISINE], rng: new RngTruque(Array(20).fill(entreLesDeux)) });
    expect(sousLaPluie.brule("maison-2")).toBe(false);
  });
});

describe("Incendie — ce qu'un coup allume", () => {
  it("n'allume rien sur une maison qui tient encore debout", () => {
    const rng = new Rng(1);
    for (let i = 0; i < 50; i++) expect(unCoupAllumeLeFeu(0.31, rng)).toBe(false);
  });

  it("allume une fois sur deux sous le seuil", () => {
    const rng = new Rng(12345);
    let feux = 0;
    const coups = 4_000;
    for (let i = 0; i < coups; i++) if (unCoupAllumeLeFeu(0.2, rng)) feux++;
    expect(feux / coups).toBeCloseTo(REGLAGES_INCENDIE.chanceDuCoup, 1);
  });
});

describe("Incendie — la sauvegarde", () => {
  it("garde les feux et leur ardeur, et recale l'etincelle sur la partie reprise", () => {
    const feu = new Incendie();
    feu.allumer(MAISON, 0);
    feu.arroser("maison-1", REGLAGES_INCENDIE.pointsParSeau);
    const etat = feu.instantane;

    const reprise = new Incendie();
    reprise.reprendre(etat, 900_000);
    const foyer = reprise.foyerDe("maison-1");
    expect(foyer?.ardeur).toBe(REGLAGES_INCENDIE.ardeurAuDepart - REGLAGES_INCENDIE.pointsParSeau);
    expect(foyer?.prochaineEtincelle).toBe(900_000 + REGLAGES_INCENDIE.delaiEntreEtincelles);
  });

  it("reprend une partie ou rien ne brulait", () => {
    const feu = new Incendie();
    feu.allumer(MAISON, 0);
    feu.reprendre(undefined, 0);
    expect(feu.actif).toBe(false);
  });
});
