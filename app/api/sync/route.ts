import { NextResponse } from 'next/server';
import { db } from '@/lib/neon-db';
import { medicalRecords, editions, medicalAuditLog, syncChanges, syncDevices, syncMutations } from '@/lib/schema';
import { asc, eq, gt, sql } from 'drizzle-orm';
import { auditAction, auditSnapshot, changedFields, validUuid } from '@/lib/medical-audit';

export const dynamic = 'force-dynamic';
const MAX_BATCH = 100;
const toInt = (v: unknown) => (v === true || v === 1 || v === '1' || v === 'true') ? 1 : 0;
const toBool = (v: unknown) => v === true || v === 1 || v === '1' || v === 'true';

// The wire object is normalized field-by-field below before it reaches Drizzle.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function cleanPayload(record: Record<string, any>, editionId: number | null, revision: number) {
    return {
        public_id: record.public_id,
        edition_id: editionId,
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
        pre_op_checked: toBool(record.pre_op_checked),
        pre_op_checked_at: record.pre_op_checked_at ? new Date(record.pre_op_checked_at) : null,
        pre_op_call: toInt(record.pre_op_call),
        pre_op_call_at: record.pre_op_call_at ? new Date(record.pre_op_call_at) : null,
        prescription_details: record.prescription_details,
        pharmacy_status: record.pharmacy_status,
        post_op_room: record.post_op_room,
        post_op_bed: record.post_op_bed,
        post_op_entry_time: record.post_op_entry_time,
        discharge_time: record.discharge_time,
        discharge_notes: record.discharge_notes,
        block_entry_time: record.block_entry_time,
        block_exit_time: record.block_exit_time,
        intervention_details: record.intervention_details,
        diagnosis_category: record.diagnosis_category,
        created_at: record.created_at ? new Date(record.created_at) : new Date(),
        updated_at: new Date(),
        deleted: toBool(record.deleted),
        revision
    };
}

// Idempotent optimistic-concurrency push.
export async function POST(req: Request) {
    try {
        const { changes } = await req.json();
        if (!Array.isArray(changes) || changes.length === 0) {
            return NextResponse.json({ processed: [], conflicts: [], errors: [] });
        }
        if (changes.length > MAX_BATCH) {
            return NextResponse.json({ error: `Maximum ${MAX_BATCH} changes per batch` }, { status: 413 });
        }

        const processed: Array<{ public_id: string; mutation_id: string; revision: number }> = [];
        const conflicts: Array<{ public_id: string; mutation_id: string; server: unknown }> = [];
        const errors: Array<{ id: string; error: string }> = [];

        for (const record of changes) {
            try {
                if (!record.public_id || !record.mutation_id) throw new Error('Missing public_id or mutation_id');

                const result = await db.transaction(async tx => {
                    const receipt = await tx.select().from(syncMutations)
                        .where(eq(syncMutations.mutation_id, record.mutation_id)).limit(1);
                    if (receipt.length) return { kind: 'processed' as const, revision: receipt[0].revision };

                    const current = await tx.select().from(medicalRecords)
                        .where(eq(medicalRecords.public_id, record.public_id)).limit(1);
                    const currentRevision = current[0]?.revision || 0;
                    const baseRevision = Number(record.revision || 0);
                    if (current.length && baseRevision !== currentRevision) {
                        return { kind: 'conflict' as const, server: current[0] };
                    }

                    let editionId: number | null = null;
                    if (record.edition_public_id) {
                        const edition = await tx.select({ id: editions.id }).from(editions)
                            .where(eq(editions.public_id, record.edition_public_id)).limit(1);
                        if (!edition.length) throw new Error('Unknown edition_public_id');
                        editionId = edition[0].id;
                    }

                    const revision = currentRevision + 1;
                    const payload = cleanPayload(record, editionId, revision);
                    const [saved] = await tx.insert(medicalRecords).values(payload)
                        .onConflictDoUpdate({ target: medicalRecords.public_id, set: payload })
                        .returning();
                    const before = auditSnapshot(current[0]);
                    const after = auditSnapshot(saved)!;
                    await tx.insert(medicalAuditLog).values({
                        medical_record_public_id: saved.public_id,
                        mutation_id: record.mutation_id,
                        action: auditAction(before, after),
                        source: 'sync',
                        device_id: validUuid(record.device_id),
                        user_id: typeof record.user_id === 'string' ? record.user_id : null,
                        changed_fields: changedFields(before, after),
                        before_data: before,
                        after_data: after,
                        occurred_at: record.updated_at ? new Date(record.updated_at) : null
                    });
                    await tx.insert(syncChanges).values({
                        entity: 'medical_record', public_id: saved.public_id,
                        revision, payload: saved
                    });
                    await tx.insert(syncMutations).values({
                        mutation_id: record.mutation_id, entity: 'medical_record',
                        public_id: saved.public_id, revision
                    });
                    return { kind: 'processed' as const, revision };
                });

                if (result.kind === 'conflict') {
                    conflicts.push({ public_id: record.public_id, mutation_id: record.mutation_id, server: result.server });
                } else {
                    processed.push({ public_id: record.public_id, mutation_id: record.mutation_id, revision: result.revision });
                }
            } catch (error) {
                errors.push({ id: record.public_id || 'unknown', error: String(error) });
            }
        }
        return NextResponse.json({ success: errors.length === 0, processed, conflicts, errors });
    } catch (error) {
        console.error('Push error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// Monotonic pull. First pull returns a full snapshot; subsequent pulls use change IDs.
export async function GET(req: Request) {
    try {
        const searchParams = new URL(req.url).searchParams;
        const cursorParam = searchParams.get('cursor');
        const deviceId = validUuid(searchParams.get('device_id'));
        const cursor = Math.max(0, Number(cursorParam || 0));
        const limit = 200;
        const editionRows = await db.select({ id: editions.id, public_id: editions.public_id }).from(editions);
        const editionPublicIds = new Map(editionRows.map(e => [e.id, e.public_id]));
        const enrich = (value: Record<string, unknown>) => ({
            ...value,
            edition_public_id: typeof value.edition_id === 'number'
                ? editionPublicIds.get(value.edition_id) : undefined
        });

        if (cursor === 0) {
            // Read the watermark first: writes after it are either already in the snapshot
            // or will be returned by the next incremental pull, so none can be skipped.
            const maxRow = await db.select({ max: sql<number>`coalesce(max(${syncChanges.id}), 0)` }).from(syncChanges);
            const records = await db.select().from(medicalRecords);
            const nextCursor = Number(maxRow[0]?.max || 0);
            if (deviceId) await db.insert(syncDevices).values({ device_id: deviceId, last_cursor: nextCursor })
                .onConflictDoUpdate({ target: syncDevices.device_id, set: { last_cursor: nextCursor, last_seen_at: new Date(), last_error: null } });
            return NextResponse.json({
                changes: records.map(payload => ({ entity: 'medical_record', payload: enrich(payload) })),
                cursor: nextCursor,
                has_more: false
            });
        }

        const rows = await db.select().from(syncChanges)
            .where(gt(syncChanges.id, cursor)).orderBy(asc(syncChanges.id)).limit(limit);
        const nextCursor = rows.length ? rows[rows.length - 1].id : cursor;
        if (deviceId) await db.insert(syncDevices).values({ device_id: deviceId, last_cursor: nextCursor })
            .onConflictDoUpdate({ target: syncDevices.device_id, set: { last_cursor: nextCursor, last_seen_at: new Date(), last_error: null } });
        return NextResponse.json({
            changes: rows.map(r => ({ entity: r.entity, payload: enrich(r.payload as Record<string, unknown>) })),
            cursor: nextCursor,
            has_more: rows.length === limit
        });
    } catch (error) {
        console.error('Pull error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
