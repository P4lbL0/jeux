import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { createServer } from "vite";
import { PRATICABLE, terrainEn } from "../src/core/carte";

/**
 * Verifie l'eau qui noie dans le navigateur (DESIGN.md §4.30) : le heros
 * incarne s'enfonce sur le haut-fond et ralentit, la bulle previent en mer, la
 * seconde insiste, et au bout de trois secondes il se noie ; ressortir avant
 * le sauve ; l'abysse le rejette.
 *
 *     npx tsx scripts/verifier-eau.ts
 *
 * Une capture du heros dans l'eau part dans `captures/jeu/<date>-eau/`.
 */

const PORT = 5196;
const dossier = resolve(`captures/jeu/${new Date().toISOString().slice(0, 10)}-eau`);
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

interface Arene {
  hero: {
    x: number;
    y: number;
    etat: string;
    facteurEau: number;
    isCropped: boolean;
    personne: { nom: string };
    setPosition(x: number, y: number): void;
    setVelocity(x: number, y: number): void;
  };
  events: { on(nom: string, f: (m: string) => void): void };
  cameras: { main: { stopFollow(): void; setZoom(z: number): void; centerOn(x: number, y: number): void } };
}

// Le rivage a la hauteur du village : le premier x de haut-fond, de mer et
// d'abysse en partant de la plage vers le large.
const y = 1000;
const premierX = (terrain: string) => {
  for (let x = PRATICABLE.x + 20; x > 0; x -= 2) if (terrainEn(x, y) === terrain) return x;
  throw new Error(`pas de ${terrain} a y=${y}`);
};
const hautFond = premierX("haut-fond") - 12;
const mer = premierX("mer") - 12;
const abysse = premierX("abysse") - 12;

const serveur = await createServer({ server: { port: PORT, strictPort: true, open: false }, logLevel: "silent" });
await serveur.listen();
const navigateur = await chromium.launch();
const page = await navigateur.newPage({ viewport: { width: 1280, height: 800 } });
const erreurs: string[] = [];
page.on("console", (m) => {
  if (m.text().includes("GL Driver Message")) return;
  if (m.type() === "error" || m.type() === "warning") erreurs.push(`[console ${m.type()}] ${m.text()}`);
});
page.on("pageerror", (e) => erreurs.push(`[erreur] ${e.message}`));

const resultats: string[] = [];
const noter = (nom: string, ok: boolean, detail: unknown) => resultats.push(`${ok ? "OK " : "KO "} ${nom} — ${JSON.stringify(detail)}`);
const etat = () =>
  page.evaluate(() => {
    const arene = (window as unknown as Fenetre).__jeu!.scene.getScene("arena") as Arene;
    const h = arene.hero;
    return { x: Math.round(h.x), y: Math.round(h.y), etat: h.etat, facteur: h.facteurEau, rogne: h.isCropped, nom: h.personne.nom };
  });
const placer = (x: number) =>
  page.evaluate(
    ([px, py]) => {
      const arene = (window as unknown as Fenetre).__jeu!.scene.getScene("arena") as Arene;
      arene.hero.setVelocity(0, 0);
      arene.hero.setPosition(px, py);
      arene.cameras.main.stopFollow();
      arene.cameras.main.setZoom(3);
      arene.cameras.main.centerOn(px, py);
    },
    [x, y] as const,
  );

try {
  await page.goto(`http://localhost:${PORT}/`);
  await page.waitForFunction(() => (window as unknown as Fenetre).__jeu?.scene.isActive("titre") === true, null, { timeout: 30_000 });
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
    { timeout: 60_000 },
  );
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await page.waitForTimeout(1200);
  await page.evaluate(() => {
    const arene = (window as unknown as Fenetre).__jeu!.scene.getScene("arena") as Arene;
    (window as unknown as { __annonces: string[] }).__annonces = [];
    arene.events.on("annonce", (m) => (window as unknown as { __annonces: string[] }).__annonces.push(m));
  });
  const annonces = () => page.evaluate(() => (window as unknown as { __annonces: string[] }).__annonces);

  // 1. Au sec : rien.
  let e = await etat();
  noter("au sec : pleine vitesse, image entiere", e.facteur === 1 && !e.rogne && e.etat !== "mort", e);

  // 2. Le haut-fond : on ralentit, on s'enfonce, on ne se noie jamais.
  await placer(hautFond);
  await page.waitForTimeout(3_600);
  e = await etat();
  noter("haut-fond : 60 % de vitesse, image rognee, pas de noyade en 3,6 s", e.facteur === 0.6 && e.rogne && e.etat !== "mort", e);
  await page.screenshot({ path: `${dossier}/haut-fond.png` });

  // 3. La mer : la bulle previent tout de suite, insiste a 2 s ; ressortir sauve.
  await placer(mer);
  await page.waitForTimeout(300);
  e = await etat();
  const a1 = await annonces();
  noter("mer : 35 % de vitesse, la bulle previent", e.facteur === 0.35 && e.rogne && a1.some((m) => m.includes("coule")), { e, a1 });
  await page.screenshot({ path: `${dossier}/mer.png` });
  await page.waitForTimeout(2_200);
  await placer(hautFond);
  await page.waitForTimeout(1_500);
  e = await etat();
  noter("ressorti a 2,5 s : vivant, l'horloge est repartie", e.etat !== "mort" && e.facteur === 0.6, e);

  // 4. L'abysse rejette.
  await placer(abysse);
  await page.waitForTimeout(400);
  e = await etat();
  noter("abysse : rejete vers la derniere position tenable", e.x > abysse + 4 && e.etat !== "mort", { e, abysse });

  // 5. La mer, trois secondes : on se noie.
  const nom = e.nom;
  await placer(mer);
  await page.waitForTimeout(3_600);
  e = await etat();
  const a2 = await annonces();
  noter(
    "mer, 3,6 s : le heros s'est noye, le journal le dit, le suivant est incarne",
    a2.some((m) => m.includes("noye")) && e.nom !== nom && e.etat !== "mort" && e.facteur === 1,
    { e, nom, a2: a2.filter((m) => m.includes("noy") || m.includes("coule") || m.includes("tombe")) },
  );
} finally {
  await navigateur.close();
  await serveur.close();
}

console.log(resultats.join("\n"));
console.log(erreurs.length ? `\n${erreurs.length} message(s) console :\n${erreurs.join("\n")}` : "\naucune erreur console");
console.log(`captures : ${dossier}`);
process.exit(resultats.some((r) => r.startsWith("KO")) || erreurs.length ? 1 : 0);
