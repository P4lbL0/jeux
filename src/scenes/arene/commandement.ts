import Phaser from "phaser";
import { Hero } from "../../game/entities";
import {
  NOMS_FORMATION,
  NOMS_POSTURE,
  tache as tacheDef,
  type Posture,
  type TacheId,
} from "../../core/ordres";
import { lignesDuMenu, type ContenuMenu } from "../../game/menuOrdres";
import { NIVEAU_EGLISE_RITUEL, PRIX_DU_RITUEL } from "../../core/dons";
import { POSTES } from "../../core/carte";
import { type Villageois } from "../../game/village";
import { NOMS_METIER, NOMS_POSTURE_CIVILE } from "../../core/habitants";
import type { ArenaScene } from "../ArenaScene";
import { CITE } from "./reglages";

/**
 * Le commandement (§4.4) : ordres, sélection, menu d'ordres, tâches confiées, et le
 * changement de héros incarné.
 *
 * Une part d'`ArenaScene`, greffée sur son prototype (`greffer`) : `this` est la scène.
 */
export class ArenaCommandement {

  // ------------------------------------------------------------ commandement

  /**
   * Clic droit : la selection va tenir ce point. Sur un allie, elle le suit
   * partout — proteger quelqu'un, c'est s'ancrer sur lui (DESIGN.md §4.4).
   */
  ordonnerAncre(this: ArenaScene, pointeur: Phaser.Input.Pointer): void {
    const point = this.cameras.main.getWorldPoint(pointeur.x, pointeur.y);
    const protege = this.alliePres(point.x, point.y);
    const incarne = this.hero ?? null;

    const ancre = protege ? { x: protege.x, y: protege.y } : { x: point.x, y: point.y };
    // Poser une ancre a la main, c'est le rappeler du travail : sinon
    // `travaillerLesHeros` la remettrait sur le poste a l'image suivante, et le
    // clic droit paraitrait ne rien faire.
    for (const h of this.commandement.destinataires(incarne)) h.travail = null;
    // Rien de selectionne : l'ordre vaut pour toute l'equipe IA (§4.4). Ca
    // n'a jamais valu pour les civils — trente habitants envoyes d'un clic
    // distrait tenir un carrefour, c'est la production entiere qui s'arrete.
    const nombre = this.commandement.ancrer(ancre, protege ?? null, incarne, this.sbires);
    const civils = this.commandement.ancrerCivils(ancre, protege ?? null);
    if (nombre + civils === 0) return;

    this.effetCercle(point.x, point.y, protege ? 34 : 22, protege ? 0x7ee0a0 : 0x5ec8f0);
    this.annoncer(
      protege
        ? `${nombre + civils} protege${nombre + civils > 1 ? "nt" : ""} ${protege.personne.nom}`
        : `${nombre + civils} en route`,
    );
  }

  /**
   * Tab prend et rend le mode commandement (DESIGN.md §4.4, bloc 8).
   *
   * Il ne met rien en pause : le §4.4 est formel, « le combat ne s'arrete
   * jamais pour donner un ordre ». Ce qu'il change tient en une ligne — le clic
   * gauche selectionne au lieu de deplacer.
   */
  basculerCommandement(this: ArenaScene, force?: boolean): void {
    const veut = force ?? !this.modeCommandement;
    if (veut === this.modeCommandement) return;
    this.modeCommandement = veut;
    this.rectangleDepart = null;
    this.rectangleCourant = null;

    if (!veut) {
      this.events.emit("fermer-menu-ordres");
      this.annoncer("");
      return;
    }
    // Entrer dans le mode lache le heros sur place : sinon il continuerait de
    // courir vers le dernier point clique pendant qu'on donne des ordres.
    this.effacerDestination();
    this.lacherLOutil();
    this.annoncer("Clic : qui  ·  glisse un cadre  ·  clic droit : ou");
  }

  /**
   * Le clic gauche en mode commandement.
   *
   * Sur quelqu'un : il entre dans la selection et son menu s'ouvre. Sur le
   * vide : on commence un rectangle — c'est le geste que le §4.4 demande, celui
   * qui prend « heros et villageois melanges ».
   */
  cliquerEnCommandement(this: ArenaScene, pointeur: Phaser.Input.Pointer): void {
    // ⚠️ **Les deux scenes recoivent le meme clic.** Sans ce garde-fou,
    // choisir « Aux champs » dans le menu declenchait aussi le clic « sur le
    // vide » de l'arene juste derriere : le menu se refermait et un rectangle
    // partait. Ca ne se voit pas a la compilation, seulement en cliquant.
    if (this.souSLInterface(pointeur)) return;

    const point = this.cameras.main.getWorldPoint(pointeur.x, pointeur.y);
    const ajouter = pointeur.event.shiftKey;

    const hero = this.alliePres(point.x, point.y);
    const civil = hero ? null : this.villageoisPres(point.x, point.y);

    if (hero || civil) {
      if (!ajouter) this.commandement.effacer();
      if (hero) this.commandement.basculer(hero);
      else if (civil) this.commandement.basculerCivil(civil);
      this.ouvrirLeMenu(pointeur.x, pointeur.y);
      return;
    }

    // Le vide : on efface et on commence a tracer. Effacer tout de suite plutot
    // qu'au relachement donne un retour immediat au clic qui rate.
    this.events.emit("fermer-menu-ordres");
    this.rectangleDepart = new Phaser.Math.Vector2(point.x, point.y);
    this.rectangleCourant = new Phaser.Math.Vector2(point.x, point.y);
  }

  /** On relache : ce qui est dans le cadre est selectionne, et le menu s'ouvre. */
  fermerLeRectangle(this: ArenaScene, pointeur: Phaser.Input.Pointer): void {
    const depart = this.rectangleDepart;
    const arrivee = this.rectangleCourant;
    this.rectangleDepart = null;
    this.rectangleCourant = null;
    if (!depart || !arrivee) return;

    const largeur = Math.abs(arrivee.x - depart.x);
    const hauteur = Math.abs(arrivee.y - depart.y);
    // Un cadre de trois pixels, c'est un clic qui a bouge : il efface, il ne
    // selectionne pas.
    if (largeur < 8 && hauteur < 8) {
      this.commandement.effacer();
      return;
    }

    const nombre = this.commandement.selectionnerDans(
      { x: Math.min(depart.x, arrivee.x), y: Math.min(depart.y, arrivee.y), largeur, hauteur },
      this.village.habitants,
      this.hero ?? null,
      pointeur.event.shiftKey,
    );
    if (nombre === 0) {
      this.annoncer("Personne dans le cadre");
      return;
    }
    this.ouvrirLeMenu(pointeur.x, pointeur.y);
  }

  /**
   * Ce que le menu affiche, et ou.
   *
   * Il montre l'union des deux vocabulaires quand la selection est melangee, et
   * eteint ce que tout le monde fait deja (§4.4).
   */
  ouvrirLeMenu(this: ArenaScene, x: number, y: number): void {
    const heros = this.commandement.selectionnes;
    const civils = this.commandement.civilsSelectionnes;
    if (heros.length + civils.length === 0) {
      this.events.emit("fermer-menu-ordres");
      return;
    }

    const noms = [...heros.map((h) => h.personne.nom), ...civils.map((c) => c.nom)];
    const titre = noms.length === 1 ? noms[0]! : `${noms.length} selectionnes`;
    const sousTitre =
      noms.length === 1
        ? heros.length === 1
          ? heros[0]!.classe.nom
          : NOMS_METIER[civils[0]!.regles.metier]
        : noms.slice(0, 3).join(", ") + (noms.length > 3 ? "..." : "");

    const contenu: ContenuMenu = {
      x,
      y,
      titre,
      sousTitre,
      lignes: lignesDuMenu(this.commandement.populations, (id) => this.dejaFait(id, heros, civils)),
    };
    this.events.emit("menu-ordres", contenu);
  }

  /** Vrai quand toute la selection fait deja ca : la ligne s'eteint. */
  dejaFait(this: ArenaScene, id: TacheId, heros: Hero[], civils: Villageois[]): boolean {
    const def = tacheDef(id);
    if (!def) return false;
    if (def.metier) {
      const metiers = [
        ...civils.map((c) => c.regles.metier),
        ...heros.map((h) => h.travail),
      ];
      return metiers.length > 0 && metiers.every((m) => m === def.metier);
    }
    if (def.postureCivile) {
      return civils.length > 0 && civils.every((c) => c.regles.posture === def.postureCivile);
    }
    if (def.posture) {
      return heros.length > 0 && heros.every((h) => h.ordre.posture === def.posture);
    }
    // Deja a la cour : la ligne s'eteint plutot que de le reinscrire.
    if (id === "entrainer") {
      // ⚠️ `?.` rend `undefined`, pas `null` : sans la double negation, la
      // ligne s'eteignait des qu'il n'y avait pas de cour — donc toujours.
      return civils.length > 0 && civils.every((c) => Boolean(this.cour?.eleve(c.regles.id)));
    }
    return false;
  }

  /**
   * Le joueur a choisi une ligne du menu.
   *
   * ⚠️ **Chaque tache ne touche que ceux qui la comprennent.** Un rectangle
   * melange prend des heros et des villageois ; « Prudent » ne veut rien dire
   * pour un heros, « Agressif » rien pour un pecheur. Appliquer l'une a l'autre
   * population serait la facon la plus sure de rendre le rectangle inutilisable.
   */
  appliquerTache(this: ArenaScene, id: TacheId): void {
    const def = tacheDef(id);
    if (!def) return;
    const heros = this.commandement.selectionnes;
    const civils = this.commandement.civilsSelectionnes;

    if (def.metier) {
      for (const civil of civils) this.village.changerMetier(civil, def.metier);
      let touches = civils.length;

      // Un heros au travail (§4.4). Seuls les quatre postes de la carte lui
      // valent quelque chose : la forge, l'atelier et la tour sont des postes
      // d'habitant, et un heros n'y produirait rien.
      const poste = POSTES.find((p) => p.metier === def.metier);
      const refuses: Hero[] = [];
      for (const h of heros) {
        if (!poste) {
          refuses.push(h);
          continue;
        }
        h.travail = def.metier;
        h.protege = null;
        h.ordre = { ...h.ordre, ancre: { ...poste.position } };
        h.poste = null;
        touches++;
      }

      this.events.emit("fermer-menu-ordres");
      if (refuses.length > 0 && touches === 0) {
        this.annoncer("Ce poste-la est un poste d'habitant");
        return;
      }
      this.annoncer(`${touches} · ${def.libelle.toLowerCase()}`);
      return;
    }

    if (def.postureCivile) {
      for (const civil of civils) this.village.changerPosture(civil, def.postureCivile);
      this.annoncer(`${civils.length} · ${NOMS_POSTURE_CIVILE[def.postureCivile]}`);
      this.events.emit("fermer-menu-ordres");
      return;
    }

    if (def.posture) {
      // Lui donner une posture, c'est le rappeler au combat : sinon l'ancre du
      // poste le ramenerait travailler a l'image suivante.
      for (const h of heros) h.travail = null;
      if (heros.length > 0) this.ordonnerPosture(def.posture);
      this.events.emit("fermer-menu-ordres");
      return;
    }

    if (id === "suivre") {
      const moi = this.hero ?? null;
      if (!moi || !moi.estVivant) return;
      let touches = 0;
      for (const h of heros) h.travail = null;
      if (heros.length > 0) {
        touches += this.commandement.ancrer({ x: moi.x, y: moi.y }, moi, moi, this.sbires);
      }
      touches += this.commandement.ancrerCivils({ x: moi.x, y: moi.y }, moi);
      this.annoncer(`${touches} avec moi`);
      this.events.emit("fermer-menu-ordres");
      return;
    }

    if (id === "entrainer") {
      this.events.emit("fermer-menu-ordres");
      for (const civil of civils) this.inscrireALaCour(civil);
      return;
    }

    if (id === "rituel") {
      this.events.emit("fermer-menu-ordres");
      for (const civil of civils) this.celebrerLeRituel(civil);
      return;
    }

    if (id === "rompez") this.rompre();
  }

  /**
   * Le rituel de l'eglise : **sur, et cher** (DESIGN.md §4.1, §6).
   *
   * C'est la troisieme voie, et la seule qui ne tire rien : elle dit ce que la
   * personne porte, et l'eveille si elle porte quelque chose. On l'achete quand
   * on ne veut plus attendre — et l'argent vient du port (§4.18), donc elle se
   * paie en marchandises qu'on n'a pas gardees.
   */
  celebrerLeRituel(this: ArenaScene, villageois: Villageois): void {
    if (this.eglise.regles.niveau < NIVEAU_EGLISE_RITUEL) {
      this.events.emit(
        "annonce",
        `L'eglise doit etre de niveau ${NIVEAU_EGLISE_RITUEL} pour ce rituel`,
        "toi",
      );
      return;
    }
    if (!this.eglise.fonctionne) {
      this.events.emit("annonce", "L'eglise est a terre", "toi");
      return;
    }
    if (this.argent < PRIX_DU_RITUEL) {
      this.events.emit("annonce", `Le rituel coute ${PRIX_DU_RITUEL} pieces`, "toi");
      return;
    }

    this.argent -= PRIX_DU_RITUEL;
    const nom = villageois.nom;
    // ⚠️ **L'argent est pris dans tous les cas.** Le rituel est sur au sens ou
    // il ne tire rien : il **revele**. Neuf fois sur dix il revele qu'il n'y
    // avait rien, et c'est ce qui le rend cher a jouer plutot que cher a payer.
    if (!this.eveillerUnDon(villageois, "rituel")) {
      this.events.emit("annonce", `Le rituel ne trouve rien en ${nom}`, "village");
    }
  }

  /** Y a-t-il un morceau d'interface sous le pointeur ? */
  souSLInterface(this: ArenaScene, pointeur: Phaser.Input.Pointer): boolean {
    const ui = this.scene.get("ui");
    if (!ui?.input) return false;
    return ui.input.hitTestPointer(pointeur).length > 0;
  }

  /** L'habitant le plus proche du clic, s'il est assez pres pour etre vise. */
  villageoisPres(this: ArenaScene, x: number, y: number): Villageois | null {
    let meilleur: Villageois | null = null;
    let distance = 26;
    for (const civil of this.village.habitants) {
      if (!civil.regles.vivant || civil.etat === "abri") continue;
      const d = Phaser.Math.Distance.Between(x, y, civil.x, civil.y);
      if (d < distance) {
        distance = d;
        meilleur = civil;
      }
    }
    return meilleur;
  }

  /** Le heros le plus proche du clic, s'il est assez pres pour etre vise. */
  alliePres(this: ArenaScene, x: number, y: number): Hero | null {
    let meilleur: Hero | null = null;
    let distance = 26;
    for (const hero of this.heros) {
      if (!hero.estVivant) continue;
      const d = Phaser.Math.Distance.Between(x, y, hero.x, hero.y);
      if (d < distance) {
        distance = d;
        meilleur = hero;
      }
    }
    return meilleur;
  }

  ordonnerPosture(this: ArenaScene, posture: Posture): void {
    const nombre = this.commandement.donnerPosture(posture, this.hero ?? null, this.sbires);
    if (nombre > 0) this.annoncer(`${nombre} · ${NOMS_POSTURE[posture]}`);
  }

  changerFormation(this: ArenaScene): void {
    const formation = this.commandement.changerFormation();
    this.annoncer(`Formation : ${NOMS_FORMATION[formation]}`);
  }

  rompre(this: ArenaScene): void {
    // Les habitants aussi : depuis le bloc 8, un villageois peut tenir un point
    // — et un villageois oublie sur un carrefour ne produit plus rien de la
    // partie. C'est exactement ce que *Rompez* existe pour eviter (§4.4).
    this.commandement.rompre(this.sbires, this.village?.habitants ?? []);
    // Et le travail avec : une affectation est un ordre comme un autre, et
    // *Rompez* est le bouton qui remet tout le monde au combat.
    for (const hero of this.heros) hero.travail = null;
    this.events.emit("fermer-menu-ordres");
    this.annoncer("Rompez");
  }

  /** Clic droit sur un portrait, transmis par l'interface. */
  selectionnerDepuisUi(this: ArenaScene, index: number, touteLaClasse: boolean): void {
    const hero = this.heros[index];
    if (!hero || !hero.estVivant) return;
    if (touteLaClasse) this.commandement.selectionnerClasse(hero.classe.id);
    else this.commandement.basculer(hero);
  }

  annoncer(this: ArenaScene, message: string): void {
    this.commandement.annoncer(message, this.time.now);
  }

  montrerMarqueur(this: ArenaScene): void {
    if (!this.destination) return;
    this.marqueur ??= this.add
      .image(0, 0, "impact")
      .setTint(0xfff0a0)
      .setAlpha(0.5)
      .setScale(0.9)
      .setDepth(-500);
    this.marqueur.setPosition(this.destination.x, this.destination.y).setVisible(true);
  }

  effacerDestination(this: ArenaScene): void {
    this.destination = null;
    this.marqueur?.setVisible(false);
  }

  // ------------------------------------------------- changement de heros

  /**
   * Le verrou des 20% (DESIGN.md §4.3). Sous ce seuil, le joueur ne peut pas
   * abandonner son heros mourant : il doit le ramener vivant a la cite.
   */
  changementAutorise(this: ArenaScene): boolean {
    const h = this.hero;
    if (!h || h.etat === "mort") return true;
    return !h.estCritique || h.etat === "cite";
  }

  changerHeroRelatif(this: ArenaScene, pas: number): void {
    const total = this.heros.length;
    for (let i = 1; i <= total; i++) {
      const index = (this.indexIncarne + pas * i + total * i) % total;
      if (this.heros[index]?.etat !== "mort") {
        this.changerHero(index);
        return;
      }
    }
  }

  changerHero(this: ArenaScene, index: number): void {
    if (this.termine || this.enPause) return;
    const cible = this.heros[index];
    if (!cible || cible.etat === "mort" || index === this.indexIncarne) return;

    if (!this.changementAutorise()) {
      this.flotter(this.hero.x, this.hero.y - 24, "Verrouille !", "#ff8a7a");
      this.cameras.main.shake(120, 0.003);
      return;
    }

    this.hero.estIncarne = false;
    this.hero.setVelocity(0, 0);
    // Celui qu'on lache ressort de l'eau : l'IA n'y entre jamais, et ses limites
    // redeviennent celles du monde, qui le ramenent sur la plage.
    this.quitterLEau(this.hero);
    this.indexIncarne = index;
    cible.estIncarne = true;
    this.ouvrirLaMerAuHero(cible);
    this.effacerDestination();

    this.cameras.main.startFollow(cible, true, 0.12, 0.12);
    this.effetCercle(cible.x, cible.y, 60, 0xf0c419);
    this.events.emit("hero-incarne", cible);

    // Le heros repris presente ses choix en attente : c'est toujours le joueur
    // qui choisit, jamais l'IA (DESIGN.md §4.3).
    if (cible.choixEnAttente > 0) this.ouvrirChoix();
  }

  /**
   * La formation et les ancres, recalculees une fois par image pour toute
   * l'equipe — jamais heros par heros (regle 5 du §4.17).
   *
   * L'ancre de la formation, c'est le heros incarne : le joueur deplace donc
   * toute sa ligne en se deplacant lui-meme (DESIGN.md §4.4).
   */
  majCommandement(this: ArenaScene): void {
    const sbires = this.sbires;
    this.commandement.suivreLesProteges(sbires, this.village?.habitants ?? []);

    const ancre = this.hero?.estVivant ? { x: this.hero.x, y: this.hero.y } : CITE;
    const menace = this.ennemiLePlusProche(ancre.x, ancre.y, 900);
    this.commandement.majPostes(
      ancre,
      menace ? { x: menace.x, y: menace.y } : null,
      this.hero ?? null,
    );

    this.dessinerOrdres();
  }

  /**
   * Un seul objet Graphics, efface et redessine (regle 3 du §4.17) : le joueur
   * doit voir d'un coup d'oeil qui il commande et ou il l'envoie.
   */
  dessinerOrdres(this: ArenaScene): void {
    const g = this.graphiquesOrdres;
    g.clear();

    for (const hero of this.heros) {
      if (!hero.estVivant) continue;

      if (this.commandement.estSelectionne(hero)) {
        g.lineStyle(1, 0x5ec8f0, 0.9);
        g.strokeEllipse(hero.x, hero.y + 6, 20, 10);
      }

      // Le trait ne se dessine que pour une position donnee a la main : les
      // postes de formation en tracerait un par heros a chaque image, pour rien.
      const ancre = hero.ordre.ancre;
      if (!ancre) continue;
      const couleur = hero.protege ? 0x7ee0a0 : 0x5ec8f0;
      g.lineStyle(1, couleur, 0.25);
      g.lineBetween(hero.x, hero.y, ancre.x, ancre.y);
      g.lineStyle(1, couleur, 0.7);
      g.strokeCircle(ancre.x, ancre.y, 7);
    }

    // Les habitants, meme marque et meme trait : le §4.4 ne veut qu'un seul
    // vocabulaire a l'ecran comme dans le code (bloc 8).
    for (const civil of this.village?.habitants ?? []) {
      if (!civil.regles.vivant || civil.etat === "abri") continue;

      if (this.commandement.estSelectionneCivil(civil)) {
        g.lineStyle(1, 0x5ec8f0, 0.9);
        g.strokeEllipse(civil.x, civil.y + 5, 16, 8);
      }
      const ancre = civil.ancre;
      if (!ancre) continue;
      const couleur = civil.suit ? 0x7ee0a0 : 0x5ec8f0;
      g.lineStyle(1, couleur, 0.2);
      g.lineBetween(civil.x, civil.y, ancre.x, ancre.y);
      g.lineStyle(1, couleur, 0.6);
      g.strokeCircle(ancre.x, ancre.y, 6);
    }

    // Le rectangle en cours de trace. Il vit ici et non dans l'interface : il
    // se mesure en coordonnees du monde, donc il doit suivre la camera.
    const depart = this.rectangleDepart;
    const arrivee = this.rectangleCourant;
    if (depart && arrivee) {
      g.lineStyle(1, 0x5ec8f0, 0.85);
      g.strokeRect(
        Math.min(depart.x, arrivee.x),
        Math.min(depart.y, arrivee.y),
        Math.abs(arrivee.x - depart.x),
        Math.abs(arrivee.y - depart.y),
      );
    }
  }
}
