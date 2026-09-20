import { describe, expect, it } from "vitest";
import { Grille } from "./grille";
import {
  Battant,
  REGLAGES_PORTE,
  casesAtteintesDuDehors,
  centreDeCase,
  consigneDeNuit,
  enfermeraitSansPorte,
} from "./portes";

/**
 * Les portes du §4.20 (bloc 7b, 20 septembre 2026) : deux secondes pour
 * s'ouvrir, deux pour se fermer, et on ne se mure jamais sans porte.
 */
describe("Un battant — deux secondes dans chaque sens", () => {
  it("s'ouvre en 2 s et ne laisse passer qu'une fois entierement ouvert", () => {
    const b = new Battant(false);
    expect(b.laissePasser).toBe(false);
    b.ouvrir(1000);
    expect(b.phase).toBe("s-ouvre");
    expect(b.avancer(1000 + REGLAGES_PORTE.ouverture / 2)).toBe(false);
    expect(b.part(1000 + REGLAGES_PORTE.ouverture / 2)).toBeCloseTo(0.5);
    expect(b.laissePasser).toBe(false);
    expect(b.position(2000)).toBe("entrouverte");
    expect(b.avancer(1000 + REGLAGES_PORTE.ouverture)).toBe(true);
    expect(b.phase).toBe("ouverte");
    expect(b.laissePasser).toBe(true);
    expect(b.position(9999)).toBe("ouverte");
  });

  it("se referme en 2 s, et ne laisse plus passer des le premier instant", () => {
    const b = new Battant(true);
    b.fermer(5000);
    expect(b.laissePasser).toBe(false);
    expect(b.avancer(5000 + REGLAGES_PORTE.fermeture - 1)).toBe(false);
    expect(b.avancer(5000 + REGLAGES_PORTE.fermeture)).toBe(true);
    expect(b.phase).toBe("fermee");
    expect(b.position(9000)).toBe("fermee");
  });

  it("rouvre d'ou elle en est, sans repartir de zero", () => {
    const b = new Battant(true);
    b.fermer(0);
    // A mi-fermeture, on la rouvre : il ne lui reste qu'une seconde a faire.
    b.ouvrir(REGLAGES_PORTE.fermeture / 2);
    expect(b.part(REGLAGES_PORTE.fermeture / 2)).toBeCloseTo(0.5);
    expect(b.avancer(REGLAGES_PORTE.fermeture / 2 + REGLAGES_PORTE.ouverture / 2)).toBe(true);
    expect(b.phase).toBe("ouverte");
  });

  it("suit la pause : decaler repousse la fin du mouvement", () => {
    const b = new Battant(false);
    b.ouvrir(0);
    b.decaler(1000);
    expect(b.avancer(REGLAGES_PORTE.ouverture)).toBe(false);
    expect(b.avancer(REGLAGES_PORTE.ouverture + 1000)).toBe(true);
  });

  it("ne fait rien si on lui redemande ce qu'elle fait deja", () => {
    const b = new Battant(false);
    b.ouvrir(0);
    b.ouvrir(500);
    expect(b.depuis).toBe(0);
    const o = new Battant(true);
    o.ouvrir(3000);
    expect(o.phase).toBe("ouverte");
  });
});

describe("La consigne de nuit — ouvrir devant quelqu'un si aucun monstre n'est pres", () => {
  it("ouvre une porte fermee devant quelqu'un, sans menace", () => {
    expect(consigneDeNuit(new Battant(false), 0, true, false, -Infinity)).toBe("ouvrir");
  });

  it("reste close si un monstre est pres, meme devant quelqu'un", () => {
    expect(consigneDeNuit(new Battant(false), 0, true, true, -Infinity)).toBeNull();
  });

  it("referme aussitot qu'une menace approche d'une porte ouverte", () => {
    expect(consigneDeNuit(new Battant(true), 100, false, true, 100)).toBe("fermer");
    expect(consigneDeNuit(new Battant(true), 100, true, true, 100)).toBe("fermer");
  });

  it("referme apres l'attente quand plus personne ne demande, pas avant", () => {
    const b = new Battant(true);
    expect(consigneDeNuit(b, 1000, false, false, 1000)).toBeNull();
    expect(consigneDeNuit(b, 1000 + REGLAGES_PORTE.attente, false, false, 1000)).toBe("fermer");
  });

  it("ne redemande pas ce qui est en cours", () => {
    const b = new Battant(false);
    b.ouvrir(0);
    expect(consigneDeNuit(b, 10, true, false, 0)).toBeNull();
    const f = new Battant(true);
    f.fermer(0);
    expect(consigneDeNuit(f, 10_000, false, false, 0)).toBeNull();
  });
});

describe("On ne peut pas se murer sans porte (§4.20)", () => {
  /** Une case d'herbe loin de tout, et son voisinage, pour y tracer une enceinte. */
  function coinTranquille(grille: Grille): { colonne: number; ligne: number } {
    for (let ligne = 6; ligne < 30; ligne++) {
      for (let colonne = 20; colonne < 50; colonne++) {
        let ok = true;
        for (let dl = -2; dl <= 2 && ok; dl++) {
          for (let dc = -2; dc <= 2 && ok; dc++) {
            const c = grille.case(colonne + dc, ligne + dl);
            if (!c || c.terrain !== "herbe" || c.occupation !== "libre") ok = false;
          }
        }
        if (ok) return { colonne, ligne };
      }
    }
    throw new Error("pas de coin d'herbe libre pour le test");
  }

  const anneau = [
    [-1, -1],
    [0, -1],
    [1, -1],
    [1, 0],
    [1, 1],
    [0, 1],
    [-1, 1],
    [-1, 0],
  ] as const;

  it("refuse le dernier mur d'un anneau plein, et l'accepte s'il y a une porte", () => {
    const grille = new Grille();
    const { colonne, ligne } = coinTranquille(grille);
    for (const [dc, dl] of anneau.slice(0, 7)) {
      const c = centreDeCase(colonne + dc, ligne + dl);
      grille.poser(c.x, c.y, "mur");
    }
    const dernier = centreDeCase(colonne + anneau[7][0], ligne + anneau[7][1]);
    expect(enfermeraitSansPorte(grille, dernier.x, dernier.y)).toBe(true);

    // On remplace un des sept murs par une porte — sur un cote, pas dans un
    // angle : un angle ne touche l'interieur que par sa diagonale, et on ne
    // passe pas une porte en diagonale. Le dernier mur passe.
    const p = centreDeCase(colonne + anneau[1][0], ligne + anneau[1][1]);
    grille.poser(p.x, p.y, "porte");
    expect(enfermeraitSansPorte(grille, dernier.x, dernier.y)).toBe(false);
  });

  it("laisse poser une ligne droite, qui ne ferme rien", () => {
    const grille = new Grille();
    const { colonne, ligne } = coinTranquille(grille);
    for (let dc = -2; dc <= 1; dc++) {
      const c = centreDeCase(colonne + dc, ligne);
      grille.poser(c.x, c.y, "mur");
    }
    const suite = centreDeCase(colonne + 2, ligne);
    expect(enfermeraitSansPorte(grille, suite.x, suite.y)).toBe(false);
  });

  it("compte le dehors depuis le bord, et une case bouchee en retire au moins une", () => {
    const grille = new Grille();
    const { colonne, ligne } = coinTranquille(grille);
    const avant = casesAtteintesDuDehors(grille);
    expect(avant).toBeGreaterThan(1000);
    const c = centreDeCase(colonne, ligne);
    expect(enfermeraitSansPorte(grille, c.x, c.y)).toBe(false);
  });

  it("ne dit rien d'une case qui n'est pas praticable", () => {
    const grille = new Grille();
    // La mer, a l'ouest : on n'y pose rien, et ca ne ferme rien.
    expect(enfermeraitSansPorte(grille, 8, 600)).toBe(false);
  });
});
