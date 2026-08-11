import Phaser from "phaser";
import { NOMS_RESSOURCE, RESSOURCES, type Ressource, type Stocks } from "../core/habitants";
import { lireCours, unitesPourUnePiece, valeurDe, type Cours } from "../core/port";
import {
  T,
  HAUTEUR_TITRE,
  barreDeTitre,
  cadre,
  espacer,
  teindre,
  texte,
  yTitre,
  type Plaque,
} from "./ui/chrome";

/**
 * Le panneau de vente (DESIGN.md §4.18, §4.10).
 *
 * Il ne s'ouvre que quand un navire est a quai et qu'on est au port : le reste
 * du temps il n'a rien a dire. Comme le tableau du village, **tous ses objets
 * Texte sont fabriques une fois** dans le constructeur et recycles — le §4.17
 * interdit d'en creer en cours de partie.
 *
 * ⚠️ **Il affiche les journees de vivres, et ce n'est pas decoratif.** Le §4.18
 * autorise a vendre le ble et le poisson, donc a s'affamer soi-meme, et rien ne
 * l'interdit. La seule contrepartie consentie est que le chiffre soit sous les
 * yeux **pendant** qu'on charge, et qu'il baisse a chaque lot. Le piege devient
 * une decision.
 */

/** Ce que le panneau a besoin de savoir, une fois par image. */
export interface EtatPortAffiche {
  /** Le port est-il debout ? */
  ouvert: boolean;
  navireAQuai: boolean;
  /** Le joueur est-il assez pres pour commercer ? */
  aPortee: boolean;
  argent: number;
  stocks: Stocks;
  cours: Cours;
  joursDeVivres: number;
}

/** Ce qu'un clic vend, et ce qu'un Maj + clic vend. */
export const LOT = 50;

export class PanneauPort {
  private fond: Phaser.GameObjects.Graphics;
  private entete: Phaser.GameObjects.Text;
  private titre: Phaser.GameObjects.Text;
  private aide: Phaser.GameObjects.Text;
  private lignes: Phaser.GameObjects.Text[] = [];
  private ouvert = false;

  /**
   * @param vendre appele avec la ressource et la quantite. Le panneau ne touche
   *        jamais aux stocks lui-meme : c'est `core/port.ts` qui vend, parce
   *        que c'est lui qui sait ce que ca fait au cours.
   */
  constructor(
    private scene: Phaser.Scene,
    private vendre: (ressource: Ressource, quantite: number) => void,
  ) {
    this.fond = scene.add.graphics().setDepth(1500).setVisible(false);
    this.entete = this.texte(T.titre, 11);
    this.entete.setText(espacer("LE PORT"));

    this.titre = this.texte(T.acier, 12);
    this.aide = this.texte(T.osMat, 10);

    RESSOURCES.forEach((ressource, index) => {
      const ligne = this.texte(T.os, 11);
      ligne.setInteractive({ useHandCursor: true });
      ligne.on("pointerdown", (p: Phaser.Input.Pointer) => {
        if (!this.ouvert) return;
        // Maj + clic vend tout. C'est la convention deja etablie partout
        // ailleurs — barre de heros, tableau du village : Maj veut dire « la
        // version etendue de ce geste » (§4.4, §4.18).
        this.vendre(ressource, p.event.shiftKey ? Number.POSITIVE_INFINITY : LOT);
      });
      this.lignes.push(ligne);
      void index;
    });
  }

  private texte(couleur: string, taille: number): Phaser.GameObjects.Text {
    return texte(this.scene, 0, 0, taille, couleur).setDepth(1501).setVisible(false);
  }

  basculer(): void {
    this.ouvert = !this.ouvert;
  }

  fermer(): void {
    this.ouvert = false;
  }

  get estOuvert(): boolean {
    return this.ouvert;
  }

  rafraichir(etat: EtatPortAffiche): void {
    // Le navire est reparti, ou l'on s'est eloigne : le panneau se referme tout
    // seul plutot que de mentir sur ce qu'on peut encore faire.
    if (this.ouvert && (!etat.navireAQuai || !etat.aPortee)) this.ouvert = false;

    this.fond.setVisible(this.ouvert);
    this.entete.setVisible(this.ouvert);
    this.titre.setVisible(this.ouvert);
    this.aide.setVisible(this.ouvert);
    for (const ligne of this.lignes) ligne.setVisible(this.ouvert);
    if (!this.ouvert) return;

    const vivres = etat.joursDeVivres;
    this.titre.setText(
      `Le navire est a quai — ${etat.argent} pieces  ·  ${
        Number.isFinite(vivres) ? `${vivres.toFixed(1)} j de vivres` : "personne a nourrir"
      }`,
    );
    // Le meme seuil que le tableau du village : sous deux journees, la
    // production s'arrete. Vendre sa derniere reserve reste permis — mais pas
    // sans que le chiffre vire au sang sous les doigts.
    teindre(this.titre, vivres < 2 ? T.sangFrais : T.acier);

    this.aide.setText(
      `Clic : vendre ${LOT}  ·  Maj+clic : tout vendre  ·  P : fermer
` +
        "Vendre fait baisser le cours de ce qu'on vend ; il remonte les jours suivants.",
    );

    RESSOURCES.forEach((ressource, index) => {
      const ligne = this.lignes[index]!;

      const stock = Math.floor(etat.stocks[ressource]);
      const cours = etat.cours[ressource];
      const lot = Math.min(LOT, stock);
      const gain = valeurDe(ressource, lot, etat.cours);

      // ⚠️ **Plus de colonnes calees a l'espace.** Elles ne tenaient qu'en
      // chasse fixe ; la police du jeu est condensee depuis le 11 aout (§4.10),
      // donc `padEnd` ne calait plus rien et laissait un tableau en dents de
      // scie. Un separateur explicite se lit dans n'importe quelle police.
      ligne.setText(
        `${NOMS_RESSOURCE[ressource]} ${stock}  ·  ` +
          `${unitesPourUnePiece(ressource, etat.cours).toFixed(1)} la piece, ${lireCours(cours)}` +
          `  ·  ${lot} -> ${gain} pieces`,
      );
      // La couleur dit le cours d'un coup d'oeil : c'est ce qui fait choisir
      // **quoi** charger sans lire quatre lignes. Ce qui monte est en bile, ce
      // qui descend en sang frais (§4.10) — vendre a perte est ce qui coute.
      teindre(ligne, cours >= 1.1 ? T.bile : cours <= 0.9 ? T.sangFrais : T.os);
    });

    // La plaque se mesure sur son contenu, comme le tableau du village : les
    // lignes de cours changent de longueur avec les chiffres.
    const contenus = [this.titre, this.aide, ...this.lignes];
    const largeur = Math.max(420, ...contenus.map((t) => t.width)) + 28;
    const hauteur = HAUTEUR_TITRE + 12 + 24 + RESSOURCES.length * 18 + 14 + this.aide.height + 12;

    const x = Math.round(this.scene.scale.width / 2 - largeur / 2);
    const y = Math.max(16, this.scene.scale.height - hauteur - 96);
    const plaque: Plaque = { x, y, largeur, hauteur };

    this.fond.clear();
    cadre(this.fond, plaque);
    barreDeTitre(this.fond, plaque);

    this.entete.setPosition(x + 14, yTitre(plaque));
    this.titre.setPosition(x + 14, y + HAUTEUR_TITRE + 10);
    const hautLignes = y + HAUTEUR_TITRE + 36;
    RESSOURCES.forEach((_, index) => {
      this.lignes[index]?.setPosition(x + 14, hautLignes + index * 18);
    });
    this.aide.setPosition(x + 14, hautLignes + RESSOURCES.length * 18 + 12);
  }
}
