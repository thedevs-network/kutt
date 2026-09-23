# Raccourci iOS privé

Cet exemple crée un lien dans votre compte Kutt depuis la feuille de partage iOS
ou une URL saisie, puis copie le lien court retourné. Les liens compatibles sont
réutilisés (`reuse: true`) ; cela ne garantit ni l'idempotence ni une nouvelle
tentative sans doublon. Le jeton limité au domaine par défaut peut créer des liens,
mais pas les consulter, les modifier, les supprimer, lire les statistiques, gérer
les jetons ou les utilisateurs, ni utiliser des domaines personnalisés. Les
redirections courtes restent publiques.

## Configuration

1. Connectez-vous à Kutt avec votre SSO habituel. Ouvrez Paramètres > Raccourci iOS.
2. Téléchargez `Kutt-Shorten-URL.shortcut` et ouvrez-le dans Raccourcis d'Apple.
   Inspectez les actions : le modèle contient des valeurs d'exemple, jamais de
   secret. Ses invites intégrées restent en anglais afin de préserver sa signature.
3. Donnez au jeton un nom propre à cet appareil et choisissez Créer un jeton
   Raccourcis. Copiez l'URL HTTPS exacte de l'API et le secret affiché une seule
   fois dans les deux questions d'importation. L'URL doit finir par `/api/v2/links` ;
   n'utilisez pas une URL de connexion, un lien court, une URL HTTP, un tunnel ou
   un service tiers. Masquez le secret après l'enregistrement, ou révoquez-le si
   vous abandonnez la configuration.
4. Terminez l'ajout du raccourci. Partagez une URL depuis Safari et choisissez ce
   raccourci. Sélectionnez l'URL voulue si l'application en fournit plusieurs.
   Lors d'un lancement direct, saisissez l'URL demandée. L'URL partagée est une
   donnée JSON, jamais l'adresse du serveur HTTP.
5. Si Raccourcis demande un accès réseau, n'autorisez que l'hôte API Kutt prévu.
   Annulez toute destination inattendue. Vérifiez une fois le lien court copié.

L'action Apple « Obtenir le contenu de l'URL » peut suivre les redirections.
Utilisez une URL HTTPS exacte et de confiance qui accepte directement le jeton
restreint, sans redirection vers le SSO ou un autre hôte. N'approuvez pas une
destination inattendue et n'affaiblissez ni le WAF ni le SSO. Les requêtes API
valides retournent du JSON, pas un formulaire de connexion. Il n'y a qu'un POST,
sans nouvelle tentative automatique ni récupération de la destination partagée.

## Secrets Et Renouvellement

Le jeton expire après 30 jours et n'est affiché qu'une fois. Kutt conserve son
empreinte. Raccourcis stocke le texte configuré localement et peut le synchroniser
avec votre compte Apple ; ce n'est pas un coffre-fort de mots de passe. Ne publiez,
n'exportez pour partage, ne téléversez, ne signez et n'envoyez jamais une copie
configurée contenant un jeton. Le modèle signé fourni ne contient aucun secret.
La copie dans le presse-papiers est locale à l'appareil ; effacez son contenu
sensible après la configuration. Utilisez un jeton distinct par appareil.

Pour renouveler, créez un remplacement dans Kutt, mettez à jour uniquement votre
raccourci privé, testez-le, puis révoquez l'ancien jeton nommé dans Paramètres >
Jetons API. En cas de perte d'appareil ou de fuite suspectée, révoquez d'abord.
La révocation s'applique dès la requête suivante. Ne remplacez pas ce jeton par
une ancienne clé API ou une clé d'administration.

## Erreurs Et Récupération

- 401 : jeton expiré/révoqué ou compte inactif. Connectez-vous à Kutt et créez un
  nouveau jeton restreint. N'automatisez pas des identifiants de renouvellement illimités.
- 403 : restriction de portée/domaine ou blocage WAF. Consultez les journaux Kutt
  et WAF en privé ; conservez les restrictions du jeton et le WAF activé.
- 429 : attendez avant de réessayer manuellement, sans boucle automatique.
- Délai réseau dépassé : le serveur a peut-être déjà créé le lien. Consultez la
  Bibliothèque avant de réessayer. `reuse` réduit les doublons ordinaires sans
  garantir une exécution unique.
- `link` absent, réponse non JSON ou présence d'`error` : rien n'est copié.
  Vérifiez l'URL API et l'état du service. Les erreurs de transport natives
  arrêtent également le raccourci.
- Saisie absente ou annulation : aucune requête n'est envoyée. Les redirections
  publiques ne dépendent ni du raccourci, ni d'un jeton, ni du SSO.

Aucune migration de base de données n'est nécessaire : cette fonction utilise
la table existante des jetons restreints hachés et l'API de liens. Sauvegardez la
base normalement. Après récupération, vérifiez expiration, révocation et accès
au compte ; révoquez les jetons des appareils perdus. Ne revenez pas à une version
ignorant les restrictions de domaine. Retirer la page de configuration ne révoque
pas les jetons existants ; révoquez-les explicitement d'abord.

## API

`/api` et `/api/v2` proposent ces routes réservées aux sessions connectées :

- `GET /shortcuts` : URL exacte, politique fixe du jeton, exemple et téléchargements.
- `POST /shortcuts/token` avec `{"name":"Mon iPhone"}` : HTTP 201 avec le secret
  affiché une seule fois, son ID, la portée `links:create`, le domaine par défaut
  et une expiration à 30 jours. Les autres champs sont refusés. Cinq créations
  par minute et par client si la limitation est activée. Les règles même origine
  et CSRF s'appliquent.
- `GET /shortcuts/template` : pièce jointe native signée, sans secret.
- `GET /shortcuts/guide` : ce guide. Toutes les réponses sont privées/no-store.

Les jetons API restreints et les anciennes clés ne peuvent ni émettre de secrets
ni télécharger ces ressources privées, même avec un cookie administrateur.
Révoquez via `DELETE /tokens/{id}`, réservé aux sessions ; seul le propriétaire
peut révoquer son jeton.

## Reproduire Le Modèle

`examples/ios-shortcut.cjs` est le graphe d'actions vérifiable. Il ne contient ni
script externe, ni adresse propre à un compte, ni jeton, ni redirection, ni code
distant exécutable. `scripts/build-shortcut.py` produit un plist XML déterministe :

```sh
python3 scripts/build-shortcut.py --output /tmp/Kutt-Shorten-URL.unsigned.shortcut
shortcuts sign --mode anyone --input /tmp/Kutt-Shorten-URL.unsigned.shortcut --output examples/Kutt-Shorten-URL.shortcut
chmod 0644 examples/Kutt-Shorten-URL.shortcut
```

La signature exige macOS et le service Apple. Signez uniquement le modèle avec
ses valeurs d'exemple, jamais un vrai jeton. Avant publication, examinez le graphe,
testez-le dans Raccourcis et vérifiez les octets téléchargés. La CI Linux vérifie
le graphe source et la somme de contrôle ; elle n'exécute pas un iPhone. La CI
macOS utilise aussi `python3 scripts/verify-shortcut.py` pour décoder l'artefact
signé sans l'importer ni l'exécuter, puis comparer actions et questions d'importation
à la source. Elle vérifie la signature avec la clé intégrée, pas une chaîne de
confiance indépendante de l'autorité Apple.

Le modèle de référence a été testé dans Raccourcis macOS avec des identifiants
fictifs et un serveur local (succès JSON, erreur API, annulation). La configuration
web a ses propres tests ordinateur/mobile. Aucune validation physique sur iPhone
n'a été effectuée ; suivez les contrôles ci-dessus lors du premier import privé.

Références Apple : [requêtes HTTP](https://support.apple.com/guide/shortcuts/request-your-first-api-apd58d46713f/ios),
[questions d'importation](https://support.apple.com/guide/shortcuts/add-import-questions-to-shared-shortcuts-apdf330fd3a0/ios),
[confidentialité du partage](https://www.apple.com/legal/privacy/data/en/shortcuts-sharing/).
