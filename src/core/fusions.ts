import { COULEURS_RANG } from "./classes";
import { auPalier } from "./elements";
import {
  COMPETENCES,
  competenceParId,
  texteDesTags,
  touchesLiberees,
  type CompetenceDef,
  type CompetencesFondues,
  type CompetencesPossedees,
  type IngredientDef,
  type Proposition,
} from "./competences";

/**
 * Les fusions (DESIGN.md §4.25, jalon 6.5, morceau 3).
 *
 * Tranche le 23 septembre 2026 par Angelos :
 *
 * - une fusion se propose quand **tous ses ingredients sont a leur palier
 *   maximum**, au choix de niveau suivant, **en carte a part** a cote des trois
 *   tirees — comme l'heritage d'un mort. Refusee, elle revient au choix d'apres ;
 * - elle se propose aussi sur l'ecran « plus de place », quand elle libere une
 *   touche ;
 * - elle arrive au palier 1 et n'est **jamais moins forte que ses
 *   ingredients** : ils restent tenus, fondus, et continuent d'agir ;
 * - **aucune fusion ne s'affiche avant de se proposer.**
 *
 * Ce fichier ne sait que lire des possessions : aucun Phaser, aucun heros.
 * Les fusions elles-memes sont du contenu, dans `competences.ts`.
 */

/** Toutes les fusions du catalogue. */
export const FUSIONS: readonly CompetenceDef[] = COMPETENCES.filter((c) => c.fusion !== undefined);

/** Ce que l'on sait de ses evolutions : l'identifiant de celle choisie, par competence. */
export type EvolutionsChoisies = Readonly<Record<string, { id: string } | undefined>>;

/** Un ingredient est-il pret : tenu, a son maximum, pas deja fondu, avec l'evolution demandee ? */
export function ingredientPret(
  ingredient: IngredientDef,
  possedees: CompetencesPossedees,
  evolutions: EvolutionsChoisies,
  fondues: Readonly<CompetencesFondues>,
): boolean {
  const def = competenceParId(ingredient.competence);
  if (!def) return false;
  if (fondues[def.id] !== undefined) return false;
  if ((possedees[def.id] ?? 0) < def.paliers.length) return false;
  return ingredient.evolution === undefined || evolutions[def.id]?.id === ingredient.evolution;
}

/**
 * Les fusions qui se proposent a lui maintenant : pas encore prises, tous leurs
 * ingredients prets. Deux fusions qui se disputent un ingredient se proposent
 * toutes les deux ; prendre l'une fait disparaitre l'autre, puisque
 * l'ingredient est fondu.
 */
export function fusionsPossibles(
  possedees: CompetencesPossedees,
  evolutions: EvolutionsChoisies,
  fondues: Readonly<CompetencesFondues>,
): CompetenceDef[] {
  return FUSIONS.filter(
    (f) =>
      (possedees[f.id] ?? 0) === 0 &&
      (f.fusion?.ingredients ?? []).every((i) => ingredientPret(i, possedees, evolutions, fondues)),
  );
}

/** Le nom qu'un ingredient porte sur la carte : son evolution quand elle est exigee. */
function nomDeLIngredient(ingredient: IngredientDef): string {
  const def = competenceParId(ingredient.competence);
  if (!def) return ingredient.competence;
  const evolution = ingredient.evolution
    ? def.evolutions?.options.find((o) => o.id === ingredient.evolution)
    : undefined;
  return `${evolution?.nom ?? def.nom} ${def.paliers.length}`;
}

/** « Epee tournoyante 5 + Aura de flammes 3 » : ce que la fusion consomme. */
export function texteDesIngredients(fusion: CompetenceDef): string {
  return (fusion.fusion?.ingredients ?? []).map(nomDeLIngredient).join(" + ");
}

/**
 * La carte d'une fusion. Elle dit ce qu'elle fait, et a part ce qu'elle
 * coute : les competences qui disparaissent.
 */
export function propositionFusion(fusion: CompetenceDef): Proposition {
  return {
    id: fusion.id,
    nom: fusion.nom,
    description: fusion.description,
    etiquette: `${fusion.rang}  ·  FUSION`,
    couleur: COULEURS_RANG[fusion.rang],
    tags: texteDesTags(fusion.tags),
    fusionne: texteDesIngredients(fusion),
  };
}

/** Les fusions qui liberent une touche : les seules qui repondent a « plus de place ». */
export function fusionsQuiLiberent(fusions: readonly CompetenceDef[]): CompetenceDef[] {
  return fusions.filter((f) => touchesLiberees(f) > 0);
}

/** Ses ingredients, par identifiant de competence. */
export function ingredientsDe(fusion: CompetenceDef): string[] {
  return (fusion.fusion?.ingredients ?? []).map((i) => i.competence);
}

// -------------------------------------------------------------- les reglages

/**
 * Les chiffres des douze fusions, par palier reel (l'indice 0 est le palier 1).
 *
 * ⚠️ **Tranches par le code**, soumis a Angelos dans le Grimoire
 * (https://claude.ai/artifact/MMgy33ybsQJQGEWQpzj2yV) : ils se corrigent ici,
 * d'une ligne, et les textes des paliers dans `competences.ts`.
 */
export const REGLAGES_FUSIONS = {
  soleilDAcier: {
    /** Les epees tournent plus loin, et l'aura va jusqu'a elles (72 px sans la fusion) */
    orbiteEpees: 96,
    rayonAura: 110,
    /** Ce que l'aura brule, fois celle de l'Aura de flammes */
    feu: [1, 1.5, 2],
  },
  moulinALames: {
    rebonds: [3, 4, 5],
    /** Tous les combien une epee part (ms) */
    periode: [3000, 2500, 2000],
    /** Jusqu'ou elle va chercher l'ennemi suivant */
    portee: 150,
    /** Le temps d'un rebond (ms) : ce qui fait qu'on la voit voler */
    parRebond: 90,
    /** Un rebond frappe comme un passage d'epee, fois... */
    degats: 2,
  },
  reseauElectrique: {
    sautsEnPlus: [2, 3, 4],
    portee: [130, 170, 170],
    /** Au dernier palier, un saut ne faiblit plus */
    sansAffaiblissement: [false, false, true],
  },
  satellitesConducteurs: {
    /** Un satellite ne lance un eclair qu'une fois par... (ms) */
    intervalle: [1000, 1000, 500],
    force: [1, 1, 1.5],
  },
  tourbillonInfernal: {
    duree: [4000, 5000, 5000],
    rayon: [120, 120, 140],
    /** L'aura brule tant de fois plus fort pendant qu'il tourne */
    feu: 2,
    /** Il court plus vite pendant */
    vitesse: 1.3,
  },
  forteresseMobile: {
    pv: [180, 260, 360],
    duree: [6000, 8000, 10000],
    /** Le souffle de la Charge sismique, fois... */
    souffle: [1, 1, 1.25],
    rayonDome: 70,
  },
  tempsFracture: {
    /** Ce que chaque mort dans le ralenti rend au Sablier (ms) */
    rendu: [1000, 1500, 2000],
    rayon: [1, 1.25, 1.25],
    /** Duree du ralenti, avant Concentration (ms) — 7 s, celle du Sablier a son maximum */
    duree: [7000, 7000, 9000],
  },
  generalDesMorts: {
    /** Pres du familier, les morts-vivants frappent plus fort */
    rayon: 200,
    degats: [0.3, 0.5, 0.8],
    /** Le familier tombe revient au bout de... (ms) — 12 s sans la fusion */
    retour: [12000, 6000, 6000],
    vie: [1, 1, 2],
  },
  neant: {
    /** Le monde fige, avant Concentration (ms) */
    fige: [4500, 6000],
    /** Le cout de l'Exil, double (tranche le 23 septembre 2026) : 60 s a 1 PV */
    decouvert: 60000,
  },
  berserkerTerminal: {
    /** Ce qu'il perd de vie maximale a chaque aube, pour toujours */
    perteParAube: 0.08,
  },
  revenant: {
    /** En se relevant, il souffle tout autour de lui (palier 2) */
    souffle: [false, true],
    rayonSouffle: 200,
    invulnerable: [2000, 5000],
  },
  exilDesMorts: {
    /** Au plus, les bannis doublent la nuit suivante */
    plafond: 1,
  },
} as const;

/** Le reglage d'un palier reel (1, 2, 3), borne au dernier ecrit : celui des bases elementaires. */
export { auPalier };

/**
 * Combien de bannis reviennent la nuit suivante (Exil des morts) : tous, mais
 * au plus le double de la nuit — une horde de quatre mille bannis d'un coup
 * ne ferait pas une nuit plus dure, elle ferait une autre partie.
 */
export function bannisQuiReviennent(bannis: number, effectifDeLaNuit: number): number {
  return Math.max(0, Math.min(Math.floor(bannis), Math.floor(effectifDeLaNuit * REGLAGES_FUSIONS.exilDesMorts.plafond)));
}

/** Ce qui reste de sa vie maximale au Berserker terminal apres tant d'aubes. */
export function facteurDUsure(aubes: number): number {
  return Math.pow(1 - REGLAGES_FUSIONS.berserkerTerminal.perteParAube, Math.max(0, aubes));
}

/**
 * La sequelle du Revenant, tiree au sort parmi celles qu'il n'a pas encore
 * (tranche le 23 septembre 2026 : une sequelle au hasard). Null s'il les a
 * toutes.
 *
 * @param nombre combien de sequelles existent
 */
export function sequelleDuRevenant(tirage: number, dejaPortees: readonly number[], nombre: number): number | null {
  const libres: number[] = [];
  for (let id = 0; id < nombre; id++) if (!dejaPortees.includes(id)) libres.push(id);
  if (libres.length === 0) return null;
  return libres[Math.min(libres.length - 1, Math.floor(tirage * libres.length))] ?? null;
}
