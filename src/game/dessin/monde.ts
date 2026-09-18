import type Phaser from "phaser";
import { ORDRE_CLASSES, type ClassId } from "../../core/classes";
import { cuireLesBatiments } from "./batiments";
import { cuireLaCarte } from "./carte";
import { cuireLeDecor } from "./decor";
import { cuire, type Cuisson } from "./four";
import { familleDeHero, hero } from "./heros";
import { cuireLaMer } from "./mer";
import { cuireLesMurs } from "./murs";
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
 * ⚠️ **Les batiments et le decor viennent de Blender** depuis le 18 septembre
 * 2026 (`scripts/blender/`, charges par `BootScene`) : leurs cles existent deja
 * quand ce fichier passe, et chaque cuisson les saute. Ce qui est cuit ici
 * pour eux n'est plus qu'un secours. La carte, les murs, la mer et tous les
 * personnages restent dessines par le code.
 */
export function cuireLeMonde(scene: Phaser.Scene): void {
  cuireLaCarte(scene);
  cuireLesSols(scene);
  cuireLeDecor(scene);
  cuireLesBatiments(scene);
  cuireLesMurs(scene);
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
