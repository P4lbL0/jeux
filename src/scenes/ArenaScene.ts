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
import { Ennemi, Hero, type Capacite, type Dome } from "../game/entities";
import { piloter, type ContexteIA } from "../core/ia";
import type { EtatEquipe } from "../game/hud";

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

const MONDE = { largeur: 1600, hauteur: 1200 };
const MUR = 16;
const CITE = { x: MONDE.largeur / 2, y: MONDE.hauteur / 2, rayon: 105 };
const REGENERATION = 9;
const PORTEE_CORPS_A_CORPS = 90;

export class ArenaScene extends Phaser.Scene {
  private rng!: Rng;
  private heros: Hero[] = [];
  private indexIncarne = 0;
  private equipe!: Phaser.Physics.Arcade.Group;
  private ennemis!: Phaser.Physics.Arcade.Group;
  private projectiles!: Phaser.Physics.Arcade.Group;
  private domes: Dome[] = [];
  private satellites = new Map<Hero, Phaser.GameObjects.Image[]>();
  private prochainTickSatellites = 0;

  private zqsd!: Record<string, Phaser.Input.Keyboard.Key>;
  private fleches!: Phaser.Types.Input.Keyboard.CursorKeys;
  private touchesCapacites: Phaser.Input.Keyboard.Key[][] = [];

  private destination: Phaser.Math.Vector2 | null = null;
  private marqueur: Phaser.GameObjects.Image | null = null;

  private debut = 0;
  private prochaineApparition = 0;
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
    this.satellites = new Map();
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
    this.composerEquipe();

    this.physics.world.setBounds(MUR, MUR, MONDE.largeur - MUR * 2, MONDE.hauteur - MUR * 2);
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

    this.scene.launch("ui", { arene: this });
    this.events.on("choix-fait", this.resoudreChoix, this);
    this.events.on("changer-hero", this.changerHero, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.events.off("choix-fait", this.resoudreChoix, this);
      this.events.off("changer-hero", this.changerHero, this);
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

  private construireDecor(): void {
    this.add.tileSprite(0, 0, MONDE.largeur, MONDE.hauteur, "herbe").setOrigin(0).setDepth(-1000);

    const bords: [number, number, number, number][] = [
      [0, 0, MONDE.largeur, MUR],
      [0, MONDE.hauteur - MUR, MONDE.largeur, MUR],
      [0, 0, MUR, MONDE.hauteur],
      [MONDE.largeur - MUR, 0, MUR, MONDE.hauteur],
    ];
    for (const [x, y, l, h] of bords) {
      this.add.tileSprite(x, y, l, h, "mur").setOrigin(0).setDepth(-900);
    }

    // La cite. Elle n'est encore qu'un cercle de pierre : le vrai village, avec
    // ses PNJ et ses batiments, arrive au jalon 5.
    const sol = this.add.graphics().setDepth(-950);
    sol.fillStyle(0x8a7f6d, 1);
    sol.fillCircle(CITE.x, CITE.y, CITE.rayon);
    sol.fillStyle(0x9c917d, 1);
    sol.fillCircle(CITE.x, CITE.y, CITE.rayon - 14);
    sol.lineStyle(3, 0x5d5546, 1);
    sol.strokeCircle(CITE.x, CITE.y, CITE.rayon);

    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      this.add
        .image(CITE.x + Math.cos(a) * CITE.rayon, CITE.y + Math.sin(a) * CITE.rayon, "mur")
        .setDepth(-940);
    }

    this.add
      .text(CITE.x, CITE.y - CITE.rayon - 18, "LA CITE", {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#f2e9d8",
      })
      .setOrigin(0.5)
      .setDepth(-930);
  }

  // -------------------------------------------------------------- controles

  private configurerZoom(): void {
    this.input.on("wheel", (_p: unknown, _o: unknown, _dx: number, dy: number) => {
      const cam = this.cameras.main;
      cam.setZoom(Phaser.Math.Clamp(cam.zoom - dy * 0.0016, 1.4, 6));
    });
  }

  private configurerSouris(): void {
    // Sans ca, le clic droit ouvre le menu du navigateur en plein combat.
    this.input.mouse?.disableContextMenu();

    const viser = (pointeur: Phaser.Input.Pointer) => {
      if (this.termine || this.enPause) return;
      const point = this.cameras.main.getWorldPoint(pointeur.x, pointeur.y);
      this.destination = new Phaser.Math.Vector2(point.x, point.y);
      this.montrerMarqueur();
    };
    this.input.on("pointerdown", viser);
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => p.isDown && viser(p));
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
    this.majProvocation();
    this.majSatellites();
    this.deplacerHeroIncarne();
    this.deplacerHerosIA();
    this.deplacerEnnemis();
    for (const hero of this.heros) this.attaquerAvec(hero);
    this.gererCapacitesAuto();
    this.gererCapacites();
    this.fairePartirLesVagues();
    this.trierProfondeurs();
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

  /** Satellites du mage : ils tournent et blessent ce qu'ils traversent. */
  private majSatellites(): void {
    for (const hero of this.heros) {
      const voulu = hero.etat === "mort" ? 0 : hero.bonus.satellites;
      const liste = this.satellites.get(hero) ?? [];
      while (liste.length < voulu) {
        liste.push(this.add.image(hero.x, hero.y, "projectile").setScale(1.2));
      }
      while (liste.length > voulu) liste.pop()?.destroy();
      this.satellites.set(hero, liste);

      const teinte = hero.bonus.satelliteFeu
        ? 0xff8a3d
        : hero.bonus.satelliteGlace
          ? 0x8ed6ff
          : 0xd06bff;
      liste.forEach((s, i) => {
        const angle = this.time.now / 520 + (i / Math.max(1, voulu)) * Math.PI * 2;
        s.setPosition(hero.x + Math.cos(angle) * 48, hero.y + Math.sin(angle) * 48)
          .setTint(teinte)
          .setDepth(hero.y + 2);
      });
    }

    if (this.time.now < this.prochainTickSatellites) return;
    this.prochainTickSatellites = this.time.now + 260;

    for (const [hero, liste] of this.satellites) {
      if (hero.etat === "mort" || liste.length === 0) continue;
      const degats = Math.round(hero.degats * (hero.bonus.satelliteFeu ? 0.8 : 0.4));
      for (const s of liste) {
        for (const e of this.ennemisDansRayon(s.x, s.y, 18)) {
          if (hero.bonus.satelliteGlace) e.ralentir(1200);
          this.blesserEnnemi(e, degats, hero);
        }
      }
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
    for (const objet of this.ennemis.getChildren()) {
      const e = objet as Ennemi;
      if (!e.active) continue;

      const cible = this.cibleDe(e) ?? CITE;
      const angle = Phaser.Math.Angle.Between(e.x, e.y, cible.x, cible.y);
      e.setVelocity(Math.cos(angle) * e.vitesseEffective, Math.sin(angle) * e.vitesseEffective);
      e.setFlipX(cible.x < e.x);
      e.setTint(this.time.now < e.ralentiJusqua ? 0x8ed6ff : 0xffffff);

      this.bloquerParLesDomes(e);
    }
  }

  /**
   * Qui un ennemi vise. Trois regles se superposent :
   * la Provocation force sa cible, l'invisibilite retire une cible, et la
   * discretion de l'assassin le fait passer apres les autres.
   */
  private cibleDe(e: Ennemi): Hero | null {
    if (e.provoquePar?.estAuCombat && !e.provoquePar.estInvisible) return e.provoquePar;

    const candidats = this.heros.filter((h) => h.estAuCombat && !h.estInvisible);
    if (candidats.length === 0) return null;

    const parDistance = candidats.sort(
      (a, b) =>
        Phaser.Math.Distance.Between(e.x, e.y, a.x, a.y) -
        Phaser.Math.Distance.Between(e.x, e.y, b.x, b.y),
    );
    const premier = parDistance[0]!;
    if (!premier.bonus.discretion) return premier;

    // L'assassin n'est vise qu'a defaut d'une autre cible a portee raisonnable.
    const autre = parDistance.find(
      (h) => !h.bonus.discretion && Phaser.Math.Distance.Between(e.x, e.y, h.x, h.y) < 220,
    );
    return autre ?? premier;
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
    const cible = this.ennemiLePlusProche(hero.x, hero.y, hero.portee);
    if (!cible) return;

    hero.marquerAttaque();
    if (hero.portee <= PORTEE_CORPS_A_CORPS) this.frapperAuContact(hero, cible);
    else this.lancerProjectile(hero, cible);
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
    const p = this.projectiles.create(hero.x, hero.y, "projectile") as Phaser.Physics.Arcade.Image;
    p.setDepth(hero.y + 1);
    p.setTint(hero.classe.accent);
    p.setData("auteur", hero);
    const angle = Phaser.Math.Angle.Between(hero.x, hero.y, cible.x, cible.y);
    p.setVelocity(Math.cos(angle) * 340, Math.sin(angle) * 340);
    this.time.delayedCall(1400, () => p.destroy());
  }

  private impactProjectile(p: Phaser.Physics.Arcade.Image, e: Ennemi): void {
    if (!p.active || !e.active) return;
    const auteur = p.getData("auteur") as Hero | undefined;
    const x = p.x;
    const y = p.y;
    p.destroy();
    if (!auteur || auteur.etat === "mort") return;

    if (auteur.classe.trait === "explosion") {
      // Trait du mage : chaque tir souffle un groupe entier.
      this.effetCercle(x, y, 48, 0xd06bff);
      for (const voisin of this.ennemisDansRayon(x, y, 48)) this.frapper(auteur, voisin);
    } else {
      this.frapper(auteur, e);
    }
  }

  private frapper(auteur: Hero, e: Ennemi): void {
    const critique = this.rng.next() < auteur.critChance;
    const degats = critique ? Math.round(auteur.degats * auteur.critMultiplicateur) : auteur.degats;
    if (critique && auteur.estIncarne) this.flotter(e.x, e.y - 14, `${degats} !`, "#ffd166");
    this.blesserEnnemi(e, degats, auteur);
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
    e.setTintFill(0xffffff);
    this.time.delayedCall(60, () => e.active && e.clearTint());

    const vol = auteur.volDeVie + volDeVieSup;
    if (vol > 0) auteur.soigner(inflige * vol);

    if (e.pv > 0) return;
    this.tuer(e, auteur);
  }

  private tuer(e: Ennemi, auteur: Hero): void {
    this.kills += 1;
    auteur.kills += 1;
    if (auteur.bonus.soinParKill > 0) auteur.soigner(auteur.bonus.soinParKill);

    // Provocation : chaque mort a ses pieds rend le Chevalier Sacre plus solide.
    for (const hero of this.heros) {
      if (hero.bonus.provocation <= 0) continue;
      if (Phaser.Math.Distance.Between(hero.x, hero.y, e.x, e.y) <= hero.bonus.provocation) {
        hero.pvGagnesProvocation += 1;
        hero.pv += 1;
      }
    }

    // L'XP va au heros qui a tue, pas a l'equipe (DESIGN.md §4.5).
    const monte = auteur.gagnerXp(e.xpDonnee);
    e.destroy();
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
    hero.marquerCapacite(capacite);
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
    }
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
    return new Phaser.Math.Vector2(
      Phaser.Math.Clamp(hero.x + hero.regard.x * distance, MUR + 8, MONDE.largeur - MUR - 8),
      Phaser.Math.Clamp(hero.y + hero.regard.y * distance, MUR + 8, MONDE.hauteur - MUR - 8),
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
    const nombre = Math.max(1, Math.floor((1 + ecoule / 18) * (vivants / 2)));
    const intervalle = Math.max(300, 1400 - ecoule * 13);

    for (let i = 0; i < nombre; i++) this.faireApparaitreEnnemi(puissance);
    this.prochaineApparition = this.time.now + intervalle;
  }

  private faireApparaitreEnnemi(puissance: number): void {
    const cam = this.cameras.main;
    const rayon = Math.max(cam.width, cam.height) / cam.zoom / 2 + 70;
    const angle = this.rng.range(0, Math.PI * 2);
    const centre = this.hero;
    const x = Phaser.Math.Clamp(
      centre.x + Math.cos(angle) * rayon,
      MUR + 10,
      MONDE.largeur - MUR - 10,
    );
    const y = Phaser.Math.Clamp(
      centre.y + Math.sin(angle) * rayon,
      MUR + 10,
      MONDE.hauteur - MUR - 10,
    );

    this.ennemis.add(new Ennemi(this, x, y, puissance));
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

  private flotter(x: number, y: number, texte: string, couleur: string): void {
    const t = this.add
      .text(x, y, texte, { fontFamily: "monospace", fontSize: "11px", color: couleur })
      .setOrigin(0.5)
      .setDepth(5000);
    this.tweens.add({
      targets: t,
      y: y - 22,
      alpha: 0,
      duration: 650,
      onComplete: () => t.destroy(),
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
