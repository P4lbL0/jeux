import Phaser from "phaser";
import { Rng } from "../core/rng";
import { CLASSES, type ClassId } from "../core/classes";
import { creerTexturesPlaceholder } from "../game/art";
import { Ennemi, Hero } from "../game/entities";
import { Hud } from "../game/hud";

/**
 * JALON 1 — l'arene.
 *
 * Cette scene ne sert qu'a repondre a une seule question (DESIGN.md §5) :
 * est-ce que se deplacer et lacher un ultime, c'est amusant pendant
 * 30 secondes ? Tout le reste — village, defenses, equipe, rangs — viendra
 * par-dessus, et seulement si la reponse est oui.
 */

const MONDE = { largeur: 1600, hauteur: 1200 };
const MUR = 16;

/** Portee au-dela de laquelle une classe est consideree comme distante */
const PORTEE_CORPS_A_CORPS = 60;

export class ArenaScene extends Phaser.Scene {
  private rng!: Rng;
  private hero!: Hero;
  private ennemis!: Phaser.Physics.Arcade.Group;
  private projectiles!: Phaser.Physics.Arcade.Group;
  private hud!: Hud;

  private zqsd!: Record<string, Phaser.Input.Keyboard.Key>;
  private fleches!: Phaser.Types.Input.Keyboard.CursorKeys;
  private touchesUltimes: Phaser.Input.Keyboard.Key[] = [];

  private debut = 0;
  private prochaineApparition = 0;
  private kills = 0;
  private termine = false;

  private stats!: Phaser.GameObjects.Text;

  constructor() {
    super("arena");
  }

  init(data: { classe?: ClassId }): void {
    const id = data.classe ?? "guerrier";
    this.registry.set("classe", id);
    this.kills = 0;
    this.termine = false;
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

    this.physics.add.overlap(this.hero, this.ennemis, (_h, e) =>
      this.contactEnnemi(e as Ennemi),
    );
    this.physics.add.overlap(this.projectiles, this.ennemis, (p, e) =>
      this.impactProjectile(p as Phaser.Physics.Arcade.Image, e as Ennemi),
    );

    this.hud = new Hud(this, this.hero);
    this.stats = this.add
      .text(0, 0, "", { fontFamily: "monospace", fontSize: "12px", color: "#f2e9d8" })
      .setScrollFactor(0)
      .setDepth(1003);

    this.debut = this.time.now;
    this.prochaineApparition = this.time.now + 800;
  }

  // ---------------------------------------------------------------- decor

  private construireDecor(): void {
    this.add
      .tileSprite(0, 0, MONDE.largeur, MONDE.hauteur, "herbe")
      .setOrigin(0)
      .setDepth(-1000);

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
    this.input.on(
      "wheel",
      (_p: unknown, _o: unknown, _dx: number, dy: number) => {
        const cam = this.cameras.main;
        cam.setZoom(Phaser.Math.Clamp(cam.zoom - dy * 0.0016, 1.4, 6));
      },
    );
  }

  private configurerTouches(): void {
    const clavier = this.input.keyboard;
    if (!clavier) return;
    // ZQSD et fleches en meme temps : pas besoin de choisir.
    this.zqsd = clavier.addKeys("Z,Q,S,D") as Record<string, Phaser.Input.Keyboard.Key>;
    this.fleches = clavier.createCursorKeys();
    // Une touche par ultime (DESIGN.md §4.2)
    this.touchesUltimes = [
      clavier.addKey(Phaser.Input.Keyboard.KeyCodes.ONE),
      clavier.addKey(Phaser.Input.Keyboard.KeyCodes.TWO),
      clavier.addKey(Phaser.Input.Keyboard.KeyCodes.THREE),
    ];
    clavier.addKey(Phaser.Input.Keyboard.KeyCodes.R).on("down", () => {
      if (this.termine) this.scene.start("choix-classe");
    });
  }

  // ---------------------------------------------------------------- boucle

  update(_temps: number, delta: number): void {
    if (this.termine) return;

    this.deplacerHero();
    this.deplacerEnnemis();
    this.attaqueAutomatique();
    this.gererUltimes();
    this.fairePartirLesVagues();
    this.trierProfondeurs();

    this.hud.rafraichir();
    const secondes = Math.floor((this.time.now - this.debut) / 1000);
    this.stats.setPosition(this.scale.width - 150, 16);
    this.stats.setText(`Survie : ${secondes}s\nElimines : ${this.kills}`);

    void delta;
  }

  private deplacerHero(): void {
    const dir = new Phaser.Math.Vector2(0, 0);
    if (this.zqsd["Q"]?.isDown || this.fleches.left.isDown) dir.x -= 1;
    if (this.zqsd["D"]?.isDown || this.fleches.right.isDown) dir.x += 1;
    if (this.zqsd["Z"]?.isDown || this.fleches.up.isDown) dir.y -= 1;
    if (this.zqsd["S"]?.isDown || this.fleches.down.isDown) dir.y += 1;

    // Normaliser : sans ca, la diagonale est 40% plus rapide.
    dir.normalize();
    if (dir.lengthSq() > 0) this.regarderVers(dir);
    this.hero.setVelocity(dir.x * this.hero.classe.vitesse, dir.y * this.hero.classe.vitesse);

    // Clignotement quand la vie est critique : le joueur doit le voir sans
    // quitter l'action des yeux.
    this.hero.setAlpha(
      this.hero.estCritique && Math.floor(this.time.now / 140) % 2 === 0 ? 0.55 : 1,
    );
  }

  private regarderVers(dir: Phaser.Math.Vector2): void {
    this.hero.regard.copy(dir);
    if (dir.x !== 0) this.hero.setFlipX(dir.x < 0);
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
    const cible = this.ennemiLePlusProche(this.hero.classe.portee);
    if (!cible) return;

    this.hero.marquerAttaque();
    if (this.hero.classe.portee <= PORTEE_CORPS_A_CORPS) {
      this.frapperAuContact(cible);
    } else {
      this.lancerProjectile(cible);
    }
  }

  private frapperAuContact(cible: Ennemi): void {
    const portee = this.hero.classe.portee;
    const angle = Phaser.Math.Angle.Between(this.hero.x, this.hero.y, cible.x, cible.y);

    // Touche tout ce qui se trouve dans un arc devant le heros, pas seulement
    // la cible : c'est ce qui rend le corps a corps agreable face a un groupe.
    for (const objet of this.ennemis.getChildren()) {
      const e = objet as Ennemi;
      if (!e.active) continue;
      const d = Phaser.Math.Distance.Between(this.hero.x, this.hero.y, e.x, e.y);
      if (d > portee) continue;
      const a = Phaser.Math.Angle.Between(this.hero.x, this.hero.y, e.x, e.y);
      if (Math.abs(Phaser.Math.Angle.Wrap(a - angle)) > Math.PI / 3) continue;
      this.blesserEnnemi(e, this.hero.classe.degats);
    }

    const arc = this.add
      .image(
        this.hero.x + Math.cos(angle) * portee * 0.55,
        this.hero.y + Math.sin(angle) * portee * 0.55,
        "impact",
      )
      .setDepth(this.hero.y + 1)
      .setScale(portee / 26)
      .setAlpha(0.5)
      .setTint(0xffe9a8);
    this.tweens.add({ targets: arc, alpha: 0, duration: 150, onComplete: () => arc.destroy() });
  }

  private lancerProjectile(cible: Ennemi): void {
    const p = this.projectiles.create(this.hero.x, this.hero.y, "projectile") as
      Phaser.Physics.Arcade.Image;
    p.setDepth(this.hero.y + 1);
    p.setTint(this.hero.classe.accent);
    const angle = Phaser.Math.Angle.Between(this.hero.x, this.hero.y, cible.x, cible.y);
    p.setVelocity(Math.cos(angle) * 340, Math.sin(angle) * 340);
    this.time.delayedCall(1400, () => p.destroy());
  }

  private impactProjectile(p: Phaser.Physics.Arcade.Image, e: Ennemi): void {
    if (!p.active || !e.active) return;
    p.destroy();
    this.blesserEnnemi(e, this.hero.classe.degats);
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
    e.pv -= degats;
    e.setTintFill(0xffffff);
    this.time.delayedCall(60, () => e.active && e.clearTint());

    if (e.pv > 0) return;
    this.kills += 1;
    const monte = this.hero.gagnerXp(e.xpDonnee);
    e.destroy();
    if (monte) this.celebrerNiveau();
  }

  private celebrerNiveau(): void {
    this.flotter(this.hero.x, this.hero.y - 22, `NIVEAU ${this.hero.niveau}`, "#5ec8f0");
    this.effetCercle(this.hero.x, this.hero.y, 70, 0x5ec8f0);
  }

  // -------------------------------------------------------------- ultimes

  private gererUltimes(): void {
    this.hero.classe.ultimes.forEach((ultime, i) => {
      const touche = this.touchesUltimes[i];
      if (!touche || !Phaser.Input.Keyboard.JustDown(touche)) return;
      if (!this.hero.peutLancerUltime(i)) return;
      this.hero.marquerUltime(i);
      this.flotter(this.hero.x, this.hero.y - 26, ultime.nom.toUpperCase(), "#f0c419");

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
    const rayon = 90;
    this.effetCercle(this.hero.x, this.hero.y, rayon, 0xff9d4a);
    for (const e of this.ennemisDansRayon(this.hero.x, this.hero.y, rayon)) {
      this.repousser(e, this.hero.x, this.hero.y, 260);
      this.blesserEnnemi(e, 28);
    }
  }

  /** Chevalier : invulnerable un temps, et il degage la place autour de lui. */
  private ultimeRempart(): void {
    this.hero.rendreInvulnerable(3000);
    this.effetCercle(this.hero.x, this.hero.y, 120, 0x8ec9ff);
    for (const e of this.ennemisDansRayon(this.hero.x, this.hero.y, 120)) {
      this.repousser(e, this.hero.x, this.hero.y, 380);
    }
    const aura = this.add
      .image(this.hero.x, this.hero.y, "impact")
      .setScale(3)
      .setAlpha(0.35)
      .setTint(0x8ec9ff)
      .setDepth(this.hero.y - 1);
    this.tweens.add({ targets: aura, alpha: 0, duration: 3000, onComplete: () => aura.destroy() });
  }

  /** Mage : frappe le groupe le plus dense a distance. */
  private ultimeMeteore(): void {
    const candidats = this.ennemisDansRayon(this.hero.x, this.hero.y, 320);
    if (candidats.length === 0) return;

    let cible = candidats[0]!;
    let meilleurCompte = -1;
    for (const e of candidats) {
      const compte = this.ennemisDansRayon(e.x, e.y, 90).length;
      if (compte > meilleurCompte) {
        meilleurCompte = compte;
        cible = e;
      }
    }

    this.effetCercle(cible.x, cible.y, 100, 0xd06bff);
    for (const e of this.ennemisDansRayon(cible.x, cible.y, 100)) {
      this.blesserEnnemi(e, 60);
    }
  }

  /** Assassin : traverse la melee en laissant des cadavres derriere lui. */
  private ultimeOmbre(): void {
    const distance = 210;
    const depart = new Phaser.Math.Vector2(this.hero.x, this.hero.y);
    const arrivee = new Phaser.Math.Vector2(
      Phaser.Math.Clamp(this.hero.x + this.hero.regard.x * distance, MUR + 8, MONDE.largeur - MUR - 8),
      Phaser.Math.Clamp(this.hero.y + this.hero.regard.y * distance, MUR + 8, MONDE.hauteur - MUR - 8),
    );

    this.hero.rendreInvulnerable(450);
    const trainee = this.add
      .line(0, 0, depart.x, depart.y, arrivee.x, arrivee.y, 0x7ee0a0)
      .setOrigin(0)
      .setLineWidth(3)
      .setAlpha(0.7)
      .setDepth(this.hero.y - 1);
    this.tweens.add({ targets: trainee, alpha: 0, duration: 300, onComplete: () => trainee.destroy() });

    const segment = new Phaser.Geom.Line(depart.x, depart.y, arrivee.x, arrivee.y);
    for (const objet of this.ennemis.getChildren()) {
      const e = objet as Ennemi;
      if (!e.active) continue;
      const proche = Phaser.Geom.Line.GetNearestPoint(segment, e, new Phaser.Geom.Point());
      if (Phaser.Math.Distance.Between(proche.x, proche.y, e.x, e.y) <= 42) {
        this.blesserEnnemi(e, 40);
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
    const x = Phaser.Math.Clamp(this.hero.x + Math.cos(angle) * rayon, MUR + 10, MONDE.largeur - MUR - 10);
    const y = Phaser.Math.Clamp(this.hero.y + Math.sin(angle) * rayon, MUR + 10, MONDE.hauteur - MUR - 10);

    const e = new Ennemi(this, x, y, puissance);
    this.ennemis.add(e);
  }

  // --------------------------------------------------------------- degats

  private contactEnnemi(e: Ennemi): void {
    if (!e.active || this.termine) return;
    if (!e.peutFrapper(this.time.now)) return;
    e.marquerCoup(this.time.now);

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
    this.hero.setTint(0x6b6b6b);

    const secondes = Math.floor((this.time.now - this.debut) / 1000);
    const cam = this.cameras.main;
    this.add
      .text(
        cam.width / 2,
        cam.height / 2,
        `Le heros est tombe.\n\n${secondes} secondes  ·  ${this.kills} elimines\n\nR pour recommencer`,
        {
          fontFamily: "monospace",
          fontSize: "20px",
          color: "#f2e9d8",
          align: "center",
          backgroundColor: "#1b1720dd",
          padding: { x: 24, y: 20 },
        },
      )
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(2000);
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
