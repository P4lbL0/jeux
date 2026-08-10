import Phaser from "phaser";
import { BootScene } from "./scenes/BootScene";
import { MenuScene } from "./scenes/MenuScene";
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
  // BootScene charge les PNG avant tout le monde : les textures Phaser etant
  // globales, les scenes suivantes les trouvent deja la.
  // UiScene tourne en parallele de l'arene, avec sa propre camera non zoomee.
  scene: [BootScene, MenuScene, ChoixClasseScene, ArenaScene, UiScene],
};

new Phaser.Game(config);
