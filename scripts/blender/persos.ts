import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

/**
 * Les personnages low-poly, de bout en bout : heros et monstres, poses et
 * rendus image par image dans Blender, puis reduits a la taille du jeu et
 * poses cote a cote sur une planche a juger.
 *
 *     npm run persos                       -> tout
 *     npm run persos -- hero-mage          -> seulement les familles qui commencent ainsi
 *     npm run persos -- --dossier <dossier> -> la planche ailleurs (defaut : captures/blender/<date>-personnages/)
 *
 * 1. la palette du jeu, exportee pour Blender (`palette.ts`) ;
 * 2. le rendu en deux passes de chaque frame dans Blender (`persos.py`) ;
 * 3. la reduction et la planche (`planche_persos.py`).
 *
 * Demande Blender 5.2 et un Python avec Pillow et numpy. Le chemin de Blender
 * se change avec la variable BLENDER.
 */

const BLENDER =
  process.env.BLENDER ?? "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe";
const args = process.argv.slice(2);
const iDossier = args.indexOf("--dossier");
const dossier = iDossier >= 0 ? args[iDossier + 1] : undefined;
const filtres = args.filter((a, i) => a !== "--dossier" && i !== iDossier + 1);

function lancer(commande: string, argv: string[]): void {
  const r = spawnSync(commande, argv, { stdio: "inherit", shell: commande === "python" });
  if (r.status !== 0) {
    console.error(`[persos] echec : ${commande} ${argv.join(" ")}`);
    process.exit(r.status ?? 1);
  }
}

if (!existsSync(BLENDER)) {
  console.error(`[persos] Blender introuvable : ${BLENDER} (variable BLENDER)`);
  process.exit(1);
}

await import("./palette");
if (!args.includes("--sans-rendu")) {
  lancer(BLENDER, ["-b", "-P", "scripts/blender/persos.py", "--", ...filtres.filter((f) => f !== "--sans-rendu")]);
}
lancer("python", ["scripts/blender/planche_persos.py", ...(dossier ? ["--dossier", dossier] : [])]);
