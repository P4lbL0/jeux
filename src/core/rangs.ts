/**
 * Les rangs de la horde (DESIGN.md §4.33 — tranches le 23 septembre 2026).
 *
 * La piétaille, le boss et l'énorme. Un rang **se pose sur un archétype** : un
 * boss cracheur est un géant jaune qui crache. La taille dit le rang — c'est le
 * quatrième canal du langage de la horde, avec la teinte (qui), la luminosité (la
 * vie) et le rouge (le coup).
 *
 * « Chaque nuit a son boss » : on l'attend, le boss de la nuit devient un
 * rendez-vous. Le calendrier ne tire rien au hasard — il se lit dans le numéro de
 * la nuit, comme l'effectif.
 *
 * Ce fichier ne connait pas Phaser.
 */

export type Rang = "pietaille" | "boss" | "enorme";

/** Ce qu'un rang multiplie. */
export interface ReglesDeRang {
  /** La taille du dessin et de la hitbox : c'est elle qui dit le rang. */
  taille: number;
  pv: number;
  degats: number;
  vitesse: number;
  /** L'XP, et donc l'or, qui en decoule (`butin.ts`). */
  butin: number;
}

/** Les quatre decisions d'Angelos, sur les planches du 22 septembre au soir. */
export const RANGS: Readonly<Record<Rang, ReglesDeRang>> = {
  pietaille: { taille: 1, pv: 1, degats: 1, vitesse: 1, butin: 1 },
  boss: { taille: 2, pv: 10, degats: 3, vitesse: 0.7, butin: 10 },
  enorme: { taille: 3, pv: 30, degats: 6, vitesse: 0.5, butin: 30 },
};

/**
 * Les archetypes qu'un rang ne promeut pas : ils deviennent une brute.
 *
 * L'essaim est une bete de nuee — un geant n'a rien d'un essaim. Le kamikaze
 * explose : a six fois ses degats, sans parade, ce ne serait plus un combat mais
 * une loterie.
 */
export const NON_PROMUS: ReadonlySet<string> = new Set(["essaim", "kamikaze"]);
export const PROMU_A_LEUR_PLACE = "brute";

/** Combien de boss la nuit N envoie : un des la deuxieme, un de plus toutes les cinq nuits. */
export function bossDeLaNuit(nuit: number): number {
  return nuit < 2 ? 0 : 1 + Math.floor((nuit - 2) / 5);
}

/** Un enorme toutes les cinq nuits : la cinquieme, la dixieme… */
export function enormesDeLaNuit(nuit: number): number {
  return nuit >= 5 && nuit % 5 === 0 ? 1 : 0;
}

/** Un rang qui paraitra quand cette part de l'effectif de la nuit sera partie. */
export interface Rendezvous {
  part: number;
  rang: Rang;
}

/**
 * Ou tombent les rangs dans la nuit.
 *
 * Les boss sont **repartis** sur la fenetre d'arrivee — ni en tete, ou ils
 * arriveraient seuls, ni en queue, ou la nuit se terminerait sur eux — et
 * l'enorme aux trois quarts : il arrive quand la horde est deja la.
 *
 * @returns les rendez-vous, par part croissante
 */
export function rendezvousDeLaNuit(nuit: number): Rendezvous[] {
  const liste: Rendezvous[] = [];
  const boss = bossDeLaNuit(nuit);
  for (let k = 0; k < boss; k++) liste.push({ part: (k + 1) / (boss + 1), rang: "boss" });
  if (enormesDeLaNuit(nuit) > 0) liste.push({ part: 0.75, rang: "enorme" });
  return liste.sort((a, b) => a.part - b.part);
}
