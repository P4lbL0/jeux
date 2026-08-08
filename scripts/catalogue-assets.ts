/**
 * Le catalogue des sprites a produire.
 *
 * C'est de la **donnee**, pas du code de generation : une entree par cle de
 * texture du jeu. Le script `generer-assets.ts` se contente de le derouler.
 *
 * Deux regles ont dicte les tailles :
 *
 * 1. **La taille du PNG est la taille a l'ecran.** Le jeu affiche les sprites a
 *    l'echelle 1, sans jamais les reduire : reduire du pixel-art d'un facteur
 *    non entier le transforme en bouillie. On genere donc directement a la
 *    taille utile plutot que de generer grand et de rapetisser.
 * 2. **On reste proche de l'empreinte des placeholders** (heros 12x18, ennemi
 *    12x16, arbre 26x30, maison 22x28). Les hitbox, elles, ne bougent pas d'un
 *    pixel : voir `entities.ts`, ou le corps physique est recale sur la taille
 *    de la texture.
 */

/** Les vues de camera acceptees par l'API, reprises telles quelles. */
export type Groupe = "heros" | "creatures" | "sol" | "decor";

export interface Asset {
  /** La cle de texture Phaser. Le PNG s'appelle `<cle>.png`. */
  cle: string;
  groupe: Groupe;
  /** Cote du PNG, en pixels. Carre dans tous les cas. */
  taille: number;
  /** La description envoyee au modele, en anglais (il y repond bien mieux). */
  invite: string;
  /** Ce qu'on ne veut surtout pas voir apparaitre. */
  interdit?: string;
  /** Un sol se repete : ni contour, ni fond transparent, ni sujet centre. */
  seamless?: boolean;
}

/**
 * Le vocabulaire de style commun.
 *
 * Il est colle a chaque invite : c'est lui qui fait que les trente sprites
 * appartiennent au meme jeu. Le §4.11 de DESIGN.md rappelle que la lisibilite
 * tient a la silhouette — d'ou le « readable silhouette » et le detail bas.
 */
export const STYLE =
  "top-down orthographic pixel art, centered, readable silhouette, " +
  "limited palette, crisp pixels, no anti-aliasing";

/** Ce qu'on refuse partout : c'est ce qui casse le plus souvent un sprite. */
export const INTERDIT_COMMUN =
  "blurry, anti-aliasing, gradient, photo, 3d render, text, watermark, " +
  "drop shadow, frame, border";

/**
 * Les heros. Un par classe, dans l'ordre de `ORDRE_CLASSES`.
 *
 * La couleur dominante est reprise de `CLASSES` : c'est elle qui identifie une
 * classe au premier coup d'oeil, avant meme la silhouette.
 */
const HEROS: Asset[] = [
  {
    cle: "hero-guerrier",
    groupe: "heros",
    taille: 32,
    invite:
      "warrior hero seen from above, crimson red plate armor, dark steel helmet, " +
      "holding a large two-handed sword, broad shoulders, standing",
  },
  {
    // « Chevalier Sacre » dans `CLASSES`, jamais un chevalier tout court : sa
    // classe est celle du protecteur qui provoque et encaisse. Le sacre doit se
    // voir sur le sprite, d'ou le paladin et non le cavalier.
    cle: "hero-chevalier",
    groupe: "heros",
    taille: 32,
    invite:
      "holy paladin knight seen from above, silver armor with steel blue cape, " +
      "golden holy emblem on the chest, round shield in one hand, mace in the other, standing",
  },
  {
    cle: "hero-mage",
    groupe: "heros",
    taille: 32,
    invite:
      "wizard seen from above, long purple robe, pointed hat, " +
      "wooden staff topped with a glowing cyan gem, standing",
  },
  {
    cle: "hero-assassin",
    groupe: "heros",
    taille: 32,
    invite:
      "hooded rogue assassin seen from above, dark charcoal cloak with green trim, " +
      "two curved daggers, slim silhouette, crouching low",
  },
  {
    cle: "hero-rodeur",
    groupe: "heros",
    taille: 32,
    invite:
      "ranger archer seen from above, green hooded cape, leather armor, " +
      "holding a wooden longbow, quiver on the back, standing",
  },
  {
    cle: "hero-oracle",
    groupe: "heros",
    taille: 32,
    invite:
      "oracle priestess seen from above, flowing white and gold robe, " +
      "lilac hair, golden halo above the head, holding a small lantern, standing",
  },
  {
    cle: "hero-necromancien",
    groupe: "heros",
    taille: 32,
    invite:
      "necromancer seen from above, dark violet hooded robe, bone ornaments, " +
      "skull staff with a sickly green flame, standing",
  },
];

/** Ennemis et invocations : la meme carrure, des intentions opposees. */
const CREATURES: Asset[] = [
  {
    cle: "ennemi",
    groupe: "creatures",
    taille: 32,
    invite:
      "hostile goblin monster seen from above, mottled purple-brown skin, " +
      "two small horns, glowing red eyes, hunched, clawed hands",
  },
  {
    cle: "mort-vivant",
    groupe: "creatures",
    taille: 32,
    invite:
      "undead skeleton warrior seen from above, pale bone, torn grey rags, " +
      "sickly green glowing eye sockets, shambling",
  },
  {
    cle: "familier",
    groupe: "creatures",
    taille: 32,
    invite:
      "small floating arcane spirit familiar seen from above, violet body, " +
      "single bright cyan eye, wispy trailing tail, no legs",
  },
  {
    cle: "familier-golem",
    groupe: "creatures",
    taille: 32,
    invite:
      "small stone golem familiar seen from above, blocky sand-coloured rock body, " +
      "thick arms, glowing amber eyes, heavy stance",
  },
  {
    cle: "familier-spectre",
    groupe: "creatures",
    taille: 32,
    invite:
      "small pale blue ghost familiar seen from above, translucent tattered shroud, " +
      "white glowing eyes, wispy lower body, floating",
  },
];

/**
 * Les sols. Une texture par nature de terrain de `carte.ts`.
 *
 * Elles ne sont pas posees telles quelles : `creerCarte()` y decoupe des
 * carreaux de 8 px (la maille `TUILE`). Un PNG de 64 px offre donc 64 variantes
 * de carreau — c'est ce qui remplace les trois teintes en aplat d'avant.
 */
const SOL: Asset[] = [
  {
    cle: "sol-abysse",
    groupe: "sol",
    taille: 64,
    seamless: true,
    invite: "seamless deep ocean water texture, very dark navy blue, subtle darker ripples",
  },
  {
    cle: "sol-mer",
    groupe: "sol",
    taille: 64,
    seamless: true,
    invite: "seamless sea water texture, medium blue, gentle wave ripples",
  },
  {
    cle: "sol-haut-fond",
    groupe: "sol",
    taille: 64,
    seamless: true,
    invite: "seamless shallow tropical water texture, bright turquoise blue, light ripples",
  },
  {
    cle: "sol-sable",
    groupe: "sol",
    taille: 64,
    seamless: true,
    invite: "seamless beach sand texture, warm pale yellow, fine grain, a few tiny pebbles",
  },
  {
    // La prairie couvre la moitie de la carte : c'est la seule texture dont le
    // moindre defaut se voit partout. Le PNG livre marbre legerement (son halo
    // central, redistribue en carreaux, donne des taches claires et sombres).
    //
    // Une deuxieme version a ete tentee avec « uniform, evenly lit, no
    // vignette » et un negatif contre le halo : elle est effectivement plus
    // reguliere, mais elle vire au vert menthe froid, qui jure avec la foret et
    // contredit la palette chaude du §4.11. **Ne pas refaire cet essai tel
    // quel** — si on y revient, c'est la teinte qu'il faut contraindre, pas
    // l'uniformite.
    cle: "sol-herbe",
    groupe: "sol",
    taille: 64,
    seamless: true,
    invite: "seamless meadow grass texture, medium warm green, short grass blades, tiny flowers",
  },
  {
    cle: "sol-sous-bois",
    groupe: "sol",
    taille: 64,
    seamless: true,
    invite: "seamless forest floor texture, dark green moss, fallen leaves, twigs",
  },
  {
    cle: "sol-eboulis",
    groupe: "sol",
    taille: 64,
    seamless: true,
    invite: "seamless scree texture, light grey gravel and small broken stones",
  },
  {
    cle: "sol-roche",
    groupe: "sol",
    taille: 64,
    seamless: true,
    invite: "seamless bare mountain rock texture, dark grey stone, cracks and facets",
  },
];

/** Le decor pose sur le sol : arbres, rochers, palissade, maisons. */
const DECOR: Asset[] = [
  {
    cle: "arbre-0",
    groupe: "decor",
    taille: 48,
    invite: "tall slender pine tree seen from above, dark green foliage, visible brown trunk base",
  },
  {
    cle: "arbre-1",
    groupe: "decor",
    taille: 48,
    invite: "stout round broadleaf tree seen from above, wide bushy green canopy, brown trunk base",
  },
  {
    cle: "arbre-2",
    groupe: "decor",
    taille: 48,
    invite: "leaning twin-crowned tree seen from above, two green foliage clumps, brown trunk base",
  },
  {
    cle: "arbre-3",
    groupe: "decor",
    taille: 48,
    invite: "small round shrub seen from above, low dense green bush, few branches",
  },
  {
    cle: "arbre-4",
    groupe: "decor",
    taille: 48,
    invite: "very tall narrow tree seen from above, stacked dark green foliage tiers, brown trunk base",
  },
  {
    cle: "rocher",
    groupe: "decor",
    taille: 32,
    invite: "grey granite boulder seen from above, angular faceted rock, lighter top face",
  },
  {
    cle: "mur",
    groupe: "decor",
    taille: 32,
    invite:
      "wooden palisade wall segment seen from above, sharpened vertical logs, " +
      "rope bindings, weathered brown wood, spans the full width of the tile",
  },
  {
    cle: "maison-bleue",
    groupe: "decor",
    taille: 48,
    invite:
      "small medieval cottage seen from above, bright blue tiled roof, " +
      "clay and timber walls, dark wooden door",
  },
  {
    cle: "maison-rouge",
    groupe: "decor",
    taille: 48,
    invite:
      "small medieval cottage seen from above, bright red tiled roof, " +
      "clay and timber walls, dark wooden door",
  },
  {
    cle: "maison-jaune",
    groupe: "decor",
    taille: 48,
    invite:
      "small medieval cottage seen from above, golden yellow thatched roof, " +
      "clay and timber walls, dark wooden door",
  },
];

/**
 * L'ordre du tableau est l'ordre de priorite du brief : les heros d'abord,
 * puis les creatures, puis le sol, puis le decor. On peut s'arreter en route.
 */
export const CATALOGUE: Asset[] = [...HEROS, ...CREATURES, ...SOL, ...DECOR];

/**
 * Le sprite temoin : celui qu'on genere en premier et qu'on regarde avant de
 * lancer le lot.
 *
 * Il sert aussi d'image de style quand on passe `--style` au script. Ce n'est
 * **pas** le mode par defaut : voir `generer()` dans `generer-assets.ts`, la
 * reference de style ecrase les couleurs de classe.
 */
export const REFERENCE_STYLE = "hero-guerrier";
