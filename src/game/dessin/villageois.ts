import type { Metier } from "../../core/habitants";
import { C } from "../ui/couleurs";
import type { Geste, Modele } from "./four";
import type { Toile } from "./pinceau";
import { BOIS, FER, TISSU, TOILE, matiere, melanger, type Matiere } from "./palette";
import {
  CADRE,
  K,
  borner,
  debout,
  peindreCorps,
  tousser,
  type Apparence,
  type Attitude,
} from "./corps";

/**
 * Le villageois (DESIGN.md §4.30).
 *
 * **32 x 32, la taille exacte des heros.** Ce n'etait pas le cas : il etait
 * reste sur un placeholder de 12 x 18 quand les heros passaient a 32, ce qui
 * faisait passer les habitants pour des enfants a cote de leurs heros — alors
 * que le §4.18 dit l'inverse, *les futurs heros sortent du village*. C'etait un
 * oubli de migration, pas un choix.
 *
 * ⚠️ **Ce fichier ne dessine plus de corps** : `corps.ts` s'en charge, pour lui
 * comme pour les heros. Il ne decrit que ce qu'un villageois **porte** et
 * comment il **bouge**. C'est ce qui rend « un heros est un villageois qui a
 * appris » vrai par construction.
 *
 * **Le metier se lit sur deux choses, et deux seulement** : la teinte du
 * tablier, et l'outil — qui n'est en main qu'au travail (§4.30). L'ancien jeu
 * teintait tout le sprite d'une couleur vive par metier ; ces couleurs ne sont
 * pas dans la palette, et un pecheur bleu ciel de la tete aux pieds n'est pas
 * quelqu'un, c'est une etiquette.
 */

/** Ce qu'un corps porte en plus de son geste. */
export interface Corps {
  /** De 0 (neuf) a 1 (use) : il se voute, il palit, il se cerne (§4.23). */
  usure: number;
  /** De 0 a 1 : le sang d'un blesse. */
  sang: number;
}

/** Les metiers du village, plus l'inconnu qu'on ramene de la route. */
export type MetierDessine = Metier | "survivant";

/**
 * Le tablier de chaque metier : de la toile, poussee vers une teinte des neuf.
 *
 * ⚠️ Toutes descendent de l'**os** : un tablier est ce que le corps a de plus
 * clair, c'est lui qui donne la silhouette a deux valeurs. Le colorer sombre le
 * ferait disparaitre dans la tunique, et le villageois redeviendrait un bloc.
 *
 * ⚠️ **Une teinte par metier, et elles doivent s'ecarter a vingt pixels.**
 * Ecartees le 20 septembre 2026 au soir : bucheron, mineur, charpentier et
 * survivant tombaient tous les quatre dans le meme brun. Chaque metier prend
 * donc la matiere qu'il touche — le pecheur l'eau, le mineur la pierre, le
 * charpentier le bois, le bucheron la feuille, le forgeron la braise —, et
 * **aucune paire ne descend plus sous trente-huit** de distance RVB (la plus
 * serree etait a vingt-cinq).
 *
 * **C'est `scripts/blender/palette.ts` qui les exporte a Blender** : une seule
 * table, sinon le rendu et le dessin derivent l'un de l'autre.
 */
export const TABLIERS: Record<MetierDessine, Matiere | null> = {
  pecheur: matiere(melanger(C.os, C.acier, 0.65)),
  fermier: matiere(melanger(C.os, C.laiton, 0.45)),
  bucheron: matiere(melanger(C.os, C.bile, 0.8)),
  mineur: matiere(melanger(melanger(C.os, C.acier, 0.6), C.plaque, 0.22)),
  forgeron: matiere(melanger(C.os, C.sangSeche, 0.45)),
  charpentier: matiere(melanger(C.os, BOIS.corps, 0.5)),
  guetteur: matiere(melanger(C.os, C.cielSale, 0.45)),
  // ⚠️ **Pas de tablier du tout** : un inconnu ne porte pas les couleurs d'un
  // metier, et sa silhouette entierement sombre le dit mieux qu'une huitieme
  // teinte — a huit, elles ne pouvaient plus s'ecarter.
  survivant: null,
};

/** L'outil de chaque metier. Il n'apparait qu'au travail. */
type Outil = "pioche" | "hache" | "houe" | "canne" | "marteau" | "maillet" | "baton";

const OUTILS: Record<MetierDessine, Outil> = {
  pecheur: "canne",
  fermier: "houe",
  bucheron: "hache",
  mineur: "pioche",
  forgeron: "marteau",
  charpentier: "maillet",
  guetteur: "baton",
  survivant: "baton",
};

/** Le son de chaque outil. Personne ne l'ecoute encore (§4.30). */
const BRUITS: Record<Outil, string> = {
  pioche: "pioche",
  hache: "hache",
  houe: "semis",
  canne: "ligne",
  marteau: "enclume",
  maillet: "maillet",
  baton: "pas",
};

/**
 * Les deux bornes du coup de pioche, dans l'avancement du geste.
 *
 * ⚠️ **Elles tombent sur des frames qui existent, et c'est indispensable.** Le
 * geste a six frames, donc son avancement vaut 0 / 0,167 / 0,333 / 0,5 / 0,667 /
 * 0,833 — il n'atteint **jamais 1**, puisqu'il boucle. Une premiere version
 * etalait la frappe sur [0,66 ; 1] : la derniere frame s'arretait a mi-course et
 * **la pioche ne touchait jamais le sol**. Le bras montait, puis le geste
 * repartait. Trouve par un test, pas a l'oeil.
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
  const repos = debout(usure);
  const dos = repos.buste;

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
      // ⚠️ Le geste **part** de 0,2 et **finit** a 0,45 : la frame de
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

    case "toux":
      // Elle vit dans `corps.ts` : un heros tousse exactement pareil (§4.23).
      return tousser(repos, avancement);

    default:
      // La respiration : un pixel, et lentement. A 32 px, trois pixels
      // disloquent le personnage — la mesure est celle des animations du 10 aout.
      return borner({ ...repos, sursaut: avancement < 0.5 ? 0 : -1 });
  }
}

/** Les gestes du villageois. */
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

/** Les gestes d'un metier : les memes, avec le son de son outil. */
export function gestesDeVillageois(metier: MetierDessine): readonly Geste[] {
  const bruit = BRUITS[OUTILS[metier]];
  return GESTES.map((g) => (g.cle === "travail" ? { ...g, evenement: bruit } : g));
}

/** Tunique sombre, tablier du metier, chapeau a bord plat (§4.30). */
export function tenueDeVillageois(metier: MetierDessine, corps: Corps): Apparence {
  return {
    tunique: TISSU,
    ventre: TABLIERS[metier] ?? undefined,
    // Le guetteur porte une capuche : il est dehors la nuit. Les autres, le
    // chapeau a bord plat.
    coiffe: metier === "guetteur" ? { genre: "casque", matiere: TISSU } : { genre: "chapeau", matiere: BOIS },
    usure: corps.usure,
    sang: corps.sang,
  };
}

/**
 * La famille de texture d'un villageois : son metier, et l'etat de son corps.
 *
 * L'usure est **quantifiee en trois crans** : neuf, fatigue, use. Cuire une
 * planche par pourcent de stress reviendrait a cuire par image ; trois crans se
 * lisent, et une planche ne se cuit que quand un habitant change de cran.
 */
export function familleDeVillageois(metier: MetierDessine, corps: Corps): string {
  return `villageois-${metier}-u${cranDUsure(corps.usure)}-s${corps.sang > 0 ? 1 : 0}`;
}

/** Le cran d'usure : 0, 1 ou 2. */
export function cranDUsure(usure: number): number {
  return Math.max(0, Math.min(2, Math.round(usure * 2)));
}

/** L'usure que la planche dessine pour un cran. */
function usureDuCran(cran: number): number {
  return cran / 2;
}

/** Un villageois, dans l'etat ou il est. */
export function villageois(metier: MetierDessine, corps: Corps): Modele {
  const usure = usureDuCran(cranDUsure(corps.usure));
  const sang = corps.sang > 0 ? 1 : 0;
  const tenue = tenueDeVillageois(metier, { usure, sang });
  const outil = OUTILS[metier];
  return {
    famille: familleDeVillageois(metier, corps),
    taille: CADRE,
    gestes: gestesDeVillageois(metier),
    dessiner: (toile, geste, avancement) => {
      const a = posture(geste, avancement, usure);
      const attaches = peindreCorps(toile, a, tenue);
      // **L'outil n'est en main que pendant le travail** (§4.30) : c'est ce qui
      // fait qu'on lit *qui travaille*, et pas seulement quel est son metier.
      if (a.outil) peindreOutil(toile, outil, attaches.main, a.brasAvant);
    },
  };
}

// ----------------------------------------------------------------- les outils

/**
 * L'outil, dans le prolongement du bras.
 *
 * C'est ce qui fait qu'il appartient au geste au lieu de flotter a cote de la
 * main. Chaque outil est un manche et **une seule chose au bout** : a 32 px,
 * c'est cette chose-la qu'on lit, jamais le detail.
 */
function peindreOutil(toile: Toile, outil: Outil, main: { x: number; y: number }, angle: number): void {
  const sin = Math.sin(angle);
  const cos = Math.cos(angle);
  // Les longueurs sont celles du dessin d'origine, ramenees au cadre (`K`) :
  // l'outil garde sa proportion avec le bras qui le tient.
  const bout = (longueur: number) => ({ x: main.x + sin * longueur * K, y: main.y + cos * longueur * K });
  const travers = (a: { x: number; y: number }, demi: number, epaisseur: number, couleur: number) =>
    toile.segment(
      a.x - cos * demi * K,
      a.y + sin * demi * K,
      a.x + cos * demi * K,
      a.y - sin * demi * K,
      epaisseur,
      couleur,
    );
  const manche = (longueur: number, arriere = 2) => {
    const b = bout(longueur);
    const q = bout(-arriere);
    toile.segment(q.x, q.y, b.x, b.y, 1, BOIS.corps);
    return b;
  };

  switch (outil) {
    case "pioche": {
      // Le fer en travers du manche, donc perpendiculaire a l'angle du bras.
      travers(manche(3), 1.4, 1, FER.clair);
      break;
    }
    case "hache": {
      // Une tete large d'un seul cote : c'est ce qui la separe de la pioche.
      // ⚠️ Un manche de 2,5 et non 3,5 : un bucheron use, voute, frappe plus
      // loin devant lui, et la hache sortait du carreau d'un pixel — a 32
      // comme a 20.
      const b = manche(2.5);
      toile.segment(b.x, b.y, b.x + cos * 1.5 * K, b.y - sin * 1.5 * K, 1.6, FER.clair);
      break;
    }
    case "houe": {
      // Une lame plate, en travers, plus courte que la pioche.
      travers(manche(3.5), 1.2, 1, FER.corps);
      break;
    }
    case "canne": {
      // Longue et fine, et un fil qui pend du bout. Cinq et non six : un
      // pecheur voute la tendait hors du cadre de 20.
      const b = bout(4.5);
      const q = bout(-2);
      toile.segment(q.x, q.y, b.x, b.y, 1, BOIS.clair);
      toile.segment(b.x, b.y, b.x, b.y + 3 * K, 1, TOILE.clair);
      break;
    }
    case "marteau": {
      // Une masse carree au bout d'un manche court.
      const b = manche(2.5);
      toile.rect(Math.round(b.x) - 1, Math.round(b.y) - 1, 2, 2, FER.corps);
      toile.point(Math.round(b.x) - 1, Math.round(b.y) - 1, FER.clair);
      break;
    }
    case "maillet": {
      const b = manche(2.5);
      toile.rect(Math.round(b.x) - 1, Math.round(b.y) - 1, 2, 2, BOIS.corps);
      toile.point(Math.round(b.x) - 1, Math.round(b.y) - 1, BOIS.clair);
      break;
    }
    case "baton":
      manche(3.5);
      break;
  }
}
