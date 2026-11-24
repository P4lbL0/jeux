import { describe, expect, it } from "vitest";
import { MONDE, profondeurDeRoche } from "../../core/carte";
import { peindreUnMorceau } from "./carte";
import { HAUTEUR_MAX, MassifDUnMorceau, hauteurDeRoche, massifEn } from "./massif";
import { releverLeRelief } from "./relief";

/** Un point du monde classique a cette profondeur dans la roche (la chaine du sud). */
function pointDansLaRoche(profondeur: number): { x: number; y: number } {
  for (let y = 0; y < MONDE.hauteur; y += 4) {
    for (let x = 200; x < MONDE.largeur - 200; x += 50) {
      if (Math.abs(profondeurDeRoche(x, y) - profondeur) < 3) return { x, y };
    }
  }
  throw new Error(`pas de roche a ${profondeur} px de profondeur dans le monde classique`);
}

describe("Le massif — la roche en volume (§4.30)", () => {
  it("ne monte qu'a 24 px dans la roche, et jamais plus haut que son plafond", () => {
    expect(hauteurDeRoche(-50, 100, 100)).toBe(0);
    expect(hauteurDeRoche(24, 100, 100)).toBe(0);
    let monte = 0;
    for (let i = 0; i < 400; i += 1) {
      const h = hauteurDeRoche(30 + i * 3, i * 37, i * 11);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThanOrEqual(HAUTEUR_MAX);
      if (h > 0) monte += 1;
    }
    expect(monte).toBe(400);
  });

  it("ne se dessine jamais hors de la roche : la montagne ne cache pas le terrain ou l'on marche", () => {
    const { x, y } = pointDansLaRoche(40);
    const x0 = x - 160;
    const y0 = y - 160;
    const m = MassifDUnMorceau.preparer(x0, y0, 320, 320);
    expect(m).not.toBeNull();
    let couverts = 0;
    for (let j = 0; j < 320; j += 1) {
      m!.rangee(y0 + j);
      for (let i = 0; i < 320; i += 1) {
        if (!m!.couvert[i]) continue;
        couverts += 1;
        expect(profondeurDeRoche(x0 + i, y0 + j), `${x0 + i},${y0 + j}`).toBeGreaterThan(0);
      }
    }
    expect(couverts).toBeGreaterThan(5000);
  });

  it("ne prepare rien loin de toute roche", () => {
    let loin: { x: number; y: number } | null = null;
    for (let y = 0; y < MONDE.hauteur && !loin; y += 40) {
      for (let x = 0; x < MONDE.largeur && !loin; x += 40) {
        if (profondeurDeRoche(x, y) < -500) loin = { x, y };
      }
    }
    expect(loin).not.toBeNull();
    expect(MassifDUnMorceau.preparer(loin!.x, loin!.y, 64, 64)).toBeNull();
  });

  it("dit ou il se dresse : pas de rocher pose sur sa pente", () => {
    const dedans = pointDansLaRoche(120);
    expect(massifEn(dedans.x, dedans.y)).toBe(true);
    const bord = pointDansLaRoche(10);
    expect(hauteurDeRoche(profondeurDeRoche(bord.x, bord.y), bord.x, bord.y)).toBe(0);
  });

  it("peint les memes pixels par morceaux que d'un bloc, en pleine montagne", () => {
    // ⚠️ Le test du 20 septembre (`carte.test.ts`) passe dans une plaine. Le
    // massif lit les rangees du dessus et les facettes des voisins : s'il
    // divergeait d'un pixel d'un morceau a l'autre, chaque couture se verrait.
    const { x, y } = pointDansLaRoche(60);
    const X = x - 128;
    const Y = y - 128;
    const COTE = 128;
    const relief = releverLeRelief(MONDE.largeur, MONDE.hauteur);
    const entier = peindreUnMorceau(X, Y, COTE * 2, COTE * 2, relief);
    let massif = 0;
    for (const v of entier.massif ?? []) massif += v;
    expect(massif).toBeGreaterThan(COTE * COTE);
    for (const [dx, dy] of [
      [0, 0],
      [COTE, 0],
      [0, COTE],
      [COTE, COTE],
    ] as const) {
      const quart = peindreUnMorceau(X + dx, Y + dy, COTE, COTE, relief);
      let ecarts = 0;
      let premier = "";
      for (let j = 0; j < COTE; j += 1) {
        for (let i = 0; i < COTE; i += 1) {
          const a = (j * COTE + i) * 4;
          const b = ((j + dy) * COTE * 2 + i + dx) * 4;
          for (let c = 0; c < 4; c += 1) {
            if (quart.pixels[a + c] === entier.pixels[b + c]) continue;
            ecarts += 1;
            if (!premier) premier = `au pixel ${i},${j} canal ${c} : ${quart.pixels[a + c]} au lieu de ${entier.pixels[b + c]}`;
          }
        }
      }
      expect(ecarts, `morceau ${dx},${dy} — ${premier}`).toBe(0);
    }
  });
});
