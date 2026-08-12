import Phaser from "phaser";

/**
 * Le seul endroit du jeu qui connait la palette de l'interface
 * (DESIGN.md §4.10, section « La direction artistique de l'interface »).
 *
 * **Pourquoi ce fichier existe.** Neuf ecrans ont ete construits l'un apres
 * l'autre, chacun avec ses couleurs et ses cadres : on en est arrive a 48
 * valeurs de couleur, six tons dores differents, et cinq zones de texte posees
 * a nu sur de l'herbe verte. Ce n'etait pas un probleme a retoucher ecran par
 * ecran — il fallait un module qui porte la regle, et des ecrans qui la
 * demandent.
 *
 * Fer, os, sang. Sombre, rapeux, metallique. Le monde reste WorldBox (§4.11),
 * l'interface est faite d'une autre matiere : une interface de la meme matiere
 * que le terrain disparait dedans.
 *
 * ⚠️ **Rien d'autre dans `src/game/` ni dans `src/scenes/` ne redefinit une
 * couleur d'interface.** Si une teinte manque ici, on l'ajoute ici.
 *
 * Ce fichier ne connait pas le jeu : ni heros, ni village, ni sauvegarde. Il ne
 * sait dessiner qu'une plaque de metal et poser du texte dessus.
 */

// --------------------------------------------------------------- la palette

/**
 * ⚠️ **Les neuf couleurs vivent maintenant dans `couleurs.ts`**, et ce fichier
 * les reexporte : rien ne change pour ses lecteurs, `chrome.ts` reste le seul
 * endroit ou l'on va chercher une couleur d'interface.
 *
 * Elles ont demenage le 12 aout 2026 parce que le §4.30 fait descendre **tout
 * le monde** d'elles — la pierre, le bois, la chair — et que la palette du monde
 * doit pouvoir etre **testee** hors navigateur. Ce fichier importe Phaser, qui
 * touche `window` des son chargement ; neuf entiers n'ont pas a en dependre.
 */
export { C, T } from "./couleurs";
import { C, T } from "./couleurs";

/**
 * Le biseau et l'ombre du cadre.
 *
 * Ce ne sont pas des couleurs de la palette : ce sont la lumiere et l'ombre de
 * la plaque, donc elles se derivent d'elle et n'ont pas a etre choisies.
 */
const BISEAU = 0x4a3a34;
const OMBRE = 0x0a0707;

/**
 * **La police du jeu, et il n'y en a qu'une** (§4.10).
 *
 * Choisie le 11 aout 2026 sur pieces, en comparant onze polices rendues dans ces
 * memes panneaux : **Oswald**, condensee et dense, lisible a 12 px et jusqu'a
 * 10. Elle remplace `monospace`, qui n'etait pas un choix mais un defaut — et
 * qui rendait differemment sur chaque machine, puisque le navigateur y mettait
 * ce qu'il avait.
 *
 * ⚠️ **Condensee veut dire que la meme phrase tient dans moins de large.** Les
 * panneaux qui calculaient leur largeur en comptant les caracteres se retrouvent
 * donc trop larges, jamais trop etroits — c'est le bon sens de l'erreur, mais il
 * faudra les reprendre en regardant l'image.
 *
 * Elle est embarquee dans le depot (`src/police.css`) et attendue au demarrage
 * (`main.ts`) : un canvas ne se repeint pas quand une police arrive en retard.
 */
export const POLICE = "Oswald";

// ------------------------------------------------------------- les elements

/** Un panneau : sa plaque, et la place qui reste dedans. */
export interface Plaque {
  x: number;
  y: number;
  largeur: number;
  hauteur: number;
}

/** Hauteur d'une barre de titre, en pixels. Le corps commence en dessous. */
export const HAUTEUR_TITRE = 22;

/** Marge interieure d'un panneau : le texte ne touche jamais le cadre. */
export const MARGE = 12;

/**
 * Le cadre unique : plaque de fer, biseau clair en haut, ombre en bas, trait
 * noir tout autour (§4.10, regle 2).
 *
 * ⚠️ **Le fond est OPAQUE, sans exception** (regle 1). Pas 72 %, pas 85 % : une
 * capture d'ecran a montre que du texte sur un panneau translucide pose sur de
 * l'herbe en plein soleil ne se lit pas, et une ligne illisible vaut une ligne
 * perdue.
 *
 * @param accent liseré de sang seche autour de la plaque — reserve a ce qui est
 *        actif, selectionne, ou le plus avance. Par defaut il n'y en a pas.
 */
export function cadre(g: Phaser.GameObjects.Graphics, p: Plaque, accent = false): void {
  const { x, y, largeur: l, hauteur: h } = p;

  g.fillStyle(C.fer, 1);
  g.fillRect(x, y, l, h);

  // Le biseau et l'ombre donnent l'epaisseur : sans eux, une plaque opaque
  // n'est qu'un rectangle noir pose sur l'image.
  g.fillStyle(BISEAU, 1);
  g.fillRect(x, y, l, 1);
  g.fillRect(x, y, 1, h);
  g.fillStyle(OMBRE, 1);
  g.fillRect(x, y + h - 1, l, 1);
  g.fillRect(x + l - 1, y, 1, h);

  g.lineStyle(1, accent ? C.sangSeche : 0x000000, 1);
  g.strokeRect(x - 0.5, y - 0.5, l + 1, h + 1);
}

/**
 * La barre de titre : sanglante, en haut du corps en fer (§4.10, regle 3).
 *
 * Elle se dessine **par-dessus** un cadre deja pose. Elle ne place pas le texte
 * du titre : celui-ci est un objet Texte fabrique une fois par son proprietaire
 * (§4.17 regle 3), qu'on positionne avec `yTitre`.
 */
export function barreDeTitre(g: Phaser.GameObjects.Graphics, p: Plaque): void {
  g.fillStyle(C.sangSeche, 1);
  g.fillRect(p.x + 1, p.y + 1, p.largeur - 2, HAUTEUR_TITRE);
  // Le sang seche est sombre : sans cette arete, le titre et le corps se
  // confondent des qu'on regarde l'ecran de loin.
  g.fillStyle(OMBRE, 1);
  g.fillRect(p.x + 1, p.y + 1 + HAUTEUR_TITRE, p.largeur - 2, 1);
}

/** Ou poser le texte d'une barre de titre, pour qu'il tombe au milieu. */
export function yTitre(p: Plaque): number {
  return p.y + 1 + Math.floor((HAUTEUR_TITRE - 12) / 2);
}

/** Ou commence le corps d'un panneau a barre de titre. */
export function yCorps(p: Plaque): number {
  return p.y + HAUTEUR_TITRE + MARGE;
}

/** Un creux dans la plaque : fond de jauge, champ de saisie, case d'icone. */
export function creux(g: Phaser.GameObjects.Graphics, p: Plaque): void {
  g.fillStyle(OMBRE, 1);
  g.fillRect(p.x, p.y, p.largeur, p.hauteur);
  g.fillStyle(BISEAU, 0.5);
  g.fillRect(p.x, p.y + p.hauteur - 1, p.largeur, 1);
}

/** Les couleurs d'une jauge, du plein au presque vide. */
export interface TonsJauge {
  plein: number;
  moitie: number;
  critique: number;
}

/** Une jauge de vie : bile quand ca va, laiton a mi-course, sang frais sous le seuil. */
export const JAUGE_VIE: TonsJauge = {
  plein: C.bile,
  moitie: C.laiton,
  critique: C.sangFrais,
};

/**
 * Une jauge, avec le repere des 20 % (§4.10).
 *
 * **Ce repere est l'information la plus importante de l'ecran** : c'est lui qui
 * verrouille le changement de heros et declenche le repli de l'IA (§4.3). Il se
 * dessine donc **par-dessus** le remplissage, jamais dessous.
 *
 * @param ratio de 0 a 1, borne ici — un appelant n'a pas a s'en soucier.
 * @param seuil position du repere, de 0 a 1. Omis, il n'y en a pas.
 */
export function jauge(
  g: Phaser.GameObjects.Graphics,
  p: Plaque,
  ratio: number,
  tons: TonsJauge = JAUGE_VIE,
  seuil?: number,
): void {
  creux(g, p);

  const part = Phaser.Math.Clamp(ratio, 0, 1);
  if (part > 0) {
    const couleur = seuil !== undefined && part <= seuil
      ? tons.critique
      : part < 0.5
        ? tons.moitie
        : tons.plein;
    g.fillStyle(couleur, 1);
    g.fillRect(p.x, p.y, Math.max(1, p.largeur * part), p.hauteur);
  }

  if (seuil !== undefined) {
    g.fillStyle(C.os, 0.9);
    g.fillRect(p.x + p.largeur * seuil - 1, p.y - 2, 2, p.hauteur + 4);
  }
}

/**
 * Une etiquette : majuscules espacees, os mat, petite (§4.10, regle 4).
 *
 * Les etiquettes nomment, elles ne disent pas. Le texte courant, lui, reste en
 * minuscules et en os plein — c'est ce qui les distingue au premier coup d'oeil
 * sans avoir besoin d'une couleur de plus.
 */
export function etiquette(
  scene: Phaser.Scene,
  x: number,
  y: number,
  contenu: string,
  taille = 10,
): Phaser.GameObjects.Text {
  return scene.add.text(x, y, espacer(contenu.toUpperCase()), {
    fontFamily: POLICE,
    fontSize: `${taille}px`,
    color: T.osMat,
  });
}

/** Du texte courant : os plein, minuscules, la taille qu'on lui donne. */
export function texte(
  scene: Phaser.Scene,
  x: number,
  y: number,
  taille = 12,
  couleur: string = T.os,
): Phaser.GameObjects.Text {
  return scene.add.text(x, y, "", {
    fontFamily: POLICE,
    fontSize: `${taille}px`,
    color: couleur,
    lineSpacing: 2,
  });
}

/**
 * Les majuscules espacees des etiquettes.
 *
 * Phaser n'expose pas `letterSpacing` sur un objet Texte : on ecarte donc les
 * lettres a la main.
 *
 * ⚠️ **Ne pas s'en servir pour aligner quoi que ce soit.** Du temps du
 * monospace, l'espace ajoute valait exactement une demi-chasse et les colonnes
 * suivaient ; la police est condensee et proportionnelle depuis le 11 aout, donc
 * cet espace ne mesure plus rien de fixe. Il n'ecarte que des lettres.
 */
export function espacer(contenu: string): string {
  return contenu.split("").join(" ");
}

/**
 * Un bouton : plaque de metal, etiquette en laiton, liseré sanglant au survol.
 *
 * Il fabrique ses objets **une fois** et ne fait ensuite que se redessiner
 * (§4.17 regle 3). Son cadre est un `Graphics` qui n'est repris que quand
 * quelque chose bouge — le survol, ou la fenetre qui change de taille.
 */
export class Bouton {
  private readonly fond: Phaser.GameObjects.Graphics;
  private readonly libelle: Phaser.GameObjects.Text;
  private readonly zone: Phaser.GameObjects.Zone;
  private survole = false;
  private actif = true;
  private plaque: Plaque = { x: 0, y: 0, largeur: 0, hauteur: 0 };

  constructor(
    scene: Phaser.Scene,
    contenu: string,
    private readonly action: () => void,
    profondeur = 1500,
    taille = 12,
  ) {
    this.fond = scene.add.graphics().setDepth(profondeur);
    this.libelle = scene.add
      .text(0, 0, contenu, { fontFamily: POLICE, fontSize: `${taille}px`, color: T.laiton })
      .setOrigin(0.5)
      .setDepth(profondeur + 1);
    this.zone = scene.add
      .zone(0, 0, 1, 1)
      .setOrigin(0)
      .setDepth(profondeur + 2)
      .setInteractive({ useHandCursor: true })
      .on("pointerover", () => {
        this.survole = true;
        this.redessiner();
      })
      .on("pointerout", () => {
        this.survole = false;
        this.redessiner();
      })
      .on("pointerdown", () => {
        if (this.actif) this.action();
      });
  }

  placer(p: Plaque): this {
    this.plaque = p;
    this.libelle.setPosition(p.x + p.largeur / 2, p.y + p.hauteur / 2);
    this.zone.setPosition(p.x, p.y).setSize(p.largeur, p.hauteur);
    this.redessiner();
    return this;
  }

  /** Un bouton eteint garde sa place : le joueur voit ce qui existe et lui manque. */
  activer(actif: boolean): this {
    if (this.actif === actif) return this;
    this.actif = actif;
    this.libelle.setColor(actif ? T.laiton : T.osMat);
    this.redessiner();
    return this;
  }

  texte(contenu: string): this {
    this.libelle.setText(contenu);
    return this;
  }

  visible(visible: boolean): this {
    this.fond.setVisible(visible);
    this.libelle.setVisible(visible);
    this.zone.setVisible(visible);
    // Une zone invisible qui capte encore le clic est un piege a fantomes :
    // on cliquerait un bouton ferme a travers le panneau ouvert par-dessus.
    if (visible) this.zone.setInteractive({ useHandCursor: true });
    else this.zone.disableInteractive();
    return this;
  }

  detruire(): void {
    this.fond.destroy();
    this.libelle.destroy();
    this.zone.destroy();
  }

  private redessiner(): void {
    const g = this.fond;
    g.clear();
    if (this.plaque.largeur === 0) return;

    const p = this.plaque;
    g.fillStyle(this.actif ? C.plaque : C.fer, 1);
    g.fillRect(p.x, p.y, p.largeur, p.hauteur);
    g.fillStyle(BISEAU, 1);
    g.fillRect(p.x, p.y, p.largeur, 1);
    g.fillStyle(OMBRE, 1);
    g.fillRect(p.x, p.y + p.hauteur - 1, p.largeur, 1);
    g.lineStyle(1, this.survole && this.actif ? C.sangSeche : 0x000000, 1);
    g.strokeRect(p.x - 0.5, p.y - 0.5, p.largeur + 1, p.hauteur + 1);
  }
}

/**
 * « LE PROTECTEUR », en haut des deux ecrans d'avant-partie (§4.10).
 *
 * **C'est le seul endroit du jeu ou l'interface a le droit d'etre grosse et
 * sale** : lettres serrees, ombre portee en sang seche. Partout ailleurs elle se
 * tait. Ces deux ecrans donnent le ton avant qu'on ait joue une seconde, et un
 * titre timide dirait exactement le contraire de ce que le jeu raconte.
 */
export function titreDuJeu(
  scene: Phaser.Scene,
  x: number,
  y: number,
  taille = 44,
): Phaser.GameObjects.Text {
  return scene.add
    .text(x, y, "LE PROTECTEUR", {
      fontFamily: POLICE,
      fontSize: `${taille}px`,
      color: T.titre,
    })
    .setOrigin(0.5)
    .setShadow(3, 3, T.sangSeche, 0, true, true);
}

/**
 * Change la couleur d'un texte **seulement si elle change vraiment**.
 *
 * ⚠️ `setColor` n'a aucun court-circuit dans Phaser : il repasse par
 * `updateText()` et **re-fabrique la texture du texte a chaque appel**. Appele a
 * chaque image — ce que faisait le compteur du village pour son clignotement —
 * ca rasterise du texte soixante fois par seconde pour rien. `setText`, lui,
 * court-circuite tout seul quand le contenu est identique (§4.17).
 */
export function teindre(t: Phaser.GameObjects.Text, couleur: string): void {
  if (t.style.color !== couleur) t.setColor(couleur);
}

/**
 * La teinte d'une valeur qui monte ou qui descend (§4.10) : bile quand ca va,
 * sang frais quand ca va mal.
 *
 * ⚠️ Le sang frais ne sert **qu'a ce qui peut tuer**. Ne pas s'en servir pour un
 * chiffre qui baisse sans consequence : s'il decore, il ne veut plus rien dire.
 */
export function tonSelon(bon: boolean): string {
  return bon ? T.bile : T.sangFrais;
}
