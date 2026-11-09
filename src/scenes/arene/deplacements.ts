import Phaser from "phaser";
import { REGLAGES_EAU, profondeurDe } from "../../core/eau";
import { RAYON_VOISINAGE } from "../../game/dessin/chemins";
import { Hero, orienter, SEUIL_REGARD } from "../../game/entities";
import { piloter, type ContexteIA } from "../../core/ia";
import { EGLISE, terrainEn, type Terrain } from "../../core/carte";
import { CASE, COLONNES, LIGNES, type Case } from "../../core/grille";
import { ArenaScene } from "../ArenaScene";
import { CITE, LISSAGE_DIRECTION } from "./reglages";

/**
 * Se déplacer : l'eau, le terrain, les chemins des monstres, le héros incarné et les
 * héros de l'IA.
 *
 * Une part d'`ArenaScene`, greffée sur son prototype (`greffer`) : `this` est la scène.
 */
export class ArenaDeplacements {

  // -------------------------------------------------------------- l'eau

  /**
   * Le heros incarne est le seul a pouvoir entrer dans l'eau (§4.30) : ses
   * limites s'etendent jusqu'au bord ouest du monde. L'abysse le rejette
   * (`majEau`), la mer le noie — c'est la regle, pas un mur.
   */
  ouvrirLaMerAuHero(this: ArenaScene, hero: Hero): void {
    // L'eau ne l'arrete plus : c'est le collisionneur du terrain qui le laisse
    // passer (`dresserLeTerrain`), lui seul. L'abysse le rejette (`majEau`),
    // la mer le noie — c'est la regle, pas un mur.
    this.noyade.reinitialiser();
    this.dernierePositionTenable = { x: hero.x, y: hero.y };
  }

  /** Un heros qu'on ne pilote plus ressort de l'eau. */
  quitterLEau(this: ArenaScene, hero: Hero): void {
    hero.facteurEau = 1;
    hero.enfoncer(0);
    this.noyade.reinitialiser();
  }

  /**
   * L'eau profonde et la roche arretent les corps (§4.6, §4.29).
   *
   * Un corps statique invisible par **plage de cases** — une rangee de roche
   * d'un seul tenant fait un seul corps, pas trente — pour la mer, les lacs,
   * l'eboulis et la roche. Le haut-fond ne compte pas : on y patauge. Le heros
   * incarne, et lui seul, traverse l'eau (§4.30 : « personne ne nage », mais
   * on s'enfonce) ; personne ne traverse la roche.
   */
  dresserLeTerrain(this: ArenaScene): void {
    this.obstaclesDEau = this.physics.add.staticGroup();
    this.obstaclesDeRoche = this.physics.add.staticGroup();
    const eau: Terrain[] = ["mer", "abysse"];
    const roche: Terrain[] = ["eboulis", "roche"];
    for (const [sols, groupe] of [
      [eau, this.obstaclesDEau],
      [roche, this.obstaclesDeRoche],
    ] as const) {
      for (let ligne = 0; ligne < LIGNES; ligne++) {
        let debut = -1;
        for (let colonne = 0; colonne <= COLONNES; colonne++) {
          const c = colonne < COLONNES ? this.grille.case(colonne, ligne) : null;
          const dedans = c !== null && sols.includes(c.terrain);
          if (dedans && debut < 0) debut = colonne;
          if (!dedans && debut >= 0) {
            const largeur = (colonne - debut) * CASE;
            const zone = this.add.zone(debut * CASE + largeur / 2, ligne * CASE + CASE / 2, largeur, CASE);
            groupe.add(zone);
            debut = -1;
          }
        }
      }
    }
    const saufLeHerosIncarne: Phaser.Types.Physics.Arcade.ArcadePhysicsCallback = (a, b) => {
      const hero = (a instanceof Hero ? a : b) as Hero;
      return !hero.estIncarne;
    };
    this.physics.add.collider(this.equipe, this.obstaclesDEau, undefined, saufLeHerosIncarne);
    this.physics.add.collider(this.equipe, this.obstaclesDeRoche);
    // Les monstres, eux, butent sur l'eau et la roche dans `buterContreLeDecor`.
    // Les habitants sont branches plus tard, avec les autres collisions du
    // village : il n'existe pas encore ici.
  }

  /**
   * Ce qu'un monstre traverse a pied : la terre ferme, sauf une douve en eau.
   * Les murs passent — il les frappe. Une douve devant un pont-levis passe
   * aussi, tablier leve ou non : c'est la qu'il vient attendre, et c'est la
   * qu'il faut le voir (§4.20).
   */
  passeUnMonstre(this: ArenaScene, c: Case): boolean {
    // Le haut-fond passe : on y patauge, et c'est par la qu'un monstre
    // contourne un mur qui s'arrete au sable — d'ou les murs dans l'eau.
    if (c.terrain !== "sable" && c.terrain !== "herbe" && c.terrain !== "sous-bois" && c.terrain !== "haut-fond") return false;
    if (c.occupation !== "douve-eau") return true;
    const douve = this.constructions.en(c.colonne * CASE + CASE / 2, c.ligne * CASE + CASE / 2);
    return douve !== null && (douve.pont || douve.enjambee);
  }

  /** Le champ de directions vers l'eglise : a la pose, jamais par image (§4.17). */
  recalculerLeParcours(this: ArenaScene): void {
    this.parcours.recalculer(EGLISE, (c) => this.passeUnMonstre(c));
  }

  /**
   * L'eau qui noie, a chaque image hors pause (§4.30, tranche le 9 septembre
   * 2026) : on s'enfonce (vitesse et image), une bulle previent en entrant
   * dans la mer, une seconde insiste, et au bout de trois secondes on se noie.
   * Jamais une mort surprise — et ressortir remet tout a zero.
   */
  /**
   * Les chemins qui s'usent (§4.24) : un pas de plus la ou chaque habitant et
   * chaque heros vient d'entrer. Par battements de 250 ms — un marcheur
   * traverse une case en plus longtemps que ca, et trente marcheurs reveilles
   * a chaque image se sentiraient.
   */
  majChemins(this: ArenaScene): void {
    const maintenant = this.time.now;
    if (maintenant < this.prochainBattementChemins) return;
    this.prochainBattementChemins = maintenant + ArenaScene.PERIODE_CHEMINS;
    const jour = this.cycle.jour;
    const marcher = (marcheur: { x: number; y: number }) => {
      const changement = this.chemins.passer(marcheur, marcheur.x, marcheur.y, jour);
      if (!changement) return;
      const { cas } = changement;
      this.coucheChemins.redessiner(cas, this.chemins.autour(cas.x, cas.y, RAYON_VOISINAGE), jour);
    };
    for (const villageois of this.village.habitants) {
      if (villageois.regles.vivant && villageois.etat !== "abri") marcher(villageois);
    }
    for (const hero of this.heros) {
      if (hero.etat !== "mort") marcher(hero);
    }
  }

  majEau(this: ArenaScene, delta: number): void {
    const hero = this.hero;
    if (!hero || hero.etat === "mort") return;

    const profondeur = profondeurDe(terrainEn(hero.x, hero.y));
    if (profondeur === "abysse") {
      // Personne ne nage : le large n'est pas praticable, on y est rejete.
      hero.setPosition(this.dernierePositionTenable.x, this.dernierePositionTenable.y);
      hero.setVelocity(0, 0);
    } else {
      this.dernierePositionTenable = { x: hero.x, y: hero.y };
    }
    // Une douve seche ralentit comme un haut-fond ; l'eau du monde garde la main si elle est pire.
    hero.facteurEau = Math.min(
      REGLAGES_EAU.vitesse[profondeur === "abysse" ? "mer" : profondeur],
      this.constructions.ralentissement(hero.x, hero.y),
    );
    hero.enfoncer(REGLAGES_EAU.enfoncement[profondeur]);

    const bulle = this.noyade.avancer(delta, profondeur);
    if (bulle === "coule") {
      this.flotter(hero.x, hero.y - 26, "JE COULE !", "#ff8a7a");
      this.events.emit("annonce", "je coule — trois secondes et je me noie", "heros", hero.personne.nom);
    } else if (bulle === "se-noie") {
      this.flotter(hero.x, hero.y - 26, "JE ME NOIE !", "#ff3b30");
    } else if (bulle === "noye") {
      this.events.emit("annonce", "s'est noye", "heros", hero.personne.nom);
      hero.facteurEau = 1;
      hero.enfoncer(0);
      hero.pv = 0;
      this.tomber(hero);
    }
  }

  deplacerHeroIncarne(this: ArenaScene): void {
    // Le robot (jalon 6.4) pilote le heros incarne par l'IA, dans `deplacerHerosIA`.
    if (this.robot) return;
    const hero = this.hero;
    if (!hero || hero.etat === "mort") return;

    // Le recul d'un coup encaisse tient la main quelques images. Sans ce
    // passage, la vitesse du joueur, reecrite ici a chaque image, effacerait
    // l'impulsion avant qu'elle n'ait deplace quoi que ce soit.
    if (hero.estEnRecul) return;

    if (hero.estImmobilise) {
      hero.setVelocity(0, 0);
      return;
    }

    // On renomme quelqu'un : les lettres vont au champ, pas aux jambes. Le
    // heros s'arrete, il ne se fige pas — la partie, elle, continue (§4.18).
    if (this.saisieEnCours) {
      hero.setVelocity(0, 0);
      return;
    }

    const dir = new Phaser.Math.Vector2(0, 0);
    if (this.clavier.enfoncee("gauche")) dir.x -= 1;
    if (this.clavier.enfoncee("droite")) dir.x += 1;
    if (this.clavier.enfoncee("haut")) dir.y -= 1;
    if (this.clavier.enfoncee("bas")) dir.y += 1;

    if (dir.lengthSq() > 0) {
      this.effacerDestination();
    } else if (this.destination) {
      const distance = Phaser.Math.Distance.Between(
        hero.x,
        hero.y,
        this.destination.x,
        this.destination.y,
      );
      if (distance < 6) this.effacerDestination();
      else dir.set(this.destination.x - hero.x, this.destination.y - hero.y);
    }

    dir.normalize();
    if (dir.lengthSq() > 0) {
      hero.regard.copy(dir);
      orienter(hero, dir.x, SEUIL_REGARD);
    }
    hero.setVelocity(dir.x * hero.vitesse, dir.y * hero.vitesse);

    if (hero.estCritique && Math.floor(this.time.now / 140) % 2 === 0) hero.setAlpha(0.55);
  }

  deplacerHerosIA(this: ArenaScene): void {
    const contexte: ContexteIA = {
      cite: CITE,
      ennemiLePlusProche: (x, y, portee) => this.ennemiLePlusProche(x, y, portee),
      nombreEnnemisAutour: (x, y, rayon) => this.ennemisDansRayon(x, y, rayon).length,
    };

    for (const hero of this.heros) {
      if ((hero.estIncarne && !this.robot) || hero.etat === "mort") continue;
      // Un heros repousse subit son recul avant de reprendre sa course.
      if (hero.estEnRecul) continue;
      if (hero.estImmobilise) {
        hero.setVelocity(0, 0);
        continue;
      }

      const { direction, lancerUltime } = piloter(hero, contexte);

      // Le lissage : la direction va vers celle que l'IA demande sans y sauter.
      // `piloter()` reste franche et testable ; c'est l'affichage qui amortit.
      // Sans ca, un changement de cible au milieu d'une nuee fait faire
      // demi-tour en une image, et ca se lit comme un tremblement.
      const lisse = hero.directionLissee.lerp(
        new Phaser.Math.Vector2(direction.x, direction.y),
        LISSAGE_DIRECTION,
      );

      // Un heros qui decroche court plus vite : c'est ce qui rend le repli
      // credible plutot que suicidaire.
      const vitesse = hero.vitesse * (hero.etat === "repli" ? 1.35 : 1);
      hero.setVelocity(lisse.x * vitesse, lisse.y * vitesse);
      orienter(hero, lisse.x, SEUIL_REGARD);
      if (lisse.lengthSq() > 0.01) hero.regard.set(lisse.x, lisse.y);

      if (lancerUltime && hero.etat === "combat") {
        // L'IA lance la premiere capacite prete. Elle ne choisit jamais
        // d'amelioration, mais elle sait se servir de ce qu'elle a.
        const prete = hero.capacites.find((c) => !c.automatique && hero.peutLancer(c));
        if (prete) this.lancerCapacite(hero, prete);
      }
    }
  }
}
