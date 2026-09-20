import Phaser from "phaser";
import type { EtatVillage } from "../../scenes/ArenaScene";
import { T, cadre, espacer, teindre, texte, type Plaque } from "./chrome";

/**
 * Le compteur permanent, en haut a droite (DESIGN.md §4.10).
 *
 * **Il en remplace deux.** Le jour et la population etaient dessines par
 * `panneauVillage.ts`, la survie et les elimines par `UiScene` — deux textes
 * empiles au meme coin, chacun avec ses couleurs, et **aucun des deux n'avait
 * de fond** : du gris sur de l'herbe verte, qu'on ne lisait pas. Ils forment
 * maintenant une seule plaque opaque (§4.10, regle 1).
 *
 * Les quatre lignes sont fabriquees une fois et ne font que changer de contenu
 * (§4.17 regle 3), et la plaque n'est reprise qu'au changement de taille de la
 * fenetre (regle 5).
 */

const LARGEUR = 210;
const HAUTEUR = 74;
const MARGE = 16;

export class PanneauEtat {
  private readonly fond: Phaser.GameObjects.Graphics;
  private readonly moment: Phaser.GameObjects.Text;
  private readonly habitants: Phaser.GameObjects.Text;
  private readonly survie: Phaser.GameObjects.Text;

  private largeurEcran = -1;

  constructor(private readonly scene: Phaser.Scene) {
    this.fond = scene.add.graphics().setDepth(1002).setScrollFactor(0);
    this.moment = this.ligne(12, T.laiton);
    this.habitants = this.ligne(12, T.os);
    this.survie = this.ligne(10, T.osMat);
    this.placer();
  }

  private ligne(taille: number, couleur: string): Phaser.GameObjects.Text {
    return texte(this.scene, 0, 0, taille, couleur).setDepth(1003).setScrollFactor(0);
  }

  private placer(): void {
    const x = this.scene.scale.width - MARGE - LARGEUR;
    const y = MARGE;
    const p: Plaque = { x, y, largeur: LARGEUR, hauteur: HAUTEUR };

    this.fond.clear();
    cadre(this.fond, p);

    this.moment.setPosition(x + 12, y + 10);
    this.habitants.setPosition(x + 12, y + 30);
    this.survie.setPosition(x + 12, y + 52);

    this.largeurEcran = this.scene.scale.width;
  }

  /**
   * @param maintenant l'horloge de la scene, pour le clignotement de fuite.
   */
  rafraichir(
    etat: EtatVillage,
    resume: { secondes: number; kills: number },
    maintenant: number,
  ): void {
    if (this.scene.scale.width !== this.largeurEcran) this.placer();

    const minutes = Math.ceil(etat.restant / 60_000);
    const moment = etat.phase === "jour" ? "JOUR" : "NUIT";
    this.moment.setText(`${espacer(moment)} ${etat.jour}   ${minutes} min`);
    // La nuit se dit en sang seche : elle n'est pas encore un danger, elle
    // l'annonce. Le sang frais reste pour ce qui tue (§4.10).
    teindre(this.moment, etat.phase === "jour" ? T.laiton : T.sangSeche);

    this.habitants.setText(
      `${etat.population} habitant${etat.population > 1 ? "s" : ""}${etat.enFuite ? " — en fuite" : ""}`,
    );
    // Quelqu'un court : c'est la seule alerte de ce panneau, et la population
    // est devenue la condition de defaite (§4.18). Elle doit etre impossible a
    // manquer — donc elle clignote, et `teindre` evite de re-fabriquer la
    // texture du texte a chaque image quand elle ne change pas.
    if (etat.population === 0) teindre(this.habitants, T.sangFrais);
    else if (etat.enFuite) {
      teindre(this.habitants, Math.floor(maintenant / 220) % 2 === 0 ? T.sangFrais : T.os);
    } else teindre(this.habitants, T.os);

    this.survie.setText(`survie ${resume.secondes}s  ·  ${resume.kills} elimines`);
  }

  /**
   * Le compteur s'efface pendant la marche (§4.29).
   *
   * Le jour, la population, la survie, les elimines : ce sont les chiffres
   * **de notre village**, et tant qu'on n'a pas donne sa parole on n'en a pas.
   * Les laisser afficherait « jour 1, 3 habitants » d'un village dont on ne
   * sait rien, et dirait au joueur qu'il est deja chez lui.
   */
  montrer(visible: boolean): void {
    this.fond.setVisible(visible);
    this.moment.setVisible(visible);
    this.habitants.setVisible(visible);
    this.survie.setVisible(visible);
  }

  detruire(): void {
    this.fond.destroy();
    this.moment.destroy();
    this.habitants.destroy();
    this.survie.destroy();
  }
}
