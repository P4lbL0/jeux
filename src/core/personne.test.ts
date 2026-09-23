import { describe, expect, it } from "vitest";
import { Rng } from "./rng";
import {
  REGLAGES_STRESS,
  avancerLaJournee,
  coeurLache,
  contracterEtat,
  creerPersonne,
  descendreStress,
  gagnerTrait,
  monterStress,
  poserSequelle,
  resistanceAuStress,
  soignerEtat,
  verifierExploits,
  verifierRupture,
  voirMourir,
  type Personne,
  PRENOMS,
  prenomLibre,
} from "./personne";
import { idSequelle, idTrait, traitParId } from "./traits";

function quelquUn(graine = 1): Personne {
  return creerPersonne("Gaston", new Rng(graine));
}

describe("Une personne neuve", () => {
  it("a trois statistiques en pourcentage, comparables d'une fiche a l'autre", () => {
    const p = quelquUn();
    for (const valeur of [p.stats.force, p.stats.courage, p.stats.intelligence]) {
      expect(valeur).toBeGreaterThanOrEqual(0);
      expect(valeur).toBeLessThanOrEqual(100);
      expect(Number.isInteger(valeur)).toBe(true);
    }
  });

  it("nait avec un a trois traits, tous de naissance", () => {
    for (let graine = 1; graine < 40; graine++) {
      const p = quelquUn(graine);
      expect(p.traits.length).toBeGreaterThanOrEqual(1);
      expect(p.traits.length).toBeLessThanOrEqual(3);
      for (const id of p.traits) expect(traitParId(id)!.origine).toBe("naissance");
    }
  });

  it("ne nait jamais deux fois le meme trait", () => {
    for (let graine = 1; graine < 40; graine++) {
      const p = quelquUn(graine);
      expect(new Set(p.traits).size).toBe(p.traits.length);
    }
  });

  /** Une meme graine redonne le meme village : on l'apprend, comme la carte. */
  it("est identique a graine egale, sauf son identite", () => {
    const { identite: _a, ...un } = quelquUn(7);
    const { identite: _b, ...deux } = quelquUn(7);
    expect(un).toEqual(deux);
    expect(quelquUn(7).grainePortrait).not.toBe(quelquUn(8).grainePortrait);
  });

  it("recoit une identite sociale qui n'appartient qu'a elle", () => {
    // ⚠️ **Elle ne vient pas de la graine, et c'est le sujet** (§4.26) : deux
    // habitants tires de la meme graine sont deux personnes differentes, et
    // leurs relations ne doivent jamais se confondre.
    const identites = new Set([quelquUn(7), quelquUn(7), quelquUn(8)].map((p) => p.identite));
    expect(identites.size).toBe(3);
  });

  it("part sans stress, sans sequelle et sans etat", () => {
    const p = quelquUn();
    expect(p.stress).toBe(0);
    expect(p.sequelles).toHaveLength(0);
    expect(p.etats).toHaveLength(0);
    expect(p.rupture).toBeNull();
  });
});

describe("La jauge de stress", () => {
  it("monte plus vite chez un colerique que chez un placide", () => {
    const colerique = quelquUn();
    const placide = quelquUn();
    colerique.traits = [];
    placide.traits = [];
    gagnerTrait(colerique, "colerique");
    gagnerTrait(placide, "placide");

    monterStress(colerique, 10);
    monterStress(placide, 10);
    expect(colerique.stress).toBeGreaterThan(placide.stress);
  });

  it("ne descend jamais sous le plancher d'un Regard vide", () => {
    const p = quelquUn();
    // Par `poserSequelle` et pas a la main : l'agregat est la seule verite, y
    // compris dans les tests.
    poserSequelle(p, idSequelle("regard-vide"));
    p.stress = 90;
    // On lui rend bien plus que ce qu'il a : il doit s'arreter a 30, pas a 0.
    descendreStress(p, 500);
    expect(p.stress).toBe(30);
  });

  it("plafonne a 200, la ou le coeur lache", () => {
    const p = quelquUn();
    monterStress(p, 10_000);
    expect(p.stress).toBe(REGLAGES_STRESS.coeur);
    expect(coeurLache(p)).toBe(true);
  });

  it("coute moitie moins a un Sang-Froid quand quelqu'un meurt", () => {
    const ordinaire = quelquUn();
    const froid = quelquUn();
    ordinaire.traits = [];
    froid.traits = [];
    gagnerTrait(froid, "sang-froid");

    voirMourir(ordinaire);
    voirMourir(froid);
    expect(froid.stress).toBeCloseTo(ordinaire.stress / 2);
    expect(froid.exploits.mortsVues).toBe(1);
  });

  /**
   * « Plus le heros est puissant, plus sa jauge est lente a se remplir » — et
   * quand il tombe, il emporte la nuit avec lui (§4.23).
   */
  it("est plus lente pour un rang eleve et un grand courage", () => {
    const debutant = resistanceAuStress(0, 1, { force: 50, courage: 20, intelligence: 50 });
    const veteran = resistanceAuStress(3, 20, { force: 50, courage: 90, intelligence: 50 });
    expect(veteran).toBeLessThan(debutant);
    expect(debutant).toBeLessThanOrEqual(1);
  });
});

describe("La rupture", () => {
  it("ne se declenche pas sous 100", () => {
    const p = quelquUn();
    p.stress = 99;
    expect(verifierRupture(p, 0, new Rng(1))).toBeNull();
  });

  it("se declenche a 100 et compte le craquage", () => {
    const p = quelquUn();
    p.stress = 100;
    const rupture = verifierRupture(p, 1000, new Rng(1));
    expect(rupture).not.toBeNull();
    expect(p.ruptures).toBe(1);
    expect(p.ruptureJusqua).toBe(1000 + REGLAGES_STRESS.dureeRupture);
  });

  /**
   * Sans cette redescente, il recraquerait a l'image suivante, indefiniment. Il
   * reste haut — il n'est pas gueri, il a juste fini de crier.
   */
  it("redescend sous le seuil a la fin, sans guerir", () => {
    const p = quelquUn();
    p.stress = 140;
    verifierRupture(p, 0, new Rng(1));
    expect(p.rupture).not.toBeNull();

    verifierRupture(p, REGLAGES_STRESS.dureeRupture + 1, new Rng(1));
    expect(p.rupture).toBeNull();
    expect(p.stress).toBeLessThan(REGLAGES_STRESS.rupture);
    expect(p.stress).toBeGreaterThan(REGLAGES_STRESS.rupture / 2);
  });

  it("n'en tire pas une deuxieme pendant que la premiere dure", () => {
    const p = quelquUn();
    p.stress = 150;
    verifierRupture(p, 0, new Rng(1));
    expect(verifierRupture(p, 1000, new Rng(2))).toBeNull();
    expect(p.ruptures).toBe(1);
  });

  it("garde la transcendance rare : sinon craquer deviendrait une strategie", () => {
    let transcendances = 0;
    const rng = new Rng(4242);
    for (let i = 0; i < 400; i++) {
      const p = quelquUn(i + 1);
      p.stress = 120;
      if (verifierRupture(p, 0, rng) === "transcendance") transcendances += 1;
    }
    expect(transcendances / 400).toBeLessThan(0.12);
  });
});

describe("Les etats portes par une personne", () => {
  it("mettent a jour l'agregat sans qu'on ait a le demander", () => {
    const p = quelquUn();
    p.traits = [];
    const avant = p.mods.cadence;
    contracterEtat(p, "maladie");
    expect(p.mods.cadence).toBeLessThan(avant);
  });

  it("laissent une sequelle quand on le sauve in extremis, et une seule fois", () => {
    const p = quelquUn();
    p.traits = [];
    contracterEtat(p, "blessure");
    contracterEtat(p, "blessure");
    contracterEtat(p, "blessure");

    const sequelle = soignerEtat(p, "blessure", new Rng(3));
    expect(sequelle).not.toBeNull();
    expect(p.sequelles).toHaveLength(1);
    expect(p.etats).toHaveLength(0);
    expect(p.exploits.soinsRecus).toBe(1);
  });

  it("ne laissent rien quand on le soigne a temps", () => {
    const p = quelquUn();
    contracterEtat(p, "maladie");
    expect(soignerEtat(p, "maladie", new Rng(3))).toBeNull();
    expect(p.sequelles).toHaveLength(0);
  });
});

describe("Les traits d'exploit", () => {
  it("ne tombent jamais au hasard : c'est le compteur qui les donne", () => {
    const p = quelquUn();
    p.traits = [];
    expect(verifierExploits(p)).toEqual([]);

    p.exploits.kills = 200;
    expect(verifierExploits(p)).toEqual(["veteran"]);
    // Et il ne le regagne pas a chaque aube.
    expect(verifierExploits(p)).toEqual([]);
  });

  it("donnent le Boucher en plus du Veteran a 500 eliminations", () => {
    const p = quelquUn();
    p.traits = [];
    p.exploits.kills = 500;
    expect(verifierExploits(p).sort()).toEqual(["boucher", "veteran"]);
  });

  it("rendent le Hante apres trois morts vues, definitivement", () => {
    const p = quelquUn();
    p.traits = [];
    const avant = p.mods.monteeStress;
    voirMourir(p);
    voirMourir(p);
    voirMourir(p);
    expect(verifierExploits(p)).toContain("hante");
    expect(p.mods.monteeStress).toBeGreaterThan(avant);
  });
});

describe("Le passage des journees", () => {
  it("use le Deracine et le rend au bout de trois journees", () => {
    const p = quelquUn();
    p.traits = [];
    p.exploits.posteDetruit = true;
    expect(verifierExploits(p)).toContain("deracine");

    const stresse = p.mods.monteeStress;
    expect(stresse).toBeCloseTo(2);

    avancerLaJournee(p, 2);
    expect(p.traits).toContain(idTrait("deracine"));

    avancerLaJournee(p, 2);
    expect(p.traits).not.toContain(idTrait("deracine"));
    expect(p.mods.monteeStress).toBeCloseTo(1);
  });

  it("ne touche pas aux traits definitifs", () => {
    const p = quelquUn();
    const traits = [...p.traits];
    avancerLaJournee(p, 100);
    expect(p.traits).toEqual(traits);
  });
});

describe("Les prenoms — la liste d'abord, les syllabes ensuite", () => {
  it("sert les prenoms ecrits a la main tant qu'il en reste", () => {
    const rng = new Rng(1);
    const pris: string[] = [];
    for (let i = 0; i < PRENOMS.length; i++) {
      const nom = prenomLibre(rng, pris);
      expect(PRENOMS).toContain(nom);
      pris.push(nom);
    }
  });

  it("ne rend jamais un prenom deja porte, meme a deux cents habitants", () => {
    // Le §4.18 ne pose **aucun plafond** de population : le vingt-septieme
    // habitant doit avoir un nom, pas un homonyme.
    const rng = new Rng(2);
    const pris: string[] = [];
    for (let i = 0; i < 200; i++) {
      const nom = prenomLibre(rng, pris);
      expect(pris).not.toContain(nom);
      pris.push(nom);
    }
    expect(new Set(pris).size).toBe(200);
  });

  it("assemble des noms qui se prononcent", () => {
    const rng = new Rng(3);
    const pris = [...PRENOMS];
    for (let i = 0; i < 300; i++) {
      const nom = prenomLibre(rng, pris);
      pris.push(nom);
      // Une majuscule, pas de chiffre, une longueur de nom propre, et jamais
      // quatre consonnes de suite — ce qui serait imprononcable.
      expect(nom[0]).toBe(nom[0]!.toUpperCase());
      expect(nom).not.toMatch(/[0-9]/);
      expect(nom.length).toBeGreaterThanOrEqual(4);
      expect(nom.length).toBeLessThanOrEqual(22);
      expect(nom.toLowerCase()).not.toMatch(/[bcdfgjklmnpqrstvwxz]{4}/);
    }
  });
});

describe("Touche-a-tout a la naissance (§4.23)", () => {
  it("ne se porte qu'en un degre, et le III est bien plus rare que le I", () => {
    const ids = [idTrait("touche-a-tout-1"), idTrait("touche-a-tout-2"), idTrait("touche-a-tout-3")];
    const comptes = [0, 0, 0];
    for (let graine = 1; graine <= 6000; graine++) {
      const p = creerPersonne("Gaston", new Rng(graine));
      const portes = ids.filter((id) => p.traits.includes(id));
      // Jamais deux degres a la fois.
      expect(portes.length).toBeLessThanOrEqual(1);
      ids.forEach((id, k) => {
        if (p.traits.includes(id)) comptes[k]! += 1;
      });
    }
    expect(comptes[0]!).toBeGreaterThan(comptes[1]!);
    expect(comptes[1]!).toBeGreaterThan(comptes[2]!);
    // Le III existe : il n'est pas qu'une ligne de table.
    expect(comptes[2]!).toBeGreaterThan(0);
  });
});
