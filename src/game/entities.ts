import Phaser from "phaser";
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
} from "../core/competences";

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
export class Hero extends Phaser.Physics.Arcade.Sprite {
  readonly classe: ClasseDef;
  readonly bonus: Bonus = bonusVierge();
  /** Palier atteint pour chaque competence, par identifiant */
  readonly competences: CompetencesPossedees = {};
  /** Evolution choisie pour une competence, par identifiant de competence */
  readonly evolutions: Record<string, EvolutionDef> = {};

  pv: number;
  niveau = 1;
  xp = 0;
  kills = 0;
  etat: EtatHero = "combat";
  estIncarne = false;
  /** Choix de competence gagnes mais pas encore faits (DESIGN.md §4.3) */
  choixEnAttente = 0;
  regard = new Phaser.Math.Vector2(1, 0);

  /** Points de vie maximum gagnes par la Provocation, cumules pour la partie */
  pvGagnesProvocation = 0;
  /** Resistance temporaire, recalculee chaque image par la scene */
  resistanceTemporaire = 0;
  /** Multiplicateur de vitesse temporaire (invisibilite, etc.) */
  multiplicateurVitesse = 1;

  private prochaineAttaque = 0;
  private prochaines: Record<string, number> = {};
  private invulnerableJusqua = 0;
  private invisibleJusqua = 0;
  private immobiliseJusqua = 0;
  /** Pendant l'Exil : insoignable, et le moindre contact est fatal */
  private condamneJusqua = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, classe: ClasseDef) {
    super(scene, x, y, `hero-${classe.id}`);
    this.classe = classe;
    this.pv = classe.pvMax;
    if (classe.id === "assassin") this.bonus.discretion = true;

    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setCollideWorldBounds(true);
    this.body?.setSize(8, 10);
    (this.body as Phaser.Physics.Arcade.Body).setOffset(2, 5);
  }

  // ------------------------------------------------- statistiques effectives

  /** Nombre de tranches de kills franchies */
  get tranches(): number {
    return Math.floor(this.kills / TRANCHE_KILLS);
  }

  get pvMax(): number {
    const base =
      this.classe.pvMax +
      this.bonus.pvMax +
      (this.niveau - 1) * 6 +
      this.tranches * this.bonus.pvParTranche +
      this.pvGagnesProvocation;
    return Math.round(base * this.bonus.multiplicateurGlobal);
  }

  get degats(): number {
    const base =
      (this.classe.degats + this.bonus.degats) * (1 + this.tranches * this.bonus.degatsParTranche);
    return Math.max(1, Math.round(base * this.bonus.multiplicateurGlobal));
  }

  get vitesse(): number {
    return (
      (this.classe.vitesse + this.bonus.vitesse) *
      this.bonus.multiplicateurGlobal *
      this.multiplicateurVitesse
    );
  }

  /**
   * Rage du guerrier : chaque point de pourcentage de vie manquante accelere
   * l'attaque. Un guerrier a l'agonie est un guerrier terrifiant.
   */
  get cadence(): number {
    const manquant = (1 - Phaser.Math.Clamp(this.ratioPv, 0, 1)) * 100;
    return (this.classe.cadence * this.bonus.cadence) / (1 + this.bonus.rageParPvManquant * manquant);
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

  /** Sous ce seuil, le changement de heros est verrouille (DESIGN.md §4.3) */
  get estCritique(): boolean {
    return this.ratioPv <= SEUIL_CRITIQUE;
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

  soigner(montant: number): void {
    if (this.estCondamne) return;
    this.pv = Math.min(this.pvMax, this.pv + montant);
  }

  mourir(): void {
    this.etat = "mort";
    this.pv = 0;
    this.estIncarne = false;
    this.setVelocity(0, 0);
    this.setTint(0x4a4152);
    this.setAlpha(0.55);
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

  marquerCapacite(capacite: Capacite): void {
    this.prochaines[capacite.id] = this.scene.time.now + capacite.rechargement;
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

  get palierMaxAtteint(): boolean {
    return false;
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
    if (evolution.teinte !== undefined) this.setTint(evolution.teinte);
  }
}

export class Ennemi extends Phaser.Physics.Arcade.Sprite {
  pv: number;
  pvMax: number;
  vitesse: number;
  degats: number;
  xpDonnee: number;
  /** Cible provoquee : le Chevalier Sacre force les ennemis a le viser */
  provoquePar: Hero | null = null;
  ralentiJusqua = 0;
  private prochainCoup = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, puissance: number) {
    super(scene, x, y, "ennemi");
    this.pvMax = Math.round(10 + puissance * 6);
    this.pv = this.pvMax;
    this.vitesse = 42 + puissance * 3;
    this.degats = Math.round(6 + puissance * 2);
    this.xpDonnee = 1;

    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.body?.setSize(8, 9);
    (this.body as Phaser.Physics.Arcade.Body).setOffset(2, 4);
  }

  get vitesseEffective(): number {
    return this.scene.time.now < this.ralentiJusqua ? this.vitesse * 0.5 : this.vitesse;
  }

  ralentir(duree: number): void {
    this.ralentiJusqua = Math.max(this.ralentiJusqua, this.scene.time.now + duree);
  }

  peutFrapper(maintenant: number): boolean {
    return maintenant >= this.prochainCoup;
  }

  marquerCoup(maintenant: number): void {
    this.prochainCoup = maintenant + 700;
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
