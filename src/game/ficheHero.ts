import Phaser from "phaser";
import { COULEURS_RANG } from "../core/classes";
import { competenceParId } from "../core/competences";
import { echellePortrait } from "./art";
import type { Hero } from "./entities";

/**
 * Fiche d'un heros : ses statistiques et ses competences, d'un coup d'oeil.
 *
 * Inspiree du panneau de personnage de WorldBox (DESIGN.md §4.11) : dense,
 * chiffree, tout visible sans defiler. Le joueur doit pouvoir comparer deux
 * heros en un ecran — c'est ce qui donne du sens au recrutement et aux rangs.
 *
 * On l'ouvre en cliquant sur un portrait de la barre d'equipe, y compris celui
 * d'un heros joue par l'IA.
 */

const LARGEUR = 460;
/** Hauteur du bloc fixe : portrait, barres et apercu chiffre */
const HAUT_APERCU = 276;
const HAUTEUR_LIGNE_LIEN = 17;
const HAUTEUR_LIGNE_COMPETENCE = 19;
const MAX_COMPETENCES = 6;

/** Un lien d'affinite tel qu'il s'affiche : un nom et une force de 0 a 1. */
export interface LienAffiche {
  nom: string;
  force: number;
}

export interface GroupeAffiche {
  /** Bonus de degats en cours, de 0 a 0,10 (DESIGN.md §4.16) */
  bonus: number;
  liens: LienAffiche[];
}

export class FicheHero {
  private objets: Phaser.GameObjects.GameObject[] = [];
  private ouverte = false;

  constructor(private scene: Phaser.Scene) {}

  get estOuverte(): boolean {
    return this.ouverte;
  }

  basculer(hero: Hero, surIncarner: () => void, groupe: GroupeAffiche): void {
    if (this.ouverte) {
      this.fermer();
      return;
    }
    this.afficher(hero, surIncarner, groupe);
  }

  afficher(hero: Hero, surIncarner: () => void, groupe: GroupeAffiche): void {
    this.fermer();
    this.ouverte = true;

    // La fiche se dimensionne sur son contenu : figee, elle debordait des que
    // le heros passait six competences.
    const entrees = Object.entries(hero.competences);
    const lignesLiens = Math.ceil(groupe.liens.length / 2);
    const nbCompetences = Math.max(1, Math.min(MAX_COMPETENCES, entrees.length));
    const basLiens = HAUT_APERCU + 20 + lignesLiens * HAUTEUR_LIGNE_LIEN;
    const hautCompetences = basLiens + 10;
    const basCompetences = hautCompetences + 20 + nbCompetences * HAUTEUR_LIGNE_COMPETENCE;
    const HAUTEUR = basCompetences + 58;

    const x = this.scene.scale.width / 2 - LARGEUR / 2;
    const y = this.scene.scale.height / 2 - HAUTEUR / 2;

    const voile = this.scene.add.graphics().setDepth(2600);
    voile.fillStyle(0x0d0b12, 0.6);
    voile.fillRect(0, 0, this.scene.scale.width, this.scene.scale.height);
    this.objets.push(voile);
    this.zone(0, 0, this.scene.scale.width, this.scene.scale.height, 2601, () => this.fermer());

    const cadre = this.scene.add.graphics().setDepth(2602);
    cadre.fillStyle(0x1b1720, 0.98);
    cadre.fillRoundedRect(x, y, LARGEUR, HAUTEUR, 10);
    cadre.lineStyle(3, hero.classe.couleur, 1);
    cadre.strokeRoundedRect(x, y, LARGEUR, HAUTEUR, 10);
    this.objets.push(cadre);
    // Le clic a l'interieur ne referme pas la fiche.
    this.zone(x, y, LARGEUR, HAUTEUR, 2603, () => {});

    this.texte(x + LARGEUR / 2, y + 16, `${hero.classe.nom}`, 18, "#f2e9d8").setOrigin(0.5, 0);
    this.texte(x + LARGEUR / 2, y + 40, `Niveau ${hero.niveau}`, 12, "#c8bfae").setOrigin(0.5, 0);

    // Portrait
    cadre.fillStyle(0x2a2433, 1);
    cadre.fillRect(x + 22, y + 66, 64, 88);
    // Le cadre du portrait fait 64x88 : l'echelle se deduit de la texture, elle
    // n'est pas ecrite en dur. Un `setScale(4)` sur un sprite de 32 px debordait
    // du double.
    const portrait = this.scene.add
      .image(x + 54, y + 110, `hero-${hero.classe.id}`)
      .setDepth(2604);
    portrait.setScale(echellePortrait(portrait.height, 72));
    this.objets.push(portrait);

    // Barres
    const bx = x + 100;
    const bl = LARGEUR - 124;
    this.barre(cadre, bx, y + 74, bl, 12, hero.ratioPv, hero.estCritique ? 0xe74c3c : 0x5fc26a);
    this.texte(bx, y + 90, `${Math.ceil(hero.pv)} / ${hero.pvMax} PV`, 11, "#ffffff");
    this.barre(cadre, bx, y + 110, bl, 6, hero.xp / hero.xpRequise, 0x5ec8f0);
    this.texte(bx, y + 120, `${Math.floor(hero.xp)} / ${hero.xpRequise} XP`, 10, "#8fd4f0");
    this.texte(bx, y + 138, `${hero.kills} elimines   ·   ${hero.etat}`, 10, "#c8bfae");

    // --- Apercu chiffre ---
    this.texte(x + 22, y + 168, "APERCU", 11, "#8a8397");
    const stats: [string, string][] = [
      ["Degats", `${hero.degats}`],
      ["Cadence", `${(hero.cadence / 1000).toFixed(2)} s`],
      ["Portee", `${Math.round(hero.portee)}`],
      ["Vitesse", `${Math.round(hero.vitesse)}`],
      ["Esquive", `${Math.round(hero.esquive * 100)}%`],
      ["Critique", `${Math.round(hero.critChance * 100)}%`],
      ["Vol de vie", `${Math.round(hero.volDeVie * 100)}%`],
      ["Resistance", `${hero.resistance}`],
    ];
    stats.forEach(([nom, valeur], i) => {
      const cx = x + 22 + (i % 2) * (LARGEUR / 2 - 20);
      const cy = y + 188 + Math.floor(i / 2) * 20;
      cadre.fillStyle(0x2a2433, 0.9);
      cadre.fillRoundedRect(cx, cy, LARGEUR / 2 - 44, 17, 4);
      this.texte(cx + 8, cy + 3, nom, 10, "#c8bfae");
      this.texte(cx + LARGEUR / 2 - 52, cy + 3, valeur, 10, "#f2e9d8").setOrigin(1, 0);
    });

    // --- Affinites de groupe (DESIGN.md §4.16) ---
    // Sans cet affichage, le joueur subirait un bonus qu'il ne peut ni voir ni
    // comprendre — et un systeme invisible ne change aucune decision.
    this.texte(x + 22, y + HAUT_APERCU, "EQUIPE SOUDEE", 11, "#8a8397");
    this.texte(
      x + LARGEUR - 22,
      y + HAUT_APERCU,
      `+${(groupe.bonus * 100).toFixed(1)}% de degats`,
      11,
      groupe.bonus > 0 ? "#7ee0a0" : "#6b6478",
    ).setOrigin(1, 0);

    const colonne = LARGEUR / 2 - 20;
    groupe.liens.forEach((lien, i) => {
      const cx = x + 22 + (i % 2) * colonne;
      const cy = y + HAUT_APERCU + 20 + Math.floor(i / 2) * HAUTEUR_LIGNE_LIEN;
      this.texte(cx + 4, cy, lien.nom.slice(0, 10), 10, "#c8bfae");
      this.barre(cadre, cx + colonne - 84, cy + 3, 66, 7, lien.force, 0x7ee0a0);
    });

    // --- Competences ---
    const yc = y + hautCompetences;
    this.texte(x + 22, yc, "COMPETENCES", 11, "#8a8397");
    if (entrees.length === 0) {
      this.texte(x + 22, yc + 20, "Aucune pour l'instant.", 11, "#6b6478");
    }
    entrees.slice(0, MAX_COMPETENCES).forEach(([id, palier], i) => {
      const def = competenceParId(id);
      if (!def) return;
      const cy = yc + 20 + i * HAUTEUR_LIGNE_COMPETENCE;
      const couleur = COULEURS_RANG[def.rang];
      cadre.fillStyle(couleur, 0.16);
      cadre.fillRoundedRect(x + 22, cy, LARGEUR - 44, 17, 4);
      this.texte(x + 30, cy + 3, def.rang, 10, teinte(couleur));
      this.texte(x + 62, cy + 3, `${def.nom} ${palier}`, 10, "#f2e9d8");
      const evolution = hero.evolutions[id];
      if (evolution) this.texte(x + LARGEUR - 30, cy + 3, evolution.nom, 9, "#f0c419").setOrigin(1, 0);
    });

    // --- Boutons ---
    const yb = y + basCompetences + 14;
    if (!hero.estIncarne && hero.etat !== "mort") {
      this.bouton(cadre, x + 22, yb, 180, 30, "INCARNER", 0xf0c419, () => {
        this.fermer();
        surIncarner();
      });
    }
    this.bouton(cadre, x + LARGEUR - 142, yb, 120, 30, "FERMER", 0x4a4152, () => this.fermer());
  }

  private bouton(
    cadre: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    l: number,
    h: number,
    libelle: string,
    couleur: number,
    action: () => void,
  ): void {
    cadre.fillStyle(0x2a2433, 1);
    cadre.fillRoundedRect(x, y, l, h, 6);
    cadre.lineStyle(2, couleur, 1);
    cadre.strokeRoundedRect(x, y, l, h, 6);
    this.texte(x + l / 2, y + 9, libelle, 12, teinte(couleur)).setOrigin(0.5, 0);
    this.zone(x, y, l, h, 2606, action);
  }

  private barre(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    l: number,
    h: number,
    ratio: number,
    couleur: number,
  ): void {
    g.fillStyle(0x000000, 0.55);
    g.fillRect(x, y, l, h);
    g.fillStyle(couleur, 1);
    g.fillRect(x, y, l * Phaser.Math.Clamp(ratio, 0, 1), h);
  }

  private texte(
    x: number,
    y: number,
    contenu: string,
    taille: number,
    couleur: string,
  ): Phaser.GameObjects.Text {
    const t = this.scene.add
      .text(x, y, contenu, { fontFamily: "monospace", fontSize: `${taille}px`, color: couleur })
      .setDepth(2605);
    this.objets.push(t);
    return t;
  }

  private zone(x: number, y: number, l: number, h: number, depth: number, action: () => void): void {
    const z = this.scene.add
      .zone(x, y, l, h)
      .setOrigin(0)
      .setDepth(depth)
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", action);
    this.objets.push(z);
  }

  fermer(): void {
    this.ouverte = false;
    for (const objet of this.objets) objet.destroy();
    this.objets = [];
  }
}

function teinte(couleur: number): string {
  return `#${couleur.toString(16).padStart(6, "0")}`;
}
