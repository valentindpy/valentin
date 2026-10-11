/* =====================================================================
   VD SERVICES — le texte de l'accusé de réception

   Ce fichier est la traduction, mot pour mot, de la fonction
   `accuseReception` de docs/regie-copro.html. C'est une règle écrite
   dans docs/modeles/mails-automatiques.md : le texte envoyé
   automatiquement et le texte que la plateforme vous montre doivent
   être le même. Si l'un change, l'autre change le même jour.

   La seule différence tient à la source : la plateforme lit un objet
   aux noms de la plateforme (statutDemandeur), ici on lit une ligne de
   Postgres (statut_demandeur).
   ===================================================================== */

import type { Societe } from "./envoi.ts";

export const INTENT: Record<string, string> = {
  urgence: "Urgence",
  depannage: "Dépannage",
  projet: "Projet",
  energie: "Travaux financés",
  public: "Consultation publique",
};

export const MET: Record<string, string> = {
  plomberie: "Plomberie",
  electricite: "Électricité",
  chauffage: "Chauffage",
  clim: "Climatisation, VMC",
  serrurerie: "Serrurerie",
  couverture: "Couverture, étanchéité",
  peinture: "Peinture",
  platrerie: "Plâtrerie",
  carrelage: "Carrelage, sols",
  menuiserie: "Menuiserie",
  verts: "Espaces verts",
  menage: "Ménage, nettoyage",
  autre: "Autre",
};

export type Demande = {
  id: string;
  ref: string;
  intent?: string | null;
  trades?: string[] | null;
  presta?: string[] | null;
  lieu?: string | null;
  residence?: string | null;
  adresse?: string | null;
  cp?: string | null;
  ville?: string | null;
  precision_lieu?: string | null;
  nom?: string | null;
  tel?: string | null;
  email?: string | null;
  description?: string | null;
  extra?: Record<string, unknown> | null;
};

/* Le même format court que la plateforme — 11/10/26, pas 11/10/2026 :
   deux textes qui doivent être identiques le sont jusqu'à la date. */
function jour(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime())
    ? String(iso)
    : d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

/* Les deux listes arrivent telles que le formulaire les a écrites : des
   identifiants de métier d'un côté, des libellés déjà lisibles de
   l'autre, préfixés du métier auquel ils appartiennent. */
function metiers(d: Demande): string[] {
  return (d.trades || []).map((t) => MET[t] || t);
}
function prestations(d: Demande): string[] {
  return (d.presta || []).map((k) => String(k).split("|")[1] || String(k));
}

export function accuseReception(
  d: Demande,
  soc: Societe,
  photos = 0,
): { objet: string; corps: string; sms: string } {
  const lieu = [d.residence, d.adresse, [d.cp, d.ville].filter(Boolean).join(" ")]
    .filter(Boolean).join(", ");
  const L: string[] = [];
  let ligne1 = "";
  let delai = "";

  /* Au moment du dépôt, aucune entreprise n'est encore désignée :
     l'accusé promet donc le rappel immédiat, exactement ce qu'annonce
     le dernier écran du formulaire. La mise en relation nommée avec
     l'entreprise d'astreinte part de la plateforme, qui sait laquelle. */
  if (d.intent === "urgence") {
    ligne1 = "Votre demande urgente est enregistrée.";
    delai = "Nous vous rappelons dans les minutes qui viennent.";
  } else if (d.intent === "depannage") {
    ligne1 = "Votre demande de dépannage est enregistrée.";
    delai =
      "Nous vous rappelons aujourd'hui pour confirmer le créneau. L'intervention est programmée sous 72 heures.";
  } else if (d.intent === "projet") {
    ligne1 = "Votre projet de travaux est enregistré.";
    delai =
      "Nous vous rappelons sous 48 heures pour convenir d'une visite sur place. Vous recevrez ensuite des devis comparables, établis sur le même descriptif.";
  } else if (d.intent === "energie") {
    ligne1 = "Votre demande de travaux énergétiques est enregistrée.";
    delai =
      "Nous vous rappelons sous 48 heures avec le point sur le financement mobilisable. Important : ne signez aucun devis avant cet échange, la plupart des aides doivent être demandées avant la signature.";
  } else if (d.intent === "public") {
    const extra = d.extra || {};
    ligne1 = "Votre consultation est enregistrée.";
    delai = "Nous lançons la mise en concurrence auprès des entreprises du secteur et nous vous revenons avec " +
      (extra.nbDevis || "plusieurs") + " devis comparables" +
      (extra.dateLimite ? ", avant le " + jour(String(extra.dateLimite)) : "") + ".";
  } else {
    ligne1 = "Votre demande est enregistrée.";
    delai = "Nous vous rappelons rapidement.";
  }

  const objet = soc.nom + " — votre demande " + d.ref + " est bien arrivée";
  L.push("Objet : " + objet);
  L.push("");
  L.push("Bonjour" + (d.nom ? " " + d.nom : "") + ",");
  L.push("");
  L.push(ligne1 + " Elle porte la référence " + d.ref + ", à rappeler si vous nous écrivez.");
  L.push("");
  L.push(delai);
  L.push("");
  L.push("CE QUE NOUS AVONS NOTÉ");
  L.push("  Nature : " + (INTENT[String(d.intent)] || "—"));
  if (metiers(d).length) L.push("  Corps de métier : " + metiers(d).join(", "));
  if (prestations(d).length) L.push("  Prestations : " + prestations(d).join(", "));
  if (lieu) L.push("  Adresse : " + lieu + (d.precision_lieu ? " (" + d.precision_lieu + ")" : ""));
  L.push(
    "  Situation : " +
      (d.lieu === "commun"
        ? "parties communes"
        : d.lieu === "privatif"
        ? "partie privative"
        : "à déterminer sur place"),
  );
  if (d.description) L.push("  Votre description : « " + d.description + " »");
  if (photos) L.push("  Photos reçues : " + photos);
  L.push("");
  L.push("Si l'une de ces informations est inexacte, répondez simplement à ce message.");
  L.push("");
  L.push(
    "Ce que nous faisons pour vous : nous cherchons l'entreprise qui convient parmi celles de notre réseau, toutes assurées et vérifiées, nous vous transmettons le devis et nous suivons l'intervention jusqu'à la fin. Vous n'avez qu'un seul interlocuteur.",
  );
  L.push("");
  L.push("Cordialement,");
  L.push(soc.repnom);
  L.push(soc.nom + " — consultation, pilotage, coordination et assistance");
  L.push("Mandelieu-la-Napoule — secteur Fréjus / Nice");
  if (soc.tel) L.push(soc.tel);
  if (soc.email) L.push(soc.email);
  L.push("");
  L.push("--");
  L.push(
    "Vos coordonnées ne servent qu'au traitement de cette demande et ne sont transmises qu'à l'entreprise retenue. Elles sont conservées trois ans. Pour les faire supprimer, répondez à ce message.",
  );

  const sms = soc.nom + " : demande " + d.ref + " bien reçue. " +
    (d.intent === "urgence"
      ? "Nous vous rappelons tout de suite"
      : d.intent === "depannage"
      ? "Nous vous rappelons aujourd'hui"
      : "Nous vous rappelons sous 48 h") +
    ". " + (soc.tel || "");

  return { objet: objet, corps: L.join("\n"), sms: sms };
}

/* ---------- ce que vous recevez, vous ---------- */
/* Court, lisible sur un écran verrouillé, et dans l'ordre où la
   décision se prend : d'abord la nature, puis où, puis qui rappeler. */
export function alerteInterne(d: Demande, photos = 0): { objet: string; corps: string; sms: string } {
  const lieu = [d.residence, d.adresse, [d.cp, d.ville].filter(Boolean).join(" ")]
    .filter(Boolean).join(", ");
  const nature = INTENT[String(d.intent)] || "Demande";
  const objet = (d.intent === "urgence" ? "URGENCE — " : "") + nature + " — " + d.ref +
    (d.ville ? " — " + d.ville : "");
  const L: string[] = [];
  L.push("Objet : " + objet);
  L.push("");
  L.push(nature.toUpperCase() + " · " + d.ref);
  if (metiers(d).length) L.push("Métier : " + metiers(d).join(", "));
  if (prestations(d).length) L.push("Prestations : " + prestations(d).join(", "));
  if (lieu) L.push("Lieu : " + lieu + (d.precision_lieu ? " (" + d.precision_lieu + ")" : ""));
  L.push(
    "Situation : " +
      (d.lieu === "commun" ? "parties communes" : d.lieu === "privatif" ? "partie privative" : "à déterminer"),
  );
  L.push("Demandeur : " + [d.nom, d.tel, d.email].filter(Boolean).join(" · "));
  if (d.description) L.push("Description : « " + d.description + " »");
  if (photos) L.push("Photos : " + photos);
  L.push("");
  L.push("La fiche complète est dans la plateforme, onglet Demandes.");

  const sms = (d.intent === "urgence" ? "URGENCE " : "") + d.ref + " " +
    (metiers(d).join(", ") || nature) + " · " + (d.ville || lieu || "lieu à préciser") + " · " +
    (d.nom || "demandeur") + " " + (d.tel || d.email || "sans contact");

  return { objet: objet, corps: L.join("\n"), sms: sms.slice(0, 300) };
}
