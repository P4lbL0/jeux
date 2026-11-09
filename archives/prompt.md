Tu reprends "Le Protecteur", mon jeu en cours (dossier jeux). C'est mon premier jeu,
je ne suis pas developpeur, je decide du design, tu construis et tu me signales ce
qui cloche.

## 1. Avant TOUT, tu lis — et tu ne codes pas encore

- `SUITE.md` : l'etat du projet, ce qui est fait, les pieges connus.
- `DESIGN.md` (le sommaire) puis, dans `design/` : `05-ordre-de-construction.md`
  (quoi coder ensuite), `06-questions-ouvertes.md` (ce qui n'est pas tranche),
  `4.17-tenir-la-fluidite.md` (ses cinq regles ne se negocient pas), et les
  sections du morceau que tu vas toucher.
- `README.md` pour la structure et les commandes.
- L'etat de git : `git log --oneline -5` et `git status`.
- ⚠️ **La fin des fichiers de design** : j'y colle mes idees en vrac, en bas, sans
  les mettre en forme. Va les chercher avant de coder, sinon tu codes une version
  perimee.

## 2. Puis tu me fais l'etat des lieux, et tu t'arretes

Avant d'ecrire une ligne de code, tu me dis **ou on en est exactement**, en
distinguant trois choses qu'on confond tout le temps :

| | |
|---|---|
| **Code** | ce qui tourne vraiment dans le jeu |
| **Ecrit, pas code** | ce qui est dans le design et n'existe nulle part |
| **Pas tranche** | ce que ni toi ni moi n'avons decide |

Puis : **le prochain morceau**, ce qu'il contient, ce dont il depend, et ce qui
te manque pour le faire.

Si le design et le code se contredisent, tu me le dis a ce moment-la — une fois,
avec ce que ca coute. Ma derniere decision prime sur le document, meme quand elle
le contredit frontalement ; le paragraphe perime se reecrit, il ne se laisse pas
mentir.

**Pose-moi des questions a choix, jamais des questions ouvertes.** N'invente
aucun chiffre que le design ne tranche pas : demande.

## 3. Ensuite seulement, tu codes

- **Le design s'ecrit dans `design/` AVANT d'etre code.** Une idee que je te
  donne, tu la notes, tu me dis honnetement ce que tu en penses — y compris que
  c'est une mauvaise idee — puis tu la codes.
- **En francais**, code et echanges. Les commentaires disent *pourquoi*, jamais
  *quoi*. **Pas d'accents dans les sources** (ASCII), accents normaux en Markdown.
- **`src/core/` ne connait pas Phaser** : logique pure et testee. L'affichage vit
  dans `src/game/` et `src/scenes/`. Le contenu (classes, competences, chiffres)
  est une donnee, pas du code eparpille.
- **Verifie toujours, dans cet ordre** : `npx tsc --noEmit`, `npx vitest run`,
  `npm run build`.
- **Joue au jeu** : Playwright est installe, la recette est dans `SUITE.md`. Ca a
  trouve trois bugs par bloc sur les trois derniers blocs, aucun visible a la
  compilation. Un bloc non joue n'est pas fini.
- **Ne me dis jamais que quelque chose marche si tu ne l'as pas verifie.** Si tu
  n'as pas pu tester quelque chose, dis-le et dis-moi quoi tester.
- Un commit en francais par bloc de travail. Tu ne pousses que si je le demande.
- Quand un bloc derape, **livre la version minimale qui se joue** et dis-le.
  N'etends pas le perimetre : il a deja triple.

Commence par l'etat des lieux.