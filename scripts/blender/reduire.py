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

⚠️ **Le monde, lui, parle le langage du sol** (chantier 6.45, 11 novembre 2026, §4.30).
Depuis que la carte a du grain et des tons fondus, un bâtiment ou un arbre en aplats
cernés de fer faisait autocollant dessus. Tout ce qui est **posé sur le sol** (`bati-`,
`decor-`) passe donc par `reduire_au_grain` : la marche de lumière y est continue et
tramée, chaque matière a son grain, et ce qui pousse ou traîne par terre (arbres,
rochers, souches) prend pour contour le **ton de fond de sa matière** au lieu du fer.
Les personnages, les flammes et la fumée gardent `reduire_tableaux` : ils doivent se
détacher du sol, pas s'y fondre.
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


def reduire_tableaux(ids, lum, meta):
    """Le coeur de la reduction : deux rendus (matieres, lumiere) -> les pixels du jeu, marge comprise."""
    S = meta["sur"]
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

    # le contour : tout pixel non opaque qui touche la silhouette (4 voisins).
    # ⚠️ La fumée le refuse (`contour: false` dans le meta) : elle n'a pas de
    # bord, et un trait de fer autour en ferait un objet.
    if not meta.get("contour", True):
        return sortie
    voisin = np.zeros_like(opaque)
    voisin[1:, :] |= opaque[:-1, :]
    voisin[:-1, :] |= opaque[1:, :]
    voisin[:, 1:] |= opaque[:, :-1]
    voisin[:, :-1] |= opaque[:, 1:]
    bord = voisin & ~opaque
    sortie[bord, :3] = rvb(PALETTE["contour"]).astype(np.uint8)
    sortie[bord, 3] = 255
    return sortie


# ------------------------------------------------- le langage du sol (6.45)
# Le grain de chaque matière : (bruit fin, bruit moyen, échelle en x, échelle en y), en
# tons. Le feuillage se tache par touffes, le bois et l'écorce en fil (un bruit étiré vers
# le bas), la pierre et la roche piquées, l'ardoise en rangs. ⚠️ Mesuré sur planche : à
# 1,15 de bruit moyen, le feuillage noyait son volume — les étages d'un sapin se
# fondaient en un cône lisse.
GRAINS = {
    "feuille": (0.45, 0.8, 2.6, 2.2), "ecorce": (0.35, 0.7, 1.3, 5.0), "bois": (0.3, 0.55, 1.4, 6.0),
    "roche": (0.5, 0.7, 3.0, 2.4), "pierre": (0.4, 0.5, 3.0, 2.2), "ardoise": (0.3, 0.45, 4.0, 1.6),
    "toit_eglise": (0.3, 0.45, 4.0, 1.6), "toile": (0.25, 0.4, 3.0, 3.0),
}
GRAIN_PAR_DEFAUT = (0.3, 0.4, 3.0, 3.0)
# Ce qui pousse ou traîne par terre : son contour est le ton de fond de sa matière.
NATURE = ("decor-arbre", "decor-conifere", "decor-rocher", "decor-souche")
# Les centres des cinq marches de `MARCHES` : entre deux, la marche est continue.
CENTRES = [0.33, 0.565, 0.80, 1.02, 1.22]


def parle_le_langage_du_sol(cle):
    """Ce qui est posé sur le sol : les bâtiments et le décor. Ni les feux, ni les personnages."""
    return cle.startswith(("bati-", "decor-"))


def fond(nom):
    """Le ton de fond d'une matière : son sombre, tiré vers le fer."""
    s = rvb(PALETTE["matieres"][nom]["sombre"])
    return melanger(s, rvb(PALETTE["contour"]), 0.4)


def bruit_lisse(h, w, ex, ey, graine):
    """Un bruit de 0 à 1 sur une grille de (ex, ey) pixels, lu entre ses points. Fixe : une graine, une image."""
    rng = np.random.default_rng(graine)
    t = rng.random((int(h / ey) + 3, int(w / ex) + 3))
    yy, xx = np.mgrid[0:h, 0:w]
    fy, fx = yy / ey, xx / ex
    j, i = np.floor(fy).astype(int), np.floor(fx).astype(int)
    ty, tx = fy - j, fx - i
    ty, tx = ty * ty * (3 - 2 * ty), tx * tx * (3 - 2 * tx)
    haut = t[j, i] + (t[j, i + 1] - t[j, i]) * tx
    bas = t[j + 1, i] + (t[j + 1, i + 1] - t[j + 1, i]) * tx
    return haut + (bas - haut) * ty


def reduire_au_grain(ids, lum, meta, cle):
    """La même réduction, dans le langage du sol : une lumière continue et tramée, un grain
    par matière, et pour ce qui pousse un contour au ton de sa matière. Marge comprise."""
    S = meta["sur"]
    h, w = ids.shape[0] // S, ids.shape[1] // S
    noms = list(meta["codes"].keys())
    codes = np.array([meta["codes"][n] for n in noms], dtype=np.int32)
    d = np.abs(ids[:, :, None, :3] - codes[None, None, :, :]).sum(axis=3)
    rang = d.argmin(axis=2)
    rang[(d.min(axis=2) > 18) | (ids[:, :, 3] < 250)] = -1
    clarte = lum[:, :, :3].mean(axis=2) / (0.8 * 255)

    # par pixel du jeu : la matière qui domine le bloc, et sa lumière moyenne
    i_sol = noms.index("sol")
    blocs = rang[:h * S, :w * S].reshape(h, S, w, S).transpose(0, 2, 1, 3).reshape(h, w, S * S)
    lums = clarte[:h * S, :w * S].reshape(h, S, w, S).transpose(0, 2, 1, 3).reshape(h, w, S * S)
    compte = np.stack([(blocs == k).sum(axis=2) for k in range(len(noms))], axis=2)
    objet = compte.copy()
    objet[:, :, i_sol] = 0
    est_objet = (objet.max(axis=2) >= COUVERTURE * S * S * 0.5) & (objet.max(axis=2) >= compte[:, :, i_sol] * 0.6)
    k = np.where(est_objet, objet.argmax(axis=2), i_sol)
    masque = blocs == k[:, :, None]
    c = (lums * masque).sum(axis=2) / np.maximum(masque.sum(axis=2), 1)
    vide = masque.sum(axis=2) == 0
    opaque = est_objet & ~vide

    marche = np.interp(c, CENTRES, [0, 1, 2, 3, 4])
    yy, xx = np.mgrid[0:h, 0:w]
    pixel = np.random.default_rng(7).random((h, w))  # le grain d'un pixel : fixe, pour ne pas réécrire un PNG à chaque passe
    sortie = np.zeros((h, w, 4), dtype=np.uint8)
    for i, nom in enumerate(noms):
        ici = opaque & (k == i)
        if not ici.any() or nom not in PALETTE["matieres"]:
            continue
        fin, moyen, ex, ey = GRAINS.get(nom, GRAIN_PAR_DEFAUT)
        trame = (pixel - 0.5) * fin + (bruit_lisse(h, w, ex, ey, 11 + i) - 0.5) * 2 * moyen
        t = np.clip(np.round(marche + DECALAGE.get(nom, 0) + trame), 0, 4).astype(int)
        cinq = np.array(tons(nom))
        sortie[ici, :3] = cinq[t[ici]].astype(np.uint8)
        sortie[ici, 3] = 255

    # l'ombre portée : le sol là où il est à l'ombre
    ombre = (k == i_sol) & ~vide & ~opaque & (compte[:, :, i_sol] >= COUVERTURE * S * S) & (c < OMBRE_SOL)
    sortie[ombre, :3] = rvb(PALETTE["ombre"]).astype(np.uint8)
    sortie[ombre, 3] = int(255 * ALPHA_OMBRE)

    if not meta.get("contour", True):
        return sortie
    # le contour : du fer pour ce qui est bâti, le ton de fond de la matière voisine pour ce qui pousse
    voisin = np.zeros_like(opaque)
    teinte = np.zeros((h, w, 3))
    poids = np.zeros((h, w))
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        o = np.roll(opaque, (dy, dx), axis=(0, 1))
        voisin |= o
        km = np.roll(k, (dy, dx), axis=(0, 1))
        for i, nom in enumerate(noms):
            if nom in PALETTE["matieres"]:
                m = o & (km == i)
                teinte[m] += fond(nom)
                poids[m] += 1
    bord = voisin & ~opaque
    if cle.startswith(NATURE):
        sortie[bord, :3] = np.round(teinte[bord] / np.maximum(poids[bord], 1)[:, None]).astype(np.uint8)
    else:
        sortie[bord, :3] = rvb(PALETTE["contour"]).astype(np.uint8)
    sortie[bord, 3] = 255
    return sortie


def reduire(cle):
    with open(os.path.join(TMP, f"{cle}.json"), encoding="utf-8") as f:
        meta = json.load(f)
    M = meta["marge"]
    ids = np.asarray(Image.open(os.path.join(TMP, f"{cle}_id.png")).convert("RGBA"), dtype=np.int32)
    lum = np.asarray(Image.open(os.path.join(TMP, f"{cle}_lumiere.png")).convert("RGBA"),
                     dtype=np.float64)
    if parle_le_langage_du_sol(cle):
        sortie = reduire_au_grain(ids, lum, meta, cle)
    else:
        sortie = reduire_tableaux(ids, lum, meta)

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
