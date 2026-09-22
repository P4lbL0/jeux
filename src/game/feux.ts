import Phaser from "phaser";
import { REGLAGES_INCENDIE, type Foyer } from "../core/incendie";
import {
  CADENCE_FLAMME,
  CLES_FLAMME,
  CLE_LUEUR,
  cuireLeFeu,
  HAUTEUR_FLAMME,
} from "./dessin/feu";

/**
 * Ce qu'on voit d'un incendie (DESIGN.md §4.21).
 *
 * Le noyau (`core/incendie.ts`) sait ou ca brule et combien de temps ; ce
 * fichier ne fait que **montrer** : une flamme par foyer, une lueur par foyer,
 * et rien d'autre. Il ne decide de rien.
 *
 * ⚠️ **Rien n'est fabrique en jeu** (§4.17, regle 3) : les flammes et les
 * lueurs sont un **pool** cree une fois, rendu visible ou non. Un feu qui
 * s'allume ne construit pas d'objet, il en reveille un — et le seizieme feu
 * simultane ne se voit pas, ce qui n'arrive que si le village entier brule,
 * moment ou le joueur a d'autres soucis que de compter les flammes.
 */

/** Combien de feux se voient en meme temps. Au-dela, ca brule sans se voir. */
const POOL = 16;

/** La lueur passe au-dessus du voile de nuit (900), comme l'eclair d'orage. */
const PROFONDEUR_LUEUR = 904;

/**
 * Ce que la lueur respire : son echelle va et vient autour de 1.
 *
 * Une lumiere de feu qui ne bouge pas est une tache ; une qui bat trop est une
 * alarme. Un dixieme, en deux secondes et demie.
 */
const RESPIRATION = 0.1;
const SOUFFLE = 2_500;

export class Feux {
  private readonly flammes: Phaser.GameObjects.Image[] = [];
  private readonly lueurs: Phaser.GameObjects.Image[] = [];

  constructor(scene: Phaser.Scene) {
    cuireLeFeu(scene);

    for (let i = 0; i < POOL; i++) {
      this.lueurs.push(
        scene.add
          .image(0, 0, CLE_LUEUR)
          .setVisible(false)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setDepth(PROFONDEUR_LUEUR),
      );
      this.flammes.push(scene.add.image(0, 0, CLES_FLAMME[0]!).setOrigin(0.5, 1).setVisible(false));
    }
  }

  /**
   * Une image de feu.
   *
   * @param foyers ceux qui brulent, tels que le noyau les tient
   * @param maintenant l'horloge de la scene : c'est elle qui alterne les images
   */
  majorer(foyers: readonly Foyer[], maintenant: number): void {
    const image = CLES_FLAMME[Math.floor(maintenant / CADENCE_FLAMME) % CLES_FLAMME.length]!;
    // Le souffle est commun a tous les feux : un seul cosinus par image, et
    // deux feux voisins respirent ensemble — ce qui, a l'oeil, ressemble a un
    // meme vent plutot qu'a deux objets independants.
    const souffle = 1 + Math.cos((maintenant / SOUFFLE) * Math.PI * 2) * RESPIRATION;

    for (let i = 0; i < POOL; i++) {
      const foyer = foyers[i];
      const flamme = this.flammes[i]!;
      const lueur = this.lueurs[i]!;

      if (!foyer) {
        flamme.setVisible(false);
        lueur.setVisible(false);
        continue;
      }

      // La flamme se pose sur le milieu de ce qui brule, un peu haut : sur une
      // maison c'est le toit, sur un champ c'est le ble.
      flamme
        .setTexture(image)
        .setPosition(foyer.x, foyer.y + HAUTEUR_FLAMME / 3)
        .setVisible(true)
        // Devant ce qui brule : la profondeur du monde suit le pied, et le pied
        // de la flamme est le sien.
        .setDepth(foyer.y + HAUTEUR_FLAMME);

      // Une flamme qui vient de prendre est petite, une qui a pris est
      // entiere : l'ardeur se lit dans la taille, sans barre ni chiffre.
      const force = Math.max(0.45, Math.min(1, foyer.ardeur / REGLAGES_INCENDIE.ardeurAuDepart));
      flamme.setScale(souffle * force);
      lueur.setPosition(foyer.x, foyer.y).setVisible(true).setScale(souffle * force);
    }
  }

  /** Plus rien ne brule : une fin de partie, une reprise. */
  toutCacher(): void {
    for (const f of this.flammes) f.setVisible(false);
    for (const l of this.lueurs) l.setVisible(false);
  }
}
