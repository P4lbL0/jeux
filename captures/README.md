# Captures

Toutes les images du projet, rangées par type puis par date. Un dossier = une séance,
et son nom dit la date et ce qu'on faisait ce jour-là.

| Dossier | Ce qu'il contient | Qui l'écrit |
|---|---|---|
| `jeu/` | Le jeu en marche : écrans, village, mer, nuit. Les paires `avant-*` / `apres-*` comparent un même cadrage avant et après un changement | `npx tsx scripts/capturer.ts <prefixe>` → `jeu/<date du jour>/` |
| `jeu/<date>-mondes/` | Plusieurs mondes tirés (§4.29) : le monde entier et le village, une paire par graine — la graine 0 est le monde classique | `npx tsx scripts/capturer-mondes.ts 0,1,2` |
| `jeu/<date>-douves/` | Les douves en configurations (§4.20) : l'anneau en eau et ses ponts-levis, la meute devant les ponts, la dernière mise en eau refusée, le lac contourné | `npx tsx scripts/verifier-douves.ts` |
| `planches/` | Les dessins posés côte à côte, hors du jeu : bâtiments, décor, murs, personnages, carte | `npx tsx scripts/planche.ts` → `planches/<date du jour>/` |
| `blender/` | Les tests et les rendus faits dans Blender : sprites low-poly, cinématique | à la main pour les tests ; `npm run intro` → `blender/<date>-cinematique/` (le film entier et deux images fixes) |
| `son/` | Ce qui s'**écoute** : le film d'ouverture avec sa bande-son (`<date>-intro/`, vidéos du 19 septembre), et chaque musique jouée jusqu'à sa couture puis au-delà, pour vérifier que la boucle ne s'entend pas | `npm run son` → `son/<date>-musiques/<musique>-couture-a-<m>m<s>s.mp3` |

Pour retrouver une image : le dossier le plus récent de `jeu/` montre l'état actuel du jeu.
