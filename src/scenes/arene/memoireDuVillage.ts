import { decorParCle, CLE_STELE } from "../../game/dessin/decor";
import { Hero } from "../../game/entities";
import { type Villageois } from "../../game/village";
import { descendreStress, verifierExploits, type Personne } from "../../core/personne";
import {
  bulleDeLaRencontre,
  direLInitiative,
  fautAnnoncer,
  initiativeDe,
  type CleInitiative,
  type SituationExtreme,
} from "../../core/vieAutonome";
import { estPositive, NOMS_RELATION, RESUMES_RELATION } from "../../core/relations";
import { raconter, titreDe, type Evenement } from "../../core/memoire";
import type { VieSociale } from "../../game/fichePersonne";
import type { ArenaScene } from "../ArenaScene";
import {
  TOMBES_MAX,
  ARCHIVES_MONTREES,
  JOURS_POUR_UN_STOCK_PLEIN,
  DISCOURS_RENDU,
  VOL_DU_KLEPTOMANE,
  VOL_RENDU,
} from "./reglages";

/**
 * La mémoire du village (§4.26) et la vie autonome (§4.27) : une mort, les tombes, les
 * archives, la vie sociale, les initiatives, les exploits.
 *
 * Une part d'`ArenaScene`, greffée sur son prototype (`greffer`) : `this` est la scène.
 */
export class ArenaMemoire {

  /**
   * **Une mort ne doit jamais etre `pv = 0 → retirer(personnage)`** (§4.26).
   *
   * C'est la seule porte par ou passent les deux populations, et elle fait
   * tout d'un coup : le pic de stress **module par la relation** au mort, le
   * trait que ca donne a ceux qui l'aimaient, le souvenir fondateur, la tombe,
   * l'entree aux archives, et le legs mis de cote pour son proche.
   */
  uneMort(
    this: ArenaScene,
    mort: Personne,
    temoins: Personne[],
    x: number,
    y: number,
    competence: string | null,
    /** Ce qu'on sait de sa mort. Ce qu'on ignore ne sera pas raconte (§4.26). */
    details: Partial<Evenement> = {},
  ): void {
    // ⚠️ **L'appelant donne la liste entiere**, heros et habitants melanges :
    // la completer ici compterait deux fois ceux que le village a deja vus.
    const tousLesTemoins = temoins;
    const deuil = this.memoire.mourir(
      mort,
      tousLesTemoins,
      this.toutLeMonde,
      this.cycle.jour,
      competence,
      {
        ...details,
        // Ce qu'on sait du moment : le titre et le recit en dependent, et ils
        // ne doivent rien affirmer d'autre (§4.26).
        faits: [
          ...(details.faits ?? []),
          ...(this.cycle.phase === "nuit" ? ["nuit", "defenseurs"] : []),
        ],
      },
    );

    this.cadavresDeLaNuit += 1;
    for (const temoin of tousLesTemoins) this.annoncerLesExploitsDe(temoin);
    // La tombe : un lieu, et un souvenir fondateur pour ceux qui l'ont connu.
    this.poserUneTombe(x, y);

    if (deuil.evenement) {
      this.events.emit("annonce", `${mort.nom} entre dans la memoire du village`, "village");
    }
    if (deuil.heritier !== null && competence !== null) {
      const heritier = this.toutLeMonde.find((p) => p.identite === deuil.heritier);
      if (heritier) {
        this.events.emit(
          "annonce",
          `${heritier.nom} portera ce que ${mort.nom} laisse`,
          "village",
        );
      }
    }
  }

  /**
   * Une tombe, la ou quelqu'un est tombe (§4.26).
   *
   * C'est la trace la plus simple que la regle du §4.26 exige — « tout
   * evenement important doit laisser une trace » — et la moins chere : une
   * image de decor, posee une fois, qui ne fait plus rien ensuite.
   */
  poserUneTombe(this: ArenaScene, x: number, y: number): void {
    const tombe = this.add
      .image(x, y, CLE_STELE)
      .setOrigin(0.5, decorParCle(CLE_STELE).origineY)
      .setDepth(y)
      // Du fer, pas de la pierre neuve : une tombe n'est pas un monument.
      .setTint(0x6b6478)
      .setScale(0.72);
    this.tombes.push(tombe);
    while (this.tombes.length > TOMBES_MAX) this.tombes.shift()?.destroy();
  }

  /**
   * Ce dont le village se souvient (DESIGN.md §4.26, bloc 11).
   *
   * ⚠️ **Appele a l'ouverture du tableau, jamais par image.** C'est la regle du
   * §4.26 : « aucun texte n'est construit tant qu'on ne l'affiche pas ». Un
   * evenement stocke ses variables ; la phrase est assemblee ici, une fois, au
   * moment ou le joueur demande a lire. `etatVillage`, lui, est lu soixante
   * fois par seconde — les archives n'y ont donc rien a faire.
   */
  archivesDuVillage(this: ArenaScene): { titre: string; recit: string[]; vif: boolean }[] {
    const jour = this.cycle.jour;
    const vifs = new Set(this.memoire.archives.vifs(jour));
    return [...this.memoire.archives.tout]
      .reverse()
      .slice(0, ARCHIVES_MONTREES)
      .map((evenement) => ({
        titre: titreDe(evenement),
        recit: raconter(evenement),
        vif: vifs.has(evenement),
      }));
  }

  /**
   * Ses liens, resolus en noms, pour la fiche (DESIGN.md §4.26, bloc 11).
   *
   * ⚠️ **Traduit ici, une fois, au moment d'ouvrir.** Les relations sont
   * indexees par identite ; la fiche ne connait ni la memoire du village ni la
   * population, et ce n'est pas a elle d'aller chercher qui est `p17`.
   */
  vieSocialeDe(this: ArenaScene, personne: Personne): VieSociale {
    const gens = new Map(this.toutLeMonde.map((p) => [p.identite, p.nom]));
    const liens = this.memoire.relations
      .lesLiensDe(personne.identite)
      .filter((lien) => gens.has(lien.avec))
      .map((lien) => ({
        nom: gens.get(lien.avec)!,
        type: NOMS_RELATION[lien.type].toLowerCase(),
        resume: RESUMES_RELATION[lien.type],
        intensite: lien.intensite,
        positif: estPositive(lien.type),
      }));
    return { liens };
  }

  /**
   * Deux habitants se croisent (DESIGN.md §4.27, bloc 12).
   *
   * ⚠️ **La bulle ne dit rien que le jeu ne sache deja** : le coeur vient
   * d'un lien fort (§4.26), la sueur d'un stress eleve, la chope du reste.
   * Une bulle tiree au sort serait de la decoration ; celle-ci est une
   * lecture, et c'est ce qui fait que le joueur y lit une histoire.
   */
  uneRencontre(this: ArenaScene, un: Villageois, autre: Villageois, maintenant: number): void {
    const lien = this.memoire.relations.lien(
      un.regles.personne.identite,
      autre.regles.personne.identite,
    );
    const genre = bulleDeLaRencontre(
      un.regles.personne,
      lien?.intensite ?? 0,
      lien !== null && estPositive(lien.type),
    );
    this.bulles.emettre(un.regles.id, genre, un.x, un.y - 26, maintenant);
  }

  /**
   * **Les initiatives** (DESIGN.md §4.27, bloc 12).
   *
   * ⚠️ **Testees sur evenement, jamais en continu.** Une initiative se
   * declenche quand un **trait fort rencontre une situation extreme** —
   * jamais sur un simple tirage. On appelle donc ceci a l'aube, a la tombee
   * de la nuit et quand un front cede : trois moments, pas soixante par
   * seconde.
   *
   * **Trois annonces par nuit au maximum, les plus graves d'abord** (tranche
   * le 9 septembre 2026). Le reste se produit sans notification : le village
   * vit, il ne hurle pas.
   */
  chercherDesInitiatives(this: ArenaScene, frontCede = false): void {
    if (this.enMarche || !this.village) return;
    const situation: SituationExtreme = {
      egliseSansDefense:
        this.eglise.regles.ratioPv < 1 && this.village.defenseurs === 0,
      frontCede,
      mortsDeLaNuit: this.cadavresDeLaNuit,
      nuit: this.cycle.phase === "nuit",
      stressCollectif: this.stressCollectif,
      stockPlein: this.village.joursDeVivres >= JOURS_POUR_UN_STOCK_PLEIN,
    };

    for (const villageois of this.village.vivants) {
      const cle = initiativeDe(villageois.regles.personne, situation);
      if (cle === null) continue;
      this.appliquerLInitiative(villageois, cle);
    }
  }

  /**
   * Ce qu'une initiative fait vraiment.
   *
   * ⚠️ **Une initiative ne fait jamais perdre un habitant sans que le joueur
   * ait pu reagir** (§4.27) : celui qui sort defendre l'eglise est annonce,
   * et la cloche le rappelle. C'est la regle centrale du §4.18 — une perte
   * definitive vient d'un arbitrage du joueur, jamais d'une decision prise
   * dans son dos.
   */
  appliquerLInitiative(this: ArenaScene, villageois: Villageois, cle: CleInitiative): void {
    const { personne } = villageois.regles;
    switch (cle) {
      case "tenir-l-eglise":
        // Il sort, et la cloche le fait rentrer comme n'importe qui.
        this.village.envoyerDefendre(villageois);
        this.memoire.aTenuSeul(personne, this.cycle.jour);
        break;
      case "abandonner-le-poste":
        this.village.changerPosture(villageois, "abri");
        break;
      case "rassembler-la-milice":
        // Il fait sortir ceux qui peuvent encore tenir. Pas plus de trois :
        // une milice improvisee n'est pas une armee.
        this.village.rassembler(3);
        break;
      case "mettre-le-feu":
        // Le Pyromane allume vraiment, depuis le jalon 6 (§4.21, §4.27) : la
        // maison debout la plus proche de lui prend feu. Rien d'autre n'a
        // change — c'est bien cette initiative-la qui portait le drapeau
        // `feuEnCraquant` depuis le bloc 12.
        this.brulerLaPlusProche(villageois.x, villageois.y);
        break;
      case "tenir-un-discours":
        // Il parle, et le stress redescend. C'est la seule initiative qui
        // rend quelque chose au village.
        for (const autre of this.village.vivants) {
          descendreStress(autre.regles.personne, DISCOURS_RENDU);
        }
        break;
      case "se-servir":
        // Il se sert, et ca le calme. Le village ne saura pas qui c'etait.
        this.village.seServir(VOL_DU_KLEPTOMANE);
        descendreStress(personne, VOL_RENDU);
        break;
    }

    if (fautAnnoncer(cle, this.initiativesAnnoncees)) {
      this.initiativesAnnoncees += 1;
      this.events.emit("annonce", direLInitiative(cle, personne.nom), "village");
    }
  }

  /** Un trait gagne se dit : sinon le joueur ne saurait jamais qu'il l'a fait. */
  annoncerLesExploits(this: ArenaScene, hero: Hero): void {
    this.annoncerLesExploitsDe(hero.personne);
  }

  annoncerLesExploitsDe(this: ArenaScene, personne: Personne): void {
    for (const cle of verifierExploits(personne)) {
      this.events.emit("annonce", `${personne.nom} devient ${cle}`, "village");
    }
  }
}
