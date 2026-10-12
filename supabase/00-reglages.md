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
| `ALERTE_EMAIL` | où vous recevez les demandes | l'e-mail de la société |
| `ORIGINE_AUTORISEE` | le domaine de la plateforme, pour `envoyer` | toutes origines |

Et pour le jour où vous ouvrirez les SMS, fermés tant que le premier de
ces trois secrets n'existe pas :

| Secret | Ce que c'est | Sans lui |
|---|---|---|
| `SMS_ACTIF` | `oui` ouvre le canal SMS | aucun SMS n'est tenté |
| `SMS_EXPEDITEUR` | l'expéditeur des SMS, 11 caractères max | `VDSERVICES` |
| `ALERTE_SMS` | où vous recevez les urgences par SMS | le téléphone de la société |

`SUPABASE_URL`, `SUPABASE_ANON_KEY` et `SUPABASE_SERVICE_ROLE_KEY` sont
posés par Supabase : ne les créez pas.

## Le service d'envoi
Brevo — société française, hébergement européen, e-mail et SMS sur le
même compte.

**L'offre gratuite suffit, et de loin.** Trois cents e-mails par jour,
sans date de fin : une demande en fait partir deux, une consultation
trois de plus. Même à cinq cents demandes par an, on reste à quatre ou
cinq messages par jour.

Deux choses à savoir sur ce palier gratuit :

- chaque message porte la mention **« Sent with Brevo »** dans son pied,
  transactionnels compris, et elle ne peut pas être retirée. La faire
  disparaître demande l'offre payante, une dizaine d'euros par mois ;
- les **SMS ne sont jamais gratuits**, chez Brevo comme ailleurs : quatre
  à six centimes HT le message vers la France, en crédits achetés
  d'avance. Le canal reste donc fermé : tant que `SMS_ACTIF` ne vaut pas
  `oui`, aucune fonction n'essaie d'en envoyer un.

Ce que cela change au quotidien : vous êtes prévenu par e-mail, et
l'objet commence par `URGENCE` quand c'en est une — de quoi régler une
sonnerie dessus. Et un demandeur qui n'a laissé que son numéro ne reçoit
pas d'accusé : la fiche de sa demande l'écrit noir sur blanc, c'est
votre rappel qui en tient lieu. Le champ e-mail du formulaire est
facultatif, sauf pour les entités publiques.

En changer demande de réécrire `envoyerMail` et `envoyerSms` dans
`supabase/functions/_commun/envoi.ts`, et rien d'autre.

## Pas à pas, la première fois

Une heure en tout, dont une attente de propagation DNS. Les écrans de
Brevo bougent d'une année sur l'autre ; les noms de menus sont ceux
d'octobre 2026.

### 0. Le domaine, avant tout
Il faut `vd-services.fr` **enregistré**, et l'accès à sa zone DNS. C'est
le seul vrai prérequis : sans domaine à soi, aucun service d'envoi
sérieux n'accepte d'expédier. Une adresse en `gmail.com` ne peut pas
servir d'expéditeur — Google interdit qu'un tiers envoie en son nom, et
le message est rejeté avant d'arriver.

Pas besoin d'acheter une boîte aux lettres pour autant : une
**redirection** `contact@vd-services.fr` → `vdpy05@gmail.com`, gratuite
chez la plupart des registrars, suffit à recevoir les réponses.

### 1. Le compte
`brevo.com`, *Sign up free*. Aucune carte bancaire. À la question du
volume, répondez au plus juste : c'est ce qui déclenche ou non une
vérification manuelle du compte.

### 2. Authentifier le domaine
*Senders, Domains & Dedicated IPs* › onglet **Domains** › *Add a
domain*, puis `vd-services.fr`.

Brevo affiche alors les enregistrements à publier — un code de
vérification, le DKIM (une ligne TXT, ou deux CNAME selon le compte),
et un DMARC. **Copiez ceux qu'il affiche**, ils sont propres à votre
compte : aucune valeur n'est à inventer ni à reprendre d'un tutoriel.
Chez le registrar, dans la zone DNS, un enregistrement par ligne.

Puis revenez cliquer sur *Verify*. Comptez quelques minutes, parfois
quelques heures. Le DKIM et le DMARC passent au vert quand c'est bon.

Si vous avez déjà un DMARC sur le domaine, ne l'écrasez pas :
l'article d'aide de Brevo décrit le cas.

### 3. L'expéditeur
Même page, onglet **Senders** › *Add a sender* : `contact@vd-services.fr`,
nom affiché `VD SERVICES`. Brevo envoie un code de confirmation à cette
adresse — c'est là que la redirection de l'étape 0 sert.

### 4. La clé d'API
Menu du compte › *Settings* › **SMTP & API** › onglet *API Keys* ›
*Generate a new API key*. Nommez-la `vd-services-fonctions`.

**Elle ne s'affiche qu'une fois.** Copiez-la tout de suite.

Attention à ne pas confondre avec une clé SMTP, créée dans l'onglet
voisin : elle ne marche pas pour l'API, et l'erreur renvoyée ne le dit
pas clairement.

### 5. Les secrets, côté Supabase
*Edge Functions* › **Secrets** :

```
BREVO_CLE        = la clé de l'étape 4
EXPEDITEUR_EMAIL = contact@vd-services.fr
EXPEDITEUR_NOM   = VD SERVICES
ALERTE_EMAIL     = vdpy05@gmail.com
```

Rien d'autre. `SMS_ACTIF` reste absent : le canal SMS est fermé.

### 6. Les fonctions et le webhook
Déployez les deux fonctions, puis créez le webhook sur `demandes` :
tout est écrit plus haut, et en commentaire dans `04-messages.sql`.

### 7. Vérifier que ça marche
Déposez une vraie demande sur `/formulaire`, avec votre propre adresse
e-mail. Trois endroits doivent le confirmer :

1. votre boîte : l'accusé, et l'alerte avec la référence en objet ;
2. Brevo, *Transactional* › **Logs** : deux lignes, *delivered* ;
3. la plateforme : le suivi de la fiche porte « Accusé de réception
   envoyé à … », et la table `messages` la ligne complète.

### Quand ça ne part pas
| Ce que vous voyez | Ce que c'est |
|---|---|
| la fiche dit « Échec de l'envoi — … 401 » | la clé d'API : absente, mal copiée, ou c'est une clé SMTP |
| « sender not valid » ou 400 | l'expéditeur de l'étape 3 n'est pas confirmé |
| rien du tout dans le suivi | le webhook n'est pas créé, ou pointe sur la mauvaise fonction |
| le message arrive dans les indésirables | le DKIM n'est pas encore vert, ou pas propagé |
| « les SMS ne sont pas activés » | c'est voulu : voyez le tableau des secrets SMS |

Les journaux des fonctions sont dans Supabase, *Edge Functions* › la
fonction › **Logs** : chaque échec y est écrit en clair.

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
