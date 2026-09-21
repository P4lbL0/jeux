/**
 * La porte : qui se presente, et ce qu'on laisse entrer (DESIGN.md §4.18, §4.10).
 *
 * Trois idees, et elles tiennent tout le bloc 6a :
 *
 * 1. **Le doute est le contenu.** Les indices ne disent jamais la verite, ils
 *    deplacent les probabilites. Trois signaux valent nettement mieux que zero,
 *    et pourtant un innocent peut en montrer trois.
 * 2. **La folie a un degre** (§4.18) : le voleur, le saboteur, le meurtrier. Les
 *    indices penchent avec lui sans jamais le dire.
 * 3. **Les questions sont tirees, les reponses jamais** (§4.10). Une reponse au
 *    hasard ne s'apprend pas ; une question au hasard empeche la routine. On veut
 *    les deux.
 *
 * ⚠️ **Le degre de folie ne vit pas sur l'habitant, et c'est volontaire.** Il vit
 * ici, dans une liste a part (`Fou`), pour qu'aucune fiche, aucun tableau et
 * aucune sauvegarde relue distraitement ne puisse l'afficher par accident. Le
 * joueur ne doit jamais savoir qui il a fait entrer.
 *
 * Ce fichier ne connait pas Phaser : il tire, il decrit, il decide de la nuit.
 * Ce qui casse un mur ou tue quelqu'un vit dans `src/game/`.
 */

import type { Metier } from "./habitants";
import { creerPersonne, prenomLibre, type Personne } from "./personne";
import { idTrait, type CleTrait } from "./traits";
import type { Rng } from "./rng";

// --------------------------------------------------------------- les reglages

/**
 * **La table de reglages de la porte.** Comme celles du cycle, de l'economie et
 * du stress, c'est le seul endroit a toucher pour re-regler tout le bloc.
 */
export const REGLAGES_ARRIVEES = {
  /** Sur dix arrivants, combien sont fous (§4.18, tranche : deux ou trois) */
  partDeFous: 0.25,

  /**
   * Comment les fous se repartissent entre les trois degres.
   *
   * Le voleur domine a dessein : c'est le fou dont on se releve, et il faut
   * qu'un joueur qui accepte un douteux tombe le plus souvent sur lui. Sinon
   * chaque pari perdu couterait une vie, et le systeme deviendrait injuste.
   */
  poidsDesDegres: [45, 30, 25] as const,

  /** Lignes d'observation montrees, toujours (§4.10) */
  lignes: 3,
  /** Questions tirees dans la banque, a chaque arrivant */
  questionsTirees: 4,

  /**
   * Combien des trois lignes sont alarmantes, par degre de folie.
   *
   * ⚠️ **Les fourchettes se recouvrent, et c'est tout le systeme** (decision du
   * 10 aout 2026 au soir, prise en jouant). La version precedente donnait 0 a 1
   * a un innocent et 2 a 3 a un fou : **aucun recouvrement**, donc compter les
   * lignes suffisait a trancher des qu'on avait appris les six phrases
   * alarmantes. Le §4.18 promet exactement l'inverse — « il peut etre innocent,
   * et l'inverse aussi ».
   *
   * Un innocent en montre donc **0 a 2**, un fou **1 a 3**, et le degre ne fait
   * que pencher : un meurtrier montre bien plus souvent trois signaux. Restent
   * deux verdicts nets aux extremites — **0 innocente, 3 accuse** — et c'est
   * voulu : sans eux, lire ne servirait a rien non plus.
   */
  alarmantesParDegre: [
    [40, 40, 20, 0], // innocent : 0 a 2
    [0, 40, 45, 15], // voleur
    [0, 25, 50, 25], // saboteur
    [0, 15, 45, 40], // meurtrier
  ] as const,

  /**
   * Chance qu'un axe **non montre** cloche quand meme.
   *
   * C'est ce qui donne leur valeur aux questions : sans ca, interroger ne
   * ferait que repeter les trois lignes, et le §4.10 promet qu'une question
   * revele quelque chose.
   */
  chanceAxeCacheInnocent: 0.08,
  chanceAxeCacheFou: 0.4,

  /** Chance que son langage du corps le trahisse quand il ment, par degre */
  seTrahitParDegre: [0, 0.2, 0.35, 0.55] as const,

  /** Journees d'installation avant le premier acte — jamais le jour meme (§4.18) */
  installation: { min: 1, max: 2 },
  /** Journees avant qu'il recommence, pour ceux qui restent */
  recidive: { min: 4, max: 8 },

  /** Part des stocks qu'un voleur emporte en partant */
  partVolee: 0.35,

  /** A partir de combien de fous installes ils frappent tous la meme nuit (§4.18) */
  taillePourUnGroupe: 3,

  // ---- la reputation, et ce qu'elle change au rythme des arrivees
  /**
   * Ce qu'un mort recent coute a la reputation, **en plus** de ce qu'il coute
   * deja a la satisfaction.
   *
   * La reputation n'est pas la satisfaction : la rumeur retient un mort bien
   * plus longtemps que l'humeur du village ne le pleure. Sans cette memoire plus
   * longue, retrancher les morts une deuxieme fois ne serait qu'un doublon.
   */
  parMortRecent: 8,
  /** Journees pendant lesquelles la rumeur garde un mort (3 pour la satisfaction) */
  memoireDeLaRumeur: 8,

  /** Sous ce seuil, plus personne ne vient : le village s'est fait une reputation */
  reputationDuTarissement: 25,
  /** Au-dela, quelqu'un se presente presque chaque journee */
  reputationDeLAffluence: 80,
  /** Delai entre deux arrivants a ces deux bornes, en journees */
  delaiAuTarissement: 3.5,
  delaiALAffluence: 1,
} as const;

// ------------------------------------------------------------------- les axes

/** Les six axes d'observation (DESIGN.md §4.18). */
export type Axe = "mains" | "origine" | "heure" | "familiarite" | "eglise" | "besace";

export const AXES: Axe[] = ["mains", "origine", "heure", "familiarite", "eglise", "besace"];

/**
 * Ce qu'on observe sur chaque axe, **dans les deux sens**.
 *
 * ⚠️ C'est la resolution d'une contradiction interne du §4.18, qui promettait
 * dans la meme page « trois indices montres » et « un innocent en montre 0 a 1 ».
 * Ce sont **les lignes** qui sont trois : l'axe qui n'accuse pas **rassure**, au
 * lieu de laisser un blanc. Un innocent a donc une fiche pleine.
 */
export const OBSERVATIONS: Record<Axe, { alarmante: string; rassurante: string }> = {
  mains: {
    alarmante: "Ses mains n'ont jamais tenu {outil}.",
    rassurante: "Ses mains portent les marques de {outil}.",
  },
  origine: {
    alarmante: "Il ne dit pas d'ou il vient, et il se contredit.",
    rassurante: "Il nomme son village, et la route qu'il a prise.",
  },
  heure: {
    alarmante: "Il s'est presente seul, en pleine nuit.",
    rassurante: "Il s'est presente en plein jour, sans se cacher.",
  },
  familiarite: {
    alarmante: "Il connait deja le nom d'un habitant.",
    rassurante: "Il ne connait personne ici, et il le dit.",
  },
  eglise: {
    alarmante: "Il refuse d'entrer dans l'eglise.",
    rassurante: "Il est entre a l'eglise, et il y est reste un moment.",
  },
  besace: {
    alarmante: "Sa besace est bien trop lourde pour un voyageur.",
    rassurante: "Sa besace ne porte qu'un peu de pain et une couverture.",
  },
};

/**
 * Les memes six axes, **dits sur la route** (§4.31, jalon 5.6).
 *
 * ⚠️ **Trois des six ne veulent rien dire hors d'un village**, et les laisser
 * tels quels cassait la scene : on rencontre quelqu'un au milieu d'une plaine
 * et sa fiche dit « il est entre a l'eglise », « il ne connait personne ici »,
 * « il s'est presente en pleine nuit » — alors qu'il n'y a ni eglise, ni
 * habitants, ni nuit (le cycle est a l'arret tant qu'on marche, §4.29).
 *
 * Ce qu'on garde, c'est **ce que l'axe mesure** : un axe qui accuse accuse
 * pareil, un axe qui rassure rassure pareil, et la part de fous ne bouge pas
 * d'un centieme. Seuls les mots changent. Les trois autres axes — les mains,
 * l'origine, la besace — se disent tels quels : ils parlent de lui, pas du lieu.
 */
export const OBSERVATIONS_DE_ROUTE: Partial<Record<Axe, { alarmante: string; rassurante: string }>> = {
  heure: {
    alarmante: "Il t'a laisse approcher sans bouger, les yeux sur tes mains.",
    rassurante: "Il s'est leve et t'a hele de loin, a decouvert.",
  },
  familiarite: {
    alarmante: "Il connait ton nom, et tu ne le lui as pas dit.",
    rassurante: "Il ne sait rien de toi, et il le demande.",
  },
  eglise: {
    alarmante: "Il ne dit pas ce qu'il faisait ici, ni depuis quand.",
    rassurante: "Il montre l'abri ou il dormait, sans qu'on demande.",
  },
};

/** Les metiers qu'on peut pretendre exercer a la porte : ceux qui ont un poste. */
export const METIERS_A_LA_PORTE: Metier[] = ["pecheur", "bucheron", "mineur", "fermier"];

/** L'outil du metier, pour que la ligne des mains parle du bon geste. */
const OUTILS: Partial<Record<Metier, string>> = {
  pecheur: "un filet",
  bucheron: "une hache",
  mineur: "un pic",
  fermier: "une faux",
};

// -------------------------------------------------------------- les questions

/**
 * Une question posable a la porte.
 *
 * **C'est une donnee, pas du code** (§4.10) : on en ajoute autant qu'on veut
 * sans toucher a une seule ligne de logique, et le jalon 10 pourra batir un vrai
 * dialogue par-dessus s'il le merite.
 */
export interface Question {
  cle: string;
  /** L'axe sur lequel elle porte : c'est lui qui decide de la reponse */
  axe: Axe;
  texte: string;
  /** Ce que repond celui qui n'a rien a cacher sur cet axe */
  franche: string;
  /** Ce que repond celui qui ment */
  evasive: string;
  /**
   * La meme question, **posee sur la route** (§4.31), quand celle du village
   * n'a pas de sens : on ne dit pas « entre a l'eglise » au milieu d'une plaine.
   *
   * Absente quand la question tient telle quelle — c'est le cas de la plupart :
   * elles parlent de lui, de son metier et de sa besace, pas du lieu.
   */
  surLaRoute?: { texte: string; franche: string; evasive: string };
}

export const QUESTIONS: Question[] = [
  // --- les mains
  {
    cle: "mains-anciennete",
    axe: "mains",
    texte: "Depuis combien de temps fais-tu ce metier ?",
    franche: "Depuis l'enfance. Mon pere le faisait avant moi.",
    evasive: "Assez longtemps. On apprend vite, tu sais.",
  },
  {
    cle: "mains-montre",
    axe: "mains",
    texte: "Montre-moi tes mains.",
    franche: "Il les tend sans hesiter. Elles sont dures et fendues.",
    evasive: "Il les essuie sur sa tunique avant de les tendre.",
  },
  {
    cle: "mains-outil",
    axe: "mains",
    texte: "Que ferais-tu si ton outil cassait ?",
    franche: "Je le repare. J'en ai casse trois dans ma vie.",
    evasive: "J'en trouverais un autre. Il en traine partout.",
  },
  {
    cle: "mains-saison",
    axe: "mains",
    texte: "Quelle est la pire saison, pour ton metier ?",
    franche: "La fin de l'hiver. Tout est gele, et rien ne vient.",
    evasive: "Elles se valent. On travaille, c'est tout.",
  },
  // --- l'origine
  {
    cle: "origine-village",
    axe: "origine",
    texte: "D'ou viens-tu ?",
    franche: "De Verlaine, deux vallees a l'est. Il n'en reste rien.",
    evasive: "De loin. Ca n'a plus vraiment de nom, maintenant.",
  },
  {
    cle: "origine-protecteur",
    axe: "origine",
    texte: "Qui vous protegeait, la-bas ?",
    franche: "Un Protecteur. Il est tombe la nuit ou tout a brule.",
    evasive: "Personne, a la fin. On se debrouillait.",
  },
  {
    cle: "origine-route",
    axe: "origine",
    texte: "Combien de jours de route ?",
    franche: "Neuf. J'ai dormi dans les fosses, et j'ai bu la pluie.",
    evasive: "Je n'ai pas compte les jours.",
  },
  {
    cle: "origine-seul",
    axe: "origine",
    texte: "Tu es parti seul ?",
    franche: "Non. Nous etions quatre au depart.",
    evasive: "Oui. C'est plus simple, seul.",
  },
  // --- l'heure
  {
    cle: "heure-pourquoi",
    axe: "heure",
    texte: "Pourquoi arriver a cette heure-ci ?",
    franche: "J'ai marche tant qu'il faisait jour. Je n'ai pas su faire mieux.",
    evasive: "La nuit est plus sure. On me voit moins.",
  },
  {
    cle: "heure-rencontre",
    axe: "heure",
    texte: "Tu n'as croise personne sur la route ?",
    franche: "Des morts. Et des choses que je n'ai pas voulu regarder.",
    evasive: "Non. Personne.",
  },
  {
    cle: "heure-dormi",
    axe: "heure",
    texte: "Ou as-tu dormi, cette nuit ?",
    franche: "Sous un talus, a une lieue d'ici. J'ai vu vos feux.",
    evasive: "Je n'ai pas dormi.",
  },
  // --- la familiarite
  {
    cle: "familiarite-connait",
    axe: "familiarite",
    texte: "Tu connais quelqu'un ici ?",
    franche: "Personne. C'est bien pour ca que je demande.",
    evasive: "De nom, peut-etre. On parle de vous, sur les routes.",
  },
  {
    cle: "familiarite-qui",
    axe: "familiarite",
    texte: "Qui t'a parle de ce village ?",
    franche: "Un colporteur, a trois jours d'ici. Il m'a dessine la route.",
    evasive: "Il hesite. On m'a dit qu'on y mangeait.",
  },
  {
    cle: "familiarite-attendu",
    axe: "familiarite",
    texte: "Quelqu'un t'attend ici ?",
    franche: "Non. Je n'attends rien de personne.",
    evasive: "On verra bien qui me reconnait.",
    surLaRoute: {
      texte: "Tu attends quelqu'un ?",
      franche: "Plus personne. C'est bien pour ca que je te suis.",
      evasive: "On verra bien qui passe.",
    },
  },
  // --- l'eglise
  {
    cle: "eglise-entre",
    axe: "eglise",
    texte: "Entre a l'eglise, on parlera au chaud.",
    franche: "Il entre le premier, et il attend a l'interieur.",
    evasive: "Il s'arrete sur le seuil. Je t'attends dehors.",
    surLaRoute: {
      texte: "Montre-moi ou tu dormais.",
      franche: "Il ecarte des branches. Un creux, une couverture roulee.",
      evasive: "Plus loin. On n'a pas le temps.",
    },
  },
  {
    cle: "eglise-prie",
    axe: "eglise",
    texte: "Tu pries ?",
    franche: "Tous les soirs. C'est tout ce qui me reste.",
    evasive: "Plus depuis longtemps.",
  },
  {
    cle: "eglise-morts",
    axe: "eglise",
    texte: "Tu as enterre les tiens ?",
    franche: "Trois. Je les ai portes moi-meme jusqu'a la chapelle.",
    evasive: "Il n'y avait plus de chapelle.",
    surLaRoute: {
      texte: "Tu as enterre les tiens ?",
      franche: "Trois. Je les ai portes moi-meme jusqu'a la lisiere.",
      evasive: "Il n'y avait plus personne pour creuser.",
    },
  },
  // --- la besace
  {
    cle: "besace-contenu",
    axe: "besace",
    texte: "Qu'est-ce que tu portes la-dedans ?",
    franche: "Du pain dur et une couverture. Regarde toi-meme.",
    evasive: "Il fait passer sa besace de l'autre cote. Rien qui vaille.",
  },
  {
    cle: "besace-pose",
    axe: "besace",
    texte: "Tu la poses ? Elle a l'air lourde.",
    franche: "Il la pose sans meme y penser.",
    evasive: "Elle ne me gene pas.",
  },
  {
    cle: "besace-arme",
    axe: "besace",
    texte: "Tu portes une arme ?",
    franche: "Un couteau a poisson. Je te le laisse si tu veux.",
    evasive: "Rien qui puisse servir contre quelqu'un.",
  },
];

/**
 * Les traits qui se voient a la porte (§4.10).
 *
 * On ne montre que ce qui se lit sur quelqu'un qu'on regarde deux minutes : une
 * carrure, un teint, une facon de parler. Ce qui est interieur — la chance, le
 * sang-froid, l'hemophilie — ne se devine pas et resterait un mensonge de
 * lisibilite.
 *
 * ⚠️ Seuls des **traits de naissance** peuvent apparaitre ici : les traits
 * d'exploit se gagnent en vivant (§4.23), donc un Pyromane est forcement
 * quelqu'un que le village a deja use — jamais un inconnu a la porte.
 */
export const TRAITS_VISIBLES_A_LA_PORTE: CleTrait[] = [
  "courageux",
  "peureux",
  "robuste",
  "maladif",
  "vif",
  "placide",
  "colerique",
  "pieux",
  "bavard",
  "gourmand",
  "kleptomane",
  "nyctalope",
];

// ------------------------------------------------------------- l'arrivant

export type DegreFolie = 0 | 1 | 2 | 3;

/** Ce qu'un fou fait quand il passe a l'acte (§4.18). */
export type Acte = "vol" | "breche" | "meurtre" | "incendie";

export const ACTE_PAR_DEGRE: Record<1 | 2 | 3, Acte> = {
  1: "vol",
  2: "breche",
  3: "meurtre",
};

/**
 * ⚠️ **L'incendie n'a pas de degre**, et c'est voulu : il appartient au degre 3,
 * mais il exige les incendies du jalon 6 (§4.21). Le jour ou ils existeront, un
 * meurtrier pourra bruler au lieu de tuer — il n'y aura qu'a le tirer ici. C'est
 * le meme traitement que l'argent au bloc 4 : la place est ecrite, le
 * branchement attend son systeme.
 */
export const ACTES_DU_JALON_6: Acte[] = ["incendie"];

export const NOMS_ACTE: Record<Acte, string> = {
  vol: "les stocks ont ete vides",
  breche: "une breche a ete ouverte dans la palissade",
  meurtre: "quelqu'un a ete tue dans son sommeil",
  incendie: "un feu a ete allume",
};

/** Une ligne de la fiche d'observation. */
export interface LigneObservation {
  axe: Axe;
  alarmante: boolean;
  texte: string;
}

/** Quelqu'un qui se presente a la porte, tant qu'on n'a pas repondu. */
export interface Arrivant {
  personne: Personne;
  /** Le metier qu'il **pretend** exercer (§4.10) */
  metierPretendu: Metier;
  /** Son degre de folie. **Jamais montre**, jamais devine avec certitude */
  folie: DegreFolie;
  /** Les trois lignes de la fiche */
  observations: LigneObservation[];
  /** Les quatre questions tirees pour lui */
  questions: Question[];
  /** Les axes sur lesquels il a quelque chose a cacher, montres ou non */
  axesTroubles: Axe[];
  /** Son langage du corps le trahit-il quand il ment ? */
  seTrahit: boolean;
  /** Les cles des questions deja posees : on ne la repose pas */
  posees: string[];
  /** La journee ou il s'est presente */
  journee: number;
}

/**
 * Quelqu'un se presente.
 *
 * @param rng seede par l'appelant : une meme graine redonne le meme visiteur,
 *   portrait, mensonges et questions compris (§4.6)
 */
export function creerArrivant(
  rng: Rng,
  journee: number,
  nomsPris: readonly string[] = [],
  surLaRoute = false,
): Arrivant {
  const personne = creerPersonne(prenomLibre(rng, nomsPris), rng);
  const metierPretendu = rng.pick(METIERS_A_LA_PORTE);
  const folie = tirerDegre(rng);

  // Trois axes montres, tires sans remise ; les autres restent hors de la fiche
  // et ne se decouvrent qu'en posant des questions.
  const melanges = melanger(AXES, rng);
  const montres = melanges.slice(0, REGLAGES_ARRIVEES.lignes);
  const caches = melanges.slice(REGLAGES_ARRIVEES.lignes);

  const alarmantes = tirerNombreDAlarmantes(folie, rng);
  const axesTroubles = montres.slice(0, alarmantes);

  // Ce qui cloche sans se voir : c'est ce qui donne leur valeur aux questions.
  const chanceCachee =
    folie > 0
      ? REGLAGES_ARRIVEES.chanceAxeCacheFou
      : REGLAGES_ARRIVEES.chanceAxeCacheInnocent;
  for (const axe of caches) {
    if (rng.chance(chanceCachee)) axesTroubles.push(axe);
  }

  const observations = montres.map((axe) => ({
    axe,
    alarmante: axesTroubles.includes(axe),
    texte: texteObservation(axe, axesTroubles.includes(axe), metierPretendu, surLaRoute),
  }));

  // ⚠️ **Sur la route, une question qui parle du village prend ses mots de
  // route** (§4.31). On garde sa cle et son axe — tout ce qui compte l'un ou
  // l'autre continue de marcher, et la part de fous ne bouge pas d'un
  // centieme : seuls les mots changent.
  const questions = melanger(QUESTIONS, rng)
    .slice(0, REGLAGES_ARRIVEES.questionsTirees)
    .map((q) => (surLaRoute && q.surLaRoute ? { ...q, ...q.surLaRoute } : q));

  return {
    personne,
    metierPretendu,
    folie,
    observations,
    questions,
    axesTroubles,
    seTrahit: rng.chance(REGLAGES_ARRIVEES.seTrahitParDegre[folie]),
    posees: [],
    journee,
  };
}

function texteObservation(
  axe: Axe,
  alarmante: boolean,
  metier: Metier,
  surLaRoute: boolean,
): string {
  const table = (surLaRoute && OBSERVATIONS_DE_ROUTE[axe]) || OBSERVATIONS[axe];
  const modele = table[alarmante ? "alarmante" : "rassurante"];
  return modele.replace("{outil}", OUTILS[metier] ?? "un outil");
}

/** Combien de lignes alarmantes, selon le degre. Les bornes du §4.18 tiennent. */
function tirerNombreDAlarmantes(folie: DegreFolie, rng: Rng): number {
  const poids = REGLAGES_ARRIVEES.alarmantesParDegre[folie];
  return tirerIndexPondere(poids, rng);
}

function tirerDegre(rng: Rng): DegreFolie {
  if (!rng.chance(REGLAGES_ARRIVEES.partDeFous)) return 0;
  return (tirerIndexPondere(REGLAGES_ARRIVEES.poidsDesDegres, rng) + 1) as DegreFolie;
}

function tirerIndexPondere(poids: readonly number[], rng: Rng): number {
  const total = poids.reduce((a, b) => a + b, 0);
  let tirage = rng.next() * total;
  for (let i = 0; i < poids.length; i++) {
    tirage -= poids[i]!;
    if (tirage < 0) return i;
  }
  // Ne devrait pas arriver ; on rend le dernier poids non nul plutot que zero,
  // qui serait « innocent » et fausserait la part de fous en silence.
  for (let i = poids.length - 1; i >= 0; i--) if (poids[i]! > 0) return i;
  return 0;
}

/** Une copie melangee, sans toucher a la source. */
function melanger<T>(source: readonly T[], rng: Rng): T[] {
  const copie = source.slice();
  for (let i = copie.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [copie[i], copie[j]] = [copie[j]!, copie[i]!];
  }
  return copie;
}

/**
 * Ce qu'il repond, et si son regard le trahit.
 *
 * ⚠️ **Aucun tirage ici** (§4.10). La reponse tombe de ce que la personne
 * **est** : le meme homme, a la meme question, repond toujours la meme chose.
 * C'est ce qui rend la lecture apprenable au fil des parties — une reponse au
 * hasard ne s'apprend pas, et le joueur finirait par ignorer les questions.
 */
export function reponseA(
  arrivant: Arrivant,
  question: Question,
): { texte: string; ment: boolean; trahi: boolean } {
  const ment = arrivant.axesTroubles.includes(question.axe);
  return {
    texte: ment ? question.evasive : question.franche,
    ment,
    trahi: ment && arrivant.seTrahit,
  };
}

/** Il pose la question. @returns la reponse, ou null si elle l'a deja ete */
export function poser(
  arrivant: Arrivant,
  cle: string,
): { texte: string; ment: boolean; trahi: boolean } | null {
  if (arrivant.posees.includes(cle)) return null;
  const question = arrivant.questions.find((q) => q.cle === cle);
  if (question === undefined) return null;
  arrivant.posees.push(cle);
  return reponseA(arrivant, question);
}

/** Les traits qu'on lui voit a la porte, par identifiant (§4.10). */
export function traitsVisibles(arrivant: Arrivant): number[] {
  const visibles = TRAITS_VISIBLES_A_LA_PORTE.map(idTrait);
  return arrivant.personne.traits.filter((id) => visibles.includes(id));
}

// -------------------------------------------------------------- la reputation

/**
 * La reputation du village, de 0 a 100 (§4.18).
 *
 * **Ce n'est pas une jauge de plus** : c'est la satisfaction, moins ce que les
 * morts recents coutent a la rumeur. Une deuxieme jauge aurait mesure presque la
 * meme chose, se serait dereglee en parallele, et aurait demande au joueur de
 * surveiller deux chiffres pour une seule idee.
 *
 * La difference avec la satisfaction est **la memoire** : le village pleure ses
 * morts trois journees, la rumeur les retient huit. C'est ce qui empeche ce
 * calcul d'etre un simple doublon.
 */
export function reputation(
  satisfaction: number,
  journeesDesMorts: readonly number[],
  journeeCourante: number,
  journeesDesMortsEnChemin: readonly number[] = [],
  partDUneMortEnChemin = 0.5,
): number {
  const recent = (jour: number) =>
    journeeCourante - jour < REGLAGES_ARRIVEES.memoireDeLaRumeur;

  const retenus = journeesDesMorts.filter(recent).length;
  // Un survivant mort en chemin pese **la moitie** d'un habitant tue (§4.18) :
  // il n'etait pas encore du village, mais on lui avait fait esperer. A zero,
  // echouer ne couterait que du temps ; a plein tarif, on ne sortirait plus
  // jamais et tout le bloc des survivants mourrait avec.
  const enChemin = journeesDesMortsEnChemin.filter(recent).length;

  const cout = (retenus + enChemin * partDUneMortEnChemin) * REGLAGES_ARRIVEES.parMortRecent;
  return Math.round(Math.max(0, Math.min(100, satisfaction - cout)));
}

/**
 * Le delai moyen entre deux arrivants, en journees — ou `null` quand plus
 * personne ne vient.
 *
 * Interpole entre les deux bornes du §4.18 : presque un par jour a 80, plus
 * personne sous 25.
 */
export function delaiEntreArrivees(reputationCourante: number): number | null {
  const r = REGLAGES_ARRIVEES;
  if (reputationCourante < r.reputationDuTarissement) return null;
  if (reputationCourante >= r.reputationDeLAffluence) return r.delaiALAffluence;

  const part =
    (reputationCourante - r.reputationDuTarissement) /
    (r.reputationDeLAffluence - r.reputationDuTarissement);
  return r.delaiAuTarissement + part * (r.delaiALAffluence - r.delaiAuTarissement);
}

/**
 * La journee ou le prochain visiteur se presentera, ou `null` si plus personne.
 *
 * Le delai est bruite de plus ou moins 20 % : sans ca le joueur lirait l'horloge
 * au lieu de lire son village, et saurait la veille qu'on frappera demain.
 */
export function prochaineArrivee(
  reputationCourante: number,
  journee: number,
  rng: Rng,
): number | null {
  const delai = delaiEntreArrivees(reputationCourante);
  if (delai === null) return null;
  return journee + Math.max(1, Math.round(delai * rng.range(0.8, 1.2)));
}

// ------------------------------------------------------------------- les fous

/**
 * Un fou entre dans le village, une fois accepte.
 *
 * Il ne porte que son identifiant : tout ce qu'il est en tant qu'habitant vit
 * dans `habitants.ts`, et tout ce qu'il cache vit ici.
 */
export interface Fou {
  /** L'identifiant de l'habitant correspondant */
  id: number;
  degre: 1 | 2 | 3;
  /** La journee ou il est entre : il ne frappe jamais le jour meme (§4.18) */
  journeeDArrivee: number;
  /** La journee ou il passera a l'acte */
  journeeDeLActe: number;
}

/**
 * On vient d'accepter quelqu'un : s'il etait fou, il attend son heure.
 *
 * @returns le fou a suivre, ou null si l'arrivant etait innocent
 */
export function accueillir(arrivant: Arrivant, id: number, journee: number, rng: Rng): Fou | null {
  if (arrivant.folie === 0) return null;
  const { min, max } = REGLAGES_ARRIVEES.installation;
  return {
    id,
    degre: arrivant.folie,
    journeeDArrivee: journee,
    journeeDeLActe: journee + rng.int(min, max),
  };
}

/**
 * Ce qui va se passer cette nuit (§4.18).
 *
 * **La regle du groupe est ici, et elle tient en trois lignes** : des que trois
 * fous installes cohabitent, ils ne frappent plus chacun son tour mais **tous la
 * meme nuit, chacun son acte**. Le risque devient exponentiel au lieu d'etre
 * additif, sans qu'aucun comportement neuf n'ait ete ecrit — c'est la meme nuit,
 * trois fois.
 *
 * @param journee la journee qui s'acheve
 */
export function actesDeLaNuit(
  fous: readonly Fou[],
  journee: number,
): { fou: Fou; acte: Acte }[] {
  // Celui qui vient d'entrer ne fait rien : le §4.18 lui laisse le temps de
  // prendre un poste, un nom et un visage qu'on reconnait.
  const installes = fous.filter((fou) => fou.journeeDArrivee < journee);
  const dus = installes.filter((fou) => fou.journeeDeLActe <= journee);
  if (dus.length === 0) return [];

  const enGroupe = installes.length >= REGLAGES_ARRIVEES.taillePourUnGroupe;
  const agissants = enGroupe ? installes : dus;
  return agissants.map((fou) => ({ fou, acte: ACTE_PAR_DEGRE[fou.degre] }));
}

/**
 * Il a frappe. Que devient-il ?
 *
 * Le voleur part avec les stocks — lui, on comprend. Les deux autres **restent,
 * et ne sont jamais demasques** : au matin il y a un mort ou une breche, et rien
 * ne dit qui. Un coupable nomme serait un probleme resolu ; un coupable anonyme
 * est un village ou l'on regarde ses propres gens autrement.
 *
 * @returns vrai s'il reste au village
 */
export function replanifier(fou: Fou, journee: number, rng: Rng): boolean {
  if (fou.degre === 1) return false;
  const { min, max } = REGLAGES_ARRIVEES.recidive;
  fou.journeeDeLActe = journee + rng.int(min, max);
  return true;
}

/**
 * Qui il tue.
 *
 * Un fou ne se tue jamais lui-meme, et il ne tue pas un autre fou : ils se sont
 * trouves (§4.18).
 *
 * @param candidats les identifiants des habitants vivants
 * @returns l'identifiant de la victime, ou null s'il n'y a personne d'autre
 */
export function victimeDe(
  fou: Fou,
  candidats: readonly number[],
  fous: readonly Fou[],
  rng: Rng,
): number | null {
  const possibles = candidats.filter(
    (id) => id !== fou.id && !fous.some((autre) => autre.id === id),
  );
  if (possibles.length === 0) return null;
  return rng.pick(possibles);
}
