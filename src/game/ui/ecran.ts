import Phaser from "phaser";

/**
 * L'ecran physique : combien de vrais pixels pour un pixel d'interface.
 *
 * **Pourquoi ce fichier existe.** Le 21 septembre 2026, Angelos a dit avoir mal
 * au crane a lire le jeu : « toutes les polices, des qu'il y a du texte, je le
 * trouve illisible, flou et trop petit ». Mesure faite sur sa capture : un
 * jambage de lettre etale sur **trois a quatre pixels**, qui n'atteint jamais
 * sa vraie couleur — le profil exact d'une image agrandie au filtre lineaire.
 *
 * La cause n'etait pas la police ni sa taille. **Phaser dessinait le jeu a un
 * pixel par pixel CSS**, et Windows, regle a 150 ou 200 %, agrandissait le
 * canvas entier apres coup. Le jeu etait donc rendu en 1280x800 puis etire en
 * 2560x1600 par le navigateur : chaque trait de lettre y perdait ses bords.
 *
 * ⚠️ **Phaser n'a pas de reglage pour ca.** Sa propriete `resolution` a ete
 * retiree en 3.16, et son gestionnaire d'echelle fait toujours
 * `canvas.width = gameSize.width` : **la surface de dessin vaut exactement le
 * repere de jeu**, il n'y a pas de troisieme nombre entre les deux. Le seul
 * levier qui reste est celui-ci :
 *
 * 1. on donne au jeu un repere en **vrais pixels** (`innerWidth * RATIO`), donc
 *    un canvas de la densite de l'ecran, que le navigateur n'a plus a etirer ;
 * 2. on rend le canvas a sa bonne taille a l'ecran avec `zoom = 1 / RATIO`,
 *    qui ne touche que le style CSS ;
 * 3. et on remet les scenes d'interface dans un repere en pixels CSS avec une
 *    **camera zoomee de `RATIO`, calee sur son coin haut-gauche**
 *    (`calerLaCamera`) — ce qui evite de reecrire les neuf panneaux.
 *
 * Ce que ca donne : les plaques, les cadres et les jauges sont du `Graphics`,
 * donc des triangles que la carte graphique trace a la densite de l'ecran ; le
 * texte, lui, se rasterise a `RATIO` fois sa taille (voir `affuter` dans
 * `chrome.ts`) et retombe pile sur les vrais pixels.
 *
 * Ce fichier ne connait rien du jeu, et personne n'a a lire
 * `devicePixelRatio` ailleurs.
 */

/**
 * Combien de vrais pixels pour un pixel d'interface.
 *
 * ⚠️ **Lu une seule fois, au chargement.** Deplacer la fenetre d'un ecran a
 * l'autre en cours de partie ne le met donc pas a jour ; il faut recharger. On
 * l'accepte : suivre `devicePixelRatio` a chaud demanderait de reconstruire
 * toutes les scenes, pour un cas qui arrive une fois sur mille.
 *
 * **Borne a 2, et c'est une mesure de cout, pas un gout.** Le canvas coute le
 * carre de ce nombre en pixels a remplir : a 2 on peint quatre fois plus qu'a
 * 1, a 3 on en peindrait neuf. Au-dela de 2 l'oeil ne gagne plus rien sur du
 * texte de 12 px, et les ecrans qui annoncent 3 sont des telephones.
 *
 * Plancher a 1 : un `devicePixelRatio` absent ou plus petit que 1 (navigateur
 * dezoome) ne doit pas rendre le jeu **plus flou** qu'avant.
 */
export const RATIO: number = ((): number => {
  const brut = typeof window === "undefined" ? 1 : (window.devicePixelRatio || 1);
  return Math.min(2, Math.max(1, brut));
})();

/**
 * La surface pour laquelle l'interface est dessinee, en pixels d'interface.
 *
 * ⚠️ **C'est une mesure, prise sur l'ecran le plus serre du jeu.** Le choix de
 * classe pose sept cartes de 311 px de haut sur deux rangees plus une ligne
 * d'aide : il lui faut 800 px de haut, et il les remplit exactement. Descendre
 * la reference ferait deborder cet ecran-la par le bas — vu en capture le
 * 21 septembre 2026, la rangee du bas coupee et « Touches 1 a 7 » par-dessus
 * l'Oracle.
 *
 * Donc : a 1280 x 800, l'interface garde la taille qu'elle a toujours eue ;
 * au-dela, elle grandit avec la fenetre.
 */
const REFERENCE = { largeur: 1280, hauteur: 800 };

/**
 * Le plafond du grossissement.
 *
 * Au-dela, l'interface devient un decor : des plaques de dix centimetres pour
 * annoncer trois chiffres. Une fenetre de 1920 de large atteint deja ce
 * plafond.
 */
const CONFORT_MAX = 1.5;

/**
 * De combien on grossit l'interface sur cette fenetre.
 *
 * **Pourquoi elle grossit.** Le 21 septembre 2026, Angelos a trouve le texte
 * « trop petit ». Il l'etait : les panneaux etaient dessines pour une fenetre
 * de 1100 sur 700 et gardaient exactement la meme taille sur un ecran deux fois
 * plus grand — donc de plus en plus petits a mesure que l'ecran grandit.
 *
 * ⚠️ **On grossit l'interface entiere, pas seulement les polices.** Plaques,
 * marges, jauges et lettres montent ensemble : rien ne deborde de son cadre, et
 * c'est ce qui rend ce reglage sans risque. Un panneau qui n'aurait grossi que
 * par son texte, lui, aurait fallu le remesurer.
 *
 * Jamais sous 1 : sur une petite fenetre, l'interface garde sa taille d'avant
 * plutot que de retrecir — il vaut mieux qu'elle serre que qu'elle disparaisse.
 */
function confort(scene: Phaser.Scene): number {
  const largeur = scene.scale.width / RATIO;
  const hauteur = scene.scale.height / RATIO;
  const tient = Math.min(largeur / REFERENCE.largeur, hauteur / REFERENCE.hauteur);
  return Math.min(CONFORT_MAX, Math.max(1, tient));
}

/**
 * La largeur utile pour poser l'interface, en pixels d'interface.
 *
 * ⚠️ **A lire partout a la place de `scene.scale.width`**, qui compte
 * maintenant en vrais pixels : sur un ecran a 200 %, il rend le double et tout
 * panneau colle a droite sortirait de l'ecran.
 */
export function largeurEcran(scene: Phaser.Scene): number {
  return scene.scale.width / echelle(scene);
}

/** La hauteur utile pour poser l'interface, en pixels d'interface. */
export function hauteurEcran(scene: Phaser.Scene): number {
  return scene.scale.height / echelle(scene);
}

/**
 * L'echelle a laquelle cette scene dessine, lue **sur sa camera**.
 *
 * ⚠️ On la relit plutot que de la recalculer : la camera est la seule verite.
 * Recalculer `RATIO * confort(scene)` ici marcherait tant que les deux formules
 * restent identiques — et le jour ou l'une bouge sans l'autre, les panneaux se
 * poseraient a une echelle et se dessineraient a une autre, ce qui ne se voit
 * qu'en jouant.
 */
function echelle(scene: Phaser.Scene): number {
  return scene.cameras.main.zoom || RATIO;
}

/**
 * Remet une scene d'interface dans un repere en pixels CSS.
 *
 * ⚠️ **L'origine est le coin haut-gauche, pas le centre.** Par defaut une
 * camera Phaser zoome autour de son milieu : le point (0, 0) d'une scene
 * partirait alors hors de l'ecran des que le zoom depasse 1. Cale sur (0, 0),
 * le repere de la scene couvre exactement l'ecran, de son coin a
 * `largeurEcran` x `hauteurEcran`.
 *
 * A appeler dans le `create` de **toute scene qui pose du texte ou des
 * panneaux**. L'arene ne la prend pas : sa camera suit le heros et son zoom
 * porte deja le ratio (`ZOOM_DEFAUT`).
 */
export function calerLaCamera(scene: Phaser.Scene): void {
  const caler = (): void => {
    scene.cameras.main.setOrigin(0, 0).setZoom(RATIO * confort(scene));
  };
  caler();
  // ⚠️ **A refaire a chaque redimensionnement** : le grossissement depend de la
  // fenetre. Sans ca, agrandir la fenetre replace les panneaux (ils lisent
  // `largeurEcran` a chaque image) sans changer l'echelle de la camera, et tout
  // se decale.
  scene.scale.on("resize", caler);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.scale.off("resize", caler));
}
