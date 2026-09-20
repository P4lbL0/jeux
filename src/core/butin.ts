/**
 * Le butin : ce que laisse ce qu'on tue (DESIGN.md §4.29, §4.8, §4.18).
 *
 * Tranche par Angelos le 20 septembre 2026 : « tous les monstres et humains
 * qu'on va tuer nous donnent des gold et de l'xp ». Jusqu'ici une mort ne
 * donnait que de l'experience, et **l'or n'avait qu'une source** : le commerce
 * au port. C'est ce qui donnait un sens a produire au-dela de ses besoins.
 *
 * ⚠️ **D'ou la seule regle qui compte ici, et elle est testee** : un mort doit
 * rester **petit devant une cargaison**. Un or qui tombe des cadavres et qui
 * rivalise avec le port tue le port — et avec lui la moitie du jeu de village.
 *
 * Deux tarifs, parce que ce ne sont pas les memes morts :
 *
 * - **une bete** vaut ce qu'elle vaut en experience, et rien de plus : elle ne
 *   porte rien. Une nuit entiere doit rester sous une cargaison de bois.
 * - **un humain** porte ce qu'il possede — un village qui se jette sur nous
 *   laisse de quoi payer la route. C'est le prix du risque : refuser en face
 *   peut tuer, et ca doit pouvoir rapporter.
 */

export const REGLAGES_BUTIN = {
  /**
   * Pieces par point d'experience, pour une bete.
   *
   * A ce tarif, une nuit de soixante monstres rend une trentaine de pieces —
   * la moitie d'une cargaison de bois. On sent la difference, on ne remplace
   * pas le port (verifie par le test).
   */
  orParXp: 0.25,
  /**
   * Ce que laisse un humain, en pieces. Ce qu'il avait sur lui.
   *
   * ⚠️ Un seul mort reste **petit devant une cargaison** (8 contre 50), mais un
   * village entier se paie : c'est voulu, c'est le prix du risque du §4.29.
   */
  orDUnHumain: 8,
  /** L'experience d'un humain : celle d'une brute. Ce sont des adultes armes. */
  xpDUnHumain: 4,
};

/** Ce qu'une bete met dans la bourse, en pieces — rarement une piece entiere. */
export function orDUneBete(xp: number): number {
  return xp * REGLAGES_BUTIN.orParXp;
}

/**
 * La monnaie qu'on garde.
 *
 * ⚠️ **L'argent du jeu est un entier** : il s'affiche tel quel au port et a
 * l'eglise, et `3.4000000000000004 pieces` ne s'affiche pas. Une bete valant
 * moins d'une piece, on garde donc le reste d'une mort a l'autre plutot que
 * d'arrondir chaque cadavre — arrondir au-dessus rendrait chaque fonceur aussi
 * cher qu'une brute, arrondir au-dessous ne donnerait jamais rien.
 *
 * @param reste la monnaie gardee depuis la derniere piece
 * @param gain ce que vaut cette mort, en pieces
 * @returns les pieces entieres a encaisser, et la monnaie a garder
 */
export function encaisser(reste: number, gain: number): { pieces: number; reste: number } {
  const total = reste + gain;
  const pieces = Math.floor(total);
  return { pieces, reste: total - pieces };
}
