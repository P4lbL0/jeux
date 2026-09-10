import type Phaser from "phaser";

/**
 * Les poses des combattants — de **vraies planches d'animation**.
 *
 * Ce fichier annoncait sa propre fin : « le jour ou on les aura, ce fichier
 * disparait au profit de `this.anims` ». On y est. Il ne fait plus tourner les
 * sprites, il choisit quelle animation jouer.
 *
 * Les planches sont **cuites au demarrage par le four** (`dessin/four.ts`) :
 * chaque famille — un heros par classe et palier, un villageois par metier, un
 * monstre par archetype — porte tous ses gestes bout a bout dans une seule
 * texture, et une animation par geste. Depuis le 10 septembre 2026 il n'y a
 * plus de PNG du tout : ce fichier demande donc au gestionnaire d'animations si
 * la cle existe, au lieu de consulter un manifeste.
 *
 * **Les hitbox ne bougent toujours pas.** Une frame fait la taille de la
 * texture d'origine, et `calerCorps` (entities.ts) se cale dessus. La
 * contrainte qui interdisait `setScale` sur un combattant vivant tient donc
 * encore, mais on n'en a plus besoin — le mouvement est dans les frames.
 */

/** Tout ce qui sait s'animer : un sprite, plus la famille de ses planches. */
export interface Anime extends Phaser.GameObjects.Sprite {
  /**
   * Le prefixe de ses animations : `hero-guerrier-p0`, `monstre-brute`,
   * `villageois-mineur-u0-s0`...
   *
   * On ne peut pas le deduire de `texture.key` : la planche s'appelle
   * `<famille>-planche`, et un villageois change de famille quand son corps
   * s'use — c'est le seul champ qui n'est pas `readonly`.
   */
  familleSprite: string;
}

/** Une famille est animee si le four a declare sa marche. */
function estAnimee(sprite: Anime): boolean {
  return sprite.scene.anims.exists(`${sprite.familleSprite}-marche`);
}

/** Les poses ponctuelles : elles interrompent la marche, puis lui rendent la main. */
export const POSES = {
  /** Coup porte : sec et bref, il doit coincider avec l'eclair d'impact. */
  attaque: 285,
  /** Incantation : plus ample et plus longue, on doit la voir venir. */
  incantation: 333,
  /** Encaissement : un sursaut, rien de plus — on le joue a chaque coup recu. */
  touche: 166,
  /**
   * Armement d'un monstre. La planche **tient sa derniere frame** une fois
   * jouee : la meme sert donc a l'essaim (150 ms) et a la brute (620 ms), et
   * c'est l'horodatage du monstre, pas l'animation, qui decide du depart.
   */
  charge: 620,
} as const;

export type TypePose = keyof typeof POSES;

export interface Pose {
  /** Pose ponctuelle en cours, ou null quand la marche a la main */
  type: TypePose | null;
  /** Instant de fin de la pose ponctuelle, en millisecondes */
  finPose: number;
}

export function nouvellePose(): Pose {
  return { type: null, finPose: 0 };
}

/**
 * Declenche une pose ponctuelle.
 *
 * @param vers position de la cible ; elle decide du cote vers lequel il se
 *        tourne. Sans cible, il garde son orientation.
 */
export function declencher(
  pose: Pose,
  sprite: Anime,
  type: TypePose,
  maintenant: number,
  vers?: { x: number },
): void {
  if (!estAnimee(sprite)) return;

  // Il frappe dans la direction ou il regarde : une fente vers la droite sur un
  // sprite retourne taperait derriere lui.
  if (vers) sprite.setFlipX(vers.x < sprite.x);

  pose.type = type;
  pose.finPose = maintenant + POSES[type];
  // `true` en second argument : rejouer depuis le debut. Deux coups d'affilee
  // doivent produire deux gestes, pas un geste qui continue.
  sprite.play(`${sprite.familleSprite}-${type}`, true);
}

/**
 * Choisit l'animation de fond. A appeler une fois par image.
 *
 * Deux etats seulement, la pose ponctuelle ayant la priorite : il marche, ou il
 * respire. C'est `play(cle, true)` qui fait le tri — l'appel est ignore si
 * cette animation-la tourne deja, donc rien ne redemarre a chaque image.
 *
 * @param vitesse norme de la vitesse actuelle, en pixels par seconde
 */
export function animer(sprite: Anime, pose: Pose, vitesse: number, maintenant: number): void {
  if (!estAnimee(sprite)) return;

  // Une pose ponctuelle court : on la laisse aller au bout.
  if (pose.type !== null && maintenant < pose.finPose) return;
  pose.type = null;

  const fond = vitesse > 1 ? "marche" : "repos";
  sprite.play(`${sprite.familleSprite}-${fond}`, true);
}

/**
 * La chute.
 *
 * Elle a le droit de faire ce que les autres n'ont pas — s'affaisser, s'effacer
 * — parce qu'elle commence par **couper le corps physique**. Plus de hitbox,
 * donc plus de hitbox a fausser.
 *
 * @param detruire vrai pour un monstre : son sprite ne sert plus a rien. Faux
 *        pour un heros, dont la scene continue de lire la position et l'etat.
 */
export function animerMort(
  sprite: Anime,
  options: { detruire?: boolean; onFin?: () => void } = {},
): void {
  // Tous les combattants ont un corps Arcade, mais pas les sprites decoratifs :
  // on lit le champ sans supposer qu'il existe.
  const corps = (sprite as { body?: Phaser.Physics.Arcade.Body | null }).body ?? null;
  if (corps) {
    corps.stop();
    corps.enable = false;
  }

  const cle = `${sprite.familleSprite}-mort`;
  if (!estAnimee(sprite)) {
    // Pas de planche pour lui : il s'eteint sur place, sans ceremonie.
    sprite.setAlpha(0.5);
    options.onFin?.();
    if (options.detruire) sprite.destroy();
    return;
  }

  sprite.play(cle, true);
  sprite.once(`animationcomplete-${cle}`, () => {
    options.onFin?.();
    if (options.detruire) sprite.destroy();
  });
}
