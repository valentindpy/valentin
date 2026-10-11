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
| Demande validée sur le formulaire | Le demandeur | E-mail si fourni, SMS sinon | Immédiat | **branché** |
| Demande validée sur le formulaire | VD Services | E-mail et SMS | Immédiat | **branché** |
| Urgence validée | VD Services | SMS prioritaire | Immédiat | **branché**, en tête du SMS |
| Demande de devis envoyée aux entreprises | Les entreprises | E-mail | À l'envoi | **branché**, sur bouton |
| Demande de devis envoyée aux entreprises | Le demandeur | E-mail | À l'envoi | reste à faire |
| Intervention clôturée | Le demandeur | E-mail | À la clôture | reste à faire |
| Demande sans action depuis 48 h | VD Services | E-mail de rappel | Quotidien | reste à faire |

Les trois lignes automatiques partent de `accuse-reception`, appelée par la base
à chaque dépôt. La quatrième part de `envoyer`, appelée par la plateforme quand
vous cliquez : le texte qui part est celui que vous venez de relire.

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
côté serveur. Ce sont les deux fonctions de `supabase/functions/`. Le service
d'envoi est Brevo, e-mail et SMS sur le même compte, appelé à deux endroits
précis — `envoyerMail` et `envoyerSms` dans `_commun/envoi.ts`.

La clé d'envoi est un secret de la fonction. Elle ne descend jamais dans une
page servie à un navigateur, et la fonction refuse tout appel qui ne vient pas
de la base ou d'un administrateur connecté.

Chaque envoi, réussi ou raté, laisse une ligne dans la table `messages` :
destinataire, date, texte complet. C'est cette ligne qui rend opposable le délai
de cinq jours ouvrés de la convention d'apport — un message copié à la main n'en
laissait aucune.

Reste à faire chez le prestataire d'envoi, et rien ne part avant : vérifier le
domaine `vd-services.fr` par ses trois lignes DNS, et déclarer une adresse
d'expédition sur ce domaine. Tout est détaillé dans `supabase/00-reglages.md`.

## Règle à ne pas enfreindre

Aucun message ne part vers une personne qui n'a pas rempli le formulaire. Le
démarchage téléphonique et par message pour la rénovation énergétique est
interdit. Les adresses collectées ici ne servent qu'au traitement de la demande
correspondante, jamais à une liste de diffusion.
