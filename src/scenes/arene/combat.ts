import Phaser from "phaser";
import { PENETRATION, penetrationDe } from "../../core/competences";
import { REGLAGES_FUSIONS } from "../../core/fusions";
import { abimerLeSol } from "../../game/dessin/morceaux";
import { REGLAGES_BUTIN, encaisser, orDUneBete } from "../../core/butin";
import { Ennemi, Hero } from "../../game/entities";
import { teinteDeNuee } from "../../game/ennemis";
import { RANGS } from "../../core/rangs";
import { auPalier } from "../../core/elements";
import { declencher } from "../../game/poses";
import { eclatImpact, poufMort, secousse, tranche } from "../../game/effets";
import { RELEVEMENT, coutEnArgent, lireCout, type NiveauEglise } from "../../core/eglise";
import { unCoupAllumeLeFeu } from "../../core/incendie";
import { type Villageois } from "../../game/village";
import { Construction } from "../../game/constructions";
import { type Champ } from "../../game/champs";
import { Maison } from "../../game/maisons";
import { PART_DE_COUPS_REFUSES } from "../../core/traits";
import type { ArenaScene } from "../ArenaScene";
import { PORTEE_CORPS_A_CORPS, lireBlocages, MAX_CADAVRES } from "./reglages";

/**
 * Le combat : frapper, tirer, les projectiles, les éclairs, cogner les constructions,
 * blesser, tuer, le butin.
 *
 * Une part d'`ArenaScene`, greffée sur son prototype (`greffer`) : `this` est la scène.
 */
export class ArenaCombat {

  // ------------------------------------------------------------- attaques

  attaquerAvec(this: ArenaScene, hero: Hero): void {
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
    // La fente part vers la cible, et sa duree est calee sur celle de l'eclair
    // d'impact : le geste et le coup doivent se lire comme un seul evenement.
    declencher(hero.pose, hero, "attaque", this.time.now, cible);
    if (hero.portee <= PORTEE_CORPS_A_CORPS) this.frapperAuContact(hero, cible);
    else this.lancerProjectile(hero, cible);

    // Trait de l'Oracle : chacune de ses attaques recoud l'allie le plus
    // mal en point autour d'elle. Elle soigne en se battant.
    if (hero.classe.trait === "soin-de-zone") this.soignerLePlusBlesse(hero, 240, 4);
  }

  /**
   * Une horde traverse un champ : il est perdu (DESIGN.md §4.18).
   *
   * C'est la raison d'etre du ble. La peche est adossee a un flanc ferme, donc
   * rien ne peut jamais l'atteindre — et une ressource qu'on ne peut pas perdre
   * ne fait rien travailler.
   */
  pietinerChamp(this: ArenaScene, champ: Champ): void {
    if (this.termine || this.enPause) return;
    if (!this.champs.pietiner(champ)) return;

    poufMort(this, champ.x, champ.y, 0xd8b64a);
    // Il ne reste que de la terre pietinee la ou le ble poussait.
    abimerLeSol(this.carte, champ.x, champ.y, "terre", 18);
    this.events.emit("annonce", "Un champ est ravage", "guet");
  }

  cognerConstruction(this: ArenaScene, e: Ennemi, construction: Construction): void {
    if (!e.active || this.termine || this.enPause) return;
    // Un trou ne se frappe pas : devant une douve en eau, on cherche la porte.
    if (construction.def.indestructible) return;
    if (!e.peutFrapper(this.time.now)) return;

    e.marquerCoup(this.time.now);
    declencher(e.pose, e, "attaque", this.time.now, construction);
    eclatImpact(this, construction.x, construction.y, 0xbfae8a);

    if (!this.constructions.blesser(construction, e.degats, this.time.now)) return;

    poufMort(this, construction.x, construction.y, 0xbfae8a);
    secousse(this, "fort");
    // La ou un mur tombe, la terre est retournee : le sol se souvient.
    abimerLeSol(this.carte, construction.x, construction.y, "terre", 20);
    if (construction.occupant) this.ejecterDeLaTour(construction);
    else this.constructions.detruire(construction);
    // ⚠️ **Un front qui cede est le troisieme moment ou l'on regarde si
    // quelqu'un prend une initiative** (§4.27). C'est un mur qui tombe, pas
    // une vague qui s'annonce : le Peureux lache son poste maintenant, pas
    // quand on lui a dit que des monstres arrivaient.
    this.chercherDesInitiatives(true);
  }

  /**
   * Les monstres cognent une maison (§4.24). Meme forme que
   * `cognerConstruction` : la cadence du monstre sert de garde.
   */
  cognerMaison(this: ArenaScene, e: Ennemi, maison: Maison): void {
    if (!e.active || this.termine || this.enPause || !maison.debout) return;
    if (!e.peutFrapper(this.time.now)) return;

    e.marquerCoup(this.time.now);
    declencher(e.pose, e, "attaque", this.time.now, maison);
    const centre = maison.centre;
    eclatImpact(this, centre.x, centre.y, 0xbfae8a);

    if (!this.maisons.blesser(maison, e.degats, this.time.now)) {
      // Sous 30 % de vie, une fois sur deux, ce qu'ils cognent prend feu
      // (§4.21). La regle vit dans `core/incendie.ts` : ici on ne fait que
      // l'interroger apres le coup.
      if (unCoupAllumeLeFeu(maison.ratioPv, this.rng)) {
        this.mettreLeFeu(maison, `Une ${maison.nom.toLowerCase()} prend feu sous leurs coups`);
      }
      return;
    }

    poufMort(this, centre.x, centre.y, 0xbfae8a);
    secousse(this, "fort");
    abimerLeSol(this.carte, centre.x, centre.y, "brule", 26);
    this.events.emit("annonce", `Une ${maison.nom.toLowerCase()} est tombee — L pour la relever`, "village");
  }

  /**
   * La touche Y : monter l'eglise, ou relancer son chantier (DESIGN.md §4.22).
   *
   * Une seule touche pour deux gestes exclusifs — elle est debout ou elle est a
   * terre, jamais les deux. Le refus **dit toujours ce qui manque** : quatre
   * conditions dont on ne saurait pas laquelle bloque seraient injouables.
   */
  oeuvrerALEglise(this: ArenaScene): void {
    if (!this.eglise.fonctionne) {
      if (this.eglise.regles.etat === "relevement") {
        const part = Math.round(this.eglise.regles.partRelevement * 100);
        this.events.emit("annonce", `Le chantier avance — ${part}%`, "eglise");
        return;
      }
      if (!this.eglise.lancerRelevement(this.village.stocks)) {
        this.events.emit(
          "annonce",
          `Il faut ${lireCout(RELEVEMENT.cout)} pour relever l'eglise`,
          "toi",
        );
      }
      return;
    }

    const contexte = this.contexteMontee;
    const verdict = this.eglise.regles.peutMonter(contexte);

    if (!verdict.possible) {
      const vise = (this.eglise.niveau + 1) as 2 | 3 | 4;
      this.events.emit("annonce", `Eglise : il manque ${lireBlocages(verdict.manque, vise)}`, "toi");
      return;
    }

    // L'argent se preleve ici : `monter` ne recoit qu'un nombre et n'a aucun
    // moyen d'ecrire dans la bourse du village (§4.8).
    const vise = (this.eglise.niveau + 1) as NiveauEglise;
    this.eglise.regles.monter(contexte);
    this.argent -= coutEnArgent(vise);
    this.eglise.monterDUnNiveau();
    secousse(this, "leger");
  }

  /**
   * Les monstres cognent l'eglise (DESIGN.md §4.22).
   *
   * Meme forme que `cognerConstruction` : la cadence du monstre sert de garde,
   * donc rien de nouveau ne tourne par image.
   */
  cognerEglise(this: ArenaScene, e: Ennemi): void {
    if (!e.active || this.termine || this.enPause) return;
    if (!this.eglise.fonctionne) return;
    if (!e.peutFrapper(this.time.now)) return;

    e.marquerCoup(this.time.now);
    declencher(e.pose, e, "attaque", this.time.now, this.eglise.sprite);
    eclatImpact(this, this.eglise.sprite.x, this.eglise.sprite.y, 0xbfae8a);
    this.eglise.encaisser(e.degats, this.time.now);
  }

  /**
   * Un defenseur civil frappe (DESIGN.md §4.18).
   *
   * Le village ne connait pas les monstres, et il ne doit pas : il demande, la
   * scene trouve la cible et applique les degats.
   *
   * @returns vrai s'il a touche quelque chose
   */
  frapperPourLeVillage(
    this: ArenaScene,
    x: number,
    y: number,
    portee: number,
    degats: number,
  ): boolean {
    const cible = this.ennemiLePlusProche(x, y, portee);
    if (!cible) return false;

    // Pas d'auteur : un habitant ne gagne pas d'experience de heros, ne
    // declenche aucun vol de vie et ne remplit aucune jauge d'ultime. C'est ce
    // qui l'empeche de deriver vers le second jeu que le §4.18 refuse.
    cible.pv -= degats;
    cible.flashJusqua = this.time.now + 70;
    eclatImpact(this, cible.x, cible.y - 4, cible.archetype.couleurImpact, 2);
    if (cible.pv > 0) return true;

    // ⚠️ `marquerLaMort` ne fait que **le visuel** : il faut detruire le sprite
    // soi-meme. Une premiere version s'arretait a l'effet, et un monstre tue par
    // un civil continuait a marcher et a frapper avec des points de vie
    // negatifs. Trouve en jouant.
    const mortX = cible.x;
    const mortY = cible.y;
    this.kills += 1;
    this.killsDeLaNuit += 1;
    this.marquerLaMort(cible);
    cible.destroy();
    // Le cadavre se releve pour le Necromancien comme n'importe quel autre : le
    // §4.14 ne demande pas que ce soit un heros qui ait porte le coup.
    this.tenterRelevement(mortX, mortY);
    return true;
  }

  /**
   * Un monstre a touche un habitant.
   *
   * Il meurt — **sauf s'il tient les portes de l'eglise**, auquel cas il
   * encaisse sur ses points de vie (§4.18, §4.22). Sans cette nuance, sortir
   * defendre serait un suicide pur et le courage ne servirait a rien.
   */
  rattraperHabitant(this: ArenaScene, villageois: Villageois, e: Ennemi): void {
    if (!e.active || !villageois.regles.vivant || this.termine || this.enPause) return;

    if (!this.village.encaisserOuTuer(villageois, e.degats)) {
      eclatImpact(this, villageois.x, villageois.y - 4, 0xd8c48a, 2);
      // Il a survecu au coup : c'est exactement la ou un don se reveille
      // (§4.1, bloc 9). La voie noble ne se declenche qu'au bord de la mort.
      this.guetterLeReveil(villageois);
      return;
    }

    poufMort(this, villageois.x, villageois.y, 0xd8c48a);
    secousse(this, "fort");

    // Le village, c'est sa population : quand il n'y a plus personne, la partie
    // est finie (§4.18).
    if (this.village.eteint) this.finDePartie();
  }

  soignerLePlusBlesse(this: ArenaScene, source: Hero, rayon: number, montant: number): void {
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

  frapperAuContact(this: ArenaScene, hero: Hero, cible: Ennemi): void {
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

    // Le meme arc qu'avant, mais sorti d'ici : c'est desormais la brique que
    // les monstres utilisent aussi quand ils frappent (`effets.tranche`).
    tranche(this, hero.x, hero.y, angle, 0xffe9a8, portee);
  }

  lancerProjectile(this: ArenaScene, hero: Hero, cible: Ennemi): void {
    const angle = Phaser.Math.Angle.Between(hero.x, hero.y, cible.x, cible.y);
    // Trait du Rodeur : une volee en eventail plutot qu'un seul trait.
    // Proliferation (§4.13) : un projectile de plus, volee comprise.
    const nombre =
      (hero.classe.trait === "volee" ? 3 + hero.bonus.flechesSupplementaires : 1) + hero.bonus.projectiles;

    for (let i = 0; i < nombre; i++) {
      const ecart = (i - (nombre - 1) / 2) * 0.15;
      this.tirer(hero, angle + ecart);
    }
  }

  tirer(this: ArenaScene, hero: Hero, angle: number): void {
    const p = this.projectiles.create(hero.x, hero.y, "projectile") as Phaser.Physics.Arcade.Image;
    p.setDepth(hero.y + 1);
    p.setTint(hero.classe.accent);
    p.setData("auteur", hero);
    p.setVelocity(Math.cos(angle) * 340, Math.sin(angle) * 340);
    this.time.delayedCall(1400, () => p.destroy());
  }

  impactProjectile(this: ArenaScene, p: Phaser.Physics.Arcade.Image, e: Ennemi): void {
    if (!p.active || !e.active) return;
    const auteur = p.getData("auteur") as Hero | undefined;
    if (!auteur || auteur.etat === "mort") {
      p.destroy();
      return;
    }

    // La penetration (§4.25) : un projectile traverse un nombre de monstres,
    // puis s'arrete. Il faut se souvenir de qui il a deja touche, sinon il
    // blesse la meme cible a chaque image.
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

    if (touches.size >= penetrationDe(PENETRATION.projectile, auteur.bonus, true)) p.destroy();
  }

  frapper(this: ArenaScene, auteur: Hero, e: Ennemi): void {
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
  propagerEclairs(
    this: ArenaScene,
    auteur: Hero,
    x: number,
    y: number,
    origine: Ennemi,
    degats: number,
  ): void {
    if (auteur.bonus.chaineEclairs <= 0) return;

    // Reseau electrique (§4.25) : plus de sauts, plus loin, et un eclair peut
    // revenir sur une cible deja frappee — dans une foule serree, le courant
    // tourne en boucle au lieu de s'eteindre.
    const reseau = auteur.palierReel("reseau-electrique");
    const reglage = REGLAGES_FUSIONS.reseauElectrique;
    const sauts =
      (auteur.bonus.chaineDiffuse ? 8 : auteur.bonus.chaineFulgurante ? 2 : auteur.bonus.chaineEclairs) +
      (reseau > 0 ? auPalier(reglage.sautsEnPlus, reseau) : 0);
    const portee = reseau > 0 ? auPalier(reglage.portee, reseau) : 130;
    const sansAffaiblissement = reseau > 0 && auPalier(reglage.sansAffaiblissement, reseau);
    const touches = new Set<Ennemi>([origine]);
    let depuis = { x, y };
    let ici: Ennemi = origine;
    let force = degats;

    for (let i = 0; i < sauts; i++) {
      if (!sansAffaiblissement) {
        force *= auteur.bonus.chaineDiffuse ? 0.55 : auteur.bonus.chaineFulgurante ? 1.6 : 0.8;
      }
      const autour = this.ennemisDansRayon(depuis.x, depuis.y, portee);
      const suivant =
        autour.find((e) => !touches.has(e)) ?? (reseau > 0 ? autour.find((e) => e !== ici && e.active) : undefined);
      if (!suivant) return;

      touches.add(suivant);
      this.trainee(depuis.x, depuis.y, suivant.x, suivant.y, reseau > 0 ? 0xbfe8ff : 0x8ed6ff);
      depuis = { x: suivant.x, y: suivant.y };
      ici = suivant;
      this.blesserEnnemi(suivant, Math.max(1, Math.round(force)), auteur);
    }
  }

  /**
   * Le Misericordieux baisse son arme (DESIGN.md §4.23, §4.12).
   *
   * **C'est le premier trait du jeu qui desobeit**, et une desobeissance
   * s'annonce : un heros qui s'arrete sans prevenir serait vecu comme un bug.
   * On le dit une fois par partie — le journal n'a pas a repeter un coup sur
   * trois pendant toute une bagarre.
   */
  refuserDeFrapper(this: ArenaScene, auteur: Hero, e: Ennemi): void {
    this.flotter(e.x, e.y - 16, "il ne peut pas", "#9db3c4");
    if (this.refusDeFrapperAnnonce) return;
    this.refusDeFrapperAnnonce = true;
    this.events.emit(
      "annonce",
      `${auteur.personne.nom} ne se resout pas a frapper quelqu'un`,
      "toi",
    );
  }

  /**
   * Ce que laisse un mort (DESIGN.md §4.29, §4.8).
   *
   * Une bete vaut son experience en menue monnaie ; un humain laisse ce qu'il
   * avait sur lui. ⚠️ **L'argent reste un entier** : on garde la monnaie d'une
   * mort a l'autre plutot que d'arrondir chaque cadavre (`core/butin.ts`), et
   * on ne l'affiche que quand une piece entiere tombe — un « +0 » a chaque
   * fonceur ne dirait rien.
   */
  ramasserLeButin(this: ArenaScene, e: Ennemi, auteur: Hero): void {
    // Cupidite (§4.13) : il fouille mieux les cadavres de ceux qu'il abat.
    const gain = (e.humain ? REGLAGES_BUTIN.orDUnHumain : orDUneBete(e.xpDonnee)) * auteur.bonus.or;
    const bourse = encaisser(this.resteDeButin, gain);
    this.resteDeButin = bourse.reste;
    if (bourse.pieces <= 0) return;
    this.argent += bourse.pieces;
    this.flotter(e.x, e.y - 20, `+${bourse.pieces}`, "#c99a3a");
  }

  /**
   * Le monstre debout le plus proche, strictement a moins de `portee`.
   *
   * ⚠️ **Il lit le voisinage** (§4.33, palier 1) : les positions du dernier pas
   * de physique, qui sont celles des sprites pendant toute l'image. Un monstre
   * ne pendant l'image n'y est qu'au pas suivant — seize millisecondes.
   */
  ennemiLePlusProche(this: ArenaScene, x: number, y: number, portee: number): Ennemi | null {
    const i = this.voisinage.laPlusProche(x, y, portee, this.monstreDebout);
    return i < 0 ? null : this.horde[i]!;
  }

  blesserEnnemi(this: ArenaScene, e: Ennemi, degats: number, auteur: Hero, volDeVieSup = 0): void {
    if (!e.active) return;
    // ⚠️ **Les deux traits qui regardent qui est en face passent ici, et nulle
    // part ailleurs** (§4.23) : c'est le seul point ou tout ce qui blesse un
    // ennemi se rejoint — le coup au contact, la fleche, la zone, la chaine
    // d'eclairs. Les poser dans `frapper` aurait laisse la moitie des degats du
    // jeu passer a cote.
    if (e.humain) {
      const mods = auteur.personne.mods;
      if (mods.refuseDeFrapperUnHumain && this.rng.next() < PART_DE_COUPS_REFUSES) {
        this.refuserDeFrapper(auteur, e);
        return;
      }
      degats = Math.max(1, Math.round(degats * mods.degatsContreHumain));
    }
    this.musique.combat();
    const inflige = Math.min(degats, e.pv);
    e.pv -= degats;
    // Pas de minuterie ici : avec les degats de zone et les chaines, on en
    // creait des centaines par seconde. Un simple horodatage suffit.
    e.setTintFill(0xffffff);
    e.flashJusqua = this.time.now + 70;
    // La gerbe est plafonnee par image dans `effets.ts` : une chaine d'eclairs
    // ou une aura de zone passe ici des dizaines de fois d'affilee.
    eclatImpact(this, e.x, e.y - 4, e.archetype.couleurImpact, 4);

    const vol = auteur.volDeVie + volDeVieSup;
    if (vol > 0) auteur.soigner(inflige * vol);

    if (e.pv > 0) return;
    this.tuer(e, auteur);
  }

  tuer(this: ArenaScene, e: Ennemi, auteur: Hero): void {
    this.kills += 1;
    this.killsDeLaNuit += 1;
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
    // Temps fracture (§4.25) : une mort dans le ralenti rend du temps au Sablier.
    if (this.zonesFracturees.length > 0) this.fracturerLeTemps(e.x, e.y);

    // Provocation : chaque mort a ses pieds remet le Chevalier Sacre debout.
    for (const hero of this.heros) {
      if (hero.bonus.provocation <= 0) continue;
      if (Phaser.Math.Distance.Between(hero.x, hero.y, e.x, e.y) <= hero.bonus.provocation) {
        hero.soigner(1);
      }
    }

    const x = e.x;
    const y = e.y;

    // La mort se voit : un pouf de particules, et une depouille qui bascule.
    // Purement decoratif et entierement detache — la logique ci-dessous n'a pas
    // bouge d'une ligne, et le sprite du monstre est detruit comme avant.
    this.marquerLaMort(e);

    // L'or, comme l'XP, va a celui qui a tue (§4.29, 20 septembre 2026).
    this.ramasserLeButin(e, auteur);
    if (e.humain) this.humainsEnFace = Math.max(0, this.humainsEnFace - 1);

    // L'XP va au heros qui a tue, pas a l'equipe (DESIGN.md §4.5).
    const monte = auteur.gagnerXp(e.xpDonnee);
    e.destroy();
    // Le cadavre peut se relever pour le Necromancien (DESIGN.md §4.14).
    this.tenterRelevement(x, y);
    if (monte) this.monterDeNiveau(auteur);
  }

  /**
   * Le visuel de mort d'un monstre : un pouf, et une depouille qui s'affale.
   *
   * La depouille est une **copie detachee** du sprite — meme texture, meme
   * teinte, meme orientation — sans corps physique. C'est ce qui autorise la
   * bascule et le retrecissement de `animerMort` : il n'y a plus de hitbox a
   * fausser, et le monstre reel, lui, est detruit dans la foulee.
   */
  marquerLaMort(this: ArenaScene, e: Ennemi): void {
    poufMort(this, e.x, e.y, e.archetype.couleurImpact);
    // ⚠️ **Dans la nuee, un cadavre est un orc couche** (§4.33 §5) : quelques
    // octets, donc plus de plafond de 24 — ils restent tous, et le champ de
    // bataille se couvre.
    if (e.dansLaNuee && this.nuee) {
      this.nuee.coucher(e.x, e.y, e.archetype.echelle * RANGS[e.rang].taille, e.flipX ? -1 : 1, teinteDeNuee(e.archetype));
      return;
    }
    if (this.cadavres >= MAX_CADAVRES) return;

    const cle = `${e.familleSprite}-mort`;
    if (!this.anims.exists(cle)) return;

    const depouille = this.add
      .sprite(e.x, e.y, cle)
      .setScale(e.scaleX)
      .setFlipX(e.flipX)
      .setDepth(e.y - 1);
    if (e.teinte !== null) depouille.setTint(e.teinte);

    this.cadavres += 1;
    depouille.play(cle);
    depouille.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      this.cadavres -= 1;
      depouille.destroy();
    });
  }
}
