import Phaser from "phaser";
import { ANIMATIONS, ASSETS } from "../game/assets";

/**
 * Le prechargement, avant tout le reste.
 *
 * Les textures Phaser sont **globales au jeu** : les charger une fois ici les
 * rend disponibles dans toutes les scenes, sans que ni l'arene ni l'ecran de
 * choix n'aient a s'en occuper.
 *
 * Ce qui n'a pas de PNG n'est pas une erreur : `creerTexturesPlaceholder` (dans
 * `art.ts`) fabrique au code ce qui manque, chaque fonction etant gardee par un
 * `if (scene.textures.exists(cle)) return;`. On migre donc un sprite a la fois,
 * sans jamais casser le jeu entre deux.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super("boot");
  }

  preload(): void {
    for (const { cle, url } of ASSETS) this.load.image(cle, url);
    // Une planche se charge en `spritesheet` et non en `image` : sans les
    // dimensions d'une frame, Phaser en ferait une seule texture de six
    // personnages cote a cote. Le manifeste les porte.
    for (const { cle, url, taille } of ANIMATIONS) {
      this.load.spritesheet(cle, url, { frameWidth: taille, frameHeight: taille });
    }
  }

  create(): void {
    const sequences = this.declarerAnimations();
    console.log(
      `[boot] ${ASSETS.length} sprite(s), ${ANIMATIONS.length} planche(s), ` +
        `${sequences} animation(s)`,
    );
    // L'ecran de depart avant le choix de classe : c'est lui qui dit s'il y a
    // une partie a reprendre (DESIGN.md §4.28).
    this.scene.start("menu");
  }

  /**
   * Les animations sont **globales au jeu**, comme les textures : declarees une
   * fois ici, elles sont jouables depuis n'importe quelle scene.
   *
   * Chaque planche en contient plusieurs, reperees par leur plage de frames —
   * c'est le manifeste, produit avec les PNG, qui donne ces bornes. Rien n'est
   * ecrit en dur des deux cotes.
   */
  private declarerAnimations(): number {
    let compte = 0;
    for (const planche of ANIMATIONS) {
      for (const { cle, debut, fin, cadence, boucle } of planche.animations) {
        if (this.anims.exists(cle)) continue;
        this.anims.create({
          key: cle,
          frames: this.anims.generateFrameNumbers(planche.cle, { start: debut, end: fin }),
          frameRate: cadence,
          repeat: boucle ? -1 : 0,
        });
        compte += 1;
      }
    }
    return compte;
  }
}
