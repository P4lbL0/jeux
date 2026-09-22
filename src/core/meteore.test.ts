import { describe, expect, it } from "vitest";
import { Meteore, REGLAGES_METEORE, pointDeChute } from "./meteore";
import { Rng } from "./rng";

/** Un tirage impose, comme celui du ciel : 0 fait tout arriver, 1 rien. */
class RngFixe extends Rng {
  constructor(private readonly valeur: number) {
    super(0);
  }

  override next(): number {
    return this.valeur;
  }
}

const CENTRE = { x: 1000, y: 1000 };
const tombe = () => new RngFixe(0);
const jamais = () => new RngFixe(0.99);

/** Un ciel qui vient d'annoncer un meteore. */
function annonce(maintenant = 0): Meteore {
  const ciel = new Meteore();
  ciel.guetterLaNuit(CENTRE, maintenant, tombe());
  return ciel;
}

describe("Le meteore — quand il tombe", () => {
  it("dort au depart, sans cicatrice", () => {
    const ciel = new Meteore();
    expect(ciel.phase).toBe("dort");
    expect(ciel.crateres).toHaveLength(0);
    expect(ciel.gisement).toBeNull();
  });

  it("ne tombe pas la plupart des nuits", () => {
    const ciel = new Meteore();
    expect(ciel.guetterLaNuit(CENTRE, 0, jamais())).toBeNull();
    expect(ciel.phase).toBe("dort");
  });

  it("tombe environ une nuit sur vingt", () => {
    const rng = new Rng(4242);
    let annonces = 0;
    const nuits = 6_000;
    for (let i = 0; i < nuits; i++) {
      const ciel = new Meteore();
      if (ciel.guetterLaNuit(CENTRE, 0, rng)) annonces++;
    }
    expect(annonces / nuits).toBeCloseTo(REGLAGES_METEORE.chanceParNuit, 2);
  });

  it("n'en annonce jamais deux a la fois", () => {
    const ciel = annonce();
    expect(ciel.guetterLaNuit(CENTRE, 0, tombe())).toBeNull();
  });
});

describe("Le meteore — ou il tombe", () => {
  it("tire dans l'anneau, jamais sur la place", () => {
    const rng = new Rng(7);
    for (let i = 0; i < 500; i++) {
      const p = pointDeChute(CENTRE, rng);
      const d = Math.hypot(p.x - CENTRE.x, p.y - CENTRE.y);
      expect(d).toBeGreaterThanOrEqual(REGLAGES_METEORE.anneau.min - 0.001);
      expect(d).toBeLessThanOrEqual(REGLAGES_METEORE.anneau.max + 0.001);
    }
  });

  it("repartit les points sur l'aire, pas sur le rayon", () => {
    // Un tirage uniforme du rayon entasserait plus de la moitie des points dans
    // la moitie interieure de l'anneau. Sur l'aire, il y en a moins.
    const rng = new Rng(19);
    const { min, max } = REGLAGES_METEORE.anneau;
    const milieu = (min + max) / 2;
    let dedans = 0;
    const tirages = 4_000;
    for (let i = 0; i < tirages; i++) {
      const p = pointDeChute(CENTRE, rng);
      if (Math.hypot(p.x - CENTRE.x, p.y - CENTRE.y) < milieu) dedans++;
    }
    expect(dedans / tirages).toBeLessThan(0.5);
  });
});

describe("Le meteore — l'annonce et l'impact", () => {
  it("ne touche pas avant son heure, et ne touche qu'une fois", () => {
    const ciel = annonce(1_000);
    expect(ciel.avancer(1_000 + REGLAGES_METEORE.annonce - 1)).toBeNull();
    expect(ciel.avancer(1_000 + REGLAGES_METEORE.annonce)).not.toBeNull();
    expect(ciel.avancer(999_999)).toBeNull();
  });

  it("laisse une cicatrice et du fer du ciel", () => {
    const ciel = annonce();
    const point = ciel.avancer(REGLAGES_METEORE.annonce)!;
    expect(ciel.crateres).toHaveLength(1);
    expect(ciel.crateres[0]).toEqual({ x: point.x, y: point.y, rayon: REGLAGES_METEORE.rayon });
    expect(ciel.gisement?.restant).toBe(REGLAGES_METEORE.ferDuCiel);
    expect(ciel.phase).toBe("dort");
  });

  it("fait grandir l'ombre de zero a un pendant l'annonce", () => {
    const ciel = annonce(2_000);
    expect(ciel.partDeLAnnonce(2_000)).toBe(0);
    expect(ciel.partDeLAnnonce(2_000 + REGLAGES_METEORE.annonce / 2)).toBeCloseTo(0.5, 2);
    expect(ciel.partDeLAnnonce(2_000 + REGLAGES_METEORE.annonce)).toBe(1);
  });

  it("ne montre aucune ombre quand rien ne tombe", () => {
    expect(new Meteore().partDeLAnnonce(5_000)).toBe(0);
  });
});

describe("Le meteore — le fer du ciel", () => {
  it("ne rend jamais plus qu'il n'en reste, et s'epuise", () => {
    const ciel = annonce();
    ciel.avancer(REGLAGES_METEORE.annonce);
    expect(ciel.extraire(50)).toBe(50);
    expect(ciel.extraire(1_000)).toBe(REGLAGES_METEORE.ferDuCiel - 50);
    expect(ciel.gisement).toBeNull();
    expect(ciel.extraire(10)).toBe(0);
  });
});

describe("Le meteore — la sauvegarde", () => {
  it("garde les cicatrices et le fer, jamais ce qui etait en vol", () => {
    const ciel = annonce();
    ciel.avancer(REGLAGES_METEORE.annonce);
    ciel.extraire(20);
    const etat = ciel.instantane;

    const repris = new Meteore();
    repris.guetterLaNuit(CENTRE, 0, tombe());
    repris.reprendre(etat);
    expect(repris.phase).toBe("dort");
    expect(repris.point).toBeNull();
    expect(repris.crateres).toHaveLength(1);
    expect(repris.gisement?.restant).toBe(REGLAGES_METEORE.ferDuCiel - 20);
  });

  it("reprend une partie d'avant les meteores sans rien inventer", () => {
    const ciel = annonce();
    ciel.reprendre(undefined);
    expect(ciel.crateres).toHaveLength(0);
    expect(ciel.gisement).toBeNull();
    expect(ciel.phase).toBe("dort");
  });
});
