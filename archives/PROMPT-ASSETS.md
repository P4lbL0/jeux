# Prompt — refaire tout le visuel du Protecteur

> Colle tout ce qui suit dans une nouvelle session, à la racine du projet.
>
> Écrit le 10 septembre 2026. Ce prompt ne demande aucune décision de design : il demande
> un résultat qu'on juge à l'image, dans le jeu, tout de suite.

---

Tu reprends **Le Protecteur**, un jeu en cours. C'est mon premier jeu, je ne suis pas
développeur. Je décide du design, tu construis, tu me signales ce qui cloche.

**Ta mission tient en une phrase : le jeu est moche, rends-le beau, et montre-le-moi tourner.**

## 1. Le cadre — ce à quoi tu ne touches pas

**Interdit absolu : `src/core/`.** 7 804 lignes de règles de jeu couvertes par 446 tests verts.
Ce sont les règles (satisfaction, cycle, habitants, port, église, IA), elles fonctionnent, elles
ne sont pas le sujet. Si tu crois devoir y toucher pour du visuel, tu t'es trompé de fichier.

Tu travailles dans **`src/game/`** (le dessin, les panneaux), **`src/game/dessin/`** (le moteur
de rendu procédural) et **`src/assets/`** (les PNG).

À la fin, ces trois commandes doivent passer :

```bash
npx vitest run      # 446 tests, tous verts
npm run build       # types + build
npm run dev         # le jeu tourne
```

Stack : Phaser 3 + TypeScript + Vite. **Le choix du moteur est tranché et fermé** — on reste sur
Phaser, ne propose pas d'en changer.

## 2. Le mécanisme que tu dois comprendre avant de coder

C'est le point qui décide de tout, lis-le deux fois.

Le jeu a **deux systèmes de rendu superposés** :

1. **Des PNG dans `src/assets/`**, générés en août par l'API PixelLab. Vite les ramasse
   automatiquement (`src/game/assets.ts`) et **le nom du fichier est la clé de texture**.
2. **Un moteur de dessin procédural dans `src/game/dessin/`** (3 131 lignes : palette, pinceau,
   four à frames, corps, héros, villageois, bâtiments, sol, mer), écrit en août pour le
   « bloc 7z ». Tout y est dessiné par le code, aucun PNG.

**Le piège : le PNG gagne toujours.** Déposer `mur.png` remplace le dessin au code ; le retirer
suffit à revenir au procédural. Résultat : **le moteur de dessin du 7z est terminé mais invisible
en jeu** — les vieux PNG le masquent. Ce que je regarde et que je n'aime pas, c'est l'ancien
rendu, pas le nouveau.

**Donc ta première question à te poser n'est pas « comment je dessine », c'est « lequel des deux
je garde ».** Et la réponse se juge sur une capture, pas sur un raisonnement.

⚠️ N'appelle **jamais** l'API PixelLab (`scripts/generer-assets.ts`). Elle est payante et je ne
t'y autorise pas. Tout ce que tu produis doit être gratuit et reproductible : du code, ou des PNG
générés localement par un script du repo.

## 3. Ce qui cloche, précisément

Regarde `captures/7z-village-2.png` — c'est l'état actuel. Le diagnostic, pour que tu ne perdes
pas de temps à le refaire :

| Ce qu'on voit | Le problème |
|---|---|
| **L'herbe** | Vert saturé en damier, bruité pixel par pixel. Ça pique les yeux et ça écrase tout le reste. C'est le défaut n°1. |
| **Les maisons** | Le même sprite gris-beige à toit d'ardoise, répété huit fois. Aucune variété, aucune vie. |
| **Deux styles qui se cognent** | Les personnages sont du pixel art détaillé et sombre ; le décor est plat et clair. Ils n'ont pas l'air d'appartenir au même jeu. |
| **Le contraste est à l'envers** | Le sol est l'élément le plus lumineux de l'écran. Ce sont les personnages qu'on doit lire en premier, pas l'herbe. |
| **Les personnages flottent** | Aucune ombre portée. Rien ne les pose au sol. |
| **Pas de hiérarchie** | L'église (le bâtiment rouge) ne se distingue quasiment pas d'une maison. |

**La direction artistique écrite** est au §4.30 (`design/4.30-la-refonte-visuelle.md`) : monde en
**fer, os et sang**, les neuf couleurs de `src/game/ui/chrome.ts` **et aucune autre**, tout vu de
face, aligné sur la grille de 32 px. Cette direction n'a jamais été jugée en jeu.

**Tu as le droit de me dire qu'elle est mauvaise.** Si tu penses qu'un autre parti pris rend
mieux, montre-moi les deux en image et argumente. Ce que je veux, c'est un jeu qui a l'air bon,
pas le respect d'un document.

## 4. Ce que je veux recevoir — et la seule chose qui compte

**Je juge sur image, jamais sur texte.** Ne me décris pas ce que tu comptes faire : fais-le et
montre-le. Une liste d'options écrites ne me sert à rien.

Livre-moi, dans cet ordre :

1. **Une capture avant/après de la même scène de village**, dans `captures/`, nommées
   `avant-<ce-que-c-est>.png` et `apres-<ce-que-c-est>.png`. Même endroit, même moment de la
   journée, pour que la comparaison soit honnête. Playwright est déjà installé et le repo a des
   scripts de capture — sers-t'en.
2. **Le rendu branché dans le vrai jeu**, pas une planche de démonstration isolée. Je dois
   pouvoir faire `npm run dev` et voir le résultat en jouant. C'est l'erreur qui a été commise
   au bloc 7z : une planche magnifique que personne n'a jamais vue en jeu.
3. **Les 446 tests verts** et `npm run build` qui passe.
4. **Un résumé court** : ce que tu as changé, ce que tu as jeté, et ce dont tu n'es pas sûr.

## 5. Ce que tu lis avant de commencer

- **`SUITE.md`** — l'état complet du projet et les pièges. La section « Le grand dépouillage du
  9 septembre 2026 » et celle « Tranché le 10 septembre 2026 » sont les plus récentes : elles
  priment sur tout le reste.
- `design/4.30-la-refonte-visuelle.md` — la direction artistique.
- `design/4.17-tenir-la-fluidite.md` — **ses cinq règles ne se négocient pas.** La règle 3 dit
  que les frames se cuisent au démarrage dans des textures, jamais image par image. Elle décide
  de toute l'architecture du rendu.
- `src/game/dessin/palette.ts` — pourquoi aucune couleur ne peut être écrite en dur.
- `src/game/assets.ts` — le mécanisme PNG / procédural expliqué au §2 ci-dessus.
- `captures/7z-village-2.png` et `captures/7z-mer-2.png` — l'état actuel.
- La fin de `design/a-faire.md` : j'y colle mes idées en vrac, en bas, sans mise en forme. Va les
  chercher avant de coder.

## 6. Comment on travaille

- **Pas de questions ouvertes.** Si tu dois me demander quelque chose, propose 2 à 4 options
  concrètes avec ta recommandation en premier. Et si la question est visuelle, joins une image.
- **N'invente aucun chiffre que le design ne tranche pas.** Demande.
- **Ne me livre pas la moitié du travail.** Tous les éléments visibles passent : le sol, l'eau,
  les arbres, les maisons, l'église, les murs, les villageois, les héros, les monstres. Si tu
  dois couper, coupe le décor accessoire, et dis-le-moi explicitement.
- Français, phrases courtes, pas de jargon inutile.

**Commence par regarder les captures et me dire ce que tu comptes faire — en une dizaine de
lignes, pas une page. Puis code.**
