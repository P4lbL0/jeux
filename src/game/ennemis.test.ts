import { describe, expect, it } from "vitest";
import { ARCHETYPES, ARCHETYPE_DEFAUT, archetypeParId, choisirArchetype } from "./ennemis";

/**
 * `ennemis.ts` est une table de donnees et une fonction pure : elle ne touche
 * ni Phaser ni la scene, donc elle se teste comme le reste de `core/`.
 *
 * Ce qui est verifie ici, c'est la promesse de progression : la vague ne peut
 * pas envoyer une brute a la premiere seconde, et le fonceur reste le fond du
 * decor quand tout est ouvert.
 */

/** Tire l'archetype sur toute la plage [0,1), par petits pas. */
function tirages(puissance: number, pas = 0.001): string[] {
  const sortis: string[] = [];
  for (let t = 0; t < 1; t += pas) sortis.push(choisirArchetype(puissance, t).id);
  return sortis;
}

describe("Archetypes de monstres — la table", () => {
  it("a au moins cinq archetypes distincts", () => {
    const ids = new Set(ARCHETYPES.map((a) => a.id));
    expect(ids.size).toBe(ARCHETYPES.length);
    expect(ids.size).toBeGreaterThanOrEqual(5);
  });

  it("propose au moins un monstre a distance et un kamikaze", () => {
    const comportements = new Set(ARCHETYPES.map((a) => a.comportement));
    expect(comportements.has("cracheur")).toBe(true);
    expect(comportements.has("kamikaze")).toBe(true);
  });

  it("donne a chacun un poids et une portee utilisables", () => {
    for (const a of ARCHETYPES) {
      expect(a.poids).toBeGreaterThan(0);
      expect(a.portee).toBeGreaterThan(0);
      expect(a.armement).toBeGreaterThan(0);
      expect(a.echelle).toBeGreaterThan(0);
      // Un multiplicateur nul viderait un monstre de sa substance.
      expect(a.multPv).toBeGreaterThan(0);
      expect(a.multVitesse).toBeGreaterThan(0);
      expect(a.multDegats).toBeGreaterThan(0);
    }
  });

  it("recompense ce qui est plus dur a tuer", () => {
    const fonceur = archetypeParId("fonceur")!;
    const brute = archetypeParId("brute")!;
    expect(brute.multPv).toBeGreaterThan(fonceur.multPv);
    expect(brute.xp).toBeGreaterThan(fonceur.xp);
    // Une brute lente : c'est ce qui la rend evitable malgre sa force.
    expect(brute.multVitesse).toBeLessThan(fonceur.multVitesse);
  });

  it("telegraphe d'autant plus longtemps que le coup fait mal", () => {
    const essaim = archetypeParId("essaim")!;
    const brute = archetypeParId("brute")!;
    expect(brute.armement).toBeGreaterThan(essaim.armement);
    expect(brute.multDegats).toBeGreaterThan(essaim.multDegats);
  });
});

describe("Archetypes de monstres — le tirage", () => {
  it("n'envoie que des fonceurs au tout debut", () => {
    expect(new Set(tirages(0))).toEqual(new Set(["fonceur"]));
  });

  it("ouvre la variete a mesure que la vague durcit", () => {
    const tot = new Set(tirages(1));
    const tard = new Set(tirages(6));
    expect(tard.size).toBeGreaterThan(tot.size);
    expect(tard.size).toBe(ARCHETYPES.length);
  });

  it("ne sort jamais un archetype avant son seuil", () => {
    for (const puissance of [0, 0.5, 1, 2, 3, 5, 10]) {
      for (const id of new Set(tirages(puissance))) {
        expect(archetypeParId(id)!.seuil).toBeLessThanOrEqual(puissance);
      }
    }
  });

  it("garde le fonceur majoritaire, meme tout ouvert", () => {
    const sortis = tirages(10);
    const fonceurs = sortis.filter((id) => id === "fonceur").length;
    for (const autre of new Set(sortis)) {
      if (autre === "fonceur") continue;
      expect(fonceurs).toBeGreaterThan(sortis.filter((id) => id === autre).length);
    }
  });

  it("tient les bornes du tirage", () => {
    // Un aleatoire hors de [0,1) ne doit ni planter ni sortir de la table.
    for (const t of [-1, 0, 0.999_999_9, 1, 42]) {
      expect(ARCHETYPES).toContain(choisirArchetype(10, t));
    }
    expect(choisirArchetype(-5, 0.5)).toBe(ARCHETYPE_DEFAUT);
  });
});
