import {
  competenceParId,
  propositionCompetence,
  propositionEvolution,
  tirerCompetences,
  type CompetenceDef,
  ID_EMPLACEMENT,
  demandeUnePlace,
  prixDuProchainEmplacement,
  propositionsDeRemplacement,
} from "../../core/competences";
import {
  fusionsPossibles,
  fusionsQuiLiberent,
  ingredientsDe,
  propositionFusion,
} from "../../core/fusions";
import { Familier, Hero, Invocation, marquerLeGeneral } from "../../game/entities";
import { traitParId } from "../../core/traits";
import type { ArenaScene } from "../ArenaScene";

/**
 * La progression : monter de niveau, l'écran de choix, les fusions apprises.
 *
 * Une part d'`ArenaScene`, greffée sur son prototype (`greffer`) : `this` est la scène.
 */
export class ArenaProgression {

  // ---------------------------------------------------------- progression

  monterDeNiveau(this: ArenaScene, hero: Hero): void {
    this.flotter(hero.x, hero.y - 24, `NIVEAU ${hero.niveau}`, "#5ec8f0");
    this.effetCercle(hero.x, hero.y, 70, 0x5ec8f0);
    // Seul le heros incarne interrompt la partie. Ceux joues par l'IA
    // accumulent leurs choix, sinon la vague serait hachee en permanence.
    if (hero.estIncarne && hero.choixEnAttente > 0 && !this.enPause) this.ouvrirChoix();
  }

  ouvrirChoix(this: ArenaScene): void {
    this.enPause = true;
    this.debutPause = this.time.now;
    this.physics.pause();
    this.anims.pauseAll();
    this.effacerDestination();
    this.modeChoix = "competence";

    const hero = this.hero;
    const defs = tirerCompetences(
      this.rng,
      hero.classe.id,
      hero.competences,
      3,
      // Passera au rang du heros quand les rangs existeront (DESIGN.md §4.1).
      0,
      // Ses traits pesent sur ce qu'on lui propose (§4.25) : un Pyromane voit
      // le FEU trois fois plus souvent.
      hero.personne.traits.flatMap((id) => {
        const trait = traitParId(id);
        return trait ? [trait.cle] : [];
      }),
    );
    const propositions = defs.map((d) => propositionCompetence(d, hero.competences));

    // ⚠️ **L'heritage se propose, il ne se donne pas** (§4.26, decision du
    // 21 septembre 2026). Il arrive comme une quatrieme ligne, marquee du nom
    // du mort : c'est un arbitrage du joueur, et ca reutilise l'ecran qui
    // existe au lieu d'en inventer un.
    const legs = this.memoire.legsDe(hero.personne.identite);
    if (legs) {
      const def = competenceParId(legs.competence);
      if (def && !propositions.some((p) => p.id === def.id)) {
        const proposition = propositionCompetence(def, hero.competences);
        propositions.push({
          ...proposition,
          etiquette: `HERITAGE DE ${legs.de.toUpperCase()}`,
          // Le laiton de la palette (§4.10) : ce qu'on clique, ce qui compte.
          couleur: 0xc99a3a,
        });
      }
    }

    // ⚠️ **La fusion se propose, elle ne se donne pas** (§4.25, tranche le
    // 23 septembre 2026) : une carte de plus, a cote des trois tirees, comme
    // l'heritage. Refusee, elle revient au choix d'apres, puisque ses
    // ingredients sont toujours la.
    for (const fusion of fusionsPossibles(hero.competences, hero.evolutions, hero.fondues)) {
      propositions.push(propositionFusion(fusion));
    }

    this.events.emit(
      "choix",
      `NIVEAU ${hero.niveau}`,
      `${hero.personne.nom} — choisis une competence`,
      propositions,
    );
  }

  resoudreChoix(this: ArenaScene, id: string): void {
    const hero = this.hero;

    if (this.modeChoix === "evolution") {
      const evolution = this.optionsEvolution.find((o) => o.id === id);
      if (evolution && this.competenceEnEvolution) {
        hero.appliquerEvolution(this.competenceEnEvolution.id, evolution);
        this.flotter(hero.x, hero.y - 30, evolution.nom.toUpperCase(), "#f0c419");
      }
      this.competenceEnEvolution = null;
      this.optionsEvolution = [];
      this.terminerChoix();
      return;
    }

    if (this.modeChoix === "remplacement") {
      const nouvelle = this.competenceEnAttente;
      this.competenceEnAttente = null;
      this.modeChoix = "competence";
      if (!nouvelle) {
        this.terminerChoix();
        return;
      }
      const fusion = competenceParId(id);
      if (id === ID_EMPLACEMENT) {
        this.argent -= prixDuProchainEmplacement(hero.emplacements) ?? 0;
        hero.emplacements += 1;
        this.flotter(hero.x, hero.y - 30, `EMPLACEMENT ${hero.emplacementsTotal}`, "#f0c419");
      } else if (fusion?.fusion && hero.palierDe(fusion.id) === 0) {
        // Fusionner libere une touche (§4.25) : la competence qui attendait
        // la prend. Le choix du niveau, c'etait elle — pas la fusion.
        this.fusionner(hero, fusion, false);
      } else {
        const oubliee = competenceParId(id);
        hero.oublier(id);
        if (oubliee) {
          this.events.emit("annonce", `j'oublie ${oubliee.nom} pour ${nouvelle.nom}`, "heros", hero.personne.nom);
        }
      }
      this.apprendreEtContinuer(hero, nouvelle);
      return;
    }

    const def = competenceParId(id);
    if (!def) {
      this.terminerChoix();
      return;
    }

    // Quatre actives au plus (§4.13) : une cinquieme demande une place. On
    // achete un emplacement, ou on en oublie une ; la fusion (§4.25) viendra
    // avec les builds.
    if (demandeUnePlace(def, hero.competences, hero.emplacementsTotal, hero.fondues)) {
      this.modeChoix = "remplacement";
      this.competenceEnAttente = def;
      // Les fusions qui liberent une touche repondent aussi (§4.25) — sauf
      // celle qui attend sa place, s'il s'agit d'une fusion.
      const fusions = fusionsQuiLiberent(fusionsPossibles(hero.competences, hero.evolutions, hero.fondues))
        .filter((f) => f.id !== def.id)
        .map(propositionFusion);
      this.events.emit(
        "choix",
        "PLUS DE PLACE",
        `${def.nom} demande un emplacement — laquelle oublier ?`,
        propositionsDeRemplacement(
          hero.competences,
          hero.emplacements,
          this.argent,
          hero.emplacementsEnPlus,
          hero.fondues,
          fusions,
        ),
      );
      return;
    }

    this.apprendreEtContinuer(hero, def);
  }

  /**
   * Fusionne (§4.25) : les ingredients disparaissent des touches, la fusion
   * arrive au palier 1. Ca se voit, ca s'entend, et le journal le retient.
   */
  fusionner(this: ArenaScene, hero: Hero, fusion: CompetenceDef, consommeUnChoix: boolean): void {
    // Le journal parle comme lui, et comme quand il oublie : a la premiere personne.
    const noms = ingredientsDe(fusion).map((id) => competenceParId(id)?.nom ?? id);
    hero.fusionner(fusion, consommeUnChoix);
    // Le familier deja debout prend la tete tout de suite : il n'attend pas de retomber.
    if (fusion.id === "general-des-morts") {
      for (const objet of this.invocations.getChildren() as Invocation[]) {
        if (objet.active && objet instanceof Familier && objet.maitre === hero) marquerLeGeneral(objet);
      }
    }
    this.effetCercle(hero.x, hero.y, 90, 0xc99a3a);
    this.effetCercle(hero.x, hero.y, 50, 0xe0402a);
    if (hero.estIncarne) this.cameras.main.flash(220, 201, 154, 58);
    this.flotter(hero.x, hero.y - 34, fusion.nom.toUpperCase(), "#e2bb62");
    this.events.emit("annonce", `je fonds ${noms.join(" et ")} en ${fusion.nom}`, "heros", hero.personne.nom);
  }

  /** Apprend la competence, offre le niveau du Veteran, et ouvre l'evolution s'il y en a une. */
  apprendreEtContinuer(this: ArenaScene, hero: Hero, def: CompetenceDef): void {
    // Une fusion qu'on prend pour la premiere fois ne s'apprend pas : elle fond
    // ses ingredients (§4.25). Ensuite, elle monte comme les autres.
    if (def.fusion && hero.palierDe(def.id) === 0) {
      this.fusionner(hero, def, true);
      this.terminerChoix();
      return;
    }

    // C'etait l'heritage : il le prend, donc il porte le trait et le souvenir
    // du mort (§4.26). Le legs est consomme — on n'herite qu'une fois.
    const legs = this.memoire.legsDe(hero.personne.identite);
    if (legs?.competence === def.id) {
      this.memoire.prendreLeLegs(hero.personne, this.cycle.jour);
      this.events.emit(
        "annonce",
        `${hero.personne.nom} reprend ${def.nom} de ${legs.de}`,
        "heros",
        hero.personne.nom,
      );
    }

    const evolutions = hero.apprendre(def);
    // Veteran : un niveau offert immediatement.
    if (def.id === "veteran") {
      hero.gagnerNiveauImmediat();
      this.flotter(hero.x, hero.y - 30, `NIVEAU ${hero.niveau}`, "#5ec8f0");
    }
    if (evolutions) {
      // La competence change de nature : un second choix s'ouvre, toujours en
      // pause (DESIGN.md §4.13).
      this.modeChoix = "evolution";
      this.competenceEnEvolution = def;
      this.optionsEvolution = evolutions;
      this.events.emit(
        "choix",
        "EVOLUTION",
        `${def.nom} peut changer de nature`,
        evolutions.map((e) => propositionEvolution(def, e)),
      );
      return;
    }

    this.terminerChoix();
  }

  terminerChoix(this: ArenaScene): void {
    this.reprendreLeJeu();
    if (this.hero.choixEnAttente > 0) this.ouvrirChoix();
  }
}
