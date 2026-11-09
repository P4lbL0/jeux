import { Rng } from "../../core/rng";
import {
  QUESTION_DU_GARDIEN,
  REGLAGES_MARCHE,
  REPONSE_AU_REFUS,
  annonceDArrivee,
  annonceDeRoute,
  capVers,
  longueurDeLaMarche,
  paroleDuGardien,
  risqueDAttaque,
} from "../../core/marche";
import { Parcours } from "../../core/parcours";
import { Ennemi, Hero, orienter, SEUIL_REGARD_PIXELS } from "../../game/entities";
import { ARCHETYPE_HUMAIN } from "../../game/ennemis";
import { type Point } from "../../core/ordres";
import { dansLeVillage, mondeCourant, PRATICABLE, VILLAGE } from "../../core/carte";
import { type Villageois } from "../../game/village";
import { CASE, Grille, type Case } from "../../core/grille";
import type { ArenaScene } from "../ArenaScene";
import {
  ZOOM_MAX,
  ZOOM_DEFAUT,
  DUREE_DU_VOILE,
  PERIODE_CHEMIN_DES_HUMAINS,
  PUISSANCE_DES_HABITANTS,
  DISTANCE_D_ARMEMENT,
} from "./reglages";

/**
 * La marche (§4.29) : on paraît seul au bord du monde, on marche jusqu'à la porte, un
 * habitant vient poser sa question, et refuser se paie.
 *
 * Une part d'`ArenaScene`, greffée sur son prototype (`greffer`) : `this` est la scène.
 */
export class ArenaMarche {

  /**
   * On parait loin, seul, et on marche (DESIGN.md §4.29).
   *
   * **Rien de ce qui appartient au Protecteur ne tourne encore** : le cycle est
   * a l'arret (donc ni horde, ni nuit, ni arrivant, ni survivant, ni navire),
   * et on n'enregistre pas — il n'y a pas encore de partie a sauver. Le village,
   * lui, vit : c'est exactement ce qu'on vient voir de loin avant de repondre.
   *
   * La seule aide est une **direction**, en une phrase. La minimap a ete
   * ecartee (§4.10) : chercher fait partie du chemin.
   */
  commencerLaMarche(this: ArenaScene): void {
    const monde = mondeCourant();
    const cap = capVers(this.departDeLaMarche, monde.village);
    console.log(
      `[marche] monde n${this.marches + 1} · ${this.refus} refus · ${this.mondesMuets} monde(s) muet(s) restant(s) · ${Math.round(longueurDeLaMarche(monde, this.departDeLaMarche))} px ${cap}`,
    );

    this.prochaineArriveeJournee = null;
    // ⚠️ **Le ciel du monde qu'on traverse** (§4.21) : un tirage par monde, et
    // pas un par journee — sur la route le cycle est a l'arret, l'aube
    // n'arrive jamais. Rien n'y pousse, donc seul le rendu tourne ; mais
    // marcher sous la pluie vers une fumee a l'horizon est exactement le debut
    // de partie que le §4.29 demande.
    this.meteo.passerLaJournee(this.rng);
    // village, on dit la route. Le cap reste, sinon on tournerait en rond.
    this.events.emit(
      "annonce",
      this.villageMuet ? annonceDeRoute(cap) : annonceDArrivee(cap),
      "toi",
    );
    // Ce que le monde a laisse derriere lui (§4.31) : les caches se sement ici,
    // une fois qu'on sait ou l'on parait — c'est ce point-la qu'elles evitent.
    this.semerLesTrouvailles();
    this.reposerLesCompagnons();
    this.semerLeSurvivantDeRoute();
    this.dezoomerALEntree();
  }

  /**
   * L'entree en jeu : tres zoomee sur le heros, puis la camera dezoome seule
   * (DESIGN.md §4.10, tranche le 9 septembre 2026).
   *
   * ⚠️ **C'est le seul mouvement de camera automatique du jeu.** Le §4.11
   * verrouille le zoom libre : on ne prend la camera au joueur qu'une fois, au
   * moment ou il n'a encore rien a faire. Un coup de molette pendant le
   * mouvement l'annule — c'est sa camera, pas la notre.
   */
  dezoomerALEntree(this: ArenaScene): void {
    const cam = this.cameras.main;
    // ⚠️ **L'entree ceremonieuse n'a lieu qu'une fois.** Le zoom d'ouverture
    // raconte « tu tombes quelque part » : c'est bien la premiere fois, et
    // c'est une corvee de trois secondes la dixieme. Des qu'on enchaine un
    // monde, on entre au zoom de jeu, derriere le meme voile court qu'a la
    // sortie — un pas, pas une scene.
    const premier = this.marches === 0;
    cam.setZoom(premier ? ZOOM_MAX : ZOOM_DEFAUT);
    cam.fadeIn(premier ? 700 : DUREE_DU_VOILE, 0, 0, 0);
    if (!premier) return;
    this.entreeCamera = this.tweens.add({
      targets: cam,
      zoom: ZOOM_DEFAUT,
      duration: 2600,
      delay: 900,
      ease: "Sine.easeInOut",
      onComplete: () => (this.entreeCamera = null),
    });
  }

  /**
   * La marche, une fois par image : on regarde la porte, et on regarde le bord.
   *
   * Trois moments seulement, et ils s'excluent : quelqu'un vient vers nous, ou
   * on est assez pres d'une porte pour qu'on nous voie, ou on s'en va.
   */
  majMarche(this: ArenaScene): void {
    if (!this.enMarche || this.quitteLeMonde) return;
    const hero = this.hero;
    if (!hero || hero.etat === "mort") return;

    if (this.gardien) {
      this.menerLeGardien(hero);
      return;
    }
    if (!this.rencontreFaite) this.guetterLaPorte(hero);
    this.guetterLeDepart(hero);
  }

  /** La porte la plus proche d'un point, en pixels du monde ; `null` s'il n'y en a aucune. */
  porteLaPlusProche(this: ArenaScene, x: number, y: number): Point | null {
    let choisie: Point | null = null;
    let meilleure = Infinity;
    for (const piece of this.planVillage.enceinte) {
      if (piece.piece !== "porte") continue;
      const centre = Grille.centreCase(piece.colonne, piece.ligne);
      const d = Math.hypot(centre.x - x, centre.y - y);
      if (d < meilleure) {
        meilleure = d;
        choisie = centre;
      }
    }
    return choisie;
  }

  /**
   * Est-on assez pres pour qu'on nous voie ? (§4.29, 20 septembre au soir)
   *
   * **On ne s'installe pas dans un village : on se presente a sa porte.** Dix
   * cases avant, quelqu'un lache ce qu'il fait et vient vers nous.
   */
  guetterLaPorte(this: ArenaScene, hero: Hero): void {
    // ⚠️ **Un monde muet ne pose aucune question** (§4.29). Sans ce garde, le
    // village vide tomberait sur la branche « personne ne vient » et nous
    // installerait dans des ruines — exactement ce qu'on veut traverser.
    if (this.villageMuet) return;
    const porte = this.porteLaPlusProche(hero.x, hero.y);
    const cible = porte ?? { x: VILLAGE.x, y: VILLAGE.y };
    const marge = porte ? 0 : VILLAGE.rayon;
    const vu = Math.hypot(cible.x - hero.x, cible.y - hero.y) <= REGLAGES_MARCHE.vue + marge;
    // ⚠️ **Ou dans le village, meme sans porte.** Une enceinte trouee se
    // traverse par une breche, et un village ou l'on entre sans que personne ne
    // vienne serait un village vide. On se presente a la porte quand il y en a
    // une devant nous ; sinon, c'est d'etre entre qui nous annonce.
    if (!vu && !dansLeVillage(hero.x, hero.y)) return;

    // ⚠️ **Le champ de directions d'abord, celui qui vient ensuite.** Vu en
    // jeu : l'habitant le plus proche a vol d'oiseau etait de l'autre cote du
    // mur et mettait vingt secondes a faire le tour, pendant qu'un autre,
    // dehors, nous regardait. On les compare donc en **pas de chemin**, ce que
    // le champ sait deja dire.
    this.tracerLeCheminDesHumains(hero);
    const chemin = this.cheminDesHumains!;
    const gardien = this.village.appelerQuelquun(hero.x, hero.y, (v) => {
      const pas = chemin.pasDepuis(v.x, v.y);
      return pas < 0 ? Infinity : pas;
    });
    this.rencontreFaite = true;
    if (!gardien) {
      // Personne pour repondre : il n'y a plus de village a proteger, il n'y a
      // qu'un endroit ou s'installer. Ca ne se produit pas au depart — trois
      // habitants sont toujours la — mais la marche ne doit pas rester bloquee.
      this.events.emit("annonce", "Personne ne vient. Ce village n'a plus de voix.", "toi");
      this.sInstaller(false);
      return;
    }

    gardien.etat = "parle";
    this.gardien = gardien;
    this.events.emit("annonce", `${gardien.nom} sort du village et vient vers toi`, "village");
  }

  /**
   * Ou un habitant peut poser le pied.
   *
   * ⚠️ **Ce n'est pas `passeUnMonstre`, et l'ecart est tout le sujet** : un
   * monstre traverse la liste des murs parce qu'il les **frappe** (§4.6) ;
   * celui qui vient nous parler, lui, sort par la porte. Un mur, une tour, une
   * maison, un batiment l'arretent — la porte, une ruine et un champ non.
   */
  passeUnVillageois(this: ArenaScene, c: Case): boolean {
    if (c.terrain !== "sable" && c.terrain !== "herbe" && c.terrain !== "sous-bois") return false;
    if (c.occupation === "mur" || c.occupation === "tour") return false;
    if (c.occupation === "batiment" || c.occupation === "maison") return false;
    if (c.occupation !== "douve-eau") return true;
    const douve = this.constructions.en(c.colonne * CASE + CASE / 2, c.ligne * CASE + CASE / 2);
    return douve !== null && (douve.pont || douve.enjambee);
  }

  /**
   * Le champ de directions qui mene le gardien jusqu'a nous.
   *
   * ⚠️ **Il en faut un, la ligne droite ne suffit pas** : vu en jeu — il
   * sortait de sa maison, marchait droit sur nous et restait colle au mur
   * pendant vingt secondes, velocite a fond et position figee. C'est le meme
   * probleme que les monstres depuis le §4.29, et la meme reponse
   * (`parcours.ts`), avec sa regle a lui : un habitant contourne les murs au
   * lieu de les frapper.
   *
   * Il se refait **quand on s'est deplace**, pas par image (§4.17).
   */
  tracerLeCheminDesHumains(this: ArenaScene, hero: Hero): void {
    this.cheminDesHumains ??= new Parcours(this.grille);
    this.cibleDesHumains = { x: hero.x, y: hero.y };
    this.prochainCheminDesHumains = this.time.now + PERIODE_CHEMIN_DES_HUMAINS;
    this.cheminDesHumains.recalculer(this.cibleDesHumains, (c) => this.passeUnVillageois(c));
  }

  /**
   * Le champ suit le heros, mais **par battements** (§4.17 regle 5).
   *
   * Une propagation balaye toute la grille : la refaire a chaque image pendant
   * qu'on court serait exactement l'ajout non plafonne que le §4.17 interdit.
   * Un tiers de seconde, et seulement si l'on a vraiment bouge — entre deux, un
   * humain suit le dernier champ, ce qui le mene de toute facon vers la porte.
   */
  suivreLeHeroDesHumains(this: ArenaScene): void {
    if (!this.cheminDesHumains) return;
    if (this.humainsEnFace === 0 && !this.gardien) return;
    const hero = this.hero;
    if (!hero || hero.etat === "mort") return;
    if (this.time.now < this.prochainCheminDesHumains) return;
    if (Math.hypot(hero.x - this.cibleDesHumains.x, hero.y - this.cibleDesHumains.y) < 120) return;
    this.tracerLeCheminDesHumains(hero);
  }

  /** Il marche vers nous, et il parle quand il y est. */
  menerLeGardien(this: ArenaScene, hero: Hero): void {
    const gardien = this.gardien;
    if (!gardien || !gardien.regles.vivant) {
      this.gardien = null;
      return;
    }

    const d = Math.hypot(hero.x - gardien.x, hero.y - gardien.y);
    if (d > REGLAGES_MARCHE.parole) {
      this.suivreLeHeroDesHumains();
      const chemin = this.cheminDesHumains;
      // Droit sur nous quand la voie est libre, le champ sinon — la meme regle
      // qu'un monstre qui contourne un lac (§4.29).
      const droit =
        chemin === null || chemin.ligneLibre(gardien, hero, (c) => this.passeUnVillageois(c));
      const vers = droit
        ? { x: (hero.x - gardien.x) / d, y: (hero.y - gardien.y) / d }
        : chemin.direction(gardien.x, gardien.y);
      if (vers) {
        gardien.setVelocity(vers.x * REGLAGES_MARCHE.vitesse, vers.y * REGLAGES_MARCHE.vitesse);
      } else {
        // Aucun chemin : il ne peut pas nous rejoindre (on est de l'autre cote
        // d'un lac). Il parle de la ou il est plutot que de pietiner.
        gardien.setVelocity(0, 0);
        this.ouvrirLaRencontre(gardien);
      }
      return;
    }

    gardien.setVelocity(0, 0);
    orienter(gardien, hero.x - gardien.x, SEUIL_REGARD_PIXELS);
    this.ouvrirLaRencontre(gardien);
  }

  ouvrirLaRencontre(this: ArenaScene, gardien: Villageois): void {
    const parole = paroleDuGardien(this.villageVuDeLoin, new Rng(this.graineMonde + 1));

    this.enPause = true;
    this.debutPause = this.time.now;
    this.physics.pause();
    this.anims.pauseAll();
    this.effacerDestination();
    this.events.emit("rencontre", {
      nom: gardien.nom,
      lignes: parole,
      // Ce que ce monde vaut, annonce avant d'entrer (§4.29, le budget).
      augure: this.augureDuMonde,
      question: QUESTION_DU_GARDIEN,
    });
  }

  /**
   * La reponse (§4.29, 20 septembre 2026 au soir).
   *
   * ⚠️ **Refuser ne coute encore rien, et c'est une dette assumee.** Le design
   * dit qu'un village qu'on laisse mourir peut se jeter sur nous, tous
   * ensemble : ca demande des humains hostiles, donc de l'or et de
   * l'experience sur leurs cadavres, donc les deux traits du §4.23 qui
   * regardent qui est en face. C'est le morceau suivant, pas celui-ci.
   */
  repondreALaRencontre(this: ArenaScene, accepte: boolean): void {
    // Le panneau sert aux deux (§4.31) : c'est ici qu'on sait duquel il s'agit,
    // exactement comme `repondreALaPorte` demele la porte et le sauvetage.
    if (this.steleOuverte !== null) {
      this.repondreALaStele(accepte);
      return;
    }
    this.reprendreLeJeu();

    const gardien = this.gardien;
    this.gardien = null;
    if (gardien) {
      gardien.setVelocity(0, 0);
      gardien.etat = "en-route";
    }

    if (accepte) {
      this.sInstaller(true);
      return;
    }

    // ⚠️ **Refuser en face n'est pas passer au large** (§4.29). Des gens qu'on
    // laisse mourir n'ont plus rien a perdre : ils peuvent se jeter sur nous,
    // tous ensemble. Le risque monte avec leur desespoir, et il n'est **jamais**
    // certain — sinon plus personne ne refuserait en face, et la decision
    // disparaitrait.
    const vue = this.villageVuDeLoin;
    const risque = risqueDAttaque(vue);
    // Tire sur la graine du monde : leur desespoir est une propriete de ce
    // village-la, pas de la seconde ou l'on a clique.
    const tirage = new Rng(this.graineMonde + 2).next();
    console.log(`[marche] refus : risque ${risque.toFixed(2)}, tirage ${tirage.toFixed(2)}`);
    if (tirage < risque) {
      this.leVillageSeJetteSurNous();
      return;
    }

    this.events.emit("annonce", REPONSE_AU_REFUS.paix, "village");
    this.events.emit(
      "annonce",
      "Tu as dit non. Reprends la route — le prochain est plus loin.",
      "toi",
    );
  }

  /**
   * Ils se jettent sur nous, tous ensemble (DESIGN.md §4.29, 20 septembre 2026).
   *
   * Le village se **vide** : chaque habitant vivant repasse de l'autre cote,
   * avec son visage et son nom. Ce n'est pas une horde de plus — c'est ce qu'il
   * restait de gens qui viennent de comprendre que personne ne viendra.
   *
   * ⚠️ **On ne pourra plus s'installer ici**, et c'est le prix : un village
   * qu'on a saigne n'a plus personne a proteger. On se bat, on survit, et on
   * reprend la route par un bord de la carte.
   */
  leVillageSeJetteSurNous(this: ArenaScene): void {
    const partants = this.village.prendreLesArmes();
    if (partants.length === 0) return;

    for (const partant of partants) {
      const enrage = new Ennemi(this, partant.x, partant.y, PUISSANCE_DES_HABITANTS, ARCHETYPE_HUMAIN, {
        famille: partant.famille,
        nom: partant.nom,
      });
      this.ennemis.add(enrage);
      this.humainsEnFace += 1;
    }
    // Ils sortent par la porte, pas par le mur : le champ des humains est celui
    // qui a amene celui qui venait parler, et il sert maintenant contre nous.
    this.tracerLeCheminDesHumains(this.hero);

    this.events.emit("annonce", REPONSE_AU_REFUS.attaque, "village");
    this.events.emit(
      "annonce",
      partants.length > 1
        ? `${partants.length} habitants se jettent sur toi`
        : `${partants[0]!.nom} se jette sur toi`,
      "guet",
    );
    this.musique.combat();
  }

  /**
   * On s'en va : par n'importe quel bord, et le monde d'apres est un autre
   * monde (§4.29, « on ne revient jamais en arriere »).
   *
   * ⚠️ La sortie ne s'arme qu'une fois qu'on s'est eloigne de la ou l'on a
   * paru : on nait a quarante pixels d'un bord, et repartir dans la seconde
   * n'est pas un choix, c'est un accident de geometrie.
   */
  guetterLeDepart(this: ArenaScene, hero: Hero): void {
    if (!this.sortieArmee) {
      const parcouru = Math.hypot(
        hero.x - this.departDeLaMarche.x,
        hero.y - this.departDeLaMarche.y,
      );
      if (parcouru > DISTANCE_D_ARMEMENT) this.sortieArmee = true;
      return;
    }

    const bord = 48;
    const dedans =
      hero.x > PRATICABLE.x + bord &&
      hero.x < PRATICABLE.x + PRATICABLE.largeur - bord &&
      hero.y > PRATICABLE.y + bord &&
      hero.y < PRATICABLE.y + PRATICABLE.hauteur - bord;
    if (dedans) return;

    this.passerAuLarge();
  }
}
