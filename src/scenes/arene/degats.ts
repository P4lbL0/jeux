import Phaser from "phaser";
import { abimerLeSol } from "../../game/dessin/morceaux";
import { Ennemi, Hero, orienter, SEUIL_REGARD_PIXELS } from "../../game/entities";
import { animerMort, declencher } from "../../game/poses";
import {
  eclatImpact,
  flashCible,
  hitstop,
  poufMort,
  recul,
  secousse,
  tranche,
} from "../../game/effets";
import { REGLAGES_STRESS, contracterEtat, monterStress, type Personne } from "../../core/personne";
import { RIPOSTE_DU_SERMENT } from "../../core/classes";
import type { ArenaScene } from "../ArenaScene";
import { FORCE_RECUL, VITESSE_CRACHAT, RAYON_KAMIKAZE, competenceALeguer } from "./reglages";

/**
 * Les dégâts : le contact, la frappe résolue, encaisser, cracher, exploser, tomber, le
 * deuil et ses témoins.
 *
 * Une part d'`ArenaScene`, greffée sur son prototype (`greffer`) : `this` est la scène.
 */
export class ArenaDegats {

  // --------------------------------------------------------------- degats

  /**
   * Un monstre touche un heros : il **s'arme**, il ne blesse pas encore.
   *
   * C'est tout le changement du jalon. Avant, le contact appliquait les degats
   * dans l'image meme : on encaissait sans avoir rien vu venir. Maintenant le
   * contact ne fait que declencher le telegraphe ; les degats sont appliques
   * par `resoudreFrappe`, quelques centaines de millisecondes plus tard, et
   * seulement si la cible est toujours la.
   */
  contactEnnemi(this: ArenaScene, hero: Hero, e: Ennemi): void {
    if (!e.active || this.termine || this.enPause) return;
    // Un heros en repli, a la cite ou invisible a decroche.
    if (!hero.estAuCombat || hero.estInvisible) return;
    // Le cracheur n'a rien a faire au corps a corps : il tire, et c'est tout.
    if (e.archetype.comportement === "cracheur") return;
    if (e.enArmement || !e.peutFrapper(this.time.now)) return;
    this.armerEnnemi(e, hero);
  }

  /** Il se cabre, se tourne vers sa proie, et le coup part plus tard. */
  armerEnnemi(this: ArenaScene, e: Ennemi, hero: Hero): void {
    const maintenant = this.time.now;
    e.armer(maintenant, hero);
    declencher(e.pose, e, "charge", maintenant, hero);
    orienter(e, hero.x - e.x, SEUIL_REGARD_PIXELS);
  }

  /**
   * Le coup arme arrive a echeance.
   *
   * Il peut tres bien **partir dans le vide** : c'est ce qui donne son sens au
   * telegraphe. Voir venir un coup sans pouvoir l'eviter ne serait qu'une
   * decoration.
   */
  resoudreFrappe(this: ArenaScene, e: Ennemi): void {
    const cible = e.cibleArmee;
    const maintenant = this.time.now;
    e.desarmer();

    // Le kamikaze n'a pas de coup : il a une meche.
    if (e.archetype.comportement === "kamikaze") {
      this.exploser(e);
      return;
    }

    if (!cible || !cible.estAuCombat || cible.estInvisible) return;

    const angle = Phaser.Math.Angle.Between(e.x, e.y, cible.x, cible.y);
    declencher(e.pose, e, "attaque", maintenant, cible);

    if (e.archetype.comportement === "cracheur") {
      this.cracher(e, angle);
      return;
    }

    // Trait "riposte" du Chevalier Sacre : il blesse ce qui le frappe.
    if (cible.classe.trait === "riposte") {
      this.blesserEnnemi(e, Math.round(cible.degats * RIPOSTE_DU_SERMENT), cible);
    }

    const distance = Phaser.Math.Distance.Between(e.x, e.y, cible.x, cible.y);
    if (distance > e.archetype.portee) {
      // Elle s'est ecartee a temps : le geste fauche l'air, en gris.
      tranche(this, e.x, e.y, angle, 0x8a8397, e.archetype.portee);
      return;
    }

    tranche(this, e.x, e.y, angle, e.archetype.couleurImpact, e.archetype.portee);
    // La brute frappe assez fort pour qu'on le sente a la manette.
    if (e.archetype.comportement === "brute" && cible.estIncarne) hitstop(this, 45);
    this.encaisser(cible, e.degats, e.x, e.y, e.archetype.couleurImpact);
  }

  /**
   * Un heros encaisse : le bloc de degats commun a toutes les sources.
   *
   * Rien n'a change au calcul — martyre, esquive, `subirDegats`, plancher de
   * vie des heros IA sont exactement ceux d'avant. Ce qui s'y ajoute est
   * purement visuel : eclat d'impact, eclair blanc, sursaut et recul.
   */
  encaisser(
    this: ArenaScene,
    hero: Hero,
    degats: number,
    sourceX: number,
    sourceY: number,
    couleur: number,
  ): void {
    const maintenant = this.time.now;
    this.musique.combat();

    // Martyre : le Chevalier Sacre encaisse a la place de toute l'equipe.
    if (this.martyr && this.martyr !== hero && this.martyr.etat !== "mort") {
      this.martyr.subirDegats(degats, this.rng.next());
      flashCible(this.martyr, maintenant);
      declencher(this.martyr.pose, this.martyr, "touche", maintenant, { x: sourceX });
      this.flotter(this.martyr.x, this.martyr.y - 22, "Martyre", "#ffd166");
      return;
    }

    const issue = hero.subirDegats(degats, this.rng.next());
    if (issue === "esquive") {
      if (hero.estIncarne) this.flotter(hero.x, hero.y - 18, "Esquive", "#7ee0a0");
      return;
    }
    // Le Bouclier a tout pris (§4.13) : le coup sonne sur l'ecran, pas sur lui.
    // Ni recul, ni stress, ni plaie — c'est ce qu'un bouclier veut dire.
    if (issue === "bouclier") {
      this.elements.ecranTouche(hero, sourceX, sourceY);
      if (hero.estIncarne) this.flotter(hero.x, hero.y - 18, `-${degats}`, "#9db3c4");
      return;
    }

    eclatImpact(this, hero.x, hero.y - 4, couleur);
    flashCible(hero, maintenant);
    declencher(hero.pose, hero, "touche", maintenant, { x: sourceX });
    // Subtil a dessein : 110 ms d'impulsion, une douzaine de pixels. Un
    // knockback qui se voit se met a lutter avec le deplacement du joueur.
    recul(hero, sourceX, sourceY, FORCE_RECUL, maintenant);

    if (hero.estIncarne) {
      this.flotter(hero.x, hero.y - 18, `-${degats}`, "#ff6b5a");
      secousse(this, "leger");
    }

    // Encaisser use, et parfois ca ouvre une plaie (DESIGN.md §4.23).
    monterStress(hero.personne, REGLAGES_STRESS.parCoupEncaisse);
    if (
      degats >= hero.pvMax * 0.12 &&
      this.rng.chance(0.15 * hero.personne.mods.contagion) &&
      contracterEtat(hero.personne, "hemorragie")
    ) {
      this.events.emit("annonce", "je saigne — il me reste une journee", "heros", hero.personne.nom);
      this.flotter(hero.x, hero.y - 34, "HEMORRAGIE", "#ff5a4a");
    }

    if (hero.pv <= 0) this.tomber(hero);
  }

  /** Le crachat du monstre a distance : le tir de `tirer`, dans l'autre sens. */
  cracher(this: ArenaScene, e: Ennemi, angle: number): void {
    const p = this.projectilesEnnemis.create(
      e.x,
      e.y,
      "projectile",
    ) as Phaser.Physics.Arcade.Image;
    p.setDepth(e.y + 1);
    p.setTint(e.archetype.couleurImpact);
    // Les degats voyagent avec le projectile : son auteur peut mourir avant
    // qu'il n'arrive, et le crachat doit quand meme faire son office.
    p.setData("degats", e.degats);
    // Plus lent que les traits des heros : un tir qu'on ne peut pas voir
    // arriver n'est pas un tir, c'est une taxe.
    p.setVelocity(Math.cos(angle) * VITESSE_CRACHAT, Math.sin(angle) * VITESSE_CRACHAT);
    eclatImpact(this, e.x, e.y, e.archetype.couleurImpact, 3);
    this.time.delayedCall(2200, () => p.destroy());
  }

  impactCrachat(this: ArenaScene, p: Phaser.Physics.Arcade.Image, hero: Hero): void {
    if (!p.active || this.termine || this.enPause) return;
    if (!hero.estAuCombat || hero.estInvisible) return;
    const degats = (p.getData("degats") as number | undefined) ?? 6;
    const { x, y } = p;
    p.destroy();
    eclatImpact(this, x, y, 0x7ee0a0);
    this.encaisser(hero, degats, x, y, 0x7ee0a0);
  }

  /**
   * Le kamikaze s'ouvre.
   *
   * Il meurt sans donner ni kill ni experience : c'est le prix de l'avoir
   * laisse arriver. Le tuer avant qu'il n'explose, lui, rapporte normalement —
   * d'ou le clignotement pendant tout son armement.
   */
  exploser(this: ArenaScene, e: Ennemi): void {
    const { x, y } = e;
    const couleur = e.archetype.couleurImpact;

    this.effetCercle(x, y, RAYON_KAMIKAZE, couleur);
    poufMort(this, x, y, couleur);
    secousse(this, "moyen");
    hitstop(this, 45);
    // Il brule le sol en s'ouvrant : c'est la premiere terre brulee du jeu.
    abimerLeSol(this.carte, x, y, "brule", 30);

    for (const hero of this.heros) {
      if (!hero.estAuCombat || hero.estInvisible) continue;
      if (Phaser.Math.Distance.Between(x, y, hero.x, hero.y) > RAYON_KAMIKAZE) continue;
      this.encaisser(hero, Math.round(e.degats * 1.6), x, y, couleur);
    }

    e.destroy();
  }

  /** La mort est definitive. Elle ne peut arriver qu'au heros incarne. */
  tomber(this: ArenaScene, hero: Hero): void {
    // Le Revenant (§4.25) se releve d'abord lui-meme : la Resurrection de
    // l'equipe reste pour un autre.
    if (hero.palierReel("revenant") > 0 && !hero.revenu) {
      this.releverLeRevenant(hero);
      return;
    }
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
    // Il s'affaisse au lieu de se contenter de grisonner. Sans danger pour le
    // jeu : `animerMort` commence par couper son corps physique, et un heros
    // mort ne se releve jamais (la Resurrection est traitee au-dessus).
    animerMort(hero);
    this.effetCercle(hero.x, hero.y, 90, 0xff3b30);
    poufMort(this, hero.x, hero.y, 0xff3b30);
    secousse(this, "fort");
    this.flotter(hero.x, hero.y - 30, `${hero.personne.nom} est tombe`, "#ff6b5a");
    this.events.emit("hero-tombe", hero);
    this.faireLeDeuil(hero);

    const suivant = this.heros.findIndex((h) => h.etat !== "mort");
    if (suivant === -1) {
      this.finDePartie();
      return;
    }
    this.indexIncarne = suivant;
    this.heros[suivant]!.estIncarne = true;
    this.ouvrirLaMerAuHero(this.heros[suivant]!);
    this.cameras.main.startFollow(this.heros[suivant]!, true, 0.12, 0.12);
    this.events.emit("hero-incarne", this.heros[suivant]!);

    // ⚠️ **La regle ironman** (§4.28) : on enregistre la mort tout de suite.
    // Fermer l'onglet apres avoir perdu un heros ne le ramene pas — c'est ce
    // qui protege la mort definitive du §4.3, et ce n'est pas negociable.
    this.enregistrer();
  }

  /**
   * La mort d'un heros se paie chez tout le monde (DESIGN.md §4.23).
   *
   * Le village passe par la meme porte, et c'est voulu : ce sont deux
   * populations qui partagent un systeme, pas deux systemes qui se ressemblent.
   * Ce qui les separe, c'est seulement qui est dans la liste.
   */
  faireLeDeuil(this: ArenaScene, mort: Hero): void {
    this.uneMort(
      mort.personne,
      [
        ...this.temoinsAutourDe(mort.x, mort.y, mort),
        ...this.village.temoinsAutourDe(mort.x, mort.y).map((v) => v.regles.personne),
      ],
      mort.x,
      mort.y,
      competenceALeguer(mort),
      // Un heros s'est toujours battu : c'est ce qu'il est.
      { metier: mort.classe.nom.toLowerCase(), arme: "les armes", faits: ["combattant"] },
    );
  }

  /** Les heros assez pres pour avoir vu (§4.23, le rayon du deuil). */
  temoinsAutourDe(this: ArenaScene, x: number, y: number, exclu?: Hero): Personne[] {
    const vus: Personne[] = [];
    for (const temoin of this.heros) {
      if (temoin === exclu || temoin.etat === "mort") continue;
      if (Phaser.Math.Distance.Between(temoin.x, temoin.y, x, y) > REGLAGES_STRESS.rayonDuDeuil) {
        continue;
      }
      vus.push(temoin.personne);
    }
    return vus;
  }
}
