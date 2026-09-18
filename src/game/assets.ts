/**
 * L'inventaire des PNG livres avec le jeu.
 *
 * Depuis le 18 septembre 2026, ce sont les **batiments et le decor rendus en
 * low-poly par Blender** (`scripts/blender/`, `npm run sprites`) : Vite ramasse
 * tout ce qui traine dans `src/assets/`, et le nom du fichier est la cle de
 * texture. **Un PNG depose ici remplace le dessin au code sous la meme cle** —
 * le code reste le secours de toute cle sans PNG. `sprites-blender.test.ts`
 * refuse un fichier qui ne correspond a aucune cle du jeu.
 */

const FICHIERS = import.meta.glob("../assets/*.png", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

export interface AssetLivre {
  /** La cle de texture Phaser, c'est-a-dire le nom du fichier sans `.png`. */
  cle: string;
  /** L'URL servie par Vite, avec son empreinte de contenu en production. */
  url: string;
}

export const ASSETS: AssetLivre[] = Object.entries(FICHIERS)
  .map(([chemin, url]) => ({
    cle: chemin.split("/").pop()!.replace(/\.png$/, ""),
    url,
  }))
  .sort((a, b) => a.cle.localeCompare(b.cle));
