# Document de design — Le Protecteur

> Document de référence du projet. Toute décision de gameplay se prend ici **avant** d'être codée.
> Si le code et ce document se contredisent, c'est le document qui a raison : c'est le code qu'on corrige.
>
> Dernière mise à jour : 2026-08-06 (jalon 4 : ordres et formations)

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

Sept classes : **guerrier**, **chevalier sacré**, **mage**, **assassin**, **rôdeur**,
**oracle** et **nécromancien**. Le joueur en choisit une au tout début de la partie.

Chacune a son **lore**, ses statistiques, son **trait** (§4.2), son ultime et ses
compétences propres (§4.13).

**On peut recruter plusieurs héros de la même classe.** Deux guerriers ne sont pas
redondants : ils n'auront ni le même rang, ni les mêmes compétences, ni les mêmes
évolutions. C'est la conséquence naturelle d'un système où le build compte plus que
l'étiquette.

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
| Chevalier Sacré | Serment | Blesse quiconque le touche : plus on l'attaque, plus il tue |
| Mage | Déflagration | Chaque tir explose et touche tout le groupe |
| Assassin | Mise à mort | Coups critiques fréquents, et la cadence la plus rapide du jeu |
| Rôdeur | Volée | Tire trois flèches en éventail à chaque attaque |
| Oracle | Verbe | Chaque attaque soigne aussi l'allié le plus blessé autour d'elle |
| Nécromancien | Relèvement | Il n'attaque jamais : chaque cadavre peut se relever pour lui |

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

Le joueur ne subit pas l'IA, il la **commande**. Il peut décider **où** un subordonné se
rend, **quelle posture** il adopte, et **quelle formation** l'équipe tient.

C'est la couche tactique du combat. Avec un joueur qui ne fait que bouger et lâcher une
capacité, ce sont ces ordres qui portent la profondeur du jeu.

#### Un seul système, deux populations

Tout ce qui obéit au joueur — **héros joué par l'IA** et **mort-vivant du Nécromancien**
(§4.14) — reçoit exactement le même objet :

```
Ordre = { posture, ancre }
```

L'**ancre** est soit un point de la carte, soit **une entité à suivre**. C'est ce second
cas qui donne gratuitement le « protéger ce héros » du §4.14 : protéger quelqu'un, c'est
s'ancrer sur lui. Deux systèmes de commandement séparés, ce serait deux fois le travail
et deux fois les bugs — il n'y en a donc qu'un.

#### Les trois postures

| Posture | Le héros IA… | Le mort-vivant… |
|---|---|---|
| **Temporiser** *(défaut)* | tient son ancre, n'engage que ce qui vient à lui, garde ses capacités pour les gros paquets | tient la position |
| **Agressif** | va chercher l'ennemi loin de son ancre, colle sa cible, lâche ses capacités dès qu'elles sont prêtes | charge |
| **Repli** | décroche vers la cité et y reste jusqu'à guérison | revient au nécromancien |

Concrètement, une posture ne fait que régler trois chiffres : la **laisse** (jusqu'où il
s'éloigne de son ancre), la **distance de combat** qu'il cherche à tenir, et le **nombre
d'ennemis** à partir duquel il déclenche une capacité. Rien de plus. C'est volontaire :
un système d'ordres qui a sa propre logique de combat en parallèle de l'IA, c'est deux
IA à déboguer.

> ⚠️ **Aucune posture ne passe outre la règle des 20%.** Un héros en posture agressive
> qui tombe au seuil critique décroche quand même, et rien ne peut l'en empêcher. Si un
> ordre pouvait annuler le repli automatique, le joueur pourrait tuer un héros sans le
> décider vraiment — et tout le §4.3 s'effondre. C'est la règle la plus importante de ce
> système, et elle doit être **testée**, pas seulement écrite.

#### Qui reçoit l'ordre

La sélection est souple, parce que les besoins le sont : parfois on redéploie toute
l'équipe, parfois on rappelle un seul blessé, parfois on veut que **tous les distants**
reculent d'un coup.

- **Rien de sélectionné** → l'ordre vaut pour **toute l'équipe IA**.
- **Un ou plusieurs héros sélectionnés** → l'ordre ne vaut que pour eux.
- **Toute une classe d'un coup** → tous les héros de cette classe rejoignent la sélection.

Le héros incarné n'obéit jamais : c'est le joueur qui le pilote.

#### Les formations

Une formation attribue à chaque héros un **poste**, une place relative à un point
d'ancrage. Ancre par défaut : le **héros incarné** — la formation le suit donc en
permanence, et le joueur déplace toute sa ligne en se déplaçant lui-même.

Le poste dépend du **rôle** de la classe, pas de son nom : c'est une donnée de plus dans
`classes.ts`, au même titre que la portée.

| Rôle | Classes | Place |
|---|---|---|
| **Avant** | Guerrier, Chevalier Sacré | Devant l'ancre, face à la menace |
| **Flanc** | Assassin | Sur les côtés, il prend à revers |
| **Centre** | Oracle, Nécromancien | Au milieu, protégé, à portée de ses blessés |
| **Arrière** | Mage, Rôdeur | Derrière, hors de la mêlée |

Trois formations pour commencer :

- **Libre** — aucun poste, chacun joue sa distance idéale. C'est le comportement actuel,
  et il reste le défaut.
- **Mur** — les rôles s'étagent face à la menace. La formation d'attaque et de progression.
- **Cercle** — tout le monde autour de l'ancre, les avants tournés vers l'extérieur. La
  formation de siège, quand on est encerclé ou qu'on tient la cité.

Les formations suivantes ne s'achètent pas : elles **s'apprennent** par l'expérience de
groupe (§4.16).

> Un poste n'est pas une laisse courte : un héros à son poste se bat normalement contre
> ce qui l'approche, il revient simplement à sa place quand la pression retombe. Une
> formation qui fige les héros produirait des cibles immobiles, et le §4.17 rappelle
> qu'un héros qui ne bouge pas se fait encercler.

#### Les commandes

Le combat ne s'arrête **jamais** pour donner un ordre. C'est un survivors-like : une
pause tactique à chaque décision détruirait le rythme qui fait tout le jeu.

| Commande | Effet |
|---|---|
| **Clic droit** sur le sol | Ancre la sélection sur ce point |
| **Clic droit** sur un allié | Ancre la sélection sur lui — c'est le « protège-le » |
| **Clic droit** sur un portrait | Ajoute / retire ce héros de la sélection |
| **Maj + clic droit** sur un portrait | Sélectionne toute sa classe |
| **W** / **X** / **C** | Temporiser / Agressif / Repli |
| **V** | Change de formation |
| **Échap** | *Rompez* : efface la sélection **et** toutes les positions tenues à la main |

Une ancre posée à la main **détache** le héros de la formation — sinon l'ordre le plus
précis serait le seul à ne rien faire. C'est à ça que sert *Rompez* : sans lui, un héros
envoyé tenir un carrefour y resterait le restant de la partie.

Le clic **gauche** ne change pas de rôle : il déplace le héros incarné et ouvre les
fiches. Gauche, c'est *moi* ; droite, c'est *les autres*.

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

**Montée de niveau** : la courbe d'XP est **volontairement raide** — plus le niveau est
haut, plus il coûte cher. Sans ça, un jeu sans fin voit ses niveaux défiler et perdre
tout sens.

**Un choix de compétence tous les 5 niveaux seulement.** Les niveaux intermédiaires
donnent une progression discrète de statistiques ; les paliers de 5 sont des moments de
décision. Quand le héros incarné y arrive, **le jeu se met en pause** et le joueur
choisit. Rare, donc important — et ça laisse respirer le combat.

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

### 4.13 Compétences

Les compétences sont **le contenu principal du jeu**. C'est par elles que deux parties
avec la même classe ne se ressemblent pas.

#### Les trois natures

| Nature | Ce que c'est |
|---|---|
| **Passive** | Un effet permanent, aucune touche |
| **Active** | Une capacité déclenchée par le joueur, avec son rechargement et sa touche |
| **Automatique** | Une capacité qui part toute seule dès qu'elle est rechargée |

**Les actives et les automatiques rejoignent le panneau des capacités**, aux côtés de
l'ultime de classe. C'est le même système : une touche chacune, un rechargement chacune.
Le clavier du joueur s'enrichit donc à mesure qu'il progresse.

#### Paliers et évolutions

Une compétence se **reprend** pour monter d'un palier : elle devient plus forte à chaque
fois. À certains paliers, elle propose une **évolution** — un choix qui change sa nature,
et parfois **l'allure du héros à l'écran**. Le build se voit.

Exemple : le *Moulinet* du guerrier peut devenir *Tourbillon d'acier* (il aspire les
ennemis au lieu de les repousser, le héros vire au bleu) ou *Lames rouges* (tout ce qu'il
inflige pendant le moulinet lui revient en vie, le héros vire au rouge).

#### Rangs

Les compétences portent les mêmes lettres que les héros : **F · E · D · C · B · A · S ·
SR · SSR**. Plus le rang d'un héros est élevé, plus il a de chances de se voir proposer
une compétence de rang élevé — c'est le troisième effet d'une montée de rang (§4.1).

#### Les armes autonomes

Une famille à part, ouverte à toutes les classes. **Elles se battent sans qu'on s'en
occupe** — et c'est exactement ce qu'il faut dans un jeu où le joueur ne contrôle que son
déplacement : elles font monter la puissance sans ajouter une touche de plus.

| Rang | Nom | Effet |
|---|---|---|
| F | Épée tournoyante | Jusqu'à 5 lames en orbite. → *Lames ardentes* (dégâts doublés) ou *Nuée de lames* (+2 épées) |
| E | Aura de flammes | Tout ce qui s'approche brûle en continu |
| E | Éclats | Des projectiles partent au hasard, régulièrement |
| D | Ricochet | Les projectiles transpercent au lieu de s'arrêter |
| C | Chaîne d'éclairs | Les attaques sautent d'un ennemi à l'autre. → *Foudre diffuse* (rebonds illimités, dégâts divisés) ou *Fulguration* (2 rebonds, chacun +60%) |

#### Les compétences de classe

**Chevalier Sacré**

| Rang | Nom | Effet |
|---|---|---|
| F | Sursaut sacré | *Auto.* Régulièrement : invincible 1 s, rend 25% des PV max, repousse tout. |
| C | Serment de fer | À chaque passage sous 50% de vie, +8 résistance **définitivement**. |
| B | Jugement | *Active.* Une colonne de lumière écrase la zone visée. → *Croisade* (la colonne le suit 6 s) ou *Absolution* (elle soigne au lieu de blesser). |
| A | Endurance sacrée | +1 PV max tous les 25 kills. |
| S | Bénédiction | *Active.* Un dôme de lumière régénère les alliés à l'intérieur. |
| SR | Provocation | Tout ennemi dans le rayon ne cible plus que lui. +1 résistance par ennemi qui le vise, **+1 PV rendu** par mort à ses pieds. |
| SR | Bouclier des âmes | *Auto.* Il **donne de sa propre vie** aux alliés sous 30%. Il ne crée rien : il déplace. |
| SSR | Martyre | *Active.* Tous les dégâts de l'équipe lui sont transférés et il ne peut pas mourir. |

**Guerrier**

| Rang | Nom | Effet |
|---|---|---|
| D | Charge | *Active.* Il fonce en ligne droite et renverse tout. → *Charge sismique* (le sol se fissure) ou *Charge sanglante* (il traverse et revient). |
| E | Moulinet | *Active.* Il tourne 2 à 3 s en fauchant. → *Tourbillon d'acier* ou *Lames rouges*. |
| C | Cri de guerre | *Active.* Repousse tout, et l'équipe entière frappe plus fort. |
| B | Sang pour sang | **Il ne peut plus jamais être soigné**, mais chaque kill lui rend 4% de sa vie max. |
| A | Entaille | +1% de dégâts tous les 25 kills. |
| S | Rage | +1% de vitesse d'attaque par point de pourcentage de vie manquante. |
| SR | Le dernier debout | +25% de dégâts par allié mort ou replié. |
| SSR | Apothéose | Toutes ses statistiques sont doublées, maintenant et après. |

**Mage**

| Rang | Nom | Effet |
|---|---|---|
| E | Clignement | *Active.* Il se téléporte, et laisse une déflagration là où il était. |
| D | Dôme | *Active.* Un dôme avec ses propres points de vie, posé où le joueur veut. |
| B | Satellite | Des éclats en orbite. → *satellites de feu* ou *de givre*. |
| A | Savoir arcanique | +1% de dégâts tous les 25 kills. |
| A | Sablier | *Active.* Le temps ralentit dans une large zone — pour les monstres seulement. |
| S | Familier | Une créature permanente se bat à ses côtés et **grandit à chacun de ses niveaux**. → *Golem* (mur qui provoque) ou *Spectre* (rapide, invisible, il achève). |
| SSR | Exil | *Active.* Il sacrifie 99% de sa vie pour bannir toutes les créatures hostiles. **Personne ne gagne d'expérience.** Il reste 30 s immobilisé à 1 PV, insoignable, tué au moindre contact. |

**Assassin**

| Rang | Nom | Effet |
|---|---|---|
| D | Invisibilité | *Active.* Il disparaît : plus rien ne le vise, et il court plus vite. |
| D | Marque de sang | Sa première attaque sur une cible neuve inflige ×2,5. |
| C | Croc-en-jambe | *Active.* Des lames au sol : tout ce qui passe saigne. |
| B | Doppelgänger | *Active.* Un double immobile attire tout, puis explose. |
| A | Saignée | +1% de vol de vie tous les 25 kills. |
| SR | Danse des ombres | Chaque kill retire 0,4 s à **tous** ses rechargements. |
| SSR | Hécatombe | *Active.* Tout ennemi sous 10% de vie est exécuté, et chaque exécution le projette sur la cible suivante. |
| SSR | Contrat | *Active.* La cible mourra dans 10 s quoi qu'il arrive — mais il ne peut attaquer **personne d'autre** entre-temps. |

**Trait inné de l'assassin** : il n'est pas ciblé en priorité tant qu'un autre héros se
trouve à proximité de l'ennemi.

**Rôdeur**

| Rang | Nom | Effet |
|---|---|---|
| E | Flèche perforante | Ses flèches traversent les corps. |
| D | Piège à mâchoires | *Active.* Le premier qui marche dessus reste sur place. |
| C | Œil de lynx | +45 de portée, +8% de critique. |
| SR | Carquois sans fin | Sa volée passe de 3 à 7 flèches. |
| SSR | Flèche du jugement | *Active.* Une flèche traverse tout l'écran et achève net tout ce qui est déjà blessé. |

**Oracle**

| Rang | Nom | Effet |
|---|---|---|
| E | Prière | *Active.* Soigne l'allié le plus mal en point, où qu'il soit sur la carte. |
| C | Présage | +5% d'esquive pour **toute l'équipe**. |
| B | Chant de guerre | *Active.* L'équipe entière frappe nettement plus vite. |
| SSR | Résurrection | Une fois dans la partie — **une seule** — un héros qui tombe se relève. |

**Nécromancien**

| Rang | Nom | Effet |
|---|---|---|
| E | Charnier | +10% de chance de relever un cadavre. |
| D | Armée des ombres | Ses morts-vivants sont +40% plus puissants. |
| C | Lien nécrotique | Ses morts-vivants explosent en tombant. |
| SR | Seigneur des tombes | Ses morts-vivants ne se décomposent plus. |
| SSR | L'Appel | *Active.* Il sacrifie toute son armée pour dresser un colosse fait de leurs restes. |

#### Les grandes communes

| Rang | Nom | Effet |
|---|---|---|
| D | Vétéran | Un niveau immédiat. |
| E | Charognard | Les cadavres laissent parfois de quoi tenir debout. |
| B | Écho | 20% de chance qu'une capacité ne parte pas en rechargement. |
| A | Serment du protecteur | **+25% à tout tant qu'on se bat près de la cité.** Elle attache mécaniquement le combat au village. |
| S | Fardeau | −30% de vie max, +60% de dégâts. |
| SR | Orage final | *Active.* Un orage te suit et foudroie sans répit pendant 10 s. |
| SSR | Heure sombre | *Active.* **Le temps s'arrête 3 s pour tout le monde sauf toi.** |

> **L'*Exil* mérite d'être protégé.** C'est la compétence la plus intéressante de la
> liste, parce que c'est la seule qui te fait **perdre** quelque chose : tu effaces la
> vague, mais tu renonces à toute son expérience, et tu laisses ton mage trente secondes
> à découvert avec un point de vie. Ce n'est pas un bouton « je gagne », c'est un pari.
> Il ne faudra jamais l'adoucir.

### 4.14 Le Nécromancien

Ce n'est pas une classe de plus : c'est un **autre jeu greffé sur le premier**.

> *Il ne lève jamais la main sur personne. Il attend que les autres tombent, il
> s'accroupit, et il leur parle. Le village le tolère parce qu'il rend des bras — mais
> personne ne mange à sa table.*

**Il n'attaque pas.** Jamais. Sa portée est nulle, et l'IA le garde **dans la cité**.
Ce sont ses morts qui travaillent à sa place.

**Le relèvement** : chaque cadavre — ennemi ou allié — a **8% de chance** de se relever à
son service, et **douze morts-vivants au maximum** peuvent le suivre en même temps. Cette
probabilité s'améliore avec ses compétences. Un mort-vivant a des statistiques calculées
**d'après le niveau du nécromancien** : plus il monte, plus son armée monte avec lui.

> Le taux était à 25% au départ : l'armée devenait un mur qui jouait la partie à la place
> du joueur, et l'écran devenait illisible. C'est aux compétences de faire monter ce
> chiffre, pas au taux de base.

**Le commandement des sbires** — c'est ce qui rend le Nécromancien intéressant à
incarner. Quand le joueur le contrôle, il ne se bat pas : **il donne des ordres à ses
morts.**

- les **positionner** où il veut sur la carte ;
- leur faire **tenir une position** coûte que coûte ;
- les lancer à la **charge** ;
- leur faire **protéger** un héros ou un bâtiment.

C'est une classe de commandement, pas de combat. Sans ces ordres, ce n'est qu'un bonus
passif qu'on laisserait à l'IA toute la partie — avec eux, c'est le seul héros qui se
joue comme un stratège.

**Ce qui reste à construire** (dépend de systèmes qui n'existent pas encore) :

- [ ] **Le tri de fin de vague.** À chaque fin de vague, le joueur choisit **un seul**
      mort-vivant à conserver définitivement. Les autres retombent. Ça demande des vagues
      avec un début et une fin nette — aujourd'hui les ennemis arrivent en continu.
- [ ] **La main-d'œuvre.** Les morts-vivants conservés peuvent être affectés au **travail
      du village**, à la **défense**, ou au **combat**. Ça demande le village du jalon 5
      et son économie.

**Pourquoi cette classe est intéressante** : c'est la seule dont la puissance ne vient
pas de ce qu'elle fait, mais de ce qui est *déjà mort*. Elle transforme les pertes — les
tiennes comprises — en ressource. Et elle donne au village une population qui n'a pas
besoin d'être nourrie.

> Les ordres aux sbires **partagent le même système** que les ordres aux héros IA : même
> objet `Ordre`, mêmes postures, même sélection (§4.4). « Tenir une position » est la
> posture *temporiser*, « charger » est la posture *agressif*, et « protéger un héros »
> est simplement une ancre posée sur ce héros.

### 4.15 L'effectif : dix dehors, le reste en garnison

**Dix héros au maximum peuvent sortir** de la ville en même temps. Au-delà, les autres
**restent en garnison** — et ils ne sont pas inactifs : ils **défendent la ville** si des
monstres franchissent les défenses.

C'est une bonne règle pour trois raisons :

1. Elle **plafonne le chaos à l'écran** sans plafonner la collection. On peut recruter
   trente héros, on n'en verra jamais plus de dix au combat.
2. Elle crée une **vraie décision avant chaque vague** : qui sort, qui garde la maison.
3. Elle donne un **rôle aux héros faibles** au lieu d'en faire du rebut : un rang F
   suffit à tenir un mur.

### 4.16 Formations et expérience de groupe

**Plus un groupe de héros combat ensemble, plus il devient fort.** Chaque paire de héros
accumule de l'expérience commune, et cette expérience :

- donne des **bonus de statistiques** au groupe qui a l'habitude de travailler ensemble ;
- **débloque des formations** — des dispositions apprises, pas achetées.

C'est le meilleur système de la liste, parce qu'il **punit doucement la rotation** que
tout le reste du jeu encourage. Tu veux tourner entre tes héros pour ramasser leurs choix
en attente, mais tu veux aussi garder une équipe soudée. Cette tension-là, aucun autre
système du jeu ne la produisait.

#### Comment ça se gagne

L'affinité se compte **par paire de héros**, en **secondes de combat partagé** : les deux
doivent être dehors, réellement au combat. Ni la cité, ni le repli, ni la garnison ne
comptent — on n'apprend pas à travailler ensemble en se soignant chacun dans son coin.

**Dix minutes de combat côte à côte** amènent une paire à son maximum.

#### Ce que ça donne

**+10% de dégâts au plafond. Une seule statistique, et c'est tout.**

Un héros ne cumule pas ses liens : son bonus est la **moyenne** de ses affinités avec les
alliés qui se battent avec lui à cet instant. Sortir avec trois vieux camarades vaut donc
mieux que sortir avec un seul — mais sans jamais dépasser les 10%.

Une seule statistique, et pas deux : « +10% de dégâts **et** +10% de cadence » ferait
+21% de dégâts par seconde, et « confortable, jamais décisif » deviendrait un mensonge.
Et ce n'est ni la vie maximum ni la vitesse : une vie maximum qui dérive lentement ferait
bouger la jauge de vie toute seule, ce qui est illisible.

#### L'oubli

**Une affinité s'efface quand les deux héros cessent de sortir ensemble** — six fois plus
lentement qu'elle ne se gagne, et seulement quand au moins l'un des deux est au combat.
Une équipe qui se repose ne perd rien.

> ⚠️ C'est le point de vigilance du système. L'oubli punit exactement la rotation que la
> règle des 20% et les choix en attente cherchent à encourager. Deux garde-fous le
> tiennent :
>
> - le **plancher d'acquis** : une paire ne redescend jamais sous **25%** de son meilleur
>   niveau. Ce qui a vraiment été appris ne se perd pas — on rouille, on ne désapprend pas.
> - le **plafond de 10%**, qui fait qu'oublier un lien coûte au pire 10% de dégâts.
>
> S'il s'avère en jeu que le joueur n'ose plus faire tourner son équipe, c'est le facteur
> d'oubli qu'on baisse en premier — pas le bonus.

Les trois premières formations (libre, mur, cercle) sont acquises d'emblée. Ce sont les
**suivantes** qui s'apprendront par l'affinité, quand il y en aura.

### 4.17 Tenir la fluidité

Le jeu s'est mis à ramer lourdement au bout de quelques minutes. **Ce n'était pas un
problème de données** — c'était le nombre d'objets vivants à l'écran. Les règles tirées
de cet épisode, à ne plus jamais enfreindre :

1. **Tout ce qui apparaît doit avoir un plafond.** Les ennemis (240), les morts-vivants
   par nécromancien (12), les nombres flottants (24 à l'écran). Sans plafond, la cadence
   d'apparition finit toujours par dépasser la vitesse à laquelle on tue.
2. **La montée en difficulté passe par la force, pas par le nombre.** Une fois le plafond
   atteint, ce sont les statistiques des ennemis qui montent. C'est aussi plus lisible.
3. **Aucun objet Texte créé en plein combat.** Un texte Phaser fabrique sa propre texture ;
   en créer des dizaines par seconde suffit à faire tomber le jeu. On les recycle.
4. **Aucune minuterie par coup encaissé.** Avec les dégâts de zone et les chaînes, on en
   créait des centaines par seconde. Un simple horodatage vérifié dans la boucle suffit.
5. **Rien qui trie une liste par ennemi et par image.** Ce qui est commun à toute l'image
   se calcule une fois, pas une fois par entité.

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
| **4** | ✅ Ordres, postures et formations, expérience de groupe (§4.16) | La couche tactique existe |
| **5** | Village hub, PNJ, phase de préparation, argent, équipement | Les deux moitiés du jeu sont reliées |
| **6** | Défenses à placer, de la baliste au canon laser | La tower-defense existe |
| **7** | Restauration du village, améliorations cumulables, montée en puissance infinie | La partie longue existe |
| **8** | Recrutement, rangs F→SRR++, classes rares, effectif de 10 et garnison (§4.15) | La collection existe |
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
- [ ] **Y a-t-il des dégâts physiques et des dégâts magiques ?** Les compétences parlent
      d'« attaque physique » et d'« attaque magique ». Tant que les monstres n'ont pas de
      résistances séparées, la distinction ne change rien — pour l'instant c'est une
      seule statistique de dégâts. À trancher avant d'écrire les monstres.
- [ ] **Rage du guerrier** : +1% de vitesse d'attaque par *point de vie* manquant, ou par
      *pourcentage* de vie manquante ? C'est actuellement le pourcentage (donc +100% au
      maximum) ; le premier deviendrait démesuré à mesure que la vie max monte.
- [ ] **Trait de l'assassin** : « il ne se fait pas cibler en priorité si un tank est
      autour mais a moins de PV que la moyenne » — la seconde partie reste à préciser.
- [ ] Statistiques chiffrées et attaque automatique de chacune des 4 classes
- [ ] Niveau maximum de chaque rang au-delà du F (F = 10)
- [ ] Liste des compétences et de leurs raretés
- [ ] Ultime de chaque classe
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
- ✅ Courbe d'XP → **de plus en plus raide** (§4.8)
- ✅ Choix de compétence → **tous les 5 niveaux**, rareté liée au rang (§4.8, §4.13)
- ✅ Compétences → **actives, automatiques ou passives**, à paliers, avec évolutions (§4.13)
- ✅ Le Chevalier devient le **Chevalier Sacré**
- ✅ Fiche de héros consultable en cliquant un portrait (§4.10)
- ✅ Provocation → chaque mort à ses pieds **le soigne de 1**, sans toucher à sa vie max
- ✅ Trois nouvelles classes : **Rôdeur**, **Oracle**, **Nécromancien** (§4.1, §4.14)
- ✅ On peut recruter **plusieurs héros de la même classe** (§4.1)
- ✅ **Dix héros dehors** au maximum, le reste en garnison défend la ville (§4.15)
- ✅ **Expérience de groupe** : combattre ensemble donne des bonus et débloque des formations (§4.16)
- ✅ Classe **soigneur** → c'est l'**Oracle**, il n'en faut pas une seconde (§4.1)
- ✅ Ordres → **un seul système** pour les héros IA et les sbires : posture + ancre,
  sélection souple, sans jamais mettre le jeu en pause (§4.4)
- ✅ Formations → des **postes** relatifs à une ancre, attribués par le **rôle** de la
  classe (avant / flanc / centre / arrière) (§4.4)
- ✅ Expérience de groupe → **+10% de dégâts au plafond**, une seule statistique, la
  moyenne des liens et non leur somme (§4.16)
- ✅ Une affinité **s'efface** quand la paire cesse de sortir ensemble — six fois plus
  lentement qu'elle ne se gagne, et jamais sous 25% de son record (§4.16)

---

## 7. Hors périmètre pour l'instant

Noté pour ne pas l'oublier, mais **on n'y touche pas** :

- Multijoueur (envisagé, écarté pour la v1)
- Simulation du village hors-ligne
- Serveur de leaderboard (le score, lui, est compté dès le début — §4.9)
- Sortie sur Steam / packaging en exécutable
- Son et musique
