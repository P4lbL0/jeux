import { describe, expect, it } from "vitest";
import { Rng } from "./rng";
import { ORDRE_CLASSES, ORDRE_RANGS } from "./classes";
import {
  bonusVierge,
  competenceParId,
  COMPETENCES,
  tirerCompetences,
  type CompetencesPossedees,
  EMPLACEMENTS_ACTIFS,
  ID_EMPLACEMENT,
  activesPossedees,
  demandeUnePlace,
  prixDuProchainEmplacement,
  propositionsDeRemplacement,
} from "./competences";

describe("Competences — coherence du contenu", () => {
  it("n'a pas deux fois le meme identifiant", () => {
    const ids = COMPETENCES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("declare un rang connu et au moins un palier", () => {
    for (const c of COMPETENCES) {
      expect(ORDRE_RANGS).toContain(c.rang);
      expect(c.paliers.length).toBeGreaterThan(0);
    }
  });

  /**
   * Une capacite sans effet ou sans rechargement n'apparaitrait jamais dans le
   * panneau, ou resterait bloquee. Ce test evite d'ajouter du contenu casse.
   */
  it("donne un effet, une icone et un rechargement a chaque capacite", () => {
    for (const c of COMPETENCES) {
      if (c.type === "passive") continue;
      expect(c.effet, `${c.id} sans effet`).toBeDefined();
      expect(c.icone, `${c.id} sans icone`).toBeDefined();
      for (const palier of c.paliers) {
        expect(palier.rechargement, `${c.id} : palier sans rechargement`).toBeGreaterThan(0);
      }
    }
  });

  it("ne propose une evolution qu'a un palier qui existe", () => {
    for (const c of COMPETENCES) {
      if (!c.evolutions) continue;
      expect(c.evolutions.auPalier).toBeGreaterThanOrEqual(1);
      expect(c.evolutions.auPalier).toBeLessThanOrEqual(c.paliers.length);
      expect(c.evolutions.options.length).toBeGreaterThanOrEqual(2);
      const ids = c.evolutions.options.map((o) => o.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("se retrouve par identifiant", () => {
    for (const c of COMPETENCES) expect(competenceParId(c.id)).toBe(c);
    expect(competenceParId("nexiste-pas")).toBeUndefined();
  });
});

describe("Competences — le tirage", () => {
  it("ne propose jamais une competence reservee a une autre classe", () => {
    const rng = new Rng(11);
    for (const classe of ORDRE_CLASSES) {
      for (let i = 0; i < 200; i++) {
        for (const c of tirerCompetences(rng, classe, {}, 3)) {
          if (c.classes) expect(c.classes).toContain(classe);
        }
      }
    }
  });

  it("ne propose jamais deux fois la meme competence dans un tirage", () => {
    const rng = new Rng(3);
    for (let i = 0; i < 200; i++) {
      const choix = tirerCompetences(rng, "mage", {}, 3);
      expect(new Set(choix.map((c) => c.id)).size).toBe(choix.length);
    }
  });

  it("cesse de proposer une competence arrivee a son dernier palier", () => {
    const rng = new Rng(5);
    const possedees: CompetencesPossedees = {};
    for (const c of COMPETENCES) possedees[c.id] = c.paliers.length;
    // Tout est au maximum : il ne reste rien a proposer.
    expect(tirerCompetences(rng, "guerrier", possedees, 3)).toHaveLength(0);
  });

  it("propose encore une competence qui a des paliers restants", () => {
    const rng = new Rng(7);
    const possedees: CompetencesPossedees = { "lame-affutee": 1 };
    let vue = false;
    for (let i = 0; i < 400 && !vue; i++) {
      vue = tirerCompetences(rng, "guerrier", possedees, 3).some((c) => c.id === "lame-affutee");
    }
    expect(vue).toBe(true);
  });

  /**
   * Ce que fera une montee de rang : rendre les rangs eleves plus probables
   * (DESIGN.md §4.1). Le test verrouille cette promesse.
   */
  it("la faveur augmente bien la part des rangs eleves", () => {
    const compter = (faveur: number): number => {
      const rng = new Rng(99);
      let rares = 0;
      for (let i = 0; i < 1500; i++) {
        for (const c of tirerCompetences(rng, "guerrier", {}, 1, faveur)) {
          if (["S", "SR", "SSR"].includes(c.rang)) rares += 1;
        }
      }
      return rares;
    };
    expect(compter(1.5)).toBeGreaterThan(compter(0));
  });
});

describe("Competences — les effets", () => {
  it("cumule les paliers d'une competence reprise", () => {
    const bonus = bonusVierge();
    const lame = competenceParId("lame-affutee");
    lame?.paliers[0]?.appliquer?.(bonus, 1);
    lame?.paliers[1]?.appliquer?.(bonus, 2);
    expect(bonus.degats).toBe(9);
  });

  it("applique l'Apotheose comme un multiplicateur global", () => {
    const bonus = bonusVierge();
    competenceParId("apotheose")?.paliers[0]?.appliquer?.(bonus, 1);
    expect(bonus.multiplicateurGlobal).toBe(2);
  });

  it("fait grandir le rayon de Provocation au lieu de l'additionner", () => {
    const bonus = bonusVierge();
    const provocation = competenceParId("provocation");
    provocation?.paliers[0]?.appliquer?.(bonus, 1);
    provocation?.paliers[1]?.appliquer?.(bonus, 2);
    expect(bonus.provocation).toBe(130);
  });
});

describe("Competences — les emplacements d'actives (§4.13)", () => {
  const actives = COMPETENCES.filter((c) => c.type === "active").slice(0, 5);
  const passive = COMPETENCES.find((c) => c.type === "passive")!;
  const quatre = Object.fromEntries(actives.slice(0, 4).map((c) => [c.id, 1]));

  it("compte les actives apprises, jamais les passives", () => {
    expect(activesPossedees({ ...quatre, [passive.id]: 2 }).map((c) => c.id)).toEqual(
      actives.slice(0, 4).map((c) => c.id),
    );
  });

  it("une cinquieme active demande une place ; une passive ou un palier de plus, jamais", () => {
    expect(demandeUnePlace(actives[4]!, quatre, EMPLACEMENTS_ACTIFS)).toBe(true);
    expect(demandeUnePlace(passive, quatre, EMPLACEMENTS_ACTIFS)).toBe(false);
    expect(demandeUnePlace(actives[0]!, quatre, EMPLACEMENTS_ACTIFS)).toBe(false);
    expect(demandeUnePlace(actives[4]!, quatre, EMPLACEMENTS_ACTIFS + 1)).toBe(false);
  });

  it("vend un cinquieme puis un sixieme emplacement, et s'arrete la", () => {
    expect(prixDuProchainEmplacement(4)).toBe(150);
    expect(prixDuProchainEmplacement(5)).toBe(400);
    expect(prixDuProchainEmplacement(6)).toBeNull();
  });

  it("propose d'oublier chacune des quatre, et d'acheter seulement quand on a de quoi", () => {
    const sans = propositionsDeRemplacement(quatre, EMPLACEMENTS_ACTIFS, 149);
    expect(sans.map((p) => p.id)).toEqual(actives.slice(0, 4).map((c) => c.id));
    const avec = propositionsDeRemplacement(quatre, EMPLACEMENTS_ACTIFS, 150);
    expect(avec.at(-1)?.id).toBe(ID_EMPLACEMENT);
    expect(propositionsDeRemplacement(quatre, 6, 10_000).some((p) => p.id === ID_EMPLACEMENT)).toBe(false);
  });
});
