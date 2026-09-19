import { spawnSync } from "node:child_process";

/**
 * Une petite table de mixage, pour `scripts/son/intro.ts`.
 *
 * Tout se passe en memoire, en flottants, a 48 kHz et en stereo : ffmpeg ne
 * sert qu'a **lire** les sources (quel que soit leur format) et a **ecrire** le
 * resultat. Entre les deux, chaque geste — poser un cri a 1,9 s, l'eloigner, le
 * noyer dans une reverberation, faire monter le feu — est une fonction de
 * quelques lignes qu'on peut relire, plutot qu'un graphe de filtres ffmpeg
 * d'une page.
 */

export const TAUX = 48000;

/** Un son stereo : la voie gauche et la voie droite, en flottants. */
export interface Son {
  g: Float32Array;
  d: Float32Array;
}

export function silence(secondes: number): Son {
  const n = Math.round(secondes * TAUX);
  return { g: new Float32Array(n), d: new Float32Array(n) };
}

export function duree(s: Son): number {
  return s.g.length / TAUX;
}

export function copie(s: Son): Son {
  return { g: s.g.slice(), d: s.d.slice() };
}

/** Lit un fichier son, n'importe lequel : ffmpeg le rend en stereo 48 kHz. */
export function lire(fichier: string, debut = 0, longueur?: number): Son {
  const args = ["-hide_banner", "-loglevel", "error", "-ss", `${debut}`, "-i", fichier];
  if (longueur !== undefined) args.push("-t", `${longueur}`);
  args.push("-f", "f32le", "-acodec", "pcm_f32le", "-ac", "2", "-ar", `${TAUX}`, "pipe:1");
  const r = spawnSync("ffmpeg", args, { maxBuffer: 1 << 30 });
  if (r.status !== 0) throw new Error(`[son] lecture impossible : ${fichier}\n${r.stderr}`);
  const brut = new Float32Array(r.stdout.buffer, r.stdout.byteOffset, r.stdout.byteLength / 4);
  const n = brut.length / 2;
  const s: Son = { g: new Float32Array(n), d: new Float32Array(n) };
  for (let i = 0; i < n; i++) {
    s.g[i] = brut[2 * i];
    s.d[i] = brut[2 * i + 1];
  }
  return s;
}

/** Ecrit `s` dans `fichier` ; `codec` est la liste d'options ffmpeg de sortie. */
export function ecrire(s: Son, fichier: string, codec: string[]): void {
  const n = s.g.length;
  const entrelace = new Float32Array(2 * n);
  for (let i = 0; i < n; i++) {
    entrelace[2 * i] = s.g[i];
    entrelace[2 * i + 1] = s.d[i];
  }
  const r = spawnSync(
    "ffmpeg",
    ["-hide_banner", "-loglevel", "error", "-y", "-f", "f32le", "-ar", `${TAUX}`, "-ac", "2", "-i", "pipe:0", ...codec, fichier],
    { input: Buffer.from(entrelace.buffer), maxBuffer: 1 << 30 },
  );
  if (r.status !== 0) throw new Error(`[son] ecriture impossible : ${fichier}\n${r.stderr}`);
}

// ------------------------------------------------------------------ gestes

/** Ajoute `son` dans `dans` a partir de `a` secondes, avec un gain et une place (-1 gauche, 1 droite). */
export function poser(dans: Son, son: Son, a: number, gain = 1, pan = 0): void {
  const debut = Math.round(a * TAUX);
  // Loi a puissance constante : un son au milieu n'est pas plus fort qu'un son sur le cote.
  const angle = ((pan + 1) * Math.PI) / 4;
  const gG = gain * Math.cos(angle) * Math.SQRT2;
  const gD = gain * Math.sin(angle) * Math.SQRT2;
  for (let i = 0; i < son.g.length; i++) {
    const j = debut + i;
    if (j < 0) continue;
    if (j >= dans.g.length) break;
    if (pan === 0) {
      dans.g[j] += son.g[i] * gain;
      dans.d[j] += son.d[i] * gain;
    } else {
      // Un son place sur un cote : on le ramene au centre puis on le pousse.
      const m = (son.g[i] + son.d[i]) / 2;
      dans.g[j] += m * gG;
      dans.d[j] += m * gD;
    }
  }
}

/** Multiplie le son par une courbe du temps (en secondes). */
export function enveloppe(s: Son, courbe: (t: number) => number): Son {
  for (let i = 0; i < s.g.length; i++) {
    const k = courbe(i / TAUX);
    s.g[i] *= k;
    s.d[i] *= k;
  }
  return s;
}

export function gain(s: Son, k: number): Son {
  return enveloppe(s, () => k);
}

/** Une rampe douce de 0 a 1 entre `de` et `a` secondes (et 1 apres). */
export function rampe(t: number, de: number, a: number): number {
  if (t <= de) return 0;
  if (t >= a) return 1;
  const u = (t - de) / (a - de);
  return u * u * (3 - 2 * u);
}

export function decouper(s: Son, de: number, longueur: number): Son {
  const i = Math.round(de * TAUX);
  const n = Math.round(longueur * TAUX);
  return { g: s.g.slice(i, i + n), d: s.d.slice(i, i + n) };
}

/** Ralentit le son (et le rend plus grave) d'un facteur : 0,8 = 20 % plus lent. */
export function ralentir(s: Son, facteur: number): Son {
  const n = Math.floor(s.g.length / facteur);
  const r: Son = { g: new Float32Array(n), d: new Float32Array(n) };
  for (let i = 0; i < n; i++) {
    const x = i * facteur;
    const k = Math.floor(x);
    const f = x - k;
    const k2 = Math.min(k + 1, s.g.length - 1);
    r.g[i] = s.g[k] * (1 - f) + s.g[k2] * f;
    r.d[i] = s.d[k] * (1 - f) + s.d[k2] * f;
  }
  return r;
}

// ----------------------------------------------------------------- filtres

type Genre = "bas" | "haut";

/** Un filtre biquad (le livre de recettes de R. Bristow-Johnson), applique sur place. */
function biquad(voie: Float32Array, genre: Genre, frequence: number, q: number): void {
  const w = (2 * Math.PI * frequence) / TAUX;
  const cos = Math.cos(w);
  const alpha = Math.sin(w) / (2 * q);
  const a0 = 1 + alpha;
  const b0 = (genre === "bas" ? (1 - cos) / 2 : (1 + cos) / 2) / a0;
  const b1 = (genre === "bas" ? 1 - cos : -(1 + cos)) / a0;
  const b2 = b0;
  const a1 = (-2 * cos) / a0;
  const a2 = (1 - alpha) / a0;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < voie.length; i++) {
    const x = voie[i];
    const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x; y2 = y1; y1 = y;
    voie[i] = y;
  }
}

export function passeBas(s: Son, frequence: number, q = Math.SQRT1_2): Son {
  biquad(s.g, "bas", frequence, q);
  biquad(s.d, "bas", frequence, q);
  return s;
}

export function passeHaut(s: Son, frequence: number, q = Math.SQRT1_2): Son {
  biquad(s.g, "haut", frequence, q);
  biquad(s.d, "haut", frequence, q);
  return s;
}

// ------------------------------------------------------------ reverberation

/**
 * Une reverberation « Freeverb » (Jezar, domaine public) : huit filtres en
 * peigne et quatre passe-tout par voie. Elle donne l'espace d'un village la
 * nuit — des murs, pas une cathedrale.
 *
 * @param piece  0 a 1 : la taille (la longueur de la queue).
 * @param amorti 0 a 1 : les aigus qui meurent en premier.
 * @param humide la part reverberee ; `sec` la part directe.
 */
export function reverberer(
  s: Son,
  { piece = 0.7, amorti = 0.5, humide = 0.3, sec = 1, queue = 2 }: {
    piece?: number;
    amorti?: number;
    humide?: number;
    sec?: number;
    /** Secondes de silence ajoutees a la fin, pour que la queue ait la place de s'eteindre. */
    queue?: number;
  } = {},
): Son {
  const echelle = TAUX / 44100;
  const peignes = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617];
  const passeTout = [556, 441, 341, 225];
  const ecart = 23;
  const retour = piece * 0.28 + 0.7;
  const amort = amorti * 0.4;
  const n = s.g.length + Math.round(queue * TAUX);
  const sortie: Son = { g: new Float32Array(n), d: new Float32Array(n) };

  const voie = (decalage: number) => {
    const p = peignes.map((l) => ({ tampon: new Float32Array(Math.round((l + decalage) * echelle)), i: 0, filtre: 0 }));
    const a = passeTout.map((l) => ({ tampon: new Float32Array(Math.round((l + decalage) * echelle)), i: 0 }));
    return (x: number) => {
      let y = 0;
      for (const c of p) {
        const lu = c.tampon[c.i];
        y += lu;
        c.filtre = lu * (1 - amort) + c.filtre * amort;
        c.tampon[c.i] = x + c.filtre * retour;
        c.i = (c.i + 1) % c.tampon.length;
      }
      for (const c of a) {
        const lu = c.tampon[c.i];
        const z = -y + lu;
        c.tampon[c.i] = y + lu * 0.5;
        c.i = (c.i + 1) % c.tampon.length;
        y = z;
      }
      return y;
    };
  };
  const gauche = voie(0);
  const droite = voie(ecart);
  const entree = 0.015;
  const mouille = humide * 3;
  for (let i = 0; i < n; i++) {
    const xg = i < s.g.length ? s.g[i] : 0;
    const xd = i < s.d.length ? s.d[i] : 0;
    const x = (xg + xd) * entree;
    const yg = gauche(x);
    const yd = droite(x);
    sortie.g[i] = yg * mouille + xg * sec;
    sortie.d[i] = yd * mouille + xd * sec;
  }
  return sortie;
}

// ------------------------------------------------------------- les boucles

/**
 * Fait de `s` une boucle sans couture de `longueur` secondes : les `croisement`
 * secondes qui suivent la fin sont fondues dans le debut. Arrive au bout, le
 * son retombe exactement sur ce qu'il jouait au debut.
 */
export function boucler(s: Son, longueur: number, croisement: number): Son {
  const n = Math.round(longueur * TAUX);
  const x = Math.round(croisement * TAUX);
  if (s.g.length < n + x) throw new Error(`[son] trop court pour boucler ${longueur} s`);
  const r: Son = { g: s.g.slice(0, n), d: s.d.slice(0, n) };
  for (let i = 0; i < x; i++) {
    // Puissance constante : deux bruits sans rapport ne se creusent pas au milieu.
    const u = i / x;
    const entre = Math.sin((u * Math.PI) / 2);
    const sort = Math.cos((u * Math.PI) / 2);
    r.g[i] = s.g[i] * entre + s.g[n + i] * sort;
    r.d[i] = s.d[i] * entre + s.d[n + i] * sort;
  }
  return r;
}

// ------------------------------------------------------------------ mesures

export function crete(s: Son): number {
  let m = 0;
  for (let i = 0; i < s.g.length; i++) m = Math.max(m, Math.abs(s.g[i]), Math.abs(s.d[i]));
  return m;
}

/** La valeur efficace, en decibels pleine echelle. */
export function niveau(s: Son): number {
  let somme = 0;
  for (let i = 0; i < s.g.length; i++) somme += s.g[i] * s.g[i] + s.d[i] * s.d[i];
  return 10 * Math.log10(somme / (2 * s.g.length) + 1e-12);
}

/** Ramene la valeur efficace a `cible` dB. */
export function aNiveau(s: Son, cible: number): Son {
  return gain(s, 10 ** ((cible - niveau(s)) / 20));
}

/** Ramene la crete a `cible` dB. */
export function aCrete(s: Son, cible: number): Son {
  return gain(s, 10 ** (cible / 20) / (crete(s) || 1));
}

/**
 * Arrondit les cretes au-dessus de `plafond` dB, sans toucher au reste.
 *
 * Un feu enregistre a des craquements vingt decibels au-dessus de son souffle :
 * un seul d'entre eux, a pleine force, sonne aussi fort qu'une cloche, et
 * c'est lui qui dicte alors le volume de tout le mixage.
 */
export function adoucir(s: Son, plafond: number): Son {
  const p = 10 ** (plafond / 20);
  for (let i = 0; i < s.g.length; i++) {
    s.g[i] = p * Math.tanh(s.g[i] / p);
    s.d[i] = p * Math.tanh(s.d[i] / p);
  }
  return s;
}

// ---------------------------------------------------------------- hasard

/** Un generateur a graine (mulberry32) : le meme mix a chaque passage. */
export function hasard(graine: number): () => number {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
