import Phaser from "phaser";
import {
  ACTIONS,
  actionParId,
  fusionner,
  mappageParDefaut,
  serialiser,
  TOUCHE_CARACTERE_QUESTION,
  type Mappage,
} from "../core/touches";

/**
 * Le clavier du jeu, cote Phaser (DESIGN.md §4.10).
 *
 * `core/touches.ts` decide **quelle touche fait quoi** ; ce fichier-ci sait
 * seulement la brancher. Il fait trois choses et pas une de plus :
 *
 * - il retient le mappage d'une partie a l'autre (`localStorage`, comme les
 *   volumes de `son.ts`) ;
 * - il traduit un nom de touche en code Phaser, et un evenement clavier en nom ;
 * - il pose les ecouteurs, et il sait tous les reposer quand le mappage change.
 *
 * ⚠️ **Le mappage est unique pour tout le jeu**, comme les volumes. Deux scenes
 * ecoutent le clavier — l'arene et l'interface — et un mappage par scene aurait
 * garanti qu'un des deux soit perime le jour ou on remappe en pleine partie.
 */

const CLE = "protecteur:touches";

let courant: Mappage | null = null;
const abonnes = new Set<(m: Mappage) => void>();

function rangement(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    // Un navigateur qui refuse le stockage (navigation privee, cookies bloques)
    // ne doit pas empecher de jouer : on joue avec les touches par defaut.
    return null;
  }
}

/** Le mappage en cours. Relu du rangement a la premiere demande, puis garde. */
export function mappage(): Mappage {
  if (courant) return courant;
  try {
    courant = fusionner(JSON.parse(rangement()?.getItem(CLE) ?? "{}"));
  } catch {
    courant = mappageParDefaut();
  }
  return courant;
}

/** Pose un nouveau mappage : on l'enregistre, puis tout le monde se rebranche. */
export function poserMappage(nouveau: Mappage): void {
  courant = nouveau;
  try {
    rangement()?.setItem(CLE, JSON.stringify(serialiser(nouveau)));
  } catch {
    // Rien a faire : le mappage vivra le temps de la partie.
  }
  for (const abonne of abonnes) abonne(nouveau);
}

export function remettreLesTouchesParDefaut(): void {
  poserMappage(mappageParDefaut());
}

/** S'abonner aux remappages. Rend la fonction qui desabonne. */
export function surChangementDesTouches(fn: (m: Mappage) => void): () => void {
  abonnes.add(fn);
  return () => abonnes.delete(fn);
}

/** Pour les tests : on repart d'un clavier neuf sans toucher au rangement. */
export function oublierLeMappage(): void {
  courant = null;
}

// ------------------------------------------------------- noms et codes

type CodesConnus = Record<string, number>;

const CODES = Phaser.Input.Keyboard.KeyCodes as unknown as CodesConnus;

/** Le code Phaser d'un nom de touche, ou `null` si ce n'en est pas un. */
export function codeDe(nom: string): number | null {
  if (nom === TOUCHE_CARACTERE_QUESTION) return null;
  const code = CODES[nom];
  return typeof code === "number" ? code : null;
}

/**
 * Le nom d'un code, pour transformer un appui en reglage.
 *
 * La table inverse est construite **une fois** : `KeyCodes` fait deux cents
 * entrees, et la parcourir a chaque appui pendant qu'on remappe serait
 * exactement le genre de recherche que le §4.17 interdit ailleurs.
 */
const NOMS_PAR_CODE = new Map<number, string>();
for (const [nom, code] of Object.entries(CODES)) {
  if (typeof code === "number" && !NOMS_PAR_CODE.has(code)) NOMS_PAR_CODE.set(code, nom);
}

export function nomDuCode(code: number): string | null {
  return NOMS_PAR_CODE.get(code) ?? null;
}

/**
 * Les touches qu'on ne laisse pas prendre.
 *
 * ECHAP se remappe (c'est la pause), mais les modificateurs seuls et les
 * touches du navigateur ne veulent rien dire : « Maj » n'est pas une commande,
 * et F5 ne nous appartient pas.
 */
const INTERDITES = new Set<number>([
  CODES.SHIFT!,
  CODES.CTRL!,
  CODES.ALT!,
  CODES.CAPS_LOCK!,
  CODES.F5!,
  CODES.F11!,
  CODES.F12!,
]);

export function toucheInterdite(code: number): boolean {
  return INTERDITES.has(code);
}

// ------------------------------------------------------------ le clavier

type Poignee = () => void;

/**
 * Les touches d'une scene, branchees sur des actions et non sur des lettres.
 *
 * On declare ce qu'on veut faire (`surAppui("cloche", ...)`), jamais quelle
 * touche le fait. Quand le joueur remappe, la classe defait tout et rebranche :
 * aucun appelant n'a a le savoir.
 */
export class Clavier {
  private readonly poignees = new Map<string, Poignee>();
  private readonly touches = new Map<string, Phaser.Input.Keyboard.Key[]>();
  /** Ce qu'on lit a l'image, sans poignee : garde pour le rebranchement. */
  private readonly suivies = new Set<string>();
  private readonly desabonner: () => void;
  private surCaractere: ((e: KeyboardEvent) => void) | null = null;

  /**
   * @param filtre appele avant chaque action : `false` l'avale. C'est la ou
   *   l'arene dit « pas pendant une saisie », « pas en pause ».
   */
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly filtre: (id: string) => boolean = () => true,
  ) {
    this.desabonner = surChangementDesTouches(() => this.rebrancher());
    this.scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.detruire());
  }

  /** Ce que fait une action quand on appuie. Une seule poignee par action. */
  surAppui(id: string, poignee: Poignee): void {
    this.poignees.set(id, poignee);
    this.brancherUne(id);
  }

  /** Vrai tant que la touche est enfoncee — pour les deplacements. */
  enfoncee(id: string): boolean {
    const touches = this.touches.get(id);
    return touches !== undefined && touches.some((t) => t.isDown);
  }

  /** Vrai a l'image ou on vient d'appuyer — pour les capacites. */
  justeAppuyee(id: string): boolean {
    const touches = this.touches.get(id);
    if (!touches) return false;
    return touches.some((t) => Phaser.Input.Keyboard.JustDown(t));
  }

  /**
   * Prepare les touches d'une action qu'on lit a l'image, sans poignee.
   *
   * Sans ca, `enfoncee("haut")` serait toujours faux : une touche n'existe pour
   * Phaser que si on l'a demandee.
   */
  suivre(...ids: string[]): void {
    for (const id of ids) {
      this.suivies.add(id);
      this.brancherUne(id);
    }
  }

  private brancherUne(id: string): void {
    const clavier = this.scene.input.keyboard;
    if (!clavier) return;
    const action = actionParId(id);
    if (!action) return;

    this.debrancherUne(id);

    const noms = [mappage()[id] ?? action.defaut, ...(action.alias ?? [])];
    const posees: Phaser.Input.Keyboard.Key[] = [];
    for (const nom of noms) {
      if (nom === TOUCHE_CARACTERE_QUESTION) {
        this.brancherLeCaractereQuestion(id);
        continue;
      }
      const code = codeDe(nom);
      if (code === null) continue;
      // Capture par defaut, comme avant la refonte : TAB ne doit pas faire
      // defiler la page et ECHAP ne doit pas sortir du plein ecran.
      const touche = clavier.addKey(code);
      const poignee = this.poignees.get(id);
      if (poignee) touche.on("down", () => this.declencher(id, poignee));
      posees.push(touche);
    }
    this.touches.set(id, posees);
  }

  /**
   * « ? » n'a pas de code utilisable : il demande Maj sur AZERTY comme sur
   * QWERTY, et ce n'est pas la meme touche physique des deux cotes. On l'ecoute
   * donc par son caractere (§4.10).
   */
  private brancherLeCaractereQuestion(id: string): void {
    const clavier = this.scene.input.keyboard;
    if (!clavier || this.surCaractere) return;
    this.surCaractere = (e: KeyboardEvent) => {
      if (e.key !== "?") return;
      const poignee = this.poignees.get(id);
      if (poignee) this.declencher(id, poignee);
    };
    clavier.on("keydown", this.surCaractere);
  }

  private declencher(id: string, poignee: Poignee): void {
    if (!this.filtre(id)) return;
    poignee();
  }

  private debrancherUne(id: string): void {
    const clavier = this.scene.input.keyboard;
    for (const touche of this.touches.get(id) ?? []) {
      touche.removeAllListeners();
      clavier?.removeKey(touche, true, true);
    }
    this.touches.delete(id);
  }

  private rebrancher(): void {
    const clavier = this.scene.input.keyboard;
    if (this.surCaractere && clavier) {
      clavier.off("keydown", this.surCaractere);
      this.surCaractere = null;
    }
    for (const id of [...this.touches.keys()]) this.debrancherUne(id);
    // On rebranche tout ce qui etait suivi, poignee ou non : les deplacements
    // n'ont pas de poignee et doivent pourtant repondre apres un remappage.
    for (const action of ACTIONS) {
      if (this.poignees.has(action.id) || this.suivies.has(action.id)) this.brancherUne(action.id);
    }
  }

  detruire(): void {
    this.desabonner();
    const clavier = this.scene.input.keyboard;
    if (this.surCaractere && clavier) clavier.off("keydown", this.surCaractere);
    this.surCaractere = null;
    for (const id of [...this.touches.keys()]) this.debrancherUne(id);
    this.poignees.clear();
  }
}
