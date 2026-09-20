import { describe, expect, it } from "vitest";
import { Grille } from "./grille";
import {
  Battant,
  REGLAGES_PORTE,
  casesAtteintesDuDehors,
  centreDeCase,
  consigneDeNuit,
  enfermeraitSansPorte,
  noieraitSansPassage,
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

/**
 * Les douves autour d'un village (§4.20, 20 septembre 2026) : une douve en
 * eau ferme comme un mur, sauf contre une porte — un pont-levis possible.
 * Eprouve en configurations, autour d'un carre de murs sur l'herbe, loin de
 * tout, comme pour la regle du mur.
 */
describe("Les douves — on ne se noie pas sans passage", () => {
  /** Un carre de murs de rayon `r` cases autour de (c, l), avec une porte au nord. */
  function fort(grille: Grille, c: number, l: number, r: number): void {
    for (let dl = -r; dl <= r; dl++) {
      for (let dc = -r; dc <= r; dc++) {
        if (Math.max(Math.abs(dc), Math.abs(dl)) !== r) continue;
        const p = centreDeCase(c + dc, l + dl);
        grille.poser(p.x, p.y, dc === 0 && dl === -r ? "porte" : "mur");
      }
    }
  }
  /** Un anneau de douves seches de rayon `r`, en laissant `trous` cases vides. */
  function douves(grille: Grille, c: number, l: number, r: number, trous: [number, number][] = []): [number, number][] {
    const posees: [number, number][] = [];
    for (let dl = -r; dl <= r; dl++) {
      for (let dc = -r; dc <= r; dc++) {
        if (Math.max(Math.abs(dc), Math.abs(dl)) !== r) continue;
        if (trous.some(([tc, tl]) => tc === dc && tl === dl)) continue;
        const p = centreDeCase(c + dc, l + dl);
        grille.poser(p.x, p.y, "douve");
        posees.push([c + dc, l + dl]);
      }
    }
    return posees;
  }
  // Un coin d'herbe du monde classique, loin du village : colonne 35, ligne 12.
  const C = 35;
  const L = 12;

  it("laisse mettre en eau une douve seche qui ne ferme rien", () => {
    const grille = new Grille();
    const p = centreDeCase(C, L);
    grille.poser(p.x, p.y, "douve");
    expect(noieraitSansPassage(grille, p.x, p.y)).toBe(false);
  });

  it("refuse la derniere mise en eau d'un anneau sans porte contre lui", () => {
    const grille = new Grille();
    fort(grille, C, L, 2);
    // L'anneau de douves a deux cases du mur : aucune porte ne le touche.
    const anneau = douves(grille, C, L, 4);
    // Tout en eau sauf une, au milieu d'un cote — un angle ne relie rien, on
    // ne passe pas en diagonale.
    const dc = C + 4;
    const dl = L;
    for (const [c, l] of anneau) {
      if (c === dc && l === dl) continue;
      const p = centreDeCase(c, l);
      grille.poser(p.x, p.y, "douve-eau");
    }
    const derniere = centreDeCase(dc, dl);
    expect(noieraitSansPassage(grille, derniere.x, derniere.y)).toBe(true);
    // Et une douve seche a la place : on passe, lentement — ca ne ferme rien.
    expect(casesAtteintesDuDehors(grille)).toBeGreaterThan(casesAtteintesDuDehors(grille, -1, dl * 63 + dc));
  });

  it("accepte l'anneau complet quand une douve touche la porte : le pont-levis passera", () => {
    const grille = new Grille();
    fort(grille, C, L, 2);
    // L'anneau colle au mur : la douve du nord touche la porte.
    const anneau = douves(grille, C, L, 3);
    for (const [c, l] of anneau) {
      const p = centreDeCase(c, l);
      expect(noieraitSansPassage(grille, p.x, p.y), `${c},${l}`).toBe(false);
      grille.poser(p.x, p.y, "douve-eau");
    }
    // Le dedans reste atteint du dehors : par la porte, puis la douve devant elle.
    const dedans = centreDeCase(C, L);
    const avant = casesAtteintesDuDehors(grille);
    grille.poser(dedans.x, dedans.y, "mur");
    expect(avant - casesAtteintesDuDehors(grille)).toBe(1);
  });

  it("refuse le mur qui fermerait l'enceinte quand la seule porte est murree par l'eau", () => {
    const grille = new Grille();
    fort(grille, C, L, 2);
    // Une douve en eau devant la porte, mais aussi sur les cotes : la porte
    // ne mene qu'a la douve, et la douve touche la porte — c'est un passage.
    const devant = centreDeCase(C, L - 3);
    grille.poser(devant.x, devant.y, "douve-eau");
    // Boucher la porte elle-meme par un mur : ca ferme sans porte.
    const porte = centreDeCase(C, L - 2);
    expect(enfermeraitSansPorte(grille, porte.x, porte.y)).toBe(true);
  });

  it("ne compte pas une douve seche comme un mur", () => {
    const grille = new Grille();
    fort(grille, C, L, 2);
    // Un anneau sec, complet, sans aucune porte contre lui : on passe quand meme.
    douves(grille, C, L, 4);
    const avant = casesAtteintesDuDehors(grille);
    const dedans = centreDeCase(C + 1, L + 1);
    grille.poser(dedans.x, dedans.y, "mur");
    expect(avant - casesAtteintesDuDehors(grille)).toBe(1);
  });
});
