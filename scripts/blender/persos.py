"""Les personnages en low-poly : heros et monstres, poses et rendus image par image.

    blender -b -P scripts/blender/persos.py                -> toutes les familles
    blender -b -P scripts/blender/persos.py -- hero-mage   -> celles dont la cle commence ainsi

Pour chaque famille (`hero-<classe>-p<palier>`, `monstre-<archetype>`), chaque
geste et chaque frame, deux images en x8 dans `.tmp/blender/persos/` — la
passe des matieres et la passe de lumiere, comme `rendre.py` — et un JSON par
famille qui dit la taille du cadre, le pied, et ou tombe chaque geste. C'est
`planche_persos.py` qui reduit tout ca a la taille du jeu.

Le corps humain est **un seul rig**, comme `corps.ts` : des boites parentees a
des articulations vides (hanches, epaules, cou), et une pose est un jeu
d'angles. Un heros n'est qu'un villageois qui porte une arme ; un revenant, un
humain aux os. Les betes sont un second rig, a quatre ou six pattes.

Rien ici ne choisit de couleur : chaque piece porte le nom d'une matiere de
`palette.json`, et la reduction repeint. Le personnage regarde vers +X (la
droite de l'ecran) ; le jeu retourne le sprite pour l'autre sens.
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
import rendre  # noqa: E402

TMP = os.path.join(rendre.TMP, "persos")
os.makedirs(TMP, exist_ok=True)

# Un pixel du jeu, en unites Blender : tout le rig est ecrit en pixels du jeu.
P = 1.0 / monde.PX_PAR_UNITE

# Les cadres de `corps.ts` et `monstres.ts` : 20 px pour un humain et une bete
# ordinaire, 30 pour une grosse bete. Le sol tombe trois pixels au-dessus du
# bord bas, le milieu un pixel a gauche du centre.
CADRE = 20
CADRE_GROS = 30


def cadre_de(taille):
    return {"taille": taille, "pied": taille - 3, "ancre": taille / 2 - 1}


# --------------------------------------------------------------- les gestes
# Les memes que `heros.ts` et `monstres.ts` : cle, frames, boucle.
GESTES_HUMAIN = [
    ("repos", 4, True), ("marche", 6, True), ("attaque", 5, False), ("charge", 4, False),
    ("incantation", 6, False), ("touche", 3, False), ("mort", 6, False), ("toux", 4, False),
]
GESTES_BETE = [
    ("repos", 4, True), ("marche", 6, True), ("attaque", 5, False), ("charge", 4, False),
    ("touche", 3, False), ("mort", 6, False),
]


def avancement(frames, boucle, i):
    pas = frames if boucle else max(1, frames - 1)
    return i / pas


def lisse(t):
    return t * t * (3 - 2 * t)


# ------------------------------------------------------------------ le rig
class Rig:
    """Des articulations vides et des pieces parentees dessous."""

    def __init__(self, atelier):
        self.a = atelier
        self.joints = {}

    def joint(self, nom, pos, parent=None):
        e = bpy.data.objects.new(nom, None)
        bpy.context.scene.collection.objects.link(e)
        e.location = Vector(pos)
        if parent is not None:
            e.parent = self.joints[parent]
        else:
            # une racine : `racine()` la placera sous la projection du jeu
            self.a.pieces.append(e)
        e.rotation_mode = "XYZ"
        self.joints[nom] = e
        return e

    def piece(self, matiere, taille, pos, parent, rot=(0, 0, 0)):
        o = self.a.boite(matiere, tuple(t * P for t in taille), tuple(p * P for p in pos), rot)
        o.parent = self.joints[parent]
        self.a.pieces.remove(o)
        return o

    def boule(self, matiere, r, pos, parent, graine=1, bosses=0.12, echelle=(1, 1, 1)):
        o = self.a.boule(matiere, r * P, tuple(p * P for p in pos), graine, bosses, echelle)
        o.parent = self.joints[parent]
        self.a.pieces.remove(o)
        return o

    def cone(self, matiere, r, h, pos, parent, cotes=5):
        o = self.a.cone(matiere, r * P, h * P, tuple(p * P for p in pos), cotes)
        o.parent = self.joints[parent]
        self.a.pieces.remove(o)
        return o

    def tourner(self, nom, x=0.0, y=0.0, z=0.0):
        self.joints[nom].rotation_euler = (x, y, z)

    def placer(self, nom, pos):
        self.joints[nom].location = Vector(tuple(p * P for p in pos))


# ---------------------------------------------------------------- l'humain
ARMES = {
    "guerrier": "epee", "chevalier": "epee-bouclier", "mage": "baton", "assassin": "dague",
    "rodeur": "arc", "oracle": "sceptre", "necromancien": "baton-os",
}

# Les paliers de `heros.ts` : casque des 1, plastron des 2, cape des 3, laiton des 4.
CASQUE_DES, PLASTRON_DES, CAPE_DES, LAITON_DES = 1, 2, 3, 4


def humain(rig, tunique, jambes="tissu", peau="chair", coiffe=None, plastron=False, cape=None,
           laiton=False, arme=None, bouclier=False, voute=0.0, ventre=None, sang=False):
    """Le corps de `corps.ts`, en pixels du jeu : hanche a 4,4, epaule a 8,8, tete a 12.

    `ventre` est le tablier d'un villageois (sa matiere), `sang` une tache sur la tunique.
    """
    HANCHE, EPAULE, COU = 4.4, 8.8, 0.8
    rig.joint("racine", (0, 0, 0))
    rig.joint("bassin", (0, 0, HANCHE * P), "racine")
    # les jambes : pivot a la hanche, elles pendent
    for cote, y in (("avant", -1.3), ("arriere", 1.3)):
        rig.joint(f"jambe_{cote}", (0, y * P, 0), "bassin")
        rig.piece(jambes, (2.2, 2.2, HANCHE), (0, 0, -HANCHE / 2), f"jambe_{cote}")
        rig.piece(jambes, (2.8, 2.4, 1.0), (0.4, 0, -HANCHE + 0.5), f"jambe_{cote}")
    # le buste : pivot au bassin, il se penche
    rig.joint("buste", (0, 0, 0), "bassin")
    if ventre:
        # Le tablier **est** le haut du buste, et pas son bas comme `corps.ts`.
        #
        # ⚠️ Trois essais avant celui-la, le 20 septembre 2026 au soir. Plaque
        # contre la face +X, il ne se voyait qu'en tranche de deux pixels : la
        # camera regarde depuis -Y, c'est le **flanc** du buste qu'elle voit.
        # Boite un peu plus grande que le buste, il ne depassait que de deux
        # dixiemes de pixel du jeu — rien une fois reduit. Piece empilee sous la
        # tunique, il tombait derriere le **bras avant**, qui pend a y = -4 donc
        # devant le torse et le masque jusqu'aux deux tiers de sa hauteur.
        #
        # Ce qui reste visible du torse, c'est donc son haut : le metier y monte.
        # Anatomiquement c'est un plastron plutot qu'un tablier ; a vingt pixels
        # ce qui compte est qu'on distingue un pecheur gris d'un forgeron rouge.
        # Plus de la moitie du buste, sinon la tunique sombre — l'autre moitie du
        # signalement — disparait entre la tete et les jambes.
        HAUT = (EPAULE - HANCHE) * 0.55
        rig.piece(tunique, (2.6, 6.2, EPAULE - HANCHE - HAUT), (0, 0, (EPAULE - HANCHE - HAUT) / 2), "buste")
        rig.piece(ventre, (2.6, 6.2, HAUT), (0, 0, EPAULE - HANCHE - HAUT / 2), "buste")
    else:
        rig.piece(tunique, (2.6, 6.2, EPAULE - HANCHE), (0, 0, (EPAULE - HANCHE) / 2), "buste")
    if sang:
        rig.piece("sang", (0.6, 2.4, 1.6), (1.5, -1.2, (EPAULE - HANCHE) * 0.6), "buste")
    if plastron:
        rig.piece("fer", (3.2, 5.9, 2.6), (0.1, 0, (EPAULE - HANCHE) / 2 - 0.2), "buste")
    if cape:
        rig.piece(cape, (0.7, 5.2, 7.5), (-1.7, 0, (EPAULE - HANCHE) / 2 - 1.6), "buste")
    # la tete : pivot au cou
    rig.joint("cou", (0, 0, (EPAULE - HANCHE) * P), "buste")
    rig.piece(peau, (3.0, 3.2, 3.0), (0.3, 0, COU + 1.5), "cou")
    # les cheveux : une calotte sombre, sans quoi la tete est une boule de chair
    if coiffe is None:
        rig.piece("tissu", (3.2, 3.4, 1.1), (0.0, 0, COU + 3.1), "cou")
    if coiffe == "casque":
        rig.piece("fer", (4.0, 4.0, 2.2), (0.2, 0, COU + 3.0), "cou")
        rig.piece("fer", (0.8, 4.0, 2.2), (2.1, 0, COU + 1.4), "cou")
        if laiton:
            rig.piece("laiton", (4.2, 1.2, 0.8), (0.2, 0, COU + 4.2), "cou")
    elif coiffe == "capuche":
        rig.piece(tunique, (4.0, 4.0, 2.4), (-0.2, 0, COU + 3.0), "cou")
    elif coiffe == "chapeau":
        # Le chapeau a bord plat des villageois : un disque et une calotte.
        # ⚠️ A 5,4 de bord pour une tete de 3,2, vu d'en haut il **cachait la
        # tete** et le villageois n'etait plus qu'un couvre-chef sur une masse
        # noire. Le bord depasse d'un demi-pixel de chaque cote, pas davantage,
        # et il coiffe la tete au lieu de flotter au-dessus.
        rig.piece("bois", (3.8, 4.0, 0.5), (0.2, 0, COU + 2.9), "cou")
        rig.piece("bois", (2.6, 2.8, 1.0), (0.2, 0, COU + 3.6), "cou")
    # les bras : pivot a l'epaule, ils pendent ; l'avant est le plus pres de la camera (-Y)
    for cote, y in (("avant", -4.0), ("arriere", 4.0)):
        rig.joint(f"bras_{cote}", (0, y * P, (EPAULE - HANCHE) * P - 0.5 * P), "buste")
        rig.piece(tunique, (2.0, 1.8, 2.2), (0, 0, -1.1), f"bras_{cote}")
        rig.piece(peau, (1.8, 1.6, 2.2), (0, 0, -3.2), f"bras_{cote}")
        rig.joint(f"main_{cote}", (0, 0, -4.3 * P), f"bras_{cote}")
    if arme:
        peindre_arme(rig, arme, laiton)
    if bouclier:
        rig.piece("fer", (0.8, 5.0, 5.5), (0.6, 0, -2.5), "bras_arriere")
        rig.piece("laiton" if laiton else "bois", (0.4, 1.6, 1.6), (1.1, 0, -2.5), "bras_arriere")


def peindre_arme(rig, arme, laiton):
    """L'arme, dans la main avant, dans le prolongement du bras (vers -Z au repos)."""
    m = "main_avant"
    garde = "laiton" if laiton else "fer"
    if arme in ("epee", "epee-bouclier"):
        rig.piece("fer", (0.9, 0.9, 5.5), (0, 0, -2.3), m)
        rig.piece(garde, (2.6, 1.0, 0.7), (0, 0, 0.6), m)
        rig.piece("bois", (1.0, 1.0, 1.6), (0, 0, 1.6), m)
    elif arme == "dague":
        rig.piece("fer", (0.8, 0.8, 4.0), (0, 0, -1.8), m)
        rig.piece(garde, (1.8, 0.9, 0.6), (0, 0, 0.5), m)
    elif arme == "baton":
        rig.piece("bois", (0.9, 0.9, 9.0), (0, 0, -0.5), m)
        rig.piece("laiton" if laiton else "pierre", (1.8, 1.8, 1.8), (0, 0, 4.2), m)
    elif arme == "sceptre":
        rig.piece("fer", (0.8, 0.8, 7.0), (0, 0, 0.5), m)
        rig.piece("laiton", (2.0, 2.0, 2.0), (0, 0, 4.2), m)
    elif arme == "baton-os":
        rig.piece("os", (0.9, 0.9, 8.5), (0, 0, -0.2), m)
        rig.piece("os", (2.2, 2.2, 2.2), (0, 0, 4.2), m)
    elif arme == "arc":
        # un arc : deux branches de bois en V ouvert et la corde
        rig.piece("bois", (0.7, 0.7, 4.0), (0.9, 0, 1.8), m, rot=(0, math.radians(-22), 0))
        rig.piece("bois", (0.7, 0.7, 4.0), (0.9, 0, -1.8), m, rot=(0, math.radians(22), 0))
        rig.piece("toile", (0.3, 0.3, 7.0), (-0.1, 0, 0), m)
    # Les outils des villageois (`villageois.ts`) : un manche, et une seule
    # chose au bout — a vingt pixels c'est cette chose-la qu'on lit.
    elif arme == "pioche":
        rig.piece("bois", (0.8, 0.8, 6.5), (0, 0, -1.5), m)
        rig.piece("fer", (3.6, 0.8, 0.9), (0.6, 0, -4.5), m, rot=(0, math.radians(12), 0))
    elif arme == "hache":
        rig.piece("bois", (0.8, 0.8, 6.0), (0, 0, -1.3), m)
        rig.piece("fer", (2.2, 0.7, 2.4), (1.2, 0, -3.6), m)
    elif arme == "houe":
        rig.piece("bois", (0.7, 0.7, 7.0), (0, 0, -1.8), m)
        rig.piece("fer", (2.2, 0.6, 1.4), (1.0, 0, -5.0), m, rot=(0, math.radians(40), 0))
    elif arme == "canne":
        rig.piece("bois", (0.6, 0.6, 8.0), (0, 0, -2.5), m)
        rig.piece("toile", (0.25, 0.25, 4.0), (1.2, 0, -6.0), m, rot=(0, math.radians(-30), 0))
    elif arme == "marteau":
        rig.piece("bois", (0.8, 0.8, 4.5), (0, 0, -0.8), m)
        rig.piece("fer", (1.6, 1.4, 2.6), (0.2, 0, -3.2), m)
    elif arme == "maillet":
        rig.piece("bois", (0.8, 0.8, 4.5), (0, 0, -0.8), m)
        rig.piece("bois", (2.4, 1.6, 1.8), (0.2, 0, -3.2), m)
    elif arme == "baton":
        rig.piece("bois", (0.7, 0.7, 7.5), (0, 0, -1.5), m)


def posture_humain(geste, t, voute=0.0):
    """La pose de `heros.ts`, en angles (radians, 0 vers le bas, positif vers l'avant)."""
    p = dict(buste=voute, tete=0.0, bras_avant=0.05, bras_arriere=-0.05, jambe_avant=0.0,
             jambe_arriere=0.0, sursaut=0.0, outil=True, couche=0.0)
    if geste == "repos":
        p["sursaut"] = -0.25 * math.sin(2 * math.pi * t)
        p["bras_avant"] = 0.12
    elif geste == "marche":
        b = math.sin(2 * math.pi * t)
        p.update(jambe_avant=b * 0.55, jambe_arriere=-b * 0.55, bras_avant=-b * 0.35,
                 bras_arriere=b * 0.35, sursaut=-abs(math.sin(2 * math.pi * t)) * 0.6)
    elif geste == "attaque":
        # l'arme part de derriere, fend vers l'avant, le coup au tiers-deux
        if t < 0.6:
            u = lisse(t / 0.6)
            p["bras_avant"] = -1.1 + 2.9 * u
        else:
            p["bras_avant"] = 1.8 - 1.5 * lisse((t - 0.6) / 0.4)
        p["bras_arriere"] = -0.4
        p["buste"] = voute + 0.32 * math.sin(math.pi * t)
        p["jambe_avant"] = 0.35
        p["jambe_arriere"] = -0.25
    elif geste == "charge":
        u = min(1.0, t * 2)
        p.update(buste=voute + 0.35 * u, bras_avant=-1.3 * u, bras_arriere=0.3 * u, sursaut=1.0 * u)
    elif geste == "incantation":
        u = lisse(min(1.0, t * 1.5))
        p.update(bras_avant=2.3 * u, bras_arriere=2.0 * u, buste=voute - 0.12 * u, tete=-0.25 * u,
                 sursaut=-0.4 * math.sin(math.pi * t))
    elif geste == "touche":
        p.update(buste=voute - 0.3, tete=-0.3, bras_avant=0.9, bras_arriere=-0.6, sursaut=-1.0 * (1 - t))
    elif geste == "mort":
        u = lisse(t)
        p.update(couche=math.radians(88) * u, bras_avant=0.6 * u, bras_arriere=0.3 * u,
                 tete=0.3 * u, buste=voute * (1 - u), outil=t < 0.5)
    elif geste == "toux":
        u = t / 0.3 if t < 0.3 else 1 - (t - 0.3) / 0.7
        p.update(buste=voute + 0.4 * u, tete=0.2 * u, bras_avant=2.5, bras_arriere=0.1, outil=False)
    elif geste == "travail":
        # le coup de pioche de `villageois.ts` : le bras monte jusqu'a la moitie
        # du geste, frappe jusqu'aux cinq sixiemes, et le sixieme est l'impact
        FIN_MONTEE, FIN_FRAPPE = 0.5, 5 / 6
        if t < FIN_MONTEE:
            u = lisse(t / FIN_MONTEE)
            p.update(bras_avant=0.3 - 2.5 * u, buste=voute - 0.15 * u)
        else:
            u = lisse(min(1.0, (t - FIN_MONTEE) / (FIN_FRAPPE - FIN_MONTEE)))
            p.update(bras_avant=-2.2 + 3.4 * u, buste=voute + 0.3 * u, sursaut=0.4 * u)
        p["bras_arriere"] = -0.2
        p["jambe_avant"] = 0.25
        p["jambe_arriere"] = -0.2
    return p


def poser_humain(rig, p):
    # les angles du jeu tournent autour de Y ; positif = vers +X (l'avant)
    rig.tourner("racine", y=-p["couche"])
    # en tombant, le corps glisse vers l'avant pour rester dans son carreau
    rig.placer("racine", (6.0 * p["couche"] / math.radians(88), 0, -p["sursaut"]))
    rig.tourner("buste", y=-p["buste"])
    rig.tourner("cou", y=-p["tete"])
    rig.tourner("bras_avant", y=-p["bras_avant"])
    rig.tourner("bras_arriere", y=-p["bras_arriere"])
    rig.tourner("jambe_avant", y=-p["jambe_avant"])
    rig.tourner("jambe_arriere", y=-p["jambe_arriere"])
    # l'arme se range quand on tousse, ou une fois tombe
    for o in rig.joints["main_avant"].children:
        o.hide_render = not p["outil"]


def tenue_de_hero(classe, palier):
    return dict(
        tunique=f"classe_{classe}",
        coiffe="casque" if palier >= CASQUE_DES else None,
        plastron=palier >= PLASTRON_DES,
        cape=f"classe_{classe}" if palier >= CAPE_DES else None,
        laiton=palier >= LAITON_DES,
        arme=ARMES[classe],
        bouclier=ARMES[classe] == "epee-bouclier",
    )


# ------------------------------------------------------------------ la bete
BETES = {
    # famille : corps (longueur, hauteur, matiere), pattes (nombre, longueur, epaisseur),
    # tete (rayon, museau), dos, queue, cadre
    "fonceur": dict(corps=(13, 7, "monstre"), pattes=(4, 6, 2), tete=(3.2, 3), dos="epines", queue=4, cadre=CADRE),
    "essaim": dict(corps=(8, 5, "monstre_pale"), pattes=(6, 5, 1), tete=(2.2, 2), dos="lisse", queue=0, cadre=CADRE),
    "cracheur": dict(corps=(12, 9, "monstre_bile"), pattes=(4, 3.5, 2.4), tete=(4, 4), dos="pustules", queue=0, cadre=CADRE),
    "brute": dict(corps=(18, 13, "monstre_fer"), pattes=(4, 8, 3.5), tete=(4.5, 2.5), dos="plaques", queue=0, cadre=CADRE_GROS),
    "kamikaze": dict(corps=(11, 11, "monstre_sang"), pattes=(4, 6, 1.2), tete=(2.6, 2), dos="pustules", queue=0, cadre=CADRE),
    # Les deux betes d'eau (§4.21) : elles ne sortent que la nuit de crue, et
    # elles sortent **de l'eau**, pas d'un front. Leur silhouette doit se lire a
    # ca, sans qu'on ait besoin de dire d'ou elles viennent.
    #
    # L'ecumeur : long, bas, presque pas de pattes — c'est un nageur. La queue
    # fait la moitie de sa longueur : elle dit comment il se deplace, et c'est
    # la seule chose qui le distingue d'un rodeur a la silhouette.
    # ⚠️ Premier jet a 16 de corps et 9 de queue : il **debordait du cadre**, et
    # deux images se touchaient sur la planche. Ramene a 11 + 5 — il reste le
    # plus long du bestiaire, ce qui suffit a dire le nageur.
    "ecumeur": dict(corps=(11, 6, "monstre_ecume"), pattes=(4, 3.5, 1.4), tete=(3, 4), dos="epines", queue=5, cadre=CADRE),
    # L'engloutisseur : large, lourd, beaucoup de pattes courtes. Il ne court
    # pas, il **traine** — et ce qu'il attrape, il le ramene.
    "engloutisseur": dict(corps=(16, 12, "monstre_fond"), pattes=(6, 4, 3.2), tete=(4.2, 3), dos="pustules", queue=4, cadre=CADRE_GROS),
}


def bete(rig, b):
    # Les nombres de `monstres.ts` sont en pixels d'un dessin de 32, ramenes au
    # cadre : une bete ordinaire tient dans 20, une grosse dans 30.
    # (et la brute, vue de trois quarts avec ses plaques, deborde encore : un peu plus petite)
    k = b["cadre"] / 32 * (0.82 if b["cadre"] == CADRE_GROS else 1.0)
    L, H, m = b["corps"][0] * k, b["corps"][1] * k, b["corps"][2]
    n, lp, ep = b["pattes"][0], b["pattes"][1] * k, max(0.9, b["pattes"][2] * k)
    rt, museau = b["tete"][0] * k, b["tete"][1] * k
    queue = b["queue"] * k
    flotte = b.get("flotte", False)
    yeux = b.get("yeux", "sang")
    rig.joint("racine", (0, 0, 0))
    # le corps : un ovoide, le ventre a la hauteur des pattes — ou en l'air, s'il flotte
    rig.joint("corps", (0, 0, ((3.0 if flotte else lp) + H * 0.45) * P), "racine")
    # ⚠️ L'echelle multiplie un rayon **deja** ramene au monde (`Rig.boule` fait
    # `r * P`) : la reprendre en `* P` divisait le corps par PX_PAR_UNITE et le
    # faisait disparaitre. Une bete n'avait plus que ses pattes, un familier rien.
    rig.boule(m, 1.0, (0, 0, 0), "corps", graine=3, bosses=0.1, echelle=(L / 2, H * 0.42, H / 2))
    # les pattes : pivot sous le corps, par paires le long de X ; rien si ca flotte
    paires = n // 2
    for k in range(paires):
        x = -L / 2 + L / (paires + 1) * (k + 1) - 0.5
        for cote, y in (("avant", -H * 0.28), ("arriere", H * 0.28)):
            nom = f"patte_{k}_{cote}"
            rig.joint(nom, (x * P, y * P, -H * 0.3 * P), "corps")
            if not flotte:
                rig.piece(m, (ep, ep, lp + 1), (0, 0, -(lp + 1) / 2 + 0.5), nom)
    # la tete : pivot a l'avant du corps ; une flamme n'en a pas, ses yeux sont sur le corps
    rig.joint("cou", ((L / 2 - 1) * P, 0, H * 0.1 * P), "corps")
    if rt > 0:
        rig.boule(m, rt, (rt * 0.6, 0, 0), "cou", graine=5, bosses=0.08)
        if museau > 0:
            rig.piece(m, (museau + 1, rt * 1.1, rt * 0.9), (rt * 0.6 + rt * 0.7 + museau / 2, 0, -rt * 0.15), "cou")
        # les yeux : le seul sang frais du monde (ou l'os et le laiton des familiers)
        rig.piece(yeux, (0.6, 0.7, 0.7), (rt * 0.9, -rt * 0.75, rt * 0.35), "cou")
        rig.piece(yeux, (0.6, 0.7, 0.7), (rt * 0.9, rt * 0.75, rt * 0.35), "cou")
    else:
        rig.piece(yeux, (0.6, 0.7, 0.7), (0.4, -L * 0.18, H * 0.15), "cou")
        rig.piece(yeux, (0.6, 0.7, 0.7), (0.4, L * 0.18, H * 0.15), "cou")
    # le dos
    if b["dos"] == "epines":
        for i in range(4):
            x = -L / 2 + 2.5 + i * (L - 5) / 3
            rig.cone("os", 0.6, 1.8, (x, 0, H / 2 - 0.5), "corps")
    elif b["dos"] == "plaques":
        for i in range(3):
            x = -L / 2 + 3 + i * (L - 6) / 2
            rig.piece("os", (L / 5, H * 0.34, 0.8), (x, 0, H / 2 - 0.6), "corps", rot=(0, math.radians(-8), 0))
    elif b["dos"] == "pustules":
        for i, (x, y) in enumerate(((-L / 4, -H * 0.2), (0, H * 0.25), (L / 5, -H * 0.1), (-L / 8, 0))):
            rig.boule("monstre_pale", 0.8, (x, y, H / 2 - 0.4), "corps", graine=i + 7, bosses=0.1)
    if queue > 0:
        rig.joint("queue", (-L / 2 * P, 0, H * 0.15 * P), "corps")
        rig.piece(m, (queue, 1.0, 1.0), (-queue / 2, 0, 0), "queue", rot=(0, math.radians(-20), 0))


def posture_bete(geste, t, b):
    n = b["pattes"][0]
    p = dict(pattes=[0.0] * (n // 2), corps_x=0.0, corps_z=0.0, tangage=0.0, cou=0.0, roulis=0.0, queue=0.0)
    if geste == "repos":
        p["corps_z"] = -0.3 * math.sin(2 * math.pi * t)
        p["queue"] = 0.3 * math.sin(2 * math.pi * t)
    elif geste == "marche":
        for k in range(n // 2):
            p["pattes"][k] = 0.6 * math.sin(2 * math.pi * t + k * math.pi)
        p["corps_z"] = -abs(math.sin(2 * math.pi * t)) * 0.5
        p["queue"] = 0.4 * math.sin(4 * math.pi * t)
    elif geste == "attaque":
        u = lisse(min(1.0, t / 0.6)) if t < 0.6 else 1 - lisse((t - 0.6) / 0.4)
        p.update(corps_x=1.8 * u, tangage=0.35 * u, cou=0.45 * u, corps_z=-0.6 * u)
        p["pattes"] = [0.5 * u if k % 2 == 0 else -0.4 * u for k in range(n // 2)]
    elif geste == "charge":
        u = min(1.0, t * 2)
        p.update(corps_x=-1.4 * u, tangage=-0.3 * u, cou=-0.2 * u, corps_z=0.5 * u)
    elif geste == "touche":
        p.update(corps_x=-1.6 * (1 - t), tangage=-0.2, cou=-0.3, corps_z=-0.5 * (1 - t))
    elif geste == "mort":
        u = lisse(t)
        p.update(roulis=math.radians(85) * u, corps_z=0.0, cou=0.4 * u)
        p["pattes"] = [0.5 * u * (1 if k % 2 else -1) for k in range(n // 2)]
    return p


def poser_bete(rig, p, b):
    k = b["cadre"] / 32 * (0.82 if b["cadre"] == CADRE_GROS else 1.0)
    lp, H = b["pattes"][1] * k, b["corps"][1] * k
    ventre = 3.0 if b.get("flotte", False) else lp
    rig.placer("racine", (p["corps_x"], 0, -p["corps_z"]))
    # rouler sur le flanc : autour de X, et on pose le corps au sol
    rig.tourner("racine", x=p["roulis"])
    if p["roulis"] > 0:
        # ⚠️ La racine tourne **au sol** : le corps bascule donc de lui-meme, et
        # le descendre encore l'enfonce dessous (un golem mort passait six pixels
        # sous son cadre). On ne fait que le **remonter** quand la bascule le
        # ferait passer sous le sol : son demi-axe vertical tourne avec lui, de
        # `H / 2` debout a `H * 0.42` couche sur le flanc.
        r = p["roulis"]
        demi = math.hypot(H * 0.42 * math.sin(r), H / 2 * math.cos(r))
        rig.placer("racine", (p["corps_x"], 0, max(0.0, demi - (ventre + H * 0.45) * math.cos(r))))
    rig.tourner("corps", y=-p["tangage"])
    rig.tourner("cou", y=p["cou"])
    for k, a in enumerate(p["pattes"]):
        rig.tourner(f"patte_{k}_avant", y=-a)
        rig.tourner(f"patte_{k}_arriere", y=a)
    if "queue" in rig.joints:
        rig.tourner("queue", z=p["queue"])


# ------------------------------------------------------------- les familles
def familles():
    f = {}
    classes = ["guerrier", "chevalier", "mage", "assassin", "rodeur", "oracle", "necromancien"]
    for classe in classes:
        # Les cinq paliers avec tous leurs gestes (20 septembre 2026) : les
        # planches entrent dans le jeu, il faut chaque combinaison que le four
        # cuisait — une montee de rang change la planche.
        for palier in range(5):
            cle = f"hero-{classe}-p{palier}"
            f[cle] = dict(sorte="humain", tenue=tenue_de_hero(classe, palier), gestes=GESTES_HUMAIN, cadre=cadre_de(CADRE), voute=0.0)
    for nom, b in BETES.items():
        f[f"monstre-{nom}"] = dict(sorte="bete", bete=b, gestes=GESTES_BETE, cadre=cadre_de(b["cadre"]))
    # le revenant : un mort qui marche, un humain aux os, voute, en haillons ;
    # le mort-vivant du Necromancien est le meme corps (le jeu ne change que les yeux)
    for cle in ("monstre-revenant", "mort-vivant"):
        f[cle] = dict(
            sorte="humain",
            tenue=dict(tunique="tissu", jambes="tissu", peau="os", coiffe=None, plastron=False, cape=None, laiton=False, arme=None, bouclier=False),
            gestes=GESTES_BETE, cadre=cadre_de(CADRE), voute=0.35,
        )
    # Les villageois (20 septembre 2026, soir) : `villageois.ts` — un metier, un
    # tablier, un outil qui n'est en main qu'au travail, trois crans d'usure
    # (il se voute, il palit) et le sang d'un blesse.
    for metier, outil in OUTILS.items():
        for usure in range(3):
            for sang in (0, 1):
                cle = f"villageois-{metier}-u{usure}-s{sang}"
                f[cle] = dict(
                    sorte="humain",
                    tenue=dict(tunique="tissu", jambes="tissu", peau="chair" if usure == 0 else "chair_usee",
                               coiffe="capuche" if metier == "guetteur" else "chapeau", plastron=False, cape=None,
                               laiton=False, arme=outil, bouclier=False,
                               # ⚠️ Le survivant n'a **pas** de tablier (`villageois.ts`) : un
                               # inconnu ne porte pas les couleurs d'un metier, et a huit les
                               # teintes ne pouvaient plus s'ecarter a vingt pixels.
                               ventre=None if metier == "survivant" else f"tablier_{metier}",
                               sang=bool(sang)),
                    # ⚠️ La voute est celle de `corps.ts` (`dos = usure * 0.25`, usure de 0 a 1),
                    # pas une de plus : a 0,18 par cran le villageois use etait plie en deux.
                    gestes=GESTES_VILLAGEOIS, cadre=cadre_de(CADRE), voute=0.125 * usure, outil_au_travail=True,
                )
    # Les familiers : deux flammes qui flottent, et le golem de pierre.
    for nom, b in FAMILIERS.items():
        f[nom] = dict(sorte="bete", bete=b, gestes=GESTES_BETE, cadre=cadre_de(b["cadre"]))
    return f


# Les outils de `villageois.ts`, par metier ; le survivant n'a qu'un baton.
OUTILS = {
    "pecheur": "canne", "fermier": "houe", "bucheron": "hache", "mineur": "pioche",
    "forgeron": "marteau", "charpentier": "maillet", "guetteur": "baton", "survivant": "baton",
}
GESTES_VILLAGEOIS = [("repos", 4, True), ("marche", 6, True), ("travail", 6, True), ("toux", 4, False)]

# Les familiers de `monstres.ts` : la flamme froide du Mage, le golem, le spectre.
FAMILIERS = {
    "familier": dict(corps=(8, 10, "familier"), pattes=(4, 0, 0), tete=(0, 0), dos="lisse", queue=0, cadre=CADRE, yeux="os", flotte=True),
    "familier-golem": dict(corps=(18, 16, "pierre"), pattes=(4, 7, 4.5), tete=(3.5, 1), dos="plaques", queue=0, cadre=CADRE_GROS, yeux="laiton"),
    "familier-spectre": dict(corps=(6, 12, "spectre"), pattes=(4, 0, 0), tete=(0, 0), dos="lisse", queue=0, cadre=CADRE, yeux="tissu", flotte=True),
}


# ------------------------------------------------------------------ le rendu
def scene_de_rendu(W, H, pied, ancre):
    """La camera et le soleil de `rendre.py`, pour un cadre carre de W x H."""
    scene = bpy.context.scene
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

    M = rendre.MARGE
    Wr, Hr = W + 2 * M, H + 2 * M
    cd = bpy.data.cameras.new("Camera")
    cd.type = "ORTHO"
    cd.sensor_fit = "HORIZONTAL"
    cd.ortho_scale = Wr / monde.PX_PAR_UNITE
    cd.clip_end = 200
    cam = bpy.data.objects.new("Camera", cd)
    scene.collection.objects.link(cam)
    vise, haut = monde.axes_camera()
    v = (Hr / 2 - (pied + M)) / monde.PX_PAR_UNITE
    u = (Wr / 2 - (ancre + M)) / monde.PX_PAR_UNITE
    cam.location = Vector((u, 0, 0)) - v * haut - 60 * vise
    cam.rotation_euler = (monde.INCLINAISON, 0, 0)
    scene.camera = cam

    for moteur in ("BLENDER_EEVEE", "BLENDER_EEVEE_NEXT"):
        try:
            scene.render.engine = moteur
            break
        except TypeError:
            continue
    r = scene.render
    r.resolution_x, r.resolution_y = Wr * rendre.SUR, Hr * rendre.SUR
    r.film_transparent = True
    r.filter_size = 0.0
    r.dither_intensity = 0.0
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "None"
    return scene


def rendre_famille(cle, f):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    a = monde.Atelier()
    rig = Rig(a)
    if f["sorte"] == "humain":
        humain(rig, **f["tenue"])
    else:
        bete(rig, f["bete"])
    a.racine(cle, y_devant=0.0)
    sol = monde.Atelier()
    sol._mats = a._mats
    sol.boite("sol", (40, 40, 0.02), (0, 0, -0.011))

    c = f["cadre"]
    scene = scene_de_rendu(c["taille"], c["taille"], c["pied"], c["ancre"])
    for nom, m in a._mats.items():
        rendre.peindre_code(m, nom)
    blanc = rendre.blanc()

    plages = []
    index = 0
    for geste, frames, boucle in f["gestes"]:
        plages.append({"cle": geste, "debut": index, "fin": index + frames - 1})
        for i in range(frames):
            t = avancement(frames, boucle, i)
            if f["sorte"] == "humain":
                p = posture_humain(geste, t, f.get("voute", 0.0))
                # un villageois ne tient son outil qu'au travail (`villageois.ts`)
                if f.get("outil_au_travail"):
                    p["outil"] = geste == "travail"
                poser_humain(rig, p)
            else:
                poser_bete(rig, posture_bete(geste, t, f["bete"]), f["bete"])
            bpy.context.view_layer.update()
            base = os.path.join(TMP, f"{cle}__{index:03d}")
            bpy.context.view_layer.material_override = None
            scene.render.filepath = f"{base}_id.png"
            bpy.ops.render.render(write_still=True)
            bpy.context.view_layer.material_override = blanc
            scene.render.filepath = f"{base}_lumiere.png"
            bpy.ops.render.render(write_still=True)
            index += 1

    with open(os.path.join(TMP, f"{cle}.json"), "w", encoding="utf-8") as fp:
        json.dump({"cle": cle, "largeur": c["taille"], "hauteur": c["taille"], "pied": c["pied"],
                   "ancre": c["ancre"], "marge": rendre.MARGE, "sur": rendre.SUR, "codes": rendre.CODE,
                   "frames": index, "plages": plages}, fp)
    print(f"[persos] {cle} : {index} frames")


if __name__ == "__main__":
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    for cle, f in familles().items():
        if argv and not any(cle.startswith(p) for p in argv):
            continue
        rendre_famille(cle, f)
