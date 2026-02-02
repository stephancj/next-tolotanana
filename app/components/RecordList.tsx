'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { db, MedicalRecord, Edition } from '@/lib/client-db';
import { useState, useEffect, useCallback } from 'react';
import { getAgeValue } from '@/lib/age-utils';
import { useSync } from '../hooks/useSync';
import AdvancedSearch, { FilterCriterion } from './AdvancedSearch';
import PatientDetailModal from './PatientDetailModal';

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
    const [isAdvancedSearchOpen, setIsAdvancedSearchOpen] = useState(false);
    const [advancedFilters, setAdvancedFilters] = useState<FilterCriterion[]>([]);
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

    // Filter records based on search query or advanced filters
    const filterRecords = (records: MedicalRecord[]) => {
        let filtered = records;

        // 1. Filter by Edition (Already done for local, but ensure consistency)
        if (currentEditionId) {
            filtered = filtered.filter(r => r.edition_id === currentEditionId);
        }

        // 2. Advanced Filters OR Simple Search
        if (isAdvancedSearchOpen && advancedFilters.length > 0) {
            filtered = filtered.filter(record => {
                // Determine logic: Default AND (every)
                return advancedFilters.every(filter => {
                    if (!filter.value) return true; // Ignore empty values

                    // Get value to check
                    const recordValue = filter.field === 'all'
                        ? Object.values(record).join(' ').toLowerCase()
                        : String(record[filter.field as keyof MedicalRecord] || '').toLowerCase();

                    const filterValue = filter.value.toLowerCase();

                    // Check operator
                    switch (filter.operator) {
                        case 'contains': return recordValue.includes(filterValue);
                        case 'equals': return recordValue === filterValue;
                        case 'starts_with': return recordValue.startsWith(filterValue);
                        case 'ends_with': return recordValue.endsWith(filterValue);
                        case 'gt':
                            const numRec = parseFloat(recordValue);
                            const numFilt = parseFloat(filterValue);
                            return !isNaN(numRec) && !isNaN(numFilt) && numRec > numFilt;
                        case 'lt':
                            const numRecLt = parseFloat(recordValue);
                            const numFiltLt = parseFloat(filterValue);
                            return !isNaN(numRecLt) && !isNaN(numFiltLt) && numRecLt < numFiltLt;
                        default: return true;
                    }
                });
            });
        } else if (searchQuery) {
            const query = searchQuery.toLowerCase();
            return filtered.filter(r =>
                r.last_name?.toLowerCase().includes(query) ||
                r.first_name?.toLowerCase().includes(query) ||
                r.dossier_number?.toLowerCase().includes(query) ||
                r.address?.toLowerCase().includes(query) ||
                r.distance?.toLowerCase().includes(query)
            );
        }

        return filtered;
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
                        <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
                            <img src="/logo.png" alt="Logo" className="w-8 h-8 object-contain" />
                            Liste des Patients
                        </h1>
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

            {/* SEARCH AREA */}
            <div className="mb-6">
                {!isAdvancedSearchOpen ? (
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
                            <input
                                type="text"
                                placeholder="Rechercher (Nom, Prénom, Dossier, Adresse...)"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none shadow-sm transition-all"
                            />
                        </div>
                        <button
                            onClick={() => setIsAdvancedSearchOpen(true)}
                            className="bg-white px-4 py-3 rounded-xl border border-gray-200 text-gray-600 font-bold hover:bg-gray-50 flex items-center gap-2 hover:border-indigo-300 transition-all"
                        >
                            <span>⚡</span> <span className="hidden sm:inline">Filtres</span>
                        </button>
                    </div>
                ) : (
                    <AdvancedSearch
                        isOpen={isAdvancedSearchOpen}
                        onClose={() => setIsAdvancedSearchOpen(false)}
                        onFilterChange={setAdvancedFilters}
                    />
                )}
            </div>

            {/* TABS & COUNTERS */}
            {/* RESULT COUNT */}
            <div className="mb-4 text-sm text-gray-500 font-medium px-1">
                {displayRecords.length} résultat{displayRecords.length > 1 ? 's' : ''} trouvé{displayRecords.length > 1 ? 's' : ''}
            </div>

            <h2 className="text-2xl font-bold mb-6 text-gray-800">
                {activeTab === 'local' ? "Liste des Patients (Hors ligne)" : "Liste des Patients (Sauvegardés)"}
            </h2>

            {
                loading ? (
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
                                        <SortableHeader field="last_name" label="Patient" onSort={handleSort} currentField={sortField} direction={sortDirection} />
                                        {/* First name combined */}
                                        <SortableHeader field="age" label="Âge" onSort={handleSort} currentField={sortField} direction={sortDirection} />
                                        {/* Gender removed */}
                                        {/* Address removed */}
                                        <SortableHeader field="distance" label="Distance" onSort={handleSort} currentField={sortField} direction={sortDirection} />
                                        <SortableHeader field="clinical_diagnosis" label="Diagnostic" onSort={handleSort} currentField={sortField} direction={sortDirection} />
                                        {/* Mission removed */}
                                        <SortableHeader field="planning_day" label="Jour Prévu" onSort={handleSort} currentField={sortField} direction={sortDirection} />
                                        {activeTab === 'local' && <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Statut</th>}
                                        {/* Date removed */}
                                        <th className="px-4 py-3 text-right text-xs font-bold text-gray-600 uppercase tracking-wider sticky right-0 bg-gradient-to-r from-indigo-50 to-purple-50">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {displayRecords.map((r, idx) => (
                                        <tr key={r.id || idx} className="hover:bg-indigo-50/30 transition-colors">
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <div className="flex items-center gap-2">
                                                    <span className={`w-2 h-2 rounded-full ${r.program_mission ? 'bg-green-500' : 'bg-red-300'}`} title={r.program_mission ? 'Programmé' : 'Non programmé'}></span>
                                                    <span className={`px-2 py-1 rounded text-xs font-semibold ${r.gender === 'M' ? 'bg-blue-100 text-blue-700' :
                                                        r.gender === 'F' ? 'bg-pink-100 text-pink-700' :
                                                            'bg-gray-100 text-gray-700'
                                                        }`}>
                                                        {r.dossier_number || 'N/A'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-gray-800 uppercase text-sm leading-tight">{r.last_name || 'Inconnu'}</span>
                                                    <span className="text-xs text-gray-500">{r.first_name || ''}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <AgeDisplay age={r.age} />
                                            </td>
                                            {/* Gender removed */}
                                            {/* Address removed */}
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
                                            {/* Mission removed */}
                                            <td className="px-4 py-3 text-center">
                                                {!r.program_mission ? (
                                                    <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-bold whitespace-nowrap">
                                                        NON
                                                    </span>
                                                ) : r.planning_day ? (
                                                    <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded text-xs font-bold whitespace-nowrap">
                                                        {r.planning_day}
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-300">-</span>
                                                )}
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
                                            {/* Date removed */}
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
                )
            }

            {/* Modal de détails */}
            {/* Modal de détails */}
            {selectedRecord && (
                <PatientDetailModal
                    record={selectedRecord}
                    onClose={() => setSelectedRecord(null)}
                />
            )}
        </div >
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



