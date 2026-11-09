import Phaser from "phaser";
import { Noyade } from "../core/eau";
import { Chemins } from "../core/chemins";
import { CoucheDesChemins } from "../game/dessin/chemins";
import { Rng } from "../core/rng";
import { Emprises, Voisinage } from "../core/voisinage";
import { type ClassId } from "../core/classes";
import { type CompetenceDef, type EvolutionDef } from "../core/competences";
import { creerTexturesPlaceholder } from "../game/art";
import { textureDe } from "../game/constructions";
import { Clavier } from "../game/touches";
import { Bruits, chargerLesBruits } from "../game/bruits";
import { abimerLeSol, CarteDuMonde, dessinerLeSolDuVillage } from "../game/dessin/morceaux";
import { decrireLeMonde, graineDeMonde } from "../core/monde";
import { type VillageVuDeLoin } from "../core/marche";
import { Parcours } from "../core/parcours";
import { oublierLesPortraits } from "../game/portraits";
import { Ennemi, Hero, Invocation, type Dome } from "../game/entities";
import { type Rendezvous } from "../core/rangs";
import { Nuee } from "../game/nuee";
import { POLICE } from "../game/ui/chrome";
import { Survivants, type SpriteSurvivant } from "../game/survivants";
import { Caches } from "../game/caches";
import { Elements } from "../game/elements";
import { type Cache } from "../core/caches";
import { REGLAGES_SURVIVANTS, type Survivant } from "../core/survivants";
import { majEffets, poufMort, preparerEffets, secousse } from "../game/effets";
import { type Point } from "../core/ordres";
import { Cour } from "../game/cour";
import { Affinites } from "../core/affinites";
import {
  chargerLaGraine,
  EGLISE,
  frontsOuverts,
  GRAINE_CLASSIQUE,
  MONDE,
  mondeCourant,
  PORT,
  POSTES,
  PRATICABLE,
  TAILLE_CLASSIQUE,
  type Front,
  type Taille,
} from "../core/carte";
import { TAILLE_JOUABLE } from "../core/monde";
import { BatimentEglise } from "../game/eglise";
import { type ContexteMontee } from "../core/eglise";
import { Cycle } from "../core/cycle";
import { Meteo } from "../core/meteo";
import { Pluie } from "../game/pluie";
import { Incendie } from "../core/incendie";
import { Feux } from "../game/feux";
import { Meteore as CielQuiTombe } from "../core/meteore";
import { ChuteDuMeteore } from "../game/meteore";
import { Village, type Villageois } from "../game/village";
import { Grille } from "../core/grille";
import {
  genererVillage,
  graineDeVillage,
  placesOuSeTenir,
  type PlanVillage,
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
import { CONSTRUCTIONS } from "../core/constructions";
import { Construction, Constructions } from "../game/constructions";
import { Champs, type Champ } from "../game/champs";
import { Maison, Maisons } from "../game/maisons";
import { stocksVides } from "../core/habitants";
import { type Personne } from "../core/personne";
import { MemoireDuVillage } from "../game/memoire";
import { Bulles } from "../game/vieAutonome";
import type { Stocks } from "../core/habitants";
import { type Arrivant, type Fou } from "../core/arrivants";
import { BatimentPort } from "../game/port";
import type { EtatPortAffiche } from "../game/panneauPort";
import { Journal } from "../core/journal";
import { Commandement } from "../game/commandement";
import { nouvelleIdentitePartie, type PartieEnCours } from "../game/sauvegarde";
import type { Emplacement, Sauvegarde } from "../core/sauvegarde";
import { type MerAnimee } from "../game/dessin/mer";
import type { EtatEquipe } from "../game/hud";
import type { EtatOrdres } from "../game/panneauOrdres";
import type { GroupeAffiche } from "../game/fichePersonne";
import { MORCEAUX, Musique } from "../game/musique";
import { ArenaPartie } from "./arene/partie";
import { ArenaMarche } from "./arene/marche";
import { ArenaRoute } from "./arene/route";
import { ArenaInstallation } from "./arene/installation";
import { ArenaControles } from "./arene/controles";
import { ArenaCommandement } from "./arene/commandement";
import { ArenaEquipe } from "./arene/equipe";
import { ArenaDeplacements } from "./arene/deplacements";
import { ArenaHorde } from "./arene/horde";
import { ArenaTravail } from "./arene/travail";
import { ArenaAmenagement } from "./arene/amenagement";
import { ArenaCombat } from "./arene/combat";
import { ArenaProgression } from "./arene/progression";
import { ArenaCapacites } from "./arene/capacites";
import { ArenaEffetsDeClasse } from "./arene/effetsDeClasse";
import { ArenaFusions } from "./arene/fusions";
import { ArenaOutillage } from "./arene/outillage";
import { ArenaJourEtNuit } from "./arene/jourEtNuit";
import { ArenaIncendie } from "./arene/incendie";
import { ArenaMeteore } from "./arene/meteore";
import { ArenaArrivants } from "./arene/arrivants";
import { ArenaPort } from "./arene/port";
import { ArenaJournees } from "./arene/journees";
import { ArenaVagues } from "./arene/vagues";
import { ArenaDegats } from "./arene/degats";
import { ArenaMemoire } from "./arene/memoireDuVillage";
import { ArenaEffetsVisuels } from "./arene/effetsVisuels";
import { greffer } from "./arene/greffer";
import {
  VolDEpee,
  ZoneFracturee,
  ModeBati,
  EtatVillage,
  ZOOM_DEFAUT,
  RAYON_DE_VUE,
  PORTEE_DE_LA_COURSE,
  NUIT_PLEINE,
} from "./arene/reglages";

export type { EtatVillage } from "./arene/reglages";

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

export class ArenaScene extends Phaser.Scene {
  rng!: Rng;
  heros: Hero[] = [];
  indexIncarne = 0;
  /** Le poste de commandement : selection, ordres, formation (DESIGN.md §4.4) */
  commandement!: Commandement;
  graphiquesOrdres!: Phaser.GameObjects.Graphics;
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
  modeCommandement = false;
  /** Coin de depart du rectangle de selection, en coordonnees du monde */
  rectangleDepart: Phaser.Math.Vector2 | null = null;
  rectangleCourant: Phaser.Math.Vector2 | null = null;
  /** Experience de groupe : combattre ensemble rend plus fort (DESIGN.md §4.16) */
  affinites = new Affinites();
  prochainTickAffinites = 0;
  /**
   * La memoire du village (DESIGN.md §4.26, bloc 11).
   *
   * ⚠️ **A ne pas confondre avec l'affinite juste au-dessus.** L'affinite est
   * militaire — elle se gagne en combattant, elle vaut des degats, elle ne
   * concerne que les heros. La memoire est sociale : elle se gagne en vivant,
   * elle a des types, et elle concerne tout le monde.
   */
  memoire = new MemoireDuVillage();
  /**
   * Les bulles de la vie autonome (§4.27, bloc 12).
   *
   * Un pool de douze images, cree une fois : le §4.27 l'exige en toutes
   * lettres, et le §4.17 le repete.
   */
  bulles!: Bulles;
  /** Combien d'initiatives ont ete annoncees cette nuit — trois au plus */
  initiativesAnnoncees = 0;
  /** Les tombes posees sur la carte, bornees (§4.17) */
  tombes: Phaser.GameObjects.Image[] = [];
  /**
   * Ce que chaque heros avait tue a l'aube precedente.
   *
   * Le compteur d'un heros est **cumule** sur toute la partie : sans ce temoin,
   * la rivalite se declencherait sur le total et non sur la nuit, donc une
   * fois pour toutes des la troisieme nuit.
   */
  readonly killsDeLaVeille = new Map<string, number>();
  /** Ce que la nuit qui s'acheve a coute : elle ne se retient que si elle a mordu */
  cadavresDeLaNuit = 0;
  /** Et ce qu'elle a rapporte : une nuit tenue sans perte est une histoire */
  killsDeLaNuit = 0;
  /** Le moral avance par battements, jamais par image (DESIGN.md §4.23) */
  prochainBattementMoral = 0;
  static readonly PERIODE_MORAL = 500;
  equipe!: Phaser.Physics.Arcade.Group;
  ennemis!: Phaser.Physics.Arcade.Group;
  projectiles!: Phaser.Physics.Arcade.Group;
  /** Les crachats des monstres a distance : ils volent dans l'autre sens */
  projectilesEnnemis!: Phaser.Physics.Arcade.Group;
  /** Tout ce qui se bat pour l'equipe sans etre un heros */
  invocations!: Phaser.Physics.Arcade.Group;
  /** Instant a partir duquel un familier detruit peut revenir */
  retourFamilier = new Map<Hero, number>();
  /** Contrat en cours de l'assassin : cette cible mourra */
  contrats = new Map<Hero, Ennemi>();
  domes: Dome[] = [];
  orbiteurs = new Map<Hero, Phaser.GameObjects.Image[]>();
  prochainTickOrbiteurs = 0;
  prochainTickAuras = 0;
  prochainTickEclats = 0;
  /** Heros qui encaisse actuellement pour toute l'equipe (Martyre) */
  martyr: Hero | null = null;
  /** La Resurrection de l'Oracle ne joue qu'une fois par partie */
  resurrectionUtilisee = false;
  /** Instant de fin de l'Heure sombre : tout est fige jusque-la */
  figeJusqua = 0;

  // --- Les fusions (§4.25, jalon 6.5, morceau 3) ---
  /** Moulin a lames : les epees parties rebondir, et quand chaque heros relance les siennes */
  volsDEpees = new Map<Phaser.GameObjects.Image, VolDEpee>();
  prochainMoulin = new Map<Hero, number>();
  /** Satellites conducteurs : quand chaque satellite peut relancer un eclair */
  prochainEclairDeSatellite = new Map<Phaser.GameObjects.Image, number>();
  /** Tourbillon infernal : jusqu'a quand l'aura de chaque heros brule double */
  tourbillons = new Map<Hero, number>();
  /** Temps fracture : les ralentis en cours, qui rendent du temps a leur Sablier */
  zonesFracturees: ZoneFracturee[] = [];
  /**
   * Exil des morts : les bannis qui reviendront a la prochaine nuit, puis ceux
   * de la nuit en cours qui ne sont pas encore sortis. Enregistres.
   */
  bannis = 0;
  revenantsAttendus = 0;
  /** Reserve de textes flottants, recycles au lieu d'etre recrees */
  textesLibres: Phaser.GameObjects.Text[] = [];
  textesActifs = 0;
  /** Heros ciblables, recalcules une fois par image et non par ennemi */
  ciblesPossibles: Hero[] = [];
  /**
   * Le voisinage de la horde (DESIGN.md §4.33, palier 1) : tous les monstres
   * ranges par cellule, **une fois par pas de physique**. C'est lui qui repond
   * a « le plus proche », a « ceux dans ce rayon » et aux contacts, au lieu de
   * parcourir toute la horde a chaque question.
   */
  voisinage!: Voisinage;
  /** Les monstres dans l'ordre ou le voisinage les a ranges : ses index pointent ici. */
  horde: Ennemi[] = [];
  hordeX = new Float32Array(256);
  hordeY = new Float32Array(256);
  /**
   * Jusqu'ou le corps d'un monstre deborde de la position de son sprite, pas de
   * physique compris : une recherche elargie d'autant ne peut manquer aucun
   * contact.
   */
  margeDeContact = 0;
  /** Les trouvailles d'une recherche, copiees : on peut rappeler ensuite du code qui interroge a son tour. */
  trouvailles: number[] = [];
  /** Le decor qui arrete les monstres, range par cellule pour les butees (§4.33, palier 1). */
  emprises!: Emprises;
  /** Ce que chaque emprise est : 0 construction, 1 maison, 2 eglise, 3 eau ou roche. */
  sortesFixes = new Uint8Array(64);
  /**
   * Les corps du decor, vus comme des corps : les types de Phaser declarent que
   * `World.separate` ne prend que des corps dynamiques, alors qu'Arcade lui passe
   * lui-meme des corps statiques a chaque butee.
   */
  corpsFixes: Phaser.Physics.Arcade.Body[] = [];
  objetsFixes: Phaser.GameObjects.GameObject[] = [];
  fixesX0 = new Float32Array(64);
  fixesY0 = new Float32Array(64);
  fixesX1 = new Float32Array(64);
  fixesY1 = new Float32Array(64);
  /** Le numero de l'image, qui distribue les tours de decision (§4.33, palier 1). */
  numeroDImage = 0;
  /**
   * La nuee (§4.33, palier 2) : la pietaille dessinee en une passe instanciee.
   * `null` si le navigateur ne sait pas instancier — tout reste alors en sprites.
   */
  nuee: Nuee | null = null;
  /** Le filtre de toutes les recherches : un monstre tue pendant l'image est encore range. */
  readonly monstreDebout = (i: number): boolean => this.horde[i]!.active;
  /** Cadavres en train de tomber : plafonnes, une mort en masse coute cher */
  cadavres = 0;
  /** Archetypes deja croises, pour n'annoncer chacun qu'une fois */
  archetypesVus = new Set<string>();

  /**
   * Le clavier, branche sur des **actions** et non sur des lettres (§4.10).
   *
   * Depuis le bloc 10, plus une seule touche n'est ecrite en dur ici : la table
   * vit dans `core/touches.ts`, le joueur la remappe depuis le menu ECHAP, et
   * cette scene comme la ligne d'aide la lisent.
   */
  clavier!: Clavier;

  destination: Phaser.Math.Vector2 | null = null;
  marqueur: Phaser.GameObjects.Image | null = null;

  debut = 0;
  prochaineApparition = 0;
  /** Les fronts ouverts en ce moment (DESIGN.md §4.6) */
  fronts: Front[] = ["nord"];
  partPremierFront = 1;
  kills = 0;
  termine = false;

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
  readonly fous: Fou[] = [];

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
  navireAttendu = false;
  /** La journee ou quelqu'un se presentera, ou null quand plus personne ne vient */
  prochaineArriveeJournee: number | null = null;

  /**
   * Les survivants (DESIGN.md §4.18) : la seule raison de sortir du village.
   *
   * Au plus un a la fois, et il ne parait que le jour.
   */
  survivants!: Survivants;
  /**
   * Les caches de la route (§4.31, jalon 5.6).
   *
   * ⚠️ **Elles n'existent que pendant l'errance.** Une partie installee n'en a
   * aucune : la restauration du village (jalon 8) est le systeme qui
   * recompense l'exploration une fois qu'on a un village, et deux systemes
   * pour la meme chose seraient un de trop.
   */
  caches!: Caches;
  /** Les six bases elementaires (§4.13) : la boule, le vent, la flaque, les racines, l'ecran. */
  elements!: Elements;
  /**
   * Ce que la route a rendu en matiere, et qui deviendra les reserves du jour
   * ou l'on s'installe (§4.31).
   *
   * ⚠️ **Ce ne sont pas encore des stocks.** On n'a pas de village : ce qu'on
   * porte sur le dos ne se compte ni dans le grenier ni dans la faim de
   * personne. Ca s'y verse a l'installation, et une seule fois.
   */
  butinDeLaRoute: Stocks = stocksVides();
  /** Les camps de betes deja leves : on ne les lache qu'une fois */
  campsLeves = new Set<number>();
  /** La stele dont le panneau est ouvert, s'il y en a une (§4.31) */
  steleOuverte: Cache | null = null;
  /**
   * Ceux qui nous suivent, entre deux mondes (§4.31).
   *
   * Ce sont leurs **regles**, pas leurs sprites : un sprite appartient a la
   * scene qu'on quitte. Ce champ est plein le temps d'un `init`, puis vide des
   * qu'ils ont repris corps.
   */
  compagnonsDeRoute: Survivant[] = [];
  prochainSurvivantJournee = 1;
  /** Celui qu'on presente a l'eglise, tant que la fiche est ouverte */
  survivantALEglise: SpriteSurvivant | null = null;
  /** Celui qui attend pendant que le jeu est en pause */
  arrivantALaPorte: Arrivant | null = null;
  /**
   * La cloche a sonne, et les portes attendent que plus personne ne soit
   * dehors pour se fermer (§4.20, bloc 7b). Remis a faux a l'aube.
   */
  clocheSonnee = false;
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
  resteDeLaNuit = 0;
  /**
   * Les rangs que la nuit doit encore envoyer (§4.33) : chaque nuit a son boss,
   * au moment ou telle part de son effectif est partie.
   */
  rendezvous: Rendezvous[] = [];
  /** L'effectif de la nuit a la tombee : c'est sur lui que se lisent les rendez-vous. */
  effectifDeDepart = 0;
  /** Instant de la prochaine horde de jour, et de celle qu'on vient d'annoncer */
  prochaineHorde = 0;
  hordeAuDepart = 0;
  /** Le village attire-t-il les monstres (§4.18) ? Garde, pour ne le dire qu'au changement. */
  villageAttire = false;
  /**
   * Le ciel de la partie (§4.21, jalon 6).
   *
   * Tire **une fois par journee**, a l'aube, comme le cours du marche et la
   * voile : un tirage rejoue a chaque image consommerait la graine et rendrait
   * le temps illisible.
   */
  meteo = new Meteo();
  /** Ce qu'on voit du ciel : les rideaux, l'assombrissement, les eclairs (§4.21) */
  pluie!: Pluie;
  /**
   * Les incendies (§4.21, l'incendie).
   *
   * Le noyau dit ou ca brule et ce que ca ronge ; `feux` ne fait que le
   * montrer ; `cibles` retient a quoi chaque foyer est accroche, pour ne pas
   * avoir a rechercher une maison par sa position a chaque passage.
   */
  incendie = new Incendie();
  feux!: Feux;
  cibles = new Map<string, Maison | Champ>();
  /** Ou l'on remplit son seau (§4.21, §4.24). Null tant qu'aucun puits n'est pose */
  puits: Point | null = null;
  /** Vrai tant qu'un feu brule : c'est lui qui dit quand ranger flammes et son */
  quelqueChoseBrulait = false;
  /**
   * Le ciel qui tombe (§4.21, le meteore) : le noyau tire et compte, `chute`
   * montre les douze secondes et le coup, `pierreDuCiel` est ce qui reste.
   */
  cielQuiTombe = new CielQuiTombe();
  chute!: ChuteDuMeteore;
  pierreDuCiel: Phaser.GameObjects.Image | null = null;
  /** Vrai tant que la crue dure : c'est lui qui dit quand les douves se remettent a barrer */
  crueEnCours = false;
  /** L'instant du prochain rongement des batiments par l'eau */
  prochainRongement = 0;
  /**
   * Les berges d'ou sortent les betes d'eau, cherchees **une fois** a la
   * tombee de la nuit de crue (§4.21). Vide : il n'y a pas d'eau assez pres,
   * et rien ne sort — un village loin de l'eau ne craint pas la crue.
   */
  rivesDeLaCrue: Point[] = [];
  tailleHordeEnRoute = 0;
  /** Le voile de nuit : une seule image noire, dont on module l'opacite */
  voile!: Phaser.GameObjects.Rectangle;
  /** Recolte manuelle accumulee, pour n'afficher un nombre que de loin en loin */
  cumulRecolte = 0;
  prochainGesteRecolte = 0;
  /** Le geste d'un heros au travail, espace comme celui de la recolte a la main */
  prochainGesteTravail = 0;
  /** La journee ou l on a deja dit qu il manquait un charpentier */
  batisseurAnnonce = -1;

  /** La carte en grille modifiable : c'est elle qu'on batit (DESIGN.md §4.21) */
  grille = new Grille();
  /**
   * La carte peinte de ce monde, **par morceaux** (§4.29, `morceaux.ts`).
   *
   * Elle cuit toute seule, image par image, au plus pres du heros. Tout ce qui
   * marque le sol — la place du village, une terre brulee, un cratere — passe
   * par elle et attend son morceau si celui-ci n'est pas encore peint.
   */
  carte: CarteDuMonde | null = null;
  /** La graine du village de cette partie : elle traverse la sauvegarde (§4.24) */
  private graineVillage = 0;
  /** La graine du monde (§4.29) : la mer, le relief, l'endroit ou l'on tombe */
  graineMonde = 0;
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
  parcours!: Parcours;
  /** Les corps du terrain : l'eau profonde, que seul le heros incarne traverse, et la roche */
  obstaclesDEau!: Phaser.Physics.Arcade.StaticGroup;
  obstaclesDeRoche!: Phaser.Physics.Arcade.StaticGroup;
  /** Le village tire de la graine : l'enceinte, les maisons, la place (§4.24) */
  planVillage!: PlanVillage;
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
  menaces: Menaces = { effectifEnPlus: 0, nuitsDAvance: 0, malades: 0 };
  /** La phrase qu'on annonce avant d'entrer, en une ligne (§4.29) */
  augureDuMonde = "";
  /** Les rues du village, tracees avec le plan : le sol les peint, le decor s'en ecarte. */
  ruesDuVillage: Segment[] = [];
  /** L'eau qui noie (§4.30) : l'horloge du heros incarne sous la surface. */
  noyade = new Noyade();
  /** Les chemins qui s'usent (§4.24) : les passages par case, et la couche qui les peint. */
  chemins = new Chemins();
  coucheChemins!: CoucheDesChemins;
  /** Les pas se comptent par battements, jamais par image (§4.17 regle 5). */
  prochainBattementChemins = 0;
  static readonly PERIODE_CHEMINS = 250;
  /** La derniere position du heros incarne hors de l'abysse : on l'y ramene s'il y tombe. */
  dernierePositionTenable = { x: 0, y: 0 };
  /** Les murs et les tours (DESIGN.md §4.20) */
  constructions!: Constructions;
  /** Les champs de ble : ils poussent, et une horde les ruine (§4.18) */
  champs!: Champs;
  /** Ce qu'on s'apprete a poser ; null quand le mode construction est ferme */
  enConstruction: ModeBati | null = null;
  /** L'apercu fantome, cree une fois et deplace : jamais recree (§4.17) */
  fantome!: Phaser.GameObjects.Image;
  /** La houle et l'ecume, posees sur la carte cuite (§4.30) */
  mer!: MerAnimee;
  /** La tour dans laquelle se tient le heros incarne, s'il y en a une */
  tourDuHero: Construction | null = null;

  /**
   * Le mode d'amenagement (DESIGN.md §4.24) : la touche `M`.
   *
   * ⚠️ **Il met le jeu en pause, et c'est assume alors que le §4.4 est fier de
   * ne jamais l'interrompre.** Ce n'est pas la meme chose : un ordre tactique se
   * donne dans le feu, amenager veut dire regarder, comparer, essayer. Poser
   * vingt batiments a la souris en courant devant une horde ne serait pas tendu,
   * ce serait penible.
   */
  amenagement = false;
  /** La grille du mode d'amenagement, dessinee **une seule fois** (§4.17) */
  calqueGrille?: Phaser.GameObjects.Graphics;
  /** Ce qu'on a pris en main pour le reposer ailleurs ; null la plupart du temps */
  deplacee: Construction | Maison | null = null;
  /** Les maisons du village : debout ou en ruine, batissables, demolissables (§4.24) */
  maisons!: Maisons;
  /** Le survol (§4.24) : un seul objet Texte, cree une fois, deplace a la demande */
  survol!: Phaser.GameObjects.Text;
  /** Le temps ou le mode d'amenagement s'est ouvert, pour rendre la pause */
  debutAmenagement = 0;

  enPause = false;
  /** La musique de la partie : le calme le jour, la guerre la nuit et des qu'un heros se bat (§4.10). */
  musique!: Musique;
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
  saisieEnCours = false;
  /** Vrai quand la pause vient de la fenetre, pas du menu de choix */
  pauseHorsFocus = false;
  debutPause = 0;
  /** Vrai quand c'est le joueur qui a demande la pause (ECHAP, §4.10) */
  pauseDuJoueur = false;
  debutPauseDuJoueur = 0;
  modeChoix: "competence" | "evolution" | "remplacement" = "competence";
  /** La competence qui attend une place, le temps de l'ecran « laquelle oublier ? » (§4.13). */
  competenceEnAttente: CompetenceDef | null = null;
  competenceEnEvolution: CompetenceDef | null = null;
  optionsEvolution: EvolutionDef[] = [];

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
  enMarche = false;
  /** Le point ou l'on a paru : la sortie ne s'arme qu'une fois qu'on s'en est eloigne */
  departDeLaMarche: Point = { x: 0, y: 0 };
  /** Vrai des qu'on a quitte le bord par lequel on est arrive : on peut alors passer au large */
  sortieArmee = false;
  /** Combien de villages on a deja laisses derriere soi (§4.29 : refuser coute) */
  marches = 0;
  /** Combien de villages on a refuses : c'est ce qui eloigne le suivant (§4.29) */
  refus = 0;
  /** Combien de mondes sans personne il reste a traverser avant le prochain village */
  mondesMuets = 0;
  /**
   * Vrai quand ce monde-ci est un **monde muet** : son village est une ruine
   * que personne n'habite, et personne n'en sortira pour nous parler.
   *
   * C'est la reponse du 20 septembre 2026 a une contrainte de geometrie : le
   * §4.29 veut que « le village suivant soit deux fois plus loin » a chaque
   * refus, et une carte finie ne peut pas s'allonger. Ce qu'on double, c'est le
   * **nombre de mondes a traverser** — et ceux du milieu sont vides.
   */
  villageMuet = false;
  /** Celui qui sort nous parler ; `null` tant que personne n'est venu */
  gardien: Villageois | null = null;
  /**
   * Le chemin des humains jusqu'a nous : un champ de directions a eux.
   *
   * Il sert a **celui qui vient parler** comme a **ceux qui se jettent sur
   * nous** : les uns et les autres sortent par la porte, la ou un monstre
   * frapperait le mur (voir `passeUnVillageois`).
   */
  cheminDesHumains: Parcours | null = null;
  /** Le point vers lequel ce champ pointe : on ne le refait que si l'on s'en eloigne */
  cibleDesHumains: Point = { x: 0, y: 0 };
  /** Jamais plus souvent que ca : une propagation balaye toute la grille (§4.17) */
  prochainCheminDesHumains = 0;
  /**
   * Combien d'humains nous courent apres.
   *
   * ⚠️ Il ne sert qu'a **ne rien calculer quand il n'y en a pas** : sans lui, le
   * champ des humains continuerait de se refaire trois fois par seconde pendant
   * toute une partie installee, pour personne (§4.17 regle 5).
   */
  humainsEnFace = 0;
  /** Vrai quand il a dit ce qu'il avait a dire : on ne le rappelle pas deux fois */
  rencontreFaite = false;
  /** Vrai pendant le fondu qui nous emmene au monde suivant : plus rien ne doit se declencher */
  quitteLeMonde = false;
  /**
   * La monnaie qu'on n'a pas encore touchee (§4.29, §4.8).
   *
   * Une bete vaut moins d'une piece : on garde le reste d'une mort a l'autre
   * plutot que d'arrondir chaque cadavre (`core/butin.ts`).
   */
  resteDeButin = 0;
  /**
   * Le Misericordieux a-t-il deja annonce qu'il refusait de frapper ?
   *
   * ⚠️ **Il doit le dire, et une seule fois** : le §4.23 en fait le premier
   * trait qui desobeit, et le §4.12 exige qu'une desobeissance s'annonce — un
   * heros qui s'arrete sans prevenir serait vecu comme un bug. Une fois par
   * partie suffit : repete a chaque coup, ce serait le journal qui deborde.
   */
  refusDeFrapperAnnonce = false;
  /** Le dezoom d'entree (§4.10) : le seul mouvement de camera automatique du jeu */
  entreeCamera: Phaser.Tweens.Tween | null = null;

  // ------------------------------------------------------------ la sauvegarde

  /** L'emplacement joue, de 1 a 3 (DESIGN.md §4.28) */
  emplacement: Emplacement = 1;
  /** La partie a reprendre, posee par `init` et consommee par `create` */
  reprise: Sauvegarde | null = null;
  private identitePartie = "";
  revision = 0;
  /** Millisecondes de jeu cumulees, sessions precedentes comprises */
  dureeJouee = 0;

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
    this.volsDEpees = new Map();
    this.prochainMoulin = new Map();
    this.prochainEclairDeSatellite = new Map();
    this.tourbillons = new Map();
    this.zonesFracturees = [];
    this.bannis = 0;
    this.revenantsAttendus = 0;
    // Une nouvelle partie, une nouvelle equipe : les liens ne se transmettent
    // pas. Ils le feront le jour ou les heros survivront a une partie (§4.12).
    this.affinites = new Affinites();
    this.prochainTickAffinites = 0;
    this.memoire = new MemoireDuVillage();
    this.bulles?.vider();
    this.initiativesAnnoncees = 0;
    for (const tombe of this.tombes) tombe.destroy();
    this.tombes = [];
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
  get contexteMontee(): ContexteMontee {
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
    // ⚠️ **Avant le premier monstre de la partie** — les camps de betes naissent
    // tot : un `Ennemi` decide a sa naissance s'il est dessine par la nuee
    // (§4.33, palier 2), et la reponse depend du navigateur.
    Ennemi.nueeActive = Nuee.possible(this);
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

    // ⚠️ **La horde ne passe plus par les passes d'Arcade** (DESIGN.md §4.33,
    // palier 1). Les dix passes qui testaient les monstres — contre l'equipe,
    // les projectiles, les invocations, les habitants, les champs, les
    // survivants, les murs, les maisons, l'eglise, l'eau et la roche — sont
    // remplacees par `pasDeLaHorde`, branche sur le pas de physique. Seuls les
    // crachats restent ici : ils ne touchent que l'equipe.
    this.physics.add.overlap(this.projectilesEnnemis, this.equipe, (p, h) =>
      this.impactCrachat(p as Phaser.Physics.Arcade.Image, h as Hero),
    );
    this.voisinage = new Voisinage(MONDE.largeur, MONDE.hauteur);
    this.emprises = new Emprises(MONDE.largeur, MONDE.hauteur);
    // ⚠️ **Pas de debranchement a l'arret** : le monde de physique meurt avec la
    // scene et emporte ses ecouteurs, et le plugin l'a deja mis a `null` quand
    // notre propre ecouteur d'arret passerait — le debrancher planterait chaque
    // nouvelle partie.
    this.physics.world.on(Phaser.Physics.Arcade.Events.WORLD_STEP, this.pasDeLaHorde, this);
    // La nuee se remplit apres la physique, juste avant le dessin : les
    // positions sont alors celles que Phaser va afficher pour tout le reste.
    // ⚠️ Les evenements de la scene, eux, survivent a la partie : on les
    // debranche a l'arret, et la nuee rend sa memoire a la carte graphique.
    if (Ennemi.nueeActive) {
      this.nuee = new Nuee(this, MONDE.hauteur);
      this.events.on(Phaser.Scenes.Events.POST_UPDATE, this.remplirLaNuee, this);
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        this.events.off(Phaser.Scenes.Events.POST_UPDATE, this.remplirLaNuee, this);
        this.nuee?.detruire();
        this.nuee = null;
      });
    }

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
  get partieEnCours(): PartieEnCours {
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
      memoire: this.memoire,
      meteo: this.meteo,
      incendie: this.incendie,
      meteore: this.cielQuiTombe,
      bannis: this.bannis,
    };
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

    // Les bulles de la vie autonome : douze images, cuites une fois (§4.27).
    this.bulles = new Bulles(this);

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

    // Les bases elementaires (§4.13) : elles cherchent la horde par le
    // voisinage, et blessent par le meme point que tout le reste.
    this.elements = new Elements(this, {
      ennemisDansRayon: (x, y, rayon) => this.ennemisDansRayon(x, y, rayon),
      ennemiLePlusProche: (x, y, portee) => this.ennemiLePlusProche(x, y, portee),
      blesser: (e, degats, auteur) => this.blesserEnnemi(e, degats, auteur),
      cercle: (x, y, rayon, couleur) => this.effetCercle(x, y, rayon, couleur),
      bruit: (evenement, x, y) => this.bruits.jouer(evenement, x, y),
      flotter: (x, y, texte, couleur) => this.flotter(x, y, texte, couleur),
      heros: () => this.heros,
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
      // Le feu, et le seau qui va avec (§4.21, l'incendie).
      feuAPortee: (x, y) => this.incendie.leProcheDe(x, y, PORTEE_DE_LA_COURSE) !== null,
      butDuSeau: (x, y, seauPlein) => {
        const foyer = this.incendie.leProcheDe(x, y, PORTEE_DE_LA_COURSE);
        if (!foyer) return null;
        // Vide, il va le remplir ; plein, il va le jeter. Sans puits — un
        // village qui n'en a pas encore pose — il va au feu directement, et
        // c'est tout ce que ca change.
        return seauPlein || this.puits === null ? { x: foyer.x, y: foyer.y } : this.puits;
      },
      // La cour, et si quelqu'un y attend un instructeur (bloc 9).
      // Deux habitants se croisent : une bulle dit ce qu'ils sont l'un pour
      // l'autre, et le joueur invente le reste (§4.27).
      uneRencontre: (un, autre, maintenant) => this.uneRencontre(un, autre, maintenant),
      // La peur fait s'ecarter (§4.26) — c'est ici qu'elle prend effet.
      craint: (qui, autre) => this.memoire.relations.craint(qui.identite, autre.identite),
      // La dette fait accepter un ordre qu'on aurait refuse (§4.26).
      obeitMalgreTout: (qui) =>
        this.memoire.relations.obeitMalgreTout(
          qui.identite,
          this.toutLeMonde.map((p) => p.identite),
        ),
      // Quelqu'un craque et s'en prend aux siens (§4.26).
      surLaRage: (qui, temoins) => this.memoire.rage(qui, temoins, this.cycle.jour),
      // Ce dont le village se souvient, deja agrege (§4.26, bloc 11).
      memoireDuVillage: () => this.memoire.archives.effets.satisfaction,
      // Quelqu'un tombe : c'est la scene qui sait ce que ca produit (§4.26).
      surLaMort: (mort, temoins, x, y, details) =>
        this.uneMort(mort, [...temoins, ...this.temoinsAutourDe(x, y)], x, y, null, details),
      courDEntrainement: () => {
        const point = this.cour?.centre;
        if (!point) return null;
        return { point, attend: this.cour.eleves.length > 0 };
      },
    });

    // Un monstre qui rattrape un habitant le tue : c'est la seule fenetre ou on
    // peut le perdre, et elle ne s'ouvre que si ce flanc a ete laisse sans
    // personne (DESIGN.md §4.18). Le contact se cherche dans `toucherLaHorde`.

    // Les murs et les tours. Ils arretent les corps : la collision suffit, on
    // n'a rien a calculer par image.
    this.constructions = new Constructions(this, this.grille);
    this.champs = new Champs(this, this.grille);
    // Un champ ne bloque personne : on le traverse — et le traverser le ruine
    // (`toucherLaHorde`).
    // ⚠️ **Une porte ouverte ne cogne personne** (§4.20) : le test de passage
    // laisse traverser tout le monde, monstres compris. On ne suppose pas
    // l'ordre des deux arguments, Phaser le decide selon les operandes.
    const barre: Phaser.Types.Physics.Arcade.ArcadePhysicsCallback = (a, b) => {
      const construction = (a instanceof Construction ? a : b) as Construction;
      return !construction.laissePasser;
    };
    // Les monstres butent sur les murs dans `buterContreLeDecor`, avec la meme
    // regle : une porte ouverte les laisse passer.
    this.physics.add.collider(this.equipe, this.constructions.groupe, undefined, barre);
    this.physics.add.collider(this.village.groupe, this.constructions.groupe, undefined, barre);
    // Les maisons arretent les corps et se font piller (§4.24) — les monstres
    // dans `buterContreLeDecor`. Une ruine n'a plus de corps : on marche dans
    // les decombres.
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
    // qu'ils viennent detruire (§4.22). Ca se regle dans `buterContreLeDecor`.
    this.physics.add.collider(this.equipe, this.eglise.sprite);

    // Un survivant ne se defend pas et n'encaisse presque rien (§4.18) : le
    // danger est le trajet du retour. Le contact se cherche dans
    // `toucherLaHorde`.

    this.fantome = this.add
      .image(0, 0, textureDe(CONSTRUCTIONS.palissade))
      .setAlpha(0.55)
      .setVisible(false)
      .setDepth(880);

    // On ne nomme plus rien par du texte flottant (§4.24) : passer la souris
    // sur une maison, un mur, l'eglise ou le port dit son nom et son etat. Un
    // seul objet, cree une fois, deplace a la demande (§4.17).
    // ⚠️ **Ce texte-la vit dans le monde, pas dans l'interface** : la camera de
    // l'arene l'agrandit de son zoom. On le rasterise donc a la taille ou on le
    // voit le plus souvent (`ZOOM_DEFAUT`), sans quoi dix pixels de lettre
    // etires trois fois et demie rendent une bouillie — c'est le seul texte du
    // jeu que `affuter` ne peut pas traiter, puisque son facteur n'est pas
    // celui de l'ecran mais celui de la camera.
    this.survol = this.add
      .text(0, 0, "", {
        fontFamily: POLICE,
        fontSize: "12px",
        color: "#e8dcc4",
        backgroundColor: "#141018",
        padding: { x: 4, y: 2 },
        resolution: ZOOM_DEFAUT,
      })
      .setOrigin(0.5, 1)
      .setDepth(950)
      .setVisible(false);
    this.survol.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);

    this.voile = this.add
      .rectangle(0, 0, MONDE.largeur, MONDE.hauteur, 0x0a0a1e)
      .setOrigin(0)
      .setAlpha(0)
      // Au-dessus du monde, sous l'interface : la nuit assombrit le terrain,
      // jamais les informations.
      .setDepth(900);

    // La pluie se pose autour du voile de nuit : son assombrissement dessous,
    // ses gouttes et ses eclairs dessus (§4.21).
    this.pluie = new Pluie(this);
    // Le feu se pose de part et d'autre du meme voile : la flamme dans le
    // monde, la lueur par-dessus la nuit (§4.21).
    this.feux = new Feux(this);
    this.chute = new ChuteDuMeteore(this);

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

  /** Vrai quand une saisie de texte capte le clavier (le renommage, §4.18). */
  get clavierPris(): boolean {
    return this.saisieEnCours;
  }

  /** Vrai quand le mode d'amenagement tient le jeu (§4.24). */
  get enAmenagement(): boolean {
    return this.amenagement;
  }

  get partieFinie(): boolean {
    return this.termine;
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

  get villageVuDeLoin(): VillageVuDeLoin {
    const enceinte = this.planVillage.enceinte;
    return {
      habitants: this.village.habitants.filter((v) => v.regles.vivant).length,
      mursDebout: enceinte.filter((p) => p.piece !== "ruine").length,
      breches: enceinte.filter((p) => p.piece === "ruine").length,
      douves: this.planVillage.douves.length > 0,
      fronts: frontsOuverts(),
    };
  }

  get sbires(): Invocation[] {
    return (this.invocations.getChildren() as Invocation[]).filter((i) => i.active);
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
    this.majDomes();
    this.elements.majorer(delta, this.time.now);
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
        // Le deplacement, qui les teinte d'ordinaire, ne tourne pas : on les
        // teinte ici, figes. La nuee, elle, les teinte au dessin.
        if (!e.dansLaNuee) this.teinterEnnemi(e, this.time.now);
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
    // Deux reglages de proprietes par bulle, douze au maximum (§4.17).
    this.bulles.majorer(this.time.now);
    this.recolterALaMain(delta);
    this.travaillerLesHeros(delta);
    this.majFantome();
    this.constructions.majorer(this.time.now);
    // Les chantiers n'avancent que du travail des batisseurs (§4.20, bloc 8) :
    // sans charpentier affecte, l'echafaudage reste dresse.
    this.constructions.avancerLesChantiers(this.village.batisseursALOeuvre, delta);
    this.majPortes();
    // Les champs poussent une fois par seconde, jamais par image (§4.17).
    this.champs.majorer(
      this.time.now,
      this.village.auTravail("fermier"),
      this.village.stocks,
      this.meteo.pousse(this.cycle.phase, this.cycle.part),
    );
    // Le feu ronge, se repand et s'eteint (§4.21). Il sort tout de suite tant
    // que rien ne brule.
    this.majIncendie();
    this.majMeteore();
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

  /** Toutes les x millisecondes : chaque paire de heros coute un calcul. */
  static readonly PERIODE_AFFINITES = 250;

  /**
   * Ce que la crue ronge (§4.21).
   *
   * ⚠️ **Aucun de ces trois chiffres n'a ete joue.** Ils sont regles pour que la
   * crue **fragilise sans detruire seule** : sur une journee et sa nuit, une
   * maison a 60 % de vie descend vers 15 % — elle ne tombe pas toute seule,
   * mais le premier monstre qui passe l'acheve. C'est la punition voulue : ne
   * pas avoir repare quand on voyait l'eau monter.
   */
  /**
   * Ou l'on cherche les berges de la nuit de crue (§4.21).
   *
   * Un rayon large — le lac d'un monde tire peut etre loin de l'eglise — et peu
   * de points : quatre berges suffisent a faire sortir une nuit entiere, et
   * elles donnent une direction lisible au lieu d'un encerclement.
   */
  static readonly RIVES_DE_LA_CRUE = { rayon: 1400, combien: 4 };

  static readonly CRUE = {
    /** Sous cette part de vie, une maison souffre de l'eau */
    seuil: 0.6,
    /** Ce qu'elle perd a chaque passage, en part de ses points de vie max */
    part: 0.02,
    /** Entre deux passages, en millisecondes de jeu */
    cadence: 40_000,
  };

  /**
   * Ou on en est de la nuit, de 0 (plein jour) a 1 (nuit pleine).
   *
   * Lu sur le voile plutot que recalcule : c'est la meme valeur, et deux
   * formules qui doivent rester d'accord finissent toujours par diverger. Sert
   * au feu, dont la lueur n'a de sens que la nuit.
   */
  get partDeNuit(): number {
    return this.voile.alpha / NUIT_PLEINE;
  }

  /**
   * Ou regarder quand ca brule hors de l'ecran (§4.21, l'alerte).
   *
   * Choix d'Angelos, 22 septembre 2026 : **une ligne de journal et un repere au
   * bord**, plutot que la cloche (qui ne voudrait plus dire « a l'abri ») ou
   * rien du tout. On est prevenu sans etre interrompu.
   *
   * ⚠️ Rend l'angle du feu **le plus proche qui ne se voit pas**, et `null`
   * quand tout ce qui brule est deja a l'ecran : un repere qui doublerait une
   * flamme visible ne dirait rien de plus.
   */
  get repereDuFeu(): number | null {
    if (!this.incendie.actif) return null;

    const vue = this.cameras.main.worldView;
    let angle: number | null = null;
    let meilleure = Infinity;
    for (const foyer of this.incendie.foyers) {
      if (vue.contains(foyer.x, foyer.y)) continue;
      const dx = foyer.x - vue.centerX;
      const dy = foyer.y - vue.centerY;
      const carre = dx * dx + dy * dy;
      if (carre >= meilleure) continue;
      meilleure = carre;
      angle = Math.atan2(dy, dx);
    }
    return angle;
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

  /** Le stress moyen du village, de 0 a 200. Calcule sur evenement. */
  get stressCollectif(): number {
    const vivants = this.village?.vivants ?? [];
    if (vivants.length === 0) return 0;
    let total = 0;
    for (const v of vivants) total += v.regles.personne.stress;
    return total / vivants.length;
  }

  /** Tout le monde, heros et habitants : c'est la population des relations. */
  get toutLeMonde(): Personne[] {
    const gens = this.heros.filter((h) => h.etat !== "mort").map((h) => h.personne);
    for (const villageois of this.village?.vivants ?? []) gens.push(villageois.regles.personne);
    return gens;
  }
}

/**
 * Les méthodes de la scène sont rangées par système dans `src/scenes/arene/` (ménage du
 * 9 novembre 2026) : une classe par fichier, dont les méthodes sont greffées ici sur le
 * prototype. Pour TypeScript, `ArenaScene` les possède toutes ; pour le navigateur aussi.
 */
export interface ArenaScene
  extends ArenaPartie,
    ArenaMarche,
    ArenaRoute,
    ArenaInstallation,
    ArenaControles,
    ArenaCommandement,
    ArenaEquipe,
    ArenaDeplacements,
    ArenaHorde,
    ArenaTravail,
    ArenaAmenagement,
    ArenaCombat,
    ArenaProgression,
    ArenaCapacites,
    ArenaEffetsDeClasse,
    ArenaFusions,
    ArenaOutillage,
    ArenaJourEtNuit,
    ArenaIncendie,
    ArenaMeteore,
    ArenaArrivants,
    ArenaPort,
    ArenaJournees,
    ArenaVagues,
    ArenaDegats,
    ArenaMemoire,
    ArenaEffetsVisuels {}

greffer(ArenaScene, [
  ArenaPartie,
  ArenaMarche,
  ArenaRoute,
  ArenaInstallation,
  ArenaControles,
  ArenaCommandement,
  ArenaEquipe,
  ArenaDeplacements,
  ArenaHorde,
  ArenaTravail,
  ArenaAmenagement,
  ArenaCombat,
  ArenaProgression,
  ArenaCapacites,
  ArenaEffetsDeClasse,
  ArenaFusions,
  ArenaOutillage,
  ArenaJourEtNuit,
  ArenaIncendie,
  ArenaMeteore,
  ArenaArrivants,
  ArenaPort,
  ArenaJournees,
  ArenaVagues,
  ArenaDegats,
  ArenaMemoire,
  ArenaEffetsVisuels,
]);
