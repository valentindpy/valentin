# Messages automatiques — spécification

Ce que le site public devra envoyer dès qu'une demande est validée. Les textes
sont déjà écrits et générés par la plateforme : la fonction `accuseReception(d)`
dans `docs/regie-copro.html` produit exactement le corps de message et la version
SMS décrits ici. Tant que le site n'existe pas, le bouton **Accusé de réception**
sur chaque fiche de demande permet de les envoyer à la main, avec le même texte.

## Déclencheurs

| Quand | Vers qui | Canal | Délai |
|---|---|---|---|
| Demande validée sur le formulaire | Le demandeur | E-mail si fourni, SMS sinon | Immédiat |
| Demande validée sur le formulaire | VD Services | E-mail et SMS | Immédiat |
| Urgence validée | VD Services | SMS prioritaire | Immédiat |
| Demande de devis envoyée aux entreprises | Le demandeur | E-mail | À l'envoi |
| Intervention clôturée | Le demandeur | E-mail | À la clôture |
| Demande sans action depuis 48 h | VD Services | E-mail de rappel | Quotidien |

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

## Ce qu'il faut brancher

1. Un domaine et une boîte professionnelle, par exemple `contact@` sur le
   domaine du site.
2. Un service d'envoi transactionnel. Une page statique ne peut pas envoyer
   d'e-mail elle-même : il faut un point de réception côté serveur.
3. Un service de SMS pour l'urgence et la confirmation courte.
4. Une clé d'envoi stockée côté serveur, jamais dans la page publique.

## Règle à ne pas enfreindre

Aucun message ne part vers une personne qui n'a pas rempli le formulaire. Le
démarchage téléphonique et par message pour la rénovation énergétique est
interdit. Les adresses collectées ici ne servent qu'au traitement de la demande
correspondante, jamais à une liste de diffusion.
