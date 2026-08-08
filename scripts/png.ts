/**
 * Lecture et ecriture de PNG, sans dependance.
 *
 * Un PNG, c'est une suite de blocs : `IHDR` (les dimensions), `PLTE`/`tRNS`
 * (la palette, quand il y en a une), `IDAT` (les pixels, deflates) et `IEND`.
 * Node sait deja tout faire — `zlib` pour la compression, `Buffer` pour les
 * octets — donc ajouter une bibliotheque pour ca serait payer une dependance
 * qu'on n'utiliserait qu'ici, dans un script qui ne tourne jamais en jeu.
 *
 * On ne gere que ce que le projet produit : des images 8 bits par canal, en
 * couleur vraie avec alpha (type 6), en niveaux de gris (0), RVB (2) ou
 * palettees (3). Tout est ramene en RGBA a la lecture, et toujours reecrit en
 * RGBA — c'est le seul format dont le generateur d'animations a besoin.
 */

import { deflateSync, inflateSync } from "node:zlib";

export interface Image {
  largeur: number;
  hauteur: number;
  /** Quatre octets par pixel, ligne par ligne : R, V, B, A */
  pixels: Uint8Array;
}

/** Cree une image entierement transparente. */
export function imageVide(largeur: number, hauteur: number): Image {
  return { largeur, hauteur, pixels: new Uint8Array(largeur * hauteur * 4) };
}

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

// ------------------------------------------------------------------ lecture

export function lirePng(donnees: Buffer): Image {
  if (!donnees.subarray(0, 8).equals(SIGNATURE)) {
    throw new Error("Ce fichier n'est pas un PNG");
  }

  let largeur = 0;
  let hauteur = 0;
  let profondeur = 8;
  let typeCouleur = 6;
  let entrelace = 0;
  let palette: Buffer | null = null;
  let transparence: Buffer | null = null;
  const morceaux: Buffer[] = [];

  let position = 8;
  while (position < donnees.length) {
    const taille = donnees.readUInt32BE(position);
    const type = donnees.toString("ascii", position + 4, position + 8);
    const corps = donnees.subarray(position + 8, position + 8 + taille);
    position += 12 + taille; // taille + type + corps + CRC

    if (type === "IHDR") {
      largeur = corps.readUInt32BE(0);
      hauteur = corps.readUInt32BE(4);
      profondeur = corps[8]!;
      typeCouleur = corps[9]!;
      entrelace = corps[12]!;
    } else if (type === "PLTE") palette = Buffer.from(corps);
    else if (type === "tRNS") transparence = Buffer.from(corps);
    else if (type === "IDAT") morceaux.push(Buffer.from(corps));
    else if (type === "IEND") break;
  }

  if (profondeur !== 8) throw new Error(`Profondeur ${profondeur} non geree`);
  if (entrelace !== 0) throw new Error("PNG entrelace (Adam7) non gere");

  const canaux = CANAUX[typeCouleur];
  if (canaux === undefined) throw new Error(`Type de couleur ${typeCouleur} non gere`);

  const brut = inflateSync(Buffer.concat(morceaux));
  const lignes = defiltrer(brut, largeur, hauteur, canaux);
  return versRgba(lignes, largeur, hauteur, typeCouleur, canaux, palette, transparence);
}

/** Nombre d'octets par pixel, par type de couleur PNG. */
const CANAUX: Record<number, number | undefined> = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

/**
 * Annule les filtres de ligne.
 *
 * Chaque ligne d'un PNG est prefixee d'un octet qui dit comment elle a ete
 * predite a partir de sa voisine de gauche et de celle du dessus. C'est ce qui
 * rend la compression efficace, et c'est la seule vraie subtilite du format.
 */
function defiltrer(brut: Buffer, largeur: number, hauteur: number, canaux: number): Buffer {
  const parLigne = largeur * canaux;
  const sortie = Buffer.alloc(parLigne * hauteur);

  for (let y = 0; y < hauteur; y++) {
    const filtre = brut[y * (parLigne + 1)]!;
    const source = y * (parLigne + 1) + 1;
    const cible = y * parLigne;

    for (let i = 0; i < parLigne; i++) {
      const octet = brut[source + i]!;
      // a : le pixel de gauche ; b : celui du dessus ; c : celui en diagonale.
      const a = i >= canaux ? sortie[cible + i - canaux]! : 0;
      const b = y > 0 ? sortie[cible - parLigne + i]! : 0;
      const c = y > 0 && i >= canaux ? sortie[cible - parLigne + i - canaux]! : 0;

      let valeur: number;
      switch (filtre) {
        case 0: valeur = octet; break;
        case 1: valeur = octet + a; break;
        case 2: valeur = octet + b; break;
        case 3: valeur = octet + ((a + b) >> 1); break;
        case 4: valeur = octet + paeth(a, b, c); break;
        default: throw new Error(`Filtre PNG inconnu : ${filtre}`);
      }
      sortie[cible + i] = valeur & 0xff;
    }
  }
  return sortie;
}

/** Le predicteur de Paeth : celui des trois voisins dont on s'ecarte le moins. */
function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const da = Math.abs(p - a);
  const db = Math.abs(p - b);
  const dc = Math.abs(p - c);
  if (da <= db && da <= dc) return a;
  return db <= dc ? b : c;
}

function versRgba(
  lignes: Buffer,
  largeur: number,
  hauteur: number,
  typeCouleur: number,
  canaux: number,
  palette: Buffer | null,
  transparence: Buffer | null,
): Image {
  const pixels = new Uint8Array(largeur * hauteur * 4);

  for (let i = 0; i < largeur * hauteur; i++) {
    const source = i * canaux;
    const cible = i * 4;
    let r = 0;
    let v = 0;
    let b = 0;
    let a = 255;

    if (typeCouleur === 6) {
      r = lignes[source]!; v = lignes[source + 1]!; b = lignes[source + 2]!; a = lignes[source + 3]!;
    } else if (typeCouleur === 2) {
      r = lignes[source]!; v = lignes[source + 1]!; b = lignes[source + 2]!;
    } else if (typeCouleur === 0) {
      r = v = b = lignes[source]!;
    } else if (typeCouleur === 4) {
      r = v = b = lignes[source]!; a = lignes[source + 1]!;
    } else if (typeCouleur === 3 && palette) {
      const index = lignes[source]!;
      r = palette[index * 3]!; v = palette[index * 3 + 1]!; b = palette[index * 3 + 2]!;
      a = transparence && index < transparence.length ? transparence[index]! : 255;
    }

    pixels[cible] = r;
    pixels[cible + 1] = v;
    pixels[cible + 2] = b;
    pixels[cible + 3] = a;
  }

  return { largeur, hauteur, pixels };
}

// ----------------------------------------------------------------- ecriture

export function ecrirePng(image: Image): Buffer {
  const { largeur, hauteur, pixels } = image;
  const parLigne = largeur * 4;

  // On ecrit sans filtre (type 0). Sur des sprites de quelques kilo-octets, le
  // gain d'un filtrage adaptatif ne vaut pas le code qu'il demande.
  const brut = Buffer.alloc((parLigne + 1) * hauteur);
  for (let y = 0; y < hauteur; y++) {
    brut[y * (parLigne + 1)] = 0;
    Buffer.from(pixels.buffer, pixels.byteOffset + y * parLigne, parLigne).copy(
      brut,
      y * (parLigne + 1) + 1,
    );
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(largeur, 0);
  ihdr.writeUInt32BE(hauteur, 4);
  ihdr[8] = 8; // 8 bits par canal
  ihdr[9] = 6; // couleur vraie + alpha
  ihdr[10] = 0; // compression deflate
  ihdr[11] = 0; // filtrage standard
  ihdr[12] = 0; // pas d'entrelacement

  return Buffer.concat([
    SIGNATURE,
    bloc("IHDR", ihdr),
    bloc("IDAT", deflateSync(brut, { level: 9 })),
    bloc("IEND", Buffer.alloc(0)),
  ]);
}

function bloc(type: string, corps: Buffer): Buffer {
  const entete = Buffer.alloc(8);
  entete.writeUInt32BE(corps.length, 0);
  entete.write(type, 4, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([entete.subarray(4), corps])), 0);
  return Buffer.concat([entete, corps, crc]);
}

/** La table du CRC-32, calculee une fois au chargement du module. */
const TABLE_CRC = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(donnees: Buffer): number {
  let c = 0xffffffff;
  for (const octet of donnees) c = TABLE_CRC[(c ^ octet) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// ------------------------------------------------------------------- outils

/** Lit le pixel (x, y) ; renvoie du transparent hors des bords. */
export function pixel(image: Image, x: number, y: number): [number, number, number, number] {
  if (x < 0 || y < 0 || x >= image.largeur || y >= image.hauteur) return [0, 0, 0, 0];
  const i = (y * image.largeur + x) * 4;
  return [image.pixels[i]!, image.pixels[i + 1]!, image.pixels[i + 2]!, image.pixels[i + 3]!];
}

/**
 * Pose un pixel, en ignorant le transparent.
 *
 * Les frames sont composees en empilant des morceaux decoupes : ecrire les
 * pixels vides effacerait ce qui a deja ete pose dessous.
 */
export function poser(
  image: Image,
  x: number,
  y: number,
  couleur: [number, number, number, number],
): void {
  if (x < 0 || y < 0 || x >= image.largeur || y >= image.hauteur) return;
  if (couleur[3] === 0) return;
  const i = (y * image.largeur + x) * 4;
  image.pixels[i] = couleur[0];
  image.pixels[i + 1] = couleur[1];
  image.pixels[i + 2] = couleur[2];
  image.pixels[i + 3] = couleur[3];
}
