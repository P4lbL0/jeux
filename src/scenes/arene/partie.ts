import Phaser from "phaser";
import { CLASSES, ORDRE_CLASSES, type ClassId } from "../../core/classes";
import { ouLonParait } from "../../core/marche";
import { Ennemi, Hero } from "../../game/entities";
import { majEffets } from "../../game/effets";
import { frontsDeLaVague, mondeCourant, repartition } from "../../core/carte";
import { Commandement } from "../../game/commandement";
import { appliquer, capturer, ecrireEnLocal, effacerEnLocal } from "../../game/sauvegarde";
import type { Sauvegarde } from "../../core/sauvegarde";
import { effacer as effacerCloud, envoyer } from "../../en-ligne/sauvegardeCloud";
import { enregistrerPartie } from "../../en-ligne/parties";
import { ArenaScene } from "../ArenaScene";
import { CITE, ACTIONS_CAPACITE } from "./reglages";

/**
 * La partie elle-même : reprendre une sauvegarde, enregistrer, suspendre et reprendre,
 * la pause du joueur, sauver et quitter, abandonner, la fin de partie.
 *
 * Une part d'`ArenaScene`, greffée sur son prototype (`greffer`) : `this` est la scène.
 */
export class ArenaPartie {

  reprendreLaPartie(this: ArenaScene, sauvegarde: Sauvegarde): void {
    const monde = this.partieEnCours;
    this.indexIncarne = appliquer(sauvegarde, monde, this.time.now);
    // Les chemins reviennent tels qu'on les a laisses : une partie d'avant
    // n'en a pas, et repart de l'herbe.
    if (sauvegarde.chemins) {
      this.chemins.reprendre(sauvegarde.chemins);
      this.coucheChemins.toutRedessiner(this.chemins.visibles, sauvegarde.cycle.jour);
    }
    // `appliquer` remplace le tirage et l'equipe : la scene reprend ce que le
    // pont a repose.
    this.rng = monde.rng;
    this.kills = monde.kills;
    // `fous` et le port sont modifies sur place ; ces deux-la sont des nombres,
    // il faut les relire.
    this.prochaineArriveeJournee = monde.prochaineArrivee;
    // ⚠️ **Le survivant n'est pas enregistre, et son echeance non plus.** Comme
    // le navire du bloc 6b, c'est un **instant**, pas un etat : quelqu'un qui
    // appelle au bord de la carte n'a pas de raison d'etre encore la apres un
    // rechargement. On replanifie donc depuis la reputation du moment — ce qui
    // rend un delai neuf, jamais une apparition immediate, sinon recharger
    // offrirait un survivant a chaque fois (§4.28, regle ironman).
    this.planifierLeProchainSurvivant();
    this.argent = monde.argent;
    this.bannis = monde.bannis;
    this.dureeJouee = sauvegarde.dureeJouee;
    this.debut = this.time.now;

    const incarne = this.heros[this.indexIncarne];
    if (incarne) {
      incarne.estIncarne = true;
      this.cameras.main.startFollow(incarne, true, 0.12, 0.12);
    }
    this.commandement = new Commandement(this.heros);
    this.teinterLeCiel();
    if (this.cycle.phase === "nuit") {
      // La nuit reprend la ou elle en etait : l'effectif restant se recompose a
      // partir du cycle, il ne se stocke pas monstre par monstre.
      this.resteDeLaNuit = this.effectifDeLaNuitIci(this.cycle.nuit);
      this.poserLesRendezvous(this.cycle.nuit);
      this.village.tomberLaNuit();
      this.fronts = frontsDeLaVague(this.cycle.nuit, this.rng.next());
      this.partPremierFront = repartition(this.fronts, this.rng.next());
    }

    // Les feux repris n'ont que des cles : on leur rend leurs maisons et leurs
    // champs, et ce qui ne se retrouve plus s'eteint (§4.21).
    this.raccrocherLesFeux();
    // Les crateres sont **la seule chose du jeu qui marque la carte pour de
    // bon** : on les repeint, et la pierre revient avec son fer (§4.21, §4.28).
    this.recreuserLesCrateres();

    // ⚠️ **Une partie enregistree pendant une crue reprend en crue** (§4.21) :
    // les douves doivent redeborder, sinon recharger serait une facon de faire
    // baisser l'eau. Les champs, eux, sont deja noyes dans la sauvegarde.
    if (this.meteo.crue) {
      this.crueEnCours = true;
      this.grille.crue = true;
      this.recalculerLeParcours();
      this.prochainRongement = this.time.now + ArenaScene.CRUE.cadence;
    }

    const moment = this.cycle.phase === "nuit" ? "Nuit" : "Jour";
    this.events.emit("annonce", `${moment} ${this.cycle.jour} — la partie reprend`, "village");
  }

  /**
   * La page qu'on quitte (§4.28).
   *
   * `visibilitychange` et non `unload` : c'est le seul evenement que les
   * navigateurs mobiles emettent de facon fiable quand on change d'onglet ou
   * qu'on verrouille l'ecran, et `unload` ne se declenche parfois jamais.
   */
  surveillerLaFermeture(this: ArenaScene): void {
    const partant = () => {
      if (document.visibilityState === "hidden") this.enregistrer(true);
    };
    document.addEventListener("visibilitychange", partant);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
      document.removeEventListener("visibilitychange", partant),
    );
  }

  /**
   * On enregistre (§4.28).
   *
   * Le local d'abord, toujours, et sans condition : c'est lui la sauvegarde.
   * Le cloud ensuite, si un compte est connecte, et **au plus une fois par
   * minute** — le dernier etat gagne, rien n'est mis en file. Aucun `await`
   * ici : le jeu ne s'arrete pas pour attendre le reseau.
   *
   * ⚠️ **Regle ironman** : on ecrase, toujours, mort comprise. Fermer l'onglet
   * apres avoir perdu un heros ne le ramene pas (§4.3).
   */
  enregistrer(this: ArenaScene, force = false): void {
    if (!this.village) return;
    // Tant qu'on marche, il n'y a pas de partie a sauver : on n'a pas encore
    // de village (§4.29). Enregistrer ici ecraserait l'emplacement avec un
    // village qui n'est pas le notre, et qu'on va peut-etre refuser.
    if (this.enMarche) return;

    this.revision += 1;
    const sauvegarde = capturer(this.partieEnCours, this.time.now);
    ecrireEnLocal(this.emplacement, sauvegarde);
    void envoyer(this.emplacement, sauvegarde, force);
  }

  suspendre(this: ArenaScene): void {
    // Le menu de choix met deja le jeu en pause, et c'est lui qui decidera du
    // degel : on ne se met pas en travers.
    // Le robot (jalon 6.4) joue sans fenetre au premier plan : jamais de pause hors focus.
    if (this.enPause || this.termine || this.robot) return;
    this.enPause = true;
    this.pauseHorsFocus = true;
    this.debutPause = this.time.now;
    this.physics.pause();
    this.anims.pauseAll();
  }

  reprendre(this: ArenaScene): void {
    if (!this.pauseHorsFocus || this.termine) return;
    this.pauseHorsFocus = false;
    // Le temps passe fenetre en arriere-plan ne doit rien declencher au retour :
    // c'est exactement le decalage que le menu de choix applique deja.
    this.decalerLeTemps(this.time.now - this.debutPause);
    this.physics.resume();
    this.anims.resumeAll();
    this.enPause = false;
  }

  // ------------------------------------------------- la pause du joueur

  /**
   * **La premiere vraie pause commandee** (DESIGN.md §4.10, bloc 10).
   *
   * Jusqu'au 21 septembre 2026 le jeu ne s'arretait que tout seul : perte de
   * focus, choix de competence, mode d'amenagement. On ne pouvait pas poser la
   * manette.
   *
   * Elle se comporte exactement comme les autres : le temps passe dedans est
   * **rendu** a la reprise, sinon toute la nuit frapperait dans l'image du degel.
   *
   * @returns faux si une autre pause tient deja le jeu — on ne se met pas en
   *   travers de qui rendra la main.
   */
  poserLaPauseDuJoueur(this: ArenaScene): boolean {
    if (this.termine || this.enPause) return false;
    this.enPause = true;
    this.pauseDuJoueur = true;
    this.debutPauseDuJoueur = this.time.now;
    this.physics.pause();
    this.anims.pauseAll();
    return true;
  }

  leverLaPauseDuJoueur(this: ArenaScene): void {
    if (!this.pauseDuJoueur || this.termine) return;
    this.pauseDuJoueur = false;
    this.decalerLeTemps(this.time.now - this.debutPauseDuJoueur);
    this.physics.resume();
    this.anims.resumeAll();
    this.enPause = false;
  }

  /** Referme le mode d'amenagement. Rend vrai s'il etait ouvert. */
  quitterLAmenagement(this: ArenaScene): boolean {
    if (!this.amenagement) return false;
    this.fermerAmenagement();
    return true;
  }

  /**
   * « Sauver et quitter » (§4.10, §4.28).
   *
   * On force l'enregistrement — la regle ironman ecrase, toujours — puis on
   * rend l'ecran d'accueil, d'ou REPRENDRE relance exactement cette partie.
   */
  sauverEtQuitter(this: ArenaScene): void {
    this.enregistrer(true);
    this.retournerAuMenu();
  }

  /**
   * « Abandonner » (§4.10).
   *
   * ⚠️ **La seule ligne destructive du jeu.** L'emplacement se libere des deux
   * cotes — local et cloud — exactement comme a la mort de l'equipe : sinon la
   * partie abandonnee se reprendrait en changeant de machine.
   */
  abandonnerLaPartie(this: ArenaScene): void {
    effacerEnLocal(this.emplacement);
    void effacerCloud(this.emplacement);
    this.retournerAuMenu();
  }

  retournerAuMenu(this: ArenaScene): void {
    this.musique.eteindre(1);
    this.scene.stop("ui");
    this.scene.start("menu");
  }

  /**
   * Rend a tout le monde le temps passe en pause.
   *
   * Sans ce decalage, une pause de dix secondes ferait arriver a echeance d'un
   * seul coup tous les rechargements, tous les coups armes et toutes les
   * apparitions — la vague entiere frapperait dans l'image de la reprise.
   */
  decalerLeTemps(this: ArenaScene, pause: number): void {
    for (const hero of this.heros) hero.decalerRechargements(pause);
    for (const objet of this.ennemis.getChildren()) (objet as Ennemi).decaler(pause);
    this.elements.decaler(pause);
    this.constructions.decaler(pause);
    this.prochaineApparition += pause;
    this.prochaineHorde += pause;
    if (this.hordeAuDepart > 0) this.hordeAuDepart += pause;
    // Les fusions datent ce qu'elles font : un choix de competence ne doit ni
    // les finir ni les recharger (§4.25).
    for (const dome of this.domes) if (dome.finDeVie !== undefined) dome.finDeVie += pause;
    for (const zone of this.zonesFracturees) zone.fin += pause;
    for (const vol of this.volsDEpees.values()) vol.debut += pause;
    for (const [hero, t] of this.prochainMoulin) this.prochainMoulin.set(hero, t + pause);
    for (const [hero, t] of this.tourbillons) this.tourbillons.set(hero, t + pause);
  }

  /**
   * **Un seul heros, et il n'y en aura pas d'autre a trouver** (DESIGN.md
   * §4.29, tranche par Angelos le 20 septembre 2026). Jusqu'ici l'equipe des
   * sept classes etait donnee d'emblee — un reste du jalon 3, pour eprouver le
   * changement de heros et l'IA. Ces systemes dorment desormais jusqu'au
   * premier villageois forme (bloc 9) : un jeu qui commence a sept heros ne
   * raconte pas « je suis le seul qui reste ».
   */
  composerEquipe(this: ArenaScene): void {
    const choisie = (this.registry.get("classe") as ClassId) ?? ORDRE_CLASSES[0]!;
    // Une partie neuve ne commence plus au village : on parait au bord, par le
    // front le plus loin, et on marche (§4.29). Une partie reprise retrouve son
    // heros la ou la sauvegarde l'a laisse — ce point-ci n'est alors qu'un
    // point de passage, remplace quelques lignes plus loin.
    const depart = this.enMarche
      ? ouLonParait(mondeCourant()).point
      : { x: CITE.x, y: CITE.y + 60 };
    this.departDeLaMarche = { ...depart };
    const hero = new Hero(this, depart.x, depart.y, CLASSES[choisie]);
    hero.estIncarne = true;
    this.heros.push(hero);
    this.equipe.add(hero);
  }

  /** Rend la main au jeu apres une pause commandee par un panneau. */
  reprendreLeJeu(this: ArenaScene): void {
    this.decalerLeTemps(this.time.now - this.debutPause);
    this.physics.resume();
    this.anims.resumeAll();
    this.enPause = false;
    // ⚠️ Le chiffre qui vient de choisir une carte est aussi la touche d'une
    // capacite, et le jeu reprend dans l'image meme de l'appui : sans ca,
    // prendre la carte 1 au clavier lancait l'ultime a la reprise, la carte 2
    // la premiere active. Vu le 23 septembre 2026, en achetant un emplacement.
    this.clavier.oublierLesAppuis(...ACTIONS_CAPACITE);
  }

  finDePartie(this: ArenaScene): void {
    this.termine = true;
    // La musique s'eteint avec la partie : le silence apres la chute.
    this.musique.eteindre(4);
    // `update` ne tournera plus : on rend la main au monde ici, sinon un
    // micro-gel en cours resterait en place pour de bon.
    majEffets(this, this.time.now, false);
    this.physics.pause();
    this.anims.pauseAll();
    this.effacerDestination();
    const resume = this.resume;
    this.events.emit("fin-de-partie", resume.secondes, resume.kills);

    // La partie est finie : l'emplacement se libere des deux cotes, et la
    // partie part au classement (§4.28).
    //
    // ⚠️ **La copie cloud aussi.** L'oublier laisserait, au prochain
    // chargement, la proposition de reprendre exactement la partie qu'on vient
    // de perdre — la regle ironman se contournerait en changeant de machine.
    effacerEnLocal(this.emplacement);
    void effacerCloud(this.emplacement);
    void enregistrerPartie({
      jours: this.cycle.jour,
      classe: (this.registry.get("classe") as ClassId) ?? "guerrier",
      dureeSecondes: (this.dureeJouee + (this.time.now - this.debut)) / 1000,
    });
  }
}
