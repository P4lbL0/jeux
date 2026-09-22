import { chromium } from "playwright";
import { createServer } from "vite";
import { copyFileSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Une nuit a 800 orcs, pour juger a l'oeil (§4.33, apres le palier 0).
 *
 *     npx tsx scripts/capturer-horde.ts [dossier] [brouillon]
 *
 * Angelos veut **voir** la horde avant de decider si vingt mille valent une
 * reecriture : « le chiffre qui compte n'est pas celui qui tient a 60 images
 * par seconde, c'est celui qui reste lisible ». Ce script ne mesure donc rien
 * de la fluidite : il fabrique les images sur lesquelles on juge la lisibilite.
 *
 * ⚠️ **Une nuit ordinaire ne remplit jamais 800.** L'effectif est de 30 + 12
 * par nuit, et les apparitions sont plafonnees a cinq par seconde : il faudrait
 * la nuit 65. On force donc une nuit chargee — la nuit 12, avec un effectif
 * sans fond — et on remplit d'un coup jusqu'au plafond, **aux fronts**, pour
 * que la maree arrive par ou elle arrive vraiment.
 *
 * ⚠️ Densite 1,25 : c'est celle de l'ecran d'Angelos, et la lisibilite ne se
 * juge qu'a la bonne densite. Les images s'ecrivent d'abord hors du projet :
 * Vite surveille le dossier, et un fichier qui apparait recharge la page.
 */

const PORT = 5221;
const DOSSIER = process.argv[2] ?? "captures/jeu/2026-09-22-horde-800";
const BROUILLON = process.argv[3] ?? join(process.env.TEMP ?? ".", "horde-800");
const GRAINES = [4242, 777];
const PLAFOND = 800;
const NUIT = 12;
/**
 * Les instants de capture, en secondes de **temps de jeu** apres le remplissage.
 * La maree met vingt-cinq a trente secondes a traverser la carte depuis les
 * fronts : avant, la vue du village est vide.
 */
const INSTANTS = [20, 35, 50, 65];

interface Fenetre {
  __jeu?: {
    scene: {
      isActive(cle: string): boolean;
      stop(cle: string): void;
      start(cle: string, data: unknown): void;
    };
  };
}

mkdirSync(BROUILLON, { recursive: true });

const serveur = await createServer({
  server: { port: PORT, strictPort: true, open: false },
  logLevel: "silent",
});
await serveur.listen();

// La vraie carte, sans fenetre : meme lancement que le banc de mesure.
const navigateur = await chromium.launch({
  args: [
    "--use-angle=d3d11",
    "--enable-gpu",
    "--disable-gpu-sandbox",
    "--disable-background-timer-throttling",
    "--disable-backgrounding-occluded-windows",
    "--disable-renderer-backgrounding",
  ],
});

const erreurs: string[] = [];

try {
  for (const graine of GRAINES) {
    const page = await navigateur.newPage({
      viewport: { width: 1280, height: 800 },
      deviceScaleFactor: 1.25,
    });
    page.on("pageerror", (e) => erreurs.push(`[${graine}] ${e.message}`));

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
          graineMonde: g,
        });
        return 0;
      },
      [graine],
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
    await page.waitForTimeout(2500);

    // --------------------------------------------- la scene, et ses garde-fous
    await page.evaluate(`
      const arene = window.__jeu.scene.getScene("arena");
      // La fiche d'arrivant et le menu de competence figent la partie : une
      // nuit a 800 fait monter le heros de niveau en quelques secondes.
      arene.prochaineArriveeJournee = 9999;
      arene.ouvrirChoix = function () {};
      arene.prochaineHorde = Number.MAX_SAFE_INTEGER;
      // La capture montre la nuit, elle ne la joue pas jusqu'au bout.
      arene.finDePartie = function () {};
      // ⚠️ **pvMax est un calcul sur Hero, pas un champ** : l'ecrire ne fait
      // rien, et la premiere regeneration rabat la vie a ~100. On remplace le
      // calcul sur l'instance, pour ce heros-la et le temps de la capture.
      for (const h of arene.heros) {
        Object.defineProperty(h, "pvMax", { get() { return 1e9; }, configurable: true });
        h.pv = 1e9;
      }
      // ⚠️ **Le coeur du heros lachait**, pas ses points de vie : a 800 orcs
      // le stress grimpe en fleche et la rupture (§4.23) le fait tomber en
      // trente secondes, quelle que soit sa vie. Sans ca, la vue du joueur ne
      // montre qu'un mort et une ruine.
      arene.verifierLaRuptureDuHero = function () {};
      // Sans ca, le fond de carte loin du heros reste en vignette floue.
      if (arene.carte) arene.carte.toutCuire();
      // La nuit tombe a l'image suivante.
      arene.cycle.jour = ${NUIT};
      arene.cycle.ecoule = arene.cycle.duree - 20;
      void 0;
    `);
    await page.waitForFunction(
      `window.__jeu.scene.getScene("arena").cycle.phase === "nuit"`,
      null,
      { timeout: 20_000 },
    );
    // Au coeur de la nuit : le fondu du crepuscule est fini, le voile est plein.
    await page.evaluate(`
      const arene = window.__jeu.scene.getScene("arena");
      arene.cycle.ecoule = arene.cycle.duree * 0.3;
      arene.resteDeLaNuit = 100000;
      const puissance = arene.puissanceIci(arene.cycle.nuit);
      for (let i = arene.ennemis.getLength(); i < ${PLAFOND}; i++) arene.faireApparaitreEnnemi(puissance);
      // ⚠️ **A l'eglise, le heros se soigne, il ne se bat pas** (etat cite,
      // dans les 90 px). On le pose a 150 px, du cote d'ou vient la maree :
      // c'est la que le joueur serait, et c'est la qu'on juge la lisibilite.
      let mx = 0, my = 0, n = 0;
      for (const o of arene.ennemis.getChildren()) { mx += o.x; my += o.y; n += 1; }
      const ex = arene.eglise.sprite.x, ey = arene.eglise.sprite.y;
      const angle = Math.atan2(my / n - ey, mx / n - ex);
      arene.hero.setPosition(ex + Math.cos(angle) * 150, ey + Math.sin(angle) * 150);
      window.__depart = arene.time.now;
      void 0;
    `);

    for (const instant of INSTANTS) {
      // Le temps de jeu, pas le temps reel : sous vingt images par seconde le
      // jeu passe au ralenti (palier 0), et une attente en secondes reelles ne
      // montrerait pas le meme moment d'une graine a l'autre.
      await page.waitForFunction(
        `window.__jeu.scene.getScene("arena").time.now - window.__depart >= ${instant * 1000}`,
        null,
        { timeout: 180_000, polling: 200 },
      );
      const etat = (await page.evaluate(`
        (() => {
          const arene = window.__jeu.scene.getScene("arena");
          return {
            vivants: arene.ennemis.getLength(),
            fps: Math.round(window.__jeu.loop.actualFps),
            villageois: arene.village.vivants.length,
            heros: arene.hero.etat,
            eglise: arene.eglise.debout !== false,
          };
        })()
      `)) as { vivants: number; fps: number; villageois: number; heros: string; eglise: boolean };

      // 1. Ce que voit le joueur : le zoom d'entree, la camera sur le heros.
      await page.evaluate(`
        const arene = window.__jeu.scene.getScene("arena");
        for (const h of arene.heros) h.pv = 1e9;
        void 0;
      `);
      await page.waitForTimeout(80);
      const nom = `${graine}-${String(instant).padStart(2, "0")}s`;
      await page.screenshot({ path: join(BROUILLON, `${nom}-joueur.png`) });

      // 2. Le village entier, au dezoom le plus large que le jeu permette.
      await page.evaluate(`
        const arene = window.__jeu.scene.getScene("arena");
        const cam = arene.cameras.main;
        window.__zoomAvant = cam.zoom;
        cam.stopFollow();
        cam.setZoom(arene.zoomLePlusLarge());
        cam.centerOn(arene.eglise.sprite.x, arene.eglise.sprite.y);
        void 0;
      `);
      // Le cadrage ne se recalcule qu'au rendu suivant (piege n°1).
      await page.waitForTimeout(120);
      await page.screenshot({ path: join(BROUILLON, `${nom}-village.png`) });
      await page.evaluate(`
        const arene = window.__jeu.scene.getScene("arena");
        const cam = arene.cameras.main;
        cam.setZoom(window.__zoomAvant);
        cam.startFollow(arene.hero, true, 0.12, 0.12);
        cam.centerOn(arene.hero.x, arene.hero.y);
        void 0;
      `);
      console.log(
        `  ${nom} : ${etat.vivants} orcs, ${etat.fps} i/s, ${etat.villageois} habitants, heros ${etat.heros}, eglise ${etat.eglise ? "debout" : "a terre"}`,
      );
    }
    await page.close();
  }
} finally {
  await navigateur.close();
  await serveur.close();
}

// Le navigateur est ferme : on peut ecrire dans le projet sans rien recharger.
mkdirSync(DOSSIER, { recursive: true });
for (const fichier of readdirSync(BROUILLON)) {
  if (fichier.endsWith(".png")) copyFileSync(join(BROUILLON, fichier), join(DOSSIER, fichier));
}
console.log(`\n→ ${DOSSIER}`);
console.log(erreurs.length ? `erreurs : ${erreurs.join(" | ")}` : "aucune erreur de page");
