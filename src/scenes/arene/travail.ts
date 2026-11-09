import Phaser from "phaser";
import { CLASSES } from "../../core/classes";
import { Hero } from "../../game/entities";
import { declencher } from "../../game/poses";
import {
  NOMS_VOIE,
  donQuiDormait,
  entrainer,
  porteurAReveiller,
  reveilGaranti,
  reveilParLeDanger,
  type VoieDuReveil,
} from "../../core/dons";
import { REGLAGES_COUR } from "../../game/cour";
import { POSTES } from "../../core/carte";
import { type Villageois } from "../../game/village";
import { NOMS_POSTURE_CIVILE, SOUS_PRODUIT, combatDe } from "../../core/habitants";
import { monterStress } from "../../core/personne";
import type { PostureCivile } from "../../core/habitants";
import type { ArenaScene } from "../ArenaScene";
import { RAYON_RECOLTE, RECOLTE_DU_POSTE, STRESS_DU_TRAVAIL, EFFECTIF_MAXIMUM } from "./reglages";

/**
 * Le travail : la récolte à la main, les héros au travail, et le village armé (§4.18,
 * bloc 9) — la cour, les dons qui s'éveillent, les postures et postes civils.
 *
 * Une part d'`ArenaScene`, greffée sur son prototype (`greffer`) : `this` est la scène.
 */
export class ArenaTravail {

  /**
   * Le joueur recolte lui-meme, a la main (DESIGN.md §4.18).
   *
   * Trois regles, et elles viennent toutes du design :
   *
   * - **seulement le jour.** Sans ca, on abandonnerait le combat pour aller
   *   couper du bois parce que c'est plus rentable, et un survivors-like ne
   *   survit pas a une corvee qui concurrence le combat ;
   * - **en frappant.** Aucune touche de plus, aucune barre de progression : on
   *   s'approche, et l'attaque automatique s'en charge ;
   * - **bien plus vite qu'un habitant**, et d'autant plus vite qu'on frappe
   *   fort. C'est le seul endroit du jeu ou une statistique de combat sert a
   *   autre chose qu'a se battre.
   */
  recolterALaMain(this: ArenaScene, delta: number): void {
    if (this.cycle.phase !== "jour") return;

    const hero = this.hero;
    if (hero.etat === "mort" || hero.estImmobilise) return;

    // S'occuper d'un champ, c'est le faire avancer vers la moisson. C'est ce qui
    // donne au joueur quelque chose a faire de ses 30 minutes de jour.
    const force = (hero.degats * delta) / 1000 / 400;
    if (this.champs.travaillerALaMain(hero.x, hero.y, force, this.village.stocks)) {
      if (this.time.now >= this.prochainGesteRecolte) {
        declencher(hero.pose, hero, "attaque", this.time.now);
        this.prochainGesteRecolte = this.time.now + 420;
      }
      return;
    }

    // Le fer du ciel (§4.21) : un gisement qui **s'epuise**, frappe comme un
    // poste de mine. Il ne rend que du minerai, jamais de pierre : c'est du
    // metal tombe du ciel, et c'est tout son interet.
    const gisement = this.cielQuiTombe.gisement;
    if (
      gisement &&
      Phaser.Math.Distance.Between(hero.x, hero.y, gisement.x, gisement.y) <= RAYON_RECOLTE
    ) {
      const pris = this.cielQuiTombe.extraire((hero.degats * delta) / 1000 / 8);
      if (pris > 0) {
        this.village.recolter("minerai", pris);
        this.cumulRecolte += pris;
        if (this.time.now >= this.prochainGesteRecolte) {
          declencher(hero.pose, hero, "attaque", this.time.now, gisement);
          this.prochainGesteRecolte = this.time.now + 420;
        }
        if (!this.cielQuiTombe.gisement) {
          this.pierreDuCiel?.destroy();
          this.pierreDuCiel = null;
          this.events.emit("annonce", "Le fer du ciel est tout entier rentre", "village");
        }
        return;
      }
    }

    for (const poste of POSTES) {
      // Les champs n'ont pas de gisement a frapper : c'est le carre de terre
      // lui-meme qu'on travaille, et c'est fait juste au-dessus.
      if (poste.metier === "fermier") continue;

      const distance = Phaser.Math.Distance.Between(
        hero.x,
        hero.y,
        poste.position.x,
        poste.position.y,
      );
      if (distance > RAYON_RECOLTE) continue;

      const ressource = RECOLTE_DU_POSTE[poste.metier];
      // La cadence suit ses degats : un heros qui tape fort abat plus de bois.
      const quantite = (hero.degats * delta) / 1000 / 8;
      this.village.recolter(ressource, quantite);
      this.cumulRecolte += quantite;
      // A la mine, la pierre vient avec le minerai, dans la meme part que pour
      // un mineur (§4.20, bloc 7b).
      const sous = SOUS_PRODUIT[poste.metier];
      if (sous) this.village.recolter(sous.ressource, quantite * sous.part);

      // Le geste, et le compte rendu — mais seulement de temps en temps : le
      // §4.17 interdit de fabriquer des textes en continu.
      if (this.time.now >= this.prochainGesteRecolte) {
        declencher(hero.pose, hero, "attaque", this.time.now, poste.position);
        this.prochainGesteRecolte = this.time.now + 420;
      }
      if (this.cumulRecolte >= 5) {
        this.flotter(hero.x, hero.y - 26, `+${Math.floor(this.cumulRecolte)}`, "#d8c48a");
        this.cumulRecolte = 0;
      }
      return;
    }

    this.cumulRecolte = 0;
  }

  /**
   * Les heros qu'on a mis au travail (DESIGN.md §4.4, bloc 8).
   *
   * Trois regles, et elles viennent toutes du design :
   *
   * - **il produit beaucoup plus vite qu'un habitant** : exactement la cadence
   *   du joueur a la main, ses degats divises par huit, par seconde. ~98 par
   *   minute contre 6 pour un habitant de rang F — un heros aux champs abat le
   *   travail de quinze villageois ;
   * - **seulement le jour**, comme la recolte a la main. La nuit, il lache son
   *   poste et redevient un combattant ;
   * - **ca le fatigue** : du stress par minute travaillee, donc un heros moins
   *   bon quand la nuit tombe (§4.23). C'est ce qui empeche « tout le monde a
   *   la peche ».
   *
   * ⚠️ **Le repli des 20 % passe avant tout**, sans exception : `piloter()`
   * traite le repli en premier et ignore l'ancre. Un heros au travail qui prend
   * un mauvais coup rentre, et son poste l'attend.
   *
   * L'affectation se pose comme une **ancre** plutot que comme un deplacement a
   * part : c'est ce qui lui laisse l'IA complete — il se defend contre ce qui
   * l'approche, il revient a son poste quand la pression retombe, et il n'y a
   * pas une deuxieme logique de deplacement a deboguer (§4.4).
   */
  travaillerLesHeros(this: ArenaScene, delta: number): void {
    const jour = this.cycle.phase === "jour";

    for (const hero of this.heros) {
      if (!hero.travail) continue;
      if (hero.estIncarne || hero.etat === "mort") continue;

      const poste = POSTES.find((p) => p.metier === hero.travail);
      if (!poste) continue;

      if (!jour) {
        // La nuit, il lache son poste — mais il garde son affectation : elle
        // le reprend a l'aube, sans que le joueur ait a la redonner.
        if (hero.ordre.ancre) hero.ordre = { ...hero.ordre, ancre: null };
        continue;
      }

      // L'ancre est reposee a chaque image : `Rompez` et un ordre du joueur la
      // retirent, et c'est `travail` qui reste la source de verite.
      const ancre = hero.ordre.ancre;
      if (!ancre) hero.ordre = { ...hero.ordre, ancre: { ...poste.position } };
      else if (!hero.protege) {
        ancre.x = poste.position.x;
        ancre.y = poste.position.y;
      }

      if (hero.etat !== "combat") continue;
      const distance = Phaser.Math.Distance.Between(
        hero.x,
        hero.y,
        poste.position.x,
        poste.position.y,
      );
      if (distance > RAYON_RECOLTE) continue;

      // Le fermier ne recolte rien : il fait **pousser** (§4.18). Un heros aux
      // champs travaille donc la terre, comme le joueur a la main.
      if (poste.metier === "fermier") {
        this.champs.travaillerALaMain(hero.x, hero.y, (hero.degats * delta) / 1000 / 400, this.village.stocks);
      } else {
        const ressource = RECOLTE_DU_POSTE[poste.metier as keyof typeof RECOLTE_DU_POSTE];
        if (!ressource) continue;
        const quantite = (hero.degats * delta) / 1000 / 8;
        this.village.recolter(ressource, quantite);
        const sous = SOUS_PRODUIT[poste.metier];
        if (sous) this.village.recolter(sous.ressource, quantite * sous.part);
      }

      // La fatigue. Le §4.4 parle d'une humeur « epuise » ; c'est du **stress**
      // et pas un etat de plus — la lethargie appartient a la faim et se
      // soignerait en mangeant, ce qu'un heros ne fait pas.
      monterStress(hero.personne, (STRESS_DU_TRAVAIL * delta) / 60000);

      if (this.time.now >= this.prochainGesteTravail) {
        declencher(hero.pose, hero, "attaque", this.time.now, poste.position);
        this.prochainGesteTravail = this.time.now + 420;
      }
    }
  }

  // ------------------------------------------- le village arme (§4.18, bloc 9)

  /**
   * Une journee passe a la cour d'entrainement (DESIGN.md §4.18, bloc 9).
   *
   * ⚠️ **Rien n'avance sans instructeur** : un milicien doit se tenir dans la
   * cour. C'est ce qui fait qu'armer son village le ralentit **deux fois** —
   * l'eleve ne produit rien, et l'instructeur non plus.
   *
   * Au bout de deux journees, on sait : soit il portait un don et il
   * transcende, soit il n'avait rien — et il a quand meme gagne du niveau de
   * combat. **L'essai n'est jamais perdu**, c'est ce qui rend la cour jouable
   * malgre un porteur sur dix.
   */
  passerLaJourneeDeLaCour(this: ArenaScene): void {
    const centre = this.cour?.centre;
    if (!centre) return;

    const instructeur = this.village.aUnInstructeur;
    if (!instructeur) {
      if (this.cour.eleves.length > 0) {
        this.events.emit("annonce", "Personne n'instruit a la cour — il faut un milicien", "village");
      }
      return;
    }

    for (const id of this.cour.passerLaJournee(true)) {
      const villageois = this.village.parId(id);
      if (!villageois) continue;

      const resultat = entrainer(villageois.regles.personne.don);
      villageois.regles.niveau += resultat.niveauxGagnes;

      if (resultat.don) {
        this.eveillerUnDon(villageois, "entrainement");
        continue;
      }
      this.events.emit(
        "annonce",
        `${villageois.nom} sort de la cour — aucun don, mais +${resultat.niveauxGagnes} en combat`,
        "village",
      );
    }
  }

  /**
   * Inscrire quelqu'un a la cour (DESIGN.md §4.18, bloc 9).
   *
   * Il y va, il ne produit plus, et deux journees plus tard **on sait**. Le
   * refus dit ce qui cloche, comme partout ailleurs.
   */
  inscrireALaCour(this: ArenaScene, villageois: Villageois): boolean {
    if (!this.cour?.existe) {
      this.events.emit("annonce", "Il faut d'abord batir une cour d'entrainement", "toi");
      return false;
    }
    if (this.cour.eleve(villageois.regles.id)) {
      this.events.emit("annonce", `${villageois.nom} s'exerce deja`, "toi");
      return false;
    }
    if (!this.cour.inscrire(villageois.regles.id)) return false;

    // Il quitte son poste : on ne produit pas en s'entrainant (§4.18).
    villageois.ancre = null;
    villageois.suit = null;
    this.events.emit(
      "annonce",
      `${villageois.nom} s'exerce — ${REGLAGES_COUR.journeesDeFormation} journees, et on saura`,
      "village",
    );
    return true;
  }


  /**
   * **Un villageois s'eveille, et devient un heros** (DESIGN.md §4.18, §4.1,
   * §4.29 — bloc 9).
   *
   * C'est la seule source de heros du jeu. On ne devient pas heros a l'usure :
   * on **nait avec un don**, un habitant sur dix en porte un, et personne ne le
   * sait avant qu'il s'eveille. Trois voies l'eveillent — le danger de mort
   * (gratuit, au hasard), l'entrainement (du temps de production), et le rituel
   * de l'eglise (sur et cher).
   *
   * ⚠️ **Il garde sa `Personne`, litteralement le meme objet** : son nom, ses
   * traits gagnes en travaillant, son stress, ses sequelles, son visage. C'est
   * ce que le §4.29 promet — « chaque heros aura eu un nom d'habitant, un
   * metier ». Lui en fabriquer une neuve ferait un heros tombe du ciel, et tout
   * le bloc 9 ne servirait plus a rien.
   *
   * Et c'est **lui** qui reveille les ordres, les formations, les postures,
   * l'IA de repli et l'experience de groupe : tous ces systemes tournent a vide
   * depuis le 5.5, faute d'un deuxieme heros sur qui tourner.
   *
   * @returns le heros ne, ou `null` si rien ne s'est eveille
   */
  eveillerUnDon(this: ArenaScene, villageois: Villageois, voie: VoieDuReveil): Hero | null {
    const personne = villageois.regles.personne;
    const don = personne.don;
    if (!don || don.eveille) return null;

    // L'effectif : dix dehors, le reste en garnison (§4.15). La garnison n'est
    // pas codee, donc on refuse au-dela — et on le dit, plutot que d'eveiller
    // un don qui ne donnerait aucun heros.
    if (this.heros.filter((h) => h.etat !== "mort").length >= EFFECTIF_MAXIMUM) {
      this.events.emit(
        "annonce",
        `${personne.nom} a un don, mais l'equipe est au complet (${EFFECTIF_MAXIMUM})`,
        "village",
      );
      return null;
    }

    const x = villageois.x;
    const y = villageois.y;
    const nom = personne.nom;
    personne.don = { ...don, eveille: true };

    // L'habitant quitte le village **avant** que le heros ne paraisse : deux
    // corps au meme endroit se pousseraient l'un l'autre.
    this.village.retirer(villageois);

    const hero = new Hero(this, x, y, CLASSES[don.classe], undefined, [], personne);
    this.heros.push(hero);
    this.equipe.add(hero);
    // Il arrive au combat, pas au travail : c'est un heros, pas un poste.
    hero.ordre = { posture: "temporiser", ancre: null };

    // Le village le voit s'eveiller, et ne le regarde plus pareil (§4.26).
    this.memoire.eveil(
      personne,
      [
        ...this.temoinsAutourDe(x, y, hero),
        ...this.village.temoinsAutourDe(x, y).map((v) => v.regles.personne),
      ],
      this.cycle.jour,
    );

    this.effetCercle(x, y, 52, don.majeur ? 0xe0c060 : 0x7ee0a0);
    this.flotter(x, y - 30, don.majeur ? "DON MAJEUR" : "Un don s'eveille", "#e0c060");
    this.events.emit(
      "annonce",
      don.majeur
        ? `${nom} transcende ${NOMS_VOIE[voie]} — un don MAJEUR de ${CLASSES[don.classe].nom}`
        : `${nom} transcende ${NOMS_VOIE[voie]} — ${CLASSES[don.classe].nom}`,
      "village",
    );
    return hero;
  }

  /**
   * Le deuxieme heros, au plus tard a l'aube du jour 3 (Angelos, 9 novembre 2026 ; voir
   * `reveilGaranti`). Un porteur endormi s'il y en a, sinon un habitant tire au sort chez qui
   * le don dormait. Par la voie du danger : il sort des deux premieres nuits.
   */
  reveillerLeDeuxiemeHeros(this: ArenaScene): void {
    if (!reveilGaranti(this.cycle.jour, this.heros.length)) return;
    const vivants = this.village.habitants.filter((v) => v.regles.vivant);
    if (vivants.length === 0) return;
    let elu = porteurAReveiller(vivants, (v) => v.regles.personne.don);
    if (!elu) {
      elu = vivants[this.rng.int(0, vivants.length - 1)]!;
      elu.regles.personne.don = donQuiDormait(this.rng);
    }
    this.eveillerUnDon(elu, "danger");
  }

  /**
   * Le danger de mort reveille les dons — **la voie noble** (DESIGN.md §4.1).
   *
   * Gratuite, au hasard, et elle ne se declenche que sous le seuil des 20 % :
   * les heros naissent des pires moments de la partie. On ne peut pas la
   * provoquer, parce qu'un habitant mort ne revient pas.
   *
   * Appele a chaque coup encaisse par un habitant, jamais par image.
   */
  guetterLeReveil(this: ArenaScene, villageois: Villageois): void {
    const personne = villageois.regles.personne;
    if (!personne.don || personne.don.eveille) return;
    const part = villageois.regles.pv / Math.max(1, combatDe(villageois.regles).pvMax);
    if (!reveilParLeDanger(personne.don, part, this.rng)) return;
    this.eveillerUnDon(villageois, "danger");
  }

  /**
   * Faire tourner la posture d'un habitant (DESIGN.md §4.18).
   *
   * Trois postures, le meme vocabulaire que les heros du §4.4. La decision est
   * poste par poste et non globale : laisser le mineur travailler la nuit est un
   * pari raisonnable — la mine est abritee des deux fronts — alors que le meme
   * pari sur la plage est beaucoup plus cher.
   */
  tournerPostureCivile(this: ArenaScene, index: number): void {
    const villageois = this.village.habitants[index];
    if (!villageois || !villageois.regles.vivant) return;

    const suite: PostureCivile[] = ["travail", "prudent", "abri"];
    const suivante = suite[(suite.indexOf(villageois.regles.posture) + 1) % suite.length]!;
    this.village.changerPosture(villageois, suivante);
    this.events.emit(
      "annonce",
      `${villageois.nom} — ${NOMS_POSTURE_CIVILE[suivante]}`,
      "toi",
    );
  }

  /**
   * L'envoyer au poste suivant (DESIGN.md §4.18).
   *
   * « Le joueur decide qui fait quoi, jamais quand » : c'est la seule decision
   * de production du jeu, et c'est celle qui rend les champs jouables — sans un
   * fermier a y mettre, rien n'y pousserait jamais.
   */
  tournerPosteCivil(this: ArenaScene, index: number): void {
    const villageois = this.village.habitants[index];
    if (!villageois || !villageois.regles.vivant) return;

    const actuel = POSTES.findIndex((p) => p.id === villageois.poste?.id);
    this.village.changerPoste(villageois, POSTES[(actuel + 1) % POSTES.length]!);
  }
}
