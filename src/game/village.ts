import Phaser from "phaser";
import { Rng } from "../core/rng";
import {
  NOMS_METIER,
  REGLAGES_VILLAGE,
  creerHabitant,
  habitantDe,
  joursDeVivres,
  nourrir,
  stocksVides,
  travailler,
  type Habitant,
  type Metier,
  type PostureCivile,
  type Ressource,
  type Stocks,
} from "../core/habitants";
import { auPiedDeLEglise, EGLISE, POSTES, type PosteTravail } from "../core/carte";
import { combatDe, sortDefendre } from "../core/habitants";
import {
  EFFETS_RUPTURE,
  NOMS_RUPTURE,
  PRENOMS,
  REGLAGES_STRESS,
  avancerLaJournee,
  coeurLache,
  contracterEtat,
  descendreStress,
  monterStress,
  resistanceAuStress,
  soignerEtat,
  stressDesEtatsDe,
  verifierExploits,
  verifierRupture,
  voirMourir,
  type Personne,
} from "../core/personne";
import { ETATS, lireEtat, pireEtat } from "../core/etats";
import { SEQUELLES, idTrait } from "../core/traits";
import { ORDRE_RANGS } from "../core/classes";
import { mortsRecents, satisfactionDuVillage } from "../core/satisfaction";
import { calerCorps, ECHELLE_PERSONNAGE } from "./entities";
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
 */
type EtatVillageois = "au-poste" | "en-route" | "fuite" | "abri" | "defend" | "mort";

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

/** Le pire palier d'un habitant, pour faire passer les mourants en premier. */
function palierDe(villageois: Villageois): number {
  return pireEtat(villageois.regles.personne.etats)?.palier ?? -1;
}

/**
 * Les noms qu'on tire. Ils comptent : on les perd.
 *
 * La source est **commune aux heros et aux habitants** (`core/personne.ts`) :
 * un villageois qui devient heros au jalon 9 ne doit pas changer de prenom en
 * route. Les trois premiers sortent de la liste ecrite a la main, dans l'ordre —
 * la scene demele ensuite les homonymes avec l'equipe, qui se compose avant.
 */
const NOMS = PRENOMS;

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
  /** La journee en cours, tenue par la scene a chaque aube */
  private journee = 1;
  /** Le dernier chiffre calcule, pour ne pas le refaire a chaque image */
  private satisfactionCourante = 50;

  private readonly scene: Phaser.Scene;
  private readonly contexte: ContexteVillage;
  /**
   * Graine fixe : le courage de depart des trois premiers habitants ne change
   * pas d'une partie a l'autre. On apprend son village, comme on apprend sa
   * carte (§4.6).
   */
  private readonly rng = new Rng(20260809);

  constructor(scene: Phaser.Scene, contexte: ContexteVillage) {
    this.scene = scene;
    this.contexte = contexte;
    this.groupe = scene.physics.add.group();

    // **Trois** habitants, et trois seulement : le village est en ruine (§4.6),
    // et chaque nouvel arrivant doit se remarquer.
    //
    // Les champs restent donc **vides au depart**. C'est voulu : y mettre
    // quelqu'un veut dire le retirer du bois ou du minerai, et c'est la seule
    // decision de production que le §4.18 accorde au joueur. Elle ne vaudrait
    // rien si le poste etait deja tenu.
    const departs = POSTES.filter((poste) => poste.metier !== "fermier");
    departs.forEach((poste, index) => {
      this.ajouter(
        creerHabitant(NOMS[index] ?? `Habitant ${index}`, poste.metier, "F", this.rng),
        poste,
      );
    });
  }

  ajouter(regles: Habitant, poste: PosteTravail | null): Villageois {
    const villageois = new Villageois(this.scene, regles, poste);
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
    villageois.rhabiller();
    this.contexte.annoncer(`${villageois.nom} part ${poste.nom.toLowerCase()}`);
  }

  /** Combien d'habitants sont en ce moment **dans** l'eglise (§4.22). */
  get refugies(): number {
    return this.habitants.filter((v) => v.regles.vivant && v.etat === "abri").length;
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
      this.majorerUn(villageois, delta, rappel);
      this.animerUn(villageois);
    }

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
    return rupture === "paranoia" || rupture === "terreur";
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
      villageois.poste === null ||
      // Celui qui a craque ne va pas travailler : la paranoia refuse de sortir,
      // la terreur lache son poste et se terre (§4.23). L'abattement, lui, le
      // laisse sur place a ne rien faire — c'est `cadence()` qui l'annule.
      this.aLacheSonPoste(villageois) ||
      // Un "prudent" lache son poste des qu'un monstre est en vue, et il ne
      // ressort pas de la nuit. Un "au travail" ne part que si on lui tombe
      // dessus : c'est le pari du joueur, pas celui de l'habitant (§4.18).
      (posture === "prudent" && (menace || this.nuit)) ||
      (posture === "travail" && menace && this.auContact(villageois));

    if (confine) {
      this.rentrer(villageois, monstre);
      return;
    }

    this.allerTravailler(villageois, delta);
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
    const distance = Phaser.Math.Distance.Between(
      villageois.x,
      villageois.y,
      poste.position.x,
      poste.position.y,
    );

    if (distance > 26) {
      villageois.etat = "en-route";
      this.avancerVers(
        villageois,
        poste.position.x,
        poste.position.y,
        REGLAGES_VILLAGE.vitesseTravail * 1.6,
      );
      return;
    }

    villageois.etat = "au-poste";
    villageois.setVelocity(0, 0);

    // Il produit, et il monte de niveau en produisant : c'est la seule
    // progression qu'un habitant connaisse (§4.18).
    const recolte = travailler(villageois.regles, delta / 60_000);
    if (recolte) this.stocks[recolte.ressource] += recolte.quantite;
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
    this.temoinsDeLaMort(mort.x, mort.y, mort);
  }

  /**
   * Les habitants qui ont vu quelqu'un tomber a cet endroit le paient.
   *
   * Publique parce que **la mort d'un heros compte aussi** : le village n'a pas
   * a savoir si c'etait un des siens, seulement qu'il l'a vu.
   */
  temoinsDeLaMort(x: number, y: number, exclu?: Villageois): void {
    for (const temoin of this.habitants) {
      if (temoin === exclu || !temoin.regles.vivant) continue;
      // Celui qui est enferme dans l'eglise n'a rien vu, et c'est une raison de
      // plus d'y envoyer ses gens.
      if (temoin.etat === "abri") continue;
      const distance = Phaser.Math.Distance.Between(temoin.x, temoin.y, x, y);
      if (distance > REGLAGES_STRESS.rayonDuDeuil) continue;

      voirMourir(temoin.regles.personne);
      for (const cle of verifierExploits(temoin.regles.personne)) {
        this.contexte.annoncer(`${temoin.nom} devient ${cle}`);
      }
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
