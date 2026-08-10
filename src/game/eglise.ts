import Phaser from "phaser";
import { EGLISE } from "../core/carte";
import { Eglise, PALIERS, type NiveauEglise } from "../core/eglise";

/**
 * L'eglise a l'ecran (DESIGN.md §4.22).
 *
 * Elle n'est pas une `Construction` du §4.20, et c'est deliberé : celles-la
 * vivent sur la grille, occupent exactement une case de 32 px et se posent par
 * dizaines. L'eglise est unique, large de 48 px, haute de 96 au niveau 4, elle
 * change de texture en montant et elle survit a sa propre destruction sous
 * forme de ruine. Lui faire porter le moule des palissades aurait coute plus
 * cher que de lui donner sa classe.
 *
 * Les regles (points de vie, niveaux, conditions, relevement) sont dans
 * `core/eglise.ts` et testees. Ici il n'y a que le sprite, le corps et les
 * teintes.
 */

/** Ce que la scene a besoin de savoir quand l'eglise change d'etat. */
export interface EchosEglise {
  annoncer: (message: string) => void;
  /** Appele quand elle tombe : la scene s'occupe du pouf et de la secousse */
  effondrement: (x: number, y: number) => void;
}

export class BatimentEglise {
  /** Les regles pures. Tout ce qui se decide se decide la-dedans. */
  readonly regles = new Eglise();

  /**
   * ⚠️ **Statique, et il faut le dire.** Une premiere version l'avait creee avec
   * `physics.add.image` puis passee en statique avec `physics.add.existing` :
   * Phaser ne remplace pas un corps deja pose, l'eglise gardait donc un corps
   * **dynamique** et les monstres la **poussaient**. Elle avait derive de 190 px
   * vers le nord en quelques secondes, pendant que le refuge et le cap, eux,
   * restaient sur la constante `EGLISE` — le batiment et sa fonction n'etaient
   * plus au meme endroit. Trouve en jouant ; la compilation n'y voyait rien.
   */
  readonly sprite: Phaser.Physics.Arcade.Image;

  /** Eclair blanc quand elle encaisse, pilote par horodatage (§4.17) */
  private flashJusqua = 0;
  /** Le rayon de soin, dessine une seule fois par niveau et jamais par image */
  private readonly halo: Phaser.GameObjects.Graphics;

  private readonly echos: EchosEglise;

  constructor(scene: Phaser.Scene, echos: EchosEglise) {
    this.echos = echos;

    // Sous les personnages : le halo dit ou l'on se soigne, il ne doit jamais
    // masquer un monstre qui arrive.
    this.halo = scene.add.graphics().setDepth(-500);

    this.sprite = scene.physics.add.staticImage(EGLISE.x, EGLISE.y, "eglise-1");
    this.redessiner();
  }

  get niveau(): NiveauEglise {
    return this.regles.niveau;
  }

  get fonctionne(): boolean {
    return this.regles.fonctionne;
  }

  get rayonSoin(): number {
    return this.regles.rayonSoin;
  }

  /**
   * Le corps ne couvre que l'**emprise au sol**, jamais la hauteur du sprite.
   *
   * C'est la meme regle que pour les tours du §4.20 : un batiment dessine haut
   * ne doit pas arreter ce qui passe derriere lui. Et l'emprise ne change
   * jamais de niveau en niveau, sinon une eglise amelioree ne tiendrait plus a
   * l'endroit ou le joueur l'a posee (§4.24).
   */
  private callerLeCorps(): void {
    const corps = this.sprite.body as Phaser.Physics.Arcade.StaticBody;
    corps.setSize(EGLISE.emprise, EGLISE.emprise * 0.6);
    corps.position.set(EGLISE.x - EGLISE.emprise / 2, EGLISE.y - EGLISE.emprise * 0.3);
    corps.updateCenter();
  }

  /**
   * Elle encaisse un coup.
   *
   * @returns vrai si elle vient de tomber
   */
  encaisser(degats: number, maintenant: number): boolean {
    if (!this.regles.fonctionne) return false;

    this.flashJusqua = maintenant + 90;
    if (!this.regles.encaisser(degats)) return false;

    this.echos.effondrement(this.sprite.x, this.sprite.y);
    this.echos.annoncer("L'EGLISE EST TOMBEE — plus de soins, plus de refuge");
    this.redessiner();
    return true;
  }

  /** Le chantier avance ; @returns vrai si elle vient de se remettre debout */
  majorer(delta: number, maintenant: number): boolean {
    const relevee = this.regles.majorer(delta);
    if (relevee) {
      this.echos.annoncer("L'eglise est relevee — on se soigne a nouveau");
      this.redessiner();
    }

    // La teinte se repose une fois par image, comme celle des constructions.
    if (maintenant < this.flashJusqua) this.sprite.setTintFill(0xffffff);
    else if (!this.regles.fonctionne) this.sprite.setTint(0x6a6068);
    else if (this.regles.ratioPv > 0.5) this.sprite.clearTint();
    else this.sprite.setTint(this.regles.ratioPv > 0.25 ? 0xc98f7a : 0x8c5a4a);

    return relevee;
  }

  monterDUnNiveau(): void {
    this.redessiner();
    this.echos.annoncer(`L'eglise s'eleve — niveau ${this.regles.niveau}`);
  }

  lancerRelevement(stocks: Parameters<Eglise["lancerRelevement"]>[0]): boolean {
    if (!this.regles.lancerRelevement(stocks)) return false;
    this.echos.annoncer("Le chantier de l'eglise commence — une journee de travail");
    this.redessiner();
    return true;
  }

  /**
   * Le sprite et le halo suivent l'etat.
   *
   * Appelee **seulement quand quelque chose change** — jamais par image. Le
   * §4.17 interdit de redessiner un `Graphics` soixante fois par seconde pour
   * un cercle qui ne bouge pas.
   */
  private redessiner(): void {
    const aTerre = !this.regles.fonctionne;
    // Une ruine reste la chapelle basse, assombrie : on doit reconnaitre le
    // batiment qu'on a perdu.
    this.sprite.setTexture(aTerre ? "eglise-1" : `eglise-${this.regles.niveau}`);
    // L'origine suit la hauteur du sprite pour que le pied reste au meme
    // endroit quand elle grandit : sinon elle semblerait s'enfoncer dans le sol.
    this.sprite.setOrigin(0.5, 1 - (EGLISE.emprise * 0.3) / this.sprite.height);
    this.sprite.setDepth(EGLISE.y + 4);
    this.sprite.setAlpha(aTerre ? 0.55 : 1);

    // Apres le changement de texture : un corps statique ne suit pas tout seul
    // une origine ni une taille qui changent.
    this.callerLeCorps();

    this.halo.clear();
    if (aTerre) return;

    const rayon = PALIERS[this.regles.niveau].rayonSoin;
    this.halo.fillStyle(0xf0e3b8, 0.06).fillCircle(EGLISE.x, EGLISE.y, rayon);
    this.halo.lineStyle(1, 0xf0e3b8, 0.22).strokeCircle(EGLISE.x, EGLISE.y, rayon);
  }
}
