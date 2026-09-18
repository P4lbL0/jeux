import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { createServer } from "vite";

/**
 * Les captures de l'ecran-titre, prises par Playwright (DESIGN.md §4.10).
 *
 *     npx tsx scripts/capturer-titre.ts apres
 *
 * Quatre images dans `captures/jeu/<date du jour>-titre/<prefixe>-titre-*.png` : le
 * film au depart, la meteorite, le menu sur le fond flou, puis les
 * emplacements par-dessus. C'est la seule facon de juger la transition du net
 * au flou et la lisibilite du menu dessus : une compilation qui passe ne dit
 * rien d'une image.
 *
 * ⚠️ Le navigateur sans tete decode la video comme un vrai : les instants sont
 * donc mesures depuis l'arrivee de la premiere image, pas depuis le chargement
 * de la page.
 */

const prefixe = process.argv[2] ?? "capture";
const dossier = resolve(process.argv[3] ?? `captures/jeu/${new Date().toISOString().slice(0, 10)}-titre`);
mkdirSync(dossier, { recursive: true });

const PORT = 5198;

interface Fenetre {
  __jeu?: {
    scene: {
      isActive(cle: string): boolean;
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
  if (m.type() === "error" || m.type() === "warning") console.log(`[console] ${m.text()}`);
});
page.on("pageerror", (e) => console.log(`[erreur] ${e.message}`));

const capturer = async (nom: string) => {
  const chemin = `${dossier}/${prefixe}-titre-${nom}.png`;
  await page.screenshot({ path: chemin });
  console.log(`[capture] ${chemin}`);
};

try {
  await page.goto(`http://localhost:${PORT}/`);
  await page.waitForFunction(
    () => (window as unknown as Fenetre).__jeu?.scene.isActive("titre") === true,
    null,
    { timeout: 30_000 },
  );
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));

  // La premiere image du film : la scene leve son noir a ce moment-la.
  await page.waitForFunction(
    () => {
      const jeu = (window as unknown as Fenetre).__jeu;
      const titre = jeu?.scene.getScene("titre") as { approche?: { frameReady?: boolean } } | undefined;
      return titre?.approche?.frameReady === true;
    },
    null,
    { timeout: 20_000 },
  );
  const depart = Date.now();
  const attendreJusqua = async (ms: number) => {
    const reste = depart + ms - Date.now();
    if (reste > 0) await page.waitForTimeout(reste);
  };

  await attendreJusqua(1500);
  await capturer("depart");

  // La meteorite traverse le ciel entre 1,2 et 3,4 s.
  await attendreJusqua(2400);
  await capturer("meteorite");

  // L'approche dure 6 s ; le trouble et le menu prennent 1,5 s de plus.
  await attendreJusqua(8200);
  await capturer("menu");

  await page.keyboard.press("Enter");
  await page.waitForFunction(
    () => (window as unknown as Fenetre).__jeu?.scene.isActive("menu") === true,
    null,
    { timeout: 10_000 },
  );
  await page.waitForTimeout(600);
  await capturer("emplacements");
} finally {
  await navigateur.close();
  await serveur.close();
}
