import Phaser from "phaser";
import { EVENEMENTS } from "./dessin/four";
import { jouer } from "./son";

/** Un sprite anime au sens de `poses.ts` : il porte sa famille de gestes. */
const estAnime = (objet: Phaser.GameObjects.GameObject): objet is Phaser.GameObjects.Sprite =>
  objet instanceof Phaser.GameObjects.Sprite && typeof (objet as { familleSprite?: unknown }).familleSprite === "string";

/**
 * Les bruits de la partie (DESIGN.md §4.10, phase 2, 20 septembre 2026).
 *
 * Les animations portent deja leurs evenements nommes (`four.ts` :
 * `villageois-travail` sonne « pioche » a sa cinquieme frame, `hero-guerrier-
 * attaque` sonne « lame » a la troisieme...). Ici on les **ecoute** : chaque
 * sprite anime qui entre dans la scene recoit un ecouteur de changement de
 * frame, et quand la frame cle passe, on demande le bruit de l'evenement.
 *
 * Trois regles, tranchees le 20 septembre 2026 pour que dix habitants au
 * travail ne fassent pas un mur de coups de pioche :
 *
 * 1. **Un coup sur deux** pour les bruits de travail ; les bruits de combat,
 *    plus rares par personne, sonnent a chaque coup.
 * 2. **Attenue par la distance a la camera** : plein a l'ecran, un murmure au
 *    bord, rien au-dela ; et un peu a gauche ou a droite selon l'endroit.
 * 3. **Huit voix au plus** en meme temps (la regle 1 du §4.17 pour le son) :
 *    au-dela, le bruit est simplement perdu. Aucune minuterie (regle 4) : on
 *    garde les instants de fin et on les compare a l'horloge.
 *
 * Les fichiers sont optionnels : `src/assets/son/bruit-<evenement>.ogg|mp3`,
 * poses par `npm run bruits -- --livrer` une fois qu'Angelos a choisi sur les
 * planches d'ecoute. Sans fichier, l'evenement reste muet — le jeu n'attend
 * jamais un son.
 */

const FICHIERS = import.meta.glob("../assets/son/bruit-*.{ogg,mp3}", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

/** Les bruits livres : une cle `bruit-<evenement>` et ses fichiers (OGG d'abord). */
export const BRUITS_LIVRES: { cle: string; urls: string[] }[] = (() => {
  const parCle = new Map<string, string[]>();
  for (const [chemin, url] of Object.entries(FICHIERS).sort(([a], [b]) => a.localeCompare(b))) {
    const cle = chemin.split("/").pop()!.replace(/\.(ogg|mp3)$/, "");
    parCle.set(cle, [...(parCle.get(cle) ?? []), url]);
  }
  return Array.from(parCle, ([cle, urls]) => ({ cle, urls: urls.sort((a) => (a.endsWith(".ogg") ? -1 : 1)) }));
})();

/** A appeler dans `preload` : ce qui manque au cache se charge. */
export function chargerLesBruits(scene: Phaser.Scene): void {
  for (const { cle, urls } of BRUITS_LIVRES) {
    if (!scene.cache.audio.exists(cle)) scene.load.audio(cle, [...urls]);
  }
}

/** Les bruits du travail : un sur deux. Les autres (combat, toux, chute) sonnent a chaque fois. */
const UN_SUR_DEUX = new Set(["pioche", "hache", "semis", "ligne", "enclume", "maillet", "pas"]);

/** Le plafond de voix simultanees. */
const VOIX_MAX = 8;

/** Deux fois le meme bruit a moins de 60 ms d'ecart : un seul, sinon ils se doublent. */
const ECART_MIN_MS = 60;

/** Le volume d'un bruit a l'ecran, avant le curseur « effets » du joueur. */
const VOLUME = 0.7;

/** La variation de vitesse : un peu plus grave ou plus aigu a chaque coup, jamais deux coups pareils. */
const VITESSE = { min: 0.94, max: 1.06 };

export class Bruits {
  /** Combien de fois chaque evenement a ete demande — la mesure, pas le son. */
  readonly demandes = new Map<string, number>();
  private readonly compteurs = new Map<string, number>();
  private readonly derniers = new Map<string, number>();
  /** Les instants de fin (ms de la scene) des voix en cours. */
  private fins: number[] = [];

  constructor(private readonly scene: Phaser.Scene) {
    // Tout sprite anime qui entre dans la scene est ecoute, une fois pour
    // toutes : un monstre recycle garde son ecouteur.
    scene.events.on(Phaser.Scenes.Events.ADDED_TO_SCENE, (objet: Phaser.GameObjects.GameObject) => {
      if (estAnime(objet)) this.ecouter(objet);
    });
  }

  /** Ecoute les changements de frame d'un sprite, et sonne sur la frame cle. */
  ecouter(sprite: Phaser.GameObjects.Sprite): void {
    sprite.on(
      Phaser.Animations.Events.ANIMATION_UPDATE,
      (anim: Phaser.Animations.Animation, frame: Phaser.Animations.AnimationFrame) => {
        const e = EVENEMENTS.get(anim.key);
        // `frame.index` compte a partir de 1 ; `frameCle` a partir de 0.
        if (!e || frame.index - 1 !== e.frame) return;
        this.jouer(e.evenement, sprite.x, sprite.y);
      },
    );
  }

  /** Demande le bruit d'un evenement a l'endroit `(x, y)` du monde. */
  jouer(evenement: string, x: number, y: number): void {
    this.demandes.set(evenement, (this.demandes.get(evenement) ?? 0) + 1);
    const cle = `bruit-${evenement}`;
    if (!this.scene.cache.audio.exists(cle)) return;
    const maintenant = this.scene.time.now;

    if (UN_SUR_DEUX.has(evenement)) {
      const n = (this.compteurs.get(evenement) ?? 0) + 1;
      this.compteurs.set(evenement, n);
      if (n % 2 === 0) return;
    }
    if (maintenant - (this.derniers.get(evenement) ?? -Infinity) < ECART_MIN_MS) return;

    // La distance a la camera : plein au centre, rien un peu au-dela du bord.
    const vue = this.scene.cameras.main.worldView;
    const portee = Math.hypot(vue.width, vue.height) * 0.6;
    const proximite = 1 - Math.min(1, Math.hypot(x - vue.centerX, y - vue.centerY) / portee);
    if (proximite <= 0.02) return;

    this.fins = this.fins.filter((fin) => fin > maintenant);
    if (this.fins.length >= VOIX_MAX) return;

    const tampon = this.scene.cache.audio.get(cle) as AudioBuffer | undefined;
    const vitesse = Phaser.Math.FloatBetween(VITESSE.min, VITESSE.max);
    const voix = jouer(this.scene, cle, "effets", {
      volume: VOLUME * proximite * proximite,
      pan: Phaser.Math.Clamp((x - vue.centerX) / (vue.width / 2), -1, 1) * 0.6,
      vitesse,
    });
    if (!voix) return;
    this.derniers.set(evenement, maintenant);
    this.fins.push(maintenant + ((tampon?.duration ?? 1) * 1000) / vitesse);
  }
}
