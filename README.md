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
