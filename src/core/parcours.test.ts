import { describe, expect, it } from "vitest";
import { chargerLaGraine, chargerLeMonde, EGLISE } from "./carte";
import { CASE, Grille, type Case } from "./grille";
import { genererMonde, mondeClassique } from "./monde";
import { Parcours } from "./parcours";
import { centreDeCase } from "./portes";

/**
 * Le parcours des monstres (§4.6, §4.29) : un champ de directions vers
 * l'eglise, qui contourne l'eau, la roche et les douves en eau — et qui
 * traverse les murs, puisqu'un monstre les frappe.
 */

/** Ce qu'un monstre traverse : la terre ferme, sauf une douve en eau. */
const passe = (c: Case) =>
  (c.terrain === "sable" || c.terrain === "herbe" || c.terrain === "sous-bois") && c.occupation !== "douve-eau";

/** Suit le champ depuis un point, pas a pas, et rend la distance a l'eglise a l'arrivee. */
function suivre(parcours: Parcours, x: number, y: number, pasMax = 400): { x: number; y: number; pas: number } {
  let px = x;
  let py = y;
  let pas = 0;
  for (; pas < pasMax; pas++) {
    const d = parcours.direction(px, py);
    if (!d) break;
    px += d.x * 8;
    py += d.y * 8;
    if (Math.hypot(px - EGLISE.x, py - EGLISE.y) < CASE) break;
  }
  return { x: px, y: py, pas };
}

describe("Le parcours — sur le monde classique", () => {
  chargerLeMonde(mondeClassique());
  const grille = new Grille();
  const parcours = new Parcours(grille);
  parcours.recalculer(EGLISE, passe);

  it("atteint l'eglise depuis les deux fronts, et pas depuis la mer profonde", () => {
    expect(parcours.atteignable(1000, 40)).toBe(true);
    expect(parcours.atteignable(1960, 600)).toBe(true);
    expect(parcours.atteignable(40, 600)).toBe(false);
    expect(parcours.pasDepuis(1960, 600)).toBeGreaterThan(20);
  });

  it("mene un monstre du bord jusqu'a l'eglise en suivant les directions", () => {
    const arrivee = suivre(parcours, 1900, 300);
    expect(Math.hypot(arrivee.x - EGLISE.x, arrivee.y - EGLISE.y)).toBeLessThan(CASE * 1.5);
  });

  it("fait ressortir de l'eau un monstre qu'on y aurait pousse", () => {
    // Un point de mer, pas d'abysse : le champ y donne une direction vers la terre.
    const d = parcours.direction(200, 600);
    expect(d).not.toBeNull();
    expect(d!.x).toBeGreaterThan(0);
  });

  it("dit si la ligne droite est libre, et ce qu'un lac de douves lui fait", () => {
    expect(parcours.ligneLibre({ x: 1500, y: 800 }, EGLISE, passe)).toBe(true);
    // Une rangee de douves en eau en travers : la ligne n'est plus libre.
    for (let c = 10; c < 40; c++) grille.poser(c * CASE + 16, 900, "douve-eau");
    expect(parcours.ligneLibre({ x: 900, y: 400 }, EGLISE, passe)).toBe(false);
    for (let c = 10; c < 40; c++) grille.liberer(c * CASE + 16, 900);
  });
});

describe("Le parcours — une douve en eau autour du village", () => {
  chargerLeMonde(mondeClassique());

  /** Un anneau de douves en eau de rayon `r` cases autour de l'eglise, avec une breche (le pont-levis) au nord. */
  function anneau(grille: Grille, r: number, breche: boolean): { pont: { x: number; y: number } } {
    const c0 = grille.colonneDe(EGLISE.x);
    const l0 = grille.ligneDe(EGLISE.y);
    for (let dl = -r; dl <= r; dl++) {
      for (let dc = -r; dc <= r; dc++) {
        if (Math.max(Math.abs(dc), Math.abs(dl)) !== r) continue;
        if (breche && dc === 0 && dl === -r) continue;
        const p = centreDeCase(c0 + dc, l0 + dl);
        const cas = grille.caseEn(p.x, p.y);
        if (cas && (cas.terrain === "herbe" || cas.terrain === "sable" || cas.terrain === "sous-bois")) grille.poser(p.x, p.y, "douve-eau");
      }
    }
    return { pont: centreDeCase(c0, l0 - r) };
  }

  it("mene les monstres au pont-levis quand c'est le seul passage", () => {
    const grille = new Grille();
    const { pont } = anneau(grille, 5, true);
    const parcours = new Parcours(grille);
    parcours.recalculer(EGLISE, passe);
    // Un monstre a l'est : la ligne droite est coupee, le champ le mene au pont.
    expect(parcours.ligneLibre({ x: EGLISE.x + 400, y: EGLISE.y }, EGLISE, passe)).toBe(false);
    let px = EGLISE.x + 400;
    let py = EGLISE.y;
    let passeParLePont = false;
    for (let i = 0; i < 400; i++) {
      const d = parcours.direction(px, py);
      if (!d) break;
      px += d.x * 8;
      py += d.y * 8;
      if (Math.abs(px - pont.x) < CASE / 2 && Math.abs(py - pont.y) < CASE / 2) passeParLePont = true;
      if (Math.hypot(px - EGLISE.x, py - EGLISE.y) < CASE) break;
    }
    expect(passeParLePont).toBe(true);
    expect(Math.hypot(px - EGLISE.x, py - EGLISE.y)).toBeLessThan(CASE * 1.5);
  });

  it("ne trouve aucun chemin si la douve est fermee de partout — et le monstre sort de l'eau quand meme", () => {
    const grille = new Grille();
    anneau(grille, 5, false);
    const parcours = new Parcours(grille);
    parcours.recalculer(EGLISE, passe);
    expect(parcours.atteignable(EGLISE.x + 400, EGLISE.y)).toBe(false);
    // Dedans, on atteint l'eglise ; dehors, non. Et la douve elle-meme mene dedans.
    expect(parcours.atteignable(EGLISE.x + 64, EGLISE.y)).toBe(true);
    expect(parcours.direction(EGLISE.x + 5 * CASE, EGLISE.y)).not.toBeNull();
  });
});

describe("Le parcours — un lac au milieu d'un monde tire", () => {
  it("contourne le lac et arrive a l'eglise", () => {
    // Une graine avec un lac : le test le cherche, pour ne pas dependre d'un tirage precis.
    let monde = genererMonde(2);
    for (let g = 2; g < 60 && monde.lacs.length === 0; g++) monde = genererMonde(g);
    expect(monde.lacs.length).toBeGreaterThan(0);
    chargerLeMonde(monde);
    const grille = new Grille();
    const parcours = new Parcours(grille);
    parcours.recalculer(EGLISE, passe);
    // Depuis chaque front, on arrive.
    for (const f of monde.fronts) {
      const p = monde.bords[f][Math.floor(monde.bords[f].length / 2)]!;
      const arrivee = suivre(parcours, p.x, p.y, 800);
      expect(Math.hypot(arrivee.x - EGLISE.x, arrivee.y - EGLISE.y), `${f}`).toBeLessThan(CASE * 1.5);
    }
    // Et jamais par l'eau : chaque pas du chemin est sur la terre.
    const p = monde.bords[monde.fronts[0]!][0]!;
    let px = p.x;
    let py = p.y;
    for (let i = 0; i < 800; i++) {
      const d = parcours.direction(px, py);
      if (!d) break;
      px += d.x * 8;
      py += d.y * 8;
      const c = grille.caseEn(px, py)!;
      expect(["sable", "herbe", "sous-bois"], `pas ${i}`).toContain(c.terrain);
      if (Math.hypot(px - EGLISE.x, py - EGLISE.y) < CASE) break;
    }
    chargerLaGraine(0);
  });
});
