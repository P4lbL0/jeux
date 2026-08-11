/**
 * La discussion du village (DESIGN.md §4.10).
 *
 * Le jeu ne parle qu'a un seul endroit : une boite en bas a droite qui garde
 * les dernieres lignes au lieu de les effacer.
 *
 * **Et ce n'est pas un journal, c'est une conversation** : chaque ligne a une
 * **voix** derriere elle, et cette voix a une couleur. Fermee, la boite montre
 * les trois dernieres ; ouverte, elle deroule tout l'historique, coupe par jour.
 *
 * Pourquoi ce fichier est pur et sans Phaser : ce qui est interessant ici n'est
 * pas le dessin mais la regle de conservation — qui parle, combien on garde, ce
 * qui sort, et ce qui fusionne. C'est testable sans navigateur.
 */

/**
 * Une voix par **source**, jamais par evenement.
 *
 * Si chaque type d'evenement avait sa couleur, on retomberait sur les 48
 * couleurs que la refonte vient de supprimer, et la couleur cesserait de vouloir
 * dire quoi que ce soit. Six voix qu'on apprend en une partie, c'est le contrat.
 */
export type Voix =
  /** Fronts, hordes, breches, morts au matin */
  | "guet"
  /** Faim, travail, maladies, humeurs, la porte */
  | "village"
  /** Chantiers, soins, conditions de montee */
  | "eglise"
  /** Voiles, cours, ventes */
  | "port"
  /** Ce qu'un heros voit — il parle par son NOM */
  | "heros"
  /** Les refus : c'est toi qui te reponds */
  | "toi";

/** Trois lignes fermee : au-dela, la boite devient un mur qu'on ne lit plus. */
export const LIGNES_FERMEE = 3;

/**
 * Sept jours d'historique.
 *
 * Une borne dure, et elle couvre tres largement « ce qui vient de se passer » :
 * une journee dure 45 minutes reelles, donc sept jours font plus de cinq heures
 * de jeu. Au-dela, les jours anciens sont jetes.
 */
export const JOURS_GARDES = 7;

export interface LigneJournal {
  readonly texte: string;
  readonly voix: Voix;
  /** Le nom de celui qui parle, quand la voix est « heros ». Sinon vide. */
  readonly qui: string;
  /** 1 quand elle n'a ete dite qu'une fois. Au-dela, l'affichage replie. */
  readonly repetitions: number;
  /** Le jour ou elle a ete dite : c'est lui qui coupe la colonne ouverte. */
  readonly jour: number;
}

export class Journal {
  private readonly lignes: LigneJournal[] = [];
  private compteurVersion = 0;

  /** @param joursGardes au-dela, les jours anciens sortent (§4.10). */
  constructor(private readonly joursGardes: number = JOURS_GARDES) {}

  /**
   * Ajoute une ligne. La plus recente est toujours en derniere position.
   *
   * Deux gestes identiques d'affilee — « Impossible de poser ici » repete a
   * chaque clic — remplissent la boite a eux seuls et poussent dehors ce qui
   * comptait vraiment. On les compte au lieu de les empiler.
   *
   * ⚠️ Deux lignes de **voix differentes** ne fusionnent jamais, meme a texte
   * egal : « il ne reste rien » dit par le village et par le port sont deux
   * evenements, et les confondre effacerait le second.
   */
  ajouter(texte: string, voix: Voix = "village", jour = 1, qui = ""): void {
    const propre = texte.trim();
    if (propre.length === 0) return;

    const derniere = this.lignes[this.lignes.length - 1];
    if (derniere && derniere.texte === propre && derniere.voix === voix && derniere.qui === qui) {
      this.lignes[this.lignes.length - 1] = {
        ...derniere,
        repetitions: derniere.repetitions + 1,
        jour,
      };
      this.compteurVersion += 1;
      return;
    }

    this.lignes.push({ texte: propre, voix, qui, repetitions: 1, jour });
    this.oublierLesVieuxJours(jour);
    this.compteurVersion += 1;
  }

  /**
   * On jette par **journee entiere**, jamais ligne a ligne : la colonne ouverte
   * est coupee par jour, et un jour ampute de son debut serait un jour qui ment.
   */
  private oublierLesVieuxJours(jourCourant: number): void {
    const plancher = jourCourant - (this.joursGardes - 1);
    if (plancher <= 1) return;
    let sortis = 0;
    while (sortis < this.lignes.length && (this.lignes[sortis]?.jour ?? 0) < plancher) sortis += 1;
    if (sortis > 0) this.lignes.splice(0, sortis);
  }

  /** Tout l'historique, de la plus ancienne a la plus recente. */
  get contenu(): readonly LigneJournal[] {
    return this.lignes;
  }

  /** Ce que montre la boite fermee : les trois dernieres, dans l'ordre. */
  get dernieres(): readonly LigneJournal[] {
    return this.lignes.slice(-LIGNES_FERMEE);
  }

  /** Les jours presents dans l'historique, du plus ancien au plus recent. */
  get jours(): readonly number[] {
    const vus: number[] = [];
    for (const ligne of this.lignes) {
      if (vus[vus.length - 1] !== ligne.jour) vus.push(ligne.jour);
    }
    return vus;
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

/**
 * Ce que la boite affiche pour une ligne, repli compris.
 *
 * « et 2 autres » plutot que « x3 » : le repli se lit comme une phrase, pas
 * comme un compteur de debogage (§4.10). Et un heros parle par son nom — c'est
 * ce qui fait la difference entre un journal et une conversation.
 */
export function lireLigne(ligne: LigneJournal): string {
  const debut = ligne.voix === "heros" && ligne.qui ? `${ligne.qui} : ` : "";
  const repli = ligne.repetitions > 1 ? `  — et ${ligne.repetitions - 1} autre${ligne.repetitions > 2 ? "s" : ""}` : "";
  return `${debut}${ligne.texte}${repli}`;
}
