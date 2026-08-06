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
