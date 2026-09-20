import { chromium } from "playwright";
import { createServer } from "vite";

/**
 * Verifie la musique de la partie sans oreille (DESIGN.md §4.10) : ce qui joue,
 * quand, et sans erreur console.
 *
 *     npx tsx scripts/verifier-musique.ts
 *
 * Meme parcours que `scripts/capturer.ts` (l'arene lancee directement), avec le
 * son deverrouille par un clic et l'autoplay permis. On ne peut pas ecouter :
 * on lit l'etat de `game/musique.ts` — le morceau en cours, et si une voix joue
 * vraiment — apres un coup, pendant le maintien, la nuit tombee, et a une aube
 * qui arrive au milieu d'une montee. Ce qui s'entend se juge sur les fichiers de
 * `captures/son/<date>-musiques/partie-*.mp3`.
 */

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

interface Arene {
  cycle: { phase: string; avancer(delta: number): string | null };
  musique: { etat: { morceau: string | null; joue: boolean }; combat(): void };
  sound: { locked: boolean; context: { state: string } };
}

const serveur = await createServer({
  server: { port: PORT, strictPort: true, open: false },
  logLevel: "silent",
});
await serveur.listen();

const navigateur = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
const page = await navigateur.newPage({ viewport: { width: 1280, height: 800 } });
const erreurs: string[] = [];
page.on("console", (m) => {
  // Les avertissements du pilote graphique en headless (« GPU stall due to
  // ReadPixels ») n'ont rien a voir avec le son.
  if (m.text().includes("GL Driver Message")) return;
  if (m.type() === "error" || m.type() === "warning") erreurs.push(`[console ${m.type()}] ${m.text()}`);
});
page.on("pageerror", (e) => erreurs.push(`[erreur] ${e.message}`));

const etat = () =>
  page.evaluate(() => {
    const jeu = (window as unknown as Fenetre).__jeu!;
    const arene = jeu.scene.getScene("arena") as Arene;
    return {
      phase: arene.cycle.phase,
      ...arene.musique.etat,
      verrouille: arene.sound.locked,
      contexte: arene.sound.context.state,
    };
  });

const attendre = (ms: number) => page.waitForTimeout(ms);
const resultats: string[] = [];
const noter = (nom: string, ok: boolean, detail: string) => {
  resultats.push(`${ok ? "OK " : "KO "} ${nom} — ${detail}`);
};

try {
  await page.goto(`http://localhost:${PORT}/`);
  await page.waitForFunction(
    () => (window as unknown as Fenetre).__jeu?.scene.isActive("titre") === true,
    null,
    { timeout: 30_000 },
  );
  // Un vrai clic : c'est lui qui deverrouille le son chez Phaser.
  await page.mouse.click(640, 400);
  await attendre(300);

  await page.evaluate(() => {
    const jeu = (window as unknown as Fenetre).__jeu!;
    jeu.scene.stop("titre");
    if (jeu.scene.isActive("menu")) jeu.scene.stop("menu");
    jeu.scene.start("arena", { classe: "guerrier", emplacement: 1, sansLaMarche: true });
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
  await attendre(1500);

  // 1. Le premier matin : le calme joue.
  let e = await etat();
  noter("premier matin = calme, une voix joue", e.phase === "jour" && e.morceau === "calme" && e.joue, JSON.stringify(e));

  // 2. Un coup : la guerre arrive (au corps du morceau), puis tient 15 s.
  await page.evaluate(() => ((window as unknown as Fenetre).__jeu!.scene.getScene("arena") as Arene).musique.combat());
  await attendre(400);
  e = await etat();
  noter("un coup le jour = guerre", e.morceau === "guerre" && e.joue, JSON.stringify(e));
  await attendre(10_000);
  e = await etat();
  noter("10 s apres le coup, la guerre tient", e.morceau === "guerre", JSON.stringify(e));
  await attendre(6_000);
  e = await etat();
  noter("16 s apres le coup, le calme revient", e.morceau === "calme" && e.joue, JSON.stringify(e));

  // 3. La nuit tombe : la guerre, meme sans un coup.
  await page.evaluate(() => ((window as unknown as Fenetre).__jeu!.scene.getScene("arena") as Arene).cycle.avancer(10 * 60 * 1000));
  await attendre(400);
  e = await etat();
  noter("la nuit = guerre", e.phase === "nuit" && e.morceau === "guerre" && e.joue, JSON.stringify(e));

  // 4. L'aube tout de suite, au milieu de la montee de la guerre : le calme
  //    revient sans erreur (l'arret au milieu d'un fondu).
  await attendre(800);
  await page.evaluate(() => ((window as unknown as Fenetre).__jeu!.scene.getScene("arena") as Arene).cycle.avancer(5 * 60 * 1000));
  await attendre(400);
  e = await etat();
  noter("l'aube au milieu d'une montee = calme", e.phase === "jour" && e.morceau === "calme" && e.joue, JSON.stringify(e));

  // 5. Le son n'etait pas verrouille, le contexte tourne.
  noter("son deverrouille, contexte audio en marche", !e.verrouille && e.contexte === "running", JSON.stringify(e));
} finally {
  await navigateur.close();
  await serveur.close();
}

console.log(resultats.join("\n"));
console.log(erreurs.length ? `\n${erreurs.length} message(s) console :\n${erreurs.join("\n")}` : "\naucune erreur console");
process.exit(resultats.some((r) => r.startsWith("KO")) || erreurs.length ? 1 : 0);
