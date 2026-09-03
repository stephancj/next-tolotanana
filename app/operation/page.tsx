'use client';

import { useState, useEffect, Suspense } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { MedicalRecord, db } from '@/lib/client-db';
import { useTranslations, useLocale } from '@/app/providers/I18nProvider';
import { Locale } from '@/lib/i18n-config';
import { useRouter, useSearchParams } from 'next/navigation';
import LoadingSpinner from '@/app/components/LoadingSpinner';
import { replaceRecordSurgeons, updateMedicalRecord } from '@/lib/local-records';
import { useFeedback } from '@/app/providers/FeedbackProvider';

const normalizeMedicalValue = (value: unknown) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('fr');

const Icons = {
    Activity: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>,
    Save: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
};

function OperationFormContent() {
    const router = useRouter();
    const { notify } = useFeedback();
    const searchParams = useSearchParams();
    const id = searchParams.get('id');

    // I18n Hooks
    const t = useTranslations('operations');
    const tCommon = useTranslations('common');
    const tEnums = useTranslations('enums');
    const locale = useLocale() as Locale;

    const record = useLiveQuery(() => id ? db.medical_records.get(Number(id)) : undefined, [id]);

    const [formData, setFormData] = useState<Partial<MedicalRecord>>({});
    const [assignedSurgeonIds, setAssignedSurgeonIds] = useState<number[]>([]);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'pre-op' | 'bloc' | 'post-op'>('pre-op');

    // Fetch active surgeons from local DB
    const availableSurgeons = useLiveQuery(() => db.surgeons.where('is_active').equals(1).toArray()) || [];
    const historicalRecords = useLiveQuery<MedicalRecord[]>(() => db.medical_records.filter(item => item.deleted !== 1).toArray(), []) || [];
    const categorySuggestions = Array.from(new Set(historicalRecords.map(item => item.diagnosis_category?.trim()).filter((value): value is string => Boolean(value))));
    const categoryPrediction = (() => {
        const diagnosis = normalizeMedicalValue(record?.clinical_diagnosis);
        if (!diagnosis) return null;
        const counts = new Map<string, { value: string; count: number }>();
        let support = 0;
        for (const item of historicalRecords) {
            const category = String(item.diagnosis_category || '').trim();
            if (!category || normalizeMedicalValue(item.clinical_diagnosis) !== diagnosis || item.id === record?.id) continue;
            support += 1;
            const key = normalizeMedicalValue(category);
            const current = counts.get(key) || { value: category, count: 0 };
            current.count += 1;
            counts.set(key, current);
        }
        const winner = [...counts.values()].sort((a, b) => b.count - a.count)[0];
        if (!winner || support < 2) return null;
        const confidence = winner.count / support;
        return { value: winner.value, support, confidence, canAutoSelect: confidence >= 0.8 };
    })();
    const effectiveDiagnosisCategory = formData.diagnosis_category || (categoryPrediction?.canAutoSelect ? categoryPrediction.value : '');

    useEffect(() => {
        if (record) {
            setFormData({
                pre_op_checked: record.pre_op_checked || 0,
                pre_op_checked_at: record.pre_op_checked_at || '',
                pre_op_call: record.pre_op_call || 0,
                pre_op_call_at: record.pre_op_call_at || '',
                block_entry_time: record.block_entry_time || '',
                block_exit_time: record.block_exit_time || '',
                intervention_details: record.intervention_details || '',
                diagnosis_category: record.diagnosis_category || '',
                prescription_details: record.prescription_details || '',
                pharmacy_status: record.pharmacy_status || 'pending',
                post_op_room: record.post_op_room || '',
                post_op_bed: record.post_op_bed || '',
                post_op_entry_time: record.post_op_entry_time || '',
                discharge_time: record.discharge_time || '',
                discharge_notes: record.discharge_notes || ''
            });

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
        }
    }, [record]);

    const toggleSurgeon = (surgeonId: number) => {
        setAssignedSurgeonIds(prev =>
            prev.includes(surgeonId)
                ? prev.filter(id => id !== surgeonId)
                : [...prev, surgeonId]
        );
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const setCurrentTime = async (field: 'block_entry_time' | 'block_exit_time' | 'post_op_entry_time' | 'discharge_time') => {
        if (!record?.id) return;
        const now = new Date();
        const value = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        setFormData(previous => ({ ...previous, [field]: value }));
        await updateMedicalRecord(record.id, { [field]: value });
        notify(`Heure enregistrée sur cette tablette : ${value}`, 'success');
    };

    const handleSubmit = async () => {
        if (!record?.id) return;

        setLoading(true);
        try {
            await updateMedicalRecord(record.id, { ...formData, diagnosis_category: effectiveDiagnosisCategory });
            await replaceRecordSurgeons(record.id, assignedSurgeonIds);

            notify('Étape enregistrée sur cette tablette.', 'success');
            router.push('/planning');
        } catch (err) {
            console.error('Error saving operation data:', err);
            notify(t('messages.saveError'), 'error');
        } finally {
            setLoading(false);
        }
    };

    if (!id || (!record && !loading)) {
        if (record === undefined && id) return <LoadingSpinner message={tCommon('loading')} />;
        // If still undefined after load, or no ID
    }

    // Better loading check: useLiveQuery returns undefined while loading (if initial val undefined)
    if (!record) return <LoadingSpinner message={tCommon('loading')} />;

    return (
        <div className="clinical-operation min-h-screen bg-slate-50 pb-28">
            {/* Header */}
            <header className="sticky top-16 z-40 border-b border-slate-200 bg-white">
                <div className="mx-auto max-w-[1400px] px-4 py-3 sm:px-6 sm:py-4">
                    <div className="flex items-start justify-between gap-2">
                        <div>
                            <h2 className="text-xs font-bold text-indigo-400 tracking-[0.2em] uppercase mb-1">{t('header.title')}</h2>
                            <h1 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">
                                {record.last_name} {record.first_name}
                            </h1>
                            <p className="text-sm text-slate-500 mt-0.5">
                                {record.intervention_type || 'Intervention'} • {record.planning_day}
                            </p>
                        </div>
                        <button
                            onClick={() => router.push('/planning')}
                            className="flex min-h-11 shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-600 transition hover:bg-slate-50 sm:px-4"
                        >
                            <span>←</span> {tCommon('back')}
                        </button>
                    </div>
                </div>

                {/* Tab Navigation */}
                <div className="mx-auto mt-2 max-w-[1400px] px-4 sm:px-6">
                    <div className="flex gap-2 overflow-x-auto pb-0 md:justify-center">
                        <button
                            onClick={() => setActiveTab('pre-op')}
                            className={`relative min-h-11 whitespace-nowrap rounded-t-xl px-4 py-3 text-sm font-bold transition-all sm:px-6 ${activeTab === 'pre-op'
                                ? 'bg-white text-indigo-600 border-x border-t border-blue-100 shadow-sm z-10'
                                : 'bg-slate-100 text-slate-500 hover:bg-slate-200 border-b border-blue-100'
                                }`}
                        >
                            1. {t('tabs.preOp')}
                            {activeTab === 'pre-op' && <div className="absolute bottom-[-1px] left-0 right-0 h-1 bg-white" />}
                        </button>
                        <button
                            onClick={() => setActiveTab('bloc')}
                            className={`relative min-h-11 whitespace-nowrap rounded-t-xl px-4 py-3 text-sm font-bold transition-all sm:px-6 ${activeTab === 'bloc'
                                ? 'bg-white text-indigo-600 border-x border-t border-blue-100 shadow-sm z-10'
                                : 'bg-slate-100 text-slate-500 hover:bg-slate-200 border-b border-blue-100'
                                }`}
                        >
                            2. {t('tabs.bloc')}
                            {activeTab === 'bloc' && <div className="absolute bottom-[-1px] left-0 right-0 h-1 bg-white" />}
                        </button>
                        <button
                            onClick={() => setActiveTab('post-op')}
                            className={`relative min-h-11 whitespace-nowrap rounded-t-xl px-4 py-3 text-sm font-bold transition-all sm:px-6 ${activeTab === 'post-op'
                                ? 'bg-white text-indigo-600 border-x border-t border-blue-100 shadow-sm z-10'
                                : 'bg-slate-100 text-slate-500 hover:bg-slate-200 border-b border-blue-100'
                                }`}
                        >
                            3. {t('tabs.postOp')}
                            {activeTab === 'post-op' && <div className="absolute bottom-[-1px] left-0 right-0 h-1 bg-white" />}
                        </button>
                    </div>
                </div>
            </header>

            <main className="mx-auto max-w-[1200px] p-4 md:p-7">

                {/* PRE-OP TAB */}
                {activeTab === 'pre-op' && (
                    <div className="space-y-6 max-w-5xl mx-auto">
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 md:p-8">
                            <h2 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-3">
                                <span className="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center text-xl">📞</span>
                                {t('preOp.responsible')}
                            </h2>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Pre-Op Call */}
                                <div className="rounded-xl border border-orange-100 bg-orange-50/50 p-4 transition-shadow hover:shadow-md sm:p-6">
                                    <label className="flex items-start gap-4 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={formData.pre_op_call === 1}
                                            onChange={(e) => {
                                                const isChecked = e.target.checked;
                                                const patch = { pre_op_call: isChecked ? 1 : 0, pre_op_call_at: isChecked ? new Date().toISOString() : '' };
                                                setFormData(prev => ({ ...prev, ...patch }));
                                                if (record.id) void updateMedicalRecord(record.id, patch).then(() => notify('Appel pré-op enregistré.', 'success'));
                                            }}
                                            className="w-6 h-6 rounded border-2 border-orange-400 text-orange-600 focus:ring-2 focus:ring-orange-500 mt-1 shrink-0"
                                        />
                                        <div className="flex-1">
                                            <p className="text-lg font-bold text-orange-900">{t('preOp.callCompleted')}</p>
                                            <p className="text-orange-700 mt-1 text-sm leading-relaxed">{t('preOp.callDescription')}</p>
                                            {formData.pre_op_call === 1 && formData.pre_op_call_at && (
                                                <p className="text-sm text-orange-600 mt-3 font-bold bg-white/50 inline-block px-3 py-1 rounded-lg">
                                                    ✅ {t('preOp.validatedOn')} {new Date(formData.pre_op_call_at).toLocaleString((locale === 'en' ? 'en-US' : 'fr-FR'))}
                                                </p>
                                            )}
                                        </div>
                                    </label>
                                </div>

                                {/* Pre-Op Check */}
                                <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4 transition-shadow hover:shadow-md sm:p-6">
                                    <label className="flex items-start gap-4 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={formData.pre_op_checked === 1}
                                            onChange={(e) => {
                                                const isChecked = e.target.checked;
                                                const patch = { pre_op_checked: isChecked ? 1 : 0, pre_op_checked_at: isChecked ? new Date().toISOString() : '' };
                                                setFormData(prev => ({ ...prev, ...patch }));
                                                if (record.id) void updateMedicalRecord(record.id, patch).then(() => notify('Présence pré-op enregistrée.', 'success'));
                                            }}
                                            className="w-6 h-6 rounded border-2 border-emerald-400 text-emerald-600 focus:ring-2 focus:ring-emerald-500 mt-1 shrink-0"
                                        />
                                        <div className="flex-1">
                                            <p className="text-lg font-bold text-emerald-900">{t('preOp.presenceCheck')}</p>
                                            <p className="text-emerald-700 mt-1 text-sm leading-relaxed">{t('preOp.presenceDescription')}</p>
                                            {formData.pre_op_checked === 1 && formData.pre_op_checked_at && (
                                                <p className="text-sm text-emerald-600 mt-3 font-bold bg-white/50 inline-block px-3 py-1 rounded-lg">
                                                    ✅ {t('preOp.validatedOn')} {new Date(formData.pre_op_checked_at).toLocaleString((locale === 'en' ? 'en-US' : 'fr-FR'))}
                                                </p>
                                            )}
                                        </div>
                                    </label>
                                </div>

                                {/* Block Entry Time - Full Width */}
                                <div className="flex flex-col gap-4 rounded-xl border border-blue-100 bg-blue-50/50 p-4 sm:p-6 md:col-span-2 md:flex-row md:items-center md:justify-between">
                                    <div className="flex items-center gap-4">
                                        <span className="text-3xl bg-white p-2 rounded-lg shadow-sm">🚪</span>
                                        <div>
                                            <h3 className="font-bold text-slate-800 text-xl">{t('bloc.entry')}</h3>
                                            <p className="text-slate-500 text-sm">{t('bloc.entryDescription')}</p>
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-1 w-full md:w-auto">
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block md:hidden">
                                            {t('bloc.entryTime')}
                                        </label>
                                        <input
                                            type="time"
                                            name="block_entry_time"
                                            value={formData.block_entry_time || ''}
                                            onChange={handleChange}
                                            className="w-full md:w-48 p-4 bg-white border-2 border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-xl font-bold text-slate-800 shadow-sm"
                                        />
                                        <button type="button" onClick={() => setCurrentTime('block_entry_time')} className="mt-2 min-h-11 w-full rounded-lg bg-blue-700 px-4 text-sm font-bold text-white md:w-48">Maintenant</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* BLOC Tab */}
                {activeTab === 'bloc' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Column 1: Medical Details */}
                        <div className="space-y-6">
                            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 h-full">
                                <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2 border-b border-slate-50 pb-4">
                                    <span className="text-purple-600 p-2 bg-purple-50 rounded-lg">📝</span> {t('bloc.interventionDetails')}
                                </h3>
                                <div className="space-y-6">
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">
                                            {t('bloc.category')}
                                        </label>
                                        <input
                                            type="text"
                                            name="diagnosis_category"
                                            value={effectiveDiagnosisCategory}
                                            onChange={handleChange}
                                            placeholder="Ex: Hernie, Lipome…"
                                            list="diagnosis-category-suggestions"
                                            className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-purple-500 outline-none font-medium transition-all"
                                        />
                                        <datalist id="diagnosis-category-suggestions">{categorySuggestions.map(value => <option key={value} value={value} />)}</datalist>
                                        {categoryPrediction && <p className="mt-2 text-xs text-slate-500">{categoryPrediction.canAutoSelect && !formData.diagnosis_category ? 'Catégorie préselectionnée' : 'Suggestion'} depuis {categoryPrediction.support} dossier(s) au diagnostic identique, confiance {Math.round(categoryPrediction.confidence * 100)} %. À confirmer.</p>}
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">
                                            {t('bloc.operativeReport')}
                                        </label>
                                        <textarea
                                            name="intervention_details"
                                            value={formData.intervention_details || ''}
                                            onChange={handleChange}
                                            rows={8}
                                            placeholder={t('bloc.procedurePlaceholder')}
                                            className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-purple-500 outline-none resize-none leading-relaxed transition-all"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Column 2: Team & Prescription */}
                        <div className="space-y-6">
                            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                                <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2 border-b border-slate-50 pb-4">
                                    <span className="text-emerald-600 p-2 bg-emerald-50 rounded-lg">👨‍⚕️</span> {t('bloc.team')}
                                </h3>
                                <div className="space-y-3 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                                    {availableSurgeons.length === 0 ? (
                                        <p className="text-slate-400 italic text-sm text-center py-4 bg-slate-50 rounded-lg">{t('bloc.noSurgeons')}</p>
                                    ) : (
                                        availableSurgeons.map(surgeon => (
                                            <div
                                                key={surgeon.id}
                                                onClick={() => toggleSurgeon(surgeon.id!)}
                                                className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex items-center gap-4 group ${assignedSurgeonIds.includes(surgeon.id!)
                                                    ? 'border-emerald-500 bg-emerald-50'
                                                    : 'border-slate-100 hover:border-emerald-200 hover:bg-slate-50'
                                                    }`}
                                            >
                                                <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-colors ${assignedSurgeonIds.includes(surgeon.id!) ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-white border-slate-200 group-hover:border-emerald-300'}`}>
                                                    {assignedSurgeonIds.includes(surgeon.id!) && <span className="text-xs">✓</span>}
                                                </div>
                                                <span className={`font-bold text-sm ${assignedSurgeonIds.includes(surgeon.id!) ? 'text-emerald-800' : 'text-slate-700'}`}>{surgeon.name}</span>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                                <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2 border-b border-slate-50 pb-4">
                                    <span className="text-blue-600 p-2 bg-blue-50 rounded-lg">💊</span> {t('prescription.title')}
                                </h3>
                                <div className="space-y-4">
                                    <textarea
                                        name="prescription_details"
                                        value={formData.prescription_details || ''}
                                        onChange={handleChange}
                                        rows={4}
                                        placeholder={t('prescription.detailsPlaceholder')}
                                        className="w-full p-4 bg-blue-50/30 border-2 border-blue-100 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none resize-none text-sm leading-relaxed transition-all"
                                    />
                                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 hover:border-blue-300 transition-colors">
                                        <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">{t('prescription.pharmacyStatus')}</label>
                                        <div className="relative">
                                            <select
                                                name="pharmacy_status"
                                                value={formData.pharmacy_status || 'pending'}
                                                onChange={handleChange}
                                                className="w-full bg-transparent font-bold text-slate-800 outline-none cursor-pointer appearance-none z-10 relative py-1"
                                            >
                                                <option value="pending">⏳ {tEnums('pharmacyStatus.pending')}</option>
                                                <option value="retrieved">✅ {tEnums('pharmacyStatus.retrieved')}</option>
                                                <option value="none">❌ {tEnums('pharmacyStatus.none')}</option>
                                            </select>
                                            <div className="absolute right-0 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">▼</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* POST-OP Tab */}
                {activeTab === 'post-op' && (
                    <div className="space-y-6 max-w-5xl mx-auto">
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 md:p-8">
                            <h2 className="text-xl font-black text-slate-800 mb-8 flex items-center gap-3">
                                <span className="w-10 h-10 rounded-xl bg-cyan-100 text-cyan-600 flex items-center justify-center text-xl">🛌</span>
                                {t('postOp.responsible')}
                            </h2>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                {/* Block Exit */}
                                <div className="bg-slate-50 rounded-xl p-6 border-2 border-slate-100 flex flex-col justify-between">
                                    <div className="flex items-center gap-3 mb-4">
                                        <span className="text-3xl bg-white p-2 rounded-lg shadow-sm">🏁</span>
                                        <h3 className="font-bold text-slate-800 text-lg">{t('bloc.exit')}</h3>
                                    </div>
                                    <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">
                                            {t('bloc.exitTime')}
                                        </label>
                                        <input
                                            type="time"
                                            name="block_exit_time"
                                            value={formData.block_exit_time || ''}
                                            onChange={handleChange}
                                            className="w-full p-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-slate-500 outline-none transition-all text-xl font-bold text-slate-800 text-center"
                                        />
                                        <button type="button" onClick={() => setCurrentTime('block_exit_time')} className="mt-2 min-h-11 w-full rounded-lg bg-slate-800 px-4 text-sm font-bold text-white">Maintenant</button>
                                    </div>
                                </div>

                                {/* Post-Op Entry */}
                                <div className="bg-cyan-50/50 rounded-xl p-6 border border-cyan-100 flex flex-col gap-4">
                                    <div className="flex items-center gap-3">
                                        <span className="text-3xl bg-white p-2 rounded-lg shadow-sm text-cyan-500">🏥</span>
                                        <div>
                                            <h3 className="font-bold text-slate-800 text-lg">{t('postOp.recoveryRoom')}</h3>
                                            <p className="text-cyan-700 text-xs">{t('postOp.patientSetup')}</p>
                                        </div>
                                    </div>

                                    <div className="bg-white/60 p-4 rounded-xl border border-cyan-100 space-y-4">
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="text-[10px] font-bold text-cyan-700 uppercase tracking-wider mb-1 block">{t('postOp.room')}</label>
                                                <input
                                                    type="text"
                                                    name="post_op_room"
                                                    value={formData.post_op_room || ''}
                                                    onChange={handleChange}
                                                    className="w-full p-2 bg-white border border-cyan-200 rounded-lg focus:ring-2 focus:ring-cyan-500 outline-none font-bold text-center"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold text-cyan-700 uppercase tracking-wider mb-1 block">{t('postOp.bed')}</label>
                                                <input
                                                    type="text"
                                                    name="post_op_bed"
                                                    value={formData.post_op_bed || ''}
                                                    onChange={handleChange}
                                                    className="w-full p-2 bg-white border border-cyan-200 rounded-lg focus:ring-2 focus:ring-cyan-500 outline-none font-bold text-center"
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-cyan-700 uppercase tracking-wider mb-1 block">{t('postOp.setupTime')}</label>
                                            <input
                                                type="time"
                                                name="post_op_entry_time"
                                                value={formData.post_op_entry_time || ''}
                                                onChange={handleChange}
                                                className="w-full p-2 bg-white border border-cyan-200 rounded-lg focus:ring-2 focus:ring-cyan-500 outline-none font-bold text-center text-lg"
                                            />
                                            <button type="button" onClick={() => setCurrentTime('post_op_entry_time')} className="mt-2 min-h-11 w-full rounded-lg bg-cyan-700 px-4 text-sm font-bold text-white">Maintenant</button>
                                        </div>
                                    </div>
                                </div>

                                {/* Discharge - Full Width on md */}
                                <div className="bg-indigo-50/50 rounded-xl p-6 border border-indigo-100 md:col-span-2 flex flex-col md:flex-row gap-6">
                                    <div className="md:w-1/3 border-b md:border-b-0 md:border-r border-indigo-100 pb-4 md:pb-0 md:pr-6">
                                        <div className="flex items-center gap-3 mb-4">
                                            <span className="text-3xl bg-white p-2 rounded-lg shadow-sm text-indigo-500">👋</span>
                                            <div>
                                                <h3 className="font-bold text-slate-800 text-lg">{t('postOp.finalDischarge')}</h3>
                                                <p className="text-indigo-600 text-xs">{t('postOp.dischargeTitle')}</p>
                                            </div>
                                        </div>
                                        <label className="text-xs font-bold text-indigo-800 uppercase tracking-wider mb-2 block">
                                            {t('postOp.dischargeTime')}
                                        </label>
                                        <input
                                            type="time"
                                            name="discharge_time"
                                            value={formData.discharge_time || ''}
                                            onChange={handleChange}
                                            className="w-full p-4 bg-white border-2 border-indigo-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-xl font-bold text-slate-800 text-center shadow-sm"
                                        />
                                        <button type="button" onClick={() => setCurrentTime('discharge_time')} className="mt-2 min-h-11 w-full rounded-lg bg-indigo-700 px-4 text-sm font-bold text-white">Maintenant</button>
                                    </div>

                                    <div className="md:w-2/3 flex flex-col">
                                        <label className="text-xs font-bold text-indigo-800 uppercase tracking-wider mb-2 block">
                                            {t('postOp.dischargeNotes')}
                                        </label>
                                        <textarea
                                            name="discharge_notes"
                                            value={formData.discharge_notes || ''}
                                            onChange={handleChange}
                                            placeholder={t('postOp.dischargeNotesPlaceholder')}
                                            className="w-full h-full min-h-[120px] p-4 bg-white border-2 border-indigo-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none resize-none font-medium text-slate-700 leading-relaxed shadow-sm"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </main>

            {/* Persistent save action */}
            <div className="mobile-safe-bottom fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 px-3 pt-3 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur">
                <button
                    onClick={handleSubmit}
                    disabled={loading}
                    className="mx-auto flex min-h-12 w-full max-w-md items-center justify-center gap-3 rounded-lg bg-indigo-600 px-6 font-bold text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                    {loading ? (
                        <>
                            <span className="animate-spin text-xl">⏳</span>
                            <span>{tCommon('saving')}</span>
                        </>
                    ) : (
                        <>
                            <Icons.Save />
                            <span>{tCommon('save')} ({activeTab === 'pre-op' ? t('tabs.preOp') : activeTab === 'bloc' ? t('tabs.bloc') : t('tabs.postOp')})</span>
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}

export default function OperationFormPage() {
    return (
        <Suspense fallback={<LoadingSpinner />}>
            <OperationFormContent />
        </Suspense>
    );
}
