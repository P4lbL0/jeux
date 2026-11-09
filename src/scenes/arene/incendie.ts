import Phaser from "phaser";
import { abimerLeSol } from "../../game/dessin/morceaux";
import { REGLAGES_INCENDIE, type Combustible, type SorteDeFeu } from "../../core/incendie";
import { type Champ } from "../../game/champs";
import { Maison, REGLAGES_MAISONS } from "../../game/maisons";
import type { ArenaScene } from "../ArenaScene";
import { cleDuFeu, RAYON_DU_SEAU } from "./reglages";

/**
 * L'incendie (§4.21) : ce qui allume, ce que le feu ronge, les seaux, la foudre.
 *
 * Une part d'`ArenaScene`, greffée sur son prototype (`greffer`) : `this` est la scène.
 */
export class ArenaIncendie {

  // ------------------------------------------------------------ l'incendie

  /**
   * Ce que le feu ronge, gagne et perd (§4.21, l'incendie).
   *
   * Appelee a chaque image et **elle sort tout de suite** tant que rien ne
   * brule : une comparaison, c'est tout ce que coute un village qui ne brule
   * pas. Le vrai travail est dans le noyau, une fois par seconde.
   */
  majIncendie(this: ArenaScene): void {
    if (!this.incendie.actif) {
      // Le dernier feu vient de s'eteindre : on range les flammes et on coupe
      // le crepitement **une fois**, pas a chaque image.
      if (this.quelqueChoseBrulait) {
        this.quelqueChoseBrulait = false;
        this.feux.toutCacher();
      }
      return;
    }
    this.quelqueChoseBrulait = true;
    if (this.enPause) return;

    const passage = this.incendie.avancer(
      this.time.now,
      this.meteo.extinction(this.cycle.phase, this.cycle.part),
      this.combustibles(),
      this.rng,
    );

    if (passage) {
      for (const degat of passage.degats) this.rongerParLeFeu(degat.cible, degat.sorte, degat.degats);
      for (const foyer of passage.eteints) this.cibles.delete(foyer.cible);
      if (passage.departs.length > 0) {
        this.events.emit("annonce", "Le feu prend a cote — il se repand", "guet");
      }
      this.eteindreAvecLesHeros();
    }

    this.servirLesSeaux();

    this.feux.majorer(this.incendie.foyers, this.time.now, this.partDeNuit);
  }

  /**
   * Rendre a chaque feu repris la chose qu'il brule (§4.21, §4.28).
   *
   * Une sauvegarde ne garde que des **cles de case** : une reference d'objet ne
   * traverse pas un rechargement. On les retrouve ici, une fois, et un feu dont
   * la maison a disparu entre-temps s'eteint au lieu de bruler dans le vide.
   */
  raccrocherLesFeux(this: ArenaScene): void {
    this.cibles.clear();
    for (const foyer of [...this.incendie.foyers]) {
      const objet =
        this.maisons.debout.find((m) => cleDuFeu(m) === foyer.cible) ??
        this.champs.tous.find((c) => cleDuFeu(c) === foyer.cible) ??
        null;
      if (objet) this.cibles.set(foyer.cible, objet);
      else this.incendie.eteindre(foyer.cible);
    }
  }

  /**
   * Tout ce qui peut prendre feu, a cet instant (§4.21).
   *
   * Construit **seulement quand quelque chose brule**, et une fois par seconde
   * au plus : une trentaine d'elements, ce qui reste loin du parcours par image
   * que le §4.17 interdit.
   */
  combustibles(this: ArenaScene): Combustible[] {
    const liste: Combustible[] = [];
    for (const maison of this.maisons.debout) {
      const centre = maison.centre;
      liste.push({ id: cleDuFeu(maison), x: centre.x, y: centre.y, sorte: "maison" });
    }
    for (const champ of this.champs.tous) {
      liste.push({ id: cleDuFeu(champ), x: champ.x, y: champ.y, sorte: "champ" });
    }
    return liste;
  }

  /**
   * Ce qu'une seconde de feu coute a ce qui brule.
   *
   * Une maison perd des points de vie et tombe **en ruine**, comme sous les
   * coups des monstres (choix d'Angelos, 22 septembre 2026) : les gens sortent,
   * ils sont sans abri, et on releve au plein prix. Un champ perd sa maturite,
   * et quand le feu l'a mange en entier il n'en reste rien du tout.
   */
  rongerParLeFeu(this: ArenaScene, cible: string, sorte: SorteDeFeu, degats: number): void {
    const objet = this.cibles.get(cible);
    if (!objet) return this.incendie.eteindre(cible);

    if (sorte === "maison") {
      const maison = objet as Maison;
      // Le batiment noircit a mesure qu'il brule (§4.21) : compte ici et pas
      // sur ses points de vie, parce qu'une maison enfoncee par une horde n'est
      // pas une maison brulee.
      maison.brulee = Math.min(1, maison.brulee + degats / REGLAGES_MAISONS.pvMax);
      if (!this.maisons.blesser(maison, degats, this.time.now)) return;
      this.cibles.delete(cible);
      this.incendie.eteindre(cible);
      const centre = maison.centre;
      abimerLeSol(this.carte, centre.x, centre.y, "brule", 30);
      this.events.emit("annonce", `Une ${maison.nom.toLowerCase()} a brule — L pour la relever`, "guet");
      return;
    }

    const champ = objet as Champ;
    champ.maturite = Math.max(0, champ.maturite - degats);
    const foyer = this.incendie.foyerDe(cible);
    if (!foyer || foyer.ronge < 1) return;

    // Le champ a brule en entier : il ne reste pas un carre de terre a demi
    // noirci, il ne reste rien (§4.21). Le sol garde la marque.
    this.cibles.delete(cible);
    this.incendie.eteindre(cible);
    abimerLeSol(this.carte, champ.x, champ.y, "brule", 24);
    this.champs.pietiner(champ);
    this.events.emit("annonce", "Un champ est parti en fumee", "guet");
  }

  /**
   * Les heros eteignent en restant contre le feu (§4.21).
   *
   * Pas de touche, pas d'ordre : on se met devant et ca s'eteint. C'est la
   * seule facon d'arreter un feu la nuit, quand les habitants sont a l'abri —
   * et le prix a payer est de ne pas etre sur le front pendant ce temps-la.
   */
  eteindreAvecLesHeros(this: ArenaScene): void {
    const ciel = this.meteo.extinction(this.cycle.phase, this.cycle.part);
    for (const foyer of [...this.incendie.foyers]) {
      let bras = 0;
      for (const hero of this.heros) {
        if (!hero.estVivant) continue;
        if (Phaser.Math.Distance.Between(hero.x, hero.y, foyer.x, foyer.y) > RAYON_DU_SEAU) continue;
        bras += 1;
      }
      if (bras === 0) continue;
      if (this.incendie.arroser(foyer.cible, bras * REGLAGES_INCENDIE.pointsHerosParSeconde, ciel)) {
        this.cibles.delete(foyer.cible);
        this.events.emit("annonce", "Le feu est eteint", "toi");
      }
    }
  }

  /**
   * Les habitants au seau (§4.21).
   *
   * Ils y vont **le jour et tout seuls** : personne ne donne l'ordre, c'est la
   * vie autonome qui les envoie (§4.27, occupation « eteindre »). Ici on ne
   * fait que constater deux arrivees — au puits, on remplit ; au feu, on jette.
   *
   * ⚠️ Parcourt les habitants a chaque image, mais **seulement quand quelque
   * chose brule** : `majIncendie` sort avant s'il n'y a pas de feu, et un
   * village en feu a d'autres choses a compter que trente comparaisons.
   */
  servirLesSeaux(this: ArenaScene): void {
    const ciel = this.meteo.extinction(this.cycle.phase, this.cycle.part);
    for (const villageois of this.village.vivants) {
      if (villageois.occupation !== "eteindre") continue;

      if (!villageois.seauPlein) {
        if (this.puits === null) villageois.seauPlein = true;
        else if (Phaser.Math.Distance.Between(villageois.x, villageois.y, this.puits.x, this.puits.y) <= RAYON_DU_SEAU) {
          villageois.seauPlein = true;
        }
        continue;
      }

      const foyer = this.incendie.leProcheDe(villageois.x, villageois.y, RAYON_DU_SEAU);
      if (!foyer) continue;
      villageois.seauPlein = false;
      if (this.incendie.arroser(foyer.cible, REGLAGES_INCENDIE.pointsParSeau, ciel)) {
        this.cibles.delete(foyer.cible);
        this.events.emit("annonce", "Le feu est noye — ils y sont arrives", "village");
      }
    }
  }

  /**
   * Un depart de feu, d'ou qu'il vienne (§4.21).
   *
   * Toutes les sources passent par ici — le monstre qui cogne, le Pyromane,
   * l'eclair, le fou du degre 3 —, ce qui garantit qu'un feu se voit, s'annonce
   * et se retrouve toujours de la meme facon.
   *
   * @returns vrai si un feu vient vraiment de prendre
   */
  mettreLeFeu(this: ArenaScene, objet: Maison | Champ, raison: string): boolean {
    const cle = cleDuFeu(objet);
    const maison = objet instanceof Maison ? objet : null;
    if (maison && !maison.debout) return false;

    const centre = maison ? maison.centre : { x: objet.x, y: objet.y };
    const foyer = this.incendie.allumer(
      { id: cle, x: centre.x, y: centre.y, sorte: maison ? "maison" : "champ" },
      this.time.now,
    );
    if (!foyer) return false;

    this.cibles.set(cle, objet);
    this.events.emit("annonce", raison, "guet");
    return true;
  }

  /**
   * L'eclair qui met le feu (§4.21).
   *
   * Un eclair sur vingt, et la regle vit dans `Meteo` depuis le premier morceau
   * du ciel : ici on ne fait que lui donner quelque chose a bruler. Il frappe
   * **ce qui est debout**, au hasard — la foudre ne choisit pas la maison la
   * plus utile.
   */
  regarderLaFoudre(this: ArenaScene): void {
    if (!this.pluie.eclaire) return;
    if (!this.meteo.unEclairAllumeUnFeu(this.rng)) return;

    const debout = this.maisons.debout;
    if (debout.length === 0) return;
    this.mettreLeFeu(this.rng.pick(debout), "La foudre est tombee sur une maison — elle brule");
  }
}
