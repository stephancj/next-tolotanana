/**
 * Script pour recalculer tous les âges dans Neon à partir des dates de naissance
 * Convertit les âges numériques en format string avec unités (semaines, mois, ans)
 */

import { neon } from '@neondatabase/serverless';
import { calculateAge } from '../lib/age-utils';

async function recalculateAges() {
    const sql = neon(process.env.DATABASE_URL!);

    console.log('🔄 Début du recalcul des âges...\n');

    try {
        // Récupérer tous les enregistrements avec date de naissance
        const records = await sql`
            SELECT id, dob, age 
            FROM medical_records 
            WHERE dob IS NOT NULL AND dob != ''
            ORDER BY id
        `;

        console.log(`📝 ${records.length} enregistrements trouvés avec date de naissance\n`);

        if (records.length === 0) {
            console.log('ℹ️  Aucun enregistrement à recalculer');
            return;
        }

        let updated = 0;
        let errors = 0;
        let skipped = 0;

        for (const record of records) {
            try {
                const newAge = calculateAge(record.dob);

                if (!newAge) {
                    console.log(`⊘ ID ${record.id}: Date de naissance invalide`);
                    skipped++;
                    continue;
                }

                // Vérifier si l'âge a changé
                const currentAge = String(record.age || '');
                if (newAge !== currentAge) {
                    await sql`
                        UPDATE medical_records 
                        SET age = ${newAge}
                        WHERE id = ${record.id}
                    `;

                    console.log(`✓ ID ${record.id}: "${currentAge}" → "${newAge}"`);
                    updated++;
                } else {
                    console.log(`⊘ ID ${record.id}: Déjà à jour (${currentAge})`);
                    skipped++;
                }
            } catch (error) {
                console.error(`✗ Erreur pour ID ${record.id}:`, error);
                errors++;
            }
        }

        console.log('\n' + '='.repeat(60));
        console.log(`✅ Recalcul terminé !`);
        console.log(`   - ${updated} enregistrements mis à jour`);
        console.log(`   - ${skipped} déjà à jour ou ignorés`);
        if (errors > 0) {
            console.log(`   - ${errors} erreurs`);
        }
        console.log('='.repeat(60));

    } catch (error) {
        console.error('❌ Erreur lors du recalcul:', error);
        throw error;
    }
}

// Exécuter le recalcul si le script est appelé directement
if (require.main === module) {
    recalculateAges()
        .then(() => {
            console.log('\n✨ Recalcul complété avec succès !');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n💥 Échec du recalcul:', error);
            process.exit(1);
        });
}

export { recalculateAges };
