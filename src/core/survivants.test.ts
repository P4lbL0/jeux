import { describe, expect, it } from "vitest";
import { Rng } from "./rng";
import { estTerreFerme, VILLAGE } from "./carte";
import { delaiEntreArrivees, reputation } from "./arrivants";
import {
  creerSurvivant,
  directionDepuis,
  ETAT_ANNONCE,
  ligneDApparition,
  prochainSurvivant,
  REGLAGES_SURVIVANTS,
  tirerLaMeute,
  type Situation,
} from "./survivants";

/** Mille survivants, pour juger une distribution et non une anecdote. */
function mille(): ReturnType<typeof creerSurvivant>[] {
  const rng = new Rng(20260811);
  return Array.from({ length: 1000 }, (_, i) => creerSurvivant(rng, i));
}

describe("Survivants — ou ils paraissent", () => {
  it("ne fait jamais paraitre quelqu'un dans l'eau ni dans la roche", () => {
    // Le littoral et la montagne ondulent : un point calcule sur le rectangle
    // praticable peut tomber a l'eau. C'est le genre de bug qui ne se voit
    // qu'en jouant, une fois sur cinquante.
    for (const survivant of mille()) {
      expect(estTerreFerme(survivant.point.x, survivant.point.y)).toBe(true);
    }
  });

  it("les fait paraitre sur les quatre bords, pas seulement les deux fronts", () => {
    // §4.18 : « n'importe quel bord praticable », donc la plage a l'ouest et
    // les eboulis au sud comptent. Sans ca, le sauvetage se confondrait avec la
    // defense, puisqu'on sortirait toujours la ou les monstres entrent.
    const vues = new Set(mille().map((s) => s.direction));
    expect(vues).toEqual(new Set(["nord", "sud", "est", "ouest"]));
  });

  it("ne donne que la direction, jamais la position", () => {
    const rng = new Rng(7);
    const survivant = creerSurvivant(rng, 3);
    const ligne = ligneDApparition(survivant);
    expect(ligne).toContain("Quelqu'un appelle");
    // Aucun chiffre dans la ligne : un nombre serait une coordonnee (§4.10).
    expect(ligne).not.toMatch(/[0-9]/);
  });

  it("lit la direction depuis le village", () => {
    expect(directionDepuis({ x: VILLAGE.x, y: VILLAGE.y - 500 })).toBe("nord");
    expect(directionDepuis({ x: VILLAGE.x, y: VILLAGE.y + 500 })).toBe("sud");
    expect(directionDepuis({ x: VILLAGE.x + 500, y: VILLAGE.y })).toBe("est");
    expect(directionDepuis({ x: VILLAGE.x - 500, y: VILLAGE.y })).toBe("ouest");
  });
});

describe("Survivants — dans quel etat on les trouve", () => {
  it("tire les trois situations, et aucune ne disparait", () => {
    const parts = new Map<Situation, number>();
    for (const s of mille()) parts.set(s.situation, (parts.get(s.situation) ?? 0) + 1);
    expect(parts.get("seul")).toBeGreaterThan(250);
    expect(parts.get("poursuivi")).toBeGreaterThan(200);
    expect(parts.get("blesse")).toBeGreaterThan(200);
  });

  it("ne donne un etat qu'aux blesses, et toujours un", () => {
    for (const s of mille()) {
      if (s.situation === "blesse") expect(s.etat).not.toBeNull();
      else expect(s.etat).toBeNull();
    }
  });

  it("tire les trois etats du §4.18, contagion comprise", () => {
    const vus = new Set(mille().filter((s) => s.etat !== null).map((s) => s.etat));
    expect(vus).toEqual(new Set(["hemorragie", "blessure", "infection"]));
  });

  it("ecrit chaque etat noir sur blanc — la folie se devine, la maladie se lit", () => {
    for (const cle of ["hemorragie", "blessure", "infection"] as const) {
      expect(ETAT_ANNONCE[cle].length).toBeGreaterThan(20);
    }
    // La contagion doit se dire : c'est le seul cas ou ce qu'on ramene met en
    // danger **les autres**, et le refus doit pouvoir se decider la-dessus.
    expect(ETAT_ANNONCE.infection).toMatch(/transmet/);
  });
});

describe("Survivants — la meute, tiree au visu", () => {
  it("ne tire rien tant que le joueur n'a pas vu", () => {
    const survivant = creerSurvivant(new Rng(1), 1);
    expect(survivant.meute).toBeNull();
  });

  it("tient dans les bornes du §4.17, plafond dur a 40", () => {
    const rng = new Rng(99);
    for (let i = 0; i < 500; i++) {
      const survivant = creerSurvivant(rng, i);
      survivant.situation = "poursuivi";
      const meute = tirerLaMeute(survivant, rng);
      expect(meute).toBeGreaterThanOrEqual(REGLAGES_SURVIVANTS.meute.min);
      expect(meute).toBeLessThanOrEqual(REGLAGES_SURVIVANTS.meute.max);
    }
  });

  it("rend environ un sauvetage sur deux infaisable — c'est le tirage plat", () => {
    const rng = new Rng(4242);
    let lourdes = 0;
    const essais = 2000;
    for (let i = 0; i < essais; i++) {
      const survivant = creerSurvivant(rng, i);
      survivant.situation = "poursuivi";
      if (tirerLaMeute(survivant, rng) > 20) lourdes++;
    }
    // Tirage plat sur 2..40 : la moitie passe au-dessus de 21. C'est le
    // « hardcore assume » du §4.18, et il doit rester mesurable.
    expect(lourdes / essais).toBeGreaterThan(0.4);
    expect(lourdes / essais).toBeLessThan(0.6);
  });

  it("ne retire jamais deux fois : la meute d'un survivant est fixee une fois", () => {
    const rng = new Rng(11);
    const survivant = creerSurvivant(rng, 1);
    survivant.situation = "poursuivi";
    const premier = tirerLaMeute(survivant, rng);
    expect(tirerLaMeute(survivant, rng)).toBe(premier);
  });

  it("n'envoie personne apres un survivant seul ou blesse", () => {
    const rng = new Rng(12);
    for (const situation of ["seul", "blesse"] as const) {
      const survivant = creerSurvivant(rng, 1);
      survivant.situation = situation;
      expect(tirerLaMeute(survivant, rng)).toBe(0);
    }
  });
});

describe("Survivants — le rythme, et le plancher que la porte n'a pas", () => {
  it("continue d'en envoyer quand la porte s'est fermee pour de bon", () => {
    // C'est tout l'interet du plancher : sous 25 de reputation la porte rend
    // `null`, les naissances n'existent pas avant le bloc 7, et le village
    // n'aurait plus **aucune** voie de peuplement (§4.18, §4.24).
    const morte = delaiEntreArrivees(10);
    expect(morte).toBeNull();

    const rng = new Rng(5);
    for (let i = 0; i < 200; i++) {
      const journee = prochainSurvivant(morte, 10, rng);
      expect(journee).toBeGreaterThan(10);
      expect(journee - 10).toBeLessThanOrEqual(
        Math.round(REGLAGES_SURVIVANTS.delaiPlancher * 1.2),
      );
    }
  });

  it("suit la reputation quand elle est meilleure que le plancher", () => {
    const rng = new Rng(6);
    const bonne = delaiEntreArrivees(90);
    expect(bonne).not.toBeNull();
    let total = 0;
    const essais = 400;
    for (let i = 0; i < essais; i++) total += prochainSurvivant(bonne, 0, rng);
    // A 90 de reputation la porte donne un delai d'une journee : les survivants
    // ne doivent pas etre plus lents qu'elle, seulement jamais plus lents que
    // le plancher.
    expect(total / essais).toBeLessThan(REGLAGES_SURVIVANTS.delaiPlancher);
  });

  it("ne rend jamais la journee courante — un appel se voit le lendemain au plus tot", () => {
    const rng = new Rng(8);
    for (let i = 0; i < 200; i++) {
      expect(prochainSurvivant(0.1, 4, rng)).toBeGreaterThan(4);
    }
  });
});

describe("Survivants — ce qu'ils sont a l'arrivee", () => {
  it("porte un vrai arrivant : meme fiche, memes indices, memes questions", () => {
    const survivant = creerSurvivant(new Rng(3), 2);
    expect(survivant.arrivant.observations).toHaveLength(3);
    expect(survivant.arrivant.questions).toHaveLength(4);
    expect(survivant.arrivant.personne.nom.length).toBeGreaterThan(0);
  });

  it("peut etre fou dans la meme proportion qu'a la porte", () => {
    const fous = mille().filter((s) => s.arrivant.folie > 0).length;
    // Deux ou trois sur dix (§4.18). Sans ca, ramener quelqu'un serait une
    // ressource gratuite qu'on ramasse, et les fous n'auraient qu'une porte.
    expect(fous / 1000).toBeGreaterThan(0.15);
    expect(fous / 1000).toBeLessThan(0.35);
  });

  it("ne reprend pas un prenom deja porte au village", () => {
    const rng = new Rng(77);
    const pris = ["Aubin", "Nine", "Gaspard"];
    for (let i = 0; i < 300; i++) {
      expect(pris).not.toContain(creerSurvivant(rng, i, pris).arrivant.personne.nom);
    }
  });
});

describe("Survivants — la rumeur", () => {
  it("fait payer une mort en chemin moins cher qu'un habitant tue", () => {
    const satisfaction = 70;
    const intacte = reputation(satisfaction, [], 10);
    const unMort = reputation(satisfaction, [10], 10);
    // La moitie du tarif, et surtout : pas zero. A zero, echouer ne couterait
    // que du temps ; a plein tarif on ne sortirait plus jamais (§4.18).
    const demi = intacte - (intacte - unMort) * REGLAGES_SURVIVANTS.partDeRumeurDUneMortEnChemin;
    expect(demi).toBeLessThan(intacte);
    expect(demi).toBeGreaterThan(unMort);
  });
});
