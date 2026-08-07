import Phaser from "phaser";
import { CLASSES, ORDRE_CLASSES } from "../core/classes";
import { ligneDEau, MONDE, terrainEn, VILLAGE, type Terrain } from "../core/carte";

/**
 * Textures placeholder generees par code.
 *
 * TOUTES sont faites pour etre remplacees par tes propres dessins : le jour ou
 * tu as un PNG, il suffit de le charger sous la meme cle dans preload() et de
 * supprimer l'appel correspondant ici. Aucun autre fichier ne bouge.
 *
 * Contrainte a respecter en dessinant (DESIGN.md §4.11, zoom libre) : le sprite
 * doit rester reconnaissable tout petit. C'est la silhouette et la couleur
 * dominante qui portent la lisibilite, pas le detail.
 */

export const TAILLE_HERO = { largeur: 12, hauteur: 18 };
export const TAILLE_ENNEMI = { largeur: 12, hauteur: 16 };

export function creerTexturesPlaceholder(scene: Phaser.Scene): void {
  creerCarte(scene);
  creerArbre(scene);
  creerRocher(scene);
  creerMaison(scene);
  creerMur(scene);
  creerEnnemi(scene);
  creerMortVivant(scene);
  creerFamiliers(scene);
  creerProjectile(scene);
  creerImpact(scene);
  creerIconesUltimes(scene);
  creerIconesCapacites(scene);
  for (const id of ORDRE_CLASSES) {
    const classe = CLASSES[id];
    creerHero(scene, `hero-${id}`, classe.couleur, classe.accent);
  }
}

/**
 * Une icone par effet d'ultime. Dessinees en blanc : le panneau les teinte
 * ensuite a la couleur de la classe, et les grise pendant le rechargement.
 */
function creerIconesUltimes(scene: Phaser.Scene): void {
  const T = 32;
  const centre = T / 2;

  // Tourbillon : quatre lames tournant autour d'un moyeu.
  let g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.fillStyle(0xffffff, 1);
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2 + Math.PI / 8;
    g.fillTriangle(
      centre + Math.cos(a) * 4,
      centre + Math.sin(a) * 4,
      centre + Math.cos(a + 0.9) * 14,
      centre + Math.sin(a + 0.9) * 14,
      centre + Math.cos(a + 0.2) * 15,
      centre + Math.sin(a + 0.2) * 15,
    );
  }
  g.fillCircle(centre, centre, 3);
  g.generateTexture("ultime-tourbillon", T, T);
  g.destroy();

  // Rempart : un bouclier.
  g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.fillStyle(0xffffff, 1);
  g.fillPoints(
    [
      new Phaser.Geom.Point(16, 3),
      new Phaser.Geom.Point(28, 8),
      new Phaser.Geom.Point(27, 19),
      new Phaser.Geom.Point(16, 29),
      new Phaser.Geom.Point(5, 19),
      new Phaser.Geom.Point(4, 8),
    ],
    true,
  );
  g.fillStyle(0x000000, 1);
  g.fillRect(15, 9, 2, 13);
  g.fillRect(10, 14, 12, 2);
  g.generateTexture("ultime-rempart", T, T);
  g.destroy();

  // Meteore : une boule et sa trainee.
  g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.fillStyle(0xffffff, 1);
  g.fillCircle(20, 12, 8);
  g.fillTriangle(4, 28, 13, 19, 16, 24);
  g.fillTriangle(9, 29, 16, 22, 20, 26);
  g.generateTexture("ultime-meteore", T, T);
  g.destroy();

  // Ombre : une dague.
  g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.fillStyle(0xffffff, 1);
  g.fillPoints(
    [
      new Phaser.Geom.Point(16, 2),
      new Phaser.Geom.Point(20, 8),
      new Phaser.Geom.Point(19, 20),
      new Phaser.Geom.Point(13, 20),
      new Phaser.Geom.Point(12, 8),
    ],
    true,
  );
  g.fillRect(8, 20, 16, 3);
  g.fillRect(14, 23, 4, 7);
  g.generateTexture("ultime-ombre", T, T);
  g.destroy();

  // Pluie de fleches : trois traits qui tombent.
  g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.fillStyle(0xffffff, 1);
  for (const x of [6, 15, 24]) {
    g.fillRect(x, 4, 2, 18);
    g.fillTriangle(x - 3, 20, x + 5, 20, x + 1, 29);
  }
  g.generateTexture("ultime-pluie-de-fleches", T, T);
  g.destroy();

  // Aube : un soleil levant.
  g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.fillStyle(0xffffff, 1);
  g.fillCircle(16, 20, 9);
  g.fillRect(2, 22, 28, 3);
  for (let i = 0; i < 5; i++) {
    const a = Math.PI + (i / 4) * Math.PI;
    g.fillCircle(16 + Math.cos(a) * 14, 20 + Math.sin(a) * 14, 2);
  }
  g.generateTexture("ultime-aube", T, T);
  g.destroy();

  // Levee des morts : une main qui sort de terre.
  g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.fillStyle(0xffffff, 1);
  g.fillRect(2, 24, 28, 3);
  g.fillRect(13, 12, 6, 13);
  for (const x of [9, 13, 17, 21]) g.fillRect(x, 6, 2, 9);
  g.generateTexture("ultime-levee-des-morts", T, T);
  g.destroy();
}


/** Icones des competences actives, meme convention que les ultimes. */
function creerIconesCapacites(scene: Phaser.Scene): void {
  const T = 32;
  const dessiner = (cle: string, trace: (g: Phaser.GameObjects.Graphics) => void) => {
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0xffffff, 1);
    trace(g);
    g.generateTexture(cle, T, T);
    g.destroy();
  };

  // Sursaut sacre : une croix rayonnante.
  dessiner("cap-sursaut", (g) => {
    g.fillRect(14, 4, 4, 24);
    g.fillRect(6, 12, 20, 4);
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2 + Math.PI / 4;
      g.fillCircle(16 + Math.cos(a) * 12, 16 + Math.sin(a) * 12, 2);
    }
  });

  // Benediction : un dome et ses gouttes.
  dessiner("cap-benediction", (g) => {
    g.fillCircle(16, 20, 11);
    g.fillStyle(0x000000, 1);
    g.fillCircle(16, 20, 7);
    g.fillStyle(0xffffff, 1);
    g.fillRect(4, 21, 24, 3);
    g.fillCircle(9, 8, 2);
    g.fillCircle(16, 5, 2);
    g.fillCircle(23, 8, 2);
  });

  // Moulinet : une fleche circulaire.
  dessiner("cap-moulinet", (g) => {
    g.fillCircle(16, 16, 12);
    g.fillStyle(0x000000, 1);
    g.fillCircle(16, 16, 7);
    g.fillRect(16, 2, 14, 14);
    g.fillStyle(0xffffff, 1);
    g.fillTriangle(18, 2, 28, 6, 18, 11);
  });

  // Dome : une demi-sphere posee au sol.
  dessiner("cap-dome", (g) => {
    g.fillCircle(16, 20, 12);
    g.fillStyle(0x000000, 1);
    g.fillCircle(16, 20, 8);
    g.fillRect(0, 21, 32, 11);
    g.fillStyle(0xffffff, 1);
    g.fillRect(3, 21, 26, 3);
  });

  // Exil : un portail concentrique.
  dessiner("cap-exil", (g) => {
    g.fillCircle(16, 16, 13);
    g.fillStyle(0x000000, 1);
    g.fillCircle(16, 16, 10);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(16, 16, 6);
    g.fillStyle(0x000000, 1);
    g.fillCircle(16, 16, 3);
  });

  // Invisibilite : un oeil barre.
  dessiner("cap-invisibilite", (g) => {
    g.fillEllipse(16, 16, 26, 14);
    g.fillStyle(0x000000, 1);
    g.fillEllipse(16, 16, 18, 8);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(16, 16, 3);
    g.fillStyle(0x000000, 1);
    for (let i = 0; i < 26; i++) g.fillRect(3 + i, 27 - i, 3, 3);
  });

  // Hecatombe : deux dagues croisees.
  dessiner("cap-hecatombe", (g) => {
    for (let i = 0; i < 24; i++) {
      g.fillRect(4 + i, 4 + i, 3, 3);
      g.fillRect(27 - i, 4 + i, 3, 3);
    }
    g.fillRect(8, 22, 6, 3);
    g.fillRect(18, 22, 6, 3);
  });

  // Orage final : un nuage et sa foudre.
  dessiner("cap-orage", (g) => {
    g.fillEllipse(16, 10, 26, 12);
    g.fillTriangle(18, 15, 12, 24, 17, 24);
    g.fillTriangle(15, 22, 20, 22, 12, 30);
  });

  // Heure sombre : un sablier arrete.
  dessiner("cap-heure-sombre", (g) => {
    g.fillRect(7, 3, 18, 3);
    g.fillRect(7, 26, 18, 3);
    g.fillTriangle(8, 6, 24, 6, 16, 16);
    g.fillTriangle(8, 26, 24, 26, 16, 16);
  });

  // Martyre : un coeur transperce.
  dessiner("cap-martyre", (g) => {
    g.fillCircle(11, 12, 6);
    g.fillCircle(21, 12, 6);
    g.fillTriangle(5, 14, 27, 14, 16, 28);
    g.fillStyle(0x000000, 1);
    for (let i = 0; i < 26; i++) g.fillRect(3 + i, 27 - i, 2, 2);
  });

  // Piege : des machoires dentees.
  dessiner("cap-piege", (g) => {
    g.fillRect(4, 14, 24, 4);
    for (let i = 0; i < 6; i++) {
      g.fillTriangle(5 + i * 4, 14, 9 + i * 4, 14, 7 + i * 4, 7);
      g.fillTriangle(5 + i * 4, 18, 9 + i * 4, 18, 7 + i * 4, 25);
    }
  });

  // Fleche du jugement : une fleche verticale rayonnante.
  dessiner("cap-fleche-jugement", (g) => {
    g.fillRect(14, 6, 4, 22);
    g.fillTriangle(8, 10, 24, 10, 16, 1);
    g.fillRect(6, 26, 20, 2);
  });

  // Priere : deux mains jointes, stylisees.
  dessiner("cap-priere", (g) => {
    g.fillTriangle(16, 2, 9, 20, 16, 20);
    g.fillTriangle(16, 2, 23, 20, 16, 20);
    g.fillRect(8, 21, 16, 3);
    g.fillStyle(0x000000, 1);
    g.fillRect(15, 4, 2, 16);
  });

  // Chant de guerre : des ondes qui partent d'un point.
  dessiner("cap-chant", (g) => {
    g.fillCircle(8, 16, 4);
    for (let r = 9; r <= 21; r += 6) {
      g.lineStyle(3, 0xffffff, 1);
      g.beginPath();
      g.arc(8, 16, r, -0.9, 0.9, false);
      g.strokePath();
    }
  });

  // L'Appel : un crane couronne.
  dessiner("cap-appel", (g) => {
    g.fillCircle(16, 16, 10);
    g.fillRect(11, 22, 10, 5);
    g.fillStyle(0x000000, 1);
    g.fillCircle(12, 15, 3);
    g.fillCircle(20, 15, 3);
    g.fillRect(14, 22, 2, 5);
    g.fillRect(18, 22, 2, 5);
    g.fillStyle(0xffffff, 1);
    g.fillTriangle(6, 6, 10, 6, 8, 1);
    g.fillTriangle(14, 5, 18, 5, 16, 0);
    g.fillTriangle(22, 6, 26, 6, 24, 1);
  });

  // Jugement : une epee plantee dans un rai de lumiere.
  dessiner("cap-jugement", (g) => {
    g.fillRect(14, 2, 4, 20);
    g.fillRect(9, 8, 14, 3);
    g.fillTriangle(13, 22, 19, 22, 16, 30);
    g.fillRect(4, 26, 24, 2);
  });

  // Bouclier des ames : un bouclier avec un coeur.
  dessiner("cap-bouclier-ames", (g) => {
    g.fillPoints(
      [
        new Phaser.Geom.Point(16, 2),
        new Phaser.Geom.Point(28, 8),
        new Phaser.Geom.Point(16, 30),
        new Phaser.Geom.Point(4, 8),
      ],
      true,
    );
    g.fillStyle(0x000000, 1);
    g.fillCircle(13, 13, 4);
    g.fillCircle(19, 13, 4);
    g.fillTriangle(8, 15, 24, 15, 16, 25);
  });

  // Charge : un chevron lance vers l'avant.
  dessiner("cap-charge", (g) => {
    for (let i = 0; i < 3; i++) {
      g.fillTriangle(4 + i * 8, 6, 12 + i * 8, 16, 4 + i * 8, 26);
    }
  });

  // Cri de guerre : une bouche ouverte et des ondes.
  dessiner("cap-cri", (g) => {
    g.fillTriangle(2, 8, 2, 24, 14, 16);
    for (let r = 8; r <= 18; r += 5) {
      g.lineStyle(3, 0xffffff, 1);
      g.beginPath();
      g.arc(14, 16, r, -1, 1, false);
      g.strokePath();
    }
  });

  // Clignement : deux silhouettes, l'une qui s'efface.
  dessiner("cap-clignement", (g) => {
    g.fillRect(4, 8, 6, 16);
    g.fillStyle(0xffffff, 0.35);
    g.fillRect(22, 8, 6, 16);
    g.fillStyle(0xffffff, 1);
    for (let i = 0; i < 4; i++) g.fillRect(12 + i * 3, 15, 2, 2);
  });

  // Sablier : le meme que l'Heure sombre, mais couche.
  dessiner("cap-sablier", (g) => {
    g.fillRect(4, 6, 3, 20);
    g.fillRect(25, 6, 3, 20);
    g.fillTriangle(7, 7, 7, 25, 16, 16);
    g.fillTriangle(25, 7, 25, 25, 16, 16);
  });

  // Croc-en-jambe : des lames plantees au sol.
  dessiner("cap-croc", (g) => {
    g.fillRect(2, 24, 28, 3);
    for (const [x, h] of [
      [6, 12],
      [13, 18],
      [20, 14],
      [26, 10],
    ] as [number, number][]) {
      g.fillTriangle(x - 2, 24, x + 2, 24, x, 24 - h);
    }
  });

  // Doppelganger : deux silhouettes jumelles.
  dessiner("cap-doppelganger", (g) => {
    g.fillRect(5, 10, 8, 18);
    g.fillCircle(9, 8, 5);
    g.fillStyle(0xffffff, 0.4);
    g.fillRect(19, 10, 8, 18);
    g.fillCircle(23, 8, 5);
  });

  // Contrat : un parchemin marque d'une croix.
  dessiner("cap-contrat", (g) => {
    g.fillRect(6, 3, 20, 26);
    g.fillStyle(0x000000, 1);
    g.fillRect(9, 8, 14, 2);
    g.fillRect(9, 13, 14, 2);
    for (let i = 0; i < 12; i++) {
      g.fillRect(10 + i, 17 + i, 2, 2);
      g.fillRect(21 - i, 17 + i, 2, 2);
    }
  });

  // Generique : une etoile, pour toute capacite sans icone dediee.
  dessiner("cap-generique", (g) => {
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2;
      g.fillTriangle(16, 16, 16 + Math.cos(a) * 14, 16 + Math.sin(a) * 14, 16 + Math.cos(a + 0.5) * 8, 16 + Math.sin(a + 0.5) * 8);
    }
    g.fillCircle(16, 16, 4);
  });
}

/** Cote d'une tuile de terrain, en pixels. C'est la maille du pixel-art. */
const TUILE = 8;

/**
 * Les teintes de chaque nature de sol.
 *
 * Trois variantes par terrain : c'est ce qui donne le grain de WorldBox, ou
 * l'herbe n'est jamais d'un seul vert. La palette est chaude et saturee
 * malgre le contexte post-apo (DESIGN.md §4.11).
 */
const TEINTES: Record<Terrain, number[]> = {
  abysse: [0x14395f, 0x173e66, 0x113456],
  mer: [0x1f5789, 0x235e92, 0x1b5081],
  "haut-fond": [0x3f8fc0, 0x459ac9, 0x3886b7],
  sable: [0xe4d3a4, 0xdcc998, 0xebdcb1],
  // L'ecart entre les verts reste serre : trop de contraste et la prairie se
  // lit comme un damier de bruit au lieu d'un sol.
  herbe: [0x4f8330, 0x538734, 0x4a7d2e, 0x578c37],
  "sous-bois": [0x2f5522, 0x355e26, 0x28491d],
  // L'eboulis est franchement plus clair que la roche : c'est ce contraste qui
  // rend visible le pied de montagne qui serpente. Trop proches, les deux gris
  // se lisaient comme une seule bande droite.
  eboulis: [0x8b857a, 0x958f83, 0x817b71],
  roche: [0x565450, 0x5e5b56, 0x4d4b47],
};

/**
 * Bruit entier deterministe, entre 0 et 1.
 *
 * Il sert a varier chaque tuile sans stocker un tableau de 30 000 cases, et
 * surtout sans aleatoire : la carte doit etre identique a chaque partie pour
 * qu'on puisse apprendre son terrain.
 */
function grain(x: number, y: number, sel = 0): number {
  let h = (x * 374761393 + y * 668265263 + sel * 1442695040) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * La carte entiere, cuite une fois dans une seule texture (DESIGN.md §4.6).
 *
 * Trente mille tuiles en trente mille objets Phaser, c'est le jeu par terre
 * (§4.17, regle 1). Une seule image de 1600x1200 dessinee au demarrage ne
 * coute rien ensuite : zero objet, zero calcul par image.
 *
 * Le rendu suit trois regles tirees de WorldBox :
 *
 * 1. **Le littoral serpente** — il est decoupe a la tuile, jamais a la regle.
 * 2. **La mer s'etage** : abysse, mer, haut-fond. C'est ce degrade qui donne
 *    la sensation de vagues, bien mieux qu'une bande d'ecume plaquee dessus.
 * 3. **Chaque terrain a plusieurs teintes**, pour qu'aucune zone ne soit un
 *    aplat.
 */
function creerCarte(scene: Phaser.Scene): void {
  // Recommencer une partie relance create() : sans ce garde, on refabriquerait
  // une carte de deux millions de pixels a chaque fois.
  if (scene.textures.exists("carte")) return;

  const texture = scene.textures.createCanvas("carte", MONDE.largeur, MONDE.hauteur);
  const ctx = texture?.getContext();
  if (!texture || !ctx) return;

  for (let py = 0; py < MONDE.hauteur; py += TUILE) {
    for (let px = 0; px < MONDE.largeur; px += TUILE) {
      // Le centre de la tuile decide de sa nature : c'est ce qui produit
      // l'escalier de pixels au lieu d'une diagonale lissee.
      const sol = terrainEn(px + TUILE / 2, py + TUILE / 2);
      const teintes = TEINTES[sol];
      const teinte = teintes[Math.floor(grain(px, py) * teintes.length)]!;
      ctx.fillStyle = hex(teinte);
      ctx.fillRect(px, py, TUILE, TUILE);

      peindreDetail(ctx, px, py, sol);
    }
  }

  peindreEcume(ctx);
  peindreVillage(ctx);
  texture.refresh();
}

/**
 * Le sol du village : de la terre battue, avec une place plus claire au centre.
 *
 * Cuit dans la meme texture que le terrain — c'est un sol, pas un objet, et il
 * ne bougera jamais.
 */
function peindreVillage(ctx: CanvasRenderingContext2D): void {
  const terres = [0x8b7b60, 0x94856c, 0x7f7057, 0x9c8d73];
  const debutX = Math.floor((VILLAGE.x - VILLAGE.rayon) / TUILE) * TUILE;
  const debutY = Math.floor((VILLAGE.y - VILLAGE.rayon) / TUILE) * TUILE;

  for (let py = debutY; py < VILLAGE.y + VILLAGE.rayon; py += TUILE) {
    for (let px = debutX; px < VILLAGE.x + VILLAGE.rayon; px += TUILE) {
      const d = Math.hypot(px + TUILE / 2 - VILLAGE.x, py + TUILE / 2 - VILLAGE.y);
      if (d > VILLAGE.rayon) continue;

      const de = grain(px, py, 13);
      // Le bord s'effrite : quelques tuiles manquantes evitent le disque parfait.
      if (d > VILLAGE.rayon - TUILE * 1.5 && de > 0.55) continue;

      ctx.fillStyle = hex(terres[Math.floor(de * terres.length)]!);
      ctx.fillRect(px, py, TUILE, TUILE);
      if (de > 0.88) {
        ctx.fillStyle = "#6f6350";
        ctx.fillRect(px + 2, py + 3, 3, 2);
      }
    }
  }
}

/**
 * Les maisons du village, facon WorldBox : un toit tres colore et tres net, un
 * mur de terre, une porte sombre. Ce sont le toit et sa couleur qui rendent une
 * maison reconnaissable de loin — pas le detail des murs (DESIGN.md §4.11).
 */
function creerMaison(scene: Phaser.Scene): void {
  const toits: [string, number, number][] = [
    ["maison-bleue", 0x6f8fb5, 0x8fadd0],
    ["maison-rouge", 0xa8412f, 0xc85f45],
    ["maison-jaune", 0xc79a3a, 0xe0b855],
  ];

  for (const [cle, toit, toitClair] of toits) {
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0x000000, 0.24);
    g.fillEllipse(11, 25, 20, 5);

    // Le mur, en torchis.
    g.fillStyle(0xb5713f, 1);
    g.fillRect(3, 13, 16, 11);
    g.fillStyle(0x8f5730, 1);
    g.fillRect(3, 22, 16, 2);

    // Le toit : deux pentes, la face au soleil plus claire.
    g.fillStyle(toit, 1);
    g.fillTriangle(11, 1, 1, 15, 21, 15);
    g.fillStyle(toitClair, 1);
    g.fillTriangle(11, 1, 1, 15, 11, 15);
    // Les tuiles, suggerees par deux entailles.
    g.fillStyle(0x000000, 0.16);
    g.fillRect(4, 11, 14, 1);
    g.fillRect(6, 7, 10, 1);

    g.fillStyle(0x3a2a1c, 1); // la porte
    g.fillRect(9, 17, 5, 7);
    g.generateTexture(cle, 22, 28);
    g.destroy();
  }
}

/**
 * Le grain d'une tuile : brins d'herbe, fleurs, cailloux, cretes de roche.
 * C'est ce qui empeche le sol d'etre un damier, meme en le regardant de pres.
 */
function peindreDetail(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  sol: Terrain,
): void {
  const de = grain(px, py, 7);
  if (sol === "herbe") {
    if (de > 0.9) {
      // Une fleur : rare, coloree, c'est elle qui rechauffe la prairie.
      ctx.fillStyle = de > 0.97 ? "#e8d05a" : "#d9698a";
      ctx.fillRect(px + 3, py + 3, 2, 2);
    } else if (de > 0.72) {
      ctx.fillStyle = "#6aa63f";
      ctx.fillRect(px + 2, py + 4, 3, 2);
    }
    return;
  }
  if (sol === "sable" && de > 0.85) {
    ctx.fillStyle = "#c9b585";
    ctx.fillRect(px + 2, py + 3, 3, 2);
    return;
  }
  if (sol === "sous-bois" && de > 0.78) {
    ctx.fillStyle = "#213d19";
    ctx.fillRect(px + 1, py + 2, 4, 4);
    return;
  }
  if ((sol === "roche" || sol === "eboulis") && de > 0.7) {
    // Une arete claire au nord du bloc, son ombre au sud : la roche prend du
    // relief sans qu'on dessine un seul rocher.
    ctx.fillStyle = de > 0.88 ? "#8f8b81" : "#4b4944";
    ctx.fillRect(px, py + (de > 0.88 ? 0 : TUILE - 2), TUILE, 2);
    return;
  }
  if ((sol === "mer" || sol === "abysse") && de > 0.93) {
    // Un reflet, tres rare : la mer respire sans clignoter.
    ctx.fillStyle = sol === "mer" ? "#3d7fae" : "#1d4b78";
    ctx.fillRect(px + 1, py + 3, 5, 2);
  }
}

/**
 * L'ecume, la ou le haut-fond touche le sable.
 *
 * Elle ne se pose **qu'une tuile sur deux environ**, et c'est tout le secret :
 * une ligne continue se lit comme une echelle posee sur la carte, une ligne
 * trouee se lit comme de la mousse. La precedente version en barreaux reguliers
 * etait exactement l'erreur a ne pas faire.
 */
function peindreEcume(ctx: CanvasRenderingContext2D): void {
  for (let py = 0; py < MONDE.hauteur; py += TUILE) {
    const y = py + TUILE / 2;
    // On cale l'ecume sur la grille : elle doit epouser l'escalier du rivage.
    const bord = Math.floor(ligneDEau(y) / TUILE) * TUILE;
    for (let i = -2; i <= 0; i++) {
      const px = bord + i * TUILE;
      if (px < 0 || terrainEn(px + TUILE / 2, y) !== "haut-fond") continue;
      const de = grain(px, py, 31);
      if (de < 0.42) continue;
      ctx.fillStyle = i === 0 ? "rgba(233,246,250,0.92)" : "rgba(196,231,242,0.55)";
      ctx.fillRect(px, py, TUILE, TUILE);
    }
  }
}

function hex(couleur: number): string {
  return `#${couleur.toString(16).padStart(6, "0")}`;
}

/** Une boule de feuillage : centre et rayon, en pixels. */
interface Houppier {
  x: number;
  y: number;
  r: number;
}

/**
 * Les silhouettes d'arbres.
 *
 * La recette vient de l'observation d'un pixel-art de reference : un arbre
 * lisible n'est pas **une** boule, c'est **plusieurs boules qui se chevauchent**
 * a des hauteurs differentes. C'est ce decalage qui donne une silhouette qu'on
 * reconnait de loin, et le §4.11 rappelle que c'est la silhouette qui porte
 * toute la lisibilite quand on dezoome.
 *
 * Faire varier les boules suffit a faire varier l'arbre : aucun des cinq n'a la
 * meme decoupe.
 */
/**
 * Cote d'un pixel d'arbre, en pixels ecran.
 *
 * Les arbres sont dessines sur une grille deux fois plus grossiere que le
 * reste : c'est **la** difference entre un dessin lisse et du vrai pixel-art.
 * Tracer les boules au pixel fin donnait des bords presque ronds, et ca se
 * voyait immediatement des qu'on zoomait.
 */
const ECHELLE_ARBRE = 2;

/** Silhouettes en coordonnees de grille, pas en pixels ecran. */
const SILHOUETTES: Houppier[][] = [
  // Un grand, elance, la cime bien detachee.
  [
    { x: 7, y: 4, r: 3.6 },
    { x: 4, y: 7, r: 3.1 },
    { x: 9, y: 7, r: 3.1 },
    { x: 6, y: 9, r: 3.1 },
  ],
  // Un trapu, large, presque rond.
  [
    { x: 6, y: 6, r: 4.2 },
    { x: 3, y: 8, r: 3 },
    { x: 9, y: 8, r: 3 },
  ],
  // Un penche, deux cimes.
  [
    { x: 5, y: 5, r: 3.1 },
    { x: 8, y: 6, r: 3.6 },
    { x: 6, y: 9, r: 3.6 },
  ],
  // Un petit buisson.
  [
    { x: 6, y: 8, r: 3.6 },
    { x: 3, y: 10, r: 2.6 },
    { x: 9, y: 10, r: 2.6 },
  ],
  // Un tres haut, quatre etages.
  [
    { x: 6, y: 3, r: 2.6 },
    { x: 8, y: 5, r: 3.1 },
    { x: 4, y: 7, r: 3.1 },
    { x: 7, y: 10, r: 3.1 },
  ],
];

/**
 * Sombre (contour), moyen (masse), clair (lumiere).
 *
 * Aucun vert vif : l'ecart entre le moyen et le clair reste faible. Un
 * feuillage trop lumineux tire l'oeil vers le decor alors qu'il doit rester
 * derriere les personnages (DESIGN.md §4.11).
 */
const VERTS: [number, number, number][] = [
  [0x1c3714, 0x2f5c1f, 0x40792b],
  [0x18300f, 0x2a5320, 0x3a6b26],
  [0x22421a, 0x356523, 0x467d2d],
  [0x1a3312, 0x2d5a1e, 0x3d7028],
  [0x152c0e, 0x264c1a, 0x356123],
];

const GRILLE_ARBRE = { largeur: 13, hauteur: 15 };
const LARGEUR_ARBRE = GRILLE_ARBRE.largeur * ECHELLE_ARBRE;
const HAUTEUR_ARBRE = GRILLE_ARBRE.hauteur * ECHELLE_ARBRE;

/** Les cles des arbres, dans l'ordre ou ils sont fabriques. */
export const ARBRES = SILHOUETTES.map((_, i) => `arbre-${i}`);

/**
 * Les arbres, dessines pixel par pixel.
 *
 * On rasterise a la main au lieu d'empiler des `fillCircle` : un cercle Phaser
 * est lisse, et un bord lisse dans un jeu pixel-art se voit immediatement des
 * qu'on zoome. Ici chaque pixel est decide, donc chaque bord est net.
 */
function creerArbre(scene: Phaser.Scene): void {
  const E = ECHELLE_ARBRE;

  SILHOUETTES.forEach((houppiers, index) => {
    const [sombre, moyen, clair] = VERTS[index % VERTS.length]!;
    const g = scene.make.graphics({ x: 0, y: 0 }, false);

    /** Un pixel de la grille grossiere, pose en pixels ecran. */
    const point = (x: number, y: number, couleur: number, alpha = 1) => {
      g.fillStyle(couleur, alpha);
      g.fillRect(x * E, y * E, E, E);
    };

    const dedans = (x: number, y: number) =>
      houppiers.some((h) => (x - h.x) ** 2 + (y - h.y) ** 2 <= h.r * h.r);

    // L'ombre portee ancre l'arbre au sol : sans elle il flotte.
    const solY = GRILLE_ARBRE.hauteur - 2;
    for (let x = 3; x <= 9; x++) point(x, solY, 0x000000, 0.18);

    // Le tronc, evase a la base.
    const basFeuillage = Math.round(Math.max(...houppiers.map((h) => h.y + h.r))) - 1;
    for (let y = basFeuillage; y < solY; y++) {
      point(5, y, 0x5b3f27);
      point(6, y, 0x452f1d);
    }
    point(4, solY - 1, 0x452f1d);
    point(7, solY - 1, 0x452f1d);

    // Une touffe au pied : elle cache la jointure tronc-sol.
    for (let x = 4; x <= 8; x++) point(x, solY - 1, sombre);

    for (let y = 0; y < GRILLE_ARBRE.hauteur; y++) {
      for (let x = 0; x < GRILLE_ARBRE.largeur; x++) {
        if (!dedans(x, y)) continue;

        // Un pixel de bord devient le contour sombre : c'est lui qui detache
        // l'arbre de l'herbe, et c'est ce qui manquait le plus.
        const bord =
          !dedans(x - 1, y) || !dedans(x + 1, y) || !dedans(x, y - 1) || !dedans(x, y + 1);
        if (bord) {
          point(x, y, sombre);
          continue;
        }

        // La lumiere vient du haut a gauche. Elle tient en deux ou trois
        // pixels par boule : un aplat clair mange la silhouette.
        const eclaire = houppiers.some(
          (h) => (x - (h.x - h.r * 0.42)) ** 2 + (y - (h.y - h.r * 0.5)) ** 2 <= (h.r * 0.34) ** 2,
        );
        point(x, y, eclaire ? clair : moyen);
      }
    }

    g.generateTexture(`arbre-${index}`, LARGEUR_ARBRE, HAUTEUR_ARBRE);
    g.destroy();
  });
}

/** Un bloc de roche, pour marquer le pied de la montagne. */
function creerRocher(scene: Phaser.Scene): void {
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.fillStyle(0x000000, 0.22);
  g.fillEllipse(11, 19, 18, 5);
  g.fillStyle(0x726f68, 1);
  g.fillTriangle(2, 18, 11, 3, 20, 18);
  g.fillStyle(0x8d8a82, 1);
  g.fillTriangle(6, 18, 11, 6, 14, 18);
  g.fillStyle(0x565450, 1);
  g.fillRect(2, 17, 18, 3);
  g.generateTexture("rocher", 22, 22);
  g.destroy();
}

/** Mur en ruine qui delimite l'arene. */
function creerMur(scene: Phaser.Scene): void {
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.fillStyle(0x6d6357, 1);
  g.fillRect(0, 0, 16, 16);
  g.fillStyle(0x574e44, 1);
  g.fillRect(0, 10, 16, 6);
  g.fillStyle(0x837868, 1);
  g.fillRect(2, 2, 5, 5);
  g.fillRect(9, 4, 4, 4);
  g.generateTexture("mur", 16, 16);
  g.destroy();
}

function creerHero(scene: Phaser.Scene, cle: string, couleur: number, accent: number): void {
  const g = scene.make.graphics({ x: 0, y: 0 }, false);

  // Ombre portee, cuite dans la texture : elle ancre le perso au sol.
  g.fillStyle(0x000000, 0.25);
  g.fillEllipse(6, 16, 11, 4);

  g.fillStyle(couleur, 1); // corps
  g.fillRect(3, 8, 6, 6);
  g.fillStyle(0x33313a, 1); // jambes
  g.fillRect(3, 14, 2, 2);
  g.fillRect(7, 14, 2, 2);
  g.fillStyle(0xe8c39a, 1); // tete
  g.fillRect(4, 4, 4, 4);
  g.fillStyle(accent, 1); // casque / capuche : le marqueur de classe
  g.fillRect(3, 2, 6, 3);
  g.fillStyle(0x1a1a1a, 1); // yeux
  g.fillRect(4, 6, 1, 1);
  g.fillRect(7, 6, 1, 1);
  g.fillStyle(0xbfc6cf, 1); // arme
  g.fillRect(9, 7, 3, 1);

  g.generateTexture(cle, TAILLE_HERO.largeur, TAILLE_HERO.hauteur);
  g.destroy();
}

function creerEnnemi(scene: Phaser.Scene): void {
  const g = scene.make.graphics({ x: 0, y: 0 }, false);

  g.fillStyle(0x000000, 0.25);
  g.fillEllipse(6, 14, 11, 4);

  g.fillStyle(0x4a2b3d, 1); // corps
  g.fillRect(2, 5, 8, 8);
  g.fillStyle(0x35202c, 1);
  g.fillRect(2, 11, 8, 2);
  g.fillStyle(0x6b3d55, 1); // cornes
  g.fillRect(1, 3, 2, 3);
  g.fillRect(9, 3, 2, 3);
  g.fillStyle(0xff5a4a, 1); // yeux
  g.fillRect(3, 7, 2, 2);
  g.fillRect(7, 7, 2, 2);

  g.generateTexture("ennemi", TAILLE_ENNEMI.largeur, TAILLE_ENNEMI.hauteur);
  g.destroy();
}

/** Mort-vivant releve par le Necromancien : la meme carrure, la couleur de la tombe. */
function creerMortVivant(scene: Phaser.Scene): void {
  const g = scene.make.graphics({ x: 0, y: 0 }, false);

  g.fillStyle(0x000000, 0.25);
  g.fillEllipse(6, 14, 11, 4);

  g.fillStyle(0x5f7a4e, 1); // chair verdatre
  g.fillRect(2, 5, 8, 8);
  g.fillStyle(0x44583a, 1);
  g.fillRect(2, 11, 8, 2);
  g.fillStyle(0xd8d2c4, 1); // os saillants
  g.fillRect(1, 6, 1, 5);
  g.fillRect(10, 6, 1, 5);
  g.fillStyle(0x9ee8a0, 1); // yeux
  g.fillRect(3, 7, 2, 2);
  g.fillRect(7, 7, 2, 2);

  g.generateTexture("mort-vivant", TAILLE_ENNEMI.largeur, TAILLE_ENNEMI.hauteur);
  g.destroy();
}

/** Les trois visages du familier du mage : de base, golem, spectre. */
function creerFamiliers(scene: Phaser.Scene): void {
  const modele = (cle: string, corps: number, oeil: number, trapu: boolean) => {
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0x000000, 0.25);
    g.fillEllipse(6, 14, 11, 4);

    g.fillStyle(corps, 1);
    if (trapu) {
      g.fillRect(1, 4, 10, 9); // large et carre : le golem
      g.fillRect(2, 13, 3, 2);
      g.fillRect(7, 13, 3, 2);
    } else {
      g.fillRect(3, 4, 6, 9);
      g.fillTriangle(3, 13, 9, 13, 6, 16); // pointe flottante
    }
    g.fillStyle(oeil, 1);
    g.fillRect(trapu ? 3 : 4, 7, 2, 2);
    g.fillRect(trapu ? 7 : 6, 7, 2, 2);

    g.generateTexture(cle, TAILLE_ENNEMI.largeur, TAILLE_ENNEMI.hauteur);
    g.destroy();
  };

  modele("familier", 0x8e6bb8, 0x5ec8f0, false);
  modele("familier-golem", 0x8a7154, 0xffd166, true);
  modele("familier-spectre", 0x7fa8c8, 0xffffff, false);
}

/**
 * Projectile et impact volontairement gros et clairs : au zoom arriere il faut
 * encore voir ce qui se passe (DESIGN.md §4.11).
 */
function creerProjectile(scene: Phaser.Scene): void {
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.fillStyle(0xfff0a0, 1);
  g.fillCircle(4, 4, 4);
  g.fillStyle(0xffffff, 1);
  g.fillCircle(4, 4, 2);
  g.generateTexture("projectile", 8, 8);
  g.destroy();
}

function creerImpact(scene: Phaser.Scene): void {
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.fillStyle(0xffffff, 1);
  g.fillCircle(8, 8, 8);
  g.generateTexture("impact", 16, 16);
  g.destroy();
}
