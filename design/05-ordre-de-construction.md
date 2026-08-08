# §5 Ordre de construction

> [← Sommaire du design](../DESIGN.md)

---

On ne construit pas dans l'ordre de l'histoire, mais dans l'ordre du risque : le plus
incertain d'abord. À chaque jalon, le jeu doit être **jouable** — moche, mais jouable.

| Jalon | Contenu | On sait quoi à la fin |
|---|---|---|
| **0** | ✅ Squelette technique | La plomberie fonctionne |
| **1** | ✅ Arène, héros, auto-attaque, ultimes, traits de classe, ennemis, mort | **Oui, bouger est amusant** — valide au test du 6 août |
| **2** | ✅ XP, montée de niveau, pause et choix d'amélioration | La boucle de combat tourne |
| **3** | ✅ Équipe, IA, règle des 20%, cité, switch, barre d'équipe, mort définitive | Le cœur du jeu est là |
| **4** | ✅ Ordres, postures et formations, expérience de groupe (§4.16) | La couche tactique existe |
| **5** | Le village vivant, en huit blocs (voir ci-dessous) | Les deux moitiés du jeu sont reliées |
| **6** | Le ciel : pluie, orages, incendies, météores, carte modifiable (§4.21) | Le monde a une humeur |
| **7** | Défenses à placer, de la baliste au canon laser | La tower-defense existe |
| **8** | Restauration du village, améliorations cumulables, montée en puissance infinie | La partie longue existe |
| **9** | Recrutement, rangs F→SRR++, classes rares, effectif de 10 et garnison (§4.15) | La collection existe |
| **10** | Prologue, choix de classe, dialogues, narration | Le jeu a un début |
| **11** | Défaite, corruption, retour du héros en antagoniste | Le jeu a une **suite** |
| **12** | Leaderboard en ligne | Le score compte pour de vrai |

## Le jalon 5 en détail

Il a grossi, puis il a **doublé** : le cycle jour/nuit, les hordes, les habitants, les
métiers, la faim, les ordres civils, les murs, les tours, les arrivées, les naissances,
les traitres — et maintenant l'église, les traits et les états, le mode d'aménagement.
On le livre donc en **blocs jouables**, un par un.

| Bloc | Contenu | On juge quoi à la fin |
|---|---|---|
| **1** ✅ | La carte, les flancs fermés, les fronts (§4.6) | La géographie tient |
| **2** ✅ | Le cycle jour/nuit, les hordes, les habitants, les métiers, la récolte à deux vitesses, la faim, la pause hors focus | **Le rythme** : 30/15 est-il le bon chiffre ? |
| **3** ✅ | La grille modifiable, les murs, les tours occupées, le rayon de vue qui ferme le camping, les ordres civils, les champs | Défendre un lieu est-il intéressant ? |
| **4** | Les arrivées aux portes, les naissances, les survivants à escorter, les traitres (§4.18) | Le village vit-il tout seul ? |
| **5** | **L'église** (§4.22) : refuge, soins, purge, cap des monstres, ses niveaux, sa destruction et sa reconstruction | Y a-t-il enfin une ligne à tenir ? |
| **6** | **Les traits, les humeurs et les états** (§4.23), la fiche unifiée, le renommage | Est-ce qu'on s'attache à ses gens ? |
| **7** | **Le mode d'aménagement** (§4.24) : édition en pause, construction libre, déplacement gratuit, tout se casse, le village en ruines, le sol et les chemins | Dessiner son village est-il un plaisir ou une corvée ? |
| **8** | Le confort : options, pause Échap, touches remappables (§4.10) | — |

**L'ordre est délibéré, et il n'est pas celui du risque.** Le bloc 4 passe devant l'église
alors que l'église est plus importante, parce qu'il était déjà entièrement écrit et que
les arrivants sont ce qui donnera de la matière aux traits du bloc 6 — un village de trois
personnes ne teste rien. Le confort passe en dernier alors qu'il aiderait à tester : c'est
un choix assumé, on continue à tester à la main d'ici là.

Ce qui change par rapport à la version précédente de ce paragraphe : **les maisons
deviennent destructibles**, au bloc 7 et non plus au jalon 8. Le joueur les place
lui-même, il faut donc qu'elles tombent (§4.24). Le jalon 8 garde la restauration en
profondeur — réparer pièce par pièce, améliorer, cumuler.

C'est le bloc 2 qui porte tout le risque : si 30 minutes de jour et 15 de nuit ne se
jouent pas bien, tout le reste est bâti sur du sable. Il faut donc pouvoir régler les
durées **sans toucher au code** — une seule table de constantes.

Le jalon 1 est le plus important du projet. Si se déplacer et lâcher un ultime n'est pas
agréable pendant 30 secondes d'affilée, aucun système au-dessus ne le sauvera — et mieux
vaut le découvrir en semaine 1 qu'en mois 6.
