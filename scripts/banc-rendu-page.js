/**
 * Le code de page du banc de rendu (§4.33 §7), injecte tel quel par
 * `scripts/banc-rendu.ts`.
 *
 * ⚠️ **C'est un fichier a part, et du JavaScript nu, pour deux raisons.** Les
 * shaders ont leurs propres guillemets, et une chaine de cette taille dans un
 * gabarit se casse au premier accent grave ; et tsx, qui transforme les scripts,
 * ajoute a toute fonction nommee un `__name` qui n'existe pas dans la page. Lu
 * comme du texte, ce fichier ne passe par aucune transformation.
 *
 * Il expose `window.__rendu`, que le banc pilote palier par palier.
 */
(() => {
  const jeu = window.__jeu;
  const arene = jeu.scene.getScene("arena");

  // ------------------------------------------------------------ garde-fous
  arene.prochaineArriveeJournee = 9999;
  arene.prochaineHorde = Number.MAX_SAFE_INTEGER;
  arene.finDePartie = function () {};
  arene.ouvrirChoix = function () {};
  if (arene.carte) arene.carte.toutCuire();

  // La silhouette de la horde : on la releve sur un vrai monstre, pour dessiner
  // exactement ce que le jeu dessine — meme texture, meme cadre, meme echelle.
  arene.faireApparaitreEnnemi(3);
  const modele = arene.ennemis.getChildren()[0];
  const CLE = modele.texture.key;
  const CADRE = modele.frame;
  const ECHELLE = modele.scaleX;
  for (const o of [...arene.ennemis.getChildren()]) o.destroy();

  // La camera ne bouge plus : la mesure compare des paliers, pas des cadrages.
  const cam = arene.cameras.main;
  cam.stopFollow();
  cam.centerOn(arene.eglise.sprite.x, arene.eglise.sprite.y);

  // ------------------------------------------------------------- la mesure
  const cumul = Object.create(null);
  let images = 0;
  let derniereImage = 0;

  const enrober = (objet, methode, cle) => {
    const origine = objet[methode];
    cumul[cle] = 0;
    objet[methode] = function (...args) {
      const t = performance.now();
      try {
        return origine.apply(this, args);
      } finally {
        cumul[cle] += performance.now() - t;
      }
    };
  };
  enrober(jeu.renderer, "render", "rendu");
  enrober(arene.children, "depthSort", "tri");

  // L'UpdateList appelle le preUpdate de chaque Sprite (ses animations) : c'est
  // une part du prix d'un Sprite que le rendu ne voit pas. Elle est branchee par
  // evenement, donc on la remplace dans le registre de l'emetteur.
  const registre = arene.sys.events._events;
  for (const nom of ["preupdate", "update"]) {
    const brut = registre[nom];
    if (!brut) continue;
    for (const ecouteur of Array.isArray(brut) ? brut : [brut]) {
      const contexte = ecouteur.context;
      if (!contexte || contexte !== arene.sys.updateList) continue;
      const origine = ecouteur.fn;
      const cle = "liste-" + nom;
      cumul[cle] = 0;
      ecouteur.fn = function (...args) {
        const t = performance.now();
        try {
          return origine.apply(this, args);
        } finally {
          cumul[cle] += performance.now() - t;
        }
      };
    }
  }

  // Le compteur d'images, sur la fonction que Phaser a memorisee au demarrage.
  const origineUpdate = arene.sys.sceneUpdate;
  cumul.image = 0;
  arene.sys.sceneUpdate = function (...args) {
    const t = performance.now();
    if (derniereImage) cumul.image += t - derniereImage;
    derniereImage = t;
    images += 1;
    return origineUpdate.apply(this, args);
  };

  // ---------------------------------------------- la disposition des figurants
  const vue = () => cam.worldView;
  /** Dans le champ de la camera (le pire cas pour la carte) ou sur toute la carte. */
  const positions = (combien, etale) => {
    const xs = new Float32Array(combien);
    const ys = new Float32Array(combien);
    const v = vue();
    for (let i = 0; i < combien; i++) {
      xs[i] = etale ? Math.random() * 3464 : v.x + Math.random() * v.width;
      ys[i] = etale ? Math.random() * 2598 : v.y + Math.random() * v.height;
    }
    return { xs, ys };
  };

  // --------------------------------------------- (a) des Sprites Phaser nus
  const sprites = [];
  const poserSprites = (combien, etale) => {
    const { xs, ys } = positions(combien, etale);
    for (let i = 0; i < combien; i++) {
      const s = arene.add.sprite(xs[i], ys[i], CLE, CADRE.name);
      s.setScale(ECHELLE);
      // La profondeur se pose **une fois** : immobiles, ils n'ont pas a etre
      // retries. Le tri qu'on verra quand meme est celui que declenchent les
      // heros et les habitants, qui changent de profondeur a chaque image.
      s.setDepth(ys[i]);
      sprites.push(s);
    }
  };

  // ------------------------------- (b) des quads, une passe WebGL instanciee
  const gl = jeu.renderer.gl;
  const instancie = gl.getExtension("ANGLE_instanced_arrays");

  const SOMMETS = [
    "attribute vec2 aCoin;",
    "attribute vec2 aPos;",
    "uniform mat3 uVue;",
    "uniform vec2 uTaille;",
    "uniform vec2 uUV0;",
    "uniform vec2 uUV1;",
    "varying vec2 vUV;",
    "void main() {",
    "  vec2 monde = aPos + (aCoin - vec2(0.5)) * uTaille;",
    "  vec3 clip = uVue * vec3(monde, 1.0);",
    "  gl_Position = vec4(clip.xy, 0.0, 1.0);",
    "  vUV = mix(uUV0, uUV1, aCoin);",
    "}",
  ].join("\n");
  const FRAGMENTS = [
    "precision mediump float;",
    "uniform sampler2D uTex;",
    "varying vec2 vUV;",
    "void main() {",
    "  vec4 c = texture2D(uTex, vUV);",
    "  if (c.a < 0.01) discard;",
    "  gl_FragColor = c;",
    "}",
  ].join("\n");

  const compiler = (type, source) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, source);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  };
  const programme = gl.createProgram();
  gl.attachShader(programme, compiler(gl.VERTEX_SHADER, SOMMETS));
  gl.attachShader(programme, compiler(gl.FRAGMENT_SHADER, FRAGMENTS));
  gl.linkProgram(programme);
  if (!gl.getProgramParameter(programme, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(programme));

  const A_COIN = gl.getAttribLocation(programme, "aCoin");
  const A_POS = gl.getAttribLocation(programme, "aPos");
  const U = {
    vue: gl.getUniformLocation(programme, "uVue"),
    taille: gl.getUniformLocation(programme, "uTaille"),
    uv0: gl.getUniformLocation(programme, "uUV0"),
    uv1: gl.getUniformLocation(programme, "uUV1"),
    tex: gl.getUniformLocation(programme, "uTex"),
  };
  const tamponCoins = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, tamponCoins);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]), gl.STATIC_DRAW);
  const tamponInstances = gl.createBuffer();

  // La texture du monstre telle que Phaser l'a envoyee a la carte.
  const enveloppe = CADRE.source.glTexture;
  const TEXTURE = enveloppe && enveloppe.webGLTexture ? enveloppe.webGLTexture : enveloppe;

  const matrice = new Float32Array(9);
  let quads = null;
  let extern = null;

  const poserQuads = (combien, etale) => {
    const { xs, ys } = positions(combien, etale);
    // Entrelace x, y : c'est la forme que la nuee aura (§4.33 §4).
    quads = new Float32Array(combien * 2);
    for (let i = 0; i < combien; i++) {
      quads[i * 2] = xs[i];
      quads[i * 2 + 1] = ys[i];
    }
    extern = arene.add.extern();
    // Un seul objet dans la liste d'affichage, a la profondeur moyenne : le tri
    // ne voit qu'un element de plus, quel que soit le nombre de quads.
    extern.setDepth(1000);
    extern.render = function (rendu, camera, calc) {
      const w = rendu.width;
      const h = rendu.height;
      // Monde -> ecran (la matrice de Phaser, zoom et defilement compris),
      // puis ecran -> clip. GLSL range les matrices par colonnes.
      matrice[0] = (calc.a * 2) / w;
      matrice[1] = (-calc.b * 2) / h;
      matrice[2] = 0;
      matrice[3] = (calc.c * 2) / w;
      matrice[4] = (-calc.d * 2) / h;
      matrice[5] = 0;
      matrice[6] = (calc.e * 2) / w - 1;
      matrice[7] = 1 - (calc.f * 2) / h;
      matrice[8] = 1;

      gl.useProgram(programme);
      gl.uniformMatrix3fv(U.vue, false, matrice);
      gl.uniform2f(U.taille, CADRE.cutWidth * ECHELLE, CADRE.cutHeight * ECHELLE);
      gl.uniform2f(U.uv0, CADRE.u0, CADRE.v0);
      gl.uniform2f(U.uv1, CADRE.u1, CADRE.v1);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, TEXTURE);
      gl.uniform1i(U.tex, 0);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

      gl.bindBuffer(gl.ARRAY_BUFFER, tamponCoins);
      gl.enableVertexAttribArray(A_COIN);
      gl.vertexAttribPointer(A_COIN, 2, gl.FLOAT, false, 0, 0);
      instancie.vertexAttribDivisorANGLE(A_COIN, 0);

      // Renvoye a chaque image, comme le fera une horde qui bouge : le prix
      // de l'envoi fait partie de la mesure.
      gl.bindBuffer(gl.ARRAY_BUFFER, tamponInstances);
      gl.bufferData(gl.ARRAY_BUFFER, quads, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(A_POS);
      gl.vertexAttribPointer(A_POS, 2, gl.FLOAT, false, 0, 0);
      instancie.vertexAttribDivisorANGLE(A_POS, 1);

      instancie.drawArraysInstancedANGLE(gl.TRIANGLES, 0, 6, quads.length / 2);

      // ⚠️ **Rendre l'etat tel qu'on l'a trouve.** WebGL1 n'a pas de VAO chez
      // Phaser : un diviseur laisse a 1 sur un attribut qu'il reutilise
      // casserait tout ce qu'il dessine ensuite.
      instancie.vertexAttribDivisorANGLE(A_POS, 0);
      gl.disableVertexAttribArray(A_POS);
      gl.disableVertexAttribArray(A_COIN);
    };
    enrober(extern, "render", "instancie");
  };

  const vider = () => {
    for (const s of sprites) s.destroy();
    sprites.length = 0;
    if (extern) extern.destroy();
    extern = null;
    quads = null;
  };

  window.__rendu = {
    cadre: { cle: CLE, nom: CADRE.name, largeur: CADRE.cutWidth, hauteur: CADRE.cutHeight, echelle: ECHELLE },
    poserSprites,
    poserQuads,
    vider,
    remettreAZero() {
      for (const cle of Object.keys(cumul)) cumul[cle] = 0;
      images = 0;
      derniereImage = 0;
    },
    lire() {
      const parImage = {};
      for (const cle of Object.keys(cumul)) parImage[cle] = images ? cumul[cle] / images : 0;
      return { images, parImage };
    },
  };
})();
