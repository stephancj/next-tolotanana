import { useEffect, useState, useCallback, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Edition, type Surgeon } from '@/lib/client-db';

const SYNC_INTERVAL_MS = 30000; // Sync every 30 seconds if online

export function useSync() {
    const [isSyncing, setIsSyncing] = useState(false);
    const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
    const [status, setStatus] = useState<'idle' | 'syncing' | 'error' | 'offline'>('idle');
    const isSyncingRef = useRef(false);

    // Only used for UI indicator, does not trigger sync logic directly
    const pendingCount = useLiveQuery(
        () => db.medical_records
            .where('sync_status')
            .anyOf('pending_update', 'pending_delete')
            .count()
    ) || 0;

    // Ensure all records have public_id before syncing
    const ensurePublicIds = async () => {
        const recordsWithoutId = await db.medical_records
            .filter(r => !r.public_id)
            .toArray();

        if (recordsWithoutId.length > 0) {
            console.log(`[SYNC] Found ${recordsWithoutId.length} records without public_id, generating...`);

            await db.transaction('rw', db.medical_records, async () => {
                for (const record of recordsWithoutId) {
                    if (record.id) {
                        const public_id = crypto.randomUUID();
                        await db.medical_records.update(record.id, {
                            public_id,
                            sync_status: 'pending_update',
                            updated_at: new Date().toISOString()
                        });
                        console.log(`[SYNC] Generated public_id for record ${record.id}: ${public_id}`);
                    }
                }
            });

            console.log(`[SYNC] ✓ Generated ${recordsWithoutId.length} public_ids`);
        }
    };


    const syncEditions = async () => {
        try {
            console.log('[SYNC] Pulling editions from Neon...');
            const res = await fetch('/api/editions');
            if (!res.ok) throw new Error('Failed to fetch editions');

            const serverEditions = await res.json();

            if (Array.isArray(serverEditions) && serverEditions.length > 0) {
                await db.transaction('rw', db.editions, async () => {
                    for (const serverEd of serverEditions) {
                        // Check if exists
                        const existing = await db.editions.where('public_id').equals(serverEd.public_id).first();

                        const localEdition: Partial<Edition> = {
                            public_id: serverEd.public_id,
                            name: serverEd.name,
                            place: serverEd.place,
                            year: serverEd.year,
                            start_date: serverEd.start_date,
                            end_date: serverEd.end_date,
                            description: serverEd.description,
                            is_active: serverEd.is_active ? 1 : 0,
                            deleted: serverEd.deleted ? 1 : 0,
                            created_at: serverEd.created_at,
                            updated_at: serverEd.updated_at,
                            sync_status: 'synced' // Marked as synced since it came from server
                        };

                        if (existing && existing.id) {
                            await db.editions.update(existing.id, localEdition);
                        } else {
                            await db.editions.add(localEdition as Edition);
                        }
                    }
                });
                console.log(`[SYNC] ✓ Pulled and updated ${serverEditions.length} editions`);
            }
        } catch (e) {
            console.error("Failed to pull editions", e);
        }
    };

    const syncSurgeons = async () => {
        try {
            console.log('[SYNC] Pulling surgeons from Server...');
            const res = await fetch('/api/surgeons?is_active=1');
            if (!res.ok) throw new Error('Failed to fetch surgeons');

            const serverSurgeons = await res.json();

            if (Array.isArray(serverSurgeons) && serverSurgeons.length > 0) {
                await db.transaction('rw', db.surgeons, async () => {
                    for (const s of serverSurgeons) {
                        const existing = await db.surgeons.where('public_id').equals(s.public_id).first();

                        const localSurgeon: Partial<Surgeon> = {
                            public_id: s.public_id,
                            name: s.name,
                            specialty: s.specialty,
                            email: s.email,
                            phone: s.phone,
                            is_active: s.is_active,
                            sync_status: 'synced',
                            deleted: s.deleted ? 1 : 0
                        };

                        if (existing && existing.id) {
                            await db.surgeons.update(existing.id, localSurgeon);
                        } else {
                            await db.surgeons.add(localSurgeon as Surgeon);
                        }
                    }
                });
                console.log(`[SYNC] ✓ Synced ${serverSurgeons.length} surgeons`);
            }
        } catch (e) {
            console.error("Failed to sync surgeons", e);
        }
    };

    const syncRecordSurgeons = async () => {
        try {
            // Find pending updates in record_surgeons
            const pendingLinks = await db.record_surgeons
                .where('sync_status')
                .equals('pending_update')
                .toArray();

            if (pendingLinks.length === 0) return;

            console.log(`[SYNC] Found ${pendingLinks.length} pending record-surgeon links`);

            // Group by medical_record_id
            const updatesByRecord: Record<number, number[]> = {};
            pendingLinks.forEach(link => {
                if (!updatesByRecord[link.medical_record_id]) {
                    updatesByRecord[link.medical_record_id] = [];
                }
                updatesByRecord[link.medical_record_id].push(link.surgeon_id);
            });

            const updatesToSend: Array<{ record_public_id: string; surgeon_public_ids: string[] }> = [];

            for (const recordIdStr of Object.keys(updatesByRecord)) {
                const recordId = parseInt(recordIdStr);
                const surgeonIds = updatesByRecord[recordId];

                // Get Public IDs
                const record = await db.medical_records.get(recordId);
                if (!record?.public_id) continue;

                const surgeonPublicIds = [];
                for (const sId of surgeonIds) {
                    const surgeon = await db.surgeons.get(sId);
                    if (surgeon?.public_id) {
                        surgeonPublicIds.push(surgeon.public_id);
                    }
                }

                updatesToSend.push({
                    record_public_id: record.public_id,
                    surgeon_public_ids: surgeonPublicIds
                });
            }

            if (updatesToSend.length > 0) {
                console.log(`[SYNC] Sending ${updatesToSend.length} record-surgeon updates...`);

                const res = await fetch('/api/sync/record-surgeons', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ updates: updatesToSend })
                });

                if (res.ok) {
                    await res.json();

                    // Mark as synced
                    await db.transaction('rw', db.record_surgeons, async () => {
                        for (const update of updatesToSend) {
                            // We need to match by public_id reverse lookup or just mark all pending for this recordId as synced
                            const record = await db.medical_records.where('public_id').equals(update.record_public_id).first();
                            if (record && record.id) {
                                await db.record_surgeons
                                    .where('medical_record_id')
                                    .equals(record.id)
                                    .modify({ sync_status: 'synced' });
                            }
                        }
                    });
                    console.log('[SYNC] ✓ Record-Surgeon links synced');
                }
            }

        } catch (e) {
            console.error("Failed to sync record-surgeons", e);
        }
    };

    const pushChanges = async () => {
        console.log('[SYNC] Starting pushChanges...');

        // Fetch ALL records that are not synced (including undefined/null status)
        const pendingChanges = await db.medical_records
            .filter(r => r.sync_status !== 'synced')
            .toArray();

        console.log(`[SYNC] Found ${pendingChanges.length} pending records`);

        if (pendingChanges.length === 0) {
            console.log('[SYNC] No pending changes, skipping push');
            return;
        }

        try {
            // Sanitize: Ensure every record has a public_id before sending
            // AND enrich with edition_public_id mapping
            const validChanges = await Promise.all(
                pendingChanges
                    .filter(r => r.public_id)
                    .map(async (r) => {
                        let edition_public_id = undefined;
                        if (r.edition_id) {
                            const ed = await db.editions.get(r.edition_id);
                            edition_public_id = ed?.public_id;
                        }
                        return { ...r, edition_public_id };
                    })
            );

            console.log(`[SYNC] Valid records with public_id: ${validChanges.length}`);
            if (validChanges.length > 0) {
                console.log('[SYNC] Sample record:', validChanges[0]);
            }

            if (validChanges.length === 0) {
                console.warn('[SYNC] No valid records with public_id!');
                return;
            }

            console.log(`[SYNC] Sending ${validChanges.length} records to /api/sync...`);

            const response = await fetch('/api/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ changes: validChanges })
            });

            console.log(`[SYNC] Response status: ${response.status}`);

            if (!response.ok) {
                const text = await response.text();
                console.error('[SYNC] Push failed:', text);
                throw new Error(`Push failed: ${text}`);
            }

            const result = await response.json();
            console.log('[SYNC] Push Result:', result);
            console.log(`[SYNC] Processed IDs: ${result.processed?.length || 0}`);
            console.log(`[SYNC] Errors: ${result.errors?.length || 0}`);

            // Mark processed items as synced indiscriminately to unblock user
            if (result.processed && result.processed.length > 0) {
                console.log(`[SYNC] Marking ${result.processed.length} records as synced...`);

                const updatedCount = await db.transaction('rw', db.medical_records, async () => {
                    let count = 0;
                    for (const public_id of result.processed) {
                        const record = await db.medical_records.where('public_id').equals(public_id).first();

                        if (record && record.id) {
                            await db.medical_records.update(record.id, { sync_status: 'synced' });
                            count++;
                        } else {
                            console.warn(`[SYNC] Could not find record ${public_id} to mark as synced`);
                        }
                    }
                    return count;
                });
                console.log(`[SYNC] ✓ Updated ${updatedCount} records to synced status`);
            } else {
                console.warn('[SYNC] No records were processed by server!');
            }
        } catch (error) {
            console.error('[SYNC] Push error:', error);
            // Don't throw, just log so the loop continues next time
        }
    };



    const sync = useCallback(async () => {
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
            setStatus('offline');
            return;
        }

        // Prevent overlapping syncs
        if (isSyncingRef.current) return;
        isSyncingRef.current = true;

        setIsSyncing(true);
        setStatus('syncing');

        try {
            // STEP 0: Ensure all records have public_id
            await ensurePublicIds();

            // STEP 0.5: Sync Editions first (parents)
            await syncEditions();

            // STEP 0.6: Sync Surgeons (master data)
            await syncSurgeons();

            // STEP 1: PUSH (Send changes only)
            await pushChanges();

            // STEP 2: Sync Record-Surgeon Links (depend on Records and Surgeons being synced)
            await syncRecordSurgeons();

            setStatus('idle');
            setLastSyncTime(new Date().toLocaleTimeString());
        } catch (err) {
            console.error("Sync process error:", err);
            setStatus('error');
        } finally {
            setIsSyncing(false);
            isSyncingRef.current = false;
        }
    }, []); // No dependencies, safe to pass to useEffect

    // Auto-sync schedule
    useEffect(() => {
        // Initial sync
        sync();

        const interval = setInterval(sync, SYNC_INTERVAL_MS);

        const handleOnline = () => sync();
        window.addEventListener('online', handleOnline);

        return () => {
            clearInterval(interval);
            window.removeEventListener('online', handleOnline);
        };
    }, [sync]);

    return {
        isSyncing,
        status,
        lastSyncTime,
        pendingCount,
        manualSync: sync
    };
}
