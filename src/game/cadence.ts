import Phaser from "phaser";
import { PAS_60, creerCadence, pasVoulu } from "../core/cadence";
import type { ArenaScene } from "../scenes/ArenaScene";

/**
 * Les champs de la boucle de Phaser que son pas limité touche, et que ses types ne
 * déclarent pas tous.
 */
interface BoucleDePhaser {
  now: number;
  time: number;
  lastTime: number;
  rawDelta: number;
  delta: number;
  smoothStep: boolean;
  smoothDelta(delta: number): number;
  nextFpsUpdate: number;
  updateFPS(time: number): void;
  framesThisSecond: number;
  frame: number;
  callback: (time: number, delta: number) => void;
}

/**
 * L'accélération du robot (jalon 6.4, étape 3), par partie : `budget` millisecondes de calcul
 * **sans dessin** ajoutées à chaque image dessinée, par pas de 1/60 s — chacun exactement le
 * pas d'un joueur à 60 images par seconde, donc la même partie, plus vite. `avance` est le
 * temps de jeu ainsi gagné : l'horloge des scènes lit l'heure que la boucle leur passe, et
 * elle ne doit jamais reculer. `heure` est la dernière heure passée au jeu.
 *
 * ⚠️ **L'image dessinée avance elle aussi d'un pas fixe de 1/60 s** quand on accélère (9
 * novembre 2026, au soir). Elle avançait du temps réel écoulé depuis la précédente : d'autant
 * plus gros que la machine ramait (plafonné à 50 ms par la scène), si bien que la même partie
 * ne se jouait pas tout à fait pareil à 6 ou à 10 parties de front. Désormais, seule l'heure
 * du jeu compte : la charge de la machine ne change plus que la durée réelle.
 */
interface Acceleration {
  budget: number;
  avance: number;
  heure: number;
}
const accelerations = new WeakMap<Phaser.Game, Acceleration>();

/** Accélère la partie (robot) ; `0` la rend au temps réel, sans jamais faire reculer l'heure. */
export function accelerer(jeu: Phaser.Game, budget: number): void {
  const acceleration = accelerations.get(jeu);
  if (acceleration) acceleration.budget = Math.max(0, budget);
}

/**
 * Pose la cadence des images (`core/cadence.ts`) sur la boucle de Phaser.
 *
 * À appeler juste après `new Phaser.Game`, avec `fps.limit` dans la configuration : Phaser
 * choisit alors son pas limité (`stepLimitFPS`) au démarrage de la boucle, après le
 * chargement des textures, et c'est celui-ci qu'on remplace. Il reprend la tenue de compte
 * de Phaser 3.90 ligne pour ligne ; seule change la décision de dessiner, et
 * `framesThisSecond` ne compte plus que les images dessinées — `loop.actualFps`, que lisent
 * les bancs de mesure, dit donc ce que le jeu dessine, pas ce que l'écran demande.
 */
export function poserLaCadence(jeu: Phaser.Game): void {
  const cadence = creerCadence();
  const acceleration: Acceleration = { budget: 0, avance: 0, heure: 0 };
  accelerations.set(jeu, acceleration);
  let auPremierPlan = true;
  // Les mêmes événements que la pause hors focus de l'arène (`suspendre`, `reprendre`) :
  // les scripts Playwright, qui réveillent le jeu par un `focus`, réveillent aussi la cadence.
  jeu.events.on(Phaser.Core.Events.BLUR, () => {
    auPremierPlan = false;
  });
  jeu.events.on(Phaser.Core.Events.FOCUS, () => {
    auPremierPlan = true;
  });

  const partieQuiTourne = (): boolean => {
    if (!jeu.scene.isActive("arena")) return false;
    const arene = jeu.scene.getScene("arena") as ArenaScene;
    return !arene.enPause || arene.enAmenagement;
  };

  const boucle = jeu.loop as unknown as BoucleDePhaser & { stepLimitFPS(time: number): void };
  boucle.stepLimitFPS = function (this: BoucleDePhaser, time: number): void {
    this.now = time;
    // Chrome donne parfois des écarts négatifs.
    let delta = Math.max(0, time - this.lastTime);
    this.rawDelta = delta;
    this.time += this.rawDelta;
    if (this.smoothStep) delta = this.smoothDelta(delta);
    this.delta += delta;
    if (time >= this.nextFpsUpdate) this.updateFPS(time);

    const accelere = acceleration.budget > 0;
    // Accéléré, le robot joue sans fenêtre au premier plan : le focus ne compte plus.
    if (cadence(time, pasVoulu({ auPremierPlan, partieQuiTourne: partieQuiTourne(), accelere }))) {
      this.framesThisSecond++;
      if (accelere) {
        // Un pas fixe, comme les pas sans dessin : l'heure du jeu ne suit plus l'horloge.
        acceleration.heure += PAS_60;
        acceleration.avance = acceleration.heure - time;
        this.callback(acceleration.heure, PAS_60);
      } else {
        acceleration.heure = time + acceleration.avance;
        this.callback(acceleration.heure, this.delta);
      }
      this.delta = 0;
      if (accelere) {
        const debut = performance.now();
        while (performance.now() - debut < acceleration.budget) {
          acceleration.avance += PAS_60;
          acceleration.heure = time + acceleration.avance;
          jeu.headlessStep(acceleration.heure, PAS_60);
        }
      }
    }

    this.lastTime = time;
    this.frame++;
  };
}
