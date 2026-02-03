'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Edition, MedicalRecord } from '@/lib/client-db';
import LoadingSpinner from './LoadingSpinner';

// Icons
const Icons = {
    Users: () => <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>,
    Calendar: () => <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
    Check: () => <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    Clock: () => <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    Chart: () => <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" /></svg>
};

interface DashboardProps {
    currentEdition: Edition | null;
    onNavigate: (view: 'form' | 'list' | 'surgeons' | 'planning') => void;
    onEdit: (record: MedicalRecord) => void;
}

export default function Dashboard({ currentEdition, onNavigate, onEdit }: DashboardProps) {
    const [records, setRecords] = useState<MedicalRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchData = useCallback(async () => {
        if (!currentEdition?.public_id) {
            setRecords([]);
            return;
        }

        try {
            setRefreshing(true);

            // 1. Fetch remote editions to find the matching Remote ID for our current edition
            const editionsRes = await fetch('/api/editions');
            if (!editionsRes.ok) throw new Error('Failed to fetch editions');
            const remoteEditions = await editionsRes.json();
            const remoteEdition = remoteEditions.find((e: Edition) => e.public_id === currentEdition.public_id);

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
            setLoading(false);
            setRefreshing(false);
        }
    }, [currentEdition?.public_id]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const stats = useMemo(() => {
        if (loading && records.length === 0) return null;

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
        const local = records.filter(r => r.distance === 'en ville').length;
        const localProgrammed = records.filter(r => r.distance === 'en ville' && r.program_mission === 1).length;
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
            createdToday, recentRecords
        };
    }, [records, loading]);

    if (loading && records.length === 0) {
        return <LoadingSpinner message="Chargement du tableau de bord..." />;
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
        createdToday: 0, recentRecords: []
    };

    return (
        <div className="w-full max-w-[1600px] mx-auto p-4 md:p-8 pb-24 text-slate-800 animate-fadeIn relative">

            {refreshing && (
                <div className="absolute top-4 right-4 z-50 bg-white/80 px-3 py-1 rounded-full text-xs font-bold text-indigo-600 border border-indigo-100 shadow-sm animate-pulse">
                    Actualisation...
                </div>
            )}

            {/* HEADER */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 border-b border-indigo-50 pb-6">
                <div>
                    <h2 className="text-[10px] md:text-xs font-bold text-indigo-400 tracking-[0.2em] uppercase mb-1">Tableau de Bord</h2>
                    <h1 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight flex items-center gap-2">
                        📊 Synthèse de la Mission
                    </h1>
                    <p className="text-gray-500 mt-1">
                        {currentEdition ? `${currentEdition.name} - ${currentEdition.place} ${currentEdition.year}` : 'Aucune édition sélectionnée'}
                    </p>
                </div>
                <div className="flex flex-wrap gap-3">
                    <button
                        onClick={() => fetchData()}
                        disabled={refreshing}
                        className="bg-white text-slate-600 px-4 py-2.5 rounded-xl font-bold hover:bg-slate-50 transition border border-slate-200 flex items-center gap-2"
                        title="Actualiser les données"
                    >
                        <span className={`${refreshing ? 'animate-spin' : ''}`}>🔄</span>
                    </button>
                    <button
                        onClick={() => onNavigate('surgeons')}
                        className="bg-white text-emerald-600 px-5 py-2.5 rounded-xl font-bold hover:bg-emerald-50 transition border border-emerald-100 flex items-center gap-2"
                    >
                        <span>🩺</span> Équipe
                    </button>
                    <button
                        onClick={() => onNavigate('planning')}
                        className="bg-white text-blue-600 px-5 py-2.5 rounded-xl font-bold hover:bg-blue-50 transition border border-blue-100 flex items-center gap-2"
                    >
                        <span>📅</span> Planning
                    </button>
                    <button
                        onClick={() => onNavigate('list')}
                        className="bg-white text-indigo-600 px-5 py-2.5 rounded-xl font-bold hover:bg-indigo-50 transition border border-indigo-100 flex items-center gap-2"
                    >
                        <span>📂</span> Liste
                    </button>
                    <button
                        onClick={() => onNavigate('form')}
                        className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-indigo-700 transition shadow-lg shadow-indigo-200 flex items-center gap-2"
                    >
                        <span>✚</span> Nouveau
                    </button>
                </div>
            </div>

            {/* KPI CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <div
                    onClick={() => onNavigate('list')}
                    className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden group hover:shadow-md transition-all cursor-pointer"
                >
                    <div className="absolute top-0 right-0 p-4 opacity-5 text-indigo-600 transform group-hover:scale-110 transition-transform">
                        <svg className="w-24 h-24" fill="currentColor" viewBox="0 0 20 20"><path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z"></path></svg>
                    </div>
                    <div className="relative">
                        <p className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-1">Total Patients</p>
                        <h3 className="text-4xl font-black text-slate-800">{s.total}</h3>
                        <p className="text-green-600 text-sm font-bold mt-2 flex items-center gap-1">
                            <span className="bg-green-100 px-1.5 py-0.5 rounded text-xs">+{s.createdToday}</span> aujourd&apos;hui
                        </p>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden group hover:shadow-md transition-all">
                    <div className="absolute top-0 right-0 p-4 opacity-5 text-emerald-600 transform group-hover:scale-110 transition-transform">
                        <svg className="w-24 h-24" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path></svg>
                    </div>
                    <div className="relative">
                        <p className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-1">Programmés</p>
                        <h3 className="text-4xl font-black text-emerald-600">{s.programmed}</h3>
                        <p className="text-slate-400 text-sm font-medium mt-2">
                            Patients validés
                        </p>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden group hover:shadow-md transition-all">
                    <div className="absolute top-0 right-0 p-4 opacity-5 text-orange-600 transform group-hover:scale-110 transition-transform">
                        <svg className="w-24 h-24" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd"></path></svg>
                    </div>
                    <div className="relative">
                        <p className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-1">Pas Programmé</p>
                        <h3 className="text-4xl font-black text-orange-500">{s.pending}</h3>
                        <p className="text-slate-400 text-sm font-medium mt-2">
                            Non programmés
                        </p>
                    </div>
                </div>

                <div className="bg-gradient-to-br from-indigo-600 to-purple-700 p-6 rounded-2xl shadow-lg relative overflow-hidden group text-white">
                    <div className="absolute top-0 right-0 p-4 opacity-20 transform group-hover:scale-110 transition-transform">
                        <svg className="w-24 h-24" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd"></path></svg>
                    </div>
                    <div className="relative">
                        <p className="text-sm font-bold text-indigo-200 uppercase tracking-wider mb-1">Taux Remplissage</p>
                        <h3 className="text-4xl font-black">{s.total > 0 ? Math.round((s.programmed / s.total) * 100) : 0}%</h3>
                        <p className="text-indigo-200 text-sm font-medium mt-2">
                            des patients sont programmés
                        </p>
                    </div>
                </div>
            </div>

            {/* CHARTS GRID */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">

                {/* PLANNING SEMAINE */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                            <span className="p-2 bg-indigo-50 text-indigo-600 rounded-lg"><Icons.Calendar /></span>
                            Planning Opératoire
                        </h3>
                    </div>
                    <div className="space-y-4">
                        {s.byDay.map((day) => (
                            <div key={day.name} className="relative">
                                <div className="flex justify-between items-center mb-1 text-sm font-bold">
                                    <span className="text-slate-600">{day.name}</span>
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
                                Aucun patient programmé pour le moment
                            </div>
                        )}
                    </div>
                </div>

                <div className="space-y-6">
                    {/* REPARTITION GENRE */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                        <h3 className="font-bold text-lg text-slate-800 mb-6 flex items-center gap-2">
                            <span className="p-2 bg-pink-50 text-pink-600 rounded-lg"><Icons.Users /></span>
                            Par Genre
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Hommes */}
                            <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-5 rounded-xl border-2 border-blue-200">
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-4xl">👨</span>
                                    <span className="font-black text-blue-900 text-3xl">{s.male}</span>
                                </div>
                                <div className="text-sm font-bold text-blue-800 mb-3">HOMMES</div>
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center bg-white/60 px-3 py-2 rounded-lg">
                                        <span className="text-xs font-medium text-blue-700">✓ Programmés</span>
                                        <span className="font-bold text-blue-900">{s.maleProgrammed}</span>
                                    </div>
                                    <div className="flex justify-between items-center bg-white/60 px-3 py-2 rounded-lg">
                                        <span className="text-xs font-medium text-blue-700">⏳ Pas programmés</span>
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
                                <div className="text-sm font-bold text-pink-800 mb-3">FEMMES</div>
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center bg-white/60 px-3 py-2 rounded-lg">
                                        <span className="text-xs font-medium text-pink-700">✓ Programmées</span>
                                        <span className="font-bold text-pink-900">{s.femaleProgrammed}</span>
                                    </div>
                                    <div className="flex justify-between items-center bg-white/60 px-3 py-2 rounded-lg">
                                        <span className="text-xs font-medium text-pink-700">⏳ Pas programmées</span>
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
                            Provenance
                        </h3>
                        <div className="space-y-3">
                            {/* En ville */}
                            <div className="bg-green-50 p-4 rounded-xl border border-green-200">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xl">🏙️</span>
                                        <span className="font-bold text-green-900">En ville</span>
                                    </div>
                                    <span className="font-black text-green-900 text-xl">{s.local}</span>
                                </div>
                                <div className="flex gap-2 text-xs">
                                    <span className="bg-white px-2 py-1 rounded font-medium text-green-700">✓ {s.localProgrammed} programmés</span>
                                    <span className="bg-white px-2 py-1 rounded font-medium text-green-700">⏳ {s.localPending} pas programmés</span>
                                </div>
                            </div>

                            {/* Un peu loin */}
                            <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-200">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xl">🚗</span>
                                        <span className="font-bold text-yellow-900">Un peu loin</span>
                                    </div>
                                    <span className="font-black text-yellow-900 text-xl">{s.nearby}</span>
                                </div>
                                <div className="flex gap-2 text-xs">
                                    <span className="bg-white px-2 py-1 rounded font-medium text-yellow-700">✓ {s.nearbyProgrammed} programmés</span>
                                    <span className="bg-white px-2 py-1 rounded font-medium text-yellow-700">⏳ {s.nearbyPending} pas programmés</span>
                                </div>
                            </div>

                            {/* Loin */}
                            <div className="bg-red-50 p-4 rounded-xl border border-red-200">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xl">✈️</span>
                                        <span className="font-bold text-red-900">Loin</span>
                                    </div>
                                    <span className="font-black text-red-900 text-xl">{s.far}</span>
                                </div>
                                <div className="flex gap-2 text-xs">
                                    <span className="bg-white px-2 py-1 rounded font-medium text-red-700">✓ {s.farProgrammed} programmés</span>
                                    <span className="bg-white px-2 py-1 rounded font-medium text-red-700">⏳ {s.farPending} pas programmés</span>
                                </div>
                            </div>

                            {/* Non précisé */}
                            {s.unspecified > 0 && (
                                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xl">❓</span>
                                            <span className="font-bold text-gray-900">Non précisé</span>
                                        </div>
                                        <span className="font-black text-gray-900 text-xl">{s.unspecified}</span>
                                    </div>
                                    <div className="flex gap-2 text-xs">
                                        <span className="bg-white px-2 py-1 rounded font-medium text-gray-700">✓ {s.unspecifiedProgrammed} programmés</span>
                                        <span className="bg-white px-2 py-1 rounded font-medium text-gray-700">⏳ {s.unspecifiedPending} pas programmés</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* RECENT PATIENTS */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                    <div className="p-6 border-b border-gray-50 flex justify-between items-center">
                        <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                            <span className="p-2 bg-slate-100 text-slate-600 rounded-lg"><Icons.Clock /></span>
                            Derniers Inscrits
                        </h3>
                    </div>
                    <div className="p-4">
                        {s.recentRecords.length > 0 ? (
                            <div className="space-y-3">
                                {s.recentRecords.map((r, i) => (
                                    <div
                                        key={i}
                                        className="flex items-center gap-4 p-4 rounded-xl border border-gray-100 hover:border-indigo-200 hover:bg-indigo-50/30 transition-all cursor-pointer group"
                                        onClick={() => onEdit(r)}
                                    >
                                        {/* Dossier Number */}
                                        <div className="flex-shrink-0 w-16">
                                            <div className="text-xs font-bold text-gray-400 uppercase mb-1">Dossier</div>
                                            <div className="font-black text-slate-800 text-sm">{r.dossier_number || '-'}</div>
                                        </div>

                                        {/* Patient Info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="font-bold text-slate-800 truncate">
                                                    {r.last_name} {r.first_name}
                                                </span>
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${r.gender === 'M' ? 'bg-blue-100 text-blue-800' : 'bg-pink-100 text-pink-800'}`}>
                                                    {r.gender}
                                                </span>
                                                <span className="text-xs text-gray-500">{r.age} ans</span>
                                            </div>
                                            <div className="flex items-center gap-3 text-xs text-gray-500">
                                                <span className="flex items-center gap-1">
                                                    <span>📍</span>
                                                    <span className="capitalize">{r.address ? r.address.split(' ').slice(0, 2).join(' ') : 'N/A'}</span>
                                                </span>
                                                {r.clinical_diagnosis && (
                                                    <span className="flex items-center gap-1 truncate max-w-[300px]" title={r.clinical_diagnosis}>
                                                        <span>🩺</span>
                                                        <span className="truncate">{r.clinical_diagnosis}</span>
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Status */}
                                        <div className="flex-shrink-0">
                                            {r.program_mission ? (
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Programmé
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-orange-100 text-orange-700">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span> Pas Programmé
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="py-12 text-center text-gray-400 italic">
                                Aucune donnée récente
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
