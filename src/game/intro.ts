import approcheWebm from "../assets/intro/approche.webm?url";
import approcheMp4 from "../assets/intro/approche.mp4?url";
import boucleWebm from "../assets/intro/boucle.webm?url";
import boucleMp4 from "../assets/intro/boucle.mp4?url";
import sonApprocheOgg from "../assets/son/intro-approche.ogg?url";
import sonApprocheMp3 from "../assets/son/intro-approche.mp3?url";
import sonTitreOgg from "../assets/son/titre-glas.ogg?url";
import sonTitreMp3 from "../assets/son/titre-glas.mp3?url";
import sonFeuOgg from "../assets/son/titre-feu.ogg?url";
import sonFeuMp3 from "../assets/son/titre-feu.mp3?url";
import musiqueOgg from "../assets/son/titre-musique.ogg?url";
import musiqueMp3 from "../assets/son/titre-musique.mp3?url";

/**
 * La cinematique d'ouverture, rendue par Blender (`scripts/blender/intro.py`,
 * `npm run intro`) — DESIGN.md §4.10, section « L'ecran-titre ».
 *
 * Deux videos, sans son, chacune en deux formats : le WebM (VP9) d'abord, le
 * MP4 (H.264) pour les navigateurs qui ne lisent pas le premier. Phaser choisit
 * la premiere URL que le navigateur sait lire.
 *
 * ⚠️ **La boucle commence exactement la ou l'approche s'arrete** : meme camera,
 * meme phase des flammes (voir `intro.py`). On peut donc enchainer les deux sans
 * fondu, et laisser la seconde tourner derriere le menu sans qu'on voie jamais
 * le raccord.
 */
export const INTRO = {
  /** Le travelling vers l'eglise, celui du premier jet : 9 secondes, joue une fois. */
  approche: { cle: "intro-approche", urls: [approcheWebm, approcheMp4], duree: 9 },
  /** Ce qui continue de bruler derriere le menu : 4 secondes, en boucle. */
  boucle: { cle: "intro-boucle", urls: [boucleWebm, boucleMp4], duree: 4 },
  /** La taille de rendu : la video couvre la fenetre sans se deformer. */
  largeur: 1280,
  hauteur: 720,
} as const;

/**
 * La bande-son de l'ecran-titre (19 septembre 2026), fabriquee par
 * `scripts/son/intro.ts` (`npm run son`) a partir de sons libres de droits —
 * la liste et leurs auteurs sont dans `src/assets/son/CREDITS.md`.
 *
 * Chaque son existe en OGG (Vorbis) et en MP3 : Phaser prend le premier que le
 * navigateur sait lire, comme pour les videos.
 *
 * ⚠️ **Le son n'est pas dans la video, il tourne a cote** : la boucle du menu ne
 * dure que 4 secondes, et un feu qui recommence toutes les 4 secondes
 * s'entendrait tout de suite. Le feu du menu est une boucle a lui, bien plus
 * longue, qui ne se cale sur rien.
 */
export const SON_INTRO = {
  /**
   * Les 9 secondes du film, calees a l'image : le vent, le feu qui grossit a
   * mesure qu'on remonte le chemin, trois cris au loin, deux coups de glas. Elle
   * deborde un peu apres le film : le dernier coup de cloche s'eteint sous le
   * titre.
   */
  approche: { cle: "son-intro-approche", urls: [sonApprocheOgg, sonApprocheMp3] },
  /** Le troisieme coup de glas, et un coup sourd dessous : quand le titre se pose. */
  titre: { cle: "son-titre-glas", urls: [sonTitreOgg, sonTitreMp3] },
  /** Le feu et le vent derriere le menu, en boucle sans couture. Charge pendant le film. */
  feu: { cle: "son-titre-feu", urls: [sonFeuOgg, sonFeuMp3] },
  /** La musique du titre, en boucle. Chargee pendant le film. */
  musique: { cle: "son-titre-musique", urls: [musiqueOgg, musiqueMp3] },
} as const;
