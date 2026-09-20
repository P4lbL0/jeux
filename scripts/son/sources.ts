import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";

/**
 * Les sources libres de droits, et comment on va les chercher.
 *
 * Partage par `intro.ts` (l'ecran-titre et les musiques) et `bruits.ts` (les
 * bruits de la partie) depuis le 20 septembre 2026 : une seule facon de
 * telecharger, une seule politesse — onze secondes entre deux requetes au meme
 * site, parce qu'OpenGameArt en demande dix dans son `robots.txt`.
 */
export interface Source {
  /** Le nom du fichier dans le dossier des sources. */
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

const attendre = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Telecharge ce qui manque, poliment : onze secondes entre deux requetes au
 * meme site. Une archive n'est prise qu'une fois, meme si plusieurs sources en
 * sortent ; ses fichiers en sortent tels quels, dans leur format d'origine
 * (`tar` de Windows lit les zip et les 7z).
 */
export async function recupererLesSources(sources: Iterable<Source>, dossier: string): Promise<void> {
  mkdirSync(dossier, { recursive: true });
  const derniere = new Map<string, number>();
  const archives = new Map<string, string>();
  for (const source of sources) {
    const cible = `${dossier}/${source.fichier}`;
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
      fichier = source.dansArchive ? `${dossier}/archive-${archives.size}${extension(source.url)}` : cible;
      writeFileSync(fichier, Buffer.from(await r.arrayBuffer()));
      if (source.dansArchive) archives.set(source.url, fichier);
    }
    if (source.dansArchive) {
      const extrait = `${dossier}/archive-extraite`;
      mkdirSync(extrait, { recursive: true });
      const r = spawnSync("tar", ["-xf", fichier, "-C", extrait, source.dansArchive]);
      if (r.status !== 0) throw new Error(`[son] archive illisible : ${fichier}\n${r.stderr}`);
      copyFileSync(`${extrait}/${source.dansArchive}`, cible);
    }
  }
}

/** `.zip` ou `.7z`, pour que `tar` reconnaisse l'archive a son nom. */
function extension(url: string): string {
  const m = /\.(zip|7z|rar|tar\.gz)$/i.exec(new URL(url).pathname);
  return m ? `.${m[1].toLowerCase()}` : ".zip";
}
