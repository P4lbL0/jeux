import { ORDRE_CLASSES, type ClassId } from "./classes";
import { Rng } from "./rng";

/**
 * Les dons : **la seule source de heros du jeu** (DESIGN.md §4.1, §4.29, §4.18).
 *
 * ⚠️ **On ne devient pas heros a l'usure.** Un homme sans don peut s'entrainer
 * dix ans sans jamais transcender ; l'entrainement **developpe** un don, il ne
 * le cree jamais. C'est la decision du 9 septembre 2026, et elle annule toute
 * formulation ou un veteran finirait par devenir heros.
 *
 * Ce que ca rapporte : chaque heros aura eu un nom d'habitant, un metier, des
 * traits gagnes en travaillant. On ne recrute plus une carte a collectionner,
 * on regarde grandir quelqu'un qu'on connaissait.
 *
 * Ce fichier ne connait pas Phaser.
 */

export interface Don {
  /**
   * La classe qu'il revelera. **Elle est fixee a la naissance et cachee** : le
   * don *est* la classe, on ne la choisit pas au reveil. C'est ce qui fait
   * qu'un reveil raconte quelque chose au lieu d'ouvrir un menu.
   */
  classe: ClassId;
  /**
   * Un don sur vingt est **majeur** : il nait en maitrisant deja une magie de
   * tres haut rang. Un habitant sur deux cents. Le jeu l'annonce comme une
   * naissance exceptionnelle — c'est l'evenement d'une partie.
   */
  majeur: boolean;
  /** Vrai une fois qu'il s'est reveille : cette personne est un heros. */
  eveille: boolean;
}

/** Un habitant sur dix porte un don, et personne ne le sait au depart (§4.1). */
export const PART_PORTEURS = 0.1;

/** Un don sur vingt est majeur — soit un habitant sur deux cents. */
export const PART_MAJEURS = 0.05;

/**
 * Les trois voies par lesquelles un don se reveille (DESIGN.md §4.1, §6).
 *
 * Elles coexistent, et elles ne se ressemblent pas : l'une est gratuite et au
 * hasard, l'une s'achete en temps de production, l'une s'achete en argent.
 */
export type VoieDuReveil = "danger" | "entrainement" | "rituel";

export const NOMS_VOIE: Record<VoieDuReveil, string> = {
  danger: "au bord de la mort",
  entrainement: "a la cour d'entrainement",
  rituel: "par le rituel de l'eglise",
};

/**
 * Le don d'un nouveau-ne, ou `null` — neuf fois sur dix.
 *
 * @param rng seede par l'appelant : un meme village redonne les memes dons,
 *   comme il redonne les memes traits et les memes portraits (§4.6).
 */
export function tirerLeDon(rng: Rng): Don | null {
  if (rng.next() >= PART_PORTEURS) return null;
  return {
    classe: ORDRE_CLASSES[rng.int(0, ORDRE_CLASSES.length - 1)]!,
    majeur: rng.next() < PART_MAJEURS,
    eveille: false,
  };
}

/**
 * Ce que l'entrainement apprend de quelqu'un (DESIGN.md, tranche le
 * 21 septembre 2026 par Angelos).
 *
 * **Rien ne se voit sur la fiche d'un habitant tant qu'on ne l'a pas
 * entraine** : le don est un secret de naissance. Mais l'entrainement, lui,
 * **tranche** — deux journees a la cour et on sait, dans un sens comme dans
 * l'autre. Et il n'est jamais perdu : celui qui n'avait rien a quand meme
 * gagne du niveau de combat.
 *
 * > **Pourquoi pas une loterie muette.** Avec un porteur sur dix et deux
 * > journees par essai, un entrainement qui ne dirait rien vaudrait vingt
 * > journees de production a l'aveugle : le joueur cesserait d'y aller. Et un
 * > indice visible d'avance ferait des neuf autres habitants du decor.
 */
export interface ResultatEntrainement {
  /** Le don, s'il y en avait un — il est **eveille** en sortant */
  don: Don | null;
  /** Les niveaux de combat gagnes, don ou pas : l'essai n'est jamais perdu */
  niveauxGagnes: number;
}

/** Ce que deux journees a la cour ajoutent au niveau de combat. */
export const NIVEAUX_PAR_FORMATION = 2;

/**
 * On l'entraine, et on sait.
 *
 * @param don ce qu'il portait sans le savoir, ou `null`
 */
export function entrainer(don: Don | null): ResultatEntrainement {
  if (!don || don.eveille) return { don: null, niveauxGagnes: NIVEAUX_PAR_FORMATION };
  return { don: { ...don, eveille: true }, niveauxGagnes: NIVEAUX_PAR_FORMATION };
}

/**
 * Le danger de mort reveille-t-il ce don, maintenant ? (DESIGN.md §4.1)
 *
 * **C'est la voie noble** : gratuite, au hasard, et elle ne se declenche que
 * dans les pires moments de la partie — les heros naissent de la ou l'on a
 * failli perdre quelqu'un. Elle ne peut donc pas etre provoquee : on ne met pas
 * ses habitants en danger pour tirer des heros, parce qu'un habitant mort ne
 * revient pas.
 *
 * @param partDeVie ce qu'il lui reste, de 0 a 1
 * @param rng le tirage de l'appelant
 */
export function reveilParLeDanger(don: Don | null, partDeVie: number, rng: Rng): boolean {
  if (!don || don.eveille) return false;
  if (partDeVie > SEUIL_DANGER) return false;
  return rng.next() < CHANCE_DANGER;
}

/**
 * Sous quelle part de vie un don peut s'eveiller tout seul.
 *
 * Le meme seuil que la regle des 20 % (§4.3) : ce n'est pas un hasard, c'est
 * **le moment ou le jeu dit deja qu'on est en train de perdre quelqu'un**.
 */
export const SEUIL_DANGER = 0.2;

/**
 * La chance, a chaque coup encaisse sous le seuil.
 *
 * *Chiffre tranche par le code, a corriger en jouant.* Un habitant au seuil
 * critique encaisse quelques coups avant de tomber : a une chance sur douze par
 * coup, un porteur de don s'eveille souvent — mais il faut qu'il ait vraiment
 * failli mourir, et rien ne garantit qu'il survive a la nuit.
 */
export const CHANCE_DANGER = 1 / 12;

/**
 * Le rituel de l'eglise : **sur, et cher** (DESIGN.md §4.1, §6).
 *
 * Il ne tire rien. Il dit ce que la personne porte, et l'eveille si elle porte
 * quelque chose. C'est la voie qu'on achete quand on ne veut plus attendre.
 */
export function rituel(don: Don | null): Don | null {
  if (!don || don.eveille) return null;
  return { ...don, eveille: true };
}

/** Ce que le rituel coute, en argent (§4.18 : l'argent vient du port). */
export const PRIX_DU_RITUEL = 900;

/** Le niveau d'eglise a partir duquel le rituel est possible (§4.22). */
export const NIVEAU_EGLISE_RITUEL = 3;
