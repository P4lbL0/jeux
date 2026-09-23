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
  estDisponible,
  horsDeSaClasse,
  PART_HORS_DE_SA_CLASSE,
  toucheDeLActive,
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
  it("ne propose jamais a une autre classe une competence fermee", () => {
    // Les morts-vivants du necromancien, la volee du rodeur (§4.13, 23 septembre 2026).
    const rng = new Rng(11);
    for (const classe of ORDRE_CLASSES) {
      for (let i = 0; i < 200; i++) {
        for (const c of tirerCompetences(rng, classe, {}, 3)) {
          if (c.fermee) expect(c.classes).toContain(classe);
        }
      }
    }
  });

  it("ouvre les competences de classe aux autres classes, sauf les six fermees", () => {
    const fermees = COMPETENCES.filter((c) => c.fermee).map((c) => c.id).sort();
    expect(fermees).toEqual(
      ["appel-des-morts", "armee-des-ombres", "carquois-sans-fin", "charnier", "lien-necrotique", "seigneur-des-tombes"],
    );
    // Un guerrier peut tirer le Sablier du mage — pas l'Armee des ombres.
    expect(estDisponible(def("sablier"), "guerrier", {})).toBe(true);
    expect(estDisponible(def("armee-des-ombres"), "guerrier", {})).toBe(false);
    expect(estDisponible(def("armee-des-ombres"), "necromancien", {})).toBe(true);
  });

  it("montre une competence d'une autre classe cinq fois moins souvent", () => {
    expect(horsDeSaClasse(def("sablier"), "guerrier")).toBe(true);
    expect(horsDeSaClasse(def("sablier"), "mage")).toBe(false);
    expect(penchantPour(def("sablier"), "guerrier")).toBeCloseTo(PART_HORS_DE_SA_CLASSE);
    expect(penchantPour(def("sablier"), "mage")).toBe(1);
    // Et ca se voit sur des milliers de tirages : le mage la croise bien plus.
    const vues = (classe: "mage" | "guerrier") => {
      const rng = new Rng(404);
      let n = 0;
      for (let i = 0; i < 3000; i++) {
        if (tirerCompetences(rng, classe, {}, 3).some((c) => c.id === "sablier")) n++;
      }
      return n;
    };
    const chezLui = vues("mage");
    const ailleurs = vues("guerrier");
    expect(ailleurs).toBeGreaterThan(0);
    expect(chezLui / ailleurs).toBeGreaterThan(3);
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

  it("tague toutes les competences sauf trois qui ne sont ni un element, ni une forme, ni un role", () => {
    // Le Veteran (un niveau), l'Erudition (de l'experience) et la Cupidite (de l'or).
    const sansTag = COMPETENCES.filter((c) => c.tags === 0).map((c) => c.id).sort();
    expect(sansTag).toEqual(["cupidite", "erudition", "veteran"]);
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

describe("Les statistiques (§4.13, 23 septembre 2026)", () => {
  /** Tous les paliers d'une competence, appliques d'un coup a des bonus neufs. */
  function auMaximum(id: string) {
    const bonus = bonusVierge();
    def(id).paliers.forEach((p, i) => p.appliquer?.(bonus, i + 1));
    return bonus;
  }

  it("ajoute seulement celles qui manquaient, rangs F et E, ouvertes a toutes", () => {
    const neuves = ["celerite", "concentration", "expansion", "regeneration", "persistance",
      "proliferation", "penetration", "erudition", "cupidite"];
    for (const id of neuves) {
      const c = def(id);
      expect(["F", "E"]).toContain(c.rang);
      expect(c.type).toBe("passive");
      expect(c.classes).toBeUndefined();
    }
    // Les doublons ne sont pas entres : Amplification est la Lame affutee.
    for (const doublon of ["amplification", "hate", "vigueur", "portee", "precision", "reserve"]) {
      expect(competenceParId(doublon)).toBeUndefined();
    }
  });

  it("donne a chacune ce qu'elle promet", () => {
    expect(auMaximum("celerite").rechargementCapacites).toBeCloseTo(0.92 ** 3);
    expect(auMaximum("concentration").dureeEffets).toBeCloseTo(1.35);
    expect(auMaximum("expansion").tailleZones).toBeCloseTo(1.35);
    expect(auMaximum("regeneration").regeneration).toBeCloseTo(0.01);
    expect(auMaximum("persistance").dureeInvocations).toBeCloseTo(1.35);
    expect(auMaximum("proliferation").projectiles).toBe(2);
    expect(auMaximum("erudition").xp).toBeCloseTo(1.35);
    expect(auMaximum("cupidite").or).toBeCloseTo(1.35);
  });

  it("fait de la Penetration une brique de tout ce qui traverse, projectiles et frappes", () => {
    const bonus = auMaximum("penetration");
    expect(penetrationDe(PENETRATION.projectile, bonus, true)).toBe(4);
    expect(penetrationDe(PENETRATION.ombre, bonus, false)).toBe(PENETRATION.ombre + 3);
  });

  it("part de bonus neutres : sans la carte, rien ne change", () => {
    const b = bonusVierge();
    expect([b.dureeEffets, b.tailleZones, b.dureeInvocations, b.xp, b.or]).toEqual([1, 1, 1, 1, 1]);
    expect([b.regeneration, b.projectiles, b.penetration]).toEqual([0, 0, 0]);
  });
});

describe("Les six bases elementaires (§4.13, 23 septembre 2026)", () => {
  const BASES_ELEMENTAIRES = ["boule-de-feu", "vent", "eau", "nature", "bouclier", "teleportation"];

  it("les ecrit aux rangs et avec les tags du design, ouvertes a toutes les classes", () => {
    const attendus: Record<string, [string, number]> = {
      "boule-de-feu": ["F", TAGS.FEU | TAGS.PROJECTILE | TAGS.ZONE],
      vent: ["E", TAGS.VENT | TAGS.ZONE],
      eau: ["E", TAGS.EAU | TAGS.ZONE | TAGS.SOL],
      nature: ["D", TAGS.NATURE | TAGS.ZONE | TAGS.ENTRAVE],
      bouclier: ["D", TAGS.BOUCLIER | TAGS.DEFENSE],
      teleportation: ["C", TAGS.MOBILITE | TAGS.OMBRE],
    };
    for (const id of BASES_ELEMENTAIRES) {
      const c = def(id);
      const [rang, tags] = attendus[id]!;
      expect(c.rang, id).toBe(rang);
      expect(c.tags & tags, id).toBe(tags);
      expect(c.classes, id).toBeUndefined();
    }
    // L'exemple du §4.25, repris tel quel.
    expect(def("boule-de-feu").tags & (TAGS.MAGIE | TAGS.EXPLOSION)).toBe(TAGS.MAGIE | TAGS.EXPLOSION);
  });

  it("fait partir toutes seules les quatre qui frappent ; le bouclier est permanent, le saut sur une touche", () => {
    // Tranche par Angelos : un ingredient ne prend ni touche, ni emplacement.
    for (const id of ["boule-de-feu", "vent", "eau", "nature"]) {
      expect(def(id).type, id).toBe("auto");
      expect(def(id).effet, id).toBe(id);
    }
    expect(def("bouclier").type).toBe("passive");
    expect(def("teleportation").type).toBe("active");
    // Une automatique ne demande jamais de place, meme quand les quatre sont prises.
    const quatre = { moulinet: 1, charge: 1, "cri-de-guerre": 1, sablier: 1 };
    for (const id of ["boule-de-feu", "vent", "eau", "nature"]) {
      expect(demandeUnePlace(def(id), quatre, EMPLACEMENTS_ACTIFS), id).toBe(false);
    }
    expect(demandeUnePlace(def("teleportation"), quatre, EMPLACEMENTS_ACTIFS)).toBe(true);
  });

  it("porte enfin l'EAU, le VENT et la NATURE — le POISON attend le Nuage toxique", () => {
    const portes = COMPETENCES.reduce((m, c) => m | c.tags, 0);
    expect(portes & TAGS.EAU).toBe(TAGS.EAU);
    expect(portes & TAGS.VENT).toBe(TAGS.VENT);
    expect(portes & TAGS.NATURE).toBe(TAGS.NATURE);
    expect(portes & TAGS.POISON).toBe(0);
  });

  it("donne au Bouclier 20, 30 puis 40 % de la vie max, et un retour de plus en plus court", () => {
    const bonus = bonusVierge();
    expect([bonus.bouclier, bonus.bouclierRetour]).toEqual([0, 0]);
    const paliers = def("bouclier").paliers;
    const vus: [number, number][] = [];
    paliers.forEach((p, i) => {
      p.appliquer?.(bonus, i + 1);
      vus.push([Math.round(bonus.bouclier * 100), bonus.bouclierRetour]);
    });
    expect(vus).toEqual([
      [20, 10000],
      [30, 8000],
      [40, 6000],
    ]);
  });

  it("fait voir les quatre elements au Mage trois fois plus, pas la Teleportation", () => {
    for (const id of ["boule-de-feu", "vent", "eau", "nature"]) {
      expect(penchantPour(def(id), "mage"), id).toBe(3);
      expect(penchantPour(def(id), "guerrier"), id).toBe(1);
    }
    expect(penchantPour(def("boule-de-feu"), "mage", ["pyromane"])).toBe(9);
    // La Teleportation est de l'OMBRE : l'assassin la voit deux fois plus.
    expect(penchantPour(def("teleportation"), "assassin")).toBe(2);
    expect(penchantPour(def("bouclier"), "chevalier")).toBe(2);
  });
});

describe("Les emplacements de Touche-a-tout (§4.23, 23 septembre 2026)", () => {
  it("ecrit les touches des actives de 2 a 9, puis 0", () => {
    expect(toucheDeLActive(2)).toBe("2");
    expect(toucheDeLActive(9)).toBe("9");
    expect(toucheDeLActive(10)).toBe("0");
  });

  it("vend l'emplacement au prix de l'achat, et annonce sa vraie touche", () => {
    const quatre = { moulinet: 1, charge: 1, "cri-de-guerre": 1, sablier: 1 };
    // Sans trait : le cinquieme, touche 6, a 150 pieces.
    const sans = propositionsDeRemplacement(quatre, EMPLACEMENTS_ACTIFS, 1000).at(-1)!;
    expect(sans.id).toBe(ID_EMPLACEMENT);
    expect(sans.description).toContain("150 pieces");
    expect(sans.description).toContain("touche 6");
    // Avec Touche-a-tout III : trois places gratuites de plus, la premiere
    // achetee coute toujours 150 et tombe sur la touche 9.
    const avec = propositionsDeRemplacement(quatre, EMPLACEMENTS_ACTIFS, 1000, 3).at(-1)!;
    expect(avec.description).toContain("150 pieces");
    expect(avec.description).toContain("touche 9");
    // La derniere possible, la neuvieme active, est sur le 0.
    const derniere = propositionsDeRemplacement(quatre, EMPLACEMENTS_ACTIFS + 1, 1000, 3).at(-1)!;
    expect(derniere.description).toContain("400 pieces");
    expect(derniere.description).toContain("touche 0");
  });

  it("demande une place au-dela de tous les emplacements, trait compris", () => {
    const sept = { moulinet: 1, charge: 1, "cri-de-guerre": 1, sablier: 1, clignement: 1, dome: 1, exil: 1 };
    expect(demandeUnePlace(def("jugement"), sept, 7)).toBe(true);
    expect(demandeUnePlace(def("jugement"), sept, 8)).toBe(false);
  });
});
