import { describe, expect, it } from "vitest";
import {
  Cycle,
  REGLAGES_CYCLE,
  delaiProchaineHorde,
  villageAttire,
  effectifDeLaNuit,
  intervalleDeLaNuit,
  puissanceDeLaNuit,
  tailleDeLaHorde,
} from "./cycle";
import { choisirArchetype } from "../game/ennemis";

describe("Cycle — le jour et la nuit", () => {
  it("commence au matin du premier jour", () => {
    const cycle = new Cycle();
    expect(cycle.jour).toBe(1);
    expect(cycle.phase).toBe("jour");
    expect(cycle.part).toBe(0);
  });

  it("ne bascule pas avant la fin de la phase", () => {
    const cycle = new Cycle();
    expect(cycle.avancer(REGLAGES_CYCLE.jour - 1)).toBeNull();
    expect(cycle.phase).toBe("jour");
  });

  it("bascule au crepuscule puis a l'aube, en changeant de jour", () => {
    const cycle = new Cycle();
    expect(cycle.avancer(REGLAGES_CYCLE.jour)).toBe("crepuscule");
    expect(cycle.phase).toBe("nuit");
    expect(cycle.jour).toBe(1);

    expect(cycle.avancer(REGLAGES_CYCLE.nuit)).toBe("aube");
    expect(cycle.phase).toBe("jour");
    expect(cycle.jour).toBe(2);
  });

  it("reporte le depassement au lieu de le perdre", () => {
    const cycle = new Cycle();
    cycle.avancer(REGLAGES_CYCLE.jour + 5000);
    expect(cycle.ecoule).toBe(5000);
  });

  it("garde un avancement borne entre 0 et 1", () => {
    const cycle = new Cycle();
    cycle.avancer(REGLAGES_CYCLE.jour / 2);
    expect(cycle.part).toBeCloseTo(0.5);
    expect(cycle.restant).toBeCloseTo(REGLAGES_CYCLE.jour / 2);
  });

  it("tient le compte sur une longue partie sans deriver", () => {
    const cycle = new Cycle();
    // Cinq journees completes, poussees par images de 16 ms.
    const total = (REGLAGES_CYCLE.jour + REGLAGES_CYCLE.nuit) * 5;
    for (let t = 0; t < total; t += 16) cycle.avancer(16);
    expect(cycle.jour).toBe(6);
    expect(cycle.phase).toBe("jour");
  });

  it("donne le meme numero au jour et a la nuit qui le suit", () => {
    const cycle = new Cycle();
    cycle.avancer(REGLAGES_CYCLE.jour);
    expect(cycle.nuit).toBe(1);
  });
});

describe("L'effectif d'une nuit", () => {
  it("monte d'une nuit a l'autre", () => {
    expect(effectifDeLaNuit(1)).toBe(REGLAGES_CYCLE.effectifPremiereNuit);
    expect(effectifDeLaNuit(5)).toBeGreaterThan(effectifDeLaNuit(4));
  });

  it("tient dans la fenetre d'arrivees, en laissant du silence avant l'aube", () => {
    // C'est la recompense du §4.19 : l'effectif doit pouvoir tomber avant la fin.
    for (const nuit of [1, 5, 20]) {
      const duree = intervalleDeLaNuit(nuit) * effectifDeLaNuit(nuit);
      expect(duree).toBeLessThanOrEqual(REGLAGES_CYCLE.nuit * REGLAGES_CYCLE.partArrivees + 1);
    }
  });

  it("ne descend jamais a un intervalle nul, meme tres tard", () => {
    expect(intervalleDeLaNuit(500)).toBeGreaterThan(0);
  });
});

describe("La puissance d'une nuit", () => {
  it("part de zero la premiere nuit", () => {
    expect(puissanceDeLaNuit(1)).toBe(0);
  });

  it("n'envoie que des fonceurs la premiere nuit", () => {
    // Le seul archetype de seuil 0 : quel que soit le tirage, c'est lui.
    for (const tirage of [0, 0.25, 0.5, 0.75, 0.99]) {
      expect(choisirArchetype(puissanceDeLaNuit(1), tirage).id).toBe("fonceur");
    }
  });

  it("ouvre une espece nouvelle par nuit pendant six nuits", () => {
    // Le calendrier des especes n'est ecrit nulle part : il tombe de la
    // rencontre entre `puissanceParNuit` et les seuils de `ennemis.ts`.
    const attendus: Array<[number, string]> = [
      [2, "essaim"],
      [3, "revenant"],
      [4, "cracheur"],
      [5, "brute"],
      [6, "kamikaze"],
    ];
    for (const [nuit, id] of attendus) {
      const puissance = puissanceDeLaNuit(nuit);
      const ouvert = [0, 0.2, 0.4, 0.6, 0.8, 0.99].some(
        (tirage) => choisirArchetype(puissance, tirage).id === id,
      );
      expect(ouvert, `${id} devrait apparaitre la nuit ${nuit}`).toBe(true);
      // Et il ne devait pas etre la la nuit precedente.
      const avant = puissanceDeLaNuit(nuit - 1);
      const dejaLa = [0, 0.2, 0.4, 0.6, 0.8, 0.99].some(
        (tirage) => choisirArchetype(avant, tirage).id === id,
      );
      expect(dejaLa, `${id} ne devait pas exister la nuit ${nuit - 1}`).toBe(false);
    }
  });
});

describe("Les hordes de jour", () => {
  it("restent bien plus petites qu'une nuit", () => {
    for (const jour of [1, 5, 20]) {
      expect(tailleDeLaHorde(jour)).toBeLessThan(effectifDeLaNuit(jour));
    }
  });

  it("grossit avec les jours", () => {
    expect(tailleDeLaHorde(10)).toBeGreaterThan(tailleDeLaHorde(1));
  });

  it("tire son delai entre les deux bornes", () => {
    expect(delaiProchaineHorde(0)).toBe(REGLAGES_CYCLE.hordeMin);
    expect(delaiProchaineHorde(0.999)).toBeLessThanOrEqual(REGLAGES_CYCLE.hordeMax);
    expect(delaiProchaineHorde(0.5)).toBeGreaterThan(REGLAGES_CYCLE.hordeMin);
  });

  it("laisse la place a plusieurs hordes dans une journee", () => {
    // Sinon le jour de 30 minutes redevient le temps mort que le §4.19 refuse.
    expect(delaiProchaineHorde(0.5)).toBeLessThan(REGLAGES_CYCLE.jour / 2);
  });
});

describe("Le village qui attire les monstres (§4.18)", () => {
  it("n'attire qu'au-dela de 65 habitants, strictement", () => {
    expect(villageAttire(3)).toBe(false);
    expect(villageAttire(65)).toBe(false);
    expect(villageAttire(66)).toBe(true);
  });

  it("garde les hordes de jour telles quelles en dessous du seuil", () => {
    expect(delaiProchaineHorde(0, false)).toBe(REGLAGES_CYCLE.hordeMin);
    expect(delaiProchaineHorde(0)).toBe(delaiProchaineHorde(0, false));
  });

  it("ne laisse plus les hordes s'arreter au-dela du seuil", () => {
    expect(delaiProchaineHorde(0, true)).toBe(REGLAGES_CYCLE.hordeMinAttire);
    expect(delaiProchaineHorde(0.999, true)).toBeLessThanOrEqual(REGLAGES_CYCLE.hordeMaxAttire);
    // Bien en dessous de la horde la plus rapprochee d'un village calme, et
    // encore au-dessus du preavis : on a le temps de sonner la cloche.
    expect(REGLAGES_CYCLE.hordeMaxAttire).toBeLessThan(REGLAGES_CYCLE.hordeMin / 2);
    expect(REGLAGES_CYCLE.hordeMinAttire).toBeGreaterThan(REGLAGES_CYCLE.preavisHorde * 2);
  });
});
