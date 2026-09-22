import Phaser from "phaser";
import "./police.css";
import { POLICE } from "./game/ui/chrome";
import { RATIO } from "./game/ui/ecran";
import { BootScene } from "./scenes/BootScene";
import { TitreScene } from "./scenes/TitreScene";
import { MenuScene } from "./scenes/MenuScene";
import { ChoixClasseScene } from "./scenes/ChoixClasseScene";
import { ArenaScene } from "./scenes/ArenaScene";
import { UiScene } from "./scenes/UiScene";

/** Le div qui porte le canvas : c'est lui qui donne la place disponible. */
const cadreDuJeu = document.getElementById("game")!;

/** La taille du canvas, en vrais pixels de l'ecran (voir `ui/ecran.ts`). */
function tailleDuCanvas(): { largeur: number; hauteur: number } {
  return {
    largeur: Math.max(1, Math.round(cadreDuJeu.clientWidth * RATIO)),
    hauteur: Math.max(1, Math.round(cadreDuJeu.clientHeight * RATIO)),
  };
}

const depart = tailleDuCanvas();

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: "game",
  /**
   * Le vide autour de la carte (§4.10).
   *
   * ⚠️ **Ce n'est pas du decor, c'est ce qu'on voit la ou le monde n'est pas
   * dessine** : au-dela du bord de carte, et dans les bandes qui restent quand
   * le canvas ne remplit pas la fenetre. C'etait un vert de pre (`#1d3b1c`)
   * jusqu'au 21 septembre 2026 — Angelos l'a trouve moche, et il avait raison :
   * un aplat vert clair se lit comme **un terrain**, donc comme une erreur
   * d'affichage, alors qu'il n'y a rien la. Du noir se lit comme du vide.
   *
   * C'est le noir de la page (`index.html`), pour que la bordure du canvas ne
   * se voie jamais.
   */
  backgroundColor: "#0d0b12",
  // Indispensable pour du pixel-art : pas de lissage quand on zoome.
  pixelArt: true,
  roundPixels: true,
  /**
   * ⚠️ **`NONE`, et le jeu se redimensionne lui-meme.** Le mode `RESIZE` mesure
   * le parent en pixels CSS et en fait la taille du canvas : c'est exactement
   * ce qui rendait le jeu flou sur un ecran a 150 ou 200 % (`ui/ecran.ts`). On
   * reprend la mesure a la main pour la faire en **vrais pixels**, et `zoom`
   * rend au canvas sa taille a l'ecran — il ne touche que le style CSS.
   */
  scale: {
    mode: Phaser.Scale.NONE,
    width: depart.largeur,
    height: depart.hauteur,
    zoom: 1 / RATIO,
  },
  /**
   * Le garde-fou contre la falaise (DESIGN.md §4.33, palier 0).
   *
   * ⚠️ **Le jeu ne ralentissait pas, il tombait d'un coup** : 1 600 monstres a
   * 52 images par seconde, 2 000 a 26. Mesure a l'appui, la cause n'est pas le
   * nombre de monstres mais **le rattrapage de Phaser** — quand une image a
   * traine, le moteur rejoue les pas de physique manques pour que l'horloge du
   * jeu reste juste. Chaque pas rejoue refait tout le travail de collision, ce
   * qui allonge l'image suivante, qui en redemande davantage. Mesure : 0,50 ms
   * de rattrapage a 1 600 monstres, **14,05 ms a 2 000**.
   *
   * Deux reglages coupent la spirale, et ils ne coutent rien :
   *
   * - `fixedStep: false` : **un seul pas de physique par image**, jamais deux.
   *   La simulation avance du temps reellement ecoule au lieu de rattraper un
   *   retard qu'elle creuse elle-meme. Sans risque de traverser un mur : a
   *   120 px/s et 50 ms, un corps avance de 6 px, contre 32 px de cote.
   * - `fps.min: 20` : **le delta est plafonne a 50 ms**. En dessous de vingt
   *   images par seconde, le jeu passe **au ralenti** plutot que de teleporter
   *   tout le monde d'un demi-pas. Une chute doit rester jouable, donc lisible.
   */
  fps: { min: 20 },
  physics: {
    default: "arcade",
    arcade: { debug: false, fixedStep: false },
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
  // Le mode `NONE` n'ecoute rien : c'est a nous de suivre la fenetre.
  window.addEventListener("resize", () => {
    const { largeur, hauteur } = tailleDuCanvas();
    jeu.scale.resize(largeur, hauteur);
  });
});
