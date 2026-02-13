'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { MedicalRecord, Edition, Surgeon } from '@/lib/client-db';
import { useTranslations } from '@/app/providers/I18nProvider';
import { useEdition } from '@/app/providers/EditionProvider';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';


import { Phone, ClipboardCheck, LogIn, Pill, LogOut, BedDouble, Home, Search, Calendar, Filter } from 'lucide-react';

export default function WorkflowPage() {
    const { currentEdition } = useEdition();
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    // URL State
    const activeTab = (searchParams.get('tab') as 'pre-op' | 'bloc' | 'post-op') || 'pre-op';
    const filterDate = searchParams.get('date') || '';
    const filterStatus = searchParams.get('status') || 'all';

    // Search Handling
    const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');

    useEffect(() => {
        const timer = setTimeout(() => {
            const params = new URLSearchParams(searchParams.toString());
            const current = params.get('search') || '';
            if (current !== searchTerm) {
                if (searchTerm) params.set('search', searchTerm);
                else params.delete('search');
                router.replace(`${pathname}?${params.toString()}`, { scroll: false });
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [searchTerm, pathname, router, searchParams]);

    // Param Updater Helper
    const updateParam = useCallback((key: string, value: string) => {
        const params = new URLSearchParams(searchParams.toString());
        if (value && value !== 'all') {
            params.set(key, value);
        } else {
            params.delete(key);
        }
        // Use replace for filters to avoid navigation history spam, push is better for tabs usually but keeping consistency
        // Using replace for filters/tabs to feel like an SPA state update
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }, [searchParams, pathname, router]);

    const setActiveTab = (tab: string) => updateParam('tab', tab);
    const setFilterDate = (date: string) => updateParam('date', date);
    const setFilterStatus = (status: string) => updateParam('status', status);


    const [selectedRecordIds, setSelectedRecordIds] = useState<Set<number>>(new Set());
    const [loading, setLoading] = useState(false);

    // Bulk Data States
    const [bulkPreOpCall, setBulkPreOpCall] = useState<boolean | null>(null);
    const [bulkPreOpCheck, setBulkPreOpCheck] = useState<boolean | null>(null);
    const [bulkBlockEntry, setBulkBlockEntry] = useState('');

    // Bloc Bulk Data
    const [bulkPharmacyStatus, setBulkPharmacyStatus] = useState<string>('');
    const [bulkSurgeons, setBulkSurgeons] = useState<number[]>([]);
    const [bulkDiagnosisCategory, setBulkDiagnosisCategory] = useState('');
    const [bulkInterventionDetails, setBulkInterventionDetails] = useState('');
    const [bulkPrescriptionDetails, setBulkPrescriptionDetails] = useState('');

    // Post-Op Bulk Data
    const [bulkBlockExit, setBulkBlockExit] = useState('');
    const [bulkPostOpEntry, setBulkPostOpEntry] = useState('');
    const [bulkPostOpRoom, setBulkPostOpRoom] = useState('');
    const [bulkPostOpBed, setBulkPostOpBed] = useState('');
    const [bulkDischargeTime, setBulkDischargeTime] = useState('');
    const [bulkDischargeNotes, setBulkDischargeNotes] = useState('');

    const t = useTranslations('workflow');
    const tCommon = useTranslations('common');

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

    const formatTime = (timeString?: string | null) => {
        if (!timeString) return '';
        // If it's already a time string "HH:mm"
        if (timeString.match(/^\d{2}:\d{2}$/)) return timeString;
        try {
            return new Date(timeString).toLocaleTimeString('fr-FR', {
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch {
            return timeString;
        }
    };

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
            const updates: Record<string, string | number | boolean | null> = {
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
                if (bulkDiagnosisCategory) updates.diagnosis_category = bulkDiagnosisCategory;
                if (bulkInterventionDetails) updates.intervention_details = bulkInterventionDetails;
                if (bulkPrescriptionDetails) updates.prescription_details = bulkPrescriptionDetails;
            } else if (activeTab === 'post-op') {
                if (bulkBlockExit) updates.block_exit_time = bulkBlockExit;
                if (bulkPostOpEntry) updates.post_op_entry_time = bulkPostOpEntry;
                if (bulkPostOpRoom) updates.post_op_room = bulkPostOpRoom;
                if (bulkPostOpBed) updates.post_op_bed = bulkPostOpBed;
                if (bulkDischargeTime) updates.discharge_time = bulkDischargeTime;
                if (bulkDischargeNotes) updates.discharge_notes = bulkDischargeNotes;
            }

            // Apply updates to selected records via SINGLE API CALL
            const res = await fetch('/api/records', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ids: Array.from(selectedRecordIds),
                    ...updates
                })
            });

            if (!res.ok) throw new Error('Failed to update records');

            // Handle Surgeon Bulk Update specifically
            if (activeTab === 'bloc' && bulkSurgeons.length > 0) {
                // Note: Surgeon assignment API might need similar bulk update refactor later if performance is an issue
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
            setBulkBlockEntry('');
            setBulkPharmacyStatus('');
            setBulkSurgeons([]);
            setBulkDiagnosisCategory('');
            setBulkInterventionDetails('');
            setBulkPrescriptionDetails('');
            setBulkBlockExit('');
            setBulkPostOpEntry('');
            setBulkPostOpRoom('');
            setBulkPostOpBed('');
            setBulkDischargeTime('');
            setBulkDischargeNotes('');

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
        <div className="min-h-screen bg-slate-50 pb-32 font-[family-name:var(--font-geist-sans)]">
            {/* Header */}
            <header className="bg-white/80 backdrop-blur-xl sticky top-16 z-40 border-b border-indigo-50 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex flex-col gap-4 py-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-xs font-bold text-indigo-400 tracking-[0.2em] uppercase mb-1">Workflow</h2>
                                <h1 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">{t('title')}</h1>
                            </div>
                            <div className="flex items-center gap-3">
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
                                <button onClick={() => router.push('/dashboard')} className="px-4 py-2.5 bg-white text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition border border-slate-200 flex items-center gap-2 text-sm">
                                    <span>←</span> {tCommon('back')}
                                </button>
                            </div>
                        </div>

                        {/* Filters & Search */}
                        <div className="flex flex-wrap gap-3">
                            <div className="relative flex-1 min-w-[200px]">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                                <input
                                    type="text"
                                    placeholder={t('searchPlaceholder')}
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm transition-all shadow-sm"
                                />
                            </div>

                            <div className="relative">
                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                                <select
                                    value={filterDate}
                                    onChange={(e) => setFilterDate(e.target.value)}
                                    className="pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-medium text-slate-700 cursor-pointer shadow-sm appearance-none"
                                >
                                    <option value="">{t('filters.allDates')}</option>
                                    {availableDates.map(date => (
                                        <option key={date as string} value={date as string}>{date as string}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="relative">
                                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                                <select
                                    value={filterStatus}
                                    onChange={(e) => setFilterStatus(e.target.value)}
                                    className="pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-medium text-slate-700 cursor-pointer shadow-sm appearance-none"
                                >
                                    <option value="all">{t('filters.allStatuses')}</option>
                                    <option value="present_pending">{t('filters.presentPending')}</option>
                                    <option value="in_block">{t('filters.inBlock')}</option>
                                    <option value="post_op">{t('filters.postOp')}</option>
                                    <option value="discharged">{t('filters.discharged')}</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col-reverse lg:flex-row gap-6">

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
                                className={`bg-white p-4 rounded-xl border-2 cursor-pointer transition-all flex flex-col sm:flex-row sm:items-center justify-between group gap-4 ${selectedRecordIds.has(record.id!)
                                    ? 'border-indigo-500 shadow-md bg-indigo-50/10'
                                    : 'border-slate-100 hover:border-indigo-200 hover:shadow-sm'
                                    }`}
                            >
                                <div className="flex items-start gap-4">
                                    <div className={`w-6 h-6 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors mt-1 ${selectedRecordIds.has(record.id!)
                                        ? 'bg-indigo-500 border-indigo-500 text-white'
                                        : 'bg-white border-slate-300 group-hover:border-indigo-300'
                                        }`}>
                                        {selectedRecordIds.has(record.id!) && '✓'}
                                    </div>
                                    <div>
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="font-black text-slate-800 text-lg">{record.last_name} {record.first_name}</span>
                                            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-bold">{record.dossier_number}</span>
                                        </div>
                                        <div className="text-sm text-slate-500 flex flex-wrap items-center gap-2 mt-1">
                                            <span>{record.age} ans</span>
                                            {record.planning_day && (
                                                <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded text-xs font-bold">
                                                    📅 {record.planning_day}
                                                </span>
                                            )}
                                            <span className="hidden sm:inline">•</span>
                                            <span className="truncate max-w-[200px]">{record.intervention_type || t('status.undefinedIntervention')}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Status Indicators based on Tab */}
                                <div className="text-left sm:text-right flex flex-row sm:flex-col flex-wrap items-start sm:items-end gap-1.5 pl-10 sm:pl-0">
                                    {/* Pre-Op Statuses */}
                                    <div className="flex flex-wrap items-center gap-1.5">
                                        {record.pre_op_call === 1 && (
                                            <span className="text-xs font-bold text-orange-600 bg-orange-50 px-2.5 py-1 rounded-full border border-orange-100 flex items-center gap-1.5 shadow-sm">
                                                <Phone size={14} />
                                                {record.pre_op_call_at ? t('status.preOpCallTime', { time: formatTime(record.pre_op_call_at) }) : t('status.callOk')}
                                            </span>
                                        )}
                                        {(!!record.pre_op_checked) && (
                                            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100 flex items-center gap-1.5 shadow-sm">
                                                <ClipboardCheck size={14} />
                                                {record.pre_op_checked_at ? t('status.preOpCheckedTime', { time: formatTime(record.pre_op_checked_at) }) : t('status.presenceOk')}
                                            </span>
                                        )}
                                    </div>

                                    {/* Bloc Statuses - Grouped Entry/Exit */}
                                    {(record.block_entry_time || record.block_exit_time) && (
                                        <div className="flex flex-wrap items-center gap-1.5">
                                            {record.block_entry_time && (
                                                <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-100 flex items-center gap-1.5 shadow-sm">
                                                    <LogIn size={14} />
                                                    {t('status.entry', { time: formatTime(record.block_entry_time) })}
                                                </span>
                                            )}
                                            {record.block_exit_time && (
                                                <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200 flex items-center gap-1.5 shadow-sm">
                                                    <LogOut size={14} />
                                                    {t('status.exit', { time: formatTime(record.block_exit_time) })}
                                                </span>
                                            )}
                                        </div>
                                    )}

                                    {record.pharmacy_status === 'retrieved' && (
                                        <span className="text-xs font-bold text-purple-600 bg-purple-50 px-2.5 py-1 rounded-full border border-purple-100 flex items-center gap-1.5 shadow-sm">
                                            <Pill size={14} />
                                            {t('status.pharmaOk')}
                                        </span>
                                    )}

                                    {/* Post-Op Statuses - Grouped Entry/Discharge */}
                                    {(record.post_op_entry_time || record.discharge_time) && (
                                        <div className="flex flex-wrap items-center gap-1.5">
                                            {record.post_op_entry_time && (
                                                <span className="text-xs font-bold text-cyan-600 bg-cyan-50 px-2.5 py-1 rounded-full border border-cyan-100 flex items-center gap-1.5 shadow-sm">
                                                    <BedDouble size={14} />
                                                    {t('status.postOpEntry', { time: formatTime(record.post_op_entry_time) })}
                                                </span>
                                            )}
                                            {record.discharge_time && (
                                                <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-100 flex items-center gap-1.5 shadow-sm">
                                                    <Home size={14} />
                                                    {t('status.discharge', { time: formatTime(record.discharge_time) })}
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* BULK ACTION PANEL */}
                <div className="lg:w-96 flex-shrink-0 w-full">
                    <div className="bg-white rounded-2xl shadow-lg border border-indigo-100 p-6 lg:sticky lg:top-24 lg:max-h-[calc(100vh-140px)] flex flex-col">
                        <div className="flex-shrink-0 mb-4">
                            <h3 className="text-lg font-black text-slate-800 mb-1 flex items-center gap-2">
                                <span>⚡</span> {t('bulk.title')}
                            </h3>
                            <p className="text-sm text-slate-500">
                                {t('bulk.subtitle', { count: selectedRecordIds.size })}
                            </p>
                        </div>

                        <div className="space-y-6 flex-1 overflow-y-auto pr-2 custom-scrollbar">
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
                                        <p className="font-bold text-slate-700 text-sm uppercase mb-2">{t('bulk.sections.category')}</p>
                                        <input
                                            type="text"
                                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 font-bold"
                                            value={bulkDiagnosisCategory}
                                            onChange={(e) => setBulkDiagnosisCategory(e.target.value)}
                                            placeholder="..."
                                        />
                                    </div>
                                    <div>
                                        <p className="font-bold text-slate-700 text-sm uppercase mb-2">{t('bulk.sections.operativeReport')}</p>
                                        <textarea
                                            rows={2}
                                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 font-bold resize-none"
                                            value={bulkInterventionDetails}
                                            onChange={(e) => setBulkInterventionDetails(e.target.value)}
                                            placeholder="..."
                                        />
                                    </div>
                                    <div>
                                        <p className="font-bold text-slate-700 text-sm uppercase mb-2">{t('bulk.sections.prescription')}</p>
                                        <textarea
                                            rows={2}
                                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-bold resize-none"
                                            value={bulkPrescriptionDetails}
                                            onChange={(e) => setBulkPrescriptionDetails(e.target.value)}
                                            placeholder="..."
                                        />
                                    </div>
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
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <p className="font-bold text-slate-700 text-xs uppercase mb-2">{t('bulk.sections.room')}</p>
                                            <input
                                                type="text"
                                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-cyan-500 font-bold text-center"
                                                value={bulkPostOpRoom}
                                                onChange={(e) => setBulkPostOpRoom(e.target.value)}
                                            />
                                        </div>
                                        <div>
                                            <p className="font-bold text-slate-700 text-xs uppercase mb-2">{t('bulk.sections.bed')}</p>
                                            <input
                                                type="text"
                                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-cyan-500 font-bold text-center"
                                                value={bulkPostOpBed}
                                                onChange={(e) => setBulkPostOpBed(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <p className="font-bold text-slate-700 text-sm uppercase mb-2">{t('bulk.sections.dischargeNotes')}</p>
                                        <textarea
                                            rows={2}
                                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold resize-none"
                                            value={bulkDischargeNotes}
                                            onChange={(e) => setBulkDischargeNotes(e.target.value)}
                                            placeholder="..."
                                        />
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="flex-shrink-0 pt-4 mt-2 border-t border-slate-100">
                            <button
                                onClick={handleBulkSave}
                                disabled={selectedRecordIds.size === 0 || loading}
                                className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl shadow-lg hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {loading ? <span className="animate-spin">⏳</span> : <span>💾 {t('bulk.submit', { count: selectedRecordIds.size })}</span>}
                            </button>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
