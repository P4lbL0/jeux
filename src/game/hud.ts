import Phaser from "phaser";
import { SEUIL_CRITIQUE } from "../core/classes";
import type { Hero } from "./entities";

/**
 * Barre de heros, en haut a gauche, a l'horizontale (DESIGN.md §4.10).
 *
 * Pour l'instant elle n'affiche qu'un heros, mais elle est construite comme une
 * liste : au jalon 3 il suffira de la boucler sur toute l'equipe.
 *
 * Le seuil des 20% est marque en dur sur la barre de vie. C'est l'information
 * la plus importante de l'ecran : c'est lui qui verrouillera le changement de
 * heros et declenchera le repli de l'IA.
 *
 * L'interface ne zoome jamais avec la camera : setScrollFactor(0) partout.
 */

const LARGEUR_CARTE = 208;
const HAUTEUR_CARTE = 58;

export class Hud {
  private fond: Phaser.GameObjects.Graphics;
  private barres: Phaser.GameObjects.Graphics;
  private titre: Phaser.GameObjects.Text;
  private pvTexte: Phaser.GameObjects.Text;
  private ultimesTextes: Phaser.GameObjects.Text[] = [];
  private info: Phaser.GameObjects.Text;

  constructor(private scene: Phaser.Scene, private hero: Hero) {
    this.fond = scene.add.graphics().setScrollFactor(0).setDepth(1000);
    this.barres = scene.add.graphics().setScrollFactor(0).setDepth(1002);

    // Portrait : place une fois, il ne bouge plus.
    scene.add
      .image(34, 34, `hero-${hero.classe.id}`)
      .setScrollFactor(0)
      .setDepth(1001)
      .setScale(2);

    this.titre = this.texte(58, 16, 12, "#f2e9d8");
    this.pvTexte = this.texte(58, 31, 10, "#ffffff");

    hero.classe.ultimes.forEach((ultime, i) => {
      this.ultimesTextes.push(this.texte(20 + i * 74, HAUTEUR_CARTE + 22, 10, "#f2e9d8").setText(ultime.nom));
    });

    this.info = this.texte(16, 0, 11, "#d8d2c4");
    this.info.setText(
      "ZQSD ou fleches : se deplacer   ·   ESPACE (ou 1) : ultime   ·   molette : zoom",
    );

    this.dessinerFond();
    scene.scale.on("resize", () => this.placerInfo());
    this.placerInfo();
  }

  private texte(x: number, y: number, taille: number, couleur: string): Phaser.GameObjects.Text {
    return this.scene.add
      .text(x, y, "", { fontFamily: "monospace", fontSize: `${taille}px`, color: couleur })
      .setScrollFactor(0)
      .setDepth(1003);
  }

  private placerInfo(): void {
    this.info.setPosition(16, this.scene.scale.height - 26);
  }

  private dessinerFond(): void {
    const g = this.fond;
    g.clear();
    g.fillStyle(0x1b1720, 0.82);
    g.fillRoundedRect(12, 12, LARGEUR_CARTE, HAUTEUR_CARTE, 6);
    g.lineStyle(2, 0x4a4152, 1);
    g.strokeRoundedRect(12, 12, LARGEUR_CARTE, HAUTEUR_CARTE, 6);
    // Emplacement du portrait
    g.fillStyle(0x2a2433, 1);
    g.fillRect(20, 20, 28, 28);
  }

  rafraichir(): void {
    const h = this.hero;
    const g = this.barres;
    g.clear();

    this.titre.setText(`${h.classe.nom}  Niv.${h.niveau}`);

    const x = 58;
    const largeur = 142;

    // --- Barre de vie ---
    const yPv = 46;
    g.fillStyle(0x000000, 0.55);
    g.fillRect(x, yPv, largeur, 9);

    const ratio = Phaser.Math.Clamp(h.ratioPv, 0, 1);
    // Vert -> orange -> rouge des que le seuil critique est franchi.
    const couleur = h.estCritique ? 0xe74c3c : ratio < 0.5 ? 0xe6a23c : 0x5fc26a;
    g.fillStyle(couleur, 1);
    g.fillRect(x, yPv, largeur * ratio, 9);

    // Marqueur des 20% : le trait le plus important de l'interface.
    const xSeuil = x + largeur * SEUIL_CRITIQUE;
    g.fillStyle(0xffffff, 0.9);
    g.fillRect(xSeuil - 1, yPv - 2, 2, 13);

    g.lineStyle(1, 0x000000, 0.6);
    g.strokeRect(x, yPv, largeur, 9);

    this.pvTexte.setText(`${Math.ceil(h.pv)} / ${h.pvMax}`);
    this.pvTexte.setPosition(x, yPv - 14);
    this.pvTexte.setColor(h.estCritique ? "#ff8a7a" : "#ffffff");

    // --- Barre d'XP ---
    const yXp = yPv + 12;
    g.fillStyle(0x000000, 0.55);
    g.fillRect(x, yXp, largeur, 4);
    g.fillStyle(0x5ec8f0, 1);
    g.fillRect(x, yXp, largeur * Phaser.Math.Clamp(h.xp / h.xpRequise, 0, 1), 4);

    // --- Rechargement des ultimes ---
    h.classe.ultimes.forEach((_, i) => {
      const bx = 16 + i * 74;
      const by = HAUTEUR_CARTE + 18;
      const charge = h.chargeUltime(i);
      const pret = charge === 0;

      g.fillStyle(0x1b1720, 0.82);
      g.fillRoundedRect(bx, by, 70, 20, 4);
      if (!pret) {
        g.fillStyle(0x000000, 0.55);
        g.fillRoundedRect(bx, by, 70 * charge, 20, 4);
      }
      g.lineStyle(2, pret ? 0xf0c419 : 0x4a4152, 1);
      g.strokeRoundedRect(bx, by, 70, 20, 4);

      this.ultimesTextes[i]?.setColor(pret ? "#f0c419" : "#8a8397");
    });
  }
}
