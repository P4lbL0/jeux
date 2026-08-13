import { CLASSES, ORDRE_RANGS, type ClassId, type Rang } from "../../core/classes";
import type { Geste, Modele } from "./four";
import type { Toile } from "./pinceau";
import { BOIS, CHAIR, FER, LAITON, PIERRE, TISSU, TOILE, melanger, rebaser } from "./palette";
import {
  CADRE,
  borner,
  debout,
  peindreCorps,
  type Apparence,
  type Attitude,
} from "./corps";

/**
 * Les heros (DESIGN.md §4.30).
 *
 * ⚠️ **Ils n'ont pas de corps a eux** : `corps.ts` dessine le meme humain que le
 * villageois, et ce fichier ne decrit que **ce qu'ils portent** et **comment ils
 * bougent**. C'est litteralement la regle du §4.18 — *un heros est un villageois
 * qui a appris* — et c'est ce qui fera que le passage villageois → heros du
 * bloc 9 n'aura rien a redessiner.
 *
 * Ce qui les distingue :
 *
 * 1. **La teinte de leur classe**, rebasee dans la palette du monde
 *    (`rebaser`) — le seul travail qu'on lui demande est de faire reconnaitre
 *    qui est qui a petite taille.
 * 2. **Leur arme**, une par classe.
 * 3. **Leur palier d'equipement** : un tous les deux rangs.
 */

/**
 * **Cinq paliers pour neuf rangs** (§4.30).
 *
 * Neuf paliers voudraient dire neuf silhouettes a distinguer a 32 px : elles se
 * ressembleraient toutes, donc aucune ne dirait rien. Cinq, on les lit — et le
 * dernier n'appartient qu'au SSR.
 */
export const PALIERS = 5;

export function palierDeRang(rang: Rang): number {
  const index = ORDRE_RANGS.indexOf(rang);
  return Math.min(PALIERS - 1, Math.floor(Math.max(0, index) / 2));
}

/** Ce que chaque palier ajoute (§4.30). */
const CASQUE_DES = 1;
const PLASTRON_DES = 2;
const CAPE_DES = 3;
const LAITON_DES = 4;

/** L'arme d'une classe. Une par classe, et elle ne change jamais. */
type Arme = "epee" | "epee-bouclier" | "baton" | "dague" | "arc" | "sceptre" | "baton-os";

const ARMES: Record<ClassId, Arme> = {
  guerrier: "epee",
  chevalier: "epee-bouclier",
  mage: "baton",
  assassin: "dague",
  rodeur: "arc",
  oracle: "sceptre",
  necromancien: "baton-os",
};

/** Le son qu'une classe fait en frappant. Personne ne l'ecoute encore (§4.30). */
const BRUIT: Record<Arme, string> = {
  epee: "lame",
  "epee-bouclier": "lame",
  baton: "sort",
  dague: "lame",
  arc: "tir",
  sceptre: "sort",
  "baton-os": "sort",
};

/**
 * Les sept gestes que `poses.ts` attend d'une famille animee.
 *
 * Les durees ne sont pas choisies ici : ce sont celles de `POSES` dans
 * `poses.ts`, et les cadences en decoulent. Une attaque de 285 ms qui joue cinq
 * frames tourne a 18 images par seconde — si les deux divergent, l'animation
 * finit avant ou apres le coup, et l'eclair d'impact ne coincide plus.
 */
export function gestesDeHero(classe: ClassId): readonly Geste[] {
  const bruit = BRUIT[ARMES[classe]];
  return [
    { cle: "repos", frames: 4, cadence: 3, boucle: true },
    { cle: "marche", frames: 6, cadence: 10, boucle: true },
    { cle: "attaque", frames: 5, cadence: 18, boucle: false, evenement: bruit, frameCle: 3 },
    { cle: "charge", frames: 4, cadence: 7, boucle: false },
    { cle: "incantation", frames: 6, cadence: 18, boucle: false, evenement: "sort", frameCle: 4 },
    { cle: "touche", frames: 3, cadence: 18, boucle: false },
    { cle: "mort", frames: 6, cadence: 9, boucle: false, evenement: "chute", frameCle: 5 },
  ];
}

/**
 * Le geste, a un instant donne. **Fonction pure** : c'est elle qui est testee.
 *
 * @param avancement de 0 a 1 dans le geste.
 */
export function posture(geste: string, avancement: number, usure = 0): Attitude {
  const repos = debout(usure);
  const dos = repos.buste;

  switch (geste) {
    case "marche": {
      const balancier = Math.sin(avancement * Math.PI * 2);
      return borner({
        ...repos,
        jambeAvant: balancier * 0.5,
        jambeArriere: -balancier * 0.5,
        brasAvant: repos.brasAvant - balancier * 0.42,
        brasArriere: repos.brasArriere + balancier * 0.42,
        sursaut: Math.abs(balancier) < 0.5 ? -1 : 0,
        // ⚠️ **Il marche arme.** C'est l'inverse du villageois, dont l'outil
        // n'est en main qu'au travail (§4.30) : un heros desarme qui traverse la
        // place ne se distinguerait plus d'un habitant, et c'est precisement ce
        // qu'il faut lire d'un coup d'oeil la nuit.
        outil: true,
      });
    }

    case "attaque": {
      // Le meme arc que le coup de pioche, en deux fois plus court : le bras part
      // en arriere sur la premiere moitie, la lame tombe sur la seconde.
      //
      // ⚠️ **La coupure est a 0,5 parce que le geste a cinq frames sans boucle**,
      // donc son avancement vaut 0 / 0,25 / 0,5 / 0,75 / 1. A 0,4, aucune frame
      // ne tombait sur la fin de l'armement : le bras s'arretait a mi-course et
      // le coup partait de nulle part. Meme classe de defaut que la pioche.
      const arme = avancement <= 0.5;
      const part = arme ? avancement / 0.5 : Math.min(1, (avancement - 0.5) / 0.5);
      return borner({
        ...repos,
        brasAvant: arme ? 0.1 - part * 1.7 : -1.6 + part * 2.1,
        brasArriere: repos.brasArriere - 0.2,
        buste: dos + (arme ? -0.12 : part * 0.3),
        jambeAvant: 0.3,
        jambeArriere: -0.26,
        outil: true,
      });
    }

    case "charge": {
      // **Le telegraphe** : il se ramasse, l'arme part loin derriere, et il tient
      // cette derniere image. C'est la seule pose que le joueur doit avoir le
      // temps de lire — la brute la garde 620 ms.
      const part = avancement;
      return borner({
        ...repos,
        brasAvant: 0.1 - part * 1.5,
        brasArriere: repos.brasArriere - part * 0.5,
        buste: dos - part * 0.18,
        jambeAvant: 0.34 * part,
        jambeArriere: -0.3 * part,
        sursaut: part > 0.6 ? -1 : 0,
        outil: true,
      });
    }

    case "incantation": {
      // Les deux bras montent : c'est ce qui la distingue d'une attaque, ou un
      // seul bras bouge. A 32 px, la symetrie est le signal le plus lisible.
      const montee = Math.sin(Math.min(1, avancement * 1.3) * Math.PI);
      return borner({
        ...repos,
        brasAvant: repos.brasAvant - montee * 2.5,
        brasArriere: repos.brasArriere + montee * 0.4 - montee * 2.2,
        buste: dos - montee * 0.15,
        sursaut: montee > 0.7 ? -1 : 0,
        outil: true,
      });
    }

    case "touche": {
      // Un sursaut en arriere, et rien de plus : il est joue a chaque coup recu,
      // donc il ne doit jamais couvrir ce que le personnage etait en train de
      // faire.
      const choc = Math.sin(Math.min(1, avancement) * Math.PI);
      return borner({
        ...repos,
        buste: dos - choc * 0.3,
        tete: repos.tete - choc * 0.25,
        brasAvant: repos.brasAvant + choc * 0.5,
        brasArriere: repos.brasArriere - choc * 0.4,
        outil: true,
      });
    }

    case "mort": {
      // Il s'affaisse. La chute a le droit de faire ce que les autres n'ont pas
      // — sortir de la posture debout — parce qu'elle commence par couper le
      // corps physique (`poses.ts`, `animerMort`).
      const chute = Math.min(1, avancement * 1.15);
      return borner({
        ...repos,
        buste: dos + chute * 0.5,
        tete: repos.tete + chute * 0.4,
        brasAvant: repos.brasAvant + chute * 0.8,
        brasArriere: repos.brasArriere - chute * 0.9,
        // ⚠️ **Les jambes s'ecartent au lieu de s'allonger**, et c'est ce qui
        // fait tenir la chute dans le carreau : un membre a plat prend de la
        // largeur, un membre tendu vers le bas prend de la hauteur — et il n'y a
        // que deux pixels sous les pieds. Ca tombe bien, c'est aussi ce a quoi
        // ressemble quelqu'un qui s'effondre.
        jambeAvant: chute * 1.0,
        jambeArriere: -chute * 0.85,
        // Il descend au lieu de monter : c'est le seul geste ou le sursaut est
        // positif.
        sursaut: Math.round(chute * 2),
        outil: chute < 0.5,
      });
    }

    default:
      return borner({ ...repos, sursaut: avancement < 0.5 ? 0 : -1, outil: true });
  }
}

/** Ce qu'un heros de cette classe et de ce palier porte (§4.30). */
export function tenueDeHero(classe: ClassId, palier: number, usure = 0, sang = 0): Apparence {
  const teinte = rebaser(CLASSES[classe].couleur);
  return {
    tunique: teinte,
    // ⚠️ **Les jambes sont sombres, jamais de la couleur de classe.** Un heros
    // peint d'une seule teinte du col aux pieds sort en pate de couleur : on ne
    // voit ni sa taille, ni son pas. C'est la meme structure a deux valeurs qui
    // rend le villageois lisible — et c'est le corps commun qui l'impose, pas un
    // choix de heros.
    jambes: TISSU,
    // Le plastron arrive au palier 2 ; avant, le torse est d'une seule matiere.
    ventre: palier >= PLASTRON_DES ? FER : undefined,
    coiffe: palier >= CASQUE_DES ? { genre: "casque", matiere: FER } : { genre: "nu" },
    cape: palier >= CAPE_DES ? teinte : undefined,
    usure,
    sang,
    // ⚠️ Le laiton est la couleur de l'interface (§4.10). S'il coulait sur tous
    // les heros, il ne voudrait plus rien dire — ni sur les panneaux, ni sur le
    // terrain. Le SSR, et lui seul.
    laiton: palier >= LAITON_DES ? LAITON.corps : undefined,
  };
}

/**
 * Un heros, pour une classe et un palier.
 *
 * ⚠️ **On cuit a la demande.** Cuire les 35 combinaisons au demarrage serait
 * payer d'avance des sprites que la partie ne verra peut-etre jamais ; une
 * montee de rang cuit **une** planche, a un instant ou le jeu est de toute facon
 * a l'arret. C'est la lecture stricte du §4.17 regle 3 : rien par image, mais
 * rien d'inutile au demarrage non plus.
 */
export function hero(classe: ClassId, palier: number, usure = 0, sang = 0): Modele {
  const tenue = tenueDeHero(classe, palier, usure, sang);
  const arme = ARMES[classe];
  return {
    famille: familleDeHero(classe, palier),
    taille: CADRE,
    gestes: gestesDeHero(classe),
    dessiner: (toile, geste, avancement) => {
      const a = posture(geste, avancement, usure);
      const attaches = peindreCorps(toile, a, tenue);
      if (arme === "epee-bouclier") peindreBouclier(toile, attaches.mainArriere, palier);
      if (a.outil) peindreArme(toile, arme, attaches.main, a.brasAvant, palier);
    },
  };
}

/** La cle de texture d'un heros. Une par classe **et par palier**. */
export function familleDeHero(classe: ClassId, palier: number): string {
  return `hero-${classe}-p${palier}`;
}

// ------------------------------------------------------------------ les armes

function peindreArme(
  toile: Toile,
  arme: Arme,
  main: { x: number; y: number },
  angle: number,
  palier: number,
): void {
  const sin = Math.sin(angle);
  const cos = Math.cos(angle);
  // Une arme **prolonge le bras**, sinon elle flotte a cote de la main. Elle
  // s'allonge d'un pixel au palier du plastron : c'est la seule montee de palier
  // qui se lit sur la silhouette en mouvement.
  const rallonge = palier >= PLASTRON_DES ? 1 : 0;
  // Le laiton du palier 4 va sur le tranchant, jamais sur le manche : c'est ce
  // qui vaut quelque chose (§4.30).
  const eclat = palier >= LAITON_DES ? LAITON : FER;

  const bout = (longueur: number) => ({
    x: main.x + sin * longueur,
    y: main.y + cos * longueur,
  });
  const travers = (a: { x: number; y: number }, demi: number, epaisseur: number, couleur: number) =>
    toile.segment(a.x - cos * demi, a.y + sin * demi, a.x + cos * demi, a.y - sin * demi, epaisseur, couleur);

  switch (arme) {
    case "epee":
    case "epee-bouclier": {
      const pointe = bout(5 + rallonge);
      toile.segment(main.x, main.y, pointe.x, pointe.y, 1.6, eclat.clair);
      // La garde, en travers : sans elle une epee est un baton gris.
      travers(bout(0.6), 1.6, 1.2, palier >= LAITON_DES ? LAITON.corps : BOIS.corps);
      break;
    }

    case "dague": {
      const pointe = bout(3 + rallonge);
      toile.segment(main.x, main.y, pointe.x, pointe.y, 1.4, eclat.clair);
      break;
    }

    case "baton":
    case "baton-os": {
      // Le baton depasse **des deux cotes** de la main : c'est ce qui le rend
      // lisible quand le bras est leve, ou une simple tige disparait derriere la
      // tete.
      const haut = bout(5 + rallonge);
      const bas = bout(-2.5);
      toile.segment(bas.x, bas.y, haut.x, haut.y, 1.4, BOIS.corps);
      const tete = arme === "baton-os" ? melanger(CHAIR.clair, PIERRE.clair, 0.5) : eclat.clair;
      toile.disque(haut.x, haut.y, palier >= LAITON_DES ? 1.8 : 1.4, tete);
      break;
    }

    case "sceptre": {
      const haut = bout(3.5 + rallonge);
      toile.segment(main.x, main.y, haut.x, haut.y, 1.4, BOIS.corps);
      toile.disque(haut.x, haut.y, 1.6, palier >= LAITON_DES ? LAITON.clair : TOILE.clair);
      break;
    }

    case "arc": {
      // L'arc est **perpendiculaire au bras**, jamais dans son axe : un arc tenu
      // dans le prolongement de la main est un baton.
      //
      // ⚠️ **Et il ne s'elargit pas avec le palier**, contrairement aux autres
      // armes qui s'allongent : une arme perpendiculaire prend sa longueur en
      // **largeur**, et c'est la dimension ou il reste le moins de place quand le
      // bras est tendu vers l'avant. Mesure : a demi-largeur 5, le Rodeur de
      // palier 2 sortait du carreau a la derniere frame de son tir. Le palier se
      // lit sur la corde, pas sur l'envergure.
      const centre = bout(0.8);
      travers(centre, 3.6, 1.2, BOIS.clair);
      travers(bout(-0.2), 3.2, 1, palier >= LAITON_DES ? LAITON.corps : PIERRE.sombre);
      break;
    }
  }
}

function peindreBouclier(
  toile: Toile,
  mainArriere: { x: number; y: number },
  palier: number,
): void {
  // Le bouclier appartient au **bras arriere**, donc il se peint derriere le
  // corps : un bouclier devant le torse cacherait la couleur de classe, qui est
  // la seule chose qui dit qui c'est.
  toile.disque(mainArriere.x, mainArriere.y - 1, palier >= PLASTRON_DES ? 3.4 : 2.8, FER.corps);
  toile.disque(mainArriere.x, mainArriere.y - 1, 1.2, palier >= LAITON_DES ? LAITON.corps : FER.clair);
}
