import Phaser from "phaser";
import {
  affuter,
  C,
  T,
  POLICE,
  barreDeTitre,
  cadre,
  creux,
  espacer,
  yCorps,
  yTitre,
  type Plaque,
} from "./ui/chrome";
import { largeurEcran, hauteurEcran } from "./ui/ecran";
import { PISTES, bruitDInterface, reglerLaPiste, volumeDeLaPiste, type Piste } from "./son";

/**
 * Les trois volumes du jeu, dans une plaque de fer (DESIGN.md §4.10, « Le menu
 * d'options »).
 *
 * Ouvert par PARAMETRES sur l'ecran-titre depuis le 19 septembre 2026 ; le
 * menu Echap de la partie le reprendra tel quel. Un curseur par piste de
 * `son.ts` — musique, ambiance, effets — de 0 a 100 % : on clique ou on tire,
 * et ce qui joue suit tout de suite. Le reglage est retenu d'une visite a
 * l'autre.
 *
 * Le §4.10 prevoyait « musique et effets » : l'ambiance (le feu, le vent) a sa
 * piste a elle depuis que l'ecran-titre sonne, elle a donc son curseur.
 */

const NOMS: Record<Piste, string> = { musique: "Musique", ambiance: "Ambiance", effets: "Effets" };

const LARGEUR = 380;
const HAUTEUR = 196;
const PROFONDEUR = 2200;
/** La glissiere : ou elle commence dans la plaque, sa longueur, son epaisseur. */
const GLISSIERE = { x: 118, longueur: 180, epaisseur: 8 };

export class PanneauSon {
  private objets: Phaser.GameObjects.GameObject[] = [];
  /** Pour chaque curseur : son dessin, son pourcentage, et ou il commence. */
  private curseurs = new Map<Piste, { g: Phaser.GameObjects.Graphics; texte: Phaser.GameObjects.Text; x0: number; y: number }>();
  private tiree: Piste | null = null;

  /**
   * @param gereEchap vrai sur l'ecran-titre, ou ce panneau est seul. **Faux en
   *   partie** : la scene d'interface est la seule a tenir ECHAP, sinon les deux
   *   repondent au meme appui et le menu de pause se referme dans la foulee.
   */
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly surFermer: () => void,
    private readonly gereEchap = true,
  ) {}

  get ouvert(): boolean {
    return this.objets.length > 0;
  }

  ouvrir(): void {
    if (this.ouvert) return;
    const s = this.scene;
    // ⚠️ **Jamais `scale.width`** : il compte en vrais pixels depuis le
    // 21 septembre 2026, et sur un ecran a 150 % la plaque partirait hors du
    // cadre (`ui/ecran.ts`).
    const l = largeurEcran(s);
    const h = hauteurEcran(s);
    const p: Plaque = {
      x: Math.round((l - LARGEUR) / 2),
      y: Math.round(h * 0.3 - 10),
      largeur: LARGEUR,
      hauteur: HAUTEUR,
    };
    const fond = s.add.graphics().setDepth(PROFONDEUR);
    cadre(fond, p, true);
    barreDeTitre(fond, p);
    this.objets.push(fond);
    this.objets.push(
      affuter(s.add.text(p.x + p.largeur / 2, yTitre(p), espacer("PARAMETRES"), { fontFamily: POLICE, fontSize: "12px", color: T.titre }))
        .setOrigin(0.5, 0)
        .setDepth(PROFONDEUR + 1),
    );

    PISTES.forEach((piste, i) => this.ligne(p, piste, yCorps(p) + 12 + i * 40));

    const retour = affuter(s.add.text(p.x + p.largeur / 2, p.y + p.hauteur - 24, "Retour", { fontFamily: POLICE, fontSize: "13px", color: T.laiton }))
      .setOrigin(0.5)
      .setDepth(PROFONDEUR + 1)
      .setInteractive({ useHandCursor: true })
      .on("pointerover", () => {
        retour.setColor(T.titre);
        bruitDInterface(s, "survol");
      })
      .on("pointerout", () => retour.setColor(T.laiton))
      .on("pointerdown", () => {
        bruitDInterface(s, "clic");
        this.fermer();
      });
    this.objets.push(retour);

    s.input.on("pointermove", this.tirer, this);
    s.input.on("pointerup", this.lacher, this);
    if (this.gereEchap) s.input.keyboard?.on("keydown-ESC", this.fermer, this);
  }

  fermer(): void {
    this.defaire();
    this.surFermer();
  }

  /** La fenetre a change de taille : on refait la plaque au milieu, sans rendre la main au menu. */
  replacer(): void {
    if (!this.ouvert) return;
    this.defaire();
    this.ouvrir();
  }

  private defaire(): void {
    if (!this.ouvert) return;
    const s = this.scene;
    s.input.off("pointermove", this.tirer, this);
    s.input.off("pointerup", this.lacher, this);
    if (this.gereEchap) s.input.keyboard?.off("keydown-ESC", this.fermer, this);
    for (const o of this.objets) o.destroy();
    this.objets = [];
    this.curseurs.clear();
    this.tiree = null;
  }

  // ------------------------------------------------------------------ lignes

  private ligne(p: Plaque, piste: Piste, y: number): void {
    const s = this.scene;
    this.objets.push(
      affuter(s.add.text(p.x + 24, y, NOMS[piste], { fontFamily: POLICE, fontSize: "14px", color: T.os }))
        .setOrigin(0, 0.5)
        .setDepth(PROFONDEUR + 1),
    );
    const g = s.add.graphics().setDepth(PROFONDEUR + 1);
    const texte = affuter(s.add.text(p.x + p.largeur - 24, y, "", { fontFamily: POLICE, fontSize: "13px", color: T.os }))
      .setOrigin(1, 0.5)
      .setDepth(PROFONDEUR + 1);
    this.objets.push(g, texte);
    const x0 = p.x + GLISSIERE.x;
    this.curseurs.set(piste, { g, texte, x0, y });

    const zone = s.add
      .zone(x0 - 6, y - 12, GLISSIERE.longueur + 12, 24)
      .setOrigin(0)
      .setDepth(PROFONDEUR + 2)
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", (pointeur: Phaser.Input.Pointer) => {
        this.tiree = piste;
        this.regler(piste, this.xDansLaScene(pointeur));
      });
    this.objets.push(zone);
    this.dessiner(piste);
  }

  /** Par pas de 5 % : on vise un chiffre rond, pas 47. */
  private regler(piste: Piste, xPointeur: number): void {
    const c = this.curseurs.get(piste);
    if (!c) return;
    const valeur = Phaser.Math.Clamp((xPointeur - c.x0) / GLISSIERE.longueur, 0, 1);
    reglerLaPiste(this.scene, piste, Math.round(valeur * 20) / 20);
    this.dessiner(piste);
  }

  private dessiner(piste: Piste): void {
    const c = this.curseurs.get(piste);
    if (!c) return;
    const v = volumeDeLaPiste(piste);
    const { g, texte, x0, y } = c;
    const haut = y - GLISSIERE.epaisseur / 2;
    g.clear();
    creux(g, { x: x0, y: haut, largeur: GLISSIERE.longueur, hauteur: GLISSIERE.epaisseur });
    g.fillStyle(C.laiton, 1);
    g.fillRect(x0 + 1, haut + 1, Math.round((GLISSIERE.longueur - 2) * v), GLISSIERE.epaisseur - 2);
    // La poignee : un rivet d'os au bout du laiton.
    const xp = x0 + Math.round((GLISSIERE.longueur - 2) * v);
    g.fillStyle(C.os, 1);
    g.fillRect(xp - 1, haut - 3, 3, GLISSIERE.epaisseur + 6);
    texte.setText(`${Math.round(v * 100)} %`);
  }

  /**
   * Ou le pointeur tombe **dans le repere de la scene**.
   *
   * ⚠️ `pointeur.x` compte en pixels de canvas, et la camera d'une scene
   * d'interface est zoomee de `RATIO` (`ui/ecran.ts`) : sur un ecran a 150 %,
   * le curseur sautait d'une fois et demie la distance parcourue par la souris.
   */
  private xDansLaScene(pointeur: Phaser.Input.Pointer): number {
    const dedans = pointeur.positionToCamera(this.scene.cameras.main) as Phaser.Math.Vector2;
    return dedans.x;
  }

  private tirer(pointeur: Phaser.Input.Pointer): void {
    if (this.tiree && pointeur.isDown) this.regler(this.tiree, this.xDansLaScene(pointeur));
  }

  private lacher(): void {
    // Les effets s'entendent au lacher : c'est ce qu'on regle, on l'ecoute.
    if (this.tiree === "effets") bruitDInterface(this.scene, "clic");
    this.tiree = null;
  }
}
