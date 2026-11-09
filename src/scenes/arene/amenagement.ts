import { origineDe, textureDe } from "../../game/constructions";
import { Hero } from "../../game/entities";
import { eclatImpact, recul } from "../../game/effets";
import { EMPRISE_COUR, REGLAGES_COUR } from "../../game/cour";
import { CLE_COUR } from "../../game/dessin/batiments";
import { CASE, COLONNES, IMPOSENT_UNE_DISTANCE, LIGNES } from "../../core/grille";
import {
  CASES_LIBRES_AUTOUR_DES_BATIMENTS,
  CONSTRUCTIONS,
  PONT_LEVIS,
  REMPLISSAGE,
  coutLisible,
  type TypeConstruction,
  coutEnClair,
} from "../../core/constructions";
import { Construction, PORTEE_OCCUPATION } from "../../game/constructions";
import { REGLAGES_CHAMPS } from "../../game/champs";
import { Maison, REGLAGES_MAISONS } from "../../game/maisons";
import { CLES_CHAMP, cleMaison } from "../../game/dessin/batiments";
import { OCCUPANT_TOUR_Y } from "../../game/dessin/murs";
import type { ArenaScene } from "../ArenaScene";
import { ModeBati } from "./reglages";

/**
 * Bâtir et occuper, et le mode d'aménagement (§4.24) : la grille, le fantôme, bâtir ici,
 * les tours.
 *
 * Une part d'`ArenaScene`, greffée sur son prototype (`greffer`) : `this` est la scène.
 */
export class ArenaAmenagement {

  // --------------------------------------------------- batir et occuper

  /**
   * Le mode construction (DESIGN.md §4.20).
   *
   * **Seulement le jour** : batir un rempart au milieu d'un assaut n'aurait
   * aucun sens, et le §4.7 fait de la disposition des defenses une phase de
   * decision a part entiere. Une deuxieme pression sur la meme touche referme.
   */
  basculerConstruction(this: ArenaScene, type: ModeBati): void {
    if (this.cycle.phase !== "jour") {
      this.events.emit("annonce", "On ne batit pas en pleine nuit", "toi");
      return;
    }

    // Choisir quoi poser lache ce qu'on tenait : on ne peut pas avoir une tour
    // en main et une palissade au bout du curseur.
    this.deplacee = null;

    this.enConstruction = this.enConstruction === type ? null : type;
    if (!this.enConstruction) {
      this.fantome.setVisible(false);
      return;
    }

    if (type === "maison") {
      this.fantome.setTexture(cleMaison(0)).setOrigin(0).setVisible(true);
      this.events.emit(
        "annonce",
        `Maison — ${REGLAGES_MAISONS.coutBois} bois · clic pour batir, ou sur une ruine pour la relever`,
        "toi",
      );
      return;
    }

    if (type === "cour") {
      // Le fantome se cale par son coin bas-gauche, comme le batiment pose :
      // sinon l'apercu et la pose ne tombent pas au meme endroit.
      this.fantome.setTexture(CLE_COUR).setOrigin(0, 1).setVisible(true);
      this.events.emit(
        "annonce",
        `Cour d'entrainement — ${REGLAGES_COUR.coutBois} bois et ${REGLAGES_COUR.coutMinerai} minerai · une seule par village`,
        "toi",
      );
      return;
    }

    if (type === "champ") {
      this.fantome.setTexture(CLES_CHAMP.jeune).setOrigin(0.5, 0.5).setVisible(true);
      this.events.emit(
        "annonce",
        `Champ — ${REGLAGES_CHAMPS.coutBois} bois · clic pour semer, pres des champs`,
        "toi",
      );
      return;
    }

    const def = CONSTRUCTIONS[type];
    this.fantome.setTexture(textureDe(def)).setOrigin(0.5, origineDe(def)).setVisible(true);
    if (type === "douve") {
      this.events.emit(
        "annonce",
        `Douve — ${coutLisible(def)} · clic pour creuser ; sur une douve, ${coutEnClair(REMPLISSAGE.cout)} : l'eau, depuis la mer`,
        "toi",
      );
      return;
    }
    const fer = def.paliers?.fer.cout;
    const renfort = fer ? ` · sur un segment en bois, ${coutEnClair(fer)} : fer` : "";
    const pont = type === "porte" ? ` · sur une porte devant une douve en eau, ${coutEnClair(PONT_LEVIS.cout)} : pont-levis` : "";
    this.events.emit("annonce", `${def.nom} — ${coutLisible(def)} · clic pour poser${renfort}${pont}`, "toi");
  }

  /**
   * La cloche (§4.18, §4.20) : tout le monde rentre, **et les portes se
   * ferment**. Plus personne ne passe, dans un sens comme dans l'autre, jusqu'a
   * l'aube — c'est le dilemme des portes, et il commence ici.
   */
  /** On lache l'outil de construction : plus de fantome au bout du curseur. */
  lacherLOutil(this: ArenaScene): void {
    if (!this.enConstruction) return;
    this.enConstruction = null;
    this.fantome.setVisible(false).clearTint();
  }

  sonnerLaCloche(this: ArenaScene): void {
    this.lacherLOutil();
    // La cloche d'un village qu'on n'a pas encore accepte ne nous obeit pas.
    if (this.enMarche) return;
    this.village.sonnerCloche();
    // Les portes ne se ferment pas a la seconde : elles attendent que plus
    // personne ne soit dehors (§4.20, bloc 7b). C'est `majPortes` qui regarde.
    if (this.clocheSonnee || this.constructions.portes.length === 0) return;
    this.clocheSonnee = true;
    this.events.emit(
      "annonce",
      this.village.dehors.length > 0 ? "Les portes se fermeront quand tout le monde sera rentre" : "Les portes se ferment",
      "guet",
    );
  }

  /**
   * Les portes, une fois par image (§4.20, bloc 7b) : la cloche les ferme
   * quand plus personne n'est dehors ; fermees, elles s'ouvrent devant les
   * notres si aucun monstre n'est pres ; et chaque battant avance.
   */
  majPortes(this: ArenaScene): void {
    const maintenant = this.time.now;
    if (this.clocheSonnee && !this.constructions.portesFermees && this.village.dehors.length === 0) {
      this.constructions.fermerLesPortes(maintenant);
      this.events.emit("annonce", "Tout le monde est rentre — les portes se ferment", "guet");
    }
    const demandeurs = this.constructions.portesFermees
      ? [...this.heros.filter((h) => h.etat !== "mort"), ...this.village.dehors]
      : [];
    this.constructions.majPortes(
      maintenant,
      demandeurs,
      (x, y, rayon) => this.ennemiLePlusProche(x, y, rayon) !== null,
    );
  }

  // ------------------------------------------------- le mode d'amenagement

  /**
   * La touche `M` (DESIGN.md §4.24).
   *
   * **Le jour seulement**, comme tout ce qui se batit (§4.20) : le mode met le
   * jeu en pause, donc l'ouvrir en pleine nuit serait une reparation gratuite au
   * milieu d'un assaut — on gelerait la horde pour refaire son mur.
   *
   * Le temps passe dedans est **rendu** a la fermeture, exactement comme la
   * pause hors focus : sans ca, toute la nuit frapperait dans l'image de la
   * reprise.
   */
  basculerAmenagement(this: ArenaScene): void {
    if (this.termine || this.saisieEnCours) return;

    if (this.amenagement) {
      this.fermerAmenagement();
      return;
    }

    // On n'amenage pas le village des autres (§4.29) : tant qu'on n'a pas
    // donne sa parole, on n'est qu'un etranger devant un mur.
    if (this.enMarche) {
      this.events.emit("annonce", "Ce village n'est pas le tien.", "toi");
      return;
    }

    if (this.cycle.phase !== "jour") {
      this.events.emit("annonce", "On n'amenage pas en pleine nuit", "toi");
      return;
    }
    // Une autre pause tient deja le jeu (choix de competence, fiche, hors
    // focus) : on ne se met pas en travers de qui rendra la main.
    if (this.enPause) return;

    this.amenagement = true;
    this.enPause = true;
    this.debutAmenagement = this.time.now;
    this.physics.pause();
    this.anims.pauseAll();
    this.montrerLaGrille(true);
    this.events.emit("annonce", "Amenagement — G/H/J/K pour choisir, clic droit pour demolir", "toi");
  }

  fermerAmenagement(this: ArenaScene): void {
    this.amenagement = false;
    this.deplacee = null;
    this.enConstruction = null;
    this.fantome.setVisible(false).clearTint();
    this.montrerLaGrille(false);
    this.decalerLeTemps(this.time.now - this.debutAmenagement);
    this.physics.resume();
    this.anims.resumeAll();
    this.enPause = false;
    this.events.emit("annonce", "Le village reprend son souffle", "toi");
  }

  /**
   * La grille, dessinee **une seule fois** pour toute la partie (§4.17 regle 3).
   *
   * On la cache et on la remontre ensuite : redessiner quelques milliers de
   * segments a chaque ouverture serait exactement ce que le §4.17 interdit.
   */
  montrerLaGrille(this: ArenaScene, visible: boolean): void {
    if (!this.calqueGrille) {
      const g = this.add.graphics().setDepth(-450);
      g.lineStyle(1, 0x000000, 0.16);
      for (let colonne = 0; colonne <= COLONNES; colonne++) {
        g.lineBetween(colonne * CASE, 0, colonne * CASE, LIGNES * CASE);
      }
      for (let ligne = 0; ligne <= LIGNES; ligne++) {
        g.lineBetween(0, ligne * CASE, COLONNES * CASE, ligne * CASE);
      }
      g.strokePath();
      this.calqueGrille = g;
    }
    this.calqueGrille.setVisible(visible);
  }

  /**
   * Le clic gauche en mode amenagement : poser, prendre, ou reposer.
   *
   * Trois gestes sur un seul bouton, et ils ne se marchent jamais dessus : si un
   * outil est choisi on **pose**, sinon on **prend** ce qui est sous le curseur,
   * et si on tient deja quelque chose on le **repose**. C'est ce que fait tout
   * jeu de construction, et ca evite un mode de plus a expliquer.
   */
  cliquerEnAmenagement(this: ArenaScene, x: number, y: number, demolir: boolean): void {
    const centre = this.grille.centreDe(x, y);

    if (demolir) {
      this.deplacee = null;
      // ⚠️ Une demi-case, pas une entiere : on aimante deja sur le centre, et
      // un rayon d'une case demolissait le mur d'a cote en cliquant du vide.
      const cible = this.constructions.laPlusProche(centre.x, centre.y, CASE / 2);
      if (!cible) {
        // Tout se demolit sauf l'eglise (§4.24) : une maison, ou ses decombres.
        const maison = this.maisons.en(x, y);
        if (!maison) {
          this.events.emit("annonce", "Rien a demolir ici", "toi");
          return;
        }
        const rendu = this.maisons.demolir(maison, this.village.stocks);
        this.events.emit("annonce", `${maison.nom} demolie — ${rendu > 0 ? `${rendu} bois` : "rien"} recupere`, "toi");
        return;
      }
      if (cible === this.tourDuHero) this.tourDuHero = null;
      const nom = cible.def.nom;
      const rendu = this.constructions.demolir(cible, this.village.stocks);
      const lisible = Object.entries(rendu)
        .filter(([, montant]) => (montant ?? 0) > 0)
        .map(([ressource, montant]) => `${montant} ${ressource}`)
        .join(", ");
      this.events.emit("annonce", `${nom} demolie — ${lisible || "rien"} recupere`, "toi");
      return;
    }

    // On tient quelque chose : on le repose.
    if (this.deplacee) {
      const posee =
        this.deplacee instanceof Maison
          ? this.maisons.deplacer(this.deplacee, x, y)
          : this.constructions.deplacer(this.deplacee, centre.x, centre.y);
      if (!posee) {
        this.events.emit("annonce", "On ne peut pas la poser la", "toi");
        return;
      }
      this.deplacee = null;
      this.fantome.setVisible(false);
      return;
    }

    // Un outil est choisi : on pose, avec le meme code et les memes refus qu'en
    // plein jeu — c'est la meme pose, pas une deuxieme.
    if (this.enConstruction) {
      this.batirIci(centre.x, centre.y);
      return;
    }

    // Rien en main, rien a poser : on prend ce qui est sous le curseur.
    const prise = this.constructions.laPlusProche(centre.x, centre.y, CASE / 2);
    if (prise && prise.def.id === "douve") {
      this.events.emit("annonce", "Une douve ne se deplace pas : comble-la (clic droit)", "toi");
      return;
    }
    if (!prise) {
      // Une maison se prend aussi, debout ou en ruine : le village se range.
      const maison = this.maisons.en(x, y);
      if (!maison) return;
      this.deplacee = maison;
      this.fantome.setTexture(maison.texture.key).setOrigin(0).setVisible(true);
      this.events.emit("annonce", `${maison.nom} en main — clic pour la reposer`, "toi");
      return;
    }
    if (prise === this.tourDuHero) this.tourDuHero = null;
    this.deplacee = prise;
    this.fantome
      .setTexture(
        textureDe(prise.def, {
          matiere: prise.matiere,
          masque: prise.masque,
          position: prise.position,
          pontLevis: prise.pontLevis,
        }),
      )
      .setOrigin(0.5, origineDe(prise.def))
      .setVisible(true);
    this.events.emit("annonce", `${prise.def.nom} en main — clic pour la reposer`, "toi");
  }

  /**
   * L'apercu suit la souris, aimante sur la case.
   *
   * Vert : c'est posable. Rouge : ca ne l'est pas — terrain qui ne porte pas,
   * case deja prise, trop pres de l'eglise ou du port, ou pas de quoi payer. Le
   * joueur n'a jamais a deviner pourquoi son clic ne fait rien.
   */
  majFantome(this: ArenaScene): void {
    if (!this.enConstruction && !this.deplacee) return;

    const pointeur = this.input.activePointer;
    const monde = this.cameras.main.getWorldPoint(pointeur.x, pointeur.y);
    const centre = this.grille.centreDe(monde.x, monde.y);

    // La cour : son emprise se cale comme celle d'une maison, coin haut-gauche.
    if (this.enConstruction === "cour") {
      const possible = this.cour.refus(monde.x, monde.y, this.village.stocks) === null;
      // Son origine est son coin **bas**-gauche : le pied tombe donc une case
      // plus bas que la case visee, exactement comme a la pose.
      this.fantome.setPosition(
        this.grille.colonneDe(monde.x) * CASE,
        (this.grille.ligneDe(monde.y) + EMPRISE_COUR.lignes) * CASE,
      );
      this.fantome.setTint(possible ? 0x7ee0a0 : 0xff6b5a);
      return;
    }

    // Une maison : l'emprise de 2 x 2 se cale sur la case visee, coin haut-gauche.
    if (this.deplacee instanceof Maison || this.enConstruction === "maison") {
      const possible =
        this.deplacee instanceof Maison
          ? this.maisons.peutAller(this.deplacee, monde.x, monde.y)
          : this.maisons.possible(monde.x, monde.y, this.village.stocks);
      this.fantome.setPosition(this.grille.colonneDe(monde.x) * CASE, this.grille.ligneDe(monde.y) * CASE);
      this.fantome.setTint(possible ? 0x7ee0a0 : 0xff6b5a);
      return;
    }

    // Deplacer ne coute rien : on ne juge donc que le terrain et la place, sans
    // regarder les stocks (§4.24). Les juger ferait refuser un deplacement
    // gratuit faute d'argent, ce qui n'aurait aucun sens.
    const possible = this.deplacee
      ? this.grille.constructible(centre.x, centre.y, true) &&
        !this.grille.aProximite(
          centre.x,
          centre.y,
          CASES_LIBRES_AUTOUR_DES_BATIMENTS,
          IMPOSENT_UNE_DISTANCE,
        )
      : this.enConstruction === "champ"
        ? this.champs.possible(centre.x, centre.y, this.village.stocks)
        : this.constructions.possible(
            centre.x,
            centre.y,
            this.enConstruction as TypeConstruction,
            this.village.stocks,
          );

    this.fantome.setPosition(centre.x, centre.y);
    this.fantome.setTint(possible ? 0x7ee0a0 : 0xff6b5a);

    // L'apercu montre deja ses raccords : un mur qu'on s'apprete a poser entre
    // deux autres apparait relie aux deux (§4.30). La cle ne change qu'au
    // passage d'une case a l'autre — Phaser ne fait rien si elle est la meme.
    const tenue = this.deplacee instanceof Construction ? this.deplacee : null;
    const def =
      tenue?.def ??
      (this.enConstruction !== "champ" ? CONSTRUCTIONS[this.enConstruction as TypeConstruction] : null);
    if (def && def.id !== "tour") {
      const douve = def.id === "douve";
      const masque = douve ? this.constructions.masqueDouveEn(centre.x, centre.y) : this.constructions.masqueEn(centre.x, centre.y);
      this.fantome.setTexture(
        textureDe(def, {
          matiere: tenue?.matiere ?? "bois",
          masque,
          position: tenue?.position ?? (this.constructions.portesFermees ? "fermee" : "ouverte"),
          pontLevis: tenue?.pontLevis ?? false,
          douve: "seche",
        }),
      );
    }
  }

  batirIci(this: ArenaScene, x: number, y: number): boolean {
    if (!this.enConstruction) return false;

    // L'outil douve sur une douve : on la remplit d'eau (§4.20, bloc 7b).
    if (this.enConstruction === "douve") {
      const existante = this.constructions.en(x, y);
      if (existante && existante.def.id === "douve") {
        const refus = this.constructions.refusRemplissage(existante, this.village.stocks);
        if (refus) this.events.emit("annonce", refus, "toi");
        else if (this.constructions.remplir(existante, this.village.stocks)) {
          eclatImpact(this, existante.x, existante.y, 0x8fb0c8);
          this.events.emit("annonce", "La douve se remplit — plus rien ne la franchit", "toi");
        }
        return true;
      }
    }

    // L'outil porte sur une porte qui a une douve en eau devant elle : elle
    // devient un pont-levis (§4.20, bloc 7b). Sinon, comme le mur, on renforce.
    if (this.enConstruction === "porte") {
      const existante = this.constructions.en(x, y);
      if (existante && existante.battant && !existante.pontLevis && !this.constructions.refusPontLevis(existante, this.village.stocks)) {
        this.constructions.convertirEnPontLevis(existante, this.village.stocks);
        eclatImpact(this, existante.x, existante.y, 0xd8c48a);
        this.events.emit("annonce", "Pont-levis — ferme, plus aucun passage ; ouvert, le tablier couvre la douve", "toi");
        return true;
      }
    }

    // L'outil palissade ou porte sur un segment qui existe deja : on le
    // renforce au lieu de le poser — segment par segment (§4.20).
    if (this.enConstruction === "palissade" || this.enConstruction === "porte") {
      const existante = this.constructions.en(x, y);
      if (existante && existante.def.id === this.enConstruction) {
        const refus = this.constructions.refusAmelioration(existante, this.village.stocks);
        const matiere = refus ? null : this.constructions.ameliorer(existante, this.village.stocks, this.time.now);
        if (matiere) {
          eclatImpact(this, existante.x, existante.y, 0xd8c48a);
          this.events.emit("annonce", `${existante.def.nom} passee au ${matiere} — ${existante.pvMax} PV`, "toi");
        } else {
          this.events.emit("annonce", refus ?? "Impossible de renforcer ici", "toi");
        }
        return true;
      }
    }

    const pose =
      this.enConstruction === "champ"
        ? this.champs.semer(x, y, this.village.stocks)
        : this.enConstruction === "maison"
          ? this.maisons.batir(x, y, this.village.stocks)
          : this.enConstruction === "cour"
            ? this.cour.batir(x, y, this.village.stocks)
            : this.constructions.batir(x, y, this.enConstruction, this.village.stocks, this.time.now);

    if (!pose) {
      // Le refus dit ce qui cloche, comme celui de l'eglise (§4.22, §4.24). Un
      // clic qui ne fait rien sans expliquer pourquoi est la facon la plus sure
      // de rendre une interface de pose penible.
      const raison =
        this.enConstruction === "champ"
          ? "Impossible de semer ici"
          : this.enConstruction === "maison"
            ? (this.maisons.refus(x, y, this.village.stocks) ?? "Impossible de batir ici")
            : this.enConstruction === "cour"
              ? (this.cour.refus(x, y, this.village.stocks) ?? "Impossible de batir ici")
              : (this.constructions.refus(x, y, this.enConstruction, this.village.stocks) ??
                "Impossible de poser ici");
      this.events.emit("annonce", raison, "toi");
      return true;
    }

    eclatImpact(this, pose.x, pose.y, 0xd8c48a);
    if (this.enConstruction === "cour") {
      this.events.emit(
        "annonce",
        "La cour est ouverte — il lui faut un milicien pour instruire",
        "toi",
      );
      return true;
    }
    // Un chantier attend des bras, et il faut le dire une fois : sans
    // charpentier affecte, l'echafaudage reste dresse pour toujours et le
    // joueur croirait a un bug (§4.20, bloc 8).
    this.prevenirQuIlFautUnBatisseur();
    return true;
  }

  /**
   * « Il faudra quelqu'un pour le monter. »
   *
   * Dit **une seule fois par journee**, et seulement quand personne n'est
   * charpentier : une annonce a chaque segment pose serait un bruit de fond.
   */
  prevenirQuIlFautUnBatisseur(this: ArenaScene): void {
    if (this.batisseurAnnonce === this.cycle.jour) return;
    const batisseurs = this.village.habitants.filter(
      (v) => v.regles.vivant && v.regles.metier === "charpentier",
    );
    if (batisseurs.length > 0) return;
    this.batisseurAnnonce = this.cycle.jour;
    this.events.emit(
      "annonce",
      "Rien ne se monte sans charpentier — Tab, puis « A l'atelier »",
      "toi",
    );
  }

  /**
   * Monter dans une tour, ou en descendre (DESIGN.md §4.20).
   *
   * La tour ne tire pas : elle donne une position. Le heros y gagne de la portee
   * et devient intouchable au corps a corps — mais il ne peut plus bouger, et
   * l'autre front n'est plus couvert. C'est le troc, et il est entier.
   */
  basculerTour(this: ArenaScene): void {
    const hero = this.hero;
    if (!hero || hero.etat === "mort") return;

    if (this.tourDuHero) {
      this.descendreDeTour();
      return;
    }

    const tour = this.constructions.tourLibre(hero.x, hero.y, PORTEE_OCCUPATION);
    if (!tour) {
      this.events.emit("annonce", "Aucune tour libre a portee", "toi");
      return;
    }

    tour.occupant = hero;
    this.tourDuHero = tour;
    hero.setPosition(tour.x, tour.y + OCCUPANT_TOUR_Y);
    hero.setVelocity(0, 0);
    // Intouchable au corps a corps : ce n'est pas une invulnerabilite, c'est de
    // la hauteur. Les monstres s'en prendront a la tour.
    hero.body!.enable = false;
    hero.porteeTour = tour.def.bonusPortee;
    hero.setDepth(tour.depth + 1);
    this.events.emit("annonce", `${hero.personne.nom} monte en tour — T pour descendre`, "toi");
  }

  descendreDeTour(this: ArenaScene): void {
    const tour = this.tourDuHero;
    if (!tour) return;

    const hero = tour.occupant as Hero | null;
    this.tourDuHero = null;
    tour.occupant = null;
    if (!hero) return;

    hero.body!.enable = true;
    hero.porteeTour = 0;
    hero.setPosition(tour.x, tour.y + 26);
  }

  /**
   * La tour vient de tomber : son occupant tombe avec elle.
   *
   * Sonne, a terre, au milieu d'eux — c'est ce qui empeche la tour d'etre une
   * cachette (§4.20).
   */
  ejecterDeLaTour(this: ArenaScene, tour: Construction): void {
    const occupant = this.constructions.detruire(tour);
    if (!occupant) return;

    if (occupant === this.tourDuHero?.occupant) this.tourDuHero = null;
    const hero = occupant as Hero;
    hero.body!.enable = true;
    hero.porteeTour = 0;
    hero.setPosition(tour.x, tour.y + 20);
    recul(hero, tour.x, tour.y, this.time.now, 220);
    this.encaisser(hero, Math.round(hero.pvMax * 0.15), tour.x, tour.y, 0xbfae8a);
    this.events.emit("annonce", "La tour cede !", "guet");
  }
}
