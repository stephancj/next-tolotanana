'use client';

import { useState } from 'react';
import { X, Check } from 'lucide-react';
import { PatientCardData, SurgeonData } from '@/lib/planning-utils';

interface SurgeonAssignPopoverProps {
    patient: PatientCardData;
    editionSurgeons: SurgeonData[];
    onSave: (patientId: number, surgeonIds: number[]) => void;
    onClose: () => void;
}

export default function SurgeonAssignPopover({
    patient,
    editionSurgeons,
    onSave,
    onClose,
}: SurgeonAssignPopoverProps) {
    const [selectedIds, setSelectedIds] = useState<Set<number>>(
        new Set(patient.assignedSurgeonIds)
    );

    const toggleSurgeon = (id: number) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleSave = () => {
        onSave(patient.id, Array.from(selectedIds));
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={onClose}>
            <div
                role="dialog" aria-modal="true" aria-labelledby="assign-surgeon-title"
                className="bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                    <div>
                        <h3 id="assign-surgeon-title" className="text-sm font-bold text-slate-800">Assigner chirurgien(s)</h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                            {patient.last_name} {patient.first_name} — #{patient.dossier_number}
                        </p>
                    </div>
                    <button onClick={onClose} aria-label="Fermer" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600">
                        <X size={18} />
                    </button>
                </div>

                {/* Surgeon list */}
                <div className="p-4 space-y-2 max-h-[300px] overflow-y-auto">
                    {editionSurgeons.length === 0 ? (
                        <p className="text-sm text-slate-400 text-center py-4">
                            Aucun chirurgien dans cette édition
                        </p>
                    ) : (
                        editionSurgeons.map(surgeon => {
                            const isChecked = selectedIds.has(surgeon.id);
                            return (
                                <button
                                    key={surgeon.id}
                                    onClick={() => toggleSurgeon(surgeon.id)}
                                    className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${
                                        isChecked
                                            ? 'border-emerald-300 bg-emerald-50'
                                            : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50'
                                    }`}
                                >
                                    <div className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 ${
                                        isChecked ? 'bg-emerald-500 text-white' : 'bg-slate-100'
                                    }`}>
                                        {isChecked && <Check size={14} />}
                                    </div>
                                    <div>
                                        <span className={`text-sm font-bold ${isChecked ? 'text-emerald-800' : 'text-slate-700'}`}>
                                            {surgeon.name}
                                        </span>
                                        {surgeon.specialty && (
                                            <span className="text-xs text-slate-400 ml-2">{surgeon.specialty}</span>
                                        )}
                                    </div>
                                </button>
                            );
                        })
                    )}
                </div>

                {/* Footer */}
                <div className="px-5 py-3 border-t border-slate-100 flex justify-end gap-2">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-bold text-slate-600 rounded-xl hover:bg-slate-100 transition"
                    >
                        Annuler
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-4 py-2 text-sm font-bold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 transition shadow-sm"
                    >
                        Confirmer
                    </button>
                </div>
            </div>
        </div>
    );
}
