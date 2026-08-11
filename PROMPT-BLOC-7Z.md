# Prompt de reprise — le bloc 7z, la refonte visuelle

> Colle tout ce qui suit dans une nouvelle session, à la racine du projet.
>
> Écrit le 11 août 2026, tard, après une planche de propositions dessinée en code. **Tout le
> design est déjà écrit et tranché** — la session qui prend la suite n'a rien à décider sur le
> fond, elle a à construire.

---

Tu reprends **Le Protecteur**, mon jeu en cours. C'est mon premier jeu, je ne suis pas
développeur, je décide du design, tu construis et tu me signales ce qui cloche.

## 1. Avant TOUT, tu lis — et tu ne codes pas encore

- **`design/4.30-la-refonte-visuelle.md`** — c'est **ta** section, elle contient tout ce bloc.
  Lis-la en entier avant le reste.
- `SUITE.md` : l'état du projet, ce qui est fait, les pièges connus.
- `DESIGN.md` (le sommaire), puis dans `design/` : `05-ordre-de-construction.md` (le bloc 7z y
  est décrit et justifié), `06-questions-ouvertes.md` (ce qui n'est pas tranché, section « la
  refonte visuelle »), et **`4.17-tenir-la-fluidite.md` — ses cinq règles ne se négocient
  pas**, la règle 3 décide de toute l'architecture de ce bloc.
- Les sections que tu vas toucher : `4.11` (direction artistique, réécrite),
  `4.10` (interface et palette), `4.18` (les habitants, le bois, la pêche), `4.06` (la carte et
  les flancs fermés), `4.20` (les murs), `4.22` (l'église), `4.23` (le stress et les états),
  `4.24` (le mode d'aménagement), `4.21` (la grille et le ciel).
- `README.md` pour la structure et les commandes.
- L'état de git : `git log --oneline -5` et `git status`.
- ⚠️ **La fin de `design/a-faire.md`** : j'y colle mes idées en vrac, en bas, sans les mettre
  en forme. Va les chercher avant de coder.

## 2. Puis tu me fais l'état des lieux, et tu t'arrêtes

Avant d'écrire une ligne de code, dis-moi **où on en est exactement**, en distinguant : ce qui
**tourne vraiment**, ce qui est **écrit mais pas codé**, et ce qui n'est **pas tranché**.

Puis le **premier morceau** que tu comptes livrer, ce qu'il contient, et ce qui te manque.

**Pose-moi des questions à choix, jamais des questions ouvertes.** N'invente aucun chiffre que
le design ne tranche pas : demande.

## 3. Ce que le bloc 7z contient

Tout est au §4.30. Le résumé, pour que tu saches où tu vas :

**Deux règles neuves gouvernent tout.**

1. **Tout est dessiné par le code.** Plus aucun PNG de sprite. Personnages, bâtiments, décor
   et sol sont des **fonctions à paramètres** — un coup de pioche, c'est l'angle du bras.
   ⚠️ **Les frames se cuisent au démarrage, dans des textures, jamais par image** (§4.17
   règle 3). C'est la contrainte qui décide de toute l'architecture.
2. **Le monde passe en fer, os, sang** — les neuf couleurs de `src/game/ui/chrome.ts` et
   **aucune autre**. Chaque matière en tire trois valeurs. Et **tout est vu de face**, aligné
   sur la grille de 32 px.

**L'ordre à l'intérieur du bloc, du plus bloquant au plus décoratif :**

1. **Le socle** — un module de dessin : palette dérivée des neuf, contour automatique, cuisson
   des frames au démarrage. Rien ne se juge tant qu'il n'existe pas.
2. **Les personnages** — villageois, héros, monstres, et leurs animations.
3. **Les bâtiments** — église, maisons, maison de fermier, et **les murs, entièrement à
   refaire**.
4. **Le terrain** — le sol en code, les forêts denses, les arbres qui tombent, l'eau qui noie,
   la fin des ronds de poste.
5. **Le décor** — la place, les chemins, les détails de vie. **C'est le morceau à couper si le
   bloc dérape.**

**Ce qui est retenu, précisément :**

| | |
|---|---|
| **Église** | Proposition **A** (clocher latéral), **moins colorée**. ⚠️ Taille **2 × 2 (64 px)** par hypothèse — voir §4.30, à me confirmer |
| **Maisons** | Proposition **A** (pans de bois). Et la **C devient la maison de fermier** — logis + remise, aux couleurs de la A — qui **fait baisser le stress** de qui y vit ou y travaille |
| **Murs** | **Les trois propositions sont refusées** : « trop plates, ça fait une texture, pas un rempart ». À refaire avec crête claire, corps, pied sombre, ombre portée franche, et de la **hauteur**. Forme inchangée : 16 × 32, orientable, bois → fer → pierre, et **l'est-ouest et le nord-sud sont deux dessins différents** |
| **Villageois** | Le corps de la planche est validé. **L'outil n'est en main que pendant le travail.** Plus l'**usure** (voûté, pâle, cerné), le **sang** d'un blessé, et une animation de **toux** |
| **Héros** | Redessinés **dans le langage des villageois** — ils sont aujourd'hui trop différents. Ce qui les distingue devient **ce qu'ils portent** |
| **Le bois** | Les arbres **tombent** et **repoussent lentement**. Des **forêts denses** (où l'on croise plus de monstres) plus des arbres isolés. Le bûcheron **se déplace, coupe et ramène** — ça doit être **long et fatigant** |
| **L'eau** | **Personne ne nage.** ⚠️ Mais elle ne bloque pas assez aujourd'hui : « on a l'impression qu'on peut courir dessus ». Il faut qu'**on s'enfonce**, et qu'une **bulle prévienne** le héros incarné qu'il va se noyer. Un avertissement, jamais une mort surprise |
| **La pêche** | **Depuis le port, et uniquement de là.** Le poste de pêche sur la plage disparaît |
| **Les postes** | **Les ronds tracés au sol disparaissent.** On reconnaît un lieu à ce qu'il y a dessus |
| **Le sol** | Dessiné en code, écrit dans la grille. Ça débloque les chemins qui s'usent, la place, les cratères et les terres brûlées |
| **Le son** | **Hors périmètre**, mais chaque animation émet un **événement nommé** (coup de pioche, hache, toux, semis, chute d'arbre). Coût aujourd'hui : zéro |

**Ce qui part à la poubelle, et c'est assumé** : les 30 PNG de `src/assets/`, les 84 animations
générées, `scripts/animer-sprites.ts`, `scripts/png.ts`, `scripts/pixelliser.ts`.

⚠️ **Aucun modèle d'image n'entre dans ce chantier**, et c'est mesuré, pas supposé : ComfyUI a
donné moins bon que le dessin en code sous 96 px, et surtout **aucun modèle ne place un pixel
sur une grille**. L'IA garde sa place sur ce qui est grand et immobile — portraits,
illustrations, écran-titre.

## 4. Ensuite seulement, tu codes

- **Le design s'écrit dans `design/` AVANT d'être codé.** Une idée que je te donne, tu la
  notes, tu me dis honnêtement ce que tu en penses — y compris que c'est une mauvaise idée —
  puis tu la codes.
- **En français**, code et échanges. Les commentaires disent *pourquoi*, jamais *quoi*.
  **Pas d'accents dans les sources** (ASCII), accents normaux en Markdown.
- **`src/core/` ne connaît pas Phaser** : logique pure et testée. L'affichage vit dans
  `src/game/` et `src/scenes/`. Le contenu (classes, compétences, chiffres) est une **donnée**,
  pas du code éparpillé — et **la palette est une donnée aussi** : un seul endroit la porte.
- **Vérifie toujours, dans cet ordre** : `npx tsc --noEmit`, `npx vitest run`, `npm run build`.
- **Joue au jeu** : Playwright est installé, la recette est dans `SUITE.md`. Ça a trouvé trois
  bugs par bloc sur les cinq derniers blocs, aucun visible à la compilation. **Un bloc non joué
  n'est pas fini.** ⚠️ Deux pièges rencontrés le 11 août : lance le serveur sur un port libre
  (5199 est parfois déjà pris) et **ne mets pas ton script de test dans le dossier du projet** —
  Vite le surveille et recharge la page en plein test.
- **Regarde ce que tu dessines.** Pour un bloc entièrement visuel, la compilation ne prouve
  rien : fais des captures et **ouvre-les**. La planche de propositions a été refaite deux fois
  pour cette raison, et les deux fois le défaut ne se voyait qu'à l'œil.
- **Ne me dis jamais que quelque chose marche si tu ne l'as pas vérifié.** Si tu n'as pas pu
  tester, dis-le et dis-moi quoi tester.
- Un commit en français par bloc de travail. Tu ne pousses que si je le demande.
- Quand un bloc dérape, **livre la version minimale qui se joue** et dis-le. N'étends pas le
  périmètre : il a déjà triplé.

## 5. Ce qui m'attend derrière

Le **bloc 7a** est commencé et en pause. Ses fondations sont livrées et jouées (la ruine qui se
rebâtit, les règles de pose, démolir, déplacer, le mode d'aménagement à la touche `M`), mais
**quatre défauts que j'ai trouvés en jouant ne sont pas corrigés** — ils sont listés en fin de
`SUITE.md`. Ne les corrige pas : ils touchent l'affichage, et le 7z va le refaire.

**Commence par l'état des lieux.**
