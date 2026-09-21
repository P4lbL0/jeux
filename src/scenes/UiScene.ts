import Phaser from "phaser";
import type { Proposition } from "../core/competences";
import { Hud } from "../game/hud";
import { PanneauCapacites } from "../game/panneauCapacites";
import { ChoixCompetence } from "../game/choixCompetence";
import { FichePersonne } from "../game/fichePersonne";
import type { Arrivant } from "../core/arrivants";
import { PanneauOrdres } from "../game/panneauOrdres";
import { MenuOrdres, type ContenuMenu } from "../game/menuOrdres";
import { PanneauVillage } from "../game/panneauVillage";
import { PanneauPort } from "../game/panneauPort";
import type { Hero } from "../game/entities";
import { BoiteJournal } from "../game/journal";
import { PanneauRencontre, type ParoleDeRencontre } from "../game/rencontre";
import { PanneauEtat } from "../game/ui/panneauEtat";
import { PanneauRoute } from "../game/ui/panneauRoute";
import {
  affuter, POLICE } from "../game/ui/chrome";
import type { ArenaScene } from "./ArenaScene";
import { calerLaCamera, largeurEcran, hauteurEcran } from "../game/ui/ecran";
import { MenuPause } from "../game/menuPause";
import { PanneauSon } from "../game/panneauSon";
import { PanneauTouches } from "../game/panneauTouches";
import { Clavier } from "../game/touches";

/**
 * Toute l'interface vit dans cette scene, separee de l'arene.
 *
 * Pourquoi : le zoom est une propriete de la camera, et il agrandit *tout* ce
 * qu'elle affiche — y compris les objets fixes a l'ecran. Une interface posee
 * dans la scene de jeu grossit donc avec le monde, ce qui la rend inutilisable
 * une fois zoome.
 *
 * Une scene a sa propre camera. Celle-ci reste a zoom 1 quoi qu'il arrive
 * (DESIGN.md §4.11).
 *
 * Elle ne connait l'arene que par des evenements : c'est ce qui permet de
 * refondre l'une sans toucher a l'autre.
 */
export class UiScene extends Phaser.Scene {
  private arene!: ArenaScene;
  private hud!: Hud;
  private capacites!: PanneauCapacites;
  private choix!: ChoixCompetence;
  private fiche!: FichePersonne;
  private ordres!: PanneauOrdres;
  /** Le menu d'ordres, colle a la personne cliquee (§4.4, bloc 8) */
  private menu!: MenuOrdres;
  private village!: PanneauVillage;
  private port!: PanneauPort;
  private etat!: PanneauEtat;
  /** Ce qu'on porte tant qu'on marche (§4.31) : il prend la place du compteur */
  private route!: PanneauRoute;
  private boiteJournal!: BoiteJournal;
  private rencontre!: PanneauRencontre;
  /**
   * La pause et ses deux panneaux (§4.10, bloc 10).
   *
   * ⚠️ **ECHAP appartient a cette scene, pas a l'arene.** C'est la seule qui
   * sache ce qui est ouvert par-dessus le jeu, et ECHAP doit d'abord refermer ce
   * qui l'est — un menu d'ordres, une fiche, le tableau du village — avant
   * d'ouvrir quoi que ce soit.
   */
  private menuPause!: MenuPause;
  private parametres!: PanneauSon;
  private touches!: PanneauTouches;
  private clavier!: Clavier;
  /** Vrai pendant un renommage : les lettres vont au champ, pas au jeu. */
  private saisie = false;

  constructor() {
    super("ui");
  }

  init(data: { arene: ArenaScene }): void {
    this.arene = data.arene;
  }

  create(): void {
    // L'interface se pose en pixels d'ecran, pas en pixels de canvas : sur un
    // ecran a 150 ou 200 %, le canvas est deux fois plus grand (`ui/ecran.ts`).
    calerLaCamera(this);
    const equipe = this.arene.etatEquipe;

    // Clic gauche sur un portrait : la fiche du heros, meme s'il est joue par
    // l'IA. Clic droit : on le selectionne pour lui donner un ordre.
    this.hud = new Hud(
      this,
      equipe.heros,
      (index) => this.ouvrirFiche(index),
      (index, touteLaClasse) => this.arene.events.emit("selectionner", index, touteLaClasse),
    );
    this.capacites = new PanneauCapacites(this, equipe.heros[equipe.indexIncarne]!);
    this.choix = new ChoixCompetence(this);
    // Le renommage capte le clavier : sans ce relais, taper « Bertrand »
    // sonnerait la cloche et batirait deux palissades (§4.18).
    this.fiche = new FichePersonne(this, (enCours) => {
      this.saisie = enCours;
      this.arene.events.emit("saisie-clavier", enCours);
    });
    this.ordres = new PanneauOrdres(this, 12, 12 + 62 + 10);
    // Le menu ne decide rien : il rend l'identifiant de la ligne cliquee, et
    // c'est l'arene qui sait ce qu'une tache fait au village (§4.4).
    this.menu = new MenuOrdres(this, (id) => this.arene.events.emit("tache", id));
    this.village = new PanneauVillage(
      this,
      (index) => this.arene.events.emit("posture-habitant", index),
      (index) => this.arene.events.emit("poste-habitant", index),
      // Maj + clic sur une ligne ouvre la fiche de cet habitant : c'est le
      // deuxieme chemin que le §4.18 exige pour le renommage.
      (index) => this.ouvrirFicheHabitant(index),
    );
    // Le panneau de vente ne touche jamais aux stocks : il demande, la scene
    // vend, parce que c'est `core/port.ts` qui sait ce que ca fait au cours.
    this.port = new PanneauPort(this, (ressource, quantite) =>
      this.arene.events.emit("vendre", ressource, quantite),
    );

    // Le compteur du haut-droite : jour, population, survie et elimines. Il
    // remplace deux textes sans fond qui se marchaient dessus au meme coin.
    this.etat = new PanneauEtat(this);
    // Le meme coin, l'autre moitie du jeu : la route (§4.31). Les deux ne
    // coexistent jamais — on marche, ou bien on a un village.
    this.route = new PanneauRoute(this);

    this.boiteJournal = new BoiteJournal(this);

    // La rencontre a la porte (§4.29) : le seul panneau ou c'est quelqu'un
    // d'autre qui pose la question, et nous qui repondons.
    this.rencontre = new PanneauRencontre(this);

    this.construireLaPause();

    // « ? » deplie la ligne des touches (§4.10). L'arene garde la main sur la
    // touche parce que c'est elle qui sait si une saisie est en cours — taper
    // un nom ne doit pas ouvrir l'aide.
    this.arene.events.on("basculer-aide", this.basculerAide, this);

    const evenements = this.arene.events;
    evenements.on("choix", this.ouvrirChoix, this);
    evenements.on("hero-incarne", this.changerPanneau, this);
    evenements.on("fin-de-partie", this.afficherFin, this);
    evenements.on("basculer-village", this.basculerVillage, this);
    evenements.on("arrivant", this.ouvrirLaPorte, this);
    evenements.on("rencontre", this.ouvrirLaRencontre, this);
    evenements.on("basculer-port", this.basculerPort, this);
    evenements.on("menu-ordres", this.ouvrirLeMenu, this);
    evenements.on("fermer-menu-ordres", this.fermerLeMenu, this);
    // Sans ce nettoyage, les ecouteurs s'empileraient a chaque nouvelle partie.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      evenements.off("choix", this.ouvrirChoix, this);
      evenements.off("hero-incarne", this.changerPanneau, this);
      evenements.off("fin-de-partie", this.afficherFin, this);
      evenements.off("basculer-village", this.basculerVillage, this);
      evenements.off("arrivant", this.ouvrirLaPorte, this);
      evenements.off("rencontre", this.ouvrirLaRencontre, this);
      evenements.off("basculer-port", this.basculerPort, this);
      evenements.off("basculer-aide", this.basculerAide, this);
      evenements.off("menu-ordres", this.ouvrirLeMenu, this);
      evenements.off("fermer-menu-ordres", this.fermerLeMenu, this);
    });
  }

  // ------------------------------------------------------------- la pause

  /**
   * ECHAP, et les trois panneaux qu'il ouvre (§4.10, bloc 10).
   *
   * Le menu de pause **arrete vraiment le jeu** : c'est l'arene qui met le
   * temps en suspens, exactement comme pour le mode d'amenagement, et qui le
   * rend a la reprise. Sans ce rendu, toute la nuit frapperait dans l'image du
   * degel.
   */
  private construireLaPause(): void {
    // `false` : ECHAP appartient a cette scene, pas au panneau. Les deux y
    // repondraient, et le menu de pause se refermerait dans la foulee.
    this.parametres = new PanneauSon(this, () => this.menuPause.ouvrir(), false);
    this.touches = new PanneauTouches(this, () => this.menuPause.ouvrir());
    this.menuPause = new MenuPause(this, {
      reprendre: () => this.fermerLaPause(),
      // `effacer` et non `fermer` : le voile reste, et les deux panneaux se
      // posent dessus au lieu de flotter sur un village en pleine lumiere.
      parametres: () => {
        this.menuPause.effacer();
        this.parametres.ouvrir();
      },
      touches: () => {
        this.menuPause.effacer();
        this.touches.ouvrir();
      },
      sauverEtQuitter: () => {
        this.menuPause.fermer();
        this.arene.sauverEtQuitter();
      },
      abandonner: () => {
        this.menuPause.fermer();
        this.arene.abandonnerLaPartie();
      },
    });

    this.clavier = new Clavier(this, () => !this.arene.partieFinie && !this.saisie);
    this.clavier.surAppui("pause", () => this.surEchap());

    const replacer = (): void => {
      this.menuPause.replacer();
      this.parametres.replacer();
      this.touches.replacer();
    };
    this.scale.on("resize", replacer);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off("resize", replacer));
  }

  /**
   * ECHAP : **on referme d'abord ce qui est ouvert**, et seulement ensuite on
   * met le jeu en pause.
   *
   * L'ordre suit la pile de l'ecran, du plus haut au plus bas. Trois panneaux
   * ne sont pas dedans, et c'est voulu : le choix de competence, la fiche
   * d'observation d'un arrivant et la rencontre **attendent une reponse**
   * (§4.18, §4.29). Les fermer sans repondre laisserait le jeu en pause avec
   * quelqu'un qui attend dehors.
   */
  private surEchap(): void {
    // Les deux panneaux d'options se referment sur le menu, pas sur le jeu.
    if (this.touches.ouvert) {
      this.touches.fermer();
      return;
    }
    if (this.parametres.ouvert) {
      this.parametres.fermer();
      return;
    }
    if (this.menuPause.ouvert) {
      this.fermerLaPause();
      return;
    }
    if (this.choix.estOuvert || this.fiche.exigeUneReponse || this.rencontre.estOuvert) return;

    if (this.menu.ouvert) {
      this.menu.fermer();
      return;
    }
    if (this.fiche.estOuverte) {
      this.fiche.fermer();
      return;
    }
    if (this.port.estOuvert) {
      this.port.fermer();
      return;
    }
    if (this.village.estOuvert) {
      this.village.fermer();
      return;
    }
    // Le mode d'amenagement est deja une pause : ECHAP en sort, il n'en empile
    // pas une seconde par-dessus (§4.24).
    if (this.arene.quitterLAmenagement()) return;

    if (this.arene.poserLaPauseDuJoueur()) this.menuPause.ouvrir();
  }

  private fermerLaPause(): void {
    this.menuPause.fermer();
    this.arene.leverLaPauseDuJoueur();
  }

  private ouvrirLeMenu(contenu: ContenuMenu): void {
    this.menu.afficher(contenu);
  }

  private fermerLeMenu(): void {
    this.menu.fermer();
  }

  private basculerAide(): void {
    this.hud.basculerAide();
  }

  private basculerVillage(): void {
    this.village.basculer();
  }

  private basculerPort(): void {
    this.port.basculer();
  }

  private ouvrirFiche(index: number): void {
    const hero = this.arene.etatEquipe.heros[index];
    if (!hero) return;
    this.fiche.afficher({
      genre: "hero",
      hero,
      groupe: this.arene.groupeDe(hero),
      surIncarner: () => this.arene.events.emit("changer-hero", index),
    });
  }

  /**
   * La meme fiche encore, en mode observation (DESIGN.md §4.10).
   *
   * **C'est le troisieme mode de l'unique fiche**, pas un panneau de plus : le
   * portrait, les statistiques et les traits sont dessines par exactement le
   * meme code que pour un heros ou un habitant. Le §4.10 refuse les interfaces
   * en double, et celle-ci aurait duplique les trois quarts de la fiche.
   *
   * Le jeu est deja en pause quand on arrive ici : la scene s'en charge avant
   * d'emettre, comme pour le choix de competence.
   */
  private ouvrirLaPorte(
    arrivant: Arrivant,
    etatAnnonce?: string,
    lieu: "porte" | "sauvetage" | "route" = "porte",
  ): void {
    this.fiche.afficher({
      genre: "arrivant",
      arrivant,
      lieu,
      // Present quand on ramene un blesse du bord de la carte, absent a la
      // porte : **la folie se devine, la maladie se lit** (§4.18).
      etatAnnonce,
      surAccepter: () => this.arene.events.emit("porte", true),
      surRefuser: () => this.arene.events.emit("porte", false),
    });
  }

  /**
   * Quelqu'un vient nous parler a la porte du village ou l'on arrive (§4.29).
   *
   * C'est le renversement du nouveau depart : la fiche d'observation nous
   * demande « le laisse-t-on entrer ? », celui-ci nous demande « veux-tu nous
   * proteger ? ». Le jeu est deja en pause quand on arrive ici : la scene s'en
   * charge avant d'emettre, comme pour la porte et le choix de competence.
   */
  private ouvrirLaRencontre(parole: ParoleDeRencontre): void {
    this.rencontre.afficher(
      parole,
      () => this.arene.events.emit("rencontre-reponse", true),
      () => this.arene.events.emit("rencontre-reponse", false),
    );
  }

  /** La meme fiche, pour un habitant (DESIGN.md §4.10). */
  private ouvrirFicheHabitant(index: number): void {
    const villageois = this.arene.village.habitants[index];
    if (!villageois) return;
    this.fiche.afficher({ genre: "habitant", villageois });
  }

  /** Le panneau des capacites suit toujours le heros incarne. */
  private changerPanneau(hero: Hero): void {
    this.capacites.changerHero(hero);
  }

  private ouvrirChoix(titre: string, sousTitre: string, propositions: Proposition[]): void {
    this.fiche.fermer();
    this.choix.afficher(titre, sousTitre, propositions, (id) =>
      this.arene.events.emit("choix-fait", id),
    );
  }

  private afficherFin(secondes: number, kills: number): void {
    affuter(this.add.text(
        largeurEcran(this) / 2,
        hauteurEcran(this) / 2,
        `Toute l'equipe est tombee.\n\nLa cite n'a plus de Protecteur.\n\n${secondes} secondes  ·  ${kills} elimines\n\nR pour recommencer`,
        {
          fontFamily: POLICE,
          fontSize: "20px",
          color: "#f2e9d8",
          align: "center",
          backgroundColor: "#1b1720dd",
          padding: { x: 24, y: 20 },
        },
      ))
      .setOrigin(0.5)
      .setDepth(2500);
  }

  update(): void {
    this.hud.rafraichir(this.arene.etatEquipe);
    this.ordres.rafraichir(this.arene.etatOrdres);
    this.capacites.rafraichir();
    this.village.rafraichir(this.arene.etatVillage);
    this.port.rafraichir(this.arene.etatPort);
    // Le compteur du village n'existe pas tant qu'on n'a pas de village (§4.29).
    this.etat.montrer(!this.arene.enChemin);
    this.route.montrer(this.arene.enChemin);
    if (this.arene.enChemin) {
      const sac = this.arene.etatDeLaRoute;
      this.route.rafraichir(sac.or, sac.butin);
    } else {
      this.etat.rafraichir(this.arene.etatVillage, this.arene.resume, this.time.now);
    }

    this.boiteJournal.rafraichir(this.arene.journal);
  }
}
