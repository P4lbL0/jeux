import Phaser from "phaser";
import { SEPARATEUR_DES_TAGS, type Proposition } from "../core/competences";
import {
  affuter, C, POLICE, T, cadre, espacer, type Plaque } from "./ui/chrome";
import { largeurEcran, hauteurEcran } from "./ui/ecran";

/** Au-dela, les cartes passent a la rangee suivante. */
const CARTES_PAR_RANGEE = 5;

/** « Touches 1 a 3 », « Touches 1 a 9 et 0 » : ce que les cartes affichent. */
function texteDesTouches(n: number): string {
  if (n <= 1) return "Touche 1";
  if (n <= 9) return `Touches 1 a ${n}`;
  return "Touches 1 a 9 et 0";
}

/**
 * Ecran de choix, utilise pour les competences comme pour les evolutions
 * (DESIGN.md §4.13).
 *
 * Le jeu se met en pause le temps du choix. Regle a ne jamais casser : c'est
 * TOUJOURS le joueur qui choisit, jamais l'IA. Les heros joues par l'IA
 * accumulent leurs choix en attente au lieu d'ouvrir cet ecran.
 */
export class ChoixCompetence {
  private objets: Phaser.GameObjects.GameObject[] = [];
  private touches: Phaser.Input.Keyboard.Key[] = [];
  private ouvert = false;

  constructor(private scene: Phaser.Scene) {}

  get estOuvert(): boolean {
    return this.ouvert;
  }

  afficher(
    titre: string,
    sousTitre: string,
    propositions: Proposition[],
    surChoix: (id: string) => void,
  ): void {
    this.ouvert = true;
    const l = largeurEcran(this.scene);
    const h = hauteurEcran(this.scene);

    const voile = this.scene.add.graphics().setDepth(3000);
    voile.fillStyle(C.fer, 0.88);
    voile.fillRect(0, 0, l, h);
    this.objets.push(voile);

    this.ajouterTexte(l / 2, h * 0.17, espacer(titre.toUpperCase()), 26, T.laiton).setOrigin(0.5);
    this.ajouterTexte(l / 2, h * 0.17 + 34, sousTitre, 13, T.osMat).setOrigin(0.5);

    // Trois cartes d'ordinaire. L'ecran « laquelle oublier ? » (§4.13) en montre
    // une par active tenue, plus l'achat : jusqu'a dix depuis Touche-a-tout
    // (§4.23). Au-dela de cinq, elles passent sur deux rangees — sur une seule,
    // dix cartes faisaient cent pixels de large et ne se lisaient plus.
    const espace = 18;
    const n = Math.max(1, propositions.length);
    const parRangee = Math.min(n, CARTES_PAR_RANGEE);
    const largeur = Math.min(226, Math.floor((l - 48 - (parRangee - 1) * espace) / parRangee));
    // Assez haute pour la description et, en pied, la ligne des tags (§4.25).
    const hauteur = 188;
    const y = h * (n > CARTES_PAR_RANGEE ? 0.27 : 0.35);

    propositions.forEach((proposition, i) => {
      const rangee = Math.floor(i / CARTES_PAR_RANGEE);
      const dansRangee = Math.min(CARTES_PAR_RANGEE, n - rangee * CARTES_PAR_RANGEE);
      const total = dansRangee * largeur + (dansRangee - 1) * espace;
      const x = l / 2 - total / 2 + (i % CARTES_PAR_RANGEE) * (largeur + espace);
      this.carte(proposition, x, y + rangee * (hauteur + espace), largeur, hauteur, i + 1, () => {
        this.masquer();
        surChoix(proposition.id);
      });
    });

    const rangees = Math.ceil(n / CARTES_PAR_RANGEE);
    const basDesCartes = y + rangees * hauteur + (rangees - 1) * espace;
    this.ajouterTexte(l / 2, basDesCartes + 34, `${texteDesTouches(n)}, ou clique`, 12, T.osMat).setOrigin(0.5);

    const clavier = this.scene.input.keyboard;
    if (!clavier) return;
    const codes = [
      Phaser.Input.Keyboard.KeyCodes.ONE,
      Phaser.Input.Keyboard.KeyCodes.TWO,
      Phaser.Input.Keyboard.KeyCodes.THREE,
      Phaser.Input.Keyboard.KeyCodes.FOUR,
      Phaser.Input.Keyboard.KeyCodes.FIVE,
      Phaser.Input.Keyboard.KeyCodes.SIX,
      Phaser.Input.Keyboard.KeyCodes.SEVEN,
      Phaser.Input.Keyboard.KeyCodes.EIGHT,
      Phaser.Input.Keyboard.KeyCodes.NINE,
      Phaser.Input.Keyboard.KeyCodes.ZERO,
    ];
    propositions.forEach((proposition, i) => {
      const code = codes[i];
      if (code === undefined) return;
      const touche = clavier.addKey(code);
      touche.once("down", () => {
        if (!this.ouvert) return;
        this.masquer();
        surChoix(proposition.id);
      });
      this.touches.push(touche);
    });
  }

  private carte(
    proposition: Proposition,
    x: number,
    y: number,
    largeur: number,
    hauteur: number,
    numero: number,
    surClic: () => void,
  ): void {
    const fond = this.scene.add.graphics().setDepth(3001);
    const plaque: Plaque = { x, y, largeur, hauteur };
    cadre(fond, plaque, true);
    this.objets.push(fond);

    // Le numero de touche est en laiton, comme partout ailleurs : c'est ce
    // qu'on appuie (§4.10). La rarete de la competence, elle, garde sa couleur
    // — c'est une information de contenu, pas de chrome.
    this.ajouterTexte(x + 14, y + 15, numero === 10 ? "0" : `${numero}`, 15, T.laiton);
    this.ajouterTexte(x + 34, y + 12, proposition.nom, 15, T.os).setWordWrapWidth(largeur - 50);
    this.ajouterTexte(x + 34, y + 36, espacer(proposition.etiquette.toUpperCase()), 9, T.osMat);

    this.ajouterTexte(x + 14, y + 66, proposition.description, 11, T.os).setWordWrapWidth(
      largeur - 28,
    );

    // Les tags, en pied de carte (§4.25) : ce que la competence **est**, pour
    // que le joueur apprenne a lire son build. Un filet les separe du texte.
    if (proposition.tags) {
      // ⚠️ **Les tags passent a la ligne entre deux tags, jamais dans un mot.**
      // Les lettres sont espacees une a une : le retour a la ligne de Phaser
      // coupait n'importe ou (« EXPLO / SION », vu sur la Boule de feu, la
      // premiere a en porter cinq), et la seconde ligne sortait de la carte.
      // La derniere ligne reste ou elle etait ; s'il en faut une de plus, le
      // filet remonte d'autant.
      const texte = this.ajouterTexte(x + 14, 0, "", 9, T.acier);
      const lignes: string[] = [];
      for (const tag of proposition.tags.split(SEPARATEUR_DES_TAGS)) {
        const derniere = lignes[lignes.length - 1];
        const allongee = derniere === undefined ? tag : `${derniere}${SEPARATEUR_DES_TAGS}${tag}`;
        if (derniere !== undefined && texte.setText(espacer(allongee)).width > largeur - 28) lignes.push(tag);
        else if (derniere === undefined) lignes.push(tag);
        else lignes[lignes.length - 1] = allongee;
      }
      texte.setText(lignes.map(espacer).join("\n")).setY(y + hauteur - 10 - lignes.length * 12);
      const filet = y + hauteur - 18 - lignes.length * 12;
      fond.lineStyle(1, C.sangSeche, 0.9);
      fond.lineBetween(x + 14, filet, x + largeur - 14, filet);
    }

    const zone = this.scene.add
      .zone(x, y, largeur, hauteur)
      .setOrigin(0)
      .setDepth(3002)
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", surClic);
    this.objets.push(zone);
  }

  private ajouterTexte(
    x: number,
    y: number,
    contenu: string,
    taille: number,
    couleur: string,
  ): Phaser.GameObjects.Text {
    const t = affuter(this.scene.add.text(x, y, contenu, {
        fontFamily: POLICE,
        fontSize: `${taille}px`,
        color: couleur,
        lineSpacing: 3,
      }))
      .setDepth(3002);
    this.objets.push(t);
    return t;
  }

  masquer(): void {
    this.ouvert = false;
    for (const touche of this.touches) touche.removeAllListeners();
    this.touches = [];
    for (const objet of this.objets) objet.destroy();
    this.objets = [];
  }
}
