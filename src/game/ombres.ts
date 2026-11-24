import Phaser from "phaser";
import { decorParCle } from "./dessin/decor";
import {
  fabriquerLOmbre,
  pixelsDeLOmbre,
  reglageDOmbre,
  MARGE_D_OMBRE,
  type OmbreAuSol,
  type OmbreFabriquee,
} from "./dessin/ombres";

/**
 * Les ombres au pied de ce qui est pose, dans la scene (DESIGN.md §4.30,
 * chantier 6.45, 24 novembre 2026). Le calcul est dans `dessin/ombres.ts`.
 *
 * **Deux chemins, selon que l'objet bouge ou non.**
 *
 * - Les **arbres et les rochers** sont des milliers, et rien ne les deplace :
 *   leur ombre est **peinte dans le sol** quand son morceau cuit
 *   (`CarteDuMonde.semerLesOmbres`). Elle ne coute rien a l'image.
 * - **Ce qui est bati** (maisons, eglise, murs, tours, portes, chantiers) et le
 *   petit decor du village change : une porte s'ouvre, un mur tombe en ruine,
 *   une maison se deplace. Chacun a donc **une image d'ombre qui le suit**
 *   (`OmbresDuBati`), sous tous les personnages. Une centaine d'objets au plus,
 *   et le suivi ne fait que comparer quelques nombres par image.
 */

/** Sous les personnages, les cadavres et les douves ; au-dessus du sol, des champs et des flaques. */
const PROFONDEUR_DES_OMBRES = -590;

/** Les ombres deja fabriquees, par cle de sprite : une fois pour tout le jeu, comme les textures. */
const fabriquees = new Map<string, OmbreFabriquee | null>();

/** La cle de la texture d'ombre d'un sprite. */
export function cleDOmbre(cle: string): string {
  return `ombre:${cle}`;
}

/**
 * L'ombre d'une cle de sprite, fabriquee a la premiere demande depuis
 * l'opacite de sa texture ; `null` si elle n'en jette pas (un champ, une douve)
 * ou si la texture n'existe pas encore.
 */
export function ombreDeLaCle(scene: Phaser.Scene, cle: string): OmbreFabriquee | null {
  const deja = fabriquees.get(cle);
  if (deja !== undefined) return deja;
  const reglage = reglageDOmbre(cle);
  if (!reglage) {
    fabriquees.set(cle, null);
    return null;
  }
  // ⚠️ Pas de cache sur une texture absente : elle peut etre cuite plus tard
  // (les murs se cuisent a l'installation).
  if (!scene.textures.exists(cle)) return null;
  const lue = lireLOpacite(scene, cle);
  if (!lue) return null;
  const ancreY = cle.startsWith("decor-") ? decorParCle(cle).origineY * lue.hauteur : lue.hauteur - 1;
  const ombre = fabriquerLOmbre(lue.alpha, lue.largeur, lue.hauteur, reglage, ancreY);
  const gardee = ombre.vide ? null : ombre;
  fabriquees.set(cle, gardee);
  return gardee;
}

/** L'opacite des pixels d'une texture, lue dans un canevas jetable. */
function lireLOpacite(
  scene: Phaser.Scene,
  cle: string,
): { alpha: Uint8Array; largeur: number; hauteur: number } | null {
  const frame = scene.textures.getFrame(cle);
  const source = frame?.source.image as CanvasImageSource | undefined;
  if (!frame || !source) return null;
  const largeur = frame.cutWidth;
  const hauteur = frame.cutHeight;
  const toile = document.createElement("canvas");
  toile.width = largeur;
  toile.height = hauteur;
  const ctx = toile.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(source, frame.cutX, frame.cutY, largeur, hauteur, 0, 0, largeur, hauteur);
  const rgba = ctx.getImageData(0, 0, largeur, hauteur).data;
  const alpha = new Uint8Array(largeur * hauteur);
  for (let i = 0; i < alpha.length; i += 1) alpha[i] = rgba[i * 4 + 3]!;
  return { alpha, largeur, hauteur };
}

/** La texture d'ombre d'une cle, cuite a la premiere demande. */
function textureDOmbre(scene: Phaser.Scene, cle: string, ombre: OmbreFabriquee): string {
  const nom = cleDOmbre(cle);
  if (scene.textures.exists(nom)) return nom;
  const texture = scene.textures.createCanvas(nom, ombre.largeur, ombre.hauteur);
  const ctx = texture?.getContext();
  if (!texture || !ctx) return nom;
  ctx.putImageData(new ImageData(pixelsDeLOmbre(ombre), ombre.largeur, ombre.hauteur), 0, 0);
  texture.refresh();
  return nom;
}

/**
 * L'ombre d'un decor fixe, prete a etre peinte dans le sol : ou tombe le coin
 * de son cadre dans le monde. A appeler juste apres avoir pose le decor.
 */
export function ombreAuSolDe(objet: Phaser.GameObjects.Image): OmbreAuSol | null {
  const ombre = ombreDeLaCle(objet.scene, objet.texture.key);
  if (!ombre) return null;
  return {
    x0: objet.x - objet.originX * objet.width - MARGE_D_OMBRE,
    y0: objet.y - objet.originY * objet.height - MARGE_D_OMBRE,
    ombre,
    miroir: objet.flipX,
  };
}

// ------------------------------------------------------------ ce qui bouge

interface Suivi {
  objet: Phaser.GameObjects.Image;
  image: Phaser.GameObjects.Image | null;
  /** La cle de sprite dont l'ombre est posee ; vide avant la premiere. */
  cle: string;
  ombre: OmbreFabriquee | null;
  x: number;
  y: number;
  ox: number;
  oy: number;
  miroir: boolean;
  echelle: number;
  visible: boolean;
}

/** Le suivi de chaque scene : un objet se declare a sa scene sans la connaitre. */
const parScene = new WeakMap<Phaser.Scene, OmbresDuBati>();

/**
 * Donne une ombre qui le suit a un objet bati ou au petit decor du village.
 * Sans effet dans une scene qui ne suit pas les ombres (le menu, la planche).
 */
export function suivreLOmbre(objet: Phaser.GameObjects.Image): void {
  parScene.get(objet.scene)?.suivre(objet);
}

/**
 * Les ombres de ce qui bouge : une image par objet, qui suit sa cle, sa place,
 * son miroir et sa visibilite, et disparait avec lui.
 *
 * ⚠️ **Un suivi par image, pas un evenement par changement.** Une porte change
 * de texture en s'ouvrant, un mur en recevant une voisine, une maison en
 * tombant : guetter chaque systeme oublierait toujours le prochain. Comparer
 * sept valeurs pour une centaine d'objets coute moins qu'un monstre.
 */
export class OmbresDuBati {
  private readonly suivis: Suivi[] = [];

  constructor(private readonly scene: Phaser.Scene) {
    parScene.set(scene, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.detruire());
  }

  /** Combien d'ombres suivent un objet : pour les mesures et les scripts. */
  get nombre(): number {
    return this.suivis.length;
  }

  suivre(objet: Phaser.GameObjects.Image): void {
    if (this.suivis.some((s) => s.objet === objet)) return;
    const suivi: Suivi = { objet, image: null, cle: "", ombre: null, x: NaN, y: NaN, ox: NaN, oy: NaN, miroir: false, echelle: NaN, visible: false };
    this.suivis.push(suivi);
    this.accorder(suivi);
  }

  /** A appeler a chaque image, meme en pause : on bâtit en pause (§4.24). */
  mettreAJour(): void {
    for (let i = this.suivis.length - 1; i >= 0; i -= 1) {
      const s = this.suivis[i]!;
      if (!s.objet.active || !s.objet.scene) {
        s.image?.destroy();
        this.suivis[i] = this.suivis[this.suivis.length - 1]!;
        this.suivis.pop();
        continue;
      }
      this.accorder(s);
    }
  }

  detruire(): void {
    for (const s of this.suivis) s.image?.destroy();
    this.suivis.length = 0;
    if (parScene.get(this.scene) === this) parScene.delete(this.scene);
  }

  private accorder(s: Suivi): void {
    const o = s.objet;
    const cle = o.texture.key;
    let change = false;
    if (cle !== s.cle) {
      const ombre = ombreDeLaCle(this.scene, cle);
      // Une texture pas encore cuite : on reessaiera a l'image suivante.
      if (!ombre && reglageDOmbre(cle) && !this.scene.textures.exists(cle)) return;
      s.cle = cle;
      s.ombre = ombre;
      if (ombre) {
        const nom = textureDOmbre(this.scene, cle, ombre);
        if (s.image) s.image.setTexture(nom);
        else s.image = this.scene.add.image(o.x, o.y, nom).setDepth(PROFONDEUR_DES_OMBRES);
      }
      change = true;
    }
    const image = s.image;
    if (!image) return;
    const visible = o.visible && s.ombre !== null;
    if (change || visible !== s.visible) {
      s.visible = visible;
      image.setVisible(visible);
    }
    if (!visible || !s.ombre) return;
    if (change || o.x !== s.x || o.y !== s.y || o.originX !== s.ox || o.originY !== s.oy || o.flipX !== s.miroir || o.scaleX !== s.echelle) {
      s.x = o.x;
      s.y = o.y;
      s.ox = o.originX;
      s.oy = o.originY;
      s.miroir = o.flipX;
      s.echelle = o.scaleX;
      const M = s.ombre.marge;
      image
        .setPosition(o.x, o.y)
        .setOrigin((o.originX * o.width + M) / s.ombre.largeur, (o.originY * o.height + M) / s.ombre.hauteur)
        .setFlipX(o.flipX)
        .setScale(o.scaleX, o.scaleY);
    }
  }
}
