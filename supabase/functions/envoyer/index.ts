/* =====================================================================
   VD SERVICES — envoyer depuis la plateforme, pour de bon

   La plateforme rédige depuis le premier jour les demandes de devis et
   les accusés de réception. Elle ne savait que les copier : à vous
   d'ouvrir votre messagerie, de coller, d'envoyer, et de vous souvenir
   que vous l'avez fait.

   Cette fonction prend le texte que vous venez de relire et l'envoie.
   Elle ne le réécrit pas : ce que vous avez lu est ce qui part. Puis
   elle l'écrit dans `messages` — qui a reçu quoi, quand, et le texte
   complet. C'est cette ligne qui rend opposable le délai de cinq jours
   ouvrés de la convention d'apport.

   Seul un administrateur connecté peut l'appeler. La clé publique du
   formulaire, qui est un jeton valable, ne suffit pas : le rôle est lu
   dans le jeton, puis vérifié dans la table des profils.
   ===================================================================== */

import {
  ajouterAuSuivi,
  ENTETES_CORS,
  envoyerMail,
  envoyerSms,
  estMail,
  journaliser,
  json,
  reglage,
  roleDuJeton,
  societe,
} from "../_commun/envoi.ts";

/* Le rôle est dans la table, pas dans le jeton : un compte peut être
   retiré des administrateurs sans que son jeton, valable une heure,
   l'apprenne. On le demande donc à la base, avec le jeton de l'appelant
   — c'est la politique `profils_moi` qui répond. */
async function estAdmin(req: Request): Promise<boolean> {
  if (roleDuJeton(req) !== "authenticated") return false;
  try {
    const r = await fetch(reglage("SUPABASE_URL") + "/rest/v1/profils?select=role", {
      headers: {
        apikey: reglage("SUPABASE_ANON_KEY"),
        Authorization: req.headers.get("Authorization") || "",
      },
    });
    if (!r.ok) return false;
    const l = await r.json();
    return Array.isArray(l) && l[0] && l[0].role === "admin";
  } catch {
    return false;
  }
}

/* « a@b.fr; c@d.fr, e@f.fr » — la plateforme sépare au point-virgule,
   une adresse collée à la main arrive parfois avec une virgule. */
function listeDestinataires(brut: string): string[] {
  return String(brut || "")
    .split(/[;,]/)
    .map((x) => x.trim())
    .filter(Boolean);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: ENTETES_CORS });
  if (req.method !== "POST") return json({ erreur: "POST attendu" }, 405);
  if (!(await estAdmin(req))) return json({ erreur: "réservé à l'administrateur" }, 403);

  let dem: {
    demandeId?: string;
    genre?: string;
    canal?: string;
    destinataires?: string;
    objet?: string;
    corps?: string;
    suivi?: string;
  };
  try {
    dem = await req.json();
  } catch {
    return json({ erreur: "corps illisible" }, 400);
  }

  const canal = dem.canal === "sms" ? "sms" : "email";
  const corps = String(dem.corps || "").trim();
  if (!corps) return json({ erreur: "message vide" }, 400);

  /* La plateforme met l'objet sur la première ligne du texte, comme
     dans un brouillon qu'on relit. On le reprend là, et on ne le laisse
     pas dans le corps : personne n'écrit « Objet : » dans un mail. */
  let objet = String(dem.objet || "").trim();
  let texte = corps;
  const premiere = corps.split("\n")[0] || "";
  if (/^Objet\s*:/i.test(premiere)) {
    if (!objet) objet = premiere.replace(/^Objet\s*:\s*/i, "").trim();
    texte = corps.split("\n").slice(1).join("\n").replace(/^\n+/, "");
  }
  if (!objet) objet = "VD SERVICES";

  const soc = await societe();
  const vers = listeDestinataires(dem.destinataires || "");
  if (!vers.length) return json({ erreur: "aucun destinataire" }, 400);

  const envois: Array<{ vers: string; ok: boolean; erreur?: string }> = [];
  for (const dest of vers) {
    /* Un message par entreprise, jamais une seule copie à plusieurs :
       une entreprise consultée n'a pas à connaître la liste de ses
       concurrentes. C'est la même règle que les colonnes de prix du
       bordereau, appliquée aux adresses. */
    try {
      if (canal === "email" && !estMail(dest)) throw new Error("adresse inutilisable");
      const reference = canal === "email"
        ? await envoyerMail(dest, objet, texte, soc)
        : await envoyerSms(dest, texte);
      await journaliser({
        demande_id: dem.demandeId || null,
        genre: dem.genre || "autre",
        canal: canal,
        destinataire: dest,
        objet: objet,
        corps: texte,
        reference: reference,
      });
      envois.push({ vers: dest, ok: true });
    } catch (e) {
      const raison = (e as Error).message;
      console.error("envoi à " + dest, raison);
      await journaliser({
        demande_id: dem.demandeId || null,
        genre: dem.genre || "autre",
        canal: canal,
        destinataire: dest,
        objet: objet,
        corps: texte,
        statut: "erreur",
        erreur: raison,
      });
      envois.push({ vers: dest, ok: false, erreur: raison });
    }
  }

  const partis = envois.filter((e) => e.ok);
  if (dem.demandeId && partis.length) {
    await ajouterAuSuivi(
      dem.demandeId,
      (dem.suivi || "Message envoyé") + " — " + partis.map((e) => e.vers).join(", "),
    );
  }
  const rates = envois.filter((e) => !e.ok);
  if (dem.demandeId && rates.length) {
    await ajouterAuSuivi(
      dem.demandeId,
      "Échec de l'envoi à " + rates.map((e) => e.vers + " (" + e.erreur + ")").join(", "),
    );
  }

  return json({ ok: rates.length === 0, envoyes: partis.length, envois: envois });
});
