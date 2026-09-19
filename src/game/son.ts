import Phaser from "phaser";
import survolOgg from "../assets/son/ui-survol.ogg?url";
import survolMp3 from "../assets/son/ui-survol.mp3?url";
import clicOgg from "../assets/son/ui-clic.ogg?url";
import clicMp3 from "../assets/son/ui-clic.mp3?url";

/**
 * Le son du jeu : trois pistes et un bouton muet (DESIGN.md §4.10).
 *
 * Il commence le 19 septembre 2026 par l'ecran-titre ; le reste du jeu est
 * encore muet, mais passera par ici le jour ou il parlera (musique, cris, coups
 * de hache — les animations emettent deja leurs evenements, §4.30).
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

/**
 * Le volume de chaque piste, en plus du volume de chaque voix. Les fichiers
 * sont deja equilibres entre eux (`scripts/son/intro.ts`) ; la musique est un
 * cran plus bas pour laisser passer le feu et le glas. Le menu PARAMETRES
 * (§4.10) viendra regler ces trois chiffres.
 */
const VOLUME_DES_PISTES: Record<Piste, number> = { musique: 0.7, ambiance: 1, effets: 1 };

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

export interface OptionsDeVoix {
  /** Le volume de cette voix, de 0 a 1 (defaut 1). */
  volume?: number;
  /** Rejoue sans fin, sans couture : les boucles sont coupees pour ca. */
  boucle?: boolean;
  /** Monte depuis le silence en `fondu` secondes plutot que de partir d'un coup. */
  fondu?: number;
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
    gain.gain.value = VOLUME_DES_PISTES[p];
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
  source.loop = options.boucle ?? false;
  const gain = contexte.createGain();
  const volume = options.volume ?? 1;
  const maintenant = contexte.currentTime;
  if (options.fondu && options.fondu > 0) {
    gain.gain.setValueAtTime(0, maintenant);
    gain.gain.linearRampToValueAtTime(volume, maintenant + options.fondu);
  } else {
    gain.gain.value = volume;
  }
  source.connect(gain).connect(b.pistes[piste]);
  source.addEventListener("ended", () => {
    source.disconnect();
    gain.disconnect();
  });
  source.start(maintenant);

  let arretee = false;
  return {
    arreter(fondu = 0.05) {
      if (arretee) return;
      arretee = true;
      const t = contexte.currentTime;
      gain.gain.cancelScheduledValues(t);
      gain.gain.setValueAtTime(gain.gain.value, t);
      gain.gain.linearRampToValueAtTime(0, t + fondu);
      source.stop(t + fondu + 0.02);
    },
  };
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

/** Reprend le muet de la derniere visite. A appeler une fois, au demarrage. */
export function reprendreLeMuet(jeu: Phaser.Game): void {
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
