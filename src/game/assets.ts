/**
 * L'inventaire des PNG livres avec le jeu.
 *
 * ⚠️ **Il est vide, et c'est voulu** (10 septembre 2026). Tout ce qui se voit
 * est dessine par le code et cuit au demarrage (`dessin/monde.ts`). Le
 * mecanisme reste : Vite ramasse tout ce qui traine dans `src/assets/`, et le
 * nom du fichier est la cle de texture. Mais **un PNG depose ici remplace le
 * dessin au code sous la meme cle** — c'est exactement le piege qui a rendu le
 * moteur de dessin invisible pendant un mois. Ne rien deposer sans le vouloir.
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
