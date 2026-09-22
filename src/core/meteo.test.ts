import { describe, expect, it } from "vitest";
import { Meteo, REGLAGES_METEO, annonceDuMatin } from "./meteo";
import { Rng } from "./rng";

/**
 * Un ciel pilote a la main : la suite des tirages est imposee, donc une
 * sequence de journees precise se rejoue a l'identique. Le vrai `Rng` sert la
 * ou c'est la **frequence** qu'on verifie, pas la sequence.
 */
class RngTruque extends Rng {
  private suite: number[];

  constructor(suite: number[]) {
    super(0);
    this.suite = [...suite];
  }

  override next(): number {
    const valeur = this.suite.shift();
    return valeur === undefined ? 1 : valeur;
  }
}

/**
 * Une journee, en tirages : le premier dit s'il pleut, le second si ca tourne a
 * l'orage. Une journee seche n'en consomme qu'un — c'est le code qui sort tot.
 */
const SEC = [0.99];
const PLUIE = [0, 0.99];
const ORAGE = [0, 0];

/** Enchaine des journees et rend le ciel a la fin de la derniere. */
function journees(suite: number[][]): Meteo {
  const meteo = new Meteo();
  const rng = new RngTruque(suite.flat());
  for (let i = 0; i < suite.length; i++) meteo.passerLaJournee(rng);
  return meteo;
}

describe("Meteo — le temps qu'il fait", () => {
  it("commence au sec, sans crue", () => {
    const meteo = new Meteo();
    expect(meteo.temps).toBe("sec");
    expect(meteo.journeesPluvieuses).toBe(0);
    expect(meteo.crue).toBe(false);
    expect(meteo.orage).toBe(false);
  });

  it("compte les journees pluvieuses d'affilee, celle en cours comprise", () => {
    expect(journees([PLUIE]).journeesPluvieuses).toBe(1);
    expect(journees([PLUIE, PLUIE]).journeesPluvieuses).toBe(2);
  });

  it("remet le compteur a zero des qu'une journee est seche", () => {
    const meteo = journees([PLUIE, PLUIE, SEC]);
    expect(meteo.temps).toBe("sec");
    expect(meteo.journeesPluvieuses).toBe(0);
  });

  it("compte l'orage comme une journee pluvieuse : il mouille aussi", () => {
    const meteo = journees([PLUIE, ORAGE]);
    expect(meteo.temps).toBe("orage");
    expect(meteo.pluvieux).toBe(true);
    expect(meteo.journeesPluvieuses).toBe(2);
  });
});

describe("La crue — la troisieme journee pluvieuse d'affilee", () => {
  it("ne se declenche ni a la premiere ni a la deuxieme", () => {
    expect(journees([PLUIE]).crue).toBe(false);
    expect(journees([PLUIE, PLUIE]).crue).toBe(false);
  });

  it("se declenche a la troisieme", () => {
    const meteo = journees([PLUIE, PLUIE, PLUIE]);
    expect(meteo.crue).toBe(true);
    expect(meteo.journeesPluvieuses).toBe(REGLAGES_METEO.journeesPourLaCrue);
  });

  it("compte les orages dedans : deux pluies et un orage suffisent", () => {
    expect(journees([PLUIE, ORAGE, PLUIE]).crue).toBe(true);
  });

  it("laisse l'eau se retirer : le lendemain est sec meme si le tirage dit pluie", () => {
    const meteo = journees([PLUIE, PLUIE, PLUIE, PLUIE]);
    expect(meteo.temps).toBe("sec");
    expect(meteo.crue).toBe(false);
    expect(meteo.journeesPluvieuses).toBe(0);
  });

  it("ne s'enchaine jamais deux journees de suite, meme sous une pluie continue", () => {
    const meteo = new Meteo();
    const rng = new RngTruque(new Array(120).fill(0));
    let crues = 0;
    let dernierJourDeCrue = -99;
    for (let jour = 1; jour <= 40; jour++) {
      meteo.passerLaJournee(rng);
      if (meteo.crue) {
        expect(jour - dernierJourDeCrue).toBeGreaterThan(1);
        dernierJourDeCrue = jour;
        crues++;
      }
    }
    // Pluie tous les jours : une crue toutes les quatre journees (trois qui
    // mouillent, une seche ou l'eau se retire), et jamais deux d'affilee.
    expect(crues).toBeGreaterThan(5);
  });
});

describe("Quand il pleut dans la journee", () => {
  it("mouille la matinee et cesse apres le milieu du jour", () => {
    const meteo = journees([PLUIE]);
    expect(meteo.ilPleut("jour", 0)).toBe(true);
    expect(meteo.ilPleut("jour", REGLAGES_METEO.finDeLAverse - 0.01)).toBe(true);
    expect(meteo.ilPleut("jour", REGLAGES_METEO.finDeLAverse + 0.01)).toBe(false);
  });

  it("ne pleut jamais la nuit d'une journee pluvieuse ordinaire", () => {
    expect(journees([PLUIE]).ilPleut("nuit", 0.5)).toBe(false);
  });

  it("ne cesse plus le jour de crue, ni a midi ni a la nuit", () => {
    const meteo = journees([PLUIE, PLUIE, PLUIE]);
    expect(meteo.ilPleut("jour", 0.9)).toBe(true);
    expect(meteo.ilPleut("nuit", 0.9)).toBe(true);
  });

  it("ne cesse pas non plus sous l'orage : il tient jusqu'au bout de sa nuit", () => {
    const meteo = journees([ORAGE]);
    expect(meteo.ilPleut("jour", 0.9)).toBe(true);
    expect(meteo.ilPleut("nuit", 0.9)).toBe(true);
  });

  it("ne pleut jamais par temps sec", () => {
    const meteo = journees([SEC]);
    expect(meteo.ilPleut("jour", 0.1)).toBe(false);
    expect(meteo.ilPleut("nuit", 0.1)).toBe(false);
  });
});

describe("Ce que la pluie change", () => {
  it("double la pousse des champs tant qu'elle tombe, et rien de plus", () => {
    const meteo = journees([PLUIE]);
    expect(meteo.pousse("jour", 0.1)).toBe(REGLAGES_METEO.pousseSousLaPluie);
    // L'averse cessee, les champs reprennent leur vitesse : le cadeau dure le
    // temps de la pluie, pas le temps de la journee.
    expect(meteo.pousse("jour", 0.9)).toBe(1);
  });

  it("double la pousse toute la journee d'orage, puisqu'elle ne cesse pas", () => {
    const meteo = journees([ORAGE]);
    expect(meteo.pousse("jour", 0.9)).toBe(REGLAGES_METEO.pousseSousLaPluie);
  });

  it("ne change rien aux champs par temps sec", () => {
    expect(journees([SEC]).pousse("jour", 0.1)).toBe(1);
  });

  it("eteint un feu deux fois plus vite, le crochet de l'incendie", () => {
    expect(journees([PLUIE]).extinction("jour", 0.1)).toBe(REGLAGES_METEO.extinctionSousLaPluie);
    expect(journees([SEC]).extinction("jour", 0.1)).toBe(1);
  });
});

describe("L'orage — plus nombreux, plus forts, et de jour", () => {
  it("monte l'effectif de la nuit de moitie, et seulement sous l'orage", () => {
    expect(journees([ORAGE]).effectif(20)).toBe(30);
    expect(journees([PLUIE]).effectif(20)).toBe(20);
    expect(journees([SEC]).effectif(20)).toBe(20);
  });

  it("fait se battre contre les monstres de deux nuits plus loin", () => {
    expect(journees([ORAGE]).nuitEquivalente(5)).toBe(5 + REGLAGES_METEO.nuitsDAvanceEnOrage);
    expect(journees([PLUIE]).nuitEquivalente(5)).toBe(5);
  });

  it("empeche les hordes de jour de s'arreter, comme un village qui attire", () => {
    expect(journees([ORAGE]).hordesDeJour).toBe(true);
    expect(journees([PLUIE]).hordesDeJour).toBe(false);
    expect(journees([SEC]).hordesDeJour).toBe(false);
  });

  it("espace les eclairs de huit a vingt-cinq secondes", () => {
    const meteo = journees([ORAGE]);
    const rng = new Rng(4);
    for (let i = 0; i < 200; i++) {
      const delai = meteo.delaiProchainEclair(rng);
      expect(delai).toBeGreaterThanOrEqual(REGLAGES_METEO.eclairMin);
      expect(delai).toBeLessThan(REGLAGES_METEO.eclairMax);
    }
  });

  it("n'allume jamais rien hors orage, meme au tirage le plus favorable", () => {
    const favorable = new RngTruque(new Array(20).fill(0));
    expect(journees([PLUIE]).unEclairAllumeUnFeu(favorable)).toBe(false);
    expect(journees([SEC]).unEclairAllumeUnFeu(favorable)).toBe(false);
  });

  it("garde l'incendie par la foudre rare : un eclair sur vingt", () => {
    const meteo = journees([ORAGE]);
    const rng = new Rng(11);
    let feux = 0;
    const ECLAIRS = 10_000;
    for (let i = 0; i < ECLAIRS; i++) if (meteo.unEclairAllumeUnFeu(rng)) feux++;
    const part = feux / ECLAIRS;
    expect(part).toBeGreaterThan(0.03);
    expect(part).toBeLessThan(0.07);
  });
});

describe("Ce que le ciel annonce au lever", () => {
  it("ne dit rien quand il fait sec : la discussion ne garde que six lignes", () => {
    expect(annonceDuMatin(journees([SEC]))).toBeNull();
  });

  it("annonce la pluie, puis la terre gorgee, puis l'eau qui monte", () => {
    const premiere = annonceDuMatin(journees([PLUIE]));
    const deuxieme = annonceDuMatin(journees([PLUIE, PLUIE]));
    const crue = annonceDuMatin(journees([PLUIE, PLUIE, PLUIE]));
    expect(premiere).toBeTruthy();
    expect(deuxieme).toBeTruthy();
    expect(crue).toBeTruthy();
    // Trois lignes differentes : c'est ce qui fait qu'on voit la crue venir de
    // deux journees sans avoir a compter soi-meme.
    expect(new Set([premiere, deuxieme, crue]).size).toBe(3);
  });

  it("met l'orage devant tout le reste, crue comprise", () => {
    const orage = annonceDuMatin(journees([ORAGE]));
    const orageEnCrue = annonceDuMatin(journees([PLUIE, PLUIE, ORAGE]));
    expect(orage).toBeTruthy();
    expect(orageEnCrue).toBeTruthy();
    expect(orage).not.toBe(orageEnCrue);
  });
});

describe("Sur une longue partie, avec un vrai tirage", () => {
  it("fait pleuvoir environ une journee sur trois", () => {
    const meteo = new Meteo();
    const rng = new Rng(20260922);
    let pluvieuses = 0;
    const JOURNEES = 3000;
    for (let i = 0; i < JOURNEES; i++) {
      if (meteo.passerLaJournee(rng) !== "sec") pluvieuses++;
    }
    const part = pluvieuses / JOURNEES;
    // Un peu sous un tiers : le lendemain d'une crue est sec d'office.
    expect(part).toBeGreaterThan(0.27);
    expect(part).toBeLessThan(0.36);
  });

  it("garde l'orage a environ une journee sur douze", () => {
    const meteo = new Meteo();
    const rng = new Rng(1234);
    let orages = 0;
    const JOURNEES = 3000;
    for (let i = 0; i < JOURNEES; i++) {
      if (meteo.passerLaJournee(rng) === "orage") orages++;
    }
    const part = orages / JOURNEES;
    expect(part).toBeGreaterThan(0.05);
    expect(part).toBeLessThan(0.12);
  });

  it("garde la crue rare : un evenement, pas un rythme", () => {
    const meteo = new Meteo();
    const rng = new Rng(7);
    let crues = 0;
    const JOURNEES = 3000;
    for (let i = 0; i < JOURNEES; i++) {
      meteo.passerLaJournee(rng);
      if (meteo.crue) crues++;
    }
    // Environ une journee sur vingt-sept, donc moins d'une sur vingt.
    expect(crues / JOURNEES).toBeLessThan(0.06);
    // Mais elle existe : sur une partie tres longue, on en voit.
    expect(crues).toBeGreaterThan(20);
  });
});

describe("La sauvegarde du ciel", () => {
  it("rend le meme ciel apres un aller-retour", () => {
    const avant = journees([PLUIE, PLUIE]);
    const apres = Meteo.reprendre(avant.instantane);
    expect(apres.temps).toBe(avant.temps);
    expect(apres.journeesPluvieuses).toBe(avant.journeesPluvieuses);
    expect(apres.crue).toBe(avant.crue);
  });

  it("garde l'orage : reprendre une partie n'eteint pas le ciel", () => {
    const apres = Meteo.reprendre(journees([ORAGE]).instantane);
    expect(apres.orage).toBe(true);
    expect(apres.hordesDeJour).toBe(true);
  });

  it("garde la crue en cours : reprendre une partie ne sauve pas le village", () => {
    const apres = Meteo.reprendre(journees([PLUIE, PLUIE, PLUIE]).instantane);
    expect(apres.crue).toBe(true);
  });

  it("reprend au sec une sauvegarde d'avant le jalon 6", () => {
    const meteo = Meteo.reprendre(undefined);
    expect(meteo.temps).toBe("sec");
    expect(meteo.journeesPluvieuses).toBe(0);
  });
});
