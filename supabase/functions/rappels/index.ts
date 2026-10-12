/* =====================================================================
   VD SERVICES — le rappel des demandes qui dorment

   Rien ne signalait une demande restée trois jours sans action. Le
   tableau de bord affiche les plus anciennes, mais il faut y aller pour
   les voir, et une demande oubliée par semaine est certaine à deux
   interventions par jour.

   Cette fonction est appelée une fois par jour par la base
   (`supabase/05-rappels.sql`). Elle lit les demandes encore ouvertes,
   garde celles qui dépassent leur délai, et vous en envoie la liste —
   une seule fois, en un seul message. Un rappel par demande finirait
   comme une alerte de plus qu'on apprend à ignorer.

   Le seuil dépend de la nature, parce qu'une urgence qui traîne une
   journée est un problème et un projet qui traîne une journée, non :

     urgence     1 jour
     dépannage   2 jours
     le reste    5 jours
   ===================================================================== */

import {
  base,
  ENTETES_CORS,
  envoyerMail,
  journaliser,
  json,
  reglage,
  roleDuJeton,
  societe,
} from "../_commun/envoi.ts";
import { INTENT } from "../_commun/texte.ts";

const SEUILS: Record<string, number> = { urgence: 1, depannage: 2 };
const SEUIL_PAR_DEFAUT = 5;

type Ligne = {
  id: string;
  ref: string;
  intent: string | null;
  etat: string | null;
  recu: string;
  nom: string | null;
  tel: string | null;
  ville: string | null;
};

function jours(depuis: string): number {
  const j = Math.floor((Date.now() - new Date(depuis).getTime()) / 86400000);
  return isNaN(j) ? 0 : j;
}

const ETATS: Record<string, string> = {
  nouvelle: "jamais touchée",
  devis: "devis demandé",
  chiffre: "chiffrée",
  planifiee: "planifiée",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: ENTETES_CORS });
  if (roleDuJeton(req) !== "service_role") return json({ erreur: "appel refusé" }, 401);

  /* Ni les clôturées, ni les sans-suite, ni les exemples : une demande
     sans suite est fermée, elle n'a pas à revenir vous hanter. */
  const lignes = await base(
    "/rest/v1/demandes?etat=not.in.(close,sanssuite)&exemple=is.false" +
      "&select=id,ref,intent,etat,recu,nom,tel,ville&order=recu.asc",
  ) as Ligne[] | null;

  const tard = (lignes || []).filter((d) => {
    const seuil = SEUILS[String(d.intent)] ?? SEUIL_PAR_DEFAUT;
    return jours(d.recu) >= seuil;
  });

  if (!tard.length) return json({ ok: true, enRetard: 0 });

  const soc = await societe();
  const L: string[] = [];
  const objet = soc.nom + " — " + tard.length + " demande(s) en attente";
  L.push(tard.length + " demande(s) ouverte(s) dépassent leur délai.");
  L.push("");
  for (const d of tard) {
    L.push(
      jours(d.recu) + " j · " + d.ref + " · " + ((INTENT[String(d.intent)]) || "—") +
        " · " + (d.ville || "lieu non précisé") +
        " · " + (ETATS[String(d.etat)] || d.etat || "—"),
    );
    L.push("    " + [d.nom, d.tel].filter(Boolean).join(" · "));
  }
  L.push("");
  L.push("Seuils : 1 jour en urgence, 2 en dépannage, 5 pour le reste.");
  L.push("Les fiches sont dans la plateforme, onglet Demandes.");

  const vers = reglage("ALERTE_EMAIL", soc.email);
  const corps = L.join("\n");
  try {
    const reference = await envoyerMail(vers, objet, corps, soc);
    await journaliser({
      genre: "rappel",
      canal: "email",
      destinataire: vers,
      objet: objet,
      corps: corps,
      reference: reference,
    });
  } catch (e) {
    const raison = (e as Error).message;
    console.error("rappel quotidien", raison);
    await journaliser({
      genre: "rappel",
      canal: "email",
      destinataire: vers,
      objet: objet,
      corps: corps,
      statut: "erreur",
      erreur: raison,
    });
    return json({ ok: false, enRetard: tard.length, erreur: raison });
  }

  return json({ ok: true, enRetard: tard.length });
});
