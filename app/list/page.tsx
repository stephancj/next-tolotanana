'use client';

import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Download, Eye, Pencil, Plus, Search, SlidersHorizontal, Trash2, X } from 'lucide-react';
import { db, type MedicalRecord } from '@/lib/client-db';
import { saveMedicalRecord, softDeleteMedicalRecord } from '@/lib/local-records';
import { useEdition } from '@/app/providers/EditionProvider';
import { useFeedback } from '@/app/providers/FeedbackProvider';
import { useRouter } from 'next/navigation';
import { formatOperationDay, getOperationDays, isUnscheduled } from '@/lib/operation-calendar';
import PatientDetailModal from '@/app/components/PatientDetailModal';
import PatientFilters from '@/app/components/PatientFilters';
import { EMPTY_FILTERS, activeFilterCount, matchesPatient, type PatientFilters as Filters } from '@/lib/patient-filters';

const statusLabel = (record: MedicalRecord) => record.sync_status === 'conflict' ? ['Conflit', 'bg-amber-100 text-amber-900'] : record.sync_status === 'synced' ? ['Sauvegardé', 'bg-emerald-100 text-emerald-800'] : ['En attente', 'bg-slate-100 text-slate-700'];

export default function PatientListPage() {
  const { currentEdition } = useEdition(); const router = useRouter(); const { notify, confirm } = useFeedback();
  const [filters, setFilters] = useState<Filters>({ ...EMPTY_FILTERS });
  const { query } = filters;
  const setQuery = (query: string) => setFilters(previous => ({ ...previous, query }));
  const activeCount = activeFilterCount(filters);
  const [filtersOpen, setFiltersOpen] = useState(true); const [selected, setSelected] = useState<MedicalRecord | null>(null);
  const records = useLiveQuery<MedicalRecord[]>(() => currentEdition?.id ? db.medical_records.filter(r => r.edition_id === currentEdition.id && r.deleted !== 1).toArray() : Promise.resolve([]), [currentEdition?.id]);
  const days = useMemo(() => [...new Set([...getOperationDays(currentEdition), ...(records || []).map(record => record.planning_day).filter((day): day is string => Boolean(day) && !isUnscheduled(day))])], [currentEdition, records]);
  const assignments = useLiveQuery(() => db.record_surgeons.toArray(), []);
  const surgeons = useLiveQuery(() => db.surgeons.toArray(), []);
  const surgeonsByRecord = useMemo(() => {
    const map = new Map<number, number[]>();
    for (const relation of assignments || []) {
      map.set(relation.medical_record_id, [...(map.get(relation.medical_record_id) || []), relation.surgeon_id]);
    }
    return map;
  }, [assignments]);
  const editionRecordIds = useMemo(() => new Set((records || []).map(record => record.id)), [records]);
  const assignedSurgeonIds = useMemo(() => new Set((assignments || []).filter(relation => editionRecordIds.has(relation.medical_record_id)).map(relation => relation.surgeon_id)), [assignments, editionRecordIds]);
  const surgeonOptions = (surgeons || []).filter(surgeon => surgeon.id !== undefined && assignedSurgeonIds.has(surgeon.id)).map(surgeon => ({ id: surgeon.id!, name: surgeon.name })).sort((a, b) => a.name.localeCompare(b.name));
  const loadingRelations = Boolean(filters.surgeon) && (assignments === undefined || surgeons === undefined);
  const filtered = useMemo(() => (records || []).filter(record => matchesPatient(record, filters, surgeonsByRecord.get(record.id!) || []))
    .sort((a, b) => String(b.updated_at || b.created_at).localeCompare(String(a.updated_at || a.created_at))), [records, filters, surgeonsByRecord]);
  const applyPreset = (preset: Partial<Filters>) => { setFilters({ ...EMPTY_FILTERS, ...preset }); setFiltersOpen(true); };
  const remove = async (record: MedicalRecord) => {
    if (!record.id || !await confirm({ title: 'Retirer ce dossier ?', message: `${record.last_name} ${record.first_name} sera masqué sur tous les appareils après synchronisation.`, confirmLabel: 'Retirer', destructive: true })) return;
    const id = record.id;
    await softDeleteMedicalRecord(id);
    notify('Dossier retiré. La modification sera synchronisée.', 'success', { label: 'Annuler', run: () => { void saveMedicalRecord({ deleted: 0 }, id).then(() => notify('Dossier restauré.', 'success')); } });
  };
  const exportCsv = () => {
    const rows = [['Dossier','Nom','Prénom','Âge','Téléphone','Diagnostic','Jour'], ...filtered.map(r => [r.dossier_number,r.last_name,r.first_name,r.age,r.phone1,r.clinical_diagnosis,r.planning_day])];
    const blob = new Blob([rows.map(row => row.map(v => `"${String(v || '').replaceAll('"','""')}"`).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `patients-${new Date().toISOString().slice(0,10)}.csv`; link.click(); URL.revokeObjectURL(link.href);
  };

  return <main className="min-h-screen bg-slate-50"><div className="mx-auto max-w-[1500px] px-4 py-6 md:px-8 md:py-9">
    <header className="flex flex-col gap-5 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-indigo-700">Base patients</p><h1 className="mt-1 text-3xl font-black text-slate-950">Patients</h1><p className="mt-2 text-sm text-slate-500">{records?.length || 0} dossier(s) disponibles hors ligne</p></div><div className="flex flex-wrap gap-2"><button onClick={exportCsv} disabled={records === undefined || loadingRelations} className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 sm:flex-none"><Download size={17} />Exporter</button><button onClick={() => router.push('/form')} className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-bold text-white sm:flex-none"><Plus size={18} />Nouveau dossier</button></div></header>
    <section aria-label="Recherche patients" className="border-b border-slate-200 py-5"><div className="flex flex-col gap-3 md:flex-row"><label className="relative flex-1"><span className="sr-only">Rechercher</span><Search aria-hidden className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={19} /><input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Nom, dossier, téléphones, adresse ou diagnostic…" className="clinical-input" style={{ paddingLeft: '2.75rem', paddingRight: '2.5rem' }} />{query && <button onClick={() => setQuery('')} aria-label="Effacer la recherche" className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-slate-500"><X size={18} /></button>}</label><button onClick={() => setFiltersOpen(value => !value)} aria-expanded={filtersOpen} className="flex min-h-12 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 font-bold text-slate-700"><SlidersHorizontal size={18} />Filtres{activeCount > 0 && <span className="rounded-full bg-indigo-100 px-2 text-xs text-indigo-800">{activeCount}</span>}</button></div>{filtersOpen && <PatientFilters days={days} value={filters} onChange={setFilters} surgeons={surgeonOptions} />}
      <div aria-label="Raccourcis de filtres" className="mt-3 flex flex-wrap gap-2">{[
        { label: 'Loin · non appelés', preset: { distance: 'loin', called: 'no' } },
        { label: 'Loin · appel non renseigné', preset: { distance: 'loin', called: 'unknown' } },
        { label: 'Fentes palatines non programmées', preset: { category: 'fente', cleftType: 'palate', programmed: 'no' } },
        { label: 'Dossiers incomplets', preset: { incomplete: 'any' } },
      ].map(({ label, preset }) => <button key={label} onClick={() => applyPreset(preset)} className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:border-indigo-500 hover:text-indigo-700">{label}</button>)}</div>
    </section>
    <div className="flex items-center justify-between py-4"><p role="status" aria-live="polite" className="text-sm font-semibold text-slate-600">{loadingRelations ? 'Chargement des affectations…' : `${filtered.length} résultat(s)`}</p>{(query || activeCount > 0) && <button onClick={() => setFilters({ ...EMPTY_FILTERS })} className="min-h-10 text-sm font-bold text-indigo-700">Réinitialiser</button>}</div>
    {records === undefined || loadingRelations ? <div className="h-44 animate-pulse rounded-xl bg-slate-200" /> : filtered.length === 0 ? <div className="border-y border-slate-200 bg-white p-12 text-center"><h2 className="font-black text-slate-900">Aucun patient trouvé</h2><p className="mt-2 text-sm text-slate-500">Modifiez les filtres ou créez un nouveau dossier.</p></div> : <div className="divide-y divide-slate-200 border-y border-slate-200 bg-white">{filtered.map(record => { const [sync, tone] = statusLabel(record); return <article key={record.public_id} className="grid gap-3 p-4 hover:bg-slate-50 md:grid-cols-[110px_1.2fr_100px_1fr_140px_auto] md:items-center"><div><span className="text-xs font-bold text-slate-500">DOSSIER</span><strong className="block text-slate-900">{record.dossier_number || 'Sans numéro'}</strong></div><div><h2 className="font-black uppercase text-slate-950">{record.last_name} <span className="font-semibold normal-case">{record.first_name}</span></h2><p className="mt-0.5 text-sm text-slate-500 md:hidden">{record.age} · {record.phone1 || 'Sans téléphone'}</p></div><div className="hidden text-sm text-slate-700 md:block">{record.age}</div><div className="min-w-0"><p className="truncate text-sm text-slate-700">{record.clinical_diagnosis || 'Diagnostic non renseigné'}</p><p className="text-xs text-slate-500">{record.program_mission ? formatOperationDay(record.planning_day) : 'Non programmé'}</p></div><span className={`w-fit rounded-full px-2 py-1 text-xs font-bold ${tone}`}>{sync}</span><div className="flex justify-start gap-1 md:justify-end"><button onClick={() => setSelected(record)} aria-label="Voir le dossier" className="grid min-h-11 min-w-11 place-items-center rounded-lg text-slate-600 hover:bg-slate-100"><Eye size={18} /></button><button onClick={() => router.push(`/form?id=${record.id}`)} aria-label="Modifier le dossier" className="grid min-h-11 min-w-11 place-items-center rounded-lg text-indigo-700 hover:bg-indigo-50"><Pencil size={18} /></button><button onClick={() => remove(record)} aria-label="Retirer le dossier" className="grid min-h-11 min-w-11 place-items-center rounded-lg text-red-700 hover:bg-red-50"><Trash2 size={18} /></button></div></article>; })}</div>}
  </div>{selected && <PatientDetailModal record={selected} onClose={() => setSelected(null)} />}</main>;
}
