import { describe, expect, it } from "vitest";
import {
  bulleDeLaRencontre,
  choisirOccupation,
  direLInitiative,
  fautAnnoncer,
  initiativeDe,
  INITIATIVES,
  NOMS_OCCUPATION,
  prochainTour,
  REGLAGES_VIE,
  type EtatAutonome,
  type SituationExtreme,
} from "./vieAutonome";
import { creerPersonne, gagnerTrait, type Personne } from "./personne";
import { Rng } from "./rng";

function quelquUn(nom = "Alix"): Personne {
  const p = creerPersonne(nom, new Rng(7));
  // On part d'une ardoise propre : les traits de naissance sont tires au sort,
  // et un test qui depend d'un tirage ne prouve rien.
  p.traits = [];
  p.stress = 0;
  p.rupture = null;
  return p;
}

function calme(personne: Personne, dessus: Partial<EtatAutonome> = {}): EtatAutonome {
  return {
    personne,
    rassasie: true,
    nuit: false,
    chantier: false,
    voisin: false,
    menace: false,
    ...dessus,
  };
}

const paisible: SituationExtreme = {
  egliseSansDefense: false,
  frontCede: false,
  mortsDeLaNuit: 0,
  nuit: false,
  stressCollectif: 0,
  stockPlein: false,
};

describe("la journee de celui qu'on laisse tranquille", () => {
  it("flane quand tout va bien", () => {
    expect(choisirOccupation(calme(quelquUn()))).toBe("flaner");
  });

  it("rentre des qu'un monstre est en vue : on ne flane pas sous les crocs", () => {
    expect(choisirOccupation(calme(quelquUn(), { menace: true }))).toBe("dormir");
    // Meme en discutant, meme en ayant faim : la menace passe devant tout.
    expect(
      choisirOccupation(calme(quelquUn(), { menace: true, voisin: true, rassasie: false })),
    ).toBe("dormir");
  });

  it("dort la nuit", () => {
    expect(choisirOccupation(calme(quelquUn(), { nuit: true }))).toBe("dormir");
  });

  it("mange avant tout le reste, une fois le danger passe", () => {
    expect(
      choisirOccupation(calme(quelquUn(), { rassasie: false, voisin: true })),
    ).toBe("manger");
  });

  it("s'arrete quand il croise quelqu'un", () => {
    expect(choisirOccupation(calme(quelquUn(), { voisin: true }))).toBe("discuter");
  });

  it("va boire quand le stress pese, et pas avant", () => {
    const personne = quelquUn();
    personne.stress = REGLAGES_VIE.stressQuiPese - 1;
    expect(choisirOccupation(calme(personne))).toBe("flaner");
    personne.stress = REGLAGES_VIE.stressQuiPese;
    expect(choisirOccupation(calme(personne))).toBe("boire");
  });

  it("repare quand il en a le gout et qu'il y a un chantier", () => {
    const personne = quelquUn();
    expect(choisirOccupation(calme(personne, { chantier: true }))).toBe("flaner");
    gagnerTrait(personne, "main-du-batisseur");
    expect(choisirOccupation(calme(personne, { chantier: true }))).toBe("reparer");
  });

  it("laisse celui qui a craque ailleurs : il ne discute ni ne repare", () => {
    const personne = quelquUn();
    personne.rupture = "abattement";
    expect(choisirOccupation(calme(personne, { voisin: true, chantier: true }))).toBe("flaner");
  });

  it("nomme chacune de ses occupations", () => {
    for (const cle of Object.keys(NOMS_OCCUPATION)) {
      expect(NOMS_OCCUPATION[cle as keyof typeof NOMS_OCCUPATION]).toBeTruthy();
    }
  });
});

describe("le tour de role", () => {
  it("ne reveille que quelques habitants par image", () => {
    const { index } = prochainTour(0, 30);
    expect(index).toHaveLength(REGLAGES_VIE.reveillesParImage);
  });

  it("fait le tour sans oublier personne", () => {
    const total = 7;
    const vus = new Set<number>();
    let curseur = 0;
    for (let image = 0; image < 10; image++) {
      const tour = prochainTour(curseur, total, 2);
      for (const i of tour.index) vus.add(i);
      curseur = tour.suivant;
    }
    expect(vus.size).toBe(total);
  });

  it("ne demande jamais plus d'index qu'il n'y a de gens", () => {
    expect(prochainTour(0, 2).index).toHaveLength(2);
    expect(prochainTour(0, 0).index).toHaveLength(0);
    expect(prochainTour(5, 0).suivant).toBe(0);
  });

  it("reste dans les bornes quel que soit le curseur", () => {
    const { index } = prochainTour(6, 7, 3);
    expect(index).toEqual([6, 0, 1]);
  });
});

describe("les bulles", () => {
  it("met un coeur sur un lien fort et positif", () => {
    expect(bulleDeLaRencontre(quelquUn(), 80, true)).toBe("coeur");
  });

  it("met une sueur quand le stress pese", () => {
    const personne = quelquUn();
    personne.stress = REGLAGES_VIE.stressQuiPese;
    expect(bulleDeLaRencontre(personne, 0, false)).toBe("sueur");
    // Un lien fort passe quand meme devant : c'est une lecture, pas une alarme.
    expect(bulleDeLaRencontre(personne, 80, true)).toBe("coeur");
  });

  it("met une chope le reste du temps", () => {
    expect(bulleDeLaRencontre(quelquUn(), 20, true)).toBe("chope");
    expect(bulleDeLaRencontre(quelquUn(), 90, false)).toBe("chope");
  });
});

describe("les initiatives", () => {
  it("ne se declenchent pas quand rien d'extreme n'arrive", () => {
    const personne = quelquUn();
    for (const def of Object.values(INITIATIVES)) gagnerTrait(personne, def.trait as never);
    expect(initiativeDe(personne, paisible)).toBeNull();
  });

  it("ne se declenchent pas sans le trait, meme dans le pire", () => {
    const pire: SituationExtreme = {
      egliseSansDefense: true,
      frontCede: true,
      mortsDeLaNuit: 5,
      nuit: true,
      stressCollectif: 200,
      stockPlein: true,
    };
    expect(initiativeDe(quelquUn(), pire)).toBeNull();
  });

  it("font sortir un Courageux quand l'eglise n'est pas defendue", () => {
    const personne = quelquUn();
    gagnerTrait(personne, "courageux");
    expect(initiativeDe(personne, { ...paisible, egliseSansDefense: true })).toBe("tenir-l-eglise");
  });

  it("font lacher son poste a un Peureux quand un front cede", () => {
    const personne = quelquUn();
    gagnerTrait(personne, "peureux");
    expect(initiativeDe(personne, { ...paisible, frontCede: true })).toBe("abandonner-le-poste");
  });

  it("font rassembler un veteran apres trois morts, pas deux", () => {
    const personne = quelquUn();
    gagnerTrait(personne, "veteran");
    expect(initiativeDe(personne, { ...paisible, mortsDeLaNuit: 2 })).toBeNull();
    expect(initiativeDe(personne, { ...paisible, mortsDeLaNuit: 3 })).toBe("rassembler-la-milice");
  });

  it("exigent du Pyromane qu'il ait craque, et qu'il fasse nuit", () => {
    const personne = quelquUn();
    gagnerTrait(personne, "pyromane");
    expect(initiativeDe(personne, { ...paisible, nuit: true })).toBeNull();
    personne.rupture = "rage";
    expect(initiativeDe(personne, { ...paisible, nuit: false })).toBeNull();
    expect(initiativeDe(personne, { ...paisible, nuit: true })).toBe("mettre-le-feu");
  });

  it("font parler une Legende locale quand le village va mal", () => {
    const personne = quelquUn();
    gagnerTrait(personne, "legende-locale");
    expect(initiativeDe(personne, { ...paisible, stressCollectif: 80 })).toBe("tenir-un-discours");
  });

  it("font se servir un Kleptomane quand le stock est plein", () => {
    const personne = quelquUn();
    gagnerTrait(personne, "kleptomane");
    expect(initiativeDe(personne, { ...paisible, stockPlein: true })).toBe("se-servir");
  });
});

describe("ce qu'on annonce, et ce qu'on tait", () => {
  it("annonce les graves, et tait le vol", () => {
    expect(fautAnnoncer("tenir-l-eglise", 0)).toBe(true);
    // Le village vit, il ne hurle pas : un kleptomane ne fait pas la une.
    expect(fautAnnoncer("se-servir", 0)).toBe(false);
  });

  it("s'arrete a trois par nuit", () => {
    const plafond = REGLAGES_VIE.initiativesAnnonceesParNuit;
    expect(fautAnnoncer("tenir-l-eglise", plafond - 1)).toBe(true);
    expect(fautAnnoncer("tenir-l-eglise", plafond)).toBe(false);
  });

  it("dit la phrase avec le vrai nom", () => {
    expect(direLInitiative("tenir-l-eglise", "Gaston")).toContain("Gaston");
    // Celle du vol ne nomme personne : on ne sait pas qui c'etait.
    expect(direLInitiative("se-servir", "Gaston")).not.toContain("Gaston");
  });
});
