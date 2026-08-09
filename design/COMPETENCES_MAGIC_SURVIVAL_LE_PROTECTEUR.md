# Le Protecteur — Nouvelles compétences inspirées de Magic Survival

## 0. Base analysée

J'ai regardé le dépôt `P4lbL0/jeux`, en particulier :

- `design/4.13-competences.md`
- `design/4.01-classes-et-rangs.md`
- `DESIGN.md`

Le système actuel prévoit déjà des compétences **passives / actives / automatiques**, des paliers, des évolutions qui changent la nature d'une compétence et parfois l'apparence du héros, ainsi que des rangs `F → SSR`. Le rang influence aussi la qualité des compétences proposées. fileciteturn6file0 fileciteturn7file0

Les compétences déjà présentes sont donc volontairement conservées comme référence.

---

# 1. Tes compétences actuelles

## Armes autonomes

| Rang | Compétence | Évolution actuelle |
|---|---|---|
| F | Épée tournoyante | Lames ardentes / Nuée de lames |
| E | Aura de flammes | — |
| E | Éclats | — |
| D | Ricochet | — |
| C | Chaîne d'éclairs | Foudre diffuse / Fulguration |

## Chevalier sacré

- F — Sursaut sacré
- C — Serment de fer
- B — Jugement → Croisade / Absolution
- A — Endurance sacrée
- S — Bénédiction
- SR — Provocation
- SR — Bouclier des âmes
- SSR — Martyre

## Guerrier

- D — Charge → Charge sismique / Charge sanglante
- E — Moulinet → Tourbillon d'acier / Lames rouges
- C — Cri de guerre
- B — Sang pour sang
- A — Entaille
- S — Rage
- SR — Le dernier debout
- SSR — Apothéose

## Mage

- E — Clignement
- D — Dôme
- B — Satellite → satellites de feu / de givre
- A — Savoir arcanique
- A — Sablier
- S — Familier → Golem / Spectre
- SSR — Exil

## Assassin

- D — Invisibilité
- D — Marque de sang
- C — Croc-en-jambe
- B — Doppelgänger
- A — Saignée
- SR — Danse des ombres
- SSR — Hécatombe
- SSR — Contrat

## Rôdeur

- E — Flèche perforante
- D — Piège à mâchoires
- C — Œil de lynx
- SR — Carquois sans fin
- SSR — Flèche du jugement

## Oracle

- E — Prière
- C — Présage
- B — Chant de guerre
- SSR — Résurrection

## Nécromancien

- E — Charnier
- D — Armée des ombres
- C — Lien nécrotique
- SR — Seigneur des tombes
- SSR — L'Appel

## Grandes communes

- D — Vétéran
- E — Charognard
- B — Écho
- A — Serment du protecteur
- S — Fardeau
- SR — Orage final
- SSR — Heure sombre

Tout ceci vient de ton `§4.13`, pas d'une proposition de ma part. fileciteturn6file0

---

# 2. Ce que je trouve déjà excellent

## 🥇 Exil

C'est probablement ma compétence préférée de tout le document.

Elle fait exactement ce qu'une bonne compétence Magic Survival-like doit faire :

> puissance énorme + coût réel + décision stratégique.

Elle supprime les ennemis, mais :

- aucune XP ;
- 99 % des PV sacrifiés ;
- immobilisation ;
- 1 PV ;
- insoignable ;
- mort au moindre contact.

Je la garderais quasiment telle quelle. fileciteturn6file0

---

## 🥈 Écho

Très bonne base de compétence « méta » :

> 20 % de chance qu'une capacité ne parte pas en rechargement.

Ça ouvre naturellement la porte à des builds autour du cooldown, des activations répétées et des chaînes. fileciteturn6file0

---

## 🥉 Danse des ombres

Très Magic Survival :

> chaque kill réduit tous les cooldowns.

Cela crée immédiatement une boucle :

`kill → cooldown → compétence → kill → cooldown`

Très satisfaisant pour un build assassin. fileciteturn6file0

---

## 4. Satellite

Très bonne idée de « compétence autonome » qui peut prendre plusieurs directions.

Je pousserais beaucoup plus ce système. fileciteturn6file0

---

## 5. Familier

Excellent parce que la compétence crée un **deuxième personnage** qui progresse.

Je ferais de cette idée une vraie famille de compétences. fileciteturn6file0

---

# 3. Ce que Magic Survival apporte comme philosophie

Magic Survival fonctionne avec des magies offensives, des passives statistiques, des compétences spéciales et surtout des **fusions**. Le jeu documenté compte des dizaines de magies et de nombreuses fusions ; les choix de niveau déterminent le build plutôt que le joueur ne contrôle directement chaque attaque. citeturn0search2turn0search4

Ce que je veux reprendre pour ton jeu n'est donc pas « copier ses sorts ».

Je veux reprendre quatre idées :

1. **une compétence peut être faible seule mais devenir folle dans un build ;**
2. **les évolutions changent le comportement, pas seulement les dégâts ;**
3. **les passives doivent modifier plusieurs compétences à la fois ;**
4. **certaines combinaisons doivent produire une nouvelle compétence.**

Magic Survival utilise par exemple des passives qui modifient la puissance, le cooldown, la taille, la durée, la portée de récupération, etc. citeturn0search2

---

# 4. Nouvelles compétences — niveau banal

Je commencerais par ajouter des petites compétences qui servent de briques.

## Statistiques

### Vigueur
+10 % PV max.

### Hâte
+8 % vitesse de déplacement.

### Célérité
-8 % cooldown des capacités.

### Concentration
+10 % durée des effets.

### Amplification
+8 % dégâts.

### Expansion
+10 % taille des zones.

### Précision
+5 % critique.

### Portée
+15 % portée.

### Régénération
+0,5 % PV max/s.

### Réserve
+1 charge maximale sur certaines compétences.

### Persistance
+10 % durée des invocations.

### Prolifération
+1 projectile pour les compétences compatibles.

Ces compétences sont volontairement banales.

Elles permettent aux compétences plus folles d'avoir des fondations.

---

# 5. Nouvelles compétences — niveau intéressant

## Projectile miroir

Chaque projectile a 20 % de chance de produire un second projectile inversé.

### Évolution A — Miroir brisé
Le second projectile fait moins de dégâts mais se divise.

### Évolution B — Réfraction
Les projectiles rebondissent sur les ennemis.

---

## Gravité

Les ennemis proches sont légèrement attirés vers le héros.

### Évolution A — Puits gravitationnel
L'attraction augmente fortement.

### Évolution B — Antigravité
Les ennemis sont repoussés au lieu d'être attirés.

---

## Orbe de mort

Un orbe tourne autour du héros et explose après plusieurs secondes.

### Évolution A — Supernova
Explosion énorme.

### Évolution B — Dévoreur
L'explosion absorbe les ennemis faibles.

---

## Lame fantôme

Une lame apparaît périodiquement derrière le héros.

Elle frappe dans la direction opposée au héros.

### Évolution A — Lames croisées
Deux lames.

### Évolution B — Exécution spectrale
Les ennemis sous 15 % PV sont exécutés.

---

## Nuage toxique

Le héros laisse une zone toxique derrière lui.

### Évolution A — Brouillard mortel
Le nuage reste beaucoup plus longtemps.

### Évolution B — Venin vivant
Le nuage se déplace lentement vers les ennemis.

---

# 6. Nouvelles compétences — niveau très intéressant

## Essaim

Une nuée de petits projectiles cherche automatiquement les ennemis.

### Évolution — Ruche

Les projectiles peuvent créer de nouveaux projectiles à l'impact.

---

## Frappe orbitale

Des projectiles tombent autour du héros à intervalles réguliers.

### Évolution A — Bombardement
Zone beaucoup plus grande.

### Évolution B — Satellite de guerre
Les projectiles restent en orbite avant de tomber.

---

## Lien de foudre

Deux ennemis proches sont reliés par un éclair.

Les dégâts se transmettent entre eux.

### Évolution A — Réseau
Le lien peut créer plusieurs connexions.

### Évolution B — Surcharge
Chaque ennemi supplémentaire augmente les dégâts.

---

## Lame boomerang

La lame part devant le héros puis revient.

### Évolution A — Double tranchant
Deux lames.

### Évolution B — Tempête de lames
La lame laisse des copies sur son trajet.

---

## Dévoreur

Les ennemis sous un seuil de PV sont absorbés.

Chaque absorption donne temporairement :

- dégâts ;
- vitesse ;
- taille.

### Évolution — Faim infinie

Les bonus s'empilent tant que le héros continue de tuer.

---

# 7. Nouvelles compétences — très rares

## Cœur élémentaire

Le héros choisit une affinité :

🔥 Feu  
❄️ Glace  
⚡ Foudre  
☠️ Poison  
🌑 Ombre  
✨ Sacré

Chaque compétence élémentaire reçue ensuite peut interagir avec le cœur.

---

## Résonance

Lorsqu'une compétence est utilisée, une autre compétence du même élément a une chance de se déclencher gratuitement.

Exemple :

`Feu → Feu → Feu → Feu`

Ça crée des builds mono-élément.

---

## Surcharge

Lorsqu'une compétence atteint son niveau maximum, elle peut continuer à recevoir de l'XP.

Chaque niveau supplémentaire :

> + puissance MAIS + coût en cooldown / PV / corruption.

C'est un excellent système pour le late game.

---

## Parasite

Une compétence choisie aléatoirement devient beaucoup plus puissante.

Mais le héros perd progressivement une autre statistique.

Cela crée des builds « maudits ».

---

# 8. Compétences de build

C'est la partie que j'ajouterais le plus.

## Seigneur du feu

Toutes les compétences de feu :

+25 % dégâts.

Mais surtout :

> les effets de feu peuvent maintenant déclencher les réactions de feu.

Inspiré de la logique de passifs spécialisés de Magic Survival. citeturn0search2

---

## Tempête

Toutes les compétences électriques :

+20 % dégâts.

Et :

> les ennemis mouillés deviennent conducteurs.

---

## Seigneur des morts

Toutes les compétences de nécromancie :

+25 % durée.

Et :

> chaque 10 morts-vivants augmente légèrement la puissance de l'armée.

---

## Maître des lames

Toutes les compétences de lame :

+20 % dégâts.

Et :

> les critiques peuvent créer une lame supplémentaire.

---

# 9. Système que je recommande fortement : Tags

Chaque compétence devrait avoir des tags.

Exemple :

```text
Boule de feu

Tags :
FIRE
PROJECTILE
AREA
MAGIC
EXPLOSION
```

Une autre :

```text
Chaîne d'éclairs

Tags :
LIGHTNING
CHAIN
MAGIC
AUTO
```

Une passive pourrait dire :

```text
+25 % aux compétences FIRE
```

ou :

```text
Les compétences AREA gagnent +20 % de taille
```

ou :

```text
Chaque compétence PROJECTILE peut générer +1 projectile
```

Cela donne une architecture parfaite pour les builds et les futures fusions.

---

# 10. Fusions que je ferais immédiatement

## 🔥 Boule de feu + 🌪 Vent

### Tempête incendiaire

Le feu se déplace avec les courants d'air.

---

## ⚡ Foudre + 💧 Eau

### Orage conducteur

La foudre se propage sur les surfaces mouillées.

---

## ❄️ Glace + ⚡ Foudre

### Tempête de givre

Les ennemis gelés attirent les éclairs.

---

## ☠️ Poison + 🔥 Feu

### Gaz inflammable

Les zones toxiques deviennent inflammables.

---

## 🌑 Ombre + 💀 Mort

### Armée spectrale

Les cadavres proches deviennent des spectres.

---

## 🩸 Sang + 🗡 Lame

### Lame vampirique

Les dégâts soignent.

---

## 🛡 Bouclier + ⚡ Foudre

### Bouclier conducteur

Les ennemis qui frappent le bouclier prennent des dégâts électriques.

---

## 🔥 Feu + 💀 Mort

### Nécroflamme

Les cadavres brûlés reviennent sous forme de morts-vivants enflammés.

---

## 🌿 Nature + ☠️ Poison

### Jungle toxique

Des plantes apparaissent dans les zones empoisonnées.

---

## 🌑 Ombre + Téléportation

### Pas du néant

Le héros se téléporte automatiquement vers les ennemis isolés.

---

# 11. Fusions qui utilisent TES compétences

C'est là que je trouve le projet beaucoup plus intéressant.

## Épée tournoyante + Aura de flammes

### ☀️ Soleil d'acier

Les lames deviennent incandescentes et la rotation crée une aura brûlante.

---

## Épée tournoyante + Ricochet

### 🌀 Moulin à lames

Chaque lame rebondit sur les ennemis.

---

## Chaîne d'éclairs + Ricochet

### ⚡ Réseau électrique

Les éclairs rebondissent et peuvent revenir vers des cibles déjà frappées.

---

## Satellite + Chaîne d'éclairs

### ⚡ Satellites conducteurs

Les satellites déclenchent des éclairs lorsqu'ils touchent un ennemi.

---

## Moulinet + Aura de flammes

### 🔥 Tourbillon infernal

Le guerrier devient littéralement une tornade de feu.

---

## Charge sismique + Dôme

### 🪨 Forteresse mobile

La charge crée un dôme temporaire à son point d'impact.

---

## Sablier + Danse des ombres

### ⏳ Temps fracturé

Chaque kill pendant le ralentissement réduit encore le cooldown du Sablier.

---

## Familier + Armée des ombres

### 👑 Général des morts

Le familier peut commander les morts-vivants.

---

## Exil + Heure sombre

### 🌌 Néant

Le mage arrête le temps puis bannit la vague.

Mais le coût d'Exil est doublé.

Très rare.

---

# 12. Les fusions ne doivent pas toutes être positives

C'est important.

Je créerais des fusions du genre :

## 💀 Apothéose + Fardeau

### Berserker terminal

Le héros gagne énormément de puissance.

Mais son espérance de survie diminue à chaque vague.

---

## 🩸 Sang pour sang + Résurrection

### Revenant

Le personnage peut mourir une fois.

Mais revient avec une malédiction permanente.

---

## ☠️ Nécromancien + Exil

### Exil des morts

Les ennemis bannis reviennent plus tard sous forme de morts-vivants.

Tu gagnes la vague maintenant.

Tu crées un problème pour plus tard.

---

# 13. Fusions secrètes

Je garderais quelques combinaisons non affichées.

Exemple :

```text
Satellite
+
Sablier
+
Foudre
```

→ **Constellation temporelle**

Ou :

```text
Doppelgänger
+
Clignement
```

→ **Légion des miroirs**

Ou :

```text
Armée des ombres
+
Aura de flammes
+
Mort
```

→ **Enfer des morts**

Ou :

```text
Orage final
+
Heure sombre
```

→ **Apocalypse temporelle**

---

# 14. Une mécanique directement inspirée de Magic Survival que je veux ajouter

## Évolutions au niveau maximum

Quand deux compétences compatibles atteignent un certain niveau :

```text
🔥 Boule de feu MAX
🌪 Cyclone MAX

        ↓

     ÉVOLUTION

🔥🌪 Tempête incendiaire
```

Mais après la fusion :

**les deux slots deviennent un seul slot.**

Cela crée un choix :

> Est-ce que je garde deux compétences fortes ?

ou

> Est-ce que je fusionne pour obtenir une compétence monstrueuse ?

C'est beaucoup plus intéressant qu'une simple amélioration.

Magic Survival repose justement beaucoup sur cette logique de magies évoluées et de fusions. citeturn0search2turn0search4

---

# 15. Une deuxième couche : les Synergies

Magic Survival a également développé des effets de synergie entre certains éléments du build. citeturn0search4

Je ferais pareil mais adapté à ton jeu.

Exemple :

## Build « Tempête »

Si le héros possède :

- Foudre
- Eau
- Vent

→ **Tempête**

Bonus :

- +25 % foudre ;
- +20 % portée ;
- les zones d'eau deviennent conductrices.

---

## Build « Nécromancien »

- Mort
- Ombre
- Invocation

→ **Seigneur des morts**

Bonus :

- +30 % durée des invocations ;
- les cadavres restent plus longtemps ;
- les morts-vivants peuvent évoluer.

---

## Build « Berserker »

- Sang
- Rage
- Lame

→ **Carnage**

Bonus :

- dégâts augmentent avec les PV manquants ;
- les kills rendent une petite quantité de PV ;
- les critiques peuvent réinitialiser certains cooldowns.

---

# 16. Le système que je ferais vraiment pour TON jeu

Je ne copierais pas le système Magic Survival tel quel.

Je ferais :

```text
PERSONNAGE
    │
    ├── Classe
    ├── Rang
    ├── Stats
    ├── Traits
    ├── Relations
    ├── Souvenirs
    └── Affinités
             │
             ▼
       COMPÉTENCES
             │
       ┌─────┼─────┐
       ▼     ▼     ▼
    Passive Auto  Active
       │     │     │
       └─────┼─────┘
             ▼
          TAGS
             │
             ▼
       ÉVOLUTIONS
             │
             ▼
          FUSIONS
             │
             ▼
         SYNERGIES
             │
             ▼
      BUILD UNIQUE
```

Et les **traits / souvenirs / événements** influencent les chances d'apparition.

Ainsi :

> Deux guerriers peuvent avoir les mêmes compétences de départ et finir avec deux builds complètement différents.

C'est cohérent avec ton principe actuel : plusieurs héros d'une même classe ne doivent pas être redondants. fileciteturn7file0

---

# 17. Mes 20 ajouts prioritaires

Si je devais choisir seulement 20 nouvelles compétences :

1. **Gravité**
2. **Orbe de mort**
3. **Nuage toxique**
4. **Projectile miroir**
5. **Essaim**
6. **Frappe orbitale**
7. **Lien de foudre**
8. **Lame boomerang**
9. **Dévoreur**
10. **Cœur élémentaire**
11. **Résonance**
12. **Surcharge**
13. **Seigneur du feu**
14. **Tempête**
15. **Seigneur des morts**
16. **Maître des lames**
17. **Constellation temporelle**
18. **Général des morts**
19. **Nécroflamme**
20. **Singularité**

---

# 18. Et mes 5 préférées pour ton jeu

### 🥇 Gravité

Parce qu'elle peut interagir avec :

- projectiles ;
- explosions ;
- mêlée ;
- zones ;
- cadavres ;
- formations ;
- environnement.

Elle peut devenir un système entier.

### 🥈 Nécroflamme

Parce qu'elle relie directement :

**combat + cadavres + feu + nécromancien + environnement.**

### 🥉 Cœur élémentaire

Parce qu'il permet de construire de vrais personnages spécialisés.

### 4. Dévoreur

Parce qu'il crée une boucle de snowball très Magic Survival.

### 5. Constellation temporelle

Parce que ton Mage possède déjà **Sablier + Satellite**, donc ça peut devenir une vraie récompense de build plutôt qu'une compétence sortie de nulle part.

---

# 19. La règle que je verrouillerais dans le design

> **Une évolution doit modifier le comportement de la compétence.**
>
> **Une fusion doit créer une nouvelle compétence.**
>
> **Une synergie doit modifier plusieurs compétences.**
>
> **Une compétence mythique doit potentiellement modifier les règles du combat.**

Exemple :

`+20 % dégâts` = upgrade.

`Projectile qui rebondit` = évolution.

`Feu + Vent → Tempête incendiaire` = fusion.

`Feu + Vent + pluie → vapeur brûlante qui obscurcit la zone` = synergie.

`Singularité → attire ennemis + projectiles + cadavres` = compétence mythique.

C'est cette progression qui, à mon avis, va donner au système la profondeur que tu recherches.

---

# 20. Source Magic Survival

J'ai utilisé le wiki communautaire de Magic Survival comme **source d'inspiration mécanique**, pas pour recopier ses textes ou ses listes dans ton jeu. Le wiki décrit notamment les catégories de magie offensive/passive, les évolutions, les compétences et les fusions. citeturn0search0turn0search2

Le point intéressant pour ton projet est surtout que Magic Survival est construit autour du choix des magies pendant la progression, avec des évolutions/fusions qui transforment les builds. citeturn0search4
