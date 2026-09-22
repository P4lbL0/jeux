import Phaser from "phaser";
import type { Maison } from "./maisons";
import type { ClasseDef, EtatHero } from "../core/classes";
import { SEUIL_CRITIQUE, donneUnChoix, xpPourNiveauSuivant } from "../core/classes";
import {
  bonusVierge,
  competenceParId,
  TRANCHE_KILLS,
  type Bonus,
  type CompetenceDef,
  type CompetencesPossedees,
  type EffetCapacite,
  type EvolutionDef,
  EMPLACEMENTS_ACTIFS,
  activesPossedees,
} from "../core/competences";
import type { Ordre, Point } from "../core/ordres";
import type { Metier } from "../core/habitants";
import { creerPersonne, prenomLibre, type Personne } from "../core/personne";
import { Rng } from "../core/rng";
import { nouvellePose } from "./poses";
import { ARCHETYPE_DEFAUT, type Archetype } from "./ennemis";
import { familleDeMonstre } from "./dessin/monstres";
import { familleDeHero } from "./dessin/heros";
import { assurerHero, plancheDe } from "./dessin/monde";

/**
 * Cale le corps physique au centre de la texture, quelle qu'en soit la taille.
 *
 * Les placeholders faisaient 12x18 et 12x16 ; les vrais sprites de
 * `src/assets/` en font 32. Sans ce calcul, un `setOffset` ecrit en dur pour
 * une frame de 12 px placerait le corps dans le coin haut-gauche d'une frame de
 * 32 px : le heros encaisserait des coups a cote de lui.
 *
 * La **hitbox ne change pas d'un pixel** — ni sa taille, ni sa position par
 * rapport au centre du sprite. C'est exactement ce que faisaient les valeurs
 * ecrites en dur : corps centre horizontalement, et son bord haut 4 px au-dessus
 * du centre. Seule la taille de la texture bouge, donc seul l'offset suit.
 */
export function calerCorps(
  objet: Phaser.Physics.Arcade.Sprite,
  largeur: number,
  hauteur: number,
): void {
  const corps = objet.body as Phaser.Physics.Arcade.Body | null;
  if (!corps) return;

  // Un corps Arcade est exprime en pixels de la texture source, puis multiplie
  // par l'echelle du sprite. On divise donc par l'echelle pour que `largeur` et
  // `hauteur` restent des **pixels du monde** : afficher un personnage plus
  // petit ne doit pas retrecir sa hitbox.
  const echelle = objet.scaleX || 1;
  const source = { largeur: largeur / echelle, hauteur: hauteur / echelle };

  corps.setSize(source.largeur, source.hauteur);
  corps.setOffset(
    (objet.width - source.largeur) / 2,
    objet.height / 2 - HAUT_DU_CORPS / echelle,
  );
}

/** De combien le corps physique deborde au-dessus du centre du sprite. */
const HAUT_DU_CORPS = 4;

/**
 * Echelle d'affichage des personnages et des monstres : **un**.
 *
 * ⚠️ Elle valait 0,75 du temps des PNG. Sur du pixel-art dessine par le code,
 * une echelle fractionnaire produit des pixels de tailles inegales — un pixel
 * sur quatre disparait — et c'est exactement ce qui rendait les personnages
 * flous sur les captures. Le corps de `corps.ts` est dessine pour tenir dans
 * ses 32 px a l'echelle 1 ; ce qui doit etre plus gros (une brute, un golem)
 * est **cuit plus gros**, jamais agrandi.
 *
 * **Aucun effet sur le jeu** : `calerCorps` divise par cette echelle, donc les
 * hitbox gardent exactement la taille qu'elles avaient.
 */
export const ECHELLE_PERSONNAGE = 1;

/** Le familier golem est une fois et demie plus gros que les autres. */
const GROSSEUR_GOLEM = 1.5;

/**
 * Le palier d'equipement des heros du jalon 5 (§4.30).
 *
 * Les paliers suivent les **rangs**, et les rangs arrivent au jalon 8 avec le
 * recrutement : tout le monde est donc au palier 0, la tenue nue et l'arme de
 * la classe. Une seule constante a changer le jour ou un heros a un rang.
 */
export const PALIER_DE_DEPART = 0;

/**
 * Oriente un sprite a gauche ou a droite, avec une **zone morte**.
 *
 * C'est la correction du « bourdonnement ». L'ancien code faisait
 * `setFlipX(direction.x < 0)` a chaque image : des qu'un personnage se deplace
 * presque a la verticale — ce qui arrive tout le temps, l'IA contournant sa
 * cible (`ia.ts`, etape 7) — la composante horizontale oscille autour de zero et
 * le sprite se retournait plusieurs dizaines de fois par seconde.
 *
 * En deca du seuil, on **garde l'orientation precedente** : `flipX` sert
 * lui-meme de memoire, il n'y a donc rien a stocker.
 *
 * @param ecart composante horizontale du deplacement ou de la visee
 * @param seuil en deca duquel on ne se retourne pas ; meme unite que `ecart`
 */
export function orienter(
  sprite: Phaser.GameObjects.Sprite,
  ecart: number,
  seuil: number,
): void {
  if (ecart > seuil) sprite.setFlipX(false);
  else if (ecart < -seuil) sprite.setFlipX(true);
}

/** Zone morte pour une direction normalisee : environ 20° de part et d'autre. */
export const SEUIL_REGARD = 0.35;

/** Zone morte quand on oriente d'apres deux positions, en pixels. */
export const SEUIL_REGARD_PIXELS = 10;

/** Ce qui porte une teinte de fond et un eclair d'encaissement date. */
interface Teintable extends Phaser.GameObjects.Sprite {
  /** Instant de fin de l'eclair blanc ; voir `effets.flashCible` */
  flashJusqua: number;
  /** Teinte permanente (evolution, archetype, mort) ; null = aucune */
  teinte: number | null;
}

/**
 * Repose la teinte d'un combattant, une fois par image.
 *
 * L'eclair d'encaissement l'emporte tant qu'il dure, puis la teinte de fond
 * reprend la main. Sans ce rappel, un `clearTint()` apres un coup effacerait
 * pour toujours la couleur d'un archetype ou d'une evolution.
 */
export function rafraichirTeinte(objet: Teintable, maintenant: number): void {
  if (maintenant < objet.flashJusqua) {
    objet.setTintFill(0xffffff);
    return;
  }
  if (objet.teinte === null) objet.clearTint();
  else objet.setTint(objet.teinte);
}

/** Une capacite utilisable : l'ultime de classe, ou une competence active. */
export interface Capacite {
  id: string;
  nom: string;
  description: string;
  /** Rechargement en millisecondes, bonus compris */
  rechargement: number;
  effet: EffetCapacite;
  /** Vrai si elle part toute seule des qu'elle est prete */
  automatique: boolean;
  icone: string;
}

/**
 * Le heros incarne par le joueur, ou joue par l'IA.
 *
 * Les statistiques sont toujours lues via les getters "effectifs" : valeur de
 * base de la classe, plus les bonus des competences, plus les croissances liees
 * aux kills, le tout multiplie par le multiplicateur global. Rien ne modifie
 * jamais directement les donnees de la classe.
 */
/**
 * On pourra recruter plusieurs heros d'une meme classe (DESIGN.md §4.1) : leur
 * identite ne peut donc pas etre leur classe. Ce compteur la leur donne.
 */
let prochainIdentifiant = 1;

export class Hero extends Phaser.Physics.Arcade.Sprite {
  /** Identifiant stable, pour les affinites de groupe (DESIGN.md §4.16) */
  readonly identifiant = `h${prochainIdentifiant++}`;
  readonly classe: ClasseDef;
  readonly bonus: Bonus = bonusVierge();
  /** Palier atteint pour chaque competence, par identifiant */
  readonly competences: CompetencesPossedees = {};
  /** Evolution choisie pour une competence, par identifiant de competence */
  readonly evolutions: Record<string, EvolutionDef> = {};
  /** Les emplacements d'actives : quatre, puis ceux qu'on achete (§4.13). */
  emplacements = EMPLACEMENTS_ACTIFS;

  pv: number;
  niveau = 1;
  xp = 0;
  kills = 0;
  etat: EtatHero = "combat";
  estIncarne = false;
  /** Choix de competence gagnes mais pas encore faits (DESIGN.md §4.3) */
  choixEnAttente = 0;
  regard = new Phaser.Math.Vector2(1, 0);
  /**
   * La direction de l'IA, lissee d'une image a l'autre.
   *
   * `piloter()` renvoie une direction franche, recalculee de zero a chaque
   * image : quand la cible la plus proche change au milieu d'une nuee, elle peut
   * s'inverser d'un coup. Lisser ce vecteur donne un deplacement qui se lit
   * comme une intention plutot que comme une hesitation.
   */
  directionLissee = new Phaser.Math.Vector2(0, 0);
  /** Balancement de marche et poses d'attaque (voir `poses.ts`) */
  pose = nouvellePose();
  /** Eclair blanc au moment d'encaisser, gere sans minuterie */
  flashJusqua = 0;
  /** Teinte permanente : celle d'une evolution, puis celle de la mort */
  teinte: number | null = null;
  /** Instant de fin du recul : jusque-la, son deplacement laisse la main */
  reculJusqua = 0;

  /** L'ordre en cours du joueur (DESIGN.md §4.4) */
  ordre: Ordre = { posture: "temporiser", ancre: null };
  /** Sa place dans la formation, recalculee a chaque image ; null = formation libre */
  poste: Point | null = null;
  /** Allie qu'il protege : son ancre le suit partout */
  protege: Hero | null = null;
  /**
   * Le poste auquel le joueur l'a affecte (DESIGN.md §4.4, bloc 8).
   *
   * Un heros au travail produit **beaucoup** plus vite qu'un habitant — la meme
   * cadence qu'a la main, ses degats divises par huit, par seconde. Mais
   * seulement le jour, et ca le fatigue : il arrive a la nuit avec du stress,
   * donc moins bon au combat. C'est ce qui empeche « tout le monde a la peche ».
   */
  travail: Metier | null = null;

  /** Points de vie maximum gagnes par la Provocation, cumules pour la partie */
  pvGagnesProvocation = 0;
  /** Resistance temporaire, recalculee chaque image par la scene */
  resistanceTemporaire = 0;
  /** Multiplicateur de vitesse temporaire (invisibilite, etc.) */
  multiplicateurVitesse = 1;
  /** Esquive offerte par le Presage de l'Oracle, recalculee chaque image */
  esquiveTemporaire = 0;
  /** Multiplicateur de cadence temporaire (Chant de guerre) */
  cadenceTemporaire = 1;
  /** Allies morts ou replies, pour "Le dernier debout" */
  alliesAbsents = 0;
  /** Vrai quand il se bat a portee de la cite, pour le Serment du protecteur */
  presCite = false;
  /**
   * Bonus d'equipe soudee, recalcule regulierement par la scene : de 0 a 0,10
   * (DESIGN.md §4.16). Il ne touche que les degats — une vie maximum qui derive
   * ferait bouger la jauge de vie toute seule.
   */
  bonusGroupe = 0;
  /** Le Serment de fer se declenche a chaque nouveau passage sous 50% de vie */
  private sermentArme = true;
  /** Cibles deja touchees, pour la Marque de sang */
  private dejaTouchees = new WeakSet<object>();

  private prochaineAttaque = 0;
  private prochaines: Record<string, number> = {};
  private invulnerableJusqua = 0;
  private invisibleJusqua = 0;
  private immobiliseJusqua = 0;
  /** Pendant l'Exil : insoignable, et le moindre contact est fatal */
  private condamneJusqua = 0;

  /** Prefixe de ses planches d'animation (voir `poses.ts`) */
  readonly familleSprite: string;

  /**
   * Ce qu'il a de commun avec un habitant : trois statistiques, des traits, des
   * sequelles, une jauge de stress et des etats (DESIGN.md §4.23).
   *
   * **Les deux populations partagent le meme systeme**, et c'est tout le point
   * du bloc 5. Les getters ci-dessous lisent `personne.mods`, qui est un
   * agregat deja calcule : porter trente traits ne coute pas une multiplication
   * de plus qu'en porter zero (§4.17).
   */
  readonly personne: Personne;

  /**
   * @param nomsPris les prenoms deja portes autour de lui.
   *
   * ⚠️ **Vu en jouant** : l'equipe de depart a sorti **deux Tancrede sur sept**.
   * C'est le meme bug que celui corrige a la porte au bloc 6a — et il compte
   * bien davantage depuis que la barre de heros affiche le **nom** et non plus
   * la classe (§4.10) : deux cartes identiques cote a cote, et « Tancrede est
   * tombe » qui ne dit plus lequel. Quand la liste est epuisee, on reprend au
   * hasard : un village de trente finira par avoir deux Colin, et c'est la vie.
   */
  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    classe: ClasseDef,
    rng?: Rng,
    nomsPris: readonly string[] = [],
    /**
     * La personne qu'il **etait deja** (DESIGN.md §4.18, bloc 9).
     *
     * ⚠️ C'est tout le sujet du bloc 9 : un heros sort d'un habitant, et il
     * garde son nom, ses traits gagnes en travaillant, son stress, ses
     * sequelles et son visage. Lui en fabriquer une neuve ferait exactement ce
     * que le §4.29 refuse — un heros qui tombe du ciel.
     */
    personne?: Personne,
  ) {
    // La planche est cuite a la demande, avant que le sprite ne la reclame : un
    // `Sprite` sur une texture inconnue affiche le damier de Phaser.
    const famille = familleDeHero(classe.id, PALIER_DE_DEPART);
    assurerHero(scene, classe.id, PALIER_DE_DEPART);
    super(scene, x, y, plancheDe(famille), 0);
    this.familleSprite = famille;
    this.classe = classe;
    this.pv = classe.pvMax;
    const graine = rng ?? new Rng(Date.now() + prochainIdentifiant);
    this.personne = personne ?? creerPersonne(prenomLibre(graine, nomsPris), graine);
    if (classe.id === "assassin") this.bonus.discretion = true;

    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setCollideWorldBounds(true);
    // L'echelle avant le calage : le corps se calcule a partir d'elle.
    this.setScale(ECHELLE_PERSONNAGE);
    calerCorps(this, 8, 10);
  }

  // ------------------------------------------------- statistiques effectives

  /** Nombre de tranches de kills franchies */
  get tranches(): number {
    return Math.floor(this.kills / TRANCHE_KILLS);
  }

  /**
   * Serment du protecteur : tout reussit tant qu'on se bat pres de la cite.
   * Il ne touche pas la vie maximum — sinon sortir du village ferait chuter la
   * jauge de vie du heros, ce qui serait illisible.
   */
  get bonusCite(): number {
    return 1 + (this.presCite ? this.bonus.sermentProtecteur : 0);
  }

  get pvMax(): number {
    const base =
      this.classe.pvMax +
      this.bonus.pvMax +
      (this.niveau - 1) * 6 +
      this.tranches * this.bonus.pvParTranche +
      this.pvGagnesProvocation;
    return Math.max(
      1,
      Math.round(
        base *
          this.bonus.multiplicateurGlobal *
          this.bonus.multiplicateurPv *
          // Un poumon perce coute 30 % de vie maximale, definitivement (§4.23).
          this.personne.mods.pvMax,
      ),
    );
  }

  get degats(): number {
    const base =
      (this.classe.degats + this.bonus.degats) * (1 + this.tranches * this.bonus.degatsParTranche);
    const contexte =
      this.bonusCite *
      (1 + this.alliesAbsents * this.bonus.dernierDebout) *
      (1 + this.bonusGroupe);
    // La Force et les traits entrent ici, et faiblement : un trait vaut 2 a 5 %,
    // jamais un doublement (§4.23).
    const lui = this.personne.mods.degats * (0.85 + this.personne.stats.force / 200) * this.elanDeRupture;
    return Math.max(
      1,
      Math.round(
        base * this.bonus.multiplicateurGlobal * this.bonus.multiplicateurDegats * contexte * lui,
      ),
    );
  }

  get vitesse(): number {
    return (
      (this.classe.vitesse + this.bonus.vitesse) *
      this.bonus.multiplicateurGlobal *
      this.multiplicateurVitesse *
      this.bonusCite *
      // Une jambe brisee coute 25 % de vitesse, un Vif en rend 8 %.
      this.personne.mods.vitesse *
      // L'eau : on s'y enfonce, on y avance mal (§4.30). 1 au sec.
      this.facteurEau
    );
  }

  /** Ce qu'il reste de la vitesse dans l'eau (§4.30) : 1 au sec, 0,6 sur le haut-fond, 0,35 en mer. */
  facteurEau = 1;

  /**
   * L'eau le cache jusque-la : une part de sa hauteur, rognee par le bas. Le
   * corps physique ne bouge pas (les hitbox ne bougent jamais) — seule l'image
   * s'enfonce. 0 : au sec, plus de rognage.
   */
  enfoncer(part: number): void {
    if (part <= 0) {
      if (this.isCropped) this.setCrop();
      return;
    }
    const largeur = this.frame.realWidth;
    const hauteur = this.frame.realHeight;
    this.setCrop(0, 0, largeur, Math.max(1, Math.round(hauteur * (1 - part))));
  }

  /**
   * Ce que sa rupture fait a sa puissance (DESIGN.md §4.23).
   *
   * La transcendance est **rare et forte** : c'est le seul cote lumineux de la
   * jauge, et il faut qu'il se voie. L'abattement, lui, ne met pas les degats a
   * zero — un heros qui ne fait plus rien du tout serait une mort deguisee, et
   * le §4.3 refuse qu'un heros meure autrement que par une decision du joueur.
   */
  private get elanDeRupture(): number {
    if (this.personne.rupture === "transcendance") return 1.5;
    if (this.personne.rupture === "abattement") return 0.5;
    return 1;
  }

  /** Premiere attaque sur une cible jamais touchee : la Marque de sang. */
  multiplicateurContre(cible: object): number {
    if (this.bonus.marqueDeSang <= 0) return 1;
    if (this.dejaTouchees.has(cible)) return 1;
    this.dejaTouchees.add(cible);
    return this.bonus.marqueDeSang;
  }

  /**
   * Rage du guerrier : chaque point de pourcentage de vie manquante accelere
   * l'attaque. Un guerrier a l'agonie est un guerrier terrifiant.
   */
  get cadence(): number {
    const manquant = (1 - Phaser.Math.Clamp(this.ratioPv, 0, 1)) * 100;
    return (
      (this.classe.cadence * this.bonus.cadence * this.cadenceTemporaire) /
      (1 + this.bonus.rageParPvManquant * manquant)
    );
  }

  /**
   * Ce que la hauteur d'une tour ajoute a sa portee (DESIGN.md §4.20).
   *
   * Zero au sol. Ce n'est pas une statistique du heros : c'est la position qui
   * la donne, et elle repart a zero des qu'il redescend.
   */
  porteeTour = 0;

  get portee(): number {
    return this.classe.portee + this.bonus.portee + this.porteeTour;
  }

  /** Plafonnee : une esquive de 100% rendrait le heros invincible. */
  get esquive(): number {
    return Math.min(
      0.6,
      this.classe.esquive + this.bonus.esquive + this.esquiveTemporaire + this.personne.mods.esquive,
    );
  }

  get critChance(): number {
    // Une main mutilee interdit le critique, et rien ne peut le lui rendre :
    // c'est une sequelle, pas un malus (§4.23).
    if (!this.personne.mods.peutCritiquer) return 0;
    const base = this.classe.trait === "critique" ? 0.25 : 0;
    return Math.min(0.85, base + this.bonus.critChance + this.personne.mods.critique);
  }

  get critMultiplicateur(): number {
    return this.bonus.critMultiplicateur;
  }

  get volDeVie(): number {
    return this.bonus.volDeVie + this.tranches * this.bonus.volDeVieParTranche;
  }

  get resistance(): number {
    return this.bonus.resistance + this.resistanceTemporaire;
  }

  // -------------------------------------------------------------- etat vital

  get ratioPv(): number {
    return this.pv / this.pvMax;
  }

  /**
   * Sous ce seuil, le changement de heros est verrouille (DESIGN.md §4.3).
   *
   * ⚠️ Les traits **decalent** ce seuil — un Courageux decroche a 15 %, un
   * Peureux a 30 % — mais aucun ne le supprime. Le plancher a 5 % et le plafond
   * a 50 % sont la pour ca : **l'IA ne perd jamais un heros**, et c'est la regle
   * qui tient tout le jeu.
   */
  get seuilDeRepli(): number {
    return Phaser.Math.Clamp(SEUIL_CRITIQUE + this.personne.mods.seuilRepli, 0.05, 0.5);
  }

  get estCritique(): boolean {
    return this.ratioPv <= this.seuilDeRepli;
  }

  get estVivant(): boolean {
    return this.etat !== "mort";
  }

  /** Il se bat vraiment : lui seul peut etre cible et blesse. */
  get estAuCombat(): boolean {
    return this.etat === "combat";
  }

  get estInvulnerable(): boolean {
    return this.scene.time.now < this.invulnerableJusqua;
  }

  get estInvisible(): boolean {
    return this.scene.time.now < this.invisibleJusqua;
  }

  get estImmobilise(): boolean {
    return this.scene.time.now < this.immobiliseJusqua;
  }

  /** Sequelle de l'Exil : aucun soin possible, et tout contact est fatal. */
  get estCondamne(): boolean {
    return this.scene.time.now < this.condamneJusqua;
  }

  rendreInvulnerable(duree: number): void {
    this.invulnerableJusqua = Math.max(this.invulnerableJusqua, this.scene.time.now + duree);
  }

  rendreInvisible(duree: number): void {
    this.invisibleJusqua = Math.max(this.invisibleJusqua, this.scene.time.now + duree);
  }

  immobiliser(duree: number): void {
    this.immobiliseJusqua = Math.max(this.immobiliseJusqua, this.scene.time.now + duree);
  }

  condamner(duree: number): void {
    this.condamneJusqua = Math.max(this.condamneJusqua, this.scene.time.now + duree);
  }

  /**
   * Soin ordinaire. Refuse par "Sang pour sang" : ce heros ne recupere plus
   * qu'en tuant, et c'est tout l'interet de la competence.
   */
  soigner(montant: number): void {
    if (this.bonus.sangPourSang > 0) return;
    this.soignerForce(montant);
  }

  /** Soin que rien ne peut refuser (recompense de kill, regeneration propre). */
  soignerForce(montant: number): void {
    if (this.estCondamne) return;
    this.pv = Math.min(this.pvMax, this.pv + montant);
  }

  /**
   * Serment de fer : chaque nouveau passage sous la moitie de sa vie le rend
   * definitivement plus dur. Se rearme des qu'il repasse au-dessus.
   */
  verifierSermentDeFer(): number {
    if (this.bonus.sermentDeFer <= 0) return 0;
    if (this.ratioPv > 0.5) {
      this.sermentArme = true;
      return 0;
    }
    if (!this.sermentArme) return 0;
    this.sermentArme = false;
    this.bonus.resistance += this.bonus.sermentDeFer;
    return this.bonus.sermentDeFer;
  }

  /** Vrai tant qu'un coup encaisse le repousse : son pilote patiente. */
  get estEnRecul(): boolean {
    return this.scene.time.now < this.reculJusqua;
  }

  mourir(): void {
    this.etat = "mort";
    this.pv = 0;
    this.estIncarne = false;
    this.setVelocity(0, 0);
    // La teinte de la mort ecrase celle d'une eventuelle evolution : ce qui
    // compte a partir de la, c'est qu'on voie du premier coup d'oeil qu'il est
    // tombe. La bascule et le fondu sont joues par la scene (`animerMort`).
    this.teinte = 0x4a4152;
    this.setTint(0x4a4152);
  }

  /** Renvoie true si les degats ont ete esquives */
  subirDegats(degats: number, tirageEsquive: number): boolean {
    if (this.estInvulnerable) return true;
    if (tirageEsquive < this.esquive) return true;

    // Pendant l'Exil, le moindre contact tue : la resistance ne joue plus.
    const recus = this.estCondamne ? this.pv : Math.max(1, degats - this.resistance);

    // Garantie du design : un heros joue par l'IA ne meurt jamais
    // (DESIGN.md §4.3). Il lui reste toujours un souffle pour decrocher.
    const plancher = this.estIncarne || this.estCondamne ? 0 : 1;
    this.pv = Math.max(plancher, this.pv - recus);
    return false;
  }

  // ------------------------------------------------------------- capacites

  /**
   * L'ultime de classe, puis les competences actives apprises. C'est cette
   * liste qui s'allonge : le clavier du joueur s'enrichit a mesure qu'il
   * progresse (DESIGN.md §4.2).
   */
  get capacites(): Capacite[] {
    const liste: Capacite[] = this.classe.ultimes.map((u) => ({
      id: `ultime-${u.effet}`,
      nom: u.nom,
      description: u.description,
      rechargement: u.rechargement * this.bonus.rechargementCapacites,
      effet: u.effet,
      automatique: false,
      icone: `ultime-${u.effet}`,
    }));

    for (const [id, palier] of Object.entries(this.competences)) {
      const def = competenceParId(id);
      if (!def || def.type === "passive" || !def.effet) continue;
      const infos = def.paliers[palier - 1];
      liste.push({
        id: def.id,
        nom: def.nom,
        description: infos?.texte ?? def.description,
        rechargement: (infos?.rechargement ?? 12000) * this.bonus.rechargementCapacites,
        effet: this.evolutions[def.id]?.effet ?? def.effet,
        automatique: def.type === "auto",
        icone: def.icone ?? "cap-generique",
      });
    }

    return liste;
  }

  /** Rechargement restant, de 0 (pret) a 1 (vient d'etre lance) */
  chargeCapacite(capacite: Capacite): number {
    const pret = this.prochaines[capacite.id];
    if (pret === undefined) return 0;
    const restant = pret - this.scene.time.now;
    return restant <= 0 ? 0 : restant / capacite.rechargement;
  }

  peutLancer(capacite: Capacite): boolean {
    return this.chargeCapacite(capacite) === 0;
  }

  /**
   * @param tirageEcho un aleatoire dans [0,1) : sous le seuil d'Echo, la
   *        capacite ne part pas en rechargement du tout.
   */
  marquerCapacite(capacite: Capacite, tirageEcho = 1): void {
    if (tirageEcho < this.bonus.echo) return;
    this.prochaines[capacite.id] = this.scene.time.now + capacite.rechargement;
  }

  /** Danse des ombres : chaque mort raccourcit tous les rechargements. */
  reduireRechargements(millisecondes: number): void {
    for (const cle of Object.keys(this.prochaines)) {
      this.prochaines[cle] = Math.max(
        this.scene.time.now,
        (this.prochaines[cle] ?? 0) - millisecondes,
      );
    }
  }

  /** Le Necromancien ne quitte jamais la cite (DESIGN.md §4.14). */
  get resteEnCite(): boolean {
    return this.classe.resteEnCite ?? false;
  }

  peutAttaquer(): boolean {
    return this.scene.time.now >= this.prochaineAttaque;
  }

  marquerAttaque(): void {
    this.prochaineAttaque = this.scene.time.now + this.cadence;
  }

  /**
   * Repousse tous les rechargements. Sert quand le jeu se met en pause pour
   * choisir une competence : sans ca, le temps de pause rechargerait tout.
   */
  decalerRechargements(millisecondes: number): void {
    this.prochaineAttaque += millisecondes;
    this.reculJusqua += millisecondes;
    this.flashJusqua += millisecondes;
    this.invulnerableJusqua += millisecondes;
    this.invisibleJusqua += millisecondes;
    this.immobiliseJusqua += millisecondes;
    this.condamneJusqua += millisecondes;
    for (const cle of Object.keys(this.prochaines)) {
      this.prochaines[cle] = (this.prochaines[cle] ?? 0) + millisecondes;
    }
  }

  // ------------------------------------------------------------- progression

  /** Renvoie true si le heros a gagne un niveau */
  gagnerXp(montant: number): boolean {
    this.xp += montant;
    if (this.xp < this.xpRequise) return false;
    this.xp -= this.xpRequise;
    this.niveau += 1;
    // Un choix tous les 5 niveaux seulement : rare, donc important.
    if (donneUnChoix(this.niveau)) this.choixEnAttente += 1;
    this.pv = Math.min(this.pvMax, this.pv + 6);
    return true;
  }

  get xpRequise(): number {
    return xpPourNiveauSuivant(this.niveau);
  }

  /** Veteran : un niveau offert, sans passer par l'experience. */
  gagnerNiveauImmediat(): void {
    this.niveau += 1;
    if (donneUnChoix(this.niveau)) this.choixEnAttente += 1;
    this.soignerForce(10);
  }

  palierDe(id: string): number {
    return this.competences[id] ?? 0;
  }

  /**
   * Apprend une competence, ou la renforce d'un palier si elle est deja
   * connue. Renvoie l'evolution a proposer si ce palier en ouvre une.
   */
  apprendre(competence: CompetenceDef): EvolutionDef[] | null {
    const palier = (this.competences[competence.id] ?? 0) + 1;
    this.competences[competence.id] = palier;

    const avant = this.pvMax;
    competence.paliers[palier - 1]?.appliquer?.(this.bonus, palier);
    // Gagner de la vie maximum doit aussi rendre cette vie.
    this.pv += Math.max(0, this.pvMax - avant);
    if (competence.id === "second-souffle") this.pv = this.pvMax;

    this.choixEnAttente = Math.max(0, this.choixEnAttente - 1);

    const evolutions = competence.evolutions;
    if (evolutions && evolutions.auPalier === palier && !this.evolutions[competence.id]) {
      return evolutions.options;
    }
    return null;
  }

  appliquerEvolution(competenceId: string, evolution: EvolutionDef): void {
    this.evolutions[competenceId] = evolution;
    evolution.appliquer?.(this.bonus);
    // Le build se voit a l'ecran : une evolution change l'allure du heros.
    // Elle est retenue, pas seulement posee : un eclair d'encaissement la
    // remplace le temps d'un clignotement, et il faut savoir y revenir.
    if (evolution.teinte !== undefined) {
      this.teinte = evolution.teinte;
      this.setTint(evolution.teinte);
    }
  }

  /** Les actives apprises, dans l'ordre des touches (§4.13). */
  get actives(): CompetenceDef[] {
    return activesPossedees(this.competences);
  }

  /**
   * Oublie une competence, pour faire place a une autre quand les
   * emplacements d'actives sont pleins (§4.13). Ses paliers sont perdus. Ce
   * qu'un palier avait pu ajouter aux bonus reste — rare pour une active —, et
   * la teinte de son evolution s'efface.
   */
  oublier(id: string): void {
    delete this.competences[id];
    const evolution = this.evolutions[id];
    if (!evolution) return;
    delete this.evolutions[id];
    if (evolution.teinte !== undefined && this.teinte === evolution.teinte) {
      this.teinte = null;
      this.clearTint();
    }
  }
}

/** Ce qui fait d'un ennemi quelqu'un plutot que quelque chose (§4.29). */
export interface ApparenceHumaine {
  /** La famille de planches de son metier — celle qu'il portait en travaillant */
  famille: string;
  nom: string;
}

export class Ennemi extends Phaser.Physics.Arcade.Sprite {
  /** Le compteur qui distribue les tours de decision. */
  private static prochainTour = 0;

  /**
   * Son tour de decision, de 0 a 3 (DESIGN.md §4.33, palier 1).
   *
   * Loin de tout heros ou hors de l'ecran, un monstre ne se decide qu'une image
   * sur quatre : il garde son elan entre deux. Les quatre quarts de la horde se
   * relaient, pour que la charge ne tombe jamais sur la meme image.
   */
  readonly tourDeDecision = Ennemi.prochainTour++ & 3;
  pv: number;
  pvMax: number;
  vitesse: number;
  degats: number;
  xpDonnee: number;
  /** Ce qu'il est : silhouette, statistiques relatives, facon de frapper */
  readonly archetype: Archetype;
  /** Prefixe de ses planches d'animation (voir `poses.ts`) */
  readonly familleSprite: string;
  /** Cible provoquee : le Chevalier Sacre force les ennemis a le viser */
  provoquePar: Hero | null = null;
  /** Invocation qui l'attire (golem, double de l'assassin) */
  attirePar: Invocation | null = null;
  /** Marque du Contrat : cet ennemi mourra a coup sur */
  souscontrat = false;
  /**
   * Le camp qu'il garde, s'il en garde un (DESIGN.md §4.31, jalon 5.6).
   *
   * ⚠️ **Une bete de camp ne poursuit pas au-dela de son terrain**, et c'est
   * une decision d'Angelos : on voit le camp de loin, on peut aller voir, et on
   * peut **renoncer**. Une meute qui ne lache plus ferait de l'approche un
   * engagement total — trop dur pour un heros seul au premier monde, et le
   * detour cesserait d'etre un pari pour devenir un piege.
   */
  campeSur: { x: number; y: number } | null = null;
  /** Jusqu'ou il s'ecarte de son camp avant d'y retourner */
  rayonDuCamp = 0;
  ralentiJusqua = 0;
  /** Eclair blanc au moment d'encaisser, gere sans minuterie */
  flashJusqua = 0;
  /** Teinte de fond : celle de son archetype */
  teinte: number | null = null;
  /** Instant de fin du recul : jusque-la, son deplacement laisse la main */
  reculJusqua = 0;
  /**
   * La ligne droite vers son cap est-elle libre d'eau et de roche ? Verifiee
   * tous les quarts de seconde par la scene (§4.29) ; sinon il suit le parcours.
   */
  ligneLibre = true;
  ligneVerifieeA = -Infinity;
  /** Balancement de marche et pose de coup (voir `poses.ts`) */
  pose = nouvellePose();

  /**
   * Le telegraphe (voir §3 du brief combat).
   *
   * Un coup de monstre se joue en deux temps : il se cabre, **puis** il frappe.
   * L'etat de cet armement tient en deux nombres et une reference — pas de
   * minuterie, comme partout ailleurs : la scene compare `instantFrappe` a
   * l'horloge dans sa boucle des ennemis, qui tourne de toute facon.
   */
  enArmement = false;
  /** Instant ou le coup arme partira */
  instantFrappe = 0;
  /** Qui il visait au moment de s'armer ; il peut la rater si elle s'ecarte */
  cibleArmee: Hero | null = null;
  /**
   * La maison qu'il vient piller, s'il en vise une (§4.24, 19 septembre 2026).
   * Une part des monstres se detourne de l'eglise pour la maison debout la plus
   * proche ; quand elle tombe, il en prend une autre, et l'eglise en dernier.
   */
  cibleMaison: Maison | null = null;

  /**
   * Il porte un visage d'homme (DESIGN.md §4.29) : c'est un habitant du village
   * qu'on a refuse en face, et il a son nom.
   *
   * ⚠️ **Un humain hostile est un `Ennemi`, pas un `Villageois` retourne**, et
   * il faut dire pourquoi : tout ce qui fait un combat — le ciblage, l'arc du
   * coup, les projectiles, les zones, le recul, la mort, la depouille, le
   * butin, la musique — est ecrit pour `Ennemi` et pour rien d'autre. Le §4.29
   * annoncait « c'est le bloc de combat de l'habitant qui sert, retourne contre
   * nous » ; en le faisant, ce bloc-la (frapper un monstre au contact devant
   * l'eglise) s'est revele etre trois lignes, et tout le reste aurait ete
   * duplique. Ce qu'on garde de l'habitant, c'est ce qui compte : **sa planche
   * et son nom**.
   */
  readonly humain: ApparenceHumaine | null;

  private facteurRalenti = 0.5;
  private prochainCoup = 0;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    puissance: number,
    archetype: Archetype = ARCHETYPE_DEFAUT,
    humain: ApparenceHumaine | null = null,
  ) {
    // Chaque archetype a sa propre planche, cuite au demarrage : plus de teinte
    // ni d'echelle pour les distinguer (§4.30). Un humain, lui, garde la
    // planche du metier qu'il exercait ce matin.
    const famille = humain?.famille ?? familleDeMonstre(archetype.id);
    super(scene, x, y, plancheDe(famille), 0);
    this.familleSprite = famille;
    this.archetype = archetype;
    this.humain = humain;
    // L'archetype **module** la montee en puissance, il ne la remplace pas :
    // la formule de base est celle d'avant, multipliee ensuite.
    this.pvMax = Math.max(1, Math.round((10 + puissance * 6) * archetype.multPv));
    this.pv = this.pvMax;
    this.vitesse = (42 + puissance * 3) * archetype.multVitesse;
    this.degats = Math.max(1, Math.round((6 + puissance * 2) * archetype.multDegats));
    this.xpDonnee = archetype.xp;

    scene.add.existing(this);
    scene.physics.add.existing(this);
    // La mer et la montagne ne laissent passer personne (DESIGN.md §4.6) :
    // un flanc qu'un monstre peut contourner n'est pas un flanc ferme.
    this.setCollideWorldBounds(true);
    // ⚠️ **L'echelle de l'archetype ne touche plus au sprite** : une brute est
    // cuite dans un cadre de 48, nette. Elle ne touche que la hitbox — une
    // brute occupe plus de place dans le monde, ce qu'on voit est ce qu'on
    // touche.
    this.setScale(ECHELLE_PERSONNAGE);
    calerCorps(this, 8 * archetype.echelle, 9 * archetype.echelle);
    if (archetype.teinte !== 0xffffff) {
      this.teinte = archetype.teinte;
      this.setTint(archetype.teinte);
    }
  }

  get vitesseEffective(): number {
    return this.scene.time.now < this.ralentiJusqua
      ? this.vitesse * this.facteurRalenti
      : this.vitesse;
  }

  /** @param facteur part de vitesse conservee : 0,25 = ralenti de 75% */
  ralentir(duree: number, facteur = 0.5): void {
    this.ralentiJusqua = Math.max(this.ralentiJusqua, this.scene.time.now + duree);
    this.facteurRalenti = Math.min(this.facteurRalenti, facteur);
  }

  peutFrapper(maintenant: number): boolean {
    return maintenant >= this.prochainCoup;
  }

  marquerCoup(maintenant: number): void {
    this.prochainCoup = maintenant + this.archetype.recuperation;
  }

  /**
   * Il se cabre : le coup partira a `instantFrappe`, pas avant.
   *
   * Le rechargement est pose **des maintenant**, et il court a partir de la
   * frappe : sans ca, le contact rearmerait l'ennemi a chaque image pendant
   * tout son armement.
   */
  armer(maintenant: number, cible: Hero): void {
    this.enArmement = true;
    this.cibleArmee = cible;
    this.instantFrappe = maintenant + this.archetype.armement;
    this.prochainCoup = this.instantFrappe + this.archetype.recuperation;
  }

  /** Il a frappe, ou renonce : il redevient disponible. */
  desarmer(): void {
    this.enArmement = false;
    this.cibleArmee = null;
  }

  /** Vrai tant qu'un coup encaisse le repousse. */
  get estEnRecul(): boolean {
    return this.scene.time.now < this.reculJusqua;
  }

  /**
   * Repousse tous ses horodatages.
   *
   * Le pendant de `Hero.decalerRechargements` : quand le jeu se fige pour un
   * choix de competence, le temps de menu ne doit pas armer une vague entiere
   * de monstres qui frapperaient tous a la reprise.
   */
  decaler(millisecondes: number): void {
    this.prochainCoup += millisecondes;
    this.instantFrappe += millisecondes;
    this.ralentiJusqua += millisecondes;
    this.flashJusqua += millisecondes;
    this.reculJusqua += millisecondes;
  }
}

/**
 * Tout ce qui se bat pour l'equipe sans etre un heros : les mort-vivants du
 * Necromancien, le familier du Mage, le double de l'Assassin.
 *
 * Leurs statistiques dependent toujours du **niveau de leur maitre** : une
 * invocation monte avec celui qui l'a faite, elle ne devient jamais obsolete.
 */
export class Invocation extends Phaser.Physics.Arcade.Sprite {
  pv = 1;
  pvMax = 1;
  degats = 1;
  vitesse = 70;
  readonly maitre: Hero;
  /** Instant de disparition ; Infinity pour une invocation permanente */
  finDeVie = Infinity;
  /** Attire les ennemis sur lui */
  provoque = false;
  /** Les ennemis ne le voient pas */
  furtif = false;
  /** Acheve les ennemis sous ce ratio de vie ; 0 = jamais */
  seuilExecution = 0;
  /** Souffle tout autour en disparaissant */
  explosif = false;
  /**
   * Le meme ordre que les heros IA (DESIGN.md §4.4, §4.14) : c'est ce qui evite
   * d'avoir deux systemes de commandement a maintenir. Sans ancre, il tient la
   * position de son maitre.
   */
  ordre: Ordre = { posture: "temporiser", ancre: null };
  /** Allie qu'il protege : son ancre le suit partout */
  protege: Hero | null = null;
  /** Balancement de marche et pose de coup (voir `poses.ts`) */
  pose = nouvellePose();
  /** Eclair blanc au moment d'encaisser, gere sans minuterie */
  flashJusqua = 0;
  /** Teinte permanente : celle du double de l'assassin, par exemple */
  teinte: number | null = null;
  /** Prefixe de ses planches d'animation (voir `poses.ts`) */
  readonly familleSprite: string;
  private prochainCoup = 0;

  /**
   * @param famille la famille de planche : `mort-vivant`, `familier`,
   *        `familier-golem`, `familier-spectre`, ou celle d'un heros pour le
   *        double de l'Assassin.
   */
  constructor(scene: Phaser.Scene, x: number, y: number, famille: string, maitre: Hero) {
    super(scene, x, y, plancheDe(famille), 0);
    this.familleSprite = famille;
    this.maitre = maitre;
    // Il nait avec l'ordre en cours de son maitre : sans ca, chaque nouveau
    // mort-vivant repartirait au hasard au milieu d'une manoeuvre. L'ancre est
    // recopiee, jamais partagee : elle est deplacee en place a chaque image.
    const ancre = maitre.ordre.ancre;
    this.ordre = { posture: maitre.ordre.posture, ancre: ancre ? { ...ancre } : null };
    this.protege = maitre.protege;
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setCollideWorldBounds(true);
    this.setScale(ECHELLE_PERSONNAGE);
    calerCorps(this, 8, 9);
  }

  peutFrapper(maintenant: number): boolean {
    return maintenant >= this.prochainCoup;
  }

  marquerCoup(maintenant: number): void {
    this.prochainCoup = maintenant + 800;
  }
}

/** Un cadavre releve par le Necromancien (DESIGN.md §4.14). */
export class MortVivant extends Invocation {
  constructor(scene: Phaser.Scene, x: number, y: number, maitre: Hero) {
    super(scene, x, y, "mort-vivant", maitre);

    const puissance = maitre.bonus.puissanceMortsVivants;
    this.pvMax = Math.round((18 + maitre.niveau * 4) * puissance);
    this.pv = this.pvMax;
    this.degats = Math.round((4 + maitre.niveau * 1.2) * puissance);
    this.vitesse = 70;
    this.explosif = maitre.bonus.mortsVivantsExplosifs;
    this.finDeVie = maitre.bonus.mortsVivantsEternels ? Infinity : scene.time.now + 45000;
  }
}

/**
 * Le familier du Mage : permanent, il grandit a chacun de ses niveaux.
 * Son evolution decide de ce qu'il est — un mur, ou un couteau.
 */
export class Familier extends Invocation {
  constructor(scene: Phaser.Scene, x: number, y: number, maitre: Hero) {
    const golem = maitre.bonus.familierGolem;
    const spectre = maitre.bonus.familierSpectre;
    super(scene, x, y, golem ? "familier-golem" : spectre ? "familier-spectre" : "familier", maitre);

    const puissance = maitre.bonus.familier;
    this.pvMax = Math.round((30 + maitre.niveau * 6) * puissance * (golem ? 2.2 : spectre ? 0.6 : 1));
    this.pv = this.pvMax;
    this.degats = Math.round((6 + maitre.niveau * 1.5) * puissance * (golem ? 0.6 : spectre ? 1.5 : 1));
    this.vitesse = golem ? 60 : spectre ? 130 : 90;
    this.provoque = golem;
    this.furtif = spectre;
    this.seuilExecution = spectre ? 0.15 : 0;
    // Le golem est une masse : une fois et demie les autres dans le monde, et
    // **cuit** une fois et demie plus grand a l'ecran — jamais agrandi.
    if (golem) calerCorps(this, 8 * GROSSEUR_GOLEM, 9 * GROSSEUR_GOLEM);
  }
}

/** Le double de l'Assassin : immobile, il attire tout, puis il explose. */
export class Double extends Invocation {
  constructor(scene: Phaser.Scene, x: number, y: number, maitre: Hero, palier: number) {
    super(scene, x, y, maitre.familleSprite, maitre);
    this.pvMax = Math.round(maitre.pvMax * 0.3 * palier);
    this.pv = this.pvMax;
    this.degats = 0;
    this.vitesse = 0;
    this.provoque = true;
    this.explosif = true;
    this.finDeVie = scene.time.now + 5000;
    this.setAlpha(0.6);
    this.teinte = 0x9fd8ff;
    this.setTint(0x9fd8ff);
  }
}

/**
 * Le dome pose par le mage. Volontairement hors du moteur physique : un cercle
 * et une distance suffisent, et ca evite les surprises de redimensionnement des
 * corps circulaires d'Arcade.
 */
export interface Dome {
  image: Phaser.GameObjects.Image;
  x: number;
  y: number;
  rayon: number;
  pv: number;
  pvMax: number;
}
