import Phaser from "phaser";
import { PENETRATION, penetrationDe } from "../../core/competences";
import { abimerLeSol } from "../../game/dessin/morceaux";
import { Double, Ennemi, Hero, Invocation, MortVivant } from "../../game/entities";
import { auPalier, BASES } from "../../core/elements";
import type { ArenaScene } from "../ArenaScene";

/**
 * Ce que fait chaque compétence et chaque ultime de classe, une fois lancé.
 *
 * Une part d'`ArenaScene`, greffée sur son prototype (`greffer`) : `this` est la scène.
 */
export class ArenaEffetsDeClasse {

  effetJugement(this: ArenaScene, hero: Hero, variante: string): void {
    const palier = Math.max(1, hero.palierDe("jugement"));
    const rayon = this.rayonDeZone(hero, 80 + palier * 15);

    if (variante === "jugement-croisade") {
      // La colonne ne reste plus au sol : elle le suit.
      this.time.addEvent({
        delay: 400,
        repeat: Math.round(15 * hero.bonus.dureeEffets) - 1,
        callback: () => {
          if (hero.etat === "mort") return;
          this.effetCercle(hero.x, hero.y, rayon, 0xfff0a0);
          for (const e of this.ennemisDansRayon(hero.x, hero.y, rayon)) {
            this.blesserEnnemi(e, Math.round(hero.degats * 0.9), hero);
          }
        },
      });
      return;
    }

    const point = hero.estIncarne
      ? this.cameras.main.getWorldPoint(this.input.activePointer.x, this.input.activePointer.y)
      : this.pointDevant(hero, 100);

    if (variante === "jugement-absolution") {
      // La lumiere cesse de blesser : elle recoud.
      this.effetCercle(point.x, point.y, rayon, 0xa8ffc8);
      for (const allie of this.heros) {
        if (allie.etat === "mort") continue;
        if (Phaser.Math.Distance.Between(allie.x, allie.y, point.x, point.y) > rayon) continue;
        const soin = allie.pvMax * (0.15 + palier * 0.1);
        allie.soigner(soin);
        this.flotter(allie.x, allie.y - 22, `+${Math.round(soin)}`, "#7ee0a0");
      }
      return;
    }

    this.effetCercle(point.x, point.y, rayon, 0xfff0a0);
    this.trainee(point.x, point.y - 260, point.x, point.y, 0xfff0a0);
    if (hero.estIncarne) this.cameras.main.shake(160, 0.006);
    for (const e of this.ennemisDansRayon(point.x, point.y, rayon)) {
      this.blesserEnnemi(e, Math.round(hero.degats * (2.5 + palier)), hero);
    }
  }

  /**
   * Bouclier des ames : il donne de sa propre vie a ceux qui sont au plus mal.
   * Il ne cree rien — il deplace, et c'est ce qui rend la competence tendue.
   */
  effetBouclierDesAmes(this: ArenaScene, hero: Hero): void {
    const palier = Math.max(1, hero.palierDe("bouclier-des-ames"));
    const blesses = this.heros.filter(
      (h) => h !== hero && h.etat !== "mort" && h.ratioPv < 0.3,
    );
    if (blesses.length === 0) return;

    const don = Math.round(hero.pv * (0.1 + palier * 0.05));
    if (don < 1) return;
    hero.pv = Math.max(1, hero.pv - don);

    const part = Math.round(don / blesses.length);
    for (const allie of blesses) {
      allie.soigner(part);
      this.trainee(hero.x, hero.y, allie.x, allie.y, 0xffd166);
      this.flotter(allie.x, allie.y - 22, `+${part}`, "#ffd166");
    }
  }

  // --- Guerrier : Charge et Cri de guerre ---

  effetCharge(this: ArenaScene, hero: Hero, variante: string, souffle = 1): void {
    const palier = Math.max(1, hero.palierDe("charge"));
    const distance = 220 + palier * 40;
    const depart = new Phaser.Math.Vector2(hero.x, hero.y);
    const arrivee = this.pointDevant(hero, distance);

    // Elle renverse les premiers de la file, pas la file entiere (§4.25) : le
    // heros, lui, va toujours au bout — la Charge est aussi sa fuite.
    const penetration = penetrationDe(PENETRATION.charge(palier), hero.bonus, false);
    hero.rendreInvulnerable(400);
    this.trainee(depart.x, depart.y, arrivee.x, arrivee.y, 0xffc27a);
    this.faucherLeLong(hero, depart, arrivee, hero.degats * 2, penetration);
    hero.setPosition(arrivee.x, arrivee.y);

    if (variante === "charge-sismique") {
      const rayon = this.rayonDeZone(hero, 120 * souffle);
      this.effetCercle(arrivee.x, arrivee.y, rayon, 0xc9a06b);
      this.cameras.main.shake(220, 0.008);
      for (const e of this.ennemisDansRayon(arrivee.x, arrivee.y, rayon)) {
        this.repousser(e, arrivee.x, arrivee.y, 340);
        this.blesserEnnemi(e, hero.degats * 3, hero);
      }
    }

    if (variante === "charge-sanglante") {
      // Il traverse, puis revient aussitot sur ses pas.
      this.time.delayedCall(220, () => {
        if (hero.etat === "mort") return;
        this.trainee(arrivee.x, arrivee.y, depart.x, depart.y, 0xff8080);
        this.faucherLeLong(hero, arrivee, depart, hero.degats * 2, penetration);
        hero.setPosition(depart.x, depart.y);
      });
    }
  }

  faucherLeLong(
    this: ArenaScene,
    hero: Hero,
    depart: Phaser.Math.Vector2,
    arrivee: Phaser.Math.Vector2,
    degats: number,
    penetration: number,
  ): void {
    for (const e of this.monstresLeLongDuTrait(depart.x, depart.y, arrivee.x, arrivee.y, 48, penetration)) {
      this.repousser(e, depart.x, depart.y, 260);
      this.blesserEnnemi(e, degats, hero);
    }
  }

  effetCriDeGuerre(this: ArenaScene, hero: Hero): void {
    const palier = Math.max(1, hero.palierDe("cri-de-guerre"));
    const duree = this.dureeDeLEffet(hero, 4000 + palier * 2000);
    const gain = 1 + 0.1 + palier * 0.1;
    const rayon = this.rayonDeZone(hero, 220);

    this.effetCercle(hero.x, hero.y, rayon, 0xffd166);
    if (hero.estIncarne) this.cameras.main.shake(180, 0.005);
    for (const e of this.ennemisDansRayon(hero.x, hero.y, rayon)) {
      this.repousser(e, hero.x, hero.y, 420);
      e.ralentir(1500, 0.6);
    }

    // L'equipe entiere frappe plus fort le temps du cri.
    for (const allie of this.heros) {
      if (allie.etat === "mort") continue;
      allie.bonus.multiplicateurDegats *= gain;
    }
    this.time.delayedCall(duree, () => {
      for (const allie of this.heros) allie.bonus.multiplicateurDegats /= gain;
    });
  }

  // --- Mage : Clignement et Sablier ---

  effetClignement(this: ArenaScene, hero: Hero): void {
    const palier = Math.max(1, hero.palierDe("clignement"));
    const depart = new Phaser.Math.Vector2(hero.x, hero.y);
    const vise = hero.estIncarne
      ? this.cameras.main.getWorldPoint(this.input.activePointer.x, this.input.activePointer.y)
      : this.pointDevant(hero, 200);

    const portee = 180 + palier * 60;
    const direction = new Phaser.Math.Vector2(vise.x - hero.x, vise.y - hero.y);
    if (direction.length() > portee) direction.setLength(portee);

    const arrivee = this.ramenerSurTerre(depart.x + direction.x, depart.y + direction.y);
    hero.setPosition(arrivee.x, arrivee.y);
    hero.rendreInvulnerable(300);

    // La deflagration reste a l'endroit qu'il quitte.
    this.effetCercle(depart.x, depart.y, 70 + palier * 15, 0xd06bff);
    for (const e of this.ennemisDansRayon(depart.x, depart.y, 70 + palier * 15)) {
      this.repousser(e, depart.x, depart.y, 240);
      this.blesserEnnemi(e, hero.degats * (1 + palier), hero);
    }
  }

  effetSablier(this: ArenaScene, hero: Hero, fracture?: { duree: number; rayon: number }): void {
    const palier = Math.max(1, hero.palierDe("sablier"));
    const duree = fracture?.duree ?? this.dureeDeLEffet(hero, 3000 + palier * 2000);
    const facteur = palier >= 2 ? 0.25 : 0.4;
    const rayon = fracture?.rayon ?? this.rayonDeZone(hero, 240);

    this.aura(hero.x, hero.y, rayon / 8, 0x8ed6ff, duree);
    const x = hero.x;
    const y = hero.y;
    this.time.addEvent({
      delay: 300,
      repeat: Math.floor(duree / 300) - 1,
      callback: () => {
        for (const e of this.ennemisDansRayon(x, y, rayon)) e.ralentir(500, facteur);
      },
    });
  }

  /**
   * Teleportation (§4.13, base elementaire) : le Clignement sans la
   * deflagration. Un saut court et instantane vers ou l'on vise, ouvert a toutes
   * les classes — et rien d'autre que d'etre ailleurs.
   */
  effetTeleportation(this: ArenaScene, hero: Hero): void {
    const palier = Math.max(1, hero.palierDe("teleportation"));
    const depart = new Phaser.Math.Vector2(hero.x, hero.y);
    const vise = hero.estIncarne
      ? this.cameras.main.getWorldPoint(this.input.activePointer.x, this.input.activePointer.y)
      : this.pointDevant(hero, 200);
    const portee = auPalier(BASES.teleportation.distance, palier);
    const direction = new Phaser.Math.Vector2(vise.x - hero.x, vise.y - hero.y);
    if (direction.length() > portee) direction.setLength(portee);

    const arrivee = this.ramenerSurTerre(depart.x + direction.x, depart.y + direction.y);
    // Son ombre reste un instant la ou il etait : on voit d'ou il est parti.
    const ombre = this.add
      .image(depart.x, depart.y, hero.texture.key, hero.frame.name)
      .setFlipX(hero.flipX)
      .setTintFill(0x3a2f4a)
      .setAlpha(0.6)
      .setDepth(depart.y);
    this.tweens.add({ targets: ombre, alpha: 0, duration: 320, onComplete: () => ombre.destroy() });
    this.effetCercle(depart.x, depart.y, 22, 0x6b5a8a);
    hero.setPosition(arrivee.x, arrivee.y);
    hero.rendreInvulnerable(BASES.teleportation.invulnerable);
    this.effetCercle(arrivee.x, arrivee.y, 22, 0x6b5a8a);
  }

  // --- Assassin : Croc-en-jambe, Doppelganger, Contrat ---

  effetCrocEnJambe(this: ArenaScene, hero: Hero): void {
    const palier = Math.max(1, hero.palierDe("croc-en-jambe"));
    const rayon = this.rayonDeZone(hero, 80 + palier * 20);
    const point = hero.estIncarne
      ? this.cameras.main.getWorldPoint(this.input.activePointer.x, this.input.activePointer.y)
      : this.pointDevant(hero, 80);

    const tapis = this.add
      .image(point.x, point.y, "impact")
      .setTint(0xb0a08a)
      .setAlpha(0.3)
      .setScale((rayon * 2) / 16)
      .setDepth(point.y - 4);
    // Des lames semees au sol : le Vent peut les emporter (§4.13).
    this.elements.poserAuSol({ point, image: tapis });

    this.time.addEvent({
      delay: 500,
      repeat: Math.round(12 * hero.bonus.dureeEffets) - 1,
      callback: () => {
        for (const e of this.ennemisDansRayon(point.x, point.y, rayon)) {
          e.ralentir(600, 0.6);
          this.blesserEnnemi(e, Math.round(hero.degats * (0.4 + palier * 0.2)), hero);
        }
      },
    });
    this.time.delayedCall(this.dureeDeLEffet(hero, 6000), () => tapis.active && tapis.destroy());
  }

  effetDoppelganger(this: ArenaScene, hero: Hero): void {
    const palier = Math.max(1, hero.palierDe("doppelganger"));
    const double = new Double(this, hero.x, hero.y, hero, palier);
    this.invocations.add(double);
    this.effetCercle(hero.x, hero.y, 50, 0x9fd8ff);
  }

  /**
   * Contrat : la cible mourra, quoi qu'il arrive. En echange, l'assassin ne
   * peut plus toucher personne d'autre tant que le contrat court — c'est ce
   * renoncement qui en fait autre chose qu'un bouton "je gagne".
   */
  effetContrat(this: ArenaScene, hero: Hero): void {
    const palier = Math.max(1, hero.palierDe("contrat"));
    const delai = palier >= 2 ? 7000 : 10000;

    const candidats = this.ennemisDansRayon(hero.x, hero.y, 600);
    if (candidats.length === 0) {
      this.flotter(hero.x, hero.y - 20, "Personne a contracter", "#8a8397");
      return;
    }
    const cible = candidats.reduce((a, b) => (b.pv > a.pv ? b : a));

    cible.souscontrat = true;
    cible.setTint(0xff3b30);
    this.contrats.set(hero, cible);
    this.flotter(cible.x, cible.y - 22, "CONTRAT", "#ff3b30");

    this.time.delayedCall(delai, () => {
      this.contrats.delete(hero);
      if (!cible.active) return;
      this.flotter(cible.x, cible.y - 20, "HONORE", "#ff3b30");
      this.effetCercle(cible.x, cible.y, 70, 0xff3b30);
      this.blesserEnnemi(cible, cible.pv, hero);
    });
  }

  // --- Rodeur ---

  effetPluieDeFleches(this: ArenaScene, hero: Hero): void {
    const groupe = this.groupeLePlusDense(hero, 420, 120);
    if (!groupe) return;
    const x = groupe.x;
    const y = groupe.y;

    this.time.addEvent({
      delay: 180,
      repeat: 9,
      callback: () => {
        const px = x + this.rng.range(-110, 110);
        const py = y + this.rng.range(-110, 110);
        this.effetCercle(px, py, 34, 0xd8c48a);
        for (const e of this.ennemisDansRayon(px, py, 40)) {
          this.blesserEnnemi(e, Math.round(hero.degats * 1.1), hero);
        }
      },
    });
  }

  effetPiege(this: ArenaScene, hero: Hero): void {
    const palier = Math.max(1, hero.palierDe("piege"));
    const point = hero.estIncarne
      ? this.cameras.main.getWorldPoint(this.input.activePointer.x, this.input.activePointer.y)
      : this.pointDevant(hero, 90);

    const image = this.add
      .image(point.x, point.y, "impact")
      .setTint(0xb0a08a)
      .setAlpha(0.6)
      .setScale(2.4)
      .setDepth(point.y - 4);
    // Un piege pose au sol : le Vent peut l'emporter (§4.13).
    this.elements.poserAuSol({ point, image });

    const surveiller = this.time.addEvent({
      delay: 120,
      repeat: 150,
      callback: () => {
        const pris = this.ennemisDansRayon(point.x, point.y, 34);
        if (pris.length === 0) return;
        for (const e of pris) {
          e.ralentir(this.dureeDeLEffet(hero, 1000 + palier * 1000));
          if (palier >= 2) this.blesserEnnemi(e, hero.degats * palier, hero);
        }
        this.effetCercle(point.x, point.y, 40, 0xb0a08a);
        image.destroy();
        surveiller.remove();
      },
    });
    this.time.delayedCall(18000, () => image.active && image.destroy());
  }

  effetFlecheDuJugement(this: ArenaScene, hero: Hero): void {
    const palier = Math.max(1, hero.palierDe("fleche-du-jugement"));
    const seuil = 0.25 + palier * 0.15;
    const arrivee = this.pointDevant(hero, 2000);
    const penetration = penetrationDe(PENETRATION.flecheDuJugement(palier), hero.bonus, true);
    const touches = this.monstresLeLongDuTrait(hero.x, hero.y, arrivee.x, arrivee.y, 56, penetration);
    // Sa penetration epuisee, la fleche s'arrete sur le dernier qu'elle a
    // traverse : le trait le dit, pour qu'on voie jusqu'ou elle est allee.
    let bout = arrivee;
    const dernier = touches[touches.length - 1];
    if (dernier && touches.length >= penetration) {
      const longueur = Math.hypot(arrivee.x - hero.x, arrivee.y - hero.y) || 1;
      const ux = (arrivee.x - hero.x) / longueur;
      const uy = (arrivee.y - hero.y) / longueur;
      const avance = (dernier.x - hero.x) * ux + (dernier.y - hero.y) * uy;
      bout = new Phaser.Math.Vector2(hero.x + ux * avance, hero.y + uy * avance);
    }
    this.trainee(hero.x, hero.y, bout.x, bout.y, 0xfff0a0);
    this.cameras.main.shake(220, 0.008);

    for (const e of touches) {
      if (e.pv / e.pvMax <= seuil) {
        this.flotter(e.x, e.y - 16, "JUGE", "#fff0a0");
        this.blesserEnnemi(e, e.pv, hero);
      } else {
        this.blesserEnnemi(e, hero.degats * 3, hero);
      }
    }
  }

  // --- Oracle ---

  effetAube(this: ArenaScene, hero: Hero): void {
    this.cameras.main.flash(300, 255, 240, 200);
    for (const allie of this.heros) {
      if (allie.etat === "mort") continue;
      allie.soigner(allie.pvMax * 0.45);
      allie.rendreInvulnerable(1600);
      this.effetCercle(allie.x, allie.y, 70, 0xfff0c0);
    }
    void hero;
  }

  effetPriere(this: ArenaScene, hero: Hero): void {
    const palier = Math.max(1, hero.palierDe("priere"));
    let cible: Hero | null = null;
    for (const allie of this.heros) {
      if (allie.etat === "mort") continue;
      if (!cible || allie.ratioPv < cible.ratioPv) cible = allie;
    }
    if (!cible) return;
    const soin = cible.pvMax * (0.15 + palier * 0.1);
    cible.soigner(soin);
    this.effetCercle(cible.x, cible.y, 60, 0xfff0c0);
    this.flotter(cible.x, cible.y - 22, `+${Math.round(soin)}`, "#7ee0a0");
  }

  effetChantDeGuerre(this: ArenaScene, hero: Hero): void {
    const palier = Math.max(1, hero.palierDe("chant-de-guerre"));
    const duree = this.dureeDeLEffet(hero, 7000 + palier * 1000);
    const facteur = palier >= 2 ? 0.55 : 0.7;

    for (const allie of this.heros) {
      if (allie.etat === "mort") continue;
      allie.cadenceTemporaire = facteur;
      this.effetCercle(allie.x, allie.y, 50, 0xffd166);
    }
    this.time.delayedCall(duree, () => {
      for (const allie of this.heros) allie.cadenceTemporaire = 1;
    });
  }

  // --- Chevalier Sacre ---

  /**
   * Martyre : pendant quelques secondes, il encaisse a la place de tout le
   * monde et ne peut pas mourir. C'est le sommet de sa classe : il transforme
   * un effondrement d'equipe en sursis.
   */
  effetMartyre(this: ArenaScene, hero: Hero): void {
    const palier = Math.max(1, hero.palierDe("martyre"));
    const duree = this.dureeDeLEffet(hero, 5000 + palier * 3000);
    this.martyr = hero;
    hero.rendreInvulnerable(duree);
    this.aura(hero.x, hero.y, 5, 0xffd166, duree);
    this.time.delayedCall(duree, () => {
      if (this.martyr === hero) this.martyr = null;
    });
  }

  // --- Necromancien ---

  effetLeveeDesMorts(this: ArenaScene, hero: Hero): void {
    // Tous les ennemis proches tombent et se relevent de son cote.
    const proies = this.ennemisDansRayon(hero.x, hero.y, 600).slice(0, 8);
    for (const e of proies) {
      const x = e.x;
      const y = e.y;
      this.blesserEnnemi(e, e.pv, hero);
      this.relever(hero, x, y);
    }
    this.effetCercle(hero.x, hero.y, 180, 0x9ee8a0);
  }

  effetAppelDesMorts(this: ArenaScene, hero: Hero): void {
    const armee = (this.invocations.getChildren() as Invocation[]).filter(
      (i) => i.active && i instanceof MortVivant && i.maitre === hero,
    );
    if (armee.length === 0) {
      this.flotter(hero.x, hero.y - 20, "Aucun mort a appeler", "#8a8397");
      return;
    }

    let x = 0;
    let y = 0;
    for (const mort of armee) {
      x += mort.x;
      y += mort.y;
      mort.destroy();
    }

    const colosse = new MortVivant(this, x / armee.length, y / armee.length, hero);
    colosse.pvMax *= armee.length;
    colosse.pv = colosse.pvMax;
    colosse.degats *= Math.max(2, Math.round(armee.length / 2));
    colosse.vitesse *= 0.7;
    colosse.setScale(2.4);
    colosse.finDeVie = Infinity;
    this.invocations.add(colosse);

    this.effetCercle(colosse.x, colosse.y, 200, 0x9ee8a0);
    this.cameras.main.shake(400, 0.01);
  }

  // --- Communes de haut rang ---

  effetOrageFinal(this: ArenaScene, hero: Hero): void {
    const palier = Math.max(1, hero.palierDe("orage-final"));
    const duree = this.dureeDeLEffet(hero, 6000 + palier * 4000);
    const rayon = this.rayonDeZone(hero, 60);

    this.time.addEvent({
      delay: 400,
      repeat: Math.floor(duree / 400) - 1,
      callback: () => {
        if (hero.etat === "mort") return;
        const cible = this.ennemiLePlusProche(hero.x, hero.y, 280);
        const x = cible?.x ?? hero.x + this.rng.range(-160, 160);
        const y = cible?.y ?? hero.y + this.rng.range(-160, 160);
        this.trainee(x, y - 200, x, y, 0x8ed6ff);
        this.effetCercle(x, y, rayon, 0x8ed6ff);
        for (const e of this.ennemisDansRayon(x, y, rayon)) {
          this.blesserEnnemi(e, Math.round(hero.degats * 1.6), hero);
        }
      },
    });
  }

  /** Heure sombre : le temps s'arrete pour tout le monde sauf le joueur. */
  effetHeureSombre(this: ArenaScene, hero: Hero): void {
    const palier = Math.max(1, hero.palierDe("heure-sombre"));
    this.figerLeMonde(this.dureeDeLEffet(hero, 1500 + palier * 1500));
  }

  /** Tout s'arrete, sauf les heros : l'Heure sombre, et le debut du Neant. */
  figerLeMonde(this: ArenaScene, duree: number): void {
    this.figeJusqua = this.time.now + duree;
    this.cameras.main.flash(200, 40, 20, 60);
    // La teinte des figes se pose a chaque image (`teinterEnnemi`, la nuee).
  }

  groupeLePlusDense(this: ArenaScene, hero: Hero, portee: number, rayon: number): Ennemi | null {
    const candidats = this.ennemisDansRayon(hero.x, hero.y, portee);
    if (candidats.length === 0) return null;
    let cible = candidats[0]!;
    let meilleur = -1;
    for (const e of candidats) {
      const compte = this.ennemisDansRayon(e.x, e.y, rayon).length;
      if (compte > meilleur) {
        meilleur = compte;
        cible = e;
      }
    }
    return cible;
  }

  // --- Ultimes de classe ---

  effetTourbillon(this: ArenaScene, hero: Hero): void {
    const rayon = 110;
    this.effetCercle(hero.x, hero.y, rayon, 0xff9d4a);
    if (hero.estIncarne) this.cameras.main.shake(140, 0.006);
    for (const e of this.ennemisDansRayon(hero.x, hero.y, rayon)) {
      this.repousser(e, hero.x, hero.y, 300);
      this.blesserEnnemi(e, hero.degats * 3, hero);
    }
  }

  effetRempart(this: ArenaScene, hero: Hero): void {
    hero.rendreInvulnerable(3500);
    this.effetCercle(hero.x, hero.y, 140, 0x8ec9ff);
    for (const e of this.ennemisDansRayon(hero.x, hero.y, 140)) {
      this.repousser(e, hero.x, hero.y, 420);
      this.blesserEnnemi(e, hero.degats, hero);
    }
    this.aura(hero.x, hero.y, 3, 0x8ec9ff, 3500);
  }

  effetMeteore(this: ArenaScene, hero: Hero): void {
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
    // Le cratere du §4.21 : le meteore l'ecrit dans le sol, et il y reste.
    abimerLeSol(this.carte, cible.x, cible.y, "cratere", 34);
    if (hero.estIncarne) this.cameras.main.shake(180, 0.007);
    for (const e of this.ennemisDansRayon(cible.x, cible.y, 110)) {
      this.blesserEnnemi(e, hero.degats * 4, hero);
    }
  }

  effetOmbre(this: ArenaScene, hero: Hero): void {
    const arrivee = this.pointDevant(hero, 230);
    hero.rendreInvulnerable(500);
    this.trainee(hero.x, hero.y, arrivee.x, arrivee.y, 0x7ee0a0);

    const penetration = penetrationDe(PENETRATION.ombre, hero.bonus, false);
    for (const e of this.monstresLeLongDuTrait(hero.x, hero.y, arrivee.x, arrivee.y, 44, penetration)) {
      this.blesserEnnemi(e, hero.degats * 5, hero);
    }
    hero.setPosition(arrivee.x, arrivee.y);
  }

  // --- Chevalier Sacre ---

  effetSursautSacre(this: ArenaScene, hero: Hero): void {
    const palier = Math.max(1, hero.palierDe("sursaut-sacre"));
    hero.rendreInvulnerable(this.dureeDeLEffet(hero, 1000));
    hero.soigner(hero.pvMax * (0.2 + palier * 0.05));
    this.effetCercle(hero.x, hero.y, 130, 0xfff0a0);
    for (const e of this.ennemisDansRayon(hero.x, hero.y, 130)) this.repousser(e, hero.x, hero.y, 380);
  }

  effetBenediction(this: ArenaScene, hero: Hero): void {
    const palier = Math.max(1, hero.palierDe("benediction"));
    const duree = this.dureeDeLEffet(hero, 4000 + palier * 1000);
    const soin = palier;
    const x = hero.x;
    const y = hero.y;
    const rayon = this.rayonDeZone(hero, 130);

    this.aura(x, y, rayon / 8, 0xa8ffc8, duree);
    this.time.addEvent({
      delay: 1000,
      repeat: Math.floor(duree / 1000) - 1,
      callback: () => {
        for (const allie of this.heros) {
          if (allie.etat === "mort") continue;
          if (Phaser.Math.Distance.Between(allie.x, allie.y, x, y) > rayon) continue;
          allie.soigner(soin);
          this.flotter(allie.x, allie.y - 20, `+${soin}`, "#7ee0a0");
        }
      },
    });
  }

  // --- Guerrier ---

  effetMoulinet(
    this: ArenaScene,
    hero: Hero,
    variante: string,
    embrase?: { duree: number; rayon: number; brule: number },
  ): void {
    const palier = Math.max(1, hero.palierDe("moulinet"));
    const duree = embrase?.duree ?? this.dureeDeLEffet(hero, 2000 + palier * 500);
    const rayon = embrase?.rayon ?? this.rayonDeZone(hero, 90);
    const ticks = Math.floor(duree / 200);

    this.time.addEvent({
      delay: 200,
      repeat: ticks - 1,
      callback: () => {
        if (hero.etat === "mort") return;
        for (const e of this.ennemisDansRayon(hero.x, hero.y, rayon)) {
          if (variante === "moulinet-aspirant") this.repousser(e, hero.x, hero.y, -220);
          this.blesserEnnemi(
            e,
            Math.round(hero.degats * 0.55 + (embrase?.brule ?? 0)),
            hero,
            variante === "moulinet-sanglant" ? 1 : 0,
          );
        }
        this.effetCercle(hero.x, hero.y, rayon, embrase ? 0xff8a3d : 0xffc27a);
        // Le Tourbillon infernal se voit : des flammes naissent sur le cercle
        // et s'eteignent aussitot, deux par tour.
        if (embrase) this.flammesSurLeCercle(hero.x, hero.y, rayon, 2);
      },
    });
  }

  // --- Mage ---

  effetDome(this: ArenaScene, hero: Hero): void {
    const palier = Math.max(1, hero.palierDe("dome"));
    const pv = [60, 110, 180][palier - 1] ?? 60;
    const rayon = 70;

    // Pose ou le joueur regarde ; l'IA le pose devant elle.
    const point = hero.estIncarne
      ? this.cameras.main.getWorldPoint(this.input.activePointer.x, this.input.activePointer.y)
      : this.pointDevant(hero, 90);

    this.poserDome(point.x, point.y, rayon, pv);
  }

  /** Un dome au sol. La Forteresse mobile en pose qui ne durent que quelques secondes. */
  poserDome(this: ArenaScene, x: number, y: number, rayon: number, pv: number, finDeVie?: number): void {
    const image = this.add
      .image(x, y, "impact")
      .setTint(0x8ed6ff)
      .setAlpha(0.45)
      .setScale((rayon * 2) / 16)
      .setDepth(y - 3);

    this.domes.push({ image, x, y, rayon, pv, pvMax: pv, finDeVie });
  }

  /**
   * Exil : il sacrifie tout. Toutes les creatures hostiles sont bannies sans
   * rapporter la moindre experience, et le mage reste 30 secondes a un point de
   * vie, immobile, insoignable, condamne au moindre contact.
   */
  effetExil(this: ArenaScene, hero: Hero): void {
    this.bannirTout();
    this.payerLExil(hero, 30000);
  }

  /** Toutes les creatures hostiles bannies, sans experience. Rend combien il y en avait. */
  bannirTout(this: ArenaScene): number {
    this.cameras.main.shake(600, 0.014);
    this.cameras.main.flash(400, 200, 120, 255);

    let bannis = 0;
    for (const objet of [...this.ennemis.getChildren()] as Ennemi[]) {
      if (!objet.active) continue;
      this.effetCercle(objet.x, objet.y, 30, 0xd06bff);
      objet.destroy(); // banni : personne ne gagne d'experience
      bannis += 1;
    }
    return bannis;
  }

  /** Le prix de l'Exil : un point de vie, immobile, insoignable, tue au moindre contact. */
  payerLExil(this: ArenaScene, hero: Hero, duree: number): void {
    hero.pv = Math.max(1, Math.round(hero.pvMax * 0.01));
    hero.immobiliser(duree);
    hero.condamner(duree);
    this.aura(hero.x, hero.y, 4, 0xd06bff, duree);
    this.flotter(hero.x, hero.y - 40, `${Math.round(duree / 1000)} s a decouvert`, "#ff8a7a");
  }

  // --- Assassin ---

  effetInvisibilite(this: ArenaScene, hero: Hero): void {
    const palier = Math.max(1, hero.palierDe("invisibilite"));
    const duree = this.dureeDeLEffet(hero, 4000 + palier * 1000);
    hero.rendreInvisible(duree);
    hero.multiplicateurVitesse = 1 + 0.05 + palier * 0.05;
    this.time.delayedCall(duree, () => void (hero.multiplicateurVitesse = 1));
  }

  /**
   * Hecatombe : tout ce qui agonise meurt, et chaque execution projette
   * l'assassin sur sa cible suivante.
   */
  effetHecatombe(this: ArenaScene, hero: Hero): void {
    const palier = Math.max(1, hero.palierDe("hecatombe"));
    const seuil = 0.05 + palier * 0.05;

    const condamnes = this.ennemisDansRayon(hero.x, hero.y, 520)
      .filter((e) => e.pv / e.pvMax <= seuil)
      .sort(
        (a, b) =>
          Phaser.Math.Distance.Between(hero.x, hero.y, a.x, a.y) -
          Phaser.Math.Distance.Between(hero.x, hero.y, b.x, b.y),
      )
      .slice(0, 10);

    if (condamnes.length === 0) {
      this.flotter(hero.x, hero.y - 20, "Personne a achever", "#8a8397");
      return;
    }

    hero.rendreInvulnerable(condamnes.length * 120 + 200);
    condamnes.forEach((e, i) => {
      this.time.delayedCall(i * 110, () => {
        if (!e.active || hero.etat === "mort") return;
        this.trainee(hero.x, hero.y, e.x, e.y, 0x7ee0a0);
        hero.setPosition(e.x, e.y);
        this.flotter(e.x, e.y - 16, "EXECUTE", "#ff6b5a");
        this.blesserEnnemi(e, e.pv, hero);
      });
    });
  }
}
