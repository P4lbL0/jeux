import { mkdirSync, writeFileSync } from "node:fs";
import {
  TAUX,
  aNiveau,
  boucler,
  duree,
  ecrire,
  gain,
  hasard,
  passeBas,
  passeHaut,
  poser,
  silence,
  type Son,
} from "./dsp";

/**
 * Les sons du ciel (DESIGN.md §4.21) : l'averse et le tonnerre.
 *
 *     npm run ciel
 *
 * **Fabriques, pas telecharges** — comme la cloche et le grondement du 19
 * septembre 2026 (`synthese.ts`), et pour les memes raisons : les banques qui
 * ont de belles averses interdisent aux robots de les telecharger, et une pluie
 * **ne se reconnait pas a son grain**. C'est du bruit filtre ; elle se fabrique
 * donc mieux qu'elle ne se cherche, et elle boucle parfaitement, ce qu'un
 * enregistrement ne fait jamais.
 *
 * Trois choses font qu'un bruit filtre s'entend comme de la pluie plutot que
 * comme un souffle :
 *
 * 1. **Deux bandes, pas une.** Le lointain est un souffle large et sourd ; le
 *    proche est une bande aigue ou l'on entend les gouttes taper. Un seul
 *    filtre donne un sifflement de radio.
 * 2. **Des gouttes comptees.** Quelques centaines d'impacts courts par seconde,
 *    poses au hasard et places a gauche ou a droite : c'est le **grain** qui
 *    manque au bruit pur.
 * 3. **Une respiration.** L'averse enfle et retombe lentement (quelques
 *    secondes) : une pluie d'intensite parfaitement constante s'entend comme
 *    une machine.
 *
 * Le tonnerre, lui, tient en deux gestes : un **craquement** (bande haute, tres
 * court) puis un **roulement** (bande grave qui enfle, retombe et traine).
 */

const LIVRAISON = "src/assets/son";

/** La boucle de pluie : assez longue pour qu'on n'entende pas le retour. */
const SECONDES_PLUIE = 12;
/** Le croisement de la boucle : sur du bruit, une seconde suffit et ne s'entend pas. */
const CROISEMENT = 1;

// ------------------------------------------------------------------- l'averse

/**
 * Une averse.
 *
 * @param force 0 une pluie fine, 1 une averse pleine
 * @param secondes la duree brute a fabriquer (bouclee plus court ensuite)
 */
function averse(force: number, secondes: number, graine: number): Son {
  const alea = hasard(graine);
  const n = Math.round(secondes * TAUX);
  const brut: Son = { g: new Float32Array(n), d: new Float32Array(n) };

  // 1. Le souffle : deux bruits **independants** a gauche et a droite. Le meme
  // bruit des deux cotes se colle au milieu de la tete et sonne comme un casque
  // casse ; deux bruits sans rapport ouvrent l'image.
  for (let i = 0; i < n; i++) {
    brut.g[i] = alea() * 2 - 1;
    brut.d[i] = alea() * 2 - 1;
  }

  // Le lointain : sourd, c'est la masse d'eau.
  const lointain = gain(passeBas({ g: brut.g.slice(), d: brut.d.slice() }, 900), 0.55);
  // Le proche : la bande ou les gouttes tapent. Passe-haut puis passe-bas :
  // au-dela de 7 kHz, ce n'est plus de la pluie, c'est du souffle de cassette.
  const proche = gain(passeBas(passeHaut(brut, 1400), 7000), 0.3 + 0.35 * force);

  const son = silence(secondes);
  for (let i = 0; i < n; i++) {
    son.g[i] = lointain.g[i] + proche.g[i];
    son.d[i] = lointain.d[i] + proche.d[i];
  }

  // 2. Les gouttes : des impacts courts, poses au hasard, places a gauche ou a
  // droite. C'est ce qui separe une averse d'un souffle.
  const gouttes = Math.round(secondes * (150 + 320 * force));
  for (let k = 0; k < gouttes; k++) {
    const a = alea() * (secondes - 0.05);
    const longue = alea() < 0.25;
    const impact = goutte(alea, longue);
    poser(son, impact, a, (0.1 + 0.16 * force) * (0.4 + alea()), alea() * 2 - 1);
  }

  // 3. La respiration : l'averse enfle et retombe sur quelques secondes. Trois
  // periodes sans rapport entre elles, pour qu'on n'entende pas le cycle.
  for (let i = 0; i < n; i++) {
    const t = i / TAUX;
    const souffle =
      1 +
      0.16 * Math.sin((t * Math.PI * 2) / 7.3) +
      0.09 * Math.sin((t * Math.PI * 2) / 3.1 + 1.4) +
      0.05 * Math.sin((t * Math.PI * 2) / 1.7 + 0.6);
    son.g[i] *= souffle;
    son.d[i] *= souffle;
  }

  return son;
}

/** Une goutte : un impact court, plus ou moins clair. */
function goutte(alea: () => number, longue: boolean): Son {
  const secondes = longue ? 0.02 : 0.007;
  const n = Math.round(secondes * TAUX);
  const s: Son = { g: new Float32Array(n), d: new Float32Array(n) };
  for (let i = 0; i < n; i++) {
    // Une decroissance rapide : un impact qui traine devient un claquement.
    const enveloppe = Math.exp((-i / n) * 6);
    const v = (alea() * 2 - 1) * enveloppe;
    s.g[i] = v;
    s.d[i] = v;
  }
  return passeHaut(s, longue ? 2200 : 4200);
}

// ------------------------------------------------------------------ le tonnerre

/**
 * Un coup de tonnerre.
 *
 * @param proche 1 juste au-dessus (le craquement domine), 0 a l'horizon (il ne
 *               reste que le roulement)
 */
function tonnerre(proche: number, graine: number): Son {
  const alea = hasard(graine);
  const secondes = 3.4 + 2.2 * (1 - proche);
  const n = Math.round(secondes * TAUX);
  const brut: Son = { g: new Float32Array(n), d: new Float32Array(n) };
  for (let i = 0; i < n; i++) {
    brut.g[i] = alea() * 2 - 1;
    brut.d[i] = alea() * 2 - 1;
  }

  // Le roulement : la bande grave. Son enveloppe **monte** vite puis traine
  // longtemps — c'est ce qui fait entendre une distance.
  const roulement = passeBas({ g: brut.g.slice(), d: brut.d.slice() }, 190 + 120 * proche);
  for (let i = 0; i < n; i++) {
    const t = i / TAUX;
    const montee = Math.min(1, t / (0.05 + 0.5 * (1 - proche)));
    const chute = Math.exp(-t / (0.9 + 1.4 * (1 - proche)));
    // Les grondements successifs : le tonnerre n'est pas un seul coup, c'est
    // un eclair long dont les morceaux arrivent les uns apres les autres.
    const vagues =
      1 + 0.5 * Math.sin(t * 5.7 + 0.4) * Math.exp(-t / 2) + 0.3 * Math.sin(t * 11.3 + 2.1);
    const k = montee * chute * vagues;
    roulement.g[i] *= k;
    roulement.d[i] *= k;
  }

  const son = gain(roulement, 0.9);

  // Le craquement : la bande haute, tres courte, et seulement quand c'est
  // proche. De loin, l'air a mange les aigus — c'est pour ca qu'un orage
  // lointain gronde au lieu de claquer.
  if (proche > 0.2) {
    const court = Math.round(0.35 * TAUX);
    const sec: Son = { g: new Float32Array(court), d: new Float32Array(court) };
    for (let i = 0; i < court; i++) {
      const enveloppe = Math.exp((-i / court) * 9);
      sec.g[i] = (alea() * 2 - 1) * enveloppe;
      sec.d[i] = (alea() * 2 - 1) * enveloppe;
    }
    poser(son, gain(passeHaut(sec, 900), 0.55 * proche), 0, 1, (alea() * 2 - 1) * 0.3);
  }

  return son;
}

// ---------------------------------------------------------------------- livrer

mkdirSync(LIVRAISON, { recursive: true });

const livrer = (son: Son, nom: string) => {
  ecrire(son, `${LIVRAISON}/${nom}.ogg`, ["-c:a", "libvorbis", "-q:a", "4"]);
  ecrire(son, `${LIVRAISON}/${nom}.mp3`, ["-c:a", "libmp3lame", "-b:a", "128k"]);
  console.log(`[ciel] ${nom} — ${duree(son).toFixed(1)} s`);
};

// L'averse ordinaire, et celle de l'orage : plus forte, plus grave, plus dense.
const pluie = boucler(
  aNiveau(averse(0.45, SECONDES_PLUIE + CROISEMENT + 1, 2026), 0.22),
  SECONDES_PLUIE,
  CROISEMENT,
);
livrer(pluie, "bruit-pluie");

const orage = boucler(
  aNiveau(averse(1, SECONDES_PLUIE + CROISEMENT + 1, 922), 0.31),
  SECONDES_PLUIE,
  CROISEMENT,
);
livrer(orage, "bruit-pluie-forte");

// Deux tonnerres : un proche qui claque, un lointain qui gronde. Le jeu tire
// entre les deux selon ce qu'il veut faire ressentir.
livrer(aNiveau(tonnerre(1, 7), 0.5), "bruit-tonnerre");
livrer(aNiveau(tonnerre(0.1, 13), 0.34), "bruit-tonnerre-loin");

// ---------------------------------------------------------- la page d'ecoute

/**
 * Une page pour juger a l'oreille, comme les planches d'ecoute du 20 septembre.
 *
 * ⚠️ **Un son ne se juge pas en le regardant**, et surtout pas en lisant un
 * niveau moyen : on peut mesurer qu'une averse ne sature pas, pas qu'elle
 * ressemble a de la pluie. La page pointe les fichiers livres la ou ils sont —
 * rien n'est duplique dans le depot.
 */
const ECOUTE = "captures/son/2026-09-22-ciel";
mkdirSync(ECOUTE, { recursive: true });

const MORCEAUX = [
  {
    nom: "L'averse ordinaire",
    fichier: "bruit-pluie",
    quand: "Une journee sur trois, de l'aube jusqu'au milieu du jour. En boucle, sur la piste « ambiance ».",
    juger: "Laisse-la tourner une minute : c'est une boucle de douze secondes, et le retour ne doit pas s'entendre.",
  },
  {
    nom: "L'averse d'orage",
    fichier: "bruit-pluie-forte",
    quand: "Une journee sur douze, et elle ne cesse pas avant la fin de la nuit.",
    juger: "Elle doit s'entendre comme la meme pluie en plus fort, pas comme un autre endroit.",
  },
  {
    nom: "Le tonnerre proche",
    fichier: "bruit-tonnerre",
    quand: "Environ quatre eclairs sur dix, entre 0,2 et 0,9 s apres le flash.",
    juger: "Il doit claquer avant de rouler. Le jeu le rejoue un peu plus grave ou plus aigu a chaque fois.",
  },
  {
    nom: "Le tonnerre lointain",
    fichier: "bruit-tonnerre-loin",
    quand: "Les six autres, entre 1,4 et 3,4 s apres le flash — c'est ce retard qui donne la distance.",
    juger: "Aucun claquement : de loin, l'air mange les aigus. Il ne doit que gronder.",
  },
];

const page = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>Le ciel — ecoute du 22 septembre 2026</title>
<style>
  :root { color-scheme: dark; }
  body {
    margin: 0; padding: 40px 24px 64px;
    background: #14120f; color: #d9c9b0;
    font: 16px/1.6 "Segoe UI", system-ui, sans-serif;
  }
  .dedans { max-width: 760px; margin: 0 auto; }
  h1 { font-size: 22px; letter-spacing: 3px; text-transform: uppercase; margin: 0 0 6px; }
  .intro { color: #9db3c4; margin: 0 0 32px; }
  .bloc {
    border: 1px solid #3b332a; background: #1b1814;
    padding: 18px 20px; margin-bottom: 18px;
  }
  .bloc h2 { font-size: 17px; margin: 0 0 4px; color: #d9c9b0; }
  .quand { margin: 0 0 2px; color: #9db3c4; font-size: 14px; }
  .juger { margin: 0 0 12px; color: #b9a98f; font-size: 14px; font-style: italic; }
  audio { width: 100%; }
  footer { margin-top: 30px; color: #7d8a99; font-size: 14px; }
</style>
</head>
<body>
<div class="dedans">
  <h1>Le ciel</h1>
  <p class="intro">Quatre sons fabriques au code (<code>npm run ciel</code>), comme la cloche et le grondement.
  Rien n'est telecharge, rien n'est sous licence. Dis-moi ce qui va et ce qui ne va pas.</p>
${MORCEAUX.map(
  (m) => `  <div class="bloc">
    <h2>${m.nom}</h2>
    <p class="quand">${m.quand}</p>
    <p class="juger">${m.juger}</p>
    <audio controls loop preload="none" src="../../../src/assets/son/${m.fichier}.mp3"></audio>
  </div>`,
).join("\n")}
  <footer>Les deux averses tournent en boucle ici, comme dans le jeu. Les volumes du jeu passent
  ensuite par les curseurs « ambiance » et « effets » du menu de pause.</footer>
</div>
</body>
</html>
`;

writeFileSync(`${ECOUTE}/ecoute.html`, page);
console.log(`[ciel] page d'ecoute : ${ECOUTE}/ecoute.html`);

// Les credits : rien n'est emprunte, et ca aussi doit etre ecrit. Le fichier
// des bruits telecharges (`CREDITS-BRUITS.md`) est reecrit par `npm run bruits`
// — celui-ci lui appartient en propre.
writeFileSync(
  `${LIVRAISON}/CREDITS-CIEL.md`,
  [
    "# Les sons du ciel",
    "",
    "**Aucun fichier telecharge, aucune licence a respecter** : les quatre sons sont",
    "fabriques par `npm run ciel` (`scripts/son/ciel.ts`), comme la cloche et le",
    "grondement de l'ecran-titre. Les refaire, c'est relancer la commande.",
    "",
    "| Fichier | Ce que c'est |",
    "|---|---|",
    "| `bruit-pluie` | L'averse ordinaire, boucle de 12 s |",
    "| `bruit-pluie-forte` | L'averse d'orage, boucle de 12 s |",
    "| `bruit-tonnerre` | Le coup proche : un craquement puis un roulement |",
    "| `bruit-tonnerre-loin` | Le coup lointain : rien que le roulement |",
    "",
  ].join("\n"),
);
