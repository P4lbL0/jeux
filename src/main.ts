import Phaser from "phaser";
import "./police.css";
import { POLICE } from "./game/ui/chrome";
import { BootScene } from "./scenes/BootScene";
import { TitreScene } from "./scenes/TitreScene";
import { MenuScene } from "./scenes/MenuScene";
import { ChoixClasseScene } from "./scenes/ChoixClasseScene";
import { ArenaScene } from "./scenes/ArenaScene";
import { UiScene } from "./scenes/UiScene";

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: "game",
  backgroundColor: "#1d3b1c",
  // Indispensable pour du pixel-art : pas de lissage quand on zoome.
  pixelArt: true,
  roundPixels: true,
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: "arcade",
    arcade: { debug: false },
  },
  // BootScene charge les PNG avant tout le monde : les textures Phaser etant
  // globales, les scenes suivantes les trouvent deja la.
  // TitreScene joue le film d'ouverture ; MenuScene (les emplacements) se lance
  // par-dessus elle. UiScene tourne en parallele de l'arene, avec sa propre
  // camera non zoomee.
  scene: [BootScene, TitreScene, MenuScene, ChoixClasseScene, ArenaScene, UiScene],
};

/**
 * On attend la police avant de lancer le jeu.
 *
 * ⚠️ **Phaser dessine son texte dans un canvas, et un canvas ne se repeint pas
 * quand la police finit d'arriver.** Sans cette attente, l'ecran-titre et le
 * menu s'afficheraient dans la police de repli et **y resteraient** jusqu'a ce
 * qu'autre chose les redessine. On demande les deux graisses dont l'interface se
 * sert (§4.10) — charger une variable font ne charge pas ses graisses toutes
 * seules.
 *
 * L'attente est bornee : une police qui n'arrive pas ne doit jamais empecher de
 * jouer. On perd la fonte, on ne perd pas la partie.
 */
async function attendreLaPolice(): Promise<void> {
  if (typeof document === "undefined" || document.fonts === undefined) return;
  const chargements = [`400 16px ${POLICE}`, `600 44px ${POLICE}`].map((forme) =>
    document.fonts.load(forme),
  );
  const delai = new Promise((resoudre) => setTimeout(resoudre, 3000));
  await Promise.race([Promise.all(chargements), delai]);
}

/**
 * Le jeu est expose sur `window.__jeu` pour les scripts de capture
 * (`scripts/capturer.ts`) : ils lancent l'arene, cadrent la camera et ouvrent
 * la fiche sans cliquer dans les menus. Rien dans le jeu ne le lit.
 */
void attendreLaPolice().then(() => {
  const jeu = new Phaser.Game(config);
  (window as unknown as { __jeu: Phaser.Game }).__jeu = jeu;
});
