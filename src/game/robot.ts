import Phaser from "phaser";
import { choisirCarte, type CarteVue, type ModeCartes } from "../core/robot";
import { competenceParId, ID_EMPLACEMENT, type Proposition } from "../core/competences";
import { NIVEAU_MAX } from "../core/eglise";
import { estTerreFerme, terrainEn } from "../core/carte";
import { profondeurDe } from "../core/eau";
import { accelerer } from "./cadence";
import type { Ennemi, Hero } from "./entities";
import type { ArenaScene } from "../scenes/ArenaScene";

/**
 * Le robot qui joue des parties entières (jalon 6.4, étape 3, 9 novembre 2026).
 *
 * Il ne se lance que par `scene.start("arena", { robot: {...} })` — jamais dans une partie
 * de joueur. Il joue **le héros seul**, par les mêmes chemins qu'un joueur :
 * - le héros incarné est piloté par **la même IA que les autres** (`piloter`, repli à 20 %
 *   compris), mais il reste incarné : il peut mourir, comme celui d'un joueur ;
 * - les cartes de niveau se choisissent par `core/robot.ts` (une règle simple, ou le hasard)
 *   et partent par le même événement que le clic (`choix-fait`) ;
 * - à la porte, il accepte tout le monde (`porte`, vrai) ;
 * - quand son héros porte un état (hémorragie, maladie...), il le ramène à l'église jusqu'à
 *   ce qu'elle l'ait soigné, comme le design le demande au joueur (§4.23) ;
 * - **il ne met pas le pied dans l'eau qui noie** (la mer, l'abysse), et s'il y est projeté,
 *   il gagne la terre ferme la plus proche : l'IA des héros ne connaît pas l'eau profonde
 *   (seul l'incarné peut s'y noyer), un joueur si. Jusqu'au 9 novembre au soir il visait
 *   l'église, parfois à travers plus d'eau encore : deux mondes sur douze le noyaient dès la
 *   première nuit (série 11) ;
 * - le reste du temps, son héros **tient l'église** (ancré sur elle, il se bat dans sa
 *   laisse), et dès qu'elle est à terre il **relance son chantier** (la touche Y) —
 *   décision d'Angelos du 9 novembre 2026 : sa chute décidait de presque toutes les parties ;
 * - « un minimum intelligent » (Angelos, même jour) : il **monte l'église** de niveau dès
 *   que ses quatre conditions sont réunies (la même touche Y), et il **esquive les
 *   crachats** — un pas de côté quand l'un d'eux va le toucher, ce que l'IA ne sait pas faire ;
 *   et il **recule devant un boss qui se cabre** sur lui (même soir), jusqu'à ce que le coup
 *   parte — mais jamais pendant qu'il sort de l'eau ;
 * - l'interface ne montre ni l'écran de choix ni la fiche de la porte (`UiScene`) ;
 * - pas de pause hors focus (`suspendre`), et la partie est accélérée (`accelerer`).
 *
 * Ce qu'il relève va dans `window.__robot` : les cartes prises, chaque héros tombé et ce qui
 * l'a tué, un relevé à chaque aube et à chaque crépuscule, et la fin.
 */

export interface ReglagesRobot {
  cartes: ModeCartes;
  /** Millisecondes de calcul sans dessin ajoutées à chaque image (0 : pas d'accélération) */
  budget?: number;
}

export interface ReleveRobot {
  /** Secondes de jeu depuis le début de la partie */
  t: number;
  jour: number;
  /** Le numéro de la nuit en cours ou de la dernière (`cycle.nuit`) */
  nuit: number;
  phase: string;
  niveau: number;
  herosDebout: number;
  habitants: number;
  argent: number;
  tues: number;
  monstres: number;
  /** Les invocations actives (morts-vivants du Nécromancien, familiers...) */
  invocations: number;
}

export interface RapportRobot {
  classe: string;
  cartes: ModeCartes;
  graineMonde: number;
  graineVillage: number;
  fini: boolean;
  /** `equipe` : tous les héros tombés ; `village` : plus un habitant */
  raison: "equipe" | "village" | null;
  cartesPrises: { t: number; niveau: number; ecran: string; id: string; nom: string }[];
  chutes: { t: number; jour: number; nuit: number; phase: string; nom: string; classe: string; niveau: number; cause: string }[];
  releves: ReleveRobot[];
  /** Combien de fois il a ramené son héros à l'église pour un état */
  allersALEglise: number;
  /** Combien de fois son héros a coulé (« je coule ») : autant d'allers vers la rive */
  sortiesDeLEau: number;
  /** Combien de chantiers de l'église il a lancés après une chute */
  relevements: number;
  /** Combien de niveaux d'église il a montés */
  montees: number;
  /** Combien de crachats il a esquivés (un pas de côté décidé) */
  esquives: number;
  /** Combien de fois il a reculé devant un boss ou un énorme qui se cabrait sur lui */
  reculs: number;
  /**
   * Les coups portés à l'église, par ce qui les porte (« Brute (boss) », « Nuee »...) :
   * dégâts cumulés et part du rôle du monstre (pillard qui a fini ses maisons, chasseur sans
   * héros en vue, ou monstre qui la visait).
   */
  degatsEglise: Record<string, { degats: number; coups: number }>;
  /** Quand l'église est tombée pour la première fois */
  egliseTombee: { t: number; jour: number; phase: string } | null;
  /** Le dernier relevé, tenu à jour toutes les secondes de jeu */
  dernier: ReleveRobot | null;
}

/** L'eau où l'on se noie en trois secondes (`Noyade`) : la mer et l'abysse. */
function noie(x: number, y: number): boolean {
  const profondeur = profondeurDe(terrainEn(x, y));
  return profondeur === "mer" || profondeur === "abysse";
}

/** Un petit générateur à graine : le hasard du robot ne touche pas à celui de la partie. */
function generateur(graine: number): () => number {
  let a = graine >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Ce que le robot note du dernier coup reçu par chaque héros. */
interface Coup {
  cause: string;
  t: number;
}

export class Robot {
  readonly rapport: RapportRobot;
  private readonly hasard: () => number;
  private readonly derniersCoups = new WeakMap<Hero, Coup>();
  private coupEnCours: string | null = null;
  private phaseVue = "";
  private prochaineSeconde = 0;
  /** Les dernières annonces : c'est par elles qu'on sait ce qui tue sans coup. */
  private readonly annonces: { t: number; texte: string }[] = [];
  /** Le héros qu'on a vu porter un état : pour ne compter qu'une fois chaque aller. */
  private malade: Hero | null = null;
  /** Quand il retentera de relever l'église (pas chaque seconde : le refus s'annonce). */
  private prochainRelevement = 0;
  /** Quand il regardera de nouveau s'il peut monter l'église. */
  private prochaineMontee = 0;
  /** Le pas de côté en cours : sa direction, et jusqu'à quand. */
  private esquive: { x: number; y: number; jusqua: number } | null = null;

  constructor(
    private readonly scene: ArenaScene,
    private readonly reglages: ReglagesRobot,
  ) {
    this.hasard = generateur(scene.graineMonde * 7919 + scene.graineVillage + 17);
    this.rapport = {
      classe: scene.hero?.classe.id ?? "?",
      cartes: reglages.cartes,
      graineMonde: scene.graineMonde,
      graineVillage: scene.graineVillage,
      fini: false,
      raison: null,
      cartesPrises: [],
      chutes: [],
      releves: [],
      allersALEglise: 0,
      sortiesDeLEau: 0,
      relevements: 0,
      montees: 0,
      esquives: 0,
      reculs: 0,
      degatsEglise: {},
      egliseTombee: null,
      dernier: null,
    };
    (window as unknown as { __robot: RapportRobot }).__robot = this.rapport;

    scene.game.sound.mute = true;
    accelerer(scene.game, reglages.budget ?? 0);

    const evenements = scene.events;
    evenements.on("choix", this.surChoix, this);
    evenements.on("arrivant", this.surArrivant, this);
    evenements.on("hero-tombe", this.surChute, this);
    evenements.on("fin-de-partie", this.surFin, this);
    evenements.on("annonce", this.surAnnonce, this);
    evenements.on(Phaser.Scenes.Events.UPDATE, this.surImage, this);
    // Après la boucle de la scène : l'IA a posé la vitesse du héros, le pas de côté la
    // remplace, et la physique l'applique à l'image suivante.
    evenements.on(Phaser.Scenes.Events.POST_UPDATE, this.esquiver, this);
    evenements.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      evenements.off("choix", this.surChoix, this);
      evenements.off("arrivant", this.surArrivant, this);
      evenements.off("hero-tombe", this.surChute, this);
      evenements.off("fin-de-partie", this.surFin, this);
      evenements.off("annonce", this.surAnnonce, this);
      evenements.off(Phaser.Scenes.Events.UPDATE, this.surImage, this);
      evenements.off(Phaser.Scenes.Events.POST_UPDATE, this.esquiver, this);
      accelerer(scene.game, 0);
    });
    this.espionnerLesCoups();
  }

  /** Les secondes de jeu, pauses comprises : ce que le relevé compte. */
  private get secondes(): number {
    return Math.round((this.scene.time.now - this.scene.debut) / 1000);
  }

  // --------------------------------------------------------------- les cartes

  private surChoix(titre: string, _sousTitre: string, propositions: Proposition[]): void {
    const hero = this.scene.hero;
    if (!hero || propositions.length === 0) return;
    const vues: CarteVue[] = propositions.map((p) => {
      const def = competenceParId(p.id);
      return {
        fusion: Boolean(def?.fusion) || Boolean(p.fusionne),
        palier: hero.competences[p.id] ?? 0,
        deSaClasse: def?.classes?.includes(hero.classe.id) ?? false,
        oublier: p.etiquette.includes("OUBLIER"),
        achat: p.id === ID_EMPLACEMENT,
      };
    });
    const choisie = propositions[choisirCarte(vues, this.reglages.cartes, this.hasard())]!;
    this.rapport.cartesPrises.push({ t: this.secondes, niveau: hero.niveau, ecran: titre, id: choisie.id, nom: choisie.nom });
    // Le choix part à l'image suivante, comme un clic : la scène a fini d'ouvrir son écran.
    this.scene.time.delayedCall(0, () => this.scene.events.emit("choix-fait", choisie.id));
  }

  // --------------------------------------------------------------- la porte

  private surArrivant(): void {
    this.scene.time.delayedCall(0, () => this.scene.events.emit("porte", true));
  }

  // --------------------------------------------------------------- ce qui tue

  /**
   * Note, pour chaque coup encaissé, ce qui l'a porté. Les trois portes d'entrée des coups
   * de monstres (`resoudreFrappe`, `impactCrachat`, `exploser`) posent la cause le temps de
   * leur appel ; `encaisser` la recopie sur la cible. Enveloppées sur cette scène seulement.
   */
  private espionnerLesCoups(): void {
    const robot = this;
    const scene = this.scene as unknown as Record<string, (...args: unknown[]) => unknown>;
    const nommer = (e: Ennemi): string => (e.rang !== "pietaille" ? `${e.archetype.nom} (${e.rang})` : e.archetype.nom);
    const envelopper = (nom: string, cause: (args: unknown[]) => string): void => {
      const original = scene[nom]!;
      scene[nom] = function (this: unknown, ...args: unknown[]) {
        robot.coupEnCours = cause(args);
        try {
          return original.apply(this, args);
        } finally {
          robot.coupEnCours = null;
        }
      };
    };
    envelopper("resoudreFrappe", ([e]) => nommer(e as Ennemi));
    envelopper("impactCrachat", () => "crachat");
    envelopper("exploser", ([e]) => `${nommer(e as Ennemi)}, explosion`);

    // Ce qui abat l'église : chaque coup, rangé par espèce, rang et rôle.
    const cognerEglise = scene.cognerEglise!;
    scene.cognerEglise = function (this: unknown, ...args: unknown[]) {
      const e = args[0] as Ennemi;
      const avant = robot.scene.eglise.regles.pv;
      const resultat = cognerEglise.apply(this, args);
      const perdus = avant - robot.scene.eglise.regles.pv;
      if (perdus > 0) {
        const role = e.cibleMaison ? "pillard" : e.chasseur ? "chasseur" : "eglise";
        const cle = `${nommer(e)} · ${role}`;
        const ligne = (robot.rapport.degatsEglise[cle] ??= { degats: 0, coups: 0 });
        ligne.degats += perdus;
        ligne.coups += 1;
      }
      return resultat;
    };

    const encaisser = scene.encaisser!;
    scene.encaisser = function (this: unknown, ...args: unknown[]) {
      robot.derniersCoups.set(args[0] as Hero, { cause: robot.coupEnCours ?? "autre coup", t: robot.scene.time.now });
      return encaisser.apply(this, args);
    };
  }

  private surAnnonce(texte: string, _canal?: string, nom?: string): void {
    this.annonces.push({ t: this.scene.time.now, texte: nom ? `${nom} ${texte}` : texte });
    if (this.annonces.length > 12) this.annonces.shift();
    // « je coule — trois secondes et je me noie » : la rive, c'est `esquiver` qui y mène.
    if (texte.startsWith("je coule") && nom === this.scene.hero?.personne.nom) this.rapport.sortiesDeLEau += 1;
  }

  private surChute(hero: Hero): void {
    const coup = this.derniersCoups.get(hero);
    const recent = coup && this.scene.time.now - coup.t < 1500;
    // Sans coup récent : ce que le jeu a annoncé à son sujet juste avant (noyade, état, cœur).
    const nom = hero.personne.nom;
    const annonce = [...this.annonces].reverse().find((a) => this.scene.time.now - a.t < 3000 && a.texte.includes(nom));
    this.rapport.chutes.push({
      t: this.secondes,
      jour: this.scene.cycle.jour,
      nuit: this.scene.cycle.nuit,
      phase: this.scene.cycle.phase,
      nom: hero.personne.nom,
      classe: hero.classe.id,
      niveau: hero.niveau,
      cause: recent ? coup.cause : (annonce?.texte.replace(nom, "").trim() ?? "sans coup ni annonce"),
    });
  }

  // --------------------------------------------------------------- les relevés

  private relever(): ReleveRobot {
    const scene = this.scene;
    return {
      t: this.secondes,
      jour: scene.cycle.jour,
      nuit: scene.cycle.nuit,
      phase: scene.cycle.phase,
      niveau: scene.hero?.niveau ?? 0,
      herosDebout: scene.heros.filter((h) => h.etat !== "mort").length,
      habitants: scene.village?.vivants.length ?? 0,
      argent: Math.round(scene.argent),
      tues: scene.resume.kills,
      monstres: scene.ennemis.getLength(),
      invocations: scene.invocations.countActive(),
    };
  }

  private surImage(): void {
    if (this.rapport.fini) return;
    const phase = this.scene.cycle.phase;
    if (phase !== this.phaseVue) {
      this.phaseVue = phase;
      this.rapport.releves.push(this.relever());
    }
    if (this.scene.time.now >= this.prochaineSeconde) {
      this.prochaineSeconde = this.scene.time.now + 1000;
      this.rapport.dernier = this.relever();
      if (!this.rapport.egliseTombee && !this.scene.eglise.fonctionne) {
        this.rapport.egliseTombee = { t: this.secondes, jour: this.scene.cycle.jour, phase: this.scene.cycle.phase };
      }
      this.choisirLOrdre();
      this.releverLEglise();
      this.monterLEglise();
    }
  }

  /** Église debout, conditions réunies : il la monte d'un niveau, comme la touche Y. */
  private monterLEglise(): void {
    const eglise = this.scene.eglise;
    if (!eglise.fonctionne || eglise.niveau >= NIVEAU_MAX) return;
    if (this.scene.time.now < this.prochaineMontee) return;
    this.prochaineMontee = this.scene.time.now + 10_000;
    if (!eglise.regles.peutMonter(this.scene.contexteMontee).possible) return;
    const avant = eglise.niveau;
    this.scene.oeuvrerALEglise();
    if (eglise.niveau > avant) this.rapport.montees += 1;
  }

  /**
   * Le pas de côté : un crachat qui vient sur lui et passera à moins de 26 px, à moins de
   * 170 px de lui, le fait s'écarter perpendiculairement à sa course, du côté où il est
   * déjà, pendant un quart de seconde. Assez pour un crachat à 140 px/s ; rien de plus fin.
   *
   * Et le recul (Angelos, 9 novembre 2026, au soir) : un boss ou un énorme qui se cabre
   * **sur lui**, à portée de son coup, le fait reculer droit à l'opposé jusqu'à ce que le
   * coup parte — ce qu'un joueur fait en voyant le cabrage. La piétaille, non. ⚠️ **Essayé
   * aussi sur la Brute ordinaire** (le coup le plus annoncé du jeu) : rien de mesurable sur 84
   * parties (série 10), retiré.
   *
   * L'eau passe avant tout : celui qui coule pense d'abord à la rive (`gagnerLaRive`), et
   * aucun pas — de l'IA, de côté ou en arrière — ne l'y fait entrer (`garderLePied`).
   */
  private esquiver(): void {
    const hero = this.scene.hero;
    if (!hero || hero.etat === "mort" || this.scene.enPause) return;
    const maintenant = this.scene.time.now;
    if (noie(hero.x, hero.y)) {
      this.esquive = null;
      this.gagnerLaRive(hero);
      return;
    }
    if (!this.esquive || maintenant >= this.esquive.jusqua) {
      this.esquive = null;
      for (const e of this.scene.ennemisDansRayon(hero.x, hero.y, 150)) {
        if (e.rang === "pietaille" || !e.enArmement || e.cibleArmee !== hero) continue;
        const dx = hero.x - e.x;
        const dy = hero.y - e.y;
        const distance = Math.hypot(dx, dy) || 1;
        if (distance > e.archetype.portee + 10) continue;
        this.esquive = { x: dx / distance, y: dy / distance, jusqua: e.instantFrappe + 60 };
        this.rapport.reculs += 1;
        break;
      }
    }
    if (!this.esquive || maintenant >= this.esquive.jusqua) {
      this.esquive = null;
      for (const objet of this.scene.projectilesEnnemis.getChildren()) {
        const p = objet as Phaser.Physics.Arcade.Image;
        if (!p.active || !p.body) continue;
        const v = p.body.velocity;
        const vitesse = Math.hypot(v.x, v.y);
        if (vitesse === 0) continue;
        const dx = hero.x - p.x;
        const dy = hero.y - p.y;
        if (dx * dx + dy * dy > 170 * 170) continue;
        // Il vient vers lui, et sa course passe près de lui.
        if (dx * v.x + dy * v.y <= 0) continue;
        const ecart = (dx * v.y - dy * v.x) / vitesse;
        if (Math.abs(ecart) > 26) continue;
        // Perpendiculaire à la course, du côté où il est déjà.
        const cote = ecart >= 0 ? 1 : -1;
        this.esquive = { x: (v.y / vitesse) * cote, y: (-v.x / vitesse) * cote, jusqua: maintenant + 250 };
        this.rapport.esquives += 1;
        break;
      }
    }
    if (this.esquive) hero.setVelocity(this.esquive.x * hero.vitesse, this.esquive.y * hero.vitesse);
    this.garderLePied(hero);
  }

  /**
   * Dans l'eau qui noie : droit vers la terre ferme la plus proche (seize directions, par
   * cercles de 16 px jusqu'à 240), à la vitesse que l'eau lui laisse.
   */
  private gagnerLaRive(hero: Hero): void {
    for (let rayon = 16; rayon <= 240; rayon += 16) {
      for (let k = 0; k < 16; k++) {
        const angle = (k / 16) * Math.PI * 2;
        if (!estTerreFerme(hero.x + Math.cos(angle) * rayon, hero.y + Math.sin(angle) * rayon)) continue;
        hero.setVelocity(Math.cos(angle) * hero.vitesse, Math.sin(angle) * hero.vitesse);
        return;
      }
    }
  }

  /**
   * Au sec : si son pas l'emmène dans l'eau qui noie (18 px devant lui), il longe la rive —
   * il garde l'axe qui reste au sec — ou s'arrête. Pas quand un coup le projette : ça, un
   * joueur ne le retient pas non plus.
   */
  private garderLePied(hero: Hero): void {
    if (hero.estEnRecul) return;
    const v = (hero.body as Phaser.Physics.Arcade.Body).velocity;
    const vitesse = Math.hypot(v.x, v.y);
    if (vitesse === 0) return;
    const devant = 18 / vitesse;
    const x = hero.x + v.x * devant;
    const y = hero.y + v.y * devant;
    if (!noie(x, y)) return;
    if (!noie(x, hero.y)) hero.setVelocity(v.x, 0);
    else if (!noie(hero.x, y)) hero.setVelocity(0, v.y);
    else hero.setVelocity(0, 0);
  }

  /**
   * L'ordre de son héros, revu chaque seconde : rentrer (posture « repli », il y reste) s'il
   * porte un état et que l'église peut le soigner ; sinon **tenir l'église**,
   * ancré sur elle à la laisse ordinaire. Église à terre, un malade ne rentre plus : rien ne
   * l'y soignerait, il se bat.
   */
  private choisirLOrdre(): void {
    const hero = this.scene.hero;
    if (!hero || hero.etat === "mort") return;
    const eglise = this.scene.eglise;
    const malade = hero.personne.etats.length > 0 && eglise.fonctionne;
    if (malade && this.malade !== hero) this.rapport.allersALEglise += 1;
    this.malade = malade ? hero : null;

    if (malade) {
      if (hero.ordre.posture !== "repli") hero.ordre = { posture: "repli", ancre: null };
      return;
    }
    const { x, y } = eglise.sprite;
    const ancre = hero.ordre.ancre;
    if (hero.ordre.posture !== "temporiser" || !ancre || ancre.x !== x || ancre.y !== y) {
      hero.ordre = { posture: "temporiser", ancre: { x, y } };
    }
  }

  /** Église à terre et pas encore en chantier : il tente de la relever, comme la touche Y. */
  private releverLEglise(): void {
    const eglise = this.scene.eglise;
    if (eglise.fonctionne || eglise.regles.etat !== "ruine") return;
    if (this.scene.time.now < this.prochainRelevement) return;
    this.prochainRelevement = this.scene.time.now + 20_000;
    this.scene.oeuvrerALEglise();
    // Relu après l'appel : TypeScript croit encore l'église en ruine.
    const etat: string = eglise.regles.etat;
    if (etat === "relevement") this.rapport.relevements += 1;
  }

  private surFin(): void {
    const releve = this.relever();
    this.rapport.dernier = releve;
    this.rapport.releves.push(releve);
    this.rapport.raison = releve.herosDebout === 0 ? "equipe" : "village";
    this.rapport.fini = true;
    accelerer(this.scene.game, 0);
  }
}
