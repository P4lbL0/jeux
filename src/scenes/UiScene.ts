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
 *
 * Elle ne connait l'arene que par des evenements. C'est ce qui permet de
 * refondre l'une sans toucher a l'autre.
 */
export class UiScene extends Phaser.Scene {
  private arene!: ArenaScene;
  private hud!: Hud;
  private ultimes!: PanneauUltimes;
  private choix!: ChoixCompetence;
  private stats!: Phaser.GameObjects.Text;

  constructor() {
    super("ui");
  }

  init(data: { arene: ArenaScene }): void {
    this.arene = data.arene;
  }

  create(): void {
    const equipe = this.arene.etatEquipe;

    this.hud = new Hud(this, equipe.heros, (index) =>
      this.arene.events.emit("changer-hero", index),
    );
    this.ultimes = new PanneauUltimes(this, equipe.heros[equipe.indexIncarne]!);
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
    evenements.on("hero-incarne", this.changerPanneau, this);
    evenements.on("fin-de-partie", this.afficherFin, this);
    // Sans ce nettoyage, les ecouteurs s'empileraient a chaque nouvelle partie.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      evenements.off("montee-niveau", this.ouvrirChoix, this);
      evenements.off("hero-incarne", this.changerPanneau, this);
      evenements.off("fin-de-partie", this.afficherFin, this);
    });
  }

  /** Le panneau des ultimes suit toujours le heros incarne. */
  private changerPanneau(hero: Hero): void {
    this.ultimes.detruire();
    this.ultimes = new PanneauUltimes(this, hero);
  }

  private ouvrirChoix(hero: Hero, propositions: CompetenceDef[]): void {
    this.choix.afficher(hero.niveau, propositions, (competence) => {
      this.arene.events.emit("competence-choisie", competence);
    });
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
    this.ultimes.rafraichir();
    const resume = this.arene.resume;
    this.stats.setPosition(this.scale.width - 16, 16);
    this.stats.setText(`Survie : ${resume.secondes}s\nElimines : ${resume.kills}`);
  }
}
