import { bruit } from "./bruit";
import { CONTOUR } from "./palette";
import { HAUTEUR_MUR, HAUTEUR_TOUR, MATIERES_MUR, SUD, type MatiereMur } from "./murs";

/**
 * Les ombres au pied de ce qui est pose (DESIGN.md §4.30, chantier 6.45, 24 novembre 2026).
 *
 * La maquette validee le 11 novembre les avait toutes : **le contact** (le pied
 * de chaque silhouette, sombre et serre), **le halo** (une ombre large et douce
 * autour du bas de l'objet), **la mare** sous les arbres, et **l'ombre portee**
 * des murs, des tours et des portes — les seuls objets que le code dessine
 * encore, donc les seuls qui n'ont pas l'ombre que Blender met dans ses sprites.
 *
 * Tout part de la **silhouette du sprite** (ses pixels opaques), jamais d'une
 * forme a la main : un sprite qu'on remplace par un rendu Blender garde une
 * ombre juste sans qu'une ligne ne bouge ici.
 *
 * L'ombre a la couleur et la transparence de celle des sprites Blender (le fer,
 * a 30 % pour une ombre portee), et sa force tombe sur des **marches de 10 %**,
 * cassees par un grain : un degrade lisse ferait une photo collee sous du pixel.
 *
 * Rien ici ne connait Phaser : `game/ombres.ts` lit les textures et pose les
 * images, `morceaux.ts` peint les ombres des arbres dans le sol.
 */

// ------------------------------------------------------------------ le soleil

/**
 * Le soleil des sprites (`scripts/blender/rendre.py`) : de l'ouest, un peu du
 * sud, haut. Une ombre part donc vers l'est et un peu vers le nord.
 *
 * En pixels de sprite : un point d'une face, `t` lignes au-dessus de son pied,
 * jette son ombre a `0,47 t` a l'est et `0,29 t` au nord ; un point du dessus
 * d'une boite haute de `h`, a `0,39 h` a l'est et `0,58 h` sous lui. Ce sont
 * les nombres de la maquette, tires du meme soleil et de la meme camera.
 */
const SOLEIL = { faceEst: 0.47, faceNord: 0.29, dessusEst: 0.39, dessusBas: 0.58 } as const;

/** La part de la hauteur d'une boite qu'on voit en face, dans le biais de la camera. */
const FACE_VUE = 0.82;

// ---------------------------------------------------------------- les forces

/** La force de chaque ombre, en opacite du fer (celle des sprites Blender : 0,3). */
export const FORCES = {
  /** Le pied d'un objet : la bande ou il touche le sol. */
  contact: 0.26,
  /** Le halo autour du bas de l'objet. */
  halo: 0.11,
  /** La mare sous un arbre vivant ; un arbre mort en jette 60 %. */
  mare: 0.18,
  /** L'ombre portee : exactement celle d'une maison Blender. */
  portee: 0.3,
  /** Rien ne descend plus bas : une ombre n'est jamais un trou. */
  plafond: 0.5,
  /** La marche entre deux tons d'ombre. */
  marche: 0.1,
} as const;

/** La marge autour du sprite : le halo s'eteint a trois ecarts de son flou. */
export const MARGE_D_OMBRE = 16;

/** La couleur de toute ombre : le fer, comme le contour et l'ombre des sprites. */
export const COULEUR_D_OMBRE = CONTOUR;

// ---------------------------------------------------------------- le reglage

/** Ce qu'une cle de sprite jette au sol, en plus du contact et du halo. */
export interface ReglageDOmbre {
  /** La hauteur de la boite qui jette une ombre portee, en pixels ; 0 si le sprite a deja la sienne. */
  portee: number;
  /** La mare sous un arbre : son demi-grand axe, son demi-petit axe, sa part de la force. */
  mare: { rx: number; ry: number; part: number } | null;
  /**
   * Le sprite a une voisine au sud qui dessine sa propre ombre : la sienne
   * s'arrete avant, sinon les deux se superposent en une bande plus noire.
   */
  voisinSud: boolean;
}

/**
 * Ce que jette une cle, ou `null` pour ce qui est a plat sur le sol (douves,
 * champs) ou sur l'eau (le navire).
 */
export function reglageDOmbre(cle: string): ReglageDOmbre | null {
  if (!cle.startsWith("bati-") && !cle.startsWith("decor-")) return null;
  if (cle.startsWith("bati-douve") || cle.startsWith("bati-champ") || cle === "bati-navire") return null;

  const sans = { portee: 0, mare: null, voisinSud: false };
  if (cle.startsWith("decor-arbre-mort")) return { ...sans, mare: { rx: 6, ry: 3, part: 0.6 } };
  if (cle.startsWith("decor-arbre") || cle.startsWith("decor-conifere")) {
    return { ...sans, mare: { rx: 11, ry: 5, part: 1 } };
  }
  if (cle === "bati-tour") return { ...sans, portee: HAUTEUR_TOUR + 4 };
  if (cle === "bati-mur-ruine") return { ...sans, portee: 6 };

  // `bati-mur-<matiere>-<masque>`, `bati-porte-<matiere>-<sens>-<position>`, `bati-pont-levis-...`
  const mur = /^bati-mur-(\w+)-(\d+)$/.exec(cle);
  if (mur && estUneMatiere(mur[1]!)) {
    const masque = Number(mur[2]);
    return { ...sans, portee: HAUTEUR_MUR[mur[1]] + 1, voisinSud: (masque & SUD) !== 0 };
  }
  const porte = /^bati-(?:porte|pont-levis)-(\w+)-(nord-sud|est-ouest)-/.exec(cle);
  if (porte && estUneMatiere(porte[1]!)) {
    return { ...sans, portee: HAUTEUR_MUR[porte[1]] + 1, voisinSud: porte[2] === "nord-sud" };
  }
  return sans;
}

function estUneMatiere(m: string): m is MatiereMur {
  return (MATIERES_MUR as readonly string[]).includes(m);
}

// --------------------------------------------------------------- la fabrique

/** L'ombre d'un sprite : une force par pixel, sur le cadre du sprite elargi de sa marge. */
export interface OmbreFabriquee {
  largeur: number;
  hauteur: number;
  /** De combien le cadre de l'ombre deborde celui du sprite, de chaque cote. */
  marge: number;
  /** La force de 0 a `FORCES.plafond`, avant les marches. Rien n'est pose si tout est nul. */
  force: Float32Array;
  /** Vrai si l'ombre ne contient rien (sprite vide). */
  vide: boolean;
}

/**
 * Fabrique l'ombre d'un sprite depuis l'opacite de ses pixels.
 *
 * @param alpha l'opacite de chaque pixel du sprite (0 a 255), rangee par rangee.
 * @param ancreY la ligne du point d'ancrage dans le sprite (le pied d'un decor), pour la mare.
 */
export function fabriquerLOmbre(
  alpha: ArrayLike<number>,
  largeur: number,
  hauteur: number,
  reglage: ReglageDOmbre,
  ancreY = hauteur - 1,
): OmbreFabriquee {
  const M = MARGE_D_OMBRE;
  const L = largeur + 2 * M;
  const H = hauteur + 2 * M;
  const force = new Float32Array(L * H);

  // ⚠️ **Seuls les pixels francs font la silhouette.** L'ombre que Blender met
  // dans ses sprites est a 30 % : la compter ferait jeter une ombre a une ombre.
  const opaque = (x: number, y: number) => (alpha[y * largeur + x] ?? 0) > 200;

  // Le haut et le bas de la silhouette, et le pied de chaque colonne : en vue de
  // trois quarts, le pixel le plus bas d'une colonne est le pied de sa face sud.
  let haut = -1;
  let bas = -1;
  const piedDeColonne = new Int32Array(largeur).fill(-1);
  for (let y = 0; y < hauteur; y += 1) {
    for (let x = 0; x < largeur; x += 1) {
      if (!opaque(x, y)) continue;
      if (haut < 0) haut = y;
      bas = y;
      piedDeColonne[x] = y;
    }
  }
  if (bas < 0) return { largeur: L, hauteur: H, marge: M, force, vide: true };

  // Le contact : les trois dernieres rangees de la silhouette. Le halo : son
  // dernier tiers, quatre rangees au moins.
  const contact = new Float32Array(L * H);
  const large = new Float32Array(L * H);
  const bandeLarge = Math.max(4, Math.floor((bas - haut) / 3));
  for (let y = 0; y < hauteur; y += 1) {
    for (let x = 0; x < largeur; x += 1) {
      if (!opaque(x, y)) continue;
      const i = (y + M) * L + x + M;
      if (y >= bas - 3) contact[i] = 1;
      if (y >= bas - bandeLarge) large[i] = 1;
    }
  }
  flouter(contact, L, H, 1.5);
  flouter(large, L, H, 5);
  for (let i = 0; i < force.length; i += 1) {
    force[i] = Math.min(1, contact[i]! * 2.6) * FORCES.contact + Math.min(1, large[i]! * 1.5) * FORCES.halo;
  }

  // La mare sous un arbre, un peu a l'est du pied (le soleil vient de l'ouest).
  if (reglage.mare) {
    const { rx, ry, part } = reglage.mare;
    const px = largeur / 2 + 2 + M;
    const py = ancreY - 1 + M;
    for (let y = Math.max(0, Math.floor(py - ry * 1.6)); y < Math.min(H, Math.ceil(py + ry * 1.6)); y += 1) {
      for (let x = Math.max(0, Math.floor(px - rx * 1.6)); x < Math.min(L, Math.ceil(px + rx * 1.6)); x += 1) {
        const d = ((x - px) / rx) ** 2 + ((y - py) / ry) ** 2;
        const m = Math.max(0, Math.min(1, 1.25 - d)) * part;
        if (m > 0) force[y * L + x] = force[y * L + x]! + m * FORCES.mare;
      }
    }
  }

  // L'ombre portee, pour ce que le code dessine : chaque pixel de la silhouette
  // est un point d'une face (assez bas au-dessus du pied de sa colonne) ou du
  // dessus de la boite (plus haut), et il jette son ombre selon le soleil.
  if (reglage.portee > 0) {
    const h = reglage.portee;
    const vu = h * FACE_VUE;
    const portee = new Uint8Array(L * H);
    // Une voisine au sud jette deja l'ombre de la bande ou tomberait celle de
    // notre face : on s'arrete avant (`murs.ts` : la face sud d'une case est
    // recouverte par le dessus de la suivante). Le dessus d'une boite est
    // dessine `0,82 h` plus haut que son sol, et son ombre tombe `0,58 h` sous
    // lui : l'ombre de la voisine commence donc `0,24 h` au nord de son bord.
    const auNord = (FACE_VUE - SOLEIL.dessusBas) * h;
    const limite = reglage.voisinSud ? bas + 1 + M - Math.round(auNord) : H;
    for (let y = 0; y < hauteur; y += 1) {
      for (let x = 0; x < largeur; x += 1) {
        if (!opaque(x, y)) continue;
        const t = piedDeColonne[x]! - y;
        const sx = t <= vu ? x + SOLEIL.faceEst * t : x + SOLEIL.dessusEst * h;
        const sy = t <= vu ? piedDeColonne[x]! - SOLEIL.faceNord * t : y + SOLEIL.dessusBas * h;
        const X = Math.round(sx) + M;
        const Y = Math.round(sy) + M;
        if (X < 0 || X >= L || Y < 0 || Y >= H || Y >= limite) continue;
        portee[Y * L + X] = 1;
      }
    }
    fermer(portee, L, H);
    for (let i = 0; i < force.length; i += 1) {
      if (portee[i]) force[i] = force[i]! + FORCES.portee;
    }
  }

  let vide = true;
  for (let i = 0; i < force.length; i += 1) {
    force[i] = Math.min(FORCES.plafond, force[i]!);
    if (force[i]! > 0.004) vide = false;
  }
  return { largeur: L, hauteur: H, marge: M, force, vide };
}

// ------------------------------------------------------------------ les marches

/**
 * L'opacite d'une ombre de cette force, en ce pixel : la force tombe sur une
 * marche de 10 %, et un grain fixe decide de la marche au-dessus ou en dessous.
 *
 * ⚠️ Une force qui tombe pile sur une marche (l'ombre portee, 0,3) reste pleine
 * et unie, comme l'ombre d'une maison Blender : le grain n'agit que sur les
 * degrades.
 */
export function opaciteDOmbre(force: number, x: number, y: number): number {
  if (force <= 0) return 0;
  const n = force / FORCES.marche;
  const marche = Math.floor(n + 1e-6);
  const reste = n - marche;
  const grain = bruit(x, y, 913);
  return (reste > 1e-6 && grain < reste ? marche + 1 : marche) * FORCES.marche;
}

/** L'ombre en pixels RGBA, dans le cadre de sa fabrique : de quoi remplir une texture. */
export function pixelsDeLOmbre(ombre: OmbreFabriquee): Uint8ClampedArray<ArrayBuffer> {
  const pixels = new Uint8ClampedArray(new ArrayBuffer(ombre.largeur * ombre.hauteur * 4));
  const r = (COULEUR_D_OMBRE >> 16) & 0xff;
  const v = (COULEUR_D_OMBRE >> 8) & 0xff;
  const b = COULEUR_D_OMBRE & 0xff;
  for (let y = 0; y < ombre.hauteur; y += 1) {
    for (let x = 0; x < ombre.largeur; x += 1) {
      const a = opaciteDOmbre(ombre.force[y * ombre.largeur + x]!, x, y);
      if (a <= 0) continue;
      const k = (y * ombre.largeur + x) * 4;
      pixels[k] = r;
      pixels[k + 1] = v;
      pixels[k + 2] = b;
      pixels[k + 3] = Math.round(a * 255);
    }
  }
  return pixels;
}

// --------------------------------------------------------- les ombres du sol

/** Une ombre peinte dans le sol : ou tombe le coin de son cadre, et si son sprite est en miroir. */
export interface OmbreAuSol {
  x0: number;
  y0: number;
  ombre: OmbreFabriquee;
  miroir: boolean;
}

/**
 * Peint des ombres dans un morceau de sol (les arbres et les rochers, fixes pour
 * tout un monde).
 *
 * ⚠️ **Deux ombres qui se chevauchent ne s'additionnent pas** : on garde la plus
 * forte. Une foret serree ferait sinon un sol noir — la maquette le faisait
 * deja ainsi, par l'union des silhouettes. Le grain des marches est celui du
 * **monde** (`x0 + x`), pas celui de l'ombre : deux arbres voisins ne font pas
 * deux grains qui se battent.
 */
export function peindreDesOmbresDansLeSol(
  pixels: Uint8ClampedArray,
  largeur: number,
  hauteur: number,
  x0: number,
  y0: number,
  ombres: readonly OmbreAuSol[],
): void {
  if (ombres.length === 0) return;
  const force = new Float32Array(largeur * hauteur);
  for (const o of ombres) {
    const ox = Math.round(o.x0) - x0;
    const oy = Math.round(o.y0) - y0;
    const L = o.ombre.largeur;
    for (let j = Math.max(0, -oy); j < Math.min(o.ombre.hauteur, hauteur - oy); j += 1) {
      for (let i = Math.max(0, -ox); i < Math.min(L, largeur - ox); i += 1) {
        const f = o.ombre.force[j * L + (o.miroir ? L - 1 - i : i)]!;
        const k = (oy + j) * largeur + ox + i;
        if (f > force[k]!) force[k] = f;
      }
    }
  }
  const r = (COULEUR_D_OMBRE >> 16) & 0xff;
  const v = (COULEUR_D_OMBRE >> 8) & 0xff;
  const b = COULEUR_D_OMBRE & 0xff;
  for (let y = 0; y < hauteur; y += 1) {
    for (let x = 0; x < largeur; x += 1) {
      const f = force[y * largeur + x]!;
      if (f <= 0) continue;
      const a = opaciteDOmbre(f, x0 + x, y0 + y);
      if (a <= 0) continue;
      const k = (y * largeur + x) * 4;
      pixels[k] = Math.round(pixels[k]! * (1 - a) + r * a);
      pixels[k + 1] = Math.round(pixels[k + 1]! * (1 - a) + v * a);
      pixels[k + 2] = Math.round(pixels[k + 2]! * (1 - a) + b * a);
    }
  }
}

// ------------------------------------------------------------------- l'outil

/** Un flou gaussien en deux passes, sur place. */
function flouter(t: Float32Array, L: number, H: number, sigma: number): void {
  const r = Math.ceil(sigma * 3);
  const noyau = new Float32Array(2 * r + 1);
  let somme = 0;
  for (let i = -r; i <= r; i += 1) {
    noyau[i + r] = Math.exp(-(i * i) / (2 * sigma * sigma));
    somme += noyau[i + r]!;
  }
  for (let i = 0; i < noyau.length; i += 1) noyau[i] = noyau[i]! / somme;
  const tmp = new Float32Array(t.length);
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < L; x += 1) {
      let s = 0;
      for (let k = -r; k <= r; k += 1) {
        const xx = x + k;
        if (xx >= 0 && xx < L) s += t[y * L + xx]! * noyau[k + r]!;
      }
      tmp[y * L + x] = s;
    }
  }
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < L; x += 1) {
      let s = 0;
      for (let k = -r; k <= r; k += 1) {
        const yy = y + k;
        if (yy >= 0 && yy < H) s += tmp[yy * L + x]! * noyau[k + r]!;
      }
      t[y * L + x] = s;
    }
  }
}

/** Une fermeture (une dilatation puis une erosion, en croix) : bouche les trous d'une projection. */
function fermer(m: Uint8Array, L: number, H: number): void {
  const voisin = (src: Uint8Array, x: number, y: number, dilater: boolean) => {
    const v = (xx: number, yy: number) => (xx < 0 || yy < 0 || xx >= L || yy >= H ? (dilater ? 0 : 1) : src[yy * L + xx]!);
    const c = [v(x, y), v(x - 1, y), v(x + 1, y), v(x, y - 1), v(x, y + 1)];
    return dilater ? (c.some((e) => e) ? 1 : 0) : c.every((e) => e) ? 1 : 0;
  };
  const dilate = new Uint8Array(m.length);
  for (let y = 0; y < H; y += 1) for (let x = 0; x < L; x += 1) dilate[y * L + x] = voisin(m, x, y, true);
  for (let y = 0; y < H; y += 1) for (let x = 0; x < L; x += 1) m[y * L + x] = voisin(dilate, x, y, false);
}
