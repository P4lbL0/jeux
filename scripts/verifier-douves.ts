import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { createServer } from "vite";

/**
 * Les douves autour d'un village, en configurations, dans le navigateur
 * (DESIGN.md §4.20, §4.29 — 20 septembre 2026) :
 *
 * 1. un anneau de douves colle a l'enceinte du vrai village, mis en eau depuis
 *    la mer, de proche en proche — et chaque porte devant l'eau devient un
 *    pont-levis ;
 * 2. la nuit, une meute lachee au nord et a l'est se rassemble devant les
 *    ponts-levis, et personne ne traverse l'eau ;
 * 3. loin du village, un anneau de douves sans porte contre lui refuse sa
 *    derniere mise en eau — on ne se noie pas sans passage ;
 * 4. dans un monde a lac, une meute lachee de l'autre cote du lac le
 *    contourne et arrive au village.
 *
 *     npx tsx scripts/verifier-douves.ts [dossier]
 *
 * Les captures partent dans `captures/jeu/<date>-douves/`.
 */

const PORT = 5197;
const dossier = resolve(process.argv[2] ?? `captures/jeu/${new Date().toISOString().slice(0, 10)}-douves`);
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

interface Construction {
  x: number;
  y: number;
  def: { id: string };
  battant: { phase: string; laissePasser: boolean } | null;
  pontLevis: boolean;
  eau: boolean;
  pont: boolean;
}

interface Arene {
  constructions: {
    portes: Construction[];
    toutes: Construction[];
    en(x: number, y: number): Construction | null;
    refus(x: number, y: number, type: string, stocks: unknown): string | null;
    batir(x: number, y: number, type: string, stocks: unknown, maintenant?: number): Construction | null;
    refusRemplissage(c: Construction, stocks: unknown): string | null;
    remplir(c: Construction, stocks: unknown): boolean;
    refusPontLevis(c: Construction, stocks: unknown): string | null;
    convertirEnPontLevis(c: Construction, stocks: unknown): boolean;
    portesFermees: boolean;
  };
  grille: {
    caseEn(x: number, y: number): { terrain: string; occupation: string; colonne: number; ligne: number } | null;
    centreDe(x: number, y: number): { x: number; y: number };
    constructible(x: number, y: number): boolean;
  };
  planVillage: { enceinte: { colonne: number; ligne: number; piece: string }[]; place: Set<string> };
  village: { stocks: Record<string, number>; habitants: { etat: string; regles: { vivant: boolean }; disableBody(a: boolean, b: boolean): void }[]; dehors: unknown[] };
  hero: { x: number; y: number; setPosition(x: number, y: number): void; setVelocity(x: number, y: number): void };
  ennemis: { getChildren(): { x: number; y: number; active: boolean; destroy(): void }[] };
  eglise: { sprite: { x: number; y: number } };
  time: { now: number };
  clocheSonnee: boolean;
  sonnerLaCloche(): void;
  lacherLaMeute(x: number, y: number, combien: number): void;
  cameras: { main: { stopFollow(): void; setZoom(z: number): void; centerOn(x: number, y: number): void } };
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

const lancer = async (graineMonde: number) => {
  await page.goto(`http://localhost:${PORT}/`);
  await page.waitForFunction(() => (window as unknown as Fenetre).__jeu?.scene.isActive("titre") === true, null, { timeout: 30_000 });
  await page.evaluate((g) => {
    const jeu = (window as unknown as Fenetre).__jeu!;
    jeu.scene.stop("titre");
    if (jeu.scene.isActive("menu")) jeu.scene.stop("menu");
    jeu.scene.start("arena", { classe: "guerrier", emplacement: 1, graineVillage: 7, graineMonde: g });
  }, graineMonde);
  await page.waitForFunction(
    () => {
      const jeu = (window as unknown as Fenetre).__jeu;
      return jeu?.scene.isActive("arena") === true && jeu.scene.isActive("ui") === true;
    },
    null,
    { timeout: 60_000 },
  );
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await page.waitForTimeout(800);
  // De quoi tout payer, et personne a la porte : une fiche d'arrivant met la
  // partie en pause, et la meute avec.
  await page.evaluate(() => {
    const a = (window as unknown as Fenetre).__jeu!.scene.getScene("arena") as Arene;
    a.village.stocks.bois = 50_000;
    a.village.stocks.minerai = 20_000;
    a.village.stocks.pierre = 20_000;
    (a as unknown as { prochaineArriveeJournee: number | null }).prochaineArriveeJournee = 9_999;
  });
};

try {
  // ------------------------------------------------ 1. l'anneau autour du village
  await lancer(0);
  const anneau = await page.evaluate(() => {
    const a = (window as unknown as Fenetre).__jeu!.scene.getScene("arena") as Arene;
    const enceinte = new Set(a.planVillage.enceinte.map((m) => `${m.colonne},${m.ligne}`));
    const cibles = new Map<string, { x: number; y: number }>();
    // Les huit voisines, pas quatre : a un angle sortant de l'enceinte, la
    // douve doit tourner elle aussi, sinon l'eau ne passe pas l'angle.
    for (const m of a.planVillage.enceinte) {
      for (let dl = -1; dl <= 1; dl++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dc === 0 && dl === 0) continue;
          const c = m.colonne + dc;
          const l = m.ligne + dl;
          const clef = `${c},${l}`;
          if (enceinte.has(clef) || a.planVillage.place.has(clef)) continue;
          cibles.set(clef, { x: c * 32 + 16, y: l * 32 + 16 });
        }
      }
    }
    let creusees = 0;
    const refus: Record<string, number> = {};
    for (const p of cibles.values()) {
      const r = a.constructions.refus(p.x, p.y, "douve", a.village.stocks);
      if (r) {
        refus[r] = (refus[r] ?? 0) + 1;
        continue;
      }
      if (a.constructions.batir(p.x, p.y, "douve", a.village.stocks)) creusees += 1;
    }
    // La mise en eau, de proche en proche, jusqu'a ce que plus rien ne se remplisse.
    let remplies = 0;
    const refusEau: Record<string, number> = {};
    for (let tour = 0; tour < 200; tour++) {
      let progres = 0;
      for (const d of a.constructions.toutes) {
        if (d.def.id !== "douve" || d.eau) continue;
        const r = a.constructions.refusRemplissage(d, a.village.stocks);
        if (r) {
          refusEau[r] = (refusEau[r] ?? 0) + 1;
          continue;
        }
        if (a.constructions.remplir(d, a.village.stocks)) {
          remplies += 1;
          progres += 1;
        }
      }
      if (progres === 0) break;
    }
    const seches = a.constructions.toutes.filter((d) => d.def.id === "douve" && !d.eau).length;
    // Les ponts-levis : chaque porte qui a de l'eau devant.
    let ponts = 0;
    const refusPont: string[] = [];
    for (const p of a.constructions.portes) {
      const r = a.constructions.refusPontLevis(p, a.village.stocks);
      if (r) refusPont.push(r);
      else if (a.constructions.convertirEnPontLevis(p, a.village.stocks)) ponts += 1;
    }
    // Le village peut etre ne avec ses douves et ses ponts-levis (§4.29) : on
    // compte ce qu'il y a a la fin, pas seulement ce qu'on vient de faire.
    const douvesTotal = a.constructions.toutes.filter((d) => d.def.id === "douve").length;
    const enEau = a.constructions.toutes.filter((d) => d.def.id === "douve" && d.eau).length;
    const pontsTotal = a.constructions.portes.filter((p) => p.pontLevis).length;
    return { cibles: cibles.size, creusees, refus, remplies, seches, ponts, douvesTotal, enEau, pontsTotal, portes: a.constructions.portes.length, refusPont: [...new Set(refusPont)] };
  });
  noter(
    "un anneau de douves colle a l'enceinte se creuse, se met en eau depuis la mer, et chaque porte devant l'eau devient un pont-levis",
    anneau.douvesTotal > 20 && anneau.enEau >= anneau.douvesTotal * 0.8 && anneau.pontsTotal >= 1,
    anneau,
  );
  const eglise = await page.evaluate(() => {
    const a = (window as unknown as Fenetre).__jeu!.scene.getScene("arena") as Arene;
    return { x: a.eglise.sprite.x, y: a.eglise.sprite.y };
  });
  await cadrer(eglise.x + 40, eglise.y - 40, 1.25);
  await capturer("1-anneau-en-eau-et-ponts-levis");

  // ------------------------------------------------ 2. la meute, de nuit, devant les ponts
  await page.evaluate(() => {
    const a = (window as unknown as Fenetre).__jeu!.scene.getScene("arena") as Arene;
    a.hero.setVelocity(0, 0);
    a.hero.setPosition(a.eglise.sprite.x, a.eglise.sprite.y + 40);
    a.sonnerLaCloche();
    for (const v of a.village.habitants) {
      if (!v.regles.vivant) continue;
      v.etat = "abri";
      v.disableBody(true, true);
    }
  });
  await page.waitForTimeout(2_600);
  const fermees = await page.evaluate(() => {
    const a = (window as unknown as Fenetre).__jeu!.scene.getScene("arena") as Arene;
    return { fermees: a.constructions.portesFermees, phases: a.constructions.portes.map((p) => p.battant!.phase), ponts: a.constructions.portes.filter((p) => p.pontLevis).length };
  });
  await page.evaluate(() => {
    const a = (window as unknown as Fenetre).__jeu!.scene.getScene("arena") as Arene;
    const e = a.eglise.sprite;
    a.lacherLaMeute(e.x + 60, 120, 6);
    a.lacherLaMeute(1700, e.y - 100, 6);
  });
  await page.waitForTimeout(24_000);
  const meute = await page.evaluate(() => {
    const a = (window as unknown as Fenetre).__jeu!.scene.getScene("arena") as Arene;
    const ponts = a.constructions.portes.filter((p) => p.pontLevis);
    const monstres = a.ennemis.getChildren().filter((e) => e.active);
    let auxPonts = 0;
    let dedans = 0;
    let dansLEau = 0;
    for (const m of monstres) {
      const c = a.grille.caseEn(m.x, m.y);
      if (c && a.planVillage.place.has(`${c.colonne},${c.ligne}`)) dedans += 1;
      if (c && c.occupation === "douve-eau") dansLEau += 1;
      const d = Math.min(...ponts.map((p) => Math.hypot(p.x - m.x, p.y - m.y)));
      if (d <= 110) auxPonts += 1;
    }
    return { monstres: monstres.length, auxPonts, dedans, dansLEau, ponts: ponts.length };
  });
  // La moitie au moins devant un pont : les autres longent la douve vers le
  // bout de l'enceinte, la ou la foret la remplace — c'est le flanc que le
  // village classique laisse ouvert, et ce n'est pas la douve qui le ferme.
  noter(
    "la nuit, la meute se rassemble devant les ponts-levis, personne n'est dans l'eau",
    fermees.fermees && meute.monstres >= 8 && meute.auxPonts >= meute.monstres * 0.5 && meute.dansLEau === 0,
    { fermees, meute },
  );
  await capturer("2-la-meute-devant-les-ponts-levis");

  // ------------------------------------------------ 3. le dernier remplissage refuse
  const refusFinal = await page.evaluate(() => {
    const a = (window as unknown as Fenetre).__jeu!.scene.getScene("arena") as Arene;
    for (const e of [...a.ennemis.getChildren()]) e.destroy();
    // Un coin d'herbe libre : un carre de murs 5 x 5 avec une porte, et un
    // anneau de douves a deux cases, que rien ne relie a la porte.
    let coin: { x: number; y: number } | null = null;
    for (let y = 300; y < 800 && !coin; y += 32) {
      for (let x = 900; x < 1600 && !coin; x += 32) {
        let ok = true;
        for (let dy = -5; dy <= 5 && ok; dy++) {
          for (let dx = -5; dx <= 5 && ok; dx++) {
            const c = a.grille.caseEn(x + dx * 32, y + dy * 32);
            if (!c || c.terrain !== "herbe" || c.occupation !== "libre") ok = false;
          }
        }
        if (ok) coin = a.grille.centreDe(x, y);
      }
    }
    if (!coin) return { erreur: "pas de coin" };
    let murs = 0;
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== 2) continue;
        const type = dx === 0 && dy === -2 ? "porte" : "palissade";
        if (a.constructions.batir(coin.x + dx * 32, coin.y + dy * 32, type, a.village.stocks)) murs += 1;
      }
    }
    const douves: Construction[] = [];
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== 4) continue;
        const d = a.constructions.batir(coin.x + dx * 32, coin.y + dy * 32, "douve", a.village.stocks);
        if (d) douves.push(d);
      }
    }
    // Pas de mer ici : on met la premiere en eau de force, comme une reprise,
    // pour que le reste puisse se remplir de proche en proche.
    (a.constructions as unknown as { remplirDeForce(d: Construction): void }).remplirDeForce(douves[0]!);
    let remplies = 1;
    let refus: string | null = null;
    // La derniere : au milieu du cote est, pas dans un angle.
    const derniere = douves.find((d) => Math.abs(d.x - (coin!.x + 4 * 32)) < 1 && Math.abs(d.y - coin!.y) < 1)!;
    for (let tour = 0; tour < 60; tour++) {
      let progres = 0;
      for (const d of douves) {
        if (d === derniere || d.eau) continue;
        if (a.constructions.refusRemplissage(d, a.village.stocks) === null && a.constructions.remplir(d, a.village.stocks)) {
          remplies += 1;
          progres += 1;
        }
      }
      if (progres === 0) break;
    }
    refus = a.constructions.refusRemplissage(derniere, a.village.stocks);
    return { coin, murs, douves: douves.length, remplies, refus };
  });
  noter(
    "un anneau de douves sans porte contre lui : la derniere mise en eau est refusee, en disant pourquoi",
    !("erreur" in refusFinal) && refusFinal.murs === 16 && refusFinal.remplies === refusFinal.douves - 1 && /passage/.test(refusFinal.refus ?? ""),
    refusFinal,
  );
  if (!("erreur" in refusFinal)) {
    await cadrer(refusFinal.coin.x, refusFinal.coin.y, 2);
    await capturer("3-anneau-sans-passage-derniere-refusee");
  }

  // ------------------------------------------------ 4. le lac, contourne
  await lancer(6);
  const lac = await page.evaluate(() => {
    const a = (window as unknown as Fenetre).__jeu!.scene.getScene("arena") as Arene;
    a.hero.setVelocity(0, 0);
    a.hero.setPosition(a.eglise.sprite.x, a.eglise.sprite.y + 40);
    // Le lac de la graine 6 est juste au nord du village : on lache la meute
    // au-dela du lac, la ligne droite le traverse.
    const e = a.eglise.sprite;
    a.lacherLaMeute(e.x, 260, 8);
    return { eglise: { x: e.x, y: e.y }, depart: { x: e.x, y: 260 } };
  });
  await page.waitForTimeout(30_000);
  const arrivee = await page.evaluate(() => {
    const a = (window as unknown as Fenetre).__jeu!.scene.getScene("arena") as Arene;
    const e = a.eglise.sprite;
    const monstres = a.ennemis.getChildren().filter((m) => m.active);
    const distances = monstres.map((m) => Math.round(Math.hypot(m.x - e.x, m.y - e.y)));
    let dansLEau = 0;
    for (const m of monstres) {
      const c = a.grille.caseEn(m.x, m.y);
      if (c && (c.terrain === "mer" || c.terrain === "abysse" || c.terrain === "haut-fond")) dansLEau += 1;
    }
    return { monstres: monstres.length, distances, dansLEau };
  });
  noter(
    "dans un monde a lac, la meute lachee de l'autre cote du lac le contourne et arrive au village",
    arrivee.monstres >= 6 && arrivee.distances.every((d) => d < 380) && arrivee.dansLEau === 0,
    { lac, arrivee },
  );
  await cadrer(lac.eglise.x, lac.eglise.y - 260, 0.9);
  await capturer("4-le-lac-contourne");
} finally {
  await navigateur.close();
  await serveur.close();
  console.log("\n" + resultats.join("\n"));
  if (erreurs.length > 0) {
    console.log("\nErreurs du navigateur :");
    for (const e of erreurs) console.log("  " + e);
  }
}
