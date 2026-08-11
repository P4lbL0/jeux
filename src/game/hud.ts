import Phaser from "phaser";
import { SEUIL_CRITIQUE } from "../core/classes";
import type { Hero } from "./entities";
import { C, T, cadre, jauge, teindre, texte, type Plaque } from "./ui/chrome";

/**
 * Barre d'equipe, en haut a gauche, a l'horizontale (DESIGN.md §4.10).
 *
 * Ce n'est pas de la decoration : avec la mort definitive, c'est l'**ecran de
 * triage** du joueur. C'est ici qu'il voit un heros en train de tomber a
 * l'autre bout de la carte et qu'il decide de lacher sa position pour aller le
 * sauver.
 *
 * Le repere des 20% est l'information la plus importante de l'ecran : c'est
 * lui qui verrouille le changement de heros et declenche le repli de l'IA.
 *
 * Fer, os, sang : ce fichier ne choisit plus une seule couleur, il les demande
 * a `ui/chrome.ts` (§4.10). La couleur de classe a quitte l'interface — elle ne
 * vit plus que sur le sprite dans le monde.
 */

const LARGEUR = 126;
const HAUTEUR = 62;
const ESPACE = 5;
const MARGE = 12;

/**
 * Le portrait est a sa taille native, pas double.
 *
 * ⚠️ Vu en regardant une capture : a l'echelle 2, un sprite de 32 px en occupe
 * 64 et **debordait de sa carte** — il passait par-dessus le cadre et jusque
 * sur l'herbe. Ca ne se voyait pas tant que la plaque etait translucide et
 * arrondie ; sur une plaque opaque a bord franc, ca creve les yeux.
 */
const CASE_PORTRAIT = 34;
/** Ou commencent le titre, les jauges et l'etat : a droite du portrait. */
const COLONNE = 47;

/** Ce qu'un heros est en train de faire, dit en trois mots. */
const LIBELLES_ETAT: Record<string, string> = {
  combat: "au combat",
  repli: "SE REPLIE",
  cite: "a la cite",
  mort: "TOMBE",
};

/**
 * ⚠️ Le sang frais ne sert qu'a ce qui peut tuer (§4.10). « TOMBE » y a droit :
 * c'est une mort definitive. « SE REPLIE » n'y a pas droit — c'est un
 * avertissement, pas une perte.
 */
const COULEURS_ETAT: Record<string, string> = {
  combat: T.osMat,
  repli: T.laiton,
  cite: T.bile,
  mort: T.sangFrais,
};

/**
 * La ligne des touches, repliee (§4.10).
 *
 * Elle est en bas **au centre**, c'est-a-dire exactement sous le heros qu'on
 * pilote : une plaque opaque permanente y masquerait du terrain qu'on est en
 * train d'esquiver. Elle ne montre donc qu'une ligne courte, et « ? » la deplie.
 */
const AIDE_COURTE = "ZQSD se deplacer  ·  ESPACE capacite  ·  clic DROIT ordonner";

/** Depliee : deux colonnes de paires touche / action, en une seule plaque. */
const AIDE_LONGUE: [string, string][][] = [
  [
    ["ZQSD", "se deplacer (ou clic gauche)"],
    ["ESPACE 2 3", "capacites"],
    ["A / E", "changer de heros"],
    ["clic DROIT", "ordonner"],
    ["W X C", "temporiser, agressif, repli"],
    ["V", "formation"],
    ["ECHAP", "rompez"],
  ],
  [
    ["B", "la cloche : tout le monde rentre"],
    ["F", "le tableau du village"],
    ["Y", "l'eglise"],
    ["P", "le port"],
    ["G / H / J", "palissade, tour, champ"],
    ["T", "monter dans une tour"],
    ["molette", "zoomer"],
  ],
];

interface Carte {
  portrait: Phaser.GameObjects.Image;
  titre: Phaser.GameObjects.Text;
  etat: Phaser.GameObjects.Text;
  badge: Phaser.GameObjects.Text;
}

export interface EtatEquipe {
  heros: Hero[];
  indexIncarne: number;
  /** Le heros courant permet-il d'en changer maintenant ? (DESIGN.md §4.3) */
  changementAutorise: boolean;
  /** Heros vises par le prochain ordre (DESIGN.md §4.4) */
  selection: Hero[];
}

export class Hud {
  private graphiques: Phaser.GameObjects.Graphics;
  private cartes: Carte[] = [];
  private alerte: Phaser.GameObjects.Text;

  /**
   * La plaque de l'aide a son propre Graphics : la barre d'equipe se redessine
   * a chaque image, l'aide seulement quand elle bouge (§4.17 regle 5).
   */
  private plaqueAide: Phaser.GameObjects.Graphics;
  private zoneAide: Phaser.GameObjects.Zone;

  /** La ligne du bas, fermee : le texte, puis « ? aide » en laiton a sa suite. */
  private aideCourte: Phaser.GameObjects.Text;
  private aideTouche: Phaser.GameObjects.Text;
  /** Depliee : une colonne de touches et une colonne d'actions, par moitie. */
  private aideTouches: Phaser.GameObjects.Text[] = [];
  private aideActions: Phaser.GameObjects.Text[] = [];
  private aideDepliee = false;

  /** Le cadre ne se redessine que quand quelque chose bouge (§4.17 regle 5). */
  private signatureAide = "";

  constructor(
    private scene: Phaser.Scene,
    heros: Hero[],
    surFiche: (index: number) => void,
    surSelection: (index: number, touteLaClasse: boolean) => void,
  ) {
    this.graphiques = scene.add.graphics().setDepth(1000);

    heros.forEach((hero, i) => {
      const x = MARGE + i * (LARGEUR + ESPACE);
      this.cartes.push({
        portrait: scene.add
          .image(x + 7 + CASE_PORTRAIT / 2, MARGE + HAUTEUR / 2, `hero-${hero.classe.id}`)
          .setDepth(1001),
        titre: this.texte(x + COLONNE, MARGE + 7, 11, T.os),
        etat: this.texte(x + COLONNE, MARGE + 46, 9, T.osMat),
        badge: this.texte(x + LARGEUR - 9, MARGE + 6, 11, T.laiton).setOrigin(1, 0),
      });

      scene.add
        .zone(x, MARGE, LARGEUR, HAUTEUR)
        .setOrigin(0)
        .setInteractive({ useHandCursor: true })
        // Gauche pour consulter, droite pour commander : la meme regle que sur
        // le terrain (DESIGN.md §4.4).
        .on("pointerdown", (pointeur: Phaser.Input.Pointer) => {
          if (pointeur.rightButtonDown()) surSelection(i, pointeur.event.shiftKey);
          else surFiche(i);
        });
    });

    this.alerte = this.texte(0, 0, 12, T.sangFrais).setOrigin(0.5, 0);

    this.aideCourte = this.texte(0, 0, 11, T.osMat).setOrigin(0, 0);
    this.aideCourte.setText(AIDE_COURTE);
    this.aideTouche = this.texte(0, 0, 11, T.laiton).setOrigin(0, 0);
    this.aideTouche.setText("  ·  ?  aide");

    for (const colonne of AIDE_LONGUE) {
      this.aideTouches.push(
        this.texte(0, 0, 11, T.laiton)
          .setText(colonne.map(([t]) => t).join("\n"))
          // ⚠️ `setOrigin(1, 0)` cale le **bloc** a droite, pas ses lignes : sans
          // `setAlign`, les touches restaient alignees a gauche a l'interieur.
          .setAlign("right")
          .setOrigin(1, 0),
      );
      this.aideActions.push(
        this.texte(0, 0, 11, T.os).setText(colonne.map(([, a]) => a).join("\n")),
      );
    }

    this.plaqueAide = scene.add.graphics().setDepth(1002);

    // Cliquer la ligne fait la meme chose que « ? » : l'aide s'ouvre au meme
    // endroit, au clavier comme a la souris.
    this.zoneAide = scene.add
      .zone(0, 0, 10, 10)
      .setOrigin(0)
      .setDepth(1004)
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", () => this.basculerAide());

    const replacer = () => this.placerBas();
    scene.scale.on("resize", replacer);
    // Le gestionnaire de taille est global : sans ce retrait, l'ecouteur
    // survivrait a la scene et pointerait vers des objets detruits.
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.scale.off("resize", replacer));
    this.placerBas();
  }

  private texte(
    x: number,
    y: number,
    taille: number,
    couleur: string,
  ): Phaser.GameObjects.Text {
    return texte(this.scene, x, y, taille, couleur).setDepth(1003);
  }

  /** « ? », ou un clic sur la ligne du bas. */
  basculerAide(): void {
    this.aideDepliee = !this.aideDepliee;
    this.placerBas();
  }

  private placerBas(): void {
    const l = this.scene.scale.width;
    const h = this.scene.scale.height;

    this.alerte.setPosition(l / 2, MARGE + HAUTEUR + 12);

    for (const t of this.aideTouches) t.setVisible(this.aideDepliee);
    for (const t of this.aideActions) t.setVisible(this.aideDepliee);
    this.aideCourte.setVisible(!this.aideDepliee);
    this.aideTouche.setVisible(!this.aideDepliee);

    if (!this.aideDepliee) {
      const largeur = this.aideCourte.width + this.aideTouche.width;
      const x = Math.round(l / 2 - largeur / 2);
      const y = h - 36;
      this.aideCourte.setPosition(x, y + 6);
      this.aideTouche.setPosition(x + this.aideCourte.width, y + 6);
      this.redessinerAide({ x: x - 12, y, largeur: largeur + 24, hauteur: 24 });
      return;
    }

    // Depliee : les deux colonnes se posent au milieu, au-dessus du bord bas.
    // Largeur et hauteur sont **mesurees**, jamais devinees : l'interligne et la
    // chasse d'un texte Phaser dependent de la police que le navigateur a fini
    // par choisir, et une colonne devinee trop etroite tronque son dernier mot.
    const largeurTouches = Math.max(...this.aideTouches.map((t) => t.width));
    const largeurActions = Math.max(...this.aideActions.map((t) => t.width));
    const largeurColonne = largeurTouches + 10 + largeurActions;
    const hauteurBloc = Math.max(...this.aideActions.map((t) => t.height));
    const largeur = largeurColonne * 2 + 60;
    const x = Math.round(l / 2 - largeur / 2);
    const y = h - hauteurBloc - 46;

    this.aideTouches.forEach((t, i) => {
      const gauche = x + 20 + i * (largeurColonne + 20);
      t.setPosition(gauche + largeurTouches, y + 12);
      this.aideActions[i]?.setPosition(gauche + largeurTouches + 10, y + 12);
    });

    this.redessinerAide({ x, y, largeur, hauteur: hauteurBloc + 24 });
  }

  private redessinerAide(p: Plaque): void {
    const signature = `${this.aideDepliee}|${p.x}|${p.y}|${p.largeur}|${p.hauteur}`;
    this.zoneAide.setPosition(p.x, p.y).setSize(p.largeur, p.hauteur);
    if (signature === this.signatureAide) return;
    this.signatureAide = signature;

    this.plaqueAide.clear();
    cadre(this.plaqueAide, p);
  }

  rafraichir(etat: EtatEquipe): void {
    const g = this.graphiques;
    g.clear();

    etat.heros.forEach((hero, i) => {
      const carte = this.cartes[i];
      if (!carte) return;

      const x = MARGE + i * (LARGEUR + ESPACE);
      const y = MARGE;
      const incarne = i === etat.indexIncarne;
      const mort = hero.etat === "mort";
      const plaque: Plaque = { x, y, largeur: LARGEUR, hauteur: HAUTEUR };

      // Le liseré de sang dit qui est incarne. C'est le seul accent de la
      // barre : la couleur de classe a quitte l'interface (§4.10).
      cadre(g, plaque, incarne);

      // Selectionne : le prochain ordre est pour lui (DESIGN.md §4.4). Le
      // liseré se pose **en dehors** du cadre pour ne pas concurrencer celui,
      // sanglant, du heros incarne.
      if (etat.selection.includes(hero)) {
        g.lineStyle(1, C.laiton, 0.9);
        g.strokeRect(x - 3.5, y - 3.5, LARGEUR + 7, HAUTEUR + 7);
      }

      g.fillStyle(C.plaque, 1);
      g.fillRect(x + 7, y + (HAUTEUR - CASE_PORTRAIT) / 2, CASE_PORTRAIT, CASE_PORTRAIT);
      carte.portrait.setAlpha(mort ? 0.35 : 1);

      carte.titre.setText(`${hero.classe.nom.slice(0, 9)} ${hero.niveau}`);
      teindre(carte.titre, incarne ? T.laiton : mort ? T.osMat : T.os);

      // --- Vie ---
      const bx = x + COLONNE;
      const largeur = LARGEUR - COLONNE - 9;
      const by = y + 24;
      jauge(
        g,
        { x: bx, y: by, largeur, hauteur: 8 },
        mort ? 0 : hero.ratioPv,
        undefined,
        SEUIL_CRITIQUE,
      );

      // --- XP ---
      const yx = by + 12;
      const barreXp: Plaque = { x: bx, y: yx, largeur, hauteur: 3 };
      if (mort) {
        jauge(g, barreXp, 0);
      } else {
        jauge(g, barreXp, hero.xp / hero.xpRequise, {
          plein: C.laiton,
          moitie: C.laiton,
          critique: C.laiton,
        });
      }

      carte.etat.setText(LIBELLES_ETAT[hero.etat] ?? "");
      teindre(carte.etat, COULEURS_ETAT[hero.etat] ?? T.osMat);

      // --- Choix en attente ---
      // L'IA ne choisit jamais : elle accumule, et ce badge dit au joueur
      // qu'un heros l'attend avec des choix en reserve (DESIGN.md §4.3).
      const attente = hero.choixEnAttente;
      carte.badge.setText(attente > 0 && !mort ? `+${attente}` : "");
    });

    // Message de verrouillage : sans lui, le joueur croit a un bug quand le
    // changement de heros ne repond plus. Il est en sang frais et sur sa propre
    // plaque : c'est litteralement ce qui peut tuer un heros (§4.10).
    const courant = etat.heros[etat.indexIncarne];
    const alerte = courant && !etat.changementAutorise;
    this.alerte.setText(alerte ? "SOUS 20% DE VIE — rentre a l'eglise pour changer de heros" : "");
    this.alerte.setVisible(!!alerte);

    if (alerte) {
      const p: Plaque = {
        x: this.alerte.x - this.alerte.width / 2 - 10,
        y: this.alerte.y - 5,
        largeur: this.alerte.width + 20,
        hauteur: this.alerte.height + 10,
      };
      cadre(g, p, true);
      // Le texte est dessine par-dessus par son propre objet : la plaque doit
      // donc etre posee **avant** dans le meme Graphics, et elle l'est.
    }
  }

  detruire(): void {
    this.plaqueAide.destroy();
    this.zoneAide.destroy();
    this.graphiques.destroy();
  }
}
