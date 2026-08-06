import Phaser from "phaser";
import type { ClasseDef } from "../core/classes";
import { SEUIL_CRITIQUE, xpPourNiveauSuivant } from "../core/classes";

/**
 * Le heros incarne par le joueur.
 *
 * Il ne connait que son etat propre : ses points de vie, son niveau, ses
 * rechargements. Tout ce qui concerne le monde (les ennemis, les degats, la
 * camera) est gere par la scene. C'est ce qui permettra plus tard de brancher
 * une IA sur exactement le meme objet (DESIGN.md §4.3).
 */
export class Hero extends Phaser.Physics.Arcade.Sprite {
  readonly classe: ClasseDef;
  pv: number;
  pvMax: number;
  niveau = 1;
  xp = 0;
  /** Direction du dernier deplacement, utilisee par les ultimes directionnels */
  regard = new Phaser.Math.Vector2(1, 0);

  private prochaineAttaque = 0;
  private prochainsUltimes: number[];
  private invulnerableJusqua = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, classe: ClasseDef) {
    super(scene, x, y, `hero-${classe.id}`);
    this.classe = classe;
    this.pvMax = classe.pvMax;
    this.pv = classe.pvMax;
    this.prochainsUltimes = classe.ultimes.map(() => 0);

    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setCollideWorldBounds(true);
    // Boite de collision reduite au corps : l'ombre et l'arme ne doivent pas
    // encaisser de degats a la place du perso.
    this.body?.setSize(8, 10);
    (this.body as Phaser.Physics.Arcade.Body).setOffset(2, 5);
  }

  get ratioPv(): number {
    return this.pv / this.pvMax;
  }

  /** Sous ce seuil, le changement de heros sera verrouille (DESIGN.md §4.3) */
  get estCritique(): boolean {
    return this.ratioPv <= SEUIL_CRITIQUE;
  }

  get estVivant(): boolean {
    return this.pv > 0;
  }

  get estInvulnerable(): boolean {
    return this.scene.time.now < this.invulnerableJusqua;
  }

  rendreInvulnerable(duree: number): void {
    this.invulnerableJusqua = Math.max(this.invulnerableJusqua, this.scene.time.now + duree);
  }

  peutAttaquer(): boolean {
    return this.scene.time.now >= this.prochaineAttaque;
  }

  marquerAttaque(): void {
    this.prochaineAttaque = this.scene.time.now + this.classe.cadence;
  }

  /** Rechargement restant d'un ultime, de 0 (pret) a 1 (vient d'etre lance) */
  chargeUltime(index: number): number {
    const def = this.classe.ultimes[index];
    const pret = this.prochainsUltimes[index];
    if (!def || pret === undefined) return 1;
    const restant = pret - this.scene.time.now;
    return restant <= 0 ? 0 : restant / def.rechargement;
  }

  peutLancerUltime(index: number): boolean {
    return this.chargeUltime(index) === 0;
  }

  marquerUltime(index: number): void {
    const def = this.classe.ultimes[index];
    if (!def) return;
    this.prochainsUltimes[index] = this.scene.time.now + def.rechargement;
  }

  /** Renvoie true si les degats ont ete esquives */
  subirDegats(degats: number, rngEsquive: number): boolean {
    if (this.estInvulnerable) return true;
    if (rngEsquive < this.classe.esquive) return true;
    this.pv = Math.max(0, this.pv - degats);
    return false;
  }

  /** Renvoie true si le heros a gagne un niveau */
  gagnerXp(montant: number): boolean {
    this.xp += montant;
    const requis = xpPourNiveauSuivant(this.niveau);
    if (this.xp < requis) return false;
    this.xp -= requis;
    this.niveau += 1;
    // Jalon 1 : la montee de niveau n'est qu'un gain brut. Le choix
    // d'amelioration avec mise en pause arrive au jalon 2 (DESIGN.md §4.8).
    this.pvMax += 8;
    this.pv = Math.min(this.pvMax, this.pv + 25);
    return true;
  }

  get xpRequise(): number {
    return xpPourNiveauSuivant(this.niveau);
  }
}

export class Ennemi extends Phaser.Physics.Arcade.Sprite {
  pv: number;
  vitesse: number;
  degats: number;
  xpDonnee: number;
  private prochainCoup = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, puissance: number) {
    super(scene, x, y, "ennemi");
    // La puissance monte avec le temps : la vague ne s'arrete jamais de durcir.
    this.pv = Math.round(10 + puissance * 6);
    this.vitesse = 42 + puissance * 3;
    this.degats = Math.round(6 + puissance * 2);
    this.xpDonnee = 1;

    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.body?.setSize(8, 9);
    (this.body as Phaser.Physics.Arcade.Body).setOffset(2, 4);
  }

  peutFrapper(maintenant: number): boolean {
    return maintenant >= this.prochainCoup;
  }

  marquerCoup(maintenant: number): void {
    this.prochainCoup = maintenant + 700;
  }
}
