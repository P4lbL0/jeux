import type { Toile } from "./pinceau";
import { CHAIR, CONTOUR, SANG, melanger, palir, type Matiere } from "./palette";

/**
 * **Le corps humain, et il n'y en a qu'un** (DESIGN.md §4.30).
 *
 * ⚠️ **C'est le fichier le plus important du bloc.** Le §4.30 demande que les
 * heros soient redessines « dans le langage des villageois », et le §4.18 dit
 * pourquoi : *un heros est un villageois qui a appris*. Une intention pareille ne
 * survit pas a deux fichiers de dessin — au premier reglage, les deux
 * populations divergent, et le passage villageois → heros du bloc 9 ne se lit
 * plus.
 *
 * Ici, il n'y a **rien a diverger** : la meme fonction dessine les deux, et ils
 * ne different que par ce qu'ils **portent**. Le jour ou un habitant devient
 * heros, on ne redessine rien, on lui met une arme dans la main.
 */

/**
 * La geometrie, en pixels de la frame. Tout le dessin s'y accroche.
 *
 * ⚠️ **Le cadre est passe de 32 a 20 le 11 septembre 2026**, sur les captures :
 * « les personnages sont trop grands par rapport aux maisons ». Un habitant
 * faisait 24 px pour une maison de 40 — plus de la moitie d'une facade. Il en
 * fait desormais 14 : un peu plus du tiers, ce qu'on attend d'un village vu de
 * haut. Le joueur **zoome** pour les voir de pres ; la carte, elle, ne bouge pas
 * d'un pixel (la case reste 32, une maison reste deux cases).
 *
 * Tout ce qui suit est exprime par `K`, le rapport au dessin d'origine : c'est
 * ce qui garde les proportions du corps quand on change sa taille. Les
 * epaisseurs et les details d'un pixel, eux, ne descendent jamais sous un pixel.
 */
export const CADRE = 20;
/** Le rapport au dessin d'origine, qui etait ecrit pour 32. */
export const K = CADRE / 32;
/**
 * Le milieu du corps : un pixel a gauche du centre du cadre. Tout ce qu'on
 * tient part vers l'avant — la droite — et c'est de ce cote qu'il manque de
 * place a 20 px ; un corps voute qui frappe de la pioche sortait du cadre.
 */
const MILIEU = CADRE / 2 - 1;
/**
 * Le sol : trois pixels au-dessus du bord bas. Le pied, son contour, et un
 * pixel d'air — a 20 px il n'y a plus la marge du dessin de 32, ou le sol
 * tombait quatre pixels au-dessus du bord.
 */
const SOL = CADRE - 3;
const HANCHE = SOL - 7 * K;
const EPAULE = HANCHE - 7 * K;
/** Largeur du torse : elle decide de la carrure, donc de qui est humain. */
const CARRURE = 6;
/** Longueur d'un bras. Court : c'est le seul moyen que l'arme tienne dedans. */
const BRAS = 5 * K;
/**
 * A quelle distance du milieu le bras s'attache.
 *
 * ⚠️ **Il doit tomber sur le bord du torse, pas dedans.** Au premier jet il
 * valait 3 pour une carrure de 10 : le bras restait **a l'interieur de la
 * silhouette** a chaque angle modere, donc il ne se voyait pas, donc le
 * balancement de la marche n'existait pas a l'ecran. Six frames pour rien — et
 * ca ne se voyait qu'en regardant l'image, jamais dans un test.
 */
const EMMANCHURE = CARRURE / 2;
/**
 * Le rayon de la tete, et la longueur du cou.
 *
 * Le cou est plus court que le rapport ne le voudrait (4 et non 5) : a cette
 * taille la tete doit **s'asseoir** sur les epaules, sinon un pixel d'air la
 * detache du corps et le chapeau sort du cadre au moindre sursaut.
 */
const TETE = 3.2 * K;
const COU = 4 * K;

/**
 * La pose du corps a un instant donne.
 *
 * ⚠️ **Les angles sont en radians, 0 vers le bas** — un bras au repos pend. Les
 * valeurs positives vont vers l'avant d'un personnage qui regarde a droite ;
 * `setFlipX` s'occupe de l'autre sens, comme pour tous les combattants.
 */
export interface Attitude {
  /**
   * Inclinaison du buste autour de la hanche.
   *
   * ⚠️ **Bornee** : un corps ne se plie pas indefiniment, et surtout, l'usure
   * s'ajoute a l'inclinaison de chaque geste. Sans borne, un villageois use qui
   * frappe a la pioche sort du carreau de 32 — mesure, et tenu par un test.
   */
  buste: number;
  /** Inclinaison de la tete, en plus de celle du buste. */
  tete: number;
  /**
   * L'angle du bras, **absolu** — il ne s'ajoute pas a celui du buste.
   *
   * C'etait l'inverse au premier jet, et c'etait faux : l'amplitude d'un coup
   * depend alors de la posture de celui qui le porte, donc un personnage voute
   * frappait plus loin devant lui qu'un personnage droit, jusqu'a sortir du
   * cadre. Un geste decrit son propre arc.
   */
  brasAvant: number;
  brasArriere: number;
  jambeAvant: number;
  jambeArriere: number;
  /** Deplacement vertical du corps, en pixels. Negatif = en l'air. */
  sursaut: number;
  /** Tient-il quelque chose ? L'outil du villageois, l'arme du heros. */
  outil: boolean;
}

/** Jusqu'ou un corps se plie. Au-dela, il sort de son carreau. */
export const DOS_MAXIMUM = 0.4;

export function borner(a: Attitude): Attitude {
  return { ...a, buste: Math.min(a.buste, DOS_MAXIMUM) };
}

/** La posture de base, celle dont tous les gestes partent. */
export function debout(usure: number): Attitude {
  // L'usure se lit d'abord dans le dos : il se voute, et ca se voit de loin bien
  // avant la pâleur.
  const dos = usure * 0.25;
  return {
    buste: dos,
    tete: usure * 0.15,
    brasAvant: dos + 0.12,
    brasArriere: dos - 0.12,
    jambeAvant: 0.06,
    jambeArriere: -0.06,
    sursaut: 0,
    outil: false,
  };
}

/**
 * La quinte de toux — **et elle appartient a tout le monde** (§4.23).
 *
 * ⚠️ Elle a d'abord ete ecrite chez le villageois seul, et c'etait une erreur de
 * lecture du design : le §4.23 donne les maladies et les etats aux **personnes**,
 * pas aux habitants. `core/personne.ts` porte deja les deux populations sous un
 * seul systeme depuis le bloc 5 — un heros attrape la fievre exactement comme un
 * civil, et il n'y avait aucune raison qu'il ne tousse pas.
 *
 * Il plie vite et se redresse lentement. L'inverse ferait un salut.
 */
export function tousser(repos: Attitude, avancement: number): Attitude {
  const spasme = Math.sin(Math.min(1, avancement * 1.2) * Math.PI);
  return borner({
    ...repos,
    // Bornee sous DOS_MAXIMUM pour un corps neuf : une quinte qui tape le
    // plafond du pliage se lit comme une simple inclinaison, elle ne monte plus.
    // Un corps deja voute, lui, y touche — et c'est juste, on ne se plie pas
    // deux fois.
    buste: repos.buste + spasme * 0.34,
    tete: repos.tete + spasme * 0.3,
    // La main devant la bouche : sans elle, il s'incline, il ne tousse pas.
    brasAvant: repos.brasAvant - spasme * 1.75,
    brasArriere: repos.brasArriere - spasme * 0.3,
    jambeAvant: 0.1,
    jambeArriere: -0.1,
  });
}

/** Ce qu'on a sur la tete : c'est ce qui dit qui on est, a petite taille. */
export type Coiffe =
  /** Bord plat : le villageois, et lui seul. */
  | { genre: "chapeau"; matiere: Matiere }
  /** Calotte fermee qui descend sur la nuque : le heros a partir du palier 1. */
  | { genre: "casque"; matiere: Matiere }
  /** Rien : le heros de palier 0, tete nue. */
  | { genre: "nu" };

/** Ce qu'un corps porte. **C'est tout ce qui distingue deux personnes.** */
export interface Apparence {
  /** Le vetement du torse. */
  tunique: Matiere;
  /**
   * Les jambes. Omises, elles prennent la matiere de la tunique.
   *
   * ⚠️ **Un corps d'une seule valeur se lit comme un bloc, pas comme quelqu'un.**
   * Le villageois marche parce qu'il en a deux — tunique sombre, tablier clair.
   * Les heros, peints d'une seule teinte de classe du col aux pieds, sont sortis
   * de la premiere planche en pates de couleur : on ne voyait ni leur taille, ni
   * leurs jambes, ni leur pas. Des jambes sombres leur rendent exactement la
   * structure qui rend le villageois lisible.
   */
  jambes?: Matiere;
  /** Le tablier du villageois, le plastron du heros. Absent : torse nu de tissu. */
  ventre?: Matiere;
  coiffe: Coiffe;
  /** Une cape, peinte derriere le corps. Le palier 3 des heros. */
  cape?: Matiere;
  /** De 0 a 1 : l'usure palit la chair et creuse les cernes (§4.23). */
  usure: number;
  /** De 0 a 1 : le sang d'un blesse. */
  sang: number;
  /** Un liseré de laiton sur l'epaule. **Le palier 4, et lui seul** (§4.10). */
  laiton?: number;
  /**
   * La couleur des yeux. Omise, ils sont du contour — deux points sombres.
   *
   * Un mort qui marche a les yeux allumes : c'est la seule chose qui le
   * distingue d'un vivant a 32 px, et la seule qu'il faut voir la nuit.
   */
  yeux?: number;
}

/** Ou se trouvent les points d'accroche apres coup : la main tient l'arme. */
export interface Attaches {
  main: { x: number; y: number };
  mainArriere: { x: number; y: number };
  epaule: { x: number; y: number };
  /** Ou le bras arriere s'attache : le bouclier se porte sur l'avant-bras. */
  epauleArriere: { x: number; y: number };
}

/**
 * Peint un corps humain, et rend ses points d'accroche.
 *
 * L'ordre de peinture est du **contenu**, pas du detail — c'est la lecon du
 * bloc 5, ou la barbe dessinee apres la bouche effacait entierement la bouche.
 * Ici : l'ombre, la cape, les jambes, le bras arriere, le torse, la tete, le
 * bras avant. Tout ce qui est devant se peint apres.
 */
export function peindreCorps(toile: Toile, a: Attitude, tenue: Apparence): Attaches {
  const chair = palir(CHAIR, tenue.usure);
  const tunique = tenue.tunique;

  // L'ombre d'abord, et elle **ne suit pas le sursaut** : c'est ce qui fait
  // qu'on voit le personnage decoller au lieu de glisser.
  toile.ombreAuSol(MILIEU, SOL, 8 * K, 2.5 * K);

  const hancheY = HANCHE + a.sursaut;
  const buste = HANCHE - EPAULE;
  // Le buste tourne autour de la hanche : l'epaule part en avant, et descend
  // d'autant qu'elle s'est avancee.
  const penche = Math.sin(a.buste) * buste;
  const epauleX = MILIEU + penche;
  const epauleY = EPAULE + a.sursaut + (1 - Math.cos(a.buste)) * buste;

  // La cape passe derriere tout, jambes comprises : elle tombe des epaules.
  if (tenue.cape) peindreCape(toile, epauleX, epauleY, hancheY, tenue.cape);

  // Les jambes passent sous le torse : la plus eloignee d'abord. Deux pixels
  // d'epaisseur, et **un pixel d'ecart entre les deux** : plus serrees, elles se
  // fondent en un seul bloc et le pas disparait.
  const jambes = tenue.jambes ?? tunique;
  const jambe = 7 * K;
  toile.membre(MILIEU - 1.5, hancheY, jambe, a.jambeArriere, 1.8, jambes.sombre);
  toile.membre(
    MILIEU + 1.5,
    hancheY,
    jambe,
    a.jambeAvant,
    1.8,
    melanger(jambes.corps, jambes.sombre, 0.4),
  );

  // Le bras arriere passe derriere le torse, donc il se peint avant lui.
  const mainArriere = toile.membre(
    epauleX - EMMANCHURE,
    epauleY,
    BRAS,
    a.brasArriere,
    1.4,
    tunique.sombre,
  );

  peindreTorse(toile, epauleY, hancheY, penche, tenue);
  peindreTete(toile, epauleX, epauleY, a, chair, tenue);

  const main = toile.membre(epauleX + EMMANCHURE, epauleY, BRAS, a.brasAvant, 1.4, tunique.corps);
  toile.point(main.x, main.y, chair.corps);

  return {
    main,
    mainArriere,
    epaule: { x: epauleX, y: epauleY },
    epauleArriere: { x: epauleX - EMMANCHURE, y: epauleY },
  };
}

function peindreCape(
  toile: Toile,
  epauleX: number,
  epauleY: number,
  hancheY: number,
  cape: Matiere,
): void {
  // Elle s'evase en tombant : une cape a largeur constante est une planche.
  const bas = Math.round(hancheY + 5 * K);
  const haut = Math.round(epauleY) - 1;
  for (let y = haut; y <= bas; y += 1) {
    const part = (y - haut) / Math.max(1, bas - haut);
    const demi = (3.5 + part * 2.5) * K;
    toile.segment(epauleX - demi, y, epauleX + demi, y, 1, cape.sombre);
    toile.point(epauleX - demi + 1, y, cape.corps);
  }
}

function peindreTorse(
  toile: Toile,
  epauleY: number,
  hancheY: number,
  penche: number,
  tenue: Apparence,
): void {
  const bas = Math.round(hancheY) + 1;
  const haut = Math.round(epauleY) - 1;
  const hauteur = Math.max(1, bas - haut);
  // Le ventre clair : c'est lui qui donne au corps sa silhouette a deux valeurs,
  // celle qu'on reconnait de loin.
  //
  // ⚠️ **Un tiers du torse, pas la moitie.** A 0,55 il mangeait tout le buste et
  // le personnage devenait une bavette claire sur des jambes noires — la tunique
  // sombre, qui est la moitie du signalement, avait disparu.
  const ventre = bas - Math.round(hauteur * 0.38);
  const tunique = tenue.tunique;

  for (let y = bas; y >= haut; y -= 1) {
    // Chaque rangee glisse un peu plus que celle du dessous : le torse s'incline
    // au lieu de basculer d'un bloc.
    const part = (bas - y) / hauteur;
    const x = Math.round(MILIEU - CARRURE / 2 + penche * part);

    toile.rect(x, y, CARRURE, 1, tunique.corps);
    if (tenue.ventre && y >= ventre) {
      // Le ventre laisse voir la tunique de chaque cote : sans cette bordure il
      // se confond avec la carrure et on ne voit plus qu'un bloc clair. Un
      // pixel de chaque cote — a six de carrure, deux ne laisseraient que deux
      // pixels de tablier, et le tablier est la moitie du signalement.
      toile.rect(x + 1, y, CARRURE - 2, 1, tenue.ventre.corps);
      toile.point(x + CARRURE - 2, y, tenue.ventre.sombre);
    } else {
      // La lumiere vient d'en haut a gauche, partout et toujours.
      toile.point(x, y, tunique.clair);
      toile.point(x + CARRURE - 1, y, tunique.sombre);
    }
  }

  if (tenue.laiton !== undefined) {
    // Le liseré du palier 4 : deux pixels sur l'epaule. Le laiton est la couleur
    // de l'interface (§4.10) — s'il coulait sur tous les heros, il ne voudrait
    // plus rien dire nulle part.
    const x = Math.round(MILIEU - CARRURE / 2 + penche);
    toile.rect(x, haut, CARRURE, 1, tenue.laiton);
  }

  if (tenue.sang > 0) {
    // Deux pixels, jamais un aplat (§4.10) : une hemorragie tue en une journee,
    // c'est ce qui lui donne droit au sang frais.
    const x = Math.round(MILIEU + penche * 0.4);
    toile.point(x + 1, ventre - 1, SANG.corps);
    toile.point(x + 2, ventre, SANG.sombre);
  }
}

function peindreTete(
  toile: Toile,
  epauleX: number,
  epauleY: number,
  a: Attitude,
  chair: Matiere,
  tenue: Apparence,
): void {
  const inclinaison = a.buste + a.tete;
  const x = epauleX + Math.sin(inclinaison) * COU;
  const y = epauleY - Math.cos(inclinaison) * COU;

  toile.disque(x, y, TETE, chair.corps);
  // Le cote droit dans l'ombre : sans lui la tete est une bille plate.
  toile.segment(x + TETE - 0.6, y - 0.5, x + TETE - 0.6, y + 1, 1, chair.sombre);

  // Visage degage (§4.30) : deux yeux, et rien d'autre. A cette taille, une
  // bouche dessinee devient une tache des qu'on dezoome. Les yeux sont a **un
  // pixel entier** de part et d'autre du milieu : plus pres, ils se touchent.
  const oeil = tenue.yeux ?? CONTOUR;
  const cx = Math.round(x);
  const cy = Math.round(y);
  toile.point(cx - 1, cy, oeil);
  toile.point(cx + 1, cy, oeil);
  if (tenue.usure > 0.35) {
    const cerne = melanger(chair.sombre, CONTOUR, 0.4);
    toile.point(cx - 1, cy + 1, cerne);
    toile.point(cx + 1, cy + 1, cerne);
  }

  peindreCoiffe(toile, x, y, tenue.coiffe);
}

/**
 * ⚠️ **Une coiffe ne depasse la carrure que d'un pixel de chaque cote.**
 * Le premier jet donnait au chapeau onze pixels pour un torse de dix : le
 * personnage devenait un champignon, la tete pesait autant que le corps, et
 * c'est la silhouette — la seule chose qui porte la lisibilite a petite taille
 * (§4.11) — qui y perdait tout.
 */
function peindreCoiffe(toile: Toile, x: number, y: number, coiffe: Coiffe): void {
  if (coiffe.genre === "nu") return;

  const cx = Math.round(x);
  const haut = Math.round(y - TETE);
  if (coiffe.genre === "chapeau") {
    // Le bord plat : une ligne de cinq, puis la calotte de trois au-dessus.
    toile.rect(cx - 2, haut, 5, 1, coiffe.matiere.sombre);
    toile.rect(cx - 1, haut - 1, 3, 1, coiffe.matiere.corps);
    toile.point(cx - 1, haut - 1, coiffe.matiere.clair);
    return;
  }

  // Le casque : pas de bord, mais il **descend sur la nuque et les joues**.
  // C'est ce qui le distingue d'un chapeau a petite taille, ou un bord d'un
  // pixel ne se voit plus des qu'on dezoome.
  toile.disque(x, y - 0.4, TETE + 0.2, coiffe.matiere.corps);
  toile.rect(cx - 2, Math.round(y), 5, 1, coiffe.matiere.corps);
  toile.point(cx - 2, Math.round(y) - 1, coiffe.matiere.clair);
  toile.point(cx + 2, Math.round(y), coiffe.matiere.sombre);
  // La fente des yeux : sans elle le casque est une bille.
  toile.rect(cx - 1, Math.round(y), 3, 1, CONTOUR);
}
