import { describe, expect, it } from "vitest";
import { Noyade, REGLAGES_EAU, profondeurDe } from "./eau";

/**
 * L'eau qui noie (§4.30) : on s'enfonce, une bulle previent, on se noie au bout
 * de trois secondes — et jamais par surprise.
 */
describe("L'eau qui noie", () => {
  it("classe les terrains : sec, haut-fond, mer, abysse", () => {
    expect(profondeurDe("herbe")).toBe("sec");
    expect(profondeurDe("sable")).toBe("sec");
    expect(profondeurDe("haut-fond")).toBe("haut-fond");
    expect(profondeurDe("mer")).toBe("mer");
    expect(profondeurDe("abysse")).toBe("abysse");
  });

  it("ralentit et enfonce d'autant plus que c'est profond", () => {
    expect(REGLAGES_EAU.vitesse["haut-fond"]).toBeLessThan(REGLAGES_EAU.vitesse.sec);
    expect(REGLAGES_EAU.vitesse.mer).toBeLessThan(REGLAGES_EAU.vitesse["haut-fond"]);
    expect(REGLAGES_EAU.enfoncement.mer).toBeGreaterThan(REGLAGES_EAU.enfoncement["haut-fond"]);
    expect(REGLAGES_EAU.enfoncement.sec).toBe(0);
  });

  it("ne noie jamais sur le haut-fond ni au sec", () => {
    const noyade = new Noyade();
    for (let t = 0; t < 10_000; t += 100) expect(noyade.avancer(100, "haut-fond")).toBeNull();
    for (let t = 0; t < 10_000; t += 100) expect(noyade.avancer(100, "sec")).toBeNull();
  });

  it("previent en entrant, insiste a deux secondes, noie a trois", () => {
    const noyade = new Noyade();
    expect(noyade.avancer(16, "mer")).toBe("coule");
    const bulles: string[] = [];
    let t = 16;
    while (t < REGLAGES_EAU.noyade + 100) {
      const e = noyade.avancer(16, "mer");
      if (e) bulles.push(e);
      if (e === "noye") break;
      t += 16;
    }
    expect(bulles).toEqual(["se-noie", "noye"]);
    // Et l'horloge est repartie de zero : on ne meurt pas deux fois.
    expect(noyade.part).toBe(0);
  });

  it("ressortir avant remet tout a zero — jamais une mort surprise", () => {
    const noyade = new Noyade();
    noyade.avancer(16, "mer");
    noyade.avancer(2_500, "mer");
    expect(noyade.part).toBeGreaterThan(0.8);
    expect(noyade.avancer(16, "haut-fond")).toBeNull();
    expect(noyade.part).toBe(0);
    // On y retourne : la bulle previent a nouveau, et il faut de nouveau trois secondes.
    expect(noyade.avancer(16, "mer")).toBe("coule");
    expect(noyade.avancer(2_000, "mer")).toBe("se-noie");
    expect(noyade.avancer(900, "mer")).toBeNull();
    expect(noyade.avancer(100, "mer")).toBe("noye");
  });
});
