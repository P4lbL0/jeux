# Le Protecteur

Roguelike vu de dessus en pixel-art, avec gestion de village.

Le design complet du jeu est dans **[DESIGN.md](DESIGN.md)** — c'est le document
de reference. On y decide avant de coder.

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

Voir la feuille de route dans [DESIGN.md](DESIGN.md#5-ordre-de-construction).

**Jalons 1 a 3** — une arene, une equipe de heros, l'attaque automatique,
un ultime et un trait par classe, l'IA qui joue les heros non incarnes, la regle
des 20%, la cite ou l'on se soigne, la mort definitive, et la boucle
XP → niveau → choix d'amelioration.

**Jalon 4** — les ordres : position, posture, formations, le meme systeme pour
les mort-vivants du Necromancien, et l'**experience de groupe** : deux heros qui
se battent cote a cote apprennent a travailler ensemble (+10% de degats au
plafond, visible dans la fiche de heros).

Prochain jalon : le village.

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
  game/      ce qui vit a l'ecran
    art.ts             textures placeholder generees par code
    entities.ts        heros, ennemis et invocations
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
