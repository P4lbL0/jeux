import Phaser from "phaser";
import { TACHES, tachesPour, type GroupeTache, type Population, type TacheId } from "../core/ordres";
import {
  C,
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
 * Le menu d'ordres (DESIGN.md §4.4, bloc 8).
 *
 * **Une liste verticale collee a la personne**, et pas un menu radial — c'est
 * le choix d'Angelos du 21 septembre 2026, et il a une raison qui tient : les
 * taches vont s'ajouter a chaque jalon (les defenses au 7, la banque au 8, les
 * portails au 13), et une couronne plafonne a huit entrees. Le §4.4 avait deja
 * ecarte le clic droit contextuel pour exactement la meme raison : **le menu
 * doit montrer tout ce qu'on peut demander.**
 *
 * Il ne decide rien : il affiche ce que `core/ordres.ts` autorise pour les
 * populations selectionnees, et il rend l'identifiant de la ligne cliquee.
 *
 * Aucun objet Texte n'est cree en cours de partie (§4.17, regle 3) : les
 * quinze lignes sont fabriquees une fois, ecouteurs compris, et recyclees.
 */

export interface LigneMenu {
  id: TacheId;
  libelle: string;
  groupe: GroupeTache;
  /** Vrai quand toute la selection fait deja ca : la ligne s'eteint */
  courante: boolean;
}

export interface ContenuMenu {
  /** Ou l'ouvrir, en pixels d'ecran — la ou le pointeur a clique */
  x: number;
  y: number;
  titre: string;
  sousTitre: string;
  lignes: LigneMenu[];
}

const LARGEUR = 176;
const HAUTEUR_LIGNE = 17;
const MARGE = 10;
/** Blanc entre deux paquets : un filet, et la place pour le respirer. */
const ECART_GROUPE = 7;

/** L'ordre des paquets, et leur titre en une etiquette. */
const ENTETES: Record<GroupeTache, string> = {
  travail: "TRAVAIL",
  civil: "CONDUITE",
  combat: "AU COMBAT",
  moi: "AVEC MOI",
};

export class MenuOrdres {
  private readonly fond: Phaser.GameObjects.Graphics;
  private readonly titre: Phaser.GameObjects.Text;
  private readonly sousTitre: Phaser.GameObjects.Text;
  private readonly lignes: Phaser.GameObjects.Text[] = [];
  private readonly entetes: Phaser.GameObjects.Text[] = [];
  private visible = false;
  /** Ce que chaque ligne affichee commande en ce moment */
  private cibles: (TacheId | null)[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly choisir: (id: TacheId) => void,
  ) {
    this.fond = this.scene.add.graphics().setDepth(1700).setVisible(false).setScrollFactor(0);
    this.titre = this.fabriquer(T.titre, 11);
    this.sousTitre = this.fabriquer(T.osMat, 10);

    // Autant de lignes que le catalogue en compte : c'est le plafond, et il est
    // connu a la compilation. Un menu qui fabriquerait ses lignes a l'ouverture
    // creerait des objets en pleine partie (§4.17).
    for (let i = 0; i < TACHES.length; i++) {
      const ligne = this.fabriquer(T.os, 12);
      ligne.setInteractive({ useHandCursor: true });
      ligne.on("pointerover", () => {
        if (this.visible && this.cibles[i]) teindre(ligne, T.laiton);
      });
      ligne.on("pointerout", () => {
        if (this.visible) teindre(ligne, T.os);
      });
      ligne.on("pointerdown", (p: Phaser.Input.Pointer) => {
        if (!this.visible) return;
        // Le clic droit sur le menu ne choisit rien : il sert a poser une ancre
        // sur la carte, et le menu ne doit pas l'avaler.
        if (p.rightButtonDown()) return;
        const id = this.cibles[i];
        if (id) this.choisir(id);
      });
      this.lignes.push(ligne);
    }

    // Une etiquette de paquet par groupe possible.
    for (let i = 0; i < Object.keys(ENTETES).length; i++) {
      this.entetes.push(this.fabriquer(T.sangSeche, 9));
    }
  }

  private fabriquer(couleur: string, taille: number): Phaser.GameObjects.Text {
    return texte(this.scene, 0, 0, taille, couleur)
      .setDepth(1701)
      .setScrollFactor(0)
      .setVisible(false);
  }

  get ouvert(): boolean {
    return this.visible;
  }

  fermer(): void {
    if (!this.visible) return;
    this.visible = false;
    this.fond.setVisible(false);
    this.titre.setVisible(false);
    this.sousTitre.setVisible(false);
    for (const ligne of this.lignes) ligne.setVisible(false);
    for (const entete of this.entetes) entete.setVisible(false);
  }

  /**
   * Ouvre le menu a l'endroit demande.
   *
   * ⚠️ **Il se replie sur l'ecran.** Ouvert sur quelqu'un qui se tient en bas a
   * droite, un menu de trois cents pixels sortirait par deux cotes a la fois :
   * on le decale alors vers la gauche et vers le haut, au lieu de le laisser
   * pendre dans le vide.
   */
  afficher(contenu: ContenuMenu): void {
    this.fermer();
    if (contenu.lignes.length === 0) return;
    this.visible = true;

    this.titre.setText(espacer(contenu.titre.toUpperCase()));
    this.sousTitre.setText(contenu.sousTitre);

    // --- La hauteur se mesure sur ce qu'il y a dedans ---
    let hauteur = HAUTEUR_TITRE + 6 + 14 + 6;
    let groupePrecedent: GroupeTache | null = null;
    for (const ligne of contenu.lignes) {
      if (ligne.groupe !== groupePrecedent) {
        hauteur += ECART_GROUPE + 12;
        groupePrecedent = ligne.groupe;
      }
      hauteur += HAUTEUR_LIGNE;
    }
    hauteur += MARGE;

    const x = Phaser.Math.Clamp(contenu.x + 14, 4, this.scene.scale.width - LARGEUR - 4);
    const y = Phaser.Math.Clamp(contenu.y - 18, 4, this.scene.scale.height - hauteur - 4);
    const plaque: Plaque = { x, y, largeur: LARGEUR, hauteur };

    this.fond.clear();
    cadre(this.fond, plaque, true);
    barreDeTitre(this.fond, plaque);
    this.fond.setVisible(true);

    this.titre.setPosition(x + MARGE, yTitre(plaque)).setVisible(true);
    this.sousTitre.setPosition(x + MARGE, y + HAUTEUR_TITRE + 6).setVisible(true);

    // --- Les lignes, paquet par paquet ---
    this.cibles = [];
    let curseur = y + HAUTEUR_TITRE + 6 + 14 + 6;
    let entetesPosees = 0;
    groupePrecedent = null;

    contenu.lignes.forEach((ligne, index) => {
      if (ligne.groupe !== groupePrecedent) {
        groupePrecedent = ligne.groupe;
        curseur += ECART_GROUPE;
        this.fond.fillStyle(C.sangSeche, 0.5);
        this.fond.fillRect(x + MARGE, curseur - 3, LARGEUR - MARGE * 2, 1);
        const entete = this.entetes[entetesPosees++];
        if (entete) {
          entete
            .setText(espacer(ENTETES[ligne.groupe]))
            .setPosition(x + MARGE, curseur + 1)
            .setVisible(true);
        }
        curseur += 12;
      }

      const objet = this.lignes[index]!;
      objet.setText(ligne.libelle).setPosition(x + MARGE + 6, curseur).setVisible(true);
      // Ce qu'ils font deja s'eteint : le menu montre tout, mais il doit se
      // lire d'un coup d'oeil, et une ligne qui ne changerait rien n'est pas ce
      // qu'on cherche.
      teindre(objet, ligne.courante ? T.osMat : T.os);
      this.cibles[index] = ligne.courante ? null : ligne.id;
      curseur += HAUTEUR_LIGNE;
    });
  }

  detruire(): void {
    this.fond.destroy();
    this.titre.destroy();
    this.sousTitre.destroy();
    for (const ligne of this.lignes) ligne.destroy();
    for (const entete of this.entetes) entete.destroy();
  }
}

/**
 * Ce que le menu affiche pour une selection donnee.
 *
 * Pose ici et non dans la scene : c'est de la mise en forme, et une scene de
 * 7 500 lignes n'a pas besoin d'une quinzieme responsabilite.
 */
export function lignesDuMenu(
  populations: Population[],
  dejaFait: (id: TacheId) => boolean,
): LigneMenu[] {
  return tachesPour(populations).map((t) => ({
    id: t.id,
    libelle: t.libelle,
    groupe: t.groupe,
    courante: dejaFait(t.id),
  }));
}
