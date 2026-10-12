/* =====================================================================
   VD SERVICES — l'accusé de réception, sans que personne ne clique

   Le dernier écran du formulaire annonce un rappel. Jusqu'ici, rien ne
   partait : ni vers la personne, ni vers vous. C'était le point le plus
   grave de la revue avant lancement, parce qu'il se voit le premier
   jour — sans accusé, la moitié des gens rescannent ou appellent.

   Postgres appelle cette fonction à chaque demande déposée (webhook de
   base de données, créé une fois ; tout est expliqué dans
   supabase/04-messages.sql). Elle envoie deux choses :

     • au demandeur, l'accusé portant sa référence — par e-mail s'il en
       a donné un, par SMS sinon ;
     • à vous, l'alerte, par e-mail et par SMS.

   Elle n'est jamais appelée par un navigateur : seul un appel portant
   la clé de service passe. Connaître l'adresse de la fonction ne permet
   donc pas de faire partir un message.
   ===================================================================== */

import {
  ajouterAuSuivi,
  base,
  ENTETES_CORS,
  envoyerMail,
  envoyerSms,
  estMail,
  journaliser,
  json,
  reglage,
  roleDuJeton,
  smsActif,
  societe,
} from "../_commun/envoi.ts";
import { accuseReception, alerteInterne, type Demande } from "../_commun/texte.ts";

function attendre(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/* Les photos partent dans le casier juste après la demande, en
   parallèle : au moment où Postgres nous appelle, elles ne sont pas
   encore toutes arrivées. On laisse passer deux secondes avant de les
   compter — un accusé qui annonce « 3 photos reçues » alors que le
   formulaire en a montré trois vaut cette attente. */
async function compterPhotos(id: string): Promise<number> {
  try {
    await attendre(2000);
    const l = await base(
      "/rest/v1/photos?demande_id=eq." + encodeURIComponent(id) + "&moment=eq.avant&select=id",
    ) as unknown[] | null;
    return (l || []).length;
  } catch {
    return 0;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: ENTETES_CORS });
  if (req.method !== "POST") return json({ erreur: "POST attendu" }, 405);

  /* La clé publique du formulaire est, elle aussi, un jeton valable :
     vérifier la signature ne suffit pas, il faut lire le rôle. */
  if (roleDuJeton(req) !== "service_role") {
    return json({ erreur: "appel refusé" }, 401);
  }

  let charge: { type?: string; table?: string; record?: Demande & { exemple?: boolean } };
  try {
    charge = await req.json();
  } catch {
    return json({ erreur: "corps illisible" }, 400);
  }

  const d = charge.record;
  if (!d || !d.id) return json({ erreur: "aucune demande dans l'appel" }, 400);
  if (charge.table && charge.table !== "demandes") return json({ ignore: charge.table });
  /* Les fiches de démonstration n'envoient rien à personne. */
  if (d.exemple) return json({ ignore: "exemple" });

  const soc = await societe();
  const photos = await compterPhotos(d.id);
  const ac = accuseReception(d, soc, photos);
  const al = alerteInterne(d, photos);
  const envois: Array<{ quoi: string; canal: string; vers: string; ok: boolean; erreur?: string }> = [];

  async function envoyer(
    quoi: string,
    genre: string,
    canal: "email" | "sms",
    vers: string,
    objet: string,
    corps: string,
    suivi?: string,
  ) {
    if (!vers) return;
    try {
      const reference = canal === "email"
        ? await envoyerMail(vers, objet, corps, soc)
        : await envoyerSms(vers, corps);
      await journaliser({
        demande_id: d!.id,
        genre: genre,
        canal: canal,
        destinataire: vers,
        objet: objet,
        corps: corps,
        reference: reference,
      });
      if (suivi) await ajouterAuSuivi(d!.id, suivi);
      envois.push({ quoi: quoi, canal: canal, vers: vers, ok: true });
    } catch (e) {
      const raison = (e as Error).message;
      console.error(quoi, raison);
      await journaliser({
        demande_id: d!.id,
        genre: genre,
        canal: canal,
        destinataire: vers,
        objet: objet,
        corps: corps,
        statut: "erreur",
        erreur: raison,
      });
      /* Un envoi raté se voit sur la fiche. Une demande dont l'accusé
         n'est pas parti est une personne qui attend un appel sans
         savoir que sa demande est arrivée : elle doit vous sauter aux
         yeux, pas dormir dans un journal technique. */
      if (suivi) await ajouterAuSuivi(d!.id, "Échec de l'envoi — " + quoi + " : " + raison);
      envois.push({ quoi: quoi, canal: canal, vers: vers, ok: false, erreur: raison });
    }
  }

  /* --- le demandeur : e-mail s'il en a donné un, SMS sinon --- */
  if (d.email && estMail(d.email)) {
    await envoyer(
      "accusé au demandeur",
      "accuse",
      "email",
      d.email.trim(),
      ac.objet,
      ac.corps,
      "Accusé de réception envoyé à " + d.email.trim() + ".",
    );
  } else if (d.tel && smsActif()) {
    await envoyer(
      "accusé au demandeur",
      "accuse",
      "sms",
      d.tel,
      ac.objet,
      ac.sms,
      "Accusé de réception envoyé par SMS au " + d.tel + ".",
    );
  } else if (d.tel) {
    /* Pas d'adresse, et les SMS ne sont pas ouverts : personne n'a
       accusé cette demande. C'est votre appel qui en tiendra lieu, et
       la fiche le dit clairement plutôt que de rester muette. */
    await ajouterAuSuivi(
      d.id,
      "Aucun accusé envoyé : pas d'adresse e-mail, et les SMS ne sont pas activés. Rappelez le " +
        d.tel + ".",
    );
  } else {
    await ajouterAuSuivi(d.id, "Aucun accusé envoyé : la demande ne porte ni e-mail ni téléphone.");
  }

  /* --- vous : l'alerte --- */
  /* Par e-mail, et par SMS seulement si vous avez ouvert ce canal.
     L'objet commence par URGENCE pour les urgences : c'est ce qui
     permet à un téléphone de sonner pour celles-là et de se taire
     pour le reste. */
  await envoyer("alerte interne", "autre", "email", reglage("ALERTE_EMAIL", soc.email),
    al.objet, al.corps);
  if (smsActif()) {
    await envoyer("alerte interne", "autre", "sms", reglage("ALERTE_SMS", soc.tel),
      al.objet, al.sms);
  }

  /* Toujours 200 : le webhook n'a pas à réessayer un envoi déjà
     consigné, il recommencerait en double. Ce qui a raté est écrit
     dans `messages` et sur la fiche de la demande. */
  return json({ ok: envois.every((e) => e.ok), ref: d.ref, photos: photos, envois: envois });
});
