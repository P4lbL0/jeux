import { describe, expect, it } from "vitest";
import {
  AMPLITUDE,
  auPiedDeLEglise,
  dansLeVillage,
  distanceALEglise,
  EGLISE,
  CASE,
  estPraticable,
  estTerreFerme,
  frontsDeLaVague,
  mondeCourant,
  MONDE,
  ondulation,
  PORT,
  POSTES,
  rivesAutour,
  PRATICABLE,
  pointDApparition,
  repartition,
  terrainEn,
  TERRAIN,
  VILLAGE,
  type Front,
} from "./carte";
import { ligneDeBande } from "./monde";

/** La ligne d'eau du monde classique, a une hauteur donnee : il a une mer, a l'ouest. */
const ligneDEau = (y: number) => ligneDeBande(mondeCourant().mer!, y);
/** Le pied de la montagne du monde classique, a une abscisse donnee. */
const ligneDeMontagne = (x: number) => ligneDeBande(mondeCourant().montagne!, x);

describe("Carte — le port", () => {
  it("est pose sur le sable, et pas dans l'eau", () => {
    // Le littoral ondule (§4.11) : un port a quelques pixels pres se retrouve
    // dans la mer, et ca ne se verrait qu'en jouant.
    expect(terrainEn(PORT.x, PORT.y)).toBe("sable");
  });

  it("tient tout entier sur la plage, emprise comprise", () => {
    const moitie = PORT.emprise / 2;
    expect(terrainEn(PORT.x - moitie, PORT.y)).toBe("sable");
    expect(terrainEn(PORT.x + moitie, PORT.y)).toBe("sable");
  });

  it("reste a l'ouest du village, adosse au flanc ferme (§4.6)", () => {
    expect(PORT.x).toBeLessThan(VILLAGE.x - VILLAGE.rayon);
  });
});

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
   * Le garde-fou du littoral ondulant : depuis que l'eau et la roche peuvent
   * etre n'importe ou (§4.29), ce n'est plus un rectangle qui les tient a
   * l'ecart, c'est le terrain lui-meme. « Praticable » veut dire « dans la
   * carte, et sur la terre ferme » — jamais dans la mer, jamais dans la roche.
   */
  it("ne dit praticable que la terre ferme, et jamais hors de la carte", () => {
    for (let x = 0; x <= MONDE.largeur; x += 11) {
      for (let y = 0; y <= MONDE.hauteur; y += 11) {
        const dedans =
          x >= PRATICABLE.x && x <= PRATICABLE.x + PRATICABLE.largeur && y >= PRATICABLE.y && y <= PRATICABLE.y + PRATICABLE.hauteur;
        expect(estPraticable(x, y)).toBe(dedans && estTerreFerme(x, y));
      }
    }
  });

  it("garde la ligne d'eau du classique a l'ouest, autour de sa position moyenne", () => {
    for (let y = 0; y <= MONDE.hauteur; y += 3) {
      expect(Math.abs(ligneDEau(y) - TERRAIN.mer)).toBeLessThanOrEqual(AMPLITUDE.cote);
    }
  });

  it("garde le pied de la montagne du classique au sud, autour de sa position moyenne", () => {
    for (let x = 0; x <= MONDE.largeur; x += 3) {
      expect(Math.abs(ligneDeMontagne(x) - TERRAIN.montagne)).toBeLessThanOrEqual(AMPLITUDE.montagne);
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
    expect(terrainEn(ligneDEau(500) + 10, 500)).toBe("sable");
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

describe("Les rives de la crue — d'ou sortent les betes d'eau (§4.21)", () => {
  const centre = { x: EGLISE.x, y: EGLISE.y };

  it("ne rend que de la terre ferme : rien ne nage dans ce jeu", () => {
    for (const point of rivesAutour(centre, 1400, 6)) {
      expect(estPraticable(point.x, point.y)).toBe(true);
      expect(estTerreFerme(point.x, point.y)).toBe(true);
    }
  });

  it("ne rend que des berges : chaque point touche l'eau", () => {
    const rives = rivesAutour(centre, 1400, 6);
    for (const point of rives) {
      const voisines = [
        terrainEn(point.x + CASE, point.y),
        terrainEn(point.x - CASE, point.y),
        terrainEn(point.x, point.y + CASE),
        terrainEn(point.x, point.y - CASE),
      ];
      expect(voisines.some((t) => t === "haut-fond" || t === "mer" || t === "abysse")).toBe(true);
    }
  });

  it("rend les plus proches d'abord, et jamais plus qu'on en demande", () => {
    const rives = rivesAutour(centre, 1400, 3);
    expect(rives.length).toBeLessThanOrEqual(3);
    const distances = rives.map((p) => Math.hypot(p.x - centre.x, p.y - centre.y));
    for (let i = 1; i < distances.length; i++) {
      expect(distances[i]!).toBeGreaterThanOrEqual(distances[i - 1]!);
    }
  });

  it("ne rend rien quand l'eau est hors de portee : un village loin de l'eau ne craint pas la crue", () => {
    // Un rayon d'une case et demie autour de l'eglise : il n'y a pas de lac sur
    // la place du village.
    expect(rivesAutour(centre, CASE * 1.5, 4)).toEqual([]);
  });

  it("tient sa promesse sur le monde classique, qui a la mer a l'ouest", () => {
    // La graine zero rend la carte d'avant : la mer y est, donc des berges aussi.
    expect(rivesAutour(centre, 2000, 4).length).toBeGreaterThan(0);
  });
});
