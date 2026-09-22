import { C } from "../ui/couleurs";
import type { Geste, Modele } from "./four";
import type { Toile } from "./pinceau";
import {
  CHAIR,
  EAU,
  MONSTRE,
  SOUS_BOIS,
  PIERRE,
  SANG,
  TISSU,
  desaturer,
  matiere,
  melanger,
  palir,
  type Matiere,
} from "./palette";
import { CADRE, debout, peindreCorps, type Apparence } from "./corps";
import { posture as postureHumaine } from "./heros";

/**
 * Les monstres — **la seule silhouette qui n'est pas humaine** (DESIGN.md §4.30).
 *
 * Ils prennent la palette, le contour et la grille comme tout le reste, mais
 * **pas la carrure** : plus bas, plus large, et des membres qui ne sont pas des
 * bras. A vingt monstres sur l'ecran, en pleine nuit, un archetype qui aurait la
 * carrure d'un habitant est un habitant qu'on laisse mourir.
 *
 * **Une seule bete, et des nombres.** Comme le corps humain de `corps.ts`, il n'y
 * a qu'une fonction qui peint une bete ; les six archetypes ne different que par
 * ce qu'ils lui passent — la longueur du corps, le nombre de pattes, ce qu'ils
 * portent sur le dos. Le Revenant est l'exception : c'est un mort, donc un
 * humain, et il prend le corps de `corps.ts` avec l'usure au maximum.
 *
 * ⚠️ **Le sang frais ne sert qu'a ce qui peut tuer** (§4.10). Ici, ce sont
 * leurs yeux — deux pixels — et rien d'autre. C'est ce qui fait qu'on les
 * repere dans le noir, et c'est le seul rouge vif du monde.
 *
 * ⚠️ **Plus de teinte, plus d'echelle fractionnaire.** L'ancien jeu tirait six
 * monstres d'un seul sprite par `setTint` et `setScale` : les teintes ne sont
 * pas dans la palette, et une echelle de 1,4 sur du pixel-art donne des pixels
 * inegaux. Une brute est **cuite plus grande**, dans un cadre de 48.
 */

/** Ce qu'une bete porte sur le dos. */
type Dos = "lisse" | "epines" | "plaques" | "pustules";

/**
 * Les nombres qui font une bete. Tout est en pixels **d'un dessin de 32**, et
 * ramene au cadre a la peinture (`peindreBete`) : le cadre a suivi celui des
 * humains quand ils sont passes de 32 a 20 (11 septembre 2026), sans qu'un
 * seul de ces nombres ne bouge.
 */
export interface Bete {
  famille: string;
  /** Cote du cadre : `CADRE_BETE`, ou `CADRE_GROSSE_BETE` pour ce qui est cuit plus gros. */
  cadre: number;
  /** Le corps : sa longueur, sa hauteur, sa matiere. */
  corps: { longueur: number; hauteur: number; matiere: Matiere };
  /** Les pattes : combien, quelle longueur, quelle epaisseur. */
  pattes: { nombre: 4 | 6; longueur: number; epaisseur: number };
  /** La tete : son rayon, la longueur du museau. */
  tete: { rayon: number; museau: number };
  dos: Dos;
  /** Une queue, en pixels. 0 pour aucune. */
  queue: number;
  /** La couleur des yeux : le sang frais des monstres, autre chose pour les allies. */
  yeux: number;
  /** Une bete qui flotte n'a pas de pattes qui marchent : elle ondule. */
  flotte?: boolean;
}

/** Le cadre d'une bete ordinaire : celui des humains. */
export const CADRE_BETE = CADRE;
/**
 * Le cadre de ce qui est cuit plus gros — la brute, le golem. Une fois et demie
 * l'ordinaire, comme le 48 l'etait du 32 : la brute doit dominer un habitant.
 */
export const CADRE_GROSSE_BETE = 30;

/** Les archetypes de `ennemis.ts`, dans le langage d'une bete. */
export const BETES: Record<string, Bete> = {
  /** Le Rodeur : un chien de guerre efflanque, qui court. */
  fonceur: {
    famille: "monstre-fonceur",
    cadre: CADRE_BETE,
    corps: { longueur: 13, hauteur: 7, matiere: MONSTRE },
    pattes: { nombre: 4, longueur: 6, epaisseur: 2 },
    // ⚠️ Museau de 3 et non 4 : au bond de l'attaque, le museau sortait du
    // cadre de 20 — il avait un pixel de marge dans celui de 32, il n'en a plus.
    tete: { rayon: 3.2, museau: 3 },
    dos: "epines",
    queue: 4,
    yeux: C.sangFrais,
  },
  /** La Nuee : petit, six pattes, pale. Ce qu'on ecrase et qui revient. */
  essaim: {
    famille: "monstre-essaim",
    cadre: CADRE_BETE,
    corps: { longueur: 8, hauteur: 5, matiere: palir(MONSTRE, 0.5) },
    pattes: { nombre: 6, longueur: 5, epaisseur: 1 },
    tete: { rayon: 2.2, museau: 2 },
    dos: "lisse",
    queue: 0,
    yeux: C.sangFrais,
  },
  /** Le Cracheur : un crapaud, large et bas, la gueule toujours ouverte. */
  cracheur: {
    famille: "monstre-cracheur",
    cadre: CADRE_BETE,
    corps: { longueur: 12, hauteur: 9, matiere: matiere(melanger(MONSTRE.corps, C.bile, 0.35)) },
    pattes: { nombre: 4, longueur: 3.5, epaisseur: 2.4 },
    // Museau de 4 et non 5 : la gueule ouverte au bond sortait du cadre de 20.
    tete: { rayon: 4, museau: 4 },
    dos: "pustules",
    queue: 0,
    yeux: C.sangFrais,
  },
  /** La Brute : une masse a plaques d'os, la tete basse. Cuite plus grosse. */
  brute: {
    famille: "monstre-brute",
    cadre: CADRE_GROSSE_BETE,
    // Corps de 18 et non 20 : au bond de l'attaque, le museau sortait du
    // cadre de 30 — il avait sa marge dans celui de 48.
    corps: { longueur: 18, hauteur: 13, matiere: matiere(melanger(MONSTRE.corps, C.fer, 0.25)) },
    pattes: { nombre: 4, longueur: 8, epaisseur: 3.5 },
    tete: { rayon: 4.5, museau: 2.5 },
    dos: "plaques",
    queue: 0,
    yeux: C.sangFrais,
  },
  /** Le Fielleux : une outre gonflee sur des pattes greles, qui va eclater. */
  kamikaze: {
    famille: "monstre-kamikaze",
    cadre: CADRE_BETE,
    corps: { longueur: 11, hauteur: 11, matiere: matiere(melanger(MONSTRE.corps, C.sangSeche, 0.3)) },
    pattes: { nombre: 4, longueur: 6, epaisseur: 1.2 },
    tete: { rayon: 2.6, museau: 2 },
    dos: "pustules",
    queue: 0,
    yeux: C.sangFrais,
  },
  /**
   * L'Ecumeur : long, bas, presque pas de pattes. C'est un nageur, et sa queue
   * le dit — elle fait la moitie de son corps (§4.21, la nuit de crue).
   */
  ecumeur: {
    famille: "monstre-ecumeur",
    cadre: CADRE_BETE,
    corps: { longueur: 11, hauteur: 6, matiere: matiere(melanger(MONSTRE.corps, EAU.corps, 0.62)) },
    pattes: { nombre: 4, longueur: 3.5, epaisseur: 1.4 },
    tete: { rayon: 3, museau: 4 },
    dos: "epines",
    queue: 5,
    yeux: C.sangFrais,
  },
  /**
   * L'Engloutisseur : large, lourd, six pattes courtes. Il ne court pas, il
   * traine — et ce qu'il attrape, il le ramene vers l'eau (§4.21).
   */
  engloutisseur: {
    famille: "monstre-engloutisseur",
    cadre: CADRE_GROSSE_BETE,
    corps: {
      longueur: 16,
      hauteur: 12,
      matiere: matiere(melanger(melanger(MONSTRE.corps, SOUS_BOIS.corps, 0.55), EAU.sombre, 0.25)),
    },
    pattes: { nombre: 6, longueur: 4, epaisseur: 3.2 },
    tete: { rayon: 4.2, museau: 3 },
    dos: "pustules",
    queue: 4,
    yeux: C.sangFrais,
  },
  /** Le familier du Mage : une flamme froide qui flotte. */
  familier: {
    famille: "familier",
    cadre: CADRE_BETE,
    corps: { longueur: 8, hauteur: 10, matiere: matiere(desaturer(melanger(C.cielSale, C.fer, 0.3), 0.25)) },
    pattes: { nombre: 4, longueur: 0, epaisseur: 0 },
    tete: { rayon: 0, museau: 0 },
    dos: "lisse",
    queue: 0,
    yeux: C.os,
    flotte: true,
  },
  /** Le golem : un bloc de pierre qui marche. Cuit plus gros. */
  "familier-golem": {
    famille: "familier-golem",
    cadre: CADRE_GROSSE_BETE,
    corps: { longueur: 18, hauteur: 16, matiere: PIERRE },
    pattes: { nombre: 4, longueur: 7, epaisseur: 4.5 },
    tete: { rayon: 3.5, museau: 1 },
    dos: "plaques",
    queue: 0,
    yeux: C.laiton,
  },
  /** Le spectre : le meme feu follet, en os, plus effile. */
  "familier-spectre": {
    famille: "familier-spectre",
    cadre: CADRE_BETE,
    corps: { longueur: 6, hauteur: 12, matiere: matiere(melanger(C.os, C.fer, 0.3)) },
    pattes: { nombre: 4, longueur: 0, epaisseur: 0 },
    tete: { rayon: 0, museau: 0 },
    dos: "lisse",
    queue: 0,
    yeux: C.cielSale,
    flotte: true,
  },
};

/** Les monstres qui sont des morts : ils prennent le corps humain. */
export const MORTS = {
  /** Le Revenant ennemi : les yeux du sang. */
  revenant: { famille: "monstre-revenant", yeux: C.sangFrais },
  /** Le mort-vivant du Necromancien : les yeux du ciel sale, c'est un des notres. */
  "mort-vivant": { famille: "mort-vivant", yeux: C.cielSale },
} as const;

/**
 * Les gestes d'un monstre : ceux que `poses.ts` declenche sur un ennemi.
 *
 * Memes durees que les heros : une attaque de 285 ms qui joue cinq frames tourne
 * a 18 images par seconde, et la charge **tient sa derniere frame** — c'est
 * l'horodatage du monstre qui decide du depart du coup, pas l'animation.
 */
export const GESTES_MONSTRE: readonly Geste[] = [
  { cle: "repos", frames: 4, cadence: 3, boucle: true },
  { cle: "marche", frames: 6, cadence: 10, boucle: true },
  { cle: "attaque", frames: 5, cadence: 18, boucle: false, evenement: "morsure", frameCle: 3 },
  { cle: "charge", frames: 4, cadence: 7, boucle: false },
  { cle: "touche", frames: 3, cadence: 18, boucle: false },
  { cle: "mort", frames: 6, cadence: 9, boucle: false, evenement: "chute", frameCle: 5 },
];

/** Ce qu'une bete fait de son corps a un instant d'un geste. */
export interface Allure {
  /** Le corps avance (positif) ou recule. */
  avancee: number;
  /** Le corps monte (negatif) ou s'ecrase. */
  hauteur: number;
  /** La phase des pattes, de 0 a 1 ; 0 = a l'arret. */
  pas: number;
  /** La gueule, de 0 (fermee) a 1 (ouverte). */
  gueule: number;
  /** De 0 a 1 : elle s'ecrase au sol. C'est la mort. */
  affaissement: number;
}

/**
 * L'allure d'une bete a un instant d'un geste. **Fonction pure**, testee.
 *
 * @param avancement de 0 a 1 dans le geste.
 */
export function allure(geste: string, avancement: number): Allure {
  const repos: Allure = { avancee: 0, hauteur: 0, pas: 0, gueule: 0, affaissement: 0 };

  switch (geste) {
    case "marche":
      return { ...repos, pas: avancement, hauteur: Math.abs(Math.sin(avancement * Math.PI * 2)) < 0.5 ? -1 : 0 };

    case "attaque": {
      // Elle se ramasse sur la premiere moitie, puis se jette. Le coup est le
      // point le plus avance — c'est la frame que l'evenement de son vise.
      const arme = avancement <= 0.5;
      const part = arme ? avancement / 0.5 : (avancement - 0.5) / 0.5;
      // ⚠️ Trois pixels de bond, pas plus : au-dela, le museau d'une brute sort
      // de son cadre de 48 et son contour est coupe.
      return {
        ...repos,
        avancee: arme ? -2 * part : -2 + 5 * part,
        hauteur: arme ? part : -1,
        gueule: arme ? part * 0.5 : 1,
      };
    }

    case "charge": {
      // Le telegraphe : elle recule, s'aplatit, et tient. C'est la seule pose
      // que le joueur doit avoir le temps de lire.
      return { ...repos, avancee: -2 * avancement, hauteur: 2 * avancement, gueule: 0.6 * avancement };
    }

    case "touche": {
      const choc = Math.sin(Math.min(1, avancement) * Math.PI);
      return { ...repos, avancee: -2 * choc, hauteur: -choc, gueule: 0.4 * choc };
    }

    case "mort": {
      const chute = Math.min(1, avancement * 1.15);
      return { ...repos, affaissement: chute, gueule: 1 - chute, hauteur: chute };
    }

    default:
      // La respiration : un pixel, lentement.
      return { ...repos, hauteur: avancement < 0.5 ? 0 : -1 };
  }
}

// -------------------------------------------------------------- la peinture

/**
 * Peint une bete, dans son cadre. La geometrie est ecrite pour un dessin de 32
 * et **mise a l'echelle** du cadre : c'est ce qui permet de cuire une brute
 * nette au lieu d'agrandir un sprite — et de descendre toutes les betes d'un
 * cran quand les humains descendent.
 */
export function peindreBete(toile: Toile, bete: Bete, geste: string, avancement: number): void {
  const brute = allure(geste, avancement);
  const f = bete.cadre / 32;
  // ⚠️ Les deplacements de l'allure sont **des pixels entiers** : ils suivent
  // l'echelle, mais arrondis — un bond d'un demi-pixel decalerait une moitie
  // de la bete et pas l'autre. Et jamais moins d'un pixel quand il y en avait
  // un : la respiration doit rester visible.
  const entier = (v: number) => (v === 0 ? 0 : Math.sign(v) * Math.max(1, Math.round(Math.abs(v) * f)));
  const a: Allure = { ...brute, avancee: entier(brute.avancee), hauteur: entier(brute.hauteur) };
  const sol = 28 * f;
  const m = bete.corps.matiere;

  toile.ombreAuSol(bete.cadre / 2, sol, (bete.corps.longueur / 2 + 2) * f, 2.5 * f);

  if (bete.flotte) {
    peindreFlamme(toile, bete, bete.cadre / 2 + a.avancee, sol, a, f);
    return;
  }

  // La bete est decalee vers l'arriere de la moitie de sa tete : c'est le
  // museau qui depasse devant, et c'est lui qui doit rester dans le cadre.
  const milieu = bete.cadre / 2 + a.avancee - bete.tete.rayon * f * 0.5;

  // Le corps s'affaisse a la mort : il descend et s'aplatit.
  const hauteurCorps = bete.corps.hauteur * (1 - a.affaissement * 0.6) * f;
  // A la mort, le ventre finit deux pixels au-dessus du sol : c'est ce qui
  // laisse la place aux pattes ecartees et au contour.
  const bas =
    a.affaissement > 0
      ? sol - 2 * f - (1 - a.affaissement) * (bete.pattes.longueur - 2) * f
      : sol - bete.pattes.longueur * f + a.hauteur;
  const haut = bas - hauteurCorps;
  const gauche = milieu - (bete.corps.longueur / 2) * f;
  const droite = milieu + (bete.corps.longueur / 2) * f;

  // La queue, derriere tout.
  if (bete.queue > 0) {
    // Elle se dresse : une queue qui traine derriere sortirait du cadre quand
    // la bete recule pour se ramasser.
    toile.membre(gauche + f, haut + hauteurCorps * 0.4, bete.queue * f, -Math.PI / 2 - 0.8 + a.affaissement, 1.6 * f, m.sombre);
  }

  // Les pattes : la paire arriere d'abord, puis le corps, puis l'avant.
  const pattes = bete.pattes;
  const ecart = pattes.nombre === 6 ? 0.25 : 0.32;
  const positions = pattes.nombre === 6 ? [0.18, 0.5, 0.82] : [0.22, 0.78];
  const angleDe = (index: number, arriere: boolean) => {
    if (a.affaissement > 0) {
      return (arriere ? -1 : 1) * (0.2 + 0.7 * a.affaissement) * (index % 2 === 0 ? 1 : -1);
    }
    if (a.pas === 0) return (index % 2 === 0 ? 0.1 : -0.1) * (arriere ? -1 : 1);
    const phase = a.pas * Math.PI * 2 + index * Math.PI;
    return Math.sin(phase) * 0.55;
  };
  // ⚠️ **Les pieds touchent le sol, jamais plus bas.** La longueur d'une patte
  // se deduit de la hauteur du corps et de son angle — une patte de longueur
  // fixe sous un corps qui s'accroupit passait sous le sol et sortait du cadre.
  const longueurDe = (angle: number) =>
    a.affaissement > 0
      ? pattes.longueur * f * (1 - a.affaissement * 0.5)
      : Math.max(1, (sol - (bas - f) - (pattes.epaisseur * f) / 2) / Math.max(0.5, Math.cos(angle)));
  for (const [i, p] of positions.entries()) {
    const x = gauche + (droite - gauche) * p;
    const angle = angleDe(i, true);
    toile.membre(x - ecart * 4 * f, bas - f, longueurDe(angle), angle, pattes.epaisseur * f, m.sombre);
  }

  // Le corps : un ovale allonge, plus clair sur le dos, plus sombre au ventre.
  peindreOvale(toile, gauche, haut, droite - gauche, hauteurCorps, m);

  for (const [i, p] of positions.entries()) {
    const x = gauche + (droite - gauche) * p;
    const angle = angleDe(i + 1, false);
    toile.membre(x + ecart * 4 * f, bas - f, longueurDe(angle), angle, pattes.epaisseur * f, m.corps);
  }

  // Ce qu'elle porte sur le dos.
  peindreDos(toile, bete, gauche, haut, droite - gauche, f, a.affaissement);

  // La tete, devant, et sa gueule.
  const rayon = bete.tete.rayon * f;
  const teteX = droite - rayon * 0.4;
  // La tete reste en haut du corps, meme affaisse : un crapaud dont la tete
  // s'enfoncait avec le corps sortait du cadre par le bas.
  const teteY = haut + rayon * 0.5;
  toile.disque(teteX, teteY, rayon, m.corps);
  toile.disque(teteX - rayon * 0.4, teteY - rayon * 0.45, rayon * 0.4, m.clair);
  // Le museau, vers l'avant ; la gueule s'ouvre en dessous.
  const museau = bete.tete.museau * f;
  toile.rect(teteX, teteY - rayon * 0.3, museau + rayon * 0.6, rayon * 0.9, m.corps);
  toile.rect(teteX, teteY - rayon * 0.3, museau + rayon * 0.6, 1, m.clair);
  if (a.gueule > 0.15) {
    const ouverture = Math.round(a.gueule * 3 * f);
    toile.rect(teteX + rayon * 0.2, teteY + rayon * 0.6, museau + rayon * 0.4, ouverture, C.fer);
    // Les dents : de l'os.
    toile.point(teteX + rayon * 0.4, teteY + rayon * 0.6, CHAIR.clair);
    toile.point(teteX + museau + rayon * 0.4, teteY + rayon * 0.6, CHAIR.clair);
  }
  // Les yeux : le seul sang frais du monde.
  toile.point(teteX + rayon * 0.3, teteY - rayon * 0.1, bete.yeux);
  if (rayon > 3) toile.point(teteX - rayon * 0.5, teteY - rayon * 0.1, bete.yeux);
}

/** Un ovale de matiere : dos clair, ventre sombre. */
function peindreOvale(toile: Toile, x: number, y: number, largeur: number, hauteur: number, m: Matiere): void {
  const cx = x + largeur / 2;
  const cy = y + hauteur / 2;
  const rx = largeur / 2;
  const ry = hauteur / 2;
  for (let py = Math.floor(y); py <= Math.ceil(y + hauteur); py += 1) {
    for (let px = Math.floor(x); px <= Math.ceil(x + largeur); px += 1) {
      const dx = (px - cx) / rx;
      const dy = (py - cy) / ry;
      if (dx * dx + dy * dy > 1) continue;
      const part = (py - y) / Math.max(1, hauteur);
      toile.point(px, py, part < 0.25 ? m.clair : part > 0.72 ? m.sombre : m.corps);
    }
  }
}

function peindreDos(toile: Toile, bete: Bete, x: number, y: number, largeur: number, f: number, affaissement: number): void {
  const m = bete.corps.matiere;
  const hauteur = (1 - affaissement) * f;
  switch (bete.dos) {
    case "epines":
      for (let i = 0; i < 3; i += 1) {
        const px = x + largeur * (0.3 + i * 0.2);
        toile.rect(px, y - 2 * hauteur, 1, 2 * hauteur + 1, m.sombre);
        toile.point(px, y - 2 * hauteur - 1, CHAIR.clair);
      }
      break;
    case "plaques": {
      const os = melanger(CHAIR.clair, PIERRE.clair, 0.5);
      for (let i = 0; i < 3; i += 1) {
        const px = x + largeur * (0.2 + i * 0.25);
        toile.rect(px, y - hauteur, 4 * f, 2 * f + 1, os);
        toile.rect(px, y - hauteur, 4 * f, 1, C.os);
      }
      break;
    }
    case "pustules":
      for (let i = 0; i < 3; i += 1) {
        const px = x + largeur * (0.25 + i * 0.22);
        const py = y + 2 * f + (i % 2) * 2 * f;
        toile.point(px, py, SANG.corps);
        toile.point(px + 1, py, SANG.sombre);
      }
      break;
    default:
      break;
  }
}

/** Un feu follet : une flamme qui ondule, deux yeux, pas de pattes. */
function peindreFlamme(toile: Toile, bete: Bete, milieu: number, sol: number, a: Allure, f: number): void {
  const m = bete.corps.matiere;
  const ondulation = Math.sin(a.pas * Math.PI * 2) * 1.5 * f;
  const hauteur = bete.corps.hauteur * (1 - a.affaissement * 0.7) * f;
  const largeur = bete.corps.longueur * f;
  // Elle s'eteint en descendant, mais son disque du bas ne passe jamais sous
  // le sol : un pixel de marge, comme tout ce qui meurt.
  const bas = Math.min(sol - largeur / 2 - 1, sol - 6 * f + a.hauteur + a.affaissement * 2 * f);

  // La flamme : des disques de plus en plus petits en montant, decales par
  // l'ondulation.
  for (let i = 0; i < 4; i += 1) {
    const part = i / 4;
    const r = (largeur / 2) * (1 - part * 0.7);
    const cx = milieu + ondulation * part;
    const cy = bas - hauteur * part;
    toile.disque(cx, cy, r, part > 0.5 ? m.clair : m.corps);
  }
  toile.disque(milieu + ondulation, bas - hauteur, largeur * 0.12, m.clair);
  toile.disque(milieu, bas - hauteur * 0.2, largeur * 0.32, m.sombre);
  // Les yeux.
  const oeilY = bas - hauteur * 0.45;
  toile.point(milieu - 1.5 * f, oeilY, bete.yeux);
  toile.point(milieu + 1.5 * f, oeilY, bete.yeux);
}

// ----------------------------------------------------------------- les morts

/** Un mort qui marche : le corps humain, use jusqu'au bout. */
function tenueDeMort(): Apparence {
  return {
    tunique: matiere(melanger(TISSU.corps, C.fer, 0.2)),
    jambes: TISSU,
    coiffe: { genre: "nu" },
    usure: 1,
    sang: 0.6,
  };
}

// --------------------------------------------------------------- les modeles

/** Le modele a cuire d'une bete. */
export function bete(id: keyof typeof BETES): Modele {
  const b = BETES[id]!;
  return {
    famille: b.famille,
    taille: b.cadre,
    gestes: GESTES_MONSTRE,
    dessiner: (toile, geste, avancement) => peindreBete(toile, b, geste, avancement),
  };
}

/**
 * Le modele a cuire d'un mort : le corps humain, voute et pali, les yeux allumes.
 *
 * Il reprend les gestes des heros : un mort attaque en griffant, ce qui est
 * exactement le coup de bras d'un heros sans arme.
 */
export function mort(id: keyof typeof MORTS): Modele {
  const def = MORTS[id];
  const tenue = tenueDeMort();
  return {
    famille: def.famille,
    taille: CADRE,
    gestes: GESTES_MONSTRE,
    dessiner: (toile, geste, avancement) => {
      const a = { ...postureHumaine(geste, avancement, 1), outil: false };
      // Un mort se traine : le pas est plus court, le dos ne se redresse jamais.
      const attaches = peindreCorps(toile, { ...a, buste: Math.max(a.buste, debout(1).buste) }, {
        ...tenue,
        yeux: def.yeux,
      });
      // Les griffes : trois pixels d'os au bout de la main qui frappe.
      if (geste === "attaque" && avancement > 0.5) {
        toile.point(attaches.main.x + 1, attaches.main.y, CHAIR.clair);
        toile.point(attaches.main.x + 2, attaches.main.y + 1, CHAIR.clair);
      }
    },
  };
}

/** Tous les modeles de monstres et d'invocations, pour la cuisson au demarrage. */
export function tousLesMonstres(): Modele[] {
  return [
    ...(Object.keys(BETES) as (keyof typeof BETES)[]).map((id) => bete(id)),
    ...(Object.keys(MORTS) as (keyof typeof MORTS)[]).map((id) => mort(id)),
  ];
}

/** La famille de texture d'un archetype d'`ennemis.ts`, ou d'une invocation. */
export function familleDeMonstre(id: string): string {
  if (id in MORTS) return MORTS[id as keyof typeof MORTS].famille;
  return BETES[id]?.famille ?? BETES.fonceur!.famille;
}
