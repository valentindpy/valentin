# VD SERVICES — QR Copropriété

Consultation · Pilotage · Maîtrise d'œuvre
Mandelieu-la-Napoule, secteur Fréjus / Nice

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

## `docs/regie-copro.html` — la plateforme VD Services

Back-office publié comme artifact, avec base de données persistante (capacité
`db`). Six vues :

- **Tableau de bord** — chiffres du jour, des 7 jours, du mois en cours ou des
  90 jours : demandes reçues, urgences, en attente, interventions, volume de
  travaux, commissions. Répartition par nature, par type de demandeur et par
  corps de métier, volume par entreprise, et les demandes les plus anciennes
  non traitées.

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
- **Historique** — interventions passées, volume de travaux, commissions.
- **Facturation** — une facture de commissions par entreprise et par mois,
  ligne par intervention, calculée sur la grille d'apport d'affaires.

En urgence, la page publique ne renvoie pas vers le maître d'œuvre : elle met
l'habitant en relation avec l'entreprise d'astreinte la plus proche pour ce
métier. La fiche de la demande porte alors un bandeau rouge, le contact
recommandé et un bouton qui enregistre la mise en relation dans le suivi.

À la clôture, la fiche enregistre qui est intervenu, quand, les photos après
travaux, le numéro et le montant de la facture de l'entreprise, et en déduit la
commission.

### Grille d'apport d'affaires

| Montant HT facturé au client | Commission |
|---|---|
| Jusqu'à 300 € | 30 € HT |
| 301 € à 750 € | 50 € HT |
| 751 € à 1 500 € | 100 € HT |
| 1 501 € à 5 000 € | 10 % |
| 5 001 € à 20 000 € | 7 % |
| 20 001 € à 50 000 € | 5 % |
| Plus de 50 000 € | Sur accord préalable |

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
