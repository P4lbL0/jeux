import Phaser from "phaser";
import { Rng } from "../core/rng";
import { CLASSES, ORDRE_CLASSES, type ClassId } from "../core/classes";
import {
  competenceParId,
  propositionCompetence,
  propositionEvolution,
  tirerCompetences,
  type CompetenceDef,
  type EvolutionDef,
} from "../core/competences";
import { creerTexturesPlaceholder } from "../game/art";
import {
  Double,
  Ennemi,
  Familier,
  Hero,
  Invocation,
  MortVivant,
  type Capacite,
  type Dome,
} from "../game/entities";
import { piloter, type ContexteIA } from "../core/ia";
import {
  NOMS_FORMATION,
  NOMS_POSTURE,
  REGLAGES,
  TOLERANCE_ANCRE,
  type Point,
  type Posture,
} from "../core/ordres";
import { Affinites } from "../core/affinites";
import {
  frontsDeLaVague,
  MONDE,
  NOMS_FRONT,
  POSTES,
  PRATICABLE,
  pointDApparition,
  repartition,
  TERRAIN,
  VILLAGE,
  type Front,
} from "../core/carte";
import { Commandement } from "../game/commandement";
import type { EtatEquipe } from "../game/hud";
import type { EtatOrdres } from "../game/panneauOrdres";
import type { GroupeAffiche } from "../game/ficheHero";

/**
 * L'arene : combat, equipe, IA, progression.
 *
 * Le coeur du jeu (DESIGN.md §4.3) :
 *
 * - le joueur incarne un heros, l'IA joue tous les autres ;
 * - un heros IA se replie automatiquement a 20% de vie : l'IA ne perd jamais
 *   personne ;
 * - le joueur peut changer de heros a tout moment SAUF sous 20% de vie ;
 * - la mort est definitive.
 *
 * Consequence : un heros ne peut mourir que par une decision du joueur.
 */

/**
 * Le village remplace la cite au centre de l'arene : il est desormais adosse a
 * la mer et a la montagne (DESIGN.md §4.6). Le reste du code continue de
 * l'appeler CITE — c'est le meme refuge, il a juste demenage.
 */
const CITE = VILLAGE;
const REGENERATION = 9;
const PORTEE_CORPS_A_CORPS = 90;

/**
 * Plafond d'ennemis vivants.
 *
 * Sans lui, la cadence d'apparition finit par depasser la vitesse a laquelle on
 * tue : les sprites s'accumulent, et le jeu s'effondre au bout de quelques
 * minutes. Le plafond ne rend pas le jeu plus facile — les ennemis restants
 * deviennent simplement plus forts.
 */
const MAX_ENNEMIS = 240;

/** Au-dela, on cesse d'afficher les nombres flottants : ils coutent cher. */
const MAX_TEXTES_FLOTTANTS = 24;

/** Mort-vivants simultanes par Necromancien */
const MAX_MORTS_VIVANTS = 12;

export class ArenaScene extends Phaser.Scene {
  private rng!: Rng;
  private heros: Hero[] = [];
  private indexIncarne = 0;
  /** Le poste de commandement : selection, ordres, formation (DESIGN.md §4.4) */
  commandement!: Commandement;
  private graphiquesOrdres!: Phaser.GameObjects.Graphics;
  /** Experience de groupe : combattre ensemble rend plus fort (DESIGN.md §4.16) */
  affinites = new Affinites();
  private prochainTickAffinites = 0;
  private equipe!: Phaser.Physics.Arcade.Group;
  private ennemis!: Phaser.Physics.Arcade.Group;
  private projectiles!: Phaser.Physics.Arcade.Group;
  /** Tout ce qui se bat pour l'equipe sans etre un heros */
  private invocations!: Phaser.Physics.Arcade.Group;
  /** Instant a partir duquel un familier detruit peut revenir */
  private retourFamilier = new Map<Hero, number>();
  /** Contrat en cours de l'assassin : cette cible mourra */
  private contrats = new Map<Hero, Ennemi>();
  private domes: Dome[] = [];
  private orbiteurs = new Map<Hero, Phaser.GameObjects.Image[]>();
  private prochainTickOrbiteurs = 0;
  private prochainTickAuras = 0;
  private prochainTickEclats = 0;
  /** Heros qui encaisse actuellement pour toute l'equipe (Martyre) */
  private martyr: Hero | null = null;
  /** La Resurrection de l'Oracle ne joue qu'une fois par partie */
  private resurrectionUtilisee = false;
  /** Instant de fin de l'Heure sombre : tout est fige jusque-la */
  private figeJusqua = 0;
  /** Reserve de textes flottants, recycles au lieu d'etre recrees */
  private textesLibres: Phaser.GameObjects.Text[] = [];
  private textesActifs = 0;
  /** Heros ciblables, recalcules une fois par image et non par ennemi */
  private ciblesPossibles: Hero[] = [];

  private zqsd!: Record<string, Phaser.Input.Keyboard.Key>;
  private fleches!: Phaser.Types.Input.Keyboard.CursorKeys;
  private touchesCapacites: Phaser.Input.Keyboard.Key[][] = [];

  private destination: Phaser.Math.Vector2 | null = null;
  private marqueur: Phaser.GameObjects.Image | null = null;

  private debut = 0;
  private prochaineApparition = 0;
  /** Les fronts ouverts en ce moment (DESIGN.md §4.6) */
  private fronts: Front[] = ["nord"];
  private partPremierFront = 1;
  private vague = 0;
  private ecume!: Phaser.GameObjects.TileSprite;
  private kills = 0;
  private termine = false;

  private enPause = false;
  private debutPause = 0;
  private modeChoix: "competence" | "evolution" = "competence";
  private competenceEnEvolution: CompetenceDef | null = null;
  private optionsEvolution: EvolutionDef[] = [];

  constructor() {
    super("arena");
  }

  init(data: { classe?: ClassId }): void {
    this.registry.set("classe", data.classe ?? "guerrier");
    this.heros = [];
    this.indexIncarne = 0;
    this.kills = 0;
    this.termine = false;
    this.enPause = false;
    this.destination = null;
    this.marqueur = null;
    this.domes = [];
    this.orbiteurs = new Map();
    this.retourFamilier = new Map();
    this.contrats = new Map();
    this.textesLibres = [];
    this.textesActifs = 0;
    this.ciblesPossibles = [];
    this.martyr = null;
    this.resurrectionUtilisee = false;
    this.figeJusqua = 0;
    // Une nouvelle partie, une nouvelle equipe : les liens ne se transmettent
    // pas. Ils le feront le jour ou les heros survivront a une partie (§4.12).
    this.affinites = new Affinites();
    this.prochainTickAffinites = 0;
    this.fronts = ["nord"];
    this.partPremierFront = 1;
    this.vague = 0;
  }

  get hero(): Hero {
    return this.heros[this.indexIncarne]!;
  }

  get resume(): { secondes: number; kills: number; niveau: number } {
    return {
      secondes: Math.floor((this.time.now - this.debut) / 1000),
      kills: this.kills,
      niveau: this.hero?.niveau ?? 1,
    };
  }

  get etatEquipe(): EtatEquipe {
    return {
      heros: this.heros,
      indexIncarne: this.indexIncarne,
      changementAutorise: this.changementAutorise(),
      selection: this.commandement?.selectionnes ?? [],
    };
  }

  /**
   * Les liens d'un heros avec le reste de l'equipe, pour sa fiche
   * (DESIGN.md §4.16). Un systeme invisible ne change aucune decision.
   */
  groupeDe(hero: Hero): GroupeAffiche {
    return {
      bonus: hero.bonusGroupe,
      liens: this.heros
        .filter((autre) => autre !== hero && autre.estVivant)
        .map((autre) => ({
          nom: autre.classe.nom,
          force: this.affinites.affinite(hero.identifiant, autre.identifiant),
        })),
    };
  }

  /** Ce que l'interface doit savoir des ordres en cours (DESIGN.md §4.4). */
  get etatOrdres(): EtatOrdres {
    const vises = this.commandement?.destinataires(this.hero ?? null) ?? [];
    const postures = new Set(vises.map((h) => h.ordre.posture));
    return {
      formation: this.commandement?.formation ?? "libre",
      // Une seule posture affichee quand toute la selection est d'accord :
      // annoncer « Agressif » alors que la moitie temporise serait un mensonge.
      posture: postures.size === 1 ? [...postures][0]! : null,
      nombreVises: vises.length,
      selectionExplicite: !(this.commandement?.selectionVide ?? true),
      message:
        this.time.now - (this.commandement?.dernierMessageA ?? 0) < 1600
          ? this.commandement.dernierMessage
          : "",
    };
  }

  // ----------------------------------------------------------- construction

  create(): void {
    const graine = Date.now() % 1_000_000;
    this.rng = new Rng(graine);
    console.log(`[arene] graine = ${graine}`);

    creerTexturesPlaceholder(this);
    this.construireDecor();

    this.equipe = this.physics.add.group();
    this.ennemis = this.physics.add.group();
    this.projectiles = this.physics.add.group();
    this.invocations = this.physics.add.group();
    this.composerEquipe();
    this.commandement = new Commandement(this.heros);
    // Sous les personnages : les reperes d'ordres ne doivent jamais masquer le
    // combat.
    this.graphiquesOrdres = this.add.graphics().setDepth(-400);

    // La mer et la montagne ne sont pas du decor : le monde physique s'arrete
    // a la plage et a la lisiere (DESIGN.md §4.6).
    this.physics.world.setBounds(
      PRATICABLE.x,
      PRATICABLE.y,
      PRATICABLE.largeur,
      PRATICABLE.hauteur,
    );
    this.cameras.main.setBounds(0, 0, MONDE.largeur, MONDE.hauteur);
    this.cameras.main.setZoom(3);
    this.cameras.main.startFollow(this.hero, true, 0.12, 0.12);
    this.configurerZoom();
    this.configurerTouches();
    this.configurerSouris();

    this.physics.add.overlap(this.equipe, this.ennemis, (h, e) =>
      this.contactEnnemi(h as Hero, e as Ennemi),
    );
    this.physics.add.overlap(this.projectiles, this.ennemis, (p, e) =>
      this.impactProjectile(p as Phaser.Physics.Arcade.Image, e as Ennemi),
    );
    this.physics.add.overlap(this.invocations, this.ennemis, (m, e) =>
      this.melee(m as Invocation, e as Ennemi),
    );

    this.scene.launch("ui", { arene: this });
    this.events.on("choix-fait", this.resoudreChoix, this);
    this.events.on("changer-hero", this.changerHero, this);
    this.events.on("selectionner", this.selectionnerDepuisUi, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.events.off("choix-fait", this.resoudreChoix, this);
      this.events.off("changer-hero", this.changerHero, this);
      this.events.off("selectionner", this.selectionnerDepuisUi, this);
    });

    this.debut = this.time.now;
    this.prochaineApparition = this.time.now + 1200;
  }

  /**
   * Jalon 3 : l'equipe complete est donnee d'emblee, pour pouvoir eprouver le
   * changement de heros et l'IA. Le vrai recrutement, avec ses rangs, arrive au
   * jalon 8 (DESIGN.md §4.1).
   */
  private composerEquipe(): void {
    const choisie = this.registry.get("classe") as ClassId;
    const ordre = [choisie, ...ORDRE_CLASSES.filter((id) => id !== choisie)];

    ordre.forEach((id, i) => {
      const angle = (i / ordre.length) * Math.PI * 2;
      const hero = new Hero(
        this,
        CITE.x + Math.cos(angle) * 60,
        CITE.y + Math.sin(angle) * 60,
        CLASSES[id],
      );
      hero.estIncarne = i === 0;
      this.heros.push(hero);
      this.equipe.add(hero);
    });
  }

  /**
   * La carte du village (DESIGN.md §4.6) : la mer a l'ouest, la montagne au
   * sud, et le village blotti dans l'angle. Les deux fronts restent ouverts au
   * nord et a l'est.
   *
   * Tout est pose une fois pour toutes ici. Rien de ce decor n'est recree en
   * cours de partie (§4.17).
   */
  private construireDecor(): void {
    this.add.tileSprite(0, 0, MONDE.largeur, MONDE.hauteur, "herbe").setOrigin(0).setDepth(-1000);

    // --- La mer et la plage, a l'ouest ---
    this.add
      .tileSprite(0, 0, TERRAIN.mer, MONDE.hauteur, "mer")
      .setOrigin(0)
      .setDepth(-995);
    this.add
      .tileSprite(TERRAIN.mer, 0, TERRAIN.plage - TERRAIN.mer, MONDE.hauteur, "sable")
      .setOrigin(0)
      .setDepth(-994);

    // L'ecume vit sur la ligne de rivage. On la deplace, on ne la refabrique
    // jamais : c'est un seul objet pour toute la partie.
    this.ecume = this.add
      .tileSprite(TERRAIN.mer - 26, 0, 52, MONDE.hauteur, "ecume")
      .setOrigin(0)
      .setDepth(-993)
      .setAlpha(0.75);

    // --- La montagne et sa foret, au sud ---
    this.add
      .tileSprite(0, TERRAIN.montagne, MONDE.largeur, MONDE.hauteur - TERRAIN.montagne, "montagne")
      .setOrigin(0)
      .setDepth(-995);
    this.add
      .tileSprite(0, TERRAIN.foret, MONDE.largeur, TERRAIN.montagne - TERRAIN.foret, "sous-bois")
      .setOrigin(0)
      .setDepth(-994);

    this.semerLeDecor();
    this.construireVillage();
    this.marquerLesPostes();
  }

  /**
   * Arbres et rochers, semes avec une graine fixe pour que la carte soit la
   * meme d'une partie a l'autre : on doit pouvoir apprendre son terrain.
   */
  private semerLeDecor(): void {
    const rng = new Rng(20260807);

    // La foret, dense a la lisiere de la montagne.
    for (let i = 0; i < 120; i++) {
      const x = rng.range(0, MONDE.largeur);
      const y = rng.range(TERRAIN.foret - 30, TERRAIN.montagne + 10);
      this.add.image(x, y, "arbre").setDepth(y).setScale(rng.range(0.8, 1.2));
    }
    // Quelques bosquets qui remontent vers les terres, pour casser la ligne.
    for (let i = 0; i < 26; i++) {
      const x = rng.range(TERRAIN.plage + 40, MONDE.largeur - 40);
      const y = rng.range(TERRAIN.foret - 180, TERRAIN.foret - 40);
      this.add.image(x, y, "arbre").setDepth(y).setScale(rng.range(0.7, 1));
    }
    // Les rochers du pied de la montagne.
    for (let i = 0; i < 46; i++) {
      const x = rng.range(0, MONDE.largeur);
      const y = rng.range(TERRAIN.montagne - 20, MONDE.hauteur - 30);
      this.add.image(x, y, "rocher").setDepth(y).setScale(rng.range(0.8, 1.6));
    }
  }

  /**
   * Le village. Encore un cercle de pierre : ses batiments et ses habitants
   * arrivent au bloc suivant du jalon 5. Ce qui change deja, c'est qu'il n'est
   * plus au centre — il est adosse a la mer et a la montagne.
   */
  private construireVillage(): void {
    const sol = this.add.graphics().setDepth(-950);
    sol.fillStyle(0x8a7f6d, 1);
    sol.fillCircle(CITE.x, CITE.y, CITE.rayon);
    sol.fillStyle(0x9c917d, 1);
    sol.fillCircle(CITE.x, CITE.y, CITE.rayon - 18);
    sol.lineStyle(3, 0x5d5546, 1);
    sol.strokeCircle(CITE.x, CITE.y, CITE.rayon);

    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * Math.PI * 2;
      this.add
        .image(CITE.x + Math.cos(a) * CITE.rayon, CITE.y + Math.sin(a) * CITE.rayon, "mur")
        .setDepth(-940);
    }

    this.add
      .text(CITE.x, CITE.y - CITE.rayon - 18, "LE VILLAGE", {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#f2e9d8",
      })
      .setOrigin(0.5)
      .setDepth(-930);
  }

  /**
   * Les postes de travail (DESIGN.md §4.18). Ils ne produisent encore rien :
   * ce sont pour l'instant des reperes, mais ce sont deja les endroits que la
   * defense devra couvrir.
   */
  private marquerLesPostes(): void {
    for (const poste of POSTES) {
      const g = this.add.graphics().setDepth(-945);
      g.lineStyle(2, 0xd8c48a, 0.5);
      g.strokeCircle(poste.position.x, poste.position.y, 34);
      this.add
        .text(poste.position.x, poste.position.y - 48, poste.nom.toUpperCase(), {
          fontFamily: "monospace",
          fontSize: "10px",
          color: "#d8c48a",
        })
        .setOrigin(0.5)
        .setDepth(-930);
    }
  }

  // -------------------------------------------------------------- controles

  private configurerZoom(): void {
    this.input.on("wheel", (_p: unknown, _o: unknown, _dx: number, dy: number) => {
      const cam = this.cameras.main;
      cam.setZoom(Phaser.Math.Clamp(cam.zoom - dy * 0.0016, 1.4, 6));
    });
  }

  /**
   * Gauche, c'est *moi* ; droite, c'est *les autres* (DESIGN.md §4.4).
   * Le combat ne s'arrete jamais pour donner un ordre.
   */
  private configurerSouris(): void {
    // Sans ca, le clic droit ouvre le menu du navigateur en plein combat.
    this.input.mouse?.disableContextMenu();

    const viser = (pointeur: Phaser.Input.Pointer) => {
      if (this.termine || this.enPause) return;
      const point = this.cameras.main.getWorldPoint(pointeur.x, pointeur.y);
      this.destination = new Phaser.Math.Vector2(point.x, point.y);
      this.montrerMarqueur();
    };

    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      if (this.termine || this.enPause) return;
      if (p.rightButtonDown()) this.ordonnerAncre(p);
      else viser(p);
    });
    // Maintenir guide le heros ; le clic droit, lui, ne se maintient pas.
    this.input.on(
      "pointermove",
      (p: Phaser.Input.Pointer) => p.isDown && !p.rightButtonDown() && viser(p),
    );
  }

  // ------------------------------------------------------------ commandement

  /**
   * Clic droit : la selection va tenir ce point. Sur un allie, elle le suit
   * partout — proteger quelqu'un, c'est s'ancrer sur lui (DESIGN.md §4.4).
   */
  private ordonnerAncre(pointeur: Phaser.Input.Pointer): void {
    const point = this.cameras.main.getWorldPoint(pointeur.x, pointeur.y);
    const protege = this.alliePres(point.x, point.y);
    const incarne = this.hero ?? null;

    const nombre = this.commandement.ancrer(
      protege ? { x: protege.x, y: protege.y } : { x: point.x, y: point.y },
      protege ?? null,
      incarne,
      this.sbires,
    );
    if (nombre === 0) return;

    this.effetCercle(point.x, point.y, protege ? 34 : 22, protege ? 0x7ee0a0 : 0x5ec8f0);
    this.annoncer(
      protege
        ? `${nombre} protege${nombre > 1 ? "nt" : ""} ${protege.classe.nom}`
        : `${nombre} en route`,
    );
  }

  /** Le heros le plus proche du clic, s'il est assez pres pour etre vise. */
  private alliePres(x: number, y: number): Hero | null {
    let meilleur: Hero | null = null;
    let distance = 26;
    for (const hero of this.heros) {
      if (!hero.estVivant) continue;
      const d = Phaser.Math.Distance.Between(x, y, hero.x, hero.y);
      if (d < distance) {
        distance = d;
        meilleur = hero;
      }
    }
    return meilleur;
  }

  private ordonnerPosture(posture: Posture): void {
    const nombre = this.commandement.donnerPosture(posture, this.hero ?? null, this.sbires);
    if (nombre > 0) this.annoncer(`${nombre} · ${NOMS_POSTURE[posture]}`);
  }

  private changerFormation(): void {
    const formation = this.commandement.changerFormation();
    this.annoncer(`Formation : ${NOMS_FORMATION[formation]}`);
  }

  private rompre(): void {
    this.commandement.rompre(this.sbires);
    this.annoncer("Rompez");
  }

  /** Clic droit sur un portrait, transmis par l'interface. */
  private selectionnerDepuisUi(index: number, touteLaClasse: boolean): void {
    const hero = this.heros[index];
    if (!hero || !hero.estVivant) return;
    if (touteLaClasse) this.commandement.selectionnerClasse(hero.classe.id);
    else this.commandement.basculer(hero);
  }

  private annoncer(message: string): void {
    this.commandement.annoncer(message, this.time.now);
  }

  private get sbires(): Invocation[] {
    return (this.invocations.getChildren() as Invocation[]).filter((i) => i.active);
  }

  private montrerMarqueur(): void {
    if (!this.destination) return;
    this.marqueur ??= this.add
      .image(0, 0, "impact")
      .setTint(0xfff0a0)
      .setAlpha(0.5)
      .setScale(0.9)
      .setDepth(-500);
    this.marqueur.setPosition(this.destination.x, this.destination.y).setVisible(true);
  }

  private effacerDestination(): void {
    this.destination = null;
    this.marqueur?.setVisible(false);
  }

  private configurerTouches(): void {
    const clavier = this.input.keyboard;
    if (!clavier) return;
    this.zqsd = clavier.addKeys("Z,Q,S,D") as Record<string, Phaser.Input.Keyboard.Key>;
    this.fleches = clavier.createCursorKeys();

    const K = Phaser.Input.Keyboard.KeyCodes;
    // ESPACE en plus du 1 : sur AZERTY la rangee des chiffres demande Shift.
    const codesParCapacite = [
      [K.ONE, K.NUMPAD_ONE, K.SPACE],
      [K.TWO, K.NUMPAD_TWO],
      [K.THREE, K.NUMPAD_THREE],
      [K.FOUR, K.NUMPAD_FOUR],
      [K.FIVE, K.NUMPAD_FIVE],
    ];
    this.touchesCapacites = codesParCapacite.map((codes) => codes.map((c) => clavier.addKey(c)));

    // A et E encadrent ZQSD : on change de heros sans lacher les deplacements.
    clavier.addKey(K.A).on("down", () => this.changerHeroRelatif(-1));
    clavier.addKey(K.E).on("down", () => this.changerHeroRelatif(1));

    // Les ordres tombent sous la rangee de deplacement : la main gauche
    // commande sans jamais lacher ZQSD (DESIGN.md §4.4).
    const ordres: [number, () => void][] = [
      [K.W, () => this.ordonnerPosture("temporiser")],
      [K.X, () => this.ordonnerPosture("agressif")],
      [K.C, () => this.ordonnerPosture("repli")],
      [K.V, () => this.changerFormation()],
      [K.ESC, () => this.rompre()],
    ];
    for (const [code, action] of ordres) {
      clavier.addKey(code).on("down", () => {
        if (this.termine || this.enPause) return;
        action();
      });
    }

    clavier.addKey(K.R).on("down", () => {
      if (!this.termine) return;
      this.scene.stop("ui");
      this.scene.start("choix-classe");
    });
  }

  // ------------------------------------------------- changement de heros

  /**
   * Le verrou des 20% (DESIGN.md §4.3). Sous ce seuil, le joueur ne peut pas
   * abandonner son heros mourant : il doit le ramener vivant a la cite.
   */
  private changementAutorise(): boolean {
    const h = this.hero;
    if (!h || h.etat === "mort") return true;
    return !h.estCritique || h.etat === "cite";
  }

  private changerHeroRelatif(pas: number): void {
    const total = this.heros.length;
    for (let i = 1; i <= total; i++) {
      const index = (this.indexIncarne + pas * i + total * i) % total;
      if (this.heros[index]?.etat !== "mort") {
        this.changerHero(index);
        return;
      }
    }
  }

  private changerHero(index: number): void {
    if (this.termine || this.enPause) return;
    const cible = this.heros[index];
    if (!cible || cible.etat === "mort" || index === this.indexIncarne) return;

    if (!this.changementAutorise()) {
      this.flotter(this.hero.x, this.hero.y - 24, "Verrouille !", "#ff8a7a");
      this.cameras.main.shake(120, 0.003);
      return;
    }

    this.hero.estIncarne = false;
    this.hero.setVelocity(0, 0);
    this.indexIncarne = index;
    cible.estIncarne = true;
    this.effacerDestination();

    this.cameras.main.startFollow(cible, true, 0.12, 0.12);
    this.effetCercle(cible.x, cible.y, 60, 0xf0c419);
    this.events.emit("hero-incarne", cible);

    // Le heros repris presente ses choix en attente : c'est toujours le joueur
    // qui choisit, jamais l'IA (DESIGN.md §4.3).
    if (cible.choixEnAttente > 0) this.ouvrirChoix();
  }

  // ---------------------------------------------------------------- boucle

  update(_temps: number, delta: number): void {
    if (this.termine || this.enPause) return;

    this.majEtats(delta);
    this.majAffinites();
    this.majContexteEquipe();
    this.majCommandement();
    this.majProvocation();
    this.majOrbiteurs();
    this.majAuras();
    this.majInvocations();
    this.majProvocationInvocations();
    this.deplacerHeroIncarne();
    this.deplacerHerosIA();

    // Heure sombre : tout est fige sauf le heros du joueur.
    if (this.time.now >= this.figeJusqua) {
      this.deplacerEnnemis();
    } else {
      for (const objet of this.ennemis.getChildren()) (objet as Ennemi).setVelocity(0, 0);
    }

    for (const hero of this.heros) this.attaquerAvec(hero);
    this.gererCapacitesAuto();
    this.gererCapacites();
    this.fairePartirLesVagues();
    this.trierProfondeurs();

    // Le ressac : on fait respirer un seul objet deja pose, on n'en cree
    // aucun (§4.17). C'est ce qui rend le bord ouest vivant a l'oeil.
    this.ecume.x = TERRAIN.mer - 26 + Math.sin(this.time.now / 900) * 9;
    this.ecume.tilePositionY = this.time.now / 220;
  }

  /** Toutes les x millisecondes : chaque paire de heros coute un calcul. */
  private static readonly PERIODE_AFFINITES = 250;

  /**
   * L'experience de groupe (DESIGN.md §4.16) : les heros qui se battent
   * ensemble apprennent a travailler ensemble.
   *
   * Un simple horodatage plutot qu'une minuterie (regle 4 du §4.17), et un
   * calcul par paire toutes les 250 ms plutot qu'a chaque image (regle 5).
   */
  private majAffinites(): void {
    if (this.time.now < this.prochainTickAffinites) return;
    const periode = ArenaScene.PERIODE_AFFINITES;
    this.prochainTickAffinites = this.time.now + periode;

    const tous = this.heros.filter((h) => h.estVivant).map((h) => h.identifiant);
    // Au combat seulement : ni la cite, ni le repli ne font une equipe.
    const auCombat = this.heros.filter((h) => h.estAuCombat).map((h) => h.identifiant);
    this.affinites.ecouler(tous, auCombat, periode / 1000);

    for (const hero of this.heros) {
      hero.bonusGroupe = hero.estAuCombat ? this.affinites.bonus(hero.identifiant, auCombat) : 0;
    }
  }

  /**
   * La formation et les ancres, recalculees une fois par image pour toute
   * l'equipe — jamais heros par heros (regle 5 du §4.17).
   *
   * L'ancre de la formation, c'est le heros incarne : le joueur deplace donc
   * toute sa ligne en se deplacant lui-meme (DESIGN.md §4.4).
   */
  private majCommandement(): void {
    const sbires = this.sbires;
    this.commandement.suivreLesProteges(sbires);

    const ancre = this.hero?.estVivant ? { x: this.hero.x, y: this.hero.y } : CITE;
    const menace = this.ennemiLePlusProche(ancre.x, ancre.y, 900);
    this.commandement.majPostes(
      ancre,
      menace ? { x: menace.x, y: menace.y } : null,
      this.hero ?? null,
    );

    this.dessinerOrdres();
  }

  /**
   * Un seul objet Graphics, efface et redessine (regle 3 du §4.17) : le joueur
   * doit voir d'un coup d'oeil qui il commande et ou il l'envoie.
   */
  private dessinerOrdres(): void {
    const g = this.graphiquesOrdres;
    g.clear();

    for (const hero of this.heros) {
      if (!hero.estVivant) continue;

      if (this.commandement.estSelectionne(hero)) {
        g.lineStyle(1, 0x5ec8f0, 0.9);
        g.strokeEllipse(hero.x, hero.y + 6, 20, 10);
      }

      // Le trait ne se dessine que pour une position donnee a la main : les
      // postes de formation en tracerait un par heros a chaque image, pour rien.
      const ancre = hero.ordre.ancre;
      if (!ancre) continue;
      const couleur = hero.protege ? 0x7ee0a0 : 0x5ec8f0;
      g.lineStyle(1, couleur, 0.25);
      g.lineBetween(hero.x, hero.y, ancre.x, ancre.y);
      g.lineStyle(1, couleur, 0.7);
      g.strokeCircle(ancre.x, ancre.y, 7);
    }
  }

  /**
   * Les competences qui dependent de l'etat de l'equipe entiere : Presage,
   * Serment du protecteur, Le dernier debout, Serment de fer.
   */
  private majContexteEquipe(): void {
    const vivants = this.heros.filter((h) => h.etat !== "mort");
    const presage = Math.max(0, ...this.heros.map((h) => h.bonus.presage));
    const absents = vivants.filter((h) => h.etat !== "combat").length + (this.heros.length - vivants.length);

    for (const hero of this.heros) {
      hero.esquiveTemporaire = presage;
      hero.alliesAbsents = Math.max(0, absents - (hero.estAuCombat ? 0 : 1));
      hero.presCite =
        Phaser.Math.Distance.Between(hero.x, hero.y, CITE.x, CITE.y) <= CITE.rayon + 260;

      const gagne = hero.verifierSermentDeFer();
      if (gagne > 0) this.flotter(hero.x, hero.y - 26, `Serment +${gagne}`, "#8ec9ff");
    }
  }

  /** Aura de flammes et Eclats : les armes qui se battent toutes seules. */
  private majAuras(): void {
    if (this.time.now >= this.prochainTickAuras) {
      this.prochainTickAuras = this.time.now + 500;
      for (const hero of this.heros) {
        if (hero.bonus.auraFeu <= 0 || !hero.estAuCombat) continue;
        this.aura(hero.x, hero.y, 9, 0xff8a3d, 400);
        for (const e of this.ennemisDansRayon(hero.x, hero.y, 72)) {
          this.blesserEnnemi(e, Math.max(1, Math.round(hero.bonus.auraFeu / 2)), hero);
        }
      }
    }

    if (this.time.now < this.prochainTickEclats) return;
    this.prochainTickEclats = this.time.now + 1800;
    for (const hero of this.heros) {
      if (hero.bonus.eclats <= 0 || !hero.estAuCombat) continue;
      for (let i = 0; i < hero.bonus.eclats; i++) {
        const angle = this.rng.range(0, Math.PI * 2);
        const p = this.projectiles.create(hero.x, hero.y, "projectile") as Phaser.Physics.Arcade.Image;
        p.setTint(0xfff0a0).setScale(0.8).setDepth(hero.y + 1);
        p.setData("auteur", hero);
        p.setVelocity(Math.cos(angle) * 260, Math.sin(angle) * 260);
        this.time.delayedCall(1100, () => p.destroy());
      }
    }
  }

  /**
   * Les invocations se battent toutes seules : mort-vivants, familier, double.
   * Elles cherchent l'ennemi le plus proche et lui foncent dessus.
   */
  private majInvocations(): void {
    // Le familier du mage est permanent : s'il tombe, il revient.
    for (const hero of this.heros) {
      if (hero.bonus.familier <= 0 || hero.etat === "mort") continue;
      const vivant = (this.invocations.getChildren() as Invocation[]).some(
        (i) => i.active && i instanceof Familier && i.maitre === hero,
      );
      if (vivant) continue;
      const retour = this.retourFamilier.get(hero) ?? 0;
      if (this.time.now < retour) continue;
      this.invocations.add(new Familier(this, hero.x + 24, hero.y, hero));
    }

    for (const objet of [...this.invocations.getChildren()] as Invocation[]) {
      if (!objet.active) continue;
      if (this.time.now > objet.finDeVie) {
        this.detruireInvocation(objet);
        continue;
      }
      objet.setDepth(objet.y);
      if (objet.vitesse <= 0) {
        objet.setVelocity(0, 0);
        continue;
      }

      // Sans ancre, il tient la position de son maitre : le meme systeme
      // d'ordres que les heros IA (DESIGN.md §4.4 et §4.14).
      const ancre: Point = objet.ordre.ancre ?? { x: objet.maitre.x, y: objet.maitre.y };
      const reglage = REGLAGES[objet.ordre.posture];
      const distanceAncre = Phaser.Math.Distance.Between(objet.x, objet.y, ancre.x, ancre.y);

      // Le spectre acheve en priorite ce qui agonise.
      const cible =
        objet.ordre.posture === "repli"
          ? null
          : ((objet.seuilExecution > 0
              ? this.ennemisDansRayon(objet.x, objet.y, 460).find(
                  (e) => e.pv / e.pvMax <= objet.seuilExecution,
                )
              : null) ?? this.ennemiLePlusProche(objet.x, objet.y, 900));

      // Rien a poursuivre, ou trop loin de sa position : il y retourne.
      if (!cible || distanceAncre > reglage.laisse) {
        if (distanceAncre <= TOLERANCE_ANCRE) {
          objet.setVelocity(0, 0);
          continue;
        }
        const retour = Phaser.Math.Angle.Between(objet.x, objet.y, ancre.x, ancre.y);
        objet.setVelocity(Math.cos(retour) * objet.vitesse, Math.sin(retour) * objet.vitesse);
        objet.setFlipX(ancre.x < objet.x);
        continue;
      }

      const angle = Phaser.Math.Angle.Between(objet.x, objet.y, cible.x, cible.y);
      objet.setVelocity(Math.cos(angle) * objet.vitesse, Math.sin(angle) * objet.vitesse);
      objet.setFlipX(cible.x < objet.x);
    }
  }

  private melee(invoque: Invocation, e: Ennemi): void {
    if (!invoque.active || !e.active || this.enPause) return;
    if (!invoque.peutFrapper(this.time.now)) return;
    invoque.marquerCoup(this.time.now);

    if (invoque.degats > 0) {
      // Le spectre execute ce qui est deja a l'agonie.
      const acheve = invoque.seuilExecution > 0 && e.pv / e.pvMax <= invoque.seuilExecution;
      this.blesserEnnemi(e, acheve ? e.pv : invoque.degats, invoque.maitre);
      if (acheve) this.flotter(e.x, e.y - 16, "ACHEVE", "#9fd8ff");
    }

    invoque.pv -= e.degats;
    invoque.setTintFill(0xffffff);
    this.time.delayedCall(60, () => invoque.active && invoque.clearTint());
    if (invoque.pv <= 0) this.detruireInvocation(invoque);
  }

  private detruireInvocation(invoque: Invocation): void {
    if (invoque.explosif) {
      this.effetCercle(invoque.x, invoque.y, 80, 0x9ee8a0);
      for (const e of this.ennemisDansRayon(invoque.x, invoque.y, 80)) {
        this.blesserEnnemi(e, Math.max(invoque.degats * 2, invoque.maitre.degats * 2), invoque.maitre);
      }
    }
    // Le familier revient au bout d'un moment : il est permanent.
    if (invoque instanceof Familier) {
      this.retourFamilier.set(invoque.maitre, this.time.now + 12000);
    }
    for (const objet of this.ennemis.getChildren()) {
      const e = objet as Ennemi;
      if (e.attirePar === invoque) e.attirePar = null;
    }
    invoque.destroy();
  }

  /** Le golem et le double de l'assassin attirent les ennemis sur eux. */
  private majProvocationInvocations(): void {
    const provocateurs = (this.invocations.getChildren() as Invocation[]).filter(
      (i) => i.active && i.provoque,
    );

    for (const objet of this.ennemis.getChildren()) {
      const e = objet as Ennemi;
      if (e.attirePar && !e.attirePar.active) e.attirePar = null;
      if (e.attirePar) continue;
      const proche = provocateurs.find(
        (i) => Phaser.Math.Distance.Between(e.x, e.y, i.x, i.y) <= 200,
      );
      if (proche) e.attirePar = proche;
    }
  }

  /**
   * Un cadavre a une chance de se relever pour le Necromancien.
   *
   * Le taux de base est volontairement bas : a 25%, l'armee devenait un mur
   * qui jouait la partie a la place du joueur. C'est aux competences de le
   * faire monter, et ca reste plafonne pour que l'ecran reste lisible.
   */
  private tenterRelevement(x: number, y: number): void {
    for (const hero of this.heros) {
      if (hero.etat === "mort") continue;
      const chance =
        (hero.classe.trait === "necromancie" ? 0.08 : 0) + hero.bonus.chanceRelevement;
      if (chance <= 0) continue;

      const siens = (this.invocations.getChildren() as Invocation[]).filter(
        (i) => i.active && i instanceof MortVivant && i.maitre === hero,
      ).length;
      if (siens >= MAX_MORTS_VIVANTS) continue;

      if (this.rng.next() >= chance) continue;
      this.relever(hero, x, y);
      return;
    }
  }

  private relever(maitre: Hero, x: number, y: number): void {
    const mort = new MortVivant(this, x, y, maitre);
    this.invocations.add(mort);
    this.effetCercle(x, y, 34, 0x9ee8a0);
  }

  private majEtats(delta: number): void {
    for (const hero of this.heros) {
      if (hero.etat === "mort") continue;

      const dansCite = Phaser.Math.Distance.Between(hero.x, hero.y, CITE.x, CITE.y) <= CITE.rayon;

      if (dansCite) {
        hero.etat = "cite";
        hero.soigner((REGENERATION * delta) / 1000);
      } else if (hero.estIncarne) {
        // Reprendre un heros en fuite le remet au combat : c'est le joueur qui
        // decide de faire demi-tour, et c'est comme ca qu'on perd un heros.
        hero.etat = "combat";
      } else if (hero.estCritique) {
        // Repli automatique : l'IA ne perd jamais un heros.
        if (hero.etat !== "repli") this.flotter(hero.x, hero.y - 24, "Repli !", "#e6a23c");
        hero.etat = "repli";
      } else if (hero.etat !== "repli") {
        hero.etat = "combat";
      }

      hero.setAlpha(hero.estInvisible ? 0.35 : hero.etat === "repli" ? 0.75 : 1);
    }
  }

  /**
   * Provocation du Chevalier Sacre : tout ce qui l'entoure ne voit plus que
   * lui, et chaque ennemi qui le cible le rend plus dur.
   */
  private majProvocation(): void {
    for (const objet of this.ennemis.getChildren()) (objet as Ennemi).provoquePar = null;

    for (const hero of this.heros) {
      hero.resistanceTemporaire = 0;
      if (hero.bonus.provocation <= 0 || !hero.estAuCombat) continue;
      const autour = this.ennemisDansRayon(hero.x, hero.y, hero.bonus.provocation);
      for (const e of autour) e.provoquePar = hero;
      hero.resistanceTemporaire = autour.length;
    }
  }

  /**
   * Armes en orbite : les satellites du mage et les epees tournoyantes.
   * Elles se battent toutes seules — c'est ce qui donne le sentiment de monter
   * en puissance sans ajouter une touche de plus (DESIGN.md §4.13).
   */
  private majOrbiteurs(): void {
    for (const hero of this.heros) {
      const satellites = hero.etat === "mort" ? 0 : hero.bonus.satellites;
      const epees = hero.etat === "mort" ? 0 : hero.bonus.epees;
      const voulu = satellites + epees;

      const liste = this.orbiteurs.get(hero) ?? [];
      while (liste.length < voulu) liste.push(this.add.image(hero.x, hero.y, "projectile"));
      while (liste.length > voulu) liste.pop()?.destroy();
      this.orbiteurs.set(hero, liste);

      liste.forEach((objet, i) => {
        const estEpee = i >= satellites;
        const rayon = estEpee ? 62 : 48;
        const vitesse = estEpee ? 380 : 520;
        const angle = this.time.now / vitesse + (i / Math.max(1, voulu)) * Math.PI * 2;
        const teinte = estEpee
          ? hero.bonus.epeeArdente
            ? 0xff8a3d
            : 0xd5dbe3
          : hero.bonus.satelliteFeu
            ? 0xff8a3d
            : hero.bonus.satelliteGlace
              ? 0x8ed6ff
              : 0xd06bff;

        objet
          .setPosition(hero.x + Math.cos(angle) * rayon, hero.y + Math.sin(angle) * rayon)
          .setScale(estEpee ? 1.6 : 1.2)
          .setTint(teinte)
          .setDepth(hero.y + 2);
      });
    }

    if (this.time.now < this.prochainTickOrbiteurs) return;
    this.prochainTickOrbiteurs = this.time.now + 260;

    for (const [hero, liste] of this.orbiteurs) {
      if (hero.etat === "mort" || liste.length === 0) continue;
      const satellites = hero.bonus.satellites;
      liste.forEach((objet, i) => {
        const estEpee = i >= satellites;
        const degats = estEpee
          ? Math.round(hero.degats * (hero.bonus.epeeArdente ? 1.2 : 0.6))
          : Math.round(hero.degats * (hero.bonus.satelliteFeu ? 0.8 : 0.4));
        for (const e of this.ennemisDansRayon(objet.x, objet.y, estEpee ? 24 : 18)) {
          if (!estEpee && hero.bonus.satelliteGlace) e.ralentir(1200);
          this.blesserEnnemi(e, degats, hero);
        }
      });
    }
  }

  private deplacerHeroIncarne(): void {
    const hero = this.hero;
    if (!hero || hero.etat === "mort") return;

    if (hero.estImmobilise) {
      hero.setVelocity(0, 0);
      return;
    }

    const dir = new Phaser.Math.Vector2(0, 0);
    if (this.zqsd["Q"]?.isDown || this.fleches.left.isDown) dir.x -= 1;
    if (this.zqsd["D"]?.isDown || this.fleches.right.isDown) dir.x += 1;
    if (this.zqsd["Z"]?.isDown || this.fleches.up.isDown) dir.y -= 1;
    if (this.zqsd["S"]?.isDown || this.fleches.down.isDown) dir.y += 1;

    if (dir.lengthSq() > 0) {
      this.effacerDestination();
    } else if (this.destination) {
      const distance = Phaser.Math.Distance.Between(
        hero.x,
        hero.y,
        this.destination.x,
        this.destination.y,
      );
      if (distance < 6) this.effacerDestination();
      else dir.set(this.destination.x - hero.x, this.destination.y - hero.y);
    }

    dir.normalize();
    if (dir.lengthSq() > 0) {
      hero.regard.copy(dir);
      if (dir.x !== 0) hero.setFlipX(dir.x < 0);
    }
    hero.setVelocity(dir.x * hero.vitesse, dir.y * hero.vitesse);

    if (hero.estCritique && Math.floor(this.time.now / 140) % 2 === 0) hero.setAlpha(0.55);
  }

  private deplacerHerosIA(): void {
    const contexte: ContexteIA = {
      cite: CITE,
      ennemiLePlusProche: (x, y, portee) => this.ennemiLePlusProche(x, y, portee),
      nombreEnnemisAutour: (x, y, rayon) => this.ennemisDansRayon(x, y, rayon).length,
    };

    for (const hero of this.heros) {
      if (hero.estIncarne || hero.etat === "mort") continue;
      if (hero.estImmobilise) {
        hero.setVelocity(0, 0);
        continue;
      }

      const { direction, lancerUltime } = piloter(hero, contexte);
      // Un heros qui decroche court plus vite : c'est ce qui rend le repli
      // credible plutot que suicidaire.
      const vitesse = hero.vitesse * (hero.etat === "repli" ? 1.35 : 1);
      hero.setVelocity(direction.x * vitesse, direction.y * vitesse);
      if (direction.x !== 0) hero.setFlipX(direction.x < 0);
      if (direction.x !== 0 || direction.y !== 0) hero.regard.set(direction.x, direction.y);

      if (lancerUltime && hero.etat === "combat") {
        // L'IA lance la premiere capacite prete. Elle ne choisit jamais
        // d'amelioration, mais elle sait se servir de ce qu'elle a.
        const prete = hero.capacites.find((c) => !c.automatique && hero.peutLancer(c));
        if (prete) this.lancerCapacite(hero, prete);
      }
    }
  }

  private deplacerEnnemis(): void {
    // Calcule une seule fois par image : c'etait refait pour chaque ennemi.
    this.ciblesPossibles = this.heros.filter((h) => h.estAuCombat && !h.estInvisible);

    for (const objet of this.ennemis.getChildren()) {
      const e = objet as Ennemi;
      if (!e.active) continue;

      const cible = this.cibleDe(e) ?? CITE;
      const angle = Phaser.Math.Angle.Between(e.x, e.y, cible.x, cible.y);
      e.setVelocity(Math.cos(angle) * e.vitesseEffective, Math.sin(angle) * e.vitesseEffective);
      e.setFlipX(cible.x < e.x);
      if (this.time.now < e.flashJusqua) {
        e.setTintFill(0xffffff);
      } else if (e.souscontrat) {
        // Un ennemi sous contrat reste marque en rouge jusqu'a la fin.
        e.setTint(0xff3b30);
      } else {
        e.setTint(this.time.now < e.ralentiJusqua ? 0x8ed6ff : 0xffffff);
      }

      this.bloquerParLesDomes(e);
    }
  }

  /**
   * Qui un ennemi vise. Trois regles se superposent :
   * la Provocation force sa cible, l'invisibilite retire une cible, et la
   * discretion de l'assassin le fait passer apres les autres.
   */
  private cibleDe(e: Ennemi): { x: number; y: number } | null {
    // Une invocation provocatrice passe avant tout le reste.
    if (e.attirePar?.active && !e.attirePar.furtif) return e.attirePar;
    if (e.provoquePar?.estAuCombat && !e.provoquePar.estInvisible) return e.provoquePar;

    const candidats = this.ciblesPossibles;
    if (candidats.length === 0) return null;

    // Un simple parcours : trier a chaque image pour chaque ennemi coutait
    // beaucoup plus cher que le probleme ne le meritait.
    let premier: Hero | null = null;
    let meilleure = Infinity;
    let expose: Hero | null = null;
    let meilleureExpose = Infinity;

    for (const h of candidats) {
      const d = Phaser.Math.Distance.Between(e.x, e.y, h.x, h.y);
      if (d < meilleure) {
        meilleure = d;
        premier = h;
      }
      // L'assassin n'est vise qu'a defaut d'une autre cible a portee raisonnable.
      if (!h.bonus.discretion && d < 220 && d < meilleureExpose) {
        meilleureExpose = d;
        expose = h;
      }
    }

    if (premier?.bonus.discretion && expose) return expose;
    return premier;
  }

  private bloquerParLesDomes(e: Ennemi): void {
    for (const dome of this.domes) {
      const distance = Phaser.Math.Distance.Between(e.x, e.y, dome.x, dome.y);
      if (distance > dome.rayon) continue;

      // Repousse l'ennemi hors du dome et l'y fait taper.
      const angle = Phaser.Math.Angle.Between(dome.x, dome.y, e.x, e.y);
      e.setPosition(dome.x + Math.cos(angle) * dome.rayon, dome.y + Math.sin(angle) * dome.rayon);
      if (!e.peutFrapper(this.time.now)) continue;
      e.marquerCoup(this.time.now);
      dome.pv -= e.degats;
      dome.image.setAlpha(0.15 + 0.3 * (dome.pv / dome.pvMax));
      if (dome.pv <= 0) this.detruireDome(dome);
    }
  }

  private detruireDome(dome: Dome): void {
    this.effetCercle(dome.x, dome.y, dome.rayon, 0x8ed6ff);
    dome.image.destroy();
    this.domes = this.domes.filter((d) => d !== dome);
  }

  private trierProfondeurs(): void {
    for (const hero of this.heros) hero.setDepth(hero.y);
    for (const objet of this.ennemis.getChildren()) {
      const e = objet as Ennemi;
      e.setDepth(e.y);
    }
  }

  // ------------------------------------------------------------- attaques

  private attaquerAvec(hero: Hero): void {
    if (hero.etat !== "combat" || hero.estImmobilise || !hero.peutAttaquer()) return;

    // Contrat : tant qu'il court, l'assassin ne peut viser personne d'autre.
    const contrat = this.contrats.get(hero);
    const cible = contrat
      ? contrat.active &&
        Phaser.Math.Distance.Between(hero.x, hero.y, contrat.x, contrat.y) <= hero.portee
        ? contrat
        : null
      : this.ennemiLePlusProche(hero.x, hero.y, hero.portee);
    if (!cible) return;

    hero.marquerAttaque();
    if (hero.portee <= PORTEE_CORPS_A_CORPS) this.frapperAuContact(hero, cible);
    else this.lancerProjectile(hero, cible);

    // Trait de l'Oracle : chacune de ses attaques recoud l'allie le plus
    // mal en point autour d'elle. Elle soigne en se battant.
    if (hero.classe.trait === "soin-de-zone") this.soignerLePlusBlesse(hero, 240, 4);
  }

  private soignerLePlusBlesse(source: Hero, rayon: number, montant: number): void {
    let cible: Hero | null = null;
    for (const allie of this.heros) {
      if (allie.etat === "mort" || allie.ratioPv >= 1) continue;
      if (Phaser.Math.Distance.Between(source.x, source.y, allie.x, allie.y) > rayon) continue;
      if (!cible || allie.ratioPv < cible.ratioPv) cible = allie;
    }
    if (!cible) return;
    // Volontairement sans nombre flottant : ce soin part a chaque attaque de
    // l'Oracle, et l'afficher noyait l'ecran.
    cible.soigner(montant);
  }

  private frapperAuContact(hero: Hero, cible: Ennemi): void {
    const portee = hero.portee;
    const angle = Phaser.Math.Angle.Between(hero.x, hero.y, cible.x, cible.y);
    // Trait "arc-large" du guerrier : il fauche un demi-cercle entier.
    const demiArc = hero.classe.trait === "arc-large" ? Math.PI / 2 : Math.PI / 4;

    for (const e of [...this.ennemis.getChildren()] as Ennemi[]) {
      if (!e.active) continue;
      const d = Phaser.Math.Distance.Between(hero.x, hero.y, e.x, e.y);
      if (d > portee) continue;
      const a = Phaser.Math.Angle.Between(hero.x, hero.y, e.x, e.y);
      if (Math.abs(Phaser.Math.Angle.Wrap(a - angle)) > demiArc) continue;
      this.frapper(hero, e);
    }

    const arc = this.add
      .image(
        hero.x + Math.cos(angle) * portee * 0.5,
        hero.y + Math.sin(angle) * portee * 0.5,
        "impact",
      )
      .setDepth(hero.y + 1)
      .setScale(portee / 22)
      .setAlpha(0.45)
      .setTint(0xffe9a8);
    this.tweens.add({ targets: arc, alpha: 0, duration: 150, onComplete: () => arc.destroy() });
  }

  private lancerProjectile(hero: Hero, cible: Ennemi): void {
    const angle = Phaser.Math.Angle.Between(hero.x, hero.y, cible.x, cible.y);
    // Trait du Rodeur : une volee en eventail plutot qu'un seul trait.
    const nombre =
      hero.classe.trait === "volee" ? 3 + hero.bonus.flechesSupplementaires : 1;

    for (let i = 0; i < nombre; i++) {
      const ecart = (i - (nombre - 1) / 2) * 0.15;
      this.tirer(hero, angle + ecart);
    }
  }

  private tirer(hero: Hero, angle: number): void {
    const p = this.projectiles.create(hero.x, hero.y, "projectile") as Phaser.Physics.Arcade.Image;
    p.setDepth(hero.y + 1);
    p.setTint(hero.classe.accent);
    p.setData("auteur", hero);
    p.setVelocity(Math.cos(angle) * 340, Math.sin(angle) * 340);
    this.time.delayedCall(1400, () => p.destroy());
  }

  private impactProjectile(p: Phaser.Physics.Arcade.Image, e: Ennemi): void {
    if (!p.active || !e.active) return;
    const auteur = p.getData("auteur") as Hero | undefined;
    if (!auteur || auteur.etat === "mort") {
      p.destroy();
      return;
    }

    // Un projectile perforant traverse : il faut se souvenir de qui il a deja
    // touche, sinon il blesse la meme cible a chaque image.
    const touches = (p.getData("touches") as Set<Ennemi> | undefined) ?? new Set<Ennemi>();
    if (touches.has(e)) return;
    touches.add(e);
    p.setData("touches", touches);

    if (auteur.classe.trait === "explosion") {
      // Trait du mage : chaque tir souffle un groupe entier.
      this.effetCercle(p.x, p.y, 48, 0xd06bff);
      for (const voisin of this.ennemisDansRayon(p.x, p.y, 48)) this.frapper(auteur, voisin);
    } else {
      this.frapper(auteur, e);
    }

    if (!auteur.bonus.perforant) p.destroy();
  }

  private frapper(auteur: Hero, e: Ennemi): void {
    const marque = auteur.multiplicateurContre(e);
    const critique = this.rng.next() < auteur.critChance;
    let degats = critique ? auteur.degats * auteur.critMultiplicateur : auteur.degats;
    degats = Math.round(degats * marque);

    if (marque > 1) this.flotter(e.x, e.y - 18, "MARQUE", "#ff6b5a");
    else if (critique && auteur.estIncarne) this.flotter(e.x, e.y - 14, `${degats} !`, "#ffd166");

    this.blesserEnnemi(e, degats, auteur);
    this.propagerEclairs(auteur, e.x, e.y, e, degats);
  }

  /** Chaine d'eclairs : l'attaque saute d'un ennemi a l'autre. */
  private propagerEclairs(
    auteur: Hero,
    x: number,
    y: number,
    origine: Ennemi,
    degats: number,
  ): void {
    if (auteur.bonus.chaineEclairs <= 0) return;

    const sauts = auteur.bonus.chaineDiffuse
      ? 8
      : auteur.bonus.chaineFulgurante
        ? 2
        : auteur.bonus.chaineEclairs;
    const touches = new Set<Ennemi>([origine]);
    let depuis = { x, y };
    let force = degats;

    for (let i = 0; i < sauts; i++) {
      force *= auteur.bonus.chaineDiffuse ? 0.55 : auteur.bonus.chaineFulgurante ? 1.6 : 0.8;
      const suivant = this.ennemisDansRayon(depuis.x, depuis.y, 130).find((e) => !touches.has(e));
      if (!suivant) return;

      touches.add(suivant);
      this.trainee(depuis.x, depuis.y, suivant.x, suivant.y, 0x8ed6ff);
      depuis = { x: suivant.x, y: suivant.y };
      this.blesserEnnemi(suivant, Math.max(1, Math.round(force)), auteur);
    }
  }

  private ennemiLePlusProche(x: number, y: number, portee: number): Ennemi | null {
    let meilleur: Ennemi | null = null;
    let meilleureDistance = portee;
    for (const objet of this.ennemis.getChildren()) {
      const e = objet as Ennemi;
      if (!e.active) continue;
      const d = Phaser.Math.Distance.Between(x, y, e.x, e.y);
      if (d < meilleureDistance) {
        meilleureDistance = d;
        meilleur = e;
      }
    }
    return meilleur;
  }

  private blesserEnnemi(e: Ennemi, degats: number, auteur: Hero, volDeVieSup = 0): void {
    if (!e.active) return;
    const inflige = Math.min(degats, e.pv);
    e.pv -= degats;
    // Pas de minuterie ici : avec les degats de zone et les chaines, on en
    // creait des centaines par seconde. Un simple horodatage suffit.
    e.setTintFill(0xffffff);
    e.flashJusqua = this.time.now + 70;

    const vol = auteur.volDeVie + volDeVieSup;
    if (vol > 0) auteur.soigner(inflige * vol);

    if (e.pv > 0) return;
    this.tuer(e, auteur);
  }

  private tuer(e: Ennemi, auteur: Hero): void {
    this.kills += 1;
    auteur.kills += 1;
    if (auteur.bonus.soinParKill > 0) auteur.soigner(auteur.bonus.soinParKill);

    // Sang pour sang : il refuse tout soin, mais chaque mort le remet debout.
    if (auteur.bonus.sangPourSang > 0) {
      auteur.soignerForce(auteur.pvMax * auteur.bonus.sangPourSang);
    }
    // Charognard : le cadavre laisse parfois de quoi tenir.
    if (auteur.bonus.charognard > 0 && this.rng.next() < auteur.bonus.charognard) {
      auteur.soigner(Math.round(auteur.pvMax * 0.06));
      this.flotter(e.x, e.y - 14, "Butin", "#7ee0a0");
    }
    // Danse des ombres : chaque mort raccourcit tous ses rechargements.
    if (auteur.bonus.danseDesOmbres > 0) auteur.reduireRechargements(auteur.bonus.danseDesOmbres);

    // Provocation : chaque mort a ses pieds remet le Chevalier Sacre debout.
    for (const hero of this.heros) {
      if (hero.bonus.provocation <= 0) continue;
      if (Phaser.Math.Distance.Between(hero.x, hero.y, e.x, e.y) <= hero.bonus.provocation) {
        hero.soigner(1);
      }
    }

    const x = e.x;
    const y = e.y;

    // L'XP va au heros qui a tue, pas a l'equipe (DESIGN.md §4.5).
    const monte = auteur.gagnerXp(e.xpDonnee);
    e.destroy();
    // Le cadavre peut se relever pour le Necromancien (DESIGN.md §4.14).
    this.tenterRelevement(x, y);
    if (monte) this.monterDeNiveau(auteur);
  }

  // ---------------------------------------------------------- progression

  private monterDeNiveau(hero: Hero): void {
    this.flotter(hero.x, hero.y - 24, `NIVEAU ${hero.niveau}`, "#5ec8f0");
    this.effetCercle(hero.x, hero.y, 70, 0x5ec8f0);
    // Seul le heros incarne interrompt la partie. Ceux joues par l'IA
    // accumulent leurs choix, sinon la vague serait hachee en permanence.
    if (hero.estIncarne && hero.choixEnAttente > 0 && !this.enPause) this.ouvrirChoix();
  }

  private ouvrirChoix(): void {
    this.enPause = true;
    this.debutPause = this.time.now;
    this.physics.pause();
    this.effacerDestination();
    this.modeChoix = "competence";

    const hero = this.hero;
    const defs = tirerCompetences(
      this.rng,
      hero.classe.id,
      hero.competences,
      3,
      // Passera au rang du heros quand les rangs existeront (DESIGN.md §4.1).
      0,
    );
    this.events.emit(
      "choix",
      `NIVEAU ${hero.niveau}`,
      `${hero.classe.nom} — choisis une competence`,
      defs.map((d) => propositionCompetence(d, hero.competences)),
    );
  }

  private resoudreChoix(id: string): void {
    const hero = this.hero;

    if (this.modeChoix === "evolution") {
      const evolution = this.optionsEvolution.find((o) => o.id === id);
      if (evolution && this.competenceEnEvolution) {
        hero.appliquerEvolution(this.competenceEnEvolution.id, evolution);
        this.flotter(hero.x, hero.y - 30, evolution.nom.toUpperCase(), "#f0c419");
      }
      this.competenceEnEvolution = null;
      this.optionsEvolution = [];
      this.terminerChoix();
      return;
    }

    const def = competenceParId(id);
    if (!def) {
      this.terminerChoix();
      return;
    }

    const evolutions = hero.apprendre(def);
    // Veteran : un niveau offert immediatement.
    if (def.id === "veteran") {
      hero.gagnerNiveauImmediat();
      this.flotter(hero.x, hero.y - 30, `NIVEAU ${hero.niveau}`, "#5ec8f0");
    }
    if (evolutions) {
      // La competence change de nature : un second choix s'ouvre, toujours en
      // pause (DESIGN.md §4.13).
      this.modeChoix = "evolution";
      this.competenceEnEvolution = def;
      this.optionsEvolution = evolutions;
      this.events.emit(
        "choix",
        "EVOLUTION",
        `${def.nom} peut changer de nature`,
        evolutions.map((e) => propositionEvolution(def, e)),
      );
      return;
    }

    this.terminerChoix();
  }

  private terminerChoix(): void {
    // Sans ce decalage, le temps passe dans le menu rechargerait tout.
    const pause = this.time.now - this.debutPause;
    for (const hero of this.heros) hero.decalerRechargements(pause);
    this.physics.resume();
    this.enPause = false;
    if (this.hero.choixEnAttente > 0) this.ouvrirChoix();
  }

  // ------------------------------------------------------------- capacites

  private gererCapacites(): void {
    const hero = this.hero;
    if (!hero || hero.etat === "mort") return;

    hero.capacites.forEach((capacite, i) => {
      if (capacite.automatique) return;
      const touches = this.touchesCapacites[i];
      if (!touches || !touches.some((t) => Phaser.Input.Keyboard.JustDown(t))) return;
      if (!hero.peutLancer(capacite)) return;
      this.lancerCapacite(hero, capacite);
    });
  }

  private gererCapacitesAuto(): void {
    for (const hero of this.heros) {
      if (hero.etat === "mort" || hero.estImmobilise) continue;
      for (const capacite of hero.capacites) {
        if (!capacite.automatique || !hero.peutLancer(capacite)) continue;
        this.lancerCapacite(hero, capacite);
      }
    }
  }

  private lancerCapacite(hero: Hero, capacite: Capacite): void {
    // Echo : la capacite peut ne pas partir en rechargement du tout.
    hero.marquerCapacite(capacite, this.rng.next());
    this.flotter(hero.x, hero.y - 28, capacite.nom.toUpperCase(), "#f0c419");

    switch (capacite.effet) {
      case "tourbillon":
        this.effetTourbillon(hero);
        break;
      case "rempart":
        this.effetRempart(hero);
        break;
      case "meteore":
        this.effetMeteore(hero);
        break;
      case "ombre":
        this.effetOmbre(hero);
        break;
      case "sursaut-sacre":
        this.effetSursautSacre(hero);
        break;
      case "benediction":
        this.effetBenediction(hero);
        break;
      case "moulinet":
      case "moulinet-aspirant":
      case "moulinet-sanglant":
        this.effetMoulinet(hero, capacite.effet);
        break;
      case "dome":
        this.effetDome(hero);
        break;
      case "exil":
        this.effetExil(hero);
        break;
      case "invisibilite":
        this.effetInvisibilite(hero);
        break;
      case "hecatombe":
        this.effetHecatombe(hero);
        break;
      case "pluie-de-fleches":
        this.effetPluieDeFleches(hero);
        break;
      case "aube":
        this.effetAube(hero);
        break;
      case "levee-des-morts":
        this.effetLeveeDesMorts(hero);
        break;
      case "martyre":
        this.effetMartyre(hero);
        break;
      case "piege":
        this.effetPiege(hero);
        break;
      case "fleche-du-jugement":
        this.effetFlecheDuJugement(hero);
        break;
      case "priere":
        this.effetPriere(hero);
        break;
      case "chant-de-guerre":
        this.effetChantDeGuerre(hero);
        break;
      case "appel-des-morts":
        this.effetAppelDesMorts(hero);
        break;
      case "orage-final":
        this.effetOrageFinal(hero);
        break;
      case "heure-sombre":
        this.effetHeureSombre(hero);
        break;
      case "jugement":
      case "jugement-croisade":
      case "jugement-absolution":
        this.effetJugement(hero, capacite.effet);
        break;
      case "bouclier-des-ames":
        this.effetBouclierDesAmes(hero);
        break;
      case "charge":
      case "charge-sismique":
      case "charge-sanglante":
        this.effetCharge(hero, capacite.effet);
        break;
      case "cri-de-guerre":
        this.effetCriDeGuerre(hero);
        break;
      case "clignement":
        this.effetClignement(hero);
        break;
      case "sablier":
        this.effetSablier(hero);
        break;
      case "croc-en-jambe":
        this.effetCrocEnJambe(hero);
        break;
      case "doppelganger":
        this.effetDoppelganger(hero);
        break;
      case "contrat":
        this.effetContrat(hero);
        break;
    }
  }

  // --- Chevalier Sacre : Jugement et Bouclier des ames ---

  private effetJugement(hero: Hero, variante: string): void {
    const palier = Math.max(1, hero.palierDe("jugement"));
    const rayon = 80 + palier * 15;

    if (variante === "jugement-croisade") {
      // La colonne ne reste plus au sol : elle le suit.
      this.time.addEvent({
        delay: 400,
        repeat: 14,
        callback: () => {
          if (hero.etat === "mort") return;
          this.effetCercle(hero.x, hero.y, rayon, 0xfff0a0);
          for (const e of this.ennemisDansRayon(hero.x, hero.y, rayon)) {
            this.blesserEnnemi(e, Math.round(hero.degats * 0.9), hero);
          }
        },
      });
      return;
    }

    const point = hero.estIncarne
      ? this.cameras.main.getWorldPoint(this.input.activePointer.x, this.input.activePointer.y)
      : this.pointDevant(hero, 100);

    if (variante === "jugement-absolution") {
      // La lumiere cesse de blesser : elle recoud.
      this.effetCercle(point.x, point.y, rayon, 0xa8ffc8);
      for (const allie of this.heros) {
        if (allie.etat === "mort") continue;
        if (Phaser.Math.Distance.Between(allie.x, allie.y, point.x, point.y) > rayon) continue;
        const soin = allie.pvMax * (0.15 + palier * 0.1);
        allie.soigner(soin);
        this.flotter(allie.x, allie.y - 22, `+${Math.round(soin)}`, "#7ee0a0");
      }
      return;
    }

    this.effetCercle(point.x, point.y, rayon, 0xfff0a0);
    this.trainee(point.x, point.y - 260, point.x, point.y, 0xfff0a0);
    if (hero.estIncarne) this.cameras.main.shake(160, 0.006);
    for (const e of this.ennemisDansRayon(point.x, point.y, rayon)) {
      this.blesserEnnemi(e, Math.round(hero.degats * (2.5 + palier)), hero);
    }
  }

  /**
   * Bouclier des ames : il donne de sa propre vie a ceux qui sont au plus mal.
   * Il ne cree rien — il deplace, et c'est ce qui rend la competence tendue.
   */
  private effetBouclierDesAmes(hero: Hero): void {
    const palier = Math.max(1, hero.palierDe("bouclier-des-ames"));
    const blesses = this.heros.filter(
      (h) => h !== hero && h.etat !== "mort" && h.ratioPv < 0.3,
    );
    if (blesses.length === 0) return;

    const don = Math.round(hero.pv * (0.1 + palier * 0.05));
    if (don < 1) return;
    hero.pv = Math.max(1, hero.pv - don);

    const part = Math.round(don / blesses.length);
    for (const allie of blesses) {
      allie.soigner(part);
      this.trainee(hero.x, hero.y, allie.x, allie.y, 0xffd166);
      this.flotter(allie.x, allie.y - 22, `+${part}`, "#ffd166");
    }
  }

  // --- Guerrier : Charge et Cri de guerre ---

  private effetCharge(hero: Hero, variante: string): void {
    const palier = Math.max(1, hero.palierDe("charge"));
    const distance = 220 + palier * 40;
    const depart = new Phaser.Math.Vector2(hero.x, hero.y);
    const arrivee = this.pointDevant(hero, distance);

    hero.rendreInvulnerable(400);
    this.trainee(depart.x, depart.y, arrivee.x, arrivee.y, 0xffc27a);
    this.faucherLeLong(hero, depart, arrivee, hero.degats * 2);
    hero.setPosition(arrivee.x, arrivee.y);

    if (variante === "charge-sismique") {
      this.effetCercle(arrivee.x, arrivee.y, 120, 0xc9a06b);
      this.cameras.main.shake(220, 0.008);
      for (const e of this.ennemisDansRayon(arrivee.x, arrivee.y, 120)) {
        this.repousser(e, arrivee.x, arrivee.y, 340);
        this.blesserEnnemi(e, hero.degats * 3, hero);
      }
    }

    if (variante === "charge-sanglante") {
      // Il traverse, puis revient aussitot sur ses pas.
      this.time.delayedCall(220, () => {
        if (hero.etat === "mort") return;
        this.trainee(arrivee.x, arrivee.y, depart.x, depart.y, 0xff8080);
        this.faucherLeLong(hero, arrivee, depart, hero.degats * 2);
        hero.setPosition(depart.x, depart.y);
      });
    }
  }

  private faucherLeLong(
    hero: Hero,
    depart: Phaser.Math.Vector2,
    arrivee: Phaser.Math.Vector2,
    degats: number,
  ): void {
    const segment = new Phaser.Geom.Line(depart.x, depart.y, arrivee.x, arrivee.y);
    for (const e of [...this.ennemis.getChildren()] as Ennemi[]) {
      if (!e.active) continue;
      const proche = Phaser.Geom.Line.GetNearestPoint(segment, e, new Phaser.Geom.Point());
      if (Phaser.Math.Distance.Between(proche.x, proche.y, e.x, e.y) > 48) continue;
      this.repousser(e, depart.x, depart.y, 260);
      this.blesserEnnemi(e, degats, hero);
    }
  }

  private effetCriDeGuerre(hero: Hero): void {
    const palier = Math.max(1, hero.palierDe("cri-de-guerre"));
    const duree = 4000 + palier * 2000;
    const gain = 1 + 0.1 + palier * 0.1;

    this.effetCercle(hero.x, hero.y, 220, 0xffd166);
    if (hero.estIncarne) this.cameras.main.shake(180, 0.005);
    for (const e of this.ennemisDansRayon(hero.x, hero.y, 220)) {
      this.repousser(e, hero.x, hero.y, 420);
      e.ralentir(1500, 0.6);
    }

    // L'equipe entiere frappe plus fort le temps du cri.
    for (const allie of this.heros) {
      if (allie.etat === "mort") continue;
      allie.bonus.multiplicateurDegats *= gain;
    }
    this.time.delayedCall(duree, () => {
      for (const allie of this.heros) allie.bonus.multiplicateurDegats /= gain;
    });
  }

  // --- Mage : Clignement et Sablier ---

  private effetClignement(hero: Hero): void {
    const palier = Math.max(1, hero.palierDe("clignement"));
    const depart = new Phaser.Math.Vector2(hero.x, hero.y);
    const vise = hero.estIncarne
      ? this.cameras.main.getWorldPoint(this.input.activePointer.x, this.input.activePointer.y)
      : this.pointDevant(hero, 200);

    const portee = 180 + palier * 60;
    const direction = new Phaser.Math.Vector2(vise.x - hero.x, vise.y - hero.y);
    if (direction.length() > portee) direction.setLength(portee);

    const arrivee = this.ramenerSurTerre(depart.x + direction.x, depart.y + direction.y);
    hero.setPosition(arrivee.x, arrivee.y);
    hero.rendreInvulnerable(300);

    // La deflagration reste a l'endroit qu'il quitte.
    this.effetCercle(depart.x, depart.y, 70 + palier * 15, 0xd06bff);
    for (const e of this.ennemisDansRayon(depart.x, depart.y, 70 + palier * 15)) {
      this.repousser(e, depart.x, depart.y, 240);
      this.blesserEnnemi(e, hero.degats * (1 + palier), hero);
    }
  }

  private effetSablier(hero: Hero): void {
    const palier = Math.max(1, hero.palierDe("sablier"));
    const duree = 3000 + palier * 2000;
    const facteur = palier >= 2 ? 0.25 : 0.4;
    const rayon = 240;

    this.aura(hero.x, hero.y, rayon / 8, 0x8ed6ff, duree);
    const x = hero.x;
    const y = hero.y;
    this.time.addEvent({
      delay: 300,
      repeat: Math.floor(duree / 300) - 1,
      callback: () => {
        for (const e of this.ennemisDansRayon(x, y, rayon)) e.ralentir(500, facteur);
      },
    });
  }

  // --- Assassin : Croc-en-jambe, Doppelganger, Contrat ---

  private effetCrocEnJambe(hero: Hero): void {
    const palier = Math.max(1, hero.palierDe("croc-en-jambe"));
    const rayon = 80 + palier * 20;
    const point = hero.estIncarne
      ? this.cameras.main.getWorldPoint(this.input.activePointer.x, this.input.activePointer.y)
      : this.pointDevant(hero, 80);

    const tapis = this.add
      .image(point.x, point.y, "impact")
      .setTint(0xb0a08a)
      .setAlpha(0.3)
      .setScale((rayon * 2) / 16)
      .setDepth(point.y - 4);

    this.time.addEvent({
      delay: 500,
      repeat: 11,
      callback: () => {
        for (const e of this.ennemisDansRayon(point.x, point.y, rayon)) {
          e.ralentir(600, 0.6);
          this.blesserEnnemi(e, Math.round(hero.degats * (0.4 + palier * 0.2)), hero);
        }
      },
    });
    this.time.delayedCall(6000, () => tapis.active && tapis.destroy());
  }

  private effetDoppelganger(hero: Hero): void {
    const palier = Math.max(1, hero.palierDe("doppelganger"));
    const double = new Double(this, hero.x, hero.y, hero, palier);
    this.invocations.add(double);
    this.effetCercle(hero.x, hero.y, 50, 0x9fd8ff);
  }

  /**
   * Contrat : la cible mourra, quoi qu'il arrive. En echange, l'assassin ne
   * peut plus toucher personne d'autre tant que le contrat court — c'est ce
   * renoncement qui en fait autre chose qu'un bouton "je gagne".
   */
  private effetContrat(hero: Hero): void {
    const palier = Math.max(1, hero.palierDe("contrat"));
    const delai = palier >= 2 ? 7000 : 10000;

    const candidats = this.ennemisDansRayon(hero.x, hero.y, 600);
    if (candidats.length === 0) {
      this.flotter(hero.x, hero.y - 20, "Personne a contracter", "#8a8397");
      return;
    }
    const cible = candidats.reduce((a, b) => (b.pv > a.pv ? b : a));

    cible.souscontrat = true;
    cible.setTint(0xff3b30);
    this.contrats.set(hero, cible);
    this.flotter(cible.x, cible.y - 22, "CONTRAT", "#ff3b30");

    this.time.delayedCall(delai, () => {
      this.contrats.delete(hero);
      if (!cible.active) return;
      this.flotter(cible.x, cible.y - 20, "HONORE", "#ff3b30");
      this.effetCercle(cible.x, cible.y, 70, 0xff3b30);
      this.blesserEnnemi(cible, cible.pv, hero);
    });
  }

  // --- Rodeur ---

  private effetPluieDeFleches(hero: Hero): void {
    const groupe = this.groupeLePlusDense(hero, 420, 120);
    if (!groupe) return;
    const x = groupe.x;
    const y = groupe.y;

    this.time.addEvent({
      delay: 180,
      repeat: 9,
      callback: () => {
        const px = x + this.rng.range(-110, 110);
        const py = y + this.rng.range(-110, 110);
        this.effetCercle(px, py, 34, 0xd8c48a);
        for (const e of this.ennemisDansRayon(px, py, 40)) {
          this.blesserEnnemi(e, Math.round(hero.degats * 1.1), hero);
        }
      },
    });
  }

  private effetPiege(hero: Hero): void {
    const palier = Math.max(1, hero.palierDe("piege"));
    const point = hero.estIncarne
      ? this.cameras.main.getWorldPoint(this.input.activePointer.x, this.input.activePointer.y)
      : this.pointDevant(hero, 90);

    const image = this.add
      .image(point.x, point.y, "impact")
      .setTint(0xb0a08a)
      .setAlpha(0.6)
      .setScale(2.4)
      .setDepth(point.y - 4);

    const surveiller = this.time.addEvent({
      delay: 120,
      repeat: 150,
      callback: () => {
        const pris = this.ennemisDansRayon(point.x, point.y, 34);
        if (pris.length === 0) return;
        for (const e of pris) {
          e.ralentir(1000 + palier * 1000);
          if (palier >= 2) this.blesserEnnemi(e, hero.degats * palier, hero);
        }
        this.effetCercle(point.x, point.y, 40, 0xb0a08a);
        image.destroy();
        surveiller.remove();
      },
    });
    this.time.delayedCall(18000, () => image.active && image.destroy());
  }

  private effetFlecheDuJugement(hero: Hero): void {
    const palier = Math.max(1, hero.palierDe("fleche-du-jugement"));
    const seuil = 0.25 + palier * 0.15;
    const arrivee = this.pointDevant(hero, 2000);
    this.trainee(hero.x, hero.y, arrivee.x, arrivee.y, 0xfff0a0);
    this.cameras.main.shake(220, 0.008);

    const segment = new Phaser.Geom.Line(hero.x, hero.y, arrivee.x, arrivee.y);
    for (const e of [...this.ennemis.getChildren()] as Ennemi[]) {
      if (!e.active) continue;
      const proche = Phaser.Geom.Line.GetNearestPoint(segment, e, new Phaser.Geom.Point());
      if (Phaser.Math.Distance.Between(proche.x, proche.y, e.x, e.y) > 56) continue;
      if (e.pv / e.pvMax <= seuil) {
        this.flotter(e.x, e.y - 16, "JUGE", "#fff0a0");
        this.blesserEnnemi(e, e.pv, hero);
      } else {
        this.blesserEnnemi(e, hero.degats * 3, hero);
      }
    }
  }

  // --- Oracle ---

  private effetAube(hero: Hero): void {
    this.cameras.main.flash(300, 255, 240, 200);
    for (const allie of this.heros) {
      if (allie.etat === "mort") continue;
      allie.soigner(allie.pvMax * 0.45);
      allie.rendreInvulnerable(1600);
      this.effetCercle(allie.x, allie.y, 70, 0xfff0c0);
    }
    void hero;
  }

  private effetPriere(hero: Hero): void {
    const palier = Math.max(1, hero.palierDe("priere"));
    let cible: Hero | null = null;
    for (const allie of this.heros) {
      if (allie.etat === "mort") continue;
      if (!cible || allie.ratioPv < cible.ratioPv) cible = allie;
    }
    if (!cible) return;
    const soin = cible.pvMax * (0.15 + palier * 0.1);
    cible.soigner(soin);
    this.effetCercle(cible.x, cible.y, 60, 0xfff0c0);
    this.flotter(cible.x, cible.y - 22, `+${Math.round(soin)}`, "#7ee0a0");
  }

  private effetChantDeGuerre(hero: Hero): void {
    const palier = Math.max(1, hero.palierDe("chant-de-guerre"));
    const duree = 7000 + palier * 1000;
    const facteur = palier >= 2 ? 0.55 : 0.7;

    for (const allie of this.heros) {
      if (allie.etat === "mort") continue;
      allie.cadenceTemporaire = facteur;
      this.effetCercle(allie.x, allie.y, 50, 0xffd166);
    }
    this.time.delayedCall(duree, () => {
      for (const allie of this.heros) allie.cadenceTemporaire = 1;
    });
  }

  // --- Chevalier Sacre ---

  /**
   * Martyre : pendant quelques secondes, il encaisse a la place de tout le
   * monde et ne peut pas mourir. C'est le sommet de sa classe : il transforme
   * un effondrement d'equipe en sursis.
   */
  private effetMartyre(hero: Hero): void {
    const palier = Math.max(1, hero.palierDe("martyre"));
    const duree = 5000 + palier * 3000;
    this.martyr = hero;
    hero.rendreInvulnerable(duree);
    this.aura(hero.x, hero.y, 5, 0xffd166, duree);
    this.time.delayedCall(duree, () => {
      if (this.martyr === hero) this.martyr = null;
    });
  }

  // --- Necromancien ---

  private effetLeveeDesMorts(hero: Hero): void {
    // Tous les ennemis proches tombent et se relevent de son cote.
    const proies = this.ennemisDansRayon(hero.x, hero.y, 600).slice(0, 8);
    for (const e of proies) {
      const x = e.x;
      const y = e.y;
      this.blesserEnnemi(e, e.pv, hero);
      this.relever(hero, x, y);
    }
    this.effetCercle(hero.x, hero.y, 180, 0x9ee8a0);
  }

  private effetAppelDesMorts(hero: Hero): void {
    const armee = (this.invocations.getChildren() as Invocation[]).filter(
      (i) => i.active && i instanceof MortVivant && i.maitre === hero,
    );
    if (armee.length === 0) {
      this.flotter(hero.x, hero.y - 20, "Aucun mort a appeler", "#8a8397");
      return;
    }

    let x = 0;
    let y = 0;
    for (const mort of armee) {
      x += mort.x;
      y += mort.y;
      mort.destroy();
    }

    const colosse = new MortVivant(this, x / armee.length, y / armee.length, hero);
    colosse.pvMax *= armee.length;
    colosse.pv = colosse.pvMax;
    colosse.degats *= Math.max(2, Math.round(armee.length / 2));
    colosse.vitesse *= 0.7;
    colosse.setScale(2.4);
    colosse.finDeVie = Infinity;
    this.invocations.add(colosse);

    this.effetCercle(colosse.x, colosse.y, 200, 0x9ee8a0);
    this.cameras.main.shake(400, 0.01);
  }

  // --- Communes de haut rang ---

  private effetOrageFinal(hero: Hero): void {
    const palier = Math.max(1, hero.palierDe("orage-final"));
    const duree = 6000 + palier * 4000;

    this.time.addEvent({
      delay: 400,
      repeat: Math.floor(duree / 400) - 1,
      callback: () => {
        if (hero.etat === "mort") return;
        const cible = this.ennemiLePlusProche(hero.x, hero.y, 280);
        const x = cible?.x ?? hero.x + this.rng.range(-160, 160);
        const y = cible?.y ?? hero.y + this.rng.range(-160, 160);
        this.trainee(x, y - 200, x, y, 0x8ed6ff);
        this.effetCercle(x, y, 60, 0x8ed6ff);
        for (const e of this.ennemisDansRayon(x, y, 60)) {
          this.blesserEnnemi(e, Math.round(hero.degats * 1.6), hero);
        }
      },
    });
  }

  /** Heure sombre : le temps s'arrete pour tout le monde sauf le joueur. */
  private effetHeureSombre(hero: Hero): void {
    const palier = Math.max(1, hero.palierDe("heure-sombre"));
    const duree = 1500 + palier * 1500;
    this.figeJusqua = this.time.now + duree;
    this.cameras.main.flash(200, 40, 20, 60);
    for (const objet of this.ennemis.getChildren()) (objet as Ennemi).setTint(0x6b6478);
    this.time.delayedCall(duree, () => {
      for (const objet of this.ennemis.getChildren()) (objet as Ennemi).clearTint();
    });
    void hero;
  }

  private groupeLePlusDense(hero: Hero, portee: number, rayon: number): Ennemi | null {
    const candidats = this.ennemisDansRayon(hero.x, hero.y, portee);
    if (candidats.length === 0) return null;
    let cible = candidats[0]!;
    let meilleur = -1;
    for (const e of candidats) {
      const compte = this.ennemisDansRayon(e.x, e.y, rayon).length;
      if (compte > meilleur) {
        meilleur = compte;
        cible = e;
      }
    }
    return cible;
  }

  // --- Ultimes de classe ---

  private effetTourbillon(hero: Hero): void {
    const rayon = 110;
    this.effetCercle(hero.x, hero.y, rayon, 0xff9d4a);
    if (hero.estIncarne) this.cameras.main.shake(140, 0.006);
    for (const e of this.ennemisDansRayon(hero.x, hero.y, rayon)) {
      this.repousser(e, hero.x, hero.y, 300);
      this.blesserEnnemi(e, hero.degats * 3, hero);
    }
  }

  private effetRempart(hero: Hero): void {
    hero.rendreInvulnerable(3500);
    this.effetCercle(hero.x, hero.y, 140, 0x8ec9ff);
    for (const e of this.ennemisDansRayon(hero.x, hero.y, 140)) {
      this.repousser(e, hero.x, hero.y, 420);
      this.blesserEnnemi(e, hero.degats, hero);
    }
    this.aura(hero.x, hero.y, 3, 0x8ec9ff, 3500);
  }

  private effetMeteore(hero: Hero): void {
    const candidats = this.ennemisDansRayon(hero.x, hero.y, 340);
    if (candidats.length === 0) return;

    let cible = candidats[0]!;
    let meilleurCompte = -1;
    for (const e of candidats) {
      const compte = this.ennemisDansRayon(e.x, e.y, 100).length;
      if (compte > meilleurCompte) {
        meilleurCompte = compte;
        cible = e;
      }
    }

    this.effetCercle(cible.x, cible.y, 110, 0xd06bff);
    if (hero.estIncarne) this.cameras.main.shake(180, 0.007);
    for (const e of this.ennemisDansRayon(cible.x, cible.y, 110)) {
      this.blesserEnnemi(e, hero.degats * 4, hero);
    }
  }

  private effetOmbre(hero: Hero): void {
    const arrivee = this.pointDevant(hero, 230);
    hero.rendreInvulnerable(500);
    this.trainee(hero.x, hero.y, arrivee.x, arrivee.y, 0x7ee0a0);

    const segment = new Phaser.Geom.Line(hero.x, hero.y, arrivee.x, arrivee.y);
    for (const e of [...this.ennemis.getChildren()] as Ennemi[]) {
      if (!e.active) continue;
      const proche = Phaser.Geom.Line.GetNearestPoint(segment, e, new Phaser.Geom.Point());
      if (Phaser.Math.Distance.Between(proche.x, proche.y, e.x, e.y) <= 44) {
        this.blesserEnnemi(e, hero.degats * 5, hero);
      }
    }
    hero.setPosition(arrivee.x, arrivee.y);
  }

  // --- Chevalier Sacre ---

  private effetSursautSacre(hero: Hero): void {
    const palier = Math.max(1, hero.palierDe("sursaut-sacre"));
    hero.rendreInvulnerable(1000);
    hero.soigner(hero.pvMax * (0.2 + palier * 0.05));
    this.effetCercle(hero.x, hero.y, 130, 0xfff0a0);
    for (const e of this.ennemisDansRayon(hero.x, hero.y, 130)) this.repousser(e, hero.x, hero.y, 380);
  }

  private effetBenediction(hero: Hero): void {
    const palier = Math.max(1, hero.palierDe("benediction"));
    const duree = 4000 + palier * 1000;
    const soin = palier;
    const x = hero.x;
    const y = hero.y;
    const rayon = 130;

    this.aura(x, y, rayon / 8, 0xa8ffc8, duree);
    this.time.addEvent({
      delay: 1000,
      repeat: Math.floor(duree / 1000) - 1,
      callback: () => {
        for (const allie of this.heros) {
          if (allie.etat === "mort") continue;
          if (Phaser.Math.Distance.Between(allie.x, allie.y, x, y) > rayon) continue;
          allie.soigner(soin);
          this.flotter(allie.x, allie.y - 20, `+${soin}`, "#7ee0a0");
        }
      },
    });
  }

  // --- Guerrier ---

  private effetMoulinet(hero: Hero, variante: string): void {
    const palier = Math.max(1, hero.palierDe("moulinet"));
    const duree = 2000 + palier * 500;
    const rayon = 90;
    const ticks = Math.floor(duree / 200);

    this.time.addEvent({
      delay: 200,
      repeat: ticks - 1,
      callback: () => {
        if (hero.etat === "mort") return;
        for (const e of this.ennemisDansRayon(hero.x, hero.y, rayon)) {
          if (variante === "moulinet-aspirant") this.repousser(e, hero.x, hero.y, -220);
          this.blesserEnnemi(
            e,
            Math.round(hero.degats * 0.55),
            hero,
            variante === "moulinet-sanglant" ? 1 : 0,
          );
        }
        this.effetCercle(hero.x, hero.y, rayon, 0xffc27a);
      },
    });
  }

  // --- Mage ---

  private effetDome(hero: Hero): void {
    const palier = Math.max(1, hero.palierDe("dome"));
    const pv = [60, 110, 180][palier - 1] ?? 60;
    const rayon = 70;

    // Pose ou le joueur regarde ; l'IA le pose devant elle.
    const point = hero.estIncarne
      ? this.cameras.main.getWorldPoint(this.input.activePointer.x, this.input.activePointer.y)
      : this.pointDevant(hero, 90);

    const image = this.add
      .image(point.x, point.y, "impact")
      .setTint(0x8ed6ff)
      .setAlpha(0.45)
      .setScale((rayon * 2) / 16)
      .setDepth(point.y - 3);

    this.domes.push({ image, x: point.x, y: point.y, rayon, pv, pvMax: pv });
  }

  /**
   * Exil : il sacrifie tout. Toutes les creatures hostiles sont bannies sans
   * rapporter la moindre experience, et le mage reste 30 secondes a un point de
   * vie, immobile, insoignable, condamne au moindre contact.
   */
  private effetExil(hero: Hero): void {
    this.cameras.main.shake(600, 0.014);
    this.cameras.main.flash(400, 200, 120, 255);

    for (const objet of [...this.ennemis.getChildren()] as Ennemi[]) {
      if (!objet.active) continue;
      this.effetCercle(objet.x, objet.y, 30, 0xd06bff);
      objet.destroy(); // banni : personne ne gagne d'experience
    }

    hero.pv = Math.max(1, Math.round(hero.pvMax * 0.01));
    hero.immobiliser(30000);
    hero.condamner(30000);
    this.aura(hero.x, hero.y, 4, 0xd06bff, 30000);
    this.flotter(hero.x, hero.y - 40, "30 s a decouvert", "#ff8a7a");
  }

  // --- Assassin ---

  private effetInvisibilite(hero: Hero): void {
    const palier = Math.max(1, hero.palierDe("invisibilite"));
    const duree = 4000 + palier * 1000;
    hero.rendreInvisible(duree);
    hero.multiplicateurVitesse = 1 + 0.05 + palier * 0.05;
    this.time.delayedCall(duree, () => void (hero.multiplicateurVitesse = 1));
  }

  /**
   * Hecatombe : tout ce qui agonise meurt, et chaque execution projette
   * l'assassin sur sa cible suivante.
   */
  private effetHecatombe(hero: Hero): void {
    const palier = Math.max(1, hero.palierDe("hecatombe"));
    const seuil = 0.05 + palier * 0.05;

    const condamnes = this.ennemisDansRayon(hero.x, hero.y, 520)
      .filter((e) => e.pv / e.pvMax <= seuil)
      .sort(
        (a, b) =>
          Phaser.Math.Distance.Between(hero.x, hero.y, a.x, a.y) -
          Phaser.Math.Distance.Between(hero.x, hero.y, b.x, b.y),
      )
      .slice(0, 10);

    if (condamnes.length === 0) {
      this.flotter(hero.x, hero.y - 20, "Personne a achever", "#8a8397");
      return;
    }

    hero.rendreInvulnerable(condamnes.length * 120 + 200);
    condamnes.forEach((e, i) => {
      this.time.delayedCall(i * 110, () => {
        if (!e.active || hero.etat === "mort") return;
        this.trainee(hero.x, hero.y, e.x, e.y, 0x7ee0a0);
        hero.setPosition(e.x, e.y);
        this.flotter(e.x, e.y - 16, "EXECUTE", "#ff6b5a");
        this.blesserEnnemi(e, e.pv, hero);
      });
    });
  }

  // ------------------------------------------------------------- outillage

  private pointDevant(hero: Hero, distance: number): Phaser.Math.Vector2 {
    return this.ramenerSurTerre(
      hero.x + hero.regard.x * distance,
      hero.y + hero.regard.y * distance,
    );
  }

  /**
   * Ramene un point dans la zone praticable.
   *
   * Sans ca, un Clignement ou une Charge deposerait le heros au milieu de la
   * mer ou dans la roche — et un flanc ferme qu'on peut franchir par une
   * capacite n'est pas un flanc ferme (DESIGN.md §4.6).
   */
  private ramenerSurTerre(x: number, y: number): Phaser.Math.Vector2 {
    const marge = 8;
    return new Phaser.Math.Vector2(
      Phaser.Math.Clamp(x, PRATICABLE.x + marge, PRATICABLE.x + PRATICABLE.largeur - marge),
      Phaser.Math.Clamp(y, PRATICABLE.y + marge, PRATICABLE.y + PRATICABLE.hauteur - marge),
    );
  }

  private ennemisDansRayon(x: number, y: number, rayon: number): Ennemi[] {
    const trouves: Ennemi[] = [];
    for (const objet of this.ennemis.getChildren()) {
      const e = objet as Ennemi;
      if (e.active && Phaser.Math.Distance.Between(x, y, e.x, e.y) <= rayon) trouves.push(e);
    }
    return trouves;
  }

  private repousser(e: Ennemi, x: number, y: number, force: number): void {
    const angle = Phaser.Math.Angle.Between(x, y, e.x, e.y);
    e.setVelocity(Math.cos(angle) * force, Math.sin(angle) * force);
  }

  // --------------------------------------------------------------- vagues

  private fairePartirLesVagues(): void {
    if (this.time.now < this.prochaineApparition) return;

    const ecoule = (this.time.now - this.debut) / 1000;
    const puissance = ecoule / 45;
    const vivants = this.heros.filter((h) => h.etat !== "mort").length;
    const voulu = Math.max(1, Math.floor((1 + ecoule / 18) * (vivants / 2)));
    const intervalle = Math.max(300, 1400 - ecoule * 13);

    this.majFronts(ecoule);

    // Le plafond protege la fluidite : au-dela, la montee en puissance passe
    // par la force des ennemis, pas par leur nombre.
    const place = MAX_ENNEMIS - this.ennemis.getLength();
    const nombre = Math.min(voulu, Math.max(0, place));

    for (let i = 0; i < nombre; i++) this.faireApparaitreEnnemi(puissance);
    this.prochaineApparition = this.time.now + intervalle;
  }

  /**
   * Les vagues n'existent pas encore comme evenements a debut et fin nets : en
   * attendant, la "vague" est le temps ecoule par tranches d'une minute. C'est
   * suffisant pour eprouver l'ouverture progressive des fronts (§4.6), et ca
   * sera remplace par la vraie phase de village au bloc suivant.
   */
  private majFronts(ecoule: number): void {
    const vague = 1 + Math.floor(ecoule / 60);
    if (vague === this.vague) return;

    this.vague = vague;
    this.fronts = frontsDeLaVague(vague, this.rng.next());
    this.partPremierFront = repartition(this.fronts, this.rng.next());

    // L'annonce est obligatoire : un front qui s'ouvre sans prevenir, dans un
    // jeu ou deplacer son equipe prend du temps, se subit au lieu de se jouer.
    const ou = this.fronts.map((f) => NOMS_FRONT[f]).join(" et ");
    this.events.emit("annonce", `Vague ${vague} — ils arrivent ${ou}`);
  }

  private faireApparaitreEnnemi(puissance: number): void {
    // Les ennemis surgissent au bord d'un front ouvert, jamais autour du
    // joueur : la mer et la montagne ne laissent passer personne (§4.6).
    const front: Front =
      this.fronts.length > 1 && this.rng.next() > this.partPremierFront
        ? this.fronts[1]!
        : this.fronts[0]!;

    const point = pointDApparition(front, this.rng.next());
    this.ennemis.add(new Ennemi(this, point.x, point.y, puissance));
  }

  // --------------------------------------------------------------- degats

  private contactEnnemi(hero: Hero, e: Ennemi): void {
    if (!e.active || this.termine || this.enPause) return;
    // Un heros en repli, a la cite ou invisible a decroche.
    if (!hero.estAuCombat || hero.estInvisible) return;
    if (!e.peutFrapper(this.time.now)) return;
    e.marquerCoup(this.time.now);

    // Trait "riposte" du Chevalier Sacre : il blesse ce qui le touche.
    if (hero.classe.trait === "riposte") {
      this.blesserEnnemi(e, Math.round(hero.degats * 0.9), hero);
    }

    // Martyre : le Chevalier Sacre encaisse a la place de toute l'equipe.
    if (this.martyr && this.martyr !== hero && this.martyr.etat !== "mort") {
      this.martyr.subirDegats(e.degats, this.rng.next());
      this.flotter(this.martyr.x, this.martyr.y - 22, "Martyre", "#ffd166");
      return;
    }

    const esquive = hero.subirDegats(e.degats, this.rng.next());
    if (esquive) {
      if (hero.estIncarne) this.flotter(hero.x, hero.y - 18, "Esquive", "#7ee0a0");
      return;
    }

    if (hero.estIncarne) {
      this.flotter(hero.x, hero.y - 18, `-${e.degats}`, "#ff6b5a");
      this.cameras.main.shake(90, 0.004);
    }
    if (hero.pv <= 0) this.tomber(hero);
  }

  /** La mort est definitive. Elle ne peut arriver qu'au heros incarne. */
  private tomber(hero: Hero): void {
    // Resurrection de l'Oracle : une fois, une seule, dans toute la partie.
    const oracle = this.heros.find((h) => h.bonus.resurrection && h.etat !== "mort");
    if (oracle && !this.resurrectionUtilisee) {
      this.resurrectionUtilisee = true;
      hero.soignerForce(hero.pvMax * 0.35);
      hero.rendreInvulnerable(2000);
      this.effetCercle(hero.x, hero.y, 120, 0xfff0c0);
      this.cameras.main.flash(400, 255, 240, 200);
      this.flotter(hero.x, hero.y - 34, "RESURRECTION", "#fff0c0");
      return;
    }

    hero.mourir();
    this.effetCercle(hero.x, hero.y, 90, 0xff3b30);
    this.cameras.main.shake(320, 0.012);
    this.flotter(hero.x, hero.y - 30, `${hero.classe.nom} est tombe`, "#ff6b5a");
    this.events.emit("hero-tombe", hero);

    const suivant = this.heros.findIndex((h) => h.etat !== "mort");
    if (suivant === -1) {
      this.finDePartie();
      return;
    }
    this.indexIncarne = suivant;
    this.heros[suivant]!.estIncarne = true;
    this.cameras.main.startFollow(this.heros[suivant]!, true, 0.12, 0.12);
    this.events.emit("hero-incarne", this.heros[suivant]!);
  }

  private finDePartie(): void {
    this.termine = true;
    this.physics.pause();
    this.effacerDestination();
    const resume = this.resume;
    this.events.emit("fin-de-partie", resume.secondes, resume.kills);
  }

  // --------------------------------------------------------------- effets

  /**
   * Nombres flottants, recycles.
   *
   * Un objet Texte de Phaser fabrique sa propre texture : en creer plusieurs
   * dizaines par seconde suffit a faire tomber le jeu. On les reutilise, et on
   * cesse d'en afficher au-dela d'un certain nombre a l'ecran.
   */
  private flotter(x: number, y: number, texte: string, couleur: string): void {
    if (this.textesActifs >= MAX_TEXTES_FLOTTANTS) return;

    const t =
      this.textesLibres.pop() ??
      this.add
        .text(0, 0, "", { fontFamily: "monospace", fontSize: "11px", color: "#ffffff" })
        .setOrigin(0.5)
        .setDepth(5000);

    this.textesActifs += 1;
    t.setText(texte).setColor(couleur).setPosition(x, y).setAlpha(1).setVisible(true);

    this.tweens.add({
      targets: t,
      y: y - 22,
      alpha: 0,
      duration: 650,
      onComplete: () => {
        this.textesActifs -= 1;
        t.setVisible(false);
        this.textesLibres.push(t);
      },
    });
  }

  private effetCercle(x: number, y: number, rayon: number, couleur: number): void {
    const c = this.add
      .image(x, y, "impact")
      .setTint(couleur)
      .setAlpha(0.6)
      .setScale(0.4)
      .setDepth(y - 2);
    this.tweens.add({
      targets: c,
      scale: rayon / 8,
      alpha: 0,
      duration: 320,
      onComplete: () => c.destroy(),
    });
  }

  private aura(x: number, y: number, echelle: number, couleur: number, duree: number): void {
    const a = this.add
      .image(x, y, "impact")
      .setScale(echelle)
      .setAlpha(0.35)
      .setTint(couleur)
      .setDepth(y - 3);
    this.tweens.add({ targets: a, alpha: 0, duration: duree, onComplete: () => a.destroy() });
  }

  private trainee(x1: number, y1: number, x2: number, y2: number, couleur: number): void {
    const l = this.add
      .line(0, 0, x1, y1, x2, y2, couleur)
      .setOrigin(0)
      .setLineWidth(3)
      .setAlpha(0.75)
      .setDepth(y1 - 1);
    this.tweens.add({ targets: l, alpha: 0, duration: 320, onComplete: () => l.destroy() });
  }
}
