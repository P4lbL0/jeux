import type { Geste, Modele } from "./four";
import type { Toile } from "./pinceau";
import { BOIS, CHAIR, CONTOUR, FER, SANG, TISSU, TOILE, melanger, palir } from "./palette";

/**
 * Le villageois, dessine par une fonction (DESIGN.md §4.30).
 *
 * **32 x 32, la taille exacte des heros.** Ce n'etait pas le cas : il etait
 * reste sur un placeholder de 12 x 18 quand les heros passaient a 32, ce qui
 * faisait passer les habitants pour des enfants a cote de leurs heros — alors
 * que le §4.18 dit l'inverse, *les futurs heros sortent du village*. C'etait un
 * oubli de migration, pas un choix.
 *
 * **C'est le cobaye du socle**, et il est choisi pour ca : il porte a lui seul
 * les quatre choses que le bloc doit prouver.
 *
 * 1. Un geste est **un angle**, pas une planche a redessiner (`travail`).
 * 2. L'**usure** est un parametre, pas un second sprite (§4.23).
 * 3. L'**outil n'est en main que pendant le travail** (§4.30) — c'est ce qui
 *    fait qu'on lit *qui travaille* et pas seulement *quel est son metier*.
 * 4. Une animation porte son **evenement de son** comme une donnee (§7).
 */

/** La geometrie, en pixels de la frame. Tout le dessin s'y accroche. */
const CADRE = 32;
const MILIEU = 16;
const SOL = 28;
const HANCHE = 21;
const EPAULE = 14;
/** Largeur du torse : elle decide de la carrure, donc de qui est humain. */
const CARRURE = 9;
/** Longueur d'un bras. Court : c'est le seul moyen que l'outil tienne dedans. */
const BRAS = 5.5;
/**
 * A quelle distance du milieu le bras s'attache.
 *
 * ⚠️ **Il doit tomber sur le bord du torse, pas dedans.** Au premier jet il
 * valait 3 pour une carrure de 10 : le bras restait **a l'interieur de la
 * silhouette** a chaque angle modere, donc il ne se voyait pas, donc le
 * balancement de la marche n'existait pas a l'ecran. Six frames pour rien — et
 * ca ne se voyait qu'en regardant l'image, jamais dans un test.
 */
const EMMANCHURE = 4.5;

/**
 * Ce qu'un corps peut porter en plus de son geste.
 *
 * C'est **la** raison de dessiner en code : chacun de ces champs coutait
 * autrefois un sprite de plus a produire, et coute aujourd'hui un parametre.
 */
export interface Corps {
  /** De 0 (neuf) a 1 (use) : il se voute, il palit, il se cerne (§4.23). */
  usure: number;
  /** De 0 a 1 : le sang d'un blesse. */
  sang: number;
}

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
   * C'etait l'inverse au premier jet, et c'etait faux : l'amplitude d'un coup de
   * pioche depend alors de la posture de celui qui le porte, donc un villageois
   * voute frappait plus loin devant lui qu'un villageois droit, jusqu'a sortir du
   * cadre. Un geste decrit son propre arc.
   */
  brasAvant: number;
  brasArriere: number;
  jambeAvant: number;
  jambeArriere: number;
  /** Deplacement vertical du corps, en pixels. Negatif = en l'air. */
  sursaut: number;
  /** L'outil est-il en main (§4.30) ? */
  outil: boolean;
}

/**
 * Les deux bornes du coup de pioche, dans l'avancement du geste.
 *
 * ⚠️ **Elles tombent sur des frames qui existent, et c'est indispensable.** Le
 * geste a six frames, donc son avancement vaut 0 / 0,167 / 0,333 / 0,5 / 0,667 /
 * 0,833 — il n'atteint **jamais 1**, puisqu'il boucle. Une premiere version
 * etalait la frappe sur [0,66 ; 1] : la derniere frame s'arretait a mi-course et
 * **la pioche ne touchait jamais le sol**. Le bras montait, puis le geste
 * repartait. Trouve par un test, pas a l'oeil.
 *
 * La montee occupe donc les quatre premieres frames et culmine a 0,5 ; la frappe
 * occupe les deux dernieres et aboutit a 0,834.
 */
const FIN_MONTEE = 0.5;
const FIN_FRAPPE = 5 / 6;

/**
 * Le geste, a un instant donne. **Fonction pure** : c'est elle qui est testee,
 * pas les pixels.
 *
 * @param avancement de 0 a 1 dans le geste.
 */
export function posture(geste: string, avancement: number, usure: number): Attitude {
  // L'usure se lit d'abord dans le dos : il se voute, et ca se voit de loin bien
  // avant la pâleur.
  const dos = usure * 0.25;
  const repos: Attitude = {
    buste: dos,
    tete: usure * 0.15,
    brasAvant: dos + 0.12,
    brasArriere: dos - 0.12,
    jambeAvant: 0.06,
    jambeArriere: -0.06,
    sursaut: 0,
    outil: false,
  };

  switch (geste) {
    case "marche": {
      const balancier = Math.sin(avancement * Math.PI * 2);
      return borner({
        ...repos,
        jambeAvant: balancier * 0.5,
        jambeArriere: -balancier * 0.5,
        // Les bras vont a contresens des jambes : c'est ce qui fait une marche
        // et non un pantin qui glisse.
        brasAvant: repos.brasAvant - balancier * 0.42,
        brasArriere: repos.brasArriere + balancier * 0.42,
        // Le corps monte quand les jambes se rejoignent, jamais quand elles
        // s'ecartent — c'est la seule facon d'avoir un pas et pas un rebond.
        sursaut: Math.abs(balancier) < 0.5 ? -1 : 0,
      });
    }

    case "travail": {
      // **La demonstration du bloc.** Le bras monte lentement derriere la tete
      // sur les quatre premieres frames, puis retombe d'un coup sur les deux
      // dernieres. Redessiner ca en PNG voudrait dire six images ; ici c'est une
      // interpolation, et changer l'outil ne change pas le geste.
      const monte = avancement <= FIN_MONTEE;
      const part = monte
        ? avancement / FIN_MONTEE
        : Math.min(1, (avancement - FIN_MONTEE) / (FIN_FRAPPE - FIN_MONTEE));
      // ⚠️ La frappe s'arrete a 0,5 rad, soit trente degres — un coup de pioche
      // se donne **vers le bas**, pas vers l'avant. Ce n'est pas qu'anatomique :
      // a soixante degres, le fer de l'outil sortait du carreau de 32.
      // ⚠️ Le geste **part** de 0,35 et **finit** a 0,5 : la frame de
      // recuperation doit rester en deca de la frappe. Au premier jet elle
      // partait de 0,7, donc le point le plus avance du geste etait celui d'apres
      // le coup — le bras revenait en avant avant de frapper, et la boucle se
      // lisait a l'envers. Trouve par un test, invisible frame par frame.
      const bras = monte ? 0.2 - part * 2.4 : -2.2 + part * 2.65;
      return borner({
        ...repos,
        // Les deux mains tiennent le manche, celle de derriere un peu plus bas.
        brasAvant: bras,
        brasArriere: bras - 0.18,
        buste: dos + (monte ? -0.1 : part * 0.24),
        jambeAvant: 0.28,
        jambeArriere: -0.24,
        outil: true,
      });
    }

    case "toux": {
      // Il se plie vite, il se redresse lentement. L'inverse ferait un salut.
      const spasme = Math.sin(Math.min(1, avancement * 1.2) * Math.PI);
      return borner({
        ...repos,
        // Bornee sous DOS_MAXIMUM pour un corps neuf : une quinte qui tape le
        // plafond du pliage se lit comme une simple inclinaison, elle ne monte
        // plus. Un villageois deja voute, lui, y touche — et c'est juste, on ne
        // se plie pas deux fois.
        buste: dos + spasme * 0.34,
        tete: repos.tete + spasme * 0.3,
        // La main devant la bouche : sans elle, il s'incline, il ne tousse pas.
        brasAvant: repos.brasAvant - spasme * 1.75,
        brasArriere: repos.brasArriere - spasme * 0.3,
        jambeAvant: 0.1,
        jambeArriere: -0.1,
      });
    }

    default:
      // La respiration : un pixel, et lentement. A 32 px, trois pixels
      // disloquent le personnage — la mesure est celle des animations du 10 aout.
      return borner({ ...repos, sursaut: avancement < 0.5 ? 0 : -1 });
  }
}

/** Jusqu'ou un corps se plie. Au-dela, il sort de son carreau. */
const DOS_MAXIMUM = 0.4;

function borner(a: Attitude): Attitude {
  return { ...a, buste: Math.min(a.buste, DOS_MAXIMUM) };
}

/**
 * Les gestes du villageois.
 *
 * ⚠️ Ce ne sont pas encore les sept que `poses.ts` attend d'une famille animee
 * (`repos`, `marche`, `attaque`, `charge`, `incantation`, `touche`, `mort`) :
 * le socle n'est pas branche sur le jeu, il se juge sur la planche. Le
 * raccordement est l'etage 2.
 */
export const GESTES: readonly Geste[] = [
  { cle: "repos", frames: 4, cadence: 3, boucle: true },
  { cle: "marche", frames: 6, cadence: 10, boucle: true },
  {
    cle: "travail",
    frames: 6,
    cadence: 8,
    boucle: true,
    evenement: "pioche",
    // L'evenement tombe a l'impact, pas au depart du geste : un son de pioche
    // joue quand le bras se leve serait a contretemps de ce qu'on voit.
    frameCle: 5,
  },
  { cle: "toux", frames: 4, cadence: 6, boucle: false, evenement: "toux", frameCle: 1 },
];

/** Un villageois, dans l'etat ou il est. */
export function villageois(famille: string, corps: Corps): Modele {
  return {
    famille,
    taille: CADRE,
    gestes: GESTES,
    dessiner: (toile, geste, avancement) =>
      peindre(toile, posture(geste, avancement, corps.usure), corps),
  };
}

function peindre(toile: Toile, a: Attitude, corps: Corps): void {
  const chair = palir(CHAIR, corps.usure);

  // L'ombre d'abord, et elle **ne suit pas le sursaut** : c'est ce qui fait
  // qu'on voit le personnage decoller au lieu de glisser.
  toile.ombreAuSol(MILIEU, SOL, 8, 2.5);

  const hancheY = HANCHE + a.sursaut;
  const buste = HANCHE - EPAULE;
  // Le buste tourne autour de la hanche : l'epaule part en avant, et descend
  // d'autant qu'elle s'est avancee.
  const penche = Math.sin(a.buste) * buste;
  const epauleX = MILIEU + penche;
  const epauleY = EPAULE + a.sursaut + (1 - Math.cos(a.buste)) * buste;

  // Les jambes passent sous le torse : la plus eloignee d'abord.
  toile.membre(MILIEU - 2, hancheY, 7, a.jambeArriere, 3, TISSU.sombre);
  toile.membre(MILIEU + 2, hancheY, 7, a.jambeAvant, 3, melanger(TISSU.corps, TISSU.sombre, 0.4));

  // Le bras arriere passe derriere le torse, donc il se peint avant lui.
  toile.membre(epauleX - EMMANCHURE, epauleY, BRAS, a.brasArriere, 2.4, TISSU.sombre);

  peindreTorse(toile, epauleY, hancheY, penche, corps);
  peindreTete(toile, epauleX, epauleY, a, chair, corps);

  const main = toile.membre(epauleX + EMMANCHURE, epauleY, BRAS, a.brasAvant, 2.4, TISSU.corps);
  toile.disque(main.x, main.y, 1.2, chair.corps);
  if (a.outil) peindreOutil(toile, main, a.brasAvant);
}

function peindreTorse(
  toile: Toile,
  epauleY: number,
  hancheY: number,
  penche: number,
  corps: Corps,
): void {
  const bas = Math.round(hancheY) + 1;
  const haut = Math.round(epauleY) - 1;
  const hauteur = Math.max(1, bas - haut);
  // Le tablier clair : c'est lui qui donne au villageois sa silhouette a deux
  // valeurs, celle qu'on reconnait de loin.
  //
  // ⚠️ **Un tiers du torse, pas la moitie.** A 0,55 il mangeait tout le buste et
  // le personnage devenait une bavette claire sur des jambes noires — la tunique
  // sombre, qui est la moitie du signalement, avait disparu.
  const tablier = bas - Math.round(hauteur * 0.38);

  for (let y = bas; y >= haut; y -= 1) {
    // Chaque rangee glisse un peu plus que celle du dessous : le torse s'incline
    // au lieu de basculer d'un bloc.
    const part = (bas - y) / hauteur;
    const x = Math.round(MILIEU - CARRURE / 2 + penche * part);

    if (y >= tablier) {
      // Le tablier laisse voir la tunique de chaque cote : sans cette bordure il
      // se confond avec la carrure et on ne voit plus qu'un bloc clair.
      toile.rect(x, y, CARRURE, 1, TISSU.corps);
      toile.rect(x + 2, y, CARRURE - 4, 1, TOILE.corps);
      toile.point(x + 2, y, TOILE.clair);
      toile.point(x + CARRURE - 3, y, TOILE.sombre);
    } else {
      toile.rect(x, y, CARRURE, 1, TISSU.corps);
      // La lumiere vient d'en haut a gauche, partout et toujours.
      toile.point(x, y, TISSU.clair);
      toile.point(x + CARRURE - 1, y, TISSU.sombre);
    }
  }

  if (corps.sang > 0) {
    // Trois pixels, jamais un aplat (§4.10) : une hemorragie tue en une journee,
    // c'est ce qui lui donne droit au sang frais.
    const x = Math.round(MILIEU + penche * 0.4);
    toile.point(x + 2, tablier - 1, SANG.corps);
    toile.point(x + 2, tablier, SANG.corps);
    toile.point(x + 3, tablier + 1, SANG.sombre);
  }
}

function peindreTete(
  toile: Toile,
  epauleX: number,
  epauleY: number,
  a: Attitude,
  chair: { sombre: number; corps: number; clair: number },
  corps: Corps,
): void {
  const inclinaison = a.buste + a.tete;
  const cou = 5;
  const x = epauleX + Math.sin(inclinaison) * cou;
  const y = epauleY - Math.cos(inclinaison) * cou;

  toile.disque(x, y, 3.2, chair.corps);
  // Le cote droit dans l'ombre : sans lui la tete est une bille plate.
  toile.segment(x + 2.2, y - 1, x + 2.2, y + 2, 1, chair.sombre);

  // Visage degage (§4.30) : deux yeux, et rien d'autre. A 32 px, une bouche
  // dessinee devient une tache des qu'on dezoome.
  toile.point(x - 1.4, y - 0.4, CONTOUR);
  toile.point(x + 1.4, y - 0.4, CONTOUR);
  if (corps.usure > 0.35) {
    const cerne = melanger(chair.sombre, CONTOUR, 0.4);
    toile.point(x - 1.4, y + 0.7, cerne);
    toile.point(x + 1.4, y + 0.7, cerne);
  }

  // Le chapeau a bord plat : c'est lui, et pas le visage, qui dit « villageois »
  // a petite taille.
  //
  // ⚠️ **Il ne doit pas depasser la carrure de plus d'un pixel de chaque cote.**
  // Le premier jet lui donnait onze pixels de large pour un torse de dix : le
  // personnage devenait un champignon, la tete pesait autant que le corps, et
  // c'est la silhouette — la seule chose qui porte la lisibilite a petite taille
  // (§4.11) — qui y perdait tout.
  const chapeau = y - 3.2;
  toile.segment(x - 4, chapeau, x + 4, chapeau, 1.2, BOIS.sombre);
  toile.rect(Math.round(x) - 2, Math.round(chapeau) - 2, 5, 2, BOIS.corps);
  toile.point(Math.round(x) - 2, Math.round(chapeau) - 2, BOIS.clair);
}

function peindreOutil(toile: Toile, main: { x: number; y: number }, angle: number): void {
  const sin = Math.sin(angle);
  const cos = Math.cos(angle);
  // Le manche **prolonge le bras**. C'est ce qui fait que l'outil appartient au
  // geste au lieu de flotter a cote de la main.
  const bout = { x: main.x + sin * 3.5, y: main.y + cos * 3.5 };
  toile.segment(main.x - sin * 2, main.y - cos * 2, bout.x, bout.y, 1.4, BOIS.corps);
  // Le fer en travers du manche, donc perpendiculaire a l'angle du bras.
  toile.segment(
    bout.x - cos * 1.4,
    bout.y + sin * 1.4,
    bout.x + cos * 1.4,
    bout.y - sin * 1.4,
    1.4,
    FER.clair,
  );
}
