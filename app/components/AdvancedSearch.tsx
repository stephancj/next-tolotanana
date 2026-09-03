'use client';

import { useState, useEffect } from 'react';
import { MedicalRecord } from '@/lib/client-db';
import { useTranslations } from '../providers/I18nProvider';

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

export default function AdvancedSearch({ onFilterChange, isOpen, onClose }: AdvancedSearchProps) {
    const t = useTranslations('search.advanced');

    const [filters, setFilters] = useState<FilterCriterion[]>([
        { id: '1', field: 'all', operator: 'contains', value: '' }
    ]);

    const FIELD_LABELS: Record<string, string> = {
        all: t('fields.all'),
        dossier_number: t('fields.dossier_number'),
        last_name: t('fields.last_name'),
        first_name: t('fields.first_name'),
        age: t('fields.age'),
        gender: t('fields.gender'),
        address: t('fields.address'),
        clinical_diagnosis: t('fields.clinical_diagnosis'),
        intervention_type: t('fields.intervention_type'),
        planning_day: t('fields.planning_day'),
        program_mission: t('fields.program_mission'),
        distance: t('fields.distance')
    };

    const OPERATOR_LABELS: Record<FilterOperator, string> = {
        contains: t('operators.contains'),
        equals: t('operators.equals'),
        starts_with: t('operators.starts_with'),
        ends_with: t('operators.ends_with'),
        gt: t('operators.gt'),
        lt: t('operators.lt'),
    };

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
                    {t('title')}
                </h3>
                <div className="flex gap-2">
                    <button
                        onClick={clearFilters}
                        className="text-xs text-gray-400 hover:text-red-500 font-medium px-2 py-1 rounded hover:bg-red-50 transition-colors"
                    >
                        {t('reset')}
                    </button>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        ✕
                    </button>
                </div>
            </div>

            <div className="space-y-3">
                {filters.map((filter, index) => (
                    <div key={filter.id} className="group flex flex-col items-stretch gap-2 rounded-lg border border-gray-100 bg-gray-50 p-3 sm:flex-row sm:items-center sm:p-2">
                        {/* Logic connection label */}
                        <div className="text-left sm:w-16 sm:text-center">
                            {index === 0 ? (
                                <span className="text-xs font-bold text-gray-400 bg-gray-200 px-2 py-0.5 rounded">{t('where')}</span>
                            ) : (
                                <span className="text-xs font-bold text-indigo-400">{t('and')}</span>
                            )}
                        </div>

                        {/* FIELD SELECT */}
                        <select
                            value={filter.field}
                            onChange={(e) => updateFilter(filter.id, 'field', e.target.value)}
                            className="min-h-12 w-full min-w-0 flex-1 rounded-md border border-gray-200 bg-white px-3 py-2 text-base outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 sm:text-sm"
                        >
                            {Object.entries(FIELD_LABELS).map(([key, label]) => (
                                <option key={key} value={key}>{label}</option>
                            ))}
                        </select>

                        {/* OPERATOR SELECT */}
                        <select
                            value={filter.operator}
                            onChange={(e) => updateFilter(filter.id, 'operator', e.target.value)}
                            className="min-h-12 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-base outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 sm:w-[140px] sm:text-sm"
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
                            placeholder={t('valuePlaceholder')}
                            className="min-h-12 w-full min-w-0 flex-1 rounded-md border border-gray-200 bg-white px-3 py-2 text-base outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 sm:text-sm"
                        />

                        {/* DELETE BUTTON */}
                        <button
                            onClick={() => removeFilter(filter.id)}
                            className="flex min-h-11 min-w-11 items-center justify-center self-end rounded-lg text-gray-500 transition-colors hover:bg-red-50 hover:text-red-600 sm:self-auto sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100"
                            title={t('deleteFilter')}
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
                    <span>➕</span> {t('addFilter')}
                </button>
            </div>
        </div>
    );
}
