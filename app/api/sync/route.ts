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

                await db.insert(medicalRecords)
                    .values(recordToSave)
                    .onConflictDoUpdate({
                        target: medicalRecords.public_id,
                        set: recordToSave
                    });

                processedIds.push(record.public_id);
            } catch (err) {
                console.error("Error processing record", record.public_id, err);
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
