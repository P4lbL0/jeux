import { Hero, type Capacite } from "../../game/entities";
import { declencher } from "../../game/poses";
import type { ArenaScene } from "../ArenaScene";
import { ACTIONS_CAPACITE } from "./reglages";

/**
 * Les capacités : les gérer, les lancer, leur durée et leur rayon.
 *
 * Une part d'`ArenaScene`, greffée sur son prototype (`greffer`) : `this` est la scène.
 */
export class ArenaCapacites {

  // ------------------------------------------------------------- capacites

  gererCapacites(this: ArenaScene): void {
    const hero = this.hero;
    if (!hero || hero.etat === "mort") return;

    // Les automatiques ne prennent pas de touche (§4.13) : la n-ieme capacite
    // qu'on lance soi-meme est sur la n-ieme touche. Avant, une automatique
    // apprise tot decalait toutes les suivantes d'un cran.
    let rang = 0;
    for (const capacite of hero.capacites) {
      if (capacite.automatique) continue;
      const action = ACTIONS_CAPACITE[rang++];
      if (!action || !this.clavier.justeAppuyee(action)) continue;
      if (!hero.peutLancer(capacite)) continue;
      this.lancerCapacite(hero, capacite);
    }
  }

  gererCapacitesAuto(this: ArenaScene): void {
    for (const hero of this.heros) {
      if (hero.etat === "mort" || hero.estImmobilise) continue;
      for (const capacite of hero.capacites) {
        if (!capacite.automatique || !hero.peutLancer(capacite)) continue;
        // Une base elementaire ne part pas dans le vide : elle garde sa charge.
        if (!this.elements.aUneCible(hero, capacite.effet)) continue;
        this.lancerCapacite(hero, capacite);
      }
    }
  }

  lancerCapacite(this: ArenaScene, hero: Hero, capacite: Capacite): void {
    // Echo : la capacite peut ne pas partir en rechargement du tout.
    hero.marquerCapacite(capacite, this.rng.next());
    // Les bases elementaires qui partent toutes seules le font sans le dire :
    // une boule toutes les trois secondes ne s'annonce pas a chaque fois.
    if (this.elements.estDiscrete(capacite.effet)) {
      this.elements.lancer(hero, capacite.effet);
      return;
    }
    this.flotter(hero.x, hero.y - 28, capacite.nom.toUpperCase(), "#f0c419");
    // Il se cabre en arriere : plus ample et plus lent qu'un coup, pour qu'on
    // distingue au premier regard une capacite d'une attaque ordinaire.
    declencher(hero.pose, hero, "incantation", this.time.now);

    switch (capacite.effet) {
      case "tourbillon":
        this.effetTourbillon(hero);
        break;
      case "rempart":
        this.effetRempart(hero);
        break;
      case "meteore":
        this.effetMeteore(hero);
        break;
      case "ombre":
        this.effetOmbre(hero);
        break;
      case "sursaut-sacre":
        this.effetSursautSacre(hero);
        break;
      case "benediction":
        this.effetBenediction(hero);
        break;
      case "moulinet":
      case "moulinet-aspirant":
      case "moulinet-sanglant":
        this.effetMoulinet(hero, capacite.effet);
        break;
      case "dome":
        this.effetDome(hero);
        break;
      case "exil":
        this.effetExil(hero);
        break;
      case "invisibilite":
        this.effetInvisibilite(hero);
        break;
      case "hecatombe":
        this.effetHecatombe(hero);
        break;
      case "pluie-de-fleches":
        this.effetPluieDeFleches(hero);
        break;
      case "aube":
        this.effetAube(hero);
        break;
      case "levee-des-morts":
        this.effetLeveeDesMorts(hero);
        break;
      case "martyre":
        this.effetMartyre(hero);
        break;
      case "piege":
        this.effetPiege(hero);
        break;
      case "fleche-du-jugement":
        this.effetFlecheDuJugement(hero);
        break;
      case "priere":
        this.effetPriere(hero);
        break;
      case "chant-de-guerre":
        this.effetChantDeGuerre(hero);
        break;
      case "appel-des-morts":
        this.effetAppelDesMorts(hero);
        break;
      case "orage-final":
        this.effetOrageFinal(hero);
        break;
      case "heure-sombre":
        this.effetHeureSombre(hero);
        break;
      case "jugement":
      case "jugement-croisade":
      case "jugement-absolution":
        this.effetJugement(hero, capacite.effet);
        break;
      case "bouclier-des-ames":
        this.effetBouclierDesAmes(hero);
        break;
      case "charge":
      case "charge-sismique":
      case "charge-sanglante":
        this.effetCharge(hero, capacite.effet);
        break;
      case "cri-de-guerre":
        this.effetCriDeGuerre(hero);
        break;
      case "clignement":
        this.effetClignement(hero);
        break;
      case "sablier":
        this.effetSablier(hero);
        break;
      case "croc-en-jambe":
        this.effetCrocEnJambe(hero);
        break;
      case "doppelganger":
        this.effetDoppelganger(hero);
        break;
      case "contrat":
        this.effetContrat(hero);
        break;
      case "teleportation":
        this.effetTeleportation(hero);
        break;
      case "tourbillon-infernal":
        this.effetTourbillonInfernal(hero);
        break;
      case "forteresse-mobile":
        this.effetForteresseMobile(hero);
        break;
      case "temps-fracture":
        this.effetTempsFracture(hero);
        break;
      case "neant":
        this.effetNeant(hero);
        break;
      case "exil-des-morts":
        this.effetExilDesMorts(hero);
        break;
    }
  }

  // --- Chevalier Sacre : Jugement et Bouclier des ames ---

  /**
   * Une duree d'effet de competence, allongee par Concentration (§4.13).
   *
   * ⚠️ Seulement ce qui **aide** : un sursis, un ralenti, un soin qui dure. Le
   * delai du Contrat ou l'immobilisation de l'Exil sont des prix, pas des
   * effets — Concentration ne les allonge pas.
   */
  dureeDeLEffet(this: ArenaScene, hero: Hero, ms: number): number {
    return ms * hero.bonus.dureeEffets;
  }

  /** Le rayon d'une competence ZONE, elargi par Expansion (§4.13). */
  rayonDeZone(this: ArenaScene, hero: Hero, rayon: number): number {
    return rayon * hero.bonus.tailleZones;
  }
}
