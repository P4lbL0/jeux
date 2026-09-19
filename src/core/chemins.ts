import { CASE } from "./grille";
import { terrainEn, type Terrain } from "./carte";

/**
 * Les chemins qui s'usent (DESIGN.md §4.24, tranche le 9 septembre 2026).
 *
 * Les rues sont peintes une fois pour toutes ; **les chemins, eux, se marquent
 * la ou les gens passent vraiment**. Une case devient visible a 30 passages,
 * se creuse a mesure qu'on la foule, et s'efface au bout de 4 journees sans
 * personne. Le village raconte comment on l'a joue.
 *
 * Un **passage**, c'est un marcheur qui entre dans une case : pas une image
 * passee dedans. Quelqu'un qui piétine sur place n'use rien ; quelqu'un qui
 * traverse use chaque case une fois. Ce module ne connait ni Phaser ni les
 * habitants : on lui pousse des positions et une journee, il dit quelles
 * cases changent d'aspect.
 */

export const REGLAGES_CHEMINS = {
  /** Le nombre de passages a partir duquel une case se voit. */
  passagesVisibles: 30,
  /** Le nombre de passages ou le chemin est aussi creuse qu'il peut l'etre. */
  passagesCreuses: 150,
  /** Une case oubliee depuis autant de journees s'efface. */
  journeesAvantEffacement: 4,
  /** Une case se redessine tous les autant de passages, pas a chacun. */
  pasDeRedessin: 30,
};

/** Les terrains qu'un pas peut marquer : ni l'eau, ni la roche, ni les paves. */
const TERRAINS_MARQUABLES = new Set<Terrain>(["herbe", "sable", "sous-bois"]);

/** Une case foulee, telle que le dessin la lit. */
export interface CaseFoulee {
  colonne: number;
  ligne: number;
  /** Le centre du chemin, en pixels du monde : la moyenne des premiers passages, figee a la visibilite. */
  x: number;
  y: number;
  passages: number;
  /** La derniere journee ou quelqu'un est passe. */
  dernierJour: number;
}

/** Ce qu'un pas ou une aube change : une case a redessiner, ou a effacer. */
export type ChangementDeChemin =
  | { quoi: "redessiner"; cas: CaseFoulee }
  | { quoi: "effacer"; cas: CaseFoulee };

/** Ce qu'une case foulee reprend d'une sauvegarde, ou y laisse. */
export interface CaseFouleeSauvee {
  colonne: number;
  ligne: number;
  x: number;
  y: number;
  passages: number;
  dernierJour: number;
}

interface Entree extends CaseFoulee {
  /** Les positions cumulees avant la visibilite, pour figer le centre la ou l'on marche vraiment. */
  sommeX: number;
  sommeY: number;
  /** Le nombre de passages au dernier dessin, pour ne pas redessiner a chaque pas. */
  dessineA: number;
}

export function cleDeCase(colonne: number, ligne: number): string {
  return `${colonne},${ligne}`;
}

/**
 * L'usure d'une case, entre 0 (invisible) et 1 (creusee), pour une journee
 * donnee : elle monte avec les passages et palit a chaque journee sans
 * personne, jusqu'a disparaitre. **Pure.**
 */
export function usureDe(cas: Pick<CaseFoulee, "passages" | "dernierJour">, jour: number): number {
  const r = REGLAGES_CHEMINS;
  if (cas.passages < r.passagesVisibles) return 0;
  const profondeur = Math.min(1, (cas.passages - r.passagesVisibles) / (r.passagesCreuses - r.passagesVisibles));
  const fraicheur = Math.max(0, 1 - Math.max(0, jour - cas.dernierJour) / r.journeesAvantEffacement);
  return (0.4 + 0.6 * profondeur) * fraicheur;
}

/** Vrai si un pas peut marquer ce point du monde. */
export function estMarquable(x: number, y: number): boolean {
  return TERRAINS_MARQUABLES.has(terrainEn(x, y));
}

export class Chemins {
  private readonly cases = new Map<string, Entree>();
  /** La derniere case de chaque marcheur : un passage, c'est en changer. */
  private readonly dernieres = new WeakMap<object, string>();
  /** Les cases qu'un pas ne marque jamais (la place, deja en terre battue). */
  private readonly exclues = new Set<string>();

  /** Les cases que les pas ne doivent pas marquer. */
  exclure(cases: Iterable<string>): void {
    for (const clef of cases) this.exclues.add(clef);
  }

  /**
   * Un marcheur est ici, cette journee-la. Rend la case a redessiner si son
   * aspect change — au seuil de visibilite, puis tous les `pasDeRedessin`
   * passages —, sinon null.
   */
  passer(marcheur: object, x: number, y: number, jour: number): ChangementDeChemin | null {
    const colonne = Math.floor(x / CASE);
    const ligne = Math.floor(y / CASE);
    const clef = cleDeCase(colonne, ligne);
    if (this.dernieres.get(marcheur) === clef) return null;
    this.dernieres.set(marcheur, clef);
    if (this.exclues.has(clef) || !estMarquable(x, y)) return null;

    let cas = this.cases.get(clef);
    if (!cas) {
      cas = { colonne, ligne, x, y, passages: 0, dernierJour: jour, sommeX: 0, sommeY: 0, dessineA: 0 };
      this.cases.set(clef, cas);
    }
    const r = REGLAGES_CHEMINS;
    // Une case qu'on refoule apres l'avoir laissee palir repart de sa fraicheur, pas de zero.
    const ranime = cas.passages >= r.passagesVisibles && cas.dernierJour !== jour;
    cas.dernierJour = jour;
    if (cas.passages < r.passagesCreuses) cas.passages += 1;
    if (cas.passages <= r.passagesVisibles) {
      cas.sommeX += x;
      cas.sommeY += y;
      cas.x = cas.sommeX / cas.passages;
      cas.y = cas.sommeY / cas.passages;
    }
    if (cas.passages < r.passagesVisibles) return null;
    if (!ranime && cas.dessineA > 0 && cas.passages - cas.dessineA < r.pasDeRedessin) return null;
    cas.dessineA = cas.passages;
    return { quoi: "redessiner", cas };
  }

  /**
   * Une journee se leve : tout ce qui est visible palit d'un cran, et ce qui a
   * ete oublie assez longtemps s'efface. Rend les changements a peindre.
   */
  seLever(jour: number): ChangementDeChemin[] {
    const changements: ChangementDeChemin[] = [];
    for (const [clef, cas] of this.cases) {
      if (cas.passages < REGLAGES_CHEMINS.passagesVisibles) {
        // Jamais devenue visible : on l'oublie sans rien peindre.
        if (jour - cas.dernierJour >= REGLAGES_CHEMINS.journeesAvantEffacement) this.cases.delete(clef);
        continue;
      }
      if (usureDe(cas, jour) <= 0) {
        this.cases.delete(clef);
        changements.push({ quoi: "effacer", cas });
      } else {
        changements.push({ quoi: "redessiner", cas });
      }
    }
    return changements;
  }

  /** Les cases visibles, pour le dessin. */
  get visibles(): CaseFoulee[] {
    return [...this.cases.values()].filter((c) => c.passages >= REGLAGES_CHEMINS.passagesVisibles);
  }

  /** Les cases visibles autour d'un point, a moins de `rayon` pixels de son centre. */
  autour(x: number, y: number, rayon: number): CaseFoulee[] {
    return this.visibles.filter((c) => Math.hypot(c.x - x, c.y - y) <= rayon);
  }

  /** Ce qu'on garde dans une sauvegarde : les cases visibles seulement. */
  sauver(): CaseFouleeSauvee[] {
    return this.visibles.map(({ colonne, ligne, x, y, passages, dernierJour }) => ({
      colonne,
      ligne,
      x,
      y,
      passages,
      dernierJour,
    }));
  }

  reprendre(sauvees: CaseFouleeSauvee[]): void {
    this.cases.clear();
    for (const s of sauvees) {
      this.cases.set(cleDeCase(s.colonne, s.ligne), {
        ...s,
        sommeX: s.x * s.passages,
        sommeY: s.y * s.passages,
        dessineA: s.passages,
      });
    }
  }
}
