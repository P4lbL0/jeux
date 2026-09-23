import Phaser from "phaser";
import type { EffetCapacite } from "../core/competences";
import { auPalier, BASES, dansLeSouffle, reformer } from "../core/elements";
import { RANGS } from "../core/rangs";
import { eclatImpact } from "./effets";
import type { Ennemi, Hero } from "./entities";
import { CLES_FLAMME, CLE_LUEUR, cuireLeFeu } from "./dessin/feu";
import {
  CLES_RACINES,
  CLE_BULLE,
  CLE_ECLAT_BOUCLIER,
  CLE_FLAQUE,
  CLE_SOUFFLE,
  COTE_BULLE,
  COULEUR_BOUCLIER,
  COULEUR_MOUILLE,
  HAUTEUR_RACINES,
  LARGEUR_FLAQUE,
  PIED_RACINES,
  cuireLesElements,
} from "./dessin/elements";
import { TAILLE_ORC } from "./dessin/orc";
import { COEUR_DU_FEU, FLAMME, SOL_VERT } from "./dessin/palette";
import { C } from "./ui/couleurs";

/**
 * Les six bases elementaires, dans la partie (DESIGN.md §4.13, §4.25 — jalon
 * 6.5, morceau 2b). Le noyau (`core/elements.ts`) dit combien ; ce fichier fait
 * voler la boule, souffler le vent, poser la flaque, jaillir les racines, et
 * tient la bulle du Bouclier. La Teleportation, un simple saut, est jouee par la
 * scene a cote du Clignement.
 *
 * ⚠️ **Tout ce qui cherche des monstres passe par le voisinage** (§4.33) —
 * `ennemisDansRayon`, `ennemiLePlusProche` —, jamais par un parcours de la
 * horde : c'est ce qui laissera ce fichier intact si la logique de la horde
 * passe un jour en tableaux types (le palier 3).
 *
 * ⚠️ **Aucune minuterie** (§4.17, regle 4) : tout avance a chaque image dans
 * `majorer`, qui ne tourne pas pendant un menu, et ce qui est date se decale
 * avec le reste du jeu (`decaler`).
 */

export interface ContexteElements {
  /** Les monstres debout a `rayon` au plus — par le voisinage. */
  ennemisDansRayon(x: number, y: number, rayon: number): Ennemi[];
  ennemiLePlusProche(x: number, y: number, portee: number): Ennemi | null;
  /** Le seul point ou tout ce qui blesse un monstre se rejoint (traits, vol de vie, mort). */
  blesser(e: Ennemi, degats: number, auteur: Hero): void;
  /** L'onde qui s'elargit et s'efface : le langage commun des zones du jeu. */
  cercle(x: number, y: number, rayon: number, couleur: number): void;
  bruit(evenement: string, x: number, y: number): void;
  flotter(x: number, y: number, texte: string, couleur: string): void;
  heros(): readonly Hero[];
}

/**
 * Ce qui est pose au sol et que le Vent emporte (§4.13) : les flaques, les
 * lames du Croc-en-jambe, les pieges. Sa logique relit `point` a chaque
 * battement : le deplacer, c'est la deplacer.
 */
export interface PoseAuSol {
  point: { x: number; y: number };
  image: Phaser.GameObjects.Image;
}

/** Les quatre qui partent toutes seules : ni nom qui flotte, ni geste d'incantation. */
const DISCRETES: ReadonlySet<EffetCapacite> = new Set(["boule-de-feu", "vent", "eau", "nature"]);

/** Sur le sol, au-dessus des champs (-940), sous l'ombre d'un meteore (-930) et les cadavres (-700). */
const PROFONDEUR_FLAQUE = -935;
/** Une boule vole : devant tout ce qui est au sol autour d'elle. */
const HAUTEUR_DE_VOL = 24;
/** A cette distance d'un monstre, la boule eclate. */
const CONTACT_BOULE = 12;
/** Au-dela, on ne compte pas les voisins de chaque candidat : un echantillon suffit. */
const CANDIDATS_MAX = 16;

interface Boule {
  flamme: Phaser.GameObjects.Image;
  coeur: Phaser.GameObjects.Image;
  lueur: Phaser.GameObjects.Image;
  x: number;
  y: number;
  dx: number;
  dy: number;
  /** Ce qu'il lui reste a voler avant d'eclater, meme sans rien toucher */
  reste: number;
  auteur: Hero;
  degats: number;
  rayon: number;
}

interface Rafale {
  auteur: Hero;
  ox: number;
  oy: number;
  dx: number;
  dy: number;
  /** Ou en est le front, depuis le depart du souffle */
  front: number;
  longueur: number;
  demiLargeur: number;
  force: number;
  degats: number;
  touches: Set<Ennemi>;
  emportes: Set<PoseAuSol>;
  traits: { image: Phaser.GameObjects.Image; cote: number; retard: number }[];
}

interface Flaque extends PoseAuSol {
  rayon: number;
  debut: number;
  fin: number;
  prochainBattement: number;
}

interface Racine {
  image: Phaser.GameObjects.Image;
  ennemi: Ennemi;
  fin: number;
}

export class Elements {
  private boules: Boule[] = [];
  private rafales: Rafale[] = [];
  private flaques: Flaque[] = [];
  private racines: Racine[] = [];
  /** Tout ce que le Vent peut emporter, flaques comprises. */
  private auSol: PoseAuSol[] = [];
  private readonly bulles = new Map<Hero, Phaser.GameObjects.Image>();
  /** Ceux dont l'ecran est deja brise : il ne se brise qu'une fois par chute. */
  private readonly brises = new Set<Hero>();
  /** L'ecran qui vient de prendre un coup clignote, sans minuterie. */
  private readonly touchesJusqua = new Map<Hero, number>();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly contexte: ContexteElements,
  ) {
    cuireLeFeu(scene);
    cuireLesElements(scene);
  }

  // ---------------------------------------------------------------- le depart

  /** Elle part toute seule sans le dire : pas de nom qui flotte a chaque boule. */
  estDiscrete(effet: EffetCapacite): boolean {
    return DISCRETES.has(effet);
  }

  /**
   * Une automatique elementaire ne part pas dans le vide : sans monstre a
   * portee, elle attend — et garde son rechargement pour le premier qui vient.
   */
  aUneCible(hero: Hero, effet: EffetCapacite): boolean {
    const portee =
      effet === "boule-de-feu"
        ? BASES.bouleDeFeu.portee
        : effet === "vent"
          ? BASES.vent.portee
          : effet === "eau"
            ? BASES.eau.portee
            : effet === "nature"
              ? BASES.nature.portee
              : 0;
    if (portee === 0) return true;
    return this.contexte.ennemiLePlusProche(hero.x, hero.y, portee) !== null;
  }

  lancer(hero: Hero, effet: EffetCapacite): void {
    switch (effet) {
      case "boule-de-feu":
        this.lancerBouleDeFeu(hero);
        break;
      case "vent":
        this.lancerVent(hero);
        break;
      case "eau":
        this.lancerEau(hero);
        break;
      case "nature":
        this.lancerNature(hero);
        break;
      default:
        break;
    }
  }

  /**
   * Pose au sol quelque chose que le Vent pourra emporter. Oublie tout seul des
   * que son image disparait.
   */
  poserAuSol(pose: PoseAuSol): void {
    this.auSol.push(pose);
  }

  // ------------------------------------------------------------ l'image

  majorer(delta: number, maintenant: number): void {
    this.majBoules(delta, maintenant);
    this.majRafales(delta, maintenant);
    this.majFlaques(maintenant);
    this.majRacines(maintenant);
    this.majBoucliers(maintenant);
    if (this.auSol.length > 0) this.auSol = this.auSol.filter((p) => p.image.active);
  }

  /** Le jeu s'est fige pour un choix : ce qui est date attend avec lui. */
  decaler(millisecondes: number): void {
    for (const f of this.flaques) {
      f.debut += millisecondes;
      f.fin += millisecondes;
      f.prochainBattement += millisecondes;
    }
    for (const r of this.racines) r.fin += millisecondes;
    for (const [hero, jusqua] of this.touchesJusqua) this.touchesJusqua.set(hero, jusqua + millisecondes);
  }

  // ------------------------------------------------------- la boule de feu

  private lancerBouleDeFeu(hero: Hero): void {
    const R = BASES.bouleDeFeu;
    const palier = Math.max(1, hero.palierDe("boule-de-feu"));
    const proches = this.contexte
      .ennemisDansRayon(hero.x, hero.y, R.portee)
      .map((e) => ({ e, d: (e.x - hero.x) ** 2 + (e.y - hero.y) ** 2 }))
      .sort((a, b) => a.d - b.d);
    if (proches.length === 0) return;

    const degats = Math.max(1, Math.round(hero.degats * auPalier(R.degats, palier)));
    const rayon = auPalier(R.rayon, palier) * hero.bonus.tailleZones;
    // Proliferation (§4.13) : une boule de plus, sur le monstre suivant.
    const nombre = 1 + hero.bonus.projectiles;
    for (let i = 0; i < nombre; i++) {
      const cible = proches[i % proches.length]!.e;
      this.lancerUneBoule(hero, cible.x, cible.y, degats, rayon);
    }
    // Le sort qu'Angelos a choisi le 20 septembre : une boule de feu qui part.
    this.contexte.bruit("sort", hero.x, hero.y);
  }

  private lancerUneBoule(hero: Hero, vx: number, vy: number, degats: number, rayon: number): void {
    const distance = Math.hypot(vx - hero.x, vy - hero.y) || 1;
    const dx = (vx - hero.x) / distance;
    const dy = (vy - hero.y) / distance;
    // Une flamme couchee dans le sens du vol, la pointe en arriere, et un coeur
    // rond et clair devant elle. ⚠️ Premier jet, juge sur capture : la flamme
    // seule se lisait comme une fleche orange, pas comme une boule.
    const flamme = this.scene.add
      .image(hero.x, hero.y, CLES_FLAMME[0]!)
      .setOrigin(0.5, 0.82)
      .setRotation(Math.atan2(dy, dx) - Math.PI / 2)
      .setScale(0.8);
    const coeur = this.scene.add.image(hero.x, hero.y, "impact").setTint(COEUR_DU_FEU.clair).setScale(0.62);
    const lueur = this.scene.add
      .image(hero.x, hero.y, CLE_LUEUR)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setScale(0.4)
      .setAlpha(0.9);
    this.boules.push({ flamme, coeur, lueur, x: hero.x, y: hero.y, dx, dy, reste: distance + 20, auteur: hero, degats, rayon });
  }

  private majBoules(delta: number, maintenant: number): void {
    if (this.boules.length === 0) return;
    const pas = (BASES.bouleDeFeu.vitesse * delta) / 1000;
    const image = CLES_FLAMME[Math.floor(maintenant / 90) % CLES_FLAMME.length]!;
    const restantes: Boule[] = [];
    for (const b of this.boules) {
      b.x += b.dx * pas;
      b.y += b.dy * pas;
      b.reste -= pas;
      const touche = this.contexte.ennemiLePlusProche(b.x, b.y, CONTACT_BOULE);
      if (touche || b.reste <= 0) {
        this.exploser(b);
        continue;
      }
      b.flamme.setTexture(image).setPosition(b.x, b.y).setDepth(b.y + HAUTEUR_DE_VOL);
      b.coeur.setPosition(b.x, b.y).setDepth(b.y + HAUTEUR_DE_VOL + 1);
      b.lueur.setPosition(b.x, b.y).setDepth(b.y + HAUTEUR_DE_VOL - 1);
      restantes.push(b);
    }
    this.boules = restantes;
  }

  private exploser(b: Boule): void {
    b.flamme.destroy();
    b.coeur.destroy();
    b.lueur.destroy();
    this.contexte.cercle(b.x, b.y, b.rayon, FLAMME.corps);
    eclatImpact(this.scene, b.x, b.y, FLAMME.clair, 6);
    // Une lueur qui s'ouvre et s'eteint : le souffle de l'explosion.
    const souffle = this.scene.add
      .image(b.x, b.y, CLE_LUEUR)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setScale(0.3)
      .setDepth(b.y + HAUTEUR_DE_VOL);
    this.scene.tweens.add({
      targets: souffle,
      scale: (b.rayon * 2.4) / 96,
      alpha: 0,
      duration: 260,
      onComplete: () => souffle.destroy(),
    });
    for (const e of this.contexte.ennemisDansRayon(b.x, b.y, b.rayon)) this.contexte.blesser(e, b.degats, b.auteur);
  }

  // ---------------------------------------------------------------- le vent

  private lancerVent(hero: Hero): void {
    const R = BASES.vent;
    const palier = Math.max(1, hero.palierDe("vent"));
    const groupe = this.groupeServe(hero.x, hero.y, R.portee, 70);
    if (!groupe) return;
    const d = Math.hypot(groupe.x - hero.x, groupe.y - hero.y) || 1;
    const dx = (groupe.x - hero.x) / d;
    const dy = (groupe.y - hero.y) / d;
    const demiLargeur = auPalier(R.demiLargeur, palier) * hero.bonus.tailleZones;

    // Cinq traits d'air en quinconce, qui avancent avec le front.
    const traits: Rafale["traits"] = [];
    for (let i = 0; i < 5; i++) {
      const image = this.scene.add
        .image(hero.x, hero.y, CLE_SOUFFLE)
        .setTint(C.os)
        .setAlpha(0)
        .setRotation(Math.atan2(dy, dx))
        .setScale(1.2, 1);
      traits.push({ image, cote: ((i - 2) / 2) * demiLargeur * 0.8, retard: (i % 2) * 18 + 6 });
    }

    this.rafales.push({
      auteur: hero,
      ox: hero.x,
      oy: hero.y,
      dx,
      dy,
      front: 0,
      longueur: auPalier(R.longueur, palier),
      demiLargeur,
      force: auPalier(R.force, palier),
      degats: Math.max(1, Math.round(hero.degats * R.degats)),
      touches: new Set(),
      emportes: new Set(),
      traits,
    });
  }

  private majRafales(delta: number, maintenant: number): void {
    if (this.rafales.length === 0) return;
    const R = BASES.vent;
    const restantes: Rafale[] = [];
    for (const r of this.rafales) {
      const avant = r.front;
      r.front = Math.min(r.longueur, r.front + (R.vitesse * delta) / 1000);
      const pas = r.front - avant;
      const fx = r.ox + r.dx * r.front;
      const fy = r.oy + r.dy * r.front;

      // Les monstres que le front atteint : pousses dans le sens du souffle, une fois.
      for (const e of this.contexte.ennemisDansRayon(fx, fy, r.demiLargeur)) {
        if (r.touches.has(e)) continue;
        r.touches.add(e);
        this.pousser(e, r.dx, r.dy, r.force, maintenant);
        this.contexte.blesser(e, r.degats, r.auteur);
      }

      // Ce qui traine au sol : pris quand le front l'atteint, emporte jusqu'au
      // bout du souffle. C'est ce qu'une Tempete incendiaire fera du feu (§4.25).
      for (const p of this.auSol) {
        if (!p.image.active) continue;
        if (r.emportes.has(p)) {
          p.point.x += r.dx * pas;
          p.point.y += r.dy * pas;
          p.image.setPosition(p.point.x, p.point.y);
          continue;
        }
        const a = dansLeSouffle(p.point.x, p.point.y, r.ox, r.oy, r.dx, r.dy, r.longueur, r.demiLargeur);
        if (a !== null && a <= r.front) r.emportes.add(p);
      }

      // Les traits suivent le front, et s'effacent sur son dernier tiers.
      const part = r.front / r.longueur;
      const alpha = part < 0.66 ? 0.75 : 0.75 * (1 - (part - 0.66) / 0.34);
      for (const t of r.traits) {
        const avance = Math.max(0, r.front - t.retard);
        t.image
          .setPosition(r.ox + r.dx * avance - r.dy * t.cote, r.oy + r.dy * avance + r.dx * t.cote)
          .setDepth(r.oy + r.dy * avance + HAUTEUR_DE_VOL)
          .setAlpha(alpha);
      }

      if (r.front >= r.longueur) {
        for (const t of r.traits) t.image.destroy();
        continue;
      }
      restantes.push(r);
    }
    this.rafales = restantes;
  }

  /**
   * Pousse un monstre **dans le sens du souffle**, pas loin d'un centre, et
   * assez longtemps pour que la poussee se voie : sa marche reprend ensuite.
   * Un geant recule moins — deux fois pour le boss, trois pour l'enorme (§4.25).
   */
  private pousser(e: Ennemi, dx: number, dy: number, force: number, maintenant: number): void {
    const vitesse = force / RANGS[e.rang].taille;
    e.setVelocity(dx * vitesse, dy * vitesse);
    e.reculJusqua = maintenant + BASES.vent.tenue;
  }

  // ---------------------------------------------------------------- l'eau

  private lancerEau(hero: Hero): void {
    const R = BASES.eau;
    const palier = Math.max(1, hero.palierDe("eau"));
    const groupe = this.groupeServe(hero.x, hero.y, R.portee, 60);
    if (!groupe) return;
    const maintenant = this.scene.time.now;
    const rayon = auPalier(R.rayon, palier) * hero.bonus.tailleZones;
    // Une flaque qui dure aide : Concentration l'allonge (§4.13).
    const duree = auPalier(R.duree, palier) * hero.bonus.dureeEffets;
    const point = { x: groupe.x, y: groupe.y };
    const image = this.scene.add
      .image(point.x, point.y, CLE_FLAQUE)
      .setDepth(PROFONDEUR_FLAQUE)
      .setScale((rayon * 2) / LARGEUR_FLAQUE)
      .setFlipX(maintenant % 2 < 1)
      .setAlpha(0);
    this.contexte.cercle(point.x, point.y, rayon, COULEUR_MOUILLE);
    const flaque: Flaque = { point, image, rayon, debut: maintenant, fin: maintenant + duree, prochainBattement: maintenant };
    this.flaques.push(flaque);
    this.poserAuSol(flaque);
  }

  private majFlaques(maintenant: number): void {
    if (this.flaques.length === 0) return;
    const R = BASES.eau;
    const restantes: Flaque[] = [];
    for (const f of this.flaques) {
      if (maintenant >= f.fin) {
        f.image.destroy();
        continue;
      }
      // Elle se pose en un quart de seconde, et seche sur sa derniere seconde.
      const alpha = Math.min(1, (maintenant - f.debut) / 250, (f.fin - maintenant) / 1000);
      f.image.setAlpha(0.85 * alpha);
      if (maintenant >= f.prochainBattement) {
        f.prochainBattement = maintenant + R.battement;
        for (const e of this.contexte.ennemisDansRayon(f.point.x, f.point.y, f.rayon)) {
          e.ralentir(R.battement + 150, R.ralenti);
          e.mouilleJusqua = Math.max(e.mouilleJusqua, maintenant + R.mouille);
        }
      }
      restantes.push(f);
    }
    this.flaques = restantes;
  }

  // --------------------------------------------------------------- la nature

  private lancerNature(hero: Hero): void {
    const R = BASES.nature;
    const palier = Math.max(1, hero.palierDe("nature"));
    const groupe = this.groupeServe(hero.x, hero.y, R.portee, 60);
    if (!groupe) return;
    const maintenant = this.scene.time.now;
    const rayon = auPalier(R.rayon, palier) * hero.bonus.tailleZones;
    // Tenir un monstre aide : Concentration l'allonge (§4.13).
    const tenue = auPalier(R.tenue, palier) * hero.bonus.dureeEffets;
    this.contexte.cercle(groupe.x, groupe.y, rayon, SOL_VERT.clair);

    let dessinees = 0;
    for (const e of this.contexte.ennemisDansRayon(groupe.x, groupe.y, rayon)) {
      // Un geant n'est jamais cloue au sol : ralenti, comme pour l'etourdissement (§4.13).
      if (e.rang !== "pietaille") {
        e.ralentir(tenue, R.ralentiDesGeants);
        continue;
      }
      e.enracineJusqua = Math.max(e.enracineJusqua, maintenant + tenue);
      e.setVelocity(0, 0);
      if (dessinees >= R.racinesDessinees) continue;
      dessinees += 1;
      // Les racines prennent les pieds : posees sur la ligne ou il touche le sol,
      // et juste devant sa bande de profondeur dans la nuee (§4.33).
      const pied = e.y + (e.dansLaNuee ? (TAILLE_ORC * e.archetype.echelle) / 2 : e.displayHeight / 2) - 2;
      const image = this.scene.add
        .image(e.x, pied, CLES_RACINES[(dessinees + Math.floor(e.x)) % CLES_RACINES.length]!)
        .setOrigin(0.5, PIED_RACINES / HAUTEUR_RACINES)
        .setDepth(e.y + 9)
        .setScale(1, 0.2);
      // Elles jaillissent : un dixieme de seconde pour sortir de terre.
      this.scene.tweens.add({ targets: image, scaleY: 1, duration: 110, ease: "Back.Out" });
      this.racines.push({ image, ennemi: e, fin: maintenant + tenue });
    }
  }

  private majRacines(maintenant: number): void {
    if (this.racines.length === 0) return;
    const restantes: Racine[] = [];
    for (const r of this.racines) {
      if (maintenant >= r.fin || !r.ennemi.active) {
        const image = r.image;
        this.scene.tweens.add({ targets: image, alpha: 0, scaleY: 0.3, duration: 160, onComplete: () => image.destroy() });
        continue;
      }
      restantes.push(r);
    }
    this.racines = restantes;
  }

  // -------------------------------------------------------------- le bouclier

  /** Un coup que l'ecran a pris tout entier : il clignote, et des eclats partent du cote du coup. */
  ecranTouche(hero: Hero, depuisX: number, depuisY: number): void {
    this.touchesJusqua.set(hero, this.scene.time.now + 90);
    const d = Math.hypot(depuisX - hero.x, depuisY - hero.y) || 1;
    const r = (COTE_BULLE / 2) * 0.8;
    eclatImpact(this.scene, hero.x + ((depuisX - hero.x) / d) * r, hero.y - 4 + ((depuisY - hero.y) / d) * r, COULEUR_BOUCLIER, 3);
  }

  private majBoucliers(maintenant: number): void {
    for (const hero of this.contexte.heros()) {
      const max = hero.bouclierMax;
      let bulle = this.bulles.get(hero);
      if (max <= 0 || hero.etat === "mort") {
        bulle?.setVisible(false);
        continue;
      }
      const etat = hero.bouclier;
      const reforme = reformer(etat, max, maintenant);
      if (!bulle) {
        bulle = this.scene.add.image(hero.x, hero.y, CLE_BULLE).setTint(COULEUR_BOUCLIER).setScale(0.8);
        this.bulles.set(hero, bulle);
      }
      if (etat.brise) {
        if (!this.brises.has(hero)) {
          this.brises.add(hero);
          this.briser(hero);
        }
        bulle.setVisible(false);
        continue;
      }
      this.brises.delete(hero);
      if (reforme === "revenu") this.contexte.cercle(hero.x, hero.y - 4, 18, COULEUR_BOUCLIER);

      const touche = maintenant < (this.touchesJusqua.get(hero) ?? 0);
      if (touche) bulle.setTintFill(0xffffff);
      else bulle.setTint(COULEUR_BOUCLIER);
      // Plus il est entame, plus il s'efface : on lit ce qui reste sans jauge.
      bulle
        .setVisible(true)
        .setPosition(hero.x, hero.y - 4)
        .setDepth(hero.y + 2)
        .setAlpha(touche ? 0.95 : 0.3 + 0.55 * (etat.pv / max));
    }
  }

  /**
   * L'ecran se brise : des eclats, une onde, et un fracas de metal — « tout le
   * monde l'entend » (§4.13). Le son est la frappe d'enclume du village, en
   * attendant qu'Angelos en choisisse un sur une planche d'ecoute.
   */
  private briser(hero: Hero): void {
    this.contexte.cercle(hero.x, hero.y - 4, 34, COULEUR_BOUCLIER);
    this.contexte.bruit("enclume", hero.x, hero.y);
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2 + 0.3;
      const eclat = this.scene.add
        .image(hero.x + Math.cos(angle) * 12, hero.y - 4 + Math.sin(angle) * 12, CLE_ECLAT_BOUCLIER)
        .setTint(COULEUR_BOUCLIER)
        .setDepth(hero.y + 3)
        .setRotation(angle);
      this.scene.tweens.add({
        targets: eclat,
        x: hero.x + Math.cos(angle) * 36,
        y: hero.y - 4 + Math.sin(angle) * 36 + 10,
        alpha: 0,
        duration: 420,
        ease: "Quad.Out",
        onComplete: () => eclat.destroy(),
      });
    }
    if (hero.estIncarne) this.contexte.flotter(hero.x, hero.y - 30, "BOUCLIER BRISE", "#9db3c4");
  }

  // ------------------------------------------------------------- outillage

  /**
   * Le monstre autour duquel ils sont le plus serres, a `portee` du point.
   *
   * ⚠️ Dans une horde, compter les voisins de chacun couterait des centaines de
   * requetes par sort : on n'en regarde que seize, pris a intervalle regulier.
   */
  private groupeServe(x: number, y: number, portee: number, rayon: number): Ennemi | null {
    const candidats = this.contexte.ennemisDansRayon(x, y, portee);
    if (candidats.length === 0) return null;
    const pas = Math.max(1, Math.floor(candidats.length / CANDIDATS_MAX));
    let meilleur = candidats[0]!;
    let compte = -1;
    for (let i = 0; i < candidats.length; i += pas) {
      const e = candidats[i]!;
      const n = this.contexte.ennemisDansRayon(e.x, e.y, rayon).length;
      if (n > compte) {
        compte = n;
        meilleur = e;
      }
    }
    return meilleur;
  }
}
