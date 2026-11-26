/* =====================================================================
   VD SERVICES — le formulaire joué de bout en bout, dans une langue

       python3 -m http.server 8777 --directory site
       node outils/essayer-formulaire.mjs            (français)
       node outils/essayer-formulaire.mjs en         (anglais)

   À quoi ça sert : une page traduite peut être entièrement en anglais
   et pourtant cassée. Il suffit qu'une traduction ait changé un texte
   dont le script se sert pour décider quelque chose, ou qu'un bouton
   soit devenu trop large pour l'écran. Le dictionnaire ne le dira pas.
   Seul le parcours joué le dit.

   On vise par data-attribut et non par libellé : `data-statut="locataire"`
   désigne le même bouton dans les neuf langues, alors que « Locataire »
   n'existe qu'en français. C'est aussi ce qui prouve que la traduction
   n'a pas touché aux identifiants.

   RIEN N'EST ENVOYÉ À LA BASE : les appels Supabase sont interceptés.
   ===================================================================== */

import pw from "playwright";

const CODE = process.argv[2] || "fr";
const LANGUES = {
  fr: { chemin: "/formulaire/", fin: "Demande enregistrée", langue: "fr-FR" },
  en: { chemin: "/en/form/",    fin: "Request received",    langue: "en-GB" },
};
const L = LANGUES[CODE];
if (!L) throw new Error("langue inconnue : " + CODE);

const BASE = process.env.ADRESSE || "http://127.0.0.1:8777";
const navigateur = await pw.chromium.launch();
const contexte = await navigateur.newContext({
  viewport: { width: 390, height: 844 }, locale: L.langue,
});
const page = await contexte.newPage();

const soucis = [];
page.on("pageerror", (e) => soucis.push("erreur JS : " + e.message));
page.on("console", (m) => { if (m.type() === "error") soucis.push("console : " + m.text()); });

let interceptes = 0;
await page.route("**/rest/v1/**", (r) => {
  interceptes++;
  r.fulfill({ status: 201, contentType: "application/json", body: "[]" });
});
await page.route("**/storage/v1/**", (r) =>
  r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));

await page.goto(BASE + L.chemin, { waitUntil: "networkidle" });

/* On relève la question de chaque écran : si l'une d'elles reste en
   français dans la version anglaise, elle se lit dans le journal. */
const etapes = [];
const question = () => page.evaluate(() =>
  document.querySelector("#screen .q, #screen .ok h2, #screen .ok h3")?.textContent.trim() || "");

async function toucher(sel) {
  const q = await question();
  await page.waitForSelector(sel, { state: "visible", timeout: 5000 });
  await page.click(sel);
  await page.waitForTimeout(260);
  etapes.push([q, sel]);
}
async function ecrire(sel, txt) {
  await page.fill(sel, txt);
  await page.waitForTimeout(120);
}

/* Les quatre portes d'entrée : on pousse chacune d'un écran, pour qu'une
   phrase oubliée dans une branche qu'on ne joue pas se voie quand même. */
const portes = [];
for (const intent of ["urgence", "depannage", "projet", "energie"]) {
  await page.goto(BASE + L.chemin, { waitUntil: "domcontentloaded" });
  await page.click(`[data-intent="${intent}"]`);
  await page.waitForTimeout(220);
  portes.push([intent, await question()]);
}
await page.goto(BASE + L.chemin, { waitUntil: "domcontentloaded" });

await toucher('[data-intent="depannage"]');
await toucher('[data-trade="plomberie"]');
await toucher('[data-lieu="privatif"]');
await toucher('[data-statut="locataire"]');
await ecrire("#w-adr", "12 rue des Lauriers, Cannes");
await toucher("#screen .cta:not([disabled])");
await ecrire("#c-nom", "Claire Martin");
await ecrire("#c-tel", "06 12 34 56 78");
await toucher("#c-ok");
await toucher("#screen .cta:not([disabled])");
await page.waitForTimeout(1800);

const fin = await question();
const deborde = await page.evaluate(() =>
  document.documentElement.scrollWidth > document.documentElement.clientWidth);
await contexte.close();
await navigateur.close();

console.log(`\n=== ${CODE} · ${L.chemin} ===`);
for (const [i, q] of portes) console.log(`  ${i.padEnd(10)} → « ${q} »`);
console.log("");
for (const [q, sel] of etapes) console.log(`  « ${q} »`.padEnd(52), sel);
console.log(`  → « ${fin} »`);
console.log(`\n${interceptes} appel(s) intercepté(s) · débordement horizontal : ${deborde ? "OUI" : "non"}`);
for (const s of soucis) console.log("  !! " + s);

const mauvais = [];
if (fin !== L.fin) mauvais.push(`le parcours finit sur « ${fin} » au lieu de « ${L.fin} »`);
if (deborde) mauvais.push("la page déborde horizontalement à 390 px");
if (soucis.length) mauvais.push(soucis.length + " erreur(s) de script");
/* Un mot grammatical français dans une page anglaise : la traduction a
   laissé passer une phrase que le rapport de construction n'a pas vue. */
if (CODE !== "fr") {
  const fr = etapes.map(([q]) => q).concat(portes.map(([, q]) => q)).concat(fin)
    .filter((q) => /\b(vous|votre|nous|notre|quel|quelle|est-ce|dans|avec)\b/i.test(q));
  if (fr.length) mauvais.push("reste(nt) en français : " + fr.join(" | "));
}
if (mauvais.length) { console.log(""); for (const m of mauvais) console.log("ÉCHEC : " + m); process.exit(1); }
console.log("\nparcours complet, sans reproche.");
