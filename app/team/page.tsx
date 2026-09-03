'use client';

import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Surgeon } from '@/lib/client-db';
import { replaceEditionSurgeons, saveSurgeon } from '@/lib/local-records';
import { useTranslations } from '@/app/providers/I18nProvider';
import { useEdition } from '@/app/providers/EditionProvider';
import { useRouter } from 'next/navigation';
import { useFeedback } from '@/app/providers/FeedbackProvider';

export default function TeamPage() {
    const { currentEdition } = useEdition(); const router = useRouter(); const { confirm, notify } = useFeedback();
    const t = useTranslations('surgeons'); const tCommon = useTranslations('common');
    const [name, setName] = useState(''); const [specialty, setSpecialty] = useState('');
    const [editing, setEditing] = useState<Surgeon | null>(null); const [saving, setSaving] = useState(false);
    const surgeons = useLiveQuery(() => db.surgeons.filter(s => s.deleted !== 1).sortBy('name'), []) || [];
    const linkedIds = useLiveQuery(async () => currentEdition?.id
        ? (await db.edition_surgeons.where('edition_id').equals(currentEdition.id).toArray()).map(x => x.surgeon_id)
        : [], [currentEdition?.id]) || [];

    const submit = async (event: React.FormEvent) => {
        event.preventDefault(); if (!name.trim()) return; setSaving(true);
        try {
            await saveSurgeon({ name: name.trim(), specialty: specialty.trim(), is_active: 1 }, editing?.id);
            setName(''); setSpecialty(''); setEditing(null);
        } finally { setSaving(false); }
    };
    const toggle = async (surgeonId: number) => {
        if (!currentEdition?.id) return;
        const next = linkedIds.includes(surgeonId) ? linkedIds.filter(id => id !== surgeonId) : [...linkedIds, surgeonId];
        await replaceEditionSurgeons(currentEdition.id, next);
    };
    const beginEdit = (surgeon: Surgeon) => { setEditing(surgeon); setName(surgeon.name); setSpecialty(surgeon.specialty || ''); };
    const remove = async (surgeon: Surgeon) => {
        if (!surgeon.id || !await confirm({ title: 'Retirer ce membre ?', message: `${surgeon.name} ne sera plus proposé dans les affectations.`, confirmLabel: 'Retirer', destructive: true })) return;
        await saveSurgeon({ deleted: 1, is_active: 0 }, surgeon.id); notify('Membre retiré de l’équipe.', 'success');
    };

    return <main className="min-h-screen bg-slate-50 px-4 py-8">
        <div className="mx-auto max-w-4xl">
            <header className="mb-8 flex items-start justify-between gap-4">
                <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-600">Équipe locale</p>
                    <h1 className="mt-1 text-3xl font-black text-slate-900">{t('title')}</h1>
                    <p className="mt-2 text-sm text-slate-500">Les changements sont enregistrés sur cette tablette puis synchronisés.</p></div>
                <button onClick={() => router.push('/dashboard')} className="min-h-11 rounded-lg border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 focus-visible:outline-2 focus-visible:outline-indigo-600">← {tCommon('back')}</button>
            </header>

            <form onSubmit={submit} className="mb-8 grid gap-3 border-y border-slate-200 bg-white py-5 md:grid-cols-[1fr_1fr_auto]">
                <input value={name} onChange={e => setName(e.target.value)} placeholder={t('add.namePlaceholder')} required className="min-h-12 rounded-lg border border-slate-300 px-4 focus:border-indigo-600 focus:outline-none" />
                <input value={specialty} onChange={e => setSpecialty(e.target.value)} placeholder={t('add.specialtyPlaceholder')} className="min-h-12 rounded-lg border border-slate-300 px-4 focus:border-indigo-600 focus:outline-none" />
                <button disabled={saving} className="min-h-12 rounded-lg bg-indigo-600 px-6 font-bold text-white disabled:opacity-50">{editing ? 'Mettre à jour' : t('add.submit')}</button>
                {editing && <button type="button" onClick={() => { setEditing(null); setName(''); setSpecialty(''); }} className="text-left text-sm font-semibold text-slate-500">Annuler la modification</button>}
            </form>

            <div className="divide-y divide-slate-200 border-y border-slate-200 bg-white">
                {surgeons.length === 0 && <p className="p-8 text-center text-slate-500">{t('list.empty')}</p>}
                {surgeons.map(surgeon => {
                    const active = Boolean(surgeon.id && linkedIds.includes(surgeon.id));
                    return <div key={surgeon.public_id} className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div><div className="flex flex-wrap items-center gap-2"><strong className="text-slate-900">{surgeon.name}</strong>
                            {surgeon.sync_status !== 'synced' && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">En attente</span>}</div>
                            <p className="text-sm text-slate-500">{surgeon.specialty || t('list.unspecified')}</p></div>
                        <div className="flex gap-2">
                            <button onClick={() => beginEdit(surgeon)} className="min-h-11 rounded-lg border border-slate-300 px-4 text-sm font-semibold">Modifier</button>
                            <button onClick={() => surgeon.id && toggle(surgeon.id)} aria-pressed={active} className={`min-h-11 rounded-lg px-4 text-sm font-bold ${active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'}`}>{active ? t('list.assigned') : t('list.assign')}</button>
                            <button onClick={() => void remove(surgeon)} className="min-h-11 rounded-lg px-3 text-sm font-semibold text-red-700 hover:bg-red-50">Retirer</button>
                        </div>
                    </div>;
                })}
            </div>
        </div>
    </main>;
}
