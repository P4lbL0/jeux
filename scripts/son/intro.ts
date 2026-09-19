import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  aCrete,
  aNiveau,
  adoucir,
  boucler,
  copie,
  crete,
  decouper,
  duree,
  ecrire,
  enveloppe,
  lire,
  niveau,
  passeBas,
  passeHaut,
  poser,
  ralentir,
  rampe,
  reverberer,
  silence,
  type Son,
} from "./dsp";
import { cloche, grondement } from "./synthese";

/**
 * Fabrique la bande-son de l'ecran-titre (DESIGN.md §4.10), de bout en bout.
 *
 *     npm run son                  -> sources (une fois), mixage, encodage, videos d'ecoute
 *     npm run son -- --musique 2   -> met la musique n° 2 dans le jeu (1, 2 ou 3)
 *
 * 1. Les sources libres de droits arrivent dans `.tmp/son/sources/` (voir
 *    SOURCES) — une seule fois. OpenGameArt demande dix secondes entre deux
 *    requetes, on en laisse onze.
 * 2. La cloche et le grondement du feu sont fabriques (`synthese.ts`).
 * 3. Tout est mixe en memoire (`dsp.ts`) et encode en OGG et en MP3 dans
 *    `src/assets/son/` : la piste du film, le glas du titre, le feu du menu, la
 *    musique, les deux bruits de l'interface.
 * 4. Trois videos d'ecoute — le film, son son, et chacune des trois musiques —
 *    partent dans `captures/son/<date>-intro/` : on choisit a l'oreille.
 * 5. `src/assets/son/CREDITS.md` est reecrit a partir de SOURCES.
 *
 * ⚠️ **Les niveaux se reglent ici, pas dans le jeu.** `son.ts` joue chaque
 * fichier a plein volume (seule la musique est baissee d'un cran) : c'est ce
 * script qui dit combien le feu pese contre le glas. Les videos d'ecoute
 * rejouent exactement ce que fait le jeu — memes fichiers, memes volumes, meme
 * etouffoir — pour que ce qu'on y entend soit ce qu'on entendra.
 *
 * Demande ffmpeg (libvorbis, libmp3lame, libx264) et `tar` (Windows 10 et plus
 * l'ont) pour ouvrir les archives.
 */

const RACINE = resolve(".");
const SOURCES_DIR = resolve(".tmp/son/sources");
const SORTIE = resolve("src/assets/son");
const DATE = new Date().toISOString().slice(0, 10);
const ECOUTE = resolve(`captures/son/${DATE}-intro`);
const FILM = { approche: resolve("src/assets/intro/approche.mp4"), boucle: resolve("src/assets/intro/boucle.mp4") };

// ------------------------------------------------------------------ sources

interface Source {
  /** Le nom du fichier dans `.tmp/son/sources/`. */
  fichier: string;
  /** Ce qu'on telecharge : le fichier, ou l'archive qui le contient. */
  url: string;
  /** Le chemin du fichier dans l'archive, quand `url` est une archive. */
  dansArchive?: string;
  titre: string;
  auteur: string;
  licence: string;
  page: string;
  role: string;
}

const OGA = "https://opengameart.org/sites/default/files";

const SOURCES = {
  feu: {
    fichier: "feu-cheminee.wav",
    url: `${OGA}/fire.wav`,
    titre: "Fireplace Sound loop",
    auteur: "PagDev",
    licence: "CC0",
    page: "https://opengameart.org/content/fireplace-sound-loop",
    role: "le crepitement du feu (film et menu)",
  },
  vent1: {
    fichier: "vent-1.wav",
    url: `${OGA}/wind1.wav`,
    titre: "wind1",
    auteur: "Luke.RUSTLTD",
    licence: "CC0",
    page: "https://opengameart.org/content/wind1",
    role: "le vent, oreille gauche",
  },
  vent3: {
    fichier: "vent-3.wav",
    url: `${OGA}/wind3.wav`,
    titre: "wind1 (piste 3)",
    auteur: "Luke.RUSTLTD",
    licence: "CC0",
    page: "https://opengameart.org/content/wind1",
    role: "le vent, oreille droite",
  },
  criFemme: {
    fichier: "cri-femme.ogg",
    url: `${OGA}/female_scream_1.ogg`,
    titre: "Female Scream 1",
    auteur: "Nocturnal_Vanguard (AuraVoice)",
    licence: "CC0",
    page: "https://opengameart.org/content/female-scream-1",
    role: "le premier cri, au loin a gauche",
  },
  crisFemme: {
    fichier: "cris-femme.ogg",
    url: `${OGA}/screams.ogg`,
    titre: "Female high-pitched scream SFX",
    auteur: "WuxiaScrub",
    licence: "CC0",
    page: "https://opengameart.org/content/female-high-pitched-scream-sfx",
    role: "le troisieme cri, tres loin",
  },
  criHomme: {
    fichier: "cri-homme.wav",
    url: `${OGA}/yelling%20sounds.zip`,
    dansArchive: "yelling sounds/yell1.wav",
    titre: "Male Grunt/Yelling sounds",
    auteur: "HaelDB",
    licence: "CC0",
    page: "https://opengameart.org/content/male-gruntyelling-sounds",
    role: "le deuxieme cri, au loin a droite",
  },
  boum: {
    fichier: "boum.wav",
    url: `${OGA}/NenadSimic%20-%20Muffled%20Distant%20Explosion.wav`,
    titre: "Muffled Distant Explosion",
    auteur: "NenadSimic",
    licence: "CC0",
    page: "https://opengameart.org/content/muffled-distant-explosion",
    role: "le coup sourd sous le glas du titre",
  },
  survol: {
    fichier: "ui-survol.ogg",
    url: "https://kenney.nl/media/pages/assets/impact-sounds/87b4ddecda-1677589768/kenney_impact-sounds.zip",
    dansArchive: "Audio/impactMetal_light_002.ogg",
    titre: "Impact Sounds (impactMetal_light_002)",
    auteur: "Kenney",
    licence: "CC0",
    page: "https://kenney.nl/assets/impact-sounds",
    role: "le survol d'une entree du menu",
  },
  clic: {
    fichier: "ui-clic.ogg",
    url: "https://kenney.nl/media/pages/assets/rpg-audio/8e99002d76-1677590336/kenney_rpg-audio.zip",
    dansArchive: "Audio/metalLatch.ogg",
    titre: "RPG Audio (metalLatch)",
    auteur: "Kenney",
    licence: "CC0",
    page: "https://kenney.nl/assets/rpg-audio",
    role: "le clic d'une entree du menu",
  },
  musique1: {
    fichier: "musique-1.flac",
    url: `${OGA}/the_world_fell_silent_loop.flac`,
    titre: "The World Fell Silent (version en boucle)",
    auteur: "Tsorthan Grove",
    licence: "CC0",
    page: "https://opengameart.org/content/the-world-fell-silent",
    role: "musique n° 1 : la nappe sombre",
  },
  musique2: {
    fichier: "musique-2.wav",
    url: `${OGA}/kokopellis_graveyard_theme.zip`,
    dansArchive: "Kokopelli's Graveyard.wav",
    titre: "Kokopelli's Graveyard Theme",
    auteur: "Cleyton Kauffman",
    licence: "CC0",
    page: "https://opengameart.org/content/kokopellis-graveyard-theme",
    role: "musique n° 2 : l'orgue du cimetiere",
  },
  musique3: {
    fichier: "musique-3.flac",
    url: `${OGA}/Lament%20of%20the%20War%20-%20Lossless%20FLAC.flac`,
    titre: "Lament of the War",
    auteur: "Cethiel",
    licence: "CC0",
    page: "https://opengameart.org/content/laments-of-the-war",
    role: "musique n° 3 : les tambours de guerre",
  },
} satisfies Record<string, Source>;

/** Les trois musiques a ecouter, dans l'ordre de la question du 19 septembre 2026. */
const MUSIQUES = [
  { n: 1, nom: "nappe-sombre", source: SOURCES.musique1 },
  { n: 2, nom: "orgue-du-cimetiere", source: SOURCES.musique2 },
  { n: 3, nom: "tambours-de-guerre", source: SOURCES.musique3 },
] as const;

const attendre = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Telecharge ce qui manque, poliment : onze secondes entre deux requetes au meme site. */
async function recupererLesSources(): Promise<void> {
  mkdirSync(SOURCES_DIR, { recursive: true });
  const derniere = new Map<string, number>();
  const archives = new Map<string, string>();
  for (const source of Object.values(SOURCES) as Source[]) {
    const cible = `${SOURCES_DIR}/${source.fichier}`;
    if (existsSync(cible)) continue;
    let fichier = archives.get(source.url);
    if (!fichier) {
      const site = new URL(source.url).host;
      const ecoule = Date.now() - (derniere.get(site) ?? 0);
      if (ecoule < 11000) await attendre(11000 - ecoule);
      console.log(`[son] telechargement : ${source.url}`);
      const r = await fetch(source.url, {
        headers: { "User-Agent": "le-protecteur-sons/1.0 (projet de jeu personnel, assets CC0)" },
      });
      derniere.set(site, Date.now());
      if (!r.ok) throw new Error(`[son] ${r.status} sur ${source.url}`);
      fichier = source.dansArchive ? `${SOURCES_DIR}/archive-${archives.size}.zip` : cible;
      writeFileSync(fichier, Buffer.from(await r.arrayBuffer()));
      if (source.dansArchive) archives.set(source.url, fichier);
    }
    if (source.dansArchive) {
      // Le fichier sort de l'archive tel quel, dans son format d'origine.
      const dossier = `${SOURCES_DIR}/archive-extraite`;
      mkdirSync(dossier, { recursive: true });
      const r = spawnSync("tar", ["-xf", fichier, "-C", dossier, source.dansArchive]);
      if (r.status !== 0) throw new Error(`[son] archive illisible : ${fichier}\n${r.stderr}`);
      copyFileSync(`${dossier}/${source.dansArchive}`, cible);
    }
  }
}

const src = (s: Source, debut = 0, longueur?: number) => lire(`${SOURCES_DIR}/${s.fichier}`, debut, longueur);

// ----------------------------------------------------------------- les sons

/** Le film dure 9 s ; sa piste deborde de 3 s, le temps que le glas s'eteigne sous le titre. */
const FILM_S = 9;
const DEBORD = 3;

/** Les moments du film (secondes depuis sa premiere image). */
const MOMENTS = {
  /** Trois cris, avant les cloches : un a gauche, un a droite, un tres loin. */
  cris: [1.9, 3.9, 6.3],
  /** Deux coups de glas ; le troisieme sonne avec le titre (`TitreScene`, 420 ms apres la fin). */
  glas: [4.6, 7.0],
  /** Quand le titre se pose, dans le jeu. */
  titre: FILM_S + 0.42,
};

/** Le feu : le crepitement enregistre, et le grondement fabrique dessous. */
function feu(debut: number, longueur: number, graine: number): Son {
  const crepite = adoucir(aNiveau(src(SOURCES.feu, debut, longueur), -26), -15);
  const gronde = aNiveau(grondement(longueur, graine), -29);
  poser(crepite, gronde, 0);
  return crepite;
}

/** Le vent : deux prises differentes, une par oreille, pour qu'il soit large. */
function vent(debut: number, longueur: number): Son {
  const g = src(SOURCES.vent1, debut, longueur);
  const d = src(SOURCES.vent3, debut, longueur);
  return aNiveau({ g: g.g, d: d.d }, -33);
}

/** Eloigne un cri : plus de grave ni d'aigu, et beaucoup plus de murs que de voix. */
function auLoin(cri: Son, aigu: number): Son {
  const s = passeBas(passeHaut(copie(cri), 320), aigu);
  return reverberer(aNiveau(s, -20), { piece: 0.82, amorti: 0.6, humide: 0.55, sec: 0.35, queue: 2.5 });
}

/** Un coup de glas, dans le village : un peu de pierre autour, et la distance qui mange l'aigu. */
function coupDeGlas(graine: number, sec: number): Son {
  const s = passeBas(cloche(98, 13, graine), 6000);
  return reverberer(aNiveau(s, -20), { piece: 0.86, amorti: 0.45, humide: 0.32, sec, queue: 1 });
}

function pisteDuFilm(): Son {
  const longueur = FILM_S + DEBORD;
  const piste = silence(longueur);

  // Le vent tout du long ; il cede la place au feu du menu a la fin du film.
  const souffle = enveloppe(vent(0, longueur), (t) => rampe(t, 0, 1.2) * (1 - rampe(t, FILM_S, FILM_S + 2)));
  poser(piste, souffle, 0, 1);

  // Le feu grossit a mesure qu'on remonte le chemin entre les maisons.
  const brasier = enveloppe(feu(17, longueur, 3), (t) =>
    rampe(t, 0, 1) * (0.45 + 0.55 * rampe(t, 0.5, 7.5)) * (1 - rampe(t, FILM_S, FILM_S + 2)),
  );
  poser(piste, brasier, 0, 1);

  // Trois cris, au loin : a peine au-dessus du feu, on doit les chercher.
  const cri1 = auLoin(src(SOURCES.criFemme), 2600);
  const cri2 = auLoin(decouper(src(SOURCES.criHomme), 1.1, 2.3), 2200);
  const cri3 = auLoin(decouper(src(SOURCES.crisFemme), 1.75, 1.1), 1700);
  poser(piste, cri1, MOMENTS.cris[0], 0.2, -0.55);
  poser(piste, cri2, MOMENTS.cris[1], 0.3, 0.5);
  poser(piste, cri3, MOMENTS.cris[2], 0.16, -0.15);

  // Deux coups de glas.
  poser(piste, coupDeGlas(11, 0.8), MOMENTS.glas[0], 0.62, 0.1);
  poser(piste, coupDeGlas(12, 0.8), MOMENTS.glas[1], 0.7, 0.1);

  // Rien ne s'arrete net.
  enveloppe(piste, (t) => 1 - rampe(t, longueur - 0.6, longueur));
  return aCrete(piste, -3);
}

/** Le troisieme coup, plus pres, et un coup sourd dessous : le titre se pose. */
function glasDuTitre(): Son {
  const coup = coupDeGlas(13, 0.95);
  const boum = passeBas(ralentir(src(SOURCES.boum), 0.82), 240);
  const s = silence(Math.max(duree(coup), duree(boum)));
  poser(s, coup, 0, 1);
  poser(s, aNiveau(boum, niveau(coup) + 1), 0.01, 1);
  enveloppe(s, (t) => 1 - rampe(t, duree(s) - 1, duree(s)));
  return aCrete(s, -1.5);
}

/** Le feu et le vent du menu : 26 secondes qui bouclent sans couture. */
function feuDuMenu(): Son {
  const longueur = 26;
  const croisement = 3;
  const s = feu(0, longueur + croisement, 5);
  poser(s, vent(20, longueur + croisement), 0, 1);
  return aNiveau(boucler(s, longueur, croisement), -27);
}

/** Une musique, ramenee au niveau commun. Le jeu la boucle telle quelle. */
function musique(source: Source): Son {
  return aNiveau(src(source), -21);
}

/** Un bruit d'interface : court, net, sans rien de grave qui gronde. */
function bruit(source: Source, creteDb: number): Son {
  return aCrete(passeHaut(src(source), 250), creteDb);
}

// ---------------------------------------------------------------- l'ecoute

/** Ce que fait `son.ts` : la musique un cran plus bas, l'etouffoir a 700 Hz. */
const JEU = { volumeMusique: 0.7, etouffoir: 700, dureeEtouffoir: 1.43, fonduFeu: 2.5, fonduMusique: 4 };

/**
 * Rejoue l'ecran-titre comme le jeu le fait, sans le sauter, pendant `longueur`
 * secondes : la piste du film, puis le feu du menu qui monte et devient sourd,
 * le glas du titre, et la musique.
 */
function ecoute(pisteFilm: Son, glas: Son, feuMenu: Son, air: Son, longueur: number): Son {
  const ambiance = silence(longueur);
  poser(ambiance, pisteFilm, 0);
  // Le feu du menu tourne en boucle a partir de la fin du film.
  const tours = Math.ceil((longueur - FILM_S) / duree(feuMenu)) + 1;
  const feuLong = silence(tours * duree(feuMenu));
  for (let i = 0; i < tours; i++) poser(feuLong, feuMenu, i * duree(feuMenu));
  enveloppe(feuLong, (t) => rampe(t, 0, JEU.fonduFeu));
  poser(ambiance, feuLong, FILM_S);
  // L'etouffoir : on passe du clair au sourd pendant que l'image se trouble.
  const sourde = passeBas(copie(ambiance), JEU.etouffoir, 0.5);
  const fin = FILM_S + JEU.dureeEtouffoir;
  enveloppe(ambiance, (t) => 1 - rampe(t, FILM_S, fin));
  enveloppe(sourde, (t) => rampe(t, FILM_S, fin));

  const tout = silence(longueur);
  poser(tout, ambiance, 0);
  poser(tout, sourde, 0);
  poser(tout, glas, MOMENTS.titre);
  const musiqueLongue = enveloppe(copie(air), (t) => rampe(t, 0, JEU.fonduMusique) * JEU.volumeMusique);
  poser(tout, musiqueLongue, MOMENTS.titre);
  enveloppe(tout, (t) => 1 - rampe(t, longueur - 1.5, longueur));
  if (crete(tout) > 0.98) aCrete(tout, -0.5);
  return tout;
}

/**
 * La video d'ecoute : le film, puis la boucle floue et voilee comme sous le menu.
 * En 960 × 540 : l'image n'est la que pour accompagner le son, et ces videos
 * sont commitees avec les captures.
 */
function videoDEcoute(son: Son, fichier: string, longueur: number): void {
  const wav = `${SOURCES_DIR}/../ecoute.wav`;
  ecrire(son, wav, ["-c:a", "pcm_s16le"]);
  const tours = Math.ceil((longueur - FILM_S) / 4);
  const trouble = `clip((T-${FILM_S})/1.1,0,1)`;
  const r = spawnSync(
    "ffmpeg",
    [
      "-hide_banner", "-loglevel", "error", "-y",
      "-i", FILM.approche,
      "-stream_loop", `${tours}`, "-i", FILM.boucle,
      "-i", wav,
      "-filter_complex",
      `[0:v][1:v]concat=n=2:v=1:a=0,trim=duration=${longueur},setpts=PTS-STARTPTS,format=yuv420p,split[net][b];` +
        `[b]gblur=sigma=12,colorchannelmixer=rr=0.58:gg=0.58:bb=0.58[flou];` +
        `[net][flou]blend=all_expr='A*(1-${trouble})+B*${trouble}',scale=960:540[v]`,
      "-map", "[v]", "-map", "2:a",
      "-c:v", "libx264", "-preset", "medium", "-crf", "27", "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", "-shortest",
      fichier,
    ],
    { stdio: "inherit" },
  );
  if (r.status !== 0) throw new Error(`[son] video d'ecoute ratee : ${fichier}`);
}

// ----------------------------------------------------------------- credits

function credits(musiqueDuJeu: number): string {
  const lignes = (Object.values(SOURCES) as Source[])
    .filter((s) => !s.role.startsWith("musique") || s === MUSIQUES[musiqueDuJeu - 1].source)
    .map((s) => `| ${s.role} | [${s.titre}](${s.page}) | ${s.auteur} | ${s.licence} |`);
  return [
    "# Les sons de l'ecran-titre",
    "",
    "Fabriques par `npm run son` (`scripts/son/intro.ts`). Ce fichier est reecrit a chaque",
    "passage : ne pas le modifier a la main.",
    "",
    "Tous les enregistrements sont **libres de droits (CC0)** : aucune attribution n'est",
    "exigee, on credite quand meme. **La cloche et le grondement du feu ne viennent de",
    "personne** : ils sont fabriques par le code (`scripts/son/synthese.ts`), faute d'un glas",
    "libre de droits propre.",
    "",
    "| Sert a | Son | Auteur | Licence |",
    "|---|---|---|---|",
    ...lignes,
    "",
  ].join("\n");
}

// -------------------------------------------------------------------- tout

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const i = args.indexOf("--musique");
  const choix = i >= 0 ? Number(args[i + 1]) : 1;
  if (![1, 2, 3].includes(choix)) throw new Error("[son] --musique 1, 2 ou 3");
  // Pour regler un niveau : les fichiers du jeu seulement, sans les trois videos.
  const sansEcoute = args.includes("--sans-ecoute");

  await recupererLesSources();
  mkdirSync(SORTIE, { recursive: true });
  mkdirSync(ECOUTE, { recursive: true });

  console.log("[son] mixage");
  const piste = pisteDuFilm();
  const glas = glasDuTitre();
  const feuMenu = feuDuMenu();
  const airs = MUSIQUES.map((m) => (sansEcoute && m.n !== choix ? silence(0) : musique(m.source)));

  const OGG = ["-c:a", "libvorbis", "-q:a", "4"];
  const MP3 = ["-c:a", "libmp3lame", "-b:a", "128k"];
  const OGG_MUSIQUE = ["-c:a", "libvorbis", "-q:a", "2"];
  const MP3_MUSIQUE = ["-c:a", "libmp3lame", "-b:a", "96k"];
  const livrer = (s: Son, nom: string, ogg = OGG, mp3 = MP3) => {
    ecrire(s, `${SORTIE}/${nom}.ogg`, ogg);
    ecrire(s, `${SORTIE}/${nom}.mp3`, mp3);
    console.log(`[son] ${nom} : ${duree(s).toFixed(1)} s, ${niveau(s).toFixed(1)} dB eff., crete ${(20 * Math.log10(crete(s))).toFixed(1)} dB`);
  };
  livrer(piste, "intro-approche");
  livrer(glas, "titre-glas");
  livrer(feuMenu, "titre-feu");
  livrer(airs[choix - 1], "titre-musique", OGG_MUSIQUE, MP3_MUSIQUE);
  livrer(bruit(SOURCES.survol, -14), "ui-survol");
  livrer(bruit(SOURCES.clic, -8), "ui-clic");
  writeFileSync(`${SORTIE}/CREDITS.md`, credits(choix));

  if (sansEcoute) return;
  console.log("[son] videos d'ecoute");
  const longueur = 40;
  for (const m of MUSIQUES) {
    const fichier = `${ECOUTE}/ecoute-${m.n}-${m.nom}.mp4`;
    videoDEcoute(ecoute(piste, glas, feuMenu, airs[m.n - 1], longueur), fichier, longueur);
    console.log(`[son] ${fichier.replace(RACINE, ".")}`);
  }
  console.log(`[son] musique du jeu : n° ${choix} (${MUSIQUES[choix - 1].nom})`);
}

void main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
