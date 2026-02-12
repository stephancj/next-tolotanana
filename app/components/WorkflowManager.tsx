'use client';

import { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { MedicalRecord, db, Edition } from '@/lib/client-db';
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
    const [isSearchingOnline, setIsSearchingOnline] = useState(false);

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

    // Fetch active surgeons for the list
    const surgeons = useLiveQuery(() => db.surgeons.where('is_active').equals(1).toArray()) || [];

    // Fetch records
    const liveRecords = useLiveQuery(async () => {
        return await db.medical_records.toArray();
    }, []);

    // Online Search Implementation
    const performOnlineSearch = async (term: string) => {
        if (!term || term.length < 2) return;
        setIsSearchingOnline(true);
        console.log('DEBUG: Starting Online Search for:', term);

        try {
            // 1. Fetch remote data (Records and Editions to map IDs)
            const [recordsRes, editionsRes] = await Promise.all([
                fetch('/api/records'),
                fetch('/api/editions')
            ]);

            if (!recordsRes.ok || !editionsRes.ok) throw new Error("Network error during search");

            const remoteRecords = await recordsRes.json();
            const remoteEditions = await editionsRes.json();

            // 2. Find the Remote Edition corresponding to our Current Local Edition
            // We match by public_id which should be consistent
            if (!currentEdition?.public_id) {
                console.warn("Current edition has no public_id, cannot map remote data.");
                return;
            }

            const matchingRemoteEdition = remoteEditions.find((e: any) => e.public_id === currentEdition.public_id);
            if (!matchingRemoteEdition) {
                console.warn("Could not find matching remote edition for:", currentEdition.name);
                return;
            }

            console.log(`DEBUG: Mapping Remote Edition ID ${matchingRemoteEdition.id} -> Local Edition ID ${currentEdition.id}`);

            // 3. Filter remote records that match the search term AND the edition
            const lowerTerm = term.toLowerCase().trim();
            const matches = remoteRecords.filter((r: any) => {
                // Must belong to the same edition (Remote ID check)
                if (r.edition_id !== matchingRemoteEdition.id) return false;
                if (r.deleted) return false;

                const nameMatch = (r.last_name + ' ' + r.first_name).toLowerCase().includes(lowerTerm);
                const dossierMatch = (r.dossier_number || '').toLowerCase().includes(lowerTerm);
                return nameMatch || dossierMatch;
            });

            console.log(`DEBUG: Found ${matches.length} matches online.`);

            if (matches.length > 0) {
                // 4. Save/Update in Dexie
                // We must map the REMOTE edition_id back to the LOCAL edition_id
                const recordsToSync = matches.map((r: any) => {
                    // Keep most fields, but swap edition_id
                    const { id, edition_id, ...rest } = r;
                    return {
                        ...rest,
                        // If we have a local public_id match, use that. If not, generate one?
                        // Actually, 'r' from API should have a public_id.
                        public_id: r.public_id || crypto.randomUUID(),
                        edition_id: currentEdition.id!, // FORCE to current local edition ID
                        sync_status: 'synced', // It came from server, so it is synced
                        last_updated: new Date().toISOString()
                    };
                });

                // Bulk Put (upsert) based on public_id?
                // Dexie 'medical_records' uses ++id as PK.
                // We need to check if they exist by public_id to avoid duplicates.

                await db.transaction('rw', db.medical_records, async () => {
                    for (const rec of recordsToSync) {
                        const existing = await db.medical_records.where('public_id').equals(rec.public_id).first();
                        if (existing) {
                            await db.medical_records.update(existing.id!, rec);
                        } else {
                            await db.medical_records.add(rec as MedicalRecord);
                        }
                    }
                });
                console.log("DEBUG: Synced online results to local DB.");
            }

        } catch (err) {
            console.error("Online search failed:", err);
        } finally {
            setIsSearchingOnline(false);
        }
    };

    // Filter records based on search and tab logic
    const filteredRecords = useMemo(() => {
        const records = liveRecords || [];

        // 1. Filter by Edition (DISABLED to show all records for debugging)
        const editionRecords = records;

        // 2. Filter by Program Mission - RESTORE but keep relaxed
        const programmedRecords = editionRecords.filter(r => {
            // Loose check for "1", 1, "true", true
            return r.program_mission == 1 || String(r.program_mission) === 'true';
        });

        if (!searchTerm) return programmedRecords;

        const lowerTerm = String(searchTerm).toLowerCase().trim();

        const results = programmedRecords.filter(r => {
            const firstName = r.first_name ? String(r.first_name).toLowerCase() : '';
            const lastName = r.last_name ? String(r.last_name).toLowerCase() : '';
            const dossier = r.dossier_number ? String(r.dossier_number).toLowerCase() : '';

            return firstName.includes(lowerTerm) || lastName.includes(lowerTerm) || dossier.includes(lowerTerm);
        });
        return results;
    }, [liveRecords, searchTerm, currentEdition?.id]);

    // Trigger online search when local results are empty and user is typing
    useMemo(() => { // Using useMemo as a side-effect trigger (debounce would be better but this is quick)
        if (filteredRecords.length === 0 && searchTerm.length > 2 && !isSearchingOnline) {
            const timer = setTimeout(() => {
                performOnlineSearch(searchTerm);
            }, 800); // 800ms debounce
            return () => clearTimeout(timer);
        }
    }, [filteredRecords.length, searchTerm, isSearchingOnline, currentEdition?.public_id, currentEdition?.id]); // eslint-disable-line react-hooks/exhaustive-deps

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
            const updates: Partial<MedicalRecord> = {
                sync_status: 'pending_update',
                updated_at: new Date().toISOString()
            };

            if (activeTab === 'pre-op') {
                if (bulkPreOpCall !== null) {
                    updates.pre_op_call = bulkPreOpCall ? 1 : 0;
                    updates.pre_op_call_at = bulkPreOpCall ? new Date().toISOString() : '';
                }
                if (bulkPreOpCheck !== null) {
                    updates.pre_op_checked = bulkPreOpCheck ? 1 : 0;
                    updates.pre_op_checked_at = bulkPreOpCheck ? new Date().toISOString() : '';
                }
                if (bulkBlockEntry) updates.block_entry_time = bulkBlockEntry;
            } else if (activeTab === 'bloc') {
                if (bulkPharmacyStatus) updates.pharmacy_status = bulkPharmacyStatus as 'pending' | 'retrieved' | 'none';
                // Note: Surgeon updates are more complex as they are in a separate table
            } else if (activeTab === 'post-op') {
                if (bulkBlockExit) updates.block_exit_time = bulkBlockExit;
                if (bulkPostOpEntry) updates.post_op_entry_time = bulkPostOpEntry;
                if (bulkDischargeTime) updates.discharge_time = bulkDischargeTime;
            }

            // Apply updates to selected records in parallel
            await Promise.all(Array.from(selectedRecordIds).map(id => db.medical_records.update(id, updates)));

            // Handle Surgeon Bulk Update specifically
            if (activeTab === 'bloc' && bulkSurgeons.length > 0) {
                // For each selected record, replace surgeons
                for (const recordId of selectedRecordIds) {
                    // Remove existing
                    const existingSurgeons = await db.record_surgeons.where('medical_record_id').equals(recordId).toArray();
                    await db.record_surgeons.bulkDelete(existingSurgeons.map(s => s.id!));

                    // Add new
                    const newLinks = bulkSurgeons.map(sid => ({
                        medical_record_id: recordId,
                        surgeon_id: sid,
                        sync_status: 'pending_update' as const
                    }));
                    await db.record_surgeons.bulkAdd(newLinks);
                }
            }

            alert(t('alerts.success', { count: selectedRecordIds.size }));
            setSelectedRecordIds(new Set());
            // Reset bulk fields? Maybe keep them for next batch? Let's keep specific ones reset.
            setBulkPreOpCall(null);
            setBulkPreOpCheck(null);
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
                    <div className="flex items-center justify-between h-16">
                        <div className="flex items-center gap-4">
                            <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full text-slate-500">
                                ←
                            </button>
                            <h1 className="text-xl font-bold text-slate-800">{t('title')}</h1>
                        </div>
                        <div className="flex bg-slate-100 p-1 rounded-lg">
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

                    {/* Search Bar */}
                    <div className="py-3">
                        <input
                            type="text"
                            placeholder={t('searchPlaceholder')}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col lg:flex-row gap-6">

                {/* LIST SECTION */}
                <div className="flex-1">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="font-bold text-slate-700">
                            {t('resultsFound', { count: filteredRecords.length })}
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
