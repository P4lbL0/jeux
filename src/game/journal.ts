import Phaser from "phaser";
import { Journal, LIGNES_DU_JOURNAL } from "../core/journal";

/** Marges au bord bas-droit. Le bas-gauche est pris par les capacites. */
const MARGE_X = 16;
const MARGE_Y = 16;
const HAUTEUR_LIGNE = 17;
const LARGEUR_MAX = 380;

/**
 * La plus recente est franche, les plus vieilles palissent sans disparaitre.
 *
 * Le plancher est a 0,5 et pas plus bas : vu en jouant, du texte a 0,3 sur de
 * l'herbe en plein soleil ne se lit plus du tout, et une ligne illisible vaut
 * une ligne perdue — c'est exactement ce que le journal devait arreter.
 */
const OPACITES = [0.5, 0.6, 0.7, 0.8, 0.9, 1];

/**
 * La boite du journal, en bas a droite (DESIGN.md §4.10).
 *
 * Elle remplace la banniere d'annonce qui s'affichait au milieu de l'ecran :
 * celle-ci disait une chose a la fois et l'effacait en quatre secondes, donc
 * perdait la premiere des deux quand deux evenements tombaient ensemble — ce
 * qui arrive exactement quand ca compte.
 *
 * Les six objets Texte sont fabriques **une fois** au demarrage et ne font que
 * changer de contenu : le §4.17 regle 3 interdit de creer du texte en plein
 * combat, et un journal en cree par definition beaucoup.
 */
export class BoiteJournal {
  private readonly lignes: Phaser.GameObjects.Text[] = [];
  private readonly fond: Phaser.GameObjects.Graphics;
  private versionAffichee = -1;
  private largeurEcran = -1;
  private hauteurEcran = -1;

  constructor(private readonly scene: Phaser.Scene) {
    this.fond = scene.add.graphics().setDepth(1398).setScrollFactor(0);

    for (let i = 0; i < LIGNES_DU_JOURNAL; i += 1) {
      this.lignes.push(
        scene.add
          .text(0, 0, "", {
            fontFamily: "monospace",
            fontSize: "13px",
            color: "#ffd98a",
            wordWrap: { width: LARGEUR_MAX },
            align: "right",
          })
          .setOrigin(1, 1)
          .setDepth(1400)
          .setScrollFactor(0)
          .setAlpha(0),
      );
    }
  }

  /**
   * Ne redessine que si le journal a bouge ou si la fenetre a change de taille.
   * Appelee a chaque image, elle ne doit rien couter le reste du temps (§4.17).
   */
  rafraichir(journal: Journal): void {
    const largeur = this.scene.scale.width;
    const hauteur = this.scene.scale.height;
    const memeEcran = largeur === this.largeurEcran && hauteur === this.hauteurEcran;
    if (journal.version === this.versionAffichee && memeEcran) return;

    this.versionAffichee = journal.version;
    this.largeurEcran = largeur;
    this.hauteurEcran = hauteur;

    const contenu = journal.contenu;
    const x = largeur - MARGE_X;
    const bas = hauteur - MARGE_Y;

    // On dessine du bas vers le haut : la ligne la plus recente est la plus
    // basse, donc celle que l'oeil trouve sans chercher.
    let y = bas;
    let plusHaut = bas;
    let plusLarge = 0;
    for (let rang = 0; rang < this.lignes.length; rang += 1) {
      const texte = this.lignes[rang];
      if (!texte) continue;

      const ligne = contenu[contenu.length - 1 - rang];
      if (!ligne) {
        texte.setAlpha(0).setText("");
        continue;
      }

      const suffixe = ligne.repetitions > 1 ? `  x${ligne.repetitions}` : "";
      texte.setText(ligne.texte + suffixe);
      texte.setPosition(x, y);
      // Les plus anciennes palissent : OPACITES est range du plus vieux au plus
      // recent, et `rang` compte a l'envers.
      texte.setAlpha(OPACITES[OPACITES.length - 1 - rang] ?? 0.5);

      y -= Math.max(HAUTEUR_LIGNE, texte.height);
      plusHaut = y;
      plusLarge = Math.max(plusLarge, texte.width);
    }

    this.fond.clear();
    if (contenu.length > 0) {
      // Le fond epouse le texte au lieu d'occuper toujours la largeur maximale :
      // un bandeau de 400 px pour dire « Jour 2 » masque du terrain pour rien.
      const hautBoite = plusHaut - 6;
      this.fond.fillStyle(0x1b1720, 0.72);
      this.fond.fillRoundedRect(
        x - plusLarge - 10,
        hautBoite,
        plusLarge + 20,
        bas - hautBoite + 8,
        8,
      );
    }
  }
}
