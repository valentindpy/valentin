# -*- coding: utf-8 -*-
"""Fabrique site/favicon.ico a partir des deux PNG de 16 et 32 pixels.

    node outils/icones-pwa.mjs     # produit les PNG
    python3 outils/favicon-ico.py  # les emballe dans un .ico

Les navigateurs recents prennent le SVG ; les anciens, les agregateurs
et les barres de favoris vont chercher /favicon.ico sans qu'on leur
demande. Ce fichier existe pour eux.

Un .ico n'est qu'un en-tete de six octets, une entree de seize octets
par image, et les images a la suite. Depuis Vista, ces images peuvent
etre des PNG tels quels : il n'y a donc rien a convertir, rien a
installer, et le dessin reste celui du navigateur — c'est-a-dire le
meme que partout ailleurs.
"""
import io, os, struct

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCES = ["site/favicon-16.png", "site/favicon-32.png"]
CIBLE = "site/favicon.ico"


def taille_png(octets):
    """Largeur et hauteur, lues dans le bloc IHDR : les huit octets de
    signature, puis la longueur et le nom du bloc, puis les dimensions."""
    if octets[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError("ce n'est pas un PNG")
    larg, haut = struct.unpack(">II", octets[16:24])
    return larg, haut


images = []
for chemin in SOURCES:
    plein = os.path.join(RACINE, chemin)
    if not os.path.exists(plein):
        raise SystemExit("manquant : %s — lancez d'abord outils/icones-pwa.mjs" % chemin)
    octets = io.open(plein, "rb").read()
    larg, haut = taille_png(octets)
    images.append((larg, haut, octets))

# en-tete : reserve, type 1 (icone), nombre d'images
sortie = struct.pack("<HHH", 0, 1, len(images))
# les donnees commencent apres l'en-tete et toutes les entrees
decalage = 6 + 16 * len(images)
for larg, haut, octets in images:
    sortie += struct.pack(
        "<BBBBHHII",
        larg if larg < 256 else 0,   # 0 veut dire 256
        haut if haut < 256 else 0,
        0,                            # pas de palette
        0,                            # reserve
        1,                            # plans
        32,                           # bits par pixel
        len(octets),
        decalage,
    )
    decalage += len(octets)
for _, _, octets in images:
    sortie += octets

io.open(os.path.join(RACINE, CIBLE), "wb").write(sortie)
print("%s  %d octets  (%s)" % (
    CIBLE, len(sortie), ", ".join("%dx%d" % (l, h) for l, h, _ in images)))
