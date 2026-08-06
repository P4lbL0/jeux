import Phaser from "phaser";
import type { Hero } from "./entities";

/**
 * Panneau des ultimes, en bas a gauche.
 *
 * L'ultime est le seul bouton du jeu (DESIGN.md §4.2) : il porte a lui seul le
 * sentiment d'agir, et c'est le principal marqueur d'identite entre les
 * classes. Il merite donc d'occuper une vraie place a l'ecran, avec son icone,
 * son nom, ce qu'il fait, et un rechargement lisible d'un coup d'oeil.
 *
 * Le panneau est une liste : quand le rang debloquera d'autres ultimes
 * (DESIGN.md §4.1), ils s'empileront vers le haut sans rien changer ici.
 */

const LARGEUR = 302;
const HAUTEUR = 62;
const ESPACE = 8;
/** Marge basse, pour laisser passer la ligne d'aide */
const MARGE_BASSE = 46;
const TAILLE_ICONE = 44;

/** Libelle de la touche associee a chaque ultime, dans l'ordre */
const TOUCHES = ["ESPACE", "2", "3"];

interface Entree {
  icone: Phaser.GameObjects.Image;
  nom: Phaser.GameObjects.Text;
  description: Phaser.GameObjects.Text;
  touche: Phaser.GameObjects.Text;
}

export class PanneauUltimes {
  private cadres: Phaser.GameObjects.Graphics;
  private voiles: Phaser.GameObjects.Graphics;
  private entrees: Entree[] = [];

  constructor(private scene: Phaser.Scene, private hero: Hero) {
    this.cadres = scene.add.graphics().setDepth(1000);
    this.voiles = scene.add.graphics().setDepth(1002);

    hero.classe.ultimes.forEach((ultime, i) => {
      this.entrees.push({
        icone: scene.add
          .image(0, 0, `ultime-${ultime.effet}`)
          .setDisplaySize(TAILLE_ICONE, TAILLE_ICONE)
          .setDepth(1001),
        nom: this.texte(ultime.nom.toUpperCase(), 14, "#f2e9d8"),
        description: this.texte(ultime.description, 10, "#c8bfae").setWordWrapWidth(200),
        touche: this.texte(TOUCHES[i] ?? "?", 11, "#8a8397").setOrigin(1, 0),
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

  rafraichir(): void {
    this.cadres.clear();
    this.voiles.clear();

    const bas = this.scene.scale.height - MARGE_BASSE;
    const couleurClasse = this.hero.classe.couleur;

    this.entrees.forEach((entree, i) => {
      const x = 16;
      const y = bas - HAUTEUR - i * (HAUTEUR + ESPACE);
      const charge = this.hero.chargeUltime(i);
      const pret = charge === 0;

      // Battement lent quand l'ultime est disponible : ca attire l'oeil sans
      // clignoter agressivement en plein combat.
      const battement = pret ? 0.75 + 0.25 * Math.sin(this.scene.time.now / 260) : 0;

      this.cadres.fillStyle(0x1b1720, 0.85);
      this.cadres.fillRoundedRect(x, y, LARGEUR, HAUTEUR, 8);
      this.cadres.lineStyle(pret ? 3 : 2, pret ? 0xf0c419 : 0x4a4152, pret ? battement : 1);
      this.cadres.strokeRoundedRect(x, y, LARGEUR, HAUTEUR, 8);

      // Emplacement de l'icone
      const ix = x + 9;
      const iy = y + (HAUTEUR - TAILLE_ICONE) / 2;
      this.cadres.fillStyle(0x2a2433, 1);
      this.cadres.fillRoundedRect(ix, iy, TAILLE_ICONE, TAILLE_ICONE, 5);

      entree.icone.setPosition(ix + TAILLE_ICONE / 2, iy + TAILLE_ICONE / 2);
      entree.icone.setTint(pret ? couleurClasse : 0x5a5368);
      entree.icone.setScale(
        (TAILLE_ICONE / 32) * (pret ? 1 + 0.04 * Math.sin(this.scene.time.now / 260) : 1),
      );

      // Le rechargement se vide par le haut : l'icone "se remplit" en
      // remontant, ce qui se lit sans avoir a comparer deux barres.
      if (!pret) {
        this.voiles.fillStyle(0x0d0b12, 0.72);
        this.voiles.fillRect(ix, iy, TAILLE_ICONE, TAILLE_ICONE * charge);
      }

      const tx = x + 62;
      entree.nom.setPosition(tx, y + 9).setColor(pret ? "#f0c419" : "#8a8397");
      entree.description.setPosition(tx, y + 29);
      entree.touche
        .setPosition(x + LARGEUR - 12, y + 10)
        .setColor(pret ? "#f2e9d8" : "#5a5368");

      // Compte a rebours a la place du libelle de touche pendant le rechargement.
      const restant = Math.ceil(
        (charge * this.hero.classe.ultimes[i]!.rechargement * this.hero.bonus.rechargementUltime) /
          1000,
      );
      entree.touche.setText(pret ? (TOUCHES[i] ?? "?") : `${restant}s`);
    });
  }
}
