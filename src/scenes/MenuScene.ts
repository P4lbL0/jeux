import Phaser from "phaser";
import { CLASSES } from "../core/classes";
import { creerTexturesPlaceholder } from "../game/art";
import {
  comparer,
  ilYA,
  resumer,
  type Emplacement,
  type Sauvegarde,
} from "../core/sauvegarde";
import { EMPLACEMENTS } from "../core/sauvegarde";
import { ecrireEnLocal, effacerEnLocal, inventaire } from "../game/sauvegarde";
import { ADRESSE_DU_SITE, seConnecter, seDeconnecter, sessionCourante } from "../en-ligne/compte";
import { enLigneConfigure } from "../en-ligne/client";
import { charger, effacer as effacerCloud } from "../en-ligne/sauvegardeCloud";
import {
  C,
  T,
  HAUTEUR_TITRE,
  POLICE,
  barreDeTitre,
  cadre,
  creux,
  espacer,
  titreDuJeu,
  yTitre,
  type Plaque,
} from "../game/ui/chrome";

/**
 * L'ecran de depart : les trois emplacements, et le compte (DESIGN.md §4.28).
 *
 * ⚠️ **Le compte est une option, jamais une porte d'entree.** Cet ecran est
 * jouable de bout en bout sans reseau : les trois emplacements viennent du
 * `localStorage`, ils s'affichent immediatement, et la copie cloud ne fait que
 * venir se poser dessus quand — et si — elle arrive. Aucun `await` sur le
 * chemin d'affichage.
 */

/**
 * ⚠️ Cet ecran avait sa propre palette, dont un troisieme dore (`#d8a84a`). Elle
 * a disparu : tout vient de `game/ui/chrome.ts` (§4.10).
 *
 * **Les trois etats du reseau tiennent en trois couleurs et pas une de plus** :
 * hors ligne en os mat, connecte en bile, refuse en sang frais. Ils venaient de
 * trois endroits differents et ne se ressemblaient pas.
 */
const COULEURS = {
  texte: T.os,
  discret: T.osMat,
  doux: T.os,
  alerte: T.sangFrais,
  bon: T.bile,
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
    // ⚠️ **Le premier ecran du jeu est pose sur de l'herbe**, et c'est voulu :
    // c'est ce qui fait que le menu appartient au jeu. Ce qui n'etait pas voulu,
    // c'est qu'on ecrive du texte dessus sans fond. Les plaques qui suivent sont
    // opaques, comme partout ailleurs (§4.10).
    this.add.tileSprite(0, 0, this.scale.width, this.scale.height, "carte")
      .setOrigin(0)
      .setAlpha(0.5);
    // Un voile de fer par-dessus : sans lui, l'herbe saturee de midi tire tout
    // l'ecran vers le vert et le titre perd son ombre de sang. Trop epais, en
    // revanche, et le monde disparait — or c'est lui qui fait que ce menu
    // appartient au jeu (§4.10). Vu sur une capture : 0,55 sur 0,22 d'herbe ne
    // laissait plus qu'un fond noir.
    const voile = this.add.graphics();
    voile.fillStyle(C.fer, 0.42);
    voile.fillRect(0, 0, this.scale.width, this.scale.height);

    titreDuJeu(this, this.scale.width / 2, this.scale.height * 0.12);

    if (this.mode === "connexion") this.ecranConnexion();
    else if (this.mode === "conflit") this.ecranConflit();
    else this.ecranEmplacements();
  }

  private ecranEmplacements(): void {
    const l = this.scale.width;
    const h = this.scale.height;

    this.add
      .text(l / 2, h * 0.12 + 40, "Choisis un emplacement.", {
        fontFamily: POLICE,
        fontSize: "13px",
        color: COULEURS.discret,
      })
      .setOrigin(0.5);

    const largeur = 268;
    const hauteur = 168;
    const espace = 16;
    const total = EMPLACEMENTS.length * largeur + (EMPLACEMENTS.length - 1) * espace;
    const debut = l / 2 - total / 2;

    // Celui qui est le plus avance porte le liseré de sang : c'est celui qu'on
    // reprend neuf fois sur dix, et il doit se trouver sans lire (§4.10).
    let leplusAvance: Emplacement | null = null;
    let meilleurJour = -1;
    for (const emplacement of EMPLACEMENTS) {
      const partie = this.local.get(emplacement) ?? this.cloud.get(emplacement) ?? null;
      if (partie && partie.cycle.jour > meilleurJour) {
        meilleurJour = partie.cycle.jour;
        leplusAvance = emplacement;
      }
    }

    EMPLACEMENTS.forEach((emplacement, i) => {
      this.carteEmplacement(
        emplacement,
        debut + i * (largeur + espace),
        h * 0.28,
        largeur,
        hauteur,
        emplacement === leplusAvance,
      );
    });

    this.barreDeCompte(h * 0.28 + hauteur + 40);

    if (this.message) {
      this.add
        .text(l / 2, h - 54, this.message, {
          fontFamily: POLICE,
          fontSize: "12px",
          color: COULEURS.doux,
          align: "center",
          wordWrap: { width: l - 80 },
        })
        .setOrigin(0.5);
    }

    this.add
      .text(l / 2, h - 24, "Touches 1 a 3", {
        fontFamily: POLICE,
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

  /**
   * Un emplacement : une plaque de fer (§4.10).
   *
   * ⚠️ **Un emplacement occupe n'est jamais « charge », il est REPRIS** — et le
   * mot doit le dire, parce qu'il n'y a pas de retour en arriere. La regle
   * ironman (§4.28) ecrase la sauvegarde aux moments-cles, mort comprise :
   * reprendre une partie, c'est accepter de continuer celle-la, pas en ouvrir
   * une copie.
   */
  private carteEmplacement(
    emplacement: Emplacement,
    x: number,
    y: number,
    largeur: number,
    hauteur: number,
    leplusAvance: boolean,
  ): void {
    const partie = this.local.get(emplacement) ?? null;
    const enLigne = this.cloud.get(emplacement) ?? null;
    const meilleure = partie ?? enLigne;

    const fond = this.add.graphics();
    const plaque: Plaque = { x, y, largeur, hauteur };
    cadre(fond, plaque, leplusAvance);
    barreDeTitre(fond, plaque);

    this.add.text(x + 12, yTitre(plaque), espacer(`EMPLACEMENT ${emplacement}`), {
      fontFamily: POLICE,
      fontSize: "11px",
      color: T.titre,
    });

    const corps = y + HAUTEUR_TITRE + 14;

    if (!meilleure) {
      this.add
        .text(x + largeur / 2, corps + 34, "NOUVELLE PARTIE", {
          fontFamily: POLICE,
          fontSize: "14px",
          color: T.laiton,
        })
        .setOrigin(0.5);
      this.add
        .text(x + largeur / 2, corps + 58, "du fer nu, et personne dessus", {
          fontFamily: POLICE,
          fontSize: "10px",
          color: COULEURS.discret,
        })
        .setOrigin(0.5);
    } else {
      const resume = resumer(meilleure);
      const classe = resume.classe ? CLASSES[resume.classe]?.nom ?? resume.classe : "—";

      // Des chiffres tabulaires, alignes : c'est ce qui permet de comparer trois
      // emplacements d'un coup d'oeil au lieu de lire trois phrases.
      const lignes: [string, string][] = [
        ["jour", `${resume.jour}`],
        ["effectif", `${resume.population} au village, ${resume.herosVivants} heros`],
        ["classe", classe],
        ["derniere fois", ilYA(resume.horodatage, Date.now())],
      ];
      lignes.forEach(([etiquette, valeur], i) => {
        const cy = corps + i * 18;
        this.add.text(x + 14, cy, etiquette, {
          fontFamily: POLICE,
          fontSize: "10px",
          color: COULEURS.discret,
        });
        this.add.text(x + 104, cy, valeur, {
          fontFamily: POLICE,
          fontSize: "11px",
          color: COULEURS.texte,
        });
      });

      // Le mot qui compte. En laiton, parce que c'est lui qu'on clique.
      this.add
        .text(x + largeur / 2, y + hauteur - 42, "REPRENDRE", {
          fontFamily: POLICE,
          fontSize: "13px",
          color: T.laiton,
        })
        .setOrigin(0.5);
      this.add
        .text(x + largeur / 2, y + hauteur - 24, "on ne recommence pas une partie reprise", {
          fontFamily: POLICE,
          fontSize: "9px",
          color: COULEURS.discret,
        })
        .setOrigin(0.5);

      if (enLigne && partie) {
        const divergence = comparer(partie, enLigne).genre;
        if (divergence === "conflit") {
          this.add.text(x + 14, corps + 76, "deux versions differentes", {
            fontFamily: POLICE,
            fontSize: "10px",
            color: COULEURS.alerte,
          });
        }
      } else if (enLigne && !partie) {
        this.add.text(x + 14, corps + 76, "depuis ton compte", {
          fontFamily: POLICE,
          fontSize: "10px",
          color: COULEURS.bon,
        });
      }

      // Effacer est **explicite et separe** : le clic principal joue, il ne
      // detruit jamais quarante heures par erreur.
      this.add
        .text(x + largeur - 12, yTitre(plaque), "effacer", {
          fontFamily: POLICE,
          fontSize: "10px",
          color: T.titre,
        })
        .setOrigin(1, 0)
        .setInteractive({ useHandCursor: true })
        .on(
          "pointerdown",
          (
            _p: Phaser.Input.Pointer,
            _x: number,
            _y: number,
            evenement: Phaser.Types.Input.EventData,
          ) => {
            evenement.stopPropagation();
            this.effacer(emplacement);
          },
        );
    }

    this.add
      .zone(x, y + HAUTEUR_TITRE, largeur, hauteur - HAUTEUR_TITRE)
      .setOrigin(0)
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", () => this.ouvrir(emplacement));
  }

  private barreDeCompte(y: number): void {
    const l = this.scale.width;

    if (!enLigneConfigure()) {
      this.add
        .text(l / 2, y, "Hors ligne — tes parties restent sur cet appareil.", {
          fontFamily: POLICE,
          fontSize: "12px",
          color: COULEURS.discret,
        })
        .setOrigin(0.5);
      return;
    }

    if (this.courriel) {
      this.add
        .text(l / 2, y, `Connecte — ${this.courriel}`, {
          fontFamily: POLICE,
          fontSize: "12px",
          color: COULEURS.bon,
        })
        .setOrigin(0.5);
      this.lien(l / 2, y + 24, "Se deconnecter", () => void this.deconnecter());
      return;
    }

    this.add
      .text(l / 2, y, "Tu joues sans compte. Ta partie est enregistree sur cet appareil.", {
        fontFamily: POLICE,
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
        fontFamily: POLICE,
        fontSize: "12px",
        color: T.laiton,
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
    const plaque: Plaque = { x, y, largeur, hauteur: 232 };
    cadre(fond, plaque);
    barreDeTitre(fond, plaque);

    this.add.text(x + 14, yTitre(plaque), espacer("COMPTE THE CIRCLE"), {
      fontFamily: POLICE,
      fontSize: "11px",
      color: T.titre,
    });
    // « Le jeu ne cree pas de compte : il s'y connecte » reste tel quel, c'est
    // la bonne phrase — elle dit en une ligne pourquoi il n'y a pas de bouton
    // d'inscription, et le §4.28 y tient.
    this.add.text(x + 20, y + 44, "Le jeu ne cree pas de compte : il s'y connecte.", {
      fontFamily: POLICE,
      fontSize: "11px",
      color: COULEURS.discret,
      wordWrap: { width: largeur - 40 },
    });

    this.champ(x + 20, y + 82, largeur - 40, "Adresse", this.champs.email, "email");
    this.champ(
      x + 20,
      y + 132,
      largeur - 40,
      "Mot de passe",
      "*".repeat(this.champs.motDePasse.length),
      "motDePasse",
    );

    if (this.message) {
      this.add.text(x + 20, y + 184, this.message, {
        fontFamily: POLICE,
        fontSize: "11px",
        color: this.connexionEnCours ? COULEURS.doux : COULEURS.alerte,
        wordWrap: { width: largeur - 40 },
      });
    }

    this.add
      .text(l / 2, y + 258, "Entree pour se connecter — Tab change de champ", {
        fontFamily: POLICE,
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

    this.add.text(x, y, espacer(etiquette.toUpperCase()), {
      fontFamily: POLICE,
      fontSize: "10px",
      color: COULEURS.discret,
    });

    // Le meme cadre en creux que partout ailleurs, et le curseur en laiton.
    const champ = this.add.graphics();
    creux(champ, { x, y: y + 16, largeur, hauteur: 26 });
    if (actif) {
      champ.lineStyle(1, C.laiton, 1);
      champ.strokeRect(x - 0.5, y + 15.5, largeur + 1, 27);
    }

    this.add.text(x + 8, y + 23, valeur, {
      fontFamily: POLICE,
      fontSize: "12px",
      color: COULEURS.texte,
    });
    if (actif) {
      // Le curseur clignote : sans lui, on ne sait pas dans quel champ on tape.
      const curseur = this.add.text(x + 8 + valeur.length * 7.2, y + 23, "_", {
        fontFamily: POLICE,
        fontSize: "12px",
        color: T.laiton,
      });
      this.tweens.add({
        targets: curseur,
        alpha: 0,
        duration: 480,
        yoyo: true,
        repeat: -1,
      });
    }

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
        fontFamily: POLICE,
        fontSize: "16px",
        color: COULEURS.texte,
      })
      .setOrigin(0.5);

    // ⚠️ **Le seul ecran du jeu ou le joueur arbitre une perte de donnees.** La
    // phrase est en sang frais parce que c'en est une, et les deux plaques sont
    // identiques : aucune n'est presentee comme la bonne, aucune n'est un bouton
    // « valider » qu'on clique sans lire. Il ne doit pas etre possible de
    // cliquer vite.
    this.add
      .text(l / 2, h * 0.24 + 28, "Laquelle garder ? L'autre sera remplacee, sans retour.", {
        fontFamily: POLICE,
        fontSize: "12px",
        color: COULEURS.alerte,
      })
      .setOrigin(0.5);

    const largeur = 330;
    const hauteur = 150;
    const y = h * 0.36;

    this.carteChoix(
      l / 2 - largeur - 12,
      y,
      largeur,
      hauteur,
      "ICI, SUR CET APPAREIL",
      conflit.local,
      () => this.reprendre(conflit.emplacement, conflit.local, false),
    );
    this.carteChoix(
      l / 2 + 12,
      y,
      largeur,
      hauteur,
      "EN LIGNE, SUR TON COMPTE",
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
    const plaque: Plaque = { x, y, largeur, hauteur };
    // Pas de liseré de sang ici, ni d'un cote ni de l'autre : il veut dire « le
    // plus avance » sur l'ecran precedent, et il designerait un gagnant.
    cadre(fond, plaque);
    barreDeTitre(fond, plaque);

    this.add.text(x + 14, yTitre(plaque), espacer(titre), {
      fontFamily: POLICE,
      fontSize: "11px",
      color: T.titre,
    });

    const resume = resumer(sauvegarde);
    const lignes: [string, string][] = [
      ["jour", `${resume.jour}`],
      ["effectif", `${resume.population} au village, ${resume.herosVivants} heros`],
      ["derniere fois", ilYA(resume.horodatage, Date.now())],
    ];
    lignes.forEach(([etiquette, valeur], i) => {
      const cy = y + HAUTEUR_TITRE + 16 + i * 20;
      this.add.text(x + 14, cy, etiquette, {
        fontFamily: POLICE,
        fontSize: "10px",
        color: COULEURS.discret,
      });
      this.add.text(x + 116, cy, valeur, {
        fontFamily: POLICE,
        fontSize: "12px",
        color: COULEURS.texte,
      });
    });

    this.add
      .text(x + largeur / 2, y + hauteur - 30, "GARDER CELLE-CI", {
        fontFamily: POLICE,
        fontSize: "12px",
        color: T.laiton,
      })
      .setOrigin(0.5);

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
