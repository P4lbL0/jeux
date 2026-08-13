import type { Geste, Modele } from "./four";
import type { Toile } from "./pinceau";
import { BOIS, FER, TISSU, TOILE } from "./palette";
import {
  CADRE,
  borner,
  debout,
  peindreCorps,
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
 */

/** Ce qu'un corps porte en plus de son geste. */
export interface Corps {
  /** De 0 (neuf) a 1 (use) : il se voute, il palit, il se cerne (§4.23). */
  usure: number;
  /** De 0 a 1 : le sang d'un blesse. */
  sang: number;
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

/** Tunique sombre, tablier clair, chapeau a bord plat (§4.30). */
export function tenueDeVillageois(corps: Corps): Apparence {
  return {
    tunique: TISSU,
    ventre: TOILE,
    coiffe: { genre: "chapeau", matiere: BOIS },
    usure: corps.usure,
    sang: corps.sang,
  };
}

/** Un villageois, dans l'etat ou il est. */
export function villageois(famille: string, corps: Corps): Modele {
  const tenue = tenueDeVillageois(corps);
  return {
    famille,
    taille: CADRE,
    gestes: GESTES,
    dessiner: (toile, geste, avancement) => {
      const a = posture(geste, avancement, corps.usure);
      const attaches = peindreCorps(toile, a, tenue);
      // **L'outil n'est en main que pendant le travail** (§4.30) : c'est ce qui
      // fait qu'on lit *qui travaille*, et pas seulement quel est son metier.
      if (a.outil) peindrePioche(toile, attaches.main, a.brasAvant);
    },
  };
}

function peindrePioche(toile: Toile, main: { x: number; y: number }, angle: number): void {
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
