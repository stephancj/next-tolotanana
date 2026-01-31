import { useEffect, useState, useCallback, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/client-db';

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
            const validChanges = pendingChanges.filter(r => r.public_id);

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
