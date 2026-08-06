import Phaser from "phaser";
import { Rng } from "../core/rng";
import { CLASSES, ORDRE_CLASSES, type ClassId } from "../core/classes";
import { tirerCompetences, type CompetenceDef } from "../core/competences";
import { creerTexturesPlaceholder } from "../game/art";
import { Ennemi, Hero } from "../game/entities";
import { piloter, type ContexteIA } from "../core/ia";
import type { EtatEquipe } from "../game/hud";

/**
 * JALON 3 — l'equipe, l'IA et la regle des 20%.
 *
 * Le coeur du jeu (DESIGN.md §4.3) :
 *
 * - le joueur incarne un heros, l'IA joue tous les autres ;
 * - un heros IA se replie automatiquement a 20% de vie : l'IA ne perd jamais
 *   personne ;
 * - le joueur peut changer de heros a tout moment SAUF sous 20% de vie : il est
 *   alors verrouille et doit ramener son heros a la cite ;
 * - la mort est definitive.
 *
 * La consequence de ces trois regles, et c'est tout l'interet du systeme : un
 * heros ne peut mourir que par une decision du joueur.
 */

const MONDE = { largeur: 1600, hauteur: 1200 };
const MUR = 16;

/** La cite : refuge, point de ralliement, et seul endroit ou l'on peut changer de heros quand on est au plus mal. */
const CITE = { x: MONDE.largeur / 2, y: MONDE.hauteur / 2, rayon: 105 };

/** Points de vie rendus par seconde a l'interieur de la cite */
const REGENERATION = 9;

/** Portee au-dela de laquelle une classe est consideree comme distante */
const PORTEE_CORPS_A_CORPS = 90;

export class ArenaScene extends Phaser.Scene {
  private rng!: Rng;
  private heros: Hero[] = [];
  private indexIncarne = 0;
  private equipe!: Phaser.Physics.Arcade.Group;
  private ennemis!: Phaser.Physics.Arcade.Group;
  private projectiles!: Phaser.Physics.Arcade.Group;

  private zqsd!: Record<string, Phaser.Input.Keyboard.Key>;
  private fleches!: Phaser.Types.Input.Keyboard.CursorKeys;
  private touchesUltimes: Phaser.Input.Keyboard.Key[][] = [];

  private destination: Phaser.Math.Vector2 | null = null;
  private marqueur: Phaser.GameObjects.Image | null = null;

  private debut = 0;
  private prochaineApparition = 0;
  private kills = 0;
  private termine = false;

  private enPause = false;
  private debutPause = 0;

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
  }

  get hero(): Hero {
    return this.heros[this.indexIncarne]!;
  }

  /** Lu par l'interface, qui vit dans une autre scene. */
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
    this.events.on("competence-choisie", this.appliquerCompetence, this);
    this.events.on("changer-hero", this.changerHero, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.events.off("competence-choisie", this.appliquerCompetence, this);
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
    const codesParUltime = [
      [K.ONE, K.NUMPAD_ONE, K.SPACE],
      [K.TWO, K.NUMPAD_TWO],
      [K.THREE, K.NUMPAD_THREE],
    ];
    this.touchesUltimes = codesParUltime.map((codes) => codes.map((c) => clavier.addKey(c)));

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
   * abandonner son heros mourant en changeant de personnage : il doit le
   * ramener vivant. C'est ce qui fait de la fuite une sequence de jeu.
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

    // Le heros repris presente ses montees de niveau en attente : c'est
    // toujours le joueur qui choisit, jamais l'IA (DESIGN.md §4.3).
    if (cible.niveauxEnAttente > 0) this.ouvrirChoix();
  }

  // ---------------------------------------------------------------- boucle

  update(_temps: number, delta: number): void {
    if (this.termine || this.enPause) return;

    this.majEtats(delta);
    this.deplacerHeroIncarne();
    this.deplacerHerosIA();
    this.deplacerEnnemis();
    for (const hero of this.heros) this.attaquerAvec(hero);
    this.gererUltimes();
    this.fairePartirLesVagues();
    this.trierProfondeurs();
  }

  /**
   * L'etat de chaque heros se deduit de sa position et de sa vie. Pas de
   * machine a etats compliquee : trois regles suffisent, et elles se lisent.
   */
  private majEtats(delta: number): void {
    for (const hero of this.heros) {
      if (hero.etat === "mort") continue;

      const dansCite =
        Phaser.Math.Distance.Between(hero.x, hero.y, CITE.x, CITE.y) <= CITE.rayon;

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
    }
  }

  private deplacerHeroIncarne(): void {
    const hero = this.hero;
    if (!hero || hero.etat === "mort") return;

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

    hero.setAlpha(hero.estCritique && Math.floor(this.time.now / 140) % 2 === 0 ? 0.55 : 1);
  }

  private deplacerHerosIA(): void {
    const contexte: ContexteIA = {
      cite: CITE,
      ennemiLePlusProche: (x, y, portee) => this.ennemiLePlusProche(x, y, portee),
      nombreEnnemisAutour: (x, y, rayon) => this.ennemisDansRayon(x, y, rayon).length,
    };

    for (const hero of this.heros) {
      if (hero.estIncarne || hero.etat === "mort") continue;

      const { direction, lancerUltime } = piloter(hero, contexte);
      // Un heros qui decroche court plus vite : c'est ce qui rend le repli
      // credible plutot que suicidaire.
      const vitesse = hero.vitesse * (hero.etat === "repli" ? 1.35 : 1);
      hero.setVelocity(direction.x * vitesse, direction.y * vitesse);
      if (direction.x !== 0) hero.setFlipX(direction.x < 0);
      if (direction.x !== 0 || direction.y !== 0) hero.regard.set(direction.x, direction.y);

      hero.setAlpha(hero.etat === "repli" ? 0.75 : 1);

      if (lancerUltime && hero.peutLancerUltime(0) && hero.etat === "combat") {
        this.lancerUltime(hero, 0);
      }
    }
  }

  private deplacerEnnemis(): void {
    for (const objet of this.ennemis.getChildren()) {
      const e = objet as Ennemi;
      if (!e.active) continue;
      const cible = this.heroLePlusProche(e.x, e.y) ?? CITE;
      const angle = Phaser.Math.Angle.Between(e.x, e.y, cible.x, cible.y);
      e.setVelocity(Math.cos(angle) * e.vitesse, Math.sin(angle) * e.vitesse);
      e.setFlipX(cible.x < e.x);
    }
  }

  /** Les ennemis ne visent que ceux qui se battent : un heros en repli est laisse tranquille. */
  private heroLePlusProche(x: number, y: number): Hero | null {
    let meilleur: Hero | null = null;
    let distance = Infinity;
    for (const hero of this.heros) {
      if (!hero.estAuCombat) continue;
      const d = Phaser.Math.Distance.Between(x, y, hero.x, hero.y);
      if (d < distance) {
        distance = d;
        meilleur = hero;
      }
    }
    return meilleur;
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
    if (hero.etat !== "combat" || !hero.peutAttaquer()) return;
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
      .image(hero.x + Math.cos(angle) * portee * 0.5, hero.y + Math.sin(angle) * portee * 0.5, "impact")
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

  /** Applique les degats d'un heros a un ennemi, coup critique compris. */
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

  private blesserEnnemi(e: Ennemi, degats: number, auteur: Hero): void {
    if (!e.active) return;
    e.pv -= degats;
    e.setTintFill(0xffffff);
    this.time.delayedCall(60, () => e.active && e.clearTint());

    if (e.pv > 0) return;
    this.kills += 1;
    if (auteur.bonus.soinParKill > 0) auteur.soigner(auteur.bonus.soinParKill);
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
    if (hero.estIncarne && !this.enPause) this.ouvrirChoix();
  }

  private ouvrirChoix(): void {
    this.enPause = true;
    this.debutPause = this.time.now;
    this.physics.pause();
    this.effacerDestination();

    const choix = tirerCompetences(
      this.rng,
      this.hero.classe.id,
      this.hero.competencesPrises,
      3,
      // Passera au rang du heros quand les rangs existeront (DESIGN.md §4.1).
      0,
    );
    this.events.emit("montee-niveau", this.hero, choix);
  }

  private appliquerCompetence(competence: CompetenceDef): void {
    this.hero.apprendre(competence);
    // Sans ce decalage, le temps passe dans le menu rechargerait les ultimes.
    for (const hero of this.heros) hero.decalerRechargements(this.time.now - this.debutPause);
    this.physics.resume();
    this.enPause = false;
    if (this.hero.niveauxEnAttente > 0) this.ouvrirChoix();
  }

  // -------------------------------------------------------------- ultimes

  private gererUltimes(): void {
    this.hero.classe.ultimes.forEach((_, i) => {
      const touches = this.touchesUltimes[i];
      if (!touches || !touches.some((t) => Phaser.Input.Keyboard.JustDown(t))) return;
      if (!this.hero.peutLancerUltime(i)) return;
      this.lancerUltime(this.hero, i);
    });
  }

  private lancerUltime(hero: Hero, index: number): void {
    const ultime = hero.classe.ultimes[index];
    if (!ultime) return;
    hero.marquerUltime(index);
    this.flotter(hero.x, hero.y - 28, ultime.nom.toUpperCase(), "#f0c419");

    switch (ultime.effet) {
      case "tourbillon":
        this.ultimeTourbillon(hero);
        break;
      case "rempart":
        this.ultimeRempart(hero);
        break;
      case "meteore":
        this.ultimeMeteore(hero);
        break;
      case "ombre":
        this.ultimeOmbre(hero);
        break;
    }
  }

  private ultimeTourbillon(hero: Hero): void {
    const rayon = 110;
    this.effetCercle(hero.x, hero.y, rayon, 0xff9d4a);
    if (hero.estIncarne) this.cameras.main.shake(140, 0.006);
    for (const e of this.ennemisDansRayon(hero.x, hero.y, rayon)) {
      this.repousser(e, hero.x, hero.y, 300);
      this.blesserEnnemi(e, hero.degats * 3, hero);
    }
  }

  private ultimeRempart(hero: Hero): void {
    hero.rendreInvulnerable(3500);
    this.effetCercle(hero.x, hero.y, 140, 0x8ec9ff);
    for (const e of this.ennemisDansRayon(hero.x, hero.y, 140)) {
      this.repousser(e, hero.x, hero.y, 420);
      this.blesserEnnemi(e, hero.degats, hero);
    }
    const aura = this.add
      .image(hero.x, hero.y, "impact")
      .setScale(3)
      .setAlpha(0.35)
      .setTint(0x8ec9ff)
      .setDepth(hero.y - 1);
    this.tweens.add({ targets: aura, alpha: 0, duration: 3500, onComplete: () => aura.destroy() });
  }

  private ultimeMeteore(hero: Hero): void {
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

  private ultimeOmbre(hero: Hero): void {
    const distance = 230;
    const depart = new Phaser.Math.Vector2(hero.x, hero.y);
    const arrivee = new Phaser.Math.Vector2(
      Phaser.Math.Clamp(hero.x + hero.regard.x * distance, MUR + 8, MONDE.largeur - MUR - 8),
      Phaser.Math.Clamp(hero.y + hero.regard.y * distance, MUR + 8, MONDE.hauteur - MUR - 8),
    );

    hero.rendreInvulnerable(500);
    const trainee = this.add
      .line(0, 0, depart.x, depart.y, arrivee.x, arrivee.y, 0x7ee0a0)
      .setOrigin(0)
      .setLineWidth(3)
      .setAlpha(0.75)
      .setDepth(hero.y - 1);
    this.tweens.add({
      targets: trainee,
      alpha: 0,
      duration: 320,
      onComplete: () => trainee.destroy(),
    });

    const segment = new Phaser.Geom.Line(depart.x, depart.y, arrivee.x, arrivee.y);
    for (const e of [...this.ennemis.getChildren()] as Ennemi[]) {
      if (!e.active) continue;
      const proche = Phaser.Geom.Line.GetNearestPoint(segment, e, new Phaser.Geom.Point());
      if (Phaser.Math.Distance.Between(proche.x, proche.y, e.x, e.y) <= 44) {
        this.blesserEnnemi(e, hero.degats * 5, hero);
      }
    }
    hero.setPosition(arrivee.x, arrivee.y);
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
    // Une equipe entiere encaisse plus qu'un heros seul : les vagues suivent.
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
    // Un heros en repli ou a la cite a decroche : il ne prend plus de coups.
    if (!hero.estAuCombat) return;
    if (!e.peutFrapper(this.time.now)) return;
    e.marquerCoup(this.time.now);

    // Trait "riposte" du chevalier : il blesse ce qui le touche, esquive ou non.
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
}
