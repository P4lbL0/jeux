import Phaser from "phaser";
import type { Hero } from "./entities";

/**
 * Panneau des capacites, en bas a gauche.
 *
 * Une capacite est soit l'ultime de la classe, soit une competence active
 * apprise en montant de niveau. Elles partagent le meme panneau et la meme
 * logique de touches : le clavier du joueur s'enrichit a mesure qu'il progresse
 * (DESIGN.md §4.2).
 *
 * Le panneau se reconstruit tout seul quand la liste change — apprendre une
 * competence active, ou changer de heros.
 */

const LARGEUR = 302;
const HAUTEUR = 58;
const ESPACE = 6;
const MARGE_BASSE = 46;
const TAILLE_ICONE = 40;

/** Libelle de la touche associee a chaque emplacement */
export const TOUCHES_CAPACITES = ["ESPACE", "2", "3", "4", "5"];

interface Entree {
  icone: Phaser.GameObjects.Image;
  nom: Phaser.GameObjects.Text;
  description: Phaser.GameObjects.Text;
  touche: Phaser.GameObjects.Text;
}

export class PanneauCapacites {
  private cadres: Phaser.GameObjects.Graphics;
  private voiles: Phaser.GameObjects.Graphics;
  private entrees: Entree[] = [];
  private signature = "";

  constructor(private scene: Phaser.Scene, private hero: Hero) {
    this.cadres = scene.add.graphics().setDepth(1000);
    this.voiles = scene.add.graphics().setDepth(1002);
    this.reconstruire();
  }

  changerHero(hero: Hero): void {
    this.hero = hero;
    this.reconstruire();
  }

  private reconstruire(): void {
    for (const e of this.entrees) {
      e.icone.destroy();
      e.nom.destroy();
      e.description.destroy();
      e.touche.destroy();
    }
    this.entrees = [];

    const capacites = this.hero.capacites;
    this.signature = capacites.map((c) => c.id).join("|");

    capacites.forEach((capacite, i) => {
      this.entrees.push({
        icone: this.scene.add
          .image(0, 0, capacite.icone)
          .setDisplaySize(TAILLE_ICONE, TAILLE_ICONE)
          .setDepth(1001),
        nom: this.texte(capacite.nom.toUpperCase(), 13, "#f2e9d8"),
        description: this.texte(capacite.description, 10, "#c8bfae").setWordWrapWidth(196),
        touche: this.texte(TOUCHES_CAPACITES[i] ?? "?", 11, "#8a8397").setOrigin(1, 0),
      });
    });
  }

  private texte(contenu: string, taille: number, couleur: string): Phaser.GameObjects.Text {
    return this.scene.add
      .text(0, 0, contenu, {
        fontFamily: "monospace",
        fontSize: `${taille}px`,
        color: couleur,
        lineSpacing: 2,
      })
      .setDepth(1003);
  }

  detruire(): void {
    this.cadres.destroy();
    this.voiles.destroy();
    for (const e of this.entrees) {
      e.icone.destroy();
      e.nom.destroy();
      e.description.destroy();
      e.touche.destroy();
    }
    this.entrees = [];
  }

  rafraichir(): void {
    const capacites = this.hero.capacites;
    // Une capacite vient d'etre apprise : le panneau se refait.
    if (capacites.map((c) => c.id).join("|") !== this.signature) this.reconstruire();

    this.cadres.clear();
    this.voiles.clear();

    const bas = this.scene.scale.height - MARGE_BASSE;
    const couleurClasse = this.hero.classe.couleur;

    capacites.forEach((capacite, i) => {
      const entree = this.entrees[i];
      if (!entree) return;

      const x = 16;
      const y = bas - HAUTEUR - i * (HAUTEUR + ESPACE);
      const charge = this.hero.chargeCapacite(capacite);
      const pret = charge === 0;

      // Battement lent quand la capacite est disponible : ca attire l'oeil sans
      // clignoter agressivement en plein combat.
      const battement = pret ? 0.75 + 0.25 * Math.sin(this.scene.time.now / 260) : 0;
      const bordure = capacite.automatique ? 0x7ee0a0 : 0xf0c419;

      this.cadres.fillStyle(0x1b1720, 0.85);
      this.cadres.fillRoundedRect(x, y, LARGEUR, HAUTEUR, 8);
      this.cadres.lineStyle(pret ? 3 : 2, pret ? bordure : 0x4a4152, pret ? battement : 1);
      this.cadres.strokeRoundedRect(x, y, LARGEUR, HAUTEUR, 8);

      const ix = x + 9;
      const iy = y + (HAUTEUR - TAILLE_ICONE) / 2;
      this.cadres.fillStyle(0x2a2433, 1);
      this.cadres.fillRoundedRect(ix, iy, TAILLE_ICONE, TAILLE_ICONE, 5);

      entree.icone.setPosition(ix + TAILLE_ICONE / 2, iy + TAILLE_ICONE / 2);
      entree.icone.setTint(pret ? couleurClasse : 0x5a5368);
      entree.icone.setScale(
        (TAILLE_ICONE / 32) * (pret ? 1 + 0.04 * Math.sin(this.scene.time.now / 260) : 1),
      );

      // Le rechargement se vide par le haut : l'icone "se remplit" en remontant.
      if (!pret) {
        this.voiles.fillStyle(0x0d0b12, 0.72);
        this.voiles.fillRect(ix, iy, TAILLE_ICONE, TAILLE_ICONE * charge);
      }

      const tx = x + 58;
      entree.nom.setPosition(tx, y + 7).setColor(pret ? "#f0c419" : "#8a8397");
      entree.description.setPosition(tx, y + 25);

      const restant = Math.ceil((charge * capacite.rechargement) / 1000);
      const libelle = capacite.automatique ? "AUTO" : (TOUCHES_CAPACITES[i] ?? "?");
      entree.touche
        .setPosition(x + LARGEUR - 12, y + 8)
        .setColor(pret ? "#f2e9d8" : "#5a5368")
        .setText(pret ? libelle : `${restant}s`);
    });
  }
}
