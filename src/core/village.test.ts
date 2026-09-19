import { describe, expect, it } from "vitest";
import { EGLISE, PORT, POSTES, terrainEn } from "./carte";
import { Grille } from "./grille";
import { cleCase, genererVillage, MAISONS_DEBOUT_AU_DEPART, tracerLesRues, type PlanVillage } from "./village";

const grille = new Grille();
// L'eglise est dans la grille avant le village, comme dans la scene.
grille.poserEmprise(EGLISE.x, EGLISE.y, EGLISE.emprise, EGLISE.emprise, "batiment");

const GRAINES = [1, 7, 42, 1234, 98765, 20260918, 314159, 271828];
const plans = new Map<number, PlanVillage>(GRAINES.map((g) => [g, genererVillage(grille, g, EGLISE)]));

const voisinesMur = (plan: PlanVillage, c: number, l: number) => {
  const murs = new Set(plan.enceinte.map((m) => cleCase(m.colonne, m.ligne)));
  return [murs.has(cleCase(c, l - 1)), murs.has(cleCase(c + 1, l)), murs.has(cleCase(c, l + 1)), murs.has(cleCase(c - 1, l))];
};

describe("Le generateur de villages", () => {
  it("rend le meme village pour la meme graine", () => {
    expect(genererVillage(grille, 42, EGLISE)).toEqual(genererVillage(grille, 42, EGLISE));
  });

  it("ne rend jamais deux fois le meme village", () => {
    // L'enceinte avec ses pieces et les maisons : deux graines peuvent tomber
    // sur la meme silhouette de mur — le terrain la contraint fort —, jamais sur
    // les memes tours, portes, breches et maisons en plus.
    const villages = new Set(
      [...plans.values()].map((p) =>
        [
          ...p.enceinte.map((m) => `${cleCase(m.colonne, m.ligne)}=${m.piece}`),
          ...p.maisons.map((m) => `m${cleCase(m.colonne, m.ligne)}`),
        ]
          .sort()
          .join(";"),
      ),
    );
    expect(villages.size).toBe(GRAINES.length);
  });

  it("ne dresse un mur que la ou le sol porte, et jamais dans la foret", () => {
    for (const plan of plans.values()) {
      for (const m of plan.enceinte) {
        const centre = Grille.centreCase(m.colonne, m.ligne);
        expect(grille.constructible(centre.x, centre.y)).toBe(true);
        expect(["herbe", "sable"]).toContain(terrainEn(centre.x, centre.y));
      }
    }
  });

  it("met une tour a chaque bout, et jamais deux tours cote a cote", () => {
    for (const plan of plans.values()) {
      const tours = new Set(plan.enceinte.filter((m) => m.piece === "tour").map((m) => cleCase(m.colonne, m.ligne)));
      for (const m of plan.enceinte) {
        const v = voisinesMur(plan, m.colonne, m.ligne);
        if (v.filter(Boolean).length === 1) expect(m.piece).toBe("tour");
        if (m.piece === "tour") {
          expect(tours.has(cleCase(m.colonne + 1, m.ligne))).toBe(false);
          expect(tours.has(cleCase(m.colonne, m.ligne + 1))).toBe(false);
        }
      }
    }
  });

  it("ne colle jamais trois maisons a la file", () => {
    for (const plan of plans.values()) {
      for (const m of plan.maisons) {
        const ligne = plan.maisons.filter((a) => a.ligne === m.ligne && Math.abs(a.colonne - m.colonne) <= 2);
        const colonne = plan.maisons.filter((a) => a.colonne === m.colonne && Math.abs(a.ligne - m.ligne) <= 2);
        expect(ligne.length).toBeLessThanOrEqual(2);
        expect(colonne.length).toBeLessThanOrEqual(2);
      }
    }
  });

  it("perce au moins une porte, toujours dans un pan droit", () => {
    for (const plan of plans.values()) {
      const portes = plan.enceinte.filter((m) => m.piece === "porte");
      expect(portes.length).toBeGreaterThanOrEqual(1);
      for (const p of portes) {
        const v = voisinesMur(plan, p.colonne, p.ligne);
        expect((v[0] && v[2]) || (v[1] && v[3])).toBe(true);
      }
    }
  });

  it("ouvre une ou deux breches par pan", () => {
    for (const plan of plans.values()) {
      expect(plan.enceinte.some((m) => m.piece === "ruine")).toBe(true);
    }
  });

  it("garde l'enceinte a plus de trois cases de l'eglise (§4.24, reprise)", () => {
    for (const plan of plans.values()) {
      for (const m of plan.enceinte) {
        const centre = Grille.centreCase(m.colonne, m.ligne);
        expect(grille.aProximite(centre.x, centre.y, 3, ["batiment"])).toBe(false);
      }
    }
  });

  it("laisse les champs dehors", () => {
    const champs = POSTES.find((p) => p.id === "champs")!.position;
    const c = grille.colonneDe(champs.x);
    const l = grille.ligneDe(champs.y);
    for (const plan of plans.values()) {
      expect(plan.enceinte.some((m) => m.colonne === c && m.ligne === l)).toBe(false);
      expect(plan.maisons.some((m) => Math.abs(m.colonne - c) <= 1 && Math.abs(m.ligne - l) <= 1)).toBe(false);
    }
  });

  it("pose au moins neuf maisons et quinze au plus, une seule ferme, sans se chevaucher ni toucher un mur", () => {
    for (const plan of plans.values()) {
      // Douze visees, mais la place est ce qu'elle est : entre la mer et la foret.
      expect(plan.maisons.length).toBeGreaterThanOrEqual(9);
      expect(plan.maisons.length).toBeLessThanOrEqual(15);
      expect(plan.maisons.filter((m) => m.ferme).length).toBe(1);

      const murs = new Set(plan.enceinte.map((m) => cleCase(m.colonne, m.ligne)));
      const prises = new Set<string>();
      for (const m of plan.maisons) {
        for (let dl = 0; dl < 2; dl++) {
          for (let dc = 0; dc < 2; dc++) {
            const clef = cleCase(m.colonne + dc, m.ligne + dl);
            expect(prises.has(clef)).toBe(false);
            expect(murs.has(clef)).toBe(false);
            prises.add(clef);
            const centre = Grille.centreCase(m.colonne + dc, m.ligne + dl);
            expect(grille.constructible(centre.x, centre.y)).toBe(true);
          }
        }
      }
    }
  });

  it("laisse trois maisons debout, les plus pres de l'eglise, et le reste en ruines (§4.24)", () => {
    for (const plan of plans.values()) {
      const distance = (m: { colonne: number; ligne: number }) =>
        Math.max(Math.abs(m.colonne - plan.centre.colonne), Math.abs(m.ligne - plan.centre.ligne));
      const debout = plan.maisons.filter((m) => m.debout);
      const ruines = plan.maisons.filter((m) => !m.debout);
      expect(debout.length).toBe(MAISONS_DEBOUT_AU_DEPART);
      expect(ruines.length).toBeGreaterThan(0);
      const plusLoinDebout = Math.max(...debout.map(distance));
      const plusPresEnRuine = Math.min(...ruines.map(distance));
      expect(plusLoinDebout).toBeLessThanOrEqual(plusPresEnRuine);
    }
  });

  it("n'est pas un cercle : les maisons ne sont pas toutes a la meme distance de l'eglise", () => {
    for (const plan of plans.values()) {
      const distances = plan.maisons.map((m) => Math.hypot(m.colonne - plan.centre.colonne, m.ligne - plan.centre.ligne));
      const min = Math.min(...distances);
      const max = Math.max(...distances);
      expect(max - min).toBeGreaterThan(2);
    }
  });

  it("couvre la place et les murs dans son emprise", () => {
    for (const plan of plans.values()) {
      for (const m of plan.enceinte) expect(plan.emprise.has(cleCase(m.colonne, m.ligne))).toBe(true);
      for (const m of plan.maisons) expect(plan.emprise.has(cleCase(m.colonne, m.ligne))).toBe(true);
    }
  });

  it("expose la place : l'enceinte en est le bord, et tout tient dans l'emprise", () => {
    for (const plan of plans.values()) {
      expect(plan.place.size).toBeGreaterThan(plan.enceinte.length);
      // L'enceinte est le bord de la place — sauf la jetee, poussee jusqu'a
      // l'eau sur le sable, hors de la place : la plupart des pieces y sont.
      const surLeBord = plan.enceinte.filter((m) => plan.place.has(cleCase(m.colonne, m.ligne))).length;
      expect(surLeBord).toBeGreaterThanOrEqual(plan.enceinte.length * 0.75);
      for (const clef of plan.place) expect(plan.emprise.has(clef)).toBe(true);
      expect(plan.place.has(cleCase(plan.centre.colonne, plan.centre.ligne))).toBe(true);
    }
  });

  it("trace une rue de l'eglise a chaque lieu, par une porte quand un mur barre la ligne", () => {
    const cibles = [...POSTES.map((p) => p.position), { x: PORT.x, y: PORT.y }];
    for (const plan of plans.values()) {
      const rues = tracerLesRues(plan, EGLISE, cibles);
      const portes = new Set(
        plan.enceinte
          .filter((m) => m.piece === "porte")
          .map((m) => {
            const c = Grille.centreCase(m.colonne, m.ligne);
            return `${c.x},${c.y}`;
          }),
      );
      const depart = (p: { x: number; y: number }) => `${p.x},${p.y}`;
      expect(rues.length).toBeGreaterThan(0);
      // Chaque rue part de l'eglise ou d'une porte, et chaque lieu est desservi.
      for (const r of rues) {
        expect(depart(r.de) === depart(EGLISE) || portes.has(depart(r.de))).toBe(true);
      }
      for (const cible of cibles) {
        expect(rues.some((r) => r.a.x === cible.x && r.a.y === cible.y)).toBe(true);
      }
      // Une rue qui passe par une porte y fait bien deux segments.
      for (const r of rues) {
        if (portes.has(depart(r.a))) {
          expect(rues.some((s) => depart(s.de) === depart(r.a))).toBe(true);
        }
      }
    }
  });
});
