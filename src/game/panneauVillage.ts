import Phaser from "phaser";
import {
  NOMS_METIER,
  NOMS_POSTURE_CIVILE,
  NOMS_RESSOURCE,
  RESSOURCES,
  plafondDeNiveau,
} from "../core/habitants";
import type { EtatVillage } from "../scenes/ArenaScene";

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
  /** Le seul affichage permanent : la population et l'heure */
  private compteur: Phaser.GameObjects.Text;
  private cadre: Phaser.GameObjects.Rectangle;
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
  ) {
    this.compteur = scene.add
      .text(0, 0, "", { fontFamily: "monospace", fontSize: "13px", color: "#f2e9d8" })
      .setOrigin(1, 0)
      .setDepth(1003);

    this.cadre = scene.add
      .rectangle(0, 0, 330, 42 + LIGNES * 16 + 46, 0x1b1720, 0.92)
      .setOrigin(0)
      .setStrokeStyle(1, 0x6b6478)
      .setDepth(1500)
      .setVisible(false);

    this.titre = this.texte("#ffd98a", "13px");
    this.stocks = this.texte("#d8c48a", "12px");
    this.aide = this.texte("#8f8a9e", "10px");

    for (let i = 0; i < LIGNES; i++) {
      const ligne = this.texte("#c8c2d4", "11px");
      // Cliquer un habitant fait tourner sa posture. Les objets sont fabriques
      // une fois ici, ecouteurs compris : rien n'est cree en cours de partie.
      ligne.setInteractive({ useHandCursor: true });
      ligne.on("pointerdown", (p: Phaser.Input.Pointer) => {
        if (!this.ouvert) return;
        // Clic gauche : sa posture. Clic droit : son poste. Le §4.18 dit que le
        // joueur decide **qui fait quoi** — c'est la, et nulle part ailleurs.
        if (p.rightButtonDown()) this.changerPoste(i);
        else this.changerPosture(i);
      });
      this.lignes.push(ligne);
    }
  }

  private texte(couleur: string, taille: string): Phaser.GameObjects.Text {
    return this.scene.add
      .text(0, 0, "", { fontFamily: "monospace", fontSize: taille, color: couleur })
      .setDepth(1501)
      .setVisible(false);
  }

  basculer(): void {
    this.ouvert = !this.ouvert;
  }

  rafraichir(etat: EtatVillage, maintenant: number): void {
    this.majCompteur(etat, maintenant);
    this.majPanneau(etat);
  }

  /**
   * La ligne permanente.
   *
   * Elle dit trois choses et pas une de plus : combien d'habitants sont vivants,
   * ou on en est dans la journee, et si quelqu'un est en train de courir.
   */
  private majCompteur(etat: EtatVillage, maintenant: number): void {
    const minutes = Math.ceil(etat.restant / 60_000);
    const moment = etat.phase === "jour" ? `Jour ${etat.jour}` : `Nuit ${etat.jour}`;
    const icone = etat.phase === "jour" ? "*" : "(";

    this.compteur.setPosition(this.scene.scale.width - 16, 52);
    this.compteur.setText(
      `${icone} ${moment} — ${minutes} min\n${etat.population} habitant${etat.population > 1 ? "s" : ""}`,
    );
    this.compteur.setAlign("right");

    // Quelqu'un court : le clignotement est la seule alerte de l'ecran, il faut
    // qu'elle soit impossible a manquer.
    if (etat.population === 0) this.compteur.setColor("#ff5a4a");
    else if (etat.enFuite) {
      this.compteur.setColor(Math.floor(maintenant / 220) % 2 === 0 ? "#ff5a4a" : "#ffd98a");
    } else this.compteur.setColor("#f2e9d8");
  }

  private majPanneau(etat: EtatVillage): void {
    this.cadre.setVisible(this.ouvert);
    this.titre.setVisible(this.ouvert);
    this.stocks.setVisible(this.ouvert);
    this.aide.setVisible(this.ouvert);
    for (const ligne of this.lignes) ligne.setVisible(false);
    if (!this.ouvert) return;

    const x = 16;
    const y = this.scene.scale.height - this.cadre.height - 16;
    this.cadre.setPosition(x, y);
    this.titre.setPosition(x + 12, y + 10);
    this.stocks.setPosition(x + 12, y + 30);
    this.aide.setPosition(x + 12, y + 52 + LIGNES * 16 + 6);
    this.aide.setText(`${lireEglise(etat)}\nClic : posture  ·  clic droit : poste  ·  B : cloche  ·  Y : eglise`);

    const vivres = etat.joursDeVivres;
    this.titre.setText(
      `LE VILLAGE — ${etat.population} habitants  ·  ${
        Number.isFinite(vivres) ? `${vivres.toFixed(1)} j de vivres` : "personne a nourrir"
      }`,
    );
    // Sous deux jours de vivres, la production va s'arreter : c'est la seule
    // contrainte du §4.18, elle doit se voir avant de mordre.
    this.titre.setColor(vivres < 2 ? "#ff8a5a" : "#ffd98a");

    this.stocks.setText(
      RESSOURCES.map((r) => `${NOMS_RESSOURCE[r]} ${Math.floor(etat.stocks[r])}`).join("   "),
    );

    etat.habitants.slice(0, LIGNES).forEach((habitant, index) => {
      const ligne = this.lignes[index]!;
      ligne.setPosition(x + 12, y + 52 + index * 16).setVisible(true);

      if (!habitant.vivant) {
        ligne.setText(`${habitant.nom} — mort`);
        ligne.setColor("#6b6478");
        return;
      }

      const plafond = plafondDeNiveau(habitant.rang);
      ligne.setText(
        `${habitant.nom.padEnd(10)} ${NOMS_METIER[habitant.metier].padEnd(12)} ` +
          `${habitant.rang} niv ${habitant.niveau}/${plafond}  ${NOMS_POSTURE_CIVILE[habitant.posture]}`,
      );
      ligne.setColor(habitant.rassasie ? "#c8c2d4" : "#ff8a5a");
    });
  }
}
