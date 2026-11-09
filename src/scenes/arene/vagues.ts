import { Ennemi } from "../../game/entities";
import { archetypeParId, beteDEau, choisirArchetype, type Archetype } from "../../game/ennemis";
import { NON_PROMUS, PROMU_A_LEUR_PLACE, rendezvousDeLaNuit, type Rang } from "../../core/rangs";
import {
  frontsDeLaVague,
  NOMS_FRONT,
  pointDApparition,
  repartition,
  type Front,
} from "../../core/carte";
import {
  REGLAGES_CYCLE,
  delaiProchaineHorde,
  effectifDeLaNuit,
  intervalleDeLaNuit,
  puissanceDeLaNuit,
  tailleDeLaHorde,
  villageAttire,
} from "../../core/cycle";
import type { ArenaScene } from "../ArenaScene";
import { MAX_ENNEMIS, PART_DE_CHASSEURS, PART_DE_PILLARDS } from "./reglages";

/**
 * Les vagues : l'effectif et la puissance de la nuit, les rendez-vous, les hordes
 * programmées, l'apparition d'un monstre.
 *
 * Une part d'`ArenaScene`, greffée sur son prototype (`greffer`) : `this` est la scène.
 */
export class ArenaVagues {

  /**
   * Les arrivees, jour et nuit confondus.
   *
   * La nuit vide un effectif ; le jour, c'est une horde annoncee qui tombe. Dans
   * les deux cas le plafond d'ecran a le dernier mot : la difficulte monte par
   * la force, pas par le nombre (§4.17).
   */
  fairePartirLesVagues(this: ArenaScene): void {
    if (this.cycle.phase === "nuit") this.deverserLaNuit();
    else this.guetterLesHordes();
  }

  /**
   * Combien de monstres cette nuit-la deverse, le budget compris (§4.29).
   *
   * ⚠️ Le plafond d'ecran du §4.17 a toujours le dernier mot : ce nombre dit
   * combien **veulent** paraitre, pas combien tiennent a l'ecran.
   */
  effectifDeLaNuitIci(this: ArenaScene, nuit: number): number {
    // Une nuit d'orage en envoie la moitie en plus (§4.21). Le plafond d'ecran
    // ne bouge pas : c'est l'assaut qui dure plus longtemps, pas la foule qui
    // grossit. Ce plafond tient jusqu'au jalon 6.2 (§4.33), qui le fera sauter
    // pour tout le monde — mais pas avant.
    const base = this.meteo.effectif(effectifDeLaNuit(nuit));
    return Math.max(1, Math.round(base * (1 + this.menaces.effectifEnPlus)));
  }

  /**
   * La puissance d'une nuit (ou d'un jour), avec l'avance que le monde s'est
   * payee.
   *
   * C'est le « plus forts, plus tot » du §4.29 : un monde genereux joue sa
   * premiere nuit comme une quatrieme — statistiques **et** archetypes, puisque
   * c'est la meme echelle qui ouvre les deux.
   */
  puissanceIci(this: ArenaScene, numero: number): number {
    // Sous l'orage, on se bat contre les monstres de deux nuits plus loin
    // (§4.21) : les memes betes, en pire. C'est le levier que le §4.17 reclame,
    // et il joue aussi sur les hordes de jour, qui lisent la meme fonction.
    return puissanceDeLaNuit(this.meteo.nuitEquivalente(numero) + this.menaces.nuitsDAvance);
  }

  /** Les rendez-vous d'une nuit qui tombe (§4.33) : un boss chaque nuit, un enorme toutes les cinq. */
  poserLesRendezvous(this: ArenaScene, nuit: number): void {
    this.rendezvous = rendezvousDeLaNuit(nuit);
    this.effectifDeDepart = this.resteDeLaNuit;
  }

  deverserLaNuit(this: ArenaScene): void {
    if (this.resteDeLaNuit <= 0) return;
    if (this.time.now < this.prochaineApparition) return;

    const place = MAX_ENNEMIS - this.ennemis.getLength();
    if (place > 0) {
      // Chaque nuit a son boss (§4.33) : quand la part de l'effectif deja
      // partie atteint un rendez-vous, le monstre qui sort prend le rang.
      const partie = this.effectifDeDepart > 0 ? 1 - (this.resteDeLaNuit - 1) / this.effectifDeDepart : 1;
      const prochain = this.rendezvous[0];
      const rang: Rang = prochain && partie >= prochain.part ? this.rendezvous.shift()!.rang : "pietaille";
      // Les bannis de l'Exil des morts sortent melees a la horde, en revenants.
      const revenant =
        rang === "pietaille" &&
        this.revenantsAttendus > 0 &&
        this.rng.next() < this.revenantsAttendus / Math.max(1, this.resteDeLaNuit);
      if (revenant) this.revenantsAttendus -= 1;
      this.faireApparaitreEnnemi(
        this.puissanceIci(this.cycle.nuit),
        rang,
        revenant ? archetypeParId("revenant") : undefined,
      );
      this.resteDeLaNuit -= 1;
    }

    // Meme quand l'ecran est plein, on repousse l'echeance : sinon on
    // reessaierait a chaque image, pour rien.
    this.prochaineApparition = this.time.now + intervalleDeLaNuit(this.cycle.nuit);
  }

  /**
   * Les hordes de jour (DESIGN.md §4.19).
   *
   * Elles empechent la journee de 30 minutes d'etre un temps mort : on travaille
   * en surveillant l'horizon. Le preavis est court — assez pour rappeler un
   * heros ou sonner la cloche, trop peu pour tout reorganiser.
   */
  guetterLesHordes(this: ArenaScene): void {
    const maintenant = this.time.now;

    if (this.hordeAuDepart > 0) {
      if (maintenant < this.hordeAuDepart) return;
      const puissance = this.puissanceIci(this.cycle.jour);
      const place = MAX_ENNEMIS - this.ennemis.getLength();
      for (let i = 0; i < Math.min(this.tailleHordeEnRoute, place); i++) {
        this.faireApparaitreEnnemi(puissance);
      }
      this.hordeAuDepart = 0;
      this.programmerHorde();
      return;
    }

    if (maintenant < this.prochaineHorde) return;

    // Une horde n'ouvre pas de front : elle emprunte ceux qui le sont deja.
    this.fronts = frontsDeLaVague(this.cycle.jour, this.rng.next());
    this.partPremierFront = repartition(this.fronts, this.rng.next());
    this.tailleHordeEnRoute = tailleDeLaHorde(this.cycle.jour + this.menaces.nuitsDAvance);
    this.hordeAuDepart = maintenant + REGLAGES_CYCLE.preavisHorde;

    const ou = this.fronts.map((f) => NOMS_FRONT[f]).join(" et ");
    this.events.emit("annonce", `Une horde arrive ${ou} !`, "guet");
  }

  programmerHorde(this: ArenaScene): void {
    // Au-dela de 65 habitants, le village attire les monstres (§4.18) : l'ecart
    // entre deux hordes tombe a quelques dizaines de secondes. Ca se dit une
    // fois, au passage du seuil — dans un sens comme dans l'autre.
    const attire = villageAttire(this.village.population);
    if (attire !== this.villageAttire) {
      this.villageAttire = attire;
      this.events.emit(
        "annonce",
        attire
          ? "Le village est gros : il attire les monstres, ils ne s'arreteront plus"
          : "Le village s'est fait plus discret : les monstres se calment",
        "guet",
      );
    }
    // Un orage fait le meme effet qu'un village trop gros : les hordes ne
    // s'arretent plus de la journee (§4.21). On reutilise le mecanisme du
    // §4.18 au lieu d'en ecrire un deuxieme — mais **sans l'annonce**, qui
    // parle du village : le ciel, lui, a deja parle au lever.
    const sansRepit = attire || this.meteo.hordesDeJour;
    this.prochaineHorde = this.time.now + delaiProchaineHorde(this.rng.next(), sansRepit);
    this.hordeAuDepart = 0;
  }

  faireApparaitreEnnemi(this: ArenaScene, puissance: number, rang: Rang = "pietaille", impose?: Archetype): void {
    // ⚠️ **La nuit de crue passe devant tout le reste** (§4.21) : ce qui sort de
    // l'eau ne vient pas d'un front, et ce n'est pas un monstre de la table des
    // vagues. Le reste de la nuit — l'effectif, la puissance, le pillage — ne
    // change pas d'un point.
    const parLEau = this.meteo.crue && this.cycle.phase === "nuit" && this.rivesDeLaCrue.length > 0;

    // Les ennemis surgissent au bord d'un front ouvert, jamais autour du
    // joueur : la mer et la montagne ne laissent passer personne (§4.6).
    const front: Front =
      this.fronts.length > 1 && this.rng.next() > this.partPremierFront
        ? this.fronts[1]!
        : this.fronts[0]!;

    // L'archetype module la puissance, il ne la remplace pas : les seuils font
    // que les premieres minutes n'envoient que des fonceurs, puis que la
    // variete s'ouvre a mesure que la vague durcit.
    let archetype =
      impose ?? (parLEau ? beteDEau(this.rng.next()) : choisirArchetype(puissance, this.rng.next()));
    // Un rang ne promeut ni l'essaim ni le kamikaze : ils deviennent une brute (§4.33).
    if (rang !== "pietaille" && NON_PROMUS.has(archetype.id)) {
      archetype = archetypeParId(PROMU_A_LEUR_PLACE) ?? archetype;
    }
    const point = parLEau
      ? this.rng.pick(this.rivesDeLaCrue)
      : pointDApparition(front, this.rng.next());
    const e = new Ennemi(this, point.x, point.y, puissance, archetype);
    // Une part vient piller : la maison debout la plus proche de la ou il
    // surgit, pas de l'eglise — c'est ce qui etale la menace sur le village.
    // Un seul tirage, comme avant : la suite du hasard de la partie ne bouge pas.
    const role = this.rng.next();
    if (role < PART_DE_PILLARDS) e.cibleMaison = this.maisons.laPlusProcheDebout(point.x, point.y);
    else if (role < PART_DE_PILLARDS + PART_DE_CHASSEURS) e.chasseur = true;
    if (rang !== "pietaille") {
      e.promouvoir(rang);
      // On l'attend : le boss de la nuit est un rendez-vous, et le guet le dit.
      this.events.emit("annonce", rang === "enorme" ? "Un enorme sort de la nuit" : "Le boss de la nuit arrive", "guet");
    }
    this.ennemis.add(e);
    this.annoncerNouveaute(archetype.id, archetype.nom);
  }

  /**
   * La premiere apparition d'un archetype se dit.
   *
   * Un monstre qui tire a distance ou qui explose change la facon de jouer :
   * le decouvrir en mourant serait une punition, pas une surprise.
   */
  annoncerNouveaute(this: ArenaScene, id: string, nom: string): void {
    if (this.archetypesVus.has(id)) return;
    this.archetypesVus.add(id);
    // Le fonceur est le fond de la vague : il n'a rien d'une nouvelle.
    if (id === "fonceur") return;
    this.events.emit("annonce", `Nouveau : ${nom}`, "guet");
  }
}
