import Phaser from "phaser";
import {
  CASES_LIBRES_AUTOUR_DES_BATIMENTS,
  CONSTRUCTIONS,
  PONT_LEVIS,
  REMPLISSAGE,
  abordable,
  coutLisible,
  crediter,
  occupationDe,
  payer,
  remboursementDemolition,
  type ConstructionDef,
  type TypeConstruction,
  amelioration,
  coutEnClair,
  palierDe,
  peutPayer,
  regler,
} from "../core/constructions";
import { CASE, Grille, IMPOSENT_UNE_DISTANCE, RACCORDABLES, type Occupation } from "../core/grille";
import type { Ressource, Stocks } from "../core/habitants";
import { Battant, REGLAGES_PORTE, aPortee, consigneDeNuit, enfermeraitSansPorte, noieraitSansPassage, type PositionPorte } from "../core/portes";
import { CHANTIERS } from "./dessin/batiments";
import {
  CLE_TOUR,
  ORIGINE_MUR_Y,
  ORIGINE_TOUR_Y,
  cleDouve,
  cleMur,
  clePorte,
  masqueDe,
  type EtatDouve,
  type MatiereMur,
} from "./dessin/murs";

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
 * La porte en a d'autres, et c'est le bloc 7b (20 septembre 2026) : elle
 * **s'ouvre en deux secondes et se referme en deux secondes** (`core/portes.ts`),
 * la cloche la ferme **quand plus personne n'est dehors**, et fermee elle
 * **s'ouvre toute seule devant quelqu'un si aucun monstre n'est pres**. Ouverte,
 * tout le monde passe — les habitants qui sortent travailler, et les monstres
 * s'ils sont la. Fermee, elle arrete tout le monde et se fait frapper comme un
 * mur. Et **on ne peut pas se murer sans porte** : le mur qui refermerait une
 * zone est refuse.
 *
 * La douve (§4.20) est **un trou, pas un volume** : seche, on la franchit
 * lentement ; en eau, plus du tout, sauf par un **pont-levis** baisse. Elle ne
 * se casse pas.
 *
 * **Et tout ca bouge comme dans Clash of Clans** (tranche le 10 septembre 2026,
 * refait le 11) : un mur qu'on pose **regarde ses quatre voisines** et prend le
 * dessin qui se raccorde a elles — et ses voisines se redessinent pour se
 * raccorder a lui. Il passe par un chantier, surgit quand il est fini, tremble
 * sous les coups et s'effondre quand il tombe. Rien de tout ca n'est une
 * regle : ce sont des gestes d'affichage, et ils ne touchent ni aux points de
 * vie, ni a la grille, ni aux corps.
 */

/** Distance a laquelle on peut monter dans une tour, ou en descendre. */
export const PORTEE_OCCUPATION = 60;

/**
 * Combien de **travail de batisseur** un chantier demande, en millisecondes
 * (DESIGN.md §4.20, §4.24, bloc 8).
 *
 * ⚠️ **Ce n'est plus une minuterie.** Jusqu'au 21 septembre 2026, l'echafaudage
 * se levait tout seul au bout de quatre secondes, et la promesse « un chantier
 * occupe un batisseur » n'etait pas tenue. Ces quatre secondes sont maintenant
 * du **temps de charpentier** : sans personne a l'atelier, l'echafaudage reste
 * dresse indefiniment, et autant de chantiers avancent que de batisseurs
 * affectes.
 *
 * Quatre secondes par segment : assez pour qu'une enceinte entiere demande
 * qu'on y mette des bras, assez peu pour qu'un mur de secours se leve dans la
 * minute. *Chiffre tranche par le code, a corriger en jouant.*
 */
export const DUREE_CHANTIER = 4000;

/**
 * Ce qu'un ouvrage inacheve tient debout, en part de ses points de vie.
 *
 * ⚠️ **La construction bloque des la pose, comme avant** : on ne change pas la
 * physique d'un mur en cours de route, et un mur qu'on poserait en pleine nuit
 * sans qu'il arrete rien serait un piege. Ce qui change, c'est qu'il est
 * **fragile** tant que personne ne l'a fini — c'est la que « ca prend du
 * temps » se paie. *Chiffre tranche par le code.*
 */
export const PART_EN_CHANTIER = 0.3;

/** A quelle distance un batisseur travaille sur un chantier, en pixels. */
export const PORTEE_BATISSEUR = 46;

/** Ce qu'il reste de la vitesse de qui traverse une douve seche (§4.20 : « lentement, a decouvert »). */
export const RALENTI_DOUVE = 0.35;

/** La profondeur d'une douve : au ras du sol, sous tout ce qui marche et sous les chemins. */
const PROFONDEUR_DOUVE = -600;

/** Les terrains d'ou l'eau vient remplir une douve. */
const TERRAINS_D_EAU = new Set(["haut-fond", "mer", "abysse"]);

/** Ce qui compte comme une douve pour le raccord d'une douve. */
const DOUVES: Occupation[] = ["douve", "douve-eau"];

/** Ce qu'il faut savoir d'une construction pour choisir son dessin. */
export interface Habit {
  matiere?: MatiereMur;
  masque?: number;
  position?: PositionPorte;
  pontLevis?: boolean;
  douve?: EtatDouve;
}

/**
 * La texture d'une construction, d'apres ce qu'elle est et ce qui l'entoure.
 *
 * `def.texture` n'est que le prefixe de la famille : c'est ici qu'on choisit
 * le dessin, d'apres le raccord aux voisines et, pour une porte, son etat.
 */
export function textureDe(def: ConstructionDef, habit: Habit = {}): string {
  const matiere = habit.matiere ?? "bois";
  const masque = habit.masque ?? 0;
  if (def.id === "tour") return CLE_TOUR;
  if (def.id === "porte") return clePorte(matiere, masque, habit.position ?? "ouverte", habit.pontLevis ?? false);
  if (def.id === "douve") return cleDouve(masque, habit.douve ?? "seche");
  return cleMur(matiere, masque);
}

/** L'origine verticale du sprite : le centre de la case tombe au sol. */
export function origineDe(def: ConstructionDef): number {
  if (def.id === "tour") return ORIGINE_TOUR_Y;
  if (def.id === "douve") return 0.5;
  return ORIGINE_MUR_Y;
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
   * le bois se pose, et `Constructions.ameliorer` fait monter un segment d'un
   * palier (19 septembre 2026).
   */
  matiere: MatiereMur = "bois";
  /** Le raccord aux voisines : nord 1, est 2, sud 4, ouest 8 (§4.30). */
  masque = 0;
  /** Le battant d'une porte ; `null` pour tout le reste. */
  readonly battant: Battant | null;
  /** Ce que la porte montre en ce moment : redessinee quand ca change. */
  position: PositionPorte = "ouverte";
  /** Une porte devenue pont-levis (§4.20) : son tablier s'abat sur la douve devant. */
  pontLevis = false;
  /** L'instant de la derniere demande servie par cette porte, la nuit. */
  derniereDemande = -Infinity;
  /** Une douve remplie d'eau : plus personne ne la franchit (§4.20). */
  eau = false;
  /** Une douve en eau sous le tablier d'un pont-levis baisse : on passe. */
  pont = false;
  /**
   * Une douve en eau devant un pont-levis, baisse ou leve : c'est la que les
   * monstres viennent attendre (§4.20) — le parcours les y mene, meme si le
   * tablier est leve et que rien ne passe.
   */
  enjambee = false;
  /**
   * Le travail de batisseur qu'il reste a faire dessus, en millisecondes ; 0
   * quand le chantier est fini (§4.20, bloc 8).
   */
  travailRestant = 0;
  /** Jusqu'a quand elle tremble d'un coup ; un coup par secousse, pas plus. */
  secoueeJusqua = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, def: ConstructionDef) {
    super(scene, x, y, textureDe(def));
    this.def = def;
    this.pv = def.pvMax;
    this.battant = def.id === "porte" ? new Battant(true) : null;

    scene.add.existing(this);
    scene.physics.add.existing(this, true); // statique : rien ne la pousse
    // Le corps couvre la case, jamais plus : une tour dessinee haute ne doit pas
    // arreter ce qui passe derriere elle.
    this.caler();
    this.habiller();
  }

  /** Le corps physique, sur sa case. */
  caler(): void {
    const corps = this.body as Phaser.Physics.Arcade.StaticBody;
    corps.setSize(CASE, CASE);
    corps.position.set(this.x - CASE / 2, this.y - CASE / 2);
    corps.updateCenter();
  }

  /** Les points de vie du palier atteint (§4.20) : 120 en bois, 500 en fer pour un mur. */
  get pvMax(): number {
    return palierDe(this.def, this.matiere).pvMax;
  }

  get enChantier(): boolean {
    return this.travailRestant > 0;
  }

  /**
   * Vrai si on passe a travers : une porte entierement ouverte, une douve
   * seche (on y est ralenti, pas arrete), une douve en eau sous un pont
   * baisse. Rien d'autre.
   */
  get laissePasser(): boolean {
    if (this.battant) return this.battant.laissePasser;
    if (this.def.id === "douve") return !this.eau || this.pont;
    return false;
  }

  /** L'etat d'une douve, pour son dessin. */
  get etatDouve(): EtatDouve {
    return !this.eau ? "seche" : this.pont ? "pont" : "eau";
  }

  /**
   * Texture, origine et profondeur suivent ce qu'elle est.
   *
   * Le centre de la case tombe au sol, et c'est **la profondeur qui raccorde**
   * deux cases l'une au-dessus de l'autre — la plus basse se dessine apres et
   * recouvre la face de la plus haute (§4.30). Une douve, elle, est au ras du
   * sol : tout marche par-dessus.
   */
  habiller(): void {
    if (this.enChantier) {
      this.setTexture(CHANTIERS.case.cle);
      this.setOrigin(0.5, 0.5);
    } else {
      this.setTexture(
        textureDe(this.def, {
          matiere: this.matiere,
          masque: this.masque,
          position: this.position,
          pontLevis: this.pontLevis,
          douve: this.etatDouve,
        }),
      );
      this.setOrigin(0.5, origineDe(this.def));
    }
    // La profondeur suit le pied de l'objet, comme tout le decor : un
    // personnage devant un mur doit passer devant.
    this.setDepth(this.def.id === "douve" ? PROFONDEUR_DOUVE : this.y + CASE / 2);
  }

  get ratioPv(): number {
    return this.pv / this.pvMax;
  }

  get intacte(): boolean {
    return this.pv >= this.pvMax;
  }
}

/**
 * Le parc de constructions du village.
 *
 * Il tient la grille a jour : poser un mur, c'est **ecrire dans la carte**
 * (§4.21), pas seulement ajouter un sprite. C'est ce qui fera que les crateres
 * du jalon 6 se poseront exactement de la meme facon. Et c'est la grille qu'il
 * relit pour raccorder chaque mur a ses voisines.
 */
export class Constructions {
  readonly groupe: Phaser.Physics.Arcade.StaticGroup;
  private readonly liste: Construction[] = [];
  /** La construction de chaque case, par `colonne,ligne`. */
  private readonly parCase = new Map<number, Construction>();
  /**
   * La derniere reponse de la regle « pas de mur sans porte », par case : la
   * propagation ne tourne qu'une fois par case visee, jamais par image — le
   * fantome de pose interroge la regle a chaque image (§4.17).
   */
  private fermetureMemo: { cle: number; version: number; enferme: boolean } | null = null;
  /** Monte a chaque ecriture dans la grille : ce qui perime le memo. */
  private version = 0;
  /** Le dernier battement de la consigne de nuit (§4.17 regle 5). */
  private dernierBattement = -Infinity;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly grille: Grille,
  ) {
    this.groupe = scene.physics.add.staticGroup();
  }

  get toutes(): Construction[] {
    return this.liste;
  }

  /** Les portes sont-elles fermees — la consigne ? C'est la grille qui le sait. */
  get portesFermees(): boolean {
    return this.grille.portesFermees;
  }

  get portes(): Construction[] {
    return this.liste.filter((c) => c.battant !== null);
  }

  /**
   * L'identite d'une case, en un nombre.
   *
   * ⚠️ **Un nombre, pas une chaine** (§4.33, palier 1) : `ralentissement` et
   * `contournement` la demandent pour chaque monstre a chaque image, et
   * `"12,7"` fabriquait deux ou trois chaines jetees par monstre et par image —
   * des milliers a la seconde des que la horde grossit. Decalee de 32 768 pour
   * qu'une case hors de la carte ait aussi la sienne.
   */
  private cleDe(x: number, y: number): number {
    return (this.grille.ligneDe(y) + 32768) * 65536 + (this.grille.colonneDe(x) + 32768);
  }

  /** Ce qui est bati sur la case de ce point, s'il y a quelque chose. */
  en(x: number, y: number): Construction | null {
    return this.parCase.get(this.cleDe(x, y)) ?? null;
  }

  /**
   * Le raccord d'une case : quelles voisines portent un mur, une tour ou une
   * porte. C'est ce que lit le dessin, et c'est aussi ce que voit l'apercu de
   * pose — un mur qu'on s'apprete a poser montre deja ses raccords (§4.30).
   */
  masqueEn(x: number, y: number): number {
    const v = this.grille.voisinesRaccordees(this.grille.colonneDe(x), this.grille.ligneDe(y));
    return masqueDe(v.nord, v.est, v.sud, v.ouest);
  }

  /** Le raccord d'une douve : quelles voisines sont des douves. */
  masqueDouveEn(x: number, y: number): number {
    const douve = (dx: number, dy: number) => DOUVES.includes(this.grille.occupationEn(x + dx, y + dy));
    return masqueDe(douve(0, -CASE), douve(CASE, 0), douve(0, CASE), douve(-CASE, 0));
  }

  /**
   * Redessine ce qui est bati sur cette case et sur ses quatre voisines : c'est
   * le raccord de Clash of Clans. A la pose, a la chute, au deplacement — jamais
   * par image.
   */
  private rehabillerAutour(x: number, y: number): void {
    for (const [dx, dy] of [
      [0, 0],
      [0, -CASE],
      [CASE, 0],
      [0, CASE],
      [-CASE, 0],
    ] as const) {
      const c = this.en(x + dx, y + dy);
      if (!c) continue;
      c.masque = c.def.id === "douve" ? this.masqueDouveEn(c.x, c.y) : this.masqueEn(c.x, c.y);
      c.habiller();
    }
  }

  private inscrire(construction: Construction): void {
    this.groupe.add(construction);
    this.liste.push(construction);
    this.parCase.set(this.cleDe(construction.x, construction.y), construction);
  }

  /** Ecrit dans la grille, et perime ce qui en dependait. */
  private ecrire(x: number, y: number, occupation: Occupation): void {
    this.grille.poser(x, y, occupation);
    this.version += 1;
  }

  /**
   * Poser un mur ici refermerait-il une enceinte sans porte (§4.20) ?
   *
   * La propagation est memoisee par case et par version de la grille : le
   * fantome de pose la demande a chaque image, et elle ne doit tourner qu'au
   * changement de case.
   */
  enfermerait(x: number, y: number): boolean {
    const cle = this.cleDe(x, y);
    if (this.fermetureMemo && this.fermetureMemo.cle === cle && this.fermetureMemo.version === this.version) {
      return this.fermetureMemo.enferme;
    }
    const enferme = enfermeraitSansPorte(this.grille, x, y);
    this.fermetureMemo = { cle, version: this.version, enferme };
    return enferme;
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
    if (c.occupation === "decombres") return "Une maison en ruine : releve-la (L), ou demolis-la.";
    if (RACCORDABLES.includes(c.occupation)) return "Il y a deja quelque chose ici.";
    if (DOUVES.includes(c.occupation)) {
      return type === "douve" ? "Il y a deja une douve ici : clic pour la remplir d'eau." : "Une douve : comble-la d'abord (clic droit en amenagement).";
    }
    if (c.occupation === "champ") return "Un champ est seme ici.";
    if (!this.grille.constructible(x, y, true)) return "Le sol ne porte pas.";
    if (
      this.grille.aProximite(x, y, CASES_LIBRES_AUTOUR_DES_BATIMENTS, IMPOSENT_UNE_DISTANCE)
    ) {
      return `Trop pres de l'eglise ou du port : il faut ${CASES_LIBRES_AUTOUR_DES_BATIMENTS} cases.`;
    }
    // On ne se mure jamais sans porte (§4.20, bloc 7b) : le mur — ou la tour —
    // qui refermerait le dernier passage est refuse, en le disant.
    if ((type === "palissade" || type === "tour") && this.enfermerait(x, y)) {
      return "Ca fermerait l'enceinte sans porte : pose une porte (K) ici.";
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
    this.ecrire(centre.x, centre.y, occupationDe(type));

    const construction = new Construction(this.scene, centre.x, centre.y, def);
    // Une porte posee de nuit, consigne fermee, nait fermee.
    if (construction.battant && this.grille.portesFermees) {
      construction.battant.phase = "fermee";
      construction.position = "fermee";
    }
    // Un trou n'a pas d'echafaudage. Et un mur pose par le generateur du monde
    // n'en a pas non plus : un village trouve est deja bati (§4.29), et c'est
    // `maintenant` qui distingue les deux.
    if (maintenant !== undefined && type !== "douve") this.ouvrirLeChantier(construction);
    this.inscrire(construction);
    this.rehabillerAutour(centre.x, centre.y);
    return construction;
  }

  /**
   * Renforce un segment d'un palier — bois vers fer, puis fer vers pierre
   * (§4.20, tranche le 9 septembre 2026 : segment par segment, comme dans
   * Clash of Clans ; la pierre a sa ressource depuis le bloc 7b). Le segment
   * est remis a neuf avec les points de vie du nouveau palier, et le chantier
   * se voit le temps de `DUREE_CHANTIER`. Le batisseur qu'il devrait occuper
   * attend le bloc 8.
   *
   * @returns la matiere atteinte, ou null si rien n'etait possible
   */
  ameliorer(construction: Construction, stocks: Stocks, maintenant?: number): MatiereMur | null {
    const suite = amelioration(construction.def, construction.matiere);
    if (!suite || !peutPayer(suite.palier.cout, stocks)) return null;
    regler(suite.palier.cout, stocks);
    construction.matiere = suite.matiere;
    construction.pv = suite.palier.pvMax;
    if (maintenant !== undefined) this.ouvrirLeChantier(construction);
    construction.habiller();
    return suite.matiere;
  }

  /** Pourquoi on ne peut pas renforcer ce segment, en clair — ou null si on peut. */
  refusAmelioration(construction: Construction, stocks: Stocks): string | null {
    const nom = construction.def.nom;
    if (!construction.def.paliers) return `${nom} : ca ne se renforce pas`;
    const suite = amelioration(construction.def, construction.matiere);
    if (!suite) return `${nom} en pierre : rien au-dessus`;
    if (!peutPayer(suite.palier.cout, stocks)) {
      return `Il faut ${coutEnClair(suite.palier.cout)} pour passer ${nom.toLowerCase()} au ${suite.matiere}`;
    }
    return null;
  }

  // ------------------------------------------------------------- la douve

  /** Y a-t-il de l'eau contre cette case : la mer, ou une douve en eau ? */
  private eauContre(x: number, y: number): boolean {
    for (const [dx, dy] of [
      [0, -CASE],
      [CASE, 0],
      [0, CASE],
      [-CASE, 0],
    ] as const) {
      const c = this.grille.caseEn(x + dx, y + dy);
      if (!c) continue;
      if (TERRAINS_D_EAU.has(c.terrain) || c.occupation === "douve-eau") return true;
    }
    return false;
  }

  /** Pourquoi on ne peut pas remplir cette douve — ou null si on peut. */
  refusRemplissage(douve: Construction, stocks: Stocks): string | null {
    if (douve.def.id !== "douve") return "Ce n'est pas une douve";
    if (douve.eau) return "Cette douve est deja en eau";
    if (!this.eauContre(douve.x, douve.y)) return "Pas d'eau a cote : une douve se remplit depuis la mer, ou depuis une douve en eau";
    // On ne se noie pas sans passage (§4.20, 20 septembre 2026) : la douve en
    // eau qui fermerait le dernier passage est refusee, comme le mur. Devant
    // une porte, elle passe — un pont-levis l'enjambera.
    if (noieraitSansPassage(this.grille, douve.x, douve.y)) {
      return "Ca fermerait tout sans passage : garde une porte contre la douve, pour un pont-levis";
    }
    if (!peutPayer(REMPLISSAGE.cout, stocks)) return `Il faut ${coutEnClair(REMPLISSAGE.cout)} pour la vanne`;
    return null;
  }

  /**
   * Appele a chaque fois que ce qui **passe** change : une douve mise en eau
   * ou comblee, un pont-levis qui se leve ou s'abat. C'est la scene qui s'y
   * branche pour refaire le parcours des monstres (§4.6) — jamais par image.
   */
  surChangementDePassage: (() => void) | null = null;

  /**
   * Remplit une douve d'eau (§4.20) : depuis la mer, ou de proche en proche
   * depuis une douve deja en eau. Elle bloque alors tout ce qui ne nage pas.
   *
   * @returns vrai si elle vient d'etre remplie
   */
  remplir(douve: Construction, stocks: Stocks): boolean {
    if (this.refusRemplissage(douve, stocks)) return false;
    regler(REMPLISSAGE.cout, stocks);
    douve.eau = true;
    this.ecrire(douve.x, douve.y, "douve-eau");
    this.majPonts();
    douve.habiller();
    return true;
  }

  /**
   * Remplit une douve sans rien payer ni verifier : c'est la reprise d'une
   * partie (§4.28), ou l'eau etait deja la.
   */
  remplirDeForce(douve: Construction): void {
    douve.eau = true;
    this.ecrire(douve.x, douve.y, "douve-eau");
    this.majPonts();
    douve.habiller();
  }

  /** Ce qu'il reste de la vitesse de qui est sur ce point : une douve seche ralentit. */
  ralentissement(x: number, y: number): number {
    const c = this.parCase.get(this.cleDe(x, y));
    return c && c.def.id === "douve" && !c.eau ? RALENTI_DOUVE : 1;
  }

  // -------------------------------------------------------- le pont-levis

  /** Les douves en eau qu'un pont-levis a cette porte enjamberait : devant et derriere, dans son axe. */
  private douvesDevant(porte: Construction): Construction[] {
    const v = this.grille.voisinesRaccordees(this.grille.colonneDe(porte.x), this.grille.ligneDe(porte.y));
    const nordSud = (v.nord || v.sud) && !(v.est || v.ouest);
    const pas: ReadonlyArray<readonly [number, number]> = nordSud
      ? [
          [CASE, 0],
          [-CASE, 0],
        ]
      : [
          [0, -CASE],
          [0, CASE],
        ];
    const douves: Construction[] = [];
    for (const [dx, dy] of pas) {
      const c = this.en(porte.x + dx, porte.y + dy);
      if (c && c.def.id === "douve" && c.eau) douves.push(c);
    }
    return douves;
  }

  /** Pourquoi cette porte ne peut pas devenir un pont-levis — ou null si elle le peut. */
  refusPontLevis(porte: Construction, stocks: Stocks): string | null {
    if (!porte.battant) return "Ce n'est pas une porte";
    if (porte.pontLevis) return "C'est deja un pont-levis";
    if (this.douvesDevant(porte).length === 0) return "Un pont-levis enjambe une douve en eau : il en faut une devant la porte";
    if (!peutPayer(PONT_LEVIS.cout, stocks)) return `Il faut ${coutEnClair(PONT_LEVIS.cout)} pour un pont-levis`;
    return null;
  }

  /**
   * Une porte devient un pont-levis (§4.20) : fermee, plus de passage du
   * tout ; ouverte, son tablier couche sur la douve devant, et on passe.
   */
  convertirEnPontLevis(porte: Construction, stocks: Stocks): boolean {
    if (this.refusPontLevis(porte, stocks)) return false;
    regler(PONT_LEVIS.cout, stocks);
    porte.pontLevis = true;
    porte.habiller();
    this.majPonts();
    return true;
  }

  /**
   * Un pont-levis **sans rien payer** : celui que le village avait deja quand
   * on arrive (§4.29, un village tire avec ses douves). Il faut quand meme une
   * douve en eau devant.
   *
   * @returns vrai s'il vient d'etre dresse
   */
  dresserEnPontLevis(porte: Construction): boolean {
    if (!porte.battant || porte.pontLevis || this.douvesDevant(porte).length === 0) return false;
    porte.pontLevis = true;
    porte.habiller();
    this.majPonts();
    return true;
  }

  /**
   * Quelles douves en eau sont sous un tablier baisse : celles qui touchent,
   * dans son axe, un pont-levis entierement ouvert. Refait a chaque
   * changement d'etat d'une porte, jamais par image.
   */
  private majPonts(): void {
    const sousUnPont = new Set<Construction>();
    const enjambees = new Set<Construction>();
    for (const porte of this.liste) {
      if (!porte.pontLevis) continue;
      for (const douve of this.douvesDevant(porte)) {
        enjambees.add(douve);
        if (porte.battant?.laissePasser) sousUnPont.add(douve);
      }
    }
    for (const c of this.liste) {
      if (c.def.id !== "douve" || !c.eau) continue;
      c.enjambee = enjambees.has(c);
      const pont = sousUnPont.has(c);
      if (pont === c.pont) continue;
      c.pont = pont;
      c.habiller();
    }
    this.surChangementDePassage?.();
  }

  /**
   * Dresse une construction **sans rien payer ni verifier de stocks** : c'est
   * l'enceinte de depart, celle que le village avait deja quand on arrive.
   *
   * Le terrain et les cases prises se verifient quand meme — on ne dresse pas
   * un mur dans la mer ni sur une maison. Pas de chantier : elle etait la.
   *
   * @returns la construction, ou null si la case ne s'y pretait pas
   */
  dresser(x: number, y: number, type: TypeConstruction, matiere: MatiereMur = "bois"): Construction | null {
    const c = this.grille.caseEn(x, y);
    if (!c || !this.grille.constructible(x, y, true)) return null;

    const def = CONSTRUCTIONS[type];
    const centre = this.grille.centreDe(x, y);
    this.ecrire(centre.x, centre.y, occupationDe(type));

    const construction = new Construction(this.scene, centre.x, centre.y, def);
    construction.matiere = matiere;
    this.inscrire(construction);
    this.rehabillerAutour(centre.x, centre.y);
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
   * On dresse l'echafaudage : le travail a faire, et les points de vie d'un
   * ouvrage inacheve (§4.20, bloc 8).
   */
  private ouvrirLeChantier(construction: Construction): void {
    construction.travailRestant = DUREE_CHANTIER;
    construction.pv = Math.max(1, Math.round(construction.pvMax * PART_EN_CHANTIER));
  }

  /** Combien de chantiers attendent des bras. */
  get chantiersOuverts(): number {
    return this.liste.reduce((n, c) => n + (c.enChantier ? 1 : 0), 0);
  }

  /**
   * Le chantier le plus proche d'un point, ou `null` s'il n'y en a aucun.
   *
   * C'est ce que le charpentier cherche : il n'a pas de poste sur la carte, son
   * poste **c'est le chantier en cours** (§4.18).
   */
  chantierLePlusProche(x: number, y: number): Construction | null {
    let meilleur: Construction | null = null;
    let distance = Infinity;
    for (const c of this.liste) {
      if (!c.enChantier) continue;
      const d = Phaser.Math.Distance.Between(x, y, c.x, c.y);
      if (d < distance) {
        distance = d;
        meilleur = c;
      }
    }
    return meilleur;
  }

  /**
   * Les chantiers avancent — **du travail des batisseurs, et de rien d'autre**
   * (DESIGN.md §4.20, §4.24 : « un chantier occupe un batisseur, et il y a
   * autant de chantiers simultanes que d'habitants affectes »).
   *
   * ⚠️ **Un batisseur ne tient qu'un chantier a la fois.** Deux charpentiers
   * cote a cote sur le meme mur ne le montent pas deux fois plus vite : ils
   * montent deux murs. C'est ce qui rend l'affectation lisible — une enceinte
   * de vingt segments demande des bras, pas de la patience.
   *
   * @param batisseurs ceux qui sont a pied d'oeuvre, positions comprises
   * @param actif faux quand la scene est en pause : rien n'avance pendant
   *        qu'on amenage
   */
  avancerLesChantiers(
    batisseurs: readonly { x: number; y: number }[],
    delta: number,
    actif = true,
  ): void {
    if (!actif || batisseurs.length === 0) return;

    const pris = new Set<Construction>();
    for (const batisseur of batisseurs) {
      const chantier = this.chantierLePlusProche(batisseur.x, batisseur.y);
      if (!chantier || pris.has(chantier)) continue;
      const loin =
        Phaser.Math.Distance.Between(batisseur.x, batisseur.y, chantier.x, chantier.y) >
        PORTEE_BATISSEUR;
      if (loin) continue;

      pris.add(chantier);
      chantier.travailRestant -= delta;
      if (chantier.travailRestant > 0) continue;

      chantier.travailRestant = 0;
      chantier.pv = chantier.pvMax;
      chantier.habiller();
      this.surgir(chantier);
    }
  }

  /** Repousse les battants du temps passe en pause, comme tout le reste. */
  decaler(millisecondes: number): void {
    for (const c of this.liste) {
      // ⚠️ Un chantier ne se decale plus : il ne compte plus le temps qui
      // passe, mais le travail fait. Une pause ne lui enleve rien.
      c.battant?.decaler(millisecondes);
      if (c.derniereDemande > -Infinity) c.derniereDemande += millisecondes;
    }
  }

  // ------------------------------------------------------------ les portes

  /**
   * La consigne « fermees » (§4.20) : la cloche, une fois que plus personne
   * n'est dehors. Chaque battant se ferme en deux secondes ; ensuite, la nuit,
   * il ne s'ouvre plus que sur demande et sans monstre a portee.
   *
   * @param immediat vrai pour poser l'etat sans le jouer — la reprise d'une
   *        partie (§4.28).
   */
  fermerLesPortes(maintenant: number, immediat = false): void {
    this.reglerLesPortes(true, maintenant, immediat);
  }

  /** L'aube les rouvre : on ressort travailler. */
  ouvrirLesPortes(maintenant: number, immediat = false): void {
    this.reglerLesPortes(false, maintenant, immediat);
  }

  private reglerLesPortes(fermees: boolean, maintenant: number, immediat: boolean): void {
    this.grille.portesFermees = fermees;
    this.version += 1;
    for (const c of this.liste) {
      if (!c.battant) continue;
      if (immediat) {
        c.battant.phase = fermees ? "fermee" : "ouverte";
      } else if (fermees) {
        c.battant.fermer(maintenant);
      } else {
        c.battant.ouvrir(maintenant);
      }
      c.derniereDemande = -Infinity;
    }
    // Un tablier qui se leve ne porte deja plus personne.
    this.majPonts();
    this.majPortes(maintenant, [], () => false);
  }

  /**
   * Les portes vivent, une fois par image : les battants avancent, et sous
   * la consigne fermee, chaque porte regarde qui la demande et qui la menace
   * (`consigneDeNuit`). La consigne se juge par battement de 120 ms (§4.17
   * regle 5) ; le mouvement des battants et leur dessin, a chaque image.
   *
   * @param demandeurs les notres, dehors : habitants et heros vivants
   * @param menaceA dit si un monstre est a cette distance de ce point
   * @returns les portes qui viennent de finir de s'ouvrir ou de se fermer
   */
  majPortes(
    maintenant: number,
    demandeurs: ReadonlyArray<{ x: number; y: number }>,
    menaceA: (x: number, y: number, rayon: number) => boolean,
  ): Construction[] {
    const finies: Construction[] = [];
    const juger = maintenant - this.dernierBattement >= 120;
    if (juger) this.dernierBattement = maintenant;
    let pontsATrier = false;

    for (const porte of this.liste) {
      const battant = porte.battant;
      if (!battant) continue;

      if (battant.avancer(maintenant)) {
        finies.push(porte);
        if (porte.pontLevis) pontsATrier = true;
      }

      if (juger && this.grille.portesFermees) {
        const r = REGLAGES_PORTE;
        const quelquUn = demandeurs.some((d) => aPortee(d.x, d.y, porte.x, porte.y, r.demande));
        const menace = menaceA(porte.x, porte.y, r.menace);
        if (quelquUn && !menace) porte.derniereDemande = maintenant;
        const action = consigneDeNuit(battant, maintenant, quelquUn, menace, porte.derniereDemande);
        if (action === "ouvrir") battant.ouvrir(maintenant);
        else if (action === "fermer") {
          battant.fermer(maintenant);
          if (porte.pontLevis) pontsATrier = true;
        }
      }

      const position = battant.position(maintenant);
      if (position !== porte.position) {
        porte.position = position;
        porte.habiller();
      }
    }
    if (pontsATrier) this.majPonts();
    return finies;
  }

  /** La porte la plus proche de ce point, quelle que soit sa distance. */
  porteLaPlusProche(x: number, y: number): Construction | null {
    let trouvee: Construction | null = null;
    let meilleure = Infinity;
    for (const c of this.liste) {
      if (!c.battant) continue;
      const d = Phaser.Math.Distance.Between(x, y, c.x, c.y);
      if (d < meilleure) {
        meilleure = d;
        trouvee = c;
      }
    }
    return trouvee;
  }

  /**
   * Un monstre qui marche vers `angle` va-t-il buter sur une douve en eau ?
   * Si oui, l'angle a prendre a la place : vers la porte la plus proche, et
   * le long du fosse si la porte est de l'autre cote. Pas de calcul de
   * chemin : un regard une case devant, et c'est tout (§4.17).
   *
   * @returns l'angle corrige, ou null s'il n'y a rien devant
   */
  contournement(x: number, y: number, angle: number): number | null {
    const bloque = (a: number) => {
      const c = this.en(x + Math.cos(a) * CASE * 0.75, y + Math.sin(a) * CASE * 0.75);
      return c !== null && c.def.id === "douve" && c.eau && !c.pont;
    };
    if (!bloque(angle)) return null;
    const porte = this.porteLaPlusProche(x, y);
    if (porte) {
      const versPorte = Phaser.Math.Angle.Between(x, y, porte.x, porte.y);
      if (!bloque(versPorte)) return versPorte;
      // La porte est de l'autre cote du fosse : on le longe, du cote de la porte.
      const gauche = angle - Math.PI / 2;
      const droite = angle + Math.PI / 2;
      const ecart = (a: number) => Math.abs(Phaser.Math.Angle.Wrap(a - versPorte));
      const premiere = ecart(gauche) < ecart(droite) ? gauche : droite;
      if (!bloque(premiere)) return premiere;
      const seconde = premiere === gauche ? droite : gauche;
      if (!bloque(seconde)) return seconde;
    }
    return angle + Math.PI;
  }

  /**
   * Elle encaisse.
   *
   * @returns vrai si elle vient de tomber
   */
  blesser(construction: Construction, degats: number, maintenant: number): boolean {
    if (construction.def.indestructible) return false;
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
    this.ecrire(construction.x, construction.y, "ruine");

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
    const cle = this.cleDe(construction.x, construction.y);
    if (this.parCase.get(cle) === construction) this.parCase.delete(cle);
    const { x, y } = construction;
    const pontLevis = construction.pontLevis;
    construction.destroy();
    // Les voisines perdent un raccord : elles se redessinent.
    this.rehabillerAutour(x, y);
    if (pontLevis) this.majPonts();
  }

  /**
   * Le joueur la demolit lui-meme, en mode amenagement (§4.24).
   *
   * Deux differences avec `detruire`, et elles comptent toutes les deux : ca
   * **rend la moitie** de ce qui tient encore debout, et la case redevient
   * **libre** au lieu de garder une ruine — on a demonte, on n'a pas perdu.
   * Une douve se **comble** : on rend les etais, et la vanne si elle etait en
   * eau.
   *
   * @returns ce qui a ete rendu
   */
  demolir(construction: Construction, stocks: Stocks): Partial<Record<Ressource, number>> {
    const rendu = remboursementDemolition(construction.def, construction.pv, construction.matiere);
    if (construction.eau) {
      for (const [ressource, montant] of Object.entries(REMPLISSAGE.cout)) {
        rendu[ressource as Ressource] = (rendu[ressource as Ressource] ?? 0) + Math.floor((montant ?? 0) / 2);
      }
    }
    crediter(rendu, stocks);

    construction.occupant = null;
    this.grille.liberer(construction.x, construction.y);
    this.version += 1;
    this.retirer(construction);
    // Une douve en eau comblee rouvre un passage : le parcours change.
    if (construction.eau) this.surChangementDePassage?.();
    return rendu;
  }

  /**
   * Elle change de place, gratuitement et instantanement (§4.24).
   *
   * Ce qui se paie, c'est de **construire** ; une fois paye, la disposition
   * appartient au joueur. On ne repose donc pas un objet neuf — on deplace
   * celui-la, **avec ses points de vie**, sinon deplacer reparerait. Une douve
   * ne se deplace pas : un trou, ca se comble.
   *
   * @returns vrai si le deplacement a eu lieu
   */
  deplacer(construction: Construction, x: number, y: number): boolean {
    if (construction.def.id === "douve") return false;
    const c = this.grille.caseEn(x, y);
    if (!c) return false;
    // On se juge sur la case d'arrivee comme si on batissait, mais sans le prix :
    // meme terrain, meme regle des trois cases, meme refus des cases prises.
    if (!this.grille.constructible(x, y, true)) return false;
    if (this.grille.aProximite(x, y, CASES_LIBRES_AUTOUR_DES_BATIMENTS, IMPOSENT_UNE_DISTANCE)) {
      return false;
    }

    const depart = { x: construction.x, y: construction.y };
    const centre = this.grille.centreDe(x, y);
    // Et meme regle de l'enceinte : le mur libere sa case, puis on juge la
    // case d'arrivee — s'il refermerait tout sans porte, il reste ou il est.
    if (construction.def.id !== "porte") {
      this.grille.liberer(depart.x, depart.y);
      this.version += 1;
      const enferme = this.enfermerait(centre.x, centre.y);
      this.grille.poser(depart.x, depart.y, occupationDe(construction.def.id));
      this.version += 1;
      if (enferme) return false;
    }

    // Une secousse en cours ramenerait l'objet a son ancienne place.
    this.scene.tweens.killTweensOf(construction);

    this.grille.liberer(depart.x, depart.y);
    this.parCase.delete(this.cleDe(depart.x, depart.y));
    this.ecrire(centre.x, centre.y, occupationDe(construction.def.id));

    construction.setPosition(centre.x, centre.y);
    construction.caler();
    this.parCase.set(this.cleDe(centre.x, centre.y), construction);

    // L'occupant suit sa tour : le laisser dans le vide en ferait une cible
    // isolee sans que le joueur l'ait decide.
    construction.occupant?.setPosition(centre.x, centre.y);
    // L'ancien voisinage perd un raccord, le nouveau en gagne un.
    this.rehabillerAutour(depart.x, depart.y);
    this.rehabillerAutour(centre.x, centre.y);
    if (construction.pontLevis) this.majPonts();
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
