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
  nomsDesTags,
  penchantPour,
  PENETRATION,
  penetrationDe,
  propositionCompetence,
  propositionEvolution,
  TAGS,
  tagsDuBuild,
  texteDesTags,
  type CompetenceDef,
  type EvolutionDef,
} from "./competences";

/** Une competence du catalogue, ou le test echoue tout de suite. */
function def(id: string): CompetenceDef {
  const c = competenceParId(id);
  if (!c) throw new Error(`competence inconnue : ${id}`);
  return c;
}

/** Une evolution du catalogue, retrouvee par son identifiant. */
function evolution(competence: string, id: string): EvolutionDef {
  const e = def(competence).evolutions?.options.find((o) => o.id === id);
  if (!e) throw new Error(`evolution inconnue : ${id}`);
  return e;
}

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

describe("Les tags (§4.25) — le socle des builds", () => {
  const TOUS = Object.values(TAGS).reduce((a, b) => a | b, 0);

  it("donne a chaque tag un bit a lui, et tous tiennent dans un entier signe", () => {
    const valeurs = Object.values(TAGS);
    expect(new Set(valeurs).size).toBe(valeurs.length);
    for (const v of valeurs) {
      // Une puissance de deux, sous le bit de signe : `&` et `|` restent sages.
      expect(v & (v - 1)).toBe(0);
      expect(v).toBeGreaterThan(0);
      expect(v).toBeLessThan(2 ** 31);
    }
  });

  it("ne pose sur les competences et les evolutions que des tags connus", () => {
    for (const c of COMPETENCES) {
      expect(c.tags & ~TOUS).toBe(0);
      for (const e of c.evolutions?.options ?? []) expect((e.tags ?? 0) & ~TOUS).toBe(0);
    }
  });

  it("tague toutes les competences sauf le Veteran, qui n'est qu'un niveau", () => {
    const sansTag = COMPETENCES.filter((c) => c.tags === 0).map((c) => c.id);
    expect(sansTag).toEqual(["veteran"]);
  });

  it("reprend les exemples du design", () => {
    const moulinet = TAGS.LAME | TAGS.ZONE | TAGS.MELEE;
    expect(def("moulinet").tags & moulinet).toBe(moulinet);
    const chaine = TAGS.FOUDRE | TAGS.CHAINE | TAGS.MAGIE;
    expect(def("chaine-eclairs").tags & chaine).toBe(chaine);
    // Les satellites de feu sont du FEU, ceux de givre de la GLACE : l'evolution
    // ajoute son element a la competence.
    expect(evolution("satellite", "satellite-feu").tags).toBe(TAGS.FEU);
    expect(evolution("satellite", "satellite-glace").tags).toBe(TAGS.GLACE);
  });

  it("lit un masque dans l'ordre des bits, et l'ecrit comme une carte l'affiche", () => {
    expect(nomsDesTags(TAGS.ZONE | TAGS.FEU)).toEqual(["FEU", "ZONE"]);
    expect(texteDesTags(TAGS.FEU | TAGS.ZONE)).toBe("FEU  ·  ZONE");
    expect(texteDesTags(0)).toBe("");
  });

  it("agrege les tags d'un build, evolutions comprises", () => {
    expect(tagsDuBuild({}, {})).toBe(0);
    const build = { moulinet: 3, "aura-de-flammes": 1 };
    expect(tagsDuBuild(build, {})).toBe(def("moulinet").tags | def("aura-de-flammes").tags);
    // Lames rouges : le moulinet devient aussi du SANG.
    const avecEvolution = tagsDuBuild(build, { moulinet: evolution("moulinet", "moulinet-sanglant") });
    expect(avecEvolution & TAGS.SANG).toBe(TAGS.SANG);
    // « Ce build contient-il FEU et LAME ? » : un `&` sur un entier.
    const feuEtLame = TAGS.FEU | TAGS.LAME;
    expect(avecEvolution & feuEtLame).toBe(feuEtLame);
  });

  it("met les tags sur les cartes de choix, evolution comprise", () => {
    expect(propositionCompetence(def("aura-de-flammes"), {}).tags).toBe("FEU  ·  ZONE");
    const feu = propositionEvolution(def("satellite"), evolution("satellite", "satellite-feu"));
    expect(feu.tags).toBe("FEU  ·  MAGIE");
    expect(propositionsDeRemplacement({ moulinet: 1 }, EMPLACEMENTS_ACTIFS, 0)[0]?.tags).toBe(
      texteDesTags(def("moulinet").tags),
    );
  });
});

describe("La pioche ponderee (§4.25) — la classe et les traits", () => {
  it("fait peser le FEU trois fois plus lourd pour un Pyromane", () => {
    expect(penchantPour(def("aura-de-flammes"), "guerrier")).toBe(1);
    expect(penchantPour(def("aura-de-flammes"), "guerrier", ["pyromane"])).toBe(3);
    // Un trait qui ne parle pas au FEU ne change rien.
    expect(penchantPour(def("aura-de-flammes"), "guerrier", ["peureux"])).toBe(1);
  });

  it("fait voir au Mage les elements plus souvent, et multiplie avec les traits", () => {
    expect(penchantPour(def("aura-de-flammes"), "mage")).toBe(3);
    expect(penchantPour(def("aura-de-flammes"), "mage", ["pyromane"])).toBe(9);
  });

  it("ne pondere par la classe que ce qui est ouvert a toutes", () => {
    // La Rage est deja au guerrier seul : la classe n'y ajoute rien, un trait si.
    expect(penchantPour(def("rage"), "guerrier")).toBe(1);
    expect(penchantPour(def("rage"), "guerrier", ["colerique"])).toBe(2);
    // La Lame affutee est ouverte : le guerrier la voit deux fois plus.
    expect(penchantPour(def("lame-affutee"), "guerrier")).toBe(2);
  });

  it("n'empile pas deux traits qui disent la meme chose", () => {
    // Colerique et Boucher parlent tous deux de RAGE et de LAME : x2, pas x4.
    expect(penchantPour(def("lame-affutee"), "guerrier", ["colerique", "boucher"])).toBe(4);
    expect(penchantPour(def("rage"), "guerrier", ["colerique", "boucher"])).toBe(2);
  });

  it("montre vraiment plus souvent le FEU a un Pyromane, sur des milliers de tirages", () => {
    const compter = (traits: ("pyromane")[]): number => {
      const rng = new Rng(2026);
      let vues = 0;
      for (let i = 0; i < 4000; i++) {
        if (tirerCompetences(rng, "guerrier", {}, 3, 0, traits).some((c) => c.id === "aura-de-flammes")) vues++;
      }
      return vues;
    };
    const sans = compter([]);
    const avec = compter(["pyromane"]);
    // Trois fois le poids ; un peu moins de trois fois les apparitions, parce
    // qu'une carte tiree n'est pas remise dans le paquet.
    expect(avec / sans).toBeGreaterThan(2.2);
    expect(avec / sans).toBeLessThan(3.5);
  });
});

describe("La penetration (§4.25) — combien de monstres une attaque traverse", () => {
  it("arrete un tir au premier monstre, sauf ce que le build y ajoute", () => {
    const bonus = bonusVierge();
    expect(penetrationDe(PENETRATION.projectile, bonus, true)).toBe(1);
    def("ricochet").paliers[0]?.appliquer?.(bonus, 1);
    expect(penetrationDe(PENETRATION.projectile, bonus, true)).toBe(4);
    def("fleche-perforante").paliers[0]?.appliquer?.(bonus, 1);
    expect(penetrationDe(PENETRATION.projectile, bonus, true)).toBe(7);
  });

  it("ne donne aux frappes en ligne que la penetration commune, pas celle des projectiles", () => {
    const bonus = bonusVierge();
    def("ricochet").paliers[0]?.appliquer?.(bonus, 1);
    expect(penetrationDe(PENETRATION.charge(1), bonus, false)).toBe(PENETRATION.charge(1));
    bonus.penetration += 2;
    expect(penetrationDe(PENETRATION.charge(1), bonus, false)).toBe(PENETRATION.charge(1) + 2);
    expect(penetrationDe(PENETRATION.projectile, bonus, true)).toBe(1 + 2 + 3);
  });

  it("borne chaque frappe en ligne, et la fait grandir avec ses paliers", () => {
    expect(PENETRATION.charge(2)).toBeGreaterThan(PENETRATION.charge(1));
    expect(PENETRATION.flecheDuJugement(2)).toBeGreaterThan(PENETRATION.flecheDuJugement(1));
    expect(PENETRATION.ombre).toBeGreaterThan(1);
  });
});
