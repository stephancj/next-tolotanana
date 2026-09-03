/* Background push for queued Dexie mutations. Pull/merge remains in the app UI. */
const DB_NAME = 'tolotananaDB';
const requestValue = request => new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
const openDb = () => new Promise((resolve, reject) => { const request = indexedDB.open(DB_NAME); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
const all = async (db, store) => { const tx = db.transaction(store, 'readonly'); return requestValue(tx.objectStore(store).getAll()); };
const get = async (db, store, key) => { const tx = db.transaction(store, 'readonly'); return requestValue(tx.objectStore(store).get(key)); };
const put = (db, store, value) => new Promise((resolve, reject) => { const tx = db.transaction(store, 'readwrite'); tx.objectStore(store).put(value); tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); });
const remove = (db, store, key) => new Promise((resolve, reject) => { const tx = db.transaction(store, 'readwrite'); tx.objectStore(store).delete(key); tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); });

async function backgroundPush() {
  const db = await openDb();
  if (!db.objectStoreNames.contains('medical_records')) return;
  const meta = db.objectStoreNames.contains('sync_meta') ? await get(db, 'sync_meta', 'device_id') : null;
  const deviceId = meta?.value;
  const editions = await all(db, 'editions'); const editionById = new Map(editions.map(e => [e.id, e.public_id]));
  const records = (await all(db, 'medical_records')).filter(r => r.sync_status === 'pending_update' || r.sync_status === 'pending_delete');
  for (let offset = 0; offset < records.length; offset += 100) {
    const changes = records.slice(offset, offset + 100).map(r => ({ ...r, mutation_id: r.pending_mutation_id, edition_public_id: editionById.get(r.edition_id), device_id: deviceId }));
    const response = await fetch('/api/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ changes }) });
    if (!response.ok) throw new Error('Background record push failed'); const result = await response.json();
    for (const ack of result.processed || []) { const row = records.find(r => r.public_id === ack.public_id); if (row?.pending_mutation_id === ack.mutation_id) await put(db, 'medical_records', { ...row, revision: ack.revision, sync_status: 'synced', pending_mutation_id: undefined, sync_error: undefined }); }
  }
  if (db.objectStoreNames.contains('surgeons')) {
    const surgeons = (await all(db, 'surgeons')).filter(s => s.sync_status === 'pending_update' || s.sync_status === 'pending_delete');
    if (surgeons.length) { const response = await fetch('/api/sync/surgeons', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ changes: surgeons.map(s => ({ ...s, mutation_id: s.pending_mutation_id })) }) }); if (!response.ok) throw new Error('Background surgeon push failed'); const result = await response.json(); for (const ack of result.processed || []) { const row = surgeons.find(s => s.public_id === ack.public_id); if (row?.pending_mutation_id === ack.mutation_id) await put(db, 'surgeons', { ...row, revision: ack.revision, sync_status: 'synced', pending_mutation_id: undefined }); } }
  }
  for (const item of db.objectStoreNames.contains('relation_changes') ? await all(db, 'relation_changes') : []) { const response = await fetch('/api/sync/record-surgeons', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ updates: [{ ...item, device_id: deviceId, occurred_at: item.updated_at }] }) }); if (!response.ok) throw new Error('Background relation push failed'); const result = await response.json(); if (result.processed?.[0]?.mutation_id === item.mutation_id) await remove(db, 'relation_changes', item.record_public_id); }
  for (const item of db.objectStoreNames.contains('edition_relation_changes') ? await all(db, 'edition_relation_changes') : []) { const response = await fetch('/api/sync/edition-surgeons', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ updates: [item] }) }); if (!response.ok) throw new Error('Background edition relation push failed'); const result = await response.json(); if (result.processed?.[0]?.mutation_id === item.mutation_id) await remove(db, 'edition_relation_changes', item.edition_public_id); }
  db.close();
}

self.addEventListener('sync', event => {
  if (event.tag !== 'tolotanana-sync') return;
  event.waitUntil(backgroundPush().then(() => self.clients.matchAll({ type: 'window', includeUncontrolled: true })).then(clients => {
    for (const client of clients) client.postMessage({ type: 'TOLOTANANA_SYNC' });
  }));
});
