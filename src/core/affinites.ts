/**
 * L'experience de groupe (DESIGN.md §4.16).
 *
 * Plus deux heros se battent cote a cote, plus ils travaillent bien ensemble.
 * L'affinite se compte **par paire**, en secondes de combat reellement partage.
 *
 * Le systeme marche sur une corde raide : il doit recompenser les equipes
 * soudees sans dissuader la rotation que la regle des 20% encourage. D'ou un
 * plafond bas, une seule statistique touchee, et un plancher d'acquis sous
 * lequel une paire ne redescend jamais.
 *
 * Ce fichier ne connait pas Phaser.
 */

/** Secondes de combat partage pour atteindre le plafond : dix minutes. */
export const SECONDES_POUR_PLAFOND = 600;

/** Bonus de degats maximum, atteint par une equipe entierement rodee. */
export const BONUS_MAX = 0.1;

/** L'oubli est six fois plus lent que l'apprentissage. */
export const FACTEUR_OUBLI = 1 / 6;

/**
 * Part du meilleur niveau atteint sous laquelle une paire ne redescend jamais.
 * On rouille, on ne desapprend pas — et sans ce plancher, l'oubli punirait la
 * rotation que tout le reste du jeu encourage.
 */
export const PLANCHER_ACQUIS = 0.25;

interface Lien {
  secondes: number;
  /** Meilleur niveau jamais atteint, qui fixe le plancher */
  record: number;
}

export class Affinites {
  private liens = new Map<string, Lien>();

  /**
   * Fait couler le temps.
   *
   * @param tous       identifiants de tous les heros de l'equipe
   * @param auCombat   ceux qui se battent vraiment en ce moment
   * @param secondes   temps ecoule depuis le dernier appel
   */
  ecouler(tous: string[], auCombat: readonly string[], secondes: number): void {
    if (secondes <= 0) return;
    const combattants = new Set(auCombat);

    for (let i = 0; i < tous.length; i++) {
      for (let j = i + 1; j < tous.length; j++) {
        const a = tous[i]!;
        const b = tous[j]!;
        const ensemble = combattants.has(a) && combattants.has(b);
        // Une equipe qui se repose ne perd rien : l'oubli demande qu'au moins
        // l'un des deux soit dehors, en train de se battre sans l'autre.
        const separes = !ensemble && (combattants.has(a) || combattants.has(b));
        if (!ensemble && !separes) continue;

        const lien = this.lienDe(a, b);
        if (ensemble) {
          lien.secondes = Math.min(SECONDES_POUR_PLAFOND, lien.secondes + secondes);
          lien.record = Math.max(lien.record, lien.secondes);
        } else {
          const plancher = lien.record * PLANCHER_ACQUIS;
          lien.secondes = Math.max(plancher, lien.secondes - secondes * FACTEUR_OUBLI);
        }
      }
    }
  }

  /** Force du lien entre deux heros, de 0 (inconnus) a 1 (rodes). */
  affinite(a: string, b: string): number {
    if (a === b) return 0;
    return (this.liens.get(cle(a, b))?.secondes ?? 0) / SECONDES_POUR_PLAFOND;
  }

  /**
   * Le bonus de degats d'un heros : la **moyenne** de ses liens avec ceux qui
   * se battent a ses cotes maintenant, jamais leur somme. Une somme grimperait
   * avec la taille de l'equipe et ferait exploser le plafond.
   */
  bonus(identifiant: string, auCombat: readonly string[]): number {
    const compagnons = auCombat.filter((autre) => autre !== identifiant);
    if (compagnons.length === 0) return 0;

    let total = 0;
    for (const autre of compagnons) total += this.affinite(identifiant, autre);
    return (BONUS_MAX * total) / compagnons.length;
  }

  private lienDe(a: string, b: string): Lien {
    const k = cle(a, b);
    let lien = this.liens.get(k);
    if (!lien) {
      lien = { secondes: 0, record: 0 };
      this.liens.set(k, lien);
    }
    return lien;
  }

  /**
   * Des paires qui n'apprennent plus rien ensemble (DESIGN.md §4.26).
   *
   * ⚠️ **C'est le droit de veto de la relation sur l'affinite**, et le seul
   * endroit ou les deux systemes se touchent. « Deux ennemis refusent de
   * cooperer : pas de formation commune, pas d'affinite qui monte. » Leur lien
   * militaire est remis a zero — le **record** aussi, sinon le plancher
   * d'acquis leur rendrait le quart de ce qu'ils avaient appris.
   *
   * Appele au meme rythme qu'`ecouler`, jamais par image.
   */
  oublier(paires: Iterable<[string, string]>): void {
    for (const [a, b] of paires) this.liens.delete(cle(a, b));
  }
}

/** La cle ignore l'ordre : une affinite n'a pas de sens. */
function cle(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}
