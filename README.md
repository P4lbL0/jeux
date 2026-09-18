# Le Protecteur

Roguelike vu de dessus en pixel-art, avec gestion de village.

Le design complet du jeu est dans **[DESIGN.md](DESIGN.md)** — c'est le sommaire, le
contenu vit dans [`design/`](design/), un fichier par section. C'est le document de
reference : on y decide avant de coder.

Les renvois du code (`DESIGN.md §4.18`) pointent vers le fichier qui porte ce numero,
ici [`design/4.18-les-habitants.md`](design/4.18-les-habitants.md).

## Lancer le jeu

```bash
npm install     # une seule fois
npm run dev     # ouvre le jeu dans le navigateur
```

Les autres commandes :

```bash
npm test        # lance les tests de la logique de jeu
npm run build   # verifie les types et construit la version finale
```

Le jeu s'ouvre sur **l'ecran-titre** (§4.10) : neuf secondes de village en feu rendues par
Blender — un clic ou une touche les sautent —, puis le titre et **JOUER**, qui mene aux
trois emplacements de sauvegarde. Le film se refait avec `npm run intro` (voir « Les
sprites » plus bas).

### La sauvegarde et le compte (§4.28)

La partie s'enregistre **sur cet appareil**, dans le `localStorage`, sur trois
emplacements. Ca marche sans compte, sans reseau, sans rien configurer.

Un compte **The Circle** est optionnel : il ajoute une copie de la sauvegarde en ligne,
pour retrouver sa partie sur une autre machine. Pour l'activer, deux variables dans un
`.env` a la racine (voir [.env.example](.env.example)) :

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

Sans ces variables, le jeu se lance exactement pareil et n'affiche simplement pas
l'ecran de connexion. **La cle anon uniquement** — le code refuse toute autre cle.

⚠️ **Regle ironman** : on ecrase la sauvegarde aux moments-cles, mort comprise. Fermer
l'onglet apres avoir perdu un heros ne le ramene pas.

## Commandes en jeu

| Touche | Action |
|---|---|
| `ZQSD`, les fleches, ou **clic gauche** | Se deplacer (maintenir pour guider) |
| `Espace` (ou `1`) | Ultime |
| `A` / `E`, ou clic gauche sur un portrait | Changer de heros / voir sa fiche |
| `1` `2` `3` | Choisir une amelioration a la montee de niveau |
| Molette | Zoomer / dezoomer |
| `R` | Recommencer apres la mort |

L'attaque, la visee et l'esquive sont **automatiques** : le joueur ne controle
que le deplacement et ses ultimes.

## Les ordres

Gauche, c'est **moi** ; droite, c'est **les autres**. Le combat ne s'arrete
jamais pour donner un ordre (DESIGN.md §4.4).

| Touche | Action |
|---|---|
| **Clic droit** sur le sol | La selection va tenir ce point |
| **Clic droit** sur un allie | La selection le protege : l'ancre le suit |
| **Clic droit** sur un portrait | Ajoute / retire ce heros de la selection |
| **Maj + clic droit** sur un portrait | Selectionne toute sa classe |
| `W` / `X` / `C` | Temporiser / Agressif / Repli |
| `V` | Change de formation (libre, mur, cercle) |
| `Echap` | *Rompez* : plus de selection, plus de position tenue |

Sans selection, l'ordre vaut pour **toute l'equipe**. Le heros incarne n'obeit
jamais : c'est le joueur qui le pilote.

Les **mort-vivants du Necromancien recoivent exactement les memes ordres** —
c'est un seul systeme, pas deux (DESIGN.md §4.14).

**Aucune posture n'annule le repli des 20%.** Un heros en posture agressive qui
tombe au seuil critique decroche quand meme. C'est teste
([ia.test.ts](src/core/ia.test.ts)), et ca doit le rester.

Chaque montee de niveau met le jeu **en pause** et propose trois ameliorations.
C'est toujours le joueur qui choisit — jamais l'IA (DESIGN.md §4.3).

## La regle des 20%

Le coeur du jeu tient en trois regles :

1. Un heros joue par l'**IA se replie** des qu'il tombe a 20% de vie. **L'IA ne
   perd donc jamais un heros.**
2. Le joueur peut changer de heros a tout moment, **sauf sous 20% de vie** : il
   est alors verrouille et doit ramener son heros vivant **jusqu'a la cite**.
3. La mort est **definitive**.

Consequence : un heros ne peut mourir **que par une decision du joueur**.

## Ou en est le projet

Voir la feuille de route dans [design/05-ordre-de-construction.md](design/05-ordre-de-construction.md).

**Jalons 1 a 3** — une arene, une equipe de heros, l'attaque automatique,
un ultime et un trait par classe, l'IA qui joue les heros non incarnes, la regle
des 20%, la cite ou l'on se soigne, la mort definitive, et la boucle
XP → niveau → choix d'amelioration.

**Jalon 4** — les ordres : position, posture, formations, le meme systeme pour
les mort-vivants du Necromancien, et l'**experience de groupe** : deux heros qui
se battent cote a cote apprennent a travailler ensemble (+10% de degats au
plafond, visible dans la fiche de heros).

**Jalon 5, en cours** — le village vivant, en douze blocs.

- *bloc 1* — la carte, les flancs fermes, les fronts.
- *bloc 2* — le **cycle jour/nuit** (30 min de jour, 15 de nuit), les hordes qui
  peuvent tomber en plein jour, les **habitants** et leurs metiers, la recolte a
  deux vitesses, la faim, et la pause quand la fenetre perd le focus.
- *bloc 3* — la carte en **grille modifiable**, les murs et les tours qu'on
  batit et qui cedent, le **rayon de vue** qui ferme enfin le camping, les
  ordres civils, et les **champs de ble** qu'on seme et qu'une horde ruine.
- *bloc 4* — l'**eglise** : on y entre, elle soigne, elle purge, elle est le cap
  des monstres, elle monte en quatre niveaux et elle peut tomber.
- *bloc 5* — les **traits, le stress et les etats**, les sequelles, les trois
  statistiques, les portraits assembles, la fiche unifiee et le renommage.
- *bloc 6a* — la **porte** : qui se presente, la fiche d'observation, les six
  indices, les questions, et les **trois degres de folie**.
- *bloc 6b* — le **port** : le relever, la voile qui parait quand c'est calme,
  le **cours** de chaque ressource, la vente, et l'**argent**.
- *bloc 6c, a faire* — les survivants qu'on va chercher au bord de la carte.

### La porte (§4.18, §4.10)

Un inconnu se presente tous les deux ou trois jours — plus souvent si le
village a bonne reputation, plus du tout s'il se meurt. Le jeu se met en
**pause** et sa fiche s'ouvre : c'est **la fiche unifiee dans un troisieme
mode**, pas une interface de plus.

- **Trois lignes d'observation**, toujours trois, et chaque axe a deux
  versions — une alarmante, une rassurante. Un innocent en montre 0 a 1
  d'alarmantes, un fou 2 a 3.
- **Quatre questions**, tirees d'une banque de vingt. On peut toutes les
  poser. **La reponse n'est jamais tiree au sort** : elle tombe de ce que la
  personne est. Le meme homme, a la meme question, repond toujours pareil.
- **La folie a trois degres** : le voleur vide les stocks et disparait, le
  saboteur ouvre une breche, le meurtrier tue dans la nuit. Aucun des deux
  derniers n'est jamais **demasque** — et a trois, ils frappent **la meme
  nuit**.
- **Refuser ne coute que le bras qu'on n'aura pas.** Pas de malus.

### Le port et le commerce (§4.18)

Le port est **debout en ruine** des la premiere minute, sur la plage a
l'ouest. On le releve pour **80 bois et une demi-journee** (touche `P`, au
port). Adosse au flanc ferme, **rien ne peut jamais l'atteindre**.

- **Le navire n'a pas d'horaire.** Une voile parait environ **une journee
  calme sur trois** — et calme veut dire : il fait jour, plus un monstre
  debout, et personne n'est mort recemment. Une mauvaise nuit coupe donc le
  commerce en meme temps que les arrivees.
- **Chaque ressource a son cours**, qui derive lentement. Le minerai est haut
  aujourd'hui, le bois est bas : on choisit **quoi** charger.
- **Vendre fait baisser le cours de ce qu'on vend**, et il remonte les jours
  suivants. C'est ce qui remplace un plafond de cargaison : solder tout un
  stock d'un coup rapporte de moins en moins cher sur la fin.
- **On vend les quatre ressources, ble compris** — donc on peut s'affamer
  soi-meme. Le panneau affiche les journees de vivres, qui baissent pendant
  qu'on charge.

L'**argent** ne se recolte pas et ne se convertit pas : il vient du port, et il
part dans les niveaux d'eglise (§4.22). C'est la seule conversion du jeu, et
elle est a **sens unique**.

### Le cycle jour/nuit (§4.19)

Le jour on produit, on repare, on recolte a la main ; la nuit un **effectif
defini** arrive par les fronts ouverts, et quand le dernier tombe, la nuit
devient calme — c'est la recompense d'avoir nettoye vite.

Toutes les durees et tous les effectifs sont dans **une seule table**,
`REGLAGES_CYCLE` en haut de [src/core/cycle.ts](src/core/cycle.ts). C'est le seul
endroit a toucher pour changer le rythme du jeu.

| Touche | Effet |
|---|---|
| `B` | La cloche : tout le monde rentre immediatement |
| `F` | Le tableau du village : stocks, vivres, habitants |
| `G` | Batir une palissade (le jour seulement) |
| `H` | Batir une tour de guet |
| `J` | Semer un champ, pres des champs |
| `K` | Batir une porte : ouverte le jour, la cloche la ferme, l'aube la rouvre |
| `T` | Monter dans une tour a portee, ou en descendre |
| `Y` | Monter l'eglise d'un niveau, ou relancer son chantier |
| `P` | Au port : relever le chantier, ou commercer avec le navire a quai |
| `M` | Le **mode d'amenagement** : le jeu se met en pause, la grille apparait |

### Le mode d'amenagement (§4.24)

`M` arrete le temps et fait apparaitre la grille. **Le jour seulement** — l'ouvrir
en pleine nuit serait une reparation gratuite au milieu d'un assaut. Le temps
passe dedans est **rendu** a la fermeture.

| Geste | Effet |
|---|---|
| `G` / `H` / `J` | Choisir quoi poser. Ce sont les **seules** touches vivantes sous cette pause |
| **Clic gauche** | Poser si un outil est choisi ; sinon **prendre** ce qui est sous le curseur ; et si on tient quelque chose, le **reposer** |
| **Clic droit** | Demolir — ca rend **la moitie** de ce qui tenait encore debout |

**Deplacer est gratuit et instantane**, et la construction **garde ses points de
vie** : sinon deplacer reparerait.

Deux regles de pose, et elles sont **locales** : trois cases libres au moins
entre ce qu'on batit et **l'eglise ou le port** (jamais les maisons, sinon
l'enceinte serait repoussee hors de portee), et le sol doit porter. Un refus dit
toujours pourquoi.

Dans le tableau du village, **cliquer** un habitant change sa posture, **clic
droit** l'envoie a un autre poste, **Maj + clic** ouvre sa fiche.

### Les traits, le stress et les etats (§4.23)

Heros et habitants partagent **un seul systeme** : trois statistiques en
pourcentage (Force, Courage, Intelligence), des **traits** illimites et le plus
souvent mauvais, une **jauge de stress** qui ne fait rien jusqu'a la rupture, et
des **etats** qui tuent en 5 a 7 journees si on ne les soigne pas.

- **Un trait vaut peu** — 2 a 5 %, un seuil decale. Ils se gagnent par
  **exploit**, jamais par tirage : tuer 200 monstres, voir mourir trois
  habitants, passer dix nuits dehors.
- **Une sequelle est enorme et definitive**, et elle ne s'obtient qu'en survivant
  au stade *Mourant*. Soigner quelqu'un in extremis le sauve **et** l'abime.
- **A 100 % de stress il craque** (paranoia, terreur, rage, abattement, ou
  rarement il se transcende). **A 200 % le coeur lache.** Un civil qui craque ne
  frappe jamais personne — au pire il lache son poste.
- **La satisfaction du village** tombe de tout ca, et c'est **elle qui debloque
  les niveaux d'eglise**. La boucle se referme.

Tous les chiffres vivent dans **une seule table**, `REGLAGES_STRESS` en haut de
[src/core/personne.ts](src/core/personne.ts).

**Une seule fiche** pour les deux populations
([fichePersonne.ts](src/game/fichePersonne.ts)) : portrait assemble, nom
modifiable, statistiques, traits, etats — puis les competences pour un heros, le
metier pour un habitant. Cliquer le nom le **renomme** (les touches du jeu sont
coupees pendant la saisie).

### Les constructions (§4.20)

Deux familles, et c'est toute la regle :

- **une tour est une position, pas une arme.** Elle ne tire pas ; elle donne un
  point haut (+120 de portee) et met son occupant hors d'atteinte de la melee.
  C'est l'occupant qui decide de ce qui en sort — un mage y lance ses capacites,
  un villageois n'y fait qu'alerter ;
- **elle a des points de vie**, et quand elle tombe l'occupant tombe avec elle.
  Sans ca, y poster son meilleur heros serait la strategie definitive du jeu.

Les engins autonomes (baliste, canon) sont du jalon 7 : il n'y en a aucun ici.

**Un mur regarde ses quatre voisines** (11 septembre 2026, `src/game/dessin/murs.ts`) :
chaque case dessine un poteau, et un pan vers chaque voisine qui est un mur, une tour ou
une porte — seize raccords par matiere, comme les murs de Clash of Clans. Poser un mur
redessine ses voisines ; l'apercu de pose montre deja ses raccords.

**La porte** (`K`, 20 bois, 160 PV) prend une case de mur. Ouverte, tout le monde passe,
monstres compris. **La cloche (`B`) ferme toutes les portes**, et l'aube les rouvre ; une
porte fermee arrete tout le monde et se fait frapper comme un mur (§4.20). Le village
demarre avec une enceinte en L sur les deux fronts, deux portes, trois tours et des
breches.

## La carte

Le village est adosse a la **mer** a l'ouest et a la **montagne** au sud
(DESIGN.md §4.6). Ces deux bords sont **infranchissables** : les monstres ne
peuvent arriver que du **nord** ou de l'**est**.

```
                    ↓ front nord
   ~~~~~~~~~~ +--------------------------------+
   ~  mer   ~ |                                |
   ~~~~~~~~~~ |           VILLAGE              |  <- front est
   ~ plage  ~ |                                |
   ~~~~~~~~~~ +--------------------------------+
                MONTAGNE   ·   FORET
```

Les fronts s'ouvrent **progressivement**, et toujours **annonces** : le nord
seul jusqu'a la vague 4, l'un des deux jusqu'a la 9, les deux ensuite. Ouvrir un
flanc est un levier de difficulte qui ne change aucun chiffre — il change **ou
il faut etre**.

Trois **postes de travail** sont traces sur la carte : la plage, la mine et la
foret. Un habitant y travaille en continu, et le joueur peut y recolter lui-meme
**en frappant** — mais seulement le jour. Ce sont les endroits que la defense
doit couvrir : c'est la qu'on a quelque chose a perdre.

## Structure du code

```
src/
  core/      logique pure, sans Phaser, testable
    rng.ts           aleatoire seede (une graine = une partie rejouable)
    classes.ts       donnees des 7 classes — c'est ici qu'on equilibre
    competences.ts   ameliorations et leurs raretes
    ia.ts            decisions des heros joues par l'IA (fonction pure, testee)
    ordres.ts        postures, formations et postes (fonction pure, testee)
    affinites.ts     experience de groupe par paire de heros (testee)
    carte.ts         terrain, flancs fermes et fronts (fonction pure, testee)
    cycle.ts         le jour, la nuit, les effectifs et les hordes (testee)
    habitants.ts     metiers, cadence, progression et faim (testee)
    arrivants.ts     la porte : indices, questions, degres de folie,
                     reputation et la nuit des fous (testee)
    port.ts          le commerce : chantier, cours, vente, la voile (testee)
    grille.ts        la carte modifiable, cuite depuis carte.ts (testee)
    constructions.ts murs et tours : couts, points de vie (testee)
    eglise.ts        niveaux, conditions, chute et relevement (testee)
    personne.ts      ce qu'un heros et un habitant ont en commun (testee)
    traits.ts        traits, sequelles et leur agregat (testee)
    etats.ts         maladie, hemorragie, infection, lethargie (testee)
    satisfaction.ts  le moral du village, qui debloque l'eglise (testee)
    sauvegarde.ts    la forme d'une partie enregistree, et l'arbitrage
                     local/cloud — fonction pure, testee (§4.28)
  en-ligne/  le seul dossier qui connait le reseau. Retirable en entier
    client.ts          le client Supabase, et le refus de toute cle non-anon
    compte.ts          connexion au compte The Circle (pas d'inscription ici)
    sauvegardeCloud.ts la copie cloud : upsert, repos de 60 s, effacement
    parties.ts         les parties terminees (score falsifiable, c'est dit)
  game/      ce qui vit a l'ecran
    art.ts             textures placeholder generees par code
    entities.ts        heros, ennemis et invocations
    village.ts         les habitants a l'ecran : postes, travail, fuite, mort
    constructions.ts   ce qu'on batit : pose, degats, occupation, chute
    champs.ts          semis, maturation, moisson et pietinement
    panneauVillage.ts  le compteur permanent, et le tableau a la demande
    commandement.ts    selection et distribution des ordres
    hud.ts             barre de heros (l'ecran de triage)
    panneauCapacites.ts panneau des capacites, en bas a gauche
    panneauOrdres.ts   qui obeit, et a quoi
    choixCompetence.ts ecran de montee de niveau
    fichePersonne.ts   LA fiche : heros et habitants, et le renommage
    portraits.ts       portraits assembles par morceaux, en onze couches
    sauvegarde.ts      le pont : capture de la partie, reprise, localStorage
  scenes/    les ecrans du jeu
    MenuScene.ts         les trois emplacements, et le compte
    ChoixClasseScene.ts  choix de la classe de depart
    ArenaScene.ts        le combat
    UiScene.ts           l'interface, dans sa propre couche
```

**L'interface est une scene a part.** Le zoom appartient a la camera et agrandit
tout ce qu'elle affiche, y compris les elements fixes a l'ecran. Une interface
posee dans la scene de jeu grossit donc avec le monde. UiScene a sa propre
camera, qui reste a zoom 1 quoi qu'il arrive.

La regle : **`core/` ne connait pas Phaser.** C'est ce qui permet de tester la
logique du jeu sans lancer le moteur, et de changer d'affichage un jour sans
reecrire les regles.

## Les sprites

**Tout ce qui se voit est dessine par le code**, dans la palette de neuf couleurs
du jeu, et cuit en textures au demarrage (`src/game/dessin/`, DESIGN.md §4.30).
Il n'y a aucun PNG : la carte est peinte pixel par pixel (`carte.ts`), le decor,
les batiments, l'enceinte, les monstres, les villageois et les heros sont des
fonctions a parametres (`decor.ts`, `batiments.ts`, `murs.ts`, `monstres.ts`,
`villageois.ts`, `heros.ts`), et `monde.ts` cuit le tout d'un seul appel.

**Un personnage tient dans un cadre de 20 px** (14 px de haut, contre 40 pour une
maison) depuis le 11 septembre 2026 ; les betes ordinaires aussi, la brute et le
golem dans 30. Tout le dessin du corps est exprime par rapport au 32 d'origine
(`K` dans `corps.ts`) : on change la taille sans toucher aux proportions.

Pour juger un dessin, on le regarde — jamais on ne le devine :

```bash
npx tsx scripts/planche.ts [dossier]   # les planches PNG, sans navigateur
npx tsx scripts/capturer.ts apres      # le jeu qui tourne, par Playwright
npx tsx scripts/capturer-titre.ts apres # l'ecran-titre : film, meteorite, menu, emplacements
npm run intro                          # refait le film d'ouverture (Blender + ffmpeg)
```

⚠️ Un PNG depose dans `src/assets/` remplace le dessin au code sous la meme
cle : c'est le mecanisme qui a rendu le moteur de dessin invisible pendant un
mois. Ne rien y deposer sans le vouloir.

En dessinant, garder en tete que le jeu a un **zoom libre** : un sprite doit
rester reconnaissable tout petit. C'est la silhouette et la couleur dominante
qui comptent, pas le detail.
