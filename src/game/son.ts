import Phaser from "phaser";
import survolOgg from "../assets/son/ui-survol.ogg?url";
import survolMp3 from "../assets/son/ui-survol.mp3?url";
import clicOgg from "../assets/son/ui-clic.ogg?url";
import clicMp3 from "../assets/son/ui-clic.mp3?url";

/**
 * Le son du jeu : trois pistes et un bouton muet (DESIGN.md §4.10).
 *
 * Il commence le 19 septembre 2026 par l'ecran-titre, puis la musique de la
 * partie le soir meme (`game/musique.ts`) ; les bruits de la partie (cris, coups
 * de hache — les animations emettent deja leurs evenements, §4.30) passeront
 * par ici aussi.
 *
 * Phaser charge et decode les fichiers (`load.audio`), et deverrouille le son au
 * premier clic. Ce module ne fait que **brancher** :
 *
 *     voix ──> piste « musique » ──────────────────────┐
 *     voix ──> piste « ambiance » ──> etouffoir ───────┼──> muet / volume general de Phaser
 *     voix ──> piste « effets » ───────────────────────┘
 *
 * Pourquoi pas `this.sound.play()` : Phaser branche chaque son directement sur
 * sa sortie, et il n'y a pas de place entre les deux pour une piste ou un
 * filtre. Or l'ecran-titre a besoin des deux : la musique et le feu se reglent
 * a part, et le feu devient sourd quand l'image se trouble (l'etouffoir, un
 * passe-bas qui descend en meme temps que le flou monte).
 *
 * ⚠️ **Rien ici ne doit pouvoir bloquer le jeu.** Sans Web Audio, avant le
 * premier clic, ou quand un fichier manque : `jouer` rend `null` et on continue
 * en silence. Le jeu n'attend jamais un son.
 */

export type Piste = "musique" | "ambiance" | "effets";

export const PISTES: readonly Piste[] = ["musique", "ambiance", "effets"];

/**
 * Le volume de base de chaque piste. Les fichiers sont deja equilibres entre
 * eux (`scripts/son/intro.ts`) ; la musique est un cran plus bas pour laisser
 * passer le feu et le glas.
 *
 * Le joueur regle ensuite chaque piste de 0 a 100 % dans PARAMETRES (§4.10) :
 * son reglage **multiplie** ce volume de base, il ne le remplace pas — a 100 %,
 * on entend le mixage tel qu'il a ete fait.
 */
const VOLUME_DES_PISTES: Record<Piste, number> = { musique: 0.7, ambiance: 1, effets: 1 };

/** Les reglages du joueur, retenus d'une visite a l'autre. */
const CLE_VOLUMES = "protecteur:son:volumes";

const reglages: Record<Piste, number> = { musique: 1, ambiance: 1, effets: 1 };

/** L'etouffoir ouvert : au-dessus de tout ce qu'une oreille entend. */
const OUVERT = 20000;

/** L'etouffoir ferme : un feu entendu a travers un mur. */
const SOURD = 700;

/** Le muet se retient d'une visite a l'autre, comme la sauvegarde (§4.28). */
const CLE_MUET = "protecteur:son:muet";

/** Les deux bruits de l'interface, charges au demarrage avec les sprites. */
export const SONS_INTERFACE = {
  /** Le survol d'une entree : une pointe de metal, a peine. */
  survol: { cle: "ui-survol", urls: [survolOgg, survolMp3] },
  /** Le clic : une ferrure qui claque. */
  clic: { cle: "ui-clic", urls: [clicOgg, clicMp3] },
} as const;

/** Un son qui joue : on ne peut plus que l'arreter. */
export interface Voix {
  /** Arrete le son en le faisant descendre en `fondu` secondes. */
  arreter(fondu?: number): void;
}

/** Les deux points d'une boucle, en secondes, dans le fichier livre. */
export interface Boucle {
  depuis: number;
  jusqua: number;
}

/**
 * La forme d'un fondu. `lineaire` : une rampe droite, pour un son qui part ou
 * s'arrete seul. `puissance` : un quart de sinus a la montee, de cosinus a la
 * descente — deux sons qui se croisent ainsi gardent une force constante, la ou
 * deux rampes droites creusent un trou de 6 dB au milieu du fondu enchaine.
 */
export type Courbe = "lineaire" | "puissance";

export interface OptionsDeVoix {
  /** Le volume de cette voix, de 0 a 1 (defaut 1). */
  volume?: number;
  /**
   * Rejoue sans fin, sans couture. `true` : tout le fichier en boucle.
   * `{ depuis, jusqua }` : le fichier se joue une fois jusqu'a `jusqua`, puis
   * repart de `depuis` secondes, sans fin — une introduction qui ne revient
   * pas, un corps qui tourne. Le fichier est coupe et fondu pour ca
   * (`scripts/son/raccord.ts`).
   *
   * ⚠️ `jusqua` est donne, pas deduit de la duree : un MP3 decode garde
   * quelques millisecondes de silence en fin de fichier, qu'on entendrait a
   * chaque tour.
   */
  boucle?: boolean | Boucle;
  /** Monte depuis le silence en `fondu` secondes plutot que de partir d'un coup. */
  fondu?: number;
  /** Commence a cette seconde du fichier plutot qu'a son debut (une musique reprise a son corps, sans son introduction). */
  depuis?: number;
  /** La forme du fondu d'entree et de celui d'`arreter` (defaut : lineaire). */
  courbe?: Courbe;
  /** La place dans l'image, de -1 (tout a gauche) a 1 (tout a droite) ; 0 ou rien : au milieu. */
  pan?: number;
  /** La vitesse de lecture (1 = telle quelle) : un peu plus vite, c'est un peu plus aigu. */
  vitesse?: number;
}

interface Branchements {
  contexte: AudioContext;
  pistes: Record<Piste, GainNode>;
  etouffoir: BiquadFilterNode;
}

/** Les pistes sont posees une fois, au premier son, et servent tout le jeu. */
let branchements: Branchements | null = null;

function brancher(scene: Phaser.Scene): Branchements | null {
  const son = scene.sound;
  if (!(son instanceof Phaser.Sound.WebAudioSoundManager)) return null;
  if (branchements?.contexte === son.context) return branchements;

  const contexte = son.context;
  const piste = (p: Piste) => {
    const gain = contexte.createGain();
    gain.gain.value = VOLUME_DES_PISTES[p] * reglages[p];
    return gain;
  };
  const pistes: Record<Piste, GainNode> = {
    musique: piste("musique"),
    ambiance: piste("ambiance"),
    effets: piste("effets"),
  };
  const etouffoir = contexte.createBiquadFilter();
  etouffoir.type = "lowpass";
  etouffoir.frequency.value = OUVERT;
  etouffoir.Q.value = 0.5;

  // `destination` est l'entree de Phaser : son muet et son volume general
  // s'appliquent donc aussi a tout ce qui passe ici.
  pistes.musique.connect(son.destination);
  pistes.ambiance.connect(etouffoir).connect(son.destination);
  pistes.effets.connect(son.destination);

  branchements = { contexte, pistes, etouffoir };
  return branchements;
}

/**
 * Joue le son `cle` (charge par `load.audio`) dans une piste.
 *
 * Rend `null` sans rien jouer quand le son est encore verrouille par le
 * navigateur : un son lance avant le premier clic partirait en retard, au
 * deverrouillage, decale de tout ce qu'il accompagne.
 */
export function jouer(
  scene: Phaser.Scene,
  cle: string,
  piste: Piste,
  options: OptionsDeVoix = {},
): Voix | null {
  const b = brancher(scene);
  if (!b || scene.sound.locked) return null;
  const tampon = scene.cache.audio.get(cle) as AudioBuffer | undefined;
  if (!(tampon instanceof AudioBuffer)) return null;

  const { contexte } = b;
  const source = contexte.createBufferSource();
  source.buffer = tampon;
  source.loop = Boolean(options.boucle);
  if (typeof options.boucle === "object") {
    source.loopStart = options.boucle.depuis;
    source.loopEnd = Math.min(options.boucle.jusqua, tampon.duration);
  }
  const gain = contexte.createGain();
  const volume = options.volume ?? 1;
  const courbe = options.courbe ?? "lineaire";
  const maintenant = contexte.currentTime;
  if (options.fondu && options.fondu > 0) {
    gain.gain.setValueAtTime(0, maintenant);
    fondre(gain.gain, courbe, 0, volume, maintenant, options.fondu);
  } else {
    gain.gain.value = volume;
  }
  if (options.vitesse && options.vitesse > 0) source.playbackRate.value = options.vitesse;
  // Le panoramique : un noeud de plus seulement quand on le demande, et
  // seulement si le navigateur le sait (Safari l'a depuis 2020).
  const panoramique =
    options.pan && typeof contexte.createStereoPanner === "function" ? contexte.createStereoPanner() : null;
  if (panoramique) {
    panoramique.pan.value = Math.max(-1, Math.min(1, options.pan ?? 0));
    source.connect(gain).connect(panoramique).connect(b.pistes[piste]);
  } else {
    source.connect(gain).connect(b.pistes[piste]);
  }
  source.addEventListener("ended", () => {
    source.disconnect();
    gain.disconnect();
    panoramique?.disconnect();
  });
  source.start(maintenant, Math.max(0, Math.min(options.depuis ?? 0, tampon.duration)));

  let arretee = false;
  return {
    arreter(fondu = 0.05) {
      if (arretee) return;
      arretee = true;
      const t = contexte.currentTime;
      // On part du niveau de l'instant, meme au milieu d'une montee : deux
      // musiques qui se croisent vite ne doivent pas sauter.
      const depuis = gain.gain.value;
      tenir(gain.gain, t);
      fondre(gain.gain, courbe, depuis, 0, t, fondu);
      source.stop(t + fondu + 0.02);
    },
  };
}

/** Les points d'une courbe de fondu : assez pour une sinusoide lisse sur quelques secondes. */
const POINTS_DE_COURBE = 64;

/**
 * Coupe ce qui etait programme sur ce parametre et le tient a sa valeur de
 * l'instant. `cancelAndHoldAtTime` le fait proprement ; la ou il manque, on
 * annule puis on repose la valeur lue, ce qui revient au meme a un bloc pres.
 */
function tenir(param: AudioParam, t: number): void {
  if (typeof param.cancelAndHoldAtTime === "function") {
    param.cancelAndHoldAtTime(t);
  } else {
    const valeur = param.value;
    param.cancelScheduledValues(t);
    param.setValueAtTime(valeur, t);
  }
}

/** Mene `param` de `de` a `a` en `duree` secondes a partir de `t`, selon la courbe. */
function fondre(param: AudioParam, courbe: Courbe, de: number, a: number, t: number, duree: number): void {
  if (courbe === "lineaire") {
    param.linearRampToValueAtTime(a, t + duree);
    return;
  }
  const points = new Float32Array(POINTS_DE_COURBE);
  for (let i = 0; i < POINTS_DE_COURBE; i++) {
    const u = (i / (POINTS_DE_COURBE - 1)) * (Math.PI / 2);
    points[i] = a >= de ? de + (a - de) * Math.sin(u) : a + (de - a) * Math.cos(u);
  }
  param.setValueCurveAtTime(points, t, Math.max(duree, 0.01));
}

/** Le petit son d'une entree survolee ou cliquee. */
export function bruitDInterface(scene: Phaser.Scene, quoi: keyof typeof SONS_INTERFACE): void {
  jouer(scene, SONS_INTERFACE[quoi].cle, "effets", { volume: quoi === "survol" ? 0.5 : 0.8 });
}

/**
 * L'ambiance devient sourde (ou redevient claire) en `duree` secondes, a
 * partir de `dans` secondes.
 *
 * La courbe est exponentielle, comme l'oreille : une descente lineaire de
 * 20 000 a 700 Hz passerait les trois quarts du temps dans des aigus qu'on
 * n'entend deja plus, et tout se jouerait a la fin.
 */
export function etouffer(scene: Phaser.Scene, sourd: boolean, duree: number, dans = 0): void {
  const b = brancher(scene);
  if (!b) return;
  const frequence = b.etouffoir.frequency;
  const t = b.contexte.currentTime + dans;
  frequence.cancelScheduledValues(t);
  frequence.setValueAtTime(frequence.value, t);
  frequence.exponentialRampToValueAtTime(sourd ? SOURD : OUVERT, t + Math.max(duree, 0.01));
}

// ---------------------------------------------------------------- les volumes

/** Le reglage du joueur pour une piste, de 0 a 1. */
export function volumeDeLaPiste(piste: Piste): number {
  return reglages[piste];
}

/**
 * Regle une piste (0 a 1), tout de suite — ce qui joue deja monte ou baisse
 * pendant qu'on tire le curseur — et s'en souvient.
 */
export function reglerLaPiste(scene: Phaser.Scene, piste: Piste, valeur: number): void {
  reglages[piste] = Math.max(0, Math.min(1, valeur));
  const b = brancher(scene);
  if (b) {
    const gain = b.pistes[piste].gain;
    // Une petite rampe : un saut de gain brut claque dans les haut-parleurs.
    gain.setTargetAtTime(VOLUME_DES_PISTES[piste] * reglages[piste], b.contexte.currentTime, 0.03);
  }
  try {
    rangement()?.setItem(CLE_VOLUMES, JSON.stringify(reglages));
  } catch {
    // Pas de stockage : le reglage vaut pour cette visite seulement.
  }
}

/** Reprend les volumes de la derniere visite. A appeler une fois, au demarrage. */
function reprendreLesVolumes(): void {
  try {
    const lu = JSON.parse(rangement()?.getItem(CLE_VOLUMES) ?? "{}") as Partial<Record<Piste, unknown>>;
    for (const p of PISTES) {
      const v = lu[p];
      if (typeof v === "number" && Number.isFinite(v)) reglages[p] = Math.max(0, Math.min(1, v));
    }
  } catch {
    // Un reglage illisible : on garde 100 % partout.
  }
}

// ------------------------------------------------------------------- le muet

/**
 * Le muet, tenu ici plutot que relu chez Phaser.
 *
 * ⚠️ `sound.mute` de Phaser se **relit** dans le gain du moteur audio, qui ne
 * prend la nouvelle valeur qu'au bloc de son suivant : relu juste apres l'avoir
 * change, il rend encore l'ancienne. Le haut-parleur se dessinait ainsi avec un
 * etat de retard (vu sur capture, le 19 septembre 2026). Seul ce module change
 * le muet ; il sait donc toujours ce qu'il vaut.
 */
let muet = false;

export function estMuet(): boolean {
  return muet;
}

function rangement(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/** Reprend le muet et les volumes de la derniere visite. A appeler une fois, au demarrage. */
export function reprendreLesReglages(jeu: Phaser.Game): void {
  reprendreLesVolumes();
  try {
    muet = rangement()?.getItem(CLE_MUET) === "1";
  } catch {
    // Un stockage refuse : le son reste ouvert, c'est tout.
    muet = false;
  }
  jeu.sound.mute = muet;
}

/** Coupe ou rend le son, et s'en souvient. Rend le nouvel etat (vrai = muet). */
export function basculerLeMuet(scene: Phaser.Scene): boolean {
  muet = !muet;
  scene.sound.mute = muet;
  try {
    rangement()?.setItem(CLE_MUET, muet ? "1" : "0");
  } catch {
    // Pas de stockage : le muet vaut pour cette visite seulement.
  }
  return muet;
}
