# Prompt de reprise — ce qui reste à coder (20 septembre 2026, soir)

> Colle tout ce qui suit dans une nouvelle session, à la racine du projet.
>
> Écrit le 20 septembre 2026 au soir, après la première moitié du jalon 5.5 (un seul héros,
> un monde tiré par graine), le retour sur les douves et les ponts-levis, et le passage des
> héros et des monstres en low-poly Blender. **Le design est écrit et tranché** (le grand
> dépouillage du 9 septembre a fermé toutes les questions ouvertes) : la session qui prend la
> suite a surtout à construire, et à ne demander que ce que le design ne dit pas.

---

Tu reprends **Le Protecteur**, mon jeu en cours. C'est mon premier jeu, je ne suis pas
développeur : je décide du design, tu construis, et tu me dis franchement quand une idée
coûte cher ou casse quelque chose.

## 0. ✅ Le chantier des villageois Blender est fini (20 septembre 2026, au soir)

**Plus rien à reprendre ici.** Les villageois, les familiers et le mort-vivant sont rendus,
livrés et branchés : **121 planches** dans `src/assets/` (35 héros, 6 monstres, 48 villageois,
3 familiers, le mort-vivant), typecheck propre, 595 tests verts, tout est commité.

Deux bugs du rig ont été trouvés **en regardant les planches** et corrigés au passage :

- **les bêtes n'avaient pas de corps** — l'échelle de la boule reprenait une conversion déjà
  faite, le corps sortait 10,5 fois trop petit ; les six monstres livrés le matin même étaient
  dans cet état, leurs planches sont refaites ;
- **la mort passait sous le sol** — la racine pivote au sol, donc le corps bascule seul ; on le
  descendait en plus.

⚠️ **Ce qui reste à juger, et qui t'attend** : le **code est plus lisible que Blender pour un
villageois** (tablier plus grand, bras et jambes détachés). La comparaison est dans
`captures/planches/2026-09-20-villageois/code-contre-blender.png`. Angelos tranche ; s'il
garde Blender, deux retouches sont identifiées — la courbure à l'usure 2, et quatre métiers
bruns trop proches (bûcheron, mineur, charpentier, survivant).

## 1. Où on en est

Ce qui tourne vraiment, et qui est récent (tout est dans `SUITE.md`, section par section) :

- **Un seul héros au départ** (20 septembre) : on joue la classe choisie, seule. L'équipe des
  sept classes a disparu ; ordres, formations et IA de repli dorment jusqu'au premier
  villageois formé (bloc 9).
- **Une graine, un monde** (`src/core/monde.ts`, 20 septembre) : la mer sur un des quatre
  bords ou absente, une chaîne le long d'un bord, un massif au milieu ou un simple piton, un
  lac, des bois ; le village posé au sort sur l'herbe près d'une eau ; les quatre postes de
  travail cherchés sur le terrain ; les **fronts déduits des bords** par lesquels on rejoint
  le village à pied (deux à quatre). **La graine zéro est la carte d'avant**, au chiffre
  près : les vieilles sauvegardes la reprennent, et les tests qui connaissent la carte
  tournent dessus. `src/core/carte.ts` n'est plus qu'une façade : `VILLAGE`, `EGLISE`,
  `PORT`, `POSTES` sont des objets remplis par `chargerLeMonde`.
- **Le terrain arrête les corps case par case** (eau profonde, roche) et **les monstres
  contournent** (`src/core/parcours.ts`, un champ de directions vers l'église recalculé à la
  pose, suivi seulement quand la ligne droite est coupée).
- **La forteresse complète** (bloc 7b + retour du 20 septembre) : murs, tours, portes et
  douves jusque **dans le haut-fond**, jetée du générateur jusqu'à la mer, la plage qui ne
  porte pas un pan ; **un village sur deux naît avec ses douves et ses ponts-levis** ; on ne
  se noie pas sans passage (la douve en eau qui fermerait tout est refusée, sauf contre une
  porte) ; pont-levis levé visible ; tours de 24 px ; rues pavées dans la place ; maisons
  plus nombreuses et serrées (16 à 20).
- **Les héros et les monstres en low-poly Blender** : héros aux cinq paliers, six monstres,
  rendus par `npm run persos`, livrés dans `src/assets/<famille>-planche.png`, découpés par
  le four. Le code reste le secours de toute planche absente ou au mauvais compte de frames.
  **Les villageois, c'est le chantier du §0.**
- Le reste du monde en low-poly Blender (bâtiments, décor), le sol en facettes, la
  cinématique et le son de l'écran-titre, la musique en partie, treize bruits, les chemins
  qui s'usent, les détails de vie, l'eau qui noie.
- En dessous, un noyau de règles pur (`src/core/`) couvert par **595 tests**.

## 2. Avant TOUT, tu lis — et tu ne codes pas encore

- `SUITE.md` : l'état complet, les pièges connus, et « Tout de suite ».
- `DESIGN.md` (le sommaire), puis dans `design/` : `4.29-le-nouveau-depart.md` (**« Codé le
  20 septembre 2026 »** en bas : ce qui est fait et ce qui reste), `05-ordre-de-construction.md`
  (l'ordre des blocs), `06-questions-ouvertes.md` (**le grand dépouillage du 9 septembre** en
  tête, et **les deux sections du 20 septembre** tout en bas), et **`4.17-tenir-la-fluidite.md`
  — ses cinq règles ne se négocient pas**.
- `README.md` pour la structure et les commandes.
- L'état de git : `git log --oneline -10` et `git status`.
- ⚠️ **La fin de chaque fichier de `design/`, et `design/a-faire.md`** : je colle mes idées en
  vrac tout en bas, sans les mettre en forme, et parfois sans le dire. Va les chercher.
- Les scripts qui te servent à voir : `npx tsx scripts/capturer-mondes.ts 0,1,2` (le monde
  entier, le village, une porte, pour des graines ; 0 est le classique),
  `npx tsx scripts/verifier-douves.ts` (quatre scénarios de douves dans le navigateur),
  `npx tsx scripts/capturer-villages.ts`, `npm run persos -- <filtre>` (Blender). Les captures
  vont dans `captures/<type>/<date>-<sujet>/`, jamais en vrac.
- ⚠️ Pièges connus des scripts : une **fiche d'arrivant** peut s'ouvrir pendant un test et
  mettre la partie en pause (pose `prochaineArriveeJournee = 9_999` sur la scène) ; sous
  `tsx`, pas de fonction nommée dans un `page.evaluate` (`__name`) ; les scripts jetables
  vont dans `.tmp/` (ignoré par git), pas dans le scratchpad ; un rendu Blender long se lance
  en tâche de fond et se surveille dans son fichier de log, jamais en bloquant.

## 3. Ce qui reste à coder

Dans l'ordre où je te le suggère ; c'est à moi de trancher l'ordre, propose-le-moi.

### A. Finir le chantier en cours, puis juger (une session)

1. **Les villageois Blender** : le §0 ci-dessus.
2. **Les mondes tirés** : `captures/jeu/2026-09-20-mondes-2/` (murs dans l'eau, rues pavées,
   maisons serrées, héros Blender) et `2026-09-20-douves-2/` (anneau en eau, meute la nuit
   devant les ponts levés, lac contourné). Ce que j'ai pu dire et qui n'est pas encore fait
   se règle là.
3. **Jouer une vraie partie longue** sur un monde tiré : le stress, l'église, le port, les
   arrivées, la folie, les douves et les ponts-levis la nuit n'ont jamais tourné assez
   longtemps pour être jugés. Les dettes connues sont en bas de `SUITE.md`.

### B. La deuxième moitié du jalon 5.5 (§4.29) — le gros chantier

Le §4.29 est **le mode principal et le seul**. La moitié faite : un héros, un monde tiré,
on tombe où le sort veut. La moitié qui reste, **découpée en blocs courts** que je valide un
par un :

4. ✅ **La zone jouable en paramètre** (20 septembre au soir) : `MONDE` est une façade,
   `TAILLE_JOUABLE` vaut **×2**, mesuré — c'est la peinture de la carte qui plafonne.
4bis. ✅ **La marche** (20 septembre, tard) : on paraît par le bord le plus loin, un cap en une
   phrase, la caméra dézoome seule, rien du Protecteur ne tourne, **quelqu'un vient poser sa
   question à la porte**, accepter installe, refuser ou passer au large mène au monde suivant.
4ter. ✅ **Le refus qui se paie** (20 septembre, tard) : un refus **en face** se tire sur la
   graine du monde et peut faire que le village entier se jette sur nous — il se vide, chacun
   repasse en face avec son visage et son nom, et ils sortent **par la porte** ; tout ce qu'on
   tue donne de l'**or** et de l'XP sans tuer le port ; les deux traits *Miséricordieux* /
   *Bourreau d'hommes* remontent du jalon 8. **Passer au large reste gratuit.**
   ⚠️ **Manque assumé** : l'errance n'est **pas continue** — chaque village est un monde qu'on
   recommence, tant que la carte se peint d'un seul bloc.
5. **Le village qu'on choisit** : un village **déjà peuplé** (le générateur pose déjà douves
   et ponts-levis, il lui manque les gens et les stocks) ; **le monde se fige** quand on
   s'installe (`TAILLE_JOUABLE` existe, rien ne la pose encore). Ce qu'on voit de loin et ce
   qu'on nous cache est déjà tenu par `core/marche.ts`.
6. **Le budget cadeaux / menaces** : un seul nombre, une seule table, annoncé en une phrase
   avant d'entrer ; les fronts de un à quatre (la presqu'île à un seul front n'est jamais
   tirée aujourd'hui : à ajouter au générateur).
7. **Ce que le monde tiré a laissé ouvert** : la forêt ne ferme pas un flanc (les monstres
   marchent dans les arbres, seules la roche et l'eau profonde arrêtent) — décider si les bois
   denses arrêtent ; le port sur un lac (le navire y accoste faute de mieux).

### C. Le jalon 5, ses derniers blocs (`design/05-ordre-de-construction.md`)

8. **Bloc 8 — les ordres pour tous** (§4.4) : n'importe qui fait n'importe quoi, sélection
   puis menu d'ordres ; un héros au travail produit beaucoup plus vite, seulement le jour,
   et ça le fatigue. Le chantier qui occupe un bâtisseur (reste du 7b) va là.
9. **Bloc 9 — le village armé** (§4.18) : entraînement, milicien, et surtout **la seule
   source de héros du jeu** depuis le §4.29 : on ne devient pas héros par l'usure, on **naît
   avec un don** (1 habitant sur 10, 1 don sur 20 majeur). Le centre d'apprentissage est un
   bâtiment neuf. Relis le §4.18, le §4.1 et le §4.29 avant de le découper — c'est ce bloc
   qui réveille les ordres, les formations et l'IA de repli, endormis depuis le 20 septembre.
10. **Bloc 10 — le confort** (§4.10) : la pause Échap, les touches remappables, le panneau
    des volumes (`PanneauSon` existe).

### D. Écrit, pas codé

11. **§4.25** tags, fusions et synergies ; **§4.26** la mémoire du village ; **§4.27** la vie
    autonome ; le **jalon 6.5** (les builds).
12. Les **jalons 6 à 12** (`SUITE.md`, « Jalons suivants ») : le ciel et les catastrophes
    (l'incendie est tranché au §4.21), les défenses qui tirent, la restauration, la narration,
    **la défaite et le retour du héros en antagoniste** (§4.12), le leaderboard.

## 4. Puis tu me fais l'état des lieux, et tu t'arrêtes

Une fois le §0 fini et commité, dis-moi **où on en est exactement** : ce qui **tourne
vraiment**, ce qui est **écrit mais pas codé**, et ce que tu as trouvé **en vrac au bas des
fichiers de design**. Puis propose-moi le **premier morceau**, ce qu'il contient, et ce qui
te manque pour le faire.

## 5. Comment je veux qu'on travaille

- **Les décisions d'abord, groupées** : des questions **à choix** (jamais ouvertes), posées
  d'un coup **avant** de coder, par paquets de quatre. Pendant le travail, tu ne m'interromps
  plus. Tout chiffre technique défendable, tu le tranches toi-même et tu me le dis.
- **Des morceaux courts**, que je valide un par un. Je ne veux pas découvrir le résultat au
  bout de trois heures.
- **Le visuel se juge sur image** : tu fabriques, tu regardes toi-même la capture, tu
  corriges ce qui est raté, **puis** tu me montres (`captures/`, rangé par type et par date).
  Le son se juge à l'oreille, pareil.
- **Ma dernière décision fait foi**, même quand elle contredit le design : tu signales la
  contradiction une fois, avec ce qu'elle coûte, puis tu réécris le paragraphe périmé.
- **On ne jette jamais `src/core/`** : une règle qui change devient une modification du
  noyau plus ses tests. Les tests restent verts. **La graine zéro reste la carte d'avant.**
- **Tout ce qui se voit passe par Blender** (`scripts/blender/`), le code dessiné n'est plus
  qu'un secours ; un PNG dans `src/assets/` remplace le dessin sous la même clé.
- À la fin de chaque morceau : typecheck, tests, commit poussé (un seul par chantier, sans
  trailer d'outil), `SUITE.md` et la section du design à jour, et le journal de portfolio.
