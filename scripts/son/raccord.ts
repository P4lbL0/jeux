import { TAUX, type Son } from "./dsp";

/**
 * Trouver ou boucler un morceau de musique sans que l'oreille le remarque.
 *
 * Un morceau compose ne se boucle pas en recollant sa fin a son debut : la fin
 * s'eteint, le debut est une introduction, et le rythme saute. On cherche donc
 * **deux instants A et B ou la musique joue presque la meme chose** — un refrain
 * qui revient, une mesure de tambours repetee. Le jeu joue alors le morceau
 * depuis le debut, puis, arrive a B, repart en A : la Web Audio sait boucler
 * entre deux points a l'echantillon pres (`loopStart` / `loopEnd`).
 *
 * « Presque la meme chose » se mesure : on compare les spectres (24 bandes, sur
 * une fenetre de quelques secondes) de chaque couple d'instants candidats, puis
 * on cale B a l'echantillon pres sur la forme d'onde de A. Enfin, les derniers
 * instants avant B sont fondus avec ceux avant A : au moment du saut, le son
 * est deja celui qui precede A, la couture est invisible.
 */

const TROU = 1024; // pas d'analyse : ~21 ms
const FFT = 2048;
const BANDES = 24;

function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k, b = a + len / 2;
        const tr = re[b] * cr - im[b] * ci;
        const ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr; im[b] = im[a] - ti;
        re[a] += tr; im[a] += ti;
        const nr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = nr;
      }
    }
  }
}

/** Le spectre en 24 bandes (echelle quasi logarithmique), trame par trame, en dB. */
function spectres(s: Son): Float32Array[] {
  const trames: Float32Array[] = [];
  const fenetre = new Float64Array(FFT).map((_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / FFT));
  const bords = Array.from({ length: BANDES + 1 }, (_, b) => Math.round(2 * (FFT / 2 / 2) ** (b / BANDES)));
  for (let debut = 0; debut + FFT < s.g.length; debut += TROU) {
    const re = new Float64Array(FFT), im = new Float64Array(FFT);
    for (let i = 0; i < FFT; i++) re[i] = ((s.g[debut + i] + s.d[debut + i]) / 2) * fenetre[i];
    fft(re, im);
    const t = new Float32Array(BANDES);
    for (let b = 0; b < BANDES; b++) {
      let e = 0;
      for (let k = bords[b]; k < Math.max(bords[b + 1], bords[b] + 1); k++) e += re[k] * re[k] + im[k] * im[k];
      t[b] = 10 * Math.log10(e + 1e-9);
    }
    trames.push(t);
  }
  return trames;
}

export interface Raccord {
  /** Ou le morceau repart (secondes). */
  debut: number;
  /** Ou il saute (secondes). */
  fin: number;
  /** L'ecart moyen des spectres autour des deux instants, en dB : plus bas, plus invisible. */
  ecart: number;
  /** Ce que les deux formes d'onde se ressemblent sur deux secondes : 1 = identiques, 0 = sans rapport. */
  correlation: number;
}

/**
 * Cherche le meilleur couple (A, B) : A entre `a[0]` et `a[1]`, B entre `b[0]` et
 * `b[1]` (secondes), en comparant `fenetre` secondes de spectre avant et apres.
 */
export function chercherRaccord(
  s: Son,
  a: [number, number],
  b: [number, number],
  fenetre = 3,
  /** La boucle la plus courte acceptee : en dessous, on entendrait le morceau tourner en rond. */
  minimum = 45,
): Raccord {
  const tr = spectres(s);
  const parSeconde = TAUX / TROU;
  const w = Math.round(fenetre * parSeconde);
  // Premier tri, au spectre : les memes instruments, la meme densite. On garde
  // les meilleurs couples, pas le seul meilleur — deux passages peuvent avoir le
  // meme timbre sans jouer les memes notes au meme instant.
  const candidats: { i: number; j: number; e: number }[] = [];
  const GARDES = 300;
  // Une trame sur deux quand on cherche sur tout le morceau ; chacune quand les
  // fenetres sont serrees (quelques secondes) : c'est la que se joue la precision.
  const pas = a[1] - a[0] > 10 || b[1] - b[0] > 10 ? 2 : 1;
  for (let i = Math.round(a[0] * parSeconde); i <= Math.round(a[1] * parSeconde); i += pas) {
    for (let j = Math.round(b[0] * parSeconde); j <= Math.round(b[1] * parSeconde); j += pas) {
      if (j - i < minimum * parSeconde) continue;
      let e = 0, n = 0;
      for (let k = -w; k < w; k += 2) {
        const x = tr[i + k], y = tr[j + k];
        if (!x || !y) continue;
        for (let q = 0; q < BANDES; q++) e += Math.abs(x[q] - y[q]);
        n += BANDES;
      }
      if (!n) continue;
      const ecart = e / n;
      if (candidats.length < GARDES || ecart < candidats[candidats.length - 1].e) {
        candidats.push({ i, j, e: ecart });
        candidats.sort((x, y) => x.e - y.e);
        if (candidats.length > GARDES) candidats.pop();
      }
    }
  }
  // Second tri, a la forme d'onde : pour chaque couple, on cale B a la
  // milliseconde et on mesure a quel point les deux passages se superposent
  // (correlation sur une seconde, en mono, un echantillon sur quatre).
  const mono = new Float32Array(s.g.length);
  for (let k = 0; k < mono.length; k++) mono[k] = s.g[k] + s.d[k];
  const correlation = (A: number, B: number, demi: number, saut: number) => {
    let xy = 0, xx = 0, yy = 0;
    for (let k = -demi; k < demi; k += saut) {
      const x = mono[A + k], y = mono[B + k];
      if (x === undefined || y === undefined) continue;
      xy += x * y; xx += x * x; yy += y * y;
    }
    return xy / (Math.sqrt(xx * yy) || 1);
  };
  let meilleur = { A: 0, B: 0, c: -Infinity, e: 0 };
  const milli = Math.round(TAUX / 1000);
  for (const { i, j, e } of candidats) {
    const A = i * TROU;
    for (let d = -30; d <= 30; d++) {
      const B = j * TROU + d * milli;
      const c = correlation(A, B, Math.round(0.5 * TAUX), 4);
      if (c > meilleur.c) meilleur = { A, B, c, e };
    }
  }
  // Calage final a l'echantillon pres, sur les 80 ms qui precedent le saut.
  const L = Math.round(0.08 * TAUX);
  let B = meilleur.B, meilleureCorr = -Infinity;
  for (let d = -milli; d <= milli; d++) {
    const c = correlation(meilleur.A - L / 2, meilleur.B + d - L / 2, L / 2, 1);
    if (c > meilleureCorr) { meilleureCorr = c; B = meilleur.B + d; }
  }
  return {
    debut: meilleur.A / TAUX,
    fin: B / TAUX,
    ecart: meilleur.e,
    correlation: correlation(meilleur.A, B, TAUX, 1),
  };
}

/**
 * Coupe le morceau a B et fond ses `croisement` dernieres secondes avec celles
 * qui precedent A : sauter de B a A ne s'entend plus.
 */
export function preparerLaBoucle(s: Son, r: Raccord, croisement = 1.5): Son {
  const A = Math.round(r.debut * TAUX);
  const B = Math.round(r.fin * TAUX);
  const X = Math.min(Math.round(croisement * TAUX), A);
  const sortie: Son = { g: s.g.slice(0, B), d: s.d.slice(0, B) };
  for (let i = 0; i < X; i++) {
    const u = i / X;
    const vient = Math.sin((u * Math.PI) / 2);
    const part = Math.cos((u * Math.PI) / 2);
    const k = B - X + i;
    sortie.g[k] = s.g[k] * part + s.g[A - X + i] * vient;
    sortie.d[k] = s.d[k] * part + s.d[A - X + i] * vient;
  }
  return sortie;
}
