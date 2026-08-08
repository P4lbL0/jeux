import { describe, expect, it } from "vitest";
import { CASE, COLONNES, Grille, LIGNES, grilleFideleALaFormule } from "./grille";
import { MONDE, TERRAIN, VILLAGE, terrainEn } from "./carte";
import {
  CONSTRUCTIONS,
  abordable,
  coutReparation,
  payer,
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
