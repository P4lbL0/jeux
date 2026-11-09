# Brief graphismes — passage du placeholder au vrai pixel-art

> **Pour Claude Code :** lis ce fichier en entier, puis exécute-le étape par
> étape. C'est un plan de travail complet et volontairement précis. Ne dessine
> **jamais** de sprite toi-même avec des primitives (`fillTriangle`,
> `fillCircle`, `generateTexture`) : ton rôle ici est de **brancher de vrais
> PNG** et de câbler leur chargement. Toute la laideur actuelle vient de là —
> `src/game/art.ts` fabrique les sprites au code, ce qui est le mauvais médium
> pour du pixel-art.

---

## 1. Principe directeur

Le pixel-art est un problème d'**assets**, pas de code. On sépare donc l'art du
code :

1. Un **script hors-ligne** génère les sprites via l'API PixelLab et les
   enregistre en PNG dans `src/assets/`. On lance ce script **une seule fois**
   (ou quand on veut régénérer), on **commite les PNG**, et le jeu ne touche
   **jamais** l'API à l'exécution. → coût maîtrisé, aucune dépendance réseau au
   runtime, rien à payer quand on joue.
2. Le jeu **charge** ces PNG dans `preload()` sous les mêmes clés de texture
   qu'aujourd'hui.
3. `art.ts` devient un **filet de sécurité** : il ne génère un placeholder que
   pour les clés dont le PNG n'existe pas encore.

`index.html` a déjà `image-rendering: pixelated` → les sprites resteront nets au
zoom. Rien à changer de ce côté.

---

## 2. Règles d'or (ne rien casser)

- **Mêmes clés de texture.** Un PNG chargé sous `hero-guerrier` remplace le
  placeholder `hero-guerrier`, point. Aucune autre partie du code ne bouge.
- **Placeholders conservés en fallback.** Dans `creerTexturesPlaceholder` (et
  chaque `creer…`), garder le motif déjà présent :
  `if (scene.textures.exists(cle)) return;`. Ainsi un asset manquant retombe
  proprement sur le dessin au code, et on peut migrer **un sprite à la fois**.
- **Gameplay intact.** Les sprites générés seront plus grands que les
  placeholders (48–64 px contre 12–18 px). **Ne touche pas** aux hitbox, aux
  vitesses, ni à la logique dans `src/core/`. Adapte **uniquement l'affichage** :
  règle l'échelle (ou `displayWidth`/`displayHeight`) pour que l'empreinte à
  l'écran reste proche de l'actuelle, et ancre l'origine aux pieds
  (`setOrigin(0.5, 1)` si pertinent). Vérifie visuellement.
- **Le secret ne va JAMAIS dans le repo.** Clé API dans `.env` seulement,
  `.env` ajouté à `.gitignore`.
- **Tests toujours verts.** `npm test` ne doit pas régresser (la logique de jeu
  ne dépend pas des assets).

---

## 3. Étape 0 — mise en place

1. Installer le SDK officiel :

   ```bash
   npm install @pixellab-code/pixellab
   ```

2. Créer `.env` à la racine :

   ```
   PIXELLAB_SECRET=colle-ta-cle-ici
   ```

   Ajouter `.env` à `.gitignore` (le fichier ignore déjà `node_modules`, `dist`,
   etc. — ajouter la ligne `.env`).

3. **Vérifier le solde AVANT de générer** (le SDK expose `getBalance()`). Logguer
   le solde au début et à la fin du script pour suivre la dépense.

4. Créer les dossiers : `src/assets/` (PNG finaux) et `scripts/` (script de
   génération).

Notes SDK (vérifiées) :
- `import { PixelLabClient } from "@pixellab-code/pixellab";`
- `const client = PixelLabClient.fromEnv();` (lit `PIXELLAB_SECRET`)
- Méthodes couvertes par le SDK : `generateImagePixflux`, `generateImageBitforge`
  (style par image de référence), `rotate`, animations (skeleton / texte),
  `inpaint`, `getBalance`. La réponse expose `response.image.saveToFile("x.png")`.
- Endpoints **v2** non exposés par le SDK (ex. `create-character-with-4-directions`,
  `create-tileset`) : les appeler en **REST direct** (`fetch`) sur
  `https://api.pixellab.ai/v2/...`, en-tête d'auth `Authorization: Bearer
  $PIXELLAB_SECRET`. **Vérifier le schéma exact** dans la doc :
  <https://api.pixellab.ai/v2/docs>.

---

## 4. Étape 1 — le script de génération hors-ligne

Créer `scripts/generer-assets.ts` (exécutable avec `npx tsx scripts/generer-assets.ts`).
Structure attendue :

1. Charge le client, log le solde.
2. Une petite liste déclarative `{ cle, prompt, taille }` (voir §5).
3. Pour chaque entrée : si `src/assets/<cle>.png` existe déjà → **skip** (ne pas
   re-payer). Sinon appelle PixelLab, sauve le PNG, log le coût.
4. **Génère d'abord UN seul sprite** (ex. `hero-guerrier`), arrête-toi, montre le
   résultat pour validation du style, **puis** déroule le reste. On ne lance pas
   35 générations à l'aveugle.
5. Cohérence de style : générer le premier héros avec `generateImagePixflux`,
   puis utiliser cette image comme **référence de style** (`generateImageBitforge`
   avec `styleImage`) pour tous les autres → palette et rendu homogènes.

Réglages recommandés pour un top-down lisible (à passer aux prompts) :
`noBackground: true`, `outline: "single color black outline"`,
`shading: "basic shading"`, `detail: "low detail"` (silhouette avant le détail,
cf. DESIGN.md §4.11). Vue **top-down / de dessus**, personnage **centré**, fond
**transparent**.

---

## 5. Étape 2 — inventaire exact des assets à produire

Voici **toutes** les clés de texture réellement utilisées par le jeu (relevées
dans `src/game/art.ts`). Générer un PNG par clé, à la taille indiquée.

### Héros — clé `hero-<id>`, ~48–64 px, fond transparent

Style commun à toutes : *top-down orthographic pixel-art character, centered,
transparent background, readable silhouette, limited palette, crisp pixels, no
anti-aliasing*. Respecter la couleur dominante de chaque classe :

| Clé | Classe | Couleur dominante | Idée de prompt |
|---|---|---|---|
| `hero-guerrier` | Guerrier | rouge `#c0392b` | guerrier en armure rouge, grande épée |
| `hero-chevalier` | Chevalier Sacré | bleu `#4a86c8` / argent | paladin, bouclier, cape bleue |
| `hero-mage` | Mage | violet `#8e44ad` / cyan | mage en robe violette, bâton lumineux |
| `hero-assassin` | Assassin | anthracite `#2c3e50` / vert | rôdeur encapuchonné, dague, tons sombres |
| `hero-rodeur` | Rôdeur | vert `#4e8b52` | archer, arc, cape verte |
| `hero-oracle` | Oracle | lilas `#d9b3e6` / or | oracle en robe blanc-or, halo |
| `hero-necromancien` | Nécromancien | violet sombre `#5a4a7a` / vert | nécromancien, robe sombre, aura verte |

### Ennemis & familiers — ~48 px

| Clé | Contenu |
|---|---|
| `ennemi` | monstre de base (gobelin/créature hostile) |
| `mort-vivant` | mort-vivant (squelette/zombie), accent vert blafard |
| `familier` | familier du mage, esprit lumineux |
| `familier-golem` | familier golem de pierre |
| `familier-spectre` | familier spectral, translucide |

### Décor / props — fond transparent

| Clé | Taille indicative | Contenu |
|---|---|---|
| `arbre-0`, `arbre-1`, … | ~64 px | arbres (générer autant que `ARBRES` en contient — lire le tableau exporté dans `art.ts`) |
| `rocher` | ~48 px | rocher |
| `mur` | 16–32 px | muraille / palissade (doit se juxtaposer proprement) |
| `maison-bleue` | ~64 px | maison façon WorldBox, toit très coloré (bleu) |
| `maison-rouge` | ~64 px | idem, toit rouge |
| `maison-jaune` | ~64 px | idem, toit jaune |

### Projectiles / effets

| Clé | Taille | Contenu |
|---|---|---|
| `projectile` | 8–16 px | projectile générique |
| `impact` | 16 px | flash d'impact |

### Icônes d'ultimes (garder blanches — le panneau les teinte) 32 px

`ultime-tourbillon`, `ultime-rempart`, `ultime-meteore`, `ultime-ombre`,
`ultime-pluie-de-fleches`, `ultime-aube`, `ultime-levee-des-morts`.
→ Ces icônes UI simples sont souvent **très bien en placeholder**. Priorité
basse : ne les régénérer que si le reste rend bien. Idem pour les icônes de
capacités (`creerIconesCapacites`).

> **Ordre de priorité pour un maximum d'effet visuel au moindre coût :**
> 1) les 7 héros, 2) `ennemi` + `mort-vivant`, 3) le sol (§6), 4) arbres /
> rochers / maisons, 5) familiers, 6) le reste. Arrête-toi dès que le rendu te
> plaît.

---

## 6. Étape 3 — le sol (carte procédurale, PAS Tiled)

⚠️ Important : la carte n'est **pas** peinte à la main, elle est **calculée** par
`terrainEn(x, y)` dans `src/core/carte.ts`, puis rendue tuile par tuile dans
`creerCarte()` (`src/game/art.ts`, ~ligne 463) qui fait un `fillRect` d'aplat de
couleur par tuile. **Tiled ne convient donc pas** (il sert aux cartes dessinées à
la main). Le bon geste :

1. Générer **une tuile de sol par type de terrain** (8 types) :
   `abysse`, `mer`, `haut-fond`, `sable`, `herbe`, `sous-bois`, `eboulis`,
   `roche`. Utiliser l'endpoint **`POST /v2/create-tileset`** (tuiles top-down
   qui se raccordent) ou, plus simple, générer 8 petites textures de sol
   *seamless* (`generateImagePixflux`, prompt « seamless top-down pixel-art
   ground tile, <terrain> »).
2. Lire la constante `TUILE` dans `carte.ts` et générer les tuiles à cette taille
   (ou un multiple, puis dessiner à l'échelle).
3. Dans `creerCarte()`, remplacer le `ctx.fillStyle = hex(teinte); ctx.fillRect(...)`
   par un `ctx.drawImage(tuile[sol], px, py, TUILE, TUILE)`. On garde exactement
   la même boucle et la même logique `terrainEn()` — on **pose de vraies tuiles**
   au lieu d'aplats. `peindreDetail`, `peindreEcume`, `peindreVillage` peuvent
   rester (ou être retirés progressivement).

C'est le changement qui transformera le plus l'aspect général du jeu.

---

## 7. Étape 4 — câblage du chargement

1. Ajouter (ou réutiliser) une **scène de préchargement** lancée en premier dans
   la config Phaser, qui charge tous les PNG de `src/assets/` :

   ```ts
   preload() {
     this.load.image("hero-guerrier", assetUrl("hero-guerrier.png"));
     // … une ligne par clé présente dans src/assets/
   }
   ```

   Les textures Phaser sont **globales au jeu** : les charger une fois dans la
   scène de boot les rend disponibles partout (`ArenaScene`, `ChoixClasseScene`).
   Astuce : générer un petit `manifest.json` dans le script de §4 et boucler
   dessus pour éviter de lister les clés à la main. Sous Vite, importer les PNG
   via `import.meta.glob` ou les placer dans `public/assets/` pour des URLs
   stables.

2. Laisser `creerTexturesPlaceholder` en place : grâce au garde
   `if (scene.textures.exists(cle)) return;`, il ne fabriquera un placeholder que
   pour ce qui n'a **pas** de PNG. Vérifier que **chaque** fonction `creer…`
   possède bien ce garde (en ajouter un si besoin).

3. Ajuster l'affichage des sprites plus grands (cf. Règles d'or, §2).

---

## 8. Étape 5 (optionnelle) — animations & 8 directions

Une fois le rendu statique validé, et **si le budget le permet** :

- Marche 4 directions par héros via `POST /v2/create-character-with-4-directions`
  (ou `rotate` sur le sprite sud existant) puis `animate-character`. Charger le
  résultat comme **spritesheet** (`this.load.spritesheet`) et créer des
  `anims` Phaser (`this.anims.create`). Le jeu est top-down avec déplacement
  libre → 4 directions suffisent largement pour commencer.
- Priorité **basse** : le passage du placeholder au sprite statique apporte déjà
  l'essentiel du gain visuel. Ne pas dépenser en animations tant que le statique
  n'est pas net.

---

## 9. Garde-fous coût (« rester gratuit »)

Ordres de grandeur (modèles les moins chers) : image 64×64 ≈ **0,008 $**,
personnage 4 directions 64×64 ≈ 0,012 $, tuile ≈ 0,008 $. **Tout le lot statique
(≈ 30 sprites) revient à bien moins de 0,50 $.** Malgré tout :

- `getBalance()` au début ; **abandonner** si le solde est trop bas.
- Skip systématique si le PNG existe déjà (idempotence).
- Générer 1 sprite → valider le style → puis le reste. Pas de lot à l'aveugle.
- Toujours les **plus petites tailles** qui restent lisibles (48–64 px).
- Les icônes UI : garder les placeholders (gratuits) si elles suffisent.

**Filet de secours 100 % gratuit** si les crédits manquent : packs CC0 (usage
commercial libre) sur **Kenney.nl** (« Tiny Dungeon », « Micro Roguelike ») et
**itch.io** (tilesets roguelike top-down). Même pipeline : télécharger les PNG
dans `src/assets/` sous les mêmes clés, et charger pareil. On peut mélanger
(pack gratuit pour le sol + PixelLab pour les héros).

---

## 10. Vérification finale (obligatoire)

1. `npm test` → toujours vert.
2. `npm run dev` → lancer le jeu, **prendre une capture** de l'arène et de
   l'écran de choix de classe, la regarder : silhouettes lisibles au zoom ?
   empreintes correctes ? sol cohérent ?
3. Confirmer qu'aucun placeholder codé ne subsiste pour un asset censé avoir un
   PNG (chercher les clés encore générées par `art.ts`).
4. `git status` → les PNG de `src/assets/` sont bien suivis, `.env` **n'est pas**
   suivi.
5. Résumer : liste des assets générés, coût total dépensé (delta de solde), ce
   qui reste en placeholder.

---

## Références

- Doc API PixelLab (schémas v2) : <https://api.pixellab.ai/v2/docs>
- SDK JS : <https://github.com/pixellab-code/pixellab-js> (`@pixellab-code/pixellab`)
- Tableau des endpoints & prix : <https://www.pixellab.ai/pixellab-api>
- Assets CC0 gratuits : <https://kenney.nl> · <https://itch.io/game-assets/free/tag-pixel-art>
