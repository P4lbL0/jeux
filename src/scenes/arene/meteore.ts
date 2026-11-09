import Phaser from "phaser";
import { decorParCle, CLE_METEORITE } from "../../game/dessin/decor";
import { abimerLeSol } from "../../game/dessin/morceaux";
import { secousse } from "../../game/effets";
import { EGLISE } from "../../core/carte";
import { REGLAGES_METEORE } from "../../core/meteore";
import type { ArenaScene } from "../ArenaScene";
import { cleDuFeu } from "./reglages";

/**
 * Le météore (§4.21) : le ciel qui guette, l'impact, le cratère et la pierre du ciel.
 *
 * Une part d'`ArenaScene`, greffée sur son prototype (`greffer`) : `this` est la scène.
 */
export class ArenaMeteore {

  // ------------------------------------------------------------- le meteore

  /**
   * Les cicatrices d'une partie qu'on reprend (§4.21, §4.28).
   *
   * Un cratere n'est pas un objet : c'est une ecriture dans la carte, et la
   * carte est recuite a chaque partie. On la reecrit donc, une fois, a la
   * reprise — sans quoi recharger effacerait ce que le ciel a fait.
   */
  recreuserLesCrateres(this: ArenaScene): void {
    for (const cratere of this.cielQuiTombe.crateres) {
      abimerLeSol(this.carte, cratere.x, cratere.y, "cratere", cratere.rayon);
    }
    const gisement = this.cielQuiTombe.gisement;
    if (gisement) this.poserLaPierreDuCiel(gisement);
  }

  /**
   * Le ciel lache-t-il quelque chose cette nuit ? (§4.21)
   *
   * Tire **a la tombee de la nuit**, une fois, comme les fronts et le temps
   * qu'il fait. Pas pendant la marche : le monde d'avant l'installation n'est
   * pas encore le notre, et un cratere y serait perdu (§4.29).
   */
  guetterLeCiel(this: ArenaScene): void {
    if (this.enMarche) return;
    const point = this.cielQuiTombe.guetterLaNuit(
      { x: EGLISE.x, y: EGLISE.y },
      this.time.now,
      this.rng,
    );
    if (!point) return;

    this.chute.annoncer();
    this.events.emit("annonce", "Une lumiere traverse le ciel — elle tombe sur nous", "guet");
  }

  /**
   * Les douze secondes de chute, puis le coup (§4.21).
   *
   * Comme l'incendie, **elle sort a la premiere ligne** tant que rien ne tombe.
   */
  majMeteore(this: ArenaScene): void {
    if (this.cielQuiTombe.phase !== "annonce") return;
    if (this.enPause) return;

    const point = this.cielQuiTombe.avancer(this.time.now);
    if (point) return this.frapperLeMeteore(point);

    this.chute.majorer(this.cielQuiTombe.point, this.cielQuiTombe.partDeLAnnonce(this.time.now));
  }

  /**
   * L'impact (§4.21).
   *
   * **Tout ce qui est dans le cratere tombe, sauf l'eglise** (choix d'Angelos,
   * 22 septembre 2026). Dans l'ordre : le sol est creuse pour de bon, les
   * batiments tombent, les champs sont perdus, les arbres disparaissent, les
   * monstres pris dedans meurent — **sans donner ni or ni experience**, parce
   * qu'un meteore n'est pas un heros et que le §4.5 donne l'XP a qui tue.
   *
   * Puis la pierre reste, et avec elle le fer du ciel.
   */
  frapperLeMeteore(this: ArenaScene, point: { x: number; y: number }): void {
    const rayon = REGLAGES_METEORE.rayon;
    this.chute.frapper(point);
    this.cameras.main.shake(520, 0.016);
    secousse(this, "fort");

    // ⚠️ **Le cratere s'ecrit dans la carte cuite**, pas dans un objet pose
    // dessus : il survit au zoom, a la profondeur et a tout ce qui marchera
    // dessus, et il ne coute rien par image (§4.30).
    abimerLeSol(this.carte, point.x, point.y, "cratere", rayon);

    let perdus = 0;
    for (const maison of [...this.maisons.debout]) {
      const c = maison.centre;
      if (Phaser.Math.Distance.Between(c.x, c.y, point.x, point.y) > rayon) continue;
      this.incendie.eteindre(cleDuFeu(maison));
      this.cibles.delete(cleDuFeu(maison));
      this.maisons.tomber(maison);
      perdus += 1;
    }

    for (const construction of [...this.constructions.toutes]) {
      if (construction.def.indestructible) continue;
      if (Phaser.Math.Distance.Between(construction.x, construction.y, point.x, point.y) > rayon) continue;
      this.constructions.detruire(construction);
      perdus += 1;
    }

    for (const champ of [...this.champs.tous]) {
      if (Phaser.Math.Distance.Between(champ.x, champ.y, point.x, point.y) > rayon) continue;
      this.incendie.eteindre(cleDuFeu(champ));
      this.cibles.delete(cleDuFeu(champ));
      this.champs.pietiner(champ);
    }

    for (const e of this.ennemisDansRayon(point.x, point.y, rayon)) {
      this.marquerLaMort(e);
      e.destroy();
    }

    this.raserLesArbres(point, rayon);

    // Ce qui brule autour : le meteore allume, l'incendie fait le reste. Il ne
    // pose pas de feu **dans** le cratere — il n'y reste rien a bruler.
    for (let i = 0; i < REGLAGES_METEORE.feux; i++) {
      const angle = this.rng.next() * Math.PI * 2;
      const d = rayon + this.rng.next() * (REGLAGES_METEORE.porteeDesFeux - rayon);
      const maison = this.maisons.laPlusProcheDebout(
        point.x + Math.cos(angle) * d,
        point.y + Math.sin(angle) * d,
      );
      if (!maison) continue;
      const c = maison.centre;
      if (Phaser.Math.Distance.Between(c.x, c.y, point.x, point.y) > REGLAGES_METEORE.porteeDesFeux) continue;
      this.mettreLeFeu(maison, "Le choc a mis le feu a une maison");
    }

    this.poserLaPierreDuCiel(point);
    this.events.emit(
      "annonce",
      perdus > 0
        ? `Le ciel est tombe — ${perdus} batiment${perdus > 1 ? "s" : ""} raye${perdus > 1 ? "s" : ""} de la carte`
        : "Le ciel est tombe a cote du village",
      "guet",
    );
    this.events.emit("annonce", "Du fer du ciel fume dans le cratere — va le chercher", "village");
  }

  /**
   * Les arbres emportes par l'impact (§4.21, « foret brulee »).
   *
   * ⚠️ **Un parcours de toute la liste d'affichage**, et c'est assume : les
   * arbres sont des images posees une fois, sans liste a eux (il y en a
   * plusieurs milliers). Le §4.17 interdit un parcours **par image**, pas un
   * parcours ponctuel — et il se produit au plus une fois par partie.
   */
  raserLesArbres(this: ArenaScene, point: { x: number; y: number }, rayon: number): void {
    for (const objet of [...this.children.list]) {
      const image = objet as Phaser.GameObjects.Image;
      const cle = typeof image.texture?.key === "string" ? image.texture.key : "";
      if (!cle.startsWith("decor-arbre") && !cle.startsWith("decor-conifere")) continue;
      if (Phaser.Math.Distance.Between(image.x, image.y, point.x, point.y) > rayon) continue;
      image.destroy();
    }
  }

  /** La pierre tombee, posee dans son cratere tant qu'il reste du fer. */
  poserLaPierreDuCiel(this: ArenaScene, point: { x: number; y: number }): void {
    this.pierreDuCiel?.destroy();
    this.pierreDuCiel = this.add
      .image(point.x, point.y, CLE_METEORITE)
      .setOrigin(0.5, decorParCle(CLE_METEORITE).origineY)
      .setDepth(point.y);
  }
}
