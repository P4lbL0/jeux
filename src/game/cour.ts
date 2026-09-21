import Phaser from "phaser";
import { CASE, Grille } from "../core/grille";
import type { Stocks } from "../core/habitants";
import { CLE_COUR } from "./dessin/batiments";

/**
 * La cour d'entrainement (DESIGN.md §4.18, §4.1, §4.29 — bloc 9).
 *
 * **Le batiment neuf du bloc 9, et le seul du jeu qui fabrique des heros.** Le
 * §4.29 l'appelait « centre d'apprentissage » et le §6 « cour d'entrainement » ;
 * c'est **un seul batiment**, et il porte le second nom — tranche par Angelos le
 * 21 septembre 2026. Deux batiments qui font presque la meme chose, ce sont deux
 * choses a poser, a defendre et a expliquer pour un seul geste de jeu.
 *
 * Ce qu'on y fait :
 *
 * - on y **entraine** un habitant : deux journees pendant lesquelles il ne
 *   produit rien, et il en ressort avec du niveau de combat ;
 * - et **on sait**. Un habitant sur dix porte un don sans le savoir (§4.1) ;
 *   l'entrainement tranche, dans un sens comme dans l'autre. S'il portait
 *   quelque chose, il transcende et devient un heros.
 *
 * ⚠️ **Elle exige un instructeur affecte** (§6, tranche le 9 septembre) : un
 * habitant du metier de **milicien** qui se tient dans la cour. Sans lui, la
 * cour est un decor — et c'est ce qui fait le prix reel de l'entrainement, parce
 * qu'un milicien ne produit rien non plus.
 *
 * Meme forme que `Maisons` et `Champs` : ce parc tient la grille a jour, et la
 * scene ne parle jamais aux cases directement.
 */

export const REGLAGES_COUR = {
  /** Ce que coute la cour : du bois, et du fer pour les armes du ratelier */
  coutBois: 120,
  coutMinerai: 40,
  /**
   * Combien de **journees de jeu** dure une formation (§6, tranche le
   * 9 septembre 2026 : « un habitant en formation ne produit rien pendant deux
   * journees »).
   */
  journeesDeFormation: 2,
};

/** Son emprise au sol : deux cases sur une, comme l'eglise en largeur. */
export const EMPRISE_COUR = { colonnes: 2, lignes: 1 };

/** Ce qu'on enregistre de la cour (§4.28). */
export interface EtatCourSauve {
  colonne: number;
  ligne: number;
  /** Les identifiants des habitants en formation, et leur avancement */
  eleves: { id: number; journeesFaites: number }[];
}

/** Un habitant en formation, cote regles. */
export interface Eleve {
  id: number;
  journeesFaites: number;
}

export class Cour {
  /** Le batiment, ou `null` tant qu'on ne l'a pas bati. */
  private batiment: Phaser.GameObjects.Image | null = null;
  private colonne = 0;
  private ligne = 0;
  /** Ceux qui s'exercent en ce moment (§4.18) */
  readonly eleves: Eleve[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly grille: Grille,
  ) {}

  get existe(): boolean {
    return this.batiment !== null;
  }

  /** Le milieu de l'emprise : la ou l'instructeur et les eleves se tiennent. */
  get centre(): { x: number; y: number } | null {
    if (!this.batiment) return null;
    return {
      x: this.colonne * CASE + (EMPRISE_COUR.colonnes * CASE) / 2,
      y: this.ligne * CASE + CASE / 2,
    };
  }

  /**
   * Pourquoi on ne peut pas la batir ici, en clair — ou `null` si on peut.
   *
   * Le refus dit ce qui cloche, comme partout ailleurs (§4.22, §4.24) : un clic
   * qui ne fait rien sans expliquer pourquoi est la facon la plus sure de rendre
   * une interface de pose penible.
   */
  refus(x: number, y: number, stocks: Stocks): string | null {
    if (this.batiment) return "Il n'y a qu'une cour d'entrainement par village.";

    const colonne = this.grille.colonneDe(x);
    const ligne = this.grille.ligneDe(y);
    for (let dc = 0; dc < EMPRISE_COUR.colonnes; dc++) {
      for (let dl = 0; dl < EMPRISE_COUR.lignes; dl++) {
        const c = this.grille.case(colonne + dc, ligne + dl);
        if (!c) return "Hors de la carte.";
        if (c.occupation !== "libre") return "La place est deja prise.";
        const centre = Grille.centreCase(c.colonne, c.ligne);
        if (!this.grille.constructible(centre.x, centre.y)) return "Le sol ne porte pas.";
      }
    }

    if (stocks.bois < REGLAGES_COUR.coutBois || stocks.minerai < REGLAGES_COUR.coutMinerai) {
      return `Il manque de quoi : ${REGLAGES_COUR.coutBois} bois et ${REGLAGES_COUR.coutMinerai} minerai.`;
    }
    return null;
  }

  /** La batir. `null` si c'etait impossible. */
  batir(x: number, y: number, stocks: Stocks): Phaser.GameObjects.Image | null {
    if (this.refus(x, y, stocks) !== null) return null;
    stocks.bois -= REGLAGES_COUR.coutBois;
    stocks.minerai -= REGLAGES_COUR.coutMinerai;

    this.colonne = this.grille.colonneDe(x);
    this.ligne = this.grille.ligneDe(y);
    this.poser();
    return this.batiment;
  }

  /** La remettre en place au rechargement d'une partie (§4.28). */
  reprendre(etat: EtatCourSauve | null): void {
    if (!etat) return;
    this.colonne = etat.colonne;
    this.ligne = etat.ligne;
    this.poser();
    this.eleves.length = 0;
    for (const eleve of etat.eleves) this.eleves.push({ ...eleve });
  }

  etatSauve(): EtatCourSauve | null {
    if (!this.batiment) return null;
    return {
      colonne: this.colonne,
      ligne: this.ligne,
      eleves: this.eleves.map((e) => ({ ...e })),
    };
  }

  private poser(): void {
    // Le pied du batiment tombe au bas de son emprise : c'est lui qui donne la
    // profondeur, comme pour les maisons (§4.30).
    const x = this.colonne * CASE;
    const bas = (this.ligne + EMPRISE_COUR.lignes) * CASE;
    this.batiment = this.scene.add
      .image(x, bas, CLE_COUR)
      .setOrigin(0, 1)
      .setDepth(bas);

    for (let dc = 0; dc < EMPRISE_COUR.colonnes; dc++) {
      for (let dl = 0; dl < EMPRISE_COUR.lignes; dl++) {
        const centre = Grille.centreCase(this.colonne + dc, this.ligne + dl);
        this.grille.poser(centre.x, centre.y, "batiment");
      }
    }
    // Il surgit, comme tout ce qui se batit (§4.30).
    this.batiment.setScale(1, 0.2);
    this.scene.tweens.add({
      targets: this.batiment,
      scaleY: 1,
      duration: 220,
      ease: "Back.easeOut",
    });
  }

  /** Est-il deja a la cour ? */
  eleve(id: number): Eleve | null {
    return this.eleves.find((e) => e.id === id) ?? null;
  }

  /** L'inscrire. Faux s'il y est deja, ou si la cour n'existe pas. */
  inscrire(id: number): boolean {
    if (!this.batiment || this.eleve(id)) return false;
    this.eleves.push({ id, journeesFaites: 0 });
    return true;
  }

  retirer(id: number): void {
    const index = this.eleves.findIndex((e) => e.id === id);
    if (index >= 0) this.eleves.splice(index, 1);
  }

  /**
   * Une journee passe : ceux qui ont fini sortent.
   *
   * ⚠️ **Rien n'avance sans instructeur.** La cour vide est un decor, et c'est
   * la decision du §6 : armer son village le ralentit deux fois — l'eleve ne
   * produit rien, et l'instructeur non plus.
   *
   * @param avecInstructeur un milicien se tient-il dans la cour ?
   * @returns les identifiants de ceux qui sortent formes
   */
  passerLaJournee(avecInstructeur: boolean): number[] {
    if (!this.batiment || !avecInstructeur) return [];

    const sortants: number[] = [];
    for (const eleve of this.eleves) {
      eleve.journeesFaites += 1;
      if (eleve.journeesFaites >= REGLAGES_COUR.journeesDeFormation) sortants.push(eleve.id);
    }
    for (const id of sortants) this.retirer(id);
    return sortants;
  }

  detruire(): void {
    this.batiment?.destroy();
    this.batiment = null;
    this.eleves.length = 0;
  }
}
