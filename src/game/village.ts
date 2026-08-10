import Phaser from "phaser";
import { Rng } from "../core/rng";
import {
  NOMS_METIER,
  REGLAGES_VILLAGE,
  creerHabitant,
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
import { calerCorps, ECHELLE_PERSONNAGE } from "./entities";

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
 * La teinte de chaque metier.
 *
 * Une seule texture, sept couleurs : c'est ce qui evite sept placeholders a
 * dessiner et sept sprites a remplacer le jour ou de vrais PNG arrivent.
 */
const TEINTES_METIER: Record<Metier, number> = {
  pecheur: 0x7fc7e8,
  fermier: 0xe8d27f,
  bucheron: 0x9ad17f,
  mineur: 0xc9a37f,
  forgeron: 0xe8977f,
  charpentier: 0xd0b48c,
  guetteur: 0xb9a6e8,
};

/** Les noms qu'on tire pour les habitants. Ils comptent : on les perd. */
const NOMS = [
  "Aubin", "Nine", "Gaspard", "Ombeline", "Merlin", "Sidonie", "Aldric",
  "Perrine", "Ysoret", "Colin", "Maelis", "Thibaut", "Enora", "Firmin",
];

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

  constructor(scene: Phaser.Scene, regles: Habitant, poste: PosteTravail | null) {
    // Il nait a l'eglise : c'est de la qu'il part travailler, et c'est la qu'il
    // revient. Tout converge dessus (§4.22).
    super(scene, EGLISE.x, EGLISE.y, "villageois");
    this.regles = regles;
    this.poste = poste;

    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setScale(ECHELLE_PERSONNAGE);
    calerCorps(this, 8, 10);
    this.setTint(TEINTES_METIER[regles.metier]);
  }

  get nom(): string {
    return this.regles.nom;
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
        creerHabitant(
          NOMS[index] ?? `Habitant ${index}`,
          poste.metier,
          "F",
          this.rng.next(),
        ),
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

  /** Les habitants encore en vie. C'est la condition de defaite (§4.18). */
  get vivants(): Villageois[] {
    return this.habitants.filter((v) => v.regles.vivant);
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
   * L'aube : on mange, et ceux qui n'ont rien eu cessent de travailler.
   *
   * @returns le nombre d'habitants qui ont eu faim
   */
  seLever(): number {
    this.nuit = false;
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
    return affames;
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
    villageois.setTint(TEINTES_METIER[poste.metier]);
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
    }
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
    villageois.setTint(0x5a4a52).setAlpha(0.45);

    this.contexte.annoncer(
      `${villageois.nom}, ${NOMS_METIER[villageois.regles.metier].toLowerCase()}, est mort`,
    );
  }
}
