'use client';

import { useEffect, useState } from 'react';

type AuditEntry = {
    id: number;
    action: string;
    source: string;
    device_id?: string | null;
    user_id?: string | null;
    changed_fields: Record<string, { before: unknown; after: unknown }>;
    occurred_at?: string | null;
    created_at: string;
};

const ACTIONS: Record<string, string> = {
    create: 'Dossier créé', update: 'Dossier modifié', delete: 'Dossier supprimé',
    restore: 'Dossier restauré', relation_update: 'Chirurgiens modifiés',
    baseline: 'État initial importé'
};

export default function MedicalAuditTimeline({ publicId }: { publicId: string }) {
    const [entries, setEntries] = useState<AuditEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        const controller = new AbortController();
        fetch(`/api/records/${publicId}/audit?limit=50`, { cache: 'no-store', signal: controller.signal })
            .then(response => {
                if (!response.ok) throw new Error('Audit unavailable');
                return response.json();
            })
            .then(data => setEntries(data.entries || []))
            .catch(err => { if (err.name !== 'AbortError') setError(true); })
            .finally(() => setLoading(false));
        return () => controller.abort();
    }, [publicId]);

    return <section className="border-t border-slate-200 p-4 sm:p-6">
        <h3 className="font-black text-slate-800 mb-1">Journal médical</h3>
        <p className="text-xs text-slate-500 mb-4">Historique serveur immuable des modifications.</p>
        {loading && <p className="text-sm text-slate-500">Chargement de l’historique…</p>}
        {error && <p className="text-sm text-amber-700">Historique indisponible hors ligne.</p>}
        {!loading && !error && entries.length === 0 && <p className="text-sm text-slate-500">Aucune entrée enregistrée.</p>}
        <ol className="space-y-3">
            {entries.map(entry => <li key={entry.id} className="relative rounded-lg border border-slate-200 p-3 pl-8">
                <div className="absolute left-3 top-4 h-2.5 w-2.5 rounded-full bg-indigo-500" />
                <div className="flex flex-wrap justify-between gap-2">
                    <strong className="text-sm text-slate-800">{ACTIONS[entry.action] || entry.action}</strong>
                    <time className="text-xs text-slate-400">{new Date(entry.occurred_at || entry.created_at).toLocaleString()}</time>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                    {Object.keys(entry.changed_fields || {}).join(', ') || 'Métadonnées'}
                    {entry.user_id ? ` · ${entry.user_id}` : ''}
                    {entry.device_id ? ` · appareil ${entry.device_id.slice(0, 8)}` : ''}
                </p>
            </li>)}
        </ol>
    </section>;
}
