# Prompt de reprise — ce qui reste à coder (20 septembre 2026, dans la nuit)

> Colle tout ce qui suit dans une nouvelle session, à la racine du projet.
>
> Écrit après **le jalon 5.5 fini, à un morceau près** : un seul héros, un monde tiré par
> graine, **la marche**, **le refus qui se paie**, **le village déjà peuplé** (1 à 20
> habitants), **le budget cadeaux/menaces**, **la zone jouable ×2** et **la presqu'île à un
> front**. Il ne reste que **l'errance continue**, le seul chantier d'architecture du
> projet. **Le design est écrit et tranché** — le grand dépouillage du 9 septembre a fermé
> toutes les questions ouvertes : la session qui prend la suite a surtout à construire, et à
> ne demander que ce que le design ne dit pas.

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
  arrivants (six indices, trois degrés de folie), le port et le commerce, les survivants à
  ramener, le journal, le mode d'aménagement, les murs, les tours, les portes, les douves et
  les ponts-levis.
- **Le monde** : une graine, un monde (mer sur un bord ou absente, chaîne / massif / piton,
  lacs, bois, village posé au sort près d'une eau, postes cherchés sur le terrain, fronts de
  1 à 4). La **graine zéro** rend la carte d'avant, au chiffre près.
- **Le début d'une partie** (§4.29) : on paraît seul par le bord le plus loin, un cap en une
  phrase, la caméra dézoome seule, **rien du Protecteur ne tourne** tant qu'on marche ; à dix
  cases d'une porte un habitant vient poser sa question ; accepter fait commencer le jour 1,
  refuser **en face** peut faire que le village entier se jette sur nous, passer au large ne
  coûte rien. Tout ce qu'on tue donne de l'or et de l'expérience.
- **Le village qu'on trouve** (§4.29) : **de 1 à 20 habitants** tirés de sa graine, leurs
  métiers, leurs réserves en jours de vivres, un toit debout par foyer de quatre — et un
  **budget** qui compte sur une seule échelle tout ce que le monde offre, et le fait payer en
  monstres plus nombreux, plus forts, et en malades qu'on découvre une fois installé. La
  phrase s'annonce avant d'entrer, à part, sur le panneau de la question. La zone jouable fait
  **deux fois la carte** (2828 × 2121) et la **presqu'île à un front** existe.
- **Le visuel** : tout est dessiné — personnages, bâtiments, décor, murs, sol, mer — et les
  personnages viennent de **Blender** (121 planches). L'écran-titre est une cinématique
  Blender avec sa bande-son.

**Les chiffres** : 666 tests verts, `npm run build` propre, ~45 000 lignes de TypeScript.

## 2. Avant TOUT, tu lis — et tu ne codes pas encore

1. `DESIGN.md` (le sommaire) puis, dans `design/` : **§4.29** (le nouveau départ — c'est le
   chantier en cours, lis ses quatre sections « Codé le… » en entier), **§5** (l'ordre de
   construction), **§6** (les questions tranchées), **§4.17** (tenir la fluidité : ses cinq
   règles ne se négocient pas).
2. `SUITE.md` — le journal de bord technique, chantier par chantier, avec les pièges déjà
   rencontrés. **Lis au moins les cinq dernières sections.**
3. `README.md` — comment lancer, la structure du code, ce que fait chaque fichier du noyau.
4. **Le bas des fichiers de design** : j'y colle mes idées en vrac (`design/a-faire.md`,
   section « Nouvelles notes »). Va les chercher avant de proposer quoi que ce soit.

## 3. Ce qui reste à coder

### A. Finir le jalon 5.5 (§4.29) — il ne reste qu'un morceau

1. ⚠️ **L'errance continue** — le seul morceau qui reste, et **le seul chantier
   d'architecture du projet**. Le design veut un monde qui se génère **devant** le joueur, à
   l'infini, avec des villages qui s'espacent à chaque refus (le facteur est écrit dans
   `REGLAGES_MARCHE`, pas appliqué). Chaque village est aujourd'hui un monde entier qu'on
   recommence. **La cause est mesurée** : la carte se peint **d'un seul bloc**, et une partie
   s'ouvre en **2,4 à 2,9 s** sur la zone ×2 contre 0,6 s sur la carte classique — c'est ce
   gel-là qu'on paie à chaque village refusé. Tant qu'elle n'est pas peinte **par morceaux**,
   ni l'errance continue ni la zone ×3 ne sont possibles.

> Le reste du jalon est **codé** depuis le 20 septembre au soir : le village déjà peuplé, le
> budget cadeaux/menaces, la zone jouable ×2 et la presqu'île à un front. Le détail est au
> §4.29, dans ses sections « Codé le… », et dans `SUITE.md`.

### B. Le jalon 5, ses derniers blocs (`design/05-ordre-de-construction.md`)

6. **Bloc 8 — les ordres pour tous** (§4.4) : n'importe qui fait n'importe quoi, sélection
   puis menu d'ordres ; un héros au travail produit beaucoup plus vite, seulement le jour, et
   ça le fatigue. Le chantier qui occupe un bâtisseur (reste du 7b) va là.
7. **Bloc 9 — le village armé** (§4.18) : l'entraînement, le métier de **milicien**, et
   surtout **la seule source de héros du jeu** depuis le §4.29 : on ne devient pas héros par
   l'usure, on **naît avec un don** (1 habitant sur 10, 1 don sur 20 majeur). Le **centre
   d'apprentissage** est un bâtiment neuf. ⚠️ C'est ce bloc qui **réveille** les ordres, les
   formations, les postures, l'IA de repli et l'expérience de groupe, endormis depuis qu'on
   commence à un seul héros.
8. **Bloc 10 — le confort** (§4.10, §4.11) : pause Échap, touches remappables, panneau des
   volumes (`PanneauSon` existe), et **le rendu à la définition de l'écran** — le canvas
   dessiné en pixels d'écran et non en points CSS.
9. **Blocs 11 et 12** — la mémoire du village (§4.26) et la vie autonome (§4.27). Ce sont les
   deux seuls blocs dont l'absence ne casse rien : sans eux le jeu tourne, il est juste plus
   froid.

### C. Les jalons suivants, écrits et pas codés

10. **Jalon 6** — le ciel : pluie, orages, **incendies**, météores, carte modifiable (§4.21).
11. **Jalon 6.5** — les builds (§4.25) : tags, 36 compétences neuves, 26 fusions, synergies.
    **C'est le plus gros volume de contenu du projet.**
12. **Jalon 6.7** — le moral devient une arme (§4.23, §4.13, §4.10) : les monstres qui
    hurlent, le **Cri** du Chevalier Sacré, l'étourdissement et ses quatre garde-fous, trois
    traits de naissance de plus, et la **lecture** (traits en laiton/sang séché avec leur
    histoire au survol, dégâts cumulés par compétence).
13. **Jalons 7 à 12** — les défenses qui tirent (§4.7), la restauration et **les pillards**
    (§4.18), les rangs et les classes rares (§4.1), la narration, **la défaite et le retour du
    héros en antagoniste** (§4.12), le leaderboard (§4.9).

### D. Les dettes connues, petites

- Les deux dernières frames de la mort du golem et de la brute sortent de cinq pixels sous
  leur cadre (les pattes, pas le corps).
- Le panneau ORDRES affiche « toute l'équipe (0) » alors qu'on joue un seul héros : il
  redeviendra juste au bloc 9, quand l'équipe existera de nouveau.
- Un village pose **six maisons en moyenne** (jamais plus de quatorze) là où le code en vise
  seize à vingt : c'est pour ça qu'une maison loge une famille de quatre.
- La presqu'île sort **9 fois sur 100** sur la zone jouable, mais **33 fois sur 100** sur la
  carte classique : le taux dépend de la place. C'est la zone jouable qui fait foi.
- La forêt ne ferme pas un flanc (les monstres marchent dans les arbres) : à décider.
- Le port peut se poser sur un lac, faute de mieux.

## 4. Par quoi je te demande de commencer

**L'errance continue**, c'est-à-dire d'abord **peindre la carte par morceaux** : rien
d'autre ne débloque ce chantier, et il débloque aussi la zone ×3. Découpe-le en morceaux
courts que je valide un par un, et **montre-moi des captures**.

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
  passe. (`graineMonde: N` rejoue un monde précis, `sansLaMarche: true` commence installé.)
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
npx vitest run   # les tests (666)
npm run build    # vérifie les types et construit

npx tsx scripts/capturer.ts apres          # les captures du jeu, par Playwright
npx tsx scripts/capturer-mondes.ts 0,1,2   # plusieurs mondes tirés
npx tsx scripts/planche.ts                 # les planches PNG, sans navigateur
npm run intro                              # refait la cinématique Blender
npm run son                                # refait la bande-son
```
