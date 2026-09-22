import Phaser from "phaser";
import { REGLAGES_METEORE } from "../core/meteore";
import { CLE_OMBRE, CLE_POUSSIERE, CLE_TRAINEE, COTE_OMBRE, cuireLeMeteore } from "./dessin/meteore";
import { jouer } from "./son";

/**
 * La chute d'un meteore, a l'ecran (DESIGN.md §4.21).
 *
 * Le noyau (`core/meteore.ts`) dit **ou** et **quand** ; ce fichier montre les
 * douze secondes qui precedent, et le coup.
 *
 * Trois objets, crees une fois et caches le reste du temps (§4.17) : l'ombre
 * qui grandit au sol, la trainee qui descend vers elle, et l'anneau de
 * poussiere qui part a l'impact. Rien n'est fabrique pendant la chute.
 */

/** D'ou part la trainee, par rapport au point de chute : en haut a droite. */
const DEPART = { x: 520, y: -420 };

/** Sous les personnages, au-dessus du sol : on marche **dans** l'ombre. */
const PROFONDEUR_OMBRE = -930;
/** La trainee passe devant tout ce qui est au sol, et sous l'interface. */
const PROFONDEUR_TRAINEE = 880;

export class ChuteDuMeteore {
  private readonly ombre: Phaser.GameObjects.Image;
  private readonly trainee: Phaser.GameObjects.Image;
  private readonly poussiere: Phaser.GameObjects.Image;
  /** La voix du sifflement pendant la chute, coupee a l'impact */
  private sifflement: { arreter(fondu?: number): void } | null = null;

  constructor(private readonly scene: Phaser.Scene) {
    cuireLeMeteore(scene);
    this.ombre = scene.add.image(0, 0, CLE_OMBRE).setVisible(false).setDepth(PROFONDEUR_OMBRE);
    this.trainee = scene.add
      .image(0, 0, CLE_TRAINEE)
      .setOrigin(1, 0.5)
      .setVisible(false)
      .setDepth(PROFONDEUR_TRAINEE)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.poussiere = scene.add
      .image(0, 0, CLE_POUSSIERE)
      .setVisible(false)
      .setDepth(PROFONDEUR_TRAINEE - 1);

    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.sifflement?.arreter(0.2);
      this.sifflement = null;
    });
  }

  /** Le ciel s'ouvre : on lance le sifflement et on montre l'ombre. */
  annoncer(): void {
    this.sifflement = jouer(this.scene, "bruit-meteore-chute", "ambiance", { volume: 0.55 });
  }

  /**
   * Une image de chute.
   *
   * @param point ou ca va tomber, ou null si rien ne tombe
   * @param part 0 a l'annonce, 1 a l'impact
   */
  majorer(point: { x: number; y: number } | null, part: number): void {
    if (!point) {
      this.ombre.setVisible(false);
      this.trainee.setVisible(false);
      return;
    }

    // L'ombre grandit jusqu'a la taille exacte du cratere : ce qu'on voit au
    // sol **est** ce qui sera detruit, sans marge ni surprise.
    const echelle = ((REGLAGES_METEORE.rayon * 2) / COTE_OMBRE) * (0.25 + 0.75 * part);
    this.ombre.setPosition(point.x, point.y).setScale(echelle).setVisible(true);
    // Elle bat plus vite a mesure que ca approche : c'est le compte a rebours,
    // et il se lit sans chiffre.
    this.ombre.setAlpha(0.55 + 0.45 * Math.abs(Math.sin(part * part * 26)));

    // La pierre descend en ligne droite vers le point, et sa trainee la suit.
    // Elle ne parait qu'au dernier tiers : avant, le ciel n'a qu'une ombre a
    // montrer, et c'est plus inquietant.
    if (part < 0.66) {
      this.trainee.setVisible(false);
      return;
    }
    const t = (part - 0.66) / 0.34;
    const x = point.x + DEPART.x * (1 - t);
    const y = point.y + DEPART.y * (1 - t);
    this.trainee
      .setPosition(x, y)
      .setRotation(Math.atan2(-DEPART.y, -DEPART.x))
      .setScale(1 + (1 - t) * 0.6, 1)
      .setVisible(true);
  }

  /**
   * Le coup.
   *
   * Un eclair blanc court, un anneau de poussiere qui s'ouvre, et le son. La
   * secousse et les degats appartiennent a la scene : ici, on ne fait que
   * montrer.
   */
  frapper(point: { x: number; y: number }): void {
    this.trainee.setVisible(false);
    this.ombre.setVisible(false);
    this.sifflement?.arreter(0.15);
    this.sifflement = null;

    jouer(this.scene, "bruit-meteore", "effets", { volume: 1 });

    this.poussiere.setPosition(point.x, point.y).setScale(0.5).setAlpha(0.9).setVisible(true);
    this.scene.tweens.add({
      targets: this.poussiere,
      scale: (REGLAGES_METEORE.rayon * 2.6) / 64,
      alpha: 0,
      duration: 700,
      ease: "Cubic.easeOut",
      onComplete: () => this.poussiere.setVisible(false),
    });
  }

  /** Tout se range : fin de partie, reprise. */
  toutCacher(): void {
    this.ombre.setVisible(false);
    this.trainee.setVisible(false);
    this.poussiere.setVisible(false);
    this.sifflement?.arreter(0.2);
    this.sifflement = null;
  }
}
