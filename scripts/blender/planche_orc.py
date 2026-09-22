"""La planche de l'orc de la horde (DESIGN.md §4.33, palier 2) : juger le langage sur image.

    python scripts/blender/planche_orc.py <dossier>

Lit les essais reduits par `planche_persos.py` (`.tmp/blender/persos/planches/
monstre-orc-*-planche.png`) et pose, sur de vrais bouts de sol du jeu, de jour
et de nuit :

  1. les trois silhouettes a l'essai, en vert d'orc ordinaire ;
  2. le langage du §4.33 sur une seule silhouette : la **teinte** dit qui c'est,
     la **luminosite** dit ce qu'il reste de vie, le **rouge** dit le coup
     encaisse, la **taille** dit le rang ;
  3. une horde a la taille du jeu, tous canaux melanges, pour juger la masse.

La teinte est appliquee comme le fera le shader : le ton moyen de l'orc (le
corps de la matiere `orc`) devient **exactement** la couleur du type, le clair
et le sombre suivent. Une multiplication brute assombrirait tout d'un tiers — la
nuit, la horde disparaitrait.
"""
import os
import random
import sys

from PIL import Image, ImageDraw, ImageFont

RACINE = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
PLANCHES = os.path.join(RACINE, ".tmp", "blender", "persos", "planches")
SORTIE = sys.argv[1] if len(sys.argv) > 1 else os.path.join(RACINE, "captures", "planches", "orc")
os.makedirs(SORTIE, exist_ok=True)

# Les neuf couleurs du jeu (`src/game/ui/couleurs.ts`) : rien d'autre.
BILE = (0x7F, 0x94, 0x40)
LAITON = (0xC9, 0x9A, 0x3A)
CIEL_SALE = (0x9D, 0xB3, 0xC4)
SANG_FRAIS = (0xE0, 0x40, 0x2A)
OS = (0xD9, 0xC9, 0xB0)
# Le ton moyen de la matiere `orc` (`palette.json`) : c'est lui qui prend la teinte.
CORPS_ORC = 166

TYPES = [("ordinaire", BILE), ("cracheur", LAITON), ("kamikaze", CIEL_SALE)]
VIES = [1.0, 0.7, 0.45, 0.25]
RANGS = [("pietaille", 1.0), ("boss", 1.5), ("enorme", 2.2)]
VARIANTES = ["orc"]


def charger(variante):
    im = Image.open(os.path.join(PLANCHES, f"monstre-{variante}-planche.png")).convert("RGBA")
    return im.crop((0, 0, im.height, im.height))


def teinter(sprite, couleur, vie=1.0, coup=False):
    """Ce que fera le shader : le ton moyen devient la couleur, la vie assombrit, le coup rougit."""
    if coup:
        couleur = SANG_FRAIS
    px = sprite.load()
    out = Image.new("RGBA", sprite.size)
    po = out.load()
    for y in range(sprite.height):
        for x in range(sprite.width):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            gris = (r + g + b) / 3
            k = gris / CORPS_ORC * vie
            po[x, y] = tuple(min(255, int(c * k)) for c in couleur) + (a,)
    return out


def sol(capture, boite, taille):
    """La couleur de l'herbe du jeu, prise sur une capture : la mediane d'une zone.

    ⚠️ Pas un bout de sol agrandi : la capture de jour est au dezoom maximal, et
    l'agrandir faisait des arbres en paves. Ce qui compte pour juger la
    lisibilite, c'est la valeur et la teinte du fond ; la mediane ecarte les
    quelques arbres de la zone.
    """
    im = Image.open(capture).convert("RGB").crop(boite)
    canaux = list(zip(*im.getdata()))
    mediane = tuple(sorted(c)[len(c) // 2] for c in canaux)
    return Image.new("RGBA", taille, mediane + (255,))


JOUR = os.path.join(RACINE, "captures", "jeu", "2026-09-22-ciel", "1-sec-jour.png")
NUIT = os.path.join(RACINE, "captures", "jeu", "2026-09-22-horde-800", "4242-20s-village.png")
# Des zones d'herbe sans rien dessus, mesurees sur les deux captures.
BOITE_JOUR = (1900, 1000, 2300, 1200)
BOITE_NUIT = (100, 450, 500, 650)

try:
    POLICE = ImageFont.truetype("arial.ttf", 16)
    PETITE = ImageFont.truetype("arial.ttf", 13)
except OSError:
    POLICE = PETITE = ImageFont.load_default()


def bandeau(titre, cellules, zoom, fond_jour, fond_nuit, legendes):
    """Une ligne : les cellules sur le jour, puis les memes sur la nuit."""
    pas = int(24 * zoom * 2.2)
    w = 40 + pas * len(cellules) * 2 + 60
    h = 40 + pas + 30
    img = Image.new("RGBA", (w, h), (24, 20, 18, 255))
    d = ImageDraw.Draw(img)
    d.text((16, 8), titre, fill=OS, font=POLICE)
    for moitie, fond in enumerate((fond_jour, fond_nuit)):
        x0 = 40 + moitie * (pas * len(cellules) + 20)
        img.alpha_composite(sol(fond, BOITE_JOUR if moitie == 0 else BOITE_NUIT, (pas * len(cellules), pas)), (x0, 36))
        for i, (sprite, echelle) in enumerate(cellules):
            z = zoom * echelle
            g = sprite.resize((int(sprite.width * z), int(sprite.height * z)), Image.NEAREST)
            img.alpha_composite(g, (x0 + i * pas + (pas - g.width) // 2, 36 + pas - g.height - 4))
            d.text((x0 + i * pas + 4, 36 + pas + 4), legendes[i], fill=(200, 190, 175, 255), font=PETITE)
    return img


def horde(sprites, zoom, fond, boite, graine=7, n=70):
    """Une horde a la taille du jeu : types, vies et coups melanges, triee par profondeur."""
    w, h = 900, 320
    img = sol(fond, boite, (w, h))
    rng = random.Random(graine)
    orcs = []
    for _ in range(n):
        t = rng.random()
        couleur = BILE if t < 0.8 else LAITON if t < 0.9 else CIEL_SALE
        vie = rng.choice([1.0, 1.0, 0.8, 0.6, 0.4, 0.25])
        coup = rng.random() < 0.12
        x, y = rng.randint(10, w - 60), rng.randint(10, h - 60)
        orcs.append((y, x, teinter(sprites["orc"], couleur, vie, coup)))
    # Un boss au milieu : il est plus grand, c'est tout ce qui le distingue.
    orcs.append((h // 2, w // 2, teinter(sprites["orc"], BILE, 1.0), 1.5))
    for o in sorted(orcs, key=lambda o: o[0]):
        y, x, s = o[0], o[1], o[2]
        e = o[3] if len(o) > 3 else 1.0
        g = s.resize((int(s.width * zoom * e), int(s.height * zoom * e)), Image.NEAREST)
        img.alpha_composite(g, (x, y))
    return img


def main():
    sprites = {v: charger(v) for v in VARIANTES}
    base = sprites["orc"]
    lignes = []
    lignes.append(bandeau(
        "1. Les deux silhouettes, en vert d'orc ordinaire (x6) — jour, puis nuit",
        [(teinter(sprites[v], BILE), 1.0) for v in VARIANTES], 6, JOUR, NUIT, VARIANTES))
    lignes.append(bandeau(
        "2. La teinte dit qui c'est : bile pour l'ordinaire, laiton pour le cracheur, ciel sale pour le kamikaze",
        [(teinter(base, c), 1.0) for _, c in TYPES], 6, JOUR, NUIT, [n for n, _ in TYPES]))
    lignes.append(bandeau(
        "3. La luminosite dit la vie : il fonce en mourant (100, 70, 45, 25 %)",
        [(teinter(base, BILE, v), 1.0) for v in VIES], 6, JOUR, NUIT, [f"{int(v * 100)} %" for v in VIES]))
    lignes.append(bandeau(
        "4. Le rouge dit le coup encaisse — une fraction de seconde",
        [(teinter(base, BILE), 1.0), (teinter(base, BILE, coup=True), 1.0),
         (teinter(base, BILE, 0.45), 1.0), (teinter(base, BILE, 0.45, coup=True), 1.0)],
        6, JOUR, NUIT, ["intact", "touche", "blesse", "blesse, touche"]))
    lignes.append(bandeau(
        "5. La taille dit le rang : pietaille, boss, enorme (x4)",
        [(teinter(base, BILE), e) for _, e in RANGS], 4, JOUR, NUIT, [n for n, _ in RANGS]))

    w = max(l.width for l in lignes)
    h = sum(l.height for l in lignes) + 10 * len(lignes)
    planche = Image.new("RGBA", (w, h), (24, 20, 18, 255))
    y = 0
    for l in lignes:
        planche.alpha_composite(l, (0, y))
        y += l.height + 10
    planche.save(os.path.join(SORTIE, "1-langage.png"))

    # La horde a la taille du jeu (zoom 2 : ce que montre le jeu a son zoom d'entree).
    for nom, fond, boite in (("2-horde-jour", JOUR, BOITE_JOUR), ("3-horde-nuit", NUIT, BOITE_NUIT)):
        horde(sprites, 2, fond, boite).save(os.path.join(SORTIE, f"{nom}.png"))
    print(f"[orc] planches -> {SORTIE}")


if __name__ == "__main__":
    main()
