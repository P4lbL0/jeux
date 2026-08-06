import Phaser from "phaser";
import { ChoixClasseScene } from "./scenes/ChoixClasseScene";
import { ArenaScene } from "./scenes/ArenaScene";

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: "game",
  backgroundColor: "#1d3b1c",
  // Indispensable pour du pixel-art : pas de lissage quand on zoome.
  pixelArt: true,
  roundPixels: true,
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: "arcade",
    arcade: { debug: false },
  },
  scene: [ChoixClasseScene, ArenaScene],
};

new Phaser.Game(config);
