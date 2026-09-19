"""Rend les sprites low-poly du monde, en deux passes, pour `reduire.py`.

    blender -b -P scripts/blender/rendre.py                 -> tous les sprites
    blender -b -P scripts/blender/rendre.py -- bati-maison-0 -> un seul (préfixe accepté)

Pour chaque clé de texture, deux images en x8 dans `.tmp/blender/` :
  <cle>_id.png       chaque pièce peinte d'une couleur-code, celle de sa matière ;
  <cle>_lumiere.png  la même scène toute blanche : ce que la lumière y fait ;
et <cle>.json : la taille de la texture du jeu, et où tombe son pied.
Le plus simple est de passer par `npx tsx scripts/blender/tout.ts`.
"""
import json
import math
import os
import sys

import bpy
from mathutils import Vector

ICI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, ICI)
import monde  # noqa: E402

RACINE = os.path.normpath(os.path.join(ICI, "..", ".."))
TMP = os.path.join(RACINE, ".tmp", "blender")
os.makedirs(TMP, exist_ok=True)

SUR = 8      # suréchantillonnage : 8 x 8 pixels rendus par pixel du jeu
MARGE = 12   # px du jeu autour du cadre, pour voir ce qui déborde

with open(os.path.join(ICI, "palette.json"), encoding="utf-8") as f:
    PALETTE = json.load(f)
# La couleur-code d'une matière : son rang dans la palette, écrit dans le rouge.
MATIERES = list(PALETTE["matieres"].keys()) + ["sol"]
CODE = {nom: (20 + 12 * i, 40, 200) for i, nom in enumerate(MATIERES)}


def agrandi(fabrique, facteur):
    def f(a):
        pied = fabrique(a)
        monde.agrandir(a, facteur)
        return (pied[0] * facteur, pied[1] * facteur)
    return f


# La texture du jeu (largeur, hauteur), la ligne du pied, et la colonne du pied
# (au milieu si rien n'est dit).
# ⚠️ Ces tailles sont aussi dans `batiments.ts` (MAISON, FERME, EGLISE) et
# `decor.ts` (ARBRE, ROCHER, SOUCHE) : un test compare les PNG à ces constantes.
# Le pied d'un décor est celui de `decor.ts` plus un. Tout grandit par rapport
# au dessin au code, parce que le biais montre un flanc et que l'ombre portée
# déborde à droite.
def sprites():
    s = {}
    for v in range(3):
        s[f"bati-maison-{v}"] = (lambda a, v=v: monde.maison(a, v), 56, 50, 48, 24)
    s["bati-ferme"] = (lambda a: monde.maison(a, 1, annexe=True), 70, 50, 48, 28)
    s["bati-maison-ruine"] = (lambda a: monde.maison_ruine(a, 0), 56, 50, 48, 24)
    for n in range(1, 5):
        s[f"bati-eglise-{n}"] = (lambda a, n=n: monde.eglise(a, n), 72, 64, 60)
    for i in range(4):
        s[f"decor-arbre-mort-{i}"] = (agrandi(lambda a, i=i: monde.arbre_mort(a, i), 1.2), 40, 46, 41)
    for i in range(3):
        s[f"decor-arbre-{i}"] = (agrandi(lambda a, i=i: monde.chene(a, i + 1), 1.35), 40, 46, 41)
    for i in range(2):
        s[f"decor-conifere-{i}"] = (agrandi(lambda a, i=i: monde.conifere(a, i), 1.3), 40, 46, 41)
    for i in range(3):
        s[f"decor-rocher-{i}"] = (lambda a, i=i: monde.rocher(a, i), 28, 20, 17)
    s["decor-souche"] = (lambda a: monde.souche(a), 14, 14, 11)
    # Les details de vie (§4.24) : tailles dans `decor.ts` (PUITS, TONNEAU, TAS_DE_BOIS, CHARRETTE).
    s["decor-puits"] = (lambda a: monde.puits(a), 26, 30, 27)
    s["decor-tonneau"] = (lambda a: monde.tonneau(a), 14, 16, 14)
    s["decor-tas-de-bois"] = (lambda a: monde.tas_de_bois(a), 26, 18, 16)
    s["decor-charrette"] = (lambda a: monde.charrette(a), 36, 22, 20, 20)
    s["decor-corde-a-linge"] = (lambda a: monde.corde_a_linge(a), 40, 20, 17)
    s["decor-filets"] = (lambda a: monde.filets(a), 36, 24, 21)
    return s


def lin(c):
    c /= 255
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def peindre_code(m, nom):
    """Émission pure de la couleur-code : aucun éclairage ne la touche."""
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    em = nt.nodes.new("ShaderNodeEmission")
    r, v, b = CODE[nom]
    em.inputs["Color"].default_value = (lin(r), lin(v), lin(b), 1)
    em.inputs["Strength"].default_value = 1.0
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    nt.links.new(em.outputs["Emission"], out.inputs["Surface"])


def blanc():
    m = bpy.data.materials.new("Blanc")
    m.use_nodes = True
    p = m.node_tree.nodes.get("Principled BSDF")
    p.inputs["Base Color"].default_value = (0.8, 0.8, 0.8, 1)
    p.inputs["Roughness"].default_value = 1.0
    return m


def rendre(cle, fabrique, W, H, pied, ancre):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    a = monde.Atelier()
    px, py = fabrique(a)
    a.racine(cle, y_devant=py)

    sol = monde.Atelier()
    sol._mats = a._mats
    sol.boite("sol", (40, 40, 0.02), (px, py, -0.011))

    # le soleil : de l'ouest, un peu du sud, haut — le clair à gauche et le
    # sombre à droite, comme tout ce que dessine `pinceau.ts`
    vers_lumiere = Vector((-0.62, -0.38, 1.6)).normalized()
    sd = bpy.data.lights.new("Soleil", "SUN")
    sd.energy = 3.2
    sd.angle = math.radians(1.5)
    so = bpy.data.objects.new("Soleil", sd)
    scene.collection.objects.link(so)
    so.rotation_mode = "QUATERNION"
    so.rotation_quaternion = (-vers_lumiere).to_track_quat("-Z", "Y")
    w = bpy.data.worlds.new("Monde")
    scene.world = w
    w.use_nodes = True
    w.node_tree.nodes["Background"].inputs["Color"].default_value = (0.3, 0.3, 0.3, 1)

    # la caméra du jeu, placée pour que le pied tombe à sa ligne dans l'image
    Wr, Hr = W + 2 * MARGE, H + 2 * MARGE
    cd = bpy.data.cameras.new("Camera")
    cd.type = "ORTHO"
    cd.sensor_fit = "HORIZONTAL"
    cd.ortho_scale = Wr / monde.PX_PAR_UNITE
    cd.clip_end = 200
    cam = bpy.data.objects.new("Camera", cd)
    scene.collection.objects.link(cam)
    pied_r = pied + MARGE
    vise, haut = monde.axes_camera()
    v = (Hr / 2 - pied_r) / monde.PX_PAR_UNITE
    u = (Wr / 2 - (ancre + MARGE)) / monde.PX_PAR_UNITE
    cam.location = Vector((px + u, py, 0)) - v * haut - 60 * vise
    cam.rotation_euler = (monde.INCLINAISON, 0, 0)
    scene.camera = cam

    for moteur in ("BLENDER_EEVEE", "BLENDER_EEVEE_NEXT"):
        try:
            scene.render.engine = moteur
            break
        except TypeError:
            continue
    r = scene.render
    r.resolution_x, r.resolution_y = Wr * SUR, Hr * SUR
    r.film_transparent = True
    r.filter_size = 0.0
    r.dither_intensity = 0.0
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "None"

    # passe 1 : la matière de chaque pixel
    for nom, m in a._mats.items():
        peindre_code(m, nom)
    r.filepath = os.path.join(TMP, f"{cle}_id.png")
    bpy.ops.render.render(write_still=True)

    # passe 2 : la lumière, sur une scène toute blanche
    bpy.context.view_layer.material_override = blanc()
    r.filepath = os.path.join(TMP, f"{cle}_lumiere.png")
    bpy.ops.render.render(write_still=True)

    with open(os.path.join(TMP, f"{cle}.json"), "w", encoding="utf-8") as f:
        json.dump({"cle": cle, "largeur": W, "hauteur": H, "pied": pied, "ancre": ancre,
                   "marge": MARGE,
                   "sur": SUR, "codes": CODE}, f)
    print(f"[rendre] {cle}")


if __name__ == "__main__":
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    for cle, (fab, W, H, pied, *reste) in sprites().items():
        if argv and not any(cle.startswith(p) for p in argv):
            continue
        rendre(cle, fab, W, H, pied, reste[0] if reste else W / 2)
