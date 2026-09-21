import Phaser from "phaser";
import { REGLAGES_CACHES, phraseDeFouille, type Cache } from "../core/caches";
import { CLES_DE_CACHE, decorParCle } from "./dessin/decor";
import { C } from "./ui/couleurs";

/**
 * Les caches a l'ecran (DESIGN.md §4.31, jalon 5.6).
 *
 * Le core dit **ou** elles sont et **ce qu'elles rendent** (`core/caches.ts`) ;
 * ce fichier-ci ne fait que trois choses, et c'est tout ce qu'il doit faire :
 *
 * 1. **Les poser**, comme du decor — meme origine au pied, meme profondeur par
 *    le pied. Une cache n'est pas un objet de jeu qui flotte sur le monde,
 *    c'est un decor de plus dans la famille de la charrette et du tonneau
 *    (§4.31, et la regle du §4.30 : « on reconnait un lieu a ce qu'il y a
 *    dessus »).
 * 2. **Dire qu'on peut fouiller** : un lisere tenu au pied de la cache la plus
 *    proche, **et seulement quand on est a portee**. Il ne sert pas a la
 *    trouver — c'est la silhouette qui fait ca — il sert a dire « tu peux
 *    fouiller ». Ce sont deux questions differentes et il faut les deux.
 * 3. **Tenir la fouille** : elle prend un moment (decision d'Angelos,
 *    21 septembre 2026), et s'interrompt si l'on s'ecarte ou si l'on encaisse.
 *    ⚠️ **C'est ce qui donne sa dent au camp de betes** : une fouille
 *    instantanee se ferait sous le nez d'une meute sans rien risquer.
 *
 * ⚠️ **Rien ici ne cree d'objet en boucle** (§4.17, regles 3 et 5). Un seul
 * `Graphics` porte le lisere **et** la jauge, il est efface et redessine ; la
 * cache la plus proche se cherche sur une liste de sept, pas par tri.
 */

/** Une cache posee : ses regles, son image, et le fait qu'elle soit vidée. */
interface CachePosee {
  regles: Cache;
  image: Phaser.GameObjects.Image;
  videe: boolean;
}

/** Ce dont les caches ont besoin de la part de l'arene. */
export interface ContexteCaches {
  positionDuHeros: () => { x: number; y: number } | null;
  /** Ses points de vie : une fouille s'arrete des qu'on encaisse */
  pvDuHeros: () => number;
  annoncer: (message: string, source: string) => void;
  /** Ce qu'on vient de sortir de la cache : l'or et la matiere partent ailleurs */
  ramasser: (cache: Cache) => void;
  /** Le camp de betes d'une grosse cache, lache la premiere fois qu'on la voit */
  lacherLeCamp: (cache: Cache) => void;
  /** Le rayon de vue du §4.6, celui qui decide de ce qu'on « voit de loin » */
  rayonDeVue: number;
}

/** Combien de pixels on peut s'ecarter avant que la fouille s'arrete. */
const ECART_TOLERE = 14;

export class Caches {
  private posees: CachePosee[] = [];
  /** Le lisere et la jauge, dans un seul objet cree une fois (§4.17, regle 3) */
  private readonly trace: Phaser.GameObjects.Graphics;

  /** La cache qu'on fouille, et depuis quand */
  private enCours: CachePosee | null = null;
  private debutDeFouille = 0;
  private ouLonFouille = { x: 0, y: 0 };
  private pvAuDebut = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly contexte: ContexteCaches,
  ) {
    this.trace = scene.add.graphics();
    // Au-dessus du sol et du decor, sous les panneaux : c'est un signe pose sur
    // le monde, pas un element d'interface.
    this.trace.setDepth(100000);
  }

  /** Combien il en reste a fouiller — le compte que la route affiche. */
  get restantes(): number {
    return this.posees.filter((c) => !c.videe).length;
  }

  get total(): number {
    return this.posees.length;
  }

  /** Ou elles sont, pour que rien d'autre ne vienne se poser dessus (§4.31). */
  get places(): { x: number; y: number }[] {
    return this.posees.map((c) => c.regles.point);
  }

  /**
   * Pose les caches d'un monde.
   *
   * Comme tout le decor : l'origine est celle du sprite (le pied touche le
   * sol), et **la profondeur suit le pied** pour qu'un heros passe devant ou
   * derriere selon sa position, et non selon l'ordre de creation.
   */
  poser(caches: readonly Cache[]): void {
    for (const regles of caches) {
      const cle = CLES_DE_CACHE[regles.genre] ?? CLES_DE_CACHE.coffre!;
      const image = this.scene.add
        .image(regles.point.x, regles.point.y, cle)
        .setOrigin(0.5, decorParCle(cle).origineY)
        .setDepth(regles.point.y);
      this.posees.push({ regles, image, videe: false });
    }
  }

  /**
   * Le clic est-il une fouille ?
   *
   * On fouille la cache **la plus proche du heros**, pas la plus proche du
   * clic : le §4.31 veut qu'on aille jusqu'a elle. Un clic sur une cache d'un
   * bout de l'ecran reste donc un ordre de marche, ce qui est exactement ce
   * qu'on veut — on s'y rend, puis on clique.
   *
   * @returns vrai si le clic a lance une fouille, et donc ne doit pas deplacer
   */
  cliquer(x: number, y: number): boolean {
    const proche = this.aPortee();
    if (!proche) return false;
    // Le clic doit tomber **sur** la cache : a portee, on peut encore vouloir
    // faire un pas de cote.
    const cadre = proche.image.getBounds();
    if (!Phaser.Geom.Rectangle.Contains(cadre, x, y)) return false;
    this.commencer(proche);
    return true;
  }

  /**
   * Une image des caches : le lisere, la fouille en cours, les camps qu'on voit.
   *
   * ⚠️ Aucun objet cree, aucune minuterie, aucun tri (§4.17). Sept caches au
   * plus : ce corps de methode coute sept distances par image.
   */
  mettreAJour(maintenant: number): void {
    const heros = this.contexte.positionDuHeros();
    this.trace.clear();
    if (!heros || this.posees.length === 0) return;

    // Le camp de betes se leve quand on le voit, pas quand on le touche : le
    // §4.31 veut qu'on le voie **de loin**, pour pouvoir renoncer.
    for (const posee of this.posees) {
      if (posee.videe || posee.regles.garde === 0) continue;
      const d = Phaser.Math.Distance.Between(heros.x, heros.y, posee.regles.point.x, posee.regles.point.y);
      if (d <= this.contexte.rayonDeVue) this.contexte.lacherLeCamp(posee.regles);
    }

    if (this.enCours) {
      this.avancerLaFouille(heros, maintenant);
      return;
    }

    const proche = this.aPortee();
    if (proche) this.peindreLisere(proche, maintenant);
  }

  /** Tout oublier : on change de monde, ou l'on s'installe (§4.31, point 4). */
  vider(): void {
    for (const posee of this.posees) posee.image.destroy();
    this.posees = [];
    this.enCours = null;
    this.trace.clear();
  }

  // ------------------------------------------------------------- la fouille

  /** La cache non videe assez proche pour etre fouillee, s'il y en a une. */
  private aPortee(): CachePosee | null {
    const heros = this.contexte.positionDuHeros();
    if (!heros) return null;
    let meilleure: CachePosee | null = null;
    let distance: number = REGLAGES_CACHES.portee;
    for (const posee of this.posees) {
      if (posee.videe) continue;
      const d = Phaser.Math.Distance.Between(heros.x, heros.y, posee.regles.point.x, posee.regles.point.y);
      if (d < distance) {
        distance = d;
        meilleure = posee;
      }
    }
    return meilleure;
  }

  private commencer(posee: CachePosee): void {
    const heros = this.contexte.positionDuHeros();
    if (!heros) return;
    this.enCours = posee;
    this.debutDeFouille = this.scene.time.now;
    this.ouLonFouille = { x: heros.x, y: heros.y };
    this.pvAuDebut = this.contexte.pvDuHeros();
  }

  /**
   * La fouille avance, ou elle s'arrete.
   *
   * Deux facons de la perdre, et les deux disent la meme chose : **on ne
   * fouille pas en se battant**. On s'est ecarte, ou l'on a encaisse — dans
   * les deux cas la cache reste pleine et se refouille, sans penalite. La
   * punition, c'est le temps, et il suffit.
   */
  private avancerLaFouille(heros: { x: number; y: number }, maintenant: number): void {
    const posee = this.enCours!;
    const ecart = Phaser.Math.Distance.Between(heros.x, heros.y, this.ouLonFouille.x, this.ouLonFouille.y);
    if (ecart > ECART_TOLERE || this.contexte.pvDuHeros() < this.pvAuDebut) {
      this.enCours = null;
      this.contexte.annoncer("Tu laisses la fouille", "toi");
      return;
    }

    const part = Math.min(1, (maintenant - this.debutDeFouille) / REGLAGES_CACHES.dureeDeFouille);
    this.peindreJauge(heros, part);
    if (part < 1) return;

    this.enCours = null;
    posee.videe = true;
    // La silhouette reste : le monde garde la trace de ce qu'on a fait. Elle
    // s'assombrit, pour qu'on ne refasse pas deux fois le meme detour.
    posee.image.setTint(0x6b6357);
    this.contexte.ramasser(posee.regles);
    this.contexte.annoncer(phraseDeFouille(posee.regles), "toi");
  }

  // ------------------------------------------------------------ ce qu'on voit

  /**
   * Le lisere : une ellipse tenue au pied de la cache (§4.31, point 3).
   *
   * ⚠️ **Il ne brille pas, et il ne se voit pas de loin.** Le §4.31 refuse
   * explicitement une lueur visible depuis l'autre bout de l'ecran : on ne
   * raterait rien, et la marche deviendrait un ramassage de points. Il ne
   * parait qu'a deux pas, et il respire a peine — assez pour qu'un oeil le
   * cueille, pas assez pour qu'il crie.
   */
  private peindreLisere(posee: CachePosee, maintenant: number): void {
    const { x, y } = posee.regles.point;
    const souffle = 0.42 + 0.14 * Math.sin(maintenant / 380);
    this.trace.lineStyle(1, C.os, souffle);
    this.trace.strokeEllipse(x, y - 2, 30, 13);
  }

  /**
   * La jauge de fouille, au-dessus du heros.
   *
   * Au-dessus **de lui** et non de la cache : c'est lui qui fouille, et c'est
   * lui qu'on regarde quand on se demande si l'on a le temps de finir avant que
   * la bete arrive.
   */
  private peindreJauge(heros: { x: number; y: number }, part: number): void {
    const L = 26;
    const x = heros.x - L / 2;
    // Juste au-dessus de la tete : a trente pixels elle flottait, detachee du
    // heros, et on ne voyait plus a qui elle appartenait (juge sur capture).
    const y = heros.y - 24;
    this.trace.fillStyle(C.fer, 0.7);
    this.trace.fillRect(x - 1, y - 1, L + 2, 5);
    this.trace.fillStyle(C.laiton, 0.9);
    this.trace.fillRect(x, y, L * part, 3);
  }
}
