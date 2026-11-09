import Phaser from "phaser";
import { Rng } from "../../core/rng";
import {
  ARBRES_MORTS,
  ARBRES_VIVANTS,
  CONIFERES,
  ROCHERS,
  decorParCle,
  CLE_CHARRETTE,
  CLE_CORDE_A_LINGE,
  CLE_FILETS,
  CLE_PUITS,
  CLE_TAS_DE_BOIS,
  CLE_TONNEAU,
} from "../../game/dessin/decor";
import { CLE_MASQUE_EAU, ECHELLE_DU_MASQUE } from "../../game/dessin/morceaux";
import { Cour } from "../../game/cour";
import {
  distanceALEau,
  EGLISE,
  estTerreFerme,
  MONDE,
  PORT,
  POSTES,
  terrainEn,
  type Terrain,
} from "../../core/carte";
import { CASE, Grille } from "../../core/grille";
import { cleCase, type PlanVillage, type Segment } from "../../core/village";
import { PONT_LEVIS, REMPLISSAGE, amelioration, coutEnClair } from "../../core/constructions";
import { Maisons, REGLAGES_MAISONS } from "../../game/maisons";
import { cuireLesBatiments } from "../../game/dessin/batiments";
import { CLE_MUR_RUINE, ORIGINE_MUR_Y } from "../../game/dessin/murs";
import { poserLaMer, releverLeRivage } from "../../game/dessin/mer";
import type { ArenaScene } from "../ArenaScene";

/**
 * S'installer : la carte qui se peint par morceaux, le décor, les détails de vie, le
 * village et son enceinte, le survol.
 *
 * Une part d'`ArenaScene`, greffée sur son prototype (`greffer`) : `this` est la scène.
 */
export class ArenaInstallation {

  /**
   * On s'installe : le jour 1 commence ici, et pas avant.
   *
   * C'est ce moment-la qui remplace l'ancien depart du jeu — village fixe,
   * sept heros, jour 1 des la premiere image. Tout ce qui etait fait dans
   * `create` a la naissance d'une partie neuve est fait ici : le premier
   * visiteur offert, le compte a rebours des hordes, et la premiere sauvegarde.
   *
   * @param donneeALaParole vrai quand on vient de repondre a la porte ; faux
   *        quand la partie commence deja installee (une capture, un test)
   */
  sInstaller(this: ArenaScene, donneeALaParole: boolean): void {
    this.enMarche = false;
    this.gardien = null;
    // ⚠️ **Ce qu'on portait devient le grenier, et la route s'arrete la**
    // (§4.31, point 4). Les caches n'existent pas en partie installee : la
    // restauration du village (jalon 8) est le systeme qui recompensera
    // l'exploration a partir de ce moment.
    this.verserLeButinDeLaRoute();
    this.caches.vider();
    // Ceux qu'on a ramasses sur la route deviennent des habitants de plus
    // (§4.31) : un metier de plus, un toit de plus a relever, et — depuis le
    // §4.29 — une chance de plus qu'un heros naisse avec un don (bloc 9).
    this.installerLesCompagnons();
    // Le champ des humains ne sert plus a personne : on le jette plutot que de
    // le laisser se refaire pendant toute la partie (§4.17).
    this.cheminDesHumains = null;

    if (donneeALaParole) {
      this.events.emit("annonce", "Tu as donne ta parole. Ce village est le tien.", "toi");
    }
    this.events.emit("annonce", "Jour 1 — le village se reveille", "village");
    // ⚠️ **Le ciel du premier jour se tire ici, pas a l'aube** (§4.21). L'aube
    // n'arrive qu'au bout d'une journee entiere : sans ce tirage, la premiere
    // journee de toute partie serait seche, et le ciel n'existerait qu'a partir
    // de la deuxieme. Meme raison que le premier visiteur, offert juste en
    // dessous — un systeme qu'on ne rencontre jamais n'existe pas.
    this.meteo.passerLaJournee(this.rng);
    this.annoncerLeCiel();
    // ⚠️ **Le premier visiteur est offert**, des le premier matin (decision du
    // 10 aout 2026). Au rythme de croisiere — un tous les 2 a 3 jours — la
    // premiere porte se serait ouverte apres des heures de jeu. On peut
    // apprendre un jeu pendant deux heures sans jamais rencontrer un de ses
    // systemes : c'est ce qu'on evite ici. Le rythme, lui, ne bouge pas.
    this.prochaineArriveeJournee = 1;
    // ⚠️ **Les malades se decouvrent ici, jamais avant.** Le budget les a
    // achetes avec le reste (§4.29), et le village s'est bien garde de les
    // mentionner a la porte : ce qui ne se voit pas de loin ne se dit pas.
    const malades = this.village.poserLesMalades(this.menaces.malades);
    if (malades.length > 0) {
      this.events.emit(
        "annonce",
        malades.length === 1
          ? `${malades[0]} est malade — ils ne l'avaient pas dit`
          : `${malades.join(", ")} sont malades — ils ne l'avaient pas dit`,
        "village",
      );
    }
    // Le temps de la partie commence a l'installation : la marche n'est pas du
    // temps de survie, et les hordes ne doivent pas avoir couru pendant.
    this.debut = this.time.now;
    this.prochaineApparition = this.time.now + 1200;
    this.programmerHorde();
    this.enregistrer();
  }

  /**
   * Fait avancer la peinture de la carte dans le budget d'une image (§4.29).
   *
   * **Elle regarde la ou on regarde** : le morceau le plus proche du heros
   * cuit avant le fond de la carte, et le joueur ne voit donc jamais la
   * vignette floue la ou il marche. Une fois tout cuit, cet appel ne fait plus
   * que verifier qu'il n'y a rien a faire.
   */
  avancerLaCarte(this: ArenaScene): void {
    const carte = this.carte;
    if (!carte) return;
    const hero = this.hero;
    if (hero) carte.regarder(hero.x, hero.y);
    carte.avancer();
  }

  /**
   * La carte du village (DESIGN.md §4.6) : la mer a l'ouest, la montagne au
   * sud, et le village blotti dans l'angle. Les deux fronts restent ouverts au
   * nord et a l'est.
   *
   * Tout est pose une fois pour toutes ici. Rien de ce decor n'est recree en
   * cours de partie (§4.17).
   */
  construireDecor(this: ArenaScene): void {
    // Les batiments dessines par le code (§4.30). Cuits une fois, avant qu'on
    // en pose un seul : `add.image` sur une cle inconnue donne un carre vert.
    cuireLesBatiments(this);

    // Le sol : la vignette du monde en fond, puis les morceaux nets qui s'y
    // posent en cuisant (§4.29). Ce qu'on a sous les yeux a la premiere image
    // est peint tout de suite ; le reste suit image par image.
    this.carte?.poser(-1000);

    // ⚠️ **L'eau bouge par-dessus, jamais dedans.** Un morceau de carte est une
    // texture figee : rien ne peut y etre anime. La mer et le sable d'origine
    // sont gardes pour leur couleur, cette couche n'ajoute que le mouvement
    // (§4.30).
    this.mer = poserLaMer(this, MONDE, releverLeRivage(MONDE, distanceALEau), CLE_MASQUE_EAU, ECHELLE_DU_MASQUE);

    this.semerLeDecor();
    this.construireVillage();
    // ⚠️ Plus de ronds ni de noms au sol pour la plage, les champs, la mine et
    // la foret (18 septembre 2026, §4.30) : on reconnait un lieu a ce qu'il y a
    // dessus, et ce qui manque encore (mine, ponton, buches) viendra au bloc 7a.
  }

  /**
   * Arbres et rochers, semes avec une graine fixe pour que la carte soit la
   * meme d'une partie a l'autre : on doit pouvoir apprendre son terrain.
   *
   * Chaque graine est refusee si elle ne tombe pas sur le bon sol. Sans ce
   * filtre, il poussait des arbres dans la mer et au milieu du village.
   */
  semerLeDecor(this: ArenaScene): void {
    // La graine du monde entre dans celle du decor : deux mondes n'ont pas les
    // memes arbres, et le meme monde a toujours les siens.
    const rng = new Rng(20260807 + this.graineMonde);

    const semer = (
      essais: number,
      sols: Terrain[],
      poser: (x: number, y: number) => void,
      zone?: { x0: number; x1: number; y0: number; y1: number },
    ) => {
      const cadre = zone ?? { x0: 0, x1: MONDE.largeur, y0: 0, y1: MONDE.hauteur };
      for (let i = 0; i < essais; i++) {
        const x = rng.range(cadre.x0, cadre.x1);
        const y = rng.range(cadre.y0, cadre.y1);
        if (!sols.includes(terrainEn(x, y))) continue;
        // Le village est une place, pas une clairiere : rien n'y pousse. C'est
        // le plan qui dit ou elle s'arrete — murs compris, avec une case de
        // marge pour qu'aucun arbre ne pousse dans un pan.
        if (this.planVillage.emprise.has(cleCase(this.grille.colonneDe(x), this.grille.ligneDe(y)))) continue;
        poser(x, y);
      }
    };

    /**
     * Un element de decor, pose a sa taille native, **le pied sur le sol**.
     *
     * Plus de `setScale(rng.range(...))` : une echelle fractionnaire donne des
     * pixels de tailles inegales, ce qui saute aux yeux sur du vrai pixel-art.
     * La variete vient des silhouettes dessinees par le code et du miroir
     * horizontal, qui ne coutent aucun flou. L'origine est celle du decor : c'est
     * le pied qui decide de la profondeur, pas le milieu de l'image.
     */
    const poser = (x: number, y: number, cle: string) => {
      this.add
        .image(x, y, cle)
        .setOrigin(0.5, decorParCle(cle).origineY)
        .setDepth(y)
        .setFlipX(rng.next() < 0.5);
    };

    /**
     * Les tirages sont exprimes **par million de pixels de carte**, pas en
     * nombre absolu : agrandir le monde ne doit pas le vider. Un compte fixe
     * repartit les memes arbres sur une surface plus grande, et la foret se
     * clairseme toute seule des qu'on touche a `MONDE`.
     */
    const tirages = (parMegapixel: number) =>
      Math.round(((MONDE.largeur * MONDE.hauteur) / 1_000_000) * parMegapixel);

    // La foret du sud. Elle doit etre **dense** : c'est elle qui rend le flanc
    // sud credible. Des coniferes sombres pour la moitie, et le reste partage
    // entre arbres vivants et arbres morts — une foret d'apres la fin du monde.
    semer(tirages(830), ["sous-bois"], (x, y) => {
      const tirage = rng.next();
      poser(x, y, rng.pick(tirage < 0.5 ? CONIFERES : tirage < 0.75 ? ARBRES_VIVANTS : ARBRES_MORTS));
    });

    // Des bosquets epars sur la prairie, morts pour la plupart : le decor ne
    // doit jamais etre un fond uni, mais il ne doit pas non plus masquer les
    // personnages (§4.11).
    semer(tirages(365), ["herbe"], (x, y) => {
      if (rng.next() > 0.22) return;
      poser(x, y, rng.pick(rng.next() < 0.65 ? ARBRES_MORTS : ARBRES_VIVANTS));
    });

    // Les rochers, sur l'eboulis et au pied de la montagne.
    semer(tirages(470), ["eboulis", "roche"], (x, y) => {
      if (rng.next() > 0.3) return;
      poser(x, y, rng.pick(ROCHERS));
    });
  }

  /**
   * Les details de vie (§4.24, 19 septembre 2026) : un puits sur la place, des
   * tonneaux et du bois contre les maisons debout, une charrette en retrait
   * d'une porte. Du decor tire de la graine du village — rien qui bloque, rien
   * qui se sauve, jamais sur une rue.
   *
   * ⚠️ Ils ne suivent pas une maison qu'on deplace ou qu'on demolit : c'est le
   * prix d'un decor, et il est accepte pour l'instant.
   */
  poserLesDetailsDeVie(this: ArenaScene): void {
    const plan = this.planVillage;
    const rng = new Rng(plan.graine + 97);
    const distanceAuSegment = (x: number, y: number, s: Segment) => {
      const dx = s.a.x - s.de.x;
      const dy = s.a.y - s.de.y;
      const l2 = dx * dx + dy * dy;
      const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((x - s.de.x) * dx + (y - s.de.y) * dy) / l2));
      return Math.hypot(x - (s.de.x + dx * t), y - (s.de.y + dy * t));
    };
    const libre = (x: number, y: number) => {
      const c = this.grille.caseEn(x, y);
      if (!c || c.occupation !== "libre" || !plan.place.has(cleCase(c.colonne, c.ligne))) return false;
      return !this.ruesDuVillage.some((r) => distanceAuSegment(x, y, r) < 14);
    };
    // Ce que chaque detail occupe autour de son pied : deux details ne se
    // chevauchent jamais (le linge mordait sur la charrette et sur le puits,
    // juge sur capture le 20 septembre 2026).
    const RAYONS: Record<string, number> = {
      [CLE_PUITS]: 14,
      [CLE_TONNEAU]: 8,
      [CLE_TAS_DE_BOIS]: 13,
      [CLE_CHARRETTE]: 18,
      [CLE_CORDE_A_LINGE]: 20,
      [CLE_FILETS]: 18,
    };
    const poses: { x: number; y: number; rayon: number }[] = [];
    const loinDesAutres = (x: number, y: number, cle: string) =>
      poses.every((p) => Math.hypot(p.x - x, p.y - y) >= p.rayon + (RAYONS[cle] ?? 12));
    const poser = (x: number, y: number, cle: string, miroir = rng.next() < 0.5) => {
      if (!this.textures.exists(cle)) return;
      this.add.image(x, y, cle).setOrigin(0.5, decorParCle(cle).origineY).setDepth(y).setFlipX(miroir);
      poses.push({ x, y, rayon: RAYONS[cle] ?? 12 });
    };

    // Le puits : a trois cases de l'eglise, dans la premiere direction qui a de la place.
    const DIRECTIONS = [[3, 0], [0, 3], [-3, 0], [0, -3], [3, 3], [3, -3], [-3, 3], [-3, -3]] as const;
    const depart = Math.floor(rng.next() * DIRECTIONS.length);
    for (let i = 0; i < DIRECTIONS.length; i++) {
      const [dc, dl] = DIRECTIONS[(depart + i) % DIRECTIONS.length]!;
      const c = Grille.centreCase(plan.centre.colonne + dc, plan.centre.ligne + dl);
      if (!libre(c.x, c.y)) continue;
      poser(c.x, c.y + 6, CLE_PUITS, false);
      // On retient ou il est : c'est la que les seaux se remplissent (§4.21).
      this.puits = { x: c.x, y: c.y + 6 };
      break;
    }

    // Des tonneaux a droite des maisons debout, du bois a gauche — pas partout.
    for (const maison of this.maisons.toutes) {
      if (!maison.debout) continue;
      const centre = maison.centre;
      const droite = { x: centre.x + CASE + 8, y: centre.y + CASE - 6 };
      if (rng.next() < 0.75 && libre(droite.x, droite.y)) {
        poser(droite.x, droite.y, CLE_TONNEAU);
        if (rng.next() < 0.5) poser(droite.x + 9, droite.y + 3, CLE_TONNEAU);
      }
      const gauche = { x: centre.x - CASE - 12, y: centre.y + CASE - 8 };
      if (rng.next() < 0.6 && libre(gauche.x, gauche.y)) poser(gauche.x, gauche.y, CLE_TAS_DE_BOIS);
    }

    // Une charrette, en retrait de la premiere rue qui sort par une porte.
    const portes = new Set(
      plan.enceinte
        .filter((m) => m.piece === "porte")
        .map((m) => {
          const c = Grille.centreCase(m.colonne, m.ligne);
          return `${c.x},${c.y}`;
        }),
    );
    const rue = this.ruesDuVillage.find((r) => portes.has(`${r.a.x},${r.a.y}`));
    if (rue) {
      const dx = rue.de.x - rue.a.x;
      const dy = rue.de.y - rue.a.y;
      const l = Math.hypot(dx, dy) || 1;
      const ux = dx / l;
      const uy = dy / l;
      for (const cote of [1, -1]) {
        const x = rue.a.x + ux * 48 - uy * 22 * cote;
        const y = rue.a.y + uy * 48 + ux * 22 * cote;
        if (!libre(x, y)) continue;
        poser(x, y, CLE_CHARRETTE, cote < 0);
        break;
      }
    }

    // Du linge devant chaque maison debout (20 septembre 2026) : une corde d'une
    // case de large, juste sous l'emprise, d'un cote ou de l'autre de la porte.
    // Les deux bouts doivent etre libres aussi, sinon elle mordrait sur une rue
    // ou sur la voisine. La marge de la place suffit (rien n'y pousse) : les
    // maisons du sud ont la lisiere sous leur emprise, pas la place.
    const libreDevantUneMaison = (x: number, y: number) => {
      const c = this.grille.caseEn(x, y);
      if (!c || c.occupation !== "libre" || !plan.emprise.has(cleCase(c.colonne, c.ligne))) return false;
      if (!estTerreFerme(x, y)) return false;
      return !this.ruesDuVillage.some((r) => distanceAuSegment(x, y, r) < 14);
    };
    for (const maison of this.maisons.toutes) {
      if (!maison.debout) continue;
      const cote = rng.next() < 0.5 ? -6 : 6;
      const y = maison.centre.y + CASE + 10;
      // pres de la porte d'abord, puis decale vers un coin si un detail gene
      for (const x of [maison.centre.x + cote, maison.centre.x - cote, maison.centre.x + 3 * cote, maison.centre.x - 3 * cote]) {
        if (!libreDevantUneMaison(x, y) || !libreDevantUneMaison(x - 14, y) || !libreDevantUneMaison(x + 14, y)) continue;
        if (!loinDesAutres(x, y, CLE_CORDE_A_LINGE)) continue;
        poser(x, y, CLE_CORDE_A_LINGE);
        break;
      }
    }

    // Des filets qui sechent au poste de peche, et contre le port : depuis que
    // les ronds de poste sont partis (18 septembre 2026), c'est a eux de dire
    // ou l'on peche. Sur le sable, jamais sur la rue qui y mene, et a plus
    // d'une case du point ou l'on travaille — les pecheurs s'y tiennent. Le
    // sable libre est etroit (une case entre le port et l'eau) : on cherche le
    // plus pres du lieu, et on prend le premier qui passe.
    const libreSurLeSable = (x: number, y: number) => {
      const c = this.grille.caseEn(x, y);
      if (!c || c.occupation !== "libre" || terrainEn(x, y) !== "sable") return false;
      return !this.ruesDuVillage.some((r) => distanceAuSegment(x, y, r) < 16);
    };
    const plage = POSTES.find((p) => p.id === "plage");
    const lieux = [...(plage ? [plage.position] : []), { x: PORT.x, y: PORT.y }];
    for (const lieu of lieux) {
      const candidats: { x: number; y: number; d: number }[] = [];
      for (let dy = -72; dy <= 72; dy += 24) {
        for (let dx = -48; dx <= 48; dx += 16) {
          const d = Math.hypot(dx, dy);
          if (d >= 36) candidats.push({ x: lieu.x + dx, y: lieu.y + dy, d });
        }
      }
      candidats.sort((a, b) => a.d - b.d || a.y - b.y || a.x - b.x);
      const emplacement = candidats.find(
        (c) =>
          libreSurLeSable(c.x, c.y) &&
          libreSurLeSable(c.x - 14, c.y) &&
          libreSurLeSable(c.x + 14, c.y) &&
          loinDesAutres(c.x, c.y, CLE_FILETS),
      );
      if (emplacement) poser(emplacement.x, emplacement.y, CLE_FILETS);
    }
  }

  /**
   * Le village : ce que le plan de la graine en dit (§4.24). Il est adosse a
   * la mer et a la montagne, et ses habitants arrivent avec le village vivant.
   */
  construireVillage(this: ArenaScene): void {
    // ⚠️ L'enceinte n'est plus posee ici : elle est faite de **vraies
    // constructions** (corps, points de vie, raccords), donc elle attend que le
    // parc existe — voir `dresserLEnceinte`, appele depuis le village vivant.
    //
    // Les maisons, elles, sont un parc a part (§4.24) : debout ou en ruine
    // selon le plan, ou telles que la sauvegarde les a laissees. Une sauvegarde
    // d'avant le 19 septembre 2026 n'en a pas : elle reprend celles du plan.
    this.maisons = new Maisons(this, this.grille);
    if (this.reprise?.maisons) this.maisons.reprendre(this.reprise.maisons);
    else this.maisons.poserLePlan(this.planVillage.maisons);

    // La cour d'entrainement (§4.18, bloc 9). Un village trouve n'en a jamais :
    // c'est le Protecteur qui la batit, et c'est le seul batiment du jeu qui
    // fabrique des heros.
    this.cour = new Cour(this, this.grille);
    if (this.reprise?.cour) this.cour.reprendre(this.reprise.cour);
    this.poserLesDetailsDeVie();

    // ⚠️ **Plus de texte « LE VILLAGE » qui flotte, et plus de disque de terre
    // battue** (§4.24, §4.30) : on reconnait un lieu a ce qu'il y a dessus. Le
    // sol de place et les chemins sont des **etats de case** — ils reviendront
    // ecrits dans la grille, pas peints dans la carte.
  }

  /**
   * L'enceinte de depart : ce que le village avait deja quand on arrive.
   *
   * Elle vient du **plan** (`core/village.ts`) : la forme, une tour a chaque
   * angle et a chaque bout, les portes la ou l'on sort travailler, et des
   * breches — le village est en ruine (§4.6). Ce sont de **vraies
   * constructions** (corps, points de vie, raccords), pas un decor : un mur du
   * joueur qui s'y accole se raccorde, et les monstres doivent l'abattre ou
   * passer par les breches.
   *
   * ⚠️ **Sur une partie reprise, on ne dresse que les breches.** Les murs, les
   * tours et les portes reviennent par la sauvegarde, avec leurs points de vie
   * et sans ceux qui sont tombes : les redresser ici les ferait renaitre.
   */
  dresserLEnceinte(this: ArenaScene, plan: PlanVillage, seulementLesRuines: boolean): void {
    for (const piece of plan.enceinte) {
      const centre = Grille.centreCase(piece.colonne, piece.ligne);
      if (piece.piece === "ruine") {
        if (!this.grille.constructible(centre.x, centre.y, true)) continue;
        this.grille.poser(centre.x, centre.y, "ruine");
        this.add
          .image(centre.x, centre.y, CLE_MUR_RUINE)
          .setOrigin(0.5, ORIGINE_MUR_Y)
          .setDepth(centre.y + CASE / 2);
        continue;
      }
      if (seulementLesRuines) continue;
      this.constructions.dresser(centre.x, centre.y, piece.piece);
    }
    if (seulementLesRuines) return;
    // Les douves que le village avait deja (§4.29, 20 septembre 2026) : creusees
    // sans rien payer, en eau si le plan le dit, et chaque porte devant l'eau
    // est deja un pont-levis. Une partie reprise les retrouve dans sa sauvegarde.
    for (const douve of plan.douves) {
      const centre = Grille.centreCase(douve.colonne, douve.ligne);
      const creusee = this.constructions.dresser(centre.x, centre.y, "douve");
      if (creusee && douve.eau) this.constructions.remplirDeForce(creusee);
    }
    for (const porte of this.constructions.portes) this.constructions.dresserEnPontLevis(porte);
  }

  /**
   * Ce qu'il y a sous la souris, et son etat (§4.24) : une maison, un mur, une
   * tour, une porte, l'eglise ou le port. Rien d'autre ne porte de nom ecrit.
   */
  majSurvol(this: ArenaScene, p: Phaser.Input.Pointer): void {
    if (this.termine) return;
    const monde = this.cameras.main.getWorldPoint(p.x, p.y);
    let texte: string | null = null;
    let x = monde.x;
    let y = monde.y;

    const maison = this.maisons.en(monde.x, monde.y);
    const construction = this.constructions.en(monde.x, monde.y);
    if (maison) {
      const c = maison.centre;
      x = c.x;
      y = maison.y;
      texte = maison.debout
        ? `${maison.nom} — ${Math.ceil(maison.pv)}/${REGLAGES_MAISONS.pvMax}`
        : `${maison.nom} en ruine — L pour la relever, ${REGLAGES_MAISONS.coutBois} bois`;
    } else if (construction && construction.def.id === "douve") {
      x = construction.x;
      y = construction.y - CASE / 2;
      texte = construction.eau
        ? construction.pont
          ? "Douve en eau, sous le pont-levis"
          : "Douve en eau — rien ne la franchit"
        : `Douve seche — on la franchit au ralenti · N puis clic : l'eau, ${coutEnClair(REMPLISSAGE.cout)}`;
    } else if (construction) {
      x = construction.x;
      y = construction.y - CASE / 2;
      const suite = amelioration(construction.def, construction.matiere);
      const touche = construction.def.id === "porte" ? "K" : "G";
      const renfort = suite ? ` · ${touche} puis clic : ${suite.matiere}, ${coutEnClair(suite.palier.cout)}` : "";
      const palier = construction.matiere === "bois" ? "" : ` en ${construction.matiere}`;
      const nom = construction.pontLevis ? "Pont-levis" : construction.def.nom;
      const etat = construction.battant
        ? construction.battant.phase === "ouverte"
          ? ", ouverte"
          : construction.battant.phase === "fermee"
            ? ", fermee"
            : construction.battant.phase === "s-ouvre"
              ? ", s'ouvre"
              : ", se ferme"
        : "";
      const pont =
        construction.battant && !construction.pontLevis && !this.constructions.refusPontLevis(construction, this.village.stocks)
          ? ` · K puis clic : pont-levis, ${coutEnClair(PONT_LEVIS.cout)}`
          : "";
      texte = `${nom}${palier}${etat} — ${Math.ceil(construction.pv)}/${construction.pvMax}${renfort}${pont}`;
    } else if (Phaser.Math.Distance.Between(monde.x, monde.y, EGLISE.x, EGLISE.y) <= EGLISE.emprise) {
      x = EGLISE.x;
      y = EGLISE.y - EGLISE.emprise;
      texte = this.eglise.fonctionne
        ? `Eglise, niveau ${this.eglise.niveau} — ${Math.ceil(this.eglise.regles.pv)} PV`
        : "Eglise a terre — Y pour la relever";
    } else if (Phaser.Math.Distance.Between(monde.x, monde.y, PORT.x, PORT.y) <= PORT.emprise) {
      x = PORT.x;
      y = PORT.y - PORT.emprise;
      texte = this.port.regles.etat === "debout" ? "Le port — P pour vendre" : "Le port, en ruine — P pour le relever";
    }

    if (!texte) {
      this.survol.setVisible(false);
      return;
    }
    this.survol.setText(texte).setPosition(x, y - 4).setVisible(true);
  }
}
