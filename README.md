# QR Copropriété

Deux pièces, qui se parlent : la page publique qui qualifie une demande, et le
back-office qui la traite.

## `docs/parcours-qr.html` — la page de destination du QR code

Note de conception du parcours : schéma des trois parcours (urgence, dépannage,
projet), règle de routage entreprise / maîtrise d'œuvre, prototype cliquable du
formulaire avec chronomètre, décisions à arbitrer avant l'implémentation.

| Parcours  | Taps | Durée  | Sortie                  |
|-----------|------|--------|-------------------------|
| Urgence   | 3    | ~10 s  | Appel direct, astreinte |
| Dépannage | 5    | ~45 s  | Rappel puis passage     |
| Projet    | 12   | ~90 s  | Visite et chiffrage     |

Quatre données suffisent au routage : l'intention, le ou les corps de métier, la
nature de la partie concernée et le statut du demandeur.

## `docs/regie-copro.html` — la plateforme

Back-office publié comme artifact, avec base de données persistante (capacité
`db`). Quatre vues :

- **Demandes** — boîte de réception, filtres par état, fiche détaillée avec
  photos et suivi. En bas de la fiche, le bloc de traitement : appeler le
  demandeur, cocher les entreprises du métier concerné (celles de la commune
  en tête, le reste du secteur ensuite), les appeler une par une ou leur
  envoyer la demande de devis.
- **Prestataires** — navigation en trois temps comme le formulaire : domaine,
  puis ville, puis entreprises. Double notation qualité du travail et
  réactivité, moyennes recalculées à chaque clôture. Secteur couvert : de
  Fréjus à Nice, siège à Mandelieu-la-Napoule.
- **Clients** — professionnels et particuliers ; un syndic porte ses
  copropriétés avec le nombre de lots et le contact du chargé de copropriété.
- **Historique** — interventions passées, volume de travaux, part conservée.

Le **bordereau de prix** est accessible depuis chaque demande : les postes sont
listés, chaque entreprise consultée reçoit une colonne de prix à remplir, le
moins-disant est retenu automatiquement et le prix client est calculé avec la
marge. Deux exports : le bordereau vierge pour les entreprises, le devis chiffré
pour le client.

Les fiches marquées « exemple » sont des données de démonstration, aux bonnes
communes mais fictives. Le bouton « Vider les exemples » les supprime toutes
sans toucher à ce qui a été saisi.

### Reste à brancher

- L'envoi réel du formulaire vers la base de la plateforme.
- Le stockage des photos jointes.
- L'envoi des mails depuis la plateforme, aujourd'hui préparés puis copiés.
