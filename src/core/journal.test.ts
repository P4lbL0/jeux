import { describe, expect, it } from "vitest";
import { Journal, LIGNES_DU_JOURNAL } from "./journal";

describe("Journal — ce qu'il garde", () => {
  it("garde les lignes dans l'ordre, la plus recente en dernier", () => {
    const journal = new Journal();
    journal.ajouter("L'aube se leve");
    journal.ajouter("Une horde arrive par l'est");

    expect(journal.contenu.map((l) => l.texte)).toEqual([
      "L'aube se leve",
      "Une horde arrive par l'est",
    ]);
  });

  it("ne garde que les six dernieres et jette les plus vieilles", () => {
    const journal = new Journal();
    for (let i = 1; i <= 10; i += 1) journal.ajouter(`ligne ${i}`);

    expect(journal.contenu).toHaveLength(LIGNES_DU_JOURNAL);
    expect(journal.contenu[0]?.texte).toBe("ligne 5");
    expect(journal.contenu[5]?.texte).toBe("ligne 10");
  });

  it("respecte une capacite donnee a la construction", () => {
    const journal = new Journal(2);
    journal.ajouter("a");
    journal.ajouter("b");
    journal.ajouter("c");

    expect(journal.contenu.map((l) => l.texte)).toEqual(["b", "c"]);
  });
});

describe("Journal — les repetitions", () => {
  it("compte deux gestes identiques d'affilee au lieu d'empiler deux lignes", () => {
    const journal = new Journal();
    journal.ajouter("Impossible de poser ici");
    journal.ajouter("Impossible de poser ici");
    journal.ajouter("Impossible de poser ici");

    expect(journal.contenu).toHaveLength(1);
    expect(journal.contenu[0]?.repetitions).toBe(3);
  });

  it("un refus repete ne chasse pas ce qui comptait", () => {
    const journal = new Journal();
    journal.ajouter("Berthe est tombee malade");
    for (let i = 0; i < 20; i += 1) journal.ajouter("Impossible de poser ici");

    expect(journal.contenu.map((l) => l.texte)).toEqual([
      "Berthe est tombee malade",
      "Impossible de poser ici",
    ]);
  });

  it("ne fusionne que des lignes voisines, jamais a distance", () => {
    const journal = new Journal();
    journal.ajouter("Une tour cede");
    journal.ajouter("Un champ est ravage");
    journal.ajouter("Une tour cede");

    expect(journal.contenu).toHaveLength(3);
    expect(journal.contenu.every((l) => l.repetitions === 1)).toBe(true);
  });
});

describe("Journal — ce qu'il refuse et ce qu'il signale", () => {
  it("ignore une ligne vide ou faite d'espaces", () => {
    const journal = new Journal();
    journal.ajouter("");
    journal.ajouter("   ");

    expect(journal.contenu).toHaveLength(0);
  });

  it("ne change pas de version quand rien n'a ete ecrit", () => {
    const journal = new Journal();
    const avant = journal.version;
    journal.ajouter("  ");

    expect(journal.version).toBe(avant);
  });

  it("change de version a chaque ecriture, repetition comprise", () => {
    const journal = new Journal();
    const depart = journal.version;
    journal.ajouter("Une voile a l'horizon");
    const apresUne = journal.version;
    journal.ajouter("Une voile a l'horizon");

    expect(apresUne).not.toBe(depart);
    expect(journal.version).not.toBe(apresUne);
  });

  it("se vide entierement", () => {
    const journal = new Journal();
    journal.ajouter("a");
    journal.vider();

    expect(journal.contenu).toHaveLength(0);
  });
});
