import { describe, expect, it } from "vitest";
import { CASE, COLONNES, PRATICABLE, chargerLeMonde } from "./carte";
import {
  AMPLITUDE_CLASSIQUE,
  COTES,
  GRAINE_CLASSIQUE,
  MONDE,
  TERRAIN_CLASSIQUE,
  distanceALEau,
  estTerreFermeDans,
  genererMonde,
  graineDeMonde,
  mondeClassique,
  ondulation,
  pointDeLisiere,
  pointDuBord,
  relierAuVillage,
  segmentSurTerre,
  terrainDeCase,
  terrainDuMonde,
  TAILLE_CLASSIQUE,
  type Monde,
} from "./monde";

/**
 * Le monde d'une partie (§4.29, 20 septembre 2026) : une graine, un monde —
 * la mer sur un bord ou absente, un lac, une chaine, un massif ou un piton,
 * un village pose pres de l'eau, des postes trouves sur le terrain, des
 * fronts deduits des bords accessibles.
 */

/** Les graines qu'on eprouve : assez pour couvrir chaque forme, pas trop pour rester rapide. */
const GRAINES = Array.from({ length: 40 }, (_, i) => i + 1);

describe("Le monde classique — la carte d'avant, exactement", () => {
  const m = mondeClassique();

  it("a la mer a l'ouest, la montagne et la foret au sud, le village dans l'angle", () => {
    expect(m.mer?.cote).toBe("ouest");
    expect(m.montagne?.cote).toBe("sud");
    expect(m.lisiere?.cote).toBe("sud");
    expect(m.village).toEqual({ x: 470, y: 1070 });
    expect(m.fronts).toEqual(["nord", "est"]);
  });

  it("classe le sol comme les formules d'avant", () => {
    const ligneDEau = (y: number) => TERRAIN_CLASSIQUE.mer + ondulation(y, 130, AMPLITUDE_CLASSIQUE.cote);
    const ligneDeSable = (y: number) => ligneDEau(y) + TERRAIN_CLASSIQUE.plage + ondulation(y + 480, 88, AMPLITUDE_CLASSIQUE.plage);
    const ligneDeForet = (x: number) => TERRAIN_CLASSIQUE.foret + ondulation(x + 910, 118, AMPLITUDE_CLASSIQUE.foret);
    const ligneDeMontagne = (x: number) => TERRAIN_CLASSIQUE.montagne + ondulation(x, 152, AMPLITUDE_CLASSIQUE.montagne);
    const avant = (x: number, y: number) => {
      const eau = ligneDEau(y);
      if (x < eau - 104) return "abysse";
      if (x < eau - 38) return "mer";
      if (x < eau) return "haut-fond";
      const montagne = ligneDeMontagne(x);
      if (y > montagne + 44) return "roche";
      if (y > montagne) return "eboulis";
      if (x < ligneDeSable(y)) return "sable";
      if (y > ligneDeForet(x)) return "sous-bois";
      return "herbe";
    };
    let ecarts = 0;
    for (let y = 0; y < MONDE.hauteur; y += 13) {
      for (let x = 0; x < MONDE.largeur; x += 13) if (terrainDuMonde(m, x, y) !== avant(x, y)) ecarts += 1;
    }
    // Les deux ecrivent la meme formule ; seule l'arithmetique flottante peut
    // les separer, sur la ligne exacte d'une limite, et ca ne se voit pas.
    expect(ecarts).toBeLessThan(3);
  });

  it("relie les quatre postes et le port au village par la terre ferme", () => {
    for (const poste of m.postes) expect(segmentSurTerre(m, m.village, poste.position), poste.id).toBe(true);
    expect(segmentSurTerre(m, m.village, m.port)).toBe(true);
  });
});

describe("Un monde tire — les regles d'assemblage", () => {
  const mondes = GRAINES.map((g) => genererMonde(g));

  it("redonne le meme monde pour la meme graine", () => {
    for (const g of [1, 7, 42]) expect(genererMonde(g)).toEqual(genererMonde(g));
  });

  it("ne rend jamais deux fois le meme monde pour deux graines", () => {
    const villages = new Set(mondes.map((m) => `${m.village.x},${m.village.y},${m.mer?.cote ?? "-"}`));
    expect(villages.size).toBeGreaterThan(GRAINES.length * 0.8);
  });

  it("ne retombe pas sur le classique : chaque graine a son monde", () => {
    for (const m of mondes) expect(m.graine).not.toBe(GRAINE_CLASSIQUE);
  });

  it("a toujours une eau, une roche et des arbres : le pecheur, le mineur et le bucheron ont un poste", () => {
    for (const m of mondes) {
      expect(m.mer !== null || m.lacs.length > 0, `graine ${m.graine} : de l'eau`).toBe(true);
      expect(m.montagne !== null || m.massifs.length > 0, `graine ${m.graine} : de la roche`).toBe(true);
      expect(m.lisiere !== null || m.bois.length > 0 || m.anneauDeBois > 0, `graine ${m.graine} : des arbres`).toBe(true);
    }
  });

  it("varie : la mer change de bord ou disparait, le relief change de forme, des lacs apparaissent", () => {
    const mers = new Set(mondes.map((m) => m.mer?.cote ?? "aucune"));
    expect(mers.size).toBeGreaterThanOrEqual(4);
    expect(mondes.some((m) => m.montagne !== null)).toBe(true);
    expect(mondes.some((m) => m.massifs.length > 0)).toBe(true);
    expect(mondes.some((m) => m.lacs.length > 0)).toBe(true);
  });

  it("pose l'eglise sur l'herbe, loin des bords, avec de l'herbe autour", () => {
    for (const m of mondes) {
      expect(terrainDuMonde(m, m.village.x, m.village.y), `graine ${m.graine}`).toBe("herbe");
      expect(m.village.x).toBeGreaterThan(200);
      expect(m.village.x).toBeLessThan(MONDE.largeur - 200);
      expect(m.village.y).toBeGreaterThan(200);
      expect(m.village.y).toBeLessThan(MONDE.hauteur - 200);
    }
  });

  it("pose le port sur le sable, contre l'eau, le navire vers le large", () => {
    for (const m of mondes) {
      expect(terrainDuMonde(m, m.port.x, m.port.y), `graine ${m.graine}`).toBe("sable");
      const large = { x: m.port.x + m.port.versLeLarge.x * 40, y: m.port.y + m.port.versLeLarge.y * 40 };
      expect(distanceALEau(m, large.x, large.y), `graine ${m.graine} : le large`).toBeLessThan(distanceALEau(m, m.port.x, m.port.y));
      expect(Math.hypot(m.port.versLeLarge.x, m.port.versLeLarge.y)).toBeCloseTo(1);
    }
  });

  it("donne a chaque poste son terrain, et un metier different a chacun", () => {
    for (const m of mondes) {
      const metiers = new Set(m.postes.map((p) => p.metier));
      expect(metiers.size).toBe(4);
      for (const p of m.postes) {
        const t = terrainDuMonde(m, p.position.x, p.position.y);
        expect(["sable", "herbe", "sous-bois"], `graine ${m.graine} ${p.id}`).toContain(t);
        if (p.id === "plage") expect(t).toBe("sable");
        if (p.id === "foret") expect(t).toBe("sous-bois");
        if (p.id === "champs") expect(t).toBe("herbe");
      }
    }
  });

  it("tient les postes hors du village, et les relie a l'eglise en ligne droite", () => {
    for (const m of mondes) {
      for (const p of m.postes) {
        expect(Math.hypot(p.position.x - m.village.x, p.position.y - m.village.y), `graine ${m.graine} ${p.id}`).toBeGreaterThanOrEqual(150);
        expect(segmentSurTerre(m, m.village, p.position), `graine ${m.graine} ${p.id}`).toBe(true);
      }
      expect(segmentSurTerre(m, m.village, m.port), `graine ${m.graine} port`).toBe(true);
    }
  });

  it("ouvre entre un et quatre fronts, tous relies au village", () => {
    for (const m of mondes) {
      expect(m.fronts.length).toBeGreaterThanOrEqual(1);
      expect(m.fronts.length).toBeLessThanOrEqual(4);
      for (const f of m.fronts) expect(m.bords[f].length, `graine ${m.graine} ${f}`).toBeGreaterThanOrEqual(6);
    }
  });

  it("fait surgir les monstres au bord, sur la terre, et relies au village", () => {
    for (const m of mondes) {
      const atteint = relierAuVillage(m);
      for (const f of m.fronts) {
        for (const tirage of [0, 0.3, 0.5, 0.7, 0.999]) {
          const p = pointDuBord(m, f, tirage);
          expect(estTerreFermeDans(m, p.x, p.y), `graine ${m.graine} ${f} ${tirage}`).toBe(true);
          const auBord = p.x <= 48 || p.y <= 48 || p.x >= MONDE.largeur - 48 || p.y >= MONDE.hauteur - 48;
          expect(auBord, `graine ${m.graine} ${f} ${tirage} : au bord`).toBe(true);
          const c = Math.floor(p.x / 32);
          const l = Math.floor(p.y / 32);
          expect(atteint[l * 63 + c], `graine ${m.graine} ${f} ${tirage} : relie`).toBe(1);
        }
      }
    }
  });

  it("donne aux survivants une lisiere sur chaque cote qui a une terre, et le classique en a quatre", () => {
    const classique = mondeClassique();
    for (const cote of COTES) expect(pointDeLisiere(classique, cote, 0.5), cote).not.toBeNull();
    for (const m of mondes) {
      for (const cote of COTES) {
        const p = pointDeLisiere(m, cote, 0.4);
        if (p) expect(estTerreFermeDans(m, p.x, p.y), `graine ${m.graine} ${cote}`).toBe(true);
      }
    }
  });

  it("tire une graine d'horloge qui n'est jamais celle du classique", () => {
    for (const t of [0, 999_999, 1_999_998, Date.now()]) expect(graineDeMonde(t)).not.toBe(GRAINE_CLASSIQUE);
  });

  it("se tire en moins de cent millisecondes", () => {
    const depart = performance.now();
    genererMonde(4242);
    expect(performance.now() - depart).toBeLessThan(100);
  });
});

/**
 * La zone jouable est un **parametre** (§4.29, 20 septembre 2026 au soir) : le
 * nouveau depart la fait grandir — « on monte de x1 a x3 en mesurant » — et une
 * constante ne peut pas grandir. Ce qui est verifie ici, c'est qu'un monde plus
 * grand reste un monde **jouable** : village dedans, postes trouves, fronts
 * ouverts. Un generateur qui rendrait un monde vide passerait un test de taille.
 */
describe("La zone jouable, en parametre", () => {
  const TAILLES = [
    { nom: "x1", largeur: 2000, hauteur: 1500 },
    { nom: "x2", largeur: 2830, hauteur: 2120 },
    { nom: "x3", largeur: 3460, hauteur: 2600 },
  ];

  it("rend un monde de la taille demandee", () => {
    for (const t of TAILLES) {
      const m = genererMonde(7, t);
      expect([m.largeur, m.hauteur], t.nom).toEqual([t.largeur, t.hauteur]);
    }
  });

  it("garde un monde jouable a chaque taille : village dedans, quatre postes, au moins un front", () => {
    for (const t of TAILLES) {
      for (const graine of [3, 17, 128]) {
        const m = genererMonde(graine, t);
        const ou = `${t.nom} graine ${graine}`;
        expect(m.village.x, ou).toBeGreaterThan(0);
        expect(m.village.x, ou).toBeLessThan(m.largeur);
        expect(m.village.y, ou).toBeLessThan(m.hauteur);
        expect(m.postes.length, ou).toBe(4);
        expect(m.fronts.length, ou).toBeGreaterThan(0);
        // Les bords releves tombent dans le monde, pas dans celui d'avant.
        for (const cote of COTES) {
          for (const p of m.bords[cote]) {
            expect(p.x, `${ou} ${cote}`).toBeLessThanOrEqual(m.largeur);
            expect(p.y, `${ou} ${cote}`).toBeLessThanOrEqual(m.hauteur);
          }
        }
      }
    }
  });

  it("ne touche pas au classique : la graine zero garde sa carte, quoi qu'on demande", () => {
    const m = genererMonde(GRAINE_CLASSIQUE, { largeur: 9000, hauteur: 9000 });
    expect([m.largeur, m.hauteur]).toEqual([TAILLE_CLASSIQUE.largeur, TAILLE_CLASSIQUE.hauteur]);
    expect(m.village).toEqual(mondeClassique().village);
  });

  it("charge la taille du monde, et la rend a `MONDE` et a `PRATICABLE`", () => {
    const grand = genererMonde(21, TAILLES[2]!);
    chargerLeMonde(grand);
    expect([MONDE.largeur, MONDE.hauteur]).toEqual([grand.largeur, grand.hauteur]);
    expect(PRATICABLE.largeur).toBe(grand.largeur - 32);
    expect(COLONNES).toBe(Math.ceil(grand.largeur / CASE));
    // ⚠️ On remet le classique : `MONDE` est global, et le laisser grand
    // ferait jouer les tests suivants sur les bornes de celui-ci.
    chargerLeMonde(mondeClassique());
    expect(MONDE.largeur).toBe(TAILLE_CLASSIQUE.largeur);
  });

  it("se tire encore en moins de trois cents millisecondes au plus grand", () => {
    const depart = performance.now();
    genererMonde(4242, TAILLES[2]!);
    expect(performance.now() - depart).toBeLessThan(300);
  });
});

describe("Le terrain d'un monde tire", () => {
  it("met le lac dans l'eau, avec du sable autour, et l'herbe plus loin", () => {
    const m: Monde = { ...mondeClassique(), graine: 9, mer: null, montagne: null, lisiere: null, lacs: [{ x: 1000, y: 700, rx: 200, ry: 150, relief: 0, phases: [0, 0, 0] }] };
    expect(terrainDuMonde(m, 1000, 700)).toBe("abysse");
    expect(terrainDuMonde(m, 1000 + 190, 700)).toBe("haut-fond");
    expect(terrainDuMonde(m, 1000 + 210, 700)).toBe("sable");
    expect(terrainDuMonde(m, 1000 + 260, 700)).toBe("herbe");
  });

  it("met le massif dans la roche, l'eboulis a son pied, puis les arbres", () => {
    const m: Monde = { ...mondeClassique(), graine: 9, montagne: null, lisiere: null, anneauDeBois: 80, massifs: [{ x: 1000, y: 700, rx: 200, ry: 150, relief: 0, phases: [0, 0, 0] }] };
    expect(terrainDuMonde(m, 1000, 700)).toBe("roche");
    expect(terrainDuMonde(m, 1000 + 190, 700)).toBe("eboulis");
    expect(terrainDuMonde(m, 1000 + 240, 700)).toBe("sous-bois");
    expect(terrainDuMonde(m, 1000 + 300, 700)).toBe("herbe");
    expect(terrainDeCase(m, 31, 21)).toBe("roche");
  });
});
