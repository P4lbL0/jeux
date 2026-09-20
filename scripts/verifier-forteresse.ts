import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { createServer } from "vite";

/**
 * Verifie la forteresse du bloc 7b dans le navigateur (DESIGN.md §4.20) :
 * on ne se mure pas sans porte, la pierre se vend, la cloche ferme les portes
 * quand plus personne n'est dehors, une porte fermee s'ouvre devant les notres
 * si aucun monstre n'est pres, la douve ralentit, la douve en eau bloque, et
 * le pont-levis passe par-dessus.
 *
 *     npx tsx scripts/verifier-forteresse.ts [dossier]
 *
 * Les captures partent dans `captures/jeu/<date>-forteresse/`.
 */

const PORT = 5196;
const dossier = resolve(process.argv[2] ?? `captures/jeu/${new Date().toISOString().slice(0, 10)}-forteresse`);
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

interface Battant {
  phase: string;
  laissePasser: boolean;
}

interface Construction {
  x: number;
  y: number;
  def: { id: string };
  matiere: string;
  pv: number;
  pvMax: number;
  battant: Battant | null;
  position: string;
  pontLevis: boolean;
  eau: boolean;
  pont: boolean;
  laissePasser: boolean;
}

interface Arene {
  constructions: {
    portes: Construction[];
    toutes: Construction[];
    portesFermees: boolean;
    en(x: number, y: number): Construction | null;
    refus(x: number, y: number, type: string, stocks: unknown): string | null;
    batir(x: number, y: number, type: string, stocks: unknown, maintenant?: number): Construction | null;
    ameliorer(c: Construction, stocks: unknown, maintenant?: number): string | null;
    refusRemplissage(c: Construction, stocks: unknown): string | null;
    remplir(c: Construction, stocks: unknown): boolean;
    refusPontLevis(c: Construction, stocks: unknown): string | null;
    convertirEnPontLevis(c: Construction, stocks: unknown): boolean;
    ralentissement(x: number, y: number): number;
    contournement(x: number, y: number, angle: number): number | null;
    fermerLesPortes(maintenant: number): void;
  };
  grille: {
    caseEn(x: number, y: number): { terrain: string; occupation: string } | null;
    centreDe(x: number, y: number): { x: number; y: number };
    constructible(x: number, y: number): boolean;
  };
  village: {
    stocks: Record<string, number>;
    habitants: { etat: string; regles: { vivant: boolean }; disableBody(a: boolean, b: boolean): void }[];
    dehors: unknown[];
  };
  hero: { x: number; y: number; facteurEau: number; setPosition(x: number, y: number): void; setVelocity(x: number, y: number): void };
  ennemis: { getChildren(): { x: number; y: number; destroy(): void }[] };
  time: { now: number };
  clocheSonnee: boolean;
  sonnerLaCloche(): void;
  lacherLaMeute(x: number, y: number, combien: number): void;
  enregistrer(): void;
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
const arene = () => (window as unknown as Fenetre).__jeu!.scene.getScene("arena") as Arene;

try {
  await page.goto(`http://localhost:${PORT}/`);
  await page.waitForFunction(() => (window as unknown as Fenetre).__jeu?.scene.isActive("titre") === true, null, { timeout: 30_000 });
  await page.evaluate(() => {
    const jeu = (window as unknown as Fenetre).__jeu!;
    jeu.scene.stop("titre");
    if (jeu.scene.isActive("menu")) jeu.scene.stop("menu");
    jeu.scene.start("arena", { classe: "guerrier", emplacement: 1, graineVillage: 7, sansLaMarche: true });
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
  await page.waitForTimeout(800);

  // De quoi tout payer.
  await page.evaluate(() => {
    const a = (window as unknown as Fenetre).__jeu!.scene.getScene("arena") as Arene;
    a.village.stocks.bois = 5000;
    a.village.stocks.minerai = 2000;
    a.village.stocks.pierre = 2000;
  });

  // 1. On ne se mure pas sans porte : un anneau de 3 x 3 sur l'herbe, loin de tout.
  const enceinte = await page.evaluate(() => {
    const a = (window as unknown as Fenetre).__jeu!.scene.getScene("arena") as Arene;
    let coin: { x: number; y: number } | null = null;
    for (let y = 300; y < 700 && !coin; y += 32) {
      for (let x = 900; x < 1500 && !coin; x += 32) {
        let ok = true;
        for (let dy = -2; dy <= 2 && ok; dy++) {
          for (let dx = -2; dx <= 2 && ok; dx++) {
            const c = a.grille.caseEn(x + dx * 32, y + dy * 32);
            if (!c || c.terrain !== "herbe" || c.occupation !== "libre") ok = false;
          }
        }
        if (ok && a.constructions.refus(x, y, "palissade", a.village.stocks) === null) coin = a.grille.centreDe(x, y);
      }
    }
    if (!coin) return { erreur: "pas de coin" };
    const anneau = [
      [-1, -1],
      [0, -1],
      [1, -1],
      [1, 0],
      [1, 1],
      [0, 1],
      [-1, 1],
    ];
    const poses = anneau.map(([dx, dy]) => a.constructions.batir(coin!.x + dx! * 32, coin!.y + dy! * 32, "palissade", a.village.stocks) !== null);
    const dernier = { x: coin.x - 32, y: coin.y };
    const refus = a.constructions.refus(dernier.x, dernier.y, "palissade", a.village.stocks);
    const refuse = a.constructions.batir(dernier.x, dernier.y, "palissade", a.village.stocks);
    // On remplace le mur du nord par une porte : le dernier mur passe.
    const nord = a.constructions.en(coin.x, coin.y - 32)!;
    const stocksAvant = { ...a.village.stocks };
    a.constructions.toutes.indexOf(nord);
    // Demolir puis poser une porte a sa place.
    (a.constructions as unknown as { demolir(c: Construction, s: unknown): unknown }).demolir(nord, a.village.stocks);
    const porte = a.constructions.batir(coin.x, coin.y - 32, "porte", a.village.stocks);
    const accepte = a.constructions.batir(dernier.x, dernier.y, "palissade", a.village.stocks);
    return { coin, poses, refus, refuse: refuse === null, porte: porte !== null, accepte: accepte !== null, stocksAvant: stocksAvant.bois };
  });
  noter(
    "le dernier mur d'un anneau plein est refuse, et passe des qu'il y a une porte",
    !("erreur" in enceinte) && enceinte.poses.every(Boolean) && enceinte.refuse && /porte/.test(enceinte.refus ?? "") && enceinte.porte && enceinte.accepte,
    enceinte,
  );
  const coin = "coin" in enceinte ? enceinte.coin : { x: 1000, y: 500 };

  // 2. La pierre : un segment passe au fer, puis a la pierre, et coute de la pierre.
  const pierre = await page.evaluate((coin) => {
    const a = (window as unknown as Fenetre).__jeu!.scene.getScene("arena") as Arene;
    const mur = a.constructions.en(coin.x + 32, coin.y)!;
    const avant = { ...a.village.stocks };
    const fer = a.constructions.ameliorer(mur, a.village.stocks);
    const pierre = a.constructions.ameliorer(mur, a.village.stocks);
    return { fer, pierre, matiere: mur.matiere, pv: mur.pv, pierreDepensee: avant.pierre - a.village.stocks.pierre! };
  }, coin);
  noter("un mur passe au fer puis a la pierre, et la pierre se depense", pierre.fer === "fer" && pierre.pierre === "pierre" && pierre.pv === 2000 && pierre.pierreDepensee === 160, pierre);
  await cadrer(coin.x, coin.y, 3);
  await capturer("enceinte-avec-porte");

  // 3. La cloche : les portes attendent que plus personne ne soit dehors.
  const cloche = await page.evaluate(() => {
    const a = (window as unknown as Fenetre).__jeu!.scene.getScene("arena") as Arene;
    a.sonnerLaCloche();
    return { sonnee: a.clocheSonnee, dehors: a.village.dehors.length, fermees: a.constructions.portesFermees, portes: a.constructions.portes.length };
  });
  await page.waitForTimeout(400);
  const encoreOuvertes = await page.evaluate(() => {
    const a = (window as unknown as Fenetre).__jeu!.scene.getScene("arena") as Arene;
    return { fermees: a.constructions.portesFermees, dehors: a.village.dehors.length };
  });
  // Tout le monde rentre d'un coup : les portes se ferment, en deux secondes.
  const fermeture = await page.evaluate(() => {
    const a = (window as unknown as Fenetre).__jeu!.scene.getScene("arena") as Arene;
    for (const v of a.village.habitants) {
      if (!v.regles.vivant) continue;
      v.etat = "abri";
      v.disableBody(true, true);
    }
    return { dehors: a.village.dehors.length };
  });
  await page.waitForTimeout(300);
  const seFerment = await page.evaluate(() => {
    const a = (window as unknown as Fenetre).__jeu!.scene.getScene("arena") as Arene;
    return { fermees: a.constructions.portesFermees, phases: a.constructions.portes.map((p) => p.battant!.phase) };
  });
  await page.waitForTimeout(2_100);
  const fermees = await page.evaluate(() => {
    const a = (window as unknown as Fenetre).__jeu!.scene.getScene("arena") as Arene;
    return { phases: a.constructions.portes.map((p) => p.battant!.phase), passent: a.constructions.portes.map((p) => p.laissePasser), positions: a.constructions.portes.map((p) => p.position) };
  });
  noter(
    "la cloche sonne, les portes attendent que tout le monde soit rentre, puis se ferment en 2 s",
    cloche.sonnee && cloche.dehors > 0 && !encoreOuvertes.fermees && fermeture.dehors === 0 && seFerment.fermees && seFerment.phases.every((p) => p === "se-ferme") && fermees.phases.every((p) => p === "fermee") && fermees.passent.every((p) => !p),
    { cloche, encoreOuvertes, fermeture, seFerment, fermees },
  );
  const porte = await page.evaluate(() => {
    const a = (window as unknown as Fenetre).__jeu!.scene.getScene("arena") as Arene;
    const p = a.constructions.portes[0]!;
    return { x: p.x, y: p.y };
  });
  await cadrer(porte.x, porte.y, 3);
  await capturer("porte-fermee");

  // 4. Une porte fermee s'ouvre devant le heros, sans monstre pres.
  await page.evaluate((porte) => {
    const a = (window as unknown as Fenetre).__jeu!.scene.getScene("arena") as Arene;
    a.hero.setVelocity(0, 0);
    a.hero.setPosition(porte.x, porte.y + 34);
  }, porte);
  await page.waitForTimeout(300);
  const sOuvre = await page.evaluate(() => {
    const a = (window as unknown as Fenetre).__jeu!.scene.getScene("arena") as Arene;
    return a.constructions.portes[0]!.battant!.phase;
  });
  await page.waitForTimeout(1_100);
  await capturer("porte-s-ouvre");
  await page.waitForTimeout(1_100);
  const ouverte = await page.evaluate(() => {
    const a = (window as unknown as Fenetre).__jeu!.scene.getScene("arena") as Arene;
    const p = a.constructions.portes[0]!;
    return { phase: p.battant!.phase, passe: p.laissePasser, position: p.position, autres: a.constructions.portes.slice(1).map((q) => q.battant!.phase) };
  });
  noter("devant le heros, sans monstre, la porte s'ouvre en 2 s — et seulement elle", sOuvre === "s-ouvre" && ouverte.phase === "ouverte" && ouverte.passe && ouverte.autres.every((p) => p === "fermee"), { sOuvre, ouverte });
  await capturer("porte-ouverte-devant-le-heros");

  // 5. Le heros s'eloigne : la porte se referme apres l'attente.
  await page.evaluate((porte) => {
    const a = (window as unknown as Fenetre).__jeu!.scene.getScene("arena") as Arene;
    a.hero.setPosition(porte.x, porte.y + 200);
  }, porte);
  // On echantillonne la phase tous les quarts de seconde : elle doit rester
  // ouverte pendant l'attente (2,5 s), se fermer (2 s), puis etre fermee.
  const chronologie: string[] = [];
  const depart = await page.evaluate(() => {
    const a = (window as unknown as Fenetre).__jeu!.scene.getScene("arena") as Arene;
    const p = a.constructions.portes[0]! as unknown as { derniereDemande: number };
    return { now: a.time.now, derniereDemande: p.derniereDemande };
  });
  for (let i = 0; i < 22; i += 1) {
    await page.waitForTimeout(250);
    chronologie.push(
      await page.evaluate(() => {
        const a = (window as unknown as Fenetre).__jeu!.scene.getScene("arena") as Arene;
        return a.constructions.portes[0]!.battant!.phase;
      }),
    );
  }
  const compte = (phase: string) => chronologie.filter((p) => p === phase).length;
  noter(
    "plus personne : elle reste ouverte le temps de l'attente, se referme, puis est fermee",
    compte("ouverte") >= 7 && compte("se-ferme") >= 5 && chronologie[chronologie.length - 1] === "fermee" && chronologie.indexOf("se-ferme") > chronologie.lastIndexOf("ouverte"),
    { depart, chronologie },
  );

  // 6. Un monstre pres de la porte : elle reste close devant le heros.
  const menace = await page.evaluate((porte) => {
    const a = (window as unknown as Fenetre).__jeu!.scene.getScene("arena") as Arene;
    a.lacherLaMeute(porte.x + 90, porte.y - 60, 3);
    for (const e of a.ennemis.getChildren()) (e as unknown as { setVelocity(x: number, y: number): void }).setVelocity(0, 0);
    a.hero.setPosition(porte.x, porte.y + 34);
    return { monstres: a.ennemis.getChildren().length };
  }, porte);
  await page.waitForTimeout(700);
  const resteClose = await page.evaluate(() => {
    const a = (window as unknown as Fenetre).__jeu!.scene.getScene("arena") as Arene;
    return a.constructions.portes[0]!.battant!.phase;
  });
  await capturer("porte-close-monstres-pres");
  await page.evaluate(() => {
    const a = (window as unknown as Fenetre).__jeu!.scene.getScene("arena") as Arene;
    for (const e of [...a.ennemis.getChildren()]) e.destroy();
  });
  await page.waitForTimeout(400);
  const rouvre = await page.evaluate(() => {
    const a = (window as unknown as Fenetre).__jeu!.scene.getScene("arena") as Arene;
    return a.constructions.portes[0]!.battant!.phase;
  });
  noter("un monstre a portee : la porte reste close ; la meute ecartee, elle s'ouvre", menace.monstres === 3 && resteClose === "fermee" && rouvre === "s-ouvre", { menace, resteClose, rouvre });

  // 7. La douve seche ralentit ; la douve en eau bloque, et se remplit depuis la mer.
  await page.evaluate(() => {
    const a = (window as unknown as Fenetre).__jeu!.scene.getScene("arena") as Arene;
    a.hero.setPosition(100, 100);
  });
  const douves = await page.evaluate((coin) => {
    const a = (window as unknown as Fenetre).__jeu!.scene.getScene("arena") as Arene;
    const seche = a.constructions.batir(coin.x, coin.y - 96, "douve", a.village.stocks);
    const ralenti = a.constructions.ralentissement(coin.x, coin.y - 96);
    // Une case de sable qui touche le haut-fond, libre, pour une douve en eau.
    let bord: { x: number; y: number } | null = null;
    for (let y = 200; y < 1300 && !bord; y += 32) {
      for (let x = 40; x < 400 && !bord; x += 32) {
        const c = a.grille.caseEn(x, y);
        const ouest = a.grille.caseEn(x - 32, y);
        const est = a.grille.caseEn(x + 32, y);
        const est2 = a.grille.caseEn(x + 64, y);
        if (!c || !ouest || !est || !est2 || ouest.terrain !== "haut-fond" || c.terrain !== "sable") continue;
        if (!a.grille.constructible(x, y) || !a.grille.constructible(x + 32, y) || !a.grille.constructible(x + 64, y)) continue;
        if (a.constructions.refus(x, y, "douve", a.village.stocks) || a.constructions.refus(x + 32, y, "douve", a.village.stocks)) continue;
        if (a.constructions.refus(x + 64, y, "porte", a.village.stocks)) continue;
        bord = a.grille.centreDe(x, y);
      }
    }
    if (!bord) return { erreur: "pas de bord de mer libre" };
    const d1 = a.constructions.batir(bord.x, bord.y, "douve", a.village.stocks)!;
    const d2 = a.constructions.batir(bord.x + 32, bord.y, "douve", a.village.stocks)!;
    // La deuxieme ne touche pas la mer : refusee tant que la premiere est seche.
    const refusLoin = a.constructions.refusRemplissage(d2, a.village.stocks);
    const r1 = a.constructions.remplir(d1, a.village.stocks);
    const r2 = a.constructions.remplir(d2, a.village.stocks);
    // Un monstre qui marcherait vers l'est a travers d2 : on le detourne.
    const detour = a.constructions.contournement(d2.x - 40, d2.y, 0);
    return {
      seche: seche !== null,
      ralenti,
      bord,
      refusLoin,
      r1,
      r2,
      eau: [d1.eau, d2.eau],
      passent: [d1.laissePasser, d2.laissePasser],
      detourne: detour !== null,
    };
  }, coin);
  noter(
    "la douve seche ralentit a 35 %, l'eau vient de la mer et de proche en proche, et bloque",
    !("erreur" in douves) && douves.seche && douves.ralenti === 0.35 && /eau/.test(douves.refusLoin ?? "") && douves.r1 && douves.r2 && douves.eau.every(Boolean) && douves.passent.every((p) => !p) && douves.detourne,
    douves,
  );
  // Le heros dans la douve seche : sa vitesse tombe.
  await page.evaluate((coin) => {
    const a = (window as unknown as Fenetre).__jeu!.scene.getScene("arena") as Arene;
    a.hero.setPosition(coin.x, coin.y - 96);
  }, coin);
  await page.waitForTimeout(300);
  const facteur = await page.evaluate(() => {
    const a = (window as unknown as Fenetre).__jeu!.scene.getScene("arena") as Arene;
    return a.hero.facteurEau;
  });
  noter("le heros dans une douve seche est ralenti", facteur === 0.35, { facteur });
  await cadrer(coin.x, coin.y - 60, 3);
  await capturer("douve-seche-et-enceinte");

  // 8. Le pont-levis : une porte contre la douve en eau, murs au nord et au sud.
  if (!("erreur" in douves)) {
    const bord = douves.bord;
    const pont = await page.evaluate((bord) => {
      const a = (window as unknown as Fenetre).__jeu!.scene.getScene("arena") as Arene;
      const px = bord.x + 64;
      const nord = a.constructions.batir(px, bord.y - 32, "palissade", a.village.stocks);
      const sud = a.constructions.batir(px, bord.y + 32, "palissade", a.village.stocks);
      const porte = a.constructions.batir(px, bord.y, "porte", a.village.stocks);
      if (!porte) return { erreur: "pas de porte", nord: nord !== null, sud: sud !== null, refus: a.constructions.refus(px, bord.y, "porte", a.village.stocks) };
      const refusAvant = a.constructions.refusPontLevis(porte, a.village.stocks);
      const converti = a.constructions.convertirEnPontLevis(porte, a.village.stocks);
      const douve = a.constructions.en(bord.x + 32, bord.y)!;
      return { refusAvant, converti, pontLevis: porte.pontLevis, phase: porte.battant!.phase, sousPont: douve.pont, passe: douve.laissePasser, x: px, y: bord.y };
    }, bord);
    // La porte est nee fermee (consigne de nuit) : on oublie la cloche — sinon
    // la scene referme aussitot, tout le monde etant rentre — et on rouvre pour
    // voir le tablier s'abattre.
    await page.evaluate(() => {
      const a = (window as unknown as Fenetre).__jeu!.scene.getScene("arena") as Arene;
      a.clocheSonnee = false;
      (a.constructions as unknown as { ouvrirLesPortes(m: number): void }).ouvrirLesPortes(a.time.now);
    });
    await page
      .waitForFunction(
        (bord) => {
          const a = (window as unknown as Fenetre).__jeu!.scene.getScene("arena") as Arene;
          return a.constructions.en(bord.x + 64, bord.y)?.battant?.phase === "ouverte";
        },
        bord,
        { timeout: 5_000 },
      )
      .catch(async () => {
        const etat = await page.evaluate((bord) => {
          const a = (window as unknown as Fenetre).__jeu!.scene.getScene("arena") as Arene;
          const p = a.constructions.en(bord.x + 64, bord.y);
          return { porte: p ? { id: p.def.id, phase: p.battant?.phase, position: p.position } : null, consigne: a.constructions.portesFermees, now: a.time.now };
        }, bord);
        console.log(`[pont-levis] la porte ne s'ouvre pas : ${JSON.stringify({ pont, etat })}`);
      });
    await page.waitForTimeout(150);
    const baisse = await page.evaluate((bord) => {
      const a = (window as unknown as Fenetre).__jeu!.scene.getScene("arena") as Arene;
      const porte = a.constructions.en(bord.x + 64, bord.y)!;
      const douve = a.constructions.en(bord.x + 32, bord.y)!;
      return { phase: porte.battant!.phase, sousPont: douve.pont, passe: douve.laissePasser };
    }, bord);
    if (!("erreur" in pont)) {
      await cadrer(pont.x - 20, pont.y, 3);
      await capturer("pont-levis-baisse");
    }
    const seLeve = await page.evaluate((bord) => {
      const a = (window as unknown as Fenetre).__jeu!.scene.getScene("arena") as Arene;
      a.constructions.fermerLesPortes(a.time.now);
      const douve = a.constructions.en(bord.x + 32, bord.y)!;
      // Des que le tablier se leve, la douve ne porte plus personne.
      return { sousPont: douve.pont, passe: douve.laissePasser };
    }, bord);
    await page
      .waitForFunction(
        (bord) => {
          const a = (window as unknown as Fenetre).__jeu!.scene.getScene("arena") as Arene;
          return a.constructions.en(bord.x + 64, bord.y)?.battant?.phase === "fermee";
        },
        bord,
        { timeout: 5_000 },
      )
      .catch(() => console.log("[pont-levis] le tablier ne finit pas de se lever"));
    await page.waitForTimeout(150);
    const leve = await page.evaluate((bord) => {
      const a = (window as unknown as Fenetre).__jeu!.scene.getScene("arena") as Arene;
      const porte = a.constructions.en(bord.x + 64, bord.y)!;
      const douve = a.constructions.en(bord.x + 32, bord.y)!;
      return { phase: porte.battant!.phase, sousPont: douve.pont, passe: douve.laissePasser };
    }, bord);
    if (!("erreur" in pont)) await capturer("pont-levis-leve");
    noter(
      "le pont-levis : refuse sans douve en eau devant, accepte contre elle ; baisse on passe, leve plus rien",
      !("erreur" in pont) && pont.converti && pont.pontLevis && !pont.sousPont && baisse.phase === "ouverte" && baisse.sousPont && baisse.passe && !seLeve.sousPont && !seLeve.passe && leve.phase === "fermee" && !leve.sousPont && !leve.passe,
      { pont, baisse, seLeve, leve },
    );
  }

  // 9. La sauvegarde garde l'eau, le pont-levis et la consigne des portes.
  const sauve = await page.evaluate(() => {
    const a = (window as unknown as Fenetre).__jeu!.scene.getScene("arena") as Arene;
    a.enregistrer();
    const tout = Object.keys(localStorage)
      .map((k) => localStorage.getItem(k) ?? "")
      .join("\n");
    return { eau: tout.includes('"eau":true'), pontLevis: tout.includes('"pontLevis":true'), consigne: tout.includes('"portesFermees":true'), pierre: /"pierre":\d/.test(tout) };
  });
  noter("la sauvegarde garde l'eau, le pont-levis, la consigne des portes et la pierre", sauve.eau && sauve.pontLevis && sauve.consigne && sauve.pierre, sauve);
} finally {
  await navigateur.close();
  await serveur.close();
}

console.log(resultats.join("\n"));
if (erreurs.length > 0) console.log(`\n${erreurs.length} erreur(s) console :\n${erreurs.slice(0, 10).join("\n")}`);
else console.log("\nAucune erreur console.");
if (resultats.some((r) => r.startsWith("KO"))) process.exitCode = 1;
