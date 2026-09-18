"""La cinématique d'ouverture : le village qui brûle, la nuit, en low-poly (DESIGN.md §4.10).

    blender -b -P scripts/blender/intro.py -- --still 120
        une seule image, dans .tmp/intro/still-120.png (répétable : --still 1 --still 216)
    blender -b -P scripts/blender/intro.py -- --anim
        les 312 images, dans .tmp/intro/frames/f_0001.png ...
    options : --frames 217-312   --samples 32   --res 1280x720

Le plus simple est de passer par `npm run intro`, qui rend puis encode (`intro.ts`).

**C'est le premier jet du 18 septembre 2026, repris tel quel** (`Projet/render/jeux/intro.py`,
rendu dans `captures/blender/2026-09-18-cinematique/intro-premier-jet.mp4`) : mêmes maisons
et même église (`lowpoly.py`), même disposition, mêmes flammes, même travelling de 9 s,
**même tirage aléatoire** (`rnd`, graine 7, appelé dans le même ordre). Ce qui a été ajouté,
et rien d'autre :

  - **le sol** : des facettes, trois tons de terre, le chemin, des touffes et des cailloux,
    à la place d'une boîte plate ;
  - **le ciel** : des étoiles, des nappes de nuages, et une lune voilée, dans le shader du
    monde, à la place d'une couleur unie ;
  - **une vignette** sombre au compositeur, pour le côté lugubre — et c'est tout.

Tout ce qui est nouveau tire ses nombres d'un **second générateur** (`rnd2`) : consommer
un nombre de plus dans `rnd` décalerait les arbres, les rochers et chaque flamme du jet.

**Une seule séquence, deux morceaux**, que `intro.ts` découpe ensuite :
  images   1 à 216 : l'approche, les 9 s du jet — la caméra remonte vers l'église ;
  images 217 à 312 : la boucle, 4 s — la caméra est arrêtée, et tout ce qui bouge encore
                     (flammes, lueurs, nuages) a des clés périodiques : l'image 313 vaut
                     l'image 217, le jeu peut boucler sans couture derrière le menu.
"""
import argparse
import math
import os
import random
import sys

import bpy
import bmesh
from mathutils import Vector, noise as bruit

ICI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, ICI)
import lowpoly as lp  # noqa: E402

RACINE = os.path.normpath(os.path.join(ICI, "..", ".."))
TMP = os.path.join(RACINE, ".tmp", "intro")

FPS, DUREE = 24, 9
N = FPS * DUREE           # 216 : l'approche, comme dans le jet
BOUCLE = 96               # 4 s de boucle derrière le menu
TOTAL = N + BOUCLE

parseur = argparse.ArgumentParser()
parseur.add_argument("--still", type=int, action="append", help="rend cette image seule (répétable)")
parseur.add_argument("--anim", action="store_true", help="rend toute la séquence")
parseur.add_argument("--frames", default=f"1-{TOTAL}", help="plage pour --anim, ex. 217-312")
parseur.add_argument("--samples", type=int, default=32)
parseur.add_argument("--res", default="1280x720")
parseur.add_argument("--ciel", default="tout", help="mise au point : fond | nuages | etoiles | lune | tout")
parseur.add_argument("--sans-brume", action="store_true", help="mise au point : sans le volume du monde")
parseur.add_argument("--sans-vignette", action="store_true", help="mise au point : sans le compositeur")
argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
args = parseur.parse_args(argv)
RES = [int(v) for v in args.res.split("x")]

# ⚠️ `rnd` est le générateur du jet : même graine, mêmes appels, dans le même ordre.
# Tout ce qui est nouveau passe par `rnd2`.
rnd = random.Random(7)
rnd2 = random.Random(11)

scene = lp.vider()
scene.render.fps = FPS
scene.frame_start, scene.frame_end = 1, TOTAL
m = lp.M()

# ------------------------------------------------------------------- matières
BRAISE = lp.mat("Braise", 0xFF6A10, emission=5.0)
TERRE = lp.mat("Terre", 0x2C2A22)


def flamme_materiau():
    """Flamme : émission orange -> jaune, qui ondule avec un bruit animé (le jet)."""
    mt = bpy.data.materials.new("Flamme")
    try:
        mt.use_nodes = True
    except Exception:
        pass
    nt = mt.node_tree
    nt.nodes.clear()
    sortie = nt.nodes.new("ShaderNodeOutputMaterial")
    em = nt.nodes.new("ShaderNodeEmission")
    bruit_n = nt.nodes.new("ShaderNodeTexNoise")
    bruit_n.noise_dimensions = "4D"
    bruit_n.inputs["Scale"].default_value = 2.5
    rampe = nt.nodes.new("ShaderNodeValToRGB")
    r = rampe.color_ramp
    r.elements[0].color = lp.hexa(0x9A1E04)
    r.elements[1].color = lp.hexa(0xFFB347)
    r.elements.new(0.5).color = lp.hexa(0xF25C0F)
    nt.links.new(bruit_n.outputs["Fac"], rampe.inputs["Fac"])
    nt.links.new(rampe.outputs["Color"], em.inputs["Color"])
    em.inputs["Strength"].default_value = 2.2
    nt.links.new(em.outputs["Emission"], sortie.inputs["Surface"])
    w = bruit_n.inputs["W"]
    w.default_value = 0
    w.keyframe_insert("default_value", frame=1)
    w.default_value = 6
    w.keyframe_insert("default_value", frame=N)
    # la boucle : le bruit revient sur ses pas, puis repart — 6 reste un maximum
    # local, donc la courbe du jet (de 1 à 216) ne bouge pas
    w.default_value = 4.8
    w.keyframe_insert("default_value", frame=N + BOUCLE // 2)
    w.default_value = 6
    w.keyframe_insert("default_value", frame=N + BOUCLE + 1)
    return mt


FLAMME = flamme_materiau()


# ------------------------------------------------------------------- le sol
def altitude(x, y):
    """Des bosses fines, plus fortes hors du village, et des collines au fond."""
    r = math.hypot(x * 0.9, y - 8)
    dehors = _lisser(14, 24, r)
    bosses = (0.10 + 0.22 * dehors) * max(0.0, bruit.noise(Vector((x * 0.35, y * 0.35, 0.7))))
    xr = 0.0
    chemin = _lisser(1.7, 1.1, abs(x - xr)) if -13.5 < y < 17.5 else 0.0
    loin = max(_lisser(30, 48, y), _lisser(24, 40, abs(x)))
    collines = 1.6 + 3.2 * (0.5 + 0.5 * bruit.noise(Vector((x * 0.05, y * 0.05, 3.1))))
    return bosses * (1 - chemin) + loin * collines


def _lisser(a, b, x):
    if a == b:
        return 1.0 if x >= b else 0.0
    u = max(0.0, min(1.0, (x - a) / (b - a)))
    return u * u * (3 - 2 * u)


def terrain():
    """Le sol en facettes : la même emprise que la boîte du jet (80 x 80 autour de (0, 10))."""
    n, taille = 64, 80.0
    pas = taille / n
    bm = bmesh.new()
    verts = []
    for j in range(n + 1):
        rangee = []
        for i in range(n + 1):
            x = -taille / 2 + i * pas
            y = -taille / 2 + j * pas + 10
            rangee.append(bm.verts.new((x, y, altitude(x, y))))
        verts.append(rangee)
    matieres = []
    for j in range(n):
        for i in range(n):
            a, b, c, d = verts[j][i], verts[j][i + 1], verts[j + 1][i + 1], verts[j + 1][i]
            # une diagonale tirée au sort : des facettes, pas un quadrillage
            tris = ((a, b, c), (a, c, d)) if rnd2.random() < 0.5 else ((a, b, d), (b, c, d))
            for tri in tris:
                bm.faces.new(tri)
                cx = sum(v.co.x for v in tri) / 3
                cy = sum(v.co.y for v in tri) / 3
                if abs(cx) < 1.1 + 0.25 * bruit.noise(Vector((cx * 0.6, cy * 0.6, 9))) and -13 < cy < 17:
                    k = 3   # le chemin, la même bande que la boîte du jet
                elif bruit.noise(Vector((cx * 0.14, cy * 0.14, 2.2))) > 0.3:
                    k = 1   # terre sombre
                elif bruit.noise(Vector((cx * 0.2 + 5, cy * 0.2, 4.4))) > 0.38:
                    k = 2   # herbe sèche
                else:
                    k = 0
                matieres.append(k)
    me = bpy.data.meshes.new("Terrain")
    bm.to_mesh(me)
    bm.free()
    for mt in (TERRE, lp.mat("Terre sombre", 0x232019), lp.mat("Herbe seche", 0x35322A),
               lp.mat("Chemin", 0x3A352B)):
        me.materials.append(mt)
    for k, poly in enumerate(me.polygons):
        poly.material_index = matieres[k]
        poly.use_smooth = False
    o = bpy.data.objects.new("Terrain", me)
    scene.collection.objects.link(o)
    return o


terrain()

BATIS = []  # (objets, position, brûle ?)


def placer(objets, pos, rot_z=0.0, nom="Bati"):
    return lp.grouper(objets, nom, pos=pos, rot_z=rot_z)


placer(lp.eglise(m), (0.5, 16, 0), nom="Eglise")
maisons = [((-5.5, 4), 0.05, True), ((5.5, 3), -0.08, False), ((-6, 10), 0.1, False),
           ((6.2, 9.5), 0.0, True), ((-11, 7), -0.15, True), ((11.5, 6), 0.12, False),
           ((-4.5, -3), 0.0, False), ((5.5, -4), 0.05, True)]
FEUX = []
for i, ((x, y), rz, brule) in enumerate(maisons):
    placer(lp.maison(m, variante=i % 3), (x, y, 0), rot_z=rz, nom=f"Maison{i}")
    if brule:
        FEUX.append((x, y))

for i in range(26):
    ang = rnd.uniform(0, math.tau)
    d = rnd.uniform(15, 26)
    x, y = math.cos(ang) * d, 10 + math.sin(ang) * d * 0.8
    if y < -6 or (y < 2 and abs(x) < 16):
        continue
    fab = lp.sapin if rnd.random() < 0.6 else (lambda mm, g=i: lp.chene(mm, graine=g))
    placer(fab(m), (x, y, 0), rot_z=rnd.uniform(0, 6), nom="Arbre")
for i in range(10):
    placer(lp.rocher(m, graine=i), (rnd.uniform(-14, 14), rnd.uniform(-8, 2), 0),
           rot_z=rnd.uniform(0, 6), nom="Rocher")

# palissade brisée au premier plan
for i in range(14):
    x = -13 + i * 2.0
    if i in (5, 6, 9):
        continue
    h = rnd.uniform(1.0, 1.8)
    lp.boite("Pieu", (0.3, 0.3, h), (x, -7.5, h / 2), m["bois"],
             rot=(rnd.uniform(-0.15, 0.15), rnd.uniform(-0.2, 0.2), 0))


# ------------------------------------------------------------------- le feu
FLAMMES = []   # (objet, taille, base_z) pour prolonger la danse dans la boucle
LUEURS = []    # (lumière, taille)


def feu(x, y, taille=1.0, base_z=2.6):
    for j in range(7):
        fl = lp.boule("Flamme", 0.55 * taille, (x + rnd.uniform(-1.5, 1.5),
                                                  y + rnd.uniform(-1, 1), base_z),
                      FLAMME, graine=rnd.randint(0, 999), bosses=0.3, subdiv=1)
        # une flamme = une goutte étirée qui danse
        for f in range(1, N + 1, 3):
            s = rnd.uniform(0.7, 1.25)
            fl.scale = (s * 0.8, s * 0.8, s * rnd.uniform(1.8, 2.8))
            fl.keyframe_insert("scale", frame=f)
            fl.location.z = base_z + fl.scale[2] * 0.45 * 0.55 * taille + rnd.uniform(0, 0.3)
            fl.keyframe_insert("location", index=2, frame=f)
        FLAMMES.append((fl, taille, base_z))
    # lumière qui vacille
    ld = bpy.data.lights.new("Lueur", "POINT")
    ld.color = (1.0, 0.45, 0.15)
    ld.shadow_soft_size = 1.0
    lo = bpy.data.objects.new("Lueur", ld)
    scene.collection.objects.link(lo)
    lo.location = (x, y - 1.5, 4.0)
    for f in range(1, N + 1, 2):
        ld.energy = rnd.uniform(900, 1700) * taille
        ld.keyframe_insert("energy", frame=f)
    LUEURS.append((ld, taille))
    # braises qui montent
    bpy.ops.mesh.primitive_plane_add(size=3, location=(x, y, 3.2))
    em = bpy.context.object
    em.show_instancer_for_render = False
    for debut, fin, compte, graine in ((-40, N, 140, 0), (N - 40, TOTAL, 75, 1)):
        systeme = em.modifiers.new("Braises", "PARTICLE_SYSTEM").particle_system
        systeme.seed = graine
        ps = systeme.settings
        ps.count = compte
        ps.frame_start, ps.frame_end = debut, fin
        ps.lifetime, ps.lifetime_random = 40, 0.6
        ps.normal_factor = 3.5
        ps.factor_random = 1.6
        ps.effector_weights.gravity = 0.0
        ps.brownian_factor = 0.6
        ps.render_type = "OBJECT"
        ps.instance_object = GRAIN
        ps.particle_size = 0.045
        ps.size_random = 0.6


bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=1, location=(0, 0, -50))
GRAIN = bpy.context.object
GRAIN.data.materials.append(BRAISE)

for (x, y) in FEUX:
    feu(x, y)
# le brasier de l'arrière-plan, derrière l'église
feu(-1, 21, taille=2.2, base_z=0.0)
feu(3.5, 21.5, taille=1.8, base_z=0.0)


def prolonger():
    """La boucle : les flammes et les lueurs continuent de danser, avec des clés qui
    reviennent à leur première valeur à l'image 313 — la boucle est fermée."""
    for fl, taille, base_z in FLAMMES:
        premiere = None
        for f in range(N + 1, N + BOUCLE + 2, 3):
            if f == N + BOUCLE + 1:
                echelle, z = premiere
            else:
                s = rnd2.uniform(0.7, 1.25)
                echelle = (s * 0.8, s * 0.8, s * rnd2.uniform(1.8, 2.8))
                z = base_z + echelle[2] * 0.45 * 0.55 * taille + rnd2.uniform(0, 0.3)
                if premiere is None:
                    premiere = (echelle, z)
            fl.scale = echelle
            fl.keyframe_insert("scale", frame=f)
            fl.location.z = z
            fl.keyframe_insert("location", index=2, frame=f)
    for ld, taille in LUEURS:
        premiere = None
        for f in range(N + 1, N + BOUCLE + 2, 2):
            energie = premiere if f == N + BOUCLE + 1 else rnd2.uniform(900, 1700) * taille
            if premiere is None:
                premiere = energie
            ld.energy = energie
            ld.keyframe_insert("energy", frame=f)


prolonger()

# ------------------------------------------------------------ le grain du sol
# Les touffes et les cailloux, loin des maisons et hors du chemin.
TOUFFE = lp.mat("Touffe", 0x46442F)
EMPRISES = [(x, y, 3.2) for (x, y), _, _ in maisons] + [(0.5, 16, 4.5)]


def libre(x, y):
    if abs(x) < 1.7 and -14 < y < 18:
        return False
    return all(math.hypot(x - ex, y - ey) > r for ex, ey, r in EMPRISES)


for _ in range(190):
    x, y = rnd2.uniform(-22, 22), rnd2.uniform(-12, 28)
    if not libre(x, y):
        continue
    z = altitude(x, y)
    for _ in range(3):
        dx, dy = rnd2.uniform(-0.25, 0.25), rnd2.uniform(-0.25, 0.25)
        t = lp.cone("Touffe", 0.055, rnd2.uniform(0.2, 0.38), (x + dx, y + dy, z - 0.03), TOUFFE, cotes=4)
        t.rotation_euler = (rnd2.uniform(-0.3, 0.3), rnd2.uniform(-0.3, 0.3), rnd2.uniform(0, 6))
for _ in range(45):
    x, y = rnd2.uniform(-20, 20), rnd2.uniform(-12, 26)
    if not libre(x, y):
        continue
    r = rnd2.uniform(0.08, 0.26)
    lp.boule("Caillou", r, (x, y, altitude(x, y) + r * 0.3), m["roche"], graine=rnd2.randrange(999), bosses=0.3)


# ------------------------------------------------------------------- la nuit
def ciel_nuageux(vers_lune):
    """Le ciel dans le shader du monde : un dégradé, des nappes de nuages, des étoiles
    là où il n'y a pas de nuage, et une lune voilée. Le fond garde la teinte du jet."""
    w = bpy.data.worlds.new("Nuit")
    scene.world = w
    try:
        w.use_nodes = True
    except Exception:
        pass
    nt = w.node_tree
    NN, L = nt.nodes.new, nt.links.new
    fond = nt.nodes["Background"]

    def brancher(socket, valeur):
        if isinstance(valeur, (int, float)):
            socket.default_value = valeur
        else:
            L(valeur, socket)

    def calc(op, a, b=None, c=None):
        n = NN("ShaderNodeMath")
        n.operation = op
        for i, v in enumerate((a, b, c)):
            if v is not None:
                brancher(n.inputs[i], v)
        return n.outputs[0]

    def plage(v, de, a, lisse=True):
        n = NN("ShaderNodeMapRange")
        n.interpolation_type = "SMOOTHSTEP" if lisse else "LINEAR"
        n.inputs["From Min"].default_value = de
        n.inputs["From Max"].default_value = a
        L(v, n.inputs["Value"])
        return n.outputs["Result"]

    def vecteur(op, a, b=None, echelle=None):
        n = NN("ShaderNodeVectorMath")
        n.operation = op
        L(a, n.inputs[0])
        if b is not None:
            brancher(n.inputs[1], b) if not isinstance(b, tuple) else setattr(n.inputs[1], "default_value", b)
        if echelle is not None:
            n.inputs["Scale"].default_value = echelle
        return n.outputs["Value"] if op == "DOT_PRODUCT" else n.outputs[0]

    def bruit_de(v, detail, rugosite):
        n = NN("ShaderNodeTexNoise")
        n.inputs["Scale"].default_value = 1.0
        n.inputs["Detail"].default_value = detail
        n.inputs["Roughness"].default_value = rugosite
        L(v, n.inputs["Vector"])
        return n.outputs["Fac"]

    def melange(fac, a, b, mode="MIX"):
        n = NN("ShaderNodeMix")
        n.data_type = "RGBA"
        n.blend_type = mode
        brancher(n.inputs[0], fac)
        for k, v in ((6, a), (7, b)):
            if isinstance(v, tuple):
                n.inputs[k].default_value = v
            else:
                L(v, n.inputs[k])
        return n.outputs[2]

    coord = NN("ShaderNodeTexCoord")
    direction = coord.outputs["Generated"]
    sep = NN("ShaderNodeSeparateXYZ")
    L(direction, sep.inputs[0])
    z = sep.outputs["Z"]

    # le fond : la teinte unie du jet, à peine plus claire à l'horizon
    rampe = NN("ShaderNodeValToRGB")
    r = rampe.color_ramp
    r.elements[0].position = 0.0
    r.elements[0].color = (0.036, 0.034, 0.046, 1)
    r.elements[1].position = 1.0
    r.elements[1].color = (0.008, 0.010, 0.022, 1)
    e = r.elements.new(0.35)
    e.color = (0.016, 0.018, 0.032, 1)
    L(plage(z, -0.05, 0.6, lisse=False), rampe.inputs["Fac"])
    fond_ciel = rampe.outputs["Color"]

    # les nuages : deux bruits, dont un plus fin pour les effilochures. Ils
    # tournent lentement sur un petit cercle (voir plus bas) : périodique, donc
    # la boucle ne les fait jamais sauter.
    cx = NN("ShaderNodeValue")
    cy = NN("ShaderNodeValue")
    cx.name, cy.name = "nuage_x", "nuage_y"
    derive = NN("ShaderNodeCombineXYZ")
    L(cx.outputs[0], derive.inputs["X"])
    L(cy.outputs[0], derive.inputs["Y"])
    d = vecteur("ADD", vecteur("SCALE", direction, echelle=2.6), derive.outputs[0])
    n1 = bruit_de(d, 5.0, 0.62)
    n2 = bruit_de(vecteur("SCALE", d, echelle=2.7), 3.0, 0.5)
    nc = calc("MULTIPLY_ADD", n1, 0.75, calc("MULTIPLY", n2, 0.25))
    horizon = plage(z, 0.0, 0.14)
    nuage = calc("MULTIPLY", plage(nc, 0.41, 0.58), horizon)

    # la lune, voilée : un disque qu'on devine, un halo qui traverse les nuages
    produit = vecteur("DOT_PRODUCT", direction, tuple(vers_lune))
    halo = calc("MULTIPLY", calc("POWER", calc("MAXIMUM", produit, 0.0), 28.0), 0.55)
    disque = plage(produit, math.cos(math.radians(1.7)), math.cos(math.radians(1.15)))
    lune = calc("MULTIPLY", calc("MULTIPLY", disque, calc("MULTIPLY_ADD", nuage, -0.85, 1.0)), 2.6)

    # les étoiles : le coeur des cellules d'un Voronoi, un tiers des cellules
    # seulement, cachées par les nuages et éteintes à l'horizon
    vor = NN("ShaderNodeTexVoronoi")
    vor.feature = "F1"
    vor.inputs["Scale"].default_value = 1.0
    L(vecteur("SCALE", direction, echelle=130.0), vor.inputs["Vector"])
    coeur = plage(vor.outputs["Distance"], 0.17, 0.04)
    sepc = NN("ShaderNodeSeparateColor")
    L(vor.outputs["Color"], sepc.inputs["Color"])
    rouge = sepc.outputs["Red"]
    eclat = calc("MULTIPLY", calc("MULTIPLY", coeur, plage(rouge, 0.72, 0.79)), calc("MULTIPLY_ADD", rouge, 1.2, 0.3))
    sans_nuage = calc("MULTIPLY_ADD", nuage, -1.0, 1.0)
    etoiles = calc("MULTIPLY", calc("MULTIPLY", calc("MULTIPLY", eclat, sans_nuage), horizon), 2.2)

    # l'assemblage
    couleur_nuage = melange(halo, (0.042, 0.045, 0.062, 1), (0.16, 0.16, 0.19, 1))
    ciel = melange(nuage, fond_ciel, couleur_nuage)
    ciel = melange(calc("MULTIPLY", halo, calc("MULTIPLY_ADD", nuage, -0.5, 1.0)), ciel, (0.12, 0.11, 0.14, 1), "ADD")
    ciel = melange(etoiles, ciel, (0.85, 0.90, 1.0, 1), "ADD")
    ciel = melange(lune, ciel, (0.80, 0.82, 0.90, 1), "ADD")
    if args.ciel != "tout":
        ciel = {"fond": fond_ciel, "nuages": nuage, "etoiles": etoiles, "lune": lune}[args.ciel]
    # ⚠️ Seule la caméra voit ce ciel. Pour la lumière, le monde est **noir** :
    # dans le jet, le volume de monde infini avalait toute la lumière ambiante,
    # et c'est ce qui faisait sa nuit — mesuré : à 0,015 d'ambiance, un mur
    # passait de 10 à 20 sur 255. Les feux et le clair de lune font tout le reste.
    chemin = NN("ShaderNodeLightPath")
    L(melange(chemin.outputs["Is Camera Ray"], (0.0, 0.0, 0.0, 1), ciel), fond.inputs["Color"])
    fond.inputs["Strength"].default_value = 1.0

    # brume dans l'air, qui accroche la lueur des feux (le jet, tel quel)
    if not args.sans_brume:
        brume()

    # la dérive des nuages : un petit cercle parcouru en une boucle (96 images)
    # (posée après le reste pour ne rien changer à l'ordre des nœuds ci-dessus)
    for f in range(1, TOTAL + 2, 4):
        theta = math.tau * (f - 1) / BOUCLE
        cx.outputs[0].default_value = 0.08 * math.cos(theta)
        cy.outputs[0].default_value = 0.08 * math.sin(theta)
        cx.outputs[0].keyframe_insert("default_value", frame=f)
        cy.outputs[0].keyframe_insert("default_value", frame=f)
    try:
        for fc in nt.animation_data.action.fcurves:
            for k in fc.keyframe_points:
                k.interpolation = "LINEAR"
    except AttributeError:
        pass
    return w


def brume():
    """La brume du jet (même densité, même teinte), mais dans une **boîte** posée sur
    le village et non dans le monde.

    ⚠️ Un volume de monde avale tout le fond sous EEVEE 5.2, fini ou pas : le ciel
    du jet n'a jamais été que ce brouillard. Une boîte, elle, s'arrête, et le ciel
    passe au-dessus et derrière."""
    mt = bpy.data.materials.new("Brume")
    try:
        mt.use_nodes = True
    except Exception:
        pass
    nt = mt.node_tree
    nt.nodes.clear()
    vol = nt.nodes.new("ShaderNodeVolumePrincipled")
    vol.inputs["Density"].default_value = 0.0025
    vol.inputs["Color"].default_value = (0.35, 0.3, 0.28, 1)
    sortie = nt.nodes.new("ShaderNodeOutputMaterial")
    nt.links.new(vol.outputs["Volume"], sortie.inputs["Volume"])
    o = lp.boite("Brume", (110, 100, 26), (0, 14, 12), mt)
    o.visible_shadow = False
    return o


lune = lp.soleil(energie=0.25, rot=(55, 20, 150))
lune.data.color = (0.55, 0.65, 1.0)
# la lune du ciel est posée bas, à droite du clocher : c'est elle qu'on voit, voilée
ciel_nuageux(Vector((math.sin(math.radians(16)) * math.cos(math.radians(11)),
                     math.cos(math.radians(16)) * math.cos(math.radians(11)),
                     math.sin(math.radians(11)))).normalized())

# ------------------------------------------------------------------- caméra
cd = bpy.data.cameras.new("Camera")
cam = bpy.data.objects.new("Camera", cd)
scene.collection.objects.link(cam)
scene.camera = cam
cd.lens = 35
cd.dof.use_dof = True
cd.dof.aperture_fstop = 2.8
cible = bpy.data.objects.new("Cible", None)
scene.collection.objects.link(cible)
cd.dof.focus_object = cible
contrainte = cam.constraints.new("TRACK_TO")
contrainte.target = cible
contrainte.track_axis = "TRACK_NEGATIVE_Z"
contrainte.up_axis = "UP_Y"
# travelling lent : on arrive par la palissade brisée, on monte vers l'église ;
# après l'image 216 la caméra reste là (pas de clé : elle ne bouge plus)
for f, pos, vise in ((1, (-2.0, -24, 2.2), (0, 2, 2.0)),
                     (N, (0.8, -13.5, 5.0), (0.5, 15, 4.5))):
    cam.location = pos
    cam.keyframe_insert("location", frame=f)
    cible.location = vise
    cible.keyframe_insert("location", frame=f)
for ob in (cam, cible):
    if ob.animation_data and ob.animation_data.action:
        try:
            for fc in ob.animation_data.action.fcurves:
                for k in fc.keyframe_points:
                    k.interpolation = "SINE"
        except AttributeError:
            pass


# ------------------------------------------------------------------- vignette
def vignette():
    """Les bords s'assombrissent : c'est ce qui enferme l'image, sans rien ajouter dedans."""
    ng = bpy.data.node_groups.new("Composition", "CompositorNodeTree")
    scene.compositing_node_group = ng
    scene.render.use_compositing = True
    ng.interface.new_socket("Image", in_out="OUTPUT", socket_type="NodeSocketColor")
    couches = ng.nodes.new("CompositorNodeRLayers")
    couches.scene = scene
    masque = ng.nodes.new("CompositorNodeEllipseMask")
    masque.inputs["Size"].default_value = (0.94, 0.86)
    flou = ng.nodes.new("CompositorNodeBlur")
    flou.inputs["Size"].default_value = (170, 170)
    ng.links.new(masque.outputs["Mask"], flou.inputs["Image"])
    attenuation = ng.nodes.new("ShaderNodeMath")
    attenuation.operation = "MULTIPLY_ADD"
    attenuation.inputs[1].default_value = 0.6
    attenuation.inputs[2].default_value = 0.4
    ng.links.new(flou.outputs["Image"], attenuation.inputs[0])
    gris = ng.nodes.new("CompositorNodeCombineColor")
    for canal in ("Red", "Green", "Blue"):
        ng.links.new(attenuation.outputs[0], gris.inputs[canal])
    produit = ng.nodes.new("ShaderNodeMix")
    produit.data_type = "RGBA"
    produit.blend_type = "MULTIPLY"
    produit.inputs[0].default_value = 1.0
    ng.links.new(couches.outputs["Image"], produit.inputs[6])
    ng.links.new(gris.outputs[0], produit.inputs[7])
    sortie = ng.nodes.new("NodeGroupOutput")
    ng.links.new(produit.outputs[2], sortie.inputs[0])


if not args.sans_vignette:
    vignette()

# ------------------------------------------------------------------- rendu
lp.eevee(scene)
scene.render.resolution_x, scene.render.resolution_y = RES
scene.render.resolution_percentage = 100
scene.view_settings.view_transform = "Standard"
scene.eevee.taa_render_samples = args.samples
scene.eevee.volumetric_tile_size = "4"
scene.eevee.volumetric_start = 0.5
scene.eevee.volumetric_end = 90
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGB"
scene.render.image_settings.compression = 40

if args.still:
    os.makedirs(TMP, exist_ok=True)
    for f in args.still:
        scene.frame_set(f)
        scene.render.filepath = os.path.join(TMP, f"still-{f:03d}.png")
        bpy.ops.render.render(write_still=True)
        print(f"[intro] image {f} -> {scene.render.filepath}")
if args.anim:
    dossier = os.path.join(TMP, "frames")
    os.makedirs(dossier, exist_ok=True)
    debut, fin = (int(v) for v in args.frames.split("-"))
    scene.frame_start, scene.frame_end = debut, fin
    scene.render.filepath = os.path.join(dossier, "f_")
    bpy.ops.render.render(animation=True)
    print(f"[intro] images {debut}-{fin} -> {dossier}")
