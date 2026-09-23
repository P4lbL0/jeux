/**
 * Les etats, et la mort lente (DESIGN.md §4.23).
 *
 * Un etat est **subi** — une blessure, une maladie, la faim — et non soigne
 * **il tue**, en trois paliers visibles et annonces :
 *
 * > Malade → Gravement malade → Mourant → mort
 *
 * sur 5 a 7 journees. Une journee dure 45 minutes reelles (§4.19) : le joueur a
 * donc largement le temps de reagir, et la mort reste un arbitrage — « je n'ai
 * pas monte l'eglise, tant pis pour lui ».
 *
 * ⚠️ **Le stade Mourant est l'une des deux seules portes vers une sequelle.**
 * Soigner quelqu'un a ce stade le sauve *et* l'abime pour toujours. C'est le
 * meilleur dilemme du document, et il tient dans `soigner()`. L'autre porte est
 * le retour du Revenant (§4.25, 23 septembre 2026), qui paie ainsi sa seconde vie.
 *
 * Ce fichier ne connait ni Phaser ni le temps reel : il compte en **journees**.
 */

import { SEQUELLES, type Effets, type Modificateurs } from "./traits";

export type CleEtat =
  | "blessure"
  | "maladie"
  | "hemorragie"
  | "infection"
  | "lethargie";

/**
 * Les trois paliers, dans l'ordre.
 *
 * Le nom change avec l'etat — on ne dit pas « gravement affame » — mais le
 * mecanisme est le meme partout : un compteur qui avance, trois crans, puis la
 * mort si l'etat est mortel.
 */
export type Palier = 0 | 1 | 2;

export interface EtatDef {
  cle: CleEtat;
  nom: string;
  /** Le nom de chacun des trois paliers, tel qu'il s'annonce */
  paliers: [string, string, string];
  /**
   * Journees passees a chaque palier avant de passer au suivant.
   *
   * Trois paliers a 2 journees font une mort en 6 journees : c'est le milieu de
   * la fourchette « 5 a 7 » du §4.23, et le trait Robuste ou Hemophile la
   * deplace de part et d'autre.
   */
  journeesParPalier: number;
  /**
   * Tue-t-il au bout du troisieme palier ?
   *
   * L'infection et la lethargie ne tuent pas : elles s'installent, elles
   * penalisent, et elles attendent. C'est ce qui les rend differentes d'une
   * maladie — on peut vivre avec, mal.
   */
  mortel: boolean;
  /** Se transmet-il aux voisins qui travaillent a cote (§4.23) ? */
  contagieux: boolean;
  /** Ce qu'il coute, par palier. Le palier 2 est toujours le plus lourd. */
  effets: [Effets, Effets, Effets];
  /** Points de stress par minute tant qu'il dure */
  stressParMinute: number;
}

/**
 * **La table des etats.** Comme celle des traits, c'est le seul endroit a
 * toucher pour les re-regler.
 *
 * Les trois derniers ne suivent volontairement pas le rythme des deux premiers,
 * et le §4.23 assume la contradiction : **la maladie est une gestion,
 * l'hemorragie est une urgence.** C'est le contraste qui les rend lisibles.
 */
export const ETATS: Record<CleEtat, EtatDef> = {
  blessure: {
    cle: "blessure",
    nom: "Blessure",
    paliers: ["Blesse", "Gravement blesse", "Mourant"],
    journeesParPalier: 2,
    mortel: true,
    contagieux: false,
    effets: [
      { vitesse: 0.95, degats: 0.95 },
      { vitesse: 0.85, degats: 0.85, cadence: 0.7 },
      { vitesse: 0.6, degats: 0.6, cadence: 0, pvMax: 0.7 },
    ],
    stressParMinute: 0.12,
  },
  maladie: {
    cle: "maladie",
    nom: "Maladie",
    paliers: ["Malade", "Gravement malade", "Mourant"],
    journeesParPalier: 2,
    mortel: true,
    contagieux: false,
    effets: [
      { cadence: 0.85 },
      { cadence: 0.6, vitesse: 0.9 },
      { cadence: 0, vitesse: 0.6, pvMax: 0.7 },
    ],
    stressParMinute: 0.15,
  },
  /**
   * Elle tue en **une seule journee**, trois paliers compresses.
   *
   * Elle ne vient que du combat, donc le joueur sait toujours d'ou elle sort ;
   * et une journee, c'est encore 45 minutes reelles pour sonner la cloche et le
   * ramener (§4.23).
   */
  hemorragie: {
    cle: "hemorragie",
    nom: "Hemorragie",
    paliers: ["Il saigne", "Il perd son sang", "Mourant"],
    journeesParPalier: 1 / 3,
    mortel: true,
    contagieux: false,
    effets: [
      { vitesse: 0.95 },
      { vitesse: 0.85, degats: 0.8 },
      { vitesse: 0.5, degats: 0.5, cadence: 0 },
    ],
    stressParMinute: 0.5,
  },
  /**
   * Le **premier etat contagieux du jeu**.
   *
   * Il transforme le placement des postes en decision : mettre quatre bucherons
   * cote a cote devient un pari. C'est aussi la premiere raison mecanique de
   * separer ses gens au lieu de les entasser (§4.23).
   */
  infection: {
    cle: "infection",
    nom: "Infection fongique",
    paliers: ["Infecte", "Envahi", "Ronge"],
    journeesParPalier: 3,
    mortel: false,
    contagieux: true,
    effets: [{ vitesse: 0.8 }, { vitesse: 0.75, cadence: 0.85 }, { vitesse: 0.7, cadence: 0.7 }],
    stressParMinute: 0.08,
  },
  /**
   * Le palier **avant** la famine mortelle : il ne produit plus rien et s'assoit
   * par terre. Elle se soigne toute seule des qu'il remange.
   */
  lethargie: {
    cle: "lethargie",
    nom: "Lethargie",
    paliers: ["Affaibli", "Epuise", "A bout"],
    journeesParPalier: 2,
    mortel: false,
    contagieux: false,
    effets: [{ cadence: 0.6 }, { cadence: 0.3, vitesse: 0.85 }, { cadence: 0, vitesse: 0.7 }],
    stressParMinute: 0.25,
  },
};

/** Un etat en cours sur quelqu'un. */
export interface EtatSubi {
  cle: CleEtat;
  palier: Palier;
  /** Avancement dans le palier courant, entre 0 et 1 */
  avancement: number;
}

/** Le nom du palier courant, tel qu'il s'annonce et s'affiche. */
export function lireEtat(etat: EtatSubi): string {
  return ETATS[etat.cle].paliers[etat.palier];
}

/**
 * Ce que valent tous les etats d'une personne, une fois cumules.
 *
 * Le resultat part dans le meme agregat que les traits et les sequelles : le
 * code de jeu ne lit jamais qu'un `Modificateurs`, quelle qu'en soit l'origine.
 */
export function effetsDesEtats(etats: EtatSubi[]): Effets[] {
  return etats.map((etat) => ETATS[etat.cle].effets[etat.palier]);
}

/** Ce que ses etats lui coutent en stress, par minute. */
export function stressDesEtats(etats: EtatSubi[]): number {
  return etats.reduce((total, etat) => total + ETATS[etat.cle].stressParMinute * (1 + etat.palier), 0);
}

/** Ce qui vient d'arriver a un etat pendant qu'on le faisait avancer. */
export interface EvenementEtat {
  cle: CleEtat;
  /** `aggrave` : il est passe au palier suivant. `mort` : il n'y en a plus. */
  quoi: "aggrave" | "mort";
  palier: Palier;
  nom: string;
}

/**
 * Les etats avancent.
 *
 * @param journees temps ecoule, en journees de jeu
 * @param mods l'agregat de la personne ; seul `aggravationEtats` est lu ici
 * @returns ce qui s'est passe, pour que l'appelant l'annonce. Une mort arrete
 *   tout : les etats suivants ne sont plus avances, il n'y a plus personne.
 */
export function avancerEtats(
  etats: EtatSubi[],
  journees: number,
  mods: Modificateurs,
): EvenementEtat[] {
  const evenements: EvenementEtat[] = [];

  for (const etat of etats) {
    const def = ETATS[etat.cle];
    etat.avancement += (journees / def.journeesParPalier) * mods.aggravationEtats;

    while (etat.avancement >= 1) {
      etat.avancement -= 1;

      if (etat.palier < 2) {
        etat.palier = (etat.palier + 1) as Palier;
        evenements.push({
          cle: etat.cle,
          quoi: "aggrave",
          palier: etat.palier,
          nom: def.paliers[etat.palier],
        });
        continue;
      }

      // Au bout du troisieme palier : soit il meurt, soit l'etat s'installe.
      if (def.mortel) {
        evenements.push({ cle: etat.cle, quoi: "mort", palier: 2, nom: def.paliers[2] });
        return evenements;
      }
      etat.avancement = 0;
      break;
    }
  }

  return evenements;
}

/**
 * Contracter un etat.
 *
 * Un etat deja present ne se cumule pas — il **s'aggrave d'un palier**. Sinon
 * un heros au contact d'une horde porterait quinze hemorragies et mourrait dans
 * l'image suivante, ce qui n'est ni lisible ni juste.
 *
 * @returns vrai s'il s'est passe quelque chose
 */
export function contracter(etats: EtatSubi[], cle: CleEtat): boolean {
  const present = etats.find((e) => e.cle === cle);
  if (!present) {
    etats.push({ cle, palier: 0, avancement: 0 });
    return true;
  }
  if (present.palier >= 2) return false;
  present.palier = (present.palier + 1) as Palier;
  present.avancement = 0;
  return true;
}

export interface ResultatSoin {
  soigne: boolean;
  /**
   * L'identifiant de la sequelle laissee, ou null.
   *
   * Non nul **uniquement** quand on soigne quelqu'un au stade Mourant. C'est la
   * seule source de sequelles du jeu (§4.23), et le joueur sait toujours qu'il
   * joue avec le feu au moment ou il le fait : le palier est annonce.
   */
  sequelle: number | null;
}

/**
 * L'eglise le soigne (§4.22).
 *
 * @param tirage un flottant de [0,1), fourni par l'appelant pour que ce fichier
 *   reste pur et qu'une meme graine redonne la meme partie
 */
export function soigner(etats: EtatSubi[], cle: CleEtat, tirage: number): ResultatSoin {
  const index = etats.findIndex((e) => e.cle === cle);
  if (index < 0) return { soigne: false, sequelle: null };

  const etait = etats[index]!.palier;
  etats.splice(index, 1);

  if (etait < 2) return { soigne: true, sequelle: null };
  return { soigne: true, sequelle: Math.min(SEQUELLES.length - 1, Math.floor(tirage * SEQUELLES.length)) };
}

/** Le pire palier en cours, ou null s'il va bien. Sert au portrait et a la fiche. */
export function pireEtat(etats: EtatSubi[]): EtatSubi | null {
  let pire: EtatSubi | null = null;
  for (const etat of etats) {
    if (!pire || etat.palier > pire.palier) pire = etat;
  }
  return pire;
}

/** Est-il au bord ? C'est ce qui declenche l'annonce et le signe au-dessus de la tete. */
export function estMourant(etats: EtatSubi[]): boolean {
  return etats.some((e) => e.palier === 2 && ETATS[e.cle].mortel);
}
