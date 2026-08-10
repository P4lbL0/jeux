/**
 * Le client Supabase (DESIGN.md §4.28).
 *
 * ⚠️ **Ce dossier est le seul endroit du jeu qui connaisse le reseau.** Le reste
 * du code ne l'importe qu'a travers `session.ts` et `sauvegardeCloud.ts` ; on
 * doit pouvoir supprimer `src/en-ligne/` en entier sans que la partie cesse de
 * se jouer. C'est la contrepartie de la regle « le jeu reste jouable hors ligne,
 * sans compte » : une dependance qu'on ne peut pas retirer est une dependance
 * dont on ne peut pas se passer.
 *
 * La base est celle de **The Circle**, un site en production. Deux regles ne se
 * negocient pas :
 *
 * - on ne touche qu'aux tables prefixees `game_` ;
 * - on n'utilise que la cle **anon**. Elle est publique par nature — elle est
 *   faite pour etre lue dans le bundle d'un navigateur, c'est la RLS qui protege
 *   les donnees, pas le secret de la cle. On ne cherche donc pas a la cacher.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const URL_BASE = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const CLE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

let client: SupabaseClient | null = null;
let tentee = false;

/**
 * Le client, ou `null` si le jeu tourne sans compte.
 *
 * `null` est un **cas normal**, pas une panne : pas de `.env`, cle absente, ou
 * cle refusee. Tout appelant doit savoir vivre avec.
 */
export function clientSupabase(): SupabaseClient | null {
  if (tentee) return client;
  tentee = true;

  if (!URL_BASE || !CLE_ANON) {
    // Silencieux a dessein : jouer sans compte est le mode par defaut, ce n'est
    // pas un avertissement a servir a quelqu'un qui n'a rien demande.
    return null;
  }

  if (!cleAnonyme(CLE_ANON)) {
    console.error(
      "[en-ligne] la cle fournie n'est pas une cle anon : elle est ignoree. " +
        "Ce jeu tourne dans un navigateur, il n'utilise jamais autre chose.",
    );
    return null;
  }

  client = createClient(URL_BASE, CLE_ANON, {
    auth: {
      // La session vit dans le localStorage du joueur : il reste connecte d'une
      // partie a l'autre sans avoir a retaper son mot de passe.
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });
  return client;
}

/** Le jeu a-t-il de quoi se connecter ? Sert a masquer l'ecran de compte. */
export function enLigneConfigure(): boolean {
  return clientSupabase() !== null;
}

/**
 * La cle est-elle bien une cle **anon** ?
 *
 * Le corps d'un JWT Supabase porte son role en clair. Le lire ne protege
 * evidemment de rien — un attaquant ne passe pas par la — mais ca arrete la
 * seule erreur qui compte vraiment ici : coller par megarde une cle
 * `service_role` dans le `.env` d'un jeu, et l'expedier dans un bundle public.
 */
function cleAnonyme(cle: string): boolean {
  try {
    const corps = cle.split(".")[1];
    if (!corps) return false;
    const json = JSON.parse(atob(corps.replace(/-/g, "+").replace(/_/g, "/"))) as {
      role?: string;
    };
    return json.role === "anon";
  } catch {
    return false;
  }
}
