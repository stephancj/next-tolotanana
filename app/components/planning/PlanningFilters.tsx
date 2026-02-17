'use client';

import { Filter, X } from 'lucide-react';
import { getAgeCategory } from '@/lib/planning-utils';

interface PlanningFiltersProps {
    filterDistance: string;
    filterDiagnosis: string;
    filterAge: string;
    uniqueDiagnoses: string[];
    onFilterDistance: (v: string) => void;
    onFilterDiagnosis: (v: string) => void;
    onFilterAge: (v: string) => void;
    onClear: () => void;
}

const DISTANCES = ['en ville', 'un peu loin', 'loin', 'non précisé'];
const AGE_OPTIONS = [
    { value: 'baby', label: 'Bébés (<2 ans)' },
    { value: 'child', label: 'Enfants (2-12)' },
    { value: 'adult', label: 'Adultes (12+)' },
];

export default function PlanningFilters({
    filterDistance,
    filterDiagnosis,
    filterAge,
    uniqueDiagnoses,
    onFilterDistance,
    onFilterDiagnosis,
    onFilterAge,
    onClear,
}: PlanningFiltersProps) {
    const hasFilters = filterDistance || filterDiagnosis || filterAge;

    return (
        <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 bg-white/80 backdrop-blur-sm rounded-xl border border-slate-100">
            <Filter size={14} className="text-slate-400" />

            {/* Distance */}
            <select
                value={filterDistance}
                onChange={e => onFilterDistance(e.target.value)}
                className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-slate-600 focus:ring-1 focus:ring-indigo-400"
            >
                <option value="">Distance</option>
                {DISTANCES.map(d => (
                    <option key={d} value={d}>{d}</option>
                ))}
            </select>

            {/* Diagnosis */}
            <select
                value={filterDiagnosis}
                onChange={e => onFilterDiagnosis(e.target.value)}
                className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-slate-600 focus:ring-1 focus:ring-indigo-400"
            >
                <option value="">Diagnostic</option>
                {uniqueDiagnoses.map(d => (
                    <option key={d} value={d}>{d}</option>
                ))}
            </select>

            {/* Age */}
            <div className="flex gap-1">
                {AGE_OPTIONS.map(opt => (
                    <button
                        key={opt.value}
                        onClick={() => onFilterAge(filterAge === opt.value ? '' : opt.value)}
                        className={`text-xs px-2 py-1.5 rounded-lg font-medium transition-all ${
                            filterAge === opt.value
                                ? 'bg-indigo-100 text-indigo-700 border border-indigo-200'
                                : 'bg-slate-50 text-slate-500 border border-slate-200 hover:bg-slate-100'
                        }`}
                    >
                        {opt.label}
                    </button>
                ))}
            </div>

            {/* Clear */}
            {hasFilters && (
                <button
                    onClick={onClear}
                    className="text-xs px-2 py-1.5 rounded-lg text-red-500 hover:bg-red-50 border border-red-200 flex items-center gap-1 transition"
                >
                    <X size={12} />
                    Effacer
                </button>
            )}
        </div>
    );
}

export { getAgeCategory };
