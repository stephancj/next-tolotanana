# Plan d'Implémentation : Système d'Éditions

## 📋 Objectif

Créer un système d'éditions (missions médicales) pour organiser les enregistrements par lieu et année.

## 🎯 Fonctionnalités

1. **Table `editions`** séparée de `medical_records`
2. **Sélection d'édition** à l'ouverture de l'app
3. **Stockage en localStorage** (validité 1 mois)
4. **Migration des données existantes** vers l'édition par défaut (Morondava 2026)
5. **Relation** : Chaque `medical_record` appartient à une `edition`

## 📊 Schéma de Base de Données

### Table `editions`

```sql
CREATE TABLE editions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id TEXT UNIQUE NOT NULL,           -- UUID pour sync
  name TEXT NOT NULL,                        -- Ex: "Mission Morondava 2026"
  place TEXT NOT NULL,                       -- Ex: "Morondava"
  year INTEGER NOT NULL,                     -- Ex: 2026
  start_date TEXT,                           -- Date de début (ISO)
  end_date TEXT,                             -- Date de fin (ISO)
  description TEXT,                          -- Description optionnelle
  is_active INTEGER DEFAULT 1,              -- 1 = active, 0 = archivée
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  deleted INTEGER DEFAULT 0                  -- Soft delete
);
```

### Table `medical_records` (modifiée)

```sql
ALTER TABLE medical_records ADD COLUMN edition_id INTEGER REFERENCES editions(id);
```

## 🔄 Migration des Données

### 1. SQLite (Local)

```typescript
// scripts/migrate-add-editions.ts
async function migrateToEditions() {
  // 1. Créer la table editions
  // 2. Insérer l'édition par défaut "Morondava 2026"
  // 3. Ajouter la colonne edition_id à medical_records
  // 4. Assigner tous les enregistrements existants à l'édition par défaut
}
```

### 2. Neon (PostgreSQL)

```typescript
// scripts/migrate-neon-editions.ts
async function migrateNeonToEditions() {
  // 1. Créer la table editions
  // 2. Insérer l'édition par défaut
  // 3. Ajouter la colonne edition_id à medical_records
  // 4. Mettre à jour tous les enregistrements existants
}
```

### 3. Dexie (Client)

```typescript
// lib/client-db.ts
export interface Edition {
  id?: number;
  public_id: string;
  name: string;
  place: string;
  year: number;
  start_date?: string;
  end_date?: string;
  description?: string;
  is_active: number;
  created_at: string;
  updated_at: string;
  deleted: number;
  sync_status?: 'pending' | 'synced' | 'pending_delete';
}

class MedicalDatabase extends Dexie {
  editions!: Table<Edition>;
  medical_records!: Table<MedicalRecord>;

  constructor() {
    super('MedicalDB');
    this.version(2).stores({
      editions: '++id, public_id, place, year, is_active, sync_status',
      medical_records: '++id, public_id, edition_id, dossier_number, last_name, ...'
    });
  }
}
```

## 🎨 Interface Utilisateur

### 1. Sélecteur d'Édition (Modal au démarrage)

```tsx
// app/components/EditionSelector.tsx
interface EditionSelectorProps {
  onSelect: (edition: Edition) => void;
}

export default function EditionSelector({ onSelect }: EditionSelectorProps) {
  // 1. Charger toutes les éditions actives
  // 2. Afficher dans un modal élégant
  // 3. Permettre de créer une nouvelle édition
  // 4. Sauvegarder la sélection en localStorage
}
```

### 2. LocalStorage

```typescript
// lib/edition-storage.ts
interface StoredEdition {
  editionId: number;
  editionName: string;
  expiresAt: string; // ISO timestamp
}

export function saveSelectedEdition(edition: Edition) {
  const expiresAt = new Date();
  expiresAt.setMonth(expiresAt.getMonth() + 1); // Validité 1 mois
  
  localStorage.setItem('selectedEdition', JSON.stringify({
    editionId: edition.id,
    editionName: edition.name,
    expiresAt: expiresAt.toISOString()
  }));
}

export function getSelectedEdition(): StoredEdition | null {
  const stored = localStorage.getItem('selectedEdition');
  if (!stored) return null;
  
  const data = JSON.parse(stored);
  const expiresAt = new Date(data.expiresAt);
  
  // Vérifier si expiré
  if (expiresAt < new Date()) {
    localStorage.removeItem('selectedEdition');
    return null;
  }
  
  return data;
}
```

### 3. Indicateur d'Édition Active

```tsx
// app/components/EditionIndicator.tsx
export default function EditionIndicator() {
  const [edition, setEdition] = useState<Edition | null>(null);
  
  return (
    <div className="fixed top-4 left-4 bg-white shadow-md rounded-lg px-4 py-2">
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500">Édition:</span>
        <span className="font-bold text-indigo-600">{edition?.name}</span>
        <button onClick={changeEdition}>🔄</button>
      </div>
    </div>
  );
}
```

## 📝 Étapes d'Implémentation

### Phase 1 : Schéma et Migration (Priorité Haute)

- [ ] 1.1. Créer le schéma Drizzle pour `editions`
- [ ] 1.2. Créer l'interface TypeScript `Edition`
- [ ] 1.3. Ajouter `editions` à Dexie
- [ ] 1.4. Script de migration SQLite
- [ ] 1.5. Script de migration Neon
- [ ] 1.6. Créer l'édition par défaut "Morondava 2026"
- [ ] 1.7. Migrer tous les enregistrements existants

### Phase 2 : Gestion du LocalStorage (Priorité Haute)

- [ ] 2.1. Créer `lib/edition-storage.ts`
- [ ] 2.2. Fonctions `saveSelectedEdition()` et `getSelectedEdition()`
- [ ] 2.3. Fonction `clearExpiredEdition()`

### Phase 3 : Interface Utilisateur (Priorité Moyenne)

- [ ] 3.1. Créer `EditionSelector` modal
- [ ] 3.2. Créer `EditionIndicator` component
- [ ] 3.3. Intégrer dans `app/page.tsx`
- [ ] 3.4. Ajouter bouton "Changer d'édition"

### Phase 4 : Logique Métier (Priorité Moyenne)

- [ ] 4.1. Modifier `FicheMedicale.tsx` pour inclure `edition_id`
- [ ] 4.2. Filtrer les enregistrements par édition dans `RecordList.tsx`
- [ ] 4.3. Mettre à jour l'API de sync pour gérer les éditions

### Phase 5 : Fonctionnalités Avancées (Priorité Basse)

- [ ] 5.1. Page de gestion des éditions
- [ ] 5.2. Créer/Modifier/Archiver des éditions
- [ ] 5.3. Statistiques par édition
- [ ] 5.4. Export CSV par édition

## 🔐 Contraintes et Validations

1. **Une édition active par défaut** : Au moins une édition doit être active
2. **Unicité** : Combinaison (place, year) unique
3. **Soft delete** : Les éditions ne sont jamais supprimées physiquement
4. **Cascade** : Si une édition est archivée, ses enregistrements restent accessibles

## 🎯 Exemple de Flux Utilisateur

1. **Ouverture de l'app**
   - Vérifier localStorage pour édition sélectionnée
   - Si absente ou expirée → Afficher `EditionSelector`
   - Si présente → Charger l'édition et continuer

2. **Création d'un enregistrement**
   - Utiliser automatiquement l'édition sélectionnée
   - Pas besoin de sélectionner à chaque fois

3. **Changement d'édition**
   - Clic sur l'indicateur d'édition
   - Sélectionner une autre édition
   - Recharger les enregistrements filtrés

## 📊 Données de Test

### Édition par défaut

```json
{
  "public_id": "uuid-v4-generated",
  "name": "Mission Morondava 2026",
  "place": "Morondava",
  "year": 2026,
  "start_date": "2026-01-01",
  "end_date": "2026-12-31",
  "description": "Mission médicale annuelle à Morondava",
  "is_active": 1
}
```

## 🚀 Commandes de Migration

```bash
# Migration SQLite
pnpm migrate:editions

# Migration Neon
pnpm migrate:neon-editions

# Tout migrer
pnpm migrate:all-editions
```

## ⚠️ Points d'Attention

1. **Synchronisation** : Les éditions doivent être synchronisées avant les enregistrements
2. **Intégrité référentielle** : Vérifier que `edition_id` existe toujours
3. **Performance** : Indexer `edition_id` dans `medical_records`
4. **UX** : Afficher clairement l'édition active en permanence
5. **Migration** : Tester sur une copie de la base avant de migrer en production

## 📅 Timeline Estimée

- **Phase 1** : 2-3 heures
- **Phase 2** : 1 heure
- **Phase 3** : 2-3 heures
- **Phase 4** : 2 heures
- **Phase 5** : 3-4 heures

**Total** : ~10-13 heures de développement
