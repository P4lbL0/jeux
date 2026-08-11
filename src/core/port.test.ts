import { describe, expect, it } from "vitest";
import {
  calmePourUnNavire,
  coursNeutre,
  lireCours,
  Port,
  REGLAGES_PORT,
  unitesPourUnePiece,
  unNavireVeutVenir,
  valeurDe,
} from "./port";
import { RESSOURCES, stocksVides, type Stocks } from "./habitants";
import { Rng } from "./rng";

function stocks(remplissage: Partial<Stocks> = {}): Stocks {
  return { ...stocksVides(), ...remplissage };
}

/** Un port debout, avec un navire a quai : l'etat ou l'on peut vendre. */
function portOuvert(): Port {
  const port = new Port();
  port.etat = "debout";
  port.navireAQuai = true;
  return port;
}

describe("Le port — le chantier", () => {
  it("commence en ruine et ne vend rien", () => {
    const port = new Port();
    expect(port.etat).toBe("ruine");
    expect(port.debout).toBe(false);

    const s = stocks({ bois: 500 });
    expect(port.vendre("bois", 100, s)).toEqual({ pieces: 0, unites: 0 });
    expect(s.bois).toBe(500);
  });

  it("refuse le chantier sans le bois, et preleve au demarrage", () => {
    const port = new Port();
    const pauvre = stocks({ bois: REGLAGES_PORT.cout.bois - 1 });
    expect(port.lancerLeChantier(pauvre)).toBe(false);
    expect(pauvre.bois).toBe(REGLAGES_PORT.cout.bois - 1);

    const riche = stocks({ bois: 200 });
    expect(port.lancerLeChantier(riche)).toBe(true);
    // Preleve **au demarrage** : sinon on lancerait le chantier, on depenserait
    // son bois ailleurs pendant la demi-journee, et le port serait gratuit.
    expect(riche.bois).toBe(200 - REGLAGES_PORT.cout.bois);
  });

  it("ne relance pas un chantier deja en cours", () => {
    const port = new Port();
    const s = stocks({ bois: 500 });
    expect(port.lancerLeChantier(s)).toBe(true);
    expect(port.lancerLeChantier(s)).toBe(false);
    expect(s.bois).toBe(500 - REGLAGES_PORT.cout.bois);
  });

  it("se met debout au bout d'une demi-journee, et une seule fois", () => {
    const port = new Port();
    port.lancerLeChantier(stocks({ bois: 200 }));

    expect(port.majorer(REGLAGES_PORT.duree / 2)).toBe(false);
    expect(port.partChantier).toBeCloseTo(0.5, 2);
    expect(port.majorer(REGLAGES_PORT.duree / 2)).toBe(true);
    expect(port.debout).toBe(true);
    // Le deuxieme appel ne doit pas re-annoncer un port deja debout.
    expect(port.majorer(1000)).toBe(false);
  });
});

describe("Le port — les prix et le cours", () => {
  it("fait suivre le prix au risque : minerai > bois > ble > poisson", () => {
    const cours = coursNeutre();
    const pour100 = (r: Parameters<typeof valeurDe>[0]) => valeurDe(r, 100, cours);
    expect(pour100("minerai")).toBeGreaterThan(pour100("bois"));
    expect(pour100("bois")).toBeGreaterThan(pour100("ble"));
    expect(pour100("ble")).toBeGreaterThan(pour100("poisson"));
  });

  it("arrondit vers le bas : trois poissons ne valent pas une piece", () => {
    expect(valeurDe("poisson", 3, coursNeutre())).toBe(0);
    expect(valeurDe("poisson", 6, coursNeutre())).toBe(1);
  });

  it("fait rapporter davantage quand le cours est haut", () => {
    const bas = { ...coursNeutre(), bois: 0.6 };
    const haut = { ...coursNeutre(), bois: 1.6 };
    expect(valeurDe("bois", 400, haut)).toBeGreaterThan(valeurDe("bois", 400, bas));
  });

  it("dit combien d'unites il faut pour une piece, au cours du jour", () => {
    const cours = { ...coursNeutre(), minerai: 2 };
    // Deux unites pour une piece de base, donc une seule quand le cours double.
    expect(unitesPourUnePiece("minerai", cours)).toBeCloseTo(1, 5);
  });

  it("garde les cours entre leurs bornes, meme apres mille journees", () => {
    const port = new Port();
    const rng = new Rng(3);
    for (let i = 0; i < 1000; i++) {
      port.passerLaJournee(rng);
      for (const ressource of RESSOURCES) {
        expect(port.cours[ressource]).toBeGreaterThanOrEqual(REGLAGES_PORT.coursMin);
        expect(port.cours[ressource]).toBeLessThanOrEqual(REGLAGES_PORT.coursMax);
      }
    }
  });

  it("fait bouger les cours independamment les uns des autres", () => {
    // C'est tout l'interet d'un cours par ressource : il dit **quoi** charger.
    // Un cours global n'aurait dit que « vendre ou pas ».
    const port = new Port();
    const rng = new Rng(8);
    for (let i = 0; i < 30; i++) port.passerLaJournee(rng);
    const valeurs = RESSOURCES.map((r) => port.cours[r]);
    expect(new Set(valeurs).size).toBeGreaterThan(1);
  });

  it("ramene un cours enfonce vers sa moyenne", () => {
    const port = new Port();
    port.cours.bois = REGLAGES_PORT.coursMin;
    const rng = new Rng(5);
    for (let i = 0; i < 12; i++) port.passerLaJournee(rng);
    expect(port.cours.bois).toBeGreaterThan(REGLAGES_PORT.coursMin + 0.1);
  });
});

describe("Le port — vendre", () => {
  it("ne vend rien sans navire a quai", () => {
    const port = new Port();
    port.etat = "debout";
    const s = stocks({ bois: 400 });
    expect(port.vendre("bois", 100, s).pieces).toBe(0);
    expect(s.bois).toBe(400);
  });

  it("echange des unites contre des pieces, et retire du stock", () => {
    const port = portOuvert();
    const s = stocks({ bois: 400 });
    const vente = port.vendre("bois", 200, s);

    expect(vente.unites).toBe(200);
    // 4 unites la piece a cours 1, donc 50 au tarif plein — mais le cours
    // baisse **pendant** le chargement, et le dernier lot part moins cher.
    expect(vente.pieces).toBe(48);
    expect(s.bois).toBe(200);
  });

  it("ne vend jamais plus que le stock", () => {
    const port = portOuvert();
    const s = stocks({ minerai: 30 });
    const vente = port.vendre("minerai", 999, s);

    expect(vente.unites).toBe(30);
    expect(s.minerai).toBe(0);
  });

  it("n'achete jamais rien : le stock ne remonte pas", () => {
    // Le sens unique du §4.8 : manquer de bois se paie toujours en bois.
    const port = portOuvert();
    const s = stocks({ bois: 0 });
    expect(port.vendre("bois", 100, s)).toEqual({ pieces: 0, unites: 0 });
    expect(s.bois).toBe(0);
  });

  it("fait baisser le cours de ce qu'on vend, et lui seul", () => {
    const port = portOuvert();
    const avant = { ...port.cours };
    port.vendre("bois", 400, stocks({ bois: 400 }));

    expect(port.cours.bois).toBeLessThan(avant.bois);
    expect(port.cours.minerai).toBe(avant.minerai);
    expect(port.cours.poisson).toBe(avant.poisson);
  });

  it("rend le dernier lot moins cher que le premier", () => {
    // C'est le remplacant du plafond de cargaison : le frein est economique.
    const parLots = portOuvert();
    const s = stocks({ bois: 2000 });
    let premier = 0;
    let dernier = 0;
    for (let i = 0; i < 10; i++) {
      const lot = parLots.vendre("bois", 200, s).pieces;
      if (i === 0) premier = lot;
      dernier = lot;
    }
    expect(dernier).toBeLessThan(premier);
  });

  it("ne laisse pas solder d'un coup pour echapper a l'impact", () => {
    // ⚠️ **Le trou trouve par ce test.** Une premiere version calculait le prix
    // une fois puis baissait le cours a la fin : tout vendre en un clic
    // rapportait le plein tarif, et le joueur n'aurait jamais vendu autrement.
    const enUnCoup = portOuvert();
    const total = enUnCoup.vendre("bois", 2000, stocks({ bois: 2000 })).pieces;

    const parLots = portOuvert();
    const s = stocks({ bois: 2000 });
    let cumul = 0;
    for (let i = 0; i < 10; i++) cumul += parLots.vendre("bois", 200, s).pieces;

    // Vendre en une fois ou en dix doit revenir au meme, a l'arrondi pres.
    expect(Math.abs(total - cumul)).toBeLessThan(cumul * 0.05);
    // Et dans les deux cas, nettement moins que le plein tarif de 500 pieces.
    expect(total).toBeLessThan(450);
  });

  it("ne descend jamais le cours sous son plancher, meme en soldant tout", () => {
    const port = portOuvert();
    port.vendre("minerai", 100_000, stocks({ minerai: 100_000 }));
    expect(port.cours.minerai).toBeGreaterThanOrEqual(REGLAGES_PORT.coursMin);
  });
});

describe("Le port — la voile qui parait quand c'est calme", () => {
  const base = { phase: "jour" as const, monstresDebout: 0, journeesDesMorts: [], journee: 10 };

  it("accepte un jour calme et sans mort recent", () => {
    expect(calmePourUnNavire(base)).toBe(true);
  });

  it("refuse la nuit", () => {
    expect(calmePourUnNavire({ ...base, phase: "nuit" })).toBe(false);
  });

  it("refuse tant qu'un seul monstre est debout", () => {
    expect(calmePourUnNavire({ ...base, monstresDebout: 1 })).toBe(false);
  });

  it("refuse quand quelqu'un vient de mourir", () => {
    expect(calmePourUnNavire({ ...base, journeesDesMorts: [9] })).toBe(false);
  });

  it("oublie un mort plus vite que la rumeur ne l'oublie", () => {
    // ⚠️ Memoire courte volontaire : le calme conditionne deja les arrivees.
    // Avec la memoire longue de la rumeur, une mauvaise nuit couperait le
    // peuplement **et** le commerce pour plus d'une semaine.
    const vieux = base.journee - REGLAGES_PORT.memoireDesMorts;
    expect(calmePourUnNavire({ ...base, journeesDesMorts: [vieux] })).toBe(true);
  });

  it("fait paraitre une voile environ une journee calme sur trois", () => {
    const rng = new Rng(17);
    let voiles = 0;
    for (let i = 0; i < 3000; i++) if (unNavireVeutVenir(rng)) voiles += 1;
    const part = voiles / 3000;
    expect(part).toBeGreaterThan(0.28);
    expect(part).toBeLessThan(0.39);
  });
});

describe("Le port — la reprise et la lecture", () => {
  it("reprend un etat de sauvegarde en bornant les cours", () => {
    const port = new Port();
    port.reprendre("debout", 0, { bois: 99, minerai: -5 });

    expect(port.debout).toBe(true);
    expect(port.cours.bois).toBe(REGLAGES_PORT.coursMax);
    expect(port.cours.minerai).toBe(REGLAGES_PORT.coursMin);
    // Une ressource absente de la sauvegarde repart a neutre, jamais a zero.
    expect(port.cours.poisson).toBe(1);
  });

  it("ecrit le cours pour un humain", () => {
    expect(lireCours(1.5)).toBe("au plus haut");
    expect(lireCours(1)).toBe("stable");
    expect(lireCours(0.65)).toBe("au plus bas");
  });
});
