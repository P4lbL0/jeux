import Phaser from "phaser";
import { REGLAGES_FUSIONS } from "../../core/fusions";
import {
  Ennemi,
  Familier,
  Hero,
  Invocation,
  MortVivant,
  orienter,
  rafraichirTeinte,
  SEUIL_REGARD_PIXELS,
} from "../../game/entities";
import { auPalier } from "../../core/elements";
import { declencher } from "../../game/poses";
import { eclatImpact, flashCible, secousse } from "../../game/effets";
import { REGLAGES, TOLERANCE_ANCRE, type Point } from "../../core/ordres";
import { EGLISE } from "../../core/carte";
import {
  EFFETS_RUPTURE,
  NOMS_RUPTURE,
  REGLAGES_STRESS,
  coeurLache,
  descendreStress,
  monterStress,
  resistanceAuStress,
  stressDesEtatsDe,
  verifierRupture,
} from "../../core/personne";
import { ArenaScene } from "../ArenaScene";
import { CITE, MAX_MORTS_VIVANTS, RAYON_DE_VUE } from "./reglages";

/**
 * La boucle de l'équipe : teintes, affinités, contexte, auras, invocations, relèvement,
 * états, moral et rupture, provocation, orbiteurs.
 *
 * Une part d'`ArenaScene`, greffée sur son prototype (`greffer`) : `this` est la scène.
 */
export class ArenaEquipe {

  /**
   * L'eclair blanc d'encaissement des allies, repose une fois par image.
   *
   * Les ennemis sont traites dans leur propre boucle (`teinterEnnemi`), qui a
   * des regles en plus. Ici, c'est le meme principe : un horodatage plutot
   * qu'une minuterie par coup recu.
   */
  majTeintes(this: ArenaScene): void {
    const maintenant = this.time.now;
    for (const hero of this.heros) {
      if (hero.etat === "mort") continue;
      rafraichirTeinte(hero, maintenant);
    }
    for (const objet of this.invocations.getChildren()) {
      const i = objet as Invocation;
      if (i.active) rafraichirTeinte(i, maintenant);
    }
  }

  /**
   * L'experience de groupe (DESIGN.md §4.16) : les heros qui se battent
   * ensemble apprennent a travailler ensemble.
   *
   * Un simple horodatage plutot qu'une minuterie (regle 4 du §4.17), et un
   * calcul par paire toutes les 250 ms plutot qu'a chaque image (regle 5).
   */
  majAffinites(this: ArenaScene): void {
    if (this.time.now < this.prochainTickAffinites) return;
    const periode = ArenaScene.PERIODE_AFFINITES;
    this.prochainTickAffinites = this.time.now + periode;

    const tous = this.heros.filter((h) => h.estVivant).map((h) => h.identifiant);
    // Au combat seulement : ni la cite, ni le repli ne font une equipe.
    const auCombat = this.heros.filter((h) => h.estAuCombat).map((h) => h.identifiant);
    this.affinites.ecouler(tous, auCombat, periode / 1000);

    // ⚠️ **Deux ennemis refusent de cooperer** (§4.26) : leur affinite ne monte
    // pas, meme au combat cote a cote. C'est le seul endroit ou les deux
    // systemes se touchent — l'affinite est militaire, la relation est sociale,
    // et la seconde a un droit de veto sur la premiere.
    this.affinites.oublier(this.paires(auCombat, (a, b) => this.brouilles(a, b)));

    const socialsAuCombat = this.heros
      .filter((h) => h.estAuCombat)
      .map((h) => h.personne.identite);
    for (const hero of this.heros) {
      if (!hero.estAuCombat) {
        hero.bonusGroupe = 0;
        continue;
      }
      // L'affinite et la rivalite s'additionnent : une equipe rodee **et** qui
      // se tire la bourre tape 20 % de plus. C'est exactement le genre
      // d'histoire que le §4.26 veut produire.
      hero.bonusGroupe =
        this.affinites.bonus(hero.identifiant, auCombat) +
        this.memoire.relations.bonusDeRivalite(hero.personne.identite, socialsAuCombat);
    }
  }

  /** Deux heros qui se detestent assez pour ne plus rien apprendre ensemble. */
  brouilles(this: ArenaScene, a: string, b: string): boolean {
    const un = this.heros.find((h) => h.identifiant === a);
    const deux = this.heros.find((h) => h.identifiant === b);
    if (!un || !deux) return false;
    return this.memoire.relations.refusentDeCooperer(
      un.personne.identite,
      deux.personne.identite,
    );
  }

  /** Les paires d'une liste qui repondent a une condition. Jamais par image. */
  paires(this: ArenaScene, ids: readonly string[], garde: (a: string, b: string) => boolean): [string, string][] {
    const vues: [string, string][] = [];
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        if (garde(ids[i]!, ids[j]!)) vues.push([ids[i]!, ids[j]!]);
      }
    }
    return vues;
  }

  /**
   * Les competences qui dependent de l'etat de l'equipe entiere : Presage,
   * Serment du protecteur, Le dernier debout, Serment de fer.
   */
  majContexteEquipe(this: ArenaScene): void {
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
  majAuras(this: ArenaScene): void {
    if (this.time.now >= this.prochainTickAuras) {
      this.prochainTickAuras = this.time.now + 500;
      for (const hero of this.heros) {
        if (hero.bonus.auraFeu <= 0 || !hero.estAuCombat) continue;
        // Soleil d'acier (§4.25) : l'aura va jusqu'au cercle des epees, et
        // brule plus fort. Le Tourbillon infernal la double tant qu'il tourne.
        const soleil = hero.palierReel("soleil-d-acier");
        const reglage = REGLAGES_FUSIONS.soleilDAcier;
        const rayon = this.rayonDeZone(hero, soleil > 0 ? reglage.rayonAura : 72);
        let feu = soleil > 0 ? auPalier(reglage.feu, soleil) : 1;
        if (this.time.now < (this.tourbillons.get(hero) ?? 0)) feu *= REGLAGES_FUSIONS.tourbillonInfernal.feu;
        this.aura(hero.x, hero.y, rayon / 8, soleil > 0 ? 0xffb35a : 0xff8a3d, 400);
        for (const e of this.ennemisDansRayon(hero.x, hero.y, rayon)) {
          this.blesserEnnemi(e, Math.max(1, Math.round((hero.bonus.auraFeu / 2) * feu)), hero);
        }
      }
    }

    if (this.time.now < this.prochainTickEclats) return;
    this.prochainTickEclats = this.time.now + 1800;
    for (const hero of this.heros) {
      if (hero.bonus.eclats <= 0 || !hero.estAuCombat) continue;
      const salve = hero.bonus.eclats + hero.bonus.projectiles;
      for (let i = 0; i < salve; i++) {
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
  majInvocations(this: ArenaScene): void {
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

    // General des morts (§4.25) : chaque maitre qui l'a, et son familier debout.
    const generaux = this.generauxDesMorts();

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
      // Sous un General des morts, les morts-vivants suivent le familier.
      const general = generaux.get(objet.maitre);
      const chef = general && objet instanceof MortVivant ? general : null;
      const ancre: Point = objet.ordre.ancre ?? (chef ? { x: chef.x, y: chef.y } : { x: objet.maitre.x, y: objet.maitre.y });
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

      // Rien a poursuivre, ou trop loin de sa position : il y retourne. Le
      // familier d'un General des morts, lui, n'a pas de laisse : il mene.
      const mene = general !== undefined && objet === general;
      if (!cible || (distanceAncre > reglage.laisse && !mene)) {
        if (distanceAncre <= TOLERANCE_ANCRE) {
          objet.setVelocity(0, 0);
          continue;
        }
        const retour = Phaser.Math.Angle.Between(objet.x, objet.y, ancre.x, ancre.y);
        objet.setVelocity(Math.cos(retour) * objet.vitesse, Math.sin(retour) * objet.vitesse);
        orienter(objet, ancre.x - objet.x, SEUIL_REGARD_PIXELS);
        continue;
      }

      const angle = Phaser.Math.Angle.Between(objet.x, objet.y, cible.x, cible.y);
      objet.setVelocity(Math.cos(angle) * objet.vitesse, Math.sin(angle) * objet.vitesse);
      orienter(objet, cible.x - objet.x, SEUIL_REGARD_PIXELS);
    }
  }

  melee(this: ArenaScene, invoque: Invocation, e: Ennemi): void {
    if (!invoque.active || !e.active || this.enPause) return;
    if (!invoque.peutFrapper(this.time.now)) return;
    invoque.marquerCoup(this.time.now);
    declencher(invoque.pose, invoque, "attaque", this.time.now, e);

    if (invoque.degats > 0) {
      // Le spectre execute ce qui est deja a l'agonie.
      const acheve = invoque.seuilExecution > 0 && e.pv / e.pvMax <= invoque.seuilExecution;
      this.blesserEnnemi(e, acheve ? e.pv : Math.round(invoque.degats * this.elanDuGeneral(invoque)), invoque.maitre);
      if (acheve) this.flotter(e.x, e.y - 16, "ACHEVE", "#9fd8ff");
    }

    // L'echange se paie des deux cotes. L'eclair d'encaissement est date
    // plutot que confie a une minuterie : une minuterie par coup rendait la
    // main a `clearTint`, qui effacait au passage la couleur du double.
    invoque.pv -= e.degats;
    flashCible(invoque, this.time.now, 60);
    declencher(invoque.pose, invoque, "touche", this.time.now, e);
    eclatImpact(this, invoque.x, invoque.y - 4, e.archetype.couleurImpact, 3);
    if (invoque.pv <= 0) this.detruireInvocation(invoque);
  }

  detruireInvocation(this: ArenaScene, invoque: Invocation): void {
    if (invoque.explosif) {
      this.effetCercle(invoque.x, invoque.y, 80, 0x9ee8a0);
      for (const e of this.ennemisDansRayon(invoque.x, invoque.y, 80)) {
        this.blesserEnnemi(e, Math.max(invoque.degats * 2, invoque.maitre.degats * 2), invoque.maitre);
      }
    }
    // Le familier revient au bout d'un moment : il est permanent. Celui d'un
    // General des morts revient plus vite (§4.25).
    if (invoque instanceof Familier) {
      const general = invoque.maitre.palierReel("general-des-morts");
      const retour = general > 0 ? auPalier(REGLAGES_FUSIONS.generalDesMorts.retour, general) : 12000;
      this.retourFamilier.set(invoque.maitre, this.time.now + retour);
    }
    for (const objet of this.ennemis.getChildren()) {
      const e = objet as Ennemi;
      if (e.attirePar === invoque) e.attirePar = null;
    }
    invoque.destroy();
  }

  /** Le golem et le double de l'assassin attirent les ennemis sur eux. */
  majProvocationInvocations(this: ArenaScene): void {
    const provocateurs = (this.invocations.getChildren() as Invocation[]).filter(
      (i) => i.active && i.provoque,
    );

    for (const objet of this.ennemis.getChildren()) {
      const e = objet as Ennemi;
      if (e.attirePar && !e.attirePar.active) e.attirePar = null;
    }
    // Chaque provocateur, dans l'ordre, attire ceux qui ne le sont pas encore :
    // le premier de la liste gagne, comme quand chaque monstre cherchait le sien
    // parmi tous — mais on ne regarde plus que ceux qui sont a portee (§4.33).
    for (const provocateur of provocateurs) {
      const n = this.voisinage.autour(provocateur.x, provocateur.y, 200, this.monstreDebout);
      for (let k = 0; k < n; k++) {
        const e = this.horde[this.voisinage.trouve(k)]!;
        if (!e.attirePar) e.attirePar = provocateur;
      }
    }
  }

  /**
   * Un cadavre a une chance de se relever pour le Necromancien.
   *
   * Le taux de base est volontairement bas : a 25%, l'armee devenait un mur
   * qui jouait la partie a la place du joueur. C'est aux competences de le
   * faire monter, et ca reste plafonne pour que l'ecran reste lisible.
   */
  tenterRelevement(this: ArenaScene, x: number, y: number): void {
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

  relever(this: ArenaScene, maitre: Hero, x: number, y: number): void {
    const mort = new MortVivant(this, x, y, maitre);
    this.invocations.add(mort);
    this.effetCercle(x, y, 34, 0x9ee8a0);
  }

  /**
   * L'etat de chaque heros, et **le seul endroit du jeu ou l'on se soigne**.
   *
   * ⚠️ Ce n'est plus le cercle du village qui soigne, c'est **l'eglise** —
   * 90 px au niveau 1 contre 150 px avant, et **zero quand elle est a terre**
   * (§4.22). Trois consequences a garder en tete :
   *
   * - se soigner veut dire rentrer sur la place, plus trainer au bord ;
   * - l'etat `cite` signifie desormais « dans le rayon de l'eglise ». C'est ce
   *   que `piloter()` attend pour arreter un repli, et l'eglise etant au centre
   *   exact de la cite, un heros qui rentre y arrive toujours ;
   * - **eglise a terre = plus aucun soin**, donc un heros IA en repli reste en
   *   repli, hors du combat, jusqu'a ce qu'elle se releve. C'est lourd, c'est
   *   voulu, et c'est ecrit noir sur blanc au §4.22.
   */
  majEtats(this: ArenaScene, delta: number): void {
    // Calcules une fois par image et non par heros : le §4.17 est formel.
    const rayonSoin = this.eglise.rayonSoin;
    const soinParSeconde = this.eglise.fonctionne
      ? this.eglise.regles.palier.soinParSeconde
      : 0;

    this.majMoralDesHeros();

    for (const hero of this.heros) {
      if (hero.etat === "mort") continue;

      // Regeneration (§4.13) : ses plaies se referment toutes seules, meme au
      // combat. Un soin ordinaire — Sang pour sang le refuse.
      if (hero.bonus.regeneration > 0) hero.soigner((hero.pvMax * hero.bonus.regeneration * delta) / 1000);

      const dansCite =
        rayonSoin > 0 &&
        Phaser.Math.Distance.Between(hero.x, hero.y, EGLISE.x, EGLISE.y) <= rayonSoin;

      if (dansCite) {
        hero.etat = "cite";
        hero.soigner((soinParSeconde * delta) / 1000);
      } else if (hero.estIncarne && (!this.robot || !this.eglise.fonctionne)) {
        // Reprendre un heros en fuite le remet au combat : c'est le joueur qui
        // decide de faire demi-tour, et c'est comme ca qu'on perd un heros.
        // Le robot (jalon 6.4) se replie comme l'IA, sauf eglise tombee : il n'y a
        // plus de refuge, il se bat — sinon il tournait au centre jusqu'a la fin.
        hero.etat = "combat";
      } else if (hero.estCritique) {
        // Repli automatique : l'IA ne perd jamais un heros. Le robot (jalon 6.4) se
        // replie pareil, mais son heros reste incarne : il peut mourir en chemin.
        if (hero.etat !== "repli") this.flotter(hero.x, hero.y - 24, "Repli !", "#e6a23c");
        hero.etat = "repli";
      } else if (hero.etat !== "repli") {
        hero.etat = "combat";
      }

      hero.setAlpha(hero.estInvisible ? 0.35 : hero.etat === "repli" ? 0.75 : 1);
    }
  }

  /**
   * Le moral des heros (DESIGN.md §4.23).
   *
   * **Les deux populations partagent le meme systeme** : c'est le pendant de
   * `village.majorerLeMoral()`, avec les memes reglages et le meme battement de
   * 500 ms. Ce qui change, c'est ce qui fait monter la jauge — un heros est
   * dehors la nuit par metier, pas par accident.
   */
  majMoralDesHeros(this: ArenaScene): void {
    const maintenant = this.time.now;
    if (maintenant < this.prochainBattementMoral) return;

    const periode = ArenaScene.PERIODE_MORAL;
    this.prochainBattementMoral = maintenant + periode;
    const minutes = periode / 60_000;

    // Une fois par battement, pas une fois par heros (§4.17, regle 5).
    const nuit = this.cycle.phase === "nuit";
    const apaisement = this.eglise.fonctionne
      ? REGLAGES_STRESS.multiplicateurEglise * (0.8 + this.eglise.niveau * 0.2)
      : 0;
    const rayonSoin = this.eglise.rayonSoin;

    for (const hero of this.heros) {
      if (hero.etat === "mort") continue;
      const { personne } = hero;

      const aLEglise =
        rayonSoin > 0 &&
        Phaser.Math.Distance.Between(hero.x, hero.y, EGLISE.x, EGLISE.y) <= rayonSoin;

      if (aLEglise) {
        descendreStress(personne, REGLAGES_STRESS.reposAuVillage * apaisement * personne.mods.soinEglise * minutes);
      } else {
        let montee = stressDesEtatsDe(personne);
        if (nuit && !personne.mods.ignoreStressNuit) montee += REGLAGES_STRESS.dehorsLaNuit;
        if (this.ennemiLePlusProche(hero.x, hero.y, RAYON_DE_VUE)) {
          montee += REGLAGES_STRESS.menaceEnVue;
        }
        if (montee > 0) {
          // Un heros n'a pas de rang : c'est son niveau et son courage qui
          // ralentissent la jauge. Un veteran tient bien plus longtemps.
          monterStress(personne, montee * minutes * resistanceAuStress(0, hero.niveau, personne.stats));
        }
      }

      this.verifierLaRuptureDuHero(hero, maintenant);
    }
  }

  /**
   * Un heros craque (DESIGN.md §4.23).
   *
   * ⚠️ **Seuls les heros deviennent dangereux** : la rage fait frapper les
   * allies. C'est assume, et c'est justement pour ca que les civils, eux, ne
   * frappent jamais personne — avec vingt habitants, la meme regle
   * declencherait une spirale de meurtres internes qu'aucun joueur ne peut
   * arreter.
   *
   * Les effets passent par `hero.personne.rupture`, que les getters de
   * `entities.ts` et l'IA lisent : rien n'est cable en dur ici.
   */
  verifierLaRuptureDuHero(this: ArenaScene, hero: Hero, maintenant: number): void {
    const { personne } = hero;

    if (coeurLache(personne)) {
      this.events.emit("annonce", `${personne.nom} s'effondre — son coeur a lache`, "village");
      this.tomber(hero);
      return;
    }

    const rupture = verifierRupture(personne, maintenant, this.rng);
    if (!rupture) return;

    this.events.emit(
      "annonce",
      `je craque — ${NOMS_RUPTURE[rupture]} : ${EFFETS_RUPTURE[rupture].hero}`,
      "heros",
      personne.nom,
    );
    this.flotter(hero.x, hero.y - 28, NOMS_RUPTURE[rupture], "#ff5a4a");
    secousse(this, "leger");
    // Un heros qui craque de rage frappe ses allies (§4.23) : on ne le regarde
    // plus pareil non plus (§4.26).
    if (rupture === "rage" && this.village) {
      this.memoire.rage(
        personne,
        [
          ...this.temoinsAutourDe(hero.x, hero.y, hero),
          ...this.village.temoinsAutourDe(hero.x, hero.y).map((v) => v.regles.personne),
        ],
        this.cycle.jour,
      );
    }
  }

  /**
   * Provocation du Chevalier Sacre : tout ce qui l'entoure ne voit plus que
   * lui, et chaque ennemi qui le cible le rend plus dur.
   */
  majProvocation(this: ArenaScene): void {
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
  majOrbiteurs(this: ArenaScene): void {
    for (const hero of this.heros) {
      const satellites = hero.etat === "mort" ? 0 : hero.bonus.satellites;
      const epees = hero.etat === "mort" ? 0 : hero.bonus.epees;
      const voulu = satellites + epees;

      const liste = this.orbiteurs.get(hero) ?? [];
      while (liste.length < voulu) liste.push(this.add.image(hero.x, hero.y, "projectile"));
      while (liste.length > voulu) liste.pop()?.destroy();
      this.orbiteurs.set(hero, liste);

      // Les fusions qui touchent aux orbiteurs (§4.25).
      const soleil = hero.palierReel("soleil-d-acier") > 0;
      const conducteurs = hero.palierReel("satellites-conducteurs") > 0;
      liste.forEach((objet, i) => {
        const estEpee = i >= satellites;
        // Moulin a lames : une epee partie rebondir suit sa route, pas la ronde.
        const vol = estEpee ? this.volsDEpees.get(objet) : undefined;
        if (vol) {
          this.faireVolerLEpee(objet, vol);
          return;
        }
        const rayon = estEpee ? (soleil ? REGLAGES_FUSIONS.soleilDAcier.orbiteEpees : 62) : 48;
        const vitesse = estEpee ? 380 : 520;
        const angle = this.time.now / vitesse + (i / Math.max(1, voulu)) * Math.PI * 2;
        const teinte = estEpee
          ? soleil
            ? 0xffd27a
            : hero.bonus.epeeArdente
              ? 0xff8a3d
              : 0xd5dbe3
          : conducteurs
            ? 0xbfe8ff
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
      // Soleil d'acier : les epees sont incandescentes, comme les Lames ardentes.
      const ardentes = hero.bonus.epeeArdente || hero.palierReel("soleil-d-acier") > 0;
      const conducteurs = hero.palierReel("satellites-conducteurs");
      liste.forEach((objet, i) => {
        const estEpee = i >= satellites;
        if (this.volsDEpees.has(objet)) return;
        const degats = estEpee
          ? Math.round(hero.degats * (ardentes ? 1.2 : 0.6))
          : Math.round(hero.degats * (hero.bonus.satelliteFeu ? 0.8 : 0.4));
        for (const e of this.ennemisDansRayon(objet.x, objet.y, estEpee ? 24 : 18)) {
          if (!estEpee && hero.bonus.satelliteGlace) e.ralentir(1200);
          this.blesserEnnemi(e, degats, hero);
          // Satellites conducteurs (§4.25) : le contact fait partir un eclair.
          if (!estEpee && conducteurs > 0 && e.active) this.conduire(hero, objet, e, degats, conducteurs);
        }
      });
      this.lancerLeMoulin(hero, liste.slice(satellites));
    }
  }
}
