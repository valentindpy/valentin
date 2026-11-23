/* =====================================================================
   VD SERVICES — les icônes de l'application installée

       node outils/icones-pwa.mjs

   Quand on ajoute le formulaire à l'écran d'accueil, le téléphone
   réclame de vraies images : un SVG ne suffit pas à iOS, et Android
   veut une version « maskable », c'est-à-dire qui survit à un
   découpage en rond, en goutte ou en losange selon le fabricant.

   Le dessin est celui de site/favicon.svg — le monogramme sur le bleu
   de travail, et la bande des quatre familles de besoins. Il est
   rendu par le navigateur, avec la vraie fonte, puis photographié à la
   taille voulue. C'est le seul endroit du dépôt qui demande Chromium ;
   les images produites sont versionnées, donc ce script ne sert qu'un
   jour où le logo change.

   La version maskable est dessinée à part : la bande collée au bord
   bas disparaîtrait sous un masque rond. Elle rentre donc dans la zone
   sûre, le cercle qui occupe 80 % de l'icône.
   ===================================================================== */

import pw from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = dirname(dirname(fileURLToPath(import.meta.url)));
const SORTIE = join(RACINE, "site/icones");

const BLEU = "#2E4E77";
const BANDE = ["#BC2F26", "#8E6206", "#20654A", "#1D6A82"];

/* Le dessin plein bord : le bleu touche les quatre côtés, la bande
   occupe la dernière bande horizontale. C'est l'icône de l'onglet et
   celle d'iOS, qui arrondit les angles lui-même. */
function pleinBord(taille) {
  return page(taille, `
    <div class="fond">
      <span class="vd">VD</span>
      <div class="bande">${BANDE.map((c) => `<i style="background:${c}"></i>`).join("")}</div>
    </div>`, `
    .fond{width:100%;height:100%;background:${BLEU};position:relative;
      display:flex;align-items:center;justify-content:center}
    .vd{font-family:Archivo,sans-serif;font-weight:800;color:#fff;
      font-size:${Math.round(taille * 0.46)}px;letter-spacing:-${taille * 0.022}px;
      margin-top:-${Math.round(taille * 0.06)}px}
    .bande{position:absolute;left:0;right:0;bottom:0;height:${Math.round(taille * 0.17)}px;display:flex}
    .bande i{flex:1}`);
}

/* La version maskable : tout rentre dans le cercle de 80 %, et le bleu
   continue jusqu'aux bords pour que le masque ait de la matière à
   couper, quelle que soit sa forme. */
function masquable(taille) {
  return page(taille, `
    <div class="fond">
      <span class="vd">VD</span>
      <div class="bande">${BANDE.map((c) => `<i style="background:${c}"></i>`).join("")}</div>
    </div>`, `
    .fond{width:100%;height:100%;background:${BLEU};
      display:flex;flex-direction:column;align-items:center;justify-content:center;
      gap:${Math.round(taille * 0.045)}px}
    .vd{font-family:Archivo,sans-serif;font-weight:800;color:#fff;
      font-size:${Math.round(taille * 0.3)}px;letter-spacing:-${taille * 0.014}px;line-height:1}
    .bande{width:${Math.round(taille * 0.34)}px;height:${Math.round(taille * 0.045)}px;
      display:flex;border-radius:${Math.round(taille * 0.02)}px;overflow:hidden}
    .bande i{flex:1}`);
}

function page(taille, corps, style) {
  return `<!doctype html><html><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@800&display=block">
<style>
  html,body{margin:0;padding:0;width:${taille}px;height:${taille}px;overflow:hidden}
  ${style}
</style></head><body>${corps}</body></html>`;
}

const IMAGES = [
  { nom: "icone-192.png", taille: 192, dessin: pleinBord },
  { nom: "icone-512.png", taille: 512, dessin: pleinBord },
  { nom: "icone-maskable-512.png", taille: 512, dessin: masquable },
  { nom: "apple-touch-icon.png", taille: 180, dessin: pleinBord },
];

mkdirSync(SORTIE, { recursive: true });
const navigateur = await pw.chromium.launch();
for (const img of IMAGES) {
  const onglet = await navigateur.newPage({
    viewport: { width: img.taille, height: img.taille },
    deviceScaleFactor: 1,
  });
  await onglet.setContent(img.dessin(img.taille), { waitUntil: "networkidle" });
  /* la fonte est demandée en display:block : on attend qu'elle soit là,
     sinon le monogramme sort dans la fonte de secours */
  await onglet.evaluate(() => document.fonts.ready);
  await onglet.waitForTimeout(150);
  const png = await onglet.screenshot({ omitBackground: false });
  writeFileSync(join(SORTIE, img.nom), png);
  console.log(img.nom.padEnd(26) + img.taille + "×" + img.taille + "  " + png.length + " octets");
  await onglet.close();
}
await navigateur.close();
