import { describe, expect, it } from "vitest";
import { CLASSES } from "./classes";
import {
  distanceIdeale,
  ENNEMIS_POUR_ULTIME,
  LAISSE,
  piloter,
  SEUIL_RETOUR,
  type ContexteIA,
  type HeroPilote,
  type Vecteur,
} from "./ia";
import { POSTURES, REGLAGES, type Posture } from "./ordres";

const CITE = { x: 0, y: 0, rayon: 100 };

function contexte(ennemi: Vecteur | null, autour = 0): ContexteIA {
  return {
    cite: CITE,
    ennemiLePlusProche: () => ennemi,
    nombreEnnemisAutour: () => autour,
  };
}

function heros(partiel: Partial<HeroPilote> = {}): HeroPilote {
  return { x: 300, y: 0, etat: "combat", ratioPv: 1, portee: 50, ...partiel };
}

describe("IA — le repli", () => {
  /**
   * La garantie centrale du design (DESIGN.md §4.3) : l'IA ne perd jamais un
   * heros. Un heros en repli doit rentrer, quoi qu'il se passe autour.
   */
  it("rentre a la cite quel que soit le contexte", () => {
    const cas: Vecteur[] = [
      { x: 300, y: 0 },
      { x: -300, y: 0 },
      { x: 0, y: 250 },
      { x: -180, y: -180 },
    ];
    for (const position of cas) {
      const hero = heros({ ...position, etat: "repli", ratioPv: 0.15 });
      // Meme entoure d'ennemis a portee immediate.
      const { direction, lancerUltime } = piloter(hero, contexte(position, 12));

      expect(lancerUltime).toBe(false);
      // La direction doit rapprocher de la cite.
      const avant = Math.hypot(hero.x - CITE.x, hero.y - CITE.y);
      const apres = Math.hypot(hero.x + direction.x - CITE.x, hero.y + direction.y - CITE.y);
      expect(apres).toBeLessThan(avant);
    }
  });

  it("reste immobile a la cite tant qu'il n'est pas remis", () => {
    const hero = heros({ x: 10, y: 10, etat: "cite", ratioPv: SEUIL_RETOUR - 0.01 });
    expect(piloter(hero, contexte({ x: 300, y: 0 }))).toEqual({
      direction: { x: 0, y: 0 },
      lancerUltime: false,
    });
  });

  it("repart au combat une fois soigne", () => {
    const hero = heros({ x: 10, y: 10, etat: "cite", ratioPv: SEUIL_RETOUR });
    const { direction } = piloter(hero, contexte({ x: 300, y: 0 }));
    expect(direction).not.toEqual({ x: 0, y: 0 });
  });

  it("ne fait rien quand il est mort", () => {
    const hero = heros({ etat: "mort", ratioPv: 0 });
    expect(piloter(hero, contexte({ x: 310, y: 0 }, 9)).direction).toEqual({ x: 0, y: 0 });
  });
});

describe("IA — le Necromancien", () => {
  it("rentre a la cite meme si un ennemi passe a portee", () => {
    const hero = heros({ x: 400, y: 0, resteEnCite: true });
    const { direction } = piloter(hero, contexte({ x: 420, y: 0 }, 5));
    expect(direction.x).toBeLessThan(0);
  });

  it("ne bouge plus une fois au coeur de la cite", () => {
    const hero = heros({ x: 10, y: 0, etat: "cite", resteEnCite: true });
    expect(piloter(hero, contexte({ x: 300, y: 0 })).direction).toEqual({ x: 0, y: 0 });
  });

  it("appelle quand meme ses morts face a un groupe", () => {
    const hero = heros({ x: 10, y: 0, etat: "cite", resteEnCite: true });
    expect(piloter(hero, contexte({ x: 300, y: 0 }, 6)).lancerUltime).toBe(true);
  });
});

describe("IA — la laisse", () => {
  it("revient vers la cite quand il s'en eloigne trop", () => {
    const hero = heros({ x: LAISSE + 50, y: 0 });
    const { direction } = piloter(hero, contexte({ x: LAISSE + 200, y: 0 }));
    expect(direction.x).toBeLessThan(0);
  });
});

describe("IA — la distance de combat", () => {
  it("avance quand la cible est trop loin", () => {
    const hero = heros({ x: 0, y: 0, portee: 50 });
    const { direction } = piloter(hero, contexte({ x: 200, y: 0 }));
    expect(direction.x).toBeGreaterThan(0.9);
  });

  it("recule quand la cible est trop pres", () => {
    const hero = heros({ x: 0, y: 0, portee: 50 });
    const { direction } = piloter(hero, contexte({ x: 5, y: 0 }));
    expect(direction.x).toBeLessThan(-0.9);
  });

  it("contourne quand il est a la bonne distance", () => {
    const hero = heros({ x: 0, y: 0, portee: 50 });
    const ideale = distanceIdeale(hero);
    const { direction } = piloter(hero, contexte({ x: ideale, y: 0 }));
    // Perpendiculaire a la cible : il tourne autour au lieu de se figer.
    expect(Math.abs(direction.x)).toBeLessThan(0.01);
    expect(Math.abs(direction.y)).toBeCloseTo(1, 2);
  });

  /**
   * Garde-fou de design (DESIGN.md §4.2) : chaque classe doit se battre a une
   * distance qui lui est propre, sinon l'equipe devient un magma illisible.
   */
  it("tient une distance differente pour chaque classe", () => {
    const distances = Object.values(CLASSES).map((c) => distanceIdeale({ portee: c.portee }));
    expect(new Set(distances).size).toBe(distances.length);
    // Le mage se tient nettement plus loin que le corps a corps le plus long.
    const mage = distanceIdeale({ portee: CLASSES.mage.portee });
    const guerrier = distanceIdeale({ portee: CLASSES.guerrier.portee });
    expect(mage).toBeGreaterThan(guerrier * 3);
  });
});

describe("IA — les ordres", () => {
  /**
   * Le garde-fou du jalon 4 (DESIGN.md §4.4). Si une posture pouvait annuler le
   * repli, le joueur perdrait un heros sans l'avoir decide — et tout le §4.3
   * s'ecroulerait. Ce test doit rester vert quoi qu'on ajoute ensuite.
   */
  it("aucune posture n'empeche le repli des 20%", () => {
    for (const posture of POSTURES) {
      for (const ancre of [null, { x: 900, y: 900 }]) {
        const hero = heros({
          x: 400,
          y: 0,
          etat: "repli",
          ratioPv: 0.05,
          ordre: { posture, ancre },
          // Meme avec un poste de formation a l'autre bout de la carte.
          poste: { x: -900, y: 900 },
        });
        const { direction, lancerUltime } = piloter(hero, contexte({ x: 410, y: 0 }, 20));

        expect(lancerUltime).toBe(false);
        expect(direction.x).toBeLessThan(0);
        expect(Math.abs(direction.y)).toBeLessThan(0.01);
      }
    }
  });

  it("la posture de repli renvoie a la cite un heros en pleine forme", () => {
    const hero = heros({ x: 400, y: 0, ordre: { posture: "repli", ancre: null } });
    const { direction, lancerUltime } = piloter(hero, contexte({ x: 410, y: 0 }, 20));
    expect(direction.x).toBeLessThan(0);
    expect(lancerUltime).toBe(false);
  });

  it("va tenir l'ancre qu'on lui donne au lieu de rester pres de la cite", () => {
    const ancre = { x: 800, y: 0 };
    const hero = heros({ x: 0, y: 0, ordre: { posture: "temporiser", ancre } });
    // Aucun ennemi : il rejoint sa position.
    const { direction } = piloter(hero, contexte(null));
    expect(direction.x).toBeGreaterThan(0.9);
  });

  it("s'arrete une fois arrive sur son ancre", () => {
    const ancre = { x: 800, y: 0 };
    const hero = heros({ x: 805, y: 0, ordre: { posture: "temporiser", ancre } });
    expect(piloter(hero, contexte(null)).direction).toEqual({ x: 0, y: 0 });
  });

  it("le poste de formation prime sur l'ancre", () => {
    const hero = heros({
      x: 0,
      y: 0,
      ordre: { posture: "temporiser", ancre: { x: -800, y: 0 } },
      poste: { x: 800, y: 0 },
    });
    expect(piloter(hero, contexte(null)).direction.x).toBeGreaterThan(0.9);
  });

  /**
   * La laisse se mesure depuis l'ancre, pas depuis la cite : un heros envoye
   * tenir un carrefour doit y rester, pas repartir vers le centre de la carte.
   */
  it("mesure sa laisse depuis son ancre", () => {
    const ancre = { x: 1000, y: 0 };
    const loin = { x: 1000 + LAISSE + 80, y: 0 };
    const hero = heros({ x: 1000, y: 0, ordre: { posture: "temporiser", ancre } });
    // L'ennemi est hors de sa laisse : il ne le poursuit pas...
    expect(piloter(hero, contexte(loin)).direction.x).toBeGreaterThan(0);

    // ...mais s'il s'est laisse entrainer, il revient vers son ancre.
    const entraine = heros({ x: 1000 + LAISSE + 100, y: 0, ordre: { posture: "temporiser", ancre } });
    expect(piloter(entraine, contexte(loin)).direction.x).toBeLessThan(0);
  });

  it("poursuit plus loin en posture agressive", () => {
    const loin = { x: LAISSE + 200, y: 0 };
    const position = { x: LAISSE + 100, y: 0 };
    const prudent = heros({ ...position, ordre: { posture: "temporiser", ancre: null } });
    const fonceur = heros({ ...position, ordre: { posture: "agressif", ancre: null } });

    expect(piloter(prudent, contexte(loin)).direction.x).toBeLessThan(0); // il rentre
    expect(piloter(fonceur, contexte(loin)).direction.x).toBeGreaterThan(0); // il y va
  });

  it("declenche ses capacites plus tot en posture agressive", () => {
    const seuil = REGLAGES.agressif.ennemisPourCapacite;
    const position = { x: 0, y: 0 };
    const cas: [Posture, boolean][] = [
      ["agressif", true],
      ["temporiser", false],
    ];
    for (const [posture, attendu] of cas) {
      const hero = heros({ ...position, ordre: { posture, ancre: null } });
      expect(piloter(hero, contexte({ x: 200, y: 0 }, seuil)).lancerUltime).toBe(attendu);
    }
  });

  it("sans ordre, se comporte exactement comme avant les ordres", () => {
    const cas: Partial<HeroPilote>[] = [
      { x: 0, y: 0 },
      { x: LAISSE + 50, y: 0 },
      { x: 120, y: 120, etat: "cite", ratioPv: 0.9 },
    ];
    for (const partiel of cas) {
      const sans = piloter(heros(partiel), contexte({ x: 300, y: 0 }, 4));
      const avec = piloter(
        heros({ ...partiel, ordre: { posture: "temporiser", ancre: null } }),
        contexte({ x: 300, y: 0 }, 4),
      );
      expect(avec).toEqual(sans);
    }
  });
});

describe("IA — les ultimes", () => {
  it("lance son ultime face a un groupe", () => {
    const hero = heros({ x: 0, y: 0 });
    expect(piloter(hero, contexte({ x: 200, y: 0 }, ENNEMIS_POUR_ULTIME)).lancerUltime).toBe(true);
  });

  it("garde son ultime face a un ennemi isole", () => {
    const hero = heros({ x: 0, y: 0 });
    expect(piloter(hero, contexte({ x: 200, y: 0 }, ENNEMIS_POUR_ULTIME - 1)).lancerUltime).toBe(
      false,
    );
  });
});
