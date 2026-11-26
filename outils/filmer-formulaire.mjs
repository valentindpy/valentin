/* =====================================================================
   VD SERVICES — la démonstration de la page d'accueil

       python3 -m http.server 8777 --directory site   (dans un terminal)
       node outils/filmer-formulaire.mjs               (dans un autre)
       node outils/filmer-formulaire.mjs en            (la version anglaise)
       → site/video/formulaire.mp4 et formulaire.jpg
         site/video/formulaire-en.mp4 et formulaire-en.jpg

   CE QU'ELLE MONTRE
   Les quatre portes d'entrée du formulaire, chacune jouée jusqu'à sa
   confirmation : l'urgence, le dépannage, le projet de travaux et les
   travaux énergétiques financés. Une légende nomme l'étape en cours —
   sans elle, un visiteur voit des écrans défiler sans savoir ce qu'on
   lui demande ni pourquoi.

   La cinquième porte, celle des entités publiques, reste hors champ :
   une consultation de collectivité ne se décide pas depuis une page
   d'accueil, et elle aurait doublé la durée.

   CE N'EST PAS UNE ANIMATION INVENTÉE
   C'est le formulaire lui-même, joué écran par écran et photographié
   dix fois par seconde. La légende et le carton de titre sont les
   seules choses ajoutées, et elles vivent uniquement le temps de
   l'enregistrement.

   RIEN N'EST ENVOYÉ À LA BASE. Les appels vers Supabase sont interceptés
   et reçoivent un 201 à la place : aucune demande n'est créée, et
   l'écran de confirmation affiché reste le vrai, celui que le code
   produit quand un dépôt réussit.

   Une langue par vidéo : montrer un formulaire français à un visiteur
   anglophone, c'est lui promettre un service qu'il ne comprendra pas.

   À relancer le jour où le formulaire change d'allure — sinon la page
   d'accueil montrerait un produit qui n'existe plus.
   ===================================================================== */

import pw from "playwright";
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = dirname(dirname(fileURLToPath(import.meta.url)));
const SORTIE = join(RACINE, "site/video");
const FPS = 10;

const ADR = "12 rue des Lauriers, Cannes";
const TEL = "06 12 34 56 78";
const NOM = "Claire Martin";

/* Les légendes, langue par langue. Elles disent ce que le visiteur
   gagne à chaque écran, pas ce qu'il doit cliquer : « nous appelons
   l'entreprise d'astreinte » se retient, « choisissez une option »
   non. */
const TEXTES = {
  fr: {
    chemin: "/formulaire/", locale: "fr-FR", suffixe: "", fin: "Demande enregistrée",
    ouvre: ["Un seul formulaire", "Quatre façons d’y entrer"],
    parcours: {
      urgence: ["Porte 1", "C’est une urgence"],
      depannage: ["Porte 2", "Un dépannage"],
      projet: ["Porte 3", "Un projet de travaux"],
      energie: ["Porte 4", "Des travaux financés"],
    },
    pas: {
      choix: ["Le premier écran", "Vous dites ce qui vous arrive. Une seule réponse."],
      metier: ["Deux secondes", "Le métier concerné, même approximatif."],
      urgenceNum: ["Tout de suite", "Les numéros d’astreinte s’affichent. Vous appelez, ou vous laissez le vôtre."],
      lieu: ["Qui paie quoi", "Partie privative ou commune : c’est ce qui détermine qui prend en charge."],
      statut: ["Votre situation", "Locataire, propriétaire, syndic : le dossier ne suit pas le même chemin."],
      adresse: ["L’adresse", "Pour envoyer la bonne entreprise au bon endroit."],
      projetType: ["Le projet", "Prenez le plus proche. Vous ajusterez à l’écran suivant."],
      detail: ["Ce qui est prévu", "Les prestations, le délai, l’enveloppe. Rien n’est obligatoire."],
      geste: ["Les travaux visés", "Cochez même sans être sûr. Nous vérifions l’éligibilité ensuite."],
      logement: ["Le logement", "C’est lui qui décide des aides, avant même les revenus."],
      foyer: ["Le foyer", "Ces réponses servent au calcul des aides, et à rien d’autre."],
      contact: ["Vos coordonnées", "Nom et téléphone. Pas de compte à créer, pas de mot de passe."],
      envoi: ["C’est parti", "Vous recevez un accusé de réception immédiat."],
      fini: ["Reçu", "Nous rappelons dans la journée."],
    },
    final: ["Un souci ?", "On s’en occupe."],
  },
  en: {
    chemin: "/en/form/", locale: "en-GB", suffixe: "-en", fin: "Request received",
    ouvre: ["One form", "Four ways in"],
    parcours: {
      urgence: ["Door 1", "It’s an emergency"],
      depannage: ["Door 2", "A repair"],
      projet: ["Door 3", "A renovation project"],
      energie: ["Door 4", "Funded energy works"],
    },
    pas: {
      choix: ["The first screen", "You say what’s happening. One answer only."],
      metier: ["Two seconds", "The trade involved — a rough idea is enough."],
      urgenceNum: ["Straight away", "The on-call numbers appear. Call, or leave yours."],
      lieu: ["Who pays for what", "Private or communal: this decides who foots the bill."],
      statut: ["Your situation", "Tenant, owner, managing agent: the file takes a different route."],
      adresse: ["The address", "So we send the right firm to the right place."],
      projetType: ["The project", "Pick the closest. You’ll refine it on the next screen."],
      detail: ["What’s planned", "The work, the timing, the budget. None of it is required."],
      geste: ["The works", "Tick them even if you’re unsure. We check eligibility after."],
      logement: ["The property", "It decides the funding, before income even comes in."],
      foyer: ["The household", "These answers serve the funding estimate, nothing else."],
      contact: ["Your details", "Name and phone. No account, no password."],
      envoi: ["Off it goes", "You get an acknowledgement straight away."],
      fini: ["Received", "We call back the same day."],
    },
    final: ["Something wrong?", "We’ll handle it."],
  },
};

const CODE = process.argv[2] || "fr";
const L = TEXTES[CODE];
if (!L) throw new Error("langue inconnue : " + CODE);
const IMAGES = join(RACINE, ".images-video" + L.suffixe);
const ADRESSE = process.env.ADRESSE || "http://127.0.0.1:8777" + L.chemin;

/* Un pas vaut : ["dire", clé] · ["clic", sél] · ["saisie", sél, texte]
   · ["suite"] pour le « Continuer » de l'écran · ["tenir", ms].       */
const PARCOURS = [
  { id: "urgence", pas: [
    ["dire", "choix"], ["clic", '[data-intent="urgence"]'],
    ["dire", "metier"], ["clic", '[data-trade="plomberie"]'],
    ["dire", "urgenceNum"], ["tenir", 1500],
    ["saisie", "#u-tel", TEL], ["clic", '[data-go="done"]'],
  ] },
  { id: "depannage", pas: [
    ["dire", "choix"], ["clic", '[data-intent="depannage"]'],
    ["dire", "metier"], ["clic", '[data-trade="plomberie"]'],
    ["dire", "lieu"], ["clic", '[data-lieu="privatif"]'],
    ["dire", "statut"], ["clic", '[data-statut="locataire"]'],
    ["dire", "adresse"], ["saisie", "#w-adr", ADR], ["suite"],
    ["dire", "contact"], ["saisie", "#c-nom", NOM], ["saisie", "#c-tel", TEL], ["clic", "#c-ok"],
    ["dire", "envoi"], ["suite"],
  ] },
  { id: "projet", pas: [
    ["dire", "choix"], ["clic", '[data-intent="projet"]'],
    ["dire", "projetType"], ["clic", '[data-projet="appart"]'],
    ["dire", "lieu"], ["clic", '[data-lieu="privatif"]'], ["clic", '[data-statut="occupant"]'],
    ["saisie", "#w-adr", ADR], ["suite"],
    ["dire", "detail"], ["clic", '[data-presta^="global|"]'], ["clic", '[data-delai="asap"]'],
    ["clic", '[data-budget="15 à 50 k€"]'], ["suite"],
    /* Le contact a deja ete montre en detail au parcours precedent :
       le remontrer trois fois de plus allonge sans rien apprendre. */
    ["dire", "envoi"], ["saisie", "#c-nom", NOM], ["saisie", "#c-tel", TEL], ["clic", "#c-ok"], ["suite"],
  ] },
  { id: "energie", pas: [
    ["dire", "choix"], ["clic", '[data-intent="energie"]'],
    ["dire", "geste"], ["clic", '[data-geste="pac_ae"]'], ["suite"],
    ["dire", "logement"], ["clic", '[data-logement="maison"]'], ["clic", '[data-anciennete="plus15"]'],
    ["clic", '[data-occupation="occupant"]'], ["clic", '[data-usage="principale"]'],
    ["saisie", "#e-adr", ADR], ["suite"],
    ["dire", "foyer"], ["clic", '[data-personnes="3"]'], ["clic", '[data-revenus="r1"]'],
    ["clic", '[data-chauffage="fioul"]'], ["clic", '[data-devis="non"]'], ["suite"],
    /* Le contact a deja ete montre en detail au parcours precedent :
       le remontrer trois fois de plus allonge sans rien apprendre. */
    ["dire", "envoi"], ["saisie", "#c-nom", NOM], ["saisie", "#c-tel", TEL], ["clic", "#c-ok"], ["suite"],
  ] },
];

rmSync(IMAGES, { recursive: true, force: true });
mkdirSync(IMAGES, { recursive: true });
mkdirSync(SORTIE, { recursive: true });

const navigateur = await pw.chromium.launch();
const contexte = await navigateur.newContext({
  /* Sans cela, le service worker ressert la version précédente du
     formulaire : on filmerait la build d'hier. */
  serviceWorkers: "block",
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

/* ---------- la pellicule ---------- */
let i = 0;
let affiche = 0;   /* l'image qui servira de vignette */
const PAS = 1000 / FPS;
const nom = (k) => join(IMAGES, `f-${String(k).padStart(4, "0")}.png`);
const cliche = () => page.screenshot({ path: nom(i++) });

/* Un temps mort se remplit en recopiant la dernière image : prendre
   cinquante captures d'un écran immobile coûte une minute et donne le
   même film. On photographie vraiment le début, le temps que les
   transitions se jouent. */
async function tenir(ms) {
  const total = Math.max(1, Math.round(ms / PAS));
  const vrais = Math.min(total, Math.round(420 / PAS));
  for (let k = 0; k < vrais; k++) { await cliche(); await page.waitForTimeout(PAS - 18); }
  for (let k = vrais; k < total; k++) { copyFileSync(nom(i - 1), nom(i)); i++; }
}

const PEAU = `
  #vds-legende{position:fixed;left:0;right:0;bottom:0;z-index:99998;
    background:#17222E;color:#F5F2EC;padding:15px 20px 18px;
    font:500 19px/1.38 Inter,-apple-system,sans-serif;
    box-shadow:0 -14px 30px rgba(23,34,46,.22)}
  #vds-legende b{display:block;font:600 12px/1 Inter,sans-serif;letter-spacing:.15em;
    text-transform:uppercase;color:#E2A181;margin-bottom:7px}
  #vds-titre{position:fixed;inset:0;z-index:99999;background:#17222E;color:#F5F2EC;
    display:flex;flex-direction:column;align-items:center;justify-content:center;
    text-align:center;padding:0 36px}
  #vds-titre span{font:600 13px/1 Inter,sans-serif;letter-spacing:.2em;text-transform:uppercase;
    color:#E2A181;margin-bottom:16px}
  #vds-titre strong{font-family:"Source Serif 4",Georgia,serif;font-size:36px;
    font-weight:600;line-height:1.12;letter-spacing:-.01em}
  /* la légende ne doit rien cacher : le contenu se termine au-dessus */
  body{padding-bottom:124px!important}
`;

async function habiller() {
  await page.addStyleTag({ content: PEAU });
  await page.evaluate(() => {
    if (document.getElementById("vds-legende")) return;
    const l = document.createElement("div");
    l.id = "vds-legende"; l.innerHTML = "<b></b><i style='font-style:normal'></i>";
    document.body.appendChild(l);
  });
}
const dire = async ([haut, bas]) => {
  await page.evaluate(([h, b]) => {
    const l = document.getElementById("vds-legende");
    l.querySelector("b").textContent = h;
    l.querySelector("i").textContent = b;
  }, [haut, bas]);
};
async function carton([haut, bas], ms) {
  await page.evaluate(([h, b]) => {
    const d = document.createElement("div");
    d.id = "vds-titre";
    d.innerHTML = "<span></span><strong></strong>";
    d.querySelector("span").textContent = h;
    d.querySelector("strong").textContent = b;
    document.body.appendChild(d);
  }, [haut, bas]);
  await tenir(ms);
  await page.evaluate(() => document.getElementById("vds-titre")?.remove());
}
async function ecrire(sel, txt) {
  await page.click(sel);
  for (const c of txt) { await page.type(sel, c, { delay: 0 }); await cliche(); await page.waitForTimeout(20); }
  await tenir(320);
}

/* ---------- le tournage ---------- */
await page.goto(ADRESSE, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
await habiller();
await carton(L.ouvre, 1500);

for (const { id, pas } of PARCOURS) {
  if (i) { await page.goto(ADRESSE, { waitUntil: "networkidle" }); await habiller(); }
  await carton(L.parcours[id], 1250);
  for (const [k, [quoi, a, b]] of pas.entries()) {
    /* Si une légende suit, on ne s'attarde pas après le clic : sinon
       l'ancienne légende reste affichée au-dessus du nouvel écran, et
       elle le décrit de travers. */
    const suitUneLegende = pas[k + 1] && pas[k + 1][0] === "dire";
    if (quoi === "dire") {
      await dire(L.pas[a]);
      /* La vignette montre le premier ecran du premier parcours, legende
         comprise : c'est ce qu'on voit sur la page avant de lancer. */
      if (!affiche && a === "choix") affiche = i + 4;
      await tenir(1050); continue;
    }
    if (quoi === "tenir") { await tenir(a); continue; }
    if (quoi === "saisie") { await ecrire(a, b); continue; }
    const cible = quoi === "suite" ? "#screen .cta:not([disabled]):not(a)" : a;
    await page.waitForSelector(cible, { state: "visible", timeout: 5000 });
    await page.click(cible);
    await tenir(suitUneLegende ? 140 : 360);
  }
  await dire(L.pas.fini);
  await tenir(1450);
  const fin = await page.evaluate(() =>
    document.querySelector("#screen .ok h2, #screen .ok h3, #screen .q")?.textContent.trim());
  if (fin !== L.fin) throw new Error(`« ${id} » ne finit pas sur la confirmation : ${fin}`);
}
await carton(L.final, 1800);

await contexte.close();
await navigateur.close();
const duree = (i / FPS).toFixed(1);
console.log(`${i} images · ${duree} s · ${interceptes} dépôt(s) intercepté(s)`);

/* --- le montage ---
   540 pixels de large : deux fois la taille d'affichage sur la page,
   ce qui suffit à un écran dense sans peser. */
const ff = process.env.FFMPEG || "ffmpeg";
execFileSync(ff, ["-hide_banner", "-loglevel", "error", "-y",
  "-framerate", String(FPS), "-i", join(IMAGES, "f-%04d.png"),
  "-vf", "scale=540:-2:flags=lanczos",
  /* « stillimage » et un crf plus haut : nonante pour cent des images
     sont identiques a la precedente, l'encodeur n'a presque rien a dire. */
  "-c:v", "libx264", "-preset", "veryslow", "-tune", "stillimage", "-crf", "33",
  "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an",
  join(SORTIE, `formulaire${L.suffixe}.mp4`)], { stdio: "inherit" });
/* L'affiche : le premier écran du premier parcours, pas le carton. */
execFileSync(ff, ["-hide_banner", "-loglevel", "error", "-y",
  "-i", nom(affiche), "-vf", "scale=540:-2:flags=lanczos",
  "-q:v", "6", join(SORTIE, `formulaire${L.suffixe}.jpg`)], { stdio: "inherit" });
rmSync(IMAGES, { recursive: true, force: true });
console.log(`site/video/formulaire${L.suffixe}.mp4 et formulaire${L.suffixe}.jpg`);
