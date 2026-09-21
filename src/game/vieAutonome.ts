import Phaser from "phaser";
import {
  CLE_BULLE_CHOPE,
  CLE_BULLE_COEUR,
  CLE_BULLE_SUEUR,
  cuireLesBulles,
} from "./dessin/bulles";
import { REGLAGES_VIE, type Bulle } from "../core/vieAutonome";

/**
 * Les bulles de la vie autonome, cote ecran (DESIGN.md §4.27).
 *
 * ⚠️ **Un pool cree une fois, et rien de fabrique en jeu.** C'est la contrainte
 * que le §4.27 pose en toutes lettres et que le §4.17 repete : « Aucun objet
 * Texte n'est fabrique en jeu, jamais. » Ici ce ne sont meme pas des textes,
 * mais des images de douze pixels — et elles sont **recyclees**, pas creees.
 *
 * Douze a l'ecran au maximum. Au-dela, la plus vieille se rend : un village de
 * trente habitants qui se croisent tous en meme temps ferait une pluie de
 * coeurs, ce qui est exactement le bruit que la section veut eviter.
 */

const CLES: Record<Bulle, string> = {
  coeur: CLE_BULLE_COEUR,
  sueur: CLE_BULLE_SUEUR,
  chope: CLE_BULLE_CHOPE,
};

/** Combien de bulles peuvent flotter en meme temps. */
const BULLES_MAX = 12;

/** Combien de temps une bulle monte avant de disparaitre, en millisecondes. */
const DUREE = 1400;

interface BulleVivante {
  image: Phaser.GameObjects.Image;
  jusqua: number;
  depart: number;
}

export class Bulles {
  private readonly pool: Phaser.GameObjects.Image[] = [];
  private readonly vivantes: BulleVivante[] = [];
  /** Quand chacun aura de nouveau le droit d'en emettre une */
  private readonly repos = new Map<number, number>();

  constructor(scene: Phaser.Scene) {
    cuireLesBulles(scene);
    for (let i = 0; i < BULLES_MAX; i++) {
      this.pool.push(
        scene.add
          .image(0, 0, CLE_BULLE_CHOPE)
          .setVisible(false)
          .setOrigin(0.5, 1)
          .setDepth(100_000),
      );
    }
  }

  /**
   * Quelqu'un en emet une, s'il en a le droit.
   *
   * @param qui l'identifiant de l'habitant : c'est lui qui porte le repos
   * @returns faux s'il vient d'en emettre une — on ne fait pas de guirlande
   */
  emettre(qui: number, genre: Bulle, x: number, y: number, maintenant: number): boolean {
    if ((this.repos.get(qui) ?? 0) > maintenant) return false;
    this.repos.set(qui, maintenant + REGLAGES_VIE.reposEntreDeuxBulles);

    const image = this.prendre(maintenant);
    if (!image) return false;
    image
      .setTexture(CLES[genre])
      .setPosition(x, y)
      .setAlpha(1)
      .setVisible(true)
      .setDepth(y + 1000);
    this.vivantes.push({ image, jusqua: maintenant + DUREE, depart: y });
    return true;
  }

  /**
   * Les bulles montent et s'effacent.
   *
   * ⚠️ Deux reglages de proprietes par bulle et par image, jamais un objet
   * cree ni detruit. Douze bulles au maximum : le cout est borne par
   * construction, pas par la chance.
   */
  majorer(maintenant: number): void {
    for (let i = this.vivantes.length - 1; i >= 0; i--) {
      const bulle = this.vivantes[i]!;
      const reste = (bulle.jusqua - maintenant) / DUREE;
      if (reste <= 0) {
        bulle.image.setVisible(false);
        this.vivantes.splice(i, 1);
        continue;
      }
      bulle.image.setY(bulle.depart - (1 - reste) * 18);
      // Elle s'efface sur le dernier tiers : disparaitre d'un coup se remarque.
      bulle.image.setAlpha(Math.min(1, reste * 3));
    }
  }

  /** Une nouvelle partie : plus rien ne flotte. */
  vider(): void {
    for (const bulle of this.vivantes) bulle.image.setVisible(false);
    this.vivantes.length = 0;
    this.repos.clear();
  }

  detruire(): void {
    for (const image of this.pool) image.destroy();
    this.pool.length = 0;
    this.vivantes.length = 0;
  }

  /** La plus vieille se rend quand il n'y a plus de place. */
  private prendre(maintenant: number): Phaser.GameObjects.Image | null {
    const libre = this.pool.find((image) => !image.visible);
    if (libre) return libre;

    let plusVieille = 0;
    for (let i = 1; i < this.vivantes.length; i++) {
      if (this.vivantes[i]!.jusqua < this.vivantes[plusVieille]!.jusqua) plusVieille = i;
    }
    const reprise = this.vivantes[plusVieille];
    if (!reprise) return null;
    this.vivantes.splice(plusVieille, 1);
    void maintenant;
    return reprise.image;
  }
}
