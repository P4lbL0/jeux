import Phaser from "phaser";
import "./police.css";
import { POLICE, T as TONS } from "./game/ui/chrome";
import { C } from "./game/ui/couleurs";
import { ORDRE_CLASSES, ORDRE_RANGS, CLASSES } from "./core/classes";
import { cuire } from "./game/dessin/four";
import { CARREAU, cleDuSol, cuireLesSols, varianteDe } from "./game/dessin/sol";
import { PALIERS, hero, palierDeRang } from "./game/dessin/heros";
import { villageois } from "./game/dessin/villageois";

/**
 * La planche de controle du bloc 7z (DESIGN.md §4.30).
 *
 * **Elle n'est pas un confort, elle est la seule facon de juger ce bloc.** Une
 * compilation qui passe ne prouve rien d'un dessin : la planche de propositions
 * du 11 aout a ete refaite deux fois, et les deux fois le defaut ne se voyait
 * qu'a l'oeil. Trois defauts de plus y ont ete trouves le 12, dont deux
 * qu'aucun test n'aurait pu voir.
 */

const LARGEUR = 1320;
const HAUTEUR = 1060;
const MARGE = 24;

class Planche extends Phaser.Scene {
  create(): void {
    this.peindreLeSol();
    this.titrer();
    this.peindreLesPaliers(MARGE, 118);
    this.peindreLesClasses(MARGE, 424);
    this.peindreLesEtatsDuSol(MARGE, 700);
    this.peindreLeVillageois(MARGE, 940);
  }

  /**
   * Le sol en damier de variantes — c'est le defaut qu'on juge ici.
   *
   * Un seul carreau repete se lisait comme un defaut d'affichage ; quatre
   * variantes choisies par la position de la case doivent le faire disparaitre.
   */
  private peindreLeSol(): void {
    cuireLesSols(this);
    for (let l = 0; l * CARREAU < HAUTEUR; l += 1) {
      for (let c = 0; c * CARREAU < LARGEUR; c += 1) {
        this.add
          .image(c * CARREAU, l * CARREAU, cleDuSol("herbe", varianteDe(c, l)))
          .setOrigin(0);
      }
    }
  }

  /** Les cinq paliers, sur une seule classe : c'est la progression qu'on juge. */
  private peindreLesPaliers(x0: number, y0: number): void {
    this.etiquette(x0, y0 - 22, "les cinq paliers d'equipement  —  un tous les deux rangs", 14);

    const parRang: string[][] = Array.from({ length: PALIERS }, () => []);
    for (const rang of ORDRE_RANGS) parRang[palierDeRang(rang)]!.push(rang);

    const classes = ["guerrier", "chevalier", "rodeur"] as const;
    classes.forEach((classe, rang) => {
      const y = y0 + rang * 96;
      this.etiquette(x0, y + 30, CLASSES[classe].nom, 13);

      for (let palier = 0; palier < PALIERS; palier += 1) {
        const modele = hero(classe, palier);
        cuire(this, modele);
        const x = x0 + 150 + palier * 224;

        // Un cadre par palier : sans lui, on ne sait plus quel sprite appartient
        // a quelle colonne, et la progression — le seul objet de cette bande —
        // devient illisible.
        this.add
          .rectangle(x - 12, y + 2, 200, 78)
          .setOrigin(0)
          .setStrokeStyle(1, C.fer, 0.55);

        // A sa vraie taille, puis agrandi : la progression doit se lire aux deux.
        this.add.sprite(x + 4, y + 56, `${modele.famille}-planche`).play(`${modele.famille}-repos`);
        this.add
          .sprite(x + 60, y + 42, `${modele.famille}-planche`)
          .setScale(3)
          .play(`${modele.famille}-attaque`);

        if (rang === 0) {
          this.etiquette(x - 10, y - 18, `palier ${palier}  ·  ${parRang[palier]!.join(" ")}`, 11);
        }
      }
    });
  }

  /** Les sept classes, cote a cote : c'est la lisibilite qu'on juge. */
  private peindreLesClasses(x0: number, y0: number): void {
    this.etiquette(
      x0,
      y0 - 22,
      "les sept classes  —  meme corps, ce qui change est ce qu'ils portent",
      14,
    );

    const gestes = ["repos", "marche", "attaque", "incantation", "touche", "mort"];
    const pas = Math.floor((LARGEUR - MARGE * 2) / 7);

    ORDRE_CLASSES.forEach((classe, i) => {
      const modele = hero(classe, 2);
      cuire(this, modele);
      const x = x0 + i * pas;

      this.etiquette(x, y0, CLASSES[classe].nom, 12);
      // A sa vraie taille, pour juger la lisibilite a 32 px.
      this.add.sprite(x + 12, y0 + 34, `${modele.famille}-planche`).play(`${modele.famille}-repos`);

      gestes.forEach((geste, g) => {
        this.add
          .sprite(x + 46 + (g % 3) * 42, y0 + 36 + Math.floor(g / 3) * 92, `${modele.famille}-planche`)
          .setScale(2.6)
          .play(`${modele.famille}-${geste}`);
        if (i === 0) {
          this.etiquette(
            x + 30 + (g % 3) * 42,
            y0 + 74 + Math.floor(g / 3) * 92,
            geste.slice(0, 5),
            9,
          );
        }
      });
    });
  }

  /** Les quatre etats de case, et leurs variantes (§4.21). */
  private peindreLesEtatsDuSol(x0: number, y0: number): void {
    this.etiquette(
      x0,
      y0 - 22,
      "les etats d'une case  —  ce qu'une explosion ecrira dans la grille",
      14,
    );

    const etats = ["herbe", "terre", "brule", "cratere"] as const;
    // ⚠️ **En plaques, pas en echantillons.** Quatre carreaux isoles ne disent
    // rien : c'est cote a cote qu'on voit si un cratere se lit comme un trou ou
    // comme quatre rondelles alignees — le defaut trouve le 13 aout.
    etats.forEach((etat, i) => {
      const x = x0 + i * 316;
      this.etiquette(x, y0, etat, 12);
      for (let l = 0; l < 3; l += 1) {
        for (let c = 0; c < 4; c += 1) {
          this.add
            .image(x + c * 64, y0 + 18 + l * 64, cleDuSol(etat, varianteDe(c + i * 7, l)))
            .setOrigin(0)
            .setScale(2);
        }
      }
    });
  }

  private peindreLeVillageois(x0: number, y0: number): void {
    this.etiquette(x0, y0 - 20, "le villageois, pour l'echelle  —  meme corps, sans arme", 13);

    const etats = [
      { cle: "v-neuf", corps: { usure: 0, sang: 0 }, titre: "neuf" },
      { cle: "v-use", corps: { usure: 1, sang: 0 }, titre: "use" },
      { cle: "v-blesse", corps: { usure: 0.4, sang: 1 }, titre: "blesse" },
    ];
    etats.forEach((etat, i) => {
      const modele = villageois(etat.cle, etat.corps);
      cuire(this, modele);
      const x = x0 + 180 + i * 150;
      this.add.sprite(x, y0 + 24, `${modele.famille}-planche`).play(`${modele.famille}-repos`);
      this.add
        .sprite(x + 46, y0 + 14, `${modele.famille}-planche`)
        .setScale(2.6)
        .play(`${modele.famille}-travail`);
      this.etiquette(x - 10, y0 + 44, etat.titre, 10);
    });
  }

  private titrer(): void {
    this.add
      .text(MARGE, 20, "BLOC 7z — les heros dans le langage des villageois", {
        fontFamily: POLICE,
        fontSize: "26px",
        color: TONS.titre,
      })
      .setShadow(2, 2, TONS.sangSeche, 0, true, true);
    this.etiquette(
      MARGE,
      56,
      "sol vert retenu · quatre variantes par etat, choisies par la position de la case",
      13,
    );
    this.add.rectangle(MARGE, 84, LARGEUR - MARGE * 2, 1, C.fer, 0.5).setOrigin(0);
  }

  private etiquette(x: number, y: number, contenu: string, taille = 12): void {
    this.add.text(x, y, contenu.toUpperCase(), {
      fontFamily: POLICE,
      fontSize: `${taille}px`,
      color: TONS.os,
    });
  }
}

new Phaser.Game({
  type: Phaser.CANVAS,
  width: LARGEUR,
  height: HAUTEUR,
  pixelArt: true,
  backgroundColor: "#141010",
  scene: Planche,
});
