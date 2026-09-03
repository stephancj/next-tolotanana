
import { NextResponse } from 'next/server';
import { db } from '@/lib/neon-db';
import { medicalRecords, editions, medicalAuditLog, syncChanges } from '@/lib/schema';
import { desc, eq, inArray, sql } from 'drizzle-orm';
import { auditAction, auditSnapshot, changedFields, validUuid } from '@/lib/medical-audit';

export async function GET() {
    try {
        const records = await db.select({ record: medicalRecords, edition_public_id: editions.public_id })
            .from(medicalRecords).leftJoin(editions, eq(medicalRecords.edition_id, editions.id))
            .orderBy(desc(medicalRecords.created_at));
        return NextResponse.json(records.map(r => ({ ...r.record, edition_public_id: r.edition_public_id })));
    } catch (error) {
        console.error('Error fetching records:', error);
        return NextResponse.json({ error: 'Failed to fetch records' }, { status: 500 });
    }
}

export async function PATCH(req: Request) {
    try {
        const body = await req.json();
        const { id, ids, device_id, user_id, mutation_id, ...updates } = body;

        if (!id && (!ids || !Array.isArray(ids) || ids.length === 0)) {
            return NextResponse.json({ error: 'Record ID(s) required' }, { status: 400 });
        }

        // --- SANITIZAITON ---
        const sanitizedUpdates: Record<string, string | number | boolean | Date | null> = { ...updates };
        const dateFields = ['pre_op_call_at', 'pre_op_checked_at'];

        // 1. Sanitize Date Fields
        dateFields.forEach(field => {
            if (field in updates) {
                const val = updates[field];
                sanitizedUpdates[field] = val ? new Date(val) : null;
            }
        });

        // 2. Sanitize Booleans (just in case they come as numbers/strings)
        if ('pre_op_checked' in updates) {
            sanitizedUpdates.pre_op_checked = Boolean(updates.pre_op_checked);
        }

        // Every direct server write also increments the revision and enters the pull stream.
        sanitizedUpdates.updated_at = new Date();
        sanitizedUpdates.revision = sql`${medicalRecords.revision} + 1` as unknown as number;

        const result = await db.transaction(async tx => {
            const beforeRows = ids && Array.isArray(ids) && ids.length > 0
                ? await tx.select().from(medicalRecords).where(inArray(medicalRecords.id, ids))
                : await tx.select().from(medicalRecords).where(eq(medicalRecords.id, id));
            const updated = ids && Array.isArray(ids) && ids.length > 0
                ? await tx.update(medicalRecords).set(sanitizedUpdates).where(inArray(medicalRecords.id, ids)).returning()
                : await tx.update(medicalRecords).set(sanitizedUpdates).where(eq(medicalRecords.id, id)).returning();
            if (updated.length) {
                await tx.insert(syncChanges).values(updated.map(record => ({
                    entity: 'medical_record', public_id: record.public_id,
                    revision: record.revision, payload: record
                })));
                await tx.insert(medicalAuditLog).values(updated.map(record => {
                    const before = auditSnapshot(beforeRows.find(row => row.public_id === record.public_id));
                    const after = auditSnapshot(record)!;
                    return {
                        medical_record_public_id: record.public_id,
                        mutation_id: validUuid(mutation_id),
                        action: auditAction(before, after), source: 'api',
                        device_id: validUuid(device_id),
                        user_id: typeof user_id === 'string' ? user_id : null,
                        changed_fields: changedFields(before, after),
                        before_data: before, after_data: after,
                        occurred_at: new Date()
                    };
                }));
            }
            return updated;
        });

        return NextResponse.json({ success: true, count: result.length, records: result });

    } catch (error) {
        console.error('Error updating record:', error);
        return NextResponse.json({ error: 'Failed to update record' }, { status: 500 });
    }
}
