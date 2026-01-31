'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { db, MedicalRecord } from '@/lib/client-db';

interface RecordListProps {
    onBack: () => void;
    onEdit?: (record: MedicalRecord) => void;
}

export default function RecordList({ onBack, onEdit }: RecordListProps) {
    const records = useLiveQuery<MedicalRecord[]>(
        () => db.medical_records
            .filter(r => r.deleted !== 1) // Only show non-deleted records
            .reverse()
            .sortBy('created_at')
    );

    // Default to empty array if undefined
    const displayRecords = records || [];
    const loading = !records;

    const deleteRecord = async (id: number, name: string) => {
        if (window.confirm(`Voulez-vous vraiment supprimer le dossier de ${name} ?`)) {
            try {
                // Soft delete: mark as deleted and pending sync
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
        link.setAttribute('download', `medical_records_${new Date().toISOString().split('T')[0]}.csv`);
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
                <button onClick={downloadCSV} className="px-4 py-2 bg-green-600 text-white rounded-lg shadow-md hover:bg-green-700 transition font-bold flex items-center gap-2">
                    📥 Exporter CSV
                </button>
            </div>

            <h2 className="text-2xl font-bold mb-6 text-gray-800">Liste des Patients</h2>

            {loading ? (
                <div className="flex justify-center p-12 text-gray-400">Chargement...</div>
            ) : (
                <div className="grid gap-4">
                    {displayRecords.map((r) => (
                        <div key={r.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col sm:flex-row justify-between sm:items-center hover:shadow-md transition cursor-pointer">
                            <div className="mb-2 sm:mb-0">
                                <div className="font-bold text-xl text-gray-800">{r.last_name || 'Inconnu'} {r.first_name}</div>
                                <div className="text-sm text-gray-500 flex gap-3 mt-1">
                                    <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded text-xs font-semibold">Dossier: {r.dossier_number || 'N/A'}</span>
                                    <span>Âge: {r.age || '?'} ans</span>
                                </div>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                                <div className={`px-3 py-1 rounded-full text-xs font-bold ${r.program_mission === 1 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                                    {r.program_mission === 1 ? 'Mission: OUI' : 'Mission: NON'}
                                </div>
                                <div className="text-xs text-gray-400 mb-1">
                                    {new Date(r.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                                </div>
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
                            </div>
                        </div>
                    ))}
                    {displayRecords.length === 0 && (
                        <div className="text-center text-gray-500 p-12 bg-white rounded-2xl border border-dashed border-gray-300">
                            Aucun dossier trouvé. Commencez par en créer un.
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
