# Prompt de reprise — ce qui reste à coder (20 septembre 2026)

> Colle tout ce qui suit dans une nouvelle session, à la racine du projet.
>
> Écrit le 19 septembre 2026, après le bloc 7a (maisons destructibles, village en ruines) et
> le son de l'écran-titre. **Le design est écrit et tranché** (le grand dépouillage du
> 9 septembre a fermé toutes les questions ouvertes) : la session qui prend la suite a
> surtout à construire, et à ne demander que ce que le design ne dit pas.

---

Tu reprends **Le Protecteur**, mon jeu en cours. C'est mon premier jeu, je ne suis pas
développeur : je décide du design, tu construis, et tu me dis franchement quand une idée
coûte cher ou casse quelque chose.

## 1. Où on en est

Ce qui tourne vraiment, et qui est récent :

- **Le monde en low-poly Blender** (bâtiments, décor, ruine de maison) et un sol en facettes
  de relief (18 septembre).
- **Le générateur de villages par graine** : forme, enceinte, tours, portes, brèches,
  12 à 15 maisons serrées autour de la place (validé le 18-19 septembre).
- **Le bloc 7a** (19 septembre) : les maisons ont un corps et 200 PV, le village démarre en
  ruines (trois maisons debout près de l'église), bâtir / relever (L) / démolir (clic droit) /
  déplacer, 40 % des monstres pillent les maisons, survol qui nomme ce qu'on pointe, les
  pauses gèlent les animations, sauvegarde des maisons rétro-compatible.
- **L'écran-titre** : cinématique Blender (9 s + boucle), puis **du son** (19 septembre) —
  vent, feu, cris au loin, glas, et la **musique de guerre** (« Lament of the War ») qui
  boucle sans couture ; écran « clic ou touche pour entrer » quand le navigateur bloque le
  son ; haut-parleur et touche M ; **PARAMÈTRES** règle trois volumes (musique, ambiance,
  effets), retenus d'une visite à l'autre.
- **La musique en partie** (19 septembre, au soir) : la calme le jour (« Lament for a
  Warrior's Soul », choisie à l'oreille), la guerre toute la nuit et dès qu'un héros se bat,
  en fondu enchaîné à puissance constante ; les fondus s'écoutent dans
  `captures/son/2026-09-19-musiques/partie-*.mp3`.
- **Les restes du dépouillage** (19 septembre, au soir) : deux cases, seuil de 65 habitants
  (hordes continues au-delà), quatre actives (oublier ou acheter un emplacement), paliers de
  mur et de porte bois → fer segment par segment (la pierre attend le bloc 7b).
- **Le sol du village** (19 septembre, au soir) : la place en terre battue, les rues vers les
  lieux de travail, le parvis pavé, peints dans la carte cuite ; captures dans
  `captures/jeu/2026-09-19-sol-du-village/`.
- **L'eau qui noie** (19 septembre, au soir) : seul le héros incarné entre dans l'eau, il
  s'y enfonce et ralentit, une bulle prévient, et trois secondes de mer le noient.
- **Les chemins qui s'usent** (20 septembre, après minuit) : un passage par case et par
  marcheur (habitants et héros), visible à 30, pâlit chaque aube sans passage, effacé à la
  quatrième ; peints dans une couche transparente au-dessus de la carte ; sauvés. Captures
  dans `captures/jeu/2026-09-20-chemins/`, **à juger**.
- En dessous, un noyau de règles pur (`src/core/`) couvert par **544 tests**.

## 2. Avant TOUT, tu lis — et tu ne codes pas encore

- `SUITE.md` : l'état complet, section par section, les pièges connus, et « Tout de suite ».
- `DESIGN.md` (le sommaire), puis dans `design/` : `05-ordre-de-construction.md` (l'ordre des
  blocs), `06-questions-ouvertes.md` (**« Le grand dépouillage du 9 septembre 2026 »** en tête :
  c'est là que sont les décisions les plus récentes), et **`4.17-tenir-la-fluidite.md` — ses
  cinq règles ne se négocient pas**.
- Les sections des blocs que tu vas toucher (voir la liste plus bas).
- `README.md` pour la structure et les commandes.
- L'état de git : `git log --oneline -10` et `git status`.
- ⚠️ **La fin de chaque fichier de `design/`, et `design/a-faire.md`** : je colle mes idées en
  vrac tout en bas, sans les mettre en forme, et parfois sans le dire. Va les chercher.

## 3. Ce qui reste à coder

Dans l'ordre où je te le suggère ; c'est à moi de trancher l'ordre, propose-le-moi.

### A. Les petits restes (une session chacun, au plus)

1. ✅ **Appliquer ce que le dépouillage du 9 septembre a tranché** — fait le 19 septembre au
   soir (`SUITE.md`, « Les restes du dépouillage ») : deux cases, seuil de 65, quatre actives
   (oublier ou acheter ; la fusion attend le jalon 6.5), paliers bois → fer pour le mur et la
   porte. Reste de ce point : **la pierre**, avec sa ressource, au bloc 7b.
2. ✅ **Le sol du village** — place, rues, parvis et détails de vie (puits, tonneaux, tas de
   bois, charrette, en sprites Blender) le 19 septembre au soir, jugés sur captures. ✅ **Les
   chemins qui s'usent** le 20 septembre (`SUITE.md`, « Les chemins qui s'usent »). Restent
   les cordes à linge, les filets et le feu (trois objets Blender de plus dans
   `scripts/blender/monde.py`, posés par `poserLesDetailsDeVie`).
3. ✅ **L'eau qui noie** — fait le 19 septembre au soir (`SUITE.md`, « L'eau qui noie »).
   Les ronds de poste sont partis le 18 septembre ; reste ce qui devait les remplacer — la
   mine, le ponton et les bûches qui disent eux-mêmes où l'on travaille.

### B. Le son, phase 2

Tout le socle existe (`src/game/son.ts`, `src/game/panneauSon.ts`, `scripts/son/`,
`npm run son`) ; voir `SUITE.md`, « Le son de l'écran-titre », et le §4.10, « Le son ».

4. ✅ **La musique en partie** — fait le 19 septembre au soir (`SUITE.md`, « La musique en
   partie ») : calme le jour, guerre toute la nuit et dès qu'un héros se bat, 15 s de maintien
   après le dernier coup, fondus à puissance constante (guerre 3 s, calme 6 s). Reste à
   **juger à l'oreille** les trois `partie-*.mp3` — en particulier `partie-crepuscule.mp3`
   (la guerre part de son intro) contre `partie-crepuscule-sans-intro.mp3` (une ligne à
   changer dans `src/game/musique.ts` si elle plaît mieux).
5. **Les bruits de la partie**, branchés sur les **événements nommés** que les animations
   émettent déjà (coup de pioche, hache, toux, semis, chute d'arbre) ; puis les coups, les
   morts, les cris des villageois et des monstres (le §4.23 prévoit que les monstres
   **hurlent** et que le **Cri** du Chevalier Sacré leur répond). Sources : **CC0 seulement**,
   et **lis le `robots.txt` de chaque site** avant de télécharger (OpenGameArt et Kenney
   oui ; Freesound et BigSoundBank interdisent les robots). Ce qui n'existe pas en CC0 se
   fabrique (`scripts/son/synthese.ts`).
6. ⚠️ **Tu ne peux pas écouter** : règle les niveaux sur mesures (niveaux par demi-seconde,
   spectres), et fais-moi des **fichiers d'écoute** dans `captures/son/` pour que je juge à
   l'oreille.

### C. Le jalon 5, ses derniers blocs (`design/05-ordre-de-construction.md`)

7. **Bloc 7b — la forteresse** (§4.20, §4.7) : murs améliorables au fer, **portes qui
   s'ouvrent et se ferment** (et qu'on ne peut pas ne pas avoir), autant d'enceintes qu'on en
   bâtit, douves, douves en eau, pont-levis.
8. **Bloc 8 — les ordres pour tous** (§4.4) : n'importe qui fait n'importe quoi, sélection
   puis menu d'ordres ; un héros au travail produit beaucoup plus vite, seulement le jour,
   et ça le fatigue.
9. **Bloc 9 — le village armé** (§4.18) : entraînement, métier de milicien. ⚠️ **Le
   dépouillage du 9 septembre a changé ce bloc** : on ne devient plus héros par l'usure, on
   **naît avec un don** (1 habitant sur 10, 1 don sur 20 majeur). Relis le §4.18 et le §4.1
   avant de le découper.
10. **Bloc 10 — le confort** (§4.10, « Le menu d'options ») : la **pause Échap**, les
    **touches remappables** (toutes), et le panneau des volumes — `PanneauSon` existe déjà,
    il n'y a qu'à le réutiliser.

### D. Le gros chantier

11. **Le §4.29 — le nouveau départ**, devenu **le mode principal et le seul** : un héros
    seul, l'errance, puis un village aléatoire déjà peuplé qu'on choisit. C'est le plus gros
    morceau restant du projet : **découpe-le en blocs courts** que je valide un par un.

### E. Écrit, pas codé

12. Les sections de la deuxième vague de design (10 août) : **§4.25** tags, fusions et
    synergies ; **§4.26** la mémoire du village (relations, souvenirs, légendes) ; **§4.27**
    la vie autonome ; et le **jalon 6.5** (les builds).
13. Puis les **jalons 6 à 12** (`SUITE.md`, « Jalons suivants ») : le ciel et les
    catastrophes, les défenses qui tirent, la restauration, le recrutement, la narration,
    **la défaite et le retour du héros en antagoniste** (le plus important, §4.12), le
    leaderboard.

### F. Et entre deux blocs : jouer

14. **Jouer une vraie partie longue.** Le stress, l'église, le port, les arrivées et la folie
    n'ont jamais tourné assez longtemps pour être jugés ; tous les chiffres du dépouillage
    sont faits pour être corrigés là. Les dettes connues sont en bas de `SUITE.md` (défenseurs
    civils qui meurent en deux coups, combinaison Écho + Capacités affinées + Danse des
    ombres jamais vérifiée, martyre qui ne déclenche pas `tomber()`).

## 4. Puis tu me fais l'état des lieux, et tu t'arrêtes

Avant d'écrire une ligne de code, dis-moi **où on en est exactement** : ce qui **tourne
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
  noyau plus ses tests. Les tests restent verts.
- À la fin de chaque morceau : typecheck, tests, commit poussé, `SUITE.md` et la section du
  design à jour, et le journal de portfolio.
