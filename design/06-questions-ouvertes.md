# §6 Questions ouvertes

> [← Sommaire du design](../DESIGN.md)

---

À trancher plus tard, sans bloquer le code actuel :

- [ ] **Combien de défaites avant que le héros bascule ?** 
on vas revoir ce systeme plus tard 
- [ ] **Que perd exactement le héros à chaque défaite ?** 
on vas voir plus tard 
- [ ] **Que devient l'ancien héros une fois devenu antagoniste ?** 
on vas voir plus tard 
- [ ] La corruption se voit-elle sur le sprite du héros au fil des défaites ?
- [ ] Quels **matériaux** existe-t-il, et sont-ils spécifiques au rang visé ?
des coeur de bete de plsu ou moins haut niv les bosse en font tomber plus et de plus haute qualiter 
- [ ] Bornes de zoom minimum et maximum
pas compris 
- [ ] **Y a-t-il des dégâts physiques et des dégâts magiques ?** 
non une seule stat 
- [ ] **Rage du guerrier** : +1% de vitesse d'attaque par *point de vie* manquant, ou par
      *pourcentage* de vie manquante ? C'est actuellement le pourcentage (donc +100% au
      maximum) ; le premier deviendrait démesuré à mesure que la vie max monte.
      yes on garde le pourcentage 
- [ ] **Trait de l'assassin** : « il ne se fait pas cibler en priorité si un tank est
      autour mais a moins de PV que la moyenne » — il a debuf de pv max 
- [ ] Statistiques chiffrées et attaque automatique de chacune des 4 classes
on verra apres 
- [ ] Niveau maximum de chaque rang au-delà du F (F = 10)
on fais x 2 
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
- [ ] Les **prix du port** : combien vaut le bois, le minerai, le poisson, et à quelle
      fréquence un navire accoste (§4.18) ?
- [ ] Combien de fous faut-il dans le village pour qu'ils **forment un groupe**, et que
      fait un groupe exactement (§4.18) ?
- [ ] La **liste complète des questions** posables à la porte, et ce que chacune révèle.
- [ ] À quelle vitesse la **jauge de stress** se remplit et se vide, et de combien le rang
      la ralentit (§4.23).
- [ ] Les **seuils de satisfaction** exigés par chaque niveau d'église (§4.22).
- [ ] Combien de **pièces de portrait** faut-il pour que deux habitants ne se ressemblent
      jamais (§4.23) ?
- [ ] Un habitant qui défend l'église peut-il y mourir, ou seulement être blessé ?
- [ ] **Combien vaut un habitant au combat** — PV, dégâts, portée, cadence — au rang F et
      niveau 1, et de combien le rang les multiplie (§4.18) ? Les valeurs de départ posées
      au bloc 4 sont volontairement dérisoires, il faudra les régler en jouant.
- [ ] Ce que coûte **l'entraînement** d'un habitant, et combien de temps il ne produit pas
      pendant (§4.18).
- [ ] Combien de **miliciens** avant qu'une milice change une nuit — et le seuil à partir
      duquel elle remplace le joueur au lieu de l'aider (§4.18).
- [ ] À quelles conditions un habitant **devient héros**, et quelle classe il obtient
      (§4.18, jalon 9).
- [ ] Les **coûts des niveaux 2, 3 et 4 de l'église** en matériaux et en population, et les
      seuils d'argent et de satisfaction qui viendront avec les blocs 5 et 6 (§4.22).
- [ ] Les paliers d'amélioration du **mur** (bois → fer → pierre) : PV et coût de chacun ;
      les PV de la **porte** ; de combien une **douve** ralentit (§4.20).
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
- ✅ **Le stress à la Darkest Dungeon** : une jauge pour tout le monde, une rupture tirée
  au sort à 100 %, la mort à 200 % (§4.23)
- ✅ Les **civils craquent aussi**, mais leurs ruptures sont civiles : ils ne frappent
  jamais personne (§4.23)
- ✅ Les **traits sont illimités**, faibles, et **le plus souvent mauvais** — l'expérience
  use plus qu'elle ne renforce (§4.23)
- ✅ Un trait s'obtient par **exploit**, jamais par tirage : tuer 200 monstres, survivre à
  une nuit sous 20 %, voir mourir trois habitants (§4.23)
- ✅ Un état non soigné tue en **5 à 7 jours**, en trois paliers annoncés (§4.23)
- ✅ Les **portraits sont assemblés par morceaux en code**, pour qu'ils puissent changer
  avec l'état du personnage (§4.23)
- ✅ Une **satisfaction du village**, somme des humeurs, des morts récents, du confort et
  des décorations — et c'est elle qui débloque les niveaux d'église (§4.22, §4.23)
- ✅ Le **port et le commerce maritime** : on vend son surplus, on gagne de l'argent, et la
  mer amène du monde — dont des fous (§4.18)
- ✅ Les arrivées dépendent de la **réputation** et du **commerce**, jamais du hasard seul
  (§4.18)
- ✅ **Six indices**, dont trois montrés par arrivant ; un innocent en montre 0 à 1, un fou
  2 à 3 (§4.18)
- ✅ Les fous **forment des groupes** quand on en laisse entrer plusieurs : le risque
  devient exponentiel, pas additif (§4.18)
- ✅ La porte se joue sur une **fiche d'observation** — portrait, observations, questions à
  poser — et non sur un moteur de dialogue (§4.10)
- ✅ **N'importe qui peut recevoir n'importe quelle tâche**, héros et habitants confondus,
  par sélection puis **menu d'ordres** (§4.4)
- ✅ Un héros au travail produit **beaucoup plus vite**, mais **seulement le jour** et **ça
  le fatigue** (§4.4)
- ✅ L'église est **debout au niveau 1** dès la première minute (§4.22)
- ✅ Un niveau d'église exige **quatre conditions** — argent, matériaux, population,
  satisfaction — et non un prix (§4.22)
- ✅ **Pas de dégâts physiques et magiques séparés** : une seule statistique (§4.2)
- ✅ Le rythme reste à **30 minutes de jour et 15 de nuit** (§4.19)
- ✅ **Il n'y a aucun abri magique.** Un habitant **entre dans l'église** et n'est protégé
  que tant qu'elle tient debout ; se tenir à côté ne protège de rien. Ça corrige une
  phrase du §4.18 qui promettait une zone sûre — le code, lui, tuait déjà (§4.18, §4.22)
- ✅ La vraie défense est **celle qu'on bâtit** : murs améliorables au **fer**, **porte**
  cassable, **douves**, douves **remplies d'eau** près de la mer, et **ponts-levis** —
  codés au **bloc 7** avec le mode d'aménagement (§4.20, §4.24)
- ✅ Le prix de la **palissade ne change pas** (12 bois, 120 PV) : on ne la rend pas moins
  chère, on la rend **améliorable** (§4.20)
- ✅ L'église : **1200 PV** au niveau 1 (+600 par niveau), **rayon de soin de 90 px**
  (+30 par niveau), relèvement à **120 bois et une journée entière** (§4.22)
- ✅ Les quatre conditions d'un niveau d'église sont **écrites en entier dès le bloc 4**,
  l'argent et la satisfaction **neutralisés** jusqu'aux blocs 6 et 5 (§4.22)
- ✅ **Les habitants ont de vraies statistiques de combat** — PV, dégâts, portée, cadence —
  faibles et montant avec le rang et le niveau. Ça annule frontalement la règle « pas de
  statistiques de combat » écrite au §4.18, au §4.20 et au §4.22 : les trois passages sont
  réécrits. La raison qui l'emporte : **les futurs héros sortent du village**, et un
  habitant sans rien de mesurable deviendrait héros par magie (§4.18)
- ✅ Trois garde-fous tiennent la digue à la place : **aucune compétence, aucune évolution,
  aucun point à distribuer** ; **dix miliciens ne remplacent pas un héros** ; **se battre,
  c'est ne pas produire** (§4.18)
- ✅ On peut **entraîner** un habitant, lui donner le métier de **milicien** qui patrouille
  les rues, et le faire **passer héros** — trois systèmes qui ont leur **propre bloc**, le
  bloc 9 du jalon 5 (§4.18, §5)
- ✅ Un villageois en **tour de guet tire vraiment**, avec ses chiffres de villageois
  (§4.20)
