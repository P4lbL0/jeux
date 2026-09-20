import { describe, expect, it } from "vitest";
import { estTerreFermeDans, genererMonde, mondeClassique, type Monde } from "./monde";
import { Rng } from "./rng";
import {
  CAPS,
  CE_QUI_S_EST_PASSE,
  QUESTION_DU_GARDIEN,
  annonceDArrivee,
  capVers,
  longueurDeLaMarche,
  ouLonParait,
  paroleDuGardien,
  type VillageVuDeLoin,
} from "./marche";

/**
 * La marche (§4.29, 20 septembre 2026 au soir) : on parait loin, on marche, et
 * quelqu'un vient poser sa question a la porte.
 */

const GRAINES = Array.from({ length: 30 }, (_, i) => i + 1);

/** Un village vu de loin, par defaut celui du depart : trois habitants, un mur troue. */
function vueParDefaut(modifications: Partial<VillageVuDeLoin> = {}): VillageVuDeLoin {
  return { habitants: 3, mursDebout: 20, breches: 4, douves: false, fronts: ["nord", "est"], ...modifications };
}

describe("Ou l'on parait", () => {
  it("parait par le premier front du monde — le plus loin du village", () => {
    const m = mondeClassique();
    const { point, cote } = ouLonParait(m);
    expect(cote).toBe(m.fronts[0]);
    // On vient bien de ce bord-la : le point de depart en est a moins d'un pas
    // de recul (voir `RECUL_MAXIMUM`).
    const dAuBord = m.bords[cote].reduce(
      (min, p) => Math.min(min, Math.hypot(p.x - point.x, p.y - point.y)),
      Infinity,
    );
    expect(dAuBord).toBeLessThanOrEqual(400);
  });

  it("part du point de ce bord qui s'eloigne le plus du village", () => {
    const m = mondeClassique();
    const { point, cote } = ouLonParait(m);
    // On rentre de quelques pas vers le village : le point rendu est donc un
    // peu plus pres que le point de bord d'ou il vient, mais il en garde le cap.
    const d = longueurDeLaMarche(m, point);
    const loin = Math.max(...m.bords[cote].map((p) => longueurDeLaMarche(m, p)));
    expect(d).toBeLessThanOrEqual(loin);
    expect(d).toBeGreaterThan(loin - 400);
  });

  it("rentre assez dans les terres pour que la camera puisse cadrer", () => {
    for (const graine of GRAINES) {
      const m = genererMonde(graine);
      const { point } = ouLonParait(m);
      const auBord = Math.min(point.x, point.y, m.largeur - point.x, m.hauteur - point.y);
      expect(auBord).toBeGreaterThan(36);
    }
  });

  it("ne fait jamais paraitre dans l'eau ni dans la roche, quelle que soit la graine", () => {
    for (const graine of GRAINES) {
      const m: Monde = genererMonde(graine);
      const { point } = ouLonParait(m);
      expect(estTerreFermeDans(m, point.x, point.y)).toBe(true);
    }
  });

  it("fait toujours marcher : jamais a moins d'un ecran du village", () => {
    for (const graine of GRAINES) {
      const m = genererMonde(graine);
      const { point } = ouLonParait(m);
      expect(longueurDeLaMarche(m, point)).toBeGreaterThan(600);
    }
  });

  it("rend le meme point pour la meme graine — une graine, une arrivee", () => {
    const a = ouLonParait(genererMonde(7));
    const b = ouLonParait(genererMonde(7));
    expect(a).toEqual(b);
  });
});

describe("Le cap", () => {
  const centre = { x: 1000, y: 1000 };

  it("nomme les huit directions", () => {
    expect(capVers(centre, { x: 1000, y: 0 })).toBe("au NORD");
    expect(capVers(centre, { x: 2000, y: 0 })).toBe("au NORD-EST");
    expect(capVers(centre, { x: 2000, y: 1000 })).toBe("a l'EST");
    expect(capVers(centre, { x: 2000, y: 2000 })).toBe("au SUD-EST");
    expect(capVers(centre, { x: 1000, y: 2000 })).toBe("au SUD");
    expect(capVers(centre, { x: 0, y: 2000 })).toBe("au SUD-OUEST");
    expect(capVers(centre, { x: 0, y: 1000 })).toBe("a l'OUEST");
    expect(capVers(centre, { x: 0, y: 0 })).toBe("au NORD-OUEST");
  });

  it("pointe toujours vers le village depuis la ou l'on parait", () => {
    for (const graine of GRAINES) {
      const m = genererMonde(graine);
      const { point } = ouLonParait(m);
      expect(CAPS).toContain(capVers(point, m.village));
    }
  });

  it("s'annonce en une phrase, sans minimap", () => {
    expect(annonceDArrivee("au SUD")).toContain("au SUD");
  });
});

describe("Ce que dit celui qui tient la porte", () => {
  it("dit ce qui s'est passe, combien ils sont, ce qui tient, ce qui rode", () => {
    const lignes = paroleDuGardien(vueParDefaut(), new Rng(1));
    expect(lignes).toHaveLength(4);
    expect(CE_QUI_S_EST_PASSE).toContain(lignes[0]);
    expect(lignes[1]).toContain("trois");
    expect(lignes[2]).toContain("mur");
    expect(lignes[3]).toContain("NORD");
    expect(lignes[3]).toContain("EST");
  });

  it("ne dit jamais ce qui ne se voit pas de loin : ni maladie, ni stress, ni reserves", () => {
    const interdits = ["malad", "fievre", "peste", "stress", "reserve", "grenier", "vivres"];
    for (const graine of GRAINES) {
      for (const habitants of [1, 3, 6, 12]) {
        const lignes = paroleDuGardien(vueParDefaut({ habitants }), new Rng(graine)).join(" ").toLowerCase();
        for (const mot of interdits) expect(lignes).not.toContain(mot);
      }
    }
  });

  it("rend la meme parole pour la meme graine", () => {
    expect(paroleDuGardien(vueParDefaut(), new Rng(42))).toEqual(
      paroleDuGardien(vueParDefaut(), new Rng(42)),
    );
  });

  it("dit un mur tombe quand il n'y a plus de mur", () => {
    const lignes = paroleDuGardien(vueParDefaut({ mursDebout: 0 }), new Rng(3));
    expect(lignes[2]).toContain("rien du mur");
  });

  it("dit le fosse quand il y en a un, et seulement alors", () => {
    expect(paroleDuGardien(vueParDefaut({ douves: true }), new Rng(3))[2]).toContain("fosse");
    expect(paroleDuGardien(vueParDefaut({ douves: false }), new Rng(3))[2]).not.toContain("fosse");
  });

  it("dit « de partout » a quatre fronts, et « notre seule chance » a un seul", () => {
    const partout = paroleDuGardien(vueParDefaut({ fronts: ["nord", "est", "sud", "ouest"] }), new Rng(3));
    expect(partout[3]).toContain("partout");
    const seul = paroleDuGardien(vueParDefaut({ fronts: ["sud"] }), new Rng(3));
    expect(seul[3]).toContain("seule chance");
  });

  it("pose toujours la meme question — c'est elle, le renversement", () => {
    expect(QUESTION_DU_GARDIEN).toBe("Veux-tu nous proteger ?");
  });
});
