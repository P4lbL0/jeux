import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { ecrirePng, imageVide, poser, type Image } from "./png";
import { peindreLaCarte } from "../src/game/dessin/carte";
import { DECORS, peindreDecor } from "../src/game/dessin/decor";
import {
  CHANTIERS,
  CLES_CHAMP,
  EGLISE,
  FERME,
  MAISON,
  NAVIRE,
  PORT_DESSIN,
  VARIANTES_MAISON,
  peindreChamp,
  peindreChantier,
  peindreEglise,
  peindreFerme,
  peindreMaison,
  peindreNavire,
  peindrePort,
} from "../src/game/dessin/batiments";
import {
  MATIERES_MUR,
  MUR,
  PORTE,
  TOUR,
  masqueDe,
  peindreMur,
  peindreMurRuine,
  peindrePorte,
  peindreTour,
  sensDePorte,
} from "../src/game/dessin/murs";
import { Toile } from "../src/game/dessin/pinceau";
import { avancementDe, type Modele } from "../src/game/dessin/four";
import { BETES, GESTES_MONSTRE, bete, mort } from "../src/game/dessin/monstres";
import { villageois, type MetierDessine } from "../src/game/dessin/villageois";
import { hero } from "../src/game/dessin/heros";
import { ORDRE_CLASSES } from "../src/core/classes";

/**
 * La planche de controle, **hors navigateur**.
 *
 *     npx tsx scripts/planche.ts [dossier]
 *
 * Elle ecrit des PNG a partir des memes fonctions de dessin que le jeu, sans
 * Phaser : la carte, le decor, les batiments, les personnages. C'est la facon la
 * plus rapide de juger un dessin a l'image — et un dessin ne se juge qu'a
 * l'image (§4.30).
 */

// Par defaut dans `captures/planches/<date du jour>/` : une seance, un dossier
// (voir `captures/README.md`).
const dossier = resolve(
  process.argv[2] ?? `captures/planches/${new Date().toISOString().slice(0, 10)}`,
);
mkdirSync(dossier, { recursive: true });

// ------------------------------------------------------------------ outils

function ecrire(nom: string, image: Image): void {
  const chemin = resolve(dossier, `${nom}.png`);
  writeFileSync(chemin, ecrirePng(image));
  console.log(`[planche] ${chemin}`);
}

/** Pose une toile sur une image, agrandie d'un facteur entier. */
function coller(image: Image, toile: Toile, x: number, y: number, echelle = 1): void {
  const pixels = toile.donnees();
  for (let ty = 0; ty < toile.hauteur; ty += 1) {
    for (let tx = 0; tx < toile.largeur; tx += 1) {
      const i = (ty * toile.largeur + tx) * 4;
      const a = pixels[i + 3]!;
      if (a === 0) continue;
      for (let ey = 0; ey < echelle; ey += 1) {
        for (let ex = 0; ex < echelle; ex += 1) {
          const px = x + tx * echelle + ex;
          const py = y + ty * echelle + ey;
          if (a === 255) {
            poser(image, px, py, [pixels[i]!, pixels[i + 1]!, pixels[i + 2]!, 255]);
          } else {
            // Une ombre : on melange avec ce qu'il y a dessous.
            const j = (py * image.largeur + px) * 4;
            if (px < 0 || py < 0 || px >= image.largeur || py >= image.hauteur) continue;
            const part = a / 255;
            for (let c = 0; c < 3; c += 1) {
              image.pixels[j + c] = Math.round(
                image.pixels[j + c]! * (1 - part) + pixels[i + c]! * part,
              );
            }
          }
        }
      }
    }
  }
}

/** Un morceau de la carte peinte, a l'echelle. */
function fondDeCarte(x0: number, y0: number, largeur: number, hauteur: number, echelle = 1): Image {
  const image = imageVide(largeur * echelle, hauteur * echelle);
  for (let y = 0; y < hauteur; y += 1) {
    for (let x = 0; x < largeur; x += 1) {
      const i = ((y0 + y) * carte.largeur + x0 + x) * 4;
      const c: [number, number, number, number] = [
        carte.pixels[i]!,
        carte.pixels[i + 1]!,
        carte.pixels[i + 2]!,
        255,
      ];
      for (let ey = 0; ey < echelle; ey += 1) {
        for (let ex = 0; ex < echelle; ex += 1) poser(image, x * echelle + ex, y * echelle + ey, c);
      }
    }
  }
  return image;
}

// ------------------------------------------------------------------ la carte

const debut = performance.now();
const carte = peindreLaCarte();
console.log(`[planche] carte peinte en ${Math.round(performance.now() - debut)} ms`);

ecrire("planche-carte", fondDeCarte(150, 700, 1280, 800));
ecrire("planche-carte-zoom", fondDeCarte(300, 950, 640, 400, 2));

// ------------------------------------------------------------------ le decor

{
  const image = fondDeCarte(600, 1100, 640, 260, 2);
  let x = 20;
  for (const decor of DECORS) {
    const toile = peindreDecor(decor.cle);
    const bord = toile.pixelsDuBord();
    if (bord > 0) console.log(`[planche] ${decor.cle} touche le bord : ${bord} px`);
    coller(image, toile, x, 40, 2);
    coller(image, toile, x, 40 + decor.hauteur * 2 + 30, 1);
    x += decor.largeur * 2 + 12;
  }
  ecrire("planche-decor", image);
}

// -------------------------------------------------------------- les batiments

/** Dessine dans une toile neuve, cerne, et rend la toile. */
function toile(
  largeur: number,
  hauteur: number,
  tracer: (t: Toile) => void,
  cerner = true,
  avertir = true,
): Toile {
  const t = new Toile(largeur, hauteur);
  tracer(t);
  if (cerner) t.contour();
  const bord = t.pixelsDuBord();
  if (bord > 0 && avertir) console.log(`[planche] une toile ${largeur}x${hauteur} touche le bord : ${bord} px`);
  return t;
}

/**
 * Le plan de demonstration des murs : une enceinte avec ses tours et ses
 * portes, une ruine, un T, une croix, un escalier, une borne. `#` mur, `T` tour,
 * `P` porte, `r` ruine. Chaque case lit ses voisines, exactement comme en jeu.
 */
const PLAN_MURS = [
  "T####P####T....#.....",
  "#.........#....#.....",
  "#....T....#..#####...",
  "#.........#....#.....",
  "P.........#....#.....",
  "#....##...#..........",
  "#....#..r.#....#..##.",
  "T####P####T....#...##",
  ".....................",
  "..#...###...#........",
  "......#.#...#.#......",
  "......###...#.#......",
];

for (const matiere of MATIERES_MUR) {
  // Les murs : chaque case du plan, dessinee du nord au sud pour que la
  // profondeur raccorde, a l'echelle 2 — celle du jeu au zoom de depart.
  const echelle = 2;
  const colonnes = PLAN_MURS[0]!.length;
  const lignes = PLAN_MURS.length;
  const image = fondDeCarte(500, 1000, colonnes * 32, lignes * 32 + 40, echelle);
  const bati = (l: number, c: number) => {
    const ch = PLAN_MURS[l]?.[c];
    return ch === "#" || ch === "T" || ch === "P";
  };
  for (let l = 0; l < lignes; l += 1) {
    for (let c = 0; c < colonnes; c += 1) {
      const ch = PLAN_MURS[l]![c]!;
      if (ch === ".") continue;
      const masque = masqueDe(bati(l - 1, c), bati(l, c + 1), bati(l + 1, c), bati(l, c - 1));
      let t: Toile;
      // Un mur va jusqu'au bord de sa case par construction : pas d'alerte.
      if (ch === "T") t = toile(TOUR.largeur, TOUR.hauteur, (x) => peindreTour(x), true, false);
      else if (ch === "P") {
        t = toile(
          PORTE.largeur,
          PORTE.hauteur,
          (x) => peindrePorte(x, matiere, sensDePorte(masque), (l + c) % 2 === 0),
          true,
          false,
        );
      } else if (ch === "r") t = toile(MUR.largeur, MUR.hauteur, (x) => peindreMurRuine(x, 0));
      else t = toile(MUR.largeur, MUR.hauteur, (x) => peindreMur(x, matiere, masque), true, false);
      // Le pied de la texture est deux pixels sous le bord sud de la case.
      coller(image, t, c * 32 * echelle, (l * 32 + 32 + 2 + 20 - t.hauteur) * echelle, echelle);
    }
  }
  // Un villageois devant la porte du bas, pour l'echelle.
  const v = frame(villageois("mineur", { usure: 0, sang: 0 }), "marche", 1);
  coller(image, v, (5 * 32 + 6) * echelle, (7 * 32 + 20 + 12) * echelle, echelle);
  ecrire(`planche-murs-${matiere}`, image);
}

{
  // Les batiments : maisons, ferme, eglise aux quatre niveaux, tour, chantiers,
  // champs, port et navire.
  const image = fondDeCarte(500, 1000, 640, 320, 2);
  let x = 16;
  const rangee = (t: Toile, echelle = 2) => {
    coller(image, t, x, 40, echelle);
    x += t.largeur * echelle + 14;
  };
  for (let v = 0; v < VARIANTES_MAISON; v += 1) {
    rangee(toile(MAISON.largeur, MAISON.hauteur, (t) => peindreMaison(t, v)));
  }
  rangee(toile(FERME.largeur, FERME.hauteur, (t) => peindreFerme(t)));
  for (let n = 1; n <= 4; n += 1) {
    rangee(toile(EGLISE.largeur, EGLISE.hauteur, (t) => peindreEglise(t, n)));
  }
  rangee(toile(TOUR.largeur, TOUR.hauteur, (t) => peindreTour(t), true, false));

  x = 16;
  const bas = (t: Toile, echelle = 2) => {
    coller(image, t, x, 190, echelle);
    x += t.largeur * echelle + 14;
  };
  for (const c of Object.values(CHANTIERS)) {
    bas(toile(c.largeur, c.hauteur, (t) => peindreChantier(t, c.largeur, c.hauteur)));
  }
  bas(toile(32, 32, (t) => peindreChamp(t, "jeune"), false));
  bas(toile(32, 32, (t) => peindreChamp(t, "mur"), false));
  bas(toile(PORT_DESSIN.largeur, PORT_DESSIN.hauteur, (t) => peindrePort(t, "ruine")));
  bas(toile(PORT_DESSIN.largeur, PORT_DESSIN.hauteur, (t) => peindrePort(t, "debout")));
  bas(toile(NAVIRE.largeur, NAVIRE.hauteur, (t) => peindreNavire(t)));
  ecrire("planche-batiments", image);
}

// ------------------------------------------------------------ les personnages

/** Une frame d'un modele, dessinee et cernee comme le four le ferait. */
function frame(modele: Modele, cle: string, index: number): Toile {
  const geste = modele.gestes.find((g) => g.cle === cle) ?? modele.gestes[0]!;
  const t = new Toile(modele.taille, modele.taille);
  modele.dessiner(t, geste.cle, avancementDe(geste, Math.min(index, geste.frames - 1)));
  t.contour();
  const bord = t.pixelsDuBord();
  if (bord > 0) console.log(`[planche] ${modele.famille} ${cle} ${index} touche le bord : ${bord} px`);
  return t;
}

{
  // Les monstres : chaque bete, chaque geste, a l'echelle 2, plus la ligne a
  // l'echelle 1 pour juger la lisibilite en jeu.
  const modeles = [
    ...(Object.keys(BETES) as (keyof typeof BETES)[]).map((id) => bete(id)),
    mort("revenant"),
    mort("mort-vivant"),
  ];
  const image = fondDeCarte(520, 1000, 640, 60 + modeles.length * 52, 2);
  modeles.forEach((modele, ligne) => {
    let x = 16;
    const y = 16 + ligne * 104;
    for (const geste of GESTES_MONSTRE) {
      const index = geste.cle === "charge" || geste.cle === "mort" ? geste.frames - 1 : geste.cle === "attaque" ? 3 : 1;
      coller(image, frame(modele, geste.cle, index), x, y + (96 - modele.taille * 2), 2);
      x += modele.taille * 2 + 10;
    }
    // A l'echelle 1 : repos et marche.
    coller(image, frame(modele, "repos", 0), x + 20, y + 96 - modele.taille, 1);
    coller(image, frame(modele, "marche", 2), x + 20 + modele.taille + 6, y + 96 - modele.taille, 1);
  });
  ecrire("planche-monstres", image);
}

{
  // Les villageois par metier, au travail, et les heros a cote pour l'echelle.
  const metiers: MetierDessine[] = ["pecheur", "fermier", "bucheron", "mineur", "forgeron", "charpentier", "guetteur", "survivant"];
  const image = fondDeCarte(520, 1000, 640, 260, 2);
  metiers.forEach((metier, i) => {
    const x = 16 + i * 78;
    const neuf = villageois(metier, { usure: 0, sang: 0 });
    coller(image, frame(neuf, "travail", 5), x, 20, 2);
    coller(image, frame(neuf, "marche", 1), x, 96, 1);
    const use = villageois(metier, { usure: 1, sang: 1 });
    coller(image, frame(use, "repos", 0), x + 36, 96, 1);
  });
  ORDRE_CLASSES.forEach((classe, i) => {
    const modele = hero(classe, 0);
    coller(image, frame(modele, "repos", 0), 16 + i * 78, 150, 2);
    coller(image, frame(modele, "attaque", 3), 16 + i * 78 + 36, 214, 1);
  });
  ecrire("planche-personnages", image);
}

{
  // L'echelle : une maison, l'eglise, et les gens a cote, agrandis quatre fois.
  // C'est la planche qui repond a « les personnages sont trop grands par
  // rapport aux maisons » — on ne juge une proportion qu'en les posant l'un
  // contre l'autre, sur le meme sol.
  const echelle = 4;
  const image = fondDeCarte(500, 1000, 200, 70, echelle);
  const solY = 62;
  const auSol = (t: Toile, x: number, pied: number) =>
    coller(image, t, x * echelle, (solY - pied) * echelle, echelle);
  auSol(toile(MAISON.largeur, MAISON.hauteur, (t) => peindreMaison(t, 0)), 4, MAISON.hauteur - 2);
  auSol(toile(EGLISE.largeur, EGLISE.hauteur, (t) => peindreEglise(t, 1)), 52, EGLISE.hauteur - 2);
  const gens: Modele[] = [
    villageois("mineur", { usure: 0, sang: 0 }),
    villageois("fermier", { usure: 1, sang: 0 }),
    hero("guerrier", 2),
    hero("mage", 4),
    bete("fonceur"),
    bete("brute"),
  ];
  let x = 122;
  for (const modele of gens) {
    const t = frame(modele, modele.famille.startsWith("monstre") ? "marche" : "travail", 2);
    // Le sol d'un personnage est a trois pixels du bas de son cadre.
    auSol(t, x, modele.taille - 3);
    x += modele.taille - 4;
  }
  ecrire("planche-echelle", image);
}
