import Phaser from "phaser";
import {
  NOMS_METIER,
  NOMS_POSTURE_CIVILE,
  NOMS_RESSOURCE,
  RESSOURCES,
  plafondDeNiveau,
} from "../core/habitants";
import { lireEtat, pireEtat } from "../core/etats";
import { NOMS_RUPTURE, REGLAGES_STRESS } from "../core/personne";
import { lireSatisfaction } from "../core/satisfaction";
import type { EtatVillage } from "../scenes/ArenaScene";
import {
  C,
  T,
  HAUTEUR_TITRE,
  barreDeTitre,
  cadre,
  espacer,
  teindre,
  texte,
  yTitre,
  type Plaque,
} from "./ui/chrome";

/**
 * La jauge de stress en quatre caracteres.
 *
 * Pas de barre graphique : le §4.23 interdit une barre au-dessus des tetes, et
 * dans un tableau monospace une jauge en texte se lit aussi vite et ne coute
 * aucun objet de plus. Elle reste vide tant que rien ne se passe — c'est ce qui
 * fait qu'on la remarque quand elle se remplit.
 */
function jauge(stress: number): string {
  const crans = Math.min(4, Math.round((stress / REGLAGES_STRESS.rupture) * 4));
  return `[${"|".repeat(crans)}${" ".repeat(4 - crans)}]`;
}

/**
 * ⚠️ **La ligne entiere rougit quand quelqu'un va mal** (§4.10) — c'est la seule
 * chose qu'on cherche en ouvrant ce tableau. Le sang frais est reserve a ce qui
 * peut tuer, et une rupture ou un etat au dernier palier le peuvent ; la faim,
 * elle, arrete le travail sans tuer, donc elle s'ecrit en laiton.
 */
function couleurDeLigne(rassasie: boolean, stress: number, enAlerte: boolean): string {
  if (enAlerte) return T.sangFrais;
  if (!rassasie) return T.laiton;
  if (stress >= REGLAGES_STRESS.seuilVisible) return T.laiton;
  return T.os;
}

/**
 * Le village, en deux morceaux (DESIGN.md §4.18).
 *
 * **En permanence, une seule ligne : les habitants.** C'est le choix de design —
 * l'ecran reste degage, mais la population est devenue la condition de defaite,
 * et la seule chose qui peut finir la partie ne peut pas etre la seule qu'on ne
 * voie jamais. Elle vire au rouge et clignote quand quelqu'un court.
 *
 * **Le reste a la demande** (touche F) : les stocks, les vivres, le detail de
 * chaque habitant. Personne n'ouvrira ce panneau en pleine nuit, et c'est
 * exactement pour ca qu'il ne doit rien contenir de vital.
 *
 * Tous les objets Texte sont fabriques ici, une fois, et recycles : le §4.17
 * interdit d'en creer en cours de partie.
 */

/** Nombre maximum d'habitants listes dans le panneau. */
const LIGNES = 12;

/** Ce qui manque pour monter l'eglise, en un mot chacun. */
const NOMS_BLOCAGE: Record<string, string> = {
  materiaux: "materiaux",
  population: "habitants",
  argent: "argent",
  satisfaction: "satisfaction",
  "a-terre": "elle est a terre",
  "niveau-max": "rien",
};

/**
 * L'etat de l'eglise en une ligne (DESIGN.md §4.22).
 *
 * Elle a quatre roles et le joueur doit pouvoir les surveiller d'un coup d'oeil :
 * a quel niveau elle est, si elle tient, qui est dedans, et ce qui bloque le
 * niveau suivant.
 */
function lireEglise(etat: EtatVillage): string {
  const e = etat.eglise;

  if (e.etat === "ruine") return "EGLISE A TERRE — plus de soins ni de refuge · Y : relever";
  if (e.etat === "relevement") {
    return `EGLISE en chantier — ${Math.round(e.partRelevement * 100)}% · toujours aucun soin`;
  }

  const sante = `${Math.round(e.ratioPv * 100)}%`;
  const monde = `${e.refugies} dedans, ${e.defenseurs} aux portes`;
  const suite =
    e.manque.length === 0
      ? "Y : monter d'un niveau"
      : `manque ${e.manque.map((c) => NOMS_BLOCAGE[c] ?? c).join(", ")}`;

  return `EGLISE niveau ${e.niveau} — ${sante} · ${monde} · ${suite}`;
}

export class PanneauVillage {
  private fond: Phaser.GameObjects.Graphics;
  private entete: Phaser.GameObjects.Text;
  private titre: Phaser.GameObjects.Text;
  private stocks: Phaser.GameObjects.Text;
  private aide: Phaser.GameObjects.Text;
  private lignes: Phaser.GameObjects.Text[] = [];
  private ouvert = false;

  /**
   * @param changerPosture appele avec l'index de l'habitant clique. C'est le
   *        seul endroit ou l'on donne un ordre a un civil : le §4.18 veut qu'on
   *        puisse parier poste par poste, pas d'un seul interrupteur global.
   */
  constructor(
    private scene: Phaser.Scene,
    private changerPosture: (index: number) => void,
    private changerPoste: (index: number) => void,
    private ouvrirFiche: (index: number) => void,
  ) {
    this.fond = scene.add.graphics().setDepth(1500).setVisible(false);
    this.entete = this.texte(T.titre, 11);
    this.entete.setText(espacer("LE VILLAGE"));

    this.titre = this.texte(T.os, 12);
    this.stocks = this.texte(T.laiton, 12);
    this.aide = this.texte(T.osMat, 10);

    for (let i = 0; i < LIGNES; i++) {
      const ligne = this.texte(T.os, 11);
      // Cliquer un habitant fait tourner sa posture. Les objets sont fabriques
      // une fois ici, ecouteurs compris : rien n'est cree en cours de partie.
      ligne.setInteractive({ useHandCursor: true });
      ligne.on("pointerdown", (p: Phaser.Input.Pointer) => {
        if (!this.ouvert) return;
        // Clic gauche : sa posture. Clic droit : son poste. Le §4.18 dit que le
        // joueur decide **qui fait quoi** — c'est la, et nulle part ailleurs.
        //
        // Maj + clic ouvre sa fiche. Meme convention que la barre de heros, ou
        // Maj + clic droit selectionne toute une classe (§4.4) : la touche Maj
        // veut dire « la version etendue de ce geste ».
        if (p.event.shiftKey) this.ouvrirFiche(i);
        else if (p.rightButtonDown()) this.changerPoste(i);
        else this.changerPosture(i);
      });
      this.lignes.push(ligne);
    }
  }

  private texte(couleur: string, taille: number): Phaser.GameObjects.Text {
    return texte(this.scene, 0, 0, taille, couleur).setDepth(1501).setVisible(false);
  }

  basculer(): void {
    this.ouvert = !this.ouvert;
  }

  /**
   * Le compteur permanent — jour, population, survie — a quitte ce fichier pour
   * `ui/panneauEtat.ts` : il etait pose a nu sur l'herbe, et il faisait paire
   * avec celui d'`UiScene` au meme coin de l'ecran. Les deux forment maintenant
   * une seule plaque opaque (§4.10).
   */
  rafraichir(etat: EtatVillage): void {
    this.majPanneau(etat);
  }

  /**
   * ⚠️ **La plaque se mesure sur son contenu.** Elle etait figee a 330 px de
   * large pour des lignes qui en font plus de 500 : le titre et le tableau
   * sortaient du cadre par la droite, et l'aide passait sous le bord bas. Vu en
   * jouant, invisible a la compilation — un `Rectangle` ne se plaint jamais que
   * ce qu'on ecrit dedans n'y tienne pas.
   *
   * La hauteur suit le nombre d'habitants **reels**, pas le plafond de douze :
   * un village de trois n'a aucune raison d'afficher neuf lignes vides.
   */
  private majPanneau(etat: EtatVillage): void {
    this.fond.setVisible(this.ouvert);
    this.entete.setVisible(this.ouvert);
    this.titre.setVisible(this.ouvert);
    this.stocks.setVisible(this.ouvert);
    this.aide.setVisible(this.ouvert);
    for (const ligne of this.lignes) ligne.setVisible(false);
    if (!this.ouvert) return;

    this.aide.setText(
      `${lireEglise(etat)}\n` +
        `Clic : posture  ·  clic droit : poste  ·  Maj+clic : sa fiche  ·  B : cloche  ·  Y : eglise`,
    );

    const vivres = etat.joursDeVivres;
    this.titre.setText(
      `${etat.population} habitants  ·  ${
        Number.isFinite(vivres) ? `${vivres.toFixed(1)} j de vivres` : "personne a nourrir"
      }  ·  ${etat.satisfaction}% — ${lireSatisfaction(etat.satisfaction)}`,
    );
    // Sous deux jours de vivres, la production va s'arreter : c'est la seule
    // contrainte du §4.18, elle doit se voir avant de mordre.
    teindre(this.titre, vivres < 2 ? T.sangFrais : T.os);

    this.stocks.setText(
      RESSOURCES.map((r) => `${NOMS_RESSOURCE[r]} ${Math.floor(etat.stocks[r])}`).join("   "),
    );

    const montres = etat.habitants.slice(0, LIGNES);
    montres.forEach((habitant, index) => {
      const ligne = this.lignes[index]!;
      ligne.setVisible(true);

      const { personne } = habitant;
      if (!habitant.vivant) {
        ligne.setText(`${personne.nom} — mort`);
        teindre(ligne, T.osMat);
        return;
      }

      // Ce qui va mal passe **devant** le metier : c'est ce que le joueur
      // cherche quand il ouvre ce tableau (§4.23).
      const pire = pireEtat(personne.etats);
      const alerte = personne.rupture
        ? NOMS_RUPTURE[personne.rupture]
        : pire
          ? lireEtat(pire).toUpperCase()
          : "";

      const plafond = plafondDeNiveau(habitant.rang);
      // ⚠️ **Plus de colonnes calees a l'espace.** Elles ne tenaient qu'en
      // chasse fixe ; la police du jeu est condensee depuis le 11 aout (§4.10).
      // Le separateur remplace l'alignement, et il se lit partout.
      ligne.setText(
        `${personne.nom}  ·  ${NOMS_METIER[habitant.metier]}  ·  ` +
          `${habitant.rang} niv ${habitant.niveau}/${plafond}  ` +
          `${jauge(personne.stress)} ${alerte || NOMS_POSTURE_CIVILE[habitant.posture]}`,
      );
      teindre(ligne, couleurDeLigne(habitant.rassasie, personne.stress, alerte !== ""));
    });

    // --- La plaque, une fois qu'on sait ce qu'il y a dedans ---
    const contenus = [this.titre, this.stocks, this.aide, ...this.lignes.slice(0, montres.length)];
    const largeur = Math.max(320, ...contenus.map((t) => t.width)) + 24;
    const hauteur = HAUTEUR_TITRE + 12 + 20 + 22 + montres.length * 16 + 12 + this.aide.height + 12;

    const x = 16;
    const y = Math.max(16, this.scene.scale.height - hauteur - 16);
    const plaque: Plaque = { x, y, largeur, hauteur };

    this.fond.clear();
    cadre(this.fond, plaque);
    barreDeTitre(this.fond, plaque);

    this.entete.setPosition(x + 12, yTitre(plaque));
    this.titre.setPosition(x + 12, y + HAUTEUR_TITRE + 10);
    this.stocks.setPosition(x + 12, y + HAUTEUR_TITRE + 30);

    const hautTableau = y + HAUTEUR_TITRE + 54;
    // Un filet sous les stocks : le tableau des gens est une autre lecture.
    this.fond.fillStyle(C.sangSeche, 0.6);
    this.fond.fillRect(x + 12, hautTableau - 8, largeur - 24, 1);

    montres.forEach((_, index) => {
      this.lignes[index]?.setPosition(x + 12, hautTableau + index * 16);
    });
    this.aide.setPosition(x + 12, hautTableau + montres.length * 16 + 10);
  }
}
