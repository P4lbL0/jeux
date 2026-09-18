import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { createServer } from "vite";

/**
 * Les captures du jeu, prises par Playwright, toujours au meme endroit.
 *
 *     npx tsx scripts/capturer.ts avant
 *     npx tsx scripts/capturer.ts apres
 *
 * Elles tombent dans `captures/jeu/<date du jour>/<prefixe>-<scene>.png` : village, mer, mode
 * d'amenagement, fiche de personnage. Meme cadrage, meme zoom, meme moment de la
 * journee (le premier matin) — c'est ce qui rend une comparaison honnete.
 *
 * ⚠️ En headless, la fenetre n'a jamais le focus : Phaser emet `BLUR` et
 * l'arene se met en pause. On reveille le jeu avec un evenement `focus`.
 */

const prefixe = process.argv[2] ?? "capture";
// Un dossier de sortie facultatif : les essais intermediaires n'ont rien a
// faire dans `captures/`, qui ne garde que l'avant et l'apres. Par defaut, un
// dossier par jour (voir `captures/README.md`).
const dossier = resolve(process.argv[3] ?? `captures/jeu/${new Date().toISOString().slice(0, 10)}`);
mkdirSync(dossier, { recursive: true });

const PORT = 5199;

/** Ce que le navigateur voit de `window`. */
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

const navigateur = await chromium.launch();
const page = await navigateur.newPage({
  viewport: { width: 1280, height: 800 },
  deviceScaleFactor: 1,
});
page.on("console", (m) => {
  if (m.type() === "error") console.log(`[console] ${m.text()}`);
});
page.on("pageerror", (e) => console.log(`[erreur] ${e.message}`));

try {
  await page.goto(`http://localhost:${PORT}/`);
  await page.waitForFunction(
    () => (window as unknown as Fenetre).__jeu?.scene.isActive("titre") === true,
    null,
    { timeout: 30_000 },
  );

  // On saute le film et les menus : la scene se lance avec la classe de depart.
  await page.evaluate(() => {
    const jeu = (window as unknown as Fenetre).__jeu!;
    jeu.scene.stop("titre");
    if (jeu.scene.isActive("menu")) jeu.scene.stop("menu");
    jeu.scene.start("arena", { classe: "guerrier", emplacement: 1 });
  });
  await page.waitForFunction(
    () => {
      const jeu = (window as unknown as Fenetre).__jeu;
      return jeu?.scene.isActive("arena") === true && jeu.scene.isActive("ui") === true;
    },
    null,
    { timeout: 30_000 },
  );
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await page.waitForTimeout(1800);

  const cadrer = (x: number, y: number, zoom: number) =>
    page.evaluate(
      ([cx, cy, z]) => {
        const jeu = (window as unknown as Fenetre).__jeu!;
        const arene = jeu.scene.getScene("arena") as {
          cameras: { main: { stopFollow(): void; setZoom(z: number): void; centerOn(x: number, y: number): void } };
        };
        arene.cameras.main.stopFollow();
        arene.cameras.main.setZoom(z);
        arene.cameras.main.centerOn(cx, cy);
      },
      [x, y, zoom] as const,
    );

  const capturer = async (nom: string) => {
    await page.waitForTimeout(450);
    const chemin = `${dossier}/${prefixe}-${nom}.png`;
    await page.screenshot({ path: chemin });
    console.log(`[capture] ${chemin}`);
  };

  // Le village, au premier matin.
  await cadrer(470, 1050, 1.7);
  await capturer("village");

  // Le village de plus loin : la silhouette de l'eglise et l'enceinte.
  await cadrer(520, 1040, 1.0);
  await capturer("village-loin");

  // Le rivage, le port et la plage.
  await cadrer(330, 1000, 2.0);
  await capturer("mer");

  // La foret et la montagne, au sud-est.
  await cadrer(1000, 1220, 1.7);
  await capturer("foret");

  // L'angle nord-est de l'enceinte, de pres : les murs, la tour, la porte de
  // l'est. C'est la vue qui juge les raccords (§4.30).
  await cadrer(600, 960, 2.6);
  await capturer("enceinte");

  // La place, au zoom maximal : les gens a cote des maisons.
  await cadrer(470, 1060, 3.4);
  await capturer("gens");

  // Le mode d'amenagement : la grille et l'apercu de pose.
  await cadrer(470, 1050, 1.7);
  await page.keyboard.press("KeyM");
  await page.waitForTimeout(200);
  await page.keyboard.press("KeyG");
  await page.mouse.move(700, 380);
  await capturer("amenagement");
  await page.keyboard.press("KeyM");

  // La fiche du heros incarne.
  await page.evaluate(() => {
    const jeu = (window as unknown as Fenetre).__jeu!;
    const ui = jeu.scene.getScene("ui") as { ouvrirFiche(index: number): void };
    ui.ouvrirFiche(0);
  });
  await capturer("fiche");
} finally {
  await navigateur.close();
  await serveur.close();
}
