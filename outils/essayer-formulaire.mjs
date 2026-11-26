/* =====================================================================
   VD SERVICES — les cinq parcours joués jusqu'au bout, dans une langue

       python3 -m http.server 8777 --directory site
       node outils/essayer-formulaire.mjs            (français)
       node outils/essayer-formulaire.mjs en         (anglais)

   POURQUOI LES CINQ, ET PAS UN SEUL
   Une version de ce script ne jouait que le dépannage. Pendant ce
   temps, deux parcours sur cinq — les travaux énergétiques financés et
   celui des entités publiques — étaient impossibles à terminer : taper
   son adresse y désactivait le bouton « Continuer » à chaque touche.
   Le dépannage, lui, passait. Un test qui ne visite qu'un chemin ne
   dit rien des quatre autres.

   L'ORDRE COMPTE
   Chaque parcours est joué dans l'ordre naturel : on choisit d'abord,
   on tape ensuite. C'est précisément cet ordre qui était cassé —
   remplir le champ AVANT le dernier choix marchait, ce que personne
   ne fait. Ne changez pas l'ordre des pas pour faire passer le test.

   ON VISE PAR DATA-ATTRIBUT ET NON PAR LIBELLÉ
   `data-statut="locataire"` désigne le même bouton dans toutes les
   langues, là où « Locataire » n'existe qu'en français. C'est aussi ce
   qui prouve que la traduction n'a pas touché aux identifiants.

   RIEN N'EST ENVOYÉ À LA BASE : les appels Supabase sont interceptés.
   ===================================================================== */

import pw from "playwright";

const CODE = process.argv[2] || "fr";
const LANGUES = {
  fr: { chemin: "/formulaire/", fin: "Demande enregistrée", langue: "fr-FR" },
  en: { chemin: "/en/form/", fin: "Request received", langue: "en-GB" },
};
const L = LANGUES[CODE];
if (!L) throw new Error("langue inconnue : " + CODE);

const ADR = "12 rue des Lauriers, Cannes";
const TEL = "06 12 34 56 78";

/* Un pas vaut : ["clic", sélecteur] · ["saisie", sélecteur, texte]
   · ["suite"] pour le bouton « Continuer » de l'écran courant.      */
const PARCOURS = [
  { nom: "urgence", pas: [
    ["clic", '[data-intent="urgence"]'],
    ["clic", '[data-trade="plomberie"]'],
    ["saisie", "#u-tel", TEL],
    ["clic", '[data-go="done"]'],
  ] },
  { nom: "dépannage", pas: [
    ["clic", '[data-intent="depannage"]'],
    ["clic", '[data-trade="plomberie"]'],
    ["clic", '[data-lieu="privatif"]'],
    ["clic", '[data-statut="locataire"]'],
    ["saisie", "#w-adr", ADR],
    ["suite"],
    ["saisie", "#c-nom", "Claire Martin"],
    ["saisie", "#c-tel", TEL],
    ["clic", "#c-ok"],
    ["suite"],
  ] },
  { nom: "projet", pas: [
    ["clic", '[data-intent="projet"]'],
    ["clic", '[data-projet="appart"]'],
    ["clic", '[data-lieu="privatif"]'],
    ["clic", '[data-statut="occupant"]'],
    ["saisie", "#w-adr", ADR],
    ["suite"],
    ["clic", '[data-presta^="global|"]'],
    ["clic", '[data-delai="asap"]'],
    ["clic", '[data-budget="15 à 50 k€"]'],
    ["saisie", "#s-desc", "Appartement de 65 m2 à refaire entièrement avant mise en location."],
    ["suite"],
    ["saisie", "#c-nom", "Claire Martin"],
    ["saisie", "#c-tel", TEL],
    ["clic", "#c-ok"],
    ["suite"],
  ] },
  { nom: "énergie", pas: [
    ["clic", '[data-intent="energie"]'],
    ["clic", '[data-geste="pac_ae"]'],
    ["suite"],
    ["clic", '[data-logement="maison"]'],
    ["clic", '[data-anciennete="plus15"]'],
    ["clic", '[data-occupation="occupant"]'],
    ["clic", '[data-usage="principale"]'],
    ["saisie", "#e-adr", ADR],   // l'adresse APRÈS les choix : l'ordre qui cassait
    ["suite"],
    ["clic", '[data-personnes="3"]'],
    ["clic", '[data-revenus="r1"]'],
    ["clic", '[data-chauffage="fioul"]'],
    ["clic", '[data-devis="non"]'],
    ["suite"],
    ["saisie", "#c-nom", "Claire Martin"],
    ["saisie", "#c-tel", TEL],
    ["clic", "#c-ok"],
    ["suite"],
  ] },
  { nom: "entité publique", pas: [
    ["clic", '[data-intent="public"]'],
    ["clic", '[data-entite="commune"]'],
    ["clic", "#screen [data-fonction]"],
    ["saisie", "#pu-org", "Commune de Mandelieu-la-Napoule"],  // idem
    ["suite"],
    ["clic", '[data-nature="travaux"], #screen [data-nature]'],
    ["clic", '[data-trade="peinture"]'],
    ["saisie", "#pu-adr", "Avenue Janvier Passero, Mandelieu"],
    ["saisie", "#pu-desc", "Remise en peinture du hall et de la cage d'escalier."],
    ["suite"],
    ["clic", "#screen [data-nbdevis], #screen [data-devis]"],
    ["clic", "#screen [data-montant]"],
    ["suite"],
    ["saisie", "#c-nom", "Claire Martin"],
    ["saisie", "#c-tel", TEL],
    // Une consultation publique se répond par écrit : l'adresse e-mail
    // y est exigée, là où elle reste facultative ailleurs.
    ["saisie", "#c-mail", "services.techniques@exemple.fr"],
    ["clic", "#c-ok"],
    ["suite"],
  ] },
];

const BASE = process.env.ADRESSE || "http://127.0.0.1:8777";
const navigateur = await pw.chromium.launch();
const contexte = await navigateur.newContext({
  viewport: { width: 390, height: 844 }, locale: L.langue,
  /* Sans cela, le service worker ressert la version précédente du
     formulaire : le script testerait la build d'hier. */
  serviceWorkers: "block",
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

const question = () => page.evaluate(() =>
  document.querySelector("#screen .q, #screen .ok h2, #screen .ok h3")?.textContent.trim() || "");

const echecs = [];
console.log(`\n=== ${CODE} · ${BASE}${L.chemin} ===`);

for (const { nom, pas } of PARCOURS) {
  await page.goto(BASE + L.chemin, { waitUntil: "networkidle" });
  const vus = [];
  let dernier = "";
  let mort = null;

  for (const [quoi, sel, txt] of pas) {
    const q = await question();
    if (q && q !== dernier) { vus.push(q); dernier = q; }
    try {
      if (quoi === "saisie") {
        await page.waitForSelector(sel, { state: "visible", timeout: 4000 });
        await page.fill(sel, txt);
      } else {
        const cible = quoi === "suite" ? "#screen .cta:not([disabled]):not(a)" : sel;
        await page.waitForSelector(cible, { state: "visible", timeout: 4000 });
        await page.click(cible);
      }
    } catch (e) {
      mort = `${quoi} ${sel || "« Continuer »"} — ${String(e).split("\n")[0].slice(0, 90)}`;
      break;
    }
    await page.waitForTimeout(220);
  }
  await page.waitForTimeout(1200);
  const fin = await question();
  const ok = !mort && fin === L.fin;
  console.log(`\n  ${ok ? "✓" : "✗"} ${nom}`);
  for (const v of vus) console.log("      · " + v);
  console.log(`      → « ${fin} »`);
  if (mort) { console.log("      bloqué sur : " + mort); echecs.push(`${nom} : bloqué sur ${mort}`); }
  else if (!ok) echecs.push(`${nom} : finit sur « ${fin} » au lieu de « ${L.fin} »`);

  /* Un mot grammatical français dans un écran anglais : la traduction a
     laissé passer une phrase que le rapport de construction n'a pas vue. */
  if (CODE !== "fr") {
    const reste = vus.concat(fin).filter((q) =>
      /\b(vous|votre|nous|notre|quel|quelle|est-ce|dans|avec|les|des)\b/i.test(q));
    if (reste.length) echecs.push(`${nom} : reste(nt) en français — ${reste.join(" | ")}`);
  }
}

const deborde = await page.evaluate(() =>
  document.documentElement.scrollWidth > document.documentElement.clientWidth);
await contexte.close();
await navigateur.close();

console.log(`\n${interceptes} appel(s) intercepté(s) · débordement horizontal : ${deborde ? "OUI" : "non"}`);
for (const s of soucis) console.log("  !! " + s);
if (deborde) echecs.push("la page déborde horizontalement à 390 px");
if (soucis.length) echecs.push(soucis.length + " erreur(s) de script");

if (echecs.length) { console.log(""); for (const m of echecs) console.log("ÉCHEC : " + m); process.exit(1); }
console.log("\nles cinq parcours vont jusqu'à la confirmation, sans reproche.");
