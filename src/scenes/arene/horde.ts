import Phaser from "phaser";
import {
  Ennemi,
  Hero,
  Invocation,
  orienter,
  SEUIL_REGARD_PIXELS,
  type Dome,
} from "../../game/entities";
import { teinteDeNuee } from "../../game/ennemis";
import { RANGS } from "../../core/rangs";
import { C as COULEURS } from "../../game/ui/couleurs";
import { type SpriteSurvivant } from "../../game/survivants";
import { COULEUR_MOUILLE } from "../../game/dessin/elements";
import { melanger } from "../../game/dessin/palette";
import { animer } from "../../game/poses";
import { EGLISE } from "../../core/carte";
import { type Villageois } from "../../game/village";
import { Construction } from "../../game/constructions";
import { type Champ } from "../../game/champs";
import { Maison } from "../../game/maisons";
import type { ArenaScene } from "../ArenaScene";
import { TEINTE_FIGEE, RAYON_DE_VUE, VUE_DU_CHASSEUR } from "./reglages";

/**
 * La horde (§4.33) : le voisinage, la nuée, le déplacement et la teinte des monstres, les
 * cibles, les dômes, les poses et la profondeur.
 *
 * Une part d'`ArenaScene`, greffée sur son prototype (`greffer`) : `this` est la scène.
 */
export class ArenaHorde {

  /**
   * La boucle des monstres : un seul parcours par image, comme avant.
   *
   * Elle porte desormais trois choses de plus, et c'est voulu qu'elles soient
   * ici plutot que dans des minuteries : le coup arme qui arrive a echeance,
   * l'engagement du cracheur qui n'attend pas le contact, et la teinte.
   */
  // ------------------------------------------- le voisinage de la horde (§4.33)

  /**
   * Un pas de physique vient d'avancer tous les corps : on range la horde, puis
   * on regle ce que reglaient les dix passes d'Arcade (DESIGN.md §4.33, palier 1).
   *
   * ⚠️ **Ca se passe dans le pas de physique, pas dans `update`** — a l'endroit
   * exact ou Arcade faisait ses passes : les corps ont bouge, et `postUpdate`
   * n'a pas encore recopie leur position dans les sprites. Une butee reglee
   * plus tard laisserait le sprite une image dans le mur.
   */
  pasDeLaHorde(this: ArenaScene): void {
    this.rangerLaHorde();
    this.toucherLaHorde();
    this.buterContreLeDecor();
  }

  /**
   * Range tous les monstres par cellule.
   *
   * On range la position des **sprites**, celle que tout le reste du code lit
   * pendant l'image (`e.x`, `e.y`) et que `postUpdate` ne touchera qu'apres
   * `update`. Les corps, eux, ont deja avance : de combien ils debordent de leur
   * sprite, c'est `margeDeContact`, mesuree ici plutot que supposee.
   */
  rangerLaHorde(this: ArenaScene): void {
    const enfants = this.ennemis.getChildren();
    const n = enfants.length;
    if (this.hordeX.length < n) {
      let taille = this.hordeX.length;
      while (taille < n) taille *= 2;
      this.hordeX = new Float32Array(taille);
      this.hordeY = new Float32Array(taille);
    }
    this.horde.length = n;
    let marge = 0;
    for (let i = 0; i < n; i++) {
      const e = enfants[i] as Ennemi;
      this.horde[i] = e;
      this.hordeX[i] = e.x;
      this.hordeY[i] = e.y;
      const corps = e.body as Phaser.Physics.Arcade.Body | null;
      if (!corps) continue;
      const mx = Math.abs(corps.position.x + corps.halfWidth - e.x) + corps.halfWidth;
      const my = Math.abs(corps.position.y + corps.halfHeight - e.y) + corps.halfHeight;
      if (mx > marge) marge = mx;
      if (my > marge) marge = my;
    }
    this.margeDeContact = marge + 1;
    this.voisinage.ranger(n, this.hordeX, this.hordeY);
  }

  /**
   * Les monstres dont le corps peut recouper celui-ci, dans l'ordre de la liste,
   * **copies** dans `trouvailles` : on peut rappeler n'importe quoi ensuite.
   */
  monstresPresDe(this: ArenaScene, corps: Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody): number {
    const m = this.margeDeContact;
    const n = this.voisinage.rechercher(corps.left - m, corps.top - m, corps.right + m, corps.bottom + m);
    this.trouvailles.length = n;
    for (let k = 0; k < n; k++) this.trouvailles[k] = this.voisinage.trouve(k);
    return n;
  }

  /**
   * Les contacts avec la horde : ce que faisaient les six passes « overlap ».
   *
   * Chaque paire est jugee par `World.separate` en mode contact, la fonction
   * meme qu'Arcade appelait, **dans l'ordre ou les passes etaient branchees** et
   * avec les corps dans le meme ordre. Seule change la facon de trouver les
   * paires : le voisinage au lieu de l'arbre de tous les corps.
   */
  toucherLaHorde(this: ArenaScene): void {
    const monde = this.physics.world;
    const horde = this.horde;
    const trouves = this.trouvailles;

    for (const objet of this.equipe.getChildren()) {
      const hero = objet as Hero;
      const corps = hero.body as Phaser.Physics.Arcade.Body | null;
      if (!corps?.enable) continue;
      const n = this.monstresPresDe(corps);
      for (let k = 0; k < n; k++) {
        const e = horde[trouves[k]!]!;
        if (e.active && monde.separate(corps, e.body as Phaser.Physics.Arcade.Body, undefined, undefined, true)) {
          this.contactEnnemi(hero, e);
        }
      }
    }

    for (const objet of this.projectiles.getChildren()) {
      const p = objet as Phaser.Physics.Arcade.Image;
      const corps = p.body as Phaser.Physics.Arcade.Body | null;
      if (!p.active || !corps?.enable) continue;
      const n = this.monstresPresDe(corps);
      for (let k = 0; k < n; k++) {
        const e = horde[trouves[k]!]!;
        if (e.active && monde.separate(corps, e.body as Phaser.Physics.Arcade.Body, undefined, undefined, true)) {
          this.impactProjectile(p, e);
        }
        // Un projectile qui s'est arrete dans un monstre ne touche plus rien.
        if (!p.active || !corps.enable) break;
      }
    }

    for (const objet of this.invocations.getChildren()) {
      const m = objet as Invocation;
      const corps = m.body as Phaser.Physics.Arcade.Body | null;
      if (!m.active || !corps?.enable) continue;
      const n = this.monstresPresDe(corps);
      for (let k = 0; k < n; k++) {
        const e = horde[trouves[k]!]!;
        if (e.active && monde.separate(corps, e.body as Phaser.Physics.Arcade.Body, undefined, undefined, true)) {
          this.melee(m, e);
        }
        if (!m.active) break;
      }
    }

    for (const objet of this.village.groupe.getChildren()) {
      const v = objet as Villageois;
      const corps = v.body as Phaser.Physics.Arcade.Body | null;
      if (!v.active || !corps?.enable) continue;
      const n = this.monstresPresDe(corps);
      for (let k = 0; k < n; k++) {
        const e = horde[trouves[k]!]!;
        if (e.active && monde.separate(corps, e.body as Phaser.Physics.Arcade.Body, undefined, undefined, true)) {
          this.rattraperHabitant(v, e);
        }
        if (!v.active) break;
      }
    }

    // Les champs et les survivants etaient le second operande de leur passe :
    // le monstre passe en premier, comme Arcade le faisait.
    for (const objet of this.champs.groupe.getChildren()) {
      const c = objet as Champ;
      // Statique ou non, `separate` le prend comme un corps (voir `corpsFixes`).
      const corps = c.body as Phaser.Physics.Arcade.Body | null;
      if (!c.active || !corps?.enable) continue;
      const n = this.monstresPresDe(corps);
      for (let k = 0; k < n; k++) {
        const e = horde[trouves[k]!]!;
        if (e.active && monde.separate(e.body as Phaser.Physics.Arcade.Body, corps, undefined, undefined, true)) {
          this.pietinerChamp(c);
        }
      }
    }

    for (const objet of this.survivants.groupe.getChildren()) {
      const sprite = objet as SpriteSurvivant;
      const corps = sprite.body as Phaser.Physics.Arcade.Body | null;
      if (!sprite.active || !corps?.enable) continue;
      const n = this.monstresPresDe(corps);
      for (let k = 0; k < n; k++) {
        const e = horde[trouves[k]!]!;
        if (e.active && monde.separate(e.body as Phaser.Physics.Arcade.Body, corps, undefined, undefined, true)) {
          this.survivants.blesser(sprite, e.degats);
        }
        if (!sprite.active) break;
      }
    }
  }

  /**
   * Range le decor qui arrete les monstres, dans l'ordre ou leurs passes etaient
   * branchees : les murs, les maisons, l'eglise, l'eau, la roche. Refait a chaque
   * pas : quelques centaines de rectangles, et plus aucun moyen d'oublier un mur
   * pose ou une maison tombee.
   *
   * @returns combien d'emprises
   */
  rangerLeDecor(this: ArenaScene): number {
    let n = 0;
    const ajouter = (objet: Phaser.GameObjects.GameObject, sorte: number) => {
      const corps = objet.body as Phaser.Physics.Arcade.StaticBody | null;
      // Une ruine n'a plus de corps actif : on marche dans les decombres.
      if (!corps?.enable) return;
      if (n >= this.sortesFixes.length) {
        const taille = this.sortesFixes.length * 2;
        const agrandi = <T extends Float32Array | Uint8Array>(t: T): T => {
          const neuf = new (t.constructor as new (n: number) => T)(taille);
          neuf.set(t);
          return neuf;
        };
        this.sortesFixes = agrandi(this.sortesFixes);
        this.fixesX0 = agrandi(this.fixesX0);
        this.fixesY0 = agrandi(this.fixesY0);
        this.fixesX1 = agrandi(this.fixesX1);
        this.fixesY1 = agrandi(this.fixesY1);
      }
      this.sortesFixes[n] = sorte;
      this.corpsFixes[n] = corps as unknown as Phaser.Physics.Arcade.Body;
      this.objetsFixes[n] = objet;
      this.fixesX0[n] = corps.left;
      this.fixesY0[n] = corps.top;
      this.fixesX1[n] = corps.right;
      this.fixesY1[n] = corps.bottom;
      n += 1;
    };
    for (const c of this.constructions.groupe.getChildren()) ajouter(c, 0);
    for (const m of this.maisons.groupe.getChildren()) ajouter(m, 1);
    ajouter(this.eglise.sprite, 2);
    for (const z of this.obstaclesDEau.getChildren()) ajouter(z, 3);
    for (const z of this.obstaclesDeRoche.getChildren()) ajouter(z, 3);
    this.emprises.ranger(n, this.fixesX0, this.fixesY0, this.fixesX1, this.fixesY1);
    return n;
  }

  /**
   * Les butees contre le decor : ce que faisaient les cinq passes « collider ».
   *
   * **La physique ne change pas d'un pixel** : chaque paire est reglee par
   * `World.separate`, la fonction meme qu'Arcade appelait, le monstre en
   * premier, et le decor dans l'ordre des anciennes passes. Ce qui change, c'est
   * comment on trouve les paires : Arcade cherchait, pour chaque monstre et
   * **pour chaque passe**, dans l'arbre de tout le decor — puis verifiait
   * l'appartenance au groupe en le parcourant en entier.
   */
  buterContreLeDecor(this: ArenaScene): void {
    if (this.rangerLeDecor() === 0) return;
    const monde = this.physics.world;
    for (const e of this.horde) {
      if (!e.active) continue;
      const corps = e.body as Phaser.Physics.Arcade.Body | null;
      if (!corps?.enable) continue;
      const n = this.emprises.rechercher(corps.left, corps.top, corps.right, corps.bottom);
      for (let k = 0; k < n; k++) {
        const j = this.emprises.trouve(k);
        const fixe = this.corpsFixes[j]!;
        switch (this.sortesFixes[j]) {
          case 0: {
            const construction = this.objetsFixes[j] as Construction;
            // ⚠️ **Une porte ouverte ne cogne personne** (§4.20) : c'etait la
            // regle de passage de l'ancienne passe, elle reste la meme.
            if (construction.laissePasser) break;
            if (monde.separate(corps, fixe, undefined, undefined, false)) this.cognerConstruction(e, construction);
            break;
          }
          case 1:
            if (monde.separate(corps, fixe, undefined, undefined, false)) {
              this.cognerMaison(e, this.objetsFixes[j] as Maison);
            }
            break;
          case 2:
            if (monde.separate(corps, fixe, undefined, undefined, false)) this.cognerEglise(e);
            break;
          default:
            monde.separate(corps, fixe, undefined, undefined, false);
        }
        // Une maison qui riposte, un kamikaze qui s'ouvre : il peut ne plus etre la.
        if (!e.active) break;
      }
    }
  }

  /**
   * La nuee de cette image (§4.33, palier 2) : chaque orc debout, avec ses quatre
   * canaux. La teinte dit qui c'est, la luminosite la vie qui reste, le rouge le
   * coup encaisse, la taille le rang.
   *
   * ⚠️ **Le rouge dure 120 ms**, comme le veut le §4.33 : l'eclair blanc que pose
   * `blesserEnnemi` n'en dure que 70, on le prolonge de 50. Un monstre sous
   * contrat reste rouge : c'est la marque de l'assassin, elle ne s'efface pas.
   */
  remplirLaNuee(this: ArenaScene): void {
    const nuee = this.nuee;
    if (!nuee) return;
    nuee.commencer();
    const maintenant = this.time.now;
    for (const objet of this.ennemis.getChildren()) {
      const e = objet as Ennemi;
      if (!e.active || !e.dansLaNuee) continue;
      const coup = maintenant < e.flashJusqua + 50 || e.souscontrat;
      // Un boss qui arme son coup se cabre et clignote : dans la horde, c'est le
      // seul qui previent (§4.33). La piétaille, elle, frappe sans prevenir.
      const cabre = e.rang !== "pietaille" && e.enArmement;
      const eclat = cabre && Math.floor(maintenant / 90) % 2 === 0;
      const vie = e.pvMax > 0 ? Math.max(0, Math.min(1, e.pv / e.pvMax)) : 1;
      const corps = e.body as Phaser.Physics.Arcade.Body | null;
      const bouge = !!corps && Math.abs(corps.velocity.x) + Math.abs(corps.velocity.y) > 8;
      nuee.poser(
        e.x,
        e.y,
        e.archetype.echelle * RANGS[e.rang].taille,
        e.flipX ? -1 : 1,
        coup
          ? COULEURS.sangFrais
          : eclat
            ? COULEURS.os
            : // Fige par l'Heure sombre ou le Neant : le temps ne passe plus pour lui.
              maintenant < this.figeJusqua
              ? melanger(teinteDeNuee(e.archetype), TEINTE_FIGEE, 0.8)
              : // Mouille (§4.13) : ca ne fait rien seul, ca se voit — il ruisselle.
                maintenant < e.mouilleJusqua
                ? melanger(teinteDeNuee(e.archetype), COULEUR_MOUILLE, 0.72)
                : teinteDeNuee(e.archetype),
        // Il fonce en mourant, jusqu'a un tiers de sa lumiere : plus sombre, il
        // disparaitrait dans la nuit (vu sur planche, a 25 %).
        coup || eclat ? 1 : 0.35 + 0.65 * vie,
        bouge ? e.phaseDeMarche : -1,
        cabre,
      );
    }
    nuee.finir();
  }

  /**
   * Le niveau de detail temporel (DESIGN.md §4.33, palier 1) : les alentours des
   * heros, marques une fois par image.
   *
   * Un monstre a plus de `RAYON_DE_VUE` de tout heros ne voit personne : il
   * marche sur son cap. Le decider a chaque image ne change rien a ce qu'il
   * fait — seulement a ce qu'il coute. La marque deborde d'une cellule, parce
   * qu'un heros peut s'approcher pendant les trois images ou l'on ne regarde pas.
   */
  marquerLesAlentoursDesHeros(this: ArenaScene): void {
    this.voisinage.effacerLesMarques();
    for (const hero of this.heros) {
      if (hero.etat === "mort") continue;
      this.voisinage.marquer(hero.x, hero.y, RAYON_DE_VUE + this.voisinage.cote);
    }
  }

  deplacerEnnemis(this: ArenaScene): void {
    // Calcule une seule fois par image : c'etait refait pour chaque ennemi.
    this.ciblesPossibles = this.heros.filter((h) => h.estAuCombat && !h.estInvisible);
    const maintenant = this.time.now;
    // Le champ des humains suit le heros, par battements : c'est lui qui fait
    // sortir par la porte ceux qui nous courent apres (§4.29).
    this.suivreLeHeroDesHumains();

    // ⚠️ **Loin de tout heros ou hors de l'ecran, un monstre ne se decide
    // qu'une image sur quatre** (§4.33, palier 1). Entre deux, il garde son
    // elan : Arcade continue de le faire avancer. Ce qui tourne a chaque image
    // quoi qu'il arrive : le coup arme qui part (il blesse), les domes (ils
    // sont autour des heros), et la teinte de ce qui est a l'ecran.
    this.numeroDImage += 1;
    this.marquerLesAlentoursDesHeros();
    const vue = this.cameras.main.worldView;
    const marge = this.voisinage.cote;
    const gauche = vue.x - marge;
    const droite = vue.right + marge;
    const haut = vue.y - marge;
    const bas = vue.bottom + marge;

    // Copie de la liste : un kamikaze qui s'ouvre, ou une riposte qui tue le
    // frappeur, retire un element du groupe **pendant** le parcours. C'est la
    // meme precaution que dans `frapperAuContact`.
    for (const objet of [...this.ennemis.getChildren()]) {
      const e = objet as Ennemi;
      if (!e.active) continue;

      // Le coup arme part-il ? C'est le seul endroit ou un monstre blesse.
      if (e.enArmement && maintenant >= e.instantFrappe) this.resoudreFrappe(e);
      if (!e.active) continue;

      const aLEcran = e.x >= gauche && e.x <= droite && e.y >= haut && e.y <= bas;
      const pleinRegime = aLEcran && this.voisinage.estMarque(e.x, e.y);
      if (pleinRegime || ((this.numeroDImage + e.tourDeDecision) & 3) === 0) {
        // Le cracheur n'attend pas le contact : il engage des qu'il vous voit.
        if (
          !e.enArmement &&
          e.archetype.comportement === "cracheur" &&
          e.peutFrapper(maintenant)
        ) {
          const proie = this.heroLePlusProche(e.x, e.y, e.archetype.portee);
          if (proie) this.armerEnnemi(e, proie);
        }
        this.avancerEnnemi(e, maintenant, pleinRegime);
      }
      // Hors de l'ecran, une teinte ne se voit pas : elle sera juste des la
      // premiere image ou il y entre. Un orc de la nuee, lui, se teinte au dessin.
      if (aLEcran && !e.dansLaNuee) this.teinterEnnemi(e, maintenant);
      this.bloquerParLesDomes(e);
    }
  }

  /**
   * Ou va un monstre.
   *
   * Deux nuances par rapport a « il fonce tout droit » : pendant son armement
   * il ralentit fortement — un coup telegraphie qu'on voit venir mais auquel on
   * ne peut pas echapper ne telegraphie rien — et le cracheur garde ses
   * distances au lieu de venir au contact.
   */
  /**
   * @param chaqueImage faux quand il ne se decide qu'une image sur quatre : ce
   * qui doit durer jusqu'a sa prochaine decision dure d'autant
   */
  avancerEnnemi(this: ArenaScene, e: Ennemi, maintenant: number, chaqueImage = true): void {
    // Tenu par les racines de la Nature (§4.13) : ni sa marche, ni un souffle ne
    // le deplacent. Il frappe encore ce qui vient a son contact.
    if (maintenant < e.enracineJusqua) {
      e.setVelocity(0, 0);
      return;
    }
    // Repousse : son impulsion a la priorite sur sa volonte.
    if (maintenant < e.reculJusqua) return;

    // Faute de heros a portee de vue, il marche sur son cap : l'eglise (§4.22),
    // ou la maison qu'il vient piller (§4.24). Quand elle tombe, il en prend une
    // autre ; quand il n'y en a plus, l'eglise.
    if (e.cibleMaison && (!e.cibleMaison.debout || !e.cibleMaison.active)) {
      e.cibleMaison = this.maisons.laPlusProcheDebout(e.x, e.y);
    }
    const proie = this.cibleDe(e);
    // ⚠️ **Un humain enrage n'a pas de cap, il a quelqu'un** (§4.29) : il ne
    // marche pas sur l'eglise, c'est la sienne. Il vient pour nous, et il nous
    // suit meme hors de vue — on ne sème pas un village qu'on a refuse en lui
    // tournant le dos.
    const capHumain = e.humain ? (this.hero.etat !== "mort" ? this.hero : null) : null;
    // ⚠️ **Une bete de camp garde son terrain** (§4.31, decision d'Angelos).
    // Des qu'elle s'en est trop ecartee, son cap redevient le camp, meme si
    // elle voit encore quelqu'un : c'est ce qui permet d'aller voir une grosse
    // cache, de juger, et de faire demi-tour.
    const rentre =
      e.campeSur &&
      Phaser.Math.Distance.Between(e.x, e.y, e.campeSur.x, e.campeSur.y) > e.rayonDuCamp
        ? e.campeSur
        : null;
    const cible = rentre ?? proie ?? capHumain ?? e.cibleMaison?.centre ?? EGLISE;
    let angle = Phaser.Math.Angle.Between(e.x, e.y, cible.x, cible.y);
    // Un lac, un massif, une douve en eau entre lui et son cap : il suit le
    // parcours (§4.29) au lieu de buter dedans. Une proie en vue se poursuit
    // droit. La ligne se verifie tous les quarts de seconde, pas par image.
    if (e.humain) {
      // ⚠️ **Un humain ne defonce pas le mur de son propre village.** Vu en
      // jeu : ils partaient droit sur nous et restaient colles a leur enceinte,
      // a trois pixels pres pendant des secondes. Ils prennent donc la porte —
      // le champ des humains, celui-la meme qui amene celui qui vient parler.
      if (maintenant >= e.ligneVerifieeA + 250) {
        e.ligneVerifieeA = maintenant;
        e.ligneLibre = this.parcours.ligneLibre(e, cible, (c) => this.passeUnVillageois(c));
      }
      if (!e.ligneLibre) {
        const suivre = this.cheminDesHumains?.direction(e.x, e.y);
        if (suivre) angle = Math.atan2(suivre.y, suivre.x);
      }
    } else if (!proie) {
      if (maintenant >= e.ligneVerifieeA + 250) {
        e.ligneVerifieeA = maintenant;
        e.ligneLibre = this.parcours.ligneLibre(e, cible, (c) => this.passeUnMonstre(c));
      }
      if (!e.ligneLibre) {
        const suivre = this.parcours.direction(e.x, e.y);
        if (suivre) angle = Math.atan2(suivre.y, suivre.x);
      }
    }
    // Une douve en eau devant lui : il ne nage pas, il cherche la porte (§4.20).
    angle = this.constructions.contournement(e.x, e.y, angle) ?? angle;
    orienter(e, Math.cos(angle), SEUIL_REGARD_PIXELS);
    // Une douve seche sous lui : il la franchit lentement, a decouvert.
    const fosse = this.constructions.ralentissement(e.x, e.y);
    // Ralenti d'une image a l'autre : decide une image sur quatre, il doit tenir
    // jusqu'a la prochaine, sinon la douve seche le lacherait entre deux.
    if (fosse < 1) e.ralentir(chaqueImage ? 120 : 120 + 3 * this.game.loop.delta, fosse);

    // Il se cabre : il n'avance quasiment plus, on a le temps de s'ecarter.
    const vitesse = e.vitesseEffective * (e.enArmement ? 0.25 : 1);

    if (e.archetype.comportement === "cracheur") {
      const distance = Phaser.Math.Distance.Between(e.x, e.y, cible.x, cible.y);
      const bonne = e.archetype.portee * 0.75;
      if (distance < bonne * 0.7) {
        // Trop pres : il recule pour retrouver sa distance de tir.
        e.setVelocity(-Math.cos(angle) * vitesse * 0.7, -Math.sin(angle) * vitesse * 0.7);
        return;
      }
      if (distance < bonne) {
        e.setVelocity(0, 0);
        return;
      }
    }

    e.setVelocity(Math.cos(angle) * vitesse, Math.sin(angle) * vitesse);
  }

  /**
   * La couleur dit ce qu'il est et ce qu'il fait, dans cet ordre de priorite :
   * l'eclair d'encaissement, le contrat, l'armement, le ralentissement, puis la
   * teinte de son archetype.
   */
  teinterEnnemi(this: ArenaScene, e: Ennemi, maintenant: number): void {
    if (maintenant < e.flashJusqua) {
      e.setTintFill(0xffffff);
      return;
    }
    // Un ennemi sous contrat reste marque en rouge jusqu'a la fin.
    if (e.souscontrat) {
      e.setTint(0xff3b30);
      return;
    }
    // L'Heure sombre, et le Neant qui la contient (§4.25) : le temps est arrete,
    // et ca se voit. Avant, la teinte etait posee une fois et cette fonction
    // l'ecrasait a l'image suivante.
    if (maintenant < this.figeJusqua) {
      e.setTint(TEINTE_FIGEE);
      return;
    }
    if (e.enArmement) {
      // L'avertissement. Le kamikaze, lui, clignote : c'est une meche.
      if (e.archetype.comportement === "kamikaze") {
        if (Math.floor(maintenant / 80) % 2 === 0) e.setTintFill(0xffe0b0);
        else e.setTint(0xff7a2f);
        return;
      }
      e.setTint(0xffd166);
      return;
    }
    if (maintenant < e.ralentiJusqua) {
      e.setTint(0x8ed6ff);
      return;
    }
    if (maintenant < e.mouilleJusqua) {
      e.setTint(COULEUR_MOUILLE);
      return;
    }
    e.setTint(e.teinte ?? 0xffffff);
  }

  /** Le heros ciblable le plus proche, pour ce qui vise a distance. */
  heroLePlusProche(this: ArenaScene, x: number, y: number, portee: number): Hero | null {
    let meilleur: Hero | null = null;
    let meilleureDistance = portee;
    for (const h of this.ciblesPossibles) {
      const d = Phaser.Math.Distance.Between(x, y, h.x, h.y);
      if (d < meilleureDistance) {
        meilleureDistance = d;
        meilleur = h;
      }
    }
    return meilleur;
  }

  /**
   * Qui un ennemi vise. Trois regles se superposent :
   * la Provocation force sa cible, l'invisibilite retire une cible, et la
   * discretion de l'assassin le fait passer apres les autres.
   */
  /**
   * Ce que vise un monstre.
   *
   * **Il vient pour le village, pas pour vous.** C'etait la contrepartie
   * obligatoire annoncee au §4.6, et elle manquait : tant qu'un monstre visait
   * le heros le plus proche ou qu'il fut, un joueur prudent avait interet a se
   * planquer — il attirait ainsi toute la vague sur lui et **protegeait ses
   * habitants sans rien faire**. Se cacher etait la meilleure defense possible.
   *
   * Un heros n'est donc une cible que s'il est **a portee de vue**. Au-dela, le
   * monstre continue vers **l'eglise** et mange ce qu'il croise en chemin : un
   * pecheur sur sa plage, une palissade, un champ. Se planquer devient
   * exactement ce que le design promettait — le moyen le plus rapide de tout
   * perdre.
   *
   * Le cap est desormais l'eglise et non le centre abstrait du village (§4.22).
   * Ca ne change presque rien geometriquement — elle est posee au centre — mais
   * ca change tout pour le joueur : il y a maintenant **un batiment** entre eux
   * et lui, avec des points de vie, qu'il peut voir tomber.
   */
  cibleDe(this: ArenaScene, e: Ennemi): { x: number; y: number } | null {
    // Une invocation provocatrice passe avant tout le reste.
    if (e.attirePar?.active && !e.attirePar.furtif) return e.attirePar;
    if (e.provoquePar?.estAuCombat && !e.provoquePar.estInvisible) return e.provoquePar;

    const candidats = this.ciblesPossibles;
    if (candidats.length === 0) return null;

    // Un simple parcours : trier a chaque image pour chaque ennemi coutait
    // beaucoup plus cher que le probleme ne le meritait.
    let premier: Hero | null = null;
    let meilleure = e.chasseur ? RAYON_DE_VUE * VUE_DU_CHASSEUR : RAYON_DE_VUE;
    let expose: Hero | null = null;
    let meilleureExpose = Infinity;

    for (const h of candidats) {
      const d = Phaser.Math.Distance.Between(e.x, e.y, h.x, h.y);
      if (d < meilleure) {
        meilleure = d;
        premier = h;
      }
      // L'assassin n'est vise qu'a defaut d'une autre cible a portee raisonnable.
      if (!h.bonus.discretion && d < 220 && d < meilleureExpose) {
        meilleureExpose = d;
        expose = h;
      }
    }

    if (premier?.bonus.discretion && expose) return expose;
    return premier;
  }

  bloquerParLesDomes(this: ArenaScene, e: Ennemi): void {
    for (const dome of this.domes) {
      const distance = Phaser.Math.Distance.Between(e.x, e.y, dome.x, dome.y);
      if (distance > dome.rayon) continue;

      // Repousse l'ennemi hors du dome et l'y fait taper.
      const angle = Phaser.Math.Angle.Between(dome.x, dome.y, e.x, e.y);
      e.setPosition(dome.x + Math.cos(angle) * dome.rayon, dome.y + Math.sin(angle) * dome.rayon);
      if (!e.peutFrapper(this.time.now)) continue;
      e.marquerCoup(this.time.now);
      dome.pv -= e.degats;
      dome.image.setAlpha(0.15 + 0.3 * (dome.pv / dome.pvMax));
      if (dome.pv <= 0) this.detruireDome(dome);
    }
  }

  detruireDome(this: ArenaScene, dome: Dome): void {
    this.effetCercle(dome.x, dome.y, dome.rayon, 0x8ed6ff);
    dome.image.destroy();
    this.domes = this.domes.filter((d) => d !== dome);
  }

  /**
   * Le balancement de marche et les poses, pour tout ce qui se bat.
   *
   * Un sinus par combattant et par image, rien de plus : c'est assez leger pour
   * les 240 ennemis du plafond (§4.17, regle 5). Aucune minuterie, aucun objet
   * cree — l'etat tient dans quatre nombres portes par chaque entite.
   */
  majPoses(this: ArenaScene): void {
    const maintenant = this.time.now;

    const animerEntite = (objet: Hero | Ennemi | Invocation) => {
      const corps = objet.body as Phaser.Physics.Arcade.Body | null;
      animer(objet, objet.pose, corps ? corps.velocity.length() : 0, maintenant);
    };

    for (const hero of this.heros) {
      // Un mort ne se balance pas : il reste a plat, le temps qu'on le pleure.
      if (hero.etat === "mort") continue;
      animerEntite(hero);
    }
    for (const objet of this.ennemis.getChildren()) {
      const e = objet as Ennemi;
      // La nuee ne s'anime pas : sa marche se calcule au dessin (§4.33).
      if (e.active && !e.dansLaNuee) animerEntite(e);
    }
    for (const objet of this.invocations.getChildren()) {
      const i = objet as Invocation;
      if (i.active) animerEntite(i);
    }
  }

  trierProfondeurs(this: ArenaScene): void {
    // L'occupant d'une tour est **sur** elle : sa profondeur est celle de la
    // tour, pas celle de ses pieds, qui sont plus haut dans l'image que le pied
    // de la tour et le feraient passer derriere.
    const perche = this.tourDuHero?.occupant ?? null;
    for (const hero of this.heros) hero.setDepth(hero === perche ? this.tourDuHero!.depth + 1 : hero.y);
    for (const objet of this.ennemis.getChildren()) {
      const e = objet as Ennemi;
      // La nuee se range par bandes, pas par profondeur (§4.33, palier 2).
      if (!e.dansLaNuee) e.setDepth(e.y);
    }
  }
}
