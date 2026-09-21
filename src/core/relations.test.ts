import { describe, expect, it } from "vitest";
import {
  clePaire,
  estPositive,
  NOMS_RELATION,
  REGLAGES_RELATIONS,
  Relations,
  RESUMES_RELATION,
} from "./relations";

const S = REGLAGES_RELATIONS;

describe("la paire", () => {
  it("est la meme dans les deux sens", () => {
    expect(clePaire("a", "b")).toBe(clePaire("b", "a"));
  });

  it("ne garde qu'une entree par couple", () => {
    const r = new Relations();
    r.poser("h1", "v2", "amitie", 20);
    r.poser("v2", "h1", "amitie", 20);
    expect(r.taille).toBe(1);
    expect(r.lien("h1", "v2")?.intensite).toBe(40);
  });

  it("ne lie personne a soi-meme", () => {
    const r = new Relations();
    expect(r.poser("h1", "h1", "amitie", 50)).toBeNull();
    expect(r.lien("h1", "h1")).toBeNull();
    expect(r.taille).toBe(0);
  });

  it("nomme et resume chacun des onze types", () => {
    for (const cle of Object.keys(NOMS_RELATION)) {
      expect(NOMS_RELATION[cle as keyof typeof NOMS_RELATION]).toBeTruthy();
      expect(RESUMES_RELATION[cle as keyof typeof RESUMES_RELATION]).toBeTruthy();
    }
  });
});

describe("un sentiment se dispute la place", () => {
  it("se renforce quand c'est le meme", () => {
    const r = new Relations();
    r.poser("a", "b", "amitie", 30);
    r.poser("a", "b", "amitie", 30);
    expect(r.lien("a", "b")).toMatchObject({ type: "amitie", intensite: 60 });
  });

  it("plafonne a 100", () => {
    const r = new Relations();
    r.poser("a", "b", "amitie", 80);
    r.poser("a", "b", "amitie", 80);
    expect(r.lien("a", "b")?.intensite).toBe(S.plafond);
  });

  it("use le sentiment inverse au lieu d'ouvrir une seconde entree", () => {
    const r = new Relations();
    r.poser("a", "b", "amitie", 40);
    r.poser("a", "b", "haine", 15);
    expect(r.taille).toBe(1);
    expect(r.lien("a", "b")).toMatchObject({ type: "amitie", intensite: 25 });
  });

  it("bascule quand l'inverse l'emporte, et garde le reste", () => {
    const r = new Relations();
    r.poser("a", "b", "amitie", 20);
    r.poser("a", "b", "haine", 50);
    expect(r.lien("a", "b")).toMatchObject({ type: "haine", intensite: 30 });
  });

  it("efface le lien quand les deux s'annulent", () => {
    const r = new Relations();
    r.poser("a", "b", "amitie", 20);
    r.poser("a", "b", "haine", 20);
    expect(r.lien("a", "b")).toBeNull();
    expect(r.taille).toBe(0);
  });

  it("remplace un positif par un autre sans rien perdre", () => {
    const r = new Relations();
    r.poser("a", "b", "amitie", 30);
    r.poser("a", "b", "amour", 40);
    expect(r.lien("a", "b")).toMatchObject({ type: "amour", intensite: 70 });
  });
});

describe("la famille", () => {
  it("s'installe par-dessus n'importe quoi et ne se perd plus", () => {
    const r = new Relations();
    r.poser("a", "b", "haine", 80);
    r.poser("a", "b", "famille", 50);
    expect(r.lien("a", "b")?.type).toBe("famille");
    r.poser("a", "b", "haine", 100);
    expect(r.lien("a", "b")?.type).toBe("famille");
  });

  it("ne s'use pas avec les journees", () => {
    const r = new Relations();
    r.poser("a", "b", "famille", 40);
    for (let jour = 1; jour <= 60; jour++) r.passerUneJournee([], jour);
    expect(r.lien("a", "b")?.intensite).toBe(40);
  });

  it("compte parmi les positives", () => {
    expect(estPositive("famille")).toBe(true);
    expect(estPositive("haine")).toBe(false);
  });
});

describe("les journees qui passent", () => {
  it("ajoute deux par nuit ensemble", () => {
    const r = new Relations();
    r.poser("a", "b", "amitie", 30);
    r.passerUneJournee([["a", "b"]], 2);
    expect(r.lien("a", "b")?.intensite).toBe(30 + S.parNuitEnsemble);
  });

  it("retire un par journee separes", () => {
    const r = new Relations();
    r.poser("a", "b", "amitie", 30);
    r.passerUneJournee([], 2);
    expect(r.lien("a", "b")?.intensite).toBe(30 - S.parJourSepares);
  });

  it("efface ce qui tombe sous le plancher : un lien faible n'existe pas", () => {
    const r = new Relations();
    r.poser("a", "b", "amitie", S.plancher + 1);
    r.passerUneJournee([], 2);
    r.passerUneJournee([], 3);
    expect(r.lien("a", "b")).toBeNull();
    expect(r.taille).toBe(0);
  });

  it("renforce aussi une haine que la nuit a mise cote a cote", () => {
    const r = new Relations();
    r.poser("a", "b", "haine", 30);
    r.passerUneJournee([["a", "b"]], 2);
    expect(r.lien("a", "b")).toMatchObject({ type: "haine", intensite: 32 });
  });
});

describe("ce que ca change vraiment", () => {
  it("fait pleurer un ami deux fois plus, et un frere davantage", () => {
    const r = new Relations();
    expect(r.facteurDeDeuil("a", "b")).toBe(1);
    r.poser("a", "b", "amitie", 50);
    expect(r.facteurDeDeuil("a", "b")).toBe(2);
    r.poser("a", "c", "famille", 50);
    expect(r.facteurDeDeuil("a", "c")).toBe(2.5);
  });

  it("fait pleurer moins celui qu'on haissait", () => {
    const r = new Relations();
    r.poser("a", "b", "haine", 70);
    expect(r.facteurDeDeuil("a", "b")).toBe(0.5);
  });

  it("empeche deux ennemis de cooperer, mais seulement au-dela du seuil", () => {
    const r = new Relations();
    r.poser("a", "b", "haine", S.seuilDeGroupe - 10);
    expect(r.refusentDeCooperer("a", "b")).toBe(false);
    r.poser("a", "b", "haine", 20);
    expect(r.refusentDeCooperer("a", "b")).toBe(true);
  });

  it("fait frapper plus fort deux rivaux qui se battent cote a cote", () => {
    const r = new Relations();
    r.poser("a", "b", "rivalite", S.plafond);
    expect(r.bonusDeRivalite("a", ["b"])).toBeCloseTo(0.1);
    // Seul, le rival ne sert a rien : c'est cote a cote que ca compte.
    expect(r.bonusDeRivalite("a", [])).toBe(0);
    // Et une amitie ne fait pas frapper plus fort.
    r.poser("a", "c", "amitie", S.plafond);
    expect(r.bonusDeRivalite("a", ["c"])).toBe(0);
  });

  it("ne cumule pas deux rivalites : on garde la plus forte", () => {
    const r = new Relations();
    r.poser("a", "b", "rivalite", S.plafond);
    r.poser("a", "c", "rivalite", S.plafond);
    expect(r.bonusDeRivalite("a", ["b", "c"])).toBeCloseTo(0.1);
  });

  it("fait obeir celui qui doit quelque chose a un vivant", () => {
    const r = new Relations();
    r.poser("a", "b", "dette", S.seuilDeGroupe);
    expect(r.obeitMalgreTout("a", ["b"])).toBe(true);
    // Le creancier est mort : la dette ne pousse plus personne.
    expect(r.obeitMalgreTout("a", ["c"])).toBe(false);
  });

  it("dit qui en craint un autre, au-dela du seuil", () => {
    const r = new Relations();
    r.poser("a", "b", "peur", S.seuilDeGroupe);
    expect(r.craint("a", "b")).toBe(true);
    expect(r.craint("a", "z")).toBe(false);
  });
});

describe("les liens d'une personne", () => {
  it("les rend du plus fort au plus faible", () => {
    const r = new Relations();
    r.poser("a", "b", "amitie", 20);
    r.poser("a", "c", "haine", 60);
    r.poser("b", "c", "respect", 90);
    const liens = r.lesLiensDe("a");
    expect(liens.map((l) => l.avec)).toEqual(["c", "b"]);
  });

  it("emporte les liens du mort, apres les avoir rendus", () => {
    const r = new Relations();
    r.poser("a", "b", "amitie", 20);
    r.poser("a", "c", "haine", 60);
    const partis = r.oublier("a");
    expect(partis).toHaveLength(2);
    expect(r.lesLiensDe("a")).toHaveLength(0);
    expect(r.taille).toBe(0);
  });

  it("designe la famille pour heriter, meme moins intense", () => {
    const r = new Relations();
    r.poser("mort", "ami", "amitie", 90);
    r.poser("mort", "frere", "famille", 30);
    expect(r.leProche("mort", ["ami", "frere"])?.avec).toBe("frere");
  });

  it("ne fait heriter ni un mort ni un ennemi", () => {
    const r = new Relations();
    r.poser("mort", "ennemi", "haine", 90);
    expect(r.leProche("mort", ["ennemi"])).toBeNull();
    r.poser("mort", "ami", "amitie", 50);
    expect(r.leProche("mort", ["ennemi"])).toBeNull();
    expect(r.leProche("mort", ["ami", "ennemi"])?.avec).toBe("ami");
  });
});

describe("le cout, qui est le sujet du fichier", () => {
  it("ne depasse jamais la borne dure, meme sur un village enorme", () => {
    const r = new Relations();
    for (let i = 0; i < 80; i++) {
      for (let j = i + 1; j < 80; j++) r.poser(`v${i}`, `v${j}`, "respect", 10 + (i % 40));
    }
    expect(r.taille).toBeLessThanOrEqual(S.paquesMax);
  });

  it("se sauve et se relit a l'identique", () => {
    const r = new Relations();
    r.poser("a", "b", "amitie", 40, 3);
    r.poser("a", "c", "haine", 70, 5);
    const relu = new Relations();
    relu.importer(r.exporter());
    expect(relu.taille).toBe(2);
    expect(relu.lien("a", "b")).toMatchObject({ type: "amitie", intensite: 40, dernierJour: 3 });
    expect(relu.lien("a", "c")?.type).toBe("haine");
  });

  it("ignore ce qu'une sauvegarde abimee contient", () => {
    const relu = new Relations();
    relu.importer([
      ["sans-barre", { type: "amitie", intensite: 40, dernierJour: 1 }],
      ["a|b", { type: "amitie", intensite: 1, dernierJour: 1 }],
      ["a|c", { type: "amitie", intensite: 40, dernierJour: 1 }],
    ]);
    expect(relu.taille).toBe(1);
    expect(relu.lien("a", "c")).not.toBeNull();
  });
});
