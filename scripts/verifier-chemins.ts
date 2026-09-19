import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { createServer } from "vite";
import { EGLISE, POSTES } from "../src/core/carte";

/**
 * Verifie les chemins qui s'usent dans le navigateur (DESIGN.md §4.24) : les
 * pas des habitants et des heros se comptent par case, un chemin se voit a 30
 * passages, palit a chaque aube sans passage et s'efface a la quatrieme.
 *
 *     npx tsx scripts/verifier-chemins.ts
 *
 * Trois captures partent dans `captures/jeu/<date>-chemins/` : les chemins
 * creuses, de loin et de pres, puis palis apres deux journees d'oubli.
 */

const PORT = 5197;
const dossier = resolve(process.argv[2] ?? `captures/jeu/${new Date().toISOString().slice(0, 10)}-chemins`);
mkdirSync(dossier, { recursive: true });

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

interface CaseFoulee {
  x: number;
  y: number;
  passages: number;
  dernierJour: number;
}

interface Arene {
  chemins: {
    passer(marcheur: object, x: number, y: number, jour: number): unknown;
    seLever(jour: number): unknown[];
    visibles: CaseFoulee[];
    sauver(): CaseFoulee[];
  };
  coucheChemins: { toutRedessiner(visibles: CaseFoulee[], jour: number): void };
  cycle: { jour: number };
  cameras: { main: { stopFollow(): void; setZoom(z: number): void; centerOn(x: number, y: number): void } };
  textures: { get(cle: string): { getContext(): CanvasRenderingContext2D } };
}

const serveur = await createServer({ server: { port: PORT, strictPort: true, open: false }, logLevel: "silent" });
await serveur.listen();
const navigateur = await chromium.launch();
const page = await navigateur.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
const erreurs: string[] = [];
page.on("console", (m) => {
  if (m.text().includes("GL Driver Message")) return;
  if (m.type() === "error" || m.type() === "warning") erreurs.push(`[console ${m.type()}] ${m.text()}`);
});
page.on("pageerror", (e) => erreurs.push(`[erreur] ${e.message}`));

const resultats: string[] = [];
const noter = (nom: string, ok: boolean, detail: unknown) => resultats.push(`${ok ? "OK " : "KO "} ${nom} — ${JSON.stringify(detail)}`);

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
  await page.screenshot({ path: `${dossier}/${nom}.png` });
  console.log(`[capture] ${dossier}/${nom}.png`);
};
/** Le nombre de pixels non transparents de la couche des chemins. */
const pixelsPeints = () =>
  page.evaluate(() => {
    const arene = (window as unknown as Fenetre).__jeu!.scene.getScene("arena") as Arene;
    const ctx = arene.textures.get("chemins").getContext();
    const data = ctx.getImageData(0, 0, 2000, 1500).data;
    let n = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i]! > 0) n += 1;
    return n;
  });

try {
  await page.goto(`http://localhost:${PORT}/`);
  await page.waitForFunction(() => (window as unknown as Fenetre).__jeu?.scene.isActive("titre") === true, null, { timeout: 30_000 });
  await page.evaluate(() => {
    const jeu = (window as unknown as Fenetre).__jeu!;
    jeu.scene.stop("titre");
    if (jeu.scene.isActive("menu")) jeu.scene.stop("menu");
    jeu.scene.start("arena", { classe: "guerrier", emplacement: 1, graineVillage: 7 });
  });
  await page.waitForFunction(
    () => {
      const jeu = (window as unknown as Fenetre).__jeu;
      return jeu?.scene.isActive("arena") === true && jeu.scene.isActive("ui") === true;
    },
    null,
    { timeout: 60_000 },
  );
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));

  // 1. Au depart, rien n'est peint ; au bout de quelques secondes de jeu, les
  //    habitants qui partent au travail ont deja laisse des pas comptes.
  const vide = await pixelsPeints();
  await page.waitForTimeout(6_000);
  const comptes = await page.evaluate(() => {
    const arene = (window as unknown as Fenetre).__jeu!.scene.getScene("arena") as Arene;
    const cases = (arene.chemins as unknown as { cases: Map<string, CaseFoulee> }).cases;
    return { cases: cases.size, visibles: arene.chemins.visibles.length };
  });
  noter("au depart la couche est vide et les pas se comptent", vide === 0 && comptes.cases > 3 && comptes.visibles === 0, { vide, comptes });

  // 2. On force ce que trois journees de travail donneraient : quarante
  //    allers-retours de l'eglise a chaque lieu de travail.
  const trajets = POSTES.map((p) => ({ de: { x: EGLISE.x, y: EGLISE.y }, a: p.position }));
  await page.evaluate(
    ({ trajets, creuse }) => {
      const arene = (window as unknown as Fenetre).__jeu!.scene.getScene("arena") as Arene;
      const jour = arene.cycle.jour;
      trajets.forEach((t, k) => {
        const n = k === creuse ? 140 : 34;
        for (let i = 0; i < n; i += 1) {
          const marcheur = {};
          const pas = Math.ceil(Math.hypot(t.a.x - t.de.x, t.a.y - t.de.y) / 6);
          for (let s = 0; s <= pas; s += 1) {
            const u = s / pas;
            // Une marche un peu flottante, comme une vraie : chacun tient sa ligne a quelques pixels pres.
            const flottement = ((i * 37) % 11) - 5;
            arene.chemins.passer(marcheur, t.de.x + (t.a.x - t.de.x) * u + flottement, t.de.y + (t.a.y - t.de.y) * u + ((i * 13) % 7) - 3, jour);
          }
        }
      });
      arene.coucheChemins.toutRedessiner(arene.chemins.visibles, jour);
    },
    { trajets, creuse: 1 },
  );
  await page.waitForTimeout(200);
  const apres = await page.evaluate(() => {
    const arene = (window as unknown as Fenetre).__jeu!.scene.getScene("arena") as Arene;
    return { visibles: arene.chemins.visibles.length, sauvees: arene.chemins.sauver().length };
  });
  const peints = await pixelsPeints();
  noter("des chemins visibles, peints, et dans la sauvegarde", apres.visibles > 20 && peints > 5_000 && apres.sauvees === apres.visibles, { apres, peints });
  await cadrer(520, 960, 1.3);
  await capturer("chemins-loin");
  await cadrer(560, 900, 2.6);
  await capturer("chemins-pres");

  // 3. Deux aubes sans passage : tout palit, rien ne s'efface encore.
  const palis = await page.evaluate(() => {
    const arene = (window as unknown as Fenetre).__jeu!.scene.getScene("arena") as Arene;
    const jour = arene.cycle.jour + 2;
    const changements = arene.chemins.seLever(jour);
    arene.coucheChemins.toutRedessiner(arene.chemins.visibles, jour);
    return { changements: changements.length, visibles: arene.chemins.visibles.length };
  });
  await page.waitForTimeout(200);
  const peintsPalis = await pixelsPeints();
  noter("deux journees d'oubli : tout palit, rien ne s'efface", palis.visibles === apres.visibles && peintsPalis <= peints, { palis, peintsPalis });
  await cadrer(520, 960, 1.3);
  await capturer("chemins-palis");

  // 4. La quatrieme aube efface tout.
  const effaces = await page.evaluate(() => {
    const arene = (window as unknown as Fenetre).__jeu!.scene.getScene("arena") as Arene;
    const jour = arene.cycle.jour + 4;
    const changements = arene.chemins.seLever(jour);
    arene.coucheChemins.toutRedessiner(arene.chemins.visibles, jour);
    return { effaces: changements.filter((c) => (c as { quoi: string }).quoi === "effacer").length, visibles: arene.chemins.visibles.length };
  });
  await page.waitForTimeout(200);
  const peintsEffaces = await pixelsPeints();
  noter("quatre journees d'oubli : tout s'efface", effaces.visibles === 0 && effaces.effaces === apres.visibles && peintsEffaces === 0, { effaces, peintsEffaces });
} finally {
  await navigateur.close();
  await serveur.close();
}

console.log(resultats.join("\n"));
if (erreurs.length > 0) console.log(`\n${erreurs.length} erreur(s) console :\n${erreurs.slice(0, 10).join("\n")}`);
else console.log("\nAucune erreur console.");
if (resultats.some((r) => r.startsWith("KO"))) process.exitCode = 1;
