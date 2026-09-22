# Prompt de reprise — ce qui reste à coder (22 septembre 2026, tard)

> Colle tout ce qui suit dans une nouvelle session, à la racine du projet.
>
> Écrit après **le jalon 5 fini**. Les trois derniers blocs sont tombés le même soir : le
> **bloc 10** (la pause Échap, le menu d'options, les 36 touches remappables), le **bloc 11**
> (la mémoire du village — relations, souvenirs, héritage, archives) et le **bloc 12** (la
> vie autonome — la journée sans ordre, les bulles, les six initiatives).
>
> **Le village vivant est complet.** La prochaine chose à coder n'est plus un bloc, c'est un
> jalon — et le premier est **le ciel** (§4.21).

---

Tu reprends **Le Protecteur**, mon jeu en cours. C'est mon premier jeu, je ne suis pas
développeur : je décide du design, tu construis, et tu me dis franchement quand une idée
coûte cher ou casse quelque chose.

## 1. Où on en est

**Ce qui tourne vraiment**, de bout en bout d'une partie :

- **Le combat** : sept classes, auto-attaque, ultimes, compétences et évolutions, IA des
  héros, règle des 20 %, mort définitive, monstres par archétypes et par vagues.
- **Le village vivant** (jalon 5, **fini**) : cycle jour/nuit, hordes, habitants et métiers,
  faim, église à quatre niveaux, traits / stress / états / séquelles, la porte et ses
  arrivants, le port et le commerce, les survivants à ramener, le journal, le mode
  d'aménagement, les murs, les tours, les portes, les douves et les ponts-levis, les ordres
  pour tous, la milice et les dons, **la pause et les touches**, **la mémoire du village**,
  **la vie autonome**.
- **Le monde** : une graine, un monde (mer sur un bord ou absente, chaîne / massif / piton,
  lacs, bois, village posé au sort, postes cherchés sur le terrain, fronts de 1 à 4). La
  **graine zéro** rend la carte d'avant, au chiffre près.
- **L'errance** (§4.29) : on paraît seul par le bord le plus loin, un cap en une phrase, à
  dix cases d'une porte un habitant vient poser sa question ; refuser fait traverser un,
  trois, puis sept **mondes muets**.
- **Les trouvailles de la route** (§4.31) : sept caches par monde muet, l'or qui traverse,
  un camp de bêtes sur les grosses, un survivant un monde sur trois, une stèle un monde sur
  cinq.
- **Le confort** (§4.10, §4.11, bloc 10) : le rendu à la **densité réelle de l'écran**, un
  plancher de 12 px, une interface qui grandit avec la fenêtre. **Échap** referme ce qui est
  ouvert puis met le jeu en **pause** : reprendre, volumes, touches, sauver et quitter,
  abandonner. **36 actions remappables**, qui s'échangent au lieu de se disputer, et une
  ligne d'aide qui lit le mappage.
- **La mémoire du village** (§4.26, bloc 11) : les **relations** par paire (onze types, un
  seul par couple, qui s'usent), les **souvenirs** bornés à huit, ce qu'une mort produit
  (trait, tombe, archives, legs), l'**héritage proposé** à la montée de niveau, et les
  **archives** avec leur récit assemblé — qui ne dit que ce qu'on sait.
- **La vie autonome** (§4.27, bloc 12) : la journée sans ordre, trois habitants réveillés
  par image, les **bulles** dessinées, et **six initiatives** testées sur événement.
- **Le visuel** : tout est dessiné, les personnages viennent de **Blender** (121 planches),
  l'écran-titre est une cinématique Blender avec sa bande-son. La carte se peint par
  morceaux : une partie s'ouvre en une demi-seconde sur une zone de 3 464 × 2 598.

**Les chiffres** : 944 tests verts, `npm run build` propre, ~50 000 lignes de TypeScript.

## 2. Avant TOUT, tu lis — et tu ne codes pas encore

1. `DESIGN.md` (le sommaire) puis, dans `design/` : **§5** (l'ordre de construction), **§6**
   (les questions tranchées), **§4.17** (tenir la fluidité : ses cinq règles ne se négocient
   pas), et **§4.33** (la horde, le prochain jalon). Le **§4.21** (le ciel) vient d'être
   codé de bout en bout : sa fin dit ce que le code fait vraiment.
2. `SUITE.md` — le journal de bord technique, chantier par chantier, avec les pièges déjà
   rencontrés. **Lis au moins les cinq dernières sections.**
3. `README.md` — comment lancer, la structure du code, ce que fait chaque fichier du noyau.
4. **Le bas des fichiers de design** : j'y colle mes idées en vrac (`design/a-faire.md`,
   section « Nouvelles notes »). Va les chercher avant de proposer quoi que ce soit.

## 3. Ce qui reste à coder

### A. Le jalon 6 — le ciel (§4.21) : **FINI** (22 septembre 2026)

✅ **Ce qui tourne** : la **pluie** (une journée sur trois, tirée à l'aube et à
l'installation, pousse ×2, elle tombe aussi sur la route), l'**orage** (une journée sur
douze, effectif de la nuit ×1,5, deux nuits d'avance en puissance, hordes de jour sans
répit, éclairs), la **crue** (trois journées d'affilée : champs noyés, bâtiments abîmés qui
cèdent, douves qui débordent), les **bêtes d'eau** (Écumeur et Engloutisseur, qui sortent
des berges la nuit de crue), et le **son** (deux averses, deux tonnerres, fabriqués au code,
le tonnerre arrivant après la lumière).

✅ **L'incendie** (l'après-midi du 22) : ce qui allume (monstre sous 30 % de vie une fois
sur deux, Pyromane, fou du degré 3 une nuit sur deux, foudre), ce que ça mange (une maison
en 40 s puis une **ruine à relever**, un champ en 8 s et il n'en reste rien), la propagation
(un voisin toutes les 4 s, à quatre cases entre milieux, deux fois moins sous la pluie), et
l'extinction (**neuf seaux** ; les habitants y vont seuls le jour depuis six cases, un héros
en 5 s, la pluie compte double). Ce qui brûle hors champ se dit par une **ligne de journal**
et un **repère au bord**. Les trois crochets ont servi sans qu'une ligne du ciel ne bouge.

✅ **Les flammes Blender et le son du feu** (le soir) : `feu-flamme-0/1/2` rendues en
low-poly, trois matières neuves dans la palette, et `bruit-feu` — une boucle de 8 s fabriquée
au code, une seule voix, montée et coupée selon la distance.

✅ **Le météore** (le soir) : une nuit sur vingt, une traînée puis **une ombre qui grandit
douze secondes** au sol (elle bat de plus en plus vite et atteint la taille exacte du
cratère). Tombe dans un anneau de 5 à 16 cases autour de l'église. **Tout ce qui est dans le
cratère disparaît sauf l'église** — les maisons laissent une ruine à relever, les monstres
meurent sans donner ni or ni XP. Deux départs de feu autour. Il laisse une **cicatrice
permanente** (écrite dans la carte cuite, elle ne bloque rien) et **120 de fer du ciel**, un
gisement qu'on frappe comme un poste de mine. ⚠️ **La carte n'a pas eu à devenir une grille
modifiable** comme le §4.21 l'annonçait.

✅ **L'incendie se voit** (le soir du 22, après une phrase d'Angelos : « c'est juste une
petite flamme sur un bâtiment ») : un **panache de fumée** de 150 px, rendu en Blender et
calculé entièrement du temps ; **cinq flammes** réparties sur l'emprise, chacune sur sa
phase, dont le nombre suit l'ardeur ; le bâtiment qui **noircit** ; des **braises** ; et la
lueur **éteinte de jour**. Le cœur de la flamme, enfermé dans le maillage du corps depuis son
premier rendu quelques heures plus tôt, est enfin visible. La chaîne Blender accepte maintenant un drapeau **`contour`**, et
la fumée est la seule à le refuser.

**Il ne reste rien du jalon 6.**

### B. Les jalons suivants, écrits et pas codés

**Le prochain est le jalon 6.2, la horde** — c'est celui qu'Angelos a placé juste après le
ciel, et le ciel est fini.

- **Jalon 6.2 — la horde** (§4.33, tranché le 22 septembre 2026) : **vingt mille monstres**.
  Une seule silhouette d'orc — la teinte dit qui c'est, la luminosité dit la vie, le rouge
  dit le coup encaissé, la taille dit le rang ; seuls les gros télégraphent. ⚠️ **Les
  paliers ont été refaits le soir même, après mesure** : le moteur tient déjà 1 200 orcs à
  60 images/s (le plafond de 60 était un choix de lisibilité), le mur est vers 1 600, et au
  mur le budget se partage en logique 39 % / physique 37 % / rendu 24 %. **Palier 0** ✅ le
  garde-fou contre la falaise (un pas de physique par image, delta plafonné à 50 ms) — le
  plafond est passé à **800** dans la foulée. **Palier 1** la grille spatiale et le niveau
  de détail temporel. **Palier 2** le rendu, et la question du rendu maison. ⚠️ **Il passe
  avant le 6.5 et le 6.7** : les builds sont des zones et des chaînes qui frappent la horde,
  le 6.7 des états par monstre — les coder d'abord voudrait dire les coder deux fois.
  **La règle n°2 du §4.17 est annulée par cette section.**
- **Jalon 6.5** — les builds (§4.25) : tags, 36 compétences neuves, 26 fusions, synergies.
  **C'est le plus gros volume de contenu du projet.**
- **Jalon 6.7** — le moral devient une arme (§4.23, §4.13, §4.10).
- **Jalons 7 à 12** — les défenses qui tirent (§4.7), la restauration et les pillards
  (§4.18), les rangs et les classes rares (§4.1), la narration, la défaite et le retour du
  héros en antagoniste (§4.12), le leaderboard (§4.9).
- **Jalon 13 — les portails et le donjon** (§4.32) : ⚠️ **il ne dépend plus de rien.** Le
  bloc 12 vient de tomber, et c'était sa dernière dépendance — ce qui rend un portail
  intéressant, c'est le village qu'on laisse vivre seul pendant qu'on y est.

## 4. Par quoi je te demande de commencer

**La suite du jalon 6.2, la horde.** Le profilage est fait, le §4.33 est réécrit avec ses
chiffres, et le **palier 0** est posé (22 septembre au soir) — lis la section « Le jalon
6.2, palier 0 » de `SUITE.md` avant tout : elle contient les **huit pièges de mesure** déjà
payés, et chacun a faussé au moins une passe.

Dans l'ordre :

1. ✅ **La mesure du rendu en deux branches** (§4.33 §7) : faite. Un Sprite Phaser coûte
   1,2 µs par image (20 000 → 28 images/s rien que pour dessiner), un quad instancié moins
   de 0,03 µs (20 000 → 53-60 images/s). **Le rendu maison est nécessaire**, et son
   prototype existe (`scripts/banc-rendu-page.js`). Angelos a ajouté en voyant les captures :
   **les 20 000 viennent petit à petit** — un flot, jamais un tapis posé d'un coup.
2. **Le palier 1** : une grille spatiale dans `core/` (pure, testée) pour les contacts, les
   dégâts, « le héros le plus proche » et « combien d'ennemis autour », plus un **niveau de
   détail temporel** (un monstre loin du héros ou hors caméra se décide une image sur
   quatre). Mesure avant/après avec `scripts/banc-horde.ts`, sur le même monde.
3. ⚠️ **Le palier 2 ne commence pas avant qu'Angelos ait vu les captures à 800**
   (`captures/jeu/2026-09-22-horde-800/`). Le chiffre qui compte n'est pas celui qui tient à
   60 images par seconde, c'est celui qui reste lisible.

Toute mesure se fait **sur la vraie carte graphique**, sans fenêtre
(`--use-angle=d3d11`), et **sur le même monde** que son témoin.

**Ce qu'il n'a pas voulu faire d'abord** : jouer pour régler les chiffres. Ils attendent —
voir §7.

Découpe en morceaux courts que je valide un par un, et **montre-moi des captures**.

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

## 6. Six pièges du navigateur, déjà payés

Ils reserviront, et ils ont tous coûté une session :

1. `camera.worldView` n'est recalculé qu'au rendu **suivant** (lire `scrollX`/`scrollY`
   après un `centerOn`).
2. La caméra est **bornée** par la carte : `removeBounds()` le temps d'un contrôle.
3. Pousser le héros « loin » le fait **changer de monde** (`guetterLeDepart` voit le bord).
4. En rendu logiciel, tout ce qui est minuté **s'étire d'un facteur quatre** : on mesure les
   écarts et les vitesses, jamais les distances parcourues.
5. **Phaser écoute le clavier sur `window` en phase de bouillonnement.** Pour passer devant
   lui — remapper une touche déjà prise, par exemple — il faut écouter sur `document` **en
   capture** et arrêter la propagation.
6. **`page.evaluate` renvoie la dernière expression.** Un `cameras.main.centerOn(...)` en fin
   de bloc renvoie la caméra entière, Playwright essaie de la sérialiser, et Node tombe sur
   `Cannot create a string longer than 0x1fffffe8 characters`. Finis tes blocs par `void 0;`.

## 7. Les dettes connues, petites

- Les deux dernières frames de la mort du golem et de la brute sortent de cinq pixels sous
  leur cadre (les pattes, pas le corps).
- **Aucun chiffre de l'incendie ni du météore n'a été joué** (`REGLAGES_INCENDIE`,
  `REGLAGES_METEORE`) : les 9 seaux, les 40 s d'une maison, la chance de propagation, la nuit
  sur vingt, les 12 s d'annonce, les 120 de fer du ciel.
- **La forêt ne brûle pas** : les arbres n'ont pas de vie dans le code (§4.21).
- **Le noircissement d'une maison ne se sauvegarde pas** (`Maison.brulee`, §4.21) : une
  maison qu'on a sauvée du feu revient propre après un rechargement. Celle qui brûle
  **encore** se renoircit en une seconde, puisque le feu, lui, est enregistré. Un champ de
  plus dans `EtatMaisonSauve` suffirait.
- **Presque aucun chiffre des blocs 8 à 12 n'a été joué.** Tous dans des tables de réglages.
- **Un milicien répond à la cloche ? Non**, et c'est volontaire — à juger en jouant.
- **La garnison n'existe pas** (§4.15) : au-delà de dix héros dehors, un onzième don ne
  s'éveille pas et le jeu le dit.
- Un village pose **six maisons en moyenne** (jamais plus de quatorze) là où le code en vise
  seize à vingt : c'est pour ça qu'une maison loge une famille de quatre.
- La forêt ne ferme pas un flanc (les monstres marchent dans les arbres) : à décider.
- Le port peut se poser sur un lac, faute de mieux.
- À ×3, **le milieu de la carte est une grande plaine verte**. Le jalon 5.6 y a mis quelque
  chose à trouver — reste à savoir si ça suffit.
- **Jalousie et trahison** existent comme types de relation mais **rien ne les crée** : aucun
  système ne produit de traître ni de promotion enviable. Les poser au hasard serait
  exactement ce que le §4.26 interdit.
- **Les naissances** (et la famille qui en vient) attendent un toit libre (§4.18).

## 8. Pour lancer

```bash
npm install
npm run dev      # le jeu s'ouvre dans le navigateur
npx vitest run   # les tests (944)
npm run build    # vérifie les types et construit

npx tsx scripts/capturer.ts apres          # les captures du jeu, par Playwright
npx tsx scripts/capturer-mondes.ts 0,1,2   # plusieurs mondes tirés
npx tsx scripts/planche.ts                 # les planches PNG, sans navigateur
npm run intro                              # refait la cinématique Blender
npm run son                                # refait la bande-son
```
