/**
 * Les réglages et les petites pièces de l'arène : constantes, fonctions et types partagés
 * par la scène et ses systèmes (`ArenaScene.ts` et `arene/*.ts`). Sortis tels quels du
 * haut d'`ArenaScene.ts` au ménage du 9 novembre 2026.
 */
import { competenceParId, ID_EMPLACEMENT } from "../../core/competences";
import { Ennemi, Hero } from "../../game/entities";
import { VILLAGE } from "../../core/carte";
import {
  CONDITIONS,
  lireCout,
  type BlocageMontee,
  type EtatEglise,
  type NiveauEglise,
} from "../../core/eglise";
import { REGLAGES_CYCLE } from "../../core/cycle";
import { CASE } from "../../core/grille";
import { type TypeConstruction } from "../../core/constructions";
import { type Champ } from "../../game/champs";
import { Maison } from "../../game/maisons";
import type { Habitant, Ressource, Stocks } from "../../core/habitants";
import type { Phase } from "../../core/cycle";
import { RATIO } from "../../game/ui/ecran";

/**
 * Le village remplace la cite au centre de l'arene : il est desormais adosse a
 * la mer et a la montagne (DESIGN.md §4.6). Le reste du code continue de
 * l'appeler CITE — c'est le meme refuge, il a juste demenage.
 */
export const CITE = VILLAGE;
// La regeneration n'est plus une constante de scene : elle appartient a
// l'eglise et monte avec elle (`PALIERS[n].soinParSeconde`, §4.22).
export const PORTEE_CORPS_A_CORPS = 90;

/**
 * Plafond d'ennemis vivants.
 *
 * Sans lui, la cadence d'apparition finit par depasser la vitesse a laquelle on
 * tue : les sprites s'accumulent, et le jeu s'effondre au bout de quelques
 * minutes. Le plafond ne rend pas le jeu plus facile — les ennemis restants
 * deviennent simplement plus forts.
 *
 * Il vaut desormais 60 et non 240 : le §4.19 fait baisser fortement le nombre a
 * l'ecran, et la difficulte remonte par la force des monstres. C'est aussi une
 * regle de lisibilite — a 240 on ne voyait plus le terrain qu'on defend.
 */
export const MAX_ENNEMIS = REGLAGES_CYCLE.plafondEcran;

/** Ce que le voile de nuit atteint au plus noir (`teinterLeCiel`). */
export const NUIT_PLEINE = 0.55;

/**
 * Rayon dans lequel le heros incarne recolte a la main, autour d'un poste.
 *
 * Il recolte en frappant : on s'approche, l'attaque automatique s'en charge, et
 * aucune touche ne s'ajoute (§4.18).
 */
export const RAYON_RECOLTE = 46;

/**
 * Rayon dans lequel on eteint un feu, heros comme habitant (§4.21).
 *
 * Le meme que la recolte, a quelques pixels pres : on se met **contre** le feu,
 * on ne l'arrose pas de l'autre bout de la place. C'est ce qui fait qu'eteindre
 * coute une position, et donc qu'eteindre la nuit soit un choix.
 */
export const RAYON_DU_SEAU = 54;

/**
 * Jusqu'ou un habitant court pour eteindre : six cases (§4.21).
 *
 * C'est le chiffre de la section, et il dit quelque chose du village : un feu
 * de l'autre bout ne mobilise personne, et un village etale se defend moins
 * bien de ses propres flammes qu'un village serre.
 */
export const PORTEE_DE_LA_COURSE = 6 * CASE;

/**
 * L'identite d'une chose qui brule (§4.21).
 *
 * Elle tient a sa **case**, pas a l'objet : une maison ne se deplace qu'en mode
 * d'amenagement, et un champ pas du tout. La cle survit donc a une sauvegarde,
 * ce qu'une reference d'objet ne sait pas faire.
 */
export function cleDuFeu(objet: Maison | Champ): string {
  return objet instanceof Maison
    ? `m${objet.colonne}:${objet.ligne}`
    : `c${Math.round(objet.x)}:${Math.round(objet.y)}`;
}

/**
 * Ce qu'une minute de travail coute a un heros, en points de stress
 * (DESIGN.md §4.4) — *chiffre tranche par le code, a corriger en jouant*.
 *
 * 2,2 par minute : une journee entiere de 10 minutes passee a un poste lui en
 * met 22, sur les 100 qui le font craquer et les 60 a partir desquels ca se
 * voit sur sa fiche. Trois journees de suite et il arrive a la nuit visiblement
 * use ; une seule ne se paie presque pas. C'est le prix que le §4.4 demande :
 * « le travail se paie en puissance », sans que ce soit une punition.
 *
 * A comparer : `REGLAGES_STRESS.travailSansRepos` vaut 0,1 pour un habitant.
 * Un heros abat quinze fois plus de travail ; il le paie quinze fois plus cher.
 */
export const STRESS_DU_TRAVAIL = 2.2;

/**
 * Combien de heros peuvent etre dehors en meme temps (DESIGN.md §4.15).
 *
 * ⚠️ **La garnison n'existe pas encore.** Le §4.15 dit « dix dehors, le reste
 * en garnison » ; tant que la garnison n'est pas codee, un onzieme don ne
 * s'eveille pas, et le jeu le dit. Mieux vaut un don qui attend qu'un heros
 * qu'on ne peut ni voir ni commander.
 */
export const EFFECTIF_MAXIMUM = 10;

/** Ce que l'interface lit du village, sans pouvoir y toucher. */
export interface EtatVillage {
  phase: Phase;
  jour: number;
  /** Avancement dans la phase, entre 0 et 1 */
  part: number;
  /** Temps restant avant la bascule, en millisecondes */
  restant: number;
  population: number;
  /** Vrai si quelqu'un court en ce moment : c'est ce qui fait clignoter */
  enFuite: boolean;
  habitants: Habitant[];
  stocks: Stocks;
  joursDeVivres: number;
  /**
   * La satisfaction du village, de 0 a 100 (DESIGN.md §4.23).
   *
   * Elle n'est pas decorative : c'est **elle qui debloque les niveaux
   * d'eglise**, et c'est ce qui referme la boucle du village.
   */
  satisfaction: number;
  /** L'eglise, telle que l'interface la lit (DESIGN.md §4.22) */
  eglise: {
    niveau: NiveauEglise;
    etat: EtatEglise;
    ratioPv: number;
    partRelevement: number;
    /** Combien d'habitants sont dedans en ce moment */
    refugies: number;
    /** Combien tiennent ses portes */
    defenseurs: number;
    /** Ce qui empeche le niveau suivant, vide si rien */
    manque: BlocageMontee[];
  };
}

/**
 * Jusqu'ou un monstre voit un heros (DESIGN.md §4.6).
 *
 * Au-dela, il ne le poursuit pas : il continue vers le village. C'est ce seul
 * nombre qui empeche le camping de fonctionner — un heros planque a l'autre bout
 * de la carte ne detourne plus personne des postes de travail.
 */
export const RAYON_DE_VUE = 340;

/**
 * Ce qu'une touche pose sur la grille, par action (§4.10, §4.24).
 *
 * ⚠️ **Ce sont des identifiants d'action, plus des codes de touche** : depuis le
 * bloc 10 le joueur remappe, et une liste de codes serait devenue fausse au
 * premier remappage.
 */
export const CONSTRUCTIONS_A_LA_TOUCHE: [string, ModeBati][] = [
  ["palissade", "palissade"],
  ["tour", "tour"],
  ["champ", "champ"],
  ["porte", "porte"],
  ["maison", "maison"],
  ["douve", "douve"],
  // La cour d'entrainement : le batiment du bloc 9, un seul par village.
  ["cour", "cour"],
];

/**
 * Les seules actions qui restent vivantes sous la pause du mode d'amenagement.
 *
 * Ce sont celles qui choisissent **quoi poser**. Tout le reste doit rester
 * bloque : la cloche, les postures ou l'eglise n'ont aucun sens pendant que le
 * temps est arrete (§4.24).
 *
 * ⚠️ **La cour y entre le 21 septembre 2026.** Elle manquait depuis le bloc 9 —
 * un simple oubli : on ne pouvait pas choisir de poser une cour une fois entre
 * en amenagement, alors que les six autres constructions le permettaient.
 */
export const CHOISIR_QUOI_POSER: string[] = CONSTRUCTIONS_A_LA_TOUCHE.map(([action]) => action);

/**
 * Ce qu'un mort laisse derriere lui (DESIGN.md §4.26, bloc 11).
 *
 * **Sa meilleure competence, et rien de materiel.** Il n'y a pas d'equipement
 * dans ce jeu, et le §4.26 refuse explicitement d'en inventer un ici.
 *
 * Un habitant ne legue rien de ce genre : il n'a pas de competence. Il laisse
 * quand meme une tombe, une trace aux archives et un trait a ceux qui
 * l'aimaient — c'est le reste de la fonction qui s'en charge.
 */
export function competenceALeguer(hero: Hero): string | null {
  let meilleure: string | null = null;
  let palier = 0;
  for (const [id, atteint] of Object.entries(hero.competences)) {
    if (atteint <= palier) continue;
    // On ne legue pas un emplacement achete : ce n'est pas un savoir-faire.
    if (id === ID_EMPLACEMENT) continue;
    // Ni une fusion, qui ne tient que par ce qu'elle a fondu, ni ce qu'elle a
    // fondu (§4.25) : son heritier la decouvrira, ou pas.
    if (hero.fondues[id] !== undefined || competenceParId(id)?.fusion) continue;
    meilleure = id;
    palier = atteint;
  }
  return meilleure;
}

/**
 * Combien de tombes tiennent sur la carte a la fois (§4.17, §4.26).
 *
 * Une borne dure, comme partout : une partie de cinquante nuits enterrerait
 * autrement des centaines de sprites qui ne servent plus qu'a exister. Au-dela,
 * la plus ancienne s'efface — le souvenir, lui, reste sur les fiches.
 */
export const TOMBES_MAX = 24;

/**
 * Combien d'histoires le tableau du village montre (§4.26).
 *
 * Les plus recentes. Une partie de cinquante nuits en produit trop pour une
 * plaque, et les archives gardent tout de toute facon.
 */
export const ARCHIVES_MONTREES = 6;

/**
 * Ce que les initiatives coutent et rapportent (§4.27, bloc 12).
 *
 * *Chiffres tranches par le code, a corriger en jouant.* Un discours rend
 * l'equivalent de vingt minutes de repos a tout le monde ; un kleptomane
 * emporte de quoi nourrir quelqu'un pendant une journee.
 */
export const DISCOURS_RENDU = 8;
export const VOL_DU_KLEPTOMANE = 8;
export const VOL_RENDU = 12;
/** Au-dela de tant de journees de vivres d'avance, les reserves sont pleines */
export const JOURS_POUR_UN_STOCK_PLEIN = 8;

/**
 * Ce qu'il faut pour qu'une nuit entre dans les archives (§4.26).
 *
 * *Chiffres tranches par le code, a corriger en jouant.* Trois morts d'un coup
 * dans un village qui en compte six, c'est un massacre ; une nuit sans perte
 * avec trente monstres au sol, c'est une nuit dont on parle. Entre les deux,
 * c'est une nuit, et le village n'en fait pas une histoire.
 */
export const MORTS_POUR_UN_MASSACRE = 3;
export const ELIMINES_POUR_UNE_VICTOIRE = 30;
export const AFFAMES_POUR_UNE_FAMINE = 2;

/**
 * Les dix touches de capacite, dans l'ordre (§4.13) : l'ultime, puis neuf
 * actives au plus — quatre, trois de Touche-a-tout, deux achetees (§4.23).
 */
export const ACTIONS_CAPACITE: string[] = [
  "capacite1",
  "capacite2",
  "capacite3",
  "capacite4",
  "capacite5",
  "capacite6",
  "capacite7",
  "capacite8",
  "capacite9",
  "capacite10",
];

/**
 * Ce qu'on peut poser sur la grille.
 *
 * Un champ n'est pas une construction — il ne bloque rien, il n'a pas de points
 * de vie, et on le traverse. Mais il se pose exactement de la meme facon, alors
 * il partage le meme mode et le meme apercu.
 */
export type ModeBati = TypeConstruction | "champ" | "maison" | "cour";

/**
 * La part des monstres qui viennent piller (§4.24, 19 septembre 2026) : ils
 * visent la maison debout la plus proche au lieu de l'eglise. Le reste marche
 * sur l'eglise comme avant — c'est elle le cap, et la ligne a tenir (§4.22).
 *
 * ⚠️ **0,4 jusqu'au 9 novembre 2026.** Le robot du jalon 6.4 voyait l'eglise tomber dans
 * 35 parties sur 42 vers la nuit 3,5, meme defendue et relevee, et sa chute decider de la
 * partie. Angelos a tranche : les monstres la visent moins. La moitie pille, un
 * cinquieme chasse les heros (`PART_DE_CHASSEURS`), il en reste trois sur dix pour elle.
 */
export const PART_DE_PILLARDS = 0.5;

/**
 * La part des monstres qui chassent les heros (9 novembre 2026, meme decision) : ils
 * voient un heros `VUE_DU_CHASSEUR` fois plus loin que les autres et vont sur lui ;
 * sans heros en vue, ils marchent sur l'eglise comme le reste.
 */
export const PART_DE_CHASSEURS = 0.2;

/**
 * Jusqu'ou voit un chasseur, en multiple de `RAYON_DE_VUE`. Deux fois : il repere le
 * heros qui tient la place, pas celui qui campe a l'autre bout de la carte.
 */
export const VUE_DU_CHASSEUR = 2;

/** Ce que chaque poste donne au joueur qui y frappe (DESIGN.md §4.18). */
export const RECOLTE_DU_POSTE: Record<"pecheur" | "bucheron" | "mineur", Ressource> = {
  pecheur: "poisson",
  bucheron: "bois",
  mineur: "minerai",
};

/** Au-dela, on cesse d'afficher les nombres flottants : ils coutent cher. */
export const MAX_TEXTES_FLOTTANTS = 24;

/**
 * Cadavres qui tombent en meme temps.
 *
 * Une capacite de zone tue parfois trente monstres dans la meme image : sans
 * plafond, ca ferait trente sprites et trente tweens d'un coup. Au-dela, le
 * pouf de particules suffit a raconter la mort.
 */
export const MAX_CADAVRES = 24;

/** Impulsion rendue a un heros qui encaisse, en pixels par seconde. */
export const FORCE_RECUL = 110;

/**
 * Vitesse d'un crachat de monstre, en pixels par seconde.
 *
 * ⚠️ **210 jusqu'au 9 novembre 2026** : le crachat faisait plus de la moitie des morts du
 * robot (22 sur 42). Angelos a tranche : plus lent, pour qu'on l'esquive — un tiers de
 * moins, pres de deux secondes de vol a la portee du cracheur. Le robot, lui, n'esquive
 * pas : ses chiffres n'en bougeront guere, ceux d'un joueur si.
 */
export const VITESSE_CRACHAT = 140;

/** Rayon de l'explosion d'un kamikaze, en pixels. */
export const RAYON_KAMIKAZE = 92;

/** Mort-vivants simultanes par Necromancien */
export const MAX_MORTS_VIVANTS = 12;

/**
 * Les morts-vivants avec lesquels un Necromancien commence une partie neuve (§4.14).
 *
 * Il n'attaque jamais et vit de ses morts (8 % des cadavres) ; choisi au depart, il etait
 * seul, personne ne faisait de cadavres, et le robot du jalon 6.4 le voyait tomber la nuit
 * 1 ou 2 dans six parties sur six. Angelos a tranche le 9 novembre 2026 : une petite armee
 * de depart. Quatre, le tiers de son plafond : de quoi tenir la premiere nuit et faire ses
 * premiers cadavres, pas de quoi jouer la partie a sa place (le taux de 25 % avait ete
 * retire pour ca).
 */
export const ARMEE_DE_DEPART = 4;

/**
 * Combien de fois plus de vie ont ces quatre-la (9 novembre 2026). A ~22 PV au niveau 1,
 * ils mouraient dans les premieres escarmouches du premier jour, et le Necromancien tombait
 * toujours la nuit 1 ou 2 : Angelos a tranche pour une armee de depart trois fois plus
 * solide. Leurs forces restent celles de sa naissance — ils ne grandissent pas avec lui.
 */
export const SOLIDITE_DE_L_ARMEE = 3;

/**
 * Le zoom de depart, et ses bornes.
 *
 * Il valait 3 du temps des placeholders, qui faisaient 18 px de haut : un heros
 * occupait donc une cinquantaine de pixels a l'ecran. Les sprites de
 * `src/assets/` en font 32, et on les affiche a leur taille native — les
 * reduire d'un facteur fractionnaire les transformerait en bouillie, et meme
 * une reduction de moitie leur mange la tete.
 *
 * C'est donc le zoom qui absorbe la difference : a 1,7 un heros retrouve ses
 * cinquante pixels a l'ecran. **L'empreinte visible est la meme qu'avant**, et
 * aucune donnee de jeu n'a bouge — ni vitesse, ni portee, ni hitbox.
 */
/**
 * ⚠️ **Ces trois valeurs portent le ratio de l'ecran** (`ui/ecran.ts`).
 *
 * Depuis le 21 septembre 2026, le repere du jeu compte en **vrais pixels** :
 * sur un ecran a 200 %, il en faut deux pour couvrir un pixel d'interface. Sans
 * ce facteur, le monde s'afficherait a la moitie de sa taille et le heros
 * ferait vingt-cinq pixels a l'ecran au lieu de cinquante.
 *
 * Les scenes d'interface reglent ca avec une camera zoomee (`calerLaCamera`) ;
 * l'arene ne le peut pas, sa camera suit deja le heros et porte le zoom libre
 * du joueur. Elle le porte donc ici, une fois pour toutes.
 */
export const ZOOM_DEFAUT = 1.7 * RATIO;
export const ZOOM_MIN = 0.8 * RATIO;

/**
 * Le voile entre deux mondes, en millisemes (§4.29, l'errance continue).
 *
 * ⚠️ **220, pas 700.** Le fondu d'avant devait couvrir la cuisson de la carte,
 * deux a trois secondes ; il ne couvre plus qu'un remontage de scene de deux ou
 * trois dixiemes. Un voile de sept dixiemes de seconde a chaque bord de carte,
 * quand on en traverse sept d'affilee apres un troisieme refus, c'est dix
 * secondes d'ecran noir pour rien.
 */
export const DUREE_DU_VOILE = 220;
export const ZOOM_MAX = 3.4 * RATIO;

/**
 * De combien il faut s'eloigner de la ou l'on a paru avant que quitter la
 * carte veuille dire « je passe au large » (§4.29).
 *
 * Vingt cases : on parait a quarante pixels d'un bord, et il ne faut pas
 * qu'un pas de trop dans la mauvaise direction, la premiere seconde, envoie
 * au monde suivant.
 */
export const DISTANCE_D_ARMEMENT = 640;

/**
 * La puissance d'un habitant qui se jette sur nous (§4.29).
 *
 * La meme echelle que celle d'une vague : a 2, il tient une vingtaine de points
 * de vie et frappe pour huit. Un heros de depart en a cent trente et en met
 * treize — donc **trois habitants sont un vrai combat et pas une execution**,
 * et une douzaine tuerait. C'est exactement le risque que le §4.29 veut faire
 * peser sur un refus en face.
 */
export const PUISSANCE_DES_HABITANTS = 2;

/**
 * Tous les combien le champ de directions des humains peut se refaire, en ms.
 *
 * Une propagation balaye toute la grille : la relancer a chaque image pendant
 * qu'on court serait l'ajout non plafonne que le §4.17 interdit. Un tiers de
 * seconde suffit — a 108 px/s, on n'a pas parcouru une case et demie.
 */
export const PERIODE_CHEMIN_DES_HUMAINS = 330;

/**
 * Part de la direction demandee par l'IA reprise a chaque image.
 *
 * Assez haut pour que le heros reste reactif, assez bas pour qu'un changement
 * de cible ne se traduise pas par un demi-tour instantane.
 */
export const LISSAGE_DIRECTION = 0.18;

/**
 * Pourquoi l'eglise refuse de monter, ecrit pour un humain (DESIGN.md §4.22).
 *
 * Quatre conditions dont on ne saurait pas laquelle bloque seraient
 * injouables : le refus doit toujours nommer ce qui manque, et le chiffre avec.
 *
 * @param niveauVise le niveau qu'on essaie d'atteindre
 */
export function lireBlocages(manque: BlocageMontee[], niveauVise: 2 | 3 | 4): string {
  const requis = CONDITIONS[niveauVise];
  const mots = manque.map((cause) => {
    switch (cause) {
      case "materiaux":
        return lireCout(requis.materiaux);
      case "population":
        return `${requis.population} habitants`;
      case "argent":
        return `${requis.argent} pieces`;
      case "satisfaction":
        return `${requis.satisfaction}% de satisfaction`;
      case "a-terre":
        return "qu'elle soit relevee";
      default:
        return "rien, elle est au maximum";
    }
  });
  return mots.join(", ");
}

/** Ce que l'Heure sombre fait d'un monstre : le temps ne passe plus pour lui. */
export const TEINTE_FIGEE = 0x6b6478;

/** Une epee du Moulin a lames partie rebondir (§4.25). */
export interface VolDEpee {
  hero: Hero;
  debut: number;
  /** D'ou elle part, puis chaque ennemi a frapper, dans l'ordre */
  depart: { x: number; y: number };
  cibles: Ennemi[];
  /** Ceux qu'elle a deja frappes */
  frappes: number;
  degats: number;
}

/** Un ralenti du Temps fracture : chaque mort dedans rend du temps a son Sablier. */
export interface ZoneFracturee {
  hero: Hero;
  x: number;
  y: number;
  rayon: number;
  fin: number;
  rendu: number;
}
