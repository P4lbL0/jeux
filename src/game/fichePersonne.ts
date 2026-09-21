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
import {
  affuter,
  C,
  T,
  HAUTEUR_TITRE,
  barreDeTitre,
  cadre as plaqueDeFer,
  creux,
  espacer,
  jauge as jaugeChrome,
  POLICE,
  yTitre,
  type Plaque,
} from "./ui/chrome";
import type { Hero } from "./entities";
import type { Villageois } from "./village";
import { largeurEcran, hauteurEcran } from "./ui/ecran";

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

/**
 * A la porte, la fiche s'elargit : le portrait a gauche, ce qu'il repond au
 * milieu, les questions a droite (§4.10). En une seule colonne, il fallait
 * descendre chercher la reponse a la question qu'on venait de cliquer, et le
 * visage — qui est ce qui trahit — sortait du champ de vision.
 */
const LARGEUR_PORTE = 880;
/** Largeur de la colonne des questions, et de celle des reponses. */
const COLONNE_PORTE = 250;

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
      /**
       * Ce qu'il porte, ecrit **noir sur blanc** (§4.18, les survivants).
       *
       * Absent a la porte, present quand on ramene un blesse du bord de la
       * carte. C'est la difference volontaire entre les deux : **la folie se
       * devine, la maladie se lit**. Sans ca, refuser quelqu'un qu'on vient de
       * sauver ne serait qu'un pari de plus au lieu d'une decision.
       */
      etatAnnonce?: string;
      /**
       * Ou l'entretien a lieu.
       *
       * ⚠️ **Vu en jouant** : la fiche disait « A LA PORTE » et « OUVRIR LA
       * PORTE » a quelqu'un qu'on venait de ramener du bord de la carte au
       * peril de sa vie. C'est la meme fiche et c'est voulu (§4.10) — mais elle
       * ne doit pas raconter la mauvaise scene.
       */
      /**
       * Ou la rencontre se joue. **Trois lieux, et les mots changent** :
       * `porte` a la porte du village (§4.18), `sauvetage` quand on ramene
       * quelqu'un jusqu'a l'eglise (§4.18), `route` quand on tombe sur lui en
       * errant (§4.31) — la, il n'y a ni village ou le faire entrer, ni eglise
       * dont parler, et les boutons le disent.
       */
      lieu?: "porte" | "sauvetage" | "route";
      surAccepter: () => void;
      surRefuser: () => void;
    };

/** La personne derriere le sujet, quel qu'il soit. */
function personneDe(sujet: SujetFiche): Personne {
  if (sujet.genre === "hero") return sujet.hero.personne;
  if (sujet.genre === "arrivant") return sujet.arrivant.personne;
  return sujet.villageois.personne;
}

/**
 * ⚠️ Ce fichier avait sa propre palette — huit couleurs a lui, dont un dore de
 * plus. Elle a disparu : tout vient de `ui/chrome.ts` (§4.10). Les noms restent
 * pour que les cent lignes qui suivent se lisent, mais ce sont des renvois.
 */
const COULEURS = {
  texte: T.os,
  attenue: T.os,
  discret: T.osMat,
  bon: T.bile,
  mauvais: T.sangFrais,
  mixte: T.laiton,
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

  /**
   * Vrai quand la fiche **attend une reponse** : un arrivant a la porte, un
   * blesse ramene du bord de la carte.
   *
   * ECHAP ne la referme pas dans ce mode (§4.10, bloc 10) : laisser entrer ou
   * refuser est un arbitrage du joueur, et le fermer sans repondre laisserait
   * le jeu en pause avec quelqu'un qui attend dehors.
   */
  get exigeUneReponse(): boolean {
    return this.sujet?.genre === "arrivant";
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
    const largeur = sujet.genre === "arrivant" ? LARGEUR_PORTE : LARGEUR;
    const hauteur = this.hauteurVoulue(sujet, personne);
    const x = Math.round(largeurEcran(this.scene) / 2 - largeur / 2);
    const y = Math.max(10, Math.round(hauteurEcran(this.scene) / 2 - hauteur / 2));

    const voile = this.scene.add.graphics().setDepth(2600);
    voile.fillStyle(C.fer, 0.72);
    voile.fillRect(0, 0, largeurEcran(this.scene), hauteurEcran(this.scene));
    this.objets.push(voile);
    this.zone(0, 0, largeurEcran(this.scene), hauteurEcran(this.scene), 2601, () => this.fermer());

    // ⚠️ La couleur de classe a quitte l'interface (§4.10) : la fiche d'un
    // Necromancien et celle d'un Rodeur sont faites du meme metal. C'est le
    // titre qui dit qui on regarde, plus un liseré.
    const cadre = this.scene.add.graphics().setDepth(2602);
    const plaque: Plaque = { x, y, largeur, hauteur };
    plaqueDeFer(cadre, plaque, true);
    barreDeTitre(cadre, plaque);
    this.objets.push(cadre);
    // Le clic a l'interieur ne referme pas la fiche.
    this.zone(x, y, largeur, hauteur, 2603, () => {});

    this.texte(
      x + 14,
      yTitre(plaque),
      espacer(
        sujet.genre === "arrivant"
          ? (sujet.lieu === "route"
              ? "SUR LA ROUTE"
              : sujet.lieu === "sauvetage"
                ? "DE RETOUR AU VILLAGE"
                : "A LA PORTE")
          : sujet.genre === "hero"
            ? "HEROS"
            : "HABITANT",
      ),
      11,
      T.titre,
    );

    // A la porte, tout ce qui est commun tient dans la colonne de gauche : le
    // milieu porte ses reponses et la droite ses questions, cote a cote, pour
    // qu'on ne perde jamais son visage de vue en cliquant (§4.10).
    const droite = x + largeur - 20 - COLONNE_PORTE;
    const milieu = droite - 16 - COLONNE_PORTE;
    const colonneGauche = sujet.genre === "arrivant" ? milieu - x - 40 : LARGEUR - 40;

    let curseur = this.identite(cadre, sujet, personne, x, y + HAUTEUR_TITRE, colonneGauche);
    curseur = this.statistiques(cadre, personne, x, curseur, colonneGauche);
    // Un inconnu n'a ni stress ni etat a montrer : sa jauge est a zero et sa
    // liste est vide. Afficher un moral vide serait du bruit sur la seule fiche
    // qu'on lit vraiment ligne a ligne.
    if (sujet.genre !== "arrivant") curseur = this.moral(cadre, personne, x, curseur);
    curseur = this.traits(cadre, personne, x, curseur, sujet, colonneGauche);

    if (sujet.genre === "hero") {
      curseur = this.combat(cadre, sujet.hero, x, curseur);
      curseur = this.equipe(cadre, sujet.groupe, x, curseur);
      curseur = this.competences(cadre, sujet.hero, x, curseur);
    } else if (sujet.genre === "arrivant") {
      curseur = this.observations(cadre, sujet.arrivant, x + 20, curseur, colonneGauche);
      // Ce qu'on **constate**, sous ce qu'on observe : les six axes se doutent,
      // un etat se lit. Les deux ne doivent pas se confondre a l'oeil.
      if (sujet.etatAnnonce !== undefined) {
        this.texte(x + 20, curseur, espacer("CE QU'ON VOIT SUR LUI"), 10, COULEURS.discret);
        const t = this.texte(x + 26, curseur + 22, sujet.etatAnnonce, 11, T.sangFrais);
        t.setWordWrapWidth(colonneGauche - 32);
        cadre.fillStyle(C.sangSeche, 1);
        cadre.fillRect(x + 20, curseur + 18, 2, t.height + 6);
      }
      // Les deux colonnes de droite partent du haut du corps, pas du curseur :
      // c'est ce qui les garde alignees quel que soit le nombre de traits.
      const hautColonnes = y + HAUTEUR_TITRE + 18;
      this.reponses(cadre, sujet.arrivant, milieu, hautColonnes, COLONNE_PORTE);
      this.questions(cadre, sujet, droite, hautColonnes, COLONNE_PORTE);
    } else {
      curseur = this.metier(cadre, sujet.villageois, x, curseur);
    }

    this.boutons(cadre, sujet, x, y + hauteur - 44, largeur);
  }

  // ------------------------------------------------------------- sections

  /** Portrait, nom modifiable, rang et niveau — la seule section commune a tout. */
  private identite(
    cadre: Phaser.GameObjects.Graphics,
    sujet: SujetFiche,
    personne: Personne,
    x: number,
    y: number,
    largeur = LARGEUR - 40,
  ): number {
    const vivant =
      sujet.genre === "hero"
        ? sujet.hero.etat !== "mort"
        : sujet.genre === "arrivant" || sujet.villageois.regles.vivant;

    // Le portrait est **assemble** (§4.23) : il change avec la personne, donc
    // il se redemande a chaque ouverture plutot que d'etre garde en champ.
    // ⚠️ **C'est le portrait qui trahit le mensonge**, pas une ligne de texte
    // (§4.10) : des qu'une reponse deja posee l'a fait se derober, son regard
    // glisse sur le cote pour le reste de l'entretien.
    const seTrahit =
      sujet.genre === "arrivant" &&
      sujet.arrivant.questions.some(
        (q) =>
          sujet.arrivant.posees.includes(q.cle) && reponseA(sujet.arrivant, q).trahi,
      );

    const cle = portraitDe(this.scene, personne, vivant, seTrahit);
    const echelle = 4;
    const cadrePortrait: Plaque = {
      x: x + 20,
      y: y + 18,
      largeur: TAILLE_PORTRAIT.largeur * echelle,
      hauteur: TAILLE_PORTRAIT.hauteur * echelle,
    };
    creux(cadre, cadrePortrait);
    const portrait = this.scene.add
      .image(x + 20, y + 18, cle)
      .setOrigin(0)
      .setScale(echelle)
      .setDepth(2604);
    this.objets.push(portrait);
    this.ogive(cadrePortrait);

    const gauche = x + 20 + TAILLE_PORTRAIT.largeur * echelle + 16;

    this.champ = this.texte(gauche, y + 20, personne.nom, 20, COULEURS.texte);
    // ⚠️ **On ne renomme pas a la porte** (§4.18) : « pas au moment de son
    // arrivee, on ne coupe pas le jeu pour demander un prenom a quelqu'un qui
    // n'a encore rien vecu ». Le renommage vient apres, quand celui-la est
    // devenu quelqu'un — donc la zone cliquable n'existe pas ici.
    if (sujet.genre !== "arrivant") {
      this.zone(gauche, y + 18, largeur - (gauche - x) + 20, 26, 2606, () =>
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
        ? (sujet.lieu === "route"
            ? "il s'est leve en te voyant"
            : sujet.lieu === "sauvetage"
              ? "il t'a suivi jusqu'ici"
              : "il attend a la porte")
        : "clic sur le nom pour renommer",
      9,
      COULEURS.discret,
    );

    // La barre de vie, commune elle aussi : un habitant en a une depuis le
    // bloc 4 (§4.18).
    const bl = Math.max(90, largeur - (gauche - x) + 10);
    if (sujet.genre === "hero") {
      const h = sujet.hero;
      // Le repere des 20 % est ici aussi : c'est le seuil qui verrouille tout,
      // et une fiche qui ne le montrerait pas mentirait par omission (§4.3).
      jaugeChrome(cadre, { x: gauche, y: y + 82, largeur: bl, hauteur: 12 }, h.ratioPv, undefined, 0.2);
      this.texte(gauche, y + 98, `${Math.ceil(h.pv)} / ${h.pvMax} PV`, 11, COULEURS.texte);
      jaugeChrome(cadre, { x: gauche, y: y + 116, largeur: bl, hauteur: 6 }, h.xp / h.xpRequise, {
        plein: C.laiton,
        moitie: C.laiton,
        critique: C.laiton,
      });
      this.texte(gauche, y + 126, `${Math.floor(h.xp)} / ${h.xpRequise} XP  ·  ${h.kills} elimines`, 10, T.osMat);
    } else if (sujet.genre === "arrivant") {
      // Pas de barre de vie : il n'est pas encore quelqu'un du village, et lui
      // en donner une repondrait a la seule question qu'on ne doit pas trancher
      // ici — ce qu'il vaut. On regarde un visage, pas des chiffres de combat.
      // ⚠️ Ces deux phrases doivent s'arreter au bord de la colonne : sans
      // enveloppe, elles ecrivaient par-dessus la colonne des reponses. Vu sur
      // une capture — un texte Phaser ne se plaint jamais de deborder.
      // ⚠️ La seconde phrase se pose sous la **hauteur mesuree** de la premiere.
      // Un pas fixe de 20 px marchait tant que rien ne s'enveloppait ; dans la
      // colonne etroite de la porte, la premiere prend deux lignes et recouvrait
      // la seconde.
      const intro = this.texte(
        gauche,
        y + 84,
        sujet.lieu === "route"
          ? "Il n'a nulle part ou aller. Toi non plus."
          : sujet.lieu === "sauvetage"
            ? "Tu l'as ramene. Il attend ta reponse."
            : "Un inconnu se presente a la porte.",
        12,
        COULEURS.attenue,
      ).setWordWrapWidth(bl);
      this.texte(
        gauche,
        y + 84 + intro.height + 4,
        "Trois choses se remarquent. Le reste se demande.",
        10,
        COULEURS.discret,
      ).setWordWrapWidth(bl);
    } else {
      const regles = sujet.villageois.regles;
      const pvMax = combatDe(regles).pvMax;
      jaugeChrome(cadre, { x: gauche, y: y + 82, largeur: bl, hauteur: 12 }, regles.pv / pvMax);
      this.texte(gauche, y + 98, `${Math.ceil(regles.pv)} / ${pvMax} PV`, 11, COULEURS.texte);
      this.texte(
        gauche,
        y + 118,
        regles.vivant ? NOMS_POSTURE_CIVILE[regles.posture] : "mort",
        11,
        regles.vivant ? COULEURS.attenue : COULEURS.discret,
      );
    }

    const bas = y + 18 + TAILLE_PORTRAIT.hauteur * echelle + 12;
    cadre.fillStyle(C.sangSeche, 0.7);
    cadre.fillRect(x + 20, bas, largeur, 1);
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
    largeur = LARGEUR - 40,
  ): number {
    this.texte(x + 20, y, espacer("STATISTIQUES"), 10, COULEURS.discret);

    const lignes: [string, number, string][] = [
      ["Force", personne.stats.force, "degats, et recolte a la main"],
      ["Courage", personne.stats.courage, "seuil de repli, defense, resistance au stress"],
      ["Intelligence", personne.stats.intelligence, "batit moins cher, monte plus vite"],
    ];

    // Sous 420 px, la colonne « a quoi ca sert » ne rentre plus : on la coupe
    // plutot que de la laisser deborder du cadre. C'est la seule des quatre
    // colonnes qu'on peut perdre — les trois autres portent le chiffre.
    const large = largeur >= 420;
    lignes.forEach(([nom, valeur, quoi], i) => {
      const cy = y + 20 + i * 22;
      creux(cadre, { x: x + 20, y: cy, largeur, hauteur: 19 });
      this.texte(x + 28, cy + 4, nom, 11, COULEURS.attenue);
      const largeurBarre = large ? 120 : Math.max(50, largeur - 200);
      this.barre(cadre, x + 120, cy + 6, largeurBarre, 8, valeur / 100, couleurDeStat(valeur));
      this.texte(x + 130 + largeurBarre, cy + 4, `${valeur}%`, 11, COULEURS.texte);
      if (large) this.texte(x + 300, cy + 5, quoi, 9, COULEURS.discret);
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
    this.texte(x + 20, y, espacer("MORAL"), 10, COULEURS.discret);

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
    largeur = LARGEUR - 40,
  ): number {
    const aLaPorte = sujet.genre === "arrivant";
    this.texte(
      x + 20,
      y,
      espacer(aLaPorte ? "CE QU'ON LUI VOIT" : "CE QU'IL EST DEVENU"),
      10,
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

    // ⚠️ La hauteur d'une ligne est **mesuree**, pas supposee : dans une colonne
    // etroite, un resume de trait s'enveloppe sur deux lignes et vient recouvrir
    // le trait suivant. Vu sur une capture — un pas fixe de 16 px ne marche que
    // tant que rien ne s'enveloppe.
    let cy = y + 20;
    for (const [nom, resume, couleur] of lignes) {
      this.texte(x + 24, cy, nom, 10, couleur);
      const t = this.texte(x + 150, cy, resume, 9, COULEURS.discret).setWordWrapWidth(
        Math.max(80, largeur - 134),
      );
      cy += Math.max(16, t.height + 2);
    }

    return cy + 10;
  }

  /** Les chiffres de combat d'un heros. Un habitant n'en a pas (§4.10). */
  private combat(
    cadre: Phaser.GameObjects.Graphics,
    hero: Hero,
    x: number,
    y: number,
  ): number {
    this.texte(x + 20, y, espacer("AU COMBAT"), 10, COULEURS.discret);

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
      creux(cadre, { x: cx, y: cy, largeur: colonne - 8, hauteur: 17 });
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
    this.texte(x + 20, y, espacer("AU TRAVAIL"), 10, COULEURS.discret);

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
      creux(cadre, { x: cx, y: cy, largeur: colonne - 8, hauteur: 17 });
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
    this.texte(x + 20, y, espacer("EQUIPE SOUDEE"), 10, COULEURS.discret);
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
    this.texte(x + 20, y, espacer("COMPETENCES"), 10, COULEURS.discret);
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
   * ⚠️ **Les alarmantes portent un « ! » rouge**, decision du 11 aout 2026 — et
   * elle **annule le choix inverse** pris au bloc 6a, qui refusait toute couleur
   * ici pour que le joueur lise au lieu de compter.
   *
   * Ce que ca coute, et il faut le dire une fois : la competence « apprendre les
   * six phrases alarmantes » disparait, puisque le jeu les designe. Ce que ca ne
   * coute pas : le doute. Les fourchettes du §4.18 se recouvrent volontairement
   * — 0 signal innocente, 3 accusent, et **64 % des arrivants tombent entre les
   * deux**, mesure en jeu sur 2000 tirages. Compter les « ! » ne suffit toujours
   * pas a trancher.
   */
  private observations(
    cadre: Phaser.GameObjects.Graphics,
    arrivant: Arrivant,
    x: number,
    y: number,
    largeur: number,
  ): number {
    this.texte(x, y, espacer("CE QU'ON OBSERVE"), 10, COULEURS.discret);

    let cy = y + 18;
    for (const ligne of arrivant.observations) {
      const t = this.texte(x + 18, cy + 5, ligne.texte, 11, COULEURS.attenue);
      t.setWordWrapWidth(largeur - 26);
      const hauteur = Math.max(20, t.height + 10);
      creux(cadre, { x, y: cy, largeur, hauteur });
      if (ligne.alarmante) this.texte(x + 6, cy + 4, "!", 12, T.sangFrais);
      cy += hauteur + 3;
    }

    return cy + 10;
  }

  /**
   * Les questions, a droite, en boutons (§4.10).
   *
   * Les questions sont **tirees**, les reponses ne le sont **jamais** : le meme
   * homme, a la meme question, repond toujours la meme chose. On peut toutes les
   * poser — la rarete vient du tirage, pas d'un quota.
   */
  private questions(
    cadre: Phaser.GameObjects.Graphics,
    sujet: Extract<SujetFiche, { genre: "arrivant" }>,
    x: number,
    y: number,
    largeur: number,
  ): void {
    const { arrivant } = sujet;
    this.texte(x, y, espacer("CE QU'ON LUI DEMANDE"), 10, COULEURS.discret);

    let cy = y + 18;
    for (const question of arrivant.questions) {
      const posee = arrivant.posees.includes(question.cle);
      const t = this.texte(
        x + 10,
        cy + 8,
        `« ${question.texte} »`,
        10,
        posee ? COULEURS.discret : T.laiton,
      );
      t.setWordWrapWidth(largeur - 20);
      const hauteur = Math.max(28, t.height + 16);

      if (posee) {
        creux(cadre, { x, y: cy, largeur, hauteur });
      } else {
        cadre.fillStyle(C.plaque, 1);
        cadre.fillRect(x, cy, largeur, hauteur);
        cadre.fillStyle(0x4a3a34, 1);
        cadre.fillRect(x, cy, largeur, 1);
        cadre.fillStyle(0x0a0707, 1);
        cadre.fillRect(x, cy + hauteur - 1, largeur, 1);
        cadre.lineStyle(1, 0x000000, 1);
        cadre.strokeRect(x - 0.5, cy - 0.5, largeur + 1, hauteur + 1);
        // Redessiner la fiche entiere plutot que d'inserer une ligne : elle se
        // dimensionne sur son contenu, et sa hauteur change avec la reponse.
        this.zone(x, cy, largeur, hauteur, 2606, () => {
          poser(arrivant, question.cle);
          this.afficher(sujet);
        });
      }
      cy += hauteur + 4;
    }
  }

  /**
   * Ce qu'il repond, au milieu (§4.10).
   *
   * ⚠️ **Le tell n'est pas ecrit ici.** Quand il se trahit, c'est le **portrait**
   * qui le dit — son regard glisse sur le cote pour le reste de l'entretien — et
   * une ligne rouge passe sous la reponse. Jamais une phrase qui annonce « il
   * ment » : un regard qui fuit se lit plus vite et n'affirme rien.
   */
  private reponses(
    cadre: Phaser.GameObjects.Graphics,
    arrivant: Arrivant,
    x: number,
    y: number,
    largeur: number,
  ): void {
    this.texte(x, y, espacer("CE QU'IL REPOND"), 10, COULEURS.discret);

    const posees = arrivant.questions.filter((q) => arrivant.posees.includes(q.cle));
    if (posees.length === 0) {
      this.texte(x, y + 22, "Il attend qu'on lui parle.", 11, COULEURS.discret).setWordWrapWidth(
        largeur,
      );
      return;
    }

    let cy = y + 20;
    for (const question of posees) {
      const reponse = reponseA(arrivant, question);
      const t = this.texte(x, cy, `— ${reponse.texte}`, 11, COULEURS.attenue);
      t.setWordWrapWidth(largeur);
      cy += t.height + 4;

      if (reponse.trahi) {
        cadre.fillStyle(C.sangFrais, 1);
        cadre.fillRect(x, cy, Math.min(largeur, t.width), 1);
        cy += 6;
      }
      cy += 8;
    }
  }

  private boutons(
    cadre: Phaser.GameObjects.Graphics,
    sujet: SujetFiche,
    x: number,
    y: number,
    largeur: number,
  ): void {
    if (sujet.genre === "arrivant") {
      // ⚠️ Ni l'un ni l'autre n'est presente comme le bon choix : accepter peut
      // faire entrer un meurtrier, refuser coute le bras qu'on n'aura pas
      // (§4.18). Les deux boutons ont donc le meme poids visuel — la bile et le
      // sang seche, jamais un vert « valider » et un gris « annuler ».
      const oui =
        sujet.lieu === "route"
          ? "L'EMMENER AVEC TOI"
          : sujet.lieu === "sauvetage"
            ? "LE FAIRE ENTRER"
            : "OUVRIR LA PORTE";
      // Sur la route on ne renvoie personne nulle part : on le laisse ou il est,
      // et c'est plus dur a dire que « le renvoyer ».
      const non = sujet.lieu === "route" ? "LE LAISSER LA" : "LE RENVOYER";
      this.bouton(cadre, x + 20, y, 220, 32, oui, C.bile, () => {
        const action = sujet.surAccepter;
        this.fermer();
        action();
      });
      this.bouton(cadre, x + largeur - 240, y, 220, 32, non, C.sangSeche, () => {
        const action = sujet.surRefuser;
        this.fermer();
        action();
      });
      return;
    }

    if (sujet.genre === "hero" && !sujet.hero.estIncarne && sujet.hero.etat !== "mort") {
      this.bouton(cadre, x + 20, y, 180, 32, "INCARNER", C.laiton, () => {
        const action = sujet.surIncarner;
        this.fermer();
        action();
      });
    }
    this.bouton(cadre, x + largeur - 140, y, 120, 32, "FERMER", 0x4a3a34, () =>
      this.fermer(),
    );
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
    // A la porte, la colonne est etroite et chaque resume prend deux lignes.
    h += 20 + Math.max(1, marques) * (sujet.genre === "arrivant" ? 26 : 16) + 10;

    if (sujet.genre === "arrivant") {
      // Trois colonnes : la fiche fait la hauteur de la plus haute des trois,
      // pas de leur somme. Les lignes d'observation sont enveloppees dans une
      // colonne etroite, donc on compte deux lignes par observation.
      h += 20 + sujet.arrivant.observations.length * 38 + 10;
      if (sujet.etatAnnonce !== undefined) h += 52;

      const hautColonnes = HAUTEUR_TITRE + 18;
      // Une question tient sur deux lignes dans 250 px, plus ses marges.
      const droite = hautColonnes + 18 + sujet.arrivant.questions.length * 46;

      let milieu = hautColonnes + 20;
      for (const question of sujet.arrivant.questions) {
        if (!sujet.arrivant.posees.includes(question.cle)) continue;
        milieu += 42 + (reponseA(sujet.arrivant, question).trahi ? 6 : 0);
      }

      return Math.max(h, droite, milieu) + 52;
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
    cadre.fillStyle(C.plaque, 1);
    cadre.fillRect(x, y, l, h);
    cadre.fillStyle(0x4a3a34, 1);
    cadre.fillRect(x, y, l, 1);
    cadre.fillStyle(0x0a0707, 1);
    cadre.fillRect(x, y + h - 1, l, 1);
    cadre.lineStyle(1, couleur, 1);
    cadre.strokeRect(x - 0.5, y - 0.5, l + 1, h + 1);
    this.texte(x + l / 2, y + Math.round((h - 12) / 2), espacer(libelle), 11, teinte(couleur))
      .setOrigin(0.5, 0);
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
    creux(g, { x, y, largeur: l, hauteur: h });
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
    const t = affuter(this.scene.add.text(x, y, contenu, { fontFamily: POLICE, fontSize: `${taille}px`, color: couleur }))
      .setDepth(2605);
    this.objets.push(t);
    return t;
  }

  /**
   * L'ogive autour du portrait : deux pans de fer qui coupent les coins du
   * haut en pointe, et un liseré de plaque tout autour.
   *
   * C'est la seule chose gothique de la fiche — un visage dans une arche, comme
   * sur une pierre tombale — et c'est ce qui fait de ce panneau **la fiche d'un
   * homme** et non un tableau de chiffres (direction du 10 septembre 2026).
   */
  private ogive(p: Plaque): void {
    const g = this.scene.add.graphics().setDepth(2605);
    g.fillStyle(C.fer, 1);
    const pointe = p.y - 2;
    const creux = p.y + p.hauteur * 0.3;
    g.fillTriangle(p.x - 1, pointe, p.x + p.largeur / 2, pointe, p.x - 1, creux);
    g.fillTriangle(p.x + p.largeur + 1, pointe, p.x + p.largeur / 2, pointe, p.x + p.largeur + 1, creux);
    // Le liseré suit l'arche : deux montants, et deux pans qui montent en pointe.
    g.lineStyle(2, 0x4a3a34, 1);
    g.beginPath();
    g.moveTo(p.x, p.y + p.hauteur);
    g.lineTo(p.x, creux);
    g.lineTo(p.x + p.largeur / 2, pointe + 1);
    g.lineTo(p.x + p.largeur, creux);
    g.lineTo(p.x + p.largeur, p.y + p.hauteur);
    g.strokePath();
    this.objets.push(g);
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
