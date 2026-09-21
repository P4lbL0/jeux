import Phaser from "phaser";
import { VILLAGE } from "../core/carte";
import {
  REGLAGES_SURVIVANTS,
  tirerLaMeute,
  type Survivant,
} from "../core/survivants";
import type { Rng } from "../core/rng";
import { calerCorps, ECHELLE_PERSONNAGE } from "./entities";
import { assurerVillageois, plancheDe } from "./dessin/monde";
import { animer, nouvellePose } from "./poses";

/**
 * Le survivant a l'ecran (DESIGN.md §4.18).
 *
 * Il ne fait que trois choses, et c'est voulu : **il attend**, **il suit**, et
 * **il meurt**. Il ne se defend pas, il ne parle pas, il ne cherche pas son
 * chemin — le §4.18 dit que le danger est le **trajet du retour**, pas lui.
 *
 * ⚠️ **Il n'est pas un `Villageois`.** Tant qu'on ne l'a pas accepte a
 * l'arrivee, il n'appartient pas au village : il n'a ni poste, ni cadence, ni
 * ligne dans le tableau, et sa mort ne compte pas comme celle d'un des siens
 * (elle vaut la moitie sur la rumeur). En faire un habitant provisoire aurait
 * fait fuiter un inconnu dans tous les calculs du village.
 */
export type EtatSurvivant = "attend" | "suit" | "arrive" | "mort";

export class SpriteSurvivant extends Phaser.Physics.Arcade.Sprite {
  readonly regles: Survivant;
  etat: EtatSurvivant = "attend";
  pv = REGLAGES_SURVIVANTS.pointsDeVie;
  /** Vrai des que le joueur l'a eu dans son rayon de vue : la meute est tiree */
  vu = false;

  /** Sa planche : un inconnu, delave et fatigue par la route (voir `poses.ts`) */
  readonly familleSprite: string;
  pose = nouvellePose();

  constructor(scene: Phaser.Scene, regles: Survivant) {
    // Un inconnu ne porte pas les couleurs d'un metier du village : il est
    // delave, et il a marche. C'est la seule chose qui le distingue d'un
    // habitant a l'ecran, et ca suffit — on ne le voit jamais a cote des autres.
    const famille = assurerVillageois(scene, "survivant", { usure: 0.6, sang: 0 });
    super(scene, regles.point.x, regles.point.y, plancheDe(famille), 0);
    this.familleSprite = famille;
    this.regles = regles;

    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setScale(ECHELLE_PERSONNAGE);
    calerCorps(this, 8, 10);
  }

  /** Son geste, une fois par image : il marche ou il attend. */
  animer(maintenant: number): void {
    if (!this.vivant) return;
    const corps = this.body as Phaser.Physics.Arcade.Body | null;
    animer(this, this.pose, corps ? corps.velocity.length() : 0, maintenant);
  }

  get nom(): string {
    return this.regles.arrivant.personne.nom;
  }

  get vivant(): boolean {
    return this.etat !== "mort";
  }
}

/**
 * Ce dont la troupe des survivants a besoin de la part de l'arene.
 *
 * Une interface plutot que la scene entiere : `ArenaScene` fait plus de quatre
 * mille lignes, et rien ici n'a besoin d'y toucher (§4.28, meme raison que pour
 * la sauvegarde).
 */
export interface ContexteSurvivants {
  rng: Rng;
  /** Ou est le heros qu'on pilote — c'est lui, et lui seul, qui les ramene */
  positionDuHeros: () => { x: number; y: number };
  /** Sa vitesse du moment : le survivant en prend une part (§4.18) */
  vitesseDuHeros: () => number;
  /** Le rayon de vue du §4.6, celui qui ferme deja le camping */
  rayonDeVue: number;
  annoncer: (message: string, source: string) => void;
  /** La meute, tiree au visu et lachee autour de lui */
  lacherLaMeute: (x: number, y: number, combien: number) => void;
  /** Il est a l'eglise : la fiche d'observation se rejoue (§4.10) */
  presenter: (survivant: SpriteSurvivant) => void;
  /** Il est mort en chemin : demi-tarif sur la rumeur (§4.18) */
  noterUneMortEnChemin: () => void;
  /**
   * Combien peuvent suivre a la fois : **un** en partie installee (§4.18),
   * **trois** sur la route (§4.31).
   */
  plafond: () => number;
  /**
   * Ou il faut le mener pour que la fiche se rejoue, ou `null` sur la route.
   *
   * ⚠️ **Sur la route il n'y a pas d'eglise ou le deposer**, et c'est toute la
   * difference entre les deux moments du meme bloc. On le juge donc **au
   * contact** — la ou on l'a trouve —, et une fois accepte il marche avec nous
   * jusqu'a ce qu'on s'installe.
   */
  refuge: () => { x: number; y: number } | null;
}

/**
 * La troupe : **un** survivant en partie installee, **trois** sur la route.
 *
 * Le plafond de un n'a jamais ete une limite technique : deux appels en meme
 * temps demanderaient de choisir lequel sauver, ce qui est une bonne idee — et
 * une autre idee. Le §4.18 n'en decrit qu'un.
 *
 * ⚠️ **La route en demande plusieurs, et c'est une autre situation** (§4.31,
 * 21 septembre 2026). On ne choisit pas entre deux appels simultanes : on
 * traverse sept mondes a la file, et chacun peut porter quelqu'un. Les laisser
 * derriere parce qu'on en a deja un serait punir le detour au lieu de le
 * recompenser. Le plafond reste — c'est la regle 1 du §4.17 — mais il est
 * decide par l'appelant, qui seul sait ou l'on en est.
 */
export class Survivants {
  private troupe: SpriteSurvivant[] = [];

  /**
   * Le groupe physique, **cree une fois et jamais vide de sens**.
   *
   * Il y a au plus trois survivants, et aucun la plupart du temps : le groupe
   * existe pour que l'arene puisse poser **un seul** recouvrement au demarrage,
   * au lieu d'en ajouter et d'en retirer un a chaque apparition. Un collider
   * pose et depose en cours de partie est exactement le genre de chose que le
   * §4.17 regle 4 refuse.
   */
  readonly groupe: Phaser.Physics.Arcade.Group;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly contexte: ContexteSurvivants,
  ) {
    this.groupe = scene.physics.add.group();
  }

  /** Le premier de la troupe, pour tout ce qui n'en connait qu'un (§4.18). */
  get present(): SpriteSurvivant | null {
    return this.troupe[0] ?? null;
  }

  /** Tous ceux qui sont la, vivants ou non : c'est ce qui traverse les mondes. */
  get tous(): readonly SpriteSurvivant[] {
    return this.troupe;
  }

  /** Ceux qui nous suivent vraiment — ceux-la deviendront des habitants (§4.31). */
  get suiveurs(): SpriteSurvivant[] {
    return this.troupe.filter((s) => s.vivant && s.etat === "suit");
  }

  /** Quelqu'un parait, et la discussion le dit une fois. */
  faireParaitre(regles: Survivant, ligne: string, deja: "attend" | "suit" = "attend"): void {
    if (this.troupe.length >= this.contexte.plafond()) return;
    const sprite = new SpriteSurvivant(this.scene, regles);
    // Celui qui traverse un monde avec nous ne se redecouvre pas : il marche
    // deja derriere, et on ne rejoue ni sa meute ni sa fiche (§4.31).
    sprite.etat = deja;
    if (deja === "suit") sprite.vu = true;
    this.troupe.push(sprite);
    this.groupe.add(sprite);
    if (ligne === "") return;
    // ⚠️ **Pas la voix du guet.** Elle est en sang frais, et le §4.10 la
    // reserve a ce qui peut tuer. Un appel au loin n'a encore tue personne ;
    // trois lignes rouges d'affilee videraient la couleur de son sens.
    this.contexte.annoncer(ligne, "village");
  }

  /**
   * Le crepuscule tombe : s'il attend encore, il n'est plus la (§4.18).
   *
   * **Le jeu ne dit pas ce qu'il est devenu**, et sa disparition ne coute rien
   * a la rumeur : on ne lui a rien promis. Celui qui **suit** deja, lui, reste —
   * l'abandonner en pleine nuit parce que l'horloge a tourne serait une punition
   * arbitraire au milieu d'un trajet qu'on est en train de faire.
   */
  auCrepuscule(): void {
    for (const sprite of [...this.troupe]) {
      if (sprite.etat !== "attend") continue;
      this.contexte.annoncer("Plus personne n'appelle. Il n'a pas attendu la nuit", "village");
      this.retirer(sprite);
    }
  }

  /** Il a pris un coup. Il n'encaisse presque rien : il ne se defend pas. */
  blesser(sprite: SpriteSurvivant, degats: number): void {
    if (!sprite.vivant) return;
    sprite.pv -= degats;
    if (sprite.pv > 0) return;

    sprite.etat = "mort";
    this.contexte.annoncer(`${sprite.nom} est tombe en chemin`, "guet");
    this.contexte.noterUneMortEnChemin();
    this.retirer(sprite);
  }

  /**
   * Une image de la troupe.
   *
   * ⚠️ **Aucune minuterie, aucun tri, aucun objet cree ici** (§4.17). Il y a au
   * plus un survivant : ce corps de methode coute une distance et une
   * affectation de vitesse, meme quand la nuit est pleine.
   */
  mettreAJour(): void {
    for (const sprite of this.troupe) {
      if (sprite.vivant) this.mettreAJourUn(sprite);
    }
  }

  private mettreAJourUn(sprite: SpriteSurvivant): void {
    sprite.animer(this.scene.time.now);

    const heros = this.contexte.positionDuHeros();
    const distance = Phaser.Math.Distance.Between(sprite.x, sprite.y, heros.x, heros.y);

    // --- Le visu : c'est lui qui tire la meute, pas l'apparition (§4.18) ---
    if (!sprite.vu && distance <= this.contexte.rayonDeVue) {
      sprite.vu = true;
      const combien = tirerLaMeute(sprite.regles, this.contexte.rng);
      if (combien > 0) {
        this.contexte.lacherLaMeute(sprite.x, sprite.y, combien);
        this.contexte.annoncer(`Ils sont sur lui — ${combien}`, "guet");
      }
    }

    if (sprite.etat === "attend") {
      // On va **jusqu'a lui** : il ne se ramasse pas en passant.
      if (distance <= REGLAGES_SURVIVANTS.distanceDeContact) {
        // ⚠️ **Sur la route, la fiche se joue ici et pas au village.** Il n'y a
        // pas d'eglise ou le deposer, et surtout : « il te suit » suppose qu'on
        // ait accepte de le prendre. Le dilemme du §4.18 est donc pose au
        // moment ou l'on arrive sur lui, et l'installation, elle, reste legere.
        if (this.contexte.refuge() === null) {
          sprite.etat = "arrive";
          sprite.setVelocity(0, 0);
          this.contexte.presenter(sprite);
          return;
        }
        sprite.etat = "suit";
        this.contexte.annoncer(`${sprite.nom} se leve et te suit`, "village");
      }
      return;
    }

    // --- Il suit, et il est plus lent que le heros (§4.18) ---
    const refuge = this.contexte.refuge();
    if (refuge) {
      const versRefuge = Phaser.Math.Distance.Between(sprite.x, sprite.y, refuge.x, refuge.y);
      if (versRefuge <= VILLAGE.rayon * 0.5) {
        sprite.etat = "arrive";
        sprite.setVelocity(0, 0);
        this.contexte.presenter(sprite);
        return;
      }
    }

    if (distance <= REGLAGES_SURVIVANTS.distanceDeSuite) {
      sprite.setVelocity(0, 0);
      return;
    }

    const vitesse = this.contexte.vitesseDuHeros() * REGLAGES_SURVIVANTS.partDeVitesse;
    this.scene.physics.moveTo(sprite, heros.x, heros.y, vitesse);
  }

  /**
   * Il est accepte, refuse, mort ou parti : dans tous les cas il sort de
   * l'ecran.
   *
   * @param qui celui qu'on retire ; a defaut, le premier de la troupe — c'est
   *   ce que veut tout le code du §4.18, qui n'en connait qu'un
   */
  retirer(qui?: SpriteSurvivant): void {
    const sprite = qui ?? this.troupe[0];
    if (!sprite) return;
    this.troupe = this.troupe.filter((s) => s !== sprite);
    sprite.destroy();
  }

  /** Tout le monde sort : on change de monde, ou l'on s'installe (§4.31). */
  vider(): void {
    for (const sprite of this.troupe) sprite.destroy();
    this.troupe = [];
  }
}
