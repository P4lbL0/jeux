import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { chromium, type Browser } from "playwright";
import { build, preview } from "vite";

/**
 * Le robot joue des parties entières (jalon 6.4, étape 3) et rend des chiffres.
 *
 *     npx tsx scripts/robot.ts [--classes guerrier,mage] [--cartes regle,hasard]
 *                              [--parties 1] [--paralleles 4] [--nuit-max 10]
 *                              [--budget 12] [--minutes 45] [--sortie .tmp/robot/x]
 *
 * Chaque classe joue une partie par façon de choisir ses cartes (`regle`, `hasard`), **sur
 * les mêmes mondes et les mêmes villages** (graines 1000 + k et 2000 + k) : l'écart entre
 * les deux séries ne doit rien au tirage du monde. Le robot lui-même est dans
 * `src/game/robot.ts` ; ce script construit le jeu à part (`.tmp/robot-dist`, pour qu'une
 * modification de `src/` pendant les parties ne recharge rien), lance les parties en
 * parallèle, chacune dans son propre contexte de navigateur, et écrit un rapport par
 * partie plus un résumé.
 *
 * Une partie s'arrête à la fin (toute l'équipe tombée, ou plus un habitant), à l'aube qui
 * suit la nuit `--nuit-max`, ou au bout de `--minutes` minutes réelles. Une partie dont le
 * temps de jeu n'avance plus pendant deux minutes est marquée « bloquée », avec sa capture.
 */

const options = new Map<string, string>();
for (let i = 2; i < process.argv.length; i++) {
  const cle = process.argv[i]!;
  if (cle.startsWith("--")) options.set(cle.slice(2), process.argv[++i] ?? "");
}
const CLASSES = (options.get("classes") ?? "guerrier,chevalier,mage,assassin,rodeur,oracle,necromancien").split(",");
const CARTES = (options.get("cartes") ?? "regle,hasard").split(",");
const PARTIES = Number(options.get("parties") ?? 1);
const PARALLELES = Number(options.get("paralleles") ?? 4);
const NUIT_MAX = Number(options.get("nuit-max") ?? 10);
const BUDGET = Number(options.get("budget") ?? 12);
const MINUTES = Number(options.get("minutes") ?? 45);
const horodatage = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
const SORTIE = resolve(options.get("sortie") ?? `.tmp/robot/${horodatage}`);
const PORT = 5251;
mkdirSync(SORTIE, { recursive: true });

interface Releve {
  t: number;
  jour: number;
  nuit: number;
  phase: string;
  niveau: number;
  herosDebout: number;
  habitants: number;
  argent: number;
  tues: number;
  monstres: number;
}
interface Rapport {
  fini: boolean;
  raison: string | null;
  dernier: Releve | null;
  releves: Releve[];
  chutes: { nuit: number; phase: string; nom: string; classe: string; cause: string }[];
  cartesPrises: { nom: string }[];
}
interface Partie {
  classe: string;
  cartes: string;
  k: number;
}
interface Bilan extends Partie {
  issue: "fin" | "nuit-max" | "temps" | "bloquee" | "erreur";
  minutesReelles: number;
  rapport: Rapport | null;
  erreurs: string[];
}

const parties: Partie[] = [];
for (let k = 0; k < PARTIES; k++) for (const classe of CLASSES) for (const cartes of CARTES) parties.push({ classe, cartes, k });

console.log(`${parties.length} partie(s), ${PARALLELES} à la fois, nuit max ${NUIT_MAX}, budget ${BUDGET} ms — ${SORTIE}`);
await build({ logLevel: "warn", build: { outDir: ".tmp/robot-dist", emptyOutDir: true } });
const serveur = await preview({ logLevel: "silent", build: { outDir: ".tmp/robot-dist" }, preview: { port: PORT, strictPort: true, open: false } });

async function jouer(navigateur: Browser, p: Partie): Promise<Bilan> {
  const nom = `${p.classe}-${p.cartes}-${p.k}`;
  const contexte = await navigateur.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const page = await contexte.newPage();
  const erreurs: string[] = [];
  page.on("pageerror", (e) => erreurs.push(e.message));
  const depart = Date.now();
  let issue: Bilan["issue"] = "temps";
  let rapport: Rapport | null = null;
  try {
    await page.goto(`http://localhost:${PORT}/`);
    await page.waitForFunction(`window.__jeu?.scene.isActive("titre") === true`, null, { timeout: 120_000 });
    await page.evaluate(`
      const jeu = window.__jeu;
      jeu.scene.stop("titre");
      if (jeu.scene.isActive("menu")) jeu.scene.stop("menu");
      jeu.scene.start("arena", {
        classe: "${p.classe}", emplacement: 1, sansLaMarche: true,
        graineMonde: ${1000 + p.k}, graineVillage: ${2000 + p.k},
        robot: { cartes: "${p.cartes}", budget: ${BUDGET} },
      });
      void 0;
    `);
    await page.waitForFunction(`!!window.__robot`, null, { timeout: 120_000 });
    await page.evaluate(`window.dispatchEvent(new Event("focus")); void 0;`);

    let dernierT = -1;
    let immobileDepuis = Date.now();
    let nuitAnnoncee = 0;
    for (;;) {
      await page.waitForTimeout(5000);
      rapport = (await page.evaluate(`window.__robot`)) as Rapport;
      const d = rapport.dernier;
      if (rapport.fini) {
        issue = "fin";
        break;
      }
      if (d && d.nuit > nuitAnnoncee) {
        nuitAnnoncee = d.nuit;
        const minutes = ((Date.now() - depart) / 60000).toFixed(1);
        console.log(`  ${nom.padEnd(24)} jour ${d.jour} · niveau ${d.niveau} · héros ${d.herosDebout} · habitants ${d.habitants} · ${minutes} min réelles`);
      }
      if (d && (d.jour > NUIT_MAX || (d.jour === NUIT_MAX + 1 && d.phase === "jour"))) {
        issue = "nuit-max";
        break;
      }
      if (d && d.t !== dernierT) {
        dernierT = d.t;
        immobileDepuis = Date.now();
      } else if (Date.now() - immobileDepuis > 120_000) {
        issue = "bloquee";
        break;
      }
      if (Date.now() - depart > MINUTES * 60_000) {
        issue = "temps";
        break;
      }
    }
  } catch (e) {
    issue = "erreur";
    erreurs.push(String(e));
  }
  try {
    await page.screenshot({ path: join(SORTIE, `${nom}.png`) });
  } catch {
    // Une page morte n'a pas de capture.
  }
  const bilan: Bilan = { ...p, issue, minutesReelles: +((Date.now() - depart) / 60000).toFixed(1), rapport, erreurs };
  writeFileSync(join(SORTIE, `${nom}.json`), JSON.stringify(bilan, null, 1));
  await contexte.close();
  const d = rapport?.dernier;
  console.log(`FINI ${nom.padEnd(24)} ${issue.padEnd(9)} nuit ${d?.nuit ?? "?"} (${d?.phase ?? "?"}) · niveau ${d?.niveau ?? "?"} · ${bilan.minutesReelles} min · ${erreurs.length} erreur(s)`);
  return bilan;
}

const navigateur = await chromium.launch({
  args: [
    "--use-angle=d3d11",
    "--enable-gpu",
    "--disable-gpu-sandbox",
    "--mute-audio",
    "--disable-background-timer-throttling",
    "--disable-backgrounding-occluded-windows",
    "--disable-renderer-backgrounding",
  ],
});
const bilans: Bilan[] = [];
try {
  const file = [...parties];
  await Promise.all(
    Array.from({ length: Math.min(PARALLELES, file.length) }, async () => {
      for (let p = file.shift(); p; p = file.shift()) bilans.push(await jouer(navigateur, p));
    }),
  );
} finally {
  await navigateur.close();
  await new Promise<void>((r) => serveur.httpServer.close(() => r()));
}

// Le résumé : une ligne par partie, puis la moyenne de la nuit atteinte par façon de choisir.
const lignes = ["| Classe | Cartes | Issue | Nuit | Niveau | Héros tombés | Ce qui a tué | Minutes |", "|---|---|---|---|---|---|---|---|"];
for (const b of bilans.sort((a, c) => a.classe.localeCompare(c.classe) || a.cartes.localeCompare(c.cartes) || a.k - c.k)) {
  const d = b.rapport?.dernier;
  const causes = (b.rapport?.chutes ?? []).map((c) => `${c.cause} (nuit ${c.nuit})`).join(" ; ") || "—";
  lignes.push(`| ${b.classe} | ${b.cartes} | ${b.issue} | ${d?.nuit ?? "?"} ${d?.phase ?? ""} | ${d?.niveau ?? "?"} | ${b.rapport?.chutes.length ?? "?"} | ${causes} | ${b.minutesReelles} |`);
}
for (const cartes of CARTES) {
  const nuits = bilans.filter((b) => b.cartes === cartes && b.rapport?.dernier).map((b) => b.rapport!.dernier!.nuit);
  if (nuits.length) lignes.push(`\n**${cartes}** : nuit moyenne ${(nuits.reduce((s, n) => s + n, 0) / nuits.length).toFixed(1)} (${nuits.length} parties)`);
}
writeFileSync(join(SORTIE, "resume.md"), lignes.join("\n") + "\n");
console.log("\n" + lignes.join("\n"));
