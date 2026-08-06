import Phaser from "phaser";
import { NOMS_FORMATION, NOMS_POSTURE, type Formation, type Posture } from "../core/ordres";

/**
 * Le bandeau des ordres, sous la barre d'equipe (DESIGN.md §4.4).
 *
 * Il repond a une seule question, mais elle est vitale en plein combat : « si
 * j'appuie maintenant, qui obeit ? ». Sans elle, le joueur donne des ordres a
 * l'aveugle et croit a un bug quand ils partent au mauvais endroit.
 *
 * Aucun objet Texte n'est cree ici en cours de partie : les trois libelles sont
 * fabriques une fois et recycles (regle 3 du §4.17).
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

const COULEURS_POSTURE: Record<Posture, string> = {
  temporiser: "#5ec8f0",
  agressif: "#ff8a5a",
  repli: "#e6a23c",
};

export class PanneauOrdres {
  private cible: Phaser.GameObjects.Text;
  private posture: Phaser.GameObjects.Text;
  private message: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.cible = this.texte(scene, x, y, "#8f8a9e");
    this.posture = this.texte(scene, x, y + 14, "#5ec8f0");
    this.message = this.texte(scene, x, y + 28, "#f2e9d8");
  }

  private texte(
    scene: Phaser.Scene,
    x: number,
    y: number,
    couleur: string,
  ): Phaser.GameObjects.Text {
    return scene.add
      .text(x, y, "", { fontFamily: "monospace", fontSize: "11px", color: couleur })
      .setDepth(1003);
  }

  rafraichir(etat: EtatOrdres): void {
    this.cible.setText(
      etat.selectionExplicite
        ? `Ordres > ${etat.nombreVises} selectionne${etat.nombreVises > 1 ? "s" : ""}`
        : `Ordres > toute l'equipe (${etat.nombreVises})`,
    );
    this.cible.setColor(etat.selectionExplicite ? "#5ec8f0" : "#8f8a9e");

    const posture = etat.posture ? NOMS_POSTURE[etat.posture] : "postures melangees";
    this.posture.setText(`${posture}  ·  Formation : ${NOMS_FORMATION[etat.formation]}`);
    this.posture.setColor(etat.posture ? COULEURS_POSTURE[etat.posture] : "#8f8a9e");

    this.message.setText(etat.message);
  }
}
