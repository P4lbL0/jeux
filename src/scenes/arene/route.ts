import Phaser from "phaser";
import { Rng } from "../../core/rng";
import { type ClassId } from "../../core/classes";
import { mondesMuetsApres } from "../../core/marche";
import { paroleDeLaStele, placeDeRoute, semerLesCaches, type Cache } from "../../core/caches";
import { creerSurvivantDeRoute, REGLAGES_SURVIVANTS } from "../../core/survivants";
import { mondeCourant } from "../../core/carte";
import { NOMS_METIER, RESSOURCES, stocksVides } from "../../core/habitants";
import { contracterEtat, gagnerTrait } from "../../core/personne";
import { traitParId } from "../../core/traits";
import { accueillir as suivreSiFou } from "../../core/arrivants";
import type { ArenaScene } from "../ArenaScene";
import { DUREE_DU_VOILE } from "./reglages";

/**
 * Les trouvailles de la route (§4.31) : les caches, les camps de bêtes, le survivant, les
 * compagnons qui traversent les mondes, la stèle, et passer au large.
 *
 * Une part d'`ArenaScene`, greffée sur son prototype (`greffer`) : `this` est la scène.
 */
export class ArenaRoute {

  /**
   * On quitte ce monde-ci, et le suivant commence (§4.29, l'errance continue).
   *
   * **Ce qu'on traverse depend de ce qu'on laisse derriere.** Quitter un monde
   * **habite**, c'est refuser son village : le suivant est « deux fois plus
   * loin », ce qui se traduit par des **mondes muets** a traverser — un apres
   * le premier refus, trois apres le deuxieme, sept apres le troisieme
   * (`mondesMuetsApres`). Quitter un monde muet, c'est simplement en rayer un
   * de la liste.
   *
   * ⚠️ **Le voile est court, et c'est nouveau.** Il durait 700 ms, plus une
   * carte qui se peignait d'un bloc — deux a trois secondes de gel —, plus
   * 700 ms de fondu d'entree : entre deux mondes, on attendait. La carte se
   * peignant desormais par morceaux, la scene se remonte en deux ou trois
   * dixiemes ; le voile n'a plus besoin de couvrir un gel, seulement un pas.
   */
  /**
   * On a fini de fouiller une cache (§4.31).
   *
   * **Les deux monnaies ne vont pas au meme endroit**, et c'est tout le sens du
   * systeme : l'**or** entre dans la bourse, qui traverse les mondes — « refuser
   * un village finance le suivant » (§4.29) prend enfin son sens, puisqu'il y a
   * enfin de quoi gagner de l'or sur la route. La **matiere**, elle, attend :
   * elle deviendra les reserves du jour ou l'on s'installera.
   */
  ramasserUneCache(this: ArenaScene, cache: Cache): void {
    this.argent += cache.or;
    for (const cle of RESSOURCES) this.butinDeLaRoute[cle] += cache.ressources[cle];
  }

  /**
   * Le camp de betes qui garde une grosse cache se leve (§4.31).
   *
   * ⚠️ **Une seule fois par cache.** `mettreAJour` appelle ceci a chaque image
   * ou l'on est a portee de vue ; sans la marque, on lacherait huit betes par
   * image et le plafond du §4.17 serait creve en une seconde.
   */
  leverLeCamp(this: ArenaScene, cache: Cache): void {
    if (this.campsLeves.has(cache.id)) return;
    this.campsLeves.add(cache.id);
    this.lacherLaMeute(cache.point.x, cache.point.y, cache.garde, true);
    this.events.emit("annonce", `Des betes rodent autour — ${cache.garde}`, "guet");
  }

  /**
   * Les caches de ce monde-ci, semees au debut de la marche (§4.31).
   *
   * ⚠️ **Jamais en partie installee** (§4.31, point 4), et jamais sur une
   * reprise : la restauration du village (jalon 8) est le systeme qui
   * recompense l'exploration une fois qu'on a un village.
   */
  semerLesTrouvailles(this: ArenaScene): void {
    if (!this.enMarche) return;
    // La graine du monde, decalee : deux mondes n'ont pas les memes caches, et
    // le meme monde a toujours les siennes — comme le decor et le village.
    const caches = semerLesCaches(
      mondeCourant(),
      new Rng(this.graineMonde + 811),
      !this.villageMuet,
      this.departDeLaMarche,
    );
    this.caches.poser(caches);
    console.log(`[caches] ${caches.length} posees, dont ${caches.filter((c) => c.taille === "grosse").length} gardees`);
  }

  /**
   * Ce qu'on a porte sur le dos devient le grenier du village (§4.31).
   *
   * ⚠️ **Ca s'ajoute a ce que le village avait deja**, et ca ne le remplace
   * pas : le peuplement lui a donne ses reserves (§4.29), et elles ont ete
   * payees par le budget. Ce qu'on apporte est un cadeau qui n'a rien coute au
   * monde — c'est le prix du detour, et il est a nous.
   */
  verserLeButinDeLaRoute(this: ArenaScene): void {
    let total = 0;
    for (const cle of RESSOURCES) {
      this.village.stocks[cle] += this.butinDeLaRoute[cle];
      total += this.butinDeLaRoute[cle];
    }
    if (total > 0) {
      this.events.emit("annonce", `Tu vides ton sac dans le grenier — ${total} de reserves`, "village");
    }
    this.butinDeLaRoute = stocksVides();
  }

  /**
   * Quelqu'un, peut-etre, quelque part sur ce monde-ci (§4.31, deuxieme
   * trouvaille).
   *
   * ⚠️ **Rien ne l'annonce**, et c'est la difference avec le survivant du
   * village. Celui du §4.18 appelle, et la discussion dit « quelque part au
   * nord » ; celui-ci, on le **voit** ou l'on passe a cote sans jamais le
   * savoir. C'est la regle du §4.31 : ce qu'on trouve ne se marque pas sur une
   * carte, et chercher fait partie du chemin.
   */
  semerLeSurvivantDeRoute(this: ArenaScene): void {
    if (!this.enMarche) return;
    if (this.survivants.tous.length >= REGLAGES_SURVIVANTS.troupeMax) return;
    // La graine du monde, decalee comme celle des caches : un monde donne porte
    // toujours le meme, ou n'en porte jamais.
    const rng = new Rng(this.graineMonde + 1229);
    if (!rng.chance(REGLAGES_SURVIVANTS.chanceParMonde)) return;
    const place = placeDeRoute(
      mondeCourant(),
      rng,
      this.departDeLaMarche,
      this.caches.places,
    );
    if (!place) return;
    const regles = creerSurvivantDeRoute(rng, place, this.nomsPris());
    // La ligne est vide : personne ne l'annonce (voir plus haut).
    this.survivants.faireParaitre(regles, "");
    console.log(`[route] ${regles.arrivant.personne.nom} attend en ${Math.round(place.x)},${Math.round(place.y)}`);
  }

  /**
   * Ceux qui nous suivaient reparaissent derriere nous, dans le monde suivant
   * (§4.31, decision d'Angelos : « il traverse avec nous »).
   *
   * ⚠️ **On ne rejoue ni leur fiche ni leur meute** : ils sont deja des nous,
   * on les a deja juges, et les redecouvrir a chaque bord de carte aurait fait
   * de la traversee une corvee de trois panneaux.
   */
  reposerLesCompagnons(this: ArenaScene): void {
    if (this.compagnonsDeRoute.length === 0) return;
    const depart = this.departDeLaMarche;
    for (let i = 0; i < this.compagnonsDeRoute.length; i++) {
      const regles = this.compagnonsDeRoute[i]!;
      // En file derriere nous, pas les uns dans les autres.
      const angle = (i / REGLAGES_SURVIVANTS.troupeMax) * Math.PI * 2;
      regles.point = { x: depart.x + Math.cos(angle) * 34, y: depart.y + Math.sin(angle) * 34 };
      this.survivants.faireParaitre(regles, "", "suit");
    }
    const noms = this.compagnonsDeRoute.map((c) => c.arrivant.personne.nom).join(", ");
    this.events.emit("annonce", `${noms} ${this.compagnonsDeRoute.length > 1 ? "marchent" : "marche"} avec toi`, "toi");
    this.compagnonsDeRoute = [];
  }

  /**
   * Ceux qui nous suivaient entrent au village (§4.31).
   *
   * **Sans ceremonie, et c'est voulu** : on les a juges sur la route, un par un,
   * au moment ou on est arrive sur eux. Rejouer trois fiches d'observation a
   * l'instant ou le jour 1 se leve aurait enterre le seul moment fort du §4.29
   * sous une pile de panneaux.
   */
  installerLesCompagnons(this: ArenaScene): void {
    const suiveurs = this.survivants.suiveurs;
    for (const sprite of suiveurs) {
      const { arrivant, etat } = sprite.regles;
      const villageois = this.village.accueillir(arrivant.personne, arrivant.metierPretendu);
      // Ce qu'il porte entre avec lui, comme au §4.18 : l'infection est
      // contagieuse entre voisins de travail (§4.23).
      if (etat !== null) contracterEtat(villageois.personne, etat);
      const fou = suivreSiFou(arrivant, villageois.regles.id, 1, this.rng);
      if (fou !== null) this.fous.push(fou);
      this.events.emit(
        "annonce",
        `${arrivant.personne.nom} s'installe avec toi — ${NOMS_METIER[arrivant.metierPretendu].toLowerCase()}`,
        "village",
      );
    }
    this.survivants.vider();
  }

  /**
   * On a pose la main sur une stele (§4.31, troisieme trouvaille).
   *
   * ⚠️ **Elle dit ce qu'elle donne et ce qu'elle coute avant qu'on paie**
   * (decision d'Angelos, 21 septembre 2026). C'est ce qui autorise des traits
   * aussi lourds que les siens : un don a l'aveugle aurait ete plus memorable
   * et plus injuste — un mauvais tirage aurait decide d'une partie entiere sans
   * qu'on ait rien eu a dire.
   *
   * Le panneau est **celui de la rencontre** (§4.29). Les deux scenes sont la
   * meme : quelque chose nous pose une question, et nous avons deux reponses.
   * Deux panneaux auraient ete une interface en double (§4.10).
   */
  ouvrirLaStele(this: ArenaScene, cache: Cache): void {
    if (cache.trait === null || this.steleOuverte !== null) return;
    this.steleOuverte = cache;
    const parole = paroleDeLaStele(cache.trait);

    this.enPause = true;
    this.debutPause = this.time.now;
    this.physics.pause();
    this.anims.pauseAll();
    this.effacerDestination();
    this.events.emit("rencontre", {
      nom: "La stele",
      titre: "UNE STELE",
      lignes: parole.lignes,
      augure: parole.augure,
      question: parole.question,
      oui: "Poser la main",
      non: "Passer ton chemin",
    });
  }

  /**
   * On accepte le trait, ou on repart sans.
   *
   * **Passer son chemin ne consomme rien** : la stele reste, et on peut revenir
   * tant qu'on est dans ce monde-ci. Une pierre ne s'en va pas parce qu'on a
   * hesite — et le §4.31 veut un pari eclaire, pas un piege.
   */
  repondreALaStele(this: ArenaScene, accepte: boolean): void {
    const cache = this.steleOuverte;
    this.steleOuverte = null;
    this.reprendreLeJeu();
    if (!cache || cache.trait === null) return;

    if (!accepte) {
      this.events.emit("annonce", "Tu retires ta main. La pierre reste.", "toi");
      return;
    }

    const def = traitParId(cache.trait);
    const hero = this.hero;
    if (!def || !hero || hero.etat === "mort") return;
    // ⚠️ **Le trait va au heros, pas au village** (§4.31) : c'est lui qui a
    // fait le detour, et c'est lui qui le portera jusqu'au bout — la mort est
    // definitive, donc ce qu'on grave ici se perd avec lui.
    if (gagnerTrait(hero.personne, def.cle)) {
      // ⚠️ **Rien a recalculer, mais il faut borner la vie.** Les getters du
      // heros lisent `personne.mods`, que `gagnerTrait` vient de reagreger ; en
      // revanche un trait qui **baisse** la vie maximale (le Serment de fer)
      // laisserait ses points de vie courants au-dessus du nouveau plafond.
      hero.pv = Math.min(hero.pv, hero.pvMax);
      this.events.emit("annonce", `La pierre te marque — ${def.nom}`, "toi");
      this.events.emit("annonce", def.resume, "toi");
    } else {
      this.events.emit("annonce", "La pierre ne te dit plus rien. Tu portes deja sa marque.", "toi");
    }
    this.caches.eteindre(cache.id);
  }

  passerAuLarge(this: ArenaScene): void {
    this.quitteLeMonde = true;
    // Refuser, c'est quitter un monde qui avait quelqu'un. Traverser des
    // ruines vides ne coute rien : c'est deja le prix qu'on paie.
    const refus = this.villageMuet ? this.refus : this.refus + 1;
    const mondesMuets = this.villageMuet
      ? Math.max(0, this.mondesMuets - 1)
      : mondesMuetsApres(refus);
    this.events.emit(
      "annonce",
      this.villageMuet ? "Les ruines s'eloignent. La route continue." : "Tu passes au large. La route continue.",
      "toi",
    );
    const cam = this.cameras.main;
    cam.fadeOut(DUREE_DU_VOILE, 0, 0, 0);
    cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.stop("ui");
      this.scene.start("arena", {
        classe: this.registry.get("classe") as ClassId,
        emplacement: this.emplacement,
        marches: this.marches + 1,
        refus,
        mondesMuets,
        // ⚠️ **Ce qu'on a trouve sur la route traverse avec nous** (§4.29,
        // §4.31). L'or et la matiere passaient jusqu'ici par accident : Phaser
        // reutilise l'instance de scene, donc les champs survivaient a
        // `scene.start`. Ca marchait, et ca n'etait ecrit nulle part — une
        // ligne de plus dans `init` l'aurait efface sans qu'on comprenne
        // pourquoi la bourse se vidait. C'est donc passe explicitement.
        argent: this.argent,
        butinDeLaRoute: this.butinDeLaRoute,
        // Ceux qui nous suivent traversent avec nous (§4.31). On passe leurs
        // **regles**, pas leurs sprites : un sprite appartient a la scene qu'on
        // quitte, et il meurt avec elle.
        compagnons: this.survivants.suiveurs.map((s) => s.regles),
      });
    });
  }
}
