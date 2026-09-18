import approcheWebm from "../assets/intro/approche.webm?url";
import approcheMp4 from "../assets/intro/approche.mp4?url";
import boucleWebm from "../assets/intro/boucle.webm?url";
import boucleMp4 from "../assets/intro/boucle.mp4?url";

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
