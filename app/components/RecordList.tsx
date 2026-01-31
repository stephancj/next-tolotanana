'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { db, MedicalRecord } from '@/lib/client-db';
import { useState, useEffect } from 'react';

interface RecordListProps {
    onBack: () => void;
    onEdit?: (record: MedicalRecord) => void;
}

export default function RecordList({ onBack, onEdit }: RecordListProps) {
    const [activeTab, setActiveTab] = useState<'local' | 'remote'>('local');
    const [remoteRecords, setRemoteRecords] = useState<MedicalRecord[]>([]);
    const [remoteLoading, setRemoteLoading] = useState(false);

    // Local Records
    const localRecords = useLiveQuery<MedicalRecord[]>(
        () => db.medical_records
            .filter(r => r.deleted !== 1)
            .reverse()
            .sortBy('created_at')
    );

    // Fetch Remote Records
    useEffect(() => {
        if (activeTab === 'remote') {
            setRemoteLoading(true);
            fetch('/api/records')
                .then(res => res.json())
                .then(data => {
                    setRemoteRecords(data);
                    setRemoteLoading(false);
                })
                .catch(err => {
                    console.error("Failed to fetch remote records", err);
                    setRemoteLoading(false);
                });
        }
    }, [activeTab]);

    const displayRecords = activeTab === 'local' ? (localRecords || []) : remoteRecords;
    const loading = activeTab === 'local' ? !localRecords : remoteLoading;

    const deleteRecord = async (id: number, name: string) => {
        if (window.confirm(`Voulez-vous vraiment supprimer le dossier de ${name} ?`)) {
            try {
                await db.medical_records.update(id, {
                    deleted: 1,
                    sync_status: 'pending_delete',
                    updated_at: new Date().toISOString()
                });
            } catch (error) {
                console.error("Failed to delete record:", error);
                alert("Erreur lors de la suppression.");
            }
        }
    };

    const downloadCSV = () => {
        // ... (Keep existing CSV logic but apply to displayRecords)
        const headers = [
            "N° Dossier", "Nom", "Prénom", "Date Naissance", "Âge", "Genre",
            "Téléphone", "Adresse", "Poids", "Taille", "IMC", "Tension",
            "Température", "Fréquence Cardiaque", "Respiratoire", "Saturation O2",
            "Diagnostic Clinique", "Type Intervention", "Observation Chir", "À Programmer",
            "Antécédents", "Autres Antécédents", "Score ASA", "Type Anesthésie",
            "Observation Pré-Anesth", "Chemin Image", "Date Ajout"
        ];

        const csvContent = [
            headers.join(','),
            ...displayRecords.map(r => {
                const antecedents = [
                    r.history_diabetes ? 'Diabète' : null,
                    r.history_hypertension ? 'Hypertension' : null,
                    r.history_asthma ? 'Asthme' : null,
                    r.history_cardiopathy ? 'Cardiopathie' : null,
                    r.history_none ? 'Aucun connu' : null
                ].filter(Boolean).join('; ');

                const phone = [r.phone1, r.phone2].filter(Boolean).join(' / ');
                const gender = r.gender === 'M' ? 'Masculin' : r.gender === 'F' ? 'Féminin' : r.gender;
                const programmed = r.program_mission ? 'Oui' : 'Non';
                const createdDate = new Date(r.created_at).toISOString().replace('T', ' ').substring(0, 16);

                return [
                    `"${r.dossier_number || ''}"`,
                    `"${r.last_name || ''}"`,
                    `"${r.first_name || ''}"`,
                    `"${r.dob || ''}"`,
                    r.age,
                    `"${gender || ''}"`,
                    `"${phone}"`,
                    `"${r.address || ''}"`,
                    r.weight,
                    r.height,
                    r.bmi,
                    `"${r.blood_pressure || ''}"`,
                    r.temperature,
                    r.heart_rate,
                    r.respiratory_rate,
                    r.spo2,
                    `"${(r.clinical_diagnosis || '').replace(/"/g, '""')}"`,
                    `"${(r.intervention_type || '').replace(/"/g, '""')}"`,
                    `"${(r.observation || '').replace(/"/g, '""')}"`,
                    `"${programmed}"`,
                    `"${antecedents}"`,
                    `"${(r.history_others || '').replace(/"/g, '""')}"`,
                    r.asa_score,
                    `"${r.anesthesia_type || ''}"`,
                    `"${(r.anesthesia_observation || '').replace(/"/g, '""')}"`,
                    `"${r.photo_url || 'Aucune image'}"`,
                    `"${createdDate}"`
                ].join(',');
            })
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `medical_records_${activeTab}_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="w-full max-w-5xl mx-auto p-4 pb-24">
            <div className="flex justify-between items-center mb-6">
                <button onClick={onBack} className="px-4 py-2 bg-white rounded-lg shadow-sm text-purple-600 font-bold flex items-center gap-2 hover:bg-gray-50 transition">
                    ← Retour au formulaire
                </button>
                <div className="flex gap-2">
                    <button onClick={downloadCSV} className="px-4 py-2 bg-green-600 text-white rounded-lg shadow-md hover:bg-green-700 transition font-bold flex items-center gap-2">
                        📥 Exporter CSV ({activeTab})
                    </button>
                </div>
            </div>

            <div className="flex gap-4 mb-6 border-b border-gray-200">
                <button
                    onClick={() => setActiveTab('local')}
                    className={`pb-2 px-4 font-bold text-lg transition-colors border-b-2 ${activeTab === 'local'
                            ? 'border-indigo-600 text-indigo-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                >
                    📱 Local (SQLite)
                </button>
                <button
                    onClick={() => setActiveTab('remote')}
                    className={`pb-2 px-4 font-bold text-lg transition-colors border-b-2 ${activeTab === 'remote'
                            ? 'border-indigo-600 text-indigo-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                >
                    ☁️ Serveur (Neon)
                </button>
            </div>

            <h2 className="text-2xl font-bold mb-6 text-gray-800">
                {activeTab === 'local' ? "Liste des Patients (Hors ligne)" : "Liste des Patients (Sauvegardés)"}
            </h2>

            {loading ? (
                <div className="flex justify-center p-12 text-gray-400">Chargement...</div>
            ) : (
                <div className="grid gap-4">
                    {displayRecords.map((r, idx) => (
                        <div key={r.id || idx} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col sm:flex-row justify-between sm:items-center hover:shadow-md transition cursor-pointer">
                            <div className="mb-2 sm:mb-0">
                                <div className="font-bold text-xl text-gray-800">{r.last_name || 'Inconnu'} {r.first_name}</div>
                                <div className="text-sm text-gray-500 flex gap-3 mt-1">
                                    <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded text-xs font-semibold">Dossier: {r.dossier_number || 'N/A'}</span>
                                    <span>Âge: {r.age || '?'} ans</span>
                                    {activeTab === 'local' && r.sync_status === 'synced' && (
                                        <span className="text-green-600 flex items-center gap-1">✅ Synchronisé</span>
                                    )}
                                    {activeTab === 'local' && r.sync_status !== 'synced' && (
                                        <span className="text-orange-500 flex items-center gap-1">⏳ En attente</span>
                                    )}
                                </div>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                                <div className={`px-3 py-1 rounded-full text-xs font-bold ${r.program_mission ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                                    {r.program_mission ? 'Mission: OUI' : 'Mission: NON'}
                                </div>
                                <div className="text-xs text-gray-400 mb-1">
                                    {new Date(r.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                                </div>
                                {activeTab === 'local' && (
                                    <div className="flex gap-2">
                                        {onEdit && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); onEdit(r); }}
                                                className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-sm font-bold hover:bg-indigo-100 transition"
                                            >
                                                Voir / Modifier
                                            </button>
                                        )}
                                        <button
                                            onClick={(e) => { e.stopPropagation(); if (r.id) deleteRecord(r.id, r.last_name); }}
                                            className="px-3 py-1 bg-red-50 text-red-600 rounded-lg text-sm font-bold hover:bg-red-100 transition"
                                        >
                                            Supprimer
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                    {displayRecords.length === 0 && (
                        <div className="text-center text-gray-500 p-12 bg-white rounded-2xl border border-dashed border-gray-300">
                            {activeTab === 'local'
                                ? "Aucun dossier local. Commencez par en créer un."
                                : "Aucun dossier sur le serveur."}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
