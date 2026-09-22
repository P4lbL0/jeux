import Phaser from "phaser";
import { REGLAGES_INCENDIE, type Foyer, type SorteDeFeu } from "../core/incendie";
import {
  CADENCE_FLAMME,
  CLES_FLAMME,
  CLES_FUMEE,
  CLE_ETINCELLE,
  CLE_LUEUR,
  cuireLeFeu,
  HAUTEUR_FLAMME,
} from "./dessin/feu";
import { jouer, type Voix } from "./son";

/**
 * Ce qu'on voit d'un incendie (DESIGN.md §4.21).
 *
 * Le noyau (`core/incendie.ts`) sait ou ca brule et combien de temps ; ce
 * fichier ne fait que **montrer**. Il ne decide de rien.
 *
 * ⚠️ **Refait le 23 septembre 2026, sur une phrase d'Angelos** : « c'est juste
 * une petite flamme sur un batiment ». Il avait raison, et la cause n'etait pas
 * le dessin de la flamme : c'etait qu'il n'y en avait **qu'une**, posee au
 * milieu du toit comme un chapeau, sans rien autour. Une maison qui brule, ca
 * se lit a trois choses, et la premiere n'est pas le feu :
 *
 * 1. **la fumee**, qui monte et se voit de l'autre bout de la carte — c'est
 *    elle qui dit « ca brule la-bas », de jour, quand la flamme est un detail de
 *    vingt pixels ;
 * 2. **plusieurs foyers de flamme** repartis sur le batiment, decales dans le
 *    temps, parce qu'un incendie n'a pas un centre ;
 * 3. **les braises** qui montent, qui donnent la hauteur et la chaleur.
 *
 * ⚠️ **Rien n'est fabrique en jeu** (§4.17, regle 3) : tout est un **pool** cree
 * une fois, rendu visible ou non. Un feu qui s'allume ne construit pas d'objet,
 * il en reveille. Et **rien ne garde d'etat** : la position d'une bouffee et
 * d'une braise se calcule entierement du temps et de son rang — aucune
 * minuterie, aucune liste a nettoyer, et une reprise de sauvegarde retrouve le
 * meme panache sans qu'on ait rien a restaurer.
 */

/** Combien de feux se voient en meme temps. Au-dela, ca brule sans se voir. */
const POOL = 16;

/**
 * Combien de flammes, de bouffees et de braises par feu.
 *
 * Cinq flammes, c'est ce qu'il faut pour couvrir un toit de maison sans que
 * deux se marchent dessus — compte sur l'emprise, pas devine. Les braises sont
 * trois : au-dela, on regarde des etincelles au lieu de regarder le feu.
 *
 * ⚠️ **Huit bouffees, et le nombre se deduit de la montee** : a six, la colonne
 * avait un **trou** entre la deuxieme et la troisieme, parce qu'une bouffee
 * jeune est encore transparente et qu'une vieille l'est redevenue. Il en faut
 * assez pour que deux voisines se recouvrent toujours — cent quarante pixels
 * de montee divises par huit font dix-sept pixels d'ecart, pour des bouffees
 * larges de trente a cent.
 */
const FLAMMES = 5;
const BOUFFEES = 8;
const ETINCELLES = 3;

/** La lueur passe au-dessus du voile de nuit (900), comme l'eclair d'orage. */
const PROFONDEUR_LUEUR = 904;

/**
 * Ou se pose une flamme sur ce qui brule, en pixels du monde depuis son milieu,
 * et quelle part de sa taille elle fait.
 *
 * ⚠️ **Ce ne sont pas des places au hasard, et l'ordre compte.** Une maison
 * brule par son toit : les trois premieres sont dessus, les deux dernieres
 * lechent la facade. Et comme le nombre de flammes suit l'ardeur, un feu qu'on
 * a presque noye ne garde que la premiere — donc celle du faitage, la plus
 * lisible. Chaque seau enleve visiblement une flamme.
 */
interface Place {
  dx: number;
  dy: number;
  taille: number;
}

const PLACES: Readonly<Record<SorteDeFeu, readonly Place[]>> = {
  // L'emprise d'une maison fait 64 px, son bati 56 x 50 pose dans le coin
  // haut-gauche : le toit tombe donc entre -24 et -4 du milieu.
  maison: [
    { dx: -2, dy: 3, taille: 1 },
    { dx: -21, dy: 7, taille: 0.72 },
    { dx: 14, dy: 1, taille: 0.8 },
    { dx: -27, dy: 18, taille: 0.56 },
    { dx: 9, dy: 20, taille: 0.6 },
  ],
  // Un champ fait une case et rien ne depasse : le feu y est plat et large.
  champ: [
    { dx: 0, dy: 4, taille: 0.72 },
    { dx: -11, dy: 9, taille: 0.5 },
    { dx: 10, dy: 8, taille: 0.54 },
    { dx: -5, dy: 13, taille: 0.42 },
    { dx: 7, dy: 14, taille: 0.4 },
  ],
};

/**
 * D'ou part la fumee, au-dessus de ce qui brule.
 *
 * ⚠️ **Dans les flammes, pas au-dessus du toit.** Une bouffee nait
 * transparente et s'epaissit : la faire naitre au-dessus du toit laissait un
 * trou entre le feu et son panache, et on voyait chaque bouffee apparaitre. Nee
 * dans les flammes, elle a fini son fondu quand elle en sort.
 */
const DEPART_FUMEE: Readonly<Record<SorteDeFeu, number>> = { maison: -8, champ: 2 };

/**
 * La vie d'une bouffee de fumee, ce qu'elle monte et ce que le vent la couche.
 *
 * Deux secondes et six : assez lent pour qu'un panache tienne en l'air, assez
 * court pour que cinq bouffees fassent une colonne continue et non un chapelet.
 */
const VIE_BOUFFEE = 2_800;
const MONTEE_FUMEE = 150;
const DERIVE_FUMEE = 36;

/**
 * Ce que la fumee fait de plus opaque, et ce qu'une bouffee grossit.
 *
 * ⚠️ **Deux fois plus haut et deux fois plus large que le premier jet**, juge
 * sur capture le 23 septembre : a un demi d'opacite et cinquante pixels de
 * large, le panache existait dans le code et ne se voyait pas a l'ecran. Une
 * fumee de maison doit etre **plus grande que la maison** — c'est elle qui dit
 * « ca brule la-bas » quand la flamme n'est qu'un detail de vingt pixels.
 */
const OPACITE_FUMEE = 0.8;
const PETITE_BOUFFEE = 0.6;
const GROSSE_BOUFFEE = 1.5;

/** La vie d'une braise, et ce qu'elle monte. Plus vif, plus court. */
const VIE_ETINCELLE = 1_150;
const MONTEE_ETINCELLE = 52;

/**
 * A quelle distance du milieu de l'ecran un feu s'entend, et a partir de
 * laquelle il se tait.
 *
 * **Deux seuils et pas un** : avec un seul, un feu pose juste a la limite
 * s'allumerait et se couperait a chaque pas du heros. On ouvre pres, on ferme
 * loin.
 */
const SON_ENTRE = 700;
const SON_SORT = 950;

/** Le fondu du crepitement, comme celui de l'averse. */
const FONDU = 0.9;
const VOLUME = 0.5;

/**
 * Ce que la lueur respire : son echelle va et vient autour de 1.
 *
 * Une lumiere de feu qui ne bouge pas est une tache ; une qui bat trop est une
 * alarme. Un dixieme, en deux secondes et demie.
 */
const RESPIRATION = 0.1;
const SOUFFLE = 2_500;

/**
 * Ce que la lueur vaut en plein jour, et ce qu'elle vaut la nuit pleine.
 *
 * ⚠️ **Juge sur capture le 23 septembre** : a pleine force de jour, trois
 * maisons en feu posaient trois **flaques jaunes** sur la prairie, comme si le
 * sol s'allumait. Une lueur de feu ne se voit que sur ce qui est sombre — c'est
 * la nuit qu'elle est tout l'interet d'un incendie, et le jour qu'elle ment.
 */
const LUEUR_DE_JOUR = 0.22;
const LUEUR_DE_NUIT = 1;

/**
 * Un nombre stable tire de la cle d'un feu.
 *
 * ⚠️ **Tire de la cle, pas d'un tirage au sort.** La cle d'un feu est sa case
 * (`m12:7`), donc elle traverse une sauvegarde : deux maisons voisines qui
 * brulent n'ont jamais le meme panache, et la meme maison retrouve le sien en
 * rechargeant. Un `Math.random()` aurait fait scintiller toute la colonne a
 * chaque image.
 */
function empreinte(cle: string): number {
  let h = 0;
  for (let i = 0; i < cle.length; i++) h = (h * 31 + cle.charCodeAt(i)) % 9973;
  return h;
}

export class Feux {
  private readonly flammes: Phaser.GameObjects.Image[][] = [];
  private readonly bouffees: Phaser.GameObjects.Image[][] = [];
  private readonly etincelles: Phaser.GameObjects.Image[][] = [];
  private readonly lueurs: Phaser.GameObjects.Image[] = [];
  /** Le crepitement en cours, ou null quand rien ne brule assez pres */
  private voix: Voix | null = null;

  constructor(private readonly scene: Phaser.Scene) {
    cuireLeFeu(scene);

    for (let i = 0; i < POOL; i++) {
      this.lueurs.push(
        scene.add
          .image(0, 0, CLE_LUEUR)
          .setVisible(false)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setDepth(PROFONDEUR_LUEUR),
      );
      // La fumee d'abord, pour qu'elle passe derriere les flammes du meme feu
      // quelle que soit la profondeur : elle monte du toit, le feu est devant.
      this.bouffees.push(
        Array.from({ length: BOUFFEES }, () =>
          scene.add
            .image(0, 0, CLES_FUMEE[0]!)
            .setVisible(false)
            // Le dessin ne remplit pas son cadre par le haut : son milieu
            // visible est aux six dixiemes. C'est autour de la que la bouffee
            // doit grossir, sinon elle gonfle vers le bas en montant.
            .setOrigin(0.5, 0.6),
        ),
      );
      this.flammes.push(
        Array.from({ length: FLAMMES }, () =>
          scene.add.image(0, 0, CLES_FLAMME[0]!).setOrigin(0.5, 1).setVisible(false),
        ),
      );
      this.etincelles.push(
        Array.from({ length: ETINCELLES }, () =>
          scene.add
            .image(0, 0, CLE_ETINCELLE)
            .setVisible(false)
            .setBlendMode(Phaser.BlendModes.ADD),
        ),
      );
    }

    // Un feu ne survit pas a sa partie : sans ca, on quitte vers le menu et ca
    // crepite encore (le piege deja paye par l'averse).
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.voix?.arreter(0.3);
      this.voix = null;
    });
  }

  /**
   * Une image de feu.
   *
   * @param foyers ceux qui brulent, tels que le noyau les tient
   * @param maintenant l'horloge de la scene : c'est elle qui alterne les images
   * @param nuit ou on en est de la nuit, de 0 (plein jour) a 1 (nuit pleine)
   */
  majorer(foyers: readonly Foyer[], maintenant: number, nuit: number): void {
    // Le souffle est commun a tous les feux : un seul cosinus par image, et
    // deux feux voisins respirent ensemble — ce qui, a l'oeil, ressemble a un
    // meme vent plutot qu'a deux objets independants.
    const souffle = 1 + Math.cos((maintenant / SOUFFLE) * Math.PI * 2) * RESPIRATION;

    for (let i = 0; i < POOL; i++) {
      const foyer = foyers[i];
      if (!foyer) {
        this.cacher(i);
        continue;
      }

      // Une flamme qui vient de prendre est entiere, une qu'on a presque noyee
      // est petite : l'ardeur se lit dans la taille et dans le nombre, sans
      // barre ni chiffre.
      const part = Math.max(0, Math.min(1, foyer.ardeur / REGLAGES_INCENDIE.ardeurAuDepart));
      const force = Math.max(0.45, part);
      const graine = empreinte(foyer.cible);

      this.poserLesFlammes(i, foyer, maintenant, part, force, souffle, graine);
      this.poserLaFumee(i, foyer, maintenant, force, graine);
      this.poserLesEtincelles(i, foyer, maintenant, part, graine);

      this.lueurs[i]!.setPosition(foyer.x, foyer.y)
        .setVisible(true)
        .setAlpha(LUEUR_DE_JOUR + (LUEUR_DE_NUIT - LUEUR_DE_JOUR) * Math.max(0, Math.min(1, nuit)))
        .setScale(souffle * force);
    }

    this.majorerLeSon(foyers);
  }

  /**
   * Les flammes d'un feu : jusqu'a cinq, chacune sur sa place et sur son temps.
   *
   * ⚠️ **Chaque flamme a sa propre phase.** Sans le decalage, les cinq images
   * changent ensemble : au lieu d'un feu, on voit un panneau qui clignote. Le
   * decalage est tire du rang et de l'empreinte du foyer, donc il est stable.
   */
  private poserLesFlammes(
    i: number,
    foyer: Foyer,
    maintenant: number,
    part: number,
    force: number,
    souffle: number,
    graine: number,
  ): void {
    const places = PLACES[foyer.sorte];
    // Cinq flammes a plein feu, une seule quand il ne reste presque rien.
    const combien = 1 + Math.round(part * (FLAMMES - 1));

    for (let n = 0; n < FLAMMES; n++) {
      const flamme = this.flammes[i]![n]!;
      if (n >= combien) {
        flamme.setVisible(false);
        continue;
      }
      const place = places[n]!;
      const phase = (graine + n * 277) % 1_000;
      const image =
        CLES_FLAMME[Math.floor((maintenant + phase) / CADENCE_FLAMME) % CLES_FLAMME.length]!;
      flamme
        .setTexture(image)
        .setPosition(foyer.x + place.dx, foyer.y + place.dy)
        .setVisible(true)
        // Devant ce qui brule : la profondeur du monde suit le pied, et le pied
        // de la flamme est le sien. Le rang departage deux flammes du meme feu.
        .setDepth(foyer.y + HAUTEUR_FLAMME + n)
        .setScale(souffle * force * place.taille);
    }
  }

  /**
   * Le panache : cinq bouffees qui montent, grossissent et se defont.
   *
   * Tout se calcule du temps : une bouffee n'a ni naissance ni mort, elle
   * repasse au debut de son cycle. Les cinq sont decalees d'un cinquieme de
   * cycle, ce qui fait une colonne continue avec cinq objets.
   */
  private poserLaFumee(
    i: number,
    foyer: Foyer,
    maintenant: number,
    force: number,
    graine: number,
  ): void {
    const haut = foyer.y + DEPART_FUMEE[foyer.sorte];
    // ⚠️ **Le panache ne retrecit pas au meme rythme que le feu.** Multiplier
    // sa taille par la force faisait disparaitre la colonne des le premier seau
    // — mesure en jeu : a mi-ardeur, elle tombait a quarante pixels et le
    // village semblait deja sauve. Ce qui baisse vite, c'est son opacite ; ce
    // qui reste, c'est qu'on voit de loin qu'il y a encore quelque chose.
    const ampleur = 0.55 + 0.45 * force;
    for (let n = 0; n < BOUFFEES; n++) {
      const bouffee = this.bouffees[i]![n]!;
      const decalage = (n * VIE_BOUFFEE) / BOUFFEES + graine;
      const age = ((maintenant + decalage) % VIE_BOUFFEE) / VIE_BOUFFEE;

      // Elle apparait vite et s'efface longtemps : une fumee ne disparait pas,
      // elle se dilue.
      // ⚠️ **L'exposant de la disparition est bien plus petit que 1**, et c'est
      // lui qui fait un panache plutot qu'un chapeau : a 1,25, seules les deux
      // premieres bouffees se voyaient et la colonne s'arretait a hauteur de
      // toit. Le sol de ce jeu est **moutonne de taches sombres** — une fumee
      // qui palit vite s'y confond avec l'herbe, et il ne reste qu'un nuage
      // pose sur le batiment. A 0,6, la colonne monte de deux hauteurs de
      // maison avant de se defaire.
      const opacite = force * OPACITE_FUMEE * Math.min(1, age * 10) * (1 - age) ** 0.6;
      if (opacite < 0.01) {
        bouffee.setVisible(false);
        continue;
      }

      bouffee
        .setTexture(CLES_FUMEE[(graine + n) % CLES_FUMEE.length]!)
        .setPosition(
          foyer.x + DERIVE_FUMEE * age + Math.sin((age + n) * 3.1) * 5,
          haut - MONTEE_FUMEE * age,
        )
        .setVisible(true)
        .setAlpha(opacite)
        .setScale((PETITE_BOUFFEE + age * GROSSE_BOUFFEE) * ampleur)
        // Au-dessus des flammes du meme feu, et de tout ce qui est au sol
        // derriere : ce qui monte passe devant le toit dont ca sort.
        .setDepth(foyer.y + HAUTEUR_FLAMME + FLAMMES + n);
    }
  }

  /** Les braises : trois points de lumiere qui montent et s'eteignent. */
  private poserLesEtincelles(
    i: number,
    foyer: Foyer,
    maintenant: number,
    part: number,
    graine: number,
  ): void {
    const haut = foyer.y + DEPART_FUMEE[foyer.sorte] + 6;
    for (let n = 0; n < ETINCELLES; n++) {
      const etincelle = this.etincelles[i]![n]!;
      // Un feu presque eteint n'envoie plus rien en l'air.
      if (part < 0.35) {
        etincelle.setVisible(false);
        continue;
      }
      const decalage = (n * VIE_ETINCELLE) / ETINCELLES + graine * 3;
      const age = ((maintenant + decalage) % VIE_ETINCELLE) / VIE_ETINCELLE;
      // Chaque braise part d'un point different du foyer et monte de travers.
      const cote = ((graine + n * 37) % 21) - 10;
      etincelle
        .setPosition(
          foyer.x + cote + Math.sin((age + n) * 5.7) * 6,
          haut - MONTEE_ETINCELLE * age,
        )
        .setVisible(true)
        .setAlpha((1 - age) ** 1.6 * part)
        .setScale(1 - age * 0.45)
        .setDepth(foyer.y + HAUTEUR_FLAMME + FLAMMES + BOUFFEES + n);
    }
  }

  /** Range tout ce qui appartient au feu de rang `i`. */
  private cacher(i: number): void {
    this.lueurs[i]!.setVisible(false);
    for (const f of this.flammes[i]!) f.setVisible(false);
    for (const b of this.bouffees[i]!) b.setVisible(false);
    for (const e of this.etincelles[i]!) e.setVisible(false);
  }

  /**
   * Le crepitement (§4.21).
   *
   * **Une seule voix en boucle**, quel que soit le nombre de feux : deux voix
   * identiques sur un meme son ne font pas deux feux, elles font un feu deux
   * fois trop fort. Ce qui decide, c'est le foyer **le plus proche du milieu de
   * l'ecran** — ce qu'on regarde est ce qu'on entend.
   */
  private majorerLeSon(foyers: readonly Foyer[]): void {
    const vue = this.scene.cameras.main.worldView;
    let plusProche = Infinity;
    for (const foyer of foyers) {
      plusProche = Math.min(plusProche, Math.hypot(foyer.x - vue.centerX, foyer.y - vue.centerY));
    }

    const seuil = this.voix ? SON_SORT : SON_ENTRE;
    const voulu = plusProche <= seuil;
    if (voulu === (this.voix !== null)) return;

    if (!voulu) {
      this.voix?.arreter(FONDU);
      this.voix = null;
      return;
    }
    this.voix = jouer(this.scene, "bruit-feu", "ambiance", {
      boucle: true,
      volume: VOLUME,
      fondu: FONDU,
    });
  }

  /** Plus rien ne brule : une fin de partie, une reprise. */
  toutCacher(): void {
    for (let i = 0; i < POOL; i++) this.cacher(i);
    this.voix?.arreter(FONDU);
    this.voix = null;
  }
}
