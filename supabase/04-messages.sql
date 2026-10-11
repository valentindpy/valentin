-- =====================================================================
--  VD SERVICES — les messages qui partent, et la preuve qu'ils sont partis
--  À passer après 03-devis-recus.sql, dans le même éditeur SQL.
--  Sans danger si vous le relancez : tout y est conditionnel.
-- =====================================================================

-- ---------------------------------------------------------------------
--  1. Le journal des envois
--  Jusqu'ici un message était rédigé par la plateforme puis copié à la
--  main dans la messagerie : rien ne gardait la date, ni le
--  destinataire, ni même la certitude qu'il soit parti.
--
--  Or la convention d'apport fait courir un délai de cinq jours ouvrés
--  à compter de la transmission d'une demande pour qu'une entreprise
--  conteste un client qu'elle connaissait déjà. Sans date opposable,
--  cette clause ne vaut rien. Cette table est cette date.
--
--  Le corps du message est conservé en entier, volontairement : ce qui
--  compte un jour de litige n'est pas qu'un message soit parti, c'est
--  ce qu'il disait.
-- ---------------------------------------------------------------------
create table if not exists messages (
  id            uuid primary key default gen_random_uuid(),
  demande_id    uuid references demandes on delete cascade,
  genre         text not null default 'autre',      -- accuse | devis | autre
  canal         text not null check (canal in ('email','sms')),
  destinataire  text not null,
  objet         text,
  corps         text,
  statut        text not null default 'envoye' check (statut in ('envoye','erreur')),
  erreur        text,                               -- la raison, quand ça rate
  reference     text,                               -- l'identifiant rendu par le service d'envoi
  envoye_le     timestamptz not null default now()
);

create index if not exists messages_demande_idx on messages (demande_id, envoye_le desc);
create index if not exists messages_date_idx    on messages (envoye_le desc);

-- ---------------------------------------------------------------------
--  2. Qui lit ce journal
--  Vous, et personne d'autre. Un accusé de réception porte le nom, le
--  téléphone et la description d'un habitant : ce n'est pas au syndic
--  de le relire, et sûrement pas au public.
--
--  Les fonctions d'envoi écrivent ici avec la clé de service, qui
--  ignore les politiques : aucune politique d'écriture n'est donc
--  nécessaire, et c'est tant mieux — personne ne peut fabriquer une
--  preuve d'envoi depuis un navigateur.
-- ---------------------------------------------------------------------
alter table messages enable row level security;

drop policy if exists messages_admin on messages;
create policy messages_admin on messages for select to authenticated
  using (est_admin());

-- ---------------------------------------------------------------------
--  3. Ce qui déclenche l'accusé de réception
--  Une demande déposée sur le formulaire doit être accusée dans la
--  seconde, sans que personne ne clique. C'est un webhook de base de
--  données : Postgres appelle la fonction, la fonction envoie.
--
--  À créer une fois, dans le tableau de bord Supabase :
--
--    Database › Webhooks › Create a new hook
--      Name       : accuse_reception
--      Table      : demandes          Events : Insert
--      Type       : Supabase Edge Functions
--      Edge Function : accuse-reception
--      HTTP Headers  : Authorization: Bearer <clé service_role>
--
--  La clé service_role ne sort pas de Supabase : elle va du webhook à
--  la fonction, sans jamais passer par un navigateur. La fonction
--  refuse tout appel qui ne la porte pas — l'adresse seule ne permet
--  donc rien, même connue.
--
--  Si vous préférez le faire en SQL plutôt qu'à la souris, l'extension
--  pg_net le permet. Le code est en commentaire ci-dessous : il faut y
--  coller deux valeurs, et une clé écrite dans un déclencheur reste
--  lisible par qui peut lire le schéma. Le tableau de bord est le bon
--  chemin ; ceci n'est là que pour les jours où il ne répond pas.
-- ---------------------------------------------------------------------
-- create extension if not exists pg_net;
--
-- create or replace function appeler_accuse() returns trigger
-- language plpgsql security definer as $$
-- begin
--   perform net.http_post(
--     url     := 'https://VOTRE-PROJET.supabase.co/functions/v1/accuse-reception',
--     headers := jsonb_build_object(
--                  'Content-Type',  'application/json',
--                  'Authorization', 'Bearer VOTRE-CLE-SERVICE-ROLE'),
--     body    := jsonb_build_object('type','INSERT','table','demandes',
--                                   'record', to_jsonb(new)));
--   return new;
-- end $$;
--
-- drop trigger if exists demandes_accuse on demandes;
-- create trigger demandes_accuse after insert on demandes
--   for each row execute function appeler_accuse();

-- =====================================================================
--  Après ce script : déployez les deux fonctions de supabase/functions/
--  et renseignez leurs clés. Tout est écrit dans supabase/00-reglages.md.
-- =====================================================================
