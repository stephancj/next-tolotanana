# Fiche Médicale Application

Application intuitive pour la gestion des fiches médicales, construite avec Next.js et SQLite.

## Prérequis

- Node.js 18+
- Python et make (pour la compilation de better-sqlite3 sur certains systèmes)

## Installation

1. Installez les dépendances :
   ```bash
   npm install
   # Assurez-vous que better-sqlite3 est installé correctement
   npm install better-sqlite3
   npm install -D @types/better-sqlite3
   ```

## Démarrage

Lancez le serveur de développement :

```bash
npm run dev
```

L'application sera accessible sur [http://localhost:3000](http://localhost:3000).

## Fonctionnalités

- **Formulaire de saisie** : Création de fiches médicales complètes (Identité, Paramètres médicaux, Consultations).
- **Stockage Local** : Les données sont stockées dans une base de données SQLite locale (`tolotanana.db`).
- **Liste des Patients** : Visualisation des dossiers enregistrés.
- **Support PWA** : Design responsive.

## Structure de la Base de Données

Le fichier de base de données `tolotanana.db` est créé automatiquement à la racine du projet au premier lancement.
La table `medical_records` contient toutes les informations des patients.

## E-mails de confirmation Brevo

Les candidatures volontaires peuvent envoyer un e-mail transactionnel de confirmation avec Brevo. Configurez les variables serveur suivantes :

```env
BREVO_API_KEY=xkeysib-...
BREVO_SENDER_EMAIL=inscriptions@votre-domaine.mg
BREVO_SENDER_NAME=Tolo-Tagnana
BREVO_REPLY_TO_EMAIL=operationtolotagnana@gmail.com
BREVO_TOLOTAGNANA_LOGO_URL=https://tolotanana.rotary.mg/assets/img/logo-tolotagnana.png
BREVO_ROTARACT_LOGO_URL=https://rotaplast.rotary.mg/assets/rotaract-madagasikara-logo.png
```

Le modèle d'e-mail utilise ces deux logos publics par défaut. Ces variables permettent de remplacer leurs URL si nécessaire.

L’adresse `BREVO_SENDER_EMAIL` doit être un expéditeur ou appartenir à un domaine authentifié dans Brevo. Sans clé ou expéditeur configuré, la candidature reste enregistrée mais l’e-mail est ignoré.

Optionnellement, utilisez un modèle transactionnel Brevo existant :

```env
BREVO_VOLUNTEER_TEMPLATE_ID=123
```

Le modèle reçoit les paramètres `firstName`, `lastName`, `fullName`, `editionName`, `editionPlace`, `editionYear` et `registrationId`.
