"""Les objets low-poly du **premier jet** de la cinématique (18 septembre 2026).

Copie telle quelle de `Projet/render/jeux/lowpoly.py`, la bibliothèque avec laquelle
`intro-premier-jet.mp4` a été rendu. Elle vit ici parce que la cinématique du jeu
(`intro.py`) reprend ce jet **exactement** — mêmes maisons, même église, mêmes arbres,
mêmes flammes — et qu'un script du dépôt ne doit pas dépendre d'un fichier posé ailleurs
sur la machine.

⚠️ Ce n'est pas `monde.py` : les sprites du jeu ont leurs propres fabriques et leur
propre palette. Les deux bibliothèques ne se mélangent pas.

Unité : 1 unité Blender = 10,5 px du jeu (une maison de 4 unités fait 42 px). Le sol est
le plan z = 0, la façade regarde vers -Y (vers la caméra).
"""
import bpy
import bmesh
import math
import random
from mathutils import Matrix, Vector

PX_PAR_UNITE = 10.5
_MATS = {}


def vider():
    _MATS.clear()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    return bpy.context.scene


def hexa(h):
    """Couleur hexa sRGB -> linéaire, pour que le rendu retombe sur la même teinte."""
    def lin(c):
        c /= 255
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    return (lin((h >> 16) & 255), lin((h >> 8) & 255), lin(h & 255), 1.0)


def mat(nom, h, emission=0.0):
    if nom in _MATS:
        return _MATS[nom]
    m = bpy.data.materials.new(nom)
    try:
        m.use_nodes = True
    except Exception:
        pass
    p = m.node_tree.nodes.get("Principled BSDF")
    p.inputs["Base Color"].default_value = hexa(h)
    p.inputs["Roughness"].default_value = 1.0
    if emission:
        p.inputs["Emission Color"].default_value = hexa(h)
        p.inputs["Emission Strength"].default_value = emission
    _MATS[nom] = m
    return m


# Teintes relevées sur les sprites actuels du jeu (captures/planche-*.png)
def M():
    return {
        "torchis": mat("Torchis", 0xC8B99B),
        "bois": mat("Colombage", 0x4A3B2C),
        "ardoise": mat("Ardoise", 0x3B4049),
        "porte": mat("Porte", 0x2E2A26),
        "vitre": mat("Fenetre", 0x2A2D33),
        "pierre": mat("Pierre", 0x77746F),
        "pierre_sombre": mat("Pierre sombre", 0x5A5854),
        "tuile": mat("Tuile rouge", 0x8E2E2A),
        "or": mat("Croix", 0xC9A45A),
        "ecorce": mat("Ecorce", 0x4A3A2C),
        "feuille": mat("Feuillage", 0x5E7A3A),
        "sapin": mat("Sapin", 0x3E5530),
        "roche": mat("Roche", 0x7C7A76),
    }


def _lier(o, collection=None):
    (collection or bpy.context.scene.collection).objects.link(o)
    return o


def boite(nom, taille, pos, m, rot=(0, 0, 0)):
    me = bpy.data.meshes.new(nom)
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(nom, me)
    _lier(o)
    o.location = pos
    o.scale = taille
    o.rotation_euler = rot
    me.materials.append(m)
    return o


def maillage(nom, verts, faces, m):
    me = bpy.data.meshes.new(nom)
    me.from_pydata(verts, [], faces)
    me.update()
    o = bpy.data.objects.new(nom, me)
    _lier(o)
    me.materials.append(m)
    return o


def cone(nom, r, h, pos, m, cotes=6, r_haut=0.0):
    me = bpy.data.meshes.new(nom)
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=cotes, radius1=r, radius2=r_haut,
                          depth=h)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(nom, me)
    _lier(o)
    o.location = (pos[0], pos[1], pos[2] + h / 2)
    me.materials.append(m)
    return o


def boule(nom, r, pos, m, graine=0, bosses=0.18, subdiv=1):
    me = bpy.data.meshes.new(nom)
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=subdiv, radius=r)
    rnd = random.Random(graine)
    for v in bm.verts:
        v.co *= 1 + rnd.uniform(-bosses, bosses)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(nom, me)
    _lier(o)
    o.location = pos
    me.materials.append(m)
    return o


def toit_deux_pans(nom, L, P, h_murs, faite, m, deb=0.25, ep=0.12):
    v = [(-L/2-deb, -P/2-deb, h_murs), (L/2+deb, -P/2-deb, h_murs),
         (L/2+deb, P/2+deb, h_murs), (-L/2-deb, P/2+deb, h_murs),
         (-L/2-deb, 0, h_murs+faite), (L/2+deb, 0, h_murs+faite)]
    o = maillage(nom, v, [(0, 1, 5, 4), (2, 3, 4, 5), (0, 4, 3), (1, 2, 5)], m)
    s = o.modifiers.new("Epaisseur", "SOLIDIFY")
    s.thickness = ep
    return o


def pignons(nom, L, P, h_murs, faite, m):
    vp = [(-L/2, -P/2, h_murs), (-L/2, P/2, h_murs), (-L/2, 0, h_murs+faite-0.05),
          (L/2, -P/2, h_murs), (L/2, P/2, h_murs), (L/2, 0, h_murs+faite-0.05)]
    return maillage(nom, vp, [(0, 1, 2), (3, 5, 4)], m)


def grouper(objets, nom, pos=(0, 0, 0), rot_z=0.0, echelle=1.0):
    """Range des objets sous un vide, pour les déplacer d'un bloc."""
    vide = bpy.data.objects.new(nom, None)
    _lier(vide)
    for o in objets:
        o.parent = vide
    vide.location = pos
    vide.rotation_euler = (0, 0, rot_z)
    vide.scale = (echelle,) * 3
    return vide


# ------------------------------------------------------------------- objets
def maison(m, variante=0):
    L, P, H = 4.0, 3.0, 2.0
    obs = [boite("Murs", (L, P, H), (0, 0, H/2), m["torchis"]),
           toit_deux_pans("Toit", L, P, H, 1.5, m["ardoise"]),
           pignons("Pignons", L, P, H, 1.5, m["torchis"])]
    yF, E = -P/2 - 0.03, 0.14
    for x in (-L/2 + E/2, -0.35, L/2 - E/2):
        obs.append(boite("Poteau", (E, 0.06, H), (x, yF, H/2), m["bois"]))
    obs.append(boite("Sabliere", (L, 0.06, E), (0, yF, H - E/2), m["bois"]))
    obs.append(boite("Lisse", (L, 0.06, E), (0, yF, E/2), m["bois"]))
    a = math.atan2(H - 0.3, 1.6)
    for s in (1, -1):
        obs.append(boite("Croix", (math.hypot(1.6, H-0.3), 0.06, E), (0.85, yF, H/2),
                         m["bois"], rot=(0, s * a, 0)))
    # colombage aussi sur le pignon droit, visible en biais
    xD = L/2 + 0.03
    obs.append(boite("PoteauD", (0.06, E, H), (xD, 0, H/2), m["bois"]))
    porte_x = -1.2 if variante % 2 == 0 else 1.2
    obs.append(boite("Porte", (0.7, 0.08, 1.2), (porte_x, yF - 0.01, 0.6), m["porte"]))
    obs.append(boite("Fenetre", (0.5, 0.08, 0.45), (-porte_x, yF - 0.02, 1.4), m["vitre"]))
    obs.append(boite("FenetreD", (0.08, 0.5, 0.45), (xD + 0.01, -0.8, 1.3), m["vitre"]))
    obs.append(boite("Cheminee", (0.45, 0.45, 1.3), (1.1 * (1 if variante < 2 else -1),
                                                      0.5, H + 1.2), m["pierre"]))
    return obs


def eglise(m):
    L, P, H = 5.0, 3.2, 2.6
    obs = [boite("Nef", (L, P, H), (0.6, 0, H/2), m["pierre"]),
           toit_deux_pans("ToitNef", L, P, H, 1.6, m["tuile"]),
           pignons("PignonsNef", L, P, H, 1.6, m["pierre"])]
    for o in obs[1:]:
        o.location.x = 0.6
    # clocher à gauche, devant
    c, hc = 1.5, 5.4
    xc = -L/2 + 0.6 - c/2 + 0.1
    obs.append(boite("Clocher", (c, c, hc), (xc, -P/2 + c/2, hc/2), m["pierre"]))
    fl = cone("Fleche", c * 0.78, 1.6, (xc, -P/2 + c/2, hc), m["tuile"], cotes=4)
    fl.rotation_euler = (0, 0, math.pi / 4)
    obs.append(fl)
    obs.append(boite("CroixV", (0.08, 0.08, 0.6), (xc, -P/2 + c/2, hc + 1.9), m["or"]))
    obs.append(boite("CroixH", (0.35, 0.08, 0.08), (xc, -P/2 + c/2, hc + 2.0), m["or"]))
    yF = -P/2 - 0.03
    obs.append(boite("Abat-son", (0.5, 0.08, 0.7), (xc, -P/2 - 0.04, hc - 1.1), m["porte"]))
    obs.append(boite("Portail", (0.8, 0.08, 1.3), (xc, -P/2 - 0.04, 0.65), m["porte"]))
    for x in (0.2, 1.6, 2.8):
        obs.append(boite("Vitrail", (0.4, 0.08, 0.9), (x, yF, 1.5), m["vitre"]))
    for x in (0.9, 2.2):
        obs.append(boite("Contrefort", (0.25, 0.3, 1.4), (x, yF - 0.12, 0.7),
                         m["pierre"]))
    return obs


def chene(m, graine=1):
    obs = [cone("Tronc", 0.28, 1.4, (0, 0, 0), m["ecorce"], cotes=5, r_haut=0.18)]
    rnd = random.Random(graine)
    for i in range(3):
        obs.append(boule("Feuillage", rnd.uniform(0.85, 1.1),
                         (rnd.uniform(-0.5, 0.5), rnd.uniform(-0.3, 0.3),
                          1.9 + rnd.uniform(-0.1, 0.5)), m["feuille"], graine=graine + i))
    return obs


def sapin(m):
    obs = [cone("Tronc", 0.18, 0.7, (0, 0, 0), m["ecorce"], cotes=5)]
    for i, (r, h) in enumerate(((1.0, 1.5), (0.8, 1.3), (0.55, 1.1))):
        obs.append(cone("Etage", r, h, (0, 0, 0.5 + i * 0.8), m["sapin"], cotes=7))
    return obs


def rocher(m, graine=3):
    o = boule("Rocher", 0.8, (0, 0, 0.35), m["roche"], graine=graine, bosses=0.25)
    o.scale = (1.2, 0.9, 0.7)
    return [o]


def mur_pierre(m, cases=3):
    """Un pan de mur de `cases` carreaux (1 carreau = 32 px = 3,05 unités) avec créneaux."""
    C = 32 / PX_PAR_UNITE
    L, E, H = C * cases, 1.1, 1.8
    obs = [boite("Mur", (L, E, H), (0, 0, H/2), m["pierre"])]
    n = cases * 2
    for i in range(n):
        x = -L/2 + (i + 0.5) * L / n
        obs.append(boite("Merlon", (L/n * 0.55, E, 0.45), (x, 0, H + 0.22), m["pierre"]))
    # rangées de pierres, pour la texture
    for k in range(1, 4):
        obs.append(boite("Joint", (L, 0.04, 0.05), (0, -E/2 - 0.01, H * k / 4),
                         m["pierre_sombre"]))
    # tour d'angle à droite
    t = 1.6
    obs.append(boite("Tour", (t, t, H + 0.8), (L/2, 0, (H + 0.8)/2), m["pierre"]))
    obs.append(boite("TourHaut", (t + 0.2, t + 0.2, 0.3), (L/2, 0, H + 0.95),
                     m["pierre_sombre"]))
    return obs


FABRIQUES = {
    "maison": lambda m: maison(m),
    "eglise": eglise,
    "chene": chene,
    "sapin": sapin,
    "rocher": rocher,
    "mur": mur_pierre,
}


# ------------------------------------------------------------------ la vue
def biais(objets, k):
    """Projection oblique : ce qui est au fond glisse vers la droite de k par unité.

    Le bâtiment reste aligné sur la grille (sa façade reste horizontale à l'écran),
    mais on voit son flanc droit. Pas de rotation, donc pas de maison en diagonale.
    """
    cisaille = Matrix(((1, k, 0, 0), (0, 1, 0, 0), (0, 0, 1, 0), (0, 0, 0, 1)))
    racine = bpy.data.objects.new("Biais", None)
    _lier(racine)
    for o in objets:
        if o.parent is None:
            o.parent = racine
            o.matrix_parent_inverse = cisaille
    return racine


def camera_jeu(scene, ortho, incl_deg=55, cible=(0, 0, 1.2)):
    incl = math.radians(incl_deg)
    D = 40
    cam_data = bpy.data.cameras.new("Camera")
    cam = bpy.data.objects.new("Camera", cam_data)
    _lier(cam)
    cam.location = (cible[0], cible[1] - D * math.sin(incl), cible[2] + D * math.cos(incl))
    cam.rotation_euler = (incl, 0, 0)
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = ortho
    cam_data.clip_end = 200
    scene.camera = cam
    return cam


def soleil(energie=5.0, rot=(35, -55, -20)):
    d = bpy.data.lights.new("Soleil", "SUN")
    d.energy = energie
    d.angle = math.radians(2)
    o = bpy.data.objects.new("Soleil", d)
    _lier(o)
    o.rotation_euler = tuple(math.radians(a) for a in rot)
    return o


def ciel(scene, couleur=(0.35, 0.36, 0.38), force=0.8):
    w = bpy.data.worlds.new("Monde")
    scene.world = w
    try:
        w.use_nodes = True
    except Exception:
        pass
    bg = w.node_tree.nodes["Background"]
    bg.inputs["Color"].default_value = (*couleur, 1)
    bg.inputs["Strength"].default_value = force
    return w


def eevee(scene):
    for moteur in ("BLENDER_EEVEE", "BLENDER_EEVEE_NEXT"):
        try:
            scene.render.engine = moteur
            return
        except TypeError:
            continue
