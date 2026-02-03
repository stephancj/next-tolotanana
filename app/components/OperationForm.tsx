'use client';

import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { MedicalRecord, db } from '@/lib/client-db';

interface OperationFormProps {
    record: MedicalRecord;
    onBack: () => void;
    onSuccess: () => void;
}

const Icons = {
    Activity: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>,
    Save: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
};

export default function OperationForm({ record, onBack, onSuccess }: OperationFormProps) {
    const [formData, setFormData] = useState({
        pre_op_checked: record.pre_op_checked || 0,
        pre_op_checked_at: record.pre_op_checked_at || '',
        block_entry_time: record.block_entry_time || '',
        block_exit_time: record.block_exit_time || '',
        intervention_details: record.intervention_details || '',
        diagnosis_category: record.diagnosis_category || ''
    });

    const [assignedSurgeonIds, setAssignedSurgeonIds] = useState<number[]>([]);
    const [loading, setLoading] = useState(false);

    // Fetch active surgeons from local DB
    const availableSurgeons = useLiveQuery(() => db.surgeons.where('is_active').equals(1).toArray()) || [];

    useEffect(() => {
        // Fetch assigned surgeons for this record
        const fetchAssigned = async () => {
            if (!record.id) return;
            try {
                const links = await db.record_surgeons
                    .where('medical_record_id')
                    .equals(record.id)
                    .toArray();
                setAssignedSurgeonIds(links.map(l => l.surgeon_id));
            } catch (err) {
                console.error("Failed to fetch assigned surgeons", err);
            }
        };
        fetchAssigned();
    }, [record.id]);

    const toggleSurgeon = (surgeonId: number) => {
        setAssignedSurgeonIds(prev =>
            prev.includes(surgeonId)
                ? prev.filter(id => id !== surgeonId)
                : [...prev, surgeonId]
        );
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async () => {
        if (!record.id) return;

        setLoading(true);
        try {
            // Update medical record with operation data
            await db.medical_records.update(record.id, {
                ...formData,
                sync_status: 'pending_update',
                updated_at: new Date().toISOString()
            });

            // Update surgeon assignments
            const existingLinks = await db.record_surgeons.where('medical_record_id').equals(record.id).toArray();
            const existingIds = existingLinks.map(l => l.id!);
            await db.record_surgeons.bulkDelete(existingIds);

            const newLinks = assignedSurgeonIds.map(sid => ({
                medical_record_id: record.id!,
                surgeon_id: sid,
                sync_status: 'pending_update' as const
            }));
            if (newLinks.length > 0) {
                await db.record_surgeons.bulkAdd(newLinks);
            }

            alert('✓ Données du bloc enregistrées avec succès');
            onSuccess();
        } catch (err) {
            console.error('Error saving operation data:', err);
            alert('Erreur lors de l\'enregistrement');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 pb-24">
            {/* Header */}
            <header className="bg-white/90 backdrop-blur-xl sticky top-0 z-40 border-b border-blue-100 shadow-lg">
                <div className="max-w-[1400px] mx-auto px-6 py-5">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-lg">
                                <Icons.Activity />
                            </div>
                            <div>
                                <h2 className="text-xs font-bold text-blue-500 tracking-[0.2em] uppercase mb-1">Bloc Opératoire</h2>
                                <h1 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">
                                    {record.last_name} {record.first_name}
                                </h1>
                                <p className="text-sm text-slate-500 mt-0.5">
                                    {record.intervention_type || 'Intervention'} • {record.planning_day}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={onBack}
                            className="px-6 py-3 bg-white text-slate-700 rounded-xl font-bold hover:bg-slate-50 transition-all border border-slate-200 shadow-sm hover:shadow flex items-center gap-2"
                        >
                            <span>←</span> Retour
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-[1400px] mx-auto p-4 md:p-8 lg:p-10">
                {/* Patient Info Summary - Compact Card */}
                <div className="bg-white rounded-2xl p-6 mb-8 border border-blue-100 shadow-sm">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 text-lg">📋</div>
                            <div>
                                <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Dossier</p>
                                <p className="text-base font-bold text-slate-800">{record.dossier_number || 'N/A'}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600 text-lg">👤</div>
                            <div>
                                <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Âge</p>
                                <p className="text-base font-bold text-slate-800">{record.age} ans</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center text-green-600 text-lg">🩺</div>
                            <div>
                                <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Diagnostic</p>
                                <p className="text-base font-bold text-slate-800 truncate">{record.clinical_diagnosis || 'N/A'}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center text-orange-600 text-lg">⚕️</div>
                            <div>
                                <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Type</p>
                                <p className="text-base font-bold text-slate-800 truncate">{record.intervention_type || 'N/A'}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Two Column Layout for Desktop/Tablet */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                    {/* Left Column - Operation Details */}
                    <div className="space-y-6">
                        {/* Pre-Op Check */}
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                                <span className="text-green-600">✓</span> Vérification Pré-Opératoire
                            </h3>
                            <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-5 border-2 border-green-200">
                                <label className="flex items-start gap-4 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={formData.pre_op_checked === 1}
                                        onChange={(e) => {
                                            const isChecked = e.target.checked;
                                            setFormData(prev => ({
                                                ...prev,
                                                pre_op_checked: isChecked ? 1 : 0,
                                                pre_op_checked_at: isChecked ? new Date().toISOString() : ''
                                            }));
                                        }}
                                        className="w-6 h-6 rounded-lg border-2 border-green-400 text-green-600 focus:ring-2 focus:ring-green-500 mt-1"
                                    />
                                    <div className="flex-1">
                                        <p className="text-base font-bold text-green-800">Patient vérifié et prêt pour le bloc</p>
                                        {formData.pre_op_checked === 1 && formData.pre_op_checked_at && (
                                            <p className="text-sm text-green-600 mt-2 flex items-center gap-2">
                                                <span>🕐</span>
                                                Vérifié le {new Date(formData.pre_op_checked_at).toLocaleString('fr-FR', {
                                                    day: '2-digit',
                                                    month: '2-digit',
                                                    year: 'numeric',
                                                    hour: '2-digit',
                                                    minute: '2-digit'
                                                })}
                                            </p>
                                        )}
                                    </div>
                                </label>
                            </div>
                        </div>

                        {/* Times */}
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                                <span className="text-blue-600">🕐</span> Horaires du Bloc
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">
                                        Heure d&apos;entrée
                                    </label>
                                    <input
                                        type="time"
                                        name="block_entry_time"
                                        value={formData.block_entry_time}
                                        onChange={handleChange}
                                        className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-lg font-semibold text-slate-700"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">
                                        Heure de sortie
                                    </label>
                                    <input
                                        type="time"
                                        name="block_exit_time"
                                        value={formData.block_exit_time}
                                        onChange={handleChange}
                                        className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-lg font-semibold text-slate-700"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Diagnosis Category */}
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                                <span className="text-purple-600">🏥</span> Catégorie Diagnostique
                            </h3>
                            <input
                                type="text"
                                name="diagnosis_category"
                                value={formData.diagnosis_category}
                                onChange={handleChange}
                                placeholder="Ex: Orthopédie, Chirurgie générale..."
                                className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all font-medium text-slate-700"
                            />
                        </div>
                    </div>

                    {/* Right Column - Intervention Details & Team */}
                    <div className="space-y-6">
                        {/* Intervention Details */}
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                                <span className="text-indigo-600">📝</span> Détails de l&apos;Intervention
                            </h3>
                            <textarea
                                name="intervention_details"
                                value={formData.intervention_details}
                                onChange={handleChange}
                                rows={8}
                                placeholder="Décrivez les gestes effectués, prothèses utilisées, complications éventuelles, observations particulières..."
                                className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none transition-all font-medium text-slate-700 leading-relaxed"
                            />
                        </div>

                        {/* Surgeons Assignment */}
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                                <span className="text-emerald-600">👨‍⚕️</span> Équipe Chirurgicale
                            </h3>

                            {availableSurgeons.length === 0 ? (
                                <div className="text-center py-8 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
                                    <p className="text-slate-400 font-medium">Aucun chirurgien disponible</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {availableSurgeons.map(surgeon => (
                                        <div
                                            key={surgeon.id}
                                            onClick={() => toggleSurgeon(surgeon.id!)}
                                            className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex items-center gap-3 ${assignedSurgeonIds.includes(surgeon.id!)
                                                    ? 'border-emerald-500 bg-emerald-50 shadow-sm'
                                                    : 'border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300'
                                                }`}
                                        >
                                            <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center flex-shrink-0 ${assignedSurgeonIds.includes(surgeon.id!)
                                                    ? 'bg-emerald-500 border-emerald-500'
                                                    : 'border-slate-300 bg-white'
                                                }`}>
                                                {assignedSurgeonIds.includes(surgeon.id!) && (
                                                    <span className="text-white text-sm font-bold">✓</span>
                                                )}
                                            </div>
                                            <div className="flex-1">
                                                <p className={`font-bold text-base ${assignedSurgeonIds.includes(surgeon.id!)
                                                        ? 'text-emerald-900'
                                                        : 'text-slate-800'
                                                    }`}>
                                                    {surgeon.name}
                                                </p>
                                                <p className={`text-sm ${assignedSurgeonIds.includes(surgeon.id!)
                                                        ? 'text-emerald-700'
                                                        : 'text-slate-500'
                                                    }`}>
                                                    {surgeon.specialty}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </main>

            {/* Floating Save Button */}
            <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50">
                <button
                    onClick={handleSubmit}
                    disabled={loading}
                    className="px-10 py-5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-2xl shadow-2xl font-bold transition-all flex items-center gap-3 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-lg"
                >
                    {loading ? (
                        <>
                            <span className="animate-spin text-xl">⏳</span>
                            <span>Enregistrement en cours...</span>
                        </>
                    ) : (
                        <>
                            <Icons.Save />
                            <span>Enregistrer les données du bloc</span>
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}
