/**
 * Generateur aleatoire *seede*.
 *
 * Pourquoi ne pas utiliser Math.random() : avec une graine, une meme partie
 * rejoue exactement pareil. C'est ce qui permet de reproduire un bug ("la vague
 * 47 avec la graine 12345 me tue toujours") au lieu de le chercher au hasard.
 * Sur un roguelike, c'est indispensable.
 */
export class Rng {
  private etat: number;

  constructor(graine: number) {
    this.etat = graine >>> 0;
  }

  /** Flottant dans [0, 1) */
  next(): number {
    // mulberry32 : court, rapide, de qualite suffisante pour un jeu.
    this.etat = (this.etat + 0x6d2b79f5) >>> 0;
    let t = this.etat;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Flottant dans [min, max) */
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** Entier dans [min, max] inclus */
  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }

  /** Un element au hasard */
  pick<T>(tableau: readonly T[]): T {
    const valeur = tableau[this.int(0, tableau.length - 1)];
    if (valeur === undefined) throw new Error("Rng.pick sur un tableau vide");
    return valeur;
  }

  /** Vrai avec la probabilite donnee (0 a 1) */
  chance(probabilite: number): boolean {
    return this.next() < probabilite;
  }
}
