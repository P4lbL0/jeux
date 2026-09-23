import Phaser from "phaser";
import { ecrireAction, ecrireActionCourte } from "../core/touches";
import type { Hero } from "./entities";
import { mappage } from "./touches";
import { C, T, cadre, creux, espacer, teindre, texte, type Plaque } from "./ui/chrome";
import { hauteurEcran } from "./ui/ecran";

/**
 * Panneau des capacites, en bas a gauche.
 *
 * Une capacite est soit l'ultime de la classe, soit une competence active
 * apprise en montant de niveau. Elles partagent le meme panneau et la meme
 * logique de touches : le clavier du joueur s'enrichit a mesure qu'il progresse
 * (DESIGN.md §4.2).
 *
 * Le panneau se reconstruit tout seul quand la liste change — apprendre une
 * competence active, ou changer de heros.
 *
 * ⚠️ **Son fond etait a 85 % et son accent etait `#f0c419`** — l'un des trois
 * dores du jeu. Il est maintenant opaque et en laiton, comme tout ce qui se
 * clique (§4.10). L'icone n'est plus teintee par la couleur de la classe :
 * celle-ci a quitte l'interface et ne vit plus que sur le sprite dans le monde.
 */

/**
 * ⚠️ **Elargi de 302 a 348 le 21 septembre 2026, et c'est une mesure.** La
 * description passait de 10 a 12 px (le plancher de lisibilite, `chrome.ts`) :
 * « Fauche tout ce qui l'entoure et le repousse au loin » mesurait 180 px, donc
 * 216 a la nouvelle taille — elle repassait a la ligne et la seconde ligne
 * tombait **sous** la plaque. Vu en capture.
 *
 * La hauteur suit : les descriptions les plus longues tiennent sur deux lignes
 * depuis toujours, et deux lignes de 12 px avec leur interligne font 30 px sous
 * un titre pose a 26.
 */
const LARGEUR = 348;
const HAUTEUR = 64;
const ESPACE = 5;
const MARGE_BASSE = 62;
const TAILLE_ICONE = 40;

/**
 * Le panneau serre, quand tout ne tient pas en pleine hauteur : neuf actives et
 * l'ultime depuis Touche-a-tout (§4.23). Une ligne par capacite, sans sa
 * description.
 */
const HAUTEUR_SERREE = 34;
const ICONE_SERREE = 26;
/** Ce que le haut de l'ecran garde pour lui : la carte du heros et les ordres. */
const HAUT_RESERVE = 200;

/**
 * La touche d'une capacite lancee a la main, d'apres son rang — l'ultime, puis
 * les actives. Lue dans le mappage : une touche remappee s'affiche remappee.
 *
 * ⚠️ Elle etait figee (« ESPACE », « 2 » a « 5 ») : les emplacements achetes,
 * sur 6 et 7, s'affichaient « ? ».
 */
function libelleDeTouche(rang: number): string {
  const m = mappage();
  return rang === 0 ? ecrireActionCourte(m, "capacite1") : ecrireAction(m, `capacite${rang + 1}`);
}

interface Entree {
  icone: Phaser.GameObjects.Image;
  nom: Phaser.GameObjects.Text;
  description: Phaser.GameObjects.Text;
  touche: Phaser.GameObjects.Text;
}

export class PanneauCapacites {
  private cadres: Phaser.GameObjects.Graphics;
  private voiles: Phaser.GameObjects.Graphics;
  private entrees: Entree[] = [];
  private signature = "";

  constructor(private scene: Phaser.Scene, private hero: Hero) {
    this.cadres = scene.add.graphics().setDepth(1000);
    this.voiles = scene.add.graphics().setDepth(1002);
    this.reconstruire();
  }

  changerHero(hero: Hero): void {
    this.hero = hero;
    this.reconstruire();
  }

  private reconstruire(): void {
    for (const e of this.entrees) {
      e.icone.destroy();
      e.nom.destroy();
      e.description.destroy();
      e.touche.destroy();
    }
    this.entrees = [];

    const capacites = this.hero.capacites;
    this.signature = capacites.map((c) => c.id).join("|");

    capacites.forEach((capacite, i) => {
      this.entrees.push({
        icone: this.scene.add
          .image(0, 0, capacite.icone)
          .setDisplaySize(TAILLE_ICONE, TAILLE_ICONE)
          .setDepth(1001),
        nom: this.texte(12, T.os).setText(espacer(capacite.nom.toUpperCase())),
        description: this.texte(10, T.osMat)
          .setText(capacite.description)
          .setWordWrapWidth(242),
        touche: this.texte(11, T.laiton).setOrigin(1, 0),
      });
    });
  }

  private texte(taille: number, couleur: string): Phaser.GameObjects.Text {
    return texte(this.scene, 0, 0, taille, couleur).setDepth(1003);
  }

  detruire(): void {
    this.cadres.destroy();
    this.voiles.destroy();
    for (const e of this.entrees) {
      e.icone.destroy();
      e.nom.destroy();
      e.description.destroy();
      e.touche.destroy();
    }
    this.entrees = [];
  }

  rafraichir(): void {
    const capacites = this.hero.capacites;
    // Une capacite vient d'etre apprise : le panneau se refait.
    if (capacites.map((c) => c.id).join("|") !== this.signature) this.reconstruire();

    this.cadres.clear();
    this.voiles.clear();

    const bas = hauteurEcran(this.scene) - MARGE_BASSE;
    const serre = capacites.length * (HAUTEUR + ESPACE) > bas - HAUT_RESERVE;
    const hauteur = serre ? HAUTEUR_SERREE : HAUTEUR;
    const icone = serre ? ICONE_SERREE : TAILLE_ICONE;
    // Les automatiques ne prennent pas de touche (§4.13) : le rang compte les autres.
    let rang = 0;

    capacites.forEach((capacite, i) => {
      const entree = this.entrees[i];
      if (!entree) return;

      const x = 16;
      const y = bas - hauteur - i * (hauteur + ESPACE);
      const charge = this.hero.chargeCapacite(capacite);
      const pret = charge === 0;
      const plaque: Plaque = { x, y, largeur: LARGEUR, hauteur };

      cadre(this.cadres, plaque, pret);

      // Battement lent quand la capacite est disponible : ca attire l'oeil sans
      // clignoter agressivement en plein combat.
      if (pret) {
        const battement = 0.28 + 0.22 * Math.sin(this.scene.time.now / 260);
        this.cadres.lineStyle(1, C.laiton, battement);
        this.cadres.strokeRect(x + 1.5, y + 1.5, LARGEUR - 3, hauteur - 3);
      }

      const ix = x + (serre ? 5 : 9);
      const iy = y + (hauteur - icone) / 2;
      creux(this.cadres, { x: ix, y: iy, largeur: icone, hauteur: icone });

      entree.icone.setPosition(ix + icone / 2, iy + icone / 2);
      // L'icone garde ses couleurs quand la capacite est prete, et vire a l'os
      // mat quand elle recharge. La teinte de classe a disparu : sept couleurs
      // vives dans un coin de l'ecran, c'etait le huitieme systeme de couleur
      // du jeu (§4.10).
      entree.icone.setTint(pret ? C.os : 0x5b5147);
      entree.icone.setScale(
        (icone / 32) * (pret ? 1 + 0.04 * Math.sin(this.scene.time.now / 260) : 1),
      );

      // Le rechargement se vide par le haut : l'icone "se remplit" en remontant.
      if (!pret) {
        this.voiles.fillStyle(C.fer, 0.78);
        this.voiles.fillRect(ix, iy, icone, icone * charge);
      }

      const tx = x + (serre ? 40 : 58);
      const ty = serre ? y + (hauteur - 14) / 2 : y + 8;
      entree.nom.setPosition(tx, ty);
      teindre(entree.nom, pret ? T.os : T.osMat);
      entree.description.setPosition(tx, y + 26).setVisible(!serre);

      const restant = Math.ceil((charge * capacite.rechargement) / 1000);
      const libelle = capacite.automatique ? "AUTO" : libelleDeTouche(rang++);
      entree.touche.setPosition(x + LARGEUR - 11, ty).setText(pret ? libelle : `${restant}s`);
      teindre(entree.touche, pret ? T.laiton : T.osMat);
    });
  }
}
