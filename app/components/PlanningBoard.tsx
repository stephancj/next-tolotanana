'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
    DndContext,
    DragOverlay,
    closestCenter,
    PointerSensor,
    TouchSensor,
    useSensor,
    useSensors,
    DragStartEvent,
    DragEndEvent,
} from '@dnd-kit/core';
import { Wand2, BarChart3, Save, RefreshCw } from 'lucide-react';
import { useEdition } from '@/app/providers/EditionProvider';
import { Edition } from '@/lib/client-db';
import { PatientCardData, SurgeonData, autoSuggestPlacements, getAgeCategory } from '@/lib/planning-utils';
import DayColumn from './planning/DayColumn';
import PatientCard from './planning/PatientCard';
import SurgeonAssignPopover from './planning/SurgeonAssignPopover';
import SurgeonStatsPanel from './planning/SurgeonStatsPanel';
import PlanningFilters from './planning/PlanningFilters';
import LoadingSpinner from './LoadingSpinner';

const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi'];
const POOL_KEY = 'Pool';

const columnIdToDay: Record<string, string> = {
    'column-Pool': 'A définir',
    'column-Lundi': 'Lundi',
    'column-Mardi': 'Mardi',
    'column-Mercredi': 'Mercredi',
    'column-Jeudi': 'Jeudi',
    'column-Vendredi': 'Vendredi',
};

export default function PlanningBoard() {
    const { currentEdition } = useEdition();

    // Data state
    const [records, setRecords] = useState<PatientCardData[]>([]);
    const [editionSurgeons, setEditionSurgeons] = useState<SurgeonData[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [remoteEditionId, setRemoteEditionId] = useState<number | null>(null);

    // Dirty tracking
    const [dirtyRecordIds, setDirtyRecordIds] = useState<Set<number>>(new Set());

    // UI state
    const [activePatient, setActivePatient] = useState<PatientCardData | null>(null);
    const [selectedPoolIds, setSelectedPoolIds] = useState<Set<number>>(new Set());
    const [surgeonPopoverPatientId, setSurgeonPopoverPatientId] = useState<number | null>(null);
    const [showStats, setShowStats] = useState(false);

    // Filters
    const [filterDistance, setFilterDistance] = useState('');
    const [filterDiagnosis, setFilterDiagnosis] = useState('');
    const [filterAge, setFilterAge] = useState('');

    // DnD sensors
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    );

    // ─── Data Fetching ────────────────────────────────────────────────
    const fetchData = useCallback(async () => {
        if (!currentEdition?.public_id) {
            setRecords([]);
            setLoading(false);
            return;
        }

        try {
            setLoading(true);

            // 1. Resolve remote edition ID
            const editionsRes = await fetch('/api/editions');
            if (!editionsRes.ok) throw new Error('Failed to fetch editions');
            const remoteEditions = await editionsRes.json();
            const remoteEdition = remoteEditions.find((e: Edition) => e.public_id === currentEdition.public_id);
            if (!remoteEdition) {
                setRecords([]);
                setLoading(false);
                return;
            }
            const editionId = remoteEdition.id;
            setRemoteEditionId(editionId);

            // 2. Fetch records + surgeons in parallel
            const [recordsRes, surgeonsRes] = await Promise.all([
                fetch('/api/records'),
                fetch(`/api/editions/${editionId}/surgeons`),
            ]);

            if (!recordsRes.ok) throw new Error('Failed to fetch records');
            const allRecords = await recordsRes.json();

            const surgeons: SurgeonData[] = surgeonsRes.ok ? await surgeonsRes.json() : [];
            setEditionSurgeons(surgeons);

            // 3. Filter records: edition + program_mission + not deleted
            const editionRecords = allRecords.filter(
                (r: PatientCardData & { edition_id: number; program_mission: number; deleted?: number | boolean }) =>
                    r.edition_id === editionId && r.program_mission === 1 && !r.deleted
            );

            // 4. Fetch record-surgeon assignments
            const recordIds = editionRecords.map((r: PatientCardData) => r.id);
            let recordSurgeonMap: Record<number, number[]> = {};

            if (recordIds.length > 0) {
                try {
                    const rsRes = await fetch('/api/record_surgeons');
                    if (rsRes.ok) {
                        const rsData = await rsRes.json();
                        // Build map: record_id -> surgeon_ids[]
                        for (const rs of rsData) {
                            if (!recordSurgeonMap[rs.medical_record_id]) {
                                recordSurgeonMap[rs.medical_record_id] = [];
                            }
                            recordSurgeonMap[rs.medical_record_id].push(rs.surgeon_id);
                        }
                    }
                } catch {
                    // record_surgeons fetch failed, continue without assignments
                }
            }

            // 5. Map to PatientCardData
            const mapped: PatientCardData[] = editionRecords.map((r: Record<string, unknown>) => ({
                id: r.id as number,
                public_id: (r.public_id || '') as string,
                last_name: (r.last_name || '') as string,
                first_name: (r.first_name || '') as string,
                age: (r.age || '') as string,
                distance: (r.distance || 'non précisé') as string,
                diagnosis_category: (r.diagnosis_category || '') as string,
                clinical_diagnosis: (r.clinical_diagnosis || '') as string,
                planning_day: (r.planning_day || 'A définir') as string,
                program_mission: r.program_mission as number,
                dossier_number: (r.dossier_number || '') as string,
                gender: (r.gender || '') as string,
                assignedSurgeonIds: recordSurgeonMap[r.id as number] || [],
            }));

            setRecords(mapped);
        } catch (err) {
            console.error('Planning fetch error:', err);
            setRecords([]);
        } finally {
            setLoading(false);
        }
    }, [currentEdition?.public_id]);

    useEffect(() => { fetchData(); }, [fetchData]);

    // ─── Grouped Data ─────────────────────────────────────────────────
    const poolRecords = useMemo(() => {
        let pool = records.filter(r => !r.planning_day || r.planning_day === 'A définir' || !DAYS.includes(r.planning_day));

        // Apply filters
        if (filterDistance) pool = pool.filter(r => r.distance === filterDistance);
        if (filterDiagnosis) pool = pool.filter(r => (r.diagnosis_category || r.clinical_diagnosis) === filterDiagnosis);
        if (filterAge) pool = pool.filter(r => getAgeCategory(r.age) === filterAge);

        return pool;
    }, [records, filterDistance, filterDiagnosis, filterAge]);

    const recordsByDay = useMemo(() => {
        const grouped: Record<string, PatientCardData[]> = {};
        for (const day of DAYS) {
            grouped[day] = records.filter(r => r.planning_day === day);
        }
        return grouped;
    }, [records]);

    const uniqueDiagnoses = useMemo(() => {
        const set = new Set<string>();
        for (const r of records) {
            const cat = r.diagnosis_category || r.clinical_diagnosis;
            if (cat) set.add(cat);
        }
        return Array.from(set).sort();
    }, [records]);

    // ─── Record Mutation Helpers ──────────────────────────────────────
    const updateRecordDay = useCallback((patientId: number, newDay: string) => {
        setRecords(prev => prev.map(r =>
            r.id === patientId ? { ...r, planning_day: newDay } : r
        ));
        setDirtyRecordIds(prev => new Set(prev).add(patientId));
    }, []);

    const updateRecordSurgeons = useCallback((patientId: number, surgeonIds: number[]) => {
        setRecords(prev => prev.map(r =>
            r.id === patientId ? { ...r, assignedSurgeonIds: surgeonIds } : r
        ));
    }, []);

    // ─── Drag & Drop ──────────────────────────────────────────────────
    const handleDragStart = useCallback((event: DragStartEvent) => {
        const data = event.active.data.current;
        if (data?.type === 'patient') {
            setActivePatient(data.patient);
        }
    }, []);

    const handleDragEnd = useCallback((event: DragEndEvent) => {
        setActivePatient(null);

        const { active, over } = event;
        if (!over) return;

        const patientData = active.data.current;
        if (patientData?.type !== 'patient') return;

        const patient = patientData.patient as PatientCardData;

        // Determine target column
        let targetColumnId = over.id as string;

        // If dropped on another patient card, find which column it belongs to
        if (targetColumnId.startsWith('patient-')) {
            const targetPatientId = parseInt(targetColumnId.replace('patient-', ''));
            const targetPatient = records.find(r => r.id === targetPatientId);
            if (targetPatient) {
                const targetDay = targetPatient.planning_day;
                if (!targetDay || targetDay === 'A définir' || !DAYS.includes(targetDay)) {
                    targetColumnId = 'column-Pool';
                } else {
                    targetColumnId = `column-${targetDay}`;
                }
            }
        }

        const newDay = columnIdToDay[targetColumnId];
        if (!newDay) return;

        // Only update if day actually changed
        const currentDay = patient.planning_day || 'A définir';
        if (currentDay !== newDay) {
            updateRecordDay(patient.id, newDay);
        }
    }, [records, updateRecordDay]);

    // ─── Bulk Actions ─────────────────────────────────────────────────
    const bulkAssignToDay = useCallback((day: string) => {
        selectedPoolIds.forEach(id => updateRecordDay(id, day));
        setSelectedPoolIds(new Set());
    }, [selectedPoolIds, updateRecordDay]);

    const togglePoolSelect = useCallback((id: number) => {
        setSelectedPoolIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    const selectAllPool = useCallback(() => {
        if (selectedPoolIds.size === poolRecords.length) {
            setSelectedPoolIds(new Set());
        } else {
            setSelectedPoolIds(new Set(poolRecords.map(r => r.id)));
        }
    }, [poolRecords, selectedPoolIds.size]);

    // ─── Auto-Suggest ─────────────────────────────────────────────────
    const handleAutoSuggest = useCallback(() => {
        const unplanned = records.filter(r => !r.planning_day || r.planning_day === 'A définir' || !DAYS.includes(r.planning_day));
        if (unplanned.length === 0) return;

        const placements = autoSuggestPlacements(unplanned, recordsByDay);

        if (!confirm(`Placer automatiquement ${unplanned.length} patient(s) ? Les patients les plus loin et les bébés seront priorisés en début de semaine.`)) {
            return;
        }

        setRecords(prev => prev.map(r => {
            const newDay = placements[r.id!];
            if (newDay) {
                setDirtyRecordIds(d => new Set(d).add(r.id));
                return { ...r, planning_day: newDay };
            }
            return r;
        }));
    }, [records, recordsByDay]);

    // ─── Save ─────────────────────────────────────────────────────────
    const handleSave = useCallback(async () => {
        if (dirtyRecordIds.size === 0) return;

        setSaving(true);
        try {
            // Group dirty records by their new planning_day
            const updatesByDay: Record<string, number[]> = {};
            dirtyRecordIds.forEach(id => {
                const record = records.find(r => r.id === id);
                if (record) {
                    const day = record.planning_day || 'A définir';
                    if (!updatesByDay[day]) updatesByDay[day] = [];
                    updatesByDay[day].push(id);
                }
            });

            // Batch PATCH per day value
            for (const [day, ids] of Object.entries(updatesByDay)) {
                const response = await fetch('/api/records', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ids, planning_day: day }),
                });
                if (!response.ok) throw new Error(`Failed to save day ${day}`);
            }

            setDirtyRecordIds(new Set());
        } catch (err) {
            console.error('Save failed:', err);
            alert('Erreur lors de la sauvegarde. Réessayez.');
        } finally {
            setSaving(false);
        }
    }, [dirtyRecordIds, records]);

    // ─── Surgeon Assignment ───────────────────────────────────────────
    const handleSurgeonSave = useCallback(async (patientId: number, surgeonIds: number[]) => {
        // Update local state
        updateRecordSurgeons(patientId, surgeonIds);
        setSurgeonPopoverPatientId(null);

        // Save to server
        try {
            await fetch('/api/record_surgeons', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ medical_record_id: patientId, surgeon_ids: surgeonIds }),
            });
        } catch (err) {
            console.error('Surgeon assignment save failed:', err);
        }
    }, [updateRecordSurgeons]);

    // ─── Render ───────────────────────────────────────────────────────
    if (loading) {
        return <LoadingSpinner message="Chargement de la planification..." />;
    }

    const popoverPatient = surgeonPopoverPatientId ? records.find(r => r.id === surgeonPopoverPatientId) : null;
    const totalPlanned = DAYS.reduce((sum, day) => sum + (recordsByDay[day]?.length || 0), 0);
    const totalUnplanned = records.length - totalPlanned;

    return (
        <div className="min-h-screen bg-slate-50/80 pb-24 font-[family-name:var(--font-geist-sans)]">
            {/* Header */}
            <header className="bg-white/80 backdrop-blur-xl sticky top-16 z-40 border-b border-indigo-50 px-4 md:px-6 py-3 shadow-sm">
                <div className="max-w-[1800px] mx-auto">
                    <div className="flex items-center justify-between mb-2">
                        <div>
                            <h2 className="text-xs font-bold text-indigo-400 tracking-[0.2em] uppercase">Planification</h2>
                            <h1 className="text-xl md:text-2xl font-black text-slate-800 tracking-tight">
                                Tableau de planification
                            </h1>
                            {currentEdition && (
                                <p className="text-xs text-slate-500">
                                    {currentEdition.name} — {records.length} patients programmés
                                    {totalUnplanned > 0 && <span className="text-amber-600 font-bold"> ({totalUnplanned} non planifiés)</span>}
                                </p>
                            )}
                        </div>

                        <div className="flex items-center gap-2">
                            {/* Auto-suggest */}
                            <button
                                onClick={handleAutoSuggest}
                                disabled={totalUnplanned === 0}
                                className="px-3 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed bg-violet-50 text-violet-700 hover:bg-violet-100 border border-violet-200"
                                title="Placer automatiquement les patients non planifiés"
                            >
                                <Wand2 size={14} />
                                <span className="hidden md:inline">Auto-planifier</span>
                            </button>

                            {/* Stats */}
                            <button
                                onClick={() => setShowStats(true)}
                                className="px-3 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200"
                            >
                                <BarChart3 size={14} />
                                <span className="hidden md:inline">Stats</span>
                            </button>

                            {/* Refresh */}
                            <button
                                onClick={fetchData}
                                className="px-3 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200"
                                title="Rafraîchir"
                            >
                                <RefreshCw size={14} />
                            </button>

                            {/* Save */}
                            <button
                                onClick={handleSave}
                                disabled={dirtyRecordIds.size === 0 || saving}
                                className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 ${
                                    dirtyRecordIds.size > 0
                                        ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-200'
                                        : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                }`}
                            >
                                <Save size={14} />
                                {saving ? 'Sauvegarde...' : dirtyRecordIds.size > 0 ? `Sauver (${dirtyRecordIds.size})` : 'Sauvé'}
                            </button>
                        </div>
                    </div>

                    {/* Filters */}
                    <PlanningFilters
                        filterDistance={filterDistance}
                        filterDiagnosis={filterDiagnosis}
                        filterAge={filterAge}
                        uniqueDiagnoses={uniqueDiagnoses}
                        onFilterDistance={setFilterDistance}
                        onFilterDiagnosis={setFilterDiagnosis}
                        onFilterAge={setFilterAge}
                        onClear={() => { setFilterDistance(''); setFilterDiagnosis(''); setFilterAge(''); }}
                    />
                </div>
            </header>

            {/* Kanban Board */}
            <main className="max-w-[1800px] mx-auto p-4">
                {records.length === 0 ? (
                    <div className="bg-white rounded-2xl p-12 text-center border border-slate-100 mt-4">
                        <div className="text-6xl mb-4">📋</div>
                        <h3 className="text-xl font-bold text-slate-700 mb-2">Aucun patient programmé</h3>
                        <p className="text-slate-500 mb-4">
                            Ajoutez des patients et cochez &quot;Programmé pour la mission&quot; dans le formulaire.
                        </p>
                    </div>
                ) : (
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                    >
                        {/* Pool select all */}
                        {poolRecords.length > 0 && (
                            <div className="flex items-center gap-2 mb-3">
                                <button
                                    onClick={selectAllPool}
                                    className="text-xs px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 font-bold transition"
                                >
                                    {selectedPoolIds.size === poolRecords.length ? 'Désélectionner' : 'Tout sélectionner'}
                                </button>
                                {selectedPoolIds.size > 0 && (
                                    <span className="text-xs text-slate-500">{selectedPoolIds.size} sélectionné(s)</span>
                                )}
                            </div>
                        )}

                        {/* Columns */}
                        <div className="flex gap-3 overflow-x-auto pb-4">
                            {/* Pool */}
                            <DayColumn
                                day={POOL_KEY}
                                displayName={`Non planifiés (${records.filter(r => !r.planning_day || r.planning_day === 'A définir' || !DAYS.includes(r.planning_day)).length})`}
                                patients={poolRecords}
                                surgeons={editionSurgeons}
                                selectedIds={selectedPoolIds}
                                onToggleSelect={togglePoolSelect}
                                onAssignSurgeon={(id) => setSurgeonPopoverPatientId(id)}
                                onChangePlanningDay={updateRecordDay}
                                isPool
                            />

                            {/* Day columns */}
                            {DAYS.map(day => (
                                <DayColumn
                                    key={day}
                                    day={day}
                                    displayName={day}
                                    patients={recordsByDay[day] || []}
                                    surgeons={editionSurgeons}
                                    selectedIds={new Set()}
                                    onToggleSelect={() => {}}
                                    onAssignSurgeon={(id) => setSurgeonPopoverPatientId(id)}
                                    onChangePlanningDay={updateRecordDay}
                                />
                            ))}
                        </div>

                        {/* Drag overlay */}
                        <DragOverlay>
                            {activePatient && (
                                <div className="opacity-90 rotate-2 scale-105">
                                    <PatientCard
                                        patient={activePatient}
                                        surgeons={editionSurgeons}
                                        isSelected={false}
                                        showCheckbox={false}
                                        onToggleSelect={() => {}}
                                        onAssignSurgeon={() => {}}
                                        onChangePlanningDay={() => {}}
                                    />
                                </div>
                            )}
                        </DragOverlay>
                    </DndContext>
                )}
            </main>

            {/* Bulk action bar */}
            {selectedPoolIds.size > 0 && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-indigo-600 text-white rounded-2xl px-5 py-3 shadow-xl flex items-center gap-3 z-50">
                    <span className="text-sm font-bold">{selectedPoolIds.size} sélectionné(s)</span>
                    <div className="w-px h-6 bg-white/20" />
                    {DAYS.map(day => (
                        <button
                            key={day}
                            onClick={() => bulkAssignToDay(day)}
                            className="px-3 py-1.5 bg-white/20 rounded-lg text-xs font-bold hover:bg-white/30 transition"
                        >
                            {day.slice(0, 3)}
                        </button>
                    ))}
                    <div className="w-px h-6 bg-white/20" />
                    <button
                        onClick={() => setSelectedPoolIds(new Set())}
                        className="text-white/60 hover:text-white text-xs font-bold transition"
                    >
                        Annuler
                    </button>
                </div>
            )}

            {/* Surgeon assign popover */}
            {popoverPatient && (
                <SurgeonAssignPopover
                    patient={popoverPatient}
                    editionSurgeons={editionSurgeons}
                    onSave={handleSurgeonSave}
                    onClose={() => setSurgeonPopoverPatientId(null)}
                />
            )}

            {/* Surgeon stats panel */}
            <SurgeonStatsPanel
                records={records}
                surgeons={editionSurgeons}
                isOpen={showStats}
                onClose={() => setShowStats(false)}
            />
        </div>
    );
}
