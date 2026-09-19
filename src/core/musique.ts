/**
 * La musique de la partie : quel morceau doit jouer (DESIGN.md §4.10, « Le son »).
 *
 * Deux morceaux, et une regle tranchee par Angelos le 19 septembre 2026 : la
 * **guerre** toute la nuit, et le jour des qu'un heros se bat ; le **calme** le
 * reste du temps. Et surtout, jamais de bascule brutale : un coup isole ne doit
 * pas faire changer de musique toutes les deux secondes. Une fois appelee par un
 * combat, la guerre **tient** encore `maintien` millisecondes apres le dernier
 * coup ; le changement lui-meme est un fondu enchaine (`fondu`), que la scene
 * fait (`game/musique.ts`).
 *
 * Ce module ne connait ni Phaser ni les fichiers : il tient une horloge et
 * l'instant du dernier coup, et repond a une question. C'est la scene qui fait
 * avancer l'horloge, hors pause seulement : une pause ne compte donc pas dans le
 * maintien, et la guerre ne retombe pas pendant qu'on choisit une competence.
 */

export type Morceau = "calme" | "guerre";

export const REGLAGES_MUSIQUE = {
  /**
   * Apres le dernier coup donne ou recu par un heros, la guerre tient encore ce
   * temps, en millisecondes. Assez pour qu'un combat hache — trois monstres,
   * cinq secondes de course, trois monstres — reste une seule bataille.
   */
  maintien: 15_000,
  /**
   * En combien de secondes chaque morceau monte, et descend. La guerre va vite :
   * elle annonce un danger. Le calme est lent : rien ne presse, et un calme qui
   * part ou revient trop prompt sonnerait comme une coupure. Dans un fondu
   * enchaine, chacun bouge a sa vitesse.
   */
  fondu: { guerre: 3, calme: 6 } as Readonly<Record<Morceau, number>>,
};

export class ChoixDeMusique {
  private horloge = 0;
  private dernierCoup = Number.NEGATIVE_INFINITY;

  /** Le temps passe hors pause, en millisecondes. */
  avancer(delta: number): void {
    this.horloge += delta;
  }

  /** Un heros vient de donner ou de recevoir un coup. */
  combat(): void {
    this.dernierCoup = this.horloge;
  }

  /** Un heros s'est battu il y a moins de `maintien`. */
  get enCombat(): boolean {
    return this.horloge - this.dernierCoup < REGLAGES_MUSIQUE.maintien;
  }

  /** Le morceau qui doit jouer maintenant. */
  morceau(nuit: boolean): Morceau {
    return nuit || this.enCombat ? "guerre" : "calme";
  }
}
