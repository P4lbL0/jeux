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
import { PALIERS, familleDeHero, hero, palierDeRang, posture as postureHero } from "./heros";
import { VARIANTES, varianteDe } from "./sol";
import { MUR, SENS_MUR, cleMur, peindreMur, type SensMur } from "./batiments";
import { rebaser } from "./palette";
import { C } from "../ui/couleurs";
import { CLASSES, ORDRE_CLASSES, ORDRE_RANGS } from "../../core/classes";
import { CONSTRUCTIONS } from "../../core/constructions";

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

describe("Les couleurs de classe, rebasees dans le monde", () => {
  it("garde les sept distinctes les unes des autres", () => {
    // Elles n'ont qu'un travail : faire reconnaitre qui est qui a petite taille.
    // Deux classes qu'on confond, c'est un heros qu'on croit mort.
    const teintes = ORDRE_CLASSES.map((id) => ({ id, corps: rebaser(CLASSES[id].couleur).corps }));
    teintes.forEach((a, i) => {
      for (const b of teintes.slice(i + 1)) {
        expect(ecart(a.corps, b.corps), `${a.id} / ${b.id}`).toBeGreaterThan(24);
      }
    });
  });

  it("ne confond aucune classe avec une matiere du monde", () => {
    // ⚠️ Le cas qui a impose la mesure : a 0,55 de desaturation, l'Assassin
    // tombait sur la tunique du villageois. Un heros qu'on prend pour un
    // habitant, la nuit, c'est un heros qu'on laisse mourir.
    for (const id of ORDRE_CLASSES) {
      const teinte = rebaser(CLASSES[id].couleur).corps;
      for (const { nom, matiere } of MATIERES) {
        expect(ecart(teinte, matiere.corps), `${id} / ${nom}`).toBeGreaterThan(24);
      }
    }
  });

  it("assombrit et desature, sans jamais eclaircir", () => {
    for (const id of ORDRE_CLASSES) {
      const brut = CLASSES[id].couleur;
      expect(clarte(rebaser(brut).corps), id).toBeLessThan(clarte(brut));
    }
  });
});

describe("Les heros — un palier tous les deux rangs", () => {
  it("range les neuf rangs en cinq paliers, deux par deux", () => {
    const paliers = ORDRE_RANGS.map(palierDeRang);
    expect(paliers).toEqual([0, 0, 1, 1, 2, 2, 3, 3, 4]);
    expect(Math.max(...paliers)).toBe(PALIERS - 1);
  });

  it("donne au SSR un palier que personne d'autre n'atteint", () => {
    // Le rang le plus rare a la seule chose que l'argent n'achete pas ici :
    // une allure. Et c'est ce qui justifie de lui reserver le laiton (§4.10).
    const seuls = ORDRE_RANGS.filter((r) => palierDeRang(r) === PALIERS - 1);
    expect(seuls).toEqual(["SSR"]);
  });

  it("donne a chaque classe une famille de texture par palier", () => {
    const cles = new Set<string>();
    for (const classe of ORDRE_CLASSES) {
      for (let p = 0; p < PALIERS; p += 1) cles.add(familleDeHero(classe, p));
    }
    expect(cles.size).toBe(ORDRE_CLASSES.length * PALIERS);
  });

  it("porte les sept gestes que poses.ts attend d'une famille animee", () => {
    // Sans les sept, un heros dessine en code ne peut pas remplacer un PNG :
    // `declencher` et `animer` joueraient des cles qui n'existent pas.
    // ⚠️ `toux` en plus des sept : le §4.23 donne les maladies aux **personnes**,
    // pas aux habitants. Un heros qui attrape la fievre et ne le montre jamais
    // rendrait le systeme invisible sur la moitie du village.
    const attendus = [
      "repos",
      "marche",
      "attaque",
      "charge",
      "incantation",
      "touche",
      "mort",
      "toux",
    ];
    for (const classe of ORDRE_CLASSES) {
      const cles = hero(classe, 0).gestes.map((g) => g.cle);
      expect(cles, classe).toEqual(attendus);
    }
  });

  it("frappe vers l'avant, et le coup est le point le plus avance", () => {
    const attaque = hero("guerrier", 0).gestes.find((g) => g.cle === "attaque")!;
    const bras = suite(attaque, (a) => postureHero("attaque", a).brasAvant);
    expect(Math.min(...bras), "il n'arme jamais").toBeLessThan(-1.4);
    expect(bras[bras.length - 1]).toBe(Math.max(...bras));
  });

  it("lache son arme pour tousser, et seulement pour ca", () => {
    // Les deux mains sont prises, l'une devant la bouche.
    expect(postureHero("toux", 0.4).outil).toBe(false);
    expect(postureHero("attaque", 0.4).outil).toBe(true);
  });

  it("tousse exactement comme un villageois", () => {
    // Le geste vit dans `corps.ts` : si les deux divergeaient, le passage
    // villageois -> heros du bloc 9 se verrait a l'oeil.
    for (const t of [0, 0.33, 0.66, 1]) {
      expect(postureHero("toux", t).buste).toBeCloseTo(posture("toux", t, 0).buste);
      expect(postureHero("toux", t).brasAvant).toBeCloseTo(posture("toux", t, 0).brasAvant);
    }
  });

  it("garde l'arme en main meme en marchant", () => {
    // ⚠️ C'est l'inverse du villageois, dont l'outil n'est en main qu'au travail.
    // Un heros desarme qui traverse la place ne se distingue plus d'un habitant.
    expect(postureHero("marche", 0.3).outil).toBe(true);
    expect(postureHero("repos", 0.3).outil).toBe(true);
  });

  it("tient dans son carreau, pour les sept classes et les cinq paliers", () => {
    // 7 classes x 5 paliers x 7 gestes : c'est exactement la ou un dessin
    // parametrique casse, et jamais a la compilation.
    for (const classe of ORDRE_CLASSES) {
      for (let palier = 0; palier < PALIERS; palier += 1) {
        const modele = hero(classe, palier);
        const toile = new Toile(modele.taille, modele.taille);
        for (const geste of modele.gestes) {
          for (let i = 0; i < geste.frames; i += 1) {
            toile.effacer();
            modele.dessiner(toile, geste.cle, avancementDe(geste, i));
            toile.contour();
            expect(
              toile.pixelsDuBord(),
              `${classe} p${palier} ${geste.cle} ${i}`,
            ).toBe(0);
          }
        }
      }
    }
  });
});

describe("Les murs — trois dessins, et ils doivent se raccorder", () => {
  /** La premiere ligne opaque d'une colonne : le haut du mur a cet endroit. */
  function hautDuMur(toile: Toile, colonne: number): number {
    const lignes = toile.rendu().split("\n");
    return lignes.findIndex((ligne) => ligne[colonne] === "#" || ligne[colonne] === "X");
  }

  /** La premiere colonne opaque d'une ligne : le flanc gauche du mur. */
  function flancGauche(toile: Toile, ligne: number): number {
    const rendu = toile.rendu().split("\n")[ligne]!;
    return [...rendu].findIndex((c) => c === "#" || c === "X");
  }

  function peindre(sens: SensMur): Toile {
    const toile = new Toile(MUR[sens].largeur, MUR[sens].hauteur);
    peindreMur(toile, sens, "pierre");
    return toile;
  }

  it("dessine les trois sens, et aucun n'est le meme bloc tourne", () => {
    const rendus = SENS_MUR.map((sens) => peindre(sens).rendu());
    expect(new Set(rendus).size).toBe(SENS_MUR.length);
  });

  it("pose la face de l'angle sur la meme ligne que celle de l'est-ouest", () => {
    // ⚠️ Les deux carreaux n'ont pas la meme hauteur : ce qui doit coincider,
    // c'est la crete **une fois chacun centre sur sa case**. Sans cette mesure,
    // un coin decroche d'un ou deux pixels et ca ne se voit qu'en jouant.
    const angle = peindre("angle");
    const estOuest = peindre("est-ouest");
    const colonne = MUR.angle.largeur - 3;

    expect(hautDuMur(angle, colonne) - MUR.angle.hauteur / 2).toBe(
      hautDuMur(estOuest, colonne) - MUR["est-ouest"].hauteur / 2,
    );
  });

  it("centre le pilier de l'angle comme un carreau nord-sud", () => {
    const angle = peindre("angle");
    const nordSud = peindre("nord-sud");
    // Une ligne prise au milieu du pilier, sous la crete des deux carreaux.
    const ligne = Math.floor(MUR.angle.hauteur / 2);

    expect(flancGauche(angle, ligne) - MUR.angle.largeur / 2).toBe(
      flancGauche(nordSud, ligne) - MUR["nord-sud"].largeur / 2,
    );
  });

  it("garde la palissade du joueur sur la texture que la cuisson produit", () => {
    // Les deux vivent dans deux fichiers qui ne se connaissent pas : sans cette
    // mesure, renommer une cle laisse une palissade invisible en jeu.
    expect(CONSTRUCTIONS.palissade.texture).toBe(cleMur("est-ouest", "bois"));
  });
});

describe("Le sol", () => {
  it("choisit toujours la meme variante pour la meme case", () => {
    // ⚠️ Determine, jamais aleatoire : sinon le terrain change a chaque
    // rechargement de sauvegarde et deux captures ne se comparent plus.
    expect(varianteDe(12, 40)).toBe(varianteDe(12, 40));
    expect(varianteDe(-3, -9)).toBe(varianteDe(-3, -9));
  });

  it("ne rend jamais d'index hors des variantes, meme en negatif", () => {
    // En JavaScript `^` rend un entier **signe**, et `banque[-3]` vaut
    // `undefined` : c'est le bug qui a fait planter la fiche au bloc 5.
    for (let c = -50; c < 50; c += 1) {
      for (let l = -50; l < 50; l += 7) {
        const v = varianteDe(c, l);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThan(VARIANTES);
      }
    }
  });

  it("repartit les variantes au lieu d'en privilegier une", () => {
    // Un melangeur qui rend trois fois la meme valeur redonne le damier qu'on
    // vient de supprimer.
    const compte = new Array<number>(VARIANTES).fill(0);
    for (let c = 0; c < 60; c += 1) {
      for (let l = 0; l < 60; l += 1) compte[varianteDe(c, l)]! += 1;
    }
    for (const n of compte) expect(n).toBeGreaterThan((60 * 60) / VARIANTES / 2);
  });

  it("ne repete pas la meme variante sur deux cases voisines partout", () => {
    // C'est le defaut d'origine : un damier se voit meme avec quatre carreaux si
    // le choix suit une regularite. On compte les voisins identiques.
    let identiques = 0;
    for (let c = 0; c < 40; c += 1) {
      for (let l = 0; l < 40; l += 1) {
        if (varianteDe(c, l) === varianteDe(c + 1, l)) identiques += 1;
      }
    }
    // Au hasard pur on attendrait un quart. On refuse au-dela de la moitie.
    expect(identiques).toBeLessThan(40 * 40 * 0.5);
  });
});
