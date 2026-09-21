# Document de design — Le Protecteur

> Document de référence du projet. Toute décision de gameplay se prend ici **avant** d'être codée.
> Si le code et ce document se contredisent, c'est le document qui a raison : c'est le code qu'on corrige.
>
> Dernière mise à jour : la nuit du 2026-09-20 — **le jalon 5.5 est fini** (la carte se
> peint par morceaux, la zone passe à ×3, l'errance continue), et **deux sections neuves**
> naissent dans la foulée : le **§4.31** (les trouvailles de la route — ce qu'on gagne à ne
> pas aller tout droit) et le **§4.32** (les portails et le donjon labyrinthe, à coder
> après le jalon 5).
>
> Avant ça : 2026-08-11, tard (les **sept notes brutes** de `design/a-faire.md`
> sont dépouillées : elles donnent un **jalon 6.7** neuf — le moral devient une arme — et
> elles nourrissent les §4.1, §4.10, §4.13, §4.23 et §7. Le **bloc 7 se coupe en 7a / 7b**,
> et le §4.20 **annule** son propre paragraphe « le jeu n'a pas besoin de savoir qu'un anneau
> est fermé » : **une enceinte fermée a toujours une porte**)
>
> Avant ça, le 11 août au soir : une section neuve, **le nouveau départ** (§4.29) — un seul
> héros, l'errance jusqu'au village qu'on choisit, le monde qui se fige quand on s'installe,
> et un **budget** qui fait payer chaque cadeau en menaces. Elle **annule** deux règles
> centrales : « deux fronts seulement » du §4.6, et « on recrute des héros » du §4.1.

**Ce fichier est le sommaire.** Le contenu vit dans [`design/`](design/), un fichier par
section — le document faisait 1800 lignes et n'était plus consultable d'un bloc.

> **La numérotation en § ne change pas.** Le code renvoie à ce document partout
> (`DESIGN.md §4.18`), et ces renvois restent valables : le §4.18, c'est
> [`design/4.18-les-habitants.md`](design/4.18-les-habitants.md). Les numéros de fichiers
> sont complétés d'un zéro (`4.01`, `4.02`…) uniquement pour que l'ordre alphabétique
> suive l'ordre des sections.

---

## Le pitch en trois phrases

Dans un monde post-apocalyptique, chaque village survit grâce à son **Protecteur**. Le
joueur arrive dans un village en ruine, accepte le poste, et le jeu **c'est ce métier** :
restaurer, organiser les défenses, repousser les vagues, recruter d'autres héros.

Le jeu est **sans fin**. Une partie s'arrête quand on perd — et le score, c'est jusqu'où
on est allé.

Détail complet : [§1 Pitch](design/01-pitch.md).

---

## Sommaire

### Les fondations

| § | Section | Ce qu'on y trouve |
|---|---|---|
| **1** | [Pitch](design/01-pitch.md) | Le jeu en quelques lignes |
| **2** | [Décisions verrouillées](design/02-decisions-verrouillees.md) | Ce qui ne se rediscute plus |
| **3** | [La boucle de jeu](design/03-la-boucle-de-jeu.md) | Ce que le joueur fait, minute par minute |

### 4. Les systèmes

**Les héros et le combat**

| § | Section |
|---|---|
| **4.1** | [Classes et rangs](design/4.01-classes-et-rangs.md) |
| **4.2** | [Combat](design/4.02-combat.md) |
| **4.3** | [Héros, IA et permadeath — la règle des 20%](design/4.03-heros-ia-et-permadeath-la-regle-des-20.md) |
| **4.4** | [Ordres et formations](design/4.04-ordres-et-formations.md) |
| **4.13** | [Compétences](design/4.13-competences.md) |
| **4.14** | [Le Nécromancien](design/4.14-le-necromancien.md) |
| **4.15** | [L'effectif : dix dehors, le reste en garnison](design/4.15-l-effectif-dix-dehors-le-reste-en-garnison.md) |
| **4.16** | [Formations et expérience de groupe](design/4.16-formations-et-experience-de-groupe.md) |
| **4.25** | [**Tags, fusions et synergies — le système de builds**](design/4.25-tags-fusions-et-synergies.md) |

**Le village**

| § | Section |
|---|---|
| **4.6** | [Le village : la carte, les fronts, les dégâts](design/4.06-le-village-la-carte-les-fronts-les-degats.md) |
| **4.18** | [Les habitants](design/4.18-les-habitants.md) |
| **4.19** | [Le cycle jour/nuit](design/4.19-le-cycle-jour-nuit.md) |
| **4.20** | [Les constructions : ce qui tient, ce qui tire](design/4.20-les-constructions-ce-qui-tient-ce-qui-tire.md) |
| **4.22** | [**L'église : le cœur du village**](design/4.22-l-eglise-le-coeur-du-village.md) |
| **4.23** | [**Les traits, le stress et les états**](design/4.23-les-traits-les-humeurs-et-les-etats.md) |
| **4.24** | [**Le village qu'on aménage**](design/4.24-le-village-qu-on-amenage.md) |
| **4.26** | [**Les relations, les souvenirs et la mémoire du village**](design/4.26-les-relations-les-souvenirs-et-la-memoire-du-village.md) |
| **4.27** | [**La vie autonome**](design/4.27-la-vie-autonome.md) |

**Le reste**

| § | Section |
|---|---|
| **4.5** | [Vagues](design/4.05-vagues.md) |
| **4.7** | [Défenses](design/4.07-defenses.md) |
| **4.8** | [Économie et progression](design/4.08-economie-et-progression.md) |
| **4.9** | [Score et leaderboard](design/4.09-score-et-leaderboard.md) |
| **4.10** | [Interface](design/4.10-interface.md) |
| **4.11** | [Direction artistique](design/4.11-direction-artistique.md) |
| **4.12** | [Défaite, corruption et antagoniste](design/4.12-defaite-corruption-et-antagoniste.md) |
| **4.17** | [Tenir la fluidité](design/4.17-tenir-la-fluidite.md) |
| **4.21** | [Le ciel : la météo et les catastrophes](design/4.21-le-ciel-la-meteo-et-les-catastrophes.md) |
| **4.28** | [**La sauvegarde et le compte**](design/4.28-la-sauvegarde-et-le-compte.md) |
| **4.29** | [**Le nouveau départ : le monde qu'on traverse, le village qu'on choisit**](design/4.29-le-nouveau-depart.md) |
| **4.30** | [**La refonte visuelle : dessinée par le code, puis low-poly Blender (18 sept.)**](design/4.30-la-refonte-visuelle.md) |
| **4.31** | [**Les trouvailles de la route : ce qu'on gagne à ne pas aller tout droit**](design/4.31-les-trouvailles-de-la-route.md) |
| **4.32** | [**Les portails et le donjon : ce qui s'ouvre sans prévenir**](design/4.32-les-portails-et-le-donjon.md) |

### Le plan

| § | Section | Ce qu'on y trouve |
|---|---|---|
| **5** | [Ordre de construction](design/05-ordre-de-construction.md) | Les jalons, et le jalon 5 en huit blocs |
| **6** | [Questions ouvertes](design/06-questions-ouvertes.md) | Ce qui reste à trancher, et ce qui vient de l'être |
| **7** | [Hors périmètre pour l'instant](design/07-hors-perimetre-pour-l-instant.md) | Ce qu'on s'interdit volontairement |

---

## Par où commencer

- **Pour comprendre le jeu** : [§1](design/01-pitch.md), puis
  [§3](design/03-la-boucle-de-jeu.md), puis
  [§4.3](design/4.03-heros-ia-et-permadeath-la-regle-des-20.md) — la règle des 20% est le
  système central.
- **Pour savoir quoi coder ensuite** : [§5](design/05-ordre-de-construction.md).
- **Avant d'ajouter quoi que ce soit à l'écran** :
  [§4.17](design/4.17-tenir-la-fluidite.md). Ses cinq règles ne se négocient pas.
- **Les sections les plus récentes**, et celles que le code ne connaît pas encore :
  [§4.23 les traits et les états](design/4.23-les-traits-les-humeurs-et-les-etats.md),
  [§4.24 le village qu'on aménage](design/4.24-le-village-qu-on-amenage.md),
  [§4.25 tags, fusions et synergies](design/4.25-tags-fusions-et-synergies.md),
  [§4.26 la mémoire du village](design/4.26-les-relations-les-souvenirs-et-la-memoire-du-village.md),
  [§4.27 la vie autonome](design/4.27-la-vie-autonome.md),
  [§4.29 le nouveau départ](design/4.29-le-nouveau-depart.md),
  [§4.31 les trouvailles de la route](design/4.31-les-trouvailles-de-la-route.md),
  [§4.32 les portails et le donjon](design/4.32-les-portails-et-le-donjon.md).
  (Le §4.22, l'église, est **codé** depuis le 10 août.)

## Comment on tient ce document

Une décision se **note ici avant d'être codée**. Quand une nouvelle décision en contredit
une ancienne, on **réécrit le paragraphe périmé** au lieu de le laisser mentir — et on
garde trace du changement dans le texte (« ce paragraphe annule une règle qu'on s'était
donnée »), pour qu'on ne redécouvre pas la vieille règle six mois plus tard en croyant
qu'elle est en vigueur.

Chaque décision tranchée s'ajoute à la liste **Tranché récemment** du
[§6](design/06-questions-ouvertes.md).
