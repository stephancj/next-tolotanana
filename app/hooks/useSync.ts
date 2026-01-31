import { useEffect, useState, useCallback, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, MedicalRecord } from '@/lib/client-db';

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

    const pushChanges = async () => {
        // Fetch fresh pending changes
        const pendingChanges = await db.medical_records
            .where('sync_status')
            .anyOf('pending_update', 'pending_delete')
            .toArray();

        if (pendingChanges.length === 0) return;

        try {
            console.log(`Pushing ${pendingChanges.length} records...`);
            const response = await fetch('/api/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ changes: pendingChanges })
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`Push failed: ${text}`);
            }

            const result = await response.json();
            console.log('Sync Push Result:', result);

            // Mark processed items as synced using a single transaction for consistency
            if (result.processed && result.processed.length > 0) {
                const updatedCount = await db.transaction('rw', db.medical_records, async () => {
                    let count = 0;
                    for (const public_id of result.processed) {
                        const record = await db.medical_records.where('public_id').equals(public_id).first();
                        if (record && record.id) {
                            await db.medical_records.update(record.id, { sync_status: 'synced' });
                            count++;
                        }
                    }
                    return count;
                });
                console.log(`Updated locally synced status for ${updatedCount} records.`);
            }
        } catch (error) {
            console.error('Push error:', error);
            throw error;
        }
    };

    const pullChanges = async () => {
        const lastPull = localStorage.getItem('last_pull_timestamp');
        const url = lastPull ? `/api/sync?since=${lastPull}` : '/api/sync';

        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error('Pull failed');

            const data = await response.json();
            const changes = data.changes as MedicalRecord[];

            if (changes.length > 0) {
                console.log(`Pulling ${changes.length} records...`);
                await db.transaction('rw', db.medical_records, async () => {
                    for (const remoteRecord of changes) {
                        const localRecord = await db.medical_records.where('public_id').equals(remoteRecord.public_id!).first();

                        if (localRecord) {
                            // CONFLICT RESOLUTION
                            // If local is 'synced', we safely overwrite with newer server version.
                            // If local is 'pending', we avoid overwriting to not lose local unsent work (server will eventually get it on next push).
                            if (localRecord.sync_status === 'synced') {
                                await db.medical_records.put({
                                    ...remoteRecord,
                                    id: localRecord.id, // Preserve Dexie PK
                                    sync_status: 'synced'
                                });
                            }
                        } else {
                            // New record from server
                            await db.medical_records.add({ ...remoteRecord, sync_status: 'synced' });
                        }
                    }
                });
            }

            if (data.timestamp) {
                localStorage.setItem('last_pull_timestamp', data.timestamp);
                setLastSyncTime(new Date().toLocaleTimeString());
            }

        } catch (error) {
            console.error('Pull error:', error);
            throw error;
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
            // STEP 1: PUSH (Send changes first)
            await pushChanges();

            // STEP 2: PULL (Get updates after)
            await pullChanges();

            setStatus('idle');
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
