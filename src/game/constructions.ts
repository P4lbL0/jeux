import Phaser from "phaser";
import {
  CONSTRUCTIONS,
  abordable,
  payer,
  type ConstructionDef,
  type TypeConstruction,
} from "../core/constructions";
import { CASE, Grille } from "../core/grille";
import { VILLAGE } from "../core/carte";
import type { Stocks } from "../core/habitants";

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
   * Peut-on batir ici ?
   *
   * Trois refus, et chacun a sa raison : le terrain ne porte pas (§4.6), la case
   * est prise, ou c'est au milieu de la place du village — on ne se mure pas
   * chez soi, et surtout les habitants doivent pouvoir y rentrer.
   */
  possible(x: number, y: number, type: TypeConstruction, stocks: Stocks): boolean {
    if (!this.grille.constructible(x, y)) return false;
    if (Phaser.Math.Distance.Between(x, y, VILLAGE.x, VILLAGE.y) < VILLAGE.rayon * 0.55) {
      return false;
    }
    return abordable(CONSTRUCTIONS[type], stocks);
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
