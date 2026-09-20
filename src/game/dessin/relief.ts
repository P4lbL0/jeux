import { distanceALEau, profondeurDeRoche } from "../../core/carte";
import { bruitLisse } from "./bruit";

/**
 * Le relief du sol, en facettes (bloc 7z, etage 7, 18 septembre 2026).
 *
 * **Pourquoi.** « On dirait que c'est tout plat » : la carte etait un aplat par
 * matiere avec des taches, et a cote des batiments low-poly rendus par Blender
 * elle faisait decor peint. Ici le sol a une **altitude** — des collines douces
 * dans l'herbe, presque rien sur la plage, un eboulis qui monte, puis la
 * montagne — et il est decoupe en **facettes triangulaires**, chacune eclairee
 * par le meme soleil que les sprites Blender (de l'ouest, haut). Un versant
 * tourne vers le soleil prend le ton clair de sa matiere, un versant a
 * contre-jour le ton sombre : on voit la forme sans qu'aucun pixel ne bouge.
 *
 * ⚠️ **Ce n'est que de l'ombrage.** Le sol reste plat pour le jeu : personne ne
 * monte ni ne descend, les collisions et `core/carte.ts` ne changent pas. Le
 * relief ne sait rien du terrain qu'il ombre, il ne donne qu'une marche de
 * lumiere ; la matiere, elle, reste choisie par `classer`.
 *
 * **Pure** : ni Phaser, ni hasard — le meme monde a chaque partie.
 */

/** Le pas des facettes, en pixels : ~44 px a l'ecran au zoom du jeu. */
export const PAS_FACETTE = 26;
const RANG = PAS_FACETTE * 0.866;

/**
 * Vers le soleil, dans le repere de la carte (x vers l'est, y vers le **sud**,
 * z vers le haut) : de l'ouest, un peu du sud, haut — celui de `rendre.py`.
 */
const SOLEIL = (() => {
  const v = [-0.62, 0.38, 1.6];
  const n = Math.hypot(v[0]!, v[1]!, v[2]!);
  return [v[0]! / n, v[1]! / n, v[2]! / n] as const;
})();

/**
 * Les seuils des cinq marches, en ecart d'eclairage a un sol plat : sous -0,24
 * le ton sombre, puis sombre-corps, corps, corps-clair, clair au-dessus de 0,24.
 * ⚠️ Plus serres (0,16), chaque facette sautait de ton : on lisait un
 * camouflage de triangles au lieu de collines. Les tons extremes sont pour les
 * vraies pentes.
 */
const SEUILS = [-0.24, -0.07, 0.07, 0.24];

/**
 * L'altitude en un point, en pixels.
 *
 * - **la terre monte depuis le rivage** : la plage reste basse, l'interieur
 *   forme un plateau ;
 * - **des collines** de deux tailles, qui ne naissent qu'a l'interieur des
 *   terres (une dune fait trois pixels, une colline trente) ;
 * - **la montagne** : a partir de son pied, le sol monte vers le sud, herisse de
 *   cretes et d'eclats.
 */
export function altitude(x: number, y: number): number {
  // La distance a l'eau la plus proche, quel que soit le monde : la mer sur
  // n'importe quel bord, un lac au milieu — la terre monte depuis chaque rive.
  const rivage = distanceALEau(x, y);
  const terre = Math.min(1, Math.max(0, rivage / 240));
  const douce = terre * terre * (3 - 2 * terre);

  let h = douce * 40;
  h += douce * ((bruitLisse(x, y, 230, 61) - 0.5) * 2 * 60 + (bruitLisse(x, y, 90, 62) - 0.5) * 2 * 10);

  // De combien on est dans la roche : une chaine sur un bord ou un massif au
  // milieu, la montagne monte depuis son pied dans tous les cas.
  const pied = profondeurDeRoche(x, y);
  if (pied > -10) {
    const dedans = pied + 10;
    // Une rampe douce, et des aretes par-dessus : une pente unique tournee vers
    // le nord restait un aplat sombre. Des cretes (le bruit replie sur
    // lui-meme) donnent des versants au soleil et d'autres a contre-jour.
    h += dedans * 0.25;
    const rude = Math.min(1, dedans / 90);
    const crete = 1 - Math.abs(bruitLisse(x, y, 110, 63) * 2 - 1);
    const eclats = 1 - Math.abs(bruitLisse(x, y, 45, 64) * 2 - 1);
    h += rude * (crete * 90 + eclats * 22);
  }
  return h;
}

/** La marche de lumiere d'une facette, de -2 (sombre) a 2 (clair). */
function marcheDe(ax: number, ay: number, ah: number, bx: number, by: number, bh: number, cx: number, cy: number, ch: number): number {
  const ux = bx - ax;
  const uy = by - ay;
  const uh = bh - ah;
  const vx = cx - ax;
  const vy = cy - ay;
  const vh = ch - ah;
  let nx = uy * vh - uh * vy;
  let ny = uh * vx - ux * vh;
  let nz = ux * vy - uy * vx;
  if (nz < 0) {
    nx = -nx;
    ny = -ny;
    nz = -nz;
  }
  const n = Math.hypot(nx, ny, nz) || 1;
  const ecart = (nx * SOLEIL[0] + ny * SOLEIL[1] + nz * SOLEIL[2]) / n - SOLEIL[2];
  let marche = -2;
  for (const s of SEUILS) if (ecart > s) marche += 1;
  return marche;
}

/**
 * Les facettes d'une carte : un reseau de triangles dont chaque rangee est
 * decalee d'un demi-pas, et la marche de lumiere de chacun, calculee une fois.
 */
export interface Relief {
  /** La marche de lumiere du pixel (x, y), de -2 a 2. */
  marche(x: number, y: number): number;
}

export function releverLeRelief(largeur: number, hauteur: number): Relief {
  const colonnes = Math.ceil(largeur / PAS_FACETTE) + 3;
  const rangees = Math.ceil(hauteur / RANG) + 2;
  // Les sommets : la rangee j est decalee d'un demi-pas si j est impair. La
  // colonne 0 est un pas a gauche de la carte, pour couvrir le bord.
  const hauteurs = new Float32Array(colonnes * rangees);
  const sx = (i: number, j: number) => (i - 1 + (j % 2) * 0.5) * PAS_FACETTE;
  const sy = (j: number) => j * RANG;
  for (let j = 0; j < rangees; j += 1) {
    for (let i = 0; i < colonnes; i += 1) hauteurs[j * colonnes + i] = altitude(sx(i, j), sy(j));
  }
  const h = (i: number, j: number) => hauteurs[j * colonnes + i] ?? 0;

  // Trois triangles possibles par case de la rangee du haut (voir `marche`) :
  // [0] celui de gauche pointe en bas, [1] celui du milieu pointe en haut,
  // [2] celui de droite pointe en bas. On les calcule tous d'avance.
  const facettes = new Int8Array(colonnes * rangees * 3);
  for (let j = 0; j + 1 < rangees; j += 1) {
    // Le decalage de la rangee du bas par rapport a celle du haut, en indices :
    // si le haut est pair (decale de 0), le bas (decale de 0,5) a le meme i a
    // sa droite ; si le haut est impair, le bas est decale de -0,5, donc son
    // sommet « sous-droite » est i + 1.
    const d = j % 2;
    for (let i = 0; i + 1 < colonnes; i += 1) {
      const bi = i + d;
      const T0 = [sx(i, j), sy(j), h(i, j)] as const;
      const T1 = [sx(i + 1, j), sy(j), h(i + 1, j)] as const;
      const B0 = [sx(bi - 1, j + 1), sy(j + 1), h(bi - 1, j + 1)] as const;
      const B1 = [sx(bi, j + 1), sy(j + 1), h(bi, j + 1)] as const;
      const B2 = [sx(bi + 1, j + 1), sy(j + 1), h(bi + 1, j + 1)] as const;
      const k = (j * colonnes + i) * 3;
      facettes[k] = marcheDe(...B0, ...B1, ...T0);
      facettes[k + 1] = marcheDe(...T0, ...T1, ...B1);
      facettes[k + 2] = marcheDe(...B1, ...B2, ...T1);
    }
  }

  return {
    marche(x: number, y: number): number {
      const j = Math.floor(y / RANG);
      const v = y / RANG - j;
      const u = x / PAS_FACETTE + 1 - (j % 2) * 0.5;
      const i = Math.floor(u);
      const f = u - i;
      const k = (j * colonnes + i) * 3;
      if (f < 0.5 * v) return facettes[k] ?? 0;
      if (f < 1 - 0.5 * v) return facettes[k + 1] ?? 0;
      return facettes[k + 2] ?? 0;
    },
  };
}
