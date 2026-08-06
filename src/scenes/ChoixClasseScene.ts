import Phaser from "phaser";
import { CLASSES, ORDRE_CLASSES, type ClassId } from "../core/classes";
import { creerTexturesPlaceholder } from "../game/art";

/**
 * Choix de la classe de depart (DESIGN.md §3, prologue).
 *
 * Au jalon 9 cet ecran sera remplace par la vraie introduction narrative.
 * Pour l'instant il sert surtout a pouvoir comparer les quatre classes en
 * quelques secondes pendant qu'on teste la sensation de jeu.
 */
export class ChoixClasseScene extends Phaser.Scene {
  constructor() {
    super("choix-classe");
  }

  create(): void {
    creerTexturesPlaceholder(this);
    this.construire();

    const redessiner = () => this.construire();
    this.scale.on("resize", redessiner);
    // Sans ce retrait, l'ecran continuerait de se reconstruire en arriere-plan
    // pendant qu'on joue.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off("resize", redessiner));
  }

  private construire(): void {
    this.children.removeAll();

    const l = this.scale.width;
    const h = this.scale.height;

    this.add
      .tileSprite(0, 0, l, h, "herbe")
      .setOrigin(0)
      .setAlpha(0.35);

    this.add
      .text(l / 2, h * 0.16, "LE PROTECTEUR", {
        fontFamily: "monospace",
        fontSize: "34px",
        color: "#f2e9d8",
      })
      .setOrigin(0.5);

    this.add
      .text(l / 2, h * 0.16 + 34, "Ce village n'a plus personne pour le defendre.\nChoisis ta classe.", {
        fontFamily: "monospace",
        fontSize: "13px",
        color: "#c8bfae",
        align: "center",
      })
      .setOrigin(0.5);

    const largeurCarte = 186;
    const espace = 16;
    const total = ORDRE_CLASSES.length * largeurCarte + (ORDRE_CLASSES.length - 1) * espace;
    const debut = l / 2 - total / 2;
    const y = h * 0.3;

    ORDRE_CLASSES.forEach((id, i) => {
      this.carte(id, debut + i * (largeurCarte + espace), y, largeurCarte, i + 1);
    });

    this.add
      .text(l / 2, h - 40, "Touches 1 a 4, ou clique sur une carte", {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#8a8397",
      })
      .setOrigin(0.5);

    const clavier = this.input.keyboard;
    if (clavier) {
      const codes = [
        Phaser.Input.Keyboard.KeyCodes.ONE,
        Phaser.Input.Keyboard.KeyCodes.TWO,
        Phaser.Input.Keyboard.KeyCodes.THREE,
        Phaser.Input.Keyboard.KeyCodes.FOUR,
      ];
      codes.forEach((code, i) => {
        const id = ORDRE_CLASSES[i];
        if (id) clavier.addKey(code).once("down", () => this.lancer(id));
      });
    }
  }

  private carte(id: ClassId, x: number, y: number, largeur: number, numero: number): void {
    const classe = CLASSES[id];
    const hauteur = 278;

    const fond = this.add.graphics();
    fond.fillStyle(0x1b1720, 0.9);
    fond.fillRoundedRect(x, y, largeur, hauteur, 8);
    fond.lineStyle(2, classe.couleur, 1);
    fond.strokeRoundedRect(x, y, largeur, hauteur, 8);

    this.add.image(x + largeur / 2, y + 44, `hero-${id}`).setScale(4);

    this.add
      .text(x + largeur / 2, y + 84, `${numero}. ${classe.nom}`, {
        fontFamily: "monospace",
        fontSize: "15px",
        color: "#f2e9d8",
      })
      .setOrigin(0.5);

    this.add
      .text(x + largeur / 2, y + 106, classe.distanceIdeale, {
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#c8bfae",
        align: "center",
        wordWrap: { width: largeur - 20 },
      })
      .setOrigin(0.5, 0);

    const lignes = [
      `Vie      ${classe.pvMax}`,
      `Vitesse  ${classe.vitesse}`,
      `Portee   ${classe.portee}`,
      `Degats   ${classe.degats}`,
      `Esquive  ${Math.round(classe.esquive * 100)}%`,
      `Ultime   ${classe.ultimes[0]?.nom ?? "-"}`,
    ];
    this.add.text(x + 16, y + 140, lignes.join("\n"), {
      fontFamily: "monospace",
      fontSize: "11px",
      color: "#d8d2c4",
      lineSpacing: 2,
    });

    // Le trait : c'est lui qui fait qu'une classe ne se joue pas comme une
    // autre. Il merite plus de place que les chiffres.
    const yTrait = y + 216;
    const separateur = this.add.graphics();
    separateur.lineStyle(1, classe.couleur, 0.5);
    separateur.lineBetween(x + 16, yTrait - 8, x + largeur - 16, yTrait - 8);

    this.add.text(x + 16, yTrait, classe.traitNom.toUpperCase(), {
      fontFamily: "monospace",
      fontSize: "11px",
      color: teinte(classe.couleur),
    });
    this.add.text(x + 16, yTrait + 18, classe.traitTexte, {
      fontFamily: "monospace",
      fontSize: "10px",
      color: "#c8bfae",
      wordWrap: { width: largeur - 32 },
      lineSpacing: 2,
    });

    this.add
      .zone(x, y, largeur, hauteur)
      .setOrigin(0)
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", () => this.lancer(id));
  }

  private lancer(classe: ClassId): void {
    this.scene.start("arena", { classe });
  }
}

function teinte(couleur: number): string {
  return `#${couleur.toString(16).padStart(6, "0")}`;
}
