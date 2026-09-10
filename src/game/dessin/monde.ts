import type Phaser from "phaser";
import { ORDRE_CLASSES, type ClassId } from "../../core/classes";
import { cuireLesBatiments } from "./batiments";
import { cuireLaCarte } from "./carte";
import { cuireLeDecor } from "./decor";
import { cuire, type Cuisson } from "./four";
import { familleDeHero, hero } from "./heros";
import { cuireLaMer } from "./mer";
import { tousLesMonstres } from "./monstres";
import { cuireLesSols } from "./sol";
import { familleDeVillageois, villageois, type Corps, type MetierDessine } from "./villageois";

/**
 * Le monde entier, cuit au demarrage (DESIGN.md §4.30, §4.17 regle 3).
 *
 * **Un seul appel, et tout ce qui se voit existe.** La carte, le decor, les
 * batiments, la mer, les monstres, les heros de depart. Chaque cuisson est
 * gardee par l'existence de sa texture : rappeler cette fonction depuis une
 * autre scene ne recuit rien — les textures de Phaser sont globales au jeu.
 *
 * ⚠️ **Il n'y a plus de PNG.** Les trente sprites et les quatre-vingt-quatre
 * animations generees par l'API en aout ont ete jetes le 10 septembre 2026 : ils
 * masquaient le moteur de dessin, et « le PNG gagne toujours » etait devenu le
 * piege qui rendait invisible tout ce qui avait ete fait. Ce fichier est
 * desormais **la seule source des textures du monde**.
 */
export function cuireLeMonde(scene: Phaser.Scene): void {
  cuireLaCarte(scene);
  cuireLesSols(scene);
  cuireLeDecor(scene);
  cuireLesBatiments(scene);
  cuireLaMer(scene);

  for (const modele of tousLesMonstres()) cuire(scene, modele);
  // Les sept classes au palier 0 : ce sont les portraits des ecrans
  // d'avant-partie et de la barre de heros, il les faut avant de jouer.
  for (const classe of ORDRE_CLASSES) cuire(scene, hero(classe, 0));
}

/** La cle de texture d'une planche cuite, et la frame qui sert de portrait. */
export interface Portrait {
  texture: string;
  frame: number;
}

/** La planche d'une famille cuite par le four. */
export function plancheDe(famille: string): string {
  return `${famille}-planche`;
}

/**
 * Le heros d'une classe et d'un palier, cuit si besoin.
 *
 * **A la demande** : cuire les trente-cinq combinaisons au demarrage serait
 * payer d'avance des sprites que la partie ne verra peut-etre jamais (§4.30).
 */
export function assurerHero(scene: Phaser.Scene, classe: ClassId, palier: number): Cuisson {
  return cuire(scene, hero(classe, palier));
}

/** Le portrait d'un heros : la premiere frame de sa planche au repos. */
export function portraitDeHero(scene: Phaser.Scene, classe: ClassId, palier = 0): Portrait {
  assurerHero(scene, classe, palier);
  return { texture: plancheDe(familleDeHero(classe, palier)), frame: 0 };
}

/**
 * Le villageois d'un metier, dans un etat du corps, cuit si besoin.
 *
 * Une planche par (metier, cran d'usure, sang) : elle ne se cuit que quand un
 * habitant y arrive, jamais toutes d'avance.
 */
export function assurerVillageois(scene: Phaser.Scene, metier: MetierDessine, corps: Corps): string {
  const famille = familleDeVillageois(metier, corps);
  if (!scene.textures.exists(plancheDe(famille))) cuire(scene, villageois(metier, corps));
  return famille;
}
