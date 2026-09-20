import type Phaser from "phaser";
import { MONDE, mondeCourant, EGLISE } from "../../core/carte";
import { cleCase, type PlanVillage, type Segment } from "../../core/village";
import {
  ouvrirLAtelier,
  peindreDegat,
  peindreDesRangees,
  peindreLaVignette,
  peindreLeSolDuVillage,
  terrainDIndex,
  preparerUnMorceau,
  semerLesDetailsDuMorceau,
  RAYON_DU_PARVIS,
  type Atelier,
  type CartePeinte,
  type DegatDuSol,
} from "./carte";
import { releverLeRelief, type Relief } from "./relief";

/**
 * La carte du monde, **peinte par morceaux** (DESIGN.md §4.29, 20 septembre 2026, dans la nuit).
 *
 * C'est le dernier chantier d'architecture du projet, et il tient en une
 * phrase : **la carte ne se peint plus d'un seul bloc**.
 *
 * ## Pourquoi
 *
 * Une carte d'un bloc, c'est une texture unique de la taille du monde, cuite
 * en une fois avant la premiere image. Trois choses en decoulaient, et les
 * trois etaient des murs :
 *
 * 1. **Le gel.** Mesure dans le navigateur : ouvrir une partie prenait **1,9 a
 *    3,7 s** sur la zone jouable. On le payait a chaque village refuse, parce
 *    que refuser tire un monde neuf. Et on le payait **trois fois avant de
 *    jouer** : le menu et l'ecran de choix de classe cuisaient la carte eux
 *    aussi, pour un monde qu'on n'allait meme pas jouer.
 * 2. **La taille de la carte avait un plafond dur.** Une texture unique ne
 *    depasse pas 4 096 pixels de cote sur beaucoup de cartes graphiques, ce
 *    qui bloquait le monde a deux fois sa largeur classique — x3 en surface
 *    passe encore (3 464 px), x4 n'aurait jamais pu. Aucun reglage n'y pouvait
 *    rien : c'est le materiel qui refuse.
 * 3. **L'errance continue etait bloquee.** Le §4.29 veut un monde qui se
 *    genere devant le joueur ; un monde qui se peint d'un bloc ne peut se
 *    fabriquer qu'a l'arret.
 *
 * ## Comment
 *
 * - **Une vignette d'abord** : le monde entier en tout petit (un pixel pour
 *   seize, une dizaine de millisemes), etiree sous tout le reste. Le monde a sa
 *   forme et ses couleurs **des la premiere image**, floue. C'est ce qu'on voit
 *   d'un morceau pas encore peint — jamais un trou noir.
 * - **Puis les morceaux**, des carres de 512 pixels du monde, peints **par
 *   tranches de rangees** dans un budget de quelques millisemes par image, **au
 *   plus pres du heros d'abord**. Chacun devient sa propre texture : soixante
 *   petites plutot qu'une enorme, ce qui leve du meme coup la limite des 4 096.
 * - **Ce qui s'ecrit dans la carte attend son morceau.** Le sol du village, un
 *   cratere, une terre brulee sont des **ecritures differees** : elles se
 *   posent des que le morceau vise est cuit, et tout de suite s'il l'est deja.
 *   Rien n'oblige donc a cuire un village qu'on ne voit pas encore.
 *
 * ⚠️ **Un morceau garde sa nature de sol, pas ses pixels.** Les pixels vivent
 * dans le canevas de sa texture — les y garder en double doublerait la memoire
 * (66 Mo a x3). On les relit par `getImageData` quand il faut ecrire dedans.
 * Seul le `terrains` reste en memoire, parce que tout ce qui s'ecrit demande
 * « est-ce de l'herbe ? » avant de poser un pixel.
 */

/**
 * Le cote d'un morceau, en pixels du monde.
 *
 * ⚠️ **384, et c'est une mesure, pas un gout.** Trois tailles ont ete essayees
 * dans le navigateur, en comptant les images par seconde pendant la cuisson
 * puis une fois tout cuit (`.tmp/ou-passe-le-temps.ts`, GL logiciel — une vraie
 * machine fera bien mieux, mais les **ecarts** restent vrais) :
 *
 * | Cote | pendant | apres | pire image |
 * |---|---|---|---|
 * | 512 | 14-15 i/s | **20 i/s** | 116-119 ms |
 * | **384** | **15-16 i/s** | **20 i/s** | **86-87 ms** |
 * | 256 | 16-17 i/s | 16-19 i/s | 74-80 ms |
 *
 * Le regime de croisiere sans carte a peindre est de **20 i/s** : c'est le
 * chiffre d'avant le chantier, et il ne doit pas bouger d'un poil. A 256 il
 * bouge — trop de morceaux a l'ecran, donc trop de changements de texture par
 * image, et on paierait ca **toute la partie** pour gagner sur les trois
 * premieres secondes. A 512 le regime est bon mais finir un morceau coute un
 * envoi d'un megaoctet au moteur, ce qui fait un hoquet. 384 tient les deux.
 */
export const COTE_DU_MORCEAU = 384;

/**
 * Le temps qu'on accorde a la cuisson dans une image, en millisemes.
 *
 * ⚠️ **Six, pas seize.** Une image dure seize millisemes a 60 images par
 * seconde, et le reste du jeu en demande la moitie. A dix, la cuisson volait
 * des images entieres au debut d'une partie — c'est-a-dire qu'elle remplacait
 * un gel de trois secondes par deux secondes de saccade, ce qui n'est pas un
 * progres.
 */
const BUDGET_PAR_IMAGE = 6;

/** Combien de rangees on peint avant de regarder l'heure. */
const RANGEES_PAR_PASSE = 24;

/** Le masque d'eau du monde courant, pour la houle : une texture a l'echelle 1/2. */
export const CLE_MASQUE_EAU = "carte-masque-eau";
export const ECHELLE_DU_MASQUE = 2;

/**
 * Le monde entier en tout petit.
 *
 * C'est le fond des morceaux pas encore peints — et le fond des deux ecrans
 * d'avant-partie, qui affichaient la carte entiere et payaient donc sa cuisson.
 */
export const CLE_VIGNETTE = "carte-vignette";

/** Les trois terrains que la houle a le droit de couvrir. */
const EAUX = new Set(["abysse", "mer", "haut-fond"]);

/** Une ecriture qui attend que son morceau soit cuit. */
interface Ecriture {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  poser(morceau: CartePeinte): void;
}

interface Morceau {
  cle: string;
  /** Le morceau, sans ses pixels une fois cuit : ils vivent dans la texture. */
  carte: CartePeinte;
  atelier: Atelier | null;
  /** Combien de ses rangees sont peintes. */
  rangees: number;
  cuit: boolean;
  texture: Phaser.Textures.CanvasTexture | null;
  image: Phaser.GameObjects.Image | null;
  /** Ses pixels d'avant toute ecriture, gardes a la premiere qui le salit. */
  vierge: Uint8ClampedArray<ArrayBuffer> | null;
  /** Vrai quand sa texture attend d'etre renvoyee au moteur. */
  aRenvoyer: boolean;
}

/**
 * La graine du monde dont la vignette est cuite : elle est globale au jeu,
 * comme toutes les textures de Phaser, et trois scenes la demandent.
 */
let vignetteCuitePour: number | null = null;

/**
 * Cuit la vignette du monde courant, si elle ne l'est pas deja.
 *
 * Appelee par **toutes** les scenes (`dessin/monde.ts`) : c'est tout ce que le
 * menu et l'ecran de choix de classe ont besoin de la carte.
 */
export function cuireLaVignette(scene: Phaser.Scene): boolean {
  const graine = mondeCourant().graine;
  if (scene.textures.exists(CLE_VIGNETTE) && vignetteCuitePour === graine) return false;
  if (scene.textures.exists(CLE_VIGNETTE)) scene.textures.remove(CLE_VIGNETTE);

  const vignette = peindreLaVignette();
  const texture = scene.textures.createCanvas(CLE_VIGNETTE, vignette.largeur, vignette.hauteur);
  const ctx = texture?.getContext();
  if (!texture || !ctx) return false;
  ctx.putImageData(new ImageData(vignette.pixels, vignette.largeur, vignette.hauteur), 0, 0);
  texture.refresh();
  vignetteCuitePour = graine;
  return true;
}

/**
 * Ouvre le masque d'eau du monde courant : vide, a l'echelle 1/2.
 *
 * ⚠️ **Il se remplit morceau par morceau**, comme la carte. Le calculer d'un
 * coup demandait la nature du sol en 1,5 million de points — mesure : **400 a
 * 800 ms**, c'est-a-dire la moitie du gel qu'on vient d'enlever a la carte. Les
 * morceaux, eux, connaissent deja leur terrain au pixel pres : chacun ecrit sa
 * part en arrivant, pour rien. La houle apparait donc en meme temps que le
 * morceau qui la porte, ce qui est exactement ce qu'on veut voir.
 */
function ouvrirLeMasqueDEau(scene: Phaser.Scene): Phaser.Textures.CanvasTexture | null {
  if (scene.textures.exists(CLE_MASQUE_EAU)) scene.textures.remove(CLE_MASQUE_EAU);
  return (
    scene.textures.createCanvas(
      CLE_MASQUE_EAU,
      Math.ceil(MONDE.largeur / ECHELLE_DU_MASQUE),
      Math.ceil(MONDE.hauteur / ECHELLE_DU_MASQUE),
    ) ?? null
  );
}

/**
 * La carte d'une partie : sa vignette, ses morceaux, et la file de ce qui
 * reste a cuire.
 *
 * Elle vit le temps d'une scene. Un monde neuf en fabrique une neuve — ses
 * textures portent le numero du monde, pour qu'une carte qui s'en va n'emporte
 * pas les textures de celle qui arrive (le voile de l'errance, §4.29, fait
 * vivre les deux le temps d'un pas).
 */
export class CarteDuMonde {
  private readonly morceaux: Morceau[] = [];
  private readonly enAttente: Ecriture[] = [];
  private readonly relief: Relief;
  private readonly colonnes: number;
  private readonly lignes: number;
  private vignette: Phaser.GameObjects.Image | null = null;
  /** Le masque d'eau de la houle, rempli par les morceaux en cuisant. */
  private masque: Phaser.Textures.CanvasTexture | null = null;
  private masqueARenvoyer = false;
  private prochainRenvoiDuMasque = 0;
  private profondeur = -1000;
  /** Ou regarder en priorite : le heros, ou la camera. */
  private foyer = { x: MONDE.largeur / 2, y: MONDE.hauteur / 2 };
  private detruite = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly prefixe = `carte-${mondeCourant().graine}`,
  ) {
    this.relief = releverLeRelief(MONDE.largeur, MONDE.hauteur);
    this.colonnes = Math.ceil(MONDE.largeur / COTE_DU_MORCEAU);
    this.lignes = Math.ceil(MONDE.hauteur / COTE_DU_MORCEAU);
    for (let l = 0; l < this.lignes; l += 1) {
      for (let c = 0; c < this.colonnes; c += 1) {
        const x0 = c * COTE_DU_MORCEAU;
        const y0 = l * COTE_DU_MORCEAU;
        this.morceaux.push({
          cle: `${this.prefixe}-${c}-${l}`,
          carte: preparerUnMorceau(
            x0,
            y0,
            Math.min(COTE_DU_MORCEAU, MONDE.largeur - x0),
            Math.min(COTE_DU_MORCEAU, MONDE.hauteur - y0),
          ),
          atelier: null,
          rangees: 0,
          cuit: false,
          texture: null,
          image: null,
          vierge: null,
          aRenvoyer: false,
        });
      }
    }
    cuireLaVignette(scene);
    this.masque = ouvrirLeMasqueDEau(scene);
  }

  /** Combien de morceaux, et combien sont cuits — pour les mesures et les tests. */
  get avancement(): { cuits: number; total: number } {
    return { cuits: this.morceaux.filter((m) => m.cuit).length, total: this.morceaux.length };
  }

  /**
   * Pose la vignette et les morceaux dans la scene.
   *
   * La vignette est **juste dessous** : elle ne disparait jamais, elle se fait
   * simplement recouvrir morceau par morceau.
   */
  poser(profondeur = -1000): void {
    this.profondeur = profondeur;
    this.vignette = this.scene.add
      .image(0, 0, CLE_VIGNETTE)
      .setOrigin(0)
      .setDisplaySize(MONDE.largeur, MONDE.hauteur)
      .setDepth(profondeur - 1);
  }

  /** Ou cuire en priorite : le plus pres de ce point d'abord. */
  regarder(x: number, y: number): void {
    this.foyer.x = x;
    this.foyer.y = y;
  }

  /**
   * Avance la cuisson dans le budget d'une image.
   *
   * **Le plus proche du foyer d'abord** : ce qu'on a sous les yeux se peint
   * avant le fond de la carte, et le joueur ne voit jamais la vignette la ou il
   * marche.
   */
  avancer(): void {
    if (this.detruite) return;
    const fin = performance.now() + BUDGET_PAR_IMAGE;
    // ⚠️ **Un morceau fini par image, jamais deux.** Finir un morceau, c'est
    // fabriquer un canevas de 512 sur 512 et l'envoyer au moteur : un megaoctet.
    // Le budget de six millisemes ne compte pas cet envoi-la, et deux dans la
    // meme image donnaient des a-coups de 190 ms — un gel de moins, un
    // hoquet de plus, ce qui n'est pas le marche qu'on avait passe.
    const morceau = this.prochain();
    if (morceau) this.cuireUnPeu(morceau, fin);
    this.renvoyerLesTextures();
    this.cacherCeQuOnNeVoitPas();
  }

  /**
   * Cuit tout de suite, jusqu'au bout, les morceaux d'un rectangle du monde.
   *
   * ⚠️ **A n'utiliser que sur ce qu'on voit a la premiere image.** C'est du gel
   * assume : quatre morceaux de 512 coutent une centaine de millisemes. Tout le
   * reste passe par `avancer`.
   */
  cuireTout(x0: number, y0: number, x1: number, y1: number): void {
    for (const m of this.morceaux) {
      if (!this.touche(m, x0, y0, x1, y1)) continue;
      this.finir(m);
    }
    this.renvoyerLesTextures();
  }

  /** Cuit toute la carte d'un coup : les captures, les mesures, les tests. */
  toutCuire(): void {
    for (const m of this.morceaux) this.finir(m);
    this.renvoyerLesTextures();
  }

  /**
   * Ecrit dans la carte, a cet endroit — maintenant si le morceau est cuit,
   * plus tard sinon.
   *
   * C'est **le** point de passage de tout ce qui marque le sol : la place du
   * village, les rues, le parvis, un cratere, une terre brulee.
   */
  ecrire(ecriture: Ecriture): void {
    let differee = false;
    for (const m of this.morceaux) {
      if (!this.touche(m, ecriture.x0, ecriture.y0, ecriture.x1, ecriture.y1)) continue;
      if (m.cuit) this.appliquer(m, ecriture);
      else differee = true;
    }
    if (differee) this.enAttente.push(ecriture);
    this.renvoyerLesTextures();
  }

  /**
   * La carte redevient vierge : ce que la partie d'avant y avait ecrit s'en va.
   *
   * ⚠️ **Seuls les morceaux salis sont concernes**, et on garde leurs pixels
   * d'origine a la premiere ecriture plutot que la carte entiere. Un village
   * en salit six ou sept ; garder la carte vierge en double coutait trente
   * megaoctets a x2, et soixante-huit a x3.
   */
  redevenirVierge(): void {
    this.enAttente.length = 0;
    for (const m of this.morceaux) {
      if (!m.vierge || !m.texture) continue;
      const ctx = m.texture.getContext();
      ctx.putImageData(new ImageData(m.vierge, m.carte.largeur, m.carte.hauteur), 0, 0);
      m.vierge = null;
      m.aRenvoyer = true;
    }
    this.renvoyerLesTextures();
  }

  /** Rend toutes les textures de cette carte au moteur. */
  detruire(): void {
    this.detruite = true;
    this.vignette?.destroy();
    this.vignette = null;
    this.masque = null;
    for (const m of this.morceaux) {
      m.image?.destroy();
      m.image = null;
      m.atelier = null;
      m.vierge = null;
      if (m.texture && this.scene.textures.exists(m.cle)) this.scene.textures.remove(m.cle);
      m.texture = null;
    }
  }

  // ------------------------------------------------------------ la cuisson

  private prochain(): Morceau | null {
    let choisi: Morceau | null = null;
    let meilleure = Number.POSITIVE_INFINITY;
    for (const m of this.morceaux) {
      if (m.cuit) continue;
      // Un morceau commence se finit avant qu'un autre ne commence : la moitie
      // d'un morceau a l'ecran se verrait comme une marche.
      if (m.rangees > 0) return m;
      const cx = m.carte.x0 + m.carte.largeur / 2;
      const cy = m.carte.y0 + m.carte.hauteur / 2;
      const d = Math.hypot(cx - this.foyer.x, cy - this.foyer.y);
      if (d < meilleure) {
        meilleure = d;
        choisi = m;
      }
    }
    return choisi;
  }

  private cuireUnPeu(m: Morceau, fin: number): void {
    m.atelier ??= ouvrirLAtelier(m.carte, this.relief);
    while (m.rangees < m.carte.hauteur && performance.now() < fin) {
      const jusqua = Math.min(m.carte.hauteur, m.rangees + RANGEES_PAR_PASSE);
      peindreDesRangees(m.carte, m.atelier, m.rangees, jusqua);
      m.rangees = jusqua;
    }
    if (m.rangees >= m.carte.hauteur) this.terminer(m);
  }

  private finir(m: Morceau): void {
    if (m.cuit) return;
    m.atelier ??= ouvrirLAtelier(m.carte, this.relief);
    if (m.rangees < m.carte.hauteur) {
      peindreDesRangees(m.carte, m.atelier, m.rangees, m.carte.hauteur);
      m.rangees = m.carte.hauteur;
    }
    this.terminer(m);
  }

  /**
   * Le morceau est peint : on seme ses details, on le depose dans sa texture,
   * on **rend ses pixels** et on lui applique ce qui l'attendait.
   */
  private terminer(m: Morceau): void {
    if (m.atelier) semerLesDetailsDuMorceau(m.carte, m.atelier);
    // ⚠️ Une cle deja prise fait rendre `null` a Phaser, et le morceau ne
    // serait jamais declare cuit : la file tournerait a vide pour toujours.
    if (this.scene.textures.exists(m.cle)) this.scene.textures.remove(m.cle);
    const texture = this.scene.textures.createCanvas(m.cle, m.carte.largeur, m.carte.hauteur);
    const ctx = texture?.getContext();
    if (!texture || !ctx) {
      m.cuit = true;
      m.atelier = null;
      return;
    }
    ctx.putImageData(new ImageData(m.carte.pixels, m.carte.largeur, m.carte.hauteur), 0, 0);
    m.texture = texture;
    m.image = this.scene.add
      .image(m.carte.x0, m.carte.y0, m.cle)
      .setOrigin(0)
      .setDepth(this.profondeur);
    this.ecrireLEauDuMorceau(m);
    m.cuit = true;
    m.atelier = null;
    // ⚠️ Les pixels vivent desormais dans le canevas : les garder ici doublerait
    // la memoire de la carte. On garde le `terrains`, que toute ecriture lit.
    m.carte.pixels = new Uint8ClampedArray(new ArrayBuffer(0));
    for (const ecriture of this.enAttente) {
      if (this.touche(m, ecriture.x0, ecriture.y0, ecriture.x1, ecriture.y1)) this.appliquer(m, ecriture);
    }
    m.aRenvoyer = true;
  }

  // ----------------------------------------------------------- l'ecriture

  private touche(m: Morceau, x0: number, y0: number, x1: number, y1: number): boolean {
    return (
      x1 > m.carte.x0 &&
      y1 > m.carte.y0 &&
      x0 < m.carte.x0 + m.carte.largeur &&
      y0 < m.carte.y0 + m.carte.hauteur
    );
  }

  private appliquer(m: Morceau, ecriture: Ecriture): void {
    const texture = m.texture;
    if (!texture) return;
    const ctx = texture.getContext();
    const image = ctx.getImageData(0, 0, m.carte.largeur, m.carte.hauteur);
    // ⚠️ La premiere ecriture garde les pixels d'origine : c'est ce qui permet
    // a la carte de redevenir vierge sans la repeindre.
    m.vierge ??= new Uint8ClampedArray(image.data) as Uint8ClampedArray<ArrayBuffer>;
    ecriture.poser({
      x0: m.carte.x0,
      y0: m.carte.y0,
      largeur: m.carte.largeur,
      hauteur: m.carte.hauteur,
      pixels: image.data as Uint8ClampedArray<ArrayBuffer>,
      terrains: m.carte.terrains,
    });
    ctx.putImageData(image, 0, 0);
    m.aRenvoyer = true;
  }

  /**
   * Reporte l'eau de ce morceau dans le masque de la houle, a l'echelle 1/2.
   *
   * Un point sur deux dans chaque sens : soixante-cinq mille ecritures par
   * morceau, dans un tableau qu'on a deja sous la main. C'est gratuit compare
   * aux 1,5 million d'appels a la formule du terrain que coutait le masque
   * calcule d'un bloc.
   */
  private ecrireLEauDuMorceau(m: Morceau): void {
    const masque = this.masque;
    if (!masque) return;
    const ctx = masque.getContext();
    const i0 = Math.floor(m.carte.x0 / ECHELLE_DU_MASQUE);
    const j0 = Math.floor(m.carte.y0 / ECHELLE_DU_MASQUE);
    const l = Math.min(Math.ceil(m.carte.largeur / ECHELLE_DU_MASQUE), masque.width - i0);
    const h = Math.min(Math.ceil(m.carte.hauteur / ECHELLE_DU_MASQUE), masque.height - j0);
    if (l <= 0 || h <= 0) return;
    const image = ctx.createImageData(l, h);
    let eau = false;
    for (let j = 0; j < h; j += 1) {
      const y = Math.min(m.carte.hauteur - 1, j * ECHELLE_DU_MASQUE);
      for (let i = 0; i < l; i += 1) {
        const x = Math.min(m.carte.largeur - 1, i * ECHELLE_DU_MASQUE);
        if (!EAUX.has(terrainDIndex(m.carte.terrains[y * m.carte.largeur + x]!))) continue;
        const k = (j * l + i) * 4;
        image.data[k] = 255;
        image.data[k + 1] = 255;
        image.data[k + 2] = 255;
        image.data[k + 3] = 255;
        eau = true;
      }
    }
    // Un morceau de plaine n'a rien a dire au masque : on ne renvoie pas six
    // megaoctets pour ecrire du vide sur du vide.
    if (!eau) return;
    ctx.putImageData(image, i0, j0);
    this.masqueARenvoyer = true;
  }

  private renvoyerLesTextures(): void {
    // ⚠️ **Le masque d'eau est la texture la plus chere du jeu** : il couvre le
    // monde entier a l'echelle 1/2, soit six megaoctets renvoyes au moteur a
    // chaque fois. Mesure : c'est lui qui faisait tomber le jeu de vingt a
    // treize images par seconde pendant la cuisson. On ne le renvoie donc que
    // s'il a **vraiment** change — un morceau sans une goutte d'eau n'y touche
    // pas — et cinq fois par seconde au plus. La houle apparait un cinquieme de
    // seconde apres son morceau : personne ne peut le voir.
    if (this.masqueARenvoyer && performance.now() >= this.prochainRenvoiDuMasque) {
      this.masqueARenvoyer = false;
      this.prochainRenvoiDuMasque = performance.now() + 200;
      this.masque?.refresh();
    }
    for (const m of this.morceaux) {
      if (!m.aRenvoyer) continue;
      m.aRenvoyer = false;
      m.texture?.refresh();
    }
  }

  /**
   * Ce qui est hors de l'ecran ne se dessine pas.
   *
   * Phaser ne coupe pas les images au cadre de la camera : soixante-trois
   * morceaux, ce sont soixante-trois quadrilateres et autant de changements de
   * texture **par image**, meme quand on n'en voit que quatre (§4.17).
   */
  private cacherCeQuOnNeVoitPas(): void {
    const vue = this.scene.cameras.main?.worldView;
    if (!vue) return;
    const marge = 64;
    const x0 = vue.x - marge;
    const y0 = vue.y - marge;
    const x1 = vue.right + marge;
    const y1 = vue.bottom + marge;
    // ⚠️ **La vignette s'efface des qu'on ne voit plus que du cuit.** C'est une
    // image de la taille du monde : la laisser sous les morceaux, c'est
    // repeindre l'ecran entier une fois de plus **a chaque image**, pour rien.
    // Mesure : deux a trois images par seconde, tout le reste de la partie.
    let manque = false;
    for (const m of this.morceaux) {
      const dedans = this.touche(m, x0, y0, x1, y1);
      if (dedans && !m.cuit) manque = true;
      if (m.image) m.image.setVisible(dedans);
    }
    this.vignette?.setVisible(manque);
  }
}

// ------------------------------------------------ ce qui s'ecrit dans la carte

/**
 * Abime le sol du monde, a cet endroit (§4.21, §4.24).
 *
 * @param rayon en pixels du monde ; le bord tremble autour.
 */
export function abimerLeSol(
  carte: CarteDuMonde | null,
  x: number,
  y: number,
  degat: DegatDuSol,
  rayon: number,
): void {
  if (!carte) return;
  const marge = Math.ceil(rayon * 1.2);
  const sel = Math.round(x * 7 + y * 13) & 0xffff;
  carte.ecrire({
    x0: x - marge,
    y0: y - marge,
    x1: x + marge,
    y1: y + marge,
    poser(morceau) {
      peindreDegat(
        morceau.pixels,
        morceau.largeur,
        morceau.hauteur,
        x - morceau.x0,
        y - morceau.y0,
        rayon,
        degat,
        sel,
      );
    },
  });
}

/**
 * Peint le sol de ce village dans la carte du monde (§4.24).
 *
 * ⚠️ **Ca n'oblige pas a cuire le village.** Pendant la marche, on parait a
 * l'autre bout de la carte et le village n'est qu'une fumee a l'horizon : son
 * sol est une **ecriture differee**, posee quand ses morceaux cuisent — donc,
 * au plus tard, quand on arrive devant.
 */
export function dessinerLeSolDuVillage(
  carte: CarteDuMonde | null,
  plan: PlanVillage,
  rues: Segment[],
): void {
  if (!carte) return;
  carte.redevenirVierge();

  const CASE = 32;
  const enceinte = new Set(plan.enceinte.map((mur) => cleCase(mur.colonne, mur.ligne)));
  const place = [...plan.place]
    .filter((clef) => !enceinte.has(clef))
    .map((clef) => {
      const [colonne, ligne] = clef.split(",").map(Number) as [number, number];
      return { colonne, ligne };
    });
  const parvis = { x: EGLISE.x, y: EGLISE.y, rayon: RAYON_DU_PARVIS };

  // Le cadre de tout ce qui va s'ecrire : c'est lui qui dit quels morceaux
  // sont concernes.
  let x0 = parvis.x - parvis.rayon - 12;
  let y0 = parvis.y - parvis.rayon - 12;
  let x1 = parvis.x + parvis.rayon + 12;
  let y1 = parvis.y + parvis.rayon + 12;
  const etendre = (ax: number, ay: number, bx: number, by: number) => {
    x0 = Math.min(x0, ax);
    y0 = Math.min(y0, ay);
    x1 = Math.max(x1, bx);
    y1 = Math.max(y1, by);
  };
  for (const c of place) {
    etendre(c.colonne * CASE - 12, c.ligne * CASE - 12, (c.colonne + 1) * CASE + 12, (c.ligne + 1) * CASE + 12);
  }
  for (const s of rues) {
    etendre(
      Math.min(s.de.x, s.a.x) - 14,
      Math.min(s.de.y, s.a.y) - 14,
      Math.max(s.de.x, s.a.x) + 14,
      Math.max(s.de.y, s.a.y) + 14,
    );
  }

  carte.ecrire({
    x0,
    y0,
    x1,
    y1,
    poser(morceau) {
      peindreLeSolDuVillage(morceau, { place, rues, parvis }, plan.graine);
    },
  });
}
