import { NextResponse } from 'next/server';
import { db } from '@/lib/neon-db';
import { medicalRecords, surgeons, recordSurgeons, medicalAuditLog, syncMutations, syncEntityVersions } from '@/lib/schema';
import { and, eq, inArray } from 'drizzle-orm';
import { validUuid } from '@/lib/medical-audit';

export const dynamic = 'force-dynamic';
const ENTITY = 'record_surgeons';

export async function POST(req: Request) {
    try {
        const { updates } = await req.json();
        if (!Array.isArray(updates) || !updates.length) return NextResponse.json({ processed: [], conflicts: [], errors: [] });
        const processed: Array<{ public_id: string; mutation_id: string; revision: number }> = [];
        const conflicts: Array<{ public_id: string; mutation_id: string; revision: number; server: string[] }> = [];
        const errors: Array<{ id: string; error: string }> = [];

        for (const update of updates.slice(0, 100)) {
            try {
                const mutationId = validUuid(update.mutation_id);
                if (!validUuid(update.record_public_id) || !mutationId) throw new Error('Invalid IDs');
                const result = await db.transaction(async tx => {
                    const receipt = await tx.select().from(syncMutations).where(eq(syncMutations.mutation_id, mutationId)).limit(1);
                    if (receipt.length) return { kind: 'ok' as const, revision: receipt[0].revision };
                    const record = await tx.select({ id: medicalRecords.id }).from(medicalRecords)
                        .where(eq(medicalRecords.public_id, update.record_public_id)).limit(1);
                    if (!record.length) throw new Error('Record not found');
                    const version = await tx.select().from(syncEntityVersions).where(and(
                        eq(syncEntityVersions.entity, ENTITY), eq(syncEntityVersions.public_id, update.record_public_id)
                    )).limit(1);
                    const currentRevision = version[0]?.revision || 0;
                    const previous = await tx.select({ public_id: surgeons.public_id }).from(recordSurgeons)
                        .innerJoin(surgeons, eq(recordSurgeons.surgeon_id, surgeons.id))
                        .where(eq(recordSurgeons.medical_record_id, record[0].id));
                    const beforeIds = previous.map(x => x.public_id).sort();
                    if (Number(update.revision || 0) !== currentRevision) {
                        return { kind: 'conflict' as const, revision: currentRevision, server: beforeIds };
                    }
                    const requestedIds: string[] = Array.isArray(update.surgeon_public_ids) ? update.surgeon_public_ids : [];
                    const rows = requestedIds.length ? await tx.select({ id: surgeons.id }).from(surgeons)
                        .where(inArray(surgeons.public_id, requestedIds)) : [];
                    await tx.delete(recordSurgeons).where(eq(recordSurgeons.medical_record_id, record[0].id));
                    if (rows.length) await tx.insert(recordSurgeons).values(rows.map(s => ({
                        medical_record_id: record[0].id, surgeon_id: s.id
                    })));
                    const revision = currentRevision + 1;
                    await tx.insert(syncEntityVersions).values({ entity: ENTITY, public_id: update.record_public_id, revision })
                        .onConflictDoUpdate({ target: [syncEntityVersions.entity, syncEntityVersions.public_id], set: { revision, updated_at: new Date() } });
                    await tx.insert(medicalAuditLog).values({
                        medical_record_public_id: update.record_public_id, mutation_id: mutationId,
                        action: 'relation_update', source: 'sync', device_id: validUuid(update.device_id),
                        changed_fields: { surgeons: { before: beforeIds, after: requestedIds.sort() } },
                        before_data: { surgeon_public_ids: beforeIds }, after_data: { surgeon_public_ids: requestedIds.sort() },
                        occurred_at: update.occurred_at ? new Date(update.occurred_at) : null
                    });
                    await tx.insert(syncMutations).values({ mutation_id: mutationId, entity: ENTITY, public_id: update.record_public_id, revision });
                    return { kind: 'ok' as const, revision };
                });
                if (result.kind === 'conflict') conflicts.push({ public_id: update.record_public_id, mutation_id: update.mutation_id, revision: result.revision, server: result.server });
                else processed.push({ public_id: update.record_public_id, mutation_id: update.mutation_id, revision: result.revision });
            } catch (error) { errors.push({ id: update.record_public_id || 'unknown', error: String(error) }); }
        }
        return NextResponse.json({ processed, conflicts, errors });
    } catch (error) {
        console.error(error); return NextResponse.json({ error: 'Record-surgeon sync failed' }, { status: 500 });
    }
}

export async function GET() {
    try {
        const records = await db.select({ public_id: medicalRecords.public_id }).from(medicalRecords);
        const links = await db.select({ record_public_id: medicalRecords.public_id, surgeon_public_id: surgeons.public_id })
            .from(recordSurgeons).innerJoin(medicalRecords, eq(recordSurgeons.medical_record_id, medicalRecords.id))
            .innerJoin(surgeons, eq(recordSurgeons.surgeon_id, surgeons.id));
        const versions = await db.select().from(syncEntityVersions).where(eq(syncEntityVersions.entity, ENTITY));
        return NextResponse.json(records.map(record => ({
            record_public_id: record.public_id,
            surgeon_public_ids: links.filter(x => x.record_public_id === record.public_id).map(x => x.surgeon_public_id),
            revision: versions.find(x => x.public_id === record.public_id)?.revision || 0
        })));
    } catch (error) {
        console.error(error); return NextResponse.json({ error: 'Record-surgeon pull failed' }, { status: 500 });
    }
}
