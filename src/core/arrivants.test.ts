import { describe, expect, it } from "vitest";
import {
  ACTE_PAR_DEGRE,
  accueillir,
  actesDeLaNuit,
  creerArrivant,
  delaiEntreArrivees,
  poser,
  prochaineArrivee,
  QUESTIONS,
  REGLAGES_ARRIVEES,
  replanifier,
  reponseA,
  reputation,
  traitsVisibles,
  victimeDe,
  type Arrivant,
  type DegreFolie,
  type Fou,
} from "./arrivants";
import { idTrait } from "./traits";
import { PRENOMS } from "./personne";
import { Rng } from "./rng";

/**
 * Un tirage impose : `jamais` ne tire jamais l'incendie du degre 3, `toujours`
 * le tire a tous les coups (§4.21). Les deux servent a fixer l'acte d'une nuit
 * sans dependre d'une graine.
 */
class RngFixe extends Rng {
  constructor(private readonly valeur: number) {
    super(0);
  }

  override next(): number {
    return this.valeur;
  }
}

const jamais = () => new RngFixe(0.99);
const toujours = () => new RngFixe(0);

/** Un echantillon d'arrivants, pour tout ce qui ne se juge que sur le nombre. */
function echantillon(combien: number, graine = 1): Arrivant[] {
  const rng = new Rng(graine);
  return Array.from({ length: combien }, (_, i) => creerArrivant(rng, i + 1));
}

function alarmantes(arrivant: Arrivant): number {
  return arrivant.observations.filter((o) => o.alarmante).length;
}

describe("La porte — la fiche d'observation", () => {
  it("montre toujours trois lignes, une par axe distinct", () => {
    for (const arrivant of echantillon(200)) {
      expect(arrivant.observations).toHaveLength(REGLAGES_ARRIVEES.lignes);
      const axes = arrivant.observations.map((o) => o.axe);
      expect(new Set(axes).size).toBe(REGLAGES_ARRIVEES.lignes);
    }
  });

  it("tire quatre questions distinctes", () => {
    for (const arrivant of echantillon(200)) {
      expect(arrivant.questions).toHaveLength(REGLAGES_ARRIVEES.questionsTirees);
      expect(new Set(arrivant.questions.map((q) => q.cle)).size).toBe(
        REGLAGES_ARRIVEES.questionsTirees,
      );
    }
  });

  it("ne pose jamais deux fois la meme question sur deux arrivants differents", () => {
    // La banque doit etre assez grande pour que deux portes de suite ne se
    // ressemblent pas : c'est tout l'interet du tirage (§4.10).
    const vus = new Set(echantillon(40).flatMap((a) => a.questions.map((q) => q.cle)));
    expect(vus.size).toBeGreaterThan(REGLAGES_ARRIVEES.questionsTirees * 2);
  });

  it("ne reprend jamais un prenom que le village porte deja", () => {
    // Vu en jouant : trois arrivees d'affilee avaient donne deux Merlin.
    const pris = ["Aubin", "Nine", "Gaspard"];
    const rng = new Rng(13);
    for (let i = 0; i < 200; i++) {
      expect(pris).not.toContain(creerArrivant(rng, 1, pris).personne.nom);
    }
  });

  it("accepte quand meme quelqu'un quand tous les prenoms sont pris", () => {
    // Un village de trente personnes finira par avoir deux Colin, et c'est la
    // vie : ce qu'il ne faut pas, c'est que la porte se bloque.
    const arrivant = creerArrivant(new Rng(2), 1, PRENOMS);
    expect(arrivant.personne.nom.length).toBeGreaterThan(0);
  });

  it("remplace l'outil par celui du metier pretendu", () => {
    for (const arrivant of echantillon(100)) {
      const mains = arrivant.observations.find((o) => o.axe === "mains");
      if (mains === undefined) continue;
      expect(mains.texte).not.toContain("{outil}");
    }
  });

  it("tient les bornes du §4.18 : 0 a 2 pour un innocent, 1 a 3 pour un fou", () => {
    for (const arrivant of echantillon(600)) {
      const compte = alarmantes(arrivant);
      if (arrivant.folie === 0) expect(compte).toBeLessThanOrEqual(2);
      else expect(compte).toBeGreaterThanOrEqual(1);
      expect(compte).toBeLessThanOrEqual(3);
    }
  });

  it("laisse le doute sur un et deux signaux, et ne tranche qu'aux extremites", () => {
    // Le coeur du systeme : compter les lignes ne doit **pas** suffire. Sans
    // recouvrement, la porte cesse d'etre une decision au bout de deux parties.
    const lot = echantillon(3000, 21);
    const partDeFous = (compte: number) => {
      const groupe = lot.filter((a) => alarmantes(a) === compte);
      return groupe.filter((a) => a.folie > 0).length / groupe.length;
    };

    expect(partDeFous(0)).toBe(0); // zero signal innocente
    expect(partDeFous(3)).toBe(1); // trois signaux accusent
    // Entre les deux, on doute vraiment — et deux signaux inquietent plus qu'un.
    expect(partDeFous(1)).toBeGreaterThan(0.05);
    expect(partDeFous(1)).toBeLessThan(0.35);
    expect(partDeFous(2)).toBeGreaterThan(partDeFous(1));
    expect(partDeFous(2)).toBeLessThan(0.7);
  });

  it("laisse deux ou trois fous sur dix arrivants", () => {
    const lot = echantillon(2000, 7);
    const part = lot.filter((a) => a.folie > 0).length / lot.length;
    expect(part).toBeGreaterThan(0.18);
    expect(part).toBeLessThan(0.33);
  });

  it("fait pencher les indices avec le degre, sans jamais le dire", () => {
    const lot = echantillon(3000, 11);
    const troisSignaux = (degre: DegreFolie) => {
      const groupe = lot.filter((a) => a.folie === degre);
      return groupe.filter((a) => alarmantes(a) === 3).length / groupe.length;
    };

    // Le meurtrier montre plus souvent trois signaux que le voleur...
    expect(troisSignaux(3)).toBeGreaterThan(troisSignaux(1));
    // ...mais un voleur en montre trois de temps en temps : le doute tient.
    expect(troisSignaux(1)).toBeGreaterThan(0);
    expect(troisSignaux(3)).toBeLessThan(1);
  });

  it("ne montre a la porte que des traits de naissance visibles", () => {
    const invisibles = [idTrait("chanceux"), idTrait("sang-froid"), idTrait("hemophile")];
    for (const arrivant of echantillon(300)) {
      for (const id of traitsVisibles(arrivant)) {
        expect(invisibles).not.toContain(id);
        expect(arrivant.personne.traits).toContain(id);
      }
    }
  });
});

describe("La porte — les questions", () => {
  it("rend toujours la meme reponse a la meme question", () => {
    const arrivant = creerArrivant(new Rng(42), 1);
    for (const question of arrivant.questions) {
      const premiere = reponseA(arrivant, question);
      const seconde = reponseA(arrivant, question);
      expect(seconde).toEqual(premiere);
    }
  });

  it("repond de facon evasive sur un axe trouble, franche ailleurs", () => {
    const arrivant = creerArrivant(new Rng(3), 1);
    for (const question of QUESTIONS) {
      const attendu = arrivant.axesTroubles.includes(question.axe)
        ? question.evasive
        : question.franche;
      expect(reponseA(arrivant, question).texte).toBe(attendu);
    }
  });

  it("ne se trahit que s'il ment, et jamais quand son corps ne le trahit pas", () => {
    for (const arrivant of echantillon(300)) {
      for (const question of arrivant.questions) {
        const { ment, trahi } = reponseA(arrivant, question);
        if (!ment) expect(trahi).toBe(false);
        if (!arrivant.seTrahit) expect(trahi).toBe(false);
      }
    }
  });

  it("laisse un innocent avoir quelque chose a cacher, mais rarement", () => {
    const lot = echantillon(1500, 5).filter((a) => a.folie === 0);
    const menteurs = lot.filter((a) => a.axesTroubles.length > 0).length / lot.length;
    expect(menteurs).toBeGreaterThan(0);
    // Sinon toute reponse evasive vaudrait preuve, et le doute disparaitrait.
    expect(menteurs).toBeLessThan(0.7);
  });

  it("ne repond qu'une fois a chaque question", () => {
    const arrivant = creerArrivant(new Rng(9), 1);
    const cle = arrivant.questions[0]!.cle;
    expect(poser(arrivant, cle)).not.toBeNull();
    expect(poser(arrivant, cle)).toBeNull();
    expect(arrivant.posees).toEqual([cle]);
  });

  it("refuse une question qui n'a pas ete tiree pour lui", () => {
    const arrivant = creerArrivant(new Rng(9), 1);
    const absente = QUESTIONS.find((q) => !arrivant.questions.includes(q))!;
    expect(poser(arrivant, absente.cle)).toBeNull();
  });
});

describe("La reputation", () => {
  it("part de la satisfaction et retranche les morts recents", () => {
    expect(reputation(70, [], 10)).toBe(70);
    expect(reputation(70, [9], 10)).toBe(70 - REGLAGES_ARRIVEES.parMortRecent);
  });

  it("retient un mort plus longtemps que la satisfaction ne le pleure", () => {
    // Quatre journees : la satisfaction a deja oublie (3), la rumeur non (8).
    expect(reputation(70, [6], 10)).toBeLessThan(70);
    // Neuf journees : la rumeur oublie a son tour.
    expect(reputation(70, [1], 10)).toBe(70);
  });

  it("reste entre 0 et 100", () => {
    expect(reputation(10, [9, 9, 9, 9, 9], 10)).toBe(0);
    expect(reputation(100, [], 10)).toBe(100);
  });

  it("tarit les arrivees sous le seuil, et les presse au-dessus", () => {
    expect(delaiEntreArrivees(10)).toBeNull();
    expect(delaiEntreArrivees(90)).toBe(REGLAGES_ARRIVEES.delaiALAffluence);

    const moyen = delaiEntreArrivees(50)!;
    expect(moyen).toBeGreaterThanOrEqual(2);
    expect(moyen).toBeLessThanOrEqual(3);
  });

  it("ne donne aucune date quand plus personne ne vient", () => {
    expect(prochaineArrivee(10, 5, new Rng(1))).toBeNull();
  });

  it("place toujours la prochaine arrivee dans le futur", () => {
    const rng = new Rng(4);
    for (let i = 0; i < 200; i++) {
      const journee = prochaineArrivee(50, 12, rng);
      expect(journee).not.toBeNull();
      expect(journee!).toBeGreaterThan(12);
    }
  });
});

describe("Les fous", () => {
  const fou = (degre: 1 | 2 | 3, arrivee: number, acte: number): Fou => ({
    id: degre * 100 + arrivee,
    degre,
    journeeDArrivee: arrivee,
    journeeDeLActe: acte,
  });

  it("ne suit personne quand l'arrivant est innocent", () => {
    const arrivant = creerArrivant(new Rng(1), 1);
    arrivant.folie = 0;
    expect(accueillir(arrivant, 7, 3, new Rng(1))).toBeNull();
  });

  it("laisse toujours au moins une journee d'installation", () => {
    const arrivant = creerArrivant(new Rng(1), 1);
    arrivant.folie = 3;
    const rng = new Rng(2);
    for (let i = 0; i < 100; i++) {
      const suivi = accueillir(arrivant, 7, 5, rng)!;
      expect(suivi.journeeDeLActe).toBeGreaterThanOrEqual(5 + REGLAGES_ARRIVEES.installation.min);
      expect(suivi.journeeDeLActe).toBeLessThanOrEqual(5 + REGLAGES_ARRIVEES.installation.max);
    }
  });

  it("ne frappe jamais le jour de son arrivee", () => {
    // Meme avec une echeance absurde, celui qui vient d'entrer ne fait rien.
    expect(actesDeLaNuit([fou(3, 4, 4)], 4, jamais())).toEqual([]);
  });

  it("frappe quand son echeance arrive, avec l'acte de son degre", () => {
    const seul = fou(2, 1, 3);
    const actes = actesDeLaNuit([seul], 3, jamais());
    expect(actes).toHaveLength(1);
    expect(actes[0]!.acte).toBe(ACTE_PAR_DEGRE[2]);
  });

  it("ne fait rien tant qu'aucune echeance n'est venue", () => {
    expect(actesDeLaNuit([fou(1, 1, 8), fou(2, 1, 9)], 5, jamais())).toEqual([]);
  });

  it("a deux, chacun frappe son tour", () => {
    const actes = actesDeLaNuit([fou(1, 1, 5), fou(2, 1, 12)], 5, jamais());
    expect(actes).toHaveLength(1);
    expect(actes[0]!.fou.degre).toBe(1);
  });

  it("a trois, ils frappent tous la meme nuit, chacun son acte", () => {
    const groupe = [fou(1, 1, 5), fou(2, 1, 12), fou(3, 2, 20)];
    const actes = actesDeLaNuit(groupe, 5, jamais());
    expect(actes).toHaveLength(3);
    expect(actes.map((a) => a.acte).sort()).toEqual(["breche", "meurtre", "vol"]);
  });

  it("n'entraine pas dans le groupe celui qui vient d'arriver", () => {
    // Trois installes : le groupe frappe. Le quatrieme est entre ce matin, et
    // le §4.18 lui laisse sa journee quoi qu'il arrive autour de lui.
    const nouveau = fou(1, 5, 6);
    const actes = actesDeLaNuit([fou(1, 1, 5), fou(2, 1, 12), fou(3, 2, 20), nouveau], 5, jamais());
    expect(actes).toHaveLength(3);
    expect(actes.map((a) => a.fou)).not.toContain(nouveau);
  });

  it("fait bruler le degre 3 au lieu de tuer, une nuit sur deux", () => {
    const seul = fou(3, 1, 3);
    expect(actesDeLaNuit([seul], 3, toujours())[0]!.acte).toBe("incendie");
    expect(actesDeLaNuit([seul], 3, jamais())[0]!.acte).toBe("meurtre");
  });

  it("ne fait jamais bruler les degres 1 et 2, meme quand le tirage le voudrait", () => {
    expect(actesDeLaNuit([fou(1, 1, 3)], 3, toujours())[0]!.acte).toBe("vol");
    expect(actesDeLaNuit([fou(2, 1, 3)], 3, toujours())[0]!.acte).toBe("breche");
  });

  it("fait partir le voleur et rester les autres", () => {
    const voleur = fou(1, 1, 5);
    expect(replanifier(voleur, 5, new Rng(1))).toBe(false);

    const meurtrier = fou(3, 1, 5);
    expect(replanifier(meurtrier, 5, new Rng(1))).toBe(true);
    expect(meurtrier.journeeDeLActe).toBeGreaterThanOrEqual(5 + REGLAGES_ARRIVEES.recidive.min);
    expect(meurtrier.journeeDeLActe).toBeLessThanOrEqual(5 + REGLAGES_ARRIVEES.recidive.max);
  });

  it("ne tue ni lui-meme ni un autre fou", () => {
    const meurtrier = fou(3, 1, 5);
    const complice = fou(1, 1, 5);
    const rng = new Rng(6);
    for (let i = 0; i < 100; i++) {
      const victime = victimeDe(meurtrier, [meurtrier.id, complice.id, 42, 43], [meurtrier, complice], rng);
      expect([42, 43]).toContain(victime);
    }
  });

  it("ne tue personne quand il n'y a personne d'autre", () => {
    const seul = fou(3, 1, 5);
    expect(victimeDe(seul, [seul.id], [seul], new Rng(1))).toBeNull();
  });
});

describe("Les mots de la route (§4.31)", () => {
  it("ne parle ni d'eglise, ni d'habitants, ni de nuit quand on est sur la route", () => {
    // ⚠️ On rencontre quelqu'un au milieu d'une plaine : sa fiche ne peut pas
    // dire « il est entre a l'eglise » ni « il ne connait personne ici ». Le
    // cycle est meme a l'arret tant qu'on marche (§4.29), donc « en pleine
    // nuit » ne veut rien dire non plus.
    const interdits = ["eglise", "chapelle", "habitant", "en pleine nuit", "a la porte"];
    for (let g = 0; g < 400; g++) {
      const a = creerArrivant(new Rng(g), 0, [], true);
      for (const ligne of a.observations) {
        for (const mot of interdits) expect(ligne.texte.toLowerCase()).not.toContain(mot);
      }
      for (const q of a.questions) {
        expect(q.texte.toLowerCase()).not.toContain("eglise");
        expect(q.franche.toLowerCase()).not.toContain("chapelle");
      }
    }
  });

  it("garde la meme part de fous : seuls les mots changent", () => {
    // La route ne doit pas etre plus sure que la porte. C'est le meme tirage,
    // au meme rang du meme generateur — sinon on aurait fabrique deux systemes.
    for (let g = 0; g < 200; g++) {
      const village = creerArrivant(new Rng(g), 0, [], false);
      const route = creerArrivant(new Rng(g), 0, [], true);
      expect(route.folie).toBe(village.folie);
      expect(route.axesTroubles).toEqual(village.axesTroubles);
      expect(route.observations.map((o) => o.alarmante)).toEqual(
        village.observations.map((o) => o.alarmante),
      );
      expect(route.questions.map((q) => q.cle)).toEqual(village.questions.map((q) => q.cle));
    }
  });
});
