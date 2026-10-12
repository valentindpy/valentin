/* =====================================================================
   VD SERVICES — les deux accusés de réception disent-ils la même chose ?

       node --experimental-strip-types outils/verifier-accuse.mjs

   docs/modeles/mails-automatiques.md pose une règle : le texte envoyé
   automatiquement par la fonction Supabase et le texte que la
   plateforme vous montre doivent être identiques, au caractère près.
   Deux fichiers, deux langages, la même phrase : la règle ne tient que
   si quelque chose la vérifie.

   Ce script prend la fonction `accuseReception` de la plateforme, celle
   de la fonction d'envoi, les fait tourner sur les cinq parcours, et
   compare ligne à ligne. Il sort en erreur au premier écart, pour qu'un
   jour de modification pressée le dise tout de suite.
   ===================================================================== */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = dirname(dirname(fileURLToPath(import.meta.url)));

/* ---------- la plateforme : on découpe ce dont le texte dépend ---------- */
/* La plateforme est une page, pas un module : on en extrait les sept
   morceaux qui servent au texte, et on les charge comme un module. */
function morceauxDeLaPlateforme() {
  const page = readFileSync(join(RACINE, "docs/regie-copro.html"), "utf8");
  const jusquEnFinDeLigne = (debut) => {
    const i = page.indexOf(debut);
    if (i < 0) throw new Error("introuvable dans la plateforme : " + debut);
    return page.slice(i, page.indexOf("\n", i));
  };
  const parBornes = (debut, fin) => {
    const i = page.indexOf(debut), j = page.indexOf(fin);
    if (i < 0 || j < 0) throw new Error("introuvable dans la plateforme : " + debut);
    return page.slice(i, j);
  };
  const expression = (re) => {
    const m = page.match(re);
    if (!m) throw new Error("introuvable dans la plateforme : " + re);
    return m[0];
  };
  return [
    /* la société et les entreprises, telles que la plateforme les lit */
    'var DATA={prestataires:[],reglages:[{id:"societe",nom:"VD SERVICES",' +
    'repnom:"Valentin Dupuy",tel:"+33646843082",email:"vdpy05@gmail.com"}]};',
    expression(/var INTENT=\{[\s\S]*?\};/),
    expression(/var MET=\{[\s\S]*?\};/),
    jusquEnFinDeLigne("function metiersOf(d){"),
    jusquEnFinDeLigne("function prestaLabels(d){"),
    jusquEnFinDeLigne("function jour(iso){"),
    expression(/function societe\(\)\{[\s\S]*?\n\}/),
    /* le pied de message, commun a l'accuse, au point d'avancement et
       au mot de fin de chantier */
    expression(/function signature\(v\)\{[\s\S]*?\n\}/),
    /* la borne de fin est le commentaire du point d'avancement, qui suit
       immediatement : prendre jusqu'a texteMail embarquerait les trois
       fonctions voisines, et signature() deux fois */
    parBornes("function accuseReception(d){", "/* ---------- le point d'avancement"),
    "export {accuseReception};",
  ].join("\n");
}

const module = "data:text/javascript;base64," +
  Buffer.from(morceauxDeLaPlateforme(), "utf8").toString("base64");
const { accuseReception: plateforme } = await import(module);
const { accuseReception: fonction } = await import(
  join(RACINE, "supabase/functions/_commun/texte.ts")
);

/* ---------- l'expéditeur, le même des deux côtés ---------- */
const SOCIETE = {
  nom: "VD SERVICES",
  repnom: "Valentin Dupuy",
  tel: "+33646843082",
  email: "vdpy05@gmail.com",
};

/* ---------- les cinq parcours, et les trous qu'ils laissent ---------- */
/* Un cas par parcours, et dans chacun quelque chose d'absent : pas de
   description, pas de nom, pas de photo. C'est là que deux textes
   écrits séparément divergent — jamais sur le cas complet. */
const CAS = [
  {
    titre: "dépannage, tout rempli",
    photos: 2,
    d: {
      id: "1", ref: "VD-261011-D001", intent: "depannage",
      trades: ["plomberie", "carrelage"],
      presta: ["plomberie|Remplacement d'un WC complet"],
      lieu: "privatif", residence: "Les Mimosas", adresse: "12 rue des Lauriers",
      cp: "06210", ville: "Mandelieu-la-Napoule",
      precision: "bât. B, 3e étage", precision_lieu: "bât. B, 3e étage",
      nom: "Claire Martin", tel: "0612345678", email: "claire@example.fr",
      description: "fuite sous l'évier, l'eau est coupée", photos: [{}, {}], assignes: [],
    },
  },
  {
    titre: "urgence, aucune entreprise encore désignée",
    photos: 0,
    d: {
      id: "2", ref: "VD-261011-U002", intent: "urgence", trades: ["plomberie"], presta: [],
      lieu: "commun", ville: "Cannes", nom: "M. Durand", tel: "0699887766",
      description: "", photos: [], assignes: [],
    },
  },
  {
    titre: "projet, sans nom ni description",
    photos: 0,
    d: {
      id: "3", ref: "VD-261011-P003", intent: "projet", trades: ["peinture"],
      presta: ["peinture|Mise en peinture d'une cage d'escalier"], lieu: "commun",
      residence: "Le Phare", ville: "Nice", nom: "", tel: "", email: "syndic@example.fr",
      photos: [], assignes: [],
    },
  },
  {
    titre: "travaux financés",
    photos: 1,
    d: {
      id: "4", ref: "VD-261011-E004", intent: "energie", trades: ["chauffage"], presta: [],
      lieu: "privatif", ville: "Fréjus", nom: "Paul", tel: "0611111111",
      description: "pompe à chaleur", photos: [{}], assignes: [],
    },
  },
  {
    titre: "consultation publique, avec date limite",
    photos: 0,
    d: {
      id: "5", ref: "VD-261011-A005", intent: "public", trades: ["verts", "menage"], presta: [],
      lieu: "commun", ville: "Mandelieu-la-Napoule", nom: "Services techniques",
      email: "st@ville.fr", nbDevis: 3, dateLimite: "2026-11-15", photos: [], assignes: [],
    },
  },
];

let ecarts = 0;
for (const cas of CAS) {
  const attendu = plateforme(cas.d);
  /* la fonction lit une ligne de Postgres : les champs rares y sont
     rangés dans `extra`, comme l'adaptateur les y met */
  const obtenu = fonction(
    { ...cas.d, extra: { nbDevis: cas.d.nbDevis, dateLimite: cas.d.dateLimite } },
    SOCIETE,
    cas.photos,
  );
  let bon = true;
  for (const champ of ["corps", "sms"]) {
    if (attendu[champ] === obtenu[champ]) continue;
    bon = false;
    ecarts++;
    console.log("\n=== écart · " + cas.titre + " · " + champ + " ===");
    const a = attendu[champ].split("\n"), b = obtenu[champ].split("\n");
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      if (a[i] === b[i]) continue;
      console.log("  plateforme : " + JSON.stringify(a[i] ?? null));
      console.log("  fonction   : " + JSON.stringify(b[i] ?? null));
    }
  }
  console.log(
    (bon ? "identique" : "DIFFÉRENT") + "  " + cas.titre.padEnd(44) +
      attendu.corps.length + " car., SMS " + attendu.sms.length,
  );
  /* Un SMS plus long que 160 caractères part en deux, et se paie deux
     fois. La règle est écrite dans mails-automatiques.md. */
  if (attendu.sms.length > 160) {
    ecarts++;
    console.log("  SMS trop long : " + attendu.sms.length + " caractères");
  }
}

console.log(
  ecarts
    ? "\n" + ecarts + " écart(s) — le texte envoyé n'est plus celui que la plateforme montre."
    : "\nLes deux textes sont identiques sur les cinq parcours.",
);
process.exit(ecarts ? 1 : 0);
