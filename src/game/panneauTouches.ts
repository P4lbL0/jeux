import Phaser from "phaser";
import {
  actionsDe,
  actionParId,
  assigner,
  ecrireTouche,
  estParDefaut,
  mappageParDefaut,
  NOMS_CATEGORIE,
  type CategorieTouche,
  type Mappage,
} from "../core/touches";
import {
  affuter,
  barreDeTitre,
  C,
  cadre,
  creux,
  espacer,
  lisible,
  MARGE,
  POLICE,
  T,
  teindre,
  yCorps,
  yTitre,
  type Plaque,
} from "./ui/chrome";
import { largeurEcran, hauteurEcran } from "./ui/ecran";
import { bruitDInterface } from "./son";
import { mappage, nomDuCode, poserMappage, toucheInterdite } from "./touches";

/**
 * Le panneau des touches (DESIGN.md §4.10, « Le menu d'options »).
 *
 * **Toutes les actions du jeu y sont, et toutes se remappent.** On clique une
 * ligne, on appuie sur la touche qu'on veut, c'est fini — pas de champ de
 * saisie, pas de validation.
 *
 * ⚠️ **Deux actions ne se disputent jamais une touche : elles l'echangent**
 * (`core/touches.ts`). Poser `G` sur la cloche rend a la palissade l'ancienne
 * touche de la cloche, et le panneau le dit en une ligne. C'est ce qui garantit
 * qu'aucune fonction du jeu ne disparait parce qu'on a remappe trop vite.
 *
 * ECHAP annule l'attente d'une touche, ou ferme le panneau. C'est donc la seule
 * qu'on ne peut pas poser ici — et c'est voulu : le jour ou ECHAP n'ouvre plus
 * rien, on ne peut plus revenir ici pour le corriger.
 */

const LARGEUR = 700;
/** Hauteur d'une ligne, et hauteur d'un titre de famille. */
const LIGNE = 19;
const ENTETE = 24;
/**
 * Deux colonnes : a gauche ce qu'on fait soi-meme, a droite ce qu'on ordonne et
 * ce qu'on batit.
 *
 * ⚠️ **Le partage est mesure, pas thematique.** La premiere version mettait
 * « se deplacer » et « se battre » a gauche et les trois autres familles a
 * droite : dix-sept lignes contre vingt-quatre, et la moitie gauche du panneau
 * restait vide sur toute sa hauteur. Vu en capture.
 */
const COLONNES: CategorieTouche[][] = [
  ["deplacer", "battre", "village"],
  ["commander", "batir"],
];
const PROFONDEUR = 2200;

interface Rangee {
  id: string;
  nom: Phaser.GameObjects.Text;
  touche: Phaser.GameObjects.Text;
  zone: Phaser.GameObjects.Zone;
  x: number;
  y: number;
}

export class PanneauTouches {
  private objets: Phaser.GameObjects.GameObject[] = [];
  private rangees: Rangee[] = [];
  private fond: Phaser.GameObjects.Graphics | null = null;
  private note: Phaser.GameObjects.Text | null = null;
  private remettre: Phaser.GameObjects.Text | null = null;
  /** L'action dont on attend la touche, ou `null` quand on ne remappe pas. */
  private attente: string | null = null;
  private ecouteur: ((e: KeyboardEvent) => void) | null = null;
  private plaque: Plaque = { x: 0, y: 0, largeur: 0, hauteur: 0 };

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly surFermer: () => void,
  ) {}

  get ouvert(): boolean {
    return this.objets.length > 0;
  }

  ouvrir(): void {
    if (this.ouvert) return;
    const s = this.scene;

    const lignes = Math.max(...COLONNES.map((c) => this.hauteurColonne(c)));
    const hauteur = yCorpsRelatif() + lignes + 48;
    this.plaque = {
      x: Math.round((largeurEcran(s) - LARGEUR) / 2),
      y: Math.max(12, Math.round((hauteurEcran(s) - hauteur) / 2)),
      largeur: LARGEUR,
      hauteur,
    };
    const p = this.plaque;

    this.fond = s.add.graphics().setDepth(PROFONDEUR);
    cadre(this.fond, p, true);
    barreDeTitre(this.fond, p);
    this.objets.push(this.fond);

    this.objets.push(
      affuter(
        s.add.text(p.x + p.largeur / 2, yTitre(p), espacer("TOUCHES"), {
          fontFamily: POLICE,
          fontSize: `${lisible(12)}px`,
          color: T.titre,
        }),
      )
        .setOrigin(0.5, 0)
        .setDepth(PROFONDEUR + 2),
    );

    const largeurColonne = Math.floor((p.largeur - MARGE * 3) / COLONNES.length);
    COLONNES.forEach((familles, i) => {
      let y = yCorps(p);
      const x = p.x + MARGE + i * (largeurColonne + MARGE);
      for (const famille of familles) {
        this.entete(x, y, famille);
        y += ENTETE;
        for (const action of actionsDe(famille)) {
          this.rangee(action.id, action.nom, x, y, largeurColonne);
          y += LIGNE;
        }
        y += 6;
      }
    });

    // La ligne qui explique ce qui vient d'arriver : un echange, un refus. Elle
    // reste vide tant que rien n'a bouge — une aide permanente se cesse d'etre lue.
    this.note = affuter(
      s.add.text(p.x + p.largeur / 2, p.y + p.hauteur - 44, "Clique une ligne, puis appuie sur la touche voulue.", {
        fontFamily: POLICE,
        fontSize: `${lisible(11)}px`,
        color: T.osMat,
      }),
    )
      .setOrigin(0.5, 0)
      .setDepth(PROFONDEUR + 2);
    this.objets.push(this.note);

    // Les deux liens du bas sont centres sur leur point : on les rentre d'une
    // demi-largeur, sinon « Tout remettre a zero » deborde du cadre a gauche.
    this.remettre = this.lien(p.x + MARGE + 72, p.y + p.hauteur - 22, "Tout remettre a zero", () =>
      this.remettreAZero(),
    );
    this.lien(p.x + p.largeur - MARGE - 30, p.y + p.hauteur - 22, "Retour", () => this.fermer());

    this.ecouteur = (e: KeyboardEvent) => this.capter(e);
    // ⚠️ En capture (`true`) et sur le document : une touche posee par Phaser
    // pour une autre action mangerait l'evenement avant nous, et on ne pourrait
    // jamais remapper une touche deja prise — c'est-a-dire le cas courant.
    document.addEventListener("keydown", this.ecouteur, true);

    this.rafraichir();
  }

  fermer(): void {
    this.defaire();
    this.surFermer();
  }

  /** La fenetre a change de taille : on refait la plaque, sans rendre la main. */
  replacer(): void {
    if (!this.ouvert) return;
    this.defaire();
    this.ouvrir();
  }

  private defaire(): void {
    if (this.ecouteur) document.removeEventListener("keydown", this.ecouteur, true);
    this.ecouteur = null;
    this.attente = null;
    for (const o of this.objets) o.destroy();
    this.objets = [];
    this.rangees = [];
    this.fond = null;
    this.note = null;
    this.remettre = null;
  }

  // ------------------------------------------------------------- les lignes

  private hauteurColonne(familles: CategorieTouche[]): number {
    return familles.reduce((h, f) => h + ENTETE + actionsDe(f).length * LIGNE + 6, 0);
  }

  private entete(x: number, y: number, famille: CategorieTouche): void {
    const t = affuter(
      this.scene.add.text(x, y, espacer(NOMS_CATEGORIE[famille].toUpperCase()), {
        fontFamily: POLICE,
        fontSize: `${lisible(10)}px`,
        color: T.sangFrais,
      }),
    )
      .setOrigin(0, 0)
      .setDepth(PROFONDEUR + 2);
    this.objets.push(t);
  }

  private rangee(id: string, nom: string, x: number, y: number, largeur: number): void {
    const s = this.scene;
    const texteNom = affuter(
      s.add.text(x + 4, y, nom, { fontFamily: POLICE, fontSize: `${lisible(11)}px`, color: T.os }),
    )
      .setOrigin(0, 0)
      .setDepth(PROFONDEUR + 2);
    const texteTouche = affuter(
      s.add.text(x + largeur - 8, y, "", {
        fontFamily: POLICE,
        fontSize: `${lisible(11)}px`,
        color: T.laiton,
      }),
    )
      .setOrigin(1, 0)
      .setDepth(PROFONDEUR + 2);

    const zone = s.add
      .zone(x, y - 2, largeur, LIGNE)
      .setOrigin(0)
      .setDepth(PROFONDEUR + 3)
      .setInteractive({ useHandCursor: true })
      .on("pointerover", () => {
        if (this.attente === null) bruitDInterface(s, "survol");
        teindre(texteNom, T.titre);
      })
      .on("pointerout", () => teindre(texteNom, T.os))
      .on("pointerdown", () => {
        bruitDInterface(s, "clic");
        this.attendre(id);
      });

    this.objets.push(texteNom, texteTouche, zone);
    this.rangees.push({ id, nom: texteNom, touche: texteTouche, zone, x, y });
  }

  private lien(x: number, y: number, contenu: string, action: () => void): Phaser.GameObjects.Text {
    const s = this.scene;
    const t = affuter(
      s.add.text(x, y, contenu, { fontFamily: POLICE, fontSize: `${lisible(12)}px`, color: T.laiton }),
    )
      .setOrigin(0.5)
      .setDepth(PROFONDEUR + 2)
      .setInteractive({ useHandCursor: true })
      .on("pointerover", () => {
        teindre(t, T.titre);
        bruitDInterface(s, "survol");
      })
      .on("pointerout", () => teindre(t, T.laiton))
      .on("pointerdown", () => {
        bruitDInterface(s, "clic");
        action();
      });
    this.objets.push(t);
    return t;
  }

  // ------------------------------------------------------------- le remappage

  /** Les touches d'origine, d'un coup. */
  remettreAZero(): void {
    poserMappage(mappageParDefaut());
    this.attente = null;
    this.dire("Les touches sont revenues a leur place.");
    this.rafraichir();
  }

  /** Met une action en attente de sa nouvelle touche. */
  attendre(id: string): void {
    this.attente = id;
    const action = actionParId(id);
    this.dire(`${action?.nom ?? id} : appuie sur la touche. ECHAP annule.`);
    this.rafraichir();
  }

  /**
   * Un appui pendant qu'on remappe.
   *
   * On lit `keyCode` et non `key` : c'est la **touche physique** qu'on veut,
   * pas le caractere qu'elle produit. Le meme emplacement donne « a » sur
   * AZERTY et « q » sur QWERTY, et un mappage qui suivrait le caractere
   * changerait de place en changeant de clavier.
   */
  private capter(e: KeyboardEvent): void {
    // Hors attente, on ne mange rien : ECHAP redescend jusqu'a la scene, qui
    // sait dans quel ordre refermer ce qui est ouvert (§4.10).
    if (this.attente === null) return;
    e.preventDefault();
    e.stopPropagation();

    const id = this.attente;
    this.attente = null;

    if (e.keyCode === Phaser.Input.Keyboard.KeyCodes.ESC) {
      this.dire("Annule.");
      this.rafraichir();
      return;
    }
    if (toucheInterdite(e.keyCode)) {
      this.dire("Celle-la ne se pose pas : c'est une touche du navigateur.");
      this.rafraichir();
      return;
    }
    const nom = nomDuCode(e.keyCode);
    if (nom === null) {
      this.dire("Touche inconnue : essaie une lettre, un chiffre ou une fleche.");
      this.rafraichir();
      return;
    }

    const pose = assigner(mappage(), id, nom);
    if (pose.resultat === "refus") {
      const gene = actionParId(pose.avec);
      this.dire(`${ecrireTouche(nom)} est la seconde touche de « ${gene?.nom ?? pose.avec} ».`);
    } else if (pose.resultat === "echange") {
      const autre = actionParId(pose.avec);
      poserMappage(pose.mappage);
      this.dire(`Echange : « ${autre?.nom ?? pose.avec} » prend ${ecrireTouche(mappage()[pose.avec]!)}.`);
    } else if (pose.resultat === "pose") {
      poserMappage(pose.mappage);
      this.dire(`${actionParId(id)?.nom} : ${ecrireTouche(nom)}.`);
    } else {
      this.dire("C'etait deja sa touche.");
    }
    this.rafraichir();
  }

  private dire(message: string): void {
    this.note?.setText(message);
  }

  /** Redessine les pastilles : c'est le seul endroit qui lit le mappage. */
  private rafraichir(): void {
    const m: Mappage = mappage();
    const g = this.fond;
    if (!g) return;

    g.clear();
    cadre(g, this.plaque, true);
    barreDeTitre(g, this.plaque);

    for (const rangee of this.rangees) {
      const enAttente = this.attente === rangee.id;
      rangee.touche.setText(enAttente ? "..." : ecrireTouche(m[rangee.id] ?? ""));
      teindre(rangee.touche, enAttente ? T.sangFrais : T.laiton);
      // Le creux sous la pastille : elle se lit comme quelque chose qu'on change.
      const largeur = Math.max(22, rangee.touche.width + 10);
      creux(g, {
        x: rangee.touche.x - largeur + 4,
        y: rangee.y - 1,
        largeur,
        hauteur: LIGNE - 3,
      });
      if (enAttente) {
        g.fillStyle(C.sangSeche, 0.35);
        g.fillRect(rangee.x, rangee.y - 2, rangee.touche.x - rangee.x + 6, LIGNE);
      }
    }

    this.remettre?.setAlpha(estParDefaut(m) ? 0.4 : 1);
  }
}

/** Ou commence le corps, mesure depuis le haut de la plaque. */
function yCorpsRelatif(): number {
  return 22 + MARGE;
}
