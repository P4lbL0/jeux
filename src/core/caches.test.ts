import { describe, expect, it } from "vitest";
import {
  REGLAGES_CACHES,
  butinDUneCache,
  combienDeCaches,
  paroleDeLaStele,
  phraseDeFouille,
  semerLesCaches,
  totalDesRessources,
  type Cache,
} from "./caches";
import { TAILLE_CLASSIQUE, estTerreFermeDans, genererMonde } from "./monde";
import { Rng } from "./rng";
import { stocksVides } from "./habitants";
import { TRAITS_DE_NAISSANCE, TRAITS_DE_STELE, traitParId } from "./traits";

/**
 * Les trouvailles de la route (§4.31, jalon 5.6). Ce qui se verifie ici, c'est
 * ce que le design promet : un nombre qui suit la surface et pas la carte, des
 * caches qu'on peut atteindre, un detour qui paie, et un or qui ne remplace
 * pas le port.
 */

const ZONE_X3 = { largeur: 3464, hauteur: 2598 };

/** Un monde tire, quelle que soit la graine : elles ne ratent pas. */
function monde(graine: number, taille = ZONE_X3) {
  return genererMonde(graine, taille);
}

describe("Combien de caches un monde porte", () => {
  it("compte par megapixel et non en absolu — agrandir la carte ne la vide pas", () => {
    const petit = combienDeCaches(TAILLE_CLASSIQUE.largeur, TAILLE_CLASSIQUE.hauteur, false);
    const grand = combienDeCaches(ZONE_X3.largeur, ZONE_X3.hauteur, false);
    expect(grand).toBeGreaterThan(petit);
    // Trois fois la surface, donc environ trois fois les caches : c'est la
    // regle 1 du §4.17, la meme que le decor.
    expect(grand / petit).toBeGreaterThan(2.2);
    expect(grand / petit).toBeLessThan(3.8);
  });

  it("en met moins dans un monde habite : le village est deja une raison d'y aller", () => {
    const muet = combienDeCaches(ZONE_X3.largeur, ZONE_X3.hauteur, false);
    const habite = combienDeCaches(ZONE_X3.largeur, ZONE_X3.hauteur, true);
    expect(habite).toBeLessThan(muet);
    expect(habite).toBeGreaterThan(0);
  });

  it("garde un plafond dur, quelle que soit la taille (§4.17, regle 1)", () => {
    expect(combienDeCaches(20000, 20000, false)).toBe(REGLAGES_CACHES.plafond);
  });
});

describe("Ou elles tombent", () => {
  it("les pose toutes sur de la terre ferme : une cache dans l'eau n'est pas une trouvaille", () => {
    for (let graine = 1; graine <= 12; graine++) {
      const m = monde(graine);
      for (const c of semerLesCaches(m, new Rng(graine), false)) {
        // Le terrain, pas le rectangle : l'eau et la roche peuvent etre
        // n'importe ou depuis le 20 septembre (un lac, un massif au milieu).
        expect(estTerreFermeDans(m, c.point.x, c.point.y)).toBe(true);
        expect(c.point.x).toBeGreaterThanOrEqual(REGLAGES_CACHES.margeDuBord);
        expect(c.point.y).toBeGreaterThanOrEqual(REGLAGES_CACHES.margeDuBord);
        expect(c.point.x).toBeLessThanOrEqual(m.largeur - REGLAGES_CACHES.margeDuBord);
        expect(c.point.y).toBeLessThanOrEqual(m.hauteur - REGLAGES_CACHES.margeDuBord);
      }
    }
  });

  it("les tient loin du village : une cache sur la place ne recompense aucun detour", () => {
    for (let graine = 1; graine <= 12; graine++) {
      const m = monde(graine);
      for (const c of semerLesCaches(m, new Rng(graine), false)) {
        const d = Math.hypot(c.point.x - m.village.x, c.point.y - m.village.y);
        expect(d).toBeGreaterThanOrEqual(REGLAGES_CACHES.margeDuVillage);
      }
    }
  });

  it("les ecarte les unes des autres : deux caches cote a cote n'en font qu'une", () => {
    for (let graine = 1; graine <= 12; graine++) {
      const caches = semerLesCaches(monde(graine), new Rng(graine), false);
      for (let i = 0; i < caches.length; i++) {
        for (let j = i + 1; j < caches.length; j++) {
          const d = Math.hypot(
            caches[i]!.point.x - caches[j]!.point.x,
            caches[i]!.point.y - caches[j]!.point.y,
          );
          expect(d).toBeGreaterThanOrEqual(REGLAGES_CACHES.ecartEntreCaches);
        }
      }
    }
  });

  it("ne pose rien sous les pieds du heros a la premiere image", () => {
    const m = monde(7);
    const depart = { x: m.largeur - 200, y: 200 };
    for (const c of semerLesCaches(m, new Rng(7), false, depart)) {
      const d = Math.hypot(c.point.x - depart.x, c.point.y - depart.y);
      expect(d).toBeGreaterThanOrEqual(REGLAGES_CACHES.margeDuDepart);
    }
  });

  it("rend les memes caches pour une meme graine, comme la carte et le village", () => {
    const m = monde(4242);
    expect(semerLesCaches(m, new Rng(4242), false)).toEqual(
      semerLesCaches(m, new Rng(4242), false),
    );
  });

  it("en trouve presque toujours autant que voulu, meme sur un monde etroit", () => {
    const voulues = combienDeCaches(ZONE_X3.largeur, ZONE_X3.hauteur, false);
    let manques = 0;
    for (let graine = 1; graine <= 20; graine++) {
      const posees = semerLesCaches(monde(graine), new Rng(graine), false).length;
      if (posees < voulues) manques += 1;
    }
    // La presqu'ile et les gros massifs laissent parfois moins de place ; ce
    // qu'on refuse, c'est qu'un monde sur deux soit vide.
    expect(manques).toBeLessThan(5);
  });
});

describe("Ce qu'elles rendent", () => {
  it("fait toujours rendre les deux monnaies a une grosse cache", () => {
    for (let graine = 0; graine < 200; graine++) {
      const butin = butinDUneCache("grosse", new Rng(graine));
      expect(butin.or).toBeGreaterThanOrEqual(REGLAGES_CACHES.orGrosse.min);
      expect(butin.or).toBeLessThanOrEqual(REGLAGES_CACHES.orGrosse.max);
      const matiere = Object.values(butin.ressources).reduce((s, v) => s + v, 0);
      expect(matiere).toBeGreaterThan(0);
    }
  });

  it("fait rendre a une petite cache l'or ou la matiere, jamais rien du tout", () => {
    let avecOr = 0;
    let avecMatiere = 0;
    for (let graine = 0; graine < 200; graine++) {
      const butin = butinDUneCache("petite", new Rng(graine));
      const matiere = Object.values(butin.ressources).reduce((s, v) => s + v, 0);
      expect(butin.or + matiere).toBeGreaterThan(0);
      if (butin.or > 0) avecOr += 1;
      if (matiere > 0) avecMatiere += 1;
    }
    // Les deux se rencontrent : une cache qui rendrait toujours la meme chose
    // n'aurait pas besoin d'etre ouverte pour etre connue.
    expect(avecOr).toBeGreaterThan(50);
    expect(avecMatiere).toBeGreaterThan(50);
  });

  it("ne rend qu'une sorte de matiere a la fois : un lot qui se raconte", () => {
    for (let graine = 0; graine < 100; graine++) {
      const butin = butinDUneCache("petite", new Rng(graine));
      const sortes = Object.values(butin.ressources).filter((v) => v > 0).length;
      expect(sortes).toBeLessThanOrEqual(1);
    }
  });

  it("garde l'or d'une route entiere sous ce que le port rapporte en un voyage", () => {
    // ⚠️ **La regle du §4.8 devient un test, comme pour le butin des morts.**
    // Une cargaison de bois vaut 50 pieces au port ; un monde entier fouille de
    // fond en comble doit rester du meme ordre que quelques cargaisons, sinon
    // l'or de la route remplace le commerce et tue la moitie du jeu de village.
    const m = monde(3);
    const caches = semerLesCaches(m, new Rng(3), false);
    const or = caches.reduce((s, c) => s + c.or, 0);
    expect(or).toBeLessThan(50 * 6);
  });

  it("garde le camp de betes franchissable : il se juge avant de s'y engager", () => {
    const caches = semerLesCaches(monde(9), new Rng(9), false);
    for (const c of caches) {
      if (c.genre === "stele") {
        expect(c.garde).toBeGreaterThanOrEqual(REGLAGES_CACHES.gardeDeStele.min);
        expect(c.garde).toBeLessThanOrEqual(REGLAGES_CACHES.gardeDeStele.max);
      } else if (c.taille === "grosse") {
        expect(c.garde).toBeGreaterThanOrEqual(REGLAGES_CACHES.garde.min);
        expect(c.garde).toBeLessThanOrEqual(REGLAGES_CACHES.garde.max);
      } else {
        expect(c.garde).toBe(0);
      }
    }
  });

  it("ne garde qu'une minorite des caches : la plupart se ramassent", () => {
    const toutes: Cache[] = [];
    for (let graine = 1; graine <= 25; graine++) {
      toutes.push(...semerLesCaches(monde(graine), new Rng(graine), false));
    }
    const grosses = toutes.filter((c) => c.taille === "grosse").length;
    expect(grosses).toBeGreaterThan(0);
    expect(grosses).toBeLessThan(toutes.length / 2);
  });
});

describe("Ce qu'on en dit", () => {
  it("annonce ce qu'on emporte, et pas ce que c'etait", () => {
    const cache: Cache = {
      id: 0,
      point: { x: 0, y: 0 },
      genre: "coffre",
      taille: "petite",
      or: 14,
      ressources: { ...stocksVides(), bois: 18 },
      garde: 0,
      trait: null,
    };
    const phrase = phraseDeFouille(cache);
    expect(phrase).toContain("14 pieces");
    expect(phrase).toContain("18 bois");
    expect(phrase).not.toContain("coffre");
  });

  it("additionne les lots pour en faire des reserves de depart", () => {
    const total = totalDesRessources([
      { ...stocksVides(), bois: 12 },
      { ...stocksVides(), bois: 8, pierre: 5 },
    ]);
    expect(total.bois).toBe(20);
    expect(total.pierre).toBe(5);
    expect(total.minerai).toBe(0);
  });
});

describe("La stele (§4.31, troisieme trouvaille)", () => {
  it("reste rare : un monde sur cinq, et jamais deux", () => {
    let mondes = 0;
    for (let graine = 1; graine <= 60; graine++) {
      const caches = semerLesCaches(monde(graine), new Rng(graine), false);
      const steles = caches.filter((c) => c.genre === "stele");
      expect(steles.length).toBeLessThanOrEqual(1);
      if (steles.length === 1) mondes += 1;
    }
    // Assez pour que ca arrive sur une route de sept mondes, assez peu pour que
    // ca se raconte. Le §4.31 la veut « rare », et c'est la plus chere a doser.
    expect(mondes / 60).toBeGreaterThan(0.08);
    expect(mondes / 60).toBeLessThan(0.35);
  });

  it("est toujours gardee, et ne rend ni or ni matiere", () => {
    for (let graine = 1; graine <= 60; graine++) {
      for (const c of semerLesCaches(monde(graine), new Rng(graine), false)) {
        if (c.genre !== "stele") continue;
        expect(c.garde).toBeGreaterThanOrEqual(REGLAGES_CACHES.gardeDeStele.min);
        expect(c.or).toBe(0);
        expect(Object.values(c.ressources).reduce((s, v) => s + v, 0)).toBe(0);
        expect(c.trait).not.toBeNull();
        expect(TRAITS_DE_STELE).toContain(c.trait);
      }
    }
  });

  it("donne un trait qui ne s'obtient nulle part ailleurs", () => {
    // ⚠️ Une stele est leur seule porte d'entree, comme le soin est la seule
    // porte des sequelles : c'est ce qui fait qu'en croiser une se raconte.
    for (const id of TRAITS_DE_STELE) {
      expect(TRAITS_DE_NAISSANCE).not.toContain(id);
      expect(traitParId(id)!.origine).toBe("stele");
    }
    expect(TRAITS_DE_STELE.length).toBeGreaterThan(3);
  });

  it("annonce ce qu'elle donne **et** ce qu'elle coute avant qu'on paie", () => {
    for (const id of TRAITS_DE_STELE) {
      const def = traitParId(id)!;
      // Chacun est un marche : aucun trait de stele n'est un cadeau, sinon il
      // n'y aurait plus rien a decider.
      expect(def.humeur).toBe("mixte");
      const parole = paroleDeLaStele(id);
      expect(parole.lignes.join(" ")).toContain(def.nom);
      expect(parole.lignes.join(" ")).toContain(def.resume);
      expect(parole.question).toContain("?");
    }
  });
});
