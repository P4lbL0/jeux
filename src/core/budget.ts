/**
 * Le budget d'un monde : ce qu'il t'offre, il te le fait payer (DESIGN.md
 * §4.29, point 4).
 *
 * « Un village magnifique n'est pas le bon village : c'est celui qui annonce
 * les nuits les plus dures. » C'est ce fichier qui rend cette phrase vraie, et
 * c'est lui qui donne enfin son sens au refus — sans lui, on dit oui au
 * premier village qui a des murs.
 *
 * **Un seul nombre, une seule table.** Le §4.29 refuse deux curseurs
 * independants (« ils produisent tot ou tard la partie injouable et la partie
 * offerte, qui sont l'une et l'autre du temps perdu ») : tout ce que le monde
 * donne se compte **sur une meme echelle**, et l'ecart au monde de reference
 * devient la menace.
 *
 * ⚠️ **Le budget ne decide pas du monde : il paie celui qui a ete tire**
 * (decision d'Angelos, 20 septembre 2026). Le terrain, les fronts, les murs
 * debout, les gens et les reserves sortent de la graine comme avant ; le
 * budget ne fait que **mesurer** ce que ca donne et regler l'addition. Aucun
 * tirage n'est a refaire, et la graine zero garde sa carte.
 *
 * Le monde de reference — celui qui ne coute ni ne rend rien — est la partie
 * qu'on jouait jusqu'ici : **deux fronts** (la carte classique), **six
 * habitants**, des reserves a moitie, **deux breches** dans l'enceinte, pas de
 * douves.
 */

/** Ce qu'un monde donne, et que le budget met en face d'une addition. */
export interface CeQueLeMondeOffre {
  /** Combien ils sont */
  habitants: number;
  /** Ce qu'il leur reste, de 0 (plus rien) a 1 (reserves pleines) */
  aisance: number;
  /** Par combien de bords on entre a pied : 1 (presqu'ile) a 4 (plaine ouverte) */
  fronts: number;
  /** Les pieces d'enceinte encore debout */
  mursDebout: number;
  /** Les pans effondres */
  breches: number;
  /** Un fosse autour ? */
  douves: boolean;
}

export const REGLAGES_BUDGET = {
  /** Le village de reference : ni cadeau, ni menace */
  habitantsDeReference: 6,
  /** Ce que vaut un habitant de plus (ou de moins) */
  parHabitant: 2,
  /** Ce que valent des reserves pleines plutot qu'a moitie */
  reservesPleines: 12,
  /**
   * Ce que vaut le terrain, par nombre de fronts.
   *
   * ⚠️ **Un seul front est le plus gros cadeau du jeu** (§4.29) : une
   * presqu'ile, et tout le reste du monde doit se payer. A quatre, le §4.29
   * exige l'inverse et le dit : la baliste du jalon 7 n'y couvre plus rien, le
   * budget doit traiter ca comme une **menace majeure** et non comme un detail
   * de terrain — d'ou un tarif qui rend beaucoup.
   */
  parFronts: { 1: 30, 2: 0, 3: -12, 4: -26 } as Record<number, number>,
  /**
   * Les breches du village de reference, et ce que vaut chacune.
   *
   * ⚠️ **On compte les breches, pas la part de mur debout**, et c'est une
   * mesure qui l'impose : sur 180 villages, l'enceinte est **toujours presque
   * entiere** (de 88 % a 100 % debout, mediane 96 %) parce que le generateur
   * ouvre une ou deux breches par pan, pas davantage. Une part de mur debout ne
   * variait donc que d'un point d'un monde a l'autre — le budget y perdait une
   * dimension entiere, et la phrase annoncee disait « des murs presque
   * intacts » pour tout le monde. Les breches, elles, vont de zero a quatre.
   */
  brechesDeReference: 2,
  parBreche: 5,
  /**
   * Ce que rend un village qui n'a **aucune** piece d'enceinte.
   *
   * Strictement pire que le mur le plus troue qu'on ait mesure (quatre
   * breches) : un trou dans un mur se bouche, une absence de mur se batit.
   */
  sansEnceinte: -15,
  /** Ce que vaut un fosse deja creuse */
  douves: 8,

  /**
   * De combien de points il faut etre genereux pour doubler la menace.
   *
   * C'est la seule constante qui regle **toute** la difficulte du monde : la
   * monter adoucit les mondes riches, la baisser les rend brutaux.
   */
  echelle: 70,
  /** Ce qu'un monde tres pauvre rend au plus, en part d'effectif de nuit */
  adoucissementMax: 0.35,
  /** Ce qu'un monde tres riche coute au plus, en part d'effectif de nuit */
  durcissementMax: 0.6,
  /** Tous les combien de points la nuit gagne une nuit d'avance en puissance */
  pointsParNuitDAvance: 25,
  /** Au plus : la premiere nuit se jouerait comme la quatrieme */
  nuitsDAvanceMax: 3,
  /** A partir de combien de points le village arrive deja malade */
  seuilDesMaladies: 35,
  /** Tous les combien de points au-dessus du seuil, un malade de plus */
  pointsParMalade: 18,
  /** Au plus : trois lits, c'est deja l'eglise de niveau 3 (§4.22) */
  maladesMax: 3,
};

/**
 * Ce que ce monde donne, en points, au-dessus (negatif : en dessous) du monde
 * de reference.
 */
export function valeurDesCadeaux(offre: CeQueLeMondeOffre): number {
  const r = REGLAGES_BUDGET;

  // Un village sans la moindre piece d'enceinte est **moins** qu'un village
  // troue de partout : il n'a rien a defendre avec.
  const defenses =
    offre.mursDebout + offre.breches === 0
      ? r.sansEnceinte
      : (r.brechesDeReference - offre.breches) * r.parBreche;

  return (
    (offre.habitants - r.habitantsDeReference) * r.parHabitant +
    (borner(offre.aisance, 0, 1) - 0.5) * r.reservesPleines +
    (r.parFronts[borner(Math.round(offre.fronts), 1, 4)] ?? 0) +
    defenses +
    (offre.douves ? r.douves : 0)
  );
}

/** Ce que le monde reclame en echange. */
export interface Menaces {
  /** Ce qui s'ajoute a l'effectif d'une nuit, en part : -0,35 a +0,6 */
  effectifEnPlus: number;
  /**
   * De combien de nuits la difficulte a de l'avance.
   *
   * C'est le « plus forts, plus tot » du §4.29, et c'est le levier le plus
   * brutal des trois : la puissance d'une nuit ouvre les archetypes autant
   * qu'elle monte les statistiques (`choisirArchetype`). Un monde a trois nuits
   * d'avance envoie des brutes le premier soir.
   */
  nuitsDAvance: number;
  /** Combien d'habitants sont deja malades quand on s'installe */
  malades: number;
}

/** L'addition, a partir de ce que le monde a donne. */
export function menacesDuMonde(valeur: number): Menaces {
  const r = REGLAGES_BUDGET;
  const part = valeur / r.echelle;
  return {
    effectifEnPlus: borner(part, -r.adoucissementMax, r.durcissementMax),
    nuitsDAvance:
      valeur <= 0 ? 0 : Math.min(r.nuitsDAvanceMax, Math.floor(valeur / r.pointsParNuitDAvance)),
    malades:
      valeur <= r.seuilDesMaladies
        ? 0
        : Math.min(r.maladesMax, 1 + Math.floor((valeur - r.seuilDesMaladies) / r.pointsParMalade)),
  };
}

/**
 * Ce qu'on annonce avant d'entrer, en **une phrase** (§4.29).
 *
 * Deux moities : ce qu'on voit, et ce que ca coute. « Un village nombreux,
 * bien defendu — et la foret grouille. »
 *
 * ⚠️ **Ce n'est pas le gardien qui parle, c'est le jeu.** Un villageois ne peut
 * pas dire honnetement « nous sommes riches, donc tes nuits seront pires ». La
 * phrase se pose donc a part sur le panneau, sous ce qu'il raconte (decision
 * d'Angelos, 20 septembre 2026).
 *
 * ⚠️ **Elle ne dit jamais les maladies**, meme quand le budget en a achete :
 * ce qui ne se voit pas de loin ne s'annonce pas (§4.29), et c'est un test qui
 * le tient. On decouvre les malades une fois installe — c'est la mauvaise
 * surprise que le beau village cachait.
 */
export function phraseDuMonde(offre: CeQueLeMondeOffre, menaces: Menaces): string {
  return `${ceQuOnVoit(offre)} — ${ceQueCaCoute(menaces)}`;
}

/**
 * La premiere moitie : ce qui saute aux yeux, du plus marquant au plus banal.
 *
 * ⚠️ **Les reserves n'y sont pas, alors qu'elles se paient.** Elles sont un
 * cadeau du budget (le §4.29 les liste : « des stocks pleins, des champs
 * murs »), mais elles ne se **voient pas** de loin — et ce qui ne se voit pas
 * ne s'annonce pas. Un village ordinaire dont les greniers sont pleins annonce
 * donc des nuits dures sans dire pourquoi : c'est exactement le pari eclaire
 * que le §4.29 demande, et pas un calcul.
 */
function ceQuOnVoit(offre: CeQueLeMondeOffre): string {
  const pieces = offre.mursDebout + offre.breches;

  if (offre.fronts <= 1) return "Une presqu'ile, un seul passage";
  if (offre.habitants >= 12) return "Un village nombreux";
  if (pieces === 0) return "Pas l'ombre d'un mur";
  if (offre.breches === 0) return "Une enceinte sans une breche";
  if (offre.habitants <= 2) return "Une poignee de survivants";
  if (offre.breches >= 4) return "Un mur ouvert en quatre endroits";
  if (offre.douves) return "Un fosse tout autour";
  if (offre.fronts >= 4) return "La plaine ouverte de tous les cotes";
  return "Un village ordinaire";
}

/** La seconde moitie : ce que les nuits vont valoir. */
function ceQueCaCoute(menaces: Menaces): string {
  if (menaces.nuitsDAvance >= 3) return "et ce qui vient la nuit ne pardonne rien";
  if (menaces.nuitsDAvance >= 2) return "et la foret grouille";
  if (menaces.nuitsDAvance >= 1) return "et les nuits y sont chargees";
  if (menaces.effectifEnPlus > 0.1) return "et ils viennent en nombre";
  if (menaces.effectifEnPlus < -0.15) return "et les nuits y sont calmes";
  return "et les nuits sont ce qu'elles sont";
}

function borner(valeur: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, valeur));
}
