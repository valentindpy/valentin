# Messages automatiques — spécification

Ce que le système envoie dès qu'une demande est validée. Le texte est écrit à
deux endroits, et c'est volontaire : la fonction `accuseReception(d)` de
`docs/regie-copro.html` le montre dans la plateforme, celle de
`supabase/functions/_commun/texte.ts` l'envoie. Les deux doivent dire la même
chose au caractère près — `outils/verifier-accuse.mjs` le vérifie sur les cinq
parcours et sort en erreur au premier écart.

## Déclencheurs

| Quand | Vers qui | Canal | Délai | État |
|---|---|---|---|---|
| Demande validée sur le formulaire | Le demandeur | E-mail si fourni, SMS sinon | Immédiat | **branché** ; le SMS demande `SMS_ACTIF` |
| Demande validée sur le formulaire | VD Services | E-mail, et SMS si ouvert | Immédiat | **branché** |
| Urgence validée | VD Services | objet `URGENCE`, SMS si ouvert | Immédiat | **branché** |
| Demande de devis envoyée aux entreprises | Les entreprises | E-mail | À l'envoi | **branché**, sur bouton |
| Demande de devis envoyée aux entreprises | Le demandeur | E-mail | À l'envoi | **branché**, dans la foulée |
| Intervention clôturée | Le demandeur | E-mail | À la clôture | **branché**, dans la foulée |
| Demande sans action depuis son délai | VD Services | E-mail de rappel | Quotidien | **branché** |
| Facture de commissions | L'entreprise | E-mail | Sur bouton | **branché** |

Trois origines, et elles disent qui décide :

- la **base**, quand une demande est déposée (`accuse-reception`) ou chaque
  matin pour les demandes qui dorment (`rappels`) : personne ne clique ;
- la **plateforme**, dans la foulée d'un geste que vous venez de faire — la
  demande de devis entraîne le point d'avancement, la clôture entraîne le mot
  de fin de chantier ;
- la **plateforme, sur un bouton**, quand le message se relit avant de partir :
  la demande de devis elle-même, et la facture de commissions.

Le texte qui part est toujours celui que la plateforme montre. Les deux
messages de suivi ont leur bouton « Prévenir le demandeur » sur la fiche, qui
sert à les relire, les corriger et les renvoyer.

Le SMS est un canal fermé par défaut, parce qu'il est le seul qui se paie à
l'unité. Tant que le secret `SMS_ACTIF` ne vaut pas `oui`, aucune des deux
fonctions n'en tente un : un demandeur qui n'a pas donné d'adresse e-mail ne
reçoit alors pas d'accusé, et sa fiche le dit en clair plutôt que de laisser
croire qu'il a été prévenu.

## Ce que les messages de suivi ne disent jamais

Le point d'avancement annonce « trois entreprises du secteur », jamais
lesquelles. Le mot de fin de chantier donne le montant des travaux et le numéro
de facture de l'entreprise, jamais la commission.

Ce n'est pas de la discrétion pour la forme. Le client qui a les noms et les
prix d'achat n'a plus besoin de nous à la deuxième affaire, et l'article 9 de la
convention ne protège que douze mois, sur le papier. La protection réelle est
d'usage : rester dans le flux. C'est la même règle que les colonnes de prix du
bordereau, que le syndic ne voit pas.

## Variables disponibles

`ref` `recu` `intent` `trades` `presta` `lieu` `statutDemandeur` `residence`
`adresse` `cp` `ville` `precision` `nom` `tel` `email` `description` `photos`
`delai` `budget` `nbDevis` `dateLimite` `pieces` `refInterne` `gestes` `logement`
`anciennete` `occupation` `usage` `personnes` `revenus` `chauffage` `dpe`
`devisSigne` `entite` `organisme` `service` `fonction` `nature` `site`

Côté émetteur : `societe.nom` `societe.repnom` `societe.tel` `societe.email`.

## Objet du message

    VD SERVICES — votre demande {ref} est bien arrivée

## Corps commun

Salutation, rappel de la référence, phrase d'engagement propre au parcours,
récapitulatif de ce qui a été déclaré, invitation à corriger en répondant,
signature, mention de protection des données.

## Phrase d'engagement par parcours

| Parcours | Phrase |
|---|---|
| Urgence | Mise en relation avec l'entreprise d'astreinte nommée, avec son numéro, et invitation à rappeler VD Services si personne ne décroche. |
| Dépannage | Rappel le jour même pour confirmer le créneau, intervention sous 72 heures. |
| Projet | Rappel sous 48 heures pour convenir d'une visite, devis comparables établis sur le même descriptif. |
| Travaux énergétiques financés | Rappel sous 48 heures avec le point sur le financement, et avertissement de ne signer aucun devis avant cet échange. |
| Consultation publique | Lancement de la mise en concurrence, nombre de devis annoncé, date limite rappelée. |

## Version SMS

Moins de 160 caractères, sans lien raccourci d'un tiers.

    VD SERVICES : demande {ref} bien reçue. {engagement court}. {tel}

## Mentions obligatoires en pied de message

Finalité du traitement, destinataire unique, durée de conservation de trois ans,
moyen d'exercer ses droits. Le texte exact est dans la fonction
`accuseReception`, il doit rester identique des deux côtés.

## Comment c'est branché

Une page statique ne peut pas envoyer d'e-mail : il faut un point de réception
côté serveur. Ce sont les trois fonctions de `supabase/functions/`.

C'est la **boîte du domaine** qui expédie, par le serveur d'envoi de son
hébergeur : l'adresse qui signe est celle qui envoie vraiment, sans tiers et
sans mention ajoutée en pied de message. Un service d'envoi tiers reste
disponible en repli, par un secret à changer, pour le jour où le port ne
sortirait pas de l'environnement des fonctions.

Le mot de passe de la boîte est un secret de la fonction. Il ne descend jamais
dans une page servie à un navigateur, et chaque fonction refuse tout appel qui
ne vient pas de la base ou d'un administrateur connecté.

Chaque envoi, réussi ou raté, laisse une ligne dans la table `messages` :
destinataire, date, texte complet. C'est cette ligne qui rend opposable le délai
de cinq jours ouvrés de la convention d'apport — un message copié à la main n'en
laissait aucune.

Il reste à créer la boîte sur le domaine et à poser ses identifiants dans les
secrets des fonctions : rien ne part avant. Aucune ligne DNS à ajouter, en
revanche — le courrier du domaine est déjà hébergé là, donc les signatures qui
prouvent l'identité de l'expéditeur sont valables pour les messages qui partent
de ses serveurs. Tout est détaillé dans `supabase/00-reglages.md`.

## Règle à ne pas enfreindre

Aucun message ne part vers une personne qui n'a pas rempli le formulaire. Le
démarchage téléphonique et par message pour la rénovation énergétique est
interdit. Les adresses collectées ici ne servent qu'au traitement de la demande
correspondante, jamais à une liste de diffusion.
