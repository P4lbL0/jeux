import Phaser from "phaser";
import { LIGNES_FERMEE, lireLigne, type Journal, type Voix } from "../core/journal";
import { C, T, cadre, espacer, texte, type Plaque } from "./ui/chrome";
import { largeurEcran, hauteurEcran } from "./ui/ecran";

/** Marges au bord bas-droit. Le bas-gauche est pris par les capacites. */
const MARGE_X = 16;
const MARGE_Y = 16;
const LARGEUR = 380;
const HAUTEUR_LIGNE = 18;

/** Ouverte : la colonne monte jusque-la, pas plus haut. */
const HAUTEUR_OUVERTE_MAX = 520;
/** Nombre d'objets Texte fabriques pour la colonne ouverte, une fois pour toutes. */
const LIGNES_OUVERTE = 26;

/**
 * Une voix par source, jamais par evenement (DESIGN.md §4.10).
 *
 * ⚠️ Six couleurs, et elles ne bougent pas : c'est ce qui fait qu'on reconnait
 * qui parle sans lire. Si un evenement neuf ne rentre dans aucune de ces six
 * voix, c'est le §4.10 qu'on rouvre — pas cette table qu'on allonge.
 */
const COULEURS: Record<Voix, string> = {
  guet: T.sangFrais,
  village: T.bile,
  eglise: T.laiton,
  port: T.acier,
  heros: T.cielSale,
  toi: T.osMat,
};

/**
 * La discussion, en bas a droite (DESIGN.md §4.10).
 *
 * Ce n'est pas un journal : chaque ligne a une **voix** derriere elle. Fermee,
 * elle montre les trois dernieres — on joue sans jamais l'ouvrir. Ouverte, elle
 * deroule tout l'historique, coupe par jour, sur une colonne qui defile.
 *
 * ⚠️ **Aucun objet Texte n'est fabrique en cours de partie** (§4.17 regle 3) :
 * les trois lignes fermees et les vingt-six de la colonne ouverte existent des
 * le demarrage et ne font que changer de contenu. Ce qui defile, c'est la
 * fenetre de lecture, pas les objets.
 */
export class BoiteJournal {
  private readonly fond: Phaser.GameObjects.Graphics;
  private readonly fermees: Phaser.GameObjects.Text[] = [];
  private readonly ouvertes: Phaser.GameObjects.Text[] = [];
  private readonly titre: Phaser.GameObjects.Text;
  private readonly zone: Phaser.GameObjects.Zone;

  private ouverte = false;
  /** Rang de la premiere ligne affichee, en partant du bas de l'historique. */
  private decalage = 0;

  private versionAffichee = -1;
  private largeurEcran = -1;
  private hauteurEcran = -1;
  private etatAffiche = "";

  constructor(private readonly scene: Phaser.Scene) {
    this.fond = scene.add.graphics().setDepth(1398).setScrollFactor(0);

    for (let i = 0; i < LIGNES_FERMEE; i += 1) {
      this.fermees.push(this.ligne(13).setOrigin(1, 1));
    }
    for (let i = 0; i < LIGNES_OUVERTE; i += 1) {
      this.ouvertes.push(this.ligne(12).setOrigin(0, 0).setVisible(false));
    }

    this.titre = this.ligne(11)
      .setText(espacer("LA DISCUSSION"))
      .setColor(T.titre)
      .setVisible(false);

    // Cliquer la boite l'ouvre ; la molette y fait defiler l'historique.
    this.zone = scene.add
      .zone(0, 0, 10, 10)
      .setOrigin(0)
      .setDepth(1401)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", () => this.basculer())
      .on(
        "wheel",
        (_p: Phaser.Input.Pointer, _x: number, _y: number, deltaY: number) => {
          if (!this.ouverte) return;
          this.faireDefiler(deltaY > 0 ? -1 : 1);
        },
      );
  }

  private ligne(taille: number): Phaser.GameObjects.Text {
    return texte(this.scene, 0, 0, taille, T.os)
      .setWordWrapWidth(LARGEUR - 24)
      .setDepth(1400)
      .setScrollFactor(0);
  }

  basculer(): void {
    this.ouverte = !this.ouverte;
    this.decalage = 0;
    this.etatAffiche = "";
  }

  /**
   * @param sens +1 remonte dans le temps, -1 redescend vers le present.
   */
  private faireDefiler(sens: number): void {
    this.decalage = Math.max(0, this.decalage + sens * 3);
    this.etatAffiche = "";
  }

  /**
   * Ne redessine que si la discussion a bouge, si on l'a ouverte, ou si la
   * fenetre a change de taille. Appelee a chaque image, elle ne doit rien
   * couter le reste du temps (§4.17).
   */
  rafraichir(journal: Journal): void {
    const largeur = largeurEcran(this.scene);
    const hauteur = hauteurEcran(this.scene);
    const etat = `${this.ouverte}|${this.decalage}`;
    const memeEcran = largeur === this.largeurEcran && hauteur === this.hauteurEcran;
    if (journal.version === this.versionAffichee && memeEcran && etat === this.etatAffiche) return;

    this.versionAffichee = journal.version;
    this.largeurEcran = largeur;
    this.hauteurEcran = hauteur;
    this.etatAffiche = etat;

    this.fond.clear();
    if (this.ouverte) this.dessinerOuverte(journal);
    else this.dessinerFermee(journal);
  }

  // ------------------------------------------------------------------ fermee

  private dessinerFermee(journal: Journal): void {
    for (const t of this.ouvertes) t.setVisible(false);
    this.titre.setVisible(false);

    const contenu = journal.dernieres;
    const x = largeurEcran(this.scene) - MARGE_X;
    const bas = hauteurEcran(this.scene) - MARGE_Y;

    // On dessine du bas vers le haut : la ligne la plus recente est la plus
    // basse, donc celle que l'oeil trouve sans chercher.
    let y = bas - 8;
    let plusHaut = y;
    let plusLarge = 0;

    for (let rang = 0; rang < this.fermees.length; rang += 1) {
      const t = this.fermees[rang];
      if (!t) continue;

      const ligne = contenu[contenu.length - 1 - rang];
      if (!ligne) {
        t.setVisible(false).setText("");
        continue;
      }

      t.setVisible(true).setText(lireLigne(ligne));
      t.setColor(COULEURS[ligne.voix]);
      t.setPosition(x - 12, y);

      y -= Math.max(HAUTEUR_LIGNE, t.height);
      plusHaut = y;
      plusLarge = Math.max(plusLarge, t.width);
    }

    if (contenu.length === 0) {
      this.zone.setPosition(x - 60, bas - 30).setSize(60, 30);
      return;
    }

    // Le fond epouse le texte au lieu d'occuper toujours la largeur maximale :
    // un bandeau de 400 px pour dire « Jour 2 » masque du terrain pour rien.
    const p: Plaque = {
      x: x - plusLarge - 24,
      y: plusHaut + 4,
      largeur: plusLarge + 24,
      hauteur: bas - plusHaut - 4,
    };
    cadre(this.fond, p);
    this.zone.setPosition(p.x, p.y).setSize(p.largeur, p.hauteur);
  }

  // ------------------------------------------------------------------ouverte

  /**
   * Tout l'historique, coupe par jour, les plus recentes en bas.
   *
   * On remplit **du bas vers le haut** en partant de `decalage`, et on s'arrete
   * des qu'on a rempli la hauteur ou epuise les objets Texte : c'est ce qui
   * permet de derouler sept jours avec vingt-six lignes fabriquees une fois.
   */
  private dessinerOuverte(journal: Journal): void {
    for (const t of this.fermees) t.setVisible(false);

    const contenu = journal.contenu;
    const droite = largeurEcran(this.scene) - MARGE_X;
    const bas = hauteurEcran(this.scene) - MARGE_Y;
    const x = droite - LARGEUR;

    const hautLimite = Math.max(MARGE_Y + 90, bas - HAUTEUR_OUVERTE_MAX);
    const debut = Math.max(0, contenu.length - 1 - this.decalage);

    // On empile d'abord dans un tampon, puis on pose de haut en bas : la
    // hauteur d'un texte enveloppe n'est connue qu'une fois le texte pose.
    const aPoser: { t: Phaser.GameObjects.Text; hauteur: number }[] = [];
    let hauteurPrise = 0;
    let jourPrecedent = -1;
    let utilises = 0;

    const place = bas - hautLimite;

    /** Pose un texte dans le tampon. Rend faux quand il n'y a plus la place. */
    const empiler = (contenuLigne: string, couleur: string, marge: number): boolean => {
      const t = this.ouvertes[utilises];
      if (!t) return false;
      t.setVisible(true).setText(contenuLigne).setColor(couleur);
      const h = Math.max(HAUTEUR_LIGNE, t.height) + marge;
      if (hauteurPrise + h > place) return false;
      aPoser.push({ t, hauteur: h });
      hauteurPrise += h;
      utilises += 1;
      return true;
    };

    let plein = false;
    for (let i = debut; i >= 0 && !plein; i -= 1) {
      const ligne = contenu[i];
      if (!ligne) continue;

      // La coupure de journee s'ecrit **au-dessus** du premier evenement du
      // jour : quand on remonte, c'est au moment ou le jour change.
      if (jourPrecedent !== -1 && ligne.jour !== jourPrecedent) {
        if (!empiler(espacer(`JOUR ${jourPrecedent}`), T.osMat, 8)) break;
      }

      plein = !empiler(lireLigne(ligne), COULEURS[ligne.voix], 0);
      if (!plein) jourPrecedent = ligne.jour;
    }

    // Le jour le plus ancien affiche merite son titre lui aussi : sans lui, les
    // lignes du haut de la colonne ne sont datees de rien.
    if (jourPrecedent !== -1) empiler(espacer(`JOUR ${jourPrecedent}`), T.osMat, 8);

    for (let i = utilises; i < this.ouvertes.length; i += 1) this.ouvertes[i]?.setVisible(false);

    const p: Plaque = {
      x,
      y: bas - hauteurPrise - 40,
      largeur: LARGEUR,
      hauteur: hauteurPrise + 40,
    };
    cadre(this.fond, p);
    this.fond.fillStyle(C.sangSeche, 1);
    this.fond.fillRect(p.x + 1, p.y + 1, p.largeur - 2, 22);
    this.fond.fillStyle(0x0a0707, 1);
    this.fond.fillRect(p.x + 1, p.y + 23, p.largeur - 2, 1);

    this.titre.setVisible(true).setPosition(p.x + 12, p.y + 6);

    // `aPoser` est range du plus recent au plus vieux : on le repose a l'envers.
    let y = bas - 8;
    for (const { t, hauteur } of aPoser) {
      y -= hauteur;
      t.setPosition(p.x + 12, y);
    }

    this.zone.setPosition(p.x, p.y).setSize(p.largeur, p.hauteur);
  }

  detruire(): void {
    this.fond.destroy();
    this.zone.destroy();
    this.titre.destroy();
    for (const t of this.fermees) t.destroy();
    for (const t of this.ouvertes) t.destroy();
  }
}
