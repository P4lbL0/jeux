import Phaser from "phaser";
import { Rng } from "../core/rng";
import { CLASSES, ORDRE_CLASSES } from "../core/classes";

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
  creerHerbe(scene);
  creerMur(scene);
  creerEnnemi(scene);
  creerMortVivant(scene);
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

/** Herbe facon WorldBox : plusieurs verts en damier irregulier, pas un fond uni. */
function creerHerbe(scene: Phaser.Scene): void {
  const verts = [0x4a7a2c, 0x53862f, 0x5c9134, 0x639a38];
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  // Graine fixe : la texture est identique a chaque lancement.
  const rng = new Rng(20260806);

  for (let y = 0; y < 128; y += 8) {
    for (let x = 0; x < 128; x += 8) {
      g.fillStyle(rng.pick(verts), 1);
      g.fillRect(x, y, 8, 8);
    }
  }
  // Quelques touffes et cailloux pour casser la regularite.
  for (let i = 0; i < 26; i++) {
    g.fillStyle(0x7ab648, 1);
    g.fillRect(rng.int(0, 124), rng.int(0, 124), 4, 3);
  }
  for (let i = 0; i < 8; i++) {
    g.fillStyle(0x6b6f63, 1);
    g.fillRect(rng.int(0, 124), rng.int(0, 124), 3, 3);
  }

  g.generateTexture("herbe", 128, 128);
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

  // Generique : une etoile, pour toute capacite sans icone dediee.
  dessiner("cap-generique", (g) => {
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2;
      g.fillTriangle(16, 16, 16 + Math.cos(a) * 14, 16 + Math.sin(a) * 14, 16 + Math.cos(a + 0.5) * 8, 16 + Math.sin(a + 0.5) * 8);
    }
    g.fillCircle(16, 16, 4);
  });
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
