import { describe, expect, it } from "vitest";
import { CLASSES, ORDRE_CLASSES, type Role } from "./classes";
import {
  calculerPostes,
  formationSuivante,
  postureSuivante,
  REGLAGES,
  FORMATIONS,
  POSTURES,
  tache,
  tachesPour,
  metierDe,
  TACHES,
  type Point,
} from "./ordres";

const ANCRE: Point = { x: 0, y: 0 };
const MENACE: Point = { x: 0, y: 500 }; // la menace vient du bas

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

describe("Ordres — les postures", () => {
  it("l'agressif s'eloigne plus et frappe plus tot que le temporisateur", () => {
    expect(REGLAGES.agressif.laisse).toBeGreaterThan(REGLAGES.temporiser.laisse);
    expect(REGLAGES.agressif.ennemisPourCapacite).toBeLessThan(
      REGLAGES.temporiser.ennemisPourCapacite,
    );
    // Il colle sa cible au lieu de tenir sa distance de confort.
    expect(REGLAGES.agressif.distance).toBeLessThan(REGLAGES.temporiser.distance);
  });

  it("le repli ne declenche jamais de capacite", () => {
    expect(REGLAGES.repli.ennemisPourCapacite).toBe(Infinity);
  });

  it("fait le tour des postures et des formations sans jamais sortir de la liste", () => {
    let posture = POSTURES[0]!;
    for (let i = 0; i < POSTURES.length; i++) posture = postureSuivante(posture);
    expect(posture).toBe(POSTURES[0]);

    let formation = FORMATIONS[0]!;
    for (let i = 0; i < FORMATIONS.length; i++) formation = formationSuivante(formation);
    expect(formation).toBe(FORMATIONS[0]);
    // Et en arriere aussi.
    expect(formationSuivante(FORMATIONS[0]!, -1)).toBe(FORMATIONS[FORMATIONS.length - 1]);
  });
});

describe("Ordres — les formations", () => {
  it("ne donne aucun poste en formation libre", () => {
    const postes = calculerPostes(["avant", "arriere"], "libre", ANCRE, MENACE);
    expect(postes).toEqual([null, null]);
  });

  /**
   * La promesse du §4.4 : les tanks devant, les distants derriere. Si elle n'est
   * pas tenue, la formation n'est qu'une decoration.
   */
  it("place les avants entre la menace et les arrieres", () => {
    const roles: Role[] = ["avant", "centre", "arriere", "flanc"];
    const [avant, centre, arriere, flanc] = calculerPostes(roles, "mur", ANCRE, MENACE) as Point[];

    expect(distance(avant!, MENACE)).toBeLessThan(distance(centre!, MENACE));
    expect(distance(centre!, MENACE)).toBeLessThan(distance(arriere!, MENACE));
    // Le flanc est sur le cote, pas dans la colonne.
    expect(Math.abs(flanc!.x)).toBeGreaterThan(Math.abs(centre!.x) + 40);
  });

  it("pivote avec la menace", () => {
    const parLeBas = calculerPostes(["avant"], "mur", ANCRE, { x: 0, y: 500 })[0] as Point;
    const parLaDroite = calculerPostes(["avant"], "mur", ANCRE, { x: 500, y: 0 })[0] as Point;

    expect(parLeBas.y).toBeGreaterThan(0);
    expect(parLaDroite.x).toBeGreaterThan(0);
  });

  it("suit l'ancre quand elle se deplace", () => {
    const roles: Role[] = ["avant", "arriere"];
    const ici = calculerPostes(roles, "mur", ANCRE, MENACE) as Point[];
    // La menace se decale d'autant : la formation se translate sans pivoter.
    const laBas = calculerPostes(
      roles,
      "mur",
      { x: 300, y: 200 },
      { x: MENACE.x + 300, y: MENACE.y + 200 },
    ) as Point[];

    ici.forEach((poste, i) => {
      expect(laBas[i]!.x - poste.x).toBeCloseTo(300, 5);
      expect(laBas[i]!.y - poste.y).toBeCloseTo(200, 5);
    });
  });

  it("pivote quand la menace change de cote sans que l'ancre bouge", () => {
    const roles: Role[] = ["avant"];
    const face = calculerPostes(roles, "mur", ANCRE, { x: 0, y: 500 })[0] as Point;
    const dos = calculerPostes(roles, "mur", ANCRE, { x: 0, y: -500 })[0] as Point;
    expect(Math.sign(face.y)).toBe(-Math.sign(dos.y));
  });

  it("ne superpose jamais deux postes, meme entre membres d'une meme classe", () => {
    // Le pire cas : une equipe entiere de guerriers, plus une de chaque classe.
    const cas: Role[][] = [
      ORDRE_CLASSES.map((id) => CLASSES[id].role),
      ["avant", "avant", "avant", "avant", "avant"],
      ["flanc", "flanc", "flanc"],
      ["arriere", "arriere", "centre", "centre"],
    ];

    for (const roles of cas) {
      for (const formation of ["mur", "cercle"] as const) {
        const postes = calculerPostes(roles, formation, ANCRE, MENACE) as Point[];
        for (let i = 0; i < postes.length; i++) {
          for (let j = i + 1; j < postes.length; j++) {
            expect(distance(postes[i]!, postes[j]!)).toBeGreaterThan(10);
          }
        }
      }
    }
  });

  it("donne toujours les memes places pour la meme equipe", () => {
    const roles = ORDRE_CLASSES.map((id) => CLASSES[id].role);
    expect(calculerPostes(roles, "mur", ANCRE, MENACE)).toEqual(
      calculerPostes(roles, "mur", ANCRE, MENACE),
    );
  });

  it("garde le cercle serre autour de l'ancre", () => {
    const roles = ORDRE_CLASSES.map((id) => CLASSES[id].role);
    for (const poste of calculerPostes(roles, "cercle", ANCRE, MENACE) as Point[]) {
      expect(distance(poste, ANCRE)).toBeLessThan(120);
    }
  });

  it("tient debout sans menace connue", () => {
    const postes = calculerPostes(["avant", "arriere"], "mur", ANCRE, null) as Point[];
    for (const poste of postes) {
      expect(Number.isFinite(poste.x)).toBe(true);
      expect(Number.isFinite(poste.y)).toBe(true);
    }
  });
});

describe("Ordres — les roles", () => {
  it("donne un role a chaque classe, et une ligne de front qui existe", () => {
    const roles = ORDRE_CLASSES.map((id) => CLASSES[id].role);
    expect(roles).toHaveLength(ORDRE_CLASSES.length);
    expect(roles).toContain("avant");
    expect(roles).toContain("arriere");
  });
});

describe("le menu d'ordres (bloc 8)", () => {
  it("un civil ne voit pas les postures de combat, un combattant pas les civiles", () => {
    const civil = tachesPour(["civil"]).map((t) => t.id);
    expect(civil).toContain("civil-prudent");
    expect(civil).not.toContain("posture-agressif");

    const combattant = tachesPour(["combattant"]).map((t) => t.id);
    expect(combattant).toContain("posture-agressif");
    expect(combattant).not.toContain("civil-prudent");
  });

  it("une selection melangee voit l'union des deux vocabulaires", () => {
    const melange = tachesPour(["civil", "combattant"]).map((t) => t.id);
    expect(melange).toContain("civil-prudent");
    expect(melange).toContain("posture-agressif");
    // Le travail et « me suivre » valent pour les deux populations : ils ne
    // doivent apparaitre qu'une fois, pas deux.
    expect(melange.filter((id) => id === "poste-mineur")).toHaveLength(1);
    expect(melange.filter((id) => id === "suivre")).toHaveLength(1);
  });

  it("les sept metiers sont proposes, y compris les trois sans poste sur la carte", () => {
    const metiers = TACHES.filter((t) => t.groupe === "travail").map((t) => t.metier);
    // Le forgeron, le charpentier et le guetteur existaient dans les donnees
    // depuis le bloc 2 sans qu'on puisse les donner a personne.
    expect(metiers).toEqual([
      "pecheur",
      "bucheron",
      "mineur",
      "fermier",
      "forgeron",
      "charpentier",
      "guetteur",
    ]);
  });

  it("rien de selectionne ne propose rien", () => {
    expect(tachesPour([])).toHaveLength(0);
  });

  it("chaque identifiant se retrouve, et une seule fois", () => {
    const ids = TACHES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(tache(id)?.id).toBe(id);
    expect(tache("poste-mineur")?.metier).toBe("mineur");
    expect(metierDe("poste-pecheur")).toBe("pecheur");
    expect(metierDe("suivre")).toBeNull();
  });

  it("les groupes se suivent sans jamais revenir en arriere", () => {
    // Le menu insere un filet a chaque changement de groupe : si un groupe
    // reapparaissait plus bas, il afficherait deux fois la meme entete.
    const ordre = ["travail", "civil", "combat", "moi"];
    const vus: string[] = [];
    for (const t of TACHES) if (vus.at(-1) !== t.groupe) vus.push(t.groupe);
    expect(vus).toEqual(ordre);
  });
});
