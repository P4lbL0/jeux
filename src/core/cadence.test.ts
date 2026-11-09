import { PAS_30, PAS_60, PAS_HORS_FOCUS, PAS_ROBOT, creerCadence, pasVoulu } from "./cadence";

// Images gardées sur 10 s d'un écran à `hz`, avec un léger tremblement des horodatages
// (± 0,3 ms, comme les vrais requestAnimationFrame).
function gardees(hz: number, pas = PAS_60, secondes = 10): number {
  const cadence = creerCadence();
  const intervalle = 1000 / hz;
  let n = 0;
  for (let i = 1; i <= hz * secondes; i++) {
    const t = 1000 + i * intervalle + (i % 3 === 0 ? 0.3 : i % 3 === 1 ? -0.3 : 0);
    if (cadence(t, pas)) n++;
  }
  return n / secondes;
}

describe("La cadence des images (jalon 6.4)", () => {
  it("un écran à 60 Hz ne perd aucune image, même à 59 ou 61 Hz", () => {
    expect(gardees(60)).toBe(60);
    expect(gardees(59)).toBe(59);
    expect(gardees(61)).toBeGreaterThanOrEqual(59);
  });

  it("un écran rapide garde 60 images par seconde en moyenne", () => {
    for (const hz of [75, 120, 144, 165, 240, 360]) {
      const n = gardees(hz);
      expect(n, `${hz} Hz`).toBeGreaterThanOrEqual(58);
      expect(n, `${hz} Hz`).toBeLessThanOrEqual(61);
    }
  });

  it("une machine lente dessine toutes ses images", () => {
    expect(gardees(30)).toBe(30);
    expect(gardees(45)).toBe(45);
  });

  it("30 images par seconde dans un menu, 5 hors du premier plan", () => {
    expect(gardees(240, PAS_30)).toBeCloseTo(30, 0);
    expect(gardees(60, PAS_30)).toBe(30);
    expect(gardees(240, PAS_HORS_FOCUS)).toBeCloseTo(5, 0);
  });

  it("quand la cadence remonte, l'image suivante part sans attendre", () => {
    const cadence = creerCadence();
    expect(cadence(1000, PAS_HORS_FOCUS)).toBe(true);
    // Prochaine image prévue à 1 200 ms ; on revient au premier plan à 1 010 ms.
    expect(cadence(1004, PAS_HORS_FOCUS)).toBe(false);
    expect(cadence(1010, PAS_60)).toBe(true);
    expect(cadence(1014, PAS_60)).toBe(false);
    expect(cadence(1027, PAS_60)).toBe(true);
  });

  it("joue à 60, attend à 30, dort à 5", () => {
    expect(pasVoulu({ auPremierPlan: true, partieQuiTourne: true })).toBe(PAS_60);
    expect(pasVoulu({ auPremierPlan: true, partieQuiTourne: false })).toBe(PAS_30);
    expect(pasVoulu({ auPremierPlan: false, partieQuiTourne: true })).toBe(PAS_HORS_FOCUS);
    expect(pasVoulu({ auPremierPlan: false, partieQuiTourne: false })).toBe(PAS_HORS_FOCUS);
  });

  it("dessine 10 images par seconde quand le robot accélère, focus ou pas", () => {
    expect(pasVoulu({ auPremierPlan: true, partieQuiTourne: true, accelere: true })).toBe(PAS_ROBOT);
    expect(pasVoulu({ auPremierPlan: false, partieQuiTourne: false, accelere: true })).toBe(PAS_ROBOT);
  });
});
