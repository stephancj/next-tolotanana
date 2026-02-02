/**
 * Script de migration pour ajouter le système d'éditions dans Neon
 * - Crée la table editions
 * - Ajoute la colonne edition_id à medical_records
 * - Crée l'édition par défaut "Mission Morondava 2026"
 * - Assigne tous les enregistrements existants à cette édition
 */

import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

async function migrateNeonEditions() {
    const sql = neon(process.env.DATABASE_URL!);

    console.log('🔄 Début de la migration des éditions dans Neon...\n');

    try {
        // 1. Vérifier si la table editions existe déjà
        const tablesCheck = await sql`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'editions'
        `;

        if (tablesCheck.length > 0) {
            console.log('ℹ️  La table editions existe déjà');
        } else {
            // 2. Créer la table editions
            console.log('📊 Création de la table editions...');
            await sql`
                CREATE TABLE editions (
                    id SERIAL PRIMARY KEY,
                    public_id UUID UNIQUE NOT NULL,
                    name TEXT NOT NULL,
                    place TEXT NOT NULL,
                    year INTEGER NOT NULL,
                    start_date TEXT,
                    end_date TEXT,
                    description TEXT,
                    is_active INTEGER DEFAULT 1,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    deleted BOOLEAN DEFAULT FALSE
                )
            `;
            console.log('✅ Table editions créée');
        }

        // 3. Vérifier si la colonne edition_id existe dans medical_records
        const columnCheck = await sql`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'medical_records' 
            AND column_name = 'edition_id'
        `;

        if (columnCheck.length > 0) {
            console.log('ℹ️  La colonne edition_id existe déjà dans medical_records');
        } else {
            // 4. Ajouter la colonne edition_id à medical_records
            console.log('📊 Ajout de la colonne edition_id à medical_records...');
            await sql`
                ALTER TABLE medical_records 
                ADD COLUMN edition_id INTEGER REFERENCES editions(id)
            `;
            console.log('✅ Colonne edition_id ajoutée');
        }

        // 5. Vérifier si l'édition par défaut existe
        const defaultEditionCheck = await sql`
            SELECT id FROM editions 
            WHERE place = 'Morondava' AND year = 2026
            LIMIT 1
        `;

        let defaultEditionId: number;

        if (defaultEditionCheck.length > 0) {
            defaultEditionId = defaultEditionCheck[0].id;
            console.log(`ℹ️  Édition par défaut existe déjà (ID: ${defaultEditionId})`);
        } else {
            // 6. Créer l'édition par défaut
            console.log('📝 Création de l\'édition par défaut "Mission Morondava 2026"...');
            const result = await sql`
                INSERT INTO editions (
                    public_id, name, place, year, 
                    start_date, end_date, description, 
                    is_active, created_at, updated_at, deleted
                )
                VALUES (
                    gen_random_uuid(),
                    'Mission Morondava 2026',
                    'Morondava',
                    2026,
                    '2026-01-01',
                    '2026-12-31',
                    'Mission médicale annuelle à Morondava',
                    1,
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP,
                    FALSE
                )
                RETURNING id
            `;
            defaultEditionId = result[0].id;
            console.log(`✅ Édition par défaut créée (ID: ${defaultEditionId})`);
        }

        // 7. Compter les enregistrements sans edition_id
        const recordsToUpdate = await sql`
            SELECT COUNT(*) as count 
            FROM medical_records 
            WHERE edition_id IS NULL
        `;

        const count = parseInt(recordsToUpdate[0].count);

        if (count > 0) {
            // 8. Assigner tous les enregistrements existants à l'édition par défaut
            console.log(`\n📝 Attribution de ${count} enregistrements à l'édition par défaut...`);
            await sql`
                UPDATE medical_records 
                SET edition_id = ${defaultEditionId}
                WHERE edition_id IS NULL
            `;
            console.log(`✅ ${count} enregistrements mis à jour`);
        } else {
            console.log('\nℹ️  Tous les enregistrements ont déjà une édition assignée');
        }

        // 9. Vérification finale
        const stats = await sql`
            SELECT 
                (SELECT COUNT(*) FROM editions WHERE deleted = FALSE) as editions_count,
                (SELECT COUNT(*) FROM medical_records WHERE edition_id IS NOT NULL) as records_with_edition,
                (SELECT COUNT(*) FROM medical_records WHERE edition_id IS NULL) as records_without_edition
        `;

        console.log('\n' + '='.repeat(60));
        console.log('✅ Migration terminée !');
        console.log(`   - ${stats[0].editions_count} édition(s) active(s)`);
        console.log(`   - ${stats[0].records_with_edition} enregistrements avec édition`);
        console.log(`   - ${stats[0].records_without_edition} enregistrements sans édition`);
        console.log('='.repeat(60));

    } catch (error) {
        console.error('❌ Erreur lors de la migration:', error);
        throw error;
    }
}

// Exécuter la migration si le script est appelé directement
if (require.main === module) {
    migrateNeonEditions()
        .then(() => {
            console.log('\n✨ Migration Neon complétée avec succès !');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n💥 Échec de la migration:', error);
            process.exit(1);
        });
}

export { migrateNeonEditions };
