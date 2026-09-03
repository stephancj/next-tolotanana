import { db, type MedicalRecord, type Surgeon } from '@/lib/client-db';

const now = () => new Date().toISOString();
const scheduleBackgroundSync = () => {
    if (typeof navigator === 'undefined' || !navigator.serviceWorker) return;
    void navigator.serviceWorker.ready.then(registration => {
        const withSync = registration as ServiceWorkerRegistration & { sync?: { register(tag: string): Promise<void> } };
        return withSync.sync?.register('tolotanana-sync');
    }).catch(() => undefined);
};

/** All local medical-record writes go through these helpers so sync metadata cannot be lost. */
export async function saveMedicalRecord(
    values: Partial<MedicalRecord>,
    existingId?: number
): Promise<number> {
    const timestamp = now();
    const mutationId = crypto.randomUUID();

    if (existingId) {
        const existing = await db.medical_records.get(existingId);
        if (!existing) throw new Error(`Medical record ${existingId} not found`);

        await db.medical_records.update(existingId, {
            ...values,
            public_id: existing.public_id || crypto.randomUUID(),
            created_at: existing.created_at || timestamp,
            deleted: values.deleted ?? existing.deleted ?? 0,
            revision: existing.revision || 0,
            updated_at: timestamp,
            sync_status: values.deleted === 1 ? 'pending_delete' : 'pending_update',
            pending_mutation_id: mutationId,
            sync_error: undefined
        });
        scheduleBackgroundSync();
        return existingId;
    }

    const id = await db.medical_records.add({
        ...values,
        public_id: values.public_id || crypto.randomUUID(),
        created_at: values.created_at || timestamp,
        updated_at: timestamp,
        deleted: values.deleted ?? 0,
        revision: values.revision || 0,
        sync_status: values.deleted === 1 ? 'pending_delete' : 'pending_update',
        pending_mutation_id: mutationId
    } as MedicalRecord) as number;
    scheduleBackgroundSync();
    return id;
}

export async function updateMedicalRecord(id: number, values: Partial<MedicalRecord>) {
    return saveMedicalRecord(values, id);
}

export async function softDeleteMedicalRecord(id: number) {
    return saveMedicalRecord({ deleted: 1 }, id);
}

/** Replace the local relation set and persist an explicit outbox entry, including an empty set. */
export async function replaceRecordSurgeons(recordId: number, surgeonIds: number[]) {
    const record = await db.medical_records.get(recordId);
    if (!record?.public_id) throw new Error('Record has no public_id');

    const surgeons = await db.surgeons.bulkGet(surgeonIds);
    const surgeonPublicIds = surgeons.flatMap(s => s?.public_id ? [s.public_id] : []);

    await db.transaction('rw', db.record_surgeons, db.relation_changes, async () => {
        await db.record_surgeons.where('medical_record_id').equals(recordId).delete();
        if (surgeonIds.length) {
            await db.record_surgeons.bulkAdd(surgeonIds.map(surgeon_id => ({
                medical_record_id: recordId,
                surgeon_id,
                sync_status: 'pending_update' as const
            })));
        }
        const revision = Number((await db.sync_meta.get(`record_surgeons:${record.public_id}`))?.value || 0);
        await db.relation_changes.put({
            record_public_id: record.public_id!,
            surgeon_public_ids: surgeonPublicIds,
            mutation_id: crypto.randomUUID(),
            revision,
            updated_at: now()
        });
    });
    scheduleBackgroundSync();
}

export async function saveSurgeon(values: Partial<Surgeon>, existingId?: number) {
    const timestamp = now();
    if (existingId) {
        const existing = await db.surgeons.get(existingId);
        if (!existing) throw new Error('Surgeon not found');
        await db.surgeons.update(existingId, {
            ...values,
            public_id: existing.public_id,
            created_at: existing.created_at,
            updated_at: timestamp,
            revision: existing.revision || 0,
            sync_status: values.deleted === 1 ? 'pending_delete' : 'pending_update',
            pending_mutation_id: crypto.randomUUID(), sync_error: undefined
        });
        scheduleBackgroundSync();
        return existingId;
    }
    const id = await db.surgeons.add({
        ...values, public_id: values.public_id || crypto.randomUUID(),
        name: values.name || 'N/A', is_active: values.is_active ?? 1,
        deleted: values.deleted ?? 0, created_at: timestamp, updated_at: timestamp,
        revision: 0, sync_status: 'pending_update', pending_mutation_id: crypto.randomUUID()
    } as Surgeon);
    scheduleBackgroundSync();
    return id;
}

export async function replaceEditionSurgeons(editionId: number, surgeonIds: number[]) {
    const edition = await db.editions.get(editionId);
    if (!edition?.public_id) throw new Error('Edition not found');
    const surgeons = await db.surgeons.bulkGet(surgeonIds);
    const publicIds = surgeons.flatMap(s => s?.public_id ? [s.public_id] : []);
    const revision = Number((await db.sync_meta.get(`edition_surgeons:${edition.public_id}`))?.value || 0);
    await db.transaction('rw', db.edition_surgeons, db.edition_relation_changes, async () => {
        await db.edition_surgeons.where('edition_id').equals(editionId).delete();
        if (surgeonIds.length) await db.edition_surgeons.bulkAdd(
            surgeonIds.map(surgeon_id => ({ edition_id: editionId, surgeon_id }))
        );
        await db.edition_relation_changes.put({
            edition_public_id: edition.public_id, surgeon_public_ids: publicIds,
            mutation_id: crypto.randomUUID(), revision, updated_at: now()
        });
    });
    scheduleBackgroundSync();
}
