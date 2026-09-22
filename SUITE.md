# Journal de bord

> Ce fichier est le **journal de bord technique** : chaque chantier, ce qu'il a coûté, les
> pièges rencontrés. Le prompt à coller dans une nouvelle session, lui, est
> **`PROMPT-SUITE.md`** — c'est lui qui dit où on en est et par quoi reprendre.
>
> Dernière mise à jour : 2026-09-21, tard. **859 tests verts**, `npm run build` propre.
>
> ✅ **LE JALON 5 EST FINI** — ses douze blocs, du cycle jour/nuit à la vie autonome. Les
> trois derniers sont tombés le 21 septembre au soir : le **bloc 10** (la pause Échap, le
> menu d'options, les 36 touches remappables), le **bloc 11** (la mémoire du village :
> relations, souvenirs, héritage, archives) et le **bloc 12** (la vie autonome : la journée
> sans ordre, les bulles, les six initiatives).
>
> ✅ **Le jalon 5.5** (le nouveau départ, §4.29) et le **jalon 5.6** (les trouvailles de la
> route, §4.31) sont finis eux aussi : la marche, le refus qui se paie, le village déjà
> peuplé, le budget cadeaux/menaces, la carte qui se peint par morceaux, la zone à ×3,
> l'errance continue, puis les caches, le survivant et la stèle.
>
> ✅ **Le bloc 7z est fini** (10 septembre 2026) : tout ce qui se voit est dessiné par le
> code, il n'y a plus un seul PNG de sprite, et les personnages viennent de **Blender**.
> La direction est tranchée ce jour-là : **fer, os, sang gardés** ; « Clash of Clans » veut
> dire **comment les constructions bougent**, pas des couleurs ; interface **gothique
> apocalyptique** ; **aucune image de référence**.
>
> ➡️ **La suite, c'est le jalon 6 — le ciel** (§4.21) : pluie, orages, incendies, météores,
> carte modifiée à jamais. Deux crochets l'attendent déjà dans le code :
> `Maisons.abimerLaPlusProche` (ce qu'un Pyromane fait faute de pouvoir brûler) et le
> drapeau `feuEnCraquant` du trait Pyromane, que rien ne lit.
>
> ⚠️ **Presque aucun chiffre des blocs 8 à 12 n'a été joué** — ils sont tous dans des tables
> de réglages, faits pour être corrigés une manette en main.

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

### Le bloc 6a — la porte (fait le 10 août 2026, au soir)

**Le village peut enfin grandir.** Jusqu'ici `creerHabitant` n'était appelé qu'une fois,
dans le constructeur du village : la population ne pouvait que baisser, et la condition
« 6 habitants » du niveau 2 de l'église était **inatteignable**. C'est ce que ce bloc
débloque avant tout.

- **`src/core/arrivants.ts`** — pur et testé (33 tests). Une table `REGLAGES_ARRIVEES`
  porte tout : rythme, part de fous, degrés, délais, part volée, seuils de réputation.
- **Trois degrés de folie** (§4.18) : le **voleur** vide les stocks et disparaît, le
  **saboteur** ouvre une brèche dans la palissade, le **meurtrier** tue dans la nuit.
  L'**incendie** est écrit et attaché au degré 3, mais rien ne le tire : il attend les
  incendies du jalon 6 (§4.21), exactement comme `argent` attendait le port.
- **Trois lignes d'observation, toujours trois**, et chaque axe a **deux versions** — une
  alarmante, une rassurante. Ça tranche une contradiction interne du §4.18, qui promettait
  « trois indices montrés » **et** « un innocent en montre 0 à 1 » dans la même page.
- **20 questions dans la banque, 4 tirées** par arrivant, toutes posables. **La réponse
  n'est jamais tirée au sort** : elle tombe de l'axe sur lequel il ment. Le même homme, à
  la même question, répond toujours pareil — c'est ce qui rend la lecture apprenable.
- **Il n'est jamais démasqué.** Le saboteur et le meurtrier restent au village et
  recommencent 4 à 8 journées plus tard. **À trois fous installés, ils frappent tous la
  même nuit**, chacun son acte : le risque devient exponentiel sans un comportement de
  plus à écrire.
- **La réputation n'est pas une jauge de plus** : c'est la satisfaction moins les morts
  récents, avec une mémoire plus longue (8 journées contre 3). Elle pilote le délai entre
  deux arrivants — 1 journée au-dessus de 80, 2 à 3 autour de 50, plus personne sous 25.
- **La fiche d'observation est un mode de plus de la fiche unifiée**, pas une interface
  neuve : `SujetFiche` a un troisième cas, et le portrait, les statistiques et les traits
  sont dessinés par exactement le même code.
- **La sauvegarde retient les fous** (champ optionnel, pas de montée de version). Sans
  ça, recharger effacerait le meurtrier qu'on vient d'accepter — la seule décision du
  bloc s'annulerait d'un rafraîchissement, contre la règle ironman du §4.28.

**Ce qui a été vérifié en jouant** (Playwright, aucune erreur console) :

| Vérifié | Résultat |
|---|---|
| La porte s'ouvre à l'aube | Le jeu se met en pause, la fiche s'affiche, le portrait est là |
| Les quatre questions | Cliquées une à une, réponses affichées, jamais deux fois la même |
| Accepter | Population 3 → 6, et l'arrivant garde **sa** personne : visage, traits, nom |
| Le voleur | Parti dans la nuit, retiré du village, stocks amputés |
| Le saboteur | 3 palissades → 2, la brèche est visible |
| Le meurtrier | 5 habitants → 4, et l'annonce ne dit pas qui a fait le coup |
| La récidive | Les deux survivants se reprogramment à +4 et +7 journées |
| L'ironman | Tancrède le meurtrier survit au rechargement, degré et échéance intacts |

⚠️ **Un bug trouvé en jouant** : trois arrivées d'affilée ont donné **deux Merlin** dans
un village de six. Ça ne casse rien à la compilation et ça casse tout au jeu — « Merlin
est mort », lequel ? Un arrivant ne reprend plus un prénom déjà porté.

### Le bloc 6b — le port et le commerce (fait le 11 août 2026)

**L'argent existe enfin comme quelque chose qu'on gagne et qu'on dépense.** Il n'était
qu'une condition d'église que rien n'alimentait ; c'était le dernier champ neutralisé du
bloc 4, et il ne l'est plus.

- **`src/core/port.ts`** — pur et testé (27 tests). Une table `REGLAGES_PORT` porte tout :
  coût, durée, prix de base, bornes du cours, impact des ventes, fréquence des voiles.
- **L'argent ne vit pas dans `Stocks`** : le §4.8 le range avec l'XP et les matériaux, pas
  avec les quatre récoltées. L'y mettre aurait permis à un fermier d'en « produire ».
- **Le navire n'a pas d'horaire** : une voile paraît **une journée calme sur trois**, et
  calme veut dire jour + plus un monstre debout + aucun mort récent. C'est
  l'imprévisibilité qui empêche l'attente optimale que des prix mouvants créent d'habitude.
- **Un cours par ressource**, dérive lente entre 0,6 et 1,6 avec rappel vers la moyenne.
  **Vendre fait baisser le cours de ce qu'on vend** — c'est ce qui remplace le plafond de
  cargaison.
- **Le port est sur la plage, adossé au flanc fermé** : ni corps, ni points de vie, rien ne
  l'atteint jamais. Là où l'église est un objectif, le port est un acquis. Un test vérifie
  qu'il tombe bien sur du sable — le littoral ondule, et un port dans l'eau ne se verrait
  qu'en jouant.
- **`src/game/panneauPort.ts`** — la vente. Il affiche en permanence **les journées de
  vivres**, qui baissent pendant qu'on charge : le §4.18 autorise à vendre son blé et son
  poisson, donc à s'affamer, et c'est la seule contrepartie consentie.

**Ce qui a été vérifié en jouant** (Playwright, aucune erreur console) :

| Vérifié | Résultat |
|---|---|
| `P` loin du port | Refuse, et le bois n'est pas touché |
| Le chantier | 80 bois prélevés au démarrage, debout après une demi-journée |
| La voile | Paraît quand l'écran est nettoyé, glisse depuis le large |
| Les rendements décroissants | Quatre lots de 200 bois : **48, 44, 40, 37** pièces, cours de 1,00 à 0,73 |
| La 4ᵉ condition de l'église | 10 pièces → `manque: ['argent']` ; 200 pièces → plus rien |
| La montée | Niveau 2, et **exactement 150 pièces débitées** |
| Le rechargement | Argent, état du port, cours et niveau d'église reviennent à l'identique |
| Le navire au rechargement | **Absent, et c'est voulu** : c'est un instant, pas un état |

⚠️ **Deux problèmes trouvés — un par un test, un en jouant** :

1. **Solder d'un coup échappait entièrement à l'impact sur le cours.** Le prix était
   calculé une fois puis le cours baissait à la fin : vendre 2000 bois en un clic rapportait
   le plein tarif, quand les vendre en dix fois rapportait moins. Le joueur n'aurait jamais
   vendu autrement, et le frein économique n'aurait **jamais** freiné quoi que ce soit. La
   vente s'écoule maintenant par tranches. *Trouvé par un test, pas en jouant.*
2. **Le navire restait à quai toute la nuit.** Arrivé dans une journée calme, il traversait
   l'assaut tranquillement et l'on commerçait pendant que le village se faisait manger. Un
   navire qui n'accoste que quand c'est calme n'a aucune raison de rester quand ça ne l'est
   plus : il appareille au **crépuscule**.

### Le bloc 6c1 — le journal (fait le 11 août 2026, au soir)

**Le jeu ne parle plus qu'à un seul endroit.** Une boîte en bas à droite garde les **six
dernières lignes**, la plus récente en bas, les plus anciennes plus pâles. Elle remplace la
bannière qui s'affichait en gros au milieu de l'écran pendant quatre secondes.

- **Les cent-vingt émetteurs d'`annonce` n'ont pas bougé.** Ils passent tous par un seul
  événement, capté à un seul endroit : seul ce qu'on en fait a changé. C'est ce qui a rendu
  ce bloc petit là où il paraissait énorme.
- **`src/core/journal.ts`** — pur et testé (10 tests). Il ne fait que garder : capacité,
  ce qui sort, et **le repli des répétitions**. Dix « Impossible de poser ici » d'affilée
  font une ligne et un `x10`, sinon un geste refusé en rafale chasserait de la boîte tout ce
  qui comptait.
- **`src/game/journal.ts`** — les six objets Texte sont fabriqués **une fois** au démarrage
  (§4.17 règle 3), et rien n'est recalculé tant qu'un compteur de version n'a pas bougé.
- **La minimap a été envisagée puis abandonnée.** Le journal donne donc la **direction**,
  jamais la position — ce qui décide déjà de la forme du bloc 6c2.

⚠️ **Un bug trouvé en jouant, invisible à la compilation** — et c'est le plus intéressant
depuis longtemps, parce qu'il condamnait toute une façon de ranger le code :

**Le journal démarrait vide, alors que l'arène annonce « Jour 1 » dans son `create`.**
`this.scene.launch("ui")` est **différé d'une image** par Phaser : quand l'arène parle à la
fin de son `create`, `UiScene` n'a pas encore branché le moindre écouteur. Avec la bannière
ça ne se voyait pas — elle s'effaçait de toute façon. Avec un journal qui garde, la première
ligne de la partie manquait.

La correction n'est pas un décalage d'appel : **le journal appartient à l'arène**, et
`UiScene` le lit comme elle lit `etatVillage` ou `etatPort`. Toute la classe de bugs
disparaît avec, au lieu d'être repoussée d'une ligne.

**Ce qui a été vérifié en jouant** (Playwright, aucune erreur console, 40 FPS) :

| Vérifié | Résultat |
|---|---|
| La première ligne de la partie | *« Jour 1 — le village se réveille »* est là dès l'ouverture |
| Un refus répété dix fois | Une seule ligne, `x10` — rien d'autre n'est chassé |
| Des événements variés | Port, église, palissade : empilés dans l'ordre, le plus récent en bas |
| Le crépuscule et l'aube | Consignés, et l'aube écrit **cinq lignes d'un coup** — exactement ce que la bannière perdait |
| Le débordement | Au-delà de six, les plus anciennes sortent, les six dernières restent |
| La lisibilité | Corrigée en regardant l'image : 0,3 d'opacité sur de l'herbe en plein soleil ne se lit pas ; plancher remonté à 0,5, fond à 0,72, et la boîte épouse le texte au lieu de faire un bandeau de 400 px |

### Ce que jouer a trouvé, et corrigé dans la foulée

⚠️ **Les lignes d'observation étaient un classificateur parfait, et le §4.18 voulait
l'inverse.** Avec 0-1 pour un innocent et 2-3 pour un fou, **aucun recouvrement** : compter
les lignes suffisait à trancher dès qu'on avait appris les six phrases alarmantes. Deux
parties. Or le §4.18 écrit noir sur blanc « il peut être innocent, et l'inverse aussi ».

Tranché le soir même : **les fourchettes se recouvrent** — innocent 0 à 2, fou 1 à 3.
Mesuré en jeu sur 2000 arrivants :

| Signaux | Part des arrivants | Part de fous |
|---|---|---|
| 0 | 30 % | **0 %** — il innocente |
| 1 | 39 % | 17 % — ça inquiète sans accuser |
| 2 | 25 % | 40 % — vraie hésitation |
| 3 | 6 % | **100 %** — il accuse |

**64 % des arrivants tombent dans la zone où compter ne suffit plus.** Les deux verdicts
nets restent aux extrémités, et c'est voulu : sans eux, lire ne servirait à rien non plus.

Et **le premier visiteur est offert**, dès le premier matin : au rythme de croisière la
première porte se serait ouverte après deux heures de jeu. Il ne frappe pas à la seconde de
l'aube — celle-ci porte déjà le repas, les états et la sauvegarde — mais **dans la
matinée** (4 % de la journée). Le rythme normal reprend dès la deuxième arrivée.

### Le bloc 6d — la refonte de l'interface (fait le 11 août 2026)

**Neuf écrans avaient été construits l'un après l'autre, chacun avec ses couleurs** : 48
valeurs de couleur, six dorés différents, cinq zones de texte posées à nu sur l'herbe. Le
jeu était devenu illisible, et coder un système de plus par-dessus aurait voulu dire le
recoder juste après. Livré en six étapes, une par commit :

1. **`src/game/ui/chrome.ts`** — le seul endroit du jeu qui connaît la palette. Neuf
   couleurs (fer, plaque, os, sang séché, sang frais, laiton, bile, acier, ciel sale), un
   cadre unique, la barre de titre, le creux, la jauge avec son repère des 20 %, l'étiquette,
   le bouton, le titre du jeu. ⚠️ **Rien d'autre dans `src/game/` ni `src/scenes/` ne
   redéfinit une couleur d'interface.**
2. **Les panneaux orphelins** — HUD, capacités, ordres, plus `ui/panneauEtat.ts`.
3. **La discussion** remplace le journal : une voix par **source**, trois lignes fermée,
   sept jours d'historique ouverte, les répétitions repliées en « et 2 autres ».
4. **La fiche unifiée** et la porte en trois colonnes.
5. **Le village, le port et le choix de compétence.**
6. **Les deux écrans d'avant-partie** (menu, choix de classe).

⚠️ **`POLICE` est une constante unique dans `chrome.ts`, aujourd'hui à `"monospace"`.**
Changer la police de tout le jeu coûte une ligne — c'est ce qui rend le choix de police
facile à jouer et à défaire.

### Le bloc 6c2 — les survivants (fait le 11 août 2026, tard)

**Le jour a enfin une raison de sortir du village.** Jusqu'ici il ne servait qu'à produire
et à réparer, et tout se jouait autour de l'église.

- **`src/core/survivants.ts`** — pur et testé (20 tests). Une table `REGLAGES_SURVIVANTS`
  porte tout : situations, états, bornes de la meute, plancher du rythme, vitesse de suite.
- **On ne sait que la direction** (§4.10). La discussion écrit une ligne — *« Quelqu'un
  appelle, quelque part au nord »* — et rien d'autre. Un test vérifie qu'elle ne contient
  **aucun chiffre** : un nombre serait une coordonnée.
- **Il paraît sur n'importe quel bord praticable**, plage et éboulis compris, pas seulement
  les deux fronts. Un test vérifie sur mille tirages qu'aucun ne tombe dans l'eau ni dans la
  roche — le littoral ondule, et ça ne se serait vu qu'en jouant.
- **La meute est tirée au visu**, pas à l'apparition : zéro coût tant que le joueur ne
  regarde pas, et une découverte brutale au lieu de progressive. 2 à 40, **tirage plat**,
  plafond dur à 40 (§4.17 règle 1). Mesuré : **un sauvetage sur deux est infaisable**.
- **Seul le « poursuivi » en a une**, décidé en codant : un blessé qui traîne quarante
  monstres aurait rendu les trois situations indistinguables.
- **La fiche se rejoue à l'arrivée** — le même `Arrivant`, le même mode, le même code qu'à
  la porte. Il peut être fou dans la même proportion, mais **son état est écrit noir sur
  blanc** : la folie se devine, la maladie se lit.
- **Une mort en chemin ne coûte qu'à la rumeur**, à demi-tarif — pas à la satisfaction : le
  village ne pleure pas quelqu'un qu'il n'a jamais vu. Deux mémoires distinctes.
- **Le plancher que la porte n'a pas** : un tous les cinq jours quoi qu'il arrive. Sans lui,
  un village sous 25 de réputation n'a plus **aucune** voie de peuplement.

⚠️ **Trois défauts trouvés en jouant, aucun visible à la compilation** :

1. **La fiche disait « À LA PORTE » et « OUVRIR LA PORTE »** à quelqu'un qu'on venait de
   ramener au péril de sa vie. Même fiche, même code — un champ `lieu` de plus, et elle
   raconte la bonne scène.
2. **Un survivant ramené s'appelait Anselme, comme un héros.** Trois fichiers filtraient
   chacun leur liste de prénoms et chacun oubliait une population. Tout passe désormais par
   **`prenomLibre` dans `core/personne.ts`**, seul distributeur de noms du jeu — et au-delà
   des 26 prénoms écrits à la main, il **assemble des syllabes** (jointure phonologique :
   une voyelle entre deux consonnes, une consonne entre deux voyelles).
3. **Trois lignes de discussion en sang frais d'affilée**, dont « il se lève et te suit ».
   Le §4.10 réserve cette couleur à ce qui peut tuer : seules la meute et la mort la gardent.

**Ce qui a été vérifié en jouant** (Playwright, aucune erreur console) :

| Vérifié | Résultat |
|---|---|
| L'appel | Une ligne, une direction, aucun chiffre |
| Le visu | 34 puis 37 monstres lâchés en couronne autour de lui, à l'instant où on le voit |
| Le contact | Il se lève et suit, plus lent que le héros |
| L'arrivée à l'église | Le jeu se met en pause, la fiche s'ouvre, « DE RETOUR AU VILLAGE » |
| L'état écrit | *« Il saigne, et ça ne s'arrête pas. Il n'a pas la journée. »* |
| Accepter | Population 3 → 4, et **son hémorragie entre avec lui** |

### Le bloc 7a, premières fondations (fait le 11 août 2026, très tard)

**Le mode d'aménagement n'existe pas encore ; ce sur quoi il repose, si.** Trois choses, et
la première n'était pas prévue au programme.

⚠️ **Une case détruite était stérilisée pour toute la partie, et personne ne l'avait vu.**
`Constructions.detruire` et `Champs.pietiner` écrivaient l'occupation `"ruine"` dans la
grille, `Grille.constructible` refusait toute case qui n'est pas `"libre"` — et **rien, nulle
part, ne réécrivait jamais `"libre"`**. Donc : chaque mur qui tombait interdisait à jamais de
rebâtir à cet endroit, chaque champ piétiné interdisait à jamais de resemer sur le sien. Ça
rongeait exactement la ligne de front et exactement la zone des champs. Invisible à la
compilation, invisible sur une partie courte, et **fatal au bloc 7**, qui repose entièrement
sur « tout se casse, on rebâtit ». Une ruine est maintenant un état **visible et réversible**.

- **Les règles de pose sont locales, et le disque interdit a disparu.** `possible` refusait
  toute pose à moins de **55 % du rayon du village** — une règle **globale**, qui protégeait
  un lieu parce qu'il était à un endroit connu d'avance, et qui contredisait « la carte
  entière est constructible » (§4.24). Elle ne voudrait plus rien dire au jalon 5.5, où le
  village change de place. Deux règles **locales** la remplacent : **trois cases au moins
  entre ce qu'on bâtit et un bâtiment**, et (au 7b) la porte obligatoire.
- **L'église, le port et les maisons entrent dans la grille**, en occupation `"batiment"` —
  ils n'y étaient à aucun titre, ce qui interdisait toute règle qui parle d'eux. On inscrit
  leur **emprise au sol**, jamais la hauteur du sprite : l'église monte à 96 px au niveau 4
  sans occuper un pouce de terrain de plus.
- **`refus()` rend la raison, pas un booléen.** Le joueur lit « Trop près d'un bâtiment : il
  faut 3 cases » au lieu de « Impossible de poser ici ». Même règle que le refus de la touche
  `Y` (§4.22) : un clic qui ne fait rien sans dire pourquoi rend une interface de pose
  pénible.
- **Démolir rend la moitié**, proportionnellement à ce qui tient encore debout — et la case
  redevient **libre**, pas une ruine : on a démonté, on n'a pas perdu. Un test vérifie qu'on
  ne peut pas gagner du bois en bâtissant puis en démolissant en boucle.
- **Déplacer est gratuit et instantané** (§4.24), et la construction **garde ses points de
  vie** : sinon déplacer réparerait. L'occupant d'une tour la suit.

**Ce qui a été vérifié en jouant** (Playwright, deux passes, aucune erreur console, 41 à
45 FPS) :

| Vérifié | Résultat |
|---|---|
| Les bâtiments dans la grille | **57 cases** en `"batiment"` : église, port et les neuf maisons |
| La règle des trois cases | Refusé de 0 à 224 px de l'église, **accepté à partir de 256 px** |
| Le refus, en jouant | `G`, souris près de l'église : **fantôme rouge**, clic sans effet, et la discussion écrit *« Trop pres d'un batiment : il faut 3 cases »* |
| La pose, en jouant | Plus loin : **fantôme vert**, palissade posée, grille à `"mur"` |
| Bâtir → détruire → rebâtir | `"mur"` → `"ruine"` → **plus aucun refus** → `"mur"`. C'est le défaut ci-dessus, fermé |
| Démolir | 12 bois payés, **6 rendus**, et la case repasse à `"libre"` |

⚠️ **Corrigé dans la foulée, et c'est la mesure qui l'a dit.** La première version appliquait
les trois cases à *tous* les bâtiments : les neuf maisons sont en couronne, leurs anneaux
interdits se recouvraient, et la palissade se retrouvait repoussée à **256 px du centre du
village** contre 82 px avant. Une maison est donc une occupation à part : sa case est
**prise**, mais elle n'impose **aucune distance**. Seuls l'église et le port en imposent une.
L'enceinte peut passer entre les maisons — et on peut donc murer son village maison par
maison, ce qui est assumé.

### Le mode d'aménagement (fait le 11 août 2026, très tard)

**La touche `M` arrête le temps et fait apparaître la grille** (§4.24). Le jour seulement :
l'ouvrir en pleine nuit serait une réparation gratuite au milieu d'un assaut.

- **Trois gestes, un seul bouton.** Clic gauche : **poser** si un outil est choisi, sinon
  **prendre** ce qui est sous le curseur, et **reposer** si on tient déjà quelque chose. Clic
  droit : **démolir**. C'est ce que fait tout jeu de construction, et ça évite un mode de plus
  à expliquer.
- **`G`, `H` et `J` sont les seules touches vivantes sous cette pause** — celles qui
  choisissent quoi poser. La cloche, les postures, l'église et le port n'ont aucun sens
  pendant que le temps est arrêté. Et **`M` vit hors de la boucle qui les gère** : elle doit
  s'entendre pendant la pause qu'elle a elle-même posée, sinon on ne pourrait plus refermer.
- **Le temps passé dedans est rendu** à la fermeture (`decalerLeTemps`), exactement comme la
  pause hors focus du §4.19.
- **La grille est dessinée une seule fois** pour toute la partie, puis cachée et remontrée
  (§4.17 règle 3). Redessiner quelques milliers de segments à chaque ouverture serait
  exactement ce que la règle interdit.

**Ce qui a été vérifié en jouant** (Playwright, aucune erreur console, **50 FPS**) :

| Vérifié | Résultat |
|---|---|
| `M` ouvre | Physique en pause, grille visible, cycle arrêté |
| `G` sous la pause | La palissade est choisie, le fantôme paraît |
| Poser | Mur à 120 PV, **12 bois débités** |
| Prendre et reposer | Le mur passe d'une case à l'autre, **ses 40 PV restent 40** — déplacer ne répare pas |
| Le déplacement est gratuit | Le bois ne bouge pas |
| Clic droit | Mur démoli, **+2 bois** — la moitié de ce qui tenait encore debout, pas du prix neuf |
| `M` referme | Physique relancée, grille cachée, et **le cycle n'a pas avancé d'une seconde** pendant la pause |
| Le jeu repart | Le héros se déplace, 50 FPS |
| La nuit | `M` refuse et le dit |

⚠️ **Quatre défauts trouvés en jouant, et NON corrigés — c'est volontaire.** Ils touchent tous
l'affichage, et le bloc 7z va le refaire entièrement : les corriger maintenant serait du
travail fait deux fois. À reprendre à la fin du 7z. ✅ **Corrigés le 19 septembre 2026** (voir
« Le bloc 7a, seconde moitié »).

1. **`M` ne met pas vraiment en pause.** `physics.pause()` arrête les corps, pas les
   **animations** Phaser : les personnages continuent de bouger les jambes pendant que le temps
   est censé être arrêté. Il faut aussi geler le gestionnaire d'animations.
2. **Une autre touche n'annule pas l'outil de construction.** Rien ne remet `enConstruction` à
   zéro : on choisit une palissade, on sonne la cloche, et le fantôme est toujours là.
3. **Le clic droit démolit avec un rayon d'une case entière** (`laPlusProche(..., CASE)`) :
   cliquer une case **vide à côté** d'un mur démolit ce mur. Il faut `CASE / 2`, puisqu'on
   aimante déjà sur le centre de la case.
4. **On ne peut déplacer que ce que le joueur a bâti.** L'église, le port et les maisons ne
   sont pas des `Construction`. ⚠️ Pour l'église, c'est un vrai chantier : sa position est une
   **constante lue à 362 endroits dans 26 fichiers** (refuge, cap des monstres, soins,
   sauvegarde, satisfaction) — c'est exactement ce que le §4.29 annonce pour le jalon 5.5.

⚠️ **Ce que le 7a n'a PAS encore** — et c'est la moitié du bloc :

1. **Les maisons ne se cassent pas.** Elles sont toujours du décor pur, en nombre fixe (neuf),
   sans corps ni points de vie, sans lien avec la population (`ArenaScene.construireVillage`).
2. **Le village ne démarre pas en ruines.** Le §4.24 veut trois maisons debout pour trois
   habitants, des ruines noircies autour, et chaque arrivant qui en relève une.
3. **Le sol est toujours la même herbe que la prairie** : ni place en terre battue, ni chemins
   vers les quatre postes, ni chemins qui s'usent, ni détails de vie. **C'est le morceau à
   couper si le bloc dérape** — il est purement visuel.
4. **Le texte « LE VILLAGE » flotte toujours** au-dessus du village, et le §4.24 le supprime au
   profit d'un survol.

### Le bloc 7z, étage 1 — le socle de dessin (fait le 12 août 2026)

**Le module qui produit les sprites existe, et il se juge sur une planche.** Rien n'est encore
branché sur le jeu : `art.ts`, les 30 PNG et les 84 animations sont **intacts**, et la partie
tourne exactement comme avant. C'est voulu — on ne débranche l'ancien qu'une fois le nouveau
jugé (§4.30, section « Le socle »).

Quatre fichiers neufs dans `src/game/dessin/` :

- **`palette.ts`** — **treize matières**, toutes dérivées par calcul des neuf de `chrome.ts`.
  Une matière ne choisit qu'une couleur, son corps : **son ombre est du fer, sa lumière est de
  l'os**. Le contour de tout sprite est du fer, lui aussi.
- **`pinceau.ts`** — la grille de pixels, et surtout `membre(x, y, longueur, **angle**, ...)`,
  qui est la primitive de tout le bloc. Plus le **contour automatique** et l'ombre au sol.
- **`four.ts`** — la cuisson : **une planche par famille**, toutes les frames au démarrage
  (§4.17 règle 3), les animations déclarées, et les **plages** de chaque geste.
- **`villageois.ts`** — le cobaye : **32 × 32**, quatre gestes, `posture()` pure et testée.

⚠️ **`chrome.ts` a perdu ses neuf couleurs au profit de `src/game/ui/couleurs.ts`, et il les
réexporte** — rien n'a changé pour ses cent lecteurs. La raison : `chrome.ts` importe Phaser,
qui touche `window` au chargement, donc **la palette du monde n'était pas testable**. Neuf
entiers n'ont pas à dépendre d'un moteur de rendu.

**24 tests neufs** (426 au total, tous verts), et ils ne testent pas des pixels : ils testent
les **angles** et les **écarts de couleur**, c'est-à-dire ce qui est mesurable.

⚠️ **Six défauts trouvés, et c'est la répartition qui est intéressante** — trois par les tests,
trois seulement en regardant l'image :

| Trouvé par | Le défaut |
|---|---|
| Un test | **L'eau tombait à une unité du fer**, et le bois à trois de la pierre. Deux matières séparées de moins de 24 ne se distinguent pas à 32 px : un test compare les **91 paires** |
| Un test | **La pioche ne touchait jamais le sol.** Un geste qui boucle n'atteint jamais un avancement de 1 : la frappe était étalée au-delà de la dernière frame, donc le bras montait et le geste repartait |
| Un test | **La boucle du travail se lisait à l'envers** : la frame de récupération était plus en avant que la frappe elle-même. Invisible frame par frame |
| **L'image** | **Les bras ne se voyaient pas.** Attachés à 3 px du milieu pour une carrure de 10, ils restaient **à l'intérieur de la silhouette** : le balancement de la marche n'existait pas à l'écran. Six frames pour rien |
| **L'image** | **Toutes les lignes de la planche montraient les mêmes frames.** Une planche porte tous les gestes bout à bout ; demander « la frame 2 » sans la plage du geste donne la frame 2 du **premier** geste. `cuire` rend les plages depuis |
| **L'image** | Le chapeau faisait **15 px de large pour une carrure de 10** — le villageois était un champignon —, et le tablier mangeait tout le buste, donc la tunique sombre avait disparu |

**Ce qui a été vérifié en regardant** (`captures/planches/2026-08-12-socle/planche-socle-1.png` et `-2.png`, Playwright,
aucune erreur console) : les quatre gestes tournent, la pioche monte derrière la tête et
retombe, la toux plie le corps, les frames diffèrent d'une capture à l'autre, et le sang du
blessé se voit à 32 px.

⚠️ **Ce que l'étage 1 n'a PAS**, et il ne faut pas le croire fait : rien n'est branché sur le
jeu, les héros et les monstres ne sont pas dessinés, aucun bâtiment, aucun sol en jeu, et les
sept animations que `poses.ts` attend d'une famille (`attaque`, `charge`, `incantation`,
`touche`, `mort`) n'existent pas encore pour le villageois.

⚠️ **Deux questions attendent une réponse sur image**, et la planche est faite pour ça :
**le sol reste-t-il vert ou passe-t-il en cendre** (§6), et **le villageois se lit-il assez** à
sa vraie taille — il est volontairement sombre, comme tout le reste du monde désormais.

### Le bloc 7z, étage 2 — les héros et le sol (fait le 13 août 2026)

**Le sol vert est retenu**, et le défaut qu'il a fait remonter est corrigé : *« ça se répète de
fou furieux »*. Un seul carreau de 32 px répété fait un damier.

- **`src/game/dessin/sol.ts`** — **quatre états de case** (`herbe`, `terre`, `brule`, `cratere`)
  × **quatre variantes**, choisies par la **position de la case** et jamais au hasard : le même
  endroit doit donner le même carreau à chaque lancement, sinon la carte scintille au
  rechargement et deux captures ne se comparent plus.
- ⚠️ **Le cratère et la terre brûlée sont des états de case, pas des décalques** (§4.21). Rien
  ne les écrit encore — aucun météore ne tombe au jalon 5 — mais le dessin et le chemin
  existent. Un décalque n'aurait survécu ni à la sauvegarde, ni au mode d'aménagement.

**Et les héros n'ont plus de corps à eux.**

- **`src/game/dessin/corps.ts`** — **une seule fonction dessine l'humain**, villageois et héros
  confondus ; ils ne diffèrent que par ce qu'ils **portent**. Ce n'est pas de la propreté : c'est
  ce qui rend *« un héros est un villageois qui a appris »* (§4.18) vrai **par construction**. Le
  jour où le bloc 9 fait passer un habitant héros, il n'y a rien à redessiner.
- **`src/game/dessin/heros.ts`** — les sept classes, leurs sept armes, les **sept gestes** que
  `poses.ts` attend, et **cinq paliers d'équipement** : un tous les deux rangs
  (`F E` · `D C` · `B A` · `S SR` · `SSR`). Casque au 1, plastron au 2, cape au 3, **laiton au 4
  et lui seul**. On cuit **à la demande**, une planche par (classe, palier).

⚠️ **Les sept couleurs de classe sont rebasées dans la palette.** Le §4.11 les gardait « sur le
sprite et sur le sprite seulement », le §4.30 dit « les neuf, et aucune autre » : les deux ne
pouvaient pas être vraies. On garde la **teinte** — son seul travail est de faire reconnaître qui
est qui — et on lui donne la matière du monde.

**440 tests verts.** ⚠️ **Six défauts de plus, et la répartition n'a pas changé** :

| Trouvé par | Le défaut |
|---|---|
| Un test | **`varianteDe` rendait -2.** `^` rend un entier signé en JavaScript, et le `>>> 0` était après le modulo au lieu d'avant. **J'ai écrit le commentaire qui met en garde contre ce bug, puis je l'ai fait** |
| Un test | **Le mélangeur privilégiait une variante** — 433 cases sur 900 attendues : une multiplication ordinaire de grands entiers passe par un flottant et perd ses bits de poids faible. `Math.imul` |
| Un test | **L'attaque n'armait jamais** : la coupure était à 0,4 pour un geste de cinq frames dont l'avancement vaut 0 / 0,25 / 0,5 / 0,75 / 1. Même classe de défaut que la pioche |
| Un test | **La chute sortait du carreau** : il n'y a que deux pixels sous les pieds. Les jambes s'écartent au lieu de s'allonger — ce qui est aussi ce à quoi ressemble quelqu'un qui s'effondre |
| Un test | **L'arc du Rôdeur sortait du cadre** au palier 2 : une arme perpendiculaire prend sa longueur en **largeur**, la dimension où il reste le moins de place. Le palier se lit sur la corde |
| **L'image** | **Les héros se lisaient comme des pâtes de couleur.** Peints d'une seule teinte du col aux pieds, on ne voyait ni leur taille ni leur pas. Des **jambes sombres** leur rendent la structure à deux valeurs qui rend le villageois lisible |

**Ce qui a été vérifié en regardant** (`captures/planches/2026-08-13-heros/planche-7z-1.png` et `-2.png`, aucune erreur
console) : la répétition de l'herbe a disparu, les cinq paliers se lisent, les sept classes se
distinguent, les sept gestes tournent.

⚠️ **Ce que l'étage 2 n'a PAS** : rien n'est encore branché sur le jeu (`art.ts` et les 30 PNG
sont intacts), aucun monstre, aucun bâtiment, et le sol n'est pas posé dans l'arène.

⚠️ **Deux réserves à regarder** : l'**Oracle** est très pâle et se détache mal, et l'**Assassin**
et le **Nécromancien** sont tous deux sombres — ils passent le test des 24 unités, mais de
justesse à l'œil.

#### La terre brûlée et le cratère, refaits trois fois

*« Je trouve ça TRÈS moche »*, et c'était juste. Les trois essais, parce que la progression dit
mieux que le résultat ce qu'il faut retenir :

1. **Ardoise + 22 % de pixels bruités** → du gris **bleu** — la matière d'un toit — semé de
   points clairs. Ça ne faisait pas de la cendre, ça faisait de la **neige sur du métal**. Deux
   fautes : une matière froide pour ce qui a brûlé, et une densité d'éclat calibrée pour de
   l'herbe claire alors que sur du sombre l'œil compte chaque pixel clair.
2. **Des disques de suie et des entailles droites** → des **pois** et des **brindilles**.
3. **Du bruit à deux échelles**, mais pris **par blocs** (`floor(x / 6)`) → des carrés à bords
   francs, c'est-à-dire du **camouflage numérique**. Une matière n'a pas d'arêtes droites.

**Ce qui marche** : un bruit **interpolé** entre ses points de grille, adouci en S, sur trois
échelles — le gros dessine les zones, le fin casse leurs bords. Plus un détail **rare** (un
moignon calciné une case sur trois) : c'est lui, et non la couleur, qui fait lire « ça a brûlé »
plutôt que « c'est sombre ».

> ⚠️ **La vraie leçon** : je dessinais des **objets** là où il fallait une **matière**. Une
> surface de terre n'est pas faite de choses posées dessus.
>
> ⚠️ **Et le cratère reste incomplet, il faut le dire.** Ce qui fait lire un trou, c'est la
> **crête claire au bord de la zone** — donc un carreau qui sait qu'il est en bordure, donc qui
> connaît ses voisins, donc le sol écrit dans la grille : **c'est l'étage 4**. Ce carreau-ci
> n'est que le remplissage, et il est fait pour ne pas jurer quand le rebord arrivera.

### Le bloc 7z, étage 3 — les bâtiments entrent dans le jeu (fait le 13 août 2026)

**C'est le premier étage qui se voit en jouant.** Les deux précédents ne vivaient que dans la
planche ; celui-ci remplace ce que l'arène affiche.

- **Le troisième dessin de mur : l'angle.** La planche du 11 août le demandait en toutes lettres
  (« en est-ouest, en nord-sud et **en angle** »), le §4.30 ne l'avait pas enregistré. Il
  emprunte sa largeur à l'est-ouest et sa hauteur au nord-sud : c'est ce qui fait que les trois
  carreaux se raccordent une fois **centrés sur leur case**. La face part vers l'est, le pilier
  monte ; les deux autres coins sont le **miroir horizontal**, qui ne déplace pas la lumière.
- **Le branchement.** Les 9 maisons PNG, l'église et `mur.png` sont remplacés par les textures
  cuites. La palissade que le joueur bâtit aussi (`CONSTRUCTIONS.palissade.texture`) — un test
  la compare à `cleMur("est-ouest", "bois")` pour que les deux fichiers ne dérivent pas.
- **La pose collée en haut à gauche de l'emprise** (règle de pose du §4.30, pas règle de
  dessin) : une maison occupe 2 × 2 cases et n'en remplit qu'un coin. C'est elle qui fait que
  deux voisines ne se touchent jamais.
- **Le disque de terre battue et le texte « LE VILLAGE » ont disparu.** Le disque était peint
  dans la carte cuite : il ne pouvait ni s'user, ni brûler, ni suivre un village qui déménage
  (§4.29). La place reviendra comme **état de case**, à l'étage 4.
- **`src/game/dessin/mer.ts`** — la houle en un `TileSprite` qu'on fait glisser, et l'écume en
  **une vague par bande de 32 px** le long du rivage, chacune démarrée à un autre moment de son
  cycle. En phase, les quarante-sept vagues battraient ensemble et la côte entière clignoterait.
  ⚠️ Par-dessus la carte, jamais dedans : deux millions de pixels cuits ne s'animent pas.

**446 tests verts, aucune erreur console.**

| Trouvé par | Le défaut |
|---|---|
| **L'image** | **La palissade se lisait comme une file de caisses.** Elle était posée à trente angles réguliers sur un cercle : chaque carreau tombait **entre** les cases et se décalait de quelques pixels. Un mur large d'une case ne se raccorde à son voisin que s'il est **dans** la case — elle est désormais tracée sur la grille, et chaque carreau choisit son dessin d'après **ses voisins** et non d'après sa position |
| Le code | `poserEmprise` prend toutes les cases que le rectangle **touche** : une emprise de 64 posée sur une frontière de case en marquait **neuf** au lieu de quatre. Les maisons posent case par case |

**Ce qui a été vérifié en jouant** (`captures/jeu/2026-08-13-bloc-7z-etage-3/7z-village-1.png`, `-2.png`, `7z-mer-1.png` et
`-2.png`) : les maisons, la ferme, l'église et la palissade sont bien les textures cuites, le
mur ouest fait une ligne continue, les brèches des fronts restent ouvertes, et l'écume bouge
d'une capture à l'autre.

⚠️ **Le piège de Playwright, et il coûte une heure si on ne le sait pas** : en headless, la
fenêtre n'a jamais le focus, Phaser émet `BLUR` et l'arène **se met en pause** (§4.17). Rien ne
bouge, le héros ne marche pas, la mer est figée — et on cherche un bug qui n'existe pas. Il faut
réveiller le jeu : `window.dispatchEvent(new Event("focus"))`.

⚠️ **Ce que l'étage 3 n'a PAS** : les personnages sont **toujours les PNG** (héros, villageois,
monstres), le sol de l'arène est toujours celui d'`art.ts` — le damier vert se voit sur les
captures —, les ronds de poste sont toujours là, et l'emprise de l'église reste à **48 px** dans
`core/carte.ts` alors qu'elle est dessinée sur 64 : la passer à 64 élargirait le rayon d'entrée
de l'église, et c'est une règle de jeu, pas un chiffre d'affichage.

⚠️ **Deux réserves à regarder sur image** : au niveau 1, **l'église ne domine pas** — son toit
monte moins haut que celui d'une maison, alors que le §4.22 lui demande l'inverse (la
silhouette ne prend le dessus qu'en montant le clocher, donc à partir du niveau 2) ; et la
**houle est très discrète** sur la mer d'origine, qui est bien plus saturée que la palette du
monde.

### Le bloc 7z, étage 4 — tout ce qui se voit passe au code (fait le 10 septembre 2026)

**C'est l'étage qui rend le 7z visible.** Les trois précédents avaient fabriqué un moteur de
dessin que les PNG masquaient — « le PNG gagne toujours » — et Angelos jugeait donc l'ancien
rendu. Cet étage jette les PNG et branche tout.

**La direction, tranchée en une passe avec Angelos** (quatre questions, quatre réponses) :

| Question | Réponse |
|---|---|
| Le monde quitte-t-il fer/os/sang pour des couleurs WorldBox ? | **Non.** On garde les neuf couleurs. WorldBox reste ce qu'il était au §4.11 : vue de dessus, petits sprites lisibles, nature dense. |
| Quels écrans passent « façon Clash of Clans » ? | **Aucun.** Clash of Clans, c'est **comment les bâtiments bougent et sont posés, comment les murs réagissent**. L'interface, elle, doit être **gothique apocalyptique**. |
| « Les différentes façons de construire » ? | **Un dessin par palier de mur** (bois → fer → pierre) et **un chantier visible**. Les dégâts visibles et les modèles de maisons multiples : non retenus. |
| Les trois images à la racine sont-elles les références ? | **Non, aucune référence.** Main libre : « réfléchis à quel style convient le mieux pour ce monde et ce jeu ». |

**Le style choisi, et pourquoi** : une **gravure sombre**. Le sol est la couche la plus sombre et
la plus plate ; les bâtiments au milieu ; les personnages sont les points les plus clairs de
l'écran (visage et tablier en os, ombre portée). La lumière vient d'en haut à gauche partout. La
forêt est **morte pour moitié** — troncs tordus, branches nues — parce que c'est un monde qui a
brûlé sans être un désert. Le seul rouge vif du monde, ce sont **les yeux des monstres**.

**Ce qui est neuf dans `src/game/dessin/`** :

- **`bruit.ts`** — le bruit partagé (il vivait en double dans `sol.ts` et `mer.ts`), plus une
  ligne entière calculée d'un coup : c'est ce qui rend la carte instantanée.
- **`carte.ts`** — **la carte entière peinte pixel par pixel**, en 300 ms, à partir des formules
  du core (un test vérifie qu'elle classe le sol exactement comme `terrainEn`). Plus aucun
  carreau : un bruit continu sur toute la carte, des rivages qui tremblent de quelques pixels
  au lieu d'un escalier de tuiles, l'écume où le haut-fond touche le sable, une crête claire
  en haut de la roche, et des détails rares (touffes, cailloux, os, fissures — une case sur six).
- **`decor.ts`** — quatre arbres morts, trois vivants, deux conifères, trois rochers, une
  souche, tous tirés de quelques nombres. Chaque décor sait où tombe son pied.
- **`batiments.ts`** — **les murs refaits deux fois.** D'abord un dessin par palier dans les
  trois sens du §4.30 (est-ouest, nord-sud, angle) ; vu en jeu par Angelos : *« je n'aime pas
  du tout comment ils rendent »* — des planches plantées et des clôtures de jardin. Puis
  **un bloc plein par matière** : la case vue de dessus, soulevée de sa hauteur, comme les
  murs de Clash of Clans. **C'est la profondeur qui raccorde** — deux blocs côte à côte
  joignent leurs dessus, et le bloc du bas recouvre la face de celui du haut — donc **un seul
  dessin par matière, aucun sens, aucun miroir**. Les trois sens sont annulés au §4.30. Le
  bois montre les bouts de ses pieux, le fer ses plaques rivetées et ses pointes, la pierre son
  chemin de ronde crénelé ; et une **ruine de mur** (moignons de pieux, pieux couchés) remplit
  les brèches de l'enceinte de départ au lieu d'un bloc sur trois. Et le **chantier** (perches,
  planches, tas de bois et de pierres, en trois emprises), la **tour de guet**, les **champs**
  (jeune / mûr), le **port** (ruine / debout / navire), et l'église de niveau 1 qui **domine
  enfin** les maisons (nef relevée, vitrail en ogive).
- **`monstres.ts`** — **une seule bête, et des nombres** : six archétypes qui ne diffèrent que
  par la longueur du corps, le nombre de pattes et ce qu'ils portent sur le dos. Plus les
  familiers (feu follet, golem, spectre) et les deux morts (le Revenant aux yeux de sang, le
  mort-vivant du Nécromancien aux yeux de ciel). **La brute et le golem sont cuits en 48 px**,
  jamais agrandis. Plus aucune teinte sur un monstre.
- **`villageois.ts`** — **le métier se lit sur le tablier et sur l'outil** : sept tabliers tirés
  de l'os, sept outils (canne, houe, hache, pioche, marteau, maillet, bâton) qui n'apparaissent
  qu'au travail. L'usure du corps est **quantifiée en trois crans** et une planche ne se cuit
  que quand un habitant change de cran — par battement de moral, jamais par image.
- **`monde.ts`** — `cuireLeMonde(scene)`, l'unique appel qui cuit tout ; les planches de héros
  et de villageois se cuisent **à la demande**.
- **`palette.ts`** — sept matières de plus (sous-bois, sable, roche, éboulis, écorce, monstre),
  toutes à plus de 24 unités les unes des autres. Le sol de cendre, qui avait perdu le 13 août,
  est supprimé : sa recette devient la roche.

**Ce qui bouge comme dans Clash of Clans** (`src/game/constructions.ts`) : un mur posé se
raccorde à ses voisins **par la profondeur seule** ; il passe par **quatre secondes de
chantier** puis **surgit** avec un rebond ; il **tremble** sous les coups (une secousse à la
fois, gardée par horodatage) et **s'effondre** quand il tombe (une copie détachée s'écrase).
L'église en relèvement et le port en chantier portent un **échafaudage** tant que le chantier
dure.

**Et le sol s'abîme** (`carte.ts`, `abimerLeSol`) — la question d'Angelos en regardant les
captures : *« est-ce que t'as pensé au fait que le sol peut être abîmé ? feu, cratère ? »*. Le
§4.30 le promettait comme une écriture dans la grille ; c'est fait, **dans la texture de la
carte elle-même**, pixel par pixel, avec un bord qui tremble et se fond dans la matière autour.
Trois dégâts, branchés sur ce qui existe déjà : le **cratère** du météore (rebord clair, fond
sombre), la **terre brûlée** du Fielleux qui s'ouvre et de l'église qui tombe, la **terre
retournée** là où un mur tombe ou un champ est piétiné. Un seul renvoi de texture par image,
quel que soit le nombre de dégâts. Les trois terres de `sol.ts` sont désormais exportées et
servent à ça.

⚠️ **Ce que le chantier n'est pas** : un temps de construction. Le §4.20 (tranché le 9
septembre) veut qu'un chantier occupe un bâtisseur et qu'un segment s'améliore bois → fer →
pierre pour du fer et de la pierre. **Ces règles vivent dans le core et n'y sont pas écrites**
— pas de ressources fer et pierre, pas de paliers de points de vie, pas de bâtisseur — et le
core ne se touche pas pour du visuel. Les trois dessins de mur existent ; seul le bois se pose.
C'est le prochain morceau de règles à écrire, et il est petit.

**L'interface gothique apocalyptique** (`src/game/ui/chrome.ts`) : une **ferrure à rivet** aux
quatre coins de chaque plaque, une **pointe de banderole** sous chaque barre de titre, et dans la
fiche, **le portrait dans une ogive** — un visage dans une arche, comme sur une pierre tombale.
Les portraits eux-mêmes (`portraits.ts`) descendent désormais de la palette : la chair de l'os,
les cheveux de l'écorce et de la pierre, plus une seule peau rose.

**Ce qui est jeté** : les 30 PNG de `src/assets/`, les 12 planches d'animation et leur
manifeste, `scripts/animer-sprites.ts`. `assets.ts` garde le glob — un PNG déposé remplacerait
encore le dessin sous la même clé, et c'est écrit en gros pour qu'on ne le fasse pas sans le
vouloir. `ECHELLE_PERSONNAGE` passe de 0,75 à **1** : une échelle fractionnaire sur du pixel-art
dessiné mange un pixel sur quatre.

**Deux scripts neufs, gratuits et reproductibles** : `scripts/capturer.ts` (Playwright, toujours
le même cadrage, `avant` / `apres`) et `scripts/planche.ts` (les planches PNG sans navigateur —
c'est avec elles que chaque dessin a été jugé avant d'être branché).

**472 tests verts** (+26 : la carte classe comme le core et se peint en moins d'une seconde ;
chaque bête, chaque villageois et chaque décor tient dans son cadre pour chaque frame ; les
trois paliers de mur ont trois silhouettes et couvrent toute leur case ; un dégât s'écrit au
centre et laisse le sol intact au-delà de son rayon, et un cratère est plus sombre au fond que
sur son rebord).

| Trouvé par | Le défaut |
|---|---|
| **L'image** | La prairie tournait au **camouflage** : trois échelles de taches à 0,5 de sombre. Ramené à 0,4 et un seuil plus bas, plus une quatrième échelle très large |
| **L'image** | Les fissures de la roche faisaient un **semis de glyphes** — des objets, pas une matière. Une case sur huit, pas une sur trois |
| Un test | Le museau de la brute, les pattes d'un mort, la queue d'un chien qui recule, la hache d'un bûcheron voûté : **quatre façons de sortir du cadre**, aucune visible à la compilation. Les pattes s'arrêtent désormais **au sol**, calculées d'après la hauteur du corps |
| Un test | Le fer et la pierre avaient la **même silhouette** par la tranche : les pointes dépassent désormais du côté de la lumière, et les créneaux entaillent la crête |

⚠️ **Ce dont je ne suis pas sûr, à juger sur image** : la taille des personnages par rapport aux
maisons (un habitant fait 24 px, une maison 38 — c'est plus grand qu'avant) ; l'anneau de
palissade de départ, qui est un décor posé hors grille (ni corps, ni case) et ne se raccorde
pas aux murs du joueur ; l'épaisseur des murs en bloc, qui fait toute la case ; les visages de la
fiche, plus sombres qu'avant ; et les taches du sol, qu'on peut encore adoucir.

⚠️ **Le core nomme encore deux textures qui n'existent plus** (`tour`,
`bati-mur-est-ouest-bois` dans `core/constructions.ts`) : `textureDe` (`game/constructions.ts`)
ne lit plus `def.texture`. Le core ne se touche pas pour du visuel ; le jour où on y entre pour
la règle d'amélioration des murs, ces deux champs sont à retirer.

### Le son de l'écran-titre (fait le 19 septembre 2026)

**Les décisions d'Angelos, avant de coder** : un écran « clic ou touche pour entrer » quand le
navigateur l'exige (sinon le film ne peut pas avoir de son au premier lancement) ; des sons
**libres de droits (CC0)** ; pendant le film, **le glas et des cris de villageois au loin** ;
**trois musiques à écouter** avant de choisir. Le son du jeu lui-même est la phase 2. Détail au
§4.10, « Le son ».

**`src/game/son.ts`** (neuf) : trois pistes (musique, ambiance, effets) branchées sur la sortie
de Phaser, un **étouffoir** (passe-bas) sur l'ambiance, le muet retenu dans le `localStorage`
(`protecteur:son:muet`). Phaser charge et déverrouille ; ce module ne fait que brancher, parce
que `this.sound.play()` ne laisse aucune place pour une piste ou un filtre. `jouer` rend `null`
sans rien jouer quand le son est verrouillé, absent, ou pas chargé.

**`TitreScene`** : l'état `entree` (l'écran noir, quand `this.sound.locked`), la piste du film
partie sur `VIDEO_PLAY` (la première image vraiment affichée), le feu du menu et l'étouffoir
quand l'image se trouble, le glas et la musique quand le titre se pose — une seule fois —, le
haut-parleur dessiné au trait en bas à gauche, la touche M, et tout qui s'éteint en 1,5 s quand
une partie commence. La musique et le feu (les gros fichiers) se chargent **pendant** le film.
**`MenuScene`** : survol et clic sur les emplacements et les liens.

**`scripts/son/`** (`npm run son`) : les sources dans `.tmp/son/sources/` (OpenGameArt, onze
secondes entre deux requêtes ; Kenney), une petite table de mixage en mémoire (`dsp.ts` :
placer, filtrer, réverbérer, boucler), la cloche et le grondement du feu fabriqués
(`synthese.ts`), l'encodage OGG + MP3 dans `src/assets/son/`, les trois vidéos d'écoute dans
`captures/son/2026-09-19-intro/`, et `CREDITS.md`.

⚠️ **Ce qui a été écarté, et pourquoi** : Freesound interdit les robots sur ses recherches (et
nommément ceux d'Anthropic) ; BigSoundBank interdit aux robots ses fichiers audio ; les glas de
Wikimedia Commons sont en CC-BY-SA ou inutilisables (une cloche noyée dans le grondement du
micro). D'où la cloche fabriquée : les partiels d'une vraie cloche d'église (bourdon,
fondamentale, **tierce mineure**, quinte, nominale…), chacun en doublet qui bat, chacun avec sa
durée de vie.

⚠️ **Mesuré, pas écouté** : le mixage a été réglé sur les niveaux mesurés, demi-seconde par
demi-seconde. Un craquement du feu, 20 dB au-dessus du souffle, sonnait aussi fort qu'une
cloche et dictait le volume de tout : les crêtes du feu sont arrondies (`adoucir`). **C'est à
l'oreille d'Angelos de trancher le reste**, sur les trois vidéos d'écoute.

### Les personnages en low-poly Blender — première planche (20 septembre 2026, à juger)

Angelos a demandé, en même temps que le 7b, **de refaire les visuels des héros et des
monstres et de les lui montrer**. Le §4.30 dit que tout le monde vise le low-poly Blender et
que les personnages sont « le point dur, à tester avant de promettre ». C'est ce qui est
fait : **un atelier de personnages** (`npm run persos`, `scripts/blender/persos.py`,
`planche_persos.py`, `persos.ts`), **rien n'est branché dans le jeu** — le four continue de
dessiner les sprites au code tant que la planche n'est pas jugée.

- **Un rig humain** (`corps.ts` en boîtes : hanches, bassin, buste, cou, deux bras, deux
  jambes, une main avant pour l'arme) et **un rig de bête** (corps ovoïde, 4 ou 6 pattes par
  paires, tête + museau, yeux de sang, dos à épines / plaques / pustules, queue). Une pose est
  un jeu d'angles, comme `posture()` ; les huit gestes des héros et les six des monstres sont
  réécrits en Python avec les mêmes nombres de frames (le four les rejouerait tels quels).
- **Les sept classes au palier 0 avec tous leurs gestes**, plus une frame de repos aux paliers
  2 et 4 (plastron, cape, casque, laiton) ; les six archétypes (le revenant est l'humain aux
  os, voûté). Les nombres des bêtes sont ceux de `monstres.ts` ramenés au cadre (×20/32).
- **Même chaîne que les bâtiments** : deux passes (matières, lumière), palette étendue de douze
  matières (chair, os, sang, cinq chairs de bête, sept tuniques de classe rebasées), codes de
  matière sur deux canaux, réduction par `reduire.reduire_tableaux` (extrait de `reduire.py`).
- **Ce qu'on regarde** : `captures/blender/2026-09-20-personnages/planche-personnages.png`
  (Blender, une ligne par famille, tous les gestes, ×4), `planche-paliers.png`, et
  `planche-personnages-actuel.png` (les mêmes lignes, dessinées par le code aujourd'hui,
  `scripts/planche-personnages-actuel.ts`). Quelques pixels sortent encore du cadre de 20
  sur l'attaque et la mort (l'épée, le corps couché) : à régler si la direction est gardée.
- **Branché le 20 septembre 2026** (Angelos : « applique aussi les nouveaux trucs pour les
  persos ») : les sept classes aux **cinq paliers** avec tous leurs gestes et les six
  archétypes sont rendus par Blender (`persos.py` rend désormais chaque palier en entier,
  ~35 min) et livrés dans `src/assets/<famille>-planche.png` ; le four (`four.ts`) découpe
  une planche livrée en frames et en animations dans l'ordre des gestes du modèle, et
  redessine au code si la planche n'a pas le bon nombre de frames.

### Tout le monde passe en Blender (20 septembre 2026, au soir)

Demande d'Angelos : « fais tout avec Blender pour les villageois etc. ». **121 planches** dans
`src/assets/` — les 35 héros, les 6 monstres, les **48 villageois** (8 métiers × 3 crans
d'usure × avec ou sans sang), les **3 familiers** et le **mort-vivant**.

**Deux bugs du rig trouvés en regardant les planches, et corrigés.** Aucun ne se voyait à la
compilation :

- **Les bêtes n'avaient pas de corps.** `Rig.boule` ramène déjà le rayon au monde (`r * P`) ;
  `bete()` reprenait ce `* P` dans l'échelle, donc le corps sortait **10,5 fois trop petit** et
  disparaissait à la réduction. Un monstre n'était plus que ses pattes, ses épines et sa
  queue ; les deux familiers, qui n'ont qu'un corps, se réduisaient à deux pixels d'yeux.
  ⚠️ **Les six monstres livrés le matin même étaient dans cet état** : leurs planches sont
  refaites.
- **La mort passait sous le sol.** La racine pivote au sol, donc le corps bascule de lui-même ;
  on le descendait **en plus**, et un golem mort tombait six pixels sous son cadre. On ne le
  remonte plus que de ce qu'il faut pour le poser sur son flanc.

**Le villageois a demandé quatre essais**, parce que la caméra regarde le personnage **depuis
-Y** : c'est le *flanc* du buste qu'elle voit, et le **bras avant** (il pend à y = -4) masque le
torse jusqu'aux deux tiers de sa hauteur. Une plaque contre la face avant ne donnait qu'une
tranche de deux pixels ; une boîte englobante dépassait de deux dixièmes de pixel du jeu, soit
rien après réduction ; le tablier empilé en bas du buste tombait derrière le bras. Il occupe
donc le **haut** du buste, là où on le voit — anatomiquement un plastron, mais à vingt pixels
ce qui compte est qu'on distingue un pêcheur gris d'un forgeron rouge. Le chapeau, qui à 5,4 de
bord pour une tête de 3,2 cachait la tête, perd un pixel.

- **L'atelier gagne un filtre de réduction** : `planche_persos.py <prefixe>...` ne réduit que
  les familles voulues. Réduire les 92 familles demande vingt minutes, et une retouche sur les
  bêtes n'a pas à les repayer. La **planche à juger** ne garde qu'une ligne par silhouette
  (héros au palier 0, villageois à l'usure 0 sans sang, toutes les bêtes) — sinon elle ferait
  quatre-vingt-douze lignes —, et une **planche d'usure** neuve montre les six états de chaque
  métier au repos et au travail.
**Jugé, et retouché dans la foulée** (Angelos, sur la planche : « Blender, avec deux
retouches »). Ce qui a été corrigé :

- **La voûte de l'usure était trop forte** : 0,18 par cran, soit 20,6° à l'usure maximale,
  là où `corps.ts` dit 14,3°. Elle est **alignée sur le code**, pas sur un chiffre inventé.
- **Quatre métiers tombaient dans le même brun** (bûcheron, mineur, charpentier, survivant).
  Chaque métier prend maintenant **la matière qu'il touche** — le pêcheur l'eau, le mineur la
  pierre, le charpentier le bois, le bûcheron la feuille, le forgeron la braise. L'écart le
  plus serré entre deux tabliers passe de **25 à 38** (distance RVB), mesuré avant de lancer
  le rendu plutôt que jugé à l'œil après.
- **Le survivant n'a plus de tablier du tout.** À huit, les teintes ne pouvaient plus
  s'écarter ; et un inconnu ne porte pas les couleurs d'un métier — sa silhouette entièrement
  sombre le dit mieux qu'une huitième teinte. C'est ce que le §4.18 disait déjà de lui.
- ⚠️ **Une seule table de tabliers.** `villageois.ts` exporte `TABLIERS`, et
  `scripts/blender/palette.ts` l'importe. Les deux fichiers dupliquaient les mêmes formules
  mot pour mot : c'était la garantie qu'ils divergent un jour.

- **À regarder** : `captures/blender/2026-09-20-personnages/planche-{personnages,usure,paliers}.png`,
  `captures/planches/2026-09-20-villageois/code-contre-blender.png` (les huit métiers au code
  et en Blender, côte à côte ; `avant-retouches.png` garde l'état illisible d'avant) et
  `captures/jeu/2026-09-20-villageois-blender/` (en jeu).

### La zone jouable devient un paramètre (20 septembre 2026, au soir)

Premier bloc de la **deuxième moitié du jalon 5.5** (§4.29, l'errance). Rien ne se voit :
c'est le socle dont tout le reste dépend.

- **`MONDE` n'est plus une constante, c'est une façade** — le même patron que `VILLAGE`,
  `EGLISE` et `PORT` dans `carte.ts` : un objet qu'on remplit au chargement. `COLONNES` et
  `LIGNES` deviennent des liaisons vivantes, posées par `poserLaTaille`, et `PRATICABLE` est
  recalculé avec. ⚠️ Une `Grille` alloue ses cases à la construction : elle doit naître
  **après** le chargement du monde, et mourir avec lui.
- **Un `Monde` porte sa propre taille.** Tout ce qui en reçoit un lit `m.largeur` / `m.hauteur`
  et non plus le global : **générer** un monde ne doit pas dépendre de celui qui est **chargé**,
  sans quoi l'errance tirerait chaque monde aux dimensions du précédent.
- `genererMonde(graine, taille?)` et `chargerLaGraine(graine, taille?)` acceptent une zone.
  **La graine zéro garde sa carte quoi qu'on demande** : le classique est la carte d'avant, au
  chiffre près, et les tests qui la connaissent tournent dessus.
- **Mesuré avant de choisir** (`.tmp/mesurer-taille.ts`, quatre graines) : le tirage et la
  grille restent négligeables (36 → 91 ms, 1,5 → 2,7 ms) ; c'est la **peinture de la carte**
  qui décide — 492 ms et 11 Mo à ×1, **1033 ms et 23 Mo à ×2**, 1447 ms et 34 Mo à ×3.
  **`TAILLE_JOUABLE` est donc ×2** (2828 × 2121). ×3 reviendra le jour où la carte se peindra
  par morceaux au lieu d'un bloc.
- ⚠️ **Pas encore appliquée au démarrage** : la zone ne se ferme qu'à l'installation, qui
  n'est pas codée. Une partie commence toujours sur la taille classique.
- ⚠️ **Dette repérée** : pendant l'errance, refuser un village tire un monde neuf, donc
  repeint la carte — une seconde de gel à ×2. Il faudra la peindre par morceaux, ou pendant
  la marche.

**600 tests verts** (+5 : la taille demandée est rendue, le monde reste jouable à chaque
taille, le classique est intouchable, `MONDE` et `PRATICABLE` suivent le chargement).

### La marche (20 septembre 2026, tard le soir)

Deuxième bloc de la deuxième moitié du jalon 5.5 (§4.29), et le premier qui se voit : **une
partie neuve ne commence plus dans un village**.

- **`src/core/marche.ts`** (pur, 16 tests) : `ouLonParait` (le point le plus loin du village
  sur le premier front, puis quelques pas vers l'intérieur), `capVers` (huit directions),
  `paroleDuGardien` (ce qui s'est passé, combien ils sont, ce qui tient, ce qui rôde) et
  `REGLAGES_MARCHE`. Un test **interdit** toute mention de maladie, de stress ou de réserves :
  le §4.29 ne laisse dire que ce qui se voit de loin.
- **`src/game/rencontre.ts`** : le panneau de la question. **Le seul du jeu où ce n'est pas
  nous qui décidons qui entre** — c'est pour ça qu'il n'est pas un quatrième mode de la fiche
  d'observation : ni portrait à examiner, ni question à poser, ni indice à recouper. Il se
  pose **bas**, pour ne pas masquer les deux personnages qui se parlent (corrigé sur capture).
- **La scène** porte l'état de la marche : le héros paraît au bord, le cycle est figé
  (`cycle.avancer(0)`), les hordes, la porte, les survivants, le navire, la cloche,
  l'aménagement et **la sauvegarde** sont fermés, et le compteur du village disparaît de
  l'écran.
- **Le dézoom d'entrée** (§4.10, tranché le 9 septembre, jamais codé jusqu'ici) : zoom 3,4 →
  1,7 en 2,6 s après un fondu. Un coup de molette le reprend au joueur (§4.11).
- ⚠️ **Celui qui vient a besoin d'un vrai chemin.** Première version : ligne droite. Vu en
  jeu — il sortait, se collait au mur et y restait vingt secondes, vélocité à fond et position
  figée. Il suit donc un **champ de directions** à lui (`parcours.ts`), avec sa règle :
  `passeUnVillageois` **refuse** les murs, les tours, les maisons et les bâtiments là où
  `passeUnMonstre` les traverse, parce qu'un monstre les *frappe* (§4.6).
- ⚠️ **Et « le plus proche » se mesure en pas, pas à vol d'oiseau.** L'habitant le plus proche
  était parfois de l'autre côté du mur, avec tout le tour à faire, pendant qu'un autre, dehors,
  nous regardait. Le champ sait déjà dire le nombre de pas : `village.appelerQuelquun` prend
  un coût, et la scène lui passe celui-là.
- **Vérifié dans le navigateur** : `.tmp/verifier-marche.ts` (non commité, dossier ignoré),
  19 contrôles — on paraît loin, rien ne rôde, rien n'est enregistré, le cycle est à l'arrêt,
  quelqu'un vient, le panneau s'ouvre et met le jeu en pause, refuser rend la main, passer au
  large donne **un autre monde**, accepter installe (jour 1, premier visiteur, sauvegarde,
  temps qui repart). Trois passes de suite, zéro échec.
- **Les scripts de capture démarrent avec `sansLaMarche: true`** : ils veulent le village, pas
  la route qui y mène.
- **À regarder** : `captures/jeu/2026-09-20-marche/`.

**616 tests verts** (+16).

### Le refus qui se paie (20 septembre 2026, tard)

Suite directe de la marche. **Refuser en face n'est plus gratuit**, et tout ce qu'on tue donne
de l'or et de l'expérience.

- **`src/core/marche.ts`** gagne `risqueDAttaque` (5 tests) : 20 % de fond, +6 % par habitant
  manquant sous huit, +30 % au prorata des brèches, **plafonné à 85 %**. ⚠️ Jamais certain :
  un joueur qui *sait* qu'il va être attaqué ne refuse plus jamais en face. Le tirage sort de
  la **graine du monde** — leur réaction est une propriété de ce village-là.
- **`src/core/butin.ts`** (pur, 7 tests) : une bête vaut 0,25 pièce par point d'XP, un humain
  laisse 8 pièces. ⚠️ **La règle du design est devenue un test** : une cargaison de bois (50
  pièces) vaut plus qu'une nuit entière de soixante monstres (≈ 30). Le port reste la source.
  Et comme l'argent du jeu est un entier, on **garde la monnaie** d'une mort à l'autre.
- **`village.prendreLesArmes()`** vide le village et rend de quoi les refaire en face.
- ⚠️ **Un humain hostile est un `Ennemi`, pas un `Villageois` retourné.** Le design annonçait
  l'inverse ; en le faisant, le bloc de combat de l'habitant s'est révélé être **trois lignes**,
  pendant que tout ce qui fait un combat (ciblage, arc, projectiles, zones, recul, mort,
  dépouille, butin, musique) est écrit pour `Ennemi`. On garde de l'habitant sa **planche** et
  son **nom** (`ApparenceHumaine`), et l'archétype `ARCHETYPE_HUMAIN` est **hors de la table
  des vagues** : il ne se tire jamais.
- ⚠️ **Ils sortent par la porte.** Vu en jeu : ils partaient droit sur nous et restaient collés
  à leur propre enceinte, trois pixels en deux secondes et demie. Le champ de directions des
  humains (celui qui amenait déjà le gardien) est devenu **partagé**, il suit le héros **par
  battements** (330 ms, et seulement s'il a bougé de dix cases) et **seulement tant que
  quelqu'un nous court après** — sinon il se serait refait trois fois par seconde pendant toute
  une partie installée, pour personne (§4.17).
- **Les deux traits qui regardent qui est en face** (§4.23) remontent du jalon 8 :
  Miséricordieux (0,35× et **un coup sur trois refusé**, annoncé une fois — c'est le premier
  trait qui désobéit, §4.12), Bourreau d'hommes (2,4× contre un humain, 0,8× contre une bête).
  Appliqués dans **`blesserEnnemi`**, seul point où tout ce qui blesse se rejoint.
- **Vérifié dans le navigateur** : `.tmp/verifier-refus.ts`, 13 contrôles — le village se vide
  et repasse en face avec ses noms et ses planches **découpées**, ils viennent sur nous, on les
  tue, l'or et l'XP montent, et les trois profils de dégâts (neutre 100, Miséricordieux 35 avec
  35 % de refus, Bourreau 240) sont mesurés sur 200 coups chacun.
- **À regarder** : `captures/jeu/2026-09-20-refus/`.

**630 tests verts** (+14).

### Le village déjà peuplé (20 septembre 2026, dans la nuit)

Troisième bloc de la deuxième moitié du jalon 5.5 (§4.29). **Un village qu'on trouve n'a
plus trois habitants** : il en a de **un à vingt** (décision d'Angelos), avec ses métiers,
ses réserves et ses toits encore debout.

- **`src/core/peuplement.ts`** (pur, 14 tests) : `tirerLaPopulation` (1 à 20, le tirage
  penche vers les petits — un gros village est une trouvaille, pas la moyenne),
  `metiersDe`, `stocksDeDepart` et `REGLAGES_PEUPLEMENT`. Les réserves se comptent **en
  jours de vivres** et non en unités : c'est le seul chiffre qui veuille dire quelque chose
  quand la population va du simple au vingtuple, et le test les fait manger pour de bon.
- **Un village de trois reste exactement celui d'avant** — pêcheur, bûcheron, mineur —, et
  les champs restent vides sous cinq habitants : y mettre quelqu'un est la seule décision de
  production que le §4.18 accorde au joueur, elle ne vaudrait rien si le poste était tenu.
- **Les toits debout suivent les têtes** : `genererVillage` prend un nombre de maisons
  debout (trois par défaut, pour les tests et pour tout appel qui ne sait pas encore).
- **Les noms passent enfin par `prenomLibre`.** Le village prenait les premiers prénoms de
  la liste, dans l'ordre : à trois ça passait, à vingt un habitant finissait par s'appeler
  comme le héros.
- **La graine du village seede ses gens**, au lieu d'une constante. « Une graine, un
  village » vaut maintenant par village : deux villages à l'autre bout du monde ne se
  ressemblent plus jusqu'au nom.

**Ce qui a été appris en le faisant, et qui a coûté deux reprises :**

- ⚠️ **Sans poste, un habitant disparaît.** La règle d'avant — « pas de poste, donc confiné »
  — envoyait le forgeron, le charpentier et le guetteur **dans l'église**, donc hors du
  monde (`disableBody`). À trois habitants ça ne se voyait pas : tous les trois avaient un
  poste. À vingt, le village en montrait sept. Ils vivent donc **sur la place**
  (`placesOuSeTenir`, pur, 3 tests) tant qu'il fait jour et que rien ne rôde ; la nuit et à
  la première menace, ils rentrent comme avant.
- ⚠️ **Tout envoyer récolter vide le village.** Première version : au-delà des sept métiers,
  tous les bras en trop partaient à la plage et à la mine. Vu en capture — un village de
  vingt montrait **quatre personnes**, les seize autres hors de l'écran. Au-delà de sept,
  **un sur deux sort, un sur deux reste**.
- ⚠️ **Un village pose six maisons en moyenne, jamais plus de quatorze**
  (`.tmp/mesurer-maisons.ts`, 180 villages) — là où le code en vise seize à vingt. Les règles
  de pose (jamais sur la rue, jamais trois à la file, jamais contre l'église) laissent peu de
  places. **Tranché par Angelos dans la foulée** : « trois ou quatre villageois peuvent
  partager la même maison pour les familles ». Une maison est donc un **foyer de quatre**
  (`toitsPour`), et non un lit — le générateur ne bouge pas, et un village de vingt garde
  cinq toits debout sur les six d'un plan moyen, donc des ruines à relever.
- ⚠️ **On se pose à sa place exacte, pas « à peu près ».** Cinq mineurs visaient le même
  pixel ; l'écart par identifiant (angle d'or) ne servait à rien tant que la marge d'arrivée
  restait plus large que lui — deux bûcherons s'arrêtaient à trois pixels l'un de l'autre.

**Vérifié dans le navigateur** : `.tmp/verifier-peuplement.ts`, **36 contrôles**, cinq
mondes (trois tirés au sort, un gros village forcé, un village mort) — ils sont bien ceux du
peuplement, tout le monde se voit en plein jour, un toit par tête tant qu'il y en a,
personne ne se superpose, aucun homonyme du héros, les réserves sont celles qu'ils avaient.
Et `.tmp/verifier-refus-gros.ts` pour le cas neuf : **vingt habitants qui se jettent sur
nous** sortent tous avec leur nom, sans que la cadence bouge (23 images/s au calme comme en
ruée — c'est le plafond de Chromium en headless, mesuré à trois habitants comme à vingt).

**À regarder** : `captures/jeu/2026-09-20-peuplement/`.

**647 tests verts** (+17).

### Le budget cadeaux / menaces (20 septembre 2026, dans la nuit)

Quatrième bloc du jalon 5.5, et **celui qui donne son sens au refus** : jusqu'ici, dire non
à un beau village n'avait aucune raison d'être.

- **`src/core/budget.ts`** (pur, 14 tests) : `valeurDesCadeaux` mesure ce que le monde donne
  sur **une seule échelle**, `menacesDuMonde` convertit l'écart en trois menaces,
  `phraseDuMonde` l'annonce en une ligne.
- **Le budget ne décide pas du monde, il paie celui qui a été tiré** (décision d'Angelos) :
  terrain, fronts, brèches, gens et réserves sortent de la graine comme avant. **Aucun tirage
  n'a bougé**, la graine zéro garde sa carte, et la presqu'île sera automatiquement le monde
  aux pires nuits le jour où le générateur saura en produire.
- **Le monde de référence — zéro point — est la partie qu'on jouait** : deux fronts, six
  habitants, réserves à moitié, deux brèches, pas de douves. Tout se compte en écart à ça.
- **Trois menaces, sur les leviers qui existaient déjà** : l'effectif d'une nuit (−35 % à
  +60 %), des **nuits d'avance** en puissance (0 à 3 — c'est le levier le plus brutal, il
  ouvre les archétypes autant qu'il monte les statistiques), et des **habitants déjà malades**
  (0 à 3). L'incendie reste au jalon 6, comme prévu.
- **La phrase se pose à part sur le panneau**, en os mat, sous un filet : un villageois ne
  peut pas dire honnêtement « nous sommes un beau village, donc tes nuits seront pires ». Le
  filet a été ajouté après capture — sans lui, la phrase se lisait comme une cinquième ligne
  de ce qu'il raconte.
- **Les malades se découvrent à l'installation**, jamais avant, et le journal le dit :
  « Maelis est malade — ils ne l'avaient pas dit. »

**Ce que la mesure a corrigé, et c'est le cœur du bloc :**

- ⚠️ **Le premier jet comptait la part de mur debout. Elle ne varie pas.** Mesure sur 180
  villages (`.tmp/mesurer-murs.ts`) : l'enceinte est **toujours** presque entière — de 88 % à
  100 %, médiane 96 % —, parce que le générateur ouvre une ou deux brèches par pan et pas
  davantage. Le terme valait ±1 point d'un monde à l'autre (le budget y perdait une dimension)
  et la phrase annonçait « des murs presque intacts » pour tout le monde. On compte donc les
  **brèches** (0 à 4, médiane 2), qui varient vraiment.
- ⚠️ **Un test a attrapé une contradiction dans ma propre phrase** : « des réserves pleines »
  dit exactement ce que le §4.29 interdit d'annoncer. Les réserves **se paient sans se voir** —
  un village ordinaire aux greniers pleins annonce des nuits dures sans dire pourquoi. C'est
  le pari éclairé que le design demande, et pas un calcul.
- Un village **sans aucune enceinte** rend plus qu'un mur troué de partout : un trou se
  bouche, une absence de mur se bâtit.

**Vérifié dans le navigateur** : `.tmp/verifier-budget.ts`, **22 contrôles** sur trois mondes
— la phrase est bien celle qui s'affiche, elle tient en une ligne, elle ne dit jamais ce qui
ne se voit pas de loin, personne n'est malade avant l'installation, les malades achetés sont
tous là après, et l'effectif de la première nuit vaut exactement ce que le budget a décidé
(25 sur un village mort, 46 sur un village de vingt, contre 30 au monde de référence).

**À regarder** : `captures/jeu/2026-09-20-budget/`.

**664 tests verts** (+17 : 14 pour le budget, 3 pour les foyers).

### L'errance continue (20 septembre 2026, tard dans la nuit)

**Le dernier morceau du jalon 5.5.** Le §4.29 veut qu'« à chaque refus, le village suivant
soit deux fois plus loin ». Il restait bloqué depuis le 11 août ; le voici.

#### La contradiction, et comment elle se résout

Une carte est **finie**. On ne peut pas y faire marcher deux fois plus longtemps : la
diagonale de la zone ×3 fait 4 330 px, soit quarante secondes de marche, et c'est un
plafond dur. Le facteur `eloignementParRefus` était écrit dans `REGLAGES_MARCHE` depuis
six semaines sans que personne ne sache quoi en faire.

**Ce qu'on double, c'est le nombre de mondes à traverser** — et les mondes du milieu n'ont
**personne à qui parler**. Leur village est une ruine vide : on la traverse, on la fouille,
on repart. Après `k` refus, il y a `2^k - 1` mondes muets avant le prochain village : un
après le premier refus, trois après le deuxième, sept après le troisième. Un monde se
traverse en une demi-minute, donc la route fait une minute, deux minutes, quatre minutes.
C'est exactement la progression que le design demande, obtenue sans mentir sur la carte.

⚠️ **Avec un plafond, et il est nécessaire.** Doubler sans fin, c'est 1 023 mondes au
dixième refus — sept heures de plaine vide. Le §4.29 dit « de longues minutes », pas une
soirée. `mondesMuetsMax` vaut **7** : le pire trajet fait une demi-heure, et le joueur a
compris bien avant que refuser coûte cher.

#### Ce qui est codé

- **`mondesMuetsApres(refus)`** (`core/marche.ts`, pur, 4 tests) : zéro au départ, puis un,
  trois, sept, jusqu'au plafond.
- **Un monde muet n'a personne** : `peuplerLeVillage(graine, habite)` rend une population de
  zéro, donc aucun toit debout (`toitsPour(0)`), aucun habitant, et personne ne sort de la
  porte. ⚠️ Un garde explicite dans `guetterLaPorte` : sans lui, le village vide tombait sur
  la branche « personne ne vient » et nous **installait dans les ruines** — exactement ce
  qu'on veut traverser.
- **Il ne promet rien** : `annonceDeRoute` remplace `annonceDArrivee`. « Aucune fumée. La
  route continue au SUD-OUEST » au lieu de « De la fumée monte au SUD-OUEST ». On ne fait
  pas chercher un village qui n'existe pas.
- **Quitter un monde habité compte comme un refus**, quitter un monde muet n'en coûte pas :
  c'est déjà le prix qu'on paie.

#### Le voile, au lieu de l'écran noir

Entre deux mondes, on attendait : **700 ms de fondu, deux à trois secondes de carte cuite
d'un bloc, 700 ms de fondu d'entrée**. La carte se peignant par morceaux, la scène se
remonte en **200 à 330 ms** (mesuré dans le navigateur, en rendu logiciel). Le voile n'a
donc plus de gel à couvrir :

- **220 ms au lieu de 700** (`DUREE_DU_VOILE`). Sept bords de carte d'affilée après un
  troisième refus, ça fait dix secondes d'écran noir économisées.
- **L'entrée cérémonieuse n'a lieu qu'une fois.** Le zoom d'ouverture de 3,5 s raconte « tu
  tombes quelque part » : c'est juste la première fois, et c'est une corvée la dixième. Dès
  qu'on enchaîne un monde, on entre au zoom de jeu.

#### Ce que la vérification a trouvé

⚠️ **Le héros se noie si on le téléporte dans la mer** — le script de contrôle poussait le
héros en `x = 4` pour simuler la sortie, ce qui le posait parfois dans l'eau (l'eau noie
depuis le 19 septembre). Le test bloquait une fois sur trois, et **le jeu avait raison**. Le
script passe désormais par le vrai chemin de sortie, et garde un contrôle à part pour la
détection du bord.

✅ **Et la mort pendant la marche se termine proprement** : un seul héros, donc sa mort
appelle `finDePartie`. Vérifié à la lecture, pas de cul-de-sac.

**Vérifié dans le navigateur** (`.tmp/verifier-errance.ts`, trois mondes tirés) : **42
contrôles sur 42**. On refuse, on traverse un monde muet, on retrouve quelqu'un ; on refuse
encore, on en traverse trois, et le village est là au bout.

**À regarder** : `captures/jeu/2026-09-20-errance/` — le **même lieu**, habité puis muet :
quatre maisons debout et des gens dehors d'un côté, toutes les maisons en ruine et personne
de l'autre.

**675 tests verts** (+5).

### La zone passe à ×3, et le tirage du monde redevient pur (20 septembre 2026, tard dans la nuit)

Suite directe des morceaux : la carte ne se peignant plus d'un bloc, la zone ×3 devenait
possible. Elle a fait tomber **un bug de fond** en route.

#### ⚠️ `genererMonde` se disait pure, et ne l'était pas

`placerLesPostes` bornait sa grille sur les **`COLONNES` / `LIGNES` du monde déjà chargé**,
pas sur celles du monde qu'il était en train de tirer. Le fichier s'interdit pourtant cette
faute dans son propre commentaire : *« Tout ce qui reçoit un `Monde` lit `m.largeur` /
`m.hauteur`, pas ceci : générer un monde ne doit pas dépendre de celui qui est chargé. »*

Conséquences, toutes mesurées :

- **Sur une zone plus grande que celle qui était chargée, le générateur ne voyait rien
  au-delà du coin nord-ouest.** Le port et la mine échouaient **9 fois sur 10** à ×3, et
  **une partie sur trois retombait en silence sur le monde classique** (2000 × 1500) — donc
  ×3 n'aurait rien donné du tout.
- **Le 9 % de presqu'îles était un artefact.** Le §4.29 expliquait que « deux tentatives sur
  cinq ne donnent que neuf mondes sur cent, faute de place pour le village et ses quatre
  postes ». Faux : elles n'étaient pas refusées faute de place, elles étaient refusées par le
  bug. Le tirage réparé accepte presque tout ce qu'il propose, et `chance(0.4)` sortait
  **trois presqu'îles sur dix** — c'est-à-dire tout sauf une trouvaille.
- **Le taux dépendait de la taille**, ce que le §4.29 avait noté comme une propriété du monde
  (« 9 % à ×2, 33 % à ×1 »). Ce n'en était pas une : c'était le bug qui se voyait.

**Réparé**, le tirage rend la **même répartition des fronts à toutes les tailles** : 9 % à un
front, 34 % à deux, 45 % à trois, 12 % à quatre, mesuré sur 400 graines à ×1, ×2 et ×3. La
probabilité de presqu'île descend de `0,4` à **`0,12`**, qui redonne exactement les **9 %**
que le §4.29 a toujours annoncés. Un test neuf compare les répartitions de deux tailles :
c'est la seule chose qui aurait vu passer le bug.

⚠️ **Ce que ça casse, et il faut le dire** : une graine donnée ne rend plus le même monde
qu'hier. Une partie enregistrée avant cette nuit retrouverait une carte qui ne colle plus à
sa sauvegarde.

#### Un tirage sept fois moins cher

Un tirage demandait la nature du sol **cent mille fois** : une fois par case pour le relevé
des cases atteignables, puis cinq balayages de grille pour les postes, chacun la redemandant.
`releveDesCases` la demande **une fois** et tout le monde y lit. Mesuré sur 200 graines :
**13 ms à ×1, 20 ms à ×2, 36 ms à ×3** par graine, abandons compris — contre 219 ms pour la
pire graine mesurée la veille.

#### ⚠️ L'écume n'avait pas de plafond

Une vague est un sprite animé, et Phaser fait avancer **toutes** les animations en cours, à
l'écran ou non. Le nombre de vagues suit la longueur de la côte, donc la taille du monde :
**127 en moyenne à ×1, 187 à ×2, 237 à ×3** (373 au pire), presque toutes hors de l'écran.
C'est exactement l'ajout non plafonné qu'interdit le §4.17, et c'est ce qui faisait perdre
deux à cinq images par seconde dès que la zone grandissait. Les vagues hors cadre sont
maintenant **mises en pause, par battements d'un quart de seconde**.

#### Ce que ça donne

- **Une partie se joue sur 3 464 × 2 598** — trois fois la surface de la carte classique,
  comme le §4.29 le demandait. (La convention est celle de ×2 : c'est la **surface** qui
  triple, donc √3 sur chaque côté.)
- **Elle s'ouvre en 0,43 à 0,61 s**, c'est-à-dire aussi vite qu'à ×2.
- **La cadence est meilleure qu'avant le chantier** : 22 à 24 images par seconde une fois la
  carte peinte, contre 20 pour la version d'hier à ×2 — le tri des vagues rend plus qu'il ne
  coûte.
- **La marche s'allonge** : 2 176 à 3 330 px, **27 s en médiane** au pas du guerrier, contre
  21 s à ×2 et 12 s à ×1.

⚠️ **Le §6 demandait « deux à trois minutes » pour le premier village, et c'était
impossible.** À 108 px/s, deux minutes font 13 000 px de marche quand la diagonale de ×3 en
fait 4 330. ✅ **Tranché par Angelos dans la nuit : on garde les vingt-sept secondes**, et
le §6 est réécrit. Ce sont les refus qui s'allongent, pas le premier chemin.

**Vérifié dans le navigateur** (`.tmp/verifier-morceaux.ts`, trois mondes tirés, avec la
marche) : **23 contrôles sur 24**, le seul raté étant une image à 116 ms au lieu de 120 sur
un monde, en rendu logiciel.

**À regarder** : `captures/jeu/2026-09-20-zone-x3/`.

**670 tests verts** (+1).

### La carte se peint par morceaux (20 septembre 2026, tard dans la nuit)

**Le dernier verrou d'architecture du projet.** La carte se peignait **d'un seul bloc** :
une texture unique de la taille du monde, cuite avant la première image. Trois choses en
découlaient, et les trois étaient des murs.

1. **Le gel.** Mesuré dans le navigateur avant de toucher à quoi que ce soit
   (`.tmp/mesurer-entree.ts`, graines 11/23/47/58) : ouvrir une partie prenait **1,9 à
   3,7 s** sur la zone jouable. On le payait à chaque village refusé, puisque refuser tire
   un monde neuf.
2. **La taille de la carte avait un plafond dur**, qui n'avait jamais été vu : une texture
   unique ne dépasse pas **4 096 pixels de côté** sur beaucoup de cartes graphiques, ce qui
   bloquait le monde à deux fois sa largeur classique. ×3 en surface passe encore (3 464 px
   de large) ; ×4 n'aurait jamais pu. Aucun réglage n'y pouvait rien : c'est le matériel qui
   refuse.
3. **L'errance continue était bloquée** : un monde qui se peint d'un bloc ne peut se
   fabriquer qu'à l'arrêt.

**Et le gel se payait trois fois avant de jouer.** `cuireLeMonde` est appelé par *toutes*
les scènes, donc aussi par le menu et par l'écran de choix de classe, qui affichaient la
carte en fond — pour un monde qu'on n'allait même pas jouer.

#### Ce qui est codé

- **`src/game/dessin/carte.ts` devient pur** : ni Phaser, ni texture. Il ne sait plus que
  peindre des **morceaux** — des carrés du monde qui portent leur coin (`x0`, `y0`) et se
  peignent **par tranches de rangées**.
- **`src/game/dessin/morceaux.ts`** (neuf) porte tout le reste : la vignette, la file de
  cuisson, le budget par image, le masque d'eau, et les écritures dans la carte.
- **La vignette d'abord** : le monde entier en tout petit (un pixel pour huit, une
  quinzaine de millisecondes), étirée sous les morceaux. Le monde a sa forme et ses
  couleurs **dès la première image**, floue ; les morceaux nets s'y posent en cuisant.
  C'est aussi le fond des deux écrans d'avant-partie, qui n'ont plus rien à cuire.
- **Ce qu'on voit à la première image est peint tout de suite**, et rien de plus : quatre
  morceaux autour du héros. Le reste cuit **image par image, au plus près du héros**, dans
  un budget de six millisecondes — **même en pause**, parce qu'une pause est du temps offert.
- **Ce qui s'écrit dans la carte attend son morceau.** Le sol du village, un cratère, une
  terre brûlée sont des **écritures différées** : elles se posent quand le morceau visé
  cuit, et tout de suite s'il l'est déjà. Pendant la marche, on paraît à l'autre bout du
  monde — rien n'oblige à cuire un village qu'on ne voit pas encore.
- **La carte redevient vierge sans se repeindre** : un morceau garde ses pixels d'origine à
  la première écriture qui le salit. Un village en salit sept ; garder la carte vierge en
  double coûtait trente mégaoctets à ×2, soixante-huit à ×3.

#### Les trois coutures, et comment elles se referment

Un morceau peint sans savoir ce que son voisin a peint. Trois choses se lisent pourtant
d'un morceau à l'autre, et chacune aurait fait un trait visible tous les 384 pixels.

- **Le bruit part d'un x du monde** (`ligneDeBruit`, paramètre `depart`) : une tache doit
  tomber au même endroit quel que soit le morceau qui la peint.
- **Une rangée connaît celle du dessus**, même la première : la crête de roche et l'ombre au
  pied de l'éboulis se lisent d'une rangée à l'autre. On classe donc la rangée juste
  au-dessus du morceau avant de commencer, sans la peindre. Et une rangée **déborde de trois
  pixels à droite**, parce que l'écume regarde devant elle.
- **Un détail à cheval est peint deux fois, en deux moitiés.** Un os fait sept pixels : semé
  dans la dernière case d'un morceau, il déborde chez le voisin. Les deux le sèment donc, et
  chacun garde ce qui tombe chez lui. Il a fallu pour ça que le treillis de terrain porte
  **une case entière de marge** et que `terrainSeme` sache refaire, point par point, le
  calcul que le voisin a fait par rangées.

⚠️ **Un test le garde** : la même zone, peinte d'un bloc et en quatre quarts, doit rendre
**exactement** les mêmes pixels, les quatre canaux compris. C'est le seul test qui vaille
ici — une couture ne se voit pas dans un chiffre.

#### Ce que ça a coûté, mesuré

- ⚠️ **Le masque d'eau de la houle est devenu le poste le plus cher du jeu.** Il le tirait
  gratuitement des pixels de la carte ; sans carte d'un bloc, il a fallu le recalculer —
  **400 à 800 ms** pour 1,5 million d'appels à la formule du terrain, soit la moitié du gel
  qu'on venait d'enlever. Il se remplit désormais **morceau par morceau** (chacun connaît
  déjà son terrain au pixel près), il n'est renvoyé au moteur que s'il a vraiment changé —
  un morceau de plaine n'y touche pas — et cinq fois par seconde au plus : six mégaoctets
  par envoi, c'est la texture la plus lourde du jeu.
- ⚠️ **La vignette s'efface dès qu'on ne voit plus que du cuit.** La laisser sous les
  morceaux, c'est repeindre l'écran entier une fois de plus à chaque image, **toute la
  partie**. Mesuré : deux à trois images par seconde perdues pour rien.
- ⚠️ **Un morceau fini par image, jamais deux.** Finir un morceau, c'est fabriquer un
  canevas et l'envoyer au moteur. Deux dans la même image donnaient des à-coups de 190 ms —
  un gel de moins, un hoquet de plus, ce qui n'est pas le marché qu'on avait passé.
- **Le côté d'un morceau est une mesure, pas un goût.** Trois tailles essayées dans le
  navigateur (`.tmp/ou-passe-le-temps.ts`, GL logiciel — les écarts restent vrais) :

  | Côté | pendant la cuisson | une fois tout cuit | pire image |
  |---|---|---|---|
  | 512 | 14-15 i/s | **20 i/s** | 116-119 ms |
  | **384** | **15-16 i/s** | **20 i/s** | **86-87 ms** |
  | 256 | 16-17 i/s | 16-19 i/s | 74-80 ms |

  Le régime sans carte à peindre est de **20 i/s** — le chiffre d'avant le chantier, mesuré
  en remettant l'ancien code — et il ne doit pas bouger. À 256 il bouge, et on le paierait
  **toute la partie** pour gagner sur les trois premières secondes.

#### Le résultat

**Une partie s'ouvre en 0,46 à 0,53 s**, contre 1,9 à 3,7 s la veille. Le menu et l'écran de
classe ne cuisent plus rien. Et la carte peut désormais être aussi grande qu'on veut : elle
n'est plus une texture, elle en est cinquante.

**Vérifié dans le navigateur** (`.tmp/verifier-morceaux.ts`, trois mondes tirés, avec la
marche) : **24 contrôles sur 24**. La partie s'ouvre sous la seconde, la cadence tient
pendant la cuisson, aucune image ne dépasse 120 ms, le jeu revient au régime d'avant une
fois tout cuit, les 48 morceaux finissent de cuire tout seuls.

**À regarder** : `captures/jeu/2026-09-20-morceaux/` — les coutures au zoom maximal
(`apres-couture-*`), le monde entier (`apres-monde-entier`), et les deux écrans
d'avant-partie sur leur vignette.

**669 tests verts** (+3).

### L'incendie se voit enfin — la fumee, et cinq flammes (22 septembre 2026, tard)

Angelos, en une phrase : « les flammes de l'incendie c'est deja moche, c'est juste une petite
flamme sur un batiment ». Il avait raison, et **la cause n'etait pas le dessin de la flamme**.

#### Le bug qui a tenu tout le chantier de la veille

Le coeur clair de la flamme, dans `monde.py`, etait pose a `y = +0,02` avec une base deux
fois plus etroite que celle du corps. Autrement dit : **entierement enferme dans le maillage
du corps**. La camera ne l'a jamais vu. Les trois flammes sont donc sorties d'**une seule
couleur plate** — un orange saumon sans contraste — pendant toute la session du 22.

La camera de `rendre.py` regarde depuis les `y` negatifs : c'est par la qu'on sort une piece.
Le coeur est passe a `y = -0,24`, avec un `z` releve pour rattraper ce que l'avancee fait
perdre en hauteur d'ecran (0,574 perdue par unite avancee contre 0,819 gagnee par unite
montee — c'est la camera penchee a 55°). Et `COEUR_DU_FEU` est passe de 0,62 a **0,42** vers
l'os : a 0,62 le coeur sortait **beige**, un coeur de bougie.

⚠️ La cisaille du biais partant de `y_devant = -0,4` poussait toute la flamme d'un pixel et
demi a droite, et la variante qui penche a droite **sortait du cadre de deux pixels**. Le
premier nombre rendu par `flamme()` ne sert plus de pied : il recentre.

#### Ce qui manquait vraiment : la fumee

Une maison qui brule se lit a trois choses, et **la premiere n'est pas le feu**. De jour, la
flamme est un detail de vingt pixels ; ce qui dit « ca brule la-bas » a l'autre bout de la
carte, c'est le panache.

- **Huit bouffees par foyer**, 150 px de montee, decalees d'un huitieme de cycle. A six, la
  colonne avait un **trou** : une bouffee jeune est encore transparente et une vieille l'est
  redevenue.
- **L'exposant de la disparition est 0,6**, pas 1,25. Le sol de ce jeu est moutonne de taches
  sombres : une fumee qui palit vite s'y confond avec l'herbe et il ne reste qu'un nuage pose
  sur le toit.
- ⚠️ **Essayee claire, et repris.** L'idee etait de la detacher des taches sombres de la
  prairie. Mesure en jeu, c'est l'inverse — le sol est un vert khaki **clair**, et une fumee
  claire s'y dissout. Sombre, elle se voit sur les deux.
- ⚠️ **Le panache ne retrecit pas au meme rythme que le feu.** Multiplier sa taille par
  l'ardeur le faisait disparaitre des le premier seau : a mi-feu il tombait a quarante pixels
  et le village semblait deja sauve. Sa taille suit `0,55 + 0,45 x ardeur`, son opacite suit
  l'ardeur.

**Elle vient de Blender**, comme le reste — avec une exception ecrite dans la chaine :
`rendre.py` et `reduire.py` acceptent maintenant un drapeau **`contour`**, et la fumee est la
seule du dossier a le refuser. Un contour de fer dit *ou finit un objet* ; une fumee ne finit
nulle part, et le trait noir en faisait un caillou gris qui flotte. Premier jet posee sur
`z = 0` : la camera la coupait a plat par le bas et les trois variantes sortaient en
**cailloux**, juges sur planche. Une fumee n'a pas de dessous.

#### Le reste de la refonte

- **Cinq flammes au lieu d'une**, a des places fixes de l'emprise (trois sur le toit, deux
  sur la facade), **chacune avec sa phase** — sans le decalage, les cinq images changent
  ensemble et on voit un panneau qui clignote. Leur nombre suit l'ardeur : chaque seau en
  enleve une visiblement.
- **Le batiment noircit** (`Maison.brulee`, une teinte multiplicative jusqu'aux trois quarts
  du charbon). C'est ce qui a le plus change la lecture : les flammes ressortent enfin, et on
  voit ou en est la maison dans ses quarante secondes. Il ne compte que les degats **du feu**.
- **Des braises** montent et s'eteignent en l'air, en lumiere additive.
- **La lueur suit la nuit** (`ArenaScene.partDeNuit`, lu sur le voile plutot que recalcule) :
  0,22 de jour, 1 la nuit. A pleine force de jour, trois maisons en feu posaient trois
  **flaques jaunes** sur la prairie.

⚠️ **Rien ne garde d'etat** : la position d'une bouffee et d'une braise se calcule entierement
du temps et de leur rang, et leur dispersion vient d'une empreinte tiree de la **cle du
foyer** (sa case) — donc deux maisons voisines n'ont jamais le meme panache, et la meme
maison retrouve le sien apres un rechargement. 272 images cuites une fois, aucune minuterie,
aucune liste a nettoyer (§4.17).

**944 tests verts** (+1 : les trois bouffees ont leur taille tenue par le test des sprites
Blender). `npm run build` propre.

**A regarder** : `captures/jeu/2026-09-22-feu/` — `feu-*-jour` (le panache de loin),
`feu-*-pres`, `feu-*-noirci` (vingt secondes plus tard), `feu-*-nuit`.

### Le jalon 6, morceau 7 — le meteore, et le ciel est fini (22 septembre 2026, le soir)

Le dernier morceau, et le seul qui **change la carte pour de bon**.

#### Ce qui n'a pas eu lieu : la refonte de la carte

Le §4.21 annoncait depuis des semaines que le meteore imposerait de transformer la carte en
**grille modifiable**. Il n'en a rien ete, et c'est la bonne nouvelle du chantier : le
cratere est une **ecriture dans la texture cuite** (`abimerLeSol`), la couche posee au bloc 3
pour les champs pietines et la terre retournee. Elle savait deja peindre un `"cratere"` —
rebord clair, fond sombre —, personne ne l'avait jamais appelee.

La raison de fond est une decision d'Angelos : **le cratere ne bloque pas le passage**. Un
trou infranchissable aurait demande la grille ; une cicatrice n'a besoin que de pixels.

#### Le noyau : une horloge, un point, une liste de cicatrices

`core/meteore.ts` (13 tests) tire a la tombee de la nuit, garde le point, fait grandir
l'annonce et rend le point d'impact **la seule image ou il touche**. Deux details :

- le point est tire **sur l'aire de l'anneau**, pas sur son rayon (`sqrt(min² + u·(max² -
  min²))`) : sans ca, plus de la moitie des meteores tombent contre le bord interieur. Un
  test le verifie sur 4 000 tirages ;
- **un seul a la fois** : tant qu'un meteore est annonce, la nuit suivante ne tire pas.

#### Deux defauts trouves en jouant, pas en relisant

1. **Le script de controle passait `arene.eglise.x`, qui n'existe pas.** Le centre valait
   donc `NaN`, le point aussi — et comme `NaN > rayon` est **faux**, le test de distance ne
   filtrait plus rien : le premier essai a rase **tout le village**, murs compris. Le bug
   etait dans le banc, pas dans le jeu (la scene passe la constante `EGLISE`), mais il dit
   quelque chose de vrai : une comparaison de distance est une passoire des qu'un `NaN`
   entre.
2. **Les departs de feu ne partaient jamais.** La fenetre entre le bord du cratere (2,5
   cases) et leur portee (4 cases) etait si etroite qu'aucune maison ne s'y trouvait — trois
   mondes de suite a zero. Portee passee a **six cases**, verifie sur un quartier bati pour
   l'occasion : 1 a 2 feux par impact.

⚠️ Et un troisieme, de methode : **un village de test a une a trois maisons debout**. Le
premier controle « le meteore ne detruit rien » etait donc vide de sens — il tombait dans un
champ. Il a fallu **batir un quartier de douze maisons** dans le script avant de pouvoir
mesurer quoi que ce soit.

#### Ce qui se voit et ce qui s'entend

L'**ombre** au sol est la seule chose du jeu qui dise « ici, dans douze secondes » : un
disque sombre, un anneau laiton, et un battement qui s'accelere. Elle grandit jusqu'a la
taille **exacte** du cratere — ce qu'on voit est ce qui sera detruit.

La **pierre** qui reste est un objet du monde : elle passe donc par Blender
(`decor-meteorite`). Premiere version rendue : un caillou gris, impossible a distinguer d'un
rocher. Les fentes de braise ont ete **multipliees par trois en volume** — a trente-deux
pixels, une fente fine disparait au premier arrondi.

Le son est fabrique au code comme le reste du ciel : douze secondes qui montent (trois bandes
croisees dans le temps, jamais un balayage de filtre) et un impact en trois gestes.

**943 tests verts** (+13). **Le jalon 6 est fini.**

**A regarder** : `captures/jeu/2026-09-22-meteore/` — `*-ombre` (l'avertissement),
`quartier-*-apres` (le cratere dans un village, deux maisons en feu a cote).

### Le jalon 6, morceau 6 — l'incendie (22 septembre 2026, l'apres-midi)

Les regles etaient ecrites depuis le 20 septembre et **trois crochets attendaient** dans le
code (`Meteo.extinction`, `Meteo.unEclairAllumeUnFeu`, `Maisons.abimerLaPlusProche`, plus le
drapeau `feuEnCraquant` du Pyromane). Le chantier a consiste a leur donner quelque chose a
bruler, sans toucher au ciel.

#### Le noyau ne connait pas le jeu

`core/incendie.ts` ne voit ni maison ni champ : on lui nomme des **combustibles**
(`{ id, x, y, sorte }`), il rend un **passage** (`degats`, `departs`, `eteints`) et la scene
applique. C'est ce qui permet de tester une propagation complete, une extinction a neuf
seaux et une reprise de sauvegarde **sans lancer de partie** — 24 tests.

Le foyer porte une **ardeur** (100 au depart) et un compteur `ronge`. L'ardeur ne baisse que
par les seaux, les heros et l'epuisement ; `ronge` sert au champ, dont la maturite ne mesure
pas ce qu'il a encaisse (un champ tout juste seme est deja a zero).

⚠️ **Un piege de flottant, paye tout de suite** : 0,4 soustrait 250 fois ne fait pas zero
mais 1,4 × 10⁻¹⁴. Un feu restait allume avec une ardeur d'un milliardieme. D'ou la constante
`ETEINT = 1e-6`, et le reglage du champ passe de 0,12 a **0,125** — un huitieme est exact en
binaire, et huit secondes tombent juste.

#### La portee de propagation, mesuree et corrigee

Le §4.21 dit « ses voisins a deux cases ». Code tel quel (`2 * CASE`, de centre a centre),
**rien ne se propageait** : mesure en jeu, la voisine la plus proche est a **64, 91 ou 96
pixels** selon le village, et une maison occupe deja deux cases de cote. La portee est passee
a **quatre cases entre milieux**, ce qui est la meme regle lue de bord a bord.

Deuxieme controle apres correction : le feu saute d'une maison a l'autre en six secondes.

#### Ce que la scene fait par-dessus

- `majIncendie()` **sort a la premiere ligne** tant que rien ne brule : une comparaison, et
  le §4.17 est tenu. Ce n'est que quand un feu existe que la liste des combustibles se
  construit (une trentaine d'elements, une fois par seconde).
- Une `Map<cle, Maison | Champ>` tient la correspondance : la cle est **la case**
  (`m<colonne>:<ligne>`, `c<x>:<y>`), ce qui traverse une sauvegarde — une reference d'objet,
  non.
- Les habitants vont au seau par la **vie autonome** (§4.27) : une occupation « eteindre » de
  plus, prioritaire sur la faim, jamais la nuit, jamais pour celui qui a craque. Le village
  demande deux choses a la scene (`feuAPortee`, `butDuSeau`) et ne connait toujours pas les
  incendies.
- Le repere de bord d'ecran est **deux images** : la pastille ne tourne pas, la pointe si.
  Premiere version a une seule image : la flamme tournait avec la pointe et se retrouvait la
  tete en bas. Juge sur capture, corrige.

#### Verifie dans le navigateur (`.tmp/feu.ts`, trois mondes)

Le feu prend, ronge (200 → 95 points de vie en vingt secondes), fait tomber la maison en
ruine, saute chez la voisine, se voit de nuit par sa lueur **au-dessus du voile**, se signale
au bord de l'ecran quand on regarde ailleurs, s'eteint en cinq secondes sous un heros — et,
laisse aux habitants, **quatre porteurs de seau l'ont noye tout seuls**.

⚠️ **Deux pieges de capture, payes ici** : forcer `voile.setAlpha()` ne donne pas une nuit
(`teinterLeCiel` la recalcule a l'image suivante — il faut pousser le **cycle**), et
`setZoom` sur la camera de l'arene est repris par le calage d'ecran.

**930 tests verts** (+28). Reste du ciel : le **meteore**, les flammes **Blender** et le
**son** du feu.

**A regarder** : `captures/jeu/2026-09-22/` — `feu-*-jour`, `feu-*-nuit` (la lueur),
`feu-*-repere` (le bord d'ecran), `feu-*-seaux`.

### Le jalon 6, morceau 5 — les betes d'eau (22 septembre 2026)

Le dernier morceau du ciel, et le plus cher : deux creatures modelisees pour ca, et une
nuit qui n'attaque plus par ou l'on attend.

#### Deux betes, deux metiers, aucun comportement neuf

- L'**Ecumeur** : le plus rapide du jeu (×1,5), frappe plus fort qu'un rodeur (×1,4), tient
  moins qu'une nuee (×0,6). Il traverse, il tape, il tombe.
- L'**Engloutisseur** : le plus lent (×0,5), encaisse comme une brute et demi (×3,4), et son
  coup est le plus telegraphe de tous (700 ms). On a le temps de s'ecarter, pas celui de le
  tuer.

Deux sur trois sont des ecumeurs : c'est le nombre qui doit faire peur, et un mur
d'engloutisseurs serait aussi impossible a tenir qu'ennuyeux a jouer.

⚠️ **Aucun des deux ne porte de comportement neuf** — ils reutilisent `fonceur` et `brute`.
Un comportement de plus, c'est une IA de plus a regler, et le §4.17 en a assez.

Et comme `ARCHETYPE_HUMAIN`, ils sont **hors de la table `ARCHETYPES`** : cette table est
celle qu'on **tire** pour les vagues, et ces deux-la ne se tirent jamais. Leurs champs
`seuil` et `poids` sont poses a zero pour que ca se voie.

#### D'ou elles sortent : les rives, pas les fronts

`rivesAutour(centre, rayon, combien)` cherche la terre ferme qui **touche** l'eau, dans un
rayon de 1 400 px autour de l'eglise, et rend les quatre plus proches.

On ne les fait pas paraitre **dans** l'eau : rien ne nage dans ce jeu, et un monstre pose
sur la mer serait un monstre qui flotte. Il sort donc **sur la berge**, la ou il pourrait
poser une patte.

⚠️ **Le tri se fait une seule fois, a la tombee de la nuit** — jamais par image (regle 5 du
§4.17). Et la liste peut revenir **vide** : un village sans lac ni mer a portee ne voit rien
sortir, et le jeu le dit (« l'eau est haute, mais elle est loin : la nuit sera ordinaire »).
C'est la seule reponse honnete — un village loin de l'eau ne craint pas la crue.

#### Ce que la planche a corrige

Premier rendu, deux defauts qu'aucune relecture de code n'aurait trouves :

1. **L'ecumeur debordait de son cadre.** Corps de 16 et queue de 9 : sur la planche, deux
   images se touchaient. Ramene a 11 + 5 — il reste le plus long du bestiaire, ce qui suffit
   a dire le nageur.
2. **L'engloutisseur etait un tas de pierres.** Sa matiere melangeait la chair de monstre a
   l'eau **sombre**, puis desaturait : gris sur gris, impossible de deviner qu'il sort de
   l'eau. Il prend desormais la couleur de l'eau elle-meme, en plus fonce.

Les deux matieres (`monstre_ecume`, `monstre_fond`) sont des **melanges** de ce qui existe,
pas des inventions : une bete d'eau doit rester une bete de ce jeu (§4.30).

#### Un troisieme defaut, trouve sur la capture en jeu

Le journal annoncait **« Nuit 1 — ils arrivent a l'EST »** pendant que les betes remontaient
du lac, a l'ouest. Une annonce qui ment sur la direction est pire que pas d'annonce — le
§4.6 veut qu'un assaut **se voie venir**. La nuit de crue dit donc « ils remontent de
l'eau », et n'annonce plus de front du tout.

**Verifie dans le navigateur** (trois lancements) : **18 controles sur 18**. Une nuit de crue
ne fait sortir que des betes d'eau (12 sur 12), et toutes surgissent a moins de 40 px d'une
berge. Sur un monde sans eau a portee, la nuit reste ordinaire — le controle le verifie
aussi.

**A regarder** :  — elles ont traverse la
douve debordee et sont dans le village.

**902 tests verts** (+5, les rives).

### Le jalon 6, morceau 4 — la crue coute enfin quelque chose (22 septembre 2026)

Jusqu'ici la crue existait comme **etat** — trois journees pluvieuses d'affilee — mais elle
ne coutait rien. Ses trois degats, decides le 22 septembre, sont codes.

#### 1. Les champs se noient

`Champs.noyer()` : toutes les cultures repartent de zero. C'est le seul des trois qui frappe
**d'un coup, a l'aube** — les deux autres rongent toute la journee. Ce que la pluie a donne
(la pousse doublee pendant deux journees), elle le reprend.

> Un champ deja **mur** n'est pas perdu : la moisson est automatique et passe a la seconde
> d'avant. Reprendre un ble deja rentre serait incomprehensible.

#### 2. Les batiments deja abimes cedent

`Maisons.ronger(seuil, part, maintenant)`, appelee toutes les **40 secondes** tant que la
crue dure : les maisons sous **60 %** de vie perdent **2 %** de leurs points de vie max.

⚠️ **Seulement ce qui est deja abime.** Une maison intacte tient la pluie — c'est une
maison, pas un chateau de sable. Ce que la crue punit, c'est de **ne pas avoir repare**
quand on voyait l'eau monter depuis deux journees.

Les chiffres sont regles pour **fragiliser sans detruire seul** : sur une journee et sa
nuit, une maison a 60 % descend vers 15 % — elle ne tombe pas d'elle-meme, mais le premier
monstre qui passe l'acheve. ⚠️ **Aucun des trois n'a ete joue.**

#### 3. Les douves debordent

Un drapeau `crue` sur la grille, et `bloque()` cesse de compter `douve-eau` parmi les cases
qui arretent un corps. Le champ de directions se refait **aux deux bascules seulement** —
c'est un changement de passage, exactement comme la pose d'un mur, et ca ne coute donc rien
de plus que ce qui existait.

Celui qui n'a mise que sur l'eau pour se defendre paie sa nuit : le pont-levis ne sert plus
a rien, les monstres passent par-dessus. Quatre tests dans `grille.test.ts` tiennent la
regle, dont un qui verifie qu'un **mur reste un mur** sous la crue : le debordement ne
devait ouvrir que l'eau.

#### Ce que la reprise d'une partie doit faire

Une partie enregistree pendant une crue **reprend en crue** : les douves redebordent et le
rongement repart. Sans ca, recharger serait une facon de faire baisser l'eau (§4.28, regle
ironman). Les champs, eux, sont deja noyes dans la sauvegarde — il n'y a rien a refaire.

**Verifie dans le navigateur** (`.tmp/verifier-ciel.ts`, **trois lancements**) : **16
controles sur 16**. Les champs perdent leur pousse, la douve passe de barree a franchissable
puis redevient barree quand l'eau se retire, et une maison a 60 points de vie descend a 56
au premier passage.

**897 tests verts** (+4).

### Le jalon 6, morceau 3 — le son du ciel (22 septembre 2026)

Quatre sons, **fabriques et non telecharges** (`npm run ciel`,
`scripts/son/ciel.ts`) : l'averse ordinaire, l'averse d'orage, le tonnerre proche et le
tonnerre lointain.

#### Pourquoi on les fabrique

Le 19 septembre, la cloche et le grondement avaient deja pris ce chemin faute de CC0
utilisable. Ici, trois raisons s'ajoutent, et elles sont meilleures :

1. Une pluie **ne se reconnait pas a son grain** — c'est du bruit filtre. Elle se fabrique
   donc mieux qu'elle ne se cherche.
2. Un enregistrement de pluie **ne boucle jamais** proprement : il faudrait couper au bon
   endroit et croiser. Fabriquee, la boucle est parfaite par construction.
3. Les banques qui ont de belles averses **interdisent aux robots** de telecharger.

#### Trois choses font la difference entre un souffle et une averse

- **Deux bandes, pas une** : un souffle large et sourd sous 900 Hz (la masse d'eau) et une
  bande de 1,4 a 7 kHz ou l'on entend les gouttes taper. Un seul filtre donne un sifflement
  de radio. Au-dela de 7 kHz ce n'est plus de la pluie, c'est du souffle de cassette.
- **Des gouttes comptees** : 150 a 470 impacts courts par seconde, poses au hasard, places a
  gauche ou a droite. C'est le **grain** qui manque au bruit pur.
- **Une respiration** : trois periodes sans rapport entre elles (7,3 s, 3,1 s, 1,7 s) font
  enfler et retomber l'averse. Une pluie d'intensite constante s'entend comme une machine.

Le bruit de gauche et celui de droite sont **independants** : le meme bruit des deux cotes
se colle au milieu de la tete et sonne comme un casque casse.

#### Le tonnerre arrive apres l'eclair, et c'est ca qui donne la distance

Un coup est fait de deux gestes : un **craquement** (bande haute, 0,35 s) puis un
**roulement** (bande grave qui monte vite, retombe et traine). De loin, l'air a mange les
aigus : le tonnerre lointain **n'a pas de craquement du tout**, il ne fait que gronder.

⚠️ **Et le son ne part pas avec le flash.** La lumiere est instantanee, le son non : le jeu
tire une distance a chaque eclair — 62 % tombent loin — et le tonnerre sonne **0,2 a 0,9 s
plus tard** s'il est proche, **1,4 a 3,4 s** s'il est lointain. Ce retard n'est pas une
finition : c'est lui qui fait qu'un eclair proche inquiete, et un lointain non.

#### Ce que le jeu en fait

L'averse est **une seule voix en boucle** sur la piste d'ambiance, qui monte et redescend
avec le **meme fondu de 2,5 s que le rideau** — l'oeil et l'oreille disent la meme chose.
Passer de la pluie a l'orage croise deux voix au lieu d'en couper une. Le tonnerre part sur
la piste des effets, avec une vitesse et une place tirees a chaque coup : deux coups
identiques s'entendraient comme un fichier.

⚠️ **Je n'ai pas pu les ecouter** — une page d'ecoute est livree pour ca :
`captures/son/2026-09-22-ciel/ecoute.html`, un bloc par son, avec ce qu'il faut juger. On
peut mesurer qu'une averse ne sature pas ; pas qu'elle ressemble a de la pluie.

**Verifie dans le navigateur** : 13 controles sur 13 (deux neufs — les quatre sons sont
charges, et un eclair arme bien son tonnerre avec un delai entre 200 et 3 400 ms).

### Le jalon 6, morceau 2 — ce qu'on voit du ciel (22 septembre 2026)

Le rendu de la pluie, de l'orage et des eclairs. **Quatre objets, crees une fois**
(`game/pluie.ts`), et deux textures cuites au demarrage (`game/dessin/pluie.ts`).

#### Deux rideaux qui defilent, jamais une goutte par goutte

Un systeme de particules aurait fait naitre des centaines d'objets par seconde : les regles
1 et 3 du §4.17 l'interdisent. On cuit donc **deux tuiles de 128 px** — un rideau proche,
long et rapide ; un rideau lointain, court et pale — et le jeu ne fait plus que les faire
defiler. Deux objets pour toute la pluie du jeu, quelle que soit la taille de la fenetre.

Les tuiles sont **raccordables a elles-memes dans les deux sens** : un trait qui deborde est
redessine de l'autre cote, sinon le defilement montrerait une couture toutes les
cent vingt-huit images.

#### Trois defauts trouves en regardant les captures, pas en relisant le code

1. **L'averse ne se voyait pas.** 26 et 54 traits par tuile : sur une image fixe, quelques
   hachures. Doubles (52 et 115), opacites remontees, relus sur capture.
2. **Le zoom grossissait la pluie.** Colle a la camera, un rideau subit quand meme le zoom :
   dezoomer agrandissait les gouttes au lieu d'en montrer davantage, et a la taille exacte
   de l'ecran un dezoom aurait decouvert des bandes seches sur les bords. Les quatre couches
   font donc **trois fois l'ecran**, et le `tileScale` compense le zoom — deux affectations
   quand le zoom change, rien par image.
3. **L'eclair delavait la nuit.** Un rectangle blanc a 0,55 d'opacite donnait un brouillard
   gris uniforme : le village disparaissait au lieu d'etre revele. Deux lectures de capture
   plus tard : **lumiere additive**, opacite **0,3**, et un **bleu froid** plutot qu'un
   blanc — un ajout blanc delave, un ajout bleu teinte.

#### Ce qui se voit maintenant

- La pluie **monte et descend en fondu** (2,5 s), jamais d'un coup : une averse qui apparait
  d'un coup se lit comme un bug d'affichage.
- L'assombrissement de l'averse est **sous** le voile de nuit, les gouttes **au-dessus** :
  une pluie peinte sous la nuit disparaitrait au crepuscule, alors que c'est la nuit qu'elle
  se voit le mieux. L'eclair, lui, passe **au-dessus de tout** — c'est tout son interet.
- L'eclair est **deux battements dans une meme fenetre de 180 ms**, pas un creneau : un
  eclair frappe rarement une seule fois, et un flash carre fait mal aux yeux.

#### L'annonce du matin change de voix selon le temps

Premiere capture : « Le ciel est bas — il pleuvra ce matin » s'affichait **en sang**, la
voix du guet. Or le §4.11 reserve le rouge au danger, et une averse n'en est pas un — c'est
un cadeau pour les champs. La pluie parle donc avec la voix du **village** ; l'orage, lui,
garde celle du **guet**, puisqu'il envoie plus de monstres, plus forts, des le jour.

**A regarder** : `captures/jeu/2026-09-22-ciel/` — le temoin au sec, l'averse, l'orage,
l'eclair de jour, la pluie de nuit, l'orage de nuit, l'eclair qui revele le village, et le
matin de crue.

⚠️ **Le son n'est pas fait** : bruit de pluie et tonnerre restent a trouver en CC0
(OpenGameArt, dix secondes entre deux requetes) et a brancher sur le curseur des bruits qui
existe deja (bloc 10).

### Le jalon 6, morceau 1 — le ciel dans le noyau (22 septembre 2026)

**Le premier morceau du jalon 6**, et celui qui porte la plomberie : `core/meteo.ts`,
pur et teste comme le cycle. L'orage, l'incendie et le meteore viendront s'y brancher
plutot que d'inventer chacun leur horloge.

#### Trois temps, un seul tirage par journee

`Meteo.passerLaJournee(rng)` est appelee **une fois par journee**, a l'aube — jamais par
image. Un tirage rejoue a chaque image consommerait la graine et rendrait le temps
illisible : c'est la meme regle qui vaut pour les fronts (§4.6) et pour la voile (§4.18).

Une journee sur trois est pluvieuse, et un quart de celles-la tournent a l'**orage** —
soit une journee sur douze. Deux tests de frequence sur trois mille journees tiennent les
deux chiffres : sans eux, un reglage change en passant ne se verrait qu'en jouant une
heure.

#### Le defaut que le premier controle navigateur a trouve

Le tirage etait branche a l'aube, et **a l'aube seulement**. Or l'aube n'arrive qu'au bout
d'une journee entiere de jeu : la premiere journee de toute partie aurait ete seche, et le
ciel n'aurait existe qu'a partir de la deuxieme. Le tirage du jour 1 se fait donc a
l'**installation**, juste a cote du premier visiteur, qui est offert pour exactement la
meme raison — un systeme qu'on ne rencontre jamais n'existe pas.

#### La crue, et pourquoi elle ne s'enchaine pas

Trois journees pluvieuses d'affilee font la **crue** (§4.21). Le lendemain d'une crue est
sec **quoi que dise le tirage** : sans ca, une quatrieme journee pluvieuse rendrait la crue
quotidienne, et l'evenement rare serait devenu le decor. Un test l'exige explicitement —
sous une pluie continue de quarante journees, deux crues ne se suivent jamais.

#### L'orage : l'entorse consentie, et sa borne

*Decision d'Angelos, 22 septembre 2026* : « les monstres sont plus nombreux et plus forts
la nuit, et ils peuvent meme attaquer beaucoup plus souvent en plein jour ».

⚠️ **« Plus nombreux » contredisait frontalement la regle n°2 du §4.17** (« la difficulte
monte par la force, pas par le nombre »). La contradiction a ete signalee une fois, puis
tranchee de la seule facon qui tienne les deux bouts — et **le meme jour, Angelos a annule
cette regle** en ecrivant le §4.33 (le jalon 6.2, la horde). Ce qui suit reste pourtant
vrai, parce que ca ne parlait pas de la meme chose :

- l'**effectif d'une nuit** d'orage monte de moitie — c'est le total que la nuit envoie,
  donc la duree et la pression de l'assaut ;
- le **plafond d'ennemis a l'ecran ne bouge pas d'un pouce**. C'est lui que le §4.17
  protege, et c'est lui qui decide si le jeu rame.

Le reste de l'orage ne coute rien de neuf :

- **plus forts** : `nuitEquivalente` ajoute deux nuits d'avance a la puissance. Les memes
  betes, en pire — et comme les hordes de jour lisent la meme fonction, elles montent avec.
- **plus souvent, meme de jour** : c'est **exactement** le mecanisme du village qui
  « attire » au-dela de soixante-cinq habitants (§4.18). On le reutilise au lieu d'en
  ecrire un deuxieme : un orage, c'est un village qui attire pour une journee. Mesure en
  jeu : **181 s entre deux hordes par temps sec, 30 s sous l'orage**.
- l'**annonce**, elle, reste celle du village : le ciel a deja parle au lever, et deux
  lignes pour le meme evenement chasseraient les quatre autres de la boite (§4.10).

#### Deux crochets poses d'avance, que rien ne lit encore

`extinction()` (un feu s'eteint deux fois plus vite sous la pluie) et
`unEclairAllumeUnFeu()` (un eclair sur vingt). **Rien ne brule encore** — l'incendie est le
morceau suivant du jalon. Poser les deux maintenant coute deux fonctions et evite d'avoir a
rouvrir le ciel quand le feu arrivera. Meme geste que `Maisons.abimerLaPlusProche` au bloc
12.

#### Ce que la sauvegarde garde

`meteo?: EtatMeteo`, optionnel : une partie d'avant le jalon 6 reprend au sec, ce qui ne
lui fait rien perdre — la pluie est l'etat d'une journee, pas un acquis. Et le ciel se
reprend **sur place** (`reprendreDe`), comme le cycle : la scene tient la reference depuis
sa construction. Une crue reprend en crue, un orage aussi — recharger n'est pas une facon
d'eteindre le ciel (§4.28, regle ironman).

**Verifie dans le navigateur** (`.tmp/verifier-ciel.ts`, **trois lancements**, mondes tires
au sort) : **11 controles sur 11**, aucune erreur de console. Le ciel existe des le jour 1,
un champ murit exactement deux fois plus vite sous la pluie (0,024 contre 0,048 de
maturite), la nuit d'orage passe de 119 a 178 monstres, leur puissance de 4,5 a 6,3, les
hordes de jour de 181 s a 30 s d'ecart, un matin sec ne dit rien dans la discussion, et le
ciel part bien dans la sauvegarde.

**893 tests verts** (+34). ⚠️ **Rien ne se voit encore** : le rendu — gouttes,
assombrissement, eclairs, son — est le morceau 2.

### Le bloc 12 — la vie autonome, et le jalon 5 est fini (21 septembre 2026, tard)

**Le dernier bloc du jalon 5**, et celui que le §4.27 annonce comme « le système le plus
dangereux du document pour les performances ». Deux fichiers : `core/vieAutonome.ts`
(l'arbre de priorités, les initiatives, le tour de rôle — pur et testé) et
`game/vieAutonome.ts` (le pool de bulles). Le reste vit dans `village.ts`, là où les
habitants bougeaient déjà.

#### Le périmètre est le bon endroit, pas une restriction

*Décision d'Angelos* : la vie autonome **ne coûte rien à la production**. Ça tombe bien —
la branche qui faisait se tenir un habitant devant sa maison sans rien faire est exactement
celle qui s'active quand il n'a **ni poste, ni ancre**, qu'il fait **jour** et que **rien
ne rôde**. On l'a remplie au lieu d'en ouvrir une nouvelle. Celui qui travaille travaille,
et l'économie déjà réglée ne bouge pas d'un point.

Il reste `en-route` et jamais `au-poste` : l'état n'est pas qu'une étiquette, `au-poste`
veut dire qu'on produit et qu'on s'use.

#### Trois par image, et le tour est bouclé en un sixième de seconde

`prochainTour(curseur, total)` rend trois index et le curseur suivant. Une fonction pure,
un compteur, quatre tests — dont un qui vérifie qu'en dix images on a réveillé les sept
habitants d'un village sans en oublier un. C'est tout ce qu'un « à tour de rôle » demande,
et ça se teste sans jeu autour.

Le réveil **décide** ; il ne déplace pas. Le déplacement reste la boucle d'avant.

> **C'est aussi là que la peur du §4.26 prend effet**, et nulle part ailleurs. Elle était
> écrite et testée au bloc 11 mais pas branchée : « la peur fait fuir un poste quand
> l'autre s'en approche » demande une distance par paire, donc un tour de rôle. Elle l'a.

#### Le défaut que seule une partie révèle

Première version en jeu : `flaner,flaner` attendu, **`discuter,discuter,discuter`** obtenu,
et plus personne ne bougeait. Cause : dans un village de huit, tout le monde se tient près
de l'église, donc tout le monde a un voisin à portée, donc tout le monde discute — et en
boucle, puisque rien ne terminait la conversation. En prime, ils se donnaient la position
de l'autre comme but et se marchaient dessus.

Deux horodatages et une ligne : une conversation **dure** 2,6 s, celui qui vient de parler
ne reparle pas avant quatre fois ce temps, et ils s'arrêtent **là où ils sont** au lieu de
se rentrer dedans. Le contrôle Playwright « ils se déplacent au lieu de rester plantés »
est né de ce défaut et le garde fermé.

#### Les bulles, dessinées et jamais écrites

Ni emoji ni caractère : trois textures de 12 px tracées au code (`dessin/bulles.ts`),
cuites une fois. Un pool de **douze images recyclées** ; au-delà, la plus vieille se rend.
Neuf secondes de repos entre deux bulles d'une même personne.

Et elles ne disent rien que le jeu ne sache déjà : le cœur vient d'un lien positif ≥ 60
(§4.26), la goutte d'un stress ≥ 60, la chope du reste. Une bulle tirée au sort serait de
la décoration ; celle-ci est une lecture.

#### Les initiatives : six, et trois moments

Testées **sur événement** — à l'aube, à la tombée de la nuit, et quand un mur tombe. Trois
moments, pas soixante par seconde. Chacune demande un **trait fort** *et* une **situation
extrême**, et les deux sont obligatoires : deux tests vérifient qu'aucune ne part sans le
trait, et qu'aucune ne part sans la situation.

Quatre d'entre elles ont demandé une méthode neuve, et chacune est petite :
`Village.envoyerDefendre` (qui passe en posture de travail, donc la cloche le rappelle),
`Village.rassembler`, `Village.seServir` (sur la ressource la plus abondante — c'est celle
qu'on remarque le moins, et c'est ce qu'un voleur choisit) et
`Maisons.abimerLaPlusProche`.

> ⚠️ **Le Pyromane n'allume rien, et c'est écrit noir sur blanc.** Le feu est au jalon 6
> (§4.21). En attendant il abîme : un quart des points de vie de la maison la plus proche,
> donc quatre nuits pour la mettre à terre, donc le temps de s'apercevoir de quelque chose.
> Le jour où l'incendie existera, c'est cette fonction qui l'allumera et rien d'autre ne
> changera.

> ⚠️ **Une initiative ne fait jamais perdre un habitant sans que le joueur ait pu réagir.**
> Celui qui sort défendre l'église garde une posture de travail : la cloche le rappelle et
> le rayon de fuite le fait rentrer comme tout le monde. C'est la règle centrale du §4.18.

#### Un piège de Playwright, payé ici

`page.evaluate` **renvoie la dernière expression**. Un `cameras.main.centerOn(...)` à la
fin d'un bloc renvoie la caméra entière, que Playwright essaie de sérialiser — et Node
tombe sur `Cannot create a string longer than 0x1fffffe8 characters`. Le script se
terminait par une pile d'erreurs après avoir tout validé. Un `void 0;` en fin de bloc, et
c'est réglé. À retenir pour les scripts suivants.

**Vérifié dans le navigateur** (`.tmp/verifier-vie.ts`, trois lancements, mondes tirés au
sort) : **12 contrôles sur 12**, aucune erreur de console. Les habitants sans poste font
quelque chose, aucun n'est au poste pour autant, ils se déplacent vraiment, une rencontre
pose une bulle, le pool ne dépasse jamais douze, rien ne se déclenche quand rien d'extrême
n'arrive, un front qui cède fait bouger quelqu'un, trois annonces par nuit au maximum, un
discours fait redescendre le stress de tout le village, un vol se prend sur la ressource la
plus abondante, et un pyromane abîme sans mettre à terre.

**À regarder** : `captures/jeu/2026-09-21-vie/` — le village où chacun vaque, et les trois
bulles au zoom.

**859 tests verts** (+27). **Le jalon 5 est fini.**

### Le bloc 11 — la mémoire du village (21 septembre 2026, au soir)

**L'avant-dernier bloc du jalon 5**, et celui qui décide si le joueur dira « j'ai passé la
nuit 30 » ou « j'ai perdu Marc à la nuit 17 ».

Trois fichiers, et la séparation porte tout le reste : `core/relations.ts` (ce qu'un lien
vaut), `core/memoire.ts` (souvenirs, archives, récit, conséquences d'une mort),
`game/memoire.ts` (**quand** tout ça bouge). Aucun des trois ne connaît Phaser, y compris
le dernier — il ne voit que des personnes, des postes et des journées, ce qui permet de le
tester sans navigateur comme `ennemis.test.ts`.

#### L'identité sociale vit sur la personne, et c'est le choix structurant

Chaque `Personne` reçoit une identité stable à sa création. **Pas sur le héros, pas sur
l'habitant : sur la personne.** Un villageois qui s'éveille au bloc 9 garde sa `Personne`,
donc il garde ses liens — un identifiant posé sur le corps aurait fait disparaître
l'histoire de quelqu'un au moment précis où elle devient intéressante.

Elle ne remplace pas `hero.identifiant`, qui sert à l'affinité du §4.16. Les deux systèmes
ne se touchent qu'en **un** point, et c'est un veto : deux ennemis (haine ≥ 60) voient leur
affinité militaire remise à zéro, **record compris** — sinon le plancher d'acquis leur
aurait rendu le quart de ce qu'ils avaient appris.

#### Un seul type par paire, et il se dispute la place

C'est la décision qui évite le piège évident (deux entrées « amitié 40 » et « haine 30 »
qui coexistent sans rien vouloir dire). Poser de la haine sur une amitié **use** l'amitié,
et si elle tombe à zéro le reste passe en haine. Deux sentiments de même signe se
remplacent sans rien perdre ; de signes opposés, ils se mangent. La famille est la seule
exception : elle s'installe par-dessus tout et ne s'use pas.

Garde-fous, tous testés : plancher à 5 (sous lequel le lien est **effacé**, pas gardé à
zéro), plafond à 100, 600 paires au maximum. Un test pose 3 160 paires sur 80 habitants et
vérifie que la borne tient.

#### Huit sources de liens, toutes sur événement

Journée au même poste (+3 amitié), nuit à tenir la même ligne (+4 respect), les deux gros
tueurs d'une nuit (+8 rivalité), un sauvetage (+20 dette), une rage (+25 peur chez les
témoins), un éveil (+18 admiration), une amitié qui passe 70 (amour, une chance sur huit
par jour), et une mort.

> **Deux règles trouvées en test, et les deux comptent.** La rivalité se pose **avant** la
> passe des paires : posée après, elle se heurtait au respect que la même nuit venait de
> créer, les deux s'annulaient, et il ne restait rien. Et **un lien négatif n'est jamais
> adouci par une journée de travail** — sans ça, une haine passait son temps à être rongée
> par l'amitié du poste commun et ne tenait pas deux nuits.

La passe de l'aube est en n² sur les vivants : trente habitants font 435 paires **une fois
par jour**. C'est sans commune mesure avec 435 paires soixante fois par seconde, et c'est
exactement la lecture que le §4.26 demande de ses « relations qui bougent sur événement ».

#### Une mort passe par une seule porte

`Village.temoinsDeLaMort` appliquait le pic de stress lui-même, à l'identique pour tous.
Il ne peut plus : ce que coûte une mort dépend de la **relation** qu'on avait avec le mort,
et les relations vivent au-dessus, avec les héros dedans. Le village dit maintenant **qui
est tombé et qui a vu** ; la scène sait ce que ça change. Les deux populations passent par
la même fonction, `uneMort`, qui fait tout d'un coup : stress modulé, trait, souvenir
fondateur, tombe sur la carte (24 au plus), archives, legs mis de côté.

#### Trois mensonges du récit, attrapés sur les captures

C'est le vrai travail de la soirée, et il ne se voyait qu'à l'image.

1. « **Il n'avait jamais combattu.** » ne porte aucune variable, donc elle survivait à
   l'absence du métier : le jeu l'affirmait d'un inconnu. D'où `{?fait}`, un marqueur qui
   **conditionne une ligne sans rien y écrire**.
2. « **Tancrède a pris une épée.** » pour un pêcheur tombé à son poste, qui n'avait rien
   pris du tout. Une mort porte désormais ce qu'on sait d'elle — le métier, si la personne
   s'était armée (milicien ou sorti défendre), si c'était la nuit — et le récit ne dit que
   ça.
3. « **LA NUIT DE BERTILLE** » pour une mort survenue en plein jour. Le titre lit le même
   fait et écrit « LE JOUR DE » quand c'en était un.

> C'est exactement la garantie que le §4.26 réclame — « un texte assemblé ne raconte jamais
> quelque chose qui n'a pas eu lieu » — et elle ne tenait pas. Trois tests la tiennent
> maintenant, dont un qui passe les cinq types d'événement avec et sans variables et
> vérifie qu'aucune accolade ni aucun `undefined` n'atteint jamais l'écran.

#### Deux traits neufs, pour la même raison

Le §4.26 dit « certains en sortent plus courageux, d'autres plus peureux ». `hante` et
`endurci` existaient — mais leurs résumés annoncent une autre histoire (« a vu mourir trois
habitants », « a survécu à une nuit sous 20 % »). Les réutiliser **faisait mentir la
fiche** : vu sur une capture, un bûcheron devenait *Hanté* pour avoir perdu une amie, la
fiche jurant qu'il avait vu mourir trois personnes. D'où **Endeuillé** et **Aguerri**,
départagés par le Courage au seuil de 55.

Et un troisième, **Héritier**, parce que le trait nommé d'après le mort que le §4.26
imaginait (« Vengeance d'Arthur ») n'est pas faisable : le §4.23 exige des identifiants
numériques et interdit d'en fabriquer un par personne. Le nom du mort vit dans le souvenir
fondateur juste en dessous. Le trait porte l'effet, le souvenir porte l'histoire.

#### L'héritage réutilise l'écran de montée de niveau

*Décision d'Angelos* : proposé, jamais donné. La compétence du mort arrive en **quatrième
ligne** du choix, marquée « HÉRITAGE DE MARC » en laiton. Zéro interface neuve.

#### Ce qui se lit à l'écran

La fiche gagne **CE QU'IL A VÉCU** : ses quatre liens les plus forts, puis ses cinq derniers
souvenirs derrière un filet de sang séché. Le tableau du village (`F`) gagne les
**archives** : six histoires, titre en sang frais tant que l'événement pèse, en os mat une
fois estompé.

> ⚠️ **Le texte n'est assemblé qu'à l'ouverture du panneau.** `etatVillage` est lu soixante
> fois par seconde — y mettre les archives aurait construit des phrases à chaque image, ce
> que le §4.17 interdit et ce que le §4.26 interdit deux fois. Le panneau les lit dans
> `basculer()` et les garde.

#### Ce qui n'est pas fait, et pourquoi

- **La peur qui fait fuir un poste** : écrite et testée (`craint`), pas branchée. Elle
  demande un réveil **au tour de rôle**, ce qui est précisément ce que le bloc 12 apporte.
- **Jalousie et trahison** existent comme types mais rien ne les crée : aucun système ne
  produit aujourd'hui de traître ni de promotion enviable. Les poser au hasard serait
  exactement ce que la section interdit.
- **La famille** ne vient de nulle part tant que les naissances n'existent pas (§4.18).

**Vérifié dans le navigateur** (`.tmp/verifier-memoire.ts`, trois lancements, mondes tirés
au sort, relance jusqu'à trouver un village d'au moins trois habitants) : **20 contrôles
sur 20**, aucune erreur de console. Les identités sont uniques, le village démarre sans un
seul lien, un ami paie 35 points de stress là où un inconnu en coûte 14, les liens du mort
partent avec lui, la tombe se pose, l'archive s'inscrit et pèse sur la satisfaction, trois
morts d'un coup font un massacre, une nuit sans perte fait une nuit tenue, la dette fait
obéir un paranoïaque, et la sauvegarde emporte tout.

**À regarder** : `captures/jeu/2026-09-21-memoire/` — les archives sous le tableau du
village, et la fiche d'un bûcheron qui a perdu quelqu'un.

**832 tests verts** (+86).

### Le bloc 10 — la pause et les touches remappables (21 septembre 2026, au soir)

**Le dernier bloc du jalon 5 dont l'absence se paie.** Sa moitié visuelle était tombée la
veille (le rendu à la densité de l'écran, §4.11) ; restaient les trois choses que le §4.10
annonçait depuis le début : la pause, le menu d'options, et des touches qu'on règle.

**Quatre décisions prises avant de coder**, groupées : *Rompez* passe d'Échap à `O` ; le menu
a cinq lignes, dont « Abandonner » ; l'héritage du bloc 11 sera **proposé** et non
automatique ; et la vie autonome du bloc 12 ne coûtera **rien** à la production.

#### Une seule table de touches, et trois lecteurs

`src/core/touches.ts` — pur, sans Phaser — porte les **36 actions** du jeu : leur nom, leur
famille, leur touche par défaut et leurs alias fixes. Trois endroits la lisent et plus aucun
ne décide : `ArenaScene.configurerTouches`, `panneauTouches.ts`, et la ligne d'aide de
`hud.ts`.

> **C'est la réparation d'une dette écrite d'avance.** Le §4.10 disait déjà que la ligne
> d'aide « devra lire le mappage au lieu de réciter des lettres écrites en dur ». Les touches
> vivaient à deux endroits, et les deux dérivaient l'une de l'autre dès qu'on en ajoutait
> une : `U` (la cour, bloc 9) n'était pas dans l'aide, `M` (l'aménagement) non plus.

Trois règles portent tout le fichier, et elles sont testées :

1. **Deux actions ne se disputent jamais une touche : elles l'échangent.** Poser `G` sur la
   cloche rend à la palissade l'ancienne touche de la cloche. Sans ça, remapper vite ferait
   disparaître une fonction du jeu sans prévenir — et le panneau dit l'échange en une ligne.
   Le test le vérifie sur six remappages d'affilée : aucune action ne finit muette, aucune
   touche n'est partagée.
2. **Une action a une touche principale et des alias fixes.** Pavé numérique, flèches,
   ESPACE : du confort de clavier, pas des réglages. Une touche prise par un alias est
   **refusée**, en disant laquelle — un alias appartient à son action par construction, il ne
   peut pas s'échanger.
3. **On n'enregistre que ce qui diffère du défaut.** Une action ajoutée plus tard arrive donc
   avec sa touche sans invalider le réglage du joueur, et un fichier abîmé (valeur qui n'est
   pas une chaîne, doublon) retombe sur le défaut au lieu de rendre le jeu injouable.

`src/game/touches.ts` est le pont Phaser : `localStorage` (comme les volumes de `son.ts`),
conversion nom ↔ code, et une classe `Clavier` qui **débranche et rebranche tout** quand le
mappage change. Les appelants déclarent une action (`surAppui("cloche", …)`), jamais une
lettre.

> ⚠️ **Le mappage est unique pour tout le jeu**, pas un par scène. Deux scènes écoutent le
> clavier — l'arène et l'interface — et un mappage par scène aurait garanti qu'un des deux
> soit périmé le jour où on remappe en pleine partie.

#### Échap appartient à l'interface, pas à l'arène

C'est la seule scène qui sache ce qui est ouvert par-dessus le jeu. Échap **referme d'abord**
— panneaux d'options, menu, menu d'ordres, fiche, port, tableau du village, mode
d'aménagement — et ne met en pause qu'une fois l'écran net. Trois panneaux ne sont pas dans
la pile, et c'est voulu : le choix de compétence, la fiche d'un arrivant et la rencontre
**attendent une réponse**.

**La pause rend le temps.** `poserLaPauseDuJoueur` / `leverLaPauseDuJoueur` suivent exactement
le patron du mode d'aménagement : `decalerLeTemps(now - début)` à la reprise. Sans ça, toute
la nuit frapperait dans l'image du dégel — rechargements, coups armés et apparitions arrivant
à échéance d'un coup.

#### Trois pièges payés

- **Deux panneaux répondaient au même Échap.** `PanneauSon` écoutait `keydown-ESC` tout seul
  (il est seul sur l'écran-titre) ; en partie, il se fermait **et** l'interface enchaînait sur
  la ligne suivante de sa pile. Il prend maintenant un `gereEchap` que l'écran-titre laisse à
  vrai et que la partie met à faux.
- **Remapper une touche déjà prise était impossible**, parce que la touche Phaser existante
  mangeait l'événement. Le panneau écoute donc sur `document` **en capture** : `window`
  reçoit en bulle (`addEventListener('keydown', …, false)` dans le `KeyboardManager` de
  Phaser), donc un `stopPropagation()` au niveau `document` passe devant lui.
- **Le panneau des volumes était cassé depuis la veille**, et personne ne l'avait vu : il se
  plaçait avec `scale.width` — qui compte en **vrais pixels** depuis le passage à la densité
  d'écran — et ses curseurs lisaient `pointer.x` sans le passer dans la caméra. Sur un écran
  à 150 %, la plaque partait hors du cadre et le volume sautait d'une fois et demie la
  distance parcourue par la souris. Corrigé avec `largeurEcran` et `positionToCamera`.

#### Corrigé en regardant les captures

La première version du panneau des touches mettait « se déplacer » et « se battre » à gauche
et les trois autres familles à droite : **17 lignes contre 24**, et la moitié gauche restait
vide sur toute sa hauteur. Le partage est maintenant mesuré. Deux autres défauts vus sur la
même image : « Tout remettre à zéro » débordait du cadre par la gauche (le lien est centré sur
son point), et les panneaux d'options flottaient sur un village en pleine lumière — le voile
du menu **survit** maintenant quand le menu s'efface pour leur laisser la place.

Et un troisième, vu sur la ligne d'aide : elle annonçait « ESPACE capacité » ; le jour où elle
s'est mise à lire le mappage, elle est passée à « 1 capacité ». Vrai, mais moins utile — sur
un clavier AZERTY le 1 demande Maj et ESPACE non. Elle dit les deux : « 1/ESPACE ».

#### Ce qui a changé de place

- **Rompez : Échap → `O`.** Il reste une ligne du menu d'ordres, donc accessible sans clavier.
- **La cour d'entraînement (`U`) rejoint les touches vivantes sous le mode d'aménagement.**
  Elle manquait depuis le bloc 9 : on ne pouvait pas choisir d'en poser une une fois entré en
  aménagement, alors que les six autres constructions le permettaient. Un oubli, pas une règle.
- **`R` reste écrite en dur** : elle n'existe que sur l'écran de fin, où plus rien d'autre ne
  répond.

#### Le test de performance de la carte, assoupli avec sa raison

`carte.test.ts` mesurait une peinture avec `performance.now()` et exigeait moins d'une
seconde. Vitest fait tourner ses fichiers **en parallèle** : la même peinture prend 520 ms
seule et 820 ms quand toute la suite occupe la machine — et elle a dépassé la seconde le jour
où la suite a grossi de 26 tests. Mesuré des deux côtés, avec et sans le bloc 10 : aucune
régression, c'était le budget qui était trop serré pour une machine chargée. Le test prend
maintenant **le meilleur de trois passes** — une vraie lenteur ralentit les trois.

**Vérifié dans le navigateur** (`.tmp/verifier-pause.ts`, trois lancements, mondes tirés au
sort) : **21 contrôles sur 21**, aucune erreur de console. Échap arrête vraiment le jeu (le
cycle ne bouge pas), le remappage prend, l'échange rend sa touche à l'autre, Échap referme
dans le bon ordre, `O` dit « Rompez ». Et (`.tmp/verifier-sortie.ts`) : « Sauver et quitter »
rend l'écran d'accueil avec la partie enregistrée, « Abandonner » demande confirmation au
premier clic et efface la sauvegarde au second.

**À regarder** : `captures/jeu/2026-09-21-pause/` — le menu, le panneau des touches, les
volumes, et l'aide dépliée qui lit le mappage.

**746 tests verts** (+26).

### Le bloc 9 — le village armé, et la seule source de héros (21 septembre 2026)

**Le bloc le plus important du jalon 5.** Depuis le 5.5 on commence seul, et quatre jalons
de code — les ordres, les postures, les formations, l'IA de repli, l'expérience de groupe —
tournaient à vide faute d'un deuxième héros. Il n'y avait **aucun moyen** d'en obtenir un.

#### Le noyau : `src/core/dons.ts` (neuf, 11 tests)

`tirerLeDon`, `entrainer`, `reveilParLeDanger`, `rituel`. Un habitant sur dix porte un don,
un don sur vingt est majeur — **mesuré sur 40 000 tirages**, pas supposé. Le don porte une
classe tirée à la naissance et **cachée**, et il naît endormi.

Il vit sur la `Personne` (`personne.don`), donc il traverse tout ce qui porte une personne :
l'arrivant à la porte, le survivant de la route, l'habitant — et le héros qu'il deviendra.

> ⚠️ **Il se tire en dernier dans `creerPersonne`.** Placé avant les traits de naissance,
> un tirage de plus **décale toute la suite aléatoire** : à graine égale, tout le monde
> changeait de traits, et un test de la faim qui n'avait rien à voir est tombé. C'est
> exactement ce à quoi servent les tests seedés.

#### Le passage habitant → héros

`ArenaScene.eveillerUnDon(villageois, voie)`. Le héros naît **avec la `Personne` de
l'habitant, le même objet** : `new Hero(..., personne)` prend désormais une personne
existante au lieu d'en fabriquer une. Nom, traits, stress, séquelles, visage : rien n'est
recréé. C'est toute la promesse du §4.29 — « chaque héros aura eu un nom d'habitant ».

L'habitant quitte le village **avant** que le héros ne paraisse : deux corps au même endroit
se pousseraient l'un l'autre.

**La barre d'équipe grandit en cours de partie** (`Hud.ajouter`), ce qui est neuf : elle
était fabriquée une fois pour l'équipe de départ, du temps où l'on commençait à sept.

#### La cour d'entraînement : `src/game/cour.ts` (neuf)

Un seul bâtiment par village, 120 bois et 40 minerai, touche `U`. Même forme que `Maisons`
et `Champs` : le parc tient la grille à jour, la scène ne parle jamais aux cases.

Son dessin est au code (`peindreCour`), comme tous les bâtiments — un PNG Blender pourra le
remplacer sous la même clé `bati-cour`.

> ⚠️ **Premier jet : une caisse brune illisible à vingt pixels.** Palissade fermée sur
> quatre côtés, sol uni. Trois choses la sauvent, et ce sont celles qui sauvent tous les
> bâtiments du §4.30 : **quelque chose qui dépasse par le haut** (trois hampes au-dessus de
> la palissade), **un devant ouvert** (deux poteaux d'angle, pas un mur), et **du sol qui
> n'est pas uni** (terre piétinée, tachée). Jugé sur la planche agrandie ×8, corrigé, puis
> revu en jeu.

#### Le milicien

Un métier de plus dans `core/habitants.ts`, donc donnable depuis le menu du bloc 8 sans
rien ajouter à l'interface. Les **trois paliers** du 9 septembre sont codés :
`PV_PAR_PALIER` — civil 30, milicien 60, vétéran 100 à dix niveaux de combat. Le palier
multiplie aussi les dégâts, dans le même rapport : une seule courbe à comprendre.

`Village.patrouiller()` : il va au-devant de ce qui entre, sinon il instruit, sinon il fait
sa ronde. **Il ne se met jamais à l'abri**, ni la nuit ni à la cloche — c'est exactement ce
pour quoi on l'a armé. Son dessin : le seul habitant en fer, et une lance qui dépasse.

#### Deux choses apprises en pilotant

1. **La leçon du chantier, encore — deux fois dans la même journée.** Un villageois visé
   sur un **point exact** à côté d'un bâtiment n'arrive jamais : il avance en ligne droite
   (§4.17). L'instructeur était à 19 px de la cour et restait « en-route » pour toujours.
   **Règle générale désormais : un poste qui n'est pas en terrain libre se juge à un
   rayon, jamais à un point.**
2. **« L'instructeur est-il dans la cour à cet instant » était la mauvaise question.** La
   formation se solde à l'aube, et à l'aube un milicien revient de sa nuit : la trouver
   remplie aurait été un coup de chance. On demande **« y a-t-il un milicien »** — il est
   l'instructeur par son métier, c'est ce qu'on a payé en le retirant de la production.

#### Vérifié

`node .tmp/verifier-bloc9.mjs <graine>` : **20/20**, cinq mondes. La cour se bâtit et il n'y
en a qu'une, le menu inscrit à la cour, **rien n'avance sans instructeur**, le milicien tient
la cour, le porteur transcende et rejoint l'équipe **en gardant son nom**, il prend la classe
de son don — et les postures, les formations et le panneau ORDRES reprennent vie. Le rituel
de l'église réveille à coup sûr.

**720 tests verts** (+11). **À regarder** : `captures/jeu/2026-09-21-bloc9-village-arme/`.

### Le bloc 8, premier morceau — les ordres pour tous (21 septembre 2026)

**Ce qui marchait avant.** Un héros se commandait à la souris (clic droit, `W`/`X`/`C`,
`V`). Un habitant, lui, ne se commandait **que** depuis le tableau `F` : un clic faisait
tourner sa posture, un clic droit son poste. Trois métiers sur sept — forgeron, charpentier,
guetteur — existaient dans les données depuis le bloc 2 **sans qu'on puisse les donner à
personne**, parce que le tableau ne savait cycler que les quatre postes de la carte.

**Ce qui marche maintenant.** `Tab` prend le mode commandement ; dedans, le clic gauche
sélectionne au lieu de déplacer, un cadre tiré prend héros et villageois mélangés, et le
menu d'ordres s'ouvre collé à la personne. Douze lignes en quatre paquets.

#### Le découpage

- **`src/core/ordres.ts`** (+6 tests) : le catalogue `TACHES` — quinze entrées, leur paquet
  (`travail` / `civil` / `combat` / `moi`), et pour qui elles valent (`civil`,
  `combattant`, `tous`). `tachesPour()` rend l'union pour une sélection mélangée. C'est du
  contenu, donc c'est testé et ça ne connaît pas Phaser.
- **`src/game/menuOrdres.ts`** (neuf) : la liste verticale, dans le chrome de la maison
  (plaque de fer, banderole sanglante, liseré d'accent). Ses quinze lignes sont fabriquées
  **une fois**, écouteurs compris, et recyclées — rien n'est créé en cours de partie.
- **`src/game/commandement.ts`** : la sélection devient mixte (un `Set<Hero>` et un
  `Set<Villageois>`), plus `selectionnerDans()` pour le rectangle et `ancrerCivils()`.
- **`src/game/village.ts`** : un `Villageois` porte enfin une `ancre` et un `suit`, comme un
  héros. `tenirLePoint()` le conduit ; `changerMetier()` donne les trois métiers sans poste.
- **`src/scenes/ArenaScene.ts`** : `Tab`, le rectangle, le menu, l'application des tâches.

#### Trois pièges du navigateur, payés ici

1. **`camera.scrollX` n'est pas le coin de la vue quand la caméra est zoomée.** `centerOn`
   pose `scroll = centre − largeur/2`, **sans diviser par le zoom**. Viser un villageois par
   `(monde − scrollX) × zoom` tombait à 600 px à côté, et le clic « ratait » sans rien dire.
   Le coin visible, c'est **`worldView`** — recalculé au rendu suivant seulement (le piège du
   5.6, encore lui). Écrire `(monde − worldView.x) × zoom`.
2. **Les deux scènes reçoivent le même clic.** Choisir une ligne du menu (scène `ui`)
   déclenchait aussi le clic « sur le vide » de l'arène juste derrière : le menu se refermait
   et un rectangle partait. L'arène demande maintenant `ui.input.hitTestPointer(p)` avant de
   traiter un clic en mode commandement.
3. **`Rompez` ne libérait pas les habitants.** Il effaçait `ancre` mais pas `suit`, et
   `suivreLesProteges()` reposait l'ancre à l'image suivante : la touche ne faisait
   strictement rien. Invisible en test unitaire, trouvé en pilotant une vraie partie.

#### Vérifié

`node .tmp/verifier-ordres.mjs <graine>` pilote une partie complète et compte 22 contrôles :
le mode se prend et se rend, un clic sélectionne, le menu montre ses douze lignes, « Aux
champs » change bien le métier **et** le poste, « Tenir une tour » donne un métier sans
poste, le cadre ramasse ce qu'il couvre, « Me suivre » colle les ancres sur le héros, et
*Rompez* les libère. **22/22 sur les graines 0, 1 et 2** — le monde est tiré au sort à chaque
lancement, donc trois passes.

**709 tests verts** (+6). **À regarder** : `captures/jeu/2026-09-21-bloc8-ordres/`.

#### La dette effacée au passage

Le panneau ORDRES affichait « toute l'équipe (0) » depuis le 5.5, où l'on joue un seul héros.
Il dit « personne » quand l'équipe IA est vide, et son compteur additionne les deux
populations.

### Le bloc 8 est fini — le héros au travail et le chantier (21 septembre 2026)

Les deux morceaux de gameplay qui restaient au bloc 8, après le mode commandement.

#### Un héros au travail (§4.4)

`Hero.travail` porte le métier qu'on lui a donné, et `ArenaScene.travaillerLesHeros()`
fait le reste. L'affectation **pose une ancre** sur le poste plutôt que de piloter le
héros à part : il garde toute son IA, il se défend, il revient à sa place — et il n'y a
pas une deuxième logique de déplacement à déboguer.

- Cadence : **celle du joueur à la main**, `degats / 8` par seconde. Rien de neuf à
  équilibrer, et le chiffre du §4.18 (~98/min contre 6/min) tombe juste.
- **Le jour seulement.** La nuit il lâche son poste, garde son affectation, la reprend à
  l'aube.
- Fatigue : `STRESS_DU_TRAVAIL = 2,2` point par minute, contre 0,1 pour un habitant.
- **Le repli des 20 % passe avant** — `piloter()` traite le repli en premier et ignore
  l'ancre, donc rien à écrire pour le garantir.
- Sa carte d'équipe dit « au travail », et l'affectation est **sauvegardée**
  (`EtatHeroSauve.travail`, optionnel : une vieille sauvegarde se recharge sans rien).

#### Le chantier qui occupe un bâtisseur (§4.20, §4.24 — le reste du 7b)

`Construction.chantierJusqua` (un horodatage) devient `travailRestant` (des
millisecondes de travail). `Constructions.avancerLesChantiers(batisseurs, delta)` remplace
`finirLesChantiers(maintenant)`.

- Sans charpentier, **l'échafaudage reste dressé indéfiniment**.
- **Un bâtisseur, un chantier** : un `Set` des chantiers déjà pris dans la passe empêche
  deux charpentiers de monter le même mur deux fois plus vite.
- Un ouvrage inachevé **bloque comme avant** mais ne tient que `PART_EN_CHANTIER = 0,3` de
  ses PV ; fini, il retrouve tout.
- Le charpentier va au chantier le plus proche : `ContexteVillage.chantierLePlusProche`,
  une fonction de plus dans le contexte — `village.ts` ne connaît toujours pas les
  constructions.
- **Une pause ne rend plus rien** : `decaler()` ne touche plus les chantiers, puisqu'ils ne
  comptent plus le temps qui passe.

#### Deux choses apprises en pilotant une partie

1. **Un villageois visé sur un point exact à côté d'un mur pousse contre la pierre
   indéfiniment.** Il avance en ligne droite, sans calcul de chemin (§4.17) : dès qu'un
   angle d'enceinte tombe entre lui et sa place, il n'« arrive » jamais. Il travaille
   donc **dès qu'il est à portée du chantier**. À retenir pour tout poste qui n'est pas
   en terrain libre.
2. **Une attente de test se mesure sur le pire cas, pas sur le cas moyen.** Deux « échecs »
   du script venaient de sa propre marge : le bâtisseur avait marché plus longtemps que
   prévu, et les 4 s de travail ne tenaient pas dans les 6 s d'attente. C'est le défaut du
   banc, pas du produit — la distinction a déjà coûté quatre fois au jalon 5.6.

#### Vérifié

`node .tmp/verifier-travail.mjs <graine>` : **11/11**, trois mondes. Il produit, la cadence
est celle d'un héros, le stress monte, la nuit il lâche son poste sans perdre son
affectation, *Rompez* le rend au combat.

`node .tmp/verifier-chantier.mjs <graine>` : **14/14**, sept mondes. Aucun échafaudage au
démarrage, un ouvrage inachevé à 36 PV sur 120, rien n'avance sans charpentier, deux
bâtisseurs sur le même mur ne vont pas deux fois plus vite, un par mur et les deux
avancent.

**709 tests verts**. **À regarder** : `captures/jeu/2026-09-21-bloc8-ordres/`
(`hero-au-travail`, `chantier-et-batisseur`).

### Le jalon 5.6 — les trouvailles de la route (21 septembre 2026)

**Le jalon 5.6 est fini**, dans l'ordre que le §4.31 imposait : les caches, le survivant, la
stèle. Il répond à un défaut que le 5.5 venait de **créer** : depuis que refuser un village
fait traverser jusqu'à sept mondes muets, le chemin optimal était la ligne droite et
l'errance un couloir qu'on subit.

#### Les caches

- **`src/core/caches.ts`** (pur, 21 tests) : `semerLesCaches`, `butinDUneCache`,
  `placeDeRoute`, `paroleDeLaStele` et `REGLAGES_CACHES`. **Sept par monde muet, trois par
  monde habité**, comptées par mégapixel et plafonnées à douze (§4.17, règle 1). Tirées de la
  graine du monde : même graine, mêmes caches, au pixel près.
- **Deux monnaies, deux destinations** — et c'est tout le sens du bloc. L'or entre dans la
  bourse et **traverse les mondes** ; la matière attend, et devient les réserves du jour où
  l'on s'installe. Mesuré sur 100 mondes (`.tmp/mesurer-caches.ts`) : **188 pièces** par monde
  entièrement fouillé, soit moins de quatre cargaisons de bois. La règle du §4.8 est devenue
  un test, comme pour le butin des morts.
- **La fouille prend 1,2 s** (décision d'Angelos), jauge au-dessus du héros, interrompue si
  l'on s'écarte de plus de quatorze pixels ou si l'on encaisse. C'est **ce qui donne sa dent
  au camp de bêtes** : une fouille instantanée se ferait sous leur nez sans rien risquer.
- **Le camp garde son terrain** : `Ennemi` gagne `campeSur` et `rayonDuCamp`, et dans
  `avancerEnnemi` le retour au camp passe **avant** la proie. On voit le camp de loin, on
  approche, on juge, on peut faire demi-tour.
- **`PanneauRoute`** : la bourse et le sac, au coin où le compteur du village ne sert pas
  encore. ⚠️ **Sans lui, tout le bloc était invisible** — l'or ne s'affiche nulle part
  ailleurs que sur le panneau du port, et le port n'existe pas quand on erre.

⚠️ **Les silhouettes ont demandé trois passes de Blender**, et c'est la leçon la plus
réutilisable du chantier :

1. **Tout ce qui est plat s'écrase** sous la caméra penchée à 55°. La trappe de cave, à ras du
   sol, se lisait comme un livre ouvert. Il lui faut une margelle qui **sort de terre** et un
   battant **dressé** (presque vertical : penché, il se couche sur le trou et le masque).
2. **Une bascule autour de X ne se voit pas** — c'est l'axe que la caméra regarde. Le premier
   jet de la charrette éventrée restait une caisse posée droite ; le deuxième, basculé autour
   de Y à 0,34 rad, la tordait et la faisait sortir du cadre de douze pixels. Ce qui marche
   est bien plus simple : **la roue détachée et dressée contre le flanc**. Un disque vertical
   à côté d'une caisse se reconnaît tout de suite.
3. **Un creux posé dans la matière est invisible.** La gravure de la stèle était à l'intérieur
   de la pierre ; elle doit **dépasser de trois centimètres devant la face**. Et une stèle
   faite de cônes à six pans rend un galet debout : il lui faut des **arêtes franches**.

#### Le survivant

- Son code ne change pas d'un iota (§4.18, bloc 6c2) : ce qui change, c'est **quand**.
  `creerSurvivantDeRoute` le pose à une place de route au lieu d'une lisière de bord.
- **Un monde sur trois** en porte un, et **rien ne l'annonce**. Celui du village appelle, et
  la discussion dit la direction ; celui-là, on le voit ou l'on passe à côté sans le savoir.
- **Sa fiche se joue là où on le trouve.** « Il te suit » suppose qu'on ait accepté de le
  prendre — et rejouer trois fiches à l'instant où le jour 1 se lève aurait enterré le seul
  moment fort du §4.29.
- **Il traverse les mondes**, trois au plus, et devient habitant à l'installation. La classe
  `Survivants` passe d'un survivant à une troupe, avec un plafond **décidé par l'appelant** :
  un en partie installée (§4.18), trois sur la route (§4.31).
- ⚠️ **Les mots de sa fiche ne collaient pas, et ça s'est vu en capture.** Trois des six axes
  d'observation parlent du village : « il est entré à l'église », « il ne connaît personne
  ici », « il s'est présenté en pleine nuit ». Or sur la route il n'y a ni église, ni
  habitants, ni nuit — le cycle est à l'arrêt tant qu'on marche. Ces trois axes et trois
  questions ont une **version de route**, et un test vérifie que la folie, les axes troubles
  et les questions tirées sont **identiques** : seuls les mots changent.

#### La stèle

- **Six traits écrits pour elle** (`traits.ts`, origine `stele`), chacun un marché.
  ⚠️ **Ils cassent la règle des 2 à 5 %** de ce fichier — ils pèsent 10 à 20 %, entre le
  trait et la séquelle. Le commentaire de la table dit les trois conditions qui l'autorisent,
  et qu'il faut les redescendre si l'une tombe.
- **On lit, puis on choisit** (décision d'Angelos). Passer son chemin ne consomme rien : la
  pierre reste et l'on peut revenir.
- **Le panneau est celui de la rencontre** (§4.29), avec titre et libellés paramétrables. Les
  deux scènes sont la même — quelque chose nous pose une question, et nous avons deux
  réponses. Deux panneaux auraient été une interface en double (§4.10).

#### Ce que les vérifications au navigateur ont trouvé

Trois scripts jetables, trois passes chacun : `.tmp/verifier-caches.ts` (15 contrôles),
`.tmp/verifier-survivant-route.ts` (8), `.tmp/verifier-stele.ts` (7). **Tous verts, aucune
erreur console.** Quatre pièges qui resserviront :

- ⚠️ **`camera.worldView` n'est recalculé qu'au rendu suivant.** Lu juste après `centerOn`,
  il rend le cadrage de l'image **précédente**, et le clic partait à cinq cents pixels de la
  cible. On lit `scrollX`/`scrollY`, que `centerOn` met à jour tout de suite.
- ⚠️ **La caméra est bornée par la carte.** Près d'un bord, `centerOn` est bridé et l'objet
  visé sort de l'écran : `removeBounds()` le temps du contrôle.
- ⚠️ **Pousser le héros « loin » le fait changer de monde.** `guetterLeDepart` voit le bord et
  quitte le monde — il ne restait évidemment plus une seule bête à mesurer. On s'écarte
  **vers l'intérieur**, en visant le point de départ de la marche.
- ⚠️ **En rendu logiciel, tout ce qui est minuté s'étire d'un facteur quatre.** Le survivant
  avance bien à 78 px/s (0,72 × la vitesse du héros) mais n'en couvre qu'un quart à l'horloge
  du script. On mesure donc **l'écart et la vélocité**, jamais la distance parcourue.

**À regarder** : `captures/planches/2026-09-21/caches-x6.png` (les quatre silhouettes et deux
témoins du décor déjà validé), `captures/jeu/2026-09-21-caches/`,
`captures/jeu/2026-09-21-survivant-route/`, `captures/jeu/2026-09-21-stele/`.

**703 tests verts** (+28).

### La zone qui se ferme, et la presqu'île (20 septembre 2026, dans la nuit)

Les deux derniers morceaux du jalon 5.5 **en dehors de l'errance continue**.

**La zone jouable est posée.** `TAILLE_JOUABLE` (2828 × 2121, ×2) existait depuis la veille
et n'était appliquée nulle part : une partie commence maintenant dessus.

- **Elle voyage dans la sauvegarde** (`zone`). Une partie d'avant ce jour a été jouée sur la
  taille classique et doit la retrouver : **la même graine sur une autre zone rend un autre
  monde**, donc un village ailleurs et une sauvegarde qui ne colle plus à sa carte.
- **Ce que ça coûte, mesuré dans le navigateur** (`.tmp/mesurer-entree.ts`) : une partie
  s'ouvre en **2,4 à 2,9 s** à ×2, contre **0,6 s** sur la carte classique (headless, GL
  logiciel — une vraie machine fera mieux). ⚠️ **C'est le prix du refus** : refuser un village
  tire un monde neuf, donc repeint la carte. La dette notée la veille est maintenant chiffrée.
- **La marche s'allonge** : 2 174 px au lieu de 1 200 à 1 800, soit une trentaine de secondes.
  (Le §6 demandait alors « deux à trois minutes » ; ce chiffre a été rectifié dans la nuit —
  il était impossible sur une carte finie.)

**La presqu'île existe.** Sur 120 graines, aucun monde n'avait un seul front ; le §4.29 en
fait pourtant le plus gros cadeau du jeu.

- **La mer prend un second bord, adjacent** (`golfe`), et **la chaîne ferme le troisième** :
  il ne reste qu'un front. `mer` et `montagne` n'étaient lus que dans `monde.ts` — le dessin
  passe par `distanceALEau`, donc le rivage, l'écume et la houle ont suivi sans une ligne.
- **9 mondes sur 100 à ×2** (mesuré, `.tmp/mesurer-fronts.ts`), pour **deux tentatives sur
  cinq** : la plupart des presqu'îles sont refusées plus bas, faute de place pour le village
  et ses quatre postes une fois trois côtés fermés. ⚠️ **Le taux dépend de la taille de la
  zone** — 33 % à ×1, où la plupart des autres formes ne tiennent pas. C'est la zone jouable
  qui fait foi, et le test mesure là.
- **Le budget la paie déjà** : un seul front vaut +30 points, le plus gros cadeau de la table.

**Et une correction venue de la capture, pas du test** : à ×2, la carte était **vide** — un
lac et un bosquet qui remplissaient 2000 × 1500 laissaient une plaine verte de 2828 × 2121.
Tout ce qui se sème se compte donc en **parts de la carte classique** (`aLEchelle`). Les
lacs en trop sont un bonus : un monde qui n'a pas la place pour eux reste un monde.

`scripts/capturer-mondes.ts` **lit la taille du monde** au lieu de la supposer : son cadrage
écrit en dur ne montrait plus que le quart nord-ouest.

**Vérifié dans le navigateur** : la marche (19 contrôles), le peuplement (36) et le budget
(22) repassent tous à ×2.

**À regarder** : `captures/jeu/2026-09-20-presquile/` (trois presqu'îles, monde entier,
village et porte).

**666 tests verts** (+2).

### Le bloc 7b — la forteresse (fait le 20 septembre 2026)

**Portes, pierre, douves, pont-levis**, sur les décisions d'Angelos du matin (ouverture en
2 s, fermeture à la cloche quand plus personne n'est dehors, ouverture automatique devant
quelqu'un si aucun monstre n'est près, refus d'un mur qui fermerait sans porte, dessin ouvert
et fermé, puis la pierre de la mine, les douves, le pont-levis). Tout est écrit au §4.20
(encadré ✅ et section « Codé le 20 septembre 2026 »).

- **`src/core/portes.ts`** (pur, 14 tests) : le **battant** — quatre phases, 2 s dans chaque
  sens, reprise d'où il en est si on le rouvre en pleine fermeture, pas de minuterie ; la
  **consigne de nuit** (ouvrir devant quelqu'un sans menace, refermer après 2,5 s ou dès
  qu'une menace approche) ; et **l'enceinte close** : une propagation depuis le bord de la
  carte, qui compte ce qu'on atteint à pied avec et sans la case visée — si des cases se
  perdent, le mur ferme sans porte (les portes comptent comme des passages).
- **La cloche** ne ferme plus à la seconde : la scène garde « la cloche a sonné » et ferme
  quand `village.dehors` est vide (à leur poste, en route, en fuite — les défenseurs de
  l'église et les réfugiés sont « rentrés »). Annonce « Les portes se fermeront quand tout le
  monde sera rentré », puis « Tout le monde est rentré — les portes se ferment ».
- **Le refus** à la pose : « Ça fermerait l'enceinte sans porte : pose une porte (K) ici »,
  fantôme rouge, mémoïsé par case (le fantôme demande à chaque image). ⚠️ Le §4.20 voulait
  **convertir** le mur en porte ; Angelos a dit **refus** le 20 septembre, le paragraphe est
  réécrit. Le déplacement d'un mur suit la même règle.
- **La pierre** : ressource de plus (`pierre`), sous-produit du mineur (1 pour 2 minerais),
  aussi quand le héros pioche ; 8 unités la pièce au port ; palier de pierre en vente
  (160 pierre + 40 minerai le mur, 240 + 60 la porte).
- **La douve** (`N`) : construction indestructible, à plat, 16 raccords × 3 états (sèche, eau,
  sous un pont) ; sèche elle ralentit monstres et héros à 35 % (les habitants non) ; en eau
  elle bloque (corps statique, monstres détournés vers la porte la plus proche, un regard une
  case devant). Remplie depuis la mer ou de proche en proche (12 bois).
- **Le pont-levis** : une porte qui a une douve en eau dans son axe ; `K` dessus (80 bois +
  30 minerai). Le tablier se lève (fermé), se couche sur la douve (ouvert, la douve devient
  passante) ; dessin des chaînes et des trois positions dans les deux sens.
- **Le dessin** : porte **entrouverte** (les vantaux à mi-course, le sol visible au milieu),
  pont-levis levé / à mi-course / baissé, douve en terre retournée, eau du monde, planches.
  Textures cuites : 48 murs, 18 portes, 18 ponts-levis, 48 douves.
- **Sauvegarde** : `eau`, `pontLevis`, `portesFermees`, `pierre` (tous optionnels, une partie
  d'avant repart avec des portes ouvertes et zéro pierre).
- **Vérifié** par `scripts/verifier-forteresse.ts` (9 vérifications, aucune erreur console) :
  refus puis acceptation avec porte, fer → pierre, cloche → attente → fermeture en 2 s,
  ouverture devant le héros seule, refermeture après l'attente (chronologie échantillonnée),
  porte close sous menace puis réouverture, douve sèche à 35 % (héros compris), eau depuis
  la mer puis de proche en proche, pont-levis baissé / levé, sauvegarde. Captures :
  `captures/jeu/2026-09-20-forteresse/` ; planches : `captures/planches/2026-09-20-forteresse/`.

**Ce qui reste du 7b** : « une personne par seconde » (laissé à la physique) ; les habitants
ne sont pas ralentis par une douve sèche ; le chantier qui occupe un bâtisseur (bloc 8).
**À juger en jouant** : les 44 px de demande et les 160 px de menace, les 2,5 s d'attente, les
prix de la pierre, de la douve et du pont-levis.

### L'eau qui noie (fait le 19 septembre 2026, au soir)

**Le dernier reste du bloc 7z** (§4.30, tranché le 9 septembre : « on s'enfonce, une bulle
prévient, on se noie au bout de 3 secondes »). `src/core/eau.ts` (neuf, pur, 5 tests) :
`profondeurDe(terrain)` (sec, haut-fond, mer, abysse), `REGLAGES_EAU` (vitesse 1 / 0,6 /
0,35, enfoncement 0 / 14 % / 40 % de la hauteur, seconde bulle à 2 s, noyade à 3 s) et
`Noyade`, l'horloge qui rend « coule » à la première image en mer, « se-noie » à 2 s, « noye »
à 3 s et repart de zéro dès qu'on ressort.

**Dans le jeu** : `Hero.facteurEau` entre dans `vitesse`, `Hero.enfoncer(part)` rogne l'image
par le bas (`setCrop`, la hitbox ne bouge pas). **Seul le héros incarné entre dans l'eau** :
`ouvrirLaMerAuHero` lui donne des limites physiques étendues jusqu'au bord ouest
(`Body.setBoundsRectangle`) ; on les lui retire quand on change de héros (`quitterLEau`), et
les limites du monde le ramènent sur la plage. `majEau` à chaque image hors pause : l'abysse
rejette (retour à la dernière position tenable), la profondeur règle vitesse et enfoncement,
les bulles sont des textes flottants dans la voix du héros plus une ligne de journal, et la
noyade passe par `tomber` — la Résurrection de l'Oracle peut donc encore sauver un noyé, comme
n'importe quelle chute.

**Vérifié en jouant** (`npx tsx scripts/verifier-eau.ts`, Playwright, aucune erreur
console) : au sec rien ; sur le haut-fond 60 %, image rognée, pas de noyade en 3,6 s ; en mer
35 % et la bulle tout de suite ; ressorti à 2,5 s, vivant et l'horloge repartie ; l'abysse
rejette ; 3,6 s de mer et le héros s'est noyé, le journal le dit, le suivant est incarné.
Captures `captures/jeu/2026-09-19-eau/{haut-fond,mer}.png`. **529 tests verts** (+5).

⚠️ **Ce qui reste du §4.30 sur l'eau** : « on pêche depuis le port, et uniquement de là » —
le poste de pêche sur la plage existe toujours (`POSTES`, `plage`). Et un projectile qui
toucherait un héros dans l'eau le ferait tomber avec l'image rognée : `tomber` remet l'image
entière avant l'animation de mort seulement pour le noyé.

### Le son, phase 2 — les planches d'écoute des bruits (fait le 20 septembre 2026, au petit matin)

**Les décisions d'Angelos, avant de chercher** : une **planche d'écoute par bruit** (il choisit,
puis on branche tout d'un coup) ; **tout en enregistrements libres**, rien de fabriqué ; le jour,
les bruits **s'atténuent avec la distance à la caméra, un coup sur deux, huit voix au plus** ;
**aucun cri avant le jalon 6.7** (ni hurlement de horde, ni Cri du Chevalier).

**`npm run bruits`** (`scripts/son/bruits.ts`, neuf) : pour chacun des **treize événements nommés**
que les animations portent déjà (`four.ts` : pioche, hache, semis, ligne, enclume, maillet, pas,
toux, lame, tir, sort, morsure, chute), **deux à quatre candidats CC0** — trente-huit en tout,
d'OpenGameArt et des packs Kenney *Impact Sounds* et *RPG Audio* —, rognés du silence et ramenés
à la même crête (−6 dB), dans un fichier par événement : le numéro en bips, puis le bruit deux
fois. Chaque candidat existe aussi seul (`<événement>-<n>.mp3`), pour la **page `ecoute.html`**
posée à côté : un bloc par événement avec le moment où le jeu le jouera, une flèche qui joue le
candidat, une case « aucun », un champ de précision, et le **récapitulatif qui s'écrit tout
seul** en bas, à coller dans la conversation (choix gardés dans le navigateur). La page est un
fichier local et pas un artefact : les sons sont sur le disque, une page hébergée ne pourrait
pas les jouer. `LISEZMOI.md` reprend la table et les sources. Tout est dans
`captures/son/2026-09-20-bruits/`.

**Les sources** : recherche avancée d'OpenGameArt filtrée *Sound Effect + CC0*, onze secondes
entre deux requêtes (`Crawl-delay: 10`), la licence relue sur chaque page. Écartés :
« Fisheefects » (CC-BY), « Battle Sound Effects » (CC-BY), « Breaking Rock » (dérivé d'un son
Freesound à la licence inconnue). Le téléchargement est **partagé** avec l'écran-titre
(`scripts/son/sources.ts`, sorti d'`intro.ts`). Les découpes des fichiers longs (la toux, l'enclume
qui sonne deux secondes, la créature qui grogne dix secondes) ont été choisies **sur mesures**
(éclats au-dessus de −30 dB sous la crête), pas à l'oreille.

**Le branchement est fait, sans attendre les choix** (`src/game/bruits.ts`, neuf) : la scène
écoute tout sprite animé qui entre (`ADDED_TO_SCENE`, monstres recyclés compris) et, à chaque
changement de frame, compare la frame à la frame clé de l'événement (`EVENEMENTS` de `four.ts` ;
⚠️ `frame.index` de Phaser compte à partir de 1, `frameCle` à partir de 0). Puis les trois
règles : **un coup sur deux** pour les sept bruits de travail (pioche, hache, semis, ligne,
enclume, maillet, pas), les autres à chaque fois ; **atténuation par la distance au centre de la
caméra** (au carré, rien au-delà de 0,6 diagonale) et un léger panoramique selon le côté ;
**huit voix au plus**, tenues par leurs instants de fin comparés à l'horloge, sans minuterie
(§4.17 règle 4) ; 60 ms au moins entre deux fois le même bruit ; vitesse tirée entre 0,94 et
1,06 pour que deux coups ne soient jamais identiques. `son.ts` a gagné `pan` et `vitesse`. Les
fichiers sont **optionnels** (`src/assets/son/bruit-<événement>.ogg|mp3`, ramassés par un glob
comme les PNG) : sans fichier, l'événement reste muet. **Mesuré** (Playwright, graine 1,
14 s de jour) : dix sprites animés, dix écouteurs, neuf demandes « pioche » et neuf « ligne »
pendant que le mineur et le pêcheur travaillent, aucune erreur console.

**Angelos a choisi le matin même** (« pioche 1, hache 2, semis 2, ligne 2, enclume 1, maillet 1,
pas 1, toux 1, lame 3, tir 2, morsure 4, chute 1 ») : les douze sont dans `CHOIX` et **livrés**
par `npm run bruits -- --livrer` (`src/assets/son/bruit-<événement>.ogg|mp3`,
`CREDITS-BRUITS.md`). **Vérifié dans le jeu** (Playwright, un clic pour déverrouiller le son) :
douze bruits chargés, neuf demandes « pioche » donnent cinq voix, huit « ligne » en donnent
quatre — un sur deux, comme voulu. **Le sort n'a pas plu** (« faudrait un truc boule de feu ou
incantation ») : les trois « magical » sont retirés et une **deuxième planche `sort.mp3`** attend
avec cinq candidats — une boule de feu (Julien Matthey, relayée en CC0 par diligentcircle sur
OpenGameArt), une flambée synthétique, une incantation de terre, une de glace, un
scintillement. ⚠️ Reste à juger à l'oreille la densité (un sur deux, huit voix) sur une vraie
journée.

### Les derniers détails de vie (fait le 20 septembre 2026, au petit matin)

**Les cordes à linge et les filets qui sèchent** (§4.24), les deux objets qui manquaient au
sol du village. Deux objets de plus dans l'atelier Blender (`scripts/blender/monde.py` :
`corde_a_linge`, `filets`), une matière de plus exportée pour Blender (`tissu`, le linge
sombre des villageois), tailles dans `rendre.py` et `decor.ts` avec un dessin de secours,
rendus par `npm run sprites -- decor-corde-a-linge decor-filets`. **Jugés sur planche
agrandie** (`captures/planches/2026-09-20-details-de-vie/`) en trois passes : quatre pièces
de linge qui se touchaient faisaient une bande, ramenées à trois avec la corde à nu entre
deux ; un filet en quadrillage droit se lisait comme une claie, refait en **mailles en
losange** (un treillis de nœuds bousculés reliés en diagonale), pendu de la traverse avec un
bord bas inégal et des flotteurs clairs.

**Posés par `poserLesDetailsDeVie`** : une corde devant **chaque maison debout**, une case de
large juste sous l'emprise, près de la porte puis décalée vers un coin si un détail gêne, dans
la place ou sa marge (les maisons du sud ont la lisière sous elles, pas la place) ; des filets
**au poste de pêche** et **contre le port**, sur le sable, à plus d'une case du point où l'on
travaille, jamais sur la rue, cherchés par distance croissante parce que la bande de sable
libre est étroite (au port, une case entre le bâtiment et l'eau, souvent prise par les
ruines : la graine 1 n'en a pas, les graines 7 et 42 oui). **Un registre des poses avec un
rayon par objet** : deux détails ne se chevauchent plus (le linge mordait sur la charrette
et sur le puits, vu sur capture). Les filets sont ce qui devait remplacer les ronds de poste
pour la pêche ; restent la mine et les bûches. Captures
`captures/jeu/2026-09-20-details-de-vie/graine-{1,7,42}-{loin,plage,maisons}.png`
(`npx tsx scripts/capturer-details.ts 1,7,42 <dossier>`). Toujours du décor : rien de
sauvé, on bâtit dessus, une maison relevée plus tard n'a pas de linge.

⚠️ **« Le feu » de la liste n'était pas un détail de vie** : Angelos parlait de
l'**incendie**, le système du jalon 6 (§4.21). Il n'est pas codé, et ses règles sont
tranchées ce jour (voir « Tranché le 20 septembre 2026 » au §4.21). **544 tests verts** (les
deux dessins de secours passent par le test du décor, les deux PNG par celui des sprites
Blender), `tsc` passe.

### Les chemins qui s'usent (fait le 20 septembre 2026, après minuit)

**Le dernier reste du sol du village qui était un système, pas un dessin** (§4.24, tranché
le 9 septembre : « visibles à 30 passages, effacés après 4 journées sans passage »).
`src/core/chemins.ts` (neuf, pur, 9 tests) : `Chemins.passer(marcheur, x, y, jour)` compte
**un passage quand un marcheur entre dans une case** — piétiner sur place n'use rien —,
et rend la case à redessiner au trentième passage puis tous les 30 ; `seLever(jour)` fait
pâlir tout ce qui est visible et efface ce qui a été oublié 4 journées ; `usureDe` va de 0,4
(30 passages) à 1 (150), multipliée par la fraîcheur (1 − journées d'oubli / 4). Le centre
du chemin est **la moyenne des trente premiers pas**, figée : il se dessine là où l'on marche
vraiment, pas au milieu de la case. Jamais sur l'eau, la roche ni la place (déjà en terre
battue), qui est exclue à la création. **Sauvé** (`chemins?` dans la sauvegarde, optionnel :
une partie d'avant repart de l'herbe) et repris avec redessin complet.

**Dans le jeu** : `majChemins` par **battements de 250 ms**, pour chaque habitant vivant
hors de l'église et chaque héros vivant. `src/game/dessin/chemins.ts` : **une couche à part**,
une texture canevas transparente de la taille du monde posée juste au-dessus de la carte
(profondeur −999). ⚠️ **Pas dans la carte cuite, contrairement aux rues** : effacer un chemin
demande de savoir ce qu'il y avait dessous, et dessous il y a la rue, la place, puis chaque
brûlure et chaque cratère de la partie ; une couche transparente s'efface en rendant ses
pixels transparents. `peindreLePas` (pure, 6 tests) peint un pas rond au bord tremblant,
usé par plaques, dont les bruits se lisent **en coordonnées du monde** (deux redessins qui
se chevauchent donnent les mêmes pixels, sans couture) ; deux pas qui se recouvrent gardent
**le plus opaque**, pas la somme. Un pas changé redessine sa zone et ses voisines ; l'aube et
la reprise redessinent tout d'un coup ; un seul `refresh()` par image, comme `abimerLeSol`.

**Vérifié en jouant** (`npx tsx scripts/verifier-chemins.ts [dossier]`, Playwright, aucune
erreur console) : la couche est vide au départ et les pas des habitants qui partent au travail
se comptent en 6 s ; quarante allers-retours forcés de l'église aux quatre lieux de travail
donnent 29 cases visibles, peintes et présentes dans la sauvegarde ; deux aubes d'oubli font
pâlir sans rien effacer ; la quatrième efface tout (0 pixel peint). Captures
`captures/jeu/2026-09-20-chemins/chemins-{loin,pres,palis}.png`. **Jugé sur capture** : le
chemin se lit comme une bande de terre sèche, un peu poudreuse, dans la matière des rues ;
le fondu du bord a été resserré (0,34 → 0,24) parce qu'il se lisait comme une fumée. ⚠️ Dans
les captures, la ligne forcée traverse l'enceinte : c'est le script qui marche tout droit,
pas les habitants, qui passent par les portes. **544 tests verts** (+15), `tsc` passe.

⚠️ **Ce qu'il reste** : les monstres n'usent rien (voulu : « là où les habitants passent ») ;
le seuil de 30 n'a jamais été atteint en jouant, seulement forcé — à mesurer sur une vraie
partie (3 à 5 habitants sur un même trajet, deux passages par jour chacun, font 3 à 5
journées avant le premier chemin).

### Le sol du village (fait le 19 septembre 2026, au soir)

**La place en terre battue, les rues et le parvis pavé** (§4.24), peints **dans la carte
cuite** une fois par partie, comme un dégât — aucun objet, aucun coût par image.
`core/village.ts` expose `place` (les cases de la place, bord compris) et
`tracerLesRues(plan, église, cibles)` : une rue de l'église à chaque lieu (plage, mine,
forêt, champs, port), par une porte quand un mur barre la ligne, directe sinon (le flanc
ouvert sur la mer). `dessin/carte.ts` garde la **carte vierge** en mémoire (12 Mo) et
`dessinerLeSolDuVillage` repart d'elle à chaque partie — la place, les brûlures et les
cratères de la partie d'avant s'en vont avec elle, ce qui était un défaut silencieux du `R`
—, puis `peindreLeSolDuVillage` (pure, 4 tests) peint trois couches : la place (terre
marbrée, bord qui tremble de ±8 px, usée par plaques), les rues (une bande de 12 px, un peu
plus claire), le parvis (pavés de 6 px, joints sombres, d'autant plus de pavés manquants
qu'on s'éloigne de l'église). La terre prend la clarté du pixel qu'elle recouvre : **le
relief se voit encore**. Jamais sur l'eau ni la roche.

⚠️ **Jugé sur capture, en deux passes** : au premier jet, un parvis de 60 px était une dalle
grise qui mangeait le tiers du village ; ramené à 44 px, pierre teintée de terre, usé vers
le bord. Captures `captures/jeu/2026-09-19-sol-du-village/graine-{1,7,42}-{loin,pres}.png`
(`npx tsx scripts/capturer-villages.ts 1,7,42 <dossier>`). **Les détails de vie** sont venus dans
la foulée : quatre objets de plus dans l'atelier Blender (`scripts/blender/monde.py` :
`puits`, `tonneau`, `tas_de_bois`, `charrette` ; tailles dans `rendre.py` et `decor.ts`,
avec un dessin de secours), rendus par `npm run sprites -- decor-puits decor-tonneau
decor-tas-de-bois decor-charrette`, et posés par `poserLesDetailsDeVie` : le puits à trois
cases de l'église dans la première direction libre, des tonneaux à droite et du bois à gauche
des maisons debout (pas toutes), une charrette en retrait de la première rue qui sort par une
porte — jamais sur une rue, jamais sur une case prise, tirés de la graine du village. Jugés
sur planche agrandie : les roues de la charrette, en bois comme la caisse, se fondaient
dedans — passées en écorce. ⚠️ **Du décor, pas des objets** : ils ne suivent pas une maison
qu'on déplace ou démolit, on peut bâtir dessus, rien n'est sauvé. Les chemins qui s'usent
sont venus le 20 septembre, les cordes à linge et les filets le même jour au petit matin
(voir leurs sections).

**524 tests verts** (+6), `tsc` passe.

### Les restes du dépouillage du 9 septembre (fait le 19 septembre 2026, au soir)

**Les décisions d'Angelos, avant de coder** : sous 65 habitants les hordes de jour restent ce
qu'elles sont, au-delà elles ne s'arrêtent plus ; la forme des villages générés ne bouge pas
avec la règle des deux cases ; le mur garde ses **12 bois** joués ; la porte monte au fer comme
le mur ; la pierre attend sa ressource (bloc 7b) ; et quand un héros a ses quatre actives, on
**achète un emplacement**, on **fusionne** (§4.25, plus tard) ou on **remplace**.

- **Deux cases** (`CASES_LIBRES_AUTOUR_DES_BATIMENTS = 2`, §4.24) : la règle de pose du joueur
  seulement ; `core/village.ts` garde ses 5 cases d'enceinte, le commentaire dit pourquoi.
- **Les paliers de mur** (§4.20) : `core/constructions.ts` porte `Matiere`, `Palier` et la
  table `paliers` du mur (120 / 500 / 2000 PV ; fer 60 bois + 25 minerai) et de la porte
  (160 / 660 / 2660 ; fer 100 bois + 40 minerai) ; `amelioration()` ne vend que ce qui a un
  prix — la pierre est dans la table, `cout: null`. `palierDe`, `coutCumule` ; réparation et
  remboursement prennent la matière. Côté jeu, `Construction.pvMax` lit le palier,
  `Constructions.ameliorer` remet le segment à neuf avec le chantier visible, et **l'outil
  palissade ou porte cliqué sur un segment existant le renforce** (`batirIci`) ; le survol dit
  le palier et le prix. La matière est sauvée (`EtatConstruction.matiere`, optionnelle : une
  partie d'avant est en bois). Le dessin des trois matières existait déjà (`dessin/murs.ts`).
- **Le seuil de 65** (§4.18) : `villageAttire(population)` et `delaiProchaineHorde(tirage,
  attire)` dans `core/cycle.ts` — 20 à 40 s entre deux hordes au lieu de 2 à 4 min ;
  `programmerHorde` le lit à chaque horde et le guet l'annonce au passage du seuil.
- **Quatre actives** (§4.13) : `core/competences.ts` — `EMPLACEMENTS_ACTIFS` (4, jusqu'à 6 en
  achetant : 150 puis 400 pièces), `demandeUnePlace`, `propositionsDeRemplacement`. Dans la
  scène, un mode de choix `remplacement` : la cinquième active tirée ouvre « PLUS DE PLACE »
  sur l'écran de choix existant (jusqu'à cinq cartes, qui se serrent), oublier ou acheter,
  puis la compétence s'apprend comme d'habitude. `Hero.emplacements` est sauvé (optionnel) ;
  `Hero.oublier` perd les paliers et efface la teinte d'une évolution. Les touches 6 et 7
  servent les emplacements achetés. La fusion attend le jalon 6.5.
- **Totem → Relique** : rien dans le code, le mot n'y était pas. Rayé.

⚠️ **Ce que ça ne fait pas encore** : le chantier d'un renfort n'occupe pas de bâtisseur
(bloc 8) ; oublier une active laisse ce que ses paliers avaient pu ajouter aux bonus (rare) ;
un villageois qui se bat seul n'appelle pas la musique de guerre (voulu).

**Vérifié en jouant** (`npx tsx scripts/verifier-depouillage.ts`, Playwright, aucune erreur
console) : à deux cases d'un bâtiment on refuse, à trois on peut ; un segment passé au fer
montre d'abord son chantier, puis `bati-mur-fer-*`, 500 PV, 60 bois et 25 minerai débités, et
la pierre est refusée avec le bon message ; une porte passée au fer (660 PV) se ferme à la
cloche (`bati-porte-fer-…-fermee`) et se rouvre ; à 70 habitants la prochaine horde tombe
entre 20 et 40 s et le guet le dit, à 3 elle retombe à plus de deux minutes ; quatre actives
apprises, la cinquième ouvre « PLUS DE PLACE », on oublie la première sans argent, puis on
achète le cinquième emplacement (150 pièces) quand on en a. Captures dans
`captures/jeu/2026-09-19-restes-depouillage/` (`mur-fer.png`, `plus-de-place.png`). **518
tests verts** (+14), `tsc` passe.

### La musique en partie (fait le 19 septembre 2026, au soir)

**Les décisions d'Angelos, avant de coder** : la musique calme est la **n° 2, « Lament for a
Warrior's Soul »** (RandomMind, CC0), choisie à l'oreille parmi les trois de
`captures/son/2026-09-19-musiques/` ; la guerre joue **toute la nuit** et le jour **dès qu'un
héros se bat** ; et surtout **jamais de bascule brutale** entre les deux. Détail au §4.10,
« Le son », dernier paragraphe.

**`src/core/musique.ts`** (neuf, pur, 6 tests) : la règle. `ChoixDeMusique` tient une horloge
que la scène fait avancer **hors pause seulement**, et l'instant du dernier coup donné ou reçu
par un héros ; `morceau(nuit)` répond « guerre » la nuit ou dans les **15 s** qui suivent un
coup (`REGLAGES_MUSIQUE.maintien` — un combat haché reste une seule bataille), « calme »
sinon. Chaque morceau a **sa vitesse de fondu** : la guerre monte et descend en 3 s, le calme
en 6 s.

**`src/game/musique.ts`** (neuf) : `MORCEAUX` (les deux fichiers et leurs boucles, que
`intro.ts` réutilise pour le titre) et `Musique`, qui joue ce que la règle dit avec `son.ts` :
un fondu enchaîné **à puissance constante** (sinus à la montée, cosinus à la descente — deux
rampes droites creusent 6 dB au milieu). La guerre appelée par la nuit **part de son début**,
son intro monte pendant que le jour tombe ; appelée par un combat de jour elle **part au corps
du morceau**, ses dix premières secondes étant 8 à 10 dB sous le reste (mesuré). Si le fichier
n'est pas encore là ou le son verrouillé, ce qui joue continue et on réessaie à l'image
suivante. `son.ts` gagne `depuis` (un départ dans le fichier) et `courbe: "puissance"`, avec
`cancelAndHoldAtTime` pour un arrêt propre au milieu d'une montée.

**Dans la scène** : `preload` charge les deux musiques si le titre n'a pas eu le temps (il
charge maintenant la calme pendant le film, avec la guerre) ; `maj` à chaque image hors pause ;
`combat()` dans `blesserEnnemi` (un héros ou son invocation frappe) et dans `encaisser` (un
héros est frappé) ; tout s'éteint en 4 s à la fin de partie, en 0,3 s quand la scène s'arrête
(une voix Web Audio ne meurt pas avec la scène). En pause hors focus, Phaser suspend le
contexte audio : la musique aussi.

**`npm run son`** livre `musique-calme` (couture à 63,9 → 114,5 s, ressemblance 0,69, fondu
de 4 s) et fabrique trois **fichiers d'écoute des fondus** dans
`captures/son/2026-09-19-musiques/` : `partie-jour-un-combat.mp3` (calme → guerre au corps →
calme), `partie-crepuscule.mp3` (calme → guerre depuis son début : ce que le jeu fait) et
`partie-crepuscule-sans-intro.mp3` (la variante — une ligne à changer dans `game/musique.ts`,
`depuis`, si elle plaît mieux). ⚠️ **Mesuré, pas écouté** : niveaux par tranche de 2 s — le
fondu du combat de jour ne creuse rien ; au crépuscule, l'intro de la guerre est 8 dB plus
basse pendant 4 s, et c'est à l'oreille d'Angelos de dire si c'est une montée ou un trou.

⚠️ **Pièges** : l'encodeur Vorbis tire un numéro de série à chaque passage, donc `npm run son`
marque **tous** les `.ogg` modifiés sans que le son change — on remet ceux qui n'ont pas
changé avec `git checkout`. Un villageois qui se bat seul (les portes, l'église) ne réveille
pas la guerre : c'est un héros qui compte, comme demandé. Et `scripts/verifier-musique.ts`
(Playwright) lit l'état de la musique à chaque étape, faute d'oreille.

**Vérifié en jouant** (`npx tsx scripts/verifier-musique.ts`, Playwright, autoplay permis et
un clic pour déverrouiller, aucune erreur console) : le premier matin joue le calme, une voix
Web Audio bien lancée ; un coup → guerre ; 10 s après, la guerre tient ; 16 s après, le calme
est revenu ; la nuit tombée → guerre sans un coup ; une aube qui tombe 0,8 s après, au milieu
de la montée de la guerre → calme, sans erreur (l'arrêt au milieu d'un fondu). **504 tests
verts** (+6), `tsc` passe.

### Le bloc 7a, seconde moitié — les maisons se cassent, le village démarre en ruines (fait le 19 septembre 2026)

**Les décisions d'Angelos, avant de coder** : trois maisons debout au départ, les plus près de
l'église ; **tout se démolit sauf l'église**, pour modeler son village comme on veut (donc pas
de ruine qui se relève toute seule : c'est le joueur, avec `L`) ; les monstres **visent les
maisons exprès** ; la ruine en **low-poly Blender**. Détail au §4.24, dernière section.

**`src/game/maisons.ts`** (neuf) : le parc des maisons, même forme que `Champs` et
`Constructions`. Une `Maison` est une image physique statique de 2 × 2 cases, coin haut-gauche,
200 PV, debout ou en ruine. Le parc tient la grille : `maison` debout, **`decombres`** tombée —
occupation neuve, non bloquante, sur laquelle on ne bâtit qu'une maison. `batir` (20 bois, sur
quatre cases libres, ou sur une ruine pour la relever), `demolir` (la moitié de ce qui tient,
rien pour une ruine, les cases redeviennent libres), `deplacer` (gratuit, PV gardés, une ruine
aussi), `blesser` → `tomber`. Le plan (`core/village.ts`) porte `debout` : les trois plus près
de l'église (`MAISONS_DEBOUT_AU_DEPART`), testé.

**Dans la scène** : `Maisons` remplace `poserLesMaisons` ; colliders avec les monstres
(`cognerMaison`, brûlure au sol quand elle tombe), l'équipe et les habitants ; **40 % des
monstres sont des pillards** (`PART_DE_PILLARDS`, `Ennemi.cibleMaison`) et prennent la maison
debout la plus proche pour cap, puis la suivante, puis l'église ; touche `L` ; en aménagement,
le clic droit démolit aussi une maison ou ses décombres, le clic gauche les prend et les
repose, le fantôme se cale sur la case visée coin haut-gauche. **Sauvegarde** : `maisons`
(optionnel : une partie d'avant reprend celles du plan), reprises à la construction du village.

**Le survol** (§4.24) : un seul objet Texte, `majSurvol` sur le mouvement de la souris — maison
(PV, ou « en ruine — L pour la relever »), mur / tour / porte (PV), église (niveau, PV, ou « à
terre — Y »), port.

**Les quatre défauts du 11 août, corrigés** : toute pause gèle aussi les animations
(`anims.pauseAll` derrière chaque `physics.pause`) ; toute touche hors G/H/J/K/L lâche l'outil
de construction (`lacherLOutil`, la cloche comprise) ; le clic droit démolit à une demi-case ;
les maisons se déplacent — l'église et le port restent fixes (§4.29).

**Blender** : `monde.maison_ruine` (dalle, pignon cassé, murs à moitié, poteaux et poutres
calcinés en `fer`, ardoises tombées, gravats), clé `bati-maison-ruine`, 56 × 50. `npm run
sprites -- bati-maison-ruine`.

**Vérifié en jouant** (Playwright, graine 42, aucune erreur console) : 3 debout / 12 ; survol
d'une ruine ; `M` + `L` + clic sur une ruine → 4 debout, 20 bois payés ; clic droit sur une
maison → 11 maisons, 10 bois rendus ; une ruine prise et reposée sur la place libérée ; clic
droit dans le vide → rien ; survol maison « 200/200 » et église « niveau 1 — 1200 PV » ; sur 20
monstres surgis, 9 visent une maison. Captures dans `captures/jeu/2026-09-19-bloc-7a-maisons/`.
**498 tests verts**, `tsc` passe.

⚠️ **Ce qui n'est pas fait du 7a** : le sol du village (place en terre battue, chemins,
détails de vie) — purement visuel, à couper si ça dérape. Et **un habitant sans toit ne
bloque rien** : il n'y a pas encore de naissances à bloquer.

### Le générateur de villages par graine (fait le 18 septembre 2026)

**La demande d'Angelos** : « commence par me faire valider le nouveau design des murs en me
montrant 3 ou 4 villages générés aléatoirement, puis on règle les soucis visuels, ensuite tu
codes tout ». Le générateur est donc codé d'abord, pour produire les captures ; ce qui reste
à trancher, c'est le dessin des murs.

**`src/core/village.ts`** (neuf, pur, 12 tests) : `genererVillage(grille, graine, EGLISE)` rend
un **plan** — l'enceinte case par case (palissade, tour, porte, ruine), les maisons (coin
haut-gauche de l'emprise 2 × 2, variante, la ferme) et l'emprise de la place. La scène ne fait
que poser. Dans l'ordre :

1. **La forme** : un rectangle autour de l'église (5 à 7 cases au nord, à l'est et à l'ouest,
   4 au sud), plus zéro, un ou deux **bastions** de 2-3 cases de profondeur, au nord et/ou à
   l'est. La réunion est la place, son bord l'enceinte. Jamais un cercle.
2. **Le terrain** : un mur ne tient que sur l'herbe ; la mer et la forêt gardent leurs flancs.
   Un bout de mur qui arrive au sable continue jusqu'à l'eau (la jetée du nord). Les moignons
   de moins de 4 cases sont jetés. ⚠️ Sur cette carte, ça donne toujours un L nord + est : la
   mer est à 5 cases de l'église, la forêt à 2. La variété de forme viendra du §4.29.
3. **Les tours** aux bouts et aux **angles saillants** seulement — un angle rentrant reste un
   mur : essayé avec une tour à chaque coude, ça faisait une forteresse —, plus une par
   tronçon de plus de 10 cases.
4. **Les portes** : un trait de l'église à chaque poste (§4.18) et au port ; la porte est là où
   il croise le mur, à deux cases près. Un pan sans porte en reçoit une au milieu (§4.24).
5. **Les brèches** : une par pan (deux au-delà de 12 cases), d'une ou deux cases, jamais contre
   une porte, une tour ou une autre brèche.
6. **Les maisons** : 12 à 15 visées, 9 au moins (la place est ce qu'elle est) ; serrées
   autour de la place et le long des rues (église → portes) sans être dessus, jamais contre
   une porte, ni dans un bastion ni dans sa bouche ; les emprises se touchent (deux voisines
   au plus, jamais trois collées à la file). La ferme est la plus à l'écart. ⚠️ Première
   version à 9-12 maisons espacées, refusée par Angelos : « trop séparées, ça fait pas
   village ». Resserrée dans la foulée.

**Branché** : `ArenaScene` tire le plan avant le décor (les arbres ne poussent pas dans
l'emprise), `poserLesMaisons(plan)` et `dresserLEnceinte(plan)` remplacent la disposition à la
main. La grille est recréée à chaque `init` : c'était un champ, elle gardait les murs de la
partie d'avant, et le même tirage aurait donné un autre village. **La graine traverse la
sauvegarde** (`graineVillage`, optionnelle : une sauvegarde d'avant prend zéro).
⚠️ **Sur une reprise, seules les brèches sont posées** : les murs reviennent par la sauvegarde
avec leurs PV. Avant, l'enceinte était redressée puis les constructions sauvées échouaient
dessus — un mur tombé renaissait au rechargement. C'est aussi pour ça que l'enceinte reste
à 4 cases au moins de l'église : `batir` applique la règle des trois cases (§4.24).

**Retirés à la demande d'Angelos, le même jour** : les ronds et les noms au sol des quatre
postes (`marquerLesPostes`, supprimé) et le halo de soin autour de l'église (`eglise.ts`).

**Captures** : `npx tsx scripts/capturer-villages.ts 1,7,42,1234 <dossier>` — deux vues par
graine (le village entier, l'angle nord-est de près), dans
`captures/jeu/2026-09-18-villages-generes/`. `init` de l'arène accepte `graineVillage` pour
rejouer un village précis.

**Verdict d'Angelos sur les murs, tours et portes (18 septembre, sur ces captures)** : « rien,
on est bon ». Les quatre doutes (porte est-ouest en encoche, colonne nord-sud en chapelet,
jonction mur / bastion, masse des tours) restent notés, et le dessin se change quand on veut
sans toucher au générateur ni à la sauvegarde — `murs.ts` ne connaît que des raccords. Sa
question du jour — « pourquoi tous les villages sont au même endroit ? » — a sa réponse au
§4.29 : l'église, le port et les postes sont des constantes.

**497 tests verts** (+12). `tsc` passe.

### Le bloc 7z, étage 7 — le sol prend du relief (fait le 18 septembre 2026)

**Le retour d'Angelos** : « change le sol, on dirait que c'est tout plat, j'aime pas du tout,
je préfère qu'il y ait plus de forme ». C'était son seul point bloquant après l'étage 6.

**Ce qui est fait** : `src/game/dessin/relief.ts` donne au sol une **altitude** (la terre
monte depuis le rivage, des collines de 230 px et de 90 px, la montagne en crêtes à partir de
son pied), la découpe en **facettes triangulaires** de 26 px (rangées décalées d'un demi-pas)
et donne à chacune une **marche de lumière** de -2 à 2, avec le soleil des sprites Blender.
`carte.ts` peint la terre dans le ton de sa facette ; l'eau garde ses taches. Ombrage
seulement : aucun pixel ne bouge pour le jeu. `relief.test.ts` (4 tests).

**Ce qui a été vérifié** (`captures/jeu/2026-09-18-relief-du-sol/`, avant = après l'étage 6) :
tsc, 485 tests, la carte se peint toujours en moins d'une seconde, build.

| Où | Problème → correction |
|---|---|
| L'image | Premier essai : un **camouflage de triangles**, chaque facette sautait de ton. Collines plus larges, moins de bruit fin, seuils des tons extrêmes relevés (0,16 → 0,24) |
| L'image | La montagne était un aplat sombre : une pente unique tournée vers le nord, à contre-jour. Rampe adoucie et **crêtes** (bruit replié) par-dessus |
| L'image | Une bande sombre uniforme dans le sous-bois : la rampe de la montagne commençait 70 px avant son pied. Elle commence au pied |

### Le bloc 7z, étage 6 — les bâtiments et le décor en low-poly Blender (fait le 18 septembre 2026)

**Le retour d'Angelos**, sur des planches rendues dans Blender : « franchement j'aime beaucoup,
intègre-les dans le jeu », avec le **biais léger** (on voit le flanc droit) et jamais de maison
en diagonale, puisqu'on les place sur des cases. Décision au §4.30, dernière section.

**Ce qui est fait** :

- `scripts/blender/` : `monde.py` (maisons, ferme, église à quatre niveaux, chênes,
  conifères, arbres morts, rochers, souche, en pièces nommées par matière), `rendre.py`
  (deux passes dans Blender : la matière de chaque pixel, puis la lumière sur une scène toute
  blanche), `reduire.py` (réduction x8 → x1, repeinte dans la palette du jeu, ombre portée,
  contour de fer), `palette.ts` (exporte la palette du jeu en JSON), `tout.ts` (**`npm run
  sprites`**, ou `npm run sprites -- bati-eglise` pour une famille).
- 21 PNG dans `src/assets/`, chargés par `BootScene` : ils remplacent le dessin au code sous
  la même clé, le code restant le secours. Rendu complet en ~25 s.
- La profondeur d'une maison se lit sur **la hauteur de son image**, plus sur `MAISON` : le
  sprite fait 50 px (on voit son emprise), le dessin au code 40. Le cadre de l'arbre passe à
  40 × 46 (`decor.ts`), parce que l'ombre déborde à droite.
- `sprites-blender.test.ts` : un PNG doit porter une clé du jeu, et un décor doit avoir la
  taille de `decor.ts` (sinon son pied tombe à côté du sol).

**Ce qui a été vérifié en jouant** (`captures/jeu/2026-09-18-lowpoly-batiments/`, avant et
après) : tsc, 481 tests, build.

| Où | Problème → correction |
|---|---|
| L'image | Décaler ce qui monte selon la **hauteur** penchait toutes les verticales : les maisons tombaient. Retour à la caméra penchée de la planche validée, plus une cisaille selon la profondeur, pivotée sur le bord sud pour que le pied ne bouge pas |
| L'image | Les ombres portées n'apparaissaient pas : le sol en plein soleil vaut 1,18 et l'ombre 0,66, le seuil était à 0,55. Seuil à 0,9 |
| L'image | Le soleil trop bas étirait les ombres de 30 px à droite. Remonté |
| En jeu | Tout tombait sur le ton « clair » : le décor sortait pâle sur un sol volontairement sombre. Marches de lumière remontées, et le feuillage descend d'une marche |
| Windows | `npx` lancé depuis un script échoue : la palette s'exporte par import |

**Ce qui n'est pas fait** : les murs, la tour, les portes, le port, le navire, les chantiers et
les champs sont toujours dessinés par le code ; les personnages aussi. Le sol a été fait juste
après (étage 7).

### Le bloc 7z, étage 5 — les murs en poteaux et pans, les gens au tiers (fait le 11 septembre 2026)

**Le retour d'Angelos sur `apres-village.png`**, en trois points : les personnages sont
trop grands par rapport aux maisons (« je zoomerai pour les voir ») ; les murs en bloc font
bizarre dans les coins — « catastrophique (mur, tour et porte) » ; et les maisons en cercle
autour de l'église ne sont pas du Clash of Clans, tous les villages ne doivent pas être
identiques. **Ordre imposé : les murs d'abord, à valider sur image ; le générateur de
villages après.** Cet étage fait les deux premiers points et s'arrête là.

**Les gens au tiers** (`corps.ts`) : le cadre passe de **32 à 20 px**. Un habitant fait 14 px
pour une maison de 40 — un peu plus du tiers, contre plus de la moitié. Toute la géométrie du
corps est exprimée par `K = 20/32` ; les outils, les armes, le bouclier et les bêtes suivent
(`CADRE_BETE = 20`, `CADRE_GROSSE_BETE = 30` pour la brute et le golem). Ce qui a dû plier
pour tenir : le cou plus court, l'épée et le bâton un peu moins longs, le bouclier porté sur
l'avant-bras, le museau du Rôdeur et du Cracheur raccourcis, le corps de la brute aussi, la
chute d'un mort qui ne descend plus d'un pixel. Trouvé par les tests de cadre, pas à l'œil.
La carte, la case de 32 et les bâtiments n'ont pas bougé.

**Les murs regardent leurs voisines** (`src/game/dessin/murs.ts`, neuf) : le bloc plein du
10 septembre est annulé. Une case de mur, c'est **un poteau, et un pan vers chaque voisine
qui est un mur, une tour ou une porte** — seize raccords, un dessin chacun, par matière
(48 textures). Le poteau est plus large et plus haut que le pan : c'est lui qui donne le rythme.
Une case seule est une borne, un angle est un poteau d'où partent deux pans, un escalier se
raccorde de marche en marche. La vue est de trois quarts : le dessus soulevé de la hauteur, la
face sud dessous, et c'est la profondeur qui raccorde deux cases l'une au-dessus de l'autre.
Bois : pieux liés par une corde, pointes inégales sur la crête ; fer : plaques rivetées, bossage
sur le poteau, pointes ; pierre : appareil de blocs, chemin de ronde, merlons, tourelle sur le
poteau. Un rempart **s'épaissit et monte** à chaque palier (pan 12/14/16, face 13/15/17).

`game/constructions.ts` lit la grille (`voisinesRaccordees`) et **redessine les quatre voisines**
à la pose, à la chute, à la démolition et au déplacement — jamais par image. L'aperçu de pose
montre déjà ses raccords. La **ruine** n'a plus ses pieux « couchés en travers » (des antennes,
vus en jeu) : moignons autour de l'ancien poteau, un pieu à plat.

**La tour** occupe désormais toute sa case — c'est ce qui fait qu'un pan voisin bute contre
son flanc sans trou, quelle que soit la matière — et monte à 30 px : socle de pierre, cordon,
meurtrière, porte, parapet crénelé, plateforme vide. L'occupant se tient **sur** la plateforme
(`OCCUPANT_TOUR_Y`) et prend la profondeur de la tour, sinon ses pieds, plus hauts dans
l'image, le faisaient passer derrière.

**La porte existe** (§4.20, `K`, 20 bois, 160 PV). Elle prend une case de mur ; les poteaux
des cases voisines lui servent de montants, elle ne dessine que le linteau et les vantaux.
Est-ouest : une arche avec ses vantaux rabattus, ou fermés (planches, deux bandes de fer) ;
nord-sud : la poutre qui franchit le passage, ou la cloison en travers. **Règle v1, à valider** :
ouverte, tout le monde passe, monstres compris (c'est le dilemme du §4.20) ; **la cloche ferme
toutes les portes**, l'aube les rouvre ; fermée, elle arrête tout le monde et se fait frapper.
Le core porte `Occupation = "porte"`, `Grille.portesFermees`, `bloque()` qui en tient compte,
et la définition dans `CONSTRUCTIONS`. La physique laisse traverser une porte ouverte par un
`processCallback` sur les trois colliders.

**L'enceinte de départ** n'est plus un décor posé hors grille : ce sont de **vraies
constructions** (corps, points de vie, raccords), en **L sur les deux fronts** — mur nord de
la plage à l'angle, mur est de l'angle à la forêt, une tour à chaque bout et à l'angle, une porte
au milieu de chaque mur, deux brèches en ruine par mur. ⚠️ **Provisoire et écrit comme tel** :
c'est la disposition d'un seul village, faite à la main pour juger les murs en jeu. Les maisons
en cercle sont laissées telles quelles, exprès.

**Ce qui attend la validation d'Angelos** : le générateur de villages par graine (formes variées,
portes et tours placées selon le terrain, plus de cercle de maisons) — demandé, et
explicitement **après** que les murs sont validés.

**Ce dont je ne suis pas sûr, à juger sur `captures/jeu/2026-09-11-bloc-7z-etage-5/murs-*.png`** : la porte est-ouest ouverte,
qui se lit comme une encoche dans le mur plus que comme une porte ; la tour, un cube de pierre
de toute la case, peut-être trop massif ; la colonne nord-sud, où chaque poteau montre ses deux
épaulements et fait un chapelet ; les 14 px d'un habitant, à la limite du lisible au zoom de
départ (1,7) — c'est voulu, on zoome.

**479 tests verts** (+7 : les seize raccords ont seize dessins, un pan est-ouest touche ses deux
bords et une borne aucun, un pan nord-sud est une colonne continue, une porte ouverte laisse
voir le sol et pas fermée, la grille laisse passer une porte ouverte et raccorde mur/tour/porte
mais pas une ruine). `npm run build` passe. Nouvelles captures : `murs-enceinte.png` (l'angle
nord-est de près) et `murs-gens.png` (la place au zoom maximal), ajoutées à `scripts/capturer.ts` ;
`planche-murs-{bois,fer,pierre}.png` et `planche-echelle.png` dans `scripts/planche.ts`.

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

✅ **Le visuel est tranché et livré** (10 septembre 2026, voir « Le bloc 7z, étage 4 »). Ce qui
reste ouvert n'est plus une direction, ce sont des **retouches sur image** : Angelos juge les
captures et dit ce qui cloche. **Première passe faite le 11 septembre** (étage 5 : gens au tiers,
murs en poteaux et pans, tour, porte) ; captures `murs-*.png` à valider.

0. ✅ **Le générateur de villages est codé et validé** (18 septembre 2026, voir sa section) :
   une graine, des formes variées, des tours et des portes selon le terrain, plus de cercle.
   Angelos a validé les murs tels quels et la densité des maisons sur les captures de
   `captures/jeu/2026-09-18-villages-generes/`. **Le prochain morceau est le bloc 7a** (point 3).

1. ✅ **Appliquer au code ce que le dépouillage a tranché** — fini le 19 septembre 2026 au
   soir (voir « Les restes du dépouillage ») :
   a) le cycle 10 + 5 — ✅ le 9 septembre (`src/core/cycle.ts`). ⚠️ **La nuit est trois fois
   plus courte à effectif constant : elle est donc trois fois plus dense.** À mesurer en jouant
   avant de toucher `effectifPremiereNuit` ;
   b) ✅ totem → Relique : rien à coder, le mot n'était pas dans le code ;
   c) ✅ les **deux cases** ; d) ✅ le **seuil de 65** (hordes continues au-delà) ;
   e) ✅ les **quatre actives** (oublier ou acheter un emplacement ; la fusion au jalon 6.5) ;
   f) ✅ les **paliers de mur** bois → fer, mur et porte, segment par segment (la pierre au 7b).
2. ✅ **Le bloc 7z est fini, eau comprise** : l'étage 4 le 10 septembre 2026, **l'eau qui
   noie** le 19 septembre au soir (voir sa section). Les ronds de poste sont partis le
   18 septembre ; ce qui manque encore, c'est ce qui devait les remplacer — la mine, le ponton
   et les bûches qui disent eux-mêmes où l'on travaille.
3. ✅ **Le bloc 7a est fini** (19 septembre 2026, voir sa section) : maisons destructibles,
   village en ruines au départ, survol, les quatre défauts d'affichage corrigés — et **le sol
   du village est peint** le soir même (place, rues, parvis, voir « Le sol du village »).
   ✅ **Les chemins qui s'usent** sont codés le 20 septembre après minuit (voir sa section) :
   à juger sur `captures/jeu/2026-09-20-chemins/`. ✅ **Les cordes à linge et les filets** le
   même jour au petit matin (voir « Les derniers détails de vie ») ; « le feu » était
   l'incendie, tranché et rangé au jalon 6 (§4.21).
3b. ✅ **L'écran-titre a du son** (19 septembre 2026, voir sa section) : la musique de guerre
   (« Lament of the War ») est choisie, bouclée sans couture, réglable à part dans
   PARAMÈTRES (trois curseurs). ✅ **La musique en partie est livrée** (le soir même, voir sa
   section) : la calme choisie (n° 2), la guerre la nuit et dès qu'un héros se bat, fondus
   enchaînés. **Reste à juger à l'oreille** les trois `partie-*.mp3`. **Phase 2, en cours**
   (20 septembre au petit matin, voir « Le son, phase 2 ») : les planches d'écoute des bruits
   sont faites — treize événements, deux à quatre candidats CC0 chacun, dans
   `captures/son/2026-09-20-bruits/` avec la page `ecoute.html` qui écrit la réponse. **À
   écouter**, puis on branche (atténuation par distance, un coup sur deux, huit voix ; aucun
   cri avant le jalon 6.7). ✅ **Les treize bruits sont choisis et livrés** (20 septembre,
   `sort` = la boule de feu). Tout ce qui reste à coder est rassemblé dans **`PROMPT-SUITE.md`**.
3c. ✅ **Le bloc 7b est codé** (20 septembre 2026, voir « Le bloc 7b — la forteresse ») :
   portes en 2 s, cloche qui attend, ouverture automatique, refus du mur sans porte, pierre
   de la mine, douves sèches et en eau, pont-levis. **À juger** sur
   `captures/jeu/2026-09-20-forteresse/` et en jouant une nuit avec la cloche.
4. **Jouer une vraie partie longue.** C'est ce que le cycle raccourci débloque : le stress,
   l'église, le port, les arrivées et la folie n'ont jamais tourné assez longtemps pour être
   jugés. Tous les chiffres du dépouillage sont faits pour être corrigés là.
5. ✅ **Le `feedback.md` a été traité** (session du 8-9 août). Tout est tranché et écrit
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

### Jalon 5 — le village *(les douze blocs sont faits, le 21 septembre 2026)*

> La liste qui fait foi est celle du **§5 du design** (`design/05-ordre-de-construction.md`).
> Ce tableau n'est gardé que pour l'histoire du réordonnancement du 9 août.

L'ordre est fixé au §5 du design, et **il a été réordonné le 9 août pour cause de
dépendances** :

| Bloc | Contenu |
|---|---|
| **4** ✅ | **L'église** : on y entre, soins, cap des monstres, ses 4 niveaux et leurs 4 conditions, destruction et relèvement, bloc de combat civil |
| **5** ✅ | **Traits, stress et états**, séquelles, 3 statistiques, portraits assemblés, fiche unifiée, renommage, satisfaction |
| **6a** ✅ | **La porte** : fiche d'observation, les 6 indices en deux versions, la banque de questions, les 3 degrés de folie et leurs groupes, la réputation |
| **6b** ✅ | **Le port** : le port en ruine qu'on relève, la voile qui paraît quand c'est calme, le **cours** de chaque ressource, la vente, l'**argent** |
| **6d** ✅ | **La refonte de l'interface** : `chrome.ts`, les panneaux rhabillés, la discussion, la fiche, la porte, le village, le port, les deux écrans d'avant-partie |
| **6c2** ✅ | **Les survivants** : ils paraissent au bord de la carte, parfois poursuivis, parfois blessés, et il faut aller les ramener vivants |
| **7a** ✅ | **Mode d'aménagement** : ✅ la ruine qui se rebâtit, ✅ les règles de pose, ✅ démolir / déplacer — puis l'édition **en pause**, la pose à la souris, les maisons destructibles, le village en ruines, le sol et les chemins |
| **7b** ✅ | **La forteresse** : murs au fer, **portes qui s'ouvrent et se ferment** (et qu'on ne peut pas ne pas avoir), autant d'enceintes qu'on en bâtit, douves, eau, pont-levis |
| **8** ✅ | **Les ordres pour tous** : n'importe qui fait n'importe quoi, menu d'ordres, héros au travail |
| **9** ✅ | **Le village armé** : entraînement au combat, métier de milicien, passage villageois → héros |
| **10** ✅ | Confort : options, pause Échap, touches remappables |
| **11** ✅ | **La mémoire du village** : relations, souvenirs, ce qu'une mort produit, héritage, archives |
| **12** ✅ | **La vie autonome** : la journée sans ordre, le tour de rôle, les bulles, les six initiatives |

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

- **`npm run ciel` réécrit tous les `.ogg`, même ceux qu'on n'a pas touchés.** Le contenu
  sonore est identique (même graine, même code), mais l'encodeur Vorbis ne produit pas deux
  fois le même fichier octet pour octet — les `.mp3`, eux, ne bougent pas. Après une passe de
  son, `git status` montre donc cinq ou six fichiers modifiés pour rien : **ne commiter que
  ceux dont le son a vraiment changé**, et rendre les autres (`git checkout --`).

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

**Il n'y en a plus.** Le 9 septembre 2026, tout le stock — une soixantaine de questions
accumulées depuis le début du projet — a été dépouillé en une seule passe, à la demande
d'Angelos : « plus AUCUNE question, ne plus devoir faire des allers-retours ».

Tout est écrit dans [`design/06-questions-ouvertes.md`](design/06-questions-ouvertes.md),
section **« Le grand dépouillage du 9 septembre 2026 »** en tête de fichier, et répercuté
dans chaque §4.xx concerné sous le titre *« Tranché le 9 septembre 2026 »*.

Ce que ça change de plus lourd, en une ligne chacun :

| La décision | Ce qu'elle annule |
|---|---|
| **Une journée dure 15 minutes** (10 de jour, 5 de nuit) au lieu de 45 | §4.19 — et c'est **déjà appliqué au code**, avec les hordes de jour recalées de 6-12 min à 2-4 min |
| **Le §4.29 devient le mode principal et le seul** : un héros seul, l'errance, un village aléatoire déjà peuplé | L'ancien démarrage disparaît. C'est le plus gros chantier restant du projet |
| **On ne devient pas héros, on naît avec un don** (1 habitant sur 10 ; 1 don sur 20 est majeur) | Toute idée qu'un vétéran devienne héros à l'usure (§4.1, §4.18) |
| **La bascule en antagoniste vient du stress**, jamais des défaites | Le comptage de défaites du §4.12 |
| **Pas de plafond de population** : au-delà de 65 habitants, les monstres sont attirés et les attaques débordent sur le jour | La limite dure du §4.17, qui devient un plafond technique invisible (120) |
| **Le totem d'immortalité devient la Relique d'immortalité** | L'ambiguïté du mot totem, employé pour deux objets (§4.3 / §4.7) |
| **Deux cases entre un mur et un bâtiment** | La règle des trois cases du §4.24 |
| **Les murs montent ×4 par palier, segment par segment, chantier par bâtisseur** | Les paliers non chiffrés du §4.20 |
| **La porte examine des papiers**, recoupés avec la mémoire du village ; un imposteur démasqué attaque | Rien — c'est la note brute du 13 août, enfin dépouillée |

⚠️ **Ce qui n'a volontairement pas été tranché**, parce que ce ne sont pas des choix mais du
contenu à écrire : la liste complète des compétences et des ultimes, les statistiques des
quatre classes, la liste des questions posables à la porte, et les bienfaits du Druide.

✅ **La direction visuelle est tranchée le 10 septembre 2026** (section « Le bloc 7z, étage
4 ») : on garde fer/os/sang et le dessin par le code, on n'emprunte à Clash of Clans que le
**comportement** des constructions, et l'interface devient gothique apocalyptique. Ce qui reste
se juge sur les captures `apres-*`, retouche par retouche.

## Tranché le 10 septembre 2026 — le moteur et le périmètre

Deux questions de fond sont fermées, après l'annonce du plugin Unity officiel pour Claude Code
(9 septembre 2026 : 29 skills, CLI Unity, serveur MCP de contrôle de l'éditeur).

- **On reste sur Phaser.** L'option « changer de moteur » est retirée de la liste ci-dessus. Le
  plugin Unity est bien réel, mais sans objet ici : le rendu qui déçoit est un problème
  d'assets, pas de moteur — Unity afficherait les mêmes images. Ne pas rouvrir sans élément neuf.
- **On ne recrée pas le jeu depuis cette spec.** L'idée de faire tout réécrire d'un bloc par un
  autre modèle est écartée. `src/core/` (7 804 lignes, 3 944 lignes de tests) **n'est pas remis
  en cause par le dépouillage du 9 septembre** : les règles de satisfaction, cycle, habitants,
  port, église et IA restent valables. Le périmètre est donc **garder le core, refaire tout ce
  qui se voit** : le 7z, puis le §4.29. À l'écran, le résultat est le même qu'une
  reconstruction — sans jeter le filet des tests.

## Pour lancer

```bash
npm install
npm run dev      # le jeu s'ouvre dans le navigateur
npx vitest run   # les tests (630)
npm run build    # vérifie les types et construit

npx tsx scripts/capturer.ts apres   # les captures du jeu, par Playwright, toujours au même endroit
npx tsx scripts/planche.ts          # les planches PNG de la carte, du décor, des bâtiments et des personnages, sans navigateur
```

**Commence par me dire ce que tu as compris et ce que tu comptes faire en premier, avant
de coder.**
