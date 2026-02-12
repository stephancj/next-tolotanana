'use client';

import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { MedicalRecord, db } from '@/lib/client-db';
import { useTranslations, useLocale } from '../providers/I18nProvider';
import { Locale } from '@/lib/i18n-config';

interface OperationFormProps {
    record: MedicalRecord;
    onBack: () => void;
    onSuccess: () => void;
}

const Icons = {
    Activity: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>,
    Save: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
};

export default function OperationForm({ record, onBack, onSuccess }: OperationFormProps) {
    // I18n Hooks
    const t = useTranslations('operations');
    const tCommon = useTranslations('common');
    const tEnums = useTranslations('enums');
    const locale = useLocale() as Locale;

    const [formData, setFormData] = useState({
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

    const [assignedSurgeonIds, setAssignedSurgeonIds] = useState<number[]>([]);
    const [loading, setLoading] = useState(false);

    // Fetch active surgeons from local DB
    const availableSurgeons = useLiveQuery(() => db.surgeons.where('is_active').equals(1).toArray()) || [];

    useEffect(() => {
        // Fetch assigned surgeons for this record
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
    }, [record.id]);

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

    const handleSubmit = async () => {
        if (!record.id) return;

        setLoading(true);
        try {
            // Update medical record with operation data
            await db.medical_records.update(record.id, {
                ...formData,
                sync_status: 'pending_update',
                updated_at: new Date().toISOString()
            });

            // Update surgeon assignments
            const existingLinks = await db.record_surgeons.where('medical_record_id').equals(record.id).toArray();
            const existingIds = existingLinks.map(l => l.id!);
            await db.record_surgeons.bulkDelete(existingIds);

            const newLinks = assignedSurgeonIds.map(sid => ({
                medical_record_id: record.id!,
                surgeon_id: sid,
                sync_status: 'pending_update' as const
            }));
            if (newLinks.length > 0) {
                await db.record_surgeons.bulkAdd(newLinks);
            }

            alert(t('messages.saveSuccess'));
            onSuccess();
        } catch (err) {
            console.error('Error saving operation data:', err);
            alert(t('messages.saveError'));
        } finally {
            setLoading(false);
        }
    };

    const [activeTab, setActiveTab] = useState<'pre-op' | 'bloc' | 'post-op'>('pre-op');

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 pb-32">
            {/* Header */}
            <header className="bg-white/90 backdrop-blur-xl sticky top-0 z-40 border-b border-blue-100 shadow-lg">
                <div className="max-w-[1400px] mx-auto px-6 py-5">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-lg">
                                <Icons.Activity />
                            </div>
                            <div>
                                <h2 className="text-xs font-bold text-blue-500 tracking-[0.2em] uppercase mb-1">{t('header.title')}</h2>
                                <h1 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">
                                    {record.last_name} {record.first_name}
                                </h1>
                                <p className="text-sm text-slate-500 mt-0.5">
                                    {record.intervention_type || 'Intervention'} • {record.planning_day}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={onBack}
                            className="px-6 py-3 bg-white text-slate-700 rounded-xl font-bold hover:bg-slate-50 transition-all border border-slate-200 shadow-sm hover:shadow flex items-center gap-2"
                        >
                            <span>←</span> {tCommon('back')}
                        </button>
                    </div>
                </div>

                {/* Tab Navigation */}
                <div className="max-w-[1400px] mx-auto px-6 mt-2">
                    <div className="flex gap-2 overflow-x-auto pb-0 md:justify-center">
                        <button
                            onClick={() => setActiveTab('pre-op')}
                            className={`px-6 py-3 font-bold text-sm rounded-t-xl transition-all relative whitespace-nowrap ${activeTab === 'pre-op'
                                ? 'bg-white text-indigo-600 border-x border-t border-blue-100 shadow-sm z-10'
                                : 'bg-slate-100 text-slate-500 hover:bg-slate-200 border-b border-blue-100'
                                }`}
                        >
                            1. {t('tabs.preOp')}
                            {activeTab === 'pre-op' && <div className="absolute bottom-[-1px] left-0 right-0 h-1 bg-white" />}
                        </button>
                        <button
                            onClick={() => setActiveTab('bloc')}
                            className={`px-6 py-3 font-bold text-sm rounded-t-xl transition-all relative whitespace-nowrap ${activeTab === 'bloc'
                                ? 'bg-white text-indigo-600 border-x border-t border-blue-100 shadow-sm z-10'
                                : 'bg-slate-100 text-slate-500 hover:bg-slate-200 border-b border-blue-100'
                                }`}
                        >
                            2. {t('tabs.bloc')}
                            {activeTab === 'bloc' && <div className="absolute bottom-[-1px] left-0 right-0 h-1 bg-white" />}
                        </button>
                        <button
                            onClick={() => setActiveTab('post-op')}
                            className={`px-6 py-3 font-bold text-sm rounded-t-xl transition-all relative whitespace-nowrap ${activeTab === 'post-op'
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

            <main className="max-w-[1400px] mx-auto p-4 md:p-8 lg:p-10 animate-fadeIn">

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
                                <div className="bg-orange-50/50 rounded-xl p-6 border border-orange-100 hover:shadow-md transition-shadow">
                                    <label className="flex items-start gap-4 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={formData.pre_op_call === 1}
                                            onChange={(e) => {
                                                const isChecked = e.target.checked;
                                                setFormData(prev => ({
                                                    ...prev,
                                                    pre_op_call: isChecked ? 1 : 0,
                                                    pre_op_call_at: isChecked ? new Date().toISOString() : ''
                                                }));
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
                                <div className="bg-emerald-50/50 rounded-xl p-6 border border-emerald-100 hover:shadow-md transition-shadow">
                                    <label className="flex items-start gap-4 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={formData.pre_op_checked === 1}
                                            onChange={(e) => {
                                                const isChecked = e.target.checked;
                                                setFormData(prev => ({
                                                    ...prev,
                                                    pre_op_checked: isChecked ? 1 : 0,
                                                    pre_op_checked_at: isChecked ? new Date().toISOString() : ''
                                                }));
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
                                <div className="bg-blue-50/50 rounded-xl p-6 border border-blue-100 md:col-span-2 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
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
                                            value={formData.block_entry_time}
                                            onChange={handleChange}
                                            className="w-full md:w-48 p-4 bg-white border-2 border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-xl font-bold text-slate-800 shadow-sm"
                                        />
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
                                            value={formData.diagnosis_category}
                                            onChange={handleChange}
                                            placeholder="Ex: Orthopédie..."
                                            className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-purple-500 outline-none font-medium transition-all"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">
                                            {t('bloc.operativeReport')}
                                        </label>
                                        <textarea
                                            name="intervention_details"
                                            value={formData.intervention_details}
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
                                        value={formData.prescription_details}
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
                                                value={formData.pharmacy_status}
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
                                            value={formData.block_exit_time}
                                            onChange={handleChange}
                                            className="w-full p-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-slate-500 outline-none transition-all text-xl font-bold text-slate-800 text-center"
                                        />
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
                                                    value={formData.post_op_room}
                                                    onChange={handleChange}
                                                    className="w-full p-2 bg-white border border-cyan-200 rounded-lg focus:ring-2 focus:ring-cyan-500 outline-none font-bold text-center"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold text-cyan-700 uppercase tracking-wider mb-1 block">{t('postOp.bed')}</label>
                                                <input
                                                    type="text"
                                                    name="post_op_bed"
                                                    value={formData.post_op_bed}
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
                                                value={formData.post_op_entry_time}
                                                onChange={handleChange}
                                                className="w-full p-2 bg-white border border-cyan-200 rounded-lg focus:ring-2 focus:ring-cyan-500 outline-none font-bold text-center text-lg"
                                            />
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
                                            value={formData.discharge_time}
                                            onChange={handleChange}
                                            className="w-full p-4 bg-white border-2 border-indigo-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-xl font-bold text-slate-800 text-center shadow-sm"
                                        />
                                    </div>

                                    <div className="md:w-2/3 flex flex-col">
                                        <label className="text-xs font-bold text-indigo-800 uppercase tracking-wider mb-2 block">
                                            {t('postOp.dischargeNotes')}
                                        </label>
                                        <textarea
                                            name="discharge_notes"
                                            value={formData.discharge_notes}
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

            {/* Floating Save Button */}
            <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50">
                <button
                    onClick={handleSubmit}
                    disabled={loading}
                    className="px-10 py-5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-2xl shadow-2xl font-bold transition-all flex items-center gap-3 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-lg"
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
