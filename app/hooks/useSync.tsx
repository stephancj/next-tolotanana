'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Edition, type MedicalRecord, type Surgeon } from '@/lib/client-db';

const INTERVAL = 30_000;
type SyncStatus = 'idle' | 'syncing' | 'error' | 'offline' | 'conflict';
type SyncContextValue = {
    isSyncing: boolean;
    lastSyncTime: string | null;
    status: SyncStatus;
    pendingCount: number;
    conflictCount: number;
    manualSync: () => Promise<void>;
};
const SyncContext = createContext<SyncContextValue | null>(null);

async function ensureMetadata() {
    await db.medical_records.filter(r => !r.public_id || !r.updated_at ||
        (r.sync_status !== 'synced' && !r.pending_mutation_id)).modify(r => {
        r.public_id ||= crypto.randomUUID();
        r.updated_at ||= new Date().toISOString();
        r.revision ||= 0;
        if (r.sync_status !== 'synced') {
            r.sync_status ||= 'pending_update';
            r.pending_mutation_id ||= crypto.randomUUID();
        }
    });
}

async function pullMasterData() {
    const [editionRes, surgeonRes] = await Promise.all([
        fetch('/api/editions?include_deleted=1', { cache: 'no-store' }),
        fetch('/api/surgeons', { cache: 'no-store' })
    ]);
    if (!editionRes.ok || !surgeonRes.ok) throw new Error('Master-data pull failed');
    const serverEditions = await editionRes.json();
    const serverSurgeons = await surgeonRes.json();

    await db.transaction('rw', db.editions, db.surgeons, async () => {
        for (const e of serverEditions as Array<Edition>) {
            const existing = await db.editions.where('public_id').equals(e.public_id).first();
            const value: Partial<Edition> = {
                public_id: e.public_id, name: e.name, place: e.place, year: e.year,
                start_date: e.start_date, end_date: e.end_date, description: e.description,
                is_active: e.is_active ? 1 : 0, deleted: e.deleted ? 1 : 0,
                created_at: e.created_at, updated_at: e.updated_at, sync_status: 'synced'
            };
            if (existing?.id) await db.editions.update(existing.id, value);
            else await db.editions.add(value as Edition);
        }
        for (const s of serverSurgeons as Array<Surgeon>) {
            const existing = await db.surgeons.where('public_id').equals(s.public_id).first();
            const value: Partial<Surgeon> = {
                public_id: s.public_id, name: s.name, specialty: s.specialty,
                email: s.email, phone: s.phone, is_active: s.is_active ? 1 : 0,
                deleted: s.deleted ? 1 : 0, created_at: s.created_at,
                updated_at: s.updated_at, revision: s.revision || 0, sync_status: 'synced'
            };
            if (existing?.id && existing.sync_status === 'synced') await db.surgeons.update(existing.id, value);
            else if (!existing) await db.surgeons.add(value as Surgeon);
        }
    });

}

async function getDeviceId() {
    const existing = await db.sync_meta.get('device_id');
    if (existing?.value) return existing.value;
    const value = crypto.randomUUID();
    await db.sync_meta.put({ key: 'device_id', value });
    return value;
}

async function pushSurgeons() {
    const changes = await db.surgeons.filter(s => s.sync_status === 'pending_update' || s.sync_status === 'pending_delete').toArray();
    if (!changes.length) return;
    const response = await fetch('/api/sync/surgeons', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ changes: changes.map(s => ({ ...s, mutation_id: s.pending_mutation_id })) })
    });
    if (!response.ok) throw new Error('Surgeon push failed');
    const result = await response.json();
    for (const ack of result.processed || []) {
        const local = await db.surgeons.where('public_id').equals(ack.public_id).first();
        if (local?.id && local.pending_mutation_id === ack.mutation_id) await db.surgeons.update(local.id, {
            revision: ack.revision, sync_status: 'synced', pending_mutation_id: undefined, sync_error: undefined
        });
    }
    for (const conflict of result.conflicts || []) {
        const local = await db.surgeons.where('public_id').equals(conflict.public_id).first();
        if (local?.id) {
            await db.sync_conflicts.where('[entity+public_id]').equals(['surgeon', conflict.public_id]).delete();
            await db.sync_conflicts.add({ entity: 'surgeon', public_id: conflict.public_id, local_data: local, server_data: conflict.server, created_at: new Date().toISOString() });
            await db.surgeons.update(local.id, { sync_status: 'conflict', sync_error: 'Concurrent server update' });
        }
    }
}

async function pushRecords() {
    const deviceId = await getDeviceId();
    const all = await db.medical_records.filter(r => r.sync_status === 'pending_update' || r.sync_status === 'pending_delete').toArray();
    for (let start = 0; start < all.length; start += 100) {
        const batch = all.slice(start, start + 100);
        const changes = await Promise.all(batch.map(async record => {
            if (!record.pending_mutation_id && record.id) {
                record.pending_mutation_id = crypto.randomUUID();
                await db.medical_records.update(record.id, { pending_mutation_id: record.pending_mutation_id });
            }
            const edition = record.edition_id ? await db.editions.get(record.edition_id) : undefined;
            return {
                ...record,
                mutation_id: record.pending_mutation_id,
                edition_public_id: edition?.public_id,
                device_id: deviceId
            };
        }));
        const response = await fetch('/api/sync', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ changes })
        });
        if (!response.ok) throw new Error(`Record push failed (${response.status})`);
        const result = await response.json();

        await db.transaction('rw', db.medical_records, db.sync_conflicts, async () => {
            for (const ack of result.processed || []) {
                const local = await db.medical_records.where('public_id').equals(ack.public_id).first();
                // Never acknowledge a newer edit made while the request was in flight.
                if (local?.id && local.pending_mutation_id === ack.mutation_id) {
                    await db.medical_records.update(local.id, {
                        revision: ack.revision, sync_status: 'synced',
                        pending_mutation_id: undefined, sync_error: undefined
                    });
                }
            }
            for (const conflict of result.conflicts || []) {
                const local = await db.medical_records.where('public_id').equals(conflict.public_id).first();
                if (local?.id && local.pending_mutation_id === conflict.mutation_id) {
                    await db.sync_conflicts.where('[entity+public_id]')
                        .equals(['medical_record', conflict.public_id]).delete();
                    await db.sync_conflicts.add({
                        entity: 'medical_record', public_id: conflict.public_id,
                        local_data: local, server_data: conflict.server,
                        created_at: new Date().toISOString()
                    });
                    await db.medical_records.update(local.id, { sync_status: 'conflict', sync_error: 'Concurrent server update' });
                }
            }
            for (const error of result.errors || []) {
                const local = await db.medical_records.where('public_id').equals(error.id).first();
                if (local?.id) await db.medical_records.update(local.id, { sync_error: error.error });
            }
        });
        if (result.errors?.length) throw new Error(`${result.errors.length} record(s) rejected`);
    }
}

async function pullRecords() {
    const deviceId = await getDeviceId();
    let cursor = Number((await db.sync_meta.get('medical_records_cursor'))?.value || 0);
    let more = true;
    while (more) {
        const response = await fetch(`/api/sync?cursor=${cursor}&device_id=${deviceId}`, { cache: 'no-store' });
        if (!response.ok) throw new Error(`Record pull failed (${response.status})`);
        const result = await response.json();
        await db.transaction('rw', db.medical_records, db.editions, db.sync_conflicts, db.sync_meta, async () => {
            for (const change of result.changes || []) {
                if (change.entity !== 'medical_record') continue;
                const remote = change.payload as MedicalRecord & { edition_public_id?: string };
                const local = await db.medical_records.where('public_id').equals(remote.public_id!).first();
                const localDirty = local && local.sync_status !== 'synced';
                if (localDirty && Number(remote.revision || 0) > Number(local.revision || 0)) {
                    await db.sync_conflicts.where('[entity+public_id]')
                        .equals(['medical_record', remote.public_id!]).delete();
                    await db.sync_conflicts.add({
                        entity: 'medical_record', public_id: remote.public_id!,
                        local_data: local, server_data: remote, created_at: new Date().toISOString()
                    });
                    if (local.id) await db.medical_records.update(local.id, { sync_status: 'conflict' });
                    continue;
                }
                const edition = remote.edition_public_id
                    ? await db.editions.where('public_id').equals(remote.edition_public_id).first() : undefined;
                const safe: Partial<MedicalRecord> & { edition_public_id?: string } = { ...remote };
                delete safe.id;
                delete safe.edition_public_id;
                const value = {
                    ...safe, edition_id: edition?.id, deleted: remote.deleted ? 1 : 0,
                    pre_op_checked: remote.pre_op_checked ? 1 : 0,
                    sync_status: 'synced' as const, pending_mutation_id: undefined, sync_error: undefined
                };
                if (local?.id) await db.medical_records.update(local.id, value);
                else await db.medical_records.add(value as MedicalRecord);
            }
            cursor = Number(result.cursor || cursor);
            await db.sync_meta.put({ key: 'medical_records_cursor', value: String(cursor) });
        });
        more = Boolean(result.has_more);
    }
}

async function syncEditionRelations() {
    const queued = await db.edition_relation_changes.toArray();
    for (const item of queued) {
        const response = await fetch('/api/sync/edition-surgeons', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ updates: [item] })
        });
        if (!response.ok) throw new Error('Edition-surgeon push failed');
        const result = await response.json();
        if (result.conflicts?.length) {
            const conflict = result.conflicts[0];
            await db.sync_conflicts.where('[entity+public_id]').equals(['edition_surgeons', item.edition_public_id]).delete();
            await db.sync_conflicts.add({ entity: 'edition_surgeons', public_id: item.edition_public_id, local_data: item, server_data: { surgeon_public_ids: conflict.server, revision: conflict.revision }, created_at: new Date().toISOString() });
        } else if (result.processed?.[0]?.mutation_id === item.mutation_id) {
            await db.sync_meta.put({ key: `edition_surgeons:${item.edition_public_id}`, value: String(result.processed[0].revision) });
            await db.edition_relation_changes.delete(item.edition_public_id);
        }
    }
    const response = await fetch('/api/sync/edition-surgeons', { cache: 'no-store' });
    if (!response.ok) throw new Error('Edition-surgeon pull failed');
    const sets = await response.json() as Array<{ edition_public_id: string; surgeon_public_ids: string[]; revision: number }>;
    const queuedIds = new Set((await db.edition_relation_changes.toArray()).map(x => x.edition_public_id));
    await db.transaction('rw', db.edition_surgeons, db.editions, db.surgeons, db.sync_meta, async () => {
        for (const set of sets) {
            if (queuedIds.has(set.edition_public_id)) continue;
            const edition = await db.editions.where('public_id').equals(set.edition_public_id).first();
            if (!edition?.id) continue;
            await db.edition_surgeons.where('edition_id').equals(edition.id).delete();
            for (const publicId of set.surgeon_public_ids) {
                const surgeon = await db.surgeons.where('public_id').equals(publicId).first();
                if (surgeon?.id) await db.edition_surgeons.add({ edition_id: edition.id, surgeon_id: surgeon.id });
            }
            await db.sync_meta.put({ key: `edition_surgeons:${set.edition_public_id}`, value: String(set.revision) });
        }
    });
}

async function syncRelations() {
    const deviceId = await getDeviceId();
    const queued = await db.relation_changes.toArray();
    for (const item of queued) {
        const response = await fetch('/api/sync/record-surgeons', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ updates: [{
                record_public_id: item.record_public_id,
                surgeon_public_ids: item.surgeon_public_ids,
                mutation_id: item.mutation_id,
                device_id: deviceId,
                occurred_at: item.updated_at
            }] })
        });
        if (!response.ok) throw new Error('Record-surgeon push failed');
        const result = await response.json();
        if (result.errors?.length) throw new Error(result.errors[0].error);
        const conflict = result.conflicts?.[0];
        if (conflict) {
            await db.sync_conflicts.where('[entity+public_id]').equals(['record_surgeons', item.record_public_id]).delete();
            await db.sync_conflicts.add({
                entity: 'record_surgeons', public_id: item.record_public_id,
                local_data: item, server_data: { surgeon_public_ids: conflict.server, revision: conflict.revision },
                created_at: new Date().toISOString()
            });
            continue;
        }
        const ack = result.processed?.[0];
        const current = await db.relation_changes.get(item.record_public_id);
        if (ack && current?.mutation_id === item.mutation_id) {
            await db.sync_meta.put({ key: `record_surgeons:${item.record_public_id}`, value: String(ack.revision) });
            await db.relation_changes.delete(item.record_public_id);
        }
    }

    const response = await fetch('/api/sync/record-surgeons', { cache: 'no-store' });
    if (!response.ok) throw new Error('Record-surgeon pull failed');
    const remoteSets = await response.json() as Array<{ record_public_id: string; surgeon_public_ids: string[]; revision: number }>;
    const queuedIds = new Set((await db.relation_changes.toArray()).map(x => x.record_public_id));
    await db.transaction('rw', db.record_surgeons, db.medical_records, db.surgeons, db.sync_meta, async () => {
        const records = await db.medical_records.toArray();
        for (const record of records) {
            if (!record.id || !record.public_id || queuedIds.has(record.public_id)) continue;
            const remote = remoteSets.find(x => x.record_public_id === record.public_id);
            if (remote) await db.sync_meta.put({ key: `record_surgeons:${record.public_id}`, value: String(remote.revision) });
            await db.record_surgeons.where('medical_record_id').equals(record.id).delete();
            for (const publicId of remote?.surgeon_public_ids || []) {
                const surgeon = await db.surgeons.where('public_id').equals(publicId).first();
                if (surgeon?.id) await db.record_surgeons.add({
                    medical_record_id: record.id, surgeon_id: surgeon.id, sync_status: 'synced'
                });
            }
        }
    });
}

export function SyncProvider({ children }: { children: React.ReactNode }) {
    const [isSyncing, setIsSyncing] = useState(false);
    const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
    const [status, setStatus] = useState<SyncStatus>('idle');
    const running = useRef(false);
    const pendingCount = useLiveQuery(() => db.medical_records
        .filter(r => r.sync_status === 'pending_update' || r.sync_status === 'pending_delete').count(), []) || 0;
    const conflictCount = useLiveQuery(() => db.sync_conflicts.count(), []) || 0;

    const run = useCallback(async () => {
        if (!navigator.onLine) {
            setStatus('offline');
            void navigator.serviceWorker?.ready.then(registration => {
                const syncRegistration = registration as ServiceWorkerRegistration & { sync?: { register(tag: string): Promise<void> } };
                return syncRegistration.sync?.register('tolotanana-sync');
            }).catch(() => undefined);
            return;
        }
        const execute = async () => {
            if (running.current) return;
            running.current = true; setIsSyncing(true); setStatus('syncing');
            try {
                await ensureMetadata();
                await pushSurgeons();
                await pullMasterData();
                await pushRecords();
                await pullRecords();
                await syncEditionRelations();
                await syncRelations();
                setLastSyncTime(new Date().toISOString());
                setStatus((await db.sync_conflicts.count()) ? 'conflict' : 'idle');
            } catch (error) {
                console.error('[SYNC]', error); setStatus('error');
                void getDeviceId().then(device_id => fetch('/api/monitoring/sync', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ device_id, error: String(error) })
                })).catch(() => undefined);
                throw error;
            } finally { running.current = false; setIsSyncing(false); }
        };
        if (navigator.locks) {
            await navigator.locks.request('tolotanana-sync', { ifAvailable: true }, async lock => {
                if (lock) await execute();
            });
        } else await execute();
    }, []);

    useEffect(() => {
        void run().catch(() => undefined);
        const timer = window.setInterval(() => void run().catch(() => undefined), INTERVAL);
        const trigger = () => void run().catch(() => undefined);
        const visible = () => { if (document.visibilityState === 'visible') trigger(); };
        const serviceWorkerMessage = (event: MessageEvent) => { if (event.data?.type === 'TOLOTANANA_SYNC') trigger(); };
        window.addEventListener('online', trigger); window.addEventListener('focus', trigger);
        navigator.serviceWorker?.addEventListener('message', serviceWorkerMessage);
        document.addEventListener('visibilitychange', visible);
        navigator.storage?.persist?.().catch(() => false);
        return () => {
            clearInterval(timer); window.removeEventListener('online', trigger);
            window.removeEventListener('focus', trigger);
            navigator.serviceWorker?.removeEventListener('message', serviceWorkerMessage);
            document.removeEventListener('visibilitychange', visible);
        };
    }, [run]);

    return <SyncContext.Provider value={{ isSyncing, lastSyncTime, status, pendingCount, conflictCount, manualSync: run }}>
        {children}
    </SyncContext.Provider>;
}

export function useSync() {
    const value = useContext(SyncContext);
    if (!value) throw new Error('useSync must be used inside SyncProvider');
    return value;
}
