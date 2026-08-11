import Phaser from "phaser";
import { CLASSES, ORDRE_CLASSES, type ClassId } from "../core/classes";
import { creerTexturesPlaceholder, echellePortrait } from "../game/art";
import type { Emplacement } from "../core/sauvegarde";
import {
  C,
  T,
  HAUTEUR_TITRE,
  POLICE,
  barreDeTitre,
  cadre,
  creux,
  espacer,
  titreDuJeu,
  yTitre,
  type Plaque,
} from "../game/ui/chrome";

/**
 * Choix de la classe de depart (DESIGN.md §3, prologue).
 *
 * Au jalon 9 cet ecran sera remplace par la vraie introduction narrative.
 * Pour l'instant il sert surtout a pouvoir comparer les quatre classes en
 * quelques secondes pendant qu'on teste la sensation de jeu.
 */
/** Hauteur visee pour le portrait d'une carte de classe, en pixels ecran. */
const HAUTEUR_PORTRAIT = 64;

/**
 * La carte, en hauteur : barre de titre, portrait, distance ideale, cinq
 * chiffres, puis le trait detache.
 *
 * ⚠️ Ces valeurs s'additionnent, et il faut qu'elles tombent juste : vu sur une
 * capture, le bloc du trait passait **par-dessus** les statistiques parce qu'il
 * etait cale sur le bas de la carte pendant que les stats descendaient depuis le
 * haut. Deux ancrages opposes dans une hauteur figee finissent toujours par se
 * rencontrer.
 */
const CARTE = {
  portrait: 64,
  /** Deux lignes de « distance ideale » */
  distance: 30,
  lignesStats: 5,
  hauteurLigne: 15,
  trait: 76,
} as const;

const HAUTEUR_CARTE =
  HAUTEUR_TITRE + 8 + CARTE.portrait + 8 + CARTE.distance + CARTE.lignesStats * CARTE.hauteurLigne + 10 + CARTE.trait + 8;

export class ChoixClasseScene extends Phaser.Scene {
  /** L'emplacement choisi a l'ecran de depart (DESIGN.md §4.28) */
  private emplacement: Emplacement = 1;

  constructor() {
    super("choix-classe");
  }

  init(data: { emplacement?: Emplacement }): void {
    this.emplacement = data.emplacement ?? 1;
  }

  create(): void {
    // Le menu contextuel du navigateur n'a rien a faire dans un jeu.
    this.input.mouse?.disableContextMenu();

    creerTexturesPlaceholder(this);
    this.construire();

    const redessiner = () => this.construire();
    this.scale.on("resize", redessiner);
    // Sans ce retrait, l'ecran continuerait de se reconstruire en arriere-plan
    // pendant qu'on joue.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off("resize", redessiner));
  }

  private construire(): void {
    this.children.removeAll();

    const l = this.scale.width;
    const h = this.scale.height;

    // Le monde lui-meme en fond, assombri : c'est le village qu'on s'apprete a
    // defendre. La cle utilisee ici etait « herbe », qui n'a jamais existe —
    // l'ecran affichait donc le damier de texture manquante de Phaser. Poser la
    // carte plutot que la tuile de prairie evite au passage la grille de
    // repetition : elle fait 1600x1200, elle ne se repete pas a l'ecran.
    this.add.tileSprite(0, 0, l, h, "carte").setOrigin(0).setAlpha(0.5);
    // Le meme voile de fer que l'ecran de depart : ces deux ecrans donnent le
    // ton avant qu'on ait joue une seconde, et ils doivent se ressembler (§4.10).
    const voile = this.add.graphics();
    voile.fillStyle(C.fer, 0.42);
    voile.fillRect(0, 0, l, h);

    titreDuJeu(this, l / 2, h * 0.12, 40);

    this.add
      .text(
        l / 2,
        h * 0.12 + 34,
        "Ce village n'a plus personne pour le defendre.\nChoisis ta classe.",
        {
          fontFamily: POLICE,
          fontSize: "13px",
          color: T.osMat,
          align: "center",
        },
      )
      .setOrigin(0.5);

    // Sept classes : on les repartit sur deux rangees pour qu'elles tiennent a
    // l'ecran quelle que soit la fenetre.
    const parRangee = 4;
    const largeurCarte = 196;
    const espace = 14;
    const hauteurCarte = HAUTEUR_CARTE;
    // Deux rangees de cartes plus la ligne d'aide doivent tenir dans la hauteur :
    // vu sur une capture, « Touches 1 a 7 » passait par-dessus la carte de
    // l'Oracle. Le depart des cartes remonte, et l'ecart entre rangees baisse.
    const y = h * 0.19;

    ORDRE_CLASSES.forEach((id, i) => {
      const rangee = Math.floor(i / parRangee);
      const dansRangee = ORDRE_CLASSES.slice(rangee * parRangee, (rangee + 1) * parRangee).length;
      const total = dansRangee * largeurCarte + (dansRangee - 1) * espace;
      const debut = l / 2 - total / 2;
      const colonne = i % parRangee;
      this.carte(
        id,
        debut + colonne * (largeurCarte + espace),
        y + rangee * (hauteurCarte + 10),
        largeurCarte,
        i + 1,
      );
    });

    this.add
      .text(l / 2, h - 26, "Touches 1 a 7, ou clique sur une carte", {
        fontFamily: POLICE,
        fontSize: "12px",
        color: T.osMat,
      })
      .setOrigin(0.5);

    const clavier = this.input.keyboard;
    if (clavier) {
      const codes = [
        Phaser.Input.Keyboard.KeyCodes.ONE,
        Phaser.Input.Keyboard.KeyCodes.TWO,
        Phaser.Input.Keyboard.KeyCodes.THREE,
        Phaser.Input.Keyboard.KeyCodes.FOUR,
        Phaser.Input.Keyboard.KeyCodes.FIVE,
        Phaser.Input.Keyboard.KeyCodes.SIX,
        Phaser.Input.Keyboard.KeyCodes.SEVEN,
      ];
      codes.forEach((code, i) => {
        const id = ORDRE_CLASSES[i];
        if (id) clavier.addKey(code).once("down", () => this.lancer(id));
      });
    }
  }

  /**
   * Une carte de classe (§4.10).
   *
   * ⚠️ **La couleur de classe a quitte l'interface** : les sept cartes sont
   * faites du meme metal. Ce qui les differencie, c'est le **trait de classe**,
   * detache en bas sur un fond plus sombre — c'est la seule chose qui change
   * vraiment la facon de jouer a la premiere partie, et c'etait jusqu'ici ce
   * qu'on voyait le moins.
   */
  private carte(id: ClassId, x: number, y: number, largeur: number, numero: number): void {
    const classe = CLASSES[id];
    const hauteur = HAUTEUR_CARTE;

    const fond = this.add.graphics();
    const plaque: Plaque = { x, y, largeur, hauteur };
    cadre(fond, plaque);
    barreDeTitre(fond, plaque);

    this.add.text(x + 10, yTitre(plaque), `${numero}`, {
      fontFamily: POLICE,
      fontSize: "12px",
      color: T.titre,
    });
    // Le nom de classe n'est pas espace : « CHEVALIER SACRE » espace fait 29
    // caracteres et vient buter sur le numero. C'est un titre, pas une
    // etiquette — la regle 4 du §4.10 vise les secondes.
    this.add
      .text(x + largeur - 10, yTitre(plaque), classe.nom.toUpperCase(), {
        fontFamily: POLICE,
        fontSize: "11px",
        color: T.titre,
      })
      .setOrigin(1, 0);

    // Le portrait vise toujours la meme hauteur, que la texture soit le
    // placeholder de 18 px ou le sprite de 32 px. L'echelle reste **entiere** :
    // agrandir du pixel-art d'un facteur fractionnaire donne des pixels de
    // tailles inegales, et ca se voit immediatement.
    const hautPortrait = y + HAUTEUR_TITRE + 8;
    creux(fond, {
      x: x + largeur / 2 - CARTE.portrait / 2,
      y: hautPortrait,
      largeur: CARTE.portrait,
      hauteur: CARTE.portrait,
    });
    const portrait = this.add.image(x + largeur / 2, hautPortrait + CARTE.portrait / 2, `hero-${id}`);
    portrait.setScale(echellePortrait(portrait.height, HAUTEUR_PORTRAIT));

    this.add
      .text(x + largeur / 2, hautPortrait + CARTE.portrait + 8, classe.distanceIdeale, {
        fontFamily: POLICE,
        fontSize: "10px",
        color: T.osMat,
        align: "center",
        wordWrap: { width: largeur - 24 },
      })
      .setOrigin(0.5, 0);

    // Les chiffres sont en laiton et alignes a droite : c'est ce qui permet de
    // comparer deux cartes sans les lire (§4.10).
    // Cinq chiffres, pas six : l'ultime a quitte cette liste. Il portait un nom
    // et pas une valeur, il cassait l'alignement des chiffres, et le trait de
    // classe juste en dessous dit deja ce qui rend la classe differente.
    const stats: [string, string][] = [
      ["vie", `${classe.pvMax}`],
      ["vitesse", `${classe.vitesse}`],
      ["portee", `${classe.portee}`],
      ["degats", `${classe.degats}`],
      ["esquive", `${Math.round(classe.esquive * 100)}%`],
    ];
    const hautStats = hautPortrait + CARTE.portrait + 8 + CARTE.distance;
    stats.forEach(([nom, valeur], i) => {
      const cy = hautStats + i * CARTE.hauteurLigne;
      this.add.text(x + 14, cy, nom, {
        fontFamily: POLICE,
        fontSize: "10px",
        color: T.osMat,
      });
      this.add
        .text(x + largeur - 14, cy, valeur, {
          fontFamily: POLICE,
          fontSize: "11px",
          color: T.laiton,
        })
        .setOrigin(1, 0);
    });

    // --- Le trait de classe, detache ---
    const hautTrait = y + hauteur - CARTE.trait - 8;
    creux(fond, { x: x + 8, y: hautTrait, largeur: largeur - 16, hauteur: CARTE.trait });
    fond.fillStyle(C.sangSeche, 1);
    fond.fillRect(x + 8, hautTrait, largeur - 16, 2);

    this.add.text(x + 16, hautTrait + 8, espacer(classe.traitNom.toUpperCase()), {
      fontFamily: POLICE,
      fontSize: "10px",
      color: T.laiton,
    });
    this.add.text(x + 16, hautTrait + 26, classe.traitTexte, {
      fontFamily: POLICE,
      fontSize: "10px",
      color: T.os,
      wordWrap: { width: largeur - 32 },
      lineSpacing: 2,
    });

    this.add
      .zone(x, y, largeur, hauteur)
      .setOrigin(0)
      .setInteractive({ useHandCursor: true })
      .on("pointerover", () => {
        // Le liseré de sang suit la souris : une carte survolee est celle qu'on
        // s'apprete a jouer pour les cent prochaines minutes.
        fond.lineStyle(1, C.sangFrais, 1);
        fond.strokeRect(x - 0.5, y - 0.5, largeur + 1, hauteur + 1);
      })
      .on("pointerdown", () => this.lancer(id));
  }

  private lancer(classe: ClassId): void {
    this.scene.start("arena", { classe, emplacement: this.emplacement });
  }
}
