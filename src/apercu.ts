import Phaser from "phaser";
import "./police.css";
import { POLICE, T as TONS } from "./game/ui/chrome";
import { C } from "./game/ui/couleurs";
import { MATIERES, SOL_CENDRE, SOL_VERT, type Matiere } from "./game/dessin/palette";
import { cuire } from "./game/dessin/four";
import { Toile } from "./game/dessin/pinceau";
import { villageois } from "./game/dessin/villageois";

/**
 * La planche de controle du socle (DESIGN.md §4.30).
 *
 * **Elle n'est pas un confort, elle est la seule facon de juger ce bloc.** Une
 * compilation qui passe ne prouve rien d'un dessin : la planche de propositions
 * du 11 aout a ete refaite deux fois, et les deux fois le defaut ne se voyait
 * qu'a l'oeil.
 *
 * Elle porte trois choses, dans cet ordre d'importance :
 *
 * 1. **Les treize matieres**, avec leurs trois valeurs, pour verifier d'un coup
 *    d'oeil qu'aucune n'en double une autre.
 * 2. **Les gestes du villageois**, une ligne chacun : le sprite a sa vraie
 *    taille, le meme agrandi, puis chaque frame une par une.
 * 3. **La bande des sols** tout en bas — les memes personnages traversent la
 *    couture, moitie sur l'herbe, moitie sur la cendre. C'est la question
 *    ouverte du §6, et elle se tranche la.
 */

const LARGEUR = 1280;
const HAUTEUR = 920;
/** Ou la planche bascule d'un sol a l'autre. */
const COUPURE = Math.round(LARGEUR / 2);
const MARGE = 24;

class Planche extends Phaser.Scene {
  create(): void {
    this.peindreLesDeuxSols();
    this.titrer();
    this.peindreLesMatieres(MARGE, 96);
    this.peindreLesGestes(MARGE, 232);
    this.peindreLaBandeDesSols(736);
  }

  private peindreLesDeuxSols(): void {
    this.texturerSol("sol-vert", SOL_VERT);
    this.texturerSol("sol-cendre", SOL_CENDRE);
    this.add.tileSprite(0, 0, COUPURE, HAUTEUR, "sol-vert").setOrigin(0);
    this.add.tileSprite(COUPURE, 0, LARGEUR - COUPURE, HAUTEUR, "sol-cendre").setOrigin(0);
    // La couture, pour que l'oeil sache exactement ou l'un s'arrete.
    this.add.rectangle(COUPURE, 0, 1, HAUTEUR, C.fer, 0.45).setOrigin(0);
  }

  /**
   * Un carreau de sol, dessine au code comme tout le reste.
   *
   * Le grain n'est pas decoratif : un aplat uni de 32 px se lit comme un defaut
   * d'affichage des qu'on en aligne mille. Il tire ses trois valeurs de la
   * matiere, donc il ne peut pas deriver.
   */
  private texturerSol(cle: string, sol: Matiere): void {
    if (this.textures.exists(cle)) return;
    const cote = 32;
    const toile = new Toile(cote, cote);
    toile.rect(0, 0, cote, cote, sol.corps);

    for (let y = 0; y < cote; y += 1) {
      for (let x = 0; x < cote; x += 1) {
        // Un bruit fixe, pas un aleatoire : la texture doit etre la meme a chaque
        // lancement, sinon on ne compare pas deux fois la meme chose.
        const grain = (x * 7 + y * 13 + ((x * y) % 11)) % 9;
        if (grain === 0) toile.point(x, y, sol.sombre);
        else if (grain === 4) toile.point(x, y, sol.clair);
      }
    }

    const texture = this.textures.createCanvas(cle, cote, cote);
    texture?.getContext().putImageData(toile.versImageData(), 0, 0);
    texture?.refresh();
  }

  private peindreLesMatieres(x0: number, y0: number): void {
    this.etiquette(x0, y0 - 20, "les treize matieres  —  sombre / corps / clair", 13);

    const large = 82;
    const haut = 40;
    MATIERES.forEach(({ nom, matiere }, i) => {
      const x = x0 + (i % 7) * (large + 10);
      const y = y0 + Math.floor(i / 7) * (haut + 26);
      const tiers = large / 3;

      this.add.rectangle(x, y, tiers, haut, matiere.sombre).setOrigin(0);
      this.add.rectangle(x + tiers, y, tiers, haut, matiere.corps).setOrigin(0);
      this.add.rectangle(x + tiers * 2, y, tiers, haut, matiere.clair).setOrigin(0);
      this.add.rectangle(x, y, large, haut).setStrokeStyle(1, C.fer).setOrigin(0);
      this.etiquette(x, y + haut + 4, nom, 11);
    });
  }

  /** Une ligne par geste : le sprite vivant, le meme agrandi, puis ses frames. */
  private peindreLesGestes(x0: number, y0: number): void {
    const modele = villageois("apercu", { usure: 0, sang: 0 });
    // ⚠️ Les plages, et surtout pas un compteur reparti de zero a chaque ligne :
    // une planche porte tous les gestes bout a bout.
    const { plages } = cuire(this, modele);

    const ligne = 118;
    const zoom = 3;
    modele.gestes.forEach((geste, rang) => {
      const plage = plages[rang]!;
      const y = y0 + rang * ligne;
      const bas = y + 86;

      this.etiquette(x0, y + 32, geste.cle, 15);
      if (geste.evenement) this.etiquette(x0, y + 52, `son : ${geste.evenement}`, 10);

      // A sa vraie taille : la seule facon de voir s'il reste lisible a 32 px.
      this.add.sprite(x0 + 108, bas - 16, "apercu-planche").play(`apercu-${geste.cle}`);
      // Et agrandi, pour voir le geste.
      this.add
        .sprite(x0 + 168, bas - 48, "apercu-planche")
        .setScale(zoom)
        .play(`apercu-${geste.cle}`);

      let x = x0 + 232;
      for (let i = plage.debut; i <= plage.fin; i += 1) {
        this.add.image(x, bas, "apercu-planche", i).setOrigin(0, 1).setScale(zoom);
        const marque = geste.frameCle === i - plage.debut ? `${i - plage.debut} ‹son›` : `${i - plage.debut}`;
        this.etiquette(x + 24, bas + 4, marque, 10);
        x += 32 * zoom + 6;
      }
    });
  }

  /**
   * La bande qui tranche la question du §6 : les memes personnages, a cheval sur
   * la couture. Un sol ne se juge pas sur un carre de trente pixels.
   */
  private peindreLaBandeDesSols(y0: number): void {
    this.etiquette(MARGE, y0 - 22, "le meme village sur les deux sols  —  a gauche l'herbe, a droite la cendre", 14);

    const etats = [
      { cle: "b-neuf", titre: "neuf", corps: { usure: 0, sang: 0 } },
      { cle: "b-fatigue", titre: "usure 0,5", corps: { usure: 0.5, sang: 0 } },
      { cle: "b-use", titre: "usure 1", corps: { usure: 1, sang: 0 } },
      { cle: "b-blesse", titre: "blesse", corps: { usure: 0.4, sang: 1 } },
    ];
    for (const etat of etats) cuire(this, villageois(etat.cle, etat.corps));

    // Huit postes repartis sur toute la largeur : quatre tombent sur l'herbe,
    // quatre sur la cendre, et ce sont les memes.
    const pas = Math.round((LARGEUR - MARGE * 2) / 8);
    for (let poste = 0; poste < 8; poste += 1) {
      const etat = etats[poste % etats.length]!;
      const geste = poste % 2 === 0 ? "travail" : "marche";
      const x = MARGE + pas * poste + pas / 2;

      this.add
        .sprite(x, y0 + 78, `${etat.cle}-planche`)
        .setScale(3)
        .play(`${etat.cle}-${geste}`);
      this.etiquette(x - 34, y0 + 96, `${etat.titre} · ${geste}`, 10);
    }
  }

  private titrer(): void {
    this.add
      .text(MARGE, 20, "LE SOCLE — bloc 7z, etage 1", {
        fontFamily: POLICE,
        fontSize: "26px",
        color: TONS.titre,
      })
      .setShadow(2, 2, TONS.sangSeche, 0, true, true);

    this.etiquette(MARGE, 54, "sol vert", 14);
    this.etiquette(COUPURE + 12, 54, "sol cendre", 14);
  }

  private etiquette(x: number, y: number, contenu: string, taille = 12): void {
    this.add.text(x, y, contenu.toUpperCase(), {
      fontFamily: POLICE,
      fontSize: `${taille}px`,
      color: TONS.os,
    });
  }
}

new Phaser.Game({
  type: Phaser.CANVAS,
  width: LARGEUR,
  height: HAUTEUR,
  pixelArt: true,
  backgroundColor: "#141010",
  scene: Planche,
});
