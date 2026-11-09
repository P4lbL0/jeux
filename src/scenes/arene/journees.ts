import { POSTES } from "../../core/carte";
import { avancerLaJournee } from "../../core/personne";
import { type GensDuJour } from "../../game/memoire";
import type { ArenaScene } from "../ArenaScene";
import {
  MORTS_POUR_UN_MASSACRE,
  ELIMINES_POUR_UNE_VICTOIRE,
  AFFAMES_POUR_UNE_FAMINE,
} from "./reglages";

/**
 * Le temps long : la journée des héros, la journée de la mémoire, la nuit inscrite.
 *
 * Une part d'`ArenaScene`, greffée sur son prototype (`greffer`) : `this` est la scène.
 */
export class ArenaJournees {

  /**
   * Une journee de plus pour les heros (DESIGN.md §4.23).
   *
   * C'est le seul endroit ou le temps **long** avance de leur cote : les etats
   * se comptent en journees, pas en millisecondes. Le village a exactement la
   * meme methode, et c'est bien un seul systeme pour deux populations.
   */
  passerLaJourneeDesHeros(this: ArenaScene): void {
    for (const hero of this.heros) {
      if (hero.etat === "mort") continue;
      const { personne } = hero;

      // Une nuit dehors se compte a l'aube, pas pendant : sinon un heros qui
      // rentre a l'eglise dix fois compterait dix nuits (§4.23).
      personne.exploits.nuitsDehors += 1;
      if (hero.estCritique) personne.exploits.nuitSousLeSeuil = true;
      personne.exploits.kills = hero.kills;

      for (const evenement of avancerLaJournee(personne, 1)) {
        if (evenement.quoi === "mort") {
          this.events.emit("annonce", `${personne.nom} n'a pas survecu — ${evenement.nom}`, "village");
          this.tomber(hero);
          break;
        }
        this.events.emit("annonce", `${personne.nom} : ${evenement.nom}`, "village");
      }

      this.annoncerLesExploits(hero);
    }
  }

  /**
   * La journee sociale du village (DESIGN.md §4.26, bloc 11).
   *
   * ⚠️ **Une seule passe, a l'aube, et jamais par image.** C'est la regle du
   * §4.26 : « les relations ne se recalculent pas par image, elles bougent sur
   * evenement ». Une journee entiere est un evenement — celui qui dit qui a
   * travaille avec qui et qui a tenu la meme ligne cette nuit.
   *
   * Elle est en n² sur les vivants : trente habitants font 435 paires **une
   * fois par jour**. Le meme calcul par image serait exactement ce que le
   * §4.17 interdit.
   */
  passerLaJourneeDeLaMemoire(this: ArenaScene): void {
    if (this.enMarche || !this.village) return;
    const jour = this.cycle.jour;

    const gens: GensDuJour[] = [];
    for (const hero of this.heros) {
      if (hero.etat === "mort") continue;
      gens.push({
        personne: hero.personne,
        // Un heros mis a un poste y a passe sa journee comme les autres (bloc 8).
        poste: hero.travail === null ? null : (POSTES.find((p) => p.metier === hero.travail)?.id ?? null),
        sestBattu: true,
        kills: hero.kills - (this.killsDeLaVeille.get(hero.personne.identite) ?? 0),
      });
      this.killsDeLaVeille.set(hero.personne.identite, hero.kills);
    }
    for (const villageois of this.village.vivants) {
      gens.push({
        personne: villageois.regles.personne,
        poste: villageois.poste?.id ?? null,
        // Un milicien qui a tenu les rues a vu la meme nuit qu'un heros (bloc 9).
        sestBattu: villageois.regles.metier === "milicien" || villageois.etat === "defend",
        kills: 0,
      });
    }

    for (const annonce of this.memoire.passerUneJournee(gens, jour, () => this.rng.next())) {
      this.events.emit("annonce", annonce, "village");
    }

    // La nuit qui vient de finir : ceux qui l'ont passee s'en souviennent, et
    // seulement si elle valait la peine d'etre retenue.
    if (this.cadavresDeLaNuit > 0) {
      this.memoire.survivreALaNuit(
        gens.map((g) => g.personne),
        jour - 1,
      );
    }
    this.inscrireLaNuit(jour, gens.length);
    // ⚠️ **Sur evenement, jamais en continu** (§4.27) : l'aube est un des
    // trois moments ou l'on regarde si quelqu'un prend une initiative.
    this.chercherDesInitiatives();
    this.initiativesAnnoncees = 0;
    this.cadavresDeLaNuit = 0;
    this.killsDeLaNuit = 0;
  }

  /**
   * Ce que la nuit qui s'acheve laisse aux archives (DESIGN.md §4.26).
   *
   * Quatre des cinq types du §4.26 se decident ici, et **ils s'excluent** : une
   * nuit est un massacre, ou une nuit tenue, ou rien. Le cinquieme — la nuit de
   * quelqu'un — se decide a la mort, pas au matin.
   *
   * ⚠️ **Une nuit ordinaire n'entre pas aux archives**, et c'est tout le sujet.
   * Un village qui inscrirait chaque nuit produirait un mur de titres qui ne
   * veulent plus rien dire, et « la nuit ou Gaston a tenu la porte » se
   * perdrait dedans.
   */
  inscrireLaNuit(this: ArenaScene, jour: number, debout: number): void {
    if (this.cadavresDeLaNuit >= MORTS_POUR_UN_MASSACRE) {
      this.memoire.inscrire({
        type: "massacre",
        jour,
        combien: this.cadavresDeLaNuit,
        aussi: debout,
      });
      this.events.emit("annonce", `Le massacre du jour ${jour}`, "guet");
    } else if (this.cadavresDeLaNuit === 0 && this.killsDeLaNuit >= ELIMINES_POUR_UNE_VICTOIRE) {
      this.memoire.inscrire({
        type: "grande-victoire",
        jour,
        qui: this.hero?.personne.nom,
        combien: this.killsDeLaNuit,
      });
      this.events.emit("annonce", "La nuit a tenu — personne n'est tombe", "guet");
    }

    // La famine est independante : on peut tenir une nuit et n'avoir rien a
    // manger au matin.
    const affames = this.village.vivants.filter((v) => !v.regles.rassasie).length;
    if (affames >= AFFAMES_POUR_UNE_FAMINE) {
      this.memoire.inscrire({ type: "famine", jour, combien: affames });
    }
  }
}
