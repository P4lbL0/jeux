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
| **5** | Le village vivant, en **douze** blocs (voir ci-dessous) | Les deux moitiés du jeu sont reliées |
| **6** | Le ciel : pluie, orages, incendies, météores, carte modifiable (§4.21) | Le monde a une humeur |
| **6.5** | **Les builds** (§4.25) : tags, 36 compétences neuves, 26 fusions, synergies, compétences de village et de formation | Deux parties de la même classe sont-elles enfin différentes ? |
| **7** | Défenses à placer, de la baliste au canon laser (§4.7) | La tower-defense existe |
| **8** | Restauration du village, améliorations cumulables, montée en puissance infinie — et **la banque, les pillards et les bandes armées** (§4.18) | La partie longue existe |
| **9** | Recrutement, rangs F→SRR++, classes rares dont le **Voidwalker** et le **Bastion** (§4.1), effectif de 10 et garnison (§4.15) | La collection existe |
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
| **4** ✅ | **L'église** (§4.22) : on y entre, soins, purge, cap des monstres, ses quatre niveaux et leurs quatre conditions, sa destruction et sa reconstruction — plus le **bloc de combat** de l'habitant, sans lequel personne ne peut défendre ses portes (§4.18) | Y a-t-il enfin une ligne à tenir ? |
| **5** ✅ | **Les traits, le stress et les états** (§4.23), les **séquelles**, les trois statistiques, les portraits assemblés, la fiche unifiée, le renommage | Est-ce qu'on s'attache à ses gens ? |
| **6a** | **La porte** (§4.18, §4.10) : les arrivants, la fiche d'observation, les six indices en deux versions, la banque de questions, les **trois degrés de folie** et les groupes, la réputation | Ouvrir sa porte est-il un vrai dilemme ? |
| **6b** | **Le port** (§4.18) : le port en ruine qu'on relève, la voile qui paraît quand c'est calme, le **cours** de chaque ressource, la vente, l'**argent** | Produire au-delà de ses besoins a-t-il enfin un sens ? |
| **6c** | **Les survivants** (§4.18) : ils paraissent au bord de la carte, parfois poursuivis, parfois blessés, et il faut aller les ramener vivants | Le jour a-t-il enfin une raison de sortir du village ? |
| **7** | **Le mode d'aménagement** (§4.24) : édition en pause, construction libre, déplacement gratuit, tout se casse, le village en ruines, le sol et les chemins — et **la forteresse** du §4.20 : murs améliorables au fer, porte cassable, douves, douves en eau, pont-levis | Dessiner son village est-il un plaisir ou une corvée ? |
| **8** | **Les ordres pour tous** (§4.4) : n'importe qui fait n'importe quoi, menu d'ordres, héros au travail | Commander vingt personnes est-il agréable ? |
| **9** | **Le village armé** (§4.18) : l'entraînement au combat, le métier de **milicien** qui patrouille les rues, et le passage **villageois → héros** | Une milice change-t-elle vraiment une nuit ? |
| **10** | Le confort : options, pause Échap, touches remappables (§4.10) | — |
| **11** | **La mémoire du village** (§4.26) : les relations, les souvenirs, ce qu'une mort produit, l'héritage immatériel, les légendes assemblées | Le joueur raconte-t-il sa partie au lieu de la résumer ? |
| **12** | **La vie autonome** (§4.27) : la journée qu'on enchaîne sans ordre, les initiatives rares | Le village a-t-il l'air habité quand on regarde ailleurs ? |

> **Le jalon 5 passe de dix à douze blocs le 10 août 2026**, et pour une raison précise :
> le bloc 5 avait absorbé les relations, les souvenirs, la mémoire, l'héritage et la
> simulation autonome. Ça faisait un bloc qu'on ne pouvait ni finir ni juger — exactement
> ce que ce §5 interdit deux paragraphes plus bas.
>
> **Le bloc 5 est donc resserré volontairement**, et rien n'est perdu : tout ce qui en sort
> est écrit en entier au §4.26 et au §4.27, avec ses garde-fous de performance, et attend
> son tour. Les blocs 11 et 12 sont les deux seuls du jalon dont l'absence ne casse rien —
> sans eux le jeu tourne, il est juste plus froid.

> **Et le 6b se coupe à son tour** : les **survivants** deviennent le bloc 6c. Aller
> chercher quelqu'un au bord de la carte est un système de terrain complet — apparition,
> poursuite, escorte, mort en chemin — qui ne partage rien avec le commerce. Le même
> découpage que 6a/6b, pour la même raison.

> **Le bloc 6 se livre en deux, le 10 août 2026 au soir.** Il portait trois systèmes
> indépendants — la porte, la démographie, le commerce — et quatre chiffres non tranchés.
> Un bloc qu'on ne peut ni finir ni juger est exactement ce que ce §5 interdit. **6a la
> porte, 6b le port** : chacun se joue seul, et 6a suffit déjà à débloquer l'église, dont
> le niveau 2 exige six habitants qu'aucun système ne pouvait fournir jusqu'ici.
>
> **Les naissances sortent du bloc 6 et passent après le bloc 7** : elles exigent « un toit
> libre », et les toits n'existent qu'avec le mode d'aménagement (§4.24, §4.18).

> ⚠️ **Cet ordre a changé, et pas par goût — par dépendance.** La version précédente
> mettait les arrivées en premier parce qu'elles étaient déjà écrites. Elles ne peuvent
> plus : la fiche d'observation a besoin des **portraits**, les six indices ont besoin des
> **traits** (un pyromane est un indice à lui seul), et « il refuse d'entrer dans
> l'église » a besoin de **l'église**. Les coder d'abord voudrait dire les recoder après.
>
> L'église passe donc en tête, ce qui tombe bien : c'est le système le plus important du
> jalon, et celui qui touche le code le plus fragile (`dansLeVillage`, le refuge, les
> soins, le ciblage des monstres). Le plus risqué d'abord, comme le reste du document.

Le confort reste en dernier alors qu'il aiderait à tester : c'est un choix assumé, on
continue à tester à la main d'ici là.

Ce qui change par rapport à la version précédente de ce paragraphe : **les maisons
deviennent destructibles**, au bloc 7 et non plus au jalon 8. Le joueur les place
lui-même, il faut donc qu'elles tombent (§4.24). Le jalon 8 garde la restauration en
profondeur — réparer pièce par pièce, améliorer, cumuler.

> **Le jalon 5 passe de neuf blocs à dix**, et il faut le dire au lieu de le glisser dans
> un tableau. Deux décisions du 9 août en sont la cause : les habitants **ont désormais un
> bloc de combat** (§4.18), ce qui ouvre l'entraînement, la milice et le passage
> villageois→héros ; et la **forteresse** — murs améliorables, porte, douves, pont-levis —
> s'ajoute au mode d'aménagement.
>
> Chacun de ces morceaux est bon. L'ensemble est un très gros jeu, et le §5 le répète
> volontiers : **quand un bloc dérape, on livre la version minimale qui se joue et on le
> dit**, on n'étend pas encore. C'est exactement pourquoi le bloc 4 ne prend du village armé
> que les quatre chiffres dont l'église a besoin, et rien de plus.

C'est le bloc 2 qui porte tout le risque : si 30 minutes de jour et 15 de nuit ne se
jouent pas bien, tout le reste est bâti sur du sable. Il faut donc pouvoir régler les
durées **sans toucher au code** — une seule table de constantes.

Le jalon 1 est le plus important du projet. Si se déplacer et lâcher un ultime n'est pas
agréable pendant 30 secondes d'affilée, aucun système au-dessus ne le sauvera — et mieux
vaut le découvrir en semaine 1 qu'en mois 6.
