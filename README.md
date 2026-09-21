# VD SERVICES — QR Copropriété

Consultation · Pilotage · Coordination et assistance
Mandelieu-la-Napoule, secteur Fréjus / Nice

Deux pièces, qui se parlent : la page publique qui qualifie une demande, et le
back-office qui la traite.

## `docs/parcours-qr.html` — la page de destination du QR code

Note de conception du parcours : schéma des trois parcours (urgence, dépannage,
projet), règle de routage entreprise / coordination, prototype cliquable du
formulaire avec chronomètre, décisions à arbitrer avant l'implémentation.

| Parcours  | Taps | Durée  | Sortie                  |
|-----------|------|--------|-------------------------|
| Urgence   | 3    | ~10 s  | Appel direct, astreinte |
| Dépannage | 5    | ~45 s  | Rappel puis passage     |
| Projet    | 12   | ~90 s  | Visite et chiffrage     |
| Énergie   | 18   | ~2 min | Étude des aides         |
| Public    | 16   | ~2 min | Consultation à n devis  |

Le parcours entité publique est une entrée séparée, sous celle des syndics. Il
recueille le type d'organisme, le service et la fonction de l'interlocuteur, la
nature du besoin, les corps de métier, le site, puis les paramètres de la mise
en concurrence : nombre de devis attendus, montant estimé, date limite de remise
des offres, pièces exigées avec chaque devis, et référence interne de la
consultation. Le mail envoyé aux entreprises devient une lettre de consultation
portant ces éléments.

Le parcours énergie qualifie l'éligibilité aux aides : gestes visés, type et âge
du logement, statut d'occupation, usage du bien, composition et revenus du
foyer, énergie de chauffage actuelle, étiquette du DPE, et surtout si un devis
a déjà été signé. La plateforme en déduit un profil d'aides mobilisables,
nommées et jamais chiffrées : les barèmes changent chaque année et doivent être
vérifiés à la visite.

Quatre données suffisent au routage : l'intention, le ou les corps de métier, la
nature de la partie concernée et le statut du demandeur.

## `docs/site-accueil.html` — la page d'accueil publique

Page d'accueil de VD Services, destinée à être hébergée sur le domaine de la
société. Elle présente les quatre besoins, la méthode, les publics, l'identité,
le recrutement des entreprises partenaires et le contact. Le taux de
commission n'est pas affiché : il se négocie au premier rendez-vous. Les deux formulaires fonctionnent sans serveur, par
ouverture de la messagerie, et sont prêts à être branchés sur un point de
réception. Trois valeurs sont à compléter avant mise en ligne : le téléphone,
l'adresse du siège et le SIREN, signalées en rouge sur la page.

## `docs/audit.html` — la revue avant lancement

Vingt-deux points relevés sur la plateforme, le parcours client et le modèle de
rémunération, avec leur correction et l'ordre d'exécution. Les points techniques
ont été vérifiés dans le code.

## `docs/affiche-qr.html` — la signalétique

Générateur des supports imprimés, avec un vrai QR code régénéré à chaque
changement d'adresse ou de code résidence. Quatre formats à l'échelle réelle :
autocollant de hall 100 × 100 mm, affiche A5 pour le panneau d'affichage,
bandeau vertical 60 × 200 mm et carte de poche 85 × 55 mm. Impression directe
en PDF, et export du code seul en PNG pour l'imprimeur.

## `docs/regie-copro.html` — la plateforme VD Services

Back-office publié comme artifact, avec base de données persistante (capacité
`db`). Deux espaces sur la même base, séparés par un écran de connexion :
le back-office de VD Services, et l'espace syndic.

### Le back-office

Sept vues :

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
- **Prestataires** — fiche complète par entreprise : identité sociale,
  représentant légal, contact d'intervention, couverture, assurances,
  conditions commerciales et évaluation. Le bouton Convention génère la
  convention d'apport d'affaires pré-remplie, prête à imprimer, à copier ou à
  envoyer, et suit son état : sans convention, envoyée, signée. Le bouton
  Documents ouvre huit onglets de pièces administratives : décennale, RC
  professionnelle, vigilance URSSAF, attestation travail dissimulé, Kbis,
  qualifications, RIB et divers. Chaque dépôt est stocké avec la fiche, lu
  automatiquement, et les valeurs trouvées sont proposées à la reprise.
  Navigation en trois temps comme le formulaire : domaine,
  puis ville, puis entreprises. Double notation qualité du travail et
  réactivité, moyennes recalculées à chaque clôture. Secteur couvert : de
  Fréjus à Nice, siège à Mandelieu-la-Napoule.
- **Clients** — professionnels et particuliers ; un syndic porte ses
  copropriétés avec le nombre de lots et le contact du chargé de copropriété.
- **Historique** — interventions passées, volume de travaux, commissions.
- **QR codes** — un code de référence vers le formulaire nu, et un code par
  résidence portant son paramètre d'identification. Import des copropriétés
  des clients en un bouton, impression de l'autocollant de hall et de
  l'affiche A5, export PNG et copie du lien. Le nombre de demandes reçues
  s'affiche en face de chaque résidence.
- **Facturation** — une facture de commissions par entreprise et par mois,
  ligne par intervention, calculée sur la grille d'apport d'affaires.

### L'espace syndic

Chaque client professionnel dispose d'un code d'accès affiché sur sa fiche,
avec un bouton « Voir son espace » qui ouvre un aperçu de ce que ce syndic
voit exactement. Trois vues en lecture seule :

- **Carte** — les copropriétés du portefeuille placées sur une carte du
  littoral, de Fréjus à Nice, tracée en interne sans service de cartographie
  externe. Chaque immeuble est une pastille dont la couleur donne l'état le
  plus avancé du dossier : bleu une demande nouvelle, ambre une intervention
  en cours, vert tout est terminé, gris aucune demande. Le chiffre dans la
  pastille compte les demandes en cours. Les immeubles d'une même commune sont
  écartés en couronne pour rester distincts ; ceux dont la commune n'est pas
  reconnue sont listés sous la carte.
  À droite de la carte, la liste complète des immeubles par ordre
  alphabétique, avec leur pastille d'état et le compte des demandes en cours
  sur le total reçu. Au-dessus, une recherche sur le nom, l'adresse, la
  commune et le chargé de copropriété, un filtre par ville et un filtre par
  état ; la carte et la liste se restreignent ensemble. Un clic sur une ligne
  ou sur une pastille ouvre le détail sous la carte — compteurs par état et
  demandes récentes — sans faire disparaître la liste.
- **Demandes** — la liste complète du portefeuille, filtrable par état, puis la
  fiche : ce qui a été signalé, les photos, l'entreprise retenue avec l'état de
  ses assurances, le montant du devis retenu, le suivi horodaté et, une fois le
  chantier réceptionné, la date, le numéro de facture et les photos de fin de
  travaux.
- **QR codes** — un code par immeuble, à imprimer en autocollant de hall ou en
  affiche A5.

Deux choses ne franchissent jamais la frontière : les colonnes de prix des
entreprises consultées, dont le syndic ne voit que le prix retenu, et les notes
internes de fin de chantier, qui restent au back-office. La sauvegarde complète
et toutes les actions d'écriture sont hors de portée de l'espace syndic.

L'écran de connexion trie les accès, il ne protège pas la page : toute personne
qui possède l'adresse de l'application peut l'ouvrir. Le mot de passe du
back-office se règle dans « Mes coordonnées ».

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
| 5 001 € à 20 000 € | 8 % |
| 20 001 € à 50 000 € | 6 % |
| Plus de 50 000 € | Sur accord préalable |

Le **bordereau de prix** est accessible depuis chaque demande : les postes sont
listés, chaque entreprise consultée reçoit une colonne de prix à remplir, le
moins-disant est retenu automatiquement et le prix client est calculé avec la
marge. Deux exports : le bordereau vierge pour les entreprises, le devis chiffré
pour le client.

Les fiches marquées « exemple » sont des données de démonstration, aux bonnes
communes mais fictives. Le bouton « Vider les exemples » les supprime toutes
sans toucher à ce qui a été saisi.

Le modèle d'origine de la convention est conservé dans
`docs/modeles/convention-apport-affaires.docx`. Le générateur reprend ses
vingt-sept articles et ses deux annexes à l'identique.

### Lecture des pièces déposées

Un PDF avec couche de texte est extrait dans le navigateur, une photo est
envoyée telle quelle. Le contenu part ensuite à Claude, qui renvoie les champs
reconnus : assureur, numéro de police, dates de validité, SIREN, forme sociale,
capital, siège, activités, représentant. Rien n'est écrit dans la fiche sans
validation case par case. Un PDF scanné sans texte n'est pas lisible : il faut
déposer une photo.

L'état du dossier apparaît sur chaque fiche du répertoire : complet, pièces
manquantes, ou attestation expirée. Les quatre premières pièces sont traitées
comme obligatoires, avec alerte soixante jours avant échéance.

La **sauvegarde** se prend depuis le tableau de bord : un fichier unique au
format JSON contenant toutes les collections, plus trois exports tableur pour les
interventions, le répertoire et les clients. Le même écran restaure une
sauvegarde. Un avertissement apparaît au-delà de trente jours sans copie.

Les **accusés de réception** sont générés par la fiche de chaque demande, dans le
texte exact que l'automatisation enverra. La spécification complète est dans
`docs/modeles/mails-automatiques.md`.

### Reste à brancher

- L'envoi réel du formulaire vers la base de la plateforme.
- Le stockage des photos jointes.
- L'envoi des mails depuis la plateforme, aujourd'hui préparés puis copiés.
