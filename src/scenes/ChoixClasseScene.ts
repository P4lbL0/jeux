import Phaser from "phaser";
import { CLASSES, ORDRE_CLASSES, type ClassId } from "../core/classes";
import { creerTexturesPlaceholder, echellePortrait } from "../game/art";
import type { Emplacement } from "../core/sauvegarde";

/**
 * Choix de la classe de depart (DESIGN.md §3, prologue).
 *
 * Au jalon 9 cet ecran sera remplace par la vraie introduction narrative.
 * Pour l'instant il sert surtout a pouvoir comparer les quatre classes en
 * quelques secondes pendant qu'on teste la sensation de jeu.
 */
/** Hauteur visee pour le portrait d'une carte de classe, en pixels ecran. */
const HAUTEUR_PORTRAIT = 72;

export class ChoixClasseScene extends Phaser.Scene {
  /** L'emplacement choisi a l'ecran de depart (DESIGN.md §4.28) */
  private emplacement: Emplacement = 1;

  constructor() {
    super("choix-classe");
  }

  init(data: { emplacement?: Emplacement }): void {
    this.emplacement = data.emplacement ?? 1;
  }

  create(): void {
    // Le menu contextuel du navigateur n'a rien a faire dans un jeu.
    this.input.mouse?.disableContextMenu();

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

    // Le monde lui-meme en fond, assombri : c'est le village qu'on s'apprete a
    // defendre. La cle utilisee ici etait « herbe », qui n'a jamais existe —
    // l'ecran affichait donc le damier de texture manquante de Phaser. Poser la
    // carte plutot que la tuile de prairie evite au passage la grille de
    // repetition : elle fait 1600x1200, elle ne se repete pas a l'ecran.
    this.add.tileSprite(0, 0, l, h, "carte").setOrigin(0).setAlpha(0.3);

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

    // Sept classes : on les repartit sur deux rangees pour qu'elles tiennent a
    // l'ecran quelle que soit la fenetre.
    const parRangee = 4;
    const largeurCarte = 186;
    const espace = 14;
    const hauteurCarte = 278;
    const y = h * 0.24;

    ORDRE_CLASSES.forEach((id, i) => {
      const rangee = Math.floor(i / parRangee);
      const dansRangee = ORDRE_CLASSES.slice(rangee * parRangee, (rangee + 1) * parRangee).length;
      const total = dansRangee * largeurCarte + (dansRangee - 1) * espace;
      const debut = l / 2 - total / 2;
      const colonne = i % parRangee;
      this.carte(
        id,
        debut + colonne * (largeurCarte + espace),
        y + rangee * (hauteurCarte + 16),
        largeurCarte,
        i + 1,
      );
    });

    this.add
      .text(l / 2, h - 26, "Touches 1 a 7, ou clique sur une carte", {
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
        Phaser.Input.Keyboard.KeyCodes.FIVE,
        Phaser.Input.Keyboard.KeyCodes.SIX,
        Phaser.Input.Keyboard.KeyCodes.SEVEN,
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

    // Le portrait vise toujours la meme hauteur, que la texture soit le
    // placeholder de 18 px ou le sprite de 32 px. L'echelle reste **entiere** :
    // agrandir du pixel-art d'un facteur fractionnaire donne des pixels de
    // tailles inegales, et ca se voit immediatement.
    const portrait = this.add.image(x + largeur / 2, y + 44, `hero-${id}`);
    portrait.setScale(echellePortrait(portrait.height, HAUTEUR_PORTRAIT));

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
    this.scene.start("arena", { classe, emplacement: this.emplacement });
  }
}

function teinte(couleur: number): string {
  return `#${couleur.toString(16).padStart(6, "0")}`;
}
