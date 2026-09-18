import Phaser from "phaser";
import { INTRO } from "../game/intro";
import { enLigneConfigure } from "../en-ligne/client";
import { sessionCourante } from "../en-ligne/compte";
import { C, T, POLICE, espacer, titreDuJeu } from "../game/ui/chrome";

/**
 * L'ecran-titre : le village qui brule, puis trois mots (DESIGN.md §4.10).
 *
 * **A chaque arrivee dans le jeu, et a chaque rechargement**, la camera remonte
 * le chemin d'un village en feu pendant six secondes ; puis l'image se trouble,
 * le titre se pose dessus, et le menu apparait. JOUER ouvre les trois
 * emplacements de sauvegarde (`MenuScene`), lances **par-dessus** cette scene :
 * le village continue de bruler, flou, derriere les plaques.
 *
 * Le film vient de Blender (`scripts/blender/intro.py`, `npm run intro`), en
 * deux morceaux : l'approche, jouee une fois, et une boucle de quatre secondes
 * sans couture qui prend le relais derriere le menu. Tranche le 18 septembre
 * 2026, contre la version « en code » du §4.10 : la meme scene, en vrai
 * low-poly, avec la lune, la meteorite et les ombres des monstres, ne se
 * fabrique pas a coups d'emetteurs de particules.
 *
 * ⚠️ **Rien ici ne doit pouvoir bloquer l'entree dans le jeu.** Une video qui
 * ne charge pas, un navigateur qui refuse de la lire, un format inconnu : dans
 * tous ces cas le menu apparait quand meme, sur le fer nu, au plus tard cinq
 * secondes apres l'arrivee. Et un clic ou une touche pendant l'approche la
 * saute : c'est un film qu'on revoit a chaque lancement, il ne doit jamais
 * etre un peage.
 */

/** Le sous-titre : la phrase du pitch (§1), en trois mots de plus. */
const SOUS_TITRE = "Sans Protecteur, un village disparait.";

/** Le flou du fond, une fois le menu la : assez pour que le texte se lise. */
const FLOU = { qualite: 2, force: 2.8, pas: 8 };

/** Le voile de fer par-dessus le film flou : le meme que les ecrans d'avant-partie. */
const VOILE = 0.42;

/** Combien de temps prend le passage du film net au menu, en millisecondes. */
const DUREE_TROUBLE = 1100;

/** Passe ce delai sans une image de video, on n'attend plus (voir en tete). */
const DELAI_SANS_VIDEO = 5000;

type Etat = "approche" | "menu" | "emplacements";

interface Entree {
  texte: Phaser.GameObjects.Text;
  actif: boolean;
}

export class TitreScene extends Phaser.Scene {
  private approche: Phaser.GameObjects.Video | null = null;
  private boucle: Phaser.GameObjects.Video | null = null;
  private flous: Phaser.FX.Blur[] = [];
  private noir!: Phaser.GameObjects.Rectangle;
  private voile!: Phaser.GameObjects.Rectangle;
  private passer: Phaser.GameObjects.Text | null = null;
  private etat: Etat = "approche";

  /** Les objets du menu, fabriques une fois, montres et caches ensuite. */
  private menu: Phaser.GameObjects.GameObject[] = [];
  private titre: Phaser.GameObjects.Text | null = null;
  private sousTitre: Phaser.GameObjects.Text | null = null;
  private entrees: Entree[] = [];
  private compte: Phaser.GameObjects.Text | null = null;
  private courriel: string | null = null;

  constructor() {
    super("titre");
  }

  create(): void {
    this.input.mouse?.disableContextMenu();
    this.etat = "approche";
    this.menu = [];
    this.entrees = [];
    this.flous = [];
    this.cameras.main.setBackgroundColor(C.fer);

    const { width: l, height: h } = this.scale;
    this.voile = this.add.rectangle(0, 0, l, h, C.fer, 1).setOrigin(0).setAlpha(0).setDepth(10);
    this.noir = this.add.rectangle(0, 0, l, h, 0x000000, 1).setOrigin(0).setDepth(500);

    this.lancerLeFilm();
    this.ecouterPourPasser();

    // Le compte se regarde a cote, jamais avant l'affichage (§4.28).
    void this.retrouverLaSession();

    const redessiner = () => this.replacer();
    this.scale.on("resize", redessiner);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", redessiner);
    });
  }

  // ------------------------------------------------------------------ film

  private lancerLeFilm(): void {
    const cache = this.cache.video;
    if (!cache.exists(INTRO.approche.cle)) {
      this.sansVideo();
      return;
    }

    const { width: l, height: h } = this.scale;
    const approche = this.add.video(l / 2, h / 2, INTRO.approche.cle).setDepth(0);
    this.approche = approche;
    this.brancher(approche);
    approche.once(Phaser.GameObjects.Events.VIDEO_PLAY, () => {
      // La premiere image est la : on leve le noir, et on decompte.
      this.tweens.add({ targets: this.noir, alpha: 0, duration: 900, ease: "Quad.easeOut" });
    });
    approche.once(Phaser.GameObjects.Events.VIDEO_COMPLETE, () => this.enchainer(false));
    approche.once(Phaser.GameObjects.Events.VIDEO_ERROR, () => this.sansVideo());
    approche.once(Phaser.GameObjects.Events.VIDEO_UNSUPPORTED, () => this.sansVideo());
    approche.play(false);

    // La boucle est fabriquee tout de suite pour que le navigateur la charge
    // pendant l'approche ; mais Phaser pose `autoplay` sur tout element sans
    // son, et elle demarrerait dans le vide. On la met en pause avant qu'elle
    // ait pu commencer : elle repartira de sa premiere image au raccord.
    if (cache.exists(INTRO.boucle.cle)) {
      const boucle = this.add.video(l / 2, h / 2, INTRO.boucle.cle).setDepth(0).setVisible(false);
      const element = boucle.video;
      if (element) {
        element.removeAttribute("autoplay");
        element.pause();
      }
      this.boucle = boucle;
      this.brancher(boucle);
    }

    // Le garde-fou : sans image au bout du delai, le menu vient quand meme.
    this.time.delayedCall(DELAI_SANS_VIDEO, () => {
      if (this.etat === "approche" && !approche.frameReady) this.sansVideo();
    });
  }

  /**
   * Ce que chaque video doit faire quand sa texture existe : etre lisse, et
   * couvrir la fenetre.
   *
   * ⚠️ `pixelArt: true` met **tout** le jeu au plus proche voisin, la video
   * comprise : agrandie pour couvrir un grand ecran, elle sortirait en gros
   * pixels. Une video n'est pas un sprite, on lui rend son filtre lineaire.
   */
  private brancher(video: Phaser.GameObjects.Video): void {
    video.once(
      Phaser.GameObjects.Events.VIDEO_TEXTURE,
      (_v: Phaser.GameObjects.Video, texture: Phaser.Textures.Texture) => {
        texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
      },
    );
    video.once(Phaser.GameObjects.Events.VIDEO_CREATED, () => this.couvrir(video));
  }

  /** La video couvre la fenetre sans se deformer : on coupe les bords, pas l'image. */
  private couvrir(video: Phaser.GameObjects.Video): void {
    if (video.width === 0) return;
    const { width: l, height: h } = this.scale;
    const echelle = Math.max(l / INTRO.largeur, h / INTRO.hauteur);
    video.setPosition(l / 2, h / 2).setDisplaySize(INTRO.largeur * echelle, INTRO.hauteur * echelle);
  }

  /**
   * L'approche est finie, ou sautee : la boucle prend le relais, le fond se
   * trouble, le menu se pose.
   *
   * @param saute vrai quand le joueur a coupe l'approche en route : les deux
   *        videos ne se raccordent plus, on passe par un noir bref plutot que
   *        de montrer la coupure.
   */
  private enchainer(saute: boolean): void {
    if (this.etat !== "approche") return;
    this.etat = "menu";
    this.passer?.destroy();
    this.passer = null;

    const approche = this.approche;
    const boucle = this.boucle;
    const relayer = () => {
      if (!boucle) return;
      boucle.setVisible(true);
      boucle.once(Phaser.GameObjects.Events.VIDEO_PLAY, () => approche?.setVisible(false));
      boucle.play(true);
    };

    if (saute && approche) {
      approche.stop();
      this.tweens.add({
        targets: this.noir,
        alpha: 1,
        duration: 160,
        yoyo: true,
        hold: 60,
        onYoyo: relayer,
      });
    } else {
      relayer();
    }

    this.troubler();
    this.time.delayedCall(saute ? 380 : 420, () => this.montrerLeMenu());
  }

  /** Le fond se trouble : le flou monte sur les deux videos, et le voile de fer avec. */
  private troubler(): void {
    for (const video of [this.approche, this.boucle]) {
      if (!video) continue;
      // Sans WebGL il n'y a pas d'apres-traitement, et `addBlur` ne rend rien :
      // le voile fait alors le travail tout seul.
      const flou = video.postFX.addBlur(FLOU.qualite, 2, 2, 0, 0xffffff, FLOU.pas) as
        | Phaser.FX.Blur
        | undefined;
      if (flou) this.flous.push(flou);
    }
    if (this.flous.length > 0) {
      this.tweens.add({
        targets: this.flous,
        strength: FLOU.force,
        duration: DUREE_TROUBLE,
        ease: "Sine.easeInOut",
      });
    }
    this.tweens.add({
      targets: this.voile,
      alpha: VOILE,
      duration: DUREE_TROUBLE,
      ease: "Sine.easeInOut",
    });
  }

  /** Pas de film : le menu, tout de suite, sur le fer et le voile. */
  private sansVideo(): void {
    if (this.etat !== "approche") return;
    this.noir.setAlpha(0);
    this.voile.setAlpha(VOILE);
    this.etat = "menu";
    this.passer?.destroy();
    this.passer = null;
    this.montrerLeMenu();
  }

  /** Un clic ou une touche pendant l'approche, et on passe au menu. */
  private ecouterPourPasser(): void {
    const sauter = () => {
      if (this.etat === "approche") this.enchainer(true);
    };
    this.input.on("pointerdown", sauter);
    this.input.keyboard?.on("keydown", sauter);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.off("pointerdown", sauter);
      this.input.keyboard?.off("keydown", sauter);
    });

    // Le rappel, discret, une fois que le film a eu le temps de s'installer.
    this.time.delayedCall(1400, () => {
      if (this.etat !== "approche") return;
      const { width: l, height: h } = this.scale;
      this.passer = this.add
        .text(l - 20, h - 18, "clic ou touche pour passer", {
          fontFamily: POLICE,
          fontSize: "11px",
          color: T.osMat,
        })
        .setOrigin(1, 1)
        .setAlpha(0)
        .setDepth(60);
      this.tweens.add({ targets: this.passer, alpha: 0.85, duration: 700 });
    });
  }

  // ------------------------------------------------------------------ menu

  private montrerLeMenu(): void {
    if (this.menu.length === 0) this.fabriquerLeMenu();
    for (const objet of this.menu) {
      (objet as Phaser.GameObjects.Text).setVisible(true).setAlpha(0);
    }
    this.replacer();
    this.tweens.add({ targets: this.menu, alpha: 1, duration: 700, ease: "Quad.easeOut" });
    this.etat = "menu";
  }

  private cacherLeMenu(): void {
    for (const objet of this.menu) (objet as Phaser.GameObjects.Text).setVisible(false);
  }

  /**
   * Le titre, le sous-titre, trois entrees, le compte en bas (§4.10).
   *
   * Des mots, pas des plaques : c'est le seul ecran ou l'interface a le droit
   * d'etre grosse, et une plaque de fer sous « JOUER » le rapetisserait. Les
   * deux entrees qui n'existent pas encore restent la, eteintes : on voit ce
   * qui viendra, on ne clique pas dessus.
   */
  private fabriquerLeMenu(): void {
    this.titre = titreDuJeu(this, 0, 0, 64).setDepth(100);
    this.sousTitre = this.add
      .text(0, 0, SOUS_TITRE, { fontFamily: POLICE, fontSize: "15px", color: T.os })
      .setOrigin(0.5)
      .setDepth(100);
    this.menu.push(this.titre, this.sousTitre);

    const entrees: [string, boolean, () => void][] = [
      ["JOUER", true, () => this.ouvrirLesEmplacements()],
      ["PARAMETRES", false, () => undefined],
      ["CREDITS", false, () => undefined],
    ];
    for (const [libelle, actif, action] of entrees) {
      const texte = this.add
        .text(0, 0, espacer(libelle), {
          fontFamily: POLICE,
          fontSize: actif ? "24px" : "18px",
          color: actif ? T.laiton : T.osMat,
        })
        .setOrigin(0.5)
        .setDepth(100);
      if (actif) {
        texte
          .setShadow(2, 2, T.sangSeche, 0, true, true)
          .setInteractive({ useHandCursor: true })
          .on("pointerover", () => texte.setColor(T.titre))
          .on("pointerout", () => texte.setColor(T.laiton))
          .on("pointerdown", () => {
            if (this.etat === "menu") action();
          });
      }
      this.entrees.push({ texte, actif });
      this.menu.push(texte);
    }

    this.compte = this.add
      .text(0, 0, this.ligneDeCompte(), { fontFamily: POLICE, fontSize: "12px", color: T.osMat })
      .setOrigin(0.5, 1)
      .setDepth(100);
    this.menu.push(this.compte);

    // Entree ou Espace : jouer. C'est ce que fait quelqu'un qui a deja vu le film.
    const clavier = this.input.keyboard;
    if (clavier) {
      const jouer = (e: KeyboardEvent) => {
        if (this.etat !== "menu") return;
        if (e.key === "Enter" || e.key === " ") this.ouvrirLesEmplacements();
      };
      clavier.on("keydown", jouer);
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => clavier.off("keydown", jouer));
    }
  }

  private ligneDeCompte(): string {
    if (!enLigneConfigure()) return "Hors ligne — tes parties restent sur cet appareil.";
    if (this.courriel) return `Connecte — ${this.courriel}`;
    return "Sans compte — tes parties restent sur cet appareil.";
  }

  private async retrouverLaSession(): Promise<void> {
    if (!enLigneConfigure()) return;
    const session = await sessionCourante();
    if (!session || !this.scene.isActive()) return;
    this.courriel = session.user.email ?? "connecte";
    this.compte?.setText(this.ligneDeCompte()).setColor(T.bile);
  }

  /** Tout ce qui depend de la taille de la fenetre, remis a sa place. */
  private replacer(): void {
    const { width: l, height: h } = this.scale;
    this.voile.setSize(l, h);
    this.noir.setSize(l, h);
    for (const video of [this.approche, this.boucle]) if (video) this.couvrir(video);
    this.passer?.setPosition(l - 20, h - 18);

    if (!this.titre || !this.sousTitre || !this.compte) return;
    this.titre.setPosition(l / 2, h * 0.3);
    this.sousTitre.setPosition(l / 2, h * 0.3 + 48);
    const depart = h * 0.3 + 118;
    this.entrees.forEach(({ texte }, i) => texte.setPosition(l / 2, depart + i * 40));
    this.compte.setPosition(l / 2, h - 22);
  }

  // ---------------------------------------------------------- emplacements

  /**
   * JOUER : les trois emplacements, par-dessus le village flou.
   *
   * `MenuScene` tourne **en plus** de celle-ci, pas a sa place : c'est ce qui
   * garde le film derriere les plaques. Quand elle s'arrete sans lancer de
   * partie (« Retour »), le menu du titre revient ; quand elle lance une
   * partie, c'est elle qui arrete cette scene (voir `MenuScene`).
   */
  private ouvrirLesEmplacements(): void {
    if (this.etat !== "menu") return;
    this.etat = "emplacements";
    this.cacherLeMenu();

    const menu = this.scene.get("menu");
    menu.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (this.scene.isActive() && this.etat === "emplacements") this.montrerLeMenu();
    });
    this.scene.launch("menu", { surLeTitre: true });
    this.scene.bringToTop("menu");
  }
}
