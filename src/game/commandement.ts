import type { ClassId } from "../core/classes";
import {
  calculerPostes,
  formationSuivante,
  type Formation,
  type Ordre,
  type Point,
  type Posture,
} from "../core/ordres";
import type { Hero, Invocation } from "./entities";

/** Ce que doit offrir tout ce qui obeit : un heros IA comme un mort-vivant. */
interface Commande {
  ordre: Ordre;
  protege: Hero | null;
}

/**
 * Le poste de commandement du joueur (DESIGN.md §4.4).
 *
 * Il ne decide rien du comportement : il tient la selection, distribue les
 * ordres, et recalcule les places de la formation. Le comportement, lui, reste
 * entierement dans `core/ia.ts` et `core/ordres.ts`, qui ne connaissent pas
 * Phaser et sont testes.
 *
 * Une seule et meme selection commande les heros IA et les mort-vivants : c'est
 * la regle du §4.14, un seul systeme pour les deux.
 */
export class Commandement {
  formation: Formation = "libre";
  /** Ce que le joueur vient de faire, affiche une seconde a l'ecran */
  dernierMessage = "";
  dernierMessageA = 0;

  private selection = new Set<Hero>();

  constructor(private heros: Hero[]) {}

  // -------------------------------------------------------------- selection

  get selectionnes(): Hero[] {
    return this.heros.filter((h) => this.selection.has(h) && h.estVivant);
  }

  estSelectionne(hero: Hero): boolean {
    return this.selection.has(hero);
  }

  get selectionVide(): boolean {
    return this.selectionnes.length === 0;
  }

  basculer(hero: Hero): void {
    if (!hero.estVivant) return;
    if (this.selection.has(hero)) this.selection.delete(hero);
    else this.selection.add(hero);
  }

  /** Tous les heros d'une meme classe d'un coup — on peut en avoir plusieurs. */
  selectionnerClasse(classe: ClassId): void {
    const memeClasse = this.heros.filter((h) => h.classe.id === classe && h.estVivant);
    // S'ils y sont deja tous, le meme geste les retire : un raccourci qui ne
    // sait pas revenir en arriere est un piege.
    const tous = memeClasse.every((h) => this.selection.has(h));
    for (const hero of memeClasse) {
      if (tous) this.selection.delete(hero);
      else this.selection.add(hero);
    }
  }

  effacer(): void {
    this.selection.clear();
  }

  /**
   * « Rompez » : plus de selection, plus de position tenue a la main. Tout le
   * monde rejoint la formation. Sans cette touche, un heros envoye tenir un
   * carrefour y resterait pour le restant de la partie (DESIGN.md §4.4).
   */
  rompre(sbires: Invocation[]): void {
    this.selection.clear();
    const commandes: Commande[] = [...this.heros, ...sbires];
    for (const commande of commandes) {
      commande.protege = null;
      commande.ordre.ancre = null;
    }
  }

  /**
   * Qui recoit l'ordre : la selection, ou toute l'equipe IA si rien n'est
   * selectionne. Le heros incarne n'obeit jamais — c'est le joueur qui le
   * pilote.
   */
  destinataires(incarne: Hero | null): Hero[] {
    const selection = this.selectionnes;
    const base = selection.length > 0 ? selection : this.heros;
    return base.filter((h) => h.estVivant && h !== incarne);
  }

  // ----------------------------------------------------------------- ordres

  donnerPosture(posture: Posture, incarne: Hero | null, sbires: Invocation[]): number {
    const cibles = this.destinataires(incarne);
    for (const hero of cibles) hero.ordre = { ...hero.ordre, posture };
    for (const sbire of this.sbiresDe(cibles, sbires)) {
      sbire.ordre = { ...sbire.ordre, posture };
    }
    return cibles.length;
  }

  /**
   * Pose l'ancre de la selection. Sur un allie, elle le suivra : proteger
   * quelqu'un, c'est s'ancrer sur lui (DESIGN.md §4.4).
   */
  ancrer(point: Point | null, protege: Hero | null, incarne: Hero | null, sbires: Invocation[]): number {
    const cibles = this.destinataires(incarne);
    // Chacun recoit sa propre ancre : elles sont deplacees en place a chaque
    // image, et une ancre partagee ferait bouger tout le monde a la fois.
    const copie = () => (point ? { x: point.x, y: point.y } : null);

    for (const hero of cibles) {
      if (hero === protege) continue; // il ne se protege pas lui-meme
      hero.protege = protege;
      hero.ordre = { ...hero.ordre, ancre: copie() };
      // Une ancre posee a la main detache le heros de la formation : sinon
      // l'ordre le plus precis serait le seul a ne rien faire.
      hero.poste = null;
    }
    for (const sbire of this.sbiresDe(cibles, sbires)) {
      sbire.protege = protege;
      sbire.ordre = { ...sbire.ordre, ancre: copie() };
    }
    return cibles.length;
  }

  changerFormation(pas = 1): Formation {
    this.formation = formationSuivante(this.formation, pas);
    return this.formation;
  }

  // -------------------------------------------------------------- formation

  /**
   * Recalcule les places de la formation. A appeler une fois par image : c'est
   * un calcul sur l'equipe entiere, jamais par heros (regle 5 du §4.17).
   *
   * @param ancre le point autour duquel la formation se tient
   * @param menace vers quoi elle fait face
   */
  majPostes(ancre: Point | null, menace: Point | null, incarne: Hero | null): void {
    // Un heros a qui on a donne une position precise garde la sienne.
    const enFormation = this.heros.filter(
      (h) =>
        h.estVivant &&
        h !== incarne &&
        !h.resteEnCite &&
        h.ordre.ancre === null &&
        h.ordre.posture !== "repli",
    );

    for (const hero of this.heros) hero.poste = null;
    if (this.formation === "libre" || !ancre) return;

    const postes = calculerPostes(
      enFormation.map((h) => h.classe.role),
      this.formation,
      ancre,
      menace,
    );
    enFormation.forEach((hero, i) => {
      hero.poste = postes[i] ?? null;
    });
  }

  /**
   * Les ancres posees sur un allie le suivent. Recalculer ici plutot que dans
   * l'IA garde `core/` a l'ecart des objets de la scene.
   */
  suivreLesProteges(sbires: Invocation[]): void {
    const commandes: Commande[] = [...this.heros, ...sbires];
    for (const commande of commandes) {
      const protege = commande.protege;
      if (!protege) continue;
      if (!protege.estVivant) {
        commande.protege = null;
        commande.ordre.ancre = null;
        continue;
      }
      // On deplace l'ancre au lieu d'en fabriquer une : c'est un calcul par
      // entite et par image, et il y en a jusqu'a douze par necromancien.
      const ancre = commande.ordre.ancre;
      if (ancre) {
        ancre.x = protege.x;
        ancre.y = protege.y;
      } else {
        commande.ordre.ancre = { x: protege.x, y: protege.y };
      }
    }
  }

  private sbiresDe(maitres: Hero[], sbires: Invocation[]): Invocation[] {
    return sbires.filter((s) => s.active && maitres.includes(s.maitre));
  }

  annoncer(message: string, maintenant: number): void {
    this.dernierMessage = message;
    this.dernierMessageA = maintenant;
  }
}
