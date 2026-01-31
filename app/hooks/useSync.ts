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
                        // We must match the 'sent' record to know what version we synced
                        const sentRecord = pendingChanges.find(r => r.public_id === public_id);

                        // Get current state from DB
                        const currentRecord = await db.medical_records.where('public_id').equals(public_id).first();

                        if (currentRecord && currentRecord.id && sentRecord) {
                            // CONCURRENCY CHECK:
                            // If the record in DB has the same 'updated_at' timestamp as the one we just sent,
                            // it means it hasn't been modified since we started the push properly.
                            // If timestamps differ, user edited it while we were pushing -> DO NOT mark as synced.
                            if (currentRecord.updated_at === sentRecord.updated_at) {
                                await db.medical_records.update(currentRecord.id, { sync_status: 'synced' });
                                count++;
                            } else {
                                console.log(`Skipping sync mark for ${public_id}: Record modified during push.`);
                            }
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
            // STEP 1: PUSH (Send changes only)
            await pushChanges();

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
