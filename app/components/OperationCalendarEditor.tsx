'use client';

import { useState } from 'react';
import { db, type Edition } from '@/lib/client-db';
import { formatOperationDay, operationDateRange, validateOperationDates } from '@/lib/operation-calendar';
import { useFeedback } from '@/app/providers/FeedbackProvider';

function CalendarForm({ edition, onClose }: { edition: Edition; onClose: () => void }) {
  const [dates, setDates] = useState<string[]>(edition.operation_dates || []);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const { confirm } = useFeedback();
  const addRange = () => {
    try { setDates(validateOperationDates([...dates, ...operationDateRange(start, end || start)], edition)); setError(''); }
    catch (err) { setError(err instanceof Error ? err.message : 'Dates invalides.'); }
  };
  const save = async () => {
    setSaving(true); setError('');
    try {
      const removed = (edition.operation_dates || []).filter(day => !dates.includes(day));
      const affected = await db.medical_records.filter(record => record.edition_id === edition.id && record.deleted !== 1 && removed.includes(record.planning_day || '')).count();
      if (affected && !await confirm({ title: 'Retirer ces dates du calendrier ?', message: `${affected} dossier(s) conserveront leur date et apparaîtront dans « Hors calendrier ». Aucune affectation ne sera effacée.`, confirmLabel: 'Modifier le calendrier' })) return;
      const response = await fetch('/api/editions', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ public_id: edition.public_id, operation_dates: dates, updated_at: edition.updated_at }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Enregistrement impossible.');
      await db.editions.update(edition.id!, { operation_dates: body.operation_dates, planning_mode: body.planning_mode, updated_at: body.updated_at, sync_status: 'synced' });
      onClose();
    } catch (err) { setError(err instanceof Error ? err.message : 'Connexion requise pour enregistrer les dates d’opération.'); }
    finally { setSaving(false); }
  };
  return <section aria-label="Configurer les dates d’opération" className="mt-3 space-y-3 rounded-xl border border-indigo-200 bg-white p-4">
    <p className="text-sm text-slate-600">Choisissez uniquement les jours d’opération. Les déplacements et le screening restent dans la période générale de la mission.</p>
    <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]"><label><span className="clinical-label">Première date d’opération</span><input type="date" className="clinical-input" min={edition.start_date} max={edition.end_date} value={start} onChange={e => setStart(e.target.value)} /></label><label><span className="clinical-label">Dernière date de la période (facultatif)</span><input type="date" className="clinical-input" min={start || edition.start_date} max={edition.end_date} value={end} onChange={e => setEnd(e.target.value)} /></label><button type="button" onClick={addRange} disabled={!start || saving} className="min-h-12 self-end rounded-lg border border-indigo-300 px-4 font-bold text-indigo-700 disabled:opacity-50">Ajouter les dates</button></div>
    <p className="text-xs text-slate-500">Une seule date ajoute un jour. Une période ajoute tous ses jours, week-ends compris ; retirez ensuite les jours sans opération.</p>
    <ul aria-label="Dates d’opération sélectionnées" className="flex flex-wrap gap-2">{dates.map(day => <li key={day}><button disabled={saving} onClick={() => setDates(dates.filter(date => date !== day))} aria-label={`Retirer ${formatOperationDay(day)}`} className="min-h-11 rounded-lg border border-slate-300 px-3 text-sm text-slate-700">{formatOperationDay(day)} ×</button></li>)}</ul>
    {!dates.length && <p className="text-sm text-amber-800">Aucune date d’opération configurée : la planification sera indisponible.</p>}
    {error && <p role="alert" className="text-sm font-semibold text-red-700">{error}</p>}
    <div className="flex flex-wrap gap-3"><button onClick={save} disabled={saving} className="min-h-12 rounded-lg bg-indigo-600 px-4 font-bold text-white disabled:opacity-50">{saving ? 'Enregistrement…' : 'Enregistrer le calendrier'}</button><button onClick={onClose} disabled={saving} className="min-h-12 px-4 font-bold text-slate-600">Annuler</button></div>
  </section>;
}

export default function OperationCalendarEditor({ edition }: { edition: Edition }) {
  const [open, setOpen] = useState(false);
  if (edition.planning_mode !== 'dates') return <p className="mb-3 text-sm text-slate-600">Planning historique du lundi au vendredi.</p>;
  return <div className="mb-4"><button onClick={() => setOpen(!open)} aria-expanded={open} className="min-h-11 rounded-lg border border-indigo-300 bg-white px-4 text-sm font-bold text-indigo-700">Dates d’opération · {edition.operation_dates?.length || 0} jour(s)</button>{open && <CalendarForm edition={edition} onClose={() => setOpen(false)} />}</div>;
}
