import Phaser from "phaser";
import { CASE, Grille, type Occupation } from "../core/grille";
import type { Stocks } from "../core/habitants";
import type { MaisonPlan } from "../core/village";
import { cleMaison, CLE_FERME, CLE_MAISON_RUINE, EMPRISE_MAISON, VARIANTES_MAISON } from "./dessin/batiments";
import { melanger } from "./dessin/palette";

/**
 * Les maisons du village (DESIGN.md §4.24).
 *
 * Jusqu'au 19 septembre 2026, elles etaient du decor pur : neuf images posees
 * une fois, sans corps ni points de vie. Depuis, **tout ce qui est bati se
 * casse, sauf l'eglise** — et c'est le joueur qui modele son village : il
 * batit, demolit, deplace et releve ses maisons dans le mode d'amenagement.
 *
 * Une maison a deux etats. **Debout**, elle prend ses quatre cases et arrete
 * les corps. **En ruine** (`decombres`), elle ne bloque plus rien, on ne peut
 * rien y batir d'autre qu'une maison, et on la releve au plein prix — ou on la
 * demolit, ce qui rend la place.
 *
 * Le village demarre avec trois maisons debout et le reste en ruines : c'est le
 * plan de la graine qui le dit (`core/village.ts`), ce fichier ne fait que
 * poser.
 *
 * Meme forme que `Champs` et `Constructions` : ce parc tient la grille a jour,
 * et la scene ne parle jamais aux cases directement.
 */

export const REGLAGES_MAISONS = {
  /** Ce que coute une maison a batir, et a relever */
  coutBois: 20,
  pvMax: 200,
};

/** Ce qu'on enregistre d'une maison (§4.28). */
export interface EtatMaisonSauve {
  colonne: number;
  ligne: number;
  variante: number;
  ferme: boolean;
  pv: number;
  debout: boolean;
}

const COTES = EMPRISE_MAISON / CASE;

export class Maison extends Phaser.Physics.Arcade.Image {
  colonne: number;
  ligne: number;
  /** L'index de dessin, dans [0, VARIANTES_MAISON) */
  readonly variante: number;
  readonly ferme: boolean;
  pv = REGLAGES_MAISONS.pvMax;
  debout = true;
  /** Eclair blanc quand elle encaisse, gere sans minuterie (§4.17) */
  flashJusqua = 0;
  /**
   * Ce que le feu lui a pris, de 0 (intacte) a 1 (charbon) — §4.21.
   *
   * ⚠️ **Elle ne compte que les degats du feu**, pas ceux des monstres : une
   * maison enfoncee a coups de masse n'est pas noire. Et elle ne redescend
   * jamais — une maison qui a brule garde ses marques une fois le feu eteint,
   * et sa ruine aussi.
   */
  brulee = 0;
  /** Jusqu'a quand elle tremble d'un coup ; un coup par secousse, pas plus. */
  secoueeJusqua = 0;

  constructor(scene: Phaser.Scene, colonne: number, ligne: number, variante: number, ferme: boolean) {
    super(scene, colonne * CASE, ligne * CASE, ferme ? CLE_FERME : cleMaison(variante));
    this.colonne = colonne;
    this.ligne = ligne;
    this.variante = variante;
    this.ferme = ferme;
    // ⚠️ **Le coin haut-gauche de l'emprise**, et le bati n'en remplit qu'un
    // coin : le reste est le jardin, et c'est lui qui fait que deux voisines ne
    // se collent jamais (§4.30).
    this.setOrigin(0);
    scene.add.existing(this);
    scene.physics.add.existing(this, true);
    this.habiller();
  }

  get nom(): string {
    return this.ferme ? "Ferme" : "Maison";
  }

  /** Le milieu de l'emprise : c'est la que visent les monstres et que tombent les coups. */
  get centre(): { x: number; y: number } {
    return { x: this.x + EMPRISE_MAISON / 2, y: this.y + EMPRISE_MAISON / 2 };
  }

  get ratioPv(): number {
    return this.pv / REGLAGES_MAISONS.pvMax;
  }

  /** Texture, profondeur et corps suivent l'etat. */
  habiller(): void {
    this.setTexture(this.debout ? (this.ferme ? CLE_FERME : cleMaison(this.variante)) : CLE_MAISON_RUINE);
    this.setOrigin(0);
    // La profondeur suit le **pied** du batiment, lu sur l'image : le sprite
    // rendu par Blender (50 px, on voit son emprise) n'a pas la taille du
    // dessin au code (40 px).
    this.setDepth(this.y + this.height);
    this.caler();
  }

  /** Le corps physique : l'emprise entiere, debout seulement. */
  caler(): void {
    const corps = this.body as Phaser.Physics.Arcade.StaticBody;
    corps.setSize(EMPRISE_MAISON, EMPRISE_MAISON);
    corps.position.set(this.x, this.y);
    corps.updateCenter();
    // Une ruine ne bloque plus personne : on marche dans les decombres.
    corps.enable = this.debout;
  }
}

/**
 * Ce qu'un Pyromane coute a une maison, en part de ses points de vie.
 *
 * *Chiffre tranche par le code.* Un quart : quatre nuits de suite pour la
 * mettre a terre, donc le temps de s'en apercevoir et de faire quelque
 * chose de celui qui a craque.
 */
const PART_ABIMEE = 0.25;

/**
 * Ce que le feu fait a la couleur d'un batiment (§4.21).
 *
 * `setTint` **multiplie** : blanc ne change rien, et plus la teinte est sombre
 * plus le batiment noircit. On ne va pas jusqu'au charbon pur — a 1, la maison
 * devient une silhouette noire et on ne lit plus ni son toit ni ses
 * colombages. Aux trois quarts, elle est manifestement brulee et reste lisible.
 *
 * ⚠️ **Ce n'est pas un effet, c'est une information** : quarante secondes
 * separent le depart de feu de la ruine, et sans ca rien dans le batiment lui-
 * meme ne dit ou on en est. La flamme dit « ca brule », le noircissement dit
 * « depuis combien de temps ».
 */
const CHARBON = 0x4a423c;
const PART_NOIRCIE = 0.75;

export class Maisons {
  readonly groupe: Phaser.Physics.Arcade.StaticGroup;
  private readonly liste: Maison[] = [];
  /** La maison de chaque case prise, par `colonne,ligne` : quatre entrees par maison. */
  private readonly parCase = new Map<string, Maison>();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly grille: Grille,
  ) {
    this.groupe = scene.physics.add.staticGroup();
  }

  get toutes(): Maison[] {
    return this.liste;
  }

  get debout(): Maison[] {
    return this.liste.filter((m) => m.debout);
  }

  /** Ce qu'il y a sur la case de ce point, s'il y a une maison. */
  en(x: number, y: number): Maison | null {
    return this.parCase.get(`${this.grille.colonneDe(x)},${this.grille.ligneDe(y)}`) ?? null;
  }

  /** La maison debout la plus proche de ce point : c'est ce qu'un pillard vise. */
  laPlusProcheDebout(x: number, y: number): Maison | null {
    let trouvee: Maison | null = null;
    let meilleure = Number.POSITIVE_INFINITY;
    for (const m of this.liste) {
      if (!m.debout) continue;
      const c = m.centre;
      const d = Phaser.Math.Distance.Between(x, y, c.x, c.y);
      if (d < meilleure) {
        meilleure = d;
        trouvee = m;
      }
    }
    return trouvee;
  }

  // ------------------------------------------------------------------ poser

  /** Les maisons du plan, au demarrage : debout ou en ruine selon la graine. */
  poserLePlan(plan: MaisonPlan[]): void {
    for (const m of plan) {
      const maison = new Maison(this.scene, m.colonne, m.ligne, Math.floor(m.variante * VARIANTES_MAISON), m.ferme);
      if (!m.debout) {
        maison.debout = false;
        maison.pv = 0;
        maison.habiller();
      }
      this.inscrire(maison);
    }
  }

  /** Les maisons d'une partie reprise, a la place de celles du plan (§4.28). */
  reprendre(etats: EtatMaisonSauve[]): void {
    for (const etat of etats) {
      const maison = new Maison(this.scene, etat.colonne, etat.ligne, etat.variante, etat.ferme);
      maison.debout = etat.debout;
      maison.pv = etat.debout ? Math.max(1, Math.min(etat.pv, REGLAGES_MAISONS.pvMax)) : 0;
      maison.habiller();
      this.inscrire(maison);
    }
  }

  private cases(colonne: number, ligne: number): string[] {
    const cles: string[] = [];
    for (let dl = 0; dl < COTES; dl++) {
      for (let dc = 0; dc < COTES; dc++) cles.push(`${colonne + dc},${ligne + dl}`);
    }
    return cles;
  }

  private occuper(maison: Maison, occupation: Occupation): void {
    for (let dl = 0; dl < COTES; dl++) {
      for (let dc = 0; dc < COTES; dc++) {
        const centre = Grille.centreCase(maison.colonne + dc, maison.ligne + dl);
        this.grille.poser(centre.x, centre.y, occupation);
      }
    }
  }

  private inscrire(maison: Maison): void {
    this.groupe.add(maison);
    this.liste.push(maison);
    for (const cle of this.cases(maison.colonne, maison.ligne)) this.parCase.set(cle, maison);
    this.occuper(maison, maison.debout ? "maison" : "decombres");
  }

  private retirer(maison: Maison): void {
    for (const cle of this.cases(maison.colonne, maison.ligne)) this.parCase.delete(cle);
    this.occuper(maison, "libre");
    const index = this.liste.indexOf(maison);
    if (index >= 0) this.liste.splice(index, 1);
    this.groupe.remove(maison, true, true);
  }

  // ------------------------------------------------------------------ batir

  /**
   * Pourquoi on ne peut pas batir une maison ici — ou `null` si on peut.
   *
   * Le coin haut-gauche de l'emprise est la case visee. Sur une ruine, c'est
   * **la relever** : la ruine doit etre celle-la, entiere, et ca coute le plein
   * prix (§4.24). Ailleurs, il faut quatre cases qui portent et qui sont libres.
   * La raison est rendue, pas un booleen : le joueur lit ce qui cloche.
   */
  refus(x: number, y: number, stocks: Stocks): string | null {
    const ruine = this.en(x, y);
    if (ruine && !ruine.debout) {
      if (stocks.bois < REGLAGES_MAISONS.coutBois) return `Il manque de quoi : ${REGLAGES_MAISONS.coutBois} bois.`;
      return null;
    }
    const colonne = this.grille.colonneDe(x);
    const ligne = this.grille.ligneDe(y);
    const raison = this.refusDePlace(colonne, ligne, null);
    if (raison) return raison;
    if (stocks.bois < REGLAGES_MAISONS.coutBois) return `Il manque de quoi : ${REGLAGES_MAISONS.coutBois} bois.`;
    return null;
  }

  /** Les quatre cases d'une emprise sont-elles a prendre ? `sauf` : celle qu'on deplace. */
  private refusDePlace(colonne: number, ligne: number, sauf: Maison | null): string | null {
    for (let dl = 0; dl < COTES; dl++) {
      for (let dc = 0; dc < COTES; dc++) {
        const c = this.grille.case(colonne + dc, ligne + dl);
        if (!c) return "Hors de la carte.";
        const centre = Grille.centreCase(c.colonne, c.ligne);
        if (sauf && this.parCase.get(`${c.colonne},${c.ligne}`) === sauf) continue;
        if (c.occupation === "batiment") return "Il y a deja un batiment ici.";
        if (c.occupation === "maison" || c.occupation === "decombres") return "Il y a deja une maison ici.";
        if (!this.grille.constructible(centre.x, centre.y)) return "Le sol ne porte pas.";
      }
    }
    return null;
  }

  possible(x: number, y: number, stocks: Stocks): boolean {
    return this.refus(x, y, stocks) === null;
  }

  /**
   * Batir une maison neuve, ou relever une ruine (§4.24).
   *
   * @returns la maison, ou null si c'etait impossible
   */
  batir(x: number, y: number, stocks: Stocks): Maison | null {
    if (!this.possible(x, y, stocks)) return null;
    stocks.bois -= REGLAGES_MAISONS.coutBois;

    const ruine = this.en(x, y);
    if (ruine && !ruine.debout) {
      ruine.debout = true;
      ruine.pv = REGLAGES_MAISONS.pvMax;
      ruine.habiller();
      this.occuper(ruine, "maison");
      this.surgir(ruine);
      return ruine;
    }

    const maison = new Maison(this.scene, this.grille.colonneDe(x), this.grille.ligneDe(y), Math.floor(Math.random() * VARIANTES_MAISON), false);
    this.inscrire(maison);
    this.surgir(maison);
    return maison;
  }

  /**
   * Le joueur la demolit, en mode amenagement (§4.24) : la moitie de ce qui
   * tient encore debout est rendue, une ruine ne rend rien, et les cases
   * redeviennent libres — on a demonte, on n'a pas perdu.
   *
   * @returns le bois rendu
   */
  demolir(maison: Maison, stocks: Stocks): number {
    const rendu = maison.debout ? Math.floor((REGLAGES_MAISONS.coutBois * maison.ratioPv) / 2) : 0;
    stocks.bois += rendu;
    this.retirer(maison);
    return rendu;
  }

  /** Peut-elle aller la ? Meme regles qu'a la pose, sans le prix. */
  peutAller(maison: Maison, x: number, y: number): boolean {
    return this.refusDePlace(this.grille.colonneDe(x), this.grille.ligneDe(y), maison) === null;
  }

  /**
   * Elle change de place, gratuitement, **avec ses points de vie** (§4.24) :
   * deplacer ne repare pas. Une ruine se deplace aussi — c'est de la place
   * qu'on range.
   */
  deplacer(maison: Maison, x: number, y: number): boolean {
    if (!this.peutAller(maison, x, y)) return false;
    this.scene.tweens.killTweensOf(maison);

    for (const cle of this.cases(maison.colonne, maison.ligne)) this.parCase.delete(cle);
    this.occuper(maison, "libre");

    maison.colonne = this.grille.colonneDe(x);
    maison.ligne = this.grille.ligneDe(y);
    maison.setPosition(maison.colonne * CASE, maison.ligne * CASE);
    maison.habiller();

    for (const cle of this.cases(maison.colonne, maison.ligne)) this.parCase.set(cle, maison);
    this.occuper(maison, maison.debout ? "maison" : "decombres");
    this.surgir(maison);
    return true;
  }

  // ----------------------------------------------------------------- casser

  /**
   * Elle encaisse.
   *
   * @returns vrai si elle vient de tomber
   */
  blesser(maison: Maison, degats: number, maintenant: number): boolean {
    if (!maison.debout) return false;
    maison.pv -= degats;
    maison.flashJusqua = maintenant + 90;
    this.secouer(maison, maintenant);
    if (maison.pv > 0) return false;
    this.tomber(maison);
    return true;
  }

  /**
   * Un Pyromane s'en prend a ce qui tient encore (DESIGN.md §4.27).
   *
   * ⚠️ **Le feu est au jalon 6** (§4.21). En attendant il abime, il ne
   * brule pas : la maison la plus proche encaisse un quart de ses points
   * de vie. Le jour ou l'incendie existera, c'est cette fonction qui
   * l'allumera, et rien d'autre ne changera.
   *
   * @returns la maison touchee, ou `null` s'il n'y en avait aucune debout
   */
  abimerLaPlusProche(x: number, y: number): Maison | null {
    const maison = this.laPlusProcheDebout(x, y);
    if (!maison) return null;
    this.blesser(maison, PART_ABIMEE * REGLAGES_MAISONS.pvMax, this.scene.time.now);
    return maison;
  }

  /**
   * La crue acheve ce qui etait deja atteint (§4.21).
   *
   * ⚠️ **Seulement ce qui est deja abime.** Une maison intacte tient la pluie —
   * c'est une maison, pas un chateau de sable. Ce que la crue punit, c'est de
   * **ne pas avoir repare** : on l'a vue venir deux journees.
   *
   * @param seuil la part de vie sous laquelle une maison souffre
   * @param part la part des points de vie max qu'elle perd a chaque passage
   * @returns les maisons qui sont tombees a ce passage
   */
  ronger(seuil: number, part: number, maintenant: number): Maison[] {
    const tombees: Maison[] = [];
    for (const maison of this.liste) {
      if (!maison.debout) continue;
      if (maison.pv > seuil * REGLAGES_MAISONS.pvMax) continue;
      if (this.blesser(maison, part * REGLAGES_MAISONS.pvMax, maintenant)) tombees.push(maison);
    }
    return tombees;
  }

  /** Elle tombe : une ruine, qu'on releve ou qu'on demolit. */
  tomber(maison: Maison): void {
    maison.debout = false;
    maison.pv = 0;
    this.scene.tweens.killTweensOf(maison);
    maison.habiller();
    this.occuper(maison, "decombres");
  }

  /** Une secousse a la fois, comme les murs : l'horodatage tient la cadence. */
  private secouer(maison: Maison, maintenant: number): void {
    if (maintenant < maison.secoueeJusqua) return;
    maison.secoueeJusqua = maintenant + 160;
    const x = maison.colonne * CASE;
    this.scene.tweens.add({
      targets: maison,
      x: x + 2,
      duration: 40,
      yoyo: true,
      repeat: 1,
      onComplete: () => maison.setX(x),
    });
  }

  /** Elle surgit : un rebond d'echelle, le geste de Clash of Clans a la pose. */
  private surgir(maison: Maison): void {
    maison.setScale(0.55);
    this.scene.tweens.add({ targets: maison, scaleX: 1, scaleY: 1, duration: 280, ease: "Back.easeOut" });
  }

  /** L'eclair d'encaissement, une fois par image, sans minuterie (§4.17). */
  teinter(maintenant: number): void {
    for (const m of this.liste) {
      if (maintenant < m.flashJusqua) m.setTintFill(0xffffff);
      else if (m.brulee > 0) m.setTint(melanger(0xffffff, CHARBON, Math.min(1, m.brulee) * PART_NOIRCIE));
      else m.clearTint();
    }
  }
}
