-- =====================================================================
--  VD SERVICES — les devis reçus, et les prix fixés à la main
--  À passer après 01-schema.sql et 02-fichiers.sql, dans le même
--  éditeur SQL. Sans danger si vous le relancez : tout y est conditionnel.
-- =====================================================================

-- ---------------------------------------------------------------------
--  1. Un prix que vous imposez vous-même sur une ligne de bordereau
--  Jusqu'ici le prix retenu était forcément le moins-disant des
--  entreprises consultées : sans consultation, pas de chiffrage possible.
--  Cette colonne garde, ligne par ligne, le prix que vous décidez.
-- ---------------------------------------------------------------------
--  La colonne s'appelle prix_forces et non force : « force » est un mot
--  que Postgres emploie ailleurs, et une colonne qui oblige à se souvenir
--  de la mettre entre guillemets finit un jour par être oubliée.
alter table bordereaux
  add column if not exists prix_forces jsonb not null default '[]'::jsonb;

-- ---------------------------------------------------------------------
--  2. Les devis que les entreprises envoient par mail
--  La table 'documents' ne connaissait que les pièces administratives
--  d'un partenaire. Elle accueille maintenant les devis reçus sur une
--  demande : même casier de fichiers, même politique d'accès.
--
--  on delete cascade : une demande supprimée emporte ses devis. Le
--  fichier lui-même est retiré du casier par la plateforme avant
--  l'effacement de la fiche — la base ne sait pas vider un casier.
-- ---------------------------------------------------------------------
alter table documents
  add column if not exists demande_id uuid references demandes on delete cascade,
  add column if not exists entreprise text,
  add column if not exists montant_ht numeric;

-- une demande affiche ses devis à chaque ouverture de la fiche
create index if not exists documents_demande_idx on documents (demande_id);

-- ---------------------------------------------------------------------
--  3. Ce qui ne change pas, et c'est voulu
--  Aucune politique n'est ajoutée ici. Les devis reçus restent donc
--  visibles de vous seul : la politique documents_admin les couvre, et
--  aucune politique syndic ne porte sur cette table.
--
--  C'est délibéré. Un devis d'entreprise porte le prix d'achat. Le
--  syndic voit le prix que vous retenez, jamais ce qu'il y a dessous,
--  exactement comme il ne voit pas les colonnes du bordereau.
-- ---------------------------------------------------------------------
