# Captures

Toutes les images du projet, rangées par type puis par date. Un dossier = une séance,
et son nom dit la date et ce qu'on faisait ce jour-là.

| Dossier | Ce qu'il contient | Qui l'écrit |
|---|---|---|
| `jeu/` | Le jeu en marche : écrans, village, mer, nuit. Les paires `avant-*` / `apres-*` comparent un même cadrage avant et après un changement | `npx tsx scripts/capturer.ts <prefixe>` → `jeu/<date du jour>/` |
| `planches/` | Les dessins posés côte à côte, hors du jeu : bâtiments, décor, murs, personnages, carte | `npx tsx scripts/planche.ts` → `planches/<date du jour>/` |
| `blender/` | Les tests et les rendus faits dans Blender : sprites low-poly, cinématique | à la main, depuis les scripts Blender |

Pour retrouver une image : le dossier le plus récent de `jeu/` montre l'état actuel du jeu.
