import { describe, expect, it } from "vitest";
import {
  VERSION_SAUVEGARDE,
  capturerPersonne,
  comparer,
  decrire,
  ilYA,
  lire,
  resumer,
  restaurerPersonne,
  serialiser,
  taille,
  tientEnBase,
  type Sauvegarde,
} from "./sauvegarde";
import { creerPersonne, gagnerTrait, monterStress, REGLAGES_STRESS } from "./personne";
import { contracterEtat } from "./personne";
import { stocksVides } from "./habitants";
import { Rng } from "./rng";

/**
 * Ce qui se teste ici, c'est la promesse du §4.28 : **une sauvegarde fait un
 * aller-retour fidele**. Une sauvegarde qui perd un champ en silence ne casse
 * rien a la compilation et fait perdre quarante heures de jeu — c'est
 * exactement le genre de bug qu'aucun type ne voit passer.
 */

function sauvegardeMinimale(partiel: Partial<Sauvegarde> = {}): Sauvegarde {
  return {
    version: VERSION_SAUVEGARDE,
    partie: "p-1",
    revision: 1,
    horodatage: 1_000_000,
    dureeJouee: 0,
    rng: 12345,
    cycle: { jour: 1, phase: "jour", ecoule: 0 },
    stocks: stocksVides(),
    kills: 0,
    morts: [],
    habitants: [],
    heros: [],
    incarne: 0,
    eglise: { niveau: 1, etat: "debout", pv: 1200, avancement: 0 },
    constructions: [],
    champs: [],
    ...partiel,
  };
}

describe("l'aller-retour", () => {
  it("rend exactement ce qu'on lui a donne", () => {
    const avant = sauvegardeMinimale({
      cycle: { jour: 14, phase: "nuit", ecoule: 42_000 },
      stocks: { poisson: 12, ble: 5, bois: 130, minerai: 44 },
      kills: 807,
      constructions: [{ x: 100, y: 200, type: "tour", pv: 130 }],
      champs: [{ x: 700, y: 660, maturite: 0.5 }],
      eglise: { niveau: 3, etat: "relevement", pv: 0, avancement: 9000 },
    });

    const apres = lire(serialiser(avant));

    expect(apres.ok).toBe(true);
    if (!apres.ok) return;
    expect(apres.sauvegarde).toEqual(avant);
  });

  it("garde une personne entiere, traits temporaires et etats compris", () => {
    const personne = creerPersonne("Ysoret", new Rng(7));
    gagnerTrait(personne, "pyromane");
    contracterEtat(personne, "maladie");
    monterStress(personne, 40);
    personne.nomChoisi = true;
    personne.exploits.kills = 31;

    const etat = capturerPersonne(personne, 5_000);
    const relue = restaurerPersonne(JSON.parse(JSON.stringify(etat)), 9_000);

    expect(relue.nom).toBe("Ysoret");
    expect(relue.nomChoisi).toBe(true);
    expect(relue.traits).toEqual(personne.traits);
    expect(relue.sequelles).toEqual(personne.sequelles);
    expect(relue.etats).toEqual(personne.etats);
    expect(relue.stress).toBeCloseTo(personne.stress);
    expect(relue.exploits).toEqual(personne.exploits);
    expect(relue.grainePortrait).toBe(personne.grainePortrait);
    // La `Map` survit au JSON, qui ne connait pourtant pas les `Map`.
    expect([...relue.traitsTemporaires.entries()]).toEqual([
      ...personne.traitsTemporaires.entries(),
    ]);
  });

  it("refait l'agregat au lieu de le stocker", () => {
    const personne = creerPersonne("Merlin", new Rng(11));
    gagnerTrait(personne, "pyromane");

    const texte = serialiser(sauvegardeMinimale());
    expect(texte).not.toContain("mods");

    const relue = restaurerPersonne(capturerPersonne(personne, 0), 0);
    expect(relue.mods).toEqual(personne.mods);
  });

  it("ne laisse pas une rupture s'annuler en sauvegardant", () => {
    const personne = creerPersonne("Nine", new Rng(3));
    personne.rupture = "terreur";
    personne.ruptureJusqua = 30_000;

    // Sauvegarde a 20 s : il reste 10 s a tenir.
    const etat = capturerPersonne(personne, 20_000);
    expect(etat.ruptureRestante).toBe(10_000);

    // Reprise le lendemain, sur une horloge repartie de zero.
    const relue = restaurerPersonne(etat, 500);
    expect(relue.rupture).toBe("terreur");
    expect(relue.ruptureJusqua).toBe(10_500);
  });

  it("remet le stress a son plafond sans deborder", () => {
    const personne = creerPersonne("Aldric", new Rng(5));
    monterStress(personne, 10_000);
    expect(personne.stress).toBe(REGLAGES_STRESS.coeur);

    const relue = restaurerPersonne(capturerPersonne(personne, 0), 0);
    expect(relue.stress).toBe(REGLAGES_STRESS.coeur);
  });

  it("reprend la suite exacte du tirage", () => {
    const rng = new Rng(999);
    for (let i = 0; i < 20; i++) rng.next();

    const suite = new Rng(rng.instantane);
    expect(suite.next()).toBe(new Rng(rng.instantane).next());
  });
});

describe("la relecture", () => {
  it("refuse une sauvegarde plus recente que le code qui la lit", () => {
    const trop = serialiser(sauvegardeMinimale({ version: VERSION_SAUVEGARDE + 1 }));
    const lecture = lire(trop);

    expect(lecture.ok).toBe(false);
    if (lecture.ok) return;
    expect(lecture.raison).toBe("trop-recente");
    expect(lecture.message).toContain("plus recente");
  });

  it("ne jette jamais, meme sur du texte abime", () => {
    for (const texte of ["", "   ", "{", "null", "[]", "{\"version\":1}"]) {
      const lecture = lire(texte);
      expect(lecture.ok).toBe(false);
    }
  });

  it("traite l'absence de sauvegarde comme un cas normal", () => {
    const lecture = lire(null);
    expect(lecture.ok).toBe(false);
    if (lecture.ok) return;
    expect(lecture.raison).toBe("vide");
  });

  it("refuse une sauvegarde a laquelle il manque ses habitants", () => {
    const amputee = sauvegardeMinimale() as Partial<Sauvegarde>;
    delete amputee.habitants;

    const lecture = lire(JSON.stringify(amputee));
    expect(lecture.ok).toBe(false);
    if (lecture.ok) return;
    expect(lecture.raison).toBe("incomplete");
  });
});

describe("la taille", () => {
  it("compte des octets, pas des caracteres", () => {
    expect(taille("abc")).toBe(3);
    expect(taille("eee")).toBe(3);
    expect(taille("é")).toBe(2);
  });

  it("laisse passer une partie ordinaire", () => {
    expect(tientEnBase(serialiser(sauvegardeMinimale()))).toBe(true);
  });

  it("refuse ce qui deborde de la colonne", () => {
    const enorme = sauvegardeMinimale({ partie: "x".repeat(300 * 1024) });
    expect(tientEnBase(serialiser(enorme))).toBe(false);
  });
});

describe("la comparaison local/cloud", () => {
  const local = sauvegardeMinimale({
    partie: "p-1",
    revision: 10,
    cycle: { jour: 14, phase: "jour", ecoule: 0 },
  });

  it("ne dit rien quand il n'y a rien", () => {
    expect(comparer(null, null).genre).toBe("rien");
  });

  it("prend le cloud quand il n'y a pas de partie locale", () => {
    expect(comparer(null, local).genre).toBe("cloud-seul");
  });

  it("garde le local quand le cloud est vide", () => {
    expect(comparer(local, null).genre).toBe("local-seul");
  });

  it("reconnait deux copies de la meme revision", () => {
    expect(comparer(local, { ...local }).genre).toBe("identiques");
  });

  it("ecrase un cloud en retard sur la meme lignee, sans rien demander", () => {
    const cloud = sauvegardeMinimale({ partie: "p-1", revision: 4 });
    expect(comparer(local, cloud).genre).toBe("local-devant");
  });

  it("demande quand le cloud est devant : on a joue ailleurs", () => {
    const cloud = sauvegardeMinimale({ partie: "p-1", revision: 22 });
    expect(comparer(local, cloud).genre).toBe("conflit");
  });

  it("demande toujours quand ce sont deux parties differentes", () => {
    // Meme revision, mais rien a voir : un ecrasement automatique ici ferait
    // perdre une partie entiere.
    const cloud = sauvegardeMinimale({ partie: "p-2", revision: 10 });
    expect(comparer(local, cloud).genre).toBe("conflit");
  });
});

describe("ce qu'on met sous les yeux du joueur", () => {
  it("resume une partie sans la charger", () => {
    const sauvegarde = sauvegardeMinimale({
      cycle: { jour: 14, phase: "nuit", ecoule: 0 },
      habitants: [
        { vivant: true } as never,
        { vivant: true } as never,
        { vivant: false } as never,
      ],
    });

    const resume = resumer(sauvegarde);
    expect(resume.jour).toBe(14);
    // Les morts ne comptent pas : c'est la population, pas l'effectif d'origine.
    expect(resume.population).toBe(2);
    expect(resume.classe).toBe(null);
  });

  it("ecrit une phrase, pas un horodatage", () => {
    const resume = resumer(
      sauvegardeMinimale({
        horodatage: 0,
        cycle: { jour: 14, phase: "jour", ecoule: 0 },
        habitants: [{ vivant: true } as never],
      }),
    );

    expect(decrire(resume, 0)).toBe("jour 14, 1 habitant, a l'instant");
  });

  it("dit le temps ecoule en francais", () => {
    expect(ilYA(0, 30_000)).toBe("a l'instant");
    expect(ilYA(0, 3 * 60_000)).toBe("il y a 3 min");
    expect(ilYA(0, 2 * 3_600_000)).toBe("il y a 2 h");
    expect(ilYA(0, 26 * 3_600_000)).toBe("hier");
    expect(ilYA(0, 3 * 24 * 3_600_000)).toBe("il y a 3 jours");
  });
});
