'use client';

import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type MedicalRecord, type Surgeon, type SyncConflict } from '@/lib/client-db';
import { useRouter } from 'next/navigation';

const HIDDEN = new Set(['id', 'public_id', 'edition_id', 'record_public_id', 'edition_public_id', 'mutation_id', 'sync_status', 'pending_mutation_id', 'sync_error', 'revision', 'updated_at', 'created_at']);
const FIELD_LABELS: Record<string, string> = { last_name: 'Nom', first_name: 'Prénom', dossier_number: 'Numéro de dossier', clinical_diagnosis: 'Diagnostic clinique', intervention_type: 'Intervention', observation: 'Observation', planning_day: 'Jour de planning', surgeon_public_ids: 'Chirurgiens affectés', anesthesia_type: 'Type d’anesthésie', anesthesia_observation: 'Observation anesthésique', discharge_notes: 'Notes de sortie' };
const label = (key: string) => FIELD_LABELS[key] || key.replaceAll('_', ' ').replace(/^./, c => c.toUpperCase());
const display = (value: unknown) => value === null || value === undefined || value === '' ? 'Non renseigné' : typeof value === 'object' ? JSON.stringify(value) : String(value);

function DiffResolver({ conflict, onDone }: { conflict: SyncConflict; onDone: () => void }) {
    const local = conflict.local_data as Record<string, unknown>;
    const server = conflict.server_data as Record<string, unknown>;
    const fields = useMemo(() => Array.from(new Set([...Object.keys(local), ...Object.keys(server)]))
        .filter(key => !HIDDEN.has(key) && JSON.stringify(local[key]) !== JSON.stringify(server[key])), [local, server]);
    const [localFields, setLocalFields] = useState(() => new Set(fields));
    const toggle = (field: string) => setLocalFields(previous => {
        const next = new Set(previous); if (next.has(field)) next.delete(field); else next.add(field); return next;
    });

    const resolve = async () => {
        if (conflict.entity === 'medical_record') {
            const row = await db.medical_records.where('public_id').equals(conflict.public_id).first(); if (!row?.id) return;
            const merged = { ...server } as Partial<MedicalRecord>;
            for (const field of localFields) (merged as Record<string, unknown>)[field] = local[field];
            delete merged.id; delete merged.edition_id;
            await db.medical_records.update(row.id, {
                ...merged, edition_id: row.edition_id, revision: Number(server.revision || 0),
                sync_status: 'pending_update', pending_mutation_id: crypto.randomUUID(), updated_at: new Date().toISOString(), sync_error: undefined
            });
        } else if (conflict.entity === 'surgeon') {
            const row = await db.surgeons.where('public_id').equals(conflict.public_id).first(); if (!row?.id) return;
            const merged = { ...server } as Partial<Surgeon>;
            for (const field of localFields) (merged as Record<string, unknown>)[field] = local[field];
            delete merged.id;
            await db.surgeons.update(row.id, { ...merged, revision: Number(server.revision || 0), sync_status: 'pending_update', pending_mutation_id: crypto.randomUUID(), updated_at: new Date().toISOString() });
        } else if (conflict.entity === 'record_surgeons') {
            const serverRevision = Number(server.revision || 0);
            const useLocal = localFields.has('surgeon_public_ids');
            const ids = (useLocal ? local.surgeon_public_ids : server.surgeon_public_ids) as string[];
            const record = await db.medical_records.where('public_id').equals(conflict.public_id).first();
            if (record?.id) {
                const surgeons = await Promise.all(ids.map(id => db.surgeons.where('public_id').equals(id).first()));
                await db.record_surgeons.where('medical_record_id').equals(record.id).delete();
                await db.record_surgeons.bulkAdd(surgeons.flatMap(s => s?.id ? [{ medical_record_id: record.id!, surgeon_id: s.id, sync_status: 'pending_update' as const }] : []));
                await db.relation_changes.put({ record_public_id: conflict.public_id, surgeon_public_ids: ids, revision: serverRevision, mutation_id: crypto.randomUUID(), updated_at: new Date().toISOString() });
            }
        } else if (conflict.entity === 'edition_surgeons') {
            const ids = (localFields.has('surgeon_public_ids') ? local.surgeon_public_ids : server.surgeon_public_ids) as string[];
            await db.edition_relation_changes.put({ edition_public_id: conflict.public_id, surgeon_public_ids: ids, revision: Number(server.revision || 0), mutation_id: crypto.randomUUID(), updated_at: new Date().toISOString() });
        }
        await db.sync_conflicts.where('[entity+public_id]').equals([conflict.entity, conflict.public_id]).delete(); onDone();
    };

    return <section className="border-y border-slate-200 bg-white py-5">
        <div className="flex flex-wrap items-start justify-between gap-3 px-5"><div><p className="text-xs font-bold uppercase tracking-wider text-amber-700">Données modifiées sur deux appareils</p><h2 className="font-black text-slate-900">{String(local.dossier_number || local.name || conflict.public_id)}</h2></div><div className="flex flex-wrap items-center gap-2"><button onClick={() => setLocalFields(new Set())} className="min-h-10 rounded-lg border border-slate-300 px-3 text-xs font-bold">Tout serveur</button><button onClick={() => setLocalFields(new Set(fields))} className="min-h-10 rounded-lg border border-slate-300 px-3 text-xs font-bold">Tout tablette</button><span className="text-xs text-slate-500">{new Date(conflict.created_at).toLocaleString()}</span></div></div>
        <div className="mt-4 divide-y divide-slate-200 border-y border-slate-200 md:hidden">{fields.map(field => <div key={field} className="p-4"><h3 className="mb-3 text-sm font-bold text-slate-800">{label(field)}</h3><div className="grid gap-2"><button onClick={() => setLocalFields(p => { const n = new Set(p); n.delete(field); return n; })} className={`min-h-12 w-full rounded-lg border p-3 text-left ${!localFields.has(field) ? 'border-indigo-600 bg-indigo-50 ring-2 ring-indigo-100' : 'border-slate-200'}`}><span className="mb-1 block text-xs font-bold uppercase text-slate-500">Serveur</span>{display(server[field])}</button><button onClick={() => toggle(field)} className={`min-h-12 w-full rounded-lg border p-3 text-left ${localFields.has(field) ? 'border-indigo-600 bg-indigo-50 ring-2 ring-indigo-100' : 'border-slate-200'}`}><span className="mb-1 block text-xs font-bold uppercase text-slate-500">Cette tablette</span>{display(local[field])}</button></div></div>)}</div>
        <div className="mt-4 hidden overflow-x-auto md:block"><table className="w-full min-w-[620px] text-sm"><thead><tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><th className="px-5 py-3">Champ</th><th className="px-4 py-3">Version serveur</th><th className="px-4 py-3">Version locale</th></tr></thead><tbody className="divide-y divide-slate-100">{fields.map(field => <tr key={field}><th className="px-5 py-4 text-left font-semibold text-slate-700">{label(field)}</th><td className="px-4 py-3"><button onClick={() => setLocalFields(p => { const n = new Set(p); n.delete(field); return n; })} className={`w-full rounded-lg border p-3 text-left ${!localFields.has(field) ? 'border-indigo-600 bg-indigo-50 ring-2 ring-indigo-100' : 'border-slate-200'}`}>{display(server[field])}</button></td><td className="px-4 py-3"><button onClick={() => toggle(field)} className={`w-full rounded-lg border p-3 text-left ${localFields.has(field) ? 'border-indigo-600 bg-indigo-50 ring-2 ring-indigo-100' : 'border-slate-200'}`}>{display(local[field])}</button></td></tr>)}</tbody></table></div>
        <div className="mt-5 flex flex-col items-stretch gap-2 px-4 sm:items-end sm:px-5"><p className="text-xs text-slate-500">Les champs sélectionnés en bleu seront conservés.</p><button onClick={resolve} className="min-h-12 rounded-lg bg-indigo-600 px-6 font-bold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700">Appliquer la sélection et synchroniser</button></div>
    </section>;
}

export default function SyncConflictsPage() {
    const conflicts = useLiveQuery(() => db.sync_conflicts.orderBy('created_at').reverse().toArray(), []) || [];
    const router = useRouter(); const [, refresh] = useState(0);
    return <main className="min-h-screen bg-slate-50 px-4 py-6 sm:py-8"><div className="mx-auto max-w-6xl"><header className="mb-7 flex flex-col items-start gap-4 sm:flex-row sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-700">Synchronisation</p><h1 className="mt-1 text-3xl font-black text-slate-900">Choisir les données à conserver</h1><p className="mt-2 max-w-2xl text-sm text-slate-600">Chaque ligne propose la valeur serveur et la valeur enregistrée sur cette tablette. La sélection est explicite avant tout nouvel envoi.</p></div><button onClick={() => router.back()} className="min-h-11 rounded-lg border border-slate-300 bg-white px-4 font-bold">Retour</button></header>{!conflicts.length ? <div className="border-y border-slate-200 bg-white p-10 text-center text-slate-600">Aucun conflit à résoudre.</div> : <div className="space-y-6">{conflicts.map(c => <DiffResolver key={`${c.entity}-${c.public_id}`} conflict={c} onDone={() => refresh(x => x + 1)} />)}</div>}</div></main>;
}
