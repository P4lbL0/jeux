import { describe, expect, it } from "vitest";
import { ARCHETYPES } from "../ennemis";
import { avancementDe, type Modele } from "./four";
import { CADRE } from "./corps";
import {
  BETES,
  CADRE_BETE,
  CADRE_GROSSE_BETE,
  GESTES_MONSTRE,
  MORTS,
  allure,
  bete,
  familleDeMonstre,
  mort,
  tousLesMonstres,
} from "./monstres";
import { Toile } from "./pinceau";
import { cranDUsure, familleDeVillageois, villageois, type MetierDessine } from "./villageois";
import { CHANTIERS, CLES_CHAMP, peindreChamp, peindreChantier } from "./batiments";
import { EST, HAUTEUR_MUR, MATIERES_MUR, MUR, OUEST, TOUR, peindreMur, peindreTour } from "./murs";

/** Chaque frame d'un modele, dessinee et cernee comme le four le ferait. */
function chaqueFrame(modele: Modele, verifier: (toile: Toile, geste: string, i: number) => void): void {
  const toile = new Toile(modele.taille, modele.taille);
  for (const geste of modele.gestes) {
    for (let i = 0; i < geste.frames; i += 1) {
      toile.effacer();
      modele.dessiner(toile, geste.cle, avancementDe(geste, i));
      toile.contour();
      verifier(toile, geste.cle, i);
    }
  }
}

describe("Les monstres — une bete, et des nombres", () => {
  it("donne une planche a chaque archetype d'ennemis.ts", () => {
    // Un archetype sans planche afficherait le damier de Phaser, la nuit, au
    // milieu d'une horde.
    const familles = new Set(tousLesMonstres().map((m) => m.famille));
    for (const archetype of ARCHETYPES) {
      expect(familles.has(familleDeMonstre(archetype.id)), archetype.id).toBe(true);
      expect(archetype.texture).toBe(familleDeMonstre(archetype.id));
    }
    for (const invocation of ["familier", "familier-golem", "familier-spectre", "mort-vivant"]) {
      expect(familles.has(familleDeMonstre(invocation)), invocation).toBe(true);
    }
  });

  it("porte les gestes que poses.ts declenche sur un ennemi", () => {
    const cles = GESTES_MONSTRE.map((g) => g.cle);
    for (const attendu of ["repos", "marche", "attaque", "charge", "touche", "mort"]) {
      expect(cles).toContain(attendu);
    }
  });

  it("tient dans son cadre, contour compris, pour chaque bete et chaque geste", () => {
    // C'est la ou un dessin parametrique casse : le museau d'une brute qui
    // bondit, les pattes d'un mort qui s'ecartent. Jamais a la compilation.
    for (const modele of tousLesMonstres()) {
      chaqueFrame(modele, (toile, geste, i) => {
        // Assez de pixels pour etre quelque chose : trente dans un cadre de
        // 32, et la meme part de la surface dans un cadre plus petit.
        const minimum = Math.round(30 * (modele.taille / 32) ** 2);
        expect(toile.compterOpaques(), `${modele.famille} ${geste} ${i}`).toBeGreaterThan(minimum);
        expect(toile.pixelsDuBord(), `${modele.famille} ${geste} ${i} touche le bord`).toBe(0);
      });
    }
  });

  it("cuit la brute et le golem plus grands, jamais agrandis", () => {
    // Une fois et demie le cadre ordinaire, qui est celui des humains : la
    // brute doit dominer un habitant, et elle est cuite a cette taille, pas
    // agrandie.
    expect(BETES.brute!.cadre).toBe(CADRE_GROSSE_BETE);
    expect(BETES["familier-golem"]!.cadre).toBe(CADRE_GROSSE_BETE);
    expect(CADRE_GROSSE_BETE).toBe(CADRE_BETE * 1.5);
    expect(bete("fonceur").taille).toBe(CADRE);
  });

  it("se jette en avant a l'attaque, et le coup est le point le plus avance", () => {
    const attaque = GESTES_MONSTRE.find((g) => g.cle === "attaque")!;
    const avancees = Array.from({ length: attaque.frames }, (_, i) =>
      allure("attaque", avancementDe(attaque, i)).avancee,
    );
    expect(Math.min(...avancees), "elle ne se ramasse jamais").toBeLessThan(0);
    expect(avancees[avancees.length - 1]).toBe(Math.max(...avancees));
    expect(allure("attaque", 1).gueule).toBe(1);
  });

  it("recule et s'aplatit pour telegraphier, et tient la pose", () => {
    const charge = allure("charge", 1);
    expect(charge.avancee).toBeLessThan(0);
    expect(charge.hauteur).toBeGreaterThan(0);
  });

  it("s'affaisse a la mort au lieu de disparaitre", () => {
    expect(allure("mort", 1).affaissement).toBe(1);
    expect(allure("mort", 0).affaissement).toBe(0);
  });

  it("ne dessine jamais deux archetypes pareils", () => {
    // Le revenant et le mort-vivant ont le meme corps : ce sont leurs yeux qui
    // les separent, donc on compare les pixels et pas la silhouette.
    const rendus = tousLesMonstres().map((m) => {
      const toile = new Toile(m.taille, m.taille);
      m.dessiner(toile, "repos", 0);
      return Array.from(toile.donnees()).join(",");
    });
    expect(new Set(rendus).size).toBe(rendus.length);
  });

  it("allume les yeux des morts, en sang pour l'ennemi et en ciel pour l'allie", () => {
    expect(MORTS.revenant.yeux).not.toBe(MORTS["mort-vivant"].yeux);
    expect(mort("revenant").famille).not.toBe(mort("mort-vivant").famille);
  });
});

describe("Les villageois — un metier se lit sur le tablier et l'outil", () => {
  const metiers: MetierDessine[] = [
    "pecheur",
    "fermier",
    "bucheron",
    "mineur",
    "forgeron",
    "charpentier",
    "guetteur",
    "survivant",
  ];

  it("tient dans son carreau pour chaque metier, neuf comme use", () => {
    for (const metier of metiers) {
      for (const corps of [
        { usure: 0, sang: 0 },
        { usure: 1, sang: 1 },
      ]) {
        chaqueFrame(villageois(metier, corps), (toile, geste, i) => {
          expect(toile.pixelsDuBord(), `${metier} usure ${corps.usure} ${geste} ${i}`).toBe(0);
        });
      }
    }
  });

  it("ne cuit qu'une planche par cran d'usure, pas par pourcent de stress", () => {
    expect(cranDUsure(0)).toBe(0);
    expect(cranDUsure(0.2)).toBe(0);
    expect(cranDUsure(0.5)).toBe(1);
    expect(cranDUsure(0.9)).toBe(2);
    expect(familleDeVillageois("mineur", { usure: 0.1, sang: 0 })).toBe(
      familleDeVillageois("mineur", { usure: 0.2, sang: 0 }),
    );
    expect(familleDeVillageois("mineur", { usure: 0, sang: 0 })).not.toBe(
      familleDeVillageois("mineur", { usure: 1, sang: 0 }),
    );
  });

  it("montre l'outil de chaque metier au travail, et des outils differents", () => {
    const rendus = metiers.map((metier) => {
      const modele = villageois(metier, { usure: 0, sang: 0 });
      const toile = new Toile(modele.taille, modele.taille);
      const travail = modele.gestes.find((g) => g.cle === "travail")!;
      modele.dessiner(toile, "travail", avancementDe(travail, 5));
      return toile.rendu();
    });
    // Le guetteur et le survivant partagent le baton : sept dessins pour huit.
    expect(new Set(rendus).size).toBeGreaterThanOrEqual(metiers.length - 1);
  });
});

describe("Les murs — un palier est un autre mur", () => {
  it("monte plus haut a chaque palier, et ne sort jamais de son cadre par le haut", () => {
    // Un rempart de pierre domine une palissade : c'est ce qui se voit de loin.
    expect(HAUTEUR_MUR.bois).toBeLessThan(HAUTEUR_MUR.fer);
    expect(HAUTEUR_MUR.fer).toBeLessThan(HAUTEUR_MUR.pierre);
    for (const matiere of MATIERES_MUR) {
      const toile = new Toile(MUR.largeur, MUR.hauteur);
      peindreMur(toile, matiere, EST | OUEST);
      toile.contour();
      expect(toile.compterOpaques(), matiere).toBeGreaterThan(MUR.largeur * 20);
      expect(toile.rendu().split("\n")[0]!.includes("#"), `${matiere} deborde en haut`).toBe(false);
    }
  });

  it("garde un chantier par emprise, et il ne touche pas le bord en haut", () => {
    for (const chantier of Object.values(CHANTIERS)) {
      const toile = new Toile(chantier.largeur, chantier.hauteur);
      peindreChantier(toile, chantier.largeur, chantier.hauteur);
      expect(toile.compterOpaques(), chantier.cle).toBeGreaterThan(80);
      expect(toile.rendu().split("\n")[0]!.includes("#"), `${chantier.cle} deborde en haut`).toBe(false);
    }
  });

  it("dessine une tour plus haute que large, et deux champs differents", () => {
    const tour = new Toile(TOUR.largeur, TOUR.hauteur);
    peindreTour(tour);
    expect(TOUR.hauteur).toBeGreaterThan(TOUR.largeur);
    expect(tour.compterOpaques()).toBeGreaterThan(400);

    const jeune = new Toile(32, 32);
    const mur = new Toile(32, 32);
    peindreChamp(jeune, "jeune");
    peindreChamp(mur, "mur");
    expect(jeune.donnees()).not.toEqual(mur.donnees());
    expect(CLES_CHAMP.jeune).not.toBe(CLES_CHAMP.mur);
  });
});
