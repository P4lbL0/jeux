import Phaser from "phaser";
import { rangerParBandes } from "../core/voisinage";
import { CLE_ORC, TAILLE_ORC } from "./dessin/orc";

export { CLE_ORC, TAILLE_ORC };

/**
 * La nuee (DESIGN.md §4.33, palier 2) : la pietaille dessinee en une passe.
 *
 * Un Sprite Phaser coute 1,2 µs de processeur par image rien que pour etre
 * dessine (mesure du 22 septembre 2026) : vingt mille, c'est une image et demie.
 * La nuee les dessine par **une passe WebGL instanciee** — une texture, neuf
 * nombres par orc, et le shader fait le reste :
 *
 * - la **teinte** dit qui c'est, la **luminosite** la vie qui reste, le
 *   **rouge** le coup encaisse, la **taille** le rang (§4.33 §2) ;
 * - la **marche ne s'anime pas, elle se calcule** : un balancement tire du
 *   temps et d'une phase propre a chaque orc, au moment du dessin ;
 * - un **cadavre est un orc couche** : quelques octets, donc tous gardes.
 *
 * ⚠️ **Rangee par bandes horizontales** — le piege du §4.33, vu en capture :
 * dessinee d'un bloc, la nuee recouvrait les maisons et l'eglise. Chaque bande
 * de 16 px est un objet `Extern` a sa propre profondeur : un orc passe derriere
 * la maison du dessus et devant celle du dessous.
 *
 * La logique ne bouge pas : chaque orc reste un `Ennemi`, avec son corps et son
 * IA. Seul son dessin passe ici — il n'est plus ni dans la liste d'affichage, ni
 * dans celle des animations.
 */

/**
 * Le ton moyen de la matiere `orc` (`palette.json`), en fraction : c'est lui qui
 * devient **exactement** la couleur du type. Le clair et le sombre suivent.
 */
const CORPS_ORC = 166 / 255;
/** La hauteur d'une bande de profondeur : l'erreur de profondeur tient dedans. */
const HAUTEUR_BANDE = 16;
/** Les nombres d'un orc : x, y, echelle, sens, rouge, vert, bleu, phase, couche. */
const PAS = 9;
const OCTETS = PAS * 4;
/**
 * Les cadavres gardes, en anneau : au-dela, le plus ancien laisse sa place.
 * Vingt mille orcs couches, c'est 720 Ko — et le champ de bataille se couvre.
 */
const MAX_CADAVRES = 20000;
/** Sous tout ce qui se trie par profondeur, au-dessus des champs (-940), sous les reperes (-500). */
const PROFONDEUR_CADAVRES = -700;
/** Ce qui peut deborder d'une bande vers le haut : un enorme fait trois orcs de haut. */
const DEBORD = TAILLE_ORC * 3;

const SOMMETS = [
  "attribute vec2 aCoin;",
  "attribute vec2 aPos;",
  "attribute vec2 aEchelleSens;",
  "attribute vec3 aCouleur;",
  "attribute vec2 aPhaseCouche;",
  "uniform mat3 uVue;",
  "uniform vec2 uTaille;",
  "uniform vec2 uUV0;",
  "uniform vec2 uUV1;",
  "uniform float uTemps;",
  "varying vec2 vUV;",
  "varying vec3 vCouleur;",
  "void main() {",
  "  float e = aEchelleSens.x;",
  "  float sens = aEchelleSens.y;",
  // Le quad est centre sur la position, comme l'etait le sprite ; retourne si
  // l'orc regarde a gauche.
  "  vec2 local = (aCoin - vec2(0.5)) * uTaille * e;",
  "  local.x *= sens;",
  "  float angle = 0.0;",
  "  if (aPhaseCouche.y > 0.5) {",
  // Couche : un quart de tour autour des pieds, vers l'avant.
  "    angle = 1.5708 * sens;",
  "  } else if (aPhaseCouche.x >= 0.0) {",
  // La marche : un balancement et un pas qui souleve, calcules du temps.
  "    float t = uTemps * 9.0 + aPhaseCouche.x;",
  "    angle = 0.09 * sin(t);",
  "    local.y -= abs(sin(t)) * 1.2 * e;",
  "  }",
  "  vec2 pied = vec2(0.0, uTaille.y * e * 0.5);",
  "  vec2 p = local - pied;",
  "  float c = cos(angle);",
  "  float s = sin(angle);",
  "  p = vec2(p.x * c - p.y * s, p.x * s + p.y * c) + pied;",
  "  vec3 clip = uVue * vec3(aPos + p, 1.0);",
  "  gl_Position = vec4(clip.xy, 0.0, 1.0);",
  "  vUV = mix(uUV0, uUV1, aCoin);",
  "  vCouleur = aCouleur;",
  "}",
].join("\n");

const FRAGMENTS = [
  "precision mediump float;",
  "uniform sampler2D uTex;",
  "uniform float uCorps;",
  "varying vec2 vUV;",
  "varying vec3 vCouleur;",
  "void main() {",
  "  vec4 t = texture2D(uTex, vUV);",
  "  if (t.a < 0.5) discard;",
  // Le ton moyen de l'orc devient exactement la couleur ; le contour de fer et
  // le pagne sombre restent sombres, puisqu'ils partent de presque rien.
  "  float gris = (t.r + t.g + t.b) / 3.0;",
  "  gl_FragColor = vec4(min(vec3(1.0), vCouleur * (gris / uCorps)), 1.0);",
  "}",
].join("\n");

/** Une couleur 0xRRGGBB en trois fractions, multipliees par une luminosite. */
function composantes(couleur: number, luminosite: number): [number, number, number] {
  return [
    (((couleur >> 16) & 255) / 255) * luminosite,
    (((couleur >> 8) & 255) / 255) * luminosite,
    ((couleur & 255) / 255) * luminosite,
  ];
}

/** Ce que Phaser appelle pour dessiner un `Extern`. */
type DessinExterne = (
  rendu: unknown,
  camera: Phaser.Cameras.Scene2D.Camera,
  calc: Phaser.GameObjects.Components.TransformMatrix,
) => void;

/**
 * Branche un dessin sur un `Extern`.
 *
 * ⚠️ Les types de Phaser ne declarent pas `render`, que son moteur appelle
 * pourtant a chaque image (`ExternWebGLRenderer` : il vide ses lots, nous passe
 * la main, puis reprend l'etat). La conversion est faite ici, une fois.
 */
function brancher(externe: Phaser.GameObjects.Extern, dessin: DessinExterne): void {
  (externe as unknown as { render: DessinExterne }).render = dessin;
}

interface Emplacements {
  coin: number;
  pos: number;
  echelleSens: number;
  couleur: number;
  phaseCouche: number;
  vue: WebGLUniformLocation | null;
  taille: WebGLUniformLocation | null;
  uv0: WebGLUniformLocation | null;
  uv1: WebGLUniformLocation | null;
  temps: WebGLUniformLocation | null;
  tex: WebGLUniformLocation | null;
  corps: WebGLUniformLocation | null;
}

export class Nuee {
  private readonly scene: Phaser.Scene;
  private readonly gl: WebGLRenderingContext;
  private readonly instancie: ANGLE_instanced_arrays;
  private readonly programme: WebGLProgram;
  private readonly lieux: Emplacements;
  private readonly tamponCoins: WebGLBuffer;
  private readonly tamponOrcs: WebGLBuffer;
  private readonly tamponCadavres: WebGLBuffer;
  private readonly bandes: Phaser.GameObjects.Extern[] = [];
  private readonly couche: Phaser.GameObjects.Extern;
  private readonly matrice = new Float32Array(9);

  /** Les orcs debout de l'image, dans l'ordre ou on les a poses. */
  private poses = new Float32Array(PAS * 1024);
  /** Les memes, bande par bande : c'est ce qui part a la carte. */
  private triees = new Float32Array(PAS * 1024);
  private ys = new Float32Array(1024);
  private ordre = new Int32Array(1024);
  private readonly debuts: Int32Array;
  private n = 0;
  /** L'image ou le tampon des orcs est parti : une fois par image, pas par bande. */
  private envoiImage = -1;

  private readonly cadavres = new Float32Array(PAS * MAX_CADAVRES);
  private nCadavres = 0;
  private teteCadavres = 0;
  private cadavresSales = false;

  /**
   * La nuee peut-elle dessiner ici ?
   *
   * ⚠️ **Sans elle, les monstres restent des sprites** — jamais des monstres
   * invisibles. Il faut WebGL et l'instanciation ; un navigateur sans l'un ou
   * l'autre joue le jeu d'avant le palier 2, a l'identique.
   */
  static possible(scene: Phaser.Scene): boolean {
    const rendu = scene.game.renderer as Phaser.Renderer.WebGL.WebGLRenderer;
    const gl = (rendu as { gl?: WebGLRenderingContext }).gl;
    return !!gl && !!gl.getExtension("ANGLE_instanced_arrays");
  }

  constructor(scene: Phaser.Scene, hauteurMonde: number) {
    this.scene = scene;
    const rendu = scene.game.renderer as Phaser.Renderer.WebGL.WebGLRenderer;
    this.gl = rendu.gl;
    const gl = this.gl;
    // Phaser ouvre du WebGL 1 : l'instanciation passe par cette extension, que
    // toute carte de ces dix dernieres annees fournit.
    this.instancie = gl.getExtension("ANGLE_instanced_arrays")!;
    this.assurerLaTexture();

    const compiler = (type: number, source: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, source);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(`[nuee] ${gl.getShaderInfoLog(s)}`);
      return s;
    };
    const programme = gl.createProgram()!;
    gl.attachShader(programme, compiler(gl.VERTEX_SHADER, SOMMETS));
    gl.attachShader(programme, compiler(gl.FRAGMENT_SHADER, FRAGMENTS));
    gl.linkProgram(programme);
    if (!gl.getProgramParameter(programme, gl.LINK_STATUS)) throw new Error(`[nuee] ${gl.getProgramInfoLog(programme)}`);
    this.programme = programme;
    this.lieux = {
      coin: gl.getAttribLocation(programme, "aCoin"),
      pos: gl.getAttribLocation(programme, "aPos"),
      echelleSens: gl.getAttribLocation(programme, "aEchelleSens"),
      couleur: gl.getAttribLocation(programme, "aCouleur"),
      phaseCouche: gl.getAttribLocation(programme, "aPhaseCouche"),
      vue: gl.getUniformLocation(programme, "uVue"),
      taille: gl.getUniformLocation(programme, "uTaille"),
      uv0: gl.getUniformLocation(programme, "uUV0"),
      uv1: gl.getUniformLocation(programme, "uUV1"),
      temps: gl.getUniformLocation(programme, "uTemps"),
      tex: gl.getUniformLocation(programme, "uTex"),
      corps: gl.getUniformLocation(programme, "uCorps"),
    };
    this.tamponCoins = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.tamponCoins);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]), gl.STATIC_DRAW);
    this.tamponOrcs = gl.createBuffer()!;
    this.tamponCadavres = gl.createBuffer()!;

    const nombre = Math.ceil(hauteurMonde / HAUTEUR_BANDE) + 1;
    this.debuts = new Int32Array(nombre + 1);
    for (let b = 0; b < nombre; b++) {
      const bande = scene.add.extern();
      // Le milieu de la bande : l'erreur de profondeur se partage des deux cotes.
      bande.setDepth(b * HAUTEUR_BANDE + HAUTEUR_BANDE / 2);
      brancher(bande, (_r, camera, calc) => this.dessinerBande(b, camera, calc));
      this.bandes.push(bande);
    }
    this.couche = scene.add.extern();
    this.couche.setDepth(PROFONDEUR_CADAVRES);
    brancher(this.couche, (_r, _camera, calc) => this.dessinerCadavres(calc));
  }

  /**
   * Sans le PNG de Blender, un orc dessine au code : le jeu ne doit jamais
   * afficher un carre vert (`assets.ts` : le code est le secours de toute cle).
   */
  private assurerLaTexture(): void {
    if (this.scene.textures.exists(CLE_ORC)) return;
    const g = this.scene.add.graphics();
    g.fillStyle(0x6c6a6a).fillRect(8, 16, 8, 6);
    g.fillStyle(0xa6a6a6).fillRoundedRect(5, 7, 14, 10, 3).fillRect(9, 3, 7, 5);
    g.generateTexture(CLE_ORC, TAILLE_ORC, TAILLE_ORC);
    g.destroy();
  }

  /** Une nouvelle image : on repose tous les orcs debout. */
  commencer(): void {
    this.n = 0;
  }

  /**
   * Un orc debout, pour cette image.
   *
   * @param echelle son rang et son archetype : 1 pour la pietaille (§4.33)
   * @param sens 1 s'il regarde a droite, -1 a gauche
   * @param couleur la teinte de son type, ou le rouge du coup
   * @param luminosite ce qu'il lui reste de vie, deja traduit (§4.33 : il fonce en mourant)
   * @param phase sa phase de marche, ou -1 s'il ne bouge pas
   */
  poser(x: number, y: number, echelle: number, sens: number, couleur: number, luminosite: number, phase: number): void {
    if ((this.n + 1) * PAS > this.poses.length) {
      const taille = this.poses.length * 2;
      const poses = new Float32Array(taille);
      poses.set(this.poses);
      this.poses = poses;
      this.triees = new Float32Array(taille);
      const ys = new Float32Array(taille / PAS);
      ys.set(this.ys);
      this.ys = ys;
      this.ordre = new Int32Array(taille / PAS);
    }
    const [r, v, b] = composantes(couleur, luminosite);
    const o = this.n * PAS;
    const d = this.poses;
    d[o] = x;
    d[o + 1] = y;
    d[o + 2] = echelle;
    d[o + 3] = sens;
    d[o + 4] = r;
    d[o + 5] = v;
    d[o + 6] = b;
    d[o + 7] = phase;
    d[o + 8] = 0;
    this.ys[this.n] = y;
    this.n += 1;
  }

  /** Les orcs poses, rangees par bandes : a appeler une fois, apres le dernier `poser`. */
  finir(): void {
    rangerParBandes(this.n, this.ys, HAUTEUR_BANDE, this.debuts, this.ordre);
    const de = this.poses;
    const vers = this.triees;
    for (let k = 0; k < this.n; k++) {
      const o = this.ordre[k]! * PAS;
      vers.set(de.subarray(o, o + PAS), k * PAS);
    }
  }

  /** Un orc qui tombe laisse un orc couche, assombri, qui reste (§4.33 §5). */
  coucher(x: number, y: number, echelle: number, sens: number, couleur: number): void {
    const [r, v, b] = composantes(couleur, 0.38);
    const o = this.teteCadavres * PAS;
    const d = this.cadavres;
    d[o] = x;
    d[o + 1] = y;
    d[o + 2] = echelle;
    d[o + 3] = sens;
    d[o + 4] = r;
    d[o + 5] = v;
    d[o + 6] = b;
    d[o + 7] = -1;
    d[o + 8] = 1;
    this.teteCadavres = (this.teteCadavres + 1) % MAX_CADAVRES;
    this.nCadavres = Math.min(MAX_CADAVRES, this.nCadavres + 1);
    this.cadavresSales = true;
  }

  /** Combien d'orcs sont couches sur le champ de bataille. */
  get cadavresAuSol(): number {
    return this.nCadavres;
  }

  private dessinerBande(bande: number, camera: Phaser.Cameras.Scene2D.Camera, calc: Phaser.GameObjects.Components.TransformMatrix): void {
    const debut = this.debuts[bande]!;
    const fin = this.debuts[bande + 1]!;
    if (fin <= debut) return;
    // Une bande hors de l'ecran ne coute rien : ni envoi, ni dessin.
    const haut = bande * HAUTEUR_BANDE;
    const vue = camera.worldView;
    if (haut - DEBORD > vue.bottom || haut + HAUTEUR_BANDE + DEBORD < vue.y) return;
    const gl = this.gl;
    const image = this.scene.game.loop.frame;
    if (this.envoiImage !== image) {
      this.envoiImage = image;
      gl.bindBuffer(gl.ARRAY_BUFFER, this.tamponOrcs);
      gl.bufferData(gl.ARRAY_BUFFER, this.triees.subarray(0, this.n * PAS), gl.DYNAMIC_DRAW);
    }
    this.dessiner(this.tamponOrcs, debut, fin - debut, calc);
  }

  private dessinerCadavres(calc: Phaser.GameObjects.Components.TransformMatrix): void {
    if (this.nCadavres === 0) return;
    const gl = this.gl;
    if (this.cadavresSales) {
      this.cadavresSales = false;
      gl.bindBuffer(gl.ARRAY_BUFFER, this.tamponCadavres);
      gl.bufferData(gl.ARRAY_BUFFER, this.cadavres.subarray(0, this.nCadavres * PAS), gl.DYNAMIC_DRAW);
    }
    this.dessiner(this.tamponCadavres, 0, this.nCadavres, calc);
  }

  /** Un appel de dessin pour `combien` orcs, a partir du `debut`-ieme du tampon. */
  private dessiner(tampon: WebGLBuffer, debut: number, combien: number, calc: Phaser.GameObjects.Components.TransformMatrix): void {
    const gl = this.gl;
    const inst = this.instancie;
    const L = this.lieux;
    const rendu = this.scene.game.renderer as Phaser.Renderer.WebGL.WebGLRenderer;
    const w = rendu.width;
    const h = rendu.height;
    // Monde -> ecran (la matrice de Phaser, zoom et defilement compris), puis
    // ecran -> clip. GLSL range ses matrices par colonnes.
    const m = this.matrice;
    m[0] = (calc.a * 2) / w;
    m[1] = (-calc.b * 2) / h;
    m[2] = 0;
    m[3] = (calc.c * 2) / w;
    m[4] = (-calc.d * 2) / h;
    m[5] = 0;
    m[6] = (calc.e * 2) / w - 1;
    m[7] = 1 - (calc.f * 2) / h;
    m[8] = 1;

    const cadre = this.scene.textures.get(CLE_ORC).get();
    const enveloppe = cadre.source.glTexture as unknown as { webGLTexture?: WebGLTexture } | WebGLTexture;
    const texture = (enveloppe as { webGLTexture?: WebGLTexture }).webGLTexture ?? (enveloppe as WebGLTexture);

    gl.useProgram(this.programme);
    gl.uniformMatrix3fv(L.vue, false, m);
    gl.uniform2f(L.taille, cadre.cutWidth, cadre.cutHeight);
    gl.uniform2f(L.uv0, cadre.u0, cadre.v0);
    gl.uniform2f(L.uv1, cadre.u1, cadre.v1);
    gl.uniform1f(L.temps, this.scene.time.now / 1000);
    gl.uniform1f(L.corps, CORPS_ORC);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(L.tex, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.tamponCoins);
    gl.enableVertexAttribArray(L.coin);
    gl.vertexAttribPointer(L.coin, 2, gl.FLOAT, false, 0, 0);
    inst.vertexAttribDivisorANGLE(L.coin, 0);

    // WebGL 1 ne sait pas commencer a la n-ieme instance : on decale les
    // pointeurs d'autant, c'est tout ce que coute une bande.
    const base = debut * OCTETS;
    gl.bindBuffer(gl.ARRAY_BUFFER, tampon);
    const attribut = (lieu: number, composantes: number, decalage: number) => {
      gl.enableVertexAttribArray(lieu);
      gl.vertexAttribPointer(lieu, composantes, gl.FLOAT, false, OCTETS, base + decalage);
      inst.vertexAttribDivisorANGLE(lieu, 1);
    };
    attribut(L.pos, 2, 0);
    attribut(L.echelleSens, 2, 8);
    attribut(L.couleur, 3, 16);
    attribut(L.phaseCouche, 2, 28);

    inst.drawArraysInstancedANGLE(gl.TRIANGLES, 0, 6, combien);

    // ⚠️ **Rendre l'etat tel qu'on l'a trouve.** Phaser n'a pas de VAO en WebGL 1 :
    // un diviseur laisse a 1 sur un attribut qu'il reutilise casserait tout ce
    // qu'il dessine ensuite.
    for (const lieu of [L.pos, L.echelleSens, L.couleur, L.phaseCouche]) {
      inst.vertexAttribDivisorANGLE(lieu, 0);
      gl.disableVertexAttribArray(lieu);
    }
    gl.disableVertexAttribArray(L.coin);
  }

  detruire(): void {
    for (const b of this.bandes) b.destroy();
    this.couche.destroy();
    const gl = this.gl;
    gl.deleteBuffer(this.tamponCoins);
    gl.deleteBuffer(this.tamponOrcs);
    gl.deleteBuffer(this.tamponCadavres);
    gl.deleteProgram(this.programme);
  }
}
