/**
 * La copie cloud de la sauvegarde (DESIGN.md §4.28).
 *
 * **Le local est la sauvegarde ; ceci en est une copie.** Cet ordre est ce qui
 * garantit le hors-ligne, et ce qui evite d'arroser une base de production a
 * chaque nuit tombee.
 *
 * Trois regles portent le reste :
 *
 * - **rien ne bloque jamais le jeu.** Tout est enveloppe, tout echec se resume a
 *   « on garde le local, on reessaiera au prochain moment-cle », et aucune
 *   erreur reseau ne remonte au joueur en popup ;
 * - **60 secondes minimum entre deux envois**, et le dernier etat gagne : on
 *   n'empile pas les envois dans une file ;
 * - **jamais de minuterie, jamais pendant le combat.** C'est l'appelant qui
 *   choisit les moments — fin de nuit, passage d'un jour, page qu'on quitte.
 */

import { lire, serialiser, tientEnBase, type Emplacement, type Sauvegarde } from "../core/sauvegarde";
import { clientSupabase } from "./client";
import { identifiantJoueur } from "./compte";

/** Le minimum entre deux envois, en millisecondes (§4.28). */
export const REPOS_ENTRE_ENVOIS = 60_000;

export type EtatReseau = "hors-ligne" | "a-jour" | "en-cours" | "echec";

let dernierEnvoi = 0;
let enVol = false;
let etat: EtatReseau = "hors-ligne";

export function etatReseau(): EtatReseau {
  return etat;
}

/**
 * Envoie la sauvegarde, si le moment s'y prete.
 *
 * @param force ignore le repos de 60 s — reserve a la fermeture de la page et a
 *   la fin de partie, les deux seuls instants ou il n'y aura pas de « prochaine
 *   fois »
 * @returns vrai si la copie cloud est a jour a la sortie
 */
export async function envoyer(
  emplacement: Emplacement,
  sauvegarde: Sauvegarde,
  force = false,
): Promise<boolean> {
  const client = clientSupabase();
  if (!client) return false;

  const maintenant = Date.now();
  // Le dernier etat gagne : un envoi refuse ici n'est pas mis en file, il est
  // simplement remplace par celui du prochain moment-cle.
  if (!force && maintenant - dernierEnvoi < REPOS_ENTRE_ENVOIS) return false;
  if (enVol) return false;

  const profile_id = await identifiantJoueur();
  if (!profile_id) return false;

  const texte = serialiser(sauvegarde);
  if (!tientEnBase(texte)) {
    console.warn(
      "[en-ligne] sauvegarde trop volumineuse pour la colonne : on garde le local seulement",
    );
    return false;
  }

  enVol = true;
  etat = "en-cours";
  try {
    const { error } = await client.from("game_saves").upsert(
      {
        profile_id,
        slot: emplacement,
        version: sauvegarde.version,
        data: JSON.parse(texte) as unknown,
      },
      // Un upsert, jamais un insert qui echoue : une ligne par (joueur,
      // emplacement), et c'est la meme qu'on reecrit toute la partie.
      { onConflict: "profile_id,slot" },
    );

    if (error) {
      etat = "echec";
      console.warn("[en-ligne] envoi refuse :", error.message);
      return false;
    }

    dernierEnvoi = Date.now();
    etat = "a-jour";
    return true;
  } catch (erreur) {
    etat = "echec";
    console.warn("[en-ligne] envoi impossible :", erreur);
    return false;
  } finally {
    enVol = false;
  }
}

/**
 * Relit la copie cloud d'un emplacement.
 *
 * @returns la sauvegarde, ou `null` — et `null` couvre aussi bien « il n'y en a
 *   pas » que « on n'a pas pu aller voir ». Aucun appelant n'a de raison de
 *   distinguer les deux : dans les deux cas on joue avec ce qu'on a en local.
 */
export async function charger(emplacement: Emplacement): Promise<Sauvegarde | null> {
  const client = clientSupabase();
  if (!client) return null;

  const profile_id = await identifiantJoueur();
  if (!profile_id) return null;

  try {
    // Pas de `select *`, et une seule ligne : la RLS filtre deja sur le joueur,
    // le `eq` est la pour que la requete dise ce qu'elle veut.
    const { data, error } = await client
      .from("game_saves")
      .select("data,version")
      .eq("profile_id", profile_id)
      .eq("slot", emplacement)
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      if (error) etat = "echec";
      return null;
    }

    const lecture = lire(JSON.stringify(data.data));
    if (!lecture.ok) {
      console.warn("[en-ligne] copie cloud illisible :", lecture.message);
      return null;
    }

    etat = "a-jour";
    return lecture.sauvegarde;
  } catch (erreur) {
    etat = "echec";
    console.warn("[en-ligne] lecture impossible :", erreur);
    return null;
  }
}

/**
 * Efface la copie cloud d'un emplacement.
 *
 * ⚠️ **Indispensable a la fin d'une partie.** Sans ca, une partie perdue laisse
 * sa copie derriere elle : l'emplacement se viderait sur l'appareil et
 * reproposerait, au chargement suivant, de reprendre exactement la partie qu'on
 * vient de perdre. La regle ironman se contournerait en changeant de machine.
 */
export async function effacer(emplacement: Emplacement): Promise<void> {
  const client = clientSupabase();
  if (!client) return;

  const profile_id = await identifiantJoueur();
  if (!profile_id) return;

  try {
    await client.from("game_saves").delete().eq("profile_id", profile_id).eq("slot", emplacement);
  } catch (erreur) {
    console.warn("[en-ligne] effacement impossible :", erreur);
  }
}

/** Remet le compteur a zero : la prochaine sauvegarde partira sans attendre. */
export function oublierLeRepos(): void {
  dernierEnvoi = 0;
}
