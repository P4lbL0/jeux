import { bannisQuiReviennent } from "../../core/fusions";
import { EGLISE, frontsDeLaVague, NOMS_FRONT, repartition, rivesAutour } from "../../core/carte";
import { annonceDuMatin } from "../../core/meteo";
import { unNavireVeutVenir } from "../../core/port";
import { type Voix } from "../../core/journal";
import { ArenaScene } from "../ArenaScene";
import { NUIT_PLEINE } from "./reglages";

/**
 * Le jour et la nuit (§4.19), le ciel et la crue (§4.21), et le journal.
 *
 * Une part d'`ArenaScene`, greffée sur son prototype (`greffer`) : `this` est la scène.
 */
export class ArenaJourEtNuit {

  // -------------------------------------------------------- le jour et la nuit

  /**
   * L'horloge du jeu (DESIGN.md §4.19).
   *
   * Elle ne fait que trois choses : avancer, annoncer les bascules, et teinter
   * le ciel. Tout le calcul est dans `core/cycle.ts`, ou il se teste.
   */
  /**
   * Le seul point d'entree de la discussion (DESIGN.md §4.10).
   *
   * La voix par defaut est **le village** : c'est la source la plus frequente,
   * et une annonce sans voix explicite parle forcement de ce qui se passe ici.
   * Le jour, lui, n'est jamais passe par l'appelant — il est lu du cycle, sinon
   * cent-vingt emetteurs auraient a le connaitre pour rien.
   */
  consignerAuJournal(this: ArenaScene, message: string, voix: Voix = "village", qui = ""): void {
    this.journal.ajouter(message, voix, this.cycle.jour, qui);
  }

  majCycle(this: ArenaScene, delta: number): void {
    // ⚠️ **Le temps ne commence qu'a l'installation** (§4.29) : pendant la
    // marche le cycle est a l'arret, et tout ce qui pend a lui avec — la nuit,
    // la porte, l'appel d'un survivant. On garde le ciel, pour qu'il ait la
    // couleur du jour, et rien d'autre.
    const bascule = this.cycle.avancer(this.enMarche ? 0 : delta);

    if (bascule === "crepuscule") this.tomberLaNuit();
    else if (bascule === "aube") this.leverLeJour();
    // La nuit tombe : deuxieme des trois moments ou l'on regarde si
    // quelqu'un prend une initiative (§4.27). Le Pyromane n'agit que la.
    if (bascule === "crepuscule") this.chercherDesInitiatives();

    if (!this.enMarche) {
      this.regarderLaPorte();
      this.regarderLHorizon();
    }
    this.teinterLeCiel();
    // Le ciel se voit meme pendant la marche : il appartient au monde, pas au
    // role de Protecteur (§4.21, §4.29). C'est la seule chose qui tourne quand
    // le cycle est a l'arret.
    this.pluie.majorer(
      delta,
      this.time.now,
      this.meteo,
      this.cycle.phase,
      this.cycle.part,
      this.rng,
    );
    // L'eclair qui vient de tomber met-il le feu ? (§4.21) Un sur vingt, et
    // seulement la ou il y a quelque chose a bruler.
    if (!this.enMarche) this.regarderLaFoudre();
    this.majCrue();
  }

  /**
   * L'opacite du voile, calculee une fois par image.
   *
   * Le fondu prend les dernieres minutes du jour et les premieres de la nuit :
   * on voit le soleil descendre bien avant qu'il ne soit couche. Le §4.6 exige
   * qu'un assaut soit annonce — c'est cette annonce-la, et elle ne peut pas
   * etre manquee.
   */
  teinterLeCiel(this: ArenaScene): void {
    const { phase, part } = this.cycle;
    const FONDU = 0.12;

    let opacite: number;
    if (phase === "jour") {
      opacite = part > 1 - FONDU ? ((part - (1 - FONDU)) / FONDU) * NUIT_PLEINE : 0;
    } else {
      opacite = part > 1 - FONDU ? (1 - (part - (1 - FONDU)) / FONDU) * NUIT_PLEINE : NUIT_PLEINE;
    }
    this.voile.setAlpha(opacite);
  }

  /**
   * Ce que le ciel dit au lever (§4.21).
   *
   * ⚠️ **La voix n'est pas la meme selon le temps**, et ce n'est pas un detail :
   * la voix du guet est ecrite en sang, et le §4.11 reserve le rouge au danger.
   * Une averse n'est pas un danger — c'est le village qui l'annonce. L'orage,
   * lui, l'est : il envoie plus de monstres, plus forts, des le jour.
   */
  annoncerLeCiel(this: ArenaScene): void {
    const ciel = annonceDuMatin(this.meteo);
    if (!ciel) return;
    this.events.emit("annonce", ciel, this.meteo.orage ? "guet" : "village");
  }

  /**
   * L'eau monte, ou elle se retire (§4.21).
   *
   * Appelee **a l'aube seulement** : la crue est un etat de journee, comme le
   * temps qu'il fait. Elle fait trois choses, et les trois ont ete decidees le
   * 22 septembre 2026.
   */
  reglerLaCrue(this: ArenaScene): void {
    const crue = this.meteo.crue;
    if (crue === this.crueEnCours) return;
    this.crueEnCours = crue;

    // 1. Les douves debordent : l'eau ne barre plus rien tant que ca dure. Le
    // champ de directions se refait, comme a la pose d'un mur — deux fois par
    // crue, pas une fois par image.
    this.grille.crue = crue;
    this.recalculerLeParcours();

    if (!crue) {
      this.events.emit("annonce", "L'eau se retire — les douves barrent de nouveau", "village");
      return;
    }

    // 2. Les champs se noient : ce que la pluie a donne, elle le reprend.
    const perdus = this.champs.noyer();

    // 3. Les batiments deja abimes commencent a ceder : c'est `majCrue` qui
    // s'en charge, tout au long de la journee et de sa nuit.
    this.prochainRongement = this.time.now + ArenaScene.CRUE.cadence;

    this.events.emit(
      "annonce",
      perdus > 0
        ? `La crue — ${perdus} champ${perdus > 1 ? "s" : ""} noye${perdus > 1 ? "s" : ""}, et les douves debordent`
        : "La crue — l'eau passe par-dessus les douves",
      "guet",
    );
  }

  /**
   * Ce que l'eau ronge pendant que la crue dure (§4.21).
   *
   * Un horodatage compare a l'horloge, jamais une minuterie : la regle 4 du
   * §4.17 vaut pour le ciel comme pour le reste.
   */
  majCrue(this: ArenaScene): void {
    if (!this.crueEnCours || this.enMarche || this.enPause) return;
    if (this.time.now < this.prochainRongement) return;
    this.prochainRongement = this.time.now + ArenaScene.CRUE.cadence;

    const tombees = this.maisons.ronger(
      ArenaScene.CRUE.seuil,
      ArenaScene.CRUE.part,
      this.time.now,
    );
    if (tombees.length === 0) return;

    // Une maison qui tombe, c'est des gens a reloger : ca se dit (§4.18).
    this.events.emit(
      "annonce",
      tombees.length > 1
        ? `L'eau emporte ${tombees.length} maisons deja fendues`
        : "L'eau emporte une maison deja fendue",
      "guet",
    );
  }

  tomberLaNuit(this: ArenaScene): void {
    // Celui qui attend encore n'a pas attendu la nuit (§4.18). Celui qui suit
    // deja reste : l'abandonner au milieu du trajet serait arbitraire.
    this.survivants.auCrepuscule();

    const nuit = this.cycle.nuit;
    this.resteDeLaNuit = this.effectifDeLaNuitIci(nuit);
    // Exil des morts (§4.25) : les bannis de la veille reviennent, en plus.
    this.revenantsAttendus = bannisQuiReviennent(this.bannis, this.resteDeLaNuit);
    this.bannis = 0;
    if (this.revenantsAttendus > 0) {
      this.resteDeLaNuit += this.revenantsAttendus;
      this.events.emit("annonce", `Les bannis reviennent : ${this.revenantsAttendus} revenants de plus cette nuit`, "guet");
    }
    this.poserLesRendezvous(nuit);
    this.village.tomberLaNuit();

    this.fronts = frontsDeLaVague(nuit, this.rng.next());
    this.partPremierFront = repartition(this.fronts, this.rng.next());
    this.prochaineApparition = this.time.now;

    // Le ciel lache-t-il quelque chose cette nuit ? (§4.21) Une sur vingt, et
    // **on le voit venir douze secondes** : c'est la regle du §4.17.
    this.guetterLeCiel();

    // ⚠️ **La nuit de crue, ce qui attaque sort de l'eau** (§4.21) : la mer, le
    // lac ou la douve la plus proche, et pas les fronts habituels. Les murs
    // sont du mauvais cote. Les berges se cherchent **ici, une seule fois** —
    // c'est un tri par distance, et le §4.17 interdit d'en faire un par image.
    this.rivesDeLaCrue = this.meteo.crue
      ? rivesAutour({ x: EGLISE.x, y: EGLISE.y }, ArenaScene.RIVES_DE_LA_CRUE.rayon, ArenaScene.RIVES_DE_LA_CRUE.combien)
      : [];
    if (this.meteo.crue) {
      this.events.emit(
        "annonce",
        this.rivesDeLaCrue.length > 0
          ? "Quelque chose remonte de l'eau — les murs ne servent a rien cette nuit"
          : "L'eau est haute, mais elle est loin : la nuit sera ordinaire",
        "guet",
      );
    }

    // ⚠️ **Le navire repart avant la nuit, pas au matin.** Vu en jouant : arrive
    // dans une journee calme, il restait a quai pendant tout l'assaut, et l'on
    // pouvait commercer tranquillement pendant que le village se faisait
    // manger. Un navire qui n'accoste que quand c'est calme n'a aucune raison
    // de rester quand ca ne l'est plus (§4.18).
    if (this.port.navireAQuai) this.port.appareiller(this);

    // ⚠️ **La nuit de crue n'annonce pas de front**, et c'est un defaut vu sur
    // capture : le journal disait « ils arrivent a l'est » pendant que les
    // betes remontaient du lac a l'ouest. Une annonce qui ment sur la direction
    // est pire que pas d'annonce — le §4.6 veut qu'un assaut se voie venir.
    if (this.rivesDeLaCrue.length > 0) {
      this.events.emit("annonce", `Nuit ${nuit} — ils remontent de l'eau`, "guet");
    } else {
      const ou = this.fronts.map((f) => NOMS_FRONT[f]).join(" et ");
      this.events.emit("annonce", `Nuit ${nuit} — ils arrivent ${ou}`, "guet");
    }
    // Un moment qui compte, et le dernier calme avant longtemps (§4.28).
    this.enregistrer();
  }

  leverLeJour(this: ArenaScene): void {
    // Ce qui restait de l'effectif ne poursuit pas la journee : la nuit est
    // finie, ceux qui sont encore debout finissent la leur.
    this.resteDeLaNuit = 0;
    this.rendezvous = [];
    // Les portes se rouvrent : on ressort travailler (§4.20).
    this.clocheSonnee = false;
    if (this.constructions.portesFermees) this.constructions.ouvrirLesPortes(this.time.now);
    this.village.seLever(this.cycle.jour);
    // Le deuxieme heros vient vers la nuit 2 ou 3 (9 novembre 2026) : la partie cesse d'etre solo.
    this.reveillerLeDeuxiemeHeros();
    // L'eglise se repare a l'aube (9 novembre 2026) : d'un quart, debout seulement.
    this.eglise.regles.reparerALAube();
    // Les chemins palissent d'un cran, et ceux qu'on a oublies quatre journees s'effacent.
    this.chemins.seLever(this.cycle.jour);
    this.coucheChemins.toutRedessiner(this.chemins.visibles, this.cycle.jour);
    this.passerLaJourneeDesHeros();
    this.consumerLesBerserkers();
    this.passerLaJourneeDeLaCour();
    this.passerLaJourneeDeLaMemoire();
    this.programmerHorde();
    this.events.emit("annonce", `Jour ${this.cycle.jour} — le soleil se leve`, "village");
    // ⚠️ **Au matin**, pas dans la nuit. Le §4.18 veut qu'on **decouvre** le mort
    // ou la breche, sans jamais voir qui l'a fait — un coupable nomme serait un
    // probleme resolu. La nuit qui s'acheve est celle de la journee precedente.
    this.reglerLaNuitDesFous(this.cycle.jour - 1);

    // Le marche bouge d'une journee a l'autre, et une voile decide **une fois
    // par jour** si elle veut venir. Le calme, lui, ne decide que du moment :
    // sans ce tirage unique, un village calme verrait un navire par seconde.
    // Le ciel de la journee : il decide avant tout le reste, parce que la
    // pousse, l'effectif de la nuit et les hordes de jour le lisent (§4.21).
    this.meteo.passerLaJournee(this.rng);
    this.annoncerLeCiel();
    this.reglerLaCrue();

    this.port.regles.passerLaJournee(this.rng);
    this.navireAttendu = this.port.debout && unNavireVeutVenir(this.rng);
    // Plus personne ne venait : on redemande une fois par jour, la reputation a
    // pu remonter. Une seule fois, jamais par image — c'est un tirage, et le
    // rejouer chaque image consommerait la graine (§4.6).
    if (this.prochaineArriveeJournee === null) this.planifierLaProchaineArrivee();
    this.enregistrer();
  }
}
