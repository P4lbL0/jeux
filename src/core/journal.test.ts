import { describe, expect, it } from "vitest";
import { JOURS_GARDES, Journal, LIGNES_FERMEE, lireLigne } from "./journal";

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

  it("garde tout l'historique de la journee, bien au-dela des trois lignes visibles", () => {
    const journal = new Journal();
    for (let i = 1; i <= 40; i += 1) journal.ajouter(`ligne ${i}`);

    expect(journal.contenu).toHaveLength(40);
    expect(journal.dernieres).toHaveLength(LIGNES_FERMEE);
    expect(journal.dernieres.map((l) => l.texte)).toEqual(["ligne 38", "ligne 39", "ligne 40"]);
  });

  it("jette les jours trop vieux, et par journee entiere", () => {
    const journal = new Journal();
    for (let jour = 1; jour <= 9; jour += 1) {
      journal.ajouter(`matin du jour ${jour}`, "guet", jour);
      journal.ajouter(`soir du jour ${jour}`, "guet", jour);
    }

    // Au jour 9, on garde les jours 3 a 9 : sept jours, jamais un jour ampute.
    expect(journal.jours).toEqual([3, 4, 5, 6, 7, 8, 9]);
    expect(journal.contenu).toHaveLength(JOURS_GARDES * 2);
    expect(journal.contenu[0]?.texte).toBe("matin du jour 3");
  });

  it("ne jette rien tant qu'on n'a pas depasse la fenetre", () => {
    const journal = new Journal();
    for (let jour = 1; jour <= JOURS_GARDES; jour += 1) {
      journal.ajouter(`jour ${jour}`, "guet", jour);
    }

    expect(journal.contenu).toHaveLength(JOURS_GARDES);
  });
});

describe("Journal — les voix", () => {
  it("retient la voix de chaque ligne, et le village par defaut", () => {
    const journal = new Journal();
    journal.ajouter("Une voile a l'horizon", "port");
    journal.ajouter("Berthe a faim");

    expect(journal.contenu[0]?.voix).toBe("port");
    expect(journal.contenu[1]?.voix).toBe("village");
  });

  it("ne fusionne jamais deux voix differentes, meme a texte egal", () => {
    const journal = new Journal();
    journal.ajouter("il ne reste rien", "village");
    journal.ajouter("il ne reste rien", "port");

    expect(journal.contenu).toHaveLength(2);
  });

  it("fait parler un heros par son nom", () => {
    const journal = new Journal();
    journal.ajouter("quelqu'un appelle, au nord", "heros", 3, "Aubin");

    expect(lireLigne(journal.contenu[0]!)).toBe("Aubin : quelqu'un appelle, au nord");
  });

  it("ne prefixe pas les autres voix", () => {
    const journal = new Journal();
    journal.ajouter("Le chantier est fini", "eglise");

    expect(lireLigne(journal.contenu[0]!)).toBe("Le chantier est fini");
  });
});

describe("Journal — les repetitions", () => {
  it("compte deux gestes identiques d'affilee au lieu d'empiler deux lignes", () => {
    const journal = new Journal();
    journal.ajouter("Impossible de poser ici", "toi");
    journal.ajouter("Impossible de poser ici", "toi");
    journal.ajouter("Impossible de poser ici", "toi");

    expect(journal.contenu).toHaveLength(1);
    expect(journal.contenu[0]?.repetitions).toBe(3);
  });

  it("replie en « et 2 autres », jamais en « x3 »", () => {
    const journal = new Journal();
    journal.ajouter("Impossible de poser ici", "toi");
    journal.ajouter("Impossible de poser ici", "toi");
    journal.ajouter("Impossible de poser ici", "toi");

    expect(lireLigne(journal.contenu[0]!)).toBe("Impossible de poser ici  — et 2 autres");
  });

  it("accorde le singulier quand il n'y en a qu'une de plus", () => {
    const journal = new Journal();
    journal.ajouter("Aucune tour libre a portee", "toi");
    journal.ajouter("Aucune tour libre a portee", "toi");

    expect(lireLigne(journal.contenu[0]!)).toBe("Aucune tour libre a portee  — et 1 autre");
  });

  it("n'ecrit rien du tout quand la ligne n'a ete dite qu'une fois", () => {
    const journal = new Journal();
    journal.ajouter("Le grenier est vide");

    expect(lireLigne(journal.contenu[0]!)).toBe("Le grenier est vide");
  });

  it("un refus repete ne chasse pas ce qui comptait", () => {
    const journal = new Journal();
    journal.ajouter("Berthe est tombee malade");
    for (let i = 0; i < 20; i += 1) journal.ajouter("Impossible de poser ici", "toi");

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

  it("une repetition suit le jour ou elle a ete redite", () => {
    const journal = new Journal();
    journal.ajouter("Le grenier est vide", "village", 2);
    journal.ajouter("Le grenier est vide", "village", 3);

    expect(journal.contenu[0]?.jour).toBe(3);
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
    journal.ajouter("Une voile a l'horizon", "port");
    const apresUne = journal.version;
    journal.ajouter("Une voile a l'horizon", "port");

    expect(apresUne).not.toBe(depart);
    expect(journal.version).not.toBe(apresUne);
  });

  it("se vide entierement", () => {
    const journal = new Journal();
    journal.ajouter("a");
    journal.vider();

    expect(journal.contenu).toHaveLength(0);
    expect(journal.jours).toHaveLength(0);
  });
});
