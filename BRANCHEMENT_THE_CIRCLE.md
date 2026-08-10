# Brancher Le Protecteur sur le compte The Circle

> Prompt de mission. À coller tel quel dans une session Claude Code du projet `jeux`.

---

Tu vas brancher **Le Protecteur** sur la base Supabase de **The Circle**, l'autre projet
d'Angelos (un SaaS communautaire en production, avec de vrais utilisateurs). Le but est
simple : **un joueur se connecte avec son compte The Circle, et sa progression le suit.**
Pour l'instant rien de tout ça n'est affiché côté The Circle — on pose juste le tuyau.

Avant de coder, lis `DESIGN.md`, `README.md` et `SUITE.md` comme d'habitude, et respecte
les conventions du projet (français, pas d'accents dans les sources, `src/core/` ne connaît
pas Phaser, tests avec Vitest).

## 1. Les règles absolues

The Circle est en production. Ces règles ne sont pas négociables — si une consigne plus bas
semble les contredire, ce sont ces règles qui gagnent, et tu poses la question.

1. **Tu ne touches JAMAIS aux données de The Circle.** Les seules tables que tu as le droit
   de lire ou d'écrire sont celles préfixées `game_`. Tout le reste — `profiles`,
   `communities`, `cards`, `tournaments`, les CF, la boutique, la modération — n'existe pas
   pour toi. Tu ne les lis pas, tu ne t'en sers pas, tu ne les mentionnes pas dans une
   requête.
2. **Tu n'écris aucune migration SQL et tu n'exécutes aucun DDL.** Les tables sont déjà
   créées (contrat au §3). S'il t'en faut une autre ou une colonne de plus : **tu t'arrêtes
   et tu demandes à Angelos**, c'est lui qui applique les migrations depuis l'autre dépôt.
3. **Tu n'ouvres pas le dépôt `the_circle`.** Tu n'as pas besoin de son code. Tu travailles
   uniquement dans `jeux`.
4. **La clé `service_role` est interdite.** Tu utilises exclusivement la clé **anon**, celle
   qui est faite pour tourner dans un navigateur. Si tu vois passer une clé qui commence par
   autre chose que ce qui t'a été donné, tu ne l'utilises pas et tu le signales.
5. **Le jeu doit rester jouable hors ligne, sans compte.** La connexion est une **option**,
   jamais une porte d'entrée. Si Supabase est en panne, injoignable ou lent, le jeu démarre
   et se joue exactement pareil. Aucun appel réseau ne bloque le boot, aucun `await` réseau
   sur le chemin critique.

## 2. Ce qu'on construit, et ce qu'on ne construit pas

**On construit :**

- une connexion optionnelle avec un compte The Circle existant ;
- une **copie cloud** de la sauvegarde, rattachée à ce compte ;
- l'enregistrement des parties terminées (pour le futur classement du jalon 11).

**On ne construit pas** (et tu ne le proposes pas dans ce lot) :

- la création de compte — elle reste sur `the-circle.pro`, le jeu ne fait que **se
  connecter** ; s'il n'a pas de compte, on l'envoie vers le site avec un lien ;
- le classement en ligne (jalon 11, plus tard) ;
- l'équilibrage lu depuis la base : **les classes et compétences restent dans
  `src/core/`**, en TypeScript typé et testé. On n'y touche pas.

**La sauvegarde locale reste la sauvegarde primaire.** Le cloud est une copie de secours et
un moyen de retrouver sa partie sur une autre machine. Cet ordre-là compte : il garantit le
hors-ligne et il évite de bombarder le réseau.

Si la sauvegarde `localStorage` n'existe pas encore dans le projet, **commence par elle** :
c'est elle la référence, le cloud vient se poser dessus.

## 3. Le contrat de tables (déjà créées, ne les recrée pas)

Deux tables, RLS activée, chaque joueur ne voit que ses propres lignes. Sans session
connectée, la clé anon ne voit **rien** (les droits d'anon ont été retirés explicitement).

```sql
-- Sauvegarde. Une ligne par (joueur, emplacement). Jusqu'a 3 emplacements.
game_saves (
  profile_id  uuid        -- = auth.uid(), clef avec slot
  slot        smallint    -- 1 a 3, defaut 1
  version     integer     -- version du format de sauvegarde, defaut 1
  data        jsonb       -- l'etat du jeu, 256 Ko maximum (contrainte en base)
  updated_at  timestamptz -- mis a jour tout seul par un trigger
)

-- Une ligne par partie terminee. Insertion seule : un score ne se retouche pas.
game_runs (
  id         uuid
  profile_id uuid
  vagues     integer      -- le score
  classe     text
  duree_s    integer
  meta       jsonb        -- 16 Ko maximum
  created_at timestamptz
)
```

Ce que ça implique concrètement :

- `data` est **un état, pas un journal**. Si tu approches des 256 Ko, c'est que tu stockes
  de l'historique ou des choses recalculables — allège au lieu de demander plus de place.
- `version` sert à refuser proprement une sauvegarde d'un format plus récent que le code
  qui la lit. Prévois le cas dès maintenant : « cette sauvegarde vient d'une version plus
  récente du jeu », plutôt qu'un plantage.
- Tu écris avec un **upsert** sur `(profile_id, slot)`, jamais un insert qui échoue.
- Tu ne renseignes jamais `profile_id` à la main avec autre chose que l'utilisateur
  connecté : la RLS le refuserait de toute façon.

## 4. Ce que tu dois construire

### a. Le client Supabase

`@supabase/supabase-js`, dans un module à part (par exemple `src/en-ligne/client.ts`).
`src/core/` reste pur : il ne connaît ni Phaser ni le réseau. Toute la partie en ligne vit
dans son propre dossier, derrière une interface minuscule, pour qu'on puisse l'enlever sans
toucher au jeu.

Configuration : `persistSession: true` (la session vit dans le `localStorage` du joueur,
il reste connecté), `autoRefreshToken: true`.

### b. La connexion

Email + mot de passe (`signInWithPassword`), c'est le compte The Circle. Pas d'inscription
dans le jeu : un lien « Créer un compte sur the-circle.pro » suffit.

L'écran de connexion est **facultatif et sautable** — un bouton « Jouer sans compte » qui
lance la partie immédiatement. Un joueur qui refuse le compte ne doit jamais être relancé
plus d'une fois par session.

Messages d'erreur honnêtes et en français : identifiants refusés, réseau injoignable,
compte inconnu. Jamais un message qui laisse croire que le jeu est cassé.

### c. La synchronisation

**Quand on sauvegarde en ligne** — uniquement sur des moments qui comptent :

- fin d'une vague ;
- entrée ou sortie du village ;
- passage d'un jour au suivant ;
- fermeture de la page (`visibilitychange`, pas `unload`).

Avec un **minimum de 60 secondes entre deux envois** (le dernier état gagne, on ne met pas
les envois en file). **Jamais de sauvegarde sur minuterie**, jamais pendant le combat.

La sauvegarde locale, elle, reste aussi fréquente que tu veux : elle ne coûte rien.

**À la connexion**, tu compares la sauvegarde locale et la copie cloud. Si elles divergent,
tu **demandes au joueur** laquelle garder, avec une phrase claire de chaque côté (« ici :
jour 14, 6 héros » / « en ligne : jour 11, 5 héros »). Tu n'écrases **jamais** une partie
automatiquement. C'est la seule règle de conflit acceptable pour un jeu où l'on peut perdre
quarante heures.

**Tout appel réseau est enveloppé** : échec = on garde la sauvegarde locale, on affiche un
petit indicateur discret (« hors ligne »), et on réessaie au prochain moment-clé. Aucune
erreur réseau ne remonte au joueur sous forme de popup.

### d. Les parties terminées

À la fin d'une partie, une insertion dans `game_runs` : vagues, classe, durée. Rien d'autre
dans `meta` pour l'instant.

Note honnêtement dans le code, en commentaire, que **ce score vient du client et qu'il est
falsifiable** : aucune récompense ne devra jamais en dépendre sans validation serveur.

## 5. La configuration

Deux variables, dans le `.env` du projet `jeux` (à demander à Angelos) :

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

La clé anon **est publique par nature** : elle est conçue pour être lue dans le bundle d'un
navigateur, c'est la RLS qui protège les données, pas le secret de la clé. Ne cherche donc
pas à la cacher, à la chiffrer, ni à inventer un serveur intermédiaire pour la masquer —
ce serait du travail pour rien.

En revanche : **rien d'autre ne rentre dans ce projet.** Pas de `service_role`, pas de mot
de passe de base, pas de token d'accès Supabase CLI. Si on te les propose, tu refuses.

## 6. Les pièges connus

- **Ne sers aucun asset depuis Supabase Storage.** Les sprites (`src/assets`, 0,12 Mo)
  restent dans le bundle. C'est le Storage qui a fait exploser la bande passante de The
  Circle par le passé — on ne recommence pas.
- **Pas d'abonnement Realtime.** Un jeu solo n'en a aucun besoin, et c'est une connexion
  permanente par joueur.
- **Pas de `select *`** ni de requête sans `limit`.
- **Ne touche jamais à la colonne `profiles.email`.** Dans ce projet, la sélectionner dans
  une requête visible par un visiteur non connecté fait échouer **toute** la requête. Tu
  n'as de toute façon pas à lire `profiles`.
- Le jeu tourne sur un autre domaine que The Circle : la session Supabase du jeu est
  **indépendante** de celle du site. Se connecter dans le jeu ne connecte pas au site, et
  inversement. C'est normal, ne cherche pas à partager le cookie.

## 7. Avant de dire que c'est fini

- `npx tsc --noEmit`, `npx vitest run`, `npm run build` — dans cet ordre.
- Un test qui vérifie que la sérialisation/désérialisation d'une sauvegarde fait un
  aller-retour fidèle. La logique de fusion locale/cloud doit être une **fonction pure et
  testée** dans `src/core/`, pas du code noyé dans une scène.
- **Tu ne peux pas jouer au jeu** : dis-le, et demande à Angelos de tester la connexion, la
  reprise sur une autre machine, et le cas « hors ligne complet ».

## 8. Ce que tu dois demander à Angelos avant de commencer

1. Les deux variables du §5.
2. Ce qui doit entrer exactement dans la sauvegarde (village, héros, jour, ressources… ?)
   si `DESIGN.md` ne le tranche pas déjà.
3. Un ou trois emplacements de sauvegarde ?

Commence par lui dire ce que tu as compris et ce que tu comptes faire en premier, avant de
coder.
