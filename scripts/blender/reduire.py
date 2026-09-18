"""Réduit les rendus de `rendre.py` à la taille du jeu, dans la palette du jeu.

    python scripts/blender/reduire.py            -> tout ce qui est dans .tmp/blender/
    python scripts/blender/reduire.py bati-      -> seulement les clés qui commencent ainsi

Écrit `src/assets/<cle>.png` : le jeu les charge au démarrage et elles remplacent
le dessin au code de la même clé (`src/game/assets.ts`). Demande Pillow et numpy.

Pour chaque pixel du jeu (un bloc de 8 x 8 rendu) :
  1. la **matière** est celle qui couvre le plus le bloc, lue dans la passe code ;
  2. le **ton** vient de la lumière moyenne de cette matière dans le bloc, rangée
     en cinq marches : sombre, sombre-corps, corps, corps-clair, clair — tous tirés
     des trois tons de la matière dans `palette.json` ;
  3. le **sol** n'est gardé que là où il est à l'ombre : c'est l'ombre portée ;
  4. un **contour** de fer entoure la silhouette, comme `Toile.contour()`.
"""
import glob
import json
import os
import sys

import numpy as np
from PIL import Image

ICI = os.path.dirname(os.path.abspath(__file__))
RACINE = os.path.normpath(os.path.join(ICI, "..", ".."))
TMP = os.path.join(RACINE, ".tmp", "blender")
ASSETS = os.path.join(RACINE, "src", "assets")

with open(os.path.join(ICI, "palette.json"), encoding="utf-8") as f:
    PALETTE = json.load(f)


def rvb(n):
    return np.array([(n >> 16) & 255, (n >> 8) & 255, n & 255], dtype=np.float64)


def melanger(a, b, part):
    return np.round(a + (b - a) * part)


def tons(nom):
    m = PALETTE["matieres"][nom]
    s, c, l = rvb(m["sombre"]), rvb(m["corps"]), rvb(m["clair"])
    return [s, melanger(s, c, 0.5), c, melanger(c, l, 0.5), l]


# Les marches de lumière (0 = noir ; le sol en plein soleil vaut 1,18). Réglées
# en jeu : plus bas, presque tout tombait sur « clair » et le décor sortait pâle
# sur un sol volontairement sombre.
MARCHES = [0.45, 0.68, 0.92, 1.12]
# Le feuillage descend d'une marche : le vert de la palette est clair, et un
# arbre plus clair que la prairie sous lui se lit comme une tache.
DECALAGE = {"feuille": -1}
OMBRE_SOL = 0.9       # sous ce niveau, le sol est dans l'ombre d'un objet (plein soleil : 1,18)
ALPHA_OMBRE = 0.3     # comme `Toile.ombreAuSol`
COUVERTURE = 0.5      # part du bloc qu'une matière doit couvrir pour exister


def reduire(cle):
    with open(os.path.join(TMP, f"{cle}.json"), encoding="utf-8") as f:
        meta = json.load(f)
    S, M = meta["sur"], meta["marge"]
    ids = np.asarray(Image.open(os.path.join(TMP, f"{cle}_id.png")).convert("RGBA"), dtype=np.int32)
    lum = np.asarray(Image.open(os.path.join(TMP, f"{cle}_lumiere.png")).convert("RGBA"),
                     dtype=np.float64)
    h, w = ids.shape[0] // S, ids.shape[1] // S

    # la matière de chaque pixel rendu : la couleur-code la plus proche, s'il
    # est opaque et assez proche (les bords mélangés ne comptent pas)
    noms = list(meta["codes"].keys())
    codes = np.array([meta["codes"][n] for n in noms], dtype=np.int32)
    d = np.abs(ids[:, :, None, :3] - codes[None, None, :, :]).sum(axis=3)
    rang = d.argmin(axis=2)
    rang[(d.min(axis=2) > 18) | (ids[:, :, 3] < 250)] = -1
    clarte = lum[:, :, :3].mean(axis=2) / (0.8 * 255)

    sortie = np.zeros((h, w, 4), dtype=np.uint8)
    opaque = np.zeros((h, w), dtype=bool)
    i_sol = noms.index("sol")
    for y in range(h):
        for x in range(w):
            bloc = rang[y * S:(y + 1) * S, x * S:(x + 1) * S].ravel()
            bloc = bloc[bloc >= 0]
            if bloc.size == 0:
                continue
            compte = np.bincount(bloc, minlength=len(noms))
            objet = compte.copy()
            objet[i_sol] = 0
            if objet.max() >= COUVERTURE * S * S * 0.5 and objet.max() >= compte[i_sol] * 0.6:
                k = int(objet.argmax())
            else:
                k = i_sol
            masque = rang[y * S:(y + 1) * S, x * S:(x + 1) * S] == k
            c = float(clarte[y * S:(y + 1) * S, x * S:(x + 1) * S][masque].mean())
            if k == i_sol:
                if compte[i_sol] >= COUVERTURE * S * S and c < OMBRE_SOL:
                    sortie[y, x] = (*rvb(PALETTE["ombre"]).astype(np.uint8), int(255 * ALPHA_OMBRE))
                continue
            marche = max(0, sum(c > s for s in MARCHES) + DECALAGE.get(noms[k], 0))
            sortie[y, x, :3] = tons(noms[k])[marche]
            sortie[y, x, 3] = 255
            opaque[y, x] = True

    # le contour : tout pixel non opaque qui touche la silhouette (4 voisins)
    voisin = np.zeros_like(opaque)
    voisin[1:, :] |= opaque[:-1, :]
    voisin[:-1, :] |= opaque[1:, :]
    voisin[:, 1:] |= opaque[:, :-1]
    voisin[:, :-1] |= opaque[:, 1:]
    bord = voisin & ~opaque
    sortie[bord, :3] = rvb(PALETTE["contour"]).astype(np.uint8)
    sortie[bord, 3] = 255

    # on recoupe le cadre du jeu, et on dit ce qui déborde
    W, H = meta["largeur"], meta["hauteur"]
    cadre = sortie[M:M + H, M:M + W]
    deborde = int((sortie[:, :, 3] == 255).sum() - (cadre[:, :, 3] == 255).sum())
    Image.fromarray(cadre).save(os.path.join(ASSETS, f"{cle}.png"))
    # l'image entiere, marge comprise, pour voir ce qui deborde
    os.makedirs(os.path.join(TMP, "entier"), exist_ok=True)
    Image.fromarray(sortie).save(os.path.join(TMP, "entier", f"{cle}.png"))
    alerte = f"  ATTENTION {deborde} px hors du cadre" if deborde else ""
    print(f"[reduire] {cle} {W}x{H}{alerte}")
    return deborde


if __name__ == "__main__":
    prefixes = sys.argv[1:]
    os.makedirs(ASSETS, exist_ok=True)
    total = 0
    for meta in sorted(glob.glob(os.path.join(TMP, "*.json"))):
        cle = os.path.basename(meta)[:-5]
        if prefixes and not any(cle.startswith(p) for p in prefixes):
            continue
        total += reduire(cle)
    sys.exit(1 if total else 0)
