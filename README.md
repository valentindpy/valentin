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

## L'identité

### La marque

Un arc et sa clé de voûte. C'est la pierre qu'on pose en dernier, qui ne
porte rien elle-même, et sans laquelle tout le reste tombe : la place
exacte de VD Services entre un client et des artisans. C'est aussi, sur
la Côte, la forme de toutes les portes de vieux village.

Elle est construite, pas dessinée à l'œil : deux cercles concentriques de
rayons 32 et 18, et deux angles — 18 degrés de part et d'autre de la
verticale pour la clé, 5 degrés de respiration de chaque côté. La clé
déborde l'arc, le dessus coupé droit comme une pierre taillée, pour
rester lisible à seize pixels. Tout est dans `site/logo.svg`, commenté.

L'arc prend `currentColor` : la marque suit la couleur du texte qui
l'entoure, en encre sur papier comme en papier sur encre. Seule la clé
garde sa terre cuite — et elle disparaît en impression une encre, où
c'est la silhouette qui porte la reconnaissance.

### Les couleurs

| Jeton | Valeur | Ce qu'il porte |
|---|---|---|
| `--encre` | `#17222E` | le texte, les boutons, la marque. Un noir bleuté, celui d'un plan |
| `--papier` | `#F5F2EC` | le fond. Du papier, pas un écran éteint |
| `--terre` | `#B4552E` | la clé de voûte, un filet, un chiffre. **Une chose à la fois** |
| `--papier` en variante | `#FFFFFF` | le fond blanc, au choix du visiteur par le bouton de l'en-tête |
| `--urg` `--dep` `--pro` `--ene` | — | les quatre parcours, réduits à un repère de deux pixels |

La terre cuite ne touche jamais un bouton principal : elle réchauffe, elle
ne crie pas. Les quatre couleurs des parcours codent, elles ne décorent
pas.

### Les fontes

**Source Serif 4** pour ce qui se lit de loin, **Inter** pour ce qui se lit
de près. L'écart entre les deux fait la hiérarchie ; aucune ombre, aucun
dégradé n'y participe. Le monospace est celui du système : il ne sert
qu'au récapitulatif du formulaire, et trente kilo-octets de plus pour un
bloc de texte aligné ne se justifient pas.

Elles sont **servies par le domaine**, dans `site/polices/`. Deux raisons,
et la seconde compte autant que la première : un aller-retour DNS et TLS
de moins avant que le texte ne s'affiche, et aucune adresse IP de visiteur
transmise à un tiers. Les deux sont sous licence SIL Open Font, qui
autorise la redistribution.

### Les icônes

Toutes sortent du même dessin, par un navigateur — lui seul rend un SVG
fidèlement :

```
node outils/icones-pwa.mjs     # 16, 32, 180, 192, 512 et la version masquée
python3 outils/favicon-ico.py  # emballe 16 et 32 dans site/favicon.ico
```

Les images produites sont versionnées : ces deux commandes ne servent
qu'un jour où la marque change.

## `docs/site-accueil.html` — la page d'accueil publique

Page d'accueil de VD Services, destinée à être hébergée sur le domaine de la
société. Sept sections : la promesse, les quatre besoins, la méthode en quatre
étapes, les publics, l'identité, le recrutement des entreprises partenaires et
le contact. Le taux de commission n'est pas affiché : il se négocie au premier
rendez-vous.

La page est composée sur une grille de douze colonnes, et les blocs n'y
occupent pas tous la même place : le texte à sept colonnes, la carte du secteur
à cinq, une bande pleine largeur en encre au milieu. C'est ce décalage qui
distingue une page composée d'une page empilée.

La carte n'est pas une illustration achetée : elle est tracée depuis les
coordonnées du littoral, les mêmes que la plateforme emploie pour placer les
copropriétés sur la carte du syndic. Fréjus, Mandelieu, Cannes, Antibes, Nice
sont au bon endroit.

Dans le bandeau d'ouverture, à droite, **le formulaire se joue tout seul** dans un
cadre de téléphone. Ce n'est pas une animation inventée : c'est l'application
elle-même, filmée écran par écran, du premier choix à la confirmation. Quatorze
secondes, 230 ko.

```
python3 -m http.server 8777 --directory site     # dans un terminal
node outils/filmer-formulaire.mjs                 # dans un autre
```

Pendant le tournage, les appels vers la base sont interceptés et reçoivent un
201 : **aucune demande n'est créée**, et l'écran de confirmation affiché reste
celui que le vrai code produit. À refaire le jour où le formulaire change
d'allure — sinon la page d'accueil montrerait un produit qui n'existe plus.

La vidéo ne démarre que lorsqu'elle entre dans l'écran, se met en pause quand on
la dépasse, et ne se télécharge pas du tout pour un visiteur qui a demandé moins
d'animations : il reçoit les commandes à la place.

Trois détails qu'on ne remarque que quand ils manquent : les espaces fines
insécables de la typographie française, posées à la construction par
`typographier()` — sans elles, « un établissement public ? » renvoie le point
d'interrogation à la ligne suivante ; les blocs qui montent de sept pixels en
entrant dans l'écran, une seule fois et jamais en sens inverse ; et un menu de
téléphone en HTML seul, qui se referme quand on a choisi.

Les deux formulaires fonctionnent sans serveur, par ouverture de la messagerie,
et sont prêts à être branchés sur un point de réception. Trois valeurs sont à
compléter avant mise en ligne : l'adresse du siège, le SIREN et l'hébergeur,
signalées en rouge sur la page.

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

### Reste à brancher, ici

Ces trois points ne valent que pour la plateforme publiée comme artifact.
L'application de `site/app/` les a tous les trois, et c'est elle qui tourne
sur votre domaine.

- L'envoi réel du formulaire vers la base de la plateforme.
- Le stockage des photos jointes.
- L'envoi des mails, ici préparés puis copiés.

## `supabase/` — la base, et ce qui en part

Quatre scripts à passer dans l'ordre, dans l'éditeur SQL du projet. Chacun est
rejouable : il ne casse rien s'il tourne deux fois.

| Fichier | Ce qu'il pose |
|---|---|
| `01-schema.sql` | les douze tables, les règles d'accès, les deux casiers de fichiers |
| `02-fichiers.sql` | les limites de taille, et le numéro de demande attribué par la base |
| `03-devis-recus.sql` | les devis reçus des entreprises, et le prix fixé à la main |
| `04-messages.sql` | le journal des envois, et le déclencheur de l'accusé de réception |
| `05-rappels.sql` | la tâche quotidienne qui signale les demandes qui dorment |

La règle de base est que tout est fermé, et qu'on ouvre ligne par ligne. Le seul
droit donné au public est de **déposer** une demande : il ne peut pas la relire,
ni voir quoi que ce soit d'autre. Un syndic connecté lit son parc, et rien
au-delà. Ce n'est pas le rendu de la page qui le décide, c'est la base.

`supabase/functions/` tient les trois fonctions d'envoi, et
`supabase/00-reglages.md` tout ce qui se branche à la main : la boîte
d'expédition, le webhook, la tâche quotidienne.

## `site/` — le site public, à déposer sur Vercel

Dossier prêt à déployer, produit par `outils/construire-site.py` à partir des
pages de `docs/`. Ne modifiez pas `site/` à la main : changez `docs/`, puis

```
python3 outils/construire-site.py
```

| Fichier | Adresse servie | Contenu |
|---|---|---|
| `site/index.html` | `/` | la page d'accueil, avec les liens du formulaire en relatif |
| `site/formulaire/index.html` | `/formulaire` | le formulaire du QR code, seul et plein écran |
| `site/en/index.html` | `/en/` | la page d'accueil en anglais |
| `site/en/form/index.html` | `/en/form` | le formulaire en anglais |
| `site/sitemap.xml` | `/sitemap.xml` | le plan du site, écrit par la construction |
| `site/vercel.json` | — | URLs propres, en-têtes de sécurité, redirections `/copro` et `/demande` |
| `site/robots.txt` | `/robots.txt` | indexation ouverte |
| `site/manifest.webmanifest` | `/manifest.webmanifest` | ce qui fait du formulaire une application installable |
| `site/sw.js` | `/sw.js` | le cache qui permet d'ouvrir le formulaire sans réseau |
| `site/icones/` | `/icones/…` | les icônes de l'écran d'accueil, produites par `outils/icones-pwa.mjs` |
| `site/polices/` | `/polices/…` | les deux fontes, servies par le domaine |
| `site/video/` | `/video/…` | la démonstration du formulaire, produite par `outils/filmer-formulaire.mjs` |

Le formulaire est le prototype de `docs/parcours-qr.html`, sans le chronomètre
ni la fiche de démonstration, avec l'envoi réel au bout. Il lit trois
paramètres dans l'adresse : `res` préremplit la résidence (c'est ce que les QR
codes par immeuble ajoutent), `besoin` présélectionne le parcours depuis les
cartes de la page d'accueil, `depuis` note la provenance.

### Les langues

Le site n'a qu'une source, en français : `docs/site-accueil.html` et le
formulaire. Les autres langues sont **produites à la construction**, en
remplaçant des fragments entiers par leur traduction. Il n'y a donc pas de
clés semées dans le HTML, pas de `data-i18n`, pas de bibliothèque : la page
française reste lisible et modifiable telle quelle, et c'est elle qui fait
foi.

```
outils/traduire.py          le moteur
outils/langues/en.json      le dictionnaire anglais
```

Chaque dictionnaire tient en quatre champs : `nom` (ce qu'affiche le
sélecteur), `prefixe` (`/en`), `chemin_form` (`form`), et `textes`, le
dictionnaire proprement dit. Pour corriger une phrase anglaise, on change sa
valeur dans `textes` et on reconstruit — rien d'autre.

**La règle qui évite les accidents.** On ne remplace jamais un bout de texte,
seulement un fragment entier, à l'un des trois endroits où un visiteur peut
lire quelque chose : un nœud de texte, un attribut visible (`placeholder`,
`aria-label`, `title`, `alt`), une chaîne de caractères du script. Une entrée
dont la clé serait « Contact » ne touchera donc jamais `MAIL_CONTACT`, ni
`#f-contact`, ni « contactez » — seulement un fragment qui vaut exactement
« Contact ». C'est ce qui rend la chose sûre sur un formulaire de trois mille
lignes dont tout le texte vit dans du script. C'est aussi pourquoi les
identifiants restent français dans toutes les langues :
`data-statut="locataire"` désigne le même bouton partout.

**Le moteur parcourt le script, il ne le devine pas.** Reconnaître une
chaîne de caractères dans du JavaScript demande de reconnaître en même temps
les commentaires et les expressions régulières — sinon chacun déguise les
autres. Deux versions l'ont appris à leurs dépens : une apostrophe française
dans un commentaire ouvrait une fausse chaîne, puis `accept="image/*"` dans
une chaîne a ouvert un faux commentaire qui ne se fermait jamais, et **le
tiers du formulaire qui suivait n'était ni traduit ni signalé**. Il sortait
en français au milieu de la page anglaise, sans que rien ne le dise.
`parcourir()` fait donc un seul passage qui connaît les quatre genres à la
fois : code, chaîne, commentaire, expression régulière.

**Le dictionnaire tient du français lisible.** Les clés portent de vraies
apostrophes, pas les barres obliques du code : `J'accepte`, et non
`J\'accepte`. Le moteur déséchappe avant de chercher et réchappe après avoir
remplacé.

**Ce qui n'est pas traduit est signalé.** La construction affiche les
fragments français restés sans traduction :

```
site/en/index.html   57808 car. · 546 fragments traduits
   !! 3 fragment(s) sans traduction :
      . Nous rappelons dans la journée
```

Une phrase ajoutée au site et oubliée dans le dictionnaire se voit tout de
suite, au lieu d'apparaître en français au milieu d'une page anglaise. Le
champ `ignorer` du dictionnaire sert à taire ce qu'on laisse volontairement
tel quel — un nom de ville, un sélecteur CSS, un en-tête HTTP — pour que le
rapport reste court, donc lu. La construction signale aussi, à l'inverse, les
entrées du dictionnaire qui n'ont servi nulle part : la trace d'une phrase
retirée du site.

**La typographie française ne s'applique qu'au français.** L'espace fine
insécable devant `? ! ;` est une règle française ; l'appliquer avant de
traduire empêcherait le dictionnaire de reconnaître ses propres clés.

**La démonstration est filmée dans chaque langue.** `/en/` montre
`formulaire-en.mp4`, enregistré sur `/en/form` :

```
python3 -m http.server 8777 --directory site
node outils/filmer-formulaire.mjs        # la version française
node outils/filmer-formulaire.mjs en     # la version anglaise
```

**Vérifier qu'une langue marche vraiment.** Un dictionnaire complet ne
garantit rien : une traduction peut avoir cassé un écran, ou débordé de la
largeur d'un téléphone. Le parcours joué le dit.

```
node outils/essayer-formulaire.mjs       # français
node outils/essayer-formulaire.mjs en    # anglais
```

Il joue **les cinq parcours** — urgence, dépannage, projet, travaux financés,
entité publique — chacun jusqu'à sa confirmation, et échoue si l'un d'eux
bloque, si la page déborde, si le script jette une erreur, ou s'il reste un
mot grammatical français dans un écran anglais. Les appels à Supabase sont
interceptés : **rien n'est enregistré dans la base.**

Les cinq, et pas un seul : une version de ce script ne jouait que le
dépannage, pendant que deux parcours sur cinq étaient impossibles à terminer.
Et dans **l'ordre naturel** — on choisit d'abord, on tape ensuite — car c'est
cet ordre-là qui était cassé. Ne réordonnez pas les pas pour faire passer le
test.

Il bloque aussi le service worker. Sans cela, Chromium ressert la version
précédente du formulaire et le test porte sur la build d'hier.

**Ajouter une langue** se fait en trois gestes : copier `outils/langues/en.json`
sous le nouveau code, traduire ses valeurs, ajouter le code à `LANGUES` dans
`outils/construire-site.py`, et ajouter le drapeau et le lien au sélecteur de
`docs/site-accueil.html`. Le plan du site, les liens `hreflang`, le manifeste
et le service worker suivent tout seuls. Une précision : **un drapeau désigne
un pays, pas une langue**, et « belge » n'est pas une langue — la Belgique
parle néerlandais, français et allemand.

### Déployer

Sur vercel.com, *Add New* › *Project* › *Import* le dépôt, puis **Root
Directory : `site`**, framework *Other*, aucune commande de build. Ou, sans
dépôt, glisser le dossier `site/` dans l'écran de déploiement. Le domaine se
branche ensuite dans *Settings* › *Domains*.

### Le formulaire comme application

Sur un téléphone, le formulaire s'installe sur l'écran d'accueil et
s'ouvre sans barre d'adresse, **directement sur le choix** — urgence,
dépannage, projet, travaux financés, entité publique. Pas de page
d'accueil à traverser : quelqu'un qui scanne un QR code dans un hall a
déjà décidé de signaler quelque chose.

Trois choses le distinguent d'une page ordinaire :

- **les raccourcis** : un appui long sur l'icône ouvre directement l'un
  des quatre parcours, sans passer par l'écran du choix ;
- **le hors-réseau** : un service worker garde la dernière version sous
  la main. Dans une cave ou un hall en sous-sol, le formulaire s'ouvre
  quand même. Le réseau reste prioritaire — une page servie depuis le
  cache pourrait annoncer un numéro d'astreinte périmé ;
- **l'invitation à installer**, montrée une seule fois : refusée, elle
  ne revient pas. Android ouvre la boîte de dialogue du système ; iOS
  n'a pas d'API pour cela, la bannière dit donc simplement où se trouve
  le bouton.

Le dépôt d'une demande part en POST et n'est jamais mis en cache : sans
réseau il échoue franchement, et le formulaire bascule sur l'envoi par
messagerie en le disant.

Les icônes se régénèrent le jour où le logo change :

```
node outils/icones-pwa.mjs
```

C'est le seul endroit du dépôt qui demande un navigateur — le dessin est
rendu avec la vraie fonte, puis photographié. Les images produites sont
versionnées, le script ne sert donc presque jamais.

### Le dépôt d'une demande

Le formulaire écrit directement dans la base Supabase, sans bibliothèque :
l'API se parle en HTTP ordinaire. Une demande déposée crée une ligne dans
`demandes`, puis les photos partent dans le casier `photos` et une ligne par
photo dans la table du même nom. La clé utilisée est la clé **publique** : elle
n'autorise que le dépôt, jamais la lecture, et c'est le SQL qui l'impose.

Si la base refuse ou ne répond pas, le dernier écran ne ment pas : il bascule
sur l'envoi par messagerie, récapitulatif déjà rédigé. Une demande n'est
jamais perdue sans que le demandeur le sache.

Réglages en tête du script de `site/formulaire/index.html` : `base` et `cle`
pour Supabase, `mail` pour le repli, `tel` pour les boutons d'appel,
`telAstreinte` et `telSecond` pour le parcours urgence.

Et dans `site/index.html`, par `docs/site-accueil.html` : l'adresse du siège,
le SIREN et l'hébergeur, signalés en rouge sur la page.

La plateforme `docs/regie-copro.html` **ne peut pas** aller sur Vercel : sa base
de données est celle de l'artifact claude.ai. Elle reste là où elle est.

## `site/app/` — la plateforme en application

Produite par `outils/construire-app.py` à partir de `docs/regie-copro.html`
et de `outils/supabase-adaptateur.js`. Les écrans sont les mêmes : ce qui
change est le sol sous leurs pieds.

```
python3 outils/construire-app.py
```

L'adaptateur reconstruit, au-dessus de Supabase, le `db` que la plateforme
croit utiliser : mêmes appels `collection().add()`, `doc().set()`,
`doc().update()`. Trois mille lignes d'écrans n'ont pas bougé. Il traduit au
passage les noms — la plateforme dit `statutDemandeur`, Postgres dit
`statut_demandeur` — range les champs rares des parcours énergie et
consultation publique dans une colonne `extra`, et recolle les photos sur
leur demande après chaque lecture.

Ce qui change pour de bon :

| | Avant, dans l'artifact | Maintenant |
|---|---|---|
| Connexion | un lien secret et un code | e-mail, mot de passe, mot de passe oublié |
| Qui voit quoi | le rendu de la page | les règles de la base, incontournables |
| Photos | des noms de fichiers | de vrais fichiers, affichés par lien signé |
| Sauvegarde | capacité de la plateforme | téléchargement ordinaire |
| Accusés et devis | un texte à copier à la main | ils partent, et la base garde la preuve |
| Lecture des attestations | Claude lisait le PDF | **perdue** : saisie à la main |

La lecture automatique des attestations d'assurance passait par Claude, qui
n'existe pas sur votre domaine. Le fichier est stocké, les dates et le numéro
de police se saisissent sur la fiche. La rebrancher demanderait une fonction
serveur et une clé d'API facturée à l'usage.

La plateforme est servie sur `/app`, en `noindex` : elle n'a rien à faire
dans un moteur de recherche.

### Les messages qui partent

Le dernier écran du formulaire annonçait un rappel, et rien ne partait — ni
vers la personne, ni vers vous. Deux fonctions, dans `supabase/functions/`,
tiennent maintenant cette promesse.

| Fonction | Qui l'appelle | Ce qui part |
|---|---|---|
| `accuse-reception` | la base, à chaque demande déposée | l'accusé au demandeur, et votre alerte |
| `envoyer` | la plateforme | les devis aux entreprises, le point d'avancement, le mot de fin de chantier, les factures de commissions |
| `rappels` | la base, chaque matin | la liste des demandes qui dépassent leur délai |

Six messages, et ce qui les déclenche dit qui décide. La base envoie seule
l'accusé de réception et le rappel du matin. La plateforme enchaîne sans
demander quand le geste vient d'être fait : la demande de devis entraîne le
point d'avancement du demandeur, la clôture entraîne le mot de fin de chantier.
Et deux messages gardent leur bouton, parce qu'ils se relisent avant de partir
— la demande de devis elle-même, et la facture de commissions.

Ce que les messages de suivi ne disent jamais : le nom des entreprises
consultées, leurs prix, et la commission. Le client voit le prix qu'on retient,
jamais ce qu'il y a dessous. C'est la même règle que les colonnes du bordereau,
et c'est aussi ce qui nous garde dans le flux.

Le texte de l'accusé est écrit deux fois : la plateforme le montre, la fonction
l'envoie. C'est une règle de `docs/modeles/mails-automatiques.md`, et elle se
vérifie sur les cinq parcours :

```
node --experimental-strip-types outils/verifier-accuse.mjs
```

Chaque envoi laisse une ligne dans la table `messages` — destinataire, date,
texte complet — et un échec s'écrit aussi, sur la fiche de la demande. C'est
cette ligne qui rend opposable le délai de cinq jours ouvrés de la convention
d'apport : un message copié à la main n'en laissait aucune.

C'est **la boîte du domaine qui expédie**, par le serveur d'envoi de son
hébergeur : l'adresse qui signe est celle qui envoie vraiment, sans tiers et
sans mention ajoutée en pied de message. Rien à ajouter dans le DNS — le
courrier du domaine est hébergé là, donc les signatures qui prouvent
l'identité de l'expéditeur valent pour ce qui part de ses serveurs.

Son mot de passe est un secret de la fonction : il ne descend jamais dans une
page. Un service d'envoi tiers reste en repli, par un secret à changer
(`MODE_ENVOI`), pour le jour où le port ne sortirait pas de l'environnement des
fonctions — cela ne se vérifie qu'en l'essayant.

Le SMS, lui, n'est gratuit nulle part : le canal reste fermé tant que le secret
`SMS_ACTIF` ne vaut pas `oui`. Vous êtes donc prévenu par e-mail, avec
`URGENCE` en tête de l'objet quand c'en est une, et un demandeur qui n'a laissé
que son numéro ne reçoit pas d'accusé — sa fiche l'écrit, et c'est votre rappel
qui en tient lieu.
