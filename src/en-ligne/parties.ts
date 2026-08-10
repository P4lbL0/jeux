/**
 * Les parties terminees (DESIGN.md §4.28, §4.9).
 *
 * Une ligne par partie perdue, en insertion seule : un score ne se retouche pas.
 * C'est le socle du classement du jalon 12 — rien d'autre ne s'y branche.
 *
 * ⚠️ **Ce score vient du client, donc il est falsifiable.** N'importe qui peut
 * ouvrir la console et poster le chiffre qu'il veut : il n'y a aucune
 * validation serveur, et il n'y en aura pas tant qu'on ne l'aura pas ecrite.
 * **Aucune recompense ne doit jamais en dependre.** Pour un classement entre
 * amis, ca n'a aucune importance ; pour un classement public, c'est un chantier
 * a part entiere.
 */

import type { ClassId } from "../core/classes";
import { clientSupabase } from "./client";
import { identifiantJoueur } from "./compte";

export interface PartieTerminee {
  /**
   * Le score.
   *
   * La colonne s'appelle `vagues` parce qu'elle a ete creee quand le jeu
   * comptait des vagues ; il compte des **journees** depuis le §4.19. C'est le
   * meme « jusqu'ou on est alle », et renommer une colonne d'une base en
   * production pour un mot ne vaut pas le derangement.
   */
  jours: number;
  classe: ClassId;
  dureeSecondes: number;
}

/** @returns vrai si la partie a bien ete enregistree */
export async function enregistrerPartie(partie: PartieTerminee): Promise<boolean> {
  const client = clientSupabase();
  if (!client) return false;

  const profile_id = await identifiantJoueur();
  if (!profile_id) return false;

  try {
    const { error } = await client.from("game_runs").insert({
      profile_id,
      vagues: Math.max(0, Math.round(partie.jours)),
      classe: partie.classe,
      duree_s: Math.max(0, Math.round(partie.dureeSecondes)),
      meta: {},
    });

    if (error) {
      console.warn("[en-ligne] partie non enregistree :", error.message);
      return false;
    }
    return true;
  } catch (erreur) {
    console.warn("[en-ligne] partie non enregistree :", erreur);
    return false;
  }
}
