# Prompt de reprise

> Colle tout ce qui suit dans une nouvelle session, à la racine du projet.

---

Tu reprends un projet de jeu vidéo en cours. C'est mon premier jeu, je ne suis pas
développeur, et je décide du design — toi tu construis et tu me signales ce qui cloche.

## Ce que c'est

**Le Protecteur** : un roguelike vu de dessus, en pixel-art, avec de la gestion de
village. Post-apocalyptique. On est le Protecteur d'un village en ruine, on repousse des
vagues de monstres sans fin, on restaure le village entre deux, et on recrute des héros.

Le combat est un **survivors-like** : le joueur ne contrôle que son **déplacement** et
ses **capacités**. L'attaque, la visée et l'esquive sont automatiques.

## Avant de toucher au code

1. **Lis `DESIGN.md` en entier.** C'est le document de référence. Si le code et le
   document se contredisent, c'est le code qu'on corrige.
2. **Lis `README.md`** pour la structure et les commandes.

Le §6 de `DESIGN.md` liste les questions encore ouvertes, et le §5 la feuille de route.

## Comment je veux qu'on travaille

- **En français**, dans le code comme dans les échanges. Les commentaires expliquent
  *pourquoi*, jamais *quoi*. Pas d'accents dans le code (les fichiers sources sont en
  ASCII), mais accents normaux dans les fichiers Markdown.
- **`src/core/` ne connaît pas Phaser.** C'est la logique pure, et elle est testée.
  Tout ce qui touche à l'affichage vit dans `src/game/` et `src/scenes/`.
- **Le contenu est séparé du système.** Les classes, les compétences et leurs chiffres
  sont des données dans `src/core/`, pas du code éparpillé.
- **Tu écris le design dans `DESIGN.md` avant de le coder.** Quand je te donne une idée,
  tu la notes d'abord, tu me dis ce que tu en penses honnêtement — y compris quand tu
  penses que c'est une mauvaise idée — puis tu la codes.
- **Pose-moi des questions à choix** plutôt que des questions ouvertes. Je trouve ça plus
  simple et plus ludique.
- **Vérifie toujours** : `npx tsc --noEmit`, puis `npx vitest run`, puis `npm run build`.
- **Commits en français**, un par bloc de travail, poussés sur
  `https://github.com/P4lbL0/jeux.git`.
- Ne me dis jamais que quelque chose marche si tu ne l'as pas vérifié. Tu ne peux pas
  jouer au jeu : dis-le, et demande-moi de tester.

## Ce qui est déjà fait

**Jalons 0 à 3 terminés** (voir §5 de `DESIGN.md`) :

- Vite + TypeScript + Phaser 3, tests avec Vitest.
- Une arène, sept classes jouables, l'attaque automatique, les traits de classe.
- Une équipe : un héros incarné, les autres joués par l'IA.
- **La règle des 20%** — le cœur du jeu : l'IA se replie à 20% de vie et ne perd jamais
  un héros ; le joueur ne peut pas changer de héros sous 20% et doit le ramener à la
  cité ; la mort est définitive. Conséquence : un héros ne meurt que par une décision du
  joueur.
- La cité au centre de l'arène : on y est à l'abri, on s'y soigne.
- XP, niveaux, et un **choix de compétence tous les 5 niveaux** qui met le jeu en pause.
- **Plus de 70 compétences** : passives, actives, automatiques, à paliers, avec des
  évolutions qui changent leur nature et la couleur du héros.
- Interface dans une **scène séparée** (`UiScene`) pour échapper au zoom de la caméra.
- Fiche de héros consultable en cliquant un portrait.

## Ce qui reste à faire

### Jalon 4 — les ordres et les formations *(le prochain)*

- **Ordres aux héros IA** (§4.4) : leur dire où se rendre, et quelle posture adopter —
  temporiser, attaquer agressivement, se replier.
- **Formations** : tanks devant, soigneurs derrière.
- **Commandement des sbires du Nécromancien** (§4.14) : les positionner, leur faire tenir
  une position, charger, protéger. **Doit partager la même interface que les ordres aux
  héros** — deux systèmes séparés, ce serait deux fois le travail et deux fois les bugs.
- **Expérience de groupe** (§4.16) : plus des héros combattent ensemble, plus ils gagnent
  de statistiques, et ça débloque des formations. Attention : le bonus doit rester
  confortable, jamais décisif, sinon le joueur fige une équipe et ne tourne plus jamais.

### Jalon 5 — le village

Le hub : se promener, parler aux PNJ, la phase de préparation, l'argent, l'équipement.
Le village devient une **cible** pour les monstres (aujourd'hui la cité est un abri
total où l'on peut camper indéfiniment — c'est un trou connu).

### Jalon 6 — les défenses

Les placer et les orienter avant la vague. Progression de l'arsenal : de la **baliste**
au **canon laser**.

### Jalon 7 — la restauration du village

Améliorations cumulables sans plafond, montée en puissance infinie des monstres. Les
dégâts subis par le village retardent la vague suivante (§4.6) — vérifier qu'encaisser
volontairement ne soit jamais rentable.

### Jalon 8 — le recrutement et les rangs

- Rangs des héros : `F E D C B A A+ A++ S S+ S++ SR SRR SRR+ SRR++`.
- **Le rang est un plafond de niveau** (F = niveau 10 max). Monter en rang multiplie les
  statistiques, augmente le nombre de capacités, et **augmente la chance de tirer une
  compétence de rang élevé** — le paramètre `faveur` de `tirerCompetences()` est déjà en
  place pour ça, il n'y a qu'à le brancher.
- Le rank up se paie en **matériaux rares lâchés par les monstres**.
- Classes très rares aux rangs élevés.
- On peut recruter **plusieurs héros de la même classe**.
- **Dix héros dehors au maximum** ; les autres restent en garnison et défendent la ville
  si des monstres entrent (§4.15).

### Jalon 9 — le prologue

Choix de classe, arrivée au village en ruine, dialogues, on devient Protecteur.

### Jalon 10 — la défaite et l'antagoniste

Le système le plus important du jeu (§4.12). Quand on perd, le héros de départ **survit**,
perd du pouvoir, **se corrompt**, et part vers un autre village — c'est la partie
suivante. Au bout de plusieurs défaites il **bascule** et revient comme **antagoniste** :
ton propre personnage, avec ta classe et tes compétences, vient détruire ton village.

### Jalon 11 — le leaderboard

Le seul morceau en ligne. Le score (vagues survécues) est déjà compté. Il faudra un
petit serveur. À savoir : les scores d'un jeu qui tourne chez le joueur sont
falsifiables.

## Dettes et pièges connus

- **La fluidité.** Le jeu a ramé lourdement à cause du nombre d'objets vivants. Les cinq
  règles du §4.17 de `DESIGN.md` sont à respecter absolument : tout ce qui apparaît a un
  plafond, la difficulté monte par la force et non par le nombre, aucun objet Texte créé
  en plein combat, aucune minuterie par coup encaissé, rien qui trie une liste par entité
  et par image.
- **Combinaison possiblement cassée** : `Écho` + `Capacités affinées` + `Danse des
  ombres` pourrait permettre d'enchaîner les capacités sans fin. À vérifier en jeu.
- **La cité est un abri total** : rien n'empêche d'y camper. Se refermera au jalon 5.
- **Le Nécromancien n'est pas encore intéressant à incarner** tant que le commandement
  des sbires n'existe pas (jalon 4).
- **Pas de sauvegarde** pour l'instant. Prévu en `localStorage`, avec un export/import de
  fichier dès qu'il y aura une vraie progression à perdre.
- Les sprites sont des **placeholders générés par code** dans `src/game/art.ts`. Je
  dessinerai les miens : pour en remplacer un, charger le PNG sous la même clé dans
  `preload()` et supprimer la fonction correspondante. Le jeu a un **zoom libre**, donc un
  sprite doit rester reconnaissable tout petit.

## Questions encore ouvertes

Elles sont listées au §6 de `DESIGN.md`. Les plus importantes :

- Y a-t-il des dégâts **physiques** et **magiques** séparés ? (aujourd'hui une seule
  statistique)
- Combien de défaites avant que le héros de départ bascule en antagoniste ?
- Que perd-il exactement à chaque défaite ?
- Comment recrute-t-on un héros ?

## Pour lancer

```bash
npm install
npm run dev      # le jeu s'ouvre dans le navigateur
npx vitest run   # les tests
npm run build    # vérifie les types et construit
```

**Commence par me dire ce que tu as compris et ce que tu comptes faire en premier, avant
de coder.**
