import Phaser from "phaser";
import { Noyade, REGLAGES_EAU, profondeurDe } from "../core/eau";
import { Chemins } from "../core/chemins";
import { CoucheDesChemins, RAYON_VOISINAGE } from "../game/dessin/chemins";
import { Rng } from "../core/rng";
import { CLASSES, ORDRE_CLASSES, type ClassId } from "../core/classes";
import {
  competenceParId,
  propositionCompetence,
  propositionEvolution,
  tirerCompetences,
  type CompetenceDef,
  type EvolutionDef,
  ID_EMPLACEMENT,
  demandeUnePlace,
  prixDuProchainEmplacement,
  propositionsDeRemplacement,
} from "../core/competences";
import { creerTexturesPlaceholder } from "../game/art";
import {
  ARBRES_MORTS,
  ARBRES_VIVANTS,
  CONIFERES,
  ROCHERS,
  decorParCle,
  CLE_CHARRETTE,
  CLE_CORDE_A_LINGE,
  CLE_FILETS,
  CLE_PUITS,
  CLE_TAS_DE_BOIS,
  CLE_TONNEAU,
} from "../game/dessin/decor";
import { origineDe, textureDe } from "../game/constructions";
import { Bruits, chargerLesBruits } from "../game/bruits";
import {
  abimerLeSol,
  CarteDuMonde,
  CLE_MASQUE_EAU,
  dessinerLeSolDuVillage,
  ECHELLE_DU_MASQUE,
} from "../game/dessin/morceaux";
import { decrireLeMonde, graineDeMonde } from "../core/monde";
import {
  QUESTION_DU_GARDIEN,
  REGLAGES_MARCHE,
  REPONSE_AU_REFUS,
  annonceDArrivee,
  annonceDeRoute,
  mondesMuetsApres,
  capVers,
  longueurDeLaMarche,
  ouLonParait,
  paroleDuGardien,
  risqueDAttaque,
  type VillageVuDeLoin,
} from "../core/marche";
import { REGLAGES_BUTIN, encaisser, orDUneBete } from "../core/butin";
import { Parcours } from "../core/parcours";
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
import { ARCHETYPE_HUMAIN, choisirArchetype } from "../game/ennemis";
import { POLICE } from "../game/ui/chrome";
import { Survivants, type SpriteSurvivant } from "../game/survivants";
import { Caches } from "../game/caches";
import {
  REGLAGES_CACHES,
  paroleDeLaStele,
  placeDeRoute,
  semerLesCaches,
  type Cache,
} from "../core/caches";
import {
  creerSurvivant,
  creerSurvivantDeRoute,
  ETAT_ANNONCE,
  ligneDApparition,
  prochainSurvivant,
  REGLAGES_SURVIVANTS,
  type Survivant,
} from "../core/survivants";
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
  tache as tacheDef,
  type Point,
  type Posture,
  type TacheId,
} from "../core/ordres";
import { lignesDuMenu, type ContenuMenu } from "../game/menuOrdres";
import {
  NIVEAU_EGLISE_RITUEL,
  NOMS_VOIE,
  PRIX_DU_RITUEL,
  entrainer,
  reveilParLeDanger,
  type VoieDuReveil,
} from "../core/dons";
import { Cour, EMPRISE_COUR, REGLAGES_COUR } from "../game/cour";
import { CLE_COUR } from "../game/dessin/batiments";
import { Affinites } from "../core/affinites";
import {
  chargerLaGraine,
  dansLeVillage,
  distanceALEau,
  EGLISE,
  estTerreFerme,
  frontsDeLaVague,
  frontsOuverts,
  GRAINE_CLASSIQUE,
  MONDE,
  mondeCourant,
  NOMS_FRONT,
  PORT,
  POSTES,
  PRATICABLE,
  pointDApparition,
  repartition,
  TAILLE_CLASSIQUE,
  terrainEn,
  VILLAGE,
  type Front,
  type Taille,
  type Terrain,
} from "../core/carte";
import { TAILLE_JOUABLE } from "../core/monde";
import { BatimentEglise } from "../game/eglise";
import {
  CONDITIONS,
  RELEVEMENT,
  coutEnArgent,
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
  villageAttire,
} from "../core/cycle";
import { Village, type Villageois } from "../game/village";
import { CASE, COLONNES, Grille, IMPOSENT_UNE_DISTANCE, LIGNES, type Case } from "../core/grille";
import { cleCase, genererVillage, graineDeVillage, placesOuSeTenir, type PlanVillage,
  tracerLesRues,
  type Segment,
} from "../core/village";
import { peuplerLeVillage, toitsPour, type Peuplement } from "../core/peuplement";
import {
  menacesDuMonde,
  phraseDuMonde,
  valeurDesCadeaux,
  type CeQueLeMondeOffre,
  type Menaces,
} from "../core/budget";
import {
  CASES_LIBRES_AUTOUR_DES_BATIMENTS,
  CONSTRUCTIONS,
  PONT_LEVIS,
  REMPLISSAGE,
  coutLisible,
  type TypeConstruction,
  amelioration,
  coutEnClair,
} from "../core/constructions";
import { Construction, Constructions, PORTEE_OCCUPATION } from "../game/constructions";
import { Champs, REGLAGES_CHAMPS, type Champ } from "../game/champs";
import { Maison, Maisons, REGLAGES_MAISONS } from "../game/maisons";
import { NOMS_METIER, NOMS_POSTURE_CIVILE, NOMS_RESSOURCE, RESSOURCES, SOUS_PRODUIT, combatDe, stocksVides } from "../core/habitants";
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
  prenomLibre,
  gagnerTrait,
} from "../core/personne";
import { PART_DE_COUPS_REFUSES, traitParId } from "../core/traits";
import type { Habitant, PostureCivile, Ressource, Stocks } from "../core/habitants";
import {
  accueillir as suivreSiFou,
  actesDeLaNuit,
  creerArrivant,
  delaiEntreArrivees,
  prochaineArrivee,
  REGLAGES_ARRIVEES,
  replanifier,
  reputation,
  victimeDe,
  type Acte,
  type Arrivant,
  type Fou,
} from "../core/arrivants";
import { calmePourUnNavire, unNavireVeutVenir } from "../core/port";
import { BatimentPort } from "../game/port";
import type { EtatPortAffiche } from "../game/panneauPort";
import type { Phase } from "../core/cycle";
import { Journal, type Voix } from "../core/journal";
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
import {
  CLES_CHAMP,
  cleMaison,
  cuireLesBatiments,
} from "../game/dessin/batiments";
import { CLE_MUR_RUINE, OCCUPANT_TOUR_Y, ORIGINE_MUR_Y } from "../game/dessin/murs";
import { poserLaMer, releverLeRivage, type MerAnimee } from "../game/dessin/mer";
import type { EtatEquipe } from "../game/hud";
import type { EtatOrdres } from "../game/panneauOrdres";
import type { GroupeAffiche } from "../game/fichePersonne";
import { MORCEAUX, Musique } from "../game/musique";

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

/**
 * Ce qu'une minute de travail coute a un heros, en points de stress
 * (DESIGN.md §4.4) — *chiffre tranche par le code, a corriger en jouant*.
 *
 * 2,2 par minute : une journee entiere de 10 minutes passee a un poste lui en
 * met 22, sur les 100 qui le font craquer et les 60 a partir desquels ca se
 * voit sur sa fiche. Trois journees de suite et il arrive a la nuit visiblement
 * use ; une seule ne se paie presque pas. C'est le prix que le §4.4 demande :
 * « le travail se paie en puissance », sans que ce soit une punition.
 *
 * A comparer : `REGLAGES_STRESS.travailSansRepos` vaut 0,1 pour un habitant.
 * Un heros abat quinze fois plus de travail ; il le paie quinze fois plus cher.
 */
const STRESS_DU_TRAVAIL = 2.2;

/**
 * Combien de heros peuvent etre dehors en meme temps (DESIGN.md §4.15).
 *
 * ⚠️ **La garnison n'existe pas encore.** Le §4.15 dit « dix dehors, le reste
 * en garnison » ; tant que la garnison n'est pas codee, un onzieme don ne
 * s'eveille pas, et le jeu le dit. Mieux vaut un don qui attend qu'un heros
 * qu'on ne peut ni voir ni commander.
 */
const EFFECTIF_MAXIMUM = 10;

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
 * Les seules touches qui restent vivantes sous la pause du mode d'amenagement.
 *
 * Ce sont celles qui choisissent **quoi poser** — palissade, tour, champ. Tout
 * le reste doit rester bloque : la cloche, les postures ou l'eglise n'ont aucun
 * sens pendant que le temps est arrete (§4.24).
 */
const CHOISIR_QUOI_POSER: number[] = [
  Phaser.Input.Keyboard.KeyCodes.G,
  Phaser.Input.Keyboard.KeyCodes.H,
  Phaser.Input.Keyboard.KeyCodes.J,
  Phaser.Input.Keyboard.KeyCodes.K,
  Phaser.Input.Keyboard.KeyCodes.L,
  Phaser.Input.Keyboard.KeyCodes.N,
];

/**
 * Ce qu'on peut poser sur la grille.
 *
 * Un champ n'est pas une construction — il ne bloque rien, il n'a pas de points
 * de vie, et on le traverse. Mais il se pose exactement de la meme facon, alors
 * il partage le meme mode et le meme apercu.
 */
type ModeBati = TypeConstruction | "champ" | "maison" | "cour";

/**
 * La part des monstres qui viennent piller (§4.24, 19 septembre 2026) : ils
 * visent la maison debout la plus proche au lieu de l'eglise. Le reste marche
 * sur l'eglise comme avant — c'est elle le cap, et la ligne a tenir (§4.22).
 */
const PART_DE_PILLARDS = 0.4;

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

/**
 * Le voile entre deux mondes, en millisemes (§4.29, l'errance continue).
 *
 * ⚠️ **220, pas 700.** Le fondu d'avant devait couvrir la cuisson de la carte,
 * deux a trois secondes ; il ne couvre plus qu'un remontage de scene de deux ou
 * trois dixiemes. Un voile de sept dixiemes de seconde a chaque bord de carte,
 * quand on en traverse sept d'affilee apres un troisieme refus, c'est dix
 * secondes d'ecran noir pour rien.
 */
const DUREE_DU_VOILE = 220;
const ZOOM_MAX = 3.4;

/**
 * De combien il faut s'eloigner de la ou l'on a paru avant que quitter la
 * carte veuille dire « je passe au large » (§4.29).
 *
 * Vingt cases : on parait a quarante pixels d'un bord, et il ne faut pas
 * qu'un pas de trop dans la mauvaise direction, la premiere seconde, envoie
 * au monde suivant.
 */
const DISTANCE_D_ARMEMENT = 640;

/**
 * La puissance d'un habitant qui se jette sur nous (§4.29).
 *
 * La meme echelle que celle d'une vague : a 2, il tient une vingtaine de points
 * de vie et frappe pour huit. Un heros de depart en a cent trente et en met
 * treize — donc **trois habitants sont un vrai combat et pas une execution**,
 * et une douzaine tuerait. C'est exactement le risque que le §4.29 veut faire
 * peser sur un refus en face.
 */
const PUISSANCE_DES_HABITANTS = 2;

/**
 * Tous les combien le champ de directions des humains peut se refaire, en ms.
 *
 * Une propagation balaye toute la grille : la relancer a chaque image pendant
 * qu'on court serait l'ajout non plafonne que le §4.17 interdit. Un tiers de
 * seconde suffit — a 108 px/s, on n'a pas parcouru une case et demie.
 */
const PERIODE_CHEMIN_DES_HUMAINS = 330;

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
  /**
   * Le mode commandement (DESIGN.md §4.4, bloc 8, tranche par Angelos le 21
   * septembre 2026).
   *
   * Tab le prend et le rend. Dedans, **le clic gauche ne deplace plus le
   * heros** : il selectionne, il trace un rectangle, il ouvre le menu d'ordres.
   * Tout le reste continue de tourner — le §4.4 interdit qu'un ordre arrete le
   * combat.
   *
   * ⚠️ Un mode qu'on oublie est un mode qui pieger : il se voit donc sur toute
   * la largeur de l'ecran (`PanneauOrdres`), et la moindre autre action le
   * rend.
   */
  private modeCommandement = false;
  /** Coin de depart du rectangle de selection, en coordonnees du monde */
  private rectangleDepart: Phaser.Math.Vector2 | null = null;
  private rectangleCourant: Phaser.Math.Vector2 | null = null;
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

  /**
   * Tout ce que le jeu a a dire (DESIGN.md §4.10, bloc 6c1).
   *
   * ⚠️ **Il appartient a l'arene, pas a l'interface**, et ce n'est pas un detail
   * de rangement. `scene.launch("ui")` est differe d'une image par Phaser :
   * quand cette scene-ci annonce « Jour 1 » a la fin de son `create`, `UiScene`
   * n'a pas encore branche le moindre ecouteur. Trouve en jouant — le journal
   * demarrait vide. Un journal porte par l'interface perd donc, par
   * construction, tout ce qui est dit avant qu'elle existe.
   *
   * `UiScene` le lit comme elle lit `etatVillage` ou `etatPort` : elle dessine,
   * elle ne detient rien.
   */
  readonly journal = new Journal();

  /**
   * La porte (DESIGN.md §4.18, bloc 6a).
   *
   * ⚠️ **`fous` est la seule chose du jeu que le joueur ne doit jamais voir.**
   * Elle ne passe ni par l'habitant, ni par sa fiche, ni par le tableau du
   * village : au matin il y a un mort ou une breche, et rien ne dit qui.
   */
  private readonly fous: Fou[] = [];

  /**
   * L'argent du village (DESIGN.md §4.8, §4.18).
   *
   * ⚠️ **Il ne vit pas dans `Stocks`**, et c'est voulu : le §4.8 range l'argent
   * avec l'XP et les materiaux, pas avec les quatre ressources recoltees. Le
   * mettre dans la meme table aurait permis a un fermier de « produire » de
   * l'argent au premier ajout distrait, et aurait ouvert la porte a une
   * conversion que le §4.8 interdit.
   */
  argent = 0;
  /** Vrai quand une voile veut paraitre aujourd'hui, tire a l'aube (§4.18) */
  private navireAttendu = false;
  /** La journee ou quelqu'un se presentera, ou null quand plus personne ne vient */
  private prochaineArriveeJournee: number | null = null;

  /**
   * Les survivants (DESIGN.md §4.18) : la seule raison de sortir du village.
   *
   * Au plus un a la fois, et il ne parait que le jour.
   */
  private survivants!: Survivants;
  /**
   * Les caches de la route (§4.31, jalon 5.6).
   *
   * ⚠️ **Elles n'existent que pendant l'errance.** Une partie installee n'en a
   * aucune : la restauration du village (jalon 8) est le systeme qui
   * recompense l'exploration une fois qu'on a un village, et deux systemes
   * pour la meme chose seraient un de trop.
   */
  private caches!: Caches;
  /**
   * Ce que la route a rendu en matiere, et qui deviendra les reserves du jour
   * ou l'on s'installe (§4.31).
   *
   * ⚠️ **Ce ne sont pas encore des stocks.** On n'a pas de village : ce qu'on
   * porte sur le dos ne se compte ni dans le grenier ni dans la faim de
   * personne. Ca s'y verse a l'installation, et une seule fois.
   */
  private butinDeLaRoute: Stocks = stocksVides();
  /** Les camps de betes deja leves : on ne les lache qu'une fois */
  private campsLeves = new Set<number>();
  /** La stele dont le panneau est ouvert, s'il y en a une (§4.31) */
  private steleOuverte: Cache | null = null;
  /**
   * Ceux qui nous suivent, entre deux mondes (§4.31).
   *
   * Ce sont leurs **regles**, pas leurs sprites : un sprite appartient a la
   * scene qu'on quitte. Ce champ est plein le temps d'un `init`, puis vide des
   * qu'ils ont repris corps.
   */
  private compagnonsDeRoute: Survivant[] = [];
  private prochainSurvivantJournee = 1;
  /** Celui qu'on presente a l'eglise, tant que la fiche est ouverte */
  private survivantALEglise: SpriteSurvivant | null = null;
  /** Celui qui attend pendant que le jeu est en pause */
  private arrivantALaPorte: Arrivant | null = null;
  /**
   * La cloche a sonne, et les portes attendent que plus personne ne soit
   * dehors pour se fermer (§4.20, bloc 7b). Remis a faux a l'aube.
   */
  private clocheSonnee = false;
  /** Les habitants, leurs postes et les stocks (DESIGN.md §4.18) */
  village!: Village;
  /** La cour d'entrainement : le batiment neuf du bloc 9 (§4.18) */
  cour!: Cour;
  /**
   * L'eglise : refuge, seul lieu de soin, et cap des monstres (DESIGN.md §4.22).
   *
   * Elle remplace le cercle `CITE` dans ces trois roles. `CITE` ne decrit plus
   * que l'etendue du bati — et c'est encore lui qui sert d'ancre par defaut aux
   * ordres, ce qui est correct : une ancre est un point de rassemblement, pas
   * un refuge.
   */
  eglise!: BatimentEglise;
  /**
   * Le port (§4.18). Volontairement sans corps ni points de vie : la ou l'eglise
   * est un objectif qu'on defend, le port est un acquis que rien n'atteint.
   */
  port!: BatimentPort;
  /** Ce qu'il reste a faire arriver de l'effectif de la nuit en cours */
  private resteDeLaNuit = 0;
  /** Instant de la prochaine horde de jour, et de celle qu'on vient d'annoncer */
  private prochaineHorde = 0;
  private hordeAuDepart = 0;
  /** Le village attire-t-il les monstres (§4.18) ? Garde, pour ne le dire qu'au changement. */
  private villageAttire = false;
  private tailleHordeEnRoute = 0;
  /** Le voile de nuit : une seule image noire, dont on module l'opacite */
  private voile!: Phaser.GameObjects.Rectangle;
  /** Recolte manuelle accumulee, pour n'afficher un nombre que de loin en loin */
  private cumulRecolte = 0;
  private prochainGesteRecolte = 0;
  /** Le geste d'un heros au travail, espace comme celui de la recolte a la main */
  private prochainGesteTravail = 0;
  /** La journee ou l on a deja dit qu il manquait un charpentier */
  private batisseurAnnonce = -1;

  /** La carte en grille modifiable : c'est elle qu'on batit (DESIGN.md §4.21) */
  grille = new Grille();
  /**
   * La carte peinte de ce monde, **par morceaux** (§4.29, `morceaux.ts`).
   *
   * Elle cuit toute seule, image par image, au plus pres du heros. Tout ce qui
   * marque le sol — la place du village, une terre brulee, un cratere — passe
   * par elle et attend son morceau si celui-ci n'est pas encore peint.
   */
  private carte: CarteDuMonde | null = null;
  /** La graine du village de cette partie : elle traverse la sauvegarde (§4.24) */
  private graineVillage = 0;
  /** La graine du monde (§4.29) : la mer, le relief, l'endroit ou l'on tombe */
  private graineMonde = 0;
  /**
   * La zone jouable de cette partie (§4.29, point 3).
   *
   * **Deux fois la carte classique** (`TAILLE_JOUABLE`, mesuree le 20 septembre
   * 2026 : la peinture de la carte est le plafond, 1 s a x2 et 1,5 s a x3).
   * Elle voyage dans la sauvegarde : la meme graine sur une autre zone rend un
   * **autre monde**, donc une partie reprise qui ne collerait plus a sa carte.
   */
  private zone: Taille = TAILLE_CLASSIQUE;
  /** Le parcours des monstres vers l'eglise, autour de l'eau et de la roche */
  private parcours!: Parcours;
  /** Les corps du terrain : l'eau profonde, que seul le heros incarne traverse, et la roche */
  private obstaclesDEau!: Phaser.Physics.Arcade.StaticGroup;
  private obstaclesDeRoche!: Phaser.Physics.Arcade.StaticGroup;
  /** Le village tire de la graine : l'enceinte, les maisons, la place (§4.24) */
  private planVillage!: PlanVillage;
  /**
   * Qui vit la, et ce qu'il leur reste (§4.29).
   *
   * ⚠️ **Calcule avant le plan**, parce que c'est la population qui dit
   * combien de maisons tiennent encore debout : un village de seize ne se
   * dessine pas comme un village de trois.
   */
  private peuplement!: Peuplement;
  /**
   * Ce que ce monde reclame en echange de ce qu'il offre (§4.29, `budget.ts`).
   *
   * Pose une fois, au chargement, et jamais recalcule : le budget est une
   * propriete **du monde**, pas de la partie. Un village qui perd la moitie de
   * ses gens la premiere nuit ne voit pas ses nuits s'adoucir pour autant.
   */
  private menaces: Menaces = { effectifEnPlus: 0, nuitsDAvance: 0, malades: 0 };
  /** La phrase qu'on annonce avant d'entrer, en une ligne (§4.29) */
  private augureDuMonde = "";
  /** Les rues du village, tracees avec le plan : le sol les peint, le decor s'en ecarte. */
  private ruesDuVillage: Segment[] = [];
  /** L'eau qui noie (§4.30) : l'horloge du heros incarne sous la surface. */
  private noyade = new Noyade();
  /** Les chemins qui s'usent (§4.24) : les passages par case, et la couche qui les peint. */
  private chemins = new Chemins();
  private coucheChemins!: CoucheDesChemins;
  /** Les pas se comptent par battements, jamais par image (§4.17 regle 5). */
  private prochainBattementChemins = 0;
  private static readonly PERIODE_CHEMINS = 250;
  /** La derniere position du heros incarne hors de l'abysse : on l'y ramene s'il y tombe. */
  private dernierePositionTenable = { x: 0, y: 0 };
  /** Les murs et les tours (DESIGN.md §4.20) */
  constructions!: Constructions;
  /** Les champs de ble : ils poussent, et une horde les ruine (§4.18) */
  champs!: Champs;
  /** Ce qu'on s'apprete a poser ; null quand le mode construction est ferme */
  private enConstruction: ModeBati | null = null;
  /** L'apercu fantome, cree une fois et deplace : jamais recree (§4.17) */
  private fantome!: Phaser.GameObjects.Image;
  /** La houle et l'ecume, posees sur la carte cuite (§4.30) */
  private mer!: MerAnimee;
  /** La tour dans laquelle se tient le heros incarne, s'il y en a une */
  private tourDuHero: Construction | null = null;

  /**
   * Le mode d'amenagement (DESIGN.md §4.24) : la touche `M`.
   *
   * ⚠️ **Il met le jeu en pause, et c'est assume alors que le §4.4 est fier de
   * ne jamais l'interrompre.** Ce n'est pas la meme chose : un ordre tactique se
   * donne dans le feu, amenager veut dire regarder, comparer, essayer. Poser
   * vingt batiments a la souris en courant devant une horde ne serait pas tendu,
   * ce serait penible.
   */
  private amenagement = false;
  /** La grille du mode d'amenagement, dessinee **une seule fois** (§4.17) */
  private calqueGrille?: Phaser.GameObjects.Graphics;
  /** Ce qu'on a pris en main pour le reposer ailleurs ; null la plupart du temps */
  private deplacee: Construction | Maison | null = null;
  /** Les maisons du village : debout ou en ruine, batissables, demolissables (§4.24) */
  maisons!: Maisons;
  /** Le survol (§4.24) : un seul objet Texte, cree une fois, deplace a la demande */
  private survol!: Phaser.GameObjects.Text;
  /** Le temps ou le mode d'amenagement s'est ouvert, pour rendre la pause */
  private debutAmenagement = 0;

  private enPause = false;
  /** La musique de la partie : le calme le jour, la guerre la nuit et des qu'un heros se bat (§4.10). */
  private musique!: Musique;
  /**
   * Les bruits de la partie, sur les frames cles des animations (§4.10, phase 2).
   * Visible : les scripts de verification lisent ses `demandes`, et ce qui ne
   * passe pas par une animation (une porte, un chantier) l'appellera directement.
   */
  bruits!: Bruits;
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
  private modeChoix: "competence" | "evolution" | "remplacement" = "competence";
  /** La competence qui attend une place, le temps de l'ecran « laquelle oublier ? » (§4.13). */
  private competenceEnAttente: CompetenceDef | null = null;
  private competenceEnEvolution: CompetenceDef | null = null;
  private optionsEvolution: EvolutionDef[] = [];

  // ------------------------------------------------------------- la marche

  /**
   * La marche (DESIGN.md §4.29) : tant qu'elle dure, **le village n'est pas le
   * notre**.
   *
   * Rien de ce qui appartient au Protecteur ne tourne : pas de horde, pas de
   * nuit, pas d'arrivant a la porte, pas de navire, pas d'amenagement, pas de
   * sauvegarde. Le village, lui, vit sa vie — c'est ce qu'on vient regarder de
   * loin avant de repondre (§4.29 : « on voit ce qui se voit de loin »).
   */
  private enMarche = false;
  /** Le point ou l'on a paru : la sortie ne s'arme qu'une fois qu'on s'en est eloigne */
  private departDeLaMarche: Point = { x: 0, y: 0 };
  /** Vrai des qu'on a quitte le bord par lequel on est arrive : on peut alors passer au large */
  private sortieArmee = false;
  /** Combien de villages on a deja laisses derriere soi (§4.29 : refuser coute) */
  private marches = 0;
  /** Combien de villages on a refuses : c'est ce qui eloigne le suivant (§4.29) */
  private refus = 0;
  /** Combien de mondes sans personne il reste a traverser avant le prochain village */
  private mondesMuets = 0;
  /**
   * Vrai quand ce monde-ci est un **monde muet** : son village est une ruine
   * que personne n'habite, et personne n'en sortira pour nous parler.
   *
   * C'est la reponse du 20 septembre 2026 a une contrainte de geometrie : le
   * §4.29 veut que « le village suivant soit deux fois plus loin » a chaque
   * refus, et une carte finie ne peut pas s'allonger. Ce qu'on double, c'est le
   * **nombre de mondes a traverser** — et ceux du milieu sont vides.
   */
  private villageMuet = false;
  /** Celui qui sort nous parler ; `null` tant que personne n'est venu */
  private gardien: Villageois | null = null;
  /**
   * Le chemin des humains jusqu'a nous : un champ de directions a eux.
   *
   * Il sert a **celui qui vient parler** comme a **ceux qui se jettent sur
   * nous** : les uns et les autres sortent par la porte, la ou un monstre
   * frapperait le mur (voir `passeUnVillageois`).
   */
  private cheminDesHumains: Parcours | null = null;
  /** Le point vers lequel ce champ pointe : on ne le refait que si l'on s'en eloigne */
  private cibleDesHumains: Point = { x: 0, y: 0 };
  /** Jamais plus souvent que ca : une propagation balaye toute la grille (§4.17) */
  private prochainCheminDesHumains = 0;
  /**
   * Combien d'humains nous courent apres.
   *
   * ⚠️ Il ne sert qu'a **ne rien calculer quand il n'y en a pas** : sans lui, le
   * champ des humains continuerait de se refaire trois fois par seconde pendant
   * toute une partie installee, pour personne (§4.17 regle 5).
   */
  private humainsEnFace = 0;
  /** Vrai quand il a dit ce qu'il avait a dire : on ne le rappelle pas deux fois */
  private rencontreFaite = false;
  /** Vrai pendant le fondu qui nous emmene au monde suivant : plus rien ne doit se declencher */
  private quitteLeMonde = false;
  /**
   * La monnaie qu'on n'a pas encore touchee (§4.29, §4.8).
   *
   * Une bete vaut moins d'une piece : on garde le reste d'une mort a l'autre
   * plutot que d'arrondir chaque cadavre (`core/butin.ts`).
   */
  private resteDeButin = 0;
  /**
   * Le Misericordieux a-t-il deja annonce qu'il refusait de frapper ?
   *
   * ⚠️ **Il doit le dire, et une seule fois** : le §4.23 en fait le premier
   * trait qui desobeit, et le §4.12 exige qu'une desobeissance s'annonce — un
   * heros qui s'arrete sans prevenir serait vecu comme un bug. Une fois par
   * partie suffit : repete a chaque coup, ce serait le journal qui deborde.
   */
  private refusDeFrapperAnnonce = false;
  /** Le dezoom d'entree (§4.10) : le seul mouvement de camera automatique du jeu */
  private entreeCamera: Phaser.Tweens.Tween | null = null;

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

  init(data: {
    classe?: ClassId;
    emplacement?: Emplacement;
    reprise?: Sauvegarde;
    /** Pour rejouer un village precis (les captures) ; sinon, tiree au sort */
    graineVillage?: number;
    /** Pour rejouer un monde precis (les captures) ; sinon, tire au sort — zero est le classique */
    graineMonde?: number;
    /** Combien de villages on a deja passes (§4.29) : on n'arrive pas neuf au troisieme */
    marches?: number;
    /** Combien de villages on a **refuses** (§4.29) : c'est ce qui eloigne le suivant */
    refus?: number;
    /** Combien de mondes muets il reste a traverser avant de retrouver quelqu'un */
    mondesMuets?: number;
    /** Pour les captures et les tests : commencer installe, sans la marche */
    sansLaMarche?: boolean;
    /** La bourse qu'on emporte d'un monde a l'autre (§4.29, §4.31) */
    argent?: number;
    /** La matiere ramassee sur la route, qui deviendra les reserves (§4.31) */
    butinDeLaRoute?: Stocks;
    /** Ceux qui nous suivent d'un monde a l'autre (§4.31) */
    compagnons?: Survivant[];
  }): void {
    this.registry.set("classe", data.classe ?? "guerrier");
    this.emplacement = data.emplacement ?? 1;
    this.reprise = data.reprise ?? null;
    this.marches = data.marches ?? 0;
    this.refus = data.refus ?? 0;
    this.mondesMuets = data.mondesMuets ?? 0;
    // ⚠️ **Une partie neuve repart a zero, et il faut l'ecrire.** Phaser
    // reutilise l'instance de scene : sans ces deux lignes, la bourse et le sac
    // d'une partie perdue se retrouveraient dans la suivante.
    this.argent = data.argent ?? (data.reprise ? this.argent : 0);
    this.butinDeLaRoute = data.butinDeLaRoute ? { ...data.butinDeLaRoute } : stocksVides();
    this.campsLeves = new Set<number>();
    this.steleOuverte = null;
    this.compagnonsDeRoute = data.compagnons ?? [];
    // ⚠️ **Un monde muet n'a personne a qui parler** (§4.29, l'errance
    // continue). Son village est une ruine vide qu'on traverse : c'est ainsi
    // qu'un refus « eloigne le village suivant » sur une carte qui, elle, est
    // finie. Une partie reprise ou une capture n'en connait pas.
    this.villageMuet = !this.reprise && !data.sansLaMarche && this.mondesMuets > 0;
    // On marche vers le village a chaque partie neuve (§4.29). Une partie
    // reprise commence installee : elle a deja repondu, il y a des jours de
    // cela. Et les captures peuvent s'en passer — elles veulent le village,
    // pas la route qui y mene.
    this.enMarche = !this.reprise && !data.sansLaMarche;
    this.gardien = null;
    this.cheminDesHumains = null;
    this.humainsEnFace = 0;
    this.resteDeButin = 0;
    this.refusDeFrapperAnnonce = false;
    this.rencontreFaite = false;
    this.sortieArmee = false;
    this.quitteLeMonde = false;
    // Une partie neuve tire son village ; une partie reprise garde le sien.
    // Une sauvegarde d'avant le generateur (18 septembre 2026) n'a pas de
    // graine : elle prend zero, toujours la meme, plutot qu'un village qui
    // changerait a chaque rechargement.
    this.graineVillage = data.graineVillage ?? (data.reprise ? (data.reprise.graineVillage ?? 0) : graineDeVillage());
    // Le monde de la partie (§4.29) : une partie neuve en tire un — la mer, le
    // relief, les lacs, l'endroit ou l'on tombe ; une partie reprise garde le
    // sien. Une sauvegarde d'avant le 20 septembre 2026 n'a pas de graine de
    // monde : elle prend le monde classique, la carte d'avant. **Avant la
    // grille** : c'est le monde qui dit ou est la terre.
    this.graineMonde =
      data.graineMonde ?? (data.reprise ? (data.reprise.graineMonde ?? GRAINE_CLASSIQUE) : graineDeMonde());
    // La zone jouable (§4.29, point 3) : **deux fois la carte classique**. Une
    // partie reprise garde la sienne — une sauvegarde d'avant le 20 septembre
    // 2026 a ete jouee sur la taille classique, et la meme graine sur une autre
    // zone rendrait un autre monde.
    this.zone = this.reprise ? (this.reprise.zone ?? TAILLE_CLASSIQUE) : TAILLE_JOUABLE;
    chargerLaGraine(this.graineMonde, this.zone);
    // La grille repart de zero : la scene est reutilisee d'une partie a
    // l'autre, et le plan lit le terrain libre — une grille qui garderait les
    // murs de la partie d'avant donnerait un autre village pour la meme graine.
    this.grille = new Grille();
    this.parcours = new Parcours(this.grille);
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
    // Le premier front du monde : le plus loin du village (§4.29).
    this.fronts = [frontsOuverts()[0] ?? "nord"];
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
   * ⚠️ **Les quatre conditions mordent enfin toutes les quatre.** Le bloc 5
   * avait rempli la satisfaction ; le bloc 6b remplit l'argent, et il ne reste
   * plus un seul champ optionnel. La boucle du §4.22 est refermee de bout en
   * bout : on produit, on vend au port, on monte l'eglise.
   */
  private get contexteMontee(): ContexteMontee {
    return {
      stocks: this.village.stocks,
      population: this.village.population,
      satisfaction: this.village.satisfaction,
      argent: this.argent,
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
          nom: autre.personne.nom,
          force: this.affinites.affinite(hero.identifiant, autre.identifiant),
        })),
    };
  }

  /** Ce que l'interface doit savoir des ordres en cours (DESIGN.md §4.4). */
  get etatOrdres(): EtatOrdres {
    const vises = this.commandement?.destinataires(this.hero ?? null) ?? [];
    const postures = new Set(vises.map((h) => h.ordre.posture));
    const civils = this.commandement?.civilsSelectionnes.length ?? 0;
    return {
      formation: this.commandement?.formation ?? "libre",
      // Une seule posture affichee quand toute la selection est d'accord :
      // annoncer « Agressif » alors que la moitie temporise serait un mensonge.
      posture: postures.size === 1 ? [...postures][0]! : null,
      nombreVises: vises.length,
      nombreCivils: civils,
      mode: this.modeCommandement,
      selectionExplicite: !(this.commandement?.selectionVide ?? true),
      message:
        this.time.now - (this.commandement?.dernierMessageA ?? 0) < 1600
          ? this.commandement.dernierMessage
          : "",
    };
  }

  // ----------------------------------------------------------- construction

  /**
   * Les deux musiques, si l'ecran-titre n'a pas eu le temps de les charger
   * pendant le film (§4.10). Une cle deja en cache ne se recharge pas.
   */
  preload(): void {
    for (const { cle, urls } of Object.values(MORCEAUX)) {
      if (!this.cache.audio.exists(cle)) this.load.audio(cle, [...urls]);
    }
    // Les bruits de la partie (§4.10, phase 2) : ceux qui sont livres, et eux seuls.
    chargerLesBruits(this);
  }

  create(): void {
    const graine = Date.now() % 1_000_000;
    this.rng = new Rng(graine);
    console.log(`[arene] graine = ${graine}`);

    // En tout premier : la scene est reutilisee telle quelle a chaque `R`, et
    // tout ce qui est annonce plus bas dans ce `create` doit deja avoir ou
    // s'ecrire. Les cent-vingt emetteurs d'« annonce » n'ont pas bouge — seul
    // ce qu'on en fait a change (§4.10).
    this.journal.vider();
    this.events.on("annonce", this.consignerAuJournal, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.events.off("annonce", this.consignerAuJournal, this);
    });
    // La musique de la partie : elle demarre a la premiere image, et s'eteint
    // avec la scene — une voix Web Audio ne s'arrete pas toute seule quand on
    // change d'ecran.
    this.musique = new Musique(this);
    // Les bruits ecoutent tout sprite anime qui entre dans la scene : a creer
    // avant le premier habitant, le premier heros, le premier monstre.
    this.bruits = new Bruits(this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.musique.eteindre(0.3));

    creerTexturesPlaceholder(this);
    // Les visages de la partie precedente n'ont plus personne derriere eux :
    // les garder ferait grossir l'atlas a chaque `R` (§4.17).
    oublierLesPortraits(this);
    // Les emetteurs de particules sont crees une fois pour toute la partie :
    // il y a jusqu'a MAX_ENNEMIS combattants, on n'en fabrique pas un par coup.
    preparerEffets(this);
    // Le village de cette partie, tire de sa graine avant tout le reste : le
    // decor doit savoir ou est la place pour n'y rien planter (§4.24).
    this.peuplement = peuplerLeVillage(this.graineVillage, !this.villageMuet);
    this.planVillage = genererVillage(
      this.grille,
      this.graineVillage,
      EGLISE,
      undefined,
      undefined,
      // Un toit, un foyer : trois ou quatre personnes y vivent (§4.29).
      toitsPour(this.peuplement.population),
    );
    // Le budget (§4.29) : on mesure ce que ce monde-la donne, et l'ecart au
    // monde de reference devient la menace. ⚠️ Il **paie un monde deja tire**,
    // il ne le dicte pas : rien de ce qui precede n'a bouge.
    const offre = this.ceQueLeMondeOffre;
    const valeur = valeurDesCadeaux(offre);
    this.menaces = menacesDuMonde(valeur);
    this.augureDuMonde = phraseDuMonde(offre, this.menaces);
    console.log(
      `[arene] village = ${this.graineVillage} · ${this.peuplement.population} habitants · monde = ${decrireLeMonde(mondeCourant())}`,
    );
    console.log(
      `[budget] ${valeur.toFixed(0)} points · effectif ${(this.menaces.effectifEnPlus * 100).toFixed(0)} % · ${this.menaces.nuitsDAvance} nuit(s) d'avance · ${this.menaces.malades} malade(s) · « ${this.augureDuMonde} »`,
    );
    // La carte de ce monde. ⚠️ **Elle ne se peint plus d'un bloc** (§4.29,
    // 20 septembre 2026, dans la nuit) : la vignette est la tout de suite, les morceaux
    // cuisent image par image, au plus pres du heros d'abord.
    this.carte?.detruire();
    this.carte = new CarteDuMonde(this);
    // ⚠️ Soixante-trois textures de carte ne doivent pas survivre a leur scene :
    // elles sont globales au jeu, et un retour au menu les laisserait en
    // memoire jusqu'a la fermeture de l'onglet.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.carte?.detruire();
      this.carte = null;
    });
    // Le sol du village (§4.24) : la place en terre battue, les rues vers les
    // portes et les lieux de travail, le parvis pave. C'est une **ecriture
    // differee** : elle se pose quand les morceaux du village cuisent — pendant
    // la marche, on parait a l'autre bout du monde et ce village n'est encore
    // qu'une fumee a l'horizon.
    this.ruesDuVillage = tracerLesRues(this.planVillage, EGLISE, [
      ...POSTES.map((p) => p.position),
      { x: PORT.x, y: PORT.y },
    ]);
    dessinerLeSolDuVillage(this.carte, this.planVillage, this.ruesDuVillage);
    this.construireDecor();
    // Les chemins qui s'usent (§4.24) : une couche transparente juste au-dessus
    // de la carte, et un compte de passages par case. La place ne se marque
    // pas, elle est deja en terre battue.
    this.chemins = new Chemins();
    this.chemins.exclure(this.planVillage.place);
    this.coucheChemins = new CoucheDesChemins(this, -999);
    this.prochainBattementChemins = 0;

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

    // Le monde physique s'arrete au bord de la carte. La mer, les lacs et la
    // roche ne sont pas du decor non plus (DESIGN.md §4.6) — mais depuis qu'ils
    // peuvent etre n'importe ou (§4.29), c'est le **terrain** qui arrete les
    // corps, case par case (`dresserLeTerrain`), pas un rectangle.
    this.physics.world.setBounds(
      PRATICABLE.x,
      PRATICABLE.y,
      PRATICABLE.largeur,
      PRATICABLE.hauteur,
    );
    this.dresserLeTerrain();
    this.cameras.main.setBounds(0, 0, MONDE.largeur, MONDE.hauteur);
    this.cameras.main.setZoom(ZOOM_DEFAUT);
    this.cameras.main.startFollow(this.hero, true, 0.12, 0.12);
    // La poursuite est lissee : sans ce cadrage, la premiere seconde de jeu se
    // passe a rattraper le heros depuis l'angle de la carte (vu en capture).
    this.cameras.main.centerOn(this.hero.x, this.hero.y);
    // ⚠️ **Ce qu'on voit a la premiere image se peint tout de suite**, et rien
    // de plus. C'est le seul gel qui reste, et il est borne : quatre morceaux
    // autour du heros, une centaine de millisemes. Tout le reste de la carte
    // cuit image par image pendant qu'on marche (`avancer`).
    this.carte?.regarder(this.hero.x, this.hero.y);
    const vue = this.cameras.main.worldView;
    this.carte?.cuireTout(vue.x - 64, vue.y - 64, vue.right + 64, vue.bottom + 64);
    this.ouvrirLaMerAuHero(this.hero);
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
    this.demelerLesPrenoms();

    this.scene.launch("ui", { arene: this });
    this.events.on("choix-fait", this.resoudreChoix, this);
    this.events.on("changer-hero", this.changerHero, this);
    this.events.on("selectionner", this.selectionnerDepuisUi, this);
    this.events.on("posture-habitant", this.tournerPostureCivile, this);
    this.events.on("poste-habitant", this.tournerPosteCivil, this);
    // Une ligne du menu d'ordres vient d'etre cliquee (§4.4, bloc 8).
    this.events.on("tache", this.appliquerTache, this);
    this.events.on("saisie-clavier", (enCours: boolean) => (this.saisieEnCours = enCours), this);
    this.events.on("porte", this.repondreALaPorte, this);
    this.events.on("rencontre-reponse", this.repondreALaRencontre, this);
    this.events.on("vendre", this.vendreAuNavire, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.events.off("choix-fait", this.resoudreChoix, this);
      this.events.off("changer-hero", this.changerHero, this);
      this.events.off("selectionner", this.selectionnerDepuisUi, this);
      this.events.off("posture-habitant", this.tournerPostureCivile, this);
      this.events.off("poste-habitant", this.tournerPosteCivil, this);
      this.events.off("porte", this.repondreALaPorte, this);
      this.events.off("rencontre-reponse", this.repondreALaRencontre, this);
      this.events.off("vendre", this.vendreAuNavire, this);
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
    } else if (this.enMarche) {
      this.commencerLaMarche();
    } else {
      this.sInstaller(false);
    }

    this.surveillerLaFermeture();
  }

  /** Le monde vivant, tel que la sauvegarde le voit (§4.28). */
  private get partieEnCours(): PartieEnCours {
    return {
      scene: this,
      equipe: this.equipe,
      rng: this.rng,
      zone: this.zone,
      cycle: this.cycle,
      village: this.village,
      cour: this.cour,
      eglise: this.eglise,
      constructions: this.constructions,
      champs: this.champs,
      fous: this.fous,
      prochaineArrivee: this.prochaineArriveeJournee,
      port: this.port,
      argent: this.argent,
      heros: this.heros,
      indexIncarne: this.indexIncarne,
      kills: this.kills,
      dureeJouee: this.dureeJouee + (this.time.now - this.debut),
      partie: this.identitePartie,
      revision: this.revision,
      graineVillage: this.graineVillage,
      graineMonde: this.graineMonde,
      maisons: this.maisons,
      chemins: this.chemins,
    };
  }

  private reprendreLaPartie(sauvegarde: Sauvegarde): void {
    const monde = this.partieEnCours;
    this.indexIncarne = appliquer(sauvegarde, monde, this.time.now);
    // Les chemins reviennent tels qu'on les a laisses : une partie d'avant
    // n'en a pas, et repart de l'herbe.
    if (sauvegarde.chemins) {
      this.chemins.reprendre(sauvegarde.chemins);
      this.coucheChemins.toutRedessiner(this.chemins.visibles, sauvegarde.cycle.jour);
    }
    // `appliquer` remplace le tirage et l'equipe : la scene reprend ce que le
    // pont a repose.
    this.rng = monde.rng;
    this.kills = monde.kills;
    // `fous` et le port sont modifies sur place ; ces deux-la sont des nombres,
    // il faut les relire.
    this.prochaineArriveeJournee = monde.prochaineArrivee;
    // ⚠️ **Le survivant n'est pas enregistre, et son echeance non plus.** Comme
    // le navire du bloc 6b, c'est un **instant**, pas un etat : quelqu'un qui
    // appelle au bord de la carte n'a pas de raison d'etre encore la apres un
    // rechargement. On replanifie donc depuis la reputation du moment — ce qui
    // rend un delai neuf, jamais une apparition immediate, sinon recharger
    // offrirait un survivant a chaque fois (§4.28, regle ironman).
    this.planifierLeProchainSurvivant();
    this.argent = monde.argent;
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
      this.resteDeLaNuit = this.effectifDeLaNuitIci(this.cycle.nuit);
      this.village.tomberLaNuit();
      this.fronts = frontsDeLaVague(this.cycle.nuit, this.rng.next());
      this.partPremierFront = repartition(this.fronts, this.rng.next());
    }

    const moment = this.cycle.phase === "nuit" ? "Nuit" : "Jour";
    this.events.emit("annonce", `${moment} ${this.cycle.jour} — la partie reprend`, "village");
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
    // Tant qu'on marche, il n'y a pas de partie a sauver : on n'a pas encore
    // de village (§4.29). Enregistrer ici ecraserait l'emplacement avec un
    // village qui n'est pas le notre, et qu'on va peut-etre refuser.
    if (this.enMarche) return;

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
      annoncer: (message) => this.events.emit("annonce", message, "eglise"),
      effondrement: (x, y) => {
        poufMort(this, x, y, 0x8a7f6d);
        secousse(this, "fort");
        // Le sol garde la trace : l'eglise a brule (§4.21, §4.24).
        abimerLeSol(this.carte, x, y, "brule", 46);
        this.village.viderLEglise();
      },
    });

    // Le port, sur la plage : aucun corps, aucun point de vie. Il est adosse au
    // flanc ferme de l'ouest, donc rien ne peut jamais l'atteindre (§4.6).
    this.port = new BatimentPort(this, {
      annoncer: (message) => this.events.emit("annonce", message, "port"),
    });

    // Les deux batiments uniques entrent dans la grille, comme les maisons. On
    // n'y pose rien, et on ne pose rien a trois cases autour (§4.24). C'est leur
    // **emprise au sol** qu'on inscrit, jamais la hauteur du sprite : l'eglise
    // monte a 96 px au niveau 4 sans occuper un pouce de terrain de plus.
    this.grille.poserEmprise(EGLISE.x, EGLISE.y, EGLISE.emprise, EGLISE.emprise, "batiment");
    this.grille.poserEmprise(PORT.x, PORT.y, PORT.emprise, PORT.emprise, "batiment");

    // Les survivants (§4.18). Ils ne connaissent ni la scene ni le village :
    // quatre fonctions suffisent, comme pour la sauvegarde (§4.28).
    this.survivants = new Survivants(this, {
      rng: this.rng,
      positionDuHeros: () => ({ x: this.hero.x, y: this.hero.y }),
      vitesseDuHeros: () => this.hero.vitesse,
      rayonDeVue: RAYON_DE_VUE,
      annoncer: (message, source) => this.events.emit("annonce", message, source),
      lacherLaMeute: (x, y, combien) => this.lacherLaMeute(x, y, combien),
      presenter: (sprite) => this.presenterLeSurvivant(sprite),
      noterUneMortEnChemin: () => this.village.noterUneMortEnChemin(),
      // Un en partie installee (§4.18), trois sur la route (§4.31).
      plafond: () => (this.enMarche ? REGLAGES_SURVIVANTS.troupeMax : 1),
      // Pas de refuge tant qu'on marche : on le juge la ou on le trouve, et il
      // marche ensuite avec nous jusqu'au village qu'on finira par accepter.
      refuge: () => (this.enMarche ? null : { x: EGLISE.x, y: EGLISE.y }),
    });

    // Les caches de la route (§4.31). Comme les survivants : elles ne
    // connaissent ni la scene ni le village, cinq fonctions suffisent.
    this.caches = new Caches(this, {
      positionDuHeros: () => (this.hero && this.hero.etat !== "mort" ? { x: this.hero.x, y: this.hero.y } : null),
      pvDuHeros: () => this.hero?.pv ?? 0,
      annoncer: (message, source) => this.events.emit("annonce", message, source),
      ramasser: (cache) => this.ramasserUneCache(cache),
      lacherLeCamp: (cache) => this.leverLeCamp(cache),
      toucherLaStele: (cache) => this.ouvrirLaStele(cache),
      rayonDeVue: RAYON_DE_VUE,
    });

    this.village = new Village(this, {
      menaceAutour: (x, y, rayon) => this.ennemiLePlusProche(x, y, rayon),
      annoncer: (message) => this.events.emit("annonce", message, "village"),
      egliseDebout: () => this.eglise.fonctionne,
      niveauEglise: () => this.eglise.niveau,
      litsEglise: () => this.eglise.regles.palier.lits,
      frapperMonstre: (x, y, portee, degats) => this.frapperPourLeVillage(x, y, portee, degats),
      peuplement: this.peuplement,
      // Le heros se compose avant le village : son prenom est deja pris, et
      // `prenomLibre` est le seul endroit du jeu qui en distribue (§4.18).
      nomsPris: () => this.heros.map((h) => h.personne.nom),
      placesDeVie: () => this.placesDeVie,
      // Le poste du charpentier : ce qu on vient de poser (bloc 8).
      chantierLePlusProche: (x, y) => this.constructions.chantierLePlusProche(x, y),
      // La cour, et si quelqu'un y attend un instructeur (bloc 9).
      courDEntrainement: () => {
        const point = this.cour?.centre;
        if (!point) return null;
        return { point, attend: this.cour.eleves.length > 0 };
      },
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
    // ⚠️ **Une porte ouverte ne cogne personne** (§4.20) : le test de passage
    // laisse traverser tout le monde, monstres compris. On ne suppose pas
    // l'ordre des deux arguments, Phaser le decide selon les operandes.
    const barre: Phaser.Types.Physics.Arcade.ArcadePhysicsCallback = (a, b) => {
      const construction = (a instanceof Construction ? a : b) as Construction;
      return !construction.laissePasser;
    };
    this.physics.add.collider(
      this.ennemis,
      this.constructions.groupe,
      (e, c) => this.cognerConstruction(e as Ennemi, c as Construction),
      barre,
    );
    this.physics.add.collider(this.equipe, this.constructions.groupe, undefined, barre);
    this.physics.add.collider(this.village.groupe, this.constructions.groupe, undefined, barre);
    // Les maisons arretent les corps et se font piller (§4.24). Une ruine n'a
    // plus de corps : on marche dans les decombres. L'ordre des deux arguments
    // n'est pas suppose, Phaser le decide selon les operandes.
    this.physics.add.collider(this.ennemis, this.maisons.groupe, (a, b) => {
      const maison = (a instanceof Maison ? a : b) as Maison;
      const monstre = (a instanceof Maison ? b : a) as Ennemi;
      this.cognerMaison(monstre, maison);
    });
    this.physics.add.collider(this.equipe, this.maisons.groupe);
    this.physics.add.collider(this.village.groupe, this.maisons.groupe);
    // Les habitants ne traversent ni l'eau profonde ni la roche (§4.29).
    this.physics.add.collider(this.village.groupe, this.obstaclesDEau);
    this.physics.add.collider(this.village.groupe, this.obstaclesDeRoche);
    this.dresserLEnceinte(this.planVillage, this.reprise !== null);
    // Le parcours des monstres (§4.6, §4.29) : refait maintenant que l'enceinte
    // et ses douves sont la, puis a chaque fois qu'un passage change.
    this.constructions.surChangementDePassage = () => this.recalculerLeParcours();
    this.recalculerLeParcours();

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

    // Un survivant ne se defend pas et n'encaisse presque rien (§4.18) : le
    // danger est le trajet du retour. On ne pose pas de collider permanent —
    // il n'y a au plus qu'un survivant, et il n'existe pas la plupart du temps.
    this.physics.add.overlap(this.ennemis, this.survivants.groupe, (a, b) => {
      const sprite = (a instanceof Ennemi ? b : a) as SpriteSurvivant;
      const ennemi = (a instanceof Ennemi ? a : b) as Ennemi;
      this.survivants.blesser(sprite, ennemi.degats);
    });

    this.fantome = this.add
      .image(0, 0, textureDe(CONSTRUCTIONS.palissade))
      .setAlpha(0.55)
      .setVisible(false)
      .setDepth(880);

    // On ne nomme plus rien par du texte flottant (§4.24) : passer la souris
    // sur une maison, un mur, l'eglise ou le port dit son nom et son etat. Un
    // seul objet, cree une fois, deplace a la demande (§4.17).
    this.survol = this.add
      .text(0, 0, "", {
        fontFamily: POLICE,
        fontSize: "10px",
        color: "#e8dcc4",
        backgroundColor: "#141018",
        padding: { x: 4, y: 2 },
      })
      .setOrigin(0.5, 1)
      .setDepth(950)
      .setVisible(false);

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
    this.anims.pauseAll();
  }

  private reprendre(): void {
    if (!this.pauseHorsFocus || this.termine) return;
    this.pauseHorsFocus = false;
    // Le temps passe fenetre en arriere-plan ne doit rien declencher au retour :
    // c'est exactement le decalage que le menu de choix applique deja.
    this.decalerLeTemps(this.time.now - this.debutPause);
    this.physics.resume();
    this.anims.resumeAll();
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
    this.constructions.decaler(pause);
    this.prochaineApparition += pause;
    this.prochaineHorde += pause;
    if (this.hordeAuDepart > 0) this.hordeAuDepart += pause;
  }

  /**
   * **Un seul heros, et il n'y en aura pas d'autre a trouver** (DESIGN.md
   * §4.29, tranche par Angelos le 20 septembre 2026). Jusqu'ici l'equipe des
   * sept classes etait donnee d'emblee — un reste du jalon 3, pour eprouver le
   * changement de heros et l'IA. Ces systemes dorment desormais jusqu'au
   * premier villageois forme (bloc 9) : un jeu qui commence a sept heros ne
   * raconte pas « je suis le seul qui reste ».
   */
  private composerEquipe(): void {
    const choisie = (this.registry.get("classe") as ClassId) ?? ORDRE_CLASSES[0]!;
    // Une partie neuve ne commence plus au village : on parait au bord, par le
    // front le plus loin, et on marche (§4.29). Une partie reprise retrouve son
    // heros la ou la sauvegarde l'a laisse — ce point-ci n'est alors qu'un
    // point de passage, remplace quelques lignes plus loin.
    const depart = this.enMarche
      ? ouLonParait(mondeCourant()).point
      : { x: CITE.x, y: CITE.y + 60 };
    this.departDeLaMarche = { ...depart };
    const hero = new Hero(this, depart.x, depart.y, CLASSES[choisie]);
    hero.estIncarne = true;
    this.heros.push(hero);
    this.equipe.add(hero);
  }

  // ------------------------------------------------------- la marche (§4.29)

  /** Vrai tant qu'on marche vers un village qui n'est pas encore le notre. */
  get enChemin(): boolean {
    return this.enMarche;
  }

  /** Ce qu'on porte sur la route (§4.31) : la bourse et le sac. */
  get etatDeLaRoute(): { or: number; butin: Stocks } {
    return { or: this.argent, butin: this.butinDeLaRoute };
  }

  /**
   * On parait loin, seul, et on marche (DESIGN.md §4.29).
   *
   * **Rien de ce qui appartient au Protecteur ne tourne encore** : le cycle est
   * a l'arret (donc ni horde, ni nuit, ni arrivant, ni survivant, ni navire),
   * et on n'enregistre pas — il n'y a pas encore de partie a sauver. Le village,
   * lui, vit : c'est exactement ce qu'on vient voir de loin avant de repondre.
   *
   * La seule aide est une **direction**, en une phrase. La minimap a ete
   * ecartee (§4.10) : chercher fait partie du chemin.
   */
  private commencerLaMarche(): void {
    const monde = mondeCourant();
    const cap = capVers(this.departDeLaMarche, monde.village);
    console.log(
      `[marche] monde n${this.marches + 1} · ${this.refus} refus · ${this.mondesMuets} monde(s) muet(s) restant(s) · ${Math.round(longueurDeLaMarche(monde, this.departDeLaMarche))} px ${cap}`,
    );

    this.prochaineArriveeJournee = null;
    // Un monde muet n'a pas de fumee a l'horizon : on ne promet donc pas un
    // village, on dit la route. Le cap reste, sinon on tournerait en rond.
    this.events.emit(
      "annonce",
      this.villageMuet ? annonceDeRoute(cap) : annonceDArrivee(cap),
      "toi",
    );
    // Ce que le monde a laisse derriere lui (§4.31) : les caches se sement ici,
    // une fois qu'on sait ou l'on parait — c'est ce point-la qu'elles evitent.
    this.semerLesTrouvailles();
    this.reposerLesCompagnons();
    this.semerLeSurvivantDeRoute();
    this.dezoomerALEntree();
  }

  /**
   * L'entree en jeu : tres zoomee sur le heros, puis la camera dezoome seule
   * (DESIGN.md §4.10, tranche le 9 septembre 2026).
   *
   * ⚠️ **C'est le seul mouvement de camera automatique du jeu.** Le §4.11
   * verrouille le zoom libre : on ne prend la camera au joueur qu'une fois, au
   * moment ou il n'a encore rien a faire. Un coup de molette pendant le
   * mouvement l'annule — c'est sa camera, pas la notre.
   */
  private dezoomerALEntree(): void {
    const cam = this.cameras.main;
    // ⚠️ **L'entree ceremonieuse n'a lieu qu'une fois.** Le zoom d'ouverture
    // raconte « tu tombes quelque part » : c'est bien la premiere fois, et
    // c'est une corvee de trois secondes la dixieme. Des qu'on enchaine un
    // monde, on entre au zoom de jeu, derriere le meme voile court qu'a la
    // sortie — un pas, pas une scene.
    const premier = this.marches === 0;
    cam.setZoom(premier ? ZOOM_MAX : ZOOM_DEFAUT);
    cam.fadeIn(premier ? 700 : DUREE_DU_VOILE, 0, 0, 0);
    if (!premier) return;
    this.entreeCamera = this.tweens.add({
      targets: cam,
      zoom: ZOOM_DEFAUT,
      duration: 2600,
      delay: 900,
      ease: "Sine.easeInOut",
      onComplete: () => (this.entreeCamera = null),
    });
  }

  /**
   * La marche, une fois par image : on regarde la porte, et on regarde le bord.
   *
   * Trois moments seulement, et ils s'excluent : quelqu'un vient vers nous, ou
   * on est assez pres d'une porte pour qu'on nous voie, ou on s'en va.
   */
  private majMarche(): void {
    if (!this.enMarche || this.quitteLeMonde) return;
    const hero = this.hero;
    if (!hero || hero.etat === "mort") return;

    if (this.gardien) {
      this.menerLeGardien(hero);
      return;
    }
    if (!this.rencontreFaite) this.guetterLaPorte(hero);
    this.guetterLeDepart(hero);
  }

  /** La porte la plus proche d'un point, en pixels du monde ; `null` s'il n'y en a aucune. */
  private porteLaPlusProche(x: number, y: number): Point | null {
    let choisie: Point | null = null;
    let meilleure = Infinity;
    for (const piece of this.planVillage.enceinte) {
      if (piece.piece !== "porte") continue;
      const centre = Grille.centreCase(piece.colonne, piece.ligne);
      const d = Math.hypot(centre.x - x, centre.y - y);
      if (d < meilleure) {
        meilleure = d;
        choisie = centre;
      }
    }
    return choisie;
  }

  /**
   * Est-on assez pres pour qu'on nous voie ? (§4.29, 20 septembre au soir)
   *
   * **On ne s'installe pas dans un village : on se presente a sa porte.** Dix
   * cases avant, quelqu'un lache ce qu'il fait et vient vers nous.
   */
  private guetterLaPorte(hero: Hero): void {
    // ⚠️ **Un monde muet ne pose aucune question** (§4.29). Sans ce garde, le
    // village vide tomberait sur la branche « personne ne vient » et nous
    // installerait dans des ruines — exactement ce qu'on veut traverser.
    if (this.villageMuet) return;
    const porte = this.porteLaPlusProche(hero.x, hero.y);
    const cible = porte ?? { x: VILLAGE.x, y: VILLAGE.y };
    const marge = porte ? 0 : VILLAGE.rayon;
    const vu = Math.hypot(cible.x - hero.x, cible.y - hero.y) <= REGLAGES_MARCHE.vue + marge;
    // ⚠️ **Ou dans le village, meme sans porte.** Une enceinte trouee se
    // traverse par une breche, et un village ou l'on entre sans que personne ne
    // vienne serait un village vide. On se presente a la porte quand il y en a
    // une devant nous ; sinon, c'est d'etre entre qui nous annonce.
    if (!vu && !dansLeVillage(hero.x, hero.y)) return;

    // ⚠️ **Le champ de directions d'abord, celui qui vient ensuite.** Vu en
    // jeu : l'habitant le plus proche a vol d'oiseau etait de l'autre cote du
    // mur et mettait vingt secondes a faire le tour, pendant qu'un autre,
    // dehors, nous regardait. On les compare donc en **pas de chemin**, ce que
    // le champ sait deja dire.
    this.tracerLeCheminDesHumains(hero);
    const chemin = this.cheminDesHumains!;
    const gardien = this.village.appelerQuelquun(hero.x, hero.y, (v) => {
      const pas = chemin.pasDepuis(v.x, v.y);
      return pas < 0 ? Infinity : pas;
    });
    this.rencontreFaite = true;
    if (!gardien) {
      // Personne pour repondre : il n'y a plus de village a proteger, il n'y a
      // qu'un endroit ou s'installer. Ca ne se produit pas au depart — trois
      // habitants sont toujours la — mais la marche ne doit pas rester bloquee.
      this.events.emit("annonce", "Personne ne vient. Ce village n'a plus de voix.", "toi");
      this.sInstaller(false);
      return;
    }

    gardien.etat = "parle";
    this.gardien = gardien;
    this.events.emit("annonce", `${gardien.nom} sort du village et vient vers toi`, "village");
  }

  /**
   * Ou un habitant peut poser le pied.
   *
   * ⚠️ **Ce n'est pas `passeUnMonstre`, et l'ecart est tout le sujet** : un
   * monstre traverse la liste des murs parce qu'il les **frappe** (§4.6) ;
   * celui qui vient nous parler, lui, sort par la porte. Un mur, une tour, une
   * maison, un batiment l'arretent — la porte, une ruine et un champ non.
   */
  private passeUnVillageois(c: Case): boolean {
    if (c.terrain !== "sable" && c.terrain !== "herbe" && c.terrain !== "sous-bois") return false;
    if (c.occupation === "mur" || c.occupation === "tour") return false;
    if (c.occupation === "batiment" || c.occupation === "maison") return false;
    if (c.occupation !== "douve-eau") return true;
    const douve = this.constructions.en(c.colonne * CASE + CASE / 2, c.ligne * CASE + CASE / 2);
    return douve !== null && (douve.pont || douve.enjambee);
  }

  /**
   * Le champ de directions qui mene le gardien jusqu'a nous.
   *
   * ⚠️ **Il en faut un, la ligne droite ne suffit pas** : vu en jeu — il
   * sortait de sa maison, marchait droit sur nous et restait colle au mur
   * pendant vingt secondes, velocite a fond et position figee. C'est le meme
   * probleme que les monstres depuis le §4.29, et la meme reponse
   * (`parcours.ts`), avec sa regle a lui : un habitant contourne les murs au
   * lieu de les frapper.
   *
   * Il se refait **quand on s'est deplace**, pas par image (§4.17).
   */
  private tracerLeCheminDesHumains(hero: Hero): void {
    this.cheminDesHumains ??= new Parcours(this.grille);
    this.cibleDesHumains = { x: hero.x, y: hero.y };
    this.prochainCheminDesHumains = this.time.now + PERIODE_CHEMIN_DES_HUMAINS;
    this.cheminDesHumains.recalculer(this.cibleDesHumains, (c) => this.passeUnVillageois(c));
  }

  /**
   * Le champ suit le heros, mais **par battements** (§4.17 regle 5).
   *
   * Une propagation balaye toute la grille : la refaire a chaque image pendant
   * qu'on court serait exactement l'ajout non plafonne que le §4.17 interdit.
   * Un tiers de seconde, et seulement si l'on a vraiment bouge — entre deux, un
   * humain suit le dernier champ, ce qui le mene de toute facon vers la porte.
   */
  private suivreLeHeroDesHumains(): void {
    if (!this.cheminDesHumains) return;
    if (this.humainsEnFace === 0 && !this.gardien) return;
    const hero = this.hero;
    if (!hero || hero.etat === "mort") return;
    if (this.time.now < this.prochainCheminDesHumains) return;
    if (Math.hypot(hero.x - this.cibleDesHumains.x, hero.y - this.cibleDesHumains.y) < 120) return;
    this.tracerLeCheminDesHumains(hero);
  }

  /** Il marche vers nous, et il parle quand il y est. */
  private menerLeGardien(hero: Hero): void {
    const gardien = this.gardien;
    if (!gardien || !gardien.regles.vivant) {
      this.gardien = null;
      return;
    }

    const d = Math.hypot(hero.x - gardien.x, hero.y - gardien.y);
    if (d > REGLAGES_MARCHE.parole) {
      this.suivreLeHeroDesHumains();
      const chemin = this.cheminDesHumains;
      // Droit sur nous quand la voie est libre, le champ sinon — la meme regle
      // qu'un monstre qui contourne un lac (§4.29).
      const droit =
        chemin === null || chemin.ligneLibre(gardien, hero, (c) => this.passeUnVillageois(c));
      const vers = droit
        ? { x: (hero.x - gardien.x) / d, y: (hero.y - gardien.y) / d }
        : chemin.direction(gardien.x, gardien.y);
      if (vers) {
        gardien.setVelocity(vers.x * REGLAGES_MARCHE.vitesse, vers.y * REGLAGES_MARCHE.vitesse);
      } else {
        // Aucun chemin : il ne peut pas nous rejoindre (on est de l'autre cote
        // d'un lac). Il parle de la ou il est plutot que de pietiner.
        gardien.setVelocity(0, 0);
        this.ouvrirLaRencontre(gardien);
      }
      return;
    }

    gardien.setVelocity(0, 0);
    orienter(gardien, hero.x - gardien.x, SEUIL_REGARD_PIXELS);
    this.ouvrirLaRencontre(gardien);
  }

  /**
   * Ce qu'il raconte, et sa question.
   *
   * ⚠️ **La parole se tire de la graine du monde**, pas du `Rng` de la partie :
   * un meme monde raconte toujours la meme histoire, comme il a toujours la
   * meme mer. Et elle ne dit que ce qui se voit de loin (§4.29) — c'est
   * `core/marche.ts` qui tient cette regle, pas la scene.
   */
  /**
   * Ce que ce village montre de lui a quelqu'un qui arrive (§4.29).
   *
   * ⚠️ **Rien de ce qui est ici ne doit etre invisible de loin** : la taille,
   * les murs debout, les brèches, le fosse, les fronts. Ni maladie, ni stress,
   * ni reserve — c'est `core/marche.ts` qui tient cette regle, et un test qui
   * la garde.
   */
  /**
   * Ou se tient quelqu'un qui n'a pas de poste dehors : sur la place, au plus
   * pres de l'eglise (§4.29, `placesOuSeTenir`).
   *
   * ⚠️ **Pas le devant des maisons**, qui etait la premiere idee : un village
   * pose six toits en moyenne et jamais plus de quatorze (mesure), pendant
   * qu'il peut compter vingt habitants. Il en serait reste quatorze a se
   * marcher dessus devant trois portes.
   */
  private get placesDeVie(): Point[] {
    return placesOuSeTenir(this.planVillage);
  }

  /**
   * Ce que ce monde donne, tel que le budget le compte (§4.29).
   *
   * ⚠️ Ce n'est **pas** `villageVuDeLoin` : celui-la ne dit que ce qui se voit,
   * parce qu'un habitant le prononce. Celui-ci compte aussi les reserves — un
   * cadeau qui se paie sans se voir.
   */
  private get ceQueLeMondeOffre(): CeQueLeMondeOffre {
    const enceinte = this.planVillage.enceinte;
    return {
      habitants: this.peuplement.population,
      aisance: this.peuplement.aisance,
      fronts: frontsOuverts().length,
      mursDebout: enceinte.filter((p) => p.piece !== "ruine").length,
      breches: enceinte.filter((p) => p.piece === "ruine").length,
      douves: this.planVillage.douves.length > 0,
    };
  }

  private get villageVuDeLoin(): VillageVuDeLoin {
    const enceinte = this.planVillage.enceinte;
    return {
      habitants: this.village.habitants.filter((v) => v.regles.vivant).length,
      mursDebout: enceinte.filter((p) => p.piece !== "ruine").length,
      breches: enceinte.filter((p) => p.piece === "ruine").length,
      douves: this.planVillage.douves.length > 0,
      fronts: frontsOuverts(),
    };
  }

  private ouvrirLaRencontre(gardien: Villageois): void {
    const parole = paroleDuGardien(this.villageVuDeLoin, new Rng(this.graineMonde + 1));

    this.enPause = true;
    this.debutPause = this.time.now;
    this.physics.pause();
    this.anims.pauseAll();
    this.effacerDestination();
    this.events.emit("rencontre", {
      nom: gardien.nom,
      lignes: parole,
      // Ce que ce monde vaut, annonce avant d'entrer (§4.29, le budget).
      augure: this.augureDuMonde,
      question: QUESTION_DU_GARDIEN,
    });
  }

  /**
   * La reponse (§4.29, 20 septembre 2026 au soir).
   *
   * ⚠️ **Refuser ne coute encore rien, et c'est une dette assumee.** Le design
   * dit qu'un village qu'on laisse mourir peut se jeter sur nous, tous
   * ensemble : ca demande des humains hostiles, donc de l'or et de
   * l'experience sur leurs cadavres, donc les deux traits du §4.23 qui
   * regardent qui est en face. C'est le morceau suivant, pas celui-ci.
   */
  private repondreALaRencontre(accepte: boolean): void {
    // Le panneau sert aux deux (§4.31) : c'est ici qu'on sait duquel il s'agit,
    // exactement comme `repondreALaPorte` demele la porte et le sauvetage.
    if (this.steleOuverte !== null) {
      this.repondreALaStele(accepte);
      return;
    }
    this.reprendreLeJeu();

    const gardien = this.gardien;
    this.gardien = null;
    if (gardien) {
      gardien.setVelocity(0, 0);
      gardien.etat = "en-route";
    }

    if (accepte) {
      this.sInstaller(true);
      return;
    }

    // ⚠️ **Refuser en face n'est pas passer au large** (§4.29). Des gens qu'on
    // laisse mourir n'ont plus rien a perdre : ils peuvent se jeter sur nous,
    // tous ensemble. Le risque monte avec leur desespoir, et il n'est **jamais**
    // certain — sinon plus personne ne refuserait en face, et la decision
    // disparaitrait.
    const vue = this.villageVuDeLoin;
    const risque = risqueDAttaque(vue);
    // Tire sur la graine du monde : leur desespoir est une propriete de ce
    // village-la, pas de la seconde ou l'on a clique.
    const tirage = new Rng(this.graineMonde + 2).next();
    console.log(`[marche] refus : risque ${risque.toFixed(2)}, tirage ${tirage.toFixed(2)}`);
    if (tirage < risque) {
      this.leVillageSeJetteSurNous();
      return;
    }

    this.events.emit("annonce", REPONSE_AU_REFUS.paix, "village");
    this.events.emit(
      "annonce",
      "Tu as dit non. Reprends la route — le prochain est plus loin.",
      "toi",
    );
  }

  /**
   * Ils se jettent sur nous, tous ensemble (DESIGN.md §4.29, 20 septembre 2026).
   *
   * Le village se **vide** : chaque habitant vivant repasse de l'autre cote,
   * avec son visage et son nom. Ce n'est pas une horde de plus — c'est ce qu'il
   * restait de gens qui viennent de comprendre que personne ne viendra.
   *
   * ⚠️ **On ne pourra plus s'installer ici**, et c'est le prix : un village
   * qu'on a saigne n'a plus personne a proteger. On se bat, on survit, et on
   * reprend la route par un bord de la carte.
   */
  private leVillageSeJetteSurNous(): void {
    const partants = this.village.prendreLesArmes();
    if (partants.length === 0) return;

    for (const partant of partants) {
      const enrage = new Ennemi(this, partant.x, partant.y, PUISSANCE_DES_HABITANTS, ARCHETYPE_HUMAIN, {
        famille: partant.famille,
        nom: partant.nom,
      });
      this.ennemis.add(enrage);
      this.humainsEnFace += 1;
    }
    // Ils sortent par la porte, pas par le mur : le champ des humains est celui
    // qui a amene celui qui venait parler, et il sert maintenant contre nous.
    this.tracerLeCheminDesHumains(this.hero);

    this.events.emit("annonce", REPONSE_AU_REFUS.attaque, "village");
    this.events.emit(
      "annonce",
      partants.length > 1
        ? `${partants.length} habitants se jettent sur toi`
        : `${partants[0]!.nom} se jette sur toi`,
      "guet",
    );
    this.musique.combat();
  }

  /**
   * On s'en va : par n'importe quel bord, et le monde d'apres est un autre
   * monde (§4.29, « on ne revient jamais en arriere »).
   *
   * ⚠️ La sortie ne s'arme qu'une fois qu'on s'est eloigne de la ou l'on a
   * paru : on nait a quarante pixels d'un bord, et repartir dans la seconde
   * n'est pas un choix, c'est un accident de geometrie.
   */
  private guetterLeDepart(hero: Hero): void {
    if (!this.sortieArmee) {
      const parcouru = Math.hypot(
        hero.x - this.departDeLaMarche.x,
        hero.y - this.departDeLaMarche.y,
      );
      if (parcouru > DISTANCE_D_ARMEMENT) this.sortieArmee = true;
      return;
    }

    const bord = 48;
    const dedans =
      hero.x > PRATICABLE.x + bord &&
      hero.x < PRATICABLE.x + PRATICABLE.largeur - bord &&
      hero.y > PRATICABLE.y + bord &&
      hero.y < PRATICABLE.y + PRATICABLE.hauteur - bord;
    if (dedans) return;

    this.passerAuLarge();
  }

  /**
   * On quitte ce monde-ci, et le suivant commence (§4.29, l'errance continue).
   *
   * **Ce qu'on traverse depend de ce qu'on laisse derriere.** Quitter un monde
   * **habite**, c'est refuser son village : le suivant est « deux fois plus
   * loin », ce qui se traduit par des **mondes muets** a traverser — un apres
   * le premier refus, trois apres le deuxieme, sept apres le troisieme
   * (`mondesMuetsApres`). Quitter un monde muet, c'est simplement en rayer un
   * de la liste.
   *
   * ⚠️ **Le voile est court, et c'est nouveau.** Il durait 700 ms, plus une
   * carte qui se peignait d'un bloc — deux a trois secondes de gel —, plus
   * 700 ms de fondu d'entree : entre deux mondes, on attendait. La carte se
   * peignant desormais par morceaux, la scene se remonte en deux ou trois
   * dixiemes ; le voile n'a plus besoin de couvrir un gel, seulement un pas.
   */
  /**
   * On a fini de fouiller une cache (§4.31).
   *
   * **Les deux monnaies ne vont pas au meme endroit**, et c'est tout le sens du
   * systeme : l'**or** entre dans la bourse, qui traverse les mondes — « refuser
   * un village finance le suivant » (§4.29) prend enfin son sens, puisqu'il y a
   * enfin de quoi gagner de l'or sur la route. La **matiere**, elle, attend :
   * elle deviendra les reserves du jour ou l'on s'installera.
   */
  private ramasserUneCache(cache: Cache): void {
    this.argent += cache.or;
    for (const cle of RESSOURCES) this.butinDeLaRoute[cle] += cache.ressources[cle];
  }

  /**
   * Le camp de betes qui garde une grosse cache se leve (§4.31).
   *
   * ⚠️ **Une seule fois par cache.** `mettreAJour` appelle ceci a chaque image
   * ou l'on est a portee de vue ; sans la marque, on lacherait huit betes par
   * image et le plafond du §4.17 serait creve en une seconde.
   */
  private leverLeCamp(cache: Cache): void {
    if (this.campsLeves.has(cache.id)) return;
    this.campsLeves.add(cache.id);
    this.lacherLaMeute(cache.point.x, cache.point.y, cache.garde, true);
    this.events.emit("annonce", `Des betes rodent autour — ${cache.garde}`, "guet");
  }

  /**
   * Les caches de ce monde-ci, semees au debut de la marche (§4.31).
   *
   * ⚠️ **Jamais en partie installee** (§4.31, point 4), et jamais sur une
   * reprise : la restauration du village (jalon 8) est le systeme qui
   * recompense l'exploration une fois qu'on a un village.
   */
  private semerLesTrouvailles(): void {
    if (!this.enMarche) return;
    // La graine du monde, decalee : deux mondes n'ont pas les memes caches, et
    // le meme monde a toujours les siennes — comme le decor et le village.
    const caches = semerLesCaches(
      mondeCourant(),
      new Rng(this.graineMonde + 811),
      !this.villageMuet,
      this.departDeLaMarche,
    );
    this.caches.poser(caches);
    console.log(`[caches] ${caches.length} posees, dont ${caches.filter((c) => c.taille === "grosse").length} gardees`);
  }

  /**
   * Ce qu'on a porte sur le dos devient le grenier du village (§4.31).
   *
   * ⚠️ **Ca s'ajoute a ce que le village avait deja**, et ca ne le remplace
   * pas : le peuplement lui a donne ses reserves (§4.29), et elles ont ete
   * payees par le budget. Ce qu'on apporte est un cadeau qui n'a rien coute au
   * monde — c'est le prix du detour, et il est a nous.
   */
  private verserLeButinDeLaRoute(): void {
    let total = 0;
    for (const cle of RESSOURCES) {
      this.village.stocks[cle] += this.butinDeLaRoute[cle];
      total += this.butinDeLaRoute[cle];
    }
    if (total > 0) {
      this.events.emit("annonce", `Tu vides ton sac dans le grenier — ${total} de reserves`, "village");
    }
    this.butinDeLaRoute = stocksVides();
  }

  /**
   * Quelqu'un, peut-etre, quelque part sur ce monde-ci (§4.31, deuxieme
   * trouvaille).
   *
   * ⚠️ **Rien ne l'annonce**, et c'est la difference avec le survivant du
   * village. Celui du §4.18 appelle, et la discussion dit « quelque part au
   * nord » ; celui-ci, on le **voit** ou l'on passe a cote sans jamais le
   * savoir. C'est la regle du §4.31 : ce qu'on trouve ne se marque pas sur une
   * carte, et chercher fait partie du chemin.
   */
  private semerLeSurvivantDeRoute(): void {
    if (!this.enMarche) return;
    if (this.survivants.tous.length >= REGLAGES_SURVIVANTS.troupeMax) return;
    // La graine du monde, decalee comme celle des caches : un monde donne porte
    // toujours le meme, ou n'en porte jamais.
    const rng = new Rng(this.graineMonde + 1229);
    if (!rng.chance(REGLAGES_SURVIVANTS.chanceParMonde)) return;
    const place = placeDeRoute(
      mondeCourant(),
      rng,
      this.departDeLaMarche,
      this.caches.places,
    );
    if (!place) return;
    const regles = creerSurvivantDeRoute(rng, place, this.nomsPris());
    // La ligne est vide : personne ne l'annonce (voir plus haut).
    this.survivants.faireParaitre(regles, "");
    console.log(`[route] ${regles.arrivant.personne.nom} attend en ${Math.round(place.x)},${Math.round(place.y)}`);
  }

  /**
   * Ceux qui nous suivaient reparaissent derriere nous, dans le monde suivant
   * (§4.31, decision d'Angelos : « il traverse avec nous »).
   *
   * ⚠️ **On ne rejoue ni leur fiche ni leur meute** : ils sont deja des nous,
   * on les a deja juges, et les redecouvrir a chaque bord de carte aurait fait
   * de la traversee une corvee de trois panneaux.
   */
  private reposerLesCompagnons(): void {
    if (this.compagnonsDeRoute.length === 0) return;
    const depart = this.departDeLaMarche;
    for (let i = 0; i < this.compagnonsDeRoute.length; i++) {
      const regles = this.compagnonsDeRoute[i]!;
      // En file derriere nous, pas les uns dans les autres.
      const angle = (i / REGLAGES_SURVIVANTS.troupeMax) * Math.PI * 2;
      regles.point = { x: depart.x + Math.cos(angle) * 34, y: depart.y + Math.sin(angle) * 34 };
      this.survivants.faireParaitre(regles, "", "suit");
    }
    const noms = this.compagnonsDeRoute.map((c) => c.arrivant.personne.nom).join(", ");
    this.events.emit("annonce", `${noms} ${this.compagnonsDeRoute.length > 1 ? "marchent" : "marche"} avec toi`, "toi");
    this.compagnonsDeRoute = [];
  }

  /**
   * Ceux qui nous suivaient entrent au village (§4.31).
   *
   * **Sans ceremonie, et c'est voulu** : on les a juges sur la route, un par un,
   * au moment ou on est arrive sur eux. Rejouer trois fiches d'observation a
   * l'instant ou le jour 1 se leve aurait enterre le seul moment fort du §4.29
   * sous une pile de panneaux.
   */
  private installerLesCompagnons(): void {
    const suiveurs = this.survivants.suiveurs;
    for (const sprite of suiveurs) {
      const { arrivant, etat } = sprite.regles;
      const villageois = this.village.accueillir(arrivant.personne, arrivant.metierPretendu);
      // Ce qu'il porte entre avec lui, comme au §4.18 : l'infection est
      // contagieuse entre voisins de travail (§4.23).
      if (etat !== null) contracterEtat(villageois.personne, etat);
      const fou = suivreSiFou(arrivant, villageois.regles.id, 1, this.rng);
      if (fou !== null) this.fous.push(fou);
      this.events.emit(
        "annonce",
        `${arrivant.personne.nom} s'installe avec toi — ${NOMS_METIER[arrivant.metierPretendu].toLowerCase()}`,
        "village",
      );
    }
    this.survivants.vider();
  }

  /**
   * On a pose la main sur une stele (§4.31, troisieme trouvaille).
   *
   * ⚠️ **Elle dit ce qu'elle donne et ce qu'elle coute avant qu'on paie**
   * (decision d'Angelos, 21 septembre 2026). C'est ce qui autorise des traits
   * aussi lourds que les siens : un don a l'aveugle aurait ete plus memorable
   * et plus injuste — un mauvais tirage aurait decide d'une partie entiere sans
   * qu'on ait rien eu a dire.
   *
   * Le panneau est **celui de la rencontre** (§4.29). Les deux scenes sont la
   * meme : quelque chose nous pose une question, et nous avons deux reponses.
   * Deux panneaux auraient ete une interface en double (§4.10).
   */
  private ouvrirLaStele(cache: Cache): void {
    if (cache.trait === null || this.steleOuverte !== null) return;
    this.steleOuverte = cache;
    const parole = paroleDeLaStele(cache.trait);

    this.enPause = true;
    this.debutPause = this.time.now;
    this.physics.pause();
    this.anims.pauseAll();
    this.effacerDestination();
    this.events.emit("rencontre", {
      nom: "La stele",
      titre: "UNE STELE",
      lignes: parole.lignes,
      augure: parole.augure,
      question: parole.question,
      oui: "Poser la main",
      non: "Passer ton chemin",
    });
  }

  /**
   * On accepte le trait, ou on repart sans.
   *
   * **Passer son chemin ne consomme rien** : la stele reste, et on peut revenir
   * tant qu'on est dans ce monde-ci. Une pierre ne s'en va pas parce qu'on a
   * hesite — et le §4.31 veut un pari eclaire, pas un piege.
   */
  private repondreALaStele(accepte: boolean): void {
    const cache = this.steleOuverte;
    this.steleOuverte = null;
    this.reprendreLeJeu();
    if (!cache || cache.trait === null) return;

    if (!accepte) {
      this.events.emit("annonce", "Tu retires ta main. La pierre reste.", "toi");
      return;
    }

    const def = traitParId(cache.trait);
    const hero = this.hero;
    if (!def || !hero || hero.etat === "mort") return;
    // ⚠️ **Le trait va au heros, pas au village** (§4.31) : c'est lui qui a
    // fait le detour, et c'est lui qui le portera jusqu'au bout — la mort est
    // definitive, donc ce qu'on grave ici se perd avec lui.
    if (gagnerTrait(hero.personne, def.cle)) {
      // ⚠️ **Rien a recalculer, mais il faut borner la vie.** Les getters du
      // heros lisent `personne.mods`, que `gagnerTrait` vient de reagreger ; en
      // revanche un trait qui **baisse** la vie maximale (le Serment de fer)
      // laisserait ses points de vie courants au-dessus du nouveau plafond.
      hero.pv = Math.min(hero.pv, hero.pvMax);
      this.events.emit("annonce", `La pierre te marque — ${def.nom}`, "toi");
      this.events.emit("annonce", def.resume, "toi");
    } else {
      this.events.emit("annonce", "La pierre ne te dit plus rien. Tu portes deja sa marque.", "toi");
    }
    this.caches.eteindre(cache.id);
  }

  private passerAuLarge(): void {
    this.quitteLeMonde = true;
    // Refuser, c'est quitter un monde qui avait quelqu'un. Traverser des
    // ruines vides ne coute rien : c'est deja le prix qu'on paie.
    const refus = this.villageMuet ? this.refus : this.refus + 1;
    const mondesMuets = this.villageMuet
      ? Math.max(0, this.mondesMuets - 1)
      : mondesMuetsApres(refus);
    this.events.emit(
      "annonce",
      this.villageMuet ? "Les ruines s'eloignent. La route continue." : "Tu passes au large. La route continue.",
      "toi",
    );
    const cam = this.cameras.main;
    cam.fadeOut(DUREE_DU_VOILE, 0, 0, 0);
    cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.stop("ui");
      this.scene.start("arena", {
        classe: this.registry.get("classe") as ClassId,
        emplacement: this.emplacement,
        marches: this.marches + 1,
        refus,
        mondesMuets,
        // ⚠️ **Ce qu'on a trouve sur la route traverse avec nous** (§4.29,
        // §4.31). L'or et la matiere passaient jusqu'ici par accident : Phaser
        // reutilise l'instance de scene, donc les champs survivaient a
        // `scene.start`. Ca marchait, et ca n'etait ecrit nulle part — une
        // ligne de plus dans `init` l'aurait efface sans qu'on comprenne
        // pourquoi la bourse se vidait. C'est donc passe explicitement.
        argent: this.argent,
        butinDeLaRoute: this.butinDeLaRoute,
        // Ceux qui nous suivent traversent avec nous (§4.31). On passe leurs
        // **regles**, pas leurs sprites : un sprite appartient a la scene qu'on
        // quitte, et il meurt avec elle.
        compagnons: this.survivants.suiveurs.map((s) => s.regles),
      });
    });
  }

  /**
   * On s'installe : le jour 1 commence ici, et pas avant.
   *
   * C'est ce moment-la qui remplace l'ancien depart du jeu — village fixe,
   * sept heros, jour 1 des la premiere image. Tout ce qui etait fait dans
   * `create` a la naissance d'une partie neuve est fait ici : le premier
   * visiteur offert, le compte a rebours des hordes, et la premiere sauvegarde.
   *
   * @param donneeALaParole vrai quand on vient de repondre a la porte ; faux
   *        quand la partie commence deja installee (une capture, un test)
   */
  private sInstaller(donneeALaParole: boolean): void {
    this.enMarche = false;
    this.gardien = null;
    // ⚠️ **Ce qu'on portait devient le grenier, et la route s'arrete la**
    // (§4.31, point 4). Les caches n'existent pas en partie installee : la
    // restauration du village (jalon 8) est le systeme qui recompensera
    // l'exploration a partir de ce moment.
    this.verserLeButinDeLaRoute();
    this.caches.vider();
    // Ceux qu'on a ramasses sur la route deviennent des habitants de plus
    // (§4.31) : un metier de plus, un toit de plus a relever, et — depuis le
    // §4.29 — une chance de plus qu'un heros naisse avec un don (bloc 9).
    this.installerLesCompagnons();
    // Le champ des humains ne sert plus a personne : on le jette plutot que de
    // le laisser se refaire pendant toute la partie (§4.17).
    this.cheminDesHumains = null;

    if (donneeALaParole) {
      this.events.emit("annonce", "Tu as donne ta parole. Ce village est le tien.", "toi");
    }
    this.events.emit("annonce", "Jour 1 — le village se reveille", "village");
    // ⚠️ **Le premier visiteur est offert**, des le premier matin (decision du
    // 10 aout 2026). Au rythme de croisiere — un tous les 2 a 3 jours — la
    // premiere porte se serait ouverte apres des heures de jeu. On peut
    // apprendre un jeu pendant deux heures sans jamais rencontrer un de ses
    // systemes : c'est ce qu'on evite ici. Le rythme, lui, ne bouge pas.
    this.prochaineArriveeJournee = 1;
    // ⚠️ **Les malades se decouvrent ici, jamais avant.** Le budget les a
    // achetes avec le reste (§4.29), et le village s'est bien garde de les
    // mentionner a la porte : ce qui ne se voit pas de loin ne se dit pas.
    const malades = this.village.poserLesMalades(this.menaces.malades);
    if (malades.length > 0) {
      this.events.emit(
        "annonce",
        malades.length === 1
          ? `${malades[0]} est malade — ils ne l'avaient pas dit`
          : `${malades.join(", ")} sont malades — ils ne l'avaient pas dit`,
        "village",
      );
    }
    // Le temps de la partie commence a l'installation : la marche n'est pas du
    // temps de survie, et les hordes ne doivent pas avoir couru pendant.
    this.debut = this.time.now;
    this.prochaineApparition = this.time.now + 1200;
    this.programmerHorde();
    this.enregistrer();
  }

  /**
   * Fait avancer la peinture de la carte dans le budget d'une image (§4.29).
   *
   * **Elle regarde la ou on regarde** : le morceau le plus proche du heros
   * cuit avant le fond de la carte, et le joueur ne voit donc jamais la
   * vignette floue la ou il marche. Une fois tout cuit, cet appel ne fait plus
   * que verifier qu'il n'y a rien a faire.
   */
  private avancerLaCarte(): void {
    const carte = this.carte;
    if (!carte) return;
    const hero = this.hero;
    if (hero) carte.regarder(hero.x, hero.y);
    carte.avancer();
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
    // Les batiments dessines par le code (§4.30). Cuits une fois, avant qu'on
    // en pose un seul : `add.image` sur une cle inconnue donne un carre vert.
    cuireLesBatiments(this);

    // Le sol : la vignette du monde en fond, puis les morceaux nets qui s'y
    // posent en cuisant (§4.29). Ce qu'on a sous les yeux a la premiere image
    // est peint tout de suite ; le reste suit image par image.
    this.carte?.poser(-1000);

    // ⚠️ **L'eau bouge par-dessus, jamais dedans.** Un morceau de carte est une
    // texture figee : rien ne peut y etre anime. La mer et le sable d'origine
    // sont gardes pour leur couleur, cette couche n'ajoute que le mouvement
    // (§4.30).
    this.mer = poserLaMer(this, MONDE, releverLeRivage(MONDE, distanceALEau), CLE_MASQUE_EAU, ECHELLE_DU_MASQUE);

    this.semerLeDecor();
    this.construireVillage();
    // ⚠️ Plus de ronds ni de noms au sol pour la plage, les champs, la mine et
    // la foret (18 septembre 2026, §4.30) : on reconnait un lieu a ce qu'il y a
    // dessus, et ce qui manque encore (mine, ponton, buches) viendra au bloc 7a.
  }

  /**
   * Arbres et rochers, semes avec une graine fixe pour que la carte soit la
   * meme d'une partie a l'autre : on doit pouvoir apprendre son terrain.
   *
   * Chaque graine est refusee si elle ne tombe pas sur le bon sol. Sans ce
   * filtre, il poussait des arbres dans la mer et au milieu du village.
   */
  private semerLeDecor(): void {
    // La graine du monde entre dans celle du decor : deux mondes n'ont pas les
    // memes arbres, et le meme monde a toujours les siens.
    const rng = new Rng(20260807 + this.graineMonde);

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
        // Le village est une place, pas une clairiere : rien n'y pousse. C'est
        // le plan qui dit ou elle s'arrete — murs compris, avec une case de
        // marge pour qu'aucun arbre ne pousse dans un pan.
        if (this.planVillage.emprise.has(cleCase(this.grille.colonneDe(x), this.grille.ligneDe(y)))) continue;
        poser(x, y);
      }
    };

    /**
     * Un element de decor, pose a sa taille native, **le pied sur le sol**.
     *
     * Plus de `setScale(rng.range(...))` : une echelle fractionnaire donne des
     * pixels de tailles inegales, ce qui saute aux yeux sur du vrai pixel-art.
     * La variete vient des silhouettes dessinees par le code et du miroir
     * horizontal, qui ne coutent aucun flou. L'origine est celle du decor : c'est
     * le pied qui decide de la profondeur, pas le milieu de l'image.
     */
    const poser = (x: number, y: number, cle: string) => {
      this.add
        .image(x, y, cle)
        .setOrigin(0.5, decorParCle(cle).origineY)
        .setDepth(y)
        .setFlipX(rng.next() < 0.5);
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
    // sud credible. Des coniferes sombres pour la moitie, et le reste partage
    // entre arbres vivants et arbres morts — une foret d'apres la fin du monde.
    semer(tirages(830), ["sous-bois"], (x, y) => {
      const tirage = rng.next();
      poser(x, y, rng.pick(tirage < 0.5 ? CONIFERES : tirage < 0.75 ? ARBRES_VIVANTS : ARBRES_MORTS));
    });

    // Des bosquets epars sur la prairie, morts pour la plupart : le decor ne
    // doit jamais etre un fond uni, mais il ne doit pas non plus masquer les
    // personnages (§4.11).
    semer(tirages(365), ["herbe"], (x, y) => {
      if (rng.next() > 0.22) return;
      poser(x, y, rng.pick(rng.next() < 0.65 ? ARBRES_MORTS : ARBRES_VIVANTS));
    });

    // Les rochers, sur l'eboulis et au pied de la montagne.
    semer(tirages(470), ["eboulis", "roche"], (x, y) => {
      if (rng.next() > 0.3) return;
      poser(x, y, rng.pick(ROCHERS));
    });
  }

  /**
   * Les details de vie (§4.24, 19 septembre 2026) : un puits sur la place, des
   * tonneaux et du bois contre les maisons debout, une charrette en retrait
   * d'une porte. Du decor tire de la graine du village — rien qui bloque, rien
   * qui se sauve, jamais sur une rue.
   *
   * ⚠️ Ils ne suivent pas une maison qu'on deplace ou qu'on demolit : c'est le
   * prix d'un decor, et il est accepte pour l'instant.
   */
  private poserLesDetailsDeVie(): void {
    const plan = this.planVillage;
    const rng = new Rng(plan.graine + 97);
    const distanceAuSegment = (x: number, y: number, s: Segment) => {
      const dx = s.a.x - s.de.x;
      const dy = s.a.y - s.de.y;
      const l2 = dx * dx + dy * dy;
      const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((x - s.de.x) * dx + (y - s.de.y) * dy) / l2));
      return Math.hypot(x - (s.de.x + dx * t), y - (s.de.y + dy * t));
    };
    const libre = (x: number, y: number) => {
      const c = this.grille.caseEn(x, y);
      if (!c || c.occupation !== "libre" || !plan.place.has(cleCase(c.colonne, c.ligne))) return false;
      return !this.ruesDuVillage.some((r) => distanceAuSegment(x, y, r) < 14);
    };
    // Ce que chaque detail occupe autour de son pied : deux details ne se
    // chevauchent jamais (le linge mordait sur la charrette et sur le puits,
    // juge sur capture le 20 septembre 2026).
    const RAYONS: Record<string, number> = {
      [CLE_PUITS]: 14,
      [CLE_TONNEAU]: 8,
      [CLE_TAS_DE_BOIS]: 13,
      [CLE_CHARRETTE]: 18,
      [CLE_CORDE_A_LINGE]: 20,
      [CLE_FILETS]: 18,
    };
    const poses: { x: number; y: number; rayon: number }[] = [];
    const loinDesAutres = (x: number, y: number, cle: string) =>
      poses.every((p) => Math.hypot(p.x - x, p.y - y) >= p.rayon + (RAYONS[cle] ?? 12));
    const poser = (x: number, y: number, cle: string, miroir = rng.next() < 0.5) => {
      if (!this.textures.exists(cle)) return;
      this.add.image(x, y, cle).setOrigin(0.5, decorParCle(cle).origineY).setDepth(y).setFlipX(miroir);
      poses.push({ x, y, rayon: RAYONS[cle] ?? 12 });
    };

    // Le puits : a trois cases de l'eglise, dans la premiere direction qui a de la place.
    const DIRECTIONS = [[3, 0], [0, 3], [-3, 0], [0, -3], [3, 3], [3, -3], [-3, 3], [-3, -3]] as const;
    const depart = Math.floor(rng.next() * DIRECTIONS.length);
    for (let i = 0; i < DIRECTIONS.length; i++) {
      const [dc, dl] = DIRECTIONS[(depart + i) % DIRECTIONS.length]!;
      const c = Grille.centreCase(plan.centre.colonne + dc, plan.centre.ligne + dl);
      if (!libre(c.x, c.y)) continue;
      poser(c.x, c.y + 6, CLE_PUITS, false);
      break;
    }

    // Des tonneaux a droite des maisons debout, du bois a gauche — pas partout.
    for (const maison of this.maisons.toutes) {
      if (!maison.debout) continue;
      const centre = maison.centre;
      const droite = { x: centre.x + CASE + 8, y: centre.y + CASE - 6 };
      if (rng.next() < 0.75 && libre(droite.x, droite.y)) {
        poser(droite.x, droite.y, CLE_TONNEAU);
        if (rng.next() < 0.5) poser(droite.x + 9, droite.y + 3, CLE_TONNEAU);
      }
      const gauche = { x: centre.x - CASE - 12, y: centre.y + CASE - 8 };
      if (rng.next() < 0.6 && libre(gauche.x, gauche.y)) poser(gauche.x, gauche.y, CLE_TAS_DE_BOIS);
    }

    // Une charrette, en retrait de la premiere rue qui sort par une porte.
    const portes = new Set(
      plan.enceinte
        .filter((m) => m.piece === "porte")
        .map((m) => {
          const c = Grille.centreCase(m.colonne, m.ligne);
          return `${c.x},${c.y}`;
        }),
    );
    const rue = this.ruesDuVillage.find((r) => portes.has(`${r.a.x},${r.a.y}`));
    if (rue) {
      const dx = rue.de.x - rue.a.x;
      const dy = rue.de.y - rue.a.y;
      const l = Math.hypot(dx, dy) || 1;
      const ux = dx / l;
      const uy = dy / l;
      for (const cote of [1, -1]) {
        const x = rue.a.x + ux * 48 - uy * 22 * cote;
        const y = rue.a.y + uy * 48 + ux * 22 * cote;
        if (!libre(x, y)) continue;
        poser(x, y, CLE_CHARRETTE, cote < 0);
        break;
      }
    }

    // Du linge devant chaque maison debout (20 septembre 2026) : une corde d'une
    // case de large, juste sous l'emprise, d'un cote ou de l'autre de la porte.
    // Les deux bouts doivent etre libres aussi, sinon elle mordrait sur une rue
    // ou sur la voisine. La marge de la place suffit (rien n'y pousse) : les
    // maisons du sud ont la lisiere sous leur emprise, pas la place.
    const libreDevantUneMaison = (x: number, y: number) => {
      const c = this.grille.caseEn(x, y);
      if (!c || c.occupation !== "libre" || !plan.emprise.has(cleCase(c.colonne, c.ligne))) return false;
      if (!estTerreFerme(x, y)) return false;
      return !this.ruesDuVillage.some((r) => distanceAuSegment(x, y, r) < 14);
    };
    for (const maison of this.maisons.toutes) {
      if (!maison.debout) continue;
      const cote = rng.next() < 0.5 ? -6 : 6;
      const y = maison.centre.y + CASE + 10;
      // pres de la porte d'abord, puis decale vers un coin si un detail gene
      for (const x of [maison.centre.x + cote, maison.centre.x - cote, maison.centre.x + 3 * cote, maison.centre.x - 3 * cote]) {
        if (!libreDevantUneMaison(x, y) || !libreDevantUneMaison(x - 14, y) || !libreDevantUneMaison(x + 14, y)) continue;
        if (!loinDesAutres(x, y, CLE_CORDE_A_LINGE)) continue;
        poser(x, y, CLE_CORDE_A_LINGE);
        break;
      }
    }

    // Des filets qui sechent au poste de peche, et contre le port : depuis que
    // les ronds de poste sont partis (18 septembre 2026), c'est a eux de dire
    // ou l'on peche. Sur le sable, jamais sur la rue qui y mene, et a plus
    // d'une case du point ou l'on travaille — les pecheurs s'y tiennent. Le
    // sable libre est etroit (une case entre le port et l'eau) : on cherche le
    // plus pres du lieu, et on prend le premier qui passe.
    const libreSurLeSable = (x: number, y: number) => {
      const c = this.grille.caseEn(x, y);
      if (!c || c.occupation !== "libre" || terrainEn(x, y) !== "sable") return false;
      return !this.ruesDuVillage.some((r) => distanceAuSegment(x, y, r) < 16);
    };
    const plage = POSTES.find((p) => p.id === "plage");
    const lieux = [...(plage ? [plage.position] : []), { x: PORT.x, y: PORT.y }];
    for (const lieu of lieux) {
      const candidats: { x: number; y: number; d: number }[] = [];
      for (let dy = -72; dy <= 72; dy += 24) {
        for (let dx = -48; dx <= 48; dx += 16) {
          const d = Math.hypot(dx, dy);
          if (d >= 36) candidats.push({ x: lieu.x + dx, y: lieu.y + dy, d });
        }
      }
      candidats.sort((a, b) => a.d - b.d || a.y - b.y || a.x - b.x);
      const emplacement = candidats.find(
        (c) =>
          libreSurLeSable(c.x, c.y) &&
          libreSurLeSable(c.x - 14, c.y) &&
          libreSurLeSable(c.x + 14, c.y) &&
          loinDesAutres(c.x, c.y, CLE_FILETS),
      );
      if (emplacement) poser(emplacement.x, emplacement.y, CLE_FILETS);
    }
  }

  /**
   * Le village : ce que le plan de la graine en dit (§4.24). Il est adosse a
   * la mer et a la montagne, et ses habitants arrivent avec le village vivant.
   */
  private construireVillage(): void {
    // ⚠️ L'enceinte n'est plus posee ici : elle est faite de **vraies
    // constructions** (corps, points de vie, raccords), donc elle attend que le
    // parc existe — voir `dresserLEnceinte`, appele depuis le village vivant.
    //
    // Les maisons, elles, sont un parc a part (§4.24) : debout ou en ruine
    // selon le plan, ou telles que la sauvegarde les a laissees. Une sauvegarde
    // d'avant le 19 septembre 2026 n'en a pas : elle reprend celles du plan.
    this.maisons = new Maisons(this, this.grille);
    if (this.reprise?.maisons) this.maisons.reprendre(this.reprise.maisons);
    else this.maisons.poserLePlan(this.planVillage.maisons);

    // La cour d'entrainement (§4.18, bloc 9). Un village trouve n'en a jamais :
    // c'est le Protecteur qui la batit, et c'est le seul batiment du jeu qui
    // fabrique des heros.
    this.cour = new Cour(this, this.grille);
    if (this.reprise?.cour) this.cour.reprendre(this.reprise.cour);
    this.poserLesDetailsDeVie();

    // ⚠️ **Plus de texte « LE VILLAGE » qui flotte, et plus de disque de terre
    // battue** (§4.24, §4.30) : on reconnait un lieu a ce qu'il y a dessus. Le
    // sol de place et les chemins sont des **etats de case** — ils reviendront
    // ecrits dans la grille, pas peints dans la carte.
  }

  /**
   * L'enceinte de depart : ce que le village avait deja quand on arrive.
   *
   * Elle vient du **plan** (`core/village.ts`) : la forme, une tour a chaque
   * angle et a chaque bout, les portes la ou l'on sort travailler, et des
   * breches — le village est en ruine (§4.6). Ce sont de **vraies
   * constructions** (corps, points de vie, raccords), pas un decor : un mur du
   * joueur qui s'y accole se raccorde, et les monstres doivent l'abattre ou
   * passer par les breches.
   *
   * ⚠️ **Sur une partie reprise, on ne dresse que les breches.** Les murs, les
   * tours et les portes reviennent par la sauvegarde, avec leurs points de vie
   * et sans ceux qui sont tombes : les redresser ici les ferait renaitre.
   */
  private dresserLEnceinte(plan: PlanVillage, seulementLesRuines: boolean): void {
    for (const piece of plan.enceinte) {
      const centre = Grille.centreCase(piece.colonne, piece.ligne);
      if (piece.piece === "ruine") {
        if (!this.grille.constructible(centre.x, centre.y, true)) continue;
        this.grille.poser(centre.x, centre.y, "ruine");
        this.add
          .image(centre.x, centre.y, CLE_MUR_RUINE)
          .setOrigin(0.5, ORIGINE_MUR_Y)
          .setDepth(centre.y + CASE / 2);
        continue;
      }
      if (seulementLesRuines) continue;
      this.constructions.dresser(centre.x, centre.y, piece.piece);
    }
    if (seulementLesRuines) return;
    // Les douves que le village avait deja (§4.29, 20 septembre 2026) : creusees
    // sans rien payer, en eau si le plan le dit, et chaque porte devant l'eau
    // est deja un pont-levis. Une partie reprise les retrouve dans sa sauvegarde.
    for (const douve of plan.douves) {
      const centre = Grille.centreCase(douve.colonne, douve.ligne);
      const creusee = this.constructions.dresser(centre.x, centre.y, "douve");
      if (creusee && douve.eau) this.constructions.remplirDeForce(creusee);
    }
    for (const porte of this.constructions.portes) this.constructions.dresserEnPontLevis(porte);
  }

  /**
   * Ce qu'il y a sous la souris, et son etat (§4.24) : une maison, un mur, une
   * tour, une porte, l'eglise ou le port. Rien d'autre ne porte de nom ecrit.
   */
  private majSurvol(p: Phaser.Input.Pointer): void {
    if (this.termine) return;
    const monde = this.cameras.main.getWorldPoint(p.x, p.y);
    let texte: string | null = null;
    let x = monde.x;
    let y = monde.y;

    const maison = this.maisons.en(monde.x, monde.y);
    const construction = this.constructions.en(monde.x, monde.y);
    if (maison) {
      const c = maison.centre;
      x = c.x;
      y = maison.y;
      texte = maison.debout
        ? `${maison.nom} — ${Math.ceil(maison.pv)}/${REGLAGES_MAISONS.pvMax}`
        : `${maison.nom} en ruine — L pour la relever, ${REGLAGES_MAISONS.coutBois} bois`;
    } else if (construction && construction.def.id === "douve") {
      x = construction.x;
      y = construction.y - CASE / 2;
      texte = construction.eau
        ? construction.pont
          ? "Douve en eau, sous le pont-levis"
          : "Douve en eau — rien ne la franchit"
        : `Douve seche — on la franchit au ralenti · N puis clic : l'eau, ${coutEnClair(REMPLISSAGE.cout)}`;
    } else if (construction) {
      x = construction.x;
      y = construction.y - CASE / 2;
      const suite = amelioration(construction.def, construction.matiere);
      const touche = construction.def.id === "porte" ? "K" : "G";
      const renfort = suite ? ` · ${touche} puis clic : ${suite.matiere}, ${coutEnClair(suite.palier.cout)}` : "";
      const palier = construction.matiere === "bois" ? "" : ` en ${construction.matiere}`;
      const nom = construction.pontLevis ? "Pont-levis" : construction.def.nom;
      const etat = construction.battant
        ? construction.battant.phase === "ouverte"
          ? ", ouverte"
          : construction.battant.phase === "fermee"
            ? ", fermee"
            : construction.battant.phase === "s-ouvre"
              ? ", s'ouvre"
              : ", se ferme"
        : "";
      const pont =
        construction.battant && !construction.pontLevis && !this.constructions.refusPontLevis(construction, this.village.stocks)
          ? ` · K puis clic : pont-levis, ${coutEnClair(PONT_LEVIS.cout)}`
          : "";
      texte = `${nom}${palier}${etat} — ${Math.ceil(construction.pv)}/${construction.pvMax}${renfort}${pont}`;
    } else if (Phaser.Math.Distance.Between(monde.x, monde.y, EGLISE.x, EGLISE.y) <= EGLISE.emprise) {
      x = EGLISE.x;
      y = EGLISE.y - EGLISE.emprise;
      texte = this.eglise.fonctionne
        ? `Eglise, niveau ${this.eglise.niveau} — ${Math.ceil(this.eglise.regles.pv)} PV`
        : "Eglise a terre — Y pour la relever";
    } else if (Phaser.Math.Distance.Between(monde.x, monde.y, PORT.x, PORT.y) <= PORT.emprise) {
      x = PORT.x;
      y = PORT.y - PORT.emprise;
      texte = this.port.regles.etat === "debout" ? "Le port — P pour vendre" : "Le port, en ruine — P pour le relever";
    }

    if (!texte) {
      this.survol.setVisible(false);
      return;
    }
    this.survol.setText(texte).setPosition(x, y - 4).setVisible(true);
  }

  // -------------------------------------------------------------- controles

  private configurerZoom(): void {
    this.input.on("wheel", (_p: unknown, _o: unknown, _dx: number, dy: number) => {
      // Un coup de molette reprend la camera au dezoom d'entree : le §4.11
      // promet un zoom libre, et une animation qui tire dans l'autre sens
      // pendant qu'on regle le sien serait exactement le contraire.
      this.entreeCamera?.stop();
      this.entreeCamera = null;
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
      if (this.termine) return;
      // Le mode d'amenagement prend toute la souris : gauche pose, prend ou
      // repose ; droite demolit. Rien ne commande, rien ne se deplace — le jeu
      // est arrete (§4.24).
      if (this.amenagement) {
        const point = this.cameras.main.getWorldPoint(p.x, p.y);
        this.cliquerEnAmenagement(point.x, point.y, p.rightButtonDown());
        return;
      }
      if (this.enPause) return;
      // En mode construction, le clic gauche batit : c'est la seule chose qu'on
      // fasse d'un clic a ce moment-la, et le clic droit continue de commander.
      if (!p.rightButtonDown() && this.enConstruction) {
        const point = this.cameras.main.getWorldPoint(p.x, p.y);
        this.batirIci(point.x, point.y);
        return;
      }
      if (p.rightButtonDown()) {
        this.ordonnerAncre(p);
        return;
      }
      // Le mode commandement prend le clic gauche, et lui seul (§4.4, bloc 8) :
      // on selectionne quelqu'un, ou on commence un rectangle. Le heros ne
      // bouge plus a la souris tant qu'on y est — c'est le prix du mode, et
      // c'est ce qui le rend lisible.
      if (this.modeCommandement) {
        this.cliquerEnCommandement(p);
        return;
      }
      // Une cache a portee, cliquee : on fouille au lieu de marcher (§4.31).
      // Elle passe avant `viser` et apres tout le reste — c'est le seul endroit
      // ou un clic gauche fait autre chose que deplacer, hors amenagement.
      const cible = this.cameras.main.getWorldPoint(p.x, p.y);
      if (this.caches.cliquer(cible.x, cible.y)) return;
      viser(p);
    });
    // Maintenir guide le heros ; le clic droit, lui, ne se maintient pas.
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      if (this.modeCommandement) {
        if (this.rectangleDepart && p.isDown && !p.rightButtonDown()) {
          const point = this.cameras.main.getWorldPoint(p.x, p.y);
          this.rectangleCourant = new Phaser.Math.Vector2(point.x, point.y);
        }
        this.majSurvol(p);
        return;
      }
      if (p.isDown && !p.rightButtonDown() && !this.enConstruction) viser(p);
      this.majSurvol(p);
    });

    this.input.on("pointerup", (p: Phaser.Input.Pointer) => {
      if (this.modeCommandement && this.rectangleDepart) this.fermerLeRectangle(p);
    });
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

    const ancre = protege ? { x: protege.x, y: protege.y } : { x: point.x, y: point.y };
    // Poser une ancre a la main, c'est le rappeler du travail : sinon
    // `travaillerLesHeros` la remettrait sur le poste a l'image suivante, et le
    // clic droit paraitrait ne rien faire.
    for (const h of this.commandement.destinataires(incarne)) h.travail = null;
    // Rien de selectionne : l'ordre vaut pour toute l'equipe IA (§4.4). Ca
    // n'a jamais valu pour les civils — trente habitants envoyes d'un clic
    // distrait tenir un carrefour, c'est la production entiere qui s'arrete.
    const nombre = this.commandement.ancrer(ancre, protege ?? null, incarne, this.sbires);
    const civils = this.commandement.ancrerCivils(ancre, protege ?? null);
    if (nombre + civils === 0) return;

    this.effetCercle(point.x, point.y, protege ? 34 : 22, protege ? 0x7ee0a0 : 0x5ec8f0);
    this.annoncer(
      protege
        ? `${nombre + civils} protege${nombre + civils > 1 ? "nt" : ""} ${protege.personne.nom}`
        : `${nombre + civils} en route`,
    );
  }

  /**
   * Tab prend et rend le mode commandement (DESIGN.md §4.4, bloc 8).
   *
   * Il ne met rien en pause : le §4.4 est formel, « le combat ne s'arrete
   * jamais pour donner un ordre ». Ce qu'il change tient en une ligne — le clic
   * gauche selectionne au lieu de deplacer.
   */
  private basculerCommandement(force?: boolean): void {
    const veut = force ?? !this.modeCommandement;
    if (veut === this.modeCommandement) return;
    this.modeCommandement = veut;
    this.rectangleDepart = null;
    this.rectangleCourant = null;

    if (!veut) {
      this.events.emit("fermer-menu-ordres");
      this.annoncer("");
      return;
    }
    // Entrer dans le mode lache le heros sur place : sinon il continuerait de
    // courir vers le dernier point clique pendant qu'on donne des ordres.
    this.effacerDestination();
    this.lacherLOutil();
    this.annoncer("Clic : qui  ·  glisse un cadre  ·  clic droit : ou");
  }

  /**
   * Le clic gauche en mode commandement.
   *
   * Sur quelqu'un : il entre dans la selection et son menu s'ouvre. Sur le
   * vide : on commence un rectangle — c'est le geste que le §4.4 demande, celui
   * qui prend « heros et villageois melanges ».
   */
  private cliquerEnCommandement(pointeur: Phaser.Input.Pointer): void {
    // ⚠️ **Les deux scenes recoivent le meme clic.** Sans ce garde-fou,
    // choisir « Aux champs » dans le menu declenchait aussi le clic « sur le
    // vide » de l'arene juste derriere : le menu se refermait et un rectangle
    // partait. Ca ne se voit pas a la compilation, seulement en cliquant.
    if (this.souSLInterface(pointeur)) return;

    const point = this.cameras.main.getWorldPoint(pointeur.x, pointeur.y);
    const ajouter = pointeur.event.shiftKey;

    const hero = this.alliePres(point.x, point.y);
    const civil = hero ? null : this.villageoisPres(point.x, point.y);

    if (hero || civil) {
      if (!ajouter) this.commandement.effacer();
      if (hero) this.commandement.basculer(hero);
      else if (civil) this.commandement.basculerCivil(civil);
      this.ouvrirLeMenu(pointeur.x, pointeur.y);
      return;
    }

    // Le vide : on efface et on commence a tracer. Effacer tout de suite plutot
    // qu'au relachement donne un retour immediat au clic qui rate.
    this.events.emit("fermer-menu-ordres");
    this.rectangleDepart = new Phaser.Math.Vector2(point.x, point.y);
    this.rectangleCourant = new Phaser.Math.Vector2(point.x, point.y);
  }

  /** On relache : ce qui est dans le cadre est selectionne, et le menu s'ouvre. */
  private fermerLeRectangle(pointeur: Phaser.Input.Pointer): void {
    const depart = this.rectangleDepart;
    const arrivee = this.rectangleCourant;
    this.rectangleDepart = null;
    this.rectangleCourant = null;
    if (!depart || !arrivee) return;

    const largeur = Math.abs(arrivee.x - depart.x);
    const hauteur = Math.abs(arrivee.y - depart.y);
    // Un cadre de trois pixels, c'est un clic qui a bouge : il efface, il ne
    // selectionne pas.
    if (largeur < 8 && hauteur < 8) {
      this.commandement.effacer();
      return;
    }

    const nombre = this.commandement.selectionnerDans(
      { x: Math.min(depart.x, arrivee.x), y: Math.min(depart.y, arrivee.y), largeur, hauteur },
      this.village.habitants,
      this.hero ?? null,
      pointeur.event.shiftKey,
    );
    if (nombre === 0) {
      this.annoncer("Personne dans le cadre");
      return;
    }
    this.ouvrirLeMenu(pointeur.x, pointeur.y);
  }

  /**
   * Ce que le menu affiche, et ou.
   *
   * Il montre l'union des deux vocabulaires quand la selection est melangee, et
   * eteint ce que tout le monde fait deja (§4.4).
   */
  private ouvrirLeMenu(x: number, y: number): void {
    const heros = this.commandement.selectionnes;
    const civils = this.commandement.civilsSelectionnes;
    if (heros.length + civils.length === 0) {
      this.events.emit("fermer-menu-ordres");
      return;
    }

    const noms = [...heros.map((h) => h.personne.nom), ...civils.map((c) => c.nom)];
    const titre = noms.length === 1 ? noms[0]! : `${noms.length} selectionnes`;
    const sousTitre =
      noms.length === 1
        ? heros.length === 1
          ? heros[0]!.classe.nom
          : NOMS_METIER[civils[0]!.regles.metier]
        : noms.slice(0, 3).join(", ") + (noms.length > 3 ? "..." : "");

    const contenu: ContenuMenu = {
      x,
      y,
      titre,
      sousTitre,
      lignes: lignesDuMenu(this.commandement.populations, (id) => this.dejaFait(id, heros, civils)),
    };
    this.events.emit("menu-ordres", contenu);
  }

  /** Vrai quand toute la selection fait deja ca : la ligne s'eteint. */
  private dejaFait(id: TacheId, heros: Hero[], civils: Villageois[]): boolean {
    const def = tacheDef(id);
    if (!def) return false;
    if (def.metier) {
      const metiers = [
        ...civils.map((c) => c.regles.metier),
        ...heros.map((h) => h.travail),
      ];
      return metiers.length > 0 && metiers.every((m) => m === def.metier);
    }
    if (def.postureCivile) {
      return civils.length > 0 && civils.every((c) => c.regles.posture === def.postureCivile);
    }
    if (def.posture) {
      return heros.length > 0 && heros.every((h) => h.ordre.posture === def.posture);
    }
    // Deja a la cour : la ligne s'eteint plutot que de le reinscrire.
    if (id === "entrainer") {
      // ⚠️ `?.` rend `undefined`, pas `null` : sans la double negation, la
      // ligne s'eteignait des qu'il n'y avait pas de cour — donc toujours.
      return civils.length > 0 && civils.every((c) => Boolean(this.cour?.eleve(c.regles.id)));
    }
    return false;
  }

  /**
   * Le joueur a choisi une ligne du menu.
   *
   * ⚠️ **Chaque tache ne touche que ceux qui la comprennent.** Un rectangle
   * melange prend des heros et des villageois ; « Prudent » ne veut rien dire
   * pour un heros, « Agressif » rien pour un pecheur. Appliquer l'une a l'autre
   * population serait la facon la plus sure de rendre le rectangle inutilisable.
   */
  private appliquerTache(id: TacheId): void {
    const def = tacheDef(id);
    if (!def) return;
    const heros = this.commandement.selectionnes;
    const civils = this.commandement.civilsSelectionnes;

    if (def.metier) {
      for (const civil of civils) this.village.changerMetier(civil, def.metier);
      let touches = civils.length;

      // Un heros au travail (§4.4). Seuls les quatre postes de la carte lui
      // valent quelque chose : la forge, l'atelier et la tour sont des postes
      // d'habitant, et un heros n'y produirait rien.
      const poste = POSTES.find((p) => p.metier === def.metier);
      const refuses: Hero[] = [];
      for (const h of heros) {
        if (!poste) {
          refuses.push(h);
          continue;
        }
        h.travail = def.metier;
        h.protege = null;
        h.ordre = { ...h.ordre, ancre: { ...poste.position } };
        h.poste = null;
        touches++;
      }

      this.events.emit("fermer-menu-ordres");
      if (refuses.length > 0 && touches === 0) {
        this.annoncer("Ce poste-la est un poste d'habitant");
        return;
      }
      this.annoncer(`${touches} · ${def.libelle.toLowerCase()}`);
      return;
    }

    if (def.postureCivile) {
      for (const civil of civils) this.village.changerPosture(civil, def.postureCivile);
      this.annoncer(`${civils.length} · ${NOMS_POSTURE_CIVILE[def.postureCivile]}`);
      this.events.emit("fermer-menu-ordres");
      return;
    }

    if (def.posture) {
      // Lui donner une posture, c'est le rappeler au combat : sinon l'ancre du
      // poste le ramenerait travailler a l'image suivante.
      for (const h of heros) h.travail = null;
      if (heros.length > 0) this.ordonnerPosture(def.posture);
      this.events.emit("fermer-menu-ordres");
      return;
    }

    if (id === "suivre") {
      const moi = this.hero ?? null;
      if (!moi || !moi.estVivant) return;
      let touches = 0;
      for (const h of heros) h.travail = null;
      if (heros.length > 0) {
        touches += this.commandement.ancrer({ x: moi.x, y: moi.y }, moi, moi, this.sbires);
      }
      touches += this.commandement.ancrerCivils({ x: moi.x, y: moi.y }, moi);
      this.annoncer(`${touches} avec moi`);
      this.events.emit("fermer-menu-ordres");
      return;
    }

    if (id === "entrainer") {
      this.events.emit("fermer-menu-ordres");
      for (const civil of civils) this.inscrireALaCour(civil);
      return;
    }

    if (id === "rituel") {
      this.events.emit("fermer-menu-ordres");
      for (const civil of civils) this.celebrerLeRituel(civil);
      return;
    }

    if (id === "rompez") this.rompre();
  }

  /**
   * Le rituel de l'eglise : **sur, et cher** (DESIGN.md §4.1, §6).
   *
   * C'est la troisieme voie, et la seule qui ne tire rien : elle dit ce que la
   * personne porte, et l'eveille si elle porte quelque chose. On l'achete quand
   * on ne veut plus attendre — et l'argent vient du port (§4.18), donc elle se
   * paie en marchandises qu'on n'a pas gardees.
   */
  private celebrerLeRituel(villageois: Villageois): void {
    if (this.eglise.regles.niveau < NIVEAU_EGLISE_RITUEL) {
      this.events.emit(
        "annonce",
        `L'eglise doit etre de niveau ${NIVEAU_EGLISE_RITUEL} pour ce rituel`,
        "toi",
      );
      return;
    }
    if (!this.eglise.fonctionne) {
      this.events.emit("annonce", "L'eglise est a terre", "toi");
      return;
    }
    if (this.argent < PRIX_DU_RITUEL) {
      this.events.emit("annonce", `Le rituel coute ${PRIX_DU_RITUEL} pieces`, "toi");
      return;
    }

    this.argent -= PRIX_DU_RITUEL;
    const nom = villageois.nom;
    // ⚠️ **L'argent est pris dans tous les cas.** Le rituel est sur au sens ou
    // il ne tire rien : il **revele**. Neuf fois sur dix il revele qu'il n'y
    // avait rien, et c'est ce qui le rend cher a jouer plutot que cher a payer.
    if (!this.eveillerUnDon(villageois, "rituel")) {
      this.events.emit("annonce", `Le rituel ne trouve rien en ${nom}`, "village");
    }
  }

  /** Y a-t-il un morceau d'interface sous le pointeur ? */
  private souSLInterface(pointeur: Phaser.Input.Pointer): boolean {
    const ui = this.scene.get("ui");
    if (!ui?.input) return false;
    return ui.input.hitTestPointer(pointeur).length > 0;
  }

  /** L'habitant le plus proche du clic, s'il est assez pres pour etre vise. */
  private villageoisPres(x: number, y: number): Villageois | null {
    let meilleur: Villageois | null = null;
    let distance = 26;
    for (const civil of this.village.habitants) {
      if (!civil.regles.vivant || civil.etat === "abri") continue;
      const d = Phaser.Math.Distance.Between(x, y, civil.x, civil.y);
      if (d < distance) {
        distance = d;
        meilleur = civil;
      }
    }
    return meilleur;
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
    // Les habitants aussi : depuis le bloc 8, un villageois peut tenir un point
    // — et un villageois oublie sur un carrefour ne produit plus rien de la
    // partie. C'est exactement ce que *Rompez* existe pour eviter (§4.4).
    this.commandement.rompre(this.sbires, this.village?.habitants ?? []);
    // Et le travail avec : une affectation est un ordre comme un autre, et
    // *Rompez* est le bouton qui remet tout le monde au combat.
    for (const hero of this.heros) hero.travail = null;
    this.events.emit("fermer-menu-ordres");
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
      // Les emplacements qu'on achete (§4.13) : un cinquieme, un sixieme.
      [K.SIX, K.NUMPAD_SIX],
      [K.SEVEN, K.NUMPAD_SEVEN],
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
      // Tab : le mode commandement (§4.4, bloc 8). Elle est seule de son
      // espece — toutes les autres touches font quelque chose, celle-ci change
      // ce que fait la souris.
      [K.TAB, () => this.basculerCommandement()],
      [K.ESC, () => this.rompre()],
      // La cloche : une touche, tout le monde rentre. C'est l'outil de
      // l'urgence — quand une horde tombe, on n'a pas le temps de changer sept
      // postures une par une (DESIGN.md §4.18).
      [K.B, () => this.sonnerLaCloche()],
      // Le tableau du village. L'ecran reste degage : tout ce qui n'est pas la
      // population se lit ici, a la demande.
      [K.F, () => this.events.emit("basculer-village")],
      // Batir : une touche par construction, et la meme touche referme. Deux
      // suffisent aujourd'hui — l'arsenal complet est au jalon 7.
      [K.G, () => this.basculerConstruction("palissade")],
      [K.H, () => this.basculerConstruction("tour")],
      [K.J, () => this.basculerConstruction("champ")],
      [K.K, () => this.basculerConstruction("porte")],
      [K.L, () => this.basculerConstruction("maison")],
      // La cour d'entrainement : le batiment du bloc 9, un seul par village.
      [K.U, () => this.basculerConstruction("cour")],
      [K.N, () => this.basculerConstruction("douve")],
      [K.T, () => this.basculerTour()],
      // L'eglise : une seule touche pour les deux gestes qu'on peut lui faire —
      // la monter d'un niveau, ou relancer son chantier quand elle est a terre.
      // Ce sont deux actions exclusives, jamais disponibles en meme temps.
      [K.Y, () => this.oeuvrerALEglise()],
      // Le port, meme principe : relever le chantier, ou ouvrir la vente quand
      // un navire est a quai. Les deux gestes ne coexistent jamais (§4.18).
      [K.P, () => this.oeuvrerAuPort()],
    ];
    for (const [code, action] of ordres) {
      clavier.addKey(code).on("down", () => {
        if (this.termine || this.saisieEnCours) return;
        // ⚠️ Le mode d'amenagement **est** une pause, et il faut donc pouvoir y
        // travailler : G, H et J y choisissent quoi poser. Tout le reste — la
        // cloche, les postures, l'eglise, le port — reste bloque, comme sous
        // n'importe quelle autre pause.
        if (this.enPause && !(this.amenagement && CHOISIR_QUOI_POSER.includes(code))) return;
        // Toute autre touche lache l'outil de construction : on choisit une
        // palissade, on sonne la cloche, et le fantome ne doit plus etre la.
        if (!CHOISIR_QUOI_POSER.includes(code)) this.lacherLOutil();
        action();
      });
    }

    // `M` vit hors de la boucle ci-dessus : elle doit s'entendre **pendant** la
    // pause qu'elle a elle-meme posee, sinon on ne pourrait plus refermer.
    clavier.addKey(K.M).on("down", () => this.basculerAmenagement());

    // « ? » deplie la ligne des touches (§4.10). On l'ecoute par son caractere
    // et non par un code : le « ? » demande Maj sur AZERTY comme sur QWERTY, et
    // ce n'est pas la meme touche physique des deux cotes.
    clavier.on("keydown", (e: KeyboardEvent) => {
      if (this.termine || this.saisieEnCours) return;
      if (e.key === "?") this.events.emit("basculer-aide");
    });

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
    // Celui qu'on lache ressort de l'eau : l'IA n'y entre jamais, et ses limites
    // redeviennent celles du monde, qui le ramenent sur la plage.
    this.quitterLEau(this.hero);
    this.indexIncarne = index;
    cible.estIncarne = true;
    this.ouvrirLaMerAuHero(cible);
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
    if (this.termine) return;
    // ⚠️ **La carte cuit avant tout le reste, et meme en pause** (§4.29). Une
    // pause — le mode d'amenagement, le panneau de la rencontre — est du temps
    // offert : c'est exactement quand il faut peindre. Le budget est de six
    // millisemes, il ne mange donc jamais une image.
    this.avancerLaCarte();
    // Le mode d'amenagement est une pause, mais il n'est pas mort : l'apercu
    // doit suivre la souris, sinon on poserait a l'aveugle (§4.24).
    if (this.amenagement) {
      this.majFantome();
      return;
    }
    if (this.enPause) return;

    this.musique.maj(delta, this.cycle.phase === "nuit");
    this.majEau(delta);
    this.majChemins();

    // Un reglage de propriete, pas un redessin : c'est tout ce que coute la mer
    // qui bouge (§4.17 regle 3).
    this.mer.deriver(delta);
    this.maisons.teinter(this.time.now);

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
    this.survivants.mettreAJour();
    this.caches.mettreAJour(this.time.now);
    this.eglise.majorer(delta, this.time.now);
    // Le port est un acquis du village, pas de celui qui passe devant : aucun
    // navire n'accoste tant qu'on n'a pas donne sa parole (§4.29).
    if (!this.enMarche) this.majPort(delta);
    this.village.majorer(delta);
    this.recolterALaMain(delta);
    this.travaillerLesHeros(delta);
    this.majFantome();
    this.constructions.majorer(this.time.now);
    // Les chantiers n'avancent que du travail des batisseurs (§4.20, bloc 8) :
    // sans charpentier affecte, l'echafaudage reste dresse.
    this.constructions.avancerLesChantiers(this.village.batisseursALOeuvre, delta);
    this.majPortes();
    // Les champs poussent une fois par seconde, jamais par image (§4.17).
    this.champs.majorer(this.time.now, this.village.auTravail("fermier"), this.village.stocks);
    // Tant qu'on marche, les nuits n'ont pas commence : on ne defend pas encore
    // ce village, et il n'est pas attaque pour nous faire une demonstration
    // (§4.29). C'est l'installation qui lance le compte a rebours.
    if (this.enMarche) this.majMarche();
    else this.fairePartirLesVagues();
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
    this.commandement.suivreLesProteges(sbires, this.village?.habitants ?? []);

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

    // Les habitants, meme marque et meme trait : le §4.4 ne veut qu'un seul
    // vocabulaire a l'ecran comme dans le code (bloc 8).
    for (const civil of this.village?.habitants ?? []) {
      if (!civil.regles.vivant || civil.etat === "abri") continue;

      if (this.commandement.estSelectionneCivil(civil)) {
        g.lineStyle(1, 0x5ec8f0, 0.9);
        g.strokeEllipse(civil.x, civil.y + 5, 16, 8);
      }
      const ancre = civil.ancre;
      if (!ancre) continue;
      const couleur = civil.suit ? 0x7ee0a0 : 0x5ec8f0;
      g.lineStyle(1, couleur, 0.2);
      g.lineBetween(civil.x, civil.y, ancre.x, ancre.y);
      g.lineStyle(1, couleur, 0.6);
      g.strokeCircle(ancre.x, ancre.y, 6);
    }

    // Le rectangle en cours de trace. Il vit ici et non dans l'interface : il
    // se mesure en coordonnees du monde, donc il doit suivre la camera.
    const depart = this.rectangleDepart;
    const arrivee = this.rectangleCourant;
    if (depart && arrivee) {
      g.lineStyle(1, 0x5ec8f0, 0.85);
      g.strokeRect(
        Math.min(depart.x, arrivee.x),
        Math.min(depart.y, arrivee.y),
        Math.abs(arrivee.x - depart.x),
        Math.abs(arrivee.y - depart.y),
      );
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
      this.events.emit("annonce", `${personne.nom} s'effondre — son coeur a lache`, "village");
      this.tomber(hero);
      return;
    }

    const rupture = verifierRupture(personne, maintenant, this.rng);
    if (!rupture) return;

    this.events.emit(
      "annonce",
      `je craque — ${NOMS_RUPTURE[rupture]} : ${EFFETS_RUPTURE[rupture].hero}`,
      "heros",
      personne.nom,
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

  // -------------------------------------------------------------- l'eau

  /**
   * Le heros incarne est le seul a pouvoir entrer dans l'eau (§4.30) : ses
   * limites s'etendent jusqu'au bord ouest du monde. L'abysse le rejette
   * (`majEau`), la mer le noie — c'est la regle, pas un mur.
   */
  private ouvrirLaMerAuHero(hero: Hero): void {
    // L'eau ne l'arrete plus : c'est le collisionneur du terrain qui le laisse
    // passer (`dresserLeTerrain`), lui seul. L'abysse le rejette (`majEau`),
    // la mer le noie — c'est la regle, pas un mur.
    this.noyade.reinitialiser();
    this.dernierePositionTenable = { x: hero.x, y: hero.y };
  }

  /** Un heros qu'on ne pilote plus ressort de l'eau. */
  private quitterLEau(hero: Hero): void {
    hero.facteurEau = 1;
    hero.enfoncer(0);
    this.noyade.reinitialiser();
  }

  /**
   * L'eau profonde et la roche arretent les corps (§4.6, §4.29).
   *
   * Un corps statique invisible par **plage de cases** — une rangee de roche
   * d'un seul tenant fait un seul corps, pas trente — pour la mer, les lacs,
   * l'eboulis et la roche. Le haut-fond ne compte pas : on y patauge. Le heros
   * incarne, et lui seul, traverse l'eau (§4.30 : « personne ne nage », mais
   * on s'enfonce) ; personne ne traverse la roche.
   */
  private dresserLeTerrain(): void {
    this.obstaclesDEau = this.physics.add.staticGroup();
    this.obstaclesDeRoche = this.physics.add.staticGroup();
    const eau: Terrain[] = ["mer", "abysse"];
    const roche: Terrain[] = ["eboulis", "roche"];
    for (const [sols, groupe] of [
      [eau, this.obstaclesDEau],
      [roche, this.obstaclesDeRoche],
    ] as const) {
      for (let ligne = 0; ligne < LIGNES; ligne++) {
        let debut = -1;
        for (let colonne = 0; colonne <= COLONNES; colonne++) {
          const c = colonne < COLONNES ? this.grille.case(colonne, ligne) : null;
          const dedans = c !== null && sols.includes(c.terrain);
          if (dedans && debut < 0) debut = colonne;
          if (!dedans && debut >= 0) {
            const largeur = (colonne - debut) * CASE;
            const zone = this.add.zone(debut * CASE + largeur / 2, ligne * CASE + CASE / 2, largeur, CASE);
            groupe.add(zone);
            debut = -1;
          }
        }
      }
    }
    const saufLeHerosIncarne: Phaser.Types.Physics.Arcade.ArcadePhysicsCallback = (a, b) => {
      const hero = (a instanceof Hero ? a : b) as Hero;
      return !hero.estIncarne;
    };
    this.physics.add.collider(this.equipe, this.obstaclesDEau, undefined, saufLeHerosIncarne);
    this.physics.add.collider(this.ennemis, this.obstaclesDEau);
    this.physics.add.collider(this.equipe, this.obstaclesDeRoche);
    this.physics.add.collider(this.ennemis, this.obstaclesDeRoche);
    // Les habitants sont branches plus tard, avec les autres collisions du
    // village : il n'existe pas encore ici.
  }

  /**
   * Ce qu'un monstre traverse a pied : la terre ferme, sauf une douve en eau.
   * Les murs passent — il les frappe. Une douve devant un pont-levis passe
   * aussi, tablier leve ou non : c'est la qu'il vient attendre, et c'est la
   * qu'il faut le voir (§4.20).
   */
  private passeUnMonstre(c: Case): boolean {
    // Le haut-fond passe : on y patauge, et c'est par la qu'un monstre
    // contourne un mur qui s'arrete au sable — d'ou les murs dans l'eau.
    if (c.terrain !== "sable" && c.terrain !== "herbe" && c.terrain !== "sous-bois" && c.terrain !== "haut-fond") return false;
    if (c.occupation !== "douve-eau") return true;
    const douve = this.constructions.en(c.colonne * CASE + CASE / 2, c.ligne * CASE + CASE / 2);
    return douve !== null && (douve.pont || douve.enjambee);
  }

  /** Le champ de directions vers l'eglise : a la pose, jamais par image (§4.17). */
  private recalculerLeParcours(): void {
    this.parcours.recalculer(EGLISE, (c) => this.passeUnMonstre(c));
  }

  /**
   * L'eau qui noie, a chaque image hors pause (§4.30, tranche le 9 septembre
   * 2026) : on s'enfonce (vitesse et image), une bulle previent en entrant
   * dans la mer, une seconde insiste, et au bout de trois secondes on se noie.
   * Jamais une mort surprise — et ressortir remet tout a zero.
   */
  /**
   * Les chemins qui s'usent (§4.24) : un pas de plus la ou chaque habitant et
   * chaque heros vient d'entrer. Par battements de 250 ms — un marcheur
   * traverse une case en plus longtemps que ca, et trente marcheurs reveilles
   * a chaque image se sentiraient.
   */
  private majChemins(): void {
    const maintenant = this.time.now;
    if (maintenant < this.prochainBattementChemins) return;
    this.prochainBattementChemins = maintenant + ArenaScene.PERIODE_CHEMINS;
    const jour = this.cycle.jour;
    const marcher = (marcheur: { x: number; y: number }) => {
      const changement = this.chemins.passer(marcheur, marcheur.x, marcheur.y, jour);
      if (!changement) return;
      const { cas } = changement;
      this.coucheChemins.redessiner(cas, this.chemins.autour(cas.x, cas.y, RAYON_VOISINAGE), jour);
    };
    for (const villageois of this.village.habitants) {
      if (villageois.regles.vivant && villageois.etat !== "abri") marcher(villageois);
    }
    for (const hero of this.heros) {
      if (hero.etat !== "mort") marcher(hero);
    }
  }

  private majEau(delta: number): void {
    const hero = this.hero;
    if (!hero || hero.etat === "mort") return;

    const profondeur = profondeurDe(terrainEn(hero.x, hero.y));
    if (profondeur === "abysse") {
      // Personne ne nage : le large n'est pas praticable, on y est rejete.
      hero.setPosition(this.dernierePositionTenable.x, this.dernierePositionTenable.y);
      hero.setVelocity(0, 0);
    } else {
      this.dernierePositionTenable = { x: hero.x, y: hero.y };
    }
    // Une douve seche ralentit comme un haut-fond ; l'eau du monde garde la main si elle est pire.
    hero.facteurEau = Math.min(
      REGLAGES_EAU.vitesse[profondeur === "abysse" ? "mer" : profondeur],
      this.constructions.ralentissement(hero.x, hero.y),
    );
    hero.enfoncer(REGLAGES_EAU.enfoncement[profondeur]);

    const bulle = this.noyade.avancer(delta, profondeur);
    if (bulle === "coule") {
      this.flotter(hero.x, hero.y - 26, "JE COULE !", "#ff8a7a");
      this.events.emit("annonce", "je coule — trois secondes et je me noie", "heros", hero.personne.nom);
    } else if (bulle === "se-noie") {
      this.flotter(hero.x, hero.y - 26, "JE ME NOIE !", "#ff3b30");
    } else if (bulle === "noye") {
      this.events.emit("annonce", "s'est noye", "heros", hero.personne.nom);
      hero.facteurEau = 1;
      hero.enfoncer(0);
      hero.pv = 0;
      this.tomber(hero);
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
    // Le champ des humains suit le heros, par battements : c'est lui qui fait
    // sortir par la porte ceux qui nous courent apres (§4.29).
    this.suivreLeHeroDesHumains();

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

    // Faute de heros a portee de vue, il marche sur son cap : l'eglise (§4.22),
    // ou la maison qu'il vient piller (§4.24). Quand elle tombe, il en prend une
    // autre ; quand il n'y en a plus, l'eglise.
    if (e.cibleMaison && (!e.cibleMaison.debout || !e.cibleMaison.active)) {
      e.cibleMaison = this.maisons.laPlusProcheDebout(e.x, e.y);
    }
    const proie = this.cibleDe(e);
    // ⚠️ **Un humain enrage n'a pas de cap, il a quelqu'un** (§4.29) : il ne
    // marche pas sur l'eglise, c'est la sienne. Il vient pour nous, et il nous
    // suit meme hors de vue — on ne sème pas un village qu'on a refuse en lui
    // tournant le dos.
    const capHumain = e.humain ? (this.hero.etat !== "mort" ? this.hero : null) : null;
    // ⚠️ **Une bete de camp garde son terrain** (§4.31, decision d'Angelos).
    // Des qu'elle s'en est trop ecartee, son cap redevient le camp, meme si
    // elle voit encore quelqu'un : c'est ce qui permet d'aller voir une grosse
    // cache, de juger, et de faire demi-tour.
    const rentre =
      e.campeSur &&
      Phaser.Math.Distance.Between(e.x, e.y, e.campeSur.x, e.campeSur.y) > e.rayonDuCamp
        ? e.campeSur
        : null;
    const cible = rentre ?? proie ?? capHumain ?? e.cibleMaison?.centre ?? EGLISE;
    let angle = Phaser.Math.Angle.Between(e.x, e.y, cible.x, cible.y);
    // Un lac, un massif, une douve en eau entre lui et son cap : il suit le
    // parcours (§4.29) au lieu de buter dedans. Une proie en vue se poursuit
    // droit. La ligne se verifie tous les quarts de seconde, pas par image.
    if (e.humain) {
      // ⚠️ **Un humain ne defonce pas le mur de son propre village.** Vu en
      // jeu : ils partaient droit sur nous et restaient colles a leur enceinte,
      // a trois pixels pres pendant des secondes. Ils prennent donc la porte —
      // le champ des humains, celui-la meme qui amene celui qui vient parler.
      if (maintenant >= e.ligneVerifieeA + 250) {
        e.ligneVerifieeA = maintenant;
        e.ligneLibre = this.parcours.ligneLibre(e, cible, (c) => this.passeUnVillageois(c));
      }
      if (!e.ligneLibre) {
        const suivre = this.cheminDesHumains?.direction(e.x, e.y);
        if (suivre) angle = Math.atan2(suivre.y, suivre.x);
      }
    } else if (!proie) {
      if (maintenant >= e.ligneVerifieeA + 250) {
        e.ligneVerifieeA = maintenant;
        e.ligneLibre = this.parcours.ligneLibre(e, cible, (c) => this.passeUnMonstre(c));
      }
      if (!e.ligneLibre) {
        const suivre = this.parcours.direction(e.x, e.y);
        if (suivre) angle = Math.atan2(suivre.y, suivre.x);
      }
    }
    // Une douve en eau devant lui : il ne nage pas, il cherche la porte (§4.20).
    angle = this.constructions.contournement(e.x, e.y, angle) ?? angle;
    orienter(e, Math.cos(angle), SEUIL_REGARD_PIXELS);
    // Une douve seche sous lui : il la franchit lentement, a decouvert.
    const fosse = this.constructions.ralentissement(e.x, e.y);
    if (fosse < 1) e.ralentir(120, fosse);

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
    // L'occupant d'une tour est **sur** elle : sa profondeur est celle de la
    // tour, pas celle de ses pieds, qui sont plus haut dans l'image que le pied
    // de la tour et le feraient passer derriere.
    const perche = this.tourDuHero?.occupant ?? null;
    for (const hero of this.heros) hero.setDepth(hero === perche ? this.tourDuHero!.depth + 1 : hero.y);
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
      // A la mine, la pierre vient avec le minerai, dans la meme part que pour
      // un mineur (§4.20, bloc 7b).
      const sous = SOUS_PRODUIT[poste.metier];
      if (sous) this.village.recolter(sous.ressource, quantite * sous.part);

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
   * Les heros qu'on a mis au travail (DESIGN.md §4.4, bloc 8).
   *
   * Trois regles, et elles viennent toutes du design :
   *
   * - **il produit beaucoup plus vite qu'un habitant** : exactement la cadence
   *   du joueur a la main, ses degats divises par huit, par seconde. ~98 par
   *   minute contre 6 pour un habitant de rang F — un heros aux champs abat le
   *   travail de quinze villageois ;
   * - **seulement le jour**, comme la recolte a la main. La nuit, il lache son
   *   poste et redevient un combattant ;
   * - **ca le fatigue** : du stress par minute travaillee, donc un heros moins
   *   bon quand la nuit tombe (§4.23). C'est ce qui empeche « tout le monde a
   *   la peche ».
   *
   * ⚠️ **Le repli des 20 % passe avant tout**, sans exception : `piloter()`
   * traite le repli en premier et ignore l'ancre. Un heros au travail qui prend
   * un mauvais coup rentre, et son poste l'attend.
   *
   * L'affectation se pose comme une **ancre** plutot que comme un deplacement a
   * part : c'est ce qui lui laisse l'IA complete — il se defend contre ce qui
   * l'approche, il revient a son poste quand la pression retombe, et il n'y a
   * pas une deuxieme logique de deplacement a deboguer (§4.4).
   */
  private travaillerLesHeros(delta: number): void {
    const jour = this.cycle.phase === "jour";

    for (const hero of this.heros) {
      if (!hero.travail) continue;
      if (hero.estIncarne || hero.etat === "mort") continue;

      const poste = POSTES.find((p) => p.metier === hero.travail);
      if (!poste) continue;

      if (!jour) {
        // La nuit, il lache son poste — mais il garde son affectation : elle
        // le reprend a l'aube, sans que le joueur ait a la redonner.
        if (hero.ordre.ancre) hero.ordre = { ...hero.ordre, ancre: null };
        continue;
      }

      // L'ancre est reposee a chaque image : `Rompez` et un ordre du joueur la
      // retirent, et c'est `travail` qui reste la source de verite.
      const ancre = hero.ordre.ancre;
      if (!ancre) hero.ordre = { ...hero.ordre, ancre: { ...poste.position } };
      else if (!hero.protege) {
        ancre.x = poste.position.x;
        ancre.y = poste.position.y;
      }

      if (hero.etat !== "combat") continue;
      const distance = Phaser.Math.Distance.Between(
        hero.x,
        hero.y,
        poste.position.x,
        poste.position.y,
      );
      if (distance > RAYON_RECOLTE) continue;

      // Le fermier ne recolte rien : il fait **pousser** (§4.18). Un heros aux
      // champs travaille donc la terre, comme le joueur a la main.
      if (poste.metier === "fermier") {
        this.champs.travaillerALaMain(hero.x, hero.y, (hero.degats * delta) / 1000 / 400, this.village.stocks);
      } else {
        const ressource = RECOLTE_DU_POSTE[poste.metier as keyof typeof RECOLTE_DU_POSTE];
        if (!ressource) continue;
        const quantite = (hero.degats * delta) / 1000 / 8;
        this.village.recolter(ressource, quantite);
        const sous = SOUS_PRODUIT[poste.metier];
        if (sous) this.village.recolter(sous.ressource, quantite * sous.part);
      }

      // La fatigue. Le §4.4 parle d'une humeur « epuise » ; c'est du **stress**
      // et pas un etat de plus — la lethargie appartient a la faim et se
      // soignerait en mangeant, ce qu'un heros ne fait pas.
      monterStress(hero.personne, (STRESS_DU_TRAVAIL * delta) / 60000);

      if (this.time.now >= this.prochainGesteTravail) {
        declencher(hero.pose, hero, "attaque", this.time.now, poste.position);
        this.prochainGesteTravail = this.time.now + 420;
      }
    }
  }

  // ------------------------------------------- le village arme (§4.18, bloc 9)

  /**
   * Une journee passe a la cour d'entrainement (DESIGN.md §4.18, bloc 9).
   *
   * ⚠️ **Rien n'avance sans instructeur** : un milicien doit se tenir dans la
   * cour. C'est ce qui fait qu'armer son village le ralentit **deux fois** —
   * l'eleve ne produit rien, et l'instructeur non plus.
   *
   * Au bout de deux journees, on sait : soit il portait un don et il
   * transcende, soit il n'avait rien — et il a quand meme gagne du niveau de
   * combat. **L'essai n'est jamais perdu**, c'est ce qui rend la cour jouable
   * malgre un porteur sur dix.
   */
  private passerLaJourneeDeLaCour(): void {
    const centre = this.cour?.centre;
    if (!centre) return;

    const instructeur = this.village.aUnInstructeur;
    if (!instructeur) {
      if (this.cour.eleves.length > 0) {
        this.events.emit("annonce", "Personne n'instruit a la cour — il faut un milicien", "village");
      }
      return;
    }

    for (const id of this.cour.passerLaJournee(true)) {
      const villageois = this.village.parId(id);
      if (!villageois) continue;

      const resultat = entrainer(villageois.regles.personne.don);
      villageois.regles.niveau += resultat.niveauxGagnes;

      if (resultat.don) {
        this.eveillerUnDon(villageois, "entrainement");
        continue;
      }
      this.events.emit(
        "annonce",
        `${villageois.nom} sort de la cour — aucun don, mais +${resultat.niveauxGagnes} en combat`,
        "village",
      );
    }
  }

  /**
   * Inscrire quelqu'un a la cour (DESIGN.md §4.18, bloc 9).
   *
   * Il y va, il ne produit plus, et deux journees plus tard **on sait**. Le
   * refus dit ce qui cloche, comme partout ailleurs.
   */
  inscrireALaCour(villageois: Villageois): boolean {
    if (!this.cour?.existe) {
      this.events.emit("annonce", "Il faut d'abord batir une cour d'entrainement", "toi");
      return false;
    }
    if (this.cour.eleve(villageois.regles.id)) {
      this.events.emit("annonce", `${villageois.nom} s'exerce deja`, "toi");
      return false;
    }
    if (!this.cour.inscrire(villageois.regles.id)) return false;

    // Il quitte son poste : on ne produit pas en s'entrainant (§4.18).
    villageois.ancre = null;
    villageois.suit = null;
    this.events.emit(
      "annonce",
      `${villageois.nom} s'exerce — ${REGLAGES_COUR.journeesDeFormation} journees, et on saura`,
      "village",
    );
    return true;
  }


  /**
   * **Un villageois s'eveille, et devient un heros** (DESIGN.md §4.18, §4.1,
   * §4.29 — bloc 9).
   *
   * C'est la seule source de heros du jeu. On ne devient pas heros a l'usure :
   * on **nait avec un don**, un habitant sur dix en porte un, et personne ne le
   * sait avant qu'il s'eveille. Trois voies l'eveillent — le danger de mort
   * (gratuit, au hasard), l'entrainement (du temps de production), et le rituel
   * de l'eglise (sur et cher).
   *
   * ⚠️ **Il garde sa `Personne`, litteralement le meme objet** : son nom, ses
   * traits gagnes en travaillant, son stress, ses sequelles, son visage. C'est
   * ce que le §4.29 promet — « chaque heros aura eu un nom d'habitant, un
   * metier ». Lui en fabriquer une neuve ferait un heros tombe du ciel, et tout
   * le bloc 9 ne servirait plus a rien.
   *
   * Et c'est **lui** qui reveille les ordres, les formations, les postures,
   * l'IA de repli et l'experience de groupe : tous ces systemes tournent a vide
   * depuis le 5.5, faute d'un deuxieme heros sur qui tourner.
   *
   * @returns le heros ne, ou `null` si rien ne s'est eveille
   */
  eveillerUnDon(villageois: Villageois, voie: VoieDuReveil): Hero | null {
    const personne = villageois.regles.personne;
    const don = personne.don;
    if (!don || don.eveille) return null;

    // L'effectif : dix dehors, le reste en garnison (§4.15). La garnison n'est
    // pas codee, donc on refuse au-dela — et on le dit, plutot que d'eveiller
    // un don qui ne donnerait aucun heros.
    if (this.heros.filter((h) => h.etat !== "mort").length >= EFFECTIF_MAXIMUM) {
      this.events.emit(
        "annonce",
        `${personne.nom} a un don, mais l'equipe est au complet (${EFFECTIF_MAXIMUM})`,
        "village",
      );
      return null;
    }

    const x = villageois.x;
    const y = villageois.y;
    const nom = personne.nom;
    personne.don = { ...don, eveille: true };

    // L'habitant quitte le village **avant** que le heros ne paraisse : deux
    // corps au meme endroit se pousseraient l'un l'autre.
    this.village.retirer(villageois);

    const hero = new Hero(this, x, y, CLASSES[don.classe], undefined, [], personne);
    this.heros.push(hero);
    this.equipe.add(hero);
    // Il arrive au combat, pas au travail : c'est un heros, pas un poste.
    hero.ordre = { posture: "temporiser", ancre: null };

    this.effetCercle(x, y, 52, don.majeur ? 0xe0c060 : 0x7ee0a0);
    this.flotter(x, y - 30, don.majeur ? "DON MAJEUR" : "Un don s'eveille", "#e0c060");
    this.events.emit(
      "annonce",
      don.majeur
        ? `${nom} transcende ${NOMS_VOIE[voie]} — un don MAJEUR de ${CLASSES[don.classe].nom}`
        : `${nom} transcende ${NOMS_VOIE[voie]} — ${CLASSES[don.classe].nom}`,
      "village",
    );
    return hero;
  }

  /**
   * Le danger de mort reveille les dons — **la voie noble** (DESIGN.md §4.1).
   *
   * Gratuite, au hasard, et elle ne se declenche que sous le seuil des 20 % :
   * les heros naissent des pires moments de la partie. On ne peut pas la
   * provoquer, parce qu'un habitant mort ne revient pas.
   *
   * Appele a chaque coup encaisse par un habitant, jamais par image.
   */
  private guetterLeReveil(villageois: Villageois): void {
    const personne = villageois.regles.personne;
    if (!personne.don || personne.don.eveille) return;
    const part = villageois.regles.pv / Math.max(1, combatDe(villageois.regles).pvMax);
    if (!reveilParLeDanger(personne.don, part, this.rng)) return;
    this.eveillerUnDon(villageois, "danger");
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
      "toi",
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
      this.events.emit("annonce", "On ne batit pas en pleine nuit", "toi");
      return;
    }

    // Choisir quoi poser lache ce qu'on tenait : on ne peut pas avoir une tour
    // en main et une palissade au bout du curseur.
    this.deplacee = null;

    this.enConstruction = this.enConstruction === type ? null : type;
    if (!this.enConstruction) {
      this.fantome.setVisible(false);
      return;
    }

    if (type === "maison") {
      this.fantome.setTexture(cleMaison(0)).setOrigin(0).setVisible(true);
      this.events.emit(
        "annonce",
        `Maison — ${REGLAGES_MAISONS.coutBois} bois · clic pour batir, ou sur une ruine pour la relever`,
        "toi",
      );
      return;
    }

    if (type === "cour") {
      // Le fantome se cale par son coin bas-gauche, comme le batiment pose :
      // sinon l'apercu et la pose ne tombent pas au meme endroit.
      this.fantome.setTexture(CLE_COUR).setOrigin(0, 1).setVisible(true);
      this.events.emit(
        "annonce",
        `Cour d'entrainement — ${REGLAGES_COUR.coutBois} bois et ${REGLAGES_COUR.coutMinerai} minerai · une seule par village`,
        "toi",
      );
      return;
    }

    if (type === "champ") {
      this.fantome.setTexture(CLES_CHAMP.jeune).setOrigin(0.5, 0.5).setVisible(true);
      this.events.emit(
        "annonce",
        `Champ — ${REGLAGES_CHAMPS.coutBois} bois · clic pour semer, pres des champs`,
        "toi",
      );
      return;
    }

    const def = CONSTRUCTIONS[type];
    this.fantome.setTexture(textureDe(def)).setOrigin(0.5, origineDe(def)).setVisible(true);
    if (type === "douve") {
      this.events.emit(
        "annonce",
        `Douve — ${coutLisible(def)} · clic pour creuser ; sur une douve, ${coutEnClair(REMPLISSAGE.cout)} : l'eau, depuis la mer`,
        "toi",
      );
      return;
    }
    const fer = def.paliers?.fer.cout;
    const renfort = fer ? ` · sur un segment en bois, ${coutEnClair(fer)} : fer` : "";
    const pont = type === "porte" ? ` · sur une porte devant une douve en eau, ${coutEnClair(PONT_LEVIS.cout)} : pont-levis` : "";
    this.events.emit("annonce", `${def.nom} — ${coutLisible(def)} · clic pour poser${renfort}${pont}`, "toi");
  }

  /**
   * La cloche (§4.18, §4.20) : tout le monde rentre, **et les portes se
   * ferment**. Plus personne ne passe, dans un sens comme dans l'autre, jusqu'a
   * l'aube — c'est le dilemme des portes, et il commence ici.
   */
  /** On lache l'outil de construction : plus de fantome au bout du curseur. */
  private lacherLOutil(): void {
    if (!this.enConstruction) return;
    this.enConstruction = null;
    this.fantome.setVisible(false).clearTint();
  }

  private sonnerLaCloche(): void {
    this.lacherLOutil();
    // La cloche d'un village qu'on n'a pas encore accepte ne nous obeit pas.
    if (this.enMarche) return;
    this.village.sonnerCloche();
    // Les portes ne se ferment pas a la seconde : elles attendent que plus
    // personne ne soit dehors (§4.20, bloc 7b). C'est `majPortes` qui regarde.
    if (this.clocheSonnee || this.constructions.portes.length === 0) return;
    this.clocheSonnee = true;
    this.events.emit(
      "annonce",
      this.village.dehors.length > 0 ? "Les portes se fermeront quand tout le monde sera rentre" : "Les portes se ferment",
      "guet",
    );
  }

  /**
   * Les portes, une fois par image (§4.20, bloc 7b) : la cloche les ferme
   * quand plus personne n'est dehors ; fermees, elles s'ouvrent devant les
   * notres si aucun monstre n'est pres ; et chaque battant avance.
   */
  private majPortes(): void {
    const maintenant = this.time.now;
    if (this.clocheSonnee && !this.constructions.portesFermees && this.village.dehors.length === 0) {
      this.constructions.fermerLesPortes(maintenant);
      this.events.emit("annonce", "Tout le monde est rentre — les portes se ferment", "guet");
    }
    const demandeurs = this.constructions.portesFermees
      ? [...this.heros.filter((h) => h.etat !== "mort"), ...this.village.dehors]
      : [];
    this.constructions.majPortes(
      maintenant,
      demandeurs,
      (x, y, rayon) => this.ennemiLePlusProche(x, y, rayon) !== null,
    );
  }

  // ------------------------------------------------- le mode d'amenagement

  /**
   * La touche `M` (DESIGN.md §4.24).
   *
   * **Le jour seulement**, comme tout ce qui se batit (§4.20) : le mode met le
   * jeu en pause, donc l'ouvrir en pleine nuit serait une reparation gratuite au
   * milieu d'un assaut — on gelerait la horde pour refaire son mur.
   *
   * Le temps passe dedans est **rendu** a la fermeture, exactement comme la
   * pause hors focus : sans ca, toute la nuit frapperait dans l'image de la
   * reprise.
   */
  private basculerAmenagement(): void {
    if (this.termine || this.saisieEnCours) return;

    if (this.amenagement) {
      this.fermerAmenagement();
      return;
    }

    // On n'amenage pas le village des autres (§4.29) : tant qu'on n'a pas
    // donne sa parole, on n'est qu'un etranger devant un mur.
    if (this.enMarche) {
      this.events.emit("annonce", "Ce village n'est pas le tien.", "toi");
      return;
    }

    if (this.cycle.phase !== "jour") {
      this.events.emit("annonce", "On n'amenage pas en pleine nuit", "toi");
      return;
    }
    // Une autre pause tient deja le jeu (choix de competence, fiche, hors
    // focus) : on ne se met pas en travers de qui rendra la main.
    if (this.enPause) return;

    this.amenagement = true;
    this.enPause = true;
    this.debutAmenagement = this.time.now;
    this.physics.pause();
    this.anims.pauseAll();
    this.montrerLaGrille(true);
    this.events.emit("annonce", "Amenagement — G/H/J/K pour choisir, clic droit pour demolir", "toi");
  }

  private fermerAmenagement(): void {
    this.amenagement = false;
    this.deplacee = null;
    this.enConstruction = null;
    this.fantome.setVisible(false).clearTint();
    this.montrerLaGrille(false);
    this.decalerLeTemps(this.time.now - this.debutAmenagement);
    this.physics.resume();
    this.anims.resumeAll();
    this.enPause = false;
    this.events.emit("annonce", "Le village reprend son souffle", "toi");
  }

  /**
   * La grille, dessinee **une seule fois** pour toute la partie (§4.17 regle 3).
   *
   * On la cache et on la remontre ensuite : redessiner quelques milliers de
   * segments a chaque ouverture serait exactement ce que le §4.17 interdit.
   */
  private montrerLaGrille(visible: boolean): void {
    if (!this.calqueGrille) {
      const g = this.add.graphics().setDepth(-450);
      g.lineStyle(1, 0x000000, 0.16);
      for (let colonne = 0; colonne <= COLONNES; colonne++) {
        g.lineBetween(colonne * CASE, 0, colonne * CASE, LIGNES * CASE);
      }
      for (let ligne = 0; ligne <= LIGNES; ligne++) {
        g.lineBetween(0, ligne * CASE, COLONNES * CASE, ligne * CASE);
      }
      g.strokePath();
      this.calqueGrille = g;
    }
    this.calqueGrille.setVisible(visible);
  }

  /**
   * Le clic gauche en mode amenagement : poser, prendre, ou reposer.
   *
   * Trois gestes sur un seul bouton, et ils ne se marchent jamais dessus : si un
   * outil est choisi on **pose**, sinon on **prend** ce qui est sous le curseur,
   * et si on tient deja quelque chose on le **repose**. C'est ce que fait tout
   * jeu de construction, et ca evite un mode de plus a expliquer.
   */
  private cliquerEnAmenagement(x: number, y: number, demolir: boolean): void {
    const centre = this.grille.centreDe(x, y);

    if (demolir) {
      this.deplacee = null;
      // ⚠️ Une demi-case, pas une entiere : on aimante deja sur le centre, et
      // un rayon d'une case demolissait le mur d'a cote en cliquant du vide.
      const cible = this.constructions.laPlusProche(centre.x, centre.y, CASE / 2);
      if (!cible) {
        // Tout se demolit sauf l'eglise (§4.24) : une maison, ou ses decombres.
        const maison = this.maisons.en(x, y);
        if (!maison) {
          this.events.emit("annonce", "Rien a demolir ici", "toi");
          return;
        }
        const rendu = this.maisons.demolir(maison, this.village.stocks);
        this.events.emit("annonce", `${maison.nom} demolie — ${rendu > 0 ? `${rendu} bois` : "rien"} recupere`, "toi");
        return;
      }
      if (cible === this.tourDuHero) this.tourDuHero = null;
      const nom = cible.def.nom;
      const rendu = this.constructions.demolir(cible, this.village.stocks);
      const lisible = Object.entries(rendu)
        .filter(([, montant]) => (montant ?? 0) > 0)
        .map(([ressource, montant]) => `${montant} ${ressource}`)
        .join(", ");
      this.events.emit("annonce", `${nom} demolie — ${lisible || "rien"} recupere`, "toi");
      return;
    }

    // On tient quelque chose : on le repose.
    if (this.deplacee) {
      const posee =
        this.deplacee instanceof Maison
          ? this.maisons.deplacer(this.deplacee, x, y)
          : this.constructions.deplacer(this.deplacee, centre.x, centre.y);
      if (!posee) {
        this.events.emit("annonce", "On ne peut pas la poser la", "toi");
        return;
      }
      this.deplacee = null;
      this.fantome.setVisible(false);
      return;
    }

    // Un outil est choisi : on pose, avec le meme code et les memes refus qu'en
    // plein jeu — c'est la meme pose, pas une deuxieme.
    if (this.enConstruction) {
      this.batirIci(centre.x, centre.y);
      return;
    }

    // Rien en main, rien a poser : on prend ce qui est sous le curseur.
    const prise = this.constructions.laPlusProche(centre.x, centre.y, CASE / 2);
    if (prise && prise.def.id === "douve") {
      this.events.emit("annonce", "Une douve ne se deplace pas : comble-la (clic droit)", "toi");
      return;
    }
    if (!prise) {
      // Une maison se prend aussi, debout ou en ruine : le village se range.
      const maison = this.maisons.en(x, y);
      if (!maison) return;
      this.deplacee = maison;
      this.fantome.setTexture(maison.texture.key).setOrigin(0).setVisible(true);
      this.events.emit("annonce", `${maison.nom} en main — clic pour la reposer`, "toi");
      return;
    }
    if (prise === this.tourDuHero) this.tourDuHero = null;
    this.deplacee = prise;
    this.fantome
      .setTexture(
        textureDe(prise.def, {
          matiere: prise.matiere,
          masque: prise.masque,
          position: prise.position,
          pontLevis: prise.pontLevis,
        }),
      )
      .setOrigin(0.5, origineDe(prise.def))
      .setVisible(true);
    this.events.emit("annonce", `${prise.def.nom} en main — clic pour la reposer`, "toi");
  }

  /**
   * L'apercu suit la souris, aimante sur la case.
   *
   * Vert : c'est posable. Rouge : ca ne l'est pas — terrain qui ne porte pas,
   * case deja prise, trop pres de l'eglise ou du port, ou pas de quoi payer. Le
   * joueur n'a jamais a deviner pourquoi son clic ne fait rien.
   */
  private majFantome(): void {
    if (!this.enConstruction && !this.deplacee) return;

    const pointeur = this.input.activePointer;
    const monde = this.cameras.main.getWorldPoint(pointeur.x, pointeur.y);
    const centre = this.grille.centreDe(monde.x, monde.y);

    // La cour : son emprise se cale comme celle d'une maison, coin haut-gauche.
    if (this.enConstruction === "cour") {
      const possible = this.cour.refus(monde.x, monde.y, this.village.stocks) === null;
      // Son origine est son coin **bas**-gauche : le pied tombe donc une case
      // plus bas que la case visee, exactement comme a la pose.
      this.fantome.setPosition(
        this.grille.colonneDe(monde.x) * CASE,
        (this.grille.ligneDe(monde.y) + EMPRISE_COUR.lignes) * CASE,
      );
      this.fantome.setTint(possible ? 0x7ee0a0 : 0xff6b5a);
      return;
    }

    // Une maison : l'emprise de 2 x 2 se cale sur la case visee, coin haut-gauche.
    if (this.deplacee instanceof Maison || this.enConstruction === "maison") {
      const possible =
        this.deplacee instanceof Maison
          ? this.maisons.peutAller(this.deplacee, monde.x, monde.y)
          : this.maisons.possible(monde.x, monde.y, this.village.stocks);
      this.fantome.setPosition(this.grille.colonneDe(monde.x) * CASE, this.grille.ligneDe(monde.y) * CASE);
      this.fantome.setTint(possible ? 0x7ee0a0 : 0xff6b5a);
      return;
    }

    // Deplacer ne coute rien : on ne juge donc que le terrain et la place, sans
    // regarder les stocks (§4.24). Les juger ferait refuser un deplacement
    // gratuit faute d'argent, ce qui n'aurait aucun sens.
    const possible = this.deplacee
      ? this.grille.constructible(centre.x, centre.y, true) &&
        !this.grille.aProximite(
          centre.x,
          centre.y,
          CASES_LIBRES_AUTOUR_DES_BATIMENTS,
          IMPOSENT_UNE_DISTANCE,
        )
      : this.enConstruction === "champ"
        ? this.champs.possible(centre.x, centre.y, this.village.stocks)
        : this.constructions.possible(
            centre.x,
            centre.y,
            this.enConstruction as TypeConstruction,
            this.village.stocks,
          );

    this.fantome.setPosition(centre.x, centre.y);
    this.fantome.setTint(possible ? 0x7ee0a0 : 0xff6b5a);

    // L'apercu montre deja ses raccords : un mur qu'on s'apprete a poser entre
    // deux autres apparait relie aux deux (§4.30). La cle ne change qu'au
    // passage d'une case a l'autre — Phaser ne fait rien si elle est la meme.
    const tenue = this.deplacee instanceof Construction ? this.deplacee : null;
    const def =
      tenue?.def ??
      (this.enConstruction !== "champ" ? CONSTRUCTIONS[this.enConstruction as TypeConstruction] : null);
    if (def && def.id !== "tour") {
      const douve = def.id === "douve";
      const masque = douve ? this.constructions.masqueDouveEn(centre.x, centre.y) : this.constructions.masqueEn(centre.x, centre.y);
      this.fantome.setTexture(
        textureDe(def, {
          matiere: tenue?.matiere ?? "bois",
          masque,
          position: tenue?.position ?? (this.constructions.portesFermees ? "fermee" : "ouverte"),
          pontLevis: tenue?.pontLevis ?? false,
          douve: "seche",
        }),
      );
    }
  }

  private batirIci(x: number, y: number): boolean {
    if (!this.enConstruction) return false;

    // L'outil douve sur une douve : on la remplit d'eau (§4.20, bloc 7b).
    if (this.enConstruction === "douve") {
      const existante = this.constructions.en(x, y);
      if (existante && existante.def.id === "douve") {
        const refus = this.constructions.refusRemplissage(existante, this.village.stocks);
        if (refus) this.events.emit("annonce", refus, "toi");
        else if (this.constructions.remplir(existante, this.village.stocks)) {
          eclatImpact(this, existante.x, existante.y, 0x8fb0c8);
          this.events.emit("annonce", "La douve se remplit — plus rien ne la franchit", "toi");
        }
        return true;
      }
    }

    // L'outil porte sur une porte qui a une douve en eau devant elle : elle
    // devient un pont-levis (§4.20, bloc 7b). Sinon, comme le mur, on renforce.
    if (this.enConstruction === "porte") {
      const existante = this.constructions.en(x, y);
      if (existante && existante.battant && !existante.pontLevis && !this.constructions.refusPontLevis(existante, this.village.stocks)) {
        this.constructions.convertirEnPontLevis(existante, this.village.stocks);
        eclatImpact(this, existante.x, existante.y, 0xd8c48a);
        this.events.emit("annonce", "Pont-levis — ferme, plus aucun passage ; ouvert, le tablier couvre la douve", "toi");
        return true;
      }
    }

    // L'outil palissade ou porte sur un segment qui existe deja : on le
    // renforce au lieu de le poser — segment par segment (§4.20).
    if (this.enConstruction === "palissade" || this.enConstruction === "porte") {
      const existante = this.constructions.en(x, y);
      if (existante && existante.def.id === this.enConstruction) {
        const refus = this.constructions.refusAmelioration(existante, this.village.stocks);
        const matiere = refus ? null : this.constructions.ameliorer(existante, this.village.stocks, this.time.now);
        if (matiere) {
          eclatImpact(this, existante.x, existante.y, 0xd8c48a);
          this.events.emit("annonce", `${existante.def.nom} passee au ${matiere} — ${existante.pvMax} PV`, "toi");
        } else {
          this.events.emit("annonce", refus ?? "Impossible de renforcer ici", "toi");
        }
        return true;
      }
    }

    const pose =
      this.enConstruction === "champ"
        ? this.champs.semer(x, y, this.village.stocks)
        : this.enConstruction === "maison"
          ? this.maisons.batir(x, y, this.village.stocks)
          : this.enConstruction === "cour"
            ? this.cour.batir(x, y, this.village.stocks)
            : this.constructions.batir(x, y, this.enConstruction, this.village.stocks, this.time.now);

    if (!pose) {
      // Le refus dit ce qui cloche, comme celui de l'eglise (§4.22, §4.24). Un
      // clic qui ne fait rien sans expliquer pourquoi est la facon la plus sure
      // de rendre une interface de pose penible.
      const raison =
        this.enConstruction === "champ"
          ? "Impossible de semer ici"
          : this.enConstruction === "maison"
            ? (this.maisons.refus(x, y, this.village.stocks) ?? "Impossible de batir ici")
            : this.enConstruction === "cour"
              ? (this.cour.refus(x, y, this.village.stocks) ?? "Impossible de batir ici")
              : (this.constructions.refus(x, y, this.enConstruction, this.village.stocks) ??
                "Impossible de poser ici");
      this.events.emit("annonce", raison, "toi");
      return true;
    }

    eclatImpact(this, pose.x, pose.y, 0xd8c48a);
    if (this.enConstruction === "cour") {
      this.events.emit(
        "annonce",
        "La cour est ouverte — il lui faut un milicien pour instruire",
        "toi",
      );
      return true;
    }
    // Un chantier attend des bras, et il faut le dire une fois : sans
    // charpentier affecte, l'echafaudage reste dresse pour toujours et le
    // joueur croirait a un bug (§4.20, bloc 8).
    this.prevenirQuIlFautUnBatisseur();
    return true;
  }

  /**
   * « Il faudra quelqu'un pour le monter. »
   *
   * Dit **une seule fois par journee**, et seulement quand personne n'est
   * charpentier : une annonce a chaque segment pose serait un bruit de fond.
   */
  private prevenirQuIlFautUnBatisseur(): void {
    if (this.batisseurAnnonce === this.cycle.jour) return;
    const batisseurs = this.village.habitants.filter(
      (v) => v.regles.vivant && v.regles.metier === "charpentier",
    );
    if (batisseurs.length > 0) return;
    this.batisseurAnnonce = this.cycle.jour;
    this.events.emit(
      "annonce",
      "Rien ne se monte sans charpentier — Tab, puis « A l'atelier »",
      "toi",
    );
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
      this.events.emit("annonce", "Aucune tour libre a portee", "toi");
      return;
    }

    tour.occupant = hero;
    this.tourDuHero = tour;
    hero.setPosition(tour.x, tour.y + OCCUPANT_TOUR_Y);
    hero.setVelocity(0, 0);
    // Intouchable au corps a corps : ce n'est pas une invulnerabilite, c'est de
    // la hauteur. Les monstres s'en prendront a la tour.
    hero.body!.enable = false;
    hero.porteeTour = tour.def.bonusPortee;
    hero.setDepth(tour.depth + 1);
    this.events.emit("annonce", `${hero.personne.nom} monte en tour — T pour descendre`, "toi");
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
    this.events.emit("annonce", "La tour cede !", "guet");
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
    // Il ne reste que de la terre pietinee la ou le ble poussait.
    abimerLeSol(this.carte, champ.x, champ.y, "terre", 18);
    this.events.emit("annonce", "Un champ est ravage", "guet");
  }

  private cognerConstruction(e: Ennemi, construction: Construction): void {
    if (!e.active || this.termine || this.enPause) return;
    // Un trou ne se frappe pas : devant une douve en eau, on cherche la porte.
    if (construction.def.indestructible) return;
    if (!e.peutFrapper(this.time.now)) return;

    e.marquerCoup(this.time.now);
    declencher(e.pose, e, "attaque", this.time.now, construction);
    eclatImpact(this, construction.x, construction.y, 0xbfae8a);

    if (!this.constructions.blesser(construction, e.degats, this.time.now)) return;

    poufMort(this, construction.x, construction.y, 0xbfae8a);
    secousse(this, "fort");
    // La ou un mur tombe, la terre est retournee : le sol se souvient.
    abimerLeSol(this.carte, construction.x, construction.y, "terre", 20);
    if (construction.occupant) this.ejecterDeLaTour(construction);
    else this.constructions.detruire(construction);
  }

  /**
   * Les monstres cognent une maison (§4.24). Meme forme que
   * `cognerConstruction` : la cadence du monstre sert de garde.
   */
  private cognerMaison(e: Ennemi, maison: Maison): void {
    if (!e.active || this.termine || this.enPause || !maison.debout) return;
    if (!e.peutFrapper(this.time.now)) return;

    e.marquerCoup(this.time.now);
    declencher(e.pose, e, "attaque", this.time.now, maison);
    const centre = maison.centre;
    eclatImpact(this, centre.x, centre.y, 0xbfae8a);

    if (!this.maisons.blesser(maison, e.degats, this.time.now)) return;

    poufMort(this, centre.x, centre.y, 0xbfae8a);
    secousse(this, "fort");
    abimerLeSol(this.carte, centre.x, centre.y, "brule", 26);
    this.events.emit("annonce", `Une ${maison.nom.toLowerCase()} est tombee — L pour la relever`, "village");
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
        this.events.emit("annonce", `Le chantier avance — ${part}%`, "eglise");
        return;
      }
      if (!this.eglise.lancerRelevement(this.village.stocks)) {
        this.events.emit(
          "annonce",
          `Il faut ${lireCout(RELEVEMENT.cout)} pour relever l'eglise`,
          "toi",
        );
      }
      return;
    }

    const contexte = this.contexteMontee;
    const verdict = this.eglise.regles.peutMonter(contexte);

    if (!verdict.possible) {
      const vise = (this.eglise.niveau + 1) as 2 | 3 | 4;
      this.events.emit("annonce", `Eglise : il manque ${lireBlocages(verdict.manque, vise)}`, "toi");
      return;
    }

    // L'argent se preleve ici : `monter` ne recoit qu'un nombre et n'a aucun
    // moyen d'ecrire dans la bourse du village (§4.8).
    const vise = (this.eglise.niveau + 1) as NiveauEglise;
    this.eglise.regles.monter(contexte);
    this.argent -= coutEnArgent(vise);
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
      // Il a survecu au coup : c'est exactement la ou un don se reveille
      // (§4.1, bloc 9). La voie noble ne se declenche qu'au bord de la mort.
      this.guetterLeReveil(villageois);
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

  /**
   * Le Misericordieux baisse son arme (DESIGN.md §4.23, §4.12).
   *
   * **C'est le premier trait du jeu qui desobeit**, et une desobeissance
   * s'annonce : un heros qui s'arrete sans prevenir serait vecu comme un bug.
   * On le dit une fois par partie — le journal n'a pas a repeter un coup sur
   * trois pendant toute une bagarre.
   */
  private refuserDeFrapper(auteur: Hero, e: Ennemi): void {
    this.flotter(e.x, e.y - 16, "il ne peut pas", "#9db3c4");
    if (this.refusDeFrapperAnnonce) return;
    this.refusDeFrapperAnnonce = true;
    this.events.emit(
      "annonce",
      `${auteur.personne.nom} ne se resout pas a frapper quelqu'un`,
      "toi",
    );
  }

  /**
   * Ce que laisse un mort (DESIGN.md §4.29, §4.8).
   *
   * Une bete vaut son experience en menue monnaie ; un humain laisse ce qu'il
   * avait sur lui. ⚠️ **L'argent reste un entier** : on garde la monnaie d'une
   * mort a l'autre plutot que d'arrondir chaque cadavre (`core/butin.ts`), et
   * on ne l'affiche que quand une piece entiere tombe — un « +0 » a chaque
   * fonceur ne dirait rien.
   */
  private ramasserLeButin(e: Ennemi): void {
    const gain = e.humain ? REGLAGES_BUTIN.orDUnHumain : orDUneBete(e.xpDonnee);
    const bourse = encaisser(this.resteDeButin, gain);
    this.resteDeButin = bourse.reste;
    if (bourse.pieces <= 0) return;
    this.argent += bourse.pieces;
    this.flotter(e.x, e.y - 20, `+${bourse.pieces}`, "#c99a3a");
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
    // ⚠️ **Les deux traits qui regardent qui est en face passent ici, et nulle
    // part ailleurs** (§4.23) : c'est le seul point ou tout ce qui blesse un
    // ennemi se rejoint — le coup au contact, la fleche, la zone, la chaine
    // d'eclairs. Les poser dans `frapper` aurait laisse la moitie des degats du
    // jeu passer a cote.
    if (e.humain) {
      const mods = auteur.personne.mods;
      if (mods.refuseDeFrapperUnHumain && this.rng.next() < PART_DE_COUPS_REFUSES) {
        this.refuserDeFrapper(auteur, e);
        return;
      }
      degats = Math.max(1, Math.round(degats * mods.degatsContreHumain));
    }
    this.musique.combat();
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

    // L'or, comme l'XP, va a celui qui a tue (§4.29, 20 septembre 2026).
    this.ramasserLeButin(e);
    if (e.humain) this.humainsEnFace = Math.max(0, this.humainsEnFace - 1);

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
    this.anims.pauseAll();
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
      `${hero.personne.nom} — choisis une competence`,
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

    if (this.modeChoix === "remplacement") {
      const nouvelle = this.competenceEnAttente;
      this.competenceEnAttente = null;
      this.modeChoix = "competence";
      if (!nouvelle) {
        this.terminerChoix();
        return;
      }
      if (id === ID_EMPLACEMENT) {
        this.argent -= prixDuProchainEmplacement(hero.emplacements) ?? 0;
        hero.emplacements += 1;
        this.flotter(hero.x, hero.y - 30, `EMPLACEMENT ${hero.emplacements}`, "#f0c419");
      } else {
        const oubliee = competenceParId(id);
        hero.oublier(id);
        if (oubliee) {
          this.events.emit("annonce", `j'oublie ${oubliee.nom} pour ${nouvelle.nom}`, "heros", hero.personne.nom);
        }
      }
      this.apprendreEtContinuer(hero, nouvelle);
      return;
    }

    const def = competenceParId(id);
    if (!def) {
      this.terminerChoix();
      return;
    }

    // Quatre actives au plus (§4.13) : une cinquieme demande une place. On
    // achete un emplacement, ou on en oublie une ; la fusion (§4.25) viendra
    // avec les builds.
    if (demandeUnePlace(def, hero.competences, hero.emplacements)) {
      this.modeChoix = "remplacement";
      this.competenceEnAttente = def;
      this.events.emit(
        "choix",
        "PLUS DE PLACE",
        `${def.nom} demande un emplacement — laquelle oublier ?`,
        propositionsDeRemplacement(hero.competences, hero.emplacements, this.argent),
      );
      return;
    }

    this.apprendreEtContinuer(hero, def);
  }

  /** Apprend la competence, offre le niveau du Veteran, et ouvre l'evolution s'il y en a une. */
  private apprendreEtContinuer(hero: Hero, def: CompetenceDef): void {
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
    this.reprendreLeJeu();
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
    // Le cratere du §4.21 : le meteore l'ecrit dans le sol, et il y reste.
    abimerLeSol(this.carte, cible.x, cible.y, "cratere", 34);
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
    const px = Phaser.Math.Clamp(x, PRATICABLE.x + marge, PRATICABLE.x + PRATICABLE.largeur - marge);
    const py = Phaser.Math.Clamp(y, PRATICABLE.y + marge, PRATICABLE.y + PRATICABLE.hauteur - marge);
    if (estTerreFerme(px, py)) return new Phaser.Math.Vector2(px, py);
    // Dans l'eau ou dans la roche : la case de terre ferme la plus proche, en
    // cercles de plus en plus larges. Douze cases au plus — au-dela, on reste
    // ou l'on est.
    const c0 = this.grille.colonneDe(px);
    const l0 = this.grille.ligneDe(py);
    for (let rayon = 1; rayon <= 12; rayon++) {
      let meilleure: { x: number; y: number; d: number } | null = null;
      for (let dl = -rayon; dl <= rayon; dl++) {
        for (let dc = -rayon; dc <= rayon; dc++) {
          if (Math.max(Math.abs(dc), Math.abs(dl)) !== rayon) continue;
          const centre = Grille.centreCase(c0 + dc, l0 + dl);
          if (!this.grille.dedans(c0 + dc, l0 + dl) || !estTerreFerme(centre.x, centre.y)) continue;
          const d = Math.hypot(centre.x - px, centre.y - py);
          if (!meilleure || d < meilleure.d) meilleure = { x: centre.x, y: centre.y, d };
        }
      }
      if (meilleure) return new Phaser.Math.Vector2(meilleure.x, meilleure.y);
    }
    return new Phaser.Math.Vector2(px, py);
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
  /**
   * Le seul point d'entree de la discussion (DESIGN.md §4.10).
   *
   * La voix par defaut est **le village** : c'est la source la plus frequente,
   * et une annonce sans voix explicite parle forcement de ce qui se passe ici.
   * Le jour, lui, n'est jamais passe par l'appelant — il est lu du cycle, sinon
   * cent-vingt emetteurs auraient a le connaitre pour rien.
   */
  private consignerAuJournal(message: string, voix: Voix = "village", qui = ""): void {
    this.journal.ajouter(message, voix, this.cycle.jour, qui);
  }

  private majCycle(delta: number): void {
    // ⚠️ **Le temps ne commence qu'a l'installation** (§4.29) : pendant la
    // marche le cycle est a l'arret, et tout ce qui pend a lui avec — la nuit,
    // la porte, l'appel d'un survivant. On garde le ciel, pour qu'il ait la
    // couleur du jour, et rien d'autre.
    const bascule = this.cycle.avancer(this.enMarche ? 0 : delta);

    if (bascule === "crepuscule") this.tomberLaNuit();
    else if (bascule === "aube") this.leverLeJour();

    if (!this.enMarche) {
      this.regarderLaPorte();
      this.regarderLHorizon();
    }
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
    // Celui qui attend encore n'a pas attendu la nuit (§4.18). Celui qui suit
    // deja reste : l'abandonner au milieu du trajet serait arbitraire.
    this.survivants.auCrepuscule();

    const nuit = this.cycle.nuit;
    this.resteDeLaNuit = this.effectifDeLaNuitIci(nuit);
    this.village.tomberLaNuit();

    this.fronts = frontsDeLaVague(nuit, this.rng.next());
    this.partPremierFront = repartition(this.fronts, this.rng.next());
    this.prochaineApparition = this.time.now;

    // ⚠️ **Le navire repart avant la nuit, pas au matin.** Vu en jouant : arrive
    // dans une journee calme, il restait a quai pendant tout l'assaut, et l'on
    // pouvait commercer tranquillement pendant que le village se faisait
    // manger. Un navire qui n'accoste que quand c'est calme n'a aucune raison
    // de rester quand ca ne l'est plus (§4.18).
    if (this.port.navireAQuai) this.port.appareiller(this);

    const ou = this.fronts.map((f) => NOMS_FRONT[f]).join(" et ");
    this.events.emit("annonce", `Nuit ${nuit} — ils arrivent ${ou}`, "guet");
    // Un moment qui compte, et le dernier calme avant longtemps (§4.28).
    this.enregistrer();
  }

  private leverLeJour(): void {
    // Ce qui restait de l'effectif ne poursuit pas la journee : la nuit est
    // finie, ceux qui sont encore debout finissent la leur.
    this.resteDeLaNuit = 0;
    // Les portes se rouvrent : on ressort travailler (§4.20).
    this.clocheSonnee = false;
    if (this.constructions.portesFermees) this.constructions.ouvrirLesPortes(this.time.now);
    this.village.seLever(this.cycle.jour);
    // Les chemins palissent d'un cran, et ceux qu'on a oublies quatre journees s'effacent.
    this.chemins.seLever(this.cycle.jour);
    this.coucheChemins.toutRedessiner(this.chemins.visibles, this.cycle.jour);
    this.passerLaJourneeDesHeros();
    this.passerLaJourneeDeLaCour();
    this.programmerHorde();
    this.events.emit("annonce", `Jour ${this.cycle.jour} — le soleil se leve`, "village");
    // ⚠️ **Au matin**, pas dans la nuit. Le §4.18 veut qu'on **decouvre** le mort
    // ou la breche, sans jamais voir qui l'a fait — un coupable nomme serait un
    // probleme resolu. La nuit qui s'acheve est celle de la journee precedente.
    this.reglerLaNuitDesFous(this.cycle.jour - 1);

    // Le marche bouge d'une journee a l'autre, et une voile decide **une fois
    // par jour** si elle veut venir. Le calme, lui, ne decide que du moment :
    // sans ce tirage unique, un village calme verrait un navire par seconde.
    this.port.regles.passerLaJournee(this.rng);
    this.navireAttendu = this.port.debout && unNavireVeutVenir(this.rng);
    // Plus personne ne venait : on redemande une fois par jour, la reputation a
    // pu remonter. Une seule fois, jamais par image — c'est un tirage, et le
    // rejouer chaque image consommerait la graine (§4.6).
    if (this.prochaineArriveeJournee === null) this.planifierLaProchaineArrivee();
    this.enregistrer();
  }

  // ------------------------------------------------------------- la porte

  /**
   * Quelqu'un se presente-t-il ce matin ? (DESIGN.md §4.18)
   *
   * Le rythme ne vient pas du hasard mais de **ce que vaut le village** : la
   * reputation, c'est la satisfaction moins ce que les morts recents coutent a
   * la rumeur. Un village qui souffre se vide et n'attire plus rien.
   */
  private regarderLaPorte(): void {
    if (this.prochaineArriveeJournee === null) return;
    if (this.termine || this.enPause || this.saisieEnCours) return;
    if (this.cycle.jour < this.prochaineArriveeJournee) return;

    // On ne frappe pas a la porte en pleine nuit, et pas non plus a la seconde
    // ou le soleil se leve : l'aube fait deja le repas, les etats, les exploits
    // et la sauvegarde. Il se presente **dans la matinee**, une minute plus
    // tard — assez pour qu'on voie son village avant qu'on vienne lui demander
    // de le partager.
    if (this.cycle.phase !== "jour" || this.cycle.part < 0.04) return;

    // Les noms deja portes partent avec : deux homonymes dans un village de six
    // rendent chaque annonce ambigue (vu en jouant, §4.18).
    this.arrivantALaPorte = creerArrivant(this.rng, this.cycle.jour, this.nomsPris());
    this.enPause = true;
    this.debutPause = this.time.now;
    this.physics.pause();
    this.anims.pauseAll();
    this.effacerDestination();
    this.events.emit("arrivant", this.arrivantALaPorte);
  }

  // --------------------------------------------------- les survivants (§4.18)

  /**
   * Quelqu'un appelle-t-il, quelque part au bord ? (DESIGN.md §4.18)
   *
   * **C'est la seule raison de sortir du village.** Jusqu'ici le jour ne servait
   * qu'a produire et a reparer, et tout se jouait autour de l'eglise.
   */
  private regarderLHorizon(): void {
    if (this.termine || this.enPause || this.saisieEnCours) return;
    if (this.survivants.present !== null) return;
    if (this.cycle.jour < this.prochainSurvivantJournee) return;
    // Il parait **le jour**, et il attend jusqu'au crepuscule. Pas dans la
    // premiere minute : l'aube fait deja le repas, les etats et la sauvegarde.
    if (this.cycle.phase !== "jour" || this.cycle.part < 0.06) return;

    const survivant = creerSurvivant(this.rng, this.cycle.jour, this.nomsPris());
    this.survivants.faireParaitre(survivant, ligneDApparition(survivant));
    this.planifierLeProchainSurvivant();
  }

  /**
   * Quand le prochain appellera.
   *
   * Meme reputation que la porte, **avec le plancher** du §4.18 : sous 25 la
   * porte se ferme pour de bon et les naissances n'existent pas avant le bloc 7.
   * Sans ce plancher, un village qui saigne n'aurait plus **aucune** voie de
   * peuplement — un cul-de-sac dont rien ne le sort.
   */
  private planifierLeProchainSurvivant(): void {
    const rumeur = reputation(
      this.village.satisfaction,
      this.village.memoireDesMorts,
      this.cycle.jour,
      this.village.memoireDesMortsEnChemin,
      REGLAGES_SURVIVANTS.partDeRumeurDUneMortEnChemin,
    );
    this.prochainSurvivantJournee = prochainSurvivant(
      delaiEntreArrivees(rumeur),
      this.cycle.jour,
      this.rng,
    );
  }

  /**
   * La meute, lachee autour de lui **au moment ou on le voit** (§4.18).
   *
   * ⚠️ **Le plafond de l'ecran passe avant le tirage** (§4.17 regle 1) : une
   * meute de 40 mange les deux tiers de la reserve de 60, et rien d'autre ne
   * doit pouvoir paraitre pendant qu'elle est debout. Si l'ecran est deja
   * charge, la meute est plus petite — jamais l'inverse.
   */
  private lacherLaMeute(x: number, y: number, combien: number, camp = false): void {
    const puissance = this.puissanceIci(this.cycle.jour);
    const place = MAX_ENNEMIS - this.ennemis.getLength();
    for (let i = 0; i < Math.min(combien, place); i++) {
      const archetype = choisirArchetype(puissance, this.rng.next());
      // En couronne autour de lui : ils le tenaient deja, ils ne surgissent pas
      // du bord de la carte comme une horde.
      const angle = this.rng.range(0, Math.PI * 2);
      const rayon = this.rng.range(40, 120);
      const e = new Ennemi(
        this,
        x + Math.cos(angle) * rayon,
        y + Math.sin(angle) * rayon,
        puissance,
        archetype,
      );
      // Une bete de camp ne s'eloigne pas de ce qu'elle garde (§4.31).
      if (camp) {
        e.campeSur = { x, y };
        e.rayonDuCamp = REGLAGES_CACHES.rayonDuCamp;
      }
      this.ennemis.add(e);
    }
  }

  /**
   * Il est arrive a l'eglise : **la porte se rejoue** (§4.10, §4.18).
   *
   * Meme fiche, meme mode, meme code qu'a la porte — il peut etre fou dans la
   * meme proportion. La seule difference tient en un champ : **son etat est
   * ecrit noir sur blanc**. La folie se devine, la maladie se lit.
   */
  private presenterLeSurvivant(sprite: SpriteSurvivant): void {
    this.survivantALEglise = sprite;
    this.enPause = true;
    this.debutPause = this.time.now;
    this.physics.pause();
    this.anims.pauseAll();
    this.effacerDestination();

    const etat = sprite.regles.etat;
    this.events.emit(
      "arrivant",
      sprite.regles.arrivant,
      etat === null ? undefined : ETAT_ANNONCE[etat],
      // ⚠️ **Sur la route, ce n'est pas un retour au village** : il n'y en a
      // pas, et c'est la question qu'on se pose tous les deux. La fiche change
      // donc de mots (§4.31) — « l'emmener avec toi », pas « le faire entrer ».
      this.enMarche ? "route" : "sauvetage",
    );
  }

  /**
   * Personne ne porte le prenom d'un autre, au premier matin.
   *
   * ⚠️ **Vu en jouant** : deux heros s'appelaient Aubin et Nine, comme deux des
   * trois villageois de depart. L'equipe se compose **avant** le village — elle
   * ne pouvait donc pas savoir. Plutot que de reordonner tout le demarrage (la
   * camera, le commandement et quatre recouvrements dependent de l'equipe), on
   * renomme **le villageois** : au moment ou ceci tourne, personne n'a encore vu
   * son nom.
   *
   * Sur une partie reprise, la sauvegarde repose les vrais noms par-dessus.
   */
  private demelerLesPrenoms(): void {
    const pris = this.heros.map((h) => h.personne.nom);
    for (const villageois of this.village.habitants) {
      if (!pris.includes(villageois.nom)) {
        pris.push(villageois.nom);
        continue;
      }
      villageois.personne.nom = prenomLibre(this.rng, pris);
      pris.push(villageois.personne.nom);
    }
  }

  /**
   * Tous les prenoms deja portes ici — **habitants et heros**.
   *
   * ⚠️ **Vu en jouant** : un survivant ramene s'appelait Anselme, comme un des
   * heros. On ne regardait que le village. Depuis que la barre de heros affiche
   * le nom (§4.10), deux Anselme rendent chaque annonce ambigue — et le §4.18
   * promet qu'on s'attache a ses gens, ce qui suppose de savoir de qui on parle.
   */
  private nomsPris(): string[] {
    return [
      ...this.village.habitants.map((v) => v.nom),
      ...this.heros.map((h) => h.personne.nom),
    ];
  }

  private planifierLaProchaineArrivee(): void {
    this.prochaineArriveeJournee = prochaineArrivee(
      reputation(this.village.satisfaction, this.village.memoireDesMorts, this.cycle.jour),
      this.cycle.jour,
      this.rng,
    );
  }

  /**
   * Le joueur a tranche.
   *
   * **Refuser ne coute rien d'autre que le bras qu'on n'aura pas** (§4.18) : pas
   * de malus de reputation. La prudence se paie deja d'elle-meme — une
   * production en moins, et une population qui n'atteint pas les six habitants
   * du niveau 2 de l'eglise.
   */
  private repondreALaPorte(accepte: boolean): void {
    // La meme fiche sert aux deux (§4.10), donc la meme reponse aussi : c'est
    // ici qu'on sait duquel des deux il s'agit.
    if (this.survivantALEglise !== null) {
      this.repondreAuSurvivant(accepte);
      return;
    }

    const arrivant = this.arrivantALaPorte;
    this.arrivantALaPorte = null;

    if (arrivant !== null) {
      if (accepte) {
        const villageois = this.village.accueillir(arrivant.personne, arrivant.metierPretendu);
        const fou = suivreSiFou(arrivant, villageois.regles.id, this.cycle.jour, this.rng);
        if (fou !== null) this.fous.push(fou);
        this.events.emit(
          "annonce",
          `${arrivant.personne.nom} entre au village — ${NOMS_METIER[arrivant.metierPretendu].toLowerCase()}`,
          "village",
        );
      } else {
        this.events.emit("annonce", `${arrivant.personne.nom} repart sur la route`, "village");
      }
    }

    this.planifierLaProchaineArrivee();
    this.reprendreLeJeu();
  }

  /**
   * On a risque sa peau pour lui, et on peut encore lui dire non (§4.18).
   *
   * ⚠️ **C'est dur, et c'est volontaire.** Sans la fiche, le survivant serait
   * une ressource gratuite qu'on ramasse et les fous n'auraient qu'une seule
   * porte d'entree. Avec elle, sortir devient un investissement qu'on peut
   * decider de ne pas honorer — et le joueur qui accepte tout ce qu'il a sauve,
   * par attachement, se fera avoir exactement comme celui qui ouvre sa porte a
   * tout le monde.
   *
   * **Refuser ne coute rien** : meme regle qu'a la porte, la prudence ne se
   * punit pas deux fois. Il repart, et la rumeur ne bouge pas.
   */
  private repondreAuSurvivant(accepte: boolean): void {
    const sprite = this.survivantALEglise;
    this.survivantALEglise = null;

    // ⚠️ **Sur la route, dire oui ne le fait pas entrer : il se leve et suit**
    // (§4.31). Il n'y a pas de village a lui ouvrir — c'est justement ce qu'on
    // cherche tous les deux. Il entrera le jour ou l'on s'installera, et sans
    // qu'on rejoue sa fiche : c'est ici qu'on l'a jugee.
    if (this.enMarche) {
      if (sprite !== null) {
        if (accepte) {
          sprite.etat = "suit";
          this.events.emit("annonce", `${sprite.nom} se leve et te suit`, "toi");
        } else {
          this.events.emit("annonce", `Tu le laisses ou il est`, "toi");
          this.survivants.retirer(sprite);
        }
      }
      this.reprendreLeJeu();
      return;
    }

    if (sprite !== null) {
      const { arrivant, etat } = sprite.regles;
      if (accepte) {
        const villageois = this.village.accueillir(arrivant.personne, arrivant.metierPretendu);
        // Ce qu'il porte entre avec lui. L'infection est **contagieuse entre
        // voisins de travail** (§4.23) : c'est le premier usage reel de la
        // contagion, ecrite au bloc 5 et que rien ne declenchait.
        if (etat !== null) contracterEtat(villageois.personne, etat);
        const fou = suivreSiFou(arrivant, villageois.regles.id, this.cycle.jour, this.rng);
        if (fou !== null) this.fous.push(fou);
        this.events.emit(
          "annonce",
          `${arrivant.personne.nom} est rentre avec toi — ${NOMS_METIER[arrivant.metierPretendu].toLowerCase()}`,
          "village",
        );
      } else {
        this.events.emit("annonce", `${arrivant.personne.nom} repart sur la route`, "village");
      }
    }

    this.survivants.retirer(sprite ?? undefined);
    this.reprendreLeJeu();
  }

  /**
   * Ce que la nuit a produit (DESIGN.md §4.18).
   *
   * Tout le tri est dans `core/arrivants.ts`, y compris la regle du groupe :
   * ici on ne fait qu'appliquer. C'est ce qui permet de tester « a trois, ils
   * frappent la meme nuit » sans lancer une partie de trois heures.
   */
  private reglerLaNuitDesFous(journee: number): void {
    if (journee < 1) return;

    const actes = actesDeLaNuit(this.fous, journee);
    if (actes.length === 0) return;

    if (actes.length >= REGLAGES_ARRIVEES.taillePourUnGroupe) {
      this.events.emit("annonce", "Cette nuit, plusieurs mains ont travaille ensemble", "village");
    }

    for (const { fou, acte } of actes) {
      this.executerLActe(fou, acte);
      // Le voleur part avec les stocks ; les autres restent, et personne ne
      // saura jamais que c'etaient eux.
      if (!replanifier(fou, journee, this.rng)) this.oublierLeFou(fou);
    }
  }

  private executerLActe(fou: Fou, acte: Acte): void {
    if (acte === "vol") return this.acteDeVol(fou);
    if (acte === "breche") return this.acteDeSabotage();
    if (acte === "meurtre") return this.acteDeMeurtre(fou);
    // L'incendie appartient au degre 3 mais attend les incendies du jalon 6
    // (§4.21) : rien ne le tire encore, et ce retour le dit au lieu de le taire.
  }

  private acteDeVol(fou: Fou): void {
    const voleur = this.village.parId(fou.id);
    let emporte = 0;
    for (const ressource of RESSOURCES) {
      const part = Math.floor(this.village.stocks[ressource] * REGLAGES_ARRIVEES.partVolee);
      this.village.stocks[ressource] -= part;
      emporte += part;
    }

    if (voleur !== null) this.village.retirer(voleur);
    this.events.emit(
      "annonce",
      emporte > 0
        ? `Les reserves ont ete videes dans la nuit — ${emporte} de perdu`
        : "Quelqu'un est parti dans la nuit",
      "guet",
    );
  }

  private acteDeSabotage(): void {
    // Un mur, jamais une tour : ouvrir une breche, c'est ouvrir un passage
    // (§4.18). Faire tomber une tour ferait tomber son occupant, donc tuerait —
    // ce qui est l'acte du degre au-dessus.
    const murs = this.constructions.toutes.filter((c) => !c.def.occupable && !c.def.indestructible);
    if (murs.length === 0) {
      this.events.emit("annonce", "Des outils ont disparu dans la nuit", "guet");
      return;
    }

    const mur = this.rng.pick(murs);
    poufMort(this, mur.x, mur.y, 0x9a8b74);
    this.constructions.detruire(mur);
    this.events.emit("annonce", "Une breche a ete ouverte dans la palissade", "guet");
  }

  private acteDeMeurtre(fou: Fou): void {
    const candidats = this.village.vivants.map((v) => v.regles.id);
    const cible = victimeDe(fou, candidats, this.fous, this.rng);
    if (cible === null) return;

    const victime = this.village.parId(cible);
    if (victime === null) return;

    // `tuer` annonce deja la mort, fait le deuil et met la satisfaction a jour.
    // On n'ajoute qu'une chose : que personne ne sait ce qui s'est passe.
    this.village.tuer(victime);
    this.events.emit("annonce", "On l'a trouve au matin. Personne n'a rien entendu", "guet");
  }

  // --------------------------------------------------------------- le port

  /**
   * Le port avance, et la voile guette le calme (DESIGN.md §4.18).
   *
   * Appelee une fois par image, et elle ne fait presque rien : deux
   * comparaisons de scalaires tant qu'aucun navire n'est attendu. Le §4.17
   * interdit de parcourir quoi que ce soit ici.
   */
  private majPort(delta: number): void {
    this.port.majorer(delta);

    if (!this.navireAttendu || !this.port.debout || this.port.navireAQuai) return;
    if (
      !calmePourUnNavire({
        phase: this.cycle.phase,
        monstresDebout: this.ennemis.getLength(),
        journeesDesMorts: this.village.memoireDesMorts,
        journee: this.cycle.jour,
      })
    ) {
      return;
    }

    // Il ne vient qu'une fois par journee : le tirage a eu lieu a l'aube, le
    // calme ne decide que du moment.
    this.navireAttendu = false;
    this.port.accoster(this);
  }

  /**
   * On lui vend quelque chose.
   *
   * Toute la regle est dans `core/port.ts` — y compris le fait que **vendre fait
   * baisser le cours**. La scene ne fait qu'encaisser et annoncer.
   */
  private vendreAuNavire(ressource: Ressource, quantite: number): void {
    if (this.termine) return;

    const vente = this.port.regles.vendre(ressource, quantite, this.village.stocks);
    if (vente.pieces <= 0) {
      this.events.emit("annonce", `Pas assez de ${NOMS_RESSOURCE[ressource].toLowerCase()} a vendre`, "toi");
      return;
    }

    this.argent += vente.pieces;
    this.events.emit(
      "annonce",
      `${vente.unites} ${NOMS_RESSOURCE[ressource].toLowerCase()} vendus — ${vente.pieces} pieces`,
      "port",
    );
  }

  /**
   * La touche du port : relever le chantier, ou ouvrir la vente.
   *
   * Une seule touche pour les deux gestes qu'on peut lui faire, comme `Y` pour
   * l'eglise : ils ne sont jamais disponibles en meme temps.
   */
  private oeuvrerAuPort(): void {
    const hero = this.hero;
    if (!hero) return;

    if (!this.port.debout) {
      if (this.port.regles.etat === "chantier") {
        this.events.emit(
          "annonce",
          `Le port est en chantier — ${Math.round(this.port.regles.partChantier * 100)}%`,
          "port",
        );
        return;
      }
      if (!this.port.aPortee(hero.x, hero.y)) {
        this.events.emit("annonce", "Il faut etre au port, sur la plage a l'ouest", "toi");
        return;
      }
      if (!this.port.lancerLeChantier(this.village.stocks)) {
        this.events.emit("annonce", `Le port demande ${BatimentPort.coutLisible()}`, "toi");
      }
      return;
    }

    if (!this.port.navireAQuai) {
      this.events.emit("annonce", "Aucun navire a quai — il en vient quand le village est calme", "toi");
      return;
    }
    if (!this.port.aPortee(hero.x, hero.y)) {
      this.events.emit("annonce", "Trop loin du port pour commercer", "toi");
      return;
    }
    this.events.emit("basculer-port");
  }

  /** Ce que le panneau de vente a besoin de savoir, une fois par image. */
  get etatPort(): EtatPortAffiche {
    const hero = this.hero;
    return {
      ouvert: this.port.debout,
      navireAQuai: this.port.navireAQuai,
      aPortee: hero ? this.port.aPortee(hero.x, hero.y) : false,
      argent: this.argent,
      stocks: this.village.stocks,
      cours: this.port.regles.cours,
      joursDeVivres: this.village.joursDeVivres,
    };
  }

  private oublierLeFou(fou: Fou): void {
    const index = this.fous.indexOf(fou);
    if (index >= 0) this.fous.splice(index, 1);
  }

  /** Rend la main au jeu apres une pause commandee par un panneau. */
  private reprendreLeJeu(): void {
    this.decalerLeTemps(this.time.now - this.debutPause);
    this.physics.resume();
    this.anims.resumeAll();
    this.enPause = false;
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
          this.events.emit("annonce", `${personne.nom} n'a pas survecu — ${evenement.nom}`, "village");
          this.tomber(hero);
          break;
        }
        this.events.emit("annonce", `${personne.nom} : ${evenement.nom}`, "village");
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

  /**
   * Combien de monstres cette nuit-la deverse, le budget compris (§4.29).
   *
   * ⚠️ Le plafond d'ecran du §4.17 a toujours le dernier mot : ce nombre dit
   * combien **veulent** paraitre, pas combien tiennent a l'ecran.
   */
  private effectifDeLaNuitIci(nuit: number): number {
    return Math.max(1, Math.round(effectifDeLaNuit(nuit) * (1 + this.menaces.effectifEnPlus)));
  }

  /**
   * La puissance d'une nuit (ou d'un jour), avec l'avance que le monde s'est
   * payee.
   *
   * C'est le « plus forts, plus tot » du §4.29 : un monde genereux joue sa
   * premiere nuit comme une quatrieme — statistiques **et** archetypes, puisque
   * c'est la meme echelle qui ouvre les deux.
   */
  private puissanceIci(numero: number): number {
    return puissanceDeLaNuit(numero + this.menaces.nuitsDAvance);
  }

  private deverserLaNuit(): void {
    if (this.resteDeLaNuit <= 0) return;
    if (this.time.now < this.prochaineApparition) return;

    const place = MAX_ENNEMIS - this.ennemis.getLength();
    if (place > 0) {
      this.faireApparaitreEnnemi(this.puissanceIci(this.cycle.nuit));
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
      const puissance = this.puissanceIci(this.cycle.jour);
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
    this.tailleHordeEnRoute = tailleDeLaHorde(this.cycle.jour + this.menaces.nuitsDAvance);
    this.hordeAuDepart = maintenant + REGLAGES_CYCLE.preavisHorde;

    const ou = this.fronts.map((f) => NOMS_FRONT[f]).join(" et ");
    this.events.emit("annonce", `Une horde arrive ${ou} !`, "guet");
  }

  private programmerHorde(): void {
    // Au-dela de 65 habitants, le village attire les monstres (§4.18) : l'ecart
    // entre deux hordes tombe a quelques dizaines de secondes. Ca se dit une
    // fois, au passage du seuil — dans un sens comme dans l'autre.
    const attire = villageAttire(this.village.population);
    if (attire !== this.villageAttire) {
      this.villageAttire = attire;
      this.events.emit(
        "annonce",
        attire
          ? "Le village est gros : il attire les monstres, ils ne s'arreteront plus"
          : "Le village s'est fait plus discret : les monstres se calment",
        "guet",
      );
    }
    this.prochaineHorde = this.time.now + delaiProchaineHorde(this.rng.next(), attire);
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
    // Une part vient piller : la maison debout la plus proche de la ou il
    // surgit, pas de l'eglise — c'est ce qui etale la menace sur le village.
    if (this.rng.chance(PART_DE_PILLARDS)) e.cibleMaison = this.maisons.laPlusProcheDebout(point.x, point.y);
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
    this.events.emit("annonce", `Nouveau : ${nom}`, "guet");
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
    this.musique.combat();

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
      this.events.emit("annonce", "je saigne — il me reste une journee", "heros", hero.personne.nom);
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
    // Il brule le sol en s'ouvrant : c'est la premiere terre brulee du jeu.
    abimerLeSol(this.carte, x, y, "brule", 30);

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
    this.flotter(hero.x, hero.y - 30, `${hero.personne.nom} est tombe`, "#ff6b5a");
    this.events.emit("hero-tombe", hero);
    this.faireLeDeuil(hero);

    const suivant = this.heros.findIndex((h) => h.etat !== "mort");
    if (suivant === -1) {
      this.finDePartie();
      return;
    }
    this.indexIncarne = suivant;
    this.heros[suivant]!.estIncarne = true;
    this.ouvrirLaMerAuHero(this.heros[suivant]!);
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
      this.events.emit("annonce", `je deviens ${cle}`, "heros", hero.personne.nom);
    }
  }

  private finDePartie(): void {
    this.termine = true;
    // La musique s'eteint avec la partie : le silence apres la chute.
    this.musique.eteindre(4);
    // `update` ne tournera plus : on rend la main au monde ici, sinon un
    // micro-gel en cours resterait en place pour de bon.
    majEffets(this, this.time.now, false);
    this.physics.pause();
    this.anims.pauseAll();
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
        .text(0, 0, "", { fontFamily: POLICE, fontSize: "11px", color: "#ffffff" })
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
