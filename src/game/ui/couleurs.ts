/**
 * Les neuf couleurs du jeu, et **rien d'autre** (DESIGN.md §4.10).
 *
 * ⚠️ **Pourquoi elles ont quitte `chrome.ts` le 12 aout 2026.** Elles y etaient
 * nees avec le bloc 6d, et c'etait la bonne place tant que seuls des panneaux
 * les lisaient. Le §4.30 fait descendre **tout le monde** de ces neuf couleurs —
 * la pierre, le bois, la chair, les toits — et la palette du monde doit pouvoir
 * etre **testee** : qu'une matiere ne se confonde pas avec une autre est une
 * mesure, pas un avis.
 *
 * Or `chrome.ts` importe Phaser, qui touche `window` des le chargement du
 * module : n'importe quel test qui remontait jusqu'a lui echouait avant
 * d'executer une seule ligne. Neuf entiers n'ont aucune raison de dependre d'un
 * moteur de rendu.
 *
 * **`chrome.ts` les reexporte**, donc rien n'a change pour ses lecteurs : il
 * reste le seul endroit ou l'on va chercher une couleur d'interface.
 */

/** Les neuf couleurs, en nombre — c'est ce que veulent Graphics et setTint. */
export const C = {
  /** Le fond de tout panneau, et le contour de tout sprite du monde */
  fer: 0x141010,
  /** Le metal : barres de titre, creux, boutons */
  plaque: 0x241a17,
  /** Tout le texte courant */
  os: 0xd9c9b0,
  /** Cadres, titres, l'accent */
  sangSeche: 0x8e1c12,
  /** Le danger, **et lui seul** : un heros sous 20%, une horde, un mort */
  sangFrais: 0xe0402a,
  /** Les touches, les chiffres, ce qui se clique */
  laiton: 0xc99a3a,
  /** Ce qui va bien — rare, et sale */
  bile: 0x7f9440,
  /** La mer et le commerce */
  acier: 0x7d8a99,
  /** Ce qu'un heros dit */
  cielSale: 0x9db3c4,
} as const;

/** Les memes, en chaine — c'est ce que veut le style d'un objet Texte. */
export const T = {
  os: "#d9c9b0",
  /** L'os assombri : les mentions secondaires, ce qui n'est pas encore actif */
  osMat: "#8d8172",
  sangSeche: "#8e1c12",
  sangFrais: "#e0402a",
  laiton: "#c99a3a",
  bile: "#7f9440",
  acier: "#7d8a99",
  cielSale: "#9db3c4",
  /** Sur une barre de titre sanglante, l'os pur est le seul lisible */
  titre: "#e8dcc8",
} as const;
