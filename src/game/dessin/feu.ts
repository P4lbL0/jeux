import Phaser from "phaser";
import { C } from "../ui/couleurs";
import { melanger } from "./palette";

/**
 * Le feu qui brule (DESIGN.md §4.21, l'incendie).
 *
 * > **Ce qu'on voit** : des flammes animees (trois images alternees) et une
 * > lueur chaude qui respire **au-dessus du voile de nuit** — un seul objet par
 * > feu, rien par image.
 *
 * Trois silhouettes, pas une animation lisse : a cette taille, trois images qui
 * alternent donnent le meme tremblement qu'une vraie flamme pour le prix de
 * trois textures cuites une fois (§4.17, regle 3). Elles sont **dans la
 * palette** — laiton, sang frais, sang seche —, ce qui les rattache au reste du
 * village au lieu d'en faire un effet special de moteur.
 *
 * ⚠️ **La lueur passe par-dessus la nuit**, comme l'eclair d'orage : c'est tout
 * l'interet d'un feu la nuit, et un feu sous le voile ne se verrait pas de
 * loin. Elle est en lumiere **additive** — elle eclaire les ombres sans ecraser
 * ce qui est deja clair.
 *
 * Ces dessins sont **le secours** : un PNG de `src/assets/` portant la meme cle
 * les remplace (`assets.ts`), et c'est ce que fera Blender.
 */

/** Les trois images de flamme, dans l'ordre ou elles alternent. */
export const CLES_FLAMME = [0, 1, 2].map((i) => `feu-flamme-${i}`);

/** La lueur chaude posee sous la flamme, en lumiere additive. */
export const CLE_LUEUR = "feu-lueur";

/**
 * La bouffee de fumee, et la braise qui monte (23 septembre 2026).
 *
 * ⚠️ **Elles restent dessinees au code, et c'est volontaire** alors que tout ce
 * qui se voit passe par Blender. Le rendu low-poly range chaque pixel dans les
 * trois tons de sa matiere et l'entoure d'un contour de fer : c'est ce qu'il
 * faut a un objet, et c'est exactement ce qu'il ne faut pas a une fumee, qui
 * n'a ni face ni bord. Elles sont de la meme famille que la lueur, qui est au
 * code pour la meme raison.
 */
export const CLES_FUMEE = [0, 1, 2].map((i) => `feu-fumee-${i}`);
export const CLE_ETINCELLE = "feu-etincelle";

/**
 * Le repere qui pointe un feu sorti de l'ecran (§4.21, l'alerte).
 *
 * **Deux images et pas une** : la pastille dit *ce que c'est*, la pointe dit
 * *ou c'est*. Une seule image qui tournerait ferait tourner la flamme avec
 * elle, et une flamme a l'envers ne ressemble plus a rien.
 */
export const CLE_REPERE = "feu-repere";
export const CLE_REPERE_POINTE = "feu-repere-pointe";

/**
 * Cote du repere, en pixels d'interface.
 *
 * Quarante-quatre, et pas vingt-six : mesure a l'ecran le 22 septembre 2026, un
 * repere de vingt-six pixels se perd dans les arbres du bord de carte. Il doit
 * se voir **sans qu'on le cherche**, puisque c'est tout ce qui dit qu'un
 * quartier brule hors champ.
 */
export const COTE_REPERE = 44;

/** Taille d'une flamme, en pixels du monde. */
export const LARGEUR_FLAMME = 22;
export const HAUTEUR_FLAMME = 30;

/** Diametre de la lueur. Large et molle : c'est une lumiere, pas un halo net. */
export const COTE_LUEUR = 96;

/**
 * Taille d'une bouffee de fumee a l'echelle 1, et d'une braise.
 *
 * ⚠️ La fumee est aussi dans `scripts/blender/rendre.py`, qui la rend a cette
 * taille : les deux doivent bouger ensemble.
 */
export const LARGEUR_FUMEE = 46;
export const HAUTEUR_FUMEE = 40;
export const COTE_ETINCELLE = 6;

/**
 * La couleur de la fumee : du fer monte d'un tiers vers l'os.
 *
 * Assez clair pour se voir sur un toit d'ardoise, assez sombre pour se voir sur
 * une prairie — c'est le seul endroit du jeu ou une couleur doit se detacher
 * des **deux** cotes a la fois.
 */
const FUMEE = melanger(C.fer, C.os, 0.32);

/** Millisecondes entre deux images de flamme. */
export const CADENCE_FLAMME = 110;

export function cuireLeFeu(scene: Phaser.Scene): void {
  for (let i = 0; i < CLES_FLAMME.length; i++) graverFlamme(scene, i);
  graverLueur(scene);
  for (let i = 0; i < CLES_FUMEE.length; i++) graverFumee(scene, i);
  graverEtincelle(scene);
  graverRepere(scene);
  graverPointe(scene);
}

/**
 * Le repere de bord d'ecran : une pointe, et une flamme dedans.
 *
 * ⚠️ **En laiton, pas en sang frais.** Le sang frais est la couleur du danger
 * et de lui seul (§4.11) — une horde, un heros qui va mourir. Un feu est une
 * urgence d'une autre nature : on doit pouvoir distinguer d'un coup d'oeil un
 * bord d'ecran qui dit « ils arrivent » d'un bord d'ecran qui dit « ca brule
 * la-bas ». La pointe regarde vers la droite : c'est l'angle qui la tourne.
 */
function graverRepere(scene: Phaser.Scene): void {
  if (scene.textures.exists(CLE_REPERE)) return;

  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  const m = COTE_REPERE / 2;
  // Tout est en parts du cote : changer `COTE_REPERE` suffit a redimensionner
  // le repere entier, sans reprendre douze nombres a la main.
  const u = COTE_REPERE / 26;

  // Le fond sombre : sur un village clair de jour, une pointe laiton seule se
  // perdrait dans le ble.
  g.fillStyle(C.fer, 0.82);
  g.fillCircle(m, m, m - u);
  g.fillStyle(C.laiton, 0.9);
  g.lineStyle(1.5 * u, C.laiton, 0.9);
  g.strokeCircle(m, m, m - u);

  // La flamme dans la pastille : deux langues, assez grosses pour se lire d'un
  // coup d'oeil au bord de l'ecran.
  g.fillStyle(C.sangFrais, 1);
  g.fillTriangle(m - 5 * u, m + 6 * u, m + 1 * u, m + 6 * u, m - 2 * u, m - 7 * u);
  g.fillStyle(C.laiton, 1);
  g.fillTriangle(m - 4 * u, m + 6 * u, m - 0.5 * u, m + 6 * u, m - 2.5 * u, m - u);

  g.generateTexture(CLE_REPERE, COTE_REPERE, COTE_REPERE);
  g.destroy();
}

/**
 * La pointe : un chevron qui regarde vers la droite, que l'interface tourne.
 *
 * Elle vit dans sa propre texture parce qu'elle est la seule chose du repere
 * qui ait le droit de tourner.
 */
function graverPointe(scene: Phaser.Scene): void {
  if (scene.textures.exists(CLE_REPERE_POINTE)) return;

  const cote = COTE_REPERE;
  const m = cote / 2;
  const u = cote / 26;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.fillStyle(C.fer, 0.82);
  g.fillTriangle(cote - u, m, cote - 10 * u, m - 8 * u, cote - 10 * u, m + 8 * u);
  g.fillStyle(C.laiton, 1);
  g.fillTriangle(cote - 2.5 * u, m, cote - 9.5 * u, m - 6 * u, cote - 9.5 * u, m + 6 * u);
  g.generateTexture(CLE_REPERE_POINTE, cote, cote);
  g.destroy();
}

/**
 * Une flamme : trois langues qui montent, et un coeur clair.
 *
 * L'index penche la silhouette — droite, a gauche, a droite — pour que
 * l'alternance ressemble a du vent et pas a un clignotement.
 */
function graverFlamme(scene: Phaser.Scene, index: number): void {
  const cle = CLES_FLAMME[index]!;
  if (scene.textures.exists(cle)) return;

  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  const milieu = LARGEUR_FLAMME / 2;
  const pied = HAUTEUR_FLAMME;
  // Le vent : nul au centre, un pixel et demi de chaque cote. C'est peu, et
  // c'est exactement ce qu'il faut pour que l'oeil lise un mouvement.
  const vent = [1.5, -1.5, 0.4][index]!;
  const hauteur = [1, 0.88, 0.96][index]!;

  // La braise : une base sombre et large, qui accroche la flamme au toit.
  g.fillStyle(C.sangSeche, 1);
  g.fillEllipse(milieu, pied - 3, LARGEUR_FLAMME - 4, 8);

  // Le corps, en sang frais : une langue qui part du pied et se termine en
  // pointe, plus deux petites sur les cotes.
  g.fillStyle(C.sangFrais, 1);
  langue(g, milieu, pied - 2, LARGEUR_FLAMME - 6, (HAUTEUR_FLAMME - 4) * hauteur, vent);
  langue(g, milieu - 6, pied - 3, 7, 12 * hauteur, vent - 1);
  langue(g, milieu + 6, pied - 3, 7, 11 * hauteur, vent + 1);

  // Le coeur, en laiton : la moitie de la hauteur, decalee par le vent.
  g.fillStyle(C.laiton, 1);
  langue(g, milieu + vent * 0.6, pied - 3, 8, (HAUTEUR_FLAMME - 12) * hauteur, vent);

  // Le point blanc de la base : une seule tache, sinon la flamme devient une
  // lampe et perd sa couleur.
  g.fillStyle(0xfff0cf, 1);
  g.fillEllipse(milieu + vent * 0.4, pied - 7, 5, 7);

  g.generateTexture(cle, LARGEUR_FLAMME, HAUTEUR_FLAMME);
  g.destroy();
}

/**
 * Une langue de feu : un triangle dont la pointe part avec le vent, adouci par
 * un disque a sa base. Deux formes, et ca tient a vingt pixels.
 */
function langue(
  g: Phaser.GameObjects.Graphics,
  x: number,
  pied: number,
  largeur: number,
  hauteur: number,
  vent: number,
): void {
  g.fillTriangle(x - largeur / 2, pied, x + largeur / 2, pied, x + vent * 2, pied - hauteur);
  g.fillEllipse(x, pied - largeur / 4, largeur, largeur / 1.6);
}

/**
 * La lueur : des anneaux concentriques de plus en plus faibles.
 *
 * Un degrade radial coute un `createRadialGradient` sur un canvas et un aller
 * simple par le contexte 2D ; a seize anneaux, l'oeil ne voit pas la
 * difference une fois l'image agrandie et floutee par l'echelle.
 */
function graverLueur(scene: Phaser.Scene): void {
  if (scene.textures.exists(CLE_LUEUR)) return;

  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  const rayon = COTE_LUEUR / 2;
  const anneaux = 16;
  for (let i = anneaux; i > 0; i--) {
    const part = i / anneaux;
    // L'alpha decroit vite au bord : une lueur a bord franc fait une bulle.
    g.fillStyle(C.laiton, 0.055 * (1 - part) ** 0.6 + 0.01);
    g.fillCircle(rayon, rayon, rayon * part);
  }
  g.generateTexture(CLE_LUEUR, COTE_LUEUR, COTE_LUEUR);
  g.destroy();
}

/**
 * Une bouffee de fumee : trois lobes de cercles concentriques.
 *
 * ⚠️ **Trois lobes et pas un disque.** Un disque flou monte comme une bulle de
 * savon ; trois lobes decentres donnent un bord irregulier, et c'est tout ce
 * qu'il faut pour que l'oeil lise de la fumee. Ils se recouvrent, donc les
 * alphas s'ajoutent — le coeur de la bouffee sort plus dense que ses bords sans
 * qu'on ait a le calculer.
 */
function graverFumee(scene: Phaser.Scene, index: number): void {
  const cle = CLES_FUMEE[index]!;
  if (scene.textures.exists(cle)) return;

  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  const u = LARGEUR_FUMEE / 46;
  // Trois dispositions, une par variante : ce qui monte d'un toit ne doit pas
  // monter deux fois de la meme facon.
  const lobes = [
    [
      { x: 23, y: 20, r: 11 },
      { x: 13, y: 24, r: 8 },
      { x: 33, y: 23, r: 7.5 },
      { x: 25, y: 11, r: 6 },
    ],
    [
      { x: 22, y: 21, r: 10.5 },
      { x: 32, y: 25, r: 8.5 },
      { x: 13, y: 26, r: 7 },
      { x: 19, y: 11, r: 6.5 },
    ],
    [
      { x: 24, y: 22, r: 10 },
      { x: 14, y: 21, r: 8.5 },
      { x: 32, y: 27, r: 7.5 },
      { x: 27, y: 12, r: 7 },
    ],
  ][index]!;
  const anneaux = 10;
  for (const lobe of lobes) {
    for (let i = anneaux; i > 0; i--) {
      g.fillStyle(FUMEE, 0.055);
      g.fillCircle(lobe.x * u, lobe.y * u, (lobe.r * u * i) / anneaux);
    }
  }
  g.generateTexture(cle, LARGEUR_FUMEE, HAUTEUR_FUMEE);
  g.destroy();
}

/**
 * Une braise qui monte : un point de laiton, un halo de sang frais.
 *
 * Six pixels de cote, et la moitie est du halo. C'est le plus petit objet du
 * jeu, et il est en lumiere additive comme la lueur : une braise est de la
 * lumiere qui monte, pas un caillou orange.
 */
function graverEtincelle(scene: Phaser.Scene): void {
  if (scene.textures.exists(CLE_ETINCELLE)) return;

  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  const m = COTE_ETINCELLE / 2;
  g.fillStyle(C.sangFrais, 0.45);
  g.fillCircle(m, m, m);
  g.fillStyle(C.laiton, 0.85);
  g.fillCircle(m, m, m * 0.55);
  g.generateTexture(CLE_ETINCELLE, COTE_ETINCELLE, COTE_ETINCELLE);
  g.destroy();
}
