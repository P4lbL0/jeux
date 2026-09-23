import Phaser from "phaser";
import { C } from "../ui/couleurs";
import { EAU, ECORCE, SOUS_BOIS, melanger } from "./palette";

/**
 * Ce que dessinent les six bases elementaires (DESIGN.md §4.13, jalon 6.5,
 * morceau 2b).
 *
 * La regle est celle de l'incendie (`feu.ts`) : **un objet passe par Blender,
 * ce qui n'a ni face ni bord reste au code.**
 *
 * - les **racines** sont un objet — du bois tordu qui sort du sol : leurs trois
 *   images sont rendues par Blender (`npm run sprites -- element-racines`), et
 *   ce qui suit n'est que leur secours sous la meme cle ;
 * - la **boule de feu** reprend les flammes de l'incendie, deja rendues par
 *   Blender : une flamme couchee dans le sens du vol, la pointe en arriere ;
 * - la **flaque**, la **bulle** du Bouclier et le **souffle** du Vent restent au
 *   code : de l'eau a plat comme la mer, une lumiere, un trait d'air. Le rendu
 *   low-poly leur mettrait un contour de fer, et c'est ce qu'il ne faut pas.
 */

/** Les trois images de racines, une par monstre tenu (tirees au hasard). */
export const CLES_RACINES = [0, 1, 2].map((i) => `element-racines-${i}`);
/**
 * Taille d'une touffe de racines, en pixels du monde, et la ligne ou elle touche
 * le sol. ⚠️ Aussi dans `scripts/blender/rendre.py`, qui la rend a cette taille.
 */
export const LARGEUR_RACINES = 24;
export const HAUTEUR_RACINES = 20;
export const PIED_RACINES = 16;

/**
 * La flaque de l'Eau, vue de haut. Presque ronde, comme toutes les zones du jeu :
 * ce qu'on voit mouille est ce qui mouille.
 *
 * ⚠️ **Dessinee plus grande que la plus grande flaque, et toujours reduite.**
 * Premier jet a 64 px : agrandie deux fois au dernier palier, ses pixels
 * etaient deux fois plus gros que ceux du monde autour, et ca se voyait.
 */
export const CLE_FLAQUE = "element-flaque";
export const LARGEUR_FLAQUE = 160;
export const HAUTEUR_FLAQUE = 150;

/** La bulle du Bouclier, autour du heros. */
export const CLE_BULLE = "element-bulle";
export const COTE_BULLE = 40;

/** Un trait d'air de la bourrasque. */
export const CLE_SOUFFLE = "element-souffle";
export const LARGEUR_SOUFFLE = 28;
export const HAUTEUR_SOUFFLE = 5;

/** L'eclat du Bouclier qui se brise. */
export const CLE_ECLAT_BOUCLIER = "element-eclat";

/**
 * La couleur de l'eau qui ruisselle : le ciel sale, le bleu le plus franc des
 * neuf couleurs. ⚠️ Premier jet, juge sur capture : l'eau de la mer melangee au
 * ciel faisait virer les orcs au gris-vert — on ne voyait pas qu'ils etaient
 * mouilles, seulement qu'ils etaient ternes.
 */
export const COULEUR_MOUILLE = C.cielSale;
/** La couleur de la bulle et de ses eclats. */
export const COULEUR_BOUCLIER = C.cielSale;

export function cuireLesElements(scene: Phaser.Scene): void {
  for (let i = 0; i < CLES_RACINES.length; i++) graverRacines(scene, i);
  graverFlaque(scene);
  graverBulle(scene);
  graverSouffle(scene);
  graverEclat(scene);
}

/**
 * Le secours des racines : quatre crocs de bois qui montent et se referment.
 * Blender les remplace (`element-racines-<i>.png`).
 */
function graverRacines(scene: Phaser.Scene, variante: number): void {
  const cle = CLES_RACINES[variante]!;
  if (scene.textures.exists(cle)) return;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  const milieu = LARGEUR_RACINES / 2;
  // La motte retournee.
  g.fillStyle(SOUS_BOIS.sombre, 1);
  g.fillEllipse(milieu, PIED_RACINES, 18, 6);
  const crocs = 4 + (variante % 2);
  for (let i = 0; i < crocs; i++) {
    const t = (i + 0.5) / crocs;
    const x = 3 + t * (LARGEUR_RACINES - 6);
    const vers = (milieu - x) * 0.5;
    const haut = 8 + ((i * 7 + variante * 3) % 5);
    g.lineStyle(3, C.fer, 1);
    g.lineBetween(x, PIED_RACINES, x + vers, PIED_RACINES - haut);
    g.lineStyle(2, i % 2 === 0 ? ECORCE.corps : ECORCE.clair, 1);
    g.lineBetween(x, PIED_RACINES, x + vers, PIED_RACINES - haut);
  }
  g.generateTexture(cle, LARGEUR_RACINES, HAUTEUR_RACINES);
  g.destroy();
}

/**
 * Une flaque : des lobes d'eau qui se chevauchent, un bord sombre, deux reflets.
 * A plat — on la voit de haut, comme la mer.
 */
function graverFlaque(scene: Phaser.Scene): void {
  if (scene.textures.exists(CLE_FLAQUE)) return;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  const cx = LARGEUR_FLAQUE / 2;
  const cy = HAUTEUR_FLAQUE / 2;
  // Tout est trace sur la grille de 64 px du premier jet, puis agrandi d'autant.
  const k = LARGEUR_FLAQUE / 64;
  // Des lobes fixes (une flaque n'est jamais un ovale) : x, y, largeur, hauteur.
  const lobes: [number, number, number, number][] = [
    [0, 0, 50, 44],
    [-14, 6, 30, 32],
    [15, -5, 30, 30],
    [4, 13, 34, 24],
    [-6, -13, 30, 22],
  ];
  g.fillStyle(EAU.sombre, 1);
  for (const [x, y, l, h] of lobes) g.fillEllipse(cx + x * k, cy + y * k, (l + 6) * k, (h + 5) * k);
  g.fillStyle(EAU.corps, 1);
  for (const [x, y, l, h] of lobes) g.fillEllipse(cx + x * k, cy + y * k, l * k, h * k);
  g.fillStyle(melanger(EAU.corps, C.cielSale, 0.35), 1);
  g.fillEllipse(cx + 2 * k, cy + 3 * k, 34 * k, 24 * k);
  // Le ciel qui s'y reflete : deux traits fins, du cote de la lumiere (en haut a gauche).
  g.fillStyle(C.cielSale, 1);
  g.fillRect(cx - 16 * k, cy - 10 * k, 9 * k, 3);
  g.fillRect(cx - 5 * k, cy - 14 * k, 5 * k, 3);
  g.generateTexture(CLE_FLAQUE, LARGEUR_FLAQUE, HAUTEUR_FLAQUE);
  g.destroy();
}

/** La bulle : un anneau net, un voile a peine, et un reflet en haut a gauche. */
function graverBulle(scene: Phaser.Scene): void {
  if (scene.textures.exists(CLE_BULLE)) return;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  const r = COTE_BULLE / 2;
  g.fillStyle(0xffffff, 0.12);
  g.fillCircle(r, r, r - 2);
  g.lineStyle(2, 0xffffff, 0.85);
  g.strokeCircle(r, r, r - 2);
  g.lineStyle(2, 0xffffff, 1);
  g.beginPath();
  g.arc(r, r, r - 7, Math.PI * 1.05, Math.PI * 1.35, false);
  g.strokePath();
  g.generateTexture(CLE_BULLE, COTE_BULLE, COTE_BULLE);
  g.destroy();
}

/** Un trait d'air : effile aux deux bouts, plus epais au milieu. */
function graverSouffle(scene: Phaser.Scene): void {
  if (scene.textures.exists(CLE_SOUFFLE)) return;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  const m = HAUTEUR_SOUFFLE / 2;
  g.fillStyle(0xffffff, 1);
  g.fillTriangle(0, m, LARGEUR_SOUFFLE * 0.6, m - 2, LARGEUR_SOUFFLE * 0.6, m + 2);
  g.fillTriangle(LARGEUR_SOUFFLE, m, LARGEUR_SOUFFLE * 0.6, m - 2, LARGEUR_SOUFFLE * 0.6, m + 2);
  g.generateTexture(CLE_SOUFFLE, LARGEUR_SOUFFLE, HAUTEUR_SOUFFLE);
  g.destroy();
}

/** Un eclat de l'ecran brise : un petit losange blanc, teinte a l'emission. */
function graverEclat(scene: Phaser.Scene): void {
  if (scene.textures.exists(CLE_ECLAT_BOUCLIER)) return;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.fillStyle(0xffffff, 1);
  g.fillTriangle(3, 0, 6, 3, 3, 6);
  g.fillTriangle(3, 0, 0, 3, 3, 6);
  g.generateTexture(CLE_ECLAT_BOUCLIER, 6, 6);
  g.destroy();
}
