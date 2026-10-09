-- =====================================================================
--  VD SERVICES — schéma de la base
--  À coller dans Supabase : projet › SQL Editor › New query › Run.
--  Le script est rejouable : il ne casse rien s'il tourne deux fois.
-- =====================================================================

-- ---------------------------------------------------------------------
--  1. QUI EST QUI
--  Chaque personne qui se connecte a une ligne ici. 'admin' c'est vous,
--  'syndic' c'est un gestionnaire qui ne voit que son propre parc.
-- ---------------------------------------------------------------------
create table if not exists profils (
  id          uuid primary key references auth.users on delete cascade,
  role        text not null default 'syndic' check (role in ('admin','syndic')),
  client_id   uuid,
  nom         text,
  cree_le     timestamptz not null default now()
);

-- Raccourcis utilisés par toutes les règles d'accès plus bas.
create or replace function est_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profils where id = auth.uid() and role = 'admin');
$$;

create or replace function mon_client() returns uuid
language sql stable security definer set search_path = public as $$
  select client_id from profils where id = auth.uid();
$$;

-- ---------------------------------------------------------------------
--  2. LES TABLES
--  Les champs qui varient beaucoup d'un parcours à l'autre (énergie,
--  consultation publique) restent en jsonb : inutile d'ajouter trente
--  colonnes qui serviront une fois sur dix.
-- ---------------------------------------------------------------------

create table if not exists clients (
  id           uuid primary key default gen_random_uuid(),
  type         text default 'particulier',       -- 'pro' | 'particulier'
  role         text,                             -- syndic, bailleur, occupant…
  nom          text not null,
  contact_nom  text,
  tel          text,
  email        text,
  ville        text,
  notes        text,
  copros       jsonb not null default '[]'::jsonb,
  exemple      boolean not null default false,
  cree_le      timestamptz not null default now()
);

create table if not exists residences (
  id         uuid primary key default gen_random_uuid(),
  code       text unique not null,               -- ce qui part dans le QR code
  nom        text not null,
  adresse    text,
  ville      text,
  lots       integer default 0,
  client_id  uuid references clients on delete set null,
  cree_le    timestamptz not null default now()
);

create table if not exists prestataires (
  id           uuid primary key default gen_random_uuid(),
  nom          text not null,
  forme        text,
  capital      text,
  siren        text,
  adresse      text,
  rcsville     text,
  activite     text,
  repnom       text,
  repqualite   text,
  repmail      text,
  contact      text,
  tel          text,
  email        text,
  astreinte    text,
  delai        text,
  horaires     text,
  villes       text[] not null default '{}',
  zone         text,
  metiers      text[] not null default '{}',
  rcpro        text, rcpronum text,
  dec          text, decnum   text,
  assurance    text,
  taux         text, deplacement text, reglement text, certifs text,
  qualite      numeric default 0,
  reactivite   numeric default 0,
  remarques    text,
  convention   jsonb not null default '{}'::jsonb,
  archive      boolean not null default false,
  exemple      boolean not null default false,
  cree_le      timestamptz not null default now()
);

create table if not exists demandes (
  id                uuid primary key default gen_random_uuid(),
  ref               text not null,
  recu              timestamptz not null default now(),
  intent            text,                        -- urgence, depannage, projet, energie, public
  trades            text[] not null default '{}',
  presta            text[] not null default '{}',
  gestes            text[] not null default '{}',
  projet            text,
  lieu              text,
  statut_demandeur  text,
  residence         text,
  res_code          text,
  adresse           text,
  cp                text,
  ville             text,
  precision_lieu    text,
  nom               text,
  tel               text,
  email             text,
  description       text,
  delai             text,
  budget            text,
  ag                text,
  creneau           text,
  extra             jsonb not null default '{}'::jsonb,   -- énergie, consultation publique
  source            text default 'qr',
  etat              text not null default 'nouvelle',
  client_id         uuid references clients on delete set null,
  assignes          uuid[] not null default '{}',
  journal           jsonb not null default '[]'::jsonb,
  exemple           boolean not null default false
);
create index if not exists demandes_recu_idx on demandes (recu desc);
create index if not exists demandes_etat_idx on demandes (etat);
create index if not exists demandes_res_idx  on demandes (res_code);

create table if not exists photos (
  id          uuid primary key default gen_random_uuid(),
  demande_id  uuid references demandes on delete cascade,
  moment      text not null default 'avant' check (moment in ('avant','apres')),
  chemin      text not null,                     -- chemin dans le bucket 'photos'
  nom         text,
  taille      integer,
  type_mime   text,
  ajoute_le   timestamptz not null default now()
);
create index if not exists photos_demande_idx on photos (demande_id);

create table if not exists interventions (
  id               uuid primary key default gen_random_uuid(),
  demande_id       uuid references demandes on delete set null,
  prestataire_id   uuid references prestataires on delete set null,
  ref              text,
  client           text,
  date_inter       date,
  montant          numeric default 0,
  facture_num      text,
  commission       numeric,
  metier           text,
  ville            text,
  note_qualite     integer,
  note_reactivite  integer,
  notes            text,                         -- interne : jamais montré au syndic
  cree_le          timestamptz not null default now()
);
create index if not exists interventions_date_idx on interventions (date_inter desc);

create table if not exists bordereaux (
  demande_id  uuid primary key references demandes on delete cascade,
  marge       numeric default 12,
  envoye      boolean not null default false,
  lignes      jsonb not null default '[]'::jsonb,
  prix        jsonb not null default '{}'::jsonb,
  maj_le      timestamptz not null default now()
);

create table if not exists devis (
  id          uuid primary key default gen_random_uuid(),
  num         text not null,
  date_devis  date not null default current_date,
  validite    integer default 30,
  client_id   uuid references clients on delete set null,
  client      text,
  adresse     text,
  objet       text,
  demande_id  uuid references demandes on delete set null,
  statut      text not null default 'brouillon',
  remise      numeric default 0,
  tva         text default '10',
  lignes      jsonb not null default '[]'::jsonb,
  notes       text,
  cree_le     timestamptz not null default now()
);

create table if not exists documents (
  id              uuid primary key default gen_random_uuid(),
  prestataire_id  uuid references prestataires on delete cascade,
  type            text not null,
  nom             text,
  chemin          text,                          -- bucket 'documents'
  taille          integer,
  type_mime       text,
  assureur        text,
  numero          text,
  date_debut      text,
  date_fin        text,
  extrait         jsonb,
  ajoute_le       timestamptz not null default now()
);

create table if not exists tarifs (
  cle   text primary key,                        -- "plomberie|Remplacement d'un WC complet"
  prix  numeric not null
);

create table if not exists reglages (
  cle     text primary key,                      -- 'societe', …
  valeur  jsonb not null default '{}'::jsonb
);

-- ---------------------------------------------------------------------
--  3. QUI A LE DROIT DE QUOI
--  Règle de base : tout est fermé, on ouvre ligne par ligne.
--  Le seul droit donné au public est de DÉPOSER une demande. Il ne peut
--  pas la relire, ni voir quoi que ce soit d'autre.
-- ---------------------------------------------------------------------
alter table profils       enable row level security;
alter table clients       enable row level security;
alter table residences    enable row level security;
alter table prestataires  enable row level security;
alter table demandes      enable row level security;
alter table photos        enable row level security;
alter table interventions enable row level security;
alter table bordereaux    enable row level security;
alter table devis         enable row level security;
alter table documents     enable row level security;
alter table tarifs        enable row level security;
alter table reglages      enable row level security;

-- chacun lit sa propre ligne de profil
drop policy if exists profils_moi on profils;
create policy profils_moi on profils for select to authenticated
  using (id = auth.uid() or est_admin());

-- --- le dépôt public d'une demande --------------------------------
-- 'anon' est la clé publique du formulaire : elle n'autorise que l'ajout.
drop policy if exists demandes_depot_public on demandes;
create policy demandes_depot_public on demandes for insert to anon
  with check (etat = 'nouvelle' and exemple = false);

drop policy if exists photos_depot_public on photos;
create policy photos_depot_public on photos for insert to anon
  with check (moment = 'avant');

-- --- vous ---------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['clients','residences','prestataires','demandes','photos',
                           'interventions','bordereaux','devis','documents','tarifs','reglages']
  loop
    execute format('drop policy if exists %I_admin on %I', t, t);
    execute format(
      'create policy %I_admin on %I for all to authenticated using (est_admin()) with check (est_admin())',
      t, t);
  end loop;
end $$;

-- --- le syndic ----------------------------------------------------
-- Lecture seule, et seulement ce qui concerne son parc. Les colonnes
-- sensibles (prix des entreprises consultées, notes internes) ne sont
-- pas filtrées ici mais dans la vue de l'étape 4 : une politique ne
-- sait pas cacher une colonne, seulement une ligne.
drop policy if exists demandes_syndic on demandes;
create policy demandes_syndic on demandes for select to authenticated
  using (
    client_id = mon_client()
    or res_code in (select code from residences where client_id = mon_client())
  );

drop policy if exists residences_syndic on residences;
create policy residences_syndic on residences for select to authenticated
  using (client_id = mon_client());

drop policy if exists clients_syndic on clients;
create policy clients_syndic on clients for select to authenticated
  using (id = mon_client());

drop policy if exists photos_syndic on photos;
create policy photos_syndic on photos for select to authenticated
  using (demande_id in (
    select id from demandes
    where client_id = mon_client()
       or res_code in (select code from residences where client_id = mon_client())));

-- ---------------------------------------------------------------------
--  4. LES FICHIERS
--  Deux casiers : 'photos' pour les chantiers, 'documents' pour les
--  pièces des entreprises. Les deux sont privés ; les images s'affichent
--  par un lien signé, valable quelques minutes.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
  values ('photos','photos',false), ('documents','documents',false)
  on conflict (id) do nothing;

-- le formulaire public peut déposer une photo, et rien d'autre
drop policy if exists photos_envoi_public on storage.objects;
create policy photos_envoi_public on storage.objects for insert to anon
  with check (bucket_id = 'photos');

drop policy if exists fichiers_admin on storage.objects;
create policy fichiers_admin on storage.objects for all to authenticated
  using (est_admin()) with check (est_admin());

-- =====================================================================
--  Après ce script : créez votre compte dans Authentication › Users,
--  puis passez-le en administrateur avec, son identifiant en main :
--     insert into profils (id, role, nom)
--     values ('COLLEZ-ICI-L-UUID', 'admin', 'Valentin Dupuy');
-- =====================================================================
