import Phaser from "phaser";
import { CASE, Grille } from "../core/grille";
import { POSTES } from "../core/carte";
import { cadence, type Habitant, type Stocks } from "../core/habitants";
import { CLES_CHAMP } from "./dessin/batiments";

/**
 * Les champs de ble (DESIGN.md §4.18).
 *
 * C'est le seul metier qui ne produise pas en continu : **on seme, ca murit, on
 * moissonne**. Le choix de design est assume — un champ qui rendrait du ble a la
 * seconde ne serait qu'une deuxieme peche, alors qu'un champ qui met des jours a
 * murir est quelque chose qu'une horde peut vous prendre au pire moment.
 *
 * Ce qui fait pousser, c'est le **fermier** : la somme des cadences des fermiers
 * est le budget de croissance, reparti sur tous les champs. Plus de champs sans
 * plus de bras, c'est donc plus lent partout — et c'est la decision qu'on
 * voulait. Le rang du fermier ne change toujours qu'une chose, la cadence
 * (§4.18).
 *
 * La pluie du §4.21 multiplie ce budget, et c'est son seul effet sur la
 * production : `majorer` recoit le multiplicateur du ciel, elle ne va pas le
 * chercher. Un champ ne sait pas qu'il pleut — il pousse plus vite, c'est tout.
 */

export const REGLAGES_CHAMPS = {
  /** Ce que coute un champ a semer : des outils et une cloture */
  coutBois: 6,
  /** Ce qu'une moisson rapporte */
  rendement: 45,
  /**
   * Cadence de reference : celle d'un fermier de rang F au niveau 1.
   *
   * Elle sert a convertir un budget de croissance en maturite. A un fermier de
   * rang F et un seul champ, celui-ci met environ deux minutes a murir.
   */
  cadenceDeReference: 6,
  /** Secondes de travail d'un fermier de reference pour murir un champ */
  secondesPourMurir: 120,
};

/** Un carre de terre, entre le semis et la moisson. */
export class Champ extends Phaser.Physics.Arcade.Image {
  /** De 0 (juste seme) a 1 (bon a moissonner) */
  maturite = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, CLES_CHAMP.jeune);
    scene.add.existing(this);
    scene.physics.add.existing(this, true);
    // Sous les personnages : on marche dedans, on ne se cogne pas contre.
    this.setDepth(-940);
  }

  get mur(): boolean {
    return this.maturite >= 1;
  }
}

export class Champs {
  readonly groupe: Phaser.Physics.Arcade.StaticGroup;
  private readonly liste: Champ[] = [];
  /** La croissance se calcule une fois par seconde, pas par image (§4.17) */
  private prochainTick = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly grille: Grille,
  ) {
    this.groupe = scene.physics.add.staticGroup();
  }

  get tous(): Champ[] {
    return this.liste;
  }

  get nombre(): number {
    return this.liste.length;
  }

  /** Le centre de la zone des champs : c'est la que le fermier se tient. */
  static get zone(): { x: number; y: number } {
    const poste = POSTES.find((p) => p.metier === "fermier")!;
    return poste.position;
  }

  possible(x: number, y: number, stocks: Stocks): boolean {
    if (!this.grille.constructible(x, y)) return false;
    if (stocks.bois < REGLAGES_CHAMPS.coutBois) return false;
    // Un champ se laboure autour du village, pas a l'autre bout de la carte :
    // sinon on eparpille des cultures que personne ne pourra jamais defendre.
    const zone = Champs.zone;
    return Phaser.Math.Distance.Between(x, y, zone.x, zone.y) <= 240;
  }

  semer(x: number, y: number, stocks: Stocks): Champ | null {
    if (!this.possible(x, y, stocks)) return null;

    const centre = this.grille.centreDe(x, y);
    stocks.bois -= REGLAGES_CHAMPS.coutBois;
    this.grille.poser(centre.x, centre.y, "champ");

    const champ = new Champ(this.scene, centre.x, centre.y);
    this.groupe.add(champ);
    this.liste.push(champ);
    return champ;
  }

  /**
   * La croissance, une fois par seconde.
   *
   * @param fermiers ceux qui sont a leur poste et qui travaillent vraiment
   * @param ciel ce que le ciel multiplie a la pousse (§4.21) : 2 sous la pluie
   * @returns le ble moissonne pendant ce tick
   */
  majorer(maintenant: number, fermiers: Habitant[], stocks: Stocks, ciel = 1): number {
    if (maintenant < this.prochainTick) return 0;
    this.prochainTick = maintenant + 1000;
    if (this.liste.length === 0) return 0;

    const budget = fermiers.reduce((somme, f) => somme + cadence(f), 0);
    if (budget <= 0) return 0;

    const pousse = (this.croissanceParSeconde(budget) * ciel) / this.liste.length;
    let moisson = 0;

    for (const champ of this.liste) {
      const avant = champ.mur;
      champ.maturite = Math.min(1, champ.maturite + pousse);
      if (champ.mur && !avant) champ.setTexture(CLES_CHAMP.mur);

      if (champ.mur) {
        // La moisson est automatique : le fermier est deja la, il n'y a aucune
        // decision a prendre a ce moment-la — donc rien a demander au joueur.
        moisson += REGLAGES_CHAMPS.rendement;
        champ.maturite = 0;
        champ.setTexture(CLES_CHAMP.jeune);
      }
    }

    stocks.ble += moisson;
    return moisson;
  }

  /**
   * Ce que le budget de cadence donne comme maturite par seconde, **par temps
   * sec**. Le ciel multiplie le resultat dans `majorer` (§4.21).
   */
  private croissanceParSeconde(budget: number): number {
    const { cadenceDeReference, secondesPourMurir } = REGLAGES_CHAMPS;
    return budget / cadenceDeReference / secondesPourMurir;
  }

  /**
   * Le joueur avance la pousse a la main, en frappant.
   *
   * Meme regle que partout : il recolte en frappant, et bien plus vite qu'un
   * habitant (§4.18). Sur un champ, "recolter" veut dire s'en occuper — et ca
   * lui donne quelque chose a faire des 30 minutes de jour.
   */
  travaillerALaMain(x: number, y: number, force: number, stocks: Stocks): boolean {
    const champ = this.leplusProche(x, y, 46);
    if (!champ) return false;

    const avant = champ.mur;
    champ.maturite = Math.min(1, champ.maturite + force);
    if (champ.mur && !avant) champ.setTexture(CLES_CHAMP.mur);
    if (champ.mur) {
      stocks.ble += REGLAGES_CHAMPS.rendement;
      champ.maturite = 0;
      champ.setTexture(CLES_CHAMP.jeune);
    }
    return true;
  }

  private leplusProche(x: number, y: number, rayon: number): Champ | null {
    let trouve: Champ | null = null;
    let meilleure = rayon;
    for (const champ of this.liste) {
      const d = Phaser.Math.Distance.Between(x, y, champ.x, champ.y);
      if (d <= meilleure) {
        meilleure = d;
        trouve = champ;
      }
    }
    return trouve;
  }

  /**
   * Une horde le traverse : le champ est ruine.
   *
   * C'est toute la raison d'etre du ble. La peche est adossee a un flanc ferme,
   * donc rien ne peut jamais l'atteindre ; une ressource qu'on ne peut pas
   * perdre ne fait rien travailler (§4.18).
   *
   * @returns vrai s'il y avait quelque chose a ruiner
   */
  pietiner(champ: Champ): boolean {
    const index = this.liste.indexOf(champ);
    if (index < 0) return false;

    this.grille.poser(champ.x, champ.y, "ruine");
    this.liste.splice(index, 1);
    champ.destroy();
    return true;
  }

  /** Le carre de terre le plus avance, pour l'affichage du panneau. */
  get maturiteMoyenne(): number {
    if (this.liste.length === 0) return 0;
    return this.liste.reduce((s, c) => s + c.maturite, 0) / this.liste.length;
  }
}

/** Cote d'un champ, en pixels : une case de grille, exactement. */
export const COTE_CHAMP = CASE;
