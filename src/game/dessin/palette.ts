import { C } from "../ui/couleurs";

/**
 * La palette du **monde**, derivee des neuf couleurs des panneaux
 * (DESIGN.md §4.30, section « Le socle »).
 *
 * **Pourquoi ce fichier existe, et pourquoi il est une donnee.** Le bloc 6d a
 * passe une journee a supprimer 48 valeurs de couleur semees dans neuf ecrans.
 * Le monde etait reste dehors : herbe eclatante, toits bleus et jaunes, chair
 * rose. Il rentre ici, et sous la meme regle — **une couleur qui ne descend pas
 * des neuf de `chrome.ts` ne peut pas exister**, parce qu'il n'y a aucun endroit
 * ou l'ecrire.
 *
 * ⚠️ **Rien d'autre dans `src/game/dessin/` ne nomme une couleur.** Un dessin
 * demande une matiere ; il ne choisit jamais une teinte.
 */

// ------------------------------------------------------------ l'arithmetique

interface Canaux {
  r: number;
  v: number;
  b: number;
}

function decomposer(couleur: number): Canaux {
  return { r: (couleur >> 16) & 0xff, v: (couleur >> 8) & 0xff, b: couleur & 0xff };
}

function borner(valeur: number): number {
  return Math.max(0, Math.min(255, Math.round(valeur)));
}

function recomposer({ r, v, b }: Canaux): number {
  return (borner(r) << 16) | (borner(v) << 8) | borner(b);
}

/** Deux couleurs, et la part de la seconde. `part` de 0 a 1. */
export function melanger(a: number, b: number, part: number): number {
  const x = decomposer(a);
  const y = decomposer(b);
  return recomposer({
    r: x.r + (y.r - x.r) * part,
    v: x.v + (y.v - x.v) * part,
    b: x.b + (y.b - x.b) * part,
  });
}

/**
 * La luminance percue.
 *
 * Les trois coefficients ne sont pas un tiers chacun : l'oeil voit le vert
 * beaucoup plus que le bleu. Desaturer a poids egaux ferait virer les verts au
 * clair et les bleus au sombre.
 */
function luminance(c: Canaux): number {
  return 0.299 * c.r + 0.587 * c.v + 0.114 * c.b;
}

/** Tire une couleur vers son propre gris. `part` de 0 (rien) a 1 (gris pur). */
export function desaturer(couleur: number, part: number): number {
  const c = decomposer(couleur);
  const gris = luminance(c);
  return recomposer({
    r: c.r + (gris - c.r) * part,
    v: c.v + (gris - c.v) * part,
    b: c.b + (gris - c.b) * part,
  });
}

/** De combien deux couleurs different, tous canaux confondus. Sert aux tests. */
export function ecart(a: number, b: number): number {
  const x = decomposer(a);
  const y = decomposer(b);
  return Math.abs(x.r - y.r) + Math.abs(x.v - y.v) + Math.abs(x.b - y.b);
}

/** La luminance d'une couleur, de 0 a 255. Sert aux tests. */
export function clarte(couleur: number): number {
  return luminance(decomposer(couleur));
}

// -------------------------------------------------------------- les matieres

/** Une matiere : son corps, et les deux valeurs qui s'en deduisent. */
export interface Matiere {
  readonly sombre: number;
  readonly corps: number;
  readonly clair: number;
}

/**
 * De combien une matiere descend vers le fer pour faire son ombre, et monte
 * vers l'os pour faire sa lumiere.
 *
 * L'ombre mord plus fort que la lumiere : un monde post-apocalyptique se joue
 * mieux quand ce qui est sombre est franchement sombre, et le §4.10 demande
 * exactement ca aux panneaux.
 */
const VERS_L_OMBRE = 0.38;
const VERS_LA_LUMIERE = 0.3;

/**
 * **L'ombre de toute matiere est du fer, sa lumiere est de l'os** (§4.30).
 *
 * Une matiere ne choisit qu'une couleur : son corps. Les deux autres se
 * calculent. C'est ce qui donne au monde une lumiere unique — si chaque matiere
 * choisissait ses trois valeurs a la main, les ombres partiraient chacune dans
 * leur teinte et on retomberait sur les 48 valeurs du bloc 6d.
 */
export function matiere(
  corps: number,
  ombre = VERS_L_OMBRE,
  lumiere = VERS_LA_LUMIERE,
): Matiere {
  return {
    sombre: melanger(corps, C.fer, ombre),
    corps,
    clair: melanger(corps, C.os, lumiere),
  };
}

/** L'os sali : c'est ce qui donne le village d'ossements (§4.30). */
export const PIERRE = matiere(desaturer(melanger(C.os, C.fer, 0.55), 0.55));

/**
 * La plaque eclaircie, **puis rechauffee au laiton**.
 *
 * ⚠️ Le rechauffement n'est pas une coquetterie, il est mesure : sans lui, le
 * bois tombe a trois unites de la pierre sur les trois canaux — deux gris
 * identiques. Une maison a pans de bois dont les colombages ont la couleur du
 * torchis ne montre plus rien. Un test tient ce garde-fou.
 */
export const BOIS = matiere(melanger(melanger(C.plaque, C.os, 0.4), C.laiton, 0.22));

/** L'acier assombri. Le fer des armes, des ferrures et des remparts ameliores. */
export const FER = matiere(melanger(C.acier, C.fer, 0.42));

/**
 * Le toit d'une maison : de l'acier assombri jusqu'a l'ardoise.
 *
 * Tranche le 12 aout 2026 : le §4.30 se contredisait, sa table disait « du sang
 * seche, et lui seul » quand sa maison A disait « toit gris ». C'est la maison A
 * qui l'emporte, et le sang seche reste a l'eglise — ca lui donne une couleur
 * qui n'appartient qu'a elle.
 *
 * ⚠️ Elle descend de l'**acier** et non de l'os, contrairement a ce que la
 * premiere version disait : un toit tire de l'os sali tombait a quinze unites du
 * sol de cendre, et un village dont les toits ont la couleur du sol n'a plus de
 * toits. Une ardoise est froide, c'est ce qui la separe de la pierre chaude des
 * murs — et elle reste **plus sombre qu'eux**, sinon le batiment se lit a
 * l'envers.
 */
export const ARDOISE = matiere(desaturer(melanger(C.acier, C.fer, 0.62), 0.2));

/** Le toit de l'eglise, et lui seul : du sang seche desature (§4.22). */
export const TOIT_EGLISE = matiere(desaturer(C.sangSeche, 0.35));

/** Ce qui vaut quelque chose : la croix, une boucle, une serrure. */
export const LAITON = matiere(C.laiton);

/** L'os rechauffe au laiton. **Jamais une peau rose** (§4.30). */
export const CHAIR = matiere(melanger(melanger(C.os, C.laiton, 0.3), C.fer, 0.12));

/** Le fer eclairci : les vetements sombres, la tunique. */
export const TISSU = matiere(melanger(C.fer, C.os, 0.18));

/** L'os legerement sali : le tablier, le torchis, une voile. */
export const TOILE = matiere(melanger(C.os, C.fer, 0.22));

/** La bile salie : les houppiers, ce qui pousse. */
export const FEUILLE = matiere(melanger(C.bile, C.fer, 0.3));

/**
 * L'acier assombri, **puis franchement tire vers le ciel sale**.
 *
 * ⚠️ Mesure, encore : a 0,15 de ciel sale, l'eau tombait a **une unite** du fer.
 * Elle en prend 0,42 — c'est le reflet du ciel qui separe une etendue d'eau d'une
 * plaque de metal, et il faut qu'il se voie.
 */
export const EAU = matiere(melanger(melanger(C.acier, C.fer, 0.62), C.cielSale, 0.42));

/**
 * Le sang frais, et **il ne sert qu'a ce qui peut tuer** (§4.10).
 *
 * Sur un sprite, ca veut dire une hemorragie — le seul etat qui tue en une
 * journee (§4.23) — et rien d'autre. Trois pixels, jamais un aplat : la couleur
 * ne garde son sens que parce qu'elle est rare.
 */
export const SANG = matiere(C.sangFrais);

/**
 * Le feu (§4.21, l'incendie) : trois matieres, et **aucune couleur neuve**.
 *
 * Le laiton chauffe vers le sang frais pour le corps de la flamme, le sang
 * seche fait la braise, et le laiton monte vers l'os pour le coeur. La regle du
 * §4.30 tient : rien ici ne descend d'autre chose que des neuf couleurs.
 *
 * ⚠️ **Leur ombre est faible et leur lumiere forte**, contrairement a tout le
 * reste. Une flamme ombree comme une pierre ressemble a un caillou orange : ce
 * qui brule doit rester clair sur toutes ses faces, y compris celle que le
 * soleil ne touche pas.
 */
export const FLAMME = matiere(melanger(C.laiton, C.sangFrais, 0.5), 0.16, 0.34);
export const BRAISE = matiere(melanger(C.sangSeche, C.sangFrais, 0.45), 0.22, 0.22);

/**
 * La fumee (23 septembre 2026) : du fer monte d'un quart vers l'os.
 *
 * ⚠️ **Elle prend l'ombre a l'envers de tout le reste** : ombre forte, lumiere
 * faible — l'inverse exact des trois matieres du feu juste au-dessus. Premier
 * reglage a 0,34 avec les valeurs ordinaires : le soleil du rendu posait
 * presque toutes les faces sur la marche la plus claire et les bouffees
 * sortaient **plus claires que la prairie**, donc plus proches d'un rocher que
 * d'une fumee. Ce qui monte d'un toit doit assombrir ce qu'il y a derriere,
 * jamais l'eclaircir.
 *
 * Et ses cinq marches tiennent dans une **bande etroite** (0,20 et 0,13, la
 * plus serree du jeu) : une bouffee franchement facettee, face claire contre
 * face sombre, se lit comme un tas de pierres. Il reste juste assez d'ecart
 * pour qu'on voie qu'elle a des faces.
 */
export const FUMEE = matiere(melanger(C.fer, C.os, 0.26), 0.20, 0.13);
/**
 * ⚠️ **Le coeur monte vers l'os, mais pas jusqu'au sable.** Premier reglage a
 * 0,62 : une fois sorti du corps de la flamme (23 septembre 2026), il est
 * apparu **beige** au milieu de l'orange — un coeur de bougie, pas un coeur de
 * feu. A 0,42 il reste du laiton, donc de l'or, et c'est la couleur la plus
 * chaude que les neuf permettent.
 */
export const COEUR_DU_FEU = matiere(melanger(C.laiton, C.os, 0.42), 0.1, 0.42);

/**
 * Le sol : la bile salie, franchement.
 *
 * Tranche sur image le 13 aout 2026 : **le sol reste vert**. Le sol de cendre
 * qui lui faisait face sur la planche du socle a perdu, et il est supprime — sa
 * recette est reprise par la roche, a qui elle va mieux.
 */
export const SOL_VERT = matiere(melanger(C.bile, C.fer, 0.42));

/** La foret : le meme sol, enfonce dans l'ombre des arbres. */
export const SOUS_BOIS = matiere(melanger(SOL_VERT.corps, C.fer, 0.35));

/**
 * Le sable : l'os sali et rechauffe au laiton. Plus clair que tout le reste du
 * sol — c'est la seule plage claire du monde, et elle borde une mer sombre.
 */
export const SABLE = matiere(melanger(melanger(C.os, C.fer, 0.32), C.laiton, 0.18));

/**
 * La roche de la montagne : l'ancienne cendre. Plus sombre que la pierre des
 * murs, sinon le pied des batiments disparait dedans — mesure au socle.
 */
export const ROCHE = matiere(desaturer(melanger(C.os, C.fer, 0.68), 0.5));

/** L'eboulis au pied de la montagne : de la roche cassee, plus claire. */
export const EBOULIS = matiere(desaturer(melanger(C.os, C.fer, 0.45), 0.7));

/** L'ecorce d'un arbre mort : du bois qui a seche au vent. */
export const ECORCE = matiere(melanger(BOIS.corps, C.fer, 0.45));

/**
 * La chair d'un monstre : du sang seche, sali et eteint.
 *
 * Ce n'est ni la chair des humains (de l'os), ni le sang frais (reserve a ce
 * qui tue, donc a leurs yeux) : une viande sombre, qui n'appartient qu'a eux.
 */
export const MONSTRE = matiere(desaturer(melanger(C.sangSeche, C.fer, 0.35), 0.45));

/**
 * Le contour de tout sprite, et il n'y en a qu'un : le fer, la plus sombre des
 * neuf. Le §4.30 le veut **automatique** — un contour dessine a la main est un
 * contour qu'on oublie quelque part.
 */
export const CONTOUR = C.fer;

/**
 * Ramene une couleur de classe dans le monde (§4.30, §4.11).
 *
 * ⚠️ **Les sept couleurs de classe ne sont pas dans les neuf**, et les deux
 * regles se contredisaient : le §4.11 les garde « sur le sprite et sur le sprite
 * seulement », le §4.30 dit « les neuf, et aucune autre ». Le bleu du Chevalier
 * et le violet du Mage sont des couleurs d'interface WorldBox — posees a cote du
 * villageois, elles hurlent.
 *
 * **Ce qu'on garde d'une couleur de classe, c'est sa teinte**, et rien d'autre :
 * c'est le seul travail qu'on lui demande, reconnaitre qui est qui a petite
 * taille. On lui donne ensuite la **matiere du monde** — desaturee, assombrie,
 * ramenee dans la fourchette des neuf. Un Mage reste violet, d'un violet qui a
 * vecu ici.
 *
 * ⚠️ Le correctif, si deux classes se confondent, est d'**ecarter les teintes**
 * — jamais de remonter la saturation.
 */
export function rebaser(couleurDeClasse: number): Matiere {
  // Mesure : a 0,55 de desaturation, l'Assassin tombait sur la tunique du
  // villageois et le Necromancien sur l'ardoise — un heros qu'on prend pour un
  // habitant, la nuit, c'est un heros qu'on laisse mourir. A 0,40 / 0,18, les
  // sept sont separees les unes des autres **et** des treize matieres.
  return matiere(melanger(desaturer(couleurDeClasse, 0.4), C.fer, 0.18));
}

/** Palit une matiere : l'usure, un malade, un mort (§4.23). `part` de 0 a 1. */
export function palir(m: Matiere, part: number): Matiere {
  return matiere(desaturer(melanger(m.corps, C.os, 0.3 * part), 0.55 * part));
}

/**
 * La table, pour la planche de controle et pour les tests.
 *
 * Elle n'est pas decorative : c'est elle qui permet de verifier d'un coup d'oeil
 * que deux matieres ne se confondent pas, ce qui est arrive au bois et a la
 * pierre avant qu'on les mesure.
 */
export const MATIERES: ReadonlyArray<{ nom: string; matiere: Matiere }> = [
  { nom: "pierre", matiere: PIERRE },
  { nom: "bois", matiere: BOIS },
  { nom: "fer", matiere: FER },
  { nom: "ardoise", matiere: ARDOISE },
  { nom: "toit eglise", matiere: TOIT_EGLISE },
  { nom: "laiton", matiere: LAITON },
  { nom: "chair", matiere: CHAIR },
  { nom: "tissu", matiere: TISSU },
  { nom: "toile", matiere: TOILE },
  { nom: "feuille", matiere: FEUILLE },
  { nom: "eau", matiere: EAU },
  { nom: "sol vert", matiere: SOL_VERT },
  { nom: "sous-bois", matiere: SOUS_BOIS },
  { nom: "sable", matiere: SABLE },
  { nom: "roche", matiere: ROCHE },
  { nom: "eboulis", matiere: EBOULIS },
  { nom: "ecorce", matiere: ECORCE },
  { nom: "monstre", matiere: MONSTRE },
  { nom: "flamme", matiere: FLAMME },
  { nom: "braise", matiere: BRAISE },
  { nom: "coeur du feu", matiere: COEUR_DU_FEU },
];
