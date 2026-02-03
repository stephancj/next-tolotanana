
import { NextResponse } from 'next/server';
import { db } from '@/lib/neon-db';
import { medicalRecords, surgeons, recordSurgeons } from '@/lib/schema';
import { eq, inArray } from 'drizzle-orm';

// PUSH: Client sends updates for record-surgeon links
export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { updates } = body; // Array of { record_public_id, surgeon_public_ids: string[] }

        if (!updates || !Array.isArray(updates) || updates.length === 0) {
            return NextResponse.json({ success: true, processed: [] });
        }

        const processedIds: string[] = [];
        const errors: any[] = [];

        for (const update of updates) {
            try {
                const { record_public_id, surgeon_public_ids } = update;

                if (!record_public_id) continue;

                // 1. Get Medical Record ID
                const record = await db.select({ id: medicalRecords.id })
                    .from(medicalRecords)
                    .where(eq(medicalRecords.public_id, record_public_id))
                    .limit(1);

                if (record.length === 0) {
                    errors.push({ id: record_public_id, error: 'Record not found' });
                    continue;
                }
                const recordId = record[0].id;

                // 2. Resolve Surgeon IDs
                let surgeonIds: number[] = [];
                if (surgeon_public_ids && surgeon_public_ids.length > 0) {
                    const surgeonRecords = await db.select({ id: surgeons.id })
                        .from(surgeons)
                        .where(inArray(surgeons.public_id, surgeon_public_ids));
                    surgeonIds = surgeonRecords.map(s => s.id);
                }

                // 3. Update Links (Delete existing for this record, Insert new)
                await db.transaction(async (tx) => {
                    await tx.delete(recordSurgeons)
                        .where(eq(recordSurgeons.medical_record_id, recordId));

                    if (surgeonIds.length > 0) {
                        await tx.insert(recordSurgeons)
                            .values(surgeonIds.map(sId => ({
                                medical_record_id: recordId,
                                surgeon_id: sId
                            })));
                    }
                });

                processedIds.push(record_public_id);
            } catch (err) {
                console.error(`Error processing record-surgeon link for ${update.record_public_id}:`, err);
                errors.push({ id: update.record_public_id, error: String(err) });
            }
        }

        return NextResponse.json({ success: true, processed: processedIds, errors });

    } catch (error) {
        console.error('Push record-surgeons error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// PULL: Get all record-surgeon links
export async function GET(req: Request) {
    try {
        // Fetch all links, join with public_ids
        const links = await db.select({
            record_public_id: medicalRecords.public_id,
            surgeon_public_id: surgeons.public_id
        })
            .from(recordSurgeons)
            .innerJoin(medicalRecords, eq(recordSurgeons.medical_record_id, medicalRecords.id))
            .innerJoin(surgeons, eq(recordSurgeons.surgeon_id, surgeons.id));

        // Group by record_public_id
        const grouped: Record<string, string[]> = {};
        links.forEach(link => {
            if (!grouped[link.record_public_id]) {
                grouped[link.record_public_id] = [];
            }
            grouped[link.record_public_id].push(link.surgeon_public_id);
        });

        // Convert to array format
        const result = Object.entries(grouped).map(([record_public_id, surgeon_public_ids]) => ({
            record_public_id,
            surgeon_public_ids
        }));

        return NextResponse.json(result);
    } catch (error) {
        console.error('Pull record-surgeons error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
