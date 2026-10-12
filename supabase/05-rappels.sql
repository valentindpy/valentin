-- =====================================================================
--  VD SERVICES — le rappel quotidien des demandes qui dorment
--  À passer après 04-messages.sql, dans le même éditeur SQL.
--  Sans danger si vous le relancez : la tâche est remplacée, pas doublée.
-- =====================================================================

-- ---------------------------------------------------------------------
--  Deux extensions, posées par Supabase sur demande :
--    pg_cron  sait déclencher quelque chose à heure fixe
--    pg_net   sait appeler une adresse depuis la base
--  Elles s'activent aussi à la souris, dans Database › Extensions.
-- ---------------------------------------------------------------------
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ---------------------------------------------------------------------
--  La clé de service, rangée dans le coffre plutôt que dans la tâche
--  Une clé écrite en clair dans une tâche planifiée reste lisible par
--  qui peut lire le schéma. Le coffre de Supabase est fait pour ça.
--
--  À faire une fois, dans Database › Vault › New secret :
--      nom    : cle_service
--      valeur : votre clé service_role
-- ---------------------------------------------------------------------

-- ---------------------------------------------------------------------
--  La tâche
--  Tous les jours à 7 h 10 UTC, soit 8 h 10 en hiver et 9 h 10 en été :
--  pg_cron ne connaît que l'heure universelle. Dix minutes après
--  l'heure ronde, parce que tout le monde programme à l'heure ronde.
--
--  Remplacez VOTRE-PROJET par la référence de votre projet Supabase,
--  celle qui est déjà dans l'adresse du haut de 00-reglages.md.
-- ---------------------------------------------------------------------
select cron.unschedule('vd_rappels')
 where exists (select 1 from cron.job where jobname = 'vd_rappels');

select cron.schedule('vd_rappels', '10 7 * * *', $job$
  select net.http_post(
    url     := 'https://VOTRE-PROJET.supabase.co/functions/v1/rappels',
    headers := jsonb_build_object(
                 'Content-Type',  'application/json',
                 'Authorization', 'Bearer ' || (
                   select decrypted_secret from vault.decrypted_secrets
                    where name = 'cle_service')),
    body    := '{}'::jsonb);
$job$);

-- ---------------------------------------------------------------------
--  Vérifier
--    select * from cron.job;                     -- la tâche est là
--    select * from cron.job_run_details           -- elle a tourné
--      order by start_time desc limit 10;
--    select * from messages where genre = 'rappel' -- et le message est parti
--      order by envoye_le desc;
--
--  Pour l'essayer tout de suite, sans attendre demain matin :
--    select cron.schedule('vd_rappels_test', '* * * * *', ...);
--  puis cron.unschedule('vd_rappels_test') dès que vous avez vu passer
--  le message. Une tâche à la minute laissée derrière soi envoie
--  mille quatre cent quarante messages par jour.
-- ---------------------------------------------------------------------
