import Phaser from "phaser";
import type { Proposition } from "../core/competences";
import { Hud } from "../game/hud";
import { PanneauCapacites } from "../game/panneauCapacites";
import { ChoixCompetence } from "../game/choixCompetence";
import { FicheHero } from "../game/ficheHero";
import { PanneauOrdres } from "../game/panneauOrdres";
import { PanneauVillage } from "../game/panneauVillage";
import type { Hero } from "../game/entities";
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
  private fiche!: FicheHero;
  private ordres!: PanneauOrdres;
  private village!: PanneauVillage;
  private stats!: Phaser.GameObjects.Text;
  private annonce!: Phaser.GameObjects.Text;
  private finAnnonce = 0;

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
    this.fiche = new FicheHero(this);
    this.ordres = new PanneauOrdres(this, 12, 12 + 62 + 10);
    this.village = new PanneauVillage(
      this,
      (index) => this.arene.events.emit("posture-habitant", index),
      (index) => this.arene.events.emit("poste-habitant", index),
    );

    this.stats = this.add
      .text(0, 0, "", {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#f2e9d8",
        align: "right",
      })
      .setOrigin(1, 0)
      .setDepth(1003);

    this.annonce = this.add
      .text(0, 0, "", {
        fontFamily: "monospace",
        fontSize: "20px",
        color: "#ffd98a",
        backgroundColor: "#1b1720cc",
        padding: { x: 16, y: 8 },
      })
      .setOrigin(0.5, 0)
      .setAlpha(0)
      .setDepth(1400);

    const evenements = this.arene.events;
    evenements.on("choix", this.ouvrirChoix, this);
    evenements.on("hero-incarne", this.changerPanneau, this);
    evenements.on("fin-de-partie", this.afficherFin, this);
    evenements.on("annonce", this.annoncer, this);
    evenements.on("basculer-village", this.basculerVillage, this);
    // Sans ce nettoyage, les ecouteurs s'empileraient a chaque nouvelle partie.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      evenements.off("choix", this.ouvrirChoix, this);
      evenements.off("hero-incarne", this.changerPanneau, this);
      evenements.off("fin-de-partie", this.afficherFin, this);
      evenements.off("annonce", this.annoncer, this);
      evenements.off("basculer-village", this.basculerVillage, this);
    });
  }

  /**
   * L'annonce d'ouverture de front (DESIGN.md §4.6). Un seul objet Texte,
   * fabrique au demarrage et recycle : on ne cree jamais de texte en plein
   * combat (§4.17).
   */
  private annoncer(message: string): void {
    this.annonce.setText(message);
    this.annonce.setAlpha(1);
    this.finAnnonce = this.time.now + 4000;
  }

  private basculerVillage(): void {
    this.village.basculer();
  }

  private ouvrirFiche(index: number): void {
    const hero = this.arene.etatEquipe.heros[index];
    if (!hero) return;
    this.fiche.afficher(
      hero,
      () => this.arene.events.emit("changer-hero", index),
      this.arene.groupeDe(hero),
    );
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
    this.village.rafraichir(this.arene.etatVillage, this.time.now);
    const resume = this.arene.resume;
    this.stats.setPosition(this.scale.width - 16, 16);
    this.stats.setText(`Survie : ${resume.secondes}s\nElimines : ${resume.kills}`);

    // L'annonce s'efface d'elle-meme sur la derniere seconde.
    this.annonce.setPosition(this.scale.width / 2, 90);
    const restant = this.finAnnonce - this.time.now;
    if (restant <= 0) this.annonce.setAlpha(0);
    else if (restant < 1000) this.annonce.setAlpha(restant / 1000);
  }
}
