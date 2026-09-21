import Phaser from "phaser";
import type { Stocks } from "../../core/habitants";
import { NOMS_RESSOURCE, RESSOURCES } from "../../core/habitants";
import { T, cadre, espacer, teindre, texte, type Plaque } from "./chrome";
import { largeurEcran } from "./ecran";

/**
 * Ce qu'on porte sur la route, en haut a droite (DESIGN.md §4.31, §4.10).
 *
 * **Il prend exactement la place du compteur du village**, et pour une raison
 * simple : les deux ne coexistent jamais. Tant qu'on marche il n'y a ni jour,
 * ni population, ni survie a compter (§4.29) ; le jour ou l'on s'installe, il
 * n'y a plus de route. Un seul coin, deux etats du jeu.
 *
 * ⚠️ **Sans lui, tout le §4.31 serait invisible.** L'or n'est affiche nulle
 * part en dehors du panneau du port, et le port n'existe pas encore quand on
 * erre : on aurait ramasse cent quatre-vingts pieces sur une route sans jamais
 * en voir une seule. Une recompense qu'on ne voit pas ne recompense rien.
 *
 * Il ne dit que **deux choses**, et pas une de plus — ni le nombre de caches
 * restantes, ni leur direction : chercher fait partie du chemin, et la minimap
 * a ete ecartee pour cette raison exacte (§4.10).
 */

const LARGEUR = 210;
const HAUTEUR = 56;
const MARGE = 16;

export class PanneauRoute {
  private readonly fond: Phaser.GameObjects.Graphics;
  private readonly bourse: Phaser.GameObjects.Text;
  private readonly sac: Phaser.GameObjects.Text;

  private largeurEcran = -1;
  private visible = true;

  constructor(private readonly scene: Phaser.Scene) {
    this.fond = scene.add.graphics().setDepth(1002).setScrollFactor(0);
    this.bourse = texte(scene, 0, 0, 12, T.laiton).setDepth(1003).setScrollFactor(0);
    this.sac = texte(scene, 0, 0, 10, T.osMat).setDepth(1003).setScrollFactor(0);
    this.placer();
  }

  private placer(): void {
    const x = largeurEcran(this.scene) - MARGE - LARGEUR;
    const y = MARGE;
    const p: Plaque = { x, y, largeur: LARGEUR, hauteur: HAUTEUR };

    this.fond.clear();
    cadre(this.fond, p);
    this.bourse.setPosition(x + 12, y + 10);
    this.sac.setPosition(x + 12, y + 32);
    this.largeurEcran = largeurEcran(this.scene);
  }

  montrer(visible: boolean): void {
    if (visible === this.visible) return;
    this.visible = visible;
    this.fond.setVisible(visible);
    this.bourse.setVisible(visible);
    this.sac.setVisible(visible);
  }

  /**
   * @param or les pieces qu'on emporte — elles traversent les mondes (§4.29)
   * @param butin la matiere ramassee, qui deviendra les reserves de depart
   */
  rafraichir(or: number, butin: Stocks): void {
    if (!this.visible) return;
    if (largeurEcran(this.scene) !== this.largeurEcran) this.placer();

    this.bourse.setText(`${espacer("BOURSE")}  ${or}`);
    // ⚠️ **Le sac se dit en clair, pas en total.** « 38 de reserves » ne se
    // rapporte a rien : le joueur ne sait pas s'il tient de quoi refaire une
    // palissade ou de quoi manger trois jours. On nomme donc les sortes, et on
    // s'arrete a deux — au-dela c'est une ligne de tableau, pas un coup d'oeil.
    const lots = RESSOURCES.filter((r) => butin[r] > 0)
      .sort((a, b) => butin[b] - butin[a])
      .slice(0, 2)
      .map((r) => `${butin[r]} ${NOMS_RESSOURCE[r]}`);
    this.sac.setText(lots.length > 0 ? `sac : ${lots.join(", ")}` : "sac vide");
    teindre(this.sac, lots.length > 0 ? T.os : T.osMat);
  }

  detruire(): void {
    this.fond.destroy();
    this.bourse.destroy();
    this.sac.destroy();
  }
}
