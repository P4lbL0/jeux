import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Refait la cinematique d'ouverture, de bout en bout (DESIGN.md §4.10).
 *
 *     npm run intro                    -> rend les 240 images puis encode
 *     npm run intro -- --encoder-seulement   -> n'encode que ce qui est deja rendu
 *     npm run intro -- --samples 16 --res 960x540   -> un brouillon rapide
 *
 * 1. Blender rend `scripts/blender/intro.py` dans `.tmp/intro/frames/` ;
 * 2. ffmpeg en tire **deux videos** pour le jeu, chacune en WebM (VP9) et en MP4
 *    (H.264, pour les navigateurs sans VP9), dans `src/assets/intro/` :
 *      - `approche` : les images 1 a 144, la camera qui remonte le chemin (6 s) ;
 *      - `boucle`   : les images 145 a 240, ce qui tourne derriere le menu (4 s,
 *        sans couture — voir `intro.py`) ;
 * 3. une copie complete en MP4 et deux images fixes partent dans
 *    `captures/blender/<date>-cinematique/`, pour juger sur image.
 *
 * Demande Blender 5.2 (variable BLENDER pour le chemin) et ffmpeg avec libvpx-vp9
 * et libx264.
 */

const BLENDER =
  process.env.BLENDER ?? "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe";
const FRAMES = resolve(".tmp/intro/frames");
const SORTIE = resolve("src/assets/intro");
const CAPTURES = resolve(`captures/blender/${new Date().toISOString().slice(0, 10)}-cinematique`);

const FPS = 24;
const APPROCHE: [number, number] = [1, 144];
const BOUCLE: [number, number] = [145, 240];

const args = process.argv.slice(2);
const encoderSeulement = args.includes("--encoder-seulement");
const optionsBlender = args.filter((a) => a !== "--encoder-seulement");

function lancer(commande: string, params: string[]): void {
  const r = spawnSync(commande, params, { stdio: "inherit" });
  if (r.status !== 0) {
    console.error(`[intro] echec : ${commande} ${params.join(" ")}`);
    process.exit(r.status ?? 1);
  }
}

if (!encoderSeulement) {
  if (!existsSync(BLENDER)) {
    console.error(`[intro] Blender introuvable : ${BLENDER} (variable BLENDER)`);
    process.exit(1);
  }
  lancer(BLENDER, ["-b", "-P", "scripts/blender/intro.py", "--", "--anim", ...optionsBlender]);
}

const images = existsSync(FRAMES) ? readdirSync(FRAMES).filter((f) => f.endsWith(".png")).length : 0;
if (images < BOUCLE[1]) {
  console.error(`[intro] ${images} image(s) dans ${FRAMES}, il en faut ${BOUCLE[1]}`);
  process.exit(1);
}

mkdirSync(SORTIE, { recursive: true });
mkdirSync(CAPTURES, { recursive: true });

/** Les images `de` a `a`, encodees dans `fichier` avec les options du codec. */
function encoder(de: number, a: number, fichier: string, codec: string[]): void {
  lancer("ffmpeg", [
    "-y", "-hide_banner", "-loglevel", "error",
    "-framerate", `${FPS}`,
    "-start_number", `${de}`,
    "-i", `${FRAMES}/f_%04d.png`,
    "-frames:v", `${a - de + 1}`,
    ...codec,
    "-pix_fmt", "yuv420p",
    fichier,
  ]);
  console.log(`[intro] ${fichier}`);
}

// VP9 : la qualite par CRF, le multi-thread par rangees. `-g` place une image
// cle par seconde, ce qui rend le retour en arriere de la boucle instantane.
const VP9 = ["-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "31", "-row-mt", "1", "-deadline", "good", "-cpu-used", "1", "-g", `${FPS}`];
// H.264 : le secours pour les navigateurs sans VP9. `faststart` met l'index en
// tete du fichier, sinon la video n'est lisible qu'une fois entierement chargee.
const H264 = ["-c:v", "libx264", "-preset", "slow", "-crf", "22", "-profile:v", "high", "-movflags", "+faststart", "-g", `${FPS}`];

for (const [nom, [de, a]] of Object.entries({ approche: APPROCHE, boucle: BOUCLE })) {
  encoder(de, a, `${SORTIE}/${nom}.webm`, VP9);
  encoder(de, a, `${SORTIE}/${nom}.mp4`, H264);
}

// Pour juger : la sequence entiere, et deux images fixes. Sous un nom a part,
// pour ne pas ecraser les jets faits a la main dans le meme dossier.
encoder(APPROCHE[0], BOUCLE[1], `${CAPTURES}/intro-rendu.mp4`, H264);
copyFileSync(`${FRAMES}/f_0001.png`, `${CAPTURES}/intro-rendu-debut.png`);
copyFileSync(`${FRAMES}/f_0144.png`, `${CAPTURES}/intro-rendu-fin-approche.png`);
console.log(`[intro] captures -> ${CAPTURES}`);
