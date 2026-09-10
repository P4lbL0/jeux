import Phaser from "phaser";
import { ASSETS } from "../game/assets";

/**
 * Le prechargement, avant tout le reste.
 *
 * Les textures Phaser sont **globales au jeu** : les charger une fois ici les
 * rend disponibles dans toutes les scenes, sans que ni l'arene ni l'ecran de
 * choix n'aient a s'en occuper.
 *
 * ⚠️ Depuis le 10 septembre 2026, il n'y a plus rien a charger : tout le monde
 * est dessine par le code et cuit au demarrage de chaque scene
 * (`dessin/monde.ts`). Cette scene ne sert plus qu'a ramasser un eventuel PNG
 * depose dans `src/assets/` — et a passer la main au menu.
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
      console.log(`[boot] ${ASSETS.length} PNG depose(s) : ils remplacent le dessin au code`);
    }
    // L'ecran de depart avant le choix de classe : c'est lui qui dit s'il y a
    // une partie a reprendre (DESIGN.md §4.28).
    this.scene.start("menu");
  }
}
