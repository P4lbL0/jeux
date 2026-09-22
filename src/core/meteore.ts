import { CASE } from "./grille";
import type { Rng } from "./rng";

/**
 * Le meteore (DESIGN.md §4.21, tranche le 22 septembre 2026).
 *
 * Le dernier morceau du ciel, et **le seul evenement du jeu qui change la carte
 * pour de bon** : un cratere reste jusqu'a la fin de la partie, la ou tout le
 * reste se repare ou repousse.
 *
 * Quatre decisions d'Angelos, le jour ou il est code :
 *
 * 1. **Rare, et annonce.** Une nuit sur vingt. Une trainee traverse le ciel,
 *    une ombre grandit au sol, et l'impact arrive douze secondes plus tard :
 *    on a le temps de dégager. C'est la regle du §4.17 — ce qui fait mal se
 *    voit venir.
 * 2. **Tout dans le cratere, sauf l'eglise.** Maisons, murs, tours, champs,
 *    arbres, monstres : rien ne tient. L'eglise ne tombe pas (§4.22).
 * 3. **Pres du village, jamais pile dessus.** Le point est tire dans un anneau
 *    autour de l'eglise : assez pres pour que ca compte, jamais centre sur la
 *    place.
 * 4. **Il laisse du fer du ciel.** Un gisement qu'on frappe comme un poste de
 *    mine, et qui s'epuise. Une raison d'aimer voir tomber le ciel.
 *
 * Ce module ne connait ni Phaser ni la carte : il tient une horloge, un point
 * et une liste de cicatrices. Ce qui brule, tombe et se peint appartient a la
 * scene.
 */

/** Ce qu'un meteore est en train de faire. */
export type PhaseMeteore = "dort" | "annonce";

/** Une cicatrice sur la carte : elle ne s'efface jamais. */
export interface Cratere {
  x: number;
  y: number;
  rayon: number;
}

/** Le fer du ciel, tant qu'il en reste a prendre. */
export interface Gisement {
  x: number;
  y: number;
  /** Ce qu'il reste a extraire, en unites de fer */
  restant: number;
}

/**
 * **LA table de reglages du meteore.**
 *
 * ⚠️ *Chiffres tranches par le code, aucun n'a ete joue.*
 */
export const REGLAGES_METEORE = {
  /**
   * La chance qu'un meteore tombe, tiree **une fois par nuit**.
   *
   * Une sur vingt : environ un par partie longue, jamais deux dans la meme
   * soiree. Au-dela, la cicatrice permanente ne serait plus un evenement mais
   * une texture de sol.
   */
  chanceParNuit: 1 / 20,
  /**
   * Entre la trainee dans le ciel et l'impact, en millisecondes.
   *
   * Douze secondes : le temps de traverser un village en courant, pas celui de
   * demonter un mur. On choisit **ce qu'on sauve**, pas **si** on sauve.
   */
  annonce: 12_000,
  /**
   * Le rayon du cratere, en pixels du monde.
   *
   * Deux cases et demie : de quoi emporter une maison entiere et mordre sur sa
   * voisine, sans raser un quartier. Un cratere plus large ferait un trou dont
   * on ne se remet pas.
   */
  rayon: 2.5 * CASE,
  /**
   * L'anneau ou il tombe, en pixels autour de l'eglise.
   *
   * Le bord interieur tient la place a l'abri : le coeur du village n'est
   * jamais raye d'un coup, ce qui serait subi et non joue. Le bord exterieur le
   * garde dans le village ou juste autour.
   */
  anneau: { min: 5 * CASE, max: 16 * CASE },
  /**
   * Le fer du ciel laisse dans le cratere.
   *
   * Cent vingt : le prix de deux tours de pierre environ. Assez pour que le
   * joueur aille le chercher au lieu de contourner le trou.
   */
  ferDuCiel: 120,
  /** Combien de departs de feu autour du point d'impact (§4.21, l'incendie) */
  feux: 2,
  /**
   * Jusqu'ou les departs de feu peuvent prendre, en pixels du centre.
   *
   * Six cases, et c'est une **correction mesuree** : a quatre, la fenetre entre
   * le bord du cratere (deux cases et demie) et la portee etait si etroite
   * qu'aucune maison ne s'y trouvait jamais — trois mondes de suite, zero
   * depart de feu. Le choc doit enflammer le voisinage, pas le bord exact du
   * trou.
   */
  porteeDesFeux: 6 * CASE,
};

/** Ce que la sauvegarde garde du ciel tombe (§4.28). */
export interface EtatMeteore {
  crateres: Cratere[];
  gisement: Gisement | null;
}

/**
 * Ou tombe le meteore : un point tire dans l'anneau autour d'un centre.
 *
 * Pure, et tiree a part pour que « jamais sur la place » se teste sans horloge.
 */
export function pointDeChute(
  centre: { x: number; y: number },
  rng: Rng,
): { x: number; y: number } {
  const { min, max } = REGLAGES_METEORE.anneau;
  const angle = rng.next() * Math.PI * 2;
  // ⚠️ **La racine carree**, sinon les points s'entassent pres du bord
  // interieur : un tirage uniforme sur le rayon n'est pas uniforme sur l'aire.
  const distance = Math.sqrt(min * min + rng.next() * (max * max - min * min));
  return { x: centre.x + Math.cos(angle) * distance, y: centre.y + Math.sin(angle) * distance };
}

/**
 * Le ciel qui tombe, sur une partie.
 *
 * Une instance par partie. Le tirage se fait **a la tombee de la nuit** — comme
 * les fronts et le temps qu'il fait, jamais par image.
 */
export class Meteore {
  phase: PhaseMeteore = "dort";
  /** Ou il va tomber, pendant l'annonce */
  point: { x: number; y: number } | null = null;
  /** Les cicatrices de la partie, dans l'ordre ou elles sont tombees */
  readonly crateres: Cratere[] = [];
  /** Le fer du ciel du dernier cratere, tant qu'il en reste */
  gisement: Gisement | null = null;
  private impactA = 0;
  private annonceA = 0;

  /**
   * La nuit tombe : le ciel lache-t-il quelque chose ?
   *
   * ⚠️ **Un seul a la fois** : tant qu'un meteore est annonce, la nuit suivante
   * ne tire pas. Deux ombres au sol en meme temps ne se lisent pas.
   *
   * @returns le point de chute si un meteore vient d'etre annonce, sinon null
   */
  guetterLaNuit(
    centre: { x: number; y: number },
    maintenant: number,
    rng: Rng,
  ): { x: number; y: number } | null {
    if (this.phase !== "dort") return null;
    if (!rng.chance(REGLAGES_METEORE.chanceParNuit)) return null;

    this.point = pointDeChute(centre, rng);
    this.phase = "annonce";
    this.annonceA = maintenant;
    this.impactA = maintenant + REGLAGES_METEORE.annonce;
    return this.point;
  }

  /**
   * Le temps passe.
   *
   * @returns le point d'impact **la seule image ou il touche**, sinon null
   */
  avancer(maintenant: number): { x: number; y: number } | null {
    if (this.phase !== "annonce" || !this.point) return null;
    if (maintenant < this.impactA) return null;

    const point = this.point;
    this.phase = "dort";
    this.point = null;
    this.crateres.push({ x: point.x, y: point.y, rayon: REGLAGES_METEORE.rayon });
    this.gisement = { x: point.x, y: point.y, restant: REGLAGES_METEORE.ferDuCiel };
    return point;
  }

  /**
   * L'avancement de l'annonce, de 0 (la trainee parait) a 1 (l'impact).
   *
   * C'est ce que l'ombre au sol lit pour grandir : le joueur mesure le temps
   * qu'il lui reste **a la taille du cercle**, pas a une jauge.
   */
  partDeLAnnonce(maintenant: number): number {
    if (this.phase !== "annonce") return 0;
    const duree = this.impactA - this.annonceA;
    if (duree <= 0) return 1;
    return Math.max(0, Math.min(1, (maintenant - this.annonceA) / duree));
  }

  /**
   * On frappe le fer du ciel.
   *
   * @returns ce qu'on en tire vraiment — jamais plus qu'il n'en reste, et le
   *          gisement disparait quand il est vide.
   */
  extraire(quantite: number): number {
    if (!this.gisement) return 0;
    const pris = Math.min(quantite, this.gisement.restant);
    this.gisement.restant -= pris;
    if (this.gisement.restant <= 0) this.gisement = null;
    return pris;
  }

  /** Ce que la sauvegarde garde (§4.28). */
  get instantane(): EtatMeteore {
    return {
      crateres: this.crateres.map((c) => ({ ...c })),
      gisement: this.gisement ? { ...this.gisement } : null,
    };
  }

  /**
   * Le ciel d'une partie qu'on reprend.
   *
   * ⚠️ **Les cicatrices reviennent, l'annonce non.** Un cratere est un etat du
   * monde ; un meteore en vol est un instant, comme le navire du bloc 6b — et
   * recharger ne doit pas etre une facon d'esquiver ce qui allait tomber, ni
   * d'en faire paraitre un.
   */
  reprendre(etat: EtatMeteore | undefined): void {
    this.phase = "dort";
    this.point = null;
    this.crateres.length = 0;
    this.gisement = null;
    if (!etat) return;
    for (const c of etat.crateres) this.crateres.push({ ...c });
    this.gisement = etat.gisement ? { ...etat.gisement } : null;
  }
}
