import Phaser from "phaser";
import type { Proposition } from "../core/competences";
import { C, POLICE, T, cadre, espacer, type Plaque } from "./ui/chrome";

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
    voile.fillStyle(C.fer, 0.88);
    voile.fillRect(0, 0, l, h);
    this.objets.push(voile);

    this.ajouterTexte(l / 2, h * 0.17, espacer(titre.toUpperCase()), 26, T.laiton).setOrigin(0.5);
    this.ajouterTexte(l / 2, h * 0.17 + 34, sousTitre, 13, T.osMat).setOrigin(0.5);

    // Trois cartes d'ordinaire ; jusqu'a cinq sur l'ecran « laquelle oublier ? »
    // (§4.13) — elles se serrent pour tenir dans la largeur.
    const espace = 18;
    const n = Math.max(1, propositions.length);
    const largeur = Math.min(226, Math.floor((l - 48 - (n - 1) * espace) / n));
    const hauteur = 168;
    const total = propositions.length * largeur + (propositions.length - 1) * espace;
    const debut = l / 2 - total / 2;
    const y = h * 0.35;

    propositions.forEach((proposition, i) => {
      this.carte(proposition, debut + i * (largeur + espace), y, largeur, hauteur, i + 1, () => {
        this.masquer();
        surChoix(proposition.id);
      });
    });

    this.ajouterTexte(l / 2, y + hauteur + 34, `Touches 1 a ${Math.min(n, 5)}, ou clique`, 12, T.osMat).setOrigin(
      0.5,
    );

    const clavier = this.scene.input.keyboard;
    if (!clavier) return;
    const codes = [
      Phaser.Input.Keyboard.KeyCodes.ONE,
      Phaser.Input.Keyboard.KeyCodes.TWO,
      Phaser.Input.Keyboard.KeyCodes.THREE,
      Phaser.Input.Keyboard.KeyCodes.FOUR,
      Phaser.Input.Keyboard.KeyCodes.FIVE,
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
    const fond = this.scene.add.graphics().setDepth(3001);
    const plaque: Plaque = { x, y, largeur, hauteur };
    cadre(fond, plaque, true);
    this.objets.push(fond);

    // Le numero de touche est en laiton, comme partout ailleurs : c'est ce
    // qu'on appuie (§4.10). La rarete de la competence, elle, garde sa couleur
    // — c'est une information de contenu, pas de chrome.
    this.ajouterTexte(x + 14, y + 15, `${numero}`, 15, T.laiton);
    this.ajouterTexte(x + 34, y + 12, proposition.nom, 15, T.os).setWordWrapWidth(largeur - 50);
    this.ajouterTexte(x + 34, y + 36, espacer(proposition.etiquette.toUpperCase()), 9, T.osMat);

    this.ajouterTexte(x + 14, y + 66, proposition.description, 11, T.os).setWordWrapWidth(
      largeur - 28,
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
        fontFamily: POLICE,
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
