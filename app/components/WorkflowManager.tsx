'use client';

import { useState, useMemo, useEffect } from 'react';
import { MedicalRecord, Edition, Surgeon } from '@/lib/client-db';
import { useTranslations } from '../providers/I18nProvider';

interface WorkflowManagerProps {
    currentEdition: Edition | null;
    onBack: () => void;
}

export default function WorkflowManager({ currentEdition, onBack }: WorkflowManagerProps) {
    const [activeTab, setActiveTab] = useState<'pre-op' | 'bloc' | 'post-op'>('pre-op');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedRecordIds, setSelectedRecordIds] = useState<Set<number>>(new Set());
    const [loading, setLoading] = useState(false);


    // Bulk Data States
    const [bulkPreOpCall, setBulkPreOpCall] = useState<boolean | null>(null);
    const [bulkPreOpCheck, setBulkPreOpCheck] = useState<boolean | null>(null);
    const [bulkBlockEntry, setBulkBlockEntry] = useState('');

    // Bloc Bulk Data
    const [bulkPharmacyStatus, setBulkPharmacyStatus] = useState<string>('');
    const [bulkSurgeons, setBulkSurgeons] = useState<number[]>([]);

    // Post-Op Bulk Data
    const [bulkBlockExit, setBulkBlockExit] = useState('');
    const [bulkPostOpEntry, setBulkPostOpEntry] = useState('');
    const [bulkDischargeTime, setBulkDischargeTime] = useState('');

    const t = useTranslations('workflow');

    const [neonRecords, setNeonRecords] = useState<MedicalRecord[]>([]);
    const [surgeons, setSurgeons] = useState<Surgeon[]>([]);
    const [loadingData, setLoadingData] = useState(false);

    // Fetch Data from Neon
    useEffect(() => {
        const loadData = async () => {
            if (!currentEdition?.public_id) return;
            setLoadingData(true);
            try {
                const [recRes, edRes, surgRes] = await Promise.all([
                    fetch('/api/records'),
                    fetch('/api/editions'),
                    fetch('/api/surgeons?is_active=1')
                ]);

                if (!recRes.ok || !edRes.ok || !surgRes.ok) throw new Error("Failed to fetch data");

                const allRecords = await recRes.json();
                const allEditions = await edRes.json();
                const allSurgeons = await surgRes.json();

                setSurgeons(allSurgeons);

                // Find matching remote edition
                const remoteEdition = allEditions.find((e: Edition) => e.public_id === currentEdition.public_id);

                if (remoteEdition) {
                    const filtered = allRecords.filter((r: MedicalRecord) => r.edition_id === remoteEdition.id && !r.deleted);
                    setNeonRecords(filtered);
                } else {
                    setNeonRecords([]);
                }
            } catch (err) {
                console.error("Error loading Neon data:", err);
            } finally {
                setLoadingData(false);
            }
        };

        loadData();
    }, [currentEdition?.public_id]);

    // Reload data helper
    const reloadData = async () => {
        if (!currentEdition?.public_id) return;
        try {
            const [recRes, edRes] = await Promise.all([
                fetch('/api/records'),
                fetch('/api/editions')
            ]);
            const allRecords = await recRes.json();
            const allEditions = await edRes.json();

            const remoteEdition = allEditions.find((e: Edition) => e.public_id === currentEdition.public_id);
            if (remoteEdition) {
                const filtered = allRecords.filter((r: MedicalRecord) => r.edition_id === remoteEdition.id && !r.deleted);
                setNeonRecords(filtered);
            }
        } catch (e) {
            console.error(e);
        }
    };

    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [filterDate, setFilterDate] = useState<string>('');

    // ... (existing states)

    // Filter records
    const filteredRecords = useMemo(() => {
        const records = neonRecords || [];
        const editionRecords = records;

        // 1. Filter by Program Mission
        let result = editionRecords.filter(r => {
            return r.program_mission == 1 || String(r.program_mission) === 'true';
        });

        // 2. Filter by Date (Planning Day)
        if (filterDate) {
            result = result.filter(r => r.planning_day === filterDate);
        }

        // 3. Filter by Status
        if (filterStatus !== 'all') {
            result = result.filter(r => {
                const isPreOpChecked = Boolean(r.pre_op_checked);

                if (filterStatus === 'present_pending') {
                    // Present but not in block (pre_op_checked=true, block_entry_time=null)
                    return isPreOpChecked && !r.block_entry_time;
                }
                if (filterStatus === 'in_block') {
                    // In block but not out (block_entry_time!=null, block_exit_time=null)
                    return r.block_entry_time && !r.block_exit_time;
                }
                if (filterStatus === 'post_op') {
                    // Out of block but not discharged (block_exit_time!=null, discharge_time=null)
                    return r.block_exit_time && !r.discharge_time;
                }
                if (filterStatus === 'discharged') {
                    // Discharged (discharge_time!=null)
                    return !!r.discharge_time;
                }
                return true;
            });
        }

        // 4. Search Term
        if (searchTerm) {
            const lowerTerm = String(searchTerm).toLowerCase().trim();
            result = result.filter(r => {
                const firstName = r.first_name ? String(r.first_name).toLowerCase() : '';
                const lastName = r.last_name ? String(r.last_name).toLowerCase() : '';
                const dossier = r.dossier_number ? String(r.dossier_number).toLowerCase() : '';
                return firstName.includes(lowerTerm) || lastName.includes(lowerTerm) || dossier.includes(lowerTerm);
            });
        }

        return result;
    }, [neonRecords, searchTerm, filterDate, filterStatus]);

    // Get unique dates for filter dropdown
    const availableDates = useMemo(() => {
        const dates = new Set(neonRecords.map(r => r.planning_day).filter(Boolean));
        return Array.from(dates).sort();
    }, [neonRecords]);

    // ... (existing handlers)


    const toggleSelection = (id: number) => {
        const newSet = new Set(selectedRecordIds);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setSelectedRecordIds(newSet);
    };

    const toggleSelectAll = () => {
        if (selectedRecordIds.size === filteredRecords.length) {
            setSelectedRecordIds(new Set());
        } else {
            setSelectedRecordIds(new Set(filteredRecords.map(r => r.id!)));
        }
    };

    const handleBulkSave = async () => {
        if (selectedRecordIds.size === 0) return;
        setLoading(true);

        try {
            const updates: Record<string, any> = {
                updated_at: new Date().toISOString()
            };

            if (activeTab === 'pre-op') {
                if (bulkPreOpCall !== null) {
                    updates.pre_op_call = bulkPreOpCall ? 1 : 0;
                    updates.pre_op_call_at = bulkPreOpCall ? new Date().toISOString() : null;
                }
                if (bulkPreOpCheck !== null) {
                    updates.pre_op_checked = bulkPreOpCheck; // boolean for Neon
                    updates.pre_op_checked_at = bulkPreOpCheck ? new Date().toISOString() : null;
                }
                if (bulkBlockEntry) updates.block_entry_time = bulkBlockEntry;
            } else if (activeTab === 'bloc') {
                if (bulkPharmacyStatus) updates.pharmacy_status = bulkPharmacyStatus as 'pending' | 'retrieved' | 'none';
            } else if (activeTab === 'post-op') {
                if (bulkBlockExit) updates.block_exit_time = bulkBlockExit;
                if (bulkPostOpEntry) updates.post_op_entry_time = bulkPostOpEntry;
                if (bulkDischargeTime) updates.discharge_time = bulkDischargeTime;
            }

            // Apply updates to selected records via API
            await Promise.all(Array.from(selectedRecordIds).map(async (id) => {
                const res = await fetch('/api/records', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id, ...updates })
                });
                if (!res.ok) throw new Error(`Failed to update record ${id}`);
            }));

            // Handle Surgeon Bulk Update specifically
            if (activeTab === 'bloc' && bulkSurgeons.length > 0) {
                // For each selected record, assign surgeons
                await Promise.all(Array.from(selectedRecordIds).map(async (id) => {
                    const res = await fetch('/api/record_surgeons', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            medical_record_id: id,
                            surgeon_ids: bulkSurgeons
                        })
                    });
                    if (!res.ok) throw new Error(`Failed to assign surgeons for record ${id}`);
                }));
            }

            alert(t('alerts.success', { count: selectedRecordIds.size }));
            setSelectedRecordIds(new Set());
            // Reset bulk fields
            setBulkPreOpCall(null);
            setBulkPreOpCheck(null);

            // Reload data
            await reloadData();

        } catch (err) {
            console.error(err);
            alert(t('alerts.error'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 pb-32">
            {/* Header */}
            <header className="bg-white sticky top-0 z-40 border-b border-indigo-100 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex flex-col gap-4 py-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full text-slate-500">
                                    ←
                                </button>
                                <h1 className="text-xl font-bold text-slate-800">{t('title')}</h1>
                            </div>
                            <div className="flex bg-slate-100 p-1 rounded-lg">
                                {/* ... existing tabs ... */}
                                <button
                                    onClick={() => setActiveTab('pre-op')}
                                    className={`px-4 py-1.5 text-sm font-bold rounded-md transition-all ${activeTab === 'pre-op' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    {t('tabs.preOp')}
                                </button>
                                <button
                                    onClick={() => setActiveTab('bloc')}
                                    className={`px-4 py-1.5 text-sm font-bold rounded-md transition-all ${activeTab === 'bloc' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    {t('tabs.bloc')}
                                </button>
                                <button
                                    onClick={() => setActiveTab('post-op')}
                                    className={`px-4 py-1.5 text-sm font-bold rounded-md transition-all ${activeTab === 'post-op' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    {t('tabs.postOp')}
                                </button>
                            </div>
                        </div>

                        {/* Filters & Search */}
                        <div className="flex flex-wrap gap-3">
                            <input
                                type="text"
                                placeholder={t('searchPlaceholder')}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="flex-1 min-w-[200px] p-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                            />

                            <select
                                value={filterDate}
                                onChange={(e) => setFilterDate(e.target.value)}
                                className="p-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-medium text-slate-700"
                            >
                                <option value="">📅 {t('filters.allDates') || 'Toutes les dates'}</option>
                                {availableDates.map(date => (
                                    <option key={date as string} value={date as string}>{date as string}</option>
                                ))}
                            </select>

                            <select
                                value={filterStatus}
                                onChange={(e) => setFilterStatus(e.target.value)}
                                className="p-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-medium text-slate-700"
                            >
                                <option value="all">🔍 {t('filters.allStatuses') || 'Tous les statuts'}</option>
                                <option value="present_pending">🏥 Présent (En attente)</option>
                                <option value="in_block">😷 Au Bloc</option>
                                <option value="post_op">🛏️ En Post-Op</option>
                                <option value="discharged">✅ Sortie</option>
                            </select>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col lg:flex-row gap-6">

                {/* LIST SECTION */}
                <div className="flex-1">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="font-bold text-slate-700">
                            {loadingData ? 'Chargement...' : t('resultsFound', { count: filteredRecords.length })}
                        </h2>
                        <button
                            onClick={toggleSelectAll}
                            className="text-sm font-bold text-indigo-600 hover:bg-indigo-50 px-3 py-1 rounded"
                        >
                            {selectedRecordIds.size === filteredRecords.length ? t('deselectAll') : t('selectAll')}
                        </button>
                    </div>

                    <div className="space-y-3">
                        {filteredRecords.map(record => (
                            <div
                                key={record.id}
                                onClick={() => toggleSelection(record.id!)}
                                className={`bg-white p-4 rounded-xl border-2 cursor-pointer transition-all flex items-center justify-between group ${selectedRecordIds.has(record.id!)
                                    ? 'border-indigo-500 shadow-md bg-indigo-50/10'
                                    : 'border-slate-100 hover:border-indigo-200 hover:shadow-sm'
                                    }`}
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`w-6 h-6 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${selectedRecordIds.has(record.id!)
                                        ? 'bg-indigo-500 border-indigo-500 text-white'
                                        : 'bg-white border-slate-300 group-hover:border-indigo-300'
                                        }`}>
                                        {selectedRecordIds.has(record.id!) && '✓'}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-black text-slate-800 text-lg">{record.last_name} {record.first_name}</span>
                                            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-bold">{record.dossier_number}</span>
                                        </div>
                                        <div className="text-sm text-slate-500 flex items-center gap-3">
                                            <span>{record.age} ans</span>
                                            {record.planning_day && (
                                                <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded text-xs font-bold">
                                                    📅 {record.planning_day}
                                                </span>
                                            )}
                                            <span>•</span>
                                            <span className="truncate max-w-[200px]">{record.intervention_type || t('status.undefinedIntervention')}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Status Indicators based on Tab */}
                                <div className="text-right">
                                    {activeTab === 'pre-op' && (
                                        <div className="flex flex-col items-end gap-1">
                                            {record.pre_op_call === 1 && <span className="text-xs font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded">{t('status.callOk')}</span>}
                                            {record.pre_op_checked === 1 && <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">{t('status.presenceOk')}</span>}
                                            {record.block_entry_time && <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">{t('status.entry', { time: record.block_entry_time })}</span>}
                                        </div>
                                    )}
                                    {activeTab === 'bloc' && (
                                        <div className="flex flex-col items-end gap-1">
                                            {record.pharmacy_status === 'retrieved' && <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">{t('status.pharmaOk')}</span>}
                                        </div>
                                    )}
                                    {activeTab === 'post-op' && (
                                        <div className="flex flex-col items-end gap-1">
                                            {record.discharge_time && <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">{t('status.exit', { time: record.discharge_time })}</span>}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* BULK ACTION PANEL */}
                <div className="lg:w-96 flex-shrink-0">
                    <div className="bg-white rounded-2xl shadow-lg border border-indigo-100 p-6 sticky top-24">
                        <h3 className="text-lg font-black text-slate-800 mb-2 flex items-center gap-2">
                            <span>⚡</span> {t('bulk.title')}
                        </h3>
                        <p className="text-sm text-slate-500 mb-6">
                            {t('bulk.subtitle', { count: selectedRecordIds.size })}
                        </p>

                        <div className="space-y-6">
                            {activeTab === 'pre-op' && (
                                <>
                                    <div className="space-y-3">
                                        <p className="font-bold text-slate-700 text-sm uppercase">{t('bulk.sections.quickCheck')}</p>
                                        <label className="flex items-center gap-3 p-3 rounded-lg border border-orange-100 bg-orange-50/50 cursor-pointer hover:bg-orange-50">
                                            <input type="checkbox" className="w-5 h-5 text-orange-600 rounded"
                                                checked={bulkPreOpCall === true}
                                                // Triple state logic: null -> true -> false -> null not strictly implementing here, just toggle
                                                onChange={(e) => setBulkPreOpCall(e.target.checked)}
                                            />
                                            <span className="font-bold text-orange-900">{t('bulk.labels.preOpCallOk')}</span>
                                        </label>
                                        <label className="flex items-center gap-3 p-3 rounded-lg border border-emerald-100 bg-emerald-50/50 cursor-pointer hover:bg-emerald-50">
                                            <input type="checkbox" className="w-5 h-5 text-emerald-600 rounded"
                                                checked={bulkPreOpCheck === true}
                                                onChange={(e) => setBulkPreOpCheck(e.target.checked)}
                                            />
                                            <span className="font-bold text-emerald-900">{t('bulk.labels.presenceCheckOk')}</span>
                                        </label>
                                    </div>
                                    <div>
                                        <p className="font-bold text-slate-700 text-sm uppercase mb-2">{t('bulk.sections.blocEntry')}</p>
                                        <input
                                            type="time"
                                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                                            value={bulkBlockEntry}
                                            onChange={(e) => setBulkBlockEntry(e.target.value)}
                                        />
                                    </div>
                                </>
                            )}

                            {activeTab === 'bloc' && (
                                <>
                                    <div>
                                        <p className="font-bold text-slate-700 text-sm uppercase mb-2">{t('bulk.sections.pharmacyStatus')}</p>
                                        <select
                                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-bold cursor-pointer"
                                            value={bulkPharmacyStatus}
                                            onChange={(e) => setBulkPharmacyStatus(e.target.value)}
                                        >
                                            <option value="">{t('bulk.labels.noChange')}</option>
                                            <option value="pending">{t('bulk.labels.pending')}</option>
                                            <option value="retrieved">{t('bulk.labels.retrieved')}</option>
                                            <option value="none">{t('bulk.labels.none')}</option>
                                        </select>
                                    </div>
                                    <div>
                                        <p className="font-bold text-slate-700 text-sm uppercase mb-2">{t('bulk.sections.assignSurgeons')}</p>
                                        <div className="max-h-60 overflow-y-auto space-y-2 border border-slate-100 rounded-xl p-2 bg-slate-50">
                                            {surgeons.map(surgeon => (
                                                <label key={surgeon.id} className="flex items-center gap-3 p-2 bg-white rounded-lg border border-slate-100 cursor-pointer hover:border-indigo-300">
                                                    <input
                                                        type="checkbox"
                                                        className="w-4 h-4 text-indigo-600 rounded"
                                                        checked={bulkSurgeons.includes(surgeon.id!)}
                                                        onChange={(e) => {
                                                            if (e.target.checked) setBulkSurgeons([...bulkSurgeons, surgeon.id!]);
                                                            else setBulkSurgeons(bulkSurgeons.filter(id => id !== surgeon.id));
                                                        }}
                                                    />
                                                    <span className="text-sm font-medium">{surgeon.name}</span>
                                                </label>
                                            ))}
                                            {surgeons.length === 0 && <p className="text-xs text-center text-gray-400 py-2">{t('bulk.labels.noStaff')}</p>}
                                        </div>
                                    </div>
                                </>
                            )}

                            {activeTab === 'post-op' && (
                                <>
                                    <div>
                                        <p className="font-bold text-slate-700 text-sm uppercase mb-2">{t('bulk.sections.blocExit')}</p>
                                        <input
                                            type="time"
                                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-slate-500 font-bold"
                                            value={bulkBlockExit}
                                            onChange={(e) => setBulkBlockExit(e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <p className="font-bold text-slate-700 text-sm uppercase mb-2">{t('bulk.sections.postOpEntry')}</p>
                                        <input
                                            type="time"
                                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-cyan-500 font-bold"
                                            value={bulkPostOpEntry}
                                            onChange={(e) => setBulkPostOpEntry(e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <p className="font-bold text-slate-700 text-sm uppercase mb-2">{t('bulk.sections.discharge')}</p>
                                        <input
                                            type="time"
                                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                                            value={bulkDischargeTime}
                                            onChange={(e) => setBulkDischargeTime(e.target.value)}
                                        />
                                    </div>
                                </>
                            )}
                        </div>

                        <button
                            onClick={handleBulkSave}
                            disabled={selectedRecordIds.size === 0 || loading}
                            className="w-full mt-8 bg-indigo-600 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {loading ? <span className="animate-spin">⏳</span> : <span>💾 {t('bulk.submit', { count: selectedRecordIds.size })}</span>}
                        </button>
                    </div>
                </div>
            </main>
        </div>
    );
}
