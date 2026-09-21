/**
 * La memoire du village (DESIGN.md §4.26).
 *
 * > **Tout evenement important doit laisser une trace sur au moins un
 * > personnage, une relation, un batiment ou le village.**
 *
 * C'est la regle qui fait tenir la section, et tout le reste en decoule. Sans
 * elle, le jeu est une boucle : apparition, combat, amelioration, vague. Avec
 * elle, c'est une chaine qui **s'accumule** au lieu de se repeter.
 *
 * Ce fichier porte trois choses, et les relations vivent a cote
 * (`relations.ts`) :
 *
 * - les **souvenirs**, courts et bornes, qu'une personne garde d'elle-meme ;
 * - les **archives** du village : des evenements **types**, jamais du texte
 *   libre, avec un lieu, une date, des acteurs, une gravite et des effets qui
 *   s'estompent ;
 * - le **recit**, assemble a partir de gabarits remplis avec les vrais noms et
 *   les vrais chiffres.
 *
 * ⚠️ **Assemble, pas genere.** Aucune ecriture libre, aucun modele de langue :
 * des gabarits et des variables. C'est moins impressionnant sur le papier et
 * infiniment plus fiable — un texte assemble ne raconte jamais quelque chose qui
 * n'a pas eu lieu, et c'est exactement ce qui doit etre garanti pour que le
 * joueur y croie.
 *
 * ⚠️ **Aucun texte n'est construit tant qu'on ne l'affiche pas** (§4.26). Un
 * evenement stocke ses variables ; la phrase n'est assemblee qu'au moment ou le
 * joueur ouvre les archives.
 *
 * Ce fichier ne connait pas Phaser.
 */

import { Relations, type LienVu } from "./relations";

// ------------------------------------------------------------ les souvenirs

/**
 * Ce dont on se souvient. **Des types, jamais du texte** — c'est la meme regle
 * que pour les traits (§4.23) : trente souvenirs sur trente personnes, ca se
 * compte.
 */
export type CleSouvenir =
  | "a-survecu"
  | "a-vu-mourir"
  | "a-perdu-un-proche"
  | "a-sauve"
  | "a-ete-sauve"
  | "a-tenu-seul"
  | "a-craque"
  | "a-failli-mourir"
  | "a-ete-accueilli"
  | "s-est-eveille"
  | "a-herite";

/**
 * Ceux qui ne s'effacent jamais (§4.26).
 *
 * La mort d'un proche, une nuit tenue seul, un eveil : ce sont les souvenirs qui
 * font qu'on raconte sa partie au lieu de la resumer. Les autres tournent.
 */
const FONDATEURS: readonly CleSouvenir[] = [
  "a-perdu-un-proche",
  "a-tenu-seul",
  "s-est-eveille",
  "a-herite",
];

export function estFondateur(cle: CleSouvenir): boolean {
  return FONDATEURS.includes(cle);
}

/**
 * ⚠️ **Huit entrees au maximum par personne** (§4.26). Sans ce plafond, trente
 * habitants sur cinquante nuits produisent des milliers d'entrees que personne
 * ne lira jamais et qu'il faudra pourtant parcourir.
 */
export const SOUVENIRS_MAX = 8;

export interface Souvenir {
  cle: CleSouvenir;
  jour: number;
  /** Qui d'autre etait dedans — un nom, deja fige : le mort n'a plus de fiche */
  qui?: string;
  /** Le chiffre du souvenir, quand il en a un (des morts, des secondes) */
  combien?: number;
}

/** Le gabarit de chaque souvenir. `{qui}` et `{combien}` s'y remplissent. */
const PHRASES_SOUVENIR: Record<CleSouvenir, string> = {
  "a-survecu": "A survecu a l'attaque de la nuit {combien}",
  "a-vu-mourir": "A vu mourir {qui}",
  "a-perdu-un-proche": "A perdu {qui}",
  "a-sauve": "A sauve {qui}",
  "a-ete-sauve": "A ete ramene par {qui}",
  "a-tenu-seul": "A tenu un front seul",
  "a-craque": "A craque, la nuit {combien}",
  "a-failli-mourir": "En est revenu",
  "a-ete-accueilli": "A ete accueilli le jour {combien}",
  "s-est-eveille": "S'est reveille : le don etait la depuis toujours",
  "a-herite": "A recu ce que {qui} laissait",
};

/** La phrase d'un souvenir, assemblee **au moment de l'afficher**. */
export function direLeSouvenir(souvenir: Souvenir): string {
  return remplir(PHRASES_SOUVENIR[souvenir.cle], {
    qui: souvenir.qui ?? "quelqu'un",
    combien: souvenir.combien ?? 0,
  });
}

/**
 * Ajoute un souvenir a une liste bornee.
 *
 * Les plus anciens sortent — **sauf les fondateurs**. Quand il n'y a plus que
 * des fondateurs, c'est le plus ancien d'entre eux qui cede : une liste qui ne
 * peut plus rien accepter serait pire qu'une liste qui oublie.
 */
export function seSouvenir(liste: Souvenir[], souvenir: Souvenir): Souvenir[] {
  // Deux fois le meme souvenir le meme jour avec le meme acteur : c'est le
  // meme evenement vu deux fois, pas deux souvenirs.
  const deja = liste.some(
    (s) => s.cle === souvenir.cle && s.jour === souvenir.jour && s.qui === souvenir.qui,
  );
  if (deja) return liste;

  liste.push(souvenir);
  while (liste.length > SOUVENIRS_MAX) {
    const index = liste.findIndex((s) => !estFondateur(s.cle));
    liste.splice(index === -1 ? 0 : index, 1);
  }
  return liste;
}

// ------------------------------------------------------------- les archives

/**
 * Ce dont le village se souvient, lui (§4.26). Chaque type porte des effets qui
 * durent **quelques jours**, puis s'estompent — l'evenement reste aux archives.
 */
export type TypeEvenement =
  | "massacre"
  | "grande-victoire"
  | "famine"
  | "sacrifice"
  | "premiere-fois";

export interface EffetsDuVillage {
  /** Points de satisfaction, en plus ou en moins (§4.23) */
  satisfaction: number;
  /** Part de natalite, en plus ou en moins — les naissances viennent plus tard */
  natalite: number;
  /** Part de chance qu'un arrivant se presente a la porte (§4.18) */
  recrutement: number;
  /** Part de degats des combattants du village */
  agressivite: number;
}

export interface TypeEvenementDef {
  cle: TypeEvenement;
  /** Le titre du recit : « LE MASSACRE DU PONT » */
  titre: string;
  /** Combien de journees ses effets durent */
  journees: number;
  effets: EffetsDuVillage;
  /**
   * Le sacrifice remonte apres etre descendu (§4.26) : « deuil, puis fierte ».
   * La part de sa duree passee dans le deuil, avant la bascule.
   */
  bascule?: number;
}

/**
 * **La table des evenements du village.** Un seul endroit a toucher pour les
 * re-regler, comme partout ailleurs.
 *
 * *Chiffres tranches par le code, a corriger en jouant.* Ils sortent tous du
 * tableau du §4.26, qui les donnait deja : satisfaction −10 et recrutement
 * +15 % pour un massacre, satisfaction +20 pour une grande victoire.
 */
export const EVENEMENTS: Record<TypeEvenement, TypeEvenementDef> = {
  massacre: {
    cle: "massacre",
    titre: "LE MASSACRE",
    journees: 4,
    // On se venge : plus de volontaires, et ceux qui restent frappent plus fort.
    effets: { satisfaction: -10, natalite: -0.05, recrutement: 0.15, agressivite: 0.1 },
  },
  "grande-victoire": {
    cle: "grande-victoire",
    titre: "LA NUIT TENUE",
    journees: 3,
    effets: { satisfaction: 20, natalite: 0.05, recrutement: 0.1, agressivite: 0 },
  },
  famine: {
    cle: "famine",
    titre: "LA FAMINE",
    journees: 3,
    effets: { satisfaction: -12, natalite: -0.1, recrutement: -0.1, agressivite: 0 },
  },
  sacrifice: {
    cle: "sacrifice",
    titre: "LA NUIT DE",
    journees: 6,
    // Le deuil d'abord, la fierte ensuite — voir `bascule`.
    effets: { satisfaction: 14, natalite: 0, recrutement: 0.1, agressivite: 0.05 },
    bascule: 0.4,
  },
  "premiere-fois": {
    cle: "premiere-fois",
    titre: "LA PREMIERE FOIS",
    journees: 2,
    effets: { satisfaction: 6, natalite: 0, recrutement: 0.05, agressivite: 0 },
  },
};

export interface Evenement {
  type: TypeEvenement;
  jour: number;
  /** Le heros de l'histoire, quand il y en a un */
  qui?: string;
  /** Ou ca s'est passe, dit en mots : « a la porte du nord » */
  lieu?: string;
  /** Le chiffre qui compte : des morts, des survivants, des secondes */
  combien?: number;
  /** Un second chiffre, quand le recit en demande deux */
  aussi?: number;
  /** Ce que la personne faisait avant : « boulanger » */
  metier?: string;
  /** Ce qu'il a pris pour se defendre, quand il s'est defendu */
  arme?: string;
  /**
   * Les faits qu'on sait de lui, sans valeur a ecrire.
   *
   * ⚠️ **C'est ce qui empeche le recit de mentir par omission.** Une ligne comme
   * « Il n'avait jamais combattu » ne porte aucune variable : sans ce drapeau,
   * elle survivait a tout et le jeu l'affirmait d'un milicien. Vu sur une
   * capture le 21 septembre 2026, pour un pecheur mort a son poste : « Tancrede
   * a pris une epee », alors qu'il n'avait jamais rien pris du tout.
   */
  faits?: string[];
}

function effetsVierges(): EffetsDuVillage {
  return { satisfaction: 0, natalite: 0, recrutement: 0, agressivite: 0 };
}

/**
 * Ce que le village garde.
 *
 * ⚠️ **Les effets courants sont calcules a l'inscription et a chaque journee,
 * jamais par image** (§4.17). Le jeu lit `effets`, qui est un objet deja prêt.
 */
export class Archives {
  private readonly evenements: Evenement[] = [];
  private courants: EffetsDuVillage = effetsVierges();

  /** Une borne dure : une partie de cent nuits ne doit pas gonfler sans fin. */
  constructor(private readonly gardes = 60) {}

  get tout(): readonly Evenement[] {
    return this.evenements;
  }

  /** Les effets en cours, deja agreges. C'est ce que le jeu lit. */
  get effets(): EffetsDuVillage {
    return this.courants;
  }

  /** Les evenements encore actifs, du plus recent au plus ancien. */
  vifs(jour: number): Evenement[] {
    return this.evenements
      .filter((e) => jour - e.jour < EVENEMENTS[e.type].journees)
      .sort((a, b) => b.jour - a.jour);
  }

  inscrire(evenement: Evenement): void {
    this.evenements.push(evenement);
    if (this.evenements.length > this.gardes) this.evenements.shift();
    this.recalculer(evenement.jour);
  }

  /** Une journee passe : ce qui s'estompe s'estompe. */
  avancerAuJour(jour: number): void {
    this.recalculer(jour);
  }

  exporter(): Evenement[] {
    return this.evenements.map((e) => ({ ...e }));
  }

  importer(entrees: readonly Evenement[], jour: number): void {
    this.evenements.length = 0;
    for (const e of entrees) {
      if (!e || !(e.type in EVENEMENTS) || typeof e.jour !== "number") continue;
      this.evenements.push({ ...e });
    }
    this.recalculer(jour);
  }

  /**
   * ⚠️ **Le sacrifice descend puis remonte** (§4.26) : « deuil, puis fierte : la
   * satisfaction descend puis remonte au-dessus ». Le premier tiers de sa duree
   * coute ce qu'il rapportera ensuite.
   */
  private recalculer(jour: number): void {
    const total = effetsVierges();
    for (const evenement of this.evenements) {
      const def = EVENEMENTS[evenement.type];
      const age = jour - evenement.jour;
      if (age < 0 || age >= def.journees) continue;

      const signe =
        def.bascule !== undefined && age < def.journees * def.bascule ? -1 : 1;
      total.satisfaction += def.effets.satisfaction * signe;
      total.natalite += def.effets.natalite;
      total.recrutement += def.effets.recrutement;
      total.agressivite += def.effets.agressivite;
    }
    this.courants = total;
  }
}

// --------------------------------------------------------------- le recit

/**
 * Les gabarits, une ligne par ligne du recit.
 *
 * Le §4.26 en donne un en entier, et c'est celui du sacrifice :
 *
 * ```text
 * LA NUIT DE MARC
 *
 * Marc etait boulanger.
 * Il n'avait jamais combattu.
 * A la nuit 17, les defenseurs sont tombes.
 * Marc a pris une epee.
 * Il a tenu la porte pendant 43 secondes.
 * 7 habitants ont survecu.
 * Marc est mort.
 * ```
 *
 * ⚠️ **Une ligne dont une variable manque est retiree**, jamais laissee a
 * blanc : « Il a tenu la porte pendant undefined secondes » serait exactement le
 * mensonge que le systeme existe pour eviter.
 *
 * ⚠️ **Et `{?variable}` en tete d'une ligne la conditionne sans rien y ecrire.**
 * Vu en test : « Il n'avait jamais combattu. » ne porte aucune variable, donc
 * elle survivait a l'absence du metier — et le jeu affirmait d'un inconnu qu'il
 * n'avait jamais combattu. Une ligne qui depend d'un fait doit tomber avec lui.
 */
const RECITS: Record<TypeEvenement, string[]> = {
  massacre: [
    "La nuit {jour}, {lieu} a cede.",
    "{combien} sont tombes.",
    "{aussi} ont survecu.",
    "Le village a compte ses morts au matin.",
  ],
  "grande-victoire": [
    "La nuit {jour}, ils sont venus {lieu}.",
    "{qui} a tenu.",
    "{combien} elimines avant l'aube.",
    "Personne n'est tombe.",
  ],
  famine: [
    "Le jour {jour}, les reserves etaient vides.",
    "{combien} n'ont pas mange.",
    "On a regarde le Protecteur.",
  ],
  sacrifice: [
    "{qui} etait {metier}.",
    "{?civil}Il n'avait jamais combattu.",
    "{?defenseurs}A la nuit {jour}, les defenseurs sont tombes.",
    "{?arme}{qui} a pris {arme}.",
    "{?lieu}Il a tenu {lieu} pendant {combien} secondes.",
    "{?aussi}{aussi} habitants ont survecu.",
    "{?jour}{qui} est tombe le jour {jour}.",
  ],
  "premiere-fois": ["Le jour {jour}, {qui} a fait ce que personne n'avait fait.", "{lieu}."],
};

function remplir(gabarit: string, valeurs: Record<string, string | number>): string {
  return gabarit.replace(/\{(\w+)\}/g, (_, cle: string) => String(valeurs[cle] ?? ""));
}

/**
 * Le titre d'un evenement, tel que les archives l'affichent.
 *
 * ⚠️ **Il ne promet pas une nuit a qui est tombe en plein jour.** Vu sur une
 * capture le 21 septembre 2026 : « LA NUIT DE BERTILLE » pour une pecheuse
 * morte a son poste au matin du jour 2. C'est la meme regle que pour le recit —
 * on ne raconte que ce qui a eu lieu.
 */
export function titreDe(evenement: Evenement): string {
  const def = EVENEMENTS[evenement.type];
  if (evenement.type === "sacrifice" && evenement.qui) {
    const quand = evenement.faits?.includes("nuit") ? "LA NUIT DE" : "LE JOUR DE";
    return `${quand} ${evenement.qui.toUpperCase()}`;
  }
  if (evenement.type === "massacre" && evenement.lieu) {
    return `${def.titre} ${evenement.lieu.toUpperCase()}`;
  }
  return def.titre;
}

/**
 * Le recit, assemble **au moment ou on le lit**.
 *
 * Toute ligne dont une variable manque disparait. C'est le garde-fou du §4.26 :
 * un texte assemble ne raconte jamais quelque chose qui n'a pas eu lieu.
 */
export function raconter(evenement: Evenement): string[] {
  const valeurs: Record<string, string | number> = { jour: evenement.jour };
  if (evenement.qui !== undefined) valeurs.qui = evenement.qui;
  if (evenement.lieu !== undefined) valeurs.lieu = evenement.lieu;
  if (evenement.combien !== undefined) valeurs.combien = evenement.combien;
  if (evenement.aussi !== undefined) valeurs.aussi = evenement.aussi;
  if (evenement.metier !== undefined) valeurs.metier = evenement.metier;
  if (evenement.arme !== undefined) valeurs.arme = evenement.arme;

  // Ce qu'on **sait** : les variables qu'on peut ecrire, plus les faits nus.
  const connus = new Set([...Object.keys(valeurs), ...(evenement.faits ?? [])]);

  const lignes: string[] = [];
  for (const gabarit of RECITS[evenement.type]) {
    // Les conditions muettes d'abord : `{?civil}` decide, puis disparait.
    const conditions = [...gabarit.matchAll(/\{\?(\w+)\}/g)];
    if (conditions.some((m) => !connus.has(m[1]!))) continue;
    const nu = gabarit.replace(/\{\?\w+\}/g, "");
    const manque = [...nu.matchAll(/\{(\w+)\}/g)].some((m) => valeurs[m[1]!] === undefined);
    if (manque) continue;
    lignes.push(remplir(nu, valeurs));
  }
  return lignes;
}

// -------------------------------------------------- ce qu'une mort produit

/**
 * Ce qu'une mort produit, en une fois (§4.26).
 *
 * > Une mort ne doit **jamais** etre `pv = 0 → retirer(personnage)`.
 *
 * Cette fonction ne touche a rien : elle **decrit** ce qu'il faut appliquer.
 * C'est ce qui la rend testable sans le jeu autour, et c'est l'appelant qui
 * sait poser un trait, monter un stress et inscrire une tombe.
 */
export interface SuitesDeLaMort {
  /** Qui perd un proche, et le trait que ca lui donne */
  endeuilles: { qui: string; trait: "endeuille" | "aguerri" | null; facteurStress: number }[];
  /** Qui peut heriter, s'il y a quelqu'un */
  heritier: LienVu | null;
  /** L'evenement a inscrire aux archives, quand la mort en merite un */
  evenement: Evenement | null;
}

/**
 * @param mort        l'identifiant de celui qui tombe
 * @param nom         son nom, deja fige : il n'aura plus de fiche
 * @param temoins     ceux qui etaient assez pres pour voir (§4.23)
 * @param vivants     tous ceux qui restent, temoins ou non
 * @param relations   la memoire sociale du village
 * @param jour        la journee en cours
 * @param courageDe   le courage de chacun : c'est lui qui decide du trait
 */
export function suitesDeLaMort(
  mort: string,
  nom: string,
  temoins: readonly string[],
  vivants: readonly string[],
  relations: Relations,
  jour: number,
  courageDe: (qui: string) => number,
  /** Ce qu'on sait de sa mort : son metier, s'il s'est defendu, ou il est tombe */
  details: Partial<Evenement> = {},
): SuitesDeLaMort {
  const endeuilles: SuitesDeLaMort["endeuilles"] = [];
  for (const temoin of temoins) {
    if (temoin === mort) continue;
    const facteur = relations.facteurDeDeuil(temoin, mort);
    // « Certains en sortent plus courageux, d'autres plus peureux — selon leur
    // trait » (§4.26). Le courage tranche, et seule une mort qui comptait le
    // fait basculer : voir tomber un inconnu ne change personne.
    const trait = facteur < 1.5 ? null : courageDe(temoin) >= 55 ? "aguerri" : "endeuille";
    endeuilles.push({ qui: temoin, trait, facteurStress: facteur });
  }

  const heritier = relations.leProche(
    mort,
    vivants.filter((v) => v !== mort),
  );

  return {
    endeuilles,
    heritier,
    evenement: evenementDeLaMort(mort, nom, relations, jour, details),
  };
}

/**
 * Une mort merite-t-elle les archives ?
 *
 * **Non, la plupart du temps**, et c'est le sujet. Une partie qui inscrirait
 * chaque mort produirait un mur de titres qui ne veulent plus rien dire. Seule
 * celle qui laisse quelqu'un derriere — un proche, au sens des relations —
 * devient une histoire.
 */
function evenementDeLaMort(
  mort: string,
  nom: string,
  relations: Relations,
  jour: number,
  details: Partial<Evenement>,
): Evenement | null {
  const liens = relations.lesLiensDe(mort);
  const proches = liens.filter((l) => l.intensite >= 40);
  if (proches.length === 0) return null;
  return { ...details, type: "sacrifice", jour, qui: nom };
}
