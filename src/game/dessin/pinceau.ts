import { CONTOUR } from "./palette";

/**
 * Le pinceau : dessiner sur une grille de pixels entiers
 * (DESIGN.md §4.30, section « Le socle »).
 *
 * **Ce n'est pas un dessin, c'est une fonction a parametres.** Toute la refonte
 * tient sur cette phrase : un coup de pioche est **l'angle d'un bras**, un
 * villageois use est **un parametre de plus**. `segment` et `membre` sont donc
 * les deux primitives qui comptent — le reste n'est que du remplissage.
 *
 * ⚠️ **On ne dessine jamais jusqu'au bord.** Le contour est trace *autour* de
 * la silhouette : une silhouette qui touche le bord de la toile sort du cadre et
 * son contour est coupe. Un pixel de marge partout, au minimum.
 *
 * ⚠️ **Rien ici ne connait Phaser.** La cuisson est le seul pont
 * (`four.ts`) — ce fichier ne fabrique que des pixels.
 */

/** Le seuil au-dela duquel un pixel appartient a la silhouette. */
const OPAQUE = 250;

export class Toile {
  private readonly pixels: Uint8ClampedArray<ArrayBuffer>;

  constructor(
    readonly largeur: number,
    readonly hauteur: number,
  ) {
    // Le tampon est alloue explicitement : `new Uint8ClampedArray(n)` produit un
    // type de tampon flou que le constructeur d'`ImageData` refuse.
    this.pixels = new Uint8ClampedArray(new ArrayBuffer(largeur * hauteur * 4));
  }

  /** Remet la toile a vide. Une seule toile sert a cuire toutes les frames. */
  effacer(): void {
    this.pixels.fill(0);
  }

  point(x: number, y: number, couleur: number, alpha = 1): void {
    const cx = Math.round(x);
    const cy = Math.round(y);
    if (cx < 0 || cy < 0 || cx >= this.largeur || cy >= this.hauteur) return;

    const i = (cy * this.largeur + cx) * 4;
    this.pixels[i] = (couleur >> 16) & 0xff;
    this.pixels[i + 1] = (couleur >> 8) & 0xff;
    this.pixels[i + 2] = couleur & 0xff;
    this.pixels[i + 3] = Math.round(alpha * 255);
  }

  rect(x: number, y: number, largeur: number, hauteur: number, couleur: number): void {
    for (let j = 0; j < hauteur; j += 1) {
      for (let i = 0; i < largeur; i += 1) this.point(x + i, y + j, couleur);
    }
  }

  disque(cx: number, cy: number, rayon: number, couleur: number): void {
    const r2 = rayon * rayon;
    for (let y = Math.floor(cy - rayon); y <= Math.ceil(cy + rayon); y += 1) {
      for (let x = Math.floor(cx - rayon); x <= Math.ceil(cx + rayon); x += 1) {
        const dx = x - cx;
        const dy = y - cy;
        if (dx * dx + dy * dy <= r2) this.point(x, y, couleur);
      }
    }
  }

  /**
   * Un trait epais entre deux points, bouts arrondis.
   *
   * Les bouts arrondis ne sont pas un choix esthetique : a 32 px, un membre a
   * bouts carres montre ses coins des qu'il s'incline, et un bras a 40 degres
   * ressemble alors a une planche.
   */
  segment(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    epaisseur: number,
    couleur: number,
  ): void {
    const rayon = epaisseur / 2;
    const dx = x1 - x0;
    const dy = y1 - y0;
    const longueur2 = dx * dx + dy * dy;

    const gauche = Math.floor(Math.min(x0, x1) - rayon);
    const droite = Math.ceil(Math.max(x0, x1) + rayon);
    const haut = Math.floor(Math.min(y0, y1) - rayon);
    const bas = Math.ceil(Math.max(y0, y1) + rayon);

    for (let y = haut; y <= bas; y += 1) {
      for (let x = gauche; x <= droite; x += 1) {
        // Projection du pixel sur le segment, bornee a ses deux extremites :
        // c'est ce qui donne les bouts arrondis sans les traiter a part.
        const part =
          longueur2 === 0
            ? 0
            : Math.max(0, Math.min(1, ((x - x0) * dx + (y - y0) * dy) / longueur2));
        const px = x0 + dx * part;
        const py = y0 + dy * part;
        const ex = x - px;
        const ey = y - py;
        if (ex * ex + ey * ey <= rayon * rayon) this.point(x, y, couleur);
      }
    }
  }

  /**
   * **La primitive de tout ce bloc** : un membre attache quelque part, d'une
   * certaine longueur, a un certain angle.
   *
   * L'angle est en radians, **0 vers le bas** — un bras au repos pend. Positif
   * va vers la droite, c'est-a-dire vers l'avant d'un personnage qui regarde a
   * droite. Le retournement du sprite (`setFlipX`) s'occupe de l'autre sens,
   * comme il le fait deja pour tous les combattants.
   *
   * @returns le bout du membre — la main, le pied. C'est lui qui porte l'outil.
   */
  membre(
    x: number,
    y: number,
    longueur: number,
    angle: number,
    epaisseur: number,
    couleur: number,
  ): { x: number; y: number } {
    const bout = {
      x: x + Math.sin(angle) * longueur,
      y: y + Math.cos(angle) * longueur,
    };
    this.segment(x, y, bout.x, bout.y, epaisseur, couleur);
    return bout;
  }

  /**
   * L'ombre portee au sol, en fer translucide.
   *
   * Elle se dessine **en premier** et ne suit jamais le sursaut du corps : c'est
   * ce qui fait qu'on voit un personnage decoller au lieu de glisser.
   */
  ombreAuSol(cx: number, cy: number, rayonX: number, rayonY: number): void {
    for (let y = Math.floor(cy - rayonY); y <= Math.ceil(cy + rayonY); y += 1) {
      for (let x = Math.floor(cx - rayonX); x <= Math.ceil(cx + rayonX); x += 1) {
        const dx = (x - cx) / rayonX;
        const dy = (y - cy) / rayonY;
        if (dx * dx + dy * dy <= 1) this.point(x, y, CONTOUR, 0.3);
      }
    }
  }

  /**
   * Le contour automatique (§4.30) : tout pixel vide qui touche la silhouette.
   *
   * ⚠️ **A appeler une seule fois, en dernier.** Il lit un instantane de la
   * silhouette avant d'ecrire quoi que ce soit — sans ca, le contour se
   * prendrait lui-meme pour de la silhouette et grossirait a chaque colonne.
   *
   * L'ombre au sol n'est pas cernee : elle n'est pas opaque, donc elle n'entre
   * pas dans la silhouette. C'est voulu — une ombre cernee est une flaque.
   */
  contour(couleur = CONTOUR): void {
    const silhouette = new Uint8Array(this.largeur * this.hauteur);
    for (let i = 0; i < silhouette.length; i += 1) {
      silhouette[i] = (this.pixels[i * 4 + 3] ?? 0) >= OPAQUE ? 1 : 0;
    }

    for (let y = 0; y < this.hauteur; y += 1) {
      for (let x = 0; x < this.largeur; x += 1) {
        const i = y * this.largeur + x;
        if (silhouette[i]) continue;

        const touche =
          (x > 0 && silhouette[i - 1]) ||
          (x < this.largeur - 1 && silhouette[i + 1]) ||
          (y > 0 && silhouette[i - this.largeur]) ||
          (y < this.hauteur - 1 && silhouette[i + this.largeur]);
        if (touche) this.point(x, y, couleur);
      }
    }
  }

  /**
   * La toile en caracteres, pour la regarder dans un terminal.
   *
   * Ce n'est pas un gadget : un dessin parametrique rate ne se voit pas dans une
   * assertion. Quand un test dit « ca deborde du carreau », c'est ceci qui dit
   * **par ou** — et c'est ce qui a trouve le manche de pioche du 12 aout.
   */
  rendu(): string {
    const lignes: string[] = [];
    for (let y = 0; y < this.hauteur; y += 1) {
      let ligne = "";
      for (let x = 0; x < this.largeur; x += 1) {
        const alpha = this.pixels[(y * this.largeur + x) * 4 + 3] ?? 0;
        const bord = x === 0 || y === 0 || x === this.largeur - 1 || y === this.hauteur - 1;
        ligne += alpha >= OPAQUE ? (bord ? "X" : "#") : alpha > 0 ? "." : bord ? "|" : " ";
      }
      lignes.push(ligne);
    }
    return lignes.join("\n");
  }

  versImageData(): ImageData {
    return new ImageData(this.pixels, this.largeur, this.hauteur);
  }

  /** Combien de pixels appartiennent a la silhouette. Sert aux tests. */
  compterOpaques(): number {
    let compte = 0;
    for (let i = 3; i < this.pixels.length; i += 4) {
      if ((this.pixels[i] ?? 0) >= OPAQUE) compte += 1;
    }
    return compte;
  }

  /**
   * Combien de pixels opaques touchent le bord de la toile. Sert aux tests.
   *
   * C'est **le** risque du dessin parametrique : un bras a quarante degres qui
   * sort du cadre. Un pixel sur le bord veut dire que le contour n'a plus la
   * place d'exister, et le personnage parait tranche au couteau.
   */
  pixelsDuBord(): number {
    let compte = 0;
    const opaque = (x: number, y: number) =>
      (this.pixels[(y * this.largeur + x) * 4 + 3] ?? 0) >= OPAQUE ? 1 : 0;

    for (let x = 0; x < this.largeur; x += 1) {
      compte += opaque(x, 0) + opaque(x, this.hauteur - 1);
    }
    for (let y = 1; y < this.hauteur - 1; y += 1) {
      compte += opaque(0, y) + opaque(this.largeur - 1, y);
    }
    return compte;
  }
}
