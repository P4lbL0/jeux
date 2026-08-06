import Phaser from "phaser";
import type { CompetenceDef } from "../core/competences";
import { Hud } from "../game/hud";
import { PanneauUltimes } from "../game/panneauUltimes";
import { ChoixCompetence } from "../game/choixCompetence";
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
 * Une scene a sa propre camera. Celle-ci reste a zoom 1 quoi qu'il arrive :
 * l'interface garde toujours la meme taille, comme l'exige DESIGN.md §4.11.
 */
export class UiScene extends Phaser.Scene {
  private arene!: ArenaScene;
  private hero!: Hero;
  private hud!: Hud;
  private ultimes!: PanneauUltimes;
  private choix!: ChoixCompetence;
  private stats!: Phaser.GameObjects.Text;

  constructor() {
    super("ui");
  }

  init(data: { hero: Hero }): void {
    this.hero = data.hero;
    this.arene = this.scene.get("arena") as ArenaScene;
  }

  create(): void {
    this.hud = new Hud(this, this.hero);
    this.ultimes = new PanneauUltimes(this, this.hero);
    this.choix = new ChoixCompetence(this);

    this.stats = this.add
      .text(0, 0, "", {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#f2e9d8",
        align: "right",
      })
      .setOrigin(1, 0)
      .setDepth(1003);

    const evenements = this.arene.events;
    evenements.on("montee-niveau", this.ouvrirChoix, this);
    evenements.on("fin-de-partie", this.afficherFin, this);
    // Sans ce nettoyage, les ecouteurs s'empileraient a chaque nouvelle partie.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      evenements.off("montee-niveau", this.ouvrirChoix, this);
      evenements.off("fin-de-partie", this.afficherFin, this);
    });
  }

  private ouvrirChoix(niveau: number, propositions: CompetenceDef[]): void {
    this.choix.afficher(niveau, propositions, (competence) => {
      this.arene.events.emit("competence-choisie", competence);
    });
  }

  private afficherFin(secondes: number, kills: number, niveau: number): void {
    this.add
      .text(
        this.scale.width / 2,
        this.scale.height / 2,
        `Le heros est tombe.\n\n${secondes} secondes  ·  ${kills} elimines  ·  niveau ${niveau}\n\nR pour recommencer`,
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
    this.hud.rafraichir();
    this.ultimes.rafraichir();
    const resume = this.arene.resume;
    this.stats.setPosition(this.scale.width - 16, 16);
    this.stats.setText(`Survie : ${resume.secondes}s\nElimines : ${resume.kills}`);
  }
}
