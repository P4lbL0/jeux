/**
 * La marche : on parait loin, on marche, et quelqu'un vient parler a la porte
 * (DESIGN.md §4.29, jalon 5.5 — tranche le 20 septembre 2026 au soir).
 *
 * Le §4.29 renverse le debut du jeu. On ne s'installait pas : on apparaissait
 * deja installe, au centre d'un village qui etait deja le notre. Desormais on
 * **arrive** — seul, par un bord de la carte —, on marche vers la seule fumee
 * de l'horizon, et **c'est le village qui pose sa question** : veux-tu nous
 * proteger ?
 *
 * Ce fichier porte les trois choses qui se calculent sans Phaser :
 *
 * 1. **Ou l'on parait** (`ouLonParait`) : le point le plus loin du village sur
 *    le premier front du monde — celui que le §4.6 range deja comme « le plus
 *    loin ». C'est une regle, pas un tirage : une graine, un monde, et une
 *    meme arrivee.
 * 2. **Le cap** (`capVers`) : dans quelle direction est ce qu'on cherche, pour
 *    pouvoir l'annoncer en une phrase. La minimap a ete ecartee (§4.10) —
 *    chercher fait partie du jeu, on ne donne qu'une direction.
 * 3. **Ce que dit celui qui tient la porte** (`paroleDuGardien`) : ce qui s'est
 *    passe, combien ils sont, ce qui tient encore, ce qui rode, et sa question.
 *
 * ⚠️ **Il ne dit que ce qui se voit de loin** (§4.29, §4.18 dans l'autre sens) :
 * le terrain, la taille, les defenses debout, les gens dehors. **Jamais** les
 * maladies, le stress ni les reserves. Un village qui tait son epidemie est
 * dans son role — c'est exactement ce que fait un arrivant a notre porte.
 */

import { NOMS_FRONT, type Cote, type Monde, type Point } from "./carte";
import { estTerreFermeDans } from "./monde";
import type { Rng } from "./rng";

export const REGLAGES_MARCHE = {
  /**
   * A quelle distance d'une porte on est vu, en pixels du monde.
   *
   * Dix cases : assez loin pour qu'on voie quelqu'un sortir et venir vers
   * nous — c'est le plan qu'on veut, pas une fenetre qui s'ouvre au contact.
   */
  vue: 320,
  /**
   * Ou il s'arrete devant nous. Deux cases : on se parle, on ne se touche pas.
   */
  parole: 64,
  /**
   * Sa vitesse en venant.
   *
   * Un peu plus vive que celle d'un habitant qui va au travail (74) : il ne va
   * pas a la mine, il va voir qui se tient devant son mur. Mesure en jeu — a
   * 74 l'attente depassait la dizaine de secondes quand il venait du fond du
   * village.
   */
  vitesse: 96,
  /**
   * Combien de fois plus loin est le village suivant, a chaque refus (§4.29).
   *
   * ⚠️ **Pas encore applique** : il faudrait que le monde se genere devant le
   * joueur, et la carte se peint aujourd'hui d'un seul bloc (voir la mesure de
   * `TAILLE_JOUABLE`). Le chiffre est pose ici pour que la regle vive au meme
   * endroit que le reste de la marche le jour ou elle se code.
   */
  eloignementParRefus: 2,
};

/**
 * A quelle distance d'un bord la camera peut encore centrer quelqu'un.
 *
 * Au zoom d'entree (3,4) la fenetre ne montre que 376 pixels de monde : un
 * heros pose a quarante pixels d'un angle finit colle dans le coin de l'ecran,
 * derriere les panneaux — vu en capture. On rentre donc un peu dans les terres
 * avant de le poser.
 */
const RECUL_DU_BORD = 230;

/** Jusqu'ou on accepte de rentrer pour trouver cette place. */
const RECUL_MAXIMUM = 360;

/**
 * Ou l'on parait, et par quel bord.
 *
 * Le premier front du monde est **le plus loin du village** (§4.6) : c'est lui
 * qu'on prend, et dessus le point qui s'en eloigne le plus. Les bords d'un
 * monde ne contiennent que de la terre ferme reliee au village (`monde.ts`) :
 * on ne parait donc jamais dans l'eau, ni derriere un lac qu'on ne pourrait
 * pas contourner.
 *
 * Puis on avance de quelques pas vers le village, tant que le sol porte, pour
 * que la camera puisse nous cadrer (voir `RECUL_DU_BORD`).
 */
export function ouLonParait(m: Monde): { point: Point; cote: Cote } {
  const cote = m.fronts[0] ?? "nord";
  const points = m.bords[cote]!.length > 0 ? m.bords[cote]! : premierBordGarni(m);
  if (points.length === 0) return { point: { x: m.largeur / 2, y: 40 }, cote };

  let choisi = points[0]!;
  let loin = -1;
  for (const p of points) {
    const d = Math.hypot(p.x - m.village.x, p.y - m.village.y);
    if (d > loin) {
      loin = d;
      choisi = p;
    }
  }
  return { point: rentrerDansLesTerres(m, choisi), cote };
}

/** A combien du bord de carte le plus proche. */
function distanceAuBord(m: Monde, p: Point): number {
  return Math.min(p.x, p.y, m.largeur - p.x, m.hauteur - p.y);
}

/**
 * Quelques pas vers le village, en gardant toujours le dernier point qui porte.
 *
 * On s'arrete des qu'on est assez loin de tous les bords, ou des que le sol ne
 * porte plus : mieux vaut paraitre dans un coin que dans l'eau.
 */
function rentrerDansLesTerres(m: Monde, bord: Point): Point {
  const dx = m.village.x - bord.x;
  const dy = m.village.y - bord.y;
  const n = Math.hypot(dx, dy) || 1;
  let garde = { ...bord };
  for (let d = 32; d <= RECUL_MAXIMUM; d += 32) {
    const essai = { x: bord.x + (dx / n) * d, y: bord.y + (dy / n) * d };
    if (!estTerreFermeDans(m, essai.x, essai.y)) break;
    garde = essai;
    if (distanceAuBord(m, garde) >= RECUL_DU_BORD) break;
  }
  return garde;
}

/** Le premier bord qui porte au moins un point, quel que soit le front. */
function premierBordGarni(m: Monde): Point[] {
  for (const f of m.fronts) if (m.bords[f]!.length > 0) return m.bords[f]!;
  return [];
}

/** La longueur de la marche, a vol d'oiseau : de la ou l'on parait au village. */
export function longueurDeLaMarche(m: Monde, depart: Point): number {
  return Math.hypot(depart.x - m.village.x, depart.y - m.village.y);
}

/** Les huit caps, en partant du nord et en tournant par l'est. */
export const CAPS = [
  "au NORD",
  "au NORD-EST",
  "a l'EST",
  "au SUD-EST",
  "au SUD",
  "au SUD-OUEST",
  "a l'OUEST",
  "au NORD-OUEST",
] as const;

/**
 * Dans quelle direction est `a`, vu de `de`.
 *
 * Huit caps, pas quatre : « au sud » quand c'est au sud-ouest ferait tourner
 * le joueur dans le vide pendant une minute, et la minimap qui l'aurait
 * rattrape n'existe pas (§4.10).
 */
export function capVers(de: Point, a: Point): string {
  // L'angle de l'ecran : x vers l'est, y vers le sud. On le fait repartir du
  // nord pour que l'index zero soit le nord.
  const depuisLeNord = (Math.atan2(a.x - de.x, de.y - a.y) + Math.PI * 2) % (Math.PI * 2);
  const i = Math.round(depuisLeNord / (Math.PI / 4)) % 8;
  return CAPS[i]!;
}

/** Ce qu'on annonce en paraissant : on est seul, et il y a de la fumee quelque part. */
export function annonceDArrivee(cap: string): string {
  return `Tu es seul. De la fumee monte ${cap}.`;
}

/**
 * Ce qu'un village montre de lui a quelqu'un qui arrive (§4.29).
 *
 * ⚠️ **Tout ce qui est ici se voit de loin, et rien d'autre.** Ajouter un
 * champ « malades » ou « reserves » a cette interface serait casser la regle
 * du §4.29 : le choix doit rester un pari eclaire, pas un calcul.
 */
export interface VillageVuDeLoin {
  /** Combien de gens vivent encore la */
  habitants: number;
  /** Les pieces d'enceinte encore debout : murs, tours, portes */
  mursDebout: number;
  /** Les pans effondres */
  breches: number;
  /** Un fosse autour ? */
  douves: boolean;
  /** Les bords par lesquels ca vient */
  fronts: readonly Cote[];
}

/**
 * Ce qui leur est arrive. Six versions, tirees a la graine du monde.
 *
 * Aucune ne parle de maladie : ce serait dire ce qui ne se voit pas de loin,
 * et le §4.29 l'interdit. Ce sont toutes des choses qu'un mur casse et un
 * village a moitie vide racontent deja tout seuls.
 */
export const CE_QUI_S_EST_PASSE = [
  "Il y a deux hivers, ils sont venus en nombre. On n'a pas tenu.",
  "Notre Protecteur est tombe a l'automne. Depuis, on compte les nuits.",
  "Le feu a pris pendant un assaut. Le temps de sortir, la moitie brulait.",
  "Le mur a cede d'un coup, une nuit. Ce qui est entre n'a rien laisse debout.",
  "Nos hommes sont partis chercher du secours. Aucun n'est revenu.",
  "On nous a dit d'aller vers la cote. Ceux qui y sont alles, on ne les a plus revus.",
] as const;

const PETITS_NOMBRES = ["personne", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit"];

/** Combien ils sont — et il le dit comme on dit une perte, pas un effectif. */
function combienIlsSont(n: number): string {
  if (n <= 1) return "Je suis le dernier ici.";
  if (n <= 3) return `On est ${PETITS_NOMBRES[n] ?? n}. C'est tout ce qui reste.`;
  if (n <= 8) return `On est ${PETITS_NOMBRES[n] ?? n}, les enfants compris.`;
  return `On est encore ${n}. Ca fait beaucoup de bouches et peu de bras.`;
}

/** Ce qui tient encore : ce que le joueur voit deja, dit par quelqu'un qui y dort. */
function ceQuiTientEncore(vue: VillageVuDeLoin): string {
  if (vue.mursDebout === 0) return "Il ne reste rien du mur. On dort la porte calee.";
  if (vue.breches > vue.mursDebout) return "Le mur est plus troue que debout. On bouche, ca retombe.";
  if (vue.douves) return "Le fosse tient. Le mur, par endroits.";
  return "Le mur tient encore, par endroits.";
}

/** Ce qui rode : les fronts du monde, dits comme une direction de garde. */
function ceQuiRode(fronts: readonly Cote[]): string {
  if (fronts.length === 0) return "On ne sait meme plus par ou ils viennent.";
  if (fronts.length >= 4) return "Ils viennent de partout. Il n'y a plus un cote sur.";
  const ou = fronts.map((f) => NOMS_FRONT[f]).join(" et ");
  if (fronts.length === 1) return `Ils ne peuvent venir que ${ou}. C'est notre seule chance.`;
  return `Ils viennent ${ou}, presque chaque nuit.`;
}

/** Sa question, et elle ne change pas : c'est elle, tout le renversement du §4.29. */
export const QUESTION_DU_GARDIEN = "Veux-tu nous proteger ?";

/**
 * Ce qu'il dit, dans l'ordre : ce qui s'est passe, combien ils sont, ce qui
 * tient, ce qui rode. La question est a part — c'est elle qu'on affiche en
 * gros, au-dessus des deux reponses.
 *
 * Quatre lignes, pas plus : la longueur de ce qu'il raconte est l'un des trois
 * chiffres que le §4.29 laisse a regler en jouant, et on commence court.
 */
export function paroleDuGardien(vue: VillageVuDeLoin, rng: Rng): string[] {
  return [
    rng.pick(CE_QUI_S_EST_PASSE),
    combienIlsSont(vue.habitants),
    ceQuiTientEncore(vue),
    ceQuiRode(vue.fronts),
  ];
}
