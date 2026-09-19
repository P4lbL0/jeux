import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { createServer } from "vite";

/**
 * Les details de vie sur image (§4.24) : le village entier, la plage — le poste
 * de peche au nord, le port au sud, les filets qui sechent entre les deux — et
 * les maisons de pres, avec leur linge, leurs tonneaux et leur bois.
 *
 *     npx tsx scripts/capturer-details.ts                 # trois graines
 *     npx tsx scripts/capturer-details.ts 1,7,42          # celles-la
 *     npx tsx scripts/capturer-details.ts 1 captures/jeu/2026-09-20-details-de-vie
 *
 * ⚠️ La date par defaut du dossier est en UTC : apres minuit, passer le dossier.
 * La page est rechargee entre deux graines, comme `capturer-villages.ts`.
 */

const graines = (process.argv[2] ?? "1,7,42").split(",").map(Number);
const dossier = resolve(process.argv[3] ?? `captures/jeu/${new Date().toISOString().slice(0, 10)}-details-de-vie`);
mkdirSync(dossier, { recursive: true });

const PORT = 5198;

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
      jeu.scene.start("arena", { classe: "guerrier", emplacement: 1, graineVillage: g });
    }, graine);
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

    // Le village entier.
    await cadrer(500, 990, 1.3);
    await capturer(`graine-${graine}-loin`);

    // La plage : le poste de peche au nord, le port au sud, les filets entre les deux.
    await cadrer(340, 920, 1.8);
    await capturer(`graine-${graine}-plage`);

    // Les maisons de pres, autour de l'eglise : le linge, les tonneaux, le bois.
    await cadrer(470, 1040, 2.4);
    await capturer(`graine-${graine}-maisons`);
  }
} finally {
  await navigateur.close();
  await serveur.close();
}
