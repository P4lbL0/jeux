import { describe, expect, it } from "vitest";
import {
  ACTIONS,
  actionParId,
  actionsDe,
  aliasDe,
  assigner,
  ecrireAction,
  ecrireActionCourte,
  ecrireTouche,
  estParDefaut,
  fusionner,
  mappageParDefaut,
  proprietaire,
  serialiser,
  TOUCHE_CARACTERE_QUESTION,
} from "./touches";

describe("la table des actions", () => {
  it("n'a aucun identifiant en double", () => {
    const ids = ACTIONS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("n'a aucune touche par defaut en double", () => {
    const touches = ACTIONS.map((a) => a.defaut);
    expect(new Set(touches).size).toBe(touches.length);
  });

  it("n'a aucun alias qui marche sur la touche principale d'une autre action", () => {
    const principales = new Set(ACTIONS.map((a) => a.defaut));
    for (const action of ACTIONS) {
      for (const alias of action.alias ?? []) {
        expect(principales.has(alias), `${alias} est pris par une action`).toBe(false);
      }
    }
  });

  it("n'a aucun alias partage entre deux actions", () => {
    const vus = new Set<string>();
    for (const action of ACTIONS) {
      for (const alias of action.alias ?? []) {
        expect(vus.has(alias), `${alias} en double`).toBe(false);
        vus.add(alias);
      }
    }
  });

  it("range chaque action dans une categorie qui la retrouve", () => {
    for (const action of ACTIONS) {
      expect(actionsDe(action.categorie)).toContain(action);
    }
  });
});

describe("le mappage par defaut", () => {
  it("donne une touche a chaque action", () => {
    const m = mappageParDefaut();
    for (const action of ACTIONS) expect(m[action.id]).toBe(action.defaut);
  });

  it("se reconnait comme intouche", () => {
    expect(estParDefaut(mappageParDefaut())).toBe(true);
    expect(serialiser(mappageParDefaut())).toEqual({});
  });

  it("met rompez sur O et la pause sur ECHAP", () => {
    const m = mappageParDefaut();
    expect(m.rompez).toBe("O");
    expect(m.pause).toBe("ESC");
  });
});

describe("assigner une touche", () => {
  it("pose une touche libre et rend l'ancienne", () => {
    const pose = assigner(mappageParDefaut(), "cloche", "I");
    expect(pose.resultat).toBe("pose");
    expect(pose.mappage.cloche).toBe("I");
    expect(proprietaire(pose.mappage, "B")).toBeNull();
  });

  it("echange quand une autre action tient deja la touche", () => {
    const pose = assigner(mappageParDefaut(), "cloche", "G");
    expect(pose.resultat).toBe("echange");
    if (pose.resultat !== "echange") return;
    expect(pose.avec).toBe("palissade");
    expect(pose.mappage.cloche).toBe("G");
    // La palissade recupere l'ancienne touche de la cloche : personne ne reste muet.
    expect(pose.mappage.palissade).toBe("B");
  });

  it("ne laisse jamais une action sans touche, quoi qu'on echange", () => {
    let m = mappageParDefaut();
    const cibles = ["G", "H", "J", "B", "F", "Y"];
    for (const touche of cibles) m = assigner(m, "cloche", touche).mappage;
    for (const action of ACTIONS) {
      expect(m[action.id], `${action.id} n'a plus de touche`).toBeTruthy();
    }
    // Et toujours aucune touche partagee par deux actions.
    const touches = ACTIONS.map((a) => m[a.id]!);
    expect(new Set(touches).size).toBe(touches.length);
  });

  it("refuse une touche qu'un alias fixe tient deja", () => {
    const pose = assigner(mappageParDefaut(), "cloche", "SPACE");
    expect(pose.resultat).toBe("refus");
    if (pose.resultat !== "refus") return;
    expect(pose.avec).toBe("capacite1");
    expect(pose.mappage.cloche).toBe("B");
  });

  it("laisse passer un alias de l'action elle-meme sans rien casser", () => {
    const pose = assigner(mappageParDefaut(), "capacite1", "SPACE");
    expect(pose.resultat).toBe("pose");
    expect(pose.mappage.capacite1).toBe("SPACE");
  });

  it("ne bouge pas quand c'est deja la touche, ni pour une action inconnue", () => {
    const m = mappageParDefaut();
    expect(assigner(m, "cloche", "B").resultat).toBe("inchange");
    expect(assigner(m, "chanter", "I").resultat).toBe("inchange");
  });
});

describe("l'enregistrement", () => {
  it("ne garde que ce qui differe du defaut", () => {
    const m = assigner(mappageParDefaut(), "cloche", "I").mappage;
    expect(serialiser(m)).toEqual({ cloche: "I" });
    expect(estParDefaut(m)).toBe(false);
  });

  it("se relit tel quel", () => {
    const m = assigner(mappageParDefaut(), "cloche", "I").mappage;
    expect(fusionner(serialiser(m))).toEqual(m);
  });

  it("retombe sur le defaut devant n'importe quoi", () => {
    expect(fusionner(null)).toEqual(mappageParDefaut());
    expect(fusionner("bonjour")).toEqual(mappageParDefaut());
    expect(fusionner({ cloche: 42, port: "" })).toEqual(mappageParDefaut());
  });

  it("donne sa touche a une action que la sauvegarde ne connaissait pas", () => {
    const relu = fusionner({ cloche: "I" });
    expect(relu.pause).toBe("ESC");
    expect(relu.cloche).toBe("I");
  });

  it("ne laisse pas un doublon enregistre casser l'invariant", () => {
    const relu = fusionner({ cloche: "G", palissade: "G" });
    const touches = ACTIONS.map((a) => relu[a.id]!);
    expect(new Set(touches).size).toBe(touches.length);
  });
});

describe("l'ecriture a l'ecran", () => {
  it("traduit ce qui ne se lit pas", () => {
    expect(ecrireTouche("ESC")).toBe("ECHAP");
    expect(ecrireTouche("ONE")).toBe("1");
    expect(ecrireTouche(TOUCHE_CARACTERE_QUESTION)).toBe("?");
  });

  it("laisse passer une lettre telle quelle", () => {
    expect(ecrireTouche("Z")).toBe("Z");
  });

  it("ecrit la touche d'une action, remappee ou non", () => {
    const m = assigner(mappageParDefaut(), "cloche", "I").mappage;
    expect(ecrireAction(m, "cloche")).toBe("I");
    expect(ecrireAction(mappageParDefaut(), "pause")).toBe("ECHAP");
  });

  it("connait chaque action de la table par son identifiant", () => {
    for (const action of ACTIONS) expect(actionParId(action.id)).toBe(action);
    expect(actionParId("chanter")).toBeUndefined();
  });

  it("annonce ESPACE a cote du 1 dans la ligne courte", () => {
    // Les deux marchent, et sur AZERTY le 1 demande Maj. La ligne dit les deux.
    expect(ecrireActionCourte(mappageParDefaut(), "capacite1")).toBe("1/ESPACE");
    expect(ecrireActionCourte(mappageParDefaut(), "capacite2")).toBe("2");
  });

  it("suit le remappage de la capacite 1, sans doubler ESPACE", () => {
    const remappee = assigner(mappageParDefaut(), "capacite1", "I").mappage;
    expect(ecrireActionCourte(remappee, "capacite1")).toBe("I/ESPACE");
    const surEspace = assigner(mappageParDefaut(), "capacite1", "SPACE").mappage;
    expect(ecrireActionCourte(surEspace, "capacite1")).toBe("ESPACE");
  });

  it("retrouve l'action d'un alias", () => {
    expect(aliasDe("SPACE")).toBe("capacite1");
    expect(aliasDe("UP")).toBe("haut");
    expect(aliasDe("I")).toBeNull();
  });
});
