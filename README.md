# QR Copropriété — page de destination

Dispositif : un QR code affiché dans les halls d'immeubles renvoie vers une page
qui qualifie la demande d'un habitant, d'un syndic ou d'un conseil syndical,
puis la route soit vers une entreprise du réseau, soit vers une mission de
maîtrise d'œuvre.

## Contenu

- `docs/parcours-qr.html` — note de conception du parcours : schéma des trois
  parcours (urgence, dépannage, projet), règle de routage entreprise / maîtrise
  d'œuvre, prototype cliquable du formulaire avec chronomètre, et décisions à
  arbitrer avant l'implémentation.

Ouvrir le fichier dans un navigateur, ou le consulter en ligne comme artifact.

## Cibles de conception

| Parcours  | Taps | Durée  | Sortie                    |
|-----------|------|--------|---------------------------|
| Urgence   | 3    | ~10 s  | Appel direct, astreinte   |
| Dépannage | 5    | ~45 s  | Rappel puis passage        |
| Projet    | 7    | ~70 s  | Visite et chiffrage        |

Le formulaire collecte quatre données qui suffisent au routage : l'intention,
le ou les corps de métier, la nature de la partie concernée (privative ou
commune) et le statut du demandeur.
