'use client';

import { useId, type ReactNode } from 'react';
import { formatOperationDay } from '@/lib/operation-calendar';
import { DIAGNOSES, type PatientFilters as Filters } from '@/lib/patient-filters';

function Select({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: ReactNode }) {
  return <label className="block min-w-0"><span className="clinical-label">{label}</span><select className="clinical-input" value={value} onChange={event => onChange(event.target.value)}><option value="">Tous</option>{children}</select></label>;
}

function YesNoOptions() {
  return <><option value="yes">Oui</option><option value="no">Non</option><option value="unknown">Non renseigné</option></>;
}

export default function PatientFilters({ value, onChange, surgeons, days }: {
  value: Filters; onChange: (value: Filters) => void; surgeons: { id: number; name: string }[]; days: string[];
}) {
  const ageHelpId = useId();
  const set = (key: keyof Filters, next: string | boolean) => onChange({ ...value, [key]: next });
  const invalidAge = value.ageMin !== '' && value.ageMax !== '' && Number(value.ageMin) > Number(value.ageMax);
  return <div className="mt-3 space-y-5 rounded-xl border border-slate-200 bg-white p-4">
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Select label="Diagnostic" value={value.category} onChange={next => onChange({ ...value, category: next, cleftType: '', laterality: '' })}>{DIAGNOSES.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</Select>
      <fieldset className="min-w-0"><legend className="clinical-label">Âge</legend><div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_5rem] gap-2">
        <input aria-label="Âge minimum" aria-describedby={ageHelpId} aria-invalid={invalidAge} className="clinical-input min-w-0 flex-1" placeholder="Min" type="number" min="0" step="any" value={value.ageMin} onChange={e => onChange({ ...value, ageMin: e.target.value, ageUnknown: false })} />
        <input aria-label="Âge maximum" aria-describedby={ageHelpId} aria-invalid={invalidAge} className="clinical-input min-w-0 flex-1" placeholder="Max" type="number" min="0" step="any" value={value.ageMax} onChange={e => onChange({ ...value, ageMax: e.target.value, ageUnknown: false })} />
        <select aria-label="Unité d’âge" className="clinical-input min-w-0" value={value.ageUnit} onChange={e => set('ageUnit', e.target.value)}><option value="years">Ans</option><option value="months">Mois</option></select>
      </div><label className="mt-1 flex min-h-11 items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={value.ageUnknown} onChange={e => onChange({ ...value, ageUnknown: e.target.checked, ageMin: '', ageMax: '' })} />Âge non renseigné</label><p id={ageHelpId} className={`text-xs ${invalidAge ? 'text-red-700' : 'text-slate-500'}`}>{invalidAge ? 'Le minimum doit être inférieur ou égal au maximum.' : 'Bornes inclusives ; conversion des semaines, mois et années.'}</p></fieldset>
      <Select label="Distance" value={value.distance} onChange={next => set('distance', next)}><option value="en ville">En ville</option><option value="un peu loin">Un peu loin</option><option value="loin">Loin</option><option value="unknown">Non précisé</option></Select>
      <Select label="Appel effectué" value={value.called} onChange={next => set('called', next)}><YesNoOptions /></Select>
    </div>
    {value.category === 'fente' && <div className="grid gap-4 rounded-lg bg-slate-50 p-3 sm:grid-cols-2"><Select label="Type de fente" value={value.cleftType} onChange={next => set('cleftType', next)}><option value="lip">Labiale</option><option value="palate">Palatine</option><option value="both">Labio-palatine</option><option value="unknown">Non précisé</option></Select><Select label="Latéralité de la fente" value={value.laterality} onChange={next => set('laterality', next)}><option value="unilateral">Unilatérale</option><option value="bilateral">Bilatérale</option><option value="unknown">Non précisée</option></Select></div>}
    <div className="grid gap-4 sm:grid-cols-2"><Select label="Jour" value={value.day} onChange={next => set('day', next)}><option value="undefined">Jour à définir</option>{value.day && value.day !== 'undefined' && !days.includes(value.day) && <option value={value.day}>{formatOperationDay(value.day)} (hors calendrier)</option>}{days.map(day => <option key={day} value={day}>{formatOperationDay(day)}</option>)}</Select><Select label="Mission" value={value.programmed} onChange={next => set('programmed', next)}><option value="yes">Programmés</option><option value="no">Non programmés</option></Select></div>
    <details className="border-t border-slate-200 pt-2"><summary className="min-h-11 cursor-pointer py-3 font-bold text-indigo-700">Plus de filtres{[value.preOp, value.incomplete, value.gender, value.surgeon, value.photo, value.sync].some(Boolean) ? ' — actifs' : ''}</summary><div className="mt-2 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <Select label="Contrôle préopératoire effectué" value={value.preOp} onChange={next => set('preOp', next)}><YesNoOptions /></Select>
      <Select label="Dossier à compléter" value={value.incomplete} onChange={next => set('incomplete', next)}><option value="any">Au moins un champ manquant</option><option value="phone">Téléphone manquant</option><option value="age">Naissance et âge manquants</option><option value="gender">Sexe manquant</option><option value="address">Adresse manquante</option><option value="diagnosis">Diagnostic manquant</option></Select>
      <Select label="Sexe" value={value.gender} onChange={next => set('gender', next)}><option value="m">Masculin</option><option value="f">Féminin</option><option value="unknown">Non renseigné</option></Select>
      <Select label="Chirurgien assigné" value={value.surgeon} onChange={next => set('surgeon', next)}><option value="none">Sans chirurgien</option>{surgeons.map(surgeon => <option key={surgeon.id} value={surgeon.id}>{surgeon.name}</option>)}</Select>
      <Select label="Photo ou lien photo disponible" value={value.photo} onChange={next => set('photo', next)}><option value="yes">Avec photo / lien photo</option><option value="no">Sans photo / lien photo</option></Select>
      <Select label="Synchronisation" value={value.sync} onChange={next => set('sync', next)}><option value="synced">Sauvegardés</option><option value="pending">En attente</option><option value="conflict">Conflits</option></Select>
    </div></details>
  </div>;
}
