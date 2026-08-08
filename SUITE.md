# Prompt de reprise

> Colle tout ce qui suit dans une nouvelle session, à la racine du projet.
>
> Dernière mise à jour : 2026-08-09 (après la **refonte du design du village et des
> villageois** — aucun code écrit depuis le bloc 3).

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
2. Un script Node qui lance Chromium, va sur `http://localhost:5199/`, attend ~3 s,
   appuie sur **`Digit1`** pour choisir une classe et démarrer.
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

**Jalons 0 à 4 terminés**, et les **blocs 1, 2 et 3 du jalon 5** (voir §5 de `DESIGN.md`) :

- Vite + TypeScript + Phaser 3, tests avec Vitest. **155 tests verts.**
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

## Ce qui reste à faire

### Tout de suite

1. **Juger le rythme en jouant.** C'est *la* question du bloc 2 : 30 minutes de jour et
   15 de nuit, est-ce jouable ? Et l'effectif de 30 monstres pour la nuit 1, réparti sur
   ~10 minutes, ne fait qu'un monstre toutes les 20 secondes — sur le papier c'est très
   calme. Tout se règle dans `REGLAGES_CYCLE`.
2. **Juger les animations en jouant.** Le mouvement est volontairement discret (1 à 2 px)
   parce qu'à 32 px, 3 px disloquent le personnage. Amplitudes en haut de
   `scripts/animer-sprites.ts`.
3. ✅ **Le `feedback.md` a été traité** (session du 8-9 août). Tout est tranché et écrit
   dans `DESIGN.md` : appétit des héros, totem, fous, humeurs, renommage, options.

### ⚠️ Le design du village a été entièrement refondu le 2026-08-09

**Aucune ligne de code n'a encore été écrite pour ça.** Le `DESIGN.md` est à jour, le code
ne l'est pas — c'est le plus gros écart du projet à ce jour. Ce qui a changé :

- **L'église devient le cœur du jeu** (§4.22, section neuve) : refuge des civils, **seul**
  lieu de soin, lieu de purge des états, origine de l'Oracle, et **cap des monstres**. Le
  cercle `VILLAGE` de `carte.ts` n'est plus le refuge.
- **Les habitants ont des traits, des humeurs et des états** (§4.23, section neuve), avec
  une fiche cliquable. **Ça annule la vieille règle du §4.18** qui interdisait le second
  écran de personnage — le §4.18 a été réécrit pour le dire.
- **Le joueur aménage son village** à la Clash of Clans (§4.24, section neuve) : mode
  édition en pause, construction libre partout, déplacement gratuit, **tout ce qui est
  bâti se casse** (maisons comprises — ça remonte du jalon 8 au jalon 5), village qui
  **démarre en ruines**.
- **Le fou passe à l'acte sur un tirage caché** : ça contredit sciemment « une perte vient
  toujours d'un arbitrage », c'est assumé et payé par trois contreparties (§4.18).
- Totem **consommé à l'usage** (§4.3). Héros nourris par **ration forfaitaire** (§4.18).
  **Pas de plafond dur** de population. **Fiche unique** héros/habitants et menu
  d'**options** (§4.10).

> **La règle de travail qui va avec** : sa dernière décision prime sur `DESIGN.md`, même
> quand elle contredit frontalement une règle défendue ailleurs. On signale la
> contradiction une fois, avec ce qu'elle coûte, puis on réécrit le paragraphe périmé
> plutôt que de le laisser mentir.

### Jalon 5 — le village *(blocs 1, 2 et 3 faits, 4 à 8 à faire)*

L'ordre est fixé au §5 de `DESIGN.md` :

| Bloc | Contenu |
|---|---|
| **4** | Les arrivées aux portes (avec des **fous**), les naissances, les survivants à escorter |
| **5** | **L'église** : refuge, soins, purge, cap des monstres, niveaux, destruction et reconstruction |
| **6** | **Traits, humeurs et états**, fiche unifiée, renommage |
| **7** | **Mode d'aménagement** : édition en pause, construction libre, tout se casse, village en ruines, sol et chemins |
| **8** | Confort : options, pause Échap, touches remappables |

Le bloc 4 passe devant l'église **exprès** : il était déjà écrit, et les arrivants
donneront de la matière aux traits du bloc 6 — un village de trois personnes ne teste rien.

### ComfyUI est installé en local (2026-08-09)

`C:\Users\lemir\Desktop\Projet\outils\ComfyUI`, hors du dépôt de jeu, avec son venv Python
3.11 et SD1.5. La RTX 1000 Ada (6 Go) suffit. **C'est la réponse au « PixelLab à 0
crédit »** pour tout ce qui est **image fixe** — bâtiments, décor, icônes : le problème de
cohérence entre frames qui interdisait de l'utiliser pour les personnages animés ne se
pose pas ici.

La recette prévue : générer en 512 px, puis **réduire et quantifier la palette avec nos
propres scripts** (`scripts/png.ts` sait déjà lire et écrire du PNG sans dépendance).
C'est ce qui garantit que le résultat entre dans la direction artistique du jeu quel que
soit le style du modèle.

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
- **La cité est toujours un abri total** : on s'y soigne et rien n'empêche d'y camper
  (`majEtats`, `ArenaScene.ts`). Le trou n'est **qu'à moitié fermé** : les habitants
  peuvent maintenant mourir pendant qu'on campe, et perdre le dernier finit la partie —
  mais les monstres ne s'en prennent toujours pas aux bâtiments. C'est le bloc 3.
- **La sauvegarde n'existe pas, et c'est assumé** : rafraîchir la page est une nouvelle
  partie. Elle passera par **Supabase**, pas par `localStorage`.
- **Combinaison possiblement cassée** : `Écho` + `Capacités affinées` + `Danse des
  ombres` pourrait permettre d'enchaîner les capacités sans fin. Jamais vérifié en jeu.
- **Pas de sauvegarde** (aucun `localStorage` dans le code). Prévu avec export/import de
  fichier dès qu'il y aura une vraie progression à perdre.
- **Le kamikaze ne blesse que les héros**, pas les invocations. Choix de simplicité, à
  revoir si ça se voit.
- **Le martyre (Chevalier Sacré) ne déclenche pas `tomber()`** si le martyr incarné
  descend à 0 PV. Comportement d'origine, conservé tel quel — à trancher.
- **Les hitbox ne doivent jamais bouger.** `calerCorps` (`entities.ts`) les cale sur les
  dimensions de la texture ; une frame d'animation fait exactement la taille de la
  source, c'est ce qui garantit que rien n'a bougé. Les variantes d'archétype changent
  leur hitbox **volontairement** avec leur échelle, comme le golem.

## Questions encore ouvertes

Listées au §6 de `DESIGN.md`. Les plus importantes :

- Y a-t-il des dégâts **physiques** et **magiques** séparés ? (aujourd'hui une seule
  statistique)
- Combien de défaites avant que le héros de départ bascule en antagoniste ?
- Que perd-il exactement à chaque défaite ?
- Comment recrute-t-on un héros ?

## Pour lancer

```bash
npm install
npm run dev      # le jeu s'ouvre dans le navigateur
npx vitest run   # les tests (105)
npm run build    # vérifie les types et construit

npx tsx scripts/animer-sprites.ts --planche   # régénère les planches d'animation
```

**Commence par me dire ce que tu as compris et ce que tu comptes faire en premier, avant
de coder.**
