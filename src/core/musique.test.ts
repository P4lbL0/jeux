import { describe, expect, it } from "vitest";
import { ChoixDeMusique, REGLAGES_MUSIQUE } from "./musique";

/**
 * La regle du §4.10, tranchee le 19 septembre 2026 : la guerre toute la nuit et
 * des qu'un heros se bat, le calme sinon — et un combat fini ne rend pas le
 * calme tout de suite.
 */
describe("la musique de la partie", () => {
  it("joue le calme le jour, tant que personne ne se bat", () => {
    const choix = new ChoixDeMusique();
    expect(choix.morceau(false)).toBe("calme");
    choix.avancer(60_000);
    expect(choix.morceau(false)).toBe("calme");
  });

  it("joue la guerre toute la nuit, meme sans un coup", () => {
    const choix = new ChoixDeMusique();
    expect(choix.morceau(true)).toBe("guerre");
    choix.avancer(4 * 60_000);
    expect(choix.morceau(true)).toBe("guerre");
  });

  it("passe a la guerre au premier coup, et la tient apres le dernier", () => {
    const choix = new ChoixDeMusique();
    choix.avancer(10_000);
    choix.combat();
    expect(choix.morceau(false)).toBe("guerre");
    choix.avancer(REGLAGES_MUSIQUE.maintien - 1);
    expect(choix.morceau(false)).toBe("guerre");
    choix.avancer(1);
    expect(choix.morceau(false)).toBe("calme");
  });

  it("un coup au milieu du maintien le prolonge", () => {
    const choix = new ChoixDeMusique();
    choix.combat();
    choix.avancer(REGLAGES_MUSIQUE.maintien - 1_000);
    choix.combat();
    choix.avancer(REGLAGES_MUSIQUE.maintien - 1);
    expect(choix.morceau(false)).toBe("guerre");
  });

  it("un combat a la fin de la nuit tient encore apres l'aube", () => {
    const choix = new ChoixDeMusique();
    choix.combat();
    expect(choix.morceau(true)).toBe("guerre");
    choix.avancer(REGLAGES_MUSIQUE.maintien / 2);
    expect(choix.morceau(false)).toBe("guerre");
    choix.avancer(REGLAGES_MUSIQUE.maintien);
    expect(choix.morceau(false)).toBe("calme");
  });

  it("une pause ne compte pas : sans avancer, la guerre tient", () => {
    const choix = new ChoixDeMusique();
    choix.combat();
    // Une pause : la scene ne fait pas avancer l'horloge.
    expect(choix.enCombat).toBe(true);
    expect(choix.morceau(false)).toBe("guerre");
  });
});
