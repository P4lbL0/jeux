import type Phaser from "phaser";
import { Toile } from "./pinceau";

/**
 * Le four : il cuit toutes les frames d'une famille au demarrage, une fois
 * (DESIGN.md §4.30 et **§4.17 regle 3**).
 *
 * ⚠️ **C'est la contrainte qui decide de toute l'architecture du bloc.** On
 * dessine en code, mais on ne dessine **jamais par image** : redessiner un
 * villageois soixante fois par seconde ferait tomber le jeu en trente secondes,
 * exactement comme les objets Texte fabriques en plein combat que la regle 3
 * interdit depuis. Le dessin en code n'est pas un mode de rendu, c'est une
 * facon de **produire des textures** — apres quoi le moteur n'affiche qu'un
 * sprite ordinaire.
 *
 * **Une planche par famille, jamais une par animation.** Le moteur ne groupe en
 * un seul lot de rendu que les sprites qui partagent leur texture : avec une
 * planche par animation, deux cent quarante monstres dont les uns marchent et
 * les autres se cabrent cassaient le lot a chaque changement, et un quart du
 * framerate y passait. La mesure est celle de `assets.ts`, elle ne change pas.
 */

/** Un geste : une plage de frames, sa cadence, et le son qu'il jouera un jour. */
export interface Geste {
  /** `marche`, `travail`, `toux`... L'animation s'appellera `famille-cle`. */
  cle: string;
  frames: number;
  cadence: number;
  boucle: boolean;
  /**
   * Le son nomme du §4.30 — `pioche`, `hache`, `toux`, `semis`, `chute-arbre`.
   *
   * **Personne ne l'ecoute encore, et c'est voulu** : le §7 garde le son hors
   * perimetre. Il est porte comme une **donnee** des maintenant pour que le jour
   * ou le bloc 10 branche les volumes, il n'y ait que des fichiers a poser.
   * Cout aujourd'hui : zero.
   */
  evenement?: string;
  /** La frame ou le son tombe — l'impact, pas le debut du geste. */
  frameCle?: number;
}

/** Ce qu'il faut savoir pour cuire une famille. */
export interface Modele {
  /** `villageois`, `hero-guerrier`, `fonceur`... */
  famille: string;
  /** Cote d'une frame, en pixels. Carre, et aligne sur la grille de 32. */
  taille: number;
  gestes: readonly Geste[];
  /**
   * Peint une frame.
   *
   * @param avancement de 0 a 1 dans le geste. **C'est le seul parametre du
   *        temps** : une animation est une fonction de l'avancement, pas une
   *        suite d'images choisies a la main.
   */
  dessiner(toile: Toile, geste: string, avancement: number): void;
}

/** Ou un geste commence et finit dans la planche de sa famille. */
export interface Plage {
  cle: string;
  debut: number;
  fin: number;
}

export interface Cuisson {
  famille: string;
  /** Nombre total de frames cuites. */
  frames: number;
  /**
   * Ou chaque geste tombe dans la planche.
   *
   * ⚠️ **Indispensable des qu'on affiche une frame a la main.** Une planche
   * porte tous les gestes bout a bout : demander « la frame 2 » sans savoir ou
   * commence le geste donne la frame 2 du **premier** geste, quel que soit celui
   * qu'on croyait regarder. La planche de controle du 12 aout affichait ainsi
   * quatre fois la meme chose sur ses quatre lignes.
   */
  plages: Plage[];
}

/**
 * Ce que chaque animation jouera comme son, et a quelle frame.
 *
 * Une seule table, remplie a la cuisson, que personne ne lit encore. Elle existe
 * pour que le branchement du bloc 10 soit une lecture et non une chasse.
 */
export const EVENEMENTS = new Map<string, { evenement: string; frame: number }>();

/**
 * Ou en est un geste a sa n-ieme frame, de 0 a 1.
 *
 * ⚠️ **Un geste qui boucle n'atteint jamais 1** : sa derniere frame repeterait
 * la premiere et le pas paraitrait bloque une image sur six. Un geste qui ne
 * boucle pas, lui, doit finir son mouvement, donc il va jusqu'a 1.
 *
 * C'est exporte parce que le calcul doit etre **le meme partout** : un test qui
 * verifierait des frames que la cuisson ne produit pas ne verifierait rien. La
 * pioche qui ne frappait jamais est venue de la, exactement.
 */
export function avancementDe(geste: Geste, index: number): number {
  const pas = geste.boucle ? geste.frames : Math.max(1, geste.frames - 1);
  return index / pas;
}

/**
 * Cuit une famille : une texture, ses frames, ses animations.
 *
 * Idempotent — les textures et les animations de Phaser sont **globales au
 * jeu**, donc rappeler la fonction depuis une autre scene ne recuit rien. C'est
 * le meme garde que `art.ts` porte depuis le debut, et le piege qu'il evite est
 * connu : `MenuScene` affichait le damier de texture manquante parce qu'elle ne
 * demandait pas ses textures.
 */
export function cuire(scene: Phaser.Scene, modele: Modele): Cuisson {
  const cle = `${modele.famille}-planche`;
  const total = modele.gestes.reduce((somme, geste) => somme + geste.frames, 0);

  const plages: Plage[] = [];
  let curseur = 0;
  for (const geste of modele.gestes) {
    plages.push({ cle: geste.cle, debut: curseur, fin: curseur + geste.frames - 1 });
    curseur += geste.frames;
  }
  const bilan: Cuisson = { famille: modele.famille, frames: total, plages };

  if (scene.textures.exists(cle)) return bilan;

  const texture = scene.textures.createCanvas(cle, total * modele.taille, modele.taille);
  if (!texture) throw new Error(`Cuisson impossible : ${cle}`);
  const contexte = texture.getContext();

  // Une seule toile pour toute la planche : elle est effacee entre deux frames.
  // En fabriquer une par frame allouerait quelques centaines de tampons au
  // demarrage pour rien.
  const toile = new Toile(modele.taille, modele.taille);
  let index = 0;

  for (const geste of modele.gestes) {
    const debut = index;

    for (let i = 0; i < geste.frames; i += 1) {
      toile.effacer();
      modele.dessiner(toile, geste.cle, avancementDe(geste, i));
      toile.contour();
      contexte.putImageData(toile.versImageData(), index * modele.taille, 0);

      texture.add(index, 0, index * modele.taille, 0, modele.taille, modele.taille);
      index += 1;
    }

    const cleAnim = `${modele.famille}-${geste.cle}`;
    if (!scene.anims.exists(cleAnim)) {
      scene.anims.create({
        key: cleAnim,
        frames: scene.anims.generateFrameNumbers(cle, { start: debut, end: index - 1 }),
        frameRate: geste.cadence,
        repeat: geste.boucle ? -1 : 0,
      });
    }
    if (geste.evenement) {
      EVENEMENTS.set(cleAnim, { evenement: geste.evenement, frame: geste.frameCle ?? 0 });
    }
  }

  texture.refresh();
  return bilan;
}
