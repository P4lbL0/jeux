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

**Jalon 5, en cours** — le village vivant, en quatre blocs.

- *bloc 1* — la carte, les flancs fermes, les fronts.
- *bloc 2* — le **cycle jour/nuit** (30 min de jour, 15 de nuit), les hordes qui
  peuvent tomber en plein jour, les **habitants** et leurs metiers, la recolte a
  deux vitesses, la faim, et la pause quand la fenetre perd le focus.
- *bloc 3* — la carte en **grille modifiable**, les murs et les tours qu'on
  batit et qui cedent, le **rayon de vue** qui ferme enfin le camping, les
  ordres civils, et les **champs de ble** qu'on seme et qu'une horde ruine.
- *bloc 4, a faire* — les arrivees aux portes, les naissances, les traitres.

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
| `T` | Monter dans une tour a portee, ou en descendre |

Dans le tableau du village, **cliquer** un habitant change sa posture, **clic
droit** l'envoie a un autre poste.

### Les constructions (§4.20)

Deux familles, et c'est toute la regle :

- **une tour est une position, pas une arme.** Elle ne tire pas ; elle donne un
  point haut (+120 de portee) et met son occupant hors d'atteinte de la melee.
  C'est l'occupant qui decide de ce qui en sort — un mage y lance ses capacites,
  un villageois n'y fait qu'alerter ;
- **elle a des points de vie**, et quand elle tombe l'occupant tombe avec elle.
  Sans ca, y poster son meilleur heros serait la strategie definitive du jeu.

Les engins autonomes (baliste, canon) sont du jalon 7 : il n'y en a aucun ici.

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
    grille.ts        la carte modifiable, cuite depuis carte.ts (testee)
    constructions.ts murs et tours : couts, points de vie (testee)
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
    ficheHero.ts       fiche detaillee d'un heros
  scenes/    les ecrans du jeu
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

Toutes les images sont pour l'instant generees par code dans
[src/game/art.ts](src/game/art.ts). Pour mettre un vrai dessin : charger le PNG
sous la meme cle dans `preload()` et supprimer la fonction correspondante.

En dessinant, garder en tete que le jeu a un **zoom libre** : un sprite doit
rester reconnaissable tout petit. C'est la silhouette et la couleur dominante
qui comptent, pas le detail.
