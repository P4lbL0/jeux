import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { C } from "../../src/game/ui/couleurs";
import { CLASSES, ORDRE_CLASSES } from "../../src/core/classes";
import { TABLIERS } from "../../src/game/dessin/villageois";
import {
  ARDOISE,
  BOIS,
  BRAISE,
  COEUR_DU_FEU,
  FUMEE,
  CHAIR,
  CONTOUR,
  ECORCE,
  EAU,
  FER,
  FEUILLE,
  FLAMME,
  LAITON,
  MONSTRE,
  ORC,
  PIERRE,
  ROCHE,
  SABLE,
  SANG,
  SOL_VERT,
  SOUS_BOIS,
  TISSU,
  TOILE,
  TOIT_EGLISE,
  desaturer,
  matiere,
  melanger,
  palir,
  rebaser,
  type Matiere,
} from "../../src/game/dessin/palette";

/**
 * Exporte la palette du monde pour les scripts Blender.
 *
 *     npx tsx scripts/blender/palette.ts
 *
 * Blender ne choisit **aucune couleur** : il calcule la lumiere, et
 * `reduire.py` repeint chaque pixel avec les trois tons de sa matiere, pris ici.
 * C'est ce qui garde la regle du §4.30 (« une couleur qui ne descend pas des neuf
 * ne peut pas exister ») meme pour un sprite venu de la 3D.
 */

const MATIERES: Record<string, Matiere> = {
  pierre: PIERRE,
  bois: BOIS,
  fer: FER,
  ardoise: ARDOISE,
  toit_eglise: TOIT_EGLISE,
  laiton: LAITON,
  toile: TOILE,
  // le linge sombre des cordes a linge : le tissu des villageois
  tissu: TISSU,
  feuille: FEUILLE,
  ecorce: ECORCE,
  roche: ROCHE,
  sol_vert: SOL_VERT,
  sous_bois: SOUS_BOIS,
  sable: SABLE,
  eau: EAU,
  // Les personnages (20 septembre 2026) : la peau, les os d'un mort, le sang
  // des yeux des monstres, et les cinq chairs de bete de `monstres.ts`.
  chair: CHAIR,
  os: matiere(desaturer(melanger(C.os, C.fer, 0.1), 0.2)),
  sang: SANG,
  monstre: MONSTRE,
  monstre_pale: palir(MONSTRE, 0.5),
  monstre_bile: matiere(melanger(MONSTRE.corps, C.bile, 0.35)),
  monstre_fer: matiere(melanger(MONSTRE.corps, C.fer, 0.25)),
  monstre_sang: matiere(melanger(MONSTRE.corps, C.sangSeche, 0.3)),
  // Les deux betes d'eau (§4.21, la nuit de crue, 22 septembre 2026). La meme
  // chair de monstre, noyee : l'ecumeur prend le reflet du ciel comme l'eau
  // elle-meme, l'engloutisseur prend la vase du fond. Deux melanges, pas deux
  // inventions — une bete d'eau doit rester une bete de ce jeu.
  monstre_ecume: matiere(melanger(MONSTRE.corps, EAU.corps, 0.62)),
  // ⚠️ **Deux jets rates avant celui-la**, et la raison est la meme : l'eau de
  // ce jeu est un gris-bleu derive du fer, donc **melanger a l'eau ne teinte
  // rien** — l'engloutisseur restait un tas de pierres, confondu avec le golem.
  // Ce qui dit le fond, ce n'est pas l'eau : c'est la **vase**. Il prend donc
  // le vert du sous-bois, juste mouille d'un peu d'eau.
  monstre_fond: matiere(melanger(melanger(MONSTRE.corps, SOUS_BOIS.corps, 0.55), EAU.sombre, 0.25)),
  // La tunique de chaque classe, rebasee dans le monde comme dans `heros.ts`.
  ...Object.fromEntries(ORDRE_CLASSES.map((c) => [`classe_${c}`, rebaser(CLASSES[c].couleur)])),
  // Les villageois (20 septembre 2026, soir) : le tablier de chaque metier —
  // les memes melanges que `villageois.ts` —, la chair d'un corps use, et les
  // deux familiers qui flottent.
  // ⚠️ **Repris de `villageois.ts`, jamais recopie** : les huit teintes y etaient
  // dupliquees mot pour mot, ce qui garantissait qu'un jour le rendu et le
  // dessin derivent l'un de l'autre.
  ...Object.fromEntries(
    Object.entries(TABLIERS)
      .filter(([, m]) => m !== null)
      .map(([metier, m]) => [`tablier_${metier}`, m!]),
  ),
  chair_usee: matiere(desaturer(melanger(CHAIR.corps, C.os, 0.3), 0.3)),
  familier: matiere(desaturer(melanger(C.cielSale, C.fer, 0.3), 0.25)),
  spectre: matiere(melanger(C.os, C.fer, 0.3)),
  // Le feu (§4.21) : ajoutees **a la fin**, pour ne pas decaler les
  // couleurs-codes des sprites deja rendus.
  flamme: FLAMME,
  braise: BRAISE,
  coeur_du_feu: COEUR_DU_FEU,
  // La fumee (22 septembre 2026, tard) : ajoutee **apres** les trois du feu, pour la
  // meme raison qu'elles — un rang de plus au milieu decalerait la
  // couleur-code de toutes les matieres suivantes, et les sprites deja
  // rendus se reduiraient avec les mauvaises teintes.
  fumee: FUMEE,
};

// Les ouvertures (portes, fenetres) : le meme noir que `ouverture()` dans
// `batiments.ts`, en une seule valeur — un trou ne prend pas la lumiere.
const trou = melanger(PIERRE.sombre, FER.sombre, 0.6);

const sortie = {
  contour: CONTOUR,
  ombre: C.fer,
  // ⚠️ L'orc (§4.33) vient **apres** `trou`, tout au bout : une matiere de plus
  // au milieu decalerait la couleur-code de toutes les suivantes — et `trou`,
  // les portes et les fenetres, en fait partie.
  matieres: { ...MATIERES, trou: { sombre: trou, corps: trou, clair: trou }, orc: ORC },
};

const chemin = resolve("scripts/blender/palette.json");
writeFileSync(chemin, `${JSON.stringify(sortie, null, 2)}\n`);
console.log(`[palette] ${Object.keys(sortie.matieres).length} matieres -> ${chemin}`);
