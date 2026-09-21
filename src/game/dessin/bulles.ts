import Phaser from "phaser";
import { C } from "../ui/couleurs";

/**
 * Les trois bulles de la vie autonome (DESIGN.md §4.27).
 *
 * > De petites bulles (un coeur, une goutte de sueur, une chope) apparaissent
 * > quand deux personnes se croisent. Le joueur invente alors sa propre
 * > histoire — « ah tiens, le bucheron drague l'oracle » — et c'est exactement
 * > l'effet recherche.
 *
 * ⚠️ **Dessinees, jamais ecrites.** Ni emoji ni caractere : trois textures
 * tracees au code, cuites **une fois** au demarrage. Le §4.27 exige un pool
 * cree une fois et aucun objet Texte fabrique en jeu ; les trois formes
 * ci-dessous sont des images, ce qui est encore moins cher.
 *
 * Elles sont volontairement **minuscules** — 12 px — et de la palette : une
 * bulle plus grosse ou d'une autre couleur deviendrait une alerte, alors que
 * c'est une ambiance.
 */

export const CLE_BULLE_COEUR = "bulle-coeur";
export const CLE_BULLE_SUEUR = "bulle-sueur";
export const CLE_BULLE_CHOPE = "bulle-chope";

/** Cote d'une bulle, en pixels du monde. */
export const COTE_BULLE = 12;

export function cuireLesBulles(scene: Phaser.Scene): void {
  graver(scene, CLE_BULLE_COEUR, (g) => {
    // Deux lobes et une pointe : un coeur de douze pixels ne supporte pas
    // mieux, et une courbe de Bezier y ferait une tache.
    g.fillStyle(C.sangFrais, 1);
    g.fillCircle(4, 4.5, 2.6);
    g.fillCircle(8, 4.5, 2.6);
    g.fillTriangle(1.4, 5.5, 10.6, 5.5, 6, 10.5);
  });

  graver(scene, CLE_BULLE_SUEUR, (g) => {
    // Une goutte : un disque, et une pointe vers le haut.
    g.fillStyle(C.acier, 1);
    g.fillCircle(6, 7.5, 3);
    g.fillTriangle(3.4, 6.4, 8.6, 6.4, 6, 1.5);
  });

  graver(scene, CLE_BULLE_CHOPE, (g) => {
    // Une chope : le corps, l'anse, et la mousse en os.
    g.fillStyle(C.laiton, 1);
    g.fillRect(2, 4, 6, 7);
    // L'anse, en creux : deux traits plutot qu'un arc, a cette taille c'est
    // la meme silhouette pour un tiers du cout.
    g.fillRect(8, 5, 2, 1);
    g.fillRect(9, 5, 1, 4);
    g.fillRect(8, 8, 2, 1);
    g.fillStyle(C.os, 1);
    g.fillRect(2, 2, 6, 2);
  });
}

function graver(
  scene: Phaser.Scene,
  cle: string,
  trace: (g: Phaser.GameObjects.Graphics) => void,
): void {
  if (scene.textures.exists(cle)) return;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  trace(g);
  g.generateTexture(cle, COTE_BULLE, COTE_BULLE);
  g.destroy();
}
