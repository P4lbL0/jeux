/**
 * Le mappage du clavier (DESIGN.md §4.10, « Le menu d'options »).
 *
 * **Toutes les touches se remappent, sans exception.** Jusqu'ici elles etaient
 * ecrites en dur a deux endroits — la liste de `ArenaScene.configurerTouches`
 * et la ligne d'aide de `hud.ts` — et les deux derivaient l'une de l'autre des
 * qu'on en ajoutait une. Il n'y a plus qu'une table, ici, et les deux la lisent.
 *
 * ⚠️ **Une action a une touche qu'on remappe et des alias fixes.** Le pave
 * numerique, les fleches et ESPACE sont des secondes touches de confort : elles
 * ne se reglent pas, elles suivent. Ce qui se remappe, c'est la touche
 * principale — celle que la ligne d'aide affiche.
 *
 * ⚠️ **Deux actions ne partagent jamais une touche : elles l'echangent.** Poser
 * `G` sur la cloche rend a la palissade l'ancienne touche de la cloche. C'est
 * le seul moyen de ne jamais laisser une action sans touche, et une action sans
 * touche est une fonction du jeu qui disparait sans prevenir.
 *
 * Ce fichier ne connait pas Phaser : il ne manipule que des **noms** de touche
 * (« Z », « ESC », « NUMPAD_ONE »), ceux de `Phaser.Input.Keyboard.KeyCodes`.
 * La conversion en codes vit dans `game/touches.ts`.
 */

/** Les cinq familles du panneau des touches, dans l'ordre ou il les montre. */
export type CategorieTouche = "deplacer" | "battre" | "commander" | "batir" | "village";

export const NOMS_CATEGORIE: Record<CategorieTouche, string> = {
  deplacer: "Se deplacer",
  battre: "Se battre",
  commander: "Commander",
  batir: "Batir",
  village: "Le village",
};

export interface ActionClavier {
  id: string;
  /** Ce que la ligne d'aide et le panneau des touches ecrivent */
  nom: string;
  categorie: CategorieTouche;
  /** La touche principale, la seule qui se remappe */
  defaut: string;
  /**
   * Les secondes touches, fixes. Le pave numerique, les fleches, ESPACE : du
   * confort de clavier, pas des reglages. Les remapper n'apprendrait rien au
   * joueur et doublerait la taille du panneau.
   */
  alias?: readonly string[];
}

/**
 * Le nom special du « ? » (§4.10).
 *
 * Il n'a pas de code de touche utilisable : « ? » demande Maj sur AZERTY comme
 * sur QWERTY, et ce n'est pas la meme touche physique des deux cotes. On
 * l'ecoute donc par son **caractere**, et ce nom-la dit a `game/touches.ts` de
 * le faire. Remapper l'action sur une vraie touche marche quand meme.
 */
export const TOUCHE_CARACTERE_QUESTION = "QUESTION";

/**
 * Tout ce qui se joue au clavier, dans l'ordre d'apprentissage.
 *
 * ⚠️ **`rompez` est passe de ECHAP a `O` le 21 septembre 2026**, pour rendre
 * ECHAP a la pause — qui n'existait pas. Rompez reste par ailleurs une ligne du
 * menu d'ordres, donc accessible sans clavier.
 */
export const ACTIONS: readonly ActionClavier[] = [
  // ---------------------------------------------------------- se deplacer
  { id: "haut", nom: "Monter", categorie: "deplacer", defaut: "Z", alias: ["UP"] },
  { id: "gauche", nom: "Aller a gauche", categorie: "deplacer", defaut: "Q", alias: ["LEFT"] },
  { id: "bas", nom: "Descendre", categorie: "deplacer", defaut: "S", alias: ["DOWN"] },
  { id: "droite", nom: "Aller a droite", categorie: "deplacer", defaut: "D", alias: ["RIGHT"] },

  // ------------------------------------------------------------ se battre
  // ESPACE en plus du 1 : sur AZERTY la rangee des chiffres demande Maj.
  { id: "capacite1", nom: "Capacite 1", categorie: "battre", defaut: "ONE", alias: ["NUMPAD_ONE", "SPACE"] },
  { id: "capacite2", nom: "Capacite 2", categorie: "battre", defaut: "TWO", alias: ["NUMPAD_TWO"] },
  { id: "capacite3", nom: "Capacite 3", categorie: "battre", defaut: "THREE", alias: ["NUMPAD_THREE"] },
  { id: "capacite4", nom: "Capacite 4", categorie: "battre", defaut: "FOUR", alias: ["NUMPAD_FOUR"] },
  { id: "capacite5", nom: "Capacite 5", categorie: "battre", defaut: "FIVE", alias: ["NUMPAD_FIVE"] },
  { id: "capacite6", nom: "Capacite 6", categorie: "battre", defaut: "SIX", alias: ["NUMPAD_SIX"] },
  { id: "capacite7", nom: "Capacite 7", categorie: "battre", defaut: "SEVEN", alias: ["NUMPAD_SEVEN"] },
  // A et E encadrent ZQSD : on change de heros sans lacher les deplacements.
  { id: "heroPrecedent", nom: "Heros precedent", categorie: "battre", defaut: "A" },
  { id: "heroSuivant", nom: "Heros suivant", categorie: "battre", defaut: "E" },

  // ------------------------------------------------------------ commander
  { id: "commandement", nom: "Mode commandement", categorie: "commander", defaut: "TAB" },
  { id: "temporiser", nom: "Posture : temporiser", categorie: "commander", defaut: "W" },
  { id: "agressif", nom: "Posture : agressif", categorie: "commander", defaut: "X" },
  { id: "repli", nom: "Posture : repli", categorie: "commander", defaut: "C" },
  { id: "formation", nom: "Changer de formation", categorie: "commander", defaut: "V" },
  { id: "rompez", nom: "Rompez", categorie: "commander", defaut: "O" },
  { id: "cloche", nom: "La cloche : tout le monde rentre", categorie: "commander", defaut: "B" },

  // ---------------------------------------------------------------- batir
  { id: "amenagement", nom: "Mode amenagement", categorie: "batir", defaut: "M" },
  { id: "palissade", nom: "Poser une palissade", categorie: "batir", defaut: "G" },
  { id: "tour", nom: "Poser une tour", categorie: "batir", defaut: "H" },
  { id: "champ", nom: "Poser un champ", categorie: "batir", defaut: "J" },
  { id: "porte", nom: "Poser une porte", categorie: "batir", defaut: "K" },
  { id: "maison", nom: "Poser une maison", categorie: "batir", defaut: "L" },
  { id: "douve", nom: "Creuser une douve", categorie: "batir", defaut: "N" },
  { id: "cour", nom: "La cour d'entrainement", categorie: "batir", defaut: "U" },
  { id: "monterTour", nom: "Monter dans une tour", categorie: "batir", defaut: "T" },

  // -------------------------------------------------------------- village
  { id: "village", nom: "Le tableau du village", categorie: "village", defaut: "F" },
  { id: "eglise", nom: "L'eglise", categorie: "village", defaut: "Y" },
  { id: "port", nom: "Le port", categorie: "village", defaut: "P" },
  { id: "aide", nom: "Deplier l'aide", categorie: "village", defaut: TOUCHE_CARACTERE_QUESTION },
  { id: "pause", nom: "Pause et options", categorie: "village", defaut: "ESC" },
] as const;

export type Mappage = Record<string, string>;

const PAR_ID = new Map(ACTIONS.map((a) => [a.id, a]));

export function actionParId(id: string): ActionClavier | undefined {
  return PAR_ID.get(id);
}

/** Les actions d'une categorie, dans l'ordre de la table. */
export function actionsDe(categorie: CategorieTouche): ActionClavier[] {
  return ACTIONS.filter((a) => a.categorie === categorie);
}

export function mappageParDefaut(): Mappage {
  const m: Mappage = {};
  for (const a of ACTIONS) m[a.id] = a.defaut;
  return m;
}

/** Quelle action tient cette touche **en principale**, s'il y en a une. */
export function proprietaire(mappage: Mappage, touche: string): string | null {
  for (const [id, t] of Object.entries(mappage)) if (t === touche) return id;
  return null;
}

/** Quelle action tient cette touche **en alias** : on ne la lui prend pas. */
export function aliasDe(touche: string): string | null {
  for (const a of ACTIONS) if (a.alias?.includes(touche)) return a.id;
  return null;
}

export type Assignation =
  /** La touche etait libre : l'action l'a prise, l'ancienne est rendue */
  | { resultat: "pose"; mappage: Mappage }
  /** Une autre action la tenait : les deux ont echange leur touche */
  | { resultat: "echange"; mappage: Mappage; avec: string }
  /** Rien n'a bouge : un alias fixe la tient deja */
  | { resultat: "refus"; mappage: Mappage; avec: string }
  /** Rien n'a bouge : c'est deja la touche de cette action */
  | { resultat: "inchange"; mappage: Mappage };

/**
 * Pose une touche sur une action.
 *
 * **L'echange est la regle**, et c'est ce qui garantit l'invariant du fichier :
 * aucune action ne se retrouve jamais sans touche. Un alias fixe, lui, ne
 * s'echange pas — il appartient a une action par construction — donc on refuse
 * et on dit laquelle.
 */
export function assigner(mappage: Mappage, id: string, touche: string): Assignation {
  if (!PAR_ID.has(id)) return { resultat: "inchange", mappage };
  if (mappage[id] === touche) return { resultat: "inchange", mappage };

  const gene = aliasDe(touche);
  if (gene !== null && gene !== id) return { resultat: "refus", mappage, avec: gene };

  const ancienne = mappage[id] ?? PAR_ID.get(id)!.defaut;
  const tenant = proprietaire(mappage, touche);

  const suite: Mappage = { ...mappage, [id]: touche };
  if (tenant !== null && tenant !== id) {
    suite[tenant] = ancienne;
    return { resultat: "echange", mappage: suite, avec: tenant };
  }
  return { resultat: "pose", mappage: suite };
}

/**
 * Relit un mappage enregistre, en se mefiant de tout.
 *
 * Le defaut sert de base : une action ajoutee depuis le dernier enregistrement
 * arrive donc avec sa touche, et une action supprimee disparait. Une valeur qui
 * n'est pas une chaine, ou un doublon, est ignoree — un fichier de reglages
 * abime ne doit pas rendre le jeu injouable.
 */
export function fusionner(lu: unknown): Mappage {
  const base = mappageParDefaut();
  if (typeof lu !== "object" || lu === null) return base;

  const brut = lu as Record<string, unknown>;
  let mappage = base;
  for (const a of ACTIONS) {
    const touche = brut[a.id];
    if (typeof touche !== "string" || touche.length === 0) continue;
    const pose = assigner(mappage, a.id, touche);
    mappage = pose.mappage;
  }
  return mappage;
}

/** Ce qu'on enregistre : uniquement ce qui differe du defaut. */
export function serialiser(mappage: Mappage): Record<string, string> {
  const change: Record<string, string> = {};
  for (const a of ACTIONS) {
    const touche = mappage[a.id];
    if (touche !== undefined && touche !== a.defaut) change[a.id] = touche;
  }
  return change;
}

/** Vrai si rien n'a ete touche : le bouton « tout remettre » s'eteint. */
export function estParDefaut(mappage: Mappage): boolean {
  return Object.keys(serialiser(mappage)).length === 0;
}

/**
 * Les noms de touche, tels qu'on les ecrit a l'ecran.
 *
 * Seuls les cas ou le nom de `KeyCodes` ne se lit pas sont ici ; tout le reste
 * s'affiche tel quel, ce qui evite une table de cent lignes a tenir a jour.
 */
const ECRITURES: Record<string, string> = {
  ESC: "ECHAP",
  SPACE: "ESPACE",
  TAB: "TAB",
  UP: "HAUT",
  DOWN: "BAS",
  LEFT: "GAUCHE",
  RIGHT: "DROITE",
  ONE: "1",
  TWO: "2",
  THREE: "3",
  FOUR: "4",
  FIVE: "5",
  SIX: "6",
  SEVEN: "7",
  EIGHT: "8",
  NINE: "9",
  ZERO: "0",
  NUMPAD_ONE: "PAVE 1",
  NUMPAD_TWO: "PAVE 2",
  NUMPAD_THREE: "PAVE 3",
  NUMPAD_FOUR: "PAVE 4",
  NUMPAD_FIVE: "PAVE 5",
  NUMPAD_SIX: "PAVE 6",
  NUMPAD_SEVEN: "PAVE 7",
  BACKSPACE: "RETOUR",
  ENTER: "ENTREE",
  SHIFT: "MAJ",
  CTRL: "CTRL",
  ALT: "ALT",
  OPEN_BRACKET: "[",
  CLOSED_BRACKET: "]",
  SEMICOLON: ";",
  COMMA: ",",
  PERIOD: ".",
  MINUS: "-",
  PLUS: "+",
  [TOUCHE_CARACTERE_QUESTION]: "?",
};

export function ecrireTouche(touche: string): string {
  return ECRITURES[touche] ?? touche;
}

/** La touche d'une action, ecrite pour l'ecran. */
export function ecrireAction(mappage: Mappage, id: string): string {
  const touche = mappage[id] ?? PAR_ID.get(id)?.defaut ?? "";
  return ecrireTouche(touche);
}

/**
 * La meme, pour la ligne d'aide repliee : **la principale et ESPACE**.
 *
 * ⚠️ Vu en capture le 21 septembre 2026. La ligne du bas annoncait « ESPACE
 * capacite » ; le jour ou elle s'est mise a lire le mappage, elle est passee a
 * « 1 capacite » — vrai, mais moins utile : sur un clavier AZERTY, le 1 demande
 * Maj et ESPACE non. Les deux marchent, la ligne dit les deux.
 */
export function ecrireActionCourte(mappage: Mappage, id: string): string {
  const principale = ecrireAction(mappage, id);
  const alias = PAR_ID.get(id)?.alias ?? [];
  if (!alias.includes("SPACE") || mappage[id] === "SPACE") return principale;
  return `${principale}/${ecrireTouche("SPACE")}`;
}
