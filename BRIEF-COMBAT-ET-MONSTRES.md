# Brief combat & monstres — attaques, animations, variété (100 % gratuit)

> **Pour Claude Code :** lis ce fichier en entier puis exécute-le étape par
> étape, dans l'ordre. Objectif : rendre le combat *vivant* — impacts,
> animations d'attaque et de mort — **faire attaquer les monstres** (télégraphe
> + frappe, pas juste mourir), et **varier les types de monstres**. Tout se fait
> **en code + assets gratuits** : le compte PixelLab est à **0 crédit** et on ne
> paie pas. C'est justement le domaine où le code est fort, contrairement aux
> sprites statiques.

---

## 0. Garde-fous (à respecter absolument)

1. **Un corps Arcade ignore la rotation.** Comme l'explique `src/game/poses.ts`,
   sur un combattant qui a un corps physique (héros, invocation, ennemi) on ne
   touche **que `setAngle`**. `setScale`/`setOrigin` déplacent la **hitbox** →
   interdit sur un combattant *vivant*. Les effets d'échelle (squash, pop de
   mort) se font soit sur une **mort** (corps désactivé au préalable), soit sur
   des **sprites décoratifs détachés** sans corps physique.
2. **La logique de jeu ne bouge pas.** Tout `src/core/` (pur, testé) reste
   intact : dégâts, portée, IA, XP, règle des 20 %. On ne touche qu'au **ressenti
   visuel** (`ArenaScene.ts`, `entities.ts`, `poses.ts`) et aux **nouveaux
   fichiers**. `npm test` doit rester **vert**.
3. **Zéro API payante.** Variété des monstres = teintes/échelles du sprite
   `ennemi` existant (et réemploi de `mort-vivant`) + packs CC0 gratuits en
   option. Effets = particules/tweens Phaser + frames d'effets gratuites d'itch.
4. **Réutiliser l'existant, ne pas dupliquer.** On a déjà : `poses.ts`
   (`declencher`/`animer`, `POSES`), `flotter(...)` (texte flottant),
   `cameras.main.shake(...)`, `setTintFill(0xffffff)` + `flashJusqua` (éclair de
   coup), les textures `impact` et `projectile`, l'arc de tranche dans
   `frapperAuContact` (~l.1360). On étend ces briques.
5. **Performance.** Il y a un plafond `MAX_ENNEMIS`. Les particules doivent être
   **poolées** (émetteurs réutilisés, quotas raisonnables), pas des centaines
   d'objets créés/détruits par seconde. Tester avec beaucoup d'ennemis à l'écran.

---

## 1. Étape 1 — un module d'effets réutilisable (`src/game/effets.ts`)

Créer un petit module qui centralise la « juice ». Toutes ces fonctions prennent
la scène + une position et sont **détachées** (aucun corps physique) :

- `eclatImpact(scene, x, y, couleur)` — gerbe de particules courte (étincelles /
  sang) à l'endroit du coup. Utiliser un **émetteur de particules Phaser**
  (`scene.add.particles`) avec une petite texture. Une texture de particule
  faite au code est **parfaitement acceptable** ici (un point/losange blanc de
  4–6 px via `generateTexture` — l'interdiction du dessin au code visait les
  *personnages*, pas les particules). Teinter selon l'événement.
- `poufMort(scene, x, y, couleur)` — le « nuage » de mort : burst de particules
  + éventuelle frame d'explosion (voir §5). C'est **ça**, la vraie mort des
  monstres — distincte de l'attaque.
- `tranche(scene, x, y, versAngle, couleur)` — un arc/slash détaché, orienté vers
  la cible, qui s'efface par tween (généraliser l'arc déjà présent dans
  `frapperAuContact`).
- `flashCible(sprite)` — l'éclair blanc d'encaissement (généraliser le
  `setTintFill(0xffffff)` + horodatage `flashJusqua` déjà utilisé sur `Ennemi`,
  pour l'appliquer aussi aux héros).
- `secousse(scene, force)` — enrober `cameras.main.shake` avec des presets (léger
  pour un coup simple, fort pour un ultime).
- `hitstop(scene, ms)` — micro-gel sur gros impact : baisser `physics.world`
  (ou `time`) `timeScale` un court instant puis rétablir. **Très** court (30–60
  ms), et jamais pendant une pause de menu.
- `recul(cible, depuisX, depuisY, force)` — knockback : brève impulsion de
  vitesse opposée à l'attaquant sur le corps de la cible (`setVelocity`), qui
  s'estompe. Rester **subtil** pour ne pas se battre avec le déplacement.

Réglage : des effets **brefs et secs** (100–200 ms). Le coup, l'éclair d'impact
et la pose d'attaque doivent se lire comme **un seul événement** (c'est déjà la
règle notée l.1337).

---

## 2. Étape 2 — enrichir les poses (`src/game/poses.ts`)

Ajouter des types de pose à l'objet `POSES` (toujours **angle uniquement** sur
les corps vivants) :

- `touche: { duree: 160, angle: -18 }` — recul d'encaissement, penché à
  l'opposé de l'attaquant (bref sursaut).
- `charge: { duree: 260, angle: -20 }` — **armement** d'attaque de monstre : il
  se cabre en arrière avant de frapper (le télégraphe, voir §3).

Pour la **mort**, le corps n'est plus utile : on s'autorise échelle + alpha.
Ajouter une fonction dédiée `animerMort(scene, sprite)` qui, **après avoir
désactivé le corps**, fait basculer le sprite (angle → ±80°), le fait pâlir
(`alpha → 0`) et légèrement rétrécir, puis le détruit en `onComplete`. À utiliser
pour héros ET monstres.

---

## 3. Étape 3 — LES MONSTRES ATTAQUENT (cœur de la demande)

Aujourd'hui `contactEnnemi` (l.2550) fait : cooldown → petite pose `attaque` →
dégâts instantanés. On transforme ça en **vraie attaque télégraphiée** pour
qu'on la *voie venir* et qu'elle ait du poids :

1. **Armement (télégraphe).** Quand un ennemi entre en portée d'un héros et que
   son coup est prêt (`peutFrapper`), il joue d'abord `charge` (il se cabre) +
   un léger `setTintFill` de couleur d'avertissement pendant ~250 ms. Il ne se
   téléporte pas dans le héros : anticipation lisible.
2. **Frappe.** À la fin de l'armement : pose `attaque` vers la cible +
   `effets.tranche(...)` + `effets.eclatImpact(...)` sur le héros + `flashCible`
   du héros + `secousse` légère si le héros est incarné. **C'est seulement ici**
   qu'on applique les dégâts (garder tout le bloc existant : riposte, martyre,
   esquive, `subirDegats`, `flotter` des dégâts). Ajouter un `recul` léger du
   héros.
3. **Récupération + cooldown** via `marquerCoup` (déjà là, 700 ms).

Implémentation propre : porter l'état d'armement dans `Ennemi` (`entities.ts`) —
p.ex. `instantFrappe: number` (moment où le coup partira) et un booléen
`enArmement`. `contactEnnemi` déclenche l'armement ; l'application des dégâts se
fait quand `time.now >= instantFrappe` (soit via un court `delayedCall`, soit
testé dans la boucle des ennemis `majEnnemis`/l.1197). Garder le tout **piloté
par horodatage**, sans multiplier les minuteries (cohérent avec le style du
code, cf. commentaire l.1197 « une seule fois par image »).

### Ennemi à distance
Un archétype (voir §4) ne frappe pas au contact : il **s'arrête à distance** et
**tire un projectile** vers le héros, avec un télégraphe (bref armement + lueur).
Réutiliser la texture `projectile` (teintée), créer un overlap
`projectilesEnnemis × equipe` qui applique les dégâts au héros via `subirDegats`
puis détruit le projectile. Modéliser le tir sur `impactProjectile` (l.1409) mais
dans l'autre sens.

### La mort du monstre = une animation, pas un clignotement
Dans `tuer` (l.~1509) : **garder tel quel** tout le gameplay (kills, XP,
`tenterRelevement`, soins, `e.destroy()` pour la logique). **Ajouter** juste, aux
coordonnées `(x, y)` déjà capturées, un **visuel de mort détaché** :
`effets.poufMort(this, x, y, couleurDeLArchetype)` (+ option frame d'explosion
§5). Ainsi le monstre « explose » **quand il meurt** — ce qui est correct — mais
il **attaque** aussi de son vivant (§3), ce qui manquait.

---

## 4. Étape 4 — VARIER LES TYPES DE MONSTRES (gratuit)

Aujourd'hui il n'existe qu'un `Ennemi` piloté par un scalaire `puissance`
(`entities.ts` l.598, `faireApparaitreEnnemi` l.2536). On ajoute des
**archétypes** sans casser cette montée en puissance.

Créer `src/game/ennemis.ts` : une table déclarative d'archétypes. Chaque entrée :

```
{
  id, nom,
  texture,            // "ennemi" (+ teinte) ou "mort-vivant", ou clé d'un pack gratuit
  teinte?,            // pour dériver une variante à partir de "ennemi"
  echelle,            // 1 par défaut ; le gros brute ~1.4, l'essaim ~0.8
  multPv, multVitesse, multDegats,   // multiplient les stats calculées depuis puissance
  comportement,       // "fonceur" | "brute" | "essaim" | "cracheur" | "kamikaze"
  couleurImpact,      // teinte des particules d'impact et du pouf de mort
}
```

Archétypes gratuits proposés (tous dérivés des sprites **existants**) :

| id | Base visuelle | Idée de jeu |
|---|---|---|
| `fonceur` | `ennemi` (teinte neutre) | le monstre de base, corps-à-corps |
| `brute` | `ennemi` teinté rouge sombre, échelle ~1.4, lent | gros PV, gros dégâts, frappe lourde (télégraphe long) |
| `essaim` | `ennemi` teinté pâle, échelle ~0.8, rapide | faible mais nombreux, frappe rapide |
| `cracheur` | `ennemi` teinté vert | reste à distance, tire un projectile (§3) |
| `revenant` | réemploi de `mort-vivant` | corps-à-corps résistant, plus lent |
| `kamikaze` | `ennemi` teinté orange, clignote | fonce puis **explose** en zone (copier la logique `explosif` des invocations, ~l.953) |

Câblage :
- `Ennemi` (constructeur, `entities.ts`) accepte un **archétype** en plus de
  `puissance`. Il applique `teinte`, `echelle` (avec `calerCorps(...)` recalé
  derrière, **exactement** comme le golem l.732-735 pour ne pas changer la
  hitbox de référence), et les multiplicateurs de stats. Le comportement pilote
  le style d'attaque (§3) et la couleur des effets.
- `faireApparaitreEnnemi` (l.2536) : **choisir un archétype** selon la
  `puissance`/vague — pondéré, les archétypes durs (brute, kamikaze, cracheur)
  n'apparaissent qu'à partir d'un certain seuil. Le `fonceur` reste majoritaire
  au début. Garder la montée en `puissance` telle quelle : l'archétype la
  **module**, il ne la remplace pas.
- Annoncer la variété dans les vagues si pertinent (le système `annonce` existe,
  l.2531).

**Option montée en gamme (toujours gratuite) :** pour des silhouettes vraiment
distinctes, télécharger un pack CC0 de monstres (itch.io / Kenney), déposer les
PNG dans `src/assets/` sous de nouvelles clés, les ajouter à la liste chargée par
`BootScene`, et pointer `texture` de l'archétype dessus. Même pipeline que
`BRIEF-GRAPHISMES.md`. Les teintes restent le moyen le plus rapide pour démarrer.

---

## 5. Étape 5 — frames d'effets gratuites (optionnel, pour le « waouh »)

Les particules codées (§1) suffisent déjà pour un bon rendu **sans rien
télécharger**. Pour des explosions/slashs/magies dessinés en plus :

- Packs gratuits, usage commercial libre : **Foozle – Pixel Magic Effects**
  (<https://foozlecc.itch.io/pixel-magic-sprite-effects>), et le tag
  **Effects** d'itch (<https://itch.io/game-assets/free/tag-effects>) — Codemanu,
  BDragon1727, Pimen.
- Intégration : `this.load.spritesheet("fx-explosion", url, { frameWidth, frameHeight })`
  dans `BootScene`, `this.anims.create({ key, frames, frameRate, repeat: 0 })`,
  puis jouer en **one-shot** sur un sprite détaché à l'impact / à la mort, détruit
  en fin d'animation. Brancher dans `effets.eclatImpact` / `effets.poufMort`.

---

## 6. Étape 6 — animer aussi les héros & invocations (tweens, gratuit)

Avec les poses de §2, sur les sprites **déjà présents** :
- **Encaissement** : quand un héros/invocation subit des dégâts, jouer la pose
  `touche` + `flashCible`. (Point d'accroche héros : `subirDegats`.)
- **Mort du héros** : `Hero.mourir()` (l.399) ne fait que teinter. Ajouter
  `animerMort(...)` (bascule + fondu) — sûr, un héros mort est hors combat.
- **Apparition** : petit fondu/pop à l'arrivée des ennemis et des invocations
  (sur sprite détaché ou via alpha, sans toucher la hitbox).
- (Option) respiration au repos : très légère, `animer` peut l'ajouter à l'état 3
  (repos) de `poses.ts`.

---

## 7. Ordre d'exécution conseillé

1. `effets.ts` (§1) — la base de tout.
2. Poses `touche`/`charge` + `animerMort` (§2).
3. **Attaque des monstres télégraphiée + mort animée** (§3) — le plus gros gain.
4. **Archétypes de monstres** (§4) — la variété.
5. Encaissement/mort des héros (§6).
6. Frames d'effets gratuites (§5) — finition, si voulu.

Livrer et tester après **chaque** étape (le jeu doit rester jouable entre deux).

---

## 8. Vérification finale (obligatoire)

1. `npm test` → **vert** (la logique `core/` n'a pas bougé).
2. `npx tsc --noEmit` → **0 erreur**.
3. `npm run dev` → jouer une vague. Vérifier de visu :
   - les monstres **s'arment puis frappent** (on voit le coup venir), ils ne se
     contentent plus de mourir ;
   - au moins **4–5 types** de monstres distincts à l'œil (taille/couleur/
     comportement), dont un **à distance** et un **kamikaze** ;
   - impacts, éclairs, reculs et morts se lisent bien ; l'écran n'est pas noyé
     sous les effets.
4. **Hitbox inchangées** : comparer le ressenti de collision avant/après ; aucune
   pose ni animation ne doit modifier une hitbox de combattant vivant (règle §0).
5. **Perf** : avec beaucoup d'ennemis + effets, le framerate tient (émetteurs
   poolés, pas de fuite d'objets).
6. Résumer : nouveaux fichiers, archétypes ajoutés, effets branchés, et ce qui
   reste éventuellement à faire (sons, packs d'effets non intégrés).

---

## Références

- Effets gratuits : <https://foozlecc.itch.io/pixel-magic-sprite-effects> ·
  <https://itch.io/game-assets/free/tag-effects>
- Monstres CC0 gratuits : <https://kenney.nl> ·
  <https://itch.io/game-assets/free/tag-cc0/tag-pixel-art>
- Particules Phaser : `scene.add.particles(...)` — API intégrée, aucune dépendance.
- Rappels internes : poses = angle seul (`src/game/poses.ts`) ; combat = `core/`
  intact ; `contactEnnemi` (l.2550), `tuer` (l.~1509), `faireApparaitreEnnemi`
  (l.2536) sont les points d'accroche.
