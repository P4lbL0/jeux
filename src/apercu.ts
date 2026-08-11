/**
 * Page d'apercu des textures dessinees en code.
 *
 * Temporaire : elle sert a regarder un placeholder sans lancer une partie, en
 * l'agrandissant assez pour voir les pixels un par un. A supprimer une fois le
 * sprite valide.
 */

import Phaser from "phaser";
import "./police.css";
import { creerTexturesPlaceholder } from "./game/art";
import { POLICE } from "./game/ui/chrome";

const ZOOM = 4;
const CLES = ["eglise-1", "eglise-2", "eglise-3", "eglise-4"];

class Apercu extends Phaser.Scene {
  create(): void {
    creerTexturesPlaceholder(this);

    // Le sol du village en fond : un sprite ne se juge jamais sur fond uni, il
    // se juge sur ce qu'il aura derriere lui en jeu.
    this.add.tileSprite(0, 0, 1000, 460, "sol-herbe").setOrigin(0).setAlpha(0.9);

    let x = 90;
    for (const cle of CLES) {
      const source = this.textures.get(cle).getSourceImage();
      const hauteur = (source as HTMLImageElement).height;

      this.add.image(x, 390, cle).setOrigin(0.5, 1).setScale(ZOOM);
      this.add
        .text(x, 410, `${cle}\n48 x ${hauteur}`, {
          fontFamily: POLICE,
          fontSize: "15px",
          color: "#f2e9d8",
          align: "center",
        })
        .setOrigin(0.5, 0);

      x += 230;
    }

    // Une maison et une tour a cote, a la meme echelle : c'est la seule facon de
    // juger si l'eglise domine vraiment le village (§4.22).
    this.add.image(880, 390, "maison-bleue").setOrigin(0.5, 1).setScale(ZOOM);
    this.add
      .text(880, 410, "maison\n(comparaison)", {
        fontFamily: POLICE,
        fontSize: "15px",
        color: "#9aa3b2",
        align: "center",
      })
      .setOrigin(0.5, 0);
  }
}

new Phaser.Game({
  type: Phaser.CANVAS,
  width: 1000,
  height: 460,
  pixelArt: true,
  backgroundColor: "#2b2f3a",
  scene: Apercu,
});
