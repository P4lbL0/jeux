"""La cinématique d'ouverture : le village qui brûle, en low-poly (DESIGN.md §4.10).

    blender -b -P scripts/blender/intro.py -- --still 60
        une seule image, dans .tmp/intro/still-060.png
    blender -b -P scripts/blender/intro.py -- --anim
        les 240 images, dans .tmp/intro/frames/f_0001.png ...
    options : --frames 1-144   --samples 16   --res 960x540   --sans-brume

Le plus simple est de passer par `npm run intro`, qui rend puis encode (`intro.ts`).

**Une seule séquence, deux morceaux**, que `intro.ts` découpe ensuite :
  images   1 à 144 : l'approche, 6 s — la caméra remonte le chemin vers l'église ;
  images 145 à 240 : la boucle, 4 s — la caméra s'est arrêtée, et tout ce qui bouge
                     encore (flammes, braises, fumée, monstres, balancement) a une
                     période qui divise 4 s. L'image 241 serait l'image 145 : le jeu
                     peut boucler sans couture derrière le menu.

Les objets du village sont ceux de `monde.py` (les mêmes maisons, la même église que
les sprites du jeu), et chaque matière prend la couleur de la palette du jeu
(`palette.json`). Ici on garde la lumière de Blender telle quelle : c'est une vidéo,
pas un sprite à repeindre.

⚠️ Toute l'animation est **une fonction de l'image** (`animer`), branchée sur le
changement d'image : pas de clé posée à la main, donc rien qui puisse dériver entre
l'approche et la boucle.
"""
import argparse
import json
import math
import os
import random
import sys

import bmesh
import bpy
from mathutils import Vector, noise as bruit

ICI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, ICI)
import monde  # noqa: E402

RACINE = os.path.normpath(os.path.join(ICI, "..", ".."))
TMP = os.path.join(RACINE, ".tmp", "intro")

FPS = 24
APPROCHE = 144            # images d'approche : 6 s
BOUCLE = 96               # images de boucle : 4 s
TOTAL = APPROCHE + BOUCLE
T = BOUCLE / FPS          # la période de tout ce qui boucle, en secondes
DUREE_APPROCHE = APPROCHE / FPS

with open(os.path.join(ICI, "palette.json"), encoding="utf-8") as f:
    PALETTE = json.load(f)

TAU = 2 * math.pi
NB_FUMEES = 0


# ------------------------------------------------------------ petits outils
def lin(c):
    """Un canal sRGB 0-255 vers le linéaire de Blender."""
    c /= 255
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def couleur(n, mult=1.0):
    return (lin((n >> 16) & 255) * mult, lin((n >> 8) & 255) * mult, lin(n & 255) * mult, 1.0)


def corps(nom):
    return PALETTE["matieres"][nom]["corps"]


def melanger(a, b, part):
    ca = ((a >> 16) & 255, (a >> 8) & 255, a & 255)
    cb = ((b >> 16) & 255, (b >> 8) & 255, b & 255)
    r = [round(x + (y - x) * part) for x, y in zip(ca, cb)]
    return (r[0] << 16) | (r[1] << 8) | r[2]


def lisser(a, b, x):
    """smoothstep : 0 avant a, 1 après b (a peut être plus grand que b)."""
    if a == b:
        return 1.0 if x >= b else 0.0
    u = max(0.0, min(1.0, (x - a) / (b - a)))
    return u * u * (3 - 2 * u)


def onde(t, k, phi=0.0):
    """Une sinusoïde de période T/k : elle boucle toujours sur la boucle."""
    return math.sin(TAU * k * t / T + phi)


def cycle(t, k=1, phi=0.0):
    """La phase 0-1 d'un cycle de période T/k."""
    return (k * t / T + phi) % 1.0


def lier(scene, o):
    scene.collection.objects.link(o)
    return o


# --------------------------------------------------------------- matériaux
MATS = {}


def mat_simple(nom, rgba, rugosite=0.9, emission=None, force=0.0, alpha=1.0):
    if nom in MATS:
        return MATS[nom]
    m = bpy.data.materials.new(nom)
    m.use_nodes = True
    p = m.node_tree.nodes["Principled BSDF"]
    p.inputs["Base Color"].default_value = rgba
    p.inputs["Roughness"].default_value = rugosite
    p.inputs["Specular IOR Level"].default_value = 0.2
    if emission is not None:
        p.inputs["Emission Color"].default_value = emission
        p.inputs["Emission Strength"].default_value = force
    if alpha < 1.0:
        p.inputs["Alpha"].default_value = alpha
        m.surface_render_method = "DITHERED"
    MATS[nom] = m
    return m


def mat_emission(nom, rgb, force):
    if nom in MATS:
        return MATS[nom]
    m = bpy.data.materials.new(nom)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    em = nt.nodes.new("ShaderNodeEmission")
    em.inputs["Color"].default_value = (*rgb, 1.0)
    em.inputs["Strength"].default_value = force
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    nt.links.new(em.outputs["Emission"], out.inputs["Surface"])
    MATS[nom] = m
    return m


def habiller(a):
    """Donne aux matières de `monde.py` la couleur de la palette du jeu."""
    for nom, m in a._mats.items():
        m.use_nodes = True
        p = m.node_tree.nodes.get("Principled BSDF")
        if p is None:
            continue
        if nom == "trou":
            p.inputs["Base Color"].default_value = (0.004, 0.003, 0.003, 1)
        else:
            p.inputs["Base Color"].default_value = couleur(corps(nom))
        p.inputs["Roughness"].default_value = 0.92
        p.inputs["Specular IOR Level"].default_value = 0.15


# Les valeurs animées des flammes : posées ici, lues par `animer`.
VALEURS_FLAMME = {}


def mat_flamme():
    """Des langues qui montent : deux bruits qui défilent, fondus l'un dans l'autre.

    Le bruit A défile de 0 à V·T puis saute à 0 ; il ne pèse rien à cet instant
    (sin² = 0). Le bruit B fait la même chose décalé d'une demi-période, pesé par
    cos². La somme est continue et **périodique sur T** : c'est ce qui rend la
    boucle possible avec un feu qui monte vraiment, et pas seulement qui grouille.
    """
    if "flamme" in MATS:
        return MATS["flamme"]
    m = bpy.data.materials.new("flamme")
    m.use_nodes = True
    m.surface_render_method = "DITHERED"
    nt = m.node_tree
    nt.nodes.clear()
    N = nt.nodes.new
    L = nt.links.new

    coord = N("ShaderNodeTexCoord")
    info = N("ShaderNodeObjectInfo")
    sep = N("ShaderNodeSeparateXYZ")
    L(coord.outputs["Generated"], sep.inputs["Vector"])

    echelle = N("ShaderNodeVectorMath")
    echelle.operation = "MULTIPLY"
    echelle.inputs[1].default_value = (3.2, 3.2, 1.4)
    L(coord.outputs["Generated"], echelle.inputs[0])

    graine = N("ShaderNodeMath")
    graine.operation = "MULTIPLY"
    graine.inputs[1].default_value = 17.0
    L(info.outputs["Random"], graine.inputs[0])

    def couche(nom):
        u = N("ShaderNodeValue")
        u.name = u.label = nom
        u.outputs[0].default_value = 0.0
        neg = N("ShaderNodeMath")
        neg.operation = "MULTIPLY"
        neg.inputs[1].default_value = -1.0
        L(u.outputs[0], neg.inputs[0])
        dec = N("ShaderNodeCombineXYZ")
        L(graine.outputs[0], dec.inputs["X"])
        L(neg.outputs[0], dec.inputs["Z"])
        add = N("ShaderNodeVectorMath")
        add.operation = "ADD"
        L(echelle.outputs[0], add.inputs[0])
        L(dec.outputs[0], add.inputs[1])
        nz = N("ShaderNodeTexNoise")
        nz.noise_dimensions = "3D"
        nz.inputs["Scale"].default_value = 1.0
        nz.inputs["Detail"].default_value = 3.0
        nz.inputs["Roughness"].default_value = 0.55
        L(add.outputs[0], nz.inputs["Vector"])
        VALEURS_FLAMME[nom] = u
        return nz

    nA, nB = couche("uA"), couche("uB")
    wB = N("ShaderNodeValue")
    wB.name = wB.label = "wB"
    VALEURS_FLAMME["wB"] = wB
    unMoins = N("ShaderNodeMath")
    unMoins.operation = "SUBTRACT"
    unMoins.inputs[0].default_value = 1.0
    L(wB.outputs[0], unMoins.inputs[1])
    mA = N("ShaderNodeMath")
    mA.operation = "MULTIPLY"
    L(nA.outputs["Fac"], mA.inputs[0])
    L(unMoins.outputs[0], mA.inputs[1])
    mB = N("ShaderNodeMath")
    mB.operation = "MULTIPLY"
    L(nB.outputs["Fac"], mB.inputs[0])
    L(wB.outputs[0], mB.inputs[1])
    n = N("ShaderNodeMath")
    n.operation = "ADD"
    L(mA.outputs[0], n.inputs[0])
    L(mB.outputs[0], n.inputs[1])

    # la densité : le bruit, plus fort en bas qu'en haut de la langue
    haut = N("ShaderNodeMath")
    haut.operation = "MULTIPLY"
    haut.inputs[1].default_value = 1.3
    L(sep.outputs["Z"], haut.inputs[0])
    d = N("ShaderNodeMath")
    d.operation = "MULTIPLY_ADD"
    d.inputs[1].default_value = 1.2
    d.inputs[2].default_value = 0.42
    L(n.outputs[0], d.inputs[0])
    dens = N("ShaderNodeMath")
    dens.operation = "SUBTRACT"
    L(d.outputs[0], dens.inputs[0])
    L(haut.outputs[0], dens.inputs[1])

    alpha = N("ShaderNodeMapRange")
    alpha.interpolation_type = "SMOOTHSTEP"
    alpha.inputs["From Min"].default_value = 0.34
    alpha.inputs["From Max"].default_value = 0.52
    L(dens.outputs[0], alpha.inputs["Value"])

    # du rouge sombre au bord, de l'orange presque partout, du jaune au coeur
    # seulement : un feu blanc est un feu surexposé, pas un feu chaud
    rampe = N("ShaderNodeValToRGB")
    r = rampe.color_ramp
    r.elements[0].position = 0.34
    r.elements[0].color = (0.62, 0.02, 0.0, 1)
    r.elements[1].position = 1.15
    r.elements[1].color = (1.0, 0.88, 0.45, 1)
    e = r.elements.new(0.56)
    e.color = (1.0, 0.22, 0.01, 1)
    e = r.elements.new(0.88)
    e.color = (1.0, 0.58, 0.08, 1)
    L(dens.outputs[0], rampe.inputs["Fac"])

    em = N("ShaderNodeEmission")
    em.inputs["Strength"].default_value = 4.5
    L(rampe.outputs["Color"], em.inputs["Color"])
    tr = N("ShaderNodeBsdfTransparent")
    mix = N("ShaderNodeMixShader")
    L(alpha.outputs[0], mix.inputs[0])
    L(tr.outputs[0], mix.inputs[1])
    L(em.outputs[0], mix.inputs[2])
    out = N("ShaderNodeOutputMaterial")
    L(mix.outputs[0], out.inputs["Surface"])
    MATS["flamme"] = m
    return m


def mat_trainee():
    """La traînée de la météorite : chaude et pleine près de la pierre, rien au bout."""
    if "trainee" in MATS:
        return MATS["trainee"]
    m = bpy.data.materials.new("trainee")
    m.use_nodes = True
    m.surface_render_method = "DITHERED"
    nt = m.node_tree
    nt.nodes.clear()
    N, L = nt.nodes.new, nt.links.new
    coord = N("ShaderNodeTexCoord")
    sep = N("ShaderNodeSeparateXYZ")
    L(coord.outputs["Generated"], sep.inputs[0])
    nz = N("ShaderNodeTexNoise")
    nz.inputs["Scale"].default_value = 6.0
    L(coord.outputs["Generated"], nz.inputs["Vector"])
    # la pointe du cône (z = 1) est le bout de la traînée
    inv = N("ShaderNodeMath")
    inv.operation = "SUBTRACT"
    inv.inputs[0].default_value = 1.0
    L(sep.outputs["Z"], inv.inputs[1])
    pw = N("ShaderNodeMath")
    pw.operation = "POWER"
    pw.inputs[1].default_value = 1.6
    L(inv.outputs[0], pw.inputs[0])
    a = N("ShaderNodeMath")
    a.operation = "MULTIPLY"
    L(pw.outputs[0], a.inputs[0])
    L(nz.outputs["Fac"], a.inputs[1])
    a2 = N("ShaderNodeMath")
    a2.operation = "MULTIPLY"
    a2.inputs[1].default_value = 1.6
    L(a.outputs[0], a2.inputs[0])
    rampe = N("ShaderNodeValToRGB")
    rampe.color_ramp.elements[0].color = (1.0, 0.25, 0.03, 1)
    rampe.color_ramp.elements[1].color = (1.0, 0.85, 0.45, 1)
    L(pw.outputs[0], rampe.inputs["Fac"])
    em = N("ShaderNodeEmission")
    em.inputs["Strength"].default_value = 14.0
    L(rampe.outputs["Color"], em.inputs["Color"])
    tr = N("ShaderNodeBsdfTransparent")
    mix = N("ShaderNodeMixShader")
    L(a2.outputs[0], mix.inputs[0])
    L(tr.outputs[0], mix.inputs[1])
    L(em.outputs[0], mix.inputs[2])
    out = N("ShaderNodeOutputMaterial")
    L(mix.outputs[0], out.inputs["Surface"])
    MATS["trainee"] = m
    return m


def mat_fumee():
    """La fumée ne prend pas la lumière : une boule sombre à demi transparente.
    Éclairée, elle se lisait comme un rocher qui flotte."""
    if "fumee" in MATS:
        return MATS["fumee"]
    m = bpy.data.materials.new("fumee")
    m.use_nodes = True
    m.surface_render_method = "DITHERED"
    nt = m.node_tree
    nt.nodes.clear()
    N, L = nt.nodes.new, nt.links.new
    em = N("ShaderNodeEmission")
    em.inputs["Color"].default_value = (0.022, 0.016, 0.014, 1)
    em.inputs["Strength"].default_value = 1.0
    tr = N("ShaderNodeBsdfTransparent")
    mix = N("ShaderNodeMixShader")
    mix.inputs[0].default_value = 0.42
    L(tr.outputs[0], mix.inputs[1])
    L(em.outputs[0], mix.inputs[2])
    out = N("ShaderNodeOutputMaterial")
    L(mix.outputs[0], out.inputs["Surface"])
    MATS["fumee"] = m
    return m


def mat_lune():
    if "lune" in MATS:
        return MATS["lune"]
    m = bpy.data.materials.new("lune")
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    N, L = nt.nodes.new, nt.links.new
    coord = N("ShaderNodeTexCoord")
    nz = N("ShaderNodeTexNoise")
    nz.inputs["Scale"].default_value = 3.2
    nz.inputs["Detail"].default_value = 4.0
    L(coord.outputs["Generated"], nz.inputs["Vector"])
    # des mers à peine plus sombres : plus contrasté, c'était un ballon
    rampe = N("ShaderNodeValToRGB")
    rampe.color_ramp.elements[0].position = 0.36
    rampe.color_ramp.elements[0].color = (0.70, 0.72, 0.80, 1)
    rampe.color_ramp.elements[1].position = 0.62
    rampe.color_ramp.elements[1].color = (0.96, 0.97, 1.0, 1)
    L(nz.outputs["Fac"], rampe.inputs["Fac"])
    em = N("ShaderNodeEmission")
    em.inputs["Strength"].default_value = 2.4
    L(rampe.outputs["Color"], em.inputs["Color"])
    out = N("ShaderNodeOutputMaterial")
    L(em.outputs[0], out.inputs["Surface"])
    MATS["lune"] = m
    return m


# ------------------------------------------------------------- géométrie
def altitude(x, y):
    """Le relief : des bosses fines partout, le village et le chemin plats, des
    collines qui montent loin derrière — la météorite tombe derrière elles."""
    r = math.hypot(x * 0.85, y - 4)
    m = lisser(19, 46, r)
    bosses = 0.2 * max(0.0, bruit.noise(Vector((x * 0.33, y * 0.33, 0.7))))
    xr = 0.7 * math.sin(y * 0.22)
    chemin = lisser(2.4, 1.3, abs(x - xr))
    collines = 2.2 + 5.5 * (0.5 + 0.5 * bruit.noise(Vector((x * 0.045, y * 0.045, 3.1))))
    collines += 2.6 * abs(bruit.noise(Vector((x * 0.085 + 7, y * 0.085, 1.4))))
    return bosses * (1 - chemin) * (1 - 0.5 * m) + m * collines


def terrain(scene, rnd):
    N = 72
    taille = 150.0
    pas = taille / N
    bm = bmesh.new()
    verts = []
    for j in range(N + 1):
        rangee = []
        for i in range(N + 1):
            x = -taille / 2 + i * pas
            y = -taille / 2 + j * pas + 22
            rangee.append(bm.verts.new((x, y, altitude(x, y))))
        verts.append(rangee)
    faces = []
    for j in range(N):
        for i in range(N):
            a, b, c, d = verts[j][i], verts[j][i + 1], verts[j + 1][i + 1], verts[j + 1][i]
            # une diagonale tirée au sort : c'est ce qui fait des facettes et non un quadrillage
            tris = ((a, b, c), (a, c, d)) if rnd.random() < 0.5 else ((a, b, d), (b, c, d))
            for tri in tris:
                f = bm.faces.new(tri)
                cx = sum(v.co.x for v in tri) / 3
                cy = sum(v.co.y for v in tri) / 3
                cz = sum(v.co.z for v in tri) / 3
                xr = 0.7 * math.sin(cy * 0.22)
                if cz > 2.4 + 1.5 * bruit.noise(Vector((cx * 0.2, cy * 0.2, 5))):
                    k = 3
                elif abs(cx - xr) < 1.5 + 0.35 * bruit.noise(Vector((cx * 0.5, cy * 0.5, 9))):
                    k = 2
                elif bruit.noise(Vector((cx * 0.16, cy * 0.16, 2.2))) > 0.28:
                    k = 1
                else:
                    k = 0
                faces.append((f, k))
    me = bpy.data.meshes.new("Terrain")
    bm.to_mesh(me)
    bm.free()
    sol = corps("sol_vert")
    me.materials.append(mat_simple("herbe", couleur(sol)))
    me.materials.append(mat_simple("terre", couleur(melanger(sol, corps("ecorce"), 0.55))))
    me.materials.append(mat_simple("chemin", couleur(melanger(corps("sable"), PALETTE["ombre"], 0.42))))
    me.materials.append(mat_simple("roche", couleur(corps("roche"))))
    for k, poly in enumerate(me.polygons):
        poly.material_index = faces[k][1]
        poly.use_smooth = False
    o = bpy.data.objects.new("Terrain", me)
    return lier(scene, o)


def poser(a, fabrique, loc, rot_z=0.0, echelle=1.0):
    """Fabrique un objet de `monde.py` et le range sous un repère qu'on peut placer."""
    debut = len(a.pieces)
    fabrique(a)
    r = bpy.data.objects.new("Pose", None)
    lier(bpy.context.scene, r)
    r.location = loc
    r.rotation_euler = (0, 0, rot_z)
    r.scale = (echelle, echelle, echelle)
    for o in a.pieces[debut:]:
        if o.parent is None:
            o.parent = r
    return a.pieces[debut:]


def fenetres_en_feu(pieces):
    """Les ouvertures d'une maison qui brûle rougeoient de l'intérieur."""
    feu = mat_simple("trou_feu", (0.02, 0.01, 0.0, 1), emission=(1.0, 0.30, 0.03, 1), force=1.4)
    for o in pieces:
        if o.data and o.data.materials and o.data.materials[0].name == "trou":
            o.data.materials[0] = feu


def icosphere(scene, nom, mat, r, loc, graine=0, bosses=0.0, sub=1):
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=sub, radius=r)
    if bosses:
        rnd = random.Random(graine)
        for v in bm.verts:
            v.co *= 1 + rnd.uniform(-bosses, bosses)
    me = bpy.data.meshes.new(nom)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(mat)
    o = bpy.data.objects.new(nom, me)
    o.location = loc
    return lier(scene, o)


def cone(scene, nom, mat, r, h, loc, cotes=7, r_haut=0.0, base_a_l_origine=True):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=cotes, radius1=r, radius2=r_haut, depth=h)
    if base_a_l_origine:
        for v in bm.verts:
            v.co.z += h / 2
    me = bpy.data.meshes.new(nom)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(mat)
    o = bpy.data.objects.new(nom, me)
    o.location = loc
    return lier(scene, o)


def boite(scene, nom, mat, taille, loc, rot=(0, 0, 0)):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    me = bpy.data.meshes.new(nom)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(mat)
    o = bpy.data.objects.new(nom, me)
    o.location, o.scale, o.rotation_euler = loc, taille, rot
    return lier(scene, o)


# ---------------------------------------------------------------- le feu
class Foyer:
    """Un feu : des langues, une lumière qui vacille, de la fumée, des braises."""

    def __init__(self, scene, rnd, pos, taille=1.0, ombres=True, graine=0):
        self.pos = Vector(pos)
        self.taille = taille
        self.langues = []
        self.fumees = []
        self.braises = []
        s = taille
        flamme = mat_flamme()
        nb = 5 + (1 if s >= 1.0 else 0)
        for i in range(nb):
            ang = TAU * i / nb + rnd.uniform(-0.4, 0.4)
            ray = 0.3 * s * rnd.uniform(0.3, 1.0)
            h = s * rnd.uniform(1.4, 2.4)
            r = s * rnd.uniform(0.22, 0.34)
            o = cone(scene, "Langue", flamme, r, h,
                     (pos[0] + math.cos(ang) * ray, pos[1] + math.sin(ang) * ray, pos[2] - 0.15 * s),
                     cotes=7)
            o.rotation_euler = (rnd.uniform(-0.12, 0.12), rnd.uniform(-0.12, 0.12), rnd.uniform(0, TAU))
            o.visible_shadow = False
            self.langues.append((o, (rnd.choice((2, 3, 4)), rnd.uniform(0, TAU),
                                     rnd.choice((5, 7, 9)), rnd.uniform(0, TAU),
                                     rnd.uniform(0.85, 1.15))))
        # une lumière chaude, un peu au-dessus du foyer
        ld = bpy.data.lights.new("Feu", "POINT")
        ld.color = (1.0, 0.42, 0.10)
        ld.shadow_soft_size = 0.5 * s
        ld.use_shadow = ombres
        ld.volume_factor = 0.35
        self.energie = 330.0 * s * s
        ld.energy = self.energie
        self.lumiere = lier(scene, bpy.data.objects.new("Feu", ld))
        self.lumiere.location = (pos[0], pos[1], pos[2] + 1.1 * s)
        self.phases = (rnd.uniform(0, TAU), rnd.uniform(0, TAU), rnd.uniform(0, TAU))
        # la fumée : des boules sombres qui montent, grossissent et s'effacent.
        # ⚠️ Éteinte le 18 septembre 2026 (NB_FUMEES = 0) : sur ciel noir, une
        # boule à facettes ne se lit jamais comme de la fumée, quoi qu'on lui
        # donne comme matière. Le code reste, au cas où le ciel s'éclaircirait.
        fumee = mat_fumee()
        for i in range(NB_FUMEES):
            o = icosphere(scene, "Fumee", fumee, 0.34 * s, pos, graine=graine * 31 + i, bosses=0.22)
            o.visible_shadow = False
            self.fumees.append((o, rnd.random(), rnd.uniform(0.6, 1.4), rnd.uniform(3.0, 4.2), rnd.uniform(0.7, 1.0)))
        # les braises : de petits points chauds qui s'envolent
        braise = mat_emission("braise", (1.0, 0.42, 0.08), 22.0)
        for i in range(9):
            o = icosphere(scene, "Braise", braise, rnd.uniform(0.028, 0.05) * s, pos, sub=0)
            o.visible_shadow = False
            self.braises.append((o, rnd.random(), rnd.choice((1, 1, 2)), rnd.uniform(0, TAU),
                                 rnd.uniform(2.6, 4.2) * s, rnd.uniform(-0.5, 0.5), rnd.uniform(0.3, 0.8)))

    def animer(self, t):
        for o, (k1, p1, k2, p2, base) in self.langues:
            o.scale = (base * (1 + 0.05 * onde(t, k2, p2 + 1)),
                       base * (1 + 0.05 * onde(t, k2, p2 + 2)),
                       base * (1 + 0.11 * onde(t, k1, p1) + 0.06 * onde(t, k2, p2)))
        p1, p2, p3 = self.phases
        self.lumiere.data.energy = self.energie * (1 + 0.22 * onde(t, 3, p1) + 0.12 * onde(t, 7, p2) + 0.07 * onde(t, 11, p3))
        s = self.taille
        for o, phi, derive, montee, gros in self.fumees:
            p = cycle(t, 1, phi)
            o.location = (self.pos.x + derive * p + 0.25 * s * math.sin(TAU * p + phi * 6),
                          self.pos.y + 0.3 * s * p,
                          self.pos.z + 1.5 * s + montee * s * p)
            e = gros * math.sin(math.pi * p) ** 0.8 * (0.5 + 1.0 * p)
            o.scale = (e, e, e)
        for o, phi, k, ph2, montee, vent, ampl in self.braises:
            p = cycle(t, k, phi)
            o.location = (self.pos.x + ampl * math.sin(TAU * 1.5 * p + ph2) + vent * p * 1.2,
                          self.pos.y + ampl * 0.6 * math.cos(TAU * 1.2 * p + ph2),
                          self.pos.z + 0.6 * s + montee * p ** 0.9)
            e = math.sin(math.pi * p) ** 0.6
            o.scale = (e, e, e)


# ------------------------------------------------------------ les monstres
class Monstre:
    """Une silhouette voûtée, deux cornes, des bras trop longs, deux yeux de sang."""

    def __init__(self, scene, rnd, depart, arrivee, echelle=1.0):
        self.depart = Vector((depart[0], depart[1], 0))
        self.arrivee = Vector((arrivee[0], arrivee[1], 0))
        self.phi = rnd.uniform(0, TAU)
        ombre = mat_simple("ombre", (0.010, 0.007, 0.007, 1), rugosite=0.95)
        oeil = mat_emission("oeil", (0.88, 0.16, 0.10), 12.0)
        self.racine = lier(scene, bpy.data.objects.new("Monstre", None))
        self.racine.scale = (echelle, echelle, echelle)
        d = self.arrivee - self.depart
        self.cap = math.atan2(-d.x, d.y)
        self.corps = boite(scene, "Torse", ombre, (0.58, 0.44, 0.82), (0, 0, 1.2), rot=(-0.42, 0, 0))
        self.tete = icosphere(scene, "Tete", ombre, 0.27, (0, 0.34, 1.68), bosses=0.1)
        for cote in (-1, 1):
            c = cone(scene, "Corne", ombre, 0.07, 0.36, (cote * 0.17, 0.02, 0.16))
            c.rotation_euler = (-0.3, cote * 0.55, 0)
            c.parent = self.tete
            e = icosphere(scene, "Oeil", oeil, 0.036, (cote * 0.095, 0.245, 0.03), sub=0)
            e.parent = self.tete
        self.bras = []
        for cote in (-1, 1):
            b = cone(scene, "Bras", ombre, 0.075, 1.05, (cote * 0.36, 0.12, 1.52), cotes=5, r_haut=0.05)
            b.rotation_euler = (math.pi - 0.55, 0, cote * 0.12)
            self.bras.append((b, cote))
        self.jambes = []
        for cote in (-1, 1):
            j = cone(scene, "Jambe", ombre, 0.10, 0.78, (cote * 0.17, 0, 0.78), cotes=5, r_haut=0.07)
            j.rotation_euler = (math.pi, 0, 0)
            self.jambes.append((j, cote))
        for o in (self.corps, self.tete) + tuple(b for b, _ in self.bras) + tuple(j for j, _ in self.jambes):
            o.parent = self.racine

    def animer(self, t):
        u = min(1.0, t / DUREE_APPROCHE)
        e = 1 - (1 - u) ** 2.2
        pos = self.depart + (self.arrivee - self.depart) * e
        # la marche s'éteint dans la dernière demi-seconde de l'approche, et ne
        # revient jamais : dans la boucle ils sont là, plantés, à regarder
        marche = 1 - lisser(DUREE_APPROCHE - 0.7, DUREE_APPROCHE, t)
        pas = onde(t, 5, self.phi)
        respire = 0.02 * onde(t, 2, self.phi)
        self.racine.location = (pos.x, pos.y, 0.045 * abs(pas) * marche + respire)
        self.racine.rotation_euler = (0, 0, self.cap + 0.03 * onde(t, 5, self.phi) * marche)
        self.tete.rotation_euler = (0.1 * onde(t, 2, self.phi + 1) * (1 - marche), 0, 0.22 * onde(t, 1, self.phi))
        for j, cote in self.jambes:
            j.rotation_euler = (math.pi + cote * 0.5 * pas * marche, 0, 0)
        for b, cote in self.bras:
            b.rotation_euler = (math.pi - 0.55 - cote * 0.35 * pas * marche + 0.05 * onde(t, 2, self.phi), 0, cote * 0.12)


# ---------------------------------------------------------- la météorite
class Meteorite:
    DEBUT, FIN = 28, 82   # images de la chute
    P0 = Vector((40, 82, 31))
    P1 = Vector((-14, 68, 2.5))

    def __init__(self, scene, rnd):
        roche = mat_simple("meteore", (0.06, 0.045, 0.04, 1), rugosite=0.9,
                           emission=(1.0, 0.32, 0.06, 1), force=9.0)
        self.pierre = icosphere(scene, "Meteorite", roche, 1.1, self.P0, graine=4, bosses=0.3)
        self.trainee = cone(scene, "Trainee", mat_trainee(), 1.3, 14.0, self.P0, cotes=8, base_a_l_origine=False)
        self.trainee.visible_shadow = False
        d = (self.P1 - self.P0).normalized()
        self.direction = d
        self.trainee.rotation_mode = "QUATERNION"
        self.trainee.rotation_quaternion = (-d).to_track_quat("Z", "Y")
        ld = bpy.data.lights.new("Meteore", "POINT")
        ld.color = (1.0, 0.55, 0.25)
        ld.energy = 0.0
        ld.shadow_soft_size = 3.0
        ld.use_shadow = True
        self.lumiere = lier(scene, bpy.data.objects.new("Meteore", ld))
        # l'impact, derrière les collines : une boule de feu qui gonfle et s'éteint
        self.flash = icosphere(scene, "Impact", mat_emission("impact", (1.0, 0.72, 0.42), 12.0), 1.0,
                               (self.P1.x, self.P1.y + 4, 0.5), sub=2)
        self.flash.visible_shadow = False
        fd = bpy.data.lights.new("Impact", "POINT")
        fd.color = (1.0, 0.7, 0.4)
        fd.energy = 0.0
        fd.shadow_soft_size = 6.0
        fd.use_shadow = True
        # ⚠️ Vu sur l'image 84 : a pleine part dans la brume, ce flash blanchissait
        # tout le ciel. Il doit rester une lueur derriere les collines.
        fd.volume_factor = 0.2
        self.eclat = lier(scene, bpy.data.objects.new("Impact", fd))
        self.eclat.location = (self.P1.x, self.P1.y - 4, 7)

    def animer(self, f, t):
        chute = self.DEBUT <= f <= self.FIN
        for o in (self.pierre, self.trainee):
            o.hide_render = not chute
            o.hide_viewport = not chute
        if chute:
            u = (f - self.DEBUT) / (self.FIN - self.DEBUT)
            p = self.P0 + (self.P1 - self.P0) * u
            self.pierre.location = p
            self.pierre.rotation_euler = (u * 9, u * 5, 0)
            self.trainee.location = p - self.direction * 7.0 * (0.6 + 0.4 * min(1.0, u * 4))
            self.trainee.scale = (1, 1, 0.4 + 0.6 * min(1.0, u * 3))
            self.lumiere.location = p
            self.lumiere.data.energy = 14000.0 * (0.8 + 0.2 * math.sin(f * 1.7))
        else:
            self.lumiere.data.energy = 0.0
        # l'impact : trois images pour gonfler, une seconde pour s'éteindre
        di = f - self.FIN
        if 0 <= di <= 30:
            monte = min(1.0, di / 3)
            descend = 1 - lisser(3, 30, di)
            r = 2.5 + 5.5 * (1 - (1 - monte) ** 2) + 2.5 * (1 - descend)
            self.flash.scale = (r, r, r * 0.7)
            self.flash.hide_render = self.flash.hide_viewport = False
            self.eclat.data.energy = 220000.0 * monte * descend
        else:
            self.flash.hide_render = self.flash.hide_viewport = True
            self.eclat.data.energy = 0.0


# ---------------------------------------------------------------- la scène
class Cinematique:
    def __init__(self, args):
        bpy.ops.wm.read_factory_settings(use_empty=True)
        self.scene = bpy.context.scene
        self.rnd = random.Random(7)
        self.foyers = []
        self.monstres = []
        self.brume = not args.sans_brume
        self.batir()
        self.eclairer()
        self.cadrer()
        self.regler(args)

    # -- le village, le décor, le sol
    def batir(self):
        sc, rnd = self.scene, self.rnd
        terrain(sc, rnd)
        a = monde.Atelier()
        self.atelier = a

        # l'église au bout du chemin, et son clocher qui se découpe sur le ciel
        poser(a, lambda a: monde.eglise(a, 3), (0, 7.5, 0))

        # les maisons, façade sur le chemin ; celles qui brûlent ont les fenêtres rouges
        maisons = [
            ((-5.3, -5.5, 0), math.pi / 2, 0, True),
            ((-6.1, -0.4, 0), math.pi / 2, 1, False),
            ((-5.5, 4.2, 0), 0.0, 2, True),
            ((5.5, -3.8, 0), -math.pi / 2, 1, True),
            ((6.3, 1.2, 0), -math.pi / 2, 2, False),
            ((5.2, 5.6, 0), 0.0, 0, True),
            ((-4.6, 13.5, 0), 0.0, 1, True),
            ((5.0, 13.0, 0), 0.0, 2, True),
        ]
        for loc, rot, var, brule in maisons:
            pieces = poser(a, lambda a, v=var: monde.maison(a, v), loc, rot)
            if brule:
                fenetres_en_feu(pieces)
        pieces = poser(a, lambda a: monde.maison(a, 1, annexe=True), (10.5, 8.5, 0), 0.0)
        fenetres_en_feu(pieces)

        # le décor : des arbres morts près du chemin, des conifères aux lisières
        for loc, i, s in [((-4.4, -13.5, 0), 0, 1.4), ((4.8, -15.5, 0), 1, 1.3), ((-8.6, 2.5, 0), 2, 1.25),
                          ((9.2, -1.5, 0), 3, 1.2), ((-3.6, 17.5, 0), 1, 1.3), ((8.5, 17, 0), 2, 1.2)]:
            poser(a, lambda a, i=i: monde.arbre_mort(a, i), loc, rnd.uniform(0, TAU), s)
        for loc, i in [((-16, 11, 0), 0), ((-18.5, 15.5, 0), 1), ((-14, 19, 0), 0), ((15.5, 13.5, 0), 1),
                       ((18, 9.5, 0), 0), ((16.5, 18.5, 0), 1), ((-20, 4, 0), 1), ((21, 2, 0), 0)]:
            poser(a, lambda a, i=i: monde.conifere(a, i), loc, rnd.uniform(0, TAU), rnd.uniform(1.4, 1.9))
        for loc, g in [((-8.5, 9, 0), 1), ((12.5, 4, 0), 2)]:
            poser(a, lambda a, g=g: monde.chene(a, g), loc, rnd.uniform(0, TAU), 1.5)
        for loc, i in [((3.9, -12.8, 0), 0), ((-3.6, -1.6, 0), 1), ((7.4, -8.2, 0), 2), ((-8, 15, 0), 0)]:
            poser(a, lambda a, i=i: monde.rocher(a, i), loc, rnd.uniform(0, TAU), rnd.uniform(0.6, 0.85))
        poser(a, lambda a: monde.souche(a), (-2.6, -13.5, 0), 0.3, 1.3)
        habiller(a)

        # la clôture le long du chemin, à moitié couchée
        bois = a.mat("bois")
        for cote in (-1, 1):
            y = -15.5
            while y < -2:
                if rnd.random() < 0.8:
                    h = 0.9 if rnd.random() < 0.7 else rnd.uniform(0.35, 0.6)
                    boite(sc, "Poteau", bois, (0.13, 0.13, h), (cote * 2.35 + rnd.uniform(-0.1, 0.1), y, h / 2),
                          rot=(rnd.uniform(-0.08, 0.08), cote * rnd.uniform(-0.05, 0.12), 0))
                    if h >= 0.9 and rnd.random() < 0.6:
                        boite(sc, "Traverse", bois, (0.06, 1.55, 0.09), (cote * 2.35, y + 0.8, 0.72),
                              rot=(0, 0, rnd.uniform(-0.05, 0.05)))
                y += 1.6

        # les touffes d'herbe et les cailloux : ce qui donne du grain au sol de près
        touffe = mat_simple("touffe", couleur(PALETTE["matieres"]["sol_vert"]["clair"]))
        caillou = mat_simple("caillou", couleur(corps("roche")))
        for _ in range(260):
            x = rnd.uniform(-14, 14)
            y = rnd.uniform(-19, 12)
            if abs(x) < 1.9 + 0.7 * math.sin(y * 0.22) or (abs(x) > 3.6 and abs(x) < 8.2 and -8 < y < 8):
                continue
            z = altitude(x, y)
            for k in range(3):
                dx, dy = rnd.uniform(-0.18, 0.18), rnd.uniform(-0.18, 0.18)
                c = cone(sc, "Touffe", touffe, 0.055, rnd.uniform(0.18, 0.34), (x + dx, y + dy, z - 0.02), cotes=4)
                c.rotation_euler = (rnd.uniform(-0.3, 0.3), rnd.uniform(-0.3, 0.3), rnd.uniform(0, TAU))
        for _ in range(70):
            x = rnd.uniform(-13, 13)
            y = rnd.uniform(-19, 12)
            if abs(x) > 3.6 and abs(x) < 8.2 and -8 < y < 8:
                continue
            r = rnd.uniform(0.07, 0.22)
            icosphere(sc, "Caillou", caillou, r, (x, y, altitude(x, y) + r * 0.35), graine=rnd.randrange(999), bosses=0.3)

        # la meule de foin en feu, près de l'endroit où la caméra s'arrête
        foin = icosphere(sc, "Meule", mat_simple("foin", couleur(corps("sable"))), 0.8, (3.3, -3.8, 0.42), graine=3, bosses=0.15)
        foin.scale = (1.15, 1.0, 0.75)

        # les feux : sur les toits qui brûlent, sur la meule, dans la ferme
        feux = [
            ((-5.3, -6.1, 2.55), 0.95, True), ((-5.3, -4.8, 2.5), 0.8, False),
            ((5.5, -4.5, 2.55), 1.0, True), ((5.5, -3.0, 2.5), 0.85, False),
            ((-6.0, 4.3, 2.55), 0.95, True), ((-4.8, 4.2, 2.5), 0.75, False),
            ((4.6, 5.7, 2.55), 0.9, True), ((5.9, 5.6, 2.5), 0.75, False),
            ((-5.2, 13.6, 2.6), 1.35, False), ((-3.9, 13.4, 2.5), 1.1, False),
            ((4.4, 13.1, 2.6), 1.3, False), ((5.8, 13.0, 2.5), 1.1, False),
            ((10.4, 8.6, 2.5), 1.1, False), ((12.4, 8.2, 1.4), 0.8, False),
            ((3.3, -3.8, 0.9), 0.65, True),
        ]
        for i, (pos, s, ombres) in enumerate(feux):
            self.foyers.append(Foyer(sc, rnd, pos, s, ombres, graine=i))

        # les monstres : ils arrivent des bords pendant l'approche, puis attendent
        # ⚠️ les points d'arrivée sont dans le champ de la caméra arrêtée (y = -9,2,
        # 28 mm : |dx| < 0,6·dy) — plus près ou plus sur le côté, on ne les voit pas
        for dep, arr, s in [((-9.5, -1.0), (-3.6, -1.6), 1.2), ((10.5, 4.0), (4.6, 1.5), 1.1),
                            ((-12, 8), (-5.2, 3.0), 1.0), ((12.5, 11), (6.2, 6.0), 0.95),
                            ((-2.5, 22), (-1.4, 11.5), 1.15)]:
            self.monstres.append(Monstre(sc, rnd, dep, arr, s))

        self.meteorite = Meteorite(sc, rnd)

        # la lune et les étoiles
        lune = icosphere(sc, "Lune", mat_lune(), 5.2, (-31, 102, 21), sub=3)
        lune.rotation_euler = (0.3, 0.2, 1.1)
        etoile = mat_emission("etoile", (0.92, 0.94, 1.0), 3.5)
        for _ in range(210):
            az = rnd.uniform(-1.3, 1.3)
            el = rnd.uniform(0.05, 1.2)
            R = 135
            p = (R * math.sin(az) * math.cos(el), R * math.cos(az) * math.cos(el), R * math.sin(el))
            if math.hypot(p[0] - lune.location.x, p[2] - lune.location.z) < 9:
                continue
            icosphere(sc, "Etoile", etoile, rnd.uniform(0.12, 0.26), p, sub=0)

    # -- la nuit, la lune, la brume
    def eclairer(self):
        sc = self.scene
        w = bpy.data.worlds.new("Nuit")
        sc.world = w
        w.use_nodes = True
        nt = w.node_tree
        fond = nt.nodes["Background"]
        N, L = nt.nodes.new, nt.links.new
        coord = N("ShaderNodeTexCoord")
        sep = N("ShaderNodeSeparateXYZ")
        L(coord.outputs["Generated"], sep.inputs[0])
        mr = N("ShaderNodeMapRange")
        mr.inputs["From Min"].default_value = -0.05
        mr.inputs["From Max"].default_value = 0.55
        L(sep.outputs["Z"], mr.inputs["Value"])
        rampe = N("ShaderNodeValToRGB")
        r = rampe.color_ramp
        # l'horizon garde un peu de bleu-gris : c'est ce qui découpe les collines
        # sur le ciel — noir sur noir, elles n'existaient pas
        r.elements[0].position = 0.0
        r.elements[0].color = (0.034, 0.030, 0.052, 1)
        r.elements[1].position = 1.0
        r.elements[1].color = (0.004, 0.006, 0.016, 1)
        e = r.elements.new(0.3)
        e.color = (0.010, 0.011, 0.028, 1)
        L(mr.outputs[0], rampe.inputs["Fac"])
        L(rampe.outputs["Color"], fond.inputs["Color"])
        fond.inputs["Strength"].default_value = 1.0
        if self.brume:
            # juste assez pour que le lointain s'éteigne et que les feux aient un halo
            vol = N("ShaderNodeVolumePrincipled")
            vol.inputs["Density"].default_value = 0.0025
            vol.inputs["Anisotropy"].default_value = 0.4
            vol.inputs["Color"].default_value = (0.5, 0.45, 0.42, 1)
            L(vol.outputs[0], nt.nodes["World Output"].inputs["Volume"])

        # le clair de lune : froid, bas, de la gauche — c'est lui qui fait les
        # toits et le sol bleus, contre les murs orangés par les feux
        vers_lune = Vector((-31, 102, 21)).normalized()
        sd = bpy.data.lights.new("Lune", "SUN")
        sd.color = (0.50, 0.62, 1.0)
        sd.energy = 2.2
        sd.angle = math.radians(2.5)
        so = lier(sc, bpy.data.objects.new("Lune", sd))
        so.rotation_mode = "QUATERNION"
        so.rotation_quaternion = (-vers_lune).to_track_quat("-Z", "Y")

    # -- la caméra qui remonte le chemin
    def cadrer(self):
        sc = self.scene
        self.rig = lier(sc, bpy.data.objects.new("Rig", None))
        cd = bpy.data.cameras.new("Camera")
        cd.lens = 28
        cd.sensor_width = 36
        cd.clip_end = 400
        cam = lier(sc, bpy.data.objects.new("Camera", cd))
        cam.parent = self.rig
        cam.rotation_euler = (math.radians(87), 0, 0)
        sc.camera = cam

    def regler(self, args):
        sc = self.scene
        sc.render.engine = "BLENDER_EEVEE"
        largeur, hauteur = (int(v) for v in args.res.split("x"))
        sc.render.resolution_x, sc.render.resolution_y = largeur, hauteur
        sc.render.resolution_percentage = 100
        sc.render.fps = FPS
        sc.frame_start, sc.frame_end = 1, TOTAL
        sc.render.film_transparent = False
        sc.render.image_settings.file_format = "PNG"
        sc.render.image_settings.color_mode = "RGB"
        sc.render.image_settings.compression = 40
        ev = sc.eevee
        ev.taa_render_samples = args.samples
        ev.use_shadows = True
        ev.shadow_ray_count = 2
        ev.shadow_step_count = 3
        ev.use_raytracing = False
        ev.volumetric_tile_size = "8"
        ev.volumetric_samples = 48
        ev.volumetric_start = 0.5
        ev.volumetric_end = 140
        ev.use_volumetric_shadows = True
        sc.view_settings.view_transform = "AgX"
        for look in ("AgX - Medium High Contrast", "Medium High Contrast"):
            try:
                sc.view_settings.look = look
                break
            except TypeError:
                continue
        sc.view_settings.exposure = -0.3
        self.composer()
        bpy.app.handlers.frame_change_pre.clear()
        bpy.app.handlers.frame_change_pre.append(self.animer)

    def composer(self):
        """Le halo des feux et de la lune : un Glare en mode Bloom, c'est tout."""
        sc = self.scene
        ng = bpy.data.node_groups.new("Composition", "CompositorNodeTree")
        sc.compositing_node_group = ng
        sc.render.use_compositing = True
        ng.interface.new_socket("Image", in_out="OUTPUT", socket_type="NodeSocketColor")
        couches = ng.nodes.new("CompositorNodeRLayers")
        couches.scene = sc
        glare = ng.nodes.new("CompositorNodeGlare")
        for nom, valeur in (("Type", "Bloom"), ("Quality", "High"), ("Threshold", 1.0),
                            ("Smoothness", 0.15), ("Strength", 0.4), ("Size", 0.55), ("Saturation", 0.85)):
            try:
                glare.inputs[nom].default_value = valeur
            except (KeyError, TypeError) as e:
                print(f"[intro] glare {nom} : {e}")
        sortie = ng.nodes.new("NodeGroupOutput")
        ng.links.new(couches.outputs["Image"], glare.inputs["Image"])
        ng.links.new(glare.outputs["Image"], sortie.inputs[0])

    # -- tout ce qui bouge, image par image
    def animer(self, scene, _depsgraph=None):
        f = scene.frame_current
        t = (f - 1) / FPS
        # la caméra : elle avance en s'adoucissant, puis reste là et respire
        u = min(1.0, t / DUREE_APPROCHE)
        s = 0.5 - 0.5 * math.cos(math.pi * u)
        y = -18.5 + 9.3 * s
        z = 1.85 - 0.35 * s
        self.rig.location = (0.06 * onde(t, 1, 0.4), y + 0.02 * onde(t, 2, 1.0), z + 0.025 * onde(t, 2, 0.3))
        self.rig.rotation_euler = (0.0035 * onde(t, 1, 2.0), 0.002 * onde(t, 2, 0.7), 0.004 * onde(t, 1, 1.1))
        # les flammes : deux couches qui défilent, fondues (voir `mat_flamme`)
        vitesse = 1.6
        VALEURS_FLAMME["uA"].outputs[0].default_value = vitesse * (t % T)
        VALEURS_FLAMME["uB"].outputs[0].default_value = vitesse * ((t + T / 2) % T)
        VALEURS_FLAMME["wB"].outputs[0].default_value = math.cos(math.pi * t / T) ** 2
        for foyer in self.foyers:
            foyer.animer(t)
        for m in self.monstres:
            m.animer(t)
        self.meteorite.animer(f, t)

    # -- rendu
    def rendre_image(self, f):
        os.makedirs(TMP, exist_ok=True)
        self.scene.frame_set(f)
        self.scene.render.filepath = os.path.join(TMP, f"still-{f:03d}.png")
        bpy.ops.render.render(write_still=True)
        print(f"[intro] image {f} -> {self.scene.render.filepath}")

    def rendre_sequence(self, debut, fin):
        dossier = os.path.join(TMP, "frames")
        os.makedirs(dossier, exist_ok=True)
        self.scene.frame_start, self.scene.frame_end = debut, fin
        self.scene.render.filepath = os.path.join(dossier, "f_")
        bpy.ops.render.render(animation=True)
        print(f"[intro] images {debut}-{fin} -> {dossier}")


if __name__ == "__main__":
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    parseur = argparse.ArgumentParser()
    parseur.add_argument("--still", type=int, action="append", help="rend cette image seule (répétable)")
    parseur.add_argument("--anim", action="store_true", help="rend toute la séquence")
    parseur.add_argument("--frames", default=f"1-{TOTAL}", help="plage pour --anim, ex. 1-144")
    parseur.add_argument("--samples", type=int, default=48)
    parseur.add_argument("--res", default="1280x720")
    parseur.add_argument("--sans-brume", action="store_true", help="sans le volume de brume (plus rapide)")
    args = parseur.parse_args(argv)

    cine = Cinematique(args)
    if args.still:
        for f in args.still:
            cine.rendre_image(f)
    if args.anim:
        debut, fin = (int(v) for v in args.frames.split("-"))
        cine.rendre_sequence(debut, fin)
