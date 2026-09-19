import { TAUX, hasard, passeBas, passeHaut, type Son } from "./dsp";

/**
 * Les deux sons que le 19 septembre 2026 n'a pas trouves libres de droits, et
 * qu'on fabrique donc ici.
 *
 * **La cloche.** Aucun enregistrement de glas en CC0 : ceux de Wikimedia
 * Commons sont en CC-BY-SA (a repartager sous la meme licence) ou noyes dans le
 * bruit, et les banques qui en ont interdisent aux robots de les telecharger.
 * Une cloche se fabrique bien, parce que sa voix est connue : une cloche
 * d'eglise sonne **une serie de partiels fixes** (le bourdon, la fondamentale,
 * la tierce mineure, la quinte, la nominale, puis des aigus serres), chacun en
 * **doublet** — deux frequences voisines qui battent, a cause des defauts du
 * bronze — et chacun meurt a sa vitesse : les graves chantent vingt secondes,
 * les aigus deux. C'est la tierce mineure qui fait le glas triste.
 *
 * **Le grondement.** Les feux de cheminee libres de droits crepitent, mais une
 * maison qui brule gronde aussi : un souffle grave qui enfle et retombe. C'est
 * du bruit filtre, et un souffle ne se reconnait pas a son grain.
 */

/** Les partiels d'une cloche d'eglise : rapport a la fondamentale, force, duree de vie (s). */
const PARTIELS: [number, number, number][] = [
  [0.5, 0.55, 38], // le bourdon (hum), une octave sous la fondamentale
  [1.0, 0.45, 22], // la fondamentale (prime)
  [1.19, 0.55, 17], // la tierce mineure : le glas
  [1.5, 0.22, 10], // la quinte
  [2.0, 0.7, 13], // la nominale : la note qu'on entend
  [2.51, 0.26, 7],
  [2.66, 0.16, 6],
  [3.01, 0.22, 5],
  [4.03, 0.13, 3.2],
  [4.94, 0.09, 2.4],
  [5.42, 0.07, 2.1],
  [6.21, 0.055, 1.8],
  [7.1, 0.045, 1.5],
  [8.34, 0.035, 1.2],
  [9.1, 0.028, 1.0],
  [10.4, 0.02, 0.8],
  [11.8, 0.016, 0.7],
];

/**
 * Un coup de cloche, sec (sans piece autour) : la reverberation vient apres,
 * au mixage, avec le reste du village.
 *
 * @param fondamentale en Hz. 98 Hz (un sol grave) : un bourdon de clocher, que
 *        les petits haut-parleurs entendent encore par sa nominale et ses aigus.
 */
export function cloche(fondamentale = 98, secondes = 14, graine = 1): Son {
  const alea = hasard(graine);
  const n = Math.round(secondes * TAUX);
  const s: Son = { g: new Float32Array(n), d: new Float32Array(n) };

  // Les partiels : chacun un peu faux (aucune cloche n'est juste), en doublet.
  const voix = PARTIELS.flatMap(([rapport, force, vie]) => {
    const f = fondamentale * rapport * (1 + (alea() - 0.5) * 0.006);
    const battement = 0.15 + alea() * 0.9; // Hz d'ecart entre les deux jumeaux
    const amortissement = Math.log(1000) / vie; // -60 dB au bout de `vie` secondes
    const pan = (alea() - 0.5) * 0.5;
    return [
      { f, force: force * 0.62, amortissement, phase: alea() * 2 * Math.PI, pan },
      { f: f + battement, force: force * 0.38, amortissement: amortissement * 1.1, phase: alea() * 2 * Math.PI, pan: -pan },
    ];
  });

  for (const v of voix) {
    const w = (2 * Math.PI * v.f) / TAUX;
    const gG = Math.cos(((v.pan + 1) * Math.PI) / 4) * Math.SQRT2;
    const gD = Math.sin(((v.pan + 1) * Math.PI) / 4) * Math.SQRT2;
    for (let i = 0; i < n; i++) {
      const t = i / TAUX;
      // Une attaque de 2 ms : le battant frappe, rien ne monte.
      const attaque = Math.min(1, t / 0.002);
      const x = v.force * attaque * Math.exp(-v.amortissement * t) * Math.sin(w * i + v.phase);
      s.g[i] += x * gG;
      s.d[i] += x * gD;
    }
  }

  // Le choc du battant : un eclat de metal, aigu et bref, par-dessus.
  const choc = new Float32Array(Math.round(0.25 * TAUX));
  for (let i = 0; i < choc.length; i++) {
    const t = i / TAUX;
    choc[i] = (alea() * 2 - 1) * Math.exp(-t / 0.018) * 0.5;
  }
  const eclat: Son = { g: choc, d: choc.slice() };
  passeHaut(eclat, 1800, 0.9);
  passeBas(eclat, 7000);
  for (let i = 0; i < choc.length; i++) {
    s.g[i] += eclat.g[i];
    s.d[i] += eclat.d[i];
  }
  return s;
}

/**
 * Le grondement d'un grand feu : un souffle grave qui enfle et retombe, sans
 * jamais se repeter. Deux voies a moitie independantes, pour qu'il soit large.
 */
export function grondement(secondes: number, graine = 2): Son {
  const alea = hasard(graine);
  const n = Math.round(secondes * TAUX);
  const s: Son = { g: new Float32Array(n), d: new Float32Array(n) };

  // L'enflure : trois houles lentes qui ne tombent jamais en phase (des
  // frequences sans rapport entre elles), et un frisson plus rapide par-dessus.
  const houles = [0.11, 0.27, 0.63].map((f, i) => ({
    f: f * (0.9 + alea() * 0.2),
    phase: alea() * 2 * Math.PI,
    force: [0.22, 0.14, 0.08][i],
  }));
  // Du bruit brun : chaque echantillon s'ecarte un peu du precedent.
  let commun = 0, g = 0, d = 0, frisson = 0;
  for (let i = 0; i < n; i++) {
    const t = i / TAUX;
    commun = commun * 0.997 + (alea() * 2 - 1) * 0.06;
    g = g * 0.997 + (alea() * 2 - 1) * 0.06;
    d = d * 0.997 + (alea() * 2 - 1) * 0.06;
    frisson += ((alea() * 2 - 1) - frisson) * 0.002;
    let enflure = 0.8 + frisson * 2.2;
    for (const h of houles) enflure += h.force * Math.sin(2 * Math.PI * h.f * t + h.phase);
    const k = Math.max(0.2, enflure);
    s.g[i] = (commun * 0.7 + g * 0.5) * k;
    s.d[i] = (commun * 0.7 + d * 0.5) * k;
  }
  passeHaut(s, 45);
  passeBas(s, 520, 0.6);
  return s;
}
