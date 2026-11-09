import Phaser from "phaser";
import { POLICE } from "../../game/ui/chrome";
import type { ArenaScene } from "../ArenaScene";
import { MAX_TEXTES_FLOTTANTS, ZOOM_DEFAUT } from "./reglages";

/**
 * Les effets : les textes qui flottent, les cercles, les auras, les traînées.
 *
 * Une part d'`ArenaScene`, greffée sur son prototype (`greffer`) : `this` est la scène.
 */
export class ArenaEffetsVisuels {

  // --------------------------------------------------------------- effets

  /**
   * Nombres flottants, recycles.
   *
   * Un objet Texte de Phaser fabrique sa propre texture : en creer plusieurs
   * dizaines par seconde suffit a faire tomber le jeu. On les reutilise, et on
   * cesse d'en afficher au-dela d'un certain nombre a l'ecran.
   */
  flotter(this: ArenaScene, x: number, y: number, texte: string, couleur: string): void {
    if (this.textesActifs >= MAX_TEXTES_FLOTTANTS) return;

    // Comme le survol : ce texte vit **dans le monde**, donc la camera de
    // l'arene l'agrandit de son zoom. Il se rasterise a `ZOOM_DEFAUT` pour
    // retomber net a la taille ou on le voit (§4.10, 21 septembre 2026).
    const t =
      this.textesLibres.pop() ??
      this.add
        .text(0, 0, "", {
          fontFamily: POLICE,
          fontSize: "12px",
          color: "#ffffff",
          resolution: ZOOM_DEFAUT,
        })
        .setOrigin(0.5)
        .setDepth(5000);
    t.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);

    this.textesActifs += 1;
    t.setText(texte).setColor(couleur).setPosition(x, y).setAlpha(1).setVisible(true);

    this.tweens.add({
      targets: t,
      y: y - 22,
      alpha: 0,
      duration: 650,
      onComplete: () => {
        this.textesActifs -= 1;
        t.setVisible(false);
        this.textesLibres.push(t);
      },
    });
  }

  effetCercle(this: ArenaScene, x: number, y: number, rayon: number, couleur: number): void {
    const c = this.add
      .image(x, y, "impact")
      .setTint(couleur)
      .setAlpha(0.6)
      .setScale(0.4)
      .setDepth(y - 2);
    this.tweens.add({
      targets: c,
      scale: rayon / 8,
      alpha: 0,
      duration: 320,
      onComplete: () => c.destroy(),
    });
  }

  aura(this: ArenaScene, x: number, y: number, echelle: number, couleur: number, duree: number): void {
    const a = this.add
      .image(x, y, "impact")
      .setScale(echelle)
      .setAlpha(0.35)
      .setTint(couleur)
      .setDepth(y - 3);
    this.tweens.add({ targets: a, alpha: 0, duration: duree, onComplete: () => a.destroy() });
  }

  trainee(this: ArenaScene, x1: number, y1: number, x2: number, y2: number, couleur: number): void {
    const l = this.add
      .line(0, 0, x1, y1, x2, y2, couleur)
      .setOrigin(0)
      .setLineWidth(3)
      .setAlpha(0.75)
      .setDepth(y1 - 1);
    this.tweens.add({ targets: l, alpha: 0, duration: 320, onComplete: () => l.destroy() });
  }
}
