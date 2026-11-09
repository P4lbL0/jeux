import Phaser from "phaser";
import { Clavier } from "../../game/touches";
import { MONDE } from "../../core/carte";
import { RATIO } from "../../game/ui/ecran";
import type { ArenaScene } from "../ArenaScene";
import {
  ZOOM_MIN,
  ZOOM_MAX,
  ACTIONS_CAPACITE,
  CONSTRUCTIONS_A_LA_TOUCHE,
  CHOISIR_QUOI_POSER,
} from "./reglages";

/**
 * Les contrôles : le zoom, la souris, les touches et leur mappage.
 *
 * Une part d'`ArenaScene`, greffée sur son prototype (`greffer`) : `this` est la scène.
 */
export class ArenaControles {

  // -------------------------------------------------------------- controles

  /**
   * Le zoom arriere le plus loin **qu'on ait le droit de prendre ici**.
   *
   * ⚠️ **C'est le bord de la carte qui le fixe, pas une constante.** Une camera
   * bornee (`setBounds`) ne sait pas retenir une vue plus large que ses bornes :
   * Phaser centre alors le monde et laisse voir le vide de chaque cote. C'est
   * exactement l'aplat que Angelos a signale le 21 septembre 2026 — un grand
   * rectangle uni a la fin du monde, qu'on prend pour du terrain.
   *
   * On ne le peint donc plus d'une autre couleur : **on empeche d'y arriver**.
   * Le monde classique (2000 x 1500) se dezoome moins loin qu'un monde x3, et
   * c'est juste — il y a moins a voir.
   */
  zoomLePlusLarge(this: ArenaScene): number {
    const cam = this.cameras.main;
    return Math.max(ZOOM_MIN, cam.width / MONDE.largeur, cam.height / MONDE.hauteur);
  }

  configurerZoom(this: ArenaScene): void {
    this.input.on("wheel", (_p: unknown, _o: unknown, _dx: number, dy: number) => {
      // Un coup de molette reprend la camera au dezoom d'entree : le §4.11
      // promet un zoom libre, et une animation qui tire dans l'autre sens
      // pendant qu'on regle le sien serait exactement le contraire.
      this.entreeCamera?.stop();
      this.entreeCamera = null;
      const cam = this.cameras.main;
      // Le pas suit le ratio, sinon un cran de molette vaut deux fois moins de
      // zoom sur un ecran a 200 % que sur un ecran normal.
      cam.setZoom(
        Phaser.Math.Clamp(cam.zoom - dy * 0.0016 * RATIO, this.zoomLePlusLarge(), ZOOM_MAX),
      );
    });
    // Agrandir la fenetre elargit la vue : un zoom qui tenait dans la carte
    // peut ne plus y tenir, et le vide reapparaitrait par le bord.
    const retenir = (): void => {
      const cam = this.cameras.main;
      const plancher = this.zoomLePlusLarge();
      if (cam.zoom < plancher) cam.setZoom(plancher);
    };
    this.scale.on("resize", retenir);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off("resize", retenir));
  }

  /**
   * Gauche, c'est *moi* ; droite, c'est *les autres* (DESIGN.md §4.4).
   * Le combat ne s'arrete jamais pour donner un ordre.
   */
  configurerSouris(this: ArenaScene): void {
    // Sans ca, le clic droit ouvre le menu du navigateur en plein combat.
    this.input.mouse?.disableContextMenu();

    const viser = (pointeur: Phaser.Input.Pointer) => {
      if (this.termine || this.enPause) return;
      const point = this.cameras.main.getWorldPoint(pointeur.x, pointeur.y);
      this.destination = new Phaser.Math.Vector2(point.x, point.y);
      this.montrerMarqueur();
    };

    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      if (this.termine) return;
      // Le mode d'amenagement prend toute la souris : gauche pose, prend ou
      // repose ; droite demolit. Rien ne commande, rien ne se deplace — le jeu
      // est arrete (§4.24).
      if (this.amenagement) {
        const point = this.cameras.main.getWorldPoint(p.x, p.y);
        this.cliquerEnAmenagement(point.x, point.y, p.rightButtonDown());
        return;
      }
      if (this.enPause) return;
      // En mode construction, le clic gauche batit : c'est la seule chose qu'on
      // fasse d'un clic a ce moment-la, et le clic droit continue de commander.
      if (!p.rightButtonDown() && this.enConstruction) {
        const point = this.cameras.main.getWorldPoint(p.x, p.y);
        this.batirIci(point.x, point.y);
        return;
      }
      if (p.rightButtonDown()) {
        this.ordonnerAncre(p);
        return;
      }
      // Le mode commandement prend le clic gauche, et lui seul (§4.4, bloc 8) :
      // on selectionne quelqu'un, ou on commence un rectangle. Le heros ne
      // bouge plus a la souris tant qu'on y est — c'est le prix du mode, et
      // c'est ce qui le rend lisible.
      if (this.modeCommandement) {
        this.cliquerEnCommandement(p);
        return;
      }
      // Une cache a portee, cliquee : on fouille au lieu de marcher (§4.31).
      // Elle passe avant `viser` et apres tout le reste — c'est le seul endroit
      // ou un clic gauche fait autre chose que deplacer, hors amenagement.
      const cible = this.cameras.main.getWorldPoint(p.x, p.y);
      if (this.caches.cliquer(cible.x, cible.y)) return;
      viser(p);
    });
    // Maintenir guide le heros ; le clic droit, lui, ne se maintient pas.
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      if (this.modeCommandement) {
        if (this.rectangleDepart && p.isDown && !p.rightButtonDown()) {
          const point = this.cameras.main.getWorldPoint(p.x, p.y);
          this.rectangleCourant = new Phaser.Math.Vector2(point.x, point.y);
        }
        this.majSurvol(p);
        return;
      }
      if (p.isDown && !p.rightButtonDown() && !this.enConstruction) viser(p);
      this.majSurvol(p);
    });

    this.input.on("pointerup", (p: Phaser.Input.Pointer) => {
      if (this.modeCommandement && this.rectangleDepart) this.fermerLeRectangle(p);
    });
  }

  /**
   * Le clavier de la partie, branche sur des actions (DESIGN.md §4.10).
   *
   * ⚠️ **Plus aucune touche n'est ecrite ici.** On declare ce qu'on veut faire,
   * `game/touches.ts` sait quelle touche le fait, et il rebranche tout seul
   * quand le joueur remappe depuis le menu ECHAP. C'etait la condition pour que
   * la ligne d'aide cesse de reciter des lettres qui pouvaient etre fausses.
   *
   * **ECHAP n'est pas ici** : la pause appartient a la scene d'interface, la
   * seule qui sache ce qui est ouvert par-dessus le jeu.
   */
  configurerTouches(this: ArenaScene): void {
    // Le clavier se cree meme sans plugin clavier : `enfoncee` et
    // `justeAppuyee` sont lues a chaque image, et un champ vide les ferait
    // planter des la premiere.
    this.clavier = new Clavier(this, (id) => this.toucheAutorisee(id));
    const clavier = this.input.keyboard;
    if (!clavier) return;

    // Ce qui se lit a l'image plutot qu'a l'appui : les jambes et les capacites.
    this.clavier.suivre("haut", "bas", "gauche", "droite", ...ACTIONS_CAPACITE);

    // A et E encadrent ZQSD : on change de heros sans lacher les deplacements.
    this.brancher("heroPrecedent", () => this.changerHeroRelatif(-1));
    this.brancher("heroSuivant", () => this.changerHeroRelatif(1));

    // Les ordres tombent sous la rangee de deplacement : la main gauche
    // commande sans jamais lacher ZQSD (DESIGN.md §4.4).
    this.brancher("temporiser", () => this.ordonnerPosture("temporiser"));
    this.brancher("agressif", () => this.ordonnerPosture("agressif"));
    this.brancher("repli", () => this.ordonnerPosture("repli"));
    this.brancher("formation", () => this.changerFormation());
    // Le mode commandement (§4.4, bloc 8). Il est seul de son espece — toutes
    // les autres actions font quelque chose, celle-ci change ce que fait la souris.
    this.brancher("commandement", () => this.basculerCommandement());
    // *Rompez* tenait ECHAP jusqu'au 21 septembre 2026 ; ECHAP est devenu la
    // pause, qui n'existait pas. Il reste par ailleurs une ligne du menu d'ordres.
    this.brancher("rompez", () => this.rompre());
    // La cloche : une touche, tout le monde rentre. C'est l'outil de l'urgence —
    // quand une horde tombe, on n'a pas le temps de changer sept postures une
    // par une (DESIGN.md §4.18).
    this.brancher("cloche", () => this.sonnerLaCloche());
    // Le tableau du village. L'ecran reste degage : tout ce qui n'est pas la
    // population se lit ici, a la demande.
    this.brancher("village", () => this.events.emit("basculer-village"));

    // Batir : une action par construction, et la meme action referme.
    for (const [action, quoi] of CONSTRUCTIONS_A_LA_TOUCHE) {
      this.brancher(action, () => this.basculerConstruction(quoi), true);
    }
    this.brancher("monterTour", () => this.basculerTour());

    // L'eglise : une seule touche pour les deux gestes qu'on peut lui faire —
    // la monter d'un niveau, ou relancer son chantier quand elle est a terre.
    // Ce sont deux actions exclusives, jamais disponibles en meme temps.
    this.brancher("eglise", () => this.oeuvrerALEglise());
    // Le port, meme principe : relever le chantier, ou ouvrir la vente quand
    // un navire est a quai. Les deux gestes ne coexistent jamais (§4.18).
    this.brancher("port", () => this.oeuvrerAuPort());

    // Le mode d'amenagement doit s'entendre **pendant** la pause qu'il a
    // lui-meme posee, sinon on ne pourrait plus le refermer : son laissez-passer
    // est dans `toucheAutorisee`.
    this.brancher("amenagement", () => this.basculerAmenagement(), true);
    // Deplier l'aide marche aussi sous la pause : c'est la qu'on la lit.
    this.brancher("aide", () => this.events.emit("basculer-aide"), true);

    // `R` reste ecrite en dur : elle n'existe que sur l'ecran de fin, ou plus
    // rien d'autre ne repond, et la remapper n'aurait aucun sens.
    clavier.addKey(Phaser.Input.Keyboard.KeyCodes.R).on("down", () => {
      if (!this.termine) return;
      this.scene.stop("ui");
      this.scene.start("choix-classe");
    });
  }

  /**
   * Une action du jeu, avec ce que toutes partagent.
   *
   * @param gardeLOutil vrai pour celles qui **choisissent quoi poser**. Toute
   *   autre action lache l'outil de construction : on choisit une palissade, on
   *   sonne la cloche, et le fantome ne doit plus etre la.
   */
  brancher(this: ArenaScene, id: string, action: () => void, gardeLOutil = false): void {
    this.clavier.surAppui(id, () => {
      if (!gardeLOutil) this.lacherLOutil();
      action();
    });
  }

  /**
   * Ce qui a le droit de passer maintenant.
   *
   * ⚠️ **Le mode d'amenagement est une pause, et il faut pouvoir y travailler**
   * : les actions qui choisissent quoi poser y restent vivantes. Tout le reste —
   * la cloche, les postures, l'eglise, le port — reste bloque, comme sous
   * n'importe quelle autre pause (§4.24).
   */
  toucheAutorisee(this: ArenaScene, id: string): boolean {
    if (this.termine || this.saisieEnCours) return false;
    if (id === "amenagement" || id === "aide") return true;
    if (!this.enPause) return true;
    return this.amenagement && CHOISIR_QUOI_POSER.includes(id);
  }
}
