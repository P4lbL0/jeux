import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { createServer } from "vite";

/**
 * Plusieurs mondes, un par graine, pour juger le generateur sur image
 * (DESIGN.md §4.29, 20 septembre 2026).
 *
 *     npx tsx scripts/capturer-mondes.ts                 # six graines
 *     npx tsx scripts/capturer-mondes.ts 1,2,3           # celles-la
 *     npx tsx scripts/capturer-mondes.ts 1,2 captures/jeu/2026-09-20-mondes
 *
 * Deux vues par graine, dans `captures/jeu/<date>-mondes/graine-<n>-{monde,village}.png` :
 * le monde entier (la mer, le relief, les lacs, ou tombe le village), et le
 * village de pres. La graine 0 est le monde classique. La page est rechargee
 * entre deux graines : la scene ne se relance pas proprement deux fois.
 */

const graines = (process.argv[2] ?? "0,1,2,3,6,11").split(",").map(Number);
const dossier = resolve(process.argv[3] ?? `captures/jeu/${new Date().toISOString().slice(0, 10)}-mondes`);
mkdirSync(dossier, { recursive: true });

const PORT = 5199;

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

interface Arene {
  cameras: { main: { stopFollow(): void; setZoom(z: number): void; centerOn(x: number, y: number): void } };
  hero: { x: number; y: number };
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
const erreurs: string[] = [];
page.on("console", (m) => {
  if (m.text().includes("GL Driver Message")) return;
  if (m.type() === "error") erreurs.push(`[console] ${m.text()}`);
  if (m.text().startsWith("[arene]")) console.log(m.text());
});
page.on("pageerror", (e) => erreurs.push(`[erreur] ${e.message}`));

const cadrer = (x: number, y: number, zoom: number) =>
  page.evaluate(
    ([cx, cy, z]) => {
      const arene = (window as unknown as Fenetre).__jeu!.scene.getScene("arena") as Arene;
      arene.cameras.main.stopFollow();
      arene.cameras.main.setZoom(z);
      arene.cameras.main.centerOn(cx, cy);
    },
    [x, y, zoom] as const,
  );

const capturer = async (nom: string) => {
  await page.waitForTimeout(450);
  const chemin = `${dossier}/${nom}.png`;
  await page.screenshot({ path: chemin });
  console.log(`[capture] ${chemin}`);
};

try {
  for (const graine of graines) {
    await page.goto(`http://localhost:${PORT}/`);
    await page.waitForFunction(
      () => (window as unknown as Fenetre).__jeu?.scene.isActive("titre") === true,
      null,
      { timeout: 30_000 },
    );
    await page.evaluate((g) => {
      const jeu = (window as unknown as Fenetre).__jeu!;
      jeu.scene.stop("titre");
      if (jeu.scene.isActive("menu")) jeu.scene.stop("menu");
      // Un village different par monde, pour voir aussi le generateur de village.
      jeu.scene.start("arena", { classe: "guerrier", emplacement: 1, graineMonde: g, graineVillage: 7 + g, sansLaMarche: true });
    }, graine);
    await page.waitForFunction(
      () => {
        const jeu = (window as unknown as Fenetre).__jeu;
        return jeu?.scene.isActive("arena") === true && jeu.scene.isActive("ui") === true;
      },
      null,
      { timeout: 60_000 },
    );
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await page.waitForTimeout(1800);

    // Le monde entier : 2000 x 1500 dans 1280 x 800, au zoom 0,53.
    await cadrer(1000, 750, 0.53);
    await capturer(`graine-${graine}-monde`);

    // Le village de pres, la ou le heros est tombe.
    const hero = await page.evaluate(() => {
      const arene = (window as unknown as Fenetre).__jeu!.scene.getScene("arena") as Arene;
      return { x: arene.hero.x, y: arene.hero.y };
    });
    await cadrer(hero.x, hero.y - 60, 1.3);
    await capturer(`graine-${graine}-village`);

    // Un angle de l'enceinte de pres : les tours, les douves, les ponts-levis.
    const coin = await page.evaluate(() => {
      const arene = (window as unknown as Fenetre).__jeu!.scene.getScene("arena") as Arene & {
        planVillage: { enceinte: { colonne: number; ligne: number; piece: string }[] };
      };
      const portes = arene.planVillage.enceinte.filter((m) => m.piece === "porte");
      const cible = portes[0] ?? arene.planVillage.enceinte[0];
      return cible ? { x: cible.colonne * 32 + 16, y: cible.ligne * 32 + 16 } : null;
    });
    if (coin) {
      await cadrer(coin.x, coin.y, 2.8);
      await capturer(`graine-${graine}-porte`);
    }
  }
} finally {
  await navigateur.close();
  await serveur.close();
  if (erreurs.length > 0) {
    console.log("\nErreurs du navigateur :");
    for (const e of erreurs) console.log("  " + e);
  }
}
