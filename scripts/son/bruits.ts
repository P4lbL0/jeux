import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { TAUX, aCrete, crete, duree, ecrire, enveloppe, lire, poser, silence, type Son } from "./dsp";
import { recupererLesSources, type Source } from "./sources";

/**
 * Les bruits de la partie (DESIGN.md §4.10, phase 2) : les planches d'ecoute.
 *
 *     npm run bruits                       -> sources (une fois), puis captures/son/<date>-bruits/
 *     npm run bruits -- --dossier <dossier>  -> ... ailleurs (la date par defaut est en UTC)
 *
 * Personne ici ne peut ecouter : l'agent n'a pas d'oreilles, et Angelos ne
 * peut juger que ce qu'on lui fait entendre. Alors, pour chaque **evenement
 * nomme** que les animations emettent deja (`four.ts` : pioche, hache, semis,
 * toux, lame, sort, morsure, chute...), on met **deux a quatre candidats**
 * dans un seul fichier, l'un apres l'autre : le numero en bips (un bip = le
 * candidat 1, deux bips = le 2...), puis le bruit joue deux fois. Tous sont
 * ramenes a la meme crete, pour que le plus fort ne gagne pas d'office.
 * Angelos repond « pioche 2, hache 1... », et le branchement vient apres.
 *
 * Tout est **CC0**, verifie page par page (OpenGameArt, Kenney) — decision du
 * 20 septembre 2026 : des enregistrements libres, rien de fabrique. Les
 * planches ne sont pas les fichiers du jeu : ceux-la partiront dans
 * `src/assets/son/` une fois les choix faits.
 */

const RACINE = resolve(".");
const SOURCES_DIR = resolve(".tmp/son/sources-bruits");
const DATE = new Date().toISOString().slice(0, 10);
const arg = process.argv.indexOf("--dossier");
const ECOUTE = resolve(arg > 0 ? process.argv[arg + 1]! : `captures/son/${DATE}-bruits`);

// ------------------------------------------------------------------ sources

const OGA = "https://opengameart.org/sites/default/files";
const KENNEY_IMPACT = "https://kenney.nl/media/pages/assets/impact-sounds/87b4ddecda-1677589768/kenney_impact-sounds.zip";
const KENNEY_RPG = "https://kenney.nl/media/pages/assets/rpg-audio/8e99002d76-1677590336/kenney_rpg-audio.zip";

/** Un son d'un pack Kenney : l'archive, et le fichier dedans. */
function kenney(fichier: string, pack: "impact" | "rpg", role: string): Source {
  return {
    fichier,
    url: pack === "impact" ? KENNEY_IMPACT : KENNEY_RPG,
    dansArchive: `Audio/${fichier}`,
    titre: `${pack === "impact" ? "Impact Sounds" : "RPG Audio"} (${fichier.replace(/\.ogg$/, "")})`,
    auteur: "Kenney",
    licence: "CC0",
    page: pack === "impact" ? "https://kenney.nl/assets/impact-sounds" : "https://kenney.nl/assets/rpg-audio",
    role,
  };
}

/** Un son d'OpenGameArt, tel quel ou sorti d'une archive. */
function oga(
  fichier: string,
  url: string,
  titre: string,
  auteur: string,
  page: string,
  role: string,
  dansArchive?: string,
): Source {
  return { fichier, url, dansArchive, titre, auteur, licence: "CC0", page: `https://opengameart.org/content/${page}`, role };
}

const SOURCES = {
  // la pioche
  mining0: kenney("impactMining_000.ogg", "impact", "pioche, candidat 1"),
  mining2: kenney("impactMining_002.ogg", "impact", "pioche, candidat 2"),
  mining4: kenney("impactMining_004.ogg", "impact", "pioche, candidat 3"),
  // la hache
  chop: kenney("chop.ogg", "rpg", "hache, candidat 1"),
  arbre: oga("chop-tree-fall.ogg", `${OGA}/chop-tree-fall.ogg`, "tree chop fall thud", "kheetor", "tree-chop-fall-thud", "hache, candidat 2 (le coup seul)"),
  boisLourd1: kenney("impactWood_heavy_001.ogg", "impact", "hache, candidat 3"),
  // les semis
  sow: oga("sow.ogg", `${OGA}/sow_0.ogg`, "Sow seeds", "themightyglider", "sow-seeds", "semis, candidat 1"),
  cloth2: kenney("cloth2.ogg", "rpg", "semis, candidat 2"),
  cuir: kenney("handleSmallLeather.ogg", "rpg", "semis, candidat 3"),
  // la ligne du pecheur
  splashEzwa2: oga("water_splash-02.flac", `${OGA}/ezwa-water_splash.7z`, "6 Short water splashes", "qubodup", "6-short-water-splashes", "ligne, candidat 1", "ezwa-water_splash/water_splash-02.flac"),
  splashEzwa4: oga("water_splash-04.flac", `${OGA}/ezwa-water_splash.7z`, "6 Short water splashes", "qubodup", "6-short-water-splashes", "ligne, candidat 2 (apres le lancer)", "ezwa-water_splash/water_splash-04.flac"),
  splashDuck3: oga("splash_03.ogg", `${OGA}/water-splash-slime-sfx.zip`, "40 CC0 water / splash / slime SFX", "rubberduck", "40-cc0-water-splash-slime-sfx", "ligne, candidat 3", "splash_03.ogg"),
  // l'enclume
  forger: oga("forger.ogg", `${OGA}/forger_0.ogg`, "Hammer on Anvil", "themightyglider", "hammer-on-anvil", "enclume, candidat 1"),
  marteau: oga("blacksmithhammer.mp3", `${OGA}/blacksmithhammer_0.mp3`, "Blacksmith's Hammer", "VishwaJai", "blacksmiths-hammer", "enclume, candidat 2"),
  metalLourd1: kenney("impactMetal_heavy_001.ogg", "impact", "enclume, candidat 3"),
  // le maillet
  planche1: kenney("impactPlank_medium_001.ogg", "impact", "maillet, candidat 1"),
  boisMoyen0: kenney("impactWood_medium_000.ogg", "impact", "maillet, candidat 2"),
  thwack3: oga("thwack-03.wav", `${OGA}/thwack-1.0.zip`, "Thwack Sounds", "AntumDeluge", "thwack-sounds", "maillet, candidat 3", "PCM/thwack-03.wav"),
  // les pas
  herbe0: kenney("footstep_grass_000.ogg", "impact", "pas, candidat 1"),
  herbe1: kenney("footstep_grass_001.ogg", "impact", "pas, candidat 1"),
  pas0: kenney("footstep00.ogg", "rpg", "pas, candidat 2"),
  pas1: kenney("footstep01.ogg", "rpg", "pas, candidat 2"),
  // la toux
  touxVieux: oga("old-man-cough.ogg", `${OGA}/old-man-cough_0.ogg`, "Old Man Cough", "AntumDeluge", "old-man-cough", "toux, candidat 1"),
  touxMalade: oga("sickness.wav", `${OGA}/sickness.wav`, "Sick Noises", "frosty ham", "sick-noises", "toux, candidat 2"),
  // la lame
  couteau: kenney("knifeSlice.ogg", "rpg", "lame, candidat 1"),
  epee4: oga("sword.4.ogg", `${OGA}/sword_-_starninjas_1.zip`, "20 Sword Sound Effects", "StarNinjas", "20-sword-sound-effects-attacks-and-clashes", "lame, candidat 2", "sword - StarNinjas/sword.4.ogg"),
  epeeRemaxim: oga("sword sound.wav", `${OGA}/melee%20sounds.zip`, "3 Melee sounds", "remaxim", "3-melee-sounds", "lame, candidat 3", "melee sounds/sword sound.wav"),
  // le tir a l'arc
  swish3: oga("swish-3.wav", `${OGA}/swishes.zip`, "Swishes Sound Pack", "artisticdude", "swishes-sound-pack", "tir, candidat 1", "swishes/swish-3.wav"),
  swish7: oga("swish-7.wav", `${OGA}/swishes.zip`, "Swishes Sound Pack", "artisticdude", "swishes-sound-pack", "tir, candidat 2", "swishes/swish-7.wav"),
  swish1: oga("swish-1.wav", `${OGA}/swishes.zip`, "Swishes Sound Pack", "artisticdude", "swishes-sound-pack", "tir, candidat 3 (apres la corde)", "swishes/swish-1.wav"),
  corde: kenney("creak3.ogg", "rpg", "tir, candidat 3 (la corde qui se tend)"),
  // le sort — deuxieme planche (20 septembre 2026) : les trois « magical » de
  // JaggedStone n'allaient pas, Angelos veut une boule de feu ou une incantation
  bouleDeFeu: oga("fireball-jm.wav", `${OGA}/105016__julien-matthey__jm-fx-fireball-01.wav`, "Fireball (Julien Matthey, relaye en CC0)", "diligentcircle", "fireball-1", "sort, candidat 1"),
  feuSynthese: oga("fire_sound_effect.mp3", `${OGA}/fire_sound_effect_0.mp3`, "Synthesized Fire Sound Effect", "Spring Spring", "synthesized-fire-sound-effect", "sort, candidat 2"),
  sortTerre: oga("earth-spell.ogg", `${OGA}/Earth%20Element%20Magic%20Spell_3.ogg`, "Earth Element Magic Spell", "qubodup", "earth-element-magic-spell", "sort, candidat 3"),
  gel: oga("freeze.wav", `${OGA}/freeze.wav`, "Freeze Spell", "artisticdude", "freeze-spell-0", "sort, candidat 4"),
  magieFantasy: oga("fantasy_magic_button_1.mp3", `${OGA}/fantasy_magic_button_1.mp3`, "Fantasy Magic Spell", "Almitory", "fantasy-magic-spell", "sort, candidat 5"),
  // la morsure
  croc: oga("crunchybite.ogg", `${OGA}/crunchybite_0.ogg`, "Crunchy bite", "fvcalderan", "crunchy-bite", "morsure, candidat 1"),
  bete: oga("animal melee sound.wav", `${OGA}/melee%20sounds.zip`, "3 Melee sounds", "remaxim", "3-melee-sounds", "morsure, candidat 2", "melee sounds/animal melee sound.wav"),
  poing1: kenney("impactPunch_heavy_001.ogg", "impact", "morsure, candidat 3"),
  creature: oga("tiny-vicious-creature.ogg", `${OGA}/tiny-vicious-creature_0.ogg`, "Tiny vicious creature", "Darsycho", "tiny-vicious-creature", "morsure, candidat 4"),
  // la chute (un heros ou un monstre qui tombe)
  mou0: kenney("impactSoft_heavy_000.ogg", "impact", "chute, candidat 1"),
  cloth3: kenney("cloth3.ogg", "rpg", "chute, candidat 1 (l'etoffe)"),
  cuirTombe: kenney("dropLeather.ogg", "rpg", "chute, candidat 2"),
  mou2: kenney("impactSoft_heavy_002.ogg", "impact", "chute, candidat 2"),
  thwack8: oga("thwack-08.wav", `${OGA}/thwack-1.0.zip`, "Thwack Sounds", "AntumDeluge", "thwack-sounds", "chute, candidat 3", "PCM/thwack-08.wav"),
} satisfies Record<string, Source>;

const src = (s: Source, debut = 0, longueur?: number) => lire(`${SOURCES_DIR}/${s.fichier}`, debut, longueur);

// ------------------------------------------------------------------ gestes

/** Coupe le silence avant et apres (sous -45 dB de la crete), et arrondit les bords. */
function rogner(s: Son): Son {
  const seuil = crete(s) * 10 ** (-45 / 20);
  let a = 0;
  let b = s.g.length - 1;
  while (a < b && Math.abs(s.g[a]!) < seuil && Math.abs(s.d[a]!) < seuil) a++;
  while (b > a && Math.abs(s.g[b]!) < seuil && Math.abs(s.d[b]!) < seuil) b--;
  a = Math.max(0, a - Math.round(0.005 * TAUX));
  b = Math.min(s.g.length, b + Math.round(0.06 * TAUX));
  const r: Son = { g: s.g.slice(a, b), d: s.d.slice(a, b) };
  const fin = duree(r);
  return enveloppe(r, (t) => Math.min(1, t / 0.004, (fin - t) / 0.03));
}

/** Garde les `longueur` premieres secondes, et les eteint sur `fondu` secondes. */
function ecourter(s: Son, longueur: number, fondu: number): Son {
  const n = Math.min(s.g.length, Math.round(longueur * TAUX));
  const r: Son = { g: s.g.slice(0, n), d: s.d.slice(0, n) };
  return enveloppe(r, (t) => Math.min(1, (longueur - t) / fondu));
}

/** Plusieurs sons a la suite dans un seul, chacun a son instant. */
function assembler(...parts: [Son, number][]): Son {
  const fin = Math.max(...parts.map(([s, a]) => a + duree(s)));
  const r = silence(fin);
  for (const [s, a] of parts) poser(r, s, a);
  return r;
}

/** `n` bips courts : le numero du candidat, pour qui ecoute sans regarder. */
function bips(n: number): Son {
  const r = silence(0.11 * n + 0.05);
  for (let k = 0; k < n; k++) {
    const b = silence(0.06);
    for (let i = 0; i < b.g.length; i++) {
      const t = i / TAUX;
      const env = Math.min(1, t / 0.008, (0.06 - t) / 0.012);
      const v = 0.12 * env * Math.sin(2 * Math.PI * 1000 * t);
      b.g[i] = v;
      b.d[i] = v;
    }
    poser(r, b, 0.11 * k);
  }
  return r;
}

// -------------------------------------------------------------- candidats

interface Candidat {
  /** Ce qu'Angelos lit dans le LISEZMOI. */
  quoi: string;
  sources: Source[];
  fabriquer: () => Son;
}

interface Evenement {
  nom: string;
  /** Quand le jeu le jouera. */
  quand: string;
  candidats: Candidat[];
}

const un = (quoi: string, s: Source, fabriquer: () => Son = () => src(s)): Candidat => ({ quoi, sources: [s], fabriquer });

const EVENEMENTS: Evenement[] = [
  {
    nom: "pioche",
    quand: "le mineur, a chaque coup (frame d'impact du geste de travail)",
    candidats: [
      un("Kenney, impactMining 000", SOURCES.mining0),
      un("Kenney, impactMining 002", SOURCES.mining2),
      un("Kenney, impactMining 004", SOURCES.mining4),
    ],
  },
  {
    nom: "hache",
    quand: "le bucheron, a chaque coup",
    candidats: [
      un("Kenney, chop", SOURCES.chop),
      un("kheetor, le coup seul de « tree chop fall thud »", SOURCES.arbre, () => src(SOURCES.arbre, 0, 0.8)),
      un("Kenney, impactWood heavy 001", SOURCES.boisLourd1),
    ],
  },
  {
    nom: "semis",
    quand: "le fermier, a chaque geste aux champs",
    candidats: [
      un("themightyglider, « Sow seeds »", SOURCES.sow),
      un("Kenney, cloth2 (de l'etoffe qui bouge)", SOURCES.cloth2),
      un("Kenney, handleSmallLeather (un sac qu'on manie)", SOURCES.cuir),
    ],
  },
  {
    nom: "ligne",
    quand: "le pecheur, a chaque lancer",
    candidats: [
      un("qubodup, water splash 02", SOURCES.splashEzwa2),
      {
        quoi: "artisticdude swish 7 (le lancer) puis qubodup water splash 04 (la ligne qui tombe)",
        sources: [SOURCES.swish7, SOURCES.splashEzwa4],
        fabriquer: () => assembler([src(SOURCES.swish7), 0], [src(SOURCES.splashEzwa4), 0.4]),
      },
      un("rubberduck, splash 03", SOURCES.splashDuck3),
    ],
  },
  {
    nom: "enclume",
    quand: "le forgeron, a chaque coup",
    candidats: [
      un("themightyglider, « Hammer on Anvil » (le premier coup)", SOURCES.forger, () => ecourter(src(SOURCES.forger, 0, 0.7), 0.6, 0.15)),
      un("VishwaJai, « Blacksmith's Hammer »", SOURCES.marteau),
      un("Kenney, impactMetal heavy 001", SOURCES.metalLourd1),
    ],
  },
  {
    nom: "maillet",
    quand: "le charpentier, a chaque coup",
    candidats: [
      un("Kenney, impactPlank medium 001", SOURCES.planche1),
      un("Kenney, impactWood medium 000", SOURCES.boisMoyen0),
      un("AntumDeluge, thwack 03", SOURCES.thwack3),
    ],
  },
  {
    nom: "pas",
    quand: "le guetteur et le survivant, deux pas par geste",
    candidats: [
      {
        quoi: "Kenney, footstep grass 000 puis 001",
        sources: [SOURCES.herbe0, SOURCES.herbe1],
        fabriquer: () => assembler([src(SOURCES.herbe0), 0], [src(SOURCES.herbe1), 0.42]),
      },
      {
        quoi: "Kenney, footstep 00 puis 01 (RPG Audio)",
        sources: [SOURCES.pas0, SOURCES.pas1],
        fabriquer: () => assembler([src(SOURCES.pas0), 0], [src(SOURCES.pas1), 0.42]),
      },
    ],
  },
  {
    nom: "toux",
    quand: "un habitant ou un heros malade (§4.23), a chaque quinte",
    candidats: [
      un("AntumDeluge, « Old Man Cough » (le debut)", SOURCES.touxVieux, () => ecourter(src(SOURCES.touxVieux, 0, 1.5), 1.3, 0.25)),
      un("frosty ham, « Sick Noises » (les deux premieres toux)", SOURCES.touxMalade, () => ecourter(src(SOURCES.touxMalade, 0, 1.0), 0.85, 0.12)),
    ],
  },
  {
    nom: "lame",
    quand: "le guerrier, le chevalier et l'assassin, a chaque coup",
    candidats: [
      un("Kenney, knifeSlice", SOURCES.couteau),
      un("StarNinjas, sword 4", SOURCES.epee4),
      un("remaxim, « sword sound »", SOURCES.epeeRemaxim),
    ],
  },
  {
    nom: "tir",
    quand: "le rodeur, a chaque volee",
    candidats: [
      un("artisticdude, swish 3", SOURCES.swish3),
      un("artisticdude, swish 7", SOURCES.swish7),
      {
        quoi: "Kenney creak3 (la corde qui se tend) puis artisticdude swish 1",
        sources: [SOURCES.corde, SOURCES.swish1],
        fabriquer: () => assembler([ecourter(src(SOURCES.corde), 0.3, 0.08), 0], [src(SOURCES.swish1), 0.26]),
      },
    ],
  },
  {
    nom: "sort",
    quand: "le mage, l'oracle et le necromancien, a chaque incantation et a chaque coup",
    candidats: [
      un("diligentcircle, « Fireball » (une boule de feu qui part)", SOURCES.bouleDeFeu, () => ecourter(src(SOURCES.bouleDeFeu, 0.1), 1.4, 0.3)),
      un("Spring Spring, « Synthesized Fire Sound Effect » (le debut, une flambee)", SOURCES.feuSynthese, () => ecourter(src(SOURCES.feuSynthese, 0, 1.6), 1.4, 0.35)),
      un("qubodup, « Earth Element Magic Spell » (une incantation de terre, un grondement)", SOURCES.sortTerre, () => ecourter(src(SOURCES.sortTerre), 1.4, 0.35)),
      un("artisticdude, « Freeze Spell » (une incantation de glace)", SOURCES.gel, () => ecourter(src(SOURCES.gel, 0.05), 1.4, 0.35)),
      un("Almitory, « Fantasy Magic Spell » (le debut, un scintillement)", SOURCES.magieFantasy, () => ecourter(src(SOURCES.magieFantasy, 0, 1.6), 1.4, 0.35)),
    ],
  },
  {
    nom: "morsure",
    quand: "un monstre qui attaque, a chaque coup",
    candidats: [
      un("fvcalderan, « Crunchy bite »", SOURCES.croc),
      un("remaxim, « animal melee sound »", SOURCES.bete),
      un("Kenney, impactPunch heavy 001", SOURCES.poing1),
      un("Darsycho, un claquement de « Tiny vicious creature »", SOURCES.creature, () => src(SOURCES.creature, 1.8, 0.5)),
    ],
  },
  {
    nom: "chute",
    quand: "un heros ou un monstre qui meurt, quand il touche le sol",
    candidats: [
      {
        quoi: "Kenney, impactSoft heavy 000 avec cloth3 (le corps, puis l'etoffe)",
        sources: [SOURCES.mou0, SOURCES.cloth3],
        fabriquer: () => assembler([src(SOURCES.mou0), 0], [src(SOURCES.cloth3), 0.05]),
      },
      {
        quoi: "Kenney, dropLeather avec impactSoft heavy 002",
        sources: [SOURCES.cuirTombe, SOURCES.mou2],
        fabriquer: () => assembler([src(SOURCES.cuirTombe), 0], [src(SOURCES.mou2), 0.06]),
      },
      un("AntumDeluge, thwack 08", SOURCES.thwack8),
    ],
  },
];

// ---------------------------------------------------------------- planches

/** La crete commune des candidats : assez fort pour s'entendre, jamais sature. */
const CRETE = -6;

/** Un candidat pret a ecouter : rogne, a la crete commune. */
const preparer = (c: Candidat): Son => aCrete(rogner(c.fabriquer()), CRETE);

/** La planche d'un evenement : bips du numero, le bruit deux fois, un silence. */
function planche(e: Evenement): { son: Son; prets: Son[]; durees: number[] } {
  const prets = e.candidats.map(preparer);
  const durees = prets.map(duree);
  const total = prets.reduce((t, s, i) => t + duree(bips(i + 1)) + 0.35 + 2 * duree(s) + 0.5 + 1.2, 0.3);
  const son = silence(total);
  let t = 0.3;
  prets.forEach((s, i) => {
    const b = bips(i + 1);
    poser(son, b, t);
    t += duree(b) + 0.35;
    poser(son, s, t);
    t += duree(s) + 0.5;
    poser(son, s, t);
    t += duree(s) + 1.2;
  });
  return { son, prets, durees };
}

/**
 * La page d'ecoute : un questionnaire qui joue chaque candidat d'un clic et
 * qui ecrit tout seul la reponse a coller dans la conversation. Elle s'ouvre
 * depuis le dossier des planches (les sons sont a cote d'elle, sur le disque :
 * une page hebergee ne pourrait pas les jouer). Les choix restent dans le
 * navigateur si on recharge.
 */
function pageDEcoute(durees: Map<string, number[]>): string {
  const html = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
  const blocs = EVENEMENTS.map((e) => {
    const d = durees.get(e.nom) ?? [];
    const options = e.candidats
      .map(
        (c, i) => `
        <label class="option">
          <input type="radio" name="${e.nom}" value="${i + 1}">
          <button type="button" class="jouer" data-src="${e.nom}-${i + 1}.mp3" title="Ecouter">&#9654;</button>
          <span><b>${i + 1}</b> ${html(c.quoi)} <small>${(d[i] ?? 0).toFixed(2)} s</small></span>
        </label>`,
      )
      .join("");
    return `
    <section class="question" data-nom="${e.nom}">
      <h2>${e.nom}</h2>
      <p class="quand">Quand : ${html(e.quand)}. Juge-le repete : le jeu le jouera des dizaines de fois par journee.</p>
      ${options}
      <label class="option">
        <input type="radio" name="${e.nom}" value="aucun">
        <span><b>Aucun</b> ne va, on cherche d'autres sources</span>
      </label>
      <input type="text" class="precision" placeholder="Precision ou autre reponse (facultatif)">
    </section>`;
  }).join("");
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Les bruits de la partie</title>
<style>
  :root { --fond: #1b1917; --papier: #26221f; --trait: #4a423b; --texte: #e8e0d4; --gris: #b5aa9c; --accent: #c9a24a; }
  body { margin: 0; padding: 24px 16px 96px; background: var(--fond); color: var(--texte); font: 16px/1.5 Georgia, "Times New Roman", serif; }
  main { max-width: 820px; margin: 0 auto; }
  h1 { font-weight: normal; letter-spacing: 0.04em; margin: 0 0 4px; }
  .intro { color: var(--gris); margin: 0 0 24px; }
  .question { background: var(--papier); border: 1px solid var(--trait); padding: 14px 16px; margin: 0 0 14px; }
  h2 { margin: 0 0 4px; font-size: 20px; font-weight: normal; text-transform: uppercase; letter-spacing: 0.08em; color: var(--accent); }
  .quand { color: var(--gris); margin: 0 0 10px; font-size: 15px; }
  .option { display: flex; align-items: center; gap: 10px; padding: 6px 0; cursor: pointer; }
  .option small { color: var(--gris); margin-left: 6px; }
  .jouer { width: 34px; height: 30px; border: 1px solid var(--trait); background: #332d28; color: var(--texte); cursor: pointer; }
  .jouer:hover, .jouer.en-cours { border-color: var(--accent); color: var(--accent); }
  .precision { width: 100%; box-sizing: border-box; margin-top: 8px; padding: 6px 8px; background: var(--fond); color: var(--texte); border: 1px solid var(--trait); font: inherit; font-size: 15px; }
  .recap { position: fixed; left: 0; right: 0; bottom: 0; background: var(--papier); border-top: 1px solid var(--trait); padding: 10px 16px; }
  .recap div { max-width: 820px; margin: 0 auto; display: flex; gap: 10px; align-items: flex-start; }
  textarea { flex: 1; height: 56px; background: var(--fond); color: var(--texte); border: 1px solid var(--trait); font: inherit; font-size: 14px; padding: 6px 8px; resize: vertical; }
  .copier { height: 34px; padding: 0 14px; border: 1px solid var(--accent); background: transparent; color: var(--accent); cursor: pointer; font: inherit; }
</style>
</head>
<body>
<main>
  <h1>Les bruits de la partie</h1>
  <p class="intro">Un bloc par evenement, deux a quatre candidats chacun, tous a la meme force. Clique sur la fleche pour ecouter, coche celui qui va. Le recapitulatif en bas s'ecrit tout seul : copie-le dans la conversation. Tout est CC0 (${html(DATE)}).</p>
  ${blocs}
</main>
<div class="recap"><div><textarea id="recap" readonly></textarea><button type="button" class="copier" id="copier">Copier</button></div></div>
<script>
(() => {
  const CLE = "protecteur:bruits:${DATE}";
  let etat = {};
  try { etat = JSON.parse(localStorage.getItem(CLE) || "{}"); } catch (e) { etat = {}; }
  let courant = null;
  for (const b of document.querySelectorAll(".jouer")) {
    b.addEventListener("click", (ev) => {
      ev.preventDefault();
      if (courant) { courant.audio.pause(); courant.bouton.classList.remove("en-cours"); }
      const audio = new Audio(b.dataset.src);
      courant = { audio, bouton: b };
      b.classList.add("en-cours");
      audio.addEventListener("ended", () => b.classList.remove("en-cours"));
      audio.play().catch(() => b.classList.remove("en-cours"));
    });
  }
  const recap = document.getElementById("recap");
  const ecrire = () => {
    const lignes = [];
    for (const q of document.querySelectorAll(".question")) {
      const nom = q.dataset.nom;
      const coche = q.querySelector("input[type=radio]:checked");
      const precision = q.querySelector(".precision").value.trim();
      if (coche || precision) lignes.push(nom + " " + (coche ? coche.value : "?") + (precision ? " (" + precision + ")" : ""));
    }
    recap.value = lignes.join(", ");
    try { localStorage.setItem(CLE, JSON.stringify(etat)); } catch (e) {}
  };
  for (const q of document.querySelectorAll(".question")) {
    const nom = q.dataset.nom;
    const sauve = etat[nom] || {};
    if (sauve.choix) { const r = q.querySelector('input[value="' + sauve.choix + '"]'); if (r) r.checked = true; }
    if (sauve.precision) q.querySelector(".precision").value = sauve.precision;
    q.addEventListener("change", () => {
      const coche = q.querySelector("input[type=radio]:checked");
      etat[nom] = { choix: coche ? coche.value : "", precision: q.querySelector(".precision").value };
      ecrire();
    });
    q.querySelector(".precision").addEventListener("input", () => {
      const coche = q.querySelector("input[type=radio]:checked");
      etat[nom] = { choix: coche ? coche.value : "", precision: q.querySelector(".precision").value };
      ecrire();
    });
  }
  document.getElementById("copier").addEventListener("click", () => {
    recap.select();
    try { navigator.clipboard.writeText(recap.value); } catch (e) { document.execCommand("copy"); }
  });
  ecrire();
})();
</script>
</body>
</html>
`;
}

function lisezmoi(durees: Map<string, number[]>): string {
  const lignes = [
    "# Les bruits de la partie — planches d'ecoute",
    "",
    `Fabriquees par \`npm run bruits\` (\`scripts/son/bruits.ts\`) le ${DATE}. Un fichier par evenement :`,
    "le numero du candidat en bips (un bip = 1, deux bips = 2...), puis le bruit joue deux fois.",
    "Tous a la meme crete. **Reponds avec un numero par ligne**, par exemple « pioche 2, hache 1... »,",
    "ou « aucun » si rien ne va : on cherchera d'autres sources.",
    "",
    "Tout est CC0, verifie sur la page de chaque son.",
    "",
    "| Evenement | Quand | Candidats |",
    "|---|---|---|",
  ];
  for (const e of EVENEMENTS) {
    const d = durees.get(e.nom) ?? [];
    const c = e.candidats.map((k, i) => `**${i + 1}** ${k.quoi} (${(d[i] ?? 0).toFixed(2)} s)`).join(" · ");
    lignes.push(`| \`${e.nom}.mp3\` | ${e.quand} | ${c} |`);
  }
  lignes.push("", "## Les sources", "", "| Son | Auteur | Licence | Page |", "|---|---|---|---|");
  const vues = new Set<string>();
  for (const s of Object.values(SOURCES) as Source[]) {
    const cle = `${s.titre}|${s.page}`;
    if (vues.has(cle)) continue;
    vues.add(cle);
    lignes.push(`| ${s.titre} | ${s.auteur} | ${s.licence} | ${s.page} |`);
  }
  return `${lignes.join("\n")}\n`;
}

// ------------------------------------------------------------------- choix

/**
 * Ce qu'Angelos a choisi sur les planches : le numero du candidat par
 * evenement (a partir de 1). Un evenement absent reste muet dans le jeu.
 * `npm run bruits -- --livrer` ecrit les fichiers choisis dans `src/assets/son/`
 * (`bruit-<evenement>.ogg` et `.mp3`) et leurs credits.
 */
const CHOIX: Record<string, number> = {
  // Angelos, le 20 septembre 2026, sur la page d'ecoute. Le « sort » est venu
  // d'une deuxieme planche : les trois premiers n'allaient pas, il voulait une
  // boule de feu ou une incantation — c'est la boule de feu.
  pioche: 1,
  hache: 2,
  semis: 2,
  ligne: 2,
  enclume: 1,
  maillet: 1,
  pas: 1,
  toux: 1,
  lame: 3,
  tir: 2,
  sort: 1,
  morsure: 4,
  chute: 1,
};

const LIVRAISON = resolve("src/assets/son");

function livrer(): void {
  mkdirSync(LIVRAISON, { recursive: true });
  const lignes = [
    "# Les bruits de la partie",
    "",
    "Choisis par Angelos sur les planches d'ecoute (`npm run bruits`), poses par",
    "`npm run bruits -- --livrer`. Ce fichier est reecrit a chaque passage.",
    "",
    "| Evenement | Son | Auteur | Licence |",
    "|---|---|---|---|",
  ];
  for (const e of EVENEMENTS) {
    const n = CHOIX[e.nom];
    if (!n) continue;
    const c = e.candidats[n - 1];
    if (!c) throw new Error(`[bruits] ${e.nom} : pas de candidat ${n}`);
    const son = preparer(c);
    ecrire(son, `${LIVRAISON}/bruit-${e.nom}.ogg`, ["-c:a", "libvorbis", "-q:a", "4"]);
    ecrire(son, `${LIVRAISON}/bruit-${e.nom}.mp3`, ["-c:a", "libmp3lame", "-b:a", "128k"]);
    console.log(`[bruits] livre : bruit-${e.nom} (candidat ${n}, ${duree(son).toFixed(2)} s)`);
    for (const s of c.sources) lignes.push(`| ${e.nom} | [${s.titre}](${s.page}) | ${s.auteur} | ${s.licence} |`);
  }
  writeFileSync(`${LIVRAISON}/CREDITS-BRUITS.md`, `${lignes.join("\n")}\n`);
}

// -------------------------------------------------------------------- tout

async function main(): Promise<void> {
  await recupererLesSources(Object.values(SOURCES) as Source[], SOURCES_DIR);
  if (process.argv.includes("--livrer")) {
    livrer();
    return;
  }
  mkdirSync(ECOUTE, { recursive: true });
  const durees = new Map<string, number[]>();
  for (const e of EVENEMENTS) {
    const p = planche(e);
    durees.set(e.nom, p.durees);
    const fichier = `${ECOUTE}/${e.nom}.mp3`;
    ecrire(p.son, fichier, ["-c:a", "libmp3lame", "-b:a", "160k"]);
    // chaque candidat seul, pour la page d'ecoute
    p.prets.forEach((s, i) => ecrire(s, `${ECOUTE}/${e.nom}-${i + 1}.mp3`, ["-c:a", "libmp3lame", "-b:a", "160k"]));
    console.log(
      `[bruits] ${e.nom.padEnd(8)} ${e.candidats.length} candidats, ${duree(p.son).toFixed(1)} s : ` +
        p.durees.map((d) => `${d.toFixed(2)} s`).join(", ") +
        `  -> ${fichier.replace(RACINE, ".")}`,
    );
  }
  writeFileSync(`${ECOUTE}/LISEZMOI.md`, lisezmoi(durees));
  writeFileSync(`${ECOUTE}/ecoute.html`, pageDEcoute(durees));
  console.log(`[bruits] ${ECOUTE.replace(RACINE, ".")}/LISEZMOI.md et ecoute.html`);
}

void main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
