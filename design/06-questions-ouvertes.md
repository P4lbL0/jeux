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
      la ralentit (§4.23). — *Calibré au bloc 5 pour six mauvaises nuits, table
      `REGLAGES_STRESS`. **Mesuré en jeu : une nuit dehors sans se faire toucher ne rend
      que 5 à 8 points**, donc ce sont les coups encaissés qui dominent. Reste à trancher
      sur une partie entière.*
- [ ] Les **seuils de satisfaction** exigés par chaque niveau d'église (§4.22). — *40 / 55 /
      70 sont en place et **branchés** depuis le bloc 5. Mesuré : un village calme, nourri
      et sans mort récent tourne autour de 50-51 dès le premier jour, donc le niveau 2 est
      atteignable. Les seuils 55 et 70 n'ont jamais été joués.*
- [x] Combien de **pièces de portrait** faut-il pour que deux habitants ne se ressemblent
      jamais (§4.23) ? — **Réglé** : onze couches, plus de dix millions de combinaisons. La
      vraie contrainte n'était pas le nombre de pièces mais le nombre de **textures
      vivantes**, plafonné à 96.
- [ ] Combien de temps dure une **rupture**, et le stress doit-il redescendre à 75 % après
      (§4.23) ? Les deux valeurs en place — 2 minutes réelles et 75 % — sont des premiers
      jets posés au bloc 5.
- [ ] Combien de temps l'église met à **purger un état**, et combien de lits il faut
      (§4.22). 20 secondes par lit au bloc 5, jamais joué avec une file d'attente.
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
- ✅ **La sauvegarde** — tranchée le 10 août 2026, et **dans l'autre sens que ce qui était
      écrit ici**. La ligne disait « elle passera par Supabase, pas par `localStorage` ».
      C'est l'inverse : le `localStorage` est la sauvegarde, Supabase en est une **copie**.
      Une sauvegarde qui a besoin du réseau disparaît avec le réseau. **Trois
      emplacements**, règle **ironman** (on écrase, mort comprise), tout est au §4.28.

### Ouvertes depuis le 10 août 2026

- [ ] **La double spécialisation** (Guerrier + Gardien → Templier, Mage + Chronomancien →
      Archimage temporel, Rôdeur + Ingénieur → Chasseur mécanique, Nécromancien + Blood
      Knight → Seigneur de sang). **Non tranchée** : Gardien, Chronomancien, Ingénieur et
      Blood Knight n'existent nulle part dans le document. Trois issues possibles — des
      voies qu'on ne recrute pas, de vraies classes en plus, ou l'abandon parce que les
      fusions du §4.25 font déjà le travail de différenciation.
- [ ] **Le mot « totem » désigne deux choses différentes** : le totem d'immortalité
      (§4.3) et le totem de guerre (§4.7). Il faut en renommer un avant de coder.
- [ ] Le système de **charges** qu'exige la compétence *Réserve* (§4.13) — à coder, ou à
      couper.
- [ ] Combien de compétences un héros porte-t-il **en pratique** avant que le panneau de
      capacités devienne illisible ? Il n'y a pas de limite d'emplacements (§4.25), mais il
      y a une limite de clavier.
- [ ] À quel palier exactement une **fusion** se propose, et peut-on la refuser
      définitivement ou revient-elle à chaque niveau ?
- [ ] Combien de **séquelles** différentes faut-il, et à quelle fréquence un sauvetage in
      extremis en donne une — toujours, ou parfois (§4.23) ?
- [ ] Le seuil de **relation** au-delà duquel une compétence de groupe s'active (§4.25,
      §4.26), et la vitesse à laquelle une relation se gagne et s'oublie.
- [ ] Combien de **ruptures de stress** avant qu'un héros bascule en antagoniste (§4.12),
      et combien d'annonces avant que ça arrive.
- [ ] Le rechargement des **défenses catastrophiques** en nombre de nuits (§4.7).
- [ ] À quelle fréquence les **pillards** attaquent, et à partir de quelle richesse du
      village ils s'intéressent à lui (§4.18).
- [ ] Que fait exactement l'**Intelligence** en chiffres : combien de matériaux économisés,
      combien d'XP en plus (§4.23) ?
- [ ] Combien d'**initiatives** par nuit au maximum avant que ça devienne du bruit (§4.27) ?

### Ouvertes depuis le 11 août 2026 — à régler en jouant le bloc 6c

- [ ] **Combien de lignes le journal garde-t-il** ? Six est un premier jet. Trop peu et une
      mauvaise nuit efface son propre début ; trop et ça devient un mur de texte (§4.10).
- [ ] **À quelle vitesse le survivant suit-il** le joueur, et à quelle distance faut-il
      l'approcher pour qu'il se lève ? Deux chiffres inventés au bloc 6c2, jamais joués.
- [ ] **Un sauvetage sur deux infaisable, est-ce le bon dosage ?** C'est ce que donne le
      tirage plat 2-40. Assumé hardcore — mais jamais mesuré sur une partie entière (§4.18).
- [ ] **Le plancher d'un survivant tous les cinq jours suffit-il** à sortir un village d'un
      cul-de-sac de réputation, ou est-ce trop lent pour changer quoi que ce soit (§4.18) ?
- [ ] **La contagion fongique se voit-elle vraiment** quand on ramène un infecté, ou passe-
      t-elle inaperçue faute de voisins de travail assez proches (§4.23) ?

### Le 10 août 2026, au soir — la porte et le port

- ✅ **Le bloc 6 se livre en deux** : **6a la porte**, **6b le port**. Trois systèmes
  indépendants dans un seul bloc, c'était un bloc injugeable (§5)
- ✅ **Les naissances passent après le bloc 7** : elles exigent un toit libre, et les toits
  n'existent qu'avec le mode d'aménagement (§4.18, §4.24)
- ✅ **Un arrivant toutes les 2 à 3 journées** à réputation moyenne — presque un par jour
  au-dessus de 80, plus personne sous 25 (§4.18)
- ✅ La **réputation** n'est **pas une jauge de plus** : c'est la satisfaction du village
  moins les morts récents. Une deuxième jauge aurait mesuré la même chose (§4.18, §4.23)
- ✅ **Refuser ne coûte que le bras qu'on n'aura pas** : aucun malus de réputation. La
  prudence est déjà payante à sa façon, la punir deux fois serait injuste (§4.18)
- ✅ **Sur dix arrivants, deux ou trois sont fous.** Assez pour qu'un village qui dit oui à
  tout en héberge trois, assez peu pour qu'accepter reste le bon réflexe (§4.18)
- ✅ **La folie a trois degrés** — le voleur, le saboteur, le meurtrier — et c'est le degré
  qui décide de l'acte. **Le feu appartient au degré 3** et s'allumera au jalon 6, quand
  les incendies existeront (§4.18, §4.21)
- ✅ **Les indices penchent avec le degré, sans jamais le dire** : plus il est fou, plus il
  tend à montrer trois signaux plutôt que deux (§4.18)
- ✅ **Trois lignes d'observation, toujours trois**, chaque axe ayant une version alarmante
  **et une rassurante**. Ça tranche une contradiction interne du §4.18, qui promettait
  « trois indices montrés » et « 0 à 1 pour un innocent » dans la même page (§4.18, §4.10)
- ✅ **Les fourchettes de signaux se recouvrent** — innocent 0 à 2, fou 1 à 3 — et c'est une
  correction venue du jeu. Sans recouvrement, compter les lignes suffisait à trancher dès
  qu'on avait appris les six phrases alarmantes, ce que le §4.18 interdit explicitement.
  Zéro innocente et trois accusent ; tout le doute vit entre les deux (§4.18)
- ✅ **Les survivants sortent du 6b et deviennent le bloc 6c** : un système de terrain
  complet, qui ne partage rien avec le commerce (§5)
- ✅ **Le navire n'a pas d'horaire** : une voile paraît environ **une journée calme sur
  trois**, et calme veut dire jour + plus un monstre debout + aucun mort récent. C'est
  l'imprévisibilité qui empêche l'attente optimale que des prix mouvants créent d'habitude
  — les deux idées ne marcheraient ni l'une ni l'autre séparément (§4.18)
- ✅ **Un cours par ressource**, qui dérive lentement entre 0,6 et 1,6 fois le prix de base.
  Un cours global n'aurait jamais changé *ce qu'on charge*, seulement « vendre ou pas »
  (§4.18)
- ✅ **Vendre fait baisser le cours de ce qu'on vend**, et il remonte les journées
  suivantes. C'est ce qui remplace le plafond de cargaison : le frein devient économique
  au lieu d'être une règle arbitraire (§4.18)
- ✅ **Les prix de base** : minerai 1 pièce pour 2 unités, bois 1 pour 4, blé 1 pour 5,
  poisson 1 pour 6 — ce qui est dur à sortir vaut cher, ce qu'un flanc fermé protège vaut
  peu (§4.18)
- ✅ **On vend les quatre ressources, blé compris**, donc on peut s'affamer soi-même. La
  seule contrepartie est que le panneau de vente affiche les journées de vivres restantes
  pendant qu'on charge (§4.18, §4.10)
- ✅ **Relever le port coûte 80 bois et une demi-journée** — moins que l'église, parce que
  c'est un appontement et pas une cathédrale, et parce que c'est lui qui débloque l'argent
  dont l'église a besoin (§4.18, §4.22)
- ✅ **Le premier visiteur est offert, dès le premier matin.** Au rythme de croisière la
  première porte se serait ouverte après deux heures de jeu, et on peut apprendre un jeu
  pendant deux heures sans jamais croiser un de ses systèmes. Le rythme reprend dès la
  deuxième arrivée (§4.18)
- ✅ **Il frappe 1 à 2 journées après son arrivée**, jamais le jour même ; le voleur part
  avec les stocks, **le saboteur et le meurtrier restent et ne sont jamais démasqués**, et
  recommencent 4 à 8 journées plus tard. C'est ce qui fait exister les groupes (§4.18)
- ✅ **Un groupe de trois frappe la même nuit, chacun son acte** : le risque devient
  exponentiel sans qu'aucun comportement neuf ne soit à écrire (§4.18)
- ✅ **Les questions de la porte sont tirées au sort ; les réponses ne le sont jamais** —
  elles sont déterminées par la personne. Quatre questions tirées d'une grande banque, et
  on peut toutes les poser (§4.10)
- ✅ **Le port est debout en ruine dès la première minute** et se relève comme l'église,
  plutôt que d'inventer une touche de construction que le bloc 7 défera (§4.18, §4.22)
- ✅ **La vente au port est à sens unique et plafonnée par visite.** C'est la seule
  conversion du jeu, et elle **annule** la moitié d'une règle du §4.8 et du §4.18 (« ni en
  argent ») — les deux paragraphes sont réécrits. Les quatre ressources récoltées, elles,
  restent inconvertibles entre elles (§4.8, §4.18)
- ✅ **Le §4.8 ne fait plus venir l'argent du « bilan de fin de vague »** : il n'y a plus de
  vagues depuis le bloc 2, le jeu compte en journées (§4.8, §4.19)

### Le 11 août 2026 — le journal et les survivants (bloc 6c)

- ✅ **Le jeu ne parle plus qu'à un seul endroit** : un **journal** en bas à droite, six
  lignes gardées, la plus récente en bas. Il **remplace la bannière d'annonce** du milieu de
  l'écran, qui disait une chose à la fois et l'effaçait en quatre secondes — donc perdait la
  première des deux quand deux événements tombaient ensemble, ce qui arrive exactement quand
  ça compte (§4.10)
- ✅ **Pas de minimap.** Envisagée en haut à droite, puis abandonnée le jour même. Le journal
  donne la **direction** — « quelque part au nord » — jamais la position, et chercher fait
  partie du sauvetage (§4.10, §4.18)
- ✅ **Le bloc 6c se coupe en deux** : **6c1 le journal**, **6c2 les survivants**. Le journal
  reçoit les événements qui existent déjà, donc il se juge avant que rien n'en dépende (§5)
- ✅ Un survivant paraît **le jour**, sur **n'importe quel bord praticable** — pas seulement
  les deux fronts — et **attend jusqu'au crépuscule** (§4.18)
- ✅ **Trois situations tirées au sort** : seul, poursuivi, blessé. Le **blessé** tire entre
  l'**hémorragie** (mort en une journée), la **blessure palier 2** (cinq à sept jours) et
  l'**infection fongique contagieuse** — le premier usage réel de la contagion du §4.23, et
  le seul cas où ce qu'on ramène met en danger **les autres** (§4.18, §4.23)
- ✅ **La meute est tirée au moment où le joueur a le visu** (340 px, le rayon de vue qui
  ferme déjà le camping), et elle fait **2 à 40 monstres, tirage plat**. Donc environ **un
  sauvetage sur deux est infaisable** : on arrive, on voit, on fait demi-tour. Le jeu est
  assumé **hardcore et infinissable** (§4.18, §4.6, §4.17)
- ✅ **Plafond dur à 40** — le §4.17 règle 1 l'exige, et l'écran est limité à 60 monstres
  depuis le bloc 2 (§4.17, §4.19)
- ✅ **Il suit dès qu'on l'approche**, il ne se défend pas, il est plus lent que le héros :
  c'est le **trajet du retour** qui est dangereux, pas l'aller (§4.18)
- ✅ **La fiche d'observation se rejoue à l'arrivée** — même fiche, même mode, même code
  qu'à la porte. Il peut être **fou dans la même proportion** (2 à 3 sur 10), mais **son
  état est écrit noir sur blanc** : la folie se devine, la maladie se lit (§4.10, §4.18)
- ✅ **Refuser un survivant ne coûte rien** — même règle qu'à la porte, la prudence ne se
  punit pas deux fois. C'est dur (on a risqué sa peau pour lui) et c'est volontaire : sans
  la fiche, le survivant serait une ressource gratuite qu'on ramasse (§4.18)
- ✅ **Mourir en chemin coûte la moitié d'un habitant tué** sur la rumeur. À zéro, échouer ne
  coûterait que du temps ; à plein tarif, on ne sortirait plus jamais et le bloc mourrait
  avec (§4.18)
- ✅ **La réputation pilote le rythme, avec un plancher d'un tous les cinq jours** que la
  porte n'a pas. Sans lui, un village sous 25 de réputation n'a plus aucune voie de
  peuplement — porte fermée, naissances absentes avant le bloc 7 — et c'est un cul-de-sac
  dont rien ne le sort (§4.18, §4.24)
- ✅ **Le héros blessé rare reste au jalon 9** : il a besoin des rangs et du recrutement, que
  le §4.18 renvoie lui-même à ce jalon (§4.18, §4.1)

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
- ✅ Direction artistique → **WorldBox** pour le monde (§4.11). ⚠️ **Plus pour l'interface**
  depuis le 11 août : voir la dernière entrée de cette liste
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
- ✅ **Six indices**, en trois axes montrés par arrivant. ⚠️ *Cette ligne disait « un
  innocent en montre 0 à 1, un fou 2 à 3 » : c'est **périmé** depuis la correction du
  10 août au soir. Les fourchettes **se recouvrent** — innocent **0 à 2**, fou **1 à 3** —
  parce que sans recouvrement, compter les lignes suffisait à trancher* (§4.18)
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

### Le 10 août 2026 — les traits, les builds et la mémoire

- ✅ Une **cinquième couche** : la **séquelle**. Survivre au stade *Mourant* laisse un
  handicap lourd, ineffaçable et jamais tiré au sort. C'est la seule chose du jeu qui
  échappe à la règle « un trait vaut 2 à 5 % », et elle produit le meilleur dilemme du
  document : le garder, ou l'envoyer mourir héroïquement (§4.23)
- ✅ **Cinq traits de naissance et trois traits d'exploit de plus** — Nyctalope, Gourmand,
  Hémophile, Kleptomane, Sang-Froid, Boucher, Déraciné, Légende locale (§4.23)
- ✅ **Trois états qui ne suivent pas le rythme des 5 à 7 jours** : l'**hémorragie** tue en
  **une journée**, l'**infection fongique** est **contagieuse** entre voisins de travail,
  la **léthargie** précède la famine. L'hémorragie contredit sciemment le principe « la
  mort est lente pour rester un arbitrage » — c'est le contraste qui la rend lisible : la
  maladie est une gestion, l'hémorragie est une urgence (§4.23)
- ✅ **Trois statistiques visibles** : Force, Courage, **Intelligence**. Les deux premières
  existent déjà dans le code sous d'autres noms ; l'Intelligence est neuve et sert à
  **bâtir plus vite pour moins de matériaux** et à monter de niveau plus vite (§4.23)
- ✅ Les **relations** sont un système **séparé** de l'affinité du §4.16 : l'affinité est
  militaire et se gagne en combattant, la relation est sociale et se gagne en vivant
  ensemble. Deux héros peuvent avoir une affinité maximale et se détester (§4.26)
- ✅ **Une mort produit des conséquences** : Veuve, Vengeance, pic de stress, tombe,
  satisfaction en berne, et un **héritage** (§4.26)
- ✅ L'héritage est **immatériel** : une compétence, un trait, une réputation, une tombe.
  **L'équipement est explicitement reporté** à un jalon ultérieur — il n'y a pas
  d'inventaire dans ce jeu pour l'instant (§4.26)
- ✅ La **mémoire du village** : des événements **typés** (massacre, victoire, famine,
  sacrifice, première fois) avec lieu, date et acteurs, dont le récit est **assemblé à
  partir de gabarits** — jamais généré librement. Ils modifient la satisfaction et les
  arrivées quelques jours, puis s'estompent dans les archives (§4.26)
- ✅ **La règle qui gouverne tout ça** : *tout événement important doit laisser une trace
  sur au moins un personnage, une relation, un bâtiment ou le village* (§4.26)
- ✅ **La vie autonome** : sans ordre, chacun enchaîne sa journée, et une **initiative** se
  déclenche quand un trait fort rencontre une situation extrême — rare, et toujours
  annoncée. Un ordre explicite l'emporte toujours (§4.27)
- ✅ On **ne fait pas** la simulation complète à la WorldBox : la journée autonome et les
  initiatives rares donnent 90 % de l'effet pour 10 % du coût. On approfondira seulement si
  le résultat paraît creux en jeu (§4.27)
- ✅ Les **tags** deviennent le socle du système de compétences — et **un élément est un
  tag, jamais un type de dégâts**. Les monstres n'ont aucune résistance élémentaire : la
  décision « une seule statistique de dégâts » du §4.2 tient intégralement (§4.25)
- ✅ **Aucune limite d'emplacements** de compétences. Le coût d'une **fusion**, c'est de
  perdre les **deux** compétences investies pour en obtenir une (§4.25)
- ✅ **26 fusions** retenues : 9 sur les compétences existantes, 10 élémentaires, 3
  négatives, 4 **secrètes** jamais affichées. Et **on crée les six bases manquantes** —
  Boule de feu, Vent, Eau, Nature, Bouclier, Téléportation — pour que les fusions
  élémentaires soient codables (§4.13, §4.25)
- ✅ Les bases élémentaires sont **ouvertes à toutes les classes mais pondérées** : le Mage
  les voit beaucoup plus souvent qu'un Guerrier, sans que rien ne soit verrouillé (§4.13)
- ✅ **Les traits pondèrent la pioche de compétences** : un Pyromane voit le FEU trois fois
  plus souvent. Une pondération, jamais un arbre fermé — les compétences deviennent la
  conséquence de la vie du personnage sans qu'aucune règle ne l'y oblige (§4.25)
- ✅ **Les 12 compétences statistiques** (Vigueur, Hâte, Célérité…) sont acceptées **aux
  rangs F et E uniquement**. C'est la seule exception à « une compétence crée un
  comportement », et elle est payée : sans elles, les passives de build n'ont rien à
  amplifier (§4.13)
- ✅ **Quatre familles de compétences hors combat** : sociales, de groupe (activées par les
  relations), de formation, et **du village** — dont la mythique « **TOUT LE MONDE AU
  MUR** ». C'est la première fois que le Protecteur a des pouvoirs de fonction (§4.25)
- ✅ **Deux classes très rares de plus** : le **Voidwalker** (néant, gravité, portail,
  singularité ; ultime *Effondrement*) et le **Bastion** (il bâtit ; ultime *ICI, PERSONNE
  NE PASSE*). Au **jalon 9** (§4.1)
- ✅ Le Bastion n'est **immobile que pendant son ultime** — une classe lente en permanence
  attaquerait le pilier « bouger est amusant » dans un jeu où le déplacement est la seule
  chose que le joueur contrôle (§4.1)
- ✅ **Un héros peut basculer en antagoniste pendant la partie**, pas seulement entre deux
  parties : le stress répété, les séquelles et les fusions maudites y mènent. Il revient
  avec ses vraies compétences, et **c'est annoncé plusieurs fois avant** (§4.12, §4.23)
- ✅ **La liste des défenses est tranchée** (§4.7) : quatre familles — statiques,
  tactiques, vivantes, catastrophiques. **Ce qui tire est au §4.7, ce qui bloque reste au
  §4.20** : murs, portes, douves, ponts-levis et tours n'y sont pas
- ✅ Les défenses **vivantes** (golem, gardien, arbre ancien, statue sacrée, esprit
  protecteur) et **catastrophiques** (canon orbital, rayon divin, portail, météore, arme
  nucléaire magique) sont **permanentes** — mais les catastrophiques se rechargent en
  **nuits** et l'arme nucléaire détruit aussi ce que le joueur a bâti (§4.7)
- ✅ La **banque** : l'argent du port se stocke, se vole, et donne enfin un deuxième lieu à
  défendre qui n'est pas l'église (§4.18)
- ✅ **Les monstres ne sont plus la seule menace** : des **pillards** puis des **bandes
  armées** humaines attaquent **de jour** et visent les stocks. C'est la façon la moins
  chère de rendre le jour incertain sans toucher au cycle 30/15 verrouillé. Jalon 8 (§4.18)
- ✅ **Le jalon 5 passe de dix à douze blocs** : la mémoire du village (bloc 11) et la vie
  autonome (bloc 12) sortent du bloc 5, qui était devenu injugeable. Et un **jalon 6.5**
  neuf porte tout le système de builds (§5)
- ✅ **L'interface n'est plus WorldBox** : **fer, os, sang** — neuf couleurs, un seul cadre,
  fond **opaque** partout, sang frais réservé à ce qui peut tuer. Le monde, lui, ne change
  pas. Un seul fichier porte la palette (§4.10, §4.11)
- ✅ **Les sept couleurs de classe quittent l'interface** et ne vivent plus que sur le
  sprite dans le monde. Conséquence assumée : sur l'écran de choix, c'est le **trait de
  classe** qui différencie deux cartes, plus leur couleur (§4.10)
- ✅ **Le journal devient une discussion** : une voix par **source** (le guet, le village,
  l'église, le port, un héros par son nom, toi), **trois lignes** fermée, tout l'historique
  ouverte sur **sept jours**, coupé par jour. Les répétitions se replient en « et 2 autres »
  au lieu de « x3 » (§4.10)
- ✅ **La ligne des touches se replie** : une ligne courte en bas au centre, `?` la déplie.
  Une plaque opaque permanente masquerait le terrain sous le héros qu'on pilote (§4.10)
