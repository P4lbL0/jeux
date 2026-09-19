import Phaser from "phaser";
import { INTRO, SON_INTRO } from "../game/intro";
import { enLigneConfigure } from "../en-ligne/client";
import { sessionCourante } from "../en-ligne/compte";
import { C, T, POLICE, espacer, titreDuJeu } from "../game/ui/chrome";
import { basculerLeMuet, bruitDInterface, estMuet, etouffer, jouer, type Voix } from "../game/son";

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
 * **Le son** (19 septembre 2026, `game/son.ts`) : le vent et le feu, trois cris
 * au loin et deux coups de glas pendant le film ; un troisieme coup et la
 * musique quand le titre se pose ; le feu qui devient sourd quand l'image se
 * trouble. Le navigateur refuse tout son avant un premier clic : quand il
 * l'exige, un ecran noir « clic ou touche pour entrer » passe avant le film
 * — c'est la seule facon que le film ait son son des sa premiere image. Quand
 * le son est deja permis (une visite precedente, parfois), cet ecran ne vient
 * pas.
 *
 * ⚠️ **Rien ici ne doit pouvoir bloquer l'entree dans le jeu.** Une video qui
 * ne charge pas, un navigateur qui refuse de la lire, un format inconnu : dans
 * tous ces cas le menu apparait quand meme, sur le fer nu, au plus tard cinq
 * secondes apres le debut du film. Et un clic ou une touche pendant l'approche
 * la saute : c'est un film qu'on revoit a chaque lancement, il ne doit jamais
 * etre un peage. L'ecran d'entree en est un, d'un clic : c'est le prix du son,
 * choisi en connaissance de cause (§4.10).
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

/**
 * Si le navigateur n'a toujours pas rendu le son ce temps-la apres le clic
 * d'entree, le film part sans lui : on perd le son, pas l'entree.
 */
const DELAI_ENTREE_SANS_SON = 400;

/** Les fondus du son, en secondes. */
const SON = {
  /** Le feu du menu monte sous la fin du film ; plus vite si on l'a saute. */
  feu: 2.5,
  feuSaute: 1.2,
  /** La musique arrive doucement, sous le glas, sans le couvrir. */
  musique: 4,
  /** La piste du film, coupee quand on le saute : le temps du noir bref. */
  coupure: 0.25,
  /** Tout s'eteint quand on entre dans le jeu. */
  sortie: 1.5,
};

type Etat = "entree" | "approche" | "menu" | "emplacements";

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
  private porte: Phaser.GameObjects.Text | null = null;
  private etat: Etat = "approche";

  /** Tout ce qui sonne, pour pouvoir l'eteindre en partant. */
  private voix: Voix[] = [];
  /** La piste du film, a part : c'est elle qu'on coupe quand on saute le film. */
  private bandeSon: Voix | null = null;
  /** Le glas et la musique ne partent qu'une fois, meme si le menu revient. */
  private titreSonne = false;
  /** La scene s'arrete : un son qui finit de charger ne doit plus partir. */
  private eteinte = false;
  private hautParleur!: Phaser.GameObjects.Graphics;
  private zoneSon!: Phaser.GameObjects.Zone;

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
    this.menu = [];
    this.entrees = [];
    this.flous = [];
    this.voix = [];
    this.bandeSon = null;
    this.titreSonne = false;
    this.eteinte = false;
    this.passer = null;
    this.porte = null;
    this.cameras.main.setBackgroundColor(C.fer);

    const { width: l, height: h } = this.scale;
    this.voile = this.add.rectangle(0, 0, l, h, C.fer, 1).setOrigin(0).setAlpha(0).setDepth(10);
    this.noir = this.add.rectangle(0, 0, l, h, 0x000000, 1).setOrigin(0).setDepth(500);
    this.poserLeHautParleur();

    this.chargerLeFond();
    this.ecouterPourPasser();
    if (this.sound.locked) {
      this.etat = "entree";
      this.attendreLEntree();
    } else {
      this.etat = "approche";
      this.lancerLeFilm();
    }

    // Le compte se regarde a cote, jamais avant l'affichage (§4.28).
    void this.retrouverLaSession();

    const redessiner = () => this.replacer();
    this.scale.on("resize", redessiner);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", redessiner);
      this.eteindre();
    });
  }

  // ---------------------------------------------------------------- entree

  /**
   * L'ecran noir d'avant le film, quand le navigateur tient le son verrouille.
   *
   * Le clic ou la touche qui repond ici **deverrouille** le son (c'est Phaser
   * qui ecoute la page pour ca) ; le film part a l'instant ou il est rendu, et
   * sa piste avec lui. Ce meme clic ne saute pas le film : il n'y a pas encore
   * de film a sauter.
   */
  private attendreLEntree(): void {
    const { width: l, height: h } = this.scale;
    // De l'os, pas de l'os mat : c'est la seule chose a lire sur l'ecran, et
    // l'os mat sur du noir ne ressortait pas (vu sur capture).
    this.porte = this.add
      .text(l / 2, h / 2, espacer("clic ou touche pour entrer"), {
        fontFamily: POLICE,
        fontSize: "15px",
        color: T.os,
      })
      .setOrigin(0.5)
      .setAlpha(0)
      .setDepth(501);
    // Il respire, lentement : c'est le seul endroit de l'ecran qu'on regarde.
    this.tweens.add({
      targets: this.porte,
      alpha: { from: 0, to: 1 },
      duration: 900,
      ease: "Quad.easeOut",
      onComplete: () => {
        if (!this.porte) return;
        this.tweens.add({
          targets: this.porte,
          alpha: 0.7,
          duration: 1400,
          ease: "Sine.easeInOut",
          yoyo: true,
          repeat: -1,
        });
      },
    });

    const entrer = () => {
      if (this.etat !== "entree") return;
      this.etat = "approche";
      this.porte?.destroy();
      this.porte = null;
      this.lancerLeFilm();
    };
    // Le signal attendu : le navigateur a rendu le son.
    this.sound.once(Phaser.Sound.Events.UNLOCKED, entrer);
    // Le secours : un navigateur qui ne le rend pas n'empeche pas d'entrer.
    const secours = () => this.time.delayedCall(DELAI_ENTREE_SANS_SON, entrer);
    this.input.once("pointerdown", secours);
    this.input.keyboard?.once("keydown", secours);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.sound.off(Phaser.Sound.Events.UNLOCKED, entrer);
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
      // La premiere image est la : on leve le noir, et la piste part avec elle.
      this.tweens.add({ targets: this.noir, alpha: 0, duration: 900, ease: "Quad.easeOut" });
      this.bandeSon = this.garder(jouer(this, SON_INTRO.approche.cle, "ambiance"));
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
    this.rappelerQuOnPeutPasser();
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
      // La piste du film n'a plus d'image a suivre : elle tombe avec le noir.
      this.bandeSon?.arreter(SON.coupure);
      this.bandeSon = null;
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
    this.allumerLeFeuDuMenu(saute ? SON.feuSaute : SON.feu);
    this.time.delayedCall(saute ? 380 : 420, () => {
      this.montrerLeMenu();
      this.sonnerLeTitre();
    });
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
    // Le son se trouble avec l'image : tout ce qui brule devient sourd.
    etouffer(this, true, (DUREE_TROUBLE / 1000) * 1.3);
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
    etouffer(this, true, 0.01);
    this.allumerLeFeuDuMenu(SON.feuSaute);
    this.sonnerLeTitre();
  }

  /**
   * Un clic ou une touche pendant l'approche, et on passe au menu — sauf sur
   * le haut-parleur et sur M, qui coupent le son et rien d'autre.
   */
  private ecouterPourPasser(): void {
    const auClic = (_p: Phaser.Input.Pointer, sous: Phaser.GameObjects.GameObject[]) => {
      if (this.etat === "approche" && !sous.includes(this.zoneSon)) this.enchainer(true);
    };
    const aLaTouche = (e: KeyboardEvent) => {
      // `repeat` : la touche tenue depuis l'ecran d'entree ne saute pas le film.
      if (e.repeat) return;
      if (e.key === "m" || e.key === "M") {
        if (this.etat === "approche" || this.etat === "menu") this.basculerLeSon();
        return;
      }
      if (this.etat === "approche") this.enchainer(true);
    };
    this.input.on("pointerdown", auClic);
    this.input.keyboard?.on("keydown", aLaTouche);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.off("pointerdown", auClic);
      this.input.keyboard?.off("keydown", aLaTouche);
    });
  }

  /** Le rappel, discret, une fois que le film a eu le temps de s'installer. */
  private rappelerQuOnPeutPasser(): void {
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

  // ------------------------------------------------------------------- son

  /**
   * La musique et le feu du menu : plus lourds que tout le reste, et inutiles
   * avant la fin du film. On les charge pendant qu'il passe (ou pendant l'ecran
   * d'entree), jamais avant.
   */
  private chargerLeFond(): void {
    let manque = false;
    for (const { cle, urls } of [SON_INTRO.feu, SON_INTRO.musique]) {
      if (this.cache.audio.exists(cle)) continue;
      this.load.audio(cle, [...urls]);
      manque = true;
    }
    if (manque) this.load.start();
  }

  /**
   * Fait `jouerLe` des que le son `cle` peut partir : charge, et le son rendu
   * par le navigateur. Tout de suite si c'est deja le cas.
   *
   * Attendre le deverrouillage sert au secours de l'ecran d'entree : si le
   * navigateur n'a pas rendu le son au premier clic, il le rendra au suivant
   * (JOUER, par exemple), et la musique partira a ce moment-la plutot que
   * jamais.
   */
  private desQuePossible(cle: string, jouerLe: () => void): void {
    const essayer = () => {
      if (this.eteinte) return;
      if (!this.cache.audio.exists(cle)) {
        this.load.once(`${Phaser.Loader.Events.FILE_KEY_COMPLETE}audio-${cle}`, essayer);
        return;
      }
      if (this.sound.locked) {
        this.sound.once(Phaser.Sound.Events.UNLOCKED, essayer);
        return;
      }
      jouerLe();
    };
    essayer();
  }

  private garder(voix: Voix | null): Voix | null {
    if (voix) this.voix.push(voix);
    return voix;
  }

  /** Le feu et le vent qui tournent derriere le menu, deja sourds. */
  private allumerLeFeuDuMenu(fondu: number): void {
    this.desQuePossible(SON_INTRO.feu.cle, () => {
      this.garder(jouer(this, SON_INTRO.feu.cle, "ambiance", { boucle: true, fondu }));
    });
  }

  /** Le titre se pose : le dernier coup de glas, et la musique dessous. Une fois. */
  private sonnerLeTitre(): void {
    if (this.titreSonne) return;
    this.titreSonne = true;
    this.garder(jouer(this, SON_INTRO.titre.cle, "effets"));
    this.desQuePossible(SON_INTRO.musique.cle, () => {
      this.garder(jouer(this, SON_INTRO.musique.cle, "musique", { boucle: true, fondu: SON.musique }));
    });
  }

  /**
   * On quitte l'ecran-titre (une partie commence) : tout descend ensemble, et
   * l'etouffoir se rouvre une fois le silence fait — le son du jeu, le jour ou
   * il y en aura, ne doit pas arriver sourd.
   */
  private eteindre(): void {
    this.eteinte = true;
    for (const voix of this.voix) voix.arreter(SON.sortie);
    this.voix = [];
    this.bandeSon = null;
    etouffer(this, false, 0.01, SON.sortie);
  }

  /**
   * Le haut-parleur, en bas a gauche : il coupe tout le son du jeu, et le jeu
   * s'en souvient (`son.ts`). La touche M fait la meme chose.
   *
   * Dessine au trait plutot qu'ecrit : c'est une icone, et elle doit se lire
   * sans mot, dans la langue de personne.
   */
  private poserLeHautParleur(): void {
    this.hautParleur = this.add.graphics().setDepth(60);
    this.zoneSon = this.add
      .zone(0, 0, 34, 30)
      .setOrigin(0.5)
      .setDepth(61)
      .setInteractive({ useHandCursor: true })
      .on("pointerover", () => this.dessinerLeHautParleur(true))
      .on("pointerout", () => this.dessinerLeHautParleur(false))
      .on("pointerdown", () => {
        // Sous le noir de l'ecran d'entree, il n'est pas encore la.
        if (this.etat !== "entree") this.basculerLeSon();
      });
    this.placerLeHautParleur();
  }

  private placerLeHautParleur(): void {
    const { height: h } = this.scale;
    this.zoneSon.setPosition(30, h - 25);
    this.dessinerLeHautParleur(false);
  }

  private dessinerLeHautParleur(survole: boolean): void {
    const g = this.hautParleur;
    // L'os mat du rappel « clic ou touche pour passer », son voisin d'en bas.
    const couleur = survole ? C.os : Phaser.Display.Color.HexStringToColor(T.osMat).color;
    const x = this.zoneSon.x - 9;
    const y = this.zoneSon.y;
    g.clear();
    g.fillStyle(couleur, survole ? 1 : 0.85);
    // Le corps, puis le pavillon.
    g.fillRect(x, y - 2, 4, 5);
    g.fillTriangle(x + 3, y - 2, x + 9, y - 7, x + 9, y + 8);
    g.fillTriangle(x + 3, y + 3, x + 3, y - 2, x + 9, y + 8);
    g.lineStyle(1.6, couleur, survole ? 1 : 0.85);
    if (estMuet()) {
      // Coupe : une croix a la place des ondes.
      g.lineBetween(x + 12, y - 3, x + 18, y + 4);
      g.lineBetween(x + 18, y - 3, x + 12, y + 4);
    } else {
      g.beginPath();
      g.arc(x + 9, y + 0.5, 4.5, -0.8, 0.8);
      g.strokePath();
      g.beginPath();
      g.arc(x + 9, y + 0.5, 8.5, -0.85, 0.85);
      g.strokePath();
    }
  }

  private basculerLeSon(): void {
    basculerLeMuet(this);
    this.dessinerLeHautParleur(this.survoleLeHautParleur());
  }

  private survoleLeHautParleur(): boolean {
    const p = this.input.activePointer;
    return this.zoneSon.getBounds().contains(p.x, p.y);
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
          .on("pointerover", () => {
            texte.setColor(T.titre);
            if (this.etat === "menu") bruitDInterface(this, "survol");
          })
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
      const jouerAuClavier = (e: KeyboardEvent) => {
        if (this.etat !== "menu") return;
        if (e.key === "Enter" || e.key === " ") this.ouvrirLesEmplacements();
      };
      clavier.on("keydown", jouerAuClavier);
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => clavier.off("keydown", jouerAuClavier));
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
    this.porte?.setPosition(l / 2, h / 2);
    this.placerLeHautParleur();

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
   * garde le film derriere les plaques — et sa musique. Quand elle s'arrete
   * sans lancer de partie (« Retour »), le menu du titre revient ; quand elle
   * lance une partie, c'est elle qui arrete cette scene (voir `MenuScene`), et
   * le son s'eteint en fondu (`eteindre`).
   */
  private ouvrirLesEmplacements(): void {
    if (this.etat !== "menu") return;
    this.etat = "emplacements";
    bruitDInterface(this, "clic");
    this.cacherLeMenu();

    const menu = this.scene.get("menu");
    menu.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (this.scene.isActive() && this.etat === "emplacements") this.montrerLeMenu();
    });
    this.scene.launch("menu", { surLeTitre: true });
    this.scene.bringToTop("menu");
  }
}
