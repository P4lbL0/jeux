/**
 * Le bruit du monde : fixe, entier, et **le meme partout** (DESIGN.md §4.30).
 *
 * Il ne depend que de ses entrees. Deux lancements doivent peindre la meme
 * carte, sinon le terrain change a chaque rechargement de sauvegarde et deux
 * captures ne se comparent plus. C'est le meme principe que le grain de
 * `core/carte.ts`, et la meme raison.
 *
 * ⚠️ `Math.imul` et le `>>> 0` **avant** la division : une multiplication
 * ordinaire de deux grands entiers passe par un flottant et perd ses bits de
 * poids faible, et `^` rend un entier **signe**. Les deux bugs ont ete faits, et
 * les deux se voyaient comme un damier.
 */

/** Un bruit brut, de 0 a 1, pour une case entiere. */
export function bruit(x: number, y: number, sel: number): number {
  let h = Math.imul(x + sel * 131, 0x27d4eb2d) ^ Math.imul(y + sel * 57, 0x165667b1);
  h = Math.imul(h ^ (h >>> 15), 0x2545f491);
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
}

/** La courbe en S qui efface les aretes de la grille du bruit. */
export function adoucir(t: number): number {
  return t * t * (3 - 2 * t);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Le meme bruit, **interpole** entre ses points de grille.
 *
 * ⚠️ Prendre le bruit par blocs (`bruit(floor(x/6), ...)`) donne des carres a
 * bords francs — du camouflage numerique, pas une matiere. On interpole donc
 * entre les quatre coins, avec un adoucissement aux extremites, sans quoi les
 * diagonales de la grille restent visibles.
 */
export function bruitLisse(x: number, y: number, echelle: number, sel: number): number {
  const fx = x / echelle;
  const fy = y / echelle;
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const tx = adoucir(fx - x0);
  const ty = adoucir(fy - y0);

  const haut = lerp(bruit(x0, y0, sel), bruit(x0 + 1, y0, sel), tx);
  const bas = lerp(bruit(x0, y0 + 1, sel), bruit(x0 + 1, y0 + 1, sel), tx);
  return lerp(haut, bas, ty);
}

/**
 * Une ligne entiere de bruit lisse, calculee d'un coup.
 *
 * Peindre une carte de trois millions de pixels en appelant `bruitLisse` pour
 * chacun coute quatre hachages par pixel et par octave. Ici les quatre coins
 * ne sont haches qu'a chaque changement de colonne de grille : le reste n'est
 * que de l'interpolation. C'est ce qui rend la cuisson de la carte instantanee.
 *
 * ⚠️ **Elle part d'un x du monde, pas de zero.** Depuis que la carte se peint
 * **par morceaux** (§4.29, 20 septembre 2026, dans la nuit), une rangee ne commence plus au
 * bord gauche du monde : elle commence au bord gauche de son morceau. Le bruit
 * doit rester celui du **monde** — sinon deux morceaux voisins n'auraient pas
 * la meme tache a leur frontiere, et chaque raccord se verrait comme un trait.
 *
 * @param sortie le tampon a remplir, long d'au moins `largeur`
 * @param depart le x du monde du premier point de la rangee
 */
export function ligneDeBruit(
  y: number,
  echelle: number,
  sel: number,
  largeur: number,
  sortie: Float32Array,
  depart = 0,
): Float32Array {
  const fy = y / echelle;
  const y0 = Math.floor(fy);
  const ty = adoucir(fy - y0);

  let x0 = Number.NaN;
  let gauche = 0;
  let droite = 0;
  for (let i = 0; i < largeur; i += 1) {
    const fx = (depart + i) / echelle;
    const cx = Math.floor(fx);
    if (cx !== x0) {
      x0 = cx;
      gauche = lerp(bruit(cx, y0, sel), bruit(cx, y0 + 1, sel), ty);
      droite = lerp(bruit(cx + 1, y0, sel), bruit(cx + 1, y0 + 1, sel), ty);
    }
    sortie[i] = lerp(gauche, droite, adoucir(fx - cx));
  }
  return sortie;
}
