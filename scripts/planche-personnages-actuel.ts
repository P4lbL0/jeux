import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { ecrirePng, imageVide, poser, type Image } from "./png";
import { Toile } from "../src/game/dessin/pinceau";
import { avancementDe, type Modele } from "../src/game/dessin/four";
import { bete, mort } from "../src/game/dessin/monstres";
import { hero } from "../src/game/dessin/heros";
import { ORDRE_CLASSES } from "../src/core/classes";

/**
 * Les personnages **tels que le code les dessine aujourd'hui**, dans la meme
 * disposition que la planche low-poly de `scripts/blender/planche_persos.py` :
 * une ligne par famille (ordre alphabetique des cles), le repos, la marche,
 * l'attaque, l'incantation, la charge, le coup encaisse, la mort, la toux.
 * Zoom x4. C'est l'« avant » a poser a cote de l'« apres ».
 *
 *     npx tsx scripts/planche-personnages-actuel.ts [dossier]
 */

const ZOOM = 4;
const dossier = resolve(process.argv[2] ?? `captures/blender/${new Date().toISOString().slice(0, 10)}-personnages`);
mkdirSync(dossier, { recursive: true });

const FOND: [number, number, number, number] = [78, 92, 49, 255];

function frame(modele: Modele, geste: string, i: number): Toile {
  const g = modele.gestes.find((x) => x.cle === geste)!;
  const toile = new Toile(modele.taille, modele.taille);
  modele.dessiner(toile, geste, avancementDe(g, i));
  toile.contour();
  return toile;
}

function coller(image: Image, toile: Toile, x: number, y: number): void {
  const pixels = toile.donnees();
  for (let ty = 0; ty < toile.hauteur; ty += 1) {
    for (let tx = 0; tx < toile.largeur; tx += 1) {
      const i = (ty * toile.largeur + tx) * 4;
      const a = pixels[i + 3]!;
      if (a === 0) continue;
      for (let ey = 0; ey < ZOOM; ey += 1) {
        for (let ex = 0; ex < ZOOM; ex += 1) {
          const px = x + tx * ZOOM + ex;
          const py = y + ty * ZOOM + ey;
          if (a === 255) poser(image, px, py, [pixels[i]!, pixels[i + 1]!, pixels[i + 2]!, 255]);
          else {
            const j = (py * image.largeur + px) * 4;
            if (px < 0 || py < 0 || px >= image.largeur || py >= image.hauteur) continue;
            const part = a / 255;
            for (let c = 0; c < 3; c += 1) {
              image.pixels[j + c] = Math.round(image.pixels[j + c]! * (1 - part) + pixels[i + c]! * part);
            }
          }
        }
      }
    }
  }
}

const familles: Array<{ cle: string; modele: Modele }> = [
  ...ORDRE_CLASSES.map((c) => ({ cle: `hero-${c}-p0`, modele: hero(c, 0) })),
  ...(["fonceur", "essaim", "cracheur", "brute", "kamikaze"] as const).map((id) => ({ cle: `monstre-${id}`, modele: bete(id) })),
  { cle: "monstre-revenant", modele: mort("revenant") },
].sort((a, b) => a.cle.localeCompare(b.cle));

const GESTES = ["repos", "marche", "attaque", "incantation", "charge", "touche", "mort", "toux"];
const CADRE_MAX = 30;
const hauteurLigne = CADRE_MAX * ZOOM + 22;
let plusLarge = 0;
for (const { modele } of familles) {
  let largeur = 190;
  for (const g of GESTES) {
    const geste = modele.gestes.find((x) => x.cle === g);
    if (geste) largeur += geste.frames * (modele.taille * ZOOM + 2) + 18;
  }
  plusLarge = Math.max(plusLarge, largeur);
}
const image = imageVide(plusLarge + 20, familles.length * hauteurLigne + 40);
for (let y = 0; y < image.hauteur; y += 1) for (let x = 0; x < image.largeur; x += 1) poser(image, x, y, FOND);

let y = 34;
for (const { modele } of familles) {
  let x = 190;
  for (const g of GESTES) {
    const geste = modele.gestes.find((k) => k.cle === g);
    if (!geste) continue;
    for (let i = 0; i < geste.frames; i += 1) {
      coller(image, frame(modele, g, i), x, y + hauteurLigne - modele.taille * ZOOM - 4);
      x += modele.taille * ZOOM + 2;
    }
    x += 18;
  }
  y += hauteurLigne;
}
const chemin = resolve(dossier, "planche-personnages-actuel.png");
writeFileSync(chemin, ecrirePng(image));
console.log(`[planche] ${chemin} — ${familles.map((f) => f.cle).join(", ")}`);
