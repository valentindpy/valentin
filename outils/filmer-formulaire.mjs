/* =====================================================================
   VD SERVICES — la démonstration de la page d'accueil

       python3 -m http.server 8777 --directory site   (dans un terminal)
       node outils/filmer-formulaire.mjs               (dans un autre)
       node outils/filmer-formulaire.mjs en            (la version anglaise)
       → site/video/formulaire.mp4 et formulaire.jpg
         site/video/formulaire-en.mp4 et formulaire-en.jpg

   Une langue par vidéo : montrer un formulaire français à un visiteur
   anglophone, c'est lui promettre un service qu'il ne comprendra pas.

   Ce n'est pas une animation inventée : c'est le formulaire lui-même,
   joué écran par écran et photographié douze fois par seconde. Quatorze
   secondes, du premier choix à la confirmation.

   RIEN N'EST ENVOYÉ À LA BASE. Les appels vers Supabase sont interceptés
   et reçoivent un 201 à la place : aucune demande n'est créée, et
   l'écran de confirmation affiché reste le vrai, celui que le code
   produit quand un dépôt réussit.

   À relancer le jour où le formulaire change d'allure — sinon la page
   d'accueil montrerait un produit qui n'existe plus.
   ===================================================================== */

import pw from "playwright";
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = dirname(dirname(fileURLToPath(import.meta.url)));
const SORTIE = join(RACINE, "site/video");
const FPS = 12;

const CODE = process.argv[2] || "fr";
const LANGUES = {
  fr: { chemin: "/formulaire/", locale: "fr-FR", suffixe: "",
        fin: "Demande enregistrée",
        adresse: "12 rue des Lauriers, Cannes", nom: "Claire Martin" },
  en: { chemin: "/en/form/", locale: "en-GB", suffixe: "-en",
        fin: "Request received",
        adresse: "12 rue des Lauriers, Cannes", nom: "Claire Martin" },
};
const L = LANGUES[CODE];
if (!L) throw new Error("langue inconnue : " + CODE);
const IMAGES = join(RACINE, ".images-video" + L.suffixe);
const ADRESSE = process.env.ADRESSE || "http://127.0.0.1:8777" + L.chemin;

rmSync(IMAGES, { recursive: true, force: true });
mkdirSync(IMAGES, { recursive: true });
mkdirSync(SORTIE, { recursive: true });

const navigateur = await pw.chromium.launch();
const contexte = await navigateur.newContext({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: L.locale,
});
const page = await contexte.newPage();

let interceptes = 0;
await page.route("**/rest/v1/**", (r) => {
  interceptes++;
  r.fulfill({ status: 201, contentType: "application/json", body: "[]" });
});
await page.route("**/storage/v1/**", (r) =>
  r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));

await page.goto(ADRESSE, { waitUntil: "networkidle" });
await page.waitForTimeout(800);

let i = 0;
const PAS = 1000 / FPS;
const cliche = () =>
  page.screenshot({ path: join(IMAGES, `f-${String(i++).padStart(4, "0")}.png`) });
async function tenir(ms) {
  const n = Math.max(1, Math.round(ms / PAS));
  for (let k = 0; k < n; k++) { await cliche(); await page.waitForTimeout(PAS - 20); }
}
async function toucher(sel, apres = 650) { await page.click(sel); await tenir(apres); }
async function ecrire(sel, txt) {
  await page.click(sel);
  for (const c of txt) {
    await page.type(sel, c, { delay: 0 });
    await cliche();
    await page.waitForTimeout(38);
  }
  await tenir(260);
}

/* Le parcours dépannage : le plus court des cinq, et le plus parlant. */
await tenir(1500);
await toucher('[data-intent="depannage"]', 800);
await toucher('[data-trade="plomberie"]', 800);
await toucher('[data-lieu="privatif"]', 420);
await toucher('[data-statut="locataire"]', 480);
await ecrire("#w-adr", L.adresse);
await toucher("#screen .cta:not([disabled])", 700);
await ecrire("#c-nom", L.nom);
await ecrire("#c-tel", "06 12 34 56 78");
await toucher("#c-ok", 420);
await toucher("#screen .cta:not([disabled])", 900);
await tenir(2600);

const fin = await page.evaluate(() =>
  document.querySelector(".ok h2, .ok h3, .q")?.textContent.trim());
await contexte.close();
await navigateur.close();

if (fin !== L.fin) {
  throw new Error("le parcours ne s'est pas terminé sur la confirmation : " + fin);
}
console.log(`${i} images · ${interceptes} appel(s) intercepté(s) · fin sur « ${fin} »`);

/* --- le montage ---
   540 pixels de large : deux fois la taille d'affichage sur la page,
   ce qui suffit à un écran dense sans peser. */
const ff = process.env.FFMPEG || "ffmpeg";
execFileSync(ff, ["-hide_banner", "-loglevel", "error", "-y",
  "-framerate", String(FPS), "-i", join(IMAGES, "f-%04d.png"),
  "-vf", "scale=540:-2:flags=lanczos",
  "-c:v", "libx264", "-preset", "slow", "-crf", "27",
  "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an",
  join(SORTIE, `formulaire${L.suffixe}.mp4`)], { stdio: "inherit" });
execFileSync(ff, ["-hide_banner", "-loglevel", "error", "-y",
  "-i", join(IMAGES, "f-0008.png"), "-vf", "scale=540:-2:flags=lanczos",
  "-q:v", "6", join(SORTIE, `formulaire${L.suffixe}.jpg`)], { stdio: "inherit" });
rmSync(IMAGES, { recursive: true, force: true });
console.log(`site/video/formulaire${L.suffixe}.mp4 et formulaire${L.suffixe}.jpg`);
