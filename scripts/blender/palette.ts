import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { C } from "../../src/game/ui/couleurs";
import {
  ARDOISE,
  BOIS,
  CONTOUR,
  ECORCE,
  EAU,
  FER,
  FEUILLE,
  LAITON,
  PIERRE,
  ROCHE,
  SABLE,
  SOL_VERT,
  SOUS_BOIS,
  TISSU,
  TOILE,
  TOIT_EGLISE,
  melanger,
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
};

// Les ouvertures (portes, fenetres) : le meme noir que `ouverture()` dans
// `batiments.ts`, en une seule valeur — un trou ne prend pas la lumiere.
const trou = melanger(PIERRE.sombre, FER.sombre, 0.6);

const sortie = {
  contour: CONTOUR,
  ombre: C.fer,
  matieres: { ...MATIERES, trou: { sombre: trou, corps: trou, clair: trou } },
};

const chemin = resolve("scripts/blender/palette.json");
writeFileSync(chemin, `${JSON.stringify(sortie, null, 2)}\n`);
console.log(`[palette] ${Object.keys(sortie.matieres).length} matieres -> ${chemin}`);
