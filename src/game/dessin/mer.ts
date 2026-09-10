import type Phaser from "phaser";
import { Toile } from "./pinceau";
import { bruit } from "./bruit";
import { EAU, melanger } from "./palette";
import { C } from "../ui/couleurs";

/**
 * La mer qui bouge (DESIGN.md §4.30).
 *
 * ⚠️ **La carte est cuite dans une seule texture de deux millions de pixels**
 * (`art.ts`, `creerCarte`) : trente mille tuiles en trente mille objets, c'est le
 * jeu par terre (§4.17 regle 1). On ne peut donc **rien** animer dedans. Et on ne
 * veut pas : la mer et le sable sont les seules choses de l'ancien jeu qui sont
 * gardees telles quelles, parce qu'elles sont belles.
 *
 * Ce fichier ajoute donc une **couche par-dessus**, et rien d'autre :
 *
 * 1. **La houle** — un carreau repetable de cretes tres pales, pose en un seul
 *    `TileSprite` sur le large et **fait glisser** par sa position de tuile. Un
 *    reglage de propriete par image, pas un redessin : c'est la seule facon
 *    d'animer une surface entiere sans rien couter (§4.17 regle 3).
 * 2. **L'ecume** — une planche de frames cuite au demarrage, jouee par une
 *    poignee de sprites poses le long du rivage. Le littoral serpente, donc un
 *    sprite par bande horizontale : quarante-sept objets pour toute la cote.
 */

/** Cote du carreau de houle. Il se repete, donc il doit etre carre. */
const COTE_HOULE = 64;
export const CLE_HOULE = "mer-houle";

/** Une vague d'ecume : large d'un carreau et demi, haute d'une bande. */
export const ECUME = { largeur: 48, hauteur: 32, frames: 8 };
export const CLE_ECUME = "mer-ecume";
export const ANIM_ECUME = "mer-ecume-va-et-vient";

/**
 * Cuit la houle et l'ecume, une fois au demarrage.
 *
 * @returns le nombre de textures produites.
 */
export function cuireLaMer(scene: Phaser.Scene): number {
  let compte = 0;
  if (!scene.textures.exists(CLE_HOULE)) {
    const toile = new Toile(COTE_HOULE, COTE_HOULE);
    peindreHoule(toile);
    if (poser(scene, CLE_HOULE, toile)) compte += 1;
  }

  if (!scene.textures.exists(CLE_ECUME)) {
    const planche = new Toile(ECUME.largeur * ECUME.frames, ECUME.hauteur);
    const frame = new Toile(ECUME.largeur, ECUME.hauteur);
    const texture = scene.textures.createCanvas(
      CLE_ECUME,
      planche.largeur,
      planche.hauteur,
    );
    if (texture) {
      const ctx = texture.getContext();
      for (let i = 0; i < ECUME.frames; i += 1) {
        frame.effacer();
        peindreEcume(frame, i / ECUME.frames);
        ctx.putImageData(frame.versImageData(), i * ECUME.largeur, 0);
        texture.add(i, 0, i * ECUME.largeur, 0, ECUME.largeur, ECUME.hauteur);
      }
      texture.refresh();
      compte += 1;

      if (!scene.anims.exists(ANIM_ECUME)) {
        scene.anims.create({
          key: ANIM_ECUME,
          frames: scene.anims.generateFrameNumbers(CLE_ECUME, {
            start: 0,
            end: ECUME.frames - 1,
          }),
          // Lente : une vague qui bat a dix images par seconde ressemble a un
          // clignotement, pas a de l'eau.
          frameRate: 5,
          repeat: -1,
        });
      }
    }
  }
  return compte;
}

/**
 * La couche animee, posee **par-dessus** la carte cuite.
 *
 * Elle ne se recree jamais : deux objets par bande de cote, poses une fois, et
 * un seul reglage de propriete par image (§4.17 regle 3).
 */
export interface MerAnimee {
  /** A appeler une fois par image : c'est la houle qui glisse. */
  deriver(delta: number): void;
}

/** Sous tout le reste, mais au-dessus de la carte. */
const PROFONDEUR_HOULE = -995;
const PROFONDEUR_ECUME = -990;

/**
 * De combien la houle glisse, en pixels par seconde.
 *
 * ⚠️ **Lentement, et de biais.** Une houle qui file droit se lit comme un
 * defilement de fond de jeu de tir ; ce qui fait « mer », c'est un mouvement
 * qu'on remarque a peine et qui ne va pas dans l'axe de l'ecran.
 */
const DERIVE = { x: 5, y: -8 };

/**
 * Pose la houle et l'ecume sur la carte (§4.30).
 *
 * @param bordDuLarge l'abscisse au-dela de laquelle il peut y avoir du sable.
 *        La houle s'arrete la : elle ne doit **jamais** deborder sur la plage,
 *        et le littoral serpente — seule sa position la plus a l'ouest est sure.
 * @param ligneDEau ou passe le rivage a une hauteur donnee.
 */
export function poserLaMer(
  scene: Phaser.Scene,
  monde: { largeur: number; hauteur: number },
  bordDuLarge: number,
  ligneDEau: (y: number) => number,
): MerAnimee {
  cuireLaMer(scene);

  const houle = scene.add
    .tileSprite(0, 0, bordDuLarge, monde.hauteur, CLE_HOULE)
    .setOrigin(0)
    .setDepth(PROFONDEUR_HOULE);

  // Une vague par bande : le littoral serpente, une seule bande d'ecume sur
  // toute la hauteur serait une barre droite posee sur une cote qui ondule.
  for (let bande = 0; bande * ECUME.hauteur < monde.hauteur; bande += 1) {
    const y = bande * ECUME.hauteur + ECUME.hauteur / 2;
    const sprite = scene.add
      .sprite(ligneDEau(y) - 2, y, CLE_ECUME)
      .setDepth(PROFONDEUR_ECUME)
      .play(ANIM_ECUME);
    // ⚠️ **Chaque bande part a un autre moment de sa vague.** En phase, les
    // quarante-sept vagues battent ensemble et la cote entiere clignote — c'est
    // le meme defaut que le damier du sol, et il se voit encore plus.
    sprite.anims.setProgress(bruit(bande, 5, 3));
  }

  return {
    deriver(delta: number): void {
      houle.tilePositionX += (DERIVE.x * delta) / 1000;
      houle.tilePositionY += (DERIVE.y * delta) / 1000;
    },
  };
}

function poser(scene: Phaser.Scene, cle: string, toile: Toile): boolean {
  const texture = scene.textures.createCanvas(cle, toile.largeur, toile.hauteur);
  if (!texture) return false;
  texture.getContext().putImageData(toile.versImageData(), 0, 0);
  texture.refresh();
  return true;
}

/**
 * Le carreau de houle : des cretes pales, rares, et **repetables**.
 *
 * ⚠️ **Le motif doit boucler exactement sur ses bords**, sinon la couture se voit
 * a chaque carreau et on retombe sur le damier que le sol vient de perdre. Les
 * cretes sont donc tracees modulo le cote.
 *
 * Il est **tres pale et tres clairseme** : il se pose sur la mer d'origine, qui
 * est gardee pour sa couleur. Une houle marquee la recouvrirait.
 */
function peindreHoule(toile: Toile): void {
  const crete = melanger(EAU.clair, C.cielSale, 0.55);

  for (let i = 0; i < 14; i += 1) {
    const y = Math.floor(bruit(i, 3, 7) * COTE_HOULE);
    const x = Math.floor(bruit(3, i, 11) * COTE_HOULE);
    const longueur = 5 + Math.floor(bruit(i, i, 19) * 9);

    for (let j = 0; j < longueur; j += 1) {
      // Une crete n'est pas droite : elle ondule d'un pixel.
      const dy = j > longueur * 0.3 && j < longueur * 0.7 ? -1 : 0;
      toile.point((x + j) % COTE_HOULE, (y + dy + COTE_HOULE) % COTE_HOULE, crete, 0.5);
    }
  }
}

/**
 * L'ecume du rivage, a un instant de son va-et-vient.
 *
 * ⚠️ **Elle avance et se retire, elle ne clignote pas.** Une bande d'ecume qui
 * apparait et disparait sur place se lit comme un defaut d'affichage ; ce qui
 * fait lire « vague », c'est le **deplacement** de la ligne de mousse, et le
 * fait qu'elle laisse derriere elle une trainee plus pale en se retirant.
 *
 * @param phase de 0 a 1 dans le cycle de la vague.
 */
function peindreEcume(toile: Toile, phase: number): void {
  const { largeur, hauteur } = ECUME;
  const mousse = melanger(EAU.clair, C.os, 0.72);
  const trainee = melanger(EAU.clair, C.os, 0.35);

  // La vague monte vite et se retire lentement : c'est ce rythme inegal qui la
  // rend vivante. Une sinusoide pure fait un balancier de metronome.
  const montee = phase < 0.35 ? phase / 0.35 : 1 - (phase - 0.35) / 0.65;
  const avance = montee * (largeur * 0.55);

  for (let y = 0; y < hauteur; y += 1) {
    // Le front n'est pas une droite : il ondule sur la hauteur de la bande.
    const frange = Math.sin(y * 0.4 + phase * 6.28) * 2.5;
    const front = avance + frange;

    // La trainee, derriere le front : ce qui reste quand l'eau se retire.
    for (let x = 0; x < front - 2; x += 1) {
      if (bruit(x, y, Math.floor(phase * 8) + 1) > 0.82) {
        toile.point(x, y, trainee, 0.35);
      }
    }

    // Le front lui-meme, epais de deux pixels, et troue par endroits — une
    // ligne pleine ferait un trait de crayon.
    for (let e = 0; e < 2; e += 1) {
      const x = Math.round(front) - e;
      if (x < 0 || x >= largeur) continue;
      if (bruit(x, y, 5) < 0.18) continue;
      toile.point(x, y, mousse, e === 0 ? 0.85 : 0.5);
    }
  }
}
