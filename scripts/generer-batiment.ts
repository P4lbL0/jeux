/**
 * Genere l'image d'un batiment avec ComfyUI, en local.
 *
 * **Le remplacant de `generer-assets.ts`**, qui ne peut plus rien produire
 * depuis que PixelLab est a 0 credit. Ici tout tourne sur la machine : pas de
 * compte, pas de credit, pas de quota. La contrepartie, c'est qu'un modele de
 * diffusion ne fait pas de pixel-art — il fait une illustration lisse de
 * 512 px. C'est `pixelliser.ts` qui en fait un sprite, et c'est lui qui garantit
 * que la direction artistique ne derive pas.
 *
 * ComfyUI vit **hors du depot** (`../outils/ComfyUI`) : c'est 8 Go de modeles et
 * de dependances Python, ca n'a rien a faire dans un depot de jeu.
 *
 * Usage :
 *   npx tsx scripts/generer-batiment.ts eglise-1 "small stone chapel"
 *   npx tsx scripts/generer-batiment.ts eglise-1 "..." --graine 42 --etapes 30
 *
 * Le serveur doit tourner : voir `demarrer-comfyui.ps1` a cote.
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const SERVEUR = "http://127.0.0.1:8188";
const MODELE = "v1-5-pruned-emaonly.safetensors";
const SORTIE = resolve(process.cwd(), ".tmp/generation");

/**
 * Le fond doit etre **uni et d'une couleur qui n'existe pas dans un village**.
 *
 * `pixelliser.ts` detoure en partant des bords, de proche en proche : il enleve
 * ce qui ressemble a la couleur du coin. Sur un fond blanc ou gris, il
 * emporterait avec lui les pierres claires du batiment. Le magenta ne risque
 * d'etre confondu avec rien.
 */
const FOND =
  "(isolated on a flat solid magenta background:1.6), (plain empty background:1.4)";

/**
 * Ce qu'on demande a chaque fois, quel que soit le batiment.
 *
 * **« isometric » et pas « top-down ».** Premier essai fait : demander une vue
 * de dessus a SD1.5 donne une photo prise au ras du sol, avec un ciel, des
 * nuages et une colline — inutilisable sur une carte vue de dessus. Le mot
 * « isometric », lui, est massivement represente dans les donnees de jeux video,
 * et il ramene la camera au bon endroit du premier coup.
 *
 * Les poids entre parentheses ne sont pas decoratifs : sans eux le modele
 * traite « fond uni » comme une suggestion. `pixelliser.ts` detoure en partant
 * des bords, donc un fond qui n'est pas uni fait echouer toute la chaine.
 */
const STYLE =
  "isometric game asset, single small building, centered, 45 degree bird eye view, " +
  "medieval fantasy village, warm saturated colors, " +
  "clean readable silhouette, soft even lighting";

const NEGATIF =
  "(sky:1.5), (clouds:1.5), (grass:1.4), (ground:1.4), (terrain:1.4), " +
  "photo, realistic, blurry, text, watermark, signature, people, character, " +
  "multiple buildings, landscape, hill, horizon, road, trees, fence, " +
  "cast shadow, frame, border, dark, gloomy, cluttered";

function option(nom: string, defaut: string): string {
  const i = process.argv.indexOf(`--${nom}`);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : defaut;
}

function construireFlux(sujet: string, graine: number, etapes: number) {
  return {
    "1": {
      class_type: "CheckpointLoaderSimple",
      inputs: { ckpt_name: MODELE },
    },
    "2": {
      class_type: "EmptyLatentImage",
      inputs: { width: 512, height: 512, batch_size: 1 },
    },
    "3": {
      class_type: "CLIPTextEncode",
      inputs: { text: `${sujet}, ${STYLE}, ${FOND}`, clip: ["1", 1] },
    },
    "4": {
      class_type: "CLIPTextEncode",
      inputs: { text: NEGATIF, clip: ["1", 1] },
    },
    "5": {
      class_type: "KSampler",
      inputs: {
        seed: graine,
        steps: etapes,
        cfg: 7.5,
        sampler_name: "dpmpp_2m",
        scheduler: "karras",
        denoise: 1,
        model: ["1", 0],
        positive: ["3", 0],
        negative: ["4", 0],
        latent_image: ["2", 0],
      },
    },
    "6": {
      class_type: "VAEDecode",
      inputs: { samples: ["5", 0], vae: ["1", 2] },
    },
    "7": {
      class_type: "SaveImage",
      inputs: { filename_prefix: "batiment", images: ["6", 0] },
    },
  };
}

async function attendre(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function main(): Promise<void> {
  const [nom, sujet] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  if (!nom || !sujet) {
    console.error('Usage : npx tsx scripts/generer-batiment.ts <nom> "<description en anglais>"');
    process.exit(1);
  }

  const graine = Number(option("graine", String(Math.floor(Math.random() * 1e9))));
  const etapes = Number(option("etapes", "30"));

  console.log(`Generation de "${nom}" (graine ${graine}, ${etapes} etapes)`);
  console.log(`  sujet : ${sujet}`);

  const reponse = await fetch(`${SERVEUR}/prompt`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: construireFlux(sujet, graine, etapes) }),
  });

  if (!reponse.ok) {
    console.error(`Le serveur a refuse : ${reponse.status}`);
    console.error(await reponse.text());
    process.exit(1);
  }

  const { prompt_id } = (await reponse.json()) as { prompt_id: string };

  // On interroge l'historique plutot que d'ecouter le websocket : c'est une
  // generation unique de quelques secondes, pas une file d'attente a suivre.
  let fichiers: { filename: string; subfolder: string; type: string }[] = [];
  for (let essai = 0; essai < 300; essai++) {
    await attendre(1000);
    const histo = await fetch(`${SERVEUR}/history/${prompt_id}`);
    const donnees = (await histo.json()) as Record<string, { outputs?: Record<string, { images?: typeof fichiers }> }>;
    const sortie = donnees[prompt_id]?.outputs;
    if (!sortie) continue;
    fichiers = Object.values(sortie).flatMap((s) => s.images ?? []);
    if (fichiers.length > 0) break;
  }

  if (fichiers.length === 0) {
    console.error("Rien n'est sorti au bout de 5 minutes.");
    process.exit(1);
  }

  mkdirSync(SORTIE, { recursive: true });
  for (const [i, fichier] of fichiers.entries()) {
    const url = new URL(`${SERVEUR}/view`);
    url.searchParams.set("filename", fichier.filename);
    url.searchParams.set("subfolder", fichier.subfolder);
    url.searchParams.set("type", fichier.type);

    const image = Buffer.from(await (await fetch(url)).arrayBuffer());
    const suffixe = fichiers.length > 1 ? `-${i}` : "";
    const chemin = resolve(SORTIE, `${nom}${suffixe}.png`);
    writeFileSync(chemin, image);
    console.log(`  ecrit : ${chemin}`);
  }

  console.log(`\nEnsuite : npx tsx scripts/pixelliser.ts .tmp/generation/${nom}.png src/assets/${nom}.png --taille 64`);
}

main();
