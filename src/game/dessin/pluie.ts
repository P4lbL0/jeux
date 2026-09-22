import Phaser from "phaser";
import { Rng } from "../../core/rng";
import { C } from "../ui/couleurs";

/**
 * Les rideaux de pluie (DESIGN.md §4.21).
 *
 * ⚠️ **Jamais une goutte par goutte.** La regle 1 du §4.17 (tout ce qui parait
 * a un plafond) et la regle 3 (aucun objet cree en plein jeu) interdisent un
 * systeme de particules qui en ferait naitre des centaines par seconde. On
 * cuit donc **deux tuiles** une fois pour toutes, et le jeu ne fait plus que
 * les faire defiler : deux objets pour toute la pluie du jeu, quelle que soit
 * la taille de la fenetre.
 *
 * Les deux rideaux ne different que par la taille et la vitesse des traits —
 * c'est ce qui donne la profondeur sans coder de profondeur : le proche file,
 * le lointain traine.
 *
 * Elles sont **tuilables dans les deux sens** : un trait qui deborde est
 * redessine de l'autre cote, sinon le defilement montrerait une couture toutes
 * les cent vingt-huit images.
 */

export const CLE_PLUIE_PRES = "pluie-pres";
export const CLE_PLUIE_LOIN = "pluie-loin";

/** Cote d'une tuile de pluie, en pixels. */
export const COTE_TUILE = 128;

/** L'inclinaison des traits : la pluie ne tombe jamais tout a fait droit. */
const PENTE = 0.22;

export function cuireLesRideaux(scene: Phaser.Scene): void {
  // Le proche : des traits longs et clairs, peu nombreux — ils passent vite,
  // et trop nombreux ils feraient un grillage.
  //
  // ⚠️ Les nombres viennent d'une capture, pas d'une intuition : la premiere
  // version (26 et 54 traits) donnait une averse qu'on ne voyait pas sur une
  // image fixe. Doubles, puis relus sur capture.
  graver(scene, CLE_PLUIE_PRES, 1, (g, rng) => {
    for (let i = 0; i < 52; i++) {
      trait(g, rng.range(0, COTE_TUILE), rng.range(0, COTE_TUILE), rng.range(14, 24), 1.6, 0.62);
    }
  });

  // Le lointain : des traits courts, fins et pales. C'est lui qui fait la masse
  // d'eau ; le proche ne fait que la vitesse.
  graver(scene, CLE_PLUIE_LOIN, 2, (g, rng) => {
    for (let i = 0; i < 115; i++) {
      trait(g, rng.range(0, COTE_TUILE), rng.range(0, COTE_TUILE), rng.range(6, 12), 1, 0.42);
    }
  });
}

/**
 * Un trait de pluie, redessine de l'autre cote quand il deborde : c'est ce qui
 * rend la tuile raccordable a elle-meme, en haut comme sur les cotes.
 */
function trait(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  longueur: number,
  epaisseur: number,
  opacite: number,
): void {
  g.lineStyle(epaisseur, C.cielSale, opacite);
  for (const decalageY of [0, -COTE_TUILE, COTE_TUILE]) {
    for (const decalageX of [0, -COTE_TUILE, COTE_TUILE]) {
      const depart = { x: x + decalageX, y: y + decalageY };
      // Hors tuile et hors de portee d'un debordement : rien a tracer.
      if (depart.y > COTE_TUILE || depart.y + longueur < 0) continue;
      if (depart.x > COTE_TUILE || depart.x + longueur * PENTE < 0) continue;
      g.lineBetween(depart.x, depart.y, depart.x + longueur * PENTE, depart.y + longueur);
    }
  }
}

function graver(
  scene: Phaser.Scene,
  cle: string,
  graine: number,
  trace: (g: Phaser.GameObjects.Graphics, rng: Rng) => void,
): void {
  if (scene.textures.exists(cle)) return;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  // Une graine fixe : le rideau est le meme d'une partie a l'autre, comme tout
  // ce qui est dessine par le code (§4.30).
  trace(g, new Rng(graine));
  g.generateTexture(cle, COTE_TUILE, COTE_TUILE);
  g.destroy();
}
