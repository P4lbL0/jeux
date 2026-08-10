import Phaser from "phaser";
import { COULEURS_RANG } from "../core/classes";
import { competenceParId } from "../core/competences";
import { ETATS, lireEtat } from "../core/etats";
import {
  NOMS_METIER,
  NOMS_POSTURE_CIVILE,
  cadence,
  combatDe,
  plafondDeNiveau,
} from "../core/habitants";
import { EFFETS_RUPTURE, NOMS_RUPTURE, REGLAGES_STRESS, type Personne } from "../core/personne";
import { poser, reponseA, traitsVisibles, type Arrivant } from "../core/arrivants";
import { sequelleParId, traitParId } from "../core/traits";
import { portraitDe, TAILLE_PORTRAIT } from "./portraits";
import type { Hero } from "./entities";
import type { Villageois } from "./village";

/**
 * **Une seule fiche pour tout le monde** (DESIGN.md §4.10).
 *
 * Heros et habitants partagent ce panneau, ouvert en cliquant un portrait de la
 * barre d'equipe ou une ligne du tableau du village. Les sections apparaissent
 * selon ce que le personnage **est** : un habitant n'a pas de competences, un
 * heros n'a pas de metier, et les deux ont des traits, des etats et du stress.
 *
 * > **Pourquoi une seule fiche et pas deux.** Deux panneaux, c'est deux codes
 * > d'interface a faire evoluer en parallele pour toujours, et ils divergeront.
 * > Et surtout : depuis le bloc 5, traits et etats concernent **les deux
 * > populations** — la moitie du panneau aurait ete dupliquee des le premier
 * > jour.
 *
 * ⚠️ Elle **annule la vieille regle du §4.18** qui interdisait le second ecran
 * de personnage. Le §4.18 a ete reecrit pour le dire au lieu de le taire : la
 * raison qui l'emporte est que les futurs heros sortent du village (jalon 9).
 */

const LARGEUR = 560;

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

/**
 * Qui la fiche montre.
 *
 * Une union plutot qu'un objet a champs optionnels : c'est ce qui garantit
 * qu'on ne lira jamais la cadence d'un heros ni les competences d'un fermier.
 */
export type SujetFiche =
  | { genre: "hero"; hero: Hero; groupe: GroupeAffiche; surIncarner: () => void }
  | { genre: "habitant"; villageois: Villageois }
  /**
   * La fiche d'observation, a la porte (§4.10, §4.18).
   *
   * **C'est un mode de plus, pas une interface neuve** : l'identite, les
   * statistiques et les traits sont exactement les memes objets, dessines par
   * le meme code. Seules trois choses changent — les observations, les
   * questions, et deux boutons au lieu d'un.
   */
  | {
      genre: "arrivant";
      arrivant: Arrivant;
      surAccepter: () => void;
      surRefuser: () => void;
    };

/** La personne derriere le sujet, quel qu'il soit. */
function personneDe(sujet: SujetFiche): Personne {
  if (sujet.genre === "hero") return sujet.hero.personne;
  if (sujet.genre === "arrivant") return sujet.arrivant.personne;
  return sujet.villageois.personne;
}

const COULEURS = {
  fond: 0x1b1720,
  case: 0x2a2433,
  texte: "#f2e9d8",
  attenue: "#c8bfae",
  discret: "#8a8397",
  bon: "#7ee0a0",
  mauvais: "#ff8a7a",
  mixte: "#ffd98a",
} as const;

export class FichePersonne {
  private objets: Phaser.GameObjects.GameObject[] = [];
  private sujet: SujetFiche | null = null;

  /** Le nom en cours de frappe, ou null quand on ne renomme pas */
  private saisie: string | null = null;
  /** Vrai tant qu'on n'a rien tape : la premiere frappe efface l'ancien nom */
  private vierge = true;
  private champ: Phaser.GameObjects.Text | null = null;
  private clavier: ((e: KeyboardEvent) => void) | null = null;

  /**
   * @param surSaisie prevenu quand le renommage commence et s'arrete.
   *   ⚠️ Indispensable : sans ca, taper « Bertrand » sonnerait la cloche (B),
   *   ouvrirait le tableau du village (F) et batirait deux palissades (G).
   */
  constructor(
    private scene: Phaser.Scene,
    private surSaisie: (enCours: boolean) => void = () => {},
  ) {}

  get estOuverte(): boolean {
    return this.sujet !== null;
  }

  basculer(sujet: SujetFiche): void {
    if (this.sujet !== null) {
      this.fermer();
      return;
    }
    this.afficher(sujet);
  }

  afficher(sujet: SujetFiche): void {
    this.fermer();
    this.sujet = sujet;

    const personne = personneDe(sujet);
    const hauteur = this.hauteurVoulue(sujet, personne);
    const x = Math.round(this.scene.scale.width / 2 - LARGEUR / 2);
    const y = Math.max(10, Math.round(this.scene.scale.height / 2 - hauteur / 2));

    const accent =
      sujet.genre === "hero"
        ? sujet.hero.classe.couleur
        : sujet.genre === "arrivant"
          ? 0xd8a86a
          : 0x9ad17f;

    const voile = this.scene.add.graphics().setDepth(2600);
    voile.fillStyle(0x0d0b12, 0.62);
    voile.fillRect(0, 0, this.scene.scale.width, this.scene.scale.height);
    this.objets.push(voile);
    this.zone(0, 0, this.scene.scale.width, this.scene.scale.height, 2601, () => this.fermer());

    const cadre = this.scene.add.graphics().setDepth(2602);
    cadre.fillStyle(COULEURS.fond, 0.98);
    cadre.fillRoundedRect(x, y, LARGEUR, hauteur, 10);
    cadre.lineStyle(3, accent, 1);
    cadre.strokeRoundedRect(x, y, LARGEUR, hauteur, 10);
    this.objets.push(cadre);
    // Le clic a l'interieur ne referme pas la fiche.
    this.zone(x, y, LARGEUR, hauteur, 2603, () => {});

    let curseur = this.identite(cadre, sujet, personne, x, y, accent);
    curseur = this.statistiques(cadre, personne, x, curseur);
    // Un inconnu n'a ni stress ni etat a montrer : sa jauge est a zero et sa
    // liste est vide. Afficher un moral vide serait du bruit sur la seule fiche
    // qu'on lit vraiment ligne a ligne.
    if (sujet.genre !== "arrivant") curseur = this.moral(cadre, personne, x, curseur);
    curseur = this.traits(cadre, personne, x, curseur, sujet);

    if (sujet.genre === "hero") {
      curseur = this.combat(cadre, sujet.hero, x, curseur);
      curseur = this.equipe(cadre, sujet.groupe, x, curseur);
      curseur = this.competences(cadre, sujet.hero, x, curseur);
    } else if (sujet.genre === "arrivant") {
      curseur = this.observations(cadre, sujet.arrivant, x, curseur);
      curseur = this.interrogatoire(cadre, sujet, x, curseur);
    } else {
      curseur = this.metier(cadre, sujet.villageois, x, curseur);
    }

    this.boutons(cadre, sujet, x, y + hauteur - 44);
  }

  // ------------------------------------------------------------- sections

  /** Portrait, nom modifiable, rang et niveau — la seule section commune a tout. */
  private identite(
    cadre: Phaser.GameObjects.Graphics,
    sujet: SujetFiche,
    personne: Personne,
    x: number,
    y: number,
    accent: number,
  ): number {
    const vivant =
      sujet.genre === "hero"
        ? sujet.hero.etat !== "mort"
        : sujet.genre === "arrivant" || sujet.villageois.regles.vivant;

    // Le portrait est **assemble** (§4.23) : il change avec la personne, donc
    // il se redemande a chaque ouverture plutot que d'etre garde en champ.
    const cle = portraitDe(this.scene, personne, vivant);
    const echelle = 4;
    cadre.fillStyle(COULEURS.case, 1);
    cadre.fillRect(x + 20, y + 18, TAILLE_PORTRAIT.largeur * echelle, TAILLE_PORTRAIT.hauteur * echelle);
    const portrait = this.scene.add
      .image(x + 20, y + 18, cle)
      .setOrigin(0)
      .setScale(echelle)
      .setDepth(2604);
    this.objets.push(portrait);

    const gauche = x + 20 + TAILLE_PORTRAIT.largeur * echelle + 16;

    this.champ = this.texte(gauche, y + 20, personne.nom, 20, COULEURS.texte);
    // ⚠️ **On ne renomme pas a la porte** (§4.18) : « pas au moment de son
    // arrivee, on ne coupe pas le jeu pour demander un prenom a quelqu'un qui
    // n'a encore rien vecu ». Le renommage vient apres, quand celui-la est
    // devenu quelqu'un — donc la zone cliquable n'existe pas ici.
    if (sujet.genre !== "arrivant") {
      this.zone(gauche, y + 18, LARGEUR - (gauche - x) - 30, 26, 2606, () =>
        this.commencerLaSaisie(),
      );
    }

    const sous =
      sujet.genre === "hero"
        ? `${sujet.hero.classe.nom}  ·  niveau ${sujet.hero.niveau}`
        : sujet.genre === "arrivant"
          ? `il dit etre ${NOMS_METIER[sujet.arrivant.metierPretendu]}`
          : `${NOMS_METIER[sujet.villageois.regles.metier]}  ·  rang ${
              sujet.villageois.regles.rang
            }  ·  niveau ${sujet.villageois.regles.niveau}/${plafondDeNiveau(
              sujet.villageois.regles.rang,
            )}`;
    this.texte(gauche, y + 46, sous, 12, COULEURS.attenue);
    this.texte(
      gauche,
      y + 64,
      sujet.genre === "arrivant"
        ? "il attend a la porte"
        : "clic sur le nom pour renommer",
      9,
      COULEURS.discret,
    );

    // La barre de vie, commune elle aussi : un habitant en a une depuis le
    // bloc 4 (§4.18).
    const bl = LARGEUR - (gauche - x) - 30;
    if (sujet.genre === "hero") {
      const h = sujet.hero;
      this.barre(cadre, gauche, y + 82, bl, 12, h.ratioPv, h.estCritique ? 0xe74c3c : 0x5fc26a);
      this.texte(gauche, y + 98, `${Math.ceil(h.pv)} / ${h.pvMax} PV`, 11, COULEURS.texte);
      this.barre(cadre, gauche, y + 116, bl, 6, h.xp / h.xpRequise, 0x5ec8f0);
      this.texte(gauche, y + 126, `${Math.floor(h.xp)} / ${h.xpRequise} XP  ·  ${h.kills} elimines`, 10, "#8fd4f0");
    } else if (sujet.genre === "arrivant") {
      // Pas de barre de vie : il n'est pas encore quelqu'un du village, et lui
      // en donner une repondrait a la seule question qu'on ne doit pas trancher
      // ici — ce qu'il vaut. On regarde un visage, pas des chiffres de combat.
      this.texte(gauche, y + 86, "Un inconnu se presente a la porte.", 12, COULEURS.attenue);
      this.texte(gauche, y + 106, "Trois choses se remarquent. Le reste se demande.", 10, COULEURS.discret);
    } else {
      const regles = sujet.villageois.regles;
      const pvMax = combatDe(regles).pvMax;
      this.barre(cadre, gauche, y + 82, bl, 12, regles.pv / pvMax, 0x5fc26a);
      this.texte(gauche, y + 98, `${Math.ceil(regles.pv)} / ${pvMax} PV`, 11, COULEURS.texte);
      this.texte(
        gauche,
        y + 118,
        regles.vivant ? NOMS_POSTURE_CIVILE[regles.posture] : "mort",
        11,
        regles.vivant ? COULEURS.attenue : COULEURS.discret,
      );
    }

    cadre.lineStyle(1, accent, 0.35);
    const bas = y + 18 + TAILLE_PORTRAIT.hauteur * echelle + 12;
    cadre.lineBetween(x + 20, bas, x + LARGEUR - 20, bas);
    return bas + 12;
  }

  /**
   * Les trois statistiques (§4.23).
   *
   * ⚠️ **En pourcentage**, decision du 10 aout 2026 : c'est ce qui permet de
   * comparer deux fiches d'un coup d'oeil, ce qu'une echelle sans unite ne
   * permet pas. 100 % est le niveau d'un tres bon element, et rien n'interdit
   * de le depasser.
   */
  private statistiques(
    cadre: Phaser.GameObjects.Graphics,
    personne: Personne,
    x: number,
    y: number,
  ): number {
    this.texte(x + 20, y, "STATISTIQUES", 11, COULEURS.discret);

    const lignes: [string, number, string][] = [
      ["Force", personne.stats.force, "degats, et recolte a la main"],
      ["Courage", personne.stats.courage, "seuil de repli, defense, resistance au stress"],
      ["Intelligence", personne.stats.intelligence, "batit moins cher, monte plus vite"],
    ];

    lignes.forEach(([nom, valeur, quoi], i) => {
      const cy = y + 20 + i * 22;
      cadre.fillStyle(COULEURS.case, 0.9);
      cadre.fillRoundedRect(x + 20, cy, LARGEUR - 40, 19, 4);
      this.texte(x + 28, cy + 4, nom, 11, COULEURS.attenue);
      this.barre(cadre, x + 120, cy + 6, 120, 8, valeur / 100, couleurDeStat(valeur));
      this.texte(x + 250, cy + 4, `${valeur}%`, 11, COULEURS.texte);
      this.texte(x + 300, cy + 5, quoi, 9, COULEURS.discret);
    });

    return y + 20 + lignes.length * 22 + 10;
  }

  /** Le stress, sa rupture, et les etats en cours. */
  private moral(
    cadre: Phaser.GameObjects.Graphics,
    personne: Personne,
    x: number,
    y: number,
  ): number {
    this.texte(x + 20, y, "MORAL", 11, COULEURS.discret);

    const part = personne.stress / REGLAGES_STRESS.rupture;
    const couleur = personne.stress >= REGLAGES_STRESS.rupture ? 0xff5a4a : part > 0.6 ? 0xffd98a : 0x7ee0a0;
    this.barre(cadre, x + 20, y + 20, LARGEUR - 160, 12, Math.min(1, part), couleur);
    // Au-dela de 100 la jauge deborde, et il faut que ca se voie : c'est la
    // marche vers les 200 % ou le coeur lache (§4.23).
    if (personne.stress > REGLAGES_STRESS.rupture) {
      this.barre(cadre, x + 20, y + 20, LARGEUR - 160, 12, part - 1, 0x8a1f1f);
    }
    this.texte(x + LARGEUR - 130, y + 20, `stress ${Math.round(personne.stress)}%`, 11, COULEURS.texte);

    let cy = y + 38;
    if (personne.rupture) {
      this.texte(
        x + 20,
        cy,
        `${NOMS_RUPTURE[personne.rupture]} — ${EFFETS_RUPTURE[personne.rupture].hero}`,
        11,
        COULEURS.mauvais,
      );
      cy += 18;
    }

    for (const etat of personne.etats) {
      const def = ETATS[etat.cle];
      this.texte(
        x + 20,
        cy,
        `${lireEtat(etat)} — ${def.mortel ? "il en mourra s'il n'est pas soigne" : "ca ne le tuera pas"}`,
        10,
        etat.palier === 2 ? COULEURS.mauvais : COULEURS.mixte,
      );
      cy += 15;
    }

    return cy + 8;
  }

  /**
   * Les traits et les sequelles.
   *
   * Une fiche de vetéran raconte sa vie : trente traits qui disent ce qu'il a
   * traverse. La couleur dit d'un coup d'oeil que **la plupart sont mauvais**
   * (§4.23) — c'est la moitie de l'interet du systeme.
   */
  private traits(
    cadre: Phaser.GameObjects.Graphics,
    personne: Personne,
    x: number,
    y: number,
    sujet: SujetFiche,
  ): number {
    const aLaPorte = sujet.genre === "arrivant";
    this.texte(
      x + 20,
      y,
      aLaPorte ? "CE QU'ON LUI VOIT" : "CE QU'IL EST DEVENU",
      11,
      COULEURS.discret,
    );

    const lignes: [string, string, string][] = [];
    for (const id of personne.sequelles) {
      const def = sequelleParId(id);
      if (def) lignes.push([def.nom, def.resume, COULEURS.mauvais]);
    }
    // A la porte on ne montre que ce qui se lit sur quelqu'un qu'on regarde
    // deux minutes (§4.10). Tout deballer ferait de la fiche un dossier, et le
    // doute — qui est le contenu du systeme — disparaitrait.
    const portes = aLaPorte ? traitsVisibles(sujet.arrivant) : personne.traits;
    for (const id of portes) {
      const def = traitParId(id);
      if (!def) continue;
      const couleur =
        def.humeur === "bon" ? COULEURS.bon : def.humeur === "mauvais" ? COULEURS.mauvais : COULEURS.mixte;
      lignes.push([def.nom, def.resume, couleur]);
    }

    if (lignes.length === 0) {
      this.texte(
        x + 20,
        y + 20,
        aLaPorte ? "Rien qui se remarque." : "Rien encore. Il n'a rien vecu.",
        11,
        COULEURS.discret,
      );
      return y + 44;
    }

    lignes.forEach(([nom, resume, couleur], i) => {
      const cy = y + 20 + i * 16;
      this.texte(x + 24, cy, nom, 10, couleur);
      this.texte(x + 150, cy, resume, 9, COULEURS.discret);
    });

    return y + 20 + lignes.length * 16 + 10;
  }

  /** Les chiffres de combat d'un heros. Un habitant n'en a pas (§4.10). */
  private combat(
    cadre: Phaser.GameObjects.Graphics,
    hero: Hero,
    x: number,
    y: number,
  ): number {
    this.texte(x + 20, y, "AU COMBAT", 11, COULEURS.discret);

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

    const colonne = (LARGEUR - 40) / 2;
    stats.forEach(([nom, valeur], i) => {
      const cx = x + 20 + (i % 2) * colonne;
      const cy = y + 20 + Math.floor(i / 2) * 19;
      cadre.fillStyle(COULEURS.case, 0.9);
      cadre.fillRoundedRect(cx, cy, colonne - 8, 17, 4);
      this.texte(cx + 8, cy + 3, nom, 10, COULEURS.attenue);
      this.texte(cx + colonne - 16, cy + 3, valeur, 10, COULEURS.texte).setOrigin(1, 0);
    });

    return y + 20 + Math.ceil(stats.length / 2) * 19 + 10;
  }

  /** Le metier, le poste et la cadence d'un habitant. Un heros n'en a pas. */
  private metier(
    cadre: Phaser.GameObjects.Graphics,
    villageois: Villageois,
    x: number,
    y: number,
  ): number {
    this.texte(x + 20, y, "AU TRAVAIL", 11, COULEURS.discret);

    const regles = villageois.regles;
    const combat = combatDe(regles);
    const stats: [string, string][] = [
      ["Poste", villageois.poste?.nom ?? "aucun"],
      ["Cadence", `${cadence(regles).toFixed(1)} / min`],
      ["Rassasie", regles.rassasie ? "oui" : "non — il ne produit plus"],
      ["Degats", combat.degats.toFixed(1)],
      ["Portee", `${combat.portee}`],
      ["Recharge", `${(combat.recharge / 1000).toFixed(1)} s`],
    ];

    const colonne = (LARGEUR - 40) / 2;
    stats.forEach(([nom, valeur], i) => {
      const cx = x + 20 + (i % 2) * colonne;
      const cy = y + 20 + Math.floor(i / 2) * 19;
      cadre.fillStyle(COULEURS.case, 0.9);
      cadre.fillRoundedRect(cx, cy, colonne - 8, 17, 4);
      this.texte(cx + 8, cy + 3, nom, 10, COULEURS.attenue);
      this.texte(cx + colonne - 16, cy + 3, valeur, 10, COULEURS.texte).setOrigin(1, 0);
    });

    return y + 20 + Math.ceil(stats.length / 2) * 19 + 10;
  }

  /** Les affinites de groupe (§4.16). Un systeme invisible ne change rien. */
  private equipe(
    cadre: Phaser.GameObjects.Graphics,
    groupe: GroupeAffiche,
    x: number,
    y: number,
  ): number {
    this.texte(x + 20, y, "EQUIPE SOUDEE", 11, COULEURS.discret);
    this.texte(
      x + LARGEUR - 20,
      y,
      `+${(groupe.bonus * 100).toFixed(1)}% de degats`,
      11,
      groupe.bonus > 0 ? COULEURS.bon : COULEURS.discret,
    ).setOrigin(1, 0);

    const colonne = (LARGEUR - 40) / 2;
    groupe.liens.forEach((lien, i) => {
      const cx = x + 20 + (i % 2) * colonne;
      const cy = y + 20 + Math.floor(i / 2) * 17;
      this.texte(cx + 4, cy, lien.nom.slice(0, 12), 10, COULEURS.attenue);
      this.barre(cadre, cx + colonne - 90, cy + 3, 70, 7, lien.force, 0x7ee0a0);
    });

    return y + 20 + Math.ceil(groupe.liens.length / 2) * 17 + 10;
  }

  private competences(
    cadre: Phaser.GameObjects.Graphics,
    hero: Hero,
    x: number,
    y: number,
  ): number {
    const entrees = Object.entries(hero.competences);
    this.texte(x + 20, y, "COMPETENCES", 11, COULEURS.discret);
    if (entrees.length === 0) {
      this.texte(x + 20, y + 20, "Aucune pour l'instant.", 11, COULEURS.discret);
      return y + 44;
    }

    entrees.forEach(([id, palier], i) => {
      const def = competenceParId(id);
      if (!def) return;
      const cy = y + 20 + i * 18;
      const couleur = COULEURS_RANG[def.rang];
      cadre.fillStyle(couleur, 0.16);
      cadre.fillRoundedRect(x + 20, cy, LARGEUR - 40, 16, 4);
      this.texte(x + 28, cy + 3, def.rang, 9, teinte(couleur));
      this.texte(x + 58, cy + 3, `${def.nom} ${palier}`, 10, COULEURS.texte);
      const evolution = hero.evolutions[id];
      if (evolution) this.texte(x + LARGEUR - 28, cy + 3, evolution.nom, 9, "#f0c419").setOrigin(1, 0);
    });

    return y + 20 + entrees.length * 18 + 10;
  }

  /**
   * Les trois lignes d'observation (§4.10, §4.18).
   *
   * ⚠️ **Aucune couleur ne dit laquelle est alarmante**, et c'est un choix, pas
   * un oubli. Marquer les mauvaises en rouge reviendrait a les compter pour le
   * joueur : il regarderait trois pastilles au lieu de lire trois phrases, et le
   * §4.18 demande exactement l'inverse — « les indices se lisent vraiment ».
   */
  private observations(
    cadre: Phaser.GameObjects.Graphics,
    arrivant: Arrivant,
    x: number,
    y: number,
  ): number {
    this.texte(x + 20, y, "CE QU'ON OBSERVE", 11, COULEURS.discret);

    arrivant.observations.forEach((ligne, i) => {
      const cy = y + 20 + i * 22;
      cadre.fillStyle(COULEURS.case, 0.9);
      cadre.fillRoundedRect(x + 20, cy, LARGEUR - 40, 19, 4);
      this.texte(x + 28, cy + 4, ligne.texte, 11, COULEURS.attenue);
    });

    return y + 20 + arrivant.observations.length * 22 + 10;
  }

  /**
   * Les questions, et ce qu'il repond (§4.10).
   *
   * Les questions sont **tirees**, les reponses ne le sont **jamais** : le meme
   * homme, a la meme question, repond toujours la meme chose. On peut toutes les
   * poser — la rarete vient du tirage, pas d'un quota.
   */
  private interrogatoire(
    cadre: Phaser.GameObjects.Graphics,
    sujet: Extract<SujetFiche, { genre: "arrivant" }>,
    x: number,
    y: number,
  ): number {
    const { arrivant } = sujet;
    this.texte(x + 20, y, "CE QU'ON LUI DEMANDE", 11, COULEURS.discret);

    let cy = y + 20;
    for (const question of arrivant.questions) {
      const posee = arrivant.posees.includes(question.cle);

      cadre.fillStyle(COULEURS.case, posee ? 0.5 : 0.9);
      cadre.fillRoundedRect(x + 20, cy, LARGEUR - 40, 19, 4);
      this.texte(x + 28, cy + 4, `« ${question.texte} »`, 11, posee ? COULEURS.discret : COULEURS.texte);
      if (!posee) {
        // Redessiner la fiche entiere plutot que d'inserer une ligne : elle se
        // dimensionne sur son contenu, et sa hauteur change avec la reponse.
        this.zone(x + 20, cy, LARGEUR - 40, 19, 2606, () => {
          poser(arrivant, question.cle);
          this.afficher(sujet);
        });
      }
      cy += 21;

      if (!posee) continue;

      const reponse = reponseA(arrivant, question);
      this.texte(x + 36, cy, `— ${reponse.texte}`, 10, COULEURS.attenue);
      cy += 16;
      // Le tell est ici, et il ne dit jamais « il ment » : il dit ce qu'on voit.
      if (reponse.trahi) {
        this.texte(x + 36, cy, "Son regard se derobe une seconde.", 10, COULEURS.mixte);
        cy += 16;
      }
    }

    return cy + 8;
  }

  private boutons(
    cadre: Phaser.GameObjects.Graphics,
    sujet: SujetFiche,
    x: number,
    y: number,
  ): void {
    if (sujet.genre === "arrivant") {
      this.bouton(cadre, x + 20, y, 200, 30, "OUVRIR LA PORTE", 0x7ee0a0, () => {
        const action = sujet.surAccepter;
        this.fermer();
        action();
      });
      this.bouton(cadre, x + LARGEUR - 220, y, 200, 30, "LE RENVOYER", 0xff8a7a, () => {
        const action = sujet.surRefuser;
        this.fermer();
        action();
      });
      return;
    }

    if (sujet.genre === "hero" && !sujet.hero.estIncarne && sujet.hero.etat !== "mort") {
      this.bouton(cadre, x + 20, y, 180, 30, "INCARNER", 0xf0c419, () => {
        const action = sujet.surIncarner;
        this.fermer();
        action();
      });
    }
    this.bouton(cadre, x + LARGEUR - 140, y, 120, 30, "FERMER", 0x4a4152, () => this.fermer());
  }

  /**
   * La hauteur voulue, calculee avant de dessiner.
   *
   * La fiche se dimensionne sur son contenu. Figee, elle debordait des que le
   * heros passait six competences — et un habitant qui porte quinze traits
   * deborderait exactement pareil.
   */
  private hauteurVoulue(sujet: SujetFiche, personne: Personne): number {
    let h = 18 + TAILLE_PORTRAIT.hauteur * 4 + 24; // identite
    h += 20 + 3 * 22 + 10; // statistiques
    if (sujet.genre !== "arrivant") {
      h += 38 + (personne.rupture ? 18 : 0) + personne.etats.length * 15 + 8; // moral
    }
    const marques =
      sujet.genre === "arrivant"
        ? traitsVisibles(sujet.arrivant).length
        : personne.traits.length + personne.sequelles.length;
    h += 20 + Math.max(1, marques) * 16 + 10;

    if (sujet.genre === "arrivant") {
      h += 20 + sujet.arrivant.observations.length * 22 + 10;
      // Une question posee prend sa reponse en plus, et son tell le cas echeant.
      h += 20 + sujet.arrivant.questions.length * 21 + 8;
      for (const question of sujet.arrivant.questions) {
        if (!sujet.arrivant.posees.includes(question.cle)) continue;
        h += 16 + (reponseA(sujet.arrivant, question).trahi ? 16 : 0);
      }
      return h + 52;
    }

    if (sujet.genre === "hero") {
      h += 20 + 4 * 19 + 10; // combat
      h += 20 + Math.ceil(sujet.groupe.liens.length / 2) * 17 + 10;
      h += 20 + Math.max(1, Object.keys(sujet.hero.competences).length) * 18 + 10;
    } else {
      h += 20 + 3 * 19 + 10; // metier
    }

    return h + 52;
  }

  // ------------------------------------------------------------ renommage

  /**
   * Le renommage (DESIGN.md §4.18).
   *
   * Phaser n'a pas de champ de saisie, et en ajouter un vrai demanderait
   * d'activer la couche DOM du moteur pour une seule fonctionnalite. On capte
   * donc le clavier directement : trente lignes, aucune dependance, et ca marche
   * pareil dans les deux scenes.
   *
   * ⚠️ Pendant la saisie, **les touches du jeu doivent etre coupees** — sinon
   * taper un nom sonne la cloche et bâtit des palissades. C'est le role de
   * `surSaisie`.
   */
  private commencerLaSaisie(): void {
    if (this.saisie !== null || !this.sujet) return;

    this.saisie = personneDe(this.sujet).nom;
    this.vierge = true;
    this.surSaisie(true);

    this.clavier = (e: KeyboardEvent) => {
      if (this.saisie === null) return;
      e.preventDefault();

      if (e.key === "Enter") {
        this.validerLaSaisie();
        return;
      }
      if (e.key === "Escape") {
        this.annulerLaSaisie();
        return;
      }
      if (e.key === "Backspace") {
        this.saisie = this.saisie.slice(0, -1);
        this.vierge = false;
      } else if (e.key.length === 1) {
        // La premiere frappe **remplace** le nom au lieu de s'y coller. Vu en
        // jouant : cliquer « Aubin » puis taper « Bertrand » donnait
        // « AubinBertrand ». C'est la convention de tous les champs qu'on
        // ouvre sur un contenu deja la — il est selectionne.
        if (this.vierge) {
          this.saisie = "";
          this.vierge = false;
        }
        if (this.saisie.length < 16) this.saisie += e.key;
      }
      this.champ?.setText(`${this.saisie}_`);
    };

    // En capture, pour passer avant les ecouteurs de Phaser.
    window.addEventListener("keydown", this.clavier, true);
    this.champ?.setText(`${this.saisie}_`).setColor("#ffd98a");
  }

  private validerLaSaisie(): void {
    const nom = (this.saisie ?? "").trim();
    if (this.sujet && nom.length > 0) {
      const personne = personneDe(this.sujet);
      personne.nom = nom;
      // On ne lui reproposera plus un nom tire au sort : celui-la, c'est le
      // joueur qui l'a donne, et c'est ce qui fait qu'on s'y attache (§4.18).
      personne.nomChoisi = true;
    }
    this.arreterLaSaisie();
  }

  private annulerLaSaisie(): void {
    this.arreterLaSaisie();
  }

  private arreterLaSaisie(): void {
    if (this.clavier) window.removeEventListener("keydown", this.clavier, true);
    this.clavier = null;
    this.saisie = null;
    this.surSaisie(false);

    if (this.sujet) this.champ?.setText(personneDe(this.sujet).nom).setColor(COULEURS.texte);
  }

  // --------------------------------------------------------------- outils

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
    cadre.fillStyle(COULEURS.case, 1);
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
    // La saisie d'abord : fermer sans rendre le clavier au jeu laisserait le
    // joueur incapable de bouger, et rien a l'ecran ne dirait pourquoi.
    if (this.saisie !== null) this.arreterLaSaisie();

    this.sujet = null;
    this.champ = null;
    for (const objet of this.objets) objet.destroy();
    this.objets = [];
  }
}

/** Vert au-dessus de la moyenne, rouge en dessous. Elle se lit sans legende. */
function couleurDeStat(valeur: number): number {
  if (valeur >= 70) return 0x7ee0a0;
  if (valeur >= 40) return 0xffd98a;
  return 0xff8a7a;
}

function teinte(couleur: number): string {
  return `#${couleur.toString(16).padStart(6, "0")}`;
}
