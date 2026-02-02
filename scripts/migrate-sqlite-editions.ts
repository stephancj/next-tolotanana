/**
 * Script de migration pour ajouter le système d'éditions dans SQLite
 * - Crée la table editions
 * - Ajoute la colonne edition_id à medical_records
 * - Crée l'édition par défaut "Mission Morondava 2026"
 * - Assigne tous les enregistrements existants à cette édition
 */

import Database from 'better-sqlite3';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

async function migrateSQLiteEditions() {
    const dbPath = path.join(process.cwd(), 'tolotanana.db');
    const db = new Database(dbPath);

    console.log('🔄 Début de la migration des éditions dans SQLite...\n');

    try {
        // 1. Vérifier si la table editions existe
        const tablesCheck = db.prepare(`
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name='editions'
        `).get();

        if (tablesCheck) {
            console.log('ℹ️  La table editions existe déjà');
        } else {
            // 2. Créer la table editions
            console.log('📊 Création de la table editions...');
            db.exec(`
                CREATE TABLE editions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    public_id TEXT UNIQUE NOT NULL,
                    name TEXT NOT NULL,
                    place TEXT NOT NULL,
                    year INTEGER NOT NULL,
                    start_date TEXT,
                    end_date TEXT,
                    description TEXT,
                    is_active INTEGER DEFAULT 1,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    deleted INTEGER DEFAULT 0
                )
            `);
            console.log('✅ Table editions créée');
        }

        // 3. Vérifier si la colonne edition_id existe dans medical_records
        const columnCheck = db.pragma('table_info(medical_records)') as Array<{ name: string }>;
        const hasEditionId = columnCheck.some(col => col.name === 'edition_id');

        if (hasEditionId) {
            console.log('ℹ️  La colonne edition_id existe déjà dans medical_records');
        } else {
            // 4. Ajouter la colonne edition_id à medical_records
            console.log('📊 Ajout de la colonne edition_id à medical_records...');
            db.exec(`
                ALTER TABLE medical_records 
                ADD COLUMN edition_id INTEGER REFERENCES editions(id)
            `);
            console.log('✅ Colonne edition_id ajoutée');
        }

        // 5. Vérifier si l'édition par défaut existe
        const defaultEditionCheck = db.prepare(`
            SELECT id FROM editions 
            WHERE place = ? AND year = ?
            LIMIT 1
        `).get('Morondava', 2026) as { id: number } | undefined;

        let defaultEditionId: number;

        if (defaultEditionCheck) {
            defaultEditionId = defaultEditionCheck.id;
            console.log(`ℹ️  Édition par défaut existe déjà (ID: ${defaultEditionId})`);
        } else {
            // 6. Créer l'édition par défaut
            console.log('📝 Création de l\'édition par défaut "Mission Morondava 2026"...');
            const insertEdition = db.prepare(`
                INSERT INTO editions (
                    public_id, name, place, year, 
                    start_date, end_date, description, 
                    is_active, created_at, updated_at, deleted
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);

            const result = insertEdition.run(
                uuidv4(),
                'Mission Morondava 2026',
                'Morondava',
                2026,
                '2026-01-01',
                '2026-12-31',
                'Mission médicale annuelle à Morondava',
                1,
                new Date().toISOString(),
                new Date().toISOString(),
                0
            );

            defaultEditionId = result.lastInsertRowid as number;
            console.log(`✅ Édition par défaut créée (ID: ${defaultEditionId})`);
        }

        // 7. Compter les enregistrements sans edition_id
        const recordsToUpdate = db.prepare(`
            SELECT COUNT(*) as count 
            FROM medical_records 
            WHERE edition_id IS NULL
        `).get() as { count: number };

        const count = recordsToUpdate.count;

        if (count > 0) {
            // 8. Assigner tous les enregistrements existants à l'édition par défaut
            console.log(`\n📝 Attribution de ${count} enregistrements à l'édition par défaut...`);
            db.prepare(`
                UPDATE medical_records 
                SET edition_id = ?
                WHERE edition_id IS NULL
            `).run(defaultEditionId);
            console.log(`✅ ${count} enregistrements mis à jour`);
        } else {
            console.log('\nℹ️  Tous les enregistrements ont déjà une édition assignée');
        }

        // 9. Vérification finale
        const stats = db.prepare(`
            SELECT 
                (SELECT COUNT(*) FROM editions WHERE deleted = 0) as editions_count,
                (SELECT COUNT(*) FROM medical_records WHERE edition_id IS NOT NULL) as records_with_edition,
                (SELECT COUNT(*) FROM medical_records WHERE edition_id IS NULL) as records_without_edition
        `).get() as { editions_count: number; records_with_edition: number; records_without_edition: number };

        console.log('\n' + '='.repeat(60));
        console.log('✅ Migration terminée !');
        console.log(`   - ${stats.editions_count} édition(s) active(s)`);
        console.log(`   - ${stats.records_with_edition} enregistrements avec édition`);
        console.log(`   - ${stats.records_without_edition} enregistrements sans édition`);
        console.log('='.repeat(60));

        db.close();

    } catch (error) {
        console.error('❌ Erreur lors de la migration:', error);
        db.close();
        throw error;
    }
}

// Exécuter la migration si le script est appelé directement
if (require.main === module) {
    migrateSQLiteEditions()
        .then(() => {
            console.log('\n✨ Migration SQLite complétée avec succès !');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n💥 Échec de la migration:', error);
            process.exit(1);
        });
}

export { migrateSQLiteEditions };
