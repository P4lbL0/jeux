import { describe, expect, it } from "vitest";
import {
  AMPLITUDE,
  auPiedDeLEglise,
  dansLeVillage,
  distanceALEglise,
  EGLISE,
  estPraticable,
  estTerreFerme,
  frontsDeLaVague,
  ligneDeMontagne,
  ligneDEau,
  MONDE,
  ondulation,
  POSTES,
  PRATICABLE,
  pointDApparition,
  repartition,
  terrainEn,
  TERRAIN,
  VILLAGE,
  type Front,
} from "./carte";

describe("Carte — les flancs fermes", () => {
  /**
   * La promesse du §4.6 : la mer et la montagne ferment deux bords. Si l'un des
   * deux devient franchissable, toute la carte perd son sens.
   */
  it("interdit la mer a l'ouest", () => {
    expect(estPraticable(10, 500)).toBe(false);
    expect(estPraticable(TERRAIN.mer - AMPLITUDE.cote - 1, 500)).toBe(false);
  });

  it("interdit la montagne au sud", () => {
    expect(estPraticable(800, MONDE.hauteur - 10)).toBe(false);
    expect(estPraticable(800, TERRAIN.montagne + AMPLITUDE.montagne + 1)).toBe(false);
  });

  /**
   * Le garde-fou du littoral ondulant : la zone praticable est un rectangle,
   * mais les limites serpentent. Si le rectangle mordait sur l'eau ou sur la
   * roche, un heros pourrait marcher dans la mer.
   */
  it("ne laisse aucun point praticable tomber dans l'eau ou dans la roche", () => {
    for (let x = PRATICABLE.x; x <= PRATICABLE.x + PRATICABLE.largeur; x += 7) {
      for (let y = PRATICABLE.y; y <= PRATICABLE.y + PRATICABLE.hauteur; y += 7) {
        expect(estTerreFerme(x, y)).toBe(true);
      }
    }
  });

  it("garde la ligne d'eau a l'ouest du bord praticable, quelle que soit la hauteur", () => {
    for (let y = 0; y <= MONDE.hauteur; y += 3) {
      expect(ligneDEau(y)).toBeLessThan(PRATICABLE.x);
    }
  });

  it("garde le pied de la montagne au sud du bord praticable", () => {
    const bas = PRATICABLE.y + PRATICABLE.hauteur;
    for (let x = 0; x <= MONDE.largeur; x += 3) {
      expect(ligneDeMontagne(x)).toBeGreaterThan(bas);
    }
  });
});

describe("Carte — le littoral", () => {
  /**
   * Une cote droite se lit comme un mur d'editeur de niveau. Elle doit onduler
   * (DESIGN.md §4.11, reference WorldBox).
   */
  it("fait serpenter la cote au lieu de la tracer a la regle", () => {
    const lignes = [];
    for (let y = 0; y <= MONDE.hauteur; y += 40) lignes.push(ligneDEau(y));
    const min = Math.min(...lignes);
    const max = Math.max(...lignes);
    expect(max - min).toBeGreaterThan(30);
  });

  it("garde l'ondulation dans ses bornes", () => {
    for (let t = 0; t < 4000; t += 3) {
      const v = ondulation(t, 130, 34);
      expect(Math.abs(v)).toBeLessThanOrEqual(34);
    }
  });

  it("etage la mer du large jusqu'au rivage", () => {
    const y = 500;
    const eau = ligneDEau(y);
    expect(terrainEn(eau - 200, y)).toBe("abysse");
    expect(terrainEn(eau - 70, y)).toBe("mer");
    expect(terrainEn(eau - 10, y)).toBe("haut-fond");
    expect(terrainEn(eau + 10, y)).toBe("sable");
  });

  it("laisse la plage et la foret praticables : ce sont des lieux de travail", () => {
    expect(terrainEn(PRATICABLE.x + 2, 500)).toBe("sable");
    expect(terrainEn(900, TERRAIN.foret + AMPLITUDE.foret + 10)).toBe("sous-bois");
  });

  it("donne la meme carte a chaque appel : on doit pouvoir apprendre son terrain", () => {
    expect(terrainEn(700, 400)).toBe(terrainEn(700, 400));
    expect(ligneDEau(333)).toBe(ligneDEau(333));
  });
});

describe("Carte — le village", () => {
  it("tient entierement dans la zone praticable", () => {
    // Sinon une partie du refuge serait dans la roche ou dans l'eau.
    expect(estPraticable(VILLAGE.x - VILLAGE.rayon, VILLAGE.y)).toBe(true);
    expect(estPraticable(VILLAGE.x + VILLAGE.rayon, VILLAGE.y)).toBe(true);
    expect(estPraticable(VILLAGE.x, VILLAGE.y - VILLAGE.rayon)).toBe(true);
    expect(estPraticable(VILLAGE.x, VILLAGE.y + VILLAGE.rayon)).toBe(true);
  });

  it("est bien adosse au sud-ouest, loin des deux fronts", () => {
    const centreCarte = { x: PRATICABLE.x + PRATICABLE.largeur / 2, y: PRATICABLE.y + PRATICABLE.hauteur / 2 };
    expect(VILLAGE.x).toBeLessThan(centreCarte.x);
    expect(VILLAGE.y).toBeGreaterThan(centreCarte.y);
  });

  it("reconnait l'interieur du village", () => {
    expect(dansLeVillage(VILLAGE.x, VILLAGE.y)).toBe(true);
    expect(dansLeVillage(VILLAGE.x + VILLAGE.rayon + 5, VILLAGE.y)).toBe(false);
  });
});

describe("Carte — l'eglise", () => {
  it("est posee sur un terrain praticable et ferme", () => {
    expect(estPraticable(EGLISE.x, EGLISE.y)).toBe(true);
    expect(estTerreFerme(EGLISE.x, EGLISE.y)).toBe(true);
  });

  it("est au centre du village, et pas ailleurs", () => {
    // Ce n'est pas de l'esthetique : `piloter()` renvoie un heros en repli vers
    // le **centre de la cite**, et c'est la qu'il doit trouver le soin. Deplacer
    // l'eglise sans toucher a l'IA casserait le repli des 20% (§4.3).
    expect(EGLISE.x).toBe(VILLAGE.x);
    expect(EGLISE.y).toBe(VILLAGE.y);
  });

  it("n'accueille qu'a son pied, pas dans tout le village", () => {
    // Le §4.22 est formel : il n'y a pas d'abri par proximite. Se tenir dans le
    // village ne protege de rien, il faut toucher le batiment.
    expect(auPiedDeLEglise(EGLISE.x, EGLISE.y)).toBe(true);
    expect(auPiedDeLEglise(EGLISE.x + EGLISE.emprise, EGLISE.y)).toBe(false);
    expect(auPiedDeLEglise(EGLISE.x + VILLAGE.rayon - 10, EGLISE.y)).toBe(false);
  });

  it("laisse la place aux maisons, qui sont posees plus loin", () => {
    // Les maisons de `construireVillage` sont a 0,55 fois le rayon au plus
    // pres : l'emprise de l'eglise ne doit pas mordre dessus.
    expect(EGLISE.emprise / 2).toBeLessThan(VILLAGE.rayon * 0.55);
  });

  it("mesure la distance depuis son parvis", () => {
    expect(distanceALEglise(EGLISE.x, EGLISE.y)).toBe(0);
    expect(distanceALEglise(EGLISE.x + 100, EGLISE.y)).toBeCloseTo(100);
  });
});

describe("Carte — les postes de travail", () => {
  it("place chaque poste sur un terrain praticable", () => {
    for (const poste of POSTES) {
      expect(estPraticable(poste.position.x, poste.position.y)).toBe(true);
    }
  });

  it("les pose hors du village : ils doivent etre defendus, pas offerts", () => {
    for (const poste of POSTES) {
      expect(dansLeVillage(poste.position.x, poste.position.y)).toBe(false);
    }
  });

  it("les pose sur de la terre ferme", () => {
    for (const poste of POSTES) {
      expect(estTerreFerme(poste.position.x, poste.position.y)).toBe(true);
    }
  });

  it("donne un metier different a chacun", () => {
    const metiers = POSTES.map((p) => p.metier);
    expect(new Set(metiers).size).toBe(metiers.length);
  });
});

describe("Carte — le calendrier des fronts", () => {
  /**
   * Deux fronts, ce n'est pas moitie moins de travail : c'est deux endroits ou
   * etre a la fois. Les premieres vagues ne doivent en ouvrir qu'un (§4.6).
   */
  it("n'ouvre que le nord sur les quatre premieres vagues", () => {
    for (let vague = 1; vague <= 4; vague++) {
      for (const tirage of [0, 0.49, 0.5, 0.99]) {
        expect(frontsDeLaVague(vague, tirage)).toEqual(["nord"]);
      }
    }
  });

  it("n'ouvre toujours qu'un seul front jusqu'a la vague 9, mais lequel varie", () => {
    for (let vague = 5; vague <= 9; vague++) {
      expect(frontsDeLaVague(vague, 0.1)).toHaveLength(1);
      expect(frontsDeLaVague(vague, 0.9)).toHaveLength(1);
    }
    expect(frontsDeLaVague(7, 0.1)).toEqual(["nord"]);
    expect(frontsDeLaVague(7, 0.9)).toEqual(["est"]);
  });

  it("ouvre les deux fronts a partir de la vague 10", () => {
    for (const vague of [10, 25, 200]) {
      expect(frontsDeLaVague(vague, 0.5)).toEqual(["nord", "est"]);
    }
  });

  it("desequilibre la repartition sans jamais vider un front", () => {
    const fronts: Front[] = ["nord", "est"];
    for (const tirage of [0, 0.5, 0.999]) {
      const part = repartition(fronts, tirage);
      expect(part).toBeGreaterThanOrEqual(0.25);
      expect(part).toBeLessThanOrEqual(0.75);
    }
    // Un front unique recoit tout.
    expect(repartition(["nord"], 0.3)).toBe(1);
  });
});

describe("Carte — les apparitions", () => {
  it("fait toujours surgir les ennemis sur un terrain praticable", () => {
    for (const front of ["nord", "est"] as Front[]) {
      for (const tirage of [0, 0.25, 0.5, 0.75, 0.999]) {
        const point = pointDApparition(front, tirage);
        expect(estPraticable(point.x, point.y)).toBe(true);
      }
    }
  });

  it("les fait surgir au bord, jamais au milieu de la carte", () => {
    const nord = pointDApparition("nord", 0.5);
    expect(nord.y).toBeLessThan(PRATICABLE.y + 60);

    const est = pointDApparition("est", 0.5);
    expect(est.x).toBeGreaterThan(PRATICABLE.x + PRATICABLE.largeur - 60);
  });

  it("n'en fait jamais surgir dans la mer ni dans la montagne", () => {
    for (const front of ["nord", "est"] as Front[]) {
      for (let i = 0; i <= 100; i++) {
        const point = pointDApparition(front, i / 100);
        expect(point.x).toBeGreaterThanOrEqual(TERRAIN.mer);
        expect(point.y).toBeLessThanOrEqual(TERRAIN.montagne);
      }
    }
  });

  /**
   * Le front nord doit arriver loin du village, sinon il n'y a pas de temps de
   * reaction et l'annonce ne sert a rien.
   */
  it("fait apparaitre les ennemis loin du village", () => {
    for (const front of ["nord", "est"] as Front[]) {
      for (let i = 0; i <= 20; i++) {
        const point = pointDApparition(front, i / 20);
        const distance = Math.hypot(point.x - VILLAGE.x, point.y - VILLAGE.y);
        expect(distance).toBeGreaterThan(VILLAGE.rayon * 2);
      }
    }
  });
});
