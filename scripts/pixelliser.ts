/**
 * Transforme une image generee (grande, lisse, en millions de couleurs) en
 * sprite qui entre dans la direction artistique du jeu.
 *
 * **Pourquoi ce script existe.** PixelLab est a 0 credit, donc les nouveaux
 * batiments passent par un modele de diffusion local (ComfyUI + SD1.5, installe
 * hors du depot). Un modele de diffusion ne sait pas faire du pixel-art : il
 * fait une jolie illustration de 512 px, avec des degrades, un anticrenelage et
 * quinze mille couleurs. Ce qui la transforme en sprite, ce n'est pas le modele,
 * c'est ce fichier.
 *
 * Et c'est le meme principe que `animer-sprites.ts` : **la direction artistique
 * ne peut pas deriver, parce que les couleurs de sortie sont exactement celles
 * des sprites deja en jeu.** La palette n'est pas ecrite ici, elle est *relevee*
 * sur `src/assets/`. Le jour ou les maisons changent de teintes, l'eglise suit
 * sans qu'on touche a une ligne.
 *
 * Usage :
 *   npx tsx scripts/pixelliser.ts <source.png> <sortie.png> [--taille 64]
 *                                 [--couleurs 24] [--reference "maison-*,mur"]
 */

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { ecrirePng, imageVide, lirePng, type Image } from "./png";

const ASSETS = resolve(process.cwd(), "src/assets");

type Couleur = [number, number, number];

// --------------------------------------------------------------- la palette

/**
 * Releve la palette des sprites deja en jeu.
 *
 * On ne garde que les couleurs qui **portent** l'image : celles vues moins de
 * `minimum` fois sont du bruit d'anticrenelage sur les bords, et les inclure
 * ferait ressortir des pixels sales sur le nouveau sprite.
 */
function releverPalette(motifs: string[], minimum = 12): Couleur[] {
  const comptes = new Map<number, number>();

  const fichiers = readdirSync(ASSETS).filter((nom) => {
    if (!nom.endsWith(".png")) return false;
    return motifs.some((motif) =>
      motif.endsWith("*") ? nom.startsWith(motif.slice(0, -1)) : nom === `${motif}.png`,
    );
  });

  if (fichiers.length === 0) {
    throw new Error(`Aucun sprite de reference trouve dans ${ASSETS} pour ${motifs.join(", ")}`);
  }

  for (const nom of fichiers) {
    const image = lirePng(readFileSync(join(ASSETS, nom)));
    for (let i = 0; i < image.pixels.length; i += 4) {
      // Un pixel a moitie transparent n'a pas de couleur fiable : sa teinte est
      // deja melangee a ce qu'il y avait derriere au moment du dessin.
      if (image.pixels[i + 3] < 250) continue;
      const cle = (image.pixels[i] << 16) | (image.pixels[i + 1] << 8) | image.pixels[i + 2];
      comptes.set(cle, (comptes.get(cle) ?? 0) + 1);
    }
  }

  const palette: Couleur[] = [];
  for (const [cle, compte] of comptes) {
    if (compte < minimum) continue;
    palette.push([(cle >> 16) & 255, (cle >> 8) & 255, cle & 255]);
  }

  console.log(`  palette relevee sur ${fichiers.length} sprites : ${palette.length} couleurs`);
  return palette;
}

/**
 * Distance entre deux couleurs, ponderee comme l'oeil les voit.
 *
 * Une distance euclidienne brute en RVB fait deriver les verts vers les gris :
 * l'oeil est bien plus sensible au vert qu'au bleu, et une palette de village
 * est pleine de verts et de bruns qu'il ne faut pas confondre.
 */
function ecart(a: Couleur, b: Couleur): number {
  const dr = a[0] - b[0];
  const dv = a[1] - b[1];
  const db = a[2] - b[2];
  return dr * dr * 0.3 + dv * dv * 0.59 + db * db * 0.11;
}

function plusProche(couleur: Couleur, palette: Couleur[]): Couleur {
  let meilleure = palette[0];
  let meilleurEcart = Infinity;
  for (const candidate of palette) {
    const e = ecart(couleur, candidate);
    if (e < meilleurEcart) {
      meilleurEcart = e;
      meilleure = candidate;
    }
  }
  return meilleure;
}

// ------------------------------------------------------------------- le fond

/**
 * Rend transparent le fond de l'image generee.
 *
 * On ne demande pas au modele un fond transparent — il n'en produit pas. On lui
 * demande un fond **uni**, et on l'enleve ici en partant des quatre coins :
 * tout ce qui touche un bord et ressemble a la couleur du bord s'en va, de
 * proche en proche. Un remplissage par diffusion plutot qu'un seuil global,
 * sinon un toit de la meme teinte que le fond disparaitrait avec lui.
 */
function detourer(image: Image, tolerance = 40): void {
  const { largeur, hauteur, pixels } = image;
  const fond: Couleur = [pixels[0], pixels[1], pixels[2]];
  const vus = new Uint8Array(largeur * hauteur);
  const pile: number[] = [];

  for (let x = 0; x < largeur; x++) {
    pile.push(x, (hauteur - 1) * largeur + x);
  }
  for (let y = 0; y < hauteur; y++) {
    pile.push(y * largeur, y * largeur + largeur - 1);
  }

  const seuil = tolerance * tolerance;

  while (pile.length > 0) {
    const indice = pile.pop()!;
    if (vus[indice]) continue;
    vus[indice] = 1;

    const p = indice * 4;
    const couleur: Couleur = [pixels[p], pixels[p + 1], pixels[p + 2]];
    if (ecart(couleur, fond) > seuil) continue;

    pixels[p + 3] = 0;

    const x = indice % largeur;
    const y = (indice - x) / largeur;
    if (x > 0) pile.push(indice - 1);
    if (x < largeur - 1) pile.push(indice + 1);
    if (y > 0) pile.push(indice - largeur);
    if (y < hauteur - 1) pile.push(indice + largeur);
  }
}

/** Le plus petit rectangle qui contient encore quelque chose d'opaque. */
function cadrer(image: Image): { x: number; y: number; largeur: number; hauteur: number } {
  let x0 = image.largeur;
  let y0 = image.hauteur;
  let x1 = -1;
  let y1 = -1;

  for (let y = 0; y < image.hauteur; y++) {
    for (let x = 0; x < image.largeur; x++) {
      if (image.pixels[(y * image.largeur + x) * 4 + 3] < 128) continue;
      if (x < x0) x0 = x;
      if (y < y0) y0 = y;
      if (x > x1) x1 = x;
      if (y > y1) y1 = y;
    }
  }

  if (x1 < 0) throw new Error("L'image est entierement transparente apres detourage");
  return { x: x0, y: y0, largeur: x1 - x0 + 1, hauteur: y1 - y0 + 1 };
}

// ------------------------------------------------------------- la reduction

/**
 * Reduit par **moyenne de bloc**, en ignorant les pixels transparents.
 *
 * Prendre un pixel sur N (echantillonnage) donnerait un resultat qui scintille
 * d'une generation a l'autre : deux images presque identiques tomberaient sur
 * des pixels differents. La moyenne, elle, est stable — et surtout elle ne fait
 * pas baver le fond transparent sur les bords du batiment, puisque les pixels
 * vides ne comptent pas dans la moyenne.
 */
function reduire(source: Image, cadre: ReturnType<typeof cadrer>, cote: number): Image {
  // Le batiment garde ses proportions : on l'inscrit dans un carre de `cote`.
  const echelle = Math.max(cadre.largeur, cadre.hauteur) / cote;
  const largeur = Math.max(1, Math.round(cadre.largeur / echelle));
  const hauteur = Math.max(1, Math.round(cadre.hauteur / echelle));
  const sortie = imageVide(largeur, hauteur);

  for (let y = 0; y < hauteur; y++) {
    for (let x = 0; x < largeur; x++) {
      const x0 = cadre.x + Math.floor((x * cadre.largeur) / largeur);
      const x1 = cadre.x + Math.floor(((x + 1) * cadre.largeur) / largeur);
      const y0 = cadre.y + Math.floor((y * cadre.hauteur) / hauteur);
      const y1 = cadre.y + Math.floor(((y + 1) * cadre.hauteur) / hauteur);

      let r = 0;
      let v = 0;
      let b = 0;
      let opaques = 0;
      let total = 0;

      for (let sy = y0; sy < Math.max(y1, y0 + 1); sy++) {
        for (let sx = x0; sx < Math.max(x1, x0 + 1); sx++) {
          const p = (sy * source.largeur + sx) * 4;
          total += 1;
          if (source.pixels[p + 3] < 128) continue;
          r += source.pixels[p];
          v += source.pixels[p + 1];
          b += source.pixels[p + 2];
          opaques += 1;
        }
      }

      const p = (y * largeur + x) * 4;
      // Un bloc majoritairement vide devient vide : c'est ce qui donne un bord
      // net au lieu d'un halo a moitie transparent, que le pixel-art ne tolere pas.
      if (opaques * 2 < total || opaques === 0) continue;
      sortie.pixels[p] = Math.round(r / opaques);
      sortie.pixels[p + 1] = Math.round(v / opaques);
      sortie.pixels[p + 2] = Math.round(b / opaques);
      sortie.pixels[p + 3] = 255;
    }
  }

  return sortie;
}

function snapper(image: Image, palette: Couleur[]): void {
  const cache = new Map<number, Couleur>();

  for (let i = 0; i < image.pixels.length; i += 4) {
    if (image.pixels[i + 3] === 0) continue;
    const cle = (image.pixels[i] << 16) | (image.pixels[i + 1] << 8) | image.pixels[i + 2];
    let couleur = cache.get(cle);
    if (!couleur) {
      couleur = plusProche([image.pixels[i], image.pixels[i + 1], image.pixels[i + 2]], palette);
      cache.set(cle, couleur);
    }
    image.pixels[i] = couleur[0];
    image.pixels[i + 1] = couleur[1];
    image.pixels[i + 2] = couleur[2];
  }
}

// ------------------------------------------------------------------ l'entree

function option(nom: string, defaut: string): string {
  const i = process.argv.indexOf(`--${nom}`);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : defaut;
}

function main(): void {
  const [source, sortie] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  if (!source || !sortie) {
    console.error("Usage : npx tsx scripts/pixelliser.ts <source.png> <sortie.png> [--taille 64]");
    process.exit(1);
  }

  const cote = Number(option("taille", "64"));
  const references = option("reference", "maison-*,mur,rocher").split(",");

  console.log(`Pixellisation de ${source}`);
  const palette = releverPalette(references);

  const image = lirePng(readFileSync(resolve(source)));
  console.log(`  source : ${image.largeur}x${image.hauteur}`);

  detourer(image);
  const cadre = cadrer(image);
  console.log(`  sujet detoure : ${cadre.largeur}x${cadre.hauteur}`);

  const reduite = reduire(image, cadre, cote);
  snapper(reduite, palette);

  writeFileSync(resolve(sortie), ecrirePng(reduite));
  console.log(`  ecrit : ${sortie} (${reduite.largeur}x${reduite.hauteur})`);
}

main();
