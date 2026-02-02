'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { db, MedicalRecord, Edition } from '@/lib/client-db';
import { useState, useEffect, useCallback } from 'react';
import { getAgeValue } from '@/lib/age-utils';
import { useSync } from '../hooks/useSync';

interface RecordListProps {
    onBack: () => void;
    onEdit?: (record: MedicalRecord) => void;
    currentEditionId?: number;
    edition?: Edition | null;
    onChangeEdition?: () => void;
}

// Helper component to display age with color-coded badges
const AgeDisplay = ({ age }: { age: string | number }) => {
    const ageStr = String(age || '?');

    // Determine color based on unit
    let bgColor = 'bg-gray-100';
    let textColor = 'text-gray-700';

    if (ageStr.includes('semaine')) {
        bgColor = 'bg-pink-100';
        textColor = 'text-pink-700';
    } else if (ageStr.includes('mois')) {
        bgColor = 'bg-purple-100';
        textColor = 'text-purple-700';
    } else if (ageStr.includes('an')) {
        bgColor = 'bg-indigo-100';
        textColor = 'text-indigo-700';
    }

    return (
        <span className={`inline-flex items-center justify-center px-2.5 py-1 rounded-full text-xs font-semibold ${bgColor} ${textColor}`}>
            {ageStr}
        </span>
    );
};

export default function RecordList({ onBack, onEdit, currentEditionId, edition, onChangeEdition }: RecordListProps) {
    const { status, pendingCount, manualSync } = useSync();
    const [activeTab, setActiveTab] = useState<'local' | 'remote'>('local');
    const [remoteRecords, setRemoteRecords] = useState<MedicalRecord[]>([]);
    const [remoteLoading, setRemoteLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedRecord, setSelectedRecord] = useState<MedicalRecord | null>(null);
    const [sortField, setSortField] = useState<keyof MedicalRecord>('created_at');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

    // Local Records
    const localRecords = useLiveQuery<MedicalRecord[]>(
        async () => {
            let collection = db.medical_records.filter(r => r.deleted !== 1);

            if (currentEditionId) {
                collection = collection.filter(r => r.edition_id === currentEditionId);
            }

            return collection.reverse().sortBy('created_at');
        },
        [currentEditionId]
    );

    // Fetch Remote Records function
    const fetchRemoteRecords = useCallback(async () => {
        setRemoteLoading(true);
        try {
            const res = await fetch('/api/records');
            const data = await res.json();

            // Filter by edition if selected
            const filteredData = currentEditionId
                ? data.filter((r: MedicalRecord) => r.edition_id === currentEditionId)
                : data;

            setRemoteRecords(filteredData);
        } catch (err) {
            console.error("Failed to fetch remote records", err);
        } finally {
            setRemoteLoading(false);
        }
    }, [currentEditionId]);

    // Trigger fetch when switching to remote tab
    useEffect(() => {
        if (activeTab === 'remote') {
            fetchRemoteRecords();
        }
    }, [activeTab, fetchRemoteRecords]);

    // Filter records based on search query
    const filterRecords = (records: MedicalRecord[]) => {
        if (!searchQuery) return records;

        const query = searchQuery.toLowerCase();
        return records.filter(r =>
            r.last_name?.toLowerCase().includes(query) ||
            r.first_name?.toLowerCase().includes(query) ||
            r.dossier_number?.toLowerCase().includes(query) ||
            r.address?.toLowerCase().includes(query) ||
            r.distance?.toLowerCase().includes(query)
        );
    };

    // Sort records
    const sortRecords = (records: MedicalRecord[]) => {
        return [...records].sort((a, b) => {
            const aVal = a[sortField];
            const bVal = b[sortField];

            if (aVal === undefined || aVal === null) return 1;
            if (bVal === undefined || bVal === null) return -1;

            let comparison = 0;

            // Special handling for age field
            if (sortField === 'age') {
                const aAge = getAgeValue(String(aVal));
                const bAge = getAgeValue(String(bVal));
                comparison = aAge - bAge;
            } else if (typeof aVal === 'string' && typeof bVal === 'string') {
                comparison = aVal.localeCompare(bVal);
            } else if (typeof aVal === 'number' && typeof bVal === 'number') {
                comparison = aVal - bVal;
            } else {
                comparison = String(aVal).localeCompare(String(bVal));
            }

            return sortDirection === 'asc' ? comparison : -comparison;
        });
    };

    const handleSort = (field: keyof MedicalRecord) => {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    };

    const displayRecords = sortRecords(filterRecords(activeTab === 'local' ? (localRecords || []) : remoteRecords));
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
            "Téléphone", "Adresse", "Distance", "Poids", "Taille", "IMC", "Tension",
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
                    `"${r.distance || 'non précisé'}"`,
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
        <div className="w-full max-w-[1600px] mx-auto p-4 md:p-8 pb-24">

            {/* HEADER */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 border-b border-gray-100 pb-6">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="w-10 h-10 rounded-xl bg-white border border-gray-200 text-gray-500 hover:text-indigo-600 hover:border-indigo-600 flex items-center justify-center transition-all shadow-sm">
                        ←
                    </button>
                    <div>
                        <h2 className="text-[10px] md:text-xs font-bold text-indigo-400 tracking-[0.2em] uppercase mb-1">Base de Données</h2>
                        <h1 className="text-2xl font-black text-slate-800 tracking-tight">Liste des Patients</h1>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <button onClick={downloadCSV} className="px-4 py-2 bg-emerald-50 text-emerald-700 rounded-lg shadow-sm border border-emerald-100 hover:bg-emerald-100 transition font-bold flex items-center gap-2 text-xs">
                        <span>📥</span> Exporter CSV ({activeTab})
                    </button>

                    <div className="w-px h-8 bg-gray-200 mx-2 hidden md:block"></div>

                    {/* Sync Status */}
                    <div
                        onClick={manualSync}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer hover:opacity-80 ${status === 'offline' ? 'bg-red-50 text-red-700 border-red-100' : 'bg-green-50 text-green-700 border-green-100'}`}
                        title="Cliquez pour synchroniser"
                    >
                        <span className={`w-2 h-2 rounded-full ${status === 'syncing' ? 'bg-yellow-400 animate-pulse' : status === 'offline' ? 'bg-red-500' : 'bg-green-500'}`}></span>
                        {status === 'syncing' ? 'SYNCHRO...' : status === 'offline' ? 'OFFLINE' : 'ONLINE'}
                        {pendingCount > 0 && <span className="ml-1 bg-indigo-100 text-indigo-700 px-1.5 rounded-md">{pendingCount}</span>}
                    </div>

                    {/* Edition Badge */}
                    {edition && (
                        <button
                            onClick={onChangeEdition}
                            className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold border border-indigo-100 transition-colors"
                        >
                            <span>📍 {edition.place} • {edition.year}</span>
                            <span className="text-indigo-300">|</span>
                            <span className="hidden sm:inline">{edition.name}</span>
                            <span className="ml-1 text-lg leading-none">🔄</span>
                        </button>
                    )}
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
            ) : displayRecords.length === 0 ? (
                <div className="text-center text-gray-500 p-12 bg-white rounded-2xl border border-dashed border-gray-300">
                    {activeTab === 'local'
                        ? "Aucun dossier local. Commencez par en créer un."
                        : "Aucun dossier sur le serveur."}
                </div>
            ) : (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-gray-200">
                                <tr>
                                    <SortableHeader field="dossier_number" label="N° Dossier" onSort={handleSort} currentField={sortField} direction={sortDirection} />
                                    <SortableHeader field="last_name" label="Nom" onSort={handleSort} currentField={sortField} direction={sortDirection} />
                                    <SortableHeader field="first_name" label="Prénom" onSort={handleSort} currentField={sortField} direction={sortDirection} />
                                    <SortableHeader field="age" label="Âge" onSort={handleSort} currentField={sortField} direction={sortDirection} />
                                    <SortableHeader field="gender" label="Genre" onSort={handleSort} currentField={sortField} direction={sortDirection} />
                                    <SortableHeader field="address" label="Adresse" onSort={handleSort} currentField={sortField} direction={sortDirection} />
                                    <SortableHeader field="distance" label="Distance" onSort={handleSort} currentField={sortField} direction={sortDirection} />
                                    <SortableHeader field="clinical_diagnosis" label="Diagnostic" onSort={handleSort} currentField={sortField} direction={sortDirection} />
                                    <SortableHeader field="program_mission" label="Mission" onSort={handleSort} currentField={sortField} direction={sortDirection} />
                                    {activeTab === 'local' && <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Statut</th>}
                                    <SortableHeader field="created_at" label="Date" onSort={handleSort} currentField={sortField} direction={sortDirection} />
                                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-600 uppercase tracking-wider sticky right-0 bg-gradient-to-r from-indigo-50 to-purple-50">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {displayRecords.map((r, idx) => (
                                    <tr key={r.id || idx} className="hover:bg-indigo-50/30 transition-colors">
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-semibold">
                                                {r.dossier_number || 'N/A'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 font-bold text-gray-800">{r.last_name || 'Inconnu'}</td>
                                        <td className="px-4 py-3 text-gray-700">{r.first_name || '-'}</td>
                                        <td className="px-4 py-3 text-center">
                                            <AgeDisplay age={r.age} />
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`inline-block w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${r.gender === 'M' ? 'bg-blue-100 text-blue-700' :
                                                r.gender === 'F' ? 'bg-pink-100 text-pink-700' :
                                                    'bg-gray-100 text-gray-600'
                                                }`}>
                                                {r.gender === 'M' ? '♂' : r.gender === 'F' ? '♀' : '?'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-gray-600 max-w-xs truncate" title={r.address}>
                                            {r.address || '-'}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${r.distance === 'en ville' ? 'bg-green-100 text-green-700' :
                                                r.distance === 'un peu loin' ? 'bg-yellow-100 text-yellow-700' :
                                                    r.distance === 'loin' ? 'bg-orange-100 text-orange-700' :
                                                        'bg-gray-100 text-gray-600'
                                                }`}>
                                                {r.distance || 'non précisé'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-gray-600 max-w-xs truncate" title={r.clinical_diagnosis}>
                                            {r.clinical_diagnosis || '-'}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${r.program_mission ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                                                }`}>
                                                {r.program_mission ? 'OUI' : 'NON'}
                                            </span>
                                        </td>
                                        {activeTab === 'local' && (
                                            <td className="px-4 py-3 text-center">
                                                {r.sync_status === 'synced' ? (
                                                    <span className="text-green-600 flex items-center justify-center gap-1 text-xs">
                                                        <span className="inline-block w-2 h-2 bg-green-500 rounded-full"></span>
                                                        Sync
                                                    </span>
                                                ) : (
                                                    <span className="text-orange-500 flex items-center justify-center gap-1 text-xs">
                                                        <span className="inline-block w-2 h-2 bg-orange-500 rounded-full animate-pulse"></span>
                                                        En attente
                                                    </span>
                                                )}
                                            </td>
                                        )}
                                        <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                                            {new Date(r.created_at).toLocaleDateString('fr-FR', {
                                                day: '2-digit',
                                                month: '2-digit',
                                                year: 'numeric'
                                            })}
                                        </td>
                                        <td className="px-4 py-3 text-right whitespace-nowrap sticky right-0 bg-white">
                                            <div className="flex gap-1 justify-end">
                                                {activeTab === 'remote' && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setSelectedRecord(r); }}
                                                        className="p-2 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold hover:bg-blue-100 transition"
                                                        title="Voir les détails"
                                                    >
                                                        �️
                                                    </button>
                                                )}
                                                {onEdit && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); onEdit(r); }}
                                                        className="p-2 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-bold hover:bg-indigo-100 transition"
                                                        title="Modifier"
                                                    >
                                                        ✏️
                                                    </button>
                                                )}
                                                {activeTab === 'local' && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); if (r.id) deleteRecord(r.id, r.last_name); }}
                                                        className="p-2 bg-red-50 text-red-600 rounded-lg text-xs font-bold hover:bg-red-100 transition"
                                                        title="Supprimer"
                                                    >
                                                        🗑️
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
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
                                    <div className="flex flex-col">
                                        <span className="text-xs font-semibold text-gray-500 mb-1">Âge</span>
                                        <AgeDisplay age={selectedRecord.age} />
                                    </div>
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

// Composant pour les en-têtes triables
function SortableHeader({
    field,
    label,
    onSort,
    currentField,
    direction
}: {
    field: keyof MedicalRecord;
    label: string;
    onSort: (field: keyof MedicalRecord) => void;
    currentField: keyof MedicalRecord;
    direction: 'asc' | 'desc';
}) {
    const isActive = currentField === field;

    return (
        <th
            className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-indigo-100 transition-colors select-none"
            onClick={() => onSort(field)}
        >
            <div className="flex items-center gap-1">
                <span>{label}</span>
                <span className="text-gray-400">
                    {isActive ? (
                        direction === 'asc' ? '↑' : '↓'
                    ) : (
                        '↕'
                    )}
                </span>
            </div>
        </th>
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

