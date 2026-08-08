/**
 * L'inventaire des PNG livres avec le jeu.
 *
 * Il n'y a **aucune liste a tenir a jour** : Vite ramasse tout ce qui traine
 * dans `src/assets/`, et le nom du fichier est la cle de texture. Deposer
 * `mur.png` suffit donc a remplacer le placeholder `mur`, et le retirer suffit
 * a revenir au dessin au code.
 *
 * Les PNG sont produits hors-ligne par `scripts/generer-assets.ts` puis
 * commites. Le jeu ne parle jamais a une API a l'execution.
 */

const FICHIERS = import.meta.glob("../assets/*.png", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

export interface AssetLivre {
  /** La cle de texture Phaser, c'est-a-dire le nom du fichier sans `.png`. */
  cle: string;
  /** L'URL servie par Vite, avec son empreinte de contenu en production. */
  url: string;
}

export const ASSETS: AssetLivre[] = Object.entries(FICHIERS)
  .map(([chemin, url]) => ({
    cle: chemin.split("/").pop()!.replace(/\.png$/, ""),
    url,
  }))
  .sort((a, b) => a.cle.localeCompare(b.cle));

/**
 * Les planches d'animation, produites par `scripts/animer-sprites.ts`.
 *
 * Elles vivent dans un sous-dossier parce qu'une planche n'est **pas** une
 * image : la charger avec `load.image` en ferait une texture de six sprites
 * cote a cote. Le glob ci-dessus, avec son etoile simple, ne descend pas dans
 * `anims/` — les deux inventaires ne peuvent donc pas se marcher dessus.
 *
 * Le manifeste est genere avec les planches : il porte ce que le PNG seul ne
 * dit pas — la taille d'une frame, leur nombre, la cadence et la boucle. Rien
 * n'est a tenir a jour a la main.
 */
const PLANCHES = import.meta.glob("../assets/anims/*.png", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

import manifeste from "../assets/anims/manifeste.json";

/** Une plage de frames dans une planche : une animation. */
export interface SequenceAnimee {
  /** Cle de l'animation : `ennemi-marche` */
  cle: string;
  debut: number;
  fin: number;
  cadence: number;
  boucle: boolean;
}

/** Une entree du manifeste, telle que le script l'ecrit. */
interface EntreeManifeste {
  /** Cle de la texture : `ennemi-anim` */
  cle: string;
  fichier: string;
  /** Cote d'une frame, en pixels : elles sont carrees */
  taille: number;
  /** Nombre total de frames de la planche */
  frames: number;
  animations: SequenceAnimee[];
}

export interface PlancheAnimee extends EntreeManifeste {
  url: string;
}

/**
 * Une planche **par personnage**, contenant toutes ses animations.
 *
 * Le regroupement n'est pas cosmetique : le moteur ne groupe en un seul lot de
 * rendu que les sprites qui partagent leur texture. Avec une planche par
 * animation, deux cent quarante monstres dont les uns marchent et les autres se
 * cabrent cassaient le lot a chaque changement — mesure faite, un quart du
 * framerate y passait.
 */
export const ANIMATIONS: PlancheAnimee[] = (manifeste as EntreeManifeste[])
  .map((entree) => {
    const url = PLANCHES[`../assets/anims/${entree.fichier}`];
    return url ? { ...entree, url } : null;
  })
  .filter((entree): entree is PlancheAnimee => entree !== null);

/**
 * Les familles de sprites qui ont des animations.
 *
 * Un sprite sans PNG n'a pas de planche : le jeu doit continuer de tourner avec
 * son dessin de secours (`art.ts`), simplement sans bouger. C'est le meme
 * principe de migration progressive que pour les textures.
 */
export const FAMILLES_ANIMEES = new Set(
  ANIMATIONS.map((a) => a.cle.replace(/-anim$/, "")),
);
