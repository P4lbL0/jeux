import Phaser from "phaser";
import type { Proposition } from "../core/competences";

/**
 * Ecran de choix, utilise pour les competences comme pour les evolutions
 * (DESIGN.md §4.13).
 *
 * Le jeu se met en pause le temps du choix. Regle a ne jamais casser : c'est
 * TOUJOURS le joueur qui choisit, jamais l'IA. Les heros joues par l'IA
 * accumulent leurs choix en attente au lieu d'ouvrir cet ecran.
 */
export class ChoixCompetence {
  private objets: Phaser.GameObjects.GameObject[] = [];
  private touches: Phaser.Input.Keyboard.Key[] = [];
  private ouvert = false;

  constructor(private scene: Phaser.Scene) {}

  get estOuvert(): boolean {
    return this.ouvert;
  }

  afficher(
    titre: string,
    sousTitre: string,
    propositions: Proposition[],
    surChoix: (id: string) => void,
  ): void {
    this.ouvert = true;
    const l = this.scene.scale.width;
    const h = this.scene.scale.height;

    const voile = this.scene.add.graphics().setDepth(3000);
    voile.fillStyle(0x0d0b12, 0.85);
    voile.fillRect(0, 0, l, h);
    this.objets.push(voile);

    this.ajouterTexte(l / 2, h * 0.17, titre, 30, "#f0c419").setOrigin(0.5);
    this.ajouterTexte(l / 2, h * 0.17 + 34, sousTitre, 13, "#c8bfae").setOrigin(0.5);

    const largeur = 226;
    const hauteur = 168;
    const espace = 18;
    const total = propositions.length * largeur + (propositions.length - 1) * espace;
    const debut = l / 2 - total / 2;
    const y = h * 0.35;

    propositions.forEach((proposition, i) => {
      this.carte(proposition, debut + i * (largeur + espace), y, largeur, hauteur, i + 1, () => {
        this.masquer();
        surChoix(proposition.id);
      });
    });

    this.ajouterTexte(l / 2, y + hauteur + 34, "Touches 1 a 3, ou clique", 12, "#8a8397").setOrigin(
      0.5,
    );

    const clavier = this.scene.input.keyboard;
    if (!clavier) return;
    const codes = [
      Phaser.Input.Keyboard.KeyCodes.ONE,
      Phaser.Input.Keyboard.KeyCodes.TWO,
      Phaser.Input.Keyboard.KeyCodes.THREE,
    ];
    propositions.forEach((proposition, i) => {
      const code = codes[i];
      if (code === undefined) return;
      const touche = clavier.addKey(code);
      touche.once("down", () => {
        if (!this.ouvert) return;
        this.masquer();
        surChoix(proposition.id);
      });
      this.touches.push(touche);
    });
  }

  private carte(
    proposition: Proposition,
    x: number,
    y: number,
    largeur: number,
    hauteur: number,
    numero: number,
    surClic: () => void,
  ): void {
    const couleur = proposition.couleur;

    const fond = this.scene.add.graphics().setDepth(3001);
    fond.fillStyle(0x1b1720, 0.96);
    fond.fillRoundedRect(x, y, largeur, hauteur, 8);
    fond.lineStyle(3, couleur, 1);
    fond.strokeRoundedRect(x, y, largeur, hauteur, 8);
    this.objets.push(fond);

    this.ajouterTexte(x + 16, y + 14, `${numero}.`, 13, "#8a8397");
    this.ajouterTexte(x + 40, y + 12, proposition.nom, 15, "#f2e9d8").setWordWrapWidth(largeur - 56);
    this.ajouterTexte(x + 40, y + 36, proposition.etiquette, 10, teinte(couleur));

    this.ajouterTexte(x + 16, y + 66, proposition.description, 11, "#d8d2c4").setWordWrapWidth(
      largeur - 32,
    );

    const zone = this.scene.add
      .zone(x, y, largeur, hauteur)
      .setOrigin(0)
      .setDepth(3002)
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", surClic);
    this.objets.push(zone);
  }

  private ajouterTexte(
    x: number,
    y: number,
    contenu: string,
    taille: number,
    couleur: string,
  ): Phaser.GameObjects.Text {
    const t = this.scene.add
      .text(x, y, contenu, {
        fontFamily: "monospace",
        fontSize: `${taille}px`,
        color: couleur,
        lineSpacing: 3,
      })
      .setDepth(3002);
    this.objets.push(t);
    return t;
  }

  masquer(): void {
    this.ouvert = false;
    for (const touche of this.touches) touche.removeAllListeners();
    this.touches = [];
    for (const objet of this.objets) objet.destroy();
    this.objets = [];
  }
}

function teinte(couleur: number): string {
  return `#${couleur.toString(16).padStart(6, "0")}`;
}
