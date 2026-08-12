import { describe, expect, it } from "vitest";
import {
  ARDOISE,
  BOIS,
  CHAIR,
  MATIERES,
  PIERRE,
  SOL_CENDRE,
  SOL_VERT,
  clarte,
  desaturer,
  ecart,
  melanger,
  palir,
} from "./palette";
import { Toile } from "./pinceau";
import { avancementDe, type Geste } from "./four";
import { GESTES, posture, villageois } from "./villageois";
import { C } from "../ui/couleurs";

describe("Palette — l'arithmetique", () => {
  it("melange sans deborder de ses bornes", () => {
    expect(melanger(0x000000, 0xffffff, 0)).toBe(0x000000);
    expect(melanger(0x000000, 0xffffff, 1)).toBe(0xffffff);
    expect(melanger(0x000000, 0xffffff, 0.5)).toBe(0x808080);
  });

  it("desature vers un gris, jamais vers du noir", () => {
    const gris = desaturer(0xff0000, 1);
    expect(gris & 0xff).toBe((gris >> 8) & 0xff);
    expect(gris & 0xff).toBe((gris >> 16) & 0xff);
    expect(gris & 0xff).toBeGreaterThan(0);
  });
});

describe("Palette — l'ombre est du fer, la lumiere est de l'os", () => {
  it("range les trois valeurs de chaque matiere dans l'ordre", () => {
    for (const { nom, matiere } of MATIERES) {
      expect(clarte(matiere.sombre), nom).toBeLessThan(clarte(matiere.corps));
      expect(clarte(matiere.corps), nom).toBeLessThan(clarte(matiere.clair));
    }
  });

  it("ne fabrique jamais deux matieres qui se confondent", () => {
    // Le seuil vient de la mesure qui a impose de rechauffer le bois : la pierre
    // et lui tombaient a trois unites l'un de l'autre, deux gris identiques.
    // Deux matieres separees de moins de 24 ne se distinguent pas a 32 px.
    MATIERES.forEach((a, i) => {
      for (const b of MATIERES.slice(i + 1)) {
        expect(ecart(a.matiere.corps, b.matiere.corps), `${a.nom} / ${b.nom}`).toBeGreaterThan(24);
      }
    });
  });

  it("garde le bois franchement plus chaud que la pierre", () => {
    const chaleur = (couleur: number) => ((couleur >> 16) & 0xff) - (couleur & 0xff);
    expect(chaleur(BOIS.corps)).toBeGreaterThan(chaleur(PIERRE.corps) + 20);
  });

  it("garde l'ardoise plus sombre que la pierre des murs", () => {
    // Un toit plus clair que le mur qu'il couvre remonte dans l'image et le
    // batiment se lit a l'envers.
    expect(clarte(ARDOISE.corps)).toBeLessThan(clarte(PIERRE.corps));
  });

  it("ne fait jamais de la chair une peau rose", () => {
    // Une chair rose est ce que tout placeholder finit par produire, et c'est
    // exactement ce que le §4.30 interdit : elle descend de l'os.
    const rouge = (CHAIR.corps >> 16) & 0xff;
    const vert = (CHAIR.corps >> 8) & 0xff;
    expect(rouge - vert).toBeLessThan(40);
    expect(ecart(CHAIR.corps, C.os)).toBeLessThan(ecart(CHAIR.corps, C.sangFrais));
  });

  it("propose deux sols nettement differents, pour qu'on puisse trancher", () => {
    expect(ecart(SOL_VERT.corps, SOL_CENDRE.corps)).toBeGreaterThan(30);
  });

  it("palit sans changer de matiere", () => {
    const use = palir(CHAIR, 1);
    expect(clarte(use.corps)).toBeGreaterThan(clarte(CHAIR.corps));
    expect(ecart(use.corps, CHAIR.corps)).toBeLessThan(80);
  });
});

describe("Pinceau", () => {
  it("ne dessine rien hors de la toile", () => {
    const toile = new Toile(8, 8);
    toile.rect(-4, -4, 4, 4, 0xffffff);
    toile.rect(8, 8, 4, 4, 0xffffff);
    expect(toile.compterOpaques()).toBe(0);
  });

  it("oriente un membre par son angle, 0 vers le bas", () => {
    const toile = new Toile(32, 32);
    const bas = toile.membre(16, 16, 8, 0, 2, 0xffffff);
    expect(bas.x).toBeCloseTo(16);
    expect(bas.y).toBeCloseTo(24);

    const avant = toile.membre(16, 16, 8, Math.PI / 2, 2, 0xffffff);
    expect(avant.x).toBeCloseTo(24);
    expect(avant.y).toBeCloseTo(16);
  });

  it("cerne la silhouette sans se cerner lui-meme", () => {
    const toile = new Toile(8, 8);
    toile.rect(3, 3, 2, 2, 0xffffff);
    const avant = toile.compterOpaques();
    toile.contour();
    // Un carre de 2 x 2 a exactement huit voisins en croix et en coin... mais le
    // contour ne regarde que les quatre cotes : 4 x 2 = 8 pixels, pas 12.
    expect(toile.compterOpaques()).toBe(avant + 8);
  });

  it("ne cerne pas l'ombre au sol", () => {
    const toile = new Toile(16, 16);
    toile.ombreAuSol(8, 12, 5, 2);
    const ombre = toile.compterOpaques();
    toile.contour();
    expect(toile.compterOpaques()).toBe(ombre);
    expect(ombre).toBe(0);
  });
});

describe("Villageois — un geste est un angle", () => {
  it("leve le bras derriere la tete puis le fait vraiment retomber", () => {
    // ⚠️ On parcourt **les frames que la cuisson produit**, pas des avancements
    // choisis a la main : la premiere version de ce geste etalait la frappe
    // au-dela de la derniere frame, et la pioche ne touchait jamais le sol.
    const travail = GESTES.find((g) => g.cle === "travail")!;
    const bras = suite(travail, (a) => posture("travail", a, 0).brasAvant);

    expect(Math.min(...bras), "il ne leve jamais vraiment le bras").toBeLessThan(-2);
    // Le coup part franchement vers l'avant du vertical, sinon il tapote.
    expect(Math.max(...bras), "la pioche ne touche jamais le sol").toBeGreaterThan(0.3);
    // ⚠️ Et surtout : **la frappe est le point le plus avance du geste**, sur la
    // derniere frame, celle que l'evenement de son vise. Sans cette assertion, la
    // frame de recuperation peut passer devant elle et la boucle se lit a
    // l'envers — c'est arrive, et ca ne se voit pas frame par frame.
    expect(bras[bras.length - 1]).toBe(Math.max(...bras));
  });

  it("penche le buste en avant au moment de frapper, pas avant", () => {
    const travail = GESTES.find((g) => g.cle === "travail")!;
    const buste = suite(travail, (a) => posture("travail", a, 0).buste);
    expect(buste[buste.length - 1]!).toBeGreaterThan(buste[3]!);
  });

  it("ne met l'outil en main que pendant le travail", () => {
    // C'est ce qui fait qu'on lit *qui travaille*, pas seulement quel est son
    // metier (§4.30).
    for (const geste of GESTES) {
      const tient = posture(geste.cle, 0.5, 0).outil;
      expect(tient, geste.cle).toBe(geste.cle === "travail");
    }
  });

  it("contrebalance les bras et les jambes a la marche", () => {
    const pas = posture("marche", 0.25, 0);
    expect(Math.sign(pas.jambeAvant)).toBe(-Math.sign(pas.brasAvant - 0.12));
    expect(Math.sign(pas.jambeAvant)).toBe(-Math.sign(pas.jambeArriere));
  });

  it("voute et cerne celui qui s'use, sans toucher a son geste", () => {
    const neuf = posture("marche", 0.25, 0);
    const use = posture("marche", 0.25, 1);
    expect(use.buste).toBeGreaterThan(neuf.buste);
    // L'usure ne change pas l'amplitude du pas : c'est le corps qui change, pas
    // la facon de marcher.
    expect(use.jambeAvant).toBeCloseTo(neuf.jambeAvant);
  });

  it("plie vite et se redresse lentement quand il tousse", () => {
    const debut = posture("toux", 0, 0);
    const spasme = posture("toux", 0.33, 0);
    const fin = posture("toux", 1, 0);
    expect(spasme.buste).toBeGreaterThan(debut.buste + 0.28);
    expect(spasme.brasAvant).toBeLessThan(-1.4);
    expect(fin.buste).toBeCloseTo(debut.buste, 1);
  });

  it("porte l'evenement de son du geste, meme si rien ne l'ecoute", () => {
    // Cout aujourd'hui : zero. Le jour ou le bloc 10 branche les volumes, il n'y
    // a que des fichiers a poser (§4.30).
    const travail = GESTES.find((g) => g.cle === "travail");
    expect(travail?.evenement).toBe("pioche");
    expect(travail?.frameCle).toBe(travail!.frames - 1);
  });

  it("tient dans son carreau de 32", () => {
    const modele = villageois("villageois", { usure: 0, sang: 0 });
    expect(modele.taille).toBe(32);

    // Le vrai risque du dessin parametrique : un bras a 40 degres qui sort du
    // cadre. On dessine chaque frame et on verifie qu'aucun pixel ne touche le
    // bord — le contour n'aurait alors plus la place d'exister.
    const toile = new Toile(modele.taille, modele.taille);
    for (const geste of modele.gestes) {
      for (let i = 0; i < geste.frames; i += 1) {
        toile.effacer();
        modele.dessiner(toile, geste.cle, avancementDe(geste, i));
        const avant = toile.compterOpaques();
        toile.contour();
        expect(toile.compterOpaques(), `${geste.cle} ${i}`).toBeGreaterThan(avant);
        expect(toile.pixelsDuBord(), `${geste.cle} ${i} touche le bord`).toBe(0);
      }
    }
  });

  it("garde le meme cadrage quel que soit l'etat du corps", () => {
    // L'usure voute le personnage et le sang ajoute des pixels : ni l'un ni
    // l'autre n'a le droit de le faire sortir du carreau.
    for (const corps of [
      { usure: 1, sang: 0 },
      { usure: 0, sang: 1 },
      { usure: 1, sang: 1 },
    ]) {
      const modele = villageois("temoin", corps);
      const toile = new Toile(modele.taille, modele.taille);
      for (const geste of modele.gestes) {
        for (let i = 0; i < geste.frames; i += 1) {
          toile.effacer();
          modele.dessiner(toile, geste.cle, avancementDe(geste, i));
          toile.contour();
          expect(toile.pixelsDuBord(), `usure ${corps.usure} ${geste.cle} ${i}`).toBe(0);
        }
      }
    }
  });
});

/** Les valeurs d'un geste, frame par frame, telles que la cuisson les produira. */
function suite(geste: Geste, lire: (avancement: number) => number): number[] {
  return Array.from({ length: geste.frames }, (_, i) => lire(avancementDe(geste, i)));
}
