import { chromium } from "playwright";
import { createServer } from "vite";

/**
 * Le banc de la horde (§4.33) : ou passent les seize millisecondes, poste par
 * poste, quand le nombre de monstres monte.
 *
 *     npx tsx scripts/banc-horde.ts [graine] [--paliers=1000,2000] [--temoin]
 *
 * - `graine` rejoue un monde precis : **on ne compare que sur le meme monde**,
 *   la falaise varie du simple au double d'un tirage a l'autre ;
 * - `--paliers` choisit les effectifs (par defaut 0, 60, 250, 500, 1000, 2000) ;
 * - `--temoin` remet l'avant-palier-0 depuis la page (pas fixe avec rattrapage),
 *   pour mesurer le temoin et le gain dans les memes conditions.
 *
 * Il a servi a la passe de profilage du 22 septembre 2026, puis a verifier le
 * palier 0. Chaque palier suivant se mesure avec lui, avant et apres.
 *
 * ⚠️ En rendu logiciel, tout ce qui est minute s'etire d'un facteur quatre :
 * les **parts** et les **ecarts** sont vrais, les millisecondes absolues non.
 *
 * ⚠️ Tout le code de page part en **chaine** : sous tsx, une fonction nommee
 * passee a `page.evaluate` embarque `__name` et casse.
 */

const PORT = 5217;
const surMesure = process.argv.find((a) => a.startsWith("--paliers="));
const PALIERS = surMesure
  ? surMesure.slice(10).split(",").map(Number)
  : [0, 60, 250, 500, 1000, 2000];
/** Duree de mesure par palier, en ms de temps reel. */
const DUREE = 6000;

interface Fenetre {
  __jeu?: {
    scene: {
      isActive(cle: string): boolean;
      stop(cle: string): void;
      start(cle: string, data: unknown): void;
      getScene(cle: string): unknown;
    };
  };
}

const serveur = await createServer({
  server: { port: PORT, strictPort: true, open: false },
  logLevel: "silent",
});
await serveur.listen();

/**
 * ⚠️ **Deux pieges de mesure, payes tous les deux.**
 *
 * 1. **Sans carte graphique, le rendu ment.** Par defaut, Chromium sans fenetre
 *    peint par le processeur (SwiftShader) : l'image coute deja 46 a 66 ms a
 *    vide, ce qui noie le prix d'affichage et declenche en cascade le
 *    rattrapage de la physique. Toute part mesuree ainsi est fausse.
 * 2. **Chrome bride a une image par seconde une fenetre qu'il croit cachee.**
 *    Vu en mesure : des paliers entiers a 1 011 ms d'image **pile**, ce qui
 *    n'est pas un ralentissement mais un etranglement — et les drapeaux
 *    anti-bridage n'y suffisent pas des que le terminal repasse devant.
 *
 * La sortie tient les deux bouts : **sans fenetre, mais sur la vraie carte**,
 * par ANGLE en Direct3D 11. Rien a afficher, donc rien a brider. Verifie :
 * « ANGLE (AMD, AMD Radeon(TM) Graphics, D3D11) » au lieu de SwiftShader.
 */
const SUR_LA_VRAIE_CARTE = [
  "--use-angle=d3d11",
  "--enable-gpu",
  "--disable-gpu-sandbox",
  "--disable-background-timer-throttling",
  "--disable-backgrounding-occluded-windows",
  "--disable-renderer-backgrounding",
];
const avecFenetre = process.argv.includes("--fenetre");
const navigateur = await chromium.launch({
  ...(avecFenetre ? { headless: false } : {}),
  args: avecFenetre ? ["--start-maximized", ...SUR_LA_VRAIE_CARTE] : SUR_LA_VRAIE_CARTE,
});
/**
 * Le temoin : on remet l'ancien comportement **depuis la page**, sur le meme
 * monde et dans la meme passe. C'est la seule facon de comparer sans que le
 * tirage du monde ne s'en mele.
 */
const temoin = process.argv.includes("--temoin");
/**
 * `--etales` : les monstres naissent aux fronts et marchent vers le village, au
 * lieu d'etre poses au contact du heros. C'est le cas reel — la horde vient
 * petit a petit (§4.33) — et c'est le seul ou le niveau de detail temporel du
 * palier 1 peut servir : au contact, tout le monde est proche et a l'ecran.
 */
const etales = process.argv.includes("--etales");
const page = await navigateur.newPage({ viewport: { width: 1280, height: 800 } });

const erreurs: string[] = [];
page.on("console", (m) => {
  if (m.type() === "error") erreurs.push(m.text());
});
page.on("pageerror", (e) => erreurs.push(e.message));

/** Ce que la page rend a la fin d'un palier. */
interface Releve {
  monstres: number;
  images: number;
  fps: number;
  parImage: Record<string, number>;
  appels: Record<string, number>;
}

const graine = Number(process.argv.find((a) => /^[0-9]+$/.test(a)) ?? 0) || undefined;

try {
  await page.goto(`http://localhost:${PORT}/`);
  await page.waitForFunction(
    () => (window as unknown as Fenetre).__jeu?.scene.isActive("titre") === true,
    null,
    { timeout: 30_000 },
  );

  await page.evaluate(
    ([g]) => {
      const jeu = (window as unknown as Fenetre).__jeu!;
      jeu.scene.stop("titre");
      if (jeu.scene.isActive("menu")) jeu.scene.stop("menu");
      jeu.scene.start("arena", {
        classe: "guerrier",
        emplacement: 1,
        sansLaMarche: true,
        // ⚠️ **Le village a sa propre graine, tiree au hasard a chaque partie**
        // si on ne la donne pas : meme monde, autre village — 45 murs une
        // fois, 90 la suivante. Comparer « sur le meme monde » exige les deux.
        ...(g ? { graineMonde: g, graineVillage: g } : {}),
      });
      return 0;
    },
    [graine ?? 0],
  );
  await page.waitForFunction(
    () => {
      const jeu = (window as unknown as Fenetre).__jeu;
      return jeu?.scene.isActive("arena") === true && jeu.scene.isActive("ui") === true;
    },
    null,
    { timeout: 30_000 },
  );
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await page.waitForTimeout(2000);

  const carte = (await page.evaluate(`
    (() => {
      const toile = document.querySelector("canvas");
      const gl = toile && (toile.getContext("webgl2") || toile.getContext("webgl"));
      if (!gl) return "?";
      const info = gl.getExtension("WEBGL_debug_renderer_info");
      return info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : "?";
    })()
  `)) as string;
  console.log(`carte : ${carte}`);
  if (/SwiftShader/i.test(carte)) console.log("⚠️  rendu logiciel : la passe ne vaut rien");

  // ------------------------------------------------- le banc, et ses garde-fous
  await page.evaluate(`
    const TEMOIN = ${temoin};
    const ETALES = ${etales};
    const arene = window.__jeu.scene.getScene("arena");
    // La fiche d'arrivant met la partie en pause : on repousse l'arrivee.
    arene.prochaineArriveeJournee = 9999;
    // Aucune horde ne doit venir brouiller l'effectif qu'on installe.
    arene.prochaineHorde = Number.MAX_SAFE_INTEGER;
    // Garde-fou : le banc mesure, il ne joue pas. Rien ne doit couper l'image.
    arene.finDePartie = function () {};
    // Le temoin rejoue l'avant-palier-0 : pas fixe avec rattrapage sans borne,
    // et delta plafonne a 100 ms au lieu de 50.
    if (TEMOIN) {
      arene.physics.world.fixedStep = true;
      window.__jeu.loop._min = 100;
    }

    window.__banc = {
      // Personne ne meurt pendant la mesure : ni le heros, ni l'eglise, ni un
      // monstre. Un effectif qui fond fausserait la comparaison entre paliers.
      immortaliser() {
        // ⚠️ **pvMax est un calcul sur Hero, pas un champ** : l'ecrire ne fait
        // rien, et la premiere regeneration rabattait la vie a ~100 — le heros
        // pouvait mourir en pleine mesure et changer la charge d'une passe a
        // l'autre. Le calcul est remplace sur l'instance, et le coeur ne lache
        // plus (la rupture du §4.23 tue quelle que soit la vie).
        for (const h of arene.heros) {
          Object.defineProperty(h, "pvMax", { get() { return 1e9; }, configurable: true });
          h.pv = 1e9;
        }
        arene.verifierLaRuptureDuHero = function () {};
        for (const o of arene.ennemis.getChildren()) { o.pvMax = 1e9; o.pv = 1e9; }
        // ⚠️ **Le village eteint termine la partie** : a 500 monstres poses au
        // contact, les habitants tombent en quelques secondes, la boucle d image sort
        // des sa premiere ligne et tous les postes se mesurent a zero. C'est
        // ce qui a rendu muets les trois derniers paliers du premier jet.
        for (const v of arene.village.vivants) v.regles.pv = 1e9;
      },
      remplir(cible) {
        const vivants = arene.ennemis.getLength();
        for (let i = vivants; i < cible; i++) arene.faireApparaitreEnnemi(3);
        // ⚠️ **Les monstres naissent au bord d'un front**, a des milliers de
        // pixels : mesures la, ils ne touchent rien et les dix passes de
        // collision ne rencontrent jamais personne. On les repose en couronne
        // autour du heros — la melee generale, le pire cas honnete.
        const cx = arene.hero.x;
        const cy = arene.hero.y;
        let i = 0;
        if (ETALES) { this.immortaliser(); return arene.ennemis.getLength(); }
        for (const o of arene.ennemis.getChildren()) {
          const angle = (i * 2.399963229728653) % (Math.PI * 2);
          const rayon = 48 + Math.sqrt(i / Math.max(1, cible)) * 420;
          o.setPosition(cx + Math.cos(angle) * rayon, cy + Math.sin(angle) * rayon);
          i += 1;
        }
        this.immortaliser();
        return arene.ennemis.getLength();
      },
      /**
       * La carte cuit par morceaux et mange jusqu'a six millisemes par image :
       * mesurer pendant qu'elle cuit, c'est mesurer la cuisson. On la finit
       * d'un coup, ce que toutCuire est la pour faire.
       */
      cuireLaCarte() {
        if (arene.carte) arene.carte.toutCuire();
      },
      vider() {
        for (const o of [...arene.ennemis.getChildren()]) o.destroy();
      },
    };
    void 0;
  `);

  // ---------------------------------------------- l'instrumentation par methode
  await page.evaluate(`
    const jeu = window.__jeu;
    const arene = jeu.scene.getScene("arena");
    const proto = Object.getPrototypeOf(arene);

    const cumul = Object.create(null);
    const appels = Object.create(null);
    let images = 0;

    window.__mesure = {
      remettreAZero() {
        for (const cle of Object.keys(cumul)) { cumul[cle] = 0; appels[cle] = 0; }
        images = 0;
      },
      lire() {
        const parImage = Object.create(null);
        const parAppel = Object.create(null);
        for (const cle of Object.keys(cumul)) {
          parImage[cle] = images ? cumul[cle] / images : 0;
          parAppel[cle] = images ? appels[cle] / images : 0;
        }
        return { images, parImage, appels: parAppel };
      },
    };

    // Un seul enrobage, pose sur un objet et une cle : c'est la seule mesure
    // qui ne suppose rien de ce que le code fait a l'interieur.
    const poser = (objet, methode, etiquette) => {
      const origine = objet[methode];
      if (typeof origine !== "function") return false;
      const cle = etiquette || methode;
      cumul[cle] = 0;
      appels[cle] = 0;
      objet[methode] = function (...args) {
        const t = performance.now();
        try { return origine.apply(this, args); }
        finally { cumul[cle] += performance.now() - t; appels[cle] += 1; }
      };
      return true;
    };

    const manquantes = [];
    const surProto = [
      "avancerLaCarte", "majEau", "majChemins", "majEtats", "majAffinites",
      "majContexteEquipe", "majCommandement", "majProvocation", "majOrbiteurs",
      "majAuras", "majInvocations", "majProvocationInvocations",
      "deplacerHeroIncarne", "deplacerHerosIA", "deplacerEnnemis",
      "gererCapacitesAuto", "gererCapacites", "majCycle", "recolterALaMain",
      "travaillerLesHeros", "majFantome", "majPortes", "majIncendie",
      "majMeteore", "majMarche", "fairePartirLesVagues", "majPoses",
      "majTeintes", "trierProfondeurs", "attaquerAvec",
      "suivreLeHeroDesHumains", "avancerEnnemi", "teinterEnnemi",
      "bloquerParLesDomes", "cibleDe", "heroLePlusProche", "ennemiLePlusProche",
      "resoudreFrappe", "contactEnnemi", "cognerConstruction", "cognerMaison",
      "cognerEglise", "rattraperHabitant", "pietinerChamp", "impactProjectile",
      "melee",
    ];
    for (const m of surProto) if (!poser(proto, m)) manquantes.push(m);

    // Hors de la scene : la physique Arcade (les dix passes), le tri de la
    // liste d'affichage, et le rendu lui-meme.
    poser(arene.physics.world, "step", "PHYSIQUE.step-rattrapage");
    poser(arene.physics.world, "collideObjects", "PHYSIQUE.collideObjects");
    poser(arene.children, "depthSort", "RENDU.depthSort");
    poser(jeu.renderer, "render", "RENDU.render");

    // Chaque passe de collision a son propre compteur : le total des dix ne dit
    // pas laquelle coute. Le nom vient du groupe, retrouve par reference.
    const nomsDeGroupes = new Map([
      [arene.ennemis, "ennemis"], [arene.equipe, "equipe"], [arene.projectiles, "projectiles"],
      [arene.projectilesEnnemis, "crachats"], [arene.invocations, "invocations"],
      [arene.village.groupe, "village"], [arene.champs.groupe, "champs"],
      [arene.constructions.groupe, "constructions"], [arene.maisons.groupe, "maisons"],
      [arene.eglise.sprite, "eglise"], [arene.survivants.groupe, "survivants"],
      [arene.obstaclesDEau, "eau"], [arene.obstaclesDeRoche, "roche"],
    ]);
    const nomDe = (o) => nomsDeGroupes.get(o) || (o && o.constructor ? o.constructor.name : "?");
    for (const collider of arene.physics.world.colliders.getActive()) {
      const cle = "PASSE " + nomDe(collider.object1) + " x " + nomDe(collider.object2) +
        (collider.overlapOnly ? " (contact)" : " (butee)");
      if (cumul[cle] !== undefined) continue;
      poser(collider, "update", cle);
    }
    poser(arene.physics.world.tree, "load", "PHYSIQUE.arbre-dynamique");
    window.__tailles = {
      eau: arene.obstaclesDEau.getLength(),
      roche: arene.obstaclesDeRoche.getLength(),
      maisons: arene.maisons.groupe.getLength(),
      constructions: arene.constructions.groupe.getLength(),
    };

    // ⚠️ **Les etages de la scene sont branches par evenement, et l'emetteur
    // garde la fonction**, pas la propriete : remplacer world.update ou
    // updateList.update apres coup ne mesure rien. On va donc changer la
    // fonction dans le registre de l'emetteur lui-meme. C'est le seul moyen de
    // connaitre le cout **total** de la physique, rattrapages compris.
    const registre = arene.sys.events._events;
    for (const nomEvenement of ["preupdate", "update", "postupdate"]) {
      const brut = registre[nomEvenement];
      if (!brut) continue;
      const liste = Array.isArray(brut) ? brut : [brut];
      for (const ecouteur of liste) {
        const contexte = ecouteur.context;
        const nom = (contexte && contexte.constructor && contexte.constructor.name) || "?";
        const cle = nomEvenement.toUpperCase() + "." + nom;
        const origine = ecouteur.fn;
        cumul[cle] = 0;
        appels[cle] = 0;
        ecouteur.fn = function (...args) {
          const t = performance.now();
          try { return origine.apply(this, args); }
          finally { cumul[cle] += performance.now() - t; appels[cle] += 1; }
        };
      }
    }
    poser(arene.village, "majorer", "village.majorer");
    poser(arene.constructions, "majorer", "constructions.majorer");
    poser(arene.maisons, "teinter", "maisons.teinter");

    // ⚠️ **Phaser memorise \`update\` au demarrage de la scene**
    // (\`Systems.init\` copie \`scene.update\` dans \`sys.sceneUpdate\`) : enrober
    // le prototype apres coup n'atteint jamais l'image. C'est donc
    // \`sys.sceneUpdate\` qu'on remplace — et c'est aussi lui qui compte les
    // images.
    const origineUpdate = arene.sys.sceneUpdate;
    cumul["TOTAL.update"] = 0;
    appels["TOTAL.update"] = 0;
    cumul["TOTAL.image"] = 0;
    appels["TOTAL.image"] = 0;
    let derniereImage = 0;
    arene.sys.sceneUpdate = function (...args) {
      images += 1;
      const t = performance.now();
      // L'image entiere se mesure d'un debut d'image au suivant : c'est le seul
      // total qui ne suppose rien de ce que Phaser fait entre les deux.
      if (derniereImage) { cumul["TOTAL.image"] += t - derniereImage; appels["TOTAL.image"] += 1; }
      derniereImage = t;
      try { return origineUpdate.apply(this, args); }
      finally {
        cumul["TOTAL.update"] += performance.now() - t;
        appels["TOTAL.update"] += 1;
      }
    };

    window.__manquantes = manquantes;
    void 0;
  `);

  console.log(`groupes statiques : ${JSON.stringify(await page.evaluate("window.__tailles"))}${etales ? "   (etales)" : "   (au contact)"}`);
  const manquantes = await page.evaluate(
    "window.__manquantes",
  ) as string[];
  if (manquantes.length) console.log("methodes introuvables :", manquantes.join(", "));

  // La carte finie avant la premiere mesure : sinon le temoin mesure la cuisson.
  await page.evaluate("window.__banc.cuireLaCarte(); void 0;");
  // ⚠️ **Cuire toute la carte gele le jeu trois secondes**, et Phaser sort de ce
  // gel avec un retard enorme a rattraper : le premier palier mesurait la
  // resorption, pas la horde. On le laisse revenir a l'equilibre.
  await page.waitForTimeout(4000);

  const releves: Releve[] = [];
  for (const cible of PALIERS) {
    const poses = await page.evaluate(`window.__banc.remplir(${cible})`) as number;
    // Etales, ils partent des fronts : on les laisse s'etirer sur leur chemin
    // avant de mesurer, sinon on mesure une meute encore groupee au bord.
    await page.waitForTimeout(etales ? 8000 : 1200);
    await page.evaluate("window.__mesure.remettreAZero(); void 0;");
    const debut = Date.now();
    await page.waitForTimeout(DUREE);
    const ecoule = Date.now() - debut;
    const lu = await page.evaluate("window.__mesure.lire()") as {
      images: number;
      parImage: Record<string, number>;
      appels: Record<string, number>;
    };
    const restants = await page.evaluate(
      `window.__jeu.scene.getScene("arena").ennemis.getLength()`,
    ) as number;
    releves.push({
      monstres: Math.round((poses + restants) / 2),
      images: lu.images,
      fps: (lu.images * 1000) / ecoule,
      parImage: lu.parImage,
      appels: lu.appels,
    });
    console.log(`palier ${cible} : ${poses} poses, ${restants} restants, ${lu.images} images`);
  }

  // --------------------------------------------------------------- le tableau
  const cles = Object.keys(releves[0]!.parImage)
    .filter((c) => releves.some((r) => (r.parImage[c] ?? 0) > 0.02))
    .sort((a, b) => (releves.at(-1)!.parImage[b] ?? 0) - (releves.at(-1)!.parImage[a] ?? 0));

  const colonne = (s: string, n: number) => s.padStart(n);
  console.log("");
  console.log("Temps par image, en ms (rendu logiciel : lire les ecarts, pas les valeurs)");
  console.log("");
  console.log(
    "  " +
      "poste".padEnd(30) +
      releves.map((r) => colonne(`${r.monstres}`, 11)).join("") +
      colonne("x(1er->der)", 13),
  );
  for (const cle of cles) {
    const premier = releves[0]!.parImage[cle] ?? 0;
    const dernier = releves.at(-1)!.parImage[cle] ?? 0;
    const facteur = premier > 0.01 ? (dernier / premier).toFixed(1) + "x" : "-";
    console.log(
      "  " +
        cle.padEnd(30) +
        releves.map((r) => colonne((r.parImage[cle] ?? 0).toFixed(2), 11)).join("") +
        colonne(facteur, 13),
    );
  }
  console.log("");
  console.log(
    "  " +
      "IMAGES PAR SECONDE".padEnd(30) +
      releves.map((r) => colonne(r.fps.toFixed(1), 11)).join(""),
  );
  console.log("");
  console.log("Appels par image");
  for (const cle of ["avancerEnnemi", "cibleDe", "contactEnnemi", "cognerConstruction", "cognerMaison", "cognerEglise", "rattraperHabitant", "pietinerChamp"]) {
    const ligne = releves.map((r) => colonne((r.appels[cle] ?? 0).toFixed(1), 11)).join("");
    console.log("  " + cle.padEnd(30) + ligne);
  }

  console.log("");
  console.log(erreurs.length ? `erreurs console : ${erreurs.length}` : "aucune erreur de console");
  for (const e of erreurs.slice(0, 5)) console.log("  " + e);
} finally {
  await navigateur.close();
  await serveur.close();
}
