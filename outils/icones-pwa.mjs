/* =====================================================================
   VD SERVICES — toutes les icônes, depuis le même dessin

       node outils/icones-pwa.mjs

   Une seule forme : l'arc et sa clé de voûte, celle de site/logo.svg.
   Ce script la décline dans les six tailles que réclament un onglet,
   un écran d'accueil iOS et un lanceur Android, puis
   outils/favicon-ico.py emballe les deux plus petites dans un .ico.

   Trois versions, et chacune répond à une contrainte :

     pleine   l'arc en papier sur l'encre, bord à bord. iOS arrondit
              les angles lui-même, et l'onglet du navigateur veut une
              image qui remplit son carré.
     masquée  Android découpe l'icône en rond, en goutte ou en losange
              selon le fabricant : tout rentre donc dans le cercle qui
              occupe 80 % de la surface.
     tuile    16 et 32 pixels pour le .ico. À cette taille la clé de
              voûte ne fait qu'un pixel et demi : on l'élargit, sinon
              elle disparaît.

   Les images produites sont versionnées : ce script ne sert qu'un jour
   où la marque change. C'est le seul endroit du dépôt qui demande un
   navigateur, parce que lui seul sait rendre un SVG fidèlement.
   ===================================================================== */

import pw from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = dirname(dirname(fileURLToPath(import.meta.url)));

const ENCRE = "#17222E";
const PAPIER = "#F5F2EC";
const TERRE = "#C9683C";   /* un cran plus clair que sur le papier : sur
                              l'encre, la terre cuite s'assombrit à l'œil */

/* L'arc, aux coordonnées de site/logo.svg. `echelle` le rétrécit dans
   son carré ; `cle` élargit la clé pour les très petites tailles. */
function marque(echelle, cle = 1) {
  const m = (100 - 100 * echelle) / 2;
  /* la clé s'élargit autour de son axe x=50 */
  const g = 38.26 + (1 - cle) * (50 - 38.26);
  const d = 61.74 - (1 - cle) * (61.74 - 50);
  const gi = 45.21 + (1 - cle) * (50 - 45.21);
  const di = 54.79 - (1 - cle) * (54.79 - 50);
  return `<svg viewBox="0 0 100 100" width="100%" height="100%">
    <g transform="translate(${m} ${m}) scale(${echelle})">
      <g fill="${PAPIER}">
        <path d="M18 86 L18 54 A32 32 0 0 1 37.50 24.54 L42.97 37.43 A18 18 0 0 0 32 54 L32 86 Z"/>
        <path d="M82 86 L82 54 A32 32 0 0 0 62.50 24.54 L57.03 37.43 A18 18 0 0 1 68 54 L68 86 Z"/>
      </g>
      <path d="M${g} 17.86 L${d} 17.86 L${di} 39.26 A15.5 15.5 0 0 0 ${gi} 39.26 Z" fill="${TERRE}"/>
    </g>
  </svg>`;
}

function page(taille, dedans) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    html,body{margin:0;padding:0;width:${taille}px;height:${taille}px;overflow:hidden;background:${ENCRE}}
  </style></head><body>${dedans}</body></html>`;
}

const IMAGES = [
  /* l'onglet et le .ico — la clé élargie pour survivre à 16 pixels */
  { nom: "site/favicon-16.png", taille: 16, html: (t) => page(t, marque(0.96, 1.5)) },
  { nom: "site/favicon-32.png", taille: 32, html: (t) => page(t, marque(0.96, 1.35)) },
  /* l'écran d'accueil */
  { nom: "site/icones/apple-touch-icon.png", taille: 180, html: (t) => page(t, marque(0.84)) },
  { nom: "site/icones/icone-192.png", taille: 192, html: (t) => page(t, marque(0.84)) },
  { nom: "site/icones/icone-512.png", taille: 512, html: (t) => page(t, marque(0.84)) },
  /* la version qu'Android découpe : tout dans la zone sûre */
  { nom: "site/icones/icone-maskable-512.png", taille: 512, html: (t) => page(t, marque(0.6)) },
];

mkdirSync(join(RACINE, "site/icones"), { recursive: true });
const navigateur = await pw.chromium.launch();
for (const img of IMAGES) {
  const onglet = await navigateur.newPage({
    viewport: { width: img.taille, height: img.taille },
    deviceScaleFactor: 1,
  });
  await onglet.setContent(img.html(img.taille));
  await onglet.waitForTimeout(80);
  const png = await onglet.screenshot();
  writeFileSync(join(RACINE, img.nom), png);
  console.log(img.nom.padEnd(38) + String(img.taille).padStart(3) + " px  " + png.length + " octets");
  await onglet.close();
}
await navigateur.close();
console.log("\nPuis : python3 outils/favicon-ico.py");
