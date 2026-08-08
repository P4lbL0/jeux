import Phaser from "phaser";
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
import { POSTES, VILLAGE, type PosteTravail } from "../core/carte";
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
}

/** Ou en est un habitant, cote mouvement. */
type EtatVillageois = "au-poste" | "en-route" | "fuite" | "abri" | "mort";

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
  readonly poste: PosteTravail | null;
  etat: EtatVillageois = "en-route";

  constructor(scene: Phaser.Scene, regles: Habitant, poste: PosteTravail | null) {
    // Il nait au village : il en part pour aller travailler, il n'y arrive pas.
    super(scene, VILLAGE.x, VILLAGE.y, "villageois");
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

  constructor(scene: Phaser.Scene, contexte: ContexteVillage) {
    this.scene = scene;
    this.contexte = contexte;
    this.groupe = scene.physics.add.group();

    // Trois habitants, un par poste : le village est en ruine (§4.6), et chaque
    // nouvel arrivant doit se remarquer.
    POSTES.forEach((poste, index) => {
      this.ajouter(creerHabitant(NOMS[index] ?? `Habitant ${index}`, poste.metier), poste);
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

  private rentrer(villageois: Villageois, monstre: { x: number; y: number } | null): void {
    const distance = Phaser.Math.Distance.Between(
      villageois.x,
      villageois.y,
      VILLAGE.x,
      VILLAGE.y,
    );

    if (distance <= VILLAGE.rayon - 20) {
      // Arrive au village, il est a l'abri (§4.18).
      villageois.etat = "abri";
      villageois.setVelocity(0, 0);
      return;
    }

    // Pendant sa fuite, il est vulnerable : c'est la seule fenetre ou on peut le
    // perdre, et elle ne s'ouvre que si le joueur a laisse ce flanc sans
    // personne.
    villageois.etat = monstre ? "fuite" : "en-route";
    const vitesse = monstre
      ? REGLAGES_VILLAGE.vitesseFuite
      : REGLAGES_VILLAGE.vitesseTravail * 1.6;
    this.fuirVers(villageois, VILLAGE.x, VILLAGE.y, vitesse, monstre);
  }

  private allerTravailler(villageois: Villageois, delta: number): void {
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
