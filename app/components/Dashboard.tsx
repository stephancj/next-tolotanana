'use client';

import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowRight, CalendarDays, CheckCircle2, ClipboardList, Plus, Stethoscope, Users } from 'lucide-react';
import { db, type MedicalRecord } from '@/lib/client-db';
import { useEdition } from '../providers/EditionProvider';
import { useSync } from '../hooks/useSync';
import { useRouter } from 'next/navigation';

export default function Dashboard() {
  const { currentEdition, isLoading } = useEdition(); const router = useRouter();
  const { pendingCount, conflictCount, status } = useSync();
  const queried = useLiveQuery<MedicalRecord[]>(() => currentEdition?.id ? db.medical_records.filter(r => r.edition_id === currentEdition.id && r.deleted !== 1).toArray() : Promise.resolve([]), [currentEdition?.id]);
  const records = useMemo(() => queried || [], [queried]);
  const stats = useMemo(() => {
    const programmed = records.filter(r => r.program_mission === 1);
    return {
      total: records.length,
      today: records.filter(r => r.created_at?.startsWith(new Date().toISOString().slice(0, 10))).length,
      unplanned: programmed.filter(r => !r.planning_day || r.planning_day === 'A définir').length,
      preop: programmed.filter(r => !r.pre_op_checked || !r.pre_op_call).length,
      inBlock: programmed.filter(r => r.block_entry_time && !r.block_exit_time).length,
      recovery: programmed.filter(r => r.block_exit_time && !r.discharge_time).length,
      complete: programmed.filter(r => r.discharge_time).length,
      incomplete: records.filter(r => !r.last_name || !r.dossier_number || !r.clinical_diagnosis).length,
      recent: [...records].sort((a, b) => String(b.updated_at || b.created_at).localeCompare(String(a.updated_at || a.created_at))).slice(0, 6)
    };
  }, [records]);
  if (isLoading || queried === undefined) return <div className="mx-auto max-w-7xl p-8"><div className="h-28 animate-pulse rounded-xl bg-slate-200" /></div>;
  const flowItems = [
    { label: 'Patients', value: stats.total, Icon: Users, path: '/list' },
    { label: 'Pré-op à faire', value: stats.preop, Icon: ClipboardList, path: '/workflow?tab=pre-op' },
    { label: 'Au bloc', value: stats.inBlock, Icon: Stethoscope, path: '/workflow?tab=bloc' },
    { label: 'Post-op', value: stats.recovery, Icon: CalendarDays, path: '/workflow?tab=post-op' },
    { label: 'Sorties', value: stats.complete, Icon: CheckCircle2, path: '/workflow?tab=post-op' }
  ];
  const alerts = [
    { label: 'Sans jour de planning', count: stats.unplanned, path: '/planning', detail: 'Patients programmés à placer' },
    { label: 'Pré-op incomplet', count: stats.preop, path: '/workflow?tab=pre-op', detail: 'Appel ou présence à confirmer' },
    { label: 'Dossiers incomplets', count: stats.incomplete, path: '/list', detail: 'Identité ou diagnostic manquant' },
    { label: 'Conflits de données', count: conflictCount, path: '/sync-conflicts', detail: 'Choix manuel nécessaire' }
  ].filter(item => item.count > 0);

  return <main className="mx-auto w-full max-w-[1440px] px-4 py-6 md:px-8 md:py-9">
    <header className="flex flex-col gap-5 border-b border-slate-200 pb-7 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-indigo-700">Mission active</p><h1 className="mt-1 text-3xl font-black tracking-tight text-slate-950">{currentEdition?.name || 'Tableau de mission'}</h1><p className="mt-2 text-sm text-slate-600">{currentEdition ? `${currentEdition.place} · ${currentEdition.year}` : 'Choisissez une édition pour commencer.'}</p></div><button onClick={() => router.push('/form')} className="flex min-h-12 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-5 font-bold text-white hover:bg-indigo-700"><Plus size={19} />Nouveau dossier</button></header>

    <section aria-labelledby="now-title" className="py-7"><div className="mb-4 flex items-center justify-between"><div><h2 id="now-title" className="text-xl font-black text-slate-900">À traiter maintenant</h2><p className="text-sm text-slate-500">Les exceptions qui bloquent la mission.</p></div>{alerts.length === 0 && <span className="flex items-center gap-2 text-sm font-bold text-emerald-700"><CheckCircle2 size={18} />Aucune alerte</span>}</div>
      {alerts.length > 0 && <div className="divide-y divide-slate-200 border-y border-slate-200 bg-white">{alerts.map(item => <button key={item.label} onClick={() => router.push(item.path)} className="flex min-h-16 w-full items-center gap-4 px-4 text-left hover:bg-slate-50"><span className="grid h-9 w-9 place-items-center rounded-full bg-amber-100 font-black text-amber-800">{item.count}</span><span className="flex-1"><strong className="block text-slate-900">{item.label}</strong><span className="text-sm text-slate-500">{item.detail}</span></span><ArrowRight size={18} className="text-slate-400" /></button>)}</div>}
    </section>

    <section aria-labelledby="flow-title" className="border-t border-slate-200 py-7"><h2 id="flow-title" className="text-xl font-black text-slate-900">État de la journée</h2><div className="mt-4 grid grid-cols-1 gap-px overflow-hidden rounded-xl bg-slate-200 min-[380px]:grid-cols-2 md:grid-cols-5">{flowItems.map(({ label, value, Icon, path }) => <button key={label} onClick={() => router.push(path)} className="bg-white p-4 text-left hover:bg-slate-50 sm:p-5"><Icon size={20} className="text-indigo-600" /><span className="mt-5 block text-3xl font-black text-slate-950">{value}</span><span className="mt-1 block text-sm font-semibold text-slate-600">{label}</span></button>)}</div></section>

    <section className="grid gap-8 border-t border-slate-200 py-7 lg:grid-cols-[1fr_360px]"><div><div className="flex flex-col items-start gap-1 min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between"><h2 className="text-xl font-black text-slate-900">Planning de la semaine</h2><button onClick={() => router.push('/planning')} className="min-h-11 font-bold text-indigo-700">Ouvrir le planning →</button></div><div className="mt-3 divide-y divide-slate-200 border-y border-slate-200 bg-white">{['Lundi','Mardi','Mercredi','Jeudi','Vendredi'].map(day => { const count = records.filter(r => r.program_mission === 1 && r.planning_day === day).length; return <div key={day} className="flex min-h-12 items-center px-4"><span className="flex-1 font-semibold text-slate-700">{day}</span><span className="font-black text-slate-900">{count}</span><span className="ml-2 text-sm text-slate-500">patient{count > 1 ? 's' : ''}</span></div>; })}</div></div>
      <div><h2 className="text-xl font-black text-slate-900">Dernières saisies</h2><div className="mt-3 divide-y divide-slate-200 border-y border-slate-200 bg-white">{stats.recent.map(record => <button key={record.public_id} onClick={() => router.push(`/form?id=${record.id}`)} className="flex min-h-14 w-full items-center px-3 text-left hover:bg-slate-50"><span className="flex-1 truncate"><strong className="block truncate text-sm text-slate-900">{record.last_name} {record.first_name}</strong><span className="text-xs text-slate-500">{record.dossier_number || 'Sans numéro'}</span></span><ArrowRight size={16} className="text-slate-400" /></button>)}</div></div>
    </section>

    <footer className="flex flex-wrap items-center gap-3 border-t border-slate-200 pt-5 text-sm"><span className={`font-bold ${status === 'error' ? 'text-red-700' : pendingCount ? 'text-amber-700' : 'text-emerald-700'}`}>{pendingCount ? `${pendingCount} changement(s) restent sur cette tablette` : 'Toutes les données sont sauvegardées'}</span>{stats.today > 0 && <span className="text-slate-500">· {stats.today} nouveau(x) dossier(s) aujourd’hui</span>}</footer>
  </main>;
}
