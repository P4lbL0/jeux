import type { Terrain } from "./carte";

/**
 * L'eau qui noie (DESIGN.md §4.30, tranche le 9 septembre 2026).
 *
 * Personne ne nage. Le heros incarne peut entrer dans l'eau — c'est le seul —,
 * et **on s'enfonce** : la vitesse tombe, le corps disparait sous la surface.
 * Sur le haut-fond, rien de plus. En mer, **une bulle previent**, une seconde
 * bulle insiste, et au bout de trois secondes **on se noie**. Jamais une mort
 * surprise : une perte se decide (§4.18). Ressortir avant remet tout a zero.
 *
 * Ce module ne connait ni Phaser ni le heros : il classe un terrain et tient
 * une horloge que la scene fait avancer hors pause.
 */

export type Profondeur = "sec" | "haut-fond" | "mer" | "abysse";

export const REGLAGES_EAU = {
  /** Ce qu'il reste de la vitesse, par profondeur. L'abysse n'est pas praticable : on y est rejete. */
  vitesse: { sec: 1, "haut-fond": 0.6, mer: 0.35, abysse: 0 } as Readonly<Record<Profondeur, number>>,
  /** La part de la hauteur du corps que l'eau cache, par le bas. */
  enfoncement: { sec: 0, "haut-fond": 0.14, mer: 0.4, abysse: 0.4 } as Readonly<Record<Profondeur, number>>,
  /** La seconde bulle, qui insiste, en millisecondes de mer. */
  avertissement: 2_000,
  /** La noyade, en millisecondes de mer d'affilee. */
  noyade: 3_000,
};

export function profondeurDe(terrain: Terrain): Profondeur {
  if (terrain === "abysse") return "abysse";
  if (terrain === "mer") return "mer";
  if (terrain === "haut-fond") return "haut-fond";
  return "sec";
}

/** Ce que l'eau dit au heros : il coule, il se noie, il s'est noye. */
export type EvenementDEau = "coule" | "se-noie" | "noye";

export class Noyade {
  private sousLEau = 0;
  private aInsiste = false;

  /**
   * Le temps passe, a cette profondeur.
   *
   * @returns la bulle du moment, ou null. « coule » a la premiere image en mer,
   *          « se-noie » a `avertissement`, « noye » a `noyade` — et l'horloge
   *          repart de zero, comme quand on ressort.
   */
  avancer(delta: number, profondeur: Profondeur): EvenementDEau | null {
    if (profondeur !== "mer" && profondeur !== "abysse") {
      this.reinitialiser();
      return null;
    }
    const avant = this.sousLEau;
    this.sousLEau += delta;
    if (avant === 0) return "coule";
    if (this.sousLEau >= REGLAGES_EAU.noyade) {
      this.reinitialiser();
      return "noye";
    }
    if (!this.aInsiste && this.sousLEau >= REGLAGES_EAU.avertissement) {
      this.aInsiste = true;
      return "se-noie";
    }
    return null;
  }

  /** L'avancement vers la noyade, de 0 (au sec ou a peine entre) a 1. */
  get part(): number {
    return Math.min(1, this.sousLEau / REGLAGES_EAU.noyade);
  }

  reinitialiser(): void {
    this.sousLEau = 0;
    this.aInsiste = false;
  }
}
