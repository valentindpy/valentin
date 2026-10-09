-- =====================================================================
--  VD SERVICES — garde-fous sur les fichiers déposés
--  À passer après 01-schema.sql, dans le même éditeur SQL.
--
--  Le formulaire est ouvert à tous : n'importe qui peut y déposer une
--  photo. Ces deux limites sont posées côté serveur, donc impossibles à
--  contourner depuis le navigateur — un script qui tenterait d'envoyer
--  un fichier de 2 Go ou un exécutable se fait refuser par Supabase.
-- =====================================================================

update storage.buckets
   set file_size_limit = 10485760,            -- 10 Mo par photo
       allowed_mime_types = array['image/jpeg','image/png','image/webp','image/heic','image/heif']
 where id = 'photos';

update storage.buckets
   set file_size_limit = 20971520,            -- 20 Mo par pièce
       allowed_mime_types = array['application/pdf','image/jpeg','image/png','image/webp']
 where id = 'documents';

-- ---------------------------------------------------------------------
--  Un numéro de demande lisible, attribué par la base.
--  Le navigateur en propose un, mais c'est la base qui tranche : deux
--  demandes déposées à la même seconde ne peuvent pas porter le même.
-- ---------------------------------------------------------------------
create sequence if not exists demandes_numero_seq;

create or replace function ref_demande() returns trigger
language plpgsql as $$
begin
  if new.ref is null or new.ref = '' then
    new.ref := 'VD-' || to_char(now(),'YYMMDD') || '-' ||
               upper(substr(coalesce(new.intent,'x'),1,1)) ||
               lpad(nextval('demandes_numero_seq')::text, 3, '0');
  end if;
  return new;
end $$;

drop trigger if exists demandes_ref on demandes;
create trigger demandes_ref before insert on demandes
  for each row execute function ref_demande();
