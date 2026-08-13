import type Phaser from "phaser";
import { Toile } from "./pinceau";
import {
  ARDOISE,
  BOIS,
  FEUILLE,
  PIERRE,
  SOL_VERT,
  melanger,
  type Matiere,
} from "./palette";

/**
 * Le sol, dessine par le code (DESIGN.md §4.30, §4.21).
 *
 * ⚠️ **Un seul carreau de 32 px repete fait un damier.** C'est le defaut trouve
 * sur la premiere planche du socle — *« ca se repete de fou furieux »* — et il
 * n'etait pas dans la couleur. Deux reponses, et la seconde compte plus que la
 * premiere :
 *
 * 1. **Plusieurs variantes par etat**, choisies par la **position de la case** et
 *    non au hasard. Le meme endroit doit donner le meme carreau a chaque
 *    lancement, sinon la carte scintille au rechargement et deux captures ne se
 *    comparent plus.
 * 2. **Des touffes rares.** Un bruit uniforme reparti partout se voit encore
 *    comme un bruit uniforme : c'est l'irregularite qui casse l'oeil, pas la
 *    quantite. Une case sur sept porte un detail, les autres non.
 *
 * ⚠️ **Et tout doit pouvoir etre detruit.** Le §4.21 promet des crateres de
 * meteore et des terres brulees, le §4.24 des chemins qui s'usent. Un etat de sol
 * est donc une **valeur de case**, au meme titre qu'un mur ou qu'un champ — pas
 * un decalque pose par-dessus. Un decalque ne survivrait ni a la sauvegarde, ni
 * au mode d'amenagement, ni au recalcul de la carte.
 *
 * **Rien n'est encore branche sur un systeme** : aucun meteore ne tombe au
 * jalon 5. Ce qui est livre, c'est le dessin de ces etats et le chemin qui les
 * ecrit. Cout aujourd'hui : quelques carreaux de plus dans la meme cuisson.
 */

/** Les etats qu'une case de sol peut prendre. */
export type EtatDuSol = "herbe" | "terre" | "brule" | "cratere";

/**
 * Combien de variantes par etat.
 *
 * Quatre suffisent : au-dela, l'oeil ne distingue plus, et chaque variante est
 * une texture de plus a cuire. En deca, le damier revient — mesure a deux, ou il
 * se voyait encore.
 */
export const VARIANTES = 4;

/** Cote d'un carreau, en pixels. C'est la case de la grille (§4.21). */
export const CARREAU = 32;

/** La cle de texture d'un carreau. */
export function cleDuSol(etat: EtatDuSol, variante: number): string {
  return `sol-${etat}-${variante}`;
}

/**
 * Quelle variante une case porte.
 *
 * ⚠️ **Determine, jamais aleatoire.** Deux lancements doivent peindre la meme
 * carte : sinon le terrain change a chaque rechargement de sauvegarde, et deux
 * captures d'ecran ne se comparent plus. C'est le meme principe que le grain de
 * `carte.ts`, et la meme raison.
 */
export function varianteDe(colonne: number, ligne: number): number {
  // ⚠️ **`Math.imul` et non `*`** : une multiplication ordinaire de deux grands
  // entiers passe par un flottant, perd ses bits de poids faible, et le melangeur
  // se met a privilegier une variante sur quatre — le damier revient par la
  // porte de derriere. Mesure : 433 cases sur 900 attendues pour une variante.
  let h = Math.imul(colonne, 0x27d4eb2d) ^ Math.imul(ligne, 0x165667b1);
  h = Math.imul(h ^ (h >>> 15), 0x2545f491);
  // ⚠️ Et le `>>> 0` **avant le modulo**, pas apres : en JavaScript `^` rend un
  // entier **signe**, donc `h % 4` peut valoir -2. C'est exactement le bug qui a
  // fait planter la fiche de personnage au bloc 5, et je l'ai refait en ecrivant
  // le commentaire qui en met en garde.
  return ((h ^ (h >>> 13)) >>> 0) % VARIANTES;
}

/**
 * Cuit tous les carreaux de sol, une fois au demarrage (§4.17 regle 3).
 *
 * @returns le nombre de textures produites.
 */
export function cuireLesSols(scene: Phaser.Scene): number {
  let compte = 0;
  for (const etat of ["herbe", "terre", "brule", "cratere"] as const) {
    for (let v = 0; v < VARIANTES; v += 1) {
      const cle = cleDuSol(etat, v);
      if (scene.textures.exists(cle)) continue;

      const toile = new Toile(CARREAU, CARREAU);
      peindreCarreau(toile, etat, v);

      const texture = scene.textures.createCanvas(cle, CARREAU, CARREAU);
      if (!texture) continue;
      texture.getContext().putImageData(toile.versImageData(), 0, 0);
      texture.refresh();
      compte += 1;
    }
  }
  return compte;
}

/** La matiere de chaque etat, et ce qu'on seme dessus. */
const MATIERE: Record<EtatDuSol, Matiere> = {
  herbe: SOL_VERT,
  // La terre battue : de l'herbe qui a perdu sa vie, tiree vers le bois.
  terre: { ...SOL_VERT },
  brule: ARDOISE,
  cratere: PIERRE,
};

export function peindreCarreau(toile: Toile, etat: EtatDuSol, variante: number): void {
  const sol = etat === "terre" ? terreBattue() : MATIERE[etat];
  toile.rect(0, 0, CARREAU, CARREAU, sol.corps);

  // Le grain de fond : il ne suffit pas a casser la repetition, mais sans lui un
  // aplat de 32 px se lit comme un defaut d'affichage.
  semer(toile, sol, variante);

  switch (etat) {
    case "herbe":
      // Les touffes : une case sur sept en porte, les autres non.
      if (variante % 2 === 0) peindreTouffes(toile, variante);
      break;
    case "brule":
      peindreCendres(toile, variante);
      break;
    case "cratere":
      peindreCratere(toile, variante);
      break;
    case "terre":
      peindreOrnieres(toile, variante);
      break;
  }
}

/** L'herbe qui a perdu sa vie : la meme, tiree vers le bois et desaturee. */
function terreBattue(): Matiere {
  const corps = melanger(SOL_VERT.corps, BOIS.corps, 0.62);
  return {
    sombre: melanger(corps, SOL_VERT.sombre, 0.5),
    corps,
    clair: melanger(corps, BOIS.clair, 0.3),
  };
}

function semer(toile: Toile, sol: Matiere, variante: number): void {
  // Le decalage par variante est ce qui fait que quatre carreaux voisins ne
  // montrent pas le meme grain : sans lui, quatre textures identiques.
  const sel = variante * 37;
  for (let y = 0; y < CARREAU; y += 1) {
    for (let x = 0; x < CARREAU; x += 1) {
      const g = (x * 7 + y * 13 + ((x * y) % 11) + sel) % 9;
      if (g === 0) toile.point(x, y, sol.sombre);
      else if (g === 4) toile.point(x, y, sol.clair);
    }
  }
}

function peindreTouffes(toile: Toile, variante: number): void {
  // Trois brins par touffe, deux touffes par carreau, places par la variante.
  const places = [
    [7, 20],
    [22, 11],
    [13, 26],
    [26, 24],
  ] as const;
  for (let i = 0; i < 2; i += 1) {
    const place = places[(variante + i * 2) % places.length]!;
    const [x, y] = place;
    toile.segment(x, y, x - 1, y - 3, 1, FEUILLE.corps);
    toile.segment(x + 1, y, x + 2, y - 4, 1, FEUILLE.clair);
    toile.segment(x + 2, y, x + 3, y - 2, 1, FEUILLE.sombre);
  }
}

function peindreOrnieres(toile: Toile, variante: number): void {
  // Deux sillons dans le sens du passage : c'est ce qui fait lire « on marche
  // ici » plutot que « la terre est nue ».
  const y = 10 + (variante % 3) * 4;
  toile.rect(0, y, CARREAU, 1, melanger(BOIS.sombre, SOL_VERT.sombre, 0.4));
  toile.rect(0, y + 9, CARREAU, 1, melanger(BOIS.sombre, SOL_VERT.sombre, 0.5));
}

function peindreCendres(toile: Toile, variante: number): void {
  // Ce qui reste debout apres un incendie : des moignons noirs, rares.
  const places = [
    [9, 18],
    [21, 24],
    [15, 9],
    [26, 14],
  ] as const;
  const place = places[variante % places.length]!;
  const [x, y] = place;
  toile.segment(x, y, x, y - 4, 1.4, ARDOISE.sombre);
  toile.point(x + 1, y - 4, ARDOISE.corps);
}

function peindreCratere(toile: Toile, variante: number): void {
  // Un cratere se lit par son **bord clair et son fond sombre**, pas par sa
  // couleur : c'est le meme principe que le mur du §4.30, crete claire et pied
  // sombre. Sans ce contraste, il n'a pas de creux.
  const cx = 16 + ((variante % 2) * 2 - 1) * 2;
  const cy = 16 + ((variante > 1 ? 1 : -1) * 2);
  const rayon = 11;

  for (let y = 0; y < CARREAU; y += 1) {
    for (let x = 0; x < CARREAU; x += 1) {
      const d = Math.hypot(x - cx, y - cy) / rayon;
      if (d > 1) continue;
      // Le bord accroche la lumiere, le fond la perd.
      if (d > 0.82) toile.point(x, y, PIERRE.clair);
      else if (d > 0.55) toile.point(x, y, PIERRE.corps);
      else toile.point(x, y, melanger(PIERRE.sombre, ARDOISE.sombre, 0.6));
    }
  }
}
