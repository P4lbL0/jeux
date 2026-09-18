import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

/**
 * Refait les sprites low-poly du monde, de bout en bout.
 *
 *     npm run sprites                 -> tout
 *     npm run sprites -- bati-eglise  -> seulement les cles qui commencent ainsi
 *
 * 1. la palette du jeu, exportee pour Blender (`palette.ts`) ;
 * 2. le rendu en deux passes dans Blender (`rendre.py`) ;
 * 3. la reduction a la taille du jeu, dans la palette (`reduire.py`), qui
 *    ecrit `src/assets/<cle>.png`.
 *
 * Demande Blender 5.2 et un Python avec Pillow et numpy. Le chemin de Blender
 * se change avec la variable BLENDER.
 */

const BLENDER =
  process.env.BLENDER ?? "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe";
const filtres = process.argv.slice(2);

function lancer(commande: string, args: string[]): void {
  const r = spawnSync(commande, args, { stdio: "inherit", shell: commande === "python" });
  if (r.status !== 0) {
    console.error(`[sprites] echec : ${commande} ${args.join(" ")}`);
    process.exit(r.status ?? 1);
  }
}

if (!existsSync(BLENDER)) {
  console.error(`[sprites] Blender introuvable : ${BLENDER} (variable BLENDER)`);
  process.exit(1);
}

// La palette s'exporte a l'import (un sous-processus `npx` echoue sous Windows).
await import("./palette");
lancer(BLENDER, ["-b", "-P", "scripts/blender/rendre.py", "--", ...filtres]);
lancer("python", ["scripts/blender/reduire.py", ...filtres]);
