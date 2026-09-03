'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { MedicalRecord, Surgeon, db } from '@/lib/client-db';
import { useLiveQuery } from 'dexie-react-hooks';
import { replaceRecordSurgeons, updateMedicalRecord } from '@/lib/local-records';
import { useTranslations } from '@/app/providers/I18nProvider';
import { useEdition } from '@/app/providers/EditionProvider';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useFeedback } from '@/app/providers/FeedbackProvider';


import { Phone, ClipboardCheck, LogIn, Pill, LogOut, BedDouble, Home, Search, Calendar, Filter, Clock3, ExternalLink, ShieldAlert } from 'lucide-react';

const currentTime = () => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
};

const workflowStage = (record: MedicalRecord) => {
    if (record.discharge_time) return { key: 'discharged', label: 'Sorti', tone: 'bg-slate-100 text-slate-700' };
    if (record.block_exit_time) return { key: 'post-op', label: 'Post-op', tone: 'bg-cyan-100 text-cyan-800' };
    if (record.block_entry_time) return { key: 'bloc', label: 'Au bloc', tone: 'bg-blue-100 text-blue-800' };
    if (record.pre_op_checked) return { key: 'ready', label: 'Prêt pour le bloc', tone: 'bg-emerald-100 text-emerald-800' };
    return { key: 'pre-op', label: 'Pré-op', tone: 'bg-amber-100 text-amber-900' };
};

export default function WorkflowPage() {
    const { currentEdition } = useEdition();
    const router = useRouter();
    const { notify, confirm } = useFeedback();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    // URL State
    const tabParam = searchParams.get('tab');
    const activeTab: 'pre-op' | 'bloc' | 'post-op' = tabParam === 'bloc' || tabParam === 'post-op' ? tabParam : 'pre-op';
    const filterDate = searchParams.get('date') || '';
    const filterStatus = searchParams.get('status') || 'stage';

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
        setSelectedRecordIds(new Set());
        const params = new URLSearchParams(searchParams.toString());
        if (value) {
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
    const [bulkSurgeonMode, setBulkSurgeonMode] = useState<'no-change' | 'replace' | 'clear'>('no-change');
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

    // Workflow reads and writes Dexie first; the global sync engine handles Neon.
    const localRecords = useLiveQuery<MedicalRecord[]>(
        () => currentEdition?.id
            ? db.medical_records.filter(r => r.edition_id === currentEdition.id && r.deleted !== 1).toArray()
            : Promise.resolve([] as MedicalRecord[]),
        [currentEdition?.id]
    );
    const neonRecords = useMemo(() => localRecords || [], [localRecords]);
    const surgeons = useLiveQuery<Surgeon[]>(
        () => db.surgeons.filter(s => s.is_active === 1 && s.deleted !== 1).toArray(), []
    ) || [];
    const loadingData = currentEdition?.id !== undefined && localRecords === undefined;

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

        // 3. Filter by workflow stage or explicit status.
        if (filterStatus !== 'all') {
            result = result.filter(r => {
                const isPreOpChecked = Boolean(r.pre_op_checked);
                if (filterStatus === 'stage') {
                    if (activeTab === 'pre-op') return !r.block_entry_time;
                    if (activeTab === 'bloc') return Boolean(r.block_entry_time) && !r.block_exit_time;
                    return Boolean(r.block_exit_time) && !r.discharge_time;
                }
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
    }, [neonRecords, searchTerm, filterDate, filterStatus, activeTab]);

    const selectedRecords = useMemo(() => filteredRecords.filter(record => record.id && selectedRecordIds.has(record.id)), [filteredRecords, selectedRecordIds]);

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
        if (!filteredRecords.length) return;
        if (selectedRecords.length === filteredRecords.length) setSelectedRecordIds(new Set());
        else setSelectedRecordIds(new Set(filteredRecords.flatMap(record => record.id ? [record.id] : [])));
    };

    const quickActionFor = (record: MedicalRecord): { label: string; patch?: Partial<MedicalRecord> } => {
        if (record.pre_op_call !== 1) return { label: 'Appel effectué', patch: { pre_op_call: 1, pre_op_call_at: new Date().toISOString() } };
        if (!record.pre_op_checked) return { label: 'Patient présent', patch: { pre_op_checked: 1, pre_op_checked_at: new Date().toISOString() } };
        if (!record.block_entry_time) return { label: 'Entrée bloc maintenant', patch: { block_entry_time: currentTime() } };
        if (!record.block_exit_time) return { label: 'Sortie bloc maintenant', patch: { block_exit_time: currentTime() } };
        if (!record.post_op_entry_time) {
            if (!record.post_op_room || !record.post_op_bed) return { label: 'Renseigner le post-op' };
            return { label: 'Installer en post-op', patch: { post_op_entry_time: currentTime() } };
        }
        return { label: 'Préparer la sortie' };
    };

    const applyQuickAction = async (record: MedicalRecord) => {
        if (!record.id) return;
        const action = quickActionFor(record);
        if (!action.patch) { router.push(`/operation?id=${record.id}`); return; }
        const previous = Object.fromEntries(Object.keys(action.patch).map(key => [key, record[key as keyof MedicalRecord]])) as Partial<MedicalRecord>;
        try {
            await updateMedicalRecord(record.id, action.patch);
            notify(`${action.label} enregistré sur cette tablette.`, 'success', {
                label: 'Annuler',
                run: () => { void updateMedicalRecord(record.id!, previous).then(() => notify('Action annulée.', 'success')); }
            });
        } catch (error) {
            console.error(error);
            notify('Action non enregistrée. Réessayez.', 'error');
        }
    };

    const handleBulkSave = async () => {
        if (!selectedRecords.length) {
            setSelectedRecordIds(new Set());
            notify('Aucun patient visible n’est sélectionné.', 'info');
            return;
        }
        const updates: Partial<MedicalRecord> = {};
        const changeLabels: string[] = [];
        if (activeTab === 'pre-op') {
            if (bulkPreOpCall !== null) {
                updates.pre_op_call = bulkPreOpCall ? 1 : 0;
                updates.pre_op_call_at = bulkPreOpCall ? new Date().toISOString() : undefined;
                changeLabels.push(`Appel pré-op : ${bulkPreOpCall ? 'validé' : 'non validé'}`);
            }
            if (bulkPreOpCheck !== null) {
                updates.pre_op_checked = bulkPreOpCheck ? 1 : 0;
                updates.pre_op_checked_at = bulkPreOpCheck ? new Date().toISOString() : undefined;
                changeLabels.push(`Présence : ${bulkPreOpCheck ? 'validée' : 'non validée'}`);
            }
            if (bulkBlockEntry) { updates.block_entry_time = bulkBlockEntry; changeLabels.push(`Entrée bloc : ${bulkBlockEntry}`); }
        } else if (activeTab === 'bloc') {
            if (bulkPharmacyStatus) { updates.pharmacy_status = bulkPharmacyStatus as 'pending' | 'retrieved' | 'none'; changeLabels.push(`Pharmacie : ${bulkPharmacyStatus}`); }
            if (bulkDiagnosisCategory) { updates.diagnosis_category = bulkDiagnosisCategory; changeLabels.push(`Catégorie : ${bulkDiagnosisCategory}`); }
            if (bulkInterventionDetails) { updates.intervention_details = bulkInterventionDetails; changeLabels.push('Compte-rendu opératoire modifié'); }
            if (bulkPrescriptionDetails) { updates.prescription_details = bulkPrescriptionDetails; changeLabels.push('Prescription modifiée'); }
            if (bulkSurgeonMode === 'replace') changeLabels.push(`Équipe remplacée par ${bulkSurgeons.length} chirurgien(s)`);
            if (bulkSurgeonMode === 'clear') changeLabels.push('Équipe chirurgicale retirée');
        } else {
            if (bulkBlockExit) { updates.block_exit_time = bulkBlockExit; changeLabels.push(`Sortie bloc : ${bulkBlockExit}`); }
            if (bulkPostOpEntry) { updates.post_op_entry_time = bulkPostOpEntry; changeLabels.push(`Entrée post-op : ${bulkPostOpEntry}`); }
            if (bulkPostOpRoom) { updates.post_op_room = bulkPostOpRoom; changeLabels.push(`Salle : ${bulkPostOpRoom}`); }
            if (bulkPostOpBed) { updates.post_op_bed = bulkPostOpBed; changeLabels.push(`Lit : ${bulkPostOpBed}`); }
            if (bulkDischargeTime) { updates.discharge_time = bulkDischargeTime; changeLabels.push(`Sortie patient : ${bulkDischargeTime}`); }
            if (bulkDischargeNotes) { updates.discharge_notes = bulkDischargeNotes; changeLabels.push('Notes de sortie modifiées'); }
        }
        if (bulkSurgeonMode === 'replace' && bulkSurgeons.length === 0) { notify('Sélectionnez au moins un chirurgien, ou choisissez « Retirer ».', 'error'); return; }
        if (!changeLabels.length) { notify('Choisissez au moins une modification à appliquer.', 'info'); return; }

        const warnings: string[] = [];
        if (bulkBlockEntry && selectedRecords.some(record => !(record.pre_op_call || bulkPreOpCall === true) || !(record.pre_op_checked || bulkPreOpCheck === true))) warnings.push('pré-op incomplet pour certains patients');
        if ((bulkBlockExit || bulkPostOpEntry) && selectedRecords.some(record => !record.block_entry_time)) warnings.push('entrée au bloc absente pour certains patients');
        if (bulkPostOpEntry && selectedRecords.some(record => !(record.post_op_room || bulkPostOpRoom) || !(record.post_op_bed || bulkPostOpBed))) warnings.push('salle ou lit post-op non renseigné pour certains patients');
        if (bulkDischargeTime && selectedRecords.some(record => !(record.block_exit_time || bulkBlockExit))) warnings.push('sortie du bloc absente pour certains patients');
        if (bulkDischargeTime && selectedRecords.some(record => !(record.discharge_notes || bulkDischargeNotes))) warnings.push('notes de sortie absentes pour certains patients');
        const accepted = await confirm({
            title: `Modifier ${selectedRecords.length} patient(s) ?`,
            message: `${changeLabels.join(' ; ')}.${warnings.length ? ` Attention : ${warnings.join(' ; ')}.` : ''} Les autres champs resteront inchangés.`,
            confirmLabel: warnings.length ? 'Appliquer malgré l’avertissement' : 'Appliquer'
        });
        if (!accepted) return;

        setLoading(true);
        try {
            const updateKeys = Object.keys(updates) as (keyof MedicalRecord)[];
            const previousValues = new Map<number, Partial<MedicalRecord>>();
            for (const record of selectedRecords) if (record.id) previousValues.set(record.id, Object.fromEntries(updateKeys.map(key => [key, record[key]])) as Partial<MedicalRecord>);
            const previousSurgeons = new Map<number, number[]>();
            if (activeTab === 'bloc' && bulkSurgeonMode !== 'no-change') {
                await Promise.all(selectedRecords.map(async record => {
                    if (!record.id) return;
                    const links = await db.record_surgeons.where('medical_record_id').equals(record.id).toArray();
                    previousSurgeons.set(record.id, links.map(link => link.surgeon_id));
                }));
            }
            await Promise.all(selectedRecords.flatMap(record => record.id && updateKeys.length ? [updateMedicalRecord(record.id, updates)] : []));
            if (activeTab === 'bloc' && bulkSurgeonMode !== 'no-change') {
                const surgeonIds = bulkSurgeonMode === 'clear' ? [] : bulkSurgeons;
                await Promise.all(selectedRecords.flatMap(record => record.id ? [replaceRecordSurgeons(record.id, surgeonIds)] : []));
            }

            const changedCount = selectedRecords.length;
            notify(t('alerts.success', { count: changedCount }), 'success', {
                label: 'Annuler',
                run: () => { void (async () => {
                    await Promise.all([...previousValues].map(([id, values]) => updateMedicalRecord(id, values)));
                    await Promise.all([...previousSurgeons].map(([id, surgeonIds]) => replaceRecordSurgeons(id, surgeonIds)));
                    notify('Modification groupée annulée.', 'success');
                })(); }
            });
            setSelectedRecordIds(new Set());
            setBulkPreOpCall(null); setBulkPreOpCheck(null); setBulkBlockEntry('');
            setBulkPharmacyStatus(''); setBulkSurgeons([]); setBulkSurgeonMode('no-change');
            setBulkDiagnosisCategory(''); setBulkInterventionDetails(''); setBulkPrescriptionDetails('');
            setBulkBlockExit(''); setBulkPostOpEntry(''); setBulkPostOpRoom(''); setBulkPostOpBed('');
            setBulkDischargeTime(''); setBulkDischargeNotes('');
        } catch (err) {
            console.error(err);
            notify(t('alerts.error'), 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 pb-24">
            {/* Header */}
            <header className="sticky top-16 z-40 border-b border-slate-200 bg-white">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex flex-col gap-4 py-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <h2 className="text-xs font-bold text-indigo-400 tracking-[0.2em] uppercase mb-1">Workflow</h2>
                                <h1 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">{t('title')}</h1>
                            </div>
                            <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                                <div className="mobile-scroll flex min-w-0 flex-1 overflow-x-auto rounded-lg bg-slate-100 p-1 sm:flex-none">
                                    <button
                                        onClick={() => setActiveTab('pre-op')}
                                        className={`min-h-11 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-bold transition-all sm:px-4 ${activeTab === 'pre-op' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                    >
                                        {t('tabs.preOp')}
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('bloc')}
                                        className={`min-h-11 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-bold transition-all sm:px-4 ${activeTab === 'bloc' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                    >
                                        {t('tabs.bloc')}
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('post-op')}
                                        className={`min-h-11 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-bold transition-all sm:px-4 ${activeTab === 'post-op' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                    >
                                        {t('tabs.postOp')}
                                    </button>
                                </div>
                                <button onClick={() => router.push('/dashboard')} aria-label={tCommon('back')} className="flex min-h-11 shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-600 transition hover:bg-slate-50 sm:px-4">
                                    <span>←</span> {tCommon('back')}
                                </button>
                            </div>
                        </div>

                        {/* Filters & Search */}
                        <div className="flex flex-wrap gap-3">
                            <div className="relative w-full min-w-0 sm:flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                                <input
                                    type="text"
                                    placeholder={t('searchPlaceholder')}
                                    value={searchTerm}
                                    onChange={(e) => { setSearchTerm(e.target.value); setSelectedRecordIds(new Set()); }}
                                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm transition-all shadow-sm"
                                />
                            </div>

                            <div className="relative w-full sm:w-auto">
                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                                <select
                                    value={filterDate}
                                    onChange={(e) => setFilterDate(e.target.value)}
                                    className="min-h-11 w-full appearance-none rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-8 text-sm font-medium text-slate-700 shadow-sm outline-none focus:ring-2 focus:ring-indigo-500 sm:w-auto"
                                >
                                    <option value="">{t('filters.allDates')}</option>
                                    {availableDates.map(date => (
                                        <option key={date as string} value={date as string}>{date as string}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="relative w-full sm:w-auto">
                                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                                <select
                                    value={filterStatus}
                                    onChange={(e) => setFilterStatus(e.target.value)}
                                    className="min-h-11 w-full appearance-none rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-8 text-sm font-medium text-slate-700 shadow-sm outline-none focus:ring-2 focus:ring-indigo-500 sm:w-auto"
                                >
                                    <option value="stage">Étape actuelle</option>
                                    <option value="all">Tous les patients</option>
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
                            {filteredRecords.length > 0 && selectedRecords.length === filteredRecords.length ? t('deselectAll') : t('selectAll')}
                        </button>
                    </div>

                    <div className="space-y-3">
                        {filteredRecords.map(record => (
                            <div
                                key={record.id}
                                onClick={() => toggleSelection(record.id!)}
                                className={`flex cursor-pointer flex-col justify-between gap-4 rounded-xl border bg-white p-4 transition sm:flex-row sm:items-center ${selectedRecordIds.has(record.id!)
                                    ? 'border-indigo-500 bg-indigo-50/40'
                                    : 'border-slate-200 hover:border-indigo-300'
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
                                            <span className={`rounded-full px-2 py-1 text-xs font-bold ${workflowStage(record).tone}`}>{workflowStage(record).label}</span>
                                        </div>
                                        <div className="text-sm text-slate-500 flex flex-wrap items-center gap-2 mt-1">
                                            <span>{record.age || 'Âge non renseigné'}</span>
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
                                    <div className="mt-2 flex w-full flex-wrap justify-start gap-2 sm:justify-end"><button type="button" onClick={event => { event.stopPropagation(); void applyQuickAction(record); }} className="flex min-h-11 items-center gap-2 rounded-lg bg-indigo-600 px-3 text-xs font-bold text-white"><Clock3 size={15} />{quickActionFor(record).label}</button><button type="button" onClick={event => { event.stopPropagation(); router.push(`/operation?id=${record.id}`); }} className="flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-xs font-bold text-slate-700"><ExternalLink size={15} />Ouvrir</button></div>
                                </div>
                            </div>
                        ))}
                        {!loadingData && filteredRecords.length === 0 && <div className="border-y border-slate-200 bg-white p-8 text-center"><p className="font-bold text-slate-800">Aucun patient à cette étape.</p><button onClick={() => setFilterStatus('all')} className="mt-3 min-h-11 font-bold text-indigo-700">Afficher tous les patients</button></div>}
                    </div>
                </div>

                {/* BULK ACTION PANEL */}
                <div className="lg:w-96 flex-shrink-0 w-full">
                    <div className="flex flex-col rounded-xl border border-slate-200 bg-white p-5 lg:sticky lg:top-24 lg:max-h-[calc(100vh-140px)]">
                        <div className="flex-shrink-0 mb-4">
                            <h3 className="text-lg font-black text-slate-800 mb-1 flex items-center gap-2">
                                <span>⚡</span> {t('bulk.title')}
                            </h3>
                            <p className="text-sm text-slate-500">{t('bulk.subtitle', { count: selectedRecords.length })}</p>
                            <p className="mt-2 flex items-start gap-2 text-xs text-slate-500"><ShieldAlert size={15} className="mt-0.5 shrink-0 text-amber-600" />Un aperçu et les incohérences éventuelles seront affichés avant application.</p>
                        </div>

                        <div className="space-y-6 flex-1 overflow-y-auto pr-2 custom-scrollbar">
                            {activeTab === 'pre-op' && (
                                <>
                                    <div className="space-y-4">
                                        <p className="font-bold text-slate-700 text-sm uppercase">{t('bulk.sections.quickCheck')}</p>
                                        {([{ label: 'Appel pré-op', value: bulkPreOpCall, set: setBulkPreOpCall }, { label: 'Présence', value: bulkPreOpCheck, set: setBulkPreOpCheck }] as const).map(control => <fieldset key={control.label}><legend className="mb-2 text-sm font-bold text-slate-700">{control.label}</legend><div className="grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1">{([{ label: 'Ne pas modifier', value: null }, { label: 'Validé', value: true }, { label: 'Non validé', value: false }] as const).map(option => <button key={option.label} type="button" onClick={() => control.set(option.value)} className={`min-h-11 rounded-md px-2 text-xs font-bold ${control.value === option.value ? 'bg-white text-indigo-800 shadow-sm' : 'text-slate-600'}`}>{option.label}</button>)}</div></fieldset>)}
                                    </div>
                                    <div>
                                        <p className="font-bold text-slate-700 text-sm uppercase mb-2">{t('bulk.sections.blocEntry')}</p>
                                        <div className="flex gap-2"><input type="time" className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 p-3 font-bold outline-none focus:ring-2 focus:ring-blue-500" value={bulkBlockEntry} onChange={(e) => setBulkBlockEntry(e.target.value)} /><button type="button" onClick={() => setBulkBlockEntry(currentTime())} className="min-h-11 rounded-lg bg-blue-700 px-3 text-xs font-bold text-white">Maintenant</button></div>
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
                                        <div className="mb-2 grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1">{([{ value: 'no-change', label: 'Conserver' }, { value: 'replace', label: 'Remplacer' }, { value: 'clear', label: 'Retirer' }] as const).map(option => <button key={option.value} type="button" onClick={() => setBulkSurgeonMode(option.value)} className={`min-h-11 rounded-md px-2 text-xs font-bold ${bulkSurgeonMode === option.value ? 'bg-white text-indigo-800 shadow-sm' : 'text-slate-600'}`}>{option.label}</button>)}</div>
                                        <div className={`max-h-60 overflow-y-auto space-y-2 rounded-xl border border-slate-100 bg-slate-50 p-2 ${bulkSurgeonMode !== 'replace' ? 'pointer-events-none opacity-45' : ''}`}>
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
                                        <div className="flex gap-2"><input type="time" className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 p-3 font-bold outline-none focus:ring-2 focus:ring-slate-500" value={bulkBlockExit} onChange={(e) => setBulkBlockExit(e.target.value)} /><button type="button" onClick={() => setBulkBlockExit(currentTime())} className="min-h-11 rounded-lg bg-slate-800 px-3 text-xs font-bold text-white">Maintenant</button></div>
                                    </div>
                                    <div>
                                        <p className="font-bold text-slate-700 text-sm uppercase mb-2">{t('bulk.sections.postOpEntry')}</p>
                                        <div className="flex gap-2"><input type="time" className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 p-3 font-bold outline-none focus:ring-2 focus:ring-cyan-500" value={bulkPostOpEntry} onChange={(e) => setBulkPostOpEntry(e.target.value)} /><button type="button" onClick={() => setBulkPostOpEntry(currentTime())} className="min-h-11 rounded-lg bg-cyan-700 px-3 text-xs font-bold text-white">Maintenant</button></div>
                                    </div>
                                    <div>
                                        <p className="font-bold text-slate-700 text-sm uppercase mb-2">{t('bulk.sections.discharge')}</p>
                                        <div className="flex gap-2"><input type="time" className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 p-3 font-bold outline-none focus:ring-2 focus:ring-indigo-500" value={bulkDischargeTime} onChange={(e) => setBulkDischargeTime(e.target.value)} /><button type="button" onClick={() => setBulkDischargeTime(currentTime())} className="min-h-11 rounded-lg bg-indigo-700 px-3 text-xs font-bold text-white">Maintenant</button></div>
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
                                disabled={selectedRecords.length === 0 || loading}
                                className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl shadow-lg hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {loading ? <span className="animate-spin">⏳</span> : <span>💾 {t('bulk.submit', { count: selectedRecords.length })}</span>}
                            </button>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
