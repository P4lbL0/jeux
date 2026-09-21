import Phaser from "phaser";
import { SEUIL_CRITIQUE } from "../core/classes";
import type { Hero } from "./entities";
import { plancheDe } from "./dessin/monde";
import { C, T, cadre, jauge, teindre, texte, type Plaque } from "./ui/chrome";
import { largeurEcran, hauteurEcran } from "./ui/ecran";
import { ecrireAction, ecrireActionCourte } from "../core/touches";
import { mappage, surChangementDesTouches } from "./touches";

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
 *
 * ⚠️ **Elle lit le mappage, elle ne recite plus des lettres** (§4.10, bloc 10).
 *
 * C'etait ecrit d'avance dans le §4.10 : « cette ligne devra alors lire le
 * mappage au lieu de reciter des lettres ecrites en dur ». Une aide qui ment
 * est pire que pas d'aide — et depuis que le joueur remappe, une lettre ecrite
 * ici serait fausse au premier reglage.
 */
function aideCourte(): string {
  const m = mappage();
  const jambes = ["haut", "gauche", "bas", "droite"].map((id) => ecrireAction(m, id)).join("");
  return `${jambes} se deplacer  ·  ${ecrireActionCourte(m, "capacite1")} capacite  ·  ${ecrireAction(m, "commandement")} commander`;
}

/** Deux touches d'affilee, pour les lignes qui en groupent plusieurs. */
function suite(...ids: string[]): string {
  const m = mappage();
  return ids.map((id) => ecrireAction(m, id)).join(" / ");
}

/** Depliee : deux colonnes de paires touche / action, en une seule plaque. */
function aideLongue(): [string, string][][] {
  const m = mappage();
  const t = (id: string): string => ecrireAction(m, id);
  return [
    [
      [suite("haut", "gauche", "bas", "droite"), "se deplacer (ou clic gauche)"],
      [`${ecrireActionCourte(m, "capacite1")} / ${t("capacite2")} / ${t("capacite3")}`, "capacites"],
      [suite("heroPrecedent", "heroSuivant"), "changer de heros"],
      [t("commandement"), "commander : clic, ou glisse un cadre"],
      ["clic DROIT", "ou ils vont"],
      [suite("temporiser", "agressif", "repli"), "temporiser, agressif, repli"],
      [t("formation"), "formation"],
      [t("rompez"), "rompez"],
    ],
    [
      [t("cloche"), "la cloche : tout le monde rentre"],
      [t("village"), "le tableau du village"],
      [t("eglise"), "l'eglise"],
      [t("port"), "le port"],
      [
        suite("palissade", "tour", "champ", "porte", "maison", "douve"),
        "palissade, tour, champ, porte, maison, douve",
      ],
      [t("cour"), "la cour d entrainement"],
      [t("monterTour"), "monter dans une tour"],
      [t("amenagement"), "amenager le village"],
      [t("pause"), "pause et options"],
      ["molette", "zoomer"],
    ],
  ];
}

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

  private readonly surFiche: (index: number) => void;
  private readonly surSelection: (index: number, touteLaClasse: boolean) => void;

  constructor(
    private scene: Phaser.Scene,
    heros: Hero[],
    surFiche: (index: number) => void,
    surSelection: (index: number, touteLaClasse: boolean) => void,
  ) {
    this.graphiques = scene.add.graphics().setDepth(1000);

    this.surFiche = surFiche;
    this.surSelection = surSelection;
    for (const hero of heros) this.ajouter(hero);

    this.alerte = this.texte(0, 0, 12, T.sangFrais).setOrigin(0.5, 0);

    this.aideCourte = this.texte(0, 0, 11, T.osMat).setOrigin(0, 0);
    this.aideTouche = this.texte(0, 0, 11, T.laiton).setOrigin(0, 0);

    for (let i = 0; i < aideLongue().length; i++) {
      this.aideTouches.push(
        this.texte(0, 0, 11, T.laiton)
          // ⚠️ `setOrigin(1, 0)` cale le **bloc** a droite, pas ses lignes : sans
          // `setAlign`, les touches restaient alignees a gauche a l'interieur.
          .setAlign("right")
          .setOrigin(1, 0),
      );
      this.aideActions.push(this.texte(0, 0, 11, T.os));
    }
    this.ecrireLAide();

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
    // On remappe une touche : l'aide se reecrit tout de suite. C'est la seule
    // facon de verifier son reglage sans relancer la partie.
    const oublier = surChangementDesTouches(() => {
      this.ecrireLAide();
      this.placerBas();
    });
    // Le gestionnaire de taille est global : sans ce retrait, l'ecouteur
    // survivrait a la scene et pointerait vers des objets detruits.
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.scale.off("resize", replacer);
      oublier();
    });
    this.placerBas();
  }

  /** Le seul endroit qui lit le mappage pour l'ecrire en bas de l'ecran. */
  private ecrireLAide(): void {
    this.aideCourte.setText(aideCourte());
    this.aideTouche.setText(`  ·  ${ecrireAction(mappage(), "aide")}  aide`);
    aideLongue().forEach((colonne, i) => {
      this.aideTouches[i]?.setText(colonne.map(([t]) => t).join("\n"));
      this.aideActions[i]?.setText(colonne.map(([, a]) => a).join("\n"));
    });
    // Le cadre se remesure : les touches n'ont pas toutes la meme largeur.
    this.signatureAide = "";
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
    const l = largeurEcran(this.scene);
    const h = hauteurEcran(this.scene);

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

  /**
   * Une carte de plus dans la barre d'equipe (DESIGN.md §4.18, bloc 9).
   *
   * ⚠️ **La barre grandit en cours de partie depuis le bloc 9**, et c'est neuf :
   * elle etait fabriquee une fois pour l'equipe de depart, du temps ou l'equipe
   * etait donnee d'emblee. Depuis le §4.29 on commence **seul**, et chaque
   * heros arrive d'un villageois qui s'eveille — il lui faut sa carte au
   * moment ou il arrive.
   *
   * Les objets sont fabriques ici, une fois par heros et pour de bon : un
   * village n'en produit qu'une poignee par partie, et le §4.17 n'interdit que
   * ce qui se cree **par image**.
   */
  ajouter(hero: Hero): void {
    const index = this.cartes.length;
    const x = MARGE + index * (LARGEUR + ESPACE);

    this.cartes.push({
      // Le portrait est la premiere frame de sa planche, au repos : la meme
      // image que sur le terrain, donc la meme classe qu'on reconnait.
      portrait: this.scene.add
        .image(x + 7 + CASE_PORTRAIT / 2, MARGE + HAUTEUR / 2, plancheDe(hero.familleSprite), 0)
        .setDepth(1001),
      titre: this.texte(x + COLONNE, MARGE + 7, 11, T.os),
      etat: this.texte(x + COLONNE, MARGE + 46, 9, T.osMat),
      badge: this.texte(x + LARGEUR - 9, MARGE + 6, 11, T.laiton).setOrigin(1, 0),
    });

    this.scene.add
      .zone(x, MARGE, LARGEUR, HAUTEUR)
      .setOrigin(0)
      .setInteractive({ useHandCursor: true })
      // Gauche pour consulter, droite pour commander : la meme regle que sur
      // le terrain (DESIGN.md §4.4).
      .on("pointerdown", (pointeur: Phaser.Input.Pointer) => {
        if (pointeur.rightButtonDown()) this.surSelection(index, pointeur.event.shiftKey);
        else this.surFiche(index);
      });
  }

  rafraichir(etat: EtatEquipe): void {
    // L'equipe a grandi depuis la derniere image : un villageois s'est eveille
    // (§4.18, bloc 9). Il lui faut sa carte avant qu'on la remplisse.
    while (this.cartes.length < etat.heros.length) {
      const hero = etat.heros[this.cartes.length];
      if (!hero) break;
      this.ajouter(hero);
    }

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

      // ⚠️ **Son nom, jamais sa classe** (§4.10, corrige le 11 aout 2026).
      // Cette barre affichait « Chevalier 1 » : renommer son heros dans la fiche
      // ne changeait donc rien la ou on le regarde en permanence, et deux heros
      // de la meme classe portaient la meme etiquette. La classe reste lisible —
      // c'est le portrait, et depuis le §4.10 c'est le sprite qui la porte.
      carte.titre.setText(`${hero.personne.nom.slice(0, 12)} ${hero.niveau}`);
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

      // Un heros au travail le dit : sans ca, on le voit partir vers la foret
      // et on croit que l'IA a lache le combat (§4.4, bloc 8).
      const auTravail = hero.travail !== null && hero.etat === "combat";
      carte.etat.setText(auTravail ? "au travail" : LIBELLES_ETAT[hero.etat] ?? "");
      teindre(carte.etat, auTravail ? T.laiton : COULEURS_ETAT[hero.etat] ?? T.osMat);

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
