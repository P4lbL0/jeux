import Phaser from "phaser";
import { NOMS_FORMATION, NOMS_POSTURE, type Formation, type Posture } from "../core/ordres";
import { T, cadre, espacer, teindre, texte, type Plaque } from "./ui/chrome";

/**
 * Le bandeau des ordres, sous la barre d'equipe (DESIGN.md §4.4).
 *
 * Il repond a une seule question, mais elle est vitale en plein combat : « si
 * j'appuie maintenant, qui obeit ? ». Sans elle, le joueur donne des ordres a
 * l'aveugle et croit a un bug quand ils partent au mauvais endroit.
 *
 * ⚠️ **Il etait pose a nu sur l'herbe** : trois textes gris sur du vert, qu'on
 * ne lisait pas. Il a maintenant sa plaque, opaque comme partout ailleurs
 * (§4.10, regle 1).
 *
 * Aucun objet Texte n'est cree ici en cours de partie : les trois libelles sont
 * fabriques une fois et recycles (regle 3 du §4.17), et la plaque n'est reprise
 * que quand sa taille change (regle 5).
 */

export interface EtatOrdres {
  formation: Formation;
  /** Null quand la selection n'est pas d'accord sur une meme posture */
  posture: Posture | null;
  nombreVises: number;
  /** Le joueur a-t-il choisi des heros, ou l'ordre vaut-il pour tout le monde ? */
  selectionExplicite: boolean;
  /** Confirmation fugace du dernier ordre donne ; vide le reste du temps */
  message: string;
}

/**
 * ⚠️ Le sang frais est reserve a ce qui peut tuer (§4.10) : le repli est un
 * ordre, pas un danger. Les trois postures se distinguent donc par le laiton,
 * l'os et l'acier, jamais par du rouge.
 */
const COULEURS_POSTURE: Record<Posture, string> = {
  temporiser: T.acier,
  agressif: T.laiton,
  repli: T.osMat,
};

const LARGEUR = 232;
const HAUTEUR = 58;

export class PanneauOrdres {
  private readonly fond: Phaser.GameObjects.Graphics;
  private readonly cible: Phaser.GameObjects.Text;
  private readonly posture: Phaser.GameObjects.Text;
  private readonly message: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.fond = scene.add.graphics().setDepth(1002);
    const p: Plaque = { x, y, largeur: LARGEUR, hauteur: HAUTEUR };
    cadre(this.fond, p);

    this.cible = texte(scene, x + 10, y + 8, 11, T.osMat).setDepth(1003);
    this.posture = texte(scene, x + 10, y + 24, 11, T.acier).setDepth(1003);
    this.message = texte(scene, x + 10, y + 40, 11, T.os).setDepth(1003);
  }

  rafraichir(etat: EtatOrdres): void {
    this.cible.setText(
      etat.selectionExplicite
        ? `${espacer("ORDRES")}  ${etat.nombreVises} selectionne${etat.nombreVises > 1 ? "s" : ""}`
        : `${espacer("ORDRES")}  toute l'equipe (${etat.nombreVises})`,
    );
    teindre(this.cible, etat.selectionExplicite ? T.os : T.osMat);

    const posture = etat.posture ? NOMS_POSTURE[etat.posture] : "postures melangees";
    this.posture.setText(`${posture}  ·  ${NOMS_FORMATION[etat.formation]}`);
    teindre(this.posture, etat.posture ? COULEURS_POSTURE[etat.posture] : T.osMat);

    this.message.setText(etat.message);
  }

  detruire(): void {
    this.fond.destroy();
    this.cible.destroy();
    this.posture.destroy();
    this.message.destroy();
  }
}
