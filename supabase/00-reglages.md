# Raccordements VD SERVICES

## Supabase
- Projet  : `https://xunxejadiyaodhwbjqrn.supabase.co`
  (l'adresse à donner au code est celle-ci, **sans** `/rest/v1/` :
   ce suffixe est le chemin de l'API, la bibliothèque l'ajoute elle-même)
- Région  : à confirmer — doit être européenne (Frankfurt ou Paris)
- Clé anon / publishable : celle du formulaire, déjà en place
- Clé service_role : ne sort jamais de Supabase. Elle ne sert qu'à trois
  endroits, tous côté serveur : l'en-tête du webhook qui déclenche
  l'accusé de réception, la tâche planifiée du rappel quotidien, et les
  fonctions elles-mêmes, où Supabase l'injecte sans qu'on l'écrive.

## Les scripts, dans cet ordre
| Fichier | Ce qu'il pose |
|---|---|
| `01-schema.sql` | les tables, les règles d'accès, les deux casiers de fichiers |
| `02-fichiers.sql` | les limites de taille, et le numéro de demande attribué par la base |
| `03-devis-recus.sql` | les devis reçus des entreprises, et le prix fixé à la main |
| `04-messages.sql` | le journal des envois, et le déclencheur de l'accusé |
| `05-rappels.sql` | la tâche quotidienne qui signale les demandes qui dorment |

## Les fonctions
Trois fonctions dans `supabase/functions/`. Elles se déploient avec la
CLI Supabase, ou se collent dans *Edge Functions › Deploy a new
function* du tableau de bord.

```
supabase functions deploy accuse-reception --project-ref xunxejadiyaodhwbjqrn
supabase functions deploy envoyer          --project-ref xunxejadiyaodhwbjqrn
supabase functions deploy rappels          --project-ref xunxejadiyaodhwbjqrn
```

| Fonction | Qui l'appelle | Ce qui part |
|---|---|---|
| `accuse-reception` | la base, à chaque demande déposée | l'accusé au demandeur, votre alerte |
| `envoyer` | la plateforme | les devis aux entreprises, le point d'avancement, le mot de fin de chantier, les factures de commissions |
| `rappels` | la base, une fois par jour | la liste des demandes qui dépassent leur délai |

Ce qui les déclenche se crée une fois : le webhook est expliqué en
commentaire dans `04-messages.sql`, la tâche quotidienne dans
`05-rappels.sql`.

## Qui envoie, et comment
Deux chemins. Le secret `MODE_ENVOI` tranche, et sans lui le mode est
déduit : `SMTP_HOTE` renseigné vaut `smtp`, sinon `brevo`.

| | `smtp` — la boîte du domaine | `brevo` — un service d'envoi |
|---|---|---|
| Qui expédie | votre boîte, chez votre hébergeur | Brevo, votre adresse en expéditeur |
| Mention ajoutée | aucune | « Sent with Brevo » sur l'offre gratuite |
| Coût | rien de plus que la boîte | gratuit jusqu'à 300 par jour |
| Volume | de l'ordre de 500 par jour, souvent progressif les premières semaines | 300 par jour, sans montée en charge |
| Rebonds, journaux | rien, hors la table `messages` | un journal complet chez eux |
| Risque | le port 465 doit sortir de l'environnement des fonctions | aucun, c'est du HTTP |
| SMS | non | oui, payant |

**C'est `smtp` qui est en place.** L'adresse du domaine envoie
elle-même : c'est elle qui parle, sans tiers, sans mention en pied, et
sans compte de plus à tenir.

Le seul vrai risque est technique et ne se vérifie qu'en l'essayant :
une fonction doit pouvoir ouvrir une connexion sortante sur le port du
serveur d'envoi. Si c'est refusé, le message d'erreur le dira
clairement, et basculer est un secret à changer — `MODE_ENVOI=brevo` —
pas une ligne de code à réécrire.

Le code n'appelle le service d'envoi qu'en deux endroits,
`envoyerMailSmtp` et `envoyerMailBrevo` dans
`supabase/functions/_commun/envoi.ts`. En changer ne touche à rien
d'autre.

## Les secrets
*Edge Functions › Secrets*. Aucun ne descend jamais dans une page.

L'envoi par la boîte du domaine :

| Secret | Ce que c'est | Sans lui |
|---|---|---|
| `SMTP_HOTE` | le serveur d'envoi de l'hébergeur | rien ne part |
| `SMTP_UTILISATEUR` | l'adresse complète de la boîte | rien ne part |
| `SMTP_MOTDEPASSE` | son mot de passe | rien ne part |
| `SMTP_PORT` | `465` chiffré de bout en bout, `587` sinon | `465` |
| `EXPEDITEUR_NOM` | le nom affiché | le nom de la société |
| `EXPEDITEUR_EMAIL` | l'adresse qui signe, si elle diffère de la boîte | la boîte |
| `ALERTE_EMAIL` | où vous recevez les demandes et les rappels | l'e-mail de la société |
| `COPIE_ENVOIS` | `oui` ajoute une copie cachée vers la boîte | aucune copie |
| `ORIGINE_AUTORISEE` | le domaine de la plateforme, pour `envoyer` | toutes origines |

`COPIE_ENVOIS` mérite un mot : un envoi par SMTP ne laisse rien dans le
dossier « Envoyés » de la boîte, parce que rien ne passe par un
logiciel de messagerie. La copie cachée est ce qui donne cette trace.
La table `messages` la garde de toute façon, mais dans la base, pas
dans votre courrier.

En option, le service d'envoi :

| Secret | Ce que c'est |
|---|---|
| `MODE_ENVOI` | `smtp` ou `brevo`, pour trancher à la main |
| `BREVO_CLE` | la clé d'API, si vous passez en mode `brevo` |

Et pour le jour où vous ouvrirez les SMS, fermés tant que le premier de
ces trois secrets n'existe pas :

| Secret | Ce que c'est | Sans lui |
|---|---|---|
| `SMS_ACTIF` | `oui` ouvre le canal SMS | aucun SMS n'est tenté |
| `SMS_EXPEDITEUR` | l'expéditeur des SMS, 11 caractères max | `VDSERVICES` |
| `ALERTE_SMS` | où vous recevez les urgences par SMS | le téléphone de la société |

Les SMS passent par Brevo même en mode `smtp` : un serveur de courrier
n'envoie pas de SMS. Ils demandent donc `BREVO_CLE` en plus.

`SUPABASE_URL`, `SUPABASE_ANON_KEY` et `SUPABASE_SERVICE_ROLE_KEY` sont
posés par Supabase : ne les créez pas.

## Pas à pas, la première fois

### 0. La boîte du domaine
Une boîte sur `vd-services.fr` chez l'hébergeur — par exemple
`contact@vd-services.fr`. C'est tout : **aucun enregistrement DNS à
ajouter**. Le courrier du domaine est déjà hébergé là, donc les
signatures qui prouvent votre identité (SPF, DKIM) sont posées par
l'hébergeur et valables pour les messages qui partent de ses serveurs.

C'est l'avantage de ce chemin sur un service d'envoi tiers, qui doit
être autorisé à parler au nom du domaine et demande trois lignes DNS.

Notez le serveur d'envoi affiché dans l'interface de l'hébergeur, et le
port — en général `465` en SSL/TLS, parfois `587`. Pour IONOS le serveur
est `smtp.ionos.fr` ou `smtp.ionos.com` selon le compte : prenez celui
qu'affiche votre espace client, pas celui d'un tutoriel.

Deux limites à connaître avant d'y compter : une boîte ordinaire plafonne
autour de **500 messages par jour**, et une boîte neuve est souvent bridée
les premières semaines — une cinquantaine par heure la première semaine,
puis la bride se desserre. Le besoin réel est de quatre ou cinq messages
par jour, donc large ; mais n'envoyez pas cent accusés le premier matin
pour tester.

### 1. Les secrets, côté Supabase
*Edge Functions* › **Secrets** :

```
SMTP_HOTE        = smtp.ionos.fr        (celui de votre espace client)
SMTP_UTILISATEUR = contact@vd-services.fr
SMTP_MOTDEPASSE  = le mot de passe de cette boîte
EXPEDITEUR_NOM   = VD SERVICES
ALERTE_EMAIL     = contact@vd-services.fr
COPIE_ENVOIS     = oui
```

Le mot de passe d'une boîte ouvre aussi la lecture du courrier : s'il
fuite, on ne fait pas qu'envoyer en votre nom, on vous lit. C'est la
raison pour laquelle il vit dans les secrets de la fonction, et nulle
part ailleurs — ni dans une page, ni dans le dépôt, ni dans un
déclencheur SQL.

### 2. Les fonctions
Déployez les trois fonctions, puis créez le webhook sur `demandes` et la
tâche quotidienne : `04-messages.sql` et `05-rappels.sql` disent comment.

### 3. Vérifier que ça marche
Déposez une vraie demande sur `/formulaire`, avec votre propre adresse
e-mail. Trois endroits doivent le confirmer :

1. votre boîte : l'accusé, et l'alerte avec la référence en objet ;
2. la plateforme : le suivi de la fiche porte « Accusé de réception
   envoyé à … », et la table `messages` la ligne complète ;
3. le dossier « Envoyés » de la boîte, si vous avez mis `COPIE_ENVOIS`.

Puis, sur cette demande, cochez une entreprise et cliquez *Envoyer* :
l'entreprise reçoit la demande de devis, et le demandeur le point
d'avancement, dans la même seconde.

### Quand ça ne part pas
| Ce que vous voyez | Ce que c'est |
|---|---|
| « réglages SMTP incomplets » | un des trois secrets de l'étape 1 manque |
| « 535 » ou « authentication failed » | l'adresse ou le mot de passe de la boîte |
| « 550 » avec une adresse citée | l'hébergeur refuse d'expédier au nom d'une autre boîte que celle qui s'authentifie : laissez `EXPEDITEUR_EMAIL` vide |
| le message met longtemps puis échoue | le port ne sort pas : essayez `SMTP_PORT=587`, puis `MODE_ENVOI=brevo` |
| « 554 » ou « quota » | la limite journalière, ou la bride d'une boîte neuve |
| rien du tout dans le suivi | le webhook n'est pas créé, ou pointe sur la mauvaise fonction |
| « les SMS ne sont pas activés » | c'est voulu : voyez le tableau des secrets SMS |

Les journaux des fonctions sont dans Supabase, *Edge Functions* › la
fonction › **Logs** : chaque échec y est écrit en clair. Et la table
`messages` garde la trace des envois ratés comme des réussis.

## Domaine
- `vd-services.fr`
- Registrar et hébergement du courrier : IONOS
- Boîte d'envoi : à créer sur le domaine, c'est elle qui devient
  `SMTP_UTILISATEUR`

## Adresses prévues
| Adresse | Contenu |
|---|---|
| `vd-services.fr` | page d'accueil |
| `vd-services.fr/formulaire` | le formulaire du QR code |
| `app.vd-services.fr` | la plateforme — à arbitrer |
