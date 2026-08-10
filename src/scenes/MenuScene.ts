import Phaser from "phaser";
import { CLASSES } from "../core/classes";
import { creerTexturesPlaceholder } from "../game/art";
import {
  comparer,
  decrire,
  resumer,
  type Emplacement,
  type Sauvegarde,
} from "../core/sauvegarde";
import { EMPLACEMENTS } from "../core/sauvegarde";
import { ecrireEnLocal, effacerEnLocal, inventaire } from "../game/sauvegarde";
import { ADRESSE_DU_SITE, seConnecter, seDeconnecter, sessionCourante } from "../en-ligne/compte";
import { enLigneConfigure } from "../en-ligne/client";
import { charger, effacer as effacerCloud } from "../en-ligne/sauvegardeCloud";

/**
 * L'ecran de depart : les trois emplacements, et le compte (DESIGN.md §4.28).
 *
 * ⚠️ **Le compte est une option, jamais une porte d'entree.** Cet ecran est
 * jouable de bout en bout sans reseau : les trois emplacements viennent du
 * `localStorage`, ils s'affichent immediatement, et la copie cloud ne fait que
 * venir se poser dessus quand — et si — elle arrive. Aucun `await` sur le
 * chemin d'affichage.
 */

const COULEURS = {
  fond: 0x1b1720,
  texte: "#f2e9d8",
  discret: "#8a8397",
  doux: "#c8bfae",
  accent: 0xd8a84a,
  alerte: "#ff6b5a",
  bon: "#7fc98a",
};

/** Un joueur qui a dit non ne doit pas etre relance : une fois par session. */
let relanceFaite = false;

type Mode = "emplacements" | "connexion" | "conflit";

export class MenuScene extends Phaser.Scene {
  private local = new Map<Emplacement, Sauvegarde | null>();
  private cloud = new Map<Emplacement, Sauvegarde | null>();
  private courriel: string | null = null;
  private mode: Mode = "emplacements";
  private message = "";

  /** Le conflit en cours d'arbitrage : le joueur tranche, jamais le code */
  private conflit: { emplacement: Emplacement; local: Sauvegarde; cloud: Sauvegarde } | null = null;

  /** La saisie clavier, du meme tonneau que le renommage de la fiche */
  private champs = { email: "", motDePasse: "" };
  private champActif: "email" | "motDePasse" = "email";
  private clavier: ((e: KeyboardEvent) => void) | null = null;
  private connexionEnCours = false;

  constructor() {
    super("menu");
  }

  create(): void {
    this.input.mouse?.disableContextMenu();
    // ⚠️ Avant de dessiner quoi que ce soit : `carte` est fabriquee au code, pas
    // chargee par le boot. Sans cet appel, le fond de cet ecran est le damier de
    // texture manquante de Phaser — vu en jouant, et invisible a la
    // compilation. C'est le meme piege qu'a l'ecran de choix de classe.
    creerTexturesPlaceholder(this);
    this.local = inventaire();
    this.construire();

    // Le compte se regarde **a cote**, jamais avant l'affichage.
    void this.retrouverLaSession();

    const redessiner = () => this.construire();
    this.scale.on("resize", redessiner);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", redessiner);
      this.arreterLaSaisie();
    });
  }

  // ------------------------------------------------------------------ compte

  private async retrouverLaSession(): Promise<void> {
    const session = await sessionCourante();
    if (!session) return;

    this.courriel = session.user.email ?? "connecte";
    await this.rapatrierLesCopies();
    if (this.scene.isActive()) this.construire();
  }

  /** Va chercher les copies cloud des trois emplacements. Sans jamais bloquer. */
  private async rapatrierLesCopies(): Promise<void> {
    for (const emplacement of EMPLACEMENTS) {
      this.cloud.set(emplacement, await charger(emplacement));
    }
  }

  // --------------------------------------------------------------- affichage

  private construire(): void {
    this.children.removeAll();
    this.add.tileSprite(0, 0, this.scale.width, this.scale.height, "carte")
      .setOrigin(0)
      .setAlpha(0.25);

    this.add
      .text(this.scale.width / 2, this.scale.height * 0.12, "LE PROTECTEUR", {
        fontFamily: "monospace",
        fontSize: "34px",
        color: COULEURS.texte,
      })
      .setOrigin(0.5);

    if (this.mode === "connexion") this.ecranConnexion();
    else if (this.mode === "conflit") this.ecranConflit();
    else this.ecranEmplacements();
  }

  private ecranEmplacements(): void {
    const l = this.scale.width;
    const h = this.scale.height;

    this.add
      .text(l / 2, h * 0.12 + 34, "Choisis un emplacement.", {
        fontFamily: "monospace",
        fontSize: "13px",
        color: COULEURS.doux,
      })
      .setOrigin(0.5);

    const largeur = 260;
    const hauteur = 150;
    const espace = 16;
    const total = EMPLACEMENTS.length * largeur + (EMPLACEMENTS.length - 1) * espace;
    const debut = l / 2 - total / 2;

    EMPLACEMENTS.forEach((emplacement, i) => {
      this.carteEmplacement(emplacement, debut + i * (largeur + espace), h * 0.28, largeur, hauteur);
    });

    this.barreDeCompte(h * 0.28 + hauteur + 40);

    if (this.message) {
      this.add
        .text(l / 2, h - 54, this.message, {
          fontFamily: "monospace",
          fontSize: "12px",
          color: COULEURS.doux,
          align: "center",
          wordWrap: { width: l - 80 },
        })
        .setOrigin(0.5);
    }

    this.add
      .text(l / 2, h - 24, "Touches 1 a 3", {
        fontFamily: "monospace",
        fontSize: "12px",
        color: COULEURS.discret,
      })
      .setOrigin(0.5);

    const clavier = this.input.keyboard;
    if (clavier) {
      const codes = [
        Phaser.Input.Keyboard.KeyCodes.ONE,
        Phaser.Input.Keyboard.KeyCodes.TWO,
        Phaser.Input.Keyboard.KeyCodes.THREE,
      ];
      codes.forEach((code, i) => {
        const emplacement = EMPLACEMENTS[i];
        if (emplacement) clavier.addKey(code).once("down", () => this.ouvrir(emplacement));
      });
    }
  }

  private carteEmplacement(
    emplacement: Emplacement,
    x: number,
    y: number,
    largeur: number,
    hauteur: number,
  ): void {
    const partie = this.local.get(emplacement) ?? null;
    const enLigne = this.cloud.get(emplacement) ?? null;
    const meilleure = partie ?? enLigne;

    const fond = this.add.graphics();
    fond.fillStyle(COULEURS.fond, 0.92);
    fond.fillRoundedRect(x, y, largeur, hauteur, 8);
    fond.lineStyle(2, meilleure ? COULEURS.accent : 0x4a4152, 1);
    fond.strokeRoundedRect(x, y, largeur, hauteur, 8);

    this.add.text(x + 16, y + 14, `${emplacement}. Emplacement ${emplacement}`, {
      fontFamily: "monospace",
      fontSize: "14px",
      color: COULEURS.texte,
    });

    if (!meilleure) {
      this.add.text(x + 16, y + 48, "Vide\n\nNouvelle partie", {
        fontFamily: "monospace",
        fontSize: "12px",
        color: COULEURS.discret,
        lineSpacing: 2,
      });
    } else {
      const resume = resumer(meilleure);
      const classe = resume.classe ? CLASSES[resume.classe]?.nom ?? resume.classe : "—";
      const lignes = [
        `Jour ${resume.jour} (${resume.phase})`,
        `${resume.population} habitant${resume.population > 1 ? "s" : ""}`,
        classe,
        decrire(resume, Date.now()).split(", ").pop() ?? "",
      ];
      this.add.text(x + 16, y + 44, lignes.join("\n"), {
        fontFamily: "monospace",
        fontSize: "12px",
        color: COULEURS.doux,
        lineSpacing: 4,
      });

      if (enLigne && partie) {
        const divergence = comparer(partie, enLigne).genre;
        if (divergence === "conflit") {
          this.add.text(x + 16, y + hauteur - 42, "Deux versions differentes", {
            fontFamily: "monospace",
            fontSize: "11px",
            color: COULEURS.alerte,
          });
        }
      } else if (enLigne && !partie) {
        this.add.text(x + 16, y + hauteur - 42, "Depuis ton compte", {
          fontFamily: "monospace",
          fontSize: "11px",
          color: COULEURS.bon,
        });
      }

      // Effacer est **explicite et separe** : le clic principal joue, il ne
      // detruit jamais quarante heures par erreur.
      this.add
        .text(x + largeur - 16, y + 14, "effacer", {
          fontFamily: "monospace",
          fontSize: "11px",
          color: COULEURS.discret,
        })
        .setOrigin(1, 0)
        .setInteractive({ useHandCursor: true })
        .on("pointerdown", (p: Phaser.Input.Pointer, _x: number, _y: number, evenement: Phaser.Types.Input.EventData) => {
          evenement.stopPropagation();
          this.effacer(emplacement);
        });
    }

    this.add
      .zone(x, y + 30, largeur, hauteur - 30)
      .setOrigin(0)
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", () => this.ouvrir(emplacement));
  }

  private barreDeCompte(y: number): void {
    const l = this.scale.width;

    if (!enLigneConfigure()) {
      this.add
        .text(l / 2, y, "Mode hors ligne : tes parties restent sur cet appareil.", {
          fontFamily: "monospace",
          fontSize: "12px",
          color: COULEURS.discret,
        })
        .setOrigin(0.5);
      return;
    }

    if (this.courriel) {
      this.add
        .text(l / 2, y, `Connecte : ${this.courriel}`, {
          fontFamily: "monospace",
          fontSize: "12px",
          color: COULEURS.bon,
        })
        .setOrigin(0.5);
      this.lien(l / 2, y + 24, "Se deconnecter", () => void this.deconnecter());
      return;
    }

    this.add
      .text(l / 2, y, "Tu joues sans compte. Ta partie est enregistree sur cet appareil.", {
        fontFamily: "monospace",
        fontSize: "12px",
        color: COULEURS.doux,
      })
      .setOrigin(0.5);
    this.lien(l / 2, y + 26, "Se connecter avec un compte The Circle", () => {
      relanceFaite = true;
      this.mode = "connexion";
      this.message = "";
      this.construire();
      this.commencerLaSaisie();
    });
  }

  private lien(x: number, y: number, texte: string, action: () => void): Phaser.GameObjects.Text {
    return this.add
      .text(x, y, texte, {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#d8a84a",
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", action);
  }

  // -------------------------------------------------------------- connexion

  private ecranConnexion(): void {
    const l = this.scale.width;
    const h = this.scale.height;
    const largeur = 380;
    const x = l / 2 - largeur / 2;
    const y = h * 0.28;

    const fond = this.add.graphics();
    fond.fillStyle(COULEURS.fond, 0.94);
    fond.fillRoundedRect(x, y, largeur, 230, 8);
    fond.lineStyle(2, COULEURS.accent, 1);
    fond.strokeRoundedRect(x, y, largeur, 230, 8);

    this.add.text(x + 20, y + 18, "Compte The Circle", {
      fontFamily: "monospace",
      fontSize: "15px",
      color: COULEURS.texte,
    });
    this.add.text(x + 20, y + 42, "Le jeu ne cree pas de compte : il s'y connecte.", {
      fontFamily: "monospace",
      fontSize: "11px",
      color: COULEURS.discret,
      wordWrap: { width: largeur - 40 },
    });

    this.champ(x + 20, y + 78, largeur - 40, "Adresse", this.champs.email, "email");
    this.champ(
      x + 20,
      y + 128,
      largeur - 40,
      "Mot de passe",
      "*".repeat(this.champs.motDePasse.length),
      "motDePasse",
    );

    if (this.message) {
      this.add.text(x + 20, y + 176, this.message, {
        fontFamily: "monospace",
        fontSize: "11px",
        color: this.connexionEnCours ? COULEURS.doux : COULEURS.alerte,
        wordWrap: { width: largeur - 40 },
      });
    }

    this.add
      .text(l / 2, y + 250, "Entree pour se connecter — Tab change de champ", {
        fontFamily: "monospace",
        fontSize: "11px",
        color: COULEURS.discret,
      })
      .setOrigin(0.5);

    this.lien(l / 2, y + 276, "Jouer sans compte", () => {
      this.arreterLaSaisie();
      this.mode = "emplacements";
      this.message = "";
      this.construire();
    });

    this.lien(l / 2, y + 300, `Creer un compte sur ${ADRESSE_DU_SITE}`, () => {
      window.open(ADRESSE_DU_SITE, "_blank", "noopener");
    });
  }

  private champ(
    x: number,
    y: number,
    largeur: number,
    etiquette: string,
    valeur: string,
    lequel: "email" | "motDePasse",
  ): void {
    const actif = this.champActif === lequel;

    this.add.text(x, y, etiquette, {
      fontFamily: "monospace",
      fontSize: "11px",
      color: COULEURS.discret,
    });

    const cadre = this.add.graphics();
    cadre.fillStyle(0x0f0d14, 1);
    cadre.fillRoundedRect(x, y + 16, largeur, 26, 4);
    cadre.lineStyle(1, actif ? COULEURS.accent : 0x4a4152, 1);
    cadre.strokeRoundedRect(x, y + 16, largeur, 26, 4);

    this.add.text(x + 8, y + 23, `${valeur}${actif ? "_" : ""}`, {
      fontFamily: "monospace",
      fontSize: "12px",
      color: COULEURS.texte,
    });

    this.add
      .zone(x, y + 16, largeur, 26)
      .setOrigin(0)
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", () => {
        this.champActif = lequel;
        this.construire();
      });
  }

  /**
   * La saisie, reprise telle quelle de la fiche de personnage : Phaser n'a pas
   * de champ de texte, et activer la couche DOM du moteur pour deux champs
   * couterait plus cher que ces trente lignes.
   */
  private commencerLaSaisie(): void {
    if (this.clavier) return;

    this.clavier = (e: KeyboardEvent) => {
      if (this.mode !== "connexion" || this.connexionEnCours) return;
      e.preventDefault();

      if (e.key === "Enter") {
        void this.connecter();
        return;
      }
      if (e.key === "Escape") {
        this.arreterLaSaisie();
        this.mode = "emplacements";
        this.construire();
        return;
      }
      if (e.key === "Tab") {
        this.champActif = this.champActif === "email" ? "motDePasse" : "email";
      } else if (e.key === "Backspace") {
        this.champs[this.champActif] = this.champs[this.champActif].slice(0, -1);
      } else if (e.key.length === 1) {
        if (this.champs[this.champActif].length < 80) this.champs[this.champActif] += e.key;
      } else {
        return;
      }
      this.construire();
    };

    window.addEventListener("keydown", this.clavier, true);
  }

  private arreterLaSaisie(): void {
    if (this.clavier) window.removeEventListener("keydown", this.clavier, true);
    this.clavier = null;
  }

  private async connecter(): Promise<void> {
    if (this.connexionEnCours) return;
    if (!this.champs.email || !this.champs.motDePasse) {
      this.message = "Il manque l'adresse ou le mot de passe.";
      this.construire();
      return;
    }

    this.connexionEnCours = true;
    this.message = "Connexion...";
    this.construire();

    const resultat = await seConnecter(this.champs.email, this.champs.motDePasse);
    this.connexionEnCours = false;

    if (!resultat.ok) {
      this.message = resultat.message;
      this.construire();
      return;
    }

    this.courriel = resultat.session.user.email ?? "connecte";
    this.champs = { email: "", motDePasse: "" };
    this.arreterLaSaisie();
    this.mode = "emplacements";
    this.message = "Connecte. On va chercher tes parties en ligne...";
    this.construire();

    await this.rapatrierLesCopies();
    this.message = "";
    if (this.scene.isActive()) this.construire();
  }

  private async deconnecter(): Promise<void> {
    await seDeconnecter();
    this.courriel = null;
    this.cloud.clear();
    this.message = "Deconnecte. Tes parties restent sur cet appareil.";
    this.construire();
  }

  // ---------------------------------------------------------------- conflits

  private ouvrir(emplacement: Emplacement): void {
    const local = this.local.get(emplacement) ?? null;
    const enLigne = this.cloud.get(emplacement) ?? null;
    const divergence = comparer(local, enLigne);

    switch (divergence.genre) {
      case "rien":
        this.nouvellePartie(emplacement);
        return;
      case "cloud-seul":
        // Rien a perdre ici : il n'y a pas de partie locale a ecraser.
        this.reprendre(emplacement, enLigne!, true);
        return;
      case "conflit":
        this.conflit = { emplacement, local: local!, cloud: enLigne! };
        this.mode = "conflit";
        this.construire();
        return;
      default:
        this.reprendre(emplacement, local!, false);
    }
  }

  /**
   * L'arbitrage (§4.28).
   *
   * ⚠️ **On n'ecrase jamais une partie automatiquement.** Le « plus recent
   * gagne » est exactement ce qui fait perdre sa partie a quelqu'un qui a joue
   * hors ligne sur un autre poste. Deux phrases, deux boutons, et c'est lui qui
   * decide.
   */
  private ecranConflit(): void {
    const conflit = this.conflit;
    if (!conflit) {
      this.mode = "emplacements";
      return;
    }

    const l = this.scale.width;
    const h = this.scale.height;

    this.add
      .text(l / 2, h * 0.24, "Deux parties differentes sur cet emplacement", {
        fontFamily: "monospace",
        fontSize: "16px",
        color: COULEURS.texte,
      })
      .setOrigin(0.5);

    this.add
      .text(l / 2, h * 0.24 + 26, "Laquelle garder ? L'autre sera remplacee.", {
        fontFamily: "monospace",
        fontSize: "12px",
        color: COULEURS.alerte,
      })
      .setOrigin(0.5);

    const largeur = 300;
    const hauteur = 120;
    const y = h * 0.36;

    this.carteChoix(
      l / 2 - largeur - 10,
      y,
      largeur,
      hauteur,
      "Ici, sur cet appareil",
      conflit.local,
      () => this.reprendre(conflit.emplacement, conflit.local, false),
    );
    this.carteChoix(
      l / 2 + 10,
      y,
      largeur,
      hauteur,
      "En ligne, sur ton compte",
      conflit.cloud,
      () => this.reprendre(conflit.emplacement, conflit.cloud, true),
    );

    this.lien(l / 2, y + hauteur + 40, "Revenir en arriere", () => {
      this.conflit = null;
      this.mode = "emplacements";
      this.construire();
    });
  }

  private carteChoix(
    x: number,
    y: number,
    largeur: number,
    hauteur: number,
    titre: string,
    sauvegarde: Sauvegarde,
    action: () => void,
  ): void {
    const fond = this.add.graphics();
    fond.fillStyle(COULEURS.fond, 0.94);
    fond.fillRoundedRect(x, y, largeur, hauteur, 8);
    fond.lineStyle(2, COULEURS.accent, 1);
    fond.strokeRoundedRect(x, y, largeur, hauteur, 8);

    this.add.text(x + 16, y + 14, titre, {
      fontFamily: "monospace",
      fontSize: "13px",
      color: COULEURS.texte,
    });
    this.add.text(x + 16, y + 44, decrire(resumer(sauvegarde), Date.now()), {
      fontFamily: "monospace",
      fontSize: "12px",
      color: COULEURS.doux,
      wordWrap: { width: largeur - 32 },
      lineSpacing: 4,
    });

    this.add
      .zone(x, y, largeur, hauteur)
      .setOrigin(0)
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", action);
  }

  // ----------------------------------------------------------------- lancer

  /**
   * Effacer efface **partout** (§4.28).
   *
   * N'effacer qu'en local laisserait la copie cloud reproposer la partie au
   * chargement suivant : le joueur aurait demande la suppression d'un
   * emplacement et le verrait revenir. C'est le meme emplacement, c'est la meme
   * partie, elle s'en va des deux cotes.
   */
  private effacer(emplacement: Emplacement): void {
    effacerEnLocal(emplacement);
    this.local.set(emplacement, null);
    if (this.courriel) {
      void effacerCloud(emplacement);
      this.cloud.set(emplacement, null);
    }
    this.message = `Emplacement ${emplacement} efface.`;
    this.construire();
  }

  private nouvellePartie(emplacement: Emplacement): void {
    this.arreterLaSaisie();
    this.scene.start("choix-classe", { emplacement });
  }

  private reprendre(emplacement: Emplacement, sauvegarde: Sauvegarde, venuDuCloud: boolean): void {
    this.arreterLaSaisie();
    // Ce qu'on reprend devient la sauvegarde locale : c'est elle la reference,
    // et la partie qui suit doit repartir de la (§4.28).
    if (venuDuCloud) ecrireEnLocal(emplacement, sauvegarde);
    this.scene.start("arena", {
      classe: sauvegarde.heros[sauvegarde.incarne]?.classe ?? "guerrier",
      emplacement,
      reprise: sauvegarde,
    });
  }
}

/** A-t-on deja propose le compte a ce joueur ? (§4.28 : une fois, pas deux) */
export function relanceDejaFaite(): boolean {
  return relanceFaite;
}
