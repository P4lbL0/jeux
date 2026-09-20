import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { createServer } from "vite";
import { COMPETENCES } from "../src/core/competences";

/**
 * Verifie dans le navigateur ce que le depouillage du 9 septembre 2026 a
 * tranche et que le code applique depuis le 19 septembre : les deux cases
 * (§4.24), les paliers de mur et de porte (§4.20), le village qui attire les
 * monstres au-dela de 65 habitants (§4.18) et les quatre actives (§4.13).
 *
 *     npx tsx scripts/verifier-depouillage.ts
 *
 * Meme parcours que `scripts/capturer.ts` : l'arene lancee directement. Deux
 * captures partent dans `captures/jeu/<date>-restes-depouillage/` : un segment
 * passe au fer a cote de ses voisins de bois, et l'ecran « plus de place ».
 */

const PORT = 5197;
const dossier = resolve(`captures/jeu/${new Date().toISOString().slice(0, 10)}-restes-depouillage`);
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
  __annonces?: string[];
}

// Cinq actives que le guerrier peut apprendre sans ouvrir d'evolution au
// premier palier : l'ecran « plus de place » est le seul qu'on veut voir.
const actives = COMPETENCES.filter(
  (c) => c.type === "active" && (!c.classes || c.classes.includes("guerrier")) && c.evolutions?.auPalier !== 1,
)
  .slice(0, 5)
  .map((c) => c.id);
if (actives.length < 5) throw new Error("pas assez d'actives pour le guerrier");

const serveur = await createServer({
  server: { port: PORT, strictPort: true, open: false },
  logLevel: "silent",
});
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
const noter = (nom: string, ok: boolean, detail: unknown) => {
  resultats.push(`${ok ? "OK " : "KO "} ${nom} — ${JSON.stringify(detail)}`);
};

try {
  await page.goto(`http://localhost:${PORT}/`);
  await page.waitForFunction(
    () => (window as unknown as Fenetre).__jeu?.scene.isActive("titre") === true,
    null,
    { timeout: 30_000 },
  );
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
  await page.waitForTimeout(1500);

  // 1. Les deux cases : trois cases apres un batiment, c'est trop pres ;
  //    quatre, c'est bon (la case du batiment, puis deux vides).
  const cases = await page.evaluate(() => {
    const arene = (window as unknown as Fenetre).__jeu!.scene.getScene("arena") as {
      grille: { aProximite(x: number, y: number, r: number, o: string[]): boolean; poser(x: number, y: number, o: string): void };
    };
    const x = 200;
    const y = 200;
    arene.grille.poser(x, y, "batiment");
    return {
      aTrois: arene.grille.aProximite(x + 2 * 32, y, 2, ["batiment"]),
      aQuatre: arene.grille.aProximite(x + 3 * 32, y, 2, ["batiment"]),
    };
  });
  noter("deux cases : a deux cases c'est refuse, a trois c'est libre", cases.aTrois && !cases.aQuatre, cases);

  // 2. Un mur passe au fer : 500 PV, texture en fer, stocks debites, puis la pierre refusee.
  const mur = await page.evaluate(() => {
    const arene = (window as unknown as Fenetre).__jeu!.scene.getScene("arena") as {
      constructions: {
        toutes: { def: { id: string }; matiere: string; pv: number; pvMax: number; x: number; y: number; ouverte: boolean; chantierJusqua: number; habiller(): void; texture: { key: string } }[];
        ameliorer(c: unknown, stocks: unknown, maintenant: number): string | null;
        refusAmelioration(c: unknown, stocks: unknown): string | null;
      };
      village: { stocks: { bois: number; minerai: number } };
      time: { now: number };
      cameras: { main: { stopFollow(): void; setZoom(z: number): void; centerOn(x: number, y: number): void } };
    };
    const segment = arene.constructions.toutes.find((c) => c.def.id === "palissade" && c.matiere === "bois");
    if (!segment) return null;
    arene.village.stocks.bois = 500;
    arene.village.stocks.minerai = 200;
    const matiere = arene.constructions.ameliorer(segment, arene.village.stocks, arene.time.now);
    const refus = arene.constructions.refusAmelioration(segment, arene.village.stocks);
    // Le chantier se voit d'abord ; on le finit pour lire la texture du fer.
    const chantier = segment.texture.key;
    segment.chantierJusqua = 0;
    segment.habiller();
    arene.cameras.main.stopFollow();
    arene.cameras.main.setZoom(3);
    arene.cameras.main.centerOn(segment.x, segment.y);
    return {
      matiere,
      pv: segment.pv,
      pvMax: segment.pvMax,
      chantier,
      texture: segment.texture.key,
      bois: arene.village.stocks.bois,
      minerai: arene.village.stocks.minerai,
      refus,
    };
  });
  noter(
    "mur au fer : chantier d'abord, puis 500 PV et texture fer ; 60 bois et 25 minerai debites ; la pierre attend",
    mur !== null &&
      mur.matiere === "fer" &&
      mur.chantier.includes("chantier") &&
      mur.pv === 500 &&
      mur.pvMax === 500 &&
      mur.texture.includes("fer") &&
      mur.bois === 440 &&
      mur.minerai === 175 &&
      (mur.refus ?? "").includes("pierre"),
    mur,
  );
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${dossier}/mur-fer.png` });

  // 3. Une porte passe au fer, se ferme a la cloche et se rouvre.
  const porte = await page.evaluate(() => {
    const arene = (window as unknown as Fenetre).__jeu!.scene.getScene("arena") as {
      constructions: {
        toutes: { def: { id: string }; matiere: string; pv: number; pvMax: number; ouverte: boolean; chantierJusqua: number; habiller(): void; texture: { key: string }; body: { enable: boolean } }[];
        ameliorer(c: unknown, stocks: unknown, maintenant: number): string | null;
        fermerLesPortes(): void;
        ouvrirLesPortes(): void;
      };
      village: { stocks: { bois: number; minerai: number } };
      time: { now: number };
    };
    const p = arene.constructions.toutes.find((c) => c.def.id === "porte");
    if (!p) return null;
    const matiere = arene.constructions.ameliorer(p, arene.village.stocks, arene.time.now);
    p.chantierJusqua = 0;
    p.habiller();
    const ouverteAvant = p.ouverte;
    const textureOuverte = p.texture.key;
    arene.constructions.fermerLesPortes();
    const fermee = { ouverte: p.ouverte, texture: p.texture.key, corps: p.body.enable };
    arene.constructions.ouvrirLesPortes();
    const rouverte = { ouverte: p.ouverte, texture: p.texture.key, corps: p.body.enable };
    return { matiere, pvMax: p.pvMax, ouverteAvant, textureOuverte, fermee, rouverte };
  });
  noter(
    "porte au fer : 660 PV, se ferme et se rouvre en gardant le fer",
    porte !== null &&
      porte.matiere === "fer" &&
      porte.pvMax === 660 &&
      porte.ouverteAvant &&
      porte.textureOuverte.includes("fer") &&
      !porte.fermee.ouverte &&
      porte.fermee.texture.includes("fer") &&
      porte.fermee.texture !== porte.textureOuverte &&
      porte.rouverte.ouverte &&
      porte.rouverte.texture === porte.textureOuverte,
    porte,
  );

  // 4. Le village attire les monstres au-dela de 65 habitants.
  const hordes = await page.evaluate(() => {
    const arene = (window as unknown as Fenetre).__jeu!.scene.getScene("arena") as {
      village: object;
      events: { on(nom: string, f: (m: string) => void): void };
      programmerHorde(): void;
      prochaineHorde: number;
      time: { now: number };
    };
    const annonces: string[] = [];
    arene.events.on("annonce", (m) => annonces.push(m));
    // Pas d'accesseur en litteral : esbuild le nommerait (`__name`), et ce nom
    // n'existe pas dans la page. Un descripteur rempli a la main passe.
    const descripteur: PropertyDescriptor = {};
    descripteur.configurable = true;
    descripteur.get = () => 70;
    Object.defineProperty(arene.village, "population", descripteur);
    arene.programmerHorde();
    const attire = arene.prochaineHorde - arene.time.now;
    delete (arene.village as { population?: number }).population;
    arene.programmerHorde();
    const calme = arene.prochaineHorde - arene.time.now;
    return { attire, calme, annonces };
  });
  noter(
    "65 habitants : hordes toutes les 20-40 s au-dela, 2-4 min en dessous, le guet le dit",
    hordes.attire >= 20_000 &&
      hordes.attire <= 40_000 &&
      hordes.calme >= 120_000 &&
      hordes.annonces.some((a) => a.includes("attire")) &&
      hordes.annonces.some((a) => a.includes("calment")),
    hordes,
  );

  // 5. Quatre actives : la cinquieme ouvre « plus de place ». Sans argent, on
  //    remplace ; avec, on achete l'emplacement. Le guerrier n'a que cinq
  //    actives au catalogue, et ca suffit pour les deux chemins.
  const place = await page.evaluate((ids) => {
    const arene = (window as unknown as Fenetre).__jeu!.scene.getScene("arena") as {
      hero: { emplacements: number; actives: { id: string }[] };
      argent: number;
      modeChoix: string;
      resoudreChoix(id: string): void;
    };
    for (const id of ids.slice(0, 4)) arene.resoudreChoix(id);
    const quatre = arene.hero.actives.map((a) => a.id);
    arene.argent = 0;
    arene.resoudreChoix(ids[4]!);
    return { quatre, mode: arene.modeChoix, emplacements: arene.hero.emplacements };
  }, actives);
  noter("quatre actives apprises, la cinquieme demande une place", place.quatre.length === 4 && place.mode === "remplacement", place);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${dossier}/plus-de-place.png` });

  const suite = await page.evaluate((ids) => {
    const arene = (window as unknown as Fenetre).__jeu!.scene.getScene("arena") as {
      hero: { emplacements: number; actives: { id: string }[] };
      argent: number;
      modeChoix: string;
      resoudreChoix(id: string): void;
    };
    // Sans argent : on oublie la premiere pour la cinquieme.
    arene.resoudreChoix(ids[0]!);
    const remplacee = { actives: arene.hero.actives.map((a) => a.id), mode: arene.modeChoix };
    // Avec de quoi : la premiere revient, et on achete le cinquieme emplacement.
    arene.argent = 200;
    arene.resoudreChoix(ids[0]!);
    const demande = arene.modeChoix;
    arene.resoudreChoix("emplacement");
    const achete = {
      emplacements: arene.hero.emplacements,
      argent: arene.argent,
      actives: arene.hero.actives.map((a) => a.id),
      mode: arene.modeChoix,
    };
    return { remplacee, demande, achete };
  }, actives);
  noter(
    "remplacer la premiere par la cinquieme, puis acheter le cinquieme emplacement (150 pieces)",
    suite.remplacee.actives.length === 4 &&
      !suite.remplacee.actives.includes(actives[0]!) &&
      suite.remplacee.actives.includes(actives[4]!) &&
      suite.demande === "remplacement" &&
      suite.achete.emplacements === 5 &&
      suite.achete.argent === 50 &&
      suite.achete.actives.length === 5 &&
      suite.achete.actives.includes(actives[0]!) &&
      (suite.achete.mode === "competence" || suite.achete.mode === "evolution"),
    suite,
  );
} finally {
  await navigateur.close();
  await serveur.close();
}

console.log(resultats.join("\n"));
console.log(erreurs.length ? `\n${erreurs.length} message(s) console :\n${erreurs.join("\n")}` : "\naucune erreur console");
console.log(`captures : ${dossier}`);
process.exit(resultats.some((r) => r.startsWith("KO")) || erreurs.length ? 1 : 0);
