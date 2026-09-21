import { describe, expect, it } from "vitest";
import { MemoireDuVillage, REGLAGES_MEMOIRE, type GensDuJour } from "./memoire";
import { creerPersonne, type Personne } from "../core/personne";
import { Rng } from "../core/rng";
import { idTrait } from "../core/traits";
import { REGLAGES_RELATIONS } from "../core/relations";

/**
 * Le pont entre les regles et la partie (§4.26, bloc 11).
 *
 * ⚠️ Ce fichier vit dans `src/game/` mais **ne touche pas a Phaser** : c'est ce
 * qui permet de le tester sans navigateur, comme `ennemis.test.ts`.
 */

function quelquUn(nom: string, courage = 50): Personne {
  const p = creerPersonne(nom, new Rng(nom.length * 7 + 1));
  p.stats.courage = courage;
  return p;
}

function auPoste(personne: Personne, poste: string | null, kills = 0, sestBattu = false): GensDuJour {
  return { personne, poste, kills, sestBattu };
}

/** Un tirage qui ne sort jamais l'amour : on le teste a part. */
const jamais = (): number => 1;

describe("la journee qui passe", () => {
  it("rapproche ceux qui travaillent au meme poste", () => {
    const m = new MemoireDuVillage();
    const a = quelquUn("Alix");
    const b = quelquUn("Bertille");
    m.passerUneJournee([auPoste(a, "mine"), auPoste(b, "mine")], 2, jamais);
    expect(m.relations.lien(a.identite, b.identite)).toMatchObject({ type: "amitie" });
  });

  it("ne rapproche pas ceux qui sont a deux postes differents", () => {
    const m = new MemoireDuVillage();
    const a = quelquUn("Alix");
    const b = quelquUn("Bertille");
    m.passerUneJournee([auPoste(a, "mine"), auPoste(b, "foret")], 2, jamais);
    expect(m.relations.lien(a.identite, b.identite)).toBeNull();
  });

  it("ne rapproche personne de ceux qui n'ont pas de poste", () => {
    const m = new MemoireDuVillage();
    const a = quelquUn("Alix");
    const b = quelquUn("Bertille");
    m.passerUneJournee([auPoste(a, null), auPoste(b, null)], 2, jamais);
    expect(m.relations.lien(a.identite, b.identite)).toBeNull();
  });

  it("fait naitre du respect entre ceux qui ont tenu la meme nuit", () => {
    const m = new MemoireDuVillage();
    const a = quelquUn("Alix");
    const b = quelquUn("Bertille");
    m.passerUneJournee(
      [auPoste(a, null, 0, true), auPoste(b, null, 0, true)],
      2,
      jamais,
    );
    expect(m.relations.lien(a.identite, b.identite)).toMatchObject({ type: "respect" });
  });

  it("ne rapproche pas deux ennemis declares, meme cote a cote", () => {
    const m = new MemoireDuVillage();
    const a = quelquUn("Alix");
    const b = quelquUn("Bertille");
    m.relations.poser(a.identite, b.identite, "haine", REGLAGES_RELATIONS.plafond);
    m.passerUneJournee([auPoste(a, "mine"), auPoste(b, "mine")], 2, jamais);
    expect(m.relations.lien(a.identite, b.identite)?.type).toBe("haine");
  });

  it("fait naitre une rivalite entre les deux gros tueurs de la nuit", () => {
    const m = new MemoireDuVillage();
    const a = quelquUn("Alix");
    const b = quelquUn("Bertille");
    const c = quelquUn("Colin");
    const seuil = REGLAGES_MEMOIRE.killsPourUneRivalite;
    const annonces = m.passerUneJournee(
      [auPoste(a, null, seuil + 4, true), auPoste(b, null, seuil + 1, true), auPoste(c, null, 0)],
      2,
      jamais,
    );
    expect(m.relations.lien(a.identite, b.identite)?.type).toBe("rivalite");
    expect(annonces.join(" ")).toContain("Alix");
    // Celui qui n'a rien tue n'entre dans aucune rivalite.
    expect(m.relations.lien(a.identite, c.identite)).toBeNull();
  });

  it("n'annonce une rivalite qu'une fois, pas chaque nuit", () => {
    const m = new MemoireDuVillage();
    const a = quelquUn("Alix");
    const b = quelquUn("Bertille");
    const gens = [auPoste(a, null, 20, true), auPoste(b, null, 18, true)];
    expect(m.passerUneJournee(gens, 2, jamais)).toHaveLength(1);
    expect(m.passerUneJournee(gens, 3, jamais)).toHaveLength(0);
  });

  it("ne fait pas naitre de rivalite sans morts au compteur", () => {
    const m = new MemoireDuVillage();
    const a = quelquUn("Alix");
    const b = quelquUn("Bertille");
    m.passerUneJournee([auPoste(a, null, 1, true), auPoste(b, null, 1, true)], 2, jamais);
    expect(m.relations.lien(a.identite, b.identite)?.type).toBe("respect");
  });

  it("laisse une amitie forte devenir autre chose, rarement", () => {
    const m = new MemoireDuVillage();
    const a = quelquUn("Alix");
    const b = quelquUn("Bertille");
    m.relations.poser(a.identite, b.identite, "amitie", REGLAGES_MEMOIRE.amitiePourUnAmour);
    const annonces = m.passerUneJournee([auPoste(a, "mine"), auPoste(b, "mine")], 2, () => 0);
    expect(m.relations.lien(a.identite, b.identite)?.type).toBe("amour");
    expect(annonces.join(" ")).toContain("ne se quittent plus");
  });

  it("use les liens de ceux qui ne se sont pas vus", () => {
    const m = new MemoireDuVillage();
    const a = quelquUn("Alix");
    const b = quelquUn("Bertille");
    m.relations.poser(a.identite, b.identite, "amitie", 40, 1);
    m.passerUneJournee([auPoste(a, "mine"), auPoste(b, "foret")], 2, jamais);
    expect(m.relations.lien(a.identite, b.identite)!.intensite).toBe(
      40 - REGLAGES_RELATIONS.parJourSepares,
    );
  });
});

describe("une mort", () => {
  it("fait payer un ami deux fois plus, et lui laisse un souvenir qui reste", () => {
    const m = new MemoireDuVillage();
    const mort = quelquUn("Marc");
    const ami = quelquUn("Nine");
    m.relations.poser(mort.identite, ami.identite, "amitie", 80);

    m.mourir(mort, [ami], [ami], 17, null);
    expect(ami.stress).toBeGreaterThan(20);
    expect(ami.traits).toContain(idTrait("endeuille"));
    expect(ami.souvenirs[0]).toMatchObject({ cle: "a-perdu-un-proche", qui: "Marc" });
  });

  it("endurcit le courageux au lieu de le hanter", () => {
    const m = new MemoireDuVillage();
    const mort = quelquUn("Marc");
    const brave = quelquUn("Gauvain", 80);
    m.relations.poser(mort.identite, brave.identite, "amitie", 80);
    m.mourir(mort, [brave], [brave], 17, null);
    expect(brave.traits).toContain(idTrait("aguerri"));
  });

  it("ne marque pas celui pour qui le mort n'etait personne", () => {
    const m = new MemoireDuVillage();
    const mort = quelquUn("Marc");
    const passant = quelquUn("Colin");
    m.mourir(mort, [passant], [passant], 5, null);
    expect(passant.traits).not.toContain(idTrait("endeuille"));
    expect(passant.souvenirs[0]).toMatchObject({ cle: "a-vu-mourir", qui: "Marc" });
  });

  it("emporte les liens du mort", () => {
    const m = new MemoireDuVillage();
    const mort = quelquUn("Marc");
    const ami = quelquUn("Nine");
    m.relations.poser(mort.identite, ami.identite, "amitie", 80);
    m.mourir(mort, [ami], [ami], 17, null);
    expect(m.relations.lesLiensDe(mort.identite)).toHaveLength(0);
  });

  it("laisse sa competence a son proche, en attente d'etre choisie", () => {
    const m = new MemoireDuVillage();
    const mort = quelquUn("Marc");
    const frere = quelquUn("Eudes");
    m.relations.poser(mort.identite, frere.identite, "famille", 60);

    const deuil = m.mourir(mort, [frere], [frere], 17, "dernier-rempart");
    expect(deuil.heritier).toBe(frere.identite);
    expect(m.legsDe(frere.identite)).toEqual({ de: "Marc", competence: "dernier-rempart" });
  });

  it("donne le trait et le souvenir au moment ou l'heritage est pris", () => {
    const m = new MemoireDuVillage();
    const mort = quelquUn("Marc");
    const frere = quelquUn("Eudes");
    m.relations.poser(mort.identite, frere.identite, "famille", 60);
    m.mourir(mort, [frere], [frere], 17, "dernier-rempart");

    // Tant qu'on ne l'a pas pris, rien n'est donne : c'est un arbitrage.
    expect(frere.traits).not.toContain(idTrait("heritier"));
    const pris = m.prendreLeLegs(frere, 18);
    expect(pris?.competence).toBe("dernier-rempart");
    expect(frere.traits).toContain(idTrait("heritier"));
    expect(frere.souvenirs.some((s) => s.cle === "a-herite")).toBe(true);
    // Et il ne se prend pas deux fois.
    expect(m.prendreLeLegs(frere, 19)).toBeNull();
  });

  it("n'inscrit aux archives que les morts qui laissaient quelqu'un", () => {
    const m = new MemoireDuVillage();
    const inconnu = quelquUn("Colin");
    const passant = quelquUn("Alix");
    expect(m.mourir(inconnu, [passant], [passant], 5, null).evenement).toBeNull();
    expect(m.archives.tout).toHaveLength(0);

    const aime = quelquUn("Marc");
    m.relations.poser(aime.identite, passant.identite, "amitie", 60);
    expect(m.mourir(aime, [passant], [passant], 6, null).evenement).not.toBeNull();
    expect(m.archives.tout).toHaveLength(1);
  });
});

describe("les autres evenements", () => {
  it("cree une dette chez celui qu'on ramene", () => {
    const m = new MemoireDuVillage();
    const sauve = quelquUn("Nine");
    const sauveur = quelquUn("Gauvain");
    m.sauvetage(sauve, sauveur, 4);
    expect(m.relations.lien(sauve.identite, sauveur.identite)?.type).toBe("dette");
    expect(sauve.souvenirs[0]).toMatchObject({ cle: "a-ete-sauve", qui: "Gauvain" });
    expect(sauveur.souvenirs[0]).toMatchObject({ cle: "a-sauve", qui: "Nine" });
  });

  it("fait craindre celui qui craque", () => {
    const m = new MemoireDuVillage();
    const fou = quelquUn("Firmin");
    const temoin = quelquUn("Alix");
    m.rage(fou, [temoin], 6);
    expect(m.relations.lien(temoin.identite, fou.identite)?.type).toBe("peur");
    expect(fou.souvenirs[0]?.cle).toBe("a-craque");
  });

  it("fait admirer celui dont le don s'eveille", () => {
    const m = new MemoireDuVillage();
    const elu = quelquUn("Merlin");
    const temoin = quelquUn("Alix");
    m.eveil(elu, [temoin], 9);
    expect(m.relations.lien(temoin.identite, elu.identite)?.type).toBe("admiration");
    expect(elu.souvenirs[0]?.cle).toBe("s-est-eveille");
  });
});

describe("la sauvegarde", () => {
  it("se relit a l'identique", () => {
    const m = new MemoireDuVillage();
    const a = quelquUn("Alix");
    const b = quelquUn("Bertille");
    m.relations.poser(a.identite, b.identite, "amitie", 40, 3);
    m.inscrire({ type: "famine", jour: 3, combien: 5 });

    const relu = new MemoireDuVillage();
    const { relations, archives } = m.exporter();
    relu.importer(relations, archives, 3);
    expect(relu.relations.lien(a.identite, b.identite)?.intensite).toBe(40);
    expect(relu.archives.tout).toHaveLength(1);
    expect(relu.archives.effets.satisfaction).toBeLessThan(0);
  });

  it("repart intacte quand la sauvegarde n'en portait pas", () => {
    const relu = new MemoireDuVillage();
    relu.importer(undefined, undefined, 1);
    expect(relu.relations.taille).toBe(0);
    expect(relu.archives.tout).toHaveLength(0);
  });
});

describe("le cout, une fois par jour et jamais par image", () => {
  it("tient une passe d'aube sur trente habitants sans exploser", () => {
    const m = new MemoireDuVillage();
    const gens = Array.from({ length: 30 }, (_, i) =>
      auPoste(quelquUn(`n${i}`), `poste${i % 4}`, 0, i % 3 === 0),
    );
    const debut = performance.now();
    for (let jour = 2; jour <= 60; jour++) m.passerUneJournee(gens, jour, jamais);
    // Soixante journees de village plein : le budget est large, c'est la borne
    // qui compte — rien ici ne doit ramper quand la partie s'allonge.
    expect(performance.now() - debut).toBeLessThan(500);
    expect(m.relations.taille).toBeLessThanOrEqual(600);
  });
});
