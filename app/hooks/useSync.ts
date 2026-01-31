import { useEffect, useState, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, MedicalRecord } from '@/lib/client-db';

const SYNC_INTERVAL_MS = 30000; // Sync every 30 seconds if online

export function useSync() {
    const [isSyncing, setIsSyncing] = useState(false);
    const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
    const [status, setStatus] = useState<'idle' | 'syncing' | 'error' | 'offline'>('idle');

    // Get pending changes from local DB
    const pendingChanges = useLiveQuery(
        () => db.medical_records
            .where('sync_status')
            .anyOf('pending_update', 'pending_delete')
            .toArray()
    );

    const pushChanges = async (changes: MedicalRecord[]) => {
        if (changes.length === 0) return;

        try {
            const response = await fetch('/api/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ changes })
            });

            if (!response.ok) throw new Error('Push failed');

            const result = await response.json();

            // Mark processed items as synced
            if (result.processed && result.processed.length > 0) {
                await db.transaction('rw', db.medical_records, async () => {
                    for (const public_id of result.processed) {
                        // Find local id by public_id
                        const record = await db.medical_records.where('public_id').equals(public_id).first();
                        if (record && record.id) {
                            if (record.sync_status === 'pending_delete') {
                                // Physically delete if it was a delete operation confirmed by server
                                // Or keep it as soft delete? Ideally keep soft delete but mark synced.
                                // Let's keep soft delete marked as synced to know it's done.
                                await db.medical_records.update(record.id, { sync_status: 'synced' });
                                // Alternatively, if we want to clean up offline space:
                                // await db.medical_records.delete(record.id); 
                                // But keeping it allows history.
                            } else {
                                await db.medical_records.update(record.id, { sync_status: 'synced' });
                            }
                        }
                    }
                });
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
            const changes = data.changes as MedicalRecord[]; // Records from server

            if (changes.length > 0) {
                await db.transaction('rw', db.medical_records, async () => {
                    for (const remoteRecord of changes) {
                        // Check if we have this record
                        const localRecord = await db.medical_records.where('public_id').equals(remoteRecord.public_id!).first();

                        if (localRecord) {
                            // Conflict resolution: Last Write Wins based on updated_at
                            // Or simple: Server Wins if we are not currently editing it (pending).

                            // If local is pending, we MIGHT want to keep local, OR assume server is newer.
                            // Simple strategy: If local is synced, overwrite. If local is pending, keep local (let push handle it next).
                            if (localRecord.sync_status === 'synced') {
                                // Overwrite
                                await db.medical_records.put({
                                    ...remoteRecord,
                                    id: localRecord.id, // Keep local ID
                                    sync_status: 'synced'
                                });
                            }
                            // If pending, we skip overwriting so we don't lose local work.
                        } else {
                            // New record from server
                            await db.medical_records.add({ ...remoteRecord, sync_status: 'synced' });
                        }
                    }
                });
            }

            // Update timestamp
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

        setIsSyncing(true);
        setStatus('syncing');

        try {
            // 1. Push PENDING changes
            if (pendingChanges && pendingChanges.length > 0) {
                await pushChanges(pendingChanges);
            }

            // 2. Pull server changes
            await pullChanges();

            setStatus('idle');
        } catch (err) {
            console.error(err);
            setStatus('error');
        } finally {
            setIsSyncing(false);
        }
    }, [pendingChanges]);

    // Auto-sync interval
    useEffect(() => {
        const interval = setInterval(() => {
            if (status !== 'syncing') {
                sync();
            }
        }, SYNC_INTERVAL_MS);

        // Also sync on mount
        sync();

        // Sync when coming back online
        const handleOnline = () => sync();
        window.addEventListener('online', handleOnline);

        return () => {
            clearInterval(interval);
            window.removeEventListener('online', handleOnline);
        };
    }, [sync, status]);

    return { isSyncing, status, lastSyncTime, pendingCount: pendingChanges?.length || 0, manualSync: sync };
}
