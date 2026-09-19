import type Phaser from "phaser";
import { MONDE } from "../../core/carte";
import { usureDe, type CaseFoulee } from "../../core/chemins";
import { bruit, bruitLisse } from "./bruit";
import { SABLE, melanger, type Matiere } from "./palette";
import { TERRE } from "./sol";

/**
 * Les chemins qui s'usent, dessines (DESIGN.md §4.24, §4.30).
 *
 * La place et les rues sont **ecrites dans la carte cuite**, une fois par
 * partie. Les chemins, eux, bougent tout le temps : une case se creuse, une
 * autre palit, une troisieme s'efface. Les ecrire dans la carte demanderait de
 * savoir ce qu'il y avait dessous pour l'effacer — et dessous, il y a la rue,
 * la place, puis chaque brulure et chaque cratere de la partie. On les peint
 * donc dans **une couche a part**, transparente, de la taille du monde, posee
 * juste au-dessus de la carte : effacer, c'est rendre des pixels transparents.
 *
 * ⚠️ Comme la carte, cette couche n'est **jamais redessinee par image**
 * (§4.17 regle 3) : elle change quand une case change, par zone, et n'est
 * renvoyee au moteur qu'une fois par image, quel que soit le nombre de cases.
 */

export const CLE_CHEMINS = "chemins";

/** Le rayon d'un pas de chemin, en pixels : un peu plus qu'une demi-case, pour que deux voisines se rejoignent. */
export const RAYON_CHEMIN = 19;

/** La marge autour d'un pas, ou son bord tremblant peut encore mordre. */
const MARGE = Math.ceil(RAYON_CHEMIN * 1.2);

/** A quelle distance, en pixels, deux pas peuvent se toucher sur l'image : la zone de l'un plus celle de l'autre. */
export const RAYON_VOISINAGE = 2 * MARGE + 2;

/** La terre d'un chemin : la meme que les rues, foulee et seche. */
export const CHEMIN: Matiere = {
  sombre: melanger(TERRE.sombre, SABLE.corps, 0.26),
  corps: melanger(TERRE.corps, SABLE.corps, 0.3),
  clair: melanger(TERRE.clair, SABLE.clair, 0.32),
};

/** L'opacite d'un chemin creuse a fond : jamais tout a fait opaque, le relief doit se voir. */
const OPACITE_MAX = 0.82;

/** Un tampon RVBA et sa position dans le monde : les bruits se lisent en coordonnees du monde. */
export interface Tampon {
  pixels: Uint8ClampedArray;
  largeur: number;
  hauteur: number;
  /** Le coin haut-gauche du tampon, dans le monde. */
  x0: number;
  y0: number;
}

/**
 * Peint un pas de chemin dans un tampon transparent. **Pure**, testee.
 *
 * Le bord tremble au bruit comme un degat, et se fond sur le dernier quart.
 * La ou deux pas se recouvrent, on garde **le plus opaque** des deux : deux
 * demi-chemins ne font pas un chemin plus sombre, ils font un chemin.
 *
 * @param cx, cy le centre du pas, dans le monde
 * @param usure entre 0 (rien) et 1 (creuse a fond)
 * @param sel une graine : deux pas voisins ne sont pas jumeaux
 */
export function peindreLePas(tampon: Tampon, cx: number, cy: number, usure: number, sel: number): void {
  if (usure <= 0) return;
  const { pixels, largeur, hauteur, x0, y0 } = tampon;
  const rayon = RAYON_CHEMIN;
  const ax = Math.max(0, Math.floor(cx - rayon * 1.2) - x0);
  const ay = Math.max(0, Math.floor(cy - rayon * 1.2) - y0);
  const bx = Math.min(largeur, Math.ceil(cx + rayon * 1.2) - x0);
  const by = Math.min(hauteur, Math.ceil(cy + rayon * 1.2) - y0);
  if (bx <= ax || by <= ay) return;

  for (let y = ay; y < by; y += 1) {
    const my = y + y0;
    for (let x = ax; x < bx; x += 1) {
      const mx = x + x0;
      const d = Math.hypot(mx - cx, my - cy) / rayon;
      if (d > 1.15) continue;
      const bord = 0.7 + bruitLisse(mx + sel * 17, my + sel * 31, 6, 9) * 0.42;
      if (d > bord) continue;
      // Plein au centre, fondu sur le dernier quart : un chemin n'a pas de bord
      // franc, mais a 0,34 il se lisait comme une fumee sur la capture.
      const fonte = Math.min(1, (bord - d) / 0.24);
      // Usee par plaques, comme la place : un chemin n'est pas un ruban uniforme.
      const plaques = 0.75 + 0.25 * bruitLisse(mx, my, 11, sel + 3);
      const alpha = Math.round(255 * OPACITE_MAX * usure * fonte * plaques);
      const i = (y * largeur + x) * 4;
      if (alpha <= pixels[i + 3]!) continue;

      const v = bruitLisse(mx + sel * 3, my + sel * 5, 5, 13);
      let couleur = v < 0.38 ? CHEMIN.sombre : v > 0.76 ? CHEMIN.clair : CHEMIN.corps;
      // Un caillou remonte par les pas, rare.
      if (bruit(mx, my, sel + 1) > 0.985) couleur = CHEMIN.clair;
      pixels[i] = (couleur >> 16) & 0xff;
      pixels[i + 1] = (couleur >> 8) & 0xff;
      pixels[i + 2] = couleur & 0xff;
      pixels[i + 3] = alpha;
    }
  }
}

/** La graine d'un pas, tiree de sa case : le meme endroit tremble toujours pareil. */
export function selDe(cas: Pick<CaseFoulee, "colonne" | "ligne">): number {
  return (cas.colonne * 7 + cas.ligne * 13) & 0xffff;
}

/** La zone du monde qu'un pas peut toucher, bord tremblant compris. */
export function zoneDe(cas: Pick<CaseFoulee, "x" | "y">): { x0: number; y0: number; x1: number; y1: number } {
  return {
    x0: Math.max(0, Math.floor(cas.x) - MARGE),
    y0: Math.max(0, Math.floor(cas.y) - MARGE),
    x1: Math.min(MONDE.largeur, Math.ceil(cas.x) + MARGE),
    y1: Math.min(MONDE.hauteur, Math.ceil(cas.y) + MARGE),
  };
}

/**
 * La couche des chemins dans le jeu : une texture canevas de la taille du
 * monde, posee juste au-dessus de la carte.
 */
export class CoucheDesChemins {
  private readonly texture: Phaser.Textures.CanvasTexture | null;
  private rafraichissementPrevu = false;

  constructor(private readonly scene: Phaser.Scene, profondeur: number) {
    // La texture survit d'une partie a l'autre, comme la carte : on la vide.
    let texture = scene.textures.exists(CLE_CHEMINS)
      ? (scene.textures.get(CLE_CHEMINS) as Phaser.Textures.CanvasTexture)
      : scene.textures.createCanvas(CLE_CHEMINS, MONDE.largeur, MONDE.hauteur);
    if (texture && typeof texture.getContext !== "function") texture = null;
    this.texture = texture;
    if (!this.texture) return;
    this.texture.getContext().clearRect(0, 0, MONDE.largeur, MONDE.hauteur);
    this.texture.refresh();
    scene.add.image(0, 0, CLE_CHEMINS).setOrigin(0).setDepth(profondeur);
  }

  /**
   * Redessine la zone d'un pas : on l'efface, puis on y repeint chaque pas
   * visible qui la touche — le pas lui-meme, s'il est encore la, et ses voisins.
   *
   * @param autour les pas visibles a portee de la zone, `cas` compris s'il vit encore
   */
  redessiner(cas: CaseFoulee, autour: CaseFoulee[], jour: number): void {
    if (!this.texture) return;
    const z = zoneDe(cas);
    if (z.x1 <= z.x0 || z.y1 <= z.y0) return;
    const ctx = this.texture.getContext();
    ctx.clearRect(z.x0, z.y0, z.x1 - z.x0, z.y1 - z.y0);
    const image = ctx.getImageData(z.x0, z.y0, z.x1 - z.x0, z.y1 - z.y0);
    const tampon: Tampon = { pixels: image.data, largeur: image.width, hauteur: image.height, x0: z.x0, y0: z.y0 };
    for (const voisine of autour) peindreLePas(tampon, voisine.x, voisine.y, usureDe(voisine, jour), selDe(voisine));
    ctx.putImageData(image, z.x0, z.y0);
    this.prevoirLeRafraichissement();
  }

  /** Efface tout et repeint chaque pas visible : a l'aube, et a la reprise d'une partie. */
  toutRedessiner(visibles: CaseFoulee[], jour: number): void {
    if (!this.texture) return;
    const ctx = this.texture.getContext();
    ctx.clearRect(0, 0, MONDE.largeur, MONDE.hauteur);
    if (visibles.length > 0) {
      let x0 = MONDE.largeur;
      let y0 = MONDE.hauteur;
      let x1 = 0;
      let y1 = 0;
      for (const cas of visibles) {
        const z = zoneDe(cas);
        x0 = Math.min(x0, z.x0);
        y0 = Math.min(y0, z.y0);
        x1 = Math.max(x1, z.x1);
        y1 = Math.max(y1, z.y1);
      }
      if (x1 > x0 && y1 > y0) {
        const image = ctx.getImageData(x0, y0, x1 - x0, y1 - y0);
        const tampon: Tampon = { pixels: image.data, largeur: image.width, hauteur: image.height, x0, y0 };
        for (const cas of visibles) peindreLePas(tampon, cas.x, cas.y, usureDe(cas, jour), selDe(cas));
        ctx.putImageData(image, x0, y0);
      }
    }
    this.prevoirLeRafraichissement();
  }

  /** Un seul envoi de texture par image, quel que soit le nombre de pas (§4.17). */
  private prevoirLeRafraichissement(): void {
    if (this.rafraichissementPrevu) return;
    this.rafraichissementPrevu = true;
    this.scene.events.once("postupdate", () => {
      this.rafraichissementPrevu = false;
      this.texture?.refresh();
    });
  }
}
