/* =====================================================================
   VD SERVICES — ce qui sait envoyer, et ce qui en garde la trace

   Les deux fonctions de ce dossier partagent ce fichier : l'une envoie
   l'accusé de réception sans que personne ne clique, l'autre envoie ce
   que vous avez relu dans la plateforme. Ce qu'elles font toutes les
   deux est ici, en un seul endroit.

   Aucune bibliothèque, comme partout ailleurs dans ce dépôt : une API
   se parle en HTTP ordinaire, et une dépendance de moins est une
   migration de moins dans deux ans.

   Le service d'envoi est Brevo — société française, hébergement
   européen, e-mail et SMS sur le même compte. Il est appelé à deux
   endroits précis, `envoyerMail` et `envoyerSms`. En changer demande de
   réécrire ces deux fonctions, et rien d'autre.
   ===================================================================== */

/* Seule bibliothèque de tout le dépôt, et c'est assumé : SMTP est un
   protocole, pas une API en HTTP. L'écrire à la main tiendrait en
   quatre-vingts lignes qu'aucun test d'ici ne pourrait exercer — les
   fins de ligne, l'échappement du point en début de ligne, l'encodage
   d'un objet accentué. La version est épinglée, jamais « la dernière ». */
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

/* ---------- les réglages, tous au même endroit ---------- */
/* Rien n'est écrit en dur ici. Les clés se posent une fois dans
   Supabase › Edge Functions › Secrets, et n'apparaissent jamais dans
   une page servie à un navigateur. */
export function reglage(nom: string, defaut = ""): string {
  return Deno.env.get(nom) || defaut;
}

export const BASE = reglage("SUPABASE_URL");
export const CLE_SERVICE = reglage("SUPABASE_SERVICE_ROLE_KEY");

/* ---------- la base, en HTTP ---------- */
/* La clé de service ignore les politiques d'accès : c'est voulu, et
   c'est pour cela qu'elle ne quitte jamais le serveur. */
export async function base(chemin: string, options: RequestInit = {}) {
  const entetes: Record<string, string> = {
    apikey: CLE_SERVICE,
    Authorization: "Bearer " + CLE_SERVICE,
    "Content-Type": "application/json",
  };
  const fournies = (options.headers || {}) as Record<string, string>;
  for (const k of Object.keys(fournies)) entetes[k] = fournies[k];
  const r = await fetch(BASE + chemin, { ...options, headers: entetes });
  const txt = await r.text();
  let corps: unknown = null;
  try {
    corps = txt ? JSON.parse(txt) : null;
  } catch {
    corps = txt;
  }
  if (!r.ok) throw new Error("base " + r.status + " : " + txt.slice(0, 300));
  return corps;
}

/* ---------- l'identité de l'expéditeur ---------- */
/* Les coordonnées de la société vivent dans la table `reglages`, comme
   dans la plateforme : une seule source, modifiable depuis « Mes
   coordonnées » sans redéployer quoi que ce soit. */
export type Societe = {
  nom: string;
  repnom: string;
  tel: string;
  email: string;
};

export async function societe(): Promise<Societe> {
  let v: Record<string, string> = {};
  try {
    const l = await base("/rest/v1/reglages?cle=eq.societe&select=valeur") as
      | Array<{ valeur: Record<string, string> }>
      | null;
    if (l && l[0] && l[0].valeur) v = l[0].valeur;
  } catch {
    /* la base ne répond pas : on envoie quand même, avec les valeurs
       de repli. Un accusé sans en-tête vaut mieux qu'un silence. */
  }
  return {
    nom: v.nom || "VD SERVICES",
    repnom: v.repnom || "Valentin Dupuy",
    tel: v.tel || reglage("TEL_CONTACT"),
    email: v.email || expediteur(),
  };
}

/* ---------- un numéro que Brevo accepte ---------- */
/* Le formulaire laisse écrire « 06 46 84 30 82 », « 0646843082 » ou
   « +33 6 46 84 30 82 ». Brevo veut 33646843082, sans signe ni espace. */
export function telE164(brut: string): string {
  const n = String(brut || "").replace(/[^0-9+]/g, "");
  if (!n) return "";
  if (n.startsWith("+")) return n.slice(1);
  if (n.startsWith("00")) return n.slice(2);
  if (n.startsWith("0")) return "33" + n.slice(1);
  return n;
}

export function estMail(x: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(x || "").trim());
}

/* ---------- le SMS est fermé par défaut ---------- */
/* L'e-mail est gratuit, le SMS ne l'est chez personne : quatre à six
   centimes le message, en crédits achetés d'avance. Tant que le secret
   SMS_ACTIF ne vaut pas « oui », aucune fonction n'essaie d'en envoyer
   un — mieux vaut dire sur la fiche qu'aucun accusé n'est parti que
   collectionner des échecs chez un service sans crédit. */
export function smsActif(): boolean {
  return /^(oui|1|true)$/i.test(reglage("SMS_ACTIF"));
}

/* ---------- l'envoi d'un e-mail ---------- */
/* Deux chemins, un seul appelant. `MODE_ENVOI` tranche :

     smtp   la boîte du domaine envoie elle-même, par le serveur de
            l'hébergeur. C'est votre adresse qui parle, sans tiers,
            sans mention ajoutée en pied de message.
     brevo  un service d'envoi expédie pour vous, votre adresse en
            expéditeur. Plus de traçabilité, des rebonds gérés, mais un
            compte de plus et un pied imposé sur l'offre gratuite.

   Sans réglage, le mode est déduit : `SMTP_HOTE` renseigné vaut smtp,
   sinon brevo. Basculer de l'un à l'autre est un secret à changer, pas
   une ligne de code — et c'est volontaire : l'envoi par SMTP suppose
   que le port sorte de l'environnement des fonctions, ce qui ne se
   vérifie qu'en l'essayant. */
export function modeEnvoi(): string {
  const choisi = reglage("MODE_ENVOI").toLowerCase();
  if (choisi === "smtp" || choisi === "brevo") return choisi;
  return reglage("SMTP_HOTE") ? "smtp" : "brevo";
}

/* L'adresse qui signe. En SMTP, le serveur de l'hébergeur refuse
   d'expédier au nom d'une autre boîte que celle qui s'authentifie :
   l'expéditeur vaut donc la boîte, sauf alias déclaré chez lui. */
export function expediteur(): string {
  return reglage("EXPEDITEUR_EMAIL") || reglage("SMTP_UTILISATEUR");
}

/* Le texte part en clair, sans HTML : c'est un message de service, pas
   une infolettre. Un corps en texte simple traverse tous les filtres,
   s'affiche partout, et ne ressemble pas à de la publicité. */
export function envoyerMail(
  dest: string,
  objet: string,
  corps: string,
  soc: Societe,
): Promise<string> {
  return modeEnvoi() === "smtp"
    ? envoyerMailSmtp(dest, objet, corps, soc)
    : envoyerMailBrevo(dest, objet, corps, soc);
}

/* ---------- par la boîte du domaine ---------- */
async function envoyerMailSmtp(
  dest: string,
  objet: string,
  corps: string,
  soc: Societe,
): Promise<string> {
  const hote = reglage("SMTP_HOTE");
  const utilisateur = reglage("SMTP_UTILISATEUR");
  const motdepasse = reglage("SMTP_MOTDEPASSE");
  if (!hote || !utilisateur || !motdepasse) {
    throw new Error("réglages SMTP incomplets : SMTP_HOTE, SMTP_UTILISATEUR, SMTP_MOTDEPASSE");
  }
  const port = Number(reglage("SMTP_PORT", "465")) || 465;
  const de = expediteur();

  /* 465 chiffre dès la poignée de main, 587 commence en clair puis
     passe en TLS. Les deux sont offerts par les hébergeurs ; le
     premier traverse mieux les réseaux qui filtrent. */
  const client = new SMTPClient({
    connection: {
      hostname: hote,
      port: port,
      tls: port !== 587,
      auth: { username: utilisateur, password: motdepasse },
    },
  });
  try {
    await client.send({
      from: reglage("EXPEDITEUR_NOM", soc.nom) + " <" + de + ">",
      to: dest,
      replyTo: soc.email || de,
      /* Une copie cachée vers la boîte elle-même : c'est ce qui donne
         une trace dans les « Envoyés », que le SMTP ne laisse pas de
         lui-même. Fermé par défaut, pour ne pas doubler le courrier. */
      bcc: /^(oui|1|true)$/i.test(reglage("COPIE_ENVOIS")) ? de : undefined,
      subject: objet,
      content: corps,
    });
  } finally {
    try {
      await client.close();
    } catch { /* la connexion était déjà retombée : le message est parti */ }
  }
  return "smtp";
}

/* ---------- par un service d'envoi ---------- */
async function envoyerMailBrevo(
  dest: string,
  objet: string,
  corps: string,
  soc: Societe,
): Promise<string> {
  const cle = reglage("BREVO_CLE");
  if (!cle) throw new Error("BREVO_CLE n'est pas renseignée dans les secrets de la fonction");
  const de = expediteur();
  if (!de) throw new Error("EXPEDITEUR_EMAIL n'est pas renseignée");

  const r = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": cle, "Content-Type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      sender: { name: reglage("EXPEDITEUR_NOM", soc.nom), email: de },
      replyTo: { email: soc.email || de, name: soc.nom },
      to: [{ email: dest }],
      subject: objet,
      textContent: corps,
    }),
  });
  const txt = await r.text();
  if (!r.ok) throw new Error("Brevo " + r.status + " : " + txt.slice(0, 300));
  try {
    return (JSON.parse(txt).messageId as string) || "";
  } catch {
    return "";
  }
}

/* ---------- l'envoi d'un SMS ---------- */
/* L'expéditeur d'un SMS transactionnel est un nom, pas un numéro : onze
   caractères au plus, lettres et chiffres. On ne peut pas y répondre,
   c'est pourquoi le texte porte toujours le numéro à rappeler. */
export async function envoyerSms(tel: string, texte: string): Promise<string> {
  const cle = reglage("BREVO_CLE");
  if (!cle) throw new Error("BREVO_CLE n'est pas renseignée dans les secrets de la fonction");
  const numero = telE164(tel);
  if (!numero) throw new Error("numéro illisible : " + tel);

  const r = await fetch("https://api.brevo.com/v3/transactionalSMS/sms", {
    method: "POST",
    headers: { "api-key": cle, "Content-Type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      sender: reglage("SMS_EXPEDITEUR", "VDSERVICES").slice(0, 11),
      recipient: numero,
      content: texte,
      type: "transactional",
    }),
  });
  const txt = await r.text();
  if (!r.ok) throw new Error("Brevo SMS " + r.status + " : " + txt.slice(0, 300));
  try {
    return String(JSON.parse(txt).reference || "");
  } catch {
    return "";
  }
}

/* ---------- la trace ---------- */
/* Deux écritures pour un envoi, et elles ne disent pas la même chose :
   `messages` garde la preuve complète, le suivi de la demande garde la
   ligne que vous lirez sur la fiche. Un échec s'écrit aussi : une
   demande dont l'accusé n'est pas parti doit se voir. */
export async function journaliser(m: {
  demande_id?: string | null;
  genre: string;
  canal: "email" | "sms";
  destinataire: string;
  objet?: string;
  corps?: string;
  statut?: "envoye" | "erreur";
  erreur?: string;
  reference?: string;
}) {
  try {
    await base("/rest/v1/messages", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ statut: "envoye", ...m }),
    });
  } catch (e) {
    console.error("journal des messages", (e as Error).message);
  }
}

export async function ajouterAuSuivi(demandeId: string, texte: string) {
  if (!demandeId) return;
  try {
    const l = await base(
      "/rest/v1/demandes?id=eq." + encodeURIComponent(demandeId) + "&select=journal",
    ) as Array<{ journal: unknown[] }> | null;
    const journal = (l && l[0] && Array.isArray(l[0].journal) ? l[0].journal : []).slice();
    journal.push({ t: new Date().toISOString(), texte: texte });
    await base("/rest/v1/demandes?id=eq." + encodeURIComponent(demandeId), {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ journal: journal }),
    });
  } catch (e) {
    console.error("suivi de la demande", (e as Error).message);
  }
}

/* ---------- les réponses de la fonction ---------- */
export function json(corps: unknown, code = 200): Response {
  return new Response(JSON.stringify(corps), {
    status: code,
    headers: { "Content-Type": "application/json", ...ENTETES_CORS },
  });
}

/* La plateforme est servie par votre domaine, la fonction par celui de
   Supabase : le navigateur demande donc la permission avant d'appeler. */
export const ENTETES_CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": reglage("ORIGINE_AUTORISEE", "*"),
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/* ---------- qui appelle ---------- */
/* Le jeton est déjà vérifié par Supabase avant d'arriver ici : sa
   signature est bonne, sinon la fonction n'aurait pas été appelée.
   Reste à lire ce qu'il dit, car la clé publique du formulaire est,
   elle aussi, un jeton valable. */
export function roleDuJeton(req: Request): string {
  const entete = req.headers.get("Authorization") || "";
  const jeton = entete.replace(/^Bearer\s+/i, "");
  const morceaux = jeton.split(".");
  if (morceaux.length < 2) return "";
  try {
    const brut = morceaux[1].replace(/-/g, "+").replace(/_/g, "/");
    const charge = JSON.parse(atob(brut + "=".repeat((4 - brut.length % 4) % 4)));
    return String(charge.role || "");
  } catch {
    return "";
  }
}
