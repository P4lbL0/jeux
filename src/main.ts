import Phaser from "phaser";
import { ChoixClasseScene } from "./scenes/ChoixClasseScene";
import { ArenaScene } from "./scenes/ArenaScene";
import { UiScene } from "./scenes/UiScene";

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
  // UiScene tourne en parallele de l'arene, avec sa propre camera non zoomee.
  scene: [ChoixClasseScene, ArenaScene, UiScene],
};

new Phaser.Game(config);
