/**
 * La satisfaction du village (DESIGN.md §4.23).
 *
 * **Un seul chiffre, de 0 a 100**, et il ne s'invente pas : il tombe de choses
 * qui existent deja. C'est lui qui debloque le niveau d'eglise suivant (§4.22),
 * et c'est ce qui referme enfin la boucle du village :
 *
 * > l'eglise fait baisser le stress → les humeurs remontent → la satisfaction
 * > monte → elle debloque le niveau d'eglise suivant → …
 *
 * Sans elle, l'eglise etait un batiment qu'on ameliorait avec du bois et rien
 * d'autre. Avec elle, la monter demande d'avoir bien traite ses gens.
 *
 * Ce fichier est pur : il prend un etat, il rend un nombre.
 */

import { REGLAGES_STRESS } from "./personne";

/**
 * **La table de reglages de la satisfaction.** Chaque poste est plafonne, et la
 * somme des plafonds depasse volontairement 100 : il n'existe pas une seule
 * facon d'avoir un village heureux.
 */
export const REGLAGES_SATISFACTION = {
  /** Le point de depart, avant que quoi que ce soit ne joue */
  base: 40,

  /** Ce que des gens calmes peuvent rapporter, au maximum */
  poidsHumeur: 35,
  /** Ce qu'une mort coute, et pendant combien de journees */
  parMort: 9,
  memoireDesMorts: 3,
  /** Ce que la faim coute, par habitant affame */
  parAffame: 5,
  /** Ce qu'un malade coute, quel que soit son palier */
  parMalade: 3,

  /** Ce que le confort peut rapporter : les vivres d'avance, et l'eglise */
  poidsVivres: 12,
  /** Au-dela de tant de journees de vivres, en avoir plus ne rassure plus */
  vivresSuffisants: 5,
  /** Ce que chaque niveau d'eglise au-dessus du premier rapporte */
  parNiveauEglise: 6,

  /**
   * Ce que les decorations rapportent, au maximum.
   *
   * Elles n'existent pas encore — le mode d'amenagement est au bloc 7 (§4.24).
   * Le point d'accroche est pose ici pour qu'il n'y ait rien a recoder : le jour
   * ou un puits se pose, il n'aura qu'a remplir `decorations`.
   */
  poidsDecorations: 10,
};

/** Ce que la satisfaction a besoin de savoir du village. */
export interface ContexteSatisfaction {
  /** Le stress de chaque habitant vivant, de 0 a 200 */
  stress: number[];
  /** Combien n'ont pas mange au dernier repas */
  affames: number;
  /** Combien portent un etat en ce moment */
  malades: number;
  /** Morts des `memoireDesMorts` dernieres journees */
  mortsRecents: number;
  /** Journees de vivres d'avance */
  joursDeVivres: number;
  niveauEglise: number;
  /** L'eglise tient-elle debout ? A terre, elle ne rassure personne */
  egliseDebout: boolean;
  /** Le compte de decorations posees — zero jusqu'au bloc 7 */
  decorations: number;
}

/**
 * La satisfaction, de 0 a 100.
 *
 * Elle vaut 100 pour un village calme, nourri, sain, sans mort recent et avec
 * une belle eglise — et ca ne s'obtient pas par accident.
 */
export function satisfactionDuVillage(ctx: ContexteSatisfaction): number {
  const r = REGLAGES_SATISFACTION;

  // Un village vide n'est ni content ni malheureux. On rend le plancher plutot
  // que NaN : sans habitant, la partie est finie de toute facon (§4.18).
  if (ctx.stress.length === 0) return 0;

  let total = r.base;

  // --- La moyenne des humeurs. Le stress est deja la mesure de l'humeur : en
  // faire une deuxieme serait deux systemes a equilibrer pour le meme resultat.
  const moyenne = ctx.stress.reduce((a, b) => a + b, 0) / ctx.stress.length;
  const calme = Math.max(0, 1 - moyenne / REGLAGES_STRESS.rupture);
  total += calme * r.poidsHumeur;

  // --- Ce qui plombe.
  total -= ctx.mortsRecents * r.parMort;
  total -= ctx.affames * r.parAffame;
  total -= ctx.malades * r.parMalade;

  // --- Le confort.
  const vivres = Math.min(1, Math.max(0, ctx.joursDeVivres) / r.vivresSuffisants);
  total += vivres * r.poidsVivres;
  if (ctx.egliseDebout) total += (ctx.niveauEglise - 1) * r.parNiveauEglise;
  // Une eglise a terre ne coute pas seulement ses soins : le village le voit.
  else total -= r.parNiveauEglise * 2;

  total += Math.min(1, ctx.decorations / 8) * r.poidsDecorations;

  return Math.round(Math.max(0, Math.min(100, total)));
}

/**
 * Les morts qui comptent encore.
 *
 * @param journeesDesMorts la journee a laquelle chaque mort est survenue
 * @param journeeCourante la journee en cours
 */
export function mortsRecents(journeesDesMorts: number[], journeeCourante: number): number {
  return journeesDesMorts.filter(
    (jour) => journeeCourante - jour < REGLAGES_SATISFACTION.memoireDesMorts,
  ).length;
}

/** La satisfaction, ecrite pour un humain. Sert au tableau du village. */
export function lireSatisfaction(valeur: number): string {
  if (valeur >= 80) return "le village est heureux";
  if (valeur >= 60) return "le village va bien";
  if (valeur >= 40) return "le village tient";
  if (valeur >= 20) return "le village gronde";
  return "le village se meurt";
}
