import Phaser from "phaser";
import { Rng } from "../core/rng";
import {
  NOMS_METIER,
  REGLAGES_VILLAGE,
  creerHabitant,
  habitantDe,
  joursDeVivres,
  nourrir,
  RESSOURCES,
  stocksVides,
  travailler,
  type Habitant,
  type Metier,
  type PostureCivile,
  type Ressource,
  type Stocks,
} from "../core/habitants";
import { auPiedDeLEglise, EGLISE, POSTES, type Point, type PosteTravail } from "../core/carte";
import type { Peuplement } from "../core/peuplement";
import { combatDe, sortDefendre } from "../core/habitants";
import {
  choisirOccupation,
  prochainTour,
  REGLAGES_VIE,
  type Occupation,
} from "../core/vieAutonome";
import {
  EFFETS_RUPTURE,
  NOMS_RUPTURE,
  REGLAGES_STRESS,
  avancerLaJournee,
  coeurLache,
  contracterEtat,
  descendreStress,
  monterStress,
  prenomLibre,
  resistanceAuStress,
  soignerEtat,
  stressDesEtatsDe,
  verifierExploits,
  verifierRupture,

  type Personne,
} from "../core/personne";
import { ETATS, lireEtat, pireEtat } from "../core/etats";
import { SEQUELLES, idTrait } from "../core/traits";
import { ORDRE_RANGS } from "../core/classes";
import { mortsRecents, satisfactionDuVillage } from "../core/satisfaction";
import { calerCorps, ECHELLE_PERSONNAGE, type Hero } from "./entities";
import { TOLERANCE_ANCRE } from "../core/ordres";
import { PORTEE_BATISSEUR } from "./constructions";
import { assurerVillageois, plancheDe } from "./dessin/monde";
import { animer, nouvellePose } from "./poses";

/**
 * Le village vivant (DESIGN.md §4.18) : les habitants, leurs postes, la
 * production, la faim.
 *
 * Il vit dans son propre fichier pour une raison simple : `ArenaScene` fait
 * deja trois mille lignes. Tout ce qui suit se pilote par trois appels — une
 * mise a jour par image, une a l'aube, une a la tombee de la nuit.
 *
 * Les regles pures (cadence, progression, repas) sont dans `core/habitants.ts`
 * et testees ; ici il n'y a que du mouvement, des sprites et des minuteries.
 */

/** Ce que le village a besoin de savoir du monde exterieur, a chaque image. */
export interface ContexteVillage {
  /** Le monstre le plus proche de ce point, dans ce rayon, ou null */
  menaceAutour: (x: number, y: number, rayon: number) => { x: number; y: number } | null;
  /** Pour les annonces : elles passent par l'interface, jamais par un texte cree ici */
  annoncer: (message: string) => void;
  /**
   * L'eglise tient-elle debout ? C'est **la seule chose qui protege** un
   * habitant : il n'y a pas d'abri par proximite (§4.22).
   */
  egliseDebout: () => boolean;
  /** Son niveau : elle calme d'autant plus qu'elle est haute (§4.23) */
  niveauEglise: () => number;
  /** Combien de blesses elle traite a la fois — le champ `lits` du §4.22 */
  litsEglise: () => number;
  /**
   * Un defenseur frappe ce qui passe a sa portee.
   *
   * Ce fichier ne connait pas les monstres, et il ne doit pas : la scene se
   * charge de trouver la cible et de lui appliquer les degats.
   *
   * @returns vrai s'il a touche quelque chose
   */
  frapperMonstre: (x: number, y: number, portee: number, degats: number) => boolean;
  /**
   * Le village qu'on trouve : combien ils sont, ce que fait chacun, ce qu'il
   * leur reste (§4.29, `core/peuplement.ts`).
   */
  peuplement: Peuplement;
  /**
   * Les prenoms deja portes — le heros, et quiconque existe avant eux.
   *
   * ⚠️ Le village prenait jusqu'ici les premiers prenoms de la liste, dans
   * l'ordre. Avec trois habitants ca passait ; a vingt, un habitant finissait
   * par s'appeler comme le heros. `prenomLibre` est le seul endroit du jeu qui
   * distribue un nom (§4.18) : on lui dit ce qui est pris.
   */
  nomsPris: () => string[];
  /**
   * Ou vivent ceux qui n'ont pas de poste dehors — le devant de leur maison.
   *
   * ⚠️ **Sans ca, ils disparaissent.** Un habitant sans poste est « confine »,
   * donc il entre dans l'eglise, donc son corps est retire du monde. A trois
   * habitants ca ne se voyait pas : tous les trois avaient un poste. A vingt,
   * le forgeron, le charpentier et le guetteur s'evaporaient — et **la taille
   * d'un village est la premiere chose qu'on voit de loin** (§4.29).
   */
  placesDeVie: () => Point[];
  /**
   * Le chantier ouvert le plus proche, ou `null` s'il n'y en a aucun
   * (§4.20, §4.24, bloc 8).
   *
   * **C'est le poste du charpentier.** Il n'en a pas sur la carte, et il n'en
   * aura jamais : son poste, c'est ce qu'on vient de poser. Ce fichier ne
   * connait pas les constructions, et il ne doit pas — la scene lui dit
   * seulement ou aller.
   */
  chantierLePlusProche: (x: number, y: number) => Point | null;
  /**
   * Ca brule-t-il assez pres pour qu'on y coure ? (§4.21)
   *
   * Ce fichier ne connait pas les incendies, et il ne doit pas : il demande, la
   * scene repond.
   */
  feuAPortee: (x: number, y: number) => boolean;
  /**
   * Ou va celui qui porte un seau : **le puits s'il l'a vide, le feu s'il l'a
   * plein** (§4.21). `null` quand il n'y a plus rien a eteindre.
   */
  butDuSeau: (x: number, y: number, seauPlein: boolean) => Point | null;
  /**
   * La cour d'entrainement, et si quelqu'un y attend un instructeur
   * (§4.18, bloc 9). `null` tant qu'elle n'est pas batie.
   */
  courDEntrainement: () => { point: Point; attend: boolean } | null;
  /**
   * Quelqu'un tombe : la scene s'occupe de ce que ca produit (§4.26, bloc 11).
   *
   * ⚠️ **Ce fichier ne fait plus le deuil lui-meme.** Il appliquait le pic de
   * stress a tous les temoins, a l'identique ; depuis le bloc 11, ce que coute
   * une mort depend de la **relation** qu'on avait avec le mort — et les
   * relations vivent au-dessus, avec les heros dedans. Le village dit qui est
   * tombe et qui a vu ; la scene sait ce que ca change.
   */
  surLaMort: (
    mort: Personne,
    temoins: Personne[],
    x: number,
    y: number,
    /** Ce qu'on sait de sa mort : son metier, s'il s'etait arme (§4.26) */
    details: { metier?: string; arme?: string; faits?: string[] },
  ) => void;
  /**
   * Ce que la memoire du village pese sur la satisfaction en ce moment
   * (§4.26, bloc 11). Un nombre deja agrege, jamais une liste a parcourir.
   */
  memoireDuVillage: () => number;
  /** Quelqu'un craque et s'en prend aux siens : le village s'en souvient (§4.26) */
  surLaRage: (qui: Personne, temoins: Personne[]) => void;
  /**
   * Deux habitants se croisent et s'arretent (§4.27, bloc 12). La scene pose
   * la bulle : ce fichier ne sait pas dessiner.
   */
  uneRencontre: (un: Villageois, autre: Villageois, maintenant: number) => void;
  /** En craint-il un autre au point de s'ecarter ? (§4.26, la peur) */
  craint: (qui: Personne, autre: Personne) => boolean;
  /**
   * Doit-il quelque chose a quelqu'un d'assez vivant pour que ca compte ?
   * (§4.26) La dette fait accepter un ordre qu'on aurait refuse.
   */
  obeitMalgreTout: (qui: Personne) => boolean;
}

/**
 * Ou en est un habitant, cote mouvement.
 *
 * ⚠️ `abri` a change de sens et il faut le savoir : il ne veut plus dire
 * « arrive au village, donc sauf » — cet abri-la n'a jamais existe, le code
 * tuait quand meme. Il veut dire **entre dans l'eglise**, donc reellement hors
 * d'atteinte, et seulement tant qu'elle tient debout (DESIGN.md §4.22).
 *
 * `defend` est le nouveau : un courageux ressorti se poster a ses portes.
 *
 * `parle` est le seul etat que le village ne conduit pas : c'est la scene qui
 * mene celui qui sort nous parler a la porte, le jour ou l'on arrive (§4.29).
 * Tant qu'il le porte, le village le laisse tranquille — sans quoi il
 * repartirait travailler au milieu de sa phrase.
 */
type EtatVillageois = "au-poste" | "en-route" | "fuite" | "abri" | "defend" | "parle" | "mort";

/**
 * Ce que le corps d'un habitant montre de lui (§4.23, §4.30).
 *
 * L'usure suit le stress : a mi-chemin de la rupture il se voute, a la rupture
 * il est use jusqu'a la corde. Le sang, c'est l'hemorragie — le seul etat qui
 * tue en une journee, donc le seul qui ait droit au sang frais (§4.10).
 */
function corpsDe(personne: Personne): { usure: number; sang: number } {
  return {
    usure: Math.min(1, personne.stress / REGLAGES_STRESS.rupture),
    sang: personne.etats.some((e) => e.cle === "hemorragie") ? 1 : 0,
  };
}

/**
 * Le Bavard, resolu une fois au chargement.
 *
 * Les traits se comparent par identifiant numerique, jamais par texte (§4.23) —
 * et ce `idTrait()` ne doit surtout pas se retrouver dans une boucle.
 */
const TRAIT_BAVARD = idTrait("bavard");

/**
 * Combien de temps un lit met a purger un etat, en millisecondes.
 *
 * Vingt secondes : assez pour qu'on voie la file d'attente se former quand six
 * habitants rentrent malades, assez peu pour qu'une journee de 30 minutes en
 * soigne largement plus que ce qu'une nuit produit. C'est un premier jet, a
 * regler en jouant (§6).
 */
const DELAI_SOIN = 20_000;

/**
 * A quelle distance l'infection passe d'un travailleur a l'autre, en pixels.
 *
 * Assez court pour qu'ecarter deux postes suffise a s'en proteger — sinon la
 * decision que le §4.23 veut creer n'existerait pas.
 */
const RAYON_CONTAGION = 70;

/**
 * Le rayon de la ronde d'un milicien, autour de l'eglise, en pixels.
 *
 * *Chiffre tranche par le code.* Assez large pour couvrir les maisons et le
 * parvis, assez serre pour qu'un milicien ne parte pas defendre la mine :
 * il tient **les rues**, pas le territoire (§4.18).
 */
const RAYON_PATROUILLE = 150;

/** A quelle vitesse le point de ronde tourne, en radians par seconde. */
const VITESSE_DE_RONDE = 0.12;

/**
 * Dans quel rayon on se tient « dans la cour », en pixels.
 *
 * Plus large que l'emprise du batiment : on s'exerce **autour**, et un
 * instructeur colle au pixel du centre n'aurait aucun sens a l'ecran.
 */
const RAYON_DE_LA_COUR = 40;

/** Le pire palier d'un habitant, pour faire passer les mourants en premier. */
function palierDe(villageois: Villageois): number {
  return pireEtat(villageois.regles.personne.etats)?.palier ?? -1;
}

/**
 * Le poste d'un metier, s'il y en a un dehors.
 *
 * Quatre metiers sur sept sortent travailler — le pecheur, le bucheron, le
 * mineur, le fermier. Les trois autres — forgeron, charpentier, guetteur —
 * **restent au village** : ils n'ont pas de poste sur la carte, et leur
 * travail viendra au bloc 8 (§4.4, les ordres pour tous).
 */
function posteDe(metier: Metier): PosteTravail | null {
  return POSTES.find((p) => p.metier === metier) ?? null;
}

/**
 * Ou se tient exactement quelqu'un qui travaille a ce poste.
 *
 * L'ecart vient de son identifiant — donc il ne change ni d'une image a
 * l'autre, ni d'une reprise de partie a l'autre.
 */
function placeAuPoste(poste: PosteTravail, id: number): Point {
  return ecarter(poste.position, id, 14, 11);
}

/**
 * Le meme ecart, devant chez soi.
 *
 * ⚠️ **Il faut le meme ici**, et pour la meme raison qu'aux postes : un
 * village peut compter plus de tetes que de toits debout — onze habitants pour
 * neuf maisons, vu en verifiant —, et deux habitants se retrouvaient alors au
 * **meme pixel**. Plus serre qu'a un poste : on se tient devant sa porte, pas
 * dans la rue.
 */
function placeChezSoi(chezSoi: Point, id: number): Point {
  // ⚠️ **Jamais un ecart nul** : a zero, un habitant sur trois se tenait au
  // centre exact de sa case, et deux qui partageaient la meme place — il y a
  // plus de tetes que de places dans un gros village — finissaient au meme
  // pixel. Vu en verifiant, a vingt habitants.
  return ecarter(chezSoi, id, 5, 6);
}

/**
 * De combien on s'eloigne de chez soi quand on flane (§4.27).
 *
 * *Chiffre tranche par le code.* Quatre-vingts pixels, soit deux cases et
 * demie : assez pour qu'on voie quelqu'un bouger, pas assez pour qu'il
 * traverse le village et disparaisse derriere une maison.
 */
const RAYON_DE_FLANERIE = 80;

/** Un point ecarte du centre, toujours le meme pour un identifiant donne. */
function ecarter(centre: Point, id: number, base: number, pas: number): Point {
  // L'angle d'or : deux identifiants voisins ne tombent jamais au meme
  // endroit, ce qu'un simple `id % 4` faisait des qu'un habitant mourait.
  const angle = id * 2.399963;
  const rayon = base + (id % 4) * pas;
  return {
    x: centre.x + Math.cos(angle) * rayon,
    y: centre.y + Math.sin(angle) * rayon * 0.7,
  };
}

/**
 * Un habitant a l'ecran.
 *
 * Il ne se bat jamais et il n'a aucune statistique de combat (§4.18) : tout ce
 * qu'il sait faire, c'est aller a son poste, y travailler, et courir.
 */
export class Villageois extends Phaser.Physics.Arcade.Sprite {
  readonly regles: Habitant;
  /**
   * Ou il travaille. Modifiable : le §4.18 dit que **le joueur decide qui fait
   * quoi** — c'est meme la seule chose qu'il decide de la production.
   */
  poste: PosteTravail | null;
  etat: EtatVillageois = "en-route";

  /** Prochain instant ou il peut frapper, quand il defend l'eglise (§4.18) */
  prochainCoup = 0;

  /**
   * Ce qu'il fait de sa journee quand personne ne lui a rien demande
   * (§4.27, bloc 12). `null` tant qu'on ne l'a pas encore reveille.
   */
  occupation: Occupation | null = null;
  /** Vrai quand il revient du puits, les mains pleines (§4.21) */
  seauPlein = false;
  /**
   * Ou il se rend en flanant.
   *
   * ⚠️ **Pose par le tour de role, jamais par l'image qui l'affiche.** Un
   * point tire a chaque image donnerait un habitant qui tremble sur place,
   * et trente tirages par image (§4.17).
   */
  butDeFlanerie: Point | null = null;
  /**
   * Jusqu'a quand il est en pleine conversation, et a partir de quand il
   * acceptera la suivante (§4.27).
   *
   * ⚠️ **Sans ces deux-la, personne ne flane jamais.** Vu en jouant : dans un
   * village de huit, tout le monde se tient pres de l'eglise, donc tout le
   * monde a un voisin a portee, donc tout le monde discute — en boucle, et
   * plus rien ne bouge. Une conversation dure, puis elle laisse la place.
   */
  discuteJusqua = 0;
  prochaineDiscussion = 0;

  /**
   * Sa place sur le village — la ou il se tient quand il n'a pas de poste
   * dehors.
   *
   * Le forgeron, le charpentier et le guetteur n'ont rien a faire sur la carte
   * avant le bloc 8 (§4.4). Sans ce point, ils entraient dans l'eglise des la
   * premiere image et **disparaissaient du monde** : un village de vingt en
   * montrait sept (§4.29).
   */
  placeDeVie: Point | null = null;

  /**
   * Le point qu'on lui a demande de tenir (DESIGN.md §4.4, bloc 8).
   *
   * **C'est exactement l'ancre d'un heros**, et elle a le meme effet : tant
   * qu'elle est posee, il ne retourne pas a son poste. Le §4.4 n'a qu'un seul
   * objet `Ordre` pour les trois populations — un habitant n'avait simplement
   * rien pour le porter jusqu'ici.
   */
  ancre: Point | null = null;

  /** Le second cas de l'ancre : une entite a suivre, recopiee a chaque image. */
  suit: Hero | null = null;

  /** Sa planche du moment : son metier, et l'etat de son corps (voir `poses.ts`) */
  familleSprite: string;
  /** Le geste en cours, comme pour les combattants */
  pose = nouvellePose();

  constructor(scene: Phaser.Scene, regles: Habitant, poste: PosteTravail | null) {
    // Il nait a l'eglise : c'est de la qu'il part travailler, et c'est la qu'il
    // revient. Tout converge dessus (§4.22).
    const famille = assurerVillageois(scene, regles.metier, corpsDe(regles.personne));
    super(scene, EGLISE.x, EGLISE.y, plancheDe(famille), 0);
    this.familleSprite = famille;
    this.regles = regles;
    this.poste = poste;

    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setScale(ECHELLE_PERSONNAGE);
    calerCorps(this, 8, 10);
  }

  /**
   * Sa planche suit son metier et son corps.
   *
   * ⚠️ Appelee au changement de poste et par battement de moral, jamais par
   * image : cuire une planche coute, et un habitant ne change de cran d'usure
   * que quelques fois par partie.
   */
  rhabiller(): void {
    if (!this.regles.vivant) return;
    const famille = assurerVillageois(this.scene, this.regles.metier, corpsDe(this.regles.personne));
    if (famille === this.familleSprite) return;
    this.familleSprite = famille;
    this.setTexture(plancheDe(famille), 0);
    // Le geste en cours repart sur la nouvelle planche a la prochaine image.
    this.pose.type = null;
  }

  get nom(): string {
    return this.regles.personne.nom;
  }

  /** Sa couche commune avec les heros : stats, traits, stress, etats (§4.23). */
  get personne(): Personne {
    return this.regles.personne;
  }
}

export class Village {
  readonly stocks: Stocks = stocksVides();
  readonly habitants: Villageois[] = [];
  /** Le groupe physique : c'est lui que la scene fait se rencontrer aux monstres */
  readonly groupe: Phaser.Physics.Arcade.Group;

  /** Instant de fin du rappel general ; jusque-la, tout le monde rentre */
  private clocheJusqua = 0;
  /** Vrai la nuit : les "prudents" ne ressortent pas tant qu'il fait noir */
  private nuit = false;

  /**
   * Le moral avance par **battements**, jamais par image (§4.23).
   *
   * Un stress qui monte avec 500 ms de retard, personne ne le voit ; trente
   * personnes reveillees soixante fois par seconde, tout le monde le sent.
   */
  private prochainBattement = 0;
  private static readonly PERIODE_MORAL = 500;
  /** Instant du prochain soin possible a l'eglise */
  private prochainSoin = 0;

  /** La journee de chaque mort, pour que la satisfaction s'en souvienne (§4.23) */
  private readonly journeesDesMorts: number[] = [];
  /**
   * Les survivants morts en chemin (§4.18).
   *
   * ⚠️ **Une liste a part, et pas une entree de plus dans `journeesDesMorts`.**
   * Celle-la nourrit **aussi** la satisfaction ; or le §4.18 ne fait payer une
   * mort en chemin qu'a la **rumeur** — le village ne pleure pas quelqu'un
   * qu'il n'a jamais vu. Les melanger aurait fait baisser le moral de gens qui
   * ignorent tout de l'affaire.
   */
  private readonly journeesDesMortsEnChemin: number[] = [];
  /** La maison qu'on donnera au prochain habitant */
  private placeSuivante = 0;
  /** Ou en est le tour de role de la vie autonome (§4.27, bloc 12) */
  private curseurVieAutonome = 0;
  /** La journee en cours, tenue par la scene a chaque aube */
  private journee = 1;
  /** Le dernier chiffre calcule, pour ne pas le refaire a chaque image */
  private satisfactionCourante = 50;

  private readonly scene: Phaser.Scene;
  private readonly contexte: ContexteVillage;
  /**
   * Le tirage du village : les statistiques, les traits et les visages de ses
   * habitants en sortent.
   *
   * ⚠️ **Il est seede par le village qu'on a trouve**, et plus par une
   * constante. Avant le §4.29 il n'y avait qu'un village, toujours le meme :
   * une graine fixe donnait toujours les trois memes personnes, et c'etait une
   * qualite — on apprenait son village comme sa carte (§4.6). Depuis qu'on en
   * traverse plusieurs, deux villages a l'autre bout du monde se seraient
   * ressemble jusqu'au nom. La regle tient toujours, elle tient juste par
   * village : **une graine, un village**.
   */
  private readonly rng: Rng;

  constructor(scene: Phaser.Scene, contexte: ContexteVillage) {
    this.scene = scene;
    this.contexte = contexte;
    this.groupe = scene.physics.add.group();
    this.rng = new Rng(contexte.peuplement.graine);

    // Le village qu'on a trouve, tel qu'il est (§4.29) : de un a vingt, avec
    // ses metiers et ses reserves. Ce n'est plus le trio de ruines d'avant —
    // c'en est un cas particulier, celui d'un village de trois.
    //
    // Les champs restent vides tant qu'ils sont peu : y mettre quelqu'un veut
    // dire le retirer du bois ou du minerai, et c'est la seule decision de
    // production que le §4.18 accorde au joueur (`ORDRE_DES_METIERS`).
    const pris = [...contexte.nomsPris()];
    for (const metier of contexte.peuplement.metiers) {
      const nom = prenomLibre(this.rng, pris);
      pris.push(nom);
      this.ajouter(creerHabitant(nom, metier, "F", this.rng), posteDe(metier));
    }

    // Ce qu'il leur restait dans les reserves. Un village qu'on trouve n'a pas
    // vecu de rien jusqu'a nous.
    for (const ressource of RESSOURCES) this.stocks[ressource] = contexte.peuplement.stocks[ressource];
  }

  ajouter(regles: Habitant, poste: PosteTravail | null): Villageois {
    const villageois = new Villageois(this.scene, regles, poste);
    // Chacun sa place sur le village, dans l'ordre ou ils arrivent : les plus
    // pres de l'eglise d'abord (§4.29). S'il y a plus de monde que de places,
    // on repart au debut — on se serre, et l'ecart de `placeChezSoi` fait que
    // deux voisins ne tiennent pas le meme pas de porte.
    const places = this.contexte.placesDeVie();
    if (places.length > 0) villageois.placeDeVie = places[this.placeSuivante++ % places.length]!;
    this.habitants.push(villageois);
    this.groupe.add(villageois);
    return villageois;
  }

  /**
   * On lui a ouvert la porte (DESIGN.md §4.18).
   *
   * Il garde **sa** personne : le visage, les traits et le nom que le joueur a
   * regardes a la porte sont ceux qui entrent. Il prend le poste de son metier
   * s'il en existe un ; sinon il reste au village, ce qui est deja le cas de la
   * moitie des metiers (forgeron, charpentier, guetteur).
   *
   * ⚠️ Rien ici ne sait s'il est fou. C'est volontaire : le degre de folie vit
   * dans `core/arrivants.ts`, dans une liste que le village n'a jamais en main
   * (§4.18). Un habitant accepte est un habitant, point.
   */
  accueillir(personne: Personne, metier: Metier): Villageois {
    const poste = POSTES.find((p) => p.metier === metier) ?? null;
    const villageois = this.ajouter(habitantDe(personne, metier), poste);
    // Il arrive de la route, pas de l'eglise : sans ca il apparaitrait au centre
    // du village comme s'il y avait toujours ete.
    villageois.setPosition(poste?.position.x ?? EGLISE.x, poste?.position.y ?? EGLISE.y);
    this.recalculerSatisfaction();
    return villageois;
  }

  /**
   * Les malades que le monde avait deja (§4.29, le budget).
   *
   * Un beau village se paie, et il se paie **aussi** en gens qui toussent
   * depuis avant nous. On les pose a l'installation et pas avant : le §4.29
   * interdit de dire a la porte ce qui ne se voit pas de loin, et une epidemie
   * tue n'est pas un mensonge du village — c'est son role.
   *
   * Le tirage sort du generateur du village : meme monde, memes malades.
   *
   * @returns les noms de ceux qui sont touches, pour l'annonce
   */
  poserLesMalades(combien: number): string[] {
    const candidats = this.habitants.filter((v) => v.regles.vivant);
    const touches: string[] = [];
    while (touches.length < combien && candidats.length > 0) {
      const villageois = candidats.splice(this.rng.int(0, candidats.length - 1), 1)[0]!;
      if (!contracterEtat(villageois.regles.personne, "maladie")) continue;
      touches.push(villageois.nom);
    }
    return touches;
  }

  /** Un habitant par son identifiant — c'est par la que les fous designent. */
  parId(id: number): Villageois | null {
    return this.habitants.find((v) => v.regles.id === id) ?? null;
  }

  /**
   * Il quitte le village de lui-meme : c'est ce que fait un voleur (§4.18).
   *
   * Ce n'est **pas** une mort — ni deuil, ni memoire des morts, ni satisfaction
   * en berne. Le village constate un depart, et il ne sait meme pas que c'en
   * etait un.
   */
  retirer(villageois: Villageois): void {
    const index = this.habitants.indexOf(villageois);
    if (index >= 0) this.habitants.splice(index, 1);
    villageois.destroy();
    this.recalculerSatisfaction();
  }

  /** Les habitants encore en vie. C'est la condition de defaite (§4.18). */
  get vivants(): Villageois[] {
    return this.habitants.filter((v) => v.regles.vivant);
  }

  /**
   * Le village se vide, puis la sauvegarde le repeuple (§4.28).
   *
   * Le constructeur pose toujours les trois habitants du depart : c'est ce qu'il
   * faut pour une partie neuve, et c'est exactement ce qu'il ne faut pas pour
   * une partie reprise. Les effacer ici coute moins cher que de dupliquer la
   * construction du village en deux chemins qui divergeraient un jour.
   */
  vider(): void {
    for (const villageois of this.habitants) villageois.destroy();
    this.habitants.length = 0;
    this.journeesDesMorts.length = 0;
    this.journeesDesMortsEnChemin.length = 0;
  }

  /**
   * On reprend la partie a cette journee-la (§4.28).
   *
   * La memoire des morts revient avec : sans elle, une nuit desastreuse serait
   * oubliee par la satisfaction au premier rechargement.
   */
  reprendre(journee: number, journeesDesMorts: number[]): void {
    this.journee = journee;
    this.journeesDesMorts.push(...journeesDesMorts);
    this.recalculerSatisfaction();
  }

  /** La memoire des morts, pour la sauvegarde. */
  get memoireDesMorts(): number[] {
    return [...this.journeesDesMorts];
  }

  /** Ceux qu'on n'a pas ramenes. Ils ne comptent que pour la rumeur (§4.18). */
  get memoireDesMortsEnChemin(): number[] {
    return [...this.journeesDesMortsEnChemin];
  }

  /** Un survivant est tombe avant d'arriver. */
  noterUneMortEnChemin(): void {
    this.journeesDesMortsEnChemin.push(this.journee);
  }

  get population(): number {
    return this.vivants.length;
  }

  /** Le village est tombe : plus personne pour l'habiter. */
  get eteint(): boolean {
    return this.population === 0;
  }

  get joursDeVivres(): number {
    return joursDeVivres(
      this.habitants.map((v) => v.regles),
      this.stocks,
    );
  }

  // ------------------------------------------------------------ le cycle

  /**
   * La cloche du centre du village (§4.18).
   *
   * L'outil de l'urgence : quand une horde tombe en plein jour, on n'a pas le
   * temps d'ouvrir un panneau et de changer sept postures une par une.
   */
  sonnerCloche(): void {
    this.clocheJusqua = this.scene.time.now + 20_000;
    this.contexte.annoncer("La cloche sonne — tout le monde rentre !");
  }

  tomberLaNuit(): void {
    this.nuit = true;
  }

  /**
   * L'aube : on mange, les etats s'aggravent, et une journee de plus a passe.
   *
   * C'est le seul endroit ou le temps **long** avance (§4.23) : les etats se
   * comptent en journees, pas en millisecondes, et les melanger a toujours fini
   * en bug.
   *
   * @param journee le numero de la journee qui commence
   * @returns le nombre d'habitants qui ont eu faim
   */
  seLever(journee = this.journee + 1): number {
    this.nuit = false;
    this.journee = journee;

    const affames = nourrir(
      this.habitants.map((v) => v.regles),
      this.stocks,
    );
    if (affames > 0) {
      // Le message dit quoi faire, et ce n'est pas du confort : un village
      // entierement affame ne produit plus rien, donc ne se nourrit plus jamais.
      // La sortie existe — le joueur peut pecher lui-meme, bien plus vite qu'un
      // habitant (§4.18) — mais elle ne se devine pas.
      this.contexte.annoncer(
        `${affames} habitant${affames > 1 ? "s ont" : " a"} faim — allez pecher vous-meme`,
      );
    }

    for (const villageois of [...this.habitants]) {
      if (!villageois.regles.vivant) continue;
      this.passerLaJournee(villageois);
    }

    this.recalculerSatisfaction();
    return affames;
  }

  /**
   * Une journee de plus pour un habitant : repas, etats, exploits.
   *
   * L'ordre compte. On nourrit d'abord (c'est ce qui calme), on aggrave
   * ensuite (c'est ce qui tue), on verifie les exploits en dernier — sinon un
   * mourant gagnerait un trait dans la meme image que sa mort.
   */
  private passerLaJournee(villageois: Villageois): void {
    const { personne } = villageois.regles;

    if (villageois.regles.rassasie) {
      descendreStress(personne, REGLAGES_STRESS.parRepas);
      // La lethargie est le seul etat qui se soigne tout seul : elle vient du
      // ventre vide, elle repart avec le ventre plein (§4.23).
      const index = personne.etats.findIndex((e) => e.cle === "lethargie");
      if (index >= 0) personne.etats.splice(index, 1);
    } else if (this.stocks.poisson + this.stocks.ble <= 0) {
      // Le palier **avant** la famine mortelle : il ne produit plus rien et
      // s'assoit par terre. Il ne meurt toujours pas de faim (§4.18).
      if (contracterEtat(personne, "lethargie")) {
        this.contexte.annoncer(`${villageois.nom} n'a plus la force de travailler`);
      }
    }

    for (const evenement of avancerLaJournee(personne, 1)) {
      if (evenement.quoi === "mort") {
        this.contexte.annoncer(`${villageois.nom} n'a pas survecu — ${evenement.nom}`);
        this.tuer(villageois);
        return;
      }
      this.contexte.annoncer(`${villageois.nom} : ${evenement.nom}`);
    }

    // Trente journees au meme poste font un Routinier (§4.23).
    personne.exploits.journeesAuPoste += 1;
    for (const cle of verifierExploits(personne)) {
      this.contexte.annoncer(`${villageois.nom} devient ${cle}`);
    }
  }

  /** Ce que le joueur ramasse lui-meme, a la main (§4.18). */
  recolter(ressource: Ressource, quantite: number): void {
    this.stocks[ressource] += quantite;
  }

  /**
   * Il sort defendre, de lui-meme (DESIGN.md §4.27, bloc 12).
   *
   * ⚠️ **Ca ne le condamne pas.** Il passe en posture de travail, donc la
   * cloche le rappelle et le rayon de fuite le fait rentrer comme tout le
   * monde. Le §4.27 l'exige : une initiative ne fait jamais perdre un
   * habitant sans que le joueur ait pu reagir.
   */
  envoyerDefendre(villageois: Villageois): void {
    if (!villageois.regles.vivant) return;
    villageois.regles.posture = "travail";
    villageois.ancre = { x: EGLISE.x, y: EGLISE.y };
    villageois.butDeFlanerie = null;
  }

  /**
   * Un ancien milicien rassemble ceux qui tiennent encore debout (§4.27).
   *
   * **Trois au plus** : une milice improvisee n'est pas une armee, et le
   * §4.18 rappelle que se battre, c'est ne pas produire.
   */
  rassembler(combien: number): number {
    let pris = 0;
    for (const villageois of this.habitants) {
      if (pris >= combien) break;
      if (!villageois.regles.vivant || villageois.ancre !== null) continue;
      if (villageois.regles.personne.rupture !== null) continue;
      this.envoyerDefendre(villageois);
      pris += 1;
    }
    return pris;
  }

  /**
   * Quelqu'un s'est servi dans les reserves (§4.27, le Kleptomane).
   *
   * On prend sur **la ressource la plus abondante** : c'est celle qu'on
   * remarque le moins, et c'est exactement ce qu'un voleur choisit.
   */
  seServir(combien: number): Ressource | null {
    let cible: Ressource | null = null;
    let meilleur = combien;
    for (const r of RESSOURCES) {
      if (this.stocks[r] <= meilleur) continue;
      meilleur = this.stocks[r];
      cible = r;
    }
    if (cible === null) return null;
    this.stocks[cible] -= combien;
    return cible;
  }

  changerPosture(villageois: Villageois, posture: PostureCivile): void {
    villageois.regles.posture = posture;
  }

  /**
   * L'envoyer a un autre poste (DESIGN.md §4.18).
   *
   * Il garde son **niveau** en changeant de metier : ce niveau, il l'a gagne en
   * travaillant, pas en apprenant un geste. Le punir d'un changement de poste
   * rendrait la seule decision de production du jeu trop chere pour etre prise.
   */
  changerPoste(villageois: Villageois, poste: PosteTravail): void {
    villageois.poste = poste;
    villageois.regles.metier = poste.metier;
    // Un ordre de travail annule le point qu'on lui tenait de tenir : sinon
    // l'envoyer a la mine ne ferait rien, et le joueur croirait a un bug.
    villageois.ancre = null;
    villageois.suit = null;
    villageois.rhabiller();
    this.contexte.annoncer(`${villageois.nom} part ${poste.nom.toLowerCase()}`);
  }

  /**
   * Lui donner un metier, poste ou pas (DESIGN.md §4.4, bloc 8).
   *
   * Quatre metiers sur sept ont un poste sur la carte ; le forgeron, le
   * charpentier et le guetteur travaillent au village. Ils existaient dans les
   * donnees depuis le bloc 2 **sans qu'on puisse les donner a personne** — le
   * tableau ne savait que faire tourner les postes. C'est cette porte-la que
   * le menu d'ordres ouvre.
   */
  changerMetier(villageois: Villageois, metier: Metier): void {
    const poste = posteDe(metier);
    if (poste) {
      this.changerPoste(villageois, poste);
      return;
    }
    villageois.poste = null;
    villageois.regles.metier = metier;
    villageois.ancre = null;
    villageois.suit = null;
    villageois.rhabiller();
    this.contexte.annoncer(`${villageois.nom} passe ${NOMS_METIER[metier].toLowerCase()}`);
  }

  /** Combien d'habitants sont en ce moment **dans** l'eglise (§4.22). */
  get refugies(): number {
    return this.habitants.filter((v) => v.regles.vivant && v.etat === "abri").length;
  }

  /**
   * Ceux qui sont **dehors** au sens des portes (§4.20, bloc 7b) : a leur
   * poste, en route, ou en fuite. Ni ceux qui sont dans l'eglise, ni ceux qui
   * tiennent ses portes — eux sont dans la cour, et la cloche n'a pas a les
   * attendre. Ca se lit sur les habitants, jamais sur la geometrie des murs.
   */
  get dehors(): Villageois[] {
    return this.habitants.filter(
      (v) => v.regles.vivant && (v.etat === "au-poste" || v.etat === "en-route" || v.etat === "fuite"),
    );
  }

  /**
   * Celui qui sort nous parler quand on arrive a la porte (§4.29).
   *
   * **Le premier qui nous voit**, pas un personnage de plus a fabriquer : le
   * vivant le plus proche de nous. S'ils sont tous rentres, on en fait sortir
   * un — quelqu'un finit toujours par venir voir qui est devant le mur.
   *
   * @param cout ce qui mesure « proche ». Par defaut la distance a vol
   *        d'oiseau ; la scene lui passe le **nombre de pas** de son champ de
   *        directions, parce qu'un voisin de l'autre cote du mur n'est pas
   *        proche du tout — il aurait tout le tour a faire.
   */
  appelerQuelquun(
    x: number,
    y: number,
    cout: (v: Villageois) => number = (v) => Math.hypot(v.x - x, v.y - y),
  ): Villageois | null {
    let choisi: Villageois | null = null;
    let meilleure = Infinity;
    for (const v of this.habitants) {
      if (!v.regles.vivant || v.etat === "abri") continue;
      const d = cout(v);
      if (d < meilleure) {
        meilleure = d;
        choisi = v;
      }
    }
    if (choisi) return choisi;

    const premier = this.habitants.find((v) => v.regles.vivant);
    if (!premier) return null;
    this.sortirDeLEglise(premier);
    return premier;
  }

  /**
   * Tout le village prend les armes contre nous (DESIGN.md §4.29).
   *
   * C'est ce qui arrive quand on refuse **en face** un village desespere. Il
   * rend de quoi les refaire de l'autre cote — leur place, leur visage, leur
   * nom — puis **il se vide** : ces gens-la ne sont plus des habitants, ils
   * sont ce qui nous court apres.
   *
   * ⚠️ **Le village ne s'en remet pas, et c'est le but** : un village qui nous
   * attaque n'est plus un village ou l'on peut s'installer. On se bat, on
   * survit, et on reprend la route.
   */
  prendreLesArmes(): { x: number; y: number; famille: string; nom: string }[] {
    const partants: { x: number; y: number; famille: string; nom: string }[] = [];
    for (const v of this.habitants) {
      if (!v.regles.vivant) continue;
      // Celui qui s'etait mis a l'abri ressort : son corps est desactive, et
      // sa position est restee celle de l'eglise.
      this.sortirDeLEglise(v);
      partants.push({ x: v.x, y: v.y, famille: v.familleSprite, nom: v.nom });
    }
    for (const v of this.habitants) {
      v.setVelocity(0, 0);
      v.destroy();
    }
    this.habitants.length = 0;
    return partants;
  }

  /** Combien tiennent ses portes. */
  get defenseurs(): number {
    return this.habitants.filter((v) => v.regles.vivant && v.etat === "defend").length;
  }

  /**
   * L'eglise vient de tomber : tout le monde ressort, au milieu d'eux (§4.22).
   *
   * C'est le vrai prix de sa chute, et il faut qu'il se voie a l'instant meme
   * ou elle s'effondre — pas a la fin de la nuit.
   */
  viderLEglise(): void {
    let sortis = 0;
    for (const villageois of this.habitants) {
      if (!villageois.regles.vivant || villageois.etat !== "abri") continue;
      villageois.enableBody(true, EGLISE.x, EGLISE.y, true, true);
      villageois.etat = "fuite";
      sortis++;
    }
    if (sortis > 0) {
      this.contexte.annoncer(`${sortis} habitant${sortis > 1 ? "s" : ""} se retrouve` +
        `${sortis > 1 ? "nt" : ""} dehors`);
    }
  }

  /** Ceux qui sont a leur poste et qui travaillent vraiment, par metier. */
  auTravail(metier: Metier): Habitant[] {
    return this.habitants
      .filter((v) => v.regles.vivant && v.etat === "au-poste" && v.regles.metier === metier)
      .map((v) => v.regles);
  }

  // -------------------------------------------------------------- boucle

  /**
   * Une image de village.
   *
   * @param delta millisecondes ecoulees
   */
  majorer(delta: number): void {
    const rappel = this.scene.time.now < this.clocheJusqua;

    for (const villageois of this.habitants) {
      if (!villageois.regles.vivant) continue;
      // Celui qui vient nous parler a la porte est mene par la scene : ici on
      // ne fait que l'animer, pour qu'il marche comme tout le monde (§4.29).
      if (villageois.etat !== "parle") this.majorerUn(villageois, delta, rappel);
      this.animerUn(villageois);
    }

    // ⚠️ **Apres les corps, et au tour de role** (§4.27) : la vie autonome
    // decide, elle ne deplace pas. Trois habitants par image, jamais trente.
    this.reveillerLaVieAutonome(this.scene.time.now);
    this.majorerLeMoral();
  }

  /**
   * Le geste d'un habitant, une fois par image (§4.30).
   *
   * Au poste, il travaille — c'est le seul moment ou l'outil est en main. Le
   * reste du temps, il marche ou il respire, exactement comme un combattant :
   * `animer` ne redemarre rien si l'animation tourne deja.
   */
  private animerUn(villageois: Villageois): void {
    if (villageois.etat === "abri") return;
    const corps = villageois.body as Phaser.Physics.Arcade.Body | null;
    if (villageois.etat === "au-poste") {
      villageois.play(`${villageois.familleSprite}-travail`, true);
      return;
    }
    animer(villageois, villageois.pose, corps ? corps.velocity.length() : 0, this.scene.time.now);
  }

  /**
   * Le moral de tout le monde, par battements de 500 ms.
   *
   * ⚠️ **C'est le respect du §4.17 qui dicte cette forme.** Cinq couches sur
   * trente personnes a soixante images par seconde, c'est exactement le genre de
   * chose qui fait ramer un jeu si on l'ecrit naivement. Ici : un horodatage,
   * une passe, et l'agregat de chacun est deja calcule — rien n'est recalcule.
   */
  private majorerLeMoral(): void {
    const maintenant = this.scene.time.now;
    if (maintenant < this.prochainBattement) return;

    const periode = Village.PERIODE_MORAL;
    this.prochainBattement = maintenant + periode;
    const minutes = periode / 60_000;

    // Ce qui est commun a toute la passe se calcule une fois, jamais par
    // habitant (§4.17, regle 5).
    const eglise = this.contexte.egliseDebout();
    const apaisement = eglise
      ? REGLAGES_STRESS.multiplicateurEglise * (0.8 + this.contexte.niveauEglise() * 0.2)
      : 0;
    const rayonnement = this.rayonnementDuVoisinage();

    for (const villageois of this.habitants) {
      if (!villageois.regles.vivant) continue;
      this.majorerLeMoralDUn(villageois, minutes, apaisement, rayonnement, maintenant);
      // L'usure se voit sur le corps (§4.30) : c'est ici, par battement, qu'il
      // change de planche s'il a change de cran.
      villageois.rhabiller();
    }

    if (eglise) this.tenirLInfirmerie(maintenant);
    this.propagerLInfection();
  }

  /**
   * L'infection fongique se transmet a qui travaille a cote (DESIGN.md §4.23).
   *
   * **C'est le premier etat contagieux du jeu**, et il transforme le placement
   * des postes en decision : mettre quatre bucherons cote a cote devient un
   * pari. C'est aussi la premiere raison mecanique de **separer** ses gens au
   * lieu de les entasser.
   *
   * La boucle n'est quadratique qu'en apparence : elle sort tout de suite s'il
   * n'y a aucun infecte, ce qui est le cas la quasi-totalite de la partie.
   */
  private propagerLInfection(): void {
    const porteurs = this.habitants.filter(
      (v) => v.regles.vivant && v.regles.personne.etats.some((e) => ETATS[e.cle].contagieux),
    );
    if (porteurs.length === 0) return;

    for (const porteur of porteurs) {
      for (const voisin of this.habitants) {
        if (voisin === porteur || !voisin.regles.vivant) continue;
        if (voisin.etat !== "au-poste" && porteur.etat !== "au-poste") continue;
        if (Phaser.Math.Distance.Between(porteur.x, porteur.y, voisin.x, voisin.y) > RAYON_CONTAGION) {
          continue;
        }
        // Un Maladif attrape deux fois plus vite ; par battement de 500 ms, ca
        // laisse une bonne minute de voisinage avant qu'il ne prenne.
        if (!this.rng.chance(0.012 * voisin.regles.personne.mods.contagion)) continue;
        if (contracterEtat(voisin.regles.personne, "infection")) {
          this.contexte.annoncer(`${voisin.nom} a attrape l'infection de ${porteur.nom}`);
        }
      }
    }
  }

  /**
   * L'eglise purge les etats de ceux qui sont dedans (DESIGN.md §4.22).
   *
   * ⚠️ **Elle ne soigne pas tout le monde d'un coup**, et c'est ce qui rend le
   * niveau d'eglise utile : elle a des **lits**, et un lit traite une personne
   * a la fois. Le champ `lits` etait pose au bloc 4 en attendant precisement ce
   * branchement.
   *
   * Le rythme passe par un horodatage verifie dans la boucle, jamais par une
   * minuterie (§4.17, regle 4).
   */
  private tenirLInfirmerie(maintenant: number): void {
    if (maintenant < this.prochainSoin) return;
    this.prochainSoin = maintenant + DELAI_SOIN;

    // On soigne d'abord le plus atteint : c'est aussi celui qui repartira avec
    // une sequelle, et c'est tout l'interet de la decision.
    const lits = this.contexte.litsEglise();
    const patients = this.habitants
      .filter((v) => v.regles.vivant && v.etat === "abri" && v.regles.personne.etats.length > 0)
      .sort((a, b) => palierDe(b) - palierDe(a))
      .slice(0, lits);

    for (const patient of patients) this.soignerALEglise(patient);
  }

  private majorerLeMoralDUn(
    villageois: Villageois,
    minutes: number,
    apaisement: number,
    rayonnement: number,
    maintenant: number,
  ): void {
    const { regles } = villageois;
    const { personne } = regles;
    const r = REGLAGES_STRESS;

    // --- ce qui monte
    let montee = rayonnement + stressDesEtatsDe(personne);
    if (!regles.rassasie) montee += r.faim;

    const abrite = villageois.etat === "abri";
    if (!abrite) {
      if (this.nuit && !personne.mods.ignoreStressNuit) montee += r.dehorsLaNuit;
      if (this.contexte.menaceAutour(villageois.x, villageois.y, REGLAGES_VILLAGE.distanceDeFuite)) {
        montee += r.menaceEnVue;
      }
      // Celui qu'on n'arrete jamais monte : il faut faire tourner les equipes
      // plutot qu'exploiter les trois meilleurs (§4.23).
      if (villageois.etat === "au-poste") montee += r.travailSansRepos;
    }

    if (montee > 0) {
      const resistance = resistanceAuStress(
        ORDRE_RANGS.indexOf(regles.rang),
        regles.niveau,
        personne.stats,
      );
      monterStress(personne, montee * minutes * resistance);
    }

    // --- ce qui descend : le repos au village, et l'eglise par-dessus
    const auRepos = abrite || (villageois.etat !== "au-poste" && villageois.etat !== "defend");
    if (auRepos && !this.nuit) {
      const rendu = r.reposAuVillage * (abrite ? apaisement * personne.mods.soinEglise : 1);
      descendreStress(personne, rendu * minutes);
    }

    this.verifierLaRupture(villageois, maintenant);
  }

  /**
   * Ce que les voisins font au stress de tout le monde, en points par minute.
   *
   * Un seul chiffre pour tout le village, et c'est volontaire : le §4.23 veut
   * qu'un Boucher use les civils et qu'une Legende locale les calme, pas qu'on
   * calcule trente distances trente fois. Le jour ou ca devra etre local, ce
   * sera au bloc 11 avec les relations (§4.26).
   */
  private rayonnementDuVoisinage(): number {
    let total = 0;
    for (const villageois of this.habitants) {
      if (!villageois.regles.vivant) continue;
      const { personne } = villageois.regles;
      if (personne.mods.stressVoisins === 0) continue;

      // Le Bavard remonte les siens quand il va bien et les use quand il va
      // mal : c'est le seul trait dont le signe depend de son porteur.
      const bavard = personne.traits.includes(TRAIT_BAVARD);
      const signe = bavard && personne.stress < REGLAGES_STRESS.seuilVisible ? -1 : 1;
      total += personne.mods.stressVoisins * signe;

      // Une dispute use ses voisins tant qu'elle dure (§4.23).
      if (personne.rupture === "rage") total += 0.4;
    }
    return total;
  }

  /**
   * Il craque, ou son coeur lache.
   *
   * **Un villageois qui craque ne frappe jamais personne** — au pire il lache
   * son poste. Avec vingt habitants, l'autre regle declencherait une spirale de
   * meurtres internes qu'aucun joueur ne peut arreter (§4.23).
   */
  private verifierLaRupture(villageois: Villageois, maintenant: number): void {
    const { personne } = villageois.regles;

    if (coeurLache(personne)) {
      this.contexte.annoncer(`${villageois.nom} s'effondre — son coeur a lache`);
      this.tuer(villageois);
      return;
    }

    const rupture = verifierRupture(personne, maintenant, this.rng);
    if (!rupture) return;

    this.contexte.annoncer(
      `${villageois.nom} craque — ${NOMS_RUPTURE[rupture]} : ${EFFETS_RUPTURE[rupture].civil}`,
    );
    // ⚠️ **On ne regarde plus pareil celui qui s'en prend aux siens** (§4.26).
    // Seule la rage compte : c'est la seule rupture qui se tourne vers les
    // autres. Un abattu ou un terrorise fait peur a personne.
    if (rupture === "rage") {
      this.contexte.surLaRage(
        personne,
        this.temoinsAutourDe(villageois.x, villageois.y, villageois).map((v) => v.regles.personne),
      );
    }
  }

  /**
   * A-t-il lache son poste ?
   *
   * Deux ruptures sur cinq le font rentrer, et c'est le maximum de ce qu'un
   * civil peut faire de dangereux : il prive le village de sa production, il ne
   * prive personne de sa vie.
   */
  private aLacheSonPoste(villageois: Villageois): boolean {
    const { rupture } = villageois.regles.personne;
    if (rupture !== "paranoia" && rupture !== "terreur") return false;
    // ⚠️ **La dette fait accepter un ordre qu'on aurait refuse** (§4.26).
    // C'est le seul refus que le jeu produise aujourd'hui : la paranoia refuse
    // de sortir travailler. Celui qui doit quelque chose a un vivant y va quand
    // meme. La terreur, elle, ne se raisonne pas — on ne discute pas avec un
    // homme qui court.
    if (rupture === "terreur") return true;
    return !this.contexte.obeitMalgreTout(villageois.regles.personne);
  }

  private majorerUn(villageois: Villageois, delta: number, rappel: boolean): void {
    const { posture } = villageois.regles;
    const monstre = this.contexte.menaceAutour(
      villageois.x,
      villageois.y,
      REGLAGES_VILLAGE.distanceDeFuite,
    );
    const menace = monstre !== null;

    // Qui doit etre au village en ce moment, et pourquoi.
    const confine =
      rappel ||
      posture === "abri" ||
      // Celui qui a craque ne va pas travailler : la paranoia refuse de sortir,
      // la terreur lache son poste et se terre (§4.23). L'abattement, lui, le
      // laisse sur place a ne rien faire — c'est `cadence()` qui l'annule.
      this.aLacheSonPoste(villageois) ||
      // Un "prudent" lache son poste des qu'un monstre est en vue, et il ne
      // ressort pas de la nuit. Un "au travail" ne part que si on lui tombe
      // dessus : c'est le pari du joueur, pas celui de l'habitant (§4.18).
      (posture === "prudent" && (menace || this.nuit)) ||
      (posture === "travail" && menace && this.auContact(villageois));

    // ⚠️ **Un milicien ne se met pas a l'abri** (§4.18, bloc 9) : ni la nuit,
    // ni quand la cloche sonne. C'est exactement ce pour quoi on l'a arme, et
    // une milice qui se terre au moment ou la horde arrive ne servirait a rien.
    // Le seul ordre qui le fait rentrer, c'est « a l'abri », qui est explicite.
    if (villageois.regles.metier === "milicien" && posture !== "abri") {
      this.patrouiller(villageois, monstre);
      return;
    }

    if (confine) {
      this.rentrer(villageois, monstre);
      return;
    }

    // Un point qu'on lui a demande de tenir passe avant son poste (§4.4) — mais
    // **apres** la cloche et la fuite : un ordre du joueur ne doit jamais
    // pouvoir tuer quelqu'un qui aurait eu le temps de rentrer. C'est la meme
    // regle que « aucune posture ne passe outre les 20 % » cote heros.
    if (villageois.ancre) {
      this.tenirLePoint(villageois, villageois.ancre);
      return;
    }

    // Le charpentier va au chantier : c'est son poste, et il change a chaque
    // fois qu'on pose quelque chose (§4.20, bloc 8).
    if (villageois.regles.metier === "charpentier") {
      const chantier = this.contexte.chantierLePlusProche(villageois.x, villageois.y);
      if (chantier) {
        this.batir(villageois, chantier, delta);
        return;
      }
    }

    // ⚠️ **Sans poste, il ne se terre plus dans l'eglise** (§4.29). C'etait la
    // regle d'avant — « pas de poste, donc confine » —, et elle etait juste
    // tant qu'on commencait a trois, tous les trois postes tenus. Depuis qu'un
    // village trouve peut en compter vingt, elle faisait disparaitre le
    // forgeron, le charpentier et le guetteur du monde des la premiere image.
    // Il vit donc chez lui, dehors, tant qu'il fait jour et que rien ne rode.
    if (villageois.poste === null) {
      if (menace || this.nuit) {
        this.rentrer(villageois, monstre);
        return;
      }
      this.vivreChezSoi(villageois);
      return;
    }

    this.allerTravailler(villageois, delta);
  }

  /**
   * **La vie autonome** (DESIGN.md §4.27, bloc 12).
   *
   * C'etait « il se tient devant sa maison » jusqu'au bloc 12 : une presence,
   * qui repondait a la seule question du §4.29 — combien sont-ils, et est-ce
   * qu'on les voit. Il fait maintenant quelque chose de ses journees.
   *
   * ⚠️ **Ca ne coute rien a la production** (*decision d'Angelos, 21 septembre
   * 2026*). On n'arrive ici **que** si l'habitant n'a pas de poste, qu'il fait
   * jour et que rien ne rode : celui qui travaille travaille, et l'economie
   * deja reglee ne bouge pas d'un point.
   *
   * ⚠️ Il reste `en-route` et jamais `au-poste`. L'etat n'est pas qu'une
   * etiquette — `au-poste` veut dire qu'on produit et qu'on s'use (§4.18,
   * §4.23). Flaner ne fatigue personne.
   */
  private vivreChezSoi(villageois: Villageois): void {
    this.sortirDeLEglise(villageois);
    villageois.etat = "en-route";

    const but = villageois.butDeFlanerie ?? this.chezLui(villageois);
    const distance = Phaser.Math.Distance.Between(villageois.x, villageois.y, but.x, but.y);

    if (distance > 6) {
      // On flane, on ne court pas : deux tiers de la vitesse de travail.
      this.avancerVers(villageois, but.x, but.y, REGLAGES_VILLAGE.vitesseTravail * 0.66);
      return;
    }

    villageois.setVelocity(0, 0);
    villageois.setPosition(but.x, but.y);
    // Arrive : il reste la un moment, puis il repartira. C'est le tour de role
    // qui lui donnera un autre but, jamais cette image-ci — sans quoi on
    // tirerait un point par habitant et par image.
    villageois.butDeFlanerie = null;
  }

  /** Le pas de sa porte : la ou il revient quand il n'a rien d'autre a faire. */
  private chezLui(villageois: Villageois): Point {
    return placeChezSoi(
      villageois.placeDeVie ?? { x: EGLISE.x, y: EGLISE.y },
      villageois.regles.id,
    );
  }

  /**
   * Le tour de role de la vie autonome (§4.27).
   *
   * ⚠️ **On ne reveille que quelques habitants par image.** C'est la contrainte
   * de fluidite centrale de la section : une decision prise avec 300 ms de
   * retard est invisible, trente decisions par image a soixante images par
   * seconde ne le sont pas. Le curseur avance de trois par image ; un village
   * de trente fait donc un tour complet en dix images, soit un sixieme de
   * seconde.
   *
   * C'est aussi ici — et nulle part ailleurs — que la **peur** du §4.26 agit :
   * elle demandait un reveil au tour de role, elle l'a.
   */
  private reveillerLaVieAutonome(maintenant: number): void {
    const libres = this.habitants.filter(
      (v) => v.regles.vivant && v.poste === null && v.ancre === null && v.etat !== "abri",
    );
    const tour = prochainTour(this.curseurVieAutonome, libres.length);
    this.curseurVieAutonome = tour.suivant;

    for (const index of tour.index) {
      const villageois = libres[index];
      if (!villageois) continue;
      this.deciderDeSaJournee(villageois, libres, maintenant);
    }
  }

  /**
   * Ce qu'il decide de faire, une fois reveille.
   *
   * Un **petit arbre de priorites** (`core/vieAutonome.ts`), pas une recherche
   * de chemin ni une evaluation de tous les postes possibles.
   */
  private deciderDeSaJournee(
    villageois: Villageois,
    voisins: Villageois[],
    maintenant: number,
  ): void {
    // Il est en pleine conversation : on ne le derange pas. C'est le seul
    // etat de la vie autonome qui dure — tout le reste se redecide a chaque
    // tour de role.
    if (maintenant < villageois.discuteJusqua) return;

    const voisin = this.voisinLePlusProche(villageois, voisins);
    const occupation = choisirOccupation({
      personne: villageois.regles.personne,
      rassasie: villageois.regles.rassasie,
      nuit: this.nuit,
      chantier: this.contexte.chantierLePlusProche(villageois.x, villageois.y) !== null,
      feu: this.contexte.feuAPortee(villageois.x, villageois.y),
      // ⚠️ **Un voisin ne suffit pas : il faut aussi avoir envie de parler.**
      // Sans ce repos, huit habitants serres autour de l'eglise discutent en
      // boucle et le village se fige — vu en jouant.
      voisin: voisin !== null && maintenant >= villageois.prochaineDiscussion,
      menace:
        this.contexte.menaceAutour(villageois.x, villageois.y, REGLAGES_VILLAGE.distanceDeFuite) !==
        null,
    });
    villageois.occupation = occupation;

    if (occupation === "discuter" && voisin) {
      // Ils s'arretent **la ou ils sont** — se marcher dessus ne ferait que les
      // pousser l'un l'autre — et une bulle dit ce qu'ils sont l'un pour
      // l'autre (§4.27). Le joueur invente le reste.
      villageois.butDeFlanerie = { x: villageois.x, y: villageois.y };
      villageois.discuteJusqua = maintenant + REGLAGES_VIE.dureeDeDiscussion;
      villageois.prochaineDiscussion = maintenant + REGLAGES_VIE.dureeDeDiscussion * 4;
      villageois.setFlipX(voisin.x < villageois.x);
      this.contexte.uneRencontre(villageois, voisin, maintenant);
      return;
    }

    villageois.butDeFlanerie = this.ouAller(villageois, occupation);
  }

  /**
   * Ou son occupation l'emmene.
   *
   * Trois lieux seulement, et ils existent tous deja : le pas de sa porte, le
   * pied de l'eglise (les reserves y sont), et un point tire dans un petit
   * rayon autour de chez lui. Inventer des batiments pour manger et boire
   * serait un autre bloc entier.
   */
  private ouAller(villageois: Villageois, occupation: Occupation): Point {
    const chezLui = this.chezLui(villageois);
    if (occupation === "manger" || occupation === "boire") {
      return ecarter({ x: EGLISE.x, y: EGLISE.y }, villageois.regles.id, 34, 7);
    }
    if (occupation === "reparer") {
      return this.contexte.chantierLePlusProche(villageois.x, villageois.y) ?? chezLui;
    }
    if (occupation === "eteindre") {
      // Le puits, puis le feu, puis le puits : le va-et-vient **est** la scene
      // qu'on regarde, et c'est pour ca qu'un seul habitant ne suffit pas.
      return this.contexte.butDuSeau(villageois.x, villageois.y, villageois.seauPlein) ?? chezLui;
    }
    if (occupation === "flaner") {
      // Un petit rayon autour de chez lui, qui change a chaque reveil : c'est
      // ce qui fait qu'un village a l'air habite plutot que fige.
      const angle = this.rng.next() * Math.PI * 2;
      const rayon = 18 + this.rng.next() * RAYON_DE_FLANERIE;
      return {
        x: chezLui.x + Math.cos(angle) * rayon,
        y: chezLui.y + Math.sin(angle) * rayon * 0.7,
      };
    }
    return chezLui;
  }

  /**
   * Le plus proche des autres, dans le rayon de rencontre.
   *
   * ⚠️ **Il ne parle pas a qui il craint** (§4.26) : « la peur fait fuir un
   * poste quand l'autre s'en approche ». C'est ici que la regle ecrite au
   * bloc 11 prend effet, et c'est le seul endroit possible — elle demande une
   * distance par paire, donc un tour de role.
   */
  private voisinLePlusProche(villageois: Villageois, tous: Villageois[]): Villageois | null {
    let meilleur: Villageois | null = null;
    let meilleure = REGLAGES_VIE.distanceDeRencontre;
    for (const autre of tous) {
      if (autre === villageois) continue;
      const distance = Phaser.Math.Distance.Between(villageois.x, villageois.y, autre.x, autre.y);
      if (distance >= meilleure) continue;
      if (this.contexte.craint(villageois.regles.personne, autre.regles.personne)) {
        // Il s'ecarte au lieu de s'approcher : c'est tout ce que la peur fait,
        // et c'est deja beaucoup a regarder.
        villageois.butDeFlanerie = this.chezLui(villageois);
        continue;
      }
      meilleure = distance;
      meilleur = autre;
    }
    return meilleur;
  }

  /**
   * Il tient le point qu'on lui a donne (DESIGN.md §4.4, bloc 8).
   *
   * Il n'y produit rien : ce n'est pas un poste, c'est une presence — trois
   * villageois au guet sur un carrefour, ou une escorte qui nous suit. La
   * tolerance est celle des heros (`TOLERANCE_ANCRE`), sans quoi vingt
   * habitants se pousseraient au meme pixel sans jamais arriver.
   */
  private tenirLePoint(villageois: Villageois, ancre: Point): void {
    this.sortirDeLEglise(villageois);
    const distance = Phaser.Math.Distance.Between(villageois.x, villageois.y, ancre.x, ancre.y);
    villageois.etat = "en-route";

    if (distance > TOLERANCE_ANCRE) {
      this.avancerVers(villageois, ancre.x, ancre.y, REGLAGES_VILLAGE.vitesseTravail);
      return;
    }
    villageois.setVelocity(0, 0);
  }

  /**
   * Il monte ce qu'on vient de poser (DESIGN.md §4.20, §4.24, bloc 8).
   *
   * Il s'arrete a un pas du chantier — pas dessus : une construction est un
   * corps statique, et le viser au pixel le ferait pousser contre le mur sans
   * jamais « arriver ». C'est la scene qui compte le travail fait, parce que
   * c'est elle qui tient les constructions.
   */
  private batir(villageois: Villageois, chantier: Point, delta: number): void {
    this.sortirDeLEglise(villageois);
    const place = ecarter(chantier, villageois.regles.id, 26, 4);

    // ⚠️ **Il travaille des qu'il est a portee du chantier, pas a un pixel
    // pres.** Un poste de peche est en terrain libre ; un chantier, non — c'est
    // un mur, souvent colle a d'autres murs, et le villageois avance en ligne
    // droite sans calcul de chemin (§4.17). Viser un point exact derriere un
    // angle de mur le laissait pousser contre la pierre indefiniment : vu en
    // jouant, sur un monde tire ou l'enceinte tombait entre les deux.
    const distance = Phaser.Math.Distance.Between(villageois.x, villageois.y, chantier.x, chantier.y);
    if (distance > PORTEE_BATISSEUR - 8) {
      villageois.etat = "en-route";
      this.avancerVers(villageois, place.x, place.y, REGLAGES_VILLAGE.vitesseTravail * 1.6);
      return;
    }

    villageois.etat = "au-poste";
    villageois.setVelocity(0, 0);
    // Il monte de niveau en batissant, comme les autres en produisant (§4.18).
    // Le charpentier ne recolte rien : `travailler` le sait et ne rend rien.
    travailler(villageois.regles, delta / 60_000);
  }

  /**
   * Ceux qui sont a pied d'oeuvre sur un chantier (§4.20, bloc 8).
   *
   * La scene s'en sert pour faire avancer les chantiers : autant de chantiers
   * simultanes que de batisseurs affectes, et pas un de plus.
   */
  get batisseursALOeuvre(): Villageois[] {
    return this.habitants.filter(
      (v) => v.regles.vivant && v.regles.metier === "charpentier" && v.etat === "au-poste",
    );
  }

  /**
   * Le milicien tient les rues (DESIGN.md §4.18, bloc 9).
   *
   * Trois choses, dans cet ordre :
   *
   * 1. **Il va au-devant de ce qui entre.** Il ne produit rien, il n'a rien a
   *    lacher : c'est le filet de securite de ce que le joueur n'a pas couvert.
   * 2. **Il instruit**, s'il y a quelqu'un a la cour d'entrainement. Un
   *    instructeur est un milicien qui se tient dans la cour — et c'est le vrai
   *    prix de l'entrainement : pendant ce temps-la, il ne patrouille pas.
   * 3. **Sinon il patrouille**, le long d'un anneau autour de l'eglise. Chacun
   *    son point de depart, tire de son identifiant, pour qu'ils ne marchent
   *    pas en file indienne.
   *
   * > **Pourquoi patrouiller le lieu et pas suivre le joueur.** Une escorte
   * > serait une deuxieme equipe a commander, et le §4.15 plafonne deja
   * > l'effectif a dix. Une patrouille attachee au lieu ne demande aucun ordre :
   * > elle defend la ou le Protecteur n'est pas.
   */
  private patrouiller(villageois: Villageois, monstre: { x: number; y: number } | null): void {
    this.sortirDeLEglise(villageois);

    // 1. Ce qui entre passe avant tout le reste.
    const cible =
      monstre ??
      this.contexte.menaceAutour(villageois.x, villageois.y, RAYON_PATROUILLE * 1.6);
    if (cible) {
      this.combattre(villageois, cible);
      return;
    }

    // 2. La cour, s'il y a quelqu'un a former.
    const cour = this.contexte.courDEntrainement();
    if (cour?.attend) {
      const place = ecarter(cour.point, villageois.regles.id, 20, 5);
      // ⚠️ **On instruit des qu'on est dans la cour, pas a un pixel pres.** La
      // meme lecon qu'au chantier du bloc 8 : un batiment ou une maison peut
      // tomber entre lui et sa place exacte, et il pousserait contre le mur
      // sans jamais « arriver » — il avance en ligne droite (§4.17).
      const distance = Phaser.Math.Distance.Between(villageois.x, villageois.y, cour.point.x, cour.point.y);
      if (distance > RAYON_DE_LA_COUR) {
        villageois.etat = "en-route";
        this.avancerVers(villageois, place.x, place.y, REGLAGES_VILLAGE.vitesseTravail * 1.4);
        return;
      }
      villageois.etat = "au-poste";
      villageois.setVelocity(0, 0);
      return;
    }

    // 3. La ronde. Le point vise avance tout seul le long de l'anneau : pas de
    // liste de points a tenir, pas de calcul de chemin (§4.17).
    const angle =
      villageois.regles.id * 2.399963 +
      (this.scene.time.now / 1000) * VITESSE_DE_RONDE;
    const point = {
      x: EGLISE.x + Math.cos(angle) * RAYON_PATROUILLE,
      y: EGLISE.y + Math.sin(angle) * RAYON_PATROUILLE * 0.7,
    };
    villageois.etat = "en-route";
    this.avancerVers(villageois, point.x, point.y, REGLAGES_VILLAGE.vitesseTravail);
  }

  /**
   * Il frappe ce qu'il a devant lui, la ou il est.
   *
   * Ce n'est pas `defendre()` : celui-la se **plante sur le parvis de
   * l'eglise**, parce qu'il defend une porte. Un milicien defend une rue, donc
   * il se bat ou il se trouve.
   */
  private combattre(villageois: Villageois, monstre: { x: number; y: number }): void {
    const combat = combatDe(villageois.regles);
    const distance = Phaser.Math.Distance.Between(villageois.x, villageois.y, monstre.x, monstre.y);

    if (distance > combat.portee * 0.7) {
      villageois.etat = "en-route";
      this.avancerVers(villageois, monstre.x, monstre.y, REGLAGES_VILLAGE.vitesseFuite * 0.75);
      return;
    }

    villageois.etat = "defend";
    villageois.setVelocity(0, 0);
    villageois.setFlipX(monstre.x < villageois.x);

    const maintenant = this.scene.time.now;
    if (maintenant < villageois.prochainCoup) return;
    villageois.prochainCoup = maintenant + combat.recharge;
    this.contexte.frapperMonstre(villageois.x, villageois.y, combat.portee, combat.degats);
  }

  /** Ceux qui tiennent les rues en ce moment (§4.18, bloc 9). */
  get miliciens(): Villageois[] {
    return this.habitants.filter((v) => v.regles.vivant && v.regles.metier === "milicien");
  }

  /**
   * Un instructeur se tient-il dans la cour ? (§4.18, bloc 9)
   *
   * Sans lui, rien ne s'apprend : c'est ce qui fait qu'armer son village le
   * ralentit **deux fois** — l'eleve ne produit rien, et l'instructeur non plus.
   */
  instructeurALaCour(cour: Point): boolean {
    return this.miliciens.some(
      (v) => v.etat === "au-poste" && Phaser.Math.Distance.Between(v.x, v.y, cour.x, cour.y) < 60,
    );
  }

  /**
   * Le village a-t-il de quoi instruire ? (§4.18, bloc 9)
   *
   * ⚠️ **On demande « y a-t-il un milicien », pas « est-il dans la cour a cet
   * instant ».** La formation se solde a l'aube, et a l'aube un milicien revient
   * de sa nuit : le trouver pile dans la cour serait un coup de chance. Il est
   * l'instructeur **par son metier** — c'est ce qu'on a paye en le retirant de
   * la production —, et ce qu'on voit dans la cour le jour, c'est lui.
   */
  get aUnInstructeur(): boolean {
    return this.miliciens.length > 0;
  }

  /** Un monstre est litteralement sur lui : meme un tetu s'en va. */
  private auContact(villageois: Villageois): boolean {
    return this.contexte.menaceAutour(villageois.x, villageois.y, 90) !== null;
  }

  /**
   * Il court vers l'eglise — et il n'est en securite que **dedans**.
   *
   * ⚠️ Ce comportement remplace celui du bloc 2, qui declarait l'habitant « a
   * l'abri » des qu'il touchait le cercle du village. Cet abri-la n'a jamais
   * protege de rien : `rattraperHabitant` le tuait quand meme. La regle est
   * maintenant ecrite comme elle se joue (§4.18, §4.22) — ce qui protege, c'est
   * un batiment, et un batiment ca tombe.
   */
  private rentrer(villageois: Villageois, monstre: { x: number; y: number } | null): void {
    const arrive = auPiedDeLEglise(villageois.x, villageois.y);

    if (arrive && this.contexte.egliseDebout()) {
      // Un courageux ressort se poster aux portes plutot que de se terrer. Ce
      // n'est pas un ordre du joueur : c'est ce qu'il est (§4.22).
      if (monstre && sortDefendre(villageois.regles)) {
        this.defendre(villageois, monstre);
        return;
      }
      this.entrerDansLEglise(villageois);
      return;
    }

    // Pas d'eglise, ou pas encore arrive : il court, et il est vulnerable. C'est
    // la fenetre ou on le perd, et elle ne s'ouvre que si le joueur a laisse ce
    // flanc sans personne.
    this.sortirDeLEglise(villageois);
    villageois.etat = monstre ? "fuite" : "en-route";
    const vitesse = monstre
      ? REGLAGES_VILLAGE.vitesseFuite
      : REGLAGES_VILLAGE.vitesseTravail * 1.6;
    this.fuirVers(villageois, EGLISE.x, EGLISE.y, vitesse, monstre);
  }

  /**
   * Il entre dans le batiment : plus de sprite, plus de corps, plus de prise.
   *
   * C'est volontairement radical. Une zone de securite invisible se contourne
   * mal et se debogue encore plus mal ; « il est dedans ou il est dehors » ne
   * laisse aucune place au doute, ni pour le joueur ni pour le code.
   */
  private entrerDansLEglise(villageois: Villageois): void {
    if (villageois.etat === "abri") return;

    villageois.etat = "abri";
    villageois.setVelocity(0, 0);
    villageois.disableBody(true, true);
  }

  /** Il ressort. Appele des qu'il a autre chose a faire — ou si l'eglise tombe. */
  private sortirDeLEglise(villageois: Villageois): void {
    if (villageois.etat !== "abri") return;
    villageois.enableBody(true, EGLISE.x, EGLISE.y, true, true);
  }

  /**
   * Il tient les portes (§4.22).
   *
   * Il frappe pour de bon, avec le bloc de combat du §4.18 — mais ses chiffres
   * sont derisoires. Ce qu'il gagne au joueur, c'est du temps, et des coups qui
   * ne partent pas dans l'eglise.
   */
  private defendre(villageois: Villageois, monstre: { x: number; y: number }): void {
    this.sortirDeLEglise(villageois);
    villageois.etat = "defend";
    villageois.setVelocity(0, 0);

    // Il se place **sur le parvis, du cote de la menace**, et pas au milieu du
    // batiment. Sans ca les trois defenseurs se superposaient au centre exact
    // de l'eglise, donc dessines dedans — vu en jouant.
    //
    // L'ecart lateral vient de son identifiant : deux habitants ne tiennent
    // jamais le meme pas de porte, et la place de chacun ne change pas d'une
    // image a l'autre.
    const vers = Math.atan2(monstre.y - EGLISE.y, monstre.x - EGLISE.x);
    const ecart = ((villageois.regles.id % 3) - 1) * 0.5;
    const angle = vers + ecart;
    const rayon = EGLISE.emprise * 0.62;
    villageois.setPosition(EGLISE.x + Math.cos(angle) * rayon, EGLISE.y + Math.sin(angle) * rayon);
    villageois.setFlipX(monstre.x < villageois.x);

    const combat = combatDe(villageois.regles);
    const maintenant = this.scene.time.now;
    if (maintenant < villageois.prochainCoup) return;

    // Un horodatage verifie dans la boucle, jamais une minuterie par coup : le
    // §4.17 est formel, et il y aura trente habitants.
    villageois.prochainCoup = maintenant + combat.recharge;
    this.contexte.frapperMonstre(villageois.x, villageois.y, combat.portee, combat.degats);
  }

  private allerTravailler(villageois: Villageois, delta: number): void {
    this.sortirDeLEglise(villageois);
    const poste = villageois.poste!;
    // Chacun sa place autour du poste (§4.29) : a trois habitants un poste
    // n'accueillait qu'une personne, et viser le point exact suffisait. Depuis
    // qu'un village de vingt met quatre ou cinq bras a la mine, ils se
    // superposaient tous au meme pixel — trois sprites pour un seul corps
    // visible.
    const place = placeAuPoste(poste, villageois.regles.id);
    const distance = Phaser.Math.Distance.Between(villageois.x, villageois.y, place.x, place.y);

    // ⚠️ **On se pose a sa place exacte, pas « a peu pres ».** Avec une marge
    // d'arrivee plus large que l'ecart entre deux places, deux bucherons
    // s'arretaient a trois pixels l'un de l'autre — mesure en jeu.
    if (distance > 6) {
      villageois.etat = "en-route";
      this.avancerVers(villageois, place.x, place.y, REGLAGES_VILLAGE.vitesseTravail * 1.6);
      return;
    }
    villageois.setPosition(place.x, place.y);

    villageois.etat = "au-poste";
    villageois.setVelocity(0, 0);

    // Il produit, et il monte de niveau en produisant : c'est la seule
    // progression qu'un habitant connaisse (§4.18).
    const recolte = travailler(villageois.regles, delta / 60_000);
    if (recolte) {
      this.stocks[recolte.ressource] += recolte.quantite;
      // Le sous-produit du metier : la pierre du mineur (§4.20, bloc 7b).
      if (recolte.aussi) this.stocks[recolte.aussi.ressource] += recolte.aussi.quantite;
    }
  }

  private avancerVers(
    villageois: Villageois,
    x: number,
    y: number,
    vitesse: number,
  ): void {
    const angle = Math.atan2(y - villageois.y, x - villageois.x);
    villageois.setVelocity(Math.cos(angle) * vitesse, Math.sin(angle) * vitesse);
    villageois.setFlipX(Math.cos(angle) < 0);
  }

  /**
   * Courir au village **sans traverser le monstre**.
   *
   * Un habitant qui viserait bêtement le centre du village lui courrait parfois
   * droit dedans : le pecheur est au nord-ouest, le village au sud, et les
   * monstres arrivent justement du nord. Fuir en ligne droite, c'est fuir a
   * travers eux.
   *
   * La correction tient en un vecteur : on garde la direction du village, et on
   * ajoute une poussee inverse au monstre, d'autant plus forte qu'il est
   * proche. Le chemin se courbe autour de lui — assez pour ne pas lui foncer
   * dessus, pas assez pour partir a l'oppose du village. Aucun calcul de
   * chemin, aucune grille : le §4.17 interdit ce genre de cout par entite et par
   * image.
   */
  private fuirVers(
    villageois: Villageois,
    x: number,
    y: number,
    vitesse: number,
    monstre: { x: number; y: number } | null,
  ): void {
    if (!monstre) {
      this.avancerVers(villageois, x, y, vitesse);
      return;
    }

    const versLAbri = new Phaser.Math.Vector2(x - villageois.x, y - villageois.y).normalize();
    const fuite = new Phaser.Math.Vector2(
      villageois.x - monstre.x,
      villageois.y - monstre.y,
    );
    const distance = Math.max(1, fuite.length());
    // L'evitement domine au contact et s'efface au loin ; plafonne a 1,2 pour
    // que l'abri reste toujours la direction generale.
    const poids = Math.min(1.2, REGLAGES_VILLAGE.distanceDeFuite / distance - 0.6);
    const direction = versLAbri.add(fuite.normalize().scale(Math.max(0, poids))).normalize();

    villageois.setVelocity(direction.x * vitesse, direction.y * vitesse);
    villageois.setFlipX(direction.x < 0);
  }

  // ---------------------------------------------------------------- mort

  /**
   * Un monstre le touche : il meurt, **sauf s'il defend l'eglise**.
   *
   * C'est la reponse a une question laissee ouverte au §6 (« un habitant qui
   * defend l'eglise peut-il y mourir ? »), et elle etait obligatoire : un
   * defenseur touche le monstre par definition, donc la vieille regle du
   * contact mortel faisait de « sortir defendre » un suicide pur. Un habitant
   * qui fuit meurt au contact, comme au bloc 2 ; un habitant qui tient les
   * portes **encaisse** sur ses points de vie et meurt quand ils tombent a zero.
   *
   * @returns vrai s'il vient de mourir
   */
  encaisserOuTuer(villageois: Villageois, degats: number): boolean {
    if (!villageois.regles.vivant) return false;

    if (villageois.etat !== "defend") {
      this.tuer(villageois);
      return true;
    }

    const { personne } = villageois.regles;
    monterStress(personne, REGLAGES_STRESS.parCoupEncaisse);

    // Un coup encaisse peut ouvrir une plaie qui ne se referme pas toute
    // seule. Elle ne vient que du combat, donc le joueur sait toujours d'ou
    // elle sort — c'est ce qui autorise qu'elle tue en une journee (§4.23).
    if (this.rng.chance(0.2 * personne.mods.contagion) && contracterEtat(personne, "hemorragie")) {
      this.contexte.annoncer(`${villageois.nom} saigne — il lui reste une journee`);
    }

    villageois.regles.pv -= degats;
    if (villageois.regles.pv > 0) return false;

    this.tuer(villageois);
    return true;
  }

  /**
   * Un monstre l'a rattrape.
   *
   * La mort est definitive, comme celle d'un heros — et comme elle, elle ne peut
   * venir que d'un arbitrage : « je tiens le nord, tant pis pour le pecheur »
   * (§4.18).
   */
  tuer(villageois: Villageois): void {
    if (!villageois.regles.vivant) return;

    villageois.regles.vivant = false;
    villageois.etat = "mort";
    villageois.setVelocity(0, 0);
    villageois.disableBody(true, false);
    // Il reste par terre, gris et a moitie efface : on doit reconnaitre celui
    // qu'on a perdu. Le fer de la palette, jamais une teinte d'ailleurs.
    villageois.anims.stop();
    villageois.setTint(0x6b6478).setAlpha(0.45);

    this.contexte.annoncer(
      `${villageois.nom}, ${NOMS_METIER[villageois.regles.metier].toLowerCase()}, est mort`,
    );

    this.journeesDesMorts.push(this.journee);
    this.faireLeDeuil(villageois);
    this.recalculerSatisfaction();
  }

  /**
   * Ceux qui etaient la le paient (DESIGN.md §4.23).
   *
   * C'est le gros pic de la jauge, celui qui fait qu'**une mauvaise nuit se
   * paie pendant des jours** : trois morts vues, et le survivant devient Hante
   * pour le reste de la partie.
   *
   * Le rayon est genereux — on ne veut pas qu'un habitant a quarante pixels de
   * la scene fasse comme s'il n'avait rien vu — mais il existe : le village
   * entier ne doit pas s'effondrer parce qu'un pecheur est tombe a l'autre bout
   * de la carte.
   */
  private faireLeDeuil(mort: Villageois): void {
    // ⚠️ **On ne raconte que ce qu'on sait** (§4.26). Un pecheur tombe a son
    // poste n'a jamais pris d'epee : le dire serait le genre de mensonge que
    // tout le systeme de recit existe pour rendre impossible.
    const sArmait = mort.regles.metier === "milicien" || mort.etat === "defend";
    this.contexte.surLaMort(
      mort.regles.personne,
      this.temoinsAutourDe(mort.x, mort.y, mort).map((v) => v.regles.personne),
      mort.x,
      mort.y,
      {
        metier: NOMS_METIER[mort.regles.metier].toLowerCase(),
        ...(sArmait ? { arme: "ce qu'il avait sous la main", faits: ["combattant"] } : { faits: ["civil"] }),
      },
    );
  }

  /**
   * Les habitants qui ont vu quelqu'un tomber a cet endroit le paient.
   *
   * Publique parce que **la mort d'un heros compte aussi** : le village n'a pas
   * a savoir si c'etait un des siens, seulement qu'il l'a vu.
   */
  temoinsAutourDe(x: number, y: number, exclu?: Villageois): Villageois[] {
    const vus: Villageois[] = [];
    for (const temoin of this.habitants) {
      if (temoin === exclu || !temoin.regles.vivant) continue;
      // Celui qui est enferme dans l'eglise n'a rien vu, et c'est une raison de
      // plus d'y envoyer ses gens.
      if (temoin.etat === "abri") continue;
      const distance = Phaser.Math.Distance.Between(temoin.x, temoin.y, x, y);
      if (distance > REGLAGES_STRESS.rayonDuDeuil) continue;
      vus.push(temoin);
    }
    return vus;
  }

  /** Un trait gagne se dit : sinon le joueur ne saurait jamais qu'il l'a fait. */
  annoncerLesExploits(personne: Personne): void {
    for (const cle of verifierExploits(personne)) {
      this.contexte.annoncer(`${personne.nom} devient ${cle}`);
    }
  }

  // -------------------------------------------------------- la satisfaction

  /**
   * La satisfaction du village, de 0 a 100 (DESIGN.md §4.23).
   *
   * **C'est elle qui debloque les niveaux d'eglise**, et c'est ce qui referme
   * enfin la boucle : l'eglise fait baisser le stress, le stress bas remonte les
   * humeurs, les humeurs remontent la satisfaction, et la satisfaction debloque
   * le niveau d'eglise suivant.
   *
   * Elle est **mise en cache** : on la recalcule a l'aube et a chaque mort, pas
   * a chaque image. Rien de ce qui la compose ne bouge plus vite que ca.
   */
  get satisfaction(): number {
    return this.satisfactionCourante;
  }

  recalculerSatisfaction(): void {
    const vivants = this.vivants;
    this.satisfactionCourante = satisfactionDuVillage({
      stress: vivants.map((v) => v.regles.personne.stress),
      affames: vivants.filter((v) => !v.regles.rassasie).length,
      malades: vivants.filter((v) => v.regles.personne.etats.length > 0).length,
      mortsRecents: mortsRecents(this.journeesDesMorts, this.journee),
      joursDeVivres: this.joursDeVivres,
      niveauEglise: this.contexte.niveauEglise(),
      egliseDebout: this.contexte.egliseDebout(),
      // Les decorations arrivent avec le mode d'amenagement, au bloc 7 (§4.24).
      // Le point d'accroche est pose : il n'y aura rien a recoder ici.
      decorations: 0,
      // Ce dont le village se souvient : un massacre pese, une nuit tenue aussi
      // (§4.26, bloc 11). Deja agrege par les archives, jamais parcouru ici.
      memoire: this.contexte.memoireDuVillage(),
    });
  }

  /**
   * L'eglise le soigne : elle purge un etat, et elle calme (§4.22).
   *
   * ⚠️ Soigner quelqu'un au stade **Mourant** le sauve *et* l'abime pour
   * toujours. C'est la seule source de sequelles du jeu, et le joueur sait qu'il
   * joue avec le feu : le palier est annonce a chaque aggravation.
   *
   * @returns vrai s'il a soigne quelque chose
   */
  soignerALEglise(villageois: Villageois): boolean {
    const { personne } = villageois.regles;
    const pire = pireEtat(personne.etats);
    if (!pire) return false;

    const etaitMourant = pire.palier === 2;
    const sequelle = soignerEtat(personne, pire.cle, this.rng);
    villageois.regles.pv = combatDe(villageois.regles).pvMax;

    if (etaitMourant && sequelle !== null) {
      this.contexte.annoncer(
        `${villageois.nom} survit — mais il en garde : ${SEQUELLES[sequelle]!.nom}`,
      );
    } else {
      this.contexte.annoncer(`${villageois.nom} est soigne — ${ETATS[pire.cle].nom}`);
    }
    return true;
  }

  /**
   * Ce que l'interface lit de chaque habitant, pour le tableau et la fiche.
   *
   * Un seul endroit qui sait aplatir une personne en lignes lisibles : sinon le
   * tableau et la fiche divergeraient au premier changement.
   */
  lireEtatDe(villageois: Villageois): string {
    const { personne } = villageois.regles;
    if (personne.rupture) return NOMS_RUPTURE[personne.rupture];
    const pire = pireEtat(personne.etats);
    return pire ? lireEtat(pire) : "";
  }
}
