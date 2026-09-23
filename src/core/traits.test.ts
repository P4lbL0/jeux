import { describe, expect, it } from "vitest";
import {
  SEQUELLES,
  TRAITS,
  TRAITS_DE_NAISSANCE,
  agreger,
  idSequelle,
  idTrait,
  modificateursVierges,
  sequelleParId,
  traitParId,
} from "./traits";

describe("La table des traits", () => {
  it("porte les 20 traits de naissance et les 11 d'exploit du §4.23", () => {
    // 15 au depart, plus les deux qui regardent qui est en face — reveilles le
    // 20 septembre 2026 quand un village refuse a pu se jeter sur nous (§4.29) —,
    // plus les trois degres de Touche-a-tout (23 septembre 2026).
    expect(TRAITS_DE_NAISSANCE).toHaveLength(20);
    expect(TRAITS.filter((t) => t.origine === "exploit")).toHaveLength(11);
  });

  it("donne aux deux traits qui regardent qui est en face des effets inverses", () => {
    const doux = traitParId(idTrait("misericordieux"))!;
    const dur = traitParId(idTrait("bourreau-d-hommes"))!;
    expect(doux.effets.degatsContreHumain).toBeLessThan(1);
    expect(dur.effets.degatsContreHumain).toBeGreaterThan(1);
    // Le Bourreau paie son avantage contre les betes ; le Misericordieux, lui,
    // ne perd rien contre elles — c'est sa seule compensation.
    expect(dur.effets.degats).toBeLessThan(1);
    expect(doux.effets.degats).toBeUndefined();
  });

  it("agrege les degats contre un humain comme un multiplicateur", () => {
    const mods = agreger([idTrait("bourreau-d-hommes")], []);
    expect(mods.degatsContreHumain).toBeCloseTo(2.4);
    expect(mods.refuseDeFrapperUnHumain).toBe(false);
    const tendre = agreger([idTrait("misericordieux")], []);
    expect(tendre.refuseDeFrapperUnHumain).toBe(true);
  });

  it("n'a aucune cle en double — sinon `idTrait` en perdrait une", () => {
    const cles = new Set(TRAITS.map((t) => t.cle));
    expect(cles.size).toBe(TRAITS.length);
  });

  /**
   * L'index dans `TRAITS` **est** l'identifiant stocke sur les personnes. Si
   * quelqu'un reordonne la table un jour, un village entier change de traits
   * sans qu'aucun type ne bronche : ce test est le seul garde-fou.
   */
  it("garde l'identifiant a l'index du tableau", () => {
    TRAITS.forEach((def, index) => expect(idTrait(def.cle)).toBe(index));
    SEQUELLES.forEach((def, index) => expect(idSequelle(def.cle)).toBe(index));
  });

  it("refuse une cle inconnue plutot que de rendre un identifiant faux", () => {
    // @ts-expect-error — c'est justement le cas qu'on protege
    expect(() => idTrait("inexistant")).toThrow();
  });

  it("donne a chaque trait au moins un effet", () => {
    for (const def of TRAITS) expect(Object.keys(def.effets).length).toBeGreaterThan(0);
  });
});

describe("L'agregation", () => {
  it("ne change rien quand il n'y a ni trait ni sequelle", () => {
    expect(agreger([], [])).toEqual(modificateursVierges());
  });

  it("multiplie les multiplicateurs et additionne les additifs", () => {
    // Colerique : monteeStress x1,25 et degats x1,05. Placide : monteeStress x0,8.
    const mods = agreger([idTrait("colerique"), idTrait("placide")], []);
    expect(mods.monteeStress).toBeCloseTo(1.25 * 0.8);
    expect(mods.degats).toBeCloseTo(1.05);
  });

  it("cumule le seuil de repli sans jamais annuler la regle des 20 %", () => {
    // Le pire cas possible : un peureux ne decroche jamais plus tard que 30 %,
    // et surtout il decroche. Le §4.3 tient.
    const mods = agreger([idTrait("peureux")], []);
    expect(0.2 + mods.seuilRepli).toBeCloseTo(0.3);
    expect(0.2 + mods.seuilRepli).toBeLessThan(1);
  });

  it("laisse une main mutilee interdire le critique, quoi qu'on empile dessus", () => {
    // Le Boucher donne +5 % de critique : il ne doit pas rendre la main.
    const mods = agreger([idTrait("boucher")], [idSequelle("main-mutilee")]);
    expect(mods.peutCritiquer).toBe(false);
    expect(mods.critique).toBeCloseTo(0.05);
  });

  it("garde le plancher de stress le plus haut, jamais leur somme", () => {
    const mods = agreger([], [idSequelle("regard-vide"), idSequelle("regard-vide")]);
    expect(mods.plancherStress).toBe(30);
  });

  it("empile les sequelles sur la vie maximale", () => {
    const mods = agreger([], [idSequelle("poumon-perce"), idSequelle("miracule")]);
    expect(mods.pvMax).toBeCloseTo(0.7 * 0.85);
    expect(mods.esquive).toBeCloseTo(0.1);
  });
});

describe("Les sequelles", () => {
  it("sont au nombre de cinq, et toutes lourdes", () => {
    expect(SEQUELLES).toHaveLength(5);
  });

  /**
   * Le §4.23 casse la regle des 2 a 5 % **ici et seulement ici**. Le test le
   * verifie dans les deux sens : aucun trait ne doit devenir aussi lourd
   * qu'une sequelle par inadvertance.
   */
  it("frappent plus fort que n'importe quel trait", () => {
    const pireTrait = Math.min(
      ...TRAITS.map((t) => t.effets.pvMax ?? t.effets.vitesse ?? 1),
    );
    const pireSequelle = Math.min(
      ...SEQUELLES.map((s) => s.effets.pvMax ?? s.effets.vitesse ?? 1),
    );
    expect(pireSequelle).toBeLessThan(pireTrait);
  });

  it("se relisent par identifiant", () => {
    expect(sequelleParId(idSequelle("miracule"))?.nom).toBe("Miracule");
    expect(traitParId(idTrait("nyctalope"))?.nom).toBe("Nyctalope");
    expect(traitParId(999)).toBeUndefined();
  });
});

describe("Touche-a-tout (§4.23, 23 septembre 2026)", () => {
  const degres = ["touche-a-tout-1", "touche-a-tout-2", "touche-a-tout-3"] as const;

  it("donne une, deux ou trois actives de plus, du plus courant au plus rare", () => {
    const defs = degres.map((cle) => traitParId(idTrait(cle))!);
    expect(defs.map((d) => d.effets.emplacements)).toEqual([1, 2, 3]);
    expect(defs.every((d) => d.famille === "touche-a-tout" && d.origine === "naissance")).toBe(true);
    // Plus il donne, plus il est rare.
    expect(defs[0]!.rarete!).toBeGreaterThan(defs[1]!.rarete!);
    expect(defs[1]!.rarete!).toBeGreaterThan(defs[2]!.rarete!);
  });

  it("s'agrege en emplacements, et vaut zero pour qui ne le porte pas", () => {
    expect(modificateursVierges().emplacements).toBe(0);
    expect(agreger([idTrait("touche-a-tout-2")], []).emplacements).toBe(2);
  });
});
