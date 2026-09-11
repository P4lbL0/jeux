import { describe, expect, it } from "vitest";
import {
  CASE,
  COLONNES,
  Grille,
  IMPOSENT_UNE_DISTANCE,
  LIGNES,
  grilleFideleALaFormule,
} from "./grille";
import { MONDE, TERRAIN, VILLAGE, terrainEn } from "./carte";
import {
  CASES_LIBRES_AUTOUR_DES_BATIMENTS,
  CONSTRUCTIONS,
  PART_REMBOURSEE,
  abordable,
  coutReparation,
  crediter,
  payer,
  remboursementDemolition,
} from "./constructions";
import { stocksVides } from "./habitants";

describe("La grille — cuire la carte ne doit pas la changer (§4.21)", () => {
  const grille = new Grille();

  it("couvre tout le monde", () => {
    expect(COLONNES * CASE).toBeGreaterThanOrEqual(MONDE.largeur);
    expect(LIGNES * CASE).toBeGreaterThanOrEqual(MONDE.hauteur);
  });

  it("dit exactement la meme chose que la formule", () => {
    // C'est la promesse du §4.21 : la carte reste apprenable par coeur, seule sa
    // representation change.
    expect(grilleFideleALaFormule(grille)).toBe(true);
  });

  it("retrouve la case d'un point, et son centre", () => {
    const centre = grille.centreDe(100, 100);
    expect(centre.x % CASE).toBe(CASE / 2);
    expect(grille.caseEn(centre.x, centre.y)).toBe(grille.caseEn(100, 100));
  });

  it("ne sort jamais de ses bornes", () => {
    expect(grille.case(-1, 0)).toBeNull();
    expect(grille.case(COLONNES, 0)).toBeNull();
    expect(grille.caseEn(-40, -40)).toBeNull();
    expect(grille.occupationEn(-40, -40)).toBe("libre");
  });
});

describe("La couche modifiable", () => {
  it("nait entierement libre", () => {
    const grille = new Grille();
    expect(grille.toutesLes("mur")).toHaveLength(0);
    expect(grille.occupationEn(VILLAGE.x, VILLAGE.y)).toBe("libre");
  });

  it("garde ce qu'on y pose, sans toucher au terrain", () => {
    const grille = new Grille();
    const avant = grille.caseEn(VILLAGE.x, VILLAGE.y)!.terrain;
    grille.poser(VILLAGE.x, VILLAGE.y, "mur");
    expect(grille.occupationEn(VILLAGE.x, VILLAGE.y)).toBe("mur");
    expect(grille.caseEn(VILLAGE.x, VILLAGE.y)!.terrain).toBe(avant);
  });

  it("laisse passer une porte ouverte, et la ferme avec les autres", () => {
    // §4.20 : une porte ouverte est un passage pour tout le monde ; la cloche
    // les ferme toutes, et une porte fermee arrete comme un mur.
    const grille = new Grille();
    grille.poser(VILLAGE.x, VILLAGE.y, "porte");
    expect(grille.bloque(VILLAGE.x, VILLAGE.y)).toBe(false);
    grille.portesFermees = true;
    expect(grille.bloque(VILLAGE.x, VILLAGE.y)).toBe(true);
    grille.portesFermees = false;
    expect(grille.bloque(VILLAGE.x, VILLAGE.y)).toBe(false);
  });

  it("dit a une case quelles voisines se raccordent, dans l'ordre nord-est-sud-ouest", () => {
    // C'est ce que lit le dessin d'un mur (§4.30) : un mur, une tour ou une
    // porte se raccordent ; une ruine ou un champ, non.
    const grille = new Grille();
    const colonne = grille.colonneDe(VILLAGE.x);
    const ligne = grille.ligneDe(VILLAGE.y);
    const poser = (dc: number, dl: number, quoi: "mur" | "tour" | "porte" | "ruine" | "champ") => {
      const centre = Grille.centreCase(colonne + dc, ligne + dl);
      grille.poser(centre.x, centre.y, quoi);
    };
    expect(grille.voisinesRaccordees(colonne, ligne)).toEqual({ nord: false, est: false, sud: false, ouest: false });
    poser(0, -1, "mur");
    poser(1, 0, "tour");
    poser(0, 1, "ruine");
    poser(-1, 0, "porte");
    expect(grille.voisinesRaccordees(colonne, ligne)).toEqual({ nord: true, est: true, sud: false, ouest: true });
    poser(0, 1, "champ");
    expect(grille.voisinesRaccordees(colonne, ligne).sud).toBe(false);
    // Le bord de la carte n'est pas un voisin.
    expect(grille.voisinesRaccordees(0, 0)).toEqual({ nord: false, est: false, sud: false, ouest: false });
  });

  it("bloque le passage sur un mur et une tour, pas sur un champ", () => {
    const grille = new Grille();
    grille.poser(VILLAGE.x, VILLAGE.y, "mur");
    expect(grille.bloque(VILLAGE.x, VILLAGE.y)).toBe(true);

    grille.poser(VILLAGE.x, VILLAGE.y, "tour");
    expect(grille.bloque(VILLAGE.x, VILLAGE.y)).toBe(true);

    // Un champ se traverse — et c'est bien pour ca qu'une horde le ruine.
    grille.poser(VILLAGE.x, VILLAGE.y, "champ");
    expect(grille.bloque(VILLAGE.x, VILLAGE.y)).toBe(false);
  });

  it("refuse de batir dans la mer et dans la roche (§4.6)", () => {
    const grille = new Grille();
    const enMer = TERRAIN.mer - 80;
    expect(terrainEn(enMer, 600)).not.toBe("herbe");
    expect(grille.constructible(enMer, 600)).toBe(false);
    expect(grille.constructible(800, MONDE.hauteur - 20)).toBe(false);
  });

  it("refuse de batir sur une case deja prise", () => {
    const grille = new Grille();
    const { x, y } = { x: VILLAGE.x + 200, y: VILLAGE.y };
    const libre = grille.constructible(x, y);
    grille.poser(x, y, "mur");
    expect(libre).toBe(true);
    expect(grille.constructible(x, y)).toBe(false);
  });
});

describe("La ruine se rebatit (§4.24)", () => {
  // Le defaut que ces trois tests ferment : `detruire` et `pietiner` ecrivaient
  // "ruine" et rien ne remettait jamais "libre". Chaque mur tombe sterilisait
  // definitivement son emplacement — sur la ligne de front, exactement.
  const point = { x: VILLAGE.x + 200, y: VILLAGE.y };

  it("laisse rebatir la ou quelque chose est tombe", () => {
    const grille = new Grille();
    grille.poser(point.x, point.y, "ruine");
    expect(grille.constructible(point.x, point.y)).toBe(true);
  });

  it("ne bloque le passage sur aucune ruine", () => {
    const grille = new Grille();
    grille.poser(point.x, point.y, "ruine");
    expect(grille.bloque(point.x, point.y)).toBe(false);
  });

  it("rend la case a la carte quand on la libere", () => {
    const grille = new Grille();
    grille.poser(point.x, point.y, "mur");
    expect(grille.constructible(point.x, point.y)).toBe(false);
    grille.liberer(point.x, point.y);
    expect(grille.occupationEn(point.x, point.y)).toBe("libre");
    expect(grille.constructible(point.x, point.y)).toBe(true);
  });
});

describe("Les regles de pose (§4.24)", () => {
  const point = { x: VILLAGE.x + 200, y: VILLAGE.y };

  it("compte les cases en carre, pas a vol d'oiseau", () => {
    const grille = new Grille();
    grille.poser(point.x, point.y, "batiment");

    // La diagonale est a la meme distance que la ligne droite : une regle de
    // pose se lit sur la grille qu'on voit.
    const rayon = CASES_LIBRES_AUTOUR_DES_BATIMENTS;
    const enDiagonale = { x: point.x + rayon * CASE, y: point.y + rayon * CASE };
    expect(grille.aProximite(enDiagonale.x, enDiagonale.y, rayon, ["batiment"])).toBe(true);
  });

  it("laisse exactement trois cases vides entre un batiment et ce qu'on batit", () => {
    const grille = new Grille();
    grille.poser(point.x, point.y, "batiment");
    const rayon = CASES_LIBRES_AUTOUR_DES_BATIMENTS;

    const trop = { x: point.x + rayon * CASE, y: point.y };
    const juste = { x: point.x + (rayon + 1) * CASE, y: point.y };
    expect(grille.aProximite(trop.x, trop.y, rayon, ["batiment"])).toBe(true);
    expect(grille.aProximite(juste.x, juste.y, rayon, ["batiment"])).toBe(false);
  });

  it("ne voit que les occupations qu'on lui demande", () => {
    const grille = new Grille();
    grille.poser(point.x, point.y, "mur");
    expect(grille.aProximite(point.x, point.y, 3, ["batiment"])).toBe(false);
  });

  it("ne fait imposer une distance qu'a l'eglise et au port, jamais aux maisons", () => {
    // Mesure en jouant : neuf maisons en couronne, chacune avec trois cases
    // interdites autour, repoussaient la palissade a 256 px du centre du village
    // contre 82 px avant. L'enceinte doit pouvoir passer entre les maisons.
    const grille = new Grille();
    grille.poser(point.x, point.y, "maison");
    const rayon = CASES_LIBRES_AUTOUR_DES_BATIMENTS;
    const colle = { x: point.x + CASE, y: point.y };
    expect(grille.aProximite(colle.x, colle.y, rayon, IMPOSENT_UNE_DISTANCE)).toBe(false);
  });

  it("garde la case d'une maison prise, meme sans distance", () => {
    const grille = new Grille();
    grille.poser(point.x, point.y, "maison");
    expect(grille.constructible(point.x, point.y)).toBe(false);
    expect(grille.bloque(point.x, point.y)).toBe(true);
  });

  it("marque toute l'emprise d'un batiment, pas son seul centre", () => {
    // Une eglise de 96 px couvre trois cases : n'en poser qu'une laisserait
    // batir contre son flanc.
    const grille = new Grille();
    grille.poserEmprise(point.x, point.y, CASE * 3, CASE * 3, "batiment");
    expect(grille.occupationEn(point.x - CASE, point.y)).toBe("batiment");
    expect(grille.occupationEn(point.x + CASE, point.y)).toBe("batiment");
    expect(grille.occupationEn(point.x, point.y + CASE)).toBe("batiment");
  });

  it("couvre les deux cases d'une emprise de 48 px", () => {
    // L'eglise fait exactement ca. Un demi-rayon arrondi vers le bas donnerait
    // floor(48/2/32) = 0, donc une seule case, et on batirait contre son flanc.
    const grille = new Grille();
    const centre = grille.centreDe(point.x, point.y);
    grille.poserEmprise(centre.x, centre.y, 48, 48, "batiment");
    expect(grille.toutesLes("batiment").length).toBeGreaterThanOrEqual(4);
  });

  it("fait d'un batiment un obstacle", () => {
    const grille = new Grille();
    grille.poser(point.x, point.y, "batiment");
    expect(grille.bloque(point.x, point.y)).toBe(true);
    expect(grille.constructible(point.x, point.y)).toBe(false);
  });
});

describe("Demolir rend la moitie (§4.24)", () => {
  it("rend la moitie du prix d'une construction intacte", () => {
    const def = CONSTRUCTIONS.palissade;
    const rendu = remboursementDemolition(def, def.pvMax);
    expect(rendu.bois).toBe(Math.floor(def.cout.bois! * PART_REMBOURSEE));
  });

  it("ne rend rien d'une construction a terre", () => {
    // Sinon rebatir sur une ruine serait gratuit : on encaisserait le prix plein
    // d'un mur qui ne valait plus rien.
    const rendu = remboursementDemolition(CONSTRUCTIONS.tour, 0);
    expect(Object.values(rendu).every((v) => v === 0)).toBe(true);
  });

  it("rend moins que le prix neuf, quoi qu'il arrive", () => {
    for (const def of Object.values(CONSTRUCTIONS)) {
      const rendu = remboursementDemolition(def, def.pvMax);
      for (const [ressource, montant] of Object.entries(def.cout)) {
        expect(rendu[ressource as keyof typeof rendu]!).toBeLessThan(montant!);
      }
    }
  });

  it("verse vraiment ce qu'il rend dans les stocks", () => {
    const stocks = stocksVides();
    const def = CONSTRUCTIONS.tour;
    const rendu = remboursementDemolition(def, def.pvMax);
    crediter(rendu, stocks);
    expect(stocks.bois).toBe(rendu.bois);
    expect(stocks.minerai).toBe(rendu.minerai);
  });

  it("ne permet jamais de gagner du bois en batissant puis en demolissant", () => {
    // La boucle infinie evidente, et elle doit rester fermee.
    const stocks = stocksVides();
    stocks.bois = 100;
    const def = CONSTRUCTIONS.palissade;
    const depart = stocks.bois;
    for (let i = 0; i < 5; i++) {
      payer(def, stocks);
      crediter(remboursementDemolition(def, def.pvMax), stocks);
    }
    expect(stocks.bois).toBeLessThan(depart);
  });
});

describe("Les constructions (§4.20)", () => {
  it("distingue une position occupable d'un simple obstacle", () => {
    // C'est toute la regle du §4.20 : la tour ne fait rien seule, mais on y monte.
    expect(CONSTRUCTIONS.tour.occupable).toBe(true);
    expect(CONSTRUCTIONS.palissade.occupable).toBe(false);
    expect(CONSTRUCTIONS.tour.bonusPortee).toBeGreaterThan(0);
  });

  it("ne se batit qu'avec de quoi payer", () => {
    const stocks = stocksVides();
    expect(abordable(CONSTRUCTIONS.palissade, stocks)).toBe(false);
    stocks.bois = 12;
    expect(abordable(CONSTRUCTIONS.palissade, stocks)).toBe(true);
    payer(CONSTRUCTIONS.palissade, stocks);
    expect(stocks.bois).toBe(0);
  });

  it("ne fait pas payer une construction intacte", () => {
    const cout = coutReparation(CONSTRUCTIONS.tour, CONSTRUCTIONS.tour.pvMax);
    expect(Object.values(cout).every((v) => v === 0)).toBe(true);
  });

  it("rend l'entretien moins cher que le rebati", () => {
    // Sinon personne ne repare jamais rien : on laisse tomber et on recommence.
    const def = CONSTRUCTIONS.tour;
    const cout = coutReparation(def, 0);
    expect(cout.bois!).toBeLessThan(def.cout.bois!);
  });
});
