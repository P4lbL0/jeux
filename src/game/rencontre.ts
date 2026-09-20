import Phaser from "phaser";
import {
  Bouton,
  C,
  HAUTEUR_TITRE,
  MARGE,
  POLICE,
  T,
  barreDeTitre,
  cadre,
  espacer,
  yTitre,
  type Plaque,
} from "./ui/chrome";

/** Ce que la scene donne au panneau : qui parle, ce qu'il raconte, ce qu'il demande. */
export interface ParoleDeRencontre {
  /** Celui qui tient la porte : c'est un habitant, il a un nom */
  nom: string;
  /** Ce qui s'est passe, combien ils sont, ce qui tient, ce qui rode */
  lignes: string[];
  question: string;
}

const LARGEUR = 470;
const PROFONDEUR = 3000;

/**
 * La rencontre a la porte (DESIGN.md §4.29, 20 septembre 2026 au soir).
 *
 * **C'est le seul panneau du jeu ou ce n'est pas nous qui decidons de qui
 * entre.** La fiche d'observation (`fichePersonne.ts`) nous met du cote de
 * celui qui tient la porte et demande « laisse-t-on entrer ? » ; celui-ci nous
 * met dehors, devant quelqu'un qui demande de l'aide. Le §4.29 tient tout
 * entier dans ce renversement, et c'est pour ca qu'il a son panneau a lui
 * plutot qu'un quatrieme mode de la fiche : il n'y a ni portrait a examiner, ni
 * question a poser, ni indice a recouper — juste quelqu'un qui parle et deux
 * reponses.
 *
 * Il fabrique ses objets a l'ouverture et les detruit a la fermeture : il
 * s'ouvre **une fois par partie**, la regle 3 du §4.17 (fabriquer une fois,
 * rafraichir ensuite) ne s'adresse pas a lui.
 */
export class PanneauRencontre {
  private objets: Phaser.GameObjects.GameObject[] = [];
  private boutons: Bouton[] = [];
  private ouvert = false;

  constructor(private readonly scene: Phaser.Scene) {}

  get estOuvert(): boolean {
    return this.ouvert;
  }

  afficher(parole: ParoleDeRencontre, surAccepter: () => void, surRefuser: () => void): void {
    if (this.ouvert) return;
    this.ouvert = true;

    const l = this.scene.scale.width;
    const h = this.scene.scale.height;

    // Le voile est plus leger que celui du choix de competence : on doit
    // continuer de voir le village dont on parle, et les gens qui y vivent.
    const voile = this.scene.add.graphics().setDepth(PROFONDEUR);
    voile.fillStyle(C.fer, 0.62);
    voile.fillRect(0, 0, l, h);
    this.objets.push(voile);

    const g = this.scene.add.graphics().setDepth(PROFONDEUR + 1);
    this.objets.push(g);

    // Le panneau se mesure avant de se dessiner : quatre lignes de longueurs
    // inegales, chacune repliee sur la largeur utile.
    const utile = LARGEUR - MARGE * 2;
    const corps: Phaser.GameObjects.Text[] = [];
    let hauteurTexte = 0;
    for (const ligne of parole.lignes) {
      const t = this.texte(ligne, 13, T.os).setWordWrapWidth(utile);
      corps.push(t);
      hauteurTexte += t.height + 8;
    }

    const question = this.texte(parole.question, 17, T.laiton).setWordWrapWidth(utile);
    const hauteur = HAUTEUR_TITRE + MARGE + hauteurTexte + 14 + question.height + 18 + 30 + MARGE;

    // ⚠️ **Le panneau se pose bas, pas au milieu.** Au centre il tombait pile
    // sur les deux personnages qui se parlent (vu en capture) : on lisait la
    // phrase sans voir celui qui la dit. Il garde le haut de l'ecran libre.
    const plaque: Plaque = {
      x: Math.round(l / 2 - LARGEUR / 2),
      y: Math.round(Math.max(h * 0.4, h - 64 - hauteur)),
      largeur: LARGEUR,
      hauteur: Math.round(hauteur),
    };
    cadre(g, plaque, true);
    barreDeTitre(g, plaque);

    this.texte(espacer(`${parole.nom} — A LA PORTE`.toUpperCase()), 11, T.titre)
      .setPosition(plaque.x + MARGE, yTitre(plaque))
      .setOrigin(0, 0);

    let y = plaque.y + HAUTEUR_TITRE + MARGE + 4;
    for (const t of corps) {
      t.setPosition(plaque.x + MARGE, y);
      y += t.height + 8;
    }

    y += 10;
    question.setPosition(plaque.x + MARGE, y);
    y += question.height + 18;

    // Deux reponses, cote a cote et de meme largeur : aucune des deux n'est la
    // bonne, et le panneau ne doit pas en designer une.
    const largeurBouton = Math.floor((utile - MARGE) / 2);
    const accepter = new Bouton(
      this.scene,
      "Je vous protegerai",
      () => {
        this.masquer();
        surAccepter();
      },
      PROFONDEUR + 2,
    ).placer({ x: plaque.x + MARGE, y, largeur: largeurBouton, hauteur: 30 });
    const refuser = new Bouton(
      this.scene,
      "Je passe mon chemin",
      () => {
        this.masquer();
        surRefuser();
      },
      PROFONDEUR + 2,
    ).placer({ x: plaque.x + MARGE + largeurBouton + MARGE, y, largeur: largeurBouton, hauteur: 30 });
    this.boutons.push(accepter, refuser);
  }

  private texte(contenu: string, taille: number, couleur: string): Phaser.GameObjects.Text {
    const t = this.scene.add
      .text(0, 0, contenu, {
        fontFamily: POLICE,
        fontSize: `${taille}px`,
        color: couleur,
        lineSpacing: 3,
      })
      .setDepth(PROFONDEUR + 2);
    this.objets.push(t);
    return t;
  }

  masquer(): void {
    if (!this.ouvert) return;
    this.ouvert = false;
    for (const bouton of this.boutons) bouton.detruire();
    this.boutons = [];
    for (const objet of this.objets) objet.destroy();
    this.objets = [];
  }
}
