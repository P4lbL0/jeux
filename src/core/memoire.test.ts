import { describe, expect, it } from "vitest";
import {
  Archives,
  direLeSouvenir,
  estFondateur,
  EVENEMENTS,
  raconter,
  seSouvenir,
  SOUVENIRS_MAX,
  suitesDeLaMort,
  titreDe,
  type Souvenir,
} from "./memoire";
import { Relations } from "./relations";

const courageMoyen = (): number => 50;

describe("les souvenirs", () => {
  it("s'arretent a huit", () => {
    const liste: Souvenir[] = [];
    for (let i = 1; i <= 20; i++) seSouvenir(liste, { cle: "a-survecu", jour: i, combien: i });
    expect(liste).toHaveLength(SOUVENIRS_MAX);
  });

  it("jettent les plus anciens en premier", () => {
    const liste: Souvenir[] = [];
    for (let i = 1; i <= 12; i++) seSouvenir(liste, { cle: "a-survecu", jour: i, combien: i });
    expect(liste[0]!.jour).toBe(5);
    expect(liste[liste.length - 1]!.jour).toBe(12);
  });

  it("ne jettent jamais un fondateur tant qu'il reste autre chose", () => {
    const liste: Souvenir[] = [];
    seSouvenir(liste, { cle: "a-perdu-un-proche", jour: 1, qui: "Marc" });
    for (let i = 2; i <= 20; i++) seSouvenir(liste, { cle: "a-survecu", jour: i, combien: i });
    expect(liste).toHaveLength(SOUVENIRS_MAX);
    expect(liste[0]).toMatchObject({ cle: "a-perdu-un-proche", qui: "Marc" });
  });

  it("cedent le plus ancien fondateur quand il n'y a plus qu'eux", () => {
    const liste: Souvenir[] = [];
    for (let i = 1; i <= 12; i++) seSouvenir(liste, { cle: "a-tenu-seul", jour: i });
    expect(liste).toHaveLength(SOUVENIRS_MAX);
    expect(liste[0]!.jour).toBe(5);
  });

  it("ne comptent pas deux fois le meme evenement", () => {
    const liste: Souvenir[] = [];
    seSouvenir(liste, { cle: "a-vu-mourir", jour: 3, qui: "Marc" });
    seSouvenir(liste, { cle: "a-vu-mourir", jour: 3, qui: "Marc" });
    expect(liste).toHaveLength(1);
  });

  it("reconnaissent les fondateurs", () => {
    expect(estFondateur("a-perdu-un-proche")).toBe(true);
    expect(estFondateur("a-survecu")).toBe(false);
  });

  it("s'ecrivent avec les vrais noms, au moment de l'afficher", () => {
    expect(direLeSouvenir({ cle: "a-perdu-un-proche", jour: 3, qui: "Marc" })).toBe("A perdu Marc");
    expect(direLeSouvenir({ cle: "a-survecu", jour: 6, combien: 6 })).toBe(
      "A survecu a l'attaque de la nuit 6",
    );
  });
});

describe("les archives", () => {
  it("n'ont aucun effet quand rien ne s'est passe", () => {
    const a = new Archives();
    expect(a.effets).toEqual({ satisfaction: 0, natalite: 0, recrutement: 0, agressivite: 0 });
  });

  it("appliquent un massacre : la satisfaction tombe, le recrutement monte", () => {
    const a = new Archives();
    a.inscrire({ type: "massacre", jour: 5, combien: 14, lieu: "le pont" });
    expect(a.effets.satisfaction).toBe(-10);
    expect(a.effets.recrutement).toBeCloseTo(0.15);
  });

  it("laissent l'evenement s'estomper", () => {
    const a = new Archives();
    a.inscrire({ type: "massacre", jour: 5 });
    a.avancerAuJour(5 + EVENEMENTS.massacre.journees - 1);
    expect(a.effets.satisfaction).toBe(-10);
    a.avancerAuJour(5 + EVENEMENTS.massacre.journees);
    expect(a.effets.satisfaction).toBe(0);
    // Mais il reste aux archives : c'est tout l'interet.
    expect(a.tout).toHaveLength(1);
  });

  it("font descendre le sacrifice avant de le faire remonter", () => {
    const a = new Archives();
    a.inscrire({ type: "sacrifice", jour: 1, qui: "Marc" });
    expect(a.effets.satisfaction).toBeLessThan(0);
    a.avancerAuJour(4);
    expect(a.effets.satisfaction).toBeGreaterThan(0);
  });

  it("cumulent deux evenements du meme jour", () => {
    const a = new Archives();
    a.inscrire({ type: "massacre", jour: 3 });
    a.inscrire({ type: "famine", jour: 3 });
    expect(a.effets.satisfaction).toBe(-22);
  });

  it("ne gardent pas plus que leur borne", () => {
    const a = new Archives(5);
    for (let i = 1; i <= 20; i++) a.inscrire({ type: "premiere-fois", jour: i, qui: `n${i}` });
    expect(a.tout).toHaveLength(5);
  });

  it("disent ce qui est encore vif, du plus recent au plus ancien", () => {
    const a = new Archives();
    a.inscrire({ type: "massacre", jour: 1 });
    a.inscrire({ type: "famine", jour: 3 });
    const vifs = a.vifs(3);
    expect(vifs.map((e) => e.type)).toEqual(["famine", "massacre"]);
    expect(a.vifs(99)).toHaveLength(0);
  });

  it("se sauvent et se relisent", () => {
    const a = new Archives();
    a.inscrire({ type: "massacre", jour: 5, combien: 14 });
    const relu = new Archives();
    relu.importer(a.exporter(), 5);
    expect(relu.tout).toHaveLength(1);
    expect(relu.effets.satisfaction).toBe(-10);
  });

  it("ignorent ce qu'une sauvegarde abimee contient", () => {
    const relu = new Archives();
    relu.importer(
      [
        { type: "chanson" as never, jour: 1 },
        { type: "famine", jour: "hier" as never },
        { type: "famine", jour: 2 },
      ],
      2,
    );
    expect(relu.tout).toHaveLength(1);
  });
});

describe("le recit, assemble et jamais genere", () => {
  it("rend la nuit de Marc telle que le design l'ecrit", () => {
    const lignes = raconter({
      type: "sacrifice",
      jour: 17,
      qui: "Marc",
      metier: "boulanger",
      lieu: "la porte",
      arme: "une epee",
      combien: 43,
      aussi: 7,
      faits: ["civil", "defenseurs"],
    });
    expect(lignes).toEqual([
      "Marc etait boulanger.",
      "Il n'avait jamais combattu.",
      "A la nuit 17, les defenseurs sont tombes.",
      "Marc a pris une epee.",
      "Il a tenu la porte pendant 43 secondes.",
      "7 habitants ont survecu.",
      "Marc est tombe le jour 17.",
    ]);
  });

  it("retire les lignes dont une variable manque au lieu d'ecrire du vide", () => {
    const lignes = raconter({ type: "sacrifice", jour: 17, qui: "Marc" });
    expect(lignes).toEqual(["Marc est tombe le jour 17."]);
    for (const ligne of lignes) {
      expect(ligne).not.toContain("{");
      expect(ligne).not.toContain("undefined");
    }
  });

  it("ne fait jamais prendre une epee a un pecheur qui n'en a pas pris", () => {
    // ⚠️ Vu sur une capture le 21 septembre 2026 : « Tancrede a pris une epee »
    // pour un pecheur tombe a son poste, qui n'avait rien pris du tout.
    const lignes = raconter({
      type: "sacrifice",
      jour: 2,
      qui: "Tancrede",
      metier: "pecheur",
      faits: ["civil"],
    });
    expect(lignes.join(" ")).not.toContain("epee");
    expect(lignes).toContain("Tancrede etait pecheur.");
    expect(lignes).toContain("Il n'avait jamais combattu.");
  });

  it("ne dit pas d'un milicien qu'il n'avait jamais combattu", () => {
    const lignes = raconter({
      type: "sacrifice",
      jour: 6,
      qui: "Gauvain",
      metier: "milicien",
      arme: "ce qu'il avait sous la main",
      faits: ["combattant"],
    });
    expect(lignes.join(" ")).not.toContain("jamais combattu");
    expect(lignes).toContain("Gauvain a pris ce qu'il avait sous la main.");
  });

  it("ne laisse jamais une accolade ni un undefined, quel que soit le type", () => {
    for (const type of Object.keys(EVENEMENTS) as (keyof typeof EVENEMENTS)[]) {
      for (const lignes of [
        raconter({ type, jour: 4 }),
        raconter({ type, jour: 4, qui: "Nine", lieu: "le pont", combien: 3, aussi: 9, metier: "mineur" }),
      ]) {
        for (const ligne of lignes) {
          expect(ligne, `${type} : ${ligne}`).not.toMatch(/\{|undefined/);
        }
      }
    }
  });

  it("titre avec le nom quand il y en a un", () => {
    expect(titreDe({ type: "sacrifice", jour: 1, qui: "Marc", faits: ["nuit"] })).toBe(
      "LA NUIT DE MARC",
    );
    // Tombe en plein jour : le titre ne promet pas une nuit qu'il n'a pas eue.
    expect(titreDe({ type: "sacrifice", jour: 1, qui: "Marc" })).toBe("LE JOUR DE MARC");
    expect(titreDe({ type: "massacre", jour: 1, lieu: "le pont" })).toBe("LE MASSACRE LE PONT");
    expect(titreDe({ type: "famine", jour: 1 })).toBe("LA FAMINE");
  });
});

describe("ce qu'une mort produit", () => {
  it("fait payer deux fois plus a un ami, et lui donne un trait", () => {
    const r = new Relations();
    r.poser("ami", "mort", "amitie", 80);
    const suites = suitesDeLaMort("mort", "Marc", ["ami"], ["ami"], r, 5, courageMoyen);
    expect(suites.endeuilles).toHaveLength(1);
    expect(suites.endeuilles[0]!.facteurStress).toBe(2);
    expect(suites.endeuilles[0]!.trait).toBe("endeuille");
  });

  it("endurcit le courageux la ou elle hante le peureux", () => {
    const r = new Relations();
    r.poser("brave", "mort", "amitie", 80);
    const suites = suitesDeLaMort("mort", "Marc", ["brave"], ["brave"], r, 5, () => 80);
    expect(suites.endeuilles[0]!.trait).toBe("aguerri");
  });

  it("ne change personne quand le mort n'etait rien pour lui", () => {
    const r = new Relations();
    const suites = suitesDeLaMort("mort", "Marc", ["passant"], ["passant"], r, 5, courageMoyen);
    expect(suites.endeuilles[0]).toMatchObject({ trait: null, facteurStress: 1 });
  });

  it("designe un heritier parmi les vivants, jamais le mort", () => {
    const r = new Relations();
    r.poser("mort", "frere", "famille", 50);
    const suites = suitesDeLaMort("mort", "Marc", [], ["frere", "mort"], r, 5, courageMoyen);
    expect(suites.heritier?.avec).toBe("frere");
  });

  it("n'inscrit rien aux archives quand personne ne le connaissait", () => {
    const r = new Relations();
    const suites = suitesDeLaMort("mort", "Marc", ["passant"], ["passant"], r, 5, courageMoyen);
    expect(suites.evenement).toBeNull();
  });

  it("inscrit une nuit quand il laisse quelqu'un derriere lui", () => {
    const r = new Relations();
    r.poser("mort", "ami", "amitie", 60);
    const suites = suitesDeLaMort("mort", "Marc", ["ami"], ["ami"], r, 17, courageMoyen);
    expect(suites.evenement).toMatchObject({ type: "sacrifice", jour: 17, qui: "Marc" });
  });
});
