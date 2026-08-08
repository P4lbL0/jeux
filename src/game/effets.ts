import Phaser from "phaser";

/**
 * La « juice » du combat : impacts, morts, tranches, secousses.
 *
 * Tout ce qui est fabrique ici est **detache** — aucun corps physique, aucune
 * entite de jeu. C'est la regle du §0 du brief combat : sur un combattant
 * vivant on ne touche qu'a l'angle (voir `poses.ts`), donc les effets qui
 * changent d'echelle ou d'origine se font sur des sprites a part.
 *
 * Deux contraintes de performance guident tout le fichier :
 *
 * 1. Les emetteurs de particules sont **crees une fois** dans
 *    `preparerEffets(scene)` puis reutilises. Il y a jusqu'a 240 ennemis a
 *    l'ecran : creer/detruire un emetteur par coup ferait tomber le jeu.
 * 2. Ce qui doit s'arreter tout seul (le hitstop) est pilote par un
 *    **horodatage** relu dans `majEffets(...)`, pas par une minuterie — c'est
 *    le style du reste du code, et ca survit a une pause de menu.
 */

/** Cle de la texture de particule fabriquee au code. */
const PARTICULE = "particule";

/** Cote de la texture de particule, en pixels. */
const TAILLE_PARTICULE = 6;

/**
 * Duree d'un effet, en millisecondes.
 *
 * Bref et sec : le coup, l'eclair d'impact et la pose d'attaque doivent se lire
 * comme un **seul** evenement, pas comme trois.
 */
const DUREE_TRANCHE = 150;

/** Plafond de sprites decoratifs vivants a un instant donne. */
const MAX_DECORS = 40;

/**
 * Gerbes d'impact autorisees par image.
 *
 * Une aura de flammes qui bat sur vingt ennemis, une chaine d'eclairs, un
 * ultime de zone : les degats arrivent par paquets, et sans quota on emettrait
 * des centaines de particules dans la meme image. Passe ce plafond, le coup
 * porte quand meme — il ne fait juste plus d'etincelles.
 */
const MAX_ECLATS_PAR_IMAGE = 14;

interface Pool {
  impact: Phaser.GameObjects.Particles.ParticleEmitter;
  mort: Phaser.GameObjects.Particles.ParticleEmitter;
  /** Instant de fin du micro-gel ; 0 quand il n'y en a pas */
  finHitstop: number;
  /** Sprites decoratifs actuellement vivants, pour ne pas noyer l'ecran */
  decors: number;
  /** Gerbes deja emises dans l'image en cours ; remis a zero par `majEffets` */
  eclats: number;
}

/**
 * Les emetteurs, par scene.
 *
 * Une `WeakMap` plutot qu'un champ de scene : `effets.ts` n'a pas a connaitre
 * `ArenaScene`, et une scene oubliee ne retient rien.
 */
const pools = new WeakMap<Phaser.Scene, Pool>();

/** Tout ce qui sait clignoter en blanc quand il encaisse. */
export interface Encaissant {
  flashJusqua: number;
}

/** Force d'une secousse de camera, par intention. */
export type ForceSecousse = "leger" | "moyen" | "fort";

const SECOUSSES: Record<ForceSecousse, { duree: number; amplitude: number }> = {
  leger: { duree: 90, amplitude: 0.003 },
  moyen: { duree: 160, amplitude: 0.006 },
  fort: { duree: 300, amplitude: 0.011 },
};

/**
 * A appeler une fois dans le `create()` de la scene, **avant** tout effet.
 *
 * Rappelable sans risque : une scene qui redemarre a perdu ses emetteurs avec
 * ses autres objets, et cette fonction les refait.
 */
export function preparerEffets(scene: Phaser.Scene): void {
  creerTextureParticule(scene);

  // `emitting: false` : l'emetteur ne crache rien tout seul, on lui demande des
  // bouffees ponctuelles avec `emitParticleAt`.
  const impact = scene.add
    .particles(0, 0, PARTICULE, {
      lifespan: { min: 130, max: 260 },
      speed: { min: 40, max: 150 },
      scale: { start: 0.9, end: 0 },
      alpha: { start: 0.95, end: 0 },
      gravityY: 120,
      emitting: false,
    })
    .setDepth(9000);

  const mort = scene.add
    .particles(0, 0, PARTICULE, {
      lifespan: { min: 220, max: 460 },
      speed: { min: 30, max: 190 },
      scale: { start: 1.4, end: 0 },
      alpha: { start: 0.9, end: 0 },
      gravityY: 60,
      emitting: false,
    })
    .setDepth(9000);

  pools.set(scene, { impact, mort, finHitstop: 0, decors: 0, eclats: 0 });
}

/**
 * Une particule : un petit losange blanc.
 *
 * Le dessin au code est interdit pour les **personnages** (voir `art.ts`), pas
 * pour une gerbe d'etincelles de six pixels — un PNG n'y changerait rien, et la
 * teinte est de toute facon donnee au moment de l'emission.
 */
function creerTextureParticule(scene: Phaser.Scene): void {
  if (scene.textures.exists(PARTICULE)) return;
  const c = TAILLE_PARTICULE / 2;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.fillStyle(0xffffff, 1);
  g.fillPoints(
    [
      new Phaser.Geom.Point(c, 0),
      new Phaser.Geom.Point(TAILLE_PARTICULE, c),
      new Phaser.Geom.Point(c, TAILLE_PARTICULE),
      new Phaser.Geom.Point(0, c),
    ],
    true,
  );
  g.generateTexture(PARTICULE, TAILLE_PARTICULE, TAILLE_PARTICULE);
  g.destroy();
}

/**
 * Gerbe courte a l'endroit du coup.
 *
 * La teinte est posee **juste avant** l'emission : une particule fige sa
 * couleur en naissant, donc celles qui volent encore gardent la leur.
 */
export function eclatImpact(
  scene: Phaser.Scene,
  x: number,
  y: number,
  couleur: number,
  quantite = 5,
): void {
  const pool = pools.get(scene);
  if (!pool || pool.eclats >= MAX_ECLATS_PAR_IMAGE) return;
  pool.eclats += 1;
  pool.impact.setParticleTint(couleur);
  pool.impact.emitParticleAt(x, y, quantite);
}

/** Le nuage de mort : plus large, plus lent, plus visible qu'un impact. */
export function poufMort(scene: Phaser.Scene, x: number, y: number, couleur: number): void {
  const pool = pools.get(scene);
  if (!pool) return;
  pool.mort.setParticleTint(couleur);
  pool.mort.emitParticleAt(x, y, 10);
}

/**
 * L'arc de tranche, oriente vers la cible.
 *
 * C'est la generalisation de l'arc qui vivait en dur dans `frapperAuContact` :
 * un sprite detache pose a mi-chemin de la portee, qui s'efface aussitot.
 *
 * @param versAngle direction du coup, en radians
 * @param portee longueur du geste en pixels ; elle decide de la taille de l'arc
 */
export function tranche(
  scene: Phaser.Scene,
  x: number,
  y: number,
  versAngle: number,
  couleur: number,
  portee = 44,
): void {
  const pool = pools.get(scene);
  if (!pool || pool.decors >= MAX_DECORS) return;

  const arc = scene.add
    .image(x + Math.cos(versAngle) * portee * 0.5, y + Math.sin(versAngle) * portee * 0.5, "impact")
    .setDepth(y + 1)
    .setScale(portee / 22)
    .setAlpha(0.45)
    .setTint(couleur);

  pool.decors += 1;
  scene.tweens.add({
    targets: arc,
    alpha: 0,
    duration: DUREE_TRANCHE,
    onComplete: () => {
      pool.decors -= 1;
      arc.destroy();
    },
  });
}

/**
 * L'eclair blanc d'encaissement.
 *
 * On ne touche pas au sprite ici : on **date** le flash, et le porteur remet sa
 * teinte a jour a l'image suivante. C'est ce que faisait deja `Ennemi`
 * (`flashJusqua`), et c'est ce qui evite des centaines de minuteries quand une
 * capacite de zone touche trente cibles d'un coup.
 */
export function flashCible(cible: Encaissant, maintenant: number, duree = 90): void {
  cible.flashJusqua = Math.max(cible.flashJusqua, maintenant + duree);
}

/** Secousse de camera, par intention plutot que par nombres magiques. */
export function secousse(scene: Phaser.Scene, force: ForceSecousse): void {
  const { duree, amplitude } = SECOUSSES[force];
  scene.cameras.main.shake(duree, amplitude);
}

/**
 * Micro-gel sur gros impact : le monde ralentit une fraction de seconde, ce qui
 * donne du poids au coup.
 *
 * Tres court a dessein (30-60 ms) : au-dela, ca ne se lit plus comme un impact
 * mais comme une chute de framerate. La restauration passe par `majEffets` —
 * une minuterie serait perdue si la scene se mettait en pause entre-temps.
 */
export function hitstop(scene: Phaser.Scene, ms = 45): void {
  const pool = pools.get(scene);
  if (!pool) return;
  // Un gel deja en cours l'emporte : deux coups simultanes ne doivent pas
  // s'additionner en un ralenti interminable.
  if (pool.finHitstop > 0) return;
  pool.finHitstop = scene.time.now + ms;
  // Dans Arcade, `timeScale` est un diviseur de vitesse : au-dessus de 1, tout
  // ralentit.
  scene.physics.world.timeScale = 3;
}

/**
 * A appeler une fois par image, depuis `update`.
 *
 * Elle rouvre le quota de gerbes et rend la main au monde quand le micro-gel a
 * fait son temps.
 *
 * @param actif faux quand la scene est en pause ou terminee : on degele alors
 *        immediatement plutot que de laisser le monde au ralenti.
 */
export function majEffets(scene: Phaser.Scene, maintenant: number, actif = true): void {
  const pool = pools.get(scene);
  if (!pool) return;
  pool.eclats = 0;

  if (pool.finHitstop === 0) return;
  if (actif && maintenant < pool.finHitstop) return;
  pool.finHitstop = 0;
  scene.physics.world.timeScale = 1;
}

/** Ce qui peut etre repousse : une position, une vitesse, et une date de fin. */
export interface Repoussable {
  x: number;
  y: number;
  /** Instant jusqu'auquel le deplacement normal doit laisser la main */
  reculJusqua: number;
  setVelocity(x: number, y: number): unknown;
}

/**
 * Recul : une breve impulsion opposee a l'attaquant.
 *
 * Volontairement faible et courte. La vitesse d'un combattant est **reecrite a
 * chaque image** par son deplacement ; c'est `reculJusqua` qui dit a ce
 * deplacement de patienter, sinon l'impulsion serait effacee avant d'avoir
 * bouge quoi que ce soit. Et un heros qu'on ne pilote plus pendant une
 * demi-seconde a chaque coup recu est un heros injouable : d'ou les 110 ms.
 */
export function recul(
  cible: Repoussable,
  depuisX: number,
  depuisY: number,
  force: number,
  maintenant: number,
  duree = 110,
): void {
  const angle = Phaser.Math.Angle.Between(depuisX, depuisY, cible.x, cible.y);
  cible.setVelocity(Math.cos(angle) * force, Math.sin(angle) * force);
  cible.reculJusqua = maintenant + duree;
}
