import Phaser from "phaser";
import type { Proposition } from "../core/competences";
import { Hud } from "../game/hud";
import { PanneauCapacites } from "../game/panneauCapacites";
import { ChoixCompetence } from "../game/choixCompetence";
import { FichePersonne } from "../game/fichePersonne";
import type { Arrivant } from "../core/arrivants";
import { PanneauOrdres } from "../game/panneauOrdres";
import { PanneauVillage } from "../game/panneauVillage";
import { PanneauPort } from "../game/panneauPort";
import type { Hero } from "../game/entities";
import { BoiteJournal } from "../game/journal";
import { PanneauEtat } from "../game/ui/panneauEtat";
import type { ArenaScene } from "./ArenaScene";

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
  private village!: PanneauVillage;
  private port!: PanneauPort;
  private etat!: PanneauEtat;
  private boiteJournal!: BoiteJournal;

  constructor() {
    super("ui");
  }

  init(data: { arene: ArenaScene }): void {
    this.arene = data.arene;
  }

  create(): void {
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
    this.fiche = new FichePersonne(this, (enCours) =>
      this.arene.events.emit("saisie-clavier", enCours),
    );
    this.ordres = new PanneauOrdres(this, 12, 12 + 62 + 10);
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

    this.boiteJournal = new BoiteJournal(this);

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
    evenements.on("basculer-port", this.basculerPort, this);
    // Sans ce nettoyage, les ecouteurs s'empileraient a chaque nouvelle partie.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      evenements.off("choix", this.ouvrirChoix, this);
      evenements.off("hero-incarne", this.changerPanneau, this);
      evenements.off("fin-de-partie", this.afficherFin, this);
      evenements.off("basculer-village", this.basculerVillage, this);
      evenements.off("arrivant", this.ouvrirLaPorte, this);
      evenements.off("basculer-port", this.basculerPort, this);
      evenements.off("basculer-aide", this.basculerAide, this);
    });
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
  private ouvrirLaPorte(arrivant: Arrivant): void {
    this.fiche.afficher({
      genre: "arrivant",
      arrivant,
      surAccepter: () => this.arene.events.emit("porte", true),
      surRefuser: () => this.arene.events.emit("porte", false),
    });
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
    this.add
      .text(
        this.scale.width / 2,
        this.scale.height / 2,
        `Toute l'equipe est tombee.\n\nLa cite n'a plus de Protecteur.\n\n${secondes} secondes  ·  ${kills} elimines\n\nR pour recommencer`,
        {
          fontFamily: "monospace",
          fontSize: "20px",
          color: "#f2e9d8",
          align: "center",
          backgroundColor: "#1b1720dd",
          padding: { x: 24, y: 20 },
        },
      )
      .setOrigin(0.5)
      .setDepth(2500);
  }

  update(): void {
    this.hud.rafraichir(this.arene.etatEquipe);
    this.ordres.rafraichir(this.arene.etatOrdres);
    this.capacites.rafraichir();
    this.village.rafraichir(this.arene.etatVillage);
    this.port.rafraichir(this.arene.etatPort);
    this.etat.rafraichir(this.arene.etatVillage, this.arene.resume, this.time.now);

    this.boiteJournal.rafraichir(this.arene.journal);
  }
}
