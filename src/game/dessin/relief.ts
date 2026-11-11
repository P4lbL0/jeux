import { distanceALEau, profondeurDeRoche } from "../../core/carte";
import { bruitLisse } from "./bruit";

/**
 * Le relief du sol (bloc 7z, etage 7, 18 septembre 2026 ; refait lisse le 11
 * novembre 2026, chantier 6.45).
 *
 * **Pourquoi.** « On dirait que c'est tout plat » : la carte etait un aplat par
 * matiere avec des taches, et a cote des batiments low-poly rendus par Blender
 * elle faisait decor peint. Le sol a donc une **altitude** — des collines douces
 * dans l'herbe, presque rien sur la plage, un eboulis qui monte, puis la
 * montagne — eclairee par le meme soleil que les sprites Blender (de l'ouest,
 * haut). Un versant tourne vers le soleil s'eclaircit, un versant a contre-jour
 * s'assombrit : on voit la forme sans qu'aucun pixel ne bouge.
 *
 * ⚠️ **Plus de facettes** (Angelos, 9 novembre 2026 : « on dirait juste qu'on
 * joue sur un tapis de jeu »). Le premier relief decoupait le sol en triangles
 * de 26 px, un aplat chacun : de pres, on lisait le decoupage et non les
 * collines. Ici la clarte est **continue** — relevee sur un treillis, lue entre
 * ses points — et c'est `carte.ts` qui la range en tons, avec une trame qui
 * casse le bord entre deux tons. Tranche sur maquettes le 11 novembre (§4.30,
 * la piste A, « le relief doux »).
 *
 * ⚠️ **Ce n'est que de l'ombrage.** Le sol reste plat pour le jeu : personne ne
 * monte ni ne descend, les collisions et `core/carte.ts` ne changent pas. Le
 * relief ne sait rien du terrain qu'il ombre, il ne donne qu'une clarte ; la
 * matiere, elle, reste choisie par `classer`.
 *
 * **Pure** : ni Phaser, ni hasard — le meme monde a chaque partie.
 */

/**
 * Le pas du treillis, en pixels du monde.
 *
 * Les collines font 90 a 230 px de large : un point tous les 20 px les suit
 * sans peine, et la zone x3 entiere tient en 23 000 altitudes — une soixantaine
 * de millisemes, une fois par monde.
 */
export const PAS_DU_RELIEF = 20;

/**
 * Vers le soleil, dans le repere de la carte (x vers l'est, y vers le **sud**,
 * z vers le haut) : de l'ouest, un peu du sud, haut — celui de `rendre.py`.
 */
const SOLEIL = [-0.62, 0.38, 1.6] as const;

/**
 * De combien on exagere les pentes avant de les eclairer.
 *
 * Mesure sur maquette : a 1, les collines se devinent a peine ; a 2,9 (la
 * piste C, « le relief marque », refusee) elles creusent des zones sombres ou
 * un monstre se voit moins. 1,6 les fait lire sans rien cacher.
 */
const EXAGERATION = 1.6;

/**
 * Sur combien de pixels la terre monte depuis un rivage.
 *
 * ⚠️ **120, et pas plus que la marge des lacs.** `distanceATache` (le noyau) ne
 * calcule la distance a un lac que dans une boite de 130 px autour de lui, et
 * rend « tres loin » au-dela. Tant que cette rampe en demandait 240, l'altitude
 * sautait d'une vingtaine de pixels le long du bord de la boite : un trait
 * droit dans la prairie, que les facettes montraient comme une rangee de
 * triangles sombres et qu'un relief lisse aurait montre net (trouve sur
 * maquette le 11 novembre 2026).
 */
const RAMPE_DU_RIVAGE = 120;

/**
 * L'altitude en un point, en pixels.
 *
 * - **la terre monte depuis le rivage** : la plage reste basse, l'interieur
 *   forme un plateau ;
 * - **des collines** de deux tailles, qui ne naissent qu'a l'interieur des
 *   terres (une dune fait trois pixels, une colline trente) ;
 * - **la montagne** : a partir de son pied, le sol monte vers le sud, herisse de
 *   cretes et d'eclats.
 */
export function altitude(x: number, y: number): number {
  // La distance a l'eau la plus proche, quel que soit le monde : la mer sur
  // n'importe quel bord, un lac au milieu — la terre monte depuis chaque rive.
  const rivage = distanceALEau(x, y);
  const terre = Math.min(1, Math.max(0, rivage / RAMPE_DU_RIVAGE));
  const douce = terre * terre * (3 - 2 * terre);

  // ⚠️ Le plateau fait 22 px, plus 40 : la rampe est deux fois plus courte
  // qu'avant, et a 40 la plage aurait fait un talus.
  let h = douce * 22;
  h += douce * ((bruitLisse(x, y, 230, 61) - 0.5) * 2 * 60 + (bruitLisse(x, y, 90, 62) - 0.5) * 2 * 10);

  // De combien on est dans la roche : une chaine sur un bord ou un massif au
  // milieu, la montagne monte depuis son pied dans tous les cas.
  const pied = profondeurDeRoche(x, y);
  if (pied > -10) {
    const dedans = pied + 10;
    // Une rampe douce, et des aretes par-dessus : une pente unique tournee vers
    // le nord restait un aplat sombre. Des cretes (le bruit replie sur
    // lui-meme) donnent des versants au soleil et d'autres a contre-jour.
    h += dedans * 0.25;
    const rude = Math.min(1, dedans / 90);
    const crete = 1 - Math.abs(bruitLisse(x, y, 110, 63) * 2 - 1);
    const eclats = 1 - Math.abs(bruitLisse(x, y, 45, 64) * 2 - 1);
    h += rude * (crete * 90 + eclats * 22);
  }
  return h;
}

/** Ce que le relief dit d'un point du monde. */
export interface Relief {
  /**
   * La clarte du sol au point (x, y) : 1 a plat, plus si la pente regarde le
   * soleil, moins a contre-jour. Bornee de 0,25 a 1,6.
   */
  lumiere(x: number, y: number): number;
  /**
   * De combien le point domine ce qui l'entoure, de -1 (un creux) a 1 (une
   * butte). C'est ce qui seche l'herbe des hauteurs et engraisse celle des fonds.
   */
  bosse(x: number, y: number): number;
}

/**
 * Releve le relief d'une carte : l'altitude sur un treillis, puis la clarte et
 * la bosse de chaque point du treillis, calculees une fois.
 *
 * ⚠️ **Eclairage linearise, et c'est une mesure.** Le produit exact entre la
 * normale et le soleil fait perdre sa clarte a toute surface bosselee (sur la
 * maquette, l'eboulis sortait noir, clarte mediane 0,42). Ici une pente vers le
 * soleil s'eclaircit d'autant que l'autre s'assombrit : le sol garde en moyenne
 * le ton de sa matiere.
 */
export function releverLeRelief(largeur: number, hauteur: number): Relief {
  const pas = PAS_DU_RELIEF;
  // Le point (0, 0) du treillis est deux pas avant la carte : la pente d'un
  // point se lit sur ses deux voisins, et la bosse sur un carre autour de lui.
  const colonnes = Math.ceil(largeur / pas) + 5;
  const lignes = Math.ceil(hauteur / pas) + 5;
  const altitudes = new Float32Array(colonnes * lignes);
  for (let j = 0; j < lignes; j += 1) {
    for (let i = 0; i < colonnes; i += 1) altitudes[j * colonnes + i] = altitude((i - 2) * pas, (j - 2) * pas);
  }
  const a = (i: number, j: number) =>
    altitudes[Math.min(lignes - 1, Math.max(0, j)) * colonnes + Math.min(colonnes - 1, Math.max(0, i))]!;

  const clartes = new Float32Array(colonnes * lignes);
  const bosses = new Float32Array(colonnes * lignes);
  // Le carre sur lequel on moyenne le terrain d'alentour : trois pas de chaque cote.
  const R = 3;
  for (let j = 0; j < lignes; j += 1) {
    for (let i = 0; i < colonnes; i += 1) {
      const gx = ((a(i + 1, j) - a(i - 1, j)) / (2 * pas)) * EXAGERATION;
      const gy = ((a(i, j + 1) - a(i, j - 1)) / (2 * pas)) * EXAGERATION;
      const clarte = 1 + (gx * -SOLEIL[0] - gy * SOLEIL[1]) / SOLEIL[2];
      clartes[j * colonnes + i] = Math.min(1.6, Math.max(0.25, clarte));

      let somme = 0;
      for (let dj = -R; dj <= R; dj += 1) for (let di = -R; di <= R; di += 1) somme += a(i + di, j + dj);
      const autour = somme / ((2 * R + 1) * (2 * R + 1));
      bosses[j * colonnes + i] = Math.min(1, Math.max(-1, (a(i, j) - autour) / 40));
    }
  }

  /** Lit un champ du treillis entre ses quatre points les plus proches. */
  const lire = (champ: Float32Array, x: number, y: number): number => {
    const fx = Math.min(colonnes - 1.001, Math.max(0, x / pas + 2));
    const fy = Math.min(lignes - 1.001, Math.max(0, y / pas + 2));
    const i = Math.floor(fx);
    const j = Math.floor(fy);
    const tx = fx - i;
    const ty = fy - j;
    const k = j * colonnes + i;
    const haut = champ[k]! + (champ[k + 1]! - champ[k]!) * tx;
    const bas = champ[k + colonnes]! + (champ[k + colonnes + 1]! - champ[k + colonnes]!) * tx;
    return haut + (bas - haut) * ty;
  };

  return {
    lumiere: (x, y) => lire(clartes, x, y),
    bosse: (x, y) => lire(bosses, x, y),
  };
}
