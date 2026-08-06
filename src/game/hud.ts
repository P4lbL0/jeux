import Phaser from "phaser";
import { SEUIL_CRITIQUE } from "../core/classes";
import type { Hero } from "./entities";

/**
 * Barre d'equipe, en haut a gauche, a l'horizontale (DESIGN.md §4.10).
 *
 * Ce n'est pas de la decoration : avec la mort definitive, c'est l'**ecran de
 * triage** du joueur. C'est ici qu'il voit un heros en train de tomber a
 * l'autre bout de la carte et qu'il decide de lacher sa position pour aller le
 * sauver.
 *
 * Le trait blanc a 20% est l'information la plus importante de l'ecran : c'est
 * lui qui verrouille le changement de heros et declenche le repli de l'IA.
 */

const LARGEUR = 134;
const HAUTEUR = 62;
const ESPACE = 6;
const MARGE = 12;

const COULEURS_ETAT: Record<string, string> = {
  combat: "#c8bfae",
  repli: "#e6a23c",
  cite: "#5fc26a",
  mort: "#ff6b5a",
};

const LIBELLES_ETAT: Record<string, string> = {
  combat: "au combat",
  repli: "SE REPLIE",
  cite: "a la cite",
  mort: "TOMBE",
};

export interface EtatEquipe {
  heros: Hero[];
  indexIncarne: number;
  /** Le heros courant permet-il d'en changer maintenant ? (DESIGN.md §4.3) */
  changementAutorise: boolean;
}

interface Carte {
  portrait: Phaser.GameObjects.Image;
  titre: Phaser.GameObjects.Text;
  etat: Phaser.GameObjects.Text;
  badge: Phaser.GameObjects.Text;
}

export class Hud {
  private graphiques: Phaser.GameObjects.Graphics;
  private cartes: Carte[] = [];
  private info: Phaser.GameObjects.Text;
  private alerte: Phaser.GameObjects.Text;

  constructor(
    private scene: Phaser.Scene,
    heros: Hero[],
    surSelection: (index: number) => void,
  ) {
    this.graphiques = scene.add.graphics().setDepth(1000);

    heros.forEach((hero, i) => {
      const x = MARGE + i * (LARGEUR + ESPACE);
      this.cartes.push({
        portrait: scene.add
          .image(x + 22, MARGE + 30, `hero-${hero.classe.id}`)
          .setScale(2)
          .setDepth(1001),
        titre: this.texte(x + 40, MARGE + 8, 11, "#f2e9d8"),
        etat: this.texte(x + 40, MARGE + 46, 9, "#c8bfae"),
        badge: this.texte(x + LARGEUR - 10, MARGE + 7, 11, "#f0c419").setOrigin(1, 0),
      });

      scene.add
        .zone(x, MARGE, LARGEUR, HAUTEUR)
        .setOrigin(0)
        .setInteractive({ useHandCursor: true })
        .on("pointerdown", () => surSelection(i));
    });

    this.info = this.texte(0, 0, 11, "#d8d2c4").setOrigin(0.5, 0);
    this.info.setText(
      "ZQSD, fleches ou clic : se deplacer   ·   ESPACE : ultime   ·   A / E : changer de heros   ·   molette : zoom",
    );

    this.alerte = this.texte(0, 0, 13, "#ff8a7a").setOrigin(0.5, 0);

    const replacer = () => this.placerBas();
    scene.scale.on("resize", replacer);
    // Le gestionnaire de taille est global : sans ce retrait, l'ecouteur
    // survivrait a la scene et pointerait vers des objets detruits.
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.scale.off("resize", replacer));
    this.placerBas();
  }

  private texte(x: number, y: number, taille: number, couleur: string): Phaser.GameObjects.Text {
    return this.scene.add
      .text(x, y, "", { fontFamily: "monospace", fontSize: `${taille}px`, color: couleur })
      .setDepth(1003);
  }

  private placerBas(): void {
    this.info.setPosition(this.scene.scale.width / 2, this.scene.scale.height - 26);
    this.alerte.setPosition(this.scene.scale.width / 2, MARGE + HAUTEUR + 10);
  }

  rafraichir(etat: EtatEquipe): void {
    const g = this.graphiques;
    g.clear();

    etat.heros.forEach((hero, i) => {
      const carte = this.cartes[i];
      if (!carte) return;

      const x = MARGE + i * (LARGEUR + ESPACE);
      const y = MARGE;
      const incarne = i === etat.indexIncarne;
      const mort = hero.etat === "mort";

      // --- Cadre ---
      g.fillStyle(0x1b1720, mort ? 0.6 : 0.85);
      g.fillRoundedRect(x, y, LARGEUR, HAUTEUR, 6);
      g.lineStyle(incarne ? 3 : 2, incarne ? 0xf0c419 : 0x4a4152, 1);
      g.strokeRoundedRect(x, y, LARGEUR, HAUTEUR, 6);

      g.fillStyle(0x2a2433, 1);
      g.fillRect(x + 10, y + 12, 24, 38);
      carte.portrait.setAlpha(mort ? 0.4 : 1);

      carte.titre.setText(`${hero.classe.nom.slice(0, 9)} ${hero.niveau}`);
      carte.titre.setColor(incarne ? "#f0c419" : mort ? "#6b6478" : "#f2e9d8");

      // --- Vie ---
      const bx = x + 40;
      const largeur = LARGEUR - 50;
      const by = y + 24;
      g.fillStyle(0x000000, 0.55);
      g.fillRect(bx, by, largeur, 8);

      if (!mort) {
        const ratio = Phaser.Math.Clamp(hero.ratioPv, 0, 1);
        const couleur = hero.estCritique ? 0xe74c3c : ratio < 0.5 ? 0xe6a23c : 0x5fc26a;
        g.fillStyle(couleur, 1);
        g.fillRect(bx, by, largeur * ratio, 8);
      }

      // Le trait des 20% : le seuil qui verrouille tout.
      g.fillStyle(0xffffff, 0.9);
      g.fillRect(bx + largeur * SEUIL_CRITIQUE - 1, by - 2, 2, 12);

      // --- XP ---
      const yx = by + 11;
      g.fillStyle(0x000000, 0.55);
      g.fillRect(bx, yx, largeur, 3);
      if (!mort) {
        g.fillStyle(0x5ec8f0, 1);
        g.fillRect(bx, yx, largeur * Phaser.Math.Clamp(hero.xp / hero.xpRequise, 0, 1), 3);
      }

      carte.etat.setText(LIBELLES_ETAT[hero.etat] ?? "");
      carte.etat.setColor(COULEURS_ETAT[hero.etat] ?? "#c8bfae");

      // --- Ameliorations en attente ---
      // L'IA ne choisit jamais : elle accumule, et ce badge dit au joueur
      // qu'un heros l'attend avec des choix en reserve (DESIGN.md §4.3).
      const attente = hero.niveauxEnAttente;
      carte.badge.setText(attente > 0 && !mort ? `+${attente}` : "");
      if (attente > 0 && !mort) {
        g.fillStyle(0xf0c419, 0.18);
        g.fillRoundedRect(x, y, LARGEUR, HAUTEUR, 6);
      }
    });

    // Message de verrouillage : sans lui, le joueur croit a un bug quand le
    // changement de heros ne repond plus.
    const courant = etat.heros[etat.indexIncarne];
    this.alerte.setText(
      courant && !etat.changementAutorise
        ? "Sous 20% de vie : rentre a la cite pour changer de heros"
        : "",
    );
  }
}
