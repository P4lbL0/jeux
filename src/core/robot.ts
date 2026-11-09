/**
 * Le robot qui joue des parties entières (jalon 6.4, étape 3, tranché par Angelos le
 * 9 novembre 2026) : il joue **le héros seul** — se battre, choisir ses cartes, se replier —
 * et laisse le village vivre seul ; à la porte, il accepte tout le monde. Ce fichier tient
 * la seule chose qu'il décide vraiment : **quelle carte prendre**.
 *
 * Deux façons, pour deux séries de parties qu'on compare :
 * - `regle` : une règle simple, celle d'un joueur qui réfléchit un peu — une fusion d'abord,
 *   puis ce qu'il a déjà (il monte ses paliers au lieu de s'éparpiller), puis ce qui est de
 *   sa classe ;
 * - `hasard` : une carte au hasard. L'écart entre les deux dit si bien choisir compte.
 */

export type ModeCartes = "regle" | "hasard";

/** Une carte proposée, telle que le robot la voit. */
export interface CarteVue {
  /** Une fusion (§4.25) */
  fusion: boolean;
  /** Le palier qu'il a déjà dans cette compétence (0 : il ne l'a pas) */
  palier: number;
  /** Compétence réservée à sa classe, ou qui la nomme */
  deSaClasse: boolean;
  /** Écran « plus de place » : cette carte fait oublier une active */
  oublier: boolean;
  /** Écran « plus de place » : acheter un emplacement */
  achat: boolean;
}

/**
 * L'indice de la carte prise. `tirage` est un nombre dans [0, 1[, qui sert au hasard et à
 * rien d'autre : avec la règle, le même écran donne toujours la même carte.
 */
export function choisirCarte(cartes: readonly CarteVue[], mode: ModeCartes, tirage: number): number {
  if (cartes.length === 0) return -1;
  if (mode === "hasard") return Math.min(cartes.length - 1, Math.floor(tirage * cartes.length));

  // L'écran « plus de place » : fusionner libère une place sans rien perdre, acheter non
  // plus ; sinon on oublie l'active la moins montée.
  if (cartes.some((c) => c.oublier || c.achat)) {
    const fusion = cartes.findIndex((c) => c.fusion);
    if (fusion >= 0) return fusion;
    const achat = cartes.findIndex((c) => c.achat);
    if (achat >= 0) return achat;
    let meilleure = 0;
    for (let i = 1; i < cartes.length; i++) {
      if (cartes[i]!.palier < cartes[meilleure]!.palier) meilleure = i;
    }
    return meilleure;
  }

  let meilleure = 0;
  let meilleurScore = -1;
  cartes.forEach((c, i) => {
    const score = (c.fusion ? 100 : 0) + (c.palier > 0 ? 20 : 0) + (c.deSaClasse ? 10 : 0);
    if (score > meilleurScore) {
      meilleurScore = score;
      meilleure = i;
    }
  });
  return meilleure;
}
