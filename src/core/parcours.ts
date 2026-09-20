/**
 * Le parcours des monstres (DESIGN.md §4.6, §4.29 — 20 septembre 2026).
 *
 * Jusqu'ici un monstre marchait **droit** sur l'eglise : la mer et la
 * montagne etaient hors du rectangle praticable, et rien ne pouvait se trouver
 * entre le bord et le village. Depuis qu'un monde peut avoir un lac ou un
 * massif au milieu, et une douve en eau tout autour du village, la ligne
 * droite ne suffit plus : il faut **contourner**.
 *
 * C'est un champ de directions : une propagation depuis l'eglise sur toute la
 * grille (~3000 cases), en huit voisins, qui note pour chaque case **vers ou
 * aller** pour se rapprocher. Un monstre lit la case sous ses pieds et suit.
 *
 * Ce qui passe et ce qui ne passe pas est decide par l'appelant, case par
 * case : la terre ferme passe, l'eau et la roche non ; les murs **passent**
 * — un monstre qui rencontre un mur le frappe, il ne le contourne pas (§4.6),
 * sinon une enceinte fermee ne serait jamais attaquee ; une douve en eau ne
 * passe pas, sauf sous un pont-levis baisse (§4.20).
 *
 * Il ne se recalcule **qu'a la pose** — a la mise en eau d'une douve, a un
 * pont qui se leve —, jamais par image (§4.17). Ce fichier ne connait pas
 * Phaser.
 */

import { CASE, COLONNES, LIGNES, type Point } from "./carte";
import type { Case, Grille } from "./grille";

/** Les huit voisines : dx, dy. Les quatre droites d'abord, elles sont moins cheres. */
const VOISINES: readonly (readonly [number, number])[] = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
  [1, -1],
  [1, 1],
  [-1, 1],
  [-1, -1],
];

export class Parcours {
  /** Pour chaque case, l'index de la case vers laquelle aller ; -1 si aucune. */
  private readonly suivante = new Int32Array(COLONNES * LIGNES).fill(-1);
  /** La distance en pas depuis la cible ; -1 si inatteignable. */
  private readonly distance = new Int32Array(COLONNES * LIGNES).fill(-1);
  private readonly cout = new Float32Array(COLONNES * LIGNES);

  constructor(private readonly grille: Grille) {}

  /**
   * Recalcule le champ vers une cible.
   *
   * @param passe dit si une case laisse passer un monstre
   */
  recalculer(cible: Point, passe: (c: Case) => boolean): void {
    const suivante = this.suivante;
    const distance = this.distance;
    const cout = this.cout;
    suivante.fill(-1);
    distance.fill(-1);
    cout.fill(Infinity);

    const passable = new Uint8Array(COLONNES * LIGNES);
    for (let l = 0; l < LIGNES; l++) {
      for (let c = 0; c < COLONNES; c++) {
        const cas = this.grille.case(c, l);
        passable[l * COLONNES + c] = cas && passe(cas) ? 1 : 0;
      }
    }

    const depart = this.grille.ligneDe(cible.y) * COLONNES + this.grille.colonneDe(cible.x);
    if (depart < 0 || depart >= COLONNES * LIGNES) return;

    // Dijkstra sur une grille avec deux couts (1 et racine de 2) : une file a
    // deux seaux suffirait, mais la grille est petite — un tas simple fait
    // l'affaire et reste lisible.
    const tas: number[] = [depart];
    cout[depart] = 0;
    distance[depart] = 0;
    const cle = (i: number) => cout[i]!;
    const monter = (k: number) => {
      while (k > 0) {
        const parent = (k - 1) >> 1;
        if (cle(tas[parent]!) <= cle(tas[k]!)) break;
        [tas[parent], tas[k]] = [tas[k]!, tas[parent]!];
        k = parent;
      }
    };
    const descendre = () => {
      let k = 0;
      for (;;) {
        const g = 2 * k + 1;
        const d = g + 1;
        let m = k;
        if (g < tas.length && cle(tas[g]!) < cle(tas[m]!)) m = g;
        if (d < tas.length && cle(tas[d]!) < cle(tas[m]!)) m = d;
        if (m === k) break;
        [tas[m], tas[k]] = [tas[k]!, tas[m]!];
        k = m;
      }
    };
    const vus = new Uint8Array(COLONNES * LIGNES);
    while (tas.length > 0) {
      const i = tas[0]!;
      const dernier = tas.pop()!;
      if (tas.length > 0) {
        tas[0] = dernier;
        descendre();
      }
      if (vus[i]) continue;
      vus[i] = 1;
      const c = i % COLONNES;
      const l = (i - c) / COLONNES;
      for (const [dc, dl] of VOISINES) {
        const cc = c + dc;
        const ll = l + dl;
        if (cc < 0 || ll < 0 || cc >= COLONNES || ll >= LIGNES) continue;
        const j = ll * COLONNES + cc;
        if (!passable[j]) continue;
        // En diagonale seulement si les deux droites passent : on ne coupe pas
        // le coin d'un lac.
        if (dc !== 0 && dl !== 0 && (!passable[l * COLONNES + cc] || !passable[ll * COLONNES + c])) continue;
        const pas = dc !== 0 && dl !== 0 ? Math.SQRT2 : 1;
        const nouveau = cout[i]! + pas;
        if (nouveau >= cout[j]!) continue;
        cout[j] = nouveau;
        distance[j] = distance[i]! + 1;
        suivante[j] = i;
        tas.push(j);
        monter(tas.length - 1);
      }
    }

    // Les cases qui ne passent pas mais touchent une case atteinte : on en
    // sort vers elle. Un monstre repousse dans l'eau ou dans un fosse en
    // ressort, au lieu d'y rester plante. De proche en proche, pour l'eau
    // profonde. Ces cases ne sont pas « atteignables » pour autant : leur
    // distance reste a -1, seule la direction de sortie est ecrite.
    const sortie = new Uint8Array(COLONNES * LIGNES);
    const file: number[] = [];
    for (let i = 0; i < COLONNES * LIGNES; i++) if (distance[i]! >= 0) file.push(i);
    let tete = 0;
    while (tete < file.length) {
      const i = file[tete++]!;
      const c = i % COLONNES;
      const l = (i - c) / COLONNES;
      for (const [dc, dl] of VOISINES) {
        const cc = c + dc;
        const ll = l + dl;
        if (cc < 0 || ll < 0 || cc >= COLONNES || ll >= LIGNES) continue;
        const j = ll * COLONNES + cc;
        if (distance[j]! >= 0 || sortie[j] || passable[j]) continue;
        sortie[j] = 1;
        suivante[j] = i;
        file.push(j);
      }
    }
  }

  /** La case du point, ou -1 hors de la carte. */
  private indexDe(x: number, y: number): number {
    const c = Math.floor(x / CASE);
    const l = Math.floor(y / CASE);
    if (c < 0 || l < 0 || c >= COLONNES || l >= LIGNES) return -1;
    return l * COLONNES + c;
  }

  /** Y a-t-il un chemin d'ici a la cible ? */
  atteignable(x: number, y: number): boolean {
    const i = this.indexDe(x, y);
    return i >= 0 && this.distance[i]! >= 0;
  }

  /** Le nombre de pas jusqu'a la cible, ou -1. */
  pasDepuis(x: number, y: number): number {
    const i = this.indexDe(x, y);
    return i < 0 ? -1 : this.distance[i]!;
  }

  /**
   * Vers ou aller depuis ce point : un vecteur unitaire vers le centre de la
   * case suivante, ou null s'il n'y a pas de chemin (ou qu'on est arrive).
   */
  direction(x: number, y: number): Point | null {
    const i = this.indexDe(x, y);
    if (i < 0) return null;
    const j = this.suivante[i]!;
    if (j < 0) return null;
    const c = j % COLONNES;
    const l = (j - c) / COLONNES;
    const dx = c * CASE + CASE / 2 - x;
    const dy = l * CASE + CASE / 2 - y;
    const n = Math.hypot(dx, dy);
    if (n < 1) return null;
    return { x: dx / n, y: dy / n };
  }

  /**
   * Le segment d'un point a un autre ne traverse-t-il que des cases qui
   * passent ? Echantillonne tous les demi-cases. C'est ce qui decide si un
   * monstre marche droit ou suit le champ.
   */
  ligneLibre(de: Point, a: Point, passe: (c: Case) => boolean): boolean {
    const longueur = Math.hypot(a.x - de.x, a.y - de.y);
    const pas = Math.max(1, Math.ceil(longueur / (CASE / 2)));
    for (let i = 0; i <= pas; i++) {
      const t = i / pas;
      const cas = this.grille.caseEn(de.x + (a.x - de.x) * t, de.y + (a.y - de.y) * t);
      if (!cas || !passe(cas)) return false;
    }
    return true;
  }
}
