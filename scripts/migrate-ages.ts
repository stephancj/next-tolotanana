/**
 * Script de migration pour recalculer les âges dans Neon
 * Convertit les âges numériques en format string avec unités (semaines, mois, ans)
 */

import { neon } from '@neondatabase/serverless';
import { calculateAge } from '../lib/age-utils';

async function migrateAges() {
    const sql = neon(process.env.DATABASE_URL!);

    console.log('🔄 Début de la migration des âges...\n');

    try {
        // 1. Vérifier si la colonne age existe et son type
        const columnInfo = await sql`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'medical_records' 
            AND column_name = 'age'
        `;

        if (columnInfo.length === 0) {
            console.log('❌ La colonne age n\'existe pas dans la table medical_records');
            return;
        }

        console.log(`📊 Type actuel de la colonne age: ${columnInfo[0].data_type}`);

        // 2. Si la colonne est INTEGER, la convertir en TEXT
        if (columnInfo[0].data_type === 'integer' || columnInfo[0].data_type === 'bigint') {
            console.log('🔧 Conversion de la colonne age de INTEGER à TEXT...');
            await sql`ALTER TABLE medical_records ALTER COLUMN age TYPE TEXT`;
            console.log('✅ Colonne age convertie en TEXT');
        }

        // 3. Vérifier si la colonne distance existe
        const distanceInfo = await sql`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'medical_records' 
            AND column_name = 'distance'
        `;

        if (distanceInfo.length === 0) {
            console.log('🔧 Ajout de la colonne distance...');
            await sql`ALTER TABLE medical_records ADD COLUMN distance TEXT DEFAULT 'non précisé'`;
            console.log('✅ Colonne distance ajoutée');
        }

        // 4. Récupérer tous les enregistrements avec date de naissance
        const records = await sql`
            SELECT id, dob, age 
            FROM medical_records 
            WHERE dob IS NOT NULL AND dob != ''
            ORDER BY id
        `;

        console.log(`\n📝 ${records.length} enregistrements trouvés avec date de naissance\n`);

        if (records.length === 0) {
            console.log('ℹ️  Aucun enregistrement à migrer');
            return;
        }

        // 5. Mettre à jour chaque enregistrement
        let updated = 0;
        let errors = 0;

        for (const record of records) {
            try {
                const newAge = calculateAge(record.dob);

                if (newAge && newAge !== record.age) {
                    await sql`
                        UPDATE medical_records 
                        SET age = ${newAge}
                        WHERE id = ${record.id}
                    `;

                    console.log(`✓ ID ${record.id}: "${record.age}" → "${newAge}"`);
                    updated++;
                } else {
                    console.log(`⊘ ID ${record.id}: Déjà à jour (${record.age})`);
                }
            } catch (error) {
                console.error(`✗ Erreur pour ID ${record.id}:`, error);
                errors++;
            }
        }

        console.log('\n' + '='.repeat(60));
        console.log(`✅ Migration terminée !`);
        console.log(`   - ${updated} enregistrements mis à jour`);
        console.log(`   - ${records.length - updated - errors} déjà à jour`);
        if (errors > 0) {
            console.log(`   - ${errors} erreurs`);
        }
        console.log('='.repeat(60));

    } catch (error) {
        console.error('❌ Erreur lors de la migration:', error);
        throw error;
    }
}

// Exécuter la migration si le script est appelé directement
if (require.main === module) {
    migrateAges()
        .then(() => {
            console.log('\n✨ Migration complétée avec succès !');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n💥 Échec de la migration:', error);
            process.exit(1);
        });
}

export { migrateAges };
