import { chromium } from "playwright";
import { createServer } from "vite";
import { copyFileSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * La mesure qui decide du rendu maison (§4.33 §7).
 *
 *     npx tsx scripts/banc-rendu.ts [graine] [dossier-captures] [brouillon]
 *
 * Deux branches, rien que le dessin — pas d'IA, pas de physique :
 *
 * - **(a)** des `Phaser.GameObjects.Sprite` immobiles, une seule texture, aucune
 *   teinte : ce que Phaser sait faire tout seul ;
 * - **(b)** des quads dessines par **une seule passe WebGL instanciee**, lisant un
 *   `Float32Array` : ce qu'on achete si on ecrit le rendu nous-memes.
 *
 * Si (a) passe, le gros du rendu maison disparait. Si (a) tombe et (b) passe, on
 * sait ce qu'on achete et a quel prix. Chaque palier rend son nombre d'images
 * par seconde **et le cout JavaScript par sprite**, temoin a zero soustrait.
 *
 * Deux dispositions : **a l'ecran** (le pire cas pour la carte graphique, qui
 * peint tout) et **etales** sur toute la carte (le cas reel : la plupart hors
 * champ). Le code de page vit dans `banc-rendu-page.js`, injecte tel quel.
 *
 * ⚠️ Sur la vraie carte, sans fenetre (`--use-angle=d3d11`) : le rendu logiciel
 * ment, et une fenetre se fait brider a une image par seconde.
 */

const PORT = 5223;
const graine = Number(process.argv.find((a) => /^[0-9]+$/.test(a)) ?? 0) || undefined;
const DOSSIER = process.argv.find((a) => a.startsWith("captures/")) ?? "captures/jeu/2026-09-22-rendu-20000";
const BROUILLON =
  process.argv.find((a, i) => i > 1 && /[\\/]/.test(a) && !a.startsWith("captures/")) ??
  join(process.env.TEMP ?? ".", "banc-rendu");
const PALIERS_SPRITES = [0, 5000, 10000, 20000];
const PALIERS_QUADS = [0, 5000, 10000, 20000, 50000];
const CHAUFFE = 1200;
const DUREE = 4000;

interface Lecture {
  images: number;
  parImage: Record<string, number>;
}

interface Ligne {
  branche: string;
  disposition: string;
  combien: number;
  fps: number;
  image: number;
  cpu: number;
  tri: number;
  parSprite: number;
}

mkdirSync(BROUILLON, { recursive: true });

const serveur = await createServer({
  server: { port: PORT, strictPort: true, open: false },
  logLevel: "silent",
});
await serveur.listen();

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
const page = await navigateur.newPage({ viewport: { width: 1280, height: 800 } });
const erreurs: string[] = [];
page.on("pageerror", (e) => erreurs.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error" && !m.text().includes("404")) erreurs.push(m.text());
});

const lignes: Ligne[] = [];

try {
  await page.goto(`http://localhost:${PORT}/`);
  await page.waitForFunction("window.__jeu && window.__jeu.scene.isActive('titre')", null, {
    timeout: 30_000,
  });
  await page.evaluate(`
    const jeu = window.__jeu;
    jeu.scene.stop("titre");
    if (jeu.scene.isActive("menu")) jeu.scene.stop("menu");
    jeu.scene.start("arena", { classe: "guerrier", emplacement: 1, sansLaMarche: true${
      graine ? `, graineMonde: ${graine}` : ""
    } });
    void 0;
  `);
  await page.waitForFunction(
    "window.__jeu.scene.isActive('arena') && window.__jeu.scene.isActive('ui')",
    null,
    { timeout: 30_000 },
  );
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await page.waitForTimeout(2500);

  const carte = (await page.evaluate(`
    (() => {
      const gl = window.__jeu.renderer.gl;
      const info = gl.getExtension("WEBGL_debug_renderer_info");
      return info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : "?";
    })()
  `)) as string;
  console.log(`carte : ${carte}${graine ? `   monde ${graine}` : ""}`);
  if (/SwiftShader/i.test(carte)) throw new Error("rendu logiciel : la passe ne vaudrait rien");

  await page.evaluate(readFileSync(new URL("./banc-rendu-page.js", import.meta.url), "utf-8"));
  // Cuire la carte gele trois secondes : on laisse le jeu revenir a l'equilibre.
  await page.waitForTimeout(4000);
  const cadre = await page.evaluate("window.__rendu.cadre");
  console.log(`silhouette : ${JSON.stringify(cadre)}`);

  const mesurer = async (
    branche: "sprites" | "quads",
    disposition: "ecran" | "etales",
    combien: number,
  ): Promise<Lecture> => {
    await page.evaluate("window.__rendu.vider(); void 0;");
    if (combien > 0) {
      const poser = branche === "sprites" ? "poserSprites" : "poserQuads";
      await page.evaluate(`window.__rendu.${poser}(${combien}, ${disposition === "etales"}); void 0;`);
    }
    await page.waitForTimeout(CHAUFFE);
    await page.evaluate("window.__rendu.remettreAZero(); void 0;");
    await page.waitForTimeout(DUREE);
    return (await page.evaluate("window.__rendu.lire()")) as Lecture;
  };

  /** Ce que le processeur paie pour dessiner, preUpdate des Sprites compris. */
  const cpu = (l: Lecture) =>
    (l.parImage.rendu ?? 0) + (l.parImage["liste-preupdate"] ?? 0) + (l.parImage["liste-update"] ?? 0);

  for (const branche of ["sprites", "quads"] as const) {
    for (const disposition of ["ecran", "etales"] as const) {
      const paliers = branche === "sprites" ? PALIERS_SPRITES : PALIERS_QUADS;
      let temoin: Lecture | null = null;
      for (const combien of paliers) {
        const l = await mesurer(branche, disposition, combien);
        if (combien === 0) temoin = l;
        const image = l.parImage.image ?? 0;
        const ligne: Ligne = {
          branche,
          disposition,
          combien,
          fps: image > 0 ? 1000 / image : 0,
          image,
          cpu: cpu(l),
          tri: l.parImage.tri ?? 0,
          parSprite: combien > 0 && temoin ? ((cpu(l) - cpu(temoin)) / combien) * 1000 : 0,
        };
        lignes.push(ligne);
        console.log(
          `  ${branche.padEnd(8)} ${disposition.padEnd(7)} ${String(combien).padStart(6)} : ` +
            `${ligne.fps.toFixed(1).padStart(5)} i/s   image ${ligne.image.toFixed(2).padStart(6)} ms   ` +
            `cpu ${ligne.cpu.toFixed(2).padStart(6)} ms   tri ${ligne.tri.toFixed(2).padStart(5)} ms   ` +
            `${combien > 0 ? ligne.parSprite.toFixed(3) + " µs/sprite" : "(temoin)"}`,
        );
        // La capture de controle : on ne mesure pas un dessin invisible.
        if (combien === 20000 && disposition === "ecran") {
          await page.screenshot({ path: join(BROUILLON, `${graine ?? "monde"}-${branche}-20000.png`) });
        }
      }
    }
  }
  await page.evaluate("window.__rendu.vider(); void 0;");
} finally {
  await navigateur.close();
  await serveur.close();
}

// Le navigateur ferme, on peut ecrire dans le projet sans rien recharger.
mkdirSync(DOSSIER, { recursive: true });
for (const f of readdirSync(BROUILLON)) if (f.endsWith(".png")) copyFileSync(join(BROUILLON, f), join(DOSSIER, f));

console.log("");
console.log(erreurs.length ? `erreurs : ${erreurs.join(" | ")}` : "aucune erreur de page");
console.log(`JSON ${JSON.stringify(lignes)}`);
