/**
 * L'orc de la horde (DESIGN.md §4.33, palier 2) : sa cle et son cadre.
 *
 * A part de `nuee.ts` pour une seule raison : ce fichier ne connait pas Phaser,
 * et le test des sprites livres (`sprites-blender.test.ts`) doit pouvoir lire la
 * cle sans charger le moteur.
 */

/** L'image du repos, rendue par Blender (`persos.py`, famille `monstre-orc`) et livree en `src/assets/horde-orc.png`. */
export const CLE_ORC = "horde-orc";

/** Son cadre : 24 px — sa tete ne tenait pas dans 20 (§4.33, decision d'Angelos). */
export const TAILLE_ORC = 24;
