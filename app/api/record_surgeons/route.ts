import { NextResponse } from 'next/server';
import { db } from '@/lib/neon-db';
import { medicalAuditLog, medicalRecords, recordSurgeons, surgeons } from '@/lib/schema';
import { eq, inArray } from 'drizzle-orm';
import { validUuid } from '@/lib/medical-audit';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { medical_record_id, surgeon_ids, mutation_id, device_id, user_id } = body;
        if (!medical_record_id || !Array.isArray(surgeon_ids)) {
            return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
        }

        const record = await db.select({ public_id: medicalRecords.public_id }).from(medicalRecords)
            .where(eq(medicalRecords.id, medical_record_id)).limit(1);
        if (!record.length) return NextResponse.json({ error: 'Record not found' }, { status: 404 });

        await db.transaction(async tx => {
            const previous = await tx.select({ public_id: surgeons.public_id }).from(recordSurgeons)
                .innerJoin(surgeons, eq(recordSurgeons.surgeon_id, surgeons.id))
                .where(eq(recordSurgeons.medical_record_id, medical_record_id));
            const requested = surgeon_ids.length
                ? await tx.select({ public_id: surgeons.public_id }).from(surgeons)
                    .where(inArray(surgeons.id, surgeon_ids))
                : [];
            const beforeIds = previous.map(x => x.public_id).sort();
            const afterIds = requested.map(x => x.public_id).sort();

            await tx.delete(recordSurgeons).where(eq(recordSurgeons.medical_record_id, medical_record_id));
            if (surgeon_ids.length) await tx.insert(recordSurgeons).values(
                surgeon_ids.map((surgeon_id: number) => ({ medical_record_id, surgeon_id }))
            );
            await tx.insert(medicalAuditLog).values({
                medical_record_public_id: record[0].public_id,
                mutation_id: validUuid(mutation_id), action: 'relation_update', source: 'api',
                device_id: validUuid(device_id), user_id: typeof user_id === 'string' ? user_id : null,
                changed_fields: { surgeons: { before: beforeIds, after: afterIds } },
                before_data: { surgeon_public_ids: beforeIds },
                after_data: { surgeon_public_ids: afterIds },
                occurred_at: new Date()
            });
        });
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error assigning surgeons:', error);
        return NextResponse.json({ error: 'Failed to assign surgeons' }, { status: 500 });
    }
}
