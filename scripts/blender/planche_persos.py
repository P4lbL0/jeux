"""Reduit les frames de `persos.py` a la taille du jeu et les pose sur une planche.

    python scripts/blender/planche_persos.py [--dossier <dossier>]

Pour chaque famille rendue dans `.tmp/blender/persos/` :
  - chaque frame est reduite comme un sprite du monde (`reduire.py` : la matiere
    qui couvre le bloc, cinq marches de lumiere, l'ombre au sol, le contour) ;
  - la planche de la famille (toutes les frames bout a bout, comme le four du
    jeu) part dans `.tmp/blender/persos/planches/<famille>-planche.png` ;
  - et une planche a juger, zoom x4, part dans le dossier de captures : une
    ligne par famille, le repos, la marche, l'attaque, la mort — plus la ligne
    des paliers pour les heros.
"""
import glob
import json
import os
import sys
from datetime import date

import numpy as np
from PIL import Image, ImageDraw

ICI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, ICI)
import reduire  # noqa: E402

RACINE = os.path.normpath(os.path.join(ICI, "..", ".."))
TMP = os.path.join(RACINE, ".tmp", "blender", "persos")
PLANCHES = os.path.join(TMP, "planches")
os.makedirs(PLANCHES, exist_ok=True)

args = sys.argv[1:]
dossier = args[args.index("--dossier") + 1] if "--dossier" in args else os.path.join(
    RACINE, "captures", "blender", f"{date.today().isoformat()}-personnages")
os.makedirs(dossier, exist_ok=True)

ZOOM = 4
FOND = (78, 92, 49, 255)     # l'herbe du jeu, a peu pres
TEXTE = (232, 224, 212, 255)


def frames_de(cle):
    with open(os.path.join(TMP, f"{cle}.json"), encoding="utf-8") as f:
        meta = json.load(f)
    M, W, H = meta["marge"], meta["largeur"], meta["hauteur"]
    frames = []
    deborde = 0
    for i in range(meta["frames"]):
        base = os.path.join(TMP, f"{cle}__{i:03d}")
        ids = np.asarray(Image.open(f"{base}_id.png").convert("RGBA"), dtype=np.int32)
        lum = np.asarray(Image.open(f"{base}_lumiere.png").convert("RGBA"), dtype=np.float64)
        sortie = reduire.reduire_tableaux(ids, lum, meta)
        cadre = sortie[M:M + H, M:M + W]
        deborde += int((sortie[:, :, 3] == 255).sum() - (cadre[:, :, 3] == 255).sum())
        frames.append(Image.fromarray(cadre.copy()))
    return meta, frames, deborde


def planche_famille(cle, meta, frames):
    W, H = meta["largeur"], meta["hauteur"]
    sheet = Image.new("RGBA", (W * len(frames), H), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        sheet.paste(f, (i * W, 0))
    sheet.save(os.path.join(PLANCHES, f"{cle}-planche.png"))


def agrandir(f):
    return f.resize((f.width * ZOOM, f.height * ZOOM), Image.NEAREST)


def coller(planche, f, x, y):
    g = agrandir(f)
    planche.alpha_composite(g, (x, y))
    return g.width


def planche_a_juger(familles):
    """Une ligne par famille : le nom, le repos, la marche, l'attaque, la mort."""
    lignes = []
    plus_large = 0
    for cle, (meta, frames, _) in familles.items():
        plages = {p["cle"]: p for p in meta["plages"]}
        morceaux = []
        for geste in ("repos", "marche", "attaque", "incantation", "charge", "touche", "mort", "toux"):
            if geste not in plages:
                continue
            p = plages[geste]
            morceaux.append((geste, frames[p["debut"]:p["fin"] + 1]))
        largeur = 190 + sum(len(fs) * (meta["largeur"] * ZOOM + 2) + 18 for _, fs in morceaux)
        plus_large = max(plus_large, largeur)
        lignes.append((cle, meta, morceaux))
    hauteur_ligne = CADRE_MAX * ZOOM + 22
    planche = Image.new("RGBA", (plus_large + 20, len(lignes) * hauteur_ligne + 40), FOND)
    d = ImageDraw.Draw(planche)
    d.text((12, 10), f"Personnages low-poly Blender, zoom x{ZOOM} (1 pixel du jeu = {ZOOM} pixels ici)", fill=TEXTE)
    y = 34
    for cle, meta, morceaux in lignes:
        d.text((12, y + hauteur_ligne // 2 - 6), cle, fill=TEXTE)
        x = 190
        for geste, fs in morceaux:
            d.text((x, y), geste, fill=TEXTE)
            for f in fs:
                x += coller(planche, f, x, y + hauteur_ligne - meta["hauteur"] * ZOOM - 4) + 2
            x += 18
        y += hauteur_ligne
    return planche


def planche_paliers(familles):
    """Les heros par palier : une colonne par classe, une ligne par palier rendu."""
    heros = {}
    for cle, (meta, frames, _) in familles.items():
        if not cle.startswith("hero-"):
            continue
        _, classe, palier = cle.split("-")
        heros.setdefault(classe, {})[int(palier[1:])] = frames[0]
    if not heros:
        return None
    classes = list(heros.keys())
    paliers = sorted({p for v in heros.values() for p in v})
    pas = 20 * ZOOM + 14
    planche = Image.new("RGBA", (120 + len(classes) * pas + 20, 40 + len(paliers) * (pas + 4) + 10), FOND)
    d = ImageDraw.Draw(planche)
    d.text((12, 10), f"Les heros par palier d'equipement, zoom x{ZOOM}", fill=TEXTE)
    for j, classe in enumerate(classes):
        d.text((120 + j * pas, 26), classe[:9], fill=TEXTE)
    for i, palier in enumerate(paliers):
        y = 44 + i * (pas + 4)
        d.text((12, y + pas // 2 - 6), f"palier {palier}", fill=TEXTE)
        for j, classe in enumerate(classes):
            f = heros[classe].get(palier)
            if f is not None:
                coller(planche, f, 120 + j * pas, y)
    return planche


CADRE_MAX = 30

if __name__ == "__main__":
    familles = {}
    for meta_fichier in sorted(glob.glob(os.path.join(TMP, "*.json"))):
        cle = os.path.basename(meta_fichier)[:-5]
        meta, frames, deborde = frames_de(cle)
        planche_famille(cle, meta, frames)
        familles[cle] = (meta, frames, deborde)
        alerte = f"  ATTENTION {deborde} px hors du cadre" if deborde else ""
        print(f"[persos] {cle} : {len(frames)} frames de {meta['largeur']} px{alerte}")
    if not familles:
        print("[persos] rien a reduire dans .tmp/blender/persos/")
        sys.exit(1)
    # les gestes complets d'abord (palier 0 et betes), les paliers a part
    completes = {k: v for k, v in familles.items() if v[0]["frames"] > 1}
    planche_a_juger(completes).save(os.path.join(dossier, "planche-personnages.png"))
    print(f"[persos] {os.path.join(dossier, 'planche-personnages.png')}")
    p = planche_paliers(familles)
    if p is not None:
        p.save(os.path.join(dossier, "planche-paliers.png"))
        print(f"[persos] {os.path.join(dossier, 'planche-paliers.png')}")
