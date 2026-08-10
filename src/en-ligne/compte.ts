/**
 * Le compte The Circle (DESIGN.md §4.28).
 *
 * On ne cree **pas** de compte ici : la creation reste sur `the-circle.pro`, le
 * jeu ne fait que s'y connecter. C'est deliberé — un formulaire d'inscription
 * dans un jeu, c'est un deuxieme endroit ou gerer des mots de passe oublies,
 * des adresses a verifier et des comptes en double.
 *
 * Le jeu tourne sur un autre domaine que le site : la session du jeu est
 * **independante** de celle de `the-circle.pro`. Se connecter ici ne connecte
 * pas la-bas, et c'est normal.
 */

import type { Session } from "@supabase/supabase-js";
import { clientSupabase } from "./client";

export const ADRESSE_DU_SITE = "https://the-circle.pro";

export type Connexion =
  | { ok: true; session: Session }
  | { ok: false; message: string };

/**
 * Les messages d'erreur.
 *
 * ⚠️ **Aucun ne doit laisser croire que le jeu est casse.** Un mot de passe
 * refuse, c'est un mot de passe refuse ; une coupure reseau, c'est une coupure
 * reseau. Les deux se jouent sans compte.
 */
function traduire(brut: string): string {
  const message = brut.toLowerCase();
  if (message.includes("invalid login")) {
    return "Adresse ou mot de passe refuse. Verifie tes identifiants The Circle.";
  }
  if (message.includes("email not confirmed")) {
    return "Ce compte n'a pas encore ete confirme. Regarde tes courriels.";
  }
  if (message.includes("failed to fetch") || message.includes("network")) {
    return "Serveur injoignable. Tu peux jouer hors ligne : ta partie est enregistree sur cet appareil.";
  }
  if (message.includes("rate limit") || message.includes("too many")) {
    return "Trop de tentatives. Reessaie dans une minute.";
  }
  return "La connexion a echoue. Tu peux jouer hors ligne sans rien perdre.";
}

export async function seConnecter(email: string, motDePasse: string): Promise<Connexion> {
  const client = clientSupabase();
  if (!client) {
    return { ok: false, message: "Le jeu n'est pas configure pour la connexion en ligne." };
  }

  try {
    const { data, error } = await client.auth.signInWithPassword({
      email: email.trim(),
      password: motDePasse,
    });
    if (error || !data.session) {
      return { ok: false, message: traduire(error?.message ?? "") };
    }
    return { ok: true, session: data.session };
  } catch (erreur) {
    // `signInWithPassword` jette sur une coupure reseau franche, en plus de
    // renvoyer une erreur sur un refus : les deux chemins existent.
    return { ok: false, message: traduire(String(erreur)) };
  }
}

export async function seDeconnecter(): Promise<void> {
  try {
    await clientSupabase()?.auth.signOut();
  } catch {
    // Ne pas pouvoir prevenir le serveur n'empeche pas de continuer a jouer.
  }
}

/**
 * La session en cours, s'il y en a une.
 *
 * ⚠️ **Ne jamais attendre ce resultat sur le chemin de demarrage.** Le jeu doit
 * partir sans reseau ; cet appel se fait a cote, et son resultat vient teinter
 * un ecran deja affiche.
 */
export async function sessionCourante(): Promise<Session | null> {
  const client = clientSupabase();
  if (!client) return null;

  try {
    const { data } = await client.auth.getSession();
    return data.session;
  } catch {
    return null;
  }
}

/** L'identifiant du joueur connecte — c'est le `profile_id` des tables `game_`. */
export async function identifiantJoueur(): Promise<string | null> {
  return (await sessionCourante())?.user.id ?? null;
}
