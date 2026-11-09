import Phaser from "phaser";
import { REGLAGES_FUSIONS, sequelleDuRevenant } from "../../core/fusions";
import { CLES_FLAMME } from "../../game/dessin/feu";
import { Ennemi, Familier, Hero, Invocation, MortVivant } from "../../game/entities";
import { auPalier } from "../../core/elements";
import { eclatImpact, secousse } from "../../game/effets";
import { poserSequelle } from "../../core/personne";
import { SEQUELLES } from "../../core/traits";
import type { ArenaScene } from "../ArenaScene";
import { VolDEpee } from "./reglages";

/**
 * Les fusions (§4.25, jalon 6.5, morceau 3) : ce que fait chacune une fois lancée.
 *
 * Une part d'`ArenaScene`, greffée sur son prototype (`greffer`) : `this` est la scène.
 */
export class ArenaFusions {

  // --- Les fusions (§4.25, jalon 6.5, morceau 3) ---
  //
  // Chacune garde ce que faisaient ses ingredients — ils restent tenus, fondus,
  // et leur code tourne comme avant — et y ajoute ce qui suit. Les chiffres
  // vivent dans `REGLAGES_FUSIONS`. Tout ce qui frappe passe par le voisinage.

  /** Moulin a lames : quand c'est l'heure, chaque epee au repos part rebondir. */
  lancerLeMoulin(this: ArenaScene, hero: Hero, epees: Phaser.GameObjects.Image[]): void {
    const palier = hero.palierReel("moulin-a-lames");
    if (palier === 0 || epees.length === 0 || !hero.estAuCombat) return;
    const maintenant = this.time.now;
    if (maintenant < (this.prochainMoulin.get(hero) ?? 0)) return;
    const reglage = REGLAGES_FUSIONS.moulinALames;
    this.prochainMoulin.set(hero, maintenant + auPalier(reglage.periode, palier));
    const rebonds = auPalier(reglage.rebonds, palier);
    const degats = Math.round(hero.degats * 0.6 * reglage.degats);
    const prises = new Set<Ennemi>();
    for (const epee of epees) {
      if (this.volsDEpees.has(epee)) continue;
      // D'ennemi en ennemi, chaque fois le plus proche qu'aucune epee n'a pris.
      const cibles: Ennemi[] = [];
      let depuis = { x: epee.x, y: epee.y };
      for (let i = 0; i < rebonds; i++) {
        let suivant: Ennemi | null = null;
        let meilleure = Infinity;
        for (const e of this.ennemisDansRayon(depuis.x, depuis.y, reglage.portee)) {
          if (prises.has(e)) continue;
          const d = Phaser.Math.Distance.Squared(depuis.x, depuis.y, e.x, e.y);
          if (d < meilleure) {
            meilleure = d;
            suivant = e;
          }
        }
        if (!suivant) break;
        prises.add(suivant);
        cibles.push(suivant);
        depuis = { x: suivant.x, y: suivant.y };
      }
      if (cibles.length === 0) continue;
      this.volsDEpees.set(epee, { hero, debut: maintenant, depart: { x: epee.x, y: epee.y }, cibles, frappes: 0, degats });
    }
  }

  /**
   * Une epee du Moulin en vol : elle file d'une cible a l'autre, frappe chacune
   * en y arrivant, puis rentre dans la ronde. Tout se lit dans le temps
   * ecoule, sans minuterie : une pause la fige avec le reste.
   */
  faireVolerLEpee(this: ArenaScene, epee: Phaser.GameObjects.Image, vol: VolDEpee): void {
    const parRebond = REGLAGES_FUSIONS.moulinALames.parRebond;
    const ecoule = this.time.now - vol.debut;
    while (vol.frappes < vol.cibles.length && ecoule >= (vol.frappes + 1) * parRebond) {
      const cible = vol.cibles[vol.frappes]!;
      if (cible.active) {
        this.blesserEnnemi(cible, vol.degats, vol.hero);
        eclatImpact(this, cible.x, cible.y - 4, 0xd5dbe3, 3);
      }
      vol.frappes += 1;
    }
    // Les etapes : le depart, chaque cible, puis le heros — le retour dans la ronde.
    const etapes = [vol.depart, ...vol.cibles.map((c) => ({ x: c.x, y: c.y })), { x: vol.hero.x, y: vol.hero.y }];
    const segment = Math.floor(ecoule / parRebond);
    if (segment >= etapes.length - 1 || vol.hero.etat === "mort") {
      this.volsDEpees.delete(epee);
      return;
    }
    const a = etapes[segment]!;
    const b = etapes[segment + 1]!;
    const t = (ecoule - segment * parRebond) / parRebond;
    epee
      .setPosition(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t)
      .setRotation(Math.atan2(b.y - a.y, b.x - a.x))
      .setScale(1.8)
      .setTint(0xeef3f8)
      .setDepth(epee.y + 2);
  }

  /** Satellites conducteurs : un satellite qui touche fait partir un eclair, pas plus souvent que son reglage. */
  conduire(this: ArenaScene, hero: Hero, satellite: Phaser.GameObjects.Image, e: Ennemi, degats: number, palier: number): void {
    const reglage = REGLAGES_FUSIONS.satellitesConducteurs;
    const maintenant = this.time.now;
    if (maintenant < (this.prochainEclairDeSatellite.get(satellite) ?? 0)) return;
    this.prochainEclairDeSatellite.set(satellite, maintenant + auPalier(reglage.intervalle, palier));
    this.trainee(satellite.x, satellite.y, e.x, e.y, 0xbfe8ff);
    this.propagerEclairs(hero, e.x, e.y, e, Math.round(degats * auPalier(reglage.force, palier)));
  }

  /** Des flammes qui naissent sur un cercle et s'eteignent aussitot (le Tourbillon infernal). */
  flammesSurLeCercle(this: ArenaScene, x: number, y: number, rayon: number, combien: number): void {
    for (let i = 0; i < combien; i++) {
      const angle = this.rng.range(0, Math.PI * 2);
      const fx = x + Math.cos(angle) * rayon;
      const fy = y + Math.sin(angle) * rayon;
      const cle = CLES_FLAMME[i % CLES_FLAMME.length]!;
      if (!this.textures.exists(cle)) return;
      const flamme = this.add.image(fx, fy, cle).setOrigin(0.5, 0.9).setDepth(fy + 1).setScale(0.8);
      this.tweens.add({
        targets: flamme,
        alpha: 0,
        scaleY: 1.2,
        duration: 320,
        onComplete: () => flamme.destroy(),
      });
    }
  }

  /** Tourbillon infernal : le Moulinet embrase, plus large, plus long, et il court. */
  effetTourbillonInfernal(this: ArenaScene, hero: Hero): void {
    const palier = Math.max(1, hero.palierReel("tourbillon-infernal"));
    const reglage = REGLAGES_FUSIONS.tourbillonInfernal;
    const duree = this.dureeDeLEffet(hero, auPalier(reglage.duree, palier));
    const rayon = this.rayonDeZone(hero, auPalier(reglage.rayon, palier));
    // Tout ce qu'il frole brule : l'aura, doublee, comptee a chaque tour.
    const brule = (hero.bonus.auraFeu * reglage.feu) / 5;
    this.tourbillons.set(hero, this.time.now + duree);
    hero.multiplicateurVitesse = reglage.vitesse;
    this.time.delayedCall(duree, () => void (hero.multiplicateurVitesse = 1));
    // L'evolution du Moulinet tient toujours : il aspire, ou il boit.
    const variante = hero.evolutions["moulinet"]?.effet ?? "moulinet";
    this.effetMoulinet(hero, variante, { duree, rayon, brule });
  }

  /** Forteresse mobile : la Charge sismique, et un dome la ou elle s'arrete. */
  effetForteresseMobile(this: ArenaScene, hero: Hero): void {
    const palier = Math.max(1, hero.palierReel("forteresse-mobile"));
    const reglage = REGLAGES_FUSIONS.forteresseMobile;
    this.effetCharge(hero, "charge-sismique", auPalier(reglage.souffle, palier));
    const duree = this.dureeDeLEffet(hero, auPalier(reglage.duree, palier));
    this.poserDome(hero.x, hero.y, reglage.rayonDome, auPalier(reglage.pv, palier), this.time.now + duree);
  }

  /** Un dome de la Forteresse mobile tient quelques secondes, puis tombe. */
  majDomes(this: ArenaScene): void {
    if (this.domes.length === 0) return;
    const maintenant = this.time.now;
    for (const dome of [...this.domes]) {
      if (dome.finDeVie !== undefined && maintenant >= dome.finDeVie) this.detruireDome(dome);
    }
  }

  /** Temps fracture : le Sablier, et chaque mort dans sa zone lui rend du temps. */
  effetTempsFracture(this: ArenaScene, hero: Hero): void {
    const palier = Math.max(1, hero.palierReel("temps-fracture"));
    const reglage = REGLAGES_FUSIONS.tempsFracture;
    const duree = this.dureeDeLEffet(hero, auPalier(reglage.duree, palier));
    const rayon = this.rayonDeZone(hero, 240 * auPalier(reglage.rayon, palier));
    this.effetSablier(hero, { duree, rayon });
    this.zonesFracturees.push({
      hero,
      x: hero.x,
      y: hero.y,
      rayon,
      fin: this.time.now + duree,
      rendu: auPalier(reglage.rendu, palier),
    });
  }

  /** Une mort la ou le temps est fracture : le Sablier de cette zone revient plus tot. */
  fracturerLeTemps(this: ArenaScene, x: number, y: number): void {
    const maintenant = this.time.now;
    this.zonesFracturees = this.zonesFracturees.filter((z) => z.fin > maintenant && z.hero.etat !== "mort");
    for (const zone of this.zonesFracturees) {
      if (Phaser.Math.Distance.Between(x, y, zone.x, zone.y) > zone.rayon) continue;
      zone.hero.avancerRechargement("temps-fracture", zone.rendu);
      // La fracture se voit : un eclat bleu file de la mort vers le coeur du sablier.
      this.trainee(x, y, zone.x, zone.y, 0x8ed6ff);
    }
  }

  /** Les maitres qui ont un General des morts, et leur familier quand il est debout. */
  generauxDesMorts(this: ArenaScene): Map<Hero, Familier> {
    const generaux = new Map<Hero, Familier>();
    for (const objet of this.invocations.getChildren() as Invocation[]) {
      if (!objet.active || !(objet instanceof Familier)) continue;
      if (objet.maitre.palierReel("general-des-morts") > 0) generaux.set(objet.maitre, objet);
    }
    return generaux;
  }

  /** General des morts : un mort-vivant qui frappe pres du familier frappe plus fort. */
  elanDuGeneral(this: ArenaScene, invoque: Invocation): number {
    if (!(invoque instanceof MortVivant)) return 1;
    const palier = invoque.maitre.palierReel("general-des-morts");
    if (palier === 0) return 1;
    const reglage = REGLAGES_FUSIONS.generalDesMorts;
    for (const objet of this.invocations.getChildren() as Invocation[]) {
      if (!objet.active || !(objet instanceof Familier) || objet.maitre !== invoque.maitre) continue;
      if (Phaser.Math.Distance.Between(objet.x, objet.y, invoque.x, invoque.y) <= reglage.rayon) {
        return 1 + auPalier(reglage.degats, palier);
      }
    }
    return 1;
  }

  /** Neant : le monde s'arrete, et quand il repart, tout ce qui est hostile est banni. */
  effetNeant(this: ArenaScene, hero: Hero): void {
    const palier = Math.max(1, hero.palierReel("neant"));
    const reglage = REGLAGES_FUSIONS.neant;
    const duree = this.dureeDeLEffet(hero, auPalier(reglage.fige, palier));
    this.figerLeMonde(duree);
    this.flotter(hero.x, hero.y - 40, `${(duree / 1000).toFixed(1).replace(".", ",")} s`, "#d9c9b0");
    this.time.delayedCall(duree, () => {
      if (hero.etat === "mort") return;
      this.bannirTout();
      // Le cout de l'Exil, double (tranche le 23 septembre 2026).
      this.payerLExil(hero, reglage.decouvert);
    });
  }

  /** Exil des morts : il bannit sans payer de sa vie — les bannis reviendront la nuit suivante. */
  effetExilDesMorts(this: ArenaScene, hero: Hero): void {
    const bannis = this.bannirTout();
    this.bannis += bannis;
    this.aura(hero.x, hero.y, 4, 0x8e1c12, 1200);
    if (bannis > 0) {
      this.events.emit("annonce", `${bannis} bannis reviendront a la prochaine nuit`, "guet");
    }
  }

  /** Revenant : il se releve a pleine vie, une fois, mais avec une sequelle tiree au sort. */
  releverLeRevenant(this: ArenaScene, hero: Hero): void {
    const palier = Math.max(1, hero.palierReel("revenant"));
    const reglage = REGLAGES_FUSIONS.revenant;
    hero.revenu = true;
    const sequelle = sequelleDuRevenant(this.rng.next(), hero.personne.sequelles, SEQUELLES.length);
    if (sequelle !== null) poserSequelle(hero.personne, sequelle);
    // Apres la sequelle : un poumon perce baisse la vie maximale qu'il retrouve.
    hero.soignerForce(hero.pvMax);
    hero.rendreInvulnerable(auPalier(reglage.invulnerable, palier));
    if (auPalier(reglage.souffle, palier)) {
      const rayon = this.rayonDeZone(hero, reglage.rayonSouffle);
      for (const e of this.ennemisDansRayon(hero.x, hero.y, rayon)) {
        this.repousser(e, hero.x, hero.y, 420);
        this.blesserEnnemi(e, hero.degats * 3, hero);
      }
      this.effetCercle(hero.x, hero.y, rayon, 0xe0402a);
    }
    this.effetCercle(hero.x, hero.y, 120, 0x8e1c12);
    this.cameras.main.flash(400, 140, 28, 18);
    secousse(this, "fort");
    const nom = sequelle !== null ? SEQUELLES[sequelle]?.nom : undefined;
    this.flotter(hero.x, hero.y - 34, "REVENANT", "#e0402a");
    this.events.emit(
      "annonce",
      nom ? `je reviens — mais pas entier : ${nom.toLowerCase()}` : "je reviens",
      "heros",
      hero.personne.nom,
    );
    // La regle ironman (§4.28) : la seconde vie est prise, on l'enregistre.
    this.enregistrer();
  }

  /** Berserker terminal : chaque aube lui prend une part de sa vie maximale, pour toujours. */
  consumerLesBerserkers(this: ArenaScene): void {
    for (const hero of this.heros) {
      if (hero.etat === "mort" || hero.palierReel("berserker-terminal") === 0) continue;
      hero.usure += 1;
      hero.pv = Math.min(hero.pv, hero.pvMax);
      this.events.emit("annonce", `chaque aube me prend un peu plus — ${hero.pvMax} PV, pas un de plus`, "heros", hero.personne.nom);
    }
  }
}
