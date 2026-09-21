# Prompt de reprise — ce qui reste à coder (21 septembre 2026)

> Colle tout ce qui suit dans une nouvelle session, à la racine du projet.
>
> Écrit après **le jalon 5.6 fini** : les **trouvailles de la route** (§4.31) sont codées en
> entier — les caches et leur camp de bêtes, le survivant qui traverse les mondes avec nous,
> la stèle qui grave un trait. Avant lui, le **jalon 5.5** avait posé un seul héros, un monde
> tiré par graine, la marche, le refus qui se paie, le village déjà peuplé, le budget
> cadeaux/menaces, la carte qui se peint par morceaux, la zone ×3 et l'errance continue.
>
> **Le dernier morceau d'architecture du projet est derrière nous, et l'errance est finie.**
> Ce qui reste, ce sont les **derniers blocs du jalon 5** : la session qui prend la suite a
> surtout à construire, et le design est écrit et tranché.

---

Tu reprends **Le Protecteur**, mon jeu en cours. C'est mon premier jeu, je ne suis pas
développeur : je décide du design, tu construis, et tu me dis franchement quand une idée
coûte cher ou casse quelque chose.

## 1. Où on en est

**Ce qui tourne vraiment**, de bout en bout d'une partie :

- **Le combat** : sept classes, auto-attaque, ultimes, compétences et évolutions, IA des
  héros, règle des 20 %, mort définitive, monstres par archétypes et par vagues.
- **Le village vivant** : cycle jour/nuit (10 min de jour, 5 de nuit), hordes, habitants et
  métiers, faim, église à quatre niveaux, traits / stress / états / séquelles, la porte et ses
  arrivants, le port et le commerce, les survivants à ramener, le journal, le mode
  d'aménagement, les murs, les tours, les portes, les douves et les ponts-levis.
- **Le monde** : une graine, un monde (mer sur un bord ou absente, chaîne / massif / piton,
  lacs, bois, village posé au sort, postes cherchés sur le terrain, fronts de 1 à 4). La
  **graine zéro** rend la carte d'avant, au chiffre près.
- **L'errance** (§4.29, fini) : on paraît seul par le bord le plus loin, un cap en une
  phrase, la caméra dézoome seule **la première fois seulement**, rien du Protecteur ne
  tourne tant qu'on marche ; à dix cases d'une porte un habitant vient poser sa question ;
  accepter fait commencer le jour 1, refuser en face peut faire que le village entier se
  jette sur nous. **Refuser éloigne vraiment le suivant** : on traverse un, puis trois, puis
  sept **mondes muets** — le même village, mais toutes les maisons en ruine et personne
  dehors. Entre deux mondes, un voile de 220 ms.
- **Les trouvailles de la route** (§4.31, fini) : sept **caches** par monde muet (coffre
  défoncé, trappe de cave, charrette éventrée), l'**or** qui traverse les mondes et la
  **matière** qui devient les réserves du jour où l'on s'installe ; la fouille qui prend
  1,2 s et s'interrompt si l'on encaisse ; un **camp de bêtes** sur les grosses, qui garde
  son terrain et qu'on peut fuir ; un **survivant** un monde sur trois, qui traverse avec
  nous (trois au plus) et devient habitant à l'installation ; une **stèle** un monde sur
  cinq, qui annonce son trait avant qu'on le prenne — six traits écrits pour elle.
- **Le visuel** : tout est dessiné, les personnages viennent de **Blender** (121 planches),
  l'écran-titre est une cinématique Blender avec sa bande-son. **La carte se peint par
  morceaux**, image par image, au plus près du héros : une partie s'ouvre en une demi-seconde
  sur une zone de 3 464 × 2 598.

**Les chiffres** : 703 tests verts, `npm run build` propre, ~47 000 lignes de TypeScript.

## 2. Avant TOUT, tu lis — et tu ne codes pas encore

1. `DESIGN.md` (le sommaire) puis, dans `design/` : **§5** (l'ordre de construction), **§6**
   (les questions tranchées), **§4.17** (tenir la fluidité : ses cinq règles ne se négocient
   pas), et **§4.32** (les portails et le donjon, la seule section neuve encore non codée).
   Le **§4.31** est codé : sa fin dit ce que le code fait vraiment, chiffres compris.
2. `SUITE.md` — le journal de bord technique, chantier par chantier, avec les pièges déjà
   rencontrés. **Lis au moins les cinq dernières sections.**
3. `README.md` — comment lancer, la structure du code, ce que fait chaque fichier du noyau.
4. **Le bas des fichiers de design** : j'y colle mes idées en vrac (`design/a-faire.md`,
   section « Nouvelles notes »). Va les chercher avant de proposer quoi que ce soit.

## 3. Ce qui reste à coder

### A. Le jalon 5, ses derniers blocs (`design/05-ordre-de-construction.md`)

**C'est par là qu'il faut reprendre.** Le jalon 5.6 est fini ; les blocs ci-dessous sont ce
qui reste du jalon 5 lui-même, et le bloc 9 est le plus important des quatre.

5. **Bloc 8 — les ordres pour tous** (§4.4) : n'importe qui fait n'importe quoi, sélection
   puis menu d'ordres ; un héros au travail produit beaucoup plus vite, seulement le jour, et
   ça le fatigue. Le chantier qui occupe un bâtisseur (reste du 7b) va là.
6. **Bloc 9 — le village armé** (§4.18) : l'entraînement, le métier de **milicien**, et
   surtout **la seule source de héros du jeu** depuis le §4.29 : on ne devient pas héros par
   l'usure, on **naît avec un don** (1 habitant sur 10, 1 don sur 20 majeur). Le **centre
   d'apprentissage** est un bâtiment neuf. ⚠️ C'est ce bloc qui **réveille** les ordres, les
   formations, les postures, l'IA de repli et l'expérience de groupe, endormis depuis qu'on
   commence à un seul héros.
7. **Bloc 10 — le confort** (§4.10, §4.11) : pause Échap, touches remappables, panneau des
   volumes (`PanneauSon` existe), et **le rendu à la définition de l'écran**.
8. **Blocs 11 et 12** — la mémoire du village (§4.26) et la vie autonome (§4.27). Ce sont les
   deux seuls blocs dont l'absence ne casse rien.

### B. Les jalons suivants, écrits et pas codés

9. **Jalon 6** — le ciel : pluie, orages, **incendies**, météores, carte modifiable (§4.21).
10. **Jalon 6.5** — les builds (§4.25) : tags, 36 compétences neuves, 26 fusions, synergies.
    **C'est le plus gros volume de contenu du projet.**
11. **Jalon 6.7** — le moral devient une arme (§4.23, §4.13, §4.10).
12. **Jalons 7 à 12** — les défenses qui tirent (§4.7), la restauration et les pillards
    (§4.18), les rangs et les classes rares (§4.1), la narration, la défaite et le retour du
    héros en antagoniste (§4.12), le leaderboard (§4.9).
13. **Jalon 13 — les portails et le donjon** (§4.32) : un portail très rare qui s'ouvre sans
    prévenir, un labyrinthe tiré au sort, des ennemis, des caches, des stèles de compétence.
    ⚠️ **Il passe après les blocs 9 et 12** : ce qui rend un portail intéressant, c'est le
    village qu'on laisse vivre seul pendant qu'on y est.

### C. Les dettes connues, petites

- Les deux dernières frames de la mort du golem et de la brute sortent de cinq pixels sous
  leur cadre (les pattes, pas le corps).
- Le panneau ORDRES affiche « toute l'équipe (0) » alors qu'on joue un seul héros : il
  redeviendra juste au bloc 9.
- Un village pose **six maisons en moyenne** (jamais plus de quatorze) là où le code en vise
  seize à vingt : c'est pour ça qu'une maison loge une famille de quatre.
- La forêt ne ferme pas un flanc (les monstres marchent dans les arbres) : à décider.
- Le port peut se poser sur un lac, faute de mieux.
- À ×3, **le milieu de la carte est une grande plaine verte**. Le décor suit bien la surface
  (il se compte par mégapixel), mais la géographie n'a rien à y mettre. À juger en jouant :
  c'est peut-être exactement ce que « de longues minutes de plaine vide » veut dire. Le jalon
  5.6 y a mis quelque chose à trouver — reste à savoir si ça suffit.

## 4. Par quoi je te demande de commencer

**Le bloc 8 puis le bloc 9** (§4.4, §4.18). Le bloc 9 est le plus lourd et le plus
important : c'est **la seule source de héros du jeu** depuis le §4.29, et c'est lui qui
réveille les ordres, les formations, les postures, l'IA de repli et l'expérience de groupe —
tous endormis depuis qu'on commence à un seul héros.

Découpe-le en morceaux courts que je valide un par un, et **montre-moi des captures**.

Avant de coder : dis-moi ce que tu as compris, ce que tu comptes faire en premier, et pose
d'un coup les décisions qui te manquent.

## 5. Comment je veux qu'on travaille

- **Les décisions d'abord, groupées** : des questions **à choix** (jamais ouvertes), posées
  d'un coup **avant** de coder, par paquets de quatre. Pendant le travail, tu ne m'interromps
  plus. Tout chiffre technique défendable, tu le tranches toi-même et tu me le dis.
- **Des morceaux courts**, que je valide un par un. Je ne veux pas découvrir le résultat au
  bout de trois heures.
- **Le visuel se juge sur image** : tu fabriques, tu regardes toi-même la capture, tu
  corriges ce qui est raté, **puis** tu me montres (`captures/`, rangé par type et par date).
  Le son se juge à l'oreille, pareil.
- **Ce qui bouge se vérifie dans le navigateur**, pas seulement en tests unitaires : un script
  Playwright jetable dans `.tmp/` qui pilote une vraie partie et compte ses contrôles. ⚠️ Le
  monde est **tiré au sort** à chaque lancement : lance-le **trois fois** avant de dire qu'il
  passe. (`graineMonde: N` rejoue un monde précis, `sansLaMarche: true` commence installé,
  `refus: N` et `mondesMuets: N` placent l'errance où tu veux, `argent`, `butinDeLaRoute` et
  `compagnons` remplissent la bourse, le sac et la troupe.)
- **Quatre pièges du navigateur, payés au jalon 5.6** et qui resserviront : `camera.worldView`
  n'est recalculé qu'au rendu **suivant** (lire `scrollX`/`scrollY` après un `centerOn`) ; la
  caméra est **bornée** par la carte, donc `removeBounds()` le temps d'un contrôle ; pousser
  le héros « loin » le fait **changer de monde** (`guetterLeDepart` voit le bord) ; et en
  rendu logiciel tout ce qui est minuté s'étire d'un facteur quatre — on mesure les **écarts**
  et les **vitesses**, jamais les distances parcourues.
- **Mesure avec un témoin.** Un « c'est plus rapide » sans chiffre d'avant ne vaut rien : le
  20 septembre, la vraie référence a été obtenue en **remettant l'ancien code en place** pour
  le mesurer. Et en rendu logiciel (headless), tout ce qui est minuté s'étire d'un facteur
  quatre : les **écarts** sont vrais, les **valeurs absolues** non.
- **Ma dernière décision fait foi**, même quand elle contredit le design : tu signales la
  contradiction une fois, avec ce qu'elle coûte, puis tu réécris le paragraphe périmé.
- **On ne jette jamais `src/core/`** : une règle qui change devient une modification du
  noyau plus ses tests. Les tests restent verts. **La graine zéro reste la carte d'avant.**
- **Tout ce qui se voit passe par Blender** (`scripts/blender/`), le code dessiné n'est plus
  qu'un secours ; un PNG dans `src/assets/` remplace le dessin sous la même clé.
- À la fin de chaque morceau : typecheck, tests, commit poussé (un seul par chantier, sans
  trailer d'outil), `SUITE.md` et la section du design à jour, et le journal de portfolio.

## 6. Pour lancer

```bash
npm install
npm run dev      # le jeu s'ouvre dans le navigateur
npx vitest run   # les tests (675)
npm run build    # vérifie les types et construit

npx tsx scripts/capturer.ts apres          # les captures du jeu, par Playwright
npx tsx scripts/capturer-mondes.ts 0,1,2   # plusieurs mondes tirés
npx tsx scripts/planche.ts                 # les planches PNG, sans navigateur
npm run intro                              # refait la cinématique Blender
npm run son                                # refait la bande-son
```
