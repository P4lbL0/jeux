import Phaser from "phaser";
import { choisirCarte, type CarteVue, type ModeCartes } from "../core/robot";
import { competenceParId, ID_EMPLACEMENT, type Proposition } from "../core/competences";
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
 * - quand le jeu annonce « je coule », il ramène son héros vers la terre : l'IA des héros
 *   ne connaît pas l'eau profonde (seul l'incarné peut s'y noyer), un joueur si ;
 * - le reste du temps, son héros **tient l'église** (ancré sur elle, il se bat dans sa
 *   laisse), et dès qu'elle est à terre il **relance son chantier** (la touche Y) —
 *   décision d'Angelos du 9 novembre 2026 : sa chute décidait de presque toutes les parties ;
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
  /** Combien de fois il a sorti son héros de l'eau (« je coule ») */
  sortiesDeLEau: number;
  /** Combien de chantiers de l'église il a lancés après une chute */
  relevements: number;
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
  /** Jusqu'à quand il ramène son héros vers la terre (« je coule »). */
  private horsDeLEauJusqua = 0;
  /** Quand il retentera de relever l'église (pas chaque seconde : le refus s'annonce). */
  private prochainRelevement = 0;

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
    evenements.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      evenements.off("choix", this.surChoix, this);
      evenements.off("arrivant", this.surArrivant, this);
      evenements.off("hero-tombe", this.surChute, this);
      evenements.off("fin-de-partie", this.surFin, this);
      evenements.off("annonce", this.surAnnonce, this);
      evenements.off(Phaser.Scenes.Events.UPDATE, this.surImage, this);
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
    // « je coule — trois secondes et je me noie » : on regagne la terre, vers l'église.
    if (texte.startsWith("je coule") && nom === this.scene.hero?.personne.nom) {
      this.horsDeLEauJusqua = this.scene.time.now + 6000;
      this.rapport.sortiesDeLEau += 1;
      this.choisirLOrdre();
    }
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
    }
  }

  /**
   * L'ordre de son héros, revu chaque seconde : rentrer (posture « repli », il y reste) s'il
   * coule, ou s'il porte un état et que l'église peut le soigner ; sinon **tenir l'église**,
   * ancré sur elle à la laisse ordinaire. Église à terre, un malade ne rentre plus : rien ne
   * l'y soignerait, il se bat.
   */
  private choisirLOrdre(): void {
    const hero = this.scene.hero;
    if (!hero || hero.etat === "mort") return;
    const eglise = this.scene.eglise;
    const malade = hero.personne.etats.length > 0 && eglise.fonctionne;
    const coule = this.scene.time.now < this.horsDeLEauJusqua;
    if (malade && this.malade !== hero) this.rapport.allersALEglise += 1;
    this.malade = malade ? hero : null;

    if (malade || coule) {
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
