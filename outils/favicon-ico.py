# -*- coding: utf-8 -*-
"""Fabrique site/favicon.ico (32x32) a partir du meme dessin que favicon.svg.

Les navigateurs recents prennent le SVG ; les anciens, eux, vont chercher
/favicon.ico sans qu'on leur demande. Ce fichier existe pour eux.

A 32 pixels, aucune fonte ne tient : les deux lettres sont dessinees a la
main sur une grille de 5 par 7, doublee. Sans dependance, sans outil
d'image a installer.
"""
import io, struct

BLEU = (0x2E, 0x4E, 0x77)
BANDE = [(0xBC, 0x2F, 0x26), (0x8E, 0x62, 0x06), (0x20, 0x65, 0x4A), (0x1D, 0x6A, 0x82)]
BLANC = (0xFF, 0xFF, 0xFF)
N = 32

GLYPHES = {
    "V": ["X...X", "X...X", "X...X", "X...X", ".X.X.", ".X.X.", "..X.."],
    "D": ["XXXX.", "X...X", "X...X", "X...X", "X...X", "X...X", "XXXX."],
}

# (r,g,b,a) par pixel, None = transparent
px = [[None] * N for _ in range(N)]

HAUT_BANDE = 27                      # la bande occupe les 5 dernieres lignes
for y in range(N):
    for x in range(N):
        px[y][x] = BANDE[min(3, x // 8)] + (255,) if y >= HAUT_BANDE else BLEU + (255,)

# coins adoucis : on retire trois pixels en escalier a chaque angle
for cy, cx in ((0, 0), (0, N - 1), (N - 1, 0), (N - 1, N - 1)):
    dy = 1 if cy == 0 else -1
    dx = 1 if cx == 0 else -1
    for i, n in enumerate((2, 1)):
        for j in range(n):
            px[cy + dy * i][cx + dx * j] = None

# les lettres, doublees, centrees au-dessus de la bande
mot, ech, ecart = "VD", 2, 2
larg = len(mot) * 5 * ech + (len(mot) - 1) * ecart
x0 = (N - larg) // 2
y0 = (HAUT_BANDE - 7 * ech) // 2
for k, lettre in enumerate(mot):
    base = x0 + k * (5 * ech + ecart)
    for ly, ligne in enumerate(GLYPHES[lettre]):
        for lx, c in enumerate(ligne):
            if c != "X":
                continue
            for a in range(ech):
                for b in range(ech):
                    px[y0 + ly * ech + a][base + lx * ech + b] = BLANC + (255,)

# --- encodage ICO : en-tete, BITMAPINFOHEADER, pixels BGRA de bas en haut ---
pixels = io.BytesIO()
for y in range(N - 1, -1, -1):
    for x in range(N):
        p = px[y][x]
        pixels.write(struct.pack("<4B", 0, 0, 0, 0) if p is None
                     else struct.pack("<4B", p[2], p[1], p[0], p[3]))
masque = b"\x00" * (4 * N)           # alpha 32 bits : le masque ne sert plus

dib = struct.pack("<IiiHHIIiiII", 40, N, N * 2, 1, 32, 0, 0, 0, 0, 0, 0)
image = dib + pixels.getvalue() + masque
ico = (struct.pack("<HHH", 0, 1, 1)
       + struct.pack("<BBBBHHII", N, N, 0, 0, 1, 32, len(image), 22)
       + image)

io.open("site/favicon.ico", "wb").write(ico)
print("site/favicon.ico %d octets" % len(ico))
