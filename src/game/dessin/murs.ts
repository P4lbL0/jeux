import type Phaser from "phaser";
import type { Matiere as MatiereDuNoyau } from "../../core/constructions";
import { Toile } from "./pinceau";
import { C } from "../ui/couleurs";
import { BOIS, EAU, ECORCE, FER, PIERRE, ROCHE, melanger, type Matiere } from "./palette";
import { CRATERE, TERRE } from "./sol";

/**
 * L'enceinte : les murs, les tours et les portes, dessines par le code
 * (DESIGN.md §4.30, tranche le 11 septembre 2026 sur les captures).
 *
 * ⚠️ **Un mur regarde ses quatre voisines, et c'est ca, Clash of Clans.** Le
 * bloc plein du 10 septembre — la case entiere soulevee de sa hauteur — faisait
 * des cubes : en ligne ils se lisaient, en escalier ils s'empilaient comme des
 * caisses, et « les coins font bizarre ». Un mur de Clash of Clans, ce n'est
 * pas un bloc par case : c'est **un poteau par case, et un pan vers chaque
 * voisine qui est un mur**. Deux cases cote a cote joignent leurs pans, un
 * angle est un poteau d'ou partent deux pans, une case seule est une borne.
 * Seize raccords, un dessin chacun, par matiere.
 *
 * **La vue est de trois quarts, comme tout le reste** : on voit le **dessus**
 * de ce qui est bati, souleve de sa hauteur, et sa **face sud**. Un point du
 * sol a la ligne `g` de sa case (0 au nord, 32 au sud) s'affiche a la ligne
 * `g` du pied de la texture ; le dessus d'un element haut de `h` s'affiche `h`
 * lignes plus haut, et sa face occupe les `h` lignes sous son bord sud. C'est
 * la profondeur (le pied de la case) qui trie : une case dessinee apres
 * recouvre la face de celle du nord, et les pans nord-sud font une colonne
 * continue sans qu'aucun dessin n'ait a le savoir.
 *
 * **Le poteau est plus large et plus haut que le pan.** C'est lui qui fait le
 * rythme d'un rempart — et c'est ce qui manquait au bloc, ou rien ne disait ou
 * une case finissait.
 *
 * Rien ici ne connait la grille ni Phaser, sauf la cuisson tout en bas.
 */

/** La case de la grille. */
export const CASE = 32;

/** Deux pixels sous le pied de tout ce qui est bati, comme dans `batiments.ts`. */
const MARGE_BASSE = 2;

// --------------------------------------------------------------- le raccord

/** Les quatre voisines, en bits. */
export const NORD = 1;
export const EST = 2;
export const SUD = 4;
export const OUEST = 8;

/** Le masque de raccord d'une case : quelles voisines sont des murs. */
export function masqueDe(nord: boolean, est: boolean, sud: boolean, ouest: boolean): number {
  return (nord ? NORD : 0) | (est ? EST : 0) | (sud ? SUD : 0) | (ouest ? OUEST : 0);
}

/** Les seize raccords. */
export const MASQUES: readonly number[] = Array.from({ length: 16 }, (_, i) => i);

// -------------------------------------------------------------- les matieres

/** Les trois matieres d'un rempart, dans l'ordre ou on l'ameliore (§4.20) — celles du noyau. */
export type MatiereMur = MatiereDuNoyau;

/** Les trois paliers de matiere. */
export const MATIERES_MUR: readonly MatiereMur[] = ["bois", "fer", "pierre"];

const MATIERE_MUR: Record<MatiereMur, Matiere> = {
  bois: BOIS,
  fer: FER,
  pierre: PIERRE,
};

/**
 * Les nombres d'une matiere : la largeur d'un pan, celle d'un poteau, la
 * hauteur de la face, et de combien le poteau depasse le pan.
 *
 * Un rempart s'epaissit et monte a chaque palier : c'est ce que le joueur a
 * paye, et il doit le voir de loin (§4.20).
 */
interface Profil {
  pan: number;
  poteau: number;
  hauteur: number;
  surplomb: number;
}

const PROFILS: Record<MatiereMur, Profil> = {
  bois: { pan: 12, poteau: 16, hauteur: 13, surplomb: 3 },
  fer: { pan: 14, poteau: 18, hauteur: 15, surplomb: 3 },
  pierre: { pan: 16, poteau: 20, hauteur: 17, surplomb: 4 },
};

/** La hauteur de la face de chaque matiere, pour les tests et la planche. */
export const HAUTEUR_MUR: Record<MatiereMur, number> = {
  bois: PROFILS.bois.hauteur,
  fer: PROFILS.fer.hauteur,
  pierre: PROFILS.pierre.hauteur,
};

// ------------------------------------------------------------------ le cadre

/**
 * Le cadre d'un mur : la case, plus ce qui monte au-dessus d'elle.
 *
 * Le plus haut est le poteau de pierre (17 + 4), pose sur le bord nord de la
 * case ; un pixel de plus pour son contour, et deux sous le pied.
 */
export const MUR = { largeur: CASE, hauteur: CASE + 17 + 4 + 1 + MARGE_BASSE } as const;

/** Ou tombe le sol dans la texture d'un mur : le bord sud de la case. */
const SOL_MUR = MUR.hauteur - MARGE_BASSE;

/**
 * L'origine verticale a donner au sprite d'un mur pour que **le centre de sa
 * case** tombe au milieu de son emprise au sol.
 */
export const ORIGINE_MUR_Y = (SOL_MUR - CASE / 2) / MUR.hauteur;

/**
 * Le dessus d'un element : sa matiere, a peine eclaircie.
 *
 * ⚠️ Vu en jeu : a 0,55 de clair, le dessus d'une palissade etait la chose la
 * plus claire de l'ecran — plus que les visages. Le dessus prend la lumiere,
 * il ne la vole pas.
 */
function dessusDe(m: Matiere): Matiere {
  return {
    sombre: m.sombre,
    corps: melanger(m.corps, m.clair, 0.22),
    clair: m.clair,
  };
}

/** Le pied de tout ce qui est bati : franc, et plus sombre que la matiere. */
function piedDe(m: Matiere): number {
  return melanger(m.sombre, PIERRE.sombre, 0.35);
}

// ---------------------------------------------------------------- les pieces

/**
 * Le repere d'une case dans sa texture : `y(g)` rend la ligne de la texture
 * ou tombe la ligne `g` du sol (0 au nord, 32 au sud).
 */
interface Repere {
  sol: number;
  y(g: number): number;
}

function repere(sol: number): Repere {
  return { sol, y: (g) => sol - CASE + g };
}

/**
 * Une face vue du sud : `hauteur` lignes au-dessus de la ligne de sol `g`,
 * claire en haut, sombre en bas, un pied franc.
 */
function face(
  toile: Toile,
  r: Repere,
  x: number,
  largeur: number,
  g: number,
  hauteur: number,
  m: Matiere,
): void {
  const haut = r.y(g) - hauteur;
  for (let j = 0; j < hauteur; j += 1) {
    const part = j / Math.max(1, hauteur - 1);
    toile.rect(x, haut + j, largeur, 1, part > 0.7 ? m.sombre : m.corps);
  }
  toile.rect(x, r.y(g) - 1, largeur, 1, piedDe(m));
}

/**
 * Un dessus : le rectangle du sol `[g0, g1)` souleve de `hauteur`, avec son
 * arete claire cote lumiere (nord et ouest) et sombre cote ombre (est).
 *
 * L'arete sud — la crete, celle qui touche la face — est **franchement
 * claire** : c'est elle qui separe le dessus de la face, et sans elle un mur
 * est une bande.
 */
function dessus(
  toile: Toile,
  r: Repere,
  x: number,
  largeur: number,
  g0: number,
  g1: number,
  hauteur: number,
  d: Matiere,
  crete: boolean,
): void {
  const haut = r.y(g0) - hauteur;
  const bas = r.y(g1) - hauteur;
  toile.rect(x, haut, largeur, bas - haut, d.corps);
  toile.rect(x, haut, 1, bas - haut, d.clair);
  toile.rect(x + largeur - 1, haut, 1, bas - haut, d.sombre);
  if (crete) toile.rect(x, bas - 1, largeur, 1, d.clair);
}

// ------------------------------------------------------------- les matieres

/** Les details d'une matiere : sur le dessus d'un pan, d'un poteau, sur une face. */
interface Style {
  /** Le dessus d'un pan, dans le rectangle donne (texture). */
  dessusPan(toile: Toile, x: number, y: number, largeur: number, hauteur: number, vertical: boolean): void;
  /** Le dessus d'un poteau. */
  dessusPoteau(toile: Toile, x: number, y: number, cote: number): void;
  /** Une face, dans le rectangle donne. */
  face(toile: Toile, x: number, y: number, largeur: number, hauteur: number): void;
  /** La crete d'une face — ce qui depasse du dessus, au bord sud. */
  crete(toile: Toile, x: number, y: number, largeur: number): void;
}

// ---- le bois : des pieux plantes, lies par une corde

const STYLE_BOIS: Style = {
  dessusPan(toile, x, y, largeur, hauteur) {
    // Vue d'en haut, une palissade est un champ de bouts de troncs : un point
    // de lumiere et son ombre, tous les quatre pixels, en quinconce.
    const d = dessusDe(BOIS);
    for (let j = 2; j < hauteur - 1; j += 4) {
      const decalage = (j / 4) % 2 === 0 ? 1 : 3;
      for (let i = decalage; i < largeur - 1; i += 4) {
        toile.point(x + i, y + j, d.clair);
        toile.point(x + i + 1, y + j + 1, d.sombre);
      }
    }
  },
  dessusPoteau(toile, x, y, cote) {
    // Quatre gros troncs : le poteau est un faisceau, pas un pieu de plus.
    const d = dessusDe(BOIS);
    const demi = Math.floor(cote / 2);
    toile.rect(x + demi, y + 1, 1, cote - 2, d.sombre);
    toile.rect(x + 1, y + demi, cote - 2, 1, d.sombre);
    for (const [i, j] of [
      [2, 2],
      [demi + 2, 2],
      [2, demi + 2],
      [demi + 2, demi + 2],
    ] as const) {
      toile.point(x + i, y + j, d.clair);
      toile.point(x + i + 1, y + j + 1, d.sombre);
    }
  },
  face(toile, x, y, largeur, hauteur) {
    const m = BOIS;
    const pas = 4;
    for (let i = 0; i < largeur; i += pas) {
      const l = Math.min(pas, largeur - i);
      toile.rect(x + i, y, 1, hauteur - 1, m.clair);
      if (l > 1) toile.rect(x + i + l - 1, y, 1, hauteur - 1, m.sombre);
    }
    // La corde qui les tient, a mi-hauteur.
    const corde = y + Math.floor(hauteur / 2);
    toile.rect(x, corde, largeur, 1, ECORCE.sombre);
    for (let i = 1; i < largeur; i += 4) toile.point(x + i, corde, ECORCE.clair);
  },
  crete(toile, x, y, largeur) {
    // Les pointes des pieux depassent du dessus, a des hauteurs inegales.
    for (let i = 1; i < largeur; i += 4) {
      const h = 1 + ((i * 7) % 3);
      toile.rect(x + i, y - h, 2, h, BOIS.corps);
      toile.point(x + i, y - h, BOIS.clair);
    }
  },
};

// ---- le fer : des plaques rivetees, herissees de pointes

const STYLE_FER: Style = {
  dessusPan(toile, x, y, largeur, hauteur, vertical) {
    const d = dessusDe(FER);
    // Un joint le long du pan, et un rivet de chaque cote tous les huit pixels.
    if (vertical) {
      const milieu = x + Math.floor(largeur / 2);
      toile.rect(milieu, y, 1, hauteur, d.sombre);
      for (let j = 3; j < hauteur; j += 8) {
        toile.point(x + 2, y + j, d.clair);
        toile.point(x + largeur - 3, y + j, d.clair);
      }
    } else {
      const milieu = y + Math.floor(hauteur / 2);
      toile.rect(x, milieu, largeur, 1, d.sombre);
      for (let i = 3; i < largeur; i += 8) {
        toile.point(x + i, y + 2, d.clair);
        toile.point(x + i, y + hauteur - 3, d.clair);
      }
    }
  },
  dessusPoteau(toile, x, y, cote) {
    // Une plaque carree, un rivet a chaque coin, un bossage au centre.
    const d = dessusDe(FER);
    for (const [i, j] of [
      [2, 2],
      [cote - 3, 2],
      [2, cote - 3],
      [cote - 3, cote - 3],
    ] as const) {
      toile.point(x + i, y + j, d.clair);
      toile.point(x + i + 1, y + j + 1, d.sombre);
    }
    const c = Math.floor(cote / 2);
    toile.rect(x + c - 2, y + c - 2, 4, 4, d.sombre);
    toile.rect(x + c - 2, y + c - 2, 3, 3, d.corps);
    toile.point(x + c - 2, y + c - 2, d.clair);
  },
  face(toile, x, y, largeur, hauteur) {
    const m = FER;
    // Les joints verticaux entre les plaques, et deux rangs de rivets.
    for (let i = 7; i < largeur - 1; i += 8) toile.rect(x + i, y, 1, hauteur - 1, m.sombre);
    for (const j of [3, hauteur - 5]) {
      if (j <= 0 || j >= hauteur - 1) continue;
      toile.rect(x, y + j, largeur, 1, m.sombre);
      for (let i = 3; i < largeur; i += 8) toile.point(x + i, y + j, m.clair);
    }
  },
  crete(toile, x, y, largeur) {
    // Les pointes, plantees dans l'arete avant.
    for (let i = 2; i < largeur - 1; i += 5) {
      toile.rect(x + i, y - 3, 1, 3, FER.clair);
      toile.point(x + i - 1, y - 1, FER.corps);
      toile.point(x + i + 1, y - 1, FER.corps);
    }
  },
};

// ---- la pierre : un appareil de blocs, un chemin de ronde crenele

const STYLE_PIERRE: Style = {
  dessusPan(toile, x, y, largeur, hauteur, vertical) {
    const d = dessusDe(PIERRE);
    // Les dalles du chemin de ronde, en rangs decales, et le parapet de chaque
    // cote : un pixel plus clair, un pixel plus sombre.
    if (vertical) {
      toile.rect(x + 1, y, 1, hauteur, d.sombre);
      toile.rect(x + largeur - 2, y, 1, hauteur, d.clair);
      for (let j = 5; j < hauteur; j += 6) toile.rect(x + 2, y + j, largeur - 4, 1, d.sombre);
    } else {
      toile.rect(x, y + 1, largeur, 1, d.sombre);
      toile.rect(x, y + hauteur - 2, largeur, 1, d.clair);
      for (let i = 5; i < largeur; i += 6) toile.rect(x + i, y + 2, 1, hauteur - 4, d.sombre);
    }
  },
  dessusPoteau(toile, x, y, cote) {
    // Une plateforme, et des merlons tout autour : la tourelle d'angle.
    const d = dessusDe(PIERRE);
    toile.rect(x + 2, y + 2, cote - 4, cote - 4, d.sombre);
    toile.rect(x + 3, y + 3, cote - 6, cote - 6, melanger(d.corps, d.sombre, 0.3));
    for (let i = 0; i < cote; i += 4) {
      toile.rect(x + i, y, 2, 2, d.clair);
      toile.rect(x + i, y + cote - 2, 2, 2, d.clair);
      toile.rect(x, y + i, 2, 2, d.clair);
      toile.rect(x + cote - 2, y + i, 2, 2, d.clair);
    }
  },
  face(toile, x, y, largeur, hauteur) {
    const m = PIERRE;
    // L'appareil : des rangs de blocs decales, jamais un quadrillage.
    const joint = melanger(m.sombre, m.corps, 0.5);
    for (let rang = 0; rang * 5 + 4 < hauteur - 1; rang += 1) {
      const j = y + 4 + rang * 5;
      toile.rect(x, j, largeur, 1, joint);
      const decalage = rang % 2 === 0 ? 0 : 4;
      for (let i = decalage + 3; i < largeur; i += 8) toile.rect(x + i, j - 4, 1, 4, m.sombre);
    }
  },
  crete(toile, x, y, largeur) {
    // Les merlons : trois pleins, deux creneaux, sur toute la longueur.
    for (let i = 0; i < largeur; i += 8) {
      const l = Math.min(5, largeur - i);
      toile.rect(x + i, y - 3, l, 3, PIERRE.corps);
      toile.rect(x + i, y - 3, l, 1, PIERRE.clair);
      toile.rect(x + i, y - 3, 1, 3, PIERRE.clair);
      toile.rect(x + i + l - 1, y - 3, 1, 3, PIERRE.sombre);
    }
  },
};

const STYLES: Record<MatiereMur, Style> = { bois: STYLE_BOIS, fer: STYLE_FER, pierre: STYLE_PIERRE };

// ------------------------------------------------------------------- le mur

/** La cle de texture d'un mur : sa matiere et son raccord. */
export function cleMur(matiere: MatiereMur, masque = 0): string {
  return `bati-mur-${matiere}-${masque}`;
}

/**
 * Peint un mur : un poteau, et un pan vers chaque voisine du masque.
 *
 * L'ordre de peinture est celui de la profondeur, du nord au sud : le pan
 * nord, les pans est et ouest avec leurs faces, le poteau, le pan sud. Tout ce
 * qui est plus au sud se peint apres, et recouvre.
 */
export function peindreMur(toile: Toile, matiere: MatiereMur, masque: number): void {
  peindreMurDans(toile, repere(SOL_MUR), matiere, masque);
}

function peindreMurDans(toile: Toile, r: Repere, matiere: MatiereMur, masque: number): void {
  const p = PROFILS[matiere];
  const m = MATIERE_MUR[matiere];
  const d = dessusDe(m);
  const s = STYLES[matiere];
  const H = p.hauteur;
  const cx = CASE / 2;
  const a0 = cx - p.pan / 2;
  const a1 = cx + p.pan / 2;
  const q0 = cx - p.poteau / 2;
  const q1 = cx + p.poteau / 2;

  // Le pan nord : du bord de la case jusqu'au poteau. Pas de face — c'est le
  // poteau qui est devant.
  if (masque & NORD) {
    dessus(toile, r, a0, p.pan, 0, q0 + 1, H, d, false);
    s.dessusPan(toile, a0, r.y(0) - H, p.pan, q0 + 1, true);
  }

  // Les pans est et ouest : leur dessus, leur face, et ce qui depasse de la crete.
  for (const cote of [OUEST, EST] as const) {
    if (!(masque & cote)) continue;
    const x = cote === OUEST ? 0 : q1 - 1;
    const largeur = cote === OUEST ? q0 + 1 : CASE - q1 + 1;
    face(toile, r, x, largeur, a1, H, m);
    s.face(toile, x, r.y(a1) - H, largeur, H);
    dessus(toile, r, x, largeur, a0, a1, H, d, true);
    s.dessusPan(toile, x, r.y(a0) - H, largeur, p.pan, false);
    s.crete(toile, x, r.y(a1) - H, largeur);
  }

  // Le poteau : plus large et plus haut. Sa face est entiere ; le pan sud, s'il
  // y en a un, en recouvrira le milieu — et la case du sud le reste.
  const HP = H + p.surplomb;
  face(toile, r, q0, p.poteau, q1, HP, m);
  s.face(toile, q0, r.y(q1) - HP, p.poteau, HP);
  dessus(toile, r, q0, p.poteau, q0, q1, HP, d, true);
  s.dessusPoteau(toile, q0, r.y(q0) - HP, p.poteau);

  // Le pan sud : du poteau jusqu'au bord de la case. Sa face tombe sur le bord
  // sud, la ou la case suivante posera son dessus.
  if (masque & SUD) {
    face(toile, r, a0, p.pan, CASE, H, m);
    dessus(toile, r, a0, p.pan, q1 - 1, CASE, H, d, false);
    s.dessusPan(toile, a0, r.y(q1 - 1) - H, p.pan, CASE - q1 + 1, true);
  }
}

// ----------------------------------------------------------------- la ruine

/** La ruine d'un mur : ce qu'il en reste quand la palissade est tombee. */
export const CLE_MUR_RUINE = "bati-mur-ruine";

/**
 * Une palissade effondree : des moignons de pieux de hauteurs inegales autour
 * de l'ancien poteau, un pieu couche a plat, des echardes. Pas de dessus, pas
 * de pan — c'est le sol qu'on voit entre les restes.
 *
 * ⚠️ Plus de pieux « couches en travers » traces en diagonale : vus en jeu,
 * c'etaient des antennes qui sortaient du mur. Un pieu tombe est a plat, et il
 * est plus sombre que ce qui tient debout.
 */
export function peindreMurRuine(toile: Toile, variante: number): void {
  const r = repere(SOL_MUR);
  const m = BOIS;
  const cx = CASE / 2;

  // Les moignons : autour du poteau, sur deux rangs.
  const moignons: Array<[number, number, number]> = [
    [cx - 7, 12, 4],
    [cx - 3, 13, 6],
    [cx + 2, 12, 3],
    [cx + 5, 14, 5],
    [cx - 5, 18, 2],
    [cx + 1, 19, 4],
  ];
  for (const [i, [x, g, h]] of moignons.entries()) {
    const haut = h + ((i + variante) % 3 === 0 ? 1 : 0);
    // Le dessus du moignon, casse, puis sa face.
    toile.rect(x, r.y(g) - haut, 3, haut, m.corps);
    toile.rect(x, r.y(g) - haut, 1, haut, m.clair);
    toile.rect(x + 2, r.y(g) - haut, 1, haut, m.sombre);
    toile.point(x + 1, r.y(g) - haut - 1, ECORCE.clair);
    toile.rect(x, r.y(g) - 1, 3, 1, piedDe(m));
  }

  // Un pieu couche a plat, le long du sol, et quelques echardes.
  const gy = r.y(24 + (variante % 2) * 2);
  toile.rect(cx - 9, gy, 14, 2, ECORCE.corps);
  toile.rect(cx - 9, gy, 14, 1, ECORCE.clair);
  toile.point(cx + 5, gy + 1, ECORCE.sombre);
  toile.point(cx - 11, r.y(9), ECORCE.sombre);
  toile.point(cx + 9, r.y(27), ECORCE.sombre);
  toile.point(cx + 10, r.y(8), ECORCE.corps);
}

// ------------------------------------------------------------------ la tour

/**
 * La tour de guet : une case entiere au sol, et elle monte (§4.20).
 *
 * Elle occupe **toute sa case** : c'est ce qui fait qu'un pan de mur voisin
 * vient buter contre son flanc sans qu'il y ait de trou, quelle que soit la
 * matiere du mur. Plus haute que le plus haut des murs, un socle de pierre, un
 * parapet crenele, une porte au pied — **et rien dessus** : la place est celle
 * de l'occupant, et c'est lui qui la rend utile.
 */
/**
 * Vingt-quatre depuis le 20 septembre 2026 (trente avant) : une tour de trente
 * couvrait toute la case derriere elle, et une douve qui y passait semblait
 * s'arreter sous la tour — « les tours empietent sur les douves » (Angelos).
 */
export const HAUTEUR_TOUR = 24;
export const TOUR = { largeur: CASE, hauteur: CASE + HAUTEUR_TOUR + 3 + 1 + MARGE_BASSE } as const;
export const CLE_TOUR = "bati-tour";
const SOL_TOUR = TOUR.hauteur - MARGE_BASSE;
export const ORIGINE_TOUR_Y = (SOL_TOUR - CASE / 2) / TOUR.hauteur;

/**
 * Ou l'occupant se tient, par rapport au centre de la case : au milieu du
 * dessus de la tour, le pied sur la plateforme. Le centre d'un sprite de
 * personnage est sept pixels au-dessus de ses pieds (`corps.ts`).
 */
export const OCCUPANT_TOUR_Y = -HAUTEUR_TOUR - 7;

export function peindreTour(toile: Toile): void {
  const r = repere(SOL_TOUR);
  const m = PIERRE;
  const d = dessusDe(m);
  const H = HAUTEUR_TOUR;

  // La face, sur toute la largeur, avec l'appareil de la pierre.
  face(toile, r, 0, CASE, CASE, H, m);
  STYLE_PIERRE.face(toile, 0, r.y(CASE) - H, CASE, H);
  // Un cordon a mi-hauteur, et une porte au pied.
  toile.rect(0, r.y(CASE) - H + 12, CASE, 1, m.clair);
  toile.rect(0, r.y(CASE) - H + 13, CASE, 1, m.sombre);
  toile.rect(13, r.y(CASE) - 9, 6, 8, melanger(PIERRE.sombre, FER.sombre, 0.6));
  toile.rect(13, r.y(CASE) - 9, 6, 1, m.clair);
  toile.rect(14, r.y(CASE) - 10, 4, 1, m.clair);
  // Une meurtriere, haut dans la face.
  toile.rect(15, r.y(CASE) - H + 4, 2, 5, melanger(PIERRE.sombre, FER.sombre, 0.6));

  // Le dessus : la plateforme, creusee entre les merlons du parapet.
  dessus(toile, r, 0, CASE, 0, CASE, H, d, true);
  toile.rect(3, r.y(0) - H + 3, CASE - 6, CASE - 6, melanger(d.corps, d.sombre, 0.35));
  toile.rect(3, r.y(0) - H + 3, CASE - 6, 1, d.sombre);
  toile.rect(3, r.y(0) - H + 3, 1, CASE - 6, d.sombre);
  // Les dalles de la plateforme.
  for (let j = 8; j < CASE - 4; j += 6) toile.rect(4, r.y(0) - H + j, CASE - 8, 1, d.sombre);
  // Les merlons, tout autour.
  for (let i = 0; i < CASE; i += 5) {
    toile.rect(i, r.y(0) - H, 3, 3, d.clair);
    toile.rect(i, r.y(CASE) - H - 3, 3, 3, d.clair);
    toile.rect(0, r.y(0) - H + i, 3, 3, d.clair);
    toile.rect(CASE - 3, r.y(0) - H + i, 3, 3, d.clair);
  }
  // Et ceux du bord sud montent au-dessus de la crete, comme sur un mur.
  STYLE_PIERRE.crete(toile, 0, r.y(CASE) - H, CASE);
}

// ----------------------------------------------------------------- la porte

/**
 * La porte (§4.20) : l'ouverture par laquelle on sort travailler et on rentre,
 * et le point faible qu'on a choisi soi-meme.
 *
 * Elle prend une case de mur. **Ce sont les poteaux des cases voisines qui lui
 * servent de montants** : la porte ne dessine que ce qui est a elle — le
 * linteau qui prolonge les pans, et les deux vantaux. Ouverte, on voit le sol
 * a travers ; fermee, les vantaux barrent le passage ; **entrouverte**, ils
 * sont a mi-course — c'est les deux secondes du §4.20, ou l'on ne passe pas
 * encore (bloc 7b, 20 septembre 2026).
 *
 * Elle se lit dans les deux sens : dans un mur est-ouest, la face montre
 * l'arche et les vantaux ; dans un mur nord-sud, on voit d'en haut la poutre
 * qui franchit le passage, et les vantaux fermes font une ligne en travers.
 *
 * **Le pont-levis** est une porte de plus : pas de vantaux, un tablier de
 * planches qui se **leve** dans l'ouverture (ferme) ou s'abat sur la douve
 * devant (ouvert — c'est alors la douve qui porte les planches, voir
 * `peindreDouve`). Deux chaines le tiennent aux coins du linteau.
 */
export const PORTE = MUR;
export const ORIGINE_PORTE_Y = ORIGINE_MUR_Y;

/** Ce qu'une porte montre : ouverte, a mi-course, ou fermee. */
export type PositionPorte = "ouverte" | "entrouverte" | "fermee";

export const POSITIONS_PORTE: readonly PositionPorte[] = ["ouverte", "entrouverte", "fermee"];

export function clePorte(
  matiere: MatiereMur,
  masque: number,
  position: PositionPorte,
  pontLevis = false,
): string {
  return `bati-${pontLevis ? "pont-levis" : "porte"}-${matiere}-${sensDePorte(masque)}-${position}`;
}

/** Le sens d'une porte, d'apres ses voisines : est-ouest sauf si elle est prise entre un nord et un sud. */
export function sensDePorte(masque: number): "est-ouest" | "nord-sud" {
  const ns = (masque & NORD) !== 0 || (masque & SUD) !== 0;
  const eo = (masque & EST) !== 0 || (masque & OUEST) !== 0;
  return ns && !eo ? "nord-sud" : "est-ouest";
}

/** Le bois d'un vantail ou d'un tablier : du bois vieilli par l'ecorce. */
const BATTANT = melanger(BOIS.corps, ECORCE.corps, 0.4);

/** Les chaines d'un pont-levis, en fer clair : deux pixels de biais par maillon. */
function chaine(toile: Toile, x0: number, y0: number, x1: number, y1: number): void {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  for (let i = 0; i <= n; i += 1) {
    const x = Math.round(x0 + ((x1 - x0) * i) / n);
    const y = Math.round(y0 + ((y1 - y0) * i) / n);
    toile.point(x, y, i % 2 === 0 ? FER.clair : FER.sombre);
  }
}

export function peindrePorte(
  toile: Toile,
  matiere: MatiereMur,
  sens: "est-ouest" | "nord-sud",
  position: PositionPorte,
  pontLevis = false,
): void {
  const r = repere(SOL_MUR);
  const p = PROFILS[matiere];
  const m = MATIERE_MUR[matiere];
  const d = dessusDe(m);
  const s = STYLES[matiere];
  const H = p.hauteur;
  const cx = CASE / 2;
  const a0 = cx - p.pan / 2;
  const a1 = cx + p.pan / 2;
  const ferrure = FER.clair;

  if (sens === "est-ouest") {
    // Les montants : cinq pixels de chaque cote, de la matiere du mur. Assez
    // pour encadrer le passage — a trois, c'etait un trou dans le mur.
    const montant = 5;
    const ouverture0 = montant;
    const ouverture1 = CASE - montant;
    const largeur = ouverture1 - ouverture0;
    for (const x of [0, CASE - montant]) {
      face(toile, r, x, montant, a1, H, m);
    }
    // Le linteau : la face du pan continue au-dessus de l'arche, sur trois
    // lignes, puis l'arche elle-meme est vide — c'est le sol qu'on voit.
    const hautFace = r.y(a1) - H;
    toile.rect(0, hautFace, CASE, 4, m.corps);
    toile.rect(0, hautFace + 3, CASE, 1, m.sombre);
    // Le cintre : un pixel de plus a chaque coin.
    toile.point(ouverture0, hautFace + 4, m.corps);
    toile.point(ouverture1 - 1, hautFace + 4, m.corps);

    const hautVantail = hautFace + 4;
    const hauteurVantail = H - 5;

    if (pontLevis) {
      // Le tablier : leve, il bouche l'ouverture comme un mur de planches ;
      // a mi-course on n'en voit que le haut, qui bascule ; baisse, il est
      // sur la douve et l'ouverture est vide.
      const part = position === "fermee" ? 1 : position === "entrouverte" ? 0.55 : 0;
      const h = Math.round(hauteurVantail * part);
      if (h > 0) {
        const haut = r.y(a1) - 1 - h;
        toile.rect(ouverture0, haut, largeur, h, BATTANT);
        for (let j = 1; j < h; j += 3) toile.rect(ouverture0, haut + j, largeur, 1, BOIS.sombre);
        toile.rect(ouverture0, haut, largeur, 1, BOIS.clair);
        // Deux traverses de fer, comme les bandes d'un vantail.
        toile.rect(ouverture0 + 2, haut, 1, h, FER.corps);
        toile.rect(ouverture1 - 3, haut, 1, h, FER.corps);
      }
      // Les chaines, des coins du linteau au bord haut du tablier — ou
      // tendues vers le bas quand il est couche sur la douve.
      const yBout = h > 0 ? r.y(a1) - 1 - h : r.y(a1) - 1;
      chaine(toile, ouverture0 + 1, hautFace + 1, ouverture0 + 2, yBout);
      chaine(toile, ouverture1 - 2, hautFace + 1, ouverture1 - 3, yBout);
      // Le treuil : deux pixels de fer sur le linteau, de chaque cote.
      toile.point(ouverture0, hautFace + 1, ferrure);
      toile.point(ouverture1 - 1, hautFace + 1, ferrure);
    } else if (position === "ouverte") {
      // Les vantaux rabattus contre les montants : deux planches de chant.
      for (const x of [ouverture0, ouverture1 - 2]) {
        toile.rect(x, hautVantail, 2, hauteurVantail, BATTANT);
        toile.rect(x, hautVantail, 1, hauteurVantail, BOIS.clair);
        toile.point(x, hautFace + 6, ferrure);
        toile.point(x, r.y(a1) - 4, ferrure);
      }
    } else {
      // Les vantaux : fermes, des planches verticales d'un montant a l'autre,
      // deux bandes de fer, et le jour entre les deux battants ; entrouverts,
      // chaque battant ne couvre plus que les deux cinquiemes de l'ouverture,
      // et le sol se voit au milieu.
      const couvert = position === "fermee" ? largeur / 2 : Math.round(largeur * 0.4);
      for (const [x, gauche] of [
        [ouverture0, true],
        [ouverture1 - couvert, false],
      ] as const) {
        toile.rect(x, hautVantail, couvert, hauteurVantail, BATTANT);
        for (let i = 0; i < couvert; i += 3) toile.rect(x + i, hautVantail, 1, hauteurVantail, BOIS.sombre);
        // Le chant du battant, cote ouverture : il se lit entrouvert.
        toile.rect(gauche ? x + couvert - 1 : x, hautVantail, 1, hauteurVantail, ECORCE.sombre);
        for (const j of [hautFace + 6, r.y(a1) - 5]) {
          toile.rect(x, j, couvert, 1, FER.corps);
          toile.point(gauche ? x + 2 : x + couvert - 3, j, ferrure);
        }
        toile.rect(x, r.y(a1) - 1, couvert, 1, piedDe(m));
      }
    }

    // Le dessus du pan, d'un bord a l'autre, et sa crete.
    dessus(toile, r, 0, CASE, a0, a1, H, d, true);
    s.dessusPan(toile, 0, r.y(a0) - H, CASE, p.pan, false);
    s.crete(toile, 0, r.y(a1) - H, CASE);
    return;
  }

  // Nord-sud : deux bouts de pan au nord et au sud, une poutre qui franchit le
  // passage, et les vantaux fermes en travers.
  const bout = 4;
  // Le bout nord : son dessus, et sa face qui donne sur le passage.
  face(toile, r, a0, p.pan, bout, H, m);
  s.face(toile, a0, r.y(bout) - H, p.pan, H);
  dessus(toile, r, a0, p.pan, 0, bout, H, d, true);

  const longueur = CASE - bout * 2;
  if (pontLevis) {
    // Vu d'en haut : leve, le tablier est une cloison de planches en travers,
    // avec ses deux chaines ; baisse, la poutre seule, et les planches sont
    // sur la douve.
    // ⚠️ Un tablier leve vu d'en haut n'etait qu'un trait de quatre pixels :
    // « les ponts-levis doivent se voir meme releves » (Angelos, 20 septembre
    // 2026). Leve, il est dessine **large** — douze pixels de planches en
    // travers du passage, un bord clair, un flanc sombre —, pour se lire
    // comme une cloison dressee et non comme la poutre du linteau.
    const part = position === "fermee" ? 1 : position === "entrouverte" ? 0.55 : 0;
    const epaisseur = Math.round(12 * part);
    toile.rect(cx - 2, r.y(bout) - H, 4, longueur, ECORCE.corps);
    toile.rect(cx - 2, r.y(bout) - H, 1, longueur, ECORCE.clair);
    if (epaisseur > 0) {
      const x0 = cx - Math.floor(epaisseur / 2);
      toile.rect(x0, r.y(bout) - H, epaisseur, longueur, BATTANT);
      toile.rect(x0, r.y(bout) - H, 1, longueur, BOIS.clair);
      toile.rect(x0 + epaisseur - 1, r.y(bout) - H, 1, longueur, BOIS.sombre);
      // Les planches, en long ; les traverses de fer, en travers.
      for (let px = x0 + 3; px < x0 + epaisseur - 1; px += 3) toile.rect(px, r.y(bout) - H, 1, longueur, BOIS.sombre);
      for (let g = bout + 3; g < CASE - bout; g += 5) toile.rect(x0, r.y(g) - H, epaisseur, 1, FER.corps);
    }
    chaine(toile, cx - 2, r.y(bout) - H, cx + 2, r.y(bout) - H + 2);
    chaine(toile, cx - 2, r.y(CASE - bout) - H - 1, cx + 2, r.y(CASE - bout) - H - 3);
  } else if (position === "ouverte") {
    // La poutre du linteau, vue d'en haut : etroite, a la hauteur du mur.
    toile.rect(cx - 2, r.y(bout) - H, 4, longueur, ECORCE.corps);
    toile.rect(cx - 2, r.y(bout) - H, 1, longueur, ECORCE.clair);
    toile.rect(cx + 1, r.y(bout) - H, 1, longueur, ECORCE.sombre);
  } else {
    // Les vantaux : fermes, une cloison de planches en travers du passage,
    // dont on voit le dessus etroit ; entrouverts, deux bouts de cloison qui
    // partent des bouts, et le passage libre au milieu.
    const couvert = position === "fermee" ? longueur : Math.round(longueur * 0.32);
    for (const y of position === "fermee" ? [r.y(bout) - H] : [r.y(bout) - H, r.y(CASE - bout) - H - couvert]) {
      toile.rect(cx - 2, y, 4, couvert, BATTANT);
      toile.rect(cx - 2, y, 1, couvert, BOIS.clair);
      toile.rect(cx + 1, y, 1, couvert, BOIS.sombre);
      for (let j = 3; j < couvert; j += 4) toile.rect(cx - 2, y + j, 4, 1, FER.corps);
    }
  }

  // Le bout sud : son dessus ; sa face tombe sur le bord de la case.
  face(toile, r, a0, p.pan, CASE, H, m);
  dessus(toile, r, a0, p.pan, CASE - bout, CASE, H, d, false);
}

// ----------------------------------------------------------------- la douve

/**
 * La douve (§4.20, bloc 7b) : un fosse creuse devant le mur. **A plat**, dans
 * la case, sans dessus ni face : c'est un trou, pas un volume. Elle regarde ses
 * voisines comme un mur — la ou une autre douve la continue, il n'y a pas de
 * bord ; la ou il n'y en a pas, on voit la levre du fosse.
 *
 * Trois etats : **seche** (la terre retournee des parois, le fond dans
 * l'ombre), **en eau** (l'eau du monde, avec ses reflets), et **en eau sous
 * un pont** — les planches du pont-levis baisse, en travers du fosse.
 */
export type EtatDouve = "seche" | "eau" | "pont";

export const ETATS_DOUVE: readonly EtatDouve[] = ["seche", "eau", "pont"];

export const DOUVE = { largeur: CASE, hauteur: CASE } as const;

export function cleDouve(masque: number, etat: EtatDouve): string {
  return `bati-douve-${etat}-${masque}`;
}

/**
 * Le sens dans lequel un pont franchit une douve : en travers du fosse. Une
 * douve qui court est-ouest se franchit du nord au sud.
 */
export function sensDuPont(masque: number): "nord-sud" | "est-ouest" {
  const eo = (masque & EST) !== 0 || (masque & OUEST) !== 0;
  const ns = (masque & NORD) !== 0 || (masque & SUD) !== 0;
  return ns && !eo ? "est-ouest" : "nord-sud";
}

export function peindreDouve(toile: Toile, masque: number, etat: EtatDouve): void {
  // Les parois : la terre battue qu'on a retournee, comme un cratere ; le
  // fond, la terre froide et sombre du fond d'un trou. La levre du fosse est
  // claire au nord et a l'ouest (la lumiere vient de la), sombre au sud et a
  // l'est — c'est ce qui fait lire un creux et pas une dalle.
  const paroi = TERRE;
  const fond = CRATERE;
  const levre = 2;

  toile.rect(0, 0, CASE, CASE, paroi.corps);
  // Le grain des parois : des mottes sombres et claires en quinconce.
  for (let j = 1; j < CASE; j += 3) {
    for (let i = ((j / 3) % 2 === 0 ? 1 : 2); i < CASE; i += 4) {
      toile.point(i, j, (i + j) % 8 < 4 ? paroi.sombre : paroi.clair);
    }
  }
  // Le fond : un rectangle en retrait de chaque bord qui n'est pas continue.
  const x0 = masque & OUEST ? 0 : 6;
  const x1 = masque & EST ? CASE : CASE - 6;
  const y0 = masque & NORD ? 0 : 6;
  const y1 = masque & SUD ? CASE : CASE - 6;
  toile.rect(x0, y0, x1 - x0, y1 - y0, fond.corps);

  if (etat === "seche") {
    // Le fond sec : des mottes, des cailloux, et l'ombre de la paroi nord.
    for (let j = y0 + 1; j < y1; j += 3) {
      for (let i = x0 + ((j / 3) % 2 === 0 ? 0 : 2); i < x1; i += 4) {
        toile.point(i, j, (i * 5 + j * 3) % 7 < 3 ? fond.sombre : fond.clair);
      }
    }
    if (!(masque & NORD)) toile.rect(x0, y0, x1 - x0, 3, fond.sombre);
    if (!(masque & OUEST)) toile.rect(x0, y0, 2, y1 - y0, fond.sombre);
    for (let i = x0 + 2; i < x1 - 1; i += 6) toile.point(i, y0 + 4 + ((i * 7) % 4) * 3, ROCHE.clair);
  } else {
    // L'eau : le corps de l'eau du monde, un liseret sombre sous la paroi
    // nord, et des reflets clairs en biais, comme sur la mer.
    toile.rect(x0, y0, x1 - x0, y1 - y0, EAU.corps);
    if (!(masque & NORD)) toile.rect(x0, y0, x1 - x0, 1, EAU.sombre);
    for (let j = y0 + 3; j < y1 - 1; j += 5) {
      const decalage = ((j / 5) % 2) * 3;
      for (let i = x0 + 1 + decalage; i < x1 - 3; i += 7) toile.rect(i, j, 3, 1, EAU.clair);
    }
  }

  // Les levres : sur chaque bord qui n'est pas continue, deux pixels de sol
  // souleve, clairs cote lumiere, sombres cote ombre.
  if (!(masque & NORD)) toile.rect(0, 0, CASE, levre, paroi.clair);
  if (!(masque & OUEST)) toile.rect(0, 0, levre, CASE, paroi.clair);
  if (!(masque & SUD)) toile.rect(0, CASE - levre, CASE, levre, paroi.sombre);
  if (!(masque & EST)) toile.rect(CASE - levre, 0, levre, CASE, paroi.sombre);

  if (etat !== "pont") return;

  // Le tablier du pont-levis, couche en travers : une bande de planches, avec
  // ses deux longerons et son bord d'ombre sur l'eau.
  const largeurPont = 20;
  const p0 = CASE / 2 - largeurPont / 2;
  if (sensDuPont(masque) === "nord-sud") {
    toile.rect(p0 + 1, 0, largeurPont - 2, CASE, melanger(EAU.sombre, C.fer, 0.4));
    toile.rect(p0, 0, largeurPont, CASE - 1, BATTANT);
    for (let j = 0; j < CASE; j += 3) toile.rect(p0, j, largeurPont, 1, BOIS.sombre);
    toile.rect(p0, 0, 2, CASE - 1, BOIS.clair);
    toile.rect(p0 + largeurPont - 2, 0, 2, CASE - 1, ECORCE.sombre);
  } else {
    toile.rect(0, p0 + 1, CASE, largeurPont - 2, melanger(EAU.sombre, C.fer, 0.4));
    toile.rect(0, p0, CASE, largeurPont - 1, BATTANT);
    for (let i = 0; i < CASE; i += 3) toile.rect(i, p0, 1, largeurPont - 1, BOIS.sombre);
    toile.rect(0, p0, CASE, 1, BOIS.clair);
    toile.rect(0, p0 + largeurPont - 3, CASE, 2, ECORCE.sombre);
  }
}

// --------------------------------------------------------------- la cuisson

/**
 * Cuit l'enceinte entiere : 48 murs, 18 portes, 18 ponts-levis, 48 douves,
 * la ruine, la tour.
 *
 * @returns le nombre de textures produites.
 */
export function cuireLesMurs(scene: Phaser.Scene): number {
  let compte = 0;
  const graver = (cle: string, largeur: number, hauteur: number, tracer: (t: Toile) => void) => {
    if (scene.textures.exists(cle)) return;
    const toile = new Toile(largeur, hauteur);
    tracer(toile);
    toile.contour();
    const texture = scene.textures.createCanvas(cle, largeur, hauteur);
    if (!texture) return;
    texture.getContext().putImageData(toile.versImageData(), 0, 0);
    texture.refresh();
    compte += 1;
  };

  for (const matiere of MATIERES_MUR) {
    for (const masque of MASQUES) {
      graver(cleMur(matiere, masque), MUR.largeur, MUR.hauteur, (t) => peindreMur(t, matiere, masque));
    }
    for (const sens of ["est-ouest", "nord-sud"] as const) {
      const masque = sens === "est-ouest" ? EST | OUEST : NORD | SUD;
      for (const position of POSITIONS_PORTE) {
        for (const pontLevis of [false, true]) {
          graver(clePorte(matiere, masque, position, pontLevis), PORTE.largeur, PORTE.hauteur, (t) =>
            peindrePorte(t, matiere, sens, position, pontLevis),
          );
        }
      }
    }
  }
  for (const etat of ETATS_DOUVE) {
    for (const masque of MASQUES) {
      graver(cleDouve(masque, etat), DOUVE.largeur, DOUVE.hauteur, (t) => peindreDouve(t, masque, etat));
    }
  }
  graver(CLE_MUR_RUINE, MUR.largeur, MUR.hauteur, (t) => peindreMurRuine(t, 0));
  graver(CLE_TOUR, TOUR.largeur, TOUR.hauteur, peindreTour);
  return compte;
}
