import { NextResponse } from 'next/server';
import { db } from '@/lib/neon-db';
import { medicalRecords } from '@/lib/schema';
import { eq, inArray, gt, desc } from 'drizzle-orm';

// PUSH: Client sends changes to server
export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { changes } = body; // Array of changed records

        if (!changes || !Array.isArray(changes) || changes.length === 0) {
            return NextResponse.json({ processed: 0 });
        }

        const processedIds: string[] = [];
        const errors: any[] = [];

        // Process sequentially to avoid race conditions roughly
        for (const record of changes) {
            try {
                // Upsert logic:
                // We trust the client's public_id.
                // If it exists, we update. If not, we insert.
                // We handle Drizzle upsert with ON CONFLICT DO UPDATE

                // Ensure deleted is boolean for Postgres (Dexie uses multitype, Schema uses boolean)
                const recordToSave = {
                    ...record,
                    deleted: record.deleted === 1, // Convert number to boolean
                    sync_status: undefined // Remove client-only field
                };

                // Remove 'id' if it exists, let Postgres handle its own primary key
                delete recordToSave.id;

                // Explicitly cast date strings to Date objects for Drizzle if needed, though ISO strings usually work.
                // But let's be safe and clean the object to strictly match schema to avoid "unknown column" errors.

                // sanitized object
                const cleanRecord: any = {
                    public_id: record.public_id,
                    dossier_number: record.dossier_number,
                    last_name: record.last_name,
                    first_name: record.first_name,
                    dob: record.dob,
                    age: record.age,
                    gender: record.gender,
                    phone1: record.phone1,
                    phone2: record.phone2,
                    address: record.address,
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
                    program_mission: record.program_mission,
                    history_diabetes: record.history_diabetes,
                    history_hypertension: record.history_hypertension,
                    history_asthma: record.history_asthma,
                    history_cardiopathy: record.history_cardiopathy,
                    history_none: record.history_none,
                    history_others: record.history_others,
                    asa_score: record.asa_score,
                    anesthesia_type: record.anesthesia_type,
                    anesthesia_observation: record.anesthesia_observation,
                    created_at: record.created_at ? new Date(record.created_at) : new Date(),
                    updated_at: new Date(), // Always update timestamp on sync
                    deleted: record.deleted === 1
                };

                await db.insert(medicalRecords)
                    .values(cleanRecord)
                    .onConflictDoUpdate({
                        target: medicalRecords.public_id,
                        set: cleanRecord
                    });

                processedIds.push(record.public_id);
                console.log(`Synced record ${record.public_id}`);
            } catch (err) {
                console.error("Error processing record details:", JSON.stringify(record), err);
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
