import Phaser from "phaser";
import { Rng } from "../core/rng";
import { CLASSES, type ClassId } from "../core/classes";
import { tirerCompetences, type CompetenceDef } from "../core/competences";
import { creerTexturesPlaceholder } from "../game/art";
import { Ennemi, Hero } from "../game/entities";

/**
 * JALON 1 + 2 — l'arene.
 *
 * Elle repond a la question du jalon 1 (bouger et lacher un ultime, est-ce
 * amusant ?) et porte la boucle de progression du jalon 2 : XP, montee de
 * niveau, choix d'amelioration avec mise en pause.
 */

const MONDE = { largeur: 1600, hauteur: 1200 };
const MUR = 16;

/** Portee au-dela de laquelle une classe est consideree comme distante */
const PORTEE_CORPS_A_CORPS = 90;

export class ArenaScene extends Phaser.Scene {
  private rng!: Rng;
  private hero!: Hero;
  private ennemis!: Phaser.Physics.Arcade.Group;
  private projectiles!: Phaser.Physics.Arcade.Group;

  private zqsd!: Record<string, Phaser.Input.Keyboard.Key>;
  private fleches!: Phaser.Types.Input.Keyboard.CursorKeys;
  private touchesUltimes: Phaser.Input.Keyboard.Key[][] = [];

  /** Destination fixee a la souris, effacee des qu'on touche au clavier */
  private destination: Phaser.Math.Vector2 | null = null;
  private marqueur: Phaser.GameObjects.Image | null = null;

  private debut = 0;
  private prochaineApparition = 0;
  private kills = 0;
  private termine = false;

  private enPause = false;
  private niveauxEnAttente = 0;
  private debutPause = 0;

  constructor() {
    super("arena");
  }

  /** Lu par l'interface, qui vit dans une autre scene. */
  get resume(): { secondes: number; kills: number; niveau: number } {
    return {
      secondes: Math.floor((this.time.now - this.debut) / 1000),
      kills: this.kills,
      niveau: this.hero?.niveau ?? 1,
    };
  }

  init(data: { classe?: ClassId }): void {
    this.registry.set("classe", data.classe ?? "guerrier");
    this.kills = 0;
    this.termine = false;
    this.enPause = false;
    this.niveauxEnAttente = 0;
    this.destination = null;
    this.marqueur = null;
  }

  create(): void {
    const graine = Date.now() % 1_000_000;
    this.rng = new Rng(graine);
    // Affichee pour pouvoir rejouer exactement la meme partie en cas de bug.
    console.log(`[arene] graine = ${graine}`);

    creerTexturesPlaceholder(this);
    this.construireDecor();

    const classe = CLASSES[this.registry.get("classe") as ClassId];
    this.hero = new Hero(this, MONDE.largeur / 2, MONDE.hauteur / 2, classe);

    this.ennemis = this.physics.add.group();
    this.projectiles = this.physics.add.group();

    this.physics.world.setBounds(MUR, MUR, MONDE.largeur - MUR * 2, MONDE.hauteur - MUR * 2);
    this.cameras.main.setBounds(0, 0, MONDE.largeur, MONDE.hauteur);
    this.cameras.main.setZoom(3);
    this.cameras.main.startFollow(this.hero, true, 0.12, 0.12);
    this.configurerZoom();
    this.configurerTouches();
    this.configurerSouris();

    this.physics.add.overlap(this.hero, this.ennemis, (_h, e) => this.contactEnnemi(e as Ennemi));
    this.physics.add.overlap(this.projectiles, this.ennemis, (p, e) =>
      this.impactProjectile(p as Phaser.Physics.Arcade.Image, e as Ennemi),
    );

    // L'interface vit dans sa propre scene pour echapper au zoom (voir UiScene).
    this.scene.launch("ui", { hero: this.hero });
    this.events.on("competence-choisie", this.appliquerCompetence, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
      this.events.off("competence-choisie", this.appliquerCompetence, this),
    );

    this.debut = this.time.now;
    this.prochaineApparition = this.time.now + 800;
  }

  // ---------------------------------------------------------------- decor

  private construireDecor(): void {
    this.add.tileSprite(0, 0, MONDE.largeur, MONDE.hauteur, "herbe").setOrigin(0).setDepth(-1000);

    // Mur en ruine sur les quatre bords : il donne une limite lisible a l'arene.
    const bords: [number, number, number, number][] = [
      [0, 0, MONDE.largeur, MUR],
      [0, MONDE.hauteur - MUR, MONDE.largeur, MUR],
      [0, 0, MUR, MONDE.hauteur],
      [MONDE.largeur - MUR, 0, MUR, MONDE.hauteur],
    ];
    for (const [x, y, l, h] of bords) {
      this.add.tileSprite(x, y, l, h, "mur").setOrigin(0).setDepth(-900);
    }
  }

  private configurerZoom(): void {
    // Zoom libre a la molette (DESIGN.md §4.11), avec des bornes : sans elles
    // le joueur trouve toujours la distance qui casse le jeu.
    this.input.on("wheel", (_p: unknown, _o: unknown, _dx: number, dy: number) => {
      const cam = this.cameras.main;
      cam.setZoom(Phaser.Math.Clamp(cam.zoom - dy * 0.0016, 1.4, 6));
    });
  }

  /**
   * Deplacement a la souris : on clique, le heros y va. Maintenir le bouton
   * deplace la destination en continu, ce qui permet de le guider comme au
   * clavier. Le clavier reprend la main des qu'on l'utilise.
   */
  private configurerSouris(): void {
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
    // ZQSD et fleches en meme temps : pas besoin de choisir.
    this.zqsd = clavier.addKeys("Z,Q,S,D") as Record<string, Phaser.Input.Keyboard.Key>;
    this.fleches = clavier.createCursorKeys();

    // Une touche par ultime (DESIGN.md §4.2). Le premier a aussi ESPACE :
    // sur un clavier AZERTY, la rangee des chiffres demande souvent Shift.
    const K = Phaser.Input.Keyboard.KeyCodes;
    const codesParUltime = [
      [K.ONE, K.NUMPAD_ONE, K.SPACE],
      [K.TWO, K.NUMPAD_TWO],
      [K.THREE, K.NUMPAD_THREE],
    ];
    this.touchesUltimes = codesParUltime.map((codes) => codes.map((c) => clavier.addKey(c)));

    clavier.addKey(Phaser.Input.Keyboard.KeyCodes.R).on("down", () => {
      if (!this.termine) return;
      this.scene.stop("ui");
      this.scene.start("choix-classe");
    });
  }

  // ---------------------------------------------------------------- boucle

  update(): void {
    if (this.termine || this.enPause) return;

    this.deplacerHero();
    this.deplacerEnnemis();
    this.attaqueAutomatique();
    this.gererUltimes();
    this.fairePartirLesVagues();
    this.trierProfondeurs();
  }

  private deplacerHero(): void {
    const dir = new Phaser.Math.Vector2(0, 0);
    if (this.zqsd["Q"]?.isDown || this.fleches.left.isDown) dir.x -= 1;
    if (this.zqsd["D"]?.isDown || this.fleches.right.isDown) dir.x += 1;
    if (this.zqsd["Z"]?.isDown || this.fleches.up.isDown) dir.y -= 1;
    if (this.zqsd["S"]?.isDown || this.fleches.down.isDown) dir.y += 1;

    if (dir.lengthSq() > 0) {
      // Le clavier reprend toujours la main sur la souris.
      this.effacerDestination();
    } else if (this.destination) {
      const distance = Phaser.Math.Distance.Between(
        this.hero.x,
        this.hero.y,
        this.destination.x,
        this.destination.y,
      );
      if (distance < 6) {
        this.effacerDestination();
      } else {
        dir.set(this.destination.x - this.hero.x, this.destination.y - this.hero.y);
      }
    }

    // Normaliser : sans ca, la diagonale est 40% plus rapide.
    dir.normalize();
    if (dir.lengthSq() > 0) {
      this.hero.regard.copy(dir);
      if (dir.x !== 0) this.hero.setFlipX(dir.x < 0);
    }
    this.hero.setVelocity(dir.x * this.hero.vitesse, dir.y * this.hero.vitesse);

    // Clignotement quand la vie est critique : le joueur doit le voir sans
    // quitter l'action des yeux.
    this.hero.setAlpha(
      this.hero.estCritique && Math.floor(this.time.now / 140) % 2 === 0 ? 0.55 : 1,
    );
  }

  private deplacerEnnemis(): void {
    for (const objet of this.ennemis.getChildren()) {
      const e = objet as Ennemi;
      if (!e.active) continue;
      const angle = Phaser.Math.Angle.Between(e.x, e.y, this.hero.x, this.hero.y);
      e.setVelocity(Math.cos(angle) * e.vitesse, Math.sin(angle) * e.vitesse);
      e.setFlipX(this.hero.x < e.x);
    }
  }

  /** Le tri par ordonnee donne la profondeur en vue de dessus. */
  private trierProfondeurs(): void {
    this.hero.setDepth(this.hero.y);
    for (const objet of this.ennemis.getChildren()) {
      const e = objet as Ennemi;
      e.setDepth(e.y);
    }
  }

  // ------------------------------------------------------------- attaques

  private attaqueAutomatique(): void {
    if (!this.hero.peutAttaquer()) return;
    const cible = this.ennemiLePlusProche(this.hero.portee);
    if (!cible) return;

    this.hero.marquerAttaque();
    if (this.hero.portee <= PORTEE_CORPS_A_CORPS) {
      this.frapperAuContact(cible);
    } else {
      this.lancerProjectile(cible);
    }
  }

  private frapperAuContact(cible: Ennemi): void {
    const portee = this.hero.portee;
    const angle = Phaser.Math.Angle.Between(this.hero.x, this.hero.y, cible.x, cible.y);
    // Trait "arc-large" du guerrier : il fauche un demi-cercle entier la ou les
    // autres classes ne touchent qu'un cone etroit.
    const demiArc = this.hero.classe.trait === "arc-large" ? Math.PI / 2 : Math.PI / 4;

    for (const e of [...this.ennemis.getChildren()] as Ennemi[]) {
      if (!e.active) continue;
      const d = Phaser.Math.Distance.Between(this.hero.x, this.hero.y, e.x, e.y);
      if (d > portee) continue;
      const a = Phaser.Math.Angle.Between(this.hero.x, this.hero.y, e.x, e.y);
      if (Math.abs(Phaser.Math.Angle.Wrap(a - angle)) > demiArc) continue;
      this.frapper(e);
    }

    const arc = this.add
      .image(
        this.hero.x + Math.cos(angle) * portee * 0.5,
        this.hero.y + Math.sin(angle) * portee * 0.5,
        "impact",
      )
      .setDepth(this.hero.y + 1)
      .setScale(portee / 22)
      .setAlpha(0.45)
      .setTint(0xffe9a8);
    this.tweens.add({ targets: arc, alpha: 0, duration: 150, onComplete: () => arc.destroy() });
  }

  private lancerProjectile(cible: Ennemi): void {
    const p = this.projectiles.create(
      this.hero.x,
      this.hero.y,
      "projectile",
    ) as Phaser.Physics.Arcade.Image;
    p.setDepth(this.hero.y + 1);
    p.setTint(this.hero.classe.accent);
    const angle = Phaser.Math.Angle.Between(this.hero.x, this.hero.y, cible.x, cible.y);
    p.setVelocity(Math.cos(angle) * 340, Math.sin(angle) * 340);
    this.time.delayedCall(1400, () => p.destroy());
  }

  private impactProjectile(p: Phaser.Physics.Arcade.Image, e: Ennemi): void {
    if (!p.active || !e.active) return;
    const x = p.x;
    const y = p.y;
    p.destroy();

    if (this.hero.classe.trait === "explosion") {
      // Trait du mage : chaque tir souffle un groupe entier. C'est ce qui le
      // rend utile de loin malgre sa cadence lente.
      this.effetCercle(x, y, 48, 0xd06bff);
      for (const voisin of this.ennemisDansRayon(x, y, 48)) this.frapper(voisin);
    } else {
      this.frapper(e);
    }
  }

  /** Applique les degats du heros a un ennemi, coup critique compris. */
  private frapper(e: Ennemi): void {
    const critique = this.rng.next() < this.hero.critChance;
    const degats = critique
      ? Math.round(this.hero.degats * this.hero.critMultiplicateur)
      : this.hero.degats;
    if (critique) this.flotter(e.x, e.y - 14, `${degats} !`, "#ffd166");
    this.blesserEnnemi(e, degats);
  }

  private ennemiLePlusProche(portee: number): Ennemi | null {
    let meilleur: Ennemi | null = null;
    let meilleureDistance = portee;
    for (const objet of this.ennemis.getChildren()) {
      const e = objet as Ennemi;
      if (!e.active) continue;
      const d = Phaser.Math.Distance.Between(this.hero.x, this.hero.y, e.x, e.y);
      if (d < meilleureDistance) {
        meilleureDistance = d;
        meilleur = e;
      }
    }
    return meilleur;
  }

  private blesserEnnemi(e: Ennemi, degats: number): void {
    if (!e.active) return;
    e.pv -= degats;
    e.setTintFill(0xffffff);
    this.time.delayedCall(60, () => e.active && e.clearTint());

    if (e.pv > 0) return;
    this.kills += 1;
    if (this.hero.bonus.soinParKill > 0) this.hero.soigner(this.hero.bonus.soinParKill);
    const monte = this.hero.gagnerXp(e.xpDonnee);
    e.destroy();
    if (monte) this.monterDeNiveau();
  }

  // ---------------------------------------------------------- progression

  private monterDeNiveau(): void {
    this.niveauxEnAttente += 1;
    this.flotter(this.hero.x, this.hero.y - 24, `NIVEAU ${this.hero.niveau}`, "#5ec8f0");
    this.effetCercle(this.hero.x, this.hero.y, 70, 0x5ec8f0);
    if (!this.enPause) this.ouvrirChoix();
  }

  /**
   * Le jeu se met en pause le temps du choix (DESIGN.md §4.8). Au jalon 3,
   * seuls les niveaux du heros *incarne* ouvriront cet ecran : ceux des heros
   * joues par l'IA s'accumuleront en attente.
   */
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

    // C'est l'interface qui affiche le choix, et elle repondra par
    // "competence-choisie". La scene de jeu ne sait rien de son apparence.
    this.events.emit("montee-niveau", this.hero.niveau, choix);
  }

  private appliquerCompetence(competence: CompetenceDef): void {
    this.hero.apprendre(competence);
    // Sans ce decalage, le temps passe dans le menu rechargerait les ultimes
    // gratuitement.
    this.hero.decalerRechargements(this.time.now - this.debutPause);
    this.physics.resume();
    this.enPause = false;
    this.niveauxEnAttente = Math.max(0, this.niveauxEnAttente - 1);
    if (this.niveauxEnAttente > 0) this.ouvrirChoix();
  }

  // -------------------------------------------------------------- ultimes

  private gererUltimes(): void {
    this.hero.classe.ultimes.forEach((ultime, i) => {
      const touches = this.touchesUltimes[i];
      if (!touches || !touches.some((t) => Phaser.Input.Keyboard.JustDown(t))) return;
      if (!this.hero.peutLancerUltime(i)) return;
      this.hero.marquerUltime(i);
      this.flotter(this.hero.x, this.hero.y - 28, ultime.nom.toUpperCase(), "#f0c419");

      switch (ultime.effet) {
        case "tourbillon":
          this.ultimeTourbillon();
          break;
        case "rempart":
          this.ultimeRempart();
          break;
        case "meteore":
          this.ultimeMeteore();
          break;
        case "ombre":
          this.ultimeOmbre();
          break;
      }
    });
  }

  /** Guerrier : tout ce qui l'entoure prend cher et recule. */
  private ultimeTourbillon(): void {
    const rayon = 110;
    this.effetCercle(this.hero.x, this.hero.y, rayon, 0xff9d4a);
    this.cameras.main.shake(140, 0.006);
    for (const e of this.ennemisDansRayon(this.hero.x, this.hero.y, rayon)) {
      this.repousser(e, this.hero.x, this.hero.y, 300);
      this.blesserEnnemi(e, this.hero.degats * 3);
    }
  }

  /** Chevalier : invulnerable un temps, et il degage la place autour de lui. */
  private ultimeRempart(): void {
    this.hero.rendreInvulnerable(3500);
    this.effetCercle(this.hero.x, this.hero.y, 140, 0x8ec9ff);
    for (const e of this.ennemisDansRayon(this.hero.x, this.hero.y, 140)) {
      this.repousser(e, this.hero.x, this.hero.y, 420);
      this.blesserEnnemi(e, this.hero.degats);
    }
    const aura = this.add
      .image(this.hero.x, this.hero.y, "impact")
      .setScale(3)
      .setAlpha(0.35)
      .setTint(0x8ec9ff)
      .setDepth(this.hero.y - 1);
    this.tweens.add({ targets: aura, alpha: 0, duration: 3500, onComplete: () => aura.destroy() });
  }

  /** Mage : frappe le groupe le plus dense a distance. */
  private ultimeMeteore(): void {
    const candidats = this.ennemisDansRayon(this.hero.x, this.hero.y, 340);
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
    this.cameras.main.shake(180, 0.007);
    for (const e of this.ennemisDansRayon(cible.x, cible.y, 110)) {
      this.blesserEnnemi(e, this.hero.degats * 4);
    }
  }

  /** Assassin : traverse la melee en laissant des cadavres derriere lui. */
  private ultimeOmbre(): void {
    const distance = 230;
    const depart = new Phaser.Math.Vector2(this.hero.x, this.hero.y);
    const arrivee = new Phaser.Math.Vector2(
      Phaser.Math.Clamp(this.hero.x + this.hero.regard.x * distance, MUR + 8, MONDE.largeur - MUR - 8),
      Phaser.Math.Clamp(this.hero.y + this.hero.regard.y * distance, MUR + 8, MONDE.hauteur - MUR - 8),
    );

    this.hero.rendreInvulnerable(500);
    const trainee = this.add
      .line(0, 0, depart.x, depart.y, arrivee.x, arrivee.y, 0x7ee0a0)
      .setOrigin(0)
      .setLineWidth(3)
      .setAlpha(0.75)
      .setDepth(this.hero.y - 1);
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
        this.blesserEnnemi(e, this.hero.degats * 5);
      }
    }
    this.hero.setPosition(arrivee.x, arrivee.y);
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
    // La puissance ne cesse jamais de monter : le jeu est sans fin (DESIGN.md §4.5).
    const puissance = ecoule / 45;
    const nombre = 1 + Math.floor(ecoule / 20);
    const intervalle = Math.max(320, 1500 - ecoule * 14);

    for (let i = 0; i < nombre; i++) this.faireApparaitreEnnemi(puissance);
    this.prochaineApparition = this.time.now + intervalle;
  }

  private faireApparaitreEnnemi(puissance: number): void {
    // Juste en dehors du champ de vision, quel que soit le zoom.
    const cam = this.cameras.main;
    const rayon = Math.max(cam.width, cam.height) / cam.zoom / 2 + 60;
    const angle = this.rng.range(0, Math.PI * 2);
    const x = Phaser.Math.Clamp(
      this.hero.x + Math.cos(angle) * rayon,
      MUR + 10,
      MONDE.largeur - MUR - 10,
    );
    const y = Phaser.Math.Clamp(
      this.hero.y + Math.sin(angle) * rayon,
      MUR + 10,
      MONDE.hauteur - MUR - 10,
    );

    this.ennemis.add(new Ennemi(this, x, y, puissance));
  }

  // --------------------------------------------------------------- degats

  private contactEnnemi(e: Ennemi): void {
    if (!e.active || this.termine || this.enPause) return;
    if (!e.peutFrapper(this.time.now)) return;
    e.marquerCoup(this.time.now);

    // Trait "riposte" du chevalier : il blesse ce qui le touche, esquive ou
    // non. Plus on l'attaque, plus il tue.
    if (this.hero.classe.trait === "riposte") {
      this.blesserEnnemi(e, Math.round(this.hero.degats * 0.9));
    }

    const esquive = this.hero.subirDegats(e.degats, this.rng.next());
    if (esquive) {
      this.flotter(this.hero.x, this.hero.y - 18, "Esquive", "#7ee0a0");
      return;
    }

    this.flotter(this.hero.x, this.hero.y - 18, `-${e.degats}`, "#ff6b5a");
    this.cameras.main.shake(90, 0.004);
    if (!this.hero.estVivant) this.finDePartie();
  }

  private finDePartie(): void {
    this.termine = true;
    this.physics.pause();
    this.effacerDestination();
    this.hero.setTint(0x6b6b6b);

    const resume = this.resume;
    this.events.emit("fin-de-partie", resume.secondes, resume.kills, resume.niveau);
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
