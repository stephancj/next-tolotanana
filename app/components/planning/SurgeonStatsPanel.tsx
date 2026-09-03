'use client';

import { X } from 'lucide-react';
import { PatientCardData, SurgeonData } from '@/lib/planning-utils';

const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi'];

interface SurgeonStatsPanelProps {
    records: PatientCardData[];
    surgeons: SurgeonData[];
    isOpen: boolean;
    onClose: () => void;
}

interface CellStat {
    total: number;
    byCategory: Record<string, number>;
}

export default function SurgeonStatsPanel({ records, surgeons, isOpen, onClose }: SurgeonStatsPanelProps) {
    if (!isOpen) return null;

    // Build stats: surgeon × day → { total, byCategory }
    const stats: Record<number, Record<string, CellStat>> = {};
    const dayTotals: Record<string, CellStat> = {};

    for (const day of DAYS) {
        dayTotals[day] = { total: 0, byCategory: {} };
    }

    for (const surgeon of surgeons) {
        stats[surgeon.id] = {};
        for (const day of DAYS) {
            stats[surgeon.id][day] = { total: 0, byCategory: {} };
        }
    }

    // Populate
    for (const record of records) {
        const day = record.planning_day;
        if (!day || !DAYS.includes(day)) continue;

        const cat = record.diagnosis_category || record.clinical_diagnosis || 'Non catégorisé';

        // Day totals
        dayTotals[day].total++;
        dayTotals[day].byCategory[cat] = (dayTotals[day].byCategory[cat] || 0) + 1;

        // Per surgeon
        for (const surgeonId of record.assignedSurgeonIds) {
            if (stats[surgeonId] && stats[surgeonId][day]) {
                stats[surgeonId][day].total++;
                stats[surgeonId][day].byCategory[cat] = (stats[surgeonId][day].byCategory[cat] || 0) + 1;
            }
        }
    }

    // Collect all unique categories
    const allCategories = new Set<string>();
    for (const record of records) {
        const cat = record.diagnosis_category || record.clinical_diagnosis;
        if (cat) allCategories.add(cat);
    }

    return (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/30 backdrop-blur-sm" onClick={onClose}>
            <div
                role="dialog" aria-modal="true" aria-labelledby="surgeon-stats-title"
                className="mobile-dialog flex max-h-[90dvh] w-full max-w-4xl flex-col overflow-hidden rounded-t-xl bg-white shadow-2xl md:mx-4 md:max-h-[80dvh] md:rounded-xl"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
                    <div>
                        <h3 id="surgeon-stats-title" className="text-base font-bold text-slate-800">Statistiques chirurgiens</h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Nombre de patients par chirurgien et par jour
                        </p>
                    </div>
                    <button onClick={onClose} aria-label="Fermer" className="grid min-h-11 min-w-11 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700">
                        <X size={18} />
                    </button>
                </div>

                {/* Table */}
                <div className="mobile-scroll flex-1 overflow-auto p-3 sm:p-4">
                    <table className="min-w-[680px] w-full text-sm">
                        <thead>
                            <tr className="border-b border-slate-200">
                                <th className="text-left py-2 px-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                                    Chirurgien
                                </th>
                                {DAYS.map(day => (
                                    <th key={day} className="text-center py-2 px-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                                        {day.slice(0, 3)}
                                    </th>
                                ))}
                                <th className="text-center py-2 px-3 text-xs font-bold text-indigo-500 uppercase tracking-wider">
                                    Total
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {surgeons.map((surgeon, idx) => {
                                const surgeonTotal = DAYS.reduce((sum, day) => sum + (stats[surgeon.id]?.[day]?.total || 0), 0);
                                return (
                                    <tr key={surgeon.id} className={idx % 2 === 0 ? 'bg-slate-50/50' : ''}>
                                        <td className="py-2.5 px-3">
                                            <span className="font-bold text-slate-700">{surgeon.name}</span>
                                            {surgeon.specialty && (
                                                <span className="text-xs text-slate-400 ml-1.5">{surgeon.specialty}</span>
                                            )}
                                        </td>
                                        {DAYS.map(day => {
                                            const cell = stats[surgeon.id]?.[day];
                                            if (!cell || cell.total === 0) {
                                                return <td key={day} className="text-center py-2.5 px-3 text-slate-300">—</td>;
                                            }
                                            return (
                                                <td key={day} className="text-center py-2.5 px-3">
                                                    <span className="font-bold text-slate-700">{cell.total}</span>
                                                    {Object.keys(cell.byCategory).length > 0 && (
                                                        <div className="mt-0.5">
                                                            {Object.entries(cell.byCategory).map(([cat, count]) => (
                                                                <span key={cat} className="block text-xs text-slate-400 truncate" title={cat}>
                                                                    {count}x {cat.length > 15 ? cat.slice(0, 15) + '...' : cat}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </td>
                                            );
                                        })}
                                        <td className="text-center py-2.5 px-3">
                                            <span className="font-bold text-indigo-600">{surgeonTotal}</span>
                                        </td>
                                    </tr>
                                );
                            })}

                            {/* Unassigned row */}
                            <tr className="border-t border-slate-200 bg-amber-50/30">
                                <td className="py-2.5 px-3 text-sm font-bold text-amber-700 italic">Non assignés</td>
                                {DAYS.map(day => {
                                    const dayRecords = records.filter(r => r.planning_day === day);
                                    const unassigned = dayRecords.filter(r => r.assignedSurgeonIds.length === 0).length;
                                    return (
                                        <td key={day} className="text-center py-2.5 px-3">
                                            {unassigned > 0
                                                ? <span className="font-bold text-amber-600">{unassigned}</span>
                                                : <span className="text-slate-300">—</span>
                                            }
                                        </td>
                                    );
                                })}
                                <td className="text-center py-2.5 px-3">
                                    <span className="font-bold text-amber-600">
                                        {records.filter(r => DAYS.includes(r.planning_day) && r.assignedSurgeonIds.length === 0).length}
                                    </span>
                                </td>
                            </tr>

                            {/* Totals row */}
                            <tr className="border-t-2 border-slate-300 font-bold">
                                <td className="py-2.5 px-3 text-slate-800">Total</td>
                                {DAYS.map(day => (
                                    <td key={day} className="text-center py-2.5 px-3 text-indigo-700">
                                        {dayTotals[day].total}
                                    </td>
                                ))}
                                <td className="text-center py-2.5 px-3 text-indigo-700">
                                    {DAYS.reduce((sum, day) => sum + dayTotals[day].total, 0)}
                                </td>
                            </tr>
                        </tbody>
                    </table>

                    {/* Category legend */}
                    {allCategories.size > 0 && (
                        <div className="mt-4 pt-3 border-t border-slate-100">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Catégories de diagnostic</p>
                            <div className="flex flex-wrap gap-2">
                                {Array.from(allCategories).map(cat => {
                                    const count = records.filter(r => (r.diagnosis_category || r.clinical_diagnosis) === cat && DAYS.includes(r.planning_day)).length;
                                    return (
                                        <span key={cat} className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-600">
                                            {cat} ({count})
                                        </span>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
