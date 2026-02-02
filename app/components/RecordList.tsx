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
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedRecord, setSelectedRecord] = useState<MedicalRecord | null>(null);

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

    // Filter records based on search query
    const filterRecords = (records: MedicalRecord[]) => {
        if (!searchQuery) return records;

        const query = searchQuery.toLowerCase();
        return records.filter(r =>
            r.last_name?.toLowerCase().includes(query) ||
            r.first_name?.toLowerCase().includes(query) ||
            r.dossier_number?.toLowerCase().includes(query) ||
            r.address?.toLowerCase().includes(query)
        );
    };

    const displayRecords = filterRecords(activeTab === 'local' ? (localRecords || []) : remoteRecords);
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
                    className={`pb-2 px-4 font-bold text-lg transition-colors border-b-2 flex items-center gap-2 ${activeTab === 'local'
                        ? 'border-indigo-600 text-indigo-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                >
                    <span>📱 Local (SQLite)</span>
                    <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs">
                        {localRecords?.length || 0}
                    </span>
                </button>
                <button
                    onClick={() => setActiveTab('remote')}
                    className={`pb-2 px-4 font-bold text-lg transition-colors border-b-2 flex items-center gap-2 ${activeTab === 'remote'
                        ? 'border-indigo-600 text-indigo-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                >
                    <span>☁️ Serveur (Neon)</span>
                    <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs">
                        {remoteRecords.length > 0 ? remoteRecords.length : (activeTab === 'remote' && remoteLoading ? '...' : '?')}
                    </span>
                </button>
            </div>

            {/* Search Bar */}
            <div className="mb-6">
                <div className="relative">
                    <input
                        type="text"
                        placeholder="🔍 Rechercher par nom, prénom, dossier, adresse..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full px-4 py-3 pl-12 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all shadow-sm"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 font-bold"
                        >
                            ✕
                        </button>
                    )}
                </div>
                {searchQuery && (
                    <div className="mt-2 text-sm text-gray-500">
                        {displayRecords.length} résultat{displayRecords.length > 1 ? 's' : ''} trouvé{displayRecords.length > 1 ? 's' : ''}
                    </div>
                )}
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

                                <div className="flex gap-2">
                                    {activeTab === 'local' ? (
                                        <>
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
                                        </>
                                    ) : (
                                        <>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setSelectedRecord(r); }}
                                                className="px-3 py-1 bg-blue-50 text-blue-600 rounded-lg text-sm font-bold hover:bg-blue-100 transition"
                                            >
                                                📋 Détails
                                            </button>
                                            {onEdit && (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); onEdit(r); }}
                                                    className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-sm font-bold hover:bg-indigo-100 transition"
                                                >
                                                    ✏️ Modifier
                                                </button>
                                            )}
                                        </>
                                    )}
                                </div>
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

            {/* Modal de détails */}
            {selectedRecord && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedRecord(null)}>
                    <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                        <div className="sticky top-0 bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6 rounded-t-2xl">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h2 className="text-2xl font-bold">{selectedRecord.last_name} {selectedRecord.first_name}</h2>
                                    <p className="text-indigo-100 mt-1">Dossier: {selectedRecord.dossier_number || 'N/A'}</p>
                                </div>
                                <button
                                    onClick={() => setSelectedRecord(null)}
                                    className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition"
                                >
                                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* Informations personnelles */}
                            <div>
                                <h3 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
                                    <span className="text-indigo-600">👤</span> Informations Personnelles
                                </h3>
                                <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-xl">
                                    <DetailItem label="Date de naissance" value={selectedRecord.dob} />
                                    <DetailItem label="Âge" value={`${selectedRecord.age || '?'} ans`} />
                                    <DetailItem label="Genre" value={selectedRecord.gender === 'M' ? 'Masculin' : selectedRecord.gender === 'F' ? 'Féminin' : selectedRecord.gender} />
                                    <DetailItem label="Téléphone" value={[selectedRecord.phone1, selectedRecord.phone2].filter(Boolean).join(' / ') || 'N/A'} />
                                    <DetailItem label="Adresse" value={selectedRecord.address} className="col-span-2" />
                                    <DetailItem label="Distance" value={selectedRecord.distance || 'non précisé'} />
                                </div>
                            </div>

                            {/* Paramètres médicaux */}
                            <div>
                                <h3 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
                                    <span className="text-red-600">❤️</span> Paramètres Médicaux
                                </h3>
                                <div className="grid grid-cols-3 gap-4 bg-gray-50 p-4 rounded-xl">
                                    <DetailItem label="Poids" value={`${selectedRecord.weight || '?'} kg`} />
                                    <DetailItem label="Taille" value={`${selectedRecord.height || '?'} cm`} />
                                    <DetailItem label="IMC" value={selectedRecord.bmi?.toString() || '?'} />
                                    <DetailItem label="Tension" value={selectedRecord.blood_pressure || 'N/A'} />
                                    <DetailItem label="Température" value={`${selectedRecord.temperature || '?'} °C`} />
                                    <DetailItem label="Pouls" value={`${selectedRecord.heart_rate || '?'} bpm`} />
                                    <DetailItem label="Resp." value={`${selectedRecord.respiratory_rate || '?'} cpm`} />
                                    <DetailItem label="SpO2" value={`${selectedRecord.spo2 || '?'} %`} />
                                </div>
                            </div>

                            {/* Consultation chirurgicale */}
                            <div>
                                <h3 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
                                    <span className="text-rose-600">🏥</span> Consultation Chirurgicale
                                </h3>
                                <div className="bg-gray-50 p-4 rounded-xl space-y-3">
                                    <DetailItem label="Diagnostic clinique" value={selectedRecord.clinical_diagnosis || 'N/A'} />
                                    <DetailItem label="Type d'intervention" value={selectedRecord.intervention_type || 'N/A'} />
                                    <DetailItem label="Observation" value={selectedRecord.observation || 'N/A'} />
                                    <DetailItem label="À programmer" value={selectedRecord.program_mission ? 'Oui' : 'Non'} />
                                </div>
                            </div>

                            {/* Antécédents */}
                            <div>
                                <h3 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
                                    <span className="text-amber-600">📋</span> Antécédents
                                </h3>
                                <div className="bg-gray-50 p-4 rounded-xl">
                                    <div className="flex flex-wrap gap-2 mb-3">
                                        {selectedRecord.history_diabetes === 1 && <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-semibold">Diabète</span>}
                                        {selectedRecord.history_hypertension === 1 && <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm font-semibold">Hypertension</span>}
                                        {selectedRecord.history_asthma === 1 && <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-semibold">Asthme</span>}
                                        {selectedRecord.history_cardiopathy === 1 && <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-semibold">Cardiopathie</span>}
                                        {selectedRecord.history_none === 1 && <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-semibold">Aucun connu</span>}
                                    </div>
                                    {selectedRecord.history_others && (
                                        <DetailItem label="Autres antécédents" value={selectedRecord.history_others} />
                                    )}
                                    <div className="grid grid-cols-2 gap-4 mt-3">
                                        <DetailItem label="Score ASA" value={selectedRecord.asa_score?.toString() || 'N/A'} />
                                        <DetailItem label="Type d'anesthésie" value={selectedRecord.anesthesia_type || 'N/A'} />
                                    </div>
                                    {selectedRecord.anesthesia_observation && (
                                        <DetailItem label="Observation anesthésie" value={selectedRecord.anesthesia_observation} className="mt-3" />
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// Composant helper pour afficher les détails
function DetailItem({ label, value, className = '' }: { label: string; value?: string | number; className?: string }) {
    return (
        <div className={className}>
            <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">{label}</div>
            <div className="text-gray-800 font-medium">{value || 'N/A'}</div>
        </div>
    );
}
