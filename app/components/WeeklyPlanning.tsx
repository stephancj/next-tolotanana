'use client';

import { useState, useEffect, useCallback } from 'react';
import { MedicalRecord, Edition } from '@/lib/client-db';
import LoadingSpinner from './LoadingSpinner';
import { useTranslations, useLocale } from '../providers/I18nProvider';
import { translateDay, translateGender } from '@/lib/enum-translations';
import { Locale } from '@/lib/i18n-config';

interface WeeklyPlanningProps {
    currentEdition: Edition | null;
    onBack: () => void;
    onEditOperation: (record: MedicalRecord) => void;
}

const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi'];

export default function WeeklyPlanning({ currentEdition, onBack, onEditOperation }: WeeklyPlanningProps) {
    const [selectedDay, setSelectedDay] = useState<string>(DAYS[0]);
    const [allRecords, setAllRecords] = useState<MedicalRecord[]>([]);
    const [loading, setLoading] = useState(true);

    // I18n Hooks
    const t = useTranslations('planning');
    const tCommon = useTranslations('common');
    const locale = useLocale() as Locale;

    const fetchData = useCallback(async () => {
        if (!currentEdition?.public_id) {
            setAllRecords([]);
            setLoading(false);
            return;
        }

        try {
            setLoading(true);

            // 1. Fetch remote editions to find the matching Remote ID
            const editionsRes = await fetch('/api/editions');
            if (!editionsRes.ok) throw new Error('Failed to fetch editions');
            const remoteEditions = await editionsRes.json();
            const remoteEdition = remoteEditions.find((e: Edition) => e.public_id === currentEdition.public_id);

            if (!remoteEdition) {
                console.error("Local edition not found on server");
                setAllRecords([]);
                setLoading(false);
                return;
            }

            const remoteEditionId = remoteEdition.id;

            // 2. Fetch all records
            const recordsRes = await fetch('/api/records');
            if (!recordsRes.ok) throw new Error('Failed to fetch records');
            const allRecordsData = await recordsRes.json();

            // 3. Filter by edition and planning_day
            const filtered = allRecordsData.filter((r: MedicalRecord) =>
                r.edition_id === remoteEditionId && !!r.planning_day && !r.deleted
            );

            console.log('🔍 Planning Debug:', {
                editionId: remoteEditionId,
                totalRecords: filtered.length,
                days: filtered.map((r: MedicalRecord) => r.planning_day),
                sample: filtered[0]
            });

            setAllRecords(filtered);
        } catch (err) {
            console.error("Planning fetch error:", err);
            setAllRecords([]);
        } finally {
            setLoading(false);
        }
    }, [currentEdition?.public_id]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Group by planning day
    const recordsByDay = DAYS.reduce((acc, day) => {
        acc[day] = allRecords.filter(r => r.planning_day === day);
        return acc;
    }, {} as Record<string, MedicalRecord[]>);

    console.log('📊 Records by day:', recordsByDay);

    const selectedRecords = recordsByDay[selectedDay] || [];

    if (loading) {
        return <LoadingSpinner message={t('loading')} />;
    }

    return (
        <div className="min-h-screen bg-slate-50/80 pb-24">
            {/* Header */}
            <header className="bg-white/80 backdrop-blur-xl sticky top-0 z-40 border-b border-indigo-50 px-6 py-4 shadow-sm">
                <div className="max-w-[1600px] mx-auto flex items-center justify-between">
                    <div>
                        <h2 className="text-xs font-bold text-indigo-400 tracking-[0.2em] uppercase mb-1">{t('title')}</h2>
                        <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-2">
                            📅 {t('subtitle')}
                        </h1>
                        {currentEdition && (
                            <p className="text-sm text-gray-500 mt-1">
                                {currentEdition.name} - {currentEdition.place} {currentEdition.year}
                            </p>
                        )}
                    </div>
                    <button
                        onClick={onBack}
                        className="px-5 py-2.5 bg-white text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition border border-slate-200 flex items-center gap-2"
                    >
                        <span>←</span> {tCommon('back')}
                    </button>
                </div>
            </header>

            <main className="max-w-[1600px] mx-auto p-4 md:p-8">
                {/* Day Selector */}
                <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
                    {DAYS.map(day => {
                        const count = recordsByDay[day]?.length || 0;
                        const isSelected = selectedDay === day;
                        return (
                            <button
                                key={day}
                                onClick={() => setSelectedDay(day)}
                                className={`px-6 py-3 rounded-xl font-bold transition-all whitespace-nowrap ${isSelected
                                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200'
                                    : 'bg-white text-slate-600 hover:bg-indigo-50 border border-slate-200'
                                    }`}
                            >
                                {translateDay(day, locale)}
                                {count > 0 && (
                                    <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-bold ${isSelected ? 'bg-white/20' : 'bg-indigo-100 text-indigo-700'
                                        }`}>
                                        {count}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Records List */}
                <div className="space-y-4">
                    {/* Debug Info */}
                    {allRecords.length > 0 && (
                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
                            <p className="text-sm text-blue-700">
                                📊 <strong>{allRecords.length}</strong> {t('totalScheduled')}
                                {allRecords.filter(r => !r.planning_day).length > 0 && (
                                    <span className="ml-2 text-blue-600">
                                        • <strong>{allRecords.filter(r => !r.planning_day).length}</strong> {t('unassigned')}
                                    </span>
                                )}
                            </p>
                        </div>
                    )}

                    {selectedRecords.length === 0 ? (
                        <div className="bg-white rounded-2xl p-12 text-center border border-slate-100">
                            <div className="text-6xl mb-4">📋</div>
                            <h3 className="text-xl font-bold text-slate-700 mb-2">
                                {allRecords.length === 0
                                    ? t('noOperations')
                                    : t('noOperationsForDay', { day: translateDay(selectedDay, locale) })
                                }
                            </h3>
                            <p className="text-slate-500 mb-4">
                                {allRecords.length === 0
                                    ? t('howToAdd')
                                    : t('otherDays', { count: allRecords.length })
                                }
                            </p>
                            {allRecords.length === 0 && (
                                <ol className="text-left max-w-md mx-auto space-y-2 text-sm text-slate-600">
                                    <li className="flex items-start gap-2">
                                        <span className="font-bold text-indigo-600">1.</span>
                                        <span>{t('instructions.step1')}</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="font-bold text-indigo-600">2.</span>
                                        <span>{t('instructions.step2')}</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="font-bold text-indigo-600">3.</span>
                                        <span>{t('instructions.step3')}</span>
                                    </li>
                                </ol>
                            )}
                        </div>
                    ) : (
                        selectedRecords.map((record, index) => {
                            const hasOperationData = record.block_entry_time || record.block_exit_time || record.intervention_details;
                            return (
                                <div
                                    key={record.id}
                                    className="bg-white rounded-2xl p-6 border border-slate-100 hover:shadow-md transition-shadow"
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-3 mb-3">
                                                <span className="text-2xl font-black text-indigo-600">#{index + 1}</span>
                                                <div>
                                                    <h3 className="text-lg font-bold text-slate-800">
                                                        {record.last_name} {record.first_name}
                                                    </h3>
                                                    <p className="text-sm text-slate-500">
                                                        {record.age} • {translateGender(record.gender, locale)}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                                <div>
                                                    <p className="text-xs font-bold text-slate-400 uppercase mb-1">{t('card.diagnosis')}</p>
                                                    <p className="text-sm text-slate-700">{record.clinical_diagnosis || 'Non renseigné'}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs font-bold text-slate-400 uppercase mb-1">{t('card.interventionType')}</p>
                                                    <p className="text-sm text-slate-700">{record.intervention_type || 'Non renseigné'}</p>
                                                </div>
                                            </div>

                                            {/* Pre-Op Check Status */}
                                            {record.pre_op_checked === 1 && (
                                                <div className="bg-green-50 border border-green-200 rounded-xl p-3 mb-4">
                                                    <p className="text-xs font-bold text-green-600 uppercase flex items-center gap-2">
                                                        <span>✓</span> {t('card.preOpChecked')}
                                                    </p>
                                                    {record.pre_op_checked_at && (
                                                        <p className="text-xs text-green-600 mt-1">
                                                            {new Date(record.pre_op_checked_at).toLocaleString((locale === 'en' ? 'en-US' : 'fr-FR'), {
                                                                day: '2-digit',
                                                                month: '2-digit',
                                                                hour: '2-digit',
                                                                minute: '2-digit'
                                                            })}
                                                        </p>
                                                    )}
                                                </div>
                                            )}

                                            {hasOperationData && (
                                                <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
                                                    <p className="text-xs font-bold text-green-600 uppercase mb-2 flex items-center gap-2">
                                                        <span>✓</span> {t('card.blocDataSaved')}
                                                    </p>
                                                    <div className="grid grid-cols-2 gap-3 text-sm">
                                                        {record.block_entry_time && (
                                                            <div>
                                                                <span className="text-green-700 font-medium">{t('card.entry')}:</span> {record.block_entry_time}
                                                            </div>
                                                        )}
                                                        {record.block_exit_time && (
                                                            <div>
                                                                <span className="text-green-700 font-medium">{t('card.exit')}:</span> {record.block_exit_time}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        <button
                                            onClick={() => onEditOperation(record)}
                                            className={`px-5 py-2.5 rounded-xl font-bold transition-all ${hasOperationData
                                                ? 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200'
                                                : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-200'
                                                }`}
                                        >
                                            {hasOperationData ? `📝 ${t('card.edit')}` : `✚ ${t('card.enterBloc')}`}
                                        </button>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </main>
        </div>
    );
}
