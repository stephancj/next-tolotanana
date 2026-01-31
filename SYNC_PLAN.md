# Plan de Synchronisation Offline-First avec Neon (Postgres)

L'objectif est d'implémenter une synchronisation bidirectionnelle robuste entre la base locale (IndexedDB via Dexie) et une base distante Neon (PostgreSQL), tout en gérant les conflits et le mode offline.

---

## 🏗 Architecture

**Client (Next.js PWA)**  
    ⬇⬆ (Sync Engine)  
**API Routes (Next.js)**  
    ⬇⬆ (Drizzle ORM)  
**Neon DB (PostgreSQL)**

Le client est la source de vérité pour l'expérience utilisateur immédiate ("Optimistic UI"). Le serveur agit comme arbitre et stockage durable centralisé.

---

## 📋 Étape 1 : Préparation de la Base de Données (Neon)

Nous allons migrer de `better-sqlite3` (actuellement utilisé pour le dev/local API) vers Neon.

1.  **Changer l'outil d'accès DB** : Utiliser **Drizzle ORM** pour sa légèreté et son excellente compatibilité TypeScript/Serverless.
2.  **Schema Unifié** : Le schéma Postgres doit correspondre exactement au schéma Dexie, avec des champs supplémentaires pour le sync.

### Modifications de Structure (Critiques)

Pour gérer la synchro multi-clients, nous devons passer des IDs auto-incrémentés (`++id` de Dexie) à des **UUIDs**.

1.  **Ajout de `public_id` (UUID)** : Généré par le client lors de la création (`crypto.randomUUID()`). C'est l'ID de référence pour la sync.
2.  **Champs de Métadonnées Sync** :
    *   `updated_at` (Timestamp) : Pour savoir quelle version est la plus récente.
    *   `deleted` (Boolean) : "Soft delete". On ne supprime pas physiquement en local pour pouvoir propager la suppression au serveur.
    *   `sync_status` (Local seulement) : `'synced' | 'pending_update' | 'pending_delete'`.

---

## 🛠 Étape 2 : Adaptation du Client (Front-end)

### 1. Mise à jour du Schema Dexie (`lib/client-db.ts`)
*   Ajouter les colonnes `public_id`, `updated_at`, `deleted`, `sync_status`.
*   Lors d'une **Création** (`add`):
    *   Générer un UUID `public_id`.
    *   Set `updated_at = now()`.
    *   Set `sync_status = 'pending_update'`.
*   Lors d'une **Modification** (`put`):
    *   Update `updated_at = now()`.
    *   Set `sync_status = 'pending_update'`.
*   Lors d'une **Suppression** (`delete` logic update):
    *   Au lieu de `db.table.delete(id)`, faire un `db.table.update(id, { deleted: 1, sync_status: 'pending_delete', updated_at: now() })`.
    *   Filtrer les items `deleted: 1` dans l'UI (`useLiveQuery`).

### 2. Création du Hook de Synchro (`useSync.ts`)
Ce hook se lancera au montage et à intervalle régulier (si online).

**Logique de PUSH (Client Vers Serveur) :**
1.  Récupérer tous les items où `sync_status != 'synced'`.
2.  Envoyer un batch `POST /api/sync/push`.
3.  Si succès, marquer ces items comme `synced` localement.

**Logique de PULL (Serveur Vers Client) :**
1.  Garder en mémoire local `last_pull_timestamp`.
2.  Appeler `GET /api/sync/pull?since={last_pull_timestamp}`.
3.  Le serveur renvoie les records modifiés/créés depuis cette date.
4.  Pour chaque record reçu :
    *   Si le record n'existe pas localement -> Ajouter.
    *   Si le record existe localement :
        *   Si `local.updated_at > remote.updated_at` (Conflit) -> **Stratégie Simple : Le Serveur Gagne** (ou garder la version locale si pending, à définir).
        *   Sinon -> Écraser avec la version serveur.
5.  Mettre à jour `last_pull_timestamp`.

---

## 🚀 Étape 3 : Implémentation Serveur (API Routes)

Créer `app/api/sync/route.ts`.

### 1. POST (Push)
*   Reçoit un tableau de modifications.
*   Transaction DB :
    *   Pour chaque item :
        *   `INSERT ... ON CONFLICT (public_id) DO UPDATE ...`
        *   Vérifier timestamps pour ne pas écraser une version plus récente reçue d'un autre client (Optimistic Locking).

### 2. GET (Pull)
*   `SELECT * FROM medical_records WHERE updated_at > :since`.
*   Retourner les données JSON.

---

## ⚠️ Gestion des Conflits et Concurrence

Pour gérer plusieurs clients modifiant le même dossier :

1.  **Dernier qui écrit gagne (Last Write Wins - LWW)** : Basé sur `updated_at`. Suffisant pour 90% des cas offline simples.
2.  **Protection "Stale Write"** : Si le client envoie une update sur un record, mais que le serveur a une version plus récente (`server.updated_at > client.updated_at`), le serveur peut ignorer l'update ou renvoyer une erreur (que le client devra gérer en re-pullant).

---

## 📝 Plan d'Action Détaillé

### Phase 1 : Infrastructure & Migration Locale (Sans casser les features actuelles)
1.  Installer `drizzle-orm`, `drizzle-kit`, `postgres` (ou `@neondatabase/serverless`).
2.  Configurer la connection Neon dans `.env`.
3.  Modifier `MedicalRecord` interface : ajouter champs optionnels `public_id`, `deleted`, `sync_status`.
4.  Créer une fonction utilitaire de migration locale qui, au chargement de l'app, attribue un `public_id` aux vieux records qui n'en ont pas.

### Phase 2 : Logique "Soft Delete" et UUID
1.  Modifier `RecordList.tsx` : `deleteRecord` doit faire un soft delete.
2.  Modifier `useLiveQuery` : filtrer `.filter(r => !r.deleted)`.
3.  Modifier `FicheMedicale.tsx` : génération de UUID à la création.

### Phase 3 : Backend Sync API
1.  Créer schéma Drizzle correspondant aux données.
2.  Implémenter `route.ts` pour Push/Pull.

### Phase 4 : Hook Sync et UI
1.  Implémenter `useSync` hook.
2.  Ajouter un indicateur visuel (🟢 Connecté/Synchro | 🟠 En attente | 🔴 Offline).

### Phase 5 : Tests
1.  Tester : Créer offline -> Revenir online -> Vérifier que ça apparaît dans Neon.
2.  Tester : Modifier sur Neon -> Rafraîchir client -> Vérifier update local.
