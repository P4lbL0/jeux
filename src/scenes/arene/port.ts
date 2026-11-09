import { NOMS_RESSOURCE } from "../../core/habitants";
import type { Ressource } from "../../core/habitants";
import { calmePourUnNavire } from "../../core/port";
import { BatimentPort } from "../../game/port";
import type { ArenaScene } from "../ArenaScene";

/**
 * Le port : le navire, la vente, le travail au port.
 *
 * Une part d'`ArenaScene`, greffée sur son prototype (`greffer`) : `this` est la scène.
 */
export class ArenaPort {

  // --------------------------------------------------------------- le port

  /**
   * Le port avance, et la voile guette le calme (DESIGN.md §4.18).
   *
   * Appelee une fois par image, et elle ne fait presque rien : deux
   * comparaisons de scalaires tant qu'aucun navire n'est attendu. Le §4.17
   * interdit de parcourir quoi que ce soit ici.
   */
  majPort(this: ArenaScene, delta: number): void {
    this.port.majorer(delta);

    if (!this.navireAttendu || !this.port.debout || this.port.navireAQuai) return;
    if (
      !calmePourUnNavire({
        phase: this.cycle.phase,
        monstresDebout: this.ennemis.getLength(),
        journeesDesMorts: this.village.memoireDesMorts,
        journee: this.cycle.jour,
      })
    ) {
      return;
    }

    // Il ne vient qu'une fois par journee : le tirage a eu lieu a l'aube, le
    // calme ne decide que du moment.
    this.navireAttendu = false;
    this.port.accoster(this);
  }

  /**
   * On lui vend quelque chose.
   *
   * Toute la regle est dans `core/port.ts` — y compris le fait que **vendre fait
   * baisser le cours**. La scene ne fait qu'encaisser et annoncer.
   */
  vendreAuNavire(this: ArenaScene, ressource: Ressource, quantite: number): void {
    if (this.termine) return;

    const vente = this.port.regles.vendre(ressource, quantite, this.village.stocks);
    if (vente.pieces <= 0) {
      this.events.emit("annonce", `Pas assez de ${NOMS_RESSOURCE[ressource].toLowerCase()} a vendre`, "toi");
      return;
    }

    this.argent += vente.pieces;
    this.events.emit(
      "annonce",
      `${vente.unites} ${NOMS_RESSOURCE[ressource].toLowerCase()} vendus — ${vente.pieces} pieces`,
      "port",
    );
  }

  /**
   * La touche du port : relever le chantier, ou ouvrir la vente.
   *
   * Une seule touche pour les deux gestes qu'on peut lui faire, comme `Y` pour
   * l'eglise : ils ne sont jamais disponibles en meme temps.
   */
  oeuvrerAuPort(this: ArenaScene): void {
    const hero = this.hero;
    if (!hero) return;

    if (!this.port.debout) {
      if (this.port.regles.etat === "chantier") {
        this.events.emit(
          "annonce",
          `Le port est en chantier — ${Math.round(this.port.regles.partChantier * 100)}%`,
          "port",
        );
        return;
      }
      if (!this.port.aPortee(hero.x, hero.y)) {
        this.events.emit("annonce", "Il faut etre au port, sur la plage a l'ouest", "toi");
        return;
      }
      if (!this.port.lancerLeChantier(this.village.stocks)) {
        this.events.emit("annonce", `Le port demande ${BatimentPort.coutLisible()}`, "toi");
      }
      return;
    }

    if (!this.port.navireAQuai) {
      this.events.emit("annonce", "Aucun navire a quai — il en vient quand le village est calme", "toi");
      return;
    }
    if (!this.port.aPortee(hero.x, hero.y)) {
      this.events.emit("annonce", "Trop loin du port pour commercer", "toi");
      return;
    }
    this.events.emit("basculer-port");
  }
}
