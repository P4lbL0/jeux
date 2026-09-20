import Phaser from "phaser";
import { PORT } from "../core/carte";
import { Port, REGLAGES_PORT } from "../core/port";
import { CHANTIERS, CLES_PORT } from "./dessin/batiments";

/**
 * Le port a l'ecran (DESIGN.md §4.18).
 *
 * Beaucoup plus simple que l'eglise, et pour une raison de design : **il ne peut
 * pas tomber**. Il est adosse au flanc ferme de l'ouest (§4.6), donc pas de
 * points de vie, pas de corps physique, pas de teinte d'encaissement. Ce qu'il
 * a en propre, c'est une **voile** qui parait et qui repart.
 *
 * Les regles (le chantier, les cours, la vente) sont dans `core/port.ts` et
 * testees. Ici il n'y a que trois sprites et une arrivee en fondu.
 */

/** Ce que la scene a besoin de savoir quand le port change d'etat. */
export interface EchosPort {
  annoncer: (message: string) => void;
}

/** Distance a laquelle on peut travailler au port, en pixels. */
export const PORTEE_PORT = 90;

/** Un point a `distance` pixels du quai, vers le large — la ou l'eau est, quel que soit le monde. */
function auLarge(distance: number): { x: number; y: number } {
  return { x: PORT.x + PORT.versLeLarge.x * distance, y: PORT.y + PORT.versLeLarge.y * distance };
}

export class BatimentPort {
  /** Les regles pures. Tout ce qui se decide se decide la-dedans. */
  readonly regles = new Port();

  private readonly sprite: Phaser.GameObjects.Image;
  /** L'echafaudage, visible tant que le chantier dure (§4.30, chantiers) */
  private readonly echafaudage: Phaser.GameObjects.Image;
  /** La voile, cachee tant qu'aucun navire n'est a quai */
  private readonly navire: Phaser.GameObjects.Image;
  private readonly echos: EchosPort;

  constructor(scene: Phaser.Scene, echos: EchosPort) {
    this.echos = echos;

    this.sprite = scene.add.image(PORT.x, PORT.y, CLES_PORT.ruine);
    // Comme tout le decor : la profondeur suit le pied du sprite, pour qu'un
    // personnage qui passe devant passe bien devant.
    this.sprite.setOrigin(0.5, 0.85).setDepth(PORT.y);

    // Le chantier se voit : des perches et des planches par-dessus la ruine,
    // le temps qu'il dure. Meme origine que le port, pour tomber au meme pied.
    this.echafaudage = scene.add
      .image(PORT.x, PORT.y, CHANTIERS.port.cle)
      .setOrigin(0.5, 0.85)
      .setDepth(PORT.y + 1)
      .setVisible(false);

    // Le navire mouille **au large**, du cote de l'eau : c'est ce qui montre
    // d'ou il vient. Il n'a aucun corps — on ne monte pas dessus.
    const quai = auLarge(74);
    this.navire = scene.add
      .image(quai.x, quai.y - 6, CLES_PORT.navire)
      .setOrigin(0.5, 0.9)
      .setDepth(PORT.y - 8)
      .setVisible(false);

    this.redessiner();
  }

  get debout(): boolean {
    return this.regles.debout;
  }

  get navireAQuai(): boolean {
    return this.regles.navireAQuai;
  }

  /** Est-on assez pres pour commercer ? */
  aPortee(x: number, y: number): boolean {
    return Phaser.Math.Distance.Between(x, y, PORT.x, PORT.y) <= PORTEE_PORT;
  }

  lancerLeChantier(stocks: Parameters<Port["lancerLeChantier"]>[0]): boolean {
    if (!this.regles.lancerLeChantier(stocks)) return false;
    this.echos.annoncer("Le chantier du port commence — une demi-journee");
    this.redessiner();
    return true;
  }

  /** @returns vrai s'il vient de se mettre debout */
  majorer(delta: number): boolean {
    if (!this.regles.majorer(delta)) return false;
    this.echos.annoncer("Le port est ouvert — une voile finira par paraitre");
    this.redessiner();
    return true;
  }

  /**
   * Une voile parait.
   *
   * Elle glisse depuis le large plutot que d'apparaitre : c'est le seul
   * evenement heureux du jeu, et il merite qu'on le voie venir.
   */
  accoster(scene: Phaser.Scene): void {
    if (!this.regles.debout || this.regles.navireAQuai) return;

    this.regles.navireAQuai = true;
    const loin = auLarge(140);
    const quai = auLarge(74);
    this.navire.setVisible(true).setAlpha(0).setPosition(loin.x, loin.y - 6);
    scene.tweens.add({
      targets: this.navire,
      x: quai.x,
      y: quai.y - 6,
      alpha: 1,
      duration: 2400,
      ease: "Sine.easeOut",
    });
    this.echos.annoncer("Une voile a l'horizon — un navire accoste");
  }

  /** Il repart, avec ou sans cargaison. */
  appareiller(scene: Phaser.Scene): void {
    if (!this.regles.navireAQuai) return;

    this.regles.navireAQuai = false;
    const loin = auLarge(160);
    scene.tweens.add({
      targets: this.navire,
      x: loin.x,
      y: loin.y - 6,
      alpha: 0,
      duration: 2000,
      ease: "Sine.easeIn",
      onComplete: () => this.navire.setVisible(false),
    });
  }

  /** Il reprend l'etat d'une sauvegarde (§4.28). */
  reprendre(...etat: Parameters<Port["reprendre"]>): void {
    this.regles.reprendre(...etat);
    // Un navire ne se sauvegarde pas : c'est un instant, pas un etat. Il
    // reparaitra quand le village sera calme, ce qui est exactement la regle.
    this.regles.navireAQuai = false;
    this.navire.setVisible(false);
    this.redessiner();
  }

  /**
   * Le sprite suit l'etat.
   *
   * Appelee **seulement quand quelque chose change** — jamais par image, le
   * §4.17 est formel la-dessus.
   */
  private redessiner(): void {
    this.sprite.setTexture(this.regles.debout ? CLES_PORT.debout : CLES_PORT.ruine);
    // Un chantier en cours se voit : l'echafaudage est dresse sur la ruine.
    this.sprite.setAlpha(this.regles.etat === "ruine" ? 0.7 : 1);
    this.echafaudage.setVisible(this.regles.etat === "chantier");
  }

  /** Ce qu'il faut encore pour le relever, ecrit pour un humain. */
  static coutLisible(): string {
    return `${REGLAGES_PORT.cout.bois} bois`;
  }
}
