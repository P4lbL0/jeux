import Phaser from "phaser";
import { ASSETS } from "../game/assets";

/**
 * Le prechargement, avant tout le reste.
 *
 * Les textures Phaser sont **globales au jeu** : les charger une fois ici les
 * rend disponibles dans toutes les scenes, sans que ni l'arene ni l'ecran de
 * choix n'aient a s'en occuper.
 *
 * Elle charge les PNG de `src/assets/` : depuis le 18 septembre 2026, les
 * batiments et le decor rendus par Blender. Tout le reste est dessine par le
 * code et cuit au demarrage de chaque scene (`dessin/monde.ts`), qui saute
 * toute cle deja chargee ici.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super("boot");
  }

  preload(): void {
    for (const { cle, url } of ASSETS) this.load.image(cle, url);
  }

  create(): void {
    if (ASSETS.length > 0) {
      console.log(`[boot] ${ASSETS.length} sprite(s) Blender : ils remplacent le dessin au code`);
    }
    // L'ecran de depart avant le choix de classe : c'est lui qui dit s'il y a
    // une partie a reprendre (DESIGN.md §4.28).
    this.scene.start("menu");
  }
}
