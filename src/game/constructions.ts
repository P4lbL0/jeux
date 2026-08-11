import Phaser from "phaser";
import {
  CASES_LIBRES_AUTOUR_DES_BATIMENTS,
  CONSTRUCTIONS,
  abordable,
  coutLisible,
  crediter,
  payer,
  remboursementDemolition,
  type ConstructionDef,
  type TypeConstruction,
} from "../core/constructions";
import { CASE, Grille } from "../core/grille";
import type { Ressource, Stocks } from "../core/habitants";

/**
 * Ce qu'on batit, a l'ecran (DESIGN.md §4.20).
 *
 * Une construction est un **corps immobile** : les monstres s'y cognent, la
 * frappent, et elle cede. Elle n'est jamais un decor — sinon elle ne servirait
 * qu'a boucher la vue.
 *
 * La tour a une regle de plus, et c'est celle qui compte : **on peut monter
 * dedans**. Elle ne tire pas, elle ne fait rien ; elle donne une position. C'est
 * l'occupant qui decide de ce qui en sort.
 */

/** Distance a laquelle on peut monter dans une tour, ou en descendre. */
export const PORTEE_OCCUPATION = 60;

export class Construction extends Phaser.Physics.Arcade.Image {
  readonly def: ConstructionDef;
  pv: number;
  /** Qui est dedans ; `null` pour une tour vide et pour tout le reste */
  occupant: Phaser.GameObjects.Sprite | null = null;
  /** Eclair blanc quand elle encaisse, gere sans minuterie (§4.17) */
  flashJusqua = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, def: ConstructionDef) {
    super(scene, x, y, def.texture);
    this.def = def;
    this.pv = def.pvMax;

    scene.add.existing(this);
    scene.physics.add.existing(this, true); // statique : rien ne la pousse
    // Le corps couvre la case, jamais plus : une tour dessinee haute ne doit pas
    // arreter ce qui passe derriere elle.
    const corps = this.body as Phaser.Physics.Arcade.StaticBody;
    corps.setSize(CASE, CASE);
    corps.position.set(x - CASE / 2, y - CASE / 2);
    corps.updateCenter();

    // La profondeur suit le bas de l'objet, comme tout le decor : un personnage
    // devant une tour doit passer devant.
    this.setDepth(y + this.height / 2);
    this.setOrigin(0.5, this.height > CASE ? 0.72 : 0.5);
  }

  get ratioPv(): number {
    return this.pv / this.def.pvMax;
  }

  get intacte(): boolean {
    return this.pv >= this.def.pvMax;
  }
}

/**
 * Le parc de constructions du village.
 *
 * Il tient la grille a jour : poser un mur, c'est **ecrire dans la carte**
 * (§4.21), pas seulement ajouter un sprite. C'est ce qui fera que les crateres
 * du jalon 6 se poseront exactement de la meme facon.
 */
export class Constructions {
  readonly groupe: Phaser.Physics.Arcade.StaticGroup;
  private readonly liste: Construction[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly grille: Grille,
  ) {
    this.groupe = scene.physics.add.staticGroup();
  }

  get toutes(): Construction[] {
    return this.liste;
  }

  /**
   * Pourquoi on ne peut pas batir ici — ou `null` si on peut.
   *
   * Elle rend la **raison** et pas un booleen : le mode d'amenagement doit dire
   * au joueur ce qui cloche, et un refus muet dans une interface de pose est la
   * facon la plus sure de la rendre penible (§4.24).
   *
   * ⚠️ **Le disque interdit de 55 % du rayon du village a disparu ici** (11 aout
   * 2026). C'etait une regle **globale**, qui protegeait un lieu parce qu'il
   * etait a un endroit connu d'avance ; elle contredisait « la carte entiere est
   * constructible » (§4.24) et elle ne voudra plus rien dire au jalon 5.5, ou le
   * village change de place. La regle des trois cases la remplace : elle est
   * **locale**, donc elle survit a tout ce qui vient apres.
   */
  refus(x: number, y: number, type: TypeConstruction, stocks: Stocks): string | null {
    const c = this.grille.caseEn(x, y);
    if (!c) return "Hors de la carte.";
    if (c.occupation === "batiment") return "Il y a deja un batiment ici.";
    if (c.occupation === "mur" || c.occupation === "tour") return "Il y a deja quelque chose ici.";
    if (c.occupation === "champ") return "Un champ est seme ici.";
    if (!this.grille.constructible(x, y)) return "Le sol ne porte pas.";
    if (
      this.grille.aProximite(x, y, CASES_LIBRES_AUTOUR_DES_BATIMENTS, ["batiment"])
    ) {
      return `Trop pres d'un batiment : il faut ${CASES_LIBRES_AUTOUR_DES_BATIMENTS} cases.`;
    }
    if (!abordable(CONSTRUCTIONS[type], stocks)) {
      return `Il manque de quoi : ${coutLisible(CONSTRUCTIONS[type])}.`;
    }
    return null;
  }

  /** Peut-on batir ici ? */
  possible(x: number, y: number, type: TypeConstruction, stocks: Stocks): boolean {
    return this.refus(x, y, type, stocks) === null;
  }

  /** @returns la construction posee, ou null si c'etait impossible */
  batir(x: number, y: number, type: TypeConstruction, stocks: Stocks): Construction | null {
    if (!this.possible(x, y, type, stocks)) return null;

    const def = CONSTRUCTIONS[type];
    const centre = this.grille.centreDe(x, y);
    payer(def, stocks);
    this.grille.poser(centre.x, centre.y, type === "tour" ? "tour" : "mur");

    const construction = new Construction(this.scene, centre.x, centre.y, def);
    this.groupe.add(construction);
    this.liste.push(construction);
    return construction;
  }

  /**
   * Elle encaisse.
   *
   * @returns vrai si elle vient de tomber
   */
  blesser(construction: Construction, degats: number, maintenant: number): boolean {
    construction.pv -= degats;
    construction.flashJusqua = maintenant + 90;
    // L'usure se lit sans barre de vie : une construction qui va ceder s'assombrit.
    construction.setTint(
      construction.ratioPv > 0.5 ? 0xffffff : construction.ratioPv > 0.25 ? 0xc98f7a : 0x8c5a4a,
    );
    return construction.pv <= 0;
  }

  /**
   * Elle tombe — et l'occupant tombe avec elle.
   *
   * Sans cette regle, poster son meilleur heros en tour serait la strategie
   * optimale et definitive du jeu (§4.20). La tour protege vraiment, mais elle
   * est un objectif.
   */
  detruire(construction: Construction): Phaser.GameObjects.Sprite | null {
    const occupant = construction.occupant;
    construction.occupant = null;

    // La case redevient franchissable, mais elle garde une trace : une ruine se
    // voit, et le jalon 8 (restauration) saura quoi en faire.
    this.grille.poser(construction.x, construction.y, "ruine");

    const index = this.liste.indexOf(construction);
    if (index >= 0) this.liste.splice(index, 1);
    construction.destroy();
    return occupant;
  }

  /**
   * Le joueur la demolit lui-meme, en mode amenagement (§4.24).
   *
   * Deux differences avec `detruire`, et elles comptent toutes les deux : ca
   * **rend la moitie** de ce qui tient encore debout, et la case redevient
   * **libre** au lieu de garder une ruine — on a demonte, on n'a pas perdu.
   *
   * @returns ce qui a ete rendu
   */
  demolir(construction: Construction, stocks: Stocks): Partial<Record<Ressource, number>> {
    const rendu = remboursementDemolition(construction.def, construction.pv);
    crediter(rendu, stocks);

    construction.occupant = null;
    this.grille.liberer(construction.x, construction.y);

    const index = this.liste.indexOf(construction);
    if (index >= 0) this.liste.splice(index, 1);
    construction.destroy();
    return rendu;
  }

  /**
   * Elle change de place, gratuitement et instantanement (§4.24).
   *
   * Ce qui se paie, c'est de **construire** ; une fois paye, la disposition
   * appartient au joueur. On ne repose donc pas un objet neuf — on deplace
   * celui-la, **avec ses points de vie**, sinon deplacer reparerait.
   *
   * @returns vrai si le deplacement a eu lieu
   */
  deplacer(construction: Construction, x: number, y: number): boolean {
    const c = this.grille.caseEn(x, y);
    if (!c) return false;
    // On se juge sur la case d'arrivee comme si on batissait, mais sans le prix :
    // meme terrain, meme regle des trois cases, meme refus des cases prises.
    if (!this.grille.constructible(x, y)) return false;
    if (this.grille.aProximite(x, y, CASES_LIBRES_AUTOUR_DES_BATIMENTS, ["batiment"])) return false;

    const centre = this.grille.centreDe(x, y);
    this.grille.liberer(construction.x, construction.y);
    this.grille.poser(centre.x, centre.y, construction.def.occupable ? "tour" : "mur");

    construction.setPosition(centre.x, centre.y);
    const corps = construction.body as Phaser.Physics.Arcade.StaticBody;
    corps.position.set(centre.x - CASE / 2, centre.y - CASE / 2);
    corps.updateCenter();
    construction.setDepth(centre.y + construction.height / 2);

    // L'occupant suit sa tour : le laisser dans le vide en ferait une cible
    // isolee sans que le joueur l'ait decide.
    construction.occupant?.setPosition(centre.x, centre.y);
    return true;
  }

  /** La construction la plus proche de ce point, dans ce rayon. */
  laPlusProche(x: number, y: number, rayon: number): Construction | null {
    let trouvee: Construction | null = null;
    let meilleure = rayon;
    for (const c of this.liste) {
      const d = Phaser.Math.Distance.Between(x, y, c.x, c.y);
      if (d <= meilleure) {
        meilleure = d;
        trouvee = c;
      }
    }
    return trouvee;
  }

  /** La tour libre la plus proche, pour y monter. */
  tourLibre(x: number, y: number, rayon: number): Construction | null {
    let trouvee: Construction | null = null;
    let meilleure = rayon;
    for (const c of this.liste) {
      if (!c.def.occupable || c.occupant) continue;
      const d = Phaser.Math.Distance.Between(x, y, c.x, c.y);
      if (d <= meilleure) {
        meilleure = d;
        trouvee = c;
      }
    }
    return trouvee;
  }

  /** Repose les teintes d'encaissement, une fois par image (§4.17). */
  majorer(maintenant: number): void {
    for (const c of this.liste) {
      if (maintenant < c.flashJusqua) c.setTintFill(0xffffff);
      else if (c.ratioPv > 0.5) c.clearTint();
      else c.setTint(c.ratioPv > 0.25 ? 0xc98f7a : 0x8c5a4a);
    }
  }
}
