import Phaser from "phaser";
import { ASSETS } from "../game/assets";
import { INTRO, SON_INTRO } from "../game/intro";
import { SONS_INTERFACE, reprendreLesReglages } from "../game/son";

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
 *
 * Elle declare aussi les deux videos de l'ecran-titre (`game/intro.ts`). Les
 * declarer ne telecharge rien : c'est l'element video de la scene du titre qui
 * ira les chercher, et il choisit lui-meme le format que le navigateur lit.
 *
 * Et elle charge les sons dont le film a besoin **des sa premiere image** : sa
 * piste, le glas du titre, les deux bruits de l'interface — une centaine de Ko
 * en tout. La musique et le feu du menu, plus lourds, ne servent qu'au bout de
 * neuf secondes : c'est la scene du titre qui les charge, pendant le film.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super("boot");
  }

  preload(): void {
    for (const { cle, url } of ASSETS) this.load.image(cle, url);
    // `true` : pas de piste son, donc le navigateur accepte de lancer la video
    // tout seul, sans attendre un clic.
    this.load.video(INTRO.approche.cle, [...INTRO.approche.urls], true);
    this.load.video(INTRO.boucle.cle, [...INTRO.boucle.urls], true);
    for (const { cle, urls } of [SON_INTRO.approche, SON_INTRO.titre, ...Object.values(SONS_INTERFACE)]) {
      this.load.audio(cle, [...urls]);
    }
  }

  create(): void {
    reprendreLesReglages(this.game);
    if (ASSETS.length > 0) {
      console.log(`[boot] ${ASSETS.length} sprite(s) Blender : ils remplacent le dessin au code`);
    }
    // L'ecran-titre d'abord : le film, puis JOUER, puis les emplacements qui
    // disent s'il y a une partie a reprendre (DESIGN.md §4.10, §4.28).
    this.scene.start("titre");
  }
}
