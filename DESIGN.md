# Document de design — Le Protecteur

> Document de référence du projet. Toute décision de gameplay se prend ici **avant** d'être codée.
> Si le code et ce document se contredisent, c'est le document qui a raison : c'est le code qu'on corrige.
>
> Dernière mise à jour : 2026-08-06

---

## 1. Pitch

Dans un monde post-apocalyptique, chaque village survit grâce à son **Protecteur**.
Celui-ci n'en a plus — situation devenue banale — et sans Protecteur, un village est condamné à disparaître.

Le joueur arrive dans ce village en ruine, découvre la situation en parlant aux
habitants, et accepte le poste. Il est payé pour ça.

**Le jeu, c'est ce métier** : restaurer le village, organiser ses défenses, repousser
les vagues de monstres, et recruter d'autres héros pour tenir.

**Structure d'une partie** : le jeu est **sans fin**. Les vagues s'enchaînent
indéfiniment, les monstres montent en puissance, les améliorations sont cumulables.
Une partie s'arrête quand on perd — et le score, c'est jusqu'où on est allé.

---

## 2. Décisions verrouillées

Ces points sont tranchés. On ne les remet pas en question sans une bonne raison,
parce que l'architecture du code repose dessus.

| Sujet | Décision |
|---|---|
| Mode de jeu | **Solo, hors-ligne.** Un **leaderboard en ligne** est prévu, uniquement pour envoyer les scores (voir §4.9). |
| Vue | Vue de dessus (top-down), pixel-art 2D. |
| Durée | **Sans fin.** Vagues infinies, montée en puissance continue des deux côtés. |
| Combat | **Survivors-like** : le joueur contrôle le déplacement + ses **ultimes**. Attaque de base, visée et esquive sont automatiques. |
| Caméra | **Zoom libre à la molette.** Le jeu doit rester lisible à toutes les distances. |
| Esquive | C'est une **statistique**, pas un réflexe (ex. assassin : 10% de chance d'esquiver). |
| Mort d'un héros | **Définitive** — mais elle ne peut résulter que d'une décision du joueur (voir §4.3). |
| Changement de héros | À tout moment, **sauf sous 20% de vie** : il faut alors rentrer dans la cité. |
| IA | Un héros joué par l'IA **se replie automatiquement à 20% de vie**. L'IA ne perd donc jamais un héros. |
| Ordres | Le joueur donne des **ordres de position, de posture et de formation** aux héros IA (voir §4.4). |
| Améliorations | L'IA **ne choisit jamais**. Le choix appartient toujours au joueur. Le jeu se met en **pause** pour choisir. |
| Ressources | **Trois, jamais fusionnées** : l'XP (puissance), l'argent (matériel), les matériaux (rangs). |
| Rank up | Avec des **matériaux rares** lâchés par les monstres. |
| Fin de partie | Tous les héros morts **ou** village tombé = partie terminée. |
| Après une défaite | Le héros de départ survit, s'affaiblit et **se corrompt**. Au bout de plusieurs défaites, il bascule et devient l'antagoniste (§4.12). |

---

## 3. La boucle de jeu

```
   PROLOGUE (une seule fois par partie)
   Choix de classe → arrivée au village en ruine → exploration libre,
   dialogue avec les PNJ → on apprend l'absence de Protecteur → on accepte le poste

                              ↓

   ┌────────────────────────────────────────────────────────┐
   │  PHASE DE VILLAGE  (temps calme)                       │
   │  · se promener, parler aux PNJ                         │
   │  · dépenser l'XP : réparations et améliorations        │
   │  · dépenser l'argent : armes, équipement, totems       │
   │  · attribuer les montées de niveau en attente          │
   │  · placer et orienter les défenses                     │
   │  · donner les ordres et formations aux héros IA        │
   │  · choisir quel héros on incarnera                     │
   └────────────────────────────────────────────────────────┘
                              ↓
      déclenchement aléatoire — délai allongé si le village
      a subi de gros dégâts à la vague précédente (§4.6)
                              ↓
   ┌────────────────────────────────────────────────────────┐
   │  VAGUE  (combat)                                       │
   │  · le joueur incarne un héros, les autres sont en IA   │
   │  · switch libre entre héros — sauf sous 20% de vie     │
   │  · ultimes activables                                  │
   │  · les défenses agissent seules                        │
   │  · chaque kill donne de l'XP au héros qui l'a fait     │
   │  · montée de niveau du héros incarné → PAUSE + choix   │
   │  · un héros IA à 20% de vie se replie automatiquement  │
   └────────────────────────────────────────────────────────┘
                              ↓
   ┌────────────────────────────────────────────────────────┐
   │  BILAN DE VAGUE                                        │
   │  · versement de l'argent                               │
   │  · dégâts subis par le village à réparer               │
   │  · nouveaux héros parfois disponibles au recrutement   │
   └────────────────────────────────────────────────────────┘
                              ↓
                    retour à la phase de village
                 (jusqu'à la défaite — le jeu est sans fin)
```

---

## 4. Les systèmes

### 4.1 Classes et rangs

Quatre classes de départ : **guerrier**, **chevalier**, **mage**, **assassin**.
Le joueur en choisit une au tout début de la partie.

Chaque classe se définit par ses statistiques de base, son attaque automatique
(portée, cadence, zone d'effet), ses **ultimes** et son comportement d'IA.

Certaines classes sont **extrêmement rares** et n'apparaissent qu'aux rangs élevés —
le **nécromancien** en est l'exemple type.

#### Le rang est un plafond de niveau

```
F · E · D · C · B · A · A+ · A++ · S · S+ · S++ · SR · SRR · SRR+ · SRR++
```

Le rang n'est pas une simple étiquette de rareté : **c'est le niveau maximum qu'un
héros peut atteindre**. Un héros de rang F est bloqué au **niveau 10** — arrivé là, il
ne gagne plus aucune XP. Pour qu'il reprenne sa progression, il faut le faire **monter
en rang**.

**Comment on monte en rang** : avec des **matériaux rares lâchés par les monstres**, de
plus en plus rares à mesure qu'on vise haut. Le rank up est donc directement lié au
combat — c'est ce qui donne une raison de continuer à affronter les vagues même quand on
est riche.

Une montée de rang produit trois effets :

1. elle **multiplie ses statistiques** ;
2. elle **augmente son nombre d'ultimes** ;
3. elle **augmente la probabilité qu'une compétence très rare soit proposée** à chaque
   montée de niveau.

**Pourquoi ce système est bon** : il crée deux leviers de progression de natures
différentes. Le **niveau** est fréquent, petit, et c'est un choix du joueur. Le **rang**
est rare, énorme, et c'est un investissement. Un héros F au niveau 10 n'est pas un
héros mort : c'est un héros en attente. Ça donne une vraie utilité aux recrues de bas
rang au lieu d'en faire du déchet.

Et surtout, le troisième effet est le plus fin : le rang ne change pas seulement les
chiffres, il change **la qualité des choix qu'on te propose**. Un héros de haut rang ne
tape pas juste plus fort — il tire de meilleures cartes. C'est ce qui fait qu'un rang
se ressent au lieu de se lire dans un tableau.

#### Compétences

À chaque montée de niveau, le joueur choisit une **compétence** parmi celles qui lui
sont proposées. Les compétences ont des **raretés**, et la chance de tomber sur les plus
rares dépend du rang du héros.

> Le détail chiffré n'est pas encore écrit — voir §6.

### 4.2 Combat

Le joueur contrôle **deux choses** : son déplacement et son **ultime**.
Tout le reste est automatique :

- l'attaque de base part toute seule à sa cadence ;
- la cible est choisie automatiquement (probablement l'ennemi le plus proche à portée) ;
- l'esquive est un jet de probabilité sur la statistique du héros.

**Les ultimes** sont des capacités puissantes à rechargement, propres à chaque classe.
Ce sont les **seuls boutons du jeu** : ils portent tout le sentiment d'agir plutôt que
de subir, et ils sont le principal marqueur d'identité entre les classes. Ils doivent
être spectaculaires, et le moment où on les déclenche doit être une vraie décision.

**Une touche par ultime**, chacun avec son propre rechargement. Le nombre d'ultimes
disponibles dépend du **rang** du héros (§4.1).

**Le déplacement se fait au clavier ou à la souris**, au choix du joueur : on peut
cliquer un point pour s'y rendre, ou maintenir le bouton pour guider le héros en
continu. Le clavier reprend toujours la main dès qu'on l'utilise. Ce double contrôle
ouvre aussi la porte à une version tactile plus tard, sans rien changer au design.

> Conséquence : le clavier du joueur s'enrichit à mesure qu'il progresse. Un héros de
> rang F se joue presque uniquement au déplacement ; un héros de haut rang devient un
> vrai instrument à plusieurs touches. La montée en rang se **ressent dans les doigts**,
> pas seulement dans les chiffres — c'est une très bonne chose, à condition que les
> premiers ultimes restent lisibles et qu'on n'en empile pas dix.

**Conséquence de design à protéger** : le déplacement doit porter le reste de la
compétence. Chaque classe doit avoir une distance idéale différente. Le mage veut
rester loin, l'assassin veut être dans le dos, le chevalier veut être devant et
encaisser. Si toutes les classes se jouent à la même distance, le jeu n'a plus qu'un
seul bouton pour de vrai.

**Le trait de classe** — ajouté après le premier test de jeu. Des statistiques
différentes ne suffisent pas : deux classes aux chiffres distincts mais au même
comportement se jouent pareil. Chaque classe a donc une **règle qui n'appartient
qu'à elle** :

| Classe | Trait | Effet |
|---|---|---|
| Guerrier | Fauchage | Frappe un demi-cercle entier, là où les autres touchent un cône étroit |
| Chevalier | Riposte | Blesse quiconque le touche : plus on l'attaque, plus il tue |
| Mage | Déflagration | Chaque tir explose et touche tout le groupe |
| Assassin | Mise à mort | Coups critiques fréquents, et la cadence la plus rapide du jeu |

C'est le trait, pas la fiche de statistiques, qui doit faire dire au joueur « je ne
joue pas du tout pareil avec celui-là ».

### 4.3 Héros, IA et permadeath — la règle des 20%

C'est le système central du jeu. Il tient en trois règles :

1. **Un héros joué par l'IA se replie automatiquement dès qu'il tombe à 20% de vie.**
   Il décroche et retourne vers la cité. **L'IA ne perd donc jamais un héros.**
2. **Le joueur peut changer de héros à tout moment** — sauf si le héros qu'il incarne
   est **sous 20% de vie**. Dans ce cas il est *verrouillé* dessus, et doit réussir à
   **ramener ce héros dans la cité** pour pouvoir en changer.
3. **La mort est définitive**, sans retour.

**Pourquoi c'est très bien construit** : la conséquence de ces trois règles, c'est
qu'un héros ne peut mourir **que par une décision du joueur**. L'IA ne te fera jamais
perdre un personnage que tu as monté pendant dix heures. Toute perte vient d'un choix
assumé : tu es resté trop longtemps, tu as poussé trop loin, tu n'as pas su rentrer.
C'est exactement ce qu'il faut pour que la mort définitive soit dramatique au lieu
d'être injuste.

Et le verrou sous 20% transforme la fuite en **séquence de jeu à part entière** : tu ne
peux pas te débarrasser d'un héros mourant en changeant de personnage, il faut le
sortir de là, blessé, à travers la vague. C'est le meilleur moment du jeu.

**Le totem d'immortalité** : un objet **très coûteux**, équipable sur un héros, qui le
protège de la mort définitive. C'est la soupape de sécurité, et son prix est ce qui
l'empêche de casser la tension — on ne peut pas en équiper tout le monde.

**La cité** est le refuge et le pivot de tout le système. Un héros qui y entre est à
l'abri : plus personne ne le vise, et il se soigne. C'est là que les héros repliés se
remettent avant de repartir, et c'est le seul endroit où le joueur peut abandonner un
héros sous les 20%. Elle n'est pour l'instant qu'un cercle de pierre au milieu de
l'arène — le vrai village arrive au jalon 5.

**Le reste du système de héros IA** :

- Tous les héros non incarnés sont joués par l'**IA** et combattent réellement.
- Un héros joué par l'IA **gagne de l'XP et monte de niveau** normalement.
- Ses améliorations sont mises **en attente**. Quand le joueur reprend ce héros, il
  choisit lui-même toutes les améliorations accumulées.

Un héros négligé n'est donc pas un héros gâché : il t'attend avec des choix en réserve.
Le système récompense la rotation entre les personnages.

### 4.4 Ordres et formations

Le joueur ne subit pas l'IA, il la **commande**. Il peut décider :

- **Où** un héros IA se rend sur la carte (point de ralliement) ;
- **Quelle posture** il adopte : temporiser, attaquer agressivement, se replier ;
- **Quelle formation** l'équipe tient : les tanks devant, les soigneurs derrière, etc.

C'est la couche tactique du combat. Avec un joueur qui ne fait que bouger et lâcher un
ultime, ce sont ces ordres qui portent la profondeur du jeu.

> Cela implique l'existence d'une classe **soigneur** — à confirmer, voir §6.

### 4.5 Vagues

- Déclenchées à des **moments aléatoires** pendant la phase de village.
- Les monstres attaquent le village ; les défenses placées agissent automatiquement.
- Récompenses : **XP par kill** (au héros qui tue) et **argent en fin de vague**.
- Franchir des vagues débloque le **recrutement de nouveaux héros**.
- **Montée en puissance sans fin** : les monstres deviennent de plus en plus forts,
  indéfiniment. Les améliorations du joueur sont **cumulables** sans plafond.

### 4.6 Village et dégâts

Le village est à la fois le hub, l'objectif et l'enjeu. Il commence **en ruine** et se
restaure progressivement. On y parle aux PNJ, on y dépense ses ressources.

**S'il tombe, la partie est terminée.**

**Dégâts et délai de la vague suivante** : plus le village a pris cher, plus la vague
suivante **met de temps à arriver**. C'est un mécanisme d'auto-régulation malin : le
joueur en difficulté reçoit automatiquement le temps de se refaire, sans qu'on ait
besoin d'un mode facile.

> ⚠️ Point de vigilance : il faudra vérifier qu'encaisser des dégâts volontairement
> pour gagner du temps de préparation n'est jamais rentable. Le coût de réparation doit
> toujours dépasser la valeur du temps offert. C'est un réglage de chiffres, pas un
> problème de conception — mais il faut y penser au moment de l'équilibrage.

### 4.7 Défenses

Le joueur **dispose et oriente ses défenses avant la vague**. C'est une phase de
décision à part entière, pas un menu.

**Progression de l'arsenal** : on commence avec de simples **balistes**, et on monte
jusqu'à des **canons laser** et bien d'autres choses. La liste complète reste à définir,
mais la direction est claire : du bois vers la haute technologie.

### 4.8 Économie et progression

| Ressource | Vient de | Sert à |
|---|---|---|
| **XP** | Les kills, individuellement par héros | Monter les héros et améliorer le village |
| **Argent** | Le bilan de fin de vague + le salaire de Protecteur | Armes, équipement, totems d'immortalité |
| **Matériaux** | Butin lâché par les monstres | Faire monter les héros en **rang** |

Ces trois ressources ne doivent **jamais** devenir interchangeables. Si on peut convertir
l'une en l'autre, le joueur n'optimise plus qu'une seule ressource et la moitié des
décisions du jeu disparaît.

Chacune couvre un axe distinct, et c'est ce qui les rend lisibles : l'**XP** fait
progresser, l'**argent** équipe, les **matériaux** débloquent les plafonds.

**Montée de niveau** : quand le héros incarné passe un niveau, **le jeu se met en pause**
et le joueur choisit son amélioration immédiatement.

> Interprétation à confirmer : la pause ne se déclenche que pour le héros **incarné**.
> Les héros IA accumulent leurs améliorations en attente sans interrompre la partie —
> sinon, avec cinq héros en jeu, la vague serait coupée en permanence.

### 4.9 Score et leaderboard

Le jeu étant sans fin, le score naturel est **jusqu'où on est allé** : nombre de vagues
survécues, éventuellement pondéré.

À savoir avant de s'y engager :

- Un leaderboard demande un **petit serveur** pour stocker les scores. C'est le seul
  morceau en ligne du projet, et il reste optionnel : le jeu tourne sans.
- Un jeu qui s'exécute chez le joueur peut voir ses scores **falsifiés**. Pour un usage
  personnel ou entre amis, ça n'a aucune importance. Pour un classement public sérieux,
  c'est un vrai chantier à part entière.

**Décision** : on ne le construit pas maintenant, mais on **compte le score dès le
départ** pour qu'il soit prêt le jour où on branche le serveur.

### 4.10 Interface

**Barre de héros, en haut à gauche, à l'horizontale.** Elle affiche pour chaque héros :

- son portrait ;
- sa **vie** — avec un marquage très visible du **seuil des 20%**, puisque c'est lui qui
  verrouille le switch et déclenche le repli de l'IA ;
- son **XP** et sa progression vers le niveau suivant ;
- un **indicateur** quand il a des améliorations en attente ;
- qui est actuellement incarné par le joueur ;
- son état : au combat, en repli, rentré à la cité.

Cette barre n'est pas décorative : c'est l'**écran de triage** du joueur. Elle doit être
lisible d'un seul coup d'œil, en plein combat.

### 4.11 Direction artistique

**Référence principale : WorldBox.**

Ce qu'on en retient :

- **Vue de dessus, sprites petits et lisibles.** Les personnages font quelques pixels de
  haut, sans détail superflu, mais restent identifiables d'un coup d'œil grâce à leur
  silhouette et à une couleur dominante.
- **Une nature dense et vivante.** Herbe en plusieurs teintes de vert, arbres nombreux,
  cailloux et fleurs éparpillés. Le décor n'est pas un fond uni : il est riche, mais
  jamais bruyant au point de masquer les personnages.
- **Des bâtiments simples et très reconnaissables** — toits colorés, formes nettes,
  reliés par des chemins de terre tracés au sol.
- **Une palette chaude et saturée**, plutôt lumineuse malgré le contexte post-apo.

**Panneau de statistiques (2e référence)** : une fenêtre dense, à cadre sombre, qui
affiche tout d'un coup — barres de vie et de ressources en couleurs vives, bannières
d'icônes pour les traits et compétences, et une grille « Aperçu » d'une douzaine de
statistiques chiffrées avec leur icône. C'est exactement le niveau de détail qu'il faut
pour ce jeu : le joueur doit pouvoir comparer deux héros en un écran.

**Caméra : zoom libre à la molette.** Le joueur décide lui-même de sa distance —
au ras du sol pour lire un combat, très haut pour surveiller tout le village.

C'est le choix le plus souple, mais c'est **une contrainte permanente sur tout le
reste** :

- Un sprite doit rester **identifiable à petite taille** : la silhouette et la couleur
  dominante comptent plus que le détail.
- Les **effets de combat** (projectiles, dégâts, soins) doivent rester visibles de loin
  — quitte à ne pas rétrécir proportionnellement au zoom.
- L'**interface** ne zoome jamais : la barre de héros et les panneaux gardent toujours
  la même taille à l'écran. Techniquement, elle vit dans une **couche séparée** avec sa
  propre caméra — sans quoi elle grossit avec le monde et devient inutilisable.
- Il faut des **bornes** de zoom min et max, sinon le joueur trouvera la distance qui
  casse le jeu.

### 4.12 Défaite, corruption et antagoniste

Le jeu est sans fin, mais une partie se termine par une défaite. **Ce qui suit n'est pas
un recommencement — c'est une suite.**

Quand on perd :

1. Le village tombe.
2. Le **héros de départ** — celui choisi au tout début de la partie — **s'en sort**.
3. Il **perd un morceau de son pouvoir** dans sa fuite.
4. Il **gagne un degré de corruption**.
5. Il part vers **un autre village** : c'est la partie suivante.

Au bout de plusieurs défaites, la corruption l'emporte et il **bascule**. Le joueur
repart alors avec un nouveau héros de départ — et l'ancien revient comme **antagoniste**,
à la tête de ce qui vient détruire le village qu'on protège.

**Pourquoi ce système est le meilleur du jeu** :

- **Il donne un sens au monde.** Si les Protecteurs qui échouent finissent tous ainsi,
  on comprend d'un coup pourquoi tant de villages n'ont plus de Protecteur, et d'où
  viennent les monstres. Le pitch du §1 cesse d'être un décor : il devient la
  **conséquence directe de la boucle de jeu**.
- **L'antagoniste est personnel.** Ce n'est pas un méchant écrit à l'avance : c'est ton
  propre personnage, avec ta classe, tes compétences, ton équipement et tes choix. Chaque
  joueur affronte un boss différent — le sien.
- **La défaite construit au lieu d'effacer.** Perdre ne remet pas les compteurs à zéro,
  ça fabrique le contenu de la suite. C'est rare qu'un système de recommencement raconte
  quelque chose.

> Les détails — combien de défaites avant la bascule, ce qu'on perd exactement, ce que
> devient le boss ensuite — sont en §6.

---

## 5. Ordre de construction

On ne construit pas dans l'ordre de l'histoire, mais dans l'ordre du risque : le plus
incertain d'abord. À chaque jalon, le jeu doit être **jouable** — moche, mais jouable.

| Jalon | Contenu | On sait quoi à la fin |
|---|---|---|
| **0** | ✅ Squelette technique | La plomberie fonctionne |
| **1** | ✅ Arène, héros, auto-attaque, ultimes, traits de classe, ennemis, mort | **Oui, bouger est amusant** — valide au test du 6 août |
| **2** | ✅ XP, montée de niveau, pause et choix d'amélioration | La boucle de combat tourne |
| **3** | ✅ Équipe, IA, règle des 20%, cité, switch, barre d'équipe, mort définitive | Le cœur du jeu est là |
| **4** | Ordres, postures et formations | La couche tactique existe |
| **5** | Village hub, PNJ, phase de préparation, argent, équipement | Les deux moitiés du jeu sont reliées |
| **6** | Défenses à placer, de la baliste au canon laser | La tower-defense existe |
| **7** | Restauration du village, améliorations cumulables, montée en puissance infinie | La partie longue existe |
| **8** | Recrutement, rangs F→SRR++, classes rares | La collection existe |
| **9** | Prologue, choix de classe, dialogues, narration | Le jeu a un début |
| **10** | Défaite, corruption, retour du héros en antagoniste | Le jeu a une **suite** |
| **11** | Leaderboard en ligne | Le score compte pour de vrai |

Le jalon 1 est le plus important du projet. Si se déplacer et lâcher un ultime n'est pas
agréable pendant 30 secondes d'affilée, aucun système au-dessus ne le sauvera — et mieux
vaut le découvrir en semaine 1 qu'en mois 6.

---

## 6. Questions ouvertes

À trancher plus tard, sans bloquer le code actuel :

- [ ] **Combien de défaites avant que le héros bascule ?** Un nombre fixe, ou une jauge
      de corruption qui monte plus ou moins vite selon la façon dont on a perdu ?
- [ ] **Que perd exactement le héros à chaque défaite ?** Des niveaux, son rang, son
      équipement, ses compétences ? C'est ce qui décide si enchaîner les défaites reste
      jouable ou devient désespéré.
- [ ] **Que devient l'ancien héros une fois devenu antagoniste ?** Il revient une seule
      fois, ou il hante toutes les parties suivantes ? Peut-on le vaincre définitivement,
      voire le récupérer ?
- [ ] La corruption se voit-elle sur le sprite du héros au fil des défaites ?
- [ ] Quels **matériaux** existe-t-il, et sont-ils spécifiques au rang visé ?
- [ ] Bornes de zoom minimum et maximum
- [ ] Statistiques chiffrées et attaque automatique de chacune des 4 classes
- [ ] Niveau maximum de chaque rang au-delà du F (F = 10)
- [ ] Liste des compétences et de leurs raretés
- [ ] Ultime de chaque classe
- [ ] Existe-t-il une classe **soigneur** ? Les formations du §4.4 la supposent.
- [ ] Comment recrute-t-on un héros ? Il se présente, on l'achète, on le trouve ?
- [ ] Liste des défenses entre la baliste et le canon laser
- [ ] Coût du totem d'immortalité, et est-il consommé à l'usage ou permanent ?
- [ ] Peut-on soigner un héros blessé rentré à la cité, et à quel prix ?

### Tranché récemment

- ✅ Garde-fou de la permadeath → **la règle des 20% + le totem d'immortalité** (§4.3)
- ✅ Tous les héros morts → **fin de partie**
- ✅ Village tombé → **fin de partie**
- ✅ Héros recrutés → **système de rangs F→SRR++**, avec des classes très rares
- ✅ Défenses → **de la baliste au canon laser**
- ✅ Dégâts du village → **plus ils sont lourds, plus la vague suivante tarde**
- ✅ Fin du jeu → **sans fin**, améliorations cumulables, monstres toujours plus forts
- ✅ Rôle du rang → **plafond de niveau** + multiplicateur de stats + nombre d'ultimes +
  chance de compétence rare (§4.1)
- ✅ Entre deux parties → **on garde son héros de départ**, affaibli et corrompu, qui
  part vers un autre village, jusqu'à basculer et devenir l'antagoniste (§4.12)
- ✅ Direction artistique → **WorldBox** (§4.11)
- ✅ Caméra → **zoom libre à la molette**, avec les contraintes que ça impose (§4.11)
- ✅ Rank up → **matériaux rares lâchés par les monstres** (§4.1)
- ✅ Ultimes multiples → **une touche par ultime**, chacun son rechargement (§4.2)

---

## 7. Hors périmètre pour l'instant

Noté pour ne pas l'oublier, mais **on n'y touche pas** :

- Multijoueur (envisagé, écarté pour la v1)
- Simulation du village hors-ligne
- Serveur de leaderboard (le score, lui, est compté dès le début — §4.9)
- Sortie sur Steam / packaging en exécutable
- Son et musique
