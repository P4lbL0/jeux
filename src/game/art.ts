import Phaser from "phaser";
import { cuireLeMonde } from "./dessin/monde";

/**
 * Les textures d'interface dessinees au code, et l'appel qui cuit le monde.
 *
 * Ce fichier a longtemps ete le **filet de securite** du jeu : un placeholder
 * par sprite, efface des qu'un PNG portait la meme cle. Depuis le 10 septembre
 * 2026 il n'y a plus de PNG, et plus de placeholder non plus : tout ce qui se
 * voit dans le monde est cuit par `dessin/monde.ts`. Il ne reste ici que ce qui
 * n'est pas du monde — les icones de capacites, le projectile, l'eclair
 * d'impact — parce que ces trois-la sont des formes d'interface, teintees par
 * les panneaux, et non des matieres de la palette.
 */

export function creerTexturesPlaceholder(scene: Phaser.Scene): void {
  cuireLeMonde(scene);
  creerProjectile(scene);
  creerImpact(scene);
  creerIconesUltimes(scene);
  creerIconesCapacites(scene);
}

/**
 * L'echelle a donner a un portrait pour qu'il tienne la hauteur voulue.
 *
 * Elle est **entiere** a dessein : agrandir du pixel-art d'un facteur
 * fractionnaire produit des pixels de tailles inegales, et ca se voit tout de
 * suite sur un portrait d'interface, qui est grand et immobile.
 */
export function echellePortrait(hauteurTexture: number, hauteurVoulue: number): number {
  return Math.max(1, Math.round(hauteurVoulue / hauteurTexture));
}

/** Cote des icones d'interface, en pixels. */
const T = 32;

/**
 * Le graveur d'icones.
 *
 * Il porte le garde commun a tout ce fichier : une cle deja fournie n'est
 * jamais redessinee. Les icones sont tracees **en blanc**, parce que le
 * panneau les teinte ensuite a la couleur de la classe et les grise pendant le
 * rechargement — une icone deja coloree ne saurait pas faire ca.
 */
function graveur(scene: Phaser.Scene) {
  return (cle: string, trace: (g: Phaser.GameObjects.Graphics) => void) => {
    if (scene.textures.exists(cle)) return;
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0xffffff, 1);
    trace(g);
    g.generateTexture(cle, T, T);
    g.destroy();
  };
}

/** Une icone par effet d'ultime. */
function creerIconesUltimes(scene: Phaser.Scene): void {
  const dessiner = graveur(scene);
  const centre = T / 2;

  // Tourbillon : quatre lames tournant autour d'un moyeu.
  dessiner("ultime-tourbillon", (g) => {
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
  });

  // Rempart : un bouclier.
  dessiner("ultime-rempart", (g) => {
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
  });

  // Meteore : une boule et sa trainee.
  dessiner("ultime-meteore", (g) => {
    g.fillCircle(20, 12, 8);
    g.fillTriangle(4, 28, 13, 19, 16, 24);
    g.fillTriangle(9, 29, 16, 22, 20, 26);
  });

  // Ombre : une dague.
  dessiner("ultime-ombre", (g) => {
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
  });

  // Pluie de fleches : trois traits qui tombent.
  dessiner("ultime-pluie-de-fleches", (g) => {
    for (const x of [6, 15, 24]) {
      g.fillRect(x, 4, 2, 18);
      g.fillTriangle(x - 3, 20, x + 5, 20, x + 1, 29);
    }
  });

  // Aube : un soleil levant.
  dessiner("ultime-aube", (g) => {
    g.fillCircle(16, 20, 9);
    g.fillRect(2, 22, 28, 3);
    for (let i = 0; i < 5; i++) {
      const a = Math.PI + (i / 4) * Math.PI;
      g.fillCircle(16 + Math.cos(a) * 14, 20 + Math.sin(a) * 14, 2);
    }
  });

  // Levee des morts : une main qui sort de terre.
  dessiner("ultime-levee-des-morts", (g) => {
    g.fillRect(2, 24, 28, 3);
    g.fillRect(13, 12, 6, 13);
    for (const x of [9, 13, 17, 21]) g.fillRect(x, 6, 2, 9);
  });
}

/** Icones des competences actives, meme convention que les ultimes. */
function creerIconesCapacites(scene: Phaser.Scene): void {
  const dessiner = graveur(scene);

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

  // --- Les bases elementaires (§4.13, 23 septembre 2026) ---

  // Boule de feu : une boule, et sa queue de flamme en arriere.
  dessiner("cap-boule-de-feu", (g) => {
    g.fillCircle(20, 20, 8);
    g.fillTriangle(14, 14, 4, 6, 18, 12);
    g.fillTriangle(13, 19, 2, 16, 15, 15);
    g.fillTriangle(18, 13, 14, 2, 21, 12);
    g.fillStyle(0x000000, 1);
    g.fillCircle(21, 21, 3);
  });

  // Vent : trois traits d'air qui s'enroulent au bout.
  dessiner("cap-vent", (g) => {
    g.lineStyle(3, 0xffffff, 1);
    for (const [y, long] of [
      [9, 20],
      [16, 26],
      [23, 16],
    ] as [number, number][]) {
      g.lineBetween(3, y, 3 + long, y);
      g.beginPath();
      g.arc(3 + long, y - 3, 3, Math.PI / 2, -Math.PI / 2, true);
      g.strokePath();
    }
  });

  // Eau : une goutte qui tombe dans sa flaque.
  dessiner("cap-eau", (g) => {
    g.fillCircle(16, 15, 7);
    g.fillTriangle(9, 13, 23, 13, 16, 2);
    g.fillEllipse(16, 27, 26, 6);
    g.fillStyle(0x000000, 1);
    g.fillEllipse(16, 27, 16, 2);
  });

  // Nature : trois racines qui sortent de terre et se referment.
  dessiner("cap-nature", (g) => {
    g.fillRect(2, 26, 28, 3);
    g.fillTriangle(5, 26, 10, 26, 13, 8);
    g.fillTriangle(13, 26, 19, 26, 16, 3);
    g.fillTriangle(22, 26, 27, 26, 19, 9);
  });

  // Teleportation : la ou il etait (un cercle vide), la ou il est.
  dessiner("cap-teleportation", (g) => {
    g.lineStyle(2, 0xffffff, 0.7);
    g.strokeCircle(8, 16, 6);
    for (let i = 0; i < 3; i++) g.fillRect(14 + i * 3, 15, 2, 2);
    g.fillCircle(25, 9, 4);
    g.fillRect(21, 13, 8, 14);
  });

  // --- Les fusions actives (§4.25) ---

  // Tourbillon infernal : la fleche du Moulinet, et des flammes qui en jaillissent.
  dessiner("cap-tourbillon-infernal", (g) => {
    g.fillCircle(16, 18, 11);
    g.fillStyle(0x000000, 1);
    g.fillCircle(16, 18, 6);
    g.fillRect(16, 5, 14, 13);
    g.fillStyle(0xffffff, 1);
    g.fillTriangle(18, 6, 27, 10, 18, 14);
    g.fillTriangle(4, 10, 8, 1, 10, 11);
    g.fillTriangle(9, 7, 13, 0, 14, 8);
  });

  // Forteresse mobile : une fleche de charge qui bute sur un dome.
  dessiner("cap-forteresse-mobile", (g) => {
    g.fillCircle(21, 21, 10);
    g.fillStyle(0x000000, 1);
    g.fillCircle(21, 21, 6);
    g.fillRect(0, 22, 32, 10);
    g.fillStyle(0xffffff, 1);
    g.fillRect(9, 22, 22, 3);
    g.fillRect(1, 13, 9, 3);
    g.fillTriangle(9, 9, 15, 14, 9, 19);
  });

  // Temps fracture : un sablier fendu en travers.
  dessiner("cap-temps-fracture", (g) => {
    g.fillRect(7, 3, 18, 3);
    g.fillRect(7, 26, 18, 3);
    g.fillTriangle(8, 6, 24, 6, 16, 16);
    g.fillTriangle(8, 26, 24, 26, 16, 16);
    g.fillStyle(0x000000, 1);
    for (let i = 0; i < 6; i++) g.fillRect(4 + i * 4, 12 + (i % 2) * 5, 5, 3);
  });

  // Neant : le portail de l'Exil, et le sablier de l'Heure sombre en son coeur.
  dessiner("cap-neant", (g) => {
    g.fillCircle(16, 16, 14);
    g.fillStyle(0x000000, 1);
    g.fillCircle(16, 16, 11);
    g.fillStyle(0xffffff, 1);
    g.fillRect(11, 8, 10, 2);
    g.fillRect(11, 22, 10, 2);
    g.fillTriangle(12, 10, 20, 10, 16, 16);
    g.fillTriangle(12, 22, 20, 22, 16, 16);
  });

  // Exil des morts : le portail de l'Exil, et un crane dedans.
  dessiner("cap-exil-des-morts", (g) => {
    g.fillCircle(16, 16, 14);
    g.fillStyle(0x000000, 1);
    g.fillCircle(16, 16, 11);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(16, 14, 6);
    g.fillRect(12, 18, 8, 5);
    g.fillStyle(0x000000, 1);
    g.fillCircle(13, 14, 2);
    g.fillCircle(19, 14, 2);
    g.fillRect(14, 20, 1, 3);
    g.fillRect(17, 20, 1, 3);
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

/**
 * Projectile et impact volontairement gros et clairs : au zoom arriere il faut
 * encore voir ce qui se passe (DESIGN.md §4.11). Ils sont blancs et teintes a
 * l'emission — ce sont des formes, pas des matieres.
 */
function creerProjectile(scene: Phaser.Scene): void {
  if (scene.textures.exists("projectile")) return;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.fillStyle(0xfff0a0, 1);
  g.fillCircle(4, 4, 4);
  g.fillStyle(0xffffff, 1);
  g.fillCircle(4, 4, 2);
  g.generateTexture("projectile", 8, 8);
  g.destroy();
}

function creerImpact(scene: Phaser.Scene): void {
  if (scene.textures.exists("impact")) return;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.fillStyle(0xffffff, 1);
  g.fillCircle(8, 8, 8);
  g.generateTexture("impact", 16, 16);
  g.destroy();
}
