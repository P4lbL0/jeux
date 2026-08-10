# Prompt de reprise

> Colle tout ce qui suit dans une nouvelle session, à la racine du projet.
>
> Dernière mise à jour : 2026-08-10 (**la sauvegarde existe**, en local et en copie sur
> le compte The Circle — §4.28, codé, testé et joué. Avant ça, le bloc 5 : traits,
> stress, états, séquelles, statistiques, portraits, fiche unifiée et renommage).
> **282 tests verts.**
>
> **Le prochain morceau est le bloc 6 du jalon 5 : les arrivées et le port.**
> Tout est écrit dans `design/4.18-les-habitants.md` et `design/4.10-interface.md`.
>
> Le bloc 6 a maintenant tout ce qui lui manquait : les **portraits** (la fiche
> d'observation en a besoin), les **traits** (un pyromane est un indice à lui seul), et
> l'**église** (« il refuse d'y entrer »). C'est exactement pour ça qu'il passait après.

---

Tu reprends un projet de jeu vidéo en cours. C'est mon premier jeu, je ne suis pas
développeur, et je décide du design — toi tu construis et tu me signales ce qui cloche.

## Ce que c'est

**Le Protecteur** : un roguelike vu de dessus, en pixel-art, avec de la gestion de
village. Post-apocalyptique. On est le Protecteur d'un village en ruine, on repousse des
vagues de monstres sans fin, on restaure le village entre deux, et on recrute des héros.

Le combat est un **survivors-like** : le joueur ne contrôle que son **déplacement** et
ses **capacités**. L'attaque, la visée et l'esquive sont automatiques.

## Avant de toucher au code

1. **Lis `DESIGN.md`** — c'est le **sommaire**. Le contenu vit dans `design/`, un fichier
   par section (`design/4.18-les-habitants.md` = le §4.18). Le document faisait 1800
   lignes et a été découpé le 2026-08-09 ; **la numérotation en § n'a pas bougé**, donc
   tous les renvois du code (`DESIGN.md §4.18`) restent valables.
2. **Lis au minimum** `design/05-ordre-de-construction.md` (quoi coder ensuite),
   `design/06-questions-ouvertes.md` (ce qui n'est pas tranché) et
   `design/4.17-tenir-la-fluidite.md` (ses cinq règles ne se négocient pas). Puis les
   sections de ce que tu vas toucher.
3. **Lis `README.md`** pour la structure et les commandes.

Si le code et le document se contredisent, c'est le code qu'on corrige.

## Comment je veux qu'on travaille

- **En français**, dans le code comme dans les échanges. Les commentaires expliquent
  *pourquoi*, jamais *quoi*. Pas d'accents dans le code (les fichiers sources sont en
  ASCII), mais accents normaux dans les fichiers Markdown.
- **`src/core/` ne connaît pas Phaser.** C'est la logique pure, et elle est testée.
  Tout ce qui touche à l'affichage vit dans `src/game/` et `src/scenes/`.
- **Le contenu est séparé du système.** Les classes, les compétences et leurs chiffres
  sont des données dans `src/core/`, pas du code éparpillé.
- **Tu écris le design dans `DESIGN.md` avant de le coder.** Quand je te donne une idée,
  tu la notes d'abord, tu me dis ce que tu en penses honnêtement — y compris quand tu
  penses que c'est une mauvaise idée — puis tu la codes.
- **Pose-moi des questions à choix** plutôt que des questions ouvertes.
- **Vérifie toujours** : `npx tsc --noEmit`, puis `npx vitest run`, puis `npm run build`.
- **Commits en français**, un par bloc de travail, poussés sur
  `https://github.com/P4lbL0/jeux.git`.
- Ne me dis jamais que quelque chose marche si tu ne l'as pas vérifié.

### Tu peux jouer au jeu toi-même — sers-t'en

Ça a permis de trouver plusieurs bugs que la compilation ne voyait pas — dont deux du
jalon 5 : les habitants qui fuyaient droit dans la horde, et le village qui démarrait avec
quatre habitants au lieu de trois. Playwright est déclaré en `devDependencies`.

La recette qui marche :

1. `npx vite --port 5199 --strictPort` en tâche de fond.
2. Un script Node qui lance Chromium, va sur `http://localhost:5199/`, attend ~3 s, puis
   appuie sur **`Digit1` deux fois** : la première choisit l'emplacement de sauvegarde
   (l'écran de départ, §4.28), la seconde la classe. Attendre ~1 s entre les deux.
   ⚠️ Chaque contexte Playwright a son propre `localStorage` : les trois emplacements
   sont vides à chaque lancement, sauf si on garde le même contexte.
3. **Appuyer sur `Digit1` régulièrement** : le menu de choix de compétence met le jeu en
   pause et le fige tant qu'on ne choisit pas. Sans ça la partie s'arrête à ~45 s et on
   croit à un bug.
4. Pour inspecter l'état, exposer temporairement le jeu dans `src/main.ts`
   (`(window as ...).__jeu = jeu;`) — **et le retirer après**.
5. Pour aller vite : une journée dure 30 minutes réelles, on ne l'attend pas.
   `arene.cycle.ecoule = arene.cycle.duree - 30` force la bascule à l'image suivante, et
   `arene.cycle.jour = 8` fait monter la puissance de la nuit d'un coup.
6. Enrober les méthodes du prototype (`Object.getPrototypeOf(arene)`) pour compter les
   appels réels. C'est la seule mesure qui ne suppose rien.

Deux pièges rencontrés : `ANIMATION_START` est émis par **le sprite**, pas par le
gestionnaire global (`arene.anims.on("start")` ne capte rien) ; et un instantané unique
ne prouve rien sur un événement bref — il faut échantillonner dans la durée.

## Ce qui est déjà fait

**Jalons 0 à 4 terminés**, et les **blocs 1 à 5 du jalon 5** (voir §5 de `DESIGN.md`) :

- Vite + TypeScript + Phaser 3, tests avec Vitest. **282 tests verts.**
- Sept classes jouables, attaque automatique, traits de classe, ultimes.
- Une équipe : un héros incarné, les autres joués par l'IA.
- **La règle des 20%** — le cœur du jeu : l'IA se replie à 20% de vie et ne perd jamais
  un héros ; le joueur ne peut pas changer de héros sous 20% ; la mort est définitive.
- XP, niveaux, **choix de compétence tous les 5 niveaux** (met le jeu en pause).
- **Plus de 70 compétences** : passives, actives, automatiques, à paliers, avec des
  évolutions qui changent leur nature et la couleur du héros.
- **Ordres, postures et formations** (§4.4), commandement des sbires, **expérience de
  groupe** (§4.16).
- **La carte** : village adossé à la mer et à la montagne, flancs fermés, fronts qui
  s'ouvrent par nuit (§4.6).
- **Le cycle jour/nuit et les habitants** (§4.18, §4.19) — voir le détail plus bas.
- Interface dans une scène séparée (`UiScene`), fiche de héros au clic.

### Les vrais sprites (brief graphismes — terminé sauf §5)

Les placeholders générés par code sont toujours là en **filet de sécurité**
(`src/game/art.ts`, chaque fonction gardée par `if (scene.textures.exists(cle)) return;`),
mais **30 PNG réels** vivent maintenant dans `src/assets/` et sont ramassés
automatiquement par `src/game/assets.ts` (glob Vite, le nom du fichier = la clé de
texture). Personnages en 32×32, sols en 64, maisons en 48.

⚠️ **PixelLab est à 0 crédit.** `scripts/generer-assets.ts` ne peut plus rien produire.
Tout ce qui est visuel doit donc se faire en code ou avec des assets gratuits.

### Le jalon combat & monstres (`BRIEF-COMBAT-ET-MONSTRES.md`) — terminé sauf §5

- **`src/game/effets.ts`** — impacts, poufs de mort, tranches, flashs, secousses,
  hitstop, recul. Émetteurs de particules **créés une fois** et réutilisés, quota de
  14 gerbes par image, hitstop rendu sur horodatage.
- **Les monstres attaquent vraiment.** `contactEnnemi` ne blesse plus : il **arme**. Le
  monstre se cabre (pose `charge`, teinte d'avertissement, vitesse à 25 %), puis
  `resoudreFrappe` applique les dégâts à échéance — piloté par horodatage dans la boucle
  existante, aucune minuterie ajoutée. Un coup peut **partir dans le vide** si la cible
  s'est écartée (~7 % de ratés mesurés en jeu).
- **`src/game/ennemis.ts`** — 6 archétypes en table déclarative, testés : `fonceur`,
  `essaim` (petit/rapide), `revenant` (sprite `mort-vivant`), `cracheur` (tire à
  distance), `brute` (×1,4, télégraphe de 620 ms), `kamikaze` (clignote puis explose).
  Verrouillés derrière des seuils de puissance ; le fonceur reste majoritaire.
- Mesuré en jeu : 42 FPS à 240 ennemis, aucune erreur console, hitbox du héros
  **inchangée (8×10)**.

### Les animations (fait après le brief, pas dans un brief)

`poses.ts` faisait tourner les sprites faute de planches. Il annonçait sa propre fin —
elle est arrivée. **Il choisit maintenant quelle animation jouer, et l'angle reste à 0.**

- **`scripts/animer-sprites.ts`** — il ne *génère* rien, il **recompose**. Chaque sprite
  est coupé à la hanche, et chaque frame incline le buste ou balance les jambes **autour
  de ce pivot**. Les pixels sortis sont exactement les pixels d'entrée : la direction
  artistique ne peut pas dériver. Gratuit, hors-ligne, instantané, illimité.
- **`scripts/png.ts`** — lecture/écriture PNG avec le `zlib` de Node, **sans dépendance**.
- **7 animations × 12 personnages** : `repos`, `marche`, `attaque`, `charge`,
  `incantation`, `touche`, `mort`. Une seule planche par personnage
  (`src/assets/anims/`), plus un `manifeste.json` généré qui porte les plages de frames.
- Régénérer : `npx tsx scripts/animer-sprites.ts` (`--planche` ajoute une image de
  contrôle agrandie dans `.tmp/`). **Le script se fiche de la taille de la source** : si
  les sprites repassent en 64 px un jour, on relance sans rien changer.

### Le bloc 2 du jalon 5 — le cycle jour/nuit et les habitants

Le jeu ne s'organise plus en vagues, mais en **journées** (§4.19) : 30 minutes de jour,
15 minutes de nuit.

- **`src/core/cycle.ts`** — pur et testé. **Une seule table, `REGLAGES_CYCLE`**, porte
  toutes les durées et tous les effectifs. C'est le seul endroit à toucher pour re-régler
  le rythme, et c'est justement ce qu'il faut trancher en jouant.
- La nuit a un **effectif défini**, pas un robinet : épuisé avant l'aube, plus rien ne
  vient. Le plafond d'écran est passé de **240 à 60**.
- Le calendrier des espèces n'est écrit nulle part : il tombe de la rencontre entre
  `puissanceParNuit` et les seuils de `ennemis.ts` — une espèce nouvelle par nuit pendant
  six nuits.
- Le jour n'est jamais sûr : une **horde** peut tomber à tout moment, annoncée 6 s avant.
- **`src/core/habitants.ts`** (règles) et **`src/game/village.ts`** (sprites) : trois
  habitants au départ, le niveau se gagne en travaillant, le rang s'achète, et l'un comme
  l'autre ne changent que la **cadence**. Ils fuient en se **courbant autour** de la
  menace, pas en ligne droite vers le village.
- La faim arrête le travail sans tuer. Un village entièrement affamé ne peut plus se
  nourrir seul — la sortie, c'est d'aller pêcher soi-même, et l'annonce le dit.
- **Plus un seul habitant vivant = partie terminée.**
- La récolte à la main se fait **en frappant**, et seulement le jour. Mesuré en jeu :
  ~98/min pour le joueur contre 6/min pour un habitant de rang F.
- **La pause hors focus** : fenêtre en arrière-plan, tout s'arrête — et le temps est rendu
  au retour (`decalerLeTemps`), sinon la nuit entière frapperait dans l'image de la reprise.

Touches ajoutées : **`B`** la cloche (tout le monde rentre), **`F`** le tableau du village.

### Le bloc 3 — la grille, les murs, les tours et les champs

- **`src/core/grille.ts`** — la carte devient modifiable sans rien jeter : les formules de
  `carte.ts` la **cuisent** au démarrage (~3000 cases de 32 px), et une couche d'écriture
  encaisse murs, champs, ruines et demain les cratères. Un test vérifie case par case que
  cuire la carte ne la change pas.
- **Le camping est fermé — et le problème n'était pas celui que je croyais.** Se planquer
  n'était pas seulement toléré, c'était *optimal* : un monstre visait le héros le plus
  proche où qu'il fût, donc un joueur caché attirait toute la vague sur lui et protégeait
  ses habitants sans rien faire. Un héros n'est cible que dans `RAYON_DE_VUE` (340 px) ;
  au-delà, le monstre continue vers le village.
- **`src/core/constructions.ts` + `src/game/constructions.ts`** — palissade et tour. Une
  **tour est une position, pas une arme** : +120 de portée, occupant hors de portée de la
  mêlée, et quand elle tombe il tombe avec elle. Touches `G`, `H`, `T`.
- **`src/game/champs.ts`** — semis (`J`), maturation pilotée par la cadence des fermiers,
  moisson automatique, piétinement par les hordes. La pluie du jalon 6 n'aura qu'à
  multiplier `croissanceParSeconde`, le point d'accroche est déjà là.
- **Le poste des champs commence vide** : le village garde ses trois habitants, et y
  mettre un fermier veut dire le retirer du bois ou du minerai. Clic droit sur une ligne
  du tableau change le poste, clic gauche la posture.
- Conséquence sur le cœur : `PRODUCTION.fermier` vaut `null` et `cadence()` ne regarde
  plus ce que le métier récolte — sinon le fermier comptait deux fois.

### Le bloc 4 — l'église (fait le 10 août 2026)

- **`src/core/eglise.ts`** — pur et testé (25 tests). Une table `PALIERS` porte les quatre
  niveaux, une table `CONDITIONS` porte leurs quatre conditions. C'est le seul endroit à
  toucher pour re-régler l'église.
- **Les chiffres tranchés** : **1200 PV** (+600 par niveau), **rayon de soin de 90 px**
  (+30 par niveau, contre 150 px pour l'ancien cercle du village), relèvement à **120 bois
  et une journée entière**.
- **L'argent et la satisfaction sont neutralisés, pas oubliés.** Les quatre conditions sont
  écrites en entier ; `ContexteMontee.argent` et `.satisfaction` sont **optionnels**, et
  `undefined` veut dire « ce système n'existe pas encore », surtout pas « zéro ». Les blocs
  5 et 6 n'auront que deux champs à remplir.
- **Le refuge a changé de nature** : un habitant **entre dans le bâtiment** (sprite caché,
  corps désactivé) et n'est protégé que tant qu'elle tient. L'ancien « arrivé au village
  donc à l'abri » n'a jamais protégé de rien — `rattraperHabitant` tuait quand même.
- **Les soins ne viennent plus que d'elle**, et **zéro quand elle est à terre**. Conséquence
  assumée : un héros IA en repli reste en repli, hors du combat, jusqu'à ce qu'elle se
  relève.
- **Les monstres ont l'église pour cap** (`cibleDe(e) ?? EGLISE`) et la frappent.
- **Les habitants ont un bloc de combat** (§4.18) — PV, dégâts, portée, cadence, dérisoires.
  Un courageux ressort tenir les portes ; un défenseur **encaisse** au lieu de mourir au
  contact, sinon sortir défendre serait un suicide pur.
- Touche **`Y`** : monter l'église d'un niveau, ou relancer son chantier. Le refus dit
  toujours ce qui manque.

⚠️ **Trois bugs trouvés en jouant, aucun visible à la compilation** — c'est le meilleur
argument pour continuer à jouer chaque bloc :

1. `physics.add.image` crée un corps **dynamique**, et `physics.add.existing(sprite, true)`
   **ne remplace pas** un corps déjà posé. L'église avait donc un corps dynamique et les
   monstres la **poussaient** : 190 px de dérive en quelques secondes, pendant que le refuge
   et le cap restaient sur la constante `EGLISE`. Utiliser `staticImage`.
2. **Phaser inverse les arguments du collider** quand on fait se rencontrer un groupe et un
   objet unique. Ne jamais supposer l'ordre : tester lequel des deux est lequel.
3. `marquerLaMort` **n'est que le visuel** — il faut détruire le sprite soi-même, sinon le
   monstre survit avec des points de vie négatifs.

### Le bloc 5 — les traits, le stress et les états (fait le 10 août 2026)

**Héros et habitants partagent enfin un seul système.** C'est le vrai résultat du bloc :
`core/personne.ts` porte ce qu'ils ont en commun, et les deux populations le lisent.

- **`src/core/traits.ts`** — 15 traits de naissance, 11 d'exploit, 5 séquelles, et
  **l'agrégat**. Les traits sont stockés **par identifiant numérique** (l'index dans
  `TRAITS`) et leurs effets sont fusionnés **une seule fois** quand quelque chose change.
  Porter trente traits ne coûte pas une multiplication de plus qu'en porter zéro.
  ⚠️ Un test vérifie que l'index n'a pas bougé : réordonner la table changerait les traits
  de tout un village sans qu'aucun type ne bronche.
- **`src/core/etats.ts`** — maladie et blessure en 3 paliers sur 6 journées, **hémorragie
  qui tue en une journée**, **infection fongique contagieuse**, léthargie. Le stade
  *Mourant* est **la seule source de séquelles du jeu**.
- **`src/core/personne.ts`** — les 3 statistiques **en pourcentage**, le stress, la
  rupture, les compteurs d'exploits. Une seule table, `REGLAGES_STRESS`.
- **`src/core/satisfaction.ts`** — et **elle est branchée** : `ContexteMontee.satisfaction`
  est rempli, donc la 3ᵉ des 4 conditions de l'église mord pour de bon. Seul `argent` reste
  `undefined` — il vient du port, au bloc 6. La boucle du §4.23 est refermée.
- **`src/game/portraits.ts`** — **onze couches**, plus de dix millions de combinaisons,
  plus une couche d'état (pâleur, cernes, balafre, regard fuyant). Cache **plafonné à 96
  textures**, le plus ancien détruit.
- **`src/game/fichePersonne.ts`** — **une seule fiche** pour les deux populations, et
  `ficheHero.ts` a été supprimé. Renommage au clic sur le nom, avec les touches du jeu
  coupées pendant la saisie.

⚠️ **Trois bugs trouvés en jouant, aucun visible à la compilation** — le même score qu'au
bloc 4, et le même argument :

1. **En JavaScript, `^` rend un entier *signé*.** Le mélangeur de graine des portraits
   finissait négatif une fois sur deux, `x % longueur` aussi, et `banque[-3]` vaut
   `undefined` : **la fiche plantait à l'ouverture**. TypeScript ne voit rien, le type est
   `number` dans les deux cas. Il faut un `>>> 0` final.
2. **La barbe était dessinée après la bouche**, donc elle la recouvrait entièrement. Un
   visage sans bouche ne peut plus rien exprimer, ce qui vide de son sens toute la couche
   d'état. L'ordre de dessin est du contenu, pas du détail.
3. **Cliquer un nom puis taper donnait « AubinBertrand ».** La première frappe doit
   remplacer — c'est la convention de tout champ qu'on ouvre sur un contenu déjà là.

Et une correction de design venue du jeu : **les héros ont un prénom**. La fiche affichait
« Guerrier » en titre et « Guerrier · niveau 1 » juste en dessous. Héros et habitants
tirent maintenant dans la même liste (`PRENOMS`), ce qui prépare le passage
villageois → héros du bloc 9.

### La sauvegarde et le compte The Circle (fait le 10 août 2026, §4.28)

**Rafraîchir la page n'est plus une nouvelle partie.** La sauvegarde vit dans le
`localStorage`, sur **trois emplacements**, et une copie optionnelle part sur la base
Supabase de **The Circle** quand un compte est connecté.

- **`src/core/sauvegarde.ts`** — pur et testé (23 tests). Il décrit la forme d'une
  partie, sait l'écrire, la relire, et **comparer** deux copies. `comparer` ne choisit
  pas : il décrit. Le seul écrasement automatique du jeu est celui d'un cloud
  **strictement en retard sur la même lignée** ; tout le reste passe par une question au
  joueur, avec une phrase de chaque côté.
- **Un état, jamais un journal.** `mods` (l'agrégat des traits) n'est pas enregistré, il
  se refait ; les monstres vivants non plus, la nuit se recompose depuis le cycle. Une
  partie de jour 15 avec du bâti pèse **6,7 Ko** — le plafond de la base est à 256 Ko.
- **`src/game/sauvegarde.ts`** — le pont. Il capture depuis une interface de quinze
  champs, pas depuis la scène : `ArenaScene` fait 4200 lignes et n'a rien à faire là. La
  reprise **rejoue les compétences palier par palier** au lieu de recopier `bonus` — un
  bonus recopié aurait dérivé au premier rééquilibrage.
- **`src/en-ligne/`** — le seul dossier qui connaît le réseau, **retirable en entier**.
  Le client refuse toute clé qui n'est pas `anon` (le rôle est lu dans le jeton). Upsert
  sur `(profile_id, slot)`, **60 s minimum entre deux envois**, aucun `await` réseau sur
  le chemin de démarrage, aucune erreur réseau en popup.
- **`src/scenes/MenuScene.ts`** — les trois emplacements, le compte, et l'écran
  d'arbitrage. Pas d'inscription dans le jeu : un lien vers `the-circle.pro`.
- **⚠️ Règle ironman** (tranchée le 10 août) : on écrase aux moments-clés, **mort
  comprise**. C'est ce qui protège la mort définitive du §4.3 — sans ça, fermer un
  onglet annulerait la perte d'un héros.

**Ce qui a été vérifié en jouant** (Playwright, aucune erreur console) :

| Vérifié | Résultat |
|---|---|
| Aller-retour complet | Jour 15, stocks, 7 héros, habitants, palissade, tour, 3 champs et leur maturité : tout revient à l'identique |
| L'ironman | Un héros mort avant la sauvegarde est **toujours mort** après rechargement |
| Un habitant marqué | Nom, rang, niveau, stress 88, maladie palier 1 : intacts, `mods` refait |
| Supabase injoignable | Le menu s'affiche, la partie se lance, tourne à **44 FPS**, s'enregistre et se reprend |
| Identifiants refusés | Le vrai serveur répond, et le message est « Adresse ou mot de passe refusé » |
| Réseau coupé à la connexion | « Serveur injoignable. Tu peux jouer hors ligne » — et on joue immédiatement derrière |

⚠️ **Un bug trouvé en jouant, invisible à la compilation** : `MenuScene` affichait le
damier de texture manquante de Phaser, parce qu'elle utilisait `carte` sans appeler
`creerTexturesPlaceholder`. **C'est exactement le piège déjà rencontré à l'écran de
choix de classe** — les textures dessinées au code ne sont pas chargées par le boot, il
faut les demander dans chaque scène qui s'en sert.

⚠️ **Ce qui reste à faire tester par Angelos** : je n'ai pas de compte The Circle, donc
la connexion réussie, la reprise **sur une autre machine** et le conflit local/cloud
n'ont jamais été vus de bout en bout. Le refus d'identifiants et la panne réseau, si.

### Ce que la mesure a donné

- **Le stress monte deux fois moins vite que visé.** Une nuit dehors sans se faire toucher
  ne rend que **5 à 8 points** ; ce sont les **coups encaissés** (1,5 chacun) qui dominent.
  Ça veut dire que ce qui use, c'est de se battre, pas de veiller — pas forcément un
  défaut, mais ce n'est pas ce qui était visé. Reste au §6.
- **La satisfaction tourne à 50-51** pour un village calme dès le premier jour, donc le
  seuil de 40 du niveau 2 est atteignable. Vérifié en jeu : avec une satisfaction de 5,
  l'église renvoie bien `satisfaction` dans ce qui manque ; avec la vraie, non.
- **Les boucles de moral ne coûtent rien de mesurable** : 38 FPS avec, 36 sans — dans le
  bruit. Les deux tournent par **battements de 500 ms**, gardés par horodatage.

### Tout de suite

1. **Coder le bloc 6 : les arrivées et le port** (§4.18, §4.10). La fiche d'observation est
   un **mode de plus de la fiche unifiée**, pas une interface neuve — `SujetFiche` est une
   union, il n'y a qu'un cas à ajouter.
2. **Juger les animations en jouant.** Le mouvement est volontairement discret (1 à 2 px)
   parce qu'à 32 px, 3 px disloquent le personnage. Amplitudes en haut de
   `scripts/animer-sprites.ts`.
3. **Régler le stress sur une vraie partie.** Il n'a jamais tourné plus de deux minutes
   d'affilée, et personne n'a encore craqué en conditions réelles.
3. ✅ **Le `feedback.md` a été traité** (session du 8-9 août). Tout est tranché et écrit
   dans `DESIGN.md` : appétit des héros, totem, fous, humeurs, renommage, options.

### ⚠️ Le design du village a été entièrement refondu les 8 et 9 août 2026

**Le bloc 4 (l'église) est maintenant codé** ; tout le reste de cette refonte attend
toujours son code. L'écart s'est réduit, il n'a pas disparu.

**Deux décisions du 10 août annulent des règles défendues ailleurs**, et les paragraphes
périmés ont été réécrits plutôt que laissés en place :

- **Il n'y a aucun abri magique.** Un habitant entre dans l'église et n'est protégé que tant
  qu'elle tient debout ; se tenir à côté ne protège de rien. La vraie défense est **celle
  qu'on bâtit** — murs améliorables au fer, porte cassable, douves, douves en eau,
  ponts-levis. Tout ça est écrit au §4.20 et **codé au bloc 7**, avec le mode d'aménagement.
- **Les habitants ont de vraies statistiques de combat** (§4.18). Ça annule frontalement la
  règle « pas de statistiques de combat », qui était écrite au §4.18, au §4.20 **et** au
  §4.22. La raison qui l'emporte : **les futurs héros sortent du village**, donc un habitant
  sans rien de mesurable deviendrait héros par magie. Trois garde-fous tiennent la digue :
  aucune compétence ni évolution ni point à distribuer, dix miliciens ne remplacent pas un
  héros, et se battre empêche de produire. L'entraînement, les **miliciens** qui patrouillent
  les rues et le passage **villageois → héros** ont leur propre bloc (le bloc 9).

Ce qui a changé, et il y en a beaucoup :

- **L'église devient le cœur du jeu** (§4.22, section neuve) : refuge des civils, **seul**
  lieu de soin, lieu de purge des états, origine de l'Oracle, et **cap des monstres** — ils
  marchent vers elle, les héros les en détournent dans leur rayon de vue. Le cercle
  `VILLAGE` de `carte.ts` n'est plus le refuge. Elle est **debout au niveau 1** dès le
  départ, elle monte en **quatre niveaux** qui exigent chacun **quatre conditions à la
  fois** (argent, matériaux, population, satisfaction), et si elle tombe **ce n'est pas une
  défaite** : elle se relève, mais tout s'effondre en attendant.
- **Traits, stress et états** (§4.23, section neuve, la plus grosse). Les traits sont
  **illimités, faibles, et le plus souvent mauvais** — l'expérience use plus qu'elle ne
  renforce. Ils s'obtiennent **par exploit**, jamais par tirage. Et **tout le monde a une
  jauge de stress à la Darkest Dungeon** : à 100 % il craque (paranoïa, terreur, rage,
  abattement, ou rarement il se transcende), à 200 % le cœur lâche. Les civils craquent
  aussi mais **ne frappent jamais personne**. Un état non soigné tue en **5 à 7 jours**, en
  trois paliers annoncés.
- **Ça annule la vieille règle du §4.18** qui interdisait le second écran de personnage.
  Le §4.18 a été réécrit pour le dire au lieu de le taire.
- **Le joueur aménage son village** à la Clash of Clans (§4.24, section neuve) : mode
  édition **en pause**, construction libre partout, déplacement **gratuit et instantané**,
  **tout ce qui est bâti se casse** (maisons comprises — ça remonte du jalon 8 au jalon 5),
  village qui **démarre en ruines**.
- **Le port et le commerce maritime** (§4.18) : un bâtiment sur la plage, donc jamais
  attaquable. On vend son surplus contre de l'**argent**, et les navires **amènent du
  monde**. C'est ce qui donne enfin un usage à l'argent du §4.8 et une raison de produire
  au-delà de ses besoins.
- **Les arrivées dépendent de la réputation et du commerce**, jamais du hasard seul. Chaque
  arrivant montre **3 indices sur 6** ; un innocent en montre 0 à 1, un fou 2 à 3. Le
  passage à l'acte reste un **tirage caché** — ça contredit sciemment « une perte vient
  toujours d'un arbitrage », c'est assumé et payé par trois contreparties. Et **les fous
  forment des groupes** : le risque devient exponentiel, pas additif.
- **La porte se joue sur une fiche d'observation** (§4.10) : portrait, observations,
  questions à poser, et c'est **le portrait qui trahit le mensonge** (regard fuyant) plutôt
  qu'une ligne de texte. Pas de moteur de dialogue — les questions sont des données.
- **Les portraits sont assemblés par morceaux en code** (§4.23), pour qu'ils changent avec
  l'état du personnage. La population n'a pas de plafond, donc un portrait par personne doit
  coûter zéro.
- **N'importe qui peut recevoir n'importe quelle tâche** (§4.4), héros et habitants
  confondus, par sélection puis **menu d'ordres**. Un héros au travail produit beaucoup plus
  vite, **mais seulement le jour et ça le fatigue**.
- **Une satisfaction du village** (§4.23) : moyenne des humeurs + morts récents + confort +
  décorations. C'est elle qui débloque les niveaux d'église, et la boucle se referme.
- Totem **consommé à l'usage** (§4.3). Héros nourris par **ration forfaitaire** (§4.18).
  **Pas de plafond dur** de population. **Fiche unique** héros/habitants avec renommage, et
  menu d'**options** (§4.10). **Pas de dégâts physiques/magiques séparés.** Rythme **30/15
  inchangé**.

### ⚠️ Deuxième vague de design, le soir du 10 août 2026

Deux paquets de notes brutes traînaient depuis des jours — 750 lignes à la fin du §4.23 et
le fichier `COMPETENCES_MAGIC_SURVIVAL_LE_PROTECTEUR.md` en entier. **Tout a été dépouillé
et transformé en design.** Trois sections neuves, et aucune ligne de code écrite pour
l'instant :

- **§4.25 — tags, fusions et synergies.** L'échelle qui verrouille tout (palier → évolution
  → fusion → synergie → mythique), les **tags** (⚠️ un élément est un tag, **jamais** un
  type de dégâts — le §4.2 tient), **aucune limite d'emplacements** mais une fusion en
  **consomme deux**, **26 fusions** dont 4 secrètes, 3 synergies, et **les traits qui
  pondèrent la pioche** (un Pyromane voit le FEU ×3). Plus quatre familles hors combat :
  sociales, de groupe, de formation, et **du village** (« TOUT LE MONDE AU MUR »).
- **§4.26 — la mémoire du village.** Les **relations** (système *séparé* de l'affinité du
  §4.16 : l'affinité est militaire, la relation est sociale), les souvenirs bornés à huit
  entrées, ce qu'une mort produit, l'**héritage immatériel** (l'équipement est reporté), et
  les **légendes assemblées à partir de gabarits** — jamais générées librement.
- **§4.27 — la vie autonome.** La journée qu'on enchaîne sans ordre, et des **initiatives
  rares** déclenchées quand un trait fort rencontre une situation extrême. On ne fait
  **pas** la simulation complète à la WorldBox — 90 % de l'effet pour 10 % du coût.

Et dans les sections existantes :

- **§4.23** : une **cinquième couche**, la **séquelle** (survivre au stade *Mourant* laisse
  un handicap lourd et ineffaçable — le meilleur dilemme du document) ; 8 traits de plus ;
  trois états hors rythme dont l'**hémorragie qui tue en une journée** et l'**infection
  fongique contagieuse** ; et **trois statistiques** — Force, Courage, **Intelligence**
  (bâtir moins cher, monter plus vite).
- **§4.7** : la liste des défenses est enfin tranchée, en quatre familles. **Ce qui tire
  est au §4.7, ce qui bloque reste au §4.20** — le doublon murs/portes/douves est supprimé.
- **§4.1** : deux classes très rares de plus, le **Voidwalker** et le **Bastion** (immobile
  seulement pendant son ultime, sinon il attaquerait le pilier « bouger est amusant »).
- **§4.12** : un héros peut désormais basculer en antagoniste **pendant** la partie, via le
  stress et les séquelles — et c'est annoncé plusieurs fois avant.
- **§4.18** : la **banque**, et les **pillards humains qui attaquent de jour**. Jalon 8.
- **§5** : le jalon 5 passe à **douze blocs**, et un **jalon 6.5** neuf porte les builds.

**Non tranché**, laissé au §6 : la double spécialisation (Guerrier + Gardien → Templier).

> **La règle de travail qui va avec** : sa dernière décision prime sur le design, même
> quand elle contredit frontalement une règle défendue ailleurs — « ça change tout le
> temps », ce sont ses mots. On signale la contradiction **une fois**, avec ce qu'elle
> coûte, puis on **réécrit le paragraphe périmé** plutôt que de le laisser mentir.

### ⚠️ Le périmètre a triplé en deux jours, et il faut le dire

Le jalon 5 est passé de 3 blocs à 9. Un survivors-like porte maintenant : gestion de
village, économie à 4 ressources + argent, commerce maritime, traits, stress à la Darkest
Dungeon, portraits procéduraux, aménagement à la Clash of Clans, et un système d'ordres
pour trente personnes. **Chaque morceau est bon ; l'ensemble est un très gros jeu.**

Ça ne bloque rien — c'est son projet, il en décide, et il a été prévenu. Mais quand un bloc
dérape, le bon réflexe est de **livrer la version minimale qui se joue** et de le dire, pas
d'étendre encore.

### Jalon 5 — le village *(blocs 1 à 5 faits, 6 à 12 à faire)*

L'ordre est fixé au §5 du design, et **il a été réordonné le 9 août pour cause de
dépendances** :

| Bloc | Contenu |
|---|---|
| **4** ✅ | **L'église** : on y entre, soins, cap des monstres, ses 4 niveaux et leurs 4 conditions, destruction et relèvement, bloc de combat civil |
| **5** ✅ | **Traits, stress et états**, séquelles, 3 statistiques, portraits assemblés, fiche unifiée, renommage, satisfaction |
| **6** | **Les arrivées** : fiche d'observation, les 6 indices, les fous et leurs groupes, naissances, survivants, **le port et le commerce** |
| **7** | **Mode d'aménagement** : édition en pause, construction libre, tout se casse, village en ruines, sol et chemins — et **la forteresse** : murs au fer, porte, douves, eau, pont-levis |
| **8** | **Les ordres pour tous** : n'importe qui fait n'importe quoi, menu d'ordres, héros au travail |
| **9** | **Le village armé** : entraînement au combat, métier de milicien, passage villageois → héros |
| **10** | Confort : options, pause Échap, touches remappables |

**Pourquoi cet ordre et pas celui d'avant.** Les arrivées étaient prévues en premier parce
qu'elles étaient déjà écrites. Elles ne peuvent plus : la fiche d'observation a besoin des
**portraits**, les six indices ont besoin des **traits** (un pyromane est un indice à lui
seul), et « il refuse d'entrer dans l'église » a besoin de **l'église**. Les coder d'abord
voudrait dire les recoder après.

L'église passe donc en tête — ce qui tombe bien, c'est le système le plus important du
jalon et celui qui touche le code le plus fragile : `dansLeVillage`, le refuge des
habitants (`village.ts`), les soins des héros (`majEtats` dans `ArenaScene.ts`) et le
ciblage des monstres. **C'est là qu'il y a un vrai risque de régression.**

### ComfyUI est installé en local (2026-08-09)

`C:\Users\lemir\Desktop\Projet\outils\ComfyUI`, hors du dépôt de jeu, avec son venv Python
3.11 et SD1.5. La RTX 1000 Ada (6 Go) suffit. **C'est la réponse au « PixelLab à 0
crédit »** pour tout ce qui est **image fixe** — bâtiments, décor, icônes : le problème de
cohérence entre frames qui interdisait de l'utiliser pour les personnages animés ne se
pose pas ici.

La chaîne complète est en place et **elle marche de bout en bout** :

```bash
powershell -ExecutionPolicy Bypass -File scripts/demarrer-comfyui.ps1   # le serveur
npx tsx scripts/generer-batiment.ts eglise "a small medieval chapel"    # 512 px
npx tsx scripts/pixelliser.ts .tmp/generation/eglise.png src/assets/eglise.png --taille 64
```

`pixelliser.ts` détoure le fond magenta par diffusion depuis les bords, réduit par moyenne
de bloc, et **recale les couleurs sur la palette relevée dans `src/assets/`** — même
principe qu'`animer-sprites.ts` : la direction artistique ne peut pas dériver, puisque les
couleurs de sortie *sont* celles du jeu.

> ⚠️ **Mais le résultat est aujourd'hui moins bon que le placeholder dessiné en code, et
> c'est mesuré, pas supposé.** Trois générations comparées à `creerEglise()` :
>
> - « top-down » donne une photo au ras du sol avec un ciel et des nuages. **« isometric »
>   est le mot qui marche** — il est massivement représenté dans les données de jeux vidéo.
> - Le fond uni doit être **pondéré** (`(...:1.6)`), sinon le modèle le traite comme une
>   suggestion et le détourage échoue. Et même pondéré, **le magenta bave sur le sujet** :
>   vitraux et bordures de toit repartent en rose, puis en rouge sale après recalage.
> - À 64 px, le détail de SD1.5 devient du **bruit**. Demander des aplats (« flat colors,
>   vector style ») nettoie l'image mais fait perdre la vue isométrique.
>
> **Conclusion : pour un bâtiment de 48 à 96 px, le dessin en code gagne.** La chaîne
> ComfyUI reste installée et prête — elle vaudra probablement le coup pour des assets plus
> grands (portraits, illustrations, fonds d'écran-titre), là où le détail a la place
> d'exister. Les essais sont dans `.tmp/generation/`.

Pour regarder un placeholder sans lancer une partie : `apercu.html` (page Vite séparée,
`src/apercu.ts`) affiche les textures agrandies ×4 sur le sol du village, avec une maison
à côté pour l'échelle.

### Jalons suivants

| Jalon | Contenu |
|---|---|
| **6** | **Le ciel** : pluie, orages, incendies, météores, carte modifiée à jamais (§4.21) |
| **7** | Défenses à placer et orienter, de la baliste au canon laser |
| **8** | Restauration du village, améliorations cumulables, montée en puissance infinie |
| **9** | Recrutement, rangs F→SRR++, classes rares, effectif de 10 et garnison (§4.15) |
| **10** | Prologue, choix de classe, dialogues, narration |
| **11** | Défaite, corruption, retour du héros en **antagoniste** (le plus important, §4.12) |
| **12** | Leaderboard en ligne |

Note pour le jalon 9 : le paramètre `faveur` de `tirerCompetences()` est **déjà en place**
pour que le rang augmente la chance de tirer une compétence rare — il n'y a qu'à le
brancher.

### Deux chantiers visuels optionnels, gratuits

- **§5 du brief combat — frames d'effets dessinées.** Les particules codées suffisent
  aujourd'hui. Pour pousser le « waouh » : packs CC0 (Foozle *Pixel Magic Effects*, tag
  *Effects* d'itch.io). **Un agent ne peut pas récupérer le zip d'itch tout seul** (page
  de téléchargement, « name your price »). La marche à suivre : je télécharge, je dépose
  le PNG dans `src/assets/` nommé `fx-<nom>-<largeur>x<hauteur>.png`, et l'agent branche
  `load.spritesheet` + `anims.create` dans `poufMort` / `eclatImpact`.
- **Repasser les héros en 64×64.** Les sprites sont en 32 px par **choix assumé**
  (`scripts/catalogue-assets.ts`, justifié dans `generer-assets.ts:107` : à 32 px le
  détail mange la silhouette). **Agrandir ne crée aucun détail** — il faut redessiner.
  Piste gratuite : ComfyUI + SD1.5 en local (la machine a une RTX 1000 Ada, ~4–6 Go
  VRAM, Python 3.11 installé, ~6 Go à télécharger). À faire en **img2img faible
  denoise, une seule image par héros** — surtout pas frame par frame, l'IA ne tient pas
  la cohérence entre frames en 32 px. Ensuite on relance `animer-sprites.ts` tel quel.

## Dettes et pièges connus

- **La fluidité.** Les cinq règles du §4.17 de `DESIGN.md` sont à respecter absolument :
  tout ce qui apparaît a un plafond, la difficulté monte par la force et non par le
  nombre, aucun objet Texte créé en plein combat, aucune minuterie par coup encaissé,
  rien qui trie une liste par entité et par image.
- ✅ **La cité n'est plus un abri total.** Le bloc 4 a fermé ce trou : on ne se soigne que
  dans les 90 px autour de l'église, et pas du tout quand elle est à terre. Les monstres
  s'en prennent aux bâtiments — elle est leur cap.
- **Les défenseurs civils meurent vite, et le chiffre n'est pas réglé.** 30 PV au rang F :
  mesuré en jeu, un habitant qui tient les portes face à des monstres de milieu de partie
  tombe en deux ou trois coups. Un défenseur se replie sous 50 % de vie, mais un gros coup
  saute par-dessus cette soupape. C'est une **valeur de départ à régler en jouant** (§6).
- ✅ **La sauvegarde existe depuis le 10 août 2026** — et **dans l'autre sens que ce qui
  était écrit ici**. Ce paragraphe disait « elle passera par Supabase, pas par
  `localStorage` » : c'est l'inverse. Le `localStorage` **est** la sauvegarde, Supabase
  en est une copie. Une sauvegarde qui a besoin du réseau disparaît avec le réseau
  (§4.28).
- **Combinaison possiblement cassée** : `Écho` + `Capacités affinées` + `Danse des
  ombres` pourrait permettre d'enchaîner les capacités sans fin. Jamais vérifié en jeu.
- **L'export/import de fichier n'existe pas**, et c'est volontaire : la règle ironman
  (§4.28) refuse le rechargement silencieux. Une sortie de secours, si elle arrive un
  jour, sera un export **explicite** — le joueur qui triche le fait sciemment, il ne
  trébuche pas dessus.
- **Le kamikaze ne blesse que les héros**, pas les invocations. Choix de simplicité, à
  revoir si ça se voit.
- **Le martyre (Chevalier Sacré) ne déclenche pas `tomber()`** si le martyr incarné
  descend à 0 PV. Comportement d'origine, conservé tel quel — à trancher.
- **Les hitbox ne doivent jamais bouger.** `calerCorps` (`entities.ts`) les cale sur les
  dimensions de la texture ; une frame d'animation fait exactement la taille de la
  source, c'est ce qui garantit que rien n'a bougé. Les variantes d'archétype changent
  leur hitbox **volontairement** avec leur échelle, comme le golem.

## Questions encore ouvertes

Listées au §6 (`design/06-questions-ouvertes.md`). Celles qui bloquent les prochains
blocs :

- **Combien vaut un habitant au combat** (bloc 4, à régler en jouant). Les valeurs posées
  sont volontairement dérisoires — 30 PV, 3 dégâts, 34 px de portée, 1,4 s de recharge au
  rang F — et **mesurées trop fragiles** : un défenseur tombe en deux ou trois coups face à
  des monstres de milieu de partie.
- **Les coûts des niveaux 2, 3 et 4 de l'église** en matériaux et en population : les
  chiffres en place (120 bois / 6 habitants, 260 / 12, 500 / 20) sont des premiers jets
  jamais joués jusque-là.
- **Les seuils de satisfaction et d'argent** de chaque niveau d'église : écrits, mais
  neutralisés tant que les blocs 5 et 6 ne les alimentent pas.
- **La vitesse de la jauge de stress** — combien de temps pour la remplir, pour la vider,
  et de combien le rang la ralentit (bloc 5).
- **Combien de pièces de portrait** pour que deux habitants ne se ressemblent jamais
  (bloc 5).
- **Les prix du port** et la fréquence des navires ; **combien de fous forment un groupe**
  et ce qu'un groupe fait exactement (bloc 6).

Et les vieilles, toujours ouvertes : combien de défaites avant que le héros bascule en
antagoniste, ce qu'il perd à chaque défaite, comment on recrute un héros.

**Ne les invente pas — pose-les en questions à choix**, c'est comme ça qu'il travaille.

## Pour lancer

```bash
npm install
npm run dev      # le jeu s'ouvre dans le navigateur
npx vitest run   # les tests (282)
npm run build    # vérifie les types et construit

npx tsx scripts/animer-sprites.ts --planche   # régénère les planches d'animation
```

**Commence par me dire ce que tu as compris et ce que tu comptes faire en premier, avant
de coder.**
