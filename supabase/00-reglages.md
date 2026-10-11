# Raccordements VD SERVICES

## Supabase
- Projet  : `https://xunxejadiyaodhwbjqrn.supabase.co`
  (l'adresse à donner au code est celle-ci, **sans** `/rest/v1/` :
   ce suffixe est le chemin de l'API, la bibliothèque l'ajoute elle-même)
- Région  : à confirmer — doit être européenne (Frankfurt ou Paris)
- Clé anon / publishable : celle du formulaire, déjà en place
- Clé service_role : ne sort jamais de Supabase. Elle ne sert qu'à deux
  endroits, tous les deux côté serveur : l'en-tête du webhook qui
  déclenche l'accusé de réception, et les fonctions elles-mêmes, où
  Supabase l'injecte sans qu'on l'écrive.

## Les scripts, dans cet ordre
| Fichier | Ce qu'il pose |
|---|---|
| `01-schema.sql` | les tables, les règles d'accès, les deux casiers de fichiers |
| `02-fichiers.sql` | les limites de taille, et le numéro de demande attribué par la base |
| `03-devis-recus.sql` | les devis reçus des entreprises, et le prix fixé à la main |
| `04-messages.sql` | le journal des envois, et le déclencheur de l'accusé |

## Les fonctions d'envoi
Deux fonctions dans `supabase/functions/`. Elles se déploient avec la
CLI Supabase, ou se collent dans *Edge Functions › Deploy a new
function* du tableau de bord.

```
supabase functions deploy accuse-reception --project-ref xunxejadiyaodhwbjqrn
supabase functions deploy envoyer          --project-ref xunxejadiyaodhwbjqrn
```

| Fonction | Qui l'appelle | Ce qu'elle fait |
|---|---|---|
| `accuse-reception` | la base, à chaque demande déposée | l'accusé au demandeur, l'alerte à vous |
| `envoyer` | la plateforme, sur un bouton | envoie le texte que vous venez de relire |

Le webhook qui déclenche la première se crée une fois à la souris : tout
est écrit en commentaire dans `04-messages.sql`.

## Les clés des fonctions
*Edge Functions › Secrets*. Aucune ne descend jamais dans une page.

| Secret | Ce que c'est | Sans lui |
|---|---|---|
| `BREVO_CLE` | la clé d'API Brevo | rien ne part, et la fiche le dit |
| `EXPEDITEUR_EMAIL` | l'adresse d'envoi, **vérifiée chez Brevo** | rien ne part |
| `EXPEDITEUR_NOM` | le nom affiché | le nom de la société |
| `SMS_EXPEDITEUR` | l'expéditeur des SMS, 11 caractères max | `VDSERVICES` |
| `ALERTE_EMAIL` | où vous recevez les demandes | l'e-mail de la société |
| `ALERTE_SMS` | où vous recevez les urgences | le téléphone de la société |
| `ORIGINE_AUTORISEE` | le domaine de la plateforme, pour `envoyer` | toutes origines |

`SUPABASE_URL`, `SUPABASE_ANON_KEY` et `SUPABASE_SERVICE_ROLE_KEY` sont
posés par Supabase : ne les créez pas.

## Le service d'envoi
Brevo — société française, hébergement européen, e-mail et SMS sur le
même compte. Le palier gratuit couvre trois cents e-mails par jour ; les
SMS se paient à l'unité.

Deux choses à faire chez eux avant le premier envoi, et rien ne part
avant :

1. **Vérifier le domaine `vd-services.fr`** — trois lignes DNS à ajouter
   chez le registrar (DKIM, SPF, DMARC). Sans cela un message part dans
   les indésirables, ou ne part pas du tout.
2. **Déclarer l'adresse d'expédition**, par exemple `contact@vd-services.fr`.
   Une adresse en `gmail.com` ne peut pas servir d'expéditeur : Gmail
   interdit qu'un tiers envoie en son nom, et le message est rejeté.

En changer demande de réécrire `envoyerMail` et `envoyerSms` dans
`supabase/functions/_commun/envoi.ts`, et rien d'autre.

## Domaine
- `vd-services.fr`
- Registrar : à préciser
- Boîte mail sur le domaine : à créer — c'est elle qui devient
  `EXPEDITEUR_EMAIL` (en attendant, le site et le formulaire écrivent à
  vdpy05@gmail.com)

## Adresses prévues
| Adresse | Contenu |
|---|---|
| `vd-services.fr` | page d'accueil |
| `vd-services.fr/formulaire` | le formulaire du QR code |
| `app.vd-services.fr` | la plateforme — à arbitrer |
