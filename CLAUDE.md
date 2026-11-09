# Le Protecteur — les règles du projet

Ce fichier se charge tout seul à chaque session : plus besoin de coller un prompt de
reprise. Les règles générales d'Angelos (tous projets) sont dans son `CLAUDE.md` global ;
ici, seulement ce qui est propre au jeu.

**Le Protecteur** est le premier jeu d'Angelos : un héros protège un village contre des
hordes de monstres (combat façon *survivors*), pendant que les habitants vivent,
travaillent et construisent. TypeScript, Phaser 3, Vite ; tout ce qui se voit vient de
Blender. **Angelos n'est pas développeur** : il décide du design, Claude construit, et dit
franchement quand une idée coûte cher ou casse quelque chose.

## Avant de proposer quoi que ce soit, lire

1. **`PROMPT-SUITE.md`** — où on en est, ce qui reste à coder et dans quel ordre (§1, §3,
   §4), les dettes connues (§7).
2. **`DESIGN.md`** (le sommaire), puis dans `design/` : **§5** (l'ordre de construction),
   **§6** (les questions tranchées), **§4.17** (tenir la fluidité : ses règles ne se
   négocient pas), et la section du jalon en cours.
3. **`SUITE.md`** — le journal de bord technique, chantier par chantier, avec les pièges
   déjà payés : au moins les cinq dernières sections et « Dettes et pièges connus ».
4. **Les notes brutes d'Angelos** : `design/a-faire.md`, section « Nouvelles notes ». Il y
   colle ses idées en vrac ; aller les chercher avant de coder.

`README.md` dit comment lancer et ce que fait chaque fichier. Les vieux briefs et prompts
d'août et septembre sont dans `archives/` : ils ne font plus foi.

## Où vit le code

- **`src/core/`** — les règles, pures et testées. **On ne le jette jamais** : une règle qui
  change devient une modification du noyau plus ses tests. Les tests restent verts. **La
  graine zéro reste la carte d'avant.**
- **`src/game/`** — les systèmes branchés sur Phaser, le dessin (`dessin/`), l'interface.
- **`src/scenes/`** — les scènes (titre, menu, arène, interface). **`ArenaScene.ts`** ne
  garde que l'état de la partie (ses champs), `init`, `create`, `update` et les getters ;
  ses ~300 méthodes sont rangées par système dans **`src/scenes/arene/`** (une classe par
  fichier, greffée sur la scène : voir « Structure du code » du `README.md`). Une méthode
  neuve va dans le fichier de son système, jamais dans `ArenaScene.ts`.
- **`scripts/blender/`** — la chaîne Blender : `npm run sprites`, `npm run persos`,
  `npm run intro`. Un PNG dans `src/assets/` remplace le dessin du code sous la même clé.
- **`scripts/son/`** — les sons fabriqués au code (`npm run son`, `bruits`, `ciel`).

## Comment Angelos veut qu'on travaille

- **Les décisions d'abord, groupées** : des questions **à choix** (jamais ouvertes), posées
  d'un coup **avant** de coder, par paquets de quatre. Pendant le travail, on ne
  l'interrompt plus. Un chiffre technique défendable, on le tranche soi-même et on le dit.
- **Le contenu chiffré** (compétences, ultimes, fusions) se règle dans **le Grimoire**, pas
  par des questions : voir plus bas.
- **Des morceaux courts**, qu'il valide un par un. Jamais trois heures sans rien montrer.
- **Le visuel se juge sur image** : fabriquer, regarder soi-même la capture, corriger ce
  qui est raté, **puis** montrer. Les captures vont dans `captures/`, rangées par type puis
  par date (`captures/README.md`). Le son se juge à l'oreille, pareil.
- **Sa dernière décision fait foi**, même contre le design : signaler la contradiction une
  fois, avec ce qu'elle coûte, puis réécrire le paragraphe périmé.
- **Tout ce qui se voit passe par Blender**, en sprites pré-rendus : pas de 3D temps réel
  (reconfirmé le 9 novembre 2026). Le code dessiné n'est plus qu'un secours.
- **À la fin de chaque morceau** : typecheck, tests, commit poussé (un seul par chantier),
  `SUITE.md` et la section du design à jour, le journal de portfolio.

## Vérifier et mesurer

- **Ce qui bouge se vérifie dans le navigateur**, pas seulement en tests : un script
  Playwright jetable dans `.tmp/` (en `.mjs`) qui pilote une vraie partie et compte ses
  contrôles. **Le monde est tiré au sort** à chaque lancement : **trois passes** avant de
  dire que ça passe. Options de départ de `scene.start("arena", {...})` : `graineMonde: N`
  rejoue un monde, `sansLaMarche: true` commence installé, `refus: N` et `mondesMuets: N`
  placent l'errance, `argent`, `butinDeLaRoute` et `compagnons` remplissent la bourse, le
  sac et la troupe. `.tmp/menage-temoin.mjs` est un bon point de départ.
- **Mesurer avec un témoin** : un « c'est plus rapide » sans chiffre d'avant ne vaut rien.
  Le témoin s'obtient en remettant l'ancien code (`git stash push -- src/`), sur **le même
  monde et le même village** (le village a sa propre graine).
- **Sur la vraie carte graphique** : Chromium sans fenêtre mais `--use-angle=d3d11`. Le
  rendu par défaut (SwiftShader) ment, et une vraie fenêtre se fait brider à 1 image/s.
  En rendu logiciel, tout ce qui est minuté s'étire d'un facteur quatre : les **écarts**
  sont vrais, les valeurs absolues non.
- **Le robot** (`npx tsx scripts/robot.ts`, jalon 6.4) joue des parties entières sans
  fenêtre, accélérées, et rend un rapport par partie plus un résumé dans `.tmp/robot/` :
  nuit atteinte, niveau, ce qui a tué chaque héros, relevés à chaque aube et crépuscule.
  Il joue le héros seul (la même IA que les autres héros), choisit ses cartes par une règle
  simple ou au hasard (`--cartes regle,hasard`, mêmes mondes pour les deux), accepte tout le
  monde à la porte. Il construit le jeu à part (`.tmp/robot-dist`) : on peut toucher à
  `src/` **une fois sa construction finie** (première ligne de partie dans son journal).
  Options : `--classes`, `--parties`, `--paralleles`, `--nuit-max`, `--budget` (ms de
  calcul sans dessin par image dessinée, 90 par défaut, à 10 images/s), `--minutes`,
  `--dist` et `--port` (deux séries côte à côte : un témoin et sa variante). **Six parties
  par classe laissent près d'une nuit d'écart au hasard** : douze (`--parties 6`, règle et
  hasard) pour trancher un réglage, et toujours contre un témoin sur les mêmes mondes.
  **`--paralleles 6` au plus** : une partie longue (mage, rôdeur) prend ~1,1 Go de RAM ; à
  12 de front, la série 13 a saturé les 31 Go de la machine d'Angelos (6 parties en erreur, 8
  coupées, tout le PC ralenti). Fermer ensuite tout `chrome-headless-shell` qui resterait.
  Lecture : `node .tmp/synthese-robot.mjs <dossier>`.
- **La cadence** (`core/cadence.ts`) : le jeu dessine 60 images par seconde en partie, 30
  dans les menus, l'écran-titre et la pause, **5 sans le focus** — un script qui ne
  réveille pas le jeu par `window.dispatchEvent(new Event("focus"))` tourne au ralenti.
  `loop.actualFps` compte les images **dessinées**. Pour simuler un écran rapide, lancer
  Chromium avec `--disable-frame-rate-limit --disable-gpu-vsync` (`.tmp/cadence-mesure.mjs`).
- **Avant de lâcher une meute** : `prochaineArriveeJournee = 9999`, sinon la fiche
  d'arrivant met la partie en pause. Pour planter un monstre : `body.moves = false`.
  Émettre `choix-fait` exige une pause posée avant.
- **Le village de test est presque vide** (1 à 3 maisons debout) : bâtir dans le script
  avant de mesurer des dégâts sur les bâtiments.
- **Les captures tournent à densité 1**, alors qu'Angelos joue sur un écran Windows
  agrandi : elles ne montrent pas exactement ce qu'il voit.
- **Après minuit**, le dossier par défaut des scripts de capture porte la date UTC de la
  veille : passer le dossier en argument.
- **Fermer** tout Chrome et tout serveur lancés pour tester, et vérifier qu'il n'en reste
  aucun.

## Sept pièges du navigateur, déjà payés

1. `camera.worldView` n'est recalculé qu'au rendu **suivant** (lire `scrollX`/`scrollY`
   après un `centerOn`).
2. La caméra est **bornée** par la carte : `removeBounds()` le temps d'un contrôle.
3. Pousser le héros « loin » le fait **changer de monde** (`guetterLeDepart` voit le bord).
4. En rendu logiciel, on mesure les écarts et les vitesses, jamais les distances parcourues.
5. **Phaser écoute le clavier sur `window` en phase de bouillonnement.** Pour passer devant
   lui, écouter sur `document` **en capture** et arrêter la propagation.
6. **`page.evaluate` renvoie la dernière expression** : finir les blocs par `void 0;`
   (un `centerOn` ou un `scene.pause()` renvoie un objet énorme et fige Node). Sous `tsx`,
   pas de fonction nommée dans `page.evaluate` (`__name` n'existe pas dans la page) :
   passer le code de page en chaîne.
7. **Ne jamais toucher à `src/` pendant qu'un script tourne** : Vite recharge la page en
   pleine mesure. Un monstre qu'on vient de poser n'est dans le voisinage qu'au pas de
   physique suivant : attendre une image.

Et deux de l'ordinateur : un long script collé dans le shell plante avant de tourner
(l'écrire dans un fichier, puis le lancer) ; et `npm run build` échoue depuis Git Bash (le
chemin y commence par `c:` en minuscule, Vite compare à la casse près) — le lancer depuis
PowerShell.

## Le Grimoire

Le catalogue des compétences (86), ultimes (7) et fusions (26), qu'Angelos règle lui-même :
https://claude.ai/artifact/MMgy33ybsQJQGEWQpzj2yV. **Avant de coder un morceau de contenu**,
relire ses changements : `ArtifactData list` de chaque collection avec `out_dir`, puis
`python .tmp/lire-grimoire.py <dossier>` (chaque champ différent de `base` est une
modification). Les appliquer au code, puis **re-semer `base`** avec les valeurs appliquées.
Tout nouveau lot de contenu s'ajoute au Grimoire plutôt que de poser des questions de
chiffres.

## Pour lancer

```bash
npm install
npm run dev      # le jeu s'ouvre dans le navigateur
npx vitest run   # les tests
npm run build    # vérifie les types et construit (depuis PowerShell)

npx tsx scripts/robot.ts                   # le robot joue des parties entières (.tmp/robot/)
npx tsx scripts/capturer.ts apres          # les captures du jeu, par Playwright
npx tsx scripts/capturer-mondes.ts 0,1,2   # plusieurs mondes tirés
npx tsx scripts/planche.ts                 # les planches PNG, sans navigateur
npm run intro                              # refait la cinématique Blender
npm run son                                # refait la bande-son
```
