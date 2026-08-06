import Phaser from "phaser";
import type { ClasseDef } from "../core/classes";
import { SEUIL_CRITIQUE, xpPourNiveauSuivant } from "../core/classes";
import { bonusVierge, type Bonus, type CompetenceDef } from "../core/competences";

/**
 * Le heros incarne par le joueur.
 *
 * Il ne connait que son etat propre : vie, niveau, competences, rechargements.
 * Tout ce qui concerne le monde (les ennemis, la camera, les degats) est gere
 * par la scene. C'est ce qui permettra de brancher une IA sur exactement le
 * meme objet au jalon 3 (DESIGN.md §4.3).
 *
 * Les statistiques sont toujours lues via les getters "effectifs" : la valeur
 * de base de la classe plus les bonus accumules. Rien ne modifie jamais
 * directement les donnees de la classe.
 */
export class Hero extends Phaser.Physics.Arcade.Sprite {
  readonly classe: ClasseDef;
  readonly bonus: Bonus = bonusVierge();
  /** Combien de fois chaque competence a ete prise, par identifiant */
  readonly competencesPrises: Record<string, number> = {};

  pv: number;
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

  // ------------------------------------------------- statistiques effectives

  get pvMax(): number {
    return this.classe.pvMax + this.bonus.pvMax + (this.niveau - 1) * 6;
  }

  get degats(): number {
    return this.classe.degats + this.bonus.degats;
  }

  get vitesse(): number {
    return this.classe.vitesse + this.bonus.vitesse;
  }

  get cadence(): number {
    return this.classe.cadence * this.bonus.cadence;
  }

  get portee(): number {
    return this.classe.portee + this.bonus.portee;
  }

  /** Plafonnee : une esquive de 100% rendrait le heros invincible. */
  get esquive(): number {
    return Math.min(0.6, this.classe.esquive + this.bonus.esquive);
  }

  get critChance(): number {
    const base = this.classe.trait === "critique" ? 0.25 : 0;
    return Math.min(0.85, base + this.bonus.critChance);
  }

  get critMultiplicateur(): number {
    return this.bonus.critMultiplicateur;
  }

  // -------------------------------------------------------------- etat vital

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

  soigner(montant: number): void {
    this.pv = Math.min(this.pvMax, this.pv + montant);
  }

  /** Renvoie true si les degats ont ete esquives */
  subirDegats(degats: number, tirageEsquive: number): boolean {
    if (this.estInvulnerable) return true;
    if (tirageEsquive < this.esquive) return true;
    this.pv = Math.max(0, this.pv - degats);
    return false;
  }

  // ---------------------------------------------------------- rechargements

  peutAttaquer(): boolean {
    return this.scene.time.now >= this.prochaineAttaque;
  }

  marquerAttaque(): void {
    this.prochaineAttaque = this.scene.time.now + this.cadence;
  }

  /** Rechargement restant d'un ultime, de 0 (pret) a 1 (vient d'etre lance) */
  chargeUltime(index: number): number {
    const def = this.classe.ultimes[index];
    const pret = this.prochainsUltimes[index];
    if (!def || pret === undefined) return 1;
    const restant = pret - this.scene.time.now;
    return restant <= 0 ? 0 : restant / (def.rechargement * this.bonus.rechargementUltime);
  }

  peutLancerUltime(index: number): boolean {
    return this.chargeUltime(index) === 0;
  }

  marquerUltime(index: number): void {
    const def = this.classe.ultimes[index];
    if (!def) return;
    this.prochainsUltimes[index] =
      this.scene.time.now + def.rechargement * this.bonus.rechargementUltime;
  }

  /**
   * Repousse tous les rechargements. Sert quand le jeu se met en pause pour
   * choisir une competence : sans ca, le temps de pause rechargerait les
   * ultimes gratuitement.
   */
  decalerRechargements(millisecondes: number): void {
    this.prochaineAttaque += millisecondes;
    this.invulnerableJusqua += millisecondes;
    this.prochainsUltimes = this.prochainsUltimes.map((t) => t + millisecondes);
  }

  // ------------------------------------------------------------- progression

  /** Renvoie true si le heros a gagne un niveau */
  gagnerXp(montant: number): boolean {
    this.xp += montant;
    if (this.xp < this.xpRequise) return false;
    this.xp -= this.xpRequise;
    this.niveau += 1;
    // Le gain de vie maximum du niveau est aussi rendu en vie.
    this.pv = Math.min(this.pvMax, this.pv + 6);
    return true;
  }

  get xpRequise(): number {
    return xpPourNiveauSuivant(this.niveau);
  }

  apprendre(competence: CompetenceDef): void {
    const avant = this.pvMax;
    competence.appliquer(this.bonus);
    // Gagner de la vie maximum doit aussi rendre cette vie, sinon la
    // competence baisse le pourcentage de vie du heros au lieu de l'aider.
    this.pv += Math.max(0, this.pvMax - avant);
    if (competence.soinComplet) this.pv = this.pvMax;
    this.competencesPrises[competence.id] = (this.competencesPrises[competence.id] ?? 0) + 1;
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
