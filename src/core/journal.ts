/**
 * Le journal du village (DESIGN.md §4.10).
 *
 * Le jeu ne parle plus qu'a un seul endroit : une boite en bas a droite qui
 * garde les dernieres lignes au lieu de les effacer.
 *
 * Pourquoi ce fichier est pur et sans Phaser : ce qui est interessant ici n'est
 * pas le dessin mais la regle de conservation — combien on garde, ce qui sort,
 * et ce qui fusionne. C'est testable sans navigateur.
 */

/** Six lignes : au-dela ca devient un mur de texte, en deca une mauvaise nuit efface son propre debut. */
export const LIGNES_DU_JOURNAL = 6;

export interface LigneJournal {
  readonly texte: string;
  /** 1 quand elle n'a ete dite qu'une fois. Au-dela, l'affichage montre « x3 ». */
  readonly repetitions: number;
}

export class Journal {
  private readonly lignes: LigneJournal[] = [];
  private compteurVersion = 0;

  constructor(private readonly capacite: number = LIGNES_DU_JOURNAL) {}

  /**
   * Ajoute une ligne. La plus recente est toujours en derniere position.
   *
   * Deux gestes identiques d'affilee — « Impossible de poser ici » repete a
   * chaque clic — remplissent la boite a eux seuls et poussent dehors ce qui
   * comptait vraiment. On les compte au lieu de les empiler.
   */
  ajouter(texte: string): void {
    const propre = texte.trim();
    if (propre.length === 0) return;

    const derniere = this.lignes[this.lignes.length - 1];
    if (derniere && derniere.texte === propre) {
      this.lignes[this.lignes.length - 1] = {
        texte: propre,
        repetitions: derniere.repetitions + 1,
      };
      this.compteurVersion += 1;
      return;
    }

    this.lignes.push({ texte: propre, repetitions: 1 });
    while (this.lignes.length > this.capacite) this.lignes.shift();
    this.compteurVersion += 1;
  }

  /** De la plus ancienne a la plus recente. */
  get contenu(): readonly LigneJournal[] {
    return this.lignes;
  }

  /**
   * Change a chaque ecriture. L'affichage s'en sert pour ne rien recalculer
   * quand rien n'a bouge : le §4.17 refuse le travail par image qui pourrait
   * se faire une fois.
   */
  get version(): number {
    return this.compteurVersion;
  }

  vider(): void {
    this.lignes.length = 0;
    this.compteurVersion += 1;
  }
}
