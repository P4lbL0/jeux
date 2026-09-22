import { CASE } from "./grille";
import type { Rng } from "./rng";

/**
 * L'incendie (DESIGN.md §4.21, tranche le 20 septembre 2026).
 *
 * Le deuxieme morceau du jalon 6, et le premier qui **prend du terrain au
 * joueur** : la pluie est un cadeau, la crue une facture qu'on voit venir de
 * deux journees, le feu est une urgence qui arrive pendant qu'on fait autre
 * chose.
 *
 * Ce qui l'allume : les monstres (une maison qu'ils attaquent prend feu sous
 * 30 % de vie, une fois sur deux), le meurtrier du §4.18 qui brule au lieu de
 * tuer, le Pyromane qui craque (§4.23, §4.27) et l'eclair d'orage (§4.21, un
 * sur vingt). Ce qui l'eteint : les habitants le jour, seau par seau, et les
 * heros a tout moment en restant contre le feu. La pluie aide — **deux fois
 * plus vite** —, elle ne suffit pas.
 *
 * Comme la meteo et le cycle, ce module **ne connait rien du jeu** : il ne voit
 * ni maison ni champ, seulement des *combustibles* qu'on lui nomme, avec une
 * position. Il dit ce que le feu ronge, la scene l'applique. C'est ce qui
 * permet de tester une propagation complete sans faire tourner une partie.
 *
 * ⚠️ **Le feu ne repare rien tout seul.** Un foyer qu'on ignore mange sa maison
 * en une quarantaine de secondes, et il a le temps de sauter chez la voisine
 * avant de s'epuiser : c'est la seule chose du village qui punisse le fait de
 * regarder ailleurs.
 */

/**
 * Ce qui brule. La foret attend (§4.21) : les arbres n'ont pas de vie dans le
 * code, ce serait un chantier de plus. L'eglise et les murs ne brulent pas.
 */
export type SorteDeFeu = "maison" | "champ";

/** Une chose qui peut prendre feu, telle que la scene la nomme. */
export interface Combustible {
  /** L'identite que la scene lui donne, et par laquelle elle la retrouvera */
  id: string;
  /** Le milieu de la chose, en pixels du monde */
  x: number;
  y: number;
  sorte: SorteDeFeu;
}

/** Un feu qui brule, sur une chose et une seule. */
export interface Foyer {
  /** L'identite du combustible qui brule */
  cible: string;
  x: number;
  y: number;
  sorte: SorteDeFeu;
  /** Ce qu'il reste de feu a eteindre, en points ; a zero, il meurt */
  ardeur: number;
  /**
   * Ce que ce feu a deja mange, dans l'unite de sa sorte.
   *
   * Une maison n'en a pas besoin — ses points de vie disent tout. Un champ, si :
   * sa maturite ne mesure pas ce qu'il a encaisse (un champ tout juste seme est
   * deja a zero), donc c'est ce compteur qui dit quand il n'en reste rien.
   */
  ronge: number;
  /** Quand il tentera de prendre a cote, en millisecondes de partie */
  prochaineEtincelle: number;
}

/**
 * Ce que le feu ronge pendant un passage.
 *
 * ⚠️ **L'unite depend de la sorte**, et c'est voulu : une maison perd des
 * points de vie, un champ perd de la maturite. Le noyau ne sait pas ce qu'il
 * compte — il rend un nombre, la scene sait quoi en faire.
 */
export interface DegatDuFeu {
  cible: string;
  sorte: SorteDeFeu;
  degats: number;
}

/** Ce qu'un passage du feu produit, pour que la scene n'ait rien a deviner. */
export interface PassageDuFeu {
  degats: DegatDuFeu[];
  /** Les foyers nes a ce passage, par propagation */
  departs: Foyer[];
  /** Les foyers morts a ce passage, d'epuisement */
  eteints: Foyer[];
}

/**
 * **LA table de reglages du feu.** Seul endroit a toucher, comme
 * `REGLAGES_METEO` pour le ciel.
 *
 * ⚠️ *Chiffres tranches par le code, aucun n'a ete joue* : ils sont regles pour
 * qu'un feu soit une urgence de quarante secondes qu'un seul heros sait
 * eteindre, ou trois ou quatre habitants. A corriger manette en main.
 */
export const REGLAGES_INCENDIE = {
  /** Le feu se calcule une fois par seconde, pas par image (§4.17) */
  tick: 1_000,
  /** Ce qu'un depart de feu apporte a eteindre */
  ardeurAuDepart: 100,
  /**
   * Ce qu'un feu ronge par seconde, par sorte.
   *
   * Une maison a 200 points de vie : a cinq par seconde, elle tombe en
   * quarante secondes de feu franc. C'est plus lent qu'une horde et plus rapide
   * qu'une crue — le temps de traverser le village, pas celui de finir sa nuit.
   *
   * Un champ va de 0 a 1 de maturite : a un huitieme par seconde, il n'en reste
   * rien au bout de huit secondes. Un champ ne se defend pas, il se perd — et
   * c'est la difference entre les deux.
   */
  degatsParSeconde: { maison: 5, champ: 0.125 } as Readonly<Record<SorteDeFeu, number>>,
  /**
   * Ce qu'un feu perd tout seul par seconde, faute de quoi manger.
   *
   * Deux cent cinquante secondes pour mourir de sa belle mort, soit six fois le
   * temps qu'il lui faut pour abattre une maison : ignorer un feu coute
   * toujours le batiment, mais un feu perdu dans un coin ne brule pas jusqu'a
   * la fin de la partie.
   */
  epuisementParSeconde: 0.4,
  /**
   * Ce qu'un seau enleve.
   *
   * Neuf seaux pour un feu neuf : un habitant seul n'y arrive pas dans le temps
   * qu'il reste a la maison, trois ou quatre s'en sortent. C'est ce qui fait de
   * l'incendie une affaire de village et pas de bonne volonte.
   */
  pointsParSeau: 12,
  /**
   * Ce qu'un heros enleve par seconde, en restant contre le feu.
   *
   * Cinq secondes pour un feu neuf : le heros eteint vite — mais pendant ce
   * temps-la il n'est ni sur le front ni en train de commander, et la nuit
   * c'est exactement le choix que le §4.21 veut lui poser.
   */
  pointsHerosParSeconde: 20,
  /** Entre deux tentatives de prendre a cote, en millisecondes */
  delaiEntreEtincelles: 4_000,
  /**
   * La chance qu'une etincelle prenne chez un voisin, a chaque tentative.
   *
   * Un tiers toutes les quatre secondes : une maison voisine s'enflamme en une
   * douzaine de secondes en moyenne. Assez pour qu'un feu ignore devienne un
   * quartier, assez lent pour qu'un village qui court y arrive.
   */
  chanceDEtincelle: 0.35,
  /**
   * Jusqu'ou une etincelle porte : « deux cases » du §4.21, **mesurees de
   * centre a centre**.
   *
   * Une maison occupe deux cases de cote : deux cases entre deux *bords*, c'est
   * donc quatre cases entre deux *milieux*, et c'est le milieu que le noyau
   * connait. Mesure faite en jeu le 22 septembre 2026 : dans un vrai village,
   * une maison a sa plus proche voisine a 64, 91 ou 96 pixels — a deux cases
   * (64) le feu n'aurait saute qu'entre celles qui se touchent, ce qui n'est
   * pas ce que la section decrit.
   */
  porteeEtincelle: 4 * CASE,
  /**
   * La part de vie sous laquelle une maison attaquee peut prendre feu, et la
   * chance que ca arrive a chaque coup encaisse (§4.21).
   */
  seuilDuCoup: 0.3,
  chanceDuCoup: 0.5,
};

/** Ce que la sauvegarde garde du feu (§4.28). */
export interface EtatIncendie {
  foyers: Foyer[];
}

/**
 * Un coup encaisse par une maison met-il le feu ? (§4.21)
 *
 * La regle des monstres, en une fonction : **sous 30 % de vie, une fois sur
 * deux**. Elle vit ici et pas dans `Maisons` parce que c'est une regle de feu,
 * pas une regle de batiment — le jour ou un autre batiment brulera, elle ne
 * bougera pas.
 */
export function unCoupAllumeLeFeu(ratioPv: number, rng: Rng): boolean {
  if (ratioPv > REGLAGES_INCENDIE.seuilDuCoup) return false;
  return rng.chance(REGLAGES_INCENDIE.chanceDuCoup);
}

/**
 * Sous quoi un feu est mort.
 *
 * Pas zero : l'ardeur descend par soustractions de flottants (0,8 deux cent
 * cinquante fois), et il en reste toujours un milliardieme au bout. Un feu a
 * un milliardieme d'ardeur est eteint.
 */
const ETEINT = 1e-6;

/**
 * Les feux d'une partie.
 *
 * Une instance par partie, avancee une fois par seconde par la scene — jamais
 * par image.
 */
export class Incendie {
  private readonly liste: Foyer[] = [];
  /** L'horloge du passage, comme celle des champs (§4.17) */
  private prochainTick = 0;

  /** Tous les feux qui brulent, dans l'ordre ou ils ont pris. */
  get foyers(): readonly Foyer[] {
    return this.liste;
  }

  /** Quelque chose brule-t-il ? La question que le rendu et le son posent. */
  get actif(): boolean {
    return this.liste.length > 0;
  }

  /** Ce combustible-la brule-t-il deja ? */
  brule(cible: string): boolean {
    return this.liste.some((f) => f.cible === cible);
  }

  /** Le feu qui brule sur ce combustible, ou null. */
  foyerDe(cible: string): Foyer | null {
    return this.liste.find((f) => f.cible === cible) ?? null;
  }

  /**
   * Le feu le plus proche d'un point, a portee.
   *
   * C'est ce que l'habitant libre et le heros demandent : *ou est-ce que ca
   * brule pres de moi ?* Le noyau repond, la scene decide d'y aller.
   */
  leProcheDe(x: number, y: number, portee = Infinity): Foyer | null {
    let meilleur: Foyer | null = null;
    let meilleure = portee * portee;
    for (const foyer of this.liste) {
      const dx = foyer.x - x;
      const dy = foyer.y - y;
      const carre = dx * dx + dy * dy;
      if (carre > meilleure) continue;
      meilleure = carre;
      meilleur = foyer;
    }
    return meilleur;
  }

  /**
   * Un depart de feu.
   *
   * @returns le foyer neuf, ou `null` si cette chose brulait deja : deux
   *          sources qui tombent sur la meme maison ne font pas deux feux.
   */
  allumer(combustible: Combustible, maintenant: number): Foyer | null {
    if (this.brule(combustible.id)) return null;
    const foyer: Foyer = {
      cible: combustible.id,
      x: combustible.x,
      y: combustible.y,
      sorte: combustible.sorte,
      ardeur: REGLAGES_INCENDIE.ardeurAuDepart,
      ronge: 0,
      prochaineEtincelle: maintenant + REGLAGES_INCENDIE.delaiEntreEtincelles,
    };
    this.liste.push(foyer);
    return foyer;
  }

  /**
   * On jette de l'eau dessus : un seau d'habitant, une seconde de heros.
   *
   * @param extinction ce que le ciel multiplie (§4.21) : 2 sous la pluie
   * @returns vrai si le feu vient de s'eteindre
   */
  arroser(cible: string, points: number, extinction = 1): boolean {
    const foyer = this.foyerDe(cible);
    if (!foyer) return false;
    foyer.ardeur -= points * extinction;
    if (foyer.ardeur > ETEINT) return false;
    this.retirer(cible);
    return true;
  }

  /**
   * Le feu meurt faute de combustible : la maison est tombee, le champ est
   * noir. C'est la scene qui le sait, pas le noyau.
   */
  eteindre(cible: string): void {
    this.retirer(cible);
  }

  /** Tout s'arrete : une fin de partie, une reprise de sauvegarde. */
  toutEteindre(): void {
    this.liste.length = 0;
  }

  /**
   * Un passage du feu : ce qu'il ronge, ce qu'il gagne, ce qu'il perd.
   *
   * @param maintenant l'horloge de la partie, en millisecondes
   * @param extinction ce que le ciel multiplie a l'extinction (§4.21)
   * @param autour les combustibles auxquels le feu peut sauter — ceux qui
   *        brulent deja sont ignores, la scene n'a pas a les filtrer
   * @returns le passage, ou `null` si ce n'etait pas encore l'heure
   */
  avancer(maintenant: number, extinction: number, autour: readonly Combustible[], rng: Rng): PassageDuFeu | null {
    if (maintenant < this.prochainTick) return null;
    this.prochainTick = maintenant + REGLAGES_INCENDIE.tick;
    if (this.liste.length === 0) return null;

    const secondes = REGLAGES_INCENDIE.tick / 1000;
    const passage: PassageDuFeu = { degats: [], departs: [], eteints: [] };

    // ⚠️ **Une copie** : un feu qui prend a ce passage ne joue pas son tour
    // dans le meme passage, sinon un quartier entier s'enflamme en une seconde
    // par simple effet de boucle.
    for (const foyer of [...this.liste]) {
      const degats = REGLAGES_INCENDIE.degatsParSeconde[foyer.sorte] * secondes;
      foyer.ronge += degats;
      passage.degats.push({ cible: foyer.cible, sorte: foyer.sorte, degats });

      if (maintenant >= foyer.prochaineEtincelle) {
        foyer.prochaineEtincelle = maintenant + REGLAGES_INCENDIE.delaiEntreEtincelles;
        const depart = this.etinceler(foyer, maintenant, extinction, autour, rng);
        if (depart) passage.departs.push(depart);
      }

      foyer.ardeur -= REGLAGES_INCENDIE.epuisementParSeconde * secondes * extinction;
      if (foyer.ardeur <= ETEINT) {
        this.retirer(foyer.cible);
        passage.eteints.push(foyer);
      }
    }

    return passage;
  }

  /**
   * Le feu tente de prendre a cote : **un voisin par tentative**, le plus
   * proche a portee.
   *
   * Il ne tire pas sur tout ce qui l'entoure d'un coup — sinon la propagation
   * serait explosive au milieu du village et nulle sur les bords, alors que
   * c'est la meme flamme. Sous la pluie, la chance est divisee par ce que le
   * ciel eteint : une averse ne sauve pas la maison qui brule, elle sauve la
   * voisine.
   */
  private etinceler(
    foyer: Foyer,
    maintenant: number,
    extinction: number,
    autour: readonly Combustible[],
    rng: Rng,
  ): Foyer | null {
    if (!rng.chance(REGLAGES_INCENDIE.chanceDEtincelle / extinction)) return null;

    const portee = REGLAGES_INCENDIE.porteeEtincelle;
    let proche: Combustible | null = null;
    let meilleure = portee * portee;
    for (const candidat of autour) {
      if (candidat.id === foyer.cible) continue;
      if (this.brule(candidat.id)) continue;
      const dx = candidat.x - foyer.x;
      const dy = candidat.y - foyer.y;
      const carre = dx * dx + dy * dy;
      if (carre > meilleure) continue;
      meilleure = carre;
      proche = candidat;
    }

    return proche ? this.allumer(proche, maintenant) : null;
  }

  private retirer(cible: string): void {
    const index = this.liste.findIndex((f) => f.cible === cible);
    if (index >= 0) this.liste.splice(index, 1);
  }

  /** Ce que la sauvegarde garde (§4.28). */
  get instantane(): EtatIncendie {
    return { foyers: this.liste.map((f) => ({ ...f })) };
  }

  /**
   * Les feux d'une partie qu'on reprend.
   *
   * ⚠️ **Les horloges sont relatives a la partie**, pas au monde : une partie
   * rechargee repart d'un `maintenant` neuf, donc la prochaine etincelle se
   * recale sur lui. Sans ca, un feu sauve a la dixieme minute ne tenterait plus
   * rien pendant dix minutes apres la reprise.
   */
  reprendre(etat: EtatIncendie | undefined, maintenant: number): void {
    this.liste.length = 0;
    this.prochainTick = maintenant;
    if (!etat) return;
    for (const foyer of etat.foyers) {
      this.liste.push({ ...foyer, prochaineEtincelle: maintenant + REGLAGES_INCENDIE.delaiEntreEtincelles });
    }
  }
}
