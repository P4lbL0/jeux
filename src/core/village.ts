/**
 * Le generateur de villages (DESIGN.md §4.24, §4.30).
 *
 * Jusqu'au 18 septembre 2026, le village etait **dessine a la main** : neuf
 * maisons en couronne autour de l'eglise, et une enceinte en L posee case par
 * case dans la scene. Angelos l'a refuse sur image — « les maisons en cercle,
 * ce n'est pas du Clash of Clans, et tous les villages ne doivent pas etre
 * identiques ». D'ou ce fichier : **une graine, un village**.
 *
 * Ce qu'il decide, et dans cet ordre :
 *
 * 1. **La forme.** Deux ou trois rectangles qui se chevauchent autour de
 *    l'eglise ; leur reunion est la place, et son bord est l'enceinte. C'est ce
 *    qui donne des L, des T, des bastions — jamais un cercle, jamais deux fois
 *    la meme silhouette.
 * 2. **Le terrain.** Un mur ne tient que sur l'herbe : la mer et la foret
 *    gardent deja leurs flancs (§4.6), on ne mure pas ce qui est deja ferme. Un
 *    mur qui arrive a la plage la traverse jusqu'a l'eau, sinon les monstres du
 *    nord contourneraient par le sable.
 * 3. **Les tours**, a chaque angle saillant et a chaque bout de mur, plus une
 *    au milieu des longs pans. Un angle rentrant reste un mur : une tour a
 *    chaque coude fait une forteresse, pas un village.
 * 4. **Les portes**, la ou l'on sort travailler : on tire un trait de l'eglise
 *    a chaque poste (§4.18) et la porte est la ou il croise le mur. Un mur sans
 *    porte en recoit une au milieu (§4.24 : une enceinte a toujours une porte).
 * 5. **Les breches** : le village est en ruine (§4.6), une ou deux par pan.
 * 6. **Les maisons**, serrees autour de la place et le long des rues qui vont
 *    de l'eglise aux portes. Jamais sur la rue, jamais contre l'eglise, jamais
 *    trois a la file.
 *
 * Il ne connait pas Phaser. Il lit la grille pour le terrain et rend un
 * **plan** ; c'est la scene qui pose les images et les corps.
 */

import { PORT, POSTES, type Point, type Terrain } from "./carte";
import type { TypeConstruction } from "./constructions";
import { CASE, Grille } from "./grille";
import { Rng } from "./rng";

/** Une case de la grille, par ses coordonnees. */
export interface CasePlan {
  colonne: number;
  ligne: number;
}

/** Ce qu'une case de l'enceinte porte au depart : une construction, ou ce qu'il en reste. */
export type PieceEnceinte = TypeConstruction | "ruine";

export interface MurPlan extends CasePlan {
  piece: PieceEnceinte;
}

export interface MaisonPlan extends CasePlan {
  /** Un tirage dans [0, 1) : c'est le dessin qui choisit la variante */
  variante: number;
  /** La seule ferme du village (§4.30) */
  ferme: boolean;
  /**
   * Debout au depart, ou en ruine. Le village demarre en ruines (§4.6, §4.24) :
   * trois maisons debout pour trois habitants, les plus pres de l'eglise, et
   * des decombres autour, que le joueur releve ou demolit.
   */
  debout: boolean;
}

/** Combien de maisons sont debout quand on arrive : une par habitant du depart. */
export const MAISONS_DEBOUT_AU_DEPART = 3;

export interface PlanVillage {
  graine: number;
  /** La case de l'eglise */
  centre: CasePlan;
  enceinte: MurPlan[];
  /** Le coin haut-gauche de chaque emprise de 2 x 2 */
  maisons: MaisonPlan[];
  /**
   * Toutes les cases de la place, enceinte comprise, plus une case de marge :
   * rien n'y pousse. Clefs `colonne,ligne`.
   */
  emprise: Set<string>;
}

export const cleCase = (colonne: number, ligne: number): string => `${colonne},${ligne}`;

/**
 * Les bornes de la forme, en cases depuis l'eglise.
 *
 * - **Au moins 5** de chaque cote. L'eglise imposait trois cases libres autour
 *   d'elle (§4.24) ; la regle est passee a deux le 19 septembre 2026, mais la
 *   forme validee sur captures le 18 ne bouge pas — decision d'Angelos. Une
 *   partie reprise rebatit l'enceinte avec la regle de pose : ce 5 y satisfait.
 * - **Au plus 7 a l'est** : les champs sont a huit cases de l'eglise (§4.18),
 *   et ils doivent rester dehors — le ble se paie en risque.
 * - **Quatre au sud, toujours** : la foret commence a deux cases, le mur y
 *   serait toujours dans les arbres. La place s'y enfonce juste assez pour que
 *   quelques maisons bordent la lisiere, comme avant.
 * - L'ouest compte peu : la mer est a cinq cases, et le terrain mange ce qui
 *   depasse.
 */
const PORTEE = {
  nord: { min: 5, max: 7 },
  sud: { min: 4, max: 4 },
  est: { min: 5, max: 7 },
  ouest: { min: 5, max: 7 },
};
/** Un bastion s'avance d'autant, et jamais moins : a une case, deux tours se touchent. */
const PROFONDEUR_BASTION = { min: 2, max: 3 };

/** En deca, un bout de mur isole par le terrain n'est qu'un moignon : on l'enleve. */
const PLUS_PETIT_PAN = 4;
/** Un pan droit plus long que ca recoit une tour au milieu. */
const PAN_SANS_TOUR = 10;
/** Deux portes sur le meme pan ne sont jamais plus proches que ca. */
const ECART_ENTRE_PORTES = 4;

const MAISONS_MIN = 12;
const MAISONS_MAX = 15;
/**
 * Une maison se tient a une case au moins de l'emprise de l'eglise : c'est le
 * parvis. Trois cases depuis la case centrale, l'emprise en prenant une.
 */
const MARGE_EGLISE = 3;
/**
 * Deux emprises qui se touchent, c'est la regle plus que l'exception : le
 * jardin de l'emprise ecarte deja les toits, et des maisons trop separees « ne
 * font pas village » (Angelos, 18 septembre 2026). Trois a la file, jamais —
 * ce serait une rangee, donc un lotissement.
 */
const CHANCE_DE_SE_TOUCHER = 0.85;
/** Une maison prefere etre pres de l'eglise : le village se serre autour de sa place. */
const PORTEE_DU_COEUR = 4;
/** Une maison dans les arbres, c'est possible, mais l'herbe passe avant. */
const PENALITE_SOUS_BOIS = 0.3;
/** Trois maisons collees a la file, c'est une rangee : on refuse la troisieme. */
const PORTEE_RANGEE = 2;
/** Au-dela, la maison serait cernee : deux voisines qui la touchent, pas trois. */
const VOISINES_QUI_TOUCHENT = 2;

/** Ce sur quoi un mur tient de lui-meme. */
const SOL_DES_MURS: Terrain[] = ["herbe"];
/** Ce que le mur traverse pour aller jusqu'a l'eau. */
const SOL_DE_LA_JETEE: Terrain[] = ["sable"];
/** Ce sur quoi on pose une maison : tout ce qui porte, la lisiere comprise. */
const SOL_DES_MAISONS: Terrain[] = ["herbe", "sable", "sous-bois"];

interface Rectangle {
  c0: number;
  c1: number;
  l0: number;
  l1: number;
}

/** Nord, est, sud, ouest. */
const VOISINES: readonly (readonly [number, number])[] = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

// ------------------------------------------------------------------ la forme

/**
 * Deux ou trois rectangles qui se chevauchent : le premier autour de l'eglise,
 * les autres poses sur un de ses cotes, a moitie dedans, a moitie dehors. Leur
 * reunion n'est jamais un simple rectangle, et jamais deux fois la meme.
 */
function tirerLaForme(rng: Rng, centre: CasePlan): Rectangle[] {
  // Le premier rectangle est le coeur du village : c'est la que vont les
  // maisons. Les suivants sont des bastions — de la place pour se battre.
  const principal: Rectangle = {
    c0: centre.colonne - rng.int(PORTEE.ouest.min, PORTEE.ouest.max),
    c1: centre.colonne + rng.int(PORTEE.est.min, PORTEE.est.max),
    l0: centre.ligne - rng.int(PORTEE.nord.min, PORTEE.nord.max),
    l1: centre.ligne + rng.int(PORTEE.sud.min, PORTEE.sud.max),
  };
  const rectangles = [principal];

  // Les cotes qui peuvent porter un bastion : le nord et l'est, la ou le
  // terrain laisse de la place. Au sud et a l'ouest, la foret et la mer le
  // mangeraient. Parfois aucun : un rectangle nu est une forme aussi.
  const tirage = rng.next();
  const cotes: ("nord" | "est")[] =
    tirage < 0.35 ? ["nord", "est"] : tirage < 0.6 ? ["nord"] : tirage < 0.85 ? ["est"] : [];
  for (const cote of cotes) {
    // Toute sa profondeur ou rien : rogne par une borne, un bastion d'une
    // case met l'angle rentrant et l'angle sortant en diagonale, et ca fait
    // deux tours collees.
    const profondeur = rng.int(PROFONDEUR_BASTION.min, PROFONDEUR_BASTION.max);
    // Le bastion prend entre le tiers et les deux tiers du cote, jamais tout,
    // et s'arrete a deux cases des angles — sinon deux tours se touchent.
    if (cote === "nord") {
      // Le nord a de la place : un bastion peut depasser la borne d'un mur nu.
      const debut = principal.c0 + 2;
      const fin = principal.c1 - 2;
      const taille = Math.max(4, Math.round((fin - debut + 1) * rng.range(0.35, 0.6)));
      const depart = rng.int(debut, Math.max(debut, fin - taille + 1));
      rectangles.push({
        c0: depart,
        c1: Math.min(fin, depart + taille - 1),
        l0: principal.l0 - profondeur,
        l1: centre.ligne,
      });
    } else {
      // A l'est, les champs bornent : pas de place, pas de bastion. Et il
      // reste sur l'herbe — au-dela de la ligne de l'eglise, c'est la foret.
      if (principal.c1 + profondeur > centre.colonne + PORTEE.est.max) continue;
      const debut = principal.l0 + 2;
      const fin = centre.ligne + 1;
      const taille = Math.max(4, Math.round((fin - debut + 1) * rng.range(0.4, 0.7)));
      const depart = rng.int(debut, Math.max(debut, fin - taille + 1));
      rectangles.push({
        c0: centre.colonne,
        c1: principal.c1 + profondeur,
        l0: depart,
        l1: Math.min(fin, depart + taille - 1),
      });
    }
  }
  return rectangles;
}

function reunion(rectangles: Rectangle[]): Set<string> {
  const cases = new Set<string>();
  for (const r of rectangles) {
    for (let l = r.l0; l <= r.l1; l++) {
      for (let c = r.c0; c <= r.c1; c++) cases.add(cleCase(c, l));
    }
  }
  return cases;
}

/** Le bord de la reunion : les cases qui touchent l'exterieur, coins compris. */
function bordDe(place: Set<string>): Map<string, CasePlan> {
  const bord = new Map<string, CasePlan>();
  for (const clef of place) {
    const [c, l] = clef.split(",").map(Number) as [number, number];
    let expose = false;
    for (let dl = -1; dl <= 1 && !expose; dl++) {
      for (let dc = -1; dc <= 1; dc++) {
        if ((dc !== 0 || dl !== 0) && !place.has(cleCase(c + dc, l + dl))) {
          expose = true;
          break;
        }
      }
    }
    if (expose) bord.set(clef, { colonne: c, ligne: l });
  }
  return bord;
}

// ---------------------------------------------------------------- le terrain

function terrainDe(grille: Grille, c: number, l: number): Terrain | null {
  return grille.case(c, l)?.terrain ?? null;
}

function tientUnMur(grille: Grille, c: number, l: number, sols: Terrain[]): boolean {
  const terrain = terrainDe(grille, c, l);
  if (terrain === null || !sols.includes(terrain)) return false;
  const centre = Grille.centreCase(c, l);
  return grille.constructible(centre.x, centre.y);
}

/** Nord, est, sud, ouest : y a-t-il un mur ? */
function voisinesMur(murs: Map<string, CasePlan>, c: number, l: number): [boolean, boolean, boolean, boolean] {
  const [nord, est, sud, ouest] = VOISINES.map(([dc, dl]) => murs.has(cleCase(c + dc, l + dl)));
  return [nord!, est!, sud!, ouest!];
}

/** Les composantes connexes (a quatre voisines) d'un ensemble de cases. */
function composantes(murs: Map<string, CasePlan>): CasePlan[][] {
  const vues = new Set<string>();
  const resultat: CasePlan[][] = [];
  for (const [clef, depart] of murs) {
    if (vues.has(clef)) continue;
    const composante: CasePlan[] = [];
    const pile = [depart];
    vues.add(clef);
    while (pile.length > 0) {
      const courante = pile.pop()!;
      composante.push(courante);
      for (const [dc, dl] of VOISINES) {
        const k = cleCase(courante.colonne + dc, courante.ligne + dl);
        const voisine = murs.get(k);
        if (voisine && !vues.has(k)) {
          vues.add(k);
          pile.push(voisine);
        }
      }
    }
    resultat.push(composante);
  }
  return resultat;
}

/**
 * Ne garde de l'enceinte que ce qui tient sur l'herbe, prolonge les bouts qui
 * arrivent au sable jusqu'a l'eau, et jette les moignons.
 */
function plierAuTerrain(grille: Grille, bord: Map<string, CasePlan>): Map<string, CasePlan> {
  const murs = new Map<string, CasePlan>();
  for (const [clef, c] of bord) {
    if (tientUnMur(grille, c.colonne, c.ligne, SOL_DES_MURS)) murs.set(clef, c);
  }

  // La jetee : un bout de mur dont la suite est du sable continue jusqu'a ce
  // que le sol ne porte plus. C'est la plage du nord, et c'est par la que les
  // monstres passeraient sinon.
  for (const c of [...murs.values()]) {
    const voisines = voisinesMur(murs, c.colonne, c.ligne);
    if (voisines.filter(Boolean).length !== 1) continue;
    const dans = voisines.indexOf(true);
    // On prolonge a l'oppose de la seule voisine.
    const [dc, dl] = VOISINES[(dans + 2) % 4]!;
    let colonne = c.colonne + dc;
    let ligne = c.ligne + dl;
    while (tientUnMur(grille, colonne, ligne, SOL_DE_LA_JETEE) && !murs.has(cleCase(colonne, ligne))) {
      murs.set(cleCase(colonne, ligne), { colonne, ligne });
      colonne += dc;
      ligne += dl;
    }
  }

  const garde = new Map<string, CasePlan>();
  for (const composante of composantes(murs)) {
    if (composante.length < PLUS_PETIT_PAN) continue;
    for (const c of composante) garde.set(cleCase(c.colonne, c.ligne), c);
  }
  return garde;
}

// --------------------------------------------------------------- les pieces

/**
 * Suit un pan de mur de bout en bout et rend ses cases dans l'ordre. Une
 * enceinte fermee n'a pas de bout : on part de n'importe ou.
 */
function enfiler(composante: CasePlan[], murs: Map<string, CasePlan>): CasePlan[] {
  const bouts = composante.filter((c) => voisinesMur(murs, c.colonne, c.ligne).filter(Boolean).length === 1);
  const depart = bouts[0] ?? composante[0]!;
  const ordre: CasePlan[] = [depart];
  const vues = new Set<string>([cleCase(depart.colonne, depart.ligne)]);
  let courante = depart;
  for (;;) {
    let suivante: CasePlan | null = null;
    for (const [dc, dl] of VOISINES) {
      const k = cleCase(courante.colonne + dc, courante.ligne + dl);
      if (murs.has(k) && !vues.has(k)) {
        suivante = murs.get(k)!;
        break;
      }
    }
    if (!suivante) break;
    vues.add(cleCase(suivante.colonne, suivante.ligne));
    ordre.push(suivante);
    courante = suivante;
  }
  return ordre;
}

/** Une case droite : deux voisines, face a face. C'est la qu'on perce. */
function estDroite(murs: Map<string, CasePlan>, c: CasePlan): boolean {
  const v = voisinesMur(murs, c.colonne, c.ligne);
  return (v[0] && v[2] && !v[1] && !v[3]) || (v[1] && v[3] && !v[0] && !v[2]);
}

/**
 * Le premier mur que croise le trait de l'eglise a un point. En pas de huit
 * pixels, ce qui ne peut pas sauter une case de trente-deux.
 */
function premierMurVers(murs: Map<string, CasePlan>, depuis: Point, vers: Point): CasePlan | null {
  const longueur = Math.hypot(vers.x - depuis.x, vers.y - depuis.y);
  const pas = 8;
  for (let d = 0; d <= longueur; d += pas) {
    const x = depuis.x + ((vers.x - depuis.x) * d) / longueur;
    const y = depuis.y + ((vers.y - depuis.y) * d) / longueur;
    const trouve = murs.get(cleCase(Math.floor(x / CASE), Math.floor(y / CASE)));
    if (trouve) return trouve;
  }
  return null;
}

function distanceCases(a: CasePlan, b: CasePlan): number {
  return Math.max(Math.abs(a.colonne - b.colonne), Math.abs(a.ligne - b.ligne));
}

/**
 * Tours, portes et breches, pan par pan.
 *
 * @param sorties les points vers lesquels on sort du village : c'est la que
 *        vont les portes.
 */
function garnir(
  rng: Rng,
  murs: Map<string, CasePlan>,
  place: Set<string>,
  centre: Point,
  sorties: Point[],
): MurPlan[] {
  const pieces = new Map<string, PieceEnceinte>();
  for (const clef of murs.keys()) pieces.set(clef, "palissade");
  const poser = (c: CasePlan, piece: PieceEnceinte) => pieces.set(cleCase(c.colonne, c.ligne), piece);
  const pieceDe = (c: CasePlan) => pieces.get(cleCase(c.colonne, c.ligne));

  // Les tours : chaque bout, et chaque angle **saillant** — celui dont la
  // diagonale interieure est dans la place. Un angle rentrant, c'est le creux
  // d'un bastion : deux pans qui se raccordent suffisent.
  for (const c of murs.values()) {
    if (estDroite(murs, c)) continue;
    const [nord, est, sud, ouest] = voisinesMur(murs, c.colonne, c.ligne);
    const angle = [nord, est, sud, ouest].filter(Boolean).length === 2;
    if (!angle) {
      poser(c, "tour");
      continue;
    }
    const dc = est ? 1 : -1;
    const dl = sud ? 1 : -1;
    const rentrant = !place.has(cleCase(c.colonne + dc, c.ligne + dl));
    if (!rentrant) poser(c, "tour");
  }

  const pans = composantes(murs).map((composante) => enfiler(composante, murs));

  // Une tour au milieu des longs pans droits, pour le rythme. Chaque troncon
  // entre deux tours est coupe en parts egales : compter les cases en marchant
  // posait une tour a deux cases de l'angle suivant.
  for (const pan of pans) {
    const troncons: CasePlan[][] = [[]];
    for (const c of pan) {
      if (pieceDe(c) === "tour") troncons.push([]);
      else troncons[troncons.length - 1]!.push(c);
    }
    for (const troncon of troncons) {
      const parts = Math.floor(troncon.length / (PAN_SANS_TOUR + 1)) + 1;
      for (let i = 1; i < parts; i++) {
        const c = troncon[Math.round((troncon.length * i) / parts)];
        if (c) poser(c, "tour");
      }
    }
  }

  // Les portes, la ou le chemin du travail croise le mur.
  const portes: CasePlan[] = [];
  const percer = (c: CasePlan | null) => {
    if (!c || pieceDe(c) !== "palissade" || !estDroite(murs, c)) return;
    if (portes.some((p) => distanceCases(p, c) < ECART_ENTRE_PORTES)) return;
    portes.push(c);
    poser(c, "porte");
  };
  for (const sortie of sorties) {
    const croisement = premierMurVers(murs, centre, sortie);
    if (!croisement) continue;
    // A deux cases pres, le long du meme pan : les postes ne bougent pas d'une
    // partie a l'autre, et sans ce jeu la porte serait toujours au meme endroit.
    const pan = pans.find((p) => p.some((c) => c.colonne === croisement.colonne && c.ligne === croisement.ligne));
    const autour = (pan ?? [croisement]).filter(
      (c) => distanceCases(c, croisement) <= 2 && pieceDe(c) === "palissade" && estDroite(murs, c),
    );
    percer(autour.length > 0 ? rng.pick(autour) : croisement);
  }

  // Un pan qui n'en a recu aucune en prend une au milieu : une enceinte a
  // toujours une porte (§4.24).
  for (const pan of pans) {
    if (pan.some((c) => pieceDe(c) === "porte")) continue;
    const milieu = Math.floor(pan.length / 2);
    const droites = pan
      .map((c, i) => ({ c, ecart: Math.abs(i - milieu) }))
      .filter(({ c }) => pieceDe(c) === "palissade" && estDroite(murs, c))
      .sort((a, b) => a.ecart - b.ecart);
    if (droites[0]) percer(droites[0].c);
  }

  // Les breches : une par pan, deux sur un long, jamais contre une porte ni une
  // tour ni une autre breche, en une ou deux cases. Plus, et le mur serait plus
  // troue que debout.
  const entourreeDePalissade = (pan: CasePlan[], i: number) => {
    const avant = pan[i - 1];
    const apres = pan[i + 1];
    return (
      avant !== undefined && apres !== undefined && pieceDe(avant) === "palissade" && pieceDe(apres) === "palissade"
    );
  };
  for (const pan of pans) {
    const breches = pan.length >= 12 ? rng.int(1, 2) : 1;
    for (let b = 0; b < breches; b++) {
      const candidates = pan.filter((c, i) => pieceDe(c) === "palissade" && entourreeDePalissade(pan, i));
      if (candidates.length === 0) break;
      const premiere = rng.pick(candidates);
      const i = pan.indexOf(premiere);
      poser(premiere, "ruine");
      const suite = pan[i + 1];
      if (rng.chance(0.5) && suite && pieceDe(suite) === "palissade" && entourreeDePalissade(pan, i + 1)) {
        poser(suite, "ruine");
      }
    }
  }

  return [...murs.values()].map((c) => ({ ...c, piece: pieceDe(c)! }));
}

// --------------------------------------------------------------- les maisons

/** Distance d'un point a un segment, en pixels. */
function distanceAuSegment(p: Point, a: Point, b: Point): number {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const longueur2 = abx * abx + aby * aby;
  const t = longueur2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * abx + (p.y - a.y) * aby) / longueur2));
  return Math.hypot(p.x - (a.x + abx * t), p.y - (a.y + aby * t));
}

/**
 * Une maison de plus ici ferait-elle trois maisons collees a la file ? On
 * regarde depuis chaque maison deja posee sur la meme ligne (ou colonne), pas
 * seulement depuis la candidate : deux maisons a quatre cases l'une de l'autre
 * et une troisieme entre les deux, c'est une rangee vue du milieu.
 */
function feraitUneRangee(maisons: MaisonPlan[], c: number, l: number): boolean {
  const toutes = [...maisons, { colonne: c, ligne: l }];
  for (const axe of ["ligne", "colonne"] as const) {
    const autre = axe === "ligne" ? "colonne" : "ligne";
    const moi = axe === "ligne" ? l : c;
    const alignees = toutes.filter((m) => m[axe] === moi);
    for (const depuis of alignees) {
      const autour = alignees.filter((m) => Math.abs(m[autre] - depuis[autre]) <= PORTEE_RANGEE);
      if (autour.length >= 3) return true;
    }
  }
  return false;
}

/**
 * Les maisons, le long des rues.
 *
 * Une rue va de l'eglise a chaque porte. Une maison prefere en border une, a
 * une ou deux cases, sans jamais etre dessus : c'est ce qui fait qu'on lit des
 * rues au lieu d'un semis. Entre deux maisons, le jardin de l'emprise (§4.30)
 * fait deja l'ecart ; on evite seulement qu'elles se touchent trop souvent.
 */
function loger(
  rng: Rng,
  grille: Grille,
  place: Set<string>,
  coeur: Set<string>,
  murs: Map<string, CasePlan>,
  centre: CasePlan,
  portes: CasePlan[],
): MaisonPlan[] {
  const centrePx = Grille.centreCase(centre.colonne, centre.ligne);
  const rues = portes.map((p) => Grille.centreCase(p.colonne, p.ligne));

  const libre = (c: number, l: number) => {
    // Dans le coeur, jamais dans un bastion ni contre sa bouche : une maison
    // qui bouche un bastion en fait un placard, et il est la pour qu'on s'y batte.
    if (!place.has(cleCase(c, l)) || !coeur.has(cleCase(c, l)) || murs.has(cleCase(c, l))) return false;
    for (const [dc, dl] of VOISINES) {
      const k = cleCase(c + dc, l + dl);
      if (place.has(k) && !coeur.has(k)) return false;
    }
    if (distanceCases({ colonne: c, ligne: l }, centre) < MARGE_EGLISE) return false;
    // Rien contre une porte : c'est un passage, il faut pouvoir le prendre.
    if (portes.some((p) => distanceCases(p, { colonne: c, ligne: l }) <= 1)) return false;
    const terrain = terrainDe(grille, c, l);
    if (terrain === null || !SOL_DES_MAISONS.includes(terrain)) return false;
    const px = Grille.centreCase(c, l);
    return grille.constructible(px.x, px.y);
  };

  // Chaque candidate est une emprise de 2 x 2 dont les quatre cases sont
  // libres. Contre un mur, c'est permis : le sprite est plus court que son
  // emprise, il ne cache pas le pan.
  const candidates: { c: number; l: number; score: number }[] = [];
  for (const clef of place) {
    const [c, l] = clef.split(",").map(Number) as [number, number];
    if (!libre(c, l) || !libre(c + 1, l) || !libre(c, l + 1) || !libre(c + 1, l + 1)) continue;
    const milieu = { x: (c + 1) * CASE, y: (l + 1) * CASE };
    const dansLesArbres = [terrainDe(grille, c, l), terrainDe(grille, c + 1, l), terrainDe(grille, c, l + 1), terrainDe(grille, c + 1, l + 1)].includes("sous-bois");
    const aLaRue = rues.length === 0 ? CASE * 2 : Math.min(...rues.map((r) => distanceAuSegment(milieu, centrePx, r)));
    // Sur la rue, on ne bati pas ; juste a cote, c'est la meilleure place ; loin,
    // c'est possible mais moins probable. Et pres de l'eglise avant loin d'elle :
    // c'est ce qui serre le village autour de sa place au lieu de l'eparpiller.
    // Le bruit casse les alignements.
    if (aLaRue < CASE * 1.5) continue;
    const auCoeur = Math.hypot(c + 0.5 - centre.colonne, l + 0.5 - centre.ligne);
    const score =
      Math.exp(-(aLaRue - CASE * 1.5) / (CASE * 2)) +
      Math.exp(-auCoeur / PORTEE_DU_COEUR) +
      rng.range(0, 0.6) -
      (dansLesArbres ? PENALITE_SOUS_BOIS : 0);
    candidates.push({ c, l, score });
  }
  candidates.sort((a, b) => b.score - a.score);

  const maisons: MaisonPlan[] = [];
  const cible = rng.int(MAISONS_MIN, MAISONS_MAX);
  // Deux passes : la premiere tient les maisons a l'ecart les unes des autres,
  // la seconde ne sert que si la place manque, et laisse alors les emprises se
  // toucher. Le village d'ici est serre entre la mer et la foret.
  for (const serree of [false, true]) {
    for (const candidate of candidates) {
      if (maisons.length >= (serree ? MAISONS_MIN : cible)) break;
      // Jamais deux emprises l'une sur l'autre ; deux qui se touchent, pas trop
      // souvent — le jardin de l'emprise fait deja que les toits ne se collent pas.
      const chevauche = maisons.some((m) => Math.abs(m.colonne - candidate.c) < 2 && Math.abs(m.ligne - candidate.l) < 2);
      if (chevauche) continue;
      const touchees = maisons.filter((m) => Math.abs(m.colonne - candidate.c) < 3 && Math.abs(m.ligne - candidate.l) < 3);
      if (touchees.length > VOISINES_QUI_TOUCHENT) continue;
      if (touchees.length > 0 && !serree && !rng.chance(CHANCE_DE_SE_TOUCHER)) continue;
      // Jamais trois sur la meme ligne ni la meme colonne : c'est un alignement,
      // et un alignement se lit comme un lotissement, quel que soit l'ecart.
      if (feraitUneRangee(maisons, candidate.c, candidate.l)) continue;
      maisons.push({ colonne: candidate.c, ligne: candidate.l, variante: rng.next(), ferme: false, debout: false });
    }
  }

  // Les plus pres de l'eglise tiennent encore debout : le coeur du village a
  // resiste, les ruines sont vers les murs. Lisible, et pareil d'une graine a
  // l'autre.
  [...maisons]
    .sort((a, b) => distanceCases(a, centre) - distanceCases(b, centre))
    .slice(0, MAISONS_DEBOUT_AU_DEPART)
    .forEach((m) => (m.debout = true));

  // La ferme est la maison la plus a l'ecart : c'est la ou il y a de la terre.
  let plusLoin = -1;
  let ferme = -1;
  maisons.forEach((m, i) => {
    const d = distanceCases(m, centre);
    if (d > plusLoin) {
      plusLoin = d;
      ferme = i;
    }
  });
  if (ferme >= 0) maisons[ferme]!.ferme = true;

  return maisons;
}

// ----------------------------------------------------------------- le plan

/**
 * Le village d'une graine.
 *
 * @param grille la grille deja cuite, pour le terrain. **Rien n'y est ecrit** :
 *        c'est la scene qui pose, le plan ne fait que decrire.
 * @param centre la position de l'eglise, en pixels
 * @param sorties ou l'on sort travailler ; par defaut les postes du §4.18 et
 *        le port
 */
export function genererVillage(
  grille: Grille,
  graine: number,
  centre: Point,
  sorties: Point[] = [...POSTES.map((p) => p.position), { x: PORT.x, y: PORT.y }],
): PlanVillage {
  const rng = new Rng(graine);
  const caseCentre = { colonne: grille.colonneDe(centre.x), ligne: grille.ligneDe(centre.y) };

  const forme = tirerLaForme(rng, caseCentre);
  const place = reunion(forme);
  const coeur = reunion(forme.slice(0, 1));
  const murs = plierAuTerrain(grille, bordDe(place));
  const enceinte = garnir(rng, murs, place, centre, sorties);
  const portes = enceinte.filter((m) => m.piece === "porte");
  const maisons = loger(rng, grille, place, coeur, murs, caseCentre, portes);

  const emprise = new Set<string>();
  for (const clef of place) {
    const [c, l] = clef.split(",").map(Number) as [number, number];
    for (let dl = -1; dl <= 1; dl++) {
      for (let dc = -1; dc <= 1; dc++) emprise.add(cleCase(c + dc, l + dl));
    }
  }
  for (const m of murs.values()) {
    for (let dl = -1; dl <= 1; dl++) {
      for (let dc = -1; dc <= 1; dc++) emprise.add(cleCase(m.colonne + dc, m.ligne + dl));
    }
  }

  return { graine, centre: caseCentre, enceinte, maisons, emprise };
}

/** Une graine de village neuve, tiree de l'horloge. */
export function graineDeVillage(maintenant: number = Date.now()): number {
  return maintenant % 1_000_000;
}
