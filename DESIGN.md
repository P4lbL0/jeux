# Document de design — Le Protecteur

> Document de référence du projet. Toute décision de gameplay se prend ici **avant** d'être codée.
> Si le code et ce document se contredisent, c'est le document qui a raison : c'est le code qu'on corrige.
>
> Dernière mise à jour : 2026-09-23, fin d'après-midi — **les fusions sont dans le jeu**
> (§4.25, jalon 6.5, morceau 3) : une quatrième carte quand deux ingrédients sont au
> maximum, le double prix, les douze fusions du morceau — dont le *Néant* à 60 s à
> découvert et le *Revenant* qui revient avec une séquelle, seconde porte vers les séquelles
> (§4.23 réécrit). Tout le catalogue se règle désormais dans le **Grimoire**
> (https://claude.ai/artifact/MMgy33ybsQJQGEWQpzj2yV).
>
> Avant ça : 2026-09-23, après-midi — **les statistiques sont dans le jeu**
> (§4.13, jalon 6.5, morceau 2a) : neuf cartes neuves, *Touche-à-tout* et ses touches 8, 9
> et 0, les compétences de classe ouvertes aux autres en rare. La suite : les six bases
> élémentaires.
>
> Avant ça : 2026-09-23, midi — **les builds sont entièrement tranchés**
> (§4.25) : une fusion se propose en quatrième carte, arrive au palier 1 sans jamais être
> moins forte que ses deux ingrédients, puis se monte au double du prix ; entre éléments ;
> les compétences de classe s'ouvrent aux autres en rare ; aucune fusion ne s'affiche avant
> de se proposer. Les communes sont les statistiques, plus la Pénétration, l'expérience et
> l'or ; un trait *Touche-à-tout* donne +1 à +3 actives (9 au plus) ; l'église ouvre les
> compétences du village, une fois par nuit chacune.
>
> Avant ça : 2026-09-23, fin de matinée — **le socle des builds est posé**
> (§4.25, jalon 6.5, morceau 1) : les 71 compétences portent leurs **tags** (vingt-sept, un
> bit chacun), affichés en pied de carte ; la **pénétration** borne les projectiles et les
> frappes en ligne ; la pioche est **pondérée par la classe et par les traits** ; les géants
> reculent moins. Le reste du jalon attend **onze décisions**, posées d'un coup dans un
> questionnaire.
>
> Avant ça : 2026-09-23 — **chaque nuit a son boss** (§4.33) : un boss par nuit
> dès la deuxième, un énorme toutes les cinq, deux et trois fois plus gros, dix et trente
> fois plus de points de vie, et ils se cabrent avant de frapper — les seuls de la horde qui
> préviennent. La suite est le **jalon 6.5, les builds**.
>
> Avant ça : 2026-09-22, tard — **le palier 2 de la horde est posé**
> (§4.33) : la piétaille est dessinée par **la nuée**, une passe instanciée qui teinte un orc
> unique (24 px, sorti de Blender) selon ce qu'il fait, ce qu'il lui reste de vie et le coup
> qu'il vient d'encaisser, rangée par bandes pour passer derrière les maisons. Les cadavres
> restent, couchés. La horde qui arrive tient **60 images/s jusqu'à 3 500 monstres** ; les
> boss seront des géants, deux à trois fois plus gros.
>
> Avant ça : 2026-09-22, le soir — **le palier 1 de la horde est posé**
> (§4.33) : une grille spatiale, les onze passes d'Arcade qui touchaient les monstres
> remplacées sans changer la physique, et un niveau de détail temporel. La horde qui arrive
> tient **60 images/s jusqu'à 2 500 monstres**, contre ~1 600. Et la mesure du rendu a
> tranché : un Sprite Phaser coûte 1,2 µs par image, un quad instancié rien — **le rendu
> maison est nécessaire** pour les vingt mille. Angelos, en voyant les captures : **les
> 20 000 viennent petit à petit**.
>
> Avant ça : 2026-09-22, tard — **le §4.33 est corrigé par la mesure**, et sur
> deux points. Le plafond de 60 monstres est un **choix de lisibilité**, pas une facture de
> fluidité : le moteur tient déjà **1 200 orcs à 60 images par seconde** et le mur est vers
> **1 600**. Et le jeu ne ralentit pas, **il tombe d'un coup** — Phaser rejoue les pas de
> physique manqués et s'enfonce tout seul (1 600 → 52 i/s, 2 000 → 26). Les paliers sont
> refaits en conséquence : d'abord le **garde-fou** contre cette falaise, puis **l'IA et la
> physique ensemble** (75 % du coût), puis **le rendu** (24 %). Le cap des vingt mille ne
> bouge pas.
>
> Avant ça : 2026-09-22, le soir — **LE JALON 6 EST FINI** (§4.21). Le
> **météore** est codé, et c'était le dernier morceau du ciel : une nuit sur vingt, une
> traînée puis une ombre qui grandit douze secondes au sol, et tout ce qui est dans le
> cratère disparaît sauf l'église. Il laisse une **cicatrice permanente** écrite dans la
> carte et **du fer du ciel** à extraire. ⚠️ La carte n'a **pas** eu à devenir une grille
> modifiable comme le §4.21 l'annonçait : le cratère est une écriture dans la texture cuite,
> et il ne bloque rien. La suite est le **jalon 6.2, la horde** (§4.33).
>
> Avant ça, l'après-midi — **l'incendie est codé** (§4.21). Ce qui
> l'allume (les monstres sous 30 % de vie, le Pyromane, le fou du degré 3, la foudre), ce
> qui l'éteint (les habitants au seau le jour, un héros à tout moment, la pluie qui compte
> double), ce qu'il mange (une maison en quarante secondes, un champ en huit) et ce qu'il
> laisse (une ruine à relever). Trois décisions d'Angelos ce jour-là : **une ruine, pas un
> mort** ; **une ligne de journal et un repère au bord**, pas la cloche ; et **le météore
> juste après**, pour fermer le jalon 6. Il ne reste du ciel que **le météore**.
>
> Avant ça : 2026-09-22 — **un jalon neuf, le 6.2 : la horde** (§4.33). On vise
> **vingt mille monstres** à l'écran, et la **règle n°2 du §4.17 tombe** : elle n'était pas
> un choix de design, c'était la facture d'une architecture. Une seule silhouette d'orc —
> la teinte dit qui c'est, la luminosité dit la vie, le rouge dit le coup encaissé, la
> taille dit le rang — et seuls les gros télégraphent leur attaque. Il passe **après le
> ciel et avant les builds**, parce que tout ce qui suit tape sur des monstres. Au passage,
> un chiffre corrigé : le plafond d'ennemis est **60** dans le code, pas 240.
>
> Avant ça : 2026-09-21, tard — **LE JALON 5 EST FINI.** Ses trois derniers
> blocs sont tombés le même soir : le **bloc 10**, le confort (§4.10, §4.11 — la pause Échap
> et son menu, les 36 touches remappables qui s'échangent au lieu de se disputer, une ligne
> d'aide qui lit le mappage) ; le **bloc 11**, la mémoire du village (§4.26 — les relations
> par paire, les souvenirs bornés à huit, ce qu'une mort produit, l'héritage proposé, les
> archives et leur récit assemblé qui ne dit que ce qu'on sait) ; et le **bloc 12**, la vie
> autonome (§4.27 — la journée sans ordre, trois habitants réveillés par image, les bulles
> dessinées, les six initiatives testées sur événement). **Le village vivant est complet.**
> La suite n'est plus un bloc mais un jalon : **le ciel** (§4.21). Sa première moitié est
> tranchée le 22 septembre 2026 : **la pluie** (tirée à l'aube, une journée sur trois, elle
> double la pousse et tombe aussi sur la route) et **la crue** (trois journées pluvieuses
> d'affilée : champs noyés, bâtiments abîmés qui s'écroulent, douves qui débordent, et des
> bêtes d'eau qui attaquent depuis l'eau la plus proche).
>
> Avant ça, le même soir : **les blocs 8 et 9** — les **ordres pour tous** (§4.4) et le
> **village armé** (§4.18, §4.1 — la cour d'entraînement, le milicien, les **dons** et le
> passage villageois → héros, la seule source de héros du jeu).
>
> Avant ça, le matin : **le jalon 5.6 est fini** : les trouvailles de la
> route (§4.31) sont codées, dans l'ordre que la section demandait. Les **caches** (sept par
> monde muet, deux monnaies, la fouille qui prend un moment, le camp de bêtes qui garde son
> terrain), le **survivant** qui remonte à l'errance et traverse les mondes avec nous, et la
> **stèle** qui grave un trait sur le héros — six traits écrits pour elle.
>
> Avant ça : la nuit du 2026-09-20 — **le jalon 5.5 est fini** (la carte se
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
| **4.21** | [Le ciel : la météo et les catastrophes](design/4.21-le-ciel-la-meteo-et-les-catastrophes.md) — **la pluie et la crue sont tranchées** (22 sept. 2026) |
| **4.28** | [**La sauvegarde et le compte**](design/4.28-la-sauvegarde-et-le-compte.md) |
| **4.29** | [**Le nouveau départ : le monde qu'on traverse, le village qu'on choisit**](design/4.29-le-nouveau-depart.md) |
| **4.30** | [**La refonte visuelle : dessinée par le code, puis low-poly Blender (18 sept.)**](design/4.30-la-refonte-visuelle.md) |
| **4.31** | [**Les trouvailles de la route : ce qu'on gagne à ne pas aller tout droit**](design/4.31-les-trouvailles-de-la-route.md) |
| **4.32** | [**Les portails et le donjon : ce qui s'ouvre sans prévenir**](design/4.32-les-portails-et-le-donjon.md) |
| **4.33** | [**La horde : vingt mille**](design/4.33-la-horde.md) |

### Le plan

| § | Section | Ce qu'on y trouve |
|---|---|---|
| **5** | [Ordre de construction](design/05-ordre-de-construction.md) | Les jalons, et le jalon 5 en douze blocs — **tous finis** |
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
  [§4.32 les portails et le donjon](design/4.32-les-portails-et-le-donjon.md).
  (Le **§4.31**, les trouvailles de la route, est **codé** depuis le 21 septembre 2026.)
  (Le §4.22, l'église, est **codé** depuis le 10 août.)

## Comment on tient ce document

Une décision se **note ici avant d'être codée**. Quand une nouvelle décision en contredit
une ancienne, on **réécrit le paragraphe périmé** au lieu de le laisser mentir — et on
garde trace du changement dans le texte (« ce paragraphe annule une règle qu'on s'était
donnée »), pour qu'on ne redécouvre pas la vieille règle six mois plus tard en croyant
qu'elle est en vigueur.

Chaque décision tranchée s'ajoute à la liste **Tranché récemment** du
[§6](design/06-questions-ouvertes.md).
