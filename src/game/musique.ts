import type Phaser from "phaser";
import calmeOgg from "../assets/son/musique-calme.ogg?url";
import calmeMp3 from "../assets/son/musique-calme.mp3?url";
import guerreOgg from "../assets/son/musique-guerre.ogg?url";
import guerreMp3 from "../assets/son/musique-guerre.mp3?url";
import boucles from "../assets/son/boucles.json";
import { ChoixDeMusique, REGLAGES_MUSIQUE, type Morceau } from "../core/musique";
import { jouer, type Boucle, type Voix } from "./son";

/**
 * La musique de la partie (DESIGN.md §4.10, « Le son ») : le calme le jour, la
 * guerre toute la nuit et des qu'un heros se bat, et entre les deux un fondu
 * enchaine — jamais une coupure. La regle est dans `core/musique.ts` ; ici, on
 * ne fait que jouer ce qu'elle dit, avec `son.ts`.
 *
 * Les deux morceaux sont fabriques par `npm run son` (`scripts/son/intro.ts`),
 * chacun prepare pour tourner sans fin : son introduction passe une fois, puis
 * son corps boucle entre les deux points de `boucles.json`.
 */

/** Un morceau livre : sa cle Phaser, ses fichiers (OGG puis MP3), sa boucle. */
export interface Fichier {
  cle: string;
  urls: readonly string[];
  boucle: Boucle;
}

export const MORCEAUX: Readonly<Record<Morceau, Fichier>> = {
  /**
   * « Lament for a Warrior's Soul » (RandomMind), choisie a l'oreille par
   * Angelos le 19 septembre 2026 parmi trois. Une minute d'introduction, puis
   * cinquante secondes qui tournent.
   */
  calme: { cle: "musique-calme", urls: [calmeOgg, calmeMp3], boucle: boucles["musique-calme"] },
  /**
   * « Lament of the War » (Cethiel), les tambours : sous le titre et en partie.
   * Une demi-minute d'introduction, puis deux minutes qui tournent, raccordees
   * la ou le morceau rejoue la meme mesure.
   */
  guerre: { cle: "musique-guerre", urls: [guerreOgg, guerreMp3], boucle: boucles["musique-guerre"] },
};

export class Musique {
  private readonly choix = new ChoixDeMusique();
  private voix: Voix | null = null;
  private enCours: Morceau | null = null;
  /** La partie est finie, ou la scene s'arrete : plus rien ne repart. */
  private eteinte = false;

  constructor(private readonly scene: Phaser.Scene) {}

  /** Ce qui joue — pour les scripts qui verifient le jeu sans oreille. */
  get etat(): { morceau: Morceau | null; joue: boolean } {
    return { morceau: this.enCours, joue: this.voix !== null };
  }

  /** Un heros vient de donner ou de recevoir un coup. */
  combat(): void {
    this.choix.combat();
  }

  /**
   * A chaque image hors pause : l'horloge avance, et la musique suit la
   * situation. Rien n'est cree ici tant que le morceau voulu joue deja.
   */
  maj(delta: number, nuit: boolean): void {
    if (this.eteinte) return;
    this.choix.avancer(delta);
    const voulu = this.choix.morceau(nuit);
    if (voulu !== this.enCours) this.passerA(voulu, nuit);
  }

  /**
   * Le fondu enchaine : le nouveau morceau monte pendant que l'ancien descend,
   * a puissance constante, chacun a sa vitesse (`REGLAGES_MUSIQUE.fondu`).
   *
   * La guerre appelee par la nuit part de son debut : son introduction monte
   * pendant que le jour tombe. Appelee par un combat de jour, elle part au
   * corps du morceau — pas le temps d'une ouverture, et ses dix premieres
   * secondes sont bien plus basses que le reste (mesure : 8 a 10 dB).
   */
  private passerA(morceau: Morceau, nuit: boolean): void {
    const fichier = MORCEAUX[morceau];
    const fondu = REGLAGES_MUSIQUE.fondu[morceau];
    const ancien = this.enCours;
    const depuis = morceau === "guerre" && !nuit ? fichier.boucle.depuis : 0;
    const nouvelle = jouer(this.scene, fichier.cle, "musique", {
      boucle: fichier.boucle,
      fondu,
      depuis,
      courbe: "puissance",
    });
    // Pas encore chargee, ou le son verrouille par le navigateur : ce qui joue
    // continue, et on reessaie a l'image suivante.
    if (!nouvelle) return;
    this.voix?.arreter(ancien ? REGLAGES_MUSIQUE.fondu[ancien] : fondu);
    this.voix = nouvelle;
    this.enCours = morceau;
  }

  /** Tout descend en `fondu` secondes, et plus rien ne repart. */
  eteindre(fondu: number): void {
    this.eteinte = true;
    this.voix?.arreter(fondu);
    this.voix = null;
    this.enCours = null;
  }
}
