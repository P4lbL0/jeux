import Phaser from "phaser";
import { C } from "../ui/couleurs";

/**
 * Ce qu'on voit d'un meteore qui tombe (DESIGN.md §4.21).
 *
 * Trois textures, cuites une fois : l'**ombre** qui grandit au sol pendant les
 * douze secondes d'annonce, la **trainee** qui descend vers elle, et la
 * **poussiere** de l'impact.
 *
 * ⚠️ **Rien de tout ca n'est du decor, donc rien ne passe par Blender.** Meme
 * regle que la pluie et l'eclair (§4.21) : ce qui est un *effet* se dessine au
 * code, ce qui est un *objet du monde* se rend en 3D. La pierre qui reste dans
 * le cratere, elle, est un objet — elle a sa planche.
 *
 * L'ombre est la seule chose du jeu qui dise « ici, dans douze secondes ». Elle
 * est donc **lisible avant d'etre belle** : un disque sombre, un anneau laiton
 * qui en marque le bord, et rien d'autre a l'interieur qui pourrait se
 * confondre avec une zone de competence.
 */

export const CLE_OMBRE = "meteore-ombre";
export const CLE_TRAINEE = "meteore-trainee";
export const CLE_POUSSIERE = "meteore-poussiere";

/** Cote de l'ombre, en pixels : elle est mise a l'echelle du cratere. */
export const COTE_OMBRE = 128;
/** Longueur de la trainee, en pixels. */
export const LONGUEUR_TRAINEE = 96;

export function cuireLeMeteore(scene: Phaser.Scene): void {
  graverOmbre(scene);
  graverTrainee(scene);
  graverPoussiere(scene);
}

function graverOmbre(scene: Phaser.Scene): void {
  if (scene.textures.exists(CLE_OMBRE)) return;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  const r = COTE_OMBRE / 2;

  // Le disque : sombre au centre, fondu sur le bord. Huit anneaux suffisent,
  // l'image est ensuite agrandie et le degrade s'adoucit tout seul.
  for (let i = 8; i > 0; i--) {
    const part = i / 8;
    g.fillStyle(C.fer, 0.06 + 0.16 * (1 - part));
    g.fillCircle(r, r, r * part);
  }
  // L'anneau : c'est lui qui dit **ou**, et il doit se voir sur l'herbe comme
  // sur la terre battue.
  g.lineStyle(3, C.laiton, 0.85);
  g.strokeCircle(r, r, r - 3);
  g.generateTexture(CLE_OMBRE, COTE_OMBRE, COTE_OMBRE);
  g.destroy();
}

function graverTrainee(scene: Phaser.Scene): void {
  if (scene.textures.exists(CLE_TRAINEE)) return;
  const L = LONGUEUR_TRAINEE;
  const H = 14;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);

  // La queue : un coin qui s'amincit vers l'arriere (a gauche), en laiton.
  g.fillStyle(C.laiton, 0.55);
  g.fillTriangle(0, H / 2, L - 10, H / 2 - 3.5, L - 10, H / 2 + 3.5);
  // La tete : la pierre en feu. Deux disques, du sang frais vers le blanc
  // chaud — c'est le seul endroit du jeu ou une lumiere blanche se justifie.
  g.fillStyle(C.sangFrais, 1);
  g.fillCircle(L - 7, H / 2, 6.5);
  g.fillStyle(C.laiton, 1);
  g.fillCircle(L - 6, H / 2, 4);
  g.fillStyle(0xfff0cf, 1);
  g.fillCircle(L - 5.5, H / 2, 2);
  g.generateTexture(CLE_TRAINEE, L, H);
  g.destroy();
}

function graverPoussiere(scene: Phaser.Scene): void {
  if (scene.textures.exists(CLE_POUSSIERE)) return;
  const cote = 64;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  // Un anneau epais et mou : agrandi d'un coup a l'impact, il fait le souffle
  // qui part du centre. Une seule image, pas de systeme de particules (§4.17).
  for (let i = 0; i < 5; i++) {
    g.lineStyle(7 - i, C.os, 0.06 + 0.05 * i);
    g.strokeCircle(cote / 2, cote / 2, cote / 2 - 4 - i * 3);
  }
  g.generateTexture(CLE_POUSSIERE, cote, cote);
  g.destroy();
}
