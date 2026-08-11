import Phaser from "phaser";
import { NOMS_RESSOURCE, RESSOURCES, type Ressource, type Stocks } from "../core/habitants";
import { lireCours, unitesPourUnePiece, valeurDe, type Cours } from "../core/port";

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
  private cadre: Phaser.GameObjects.Rectangle;
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
    this.cadre = scene.add
      .rectangle(0, 0, 420, 40 + RESSOURCES.length * 18 + 40, 0x14161f, 0.94)
      .setOrigin(0)
      .setStrokeStyle(1, 0x6b7a8f)
      .setDepth(1500)
      .setVisible(false);

    this.titre = this.texte("#9ad8f0", "13px");
    this.aide = this.texte("#8f8a9e", "10px");

    RESSOURCES.forEach((ressource, index) => {
      const ligne = this.texte("#d8d2c4", "11px");
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

  private texte(couleur: string, taille: string): Phaser.GameObjects.Text {
    return this.scene.add
      .text(0, 0, "", { fontFamily: "monospace", fontSize: taille, color: couleur })
      .setDepth(1501)
      .setVisible(false);
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

    this.cadre.setVisible(this.ouvert);
    this.titre.setVisible(this.ouvert);
    this.aide.setVisible(this.ouvert);
    for (const ligne of this.lignes) ligne.setVisible(this.ouvert);
    if (!this.ouvert) return;

    const x = this.scene.scale.width / 2 - this.cadre.width / 2;
    const y = this.scene.scale.height - this.cadre.height - 90;
    this.cadre.setPosition(x, y);
    this.titre.setPosition(x + 14, y + 12);
    this.aide.setPosition(x + 14, y + 40 + RESSOURCES.length * 18 + 8);

    const vivres = etat.joursDeVivres;
    this.titre.setText(
      `LE NAVIRE EST A QUAI — ${etat.argent} pieces  ·  ${
        Number.isFinite(vivres) ? `${vivres.toFixed(1)} j de vivres` : "personne a nourrir"
      }`,
    );
    // Le meme seuil que le tableau du village : sous deux journees, la
    // production s'arrete. Vendre sa derniere reserve reste permis — mais pas
    // sans que le chiffre passe a l'orange sous les doigts.
    this.titre.setColor(vivres < 2 ? "#ff8a5a" : "#9ad8f0");

    RESSOURCES.forEach((ressource, index) => {
      const ligne = this.lignes[index]!;
      ligne.setPosition(x + 14, y + 40 + index * 18);

      const stock = Math.floor(etat.stocks[ressource]);
      const cours = etat.cours[ressource];
      const lot = Math.min(LOT, stock);
      const gain = valeurDe(ressource, lot, etat.cours);

      ligne.setText(
        `${NOMS_RESSOURCE[ressource].padEnd(9)} ${String(stock).padStart(5)}  ·  ` +
          `${unitesPourUnePiece(ressource, etat.cours).toFixed(1)} la piece, ${lireCours(cours)}` +
          `  ·  ${lot} -> ${gain} pieces`,
      );
      // La couleur dit le cours d'un coup d'oeil : c'est ce qui fait choisir
      // **quoi** charger sans lire quatre lignes.
      ligne.setColor(cours >= 1.1 ? "#7ee0a0" : cours <= 0.9 ? "#ff8a7a" : "#d8d2c4");
    });

    this.aide.setText(
      `Clic : vendre ${LOT}  ·  Maj+clic : tout vendre  ·  P : fermer\n` +
        "Vendre fait baisser le cours de ce qu'on vend ; il remonte les jours suivants.",
    );
  }
}
