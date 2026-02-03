import { NextResponse } from 'next/server';
import { db } from '@/lib/neon-db';
import { medicalRecords, editions } from '@/lib/schema';
import { eq, gt, desc } from 'drizzle-orm';

// PUSH: Client sends changes to server
export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { changes } = body; // Array of changed records

        if (!changes || !Array.isArray(changes) || changes.length === 0) {
            return NextResponse.json({ processed: [], errors: [] });
        }

        const processedIds: string[] = [];
        const errors: Array<{ id: string; error: string }> = [];

        // Process sequentially to avoid race conditions
        for (const record of changes) {
            try {
                if (!record.public_id) {
                    errors.push({ id: 'unknown', error: 'Missing public_id' });
                    continue;
                }

                // Helper to safely convert to integer boolean (0/1) for Postgres Integer columns
                const toInt = (val: unknown) => (val === true || val === 1 || val === '1' || val === 'true') ? 1 : 0;

                // Helper to safely convert to boolean for Postgres Boolean columns
                const toBool = (val: unknown) => (val === true || val === 1 || val === '1' || val === 'true');

                // Resolve Edition ID from public_id if provided (Client sends edition_public_id)
                let mappedEditionId = null;
                if (record.edition_public_id) {
                    const edResult = await db.select({ id: editions.id })
                        .from(editions)
                        .where(eq(editions.public_id, record.edition_public_id))
                        .limit(1);

                    if (edResult.length > 0) {
                        mappedEditionId = edResult[0].id;
                    }
                }

                // sanitized object
                const cleanRecord = {
                    public_id: record.public_id,
                    edition_id: mappedEditionId,
                    dossier_number: record.dossier_number,
                    last_name: record.last_name,
                    first_name: record.first_name,
                    dob: record.dob,
                    age: record.age,
                    gender: record.gender,
                    phone1: record.phone1,
                    phone2: record.phone2,
                    address: record.address,
                    distance: record.distance || 'non précisé',
                    photo_url: record.photo_url,
                    weight: record.weight,
                    height: record.height,
                    bmi: record.bmi,
                    blood_pressure: record.blood_pressure,
                    temperature: record.temperature,
                    heart_rate: record.heart_rate,
                    respiratory_rate: record.respiratory_rate,
                    spo2: record.spo2,
                    clinical_diagnosis: record.clinical_diagnosis,
                    intervention_type: record.intervention_type,
                    observation: record.observation,

                    // Explicitly cast to integer 0/1 for schema compatibility
                    program_mission: toInt(record.program_mission),
                    planning_day: record.planning_day,
                    history_diabetes: toInt(record.history_diabetes),
                    history_hypertension: toInt(record.history_hypertension),
                    history_asthma: toInt(record.history_asthma),
                    history_cardiopathy: toInt(record.history_cardiopathy),
                    history_none: toInt(record.history_none),

                    history_others: record.history_others,
                    asa_score: record.asa_score,
                    anesthesia_type: record.anesthesia_type,
                    anesthesia_observation: record.anesthesia_observation,

                    // Pre-Op Check
                    pre_op_checked: toBool(record.pre_op_checked),
                    pre_op_checked_at: record.pre_op_checked_at ? new Date(record.pre_op_checked_at) : null,

                    // Operation Details
                    block_entry_time: record.block_entry_time,
                    block_exit_time: record.block_exit_time,
                    intervention_details: record.intervention_details,
                    diagnosis_category: record.diagnosis_category,

                    created_at: record.created_at ? new Date(record.created_at) : new Date(),
                    updated_at: new Date(), // Always update timestamp on sync
                    deleted: toBool(record.deleted)
                };

                // Insert/Update
                await db.insert(medicalRecords)
                    .values(cleanRecord)
                    .onConflictDoUpdate({
                        target: medicalRecords.public_id,
                        set: cleanRecord
                    });

                // VERIFICATION: Confirm the record actually exists in Neon
                const verification = await db.select()
                    .from(medicalRecords)
                    .where(eq(medicalRecords.public_id, record.public_id))
                    .limit(1);

                if (verification.length > 0) {
                    processedIds.push(record.public_id);
                    console.log(`✓ Verified sync: ${record.public_id}`);
                } else {
                    console.error(`✗ Failed to verify: ${record.public_id}`);
                    errors.push({ id: record.public_id, error: 'Record not found after insert' });
                }

            } catch (err) {
                console.error("Error processing record:", record.public_id, err);
                errors.push({ id: record.public_id, error: String(err) });
            }
        }

        return NextResponse.json({
            success: true,
            processed: processedIds,
            errors
        });

    } catch (error) {
        console.error('Push error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// PULL: Client requests changes since a timestamp
export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const lastPulledAt = searchParams.get('since'); // ISO string

        let query = db.select().from(medicalRecords).orderBy(desc(medicalRecords.updated_at));

        if (lastPulledAt) {
            // @ts-expect-error - timestamp comparison works but types can be finicky
            query = query.where(gt(medicalRecords.updated_at, new Date(lastPulledAt)));
        }

        const results = await query;

        // Convert back to Dexie friendly format
        const cleanResults = results.map(r => ({
            ...r,
            deleted: r.deleted ? 1 : 0, // Convert boolean to number
            sync_status: 'synced' // Mark as synced for the client receiving it
        }));

        return NextResponse.json({
            changes: cleanResults,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Pull error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
