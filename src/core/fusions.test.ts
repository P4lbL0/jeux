import { describe, expect, it } from "vitest";
import { Rng } from "./rng";
import {
  activesPossedees,
  competenceParId,
  demandeUnePlace,
  enDoublePrix,
  estDisponible,
  ordreDesCompetences,
  palierAtteint,
  paliersReels,
  propositionCompetence,
  propositionsDeRemplacement,
  tirerCompetences,
  touchesLiberees,
  type CompetenceDef,
  type CompetencesFondues,
  type CompetencesPossedees,
} from "./competences";
import {
  auPalier,
  bannisQuiReviennent,
  facteurDUsure,
  FUSIONS,
  fusionsPossibles,
  sequelleDuRevenant,
  fusionsQuiLiberent,
  ingredientsDe,
  propositionFusion,
  texteDesIngredients,
} from "./fusions";

function def(id: string): CompetenceDef {
  const c = competenceParId(id);
  if (!c) throw new Error(`competence inconnue : ${id}`);
  return c;
}

/** Des competences tenues a leur maximum. */
function auMaximum(...ids: string[]): CompetencesPossedees {
  return Object.fromEntries(ids.map((id) => [id, def(id).paliers.length]));
}

const aucuneEvolution = {};

describe("Les fusions (§4.25) — le catalogue", () => {
  it("en porte douze, les neuf sur competences existantes et les trois qui coutent cher", () => {
    expect(FUSIONS.map((f) => f.id).sort()).toEqual(
      [
        "soleil-d-acier",
        "moulin-a-lames",
        "reseau-electrique",
        "satellites-conducteurs",
        "tourbillon-infernal",
        "forteresse-mobile",
        "temps-fracture",
        "general-des-morts",
        "neant",
        "berserker-terminal",
        "revenant",
        "exil-des-morts",
      ].sort(),
    );
  });

  it("ne fond que des competences qui existent, et chaque evolution exigee existe", () => {
    for (const f of FUSIONS) {
      for (const i of f.fusion?.ingredients ?? []) {
        const c = def(i.competence);
        expect(c.fusion).toBeUndefined();
        if (i.evolution) expect(c.evolutions?.options.map((o) => o.id)).toContain(i.evolution);
      }
    }
  });

  it("donne a chacune un premier palier au prix simple, puis deux prises par palier", () => {
    for (const f of FUSIONS) {
      expect(f.paliers[0]?.demi).toBeFalsy();
      const reels = paliersReels(f);
      expect(f.paliers.length).toBe(reels * 2 - 1);
    }
    expect(paliersReels(def("soleil-d-acier"))).toBe(3);
    expect(paliersReels(def("neant"))).toBe(2);
  });
});

describe("Le double prix (§4.25) — il faut la choisir deux fois pour gagner un palier", () => {
  const paliers = enDoublePrix([
    { texte: "un", rechargement: 8000 },
    { texte: "deux", rechargement: 7000 },
    { texte: "trois", rechargement: 6000 },
  ]);

  it("glisse une moitie entre deux vrais paliers, qui garde le rechargement d'avant", () => {
    expect(paliers.map((p) => [p.texte, !!p.demi, p.rechargement])).toEqual([
      ["un", false, 8000],
      ["deux", true, 8000],
      ["deux", false, 7000],
      ["trois", true, 7000],
      ["trois", false, 6000],
    ]);
  });

  it("compte le vrai palier sans les moities", () => {
    const f = def("tourbillon-infernal");
    expect([1, 2, 3, 4, 5].map((prises) => palierAtteint(f, prises))).toEqual([1, 1, 2, 2, 3]);
    // Une competence ordinaire : une prise, un palier.
    expect(palierAtteint(def("moulinet"), 2)).toBe(2);
  });

  it("dit sur la carte laquelle des deux fois c'est", () => {
    const f = def("tourbillon-infernal");
    const premiere = propositionCompetence(f, { [f.id]: 1 });
    expect(premiere.nom).toBe("Tourbillon infernal 2");
    expect(premiere.description).toMatch(/^1 sur 2/);
    const seconde = propositionCompetence(f, { [f.id]: 2 });
    expect(seconde.nom).toBe("Tourbillon infernal 2");
    expect(seconde.description).toMatch(/^2 sur 2/);
    // Une competence ordinaire ne dit rien de tel.
    expect(propositionCompetence(def("moulinet"), { moulinet: 1 }).description).not.toMatch(/sur 2/);
  });
});

describe("Quand une fusion se propose", () => {
  it("se propose quand ses deux ingredients sont a leur maximum, pas avant", () => {
    const tenues = auMaximum("epee-tournoyante", "aura-de-flammes");
    expect(fusionsPossibles(tenues, aucuneEvolution, {}).map((f) => f.id)).toEqual(["soleil-d-acier"]);
    const presque = { ...tenues, "aura-de-flammes": 2 };
    expect(fusionsPossibles(presque, aucuneEvolution, {})).toEqual([]);
  });

  it("exige l'evolution demandee : la Forteresse mobile veut la Charge sismique", () => {
    const tenues = auMaximum("charge", "dome");
    expect(fusionsPossibles(tenues, { charge: { id: "charge-sanglante" } }, {})).toEqual([]);
    expect(fusionsPossibles(tenues, { charge: { id: "charge-sismique" } }, {}).map((f) => f.id)).toEqual([
      "forteresse-mobile",
    ]);
  });

  it("propose les deux fusions qui se disputent un ingredient, et plus aucune une fois l'une prise", () => {
    const tenues = auMaximum("epee-tournoyante", "aura-de-flammes", "ricochet");
    expect(fusionsPossibles(tenues, aucuneEvolution, {}).map((f) => f.id).sort()).toEqual([
      "moulin-a-lames",
      "soleil-d-acier",
    ]);
    const apres = { ...tenues, "soleil-d-acier": 1 };
    const fondues: CompetencesFondues = { "epee-tournoyante": "soleil-d-acier", "aura-de-flammes": "soleil-d-acier" };
    expect(fusionsPossibles(apres, aucuneEvolution, fondues)).toEqual([]);
  });

  it("ne se propose plus une fois prise", () => {
    const tenues = { ...auMaximum("sablier", "danse-des-ombres"), "temps-fracture": 1 };
    const fondues = { sablier: "temps-fracture", "danse-des-ombres": "temps-fracture" };
    expect(fusionsPossibles(tenues, aucuneEvolution, fondues)).toEqual([]);
  });

  it("montre sur sa carte ce qu'elle consomme, evolution comprise", () => {
    expect(texteDesIngredients(def("soleil-d-acier"))).toBe("Epee tournoyante 5 + Aura de flammes 3");
    expect(texteDesIngredients(def("forteresse-mobile"))).toBe("Charge sismique 3 + Dome 3");
    const carte = propositionFusion(def("soleil-d-acier"));
    expect(carte.fusionne).toBe("Epee tournoyante 5 + Aura de flammes 3");
    expect(carte.etiquette).toContain("FUSION");
  });
});

describe("Aucune fusion ne s'affiche avant de se proposer", () => {
  it("ne sort jamais de la pioche avant d'etre prise", () => {
    for (const f of FUSIONS) expect(estDisponible(f, "guerrier", {})).toBe(false);
    const rng = new Rng(7);
    for (let i = 0; i < 300; i++) {
      for (const c of tirerCompetences(rng, "mage", {}, 3)) expect(c.fusion).toBeUndefined();
    }
  });

  it("revient dans la pioche une fois prise, pour monter", () => {
    expect(estDisponible(def("soleil-d-acier"), "guerrier", { "soleil-d-acier": 1 })).toBe(true);
    expect(estDisponible(def("soleil-d-acier"), "guerrier", { "soleil-d-acier": 5 })).toBe(false);
  });

  it("ne rend jamais un ingredient fondu a la pioche : il reste tenu a son maximum", () => {
    const tenues = { ...auMaximum("epee-tournoyante", "aura-de-flammes"), "soleil-d-acier": 1 };
    expect(estDisponible(def("epee-tournoyante"), "guerrier", tenues)).toBe(false);
  });
});

describe("Les touches d'une fusion", () => {
  it("retire les ingredients des touches ; la fusion reprend la place du premier qui en avait une", () => {
    // Clignement (1re touche), Moulinet (2e), Priere (3e), puis l'aura et la fusion.
    const tenues: CompetencesPossedees = {
      clignement: 1,
      moulinet: 3,
      priere: 1,
      "aura-de-flammes": 3,
      "tourbillon-infernal": 1,
    };
    const fondues = { moulinet: "tourbillon-infernal", "aura-de-flammes": "tourbillon-infernal" };
    expect(ordreDesCompetences(tenues, fondues)).toEqual(["clignement", "tourbillon-infernal", "priere"]);
    expect(activesPossedees(tenues, fondues).map((c) => c.id)).toEqual([
      "clignement",
      "tourbillon-infernal",
      "priere",
    ]);
  });

  it("libere une touche quand deux actives n'en font plus qu'une", () => {
    expect(touchesLiberees(def("forteresse-mobile"))).toBe(1);
    expect(touchesLiberees(def("neant"))).toBe(1);
    expect(touchesLiberees(def("tourbillon-infernal"))).toBe(0);
    expect(touchesLiberees(def("soleil-d-acier"))).toBe(0);
    const possibles = [def("forteresse-mobile"), def("tourbillon-infernal"), def("soleil-d-acier")];
    expect(fusionsQuiLiberent(possibles).map((f) => f.id)).toEqual(["forteresse-mobile"]);
  });

  it("ne demande jamais de place pour une fusion qui reprend une touche", () => {
    const pleines = auMaximum("charge", "dome", "clignement", "sablier");
    expect(demandeUnePlace(def("forteresse-mobile"), pleines, 4)).toBe(false);
    expect(demandeUnePlace(def("priere"), pleines, 4)).toBe(true);
  });

  it("met les fusions qui liberent une touche sur l'ecran « plus de place »", () => {
    const pleines = auMaximum("charge", "dome", "clignement", "sablier");
    const cartes = propositionsDeRemplacement(pleines, 4, 0, 0, {}, [propositionFusion(def("forteresse-mobile"))]);
    expect(cartes.map((c) => c.id)).toEqual(["charge", "dome", "clignement", "sablier", "forteresse-mobile"]);
  });

  it("nomme ses ingredients par leur identifiant", () => {
    expect(ingredientsDe(def("neant"))).toEqual(["exil", "heure-sombre"]);
  });
});

describe("Les regles des fusions qui coutent cher", () => {
  it("fait revenir tous les bannis la nuit suivante, au plus le double de la nuit", () => {
    expect(bannisQuiReviennent(40, 300)).toBe(40);
    expect(bannisQuiReviennent(4000, 300)).toBe(300);
    expect(bannisQuiReviennent(0, 300)).toBe(0);
  });

  it("use le Berserker de 8 % par aube, pour toujours", () => {
    expect(facteurDUsure(0)).toBe(1);
    expect(facteurDUsure(1)).toBeCloseTo(0.92);
    expect(facteurDUsure(8)).toBeCloseTo(0.513, 3);
  });

  it("tire la sequelle du Revenant parmi celles qu'il n'a pas", () => {
    expect(sequelleDuRevenant(0, [], 5)).toBe(0);
    expect(sequelleDuRevenant(0.99, [], 5)).toBe(4);
    expect(sequelleDuRevenant(0, [0, 1], 5)).toBe(2);
    expect(sequelleDuRevenant(0.5, [0, 1, 2, 3, 4], 5)).toBeNull();
  });

  it("borne un reglage au dernier palier ecrit", () => {
    expect(auPalier([1, 2, 3], 1)).toBe(1);
    expect(auPalier([1, 2, 3], 3)).toBe(3);
    expect(auPalier([10, 20], 3)).toBe(20);
  });
});
