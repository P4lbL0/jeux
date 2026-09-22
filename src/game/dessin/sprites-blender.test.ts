import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { cleEglise, cleMaison, CLE_FERME, CLE_MAISON_RUINE, VARIANTES_MAISON } from "./batiments";
import { DECORS } from "./decor";
import { ORDRE_CLASSES } from "../../core/classes";
import { familleDeHero } from "./heros";
import { familleDeMonstre } from "./monstres";
import { familleDeVillageois } from "./villageois";

/**
 * Les sprites rendus par Blender (`scripts/blender/`, bloc 7z, etage 6).
 *
 * Un PNG de `src/assets/` remplace le dessin au code **sous la meme cle**
 * (`assets.ts`). Deux facons de se tromper sans que rien ne casse a l'ecran :
 * un nom de fichier qui ne correspond a aucune cle (le PNG est charge pour
 * rien), et un decor dont la taille n'est plus celle de `decor.ts` (son pied,
 * calcule sur la taille, tomberait a cote du sol).
 */

const DOSSIER = resolve(__dirname, "../../assets");

function taillePng(chemin: string): { largeur: number; hauteur: number } {
  const octets = readFileSync(chemin);
  // L'en-tete IHDR : largeur puis hauteur, sur 4 octets chacune, a l'octet 16.
  return { largeur: octets.readUInt32BE(16), hauteur: octets.readUInt32BE(20) };
}

const pngs = readdirSync(DOSSIER).filter((f) => f.endsWith(".png"));

const CLES_CONNUES = new Set<string>([
  ...DECORS.map((d) => d.cle),
  ...Array.from({ length: VARIANTES_MAISON }, (_, v) => cleMaison(v)),
  CLE_FERME,
  CLE_MAISON_RUINE,
  ...[1, 2, 3, 4].map(cleEglise),
  // Les planches de personnages (20 septembre 2026) : une par classe et par
  // palier, une par archetype de monstre — la cle du four, `<famille>-planche`.
  ...ORDRE_CLASSES.flatMap((classe) => [0, 1, 2, 3, 4].map((palier) => `${familleDeHero(classe, palier)}-planche`)),
  // ⚠️ `ecumeur` et `engloutisseur` (§4.21, 22 septembre 2026) sont **dans
  // cette liste mais pas dans `ARCHETYPES`** : ils ne sortent que la nuit de
  // crue, et c'est `familleDeMonstre` qui leur donne leur planche.
  ...["fonceur", "essaim", "cracheur", "brute", "kamikaze", "revenant", "ecumeur", "engloutisseur", "mort-vivant", "familier", "familier-golem", "familier-spectre"].map(
    (id) => `${familleDeMonstre(id)}-planche`,
  ),
  ...(["pecheur", "fermier", "bucheron", "mineur", "forgeron", "charpentier", "guetteur", "survivant"] as const).flatMap((metier) =>
    [0, 0.5, 1].flatMap((usure) => [0, 1].map((sang) => `${familleDeVillageois(metier, { usure, sang })}-planche`)),
  ),
]);

describe("Sprites Blender — src/assets", () => {
  it("chaque PNG porte une cle de texture du jeu", () => {
    const inconnus = pngs.map((f) => f.replace(/\.png$/, "")).filter((c) => !CLES_CONNUES.has(c));
    expect(inconnus).toEqual([]);
  });

  it("chaque decor a la taille de decor.ts, sinon son pied tombe a cote", () => {
    for (const decor of DECORS) {
      const fichier = `${decor.cle}.png`;
      if (!pngs.includes(fichier)) continue;
      expect(taillePng(resolve(DOSSIER, fichier)), decor.cle).toEqual({
        largeur: decor.largeur,
        hauteur: decor.hauteur,
      });
    }
  });
});
