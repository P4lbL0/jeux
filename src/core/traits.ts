/**
 * Les traits et les sequelles (DESIGN.md §4.23).
 *
 * Deux couches sur les cinq du §4.23, et il ne faut jamais les confondre :
 *
 * - un **trait** vaut peu — 2 a 5 %, un seuil decale, un delai change — et la
 *   plupart sont mauvais. On en accumule autant qu'on veut ;
 * - une **sequelle** est enorme et definitive, et elle ne s'obtient **que** en
 *   survivant au stade Mourant (`etats.ts`). Elle casse volontairement la regle
 *   des 2 a 5 %, et elle est la seule a le faire.
 *
 * ⚠️ **Ce fichier porte la contrainte de fluidite la plus dure du bloc.** Trente
 * traits sur trente personnes, ca se compte : les traits sont donc stockes par
 * **identifiant numerique** (l'index dans `TRAITS`), jamais par texte, et leurs
 * effets sont **agreges une seule fois** par `agreger()` quand quelque chose
 * change. Rien ici ne doit etre appele par image (§4.17, regle 5).
 */

/**
 * Tout ce qu'un trait, une sequelle ou un etat peut modifier.
 *
 * **Un seul objet, un seul agregat.** Chaque champ est lu directement par le
 * code de jeu, sans passer par une liste de traits : c'est ce qui permet a un
 * veteran de porter trente traits sans que ca coute plus cher qu'aucun.
 *
 * Les multiplicateurs valent 1 quand rien ne change ; les additifs valent 0.
 */
export interface Modificateurs {
  // ---- multiplicateurs
  /** Degats au combat */
  degats: number;
  /** Points de vie maximum */
  pvMax: number;
  /** Vitesse de deplacement */
  vitesse: number;
  /** Cadence de production (§4.18) */
  cadence: number;
  /** Ce que la recolte a la main rapporte */
  recolte: number;
  /** Ce qu'il mange par jour */
  appetit: number;
  /** A quelle vitesse son stress monte */
  monteeStress: number;
  /** A quelle vitesse son stress redescend */
  descenteStress: number;
  /** Ce que la mort d'un proche lui coute en stress */
  stressParMort: number;
  /** A quelle vitesse ses etats s'aggravent — sous 1, il tient plus longtemps */
  aggravationEtats: number;
  /** A quel point il attrape ce qui traine */
  contagion: number;
  /** Ce que l'eglise lui rend, soins et stress confondus */
  soinEglise: number;
  /** Ce que lui coute ce qu'il batit — sous 1, il batit moins cher (Intelligence) */
  coutBati: number;
  /** A quelle vitesse il monte de niveau (Intelligence) */
  monteeNiveau: number;

  // ---- additifs
  /**
   * Ce qui s'ajoute au seuil de repli des 20 % (§4.3).
   *
   * ⚠️ C'est **le seul champ qui touche a la regle des 20 %**, et il ne la casse
   * pas : un courageux decroche a 15 %, un peureux a 30 %, mais tous decrochent.
   * L'IA ne perd toujours jamais un heros.
   */
  seuilRepli: number;
  /** Chance de coup critique */
  critique: number;
  /** Chance d'esquive */
  esquive: number;
  /** Sous quoi son stress ne redescend plus jamais, en points (Regard vide) */
  plancherStress: number;
  /**
   * Ce qu'il fait au stress de ses voisins, en points par minute.
   *
   * Negatif, il les calme ; positif, il les use. C'est ce qui transforme le
   * placement des gens dans le village en decision (§4.23).
   */
  stressVoisins: number;

  // ---- drapeaux
  /** Faux avec une main mutilee : plus aucun coup critique, jamais */
  peutCritiquer: boolean;
  /** Etre dehors la nuit ne lui coute rien (Nyctalope) */
  ignoreStressNuit: boolean;
  /** La nuit ne lui rend plus de stress (Insomniaque) */
  sansReposNocturne: boolean;
  /** Les monstres le visent en priorite (Marque) */
  cibleEnPriorite: boolean;
  /** Il met le feu en craquant (Pyromane) — le feu arrive au jalon 6 */
  feuEnCraquant: boolean;
  /** Il vole de temps en temps, et ca le calme (Kleptomane) */
  vole: boolean;

  // ---- ce qui regarde qui est en face (§4.23, §4.29)
  /**
   * Multiplie ses degats **contre un humain**, en plus de `degats`.
   *
   * ⚠️ Il a fallu un champ a part, et pas un simple `degats` : les deux traits
   * qui regardent qui est en face sont des **inverses** — le Bourreau est bon
   * contre les hommes et mauvais contre les betes. Un seul multiplicateur ne
   * sait pas dire ca.
   */
  degatsContreHumain: number;
  /**
   * Il peut refuser de frapper un humain (Misericordieux).
   *
   * C'est le **premier trait qui desobeit** (§4.23), et le §4.12 exige qu'il
   * l'annonce : un heros qui s'arrete sans prevenir serait vecu comme un bug.
   */
  refuseDeFrapperUnHumain: boolean;
}

/** Un agregat neutre : personne ne modifie rien. */
export function modificateursVierges(): Modificateurs {
  return {
    degats: 1,
    pvMax: 1,
    vitesse: 1,
    cadence: 1,
    recolte: 1,
    appetit: 1,
    monteeStress: 1,
    descenteStress: 1,
    stressParMort: 1,
    aggravationEtats: 1,
    contagion: 1,
    soinEglise: 1,
    coutBati: 1,
    monteeNiveau: 1,
    seuilRepli: 0,
    critique: 0,
    esquive: 0,
    plancherStress: 0,
    stressVoisins: 0,
    peutCritiquer: true,
    ignoreStressNuit: false,
    sansReposNocturne: false,
    cibleEnPriorite: false,
    feuEnCraquant: false,
    vole: false,
    degatsContreHumain: 1,
    refuseDeFrapperUnHumain: false,
  };
}

/** Ce qu'un trait ou une sequelle change, tout le reste etant laisse tel quel. */
export type Effets = Partial<Modificateurs>;

/**
 * D'ou vient un trait.
 *
 * `naissance` se tire a la creation, `exploit` s'accroche en vivant. La
 * distinction n'est pas cosmetique : le §4.23 interdit qu'un trait d'exploit
 * tombe au hasard, la condition est **toujours quelque chose que le joueur a
 * fait**.
 */
export type OrigineTrait = "naissance" | "exploit" | "stele" | "heritage" | "deuil";

export type CleTrait =
  // les quinze de naissance
  | "courageux"
  | "peureux"
  | "robuste"
  | "maladif"
  | "chanceux"
  | "vif"
  | "placide"
  | "colerique"
  | "pieux"
  | "bavard"
  | "nyctalope"
  | "gourmand"
  | "hemophile"
  | "kleptomane"
  | "sang-froid"
  // les deux qui regardent qui est en face (§4.29 les a reveilles)
  | "misericordieux"
  | "bourreau-d-hommes"
  // les onze d'exploit
  | "veteran"
  | "endurci"
  | "hante"
  | "insomniaque"
  | "pyromane"
  | "devot"
  | "routinier"
  | "marque"
  | "boucher"
  | "deracine"
  | "legende-locale"
  // les six des steles (§4.31, jalon 5.6)
  | "serment-de-fer"
  | "oeil-du-veilleur"
  | "pas-du-loup"
  | "souffle-long"
  | "main-du-batisseur"
  | "coeur-scelle"
  // ceux qui viennent d'un mort (§4.26, bloc 11)
  | "heritier"
  | "endeuille"
  | "aguerri";

export interface TraitDef {
  cle: CleTrait;
  nom: string;
  /** Une ligne, telle qu'elle s'affiche sur la fiche */
  resume: string;
  origine: OrigineTrait;
  /**
   * Bon, mauvais, ou les deux.
   *
   * La fiche s'en sert pour la couleur, et rien d'autre. Le §4.23 veut que le
   * joueur voie d'un coup d'oeil que **la plupart sont mauvais** — c'est la
   * moitie de l'interet du systeme.
   */
  humeur: "bon" | "mauvais" | "mixte";
  effets: Effets;
  /**
   * Duree en journees de jeu, ou `null` s'il est definitif.
   *
   * Un seul trait est temporaire — le Deracine — mais l'exception doit vivre
   * dans la table plutot que dans un `if` perdu ailleurs.
   */
  duree?: number;
}

/**
 * **La table des traits.** C'est le seul endroit a toucher pour en ajouter un,
 * en retirer un, ou re-regler ce qu'il vaut.
 *
 * L'ordre compte : l'index dans ce tableau **est** l'identifiant numerique
 * stocke sur les personnes. On ajoute donc a la fin, on ne reordonne jamais.
 */
export const TRAITS: TraitDef[] = [
  // ------------------------------------------------------ de naissance
  {
    cle: "courageux",
    nom: "Courageux",
    resume: "Sort defendre l'eglise ; decroche a 15 % au lieu de 20 %",
    origine: "naissance",
    humeur: "bon",
    effets: { seuilRepli: -0.05 },
  },
  {
    cle: "peureux",
    nom: "Peureux",
    resume: "Lache son poste bien plus tot ; decroche a 30 %",
    origine: "naissance",
    humeur: "mauvais",
    effets: { seuilRepli: 0.1 },
  },
  {
    cle: "robuste",
    nom: "Robuste",
    resume: "Les etats mortels mettent bien plus longtemps a le tuer",
    origine: "naissance",
    humeur: "bon",
    effets: { aggravationEtats: 0.6 },
  },
  {
    cle: "maladif",
    nom: "Maladif",
    resume: "Attrape tout, et plus vite",
    origine: "naissance",
    humeur: "mauvais",
    effets: { aggravationEtats: 1.5, contagion: 2 },
  },
  {
    cle: "chanceux",
    nom: "Chanceux",
    resume: "Un peu plus de recolte, un peu moins de mauvais tirages",
    origine: "naissance",
    humeur: "bon",
    effets: { recolte: 1.05 },
  },
  {
    cle: "vif",
    nom: "Vif",
    resume: "Se deplace plus vite, travaille au meme rythme",
    origine: "naissance",
    humeur: "bon",
    effets: { vitesse: 1.08 },
  },
  {
    cle: "placide",
    nom: "Placide",
    resume: "Son stress monte lentement",
    origine: "naissance",
    humeur: "bon",
    effets: { monteeStress: 0.8 },
  },
  {
    cle: "colerique",
    nom: "Colerique",
    resume: "Son stress monte vite, mais il frappe plus fort",
    origine: "naissance",
    humeur: "mixte",
    effets: { monteeStress: 1.25, degats: 1.05 },
  },
  {
    cle: "pieux",
    nom: "Pieux",
    resume: "L'eglise le soigne et le calme plus vite",
    origine: "naissance",
    humeur: "bon",
    effets: { soinEglise: 1.3 },
  },
  {
    cle: "bavard",
    nom: "Bavard",
    resume: "Stresse un peu ses voisins, mais les remonte quand il va bien",
    origine: "naissance",
    humeur: "mixte",
    // Le signe se decide a l'usage, selon son propre stress : c'est
    // `rayonnement()` qui tranche, pas la table.
    effets: { stressVoisins: 0.12 },
  },
  {
    cle: "nyctalope",
    nom: "Nyctalope",
    resume: "Ignore la montee de stress due au fait d'etre dehors la nuit",
    origine: "naissance",
    humeur: "bon",
    effets: { ignoreStressNuit: true },
  },
  {
    cle: "gourmand",
    nom: "Gourmand",
    resume: "Mange deux fois plus, mais manger lui rend 20 % de stress en plus",
    origine: "naissance",
    humeur: "mixte",
    effets: { appetit: 2, descenteStress: 1.2 },
  },
  {
    cle: "hemophile",
    nom: "Hemophile",
    resume: "Ses blessures s'aggravent en 3 jours au lieu de 5 a 7",
    origine: "naissance",
    humeur: "mauvais",
    effets: { aggravationEtats: 2 },
  },
  {
    cle: "kleptomane",
    nom: "Kleptomane",
    resume: "Vole parfois une ressource — et ca fait baisser son stress",
    origine: "naissance",
    humeur: "mixte",
    effets: { vole: true },
  },
  {
    cle: "sang-froid",
    nom: "Sang-Froid",
    resume: "Les morts autour de lui coutent 50 % de stress en moins",
    origine: "naissance",
    humeur: "bon",
    effets: { stressParMort: 0.5 },
  },

  // --------------------------------------------------------- par exploit
  {
    cle: "veteran",
    nom: "Veteran",
    resume: "200 monstres tues : +3 % de degats",
    origine: "exploit",
    humeur: "bon",
    effets: { degats: 1.03 },
  },
  {
    cle: "endurci",
    nom: "Endurci",
    resume: "A survecu a une nuit sous 20 % : son stress monte plus lentement",
    origine: "exploit",
    humeur: "bon",
    effets: { monteeStress: 0.85 },
  },
  {
    cle: "hante",
    nom: "Hante",
    resume: "A vu mourir trois habitants : son stress monte plus vite",
    origine: "exploit",
    humeur: "mauvais",
    effets: { monteeStress: 1.2 },
  },
  {
    cle: "insomniaque",
    nom: "Insomniaque",
    resume: "Dix nuits dehors : ne recupere plus de stress la nuit",
    origine: "exploit",
    humeur: "mauvais",
    effets: { sansReposNocturne: true },
  },
  {
    cle: "pyromane",
    nom: "Pyromane",
    resume: "A eteint un incendie : peut mettre le feu quand il craque",
    origine: "exploit",
    humeur: "mauvais",
    effets: { feuEnCraquant: true },
  },
  {
    cle: "devot",
    nom: "Devot",
    resume: "Soigne cinq fois a l'eglise : elle lui rend plus de stress",
    origine: "exploit",
    humeur: "bon",
    effets: { descenteStress: 1.25 },
  },
  {
    cle: "routinier",
    nom: "Routinier",
    resume: "Trente jours au meme poste : +5 % ici, -5 % partout ailleurs",
    origine: "exploit",
    humeur: "mixte",
    // Le malus « partout ailleurs » ne s'applique qu'au changement de poste :
    // c'est `village.changerPoste` qui le lit, pas l'agregat.
    effets: { cadence: 1.05 },
  },
  {
    cle: "marque",
    nom: "Marque",
    resume: "Dernier survivant d'une nuit : les monstres le visent en priorite",
    origine: "exploit",
    humeur: "mauvais",
    effets: { cibleEnPriorite: true },
  },
  {
    cle: "boucher",
    nom: "Boucher",
    resume: "500 monstres tues : +5 % de critique, mais il stresse les civils",
    origine: "exploit",
    humeur: "mixte",
    effets: { critique: 0.05, stressVoisins: 0.25 },
  },
  {
    cle: "deracine",
    nom: "Deracine",
    resume: "Son poste a ete detruit : son stress monte deux fois plus vite",
    origine: "exploit",
    humeur: "mauvais",
    effets: { monteeStress: 2 },
    duree: 3,
  },
  {
    cle: "legende-locale",
    nom: "Legende locale",
    resume: "A tenu un front seul une nuit : sa presence calme les civils",
    origine: "exploit",
    humeur: "bon",
    effets: { stressVoisins: -0.3 },
  },
  // ---------------------------------- ceux qui regardent qui est en face
  //
  // ⚠️ **Ils sont ajoutes a la fin, et c'est obligatoire** : l'index dans ce
  // tableau est l'identifiant stocke sur les personnes, et une sauvegarde
  // d'avant aujourd'hui porte les anciens numeros.
  //
  // Ils attendaient le **jalon 8**, faute de pillards a qui les appliquer. Le
  // §4.29 a rendu les humains hostiles trois jalons plus tot : un village qu'on
  // refuse peut se jeter sur nous. Ils se declenchent donc, et ils remontent.
  {
    cle: "misericordieux",
    nom: "Misericordieux",
    resume: "Contre un humain, il frappe beaucoup moins fort — et il peut refuser",
    origine: "naissance",
    humeur: "mixte",
    effets: { degatsContreHumain: 0.35, refuseDeFrapperUnHumain: true },
  },
  {
    cle: "bourreau-d-hommes",
    nom: "Bourreau d'hommes",
    resume: "Redoutable contre les humains, franchement mauvais contre les betes",
    origine: "naissance",
    humeur: "mixte",
    effets: { degatsContreHumain: 2.4, degats: 0.8 },
  },

  // ------------------------------------------- les steles de la route (§4.31)
  //
  // ⚠️ **Ils cassent la regle des 2 a 5 % de l'entete, et il faut le dire.**
  // Ce fichier pose que seule une sequelle a le droit de peser lourd. Un trait
  // de stele pese **10 a 20 %** : entre les deux. Trois raisons, et si l'une
  // tombe il faut les redescendre.
  //
  // 1. **Ils se choisissent en connaissance de cause** (decision d'Angelos,
  //    21 septembre 2026) : la stele dit ce qu'elle donne et ce qu'elle coute,
  //    et on peut passer son chemin. Un trait de naissance, lui, est subi.
  // 2. **Ils sont rares** : un monde sur cinq en porte une, et elle est gardee
  //    par un camp de betes qu'on voit de loin.
  // 3. **Chacun se paie.** Aucun n'est gratuit : c'est la condition pour qu'un
  //    trait de cette taille reste une decision et non un cadeau.
  //
  // Le §4.31 previent que la stele est « de loin la plus chere a equilibrer »
  // et que ses traits doivent etre ecrits **pour** elle. Les voici : six,
  // courts, et chacun un marche.
  {
    cle: "serment-de-fer",
    nom: "Serment de fer",
    resume: "Tes coups portent bien plus fort — et tu tiens moins longtemps",
    origine: "stele",
    humeur: "mixte",
    effets: { degats: 1.15, pvMax: 0.9 },
  },
  {
    cle: "oeil-du-veilleur",
    nom: "Oeil du veilleur",
    resume: "Tu esquives et tu frappes juste — mais tu ne dors plus vraiment",
    origine: "stele",
    humeur: "mixte",
    effets: { esquive: 0.06, critique: 0.05, monteeStress: 1.3 },
  },
  {
    cle: "pas-du-loup",
    nom: "Pas du loup",
    resume: "Tu vas plus vite que tout le monde — et tu manges pour deux",
    origine: "stele",
    humeur: "mixte",
    effets: { vitesse: 1.14, appetit: 1.4 },
  },
  {
    cle: "souffle-long",
    nom: "Souffle long",
    resume: "Tu encaisses bien plus, l'eglise te rend plus — tes coups portent moins",
    origine: "stele",
    humeur: "mixte",
    effets: { pvMax: 1.2, soinEglise: 1.25, degats: 0.92 },
  },
  {
    cle: "main-du-batisseur",
    nom: "Main du batisseur",
    resume: "Tu batis moins cher et tu ramasses plus — tu apprends plus lentement",
    origine: "stele",
    humeur: "mixte",
    effets: { coutBati: 0.8, recolte: 1.3, monteeNiveau: 0.9 },
  },
  {
    cle: "coeur-scelle",
    nom: "Coeur scelle",
    resume: "Rien ne t'atteint vraiment — et rien ne te soulage tout a fait",
    origine: "stele",
    humeur: "mixte",
    effets: { monteeStress: 0.6, stressParMort: 0.55, plancherStress: 20 },
  },

  /**
   * ⚠️ **Le trait qu'on herite d'un mort** (§4.26, bloc 11).
   *
   * Le §4.26 l'appelait « Vengeance d'Arthur » — un trait **nomme d'apres le
   * mort**. Ce n'est pas faisable tel quel : le §4.23 exige que les traits
   * soient des identifiants numeriques et interdit d'en fabriquer un par
   * personne. Le nom du mort n'est pas perdu pour autant, il vit dans le
   * souvenir fondateur (« A recu ce que Marc laissait »), que la fiche affiche
   * juste en dessous. Le trait porte l'effet, le souvenir porte l'histoire.
   */
  {
    cle: "heritier",
    nom: "Heritier",
    resume: "Quelqu'un lui a laisse quelque chose, et il le porte",
    origine: "heritage",
    humeur: "mixte",
    // Il frappe plus fort et tient mieux le coup, mais la mort le marque : on
    // n'herite pas sans avoir perdu.
    effets: { degats: 1.06, monteeStress: 1.1, stressParMort: 1.15, seuilRepli: -0.02 },
  },

  /**
   * ⚠️ **Les deux sorties d'un deuil** (§4.26, bloc 11).
   *
   * « Certains en sortent plus courageux, d'autres plus peureux — selon leur
   * trait. » C'est le Courage qui tranche, et il faut **deux traits neufs** :
   * `hante` et `endurci` existaient deja, mais leurs resumes annoncent une
   * autre histoire (« a vu mourir trois habitants », « a survecu a une nuit
   * sous 20 % »). Les reutiliser aurait fait mentir la fiche — vu sur une
   * capture le 21 septembre 2026, ou un bucheron devenait Hante pour avoir
   * perdu une amie, la fiche jurant qu'il avait vu mourir trois personnes.
   */
  {
    cle: "endeuille",
    nom: "Endeuille",
    resume: "A perdu quelqu'un qui comptait : son stress monte plus vite",
    origine: "deuil",
    humeur: "mauvais",
    effets: { monteeStress: 1.2, stressParMort: 1.15 },
  },
  {
    cle: "aguerri",
    nom: "Aguerri",
    resume: "A perdu quelqu'un qui comptait, et s'est durci",
    origine: "deuil",
    humeur: "bon",
    effets: { monteeStress: 0.85, stressParMort: 0.8, degats: 1.03 },
  },
];

/**
 * Quelle part des coups le Misericordieux refuse carrement de porter (§4.23).
 *
 * Un coup sur trois : assez pour qu'on le voie et qu'on en tienne compte,
 * assez peu pour qu'il reste utile. Le trait ne serait qu'un malus de degats
 * sans ca — or le §4.23 en fait **le premier trait qui desobeit**.
 */
export const PART_DE_COUPS_REFUSES = 0.35;

const INDEX_TRAITS = new Map<CleTrait, number>(TRAITS.map((t, i) => [t.cle, i]));

/**
 * L'identifiant numerique d'un trait.
 *
 * Le code appelant ecrit `idTrait("courageux")` — lisible — et ce qui est
 * **stocke** est un entier. C'est le compromis que le §4.23 demande : on ne
 * range jamais trente chaines de caracteres par personne.
 */
export function idTrait(cle: CleTrait): number {
  const id = INDEX_TRAITS.get(cle);
  if (id === undefined) throw new Error(`trait inconnu : ${cle}`);
  return id;
}

export function traitParId(id: number): TraitDef | undefined {
  return TRAITS[id];
}

/** Les traits qu'on peut tirer a la naissance. */
export const TRAITS_DE_NAISSANCE: number[] = TRAITS.map((_, i) => i).filter(
  (i) => TRAITS[i]!.origine === "naissance",
);

/**
 * Les traits que les steles de la route donnent (§4.31, jalon 5.6).
 *
 * ⚠️ **Ils ne tombent jamais a la naissance ni par exploit.** Une stele est
 * leur seule porte d'entree, comme le soin est la seule porte des sequelles :
 * c'est ce qui fait qu'en croiser une se raconte.
 */
export const TRAITS_DE_STELE: number[] = TRAITS.map((_, i) => i).filter(
  (i) => TRAITS[i]!.origine === "stele",
);

// ---------------------------------------------------------------- sequelles

export type CleSequelle =
  | "poumon-perce"
  | "main-mutilee"
  | "miracule"
  | "jambe-brisee"
  | "regard-vide";

export interface SequelleDef {
  cle: CleSequelle;
  nom: string;
  resume: string;
  effets: Effets;
  /** Vrai si elle se voit sur le portrait (§4.23) */
  visible: boolean;
}

/**
 * **La table des sequelles**, et elles sont lourdes a dessein.
 *
 * Le §4.23 casse ici, et seulement ici, la regle des 2 a 5 % — pour une raison
 * qui vaut le coup : une sequelle faible ne poserait aucune question, une
 * sequelle lourde en pose la meilleure du jeu. *Tu as sauve ton heros, il est
 * devenu un fardeau. Tu le gardes, ou tu l'envoies mourir heroiquement ?*
 *
 * Le garde-fou est ailleurs : on n'en obtient **jamais** au hasard, et
 * **jamais** hors du stade Mourant (`etats.ts`).
 */
export const SEQUELLES: SequelleDef[] = [
  {
    cle: "poumon-perce",
    nom: "Poumon perce",
    resume: "-30 % de vie maximale, definitivement",
    effets: { pvMax: 0.7 },
    visible: false,
  },
  {
    cle: "main-mutilee",
    nom: "Main mutilee",
    resume: "Ne peut plus faire de coup critique",
    effets: { peutCritiquer: false },
    visible: true,
  },
  {
    cle: "miracule",
    nom: "Miracule",
    resume: "+10 % d'esquive, -15 % de vie maximale, et une grosse cicatrice",
    effets: { esquive: 0.1, pvMax: 0.85 },
    visible: true,
  },
  {
    cle: "jambe-brisee",
    nom: "Jambe brisee",
    resume: "-25 % de vitesse de deplacement",
    effets: { vitesse: 0.75 },
    visible: false,
  },
  {
    cle: "regard-vide",
    nom: "Regard vide",
    resume: "Son stress ne descend plus jamais sous 30 %",
    effets: { plancherStress: 30 },
    visible: true,
  },
];

const INDEX_SEQUELLES = new Map<CleSequelle, number>(SEQUELLES.map((s, i) => [s.cle, i]));

export function idSequelle(cle: CleSequelle): number {
  const id = INDEX_SEQUELLES.get(cle);
  if (id === undefined) throw new Error(`sequelle inconnue : ${cle}`);
  return id;
}

export function sequelleParId(id: number): SequelleDef | undefined {
  return SEQUELLES[id];
}

// --------------------------------------------------------------- agregation

/**
 * Ecrase `cible` avec `ajout`, multiplicateurs multiplies et additifs ajoutes.
 *
 * Le type discrimine tout seul : un booleen se remplace, un nombre se combine
 * selon qu'il est neutre a 1 ou a 0. La liste des champs neutres a 1 est donc
 * **la seule chose a tenir a jour** quand on ajoute un modificateur.
 */
const MULTIPLICATIFS = new Set<keyof Modificateurs>([
  "degats",
  "pvMax",
  "vitesse",
  "cadence",
  "recolte",
  "appetit",
  "monteeStress",
  "descenteStress",
  "stressParMort",
  "aggravationEtats",
  "contagion",
  "soinEglise",
  "coutBati",
  "monteeNiveau",
  "degatsContreHumain",
]);

export function appliquer(cible: Modificateurs, ajout: Effets): void {
  for (const [nom, valeur] of Object.entries(ajout) as [keyof Modificateurs, unknown][]) {
    if (typeof valeur === "boolean") {
      // Un drapeau vrai gagne toujours, sauf `peutCritiquer` qui est une
      // interdiction : la, c'est le faux qui gagne. Sinon une main mutilee se
      // ferait annuler par n'importe quoi.
      if (nom === "peutCritiquer") cible.peutCritiquer = cible.peutCritiquer && valeur;
      else (cible[nom] as boolean) = (cible[nom] as boolean) || valeur;
      continue;
    }
    if (typeof valeur !== "number") continue;

    if (MULTIPLICATIFS.has(nom)) (cible[nom] as number) *= valeur;
    else if (nom === "plancherStress") cible.plancherStress = Math.max(cible.plancherStress, valeur);
    else (cible[nom] as number) += valeur;
  }
}

/**
 * L'agregat complet d'une personne.
 *
 * ⚠️ **A n'appeler que quand quelque chose change** — un trait gagne, une
 * sequelle posee, un etat contracte ou soigne. Jamais par image : c'est
 * exactement ce que le §4.23 interdit, et c'est toute la raison d'etre de ce
 * fichier.
 */
export function agreger(traits: number[], sequelles: number[], effetsEnPlus: Effets[] = []): Modificateurs {
  const total = modificateursVierges();
  for (const id of traits) {
    const def = traitParId(id);
    if (def) appliquer(total, def.effets);
  }
  for (const id of sequelles) {
    const def = sequelleParId(id);
    if (def) appliquer(total, def.effets);
  }
  for (const effets of effetsEnPlus) appliquer(total, effets);
  return total;
}
