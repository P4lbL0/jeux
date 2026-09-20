import { describe, expect, it } from "vitest";
import { creerHabitant, nourrir, type Habitant } from "./habitants";
import {
  METIERS_DU_VILLAGE,
  METIERS_QUI_RECOLTENT,
  ORDRE_DES_METIERS,
  REGLAGES_PEUPLEMENT,
  metiersDe,
  peuplerLeVillage,
  stocksDeDepart,
  tirerLaPopulation,
  toitsPour,
} from "./peuplement";
import { Rng } from "./rng";

/**
 * Le village deja peuple (§4.29, jalon 5.5). Ce qui se verifie ici, c'est ce
 * que le design promet : une taille qui change d'un monde a l'autre, un
 * village de trois qui reste celui d'avant, et des reserves qui se comptent en
 * jours de vivres.
 */

/** Une population entiere, pour compter ce qu'elle mange. */
function habitantsDe(population: number): Habitant[] {
  return metiersDe(population).map((metier, i) => creerHabitant(`Essai ${i}`, metier, "F", new Rng(i + 1)));
}

describe("Combien ils sont", () => {
  it("reste dans les bornes du §4.29, du dernier survivant au village entier", () => {
    for (let graine = 0; graine < 500; graine++) {
      const n = tirerLaPopulation(new Rng(graine));
      expect(n).toBeGreaterThanOrEqual(REGLAGES_PEUPLEMENT.min);
      expect(n).toBeLessThanOrEqual(REGLAGES_PEUPLEMENT.max);
    }
  });

  it("garde le gros village rare : un monde de ruines n'en offre pas un sur deux", () => {
    const tailles = Array.from({ length: 500 }, (_, g) => tirerLaPopulation(new Rng(g)));
    const petits = tailles.filter((n) => n <= 6).length;
    const gros = tailles.filter((n) => n >= 15).length;
    expect(petits).toBeGreaterThan(tailles.length / 2);
    expect(gros).toBeLessThan(tailles.length / 5);
    // Mais ils existent : une borne qui ne sort jamais ne sert a rien.
    expect(gros).toBeGreaterThan(0);
  });

  it("rend le meme village pour une meme graine, comme la carte", () => {
    expect(peuplerLeVillage(4242)).toEqual(peuplerLeVillage(4242));
    const cent = new Set(
      Array.from({ length: 100 }, (_, g) => peuplerLeVillage(g).population),
    );
    // Deux mondes ne se ressemblent pas : sans ca, tirer la population n'aurait
    // servi a rien.
    expect(cent.size).toBeGreaterThan(5);
  });
});

describe("Ce que chacun fait", () => {
  it("donne un metier a tout le monde", () => {
    for (const n of [1, 3, 7, 12, 20]) expect(metiersDe(n)).toHaveLength(n);
  });

  it("garde le village de trois exactement comme avant : pecheur, bucheron, mineur", () => {
    expect(metiersDe(3)).toEqual(["pecheur", "bucheron", "mineur"]);
  });

  it("laisse les champs vides tant qu'on est peu : c'est la seule decision de production du joueur (§4.18)", () => {
    for (let n = 1; n <= 4; n++) expect(metiersDe(n)).not.toContain("fermier");
    expect(metiersDe(5)).toContain("fermier");
  });

  it("partage les bras en trop : un dehors, un au village (§4.29)", () => {
    const vingt = metiersDe(20);
    const enTrop = vingt.slice(ORDRE_DES_METIERS.length);
    const dehors = enTrop.filter((m) => METIERS_QUI_RECOLTENT.includes(m)).length;
    const auVillage = enTrop.filter((m) => METIERS_DU_VILLAGE.includes(m)).length;
    // ⚠️ Tout envoyer recolter donnait un village de vingt ou l'on voyait
    // quatre personnes, le reste etant a la plage et a la mine. Un village se
    // juge de loin a ce qu'on voit vivre dedans.
    expect(Math.abs(dehors - auVillage)).toBeLessThanOrEqual(1);
    expect(auVillage).toBeGreaterThan(vingt.length / 4);
  });

  it("garde les sept metiers du jeu, et rien d'autre", () => {
    const tous = new Set(metiersDe(20));
    for (const metier of tous) {
      expect([...METIERS_QUI_RECOLTENT, ...METIERS_DU_VILLAGE]).toContain(metier);
    }
    expect(tous.size).toBe(7);
  });
});

describe("Les toits", () => {
  it("loge une famille par maison, jamais une personne", () => {
    // « Trois ou quatre villageois peuvent partager la meme maison pour les
    // familles » (Angelos, 20 septembre 2026).
    expect(toitsPour(1)).toBe(1);
    expect(toitsPour(4)).toBe(1);
    expect(toitsPour(5)).toBe(2);
    expect(toitsPour(20)).toBe(5);
  });

  it("laisse toujours des ruines a relever, meme au plus gros village", () => {
    // Un plan pose six maisons en moyenne (mesure) : cinq foyers en laissent.
    expect(toitsPour(REGLAGES_PEUPLEMENT.max)).toBeLessThan(6);
  });

  it("n'en demande aucun pour un village vide", () => {
    expect(toitsPour(0)).toBe(0);
  });
});

describe("Ce qu'il leur reste", () => {
  it("ne laisse rien a un village qui n'a plus rien", () => {
    expect(stocksDeDepart(12, 0)).toEqual({ poisson: 0, ble: 0, bois: 0, minerai: 0, pierre: 0 });
  });

  it("compte les vivres en jours, et pas en unites : de quoi voir venir, jamais de quoi s'installer", () => {
    // On les fait manger pour de bon, jour apres jour (§4.18) : c'est le seul
    // chiffre qui veuille dire quelque chose quand la population va de un a
    // vingt. Deux jours pleins au moins — et jamais la semaine, sinon
    // produire ne servirait a rien les premiers jours.
    for (const n of [1, 3, 12, 20]) {
      const habitants = habitantsDe(n);
      // Appetit ordinaire pour tout le monde : qu'un Gourmand mange les
      // reserves plus vite est l'affaire du trait (§4.23), pas celle du stock.
      for (const h of habitants) h.personne.mods.appetit = 1;
      const stocks = stocksDeDepart(n, 1);
      let jours = 0;
      while (nourrir(habitants, stocks) === 0) jours += 1;
      expect(jours).toBe(REGLAGES_PEUPLEMENT.vivresMax);
    }
  });

  it("laisse un village a sec quand ses reserves sont vides", () => {
    const habitants = habitantsDe(6);
    expect(nourrir(habitants, stocksDeDepart(6, 0))).toBe(6);
  });

  it("donne du poisson avant du ble : c'est ce qu'on mange en premier (§4.18)", () => {
    const stocks = stocksDeDepart(8, 0.4);
    expect(stocks.poisson).toBeGreaterThan(stocks.ble);
  });

  it("ne rend jamais de quoi se passer de produire : moins d'une enceinte de bois", () => {
    // Douze bois la palissade (§4.20) : les reserves d'un gros village plein
    // ne doivent pas payer un mur entier des la premiere minute.
    expect(stocksDeDepart(20, 1).bois).toBeLessThan(12 * 20);
  });

  it("tire les reserves a part de la population : un gros village peut etre affame", () => {
    const cent = Array.from({ length: 200 }, (_, g) => peuplerLeVillage(g));
    const grosEtPauvre = cent.some((p) => p.population >= 10 && p.aisance < 0.25);
    const petitEtRiche = cent.some((p) => p.population <= 4 && p.aisance > 0.75);
    expect(grosEtPauvre).toBe(true);
    expect(petitEtRiche).toBe(true);
  });
});
