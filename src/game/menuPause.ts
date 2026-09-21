import Phaser from "phaser";
import {
  affuter,
  barreDeTitre,
  cadre,
  espacer,
  lisible,
  POLICE,
  T,
  teindre,
  yCorps,
  yTitre,
  type Plaque,
} from "./ui/chrome";
import { largeurEcran, hauteurEcran } from "./ui/ecran";
import { bruitDInterface } from "./son";

/**
 * Le menu de pause (DESIGN.md §4.10, « Le menu d'options »).
 *
 * **C'est la premiere vraie pause commandee par le joueur.** Jusqu'au
 * 21 septembre 2026 le jeu ne s'arretait que tout seul : perte de focus, choix
 * de competence, mode d'amenagement. On ne pouvait pas poser la manette.
 *
 * Cinq lignes, et rien de plus :
 *
 * - **Reprendre** — le temps repart ou il s'etait arrete ;
 * - **Parametres** — les trois volumes, le panneau qui existe deja (`panneauSon.ts`) ;
 * - **Touches** — le remappage complet (`panneauTouches.ts`) ;
 * - **Sauver et quitter** — on enregistre, on rend l'ecran-titre, REPRENDRE relance ;
 * - **Abandonner** — on efface la sauvegarde. Il demande confirmation, une fois.
 *
 * ⚠️ **Abandonner est la seule ligne destructive du jeu**, et la regle ironman
 * du §4.28 la rend definitive : la sauvegarde ecrasee ne revient pas. Elle
 * s'ecrit donc en sang frais, elle est en bas, et elle demande deux clics.
 */

const LARGEUR = 300;
const LIGNE = 34;
const PROFONDEUR = 2100;

export interface ActionsDuMenu {
  reprendre: () => void;
  parametres: () => void;
  touches: () => void;
  sauverEtQuitter: () => void;
  abandonner: () => void;
}

interface Entree {
  cle: keyof ActionsDuMenu;
  libelle: string;
  couleur: string;
}

const ENTREES: Entree[] = [
  { cle: "reprendre", libelle: "Reprendre", couleur: T.os },
  { cle: "parametres", libelle: "Parametres", couleur: T.os },
  { cle: "touches", libelle: "Touches", couleur: T.os },
  { cle: "sauverEtQuitter", libelle: "Sauver et quitter", couleur: T.laiton },
  { cle: "abandonner", libelle: "Abandonner la partie", couleur: T.sangFrais },
];

export class MenuPause {
  private objets: Phaser.GameObjects.GameObject[] = [];
  /**
   * Le voile, a part du reste.
   *
   * ⚠️ **Il survit quand le menu s'efface** pour laisser la place aux
   * parametres ou aux touches : sans lui, ces deux panneaux se posaient sur un
   * village en pleine lumiere et on ne voyait plus qu'ils etaient modaux. Vu en
   * capture le 21 septembre 2026.
   */
  private voile: Phaser.GameObjects.Rectangle | null = null;
  /** Vrai quand « Abandonner » a ete clique une fois et attend sa confirmation. */
  private confirme = false;
  private ligneAbandon: Phaser.GameObjects.Text | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly actions: ActionsDuMenu,
  ) {}

  get ouvert(): boolean {
    return this.objets.length > 0;
  }

  ouvrir(): void {
    if (this.ouvert) return;
    const s = this.scene;
    const hauteur = 22 + 16 + ENTREES.length * LIGNE + 14;
    const p: Plaque = {
      x: Math.round((largeurEcran(s) - LARGEUR) / 2),
      y: Math.round((hauteurEcran(s) - hauteur) / 2),
      largeur: LARGEUR,
      hauteur,
    };

    this.poserLeVoile();

    const fond = s.add.graphics().setDepth(PROFONDEUR);
    cadre(fond, p, true);
    barreDeTitre(fond, p);
    this.objets.push(fond);

    this.objets.push(
      affuter(
        s.add.text(p.x + p.largeur / 2, yTitre(p), espacer("PAUSE"), {
          fontFamily: POLICE,
          fontSize: `${lisible(12)}px`,
          color: T.titre,
        }),
      )
        .setOrigin(0.5, 0)
        .setDepth(PROFONDEUR + 1),
    );

    ENTREES.forEach((entree, i) => {
      const ligne = this.ligne(p, entree, yCorps(p) + 4 + i * LIGNE);
      if (entree.cle === "abandonner") this.ligneAbandon = ligne;
    });
  }

  /** Un voile sur toute la scene : le jeu est arrete, il doit en avoir l'air. */
  private poserLeVoile(): void {
    if (this.voile) return;
    const s = this.scene;
    this.voile = s.add
      .rectangle(0, 0, largeurEcran(s), hauteurEcran(s), 0x000000, 0.55)
      .setOrigin(0)
      .setDepth(PROFONDEUR - 1)
      .setInteractive();
  }

  /**
   * Le menu s'efface, le voile reste : on part vers les parametres ou les
   * touches, et on reviendra ici.
   */
  effacer(): void {
    this.confirme = false;
    this.ligneAbandon = null;
    for (const o of this.objets) o.destroy();
    this.objets = [];
  }

  fermer(): void {
    this.effacer();
    this.voile?.destroy();
    this.voile = null;
  }

  /** La fenetre a change de taille : on refait la plaque au milieu. */
  replacer(): void {
    // Le voile aussi : il couvre l'ecran, et l'ecran vient de changer de taille.
    this.voile?.setSize(largeurEcran(this.scene), hauteurEcran(this.scene));
    if (!this.ouvert) return;
    const confirme = this.confirme;
    this.effacer();
    this.ouvrir();
    if (confirme) this.armerLAbandon();
  }

  private ligne(p: Plaque, entree: Entree, y: number): Phaser.GameObjects.Text {
    const s = this.scene;
    const t = affuter(
      s.add.text(p.x + p.largeur / 2, y, entree.libelle, {
        fontFamily: POLICE,
        fontSize: `${lisible(15)}px`,
        color: entree.couleur,
      }),
    )
      .setOrigin(0.5, 0)
      .setDepth(PROFONDEUR + 1)
      .setInteractive({ useHandCursor: true })
      .on("pointerover", () => {
        teindre(t, T.titre);
        bruitDInterface(s, "survol");
      })
      .on("pointerout", () => teindre(t, entree.couleur))
      .on("pointerdown", () => {
        bruitDInterface(s, "clic");
        this.choisir(entree.cle);
      });
    this.objets.push(t);
    return t;
  }

  private choisir(cle: keyof ActionsDuMenu): void {
    // Toute autre ligne desarme l'abandon : on ne perd pas sa partie parce
    // qu'on a clique « Touches » puis « Abandonner » deux minutes plus tard.
    if (cle !== "abandonner" && this.confirme) this.desarmerLAbandon();

    if (cle !== "abandonner") {
      this.actions[cle]();
      return;
    }
    if (!this.confirme) {
      this.armerLAbandon();
      return;
    }
    this.actions.abandonner();
  }

  private armerLAbandon(): void {
    this.confirme = true;
    this.ligneAbandon?.setText("Vraiment ? Clique encore");
  }

  private desarmerLAbandon(): void {
    this.confirme = false;
    this.ligneAbandon?.setText("Abandonner la partie");
  }
}
