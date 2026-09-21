import type { ClassId } from "../core/classes";
import {
  calculerPostes,
  formationSuivante,
  type Formation,
  type Ordre,
  type Point,
  type Population,
  type Posture,
} from "../core/ordres";
import type { Hero, Invocation } from "./entities";
import type { Villageois } from "./village";

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
 *
 * ⚠️ **Depuis le bloc 8, elle commande aussi les habitants** (§4.4) : un
 * rectangle prend les deux populations melangees, et le menu d'ordres montre
 * l'union de leurs vocabulaires. Deux selections separees auraient voulu dire
 * deux fois ce fichier, pour un geste que le joueur, lui, fait d'un seul coup.
 */
export class Commandement {
  formation: Formation = "libre";
  /** Ce que le joueur vient de faire, affiche une seconde a l'ecran */
  dernierMessage = "";
  dernierMessageA = 0;

  private selection = new Set<Hero>();
  private civils = new Set<Villageois>();

  constructor(private heros: Hero[]) {}

  // -------------------------------------------------------------- selection

  get selectionnes(): Hero[] {
    return this.heros.filter((h) => this.selection.has(h) && h.estVivant);
  }

  /** Les habitants selectionnes, les morts oublies en chemin. */
  get civilsSelectionnes(): Villageois[] {
    for (const civil of this.civils) if (!civil.regles.vivant) this.civils.delete(civil);
    return [...this.civils];
  }

  estSelectionne(hero: Hero): boolean {
    return this.selection.has(hero);
  }

  estSelectionneCivil(villageois: Villageois): boolean {
    return this.civils.has(villageois);
  }

  get selectionVide(): boolean {
    return this.selectionnes.length === 0 && this.civilsSelectionnes.length === 0;
  }

  /** Combien de tetes en tout, les deux populations confondues. */
  get nombreSelectionne(): number {
    return this.selectionnes.length + this.civilsSelectionnes.length;
  }

  /**
   * Quelles populations sont dans la selection — donc quelles lignes du menu
   * ont un sens (§4.4).
   */
  get populations(): Population[] {
    const presentes: Population[] = [];
    if (this.selectionnes.length > 0) presentes.push("combattant");
    if (this.civilsSelectionnes.length > 0) presentes.push("civil");
    return presentes;
  }

  basculer(hero: Hero): void {
    if (!hero.estVivant) return;
    if (this.selection.has(hero)) this.selection.delete(hero);
    else this.selection.add(hero);
  }

  basculerCivil(villageois: Villageois): void {
    if (!villageois.regles.vivant) return;
    if (this.civils.has(villageois)) this.civils.delete(villageois);
    else this.civils.add(villageois);
  }

  /**
   * Le rectangle de selection : il prend heros et villageois **melanges**
   * (§4.4).
   *
   * Il **remplace** la selection au lieu de s'y ajouter : on trace un cadre
   * pour dire « ceux-la », pas « ceux-la en plus des precedents ». Maj le rend
   * additif, comme partout ailleurs.
   */
  selectionnerDans(
    rectangle: { x: number; y: number; largeur: number; hauteur: number },
    civils: Villageois[],
    incarne: Hero | null,
    ajouter = false,
  ): number {
    if (!ajouter) {
      this.selection.clear();
      this.civils.clear();
    }
    const dedans = (x: number, y: number) =>
      x >= rectangle.x &&
      x <= rectangle.x + rectangle.largeur &&
      y >= rectangle.y &&
      y <= rectangle.y + rectangle.hauteur;

    for (const hero of this.heros) {
      if (!hero.estVivant || hero === incarne) continue;
      if (dedans(hero.x, hero.y)) this.selection.add(hero);
    }
    for (const civil of civils) {
      if (!civil.regles.vivant) continue;
      if (dedans(civil.x, civil.y)) this.civils.add(civil);
    }
    return this.nombreSelectionne;
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
    this.civils.clear();
  }

  /**
   * « Rompez » : plus de selection, plus de position tenue a la main. Tout le
   * monde rejoint la formation. Sans cette touche, un heros envoye tenir un
   * carrefour y resterait pour le restant de la partie (DESIGN.md §4.4).
   *
   * @param civils tous les habitants du village : eux aussi peuvent tenir un
   *        point depuis le bloc 8, et un villageois oublie sur un carrefour ne
   *        produirait plus rien de la partie.
   */
  rompre(sbires: Invocation[], civils: Villageois[] = []): void {
    this.selection.clear();
    this.civils.clear();
    const commandes: Commande[] = [...this.heros, ...sbires];
    for (const commande of commandes) {
      commande.protege = null;
      commande.ordre.ancre = null;
    }
    // ⚠️ **`suit` d'abord, `ancre` ensuite.** Effacer la seule ancre ne suffit
    // pas : `suivreLesProteges` la repose a l'image suivante a partir de
    // `suit`, et *Rompez* ne faisait donc rien du tout. Vu en jouant, invisible
    // en test unitaire.
    for (const civil of civils) {
      civil.suit = null;
      civil.ancre = null;
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

  /**
   * Les civils vises.
   *
   * ⚠️ **Rien de selectionne ne veut pas dire « tout le village ».** Pour les
   * heros, l'ordre par defaut vaut pour l'equipe entiere — ils sont sept au
   * plus et ils font tous la meme chose. Trente habitants, non : envoyer tout
   * le village a la mine d'un clic distrait viderait la peche, les champs et
   * les tours d'un coup, sans rien pour revenir en arriere.
   */
  destinatairesCivils(): Villageois[] {
    return this.civilsSelectionnes;
  }

  /**
   * Les civils selectionnes vont tenir ce point (§4.4).
   *
   * C'est la meme ancre que pour un heros, et elle a le meme effet : tant
   * qu'elle est posee, il ne retourne pas a son poste. `suit` est le second cas
   * de l'ancre — une entite a suivre, recopiee a chaque image.
   */
  ancrerCivils(point: Point | null, suit: Hero | null): number {
    const cibles = this.destinatairesCivils();
    for (const civil of cibles) {
      civil.suit = suit;
      civil.ancre = point ? { x: point.x, y: point.y } : null;
    }
    return cibles.length;
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
  suivreLesProteges(sbires: Invocation[], civils: Villageois[] = []): void {
    for (const civil of civils) {
      const suit = civil.suit;
      if (!suit) continue;
      if (!suit.estVivant || !civil.regles.vivant) {
        civil.suit = null;
        civil.ancre = null;
        continue;
      }
      // On deplace l'ancre au lieu d'en fabriquer une : c'est un calcul par
      // habitant et par image, et un village en compte jusqu'a soixante.
      if (civil.ancre) {
        civil.ancre.x = suit.x;
        civil.ancre.y = suit.y;
      } else {
        civil.ancre = { x: suit.x, y: suit.y };
      }
    }

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
