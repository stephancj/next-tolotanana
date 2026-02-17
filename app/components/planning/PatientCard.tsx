'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { UserRound, ExternalLink } from 'lucide-react';
import { PatientCardData, SurgeonData } from '@/lib/planning-utils';

const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi'];
const DAY_OPTIONS = ['A définir', ...DAYS];

const distanceColors: Record<string, string> = {
    'loin': 'bg-red-100 text-red-700',
    'un peu loin': 'bg-amber-100 text-amber-700',
    'en ville': 'bg-green-100 text-green-700',
    'non précisé': 'bg-slate-100 text-slate-500',
};

const distanceLabels: Record<string, string> = {
    'loin': 'Loin',
    'un peu loin': 'Peu loin',
    'en ville': 'En ville',
    'non précisé': '—',
};

interface PatientCardProps {
    patient: PatientCardData;
    surgeons: SurgeonData[];
    isSelected: boolean;
    showCheckbox: boolean;
    onToggleSelect: (id: number) => void;
    onAssignSurgeon: (patientId: number) => void;
    onChangePlanningDay: (patientId: number, day: string) => void;
    onClickCard: (patientId: number) => void;
}

export default function PatientCard({
    patient,
    surgeons,
    isSelected,
    showCheckbox,
    onToggleSelect,
    onAssignSurgeon,
    onChangePlanningDay,
    onClickCard,
}: PatientCardProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({
        id: `patient-${patient.id}`,
        data: { type: 'patient', patient },
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    const assignedSurgeons = surgeons.filter(s => patient.assignedSurgeonIds.includes(s.id));
    const distClass = distanceColors[patient.distance] || distanceColors['non précisé'];
    const distLabel = distanceLabels[patient.distance] || patient.distance;

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`bg-white rounded-xl p-3 border transition-all group ${
                isDragging
                    ? 'opacity-50 shadow-lg ring-2 ring-indigo-300 border-indigo-200'
                    : 'border-slate-100 hover:shadow-md hover:border-slate-200'
            } ${isSelected ? 'ring-2 ring-indigo-400 border-indigo-200 bg-indigo-50/30' : ''}`}
        >
            <div className="flex items-start gap-2">
                {showCheckbox && (
                    <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onToggleSelect(patient.id)}
                        className="mt-1 w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                )}

                {/* Drag handle */}
                <div
                    {...attributes}
                    {...listeners}
                    className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 mt-0.5 flex-shrink-0"
                    title="Glisser pour déplacer"
                >
                    <svg width="12" height="16" viewBox="0 0 12 16" fill="currentColor">
                        <circle cx="3" cy="3" r="1.5" />
                        <circle cx="9" cy="3" r="1.5" />
                        <circle cx="3" cy="8" r="1.5" />
                        <circle cx="9" cy="8" r="1.5" />
                        <circle cx="3" cy="13" r="1.5" />
                        <circle cx="9" cy="13" r="1.5" />
                    </svg>
                </div>

                <div className="flex-1 min-w-0">
                    {/* Name + dossier */}
                    <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-xs font-bold text-indigo-500">#{patient.dossier_number}</span>
                        <span className="text-sm font-bold text-slate-800 truncate">
                            {patient.last_name} {patient.first_name}
                        </span>
                    </div>

                    {/* Badges row */}
                    <div className="flex flex-wrap gap-1 mb-1.5">
                        <span className="text-xs px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-600 font-medium">
                            {patient.age || '—'}
                        </span>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${distClass}`}>
                            {distLabel}
                        </span>
                        <span className="text-xs px-1.5 py-0.5 rounded-full bg-slate-50 text-slate-500 font-medium">
                            {patient.gender === 'M' ? '♂' : '♀'}
                        </span>
                    </div>

                    {/* Diagnosis */}
                    {(patient.diagnosis_category || patient.clinical_diagnosis) && (
                        <p className="text-xs text-slate-500 truncate mb-1.5">
                            {patient.diagnosis_category || patient.clinical_diagnosis}
                        </p>
                    )}

                    {/* Surgeon chips */}
                    {assignedSurgeons.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-1.5">
                            {assignedSurgeons.map(s => (
                                <span key={s.id} className="text-xs px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium">
                                    {s.name}
                                </span>
                            ))}
                        </div>
                    )}

                    {/* Actions row */}
                    <div className="flex items-center gap-1.5 mt-1">
                        {/* Day dropdown (fallback for mobile) */}
                        <select
                            value={patient.planning_day || 'A définir'}
                            onChange={(e) => onChangePlanningDay(patient.id, e.target.value)}
                            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-1.5 py-1 text-slate-600 focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400 appearance-none cursor-pointer"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {DAY_OPTIONS.map(d => (
                                <option key={d} value={d}>{d}</option>
                            ))}
                        </select>

                        {/* Assign surgeon button */}
                        <button
                            onClick={(e) => { e.stopPropagation(); onAssignSurgeon(patient.id); }}
                            className="text-xs px-1.5 py-1 rounded-lg bg-slate-50 text-slate-500 hover:bg-emerald-50 hover:text-emerald-600 border border-slate-200 hover:border-emerald-200 transition-colors flex items-center gap-1"
                            title="Assigner chirurgien"
                        >
                            <UserRound size={12} />
                            {assignedSurgeons.length > 0 ? assignedSurgeons.length : '+'}
                        </button>

                        {/* Open operation / record */}
                        <button
                            onClick={(e) => { e.stopPropagation(); onClickCard(patient.id); }}
                            className="text-xs px-1.5 py-1 rounded-lg bg-slate-50 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 border border-slate-200 hover:border-indigo-200 transition-colors flex items-center gap-1"
                            title="Ouvrir le dossier"
                        >
                            <ExternalLink size={12} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
