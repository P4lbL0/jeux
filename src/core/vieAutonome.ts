/**
 * La vie autonome (DESIGN.md §4.27).
 *
 * Le §4.4 dit que n'importe qui peut recevoir n'importe quelle tache. Cette
 * section dit ce qui se passe quand on ne donne **aucun** ordre — et la reponse
 * ne doit surtout pas etre « rien ».
 *
 * > **Le Protecteur dirige un organisme, il ne micro-gere pas vingt personnes.**
 *
 * Ce fichier porte deux choses, et rien de plus :
 *
 * - **la journee**, c'est-a-dire ce que quelqu'un fait quand il n'a ni poste ni
 *   ordre : un petit **arbre de priorites**, pas une recherche de chemin ni une
 *   evaluation de tous les postes possibles ;
 * - **les initiatives**, qui se declenchent quand un **trait fort rencontre une
 *   situation extreme** — jamais sur un simple tirage.
 *
 * ⚠️ **Ce qu'on ne fait pas, et pourquoi.** La simulation complete — besoins,
 * horaires, preferences, ambition, memoire, decision libre pour chacun — est ce
 * que fait WorldBox, et c'est aussi le moyen le plus sur de faire tomber le jeu
 * a trente habitants. On prend la **journee autonome** et les **initiatives
 * rares**, qui produisent 90 % de l'effet pour 10 % du cout.
 *
 * Ce fichier ne connait pas Phaser, et il ne sait pas ou sont les gens : il
 * prend un etat, il rend une decision.
 */

import { REGLAGES_STRESS, type Personne } from "./personne";
import { idTrait } from "./traits";

// -------------------------------------------------------------- la journee

/**
 * Ce qu'on fait quand personne ne nous a rien demande.
 *
 * L'ordre de la liste **est** l'ordre de l'arbre de priorites : on prend la
 * premiere qui s'applique. C'est exactement la « petite suite de tests » que le
 * §4.27 demande, par opposition a une evaluation de tous les choix possibles.
 */
export type Occupation =
  /** Il est a l'abri, dans l'eglise : la nuit, ou parce qu'on l'a rappele */
  | "dormir"
  /** Ca brule pres de chez lui : il court au puits, puis au feu (§4.21) */
  | "eteindre"
  /** Il a faim, il va vers les reserves */
  | "manger"
  /** Il va au puits */
  | "boire"
  /** Quelque chose est casse, il repare */
  | "reparer"
  /** Il croise quelqu'un et s'arrete */
  | "discuter"
  /** Il se balade dans un petit rayon, il s'assoit, il regarde */
  | "flaner";

export const NOMS_OCCUPATION: Record<Occupation, string> = {
  dormir: "dort",
  eteindre: "eteint le feu",
  manger: "mange",
  boire: "boit",
  reparer: "repare",
  discuter: "discute",
  flaner: "flane",
};

/** Ce que la decision a besoin de savoir. Rien de plus, et rien de Phaser. */
export interface EtatAutonome {
  personne: Personne;
  /** Faux quand il a faim : il ne produit plus tant qu'il n'a pas mange */
  rassasie: boolean;
  /** Fait-il nuit ? */
  nuit: boolean;
  /** Y a-t-il un chantier ouvert a portee ? */
  chantier: boolean;
  /** Ca brule-t-il a portee de course ? (§4.21, six cases) */
  feu: boolean;
  /** Quelqu'un d'autre est-il assez pres pour qu'on lui parle ? */
  voisin: boolean;
  /** Un monstre est-il en vue ? Alors tout redevient fonctionnel (§4.23) */
  menace: boolean;
}

/**
 * **La table de reglages de la vie autonome.**
 *
 * *Chiffres tranches par le code, a corriger en jouant.* Le §4.27 n'en donne
 * qu'un — « trois initiatives annoncees par nuit au maximum », tranche le
 * 9 septembre 2026.
 */
export const REGLAGES_VIE = {
  /**
   * Combien d'habitants on **reveille par image**, a tour de role.
   *
   * ⚠️ C'est la contrainte de fluidite centrale du §4.27 : « on ne reveille que
   * quelques habitants par image ». Une decision prise avec 300 ms de retard est
   * invisible ; trente decisions par image a soixante images par seconde, non.
   */
  reveillesParImage: 3,

  /** Au-dela, le stress se voit et on ne flane plus : on s'assoit (§4.23) */
  stressQuiPese: 60,

  /** Rayon dans lequel deux personnes se croisent, en pixels */
  distanceDeRencontre: 44,

  /** Millisecondes qu'une conversation dure */
  dureeDeDiscussion: 2600,

  /** Millisecondes entre deux bulles d'une meme personne */
  reposEntreDeuxBulles: 9000,

  /** Trois initiatives annoncees par nuit au maximum (tranche le 9 septembre) */
  initiativesAnnonceesParNuit: 3,
};

/**
 * Ce qu'il fait maintenant (§4.27).
 *
 * **Un petit arbre de priorites, pas une recherche.** Six tests dans l'ordre,
 * et on prend le premier qui repond.
 *
 * ⚠️ **On flane a l'abri, jamais sous les crocs** (§4.23). Des qu'un ennemi est
 * en vue, tout redevient fonctionnel — c'est l'appelant qui s'en charge, mais on
 * le dit ici aussi pour que la regle ne tienne pas a un seul endroit.
 */
export function choisirOccupation(etat: EtatAutonome): Occupation {
  if (etat.nuit || etat.menace) return "dormir";

  // ⚠️ **Le feu passe avant la faim, et apres l'abri.** Un village qui brule,
  // on y va ; mais la nuit les habitants sont a l'abri et c'est au heros de
  // choisir entre le feu et les monstres (§4.21). Celui qui a craque, lui, ne
  // porte pas de seau — c'est souvent lui qui a allume.
  if (etat.feu && etat.personne.rupture === null) return "eteindre";

  if (!etat.rassasie) return "manger";

  const { personne } = etat;
  // Celui qui a craque ne discute pas et ne repare rien : il est ailleurs.
  if (personne.rupture !== null) return "flaner";

  // Il reste quelque chose a faire : ca passe avant la conversation.
  if (etat.chantier && personne.traits.includes(idTrait("main-du-batisseur"))) return "reparer";

  if (etat.voisin) return "discuter";

  // Le stress pousse a boire, et c'est la seule chose qu'un village de ce
  // genre a a offrir. Sous le seuil, on flane.
  if (personne.stress >= REGLAGES_VIE.stressQuiPese) return "boire";
  return "flaner";
}

/**
 * Ce qu'une rencontre produit comme bulle (§4.27).
 *
 * > De petites bulles (un coeur, une goutte de sueur, une chope) apparaissent
 * > quand deux personnes se croisent. Le joueur invente alors sa propre
 * > histoire — « ah tiens, le bucheron drague l'oracle » — et c'est exactement
 * > l'effet recherche.
 *
 * ⚠️ **Elle ne dit rien que le jeu ne sache deja.** Le coeur vient d'un lien
 * d'amour ou d'amitie forte (§4.26), la sueur d'un stress eleve, la chope du
 * reste. Une bulle tiree au sort serait de la decoration ; celle-ci est une
 * lecture.
 */
export type Bulle = "coeur" | "sueur" | "chope";

export function bulleDeLaRencontre(
  personne: Personne,
  intensiteDuLien: number,
  lienPositif: boolean,
): Bulle {
  if (lienPositif && intensiteDuLien >= 60) return "coeur";
  if (personne.stress >= REGLAGES_VIE.stressQuiPese) return "sueur";
  return "chope";
}

/**
 * Le tour de role (§4.27).
 *
 * Rend les index a reveiller a cette image, et le curseur suivant. Une fonction
 * pure et un compteur : c'est tout ce qu'un « a tour de role » demande, et ca se
 * teste sans jeu autour.
 */
export function prochainTour(
  curseur: number,
  total: number,
  combien = REGLAGES_VIE.reveillesParImage,
): { index: number[]; suivant: number } {
  if (total <= 0) return { index: [], suivant: 0 };
  const pris = Math.min(combien, total);
  const index: number[] = [];
  for (let i = 0; i < pris; i++) index.push((curseur + i) % total);
  return { index, suivant: (curseur + pris) % total };
}

// ----------------------------------------------------------- les initiatives

/**
 * Les six initiatives du §4.27.
 *
 * ⚠️ **Une initiative se declenche quand un trait fort rencontre une situation
 * extreme. Jamais sur un simple tirage.** C'est la phrase qui porte toute la
 * section : une initiative qui arrive toutes les deux minutes est du bruit, une
 * initiative qui arrive une fois toutes les trois nuits est une **histoire**.
 */
export type CleInitiative =
  | "tenir-l-eglise"
  | "abandonner-le-poste"
  | "rassembler-la-milice"
  | "mettre-le-feu"
  | "tenir-un-discours"
  | "se-servir";

export interface InitiativeDef {
  cle: CleInitiative;
  /** Le trait qui la rend possible */
  trait: string;
  /**
   * Faut-il l'annoncer ? (§4.27)
   *
   * « Le joueur ne doit jamais decouvrir apres coup que quelqu'un a decide pour
   * lui. » Les trois plus graves sont annoncees ; le reste se produit sans
   * notification — **le village vit, il ne hurle pas** (tranche le 9 septembre).
   */
  gravite: number;
  /** Ce que la discussion en dit, `{qui}` remplace par son nom */
  phrase: string;
}

export const INITIATIVES: Record<CleInitiative, InitiativeDef> = {
  "tenir-l-eglise": {
    cle: "tenir-l-eglise",
    trait: "courageux",
    gravite: 3,
    phrase: "{qui} sort tenir les portes de l'eglise",
  },
  "abandonner-le-poste": {
    cle: "abandonner-le-poste",
    trait: "peureux",
    gravite: 2,
    phrase: "{qui} a lache son poste sans qu'on le lui demande",
  },
  "rassembler-la-milice": {
    cle: "rassembler-la-milice",
    trait: "veteran",
    gravite: 3,
    phrase: "{qui} rassemble ceux qui tiennent encore debout",
  },
  "mettre-le-feu": {
    cle: "mettre-le-feu",
    trait: "pyromane",
    gravite: 3,
    phrase: "{qui} s'en prend a ce qui tient encore",
  },
  "tenir-un-discours": {
    cle: "tenir-un-discours",
    trait: "legende-locale",
    gravite: 2,
    phrase: "{qui} parle, et on l'ecoute",
  },
  "se-servir": {
    cle: "se-servir",
    trait: "kleptomane",
    gravite: 1,
    phrase: "Il manque quelque chose dans les reserves",
  },
};

/** La situation extreme, au moment ou on la teste. Jamais en continu (§4.27). */
export interface SituationExtreme {
  /** L'eglise est attaquee et personne ne la defend */
  egliseSansDefense: boolean;
  /** Un front vient de ceder */
  frontCede: boolean;
  /** Combien sont morts cette nuit */
  mortsDeLaNuit: number;
  /** Fait-il nuit ? */
  nuit: boolean;
  /** Le stress moyen du village, de 0 a 200 */
  stressCollectif: number;
  /** Les reserves sont-elles pleines ? */
  stockPlein: boolean;
}

/**
 * Cette personne prend-elle une initiative, maintenant ?
 *
 * **Le trait d'abord, la situation ensuite**, et les deux sont obligatoires.
 * Rend `null` la plupart du temps, et c'est le comportement normal.
 */
export function initiativeDe(
  personne: Personne,
  situation: SituationExtreme,
): CleInitiative | null {
  const a = (cle: string): boolean => personne.traits.includes(idTrait(cle as never));

  // Un Courageux, quand l'eglise est attaquee et que personne ne la defend.
  if (a("courageux") && situation.egliseSansDefense) return "tenir-l-eglise";

  // Un Peureux, quand un front cede.
  if (a("peureux") && situation.frontCede) return "abandonner-le-poste";

  // Un ancien milicien, quand trois habitants sont morts la meme nuit.
  if (a("veteran") && situation.mortsDeLaNuit >= 3) return "rassembler-la-milice";

  // Un Pyromane **en rupture**, la nuit, dans le village. Les trois conditions,
  // et la rupture n'est pas negociable : c'est ce qui le rend rare (§4.23).
  if (a("pyromane") && personne.rupture !== null && situation.nuit) return "mettre-le-feu";

  // Une Legende locale, quand le stress collectif depasse le seuil.
  if (a("legende-locale") && situation.stressCollectif >= REGLAGES_STRESS.seuilVisible) {
    return "tenir-un-discours";
  }

  // Un Kleptomane, quand le stock est plein.
  if (a("kleptomane") && situation.stockPlein) return "se-servir";

  return null;
}

/**
 * Faut-il l'annoncer ? (§4.27, tranche le 9 septembre 2026)
 *
 * **Trois par nuit au maximum, les plus graves d'abord.** Le reste se produit
 * sans notification : le village vit, il ne hurle pas.
 */
export function fautAnnoncer(cle: CleInitiative, dejaAnnoncees: number): boolean {
  if (dejaAnnoncees >= REGLAGES_VIE.initiativesAnnonceesParNuit) return false;
  return INITIATIVES[cle].gravite >= 2;
}

/** La phrase d'une initiative, assemblee au moment de la dire. */
export function direLInitiative(cle: CleInitiative, nom: string): string {
  return INITIATIVES[cle].phrase.replace("{qui}", nom);
}
