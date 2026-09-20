/**
 * Les portes qui s'ouvrent et se ferment (DESIGN.md §4.20, bloc 7b).
 *
 * Tranche le 9 septembre 2026 : **une porte s'ouvre en 2 secondes et se
 * referme en 2 secondes**, et on est vulnerable pendant qu'elle est ouverte.
 * Et le 20 septembre, les trois regles qui font le dilemme :
 *
 * 1. **La cloche ferme les portes quand plus personne n'est dehors** — pas a
 *    la seconde ou elle sonne. Tant qu'un habitant court encore vers
 *    l'eglise, sa porte l'attend.
 * 2. **Une porte fermee s'ouvre toute seule devant quelqu'un**, habitant ou
 *    heros, **si aucun monstre n'est pres d'elle**. Sinon elle reste close :
 *    il faut ecarter la meute d'abord. C'est le survivant du petit matin devant
 *    une porte close, avec la meute derriere.
 * 3. **On ne peut pas se murer sans porte** : poser le mur qui refermerait
 *    une zone est refuse, en disant pourquoi.
 *
 * Ce fichier ne connait pas Phaser. Il porte l'etat d'un battant et la regle
 * de l'enceinte ; la scene decide *quand* appeler quoi.
 */

import { CASE, Grille, COLONNES, LIGNES, type Occupation } from "./grille";
import type { Terrain } from "./carte";

export const REGLAGES_PORTE = {
  /** Le temps d'ouvrir un battant, en millisecondes. */
  ouverture: 2_000,
  /** Le temps de le refermer. */
  fermeture: 2_000,
  /**
   * A quelle distance quelqu'un « demande » une porte fermee, en pixels du
   * monde : un peu plus d'une case, le temps qu'elle s'ouvre avant qu'il ne
   * s'y cogne.
   */
  demande: 44,
  /**
   * A quelle distance un monstre interdit l'ouverture. Cinq cases : le temps
   * qu'une porte s'ouvre et se referme (4 s), un rodeur a 80 px/s en fait
   * dix — la porte ne doit pas s'ouvrir devant lui, meme de loin.
   */
  menace: 160,
  /**
   * Combien de temps une porte ouverte sur demande attend sans personne avant
   * de se refermer. Assez pour qu'un groupe passe, pas assez pour laisser un
   * trou toute la nuit.
   */
  attente: 2_500,
};

/**
 * Ou en est un battant. `s-ouvre` et `se-ferme` sont les deux secondes du
 * dilemme : on ne passe pas encore, on ne passe deja plus.
 */
export type PhasePorte = "ouverte" | "fermee" | "s-ouvre" | "se-ferme";

/** Ce que le dessin montre : trois images pour quatre phases. */
export type PositionPorte = "ouverte" | "entrouverte" | "fermee";

/**
 * Un battant : sa phase, et l'instant ou elle a commence.
 *
 * Aucune minuterie (§4.17 regle 4) : la scene appelle `avancer` avec son
 * horloge, et le battant compare. Ouvrir un battant qui se ferme le rouvre
 * **d'ou il en est** — il ne repart pas de zero, sinon une porte harcelee
 * serait la seule chose du jeu qui triche sur le temps.
 */
export class Battant {
  phase: PhasePorte;
  /** L'instant ou la phase en cours a commence, en millisecondes de scene. */
  depuis = 0;

  constructor(ouverte = true) {
    this.phase = ouverte ? "ouverte" : "fermee";
  }

  /** De 0 (fermee) a 1 (ouverte), a cet instant. */
  part(maintenant: number): number {
    const r = REGLAGES_PORTE;
    switch (this.phase) {
      case "ouverte":
        return 1;
      case "fermee":
        return 0;
      case "s-ouvre":
        return Math.min(1, Math.max(0, (maintenant - this.depuis) / r.ouverture));
      case "se-ferme":
        return 1 - Math.min(1, Math.max(0, (maintenant - this.depuis) / r.fermeture));
    }
  }

  /** On ne passe que par une porte **entierement** ouverte. */
  get laissePasser(): boolean {
    return this.phase === "ouverte";
  }

  get enMouvement(): boolean {
    return this.phase === "s-ouvre" || this.phase === "se-ferme";
  }

  /** Ce que le dessin doit montrer a cet instant. */
  position(maintenant: number): PositionPorte {
    const part = this.part(maintenant);
    if (part >= 1) return "ouverte";
    if (part <= 0) return "fermee";
    return "entrouverte";
  }

  ouvrir(maintenant: number): void {
    if (this.phase === "ouverte" || this.phase === "s-ouvre") return;
    const part = this.part(maintenant);
    this.phase = "s-ouvre";
    // Reprise d'ou l'on en est : `part` d'ouverture deja faite.
    this.depuis = maintenant - part * REGLAGES_PORTE.ouverture;
  }

  fermer(maintenant: number): void {
    if (this.phase === "fermee" || this.phase === "se-ferme") return;
    const part = this.part(maintenant);
    this.phase = "se-ferme";
    this.depuis = maintenant - (1 - part) * REGLAGES_PORTE.fermeture;
  }

  /**
   * Le temps passe.
   *
   * @returns vrai si la phase vient de changer — c'est le moment de redessiner.
   */
  avancer(maintenant: number): boolean {
    if (this.phase === "s-ouvre" && this.part(maintenant) >= 1) {
      this.phase = "ouverte";
      return true;
    }
    if (this.phase === "se-ferme" && this.part(maintenant) <= 0) {
      this.phase = "fermee";
      return true;
    }
    return false;
  }

  /** La pause repousse l'horloge : le battant suit. */
  decaler(millisecondes: number): void {
    this.depuis += millisecondes;
  }
}

/**
 * Ce qu'une porte fermee sur consigne doit faire a cet instant (regle 2).
 *
 * @param quelquUn quelqu'un des notres est a portee de demande
 * @param menace un monstre est a portee de menace
 * @param derniereDemande l'instant de la derniere demande servie
 * @returns « ouvrir », « fermer », ou rien
 */
export function consigneDeNuit(
  battant: Battant,
  maintenant: number,
  quelquUn: boolean,
  menace: boolean,
  derniereDemande: number,
): "ouvrir" | "fermer" | null {
  if (quelquUn && !menace) {
    return battant.phase === "ouverte" || battant.phase === "s-ouvre" ? null : "ouvrir";
  }
  // Personne, ou une menace : une porte ouverte se referme, apres l'attente
  // si elle avait ete demandee — tout de suite si un monstre approche.
  if (battant.phase === "fermee" || battant.phase === "se-ferme") return null;
  if (menace || maintenant - derniereDemande >= REGLAGES_PORTE.attente) return "fermer";
  return null;
}

// ------------------------------------------------------ l'enceinte close

/** Les terrains par lesquels on peut sortir du village a pied. */
const PRATICABLES: readonly Terrain[] = ["sable", "herbe", "sous-bois", "haut-fond"];

/** Ce qui arrete quelqu'un qui cherche la sortie. Une porte n'en fait pas partie : c'est la sortie. */
const FERMENT: readonly Occupation[] = ["mur", "tour", "batiment", "maison"];

function praticable(grille: Grille, colonne: number, ligne: number, bouchee: number): boolean {
  const c = grille.case(colonne, ligne);
  if (!c) return false;
  if (ligne * COLONNES + colonne === bouchee) return false;
  return PRATICABLES.includes(c.terrain) && !FERMENT.includes(c.occupation);
}

/**
 * Combien de cases on atteint a pied depuis le bord de la carte — le
 * « dehors » —, en bouchant eventuellement une case.
 *
 * Une propagation sur toute la grille (~3000 cases), en quatre voisins. Elle
 * ne tourne **qu'a la pose**, jamais par image, et seulement sur les murs :
 * c'est ce qui la rend acceptable (§4.20). `bouchee` vaut -1 pour ne rien
 * boucher.
 */
export function casesAtteintesDuDehors(grille: Grille, bouchee = -1): number {
  const vues = new Uint8Array(COLONNES * LIGNES);
  const pile: number[] = [];
  const pousser = (colonne: number, ligne: number) => {
    if (colonne < 0 || ligne < 0 || colonne >= COLONNES || ligne >= LIGNES) return;
    const i = ligne * COLONNES + colonne;
    if (vues[i]) return;
    vues[i] = 1;
    if (praticable(grille, colonne, ligne, bouchee)) pile.push(i);
  };
  for (let colonne = 0; colonne < COLONNES; colonne++) {
    pousser(colonne, 0);
    pousser(colonne, LIGNES - 1);
  }
  for (let ligne = 0; ligne < LIGNES; ligne++) {
    pousser(0, ligne);
    pousser(COLONNES - 1, ligne);
  }
  let atteintes = 0;
  while (pile.length > 0) {
    const i = pile.pop()!;
    atteintes += 1;
    const colonne = i % COLONNES;
    const ligne = (i - colonne) / COLONNES;
    pousser(colonne, ligne - 1);
    pousser(colonne + 1, ligne);
    pousser(colonne, ligne + 1);
    pousser(colonne - 1, ligne);
  }
  return atteintes;
}

/**
 * Poser un mur sur cette case refermerait-il une zone **sans porte** ?
 *
 * Si des cases qu'on atteignait depuis le dehors ne s'atteignent plus une fois
 * la case bouchee, le mur ferme une enceinte — et comme les portes comptent
 * comme des passages, une enceinte qui en a une reste atteinte. C'est donc
 * exactement « il n'y reste pas de porte ».
 */
export function enfermeraitSansPorte(grille: Grille, x: number, y: number): boolean {
  const colonne = grille.colonneDe(x);
  const ligne = grille.ligneDe(y);
  if (!grille.dedans(colonne, ligne)) return false;
  const i = ligne * COLONNES + colonne;
  // Une case deja fermee ne change rien ; une case impraticable non plus.
  if (!praticable(grille, colonne, ligne, -1)) return false;
  const avant = casesAtteintesDuDehors(grille);
  const apres = casesAtteintesDuDehors(grille, i);
  // La case bouchee elle-meme ne compte pas : elle est perdue par definition.
  return avant - apres > 1;
}

/** La distance en pixels de deux points du monde : en clair pour les tests. */
export function aPortee(ax: number, ay: number, bx: number, by: number, portee: number): boolean {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy <= portee * portee;
}

/** Le centre d'une case, pour ecrire des tests en cases plutot qu'en pixels. */
export function centreDeCase(colonne: number, ligne: number): { x: number; y: number } {
  return { x: colonne * CASE + CASE / 2, y: ligne * CASE + CASE / 2 };
}
