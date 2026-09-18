"""Les objets du monde en low-poly, et la vue du jeu (bloc 7z, étage 6).

Importé par `rendre.py`, qui tourne **dans Blender**. Rien ici ne choisit de
couleur : chaque pièce porte le **nom d'une matière** de la palette du jeu
(`palette.json`), et `reduire.py` repeint le rendu avec ses tons.

Échelle : 1 unité Blender = 10,5 px du jeu, donc une case de 32 px = 3,05 unités.
Le sol est le plan z = 0, le nord est +Y, la façade regarde le sud (-Y).
"""
import math
import random

import bmesh
import bpy
from mathutils import Matrix

PX_PAR_UNITE = 10.5
CASE = 32 / PX_PAR_UNITE

# Le biais léger, validé sur planche le 18 septembre 2026 : ce qui est au fond
# de l'emprise glisse vers la droite de 0,3 par unité de profondeur, donc on voit
# le flanc droit. Les verticales restent verticales et la façade reste
# horizontale : le bâtiment tient toujours sur ses cases, il n'est jamais posé
# en diagonale.
BIAIS = 0.3

# La caméra du jeu : orthographique, penchée de 55° depuis la verticale.
INCLINAISON = math.radians(55)


# ------------------------------------------------------------------ la vue
def projection_du_jeu(y_devant=0.0):
    """La cisaille du biais : x += BIAIS * (y - y_devant). Le bord sud ne bouge pas.

    ⚠️ Essayé et refusé le 18 septembre 2026 : décaler selon la **hauteur**
    (x += k * z) raccorde mieux les cases entre elles, mais penche toutes les
    verticales — les maisons avaient l'air de tomber.
    """
    return Matrix(((1, BIAIS, 0, -BIAIS * y_devant), (0, 1, 0, 0), (0, 0, 1, 0), (0, 0, 0, 1)))


def axes_camera():
    """La direction de visée et le « haut » de l'image, dans le monde."""
    from mathutils import Vector
    vise = Vector((0, math.sin(INCLINAISON), -math.cos(INCLINAISON)))
    haut = Vector((0, math.cos(INCLINAISON), math.sin(INCLINAISON)))
    return vise, haut


# ------------------------------------------------------------- les briques
class Atelier:
    """Fabrique des pièces nommées par matière, et les range sous une racine."""

    def __init__(self):
        self.pieces = []
        self._mats = {}

    def mat(self, nom):
        if nom not in self._mats:
            m = bpy.data.materials.new(nom)
            m["matiere"] = nom
            self._mats[nom] = m
        return self._mats[nom]

    def _objet(self, nom, bm, matiere, pos=(0, 0, 0), echelle=(1, 1, 1), rot=(0, 0, 0)):
        me = bpy.data.meshes.new(nom)
        bm.to_mesh(me)
        bm.free()
        me.materials.append(self.mat(matiere))
        o = bpy.data.objects.new(nom, me)
        bpy.context.scene.collection.objects.link(o)
        o.location, o.scale, o.rotation_euler = pos, echelle, rot
        self.pieces.append(o)
        return o

    def boite(self, matiere, taille, pos, rot=(0, 0, 0)):
        bm = bmesh.new()
        bmesh.ops.create_cube(bm, size=1.0)
        return self._objet("Boite", bm, matiere, pos, taille, rot)

    def maillage(self, matiere, verts, faces):
        bm = bmesh.new()
        vs = [bm.verts.new(v) for v in verts]
        for f in faces:
            bm.faces.new([vs[i] for i in f])
        return self._objet("Maillage", bm, matiere)

    def cone(self, matiere, r, h, pos, cotes=6, r_haut=0.0, rot_z=0.0):
        bm = bmesh.new()
        bmesh.ops.create_cone(bm, cap_ends=True, segments=cotes, radius1=r, radius2=r_haut,
                              depth=h)
        return self._objet("Cone", bm, matiere, (pos[0], pos[1], pos[2] + h / 2),
                           rot=(0, 0, rot_z))

    def boule(self, matiere, r, pos, graine, bosses=0.18, echelle=(1, 1, 1)):
        bm = bmesh.new()
        bmesh.ops.create_icosphere(bm, subdivisions=1, radius=r)
        rnd = random.Random(graine)
        for v in bm.verts:
            v.co *= 1 + rnd.uniform(-bosses, bosses)
        return self._objet("Boule", bm, matiere, pos, echelle)

    def branche(self, matiere, depart, arrivee, r):
        """Un cylindre à 5 pans entre deux points : tronc mort, branche, perche."""
        dx, dy, dz = (arrivee[i] - depart[i] for i in range(3))
        long = math.sqrt(dx * dx + dy * dy + dz * dz)
        bm = bmesh.new()
        bmesh.ops.create_cone(bm, cap_ends=True, segments=5, radius1=r, radius2=r * 0.55,
                              depth=long)
        o = self._objet("Branche", bm, matiere,
                        tuple((depart[i] + arrivee[i]) / 2 for i in range(3)))
        o.rotation_mode = "QUATERNION"
        from mathutils import Vector
        o.rotation_quaternion = Vector((dx, dy, dz)).to_track_quat("Z", "Y")
        return o

    # -- morceaux d'architecture
    def toit(self, matiere, cx, L, P, h, faite, deb=0.2, ep=0.1):
        v = [(cx - L/2 - deb, -P/2 - deb, h), (cx + L/2 + deb, -P/2 - deb, h),
             (cx + L/2 + deb, P/2 + deb, h), (cx - L/2 - deb, P/2 + deb, h),
             (cx - L/2 - deb, 0, h + faite), (cx + L/2 + deb, 0, h + faite)]
        o = self.maillage(matiere, v, [(0, 1, 5, 4), (2, 3, 4, 5), (0, 4, 3), (1, 2, 5)])
        o.modifiers.new("Epaisseur", "SOLIDIFY").thickness = ep
        return o

    def pignons(self, matiere, cx, L, P, h, faite):
        v = [(cx - L/2, -P/2, h), (cx - L/2, P/2, h), (cx - L/2, 0, h + faite - 0.04),
             (cx + L/2, -P/2, h), (cx + L/2, P/2, h), (cx + L/2, 0, h + faite - 0.04)]
        return self.maillage(matiere, v, [(0, 1, 2), (3, 5, 4)])

    def racine(self, nom="Objet", y_devant=0.0):
        """Range toutes les pièces sous la projection du jeu."""
        r = bpy.data.objects.new(nom, None)
        bpy.context.scene.collection.objects.link(r)
        proj = projection_du_jeu(y_devant)
        for o in self.pieces:
            if o.parent is None:
                o.parent = r
                o.matrix_parent_inverse = proj
        return r


def agrandir(a, facteur):
    """Agrandit tout ce qui a été fabriqué, autour du pied (0, 0, 0)."""
    for o in a.pieces:
        o.location = o.location * facteur
        o.scale = o.scale * facteur


# ------------------------------------------------------------------ objets
# Chaque fabrique renvoie le point du sol qui doit tomber sur le « pied » du
# sprite dans le jeu : le milieu du bord sud de l'emprise.

def maison(a, variante=0, annexe=False):
    L, P, H, F = 3.4, 2.2, 1.7, 1.1
    a.boite("toile", (L, P, H), (0, 0, H / 2))
    a.toit("ardoise", 0, L, P, H, F)
    a.pignons("toile", 0, L, P, H, F)
    yF, E = -P / 2 - 0.03, 0.13
    for x in (-L/2 + E/2, 0.0, L/2 - E/2):
        a.boite("bois", (E, 0.06, H), (x, yF, H / 2))
    a.boite("bois", (L, 0.06, E), (0, yF, H - E / 2))
    a.boite("bois", (L, 0.06, E), (0, yF, E / 2))
    # le flanc droit, qu'on voit en biais : un poteau et une sablière
    a.boite("bois", (0.06, E, H), (L/2 + 0.03, 0, H / 2))
    a.boite("bois", (0.06, P, E), (L/2 + 0.03, 0, H - E / 2))
    # la croix de Saint-André, qui change de panneau selon la variante
    cote = -1 if variante % 2 == 0 else 1
    cx = cote * L / 4
    ang = math.atan2(H - 0.3, L / 2 - 0.3)
    for s in (1, -1):
        a.boite("bois", (math.hypot(L/2 - 0.3, H - 0.3), 0.06, E), (cx, yF, H / 2),
                rot=(0, s * ang, 0))
    px = -cx
    a.boite("trou", (0.62, 0.08, 1.05), (px - 0.3 * cote, yF - 0.01, 0.53))
    a.boite("trou", (0.45, 0.08, 0.38), (px + 0.45 * cote, yF - 0.01, 1.2))
    a.boite("trou", (0.08, 0.45, 0.38), (L/2 + 0.05, -0.45, 1.1))
    cheminee_x = [1.0, -1.1, 0.6][variante % 3]
    a.boite("pierre", (0.42, 0.42, 1.1), (cheminee_x, 0.45, H + 0.85))
    if annexe:
        # l'appentis du fermier, en planches, contre le pignon droit
        La, Pa, Ha = 1.5, 1.9, 1.15
        xa = L / 2 + La / 2
        a.boite("bois", (La, Pa, Ha), (xa, -0.15, Ha / 2))
        v = [(xa - La/2, -0.15 - Pa/2 - 0.15, Ha), (xa + La/2 + 0.15, -0.15 - Pa/2 - 0.15, Ha),
             (xa + La/2 + 0.15, -0.15 + Pa/2, Ha + 0.55), (xa - La/2, -0.15 + Pa/2, Ha + 0.55)]
        a.maillage("ardoise", v, [(0, 1, 2, 3)]).modifiers.new("E", "SOLIDIFY").thickness = 0.08
        a.boite("trou", (0.8, 0.08, 0.85), (xa, -0.15 - Pa/2 - 0.02, 0.43))
        for i in range(3):
            a.boite("bois", (0.35, 0.35, 0.3), (xa + 0.9, -0.8 + i * 0.4, 0.15))
        return (0.5, -P / 2)
    return (0, -P / 2)


def maison_ruine(a, variante=0):
    """Ce qu'il reste d'une maison : les murs éventrés, plus de toit, des poutres
    noircies et les ardoises tombées. Même emprise, même pied que la maison
    debout — on la relève au même endroit (§4.24)."""
    L, P, H = 3.4, 2.2, 1.7
    rnd = random.Random(variante)
    # la dalle et la souche de cheminée : ce que le feu ne prend pas
    a.boite("pierre", (L + 0.2, P + 0.2, 0.14), (0, 0, 0.07))
    a.boite("pierre", (0.42, 0.42, 1.35), ([1.0, -1.1, 0.6][variante % 3], 0.45, 0.14 + 0.67))
    # le pignon gauche, cassé en biseau ; le mur du fond, à moitié ; la façade, basse
    hg = 0.9 + rnd.uniform(-0.15, 0.2)
    a.boite("toile", (0.16, P, hg), (-L/2 + 0.08, 0, 0.14 + hg / 2))
    a.boite("toile", (0.16, P * 0.45, 1.25), (-L/2 + 0.08, P * 0.27, 0.14 + 0.62))
    a.boite("toile", (L * 0.62, 0.16, 1.15), (-L * 0.19, P/2 - 0.08, 0.14 + 0.57))
    a.boite("toile", (L, 0.16, 0.42), (0, -P/2 + 0.08, 0.14 + 0.21))
    a.boite("toile", (0.16, P * 0.5, 0.55), (L/2 - 0.08, -P * 0.25, 0.14 + 0.27))
    # les poteaux de la façade, calcinés : un debout, un cassé
    yF = -P / 2 - 0.03
    a.boite("fer", (0.13, 0.08, 1.1), (-L/2 + 0.07, yF, 0.14 + 0.55))
    a.boite("fer", (0.13, 0.08, 0.5), (L/2 - 0.07, yF, 0.14 + 0.25))
    # deux poutres du toit, tombées en travers, et une qui tient encore au pignon
    a.boite("fer", (2.1, 0.11, 0.11), (0.1, 0.2, 0.14 + 0.32), rot=(0, 0.22, 0.5))
    a.boite("fer", (1.6, 0.11, 0.11), (0.5, -0.4, 0.14 + 0.2), rot=(0, 0.1, -0.35))
    a.boite("fer", (0.11, 0.11, 1.7), (-L/2 + 0.35, 0.1, 0.14 + 0.7), rot=(0.3, 0.55, 0))
    # les ardoises tombées, à plat ou de guingois
    for i in range(4):
        x = rnd.uniform(-L/2 + 0.4, L/2 - 0.4)
        y = rnd.uniform(-P/2 + 0.3, P/2 - 0.3)
        a.boite("ardoise", (0.55, 0.4, 0.06), (x, y, 0.14 + 0.05), rot=(0, 0, rnd.uniform(-0.8, 0.8)))
    # les gravats
    for i in range(5):
        x = rnd.uniform(-L/2 + 0.2, L/2 - 0.2)
        y = rnd.uniform(-P/2 + 0.2, P/2 - 0.2)
        a.boule("pierre", rnd.uniform(0.12, 0.22), (x, y, 0.14 + 0.1), graine=variante * 7 + i, bosses=0.3)
    return (0, -P / 2)


def eglise(a, niveau=1):
    """La nef en pierre, et un clocher qui monte à chaque niveau (§4.22)."""
    L, P, H, F = 3.6, 2.3, 1.9, 1.2
    xn = 0.55
    a.boite("pierre", (L, P, H), (xn, 0, H / 2))
    a.toit("toit_eglise", xn, L, P, H, F)
    a.pignons("pierre", xn, L, P, H, F)
    yF = -P / 2 - 0.03
    for x in (xn - 0.6, xn + 0.5, xn + 1.4):
        a.boite("trou", (0.28, 0.08, 0.75), (x, yF, 1.1))
    for x in (xn - 0.05, xn + 0.95):
        a.boite("pierre", (0.2, 0.25, 1.2), (x, yF - 0.1, 0.6))
    # le clocher : 2,3 unités au niveau 1, puis +0,55 par niveau
    c = 1.25
    hc = 2.3 + (niveau - 1) * 0.55
    xc = xn - L / 2 - c / 2 + 0.25
    yc = -P / 2 + c / 2 - 0.1
    a.boite("pierre", (c, c, hc), (xc, yc, hc / 2))
    a.boite("trou", (0.55, 0.08, 0.9), (xc, yc - c / 2 - 0.03, 0.45))
    if niveau >= 2:
        a.boite("trou", (0.35, 0.08, 0.5), (xc, yc - c / 2 - 0.03, hc - 0.55))
    if niveau >= 3:
        a.boite("pierre", (c + 0.15, c + 0.15, 0.15), (xc, yc, hc - 0.05))
    fleche = 0.9 + 0.2 * niveau
    a.cone("toit_eglise", c * 0.74, fleche, (xc, yc, hc), cotes=4, rot_z=math.pi / 4)
    top = hc + fleche
    a.boite("laiton", (0.07, 0.07, 0.5), (xc, yc, top + 0.2))
    a.boite("laiton", (0.3, 0.07, 0.07), (xc, yc, top + 0.3))
    # le pied est décalé vers le clocher pour que le tout soit centré sur
    # l'église du jeu, flanc droit et ombre compris
    return (0.8, -P / 2)


def chene(a, graine):
    rnd = random.Random(graine)
    a.cone("ecorce", 0.24, 1.25, (0, 0, 0), cotes=5, r_haut=0.15)
    for i in range(3):
        a.boule("feuille", rnd.uniform(0.62, 0.8),
                (rnd.uniform(-0.35, 0.35), rnd.uniform(-0.2, 0.2), 1.55 + rnd.uniform(0, 0.4)),
                graine * 7 + i)
    return (0, 0)


def conifere(a, graine):
    rnd = random.Random(graine)
    a.cone("ecorce", 0.14, 0.6, (0, 0, 0), cotes=5)
    etages = 3 + graine % 2
    for i in range(etages):
        r = 0.85 - i * 0.18
        a.cone("feuille", r, 1.0 - i * 0.08, (0, 0, 0.35 + i * 0.62), cotes=7,
               rot_z=rnd.uniform(0, 1))
    return (0, 0)


def arbre_mort(a, graine):
    rnd = random.Random(graine + 100)
    haut = rnd.uniform(2.2, 2.8)
    penche = rnd.uniform(-0.25, 0.25)
    a.branche("ecorce", (0, 0, 0), (penche, 0, haut), 0.2)
    for i in range(3 + graine % 2):
        z = haut * rnd.uniform(0.45, 0.9)
        cote = -1 if i % 2 == 0 else 1
        dx = cote * rnd.uniform(0.5, 0.9)
        a.branche("ecorce", (penche * z / haut, 0, z),
                  (penche * z / haut + dx, rnd.uniform(-0.2, 0.2), z + rnd.uniform(0.4, 0.8)),
                  0.08)
    return (0, 0)


def rocher(a, graine):
    rnd = random.Random(graine + 50)
    a.boule("roche", 0.75, (0, 0, 0.25), graine + 3, bosses=0.28,
            echelle=(1.2, 0.85, 0.65))
    if graine % 2 == 0:
        a.boule("roche", 0.38, (rnd.uniform(0.6, 0.8), -0.2, 0.12), graine + 9, bosses=0.3)
    return (0, -0.55)


def souche(a, graine=0):
    a.cone("ecorce", 0.3, 0.45, (0, 0, 0), cotes=6, r_haut=0.26)
    a.branche("ecorce", (0.2, 0, 0.05), (0.55, -0.1, 0.02), 0.07)
    return (0, 0)
