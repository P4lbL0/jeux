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
| `ZQSD` ou les fleches | Se deplacer |
| `1` | Ultime |
| Molette | Zoomer / dezoomer |
| `R` | Recommencer apres la mort |

L'attaque, la visee et l'esquive sont **automatiques** : le joueur ne controle
que le deplacement et ses ultimes.

## Ou en est le projet

Voir la feuille de route dans [DESIGN.md](DESIGN.md#5-ordre-de-construction).

**Jalon 1 en cours** — une arene, un heros, l'attaque automatique, un ultime par
classe, des ennemis qui arrivent sans fin. Il ne sert qu'a repondre a une
question : *est-ce que bouger et lacher un ultime, c'est amusant ?*

## Structure du code

```
src/
  core/      logique pure, sans Phaser, testable au jalon pres
    rng.ts       aleatoire seede (une graine = une partie rejouable)
    classes.ts   donnees des 4 classes — c'est ici qu'on equilibre
  game/      ce qui vit a l'ecran
    art.ts       textures placeholder generees par code
    entities.ts  heros et ennemis
    hud.ts       barre de heros (le futur ecran de triage)
  scenes/    les ecrans du jeu
```

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
