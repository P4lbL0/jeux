# §6 Questions ouvertes

> [← Sommaire du design](../DESIGN.md)

---

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
- [ ] Coût du totem d'immortalité (sa consommation à l'usage est tranchée, §4.3)
- [ ] Peut-on soigner un héros blessé rentré à l'église, et à quel prix ?
- [ ] **Combien de niveaux a l'église, et que coûte chacun ?** Les quatre axes sont écrits
      (§4.22), leur découpage en paliers ne l'est pas.
- [ ] **La liste des traits et des états** (§4.23), et ce que chacun décale exactement.
      Un trait ne doit jamais valoir plus qu'un seuil ou un délai.
- [ ] **Quels indices trahissent un fou à la porte**, et de combien ils déplacent la
      probabilité. C'est tout l'équilibrage du bloc 4 (§4.18).
- [ ] Combien de temps met l'église à se relever, et avec combien de bois ?
- [ ] Un habitant qui défend l'église peut-il y mourir, ou seulement être blessé ?
- [ ] La limite absolue de population — celle qui n'existe que pour le §4.17. 60 ? 100 ?
- [ ] Les chemins qui s'usent : au bout de combien de passages, et ils s'effacent en
      combien de jours ? (§4.24)
- [ ] **30 minutes de jour et 15 de nuit, est-ce le bon chiffre ?** C'est la question du
      bloc 2, et elle ne se tranche qu'en jouant. Les durées vivent dans une seule table.
- [ ] **Le blé et le poisson se comportent-ils vraiment différemment ?** S'ils finissent
      par se valoir, il faut les fusionner en une seule nourriture (§4.18).
- [ ] Combien de temps un habitant met-il à grandir avant de pouvoir travailler ?
- [ ] La cloche de rappel a-t-elle un coût, ou peut-on la sonner en boucle ?
- [ ] La sauvegarde : elle passera par **Supabase**, pas par `localStorage`. Tant qu'elle
      n'existe pas, rafraîchir la page est une nouvelle partie — et c'est assumé.

## Tranché récemment

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
- ✅ La carte → le village **adossé à la mer (ouest) et à la montagne (sud)**, deux flancs
  fermés, deux fronts seulement : **nord et est** (§4.6)
- ✅ Les habitants → un **métier**, un **rang** et un **niveau**, et le rang ne change
  qu'une chose : la **cadence de production** (§4.18)
- ✅ Les fronts s'ouvrent **progressivement** : le nord seul, puis l'un des deux, puis les
  deux — et toujours **annoncés** (§4.6)
- ✅ Récolte à **deux vitesses** : les habitants en continu, le joueur à la main mais
  **seulement pendant la phase de village** (§4.18)
- ✅ Un habitant **fuit** dès qu'un ennemi approche, et ne meurt **que s'il est rattrapé** —
  donc que si le joueur a laissé ce flanc sans personne (§4.18)
- ✅ Le rythme → un **cycle jour/nuit**, 30 minutes de jour et 15 de nuit (§4.19)
- ✅ La nuit a un **effectif défini** ; épuisé avant l'aube, elle devient calme (§4.19)
- ✅ Le jour n'est jamais sûr : une **horde** peut tomber à tout moment, annoncée
  quelques secondes à l'avance seulement (§4.19)
- ✅ Le nombre de monstres à l'écran **baisse fortement** ; la difficulté monte par la
  force, jamais par le nombre (§4.17, §4.19)
- ✅ Fin de partie → **plus un seul habitant vivant**, et non une jauge d'intégrité (§4.18)
- ✅ Le joueur récolte **en frappant** la ressource, avec son attaque automatique (§4.18)
- ✅ Habitants : le **niveau** se gagne en travaillant, le **rang** s'achète (§4.18)
- ✅ Les habitants reçoivent des **postures** comme les héros, plus une **cloche** de
  rappel général (§4.18)
- ✅ Le blé et les **champs** s'ajoutent à la pêche : deux nourritures, deux niveaux de
  risque (§4.18)
- ✅ Les habitants arrivent par **naissance**, par les **portes** ou en allant chercher
  des **survivants** — et un arrivant peut être un **fou** (§4.18)
- ✅ Une **tour est une position, pas une arme** : c'est l'occupant qui décide de ce qui
  en sort, et la tour a des points de vie (§4.20)
- ✅ Les **murs** bloquent et se cassent : on peut se murer, mais s'enfermer ne sauve
  jamais (§4.20)
- ✅ La météo et les catastrophes deviennent **un jalon à part**, après le village (§4.21)
- ✅ La carte devient une **grille modifiable**, cuite au démarrage depuis les formules
  actuelles (§4.21)
- ✅ Le jeu se met en **pause** quand la fenêtre perd le focus (§4.19)
- ✅ **L'église est le cœur du village** (§4.22) : refuge des civils, seul lieu de soin,
  lieu de purge des états, origine de l'Oracle — et **le cap des monstres**
- ✅ L'église détruite n'est **pas** une défaite : elle se relève, mais tout s'effondre en
  attendant. La seule défaite reste « plus un habitant vivant » (§4.18, §4.22)
- ✅ Les monstres ont l'église pour **cap**, et les héros les en **détournent** dans leur
  rayon de vue (§4.22)
- ✅ Les habitants **défendent** l'église, mais sans arme et sans statistique de combat :
  ils ralentissent et ils encaissent (§4.22)
- ✅ Les habitants ont des **traits**, des **humeurs** et des **états** — trois couches
  distinctes, jamais choisies, soignées à l'église (§4.23)
- ✅ Un état non soigné **peut tuer**, mais lentement et visiblement (§4.18, §4.23)
- ✅ Les caprices n'existent **qu'au calme** : « on boude à l'abri, jamais sous les
  crocs » (§4.23)
- ✅ Le fou passe à l'acte sur un **tirage caché** — ça contredit sciemment la règle de
  l'arbitrage, et c'est payé par trois contreparties (§4.18)
- ✅ Le joueur **aménage son village** à la Clash of Clans : mode édition en pause,
  construction libre, déplacement **gratuit et instantané** (§4.24)
- ✅ **Tout ce qui est bâti se casse**, y compris les maisons et l'église — la destruction
  passe du jalon 8 au jalon 5 (§4.20, §4.24)
- ✅ Le village **démarre en ruines** : trois maisons pour trois habitants, et chaque
  arrivant en relève une (§4.24)
- ✅ **Pas de plafond dur de population** : le frein est la nourriture et les toits, avec
  une limite absolue placée hors d'atteinte (§4.18)
- ✅ Le totem d'immortalité est **consommé à l'usage** (§4.3)
- ✅ Les héros mangent, mais par **ration d'équipe forfaitaire** montant par palier
  d'effectif, jamais par tête (§4.18)
- ✅ **Une seule fiche** pour les héros et les habitants, grande, avec le **renommage**
  (§4.10)
- ✅ Un menu d'**options** : volumes séparés, touches remappables, pause **Échap** — les
  curseurs d'abord, les sons ensuite (§4.10)
