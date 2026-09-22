import Phaser from "phaser";
import type { Meteo } from "../core/meteo";
import type { Phase } from "../core/cycle";
import type { Rng } from "../core/rng";
import { CLE_PLUIE_LOIN, CLE_PLUIE_PRES, COTE_TUILE, cuireLesRideaux } from "./dessin/pluie";

/**
 * Ce qu'on voit quand le ciel tombe (DESIGN.md §4.21).
 *
 * **Quatre objets, crees une fois** : deux rideaux qui defilent, un
 * assombrissement, un eclair. Rien n'est fabrique en jeu (§4.17, regle 3), et
 * rien n'est minute par une horloge Phaser (regle 4) : on garde des instants et
 * on les compare a l'horloge de la scene.
 *
 * Tout est colle a la camera (`scrollFactor` a zero) : il pleut sur l'ecran,
 * pas sur le monde. Une pluie posee sur le monde aurait demande une surface
 * grande comme la carte — 3 464 x 2 598 — pour le meme resultat a l'oeil.
 */

/** Ce que chaque temps donne comme intensite, de 0 a 1. */
const FORCE = { sec: 0, pluie: 0.72, orage: 1 } as const;

/** Vitesse de defilement d'un rideau, en pixels par seconde. */
const VITESSE_PRES = 1500;
const VITESSE_LOIN = 620;

/** Ce que l'averse assombrit, au plus fort. */
const VOILE_MAX = 0.32;

/** L'eclair : sa duree et sa force. */
const ECLAIR_MS = 180;
/**
 * ⚠️ Lu sur capture : a 0,55 en opacite simple, le flash **delavait** la nuit
 * en un gris uniforme — un brouillard, pas un eclair. En lumiere **additive**,
 * il eclaire les ombres sans ecraser ce qui est deja clair, et le village
 * ressort au lieu de disparaitre. Deuxieme lecture de capture : 0,62 en
 * additif saturait autant : la valeur juste est basse, et la couleur est un
 * **bleu froid**, pas un blanc — un ajout blanc delave, un ajout bleu teinte.
 */
const ECLAIR_ALPHA = 0.3;

/** Secondes pour passer du sec a l'averse pleine, et l'inverse. */
const FONDU = 2.5;

export class Pluie {
  private readonly loin: Phaser.GameObjects.TileSprite;
  private readonly pres: Phaser.GameObjects.TileSprite;
  private readonly voile: Phaser.GameObjects.Rectangle;
  private readonly eclair: Phaser.GameObjects.Rectangle;

  /** L'intensite affichee, de 0 a 1. Elle rejoint la cible en fondu. */
  private force = 0;
  /** L'instant du prochain eclair, sur l'horloge de la scene */
  private prochainEclair = 0;
  /** L'instant ou le flash en cours s'eteint */
  private finDuFlash = 0;

  /** Le zoom de camera pour lequel les rideaux sont regles en ce moment */
  private zoomRegle = 0;

  constructor(private readonly scene: Phaser.Scene) {
    cuireLesRideaux(scene);
    const { width, height } = scene.scale;

    // ⚠️ **Sous le voile de nuit (900) pour l'assombrissement, au-dessus pour
    // les gouttes** : une pluie peinte sous la nuit disparaitrait des le
    // crepuscule, alors que c'est la nuit qu'elle se voit le mieux.
    this.voile = scene.add
      .rectangle(-width, -height, width * 3, height * 3, 0x243040)
      .setOrigin(0)
      .setAlpha(0)
      .setScrollFactor(0)
      .setDepth(899);

    // ⚠️ **Trois fois l'ecran, centre dessus.** Colle a la camera, un rideau
    // subit quand meme son **zoom** : a la taille exacte de l'ecran, un dezoom
    // decouvrirait des bandes seches sur les bords.
    this.loin = scene.add
      .tileSprite(-width, -height, width * 3, height * 3, CLE_PLUIE_LOIN)
      .setOrigin(0)
      .setAlpha(0)
      .setScrollFactor(0)
      .setDepth(901);

    this.pres = scene.add
      .tileSprite(-width, -height, width * 3, height * 3, CLE_PLUIE_PRES)
      .setOrigin(0)
      .setAlpha(0)
      .setScrollFactor(0)
      .setDepth(902);

    // L'eclair passe **au-dessus de la nuit** : c'est tout l'interet, il rend
    // le village visible une fraction de seconde.
    this.eclair = scene.add
      .rectangle(-width, -height, width * 3, height * 3, 0x8fb6da)
      .setOrigin(0)
      .setAlpha(0)
      .setScrollFactor(0)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(903);

    scene.scale.on(Phaser.Scale.Events.RESIZE, this.redimensionner, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.scale.off(Phaser.Scale.Events.RESIZE, this.redimensionner, this);
    });
  }

  /**
   * Une image de pluie.
   *
   * @param delta millisecondes depuis l'image precedente
   * @param maintenant l'horloge de la scene
   */
  majorer(
    delta: number,
    maintenant: number,
    meteo: Meteo,
    phase: Phase,
    part: number,
    rng: Rng,
  ): void {
    const cible = meteo.ilPleut(phase, part) ? FORCE[meteo.temps] : 0;

    // Un fondu, jamais un interrupteur : une averse qui apparait d'un coup se
    // lit comme un bug d'affichage, pas comme un changement de temps.
    const pas = delta / 1000 / FONDU;
    this.force =
      this.force < cible ? Math.min(cible, this.force + pas) : Math.max(cible, this.force - pas);

    const secondes = delta / 1000;
    // Le defilement tourne meme a force nulle tant qu'il reste quelque chose a
    // l'ecran : sinon la derniere image du fondu resterait figee en l'air.
    if (this.force > 0) {
      this.pres.tilePositionY = (this.pres.tilePositionY + VITESSE_PRES * secondes) % COTE_TUILE;
      this.loin.tilePositionY = (this.loin.tilePositionY + VITESSE_LOIN * secondes) % COTE_TUILE;
      // Le vent : les deux rideaux ne derivent pas a la meme vitesse, ce qui
      // suffit a empecher l'oeil de les superposer.
      this.pres.tilePositionX = (this.pres.tilePositionX + 90 * secondes) % COTE_TUILE;
      this.loin.tilePositionX = (this.loin.tilePositionX + 34 * secondes) % COTE_TUILE;
    }

    // Les gouttes gardent leur taille **a l'ecran** quel que soit le zoom de
    // la camera : sans ca, dezoomer grossirait la pluie au lieu d'en montrer
    // davantage. Deux affectations par changement de zoom, rien par image.
    const zoom = this.scene.cameras.main.zoom;
    if (zoom !== this.zoomRegle && zoom > 0) {
      this.zoomRegle = zoom;
      this.pres.setTileScale(1 / zoom);
      this.loin.setTileScale(1 / zoom);
    }

    this.pres.setAlpha(this.force);
    this.loin.setAlpha(this.force * 0.85);
    this.voile.setAlpha(this.force * VOILE_MAX);

    this.majorerLEclair(maintenant, meteo, rng);
  }

  /**
   * Les eclairs (§4.21).
   *
   * Un seul rectangle, deux horodatages : le §4.17 interdit une minuterie par
   * evenement, et un orage en produirait une toutes les dix secondes.
   */
  private majorerLEclair(maintenant: number, meteo: Meteo, rng: Rng): void {
    if (!meteo.orage || this.force <= 0) {
      if (this.eclair.alpha > 0) this.eclair.setAlpha(0);
      // On repousse l'echeance : sans ca, le premier orage venu declencherait
      // un eclair a la premiere image, avant meme que le rideau soit visible.
      this.prochainEclair = 0;
      return;
    }

    if (this.prochainEclair === 0) {
      this.prochainEclair = maintenant + meteo.delaiProchainEclair(rng);
      return;
    }

    if (maintenant >= this.prochainEclair && maintenant >= this.finDuFlash) {
      this.finDuFlash = maintenant + ECLAIR_MS;
      this.prochainEclair = maintenant + meteo.delaiProchainEclair(rng);
    }

    if (maintenant < this.finDuFlash) {
      // Une decroissance, pas un creneau : un flash carre fait mal aux yeux et
      // ne ressemble a rien. Deux battements dans la meme fenetre — un eclair
      // frappe rarement une seule fois.
      const reste = (this.finDuFlash - maintenant) / ECLAIR_MS;
      const battement = 0.55 + 0.45 * Math.cos(reste * Math.PI * 4);
      this.eclair.setAlpha(reste * battement * ECLAIR_ALPHA * this.force);
    } else if (this.eclair.alpha > 0) {
      this.eclair.setAlpha(0);
    }
  }

  /** Vrai quand un eclair frappe a cet instant : le son et le feu s'y accrochent. */
  get eclaire(): boolean {
    return this.eclair.alpha > 0.01;
  }

  private redimensionner(): void {
    const { width, height } = this.scene.scale;
    // Les quatre couches couvrent trois fois l'ecran, pour la meme raison :
    // un dezoom ne doit jamais decouvrir de bord.
    for (const couche of [this.voile, this.eclair, this.pres, this.loin]) {
      couche.setSize(width * 3, height * 3);
      couche.setPosition(-width, -height);
    }
  }
}
