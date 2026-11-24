import { profondeurDeRoche } from "../../core/carte";
import { C } from "../ui/couleurs";
import { bruit, bruitLisse } from "./bruit";
import { EBOULIS, ROCHE, SOL_VERT, matiere, melanger, type Matiere } from "./palette";

/**
 * La roche en volume (DESIGN.md §4.30, chantier 6.45, 24 novembre 2026).
 *
 * La maquette validee le 11 novembre (l'essai 2, `.tmp/maquette-sol/sol.py`,
 * `massif`) dressait la roche en **maillage low-poly** : des points sur une
 * grille secouee de 13 px, une hauteur tiree de la profondeur dans la roche,
 * des triangles vus comme les sprites (la hauteur monte dans l'image de 0,82 px
 * par pixel), peints du fond vers le devant, chaque facette **a plat** dans le
 * ton que lui donne le soleil des sprites. C'est ce que fait ce fichier, a la
 * cuisson de chaque morceau de carte : pas de Blender, pour que n'importe quel
 * monde tire ait sa montagne.
 *
 * Trois choses de la maquette changent, toutes pour la cuisson par morceaux :
 *
 * - **la grille fait le maillage**, pas une triangulation de Delaunay : chaque
 *   case de la grille se coupe en deux triangles selon une diagonale tiree. Un
 *   morceau trouve donc exactement les facettes de son voisin, sans rien
 *   savoir de lui, et la couture ne se voit pas ;
 * - **la peinture se fait rangee par rangee**, comme le reste du sol : le pied
 *   du massif et son ombre ont besoin des rangees du dessus, qu'on garde ;
 * - **la hauteur plafonne** dans une chaine tres epaisse (`ENFONCEMENT_MAX`) :
 *   au-dela, le massif reste herisse mais ne monte plus.
 *
 * ⚠️ **Le dessin ne sort jamais de la roche.** Le massif ne commence qu'a 24 px
 * dans la roche (`RETRAIT`), et un point a la profondeur `p` monte d'environ
 * `0,41 p + 15` px : toujours moins que sa distance au bord. Ce qu'on voit de
 * la montagne couvre donc la roche, jamais le terrain ou l'on marche.
 *
 * **Pur** : ni Phaser ni hasard. `carte.ts` le peint ; `installation.ts` lui
 * demande ou ne pas poser de rocher.
 */

/** Le pas de la grille du maillage, en pixels du monde. */
export const PAS_DU_MASSIF = 13;

/** Le massif ne monte qu'a cette profondeur dans la roche : le bord reste un eboulis a plat. */
const RETRAIT = 24;

/** De combien de pixels une hauteur monte dans l'image : la camera des sprites. */
const MONTEE = 0.82;

/** Au-dela de cette profondeur, la pente de fond ne monte plus. */
const ENFONCEMENT_MAX = 120;

/** La plus grande hauteur possible : la pente, le pied, la crete et la bosse. */
export const HAUTEUR_MAX = ENFONCEMENT_MAX * 0.5 + 10 + 18 + 4.5;

/** Les colonnes gardees de chaque cote d'un morceau : le bord d'une facette a besoin de ses voisines. */
const MARGE = 4;

/** Les rangees du dessus gardees : le pied du massif assombrit le sol sur huit pixels. */
const HISTOIRE = 8;

/** Le soleil des sprites (`scripts/blender/rendre.py`) : x vers l'est, y vers le sud, z vers le haut. */
const SOLEIL = (() => {
  const n = Math.hypot(0.62, 0.38, 1.6);
  return { x: -0.62 / n, y: 0.38 / n, z: 1.6 / n };
})();

/** Les matieres d'une facette. */
export const ROC = 0;
export const EBO = 1;
export const MOU = 2;

/** Le ton de fond (le plus sombre, pour les aretes et la silhouette), puis les cinq marches du sol. */
const FOND = 0;
const CLAIR = 5;

/** La mousse, qui tient sur les replats : la roche tiree vers l'herbe, comme dans la maquette. */
const MOUSSE = matiere(melanger(ROCHE.corps, SOL_VERT.corps, 0.42));

function sixTons(m: Matiere): number[] {
  return [melanger(m.sombre, C.fer, 0.4), m.sombre, melanger(m.sombre, m.corps, 0.5), m.corps, melanger(m.corps, m.clair, 0.5), m.clair];
}

/** Les six tons de chaque matiere du massif : `TONS_DU_MASSIF[matiere][ton]`. */
export const TONS_DU_MASSIF: readonly (readonly number[])[] = [sixTons(ROCHE), sixTons(EBOULIS), sixTons(MOUSSE)];

// ---------------------------------------------------------------- la hauteur

/**
 * La hauteur du massif en un point, depuis sa profondeur dans la roche : une
 * marche raide au pied (la paroi), une pente de fond, des cretes et des bosses.
 * Les nombres de la maquette.
 */
export function hauteurDeRoche(prof: number, x: number, y: number): number {
  const d = prof - RETRAIT;
  if (d <= 0) return 0;
  const t = Math.min(1, d / 10);
  const pied = 10 * t * t * (3 - 2 * t);
  const crete = (1 - Math.abs(2 * bruitLisse(x, y, 46, 803) - 1)) * 18 * Math.min(1, d / 28);
  const bosse = (bruitLisse(x, y, 17, 804) - 0.5) * 9 * Math.min(1, d / 12);
  return Math.max(0, Math.min(d, ENFONCEMENT_MAX) * 0.5 + pied + crete + bosse);
}

// --------------------------------------------------------------- le maillage

/** Une facette du massif, deja vue a l'ecran : trois sommets, leur hauteur, son ton et sa matiere. */
interface Facette {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  cx: number;
  cy: number;
  za: number;
  zb: number;
  zc: number;
  aire: number;
  ton: number;
  matiere: number;
  xmin: number;
  xmax: number;
  ymin: number;
  ymax: number;
  /** L'ordre de peinture : le milieu de son pied au sol, du nord au sud, puis son numero. */
  rang: number;
  numero: number;
}

/**
 * Les facettes dont le dessin peut toucher le rectangle d'ecran donne, dans
 * l'ordre ou on les peint (du fond vers le devant).
 *
 * Une facette se dessine **au-dessus** de son pied, jusqu'a `MONTEE x
 * HAUTEUR_MAX` : on la cherche donc aussi loin sous le rectangle.
 */
export function facettesDuMassif(x0: number, y0: number, x1: number, y1: number): Facette[] {
  const i0 = Math.floor(x0 / PAS_DU_MASSIF) - 2;
  const i1 = Math.floor(x1 / PAS_DU_MASSIF) + 2;
  const j0 = Math.floor(y0 / PAS_DU_MASSIF) - 2;
  const j1 = Math.floor((y1 + MONTEE * HAUTEUR_MAX) / PAS_DU_MASSIF) + 2;
  const nI = i1 - i0 + 1;
  const nJ = j1 - j0 + 1;
  const px = new Float64Array(nI * nJ);
  const py = new Float64Array(nI * nJ);
  const pz = new Float64Array(nI * nJ);
  const ok = new Uint8Array(nI * nJ);
  for (let j = j0; j <= j1; j += 1) {
    for (let i = i0; i <= i1; i += 1) {
      const k = (j - j0) * nI + (i - i0);
      const x = (i + 0.5 + (bruit(i, j, 801) - 0.5) * 0.72) * PAS_DU_MASSIF;
      const y = (j + 0.5 + (bruit(i, j, 802) - 0.5) * 0.72) * PAS_DU_MASSIF;
      const prof = profondeurDeRoche(x, y);
      px[k] = x;
      py[k] = y;
      if (prof > 4) {
        ok[k] = 1;
        pz[k] = hauteurDeRoche(prof, x, y);
      }
    }
  }

  const facettes: Facette[] = [];
  const poser = (a: number, b: number, c: number, i: number, n: number) => {
    if (!ok[a] || !ok[b] || !ok[c]) return;
    if (Math.max(pz[a]!, pz[b]!, pz[c]!) <= 0.5) return;
    const ax = px[a]!, ay = py[a]!, az = pz[a]!;
    const bx = px[b]!, by = py[b]!, bz = pz[b]!;
    const cx = px[c]!, cy = py[c]!, cz = pz[c]!;
    // La normale, tournee vers le haut.
    let nx = (by - ay) * (cz - az) - (bz - az) * (cy - ay);
    let ny = (bz - az) * (cx - ax) - (bx - ax) * (cz - az);
    let nz = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    if (nz < 0) {
      nx = -nx;
      ny = -ny;
      nz = -nz;
    }
    const nn = Math.hypot(nx, ny, nz) || 1;
    nx /= nn;
    ny /= nn;
    nz /= nn;
    // A l'ecran : la hauteur monte dans l'image.
    const say = ay - MONTEE * az;
    const sby = by - MONTEE * bz;
    const scy = cy - MONTEE * cz;
    const aire = (bx - ax) * (scy - say) - (cx - ax) * (sby - say);
    const aireAuSol = (bx - ax) * (cy - ay) - (cx - ax) * (by - ay);
    // Une facette vue par la tranche, ou qui tourne le dos a la camera.
    if (Math.abs(aire) < 0.5 || aire * aireAuSol < 0) return;
    const lum = (nx * SOLEIL.x + ny * SOLEIL.y + nz * SOLEIL.z) / SOLEIL.z;
    let ton = 3.55 + (lum - 1) * 6 + (bruit(i, n, 805) - 0.5) * 0.6;
    let mat = ROC;
    // ⚠️ **Le pied est un talus d'eboulis** : toute facette qui touche le sol.
    // La maquette n'en faisait qu'une sur deux (sous 5,5 px de haut), et le pied
    // sortait en dents de scie — un triangle clair pointe en haut, un sombre
    // pointe en bas. La paroi commence ainsi a la premiere rangee de points
    // hauts, qui fait une ligne.
    if (Math.min(az, bz, cz) <= 0 || (az + bz + cz) / 3 < 5.5) {
      mat = EBO;
      ton -= 0.4;
    } else if (nz > 0.93 && bruit(i, n, 806) > 0.55) {
      mat = MOU; // un replat : la mousse y tient
    }
    facettes.push({
      ax,
      ay: say,
      bx,
      by: sby,
      cx,
      cy: scy,
      za: az,
      zb: bz,
      zc: cz,
      aire,
      ton,
      matiere: mat,
      xmin: Math.floor(Math.min(ax, bx, cx)),
      xmax: Math.ceil(Math.max(ax, bx, cx)),
      ymin: Math.floor(Math.min(say, sby, scy)),
      ymax: Math.ceil(Math.max(say, sby, scy)),
      rang: (ay + by + cy) / 3,
      numero: n * 4_000_000 + i,
    });
  };
  for (let j = j0; j < j1; j += 1) {
    for (let i = i0; i < i1; i += 1) {
      const a = (j - j0) * nI + (i - i0);
      const b = a + 1;
      const c = a + nI;
      const d = c + 1;
      // La diagonale la plus courte, comme une triangulation de Delaunay sur une
      // grille secouee. ⚠️ Tiree au hasard, elle faisait des triangles
      // effiles, et le pied du massif sortait en dents de scie (vu sur capture).
      const ad = Math.hypot(px[d]! - px[a]!, py[d]! - py[a]!);
      const bc = Math.hypot(px[c]! - px[b]!, py[c]! - py[b]!);
      if (ad < bc || (ad === bc && bruit(i, j, 807) < 0.5)) {
        poser(a, b, d, i, 2 * j);
        poser(a, d, c, i, 2 * j + 1);
      } else {
        poser(a, b, c, i, 2 * j);
        poser(b, d, c, i, 2 * j + 1);
      }
    }
  }
  const xa = x0 - 1;
  const xb = x1 + 1;
  return facettes
    .filter((f) => f.xmax >= xa && f.xmin <= xb && f.ymax >= y0 - 1 && f.ymin <= y1 + 1)
    .sort((f, g) => f.rang - g.rang || f.numero - g.numero);
}

/** Vrai si une facette couvre ce pixel a l'ecran, et sa hauteur la. */
function couvre(f: Facette, X: number, Y: number): number {
  const w0 = ((f.bx - X) * (f.cy - Y) - (f.cx - X) * (f.by - Y)) / f.aire;
  if (w0 < -0.02) return -1;
  const w1 = ((f.cx - X) * (f.ay - Y) - (f.ax - X) * (f.cy - Y)) / f.aire;
  if (w1 < -0.02) return -1;
  const w2 = 1 - w0 - w1;
  if (w2 < -0.02) return -1;
  return w0 * f.za + w1 * f.zb + w2 * f.zc;
}

/**
 * Vrai si le massif se dessine sur ce point de l'ecran : un rocher pose la
 * flotterait sur la montagne (`installation.ts`).
 */
export function massifEn(x: number, y: number): boolean {
  if (hauteurDeRoche(profondeurDeRoche(x, y), x, y) > 0) return true;
  for (const f of facettesDuMassif(x - 1, y - 1, x + 1, y + 1)) {
    if (y < f.ymin || y > f.ymax || x < f.xmin || x > f.xmax) continue;
    if (couvre(f, x + 0.5, y + 0.5) >= 0) return true;
  }
  return false;
}

// ---------------------------------------------------------- l'ombre du massif

/** Le pas de la grille des hauteurs vues du dessus, pour l'ombre que le massif jette. */
const PAS_DES_HAUTEURS = 8;

/** La marche de l'ombre vers le soleil : un pixel par pas, et ce que monte le rayon. */
const VERS_LE_SOLEIL = { x: -0.853, y: 0.523, monte: 1.21, pas: 21 };

/** Le poids d'un decalage dans un flou gaussien d'ecart 2,2, sur quinze pixels. */
const FLOU = (() => {
  const w: number[] = [];
  let s = 0;
  for (let k = -7; k <= 7; k += 1) {
    const v = Math.exp(-(k * k) / (2 * 2.2 * 2.2));
    w.push(v);
    s += v;
  }
  return w.map((v) => v / s);
})();
const poids = (k: number) => (k < -7 || k > 7 ? 0 : FLOU[k + 7]!);

// ------------------------------------------------------------- un morceau

/**
 * Le massif d'un morceau de carte, peint rangee par rangee avec lui.
 *
 * Apres `rangee(y)`, pour chaque colonne du morceau : `couvert` dit si le massif
 * s'y dessine, et alors `ton` (0 a 5) et `matiere` ; sinon `ombre` dit de
 * combien de tons le sol s'assombrit avant d'etre arrondi (l'ombre que le
 * massif jette), et `pied` de combien de marches apres (le pied du massif).
 *
 * ⚠️ **Les rangees se demandent dans l'ordre**, sans en sauter : le bord et le
 * pied lisent les rangees du dessus. Le constructeur peint deja les neuf
 * rangees au-dessus du morceau.
 */
export class MassifDUnMorceau {
  readonly couvert: Uint8Array;
  readonly ton: Uint8Array;
  readonly matiere: Uint8Array;
  readonly ombre: Float32Array;
  readonly pied: Uint8Array;

  private readonly L: number;
  private readonly facettes: Facette[];
  /** Les facettes par bande de huit rangees d'ecran, dans l'ordre de peinture. */
  private readonly bandes: Facette[][];
  private readonly haut0: number;
  private readonly cour: Uint8Array;
  private readonly tonBrut: Float32Array;
  private readonly mat: Uint8Array;
  private readonly hauteur: Float32Array;
  private readonly dessusCour: Uint8Array;
  private readonly dessusHauteur: Float32Array;
  /** Le bas du massif des huit dernieres rangees, deja flou en largeur ; la plus recente en tete. */
  private readonly bas: Float32Array[];
  private readonly basNonVide: boolean[];
  /** Les hauteurs vues du dessus, sur une grille de 8 px, et ce qui peut jeter une ombre. */
  private readonly hh: Float32Array;
  private readonly ombrable: Uint8Array;
  private readonly hx0: number;
  private readonly hy0: number;
  private readonly hl: number;
  private readonly hh_: number;

  private constructor(
    private readonly x0: number,
    y0: number,
    private readonly largeur: number,
    hauteur: number,
  ) {
    this.L = largeur + 2 * MARGE;
    this.couvert = new Uint8Array(largeur);
    this.ton = new Uint8Array(largeur);
    this.matiere = new Uint8Array(largeur);
    this.ombre = new Float32Array(largeur);
    this.pied = new Uint8Array(largeur);
    this.cour = new Uint8Array(this.L);
    this.tonBrut = new Float32Array(this.L);
    this.mat = new Uint8Array(this.L);
    this.hauteur = new Float32Array(this.L);
    this.dessusCour = new Uint8Array(this.L);
    this.dessusHauteur = new Float32Array(this.L);
    this.bas = Array.from({ length: HISTOIRE }, () => new Float32Array(this.L));
    this.basNonVide = new Array<boolean>(HISTOIRE).fill(false);

    const haut = y0 - HISTOIRE - 2;
    this.haut0 = haut;
    this.facettes = facettesDuMassif(x0 - MARGE, haut, x0 + largeur + MARGE, y0 + hauteur);
    const nb = Math.ceil((y0 + hauteur - haut + 2) / 8) + 1;
    this.bandes = Array.from({ length: nb }, () => []);
    for (const f of this.facettes) {
      const b0 = Math.max(0, Math.floor((f.ymin - haut) / 8));
      const b1 = Math.min(nb - 1, Math.floor((f.ymax - haut) / 8));
      for (let b = b0; b <= b1; b += 1) this.bandes[b]!.push(f);
    }

    // Les hauteurs vues du dessus, ancrees sur le monde : deux morceaux voisins
    // lisent les memes. Le rayon part vers l'ouest et le sud.
    const P = PAS_DES_HAUTEURS;
    this.hx0 = Math.floor((x0 - MARGE - 24) / P);
    this.hy0 = Math.floor((haut - 2) / P);
    this.hl = Math.ceil((x0 + largeur + MARGE + 2) / P) - this.hx0 + 1;
    this.hh_ = Math.ceil((y0 + hauteur + 16) / P) - this.hy0 + 1;
    this.hh = new Float32Array(this.hl * this.hh_);
    for (let j = 0; j < this.hh_; j += 1) {
      for (let i = 0; i < this.hl; i += 1) {
        const X = (this.hx0 + i) * P;
        const Y = (this.hy0 + j) * P;
        this.hh[j * this.hl + i] = hauteurDeRoche(profondeurDeRoche(X, Y), X, Y);
      }
    }
    // Une case de la grille peut-elle etre a l'ombre ? Seulement s'il y a du
    // massif dans les trois cases a l'ouest et les deux au sud.
    this.ombrable = new Uint8Array(this.hl * this.hh_);
    for (let j = 0; j < this.hh_; j += 1) {
      for (let i = 0; i < this.hl; i += 1) {
        let o = 0;
        for (let dj = -1; dj <= 3 && !o; dj += 1) {
          for (let di = -4; di <= 1 && !o; di += 1) {
            const ii = i + di;
            const jj = j + dj;
            if (ii >= 0 && jj >= 0 && ii < this.hl && jj < this.hh_ && this.hh[jj * this.hl + ii]! > 0) o = 1;
          }
        }
        this.ombrable[j * this.hl + i] = o;
      }
    }

    for (let y = haut; y < y0; y += 1) this.rangee(y);
  }

  /**
   * Le massif d'un morceau, ou `null` si aucune roche n'en approche — le cas de
   * presque tous : un coup d'oeil tous les seize pixels suffit a le savoir.
   */
  static preparer(x0: number, y0: number, largeur: number, hauteur: number): MassifDUnMorceau | null {
    // ⚠️ La profondeur est une distance : elle ne gagne pas plus d'un pixel par
    // pixel. Si aucun point de la grille de seize ne depasse 12, aucun point
    // entre eux n'atteint les 24 ou le massif commence.
    const xa = x0 - MARGE - 32;
    const xb = x0 + largeur + MARGE + 16;
    const ya = y0 - HISTOIRE - 32;
    const yb = y0 + hauteur + MONTEE * HAUTEUR_MAX + 32;
    let pres = false;
    for (let y = ya; y <= yb && !pres; y += 16) {
      for (let x = xa; x <= xb && !pres; x += 16) {
        if (profondeurDeRoche(x, y) > 12) pres = true;
      }
    }
    return pres ? new MassifDUnMorceau(x0, y0, largeur, hauteur) : null;
  }

  /** La hauteur vue du dessus en un point, entre les quatre points de sa grille. */
  private hauteurVue(x: number, y: number): number {
    const fx = x / PAS_DES_HAUTEURS - this.hx0;
    const fy = y / PAS_DES_HAUTEURS - this.hy0;
    let i = Math.floor(fx);
    let j = Math.floor(fy);
    if (i < 0) i = 0;
    if (j < 0) j = 0;
    if (i > this.hl - 2) i = this.hl - 2;
    if (j > this.hh_ - 2) j = this.hh_ - 2;
    const tx = Math.min(1, Math.max(0, fx - i));
    const ty = Math.min(1, Math.max(0, fy - j));
    const k = j * this.hl + i;
    const a = this.hh[k]! + (this.hh[k + 1]! - this.hh[k]!) * tx;
    const b = this.hh[k + this.hl]! + (this.hh[k + this.hl + 1]! - this.hh[k + this.hl]!) * tx;
    return a + (b - a) * ty;
  }

  /** Peint la rangee d'ecran `y` du massif (en pixels du monde). */
  rangee(y: number): void {
    const { L, cour, tonBrut, mat, hauteur } = this;
    const gauche = this.x0 - MARGE;
    cour.fill(0);

    // 1. Les facettes, du fond vers le devant : la plus au sud recouvre.
    const bande = this.bandes[Math.floor((y - this.haut0) / 8)];
    if (bande) {
      const Y = y + 0.5;
      for (const f of bande) {
        if (y < f.ymin || y > f.ymax) continue;
        const i0 = Math.max(0, f.xmin - gauche);
        const i1 = Math.min(L - 1, f.xmax - gauche);
        for (let i = i0; i <= i1; i += 1) {
          const z = couvre(f, gauche + i + 0.5, Y);
          if (z < 0) continue;
          cour[i] = 1;
          tonBrut[i] = f.ton;
          mat[i] = f.matiere;
          hauteur[i] = z;
        }
      }
    }

    // 2. Le bas du massif a la rangee du dessus, maintenant qu'on sait ce qu'il y a dessous.
    const recent = this.bas.pop()!;
    this.basNonVide.pop();
    let nonVide = false;
    recent.fill(0);
    for (let i = 0; i < L; i += 1) {
      if (!this.dessusCour[i] || cour[i]) continue;
      nonVide = true;
      for (let k = -4; k <= 4; k += 1) {
        const ii = i + k;
        if (ii >= 0 && ii < L) recent[ii] = recent[ii]! + poids(k);
      }
    }
    this.bas.unshift(recent);
    this.basNonVide.unshift(nonVide);

    // 3. Ce que voit le morceau : ses colonnes, sans la marge.
    for (let c = 0; c < this.largeur; c += 1) {
      const i = c + MARGE;
      const x = this.x0 + c;
      this.couvert[c] = cour[i]!;
      this.ombre[c] = 0;
      this.pied[c] = 0;
      if (cour[i]) {
        // Le trait : une facette qui passe devant une autre bien plus basse, la
        // silhouette du haut, et les flancs.
        let t = tonBrut[i]!;
        if (this.dessusCour[i] && hauteur[i]! - this.dessusHauteur[i]! > 7) t -= 1.6;
        if (!this.dessusCour[i]) t = FOND;
        else if ((!cour[i - 1] || !cour[i + 1]) && hauteur[i]! > 4 && mat[i] !== EBO) t = FOND;
        let ton = FOND;
        if (t > FOND) {
          ton = Math.round(t + (bruit(x, y, 820) - 0.5) * 0.9 + (bruitLisse(x, y, 2.6, 821) - 0.5) * 0.8);
          ton = ton < FOND ? FOND : ton > CLAIR ? CLAIR : ton;
        }
        this.ton[c] = ton;
        this.matiere[c] = mat[i]!;
        continue;
      }

      // Le pied : le sol s'assombrit juste sous le bas du massif.
      let devant = 0;
      for (let k = 1; k <= HISTOIRE; k += 1) {
        if (this.basNonVide[k - 1]) devant += this.bas[k - 1]![i]! * poids(k - 2);
      }
      this.pied[c] = Math.round(Math.min(1, devant * 3.5) * 1.8);

      // L'ombre que le massif jette, en marchant vers le soleil.
      const ci = Math.floor(x / PAS_DES_HAUTEURS) - this.hx0;
      const cj = Math.floor(y / PAS_DES_HAUTEURS) - this.hy0;
      if (ci < 0 || cj < 0 || ci >= this.hl || cj >= this.hh_ || !this.ombrable[cj * this.hl + ci]) continue;
      const ici = this.hauteurVue(x + 0.5, y + 0.5);
      for (let s = 1; s <= VERS_LE_SOLEIL.pas; s += 1) {
        const vu = this.hauteurVue(x + 0.5 + VERS_LE_SOLEIL.x * s, y + 0.5 + VERS_LE_SOLEIL.y * s);
        if (vu > ici + VERS_LE_SOLEIL.monte * s + 0.5) {
          this.ombre[c] = 1.5;
          break;
        }
      }
    }

    this.dessusCour.set(cour);
    this.dessusHauteur.set(hauteur);
  }
}
