'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { MedicalRecord } from '@/lib/client-db';
import LoadingSpinner from './LoadingSpinner';
import { useTranslations, useLocale } from '../providers/I18nProvider';
import { useEdition } from '../providers/EditionProvider';
import { useRouter } from 'next/navigation';
import { translateDay, translateDistance } from '@/lib/enum-translations';
import { Locale } from '@/lib/i18n-config';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

// Icons
const Icons = {
    Users: () => <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>,
    Calendar: () => <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
    Check: () => <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    Clock: () => <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    Chart: () => <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" /></svg>
};

export default function Dashboard() {
    const { currentEdition, isLoading: isEditionLoading } = useEdition();
    const router = useRouter();
    const [records, setRecords] = useState<MedicalRecord[]>([]);
    const [loadingRecords, setLoadingRecords] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const t = useTranslations('dashboard');
    const tCommon = useTranslations('common');

    const locale = useLocale() as Locale;

    const onNavigate = (path: string) => router.push(path);
    const onEdit = (record: MedicalRecord) => router.push(`/form?id=${record.id}`);

    const fetchData = useCallback(async () => {
        if (!currentEdition?.public_id) {
            setRecords([]);
            setLoadingRecords(false);
            return;
        }

        try {
            setRefreshing(true);

            // 1. Fetch remote editions to find the matching Remote ID for our current edition
            const editionsRes = await fetch('/api/editions');
            if (!editionsRes.ok) throw new Error('Failed to fetch editions');
            const remoteEditions = await editionsRes.json();
            const remoteEdition = remoteEditions.find((e: any) => e.public_id === currentEdition.public_id);

            if (!remoteEdition) {
                console.error("Local edition not found on server");
                setRecords([]);
                return;
            }

            const remoteEditionId = remoteEdition.id;

            // 2. Fetch all records (ideally API should filter, but for now fetch all)
            const recordsRes = await fetch('/api/records');
            if (!recordsRes.ok) throw new Error('Failed to fetch records');
            const allRecords = await recordsRes.json();

            // 3. Filter by Remote Edition ID and deleted status
            const filtered = allRecords.filter((r: MedicalRecord) =>
                r.edition_id === remoteEditionId && !r.deleted
            );

            setRecords(filtered);
        } catch (err) {
            console.error("Dashboard fetch error:", err);
        } finally {
            setLoadingRecords(false);
            setRefreshing(false);
        }
    }, [currentEdition?.public_id]);

    useEffect(() => {
        if (!isEditionLoading) {
            fetchData();
        }
    }, [fetchData, isEditionLoading]);

    // Combined loading state
    const loading = isEditionLoading || loadingRecords;

    const stats = useMemo(() => {
        if (loading && records.length === 0) return null;
        // ... (rest is same, just ensuring variables match)
        // copy pasting stats logic below...

        const total = records.length;
        const programmed = records.filter(r => !!r.program_mission).length;
        const pending = total - programmed;

        // Stats by Planning Day (only programmed patients)
        const days = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi'];
        const byDay = days.map(day => ({
            name: day,
            count: records.filter(r => r.program_mission === 1 && r.planning_day === day).length
        }));
        const undefinedDay = records.filter(r => r.program_mission === 1 && !days.includes(r.planning_day || '')).length;
        if (undefinedDay > 0) byDay.push({ name: 'A définir', count: undefinedDay });

        // Stats by Gender (with detailed breakdown)
        const male = records.filter(r => r.gender === 'M').length;
        const maleProgrammed = records.filter(r => r.gender === 'M' && r.program_mission === 1).length;
        const malePending = male - maleProgrammed;

        const female = records.filter(r => r.gender === 'F').length;
        const femaleProgrammed = records.filter(r => r.gender === 'F' && r.program_mission === 1).length;
        const femalePending = female - femaleProgrammed;

        // Stats by Origin/Distance (with detailed breakdown)
        const local = records.filter(r => r.distance === 'en ville' || r.distance === 'En ville').length;
        const localProgrammed = records.filter(r => (r.distance === 'en ville' || r.distance === 'En ville') && r.program_mission === 1).length;
        const localPending = local - localProgrammed;

        const nearby = records.filter(r => r.distance === 'un peu loin').length;
        const nearbyProgrammed = records.filter(r => r.distance === 'un peu loin' && r.program_mission === 1).length;
        const nearbyPending = nearby - nearbyProgrammed;

        const far = records.filter(r => r.distance === 'loin').length;
        const farProgrammed = records.filter(r => r.distance === 'loin' && r.program_mission === 1).length;
        const farPending = far - farProgrammed;

        const unspecified = records.filter(r => !r.distance || r.distance === 'non précisé').length;
        const unspecifiedProgrammed = records.filter(r => (!r.distance || r.distance === 'non précisé') && r.program_mission === 1).length;
        const unspecifiedPending = unspecified - unspecifiedProgrammed;

        const today = new Date().toISOString().split('T')[0];
        const createdToday = records.filter(r => r.created_at && String(r.created_at).startsWith(today)).length;

        // Operation Stats
        const durations = records
            .filter(r => r.block_entry_time && r.block_exit_time)
            .map(r => {
                // Handle both ISO strings and "HH:mm"
                const getDate = (t: string) => {
                    if (t.includes('T')) return new Date(t);
                    return new Date(`1970-01-01T${t}`);
                };
                const start = getDate(r.block_entry_time!);
                const end = getDate(r.block_exit_time!);
                return (end.getTime() - start.getTime()) / (1000 * 60); // minutes
            })
            .filter(d => d > 0);

        const realOperations = durations.length;
        const minDuration = realOperations > 0 ? Math.min(...durations) : 0;
        const maxDuration = realOperations > 0 ? Math.max(...durations) : 0;
        const avgDuration = realOperations > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / realOperations) : 0;

        // Clinical Stats (Operated Only)
        const anesthesiaStats = records
            .filter(r => r.block_entry_time && r.block_exit_time)
            .reduce((acc, r) => {
                // Normalize keys for translation matching if possible, or keep raw
                const type = r.anesthesia_type || 'undefined';
                // Simple normalization for common types to match translation keys if needed
                // For now, we'll use the raw value and handle display mapping in the UI
                acc[type] = (acc[type] || 0) + 1;
                return acc;
            }, {} as Record<string, number>);

        const diagnosticStats = records
            .filter(r => r.block_entry_time && r.block_exit_time && r.diagnosis_category)
            .reduce((acc, r) => {
                const cat = r.diagnosis_category!;
                acc[cat] = (acc[cat] || 0) + 1;
                return acc;
            }, {} as Record<string, number>);




        // Recent Records (Last 5)
        const recentRecords = [...records]
            .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
            .slice(0, 5);

        return {
            total, programmed, pending, byDay,
            male, maleProgrammed, malePending,
            female, femaleProgrammed, femalePending,
            local, localProgrammed, localPending,
            nearby, nearbyProgrammed, nearbyPending,
            far, farProgrammed, farPending,
            unspecified, unspecifiedProgrammed, unspecifiedPending,
            createdToday, recentRecords,
            realOperations, minDuration, maxDuration, avgDuration,
            anesthesiaStats, diagnosticStats
        };
    }, [records, loading]);

    if (loading && records.length === 0) {
        return <LoadingSpinner message={tCommon('loading')} />;
    }

    // Default stats object to prevent crashes if stats is null (though loading check handles most)
    const s = stats || {
        total: 0, programmed: 0, pending: 0, byDay: [],
        male: 0, maleProgrammed: 0, malePending: 0,
        female: 0, femaleProgrammed: 0, femalePending: 0,
        local: 0, localProgrammed: 0, localPending: 0,
        nearby: 0, nearbyProgrammed: 0, nearbyPending: 0,
        far: 0, farProgrammed: 0, farPending: 0,
        unspecified: 0, unspecifiedProgrammed: 0, unspecifiedPending: 0,
        createdToday: 0, recentRecords: [],
        realOperations: 0, minDuration: 0, maxDuration: 0, avgDuration: 0,
        anesthesiaStats: {} as Record<string, number>,
        diagnosticStats: {} as Record<string, number>
    };

    const anesthesiaData = Object.entries(s.anesthesiaStats).map(([name, value]) => ({ name, value }));
    const diagnosticData = Object.entries(s.diagnosticStats).map(([name, value]) => ({ name, value }));


    return (
        <div className="w-full max-w-[1600px] mx-auto p-4 md:p-8 pb-24 text-slate-800 animate-fadeIn relative">

            {refreshing && (
                <div className="absolute top-4 right-4 z-50 bg-white/80 px-3 py-1 rounded-full text-xs font-bold text-indigo-600 border border-indigo-100 shadow-sm animate-pulse">
                    {tCommon('refreshing')}
                </div>
            )}

            {/* HEADER */}
            <div className="flex items-center justify-between gap-4 mb-8 border-b border-indigo-50 pb-6">
                <div>
                    <h2 className="text-xs font-bold text-indigo-400 tracking-[0.2em] uppercase mb-1">{t('header.title')}</h2>
                    <h1 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">
                        {t('header.subtitle')}
                    </h1>
                </div>
            </div>

            {/* COMBINED STATS GRID */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                {/* PATIENT PIPELINE CARD */}
                <div
                    onClick={() => onNavigate('list')}
                    className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 cursor-pointer group hover:shadow-md transition-all relative overflow-hidden"
                >
                    <div className="absolute top-0 right-0 p-4 opacity-5 text-indigo-600 transform group-hover:scale-110 transition-transform">
                        <svg className="w-32 h-32" fill="currentColor" viewBox="0 0 20 20"><path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z"></path></svg>
                    </div>

                    <div className="relative z-10">
                        <div className="flex justify-between items-start mb-6">
                            <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                                <span className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">👥</span>
                                {t('stats.totalPatients')}
                            </h3>
                            <div className="text-right">
                                <div className="text-4xl font-black text-slate-800 transition-all group-hover:text-indigo-600">{s.total}</div>
                                {s.createdToday > 0 && (
                                    <span className="inline-block mt-1 text-xs font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                                        +{s.createdToday} {tCommon('today')}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Progress Bar Area */}
                        <div className="space-y-5">
                            <div>
                                <div className="flex justify-between text-sm font-bold mb-1.5">
                                    <span className="text-emerald-600 flex items-center gap-1.5">
                                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                        {t('stats.programmed')}
                                    </span>
                                    <span className="text-slate-500">{Math.round((s.programmed / (s.total || 1)) * 100)}%</span>
                                </div>
                                <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                                    <div className="bg-emerald-500 h-full rounded-full transition-all duration-1000" style={{ width: `${(s.programmed / (s.total || 1)) * 100}%` }}></div>
                                </div>
                                <div className="text-xs text-slate-400 font-medium mt-1 pl-3.5">{s.programmed} patients</div>
                            </div>

                            <div>
                                <div className="flex justify-between text-sm font-bold mb-1.5">
                                    <span className="text-orange-500 flex items-center gap-1.5">
                                        <span className="w-2 h-2 rounded-full bg-orange-400"></span>
                                        {t('stats.notProgrammed')}
                                    </span>
                                    <span className="text-slate-500">{Math.round((s.pending / (s.total || 1)) * 100)}%</span>
                                </div>
                                <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                                    <div className="bg-orange-400 h-full rounded-full transition-all duration-1000" style={{ width: `${(s.pending / (s.total || 1)) * 100}%` }}></div>
                                </div>
                                <div className="text-xs text-slate-400 font-medium mt-1 pl-3.5">{s.pending} patients</div>
                            </div>
                        </div>

                        <div className="mt-6 pt-4 border-t border-slate-50 flex justify-between items-center text-sm">
                            <span className="font-bold text-slate-400 uppercase tracking-wider text-xs">{t('stats.fillRate')}</span>
                            <span className="font-black text-indigo-600 text-lg">{s.total > 0 ? Math.round((s.programmed / s.total) * 100) : 0}%</span>
                        </div>
                    </div>
                </div>

                {/* BLOCK PERFORMANCE CARD */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden flex flex-col justify-between">
                    <div className="absolute top-0 right-0 p-4 opacity-5 text-violet-600">
                        <svg className="w-32 h-32" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>

                    <div className="relative z-10 h-full flex flex-col">
                        <h3 className="font-bold text-lg text-slate-800 mb-6 flex items-center gap-2">
                            <span className="p-2 bg-violet-50 text-violet-600 rounded-lg">⏱️</span>
                            {t('blockPerformance.title')}
                        </h3>

                        <div className="flex flex-col sm:flex-row gap-8 flex-1">
                            <div className="flex-1 flex flex-col justify-center">
                                <div className="text-xs text-slate-400 font-bold uppercase mb-1 tracking-wider">{t('blockPerformance.realOps')}</div>
                                <div className="text-5xl font-black text-violet-900 mb-2">{s.realOperations}</div>
                                <div className="text-xs font-bold text-violet-600 bg-violet-50 px-3 py-1.5 rounded-lg inline-block self-start">
                                    {t('blockPerformance.ofProgrammed', { count: s.programmed })}
                                </div>
                            </div>

                            <div className="flex-1 flex flex-col justify-center space-y-3">
                                <div className="flex justify-between items-center p-4 bg-blue-50/50 rounded-2xl border border-blue-100/50">
                                    <div className="text-xs font-bold text-blue-800 uppercase">{t('blockPerformance.avgDuration')}</div>
                                    <div className="text-xl font-black text-blue-900">{Math.floor(s.avgDuration / 60)}h {s.avgDuration % 60}m</div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-100/50">
                                        <div className="text-[10px] font-bold text-emerald-800 uppercase mb-1">Min</div>
                                        <div className="text-sm font-black text-emerald-900">{Math.floor(s.minDuration / 60)}h {s.minDuration % 60}m</div>
                                    </div>
                                    <div className="p-3 bg-orange-50/50 rounded-xl border border-orange-100/50">
                                        <div className="text-[10px] font-bold text-orange-800 uppercase mb-1">Max</div>
                                        <div className="text-sm font-black text-orange-900">{Math.floor(s.maxDuration / 60)}h {s.maxDuration % 60}m</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* PLANNING & RECENT */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
                {/* PLANNING SEMAINE */}
                <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                            <span className="p-2 bg-indigo-50 text-indigo-600 rounded-lg"><Icons.Calendar /></span>
                            {t('planning.title')}
                        </h3>
                    </div>
                    <div className="space-y-4">
                        {s.byDay.map((day) => (
                            <div key={day.name} className="relative">
                                <div className="flex justify-between items-center mb-1 text-sm font-bold">
                                    <span className="text-slate-600">{translateDay(day.name, locale)}</span>
                                    <span className="text-slate-800 bg-slate-100 px-2 py-0.5 rounded-full">{day.count} patients</span>
                                </div>
                                <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                                    <div
                                        className="bg-gradient-to-r from-emerald-400 to-teal-500 h-3 rounded-full transition-all duration-1000"
                                        style={{ width: `${s.programmed > 0 ? (day.count / s.programmed) * 100 : 0}%` }}
                                    ></div>
                                </div>
                            </div>
                        ))}
                        {s.programmed === 0 && (
                            <div className="text-center py-8 text-gray-400 text-sm italic">
                                {t('planning.noPatients')}
                            </div>
                        )}
                    </div>
                </div>

                {/* RECENT PATIENTS */}
                <div className="lg:col-span-1 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col">
                    <div className="p-6 border-b border-gray-50 flex justify-between items-center">
                        <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                            <span className="p-2 bg-slate-100 text-slate-600 rounded-lg"><Icons.Clock /></span>
                            {t('recentPatients.title')}
                        </h3>
                    </div>
                    <div className="p-4 flex-1 overflow-y-auto max-h-[400px]">
                        {s.recentRecords.length > 0 ? (
                            <div className="space-y-3">
                                {s.recentRecords.map((r, i) => (
                                    <div
                                        key={i}
                                        className="flex items-center gap-4 p-4 rounded-xl border border-gray-100 hover:border-indigo-200 hover:bg-indigo-50/30 transition-all cursor-pointer group"
                                        onClick={() => onEdit(r)}
                                    >
                                        <div className="flex-shrink-0 w-12">
                                            <div className="text-[10px] font-bold text-gray-400 uppercase mb-0.5">{t('recentPatients.dossier')}</div>
                                            <div className="font-black text-slate-800 text-sm">{r.dossier_number || '-'}</div>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="font-bold text-slate-800 truncate text-sm">
                                                {r.last_name} {r.first_name}
                                            </div>
                                            <div className="flex items-center gap-2 text-xs text-gray-500">
                                                <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold ${r.gender === 'M' ? 'bg-blue-100 text-blue-800' : 'bg-pink-100 text-pink-800'}`}>
                                                    {r.gender}
                                                </span>
                                                <span className="truncate max-w-[100px]">{r.clinical_diagnosis || '-'}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="py-12 text-center text-gray-400 italic">
                                {t('recentPatients.noData')}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* DEMOGRAPHICS GRID */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                {/* REPARTITION GENRE */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <h3 className="font-bold text-lg text-slate-800 mb-6 flex items-center gap-2">
                        <span className="p-2 bg-pink-50 text-pink-600 rounded-lg"><Icons.Users /></span>
                        {t('gender.title')}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Hommes */}
                        <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-5 rounded-xl border-2 border-blue-200">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-4xl">👨</span>
                                <span className="font-black text-blue-900 text-3xl">{s.male}</span>
                            </div>
                            <div className="text-sm font-bold text-blue-800 mb-3">{t('gender.men')}</div>
                            <div className="space-y-2">
                                <div className="flex justify-between items-center bg-white/60 px-3 py-2 rounded-lg">
                                    <span className="text-xs font-medium text-blue-700">✓ {t('gender.programmed')}</span>
                                    <span className="font-bold text-blue-900">{s.maleProgrammed}</span>
                                </div>
                                <div className="flex justify-between items-center bg-white/60 px-3 py-2 rounded-lg">
                                    <span className="text-xs font-medium text-blue-700">⏳ {t('gender.notProgrammed')}</span>
                                    <span className="font-bold text-blue-900">{s.malePending}</span>
                                </div>
                            </div>
                        </div>

                        {/* Femmes */}
                        <div className="bg-gradient-to-br from-pink-50 to-pink-100 p-5 rounded-xl border-2 border-pink-200">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-4xl">👩</span>
                                <span className="font-black text-pink-900 text-3xl">{s.female}</span>
                            </div>
                            <div className="text-sm font-bold text-pink-800 mb-3">{t('gender.women')}</div>
                            <div className="space-y-2">
                                <div className="flex justify-between items-center bg-white/60 px-3 py-2 rounded-lg">
                                    <span className="text-xs font-medium text-pink-700">✓ {t('gender.programmedFemale')}</span>
                                    <span className="font-bold text-pink-900">{s.femaleProgrammed}</span>
                                </div>
                                <div className="flex justify-between items-center bg-white/60 px-3 py-2 rounded-lg">
                                    <span className="text-xs font-medium text-pink-700">⏳ {t('gender.notProgrammedFemale')}</span>
                                    <span className="font-bold text-pink-900">{s.femalePending}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* PROVENANCE */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <h3 className="font-bold text-lg text-slate-800 mb-4 flex items-center gap-2">
                        <span className="p-2 bg-orange-50 text-orange-600 rounded-lg"><Icons.Chart /></span>
                        {t('origin.title')}
                    </h3>
                    <div className="space-y-3">
                        {/* En ville */}
                        <div className="bg-green-50 p-4 rounded-xl border border-green-200">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <span className="text-xl">🏙️</span>
                                    <span className="font-bold text-green-900">{translateDistance('en ville', locale)}</span>
                                </div>
                                <span className="font-black text-green-900 text-xl">{s.local}</span>
                            </div>
                            <div className="flex gap-2 text-xs">
                                <span className="bg-white px-2 py-1 rounded font-medium text-green-700">✓ {s.localProgrammed} {t('gender.programmed').toLowerCase()}</span>
                                <span className="bg-white px-2 py-1 rounded font-medium text-green-700">⏳ {s.localPending} {t('gender.notProgrammed').toLowerCase()}</span>
                            </div>
                        </div>

                        {/* Un peu loin */}
                        <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-200">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <span className="text-xl">🚗</span>
                                    <span className="font-bold text-yellow-900">{translateDistance('un peu loin', locale)}</span>
                                </div>
                                <span className="font-black text-yellow-900 text-xl">{s.nearby}</span>
                            </div>
                            <div className="flex gap-2 text-xs">
                                <span className="bg-white px-2 py-1 rounded font-medium text-yellow-700">✓ {s.nearbyProgrammed} {t('gender.programmed').toLowerCase()}</span>
                                <span className="bg-white px-2 py-1 rounded font-medium text-yellow-700">⏳ {s.nearbyPending} {t('gender.notProgrammed').toLowerCase()}</span>
                            </div>
                        </div>

                        {/* Loin */}
                        <div className="bg-red-50 p-4 rounded-xl border border-red-200">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <span className="text-xl">✈️</span>
                                    <span className="font-bold text-red-900">{translateDistance('loin', locale)}</span>
                                </div>
                                <span className="font-black text-red-900 text-xl">{s.far}</span>
                            </div>
                            <div className="flex gap-2 text-xs">
                                <span className="bg-white px-2 py-1 rounded font-medium text-red-700">✓ {s.farProgrammed} {t('gender.programmed').toLowerCase()}</span>
                                <span className="bg-white px-2 py-1 rounded font-medium text-red-700">⏳ {s.farPending} {t('gender.notProgrammed').toLowerCase()}</span>
                            </div>
                        </div>

                        {/* Non précisé */}
                        {s.unspecified > 0 && (
                            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xl">❓</span>
                                        <span className="font-bold text-gray-900">{translateDistance('non précisé', locale)}</span>
                                    </div>
                                    <span className="font-black text-gray-900 text-xl">{s.unspecified}</span>
                                </div>
                                <div className="flex gap-2 text-xs">
                                    <span className="bg-white px-2 py-1 rounded font-medium text-gray-700">✓ {s.unspecifiedProgrammed} {t('gender.programmed').toLowerCase()}</span>
                                    <span className="bg-white px-2 py-1 rounded font-medium text-gray-700">⏳ {s.unspecifiedPending} {t('gender.notProgrammed').toLowerCase()}</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* CLINICAL ANALYSIS */}
            <div className="mb-8">
                <h3 className="font-bold text-lg text-slate-800 mb-6 flex items-center gap-2">
                    <span className="p-2 bg-pink-50 text-pink-600 rounded-lg">🔬</span>
                    {t('clinicalStats.title')}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <PieChartCard title={t('clinicalStats.anesthesia.title')} data={anesthesiaData} />
                    <PieChartCard title={t('clinicalStats.diagnostics.title')} data={diagnosticData} />
                </div>
            </div>
        </div>
    );
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658'];

const PieChartCard = ({ title, data }: { title: string, data: { name: string, value: number }[] }) => {
    if (data.length === 0) {
        return (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center justify-center h-full min-h-[300px]">
                <h3 className="font-bold text-lg text-slate-800 mb-4">{title}</h3>
                <div className="text-gray-400 italic">Aucune donnée</div>
            </div>
        );
    }

    return (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center h-full">
            <h3 className="font-bold text-lg text-slate-800 mb-4">{title}</h3>
            <div className="w-full h-64 flex-1 min-h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={data}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            fill="#8884d8"
                            paddingAngle={5}
                            dataKey="value"
                        >
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip />
                        <Legend wrapperStyle={{ fontSize: '12px' }} />
                    </PieChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};
