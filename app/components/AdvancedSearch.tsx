'use client';

import { useState, useEffect } from 'react';
import { MedicalRecord } from '@/lib/client-db';

export type FilterOperator = 'contains' | 'equals' | 'starts_with' | 'ends_with' | 'gt' | 'lt';

export interface FilterCriterion {
    id: string;
    field: keyof MedicalRecord | 'all';
    operator: FilterOperator;
    value: string;
}

interface AdvancedSearchProps {
    onFilterChange: (filters: FilterCriterion[]) => void;
    isOpen: boolean;
    onClose: () => void;
}

const FIELD_LABELS: Record<string, string> = {
    all: 'Tout (Recherche globale)',
    dossier_number: 'N° Dossier',
    last_name: 'Nom',
    first_name: 'Prénom',
    age: 'Âge',
    gender: 'Genre',
    address: 'Adresse', // City/Village often stored here
    clinical_diagnosis: 'Diagnostic',
    intervention_type: 'Intervention',
    planning_day: 'Jour Prévu',
    program_mission: 'Programmé (0/1)',
    distance: 'Distance'
};

const OPERATOR_LABELS: Record<FilterOperator, string> = {
    contains: 'Contient',
    equals: 'Est égal à',
    starts_with: 'Commence par',
    ends_with: 'Finit par',
    gt: 'Supérieur à (>)',
    lt: 'Inférieur à (<)',
};

export default function AdvancedSearch({ onFilterChange, isOpen, onClose }: AdvancedSearchProps) {
    const [filters, setFilters] = useState<FilterCriterion[]>([
        { id: '1', field: 'all', operator: 'contains', value: '' }
    ]);

    // Notify parent whenever filters change
    useEffect(() => {
        onFilterChange(filters);
    }, [filters, onFilterChange]);

    const addFilter = () => {
        setFilters([
            ...filters,
            { id: crypto.randomUUID(), field: 'last_name', operator: 'contains', value: '' }
        ]);
    };

    const removeFilter = (id: string) => {
        if (filters.length > 1) {
            setFilters(filters.filter(f => f.id !== id));
        } else {
            // If removing the last one, just reset it
            setFilters([{ id: '1', field: 'all', operator: 'contains', value: '' }]);
        }
    };

    const updateFilter = (id: string, key: keyof FilterCriterion, newValue: string) => {
        setFilters(filters.map(f =>
            f.id === id ? { ...f, [key]: newValue } : f
        ));
    };

    const clearFilters = () => {
        setFilters([{ id: '1', field: 'all', operator: 'contains', value: '' }]);
    };

    if (!isOpen) return null;

    return (
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-4 mb-6 animate-fadeIn">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                    <span className="text-indigo-600">⚡</span>
                    Filtres Avancés
                </h3>
                <div className="flex gap-2">
                    <button
                        onClick={clearFilters}
                        className="text-xs text-gray-400 hover:text-red-500 font-medium px-2 py-1 rounded hover:bg-red-50 transition-colors"
                    >
                        Réinitialiser
                    </button>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        ✕
                    </button>
                </div>
            </div>

            <div className="space-y-3">
                {filters.map((filter, index) => (
                    <div key={filter.id} className="flex flex-col sm:flex-row gap-2 items-center bg-gray-50 p-2 rounded-lg border border-gray-100 group">
                        {/* Logic connection label */}
                        <div className="w-16 text-center">
                            {index === 0 ? (
                                <span className="text-xs font-bold text-gray-400 bg-gray-200 px-2 py-0.5 rounded">OÙ</span>
                            ) : (
                                <span className="text-xs font-bold text-indigo-400">ET</span>
                            )}
                        </div>

                        {/* FIELD SELECT */}
                        <select
                            value={filter.field}
                            onChange={(e) => updateFilter(filter.id, 'field', e.target.value)}
                            className="flex-1 min-w-[140px] text-sm bg-white border border-gray-200 rounded-md px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                        >
                            {Object.entries(FIELD_LABELS).map(([key, label]) => (
                                <option key={key} value={key}>{label}</option>
                            ))}
                        </select>

                        {/* OPERATOR SELECT */}
                        <select
                            value={filter.operator}
                            onChange={(e) => updateFilter(filter.id, 'operator', e.target.value)}
                            className="w-[140px] text-sm bg-white border border-gray-200 rounded-md px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                        >
                            {Object.entries(OPERATOR_LABELS).map(([key, label]) => (
                                <option key={key} value={key}>{label}</option>
                            ))}
                        </select>

                        {/* VALUE INPUT */}
                        <input
                            type="text"
                            value={filter.value}
                            onChange={(e) => updateFilter(filter.id, 'value', e.target.value)}
                            placeholder="Valeur..."
                            className="flex-1 min-w-[150px] text-sm bg-white border border-gray-200 rounded-md px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                        />

                        {/* DELETE BUTTON */}
                        <button
                            onClick={() => removeFilter(filter.id)}
                            className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors opacity-100 sm:opacity-0 group-hover:opacity-100"
                            title="Supprimer ce filtre"
                        >
                            🗑
                        </button>
                    </div>
                ))}
            </div>

            <div className="mt-4 flex justify-start">
                <button
                    onClick={addFilter}
                    className="flex items-center gap-2 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-2 rounded-lg transition-colors border border-indigo-100"
                >
                    <span>➕</span> Ajouter un filtre
                </button>
            </div>
        </div>
    );
}
