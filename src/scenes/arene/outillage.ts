import Phaser from "phaser";
import { Ennemi, Hero } from "../../game/entities";
import { RANGS } from "../../core/rangs";
import { estTerreFerme, PRATICABLE } from "../../core/carte";
import { Grille } from "../../core/grille";
import type { ArenaScene } from "../ArenaScene";

/**
 * L'outillage partagé : un point devant, ramener sur terre, chercher dans un rayon ou le
 * long d'un trait (toujours par le voisinage), repousser.
 *
 * Une part d'`ArenaScene`, greffée sur son prototype (`greffer`) : `this` est la scène.
 */
export class ArenaOutillage {

  // ------------------------------------------------------------- outillage

  pointDevant(this: ArenaScene, hero: Hero, distance: number): Phaser.Math.Vector2 {
    return this.ramenerSurTerre(
      hero.x + hero.regard.x * distance,
      hero.y + hero.regard.y * distance,
    );
  }

  /**
   * Ramene un point dans la zone praticable.
   *
   * Sans ca, un Clignement ou une Charge deposerait le heros au milieu de la
   * mer ou dans la roche — et un flanc ferme qu'on peut franchir par une
   * capacite n'est pas un flanc ferme (DESIGN.md §4.6).
   */
  ramenerSurTerre(this: ArenaScene, x: number, y: number): Phaser.Math.Vector2 {
    const marge = 8;
    const px = Phaser.Math.Clamp(x, PRATICABLE.x + marge, PRATICABLE.x + PRATICABLE.largeur - marge);
    const py = Phaser.Math.Clamp(y, PRATICABLE.y + marge, PRATICABLE.y + PRATICABLE.hauteur - marge);
    if (estTerreFerme(px, py)) return new Phaser.Math.Vector2(px, py);
    // Dans l'eau ou dans la roche : la case de terre ferme la plus proche, en
    // cercles de plus en plus larges. Douze cases au plus — au-dela, on reste
    // ou l'on est.
    const c0 = this.grille.colonneDe(px);
    const l0 = this.grille.ligneDe(py);
    for (let rayon = 1; rayon <= 12; rayon++) {
      let meilleure: { x: number; y: number; d: number } | null = null;
      for (let dl = -rayon; dl <= rayon; dl++) {
        for (let dc = -rayon; dc <= rayon; dc++) {
          if (Math.max(Math.abs(dc), Math.abs(dl)) !== rayon) continue;
          const centre = Grille.centreCase(c0 + dc, l0 + dl);
          if (!this.grille.dedans(c0 + dc, l0 + dl) || !estTerreFerme(centre.x, centre.y)) continue;
          const d = Math.hypot(centre.x - px, centre.y - py);
          if (!meilleure || d < meilleure.d) meilleure = { x: centre.x, y: centre.y, d };
        }
      }
      if (meilleure) return new Phaser.Math.Vector2(meilleure.x, meilleure.y);
    }
    return new Phaser.Math.Vector2(px, py);
  }

  /** Les monstres debout a `rayon` au plus, dans l'ordre de la horde — par le voisinage (§4.33). */
  ennemisDansRayon(this: ArenaScene, x: number, y: number, rayon: number): Ennemi[] {
    const n = this.voisinage.autour(x, y, rayon, this.monstreDebout);
    const trouves = new Array<Ennemi>(n);
    for (let k = 0; k < n; k++) trouves[k] = this.horde[this.voisinage.trouve(k)]!;
    return trouves;
  }

  /**
   * Les `n` premiers monstres debout le long du trait [a, b], a `epaisseur` au
   * plus, du plus proche du depart au plus lointain — la penetration (§4.25).
   * Par le voisinage : on ne lit que les cellules que le trait traverse, jamais
   * toute la horde (§4.33).
   */
  monstresLeLongDuTrait(
    this: ArenaScene,
    ax: number,
    ay: number,
    bx: number,
    by: number,
    epaisseur: number,
    n: number,
  ): Ennemi[] {
    const k = this.voisinage.leLongDuTrait(ax, ay, bx, by, epaisseur, n, this.monstreDebout);
    const trouves = new Array<Ennemi>(k);
    for (let j = 0; j < k; j++) trouves[j] = this.horde[this.voisinage.trouve(j)]!;
    return trouves;
  }

  repousser(this: ArenaScene, e: Ennemi, x: number, y: number, force: number): void {
    const angle = Phaser.Math.Angle.Between(x, y, e.x, e.y);
    // Un geant recule moins (§4.25, le recul ; §4.33, les rangs) : le boss deux
    // fois, l'enorme trois. Pousse comme un orc, il ne se lirait plus geant.
    const recul = force / RANGS[e.rang].taille;
    e.setVelocity(Math.cos(angle) * recul, Math.sin(angle) * recul);
  }
}
