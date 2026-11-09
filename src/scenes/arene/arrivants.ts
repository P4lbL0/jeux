import { Ennemi } from "../../game/entities";
import { choisirArchetype } from "../../game/ennemis";
import { type SpriteSurvivant } from "../../game/survivants";
import { REGLAGES_CACHES } from "../../core/caches";
import {
  creerSurvivant,
  ETAT_ANNONCE,
  ligneDApparition,
  prochainSurvivant,
  REGLAGES_SURVIVANTS,
} from "../../core/survivants";
import { poufMort } from "../../game/effets";
import { NOMS_METIER, RESSOURCES } from "../../core/habitants";
import { contracterEtat, prenomLibre } from "../../core/personne";
import {
  accueillir as suivreSiFou,
  actesDeLaNuit,
  creerArrivant,
  delaiEntreArrivees,
  prochaineArrivee,
  REGLAGES_ARRIVEES,
  replanifier,
  reputation,
  victimeDe,
  type Acte,
  type Fou,
} from "../../core/arrivants";
import type { ArenaScene } from "../ArenaScene";
import { MAX_ENNEMIS } from "./reglages";

/**
 * La porte et les survivants (§4.18) : regarder l'horizon, les arrivants, la meute, les
 * fous et leurs actes.
 *
 * Une part d'`ArenaScene`, greffée sur son prototype (`greffer`) : `this` est la scène.
 */
export class ArenaArrivants {

  // ------------------------------------------------------------- la porte

  /**
   * Quelqu'un se presente-t-il ce matin ? (DESIGN.md §4.18)
   *
   * Le rythme ne vient pas du hasard mais de **ce que vaut le village** : la
   * reputation, c'est la satisfaction moins ce que les morts recents coutent a
   * la rumeur. Un village qui souffre se vide et n'attire plus rien.
   */
  regarderLaPorte(this: ArenaScene): void {
    if (this.prochaineArriveeJournee === null) return;
    if (this.termine || this.enPause || this.saisieEnCours) return;
    if (this.cycle.jour < this.prochaineArriveeJournee) return;

    // On ne frappe pas a la porte en pleine nuit, et pas non plus a la seconde
    // ou le soleil se leve : l'aube fait deja le repas, les etats, les exploits
    // et la sauvegarde. Il se presente **dans la matinee**, une minute plus
    // tard — assez pour qu'on voie son village avant qu'on vienne lui demander
    // de le partager.
    if (this.cycle.phase !== "jour" || this.cycle.part < 0.04) return;

    // Les noms deja portes partent avec : deux homonymes dans un village de six
    // rendent chaque annonce ambigue (vu en jouant, §4.18).
    this.arrivantALaPorte = creerArrivant(this.rng, this.cycle.jour, this.nomsPris());
    this.enPause = true;
    this.debutPause = this.time.now;
    this.physics.pause();
    this.anims.pauseAll();
    this.effacerDestination();
    this.events.emit("arrivant", this.arrivantALaPorte);
  }

  // --------------------------------------------------- les survivants (§4.18)

  /**
   * Quelqu'un appelle-t-il, quelque part au bord ? (DESIGN.md §4.18)
   *
   * **C'est la seule raison de sortir du village.** Jusqu'ici le jour ne servait
   * qu'a produire et a reparer, et tout se jouait autour de l'eglise.
   */
  regarderLHorizon(this: ArenaScene): void {
    if (this.termine || this.enPause || this.saisieEnCours) return;
    if (this.survivants.present !== null) return;
    if (this.cycle.jour < this.prochainSurvivantJournee) return;
    // Il parait **le jour**, et il attend jusqu'au crepuscule. Pas dans la
    // premiere minute : l'aube fait deja le repas, les etats et la sauvegarde.
    if (this.cycle.phase !== "jour" || this.cycle.part < 0.06) return;

    const survivant = creerSurvivant(this.rng, this.cycle.jour, this.nomsPris());
    this.survivants.faireParaitre(survivant, ligneDApparition(survivant));
    this.planifierLeProchainSurvivant();
  }

  /**
   * Quand le prochain appellera.
   *
   * Meme reputation que la porte, **avec le plancher** du §4.18 : sous 25 la
   * porte se ferme pour de bon et les naissances n'existent pas avant le bloc 7.
   * Sans ce plancher, un village qui saigne n'aurait plus **aucune** voie de
   * peuplement — un cul-de-sac dont rien ne le sort.
   */
  planifierLeProchainSurvivant(this: ArenaScene): void {
    const rumeur = reputation(
      this.village.satisfaction,
      this.village.memoireDesMorts,
      this.cycle.jour,
      this.village.memoireDesMortsEnChemin,
      REGLAGES_SURVIVANTS.partDeRumeurDUneMortEnChemin,
    );
    this.prochainSurvivantJournee = prochainSurvivant(
      delaiEntreArrivees(rumeur),
      this.cycle.jour,
      this.rng,
    );
  }

  /**
   * La meute, lachee autour de lui **au moment ou on le voit** (§4.18).
   *
   * ⚠️ **Le plafond de l'ecran passe avant le tirage** (§4.17 regle 1) : si
   * l'ecran est deja charge, la meute est plus petite — jamais l'inverse. Avec
   * le plafond a 60, une meute de 40 en mangeait les deux tiers ; a 800
   * (§4.33), elle ne bute plus dessus qu'au plus fort d'une nuit.
   */
  lacherLaMeute(this: ArenaScene, x: number, y: number, combien: number, camp = false): void {
    const puissance = this.puissanceIci(this.cycle.jour);
    const place = MAX_ENNEMIS - this.ennemis.getLength();
    for (let i = 0; i < Math.min(combien, place); i++) {
      const archetype = choisirArchetype(puissance, this.rng.next());
      // En couronne autour de lui : ils le tenaient deja, ils ne surgissent pas
      // du bord de la carte comme une horde.
      const angle = this.rng.range(0, Math.PI * 2);
      const rayon = this.rng.range(40, 120);
      const e = new Ennemi(
        this,
        x + Math.cos(angle) * rayon,
        y + Math.sin(angle) * rayon,
        puissance,
        archetype,
      );
      // Une bete de camp ne s'eloigne pas de ce qu'elle garde (§4.31).
      if (camp) {
        e.campeSur = { x, y };
        e.rayonDuCamp = REGLAGES_CACHES.rayonDuCamp;
      }
      this.ennemis.add(e);
    }
  }

  /**
   * Il est arrive a l'eglise : **la porte se rejoue** (§4.10, §4.18).
   *
   * Meme fiche, meme mode, meme code qu'a la porte — il peut etre fou dans la
   * meme proportion. La seule difference tient en un champ : **son etat est
   * ecrit noir sur blanc**. La folie se devine, la maladie se lit.
   */
  presenterLeSurvivant(this: ArenaScene, sprite: SpriteSurvivant): void {
    this.survivantALEglise = sprite;
    this.enPause = true;
    this.debutPause = this.time.now;
    this.physics.pause();
    this.anims.pauseAll();
    this.effacerDestination();

    const etat = sprite.regles.etat;
    this.events.emit(
      "arrivant",
      sprite.regles.arrivant,
      etat === null ? undefined : ETAT_ANNONCE[etat],
      // ⚠️ **Sur la route, ce n'est pas un retour au village** : il n'y en a
      // pas, et c'est la question qu'on se pose tous les deux. La fiche change
      // donc de mots (§4.31) — « l'emmener avec toi », pas « le faire entrer ».
      this.enMarche ? "route" : "sauvetage",
    );
  }

  /**
   * Personne ne porte le prenom d'un autre, au premier matin.
   *
   * ⚠️ **Vu en jouant** : deux heros s'appelaient Aubin et Nine, comme deux des
   * trois villageois de depart. L'equipe se compose **avant** le village — elle
   * ne pouvait donc pas savoir. Plutot que de reordonner tout le demarrage (la
   * camera, le commandement et quatre recouvrements dependent de l'equipe), on
   * renomme **le villageois** : au moment ou ceci tourne, personne n'a encore vu
   * son nom.
   *
   * Sur une partie reprise, la sauvegarde repose les vrais noms par-dessus.
   */
  demelerLesPrenoms(this: ArenaScene): void {
    const pris = this.heros.map((h) => h.personne.nom);
    for (const villageois of this.village.habitants) {
      if (!pris.includes(villageois.nom)) {
        pris.push(villageois.nom);
        continue;
      }
      villageois.personne.nom = prenomLibre(this.rng, pris);
      pris.push(villageois.personne.nom);
    }
  }

  /**
   * Tous les prenoms deja portes ici — **habitants et heros**.
   *
   * ⚠️ **Vu en jouant** : un survivant ramene s'appelait Anselme, comme un des
   * heros. On ne regardait que le village. Depuis que la barre de heros affiche
   * le nom (§4.10), deux Anselme rendent chaque annonce ambigue — et le §4.18
   * promet qu'on s'attache a ses gens, ce qui suppose de savoir de qui on parle.
   */
  nomsPris(this: ArenaScene): string[] {
    return [
      ...this.village.habitants.map((v) => v.nom),
      ...this.heros.map((h) => h.personne.nom),
    ];
  }

  planifierLaProchaineArrivee(this: ArenaScene): void {
    this.prochaineArriveeJournee = prochaineArrivee(
      reputation(this.village.satisfaction, this.village.memoireDesMorts, this.cycle.jour),
      this.cycle.jour,
      this.rng,
    );
  }

  /**
   * Le joueur a tranche.
   *
   * **Refuser ne coute rien d'autre que le bras qu'on n'aura pas** (§4.18) : pas
   * de malus de reputation. La prudence se paie deja d'elle-meme — une
   * production en moins, et une population qui n'atteint pas les six habitants
   * du niveau 2 de l'eglise.
   */
  repondreALaPorte(this: ArenaScene, accepte: boolean): void {
    // La meme fiche sert aux deux (§4.10), donc la meme reponse aussi : c'est
    // ici qu'on sait duquel des deux il s'agit.
    if (this.survivantALEglise !== null) {
      this.repondreAuSurvivant(accepte);
      return;
    }

    const arrivant = this.arrivantALaPorte;
    this.arrivantALaPorte = null;

    if (arrivant !== null) {
      if (accepte) {
        const villageois = this.village.accueillir(arrivant.personne, arrivant.metierPretendu);
        this.memoire.accueil(villageois.personne, this.cycle.jour);
        const fou = suivreSiFou(arrivant, villageois.regles.id, this.cycle.jour, this.rng);
        if (fou !== null) this.fous.push(fou);
        this.events.emit(
          "annonce",
          `${arrivant.personne.nom} entre au village — ${NOMS_METIER[arrivant.metierPretendu].toLowerCase()}`,
          "village",
        );
      } else {
        this.events.emit("annonce", `${arrivant.personne.nom} repart sur la route`, "village");
      }
    }

    this.planifierLaProchaineArrivee();
    this.reprendreLeJeu();
  }

  /**
   * On a risque sa peau pour lui, et on peut encore lui dire non (§4.18).
   *
   * ⚠️ **C'est dur, et c'est volontaire.** Sans la fiche, le survivant serait
   * une ressource gratuite qu'on ramasse et les fous n'auraient qu'une seule
   * porte d'entree. Avec elle, sortir devient un investissement qu'on peut
   * decider de ne pas honorer — et le joueur qui accepte tout ce qu'il a sauve,
   * par attachement, se fera avoir exactement comme celui qui ouvre sa porte a
   * tout le monde.
   *
   * **Refuser ne coute rien** : meme regle qu'a la porte, la prudence ne se
   * punit pas deux fois. Il repart, et la rumeur ne bouge pas.
   */
  repondreAuSurvivant(this: ArenaScene, accepte: boolean): void {
    const sprite = this.survivantALEglise;
    this.survivantALEglise = null;

    // ⚠️ **Sur la route, dire oui ne le fait pas entrer : il se leve et suit**
    // (§4.31). Il n'y a pas de village a lui ouvrir — c'est justement ce qu'on
    // cherche tous les deux. Il entrera le jour ou l'on s'installera, et sans
    // qu'on rejoue sa fiche : c'est ici qu'on l'a jugee.
    if (this.enMarche) {
      if (sprite !== null) {
        if (accepte) {
          sprite.etat = "suit";
          this.events.emit("annonce", `${sprite.nom} se leve et te suit`, "toi");
        } else {
          this.events.emit("annonce", `Tu le laisses ou il est`, "toi");
          this.survivants.retirer(sprite);
        }
      }
      this.reprendreLeJeu();
      return;
    }

    if (sprite !== null) {
      const { arrivant, etat } = sprite.regles;
      if (accepte) {
        const villageois = this.village.accueillir(arrivant.personne, arrivant.metierPretendu);
        // Ce qu'il porte entre avec lui. L'infection est **contagieuse entre
        // voisins de travail** (§4.23) : c'est le premier usage reel de la
        // contagion, ecrite au bloc 5 et que rien ne declenchait.
        if (etat !== null) contracterEtat(villageois.personne, etat);
        // ⚠️ **Celui qu'on ramene doit quelque chose a celui qui est venu**
        // (§4.26) : c'est la seule dette que le jeu produise aujourd'hui, et
        // c'est elle qui fera obeir un paranoiaque (§4.23).
        if (this.hero) this.memoire.sauvetage(villageois.personne, this.hero.personne, this.cycle.jour);
        const fou = suivreSiFou(arrivant, villageois.regles.id, this.cycle.jour, this.rng);
        if (fou !== null) this.fous.push(fou);
        this.events.emit(
          "annonce",
          `${arrivant.personne.nom} est rentre avec toi — ${NOMS_METIER[arrivant.metierPretendu].toLowerCase()}`,
          "village",
        );
      } else {
        this.events.emit("annonce", `${arrivant.personne.nom} repart sur la route`, "village");
      }
    }

    this.survivants.retirer(sprite ?? undefined);
    this.reprendreLeJeu();
  }

  /**
   * Ce que la nuit a produit (DESIGN.md §4.18).
   *
   * Tout le tri est dans `core/arrivants.ts`, y compris la regle du groupe :
   * ici on ne fait qu'appliquer. C'est ce qui permet de tester « a trois, ils
   * frappent la meme nuit » sans lancer une partie de trois heures.
   */
  reglerLaNuitDesFous(this: ArenaScene, journee: number): void {
    if (journee < 1) return;

    const actes = actesDeLaNuit(this.fous, journee, this.rng);
    if (actes.length === 0) return;

    if (actes.length >= REGLAGES_ARRIVEES.taillePourUnGroupe) {
      this.events.emit("annonce", "Cette nuit, plusieurs mains ont travaille ensemble", "village");
    }

    for (const { fou, acte } of actes) {
      this.executerLActe(fou, acte);
      // Le voleur part avec les stocks ; les autres restent, et personne ne
      // saura jamais que c'etaient eux.
      if (!replanifier(fou, journee, this.rng)) this.oublierLeFou(fou);
    }
  }

  executerLActe(this: ArenaScene, fou: Fou, acte: Acte): void {
    if (acte === "vol") return this.acteDeVol(fou);
    if (acte === "breche") return this.acteDeSabotage();
    if (acte === "meurtre") return this.acteDeMeurtre(fou);
    if (acte === "incendie") return this.acteDIncendie(fou);
  }

  /**
   * Le degre 3 qui brule au lieu de tuer (§4.18, §4.21).
   *
   * Le meme homme, la meme nuit, un autre geste : il pose le feu chez son
   * voisin. C'est moins definitif qu'un meurtre — une maison se releve — et
   * bien plus visible, ce qui en fait l'acte qu'on remarque le matin.
   */
  acteDIncendie(this: ArenaScene, fou: Fou): void {
    const lui = this.village.parId(fou.id);
    const depart = lui ?? this.village.vivants[0] ?? null;
    if (depart === null) return;
    if (!this.brulerLaPlusProche(depart.x, depart.y)) {
      this.events.emit("annonce", "Une odeur de brule, au matin, sans rien trouver", "guet");
    }
  }

  /**
   * La maison debout la plus proche prend feu.
   *
   * Partagee par le Pyromane (§4.27) et le fou du degre 3 (§4.18) : les deux
   * font exactement le meme geste, pour deux raisons differentes.
   */
  brulerLaPlusProche(this: ArenaScene, x: number, y: number): boolean {
    const maison = this.maisons.laPlusProcheDebout(x, y);
    if (!maison) return false;
    return this.mettreLeFeu(maison, `Le feu a ete mis a une ${maison.nom.toLowerCase()}`);
  }

  acteDeVol(this: ArenaScene, fou: Fou): void {
    const voleur = this.village.parId(fou.id);
    let emporte = 0;
    for (const ressource of RESSOURCES) {
      const part = Math.floor(this.village.stocks[ressource] * REGLAGES_ARRIVEES.partVolee);
      this.village.stocks[ressource] -= part;
      emporte += part;
    }

    if (voleur !== null) this.village.retirer(voleur);
    this.events.emit(
      "annonce",
      emporte > 0
        ? `Les reserves ont ete videes dans la nuit — ${emporte} de perdu`
        : "Quelqu'un est parti dans la nuit",
      "guet",
    );
  }

  acteDeSabotage(this: ArenaScene): void {
    // Un mur, jamais une tour : ouvrir une breche, c'est ouvrir un passage
    // (§4.18). Faire tomber une tour ferait tomber son occupant, donc tuerait —
    // ce qui est l'acte du degre au-dessus.
    const murs = this.constructions.toutes.filter((c) => !c.def.occupable && !c.def.indestructible);
    if (murs.length === 0) {
      this.events.emit("annonce", "Des outils ont disparu dans la nuit", "guet");
      return;
    }

    const mur = this.rng.pick(murs);
    poufMort(this, mur.x, mur.y, 0x9a8b74);
    this.constructions.detruire(mur);
    this.events.emit("annonce", "Une breche a ete ouverte dans la palissade", "guet");
  }

  acteDeMeurtre(this: ArenaScene, fou: Fou): void {
    const candidats = this.village.vivants.map((v) => v.regles.id);
    const cible = victimeDe(fou, candidats, this.fous, this.rng);
    if (cible === null) return;

    const victime = this.village.parId(cible);
    if (victime === null) return;

    // `tuer` annonce deja la mort, fait le deuil et met la satisfaction a jour.
    // On n'ajoute qu'une chose : que personne ne sait ce qui s'est passe.
    this.village.tuer(victime);
    this.events.emit("annonce", "On l'a trouve au matin. Personne n'a rien entendu", "guet");
  }

  oublierLeFou(this: ArenaScene, fou: Fou): void {
    const index = this.fous.indexOf(fou);
    if (index >= 0) this.fous.splice(index, 1);
  }
}
