'use client';

import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import PatientCard from './PatientCard';
import { PatientCardData, SurgeonData } from '@/lib/planning-utils';

interface DayColumnProps {
    day: string;
    displayName: string;
    patients: PatientCardData[];
    surgeons: SurgeonData[];
    selectedIds: Set<number>;
    onToggleSelect: (id: number) => void;
    onAssignSurgeon: (patientId: number) => void;
    onChangePlanningDay: (patientId: number, day: string) => void;
    onClickCard: (patientId: number) => void;
    isPool?: boolean;
}

export default function DayColumn({
    day,
    displayName,
    patients,
    surgeons,
    selectedIds,
    onToggleSelect,
    onAssignSurgeon,
    onChangePlanningDay,
    onClickCard,
    isPool = false,
}: DayColumnProps) {
    const { setNodeRef, isOver } = useDroppable({ id: `column-${day}` });

    const sortableIds = patients.map(p => `patient-${p.id}`);

    return (
        <div
            ref={setNodeRef}
            className={`rounded-2xl border flex flex-col transition-all ${
                isPool ? 'min-w-[280px] w-[280px]' : 'min-w-[230px] w-[230px]'
            } ${
                isOver
                    ? 'ring-2 ring-indigo-300 bg-indigo-50/40 border-indigo-200'
                    : isPool
                        ? 'bg-amber-50/30 border-amber-200/50'
                        : 'bg-white border-slate-100'
            }`}
        >
            {/* Column Header */}
            <div className={`px-4 py-3 border-b flex items-center justify-between flex-shrink-0 rounded-t-2xl ${
                isPool ? 'bg-amber-50/50 border-amber-200/50' : 'bg-slate-50/50 border-slate-100'
            }`}>
                <div className="flex items-center gap-2">
                    {isPool && <span className="text-base">📋</span>}
                    <h3 className={`text-sm font-bold ${isPool ? 'text-amber-800' : 'text-slate-700'}`}>
                        {displayName}
                    </h3>
                </div>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    patients.length > 0
                        ? isPool
                            ? 'bg-amber-200/60 text-amber-800'
                            : 'bg-indigo-100 text-indigo-700'
                        : 'bg-slate-100 text-slate-400'
                }`}>
                    {patients.length}
                </span>
            </div>

            {/* Cards */}
            <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
                <div className="p-2 space-y-2 overflow-y-auto max-h-[calc(100vh-300px)] min-h-[120px] flex-1">
                    {patients.length === 0 ? (
                        <div className="flex items-center justify-center h-20 text-xs text-slate-400 italic">
                            {isPool ? 'Aucun patient non planifié' : 'Glisser ici'}
                        </div>
                    ) : (
                        patients.map(patient => (
                            <PatientCard
                                key={patient.id}
                                patient={patient}
                                surgeons={surgeons}
                                isSelected={selectedIds.has(patient.id)}
                                showCheckbox={isPool}
                                onToggleSelect={onToggleSelect}
                                onAssignSurgeon={onAssignSurgeon}
                                onChangePlanningDay={onChangePlanningDay}
                                onClickCard={onClickCard}
                            />
                        ))
                    )}
                </div>
            </SortableContext>
        </div>
    );
}
