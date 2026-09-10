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
import { CASE, Grille, IMPOSENT_UNE_DISTANCE } from "../core/grille";
import type { Ressource, Stocks } from "../core/habitants";
import { CHANTIERS, CLE_TOUR, ORIGINE_MUR_Y, cleMur, type MatiereMur } from "./dessin/batiments";

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
 *
 * **Et elle bouge comme dans Clash of Clans** (tranche le 10 septembre 2026) :
 * un mur qu'on pose se raccorde a ses voisins, passe par un chantier, surgit
 * quand il est fini, tremble sous les coups et s'effondre quand il tombe. Rien
 * de tout ca n'est une regle : ce sont des gestes d'affichage, et ils ne
 * touchent ni aux points de vie, ni a la grille, ni aux corps.
 */

/** Distance a laquelle on peut monter dans une tour, ou en descendre. */
export const PORTEE_OCCUPATION = 60;

/**
 * Combien de temps l'echafaudage reste dresse sur ce qu'on vient de poser.
 *
 * ⚠️ **Ce n'est pas un temps de construction** — la construction tient, bloque
 * et encaisse des la pose, comme avant. Le §4.20 (tranche le 9 septembre)
 * demande qu'un chantier occupe un batisseur et prenne du temps ; cette regle
 * vit dans le core, et elle n'est pas ecrite. En attendant, le chantier se
 * **voit** : c'est la moitie de la promesse, et celle qui ne coute rien.
 */
export const DUREE_CHANTIER = 4000;

/**
 * La texture d'une construction, d'apres ce qu'elle est.
 *
 * ⚠️ `def.texture` n'est plus lue : le core nomme une `tour` et un
 * `bati-mur-est-ouest-bois` qui n'existent plus, et le core ne se touche pas
 * pour du visuel. Un mur a trois dessins selon sa matiere ; un test verifie que
 * la palissade du joueur prend bien celui du bois.
 */
export function textureDe(def: ConstructionDef, matiere: MatiereMur = "bois"): string {
  return def.occupable ? CLE_TOUR : cleMur(matiere);
}

export class Construction extends Phaser.Physics.Arcade.Image {
  readonly def: ConstructionDef;
  pv: number;
  /** Qui est dedans ; `null` pour une tour vide et pour tout le reste */
  occupant: Phaser.GameObjects.Sprite | null = null;
  /** Eclair blanc quand elle encaisse, gere sans minuterie (§4.17) */
  flashJusqua = 0;
  /**
   * Le palier d'un mur (§4.20) : bois, fer, pierre. Les trois sont dessines ;
   * seul le bois se pose, tant que la regle d'amelioration n'est pas ecrite.
   */
  matiere: MatiereMur = "bois";
  /** Jusqu'a quand l'echafaudage se voit ; 0 quand le chantier est fini. */
  chantierJusqua = 0;
  /** Jusqu'a quand elle tremble d'un coup ; un coup par secousse, pas plus. */
  secoueeJusqua = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, def: ConstructionDef) {
    super(scene, x, y, textureDe(def));
    this.def = def;
    this.pv = def.pvMax;

    scene.add.existing(this);
    scene.physics.add.existing(this, true); // statique : rien ne la pousse
    // Le corps couvre la case, jamais plus : une tour dessinee haute ne doit pas
    // arreter ce qui passe derriere elle.
    this.caler();
    this.habiller();
  }

  /** Le corps physique, sur sa case. */
  private caler(): void {
    const corps = this.body as Phaser.Physics.Arcade.StaticBody;
    corps.setSize(CASE, CASE);
    corps.position.set(this.x - CASE / 2, this.y - CASE / 2);
    corps.updateCenter();
  }

  get enChantier(): boolean {
    return this.chantierJusqua > 0;
  }

  /**
   * Texture, origine et profondeur suivent ce qu'elle est.
   *
   * Un mur est un bloc dont le dessus couvre la case : son origine met le
   * centre de la case au sol, et c'est **la profondeur qui raccorde** deux
   * blocs l'un au-dessus de l'autre — le plus bas se dessine apres et recouvre
   * la face du plus haut (§4.30, les murs en bloc).
   */
  habiller(): void {
    if (this.enChantier) {
      this.setTexture(CHANTIERS.case.cle);
      this.setOrigin(0.5, 0.5);
    } else {
      this.setTexture(textureDe(this.def, this.matiere));
      this.setOrigin(0.5, this.def.occupable ? 0.72 : ORIGINE_MUR_Y);
    }
    // La profondeur suit le pied de l'objet, comme tout le decor : un
    // personnage devant un mur doit passer devant.
    this.setDepth(this.y + CASE / 2);
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
    if (c.occupation === "maison") return "Il y a une maison ici.";
    if (c.occupation === "mur" || c.occupation === "tour") return "Il y a deja quelque chose ici.";
    if (c.occupation === "champ") return "Un champ est seme ici.";
    if (!this.grille.constructible(x, y)) return "Le sol ne porte pas.";
    if (
      this.grille.aProximite(x, y, CASES_LIBRES_AUTOUR_DES_BATIMENTS, IMPOSENT_UNE_DISTANCE)
    ) {
      return `Trop pres de l'eglise ou du port : il faut ${CASES_LIBRES_AUTOUR_DES_BATIMENTS} cases.`;
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

  /**
   * @param maintenant l'horloge de la scene ; omise, la construction est finie
   *        d'emblee — c'est le cas d'une partie qu'on reprend (§4.28).
   * @returns la construction posee, ou null si c'etait impossible
   */
  batir(
    x: number,
    y: number,
    type: TypeConstruction,
    stocks: Stocks,
    maintenant?: number,
  ): Construction | null {
    if (!this.possible(x, y, type, stocks)) return null;

    const def = CONSTRUCTIONS[type];
    const centre = this.grille.centreDe(x, y);
    payer(def, stocks);
    this.grille.poser(centre.x, centre.y, type === "tour" ? "tour" : "mur");

    const construction = new Construction(this.scene, centre.x, centre.y, def);
    if (maintenant !== undefined) {
      construction.chantierJusqua = maintenant + DUREE_CHANTIER;
      construction.habiller();
    }
    this.groupe.add(construction);
    this.liste.push(construction);
    return construction;
  }

  /**
   * Elle surgit : un rebond d'echelle, et c'est fini.
   *
   * C'est le geste de Clash of Clans a la pose. Le corps physique ne suit pas
   * l'echelle — il n'a pas a le faire, le rebond dure un quart de seconde.
   */
  private surgir(construction: Construction): void {
    construction.setScale(0.55);
    this.scene.tweens.add({
      targets: construction,
      scaleX: 1,
      scaleY: 1,
      duration: 280,
      ease: "Back.easeOut",
    });
  }

  /**
   * Les chantiers finissent, une fois par image (§4.17 : un horodatage, pas
   * une minuterie).
   *
   * @param actif faux quand la scene est en pause : un chantier n'avance pas
   *        pendant qu'on amenage.
   */
  finirLesChantiers(maintenant: number, actif = true): void {
    if (!actif) return;
    for (const c of this.liste) {
      if (!c.enChantier || maintenant < c.chantierJusqua) continue;
      c.chantierJusqua = 0;
      c.habiller();
      this.surgir(c);
    }
  }

  /** Repousse les chantiers du temps passe en pause, comme tout le reste. */
  decaler(millisecondes: number): void {
    for (const c of this.liste) if (c.enChantier) c.chantierJusqua += millisecondes;
  }

  /**
   * Elle encaisse.
   *
   * @returns vrai si elle vient de tomber
   */
  blesser(construction: Construction, degats: number, maintenant: number): boolean {
    construction.pv -= degats;
    construction.flashJusqua = maintenant + 90;
    this.secouer(construction, maintenant);
    return construction.pv <= 0;
  }

  /**
   * Elle tremble sous le coup : deux pixels, deux allers-retours.
   *
   * ⚠️ **Une secousse a la fois.** Vingt monstres sur le meme mur le
   * frapperaient dix fois par seconde : un tween par coup en empilerait des
   * dizaines et le mur partirait en vrille. L'horodatage tient la cadence.
   */
  private secouer(construction: Construction, maintenant: number): void {
    if (maintenant < construction.secoueeJusqua) return;
    construction.secoueeJusqua = maintenant + 160;
    const x0 = construction.x;
    this.scene.tweens.add({
      targets: construction,
      x: x0 + 2,
      duration: 40,
      yoyo: true,
      repeat: 1,
      onComplete: () => {
        if (construction.active) construction.setX(x0);
      },
    });
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

    this.effondrer(construction);
    this.retirer(construction);
    return occupant;
  }

  /**
   * L'effondrement : une copie detachee s'ecrase et s'efface.
   *
   * Le vrai objet est detruit dans la foulee — la copie n'a ni corps ni regle,
   * exactement comme la depouille d'un monstre.
   */
  private effondrer(construction: Construction): void {
    const debris = this.scene.add
      .image(construction.x, construction.y, construction.texture.key)
      .setOrigin(construction.originX, construction.originY)
      .setFlipX(construction.flipX)
      .setDepth(construction.depth);
    this.scene.tweens.add({
      targets: debris,
      scaleY: 0.15,
      scaleX: 1.2,
      alpha: 0,
      y: construction.y + 6,
      duration: 260,
      ease: "Quad.easeIn",
      onComplete: () => debris.destroy(),
    });
  }

  private retirer(construction: Construction): void {
    this.scene.tweens.killTweensOf(construction);
    const index = this.liste.indexOf(construction);
    if (index >= 0) this.liste.splice(index, 1);
    construction.destroy();
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
    this.retirer(construction);
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
    if (this.grille.aProximite(x, y, CASES_LIBRES_AUTOUR_DES_BATIMENTS, IMPOSENT_UNE_DISTANCE)) {
      return false;
    }

    // Une secousse en cours ramenerait l'objet a son ancienne place.
    this.scene.tweens.killTweensOf(construction);

    const centre = this.grille.centreDe(x, y);
    this.grille.liberer(construction.x, construction.y);
    this.grille.poser(centre.x, centre.y, construction.def.occupable ? "tour" : "mur");

    construction.setPosition(centre.x, centre.y);
    const corps = construction.body as Phaser.Physics.Arcade.StaticBody;
    corps.position.set(centre.x - CASE / 2, centre.y - CASE / 2);
    corps.updateCenter();

    // L'occupant suit sa tour : le laisser dans le vide en ferait une cible
    // isolee sans que le joueur l'ait decide.
    construction.occupant?.setPosition(centre.x, centre.y);
    construction.habiller();
    this.surgir(construction);
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

  /**
   * Repose les teintes d'encaissement, une fois par image (§4.17).
   *
   * L'usure se lit sans barre de vie : une construction qui va ceder
   * s'assombrit. Le fer de la palette, jamais une teinte d'ailleurs.
   */
  majorer(maintenant: number): void {
    for (const c of this.liste) {
      if (maintenant < c.flashJusqua) c.setTintFill(0xffffff);
      else if (c.ratioPv > 0.5) c.clearTint();
      else c.setTint(c.ratioPv > 0.25 ? 0xb0a49a : 0x7a6c66);
    }
  }
}
