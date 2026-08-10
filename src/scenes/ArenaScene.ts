import Phaser from "phaser";
import { Rng } from "../core/rng";
import { CLASSES, ORDRE_CLASSES, type ClassId } from "../core/classes";
import {
  competenceParId,
  propositionCompetence,
  propositionEvolution,
  tirerCompetences,
  type CompetenceDef,
  type EvolutionDef,
} from "../core/competences";
import { ARBRES, creerTexturesPlaceholder } from "../game/art";
import { oublierLesPortraits } from "../game/portraits";
import {
  Double,
  Ennemi,
  Familier,
  Hero,
  Invocation,
  MortVivant,
  orienter,
  rafraichirTeinte,
  SEUIL_REGARD,
  SEUIL_REGARD_PIXELS,
  type Capacite,
  type Dome,
} from "../game/entities";
import { choisirArchetype } from "../game/ennemis";
import { piloter, type ContexteIA } from "../core/ia";
import { animer, animerMort, declencher } from "../game/poses";
import {
  eclatImpact,
  flashCible,
  hitstop,
  majEffets,
  poufMort,
  preparerEffets,
  recul,
  secousse,
  tranche,
} from "../game/effets";
import {
  NOMS_FORMATION,
  NOMS_POSTURE,
  REGLAGES,
  TOLERANCE_ANCRE,
  type Point,
  type Posture,
} from "../core/ordres";
import { Affinites } from "../core/affinites";
import {
  EGLISE,
  frontsDeLaVague,
  MONDE,
  NOMS_FRONT,
  POSTES,
  PRATICABLE,
  pointDApparition,
  repartition,
  terrainEn,
  VILLAGE,
  type Front,
  type Terrain,
} from "../core/carte";
import { BatimentEglise } from "../game/eglise";
import {
  CONDITIONS,
  RELEVEMENT,
  lireCout,
  type BlocageMontee,
  type ContexteMontee,
  type EtatEglise,
  type NiveauEglise,
} from "../core/eglise";
import {
  Cycle,
  REGLAGES_CYCLE,
  delaiProchaineHorde,
  effectifDeLaNuit,
  intervalleDeLaNuit,
  puissanceDeLaNuit,
  tailleDeLaHorde,
} from "../core/cycle";
import { Village, type Villageois } from "../game/village";
import { Grille } from "../core/grille";
import { CONSTRUCTIONS, coutLisible, type TypeConstruction } from "../core/constructions";
import { Constructions, PORTEE_OCCUPATION, type Construction } from "../game/constructions";
import { Champs, REGLAGES_CHAMPS, type Champ } from "../game/champs";
import { NOMS_POSTURE_CIVILE } from "../core/habitants";
import {
  EFFETS_RUPTURE,
  NOMS_RUPTURE,
  REGLAGES_STRESS,
  avancerLaJournee,
  coeurLache,
  contracterEtat,
  descendreStress,
  monterStress,
  resistanceAuStress,
  stressDesEtatsDe,
  verifierExploits,
  verifierRupture,
  voirMourir,
} from "../core/personne";
import type { Habitant, PostureCivile, Ressource, Stocks } from "../core/habitants";
import type { Phase } from "../core/cycle";
import { Commandement } from "../game/commandement";
import {
  appliquer,
  capturer,
  ecrireEnLocal,
  effacerEnLocal,
  nouvelleIdentitePartie,
  type PartieEnCours,
} from "../game/sauvegarde";
import type { Emplacement, Sauvegarde } from "../core/sauvegarde";
import { effacer as effacerCloud, envoyer } from "../en-ligne/sauvegardeCloud";
import { enregistrerPartie } from "../en-ligne/parties";
import type { EtatEquipe } from "../game/hud";
import type { EtatOrdres } from "../game/panneauOrdres";
import type { GroupeAffiche } from "../game/fichePersonne";

/**
 * L'arene : combat, equipe, IA, progression.
 *
 * Le coeur du jeu (DESIGN.md §4.3) :
 *
 * - le joueur incarne un heros, l'IA joue tous les autres ;
 * - un heros IA se replie automatiquement a 20% de vie : l'IA ne perd jamais
 *   personne ;
 * - le joueur peut changer de heros a tout moment SAUF sous 20% de vie ;
 * - la mort est definitive.
 *
 * Consequence : un heros ne peut mourir que par une decision du joueur.
 */

/**
 * Le village remplace la cite au centre de l'arene : il est desormais adosse a
 * la mer et a la montagne (DESIGN.md §4.6). Le reste du code continue de
 * l'appeler CITE — c'est le meme refuge, il a juste demenage.
 */
const CITE = VILLAGE;
// La regeneration n'est plus une constante de scene : elle appartient a
// l'eglise et monte avec elle (`PALIERS[n].soinParSeconde`, §4.22).
const PORTEE_CORPS_A_CORPS = 90;

/**
 * Plafond d'ennemis vivants.
 *
 * Sans lui, la cadence d'apparition finit par depasser la vitesse a laquelle on
 * tue : les sprites s'accumulent, et le jeu s'effondre au bout de quelques
 * minutes. Le plafond ne rend pas le jeu plus facile — les ennemis restants
 * deviennent simplement plus forts.
 *
 * Il vaut desormais 60 et non 240 : le §4.19 fait baisser fortement le nombre a
 * l'ecran, et la difficulte remonte par la force des monstres. C'est aussi une
 * regle de lisibilite — a 240 on ne voyait plus le terrain qu'on defend.
 */
const MAX_ENNEMIS = REGLAGES_CYCLE.plafondEcran;

/**
 * Rayon dans lequel le heros incarne recolte a la main, autour d'un poste.
 *
 * Il recolte en frappant : on s'approche, l'attaque automatique s'en charge, et
 * aucune touche ne s'ajoute (§4.18).
 */
const RAYON_RECOLTE = 46;

/** Ce que l'interface lit du village, sans pouvoir y toucher. */
export interface EtatVillage {
  phase: Phase;
  jour: number;
  /** Avancement dans la phase, entre 0 et 1 */
  part: number;
  /** Temps restant avant la bascule, en millisecondes */
  restant: number;
  population: number;
  /** Vrai si quelqu'un court en ce moment : c'est ce qui fait clignoter */
  enFuite: boolean;
  habitants: Habitant[];
  stocks: Stocks;
  joursDeVivres: number;
  /**
   * La satisfaction du village, de 0 a 100 (DESIGN.md §4.23).
   *
   * Elle n'est pas decorative : c'est **elle qui debloque les niveaux
   * d'eglise**, et c'est ce qui referme la boucle du village.
   */
  satisfaction: number;
  /** L'eglise, telle que l'interface la lit (DESIGN.md §4.22) */
  eglise: {
    niveau: NiveauEglise;
    etat: EtatEglise;
    ratioPv: number;
    partRelevement: number;
    /** Combien d'habitants sont dedans en ce moment */
    refugies: number;
    /** Combien tiennent ses portes */
    defenseurs: number;
    /** Ce qui empeche le niveau suivant, vide si rien */
    manque: BlocageMontee[];
  };
}

/**
 * Jusqu'ou un monstre voit un heros (DESIGN.md §4.6).
 *
 * Au-dela, il ne le poursuit pas : il continue vers le village. C'est ce seul
 * nombre qui empeche le camping de fonctionner — un heros planque a l'autre bout
 * de la carte ne detourne plus personne des postes de travail.
 */
const RAYON_DE_VUE = 340;

/**
 * Ce qu'on peut poser sur la grille.
 *
 * Un champ n'est pas une construction — il ne bloque rien, il n'a pas de points
 * de vie, et on le traverse. Mais il se pose exactement de la meme facon, alors
 * il partage le meme mode et le meme apercu.
 */
type ModeBati = TypeConstruction | "champ";

/** Ce que chaque poste donne au joueur qui y frappe (DESIGN.md §4.18). */
const RECOLTE_DU_POSTE: Record<"pecheur" | "bucheron" | "mineur", Ressource> = {
  pecheur: "poisson",
  bucheron: "bois",
  mineur: "minerai",
};

/** Au-dela, on cesse d'afficher les nombres flottants : ils coutent cher. */
const MAX_TEXTES_FLOTTANTS = 24;

/**
 * Cadavres qui tombent en meme temps.
 *
 * Une capacite de zone tue parfois trente monstres dans la meme image : sans
 * plafond, ca ferait trente sprites et trente tweens d'un coup. Au-dela, le
 * pouf de particules suffit a raconter la mort.
 */
const MAX_CADAVRES = 24;

/** Impulsion rendue a un heros qui encaisse, en pixels par seconde. */
const FORCE_RECUL = 110;

/** Vitesse d'un crachat de monstre, en pixels par seconde. */
const VITESSE_CRACHAT = 210;

/** Rayon de l'explosion d'un kamikaze, en pixels. */
const RAYON_KAMIKAZE = 92;

/** Mort-vivants simultanes par Necromancien */
const MAX_MORTS_VIVANTS = 12;

/**
 * Le zoom de depart, et ses bornes.
 *
 * Il valait 3 du temps des placeholders, qui faisaient 18 px de haut : un heros
 * occupait donc une cinquantaine de pixels a l'ecran. Les sprites de
 * `src/assets/` en font 32, et on les affiche a leur taille native — les
 * reduire d'un facteur fractionnaire les transformerait en bouillie, et meme
 * une reduction de moitie leur mange la tete.
 *
 * C'est donc le zoom qui absorbe la difference : a 1,7 un heros retrouve ses
 * cinquante pixels a l'ecran. **L'empreinte visible est la meme qu'avant**, et
 * aucune donnee de jeu n'a bouge — ni vitesse, ni portee, ni hitbox.
 */
const ZOOM_DEFAUT = 1.7;
const ZOOM_MIN = 0.8;
const ZOOM_MAX = 3.4;

/**
 * Part de la direction demandee par l'IA reprise a chaque image.
 *
 * Assez haut pour que le heros reste reactif, assez bas pour qu'un changement
 * de cible ne se traduise pas par un demi-tour instantane.
 */
const LISSAGE_DIRECTION = 0.18;

/**
 * Pourquoi l'eglise refuse de monter, ecrit pour un humain (DESIGN.md §4.22).
 *
 * Quatre conditions dont on ne saurait pas laquelle bloque seraient
 * injouables : le refus doit toujours nommer ce qui manque, et le chiffre avec.
 *
 * @param niveauVise le niveau qu'on essaie d'atteindre
 */
function lireBlocages(manque: BlocageMontee[], niveauVise: 2 | 3 | 4): string {
  const requis = CONDITIONS[niveauVise];
  const mots = manque.map((cause) => {
    switch (cause) {
      case "materiaux":
        return lireCout(requis.materiaux);
      case "population":
        return `${requis.population} habitants`;
      case "argent":
        return `${requis.argent} pieces`;
      case "satisfaction":
        return `${requis.satisfaction}% de satisfaction`;
      case "a-terre":
        return "qu'elle soit relevee";
      default:
        return "rien, elle est au maximum";
    }
  });
  return mots.join(", ");
}

export class ArenaScene extends Phaser.Scene {
  private rng!: Rng;
  private heros: Hero[] = [];
  private indexIncarne = 0;
  /** Le poste de commandement : selection, ordres, formation (DESIGN.md §4.4) */
  commandement!: Commandement;
  private graphiquesOrdres!: Phaser.GameObjects.Graphics;
  /** Experience de groupe : combattre ensemble rend plus fort (DESIGN.md §4.16) */
  affinites = new Affinites();
  private prochainTickAffinites = 0;
  /** Le moral avance par battements, jamais par image (DESIGN.md §4.23) */
  private prochainBattementMoral = 0;
  private static readonly PERIODE_MORAL = 500;
  private equipe!: Phaser.Physics.Arcade.Group;
  private ennemis!: Phaser.Physics.Arcade.Group;
  private projectiles!: Phaser.Physics.Arcade.Group;
  /** Les crachats des monstres a distance : ils volent dans l'autre sens */
  private projectilesEnnemis!: Phaser.Physics.Arcade.Group;
  /** Tout ce qui se bat pour l'equipe sans etre un heros */
  private invocations!: Phaser.Physics.Arcade.Group;
  /** Instant a partir duquel un familier detruit peut revenir */
  private retourFamilier = new Map<Hero, number>();
  /** Contrat en cours de l'assassin : cette cible mourra */
  private contrats = new Map<Hero, Ennemi>();
  private domes: Dome[] = [];
  private orbiteurs = new Map<Hero, Phaser.GameObjects.Image[]>();
  private prochainTickOrbiteurs = 0;
  private prochainTickAuras = 0;
  private prochainTickEclats = 0;
  /** Heros qui encaisse actuellement pour toute l'equipe (Martyre) */
  private martyr: Hero | null = null;
  /** La Resurrection de l'Oracle ne joue qu'une fois par partie */
  private resurrectionUtilisee = false;
  /** Instant de fin de l'Heure sombre : tout est fige jusque-la */
  private figeJusqua = 0;
  /** Reserve de textes flottants, recycles au lieu d'etre recrees */
  private textesLibres: Phaser.GameObjects.Text[] = [];
  private textesActifs = 0;
  /** Heros ciblables, recalcules une fois par image et non par ennemi */
  private ciblesPossibles: Hero[] = [];
  /** Cadavres en train de tomber : plafonnes, une mort en masse coute cher */
  private cadavres = 0;
  /** Archetypes deja croises, pour n'annoncer chacun qu'une fois */
  private archetypesVus = new Set<string>();

  private zqsd!: Record<string, Phaser.Input.Keyboard.Key>;
  private fleches!: Phaser.Types.Input.Keyboard.CursorKeys;
  private touchesCapacites: Phaser.Input.Keyboard.Key[][] = [];

  private destination: Phaser.Math.Vector2 | null = null;
  private marqueur: Phaser.GameObjects.Image | null = null;

  private debut = 0;
  private prochaineApparition = 0;
  /** Les fronts ouverts en ce moment (DESIGN.md §4.6) */
  private fronts: Front[] = ["nord"];
  private partPremierFront = 1;
  private kills = 0;
  private termine = false;

  /** L'horloge de la partie : jour, nuit, numero de journee (DESIGN.md §4.19) */
  cycle = new Cycle();
  /** Les habitants, leurs postes et les stocks (DESIGN.md §4.18) */
  village!: Village;
  /**
   * L'eglise : refuge, seul lieu de soin, et cap des monstres (DESIGN.md §4.22).
   *
   * Elle remplace le cercle `CITE` dans ces trois roles. `CITE` ne decrit plus
   * que l'etendue du bati — et c'est encore lui qui sert d'ancre par defaut aux
   * ordres, ce qui est correct : une ancre est un point de rassemblement, pas
   * un refuge.
   */
  eglise!: BatimentEglise;
  /** Ce qu'il reste a faire arriver de l'effectif de la nuit en cours */
  private resteDeLaNuit = 0;
  /** Instant de la prochaine horde de jour, et de celle qu'on vient d'annoncer */
  private prochaineHorde = 0;
  private hordeAuDepart = 0;
  private tailleHordeEnRoute = 0;
  /** Le voile de nuit : une seule image noire, dont on module l'opacite */
  private voile!: Phaser.GameObjects.Rectangle;
  /** Recolte manuelle accumulee, pour n'afficher un nombre que de loin en loin */
  private cumulRecolte = 0;
  private prochainGesteRecolte = 0;

  /** La carte en grille modifiable : c'est elle qu'on batit (DESIGN.md §4.21) */
  grille = new Grille();
  /** Les murs et les tours (DESIGN.md §4.20) */
  constructions!: Constructions;
  /** Les champs de ble : ils poussent, et une horde les ruine (§4.18) */
  champs!: Champs;
  /** Ce qu'on s'apprete a poser ; null quand le mode construction est ferme */
  private enConstruction: ModeBati | null = null;
  /** L'apercu fantome, cree une fois et deplace : jamais recree (§4.17) */
  private fantome!: Phaser.GameObjects.Image;
  /** La tour dans laquelle se tient le heros incarne, s'il y en a une */
  private tourDuHero: Construction | null = null;

  private enPause = false;
  /**
   * Vrai pendant qu'on renomme quelqu'un dans la fiche (DESIGN.md §4.18).
   *
   * ⚠️ Sans lui, taper un nom **joue** : « Bertrand » sonne la cloche (B),
   * ouvre le tableau du village (F) et bâtit une palissade (G). Le jeu continue
   * de tourner pendant la saisie — c'est voulu, on ne met pas la partie en
   * pause pour un prenom — mais il n'ecoute plus les touches.
   */
  private saisieEnCours = false;
  /** Vrai quand la pause vient de la fenetre, pas du menu de choix */
  private pauseHorsFocus = false;
  private debutPause = 0;
  private modeChoix: "competence" | "evolution" = "competence";
  private competenceEnEvolution: CompetenceDef | null = null;
  private optionsEvolution: EvolutionDef[] = [];

  // ------------------------------------------------------------ la sauvegarde

  /** L'emplacement joue, de 1 a 3 (DESIGN.md §4.28) */
  private emplacement: Emplacement = 1;
  /** La partie a reprendre, posee par `init` et consommee par `create` */
  private reprise: Sauvegarde | null = null;
  private identitePartie = "";
  private revision = 0;
  /** Millisecondes de jeu cumulees, sessions precedentes comprises */
  private dureeJouee = 0;

  constructor() {
    super("arena");
  }

  init(data: { classe?: ClassId; emplacement?: Emplacement; reprise?: Sauvegarde }): void {
    this.registry.set("classe", data.classe ?? "guerrier");
    this.emplacement = data.emplacement ?? 1;
    this.reprise = data.reprise ?? null;
    // Une partie neuve prend une identite neuve ; une partie reprise garde la
    // sienne, et c'est elle qui permet de reconnaitre la meme lignee d'un
    // appareil a l'autre (§4.28).
    this.identitePartie = data.reprise?.partie ?? nouvelleIdentitePartie();
    this.revision = data.reprise?.revision ?? 0;
    this.dureeJouee = data.reprise?.dureeJouee ?? 0;
    this.heros = [];
    this.indexIncarne = 0;
    this.kills = 0;
    this.termine = false;
    this.enPause = false;
    this.destination = null;
    this.marqueur = null;
    this.domes = [];
    this.orbiteurs = new Map();
    this.retourFamilier = new Map();
    this.contrats = new Map();
    this.textesLibres = [];
    this.textesActifs = 0;
    this.ciblesPossibles = [];
    this.cadavres = 0;
    this.archetypesVus = new Set();
    this.martyr = null;
    this.resurrectionUtilisee = false;
    this.figeJusqua = 0;
    // Une nouvelle partie, une nouvelle equipe : les liens ne se transmettent
    // pas. Ils le feront le jour ou les heros survivront a une partie (§4.12).
    this.affinites = new Affinites();
    this.prochainTickAffinites = 0;
    this.fronts = ["nord"];
    this.partPremierFront = 1;
    this.cycle = new Cycle();
  }

  get hero(): Hero {
    return this.heros[this.indexIncarne]!;
  }

  /**
   * Ce que l'interface a besoin de savoir du village.
   *
   * Un objet neuf par image serait du gaspillage, mais il ne contient que des
   * nombres et des references : c'est le meme cout qu'un appel de methode, et ca
   * garde `UiScene` incapable de modifier quoi que ce soit.
   */
  get etatVillage(): EtatVillage {
    return {
      phase: this.cycle.phase,
      jour: this.cycle.jour,
      part: this.cycle.part,
      restant: this.cycle.restant,
      population: this.village.population,
      enFuite: this.village.vivants.some((v) => v.etat === "fuite"),
      habitants: this.village.habitants.map((v) => v.regles),
      stocks: this.village.stocks,
      joursDeVivres: this.village.joursDeVivres,
      satisfaction: this.village.satisfaction,
      eglise: {
        niveau: this.eglise.niveau,
        etat: this.eglise.regles.etat,
        ratioPv: this.eglise.regles.ratioPv,
        partRelevement: this.eglise.regles.partRelevement,
        refugies: this.village.refugies,
        defenseurs: this.village.defenseurs,
        manque: this.eglise.regles.peutMonter(this.contexteMontee).manque,
      },
    };
  }

  /**
   * Ce que l'eglise a besoin de savoir du village pour monter (§4.22).
   *
   * ⚠️ **La satisfaction n'est plus neutralisee** : le bloc 5 la remplit, donc
   * la troisieme des quatre conditions mord pour de bon. Seul `argent` reste
   * absent — il vient du port, au bloc 6 — et `undefined` veut toujours dire
   * « ce systeme n'existe pas encore », surtout pas « zero ».
   */
  private get contexteMontee(): ContexteMontee {
    return {
      stocks: this.village.stocks,
      population: this.village.population,
      satisfaction: this.village.satisfaction,
    };
  }

  get resume(): { secondes: number; kills: number; niveau: number } {
    return {
      secondes: Math.floor((this.time.now - this.debut) / 1000),
      kills: this.kills,
      niveau: this.hero?.niveau ?? 1,
    };
  }

  get etatEquipe(): EtatEquipe {
    return {
      heros: this.heros,
      indexIncarne: this.indexIncarne,
      changementAutorise: this.changementAutorise(),
      selection: this.commandement?.selectionnes ?? [],
    };
  }

  /**
   * Les liens d'un heros avec le reste de l'equipe, pour sa fiche
   * (DESIGN.md §4.16). Un systeme invisible ne change aucune decision.
   */
  groupeDe(hero: Hero): GroupeAffiche {
    return {
      bonus: hero.bonusGroupe,
      liens: this.heros
        .filter((autre) => autre !== hero && autre.estVivant)
        .map((autre) => ({
          nom: autre.classe.nom,
          force: this.affinites.affinite(hero.identifiant, autre.identifiant),
        })),
    };
  }

  /** Ce que l'interface doit savoir des ordres en cours (DESIGN.md §4.4). */
  get etatOrdres(): EtatOrdres {
    const vises = this.commandement?.destinataires(this.hero ?? null) ?? [];
    const postures = new Set(vises.map((h) => h.ordre.posture));
    return {
      formation: this.commandement?.formation ?? "libre",
      // Une seule posture affichee quand toute la selection est d'accord :
      // annoncer « Agressif » alors que la moitie temporise serait un mensonge.
      posture: postures.size === 1 ? [...postures][0]! : null,
      nombreVises: vises.length,
      selectionExplicite: !(this.commandement?.selectionVide ?? true),
      message:
        this.time.now - (this.commandement?.dernierMessageA ?? 0) < 1600
          ? this.commandement.dernierMessage
          : "",
    };
  }

  // ----------------------------------------------------------- construction

  create(): void {
    const graine = Date.now() % 1_000_000;
    this.rng = new Rng(graine);
    console.log(`[arene] graine = ${graine}`);

    creerTexturesPlaceholder(this);
    // Les visages de la partie precedente n'ont plus personne derriere eux :
    // les garder ferait grossir l'atlas a chaque `R` (§4.17).
    oublierLesPortraits(this);
    // Les emetteurs de particules sont crees une fois pour toute la partie :
    // il y a jusqu'a MAX_ENNEMIS combattants, on n'en fabrique pas un par coup.
    preparerEffets(this);
    this.construireDecor();

    this.equipe = this.physics.add.group();
    this.ennemis = this.physics.add.group();
    this.projectiles = this.physics.add.group();
    this.projectilesEnnemis = this.physics.add.group();
    this.invocations = this.physics.add.group();
    this.composerEquipe();
    this.commandement = new Commandement(this.heros);
    // Sous les personnages : les reperes d'ordres ne doivent jamais masquer le
    // combat.
    this.graphiquesOrdres = this.add.graphics().setDepth(-400);

    // La mer et la montagne ne sont pas du decor : le monde physique s'arrete
    // a la plage et a la lisiere (DESIGN.md §4.6).
    this.physics.world.setBounds(
      PRATICABLE.x,
      PRATICABLE.y,
      PRATICABLE.largeur,
      PRATICABLE.hauteur,
    );
    this.cameras.main.setBounds(0, 0, MONDE.largeur, MONDE.hauteur);
    this.cameras.main.setZoom(ZOOM_DEFAUT);
    this.cameras.main.startFollow(this.hero, true, 0.12, 0.12);
    this.configurerZoom();
    this.configurerTouches();
    this.configurerSouris();

    this.physics.add.overlap(this.equipe, this.ennemis, (h, e) =>
      this.contactEnnemi(h as Hero, e as Ennemi),
    );
    this.physics.add.overlap(this.projectiles, this.ennemis, (p, e) =>
      this.impactProjectile(p as Phaser.Physics.Arcade.Image, e as Ennemi),
    );
    this.physics.add.overlap(this.projectilesEnnemis, this.equipe, (p, h) =>
      this.impactCrachat(p as Phaser.Physics.Arcade.Image, h as Hero),
    );
    this.physics.add.overlap(this.invocations, this.ennemis, (m, e) =>
      this.melee(m as Invocation, e as Ennemi),
    );

    this.construireVillageVivant();

    this.scene.launch("ui", { arene: this });
    this.events.on("choix-fait", this.resoudreChoix, this);
    this.events.on("changer-hero", this.changerHero, this);
    this.events.on("selectionner", this.selectionnerDepuisUi, this);
    this.events.on("posture-habitant", this.tournerPostureCivile, this);
    this.events.on("poste-habitant", this.tournerPosteCivil, this);
    this.events.on("saisie-clavier", (enCours: boolean) => (this.saisieEnCours = enCours), this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.events.off("choix-fait", this.resoudreChoix, this);
      this.events.off("changer-hero", this.changerHero, this);
      this.events.off("selectionner", this.selectionnerDepuisUi, this);
      this.events.off("posture-habitant", this.tournerPostureCivile, this);
      this.events.off("poste-habitant", this.tournerPosteCivil, this);
    });

    this.debut = this.time.now;
    this.prochaineApparition = this.time.now + 1200;
    this.programmerHorde();

    // La reprise vient **apres** que tout a ete monte normalement : le monde
    // neuf est construit, puis remplace piece par piece (§4.28). Un second
    // chemin de construction aurait diverge du premier des le bloc suivant.
    if (this.reprise) {
      this.reprendreLaPartie(this.reprise);
      this.reprise = null;
    } else {
      this.events.emit("annonce", "Jour 1 — le village se reveille");
      this.enregistrer();
    }

    this.surveillerLaFermeture();
  }

  /** Le monde vivant, tel que la sauvegarde le voit (§4.28). */
  private get partieEnCours(): PartieEnCours {
    return {
      scene: this,
      equipe: this.equipe,
      rng: this.rng,
      cycle: this.cycle,
      village: this.village,
      eglise: this.eglise,
      constructions: this.constructions,
      champs: this.champs,
      heros: this.heros,
      indexIncarne: this.indexIncarne,
      kills: this.kills,
      dureeJouee: this.dureeJouee + (this.time.now - this.debut),
      partie: this.identitePartie,
      revision: this.revision,
    };
  }

  private reprendreLaPartie(sauvegarde: Sauvegarde): void {
    const monde = this.partieEnCours;
    this.indexIncarne = appliquer(sauvegarde, monde, this.time.now);
    // `appliquer` remplace le tirage et l'equipe : la scene reprend ce que le
    // pont a repose.
    this.rng = monde.rng;
    this.kills = monde.kills;
    this.dureeJouee = sauvegarde.dureeJouee;
    this.debut = this.time.now;

    const incarne = this.heros[this.indexIncarne];
    if (incarne) {
      incarne.estIncarne = true;
      this.cameras.main.startFollow(incarne, true, 0.12, 0.12);
    }
    this.commandement = new Commandement(this.heros);
    this.teinterLeCiel();
    if (this.cycle.phase === "nuit") {
      // La nuit reprend la ou elle en etait : l'effectif restant se recompose a
      // partir du cycle, il ne se stocke pas monstre par monstre.
      this.resteDeLaNuit = effectifDeLaNuit(this.cycle.nuit);
      this.village.tomberLaNuit();
      this.fronts = frontsDeLaVague(this.cycle.nuit, this.rng.next());
      this.partPremierFront = repartition(this.fronts, this.rng.next());
    }

    const moment = this.cycle.phase === "nuit" ? "Nuit" : "Jour";
    this.events.emit("annonce", `${moment} ${this.cycle.jour} — la partie reprend`);
  }

  /**
   * La page qu'on quitte (§4.28).
   *
   * `visibilitychange` et non `unload` : c'est le seul evenement que les
   * navigateurs mobiles emettent de facon fiable quand on change d'onglet ou
   * qu'on verrouille l'ecran, et `unload` ne se declenche parfois jamais.
   */
  private surveillerLaFermeture(): void {
    const partant = () => {
      if (document.visibilityState === "hidden") this.enregistrer(true);
    };
    document.addEventListener("visibilitychange", partant);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
      document.removeEventListener("visibilitychange", partant),
    );
  }

  /**
   * On enregistre (§4.28).
   *
   * Le local d'abord, toujours, et sans condition : c'est lui la sauvegarde.
   * Le cloud ensuite, si un compte est connecte, et **au plus une fois par
   * minute** — le dernier etat gagne, rien n'est mis en file. Aucun `await`
   * ici : le jeu ne s'arrete pas pour attendre le reseau.
   *
   * ⚠️ **Regle ironman** : on ecrase, toujours, mort comprise. Fermer l'onglet
   * apres avoir perdu un heros ne le ramene pas (§4.3).
   */
  private enregistrer(force = false): void {
    if (!this.village) return;

    this.revision += 1;
    const sauvegarde = capturer(this.partieEnCours, this.time.now);
    ecrireEnLocal(this.emplacement, sauvegarde);
    void envoyer(this.emplacement, sauvegarde, force);
  }

  /**
   * Le village vivant : les habitants, le voile de nuit, la pause hors focus.
   *
   * Le voile est **un seul rectangle** dont on module l'opacite : le §4.17
   * interdit de creer des objets en plein jeu, et un fondu jour/nuit qui
   * fabriquerait des calques serait exactement ce piege.
   */
  private construireVillageVivant(): void {
    // L'eglise **avant** les habitants : ils naissent a son pied et leur premier
    // reflexe est d'y rentrer, elle doit donc deja exister (§4.22).
    this.eglise = new BatimentEglise(this, {
      annoncer: (message) => this.events.emit("annonce", message),
      effondrement: (x, y) => {
        poufMort(this, x, y, 0x8a7f6d);
        secousse(this, "fort");
        this.village.viderLEglise();
      },
    });

    this.village = new Village(this, {
      menaceAutour: (x, y, rayon) => this.ennemiLePlusProche(x, y, rayon),
      annoncer: (message) => this.events.emit("annonce", message),
      egliseDebout: () => this.eglise.fonctionne,
      niveauEglise: () => this.eglise.niveau,
      litsEglise: () => this.eglise.regles.palier.lits,
      frapperMonstre: (x, y, portee, degats) => this.frapperPourLeVillage(x, y, portee, degats),
    });

    // Un monstre qui rattrape un habitant le tue : c'est la seule fenetre ou on
    // peut le perdre, et elle ne s'ouvre que si ce flanc a ete laisse sans
    // personne (DESIGN.md §4.18).
    this.physics.add.overlap(this.village.groupe, this.ennemis, (v, e) =>
      this.rattraperHabitant(v as Villageois, e as Ennemi),
    );

    // Les murs et les tours. Ils arretent les corps : la collision suffit, on
    // n'a rien a calculer par image.
    this.constructions = new Constructions(this, this.grille);
    this.champs = new Champs(this, this.grille);
    // Un champ ne bloque personne : on le traverse — et le traverser le ruine.
    this.physics.add.overlap(this.ennemis, this.champs.groupe, (_e, c) =>
      this.pietinerChamp(c as Champ),
    );
    this.physics.add.collider(this.ennemis, this.constructions.groupe, (e, c) =>
      this.cognerConstruction(e as Ennemi, c as Construction),
    );
    this.physics.add.collider(this.equipe, this.constructions.groupe);
    this.physics.add.collider(this.village.groupe, this.constructions.groupe);

    // Les monstres butent sur l'eglise et la frappent : c'est leur cap, c'est ce
    // qu'ils viennent detruire (§4.22).
    //
    // ⚠️ On ne suppose **pas** l'ordre des deux arguments. Phaser le decide
    // selon la nature des operandes — groupe contre objet unique, il donne
    // l'objet en premier — et le supposer coutait une exception par contact,
    // trouvee en jouant et invisible a la compilation.
    this.physics.add.collider(this.ennemis, this.eglise.sprite, (a, b) => {
      const monstre = a === this.eglise.sprite ? b : a;
      this.cognerEglise(monstre as Ennemi);
    });
    this.physics.add.collider(this.equipe, this.eglise.sprite);

    this.fantome = this.add
      .image(0, 0, "mur")
      .setAlpha(0.55)
      .setVisible(false)
      .setDepth(880);

    this.voile = this.add
      .rectangle(0, 0, MONDE.largeur, MONDE.hauteur, 0x0a0a1e)
      .setOrigin(0)
      .setAlpha(0)
      // Au-dessus du monde, sous l'interface : la nuit assombrit le terrain,
      // jamais les informations.
      .setDepth(900);

    // « Quand on n'est pas sur l'ecran, ca met pause et tout s'arrete » : une
    // journee dure 30 minutes reelles, aller chercher un cafe couterait un
    // habitant.
    this.game.events.on(Phaser.Core.Events.BLUR, this.suspendre, this);
    this.game.events.on(Phaser.Core.Events.FOCUS, this.reprendre, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off(Phaser.Core.Events.BLUR, this.suspendre, this);
      this.game.events.off(Phaser.Core.Events.FOCUS, this.reprendre, this);
    });
  }

  private suspendre(): void {
    // Le menu de choix met deja le jeu en pause, et c'est lui qui decidera du
    // degel : on ne se met pas en travers.
    if (this.enPause || this.termine) return;
    this.enPause = true;
    this.pauseHorsFocus = true;
    this.debutPause = this.time.now;
    this.physics.pause();
  }

  private reprendre(): void {
    if (!this.pauseHorsFocus || this.termine) return;
    this.pauseHorsFocus = false;
    // Le temps passe fenetre en arriere-plan ne doit rien declencher au retour :
    // c'est exactement le decalage que le menu de choix applique deja.
    this.decalerLeTemps(this.time.now - this.debutPause);
    this.physics.resume();
    this.enPause = false;
  }

  /**
   * Rend a tout le monde le temps passe en pause.
   *
   * Sans ce decalage, une pause de dix secondes ferait arriver a echeance d'un
   * seul coup tous les rechargements, tous les coups armes et toutes les
   * apparitions — la vague entiere frapperait dans l'image de la reprise.
   */
  private decalerLeTemps(pause: number): void {
    for (const hero of this.heros) hero.decalerRechargements(pause);
    for (const objet of this.ennemis.getChildren()) (objet as Ennemi).decaler(pause);
    this.prochaineApparition += pause;
    this.prochaineHorde += pause;
    if (this.hordeAuDepart > 0) this.hordeAuDepart += pause;
  }

  /**
   * Jalon 3 : l'equipe complete est donnee d'emblee, pour pouvoir eprouver le
   * changement de heros et l'IA. Le vrai recrutement, avec ses rangs, arrive au
   * jalon 8 (DESIGN.md §4.1).
   */
  private composerEquipe(): void {
    const choisie = this.registry.get("classe") as ClassId;
    const ordre = [choisie, ...ORDRE_CLASSES.filter((id) => id !== choisie)];

    ordre.forEach((id, i) => {
      const angle = (i / ordre.length) * Math.PI * 2;
      const hero = new Hero(
        this,
        CITE.x + Math.cos(angle) * 60,
        CITE.y + Math.sin(angle) * 60,
        CLASSES[id],
      );
      hero.estIncarne = i === 0;
      this.heros.push(hero);
      this.equipe.add(hero);
    });
  }

  /**
   * La carte du village (DESIGN.md §4.6) : la mer a l'ouest, la montagne au
   * sud, et le village blotti dans l'angle. Les deux fronts restent ouverts au
   * nord et a l'est.
   *
   * Tout est pose une fois pour toutes ici. Rien de ce decor n'est recree en
   * cours de partie (§4.17).
   */
  private construireDecor(): void {
    // Tout le sol tient dans une seule image, cuite au demarrage : la mer
    // etagee, le littoral qui serpente, la plage, la foret et la roche.
    this.add.image(0, 0, "carte").setOrigin(0).setDepth(-1000);

    this.semerLeDecor();
    this.construireVillage();
    this.marquerLesPostes();
  }

  /**
   * Arbres et rochers, semes avec une graine fixe pour que la carte soit la
   * meme d'une partie a l'autre : on doit pouvoir apprendre son terrain.
   *
   * Chaque graine est refusee si elle ne tombe pas sur le bon sol. Sans ce
   * filtre, il poussait des arbres dans la mer et au milieu du village.
   */
  private semerLeDecor(): void {
    const rng = new Rng(20260807);

    const semer = (
      essais: number,
      sols: Terrain[],
      poser: (x: number, y: number) => void,
      zone?: { x0: number; x1: number; y0: number; y1: number },
    ) => {
      const cadre = zone ?? { x0: 0, x1: MONDE.largeur, y0: 0, y1: MONDE.hauteur };
      for (let i = 0; i < essais; i++) {
        const x = rng.range(cadre.x0, cadre.x1);
        const y = rng.range(cadre.y0, cadre.y1);
        if (!sols.includes(terrainEn(x, y))) continue;
        // Le village est une place, pas une clairiere : rien n'y pousse.
        if (Phaser.Math.Distance.Between(x, y, CITE.x, CITE.y) < CITE.rayon + 26) continue;
        poser(x, y);
      }
    };

    /**
     * Un element de decor, pose a sa taille native.
     *
     * Plus de `setScale(rng.range(...))` : une echelle fractionnaire donne des
     * pixels de tailles inegales, ce qui saute aux yeux sur du vrai pixel-art.
     * La variete vient desormais des cinq silhouettes d'arbre et du miroir
     * horizontal, qui ne coutent aucun flou.
     */
    const poser = (x: number, y: number, cle: string) => {
      this.add.image(x, y, cle).setDepth(y).setFlipX(rng.next() < 0.5);
    };

    /**
     * Les tirages sont exprimes **par million de pixels de carte**, pas en
     * nombre absolu : agrandir le monde ne doit pas le vider. Un compte fixe
     * repartit les memes arbres sur une surface plus grande, et la foret se
     * clairseme toute seule des qu'on touche a `MONDE`.
     */
    const tirages = (parMegapixel: number) =>
      Math.round(((MONDE.largeur * MONDE.hauteur) / 1_000_000) * parMegapixel);

    // La foret du sud. Elle doit etre **dense** : c'est elle qui rend le flanc
    // sud credible. Deux fois moins serree qu'au temps des placeholders, parce
    // que les arbres de `src/assets/` couvrent trois fois plus de surface : a
    // densite egale, la foret devenait un mur opaque au-dessus du combat.
    semer(tirages(830), ["sous-bois"], (x, y) => poser(x, y, rng.pick(ARBRES)));

    // Des bosquets epars sur la prairie : le decor ne doit jamais etre un fond
    // uni, mais il ne doit pas non plus masquer les personnages (§4.11).
    semer(tirages(365), ["herbe"], (x, y) => {
      if (rng.next() > 0.22) return;
      poser(x, y, rng.pick(ARBRES));
    });

    // Les rochers, sur l'eboulis et au pied de la montagne.
    semer(tirages(470), ["eboulis", "roche"], (x, y) => {
      if (rng.next() > 0.3) return;
      poser(x, y, "rocher");
    });
  }

  /**
   * Le village. Encore un cercle de pierre : ses batiments et ses habitants
   * arrivent au bloc suivant du jalon 5. Ce qui change deja, c'est qu'il n'est
   * plus au centre — il est adosse a la mer et a la montagne.
   */
  private construireVillage(): void {
    const rng = new Rng(20260808);

    // La palissade, ouverte au nord et a l'est : c'est par la que ca arrive,
    // et une enceinte fermee ferait mentir la carte.
    for (let i = 0; i < 30; i++) {
      const a = (i / 30) * Math.PI * 2;
      const versLesFronts = Math.cos(a) > 0.55 || Math.sin(a) < -0.55;
      if (versLesFronts && i % 3 !== 0) continue;
      const x = CITE.x + Math.cos(a) * CITE.rayon;
      const y = CITE.y + Math.sin(a) * CITE.rayon;
      this.add.image(x, y, "mur").setDepth(y - 4);
    }

    // Les maisons, en couronne autour de la place centrale. Elles sont posees
    // une fois pour toutes : le village en ruine et sa restauration arrivent
    // au jalon 7.
    const maisons = ["maison-bleue", "maison-rouge", "maison-jaune"];
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + 0.4;
      const rayon = CITE.rayon * rng.range(0.55, 0.78);
      const x = CITE.x + Math.cos(a) * rayon;
      const y = CITE.y + Math.sin(a) * rayon;
      // Taille native, comme le reste du decor : trois toits de couleurs
      // differentes suffisent a ce qu'aucune maison ne soit la copie de sa
      // voisine, et une maison mise a l'echelle perdrait sa nettete.
      this.add.image(x, y, rng.pick(maisons)).setDepth(y);
    }

    this.add
      .text(CITE.x, CITE.y - CITE.rayon - 18, "LE VILLAGE", {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#f2e9d8",
      })
      .setOrigin(0.5)
      .setDepth(-930);
  }

  /**
   * Les postes de travail (DESIGN.md §4.18). Ils ne produisent encore rien :
   * ce sont pour l'instant des reperes, mais ce sont deja les endroits que la
   * defense devra couvrir.
   */
  private marquerLesPostes(): void {
    for (const poste of POSTES) {
      const g = this.add.graphics().setDepth(-945);
      g.lineStyle(2, 0xd8c48a, 0.5);
      g.strokeCircle(poste.position.x, poste.position.y, 34);
      this.add
        .text(poste.position.x, poste.position.y - 48, poste.nom.toUpperCase(), {
          fontFamily: "monospace",
          fontSize: "10px",
          color: "#d8c48a",
        })
        .setOrigin(0.5)
        .setDepth(-930);
    }
  }

  // -------------------------------------------------------------- controles

  private configurerZoom(): void {
    this.input.on("wheel", (_p: unknown, _o: unknown, _dx: number, dy: number) => {
      const cam = this.cameras.main;
      cam.setZoom(Phaser.Math.Clamp(cam.zoom - dy * 0.0016, ZOOM_MIN, ZOOM_MAX));
    });
  }

  /**
   * Gauche, c'est *moi* ; droite, c'est *les autres* (DESIGN.md §4.4).
   * Le combat ne s'arrete jamais pour donner un ordre.
   */
  private configurerSouris(): void {
    // Sans ca, le clic droit ouvre le menu du navigateur en plein combat.
    this.input.mouse?.disableContextMenu();

    const viser = (pointeur: Phaser.Input.Pointer) => {
      if (this.termine || this.enPause) return;
      const point = this.cameras.main.getWorldPoint(pointeur.x, pointeur.y);
      this.destination = new Phaser.Math.Vector2(point.x, point.y);
      this.montrerMarqueur();
    };

    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      if (this.termine || this.enPause) return;
      // En mode construction, le clic gauche batit : c'est la seule chose qu'on
      // fasse d'un clic a ce moment-la, et le clic droit continue de commander.
      if (!p.rightButtonDown() && this.enConstruction) {
        const point = this.cameras.main.getWorldPoint(p.x, p.y);
        this.batirIci(point.x, point.y);
        return;
      }
      if (p.rightButtonDown()) this.ordonnerAncre(p);
      else viser(p);
    });
    // Maintenir guide le heros ; le clic droit, lui, ne se maintient pas.
    this.input.on(
      "pointermove",
      (p: Phaser.Input.Pointer) =>
        p.isDown && !p.rightButtonDown() && !this.enConstruction && viser(p),
    );
  }

  // ------------------------------------------------------------ commandement

  /**
   * Clic droit : la selection va tenir ce point. Sur un allie, elle le suit
   * partout — proteger quelqu'un, c'est s'ancrer sur lui (DESIGN.md §4.4).
   */
  private ordonnerAncre(pointeur: Phaser.Input.Pointer): void {
    const point = this.cameras.main.getWorldPoint(pointeur.x, pointeur.y);
    const protege = this.alliePres(point.x, point.y);
    const incarne = this.hero ?? null;

    const nombre = this.commandement.ancrer(
      protege ? { x: protege.x, y: protege.y } : { x: point.x, y: point.y },
      protege ?? null,
      incarne,
      this.sbires,
    );
    if (nombre === 0) return;

    this.effetCercle(point.x, point.y, protege ? 34 : 22, protege ? 0x7ee0a0 : 0x5ec8f0);
    this.annoncer(
      protege
        ? `${nombre} protege${nombre > 1 ? "nt" : ""} ${protege.classe.nom}`
        : `${nombre} en route`,
    );
  }

  /** Le heros le plus proche du clic, s'il est assez pres pour etre vise. */
  private alliePres(x: number, y: number): Hero | null {
    let meilleur: Hero | null = null;
    let distance = 26;
    for (const hero of this.heros) {
      if (!hero.estVivant) continue;
      const d = Phaser.Math.Distance.Between(x, y, hero.x, hero.y);
      if (d < distance) {
        distance = d;
        meilleur = hero;
      }
    }
    return meilleur;
  }

  private ordonnerPosture(posture: Posture): void {
    const nombre = this.commandement.donnerPosture(posture, this.hero ?? null, this.sbires);
    if (nombre > 0) this.annoncer(`${nombre} · ${NOMS_POSTURE[posture]}`);
  }

  private changerFormation(): void {
    const formation = this.commandement.changerFormation();
    this.annoncer(`Formation : ${NOMS_FORMATION[formation]}`);
  }

  private rompre(): void {
    this.commandement.rompre(this.sbires);
    this.annoncer("Rompez");
  }

  /** Clic droit sur un portrait, transmis par l'interface. */
  private selectionnerDepuisUi(index: number, touteLaClasse: boolean): void {
    const hero = this.heros[index];
    if (!hero || !hero.estVivant) return;
    if (touteLaClasse) this.commandement.selectionnerClasse(hero.classe.id);
    else this.commandement.basculer(hero);
  }

  private annoncer(message: string): void {
    this.commandement.annoncer(message, this.time.now);
  }

  private get sbires(): Invocation[] {
    return (this.invocations.getChildren() as Invocation[]).filter((i) => i.active);
  }

  private montrerMarqueur(): void {
    if (!this.destination) return;
    this.marqueur ??= this.add
      .image(0, 0, "impact")
      .setTint(0xfff0a0)
      .setAlpha(0.5)
      .setScale(0.9)
      .setDepth(-500);
    this.marqueur.setPosition(this.destination.x, this.destination.y).setVisible(true);
  }

  private effacerDestination(): void {
    this.destination = null;
    this.marqueur?.setVisible(false);
  }

  private configurerTouches(): void {
    const clavier = this.input.keyboard;
    if (!clavier) return;
    this.zqsd = clavier.addKeys("Z,Q,S,D") as Record<string, Phaser.Input.Keyboard.Key>;
    this.fleches = clavier.createCursorKeys();

    const K = Phaser.Input.Keyboard.KeyCodes;
    // ESPACE en plus du 1 : sur AZERTY la rangee des chiffres demande Shift.
    const codesParCapacite = [
      [K.ONE, K.NUMPAD_ONE, K.SPACE],
      [K.TWO, K.NUMPAD_TWO],
      [K.THREE, K.NUMPAD_THREE],
      [K.FOUR, K.NUMPAD_FOUR],
      [K.FIVE, K.NUMPAD_FIVE],
    ];
    this.touchesCapacites = codesParCapacite.map((codes) => codes.map((c) => clavier.addKey(c)));

    // A et E encadrent ZQSD : on change de heros sans lacher les deplacements.
    clavier.addKey(K.A).on("down", () => this.changerHeroRelatif(-1));
    clavier.addKey(K.E).on("down", () => this.changerHeroRelatif(1));

    // Les ordres tombent sous la rangee de deplacement : la main gauche
    // commande sans jamais lacher ZQSD (DESIGN.md §4.4).
    const ordres: [number, () => void][] = [
      [K.W, () => this.ordonnerPosture("temporiser")],
      [K.X, () => this.ordonnerPosture("agressif")],
      [K.C, () => this.ordonnerPosture("repli")],
      [K.V, () => this.changerFormation()],
      [K.ESC, () => this.rompre()],
      // La cloche : une touche, tout le monde rentre. C'est l'outil de
      // l'urgence — quand une horde tombe, on n'a pas le temps de changer sept
      // postures une par une (DESIGN.md §4.18).
      [K.B, () => this.village.sonnerCloche()],
      // Le tableau du village. L'ecran reste degage : tout ce qui n'est pas la
      // population se lit ici, a la demande.
      [K.F, () => this.events.emit("basculer-village")],
      // Batir : une touche par construction, et la meme touche referme. Deux
      // suffisent aujourd'hui — l'arsenal complet est au jalon 7.
      [K.G, () => this.basculerConstruction("palissade")],
      [K.H, () => this.basculerConstruction("tour")],
      [K.J, () => this.basculerConstruction("champ")],
      [K.T, () => this.basculerTour()],
      // L'eglise : une seule touche pour les deux gestes qu'on peut lui faire —
      // la monter d'un niveau, ou relancer son chantier quand elle est a terre.
      // Ce sont deux actions exclusives, jamais disponibles en meme temps.
      [K.Y, () => this.oeuvrerALEglise()],
    ];
    for (const [code, action] of ordres) {
      clavier.addKey(code).on("down", () => {
        if (this.termine || this.enPause || this.saisieEnCours) return;
        action();
      });
    }

    clavier.addKey(K.R).on("down", () => {
      if (!this.termine) return;
      this.scene.stop("ui");
      this.scene.start("choix-classe");
    });
  }

  // ------------------------------------------------- changement de heros

  /**
   * Le verrou des 20% (DESIGN.md §4.3). Sous ce seuil, le joueur ne peut pas
   * abandonner son heros mourant : il doit le ramener vivant a la cite.
   */
  private changementAutorise(): boolean {
    const h = this.hero;
    if (!h || h.etat === "mort") return true;
    return !h.estCritique || h.etat === "cite";
  }

  private changerHeroRelatif(pas: number): void {
    const total = this.heros.length;
    for (let i = 1; i <= total; i++) {
      const index = (this.indexIncarne + pas * i + total * i) % total;
      if (this.heros[index]?.etat !== "mort") {
        this.changerHero(index);
        return;
      }
    }
  }

  private changerHero(index: number): void {
    if (this.termine || this.enPause) return;
    const cible = this.heros[index];
    if (!cible || cible.etat === "mort" || index === this.indexIncarne) return;

    if (!this.changementAutorise()) {
      this.flotter(this.hero.x, this.hero.y - 24, "Verrouille !", "#ff8a7a");
      this.cameras.main.shake(120, 0.003);
      return;
    }

    this.hero.estIncarne = false;
    this.hero.setVelocity(0, 0);
    this.indexIncarne = index;
    cible.estIncarne = true;
    this.effacerDestination();

    this.cameras.main.startFollow(cible, true, 0.12, 0.12);
    this.effetCercle(cible.x, cible.y, 60, 0xf0c419);
    this.events.emit("hero-incarne", cible);

    // Le heros repris presente ses choix en attente : c'est toujours le joueur
    // qui choisit, jamais l'IA (DESIGN.md §4.3).
    if (cible.choixEnAttente > 0) this.ouvrirChoix();
  }

  // ---------------------------------------------------------------- boucle

  update(_temps: number, delta: number): void {
    if (this.termine || this.enPause) return;

    this.majEtats(delta);
    this.majAffinites();
    this.majContexteEquipe();
    this.majCommandement();
    this.majProvocation();
    this.majOrbiteurs();
    this.majAuras();
    this.majInvocations();
    this.majProvocationInvocations();
    this.deplacerHeroIncarne();
    this.deplacerHerosIA();

    // Heure sombre : tout est fige sauf le heros du joueur.
    if (this.time.now >= this.figeJusqua) {
      this.deplacerEnnemis();
    } else {
      for (const objet of this.ennemis.getChildren()) {
        const e = objet as Ennemi;
        e.setVelocity(0, 0);
        // Le temps ne passe pas pour eux : leurs horodatages sont repousses
        // d'autant. Sinon le degel ferait tomber d'un coup tous les coups
        // armes pendant l'Heure sombre — l'ultime punirait celui qui le lance.
        e.decaler(delta);
      }
    }

    for (const hero of this.heros) this.attaquerAvec(hero);
    this.gererCapacitesAuto();
    this.gererCapacites();
    this.majCycle(delta);
    this.eglise.majorer(delta, this.time.now);
    this.village.majorer(delta);
    this.recolterALaMain(delta);
    this.majFantome();
    this.constructions.majorer(this.time.now);
    // Les champs poussent une fois par seconde, jamais par image (§4.17).
    this.champs.majorer(this.time.now, this.village.auTravail("fermier"), this.village.stocks);
    this.fairePartirLesVagues();
    this.majPoses();
    this.majTeintes();
    // Le micro-gel se rend la main tout seul, sur horodatage.
    majEffets(this, this.time.now, true);
    this.trierProfondeurs();
  }

  /**
   * L'eclair blanc d'encaissement des allies, repose une fois par image.
   *
   * Les ennemis sont traites dans leur propre boucle (`teinterEnnemi`), qui a
   * des regles en plus. Ici, c'est le meme principe : un horodatage plutot
   * qu'une minuterie par coup recu.
   */
  private majTeintes(): void {
    const maintenant = this.time.now;
    for (const hero of this.heros) {
      if (hero.etat === "mort") continue;
      rafraichirTeinte(hero, maintenant);
    }
    for (const objet of this.invocations.getChildren()) {
      const i = objet as Invocation;
      if (i.active) rafraichirTeinte(i, maintenant);
    }
  }

  /** Toutes les x millisecondes : chaque paire de heros coute un calcul. */
  private static readonly PERIODE_AFFINITES = 250;

  /**
   * L'experience de groupe (DESIGN.md §4.16) : les heros qui se battent
   * ensemble apprennent a travailler ensemble.
   *
   * Un simple horodatage plutot qu'une minuterie (regle 4 du §4.17), et un
   * calcul par paire toutes les 250 ms plutot qu'a chaque image (regle 5).
   */
  private majAffinites(): void {
    if (this.time.now < this.prochainTickAffinites) return;
    const periode = ArenaScene.PERIODE_AFFINITES;
    this.prochainTickAffinites = this.time.now + periode;

    const tous = this.heros.filter((h) => h.estVivant).map((h) => h.identifiant);
    // Au combat seulement : ni la cite, ni le repli ne font une equipe.
    const auCombat = this.heros.filter((h) => h.estAuCombat).map((h) => h.identifiant);
    this.affinites.ecouler(tous, auCombat, periode / 1000);

    for (const hero of this.heros) {
      hero.bonusGroupe = hero.estAuCombat ? this.affinites.bonus(hero.identifiant, auCombat) : 0;
    }
  }

  /**
   * La formation et les ancres, recalculees une fois par image pour toute
   * l'equipe — jamais heros par heros (regle 5 du §4.17).
   *
   * L'ancre de la formation, c'est le heros incarne : le joueur deplace donc
   * toute sa ligne en se deplacant lui-meme (DESIGN.md §4.4).
   */
  private majCommandement(): void {
    const sbires = this.sbires;
    this.commandement.suivreLesProteges(sbires);

    const ancre = this.hero?.estVivant ? { x: this.hero.x, y: this.hero.y } : CITE;
    const menace = this.ennemiLePlusProche(ancre.x, ancre.y, 900);
    this.commandement.majPostes(
      ancre,
      menace ? { x: menace.x, y: menace.y } : null,
      this.hero ?? null,
    );

    this.dessinerOrdres();
  }

  /**
   * Un seul objet Graphics, efface et redessine (regle 3 du §4.17) : le joueur
   * doit voir d'un coup d'oeil qui il commande et ou il l'envoie.
   */
  private dessinerOrdres(): void {
    const g = this.graphiquesOrdres;
    g.clear();

    for (const hero of this.heros) {
      if (!hero.estVivant) continue;

      if (this.commandement.estSelectionne(hero)) {
        g.lineStyle(1, 0x5ec8f0, 0.9);
        g.strokeEllipse(hero.x, hero.y + 6, 20, 10);
      }

      // Le trait ne se dessine que pour une position donnee a la main : les
      // postes de formation en tracerait un par heros a chaque image, pour rien.
      const ancre = hero.ordre.ancre;
      if (!ancre) continue;
      const couleur = hero.protege ? 0x7ee0a0 : 0x5ec8f0;
      g.lineStyle(1, couleur, 0.25);
      g.lineBetween(hero.x, hero.y, ancre.x, ancre.y);
      g.lineStyle(1, couleur, 0.7);
      g.strokeCircle(ancre.x, ancre.y, 7);
    }
  }

  /**
   * Les competences qui dependent de l'etat de l'equipe entiere : Presage,
   * Serment du protecteur, Le dernier debout, Serment de fer.
   */
  private majContexteEquipe(): void {
    const vivants = this.heros.filter((h) => h.etat !== "mort");
    const presage = Math.max(0, ...this.heros.map((h) => h.bonus.presage));
    const absents = vivants.filter((h) => h.etat !== "combat").length + (this.heros.length - vivants.length);

    for (const hero of this.heros) {
      hero.esquiveTemporaire = presage;
      hero.alliesAbsents = Math.max(0, absents - (hero.estAuCombat ? 0 : 1));
      hero.presCite =
        Phaser.Math.Distance.Between(hero.x, hero.y, CITE.x, CITE.y) <= CITE.rayon + 260;

      const gagne = hero.verifierSermentDeFer();
      if (gagne > 0) this.flotter(hero.x, hero.y - 26, `Serment +${gagne}`, "#8ec9ff");
    }
  }

  /** Aura de flammes et Eclats : les armes qui se battent toutes seules. */
  private majAuras(): void {
    if (this.time.now >= this.prochainTickAuras) {
      this.prochainTickAuras = this.time.now + 500;
      for (const hero of this.heros) {
        if (hero.bonus.auraFeu <= 0 || !hero.estAuCombat) continue;
        this.aura(hero.x, hero.y, 9, 0xff8a3d, 400);
        for (const e of this.ennemisDansRayon(hero.x, hero.y, 72)) {
          this.blesserEnnemi(e, Math.max(1, Math.round(hero.bonus.auraFeu / 2)), hero);
        }
      }
    }

    if (this.time.now < this.prochainTickEclats) return;
    this.prochainTickEclats = this.time.now + 1800;
    for (const hero of this.heros) {
      if (hero.bonus.eclats <= 0 || !hero.estAuCombat) continue;
      for (let i = 0; i < hero.bonus.eclats; i++) {
        const angle = this.rng.range(0, Math.PI * 2);
        const p = this.projectiles.create(hero.x, hero.y, "projectile") as Phaser.Physics.Arcade.Image;
        p.setTint(0xfff0a0).setScale(0.8).setDepth(hero.y + 1);
        p.setData("auteur", hero);
        p.setVelocity(Math.cos(angle) * 260, Math.sin(angle) * 260);
        this.time.delayedCall(1100, () => p.destroy());
      }
    }
  }

  /**
   * Les invocations se battent toutes seules : mort-vivants, familier, double.
   * Elles cherchent l'ennemi le plus proche et lui foncent dessus.
   */
  private majInvocations(): void {
    // Le familier du mage est permanent : s'il tombe, il revient.
    for (const hero of this.heros) {
      if (hero.bonus.familier <= 0 || hero.etat === "mort") continue;
      const vivant = (this.invocations.getChildren() as Invocation[]).some(
        (i) => i.active && i instanceof Familier && i.maitre === hero,
      );
      if (vivant) continue;
      const retour = this.retourFamilier.get(hero) ?? 0;
      if (this.time.now < retour) continue;
      this.invocations.add(new Familier(this, hero.x + 24, hero.y, hero));
    }

    for (const objet of [...this.invocations.getChildren()] as Invocation[]) {
      if (!objet.active) continue;
      if (this.time.now > objet.finDeVie) {
        this.detruireInvocation(objet);
        continue;
      }
      objet.setDepth(objet.y);
      if (objet.vitesse <= 0) {
        objet.setVelocity(0, 0);
        continue;
      }

      // Sans ancre, il tient la position de son maitre : le meme systeme
      // d'ordres que les heros IA (DESIGN.md §4.4 et §4.14).
      const ancre: Point = objet.ordre.ancre ?? { x: objet.maitre.x, y: objet.maitre.y };
      const reglage = REGLAGES[objet.ordre.posture];
      const distanceAncre = Phaser.Math.Distance.Between(objet.x, objet.y, ancre.x, ancre.y);

      // Le spectre acheve en priorite ce qui agonise.
      const cible =
        objet.ordre.posture === "repli"
          ? null
          : ((objet.seuilExecution > 0
              ? this.ennemisDansRayon(objet.x, objet.y, 460).find(
                  (e) => e.pv / e.pvMax <= objet.seuilExecution,
                )
              : null) ?? this.ennemiLePlusProche(objet.x, objet.y, 900));

      // Rien a poursuivre, ou trop loin de sa position : il y retourne.
      if (!cible || distanceAncre > reglage.laisse) {
        if (distanceAncre <= TOLERANCE_ANCRE) {
          objet.setVelocity(0, 0);
          continue;
        }
        const retour = Phaser.Math.Angle.Between(objet.x, objet.y, ancre.x, ancre.y);
        objet.setVelocity(Math.cos(retour) * objet.vitesse, Math.sin(retour) * objet.vitesse);
        orienter(objet, ancre.x - objet.x, SEUIL_REGARD_PIXELS);
        continue;
      }

      const angle = Phaser.Math.Angle.Between(objet.x, objet.y, cible.x, cible.y);
      objet.setVelocity(Math.cos(angle) * objet.vitesse, Math.sin(angle) * objet.vitesse);
      orienter(objet, cible.x - objet.x, SEUIL_REGARD_PIXELS);
    }
  }

  private melee(invoque: Invocation, e: Ennemi): void {
    if (!invoque.active || !e.active || this.enPause) return;
    if (!invoque.peutFrapper(this.time.now)) return;
    invoque.marquerCoup(this.time.now);
    declencher(invoque.pose, invoque, "attaque", this.time.now, e);

    if (invoque.degats > 0) {
      // Le spectre execute ce qui est deja a l'agonie.
      const acheve = invoque.seuilExecution > 0 && e.pv / e.pvMax <= invoque.seuilExecution;
      this.blesserEnnemi(e, acheve ? e.pv : invoque.degats, invoque.maitre);
      if (acheve) this.flotter(e.x, e.y - 16, "ACHEVE", "#9fd8ff");
    }

    // L'echange se paie des deux cotes. L'eclair d'encaissement est date
    // plutot que confie a une minuterie : une minuterie par coup rendait la
    // main a `clearTint`, qui effacait au passage la couleur du double.
    invoque.pv -= e.degats;
    flashCible(invoque, this.time.now, 60);
    declencher(invoque.pose, invoque, "touche", this.time.now, e);
    eclatImpact(this, invoque.x, invoque.y - 4, e.archetype.couleurImpact, 3);
    if (invoque.pv <= 0) this.detruireInvocation(invoque);
  }

  private detruireInvocation(invoque: Invocation): void {
    if (invoque.explosif) {
      this.effetCercle(invoque.x, invoque.y, 80, 0x9ee8a0);
      for (const e of this.ennemisDansRayon(invoque.x, invoque.y, 80)) {
        this.blesserEnnemi(e, Math.max(invoque.degats * 2, invoque.maitre.degats * 2), invoque.maitre);
      }
    }
    // Le familier revient au bout d'un moment : il est permanent.
    if (invoque instanceof Familier) {
      this.retourFamilier.set(invoque.maitre, this.time.now + 12000);
    }
    for (const objet of this.ennemis.getChildren()) {
      const e = objet as Ennemi;
      if (e.attirePar === invoque) e.attirePar = null;
    }
    invoque.destroy();
  }

  /** Le golem et le double de l'assassin attirent les ennemis sur eux. */
  private majProvocationInvocations(): void {
    const provocateurs = (this.invocations.getChildren() as Invocation[]).filter(
      (i) => i.active && i.provoque,
    );

    for (const objet of this.ennemis.getChildren()) {
      const e = objet as Ennemi;
      if (e.attirePar && !e.attirePar.active) e.attirePar = null;
      if (e.attirePar) continue;
      const proche = provocateurs.find(
        (i) => Phaser.Math.Distance.Between(e.x, e.y, i.x, i.y) <= 200,
      );
      if (proche) e.attirePar = proche;
    }
  }

  /**
   * Un cadavre a une chance de se relever pour le Necromancien.
   *
   * Le taux de base est volontairement bas : a 25%, l'armee devenait un mur
   * qui jouait la partie a la place du joueur. C'est aux competences de le
   * faire monter, et ca reste plafonne pour que l'ecran reste lisible.
   */
  private tenterRelevement(x: number, y: number): void {
    for (const hero of this.heros) {
      if (hero.etat === "mort") continue;
      const chance =
        (hero.classe.trait === "necromancie" ? 0.08 : 0) + hero.bonus.chanceRelevement;
      if (chance <= 0) continue;

      const siens = (this.invocations.getChildren() as Invocation[]).filter(
        (i) => i.active && i instanceof MortVivant && i.maitre === hero,
      ).length;
      if (siens >= MAX_MORTS_VIVANTS) continue;

      if (this.rng.next() >= chance) continue;
      this.relever(hero, x, y);
      return;
    }
  }

  private relever(maitre: Hero, x: number, y: number): void {
    const mort = new MortVivant(this, x, y, maitre);
    this.invocations.add(mort);
    this.effetCercle(x, y, 34, 0x9ee8a0);
  }

  /**
   * L'etat de chaque heros, et **le seul endroit du jeu ou l'on se soigne**.
   *
   * ⚠️ Ce n'est plus le cercle du village qui soigne, c'est **l'eglise** —
   * 90 px au niveau 1 contre 150 px avant, et **zero quand elle est a terre**
   * (§4.22). Trois consequences a garder en tete :
   *
   * - se soigner veut dire rentrer sur la place, plus trainer au bord ;
   * - l'etat `cite` signifie desormais « dans le rayon de l'eglise ». C'est ce
   *   que `piloter()` attend pour arreter un repli, et l'eglise etant au centre
   *   exact de la cite, un heros qui rentre y arrive toujours ;
   * - **eglise a terre = plus aucun soin**, donc un heros IA en repli reste en
   *   repli, hors du combat, jusqu'a ce qu'elle se releve. C'est lourd, c'est
   *   voulu, et c'est ecrit noir sur blanc au §4.22.
   */
  private majEtats(delta: number): void {
    // Calcules une fois par image et non par heros : le §4.17 est formel.
    const rayonSoin = this.eglise.rayonSoin;
    const soinParSeconde = this.eglise.fonctionne
      ? this.eglise.regles.palier.soinParSeconde
      : 0;

    this.majMoralDesHeros();

    for (const hero of this.heros) {
      if (hero.etat === "mort") continue;

      const dansCite =
        rayonSoin > 0 &&
        Phaser.Math.Distance.Between(hero.x, hero.y, EGLISE.x, EGLISE.y) <= rayonSoin;

      if (dansCite) {
        hero.etat = "cite";
        hero.soigner((soinParSeconde * delta) / 1000);
      } else if (hero.estIncarne) {
        // Reprendre un heros en fuite le remet au combat : c'est le joueur qui
        // decide de faire demi-tour, et c'est comme ca qu'on perd un heros.
        hero.etat = "combat";
      } else if (hero.estCritique) {
        // Repli automatique : l'IA ne perd jamais un heros.
        if (hero.etat !== "repli") this.flotter(hero.x, hero.y - 24, "Repli !", "#e6a23c");
        hero.etat = "repli";
      } else if (hero.etat !== "repli") {
        hero.etat = "combat";
      }

      hero.setAlpha(hero.estInvisible ? 0.35 : hero.etat === "repli" ? 0.75 : 1);
    }
  }

  /**
   * Le moral des heros (DESIGN.md §4.23).
   *
   * **Les deux populations partagent le meme systeme** : c'est le pendant de
   * `village.majorerLeMoral()`, avec les memes reglages et le meme battement de
   * 500 ms. Ce qui change, c'est ce qui fait monter la jauge — un heros est
   * dehors la nuit par metier, pas par accident.
   */
  private majMoralDesHeros(): void {
    const maintenant = this.time.now;
    if (maintenant < this.prochainBattementMoral) return;

    const periode = ArenaScene.PERIODE_MORAL;
    this.prochainBattementMoral = maintenant + periode;
    const minutes = periode / 60_000;

    // Une fois par battement, pas une fois par heros (§4.17, regle 5).
    const nuit = this.cycle.phase === "nuit";
    const apaisement = this.eglise.fonctionne
      ? REGLAGES_STRESS.multiplicateurEglise * (0.8 + this.eglise.niveau * 0.2)
      : 0;
    const rayonSoin = this.eglise.rayonSoin;

    for (const hero of this.heros) {
      if (hero.etat === "mort") continue;
      const { personne } = hero;

      const aLEglise =
        rayonSoin > 0 &&
        Phaser.Math.Distance.Between(hero.x, hero.y, EGLISE.x, EGLISE.y) <= rayonSoin;

      if (aLEglise) {
        descendreStress(personne, REGLAGES_STRESS.reposAuVillage * apaisement * personne.mods.soinEglise * minutes);
      } else {
        let montee = stressDesEtatsDe(personne);
        if (nuit && !personne.mods.ignoreStressNuit) montee += REGLAGES_STRESS.dehorsLaNuit;
        if (this.ennemiLePlusProche(hero.x, hero.y, RAYON_DE_VUE)) {
          montee += REGLAGES_STRESS.menaceEnVue;
        }
        if (montee > 0) {
          // Un heros n'a pas de rang : c'est son niveau et son courage qui
          // ralentissent la jauge. Un veteran tient bien plus longtemps.
          monterStress(personne, montee * minutes * resistanceAuStress(0, hero.niveau, personne.stats));
        }
      }

      this.verifierLaRuptureDuHero(hero, maintenant);
    }
  }

  /**
   * Un heros craque (DESIGN.md §4.23).
   *
   * ⚠️ **Seuls les heros deviennent dangereux** : la rage fait frapper les
   * allies. C'est assume, et c'est justement pour ca que les civils, eux, ne
   * frappent jamais personne — avec vingt habitants, la meme regle
   * declencherait une spirale de meurtres internes qu'aucun joueur ne peut
   * arreter.
   *
   * Les effets passent par `hero.personne.rupture`, que les getters de
   * `entities.ts` et l'IA lisent : rien n'est cable en dur ici.
   */
  private verifierLaRuptureDuHero(hero: Hero, maintenant: number): void {
    const { personne } = hero;

    if (coeurLache(personne)) {
      this.events.emit("annonce", `${personne.nom} s'effondre — son coeur a lache`);
      this.tomber(hero);
      return;
    }

    const rupture = verifierRupture(personne, maintenant, this.rng);
    if (!rupture) return;

    this.events.emit(
      "annonce",
      `${personne.nom} craque — ${NOMS_RUPTURE[rupture]} : ${EFFETS_RUPTURE[rupture].hero}`,
    );
    this.flotter(hero.x, hero.y - 28, NOMS_RUPTURE[rupture], "#ff5a4a");
    secousse(this, "leger");
  }

  /**
   * Provocation du Chevalier Sacre : tout ce qui l'entoure ne voit plus que
   * lui, et chaque ennemi qui le cible le rend plus dur.
   */
  private majProvocation(): void {
    for (const objet of this.ennemis.getChildren()) (objet as Ennemi).provoquePar = null;

    for (const hero of this.heros) {
      hero.resistanceTemporaire = 0;
      if (hero.bonus.provocation <= 0 || !hero.estAuCombat) continue;
      const autour = this.ennemisDansRayon(hero.x, hero.y, hero.bonus.provocation);
      for (const e of autour) e.provoquePar = hero;
      hero.resistanceTemporaire = autour.length;
    }
  }

  /**
   * Armes en orbite : les satellites du mage et les epees tournoyantes.
   * Elles se battent toutes seules — c'est ce qui donne le sentiment de monter
   * en puissance sans ajouter une touche de plus (DESIGN.md §4.13).
   */
  private majOrbiteurs(): void {
    for (const hero of this.heros) {
      const satellites = hero.etat === "mort" ? 0 : hero.bonus.satellites;
      const epees = hero.etat === "mort" ? 0 : hero.bonus.epees;
      const voulu = satellites + epees;

      const liste = this.orbiteurs.get(hero) ?? [];
      while (liste.length < voulu) liste.push(this.add.image(hero.x, hero.y, "projectile"));
      while (liste.length > voulu) liste.pop()?.destroy();
      this.orbiteurs.set(hero, liste);

      liste.forEach((objet, i) => {
        const estEpee = i >= satellites;
        const rayon = estEpee ? 62 : 48;
        const vitesse = estEpee ? 380 : 520;
        const angle = this.time.now / vitesse + (i / Math.max(1, voulu)) * Math.PI * 2;
        const teinte = estEpee
          ? hero.bonus.epeeArdente
            ? 0xff8a3d
            : 0xd5dbe3
          : hero.bonus.satelliteFeu
            ? 0xff8a3d
            : hero.bonus.satelliteGlace
              ? 0x8ed6ff
              : 0xd06bff;

        objet
          .setPosition(hero.x + Math.cos(angle) * rayon, hero.y + Math.sin(angle) * rayon)
          .setScale(estEpee ? 1.6 : 1.2)
          .setTint(teinte)
          .setDepth(hero.y + 2);
      });
    }

    if (this.time.now < this.prochainTickOrbiteurs) return;
    this.prochainTickOrbiteurs = this.time.now + 260;

    for (const [hero, liste] of this.orbiteurs) {
      if (hero.etat === "mort" || liste.length === 0) continue;
      const satellites = hero.bonus.satellites;
      liste.forEach((objet, i) => {
        const estEpee = i >= satellites;
        const degats = estEpee
          ? Math.round(hero.degats * (hero.bonus.epeeArdente ? 1.2 : 0.6))
          : Math.round(hero.degats * (hero.bonus.satelliteFeu ? 0.8 : 0.4));
        for (const e of this.ennemisDansRayon(objet.x, objet.y, estEpee ? 24 : 18)) {
          if (!estEpee && hero.bonus.satelliteGlace) e.ralentir(1200);
          this.blesserEnnemi(e, degats, hero);
        }
      });
    }
  }

  private deplacerHeroIncarne(): void {
    const hero = this.hero;
    if (!hero || hero.etat === "mort") return;

    // Le recul d'un coup encaisse tient la main quelques images. Sans ce
    // passage, la vitesse du joueur, reecrite ici a chaque image, effacerait
    // l'impulsion avant qu'elle n'ait deplace quoi que ce soit.
    if (hero.estEnRecul) return;

    if (hero.estImmobilise) {
      hero.setVelocity(0, 0);
      return;
    }

    // On renomme quelqu'un : les lettres vont au champ, pas aux jambes. Le
    // heros s'arrete, il ne se fige pas — la partie, elle, continue (§4.18).
    if (this.saisieEnCours) {
      hero.setVelocity(0, 0);
      return;
    }

    const dir = new Phaser.Math.Vector2(0, 0);
    if (this.zqsd["Q"]?.isDown || this.fleches.left.isDown) dir.x -= 1;
    if (this.zqsd["D"]?.isDown || this.fleches.right.isDown) dir.x += 1;
    if (this.zqsd["Z"]?.isDown || this.fleches.up.isDown) dir.y -= 1;
    if (this.zqsd["S"]?.isDown || this.fleches.down.isDown) dir.y += 1;

    if (dir.lengthSq() > 0) {
      this.effacerDestination();
    } else if (this.destination) {
      const distance = Phaser.Math.Distance.Between(
        hero.x,
        hero.y,
        this.destination.x,
        this.destination.y,
      );
      if (distance < 6) this.effacerDestination();
      else dir.set(this.destination.x - hero.x, this.destination.y - hero.y);
    }

    dir.normalize();
    if (dir.lengthSq() > 0) {
      hero.regard.copy(dir);
      orienter(hero, dir.x, SEUIL_REGARD);
    }
    hero.setVelocity(dir.x * hero.vitesse, dir.y * hero.vitesse);

    if (hero.estCritique && Math.floor(this.time.now / 140) % 2 === 0) hero.setAlpha(0.55);
  }

  private deplacerHerosIA(): void {
    const contexte: ContexteIA = {
      cite: CITE,
      ennemiLePlusProche: (x, y, portee) => this.ennemiLePlusProche(x, y, portee),
      nombreEnnemisAutour: (x, y, rayon) => this.ennemisDansRayon(x, y, rayon).length,
    };

    for (const hero of this.heros) {
      if (hero.estIncarne || hero.etat === "mort") continue;
      // Un heros repousse subit son recul avant de reprendre sa course.
      if (hero.estEnRecul) continue;
      if (hero.estImmobilise) {
        hero.setVelocity(0, 0);
        continue;
      }

      const { direction, lancerUltime } = piloter(hero, contexte);

      // Le lissage : la direction va vers celle que l'IA demande sans y sauter.
      // `piloter()` reste franche et testable ; c'est l'affichage qui amortit.
      // Sans ca, un changement de cible au milieu d'une nuee fait faire
      // demi-tour en une image, et ca se lit comme un tremblement.
      const lisse = hero.directionLissee.lerp(
        new Phaser.Math.Vector2(direction.x, direction.y),
        LISSAGE_DIRECTION,
      );

      // Un heros qui decroche court plus vite : c'est ce qui rend le repli
      // credible plutot que suicidaire.
      const vitesse = hero.vitesse * (hero.etat === "repli" ? 1.35 : 1);
      hero.setVelocity(lisse.x * vitesse, lisse.y * vitesse);
      orienter(hero, lisse.x, SEUIL_REGARD);
      if (lisse.lengthSq() > 0.01) hero.regard.set(lisse.x, lisse.y);

      if (lancerUltime && hero.etat === "combat") {
        // L'IA lance la premiere capacite prete. Elle ne choisit jamais
        // d'amelioration, mais elle sait se servir de ce qu'elle a.
        const prete = hero.capacites.find((c) => !c.automatique && hero.peutLancer(c));
        if (prete) this.lancerCapacite(hero, prete);
      }
    }
  }

  /**
   * La boucle des monstres : un seul parcours par image, comme avant.
   *
   * Elle porte desormais trois choses de plus, et c'est voulu qu'elles soient
   * ici plutot que dans des minuteries : le coup arme qui arrive a echeance,
   * l'engagement du cracheur qui n'attend pas le contact, et la teinte.
   */
  private deplacerEnnemis(): void {
    // Calcule une seule fois par image : c'etait refait pour chaque ennemi.
    this.ciblesPossibles = this.heros.filter((h) => h.estAuCombat && !h.estInvisible);
    const maintenant = this.time.now;

    // Copie de la liste : un kamikaze qui s'ouvre, ou une riposte qui tue le
    // frappeur, retire un element du groupe **pendant** le parcours. C'est la
    // meme precaution que dans `frapperAuContact`.
    for (const objet of [...this.ennemis.getChildren()]) {
      const e = objet as Ennemi;
      if (!e.active) continue;

      // Le coup arme part-il ? C'est le seul endroit ou un monstre blesse.
      if (e.enArmement && maintenant >= e.instantFrappe) this.resoudreFrappe(e);
      if (!e.active) continue;

      // Le cracheur n'attend pas le contact : il engage des qu'il vous voit.
      if (
        !e.enArmement &&
        e.archetype.comportement === "cracheur" &&
        e.peutFrapper(maintenant)
      ) {
        const proie = this.heroLePlusProche(e.x, e.y, e.archetype.portee);
        if (proie) this.armerEnnemi(e, proie);
      }

      this.avancerEnnemi(e, maintenant);
      this.teinterEnnemi(e, maintenant);
      this.bloquerParLesDomes(e);
    }
  }

  /**
   * Ou va un monstre.
   *
   * Deux nuances par rapport a « il fonce tout droit » : pendant son armement
   * il ralentit fortement — un coup telegraphie qu'on voit venir mais auquel on
   * ne peut pas echapper ne telegraphie rien — et le cracheur garde ses
   * distances au lieu de venir au contact.
   */
  private avancerEnnemi(e: Ennemi, maintenant: number): void {
    // Repousse : son impulsion a la priorite sur sa volonte.
    if (maintenant < e.reculJusqua) return;

    // Faute de heros a portee de vue, il marche sur l'eglise : c'est son cap,
    // et c'est ce qui donne enfin une ligne a tenir (§4.22).
    const cible = this.cibleDe(e) ?? EGLISE;
    const angle = Phaser.Math.Angle.Between(e.x, e.y, cible.x, cible.y);
    orienter(e, cible.x - e.x, SEUIL_REGARD_PIXELS);

    // Il se cabre : il n'avance quasiment plus, on a le temps de s'ecarter.
    const vitesse = e.vitesseEffective * (e.enArmement ? 0.25 : 1);

    if (e.archetype.comportement === "cracheur") {
      const distance = Phaser.Math.Distance.Between(e.x, e.y, cible.x, cible.y);
      const bonne = e.archetype.portee * 0.75;
      if (distance < bonne * 0.7) {
        // Trop pres : il recule pour retrouver sa distance de tir.
        e.setVelocity(-Math.cos(angle) * vitesse * 0.7, -Math.sin(angle) * vitesse * 0.7);
        return;
      }
      if (distance < bonne) {
        e.setVelocity(0, 0);
        return;
      }
    }

    e.setVelocity(Math.cos(angle) * vitesse, Math.sin(angle) * vitesse);
  }

  /**
   * La couleur dit ce qu'il est et ce qu'il fait, dans cet ordre de priorite :
   * l'eclair d'encaissement, le contrat, l'armement, le ralentissement, puis la
   * teinte de son archetype.
   */
  private teinterEnnemi(e: Ennemi, maintenant: number): void {
    if (maintenant < e.flashJusqua) {
      e.setTintFill(0xffffff);
      return;
    }
    // Un ennemi sous contrat reste marque en rouge jusqu'a la fin.
    if (e.souscontrat) {
      e.setTint(0xff3b30);
      return;
    }
    if (e.enArmement) {
      // L'avertissement. Le kamikaze, lui, clignote : c'est une meche.
      if (e.archetype.comportement === "kamikaze") {
        if (Math.floor(maintenant / 80) % 2 === 0) e.setTintFill(0xffe0b0);
        else e.setTint(0xff7a2f);
        return;
      }
      e.setTint(0xffd166);
      return;
    }
    if (maintenant < e.ralentiJusqua) {
      e.setTint(0x8ed6ff);
      return;
    }
    e.setTint(e.teinte ?? 0xffffff);
  }

  /** Le heros ciblable le plus proche, pour ce qui vise a distance. */
  private heroLePlusProche(x: number, y: number, portee: number): Hero | null {
    let meilleur: Hero | null = null;
    let meilleureDistance = portee;
    for (const h of this.ciblesPossibles) {
      const d = Phaser.Math.Distance.Between(x, y, h.x, h.y);
      if (d < meilleureDistance) {
        meilleureDistance = d;
        meilleur = h;
      }
    }
    return meilleur;
  }

  /**
   * Qui un ennemi vise. Trois regles se superposent :
   * la Provocation force sa cible, l'invisibilite retire une cible, et la
   * discretion de l'assassin le fait passer apres les autres.
   */
  /**
   * Ce que vise un monstre.
   *
   * **Il vient pour le village, pas pour vous.** C'etait la contrepartie
   * obligatoire annoncee au §4.6, et elle manquait : tant qu'un monstre visait
   * le heros le plus proche ou qu'il fut, un joueur prudent avait interet a se
   * planquer — il attirait ainsi toute la vague sur lui et **protegeait ses
   * habitants sans rien faire**. Se cacher etait la meilleure defense possible.
   *
   * Un heros n'est donc une cible que s'il est **a portee de vue**. Au-dela, le
   * monstre continue vers **l'eglise** et mange ce qu'il croise en chemin : un
   * pecheur sur sa plage, une palissade, un champ. Se planquer devient
   * exactement ce que le design promettait — le moyen le plus rapide de tout
   * perdre.
   *
   * Le cap est desormais l'eglise et non le centre abstrait du village (§4.22).
   * Ca ne change presque rien geometriquement — elle est posee au centre — mais
   * ca change tout pour le joueur : il y a maintenant **un batiment** entre eux
   * et lui, avec des points de vie, qu'il peut voir tomber.
   */
  private cibleDe(e: Ennemi): { x: number; y: number } | null {
    // Une invocation provocatrice passe avant tout le reste.
    if (e.attirePar?.active && !e.attirePar.furtif) return e.attirePar;
    if (e.provoquePar?.estAuCombat && !e.provoquePar.estInvisible) return e.provoquePar;

    const candidats = this.ciblesPossibles;
    if (candidats.length === 0) return null;

    // Un simple parcours : trier a chaque image pour chaque ennemi coutait
    // beaucoup plus cher que le probleme ne le meritait.
    let premier: Hero | null = null;
    let meilleure = RAYON_DE_VUE;
    let expose: Hero | null = null;
    let meilleureExpose = Infinity;

    for (const h of candidats) {
      const d = Phaser.Math.Distance.Between(e.x, e.y, h.x, h.y);
      if (d < meilleure) {
        meilleure = d;
        premier = h;
      }
      // L'assassin n'est vise qu'a defaut d'une autre cible a portee raisonnable.
      if (!h.bonus.discretion && d < 220 && d < meilleureExpose) {
        meilleureExpose = d;
        expose = h;
      }
    }

    if (premier?.bonus.discretion && expose) return expose;
    return premier;
  }

  private bloquerParLesDomes(e: Ennemi): void {
    for (const dome of this.domes) {
      const distance = Phaser.Math.Distance.Between(e.x, e.y, dome.x, dome.y);
      if (distance > dome.rayon) continue;

      // Repousse l'ennemi hors du dome et l'y fait taper.
      const angle = Phaser.Math.Angle.Between(dome.x, dome.y, e.x, e.y);
      e.setPosition(dome.x + Math.cos(angle) * dome.rayon, dome.y + Math.sin(angle) * dome.rayon);
      if (!e.peutFrapper(this.time.now)) continue;
      e.marquerCoup(this.time.now);
      dome.pv -= e.degats;
      dome.image.setAlpha(0.15 + 0.3 * (dome.pv / dome.pvMax));
      if (dome.pv <= 0) this.detruireDome(dome);
    }
  }

  private detruireDome(dome: Dome): void {
    this.effetCercle(dome.x, dome.y, dome.rayon, 0x8ed6ff);
    dome.image.destroy();
    this.domes = this.domes.filter((d) => d !== dome);
  }

  /**
   * Le balancement de marche et les poses, pour tout ce qui se bat.
   *
   * Un sinus par combattant et par image, rien de plus : c'est assez leger pour
   * les 240 ennemis du plafond (§4.17, regle 5). Aucune minuterie, aucun objet
   * cree — l'etat tient dans quatre nombres portes par chaque entite.
   */
  private majPoses(): void {
    const maintenant = this.time.now;

    const animerEntite = (objet: Hero | Ennemi | Invocation) => {
      const corps = objet.body as Phaser.Physics.Arcade.Body | null;
      animer(objet, objet.pose, corps ? corps.velocity.length() : 0, maintenant);
    };

    for (const hero of this.heros) {
      // Un mort ne se balance pas : il reste a plat, le temps qu'on le pleure.
      if (hero.etat === "mort") continue;
      animerEntite(hero);
    }
    for (const objet of this.ennemis.getChildren()) {
      const e = objet as Ennemi;
      if (e.active) animerEntite(e);
    }
    for (const objet of this.invocations.getChildren()) {
      const i = objet as Invocation;
      if (i.active) animerEntite(i);
    }
  }

  private trierProfondeurs(): void {
    for (const hero of this.heros) hero.setDepth(hero.y);
    for (const objet of this.ennemis.getChildren()) {
      const e = objet as Ennemi;
      e.setDepth(e.y);
    }
  }

  // ------------------------------------------------------------- attaques

  private attaquerAvec(hero: Hero): void {
    if (hero.etat !== "combat" || hero.estImmobilise || !hero.peutAttaquer()) return;

    // Contrat : tant qu'il court, l'assassin ne peut viser personne d'autre.
    const contrat = this.contrats.get(hero);
    const cible = contrat
      ? contrat.active &&
        Phaser.Math.Distance.Between(hero.x, hero.y, contrat.x, contrat.y) <= hero.portee
        ? contrat
        : null
      : this.ennemiLePlusProche(hero.x, hero.y, hero.portee);
    if (!cible) return;

    hero.marquerAttaque();
    // La fente part vers la cible, et sa duree est calee sur celle de l'eclair
    // d'impact : le geste et le coup doivent se lire comme un seul evenement.
    declencher(hero.pose, hero, "attaque", this.time.now, cible);
    if (hero.portee <= PORTEE_CORPS_A_CORPS) this.frapperAuContact(hero, cible);
    else this.lancerProjectile(hero, cible);

    // Trait de l'Oracle : chacune de ses attaques recoud l'allie le plus
    // mal en point autour d'elle. Elle soigne en se battant.
    if (hero.classe.trait === "soin-de-zone") this.soignerLePlusBlesse(hero, 240, 4);
  }

  /**
   * Le joueur recolte lui-meme, a la main (DESIGN.md §4.18).
   *
   * Trois regles, et elles viennent toutes du design :
   *
   * - **seulement le jour.** Sans ca, on abandonnerait le combat pour aller
   *   couper du bois parce que c'est plus rentable, et un survivors-like ne
   *   survit pas a une corvee qui concurrence le combat ;
   * - **en frappant.** Aucune touche de plus, aucune barre de progression : on
   *   s'approche, et l'attaque automatique s'en charge ;
   * - **bien plus vite qu'un habitant**, et d'autant plus vite qu'on frappe
   *   fort. C'est le seul endroit du jeu ou une statistique de combat sert a
   *   autre chose qu'a se battre.
   */
  private recolterALaMain(delta: number): void {
    if (this.cycle.phase !== "jour") return;

    const hero = this.hero;
    if (hero.etat === "mort" || hero.estImmobilise) return;

    // S'occuper d'un champ, c'est le faire avancer vers la moisson. C'est ce qui
    // donne au joueur quelque chose a faire de ses 30 minutes de jour.
    const force = (hero.degats * delta) / 1000 / 400;
    if (this.champs.travaillerALaMain(hero.x, hero.y, force, this.village.stocks)) {
      if (this.time.now >= this.prochainGesteRecolte) {
        declencher(hero.pose, hero, "attaque", this.time.now);
        this.prochainGesteRecolte = this.time.now + 420;
      }
      return;
    }

    for (const poste of POSTES) {
      // Les champs n'ont pas de gisement a frapper : c'est le carre de terre
      // lui-meme qu'on travaille, et c'est fait juste au-dessus.
      if (poste.metier === "fermier") continue;

      const distance = Phaser.Math.Distance.Between(
        hero.x,
        hero.y,
        poste.position.x,
        poste.position.y,
      );
      if (distance > RAYON_RECOLTE) continue;

      const ressource = RECOLTE_DU_POSTE[poste.metier];
      // La cadence suit ses degats : un heros qui tape fort abat plus de bois.
      const quantite = (hero.degats * delta) / 1000 / 8;
      this.village.recolter(ressource, quantite);
      this.cumulRecolte += quantite;

      // Le geste, et le compte rendu — mais seulement de temps en temps : le
      // §4.17 interdit de fabriquer des textes en continu.
      if (this.time.now >= this.prochainGesteRecolte) {
        declencher(hero.pose, hero, "attaque", this.time.now, poste.position);
        this.prochainGesteRecolte = this.time.now + 420;
      }
      if (this.cumulRecolte >= 5) {
        this.flotter(hero.x, hero.y - 26, `+${Math.floor(this.cumulRecolte)}`, "#d8c48a");
        this.cumulRecolte = 0;
      }
      return;
    }

    this.cumulRecolte = 0;
  }

  /**
   * Faire tourner la posture d'un habitant (DESIGN.md §4.18).
   *
   * Trois postures, le meme vocabulaire que les heros du §4.4. La decision est
   * poste par poste et non globale : laisser le mineur travailler la nuit est un
   * pari raisonnable — la mine est abritee des deux fronts — alors que le meme
   * pari sur la plage est beaucoup plus cher.
   */
  private tournerPostureCivile(index: number): void {
    const villageois = this.village.habitants[index];
    if (!villageois || !villageois.regles.vivant) return;

    const suite: PostureCivile[] = ["travail", "prudent", "abri"];
    const suivante = suite[(suite.indexOf(villageois.regles.posture) + 1) % suite.length]!;
    this.village.changerPosture(villageois, suivante);
    this.events.emit(
      "annonce",
      `${villageois.nom} — ${NOMS_POSTURE_CIVILE[suivante]}`,
    );
  }

  /**
   * L'envoyer au poste suivant (DESIGN.md §4.18).
   *
   * « Le joueur decide qui fait quoi, jamais quand » : c'est la seule decision
   * de production du jeu, et c'est celle qui rend les champs jouables — sans un
   * fermier a y mettre, rien n'y pousserait jamais.
   */
  private tournerPosteCivil(index: number): void {
    const villageois = this.village.habitants[index];
    if (!villageois || !villageois.regles.vivant) return;

    const actuel = POSTES.findIndex((p) => p.id === villageois.poste?.id);
    this.village.changerPoste(villageois, POSTES[(actuel + 1) % POSTES.length]!);
  }

  // --------------------------------------------------- batir et occuper

  /**
   * Le mode construction (DESIGN.md §4.20).
   *
   * **Seulement le jour** : batir un rempart au milieu d'un assaut n'aurait
   * aucun sens, et le §4.7 fait de la disposition des defenses une phase de
   * decision a part entiere. Une deuxieme pression sur la meme touche referme.
   */
  private basculerConstruction(type: ModeBati): void {
    if (this.cycle.phase !== "jour") {
      this.events.emit("annonce", "On ne batit pas en pleine nuit");
      return;
    }

    this.enConstruction = this.enConstruction === type ? null : type;
    if (!this.enConstruction) {
      this.fantome.setVisible(false);
      return;
    }

    if (type === "champ") {
      this.fantome.setTexture("champ-jeune").setVisible(true);
      this.events.emit(
        "annonce",
        `Champ — ${REGLAGES_CHAMPS.coutBois} bois · clic pour semer, pres des champs`,
      );
      return;
    }

    const def = CONSTRUCTIONS[type];
    this.fantome.setTexture(def.texture).setVisible(true);
    this.events.emit("annonce", `${def.nom} — ${coutLisible(def)} · clic pour poser`);
  }

  /**
   * L'apercu suit la souris, aimante sur la case.
   *
   * Vert : c'est posable. Rouge : ca ne l'est pas — terrain qui ne porte pas,
   * case deja prise, trop pres de la place du village, ou pas de quoi payer. Le
   * joueur n'a jamais a deviner pourquoi son clic ne fait rien.
   */
  private majFantome(): void {
    if (!this.enConstruction) return;

    const pointeur = this.input.activePointer;
    const monde = this.cameras.main.getWorldPoint(pointeur.x, pointeur.y);
    const centre = this.grille.centreDe(monde.x, monde.y);
    const possible =
      this.enConstruction === "champ"
        ? this.champs.possible(centre.x, centre.y, this.village.stocks)
        : this.constructions.possible(
            centre.x,
            centre.y,
            this.enConstruction,
            this.village.stocks,
          );

    this.fantome.setPosition(centre.x, centre.y);
    this.fantome.setTint(possible ? 0x7ee0a0 : 0xff6b5a);
  }

  private batirIci(x: number, y: number): boolean {
    if (!this.enConstruction) return false;

    const pose =
      this.enConstruction === "champ"
        ? this.champs.semer(x, y, this.village.stocks)
        : this.constructions.batir(x, y, this.enConstruction, this.village.stocks);

    if (!pose) {
      this.events.emit("annonce", "Impossible de poser ici");
      return true;
    }

    eclatImpact(this, pose.x, pose.y, 0xd8c48a);
    return true;
  }

  /**
   * Monter dans une tour, ou en descendre (DESIGN.md §4.20).
   *
   * La tour ne tire pas : elle donne une position. Le heros y gagne de la portee
   * et devient intouchable au corps a corps — mais il ne peut plus bouger, et
   * l'autre front n'est plus couvert. C'est le troc, et il est entier.
   */
  private basculerTour(): void {
    const hero = this.hero;
    if (!hero || hero.etat === "mort") return;

    if (this.tourDuHero) {
      this.descendreDeTour();
      return;
    }

    const tour = this.constructions.tourLibre(hero.x, hero.y, PORTEE_OCCUPATION);
    if (!tour) {
      this.events.emit("annonce", "Aucune tour libre a portee");
      return;
    }

    tour.occupant = hero;
    this.tourDuHero = tour;
    hero.setPosition(tour.x, tour.y - 18);
    hero.setVelocity(0, 0);
    // Intouchable au corps a corps : ce n'est pas une invulnerabilite, c'est de
    // la hauteur. Les monstres s'en prendront a la tour.
    hero.body!.enable = false;
    hero.porteeTour = tour.def.bonusPortee;
    hero.setDepth(tour.depth + 1);
    this.events.emit("annonce", `${hero.classe.nom} monte en tour — T pour descendre`);
  }

  private descendreDeTour(): void {
    const tour = this.tourDuHero;
    if (!tour) return;

    const hero = tour.occupant as Hero | null;
    this.tourDuHero = null;
    tour.occupant = null;
    if (!hero) return;

    hero.body!.enable = true;
    hero.porteeTour = 0;
    hero.setPosition(tour.x, tour.y + 26);
  }

  /**
   * La tour vient de tomber : son occupant tombe avec elle.
   *
   * Sonne, a terre, au milieu d'eux — c'est ce qui empeche la tour d'etre une
   * cachette (§4.20).
   */
  private ejecterDeLaTour(tour: Construction): void {
    const occupant = this.constructions.detruire(tour);
    if (!occupant) return;

    if (occupant === this.tourDuHero?.occupant) this.tourDuHero = null;
    const hero = occupant as Hero;
    hero.body!.enable = true;
    hero.porteeTour = 0;
    hero.setPosition(tour.x, tour.y + 20);
    recul(hero, tour.x, tour.y, this.time.now, 220);
    this.encaisser(hero, Math.round(hero.pvMax * 0.15), tour.x, tour.y, 0xbfae8a);
    this.events.emit("annonce", "La tour cede !");
  }

  /**
   * Une horde traverse un champ : il est perdu (DESIGN.md §4.18).
   *
   * C'est la raison d'etre du ble. La peche est adossee a un flanc ferme, donc
   * rien ne peut jamais l'atteindre — et une ressource qu'on ne peut pas perdre
   * ne fait rien travailler.
   */
  private pietinerChamp(champ: Champ): void {
    if (this.termine || this.enPause) return;
    if (!this.champs.pietiner(champ)) return;

    poufMort(this, champ.x, champ.y, 0xd8b64a);
    this.events.emit("annonce", "Un champ est ravage");
  }

  private cognerConstruction(e: Ennemi, construction: Construction): void {
    if (!e.active || this.termine || this.enPause) return;
    if (!e.peutFrapper(this.time.now)) return;

    e.marquerCoup(this.time.now);
    declencher(e.pose, e, "attaque", this.time.now, construction);
    eclatImpact(this, construction.x, construction.y, 0xbfae8a);

    if (!this.constructions.blesser(construction, e.degats, this.time.now)) return;

    poufMort(this, construction.x, construction.y, 0xbfae8a);
    secousse(this, "fort");
    if (construction.occupant) this.ejecterDeLaTour(construction);
    else this.constructions.detruire(construction);
  }

  /**
   * La touche Y : monter l'eglise, ou relancer son chantier (DESIGN.md §4.22).
   *
   * Une seule touche pour deux gestes exclusifs — elle est debout ou elle est a
   * terre, jamais les deux. Le refus **dit toujours ce qui manque** : quatre
   * conditions dont on ne saurait pas laquelle bloque seraient injouables.
   */
  private oeuvrerALEglise(): void {
    if (!this.eglise.fonctionne) {
      if (this.eglise.regles.etat === "relevement") {
        const part = Math.round(this.eglise.regles.partRelevement * 100);
        this.events.emit("annonce", `Le chantier avance — ${part}%`);
        return;
      }
      if (!this.eglise.lancerRelevement(this.village.stocks)) {
        this.events.emit(
          "annonce",
          `Il faut ${lireCout(RELEVEMENT.cout)} pour relever l'eglise`,
        );
      }
      return;
    }

    const contexte = this.contexteMontee;
    const verdict = this.eglise.regles.peutMonter(contexte);

    if (!verdict.possible) {
      const vise = (this.eglise.niveau + 1) as 2 | 3 | 4;
      this.events.emit("annonce", `Eglise : il manque ${lireBlocages(verdict.manque, vise)}`);
      return;
    }

    this.eglise.regles.monter(contexte);
    this.eglise.monterDUnNiveau();
    secousse(this, "leger");
  }

  /**
   * Les monstres cognent l'eglise (DESIGN.md §4.22).
   *
   * Meme forme que `cognerConstruction` : la cadence du monstre sert de garde,
   * donc rien de nouveau ne tourne par image.
   */
  private cognerEglise(e: Ennemi): void {
    if (!e.active || this.termine || this.enPause) return;
    if (!this.eglise.fonctionne) return;
    if (!e.peutFrapper(this.time.now)) return;

    e.marquerCoup(this.time.now);
    declencher(e.pose, e, "attaque", this.time.now, this.eglise.sprite);
    eclatImpact(this, this.eglise.sprite.x, this.eglise.sprite.y, 0xbfae8a);
    this.eglise.encaisser(e.degats, this.time.now);
  }

  /**
   * Un defenseur civil frappe (DESIGN.md §4.18).
   *
   * Le village ne connait pas les monstres, et il ne doit pas : il demande, la
   * scene trouve la cible et applique les degats.
   *
   * @returns vrai s'il a touche quelque chose
   */
  private frapperPourLeVillage(
    x: number,
    y: number,
    portee: number,
    degats: number,
  ): boolean {
    const cible = this.ennemiLePlusProche(x, y, portee);
    if (!cible) return false;

    // Pas d'auteur : un habitant ne gagne pas d'experience de heros, ne
    // declenche aucun vol de vie et ne remplit aucune jauge d'ultime. C'est ce
    // qui l'empeche de deriver vers le second jeu que le §4.18 refuse.
    cible.pv -= degats;
    cible.flashJusqua = this.time.now + 70;
    eclatImpact(this, cible.x, cible.y - 4, cible.archetype.couleurImpact, 2);
    if (cible.pv > 0) return true;

    // ⚠️ `marquerLaMort` ne fait que **le visuel** : il faut detruire le sprite
    // soi-meme. Une premiere version s'arretait a l'effet, et un monstre tue par
    // un civil continuait a marcher et a frapper avec des points de vie
    // negatifs. Trouve en jouant.
    const mortX = cible.x;
    const mortY = cible.y;
    this.kills += 1;
    this.marquerLaMort(cible);
    cible.destroy();
    // Le cadavre se releve pour le Necromancien comme n'importe quel autre : le
    // §4.14 ne demande pas que ce soit un heros qui ait porte le coup.
    this.tenterRelevement(mortX, mortY);
    return true;
  }

  /**
   * Un monstre a touche un habitant.
   *
   * Il meurt — **sauf s'il tient les portes de l'eglise**, auquel cas il
   * encaisse sur ses points de vie (§4.18, §4.22). Sans cette nuance, sortir
   * defendre serait un suicide pur et le courage ne servirait a rien.
   */
  private rattraperHabitant(villageois: Villageois, e: Ennemi): void {
    if (!e.active || !villageois.regles.vivant || this.termine || this.enPause) return;

    if (!this.village.encaisserOuTuer(villageois, e.degats)) {
      eclatImpact(this, villageois.x, villageois.y - 4, 0xd8c48a, 2);
      return;
    }

    poufMort(this, villageois.x, villageois.y, 0xd8c48a);
    secousse(this, "fort");

    // Le village, c'est sa population : quand il n'y a plus personne, la partie
    // est finie (§4.18).
    if (this.village.eteint) this.finDePartie();
  }

  private soignerLePlusBlesse(source: Hero, rayon: number, montant: number): void {
    let cible: Hero | null = null;
    for (const allie of this.heros) {
      if (allie.etat === "mort" || allie.ratioPv >= 1) continue;
      if (Phaser.Math.Distance.Between(source.x, source.y, allie.x, allie.y) > rayon) continue;
      if (!cible || allie.ratioPv < cible.ratioPv) cible = allie;
    }
    if (!cible) return;
    // Volontairement sans nombre flottant : ce soin part a chaque attaque de
    // l'Oracle, et l'afficher noyait l'ecran.
    cible.soigner(montant);
  }

  private frapperAuContact(hero: Hero, cible: Ennemi): void {
    const portee = hero.portee;
    const angle = Phaser.Math.Angle.Between(hero.x, hero.y, cible.x, cible.y);
    // Trait "arc-large" du guerrier : il fauche un demi-cercle entier.
    const demiArc = hero.classe.trait === "arc-large" ? Math.PI / 2 : Math.PI / 4;

    for (const e of [...this.ennemis.getChildren()] as Ennemi[]) {
      if (!e.active) continue;
      const d = Phaser.Math.Distance.Between(hero.x, hero.y, e.x, e.y);
      if (d > portee) continue;
      const a = Phaser.Math.Angle.Between(hero.x, hero.y, e.x, e.y);
      if (Math.abs(Phaser.Math.Angle.Wrap(a - angle)) > demiArc) continue;
      this.frapper(hero, e);
    }

    // Le meme arc qu'avant, mais sorti d'ici : c'est desormais la brique que
    // les monstres utilisent aussi quand ils frappent (`effets.tranche`).
    tranche(this, hero.x, hero.y, angle, 0xffe9a8, portee);
  }

  private lancerProjectile(hero: Hero, cible: Ennemi): void {
    const angle = Phaser.Math.Angle.Between(hero.x, hero.y, cible.x, cible.y);
    // Trait du Rodeur : une volee en eventail plutot qu'un seul trait.
    const nombre =
      hero.classe.trait === "volee" ? 3 + hero.bonus.flechesSupplementaires : 1;

    for (let i = 0; i < nombre; i++) {
      const ecart = (i - (nombre - 1) / 2) * 0.15;
      this.tirer(hero, angle + ecart);
    }
  }

  private tirer(hero: Hero, angle: number): void {
    const p = this.projectiles.create(hero.x, hero.y, "projectile") as Phaser.Physics.Arcade.Image;
    p.setDepth(hero.y + 1);
    p.setTint(hero.classe.accent);
    p.setData("auteur", hero);
    p.setVelocity(Math.cos(angle) * 340, Math.sin(angle) * 340);
    this.time.delayedCall(1400, () => p.destroy());
  }

  private impactProjectile(p: Phaser.Physics.Arcade.Image, e: Ennemi): void {
    if (!p.active || !e.active) return;
    const auteur = p.getData("auteur") as Hero | undefined;
    if (!auteur || auteur.etat === "mort") {
      p.destroy();
      return;
    }

    // Un projectile perforant traverse : il faut se souvenir de qui il a deja
    // touche, sinon il blesse la meme cible a chaque image.
    const touches = (p.getData("touches") as Set<Ennemi> | undefined) ?? new Set<Ennemi>();
    if (touches.has(e)) return;
    touches.add(e);
    p.setData("touches", touches);

    if (auteur.classe.trait === "explosion") {
      // Trait du mage : chaque tir souffle un groupe entier.
      this.effetCercle(p.x, p.y, 48, 0xd06bff);
      for (const voisin of this.ennemisDansRayon(p.x, p.y, 48)) this.frapper(auteur, voisin);
    } else {
      this.frapper(auteur, e);
    }

    if (!auteur.bonus.perforant) p.destroy();
  }

  private frapper(auteur: Hero, e: Ennemi): void {
    const marque = auteur.multiplicateurContre(e);
    const critique = this.rng.next() < auteur.critChance;
    let degats = critique ? auteur.degats * auteur.critMultiplicateur : auteur.degats;
    degats = Math.round(degats * marque);

    if (marque > 1) this.flotter(e.x, e.y - 18, "MARQUE", "#ff6b5a");
    else if (critique && auteur.estIncarne) this.flotter(e.x, e.y - 14, `${degats} !`, "#ffd166");

    this.blesserEnnemi(e, degats, auteur);
    this.propagerEclairs(auteur, e.x, e.y, e, degats);
  }

  /** Chaine d'eclairs : l'attaque saute d'un ennemi a l'autre. */
  private propagerEclairs(
    auteur: Hero,
    x: number,
    y: number,
    origine: Ennemi,
    degats: number,
  ): void {
    if (auteur.bonus.chaineEclairs <= 0) return;

    const sauts = auteur.bonus.chaineDiffuse
      ? 8
      : auteur.bonus.chaineFulgurante
        ? 2
        : auteur.bonus.chaineEclairs;
    const touches = new Set<Ennemi>([origine]);
    let depuis = { x, y };
    let force = degats;

    for (let i = 0; i < sauts; i++) {
      force *= auteur.bonus.chaineDiffuse ? 0.55 : auteur.bonus.chaineFulgurante ? 1.6 : 0.8;
      const suivant = this.ennemisDansRayon(depuis.x, depuis.y, 130).find((e) => !touches.has(e));
      if (!suivant) return;

      touches.add(suivant);
      this.trainee(depuis.x, depuis.y, suivant.x, suivant.y, 0x8ed6ff);
      depuis = { x: suivant.x, y: suivant.y };
      this.blesserEnnemi(suivant, Math.max(1, Math.round(force)), auteur);
    }
  }

  private ennemiLePlusProche(x: number, y: number, portee: number): Ennemi | null {
    let meilleur: Ennemi | null = null;
    let meilleureDistance = portee;
    for (const objet of this.ennemis.getChildren()) {
      const e = objet as Ennemi;
      if (!e.active) continue;
      const d = Phaser.Math.Distance.Between(x, y, e.x, e.y);
      if (d < meilleureDistance) {
        meilleureDistance = d;
        meilleur = e;
      }
    }
    return meilleur;
  }

  private blesserEnnemi(e: Ennemi, degats: number, auteur: Hero, volDeVieSup = 0): void {
    if (!e.active) return;
    const inflige = Math.min(degats, e.pv);
    e.pv -= degats;
    // Pas de minuterie ici : avec les degats de zone et les chaines, on en
    // creait des centaines par seconde. Un simple horodatage suffit.
    e.setTintFill(0xffffff);
    e.flashJusqua = this.time.now + 70;
    // La gerbe est plafonnee par image dans `effets.ts` : une chaine d'eclairs
    // ou une aura de zone passe ici des dizaines de fois d'affilee.
    eclatImpact(this, e.x, e.y - 4, e.archetype.couleurImpact, 4);

    const vol = auteur.volDeVie + volDeVieSup;
    if (vol > 0) auteur.soigner(inflige * vol);

    if (e.pv > 0) return;
    this.tuer(e, auteur);
  }

  private tuer(e: Ennemi, auteur: Hero): void {
    this.kills += 1;
    auteur.kills += 1;
    if (auteur.bonus.soinParKill > 0) auteur.soigner(auteur.bonus.soinParKill);

    // Sang pour sang : il refuse tout soin, mais chaque mort le remet debout.
    if (auteur.bonus.sangPourSang > 0) {
      auteur.soignerForce(auteur.pvMax * auteur.bonus.sangPourSang);
    }
    // Charognard : le cadavre laisse parfois de quoi tenir.
    if (auteur.bonus.charognard > 0 && this.rng.next() < auteur.bonus.charognard) {
      auteur.soigner(Math.round(auteur.pvMax * 0.06));
      this.flotter(e.x, e.y - 14, "Butin", "#7ee0a0");
    }
    // Danse des ombres : chaque mort raccourcit tous ses rechargements.
    if (auteur.bonus.danseDesOmbres > 0) auteur.reduireRechargements(auteur.bonus.danseDesOmbres);

    // Provocation : chaque mort a ses pieds remet le Chevalier Sacre debout.
    for (const hero of this.heros) {
      if (hero.bonus.provocation <= 0) continue;
      if (Phaser.Math.Distance.Between(hero.x, hero.y, e.x, e.y) <= hero.bonus.provocation) {
        hero.soigner(1);
      }
    }

    const x = e.x;
    const y = e.y;

    // La mort se voit : un pouf de particules, et une depouille qui bascule.
    // Purement decoratif et entierement detache — la logique ci-dessous n'a pas
    // bouge d'une ligne, et le sprite du monstre est detruit comme avant.
    this.marquerLaMort(e);

    // L'XP va au heros qui a tue, pas a l'equipe (DESIGN.md §4.5).
    const monte = auteur.gagnerXp(e.xpDonnee);
    e.destroy();
    // Le cadavre peut se relever pour le Necromancien (DESIGN.md §4.14).
    this.tenterRelevement(x, y);
    if (monte) this.monterDeNiveau(auteur);
  }

  /**
   * Le visuel de mort d'un monstre : un pouf, et une depouille qui s'affale.
   *
   * La depouille est une **copie detachee** du sprite — meme texture, meme
   * teinte, meme orientation — sans corps physique. C'est ce qui autorise la
   * bascule et le retrecissement de `animerMort` : il n'y a plus de hitbox a
   * fausser, et le monstre reel, lui, est detruit dans la foulee.
   */
  private marquerLaMort(e: Ennemi): void {
    poufMort(this, e.x, e.y, e.archetype.couleurImpact);
    if (this.cadavres >= MAX_CADAVRES) return;

    const cle = `${e.familleSprite}-mort`;
    if (!this.anims.exists(cle)) return;

    const depouille = this.add
      .sprite(e.x, e.y, cle)
      .setScale(e.scaleX)
      .setFlipX(e.flipX)
      .setDepth(e.y - 1);
    if (e.teinte !== null) depouille.setTint(e.teinte);

    this.cadavres += 1;
    depouille.play(cle);
    depouille.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      this.cadavres -= 1;
      depouille.destroy();
    });
  }

  // ---------------------------------------------------------- progression

  private monterDeNiveau(hero: Hero): void {
    this.flotter(hero.x, hero.y - 24, `NIVEAU ${hero.niveau}`, "#5ec8f0");
    this.effetCercle(hero.x, hero.y, 70, 0x5ec8f0);
    // Seul le heros incarne interrompt la partie. Ceux joues par l'IA
    // accumulent leurs choix, sinon la vague serait hachee en permanence.
    if (hero.estIncarne && hero.choixEnAttente > 0 && !this.enPause) this.ouvrirChoix();
  }

  private ouvrirChoix(): void {
    this.enPause = true;
    this.debutPause = this.time.now;
    this.physics.pause();
    this.effacerDestination();
    this.modeChoix = "competence";

    const hero = this.hero;
    const defs = tirerCompetences(
      this.rng,
      hero.classe.id,
      hero.competences,
      3,
      // Passera au rang du heros quand les rangs existeront (DESIGN.md §4.1).
      0,
    );
    this.events.emit(
      "choix",
      `NIVEAU ${hero.niveau}`,
      `${hero.classe.nom} — choisis une competence`,
      defs.map((d) => propositionCompetence(d, hero.competences)),
    );
  }

  private resoudreChoix(id: string): void {
    const hero = this.hero;

    if (this.modeChoix === "evolution") {
      const evolution = this.optionsEvolution.find((o) => o.id === id);
      if (evolution && this.competenceEnEvolution) {
        hero.appliquerEvolution(this.competenceEnEvolution.id, evolution);
        this.flotter(hero.x, hero.y - 30, evolution.nom.toUpperCase(), "#f0c419");
      }
      this.competenceEnEvolution = null;
      this.optionsEvolution = [];
      this.terminerChoix();
      return;
    }

    const def = competenceParId(id);
    if (!def) {
      this.terminerChoix();
      return;
    }

    const evolutions = hero.apprendre(def);
    // Veteran : un niveau offert immediatement.
    if (def.id === "veteran") {
      hero.gagnerNiveauImmediat();
      this.flotter(hero.x, hero.y - 30, `NIVEAU ${hero.niveau}`, "#5ec8f0");
    }
    if (evolutions) {
      // La competence change de nature : un second choix s'ouvre, toujours en
      // pause (DESIGN.md §4.13).
      this.modeChoix = "evolution";
      this.competenceEnEvolution = def;
      this.optionsEvolution = evolutions;
      this.events.emit(
        "choix",
        "EVOLUTION",
        `${def.nom} peut changer de nature`,
        evolutions.map((e) => propositionEvolution(def, e)),
      );
      return;
    }

    this.terminerChoix();
  }

  private terminerChoix(): void {
    this.decalerLeTemps(this.time.now - this.debutPause);
    this.physics.resume();
    this.enPause = false;
    if (this.hero.choixEnAttente > 0) this.ouvrirChoix();
  }

  // ------------------------------------------------------------- capacites

  private gererCapacites(): void {
    const hero = this.hero;
    if (!hero || hero.etat === "mort") return;

    hero.capacites.forEach((capacite, i) => {
      if (capacite.automatique) return;
      const touches = this.touchesCapacites[i];
      if (!touches || !touches.some((t) => Phaser.Input.Keyboard.JustDown(t))) return;
      if (!hero.peutLancer(capacite)) return;
      this.lancerCapacite(hero, capacite);
    });
  }

  private gererCapacitesAuto(): void {
    for (const hero of this.heros) {
      if (hero.etat === "mort" || hero.estImmobilise) continue;
      for (const capacite of hero.capacites) {
        if (!capacite.automatique || !hero.peutLancer(capacite)) continue;
        this.lancerCapacite(hero, capacite);
      }
    }
  }

  private lancerCapacite(hero: Hero, capacite: Capacite): void {
    // Echo : la capacite peut ne pas partir en rechargement du tout.
    hero.marquerCapacite(capacite, this.rng.next());
    this.flotter(hero.x, hero.y - 28, capacite.nom.toUpperCase(), "#f0c419");
    // Il se cabre en arriere : plus ample et plus lent qu'un coup, pour qu'on
    // distingue au premier regard une capacite d'une attaque ordinaire.
    declencher(hero.pose, hero, "incantation", this.time.now);

    switch (capacite.effet) {
      case "tourbillon":
        this.effetTourbillon(hero);
        break;
      case "rempart":
        this.effetRempart(hero);
        break;
      case "meteore":
        this.effetMeteore(hero);
        break;
      case "ombre":
        this.effetOmbre(hero);
        break;
      case "sursaut-sacre":
        this.effetSursautSacre(hero);
        break;
      case "benediction":
        this.effetBenediction(hero);
        break;
      case "moulinet":
      case "moulinet-aspirant":
      case "moulinet-sanglant":
        this.effetMoulinet(hero, capacite.effet);
        break;
      case "dome":
        this.effetDome(hero);
        break;
      case "exil":
        this.effetExil(hero);
        break;
      case "invisibilite":
        this.effetInvisibilite(hero);
        break;
      case "hecatombe":
        this.effetHecatombe(hero);
        break;
      case "pluie-de-fleches":
        this.effetPluieDeFleches(hero);
        break;
      case "aube":
        this.effetAube(hero);
        break;
      case "levee-des-morts":
        this.effetLeveeDesMorts(hero);
        break;
      case "martyre":
        this.effetMartyre(hero);
        break;
      case "piege":
        this.effetPiege(hero);
        break;
      case "fleche-du-jugement":
        this.effetFlecheDuJugement(hero);
        break;
      case "priere":
        this.effetPriere(hero);
        break;
      case "chant-de-guerre":
        this.effetChantDeGuerre(hero);
        break;
      case "appel-des-morts":
        this.effetAppelDesMorts(hero);
        break;
      case "orage-final":
        this.effetOrageFinal(hero);
        break;
      case "heure-sombre":
        this.effetHeureSombre(hero);
        break;
      case "jugement":
      case "jugement-croisade":
      case "jugement-absolution":
        this.effetJugement(hero, capacite.effet);
        break;
      case "bouclier-des-ames":
        this.effetBouclierDesAmes(hero);
        break;
      case "charge":
      case "charge-sismique":
      case "charge-sanglante":
        this.effetCharge(hero, capacite.effet);
        break;
      case "cri-de-guerre":
        this.effetCriDeGuerre(hero);
        break;
      case "clignement":
        this.effetClignement(hero);
        break;
      case "sablier":
        this.effetSablier(hero);
        break;
      case "croc-en-jambe":
        this.effetCrocEnJambe(hero);
        break;
      case "doppelganger":
        this.effetDoppelganger(hero);
        break;
      case "contrat":
        this.effetContrat(hero);
        break;
    }
  }

  // --- Chevalier Sacre : Jugement et Bouclier des ames ---

  private effetJugement(hero: Hero, variante: string): void {
    const palier = Math.max(1, hero.palierDe("jugement"));
    const rayon = 80 + palier * 15;

    if (variante === "jugement-croisade") {
      // La colonne ne reste plus au sol : elle le suit.
      this.time.addEvent({
        delay: 400,
        repeat: 14,
        callback: () => {
          if (hero.etat === "mort") return;
          this.effetCercle(hero.x, hero.y, rayon, 0xfff0a0);
          for (const e of this.ennemisDansRayon(hero.x, hero.y, rayon)) {
            this.blesserEnnemi(e, Math.round(hero.degats * 0.9), hero);
          }
        },
      });
      return;
    }

    const point = hero.estIncarne
      ? this.cameras.main.getWorldPoint(this.input.activePointer.x, this.input.activePointer.y)
      : this.pointDevant(hero, 100);

    if (variante === "jugement-absolution") {
      // La lumiere cesse de blesser : elle recoud.
      this.effetCercle(point.x, point.y, rayon, 0xa8ffc8);
      for (const allie of this.heros) {
        if (allie.etat === "mort") continue;
        if (Phaser.Math.Distance.Between(allie.x, allie.y, point.x, point.y) > rayon) continue;
        const soin = allie.pvMax * (0.15 + palier * 0.1);
        allie.soigner(soin);
        this.flotter(allie.x, allie.y - 22, `+${Math.round(soin)}`, "#7ee0a0");
      }
      return;
    }

    this.effetCercle(point.x, point.y, rayon, 0xfff0a0);
    this.trainee(point.x, point.y - 260, point.x, point.y, 0xfff0a0);
    if (hero.estIncarne) this.cameras.main.shake(160, 0.006);
    for (const e of this.ennemisDansRayon(point.x, point.y, rayon)) {
      this.blesserEnnemi(e, Math.round(hero.degats * (2.5 + palier)), hero);
    }
  }

  /**
   * Bouclier des ames : il donne de sa propre vie a ceux qui sont au plus mal.
   * Il ne cree rien — il deplace, et c'est ce qui rend la competence tendue.
   */
  private effetBouclierDesAmes(hero: Hero): void {
    const palier = Math.max(1, hero.palierDe("bouclier-des-ames"));
    const blesses = this.heros.filter(
      (h) => h !== hero && h.etat !== "mort" && h.ratioPv < 0.3,
    );
    if (blesses.length === 0) return;

    const don = Math.round(hero.pv * (0.1 + palier * 0.05));
    if (don < 1) return;
    hero.pv = Math.max(1, hero.pv - don);

    const part = Math.round(don / blesses.length);
    for (const allie of blesses) {
      allie.soigner(part);
      this.trainee(hero.x, hero.y, allie.x, allie.y, 0xffd166);
      this.flotter(allie.x, allie.y - 22, `+${part}`, "#ffd166");
    }
  }

  // --- Guerrier : Charge et Cri de guerre ---

  private effetCharge(hero: Hero, variante: string): void {
    const palier = Math.max(1, hero.palierDe("charge"));
    const distance = 220 + palier * 40;
    const depart = new Phaser.Math.Vector2(hero.x, hero.y);
    const arrivee = this.pointDevant(hero, distance);

    hero.rendreInvulnerable(400);
    this.trainee(depart.x, depart.y, arrivee.x, arrivee.y, 0xffc27a);
    this.faucherLeLong(hero, depart, arrivee, hero.degats * 2);
    hero.setPosition(arrivee.x, arrivee.y);

    if (variante === "charge-sismique") {
      this.effetCercle(arrivee.x, arrivee.y, 120, 0xc9a06b);
      this.cameras.main.shake(220, 0.008);
      for (const e of this.ennemisDansRayon(arrivee.x, arrivee.y, 120)) {
        this.repousser(e, arrivee.x, arrivee.y, 340);
        this.blesserEnnemi(e, hero.degats * 3, hero);
      }
    }

    if (variante === "charge-sanglante") {
      // Il traverse, puis revient aussitot sur ses pas.
      this.time.delayedCall(220, () => {
        if (hero.etat === "mort") return;
        this.trainee(arrivee.x, arrivee.y, depart.x, depart.y, 0xff8080);
        this.faucherLeLong(hero, arrivee, depart, hero.degats * 2);
        hero.setPosition(depart.x, depart.y);
      });
    }
  }

  private faucherLeLong(
    hero: Hero,
    depart: Phaser.Math.Vector2,
    arrivee: Phaser.Math.Vector2,
    degats: number,
  ): void {
    const segment = new Phaser.Geom.Line(depart.x, depart.y, arrivee.x, arrivee.y);
    for (const e of [...this.ennemis.getChildren()] as Ennemi[]) {
      if (!e.active) continue;
      const proche = Phaser.Geom.Line.GetNearestPoint(segment, e, new Phaser.Geom.Point());
      if (Phaser.Math.Distance.Between(proche.x, proche.y, e.x, e.y) > 48) continue;
      this.repousser(e, depart.x, depart.y, 260);
      this.blesserEnnemi(e, degats, hero);
    }
  }

  private effetCriDeGuerre(hero: Hero): void {
    const palier = Math.max(1, hero.palierDe("cri-de-guerre"));
    const duree = 4000 + palier * 2000;
    const gain = 1 + 0.1 + palier * 0.1;

    this.effetCercle(hero.x, hero.y, 220, 0xffd166);
    if (hero.estIncarne) this.cameras.main.shake(180, 0.005);
    for (const e of this.ennemisDansRayon(hero.x, hero.y, 220)) {
      this.repousser(e, hero.x, hero.y, 420);
      e.ralentir(1500, 0.6);
    }

    // L'equipe entiere frappe plus fort le temps du cri.
    for (const allie of this.heros) {
      if (allie.etat === "mort") continue;
      allie.bonus.multiplicateurDegats *= gain;
    }
    this.time.delayedCall(duree, () => {
      for (const allie of this.heros) allie.bonus.multiplicateurDegats /= gain;
    });
  }

  // --- Mage : Clignement et Sablier ---

  private effetClignement(hero: Hero): void {
    const palier = Math.max(1, hero.palierDe("clignement"));
    const depart = new Phaser.Math.Vector2(hero.x, hero.y);
    const vise = hero.estIncarne
      ? this.cameras.main.getWorldPoint(this.input.activePointer.x, this.input.activePointer.y)
      : this.pointDevant(hero, 200);

    const portee = 180 + palier * 60;
    const direction = new Phaser.Math.Vector2(vise.x - hero.x, vise.y - hero.y);
    if (direction.length() > portee) direction.setLength(portee);

    const arrivee = this.ramenerSurTerre(depart.x + direction.x, depart.y + direction.y);
    hero.setPosition(arrivee.x, arrivee.y);
    hero.rendreInvulnerable(300);

    // La deflagration reste a l'endroit qu'il quitte.
    this.effetCercle(depart.x, depart.y, 70 + palier * 15, 0xd06bff);
    for (const e of this.ennemisDansRayon(depart.x, depart.y, 70 + palier * 15)) {
      this.repousser(e, depart.x, depart.y, 240);
      this.blesserEnnemi(e, hero.degats * (1 + palier), hero);
    }
  }

  private effetSablier(hero: Hero): void {
    const palier = Math.max(1, hero.palierDe("sablier"));
    const duree = 3000 + palier * 2000;
    const facteur = palier >= 2 ? 0.25 : 0.4;
    const rayon = 240;

    this.aura(hero.x, hero.y, rayon / 8, 0x8ed6ff, duree);
    const x = hero.x;
    const y = hero.y;
    this.time.addEvent({
      delay: 300,
      repeat: Math.floor(duree / 300) - 1,
      callback: () => {
        for (const e of this.ennemisDansRayon(x, y, rayon)) e.ralentir(500, facteur);
      },
    });
  }

  // --- Assassin : Croc-en-jambe, Doppelganger, Contrat ---

  private effetCrocEnJambe(hero: Hero): void {
    const palier = Math.max(1, hero.palierDe("croc-en-jambe"));
    const rayon = 80 + palier * 20;
    const point = hero.estIncarne
      ? this.cameras.main.getWorldPoint(this.input.activePointer.x, this.input.activePointer.y)
      : this.pointDevant(hero, 80);

    const tapis = this.add
      .image(point.x, point.y, "impact")
      .setTint(0xb0a08a)
      .setAlpha(0.3)
      .setScale((rayon * 2) / 16)
      .setDepth(point.y - 4);

    this.time.addEvent({
      delay: 500,
      repeat: 11,
      callback: () => {
        for (const e of this.ennemisDansRayon(point.x, point.y, rayon)) {
          e.ralentir(600, 0.6);
          this.blesserEnnemi(e, Math.round(hero.degats * (0.4 + palier * 0.2)), hero);
        }
      },
    });
    this.time.delayedCall(6000, () => tapis.active && tapis.destroy());
  }

  private effetDoppelganger(hero: Hero): void {
    const palier = Math.max(1, hero.palierDe("doppelganger"));
    const double = new Double(this, hero.x, hero.y, hero, palier);
    this.invocations.add(double);
    this.effetCercle(hero.x, hero.y, 50, 0x9fd8ff);
  }

  /**
   * Contrat : la cible mourra, quoi qu'il arrive. En echange, l'assassin ne
   * peut plus toucher personne d'autre tant que le contrat court — c'est ce
   * renoncement qui en fait autre chose qu'un bouton "je gagne".
   */
  private effetContrat(hero: Hero): void {
    const palier = Math.max(1, hero.palierDe("contrat"));
    const delai = palier >= 2 ? 7000 : 10000;

    const candidats = this.ennemisDansRayon(hero.x, hero.y, 600);
    if (candidats.length === 0) {
      this.flotter(hero.x, hero.y - 20, "Personne a contracter", "#8a8397");
      return;
    }
    const cible = candidats.reduce((a, b) => (b.pv > a.pv ? b : a));

    cible.souscontrat = true;
    cible.setTint(0xff3b30);
    this.contrats.set(hero, cible);
    this.flotter(cible.x, cible.y - 22, "CONTRAT", "#ff3b30");

    this.time.delayedCall(delai, () => {
      this.contrats.delete(hero);
      if (!cible.active) return;
      this.flotter(cible.x, cible.y - 20, "HONORE", "#ff3b30");
      this.effetCercle(cible.x, cible.y, 70, 0xff3b30);
      this.blesserEnnemi(cible, cible.pv, hero);
    });
  }

  // --- Rodeur ---

  private effetPluieDeFleches(hero: Hero): void {
    const groupe = this.groupeLePlusDense(hero, 420, 120);
    if (!groupe) return;
    const x = groupe.x;
    const y = groupe.y;

    this.time.addEvent({
      delay: 180,
      repeat: 9,
      callback: () => {
        const px = x + this.rng.range(-110, 110);
        const py = y + this.rng.range(-110, 110);
        this.effetCercle(px, py, 34, 0xd8c48a);
        for (const e of this.ennemisDansRayon(px, py, 40)) {
          this.blesserEnnemi(e, Math.round(hero.degats * 1.1), hero);
        }
      },
    });
  }

  private effetPiege(hero: Hero): void {
    const palier = Math.max(1, hero.palierDe("piege"));
    const point = hero.estIncarne
      ? this.cameras.main.getWorldPoint(this.input.activePointer.x, this.input.activePointer.y)
      : this.pointDevant(hero, 90);

    const image = this.add
      .image(point.x, point.y, "impact")
      .setTint(0xb0a08a)
      .setAlpha(0.6)
      .setScale(2.4)
      .setDepth(point.y - 4);

    const surveiller = this.time.addEvent({
      delay: 120,
      repeat: 150,
      callback: () => {
        const pris = this.ennemisDansRayon(point.x, point.y, 34);
        if (pris.length === 0) return;
        for (const e of pris) {
          e.ralentir(1000 + palier * 1000);
          if (palier >= 2) this.blesserEnnemi(e, hero.degats * palier, hero);
        }
        this.effetCercle(point.x, point.y, 40, 0xb0a08a);
        image.destroy();
        surveiller.remove();
      },
    });
    this.time.delayedCall(18000, () => image.active && image.destroy());
  }

  private effetFlecheDuJugement(hero: Hero): void {
    const palier = Math.max(1, hero.palierDe("fleche-du-jugement"));
    const seuil = 0.25 + palier * 0.15;
    const arrivee = this.pointDevant(hero, 2000);
    this.trainee(hero.x, hero.y, arrivee.x, arrivee.y, 0xfff0a0);
    this.cameras.main.shake(220, 0.008);

    const segment = new Phaser.Geom.Line(hero.x, hero.y, arrivee.x, arrivee.y);
    for (const e of [...this.ennemis.getChildren()] as Ennemi[]) {
      if (!e.active) continue;
      const proche = Phaser.Geom.Line.GetNearestPoint(segment, e, new Phaser.Geom.Point());
      if (Phaser.Math.Distance.Between(proche.x, proche.y, e.x, e.y) > 56) continue;
      if (e.pv / e.pvMax <= seuil) {
        this.flotter(e.x, e.y - 16, "JUGE", "#fff0a0");
        this.blesserEnnemi(e, e.pv, hero);
      } else {
        this.blesserEnnemi(e, hero.degats * 3, hero);
      }
    }
  }

  // --- Oracle ---

  private effetAube(hero: Hero): void {
    this.cameras.main.flash(300, 255, 240, 200);
    for (const allie of this.heros) {
      if (allie.etat === "mort") continue;
      allie.soigner(allie.pvMax * 0.45);
      allie.rendreInvulnerable(1600);
      this.effetCercle(allie.x, allie.y, 70, 0xfff0c0);
    }
    void hero;
  }

  private effetPriere(hero: Hero): void {
    const palier = Math.max(1, hero.palierDe("priere"));
    let cible: Hero | null = null;
    for (const allie of this.heros) {
      if (allie.etat === "mort") continue;
      if (!cible || allie.ratioPv < cible.ratioPv) cible = allie;
    }
    if (!cible) return;
    const soin = cible.pvMax * (0.15 + palier * 0.1);
    cible.soigner(soin);
    this.effetCercle(cible.x, cible.y, 60, 0xfff0c0);
    this.flotter(cible.x, cible.y - 22, `+${Math.round(soin)}`, "#7ee0a0");
  }

  private effetChantDeGuerre(hero: Hero): void {
    const palier = Math.max(1, hero.palierDe("chant-de-guerre"));
    const duree = 7000 + palier * 1000;
    const facteur = palier >= 2 ? 0.55 : 0.7;

    for (const allie of this.heros) {
      if (allie.etat === "mort") continue;
      allie.cadenceTemporaire = facteur;
      this.effetCercle(allie.x, allie.y, 50, 0xffd166);
    }
    this.time.delayedCall(duree, () => {
      for (const allie of this.heros) allie.cadenceTemporaire = 1;
    });
  }

  // --- Chevalier Sacre ---

  /**
   * Martyre : pendant quelques secondes, il encaisse a la place de tout le
   * monde et ne peut pas mourir. C'est le sommet de sa classe : il transforme
   * un effondrement d'equipe en sursis.
   */
  private effetMartyre(hero: Hero): void {
    const palier = Math.max(1, hero.palierDe("martyre"));
    const duree = 5000 + palier * 3000;
    this.martyr = hero;
    hero.rendreInvulnerable(duree);
    this.aura(hero.x, hero.y, 5, 0xffd166, duree);
    this.time.delayedCall(duree, () => {
      if (this.martyr === hero) this.martyr = null;
    });
  }

  // --- Necromancien ---

  private effetLeveeDesMorts(hero: Hero): void {
    // Tous les ennemis proches tombent et se relevent de son cote.
    const proies = this.ennemisDansRayon(hero.x, hero.y, 600).slice(0, 8);
    for (const e of proies) {
      const x = e.x;
      const y = e.y;
      this.blesserEnnemi(e, e.pv, hero);
      this.relever(hero, x, y);
    }
    this.effetCercle(hero.x, hero.y, 180, 0x9ee8a0);
  }

  private effetAppelDesMorts(hero: Hero): void {
    const armee = (this.invocations.getChildren() as Invocation[]).filter(
      (i) => i.active && i instanceof MortVivant && i.maitre === hero,
    );
    if (armee.length === 0) {
      this.flotter(hero.x, hero.y - 20, "Aucun mort a appeler", "#8a8397");
      return;
    }

    let x = 0;
    let y = 0;
    for (const mort of armee) {
      x += mort.x;
      y += mort.y;
      mort.destroy();
    }

    const colosse = new MortVivant(this, x / armee.length, y / armee.length, hero);
    colosse.pvMax *= armee.length;
    colosse.pv = colosse.pvMax;
    colosse.degats *= Math.max(2, Math.round(armee.length / 2));
    colosse.vitesse *= 0.7;
    colosse.setScale(2.4);
    colosse.finDeVie = Infinity;
    this.invocations.add(colosse);

    this.effetCercle(colosse.x, colosse.y, 200, 0x9ee8a0);
    this.cameras.main.shake(400, 0.01);
  }

  // --- Communes de haut rang ---

  private effetOrageFinal(hero: Hero): void {
    const palier = Math.max(1, hero.palierDe("orage-final"));
    const duree = 6000 + palier * 4000;

    this.time.addEvent({
      delay: 400,
      repeat: Math.floor(duree / 400) - 1,
      callback: () => {
        if (hero.etat === "mort") return;
        const cible = this.ennemiLePlusProche(hero.x, hero.y, 280);
        const x = cible?.x ?? hero.x + this.rng.range(-160, 160);
        const y = cible?.y ?? hero.y + this.rng.range(-160, 160);
        this.trainee(x, y - 200, x, y, 0x8ed6ff);
        this.effetCercle(x, y, 60, 0x8ed6ff);
        for (const e of this.ennemisDansRayon(x, y, 60)) {
          this.blesserEnnemi(e, Math.round(hero.degats * 1.6), hero);
        }
      },
    });
  }

  /** Heure sombre : le temps s'arrete pour tout le monde sauf le joueur. */
  private effetHeureSombre(hero: Hero): void {
    const palier = Math.max(1, hero.palierDe("heure-sombre"));
    const duree = 1500 + palier * 1500;
    this.figeJusqua = this.time.now + duree;
    this.cameras.main.flash(200, 40, 20, 60);
    for (const objet of this.ennemis.getChildren()) (objet as Ennemi).setTint(0x6b6478);
    this.time.delayedCall(duree, () => {
      for (const objet of this.ennemis.getChildren()) (objet as Ennemi).clearTint();
    });
    void hero;
  }

  private groupeLePlusDense(hero: Hero, portee: number, rayon: number): Ennemi | null {
    const candidats = this.ennemisDansRayon(hero.x, hero.y, portee);
    if (candidats.length === 0) return null;
    let cible = candidats[0]!;
    let meilleur = -1;
    for (const e of candidats) {
      const compte = this.ennemisDansRayon(e.x, e.y, rayon).length;
      if (compte > meilleur) {
        meilleur = compte;
        cible = e;
      }
    }
    return cible;
  }

  // --- Ultimes de classe ---

  private effetTourbillon(hero: Hero): void {
    const rayon = 110;
    this.effetCercle(hero.x, hero.y, rayon, 0xff9d4a);
    if (hero.estIncarne) this.cameras.main.shake(140, 0.006);
    for (const e of this.ennemisDansRayon(hero.x, hero.y, rayon)) {
      this.repousser(e, hero.x, hero.y, 300);
      this.blesserEnnemi(e, hero.degats * 3, hero);
    }
  }

  private effetRempart(hero: Hero): void {
    hero.rendreInvulnerable(3500);
    this.effetCercle(hero.x, hero.y, 140, 0x8ec9ff);
    for (const e of this.ennemisDansRayon(hero.x, hero.y, 140)) {
      this.repousser(e, hero.x, hero.y, 420);
      this.blesserEnnemi(e, hero.degats, hero);
    }
    this.aura(hero.x, hero.y, 3, 0x8ec9ff, 3500);
  }

  private effetMeteore(hero: Hero): void {
    const candidats = this.ennemisDansRayon(hero.x, hero.y, 340);
    if (candidats.length === 0) return;

    let cible = candidats[0]!;
    let meilleurCompte = -1;
    for (const e of candidats) {
      const compte = this.ennemisDansRayon(e.x, e.y, 100).length;
      if (compte > meilleurCompte) {
        meilleurCompte = compte;
        cible = e;
      }
    }

    this.effetCercle(cible.x, cible.y, 110, 0xd06bff);
    if (hero.estIncarne) this.cameras.main.shake(180, 0.007);
    for (const e of this.ennemisDansRayon(cible.x, cible.y, 110)) {
      this.blesserEnnemi(e, hero.degats * 4, hero);
    }
  }

  private effetOmbre(hero: Hero): void {
    const arrivee = this.pointDevant(hero, 230);
    hero.rendreInvulnerable(500);
    this.trainee(hero.x, hero.y, arrivee.x, arrivee.y, 0x7ee0a0);

    const segment = new Phaser.Geom.Line(hero.x, hero.y, arrivee.x, arrivee.y);
    for (const e of [...this.ennemis.getChildren()] as Ennemi[]) {
      if (!e.active) continue;
      const proche = Phaser.Geom.Line.GetNearestPoint(segment, e, new Phaser.Geom.Point());
      if (Phaser.Math.Distance.Between(proche.x, proche.y, e.x, e.y) <= 44) {
        this.blesserEnnemi(e, hero.degats * 5, hero);
      }
    }
    hero.setPosition(arrivee.x, arrivee.y);
  }

  // --- Chevalier Sacre ---

  private effetSursautSacre(hero: Hero): void {
    const palier = Math.max(1, hero.palierDe("sursaut-sacre"));
    hero.rendreInvulnerable(1000);
    hero.soigner(hero.pvMax * (0.2 + palier * 0.05));
    this.effetCercle(hero.x, hero.y, 130, 0xfff0a0);
    for (const e of this.ennemisDansRayon(hero.x, hero.y, 130)) this.repousser(e, hero.x, hero.y, 380);
  }

  private effetBenediction(hero: Hero): void {
    const palier = Math.max(1, hero.palierDe("benediction"));
    const duree = 4000 + palier * 1000;
    const soin = palier;
    const x = hero.x;
    const y = hero.y;
    const rayon = 130;

    this.aura(x, y, rayon / 8, 0xa8ffc8, duree);
    this.time.addEvent({
      delay: 1000,
      repeat: Math.floor(duree / 1000) - 1,
      callback: () => {
        for (const allie of this.heros) {
          if (allie.etat === "mort") continue;
          if (Phaser.Math.Distance.Between(allie.x, allie.y, x, y) > rayon) continue;
          allie.soigner(soin);
          this.flotter(allie.x, allie.y - 20, `+${soin}`, "#7ee0a0");
        }
      },
    });
  }

  // --- Guerrier ---

  private effetMoulinet(hero: Hero, variante: string): void {
    const palier = Math.max(1, hero.palierDe("moulinet"));
    const duree = 2000 + palier * 500;
    const rayon = 90;
    const ticks = Math.floor(duree / 200);

    this.time.addEvent({
      delay: 200,
      repeat: ticks - 1,
      callback: () => {
        if (hero.etat === "mort") return;
        for (const e of this.ennemisDansRayon(hero.x, hero.y, rayon)) {
          if (variante === "moulinet-aspirant") this.repousser(e, hero.x, hero.y, -220);
          this.blesserEnnemi(
            e,
            Math.round(hero.degats * 0.55),
            hero,
            variante === "moulinet-sanglant" ? 1 : 0,
          );
        }
        this.effetCercle(hero.x, hero.y, rayon, 0xffc27a);
      },
    });
  }

  // --- Mage ---

  private effetDome(hero: Hero): void {
    const palier = Math.max(1, hero.palierDe("dome"));
    const pv = [60, 110, 180][palier - 1] ?? 60;
    const rayon = 70;

    // Pose ou le joueur regarde ; l'IA le pose devant elle.
    const point = hero.estIncarne
      ? this.cameras.main.getWorldPoint(this.input.activePointer.x, this.input.activePointer.y)
      : this.pointDevant(hero, 90);

    const image = this.add
      .image(point.x, point.y, "impact")
      .setTint(0x8ed6ff)
      .setAlpha(0.45)
      .setScale((rayon * 2) / 16)
      .setDepth(point.y - 3);

    this.domes.push({ image, x: point.x, y: point.y, rayon, pv, pvMax: pv });
  }

  /**
   * Exil : il sacrifie tout. Toutes les creatures hostiles sont bannies sans
   * rapporter la moindre experience, et le mage reste 30 secondes a un point de
   * vie, immobile, insoignable, condamne au moindre contact.
   */
  private effetExil(hero: Hero): void {
    this.cameras.main.shake(600, 0.014);
    this.cameras.main.flash(400, 200, 120, 255);

    for (const objet of [...this.ennemis.getChildren()] as Ennemi[]) {
      if (!objet.active) continue;
      this.effetCercle(objet.x, objet.y, 30, 0xd06bff);
      objet.destroy(); // banni : personne ne gagne d'experience
    }

    hero.pv = Math.max(1, Math.round(hero.pvMax * 0.01));
    hero.immobiliser(30000);
    hero.condamner(30000);
    this.aura(hero.x, hero.y, 4, 0xd06bff, 30000);
    this.flotter(hero.x, hero.y - 40, "30 s a decouvert", "#ff8a7a");
  }

  // --- Assassin ---

  private effetInvisibilite(hero: Hero): void {
    const palier = Math.max(1, hero.palierDe("invisibilite"));
    const duree = 4000 + palier * 1000;
    hero.rendreInvisible(duree);
    hero.multiplicateurVitesse = 1 + 0.05 + palier * 0.05;
    this.time.delayedCall(duree, () => void (hero.multiplicateurVitesse = 1));
  }

  /**
   * Hecatombe : tout ce qui agonise meurt, et chaque execution projette
   * l'assassin sur sa cible suivante.
   */
  private effetHecatombe(hero: Hero): void {
    const palier = Math.max(1, hero.palierDe("hecatombe"));
    const seuil = 0.05 + palier * 0.05;

    const condamnes = this.ennemisDansRayon(hero.x, hero.y, 520)
      .filter((e) => e.pv / e.pvMax <= seuil)
      .sort(
        (a, b) =>
          Phaser.Math.Distance.Between(hero.x, hero.y, a.x, a.y) -
          Phaser.Math.Distance.Between(hero.x, hero.y, b.x, b.y),
      )
      .slice(0, 10);

    if (condamnes.length === 0) {
      this.flotter(hero.x, hero.y - 20, "Personne a achever", "#8a8397");
      return;
    }

    hero.rendreInvulnerable(condamnes.length * 120 + 200);
    condamnes.forEach((e, i) => {
      this.time.delayedCall(i * 110, () => {
        if (!e.active || hero.etat === "mort") return;
        this.trainee(hero.x, hero.y, e.x, e.y, 0x7ee0a0);
        hero.setPosition(e.x, e.y);
        this.flotter(e.x, e.y - 16, "EXECUTE", "#ff6b5a");
        this.blesserEnnemi(e, e.pv, hero);
      });
    });
  }

  // ------------------------------------------------------------- outillage

  private pointDevant(hero: Hero, distance: number): Phaser.Math.Vector2 {
    return this.ramenerSurTerre(
      hero.x + hero.regard.x * distance,
      hero.y + hero.regard.y * distance,
    );
  }

  /**
   * Ramene un point dans la zone praticable.
   *
   * Sans ca, un Clignement ou une Charge deposerait le heros au milieu de la
   * mer ou dans la roche — et un flanc ferme qu'on peut franchir par une
   * capacite n'est pas un flanc ferme (DESIGN.md §4.6).
   */
  private ramenerSurTerre(x: number, y: number): Phaser.Math.Vector2 {
    const marge = 8;
    return new Phaser.Math.Vector2(
      Phaser.Math.Clamp(x, PRATICABLE.x + marge, PRATICABLE.x + PRATICABLE.largeur - marge),
      Phaser.Math.Clamp(y, PRATICABLE.y + marge, PRATICABLE.y + PRATICABLE.hauteur - marge),
    );
  }

  private ennemisDansRayon(x: number, y: number, rayon: number): Ennemi[] {
    const trouves: Ennemi[] = [];
    for (const objet of this.ennemis.getChildren()) {
      const e = objet as Ennemi;
      if (e.active && Phaser.Math.Distance.Between(x, y, e.x, e.y) <= rayon) trouves.push(e);
    }
    return trouves;
  }

  private repousser(e: Ennemi, x: number, y: number, force: number): void {
    const angle = Phaser.Math.Angle.Between(x, y, e.x, e.y);
    e.setVelocity(Math.cos(angle) * force, Math.sin(angle) * force);
  }

  // -------------------------------------------------------- le jour et la nuit

  /**
   * L'horloge du jeu (DESIGN.md §4.19).
   *
   * Elle ne fait que trois choses : avancer, annoncer les bascules, et teinter
   * le ciel. Tout le calcul est dans `core/cycle.ts`, ou il se teste.
   */
  private majCycle(delta: number): void {
    const bascule = this.cycle.avancer(delta);

    if (bascule === "crepuscule") this.tomberLaNuit();
    else if (bascule === "aube") this.leverLeJour();

    this.teinterLeCiel();
  }

  /**
   * L'opacite du voile, calculee une fois par image.
   *
   * Le fondu prend les dernieres minutes du jour et les premieres de la nuit :
   * on voit le soleil descendre bien avant qu'il ne soit couche. Le §4.6 exige
   * qu'un assaut soit annonce — c'est cette annonce-la, et elle ne peut pas
   * etre manquee.
   */
  private teinterLeCiel(): void {
    const { phase, part } = this.cycle;
    const NUIT_PLEINE = 0.55;
    const FONDU = 0.12;

    let opacite: number;
    if (phase === "jour") {
      opacite = part > 1 - FONDU ? ((part - (1 - FONDU)) / FONDU) * NUIT_PLEINE : 0;
    } else {
      opacite = part > 1 - FONDU ? (1 - (part - (1 - FONDU)) / FONDU) * NUIT_PLEINE : NUIT_PLEINE;
    }
    this.voile.setAlpha(opacite);
  }

  private tomberLaNuit(): void {
    const nuit = this.cycle.nuit;
    this.resteDeLaNuit = effectifDeLaNuit(nuit);
    this.village.tomberLaNuit();

    this.fronts = frontsDeLaVague(nuit, this.rng.next());
    this.partPremierFront = repartition(this.fronts, this.rng.next());
    this.prochaineApparition = this.time.now;

    const ou = this.fronts.map((f) => NOMS_FRONT[f]).join(" et ");
    this.events.emit("annonce", `Nuit ${nuit} — ils arrivent ${ou}`);
    // Un moment qui compte, et le dernier calme avant longtemps (§4.28).
    this.enregistrer();
  }

  private leverLeJour(): void {
    // Ce qui restait de l'effectif ne poursuit pas la journee : la nuit est
    // finie, ceux qui sont encore debout finissent la leur.
    this.resteDeLaNuit = 0;
    this.village.seLever(this.cycle.jour);
    this.passerLaJourneeDesHeros();
    this.programmerHorde();
    this.events.emit("annonce", `Jour ${this.cycle.jour} — le soleil se leve`);
    // La nuit est finie : c'est le moment-cle par excellence (§4.28).
    this.enregistrer();
  }

  /**
   * Une journee de plus pour les heros (DESIGN.md §4.23).
   *
   * C'est le seul endroit ou le temps **long** avance de leur cote : les etats
   * se comptent en journees, pas en millisecondes. Le village a exactement la
   * meme methode, et c'est bien un seul systeme pour deux populations.
   */
  private passerLaJourneeDesHeros(): void {
    for (const hero of this.heros) {
      if (hero.etat === "mort") continue;
      const { personne } = hero;

      // Une nuit dehors se compte a l'aube, pas pendant : sinon un heros qui
      // rentre a l'eglise dix fois compterait dix nuits (§4.23).
      personne.exploits.nuitsDehors += 1;
      if (hero.estCritique) personne.exploits.nuitSousLeSeuil = true;
      personne.exploits.kills = hero.kills;

      for (const evenement of avancerLaJournee(personne, 1)) {
        if (evenement.quoi === "mort") {
          this.events.emit("annonce", `${personne.nom} n'a pas survecu — ${evenement.nom}`);
          this.tomber(hero);
          break;
        }
        this.events.emit("annonce", `${personne.nom} : ${evenement.nom}`);
      }

      this.annoncerLesExploits(hero);
    }
  }

  /**
   * Les arrivees, jour et nuit confondus.
   *
   * La nuit vide un effectif ; le jour, c'est une horde annoncee qui tombe. Dans
   * les deux cas le plafond d'ecran a le dernier mot : la difficulte monte par
   * la force, pas par le nombre (§4.17).
   */
  private fairePartirLesVagues(): void {
    if (this.cycle.phase === "nuit") this.deverserLaNuit();
    else this.guetterLesHordes();
  }

  private deverserLaNuit(): void {
    if (this.resteDeLaNuit <= 0) return;
    if (this.time.now < this.prochaineApparition) return;

    const place = MAX_ENNEMIS - this.ennemis.getLength();
    if (place > 0) {
      this.faireApparaitreEnnemi(puissanceDeLaNuit(this.cycle.nuit));
      this.resteDeLaNuit -= 1;
    }

    // Meme quand l'ecran est plein, on repousse l'echeance : sinon on
    // reessaierait a chaque image, pour rien.
    this.prochaineApparition = this.time.now + intervalleDeLaNuit(this.cycle.nuit);
  }

  /**
   * Les hordes de jour (DESIGN.md §4.19).
   *
   * Elles empechent la journee de 30 minutes d'etre un temps mort : on travaille
   * en surveillant l'horizon. Le preavis est court — assez pour rappeler un
   * heros ou sonner la cloche, trop peu pour tout reorganiser.
   */
  private guetterLesHordes(): void {
    const maintenant = this.time.now;

    if (this.hordeAuDepart > 0) {
      if (maintenant < this.hordeAuDepart) return;
      const puissance = puissanceDeLaNuit(this.cycle.jour);
      const place = MAX_ENNEMIS - this.ennemis.getLength();
      for (let i = 0; i < Math.min(this.tailleHordeEnRoute, place); i++) {
        this.faireApparaitreEnnemi(puissance);
      }
      this.hordeAuDepart = 0;
      this.programmerHorde();
      return;
    }

    if (maintenant < this.prochaineHorde) return;

    // Une horde n'ouvre pas de front : elle emprunte ceux qui le sont deja.
    this.fronts = frontsDeLaVague(this.cycle.jour, this.rng.next());
    this.partPremierFront = repartition(this.fronts, this.rng.next());
    this.tailleHordeEnRoute = tailleDeLaHorde(this.cycle.jour);
    this.hordeAuDepart = maintenant + REGLAGES_CYCLE.preavisHorde;

    const ou = this.fronts.map((f) => NOMS_FRONT[f]).join(" et ");
    this.events.emit("annonce", `Une horde arrive ${ou} !`);
  }

  private programmerHorde(): void {
    this.prochaineHorde = this.time.now + delaiProchaineHorde(this.rng.next());
    this.hordeAuDepart = 0;
  }

  private faireApparaitreEnnemi(puissance: number): void {
    // Les ennemis surgissent au bord d'un front ouvert, jamais autour du
    // joueur : la mer et la montagne ne laissent passer personne (§4.6).
    const front: Front =
      this.fronts.length > 1 && this.rng.next() > this.partPremierFront
        ? this.fronts[1]!
        : this.fronts[0]!;

    // L'archetype module la puissance, il ne la remplace pas : les seuils font
    // que les premieres minutes n'envoient que des fonceurs, puis que la
    // variete s'ouvre a mesure que la vague durcit.
    const archetype = choisirArchetype(puissance, this.rng.next());
    const point = pointDApparition(front, this.rng.next());
    const e = new Ennemi(this, point.x, point.y, puissance, archetype);
    this.ennemis.add(e);
    this.annoncerNouveaute(archetype.id, archetype.nom);
  }

  /**
   * La premiere apparition d'un archetype se dit.
   *
   * Un monstre qui tire a distance ou qui explose change la facon de jouer :
   * le decouvrir en mourant serait une punition, pas une surprise.
   */
  private annoncerNouveaute(id: string, nom: string): void {
    if (this.archetypesVus.has(id)) return;
    this.archetypesVus.add(id);
    // Le fonceur est le fond de la vague : il n'a rien d'une nouvelle.
    if (id === "fonceur") return;
    this.events.emit("annonce", `Nouveau : ${nom}`);
  }

  // --------------------------------------------------------------- degats

  /**
   * Un monstre touche un heros : il **s'arme**, il ne blesse pas encore.
   *
   * C'est tout le changement du jalon. Avant, le contact appliquait les degats
   * dans l'image meme : on encaissait sans avoir rien vu venir. Maintenant le
   * contact ne fait que declencher le telegraphe ; les degats sont appliques
   * par `resoudreFrappe`, quelques centaines de millisecondes plus tard, et
   * seulement si la cible est toujours la.
   */
  private contactEnnemi(hero: Hero, e: Ennemi): void {
    if (!e.active || this.termine || this.enPause) return;
    // Un heros en repli, a la cite ou invisible a decroche.
    if (!hero.estAuCombat || hero.estInvisible) return;
    // Le cracheur n'a rien a faire au corps a corps : il tire, et c'est tout.
    if (e.archetype.comportement === "cracheur") return;
    if (e.enArmement || !e.peutFrapper(this.time.now)) return;
    this.armerEnnemi(e, hero);
  }

  /** Il se cabre, se tourne vers sa proie, et le coup part plus tard. */
  private armerEnnemi(e: Ennemi, hero: Hero): void {
    const maintenant = this.time.now;
    e.armer(maintenant, hero);
    declencher(e.pose, e, "charge", maintenant, hero);
    orienter(e, hero.x - e.x, SEUIL_REGARD_PIXELS);
  }

  /**
   * Le coup arme arrive a echeance.
   *
   * Il peut tres bien **partir dans le vide** : c'est ce qui donne son sens au
   * telegraphe. Voir venir un coup sans pouvoir l'eviter ne serait qu'une
   * decoration.
   */
  private resoudreFrappe(e: Ennemi): void {
    const cible = e.cibleArmee;
    const maintenant = this.time.now;
    e.desarmer();

    // Le kamikaze n'a pas de coup : il a une meche.
    if (e.archetype.comportement === "kamikaze") {
      this.exploser(e);
      return;
    }

    if (!cible || !cible.estAuCombat || cible.estInvisible) return;

    const angle = Phaser.Math.Angle.Between(e.x, e.y, cible.x, cible.y);
    declencher(e.pose, e, "attaque", maintenant, cible);

    if (e.archetype.comportement === "cracheur") {
      this.cracher(e, angle);
      return;
    }

    // Trait "riposte" du Chevalier Sacre : il blesse ce qui le frappe.
    if (cible.classe.trait === "riposte") {
      this.blesserEnnemi(e, Math.round(cible.degats * 0.9), cible);
    }

    const distance = Phaser.Math.Distance.Between(e.x, e.y, cible.x, cible.y);
    if (distance > e.archetype.portee) {
      // Elle s'est ecartee a temps : le geste fauche l'air, en gris.
      tranche(this, e.x, e.y, angle, 0x8a8397, e.archetype.portee);
      return;
    }

    tranche(this, e.x, e.y, angle, e.archetype.couleurImpact, e.archetype.portee);
    // La brute frappe assez fort pour qu'on le sente a la manette.
    if (e.archetype.comportement === "brute" && cible.estIncarne) hitstop(this, 45);
    this.encaisser(cible, e.degats, e.x, e.y, e.archetype.couleurImpact);
  }

  /**
   * Un heros encaisse : le bloc de degats commun a toutes les sources.
   *
   * Rien n'a change au calcul — martyre, esquive, `subirDegats`, plancher de
   * vie des heros IA sont exactement ceux d'avant. Ce qui s'y ajoute est
   * purement visuel : eclat d'impact, eclair blanc, sursaut et recul.
   */
  private encaisser(
    hero: Hero,
    degats: number,
    sourceX: number,
    sourceY: number,
    couleur: number,
  ): void {
    const maintenant = this.time.now;

    // Martyre : le Chevalier Sacre encaisse a la place de toute l'equipe.
    if (this.martyr && this.martyr !== hero && this.martyr.etat !== "mort") {
      this.martyr.subirDegats(degats, this.rng.next());
      flashCible(this.martyr, maintenant);
      declencher(this.martyr.pose, this.martyr, "touche", maintenant, { x: sourceX });
      this.flotter(this.martyr.x, this.martyr.y - 22, "Martyre", "#ffd166");
      return;
    }

    const esquive = hero.subirDegats(degats, this.rng.next());
    if (esquive) {
      if (hero.estIncarne) this.flotter(hero.x, hero.y - 18, "Esquive", "#7ee0a0");
      return;
    }

    eclatImpact(this, hero.x, hero.y - 4, couleur);
    flashCible(hero, maintenant);
    declencher(hero.pose, hero, "touche", maintenant, { x: sourceX });
    // Subtil a dessein : 110 ms d'impulsion, une douzaine de pixels. Un
    // knockback qui se voit se met a lutter avec le deplacement du joueur.
    recul(hero, sourceX, sourceY, FORCE_RECUL, maintenant);

    if (hero.estIncarne) {
      this.flotter(hero.x, hero.y - 18, `-${degats}`, "#ff6b5a");
      secousse(this, "leger");
    }

    // Encaisser use, et parfois ca ouvre une plaie (DESIGN.md §4.23).
    monterStress(hero.personne, REGLAGES_STRESS.parCoupEncaisse);
    if (
      degats >= hero.pvMax * 0.12 &&
      this.rng.chance(0.15 * hero.personne.mods.contagion) &&
      contracterEtat(hero.personne, "hemorragie")
    ) {
      this.events.emit("annonce", `${hero.personne.nom} saigne — il lui reste une journee`);
      this.flotter(hero.x, hero.y - 34, "HEMORRAGIE", "#ff5a4a");
    }

    if (hero.pv <= 0) this.tomber(hero);
  }

  /** Le crachat du monstre a distance : le tir de `tirer`, dans l'autre sens. */
  private cracher(e: Ennemi, angle: number): void {
    const p = this.projectilesEnnemis.create(
      e.x,
      e.y,
      "projectile",
    ) as Phaser.Physics.Arcade.Image;
    p.setDepth(e.y + 1);
    p.setTint(e.archetype.couleurImpact);
    // Les degats voyagent avec le projectile : son auteur peut mourir avant
    // qu'il n'arrive, et le crachat doit quand meme faire son office.
    p.setData("degats", e.degats);
    // Plus lent que les traits des heros : un tir qu'on ne peut pas voir
    // arriver n'est pas un tir, c'est une taxe.
    p.setVelocity(Math.cos(angle) * VITESSE_CRACHAT, Math.sin(angle) * VITESSE_CRACHAT);
    eclatImpact(this, e.x, e.y, e.archetype.couleurImpact, 3);
    this.time.delayedCall(2200, () => p.destroy());
  }

  private impactCrachat(p: Phaser.Physics.Arcade.Image, hero: Hero): void {
    if (!p.active || this.termine || this.enPause) return;
    if (!hero.estAuCombat || hero.estInvisible) return;
    const degats = (p.getData("degats") as number | undefined) ?? 6;
    const { x, y } = p;
    p.destroy();
    eclatImpact(this, x, y, 0x7ee0a0);
    this.encaisser(hero, degats, x, y, 0x7ee0a0);
  }

  /**
   * Le kamikaze s'ouvre.
   *
   * Il meurt sans donner ni kill ni experience : c'est le prix de l'avoir
   * laisse arriver. Le tuer avant qu'il n'explose, lui, rapporte normalement —
   * d'ou le clignotement pendant tout son armement.
   */
  private exploser(e: Ennemi): void {
    const { x, y } = e;
    const couleur = e.archetype.couleurImpact;

    this.effetCercle(x, y, RAYON_KAMIKAZE, couleur);
    poufMort(this, x, y, couleur);
    secousse(this, "moyen");
    hitstop(this, 45);

    for (const hero of this.heros) {
      if (!hero.estAuCombat || hero.estInvisible) continue;
      if (Phaser.Math.Distance.Between(x, y, hero.x, hero.y) > RAYON_KAMIKAZE) continue;
      this.encaisser(hero, Math.round(e.degats * 1.6), x, y, couleur);
    }

    e.destroy();
  }

  /** La mort est definitive. Elle ne peut arriver qu'au heros incarne. */
  private tomber(hero: Hero): void {
    // Resurrection de l'Oracle : une fois, une seule, dans toute la partie.
    const oracle = this.heros.find((h) => h.bonus.resurrection && h.etat !== "mort");
    if (oracle && !this.resurrectionUtilisee) {
      this.resurrectionUtilisee = true;
      hero.soignerForce(hero.pvMax * 0.35);
      hero.rendreInvulnerable(2000);
      this.effetCercle(hero.x, hero.y, 120, 0xfff0c0);
      this.cameras.main.flash(400, 255, 240, 200);
      this.flotter(hero.x, hero.y - 34, "RESURRECTION", "#fff0c0");
      return;
    }

    hero.mourir();
    // Il s'affaisse au lieu de se contenter de grisonner. Sans danger pour le
    // jeu : `animerMort` commence par couper son corps physique, et un heros
    // mort ne se releve jamais (la Resurrection est traitee au-dessus).
    animerMort(hero);
    this.effetCercle(hero.x, hero.y, 90, 0xff3b30);
    poufMort(this, hero.x, hero.y, 0xff3b30);
    secousse(this, "fort");
    this.flotter(hero.x, hero.y - 30, `${hero.classe.nom} est tombe`, "#ff6b5a");
    this.events.emit("hero-tombe", hero);
    this.faireLeDeuil(hero);

    const suivant = this.heros.findIndex((h) => h.etat !== "mort");
    if (suivant === -1) {
      this.finDePartie();
      return;
    }
    this.indexIncarne = suivant;
    this.heros[suivant]!.estIncarne = true;
    this.cameras.main.startFollow(this.heros[suivant]!, true, 0.12, 0.12);
    this.events.emit("hero-incarne", this.heros[suivant]!);

    // ⚠️ **La regle ironman** (§4.28) : on enregistre la mort tout de suite.
    // Fermer l'onglet apres avoir perdu un heros ne le ramene pas — c'est ce
    // qui protege la mort definitive du §4.3, et ce n'est pas negociable.
    this.enregistrer();
  }

  /**
   * La mort d'un heros se paie chez tout le monde (DESIGN.md §4.23).
   *
   * Le village a la meme fonction, et c'est voulu : ce sont deux populations
   * qui partagent un systeme, pas deux systemes qui se ressemblent. Ce qui les
   * separe, c'est seulement qui est dans la liste.
   */
  private faireLeDeuil(mort: Hero): void {
    for (const temoin of this.heros) {
      if (temoin === mort || temoin.etat === "mort") continue;
      const distance = Phaser.Math.Distance.Between(temoin.x, temoin.y, mort.x, mort.y);
      if (distance > REGLAGES_STRESS.rayonDuDeuil) continue;
      voirMourir(temoin.personne);
      this.annoncerLesExploits(temoin);
    }
    this.village.temoinsDeLaMort(mort.x, mort.y);
  }

  /** Un trait gagne se dit : sinon le joueur ne saurait jamais qu'il l'a fait. */
  private annoncerLesExploits(hero: Hero): void {
    for (const cle of verifierExploits(hero.personne)) {
      this.events.emit("annonce", `${hero.personne.nom} devient ${cle}`);
    }
  }

  private finDePartie(): void {
    this.termine = true;
    // `update` ne tournera plus : on rend la main au monde ici, sinon un
    // micro-gel en cours resterait en place pour de bon.
    majEffets(this, this.time.now, false);
    this.physics.pause();
    this.effacerDestination();
    const resume = this.resume;
    this.events.emit("fin-de-partie", resume.secondes, resume.kills);

    // La partie est finie : l'emplacement se libere des deux cotes, et la
    // partie part au classement (§4.28).
    //
    // ⚠️ **La copie cloud aussi.** L'oublier laisserait, au prochain
    // chargement, la proposition de reprendre exactement la partie qu'on vient
    // de perdre — la regle ironman se contournerait en changeant de machine.
    effacerEnLocal(this.emplacement);
    void effacerCloud(this.emplacement);
    void enregistrerPartie({
      jours: this.cycle.jour,
      classe: (this.registry.get("classe") as ClassId) ?? "guerrier",
      dureeSecondes: (this.dureeJouee + (this.time.now - this.debut)) / 1000,
    });
  }

  // --------------------------------------------------------------- effets

  /**
   * Nombres flottants, recycles.
   *
   * Un objet Texte de Phaser fabrique sa propre texture : en creer plusieurs
   * dizaines par seconde suffit a faire tomber le jeu. On les reutilise, et on
   * cesse d'en afficher au-dela d'un certain nombre a l'ecran.
   */
  private flotter(x: number, y: number, texte: string, couleur: string): void {
    if (this.textesActifs >= MAX_TEXTES_FLOTTANTS) return;

    const t =
      this.textesLibres.pop() ??
      this.add
        .text(0, 0, "", { fontFamily: "monospace", fontSize: "11px", color: "#ffffff" })
        .setOrigin(0.5)
        .setDepth(5000);

    this.textesActifs += 1;
    t.setText(texte).setColor(couleur).setPosition(x, y).setAlpha(1).setVisible(true);

    this.tweens.add({
      targets: t,
      y: y - 22,
      alpha: 0,
      duration: 650,
      onComplete: () => {
        this.textesActifs -= 1;
        t.setVisible(false);
        this.textesLibres.push(t);
      },
    });
  }

  private effetCercle(x: number, y: number, rayon: number, couleur: number): void {
    const c = this.add
      .image(x, y, "impact")
      .setTint(couleur)
      .setAlpha(0.6)
      .setScale(0.4)
      .setDepth(y - 2);
    this.tweens.add({
      targets: c,
      scale: rayon / 8,
      alpha: 0,
      duration: 320,
      onComplete: () => c.destroy(),
    });
  }

  private aura(x: number, y: number, echelle: number, couleur: number, duree: number): void {
    const a = this.add
      .image(x, y, "impact")
      .setScale(echelle)
      .setAlpha(0.35)
      .setTint(couleur)
      .setDepth(y - 3);
    this.tweens.add({ targets: a, alpha: 0, duration: duree, onComplete: () => a.destroy() });
  }

  private trainee(x1: number, y1: number, x2: number, y2: number, couleur: number): void {
    const l = this.add
      .line(0, 0, x1, y1, x2, y2, couleur)
      .setOrigin(0)
      .setLineWidth(3)
      .setAlpha(0.75)
      .setDepth(y1 - 1);
    this.tweens.add({ targets: l, alpha: 0, duration: 320, onComplete: () => l.destroy() });
  }
}
