import { describe, expect, it } from "vitest";
import {
  CONDITIONS,
  Eglise,
  NIVEAU_MAX,
  PALIERS,
  RELEVEMENT,
  type ContexteMontee,
} from "./eglise";
import { stocksVides, type Stocks } from "./habitants";

/**
 * Ce qui se teste ici, c'est la regle la plus delicate du bloc 4 : « elle
 * tombe, elle se releve » (DESIGN.md §4.22). Une eglise qui ne se releverait
 * pas, ou qui se releverait gratuitement, casserait la partie sans qu'aucun
 * type ne s'en plaigne.
 */

function stocksAvec(valeurs: Partial<Stocks>): Stocks {
  return { ...stocksVides(), ...valeurs };
}

function contexte(partiel: Partial<ContexteMontee> = {}): ContexteMontee {
  return {
    stocks: stocksAvec({ bois: 9999, minerai: 9999 }),
    population: 99,
    ...partiel,
  };
}

describe("Eglise — elle est debout des la premiere minute", () => {
  it("demarre au niveau 1, intacte et fonctionnelle", () => {
    const eglise = new Eglise();
    expect(eglise.niveau).toBe(1);
    expect(eglise.etat).toBe("debout");
    expect(eglise.pv).toBe(PALIERS[1].pvMax);
    expect(eglise.fonctionne).toBe(true);
  });

  it("soigne dans un rayon plus petit que l'ancien cercle du village", () => {
    // Le cercle VILLAGE valait 150 : le §4.22 veut qu'on rentre vraiment.
    expect(new Eglise().rayonSoin).toBeLessThan(150);
  });
});

describe("Eglise — elle tombe", () => {
  it("encaisse sans tomber tant qu'il lui reste des points de vie", () => {
    const eglise = new Eglise();
    expect(eglise.encaisser(PALIERS[1].pvMax - 1)).toBe(false);
    expect(eglise.etat).toBe("debout");
  });

  it("passe en ruine quand ses points de vie atteignent zero", () => {
    const eglise = new Eglise();
    expect(eglise.encaisser(PALIERS[1].pvMax)).toBe(true);
    expect(eglise.etat).toBe("ruine");
    expect(eglise.pv).toBe(0);
  });

  it("ne signale sa chute qu'une seule fois", () => {
    const eglise = new Eglise();
    eglise.encaisser(99_999);
    // Sans ca, chaque coup porte sur la ruine relancerait l'annonce et la
    // secousse d'ecran.
    expect(eglise.encaisser(99_999)).toBe(false);
  });

  it("met dehors ceux qui s'etaient refugies dedans", () => {
    const eglise = new Eglise();
    eglise.refugies = 4;
    eglise.encaisser(99_999);
    expect(eglise.refugies).toBe(0);
  });

  it("ne soigne plus rien une fois a terre", () => {
    const eglise = new Eglise();
    eglise.encaisser(99_999);
    expect(eglise.rayonSoin).toBe(0);
    expect(eglise.fonctionne).toBe(false);
  });
});

describe("Eglise — elle se releve", () => {
  it("refuse de demarrer le chantier sans le bois", () => {
    const eglise = new Eglise();
    eglise.encaisser(99_999);
    const stocks = stocksAvec({ bois: (RELEVEMENT.cout.bois ?? 0) - 1 });
    expect(eglise.lancerRelevement(stocks)).toBe(false);
    expect(eglise.etat).toBe("ruine");
  });

  it("preleve le bois au demarrage, et non a l'arrivee", () => {
    const eglise = new Eglise();
    eglise.encaisser(99_999);
    const stocks = stocksAvec({ bois: 300 });
    expect(eglise.lancerRelevement(stocks)).toBe(true);
    expect(stocks.bois).toBe(300 - (RELEVEMENT.cout.bois ?? 0));
  });

  it("ne se releve pas avant la fin de la journee entiere", () => {
    const eglise = new Eglise();
    eglise.encaisser(99_999);
    eglise.lancerRelevement(stocksAvec({ bois: 300 }));

    expect(eglise.majorer(RELEVEMENT.duree - 1)).toBe(false);
    expect(eglise.etat).toBe("relevement");
    expect(eglise.rayonSoin).toBe(0);

    expect(eglise.majorer(1)).toBe(true);
    expect(eglise.etat).toBe("debout");
  });

  it("repart intacte et au meme niveau", () => {
    const eglise = new Eglise();
    eglise.monter(contexte());
    expect(eglise.niveau).toBe(2);

    eglise.encaisser(99_999);
    eglise.lancerRelevement(stocksAvec({ bois: 300 }));
    eglise.majorer(RELEVEMENT.duree);

    // Une chute coute une journee et du bois ; elle ne fait pas perdre la
    // progression de toute une partie.
    expect(eglise.niveau).toBe(2);
    expect(eglise.pv).toBe(PALIERS[2].pvMax);
  });

  it("ne lance pas un chantier sur une eglise debout", () => {
    const eglise = new Eglise();
    expect(eglise.lancerRelevement(stocksAvec({ bois: 300 }))).toBe(false);
  });

  it("rend l'avancement lisible pour l'interface", () => {
    const eglise = new Eglise();
    expect(eglise.partRelevement).toBe(0);

    eglise.encaisser(99_999);
    eglise.lancerRelevement(stocksAvec({ bois: 300 }));
    eglise.majorer(RELEVEMENT.duree / 2);
    expect(eglise.partRelevement).toBeCloseTo(0.5, 5);
  });
});

describe("Eglise — les quatre conditions", () => {
  it("monte quand les quatre sont reunies", () => {
    const eglise = new Eglise();
    const ctx = contexte({ argent: 9999, satisfaction: 100 });
    expect(eglise.peutMonter(ctx).possible).toBe(true);
    expect(eglise.monter(ctx)).toBe(true);
    expect(eglise.niveau).toBe(2);
  });

  it("refuse et dit ce qui manque, condition par condition", () => {
    const eglise = new Eglise();
    const verdict = eglise.peutMonter({
      stocks: stocksVides(),
      population: 0,
      argent: 0,
      satisfaction: 0,
    });
    expect(verdict.possible).toBe(false);
    expect(verdict.manque).toEqual(["argent", "materiaux", "population", "satisfaction"]);
  });

  it("neutralise l'argent et la satisfaction tant que les blocs 5 et 6 n'existent pas", () => {
    // C'est la decision du §4.22 : absent veut dire « ce systeme n'est pas la »,
    // surtout pas « zero ». Sinon l'eglise ne monterait jamais d'ici le bloc 6.
    const eglise = new Eglise();
    const verdict = eglise.peutMonter(contexte());
    expect(verdict.possible).toBe(true);
  });

  it("distingue bien « pas de systeme » de « zero argent »", () => {
    const eglise = new Eglise();
    expect(eglise.peutMonter(contexte({ argent: 0 })).manque).toContain("argent");
    expect(eglise.peutMonter(contexte()).manque).not.toContain("argent");
  });

  it("preleve les materiaux, et eux seuls", () => {
    const eglise = new Eglise();
    const stocks = stocksAvec({ bois: 500, minerai: 500, poisson: 50 });
    eglise.monter(contexte({ stocks }));

    const requis = CONDITIONS[2];
    expect(stocks.bois).toBe(500 - (requis.materiaux.bois ?? 0));
    expect(stocks.minerai).toBe(500 - (requis.materiaux.minerai ?? 0));
    expect(stocks.poisson).toBe(50);
  });

  it("ne paie rien quand la montee est refusee", () => {
    const eglise = new Eglise();
    const stocks = stocksAvec({ bois: 500, minerai: 500 });
    expect(eglise.monter(contexte({ stocks, population: 0 }))).toBe(false);
    expect(stocks.bois).toBe(500);
    expect(stocks.minerai).toBe(500);
  });

  it("ne repare pas gratuitement l'eglise qu'on ameliore", () => {
    const eglise = new Eglise();
    eglise.encaisser(500);
    const avant = eglise.pv;

    eglise.monter(contexte());

    // Elle gagne exactement ce que son maximum a gagne : les degats subis
    // restent a payer.
    const gain = PALIERS[2].pvMax - PALIERS[1].pvMax;
    expect(eglise.pv).toBe(avant + gain);
    expect(eglise.pv).toBeLessThan(eglise.pvMax);
  });

  it("refuse de monter tant qu'elle est a terre", () => {
    const eglise = new Eglise();
    eglise.encaisser(99_999);
    expect(eglise.peutMonter(contexte()).manque).toEqual(["a-terre"]);
  });

  it("s'arrete au niveau 4", () => {
    const eglise = new Eglise();
    const ctx = contexte();
    while (eglise.monter(ctx)) {
      /* on monte tant qu'on peut */
    }
    expect(eglise.niveau).toBe(NIVEAU_MAX);
    expect(eglise.peutMonter(ctx).manque).toEqual(["niveau-max"]);
  });
});

describe("Eglise — la table des paliers", () => {
  it("monte sur ses quatre axes, sans jamais redescendre", () => {
    const paires = [
      [PALIERS[1], PALIERS[2]],
      [PALIERS[2], PALIERS[3]],
      [PALIERS[3], PALIERS[4]],
    ] as const;
    for (const [avant, apres] of paires) {
      expect(apres.pvMax).toBeGreaterThan(avant.pvMax);
      expect(apres.rayonSoin).toBeGreaterThan(avant.rayonSoin);
      expect(apres.soinParSeconde).toBeGreaterThan(avant.soinParSeconde);
      expect(apres.faveur).toBeGreaterThan(avant.faveur);
    }
  });

  it("rend chaque niveau plus cher que le precedent", () => {
    const paires = [
      [CONDITIONS[2], CONDITIONS[3]],
      [CONDITIONS[3], CONDITIONS[4]],
    ] as const;
    for (const [avant, apres] of paires) {
      expect(apres.argent).toBeGreaterThan(avant.argent);
      expect(apres.population).toBeGreaterThan(avant.population);
      expect(apres.satisfaction).toBeGreaterThan(avant.satisfaction);
      expect(apres.materiaux.bois ?? 0).toBeGreaterThan(avant.materiaux.bois ?? 0);
    }
  });

  it("reste atteignable : le niveau 2 ne demande pas plus que le village ne compte au depart", () => {
    // Trois habitants au demarrage : le niveau 2 doit demander d'en accueillir,
    // pas d'en avoir deja. Six est un objectif, pas un mur.
    expect(CONDITIONS[2].population).toBeGreaterThan(3);
    expect(CONDITIONS[2].population).toBeLessThanOrEqual(8);
  });
});
