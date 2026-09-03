'use client';

import { useEffect, useRef } from 'react';
import { MedicalRecord } from '@/lib/client-db';
import { useTranslations } from '../providers/I18nProvider';
import MedicalAuditTimeline from './MedicalAuditTimeline';

interface PatientDetailModalProps {
    record: MedicalRecord;
    onClose: () => void;
}

const AgeDisplay = ({ age }: { age: string | number }) => {
    const ageStr = String(age || '?');

    // Determine color based on unit
    let bgColor = 'bg-gray-100';
    let textColor = 'text-gray-700';

    if (ageStr.includes('semaine') || ageStr.includes('week')) {
        bgColor = 'bg-pink-100';
        textColor = 'text-pink-700';
    } else if (ageStr.includes('mois') || ageStr.includes('month')) {
        bgColor = 'bg-purple-100';
        textColor = 'text-purple-700';
    } else if (ageStr.includes('an') || ageStr.includes('year')) {
        bgColor = 'bg-indigo-100';
        textColor = 'text-indigo-700';
    }

    return (
        <span className={`inline-flex items-center justify-center px-2.5 py-1 rounded-full text-xs font-semibold ${bgColor} ${textColor}`}>
            {ageStr}
        </span>
    );
};

function DetailItem({ label, value, className = '' }: { label: string; value?: string | number; className?: string }) {
    return (
        <div className={className}>
            <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">{label}</div>
            <div className="text-gray-800 font-medium">{value === null || value === undefined || value === '' ? 'N/A' : value}</div>
        </div>
    );
}

export default function PatientDetailModal({ record, onClose }: PatientDetailModalProps) {
    const t = useTranslations('patient');
    const closeRef = useRef<HTMLButtonElement>(null);
    useEffect(() => {
        closeRef.current?.focus();
        const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
        document.addEventListener('keydown', closeOnEscape);
        return () => document.removeEventListener('keydown', closeOnEscape);
    }, [onClose]);

    if (!record) return null;

    const getGenderLabel = (g: string) => {
        if (g === 'M') return t('values.male');
        if (g === 'F') return t('values.female');
        return g;
    };

    return (
        <div className="mobile-dialog-shell fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4" onClick={onClose}>
            <div role="dialog" aria-modal="true" aria-labelledby="patient-dialog-title" className="mobile-dialog mobile-scroll w-full max-w-4xl max-h-[90dvh] overflow-y-auto rounded-xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
                <div className="sticky top-0 z-10 border-b border-slate-200 bg-white p-4 sm:p-5">
                    <div className="flex justify-between items-start">
                        <div>
                            <h2 id="patient-dialog-title" className="text-2xl font-black text-slate-950">{record.last_name} {record.first_name}</h2>
                            <p className="mt-1 text-slate-500">Dossier: {record.dossier_number || 'N/A'}</p>
                        </div>
                        <button
                            ref={closeRef}
                            onClick={onClose}
                            aria-label="Fermer le dossier"
                            className="grid min-h-11 min-w-11 place-items-center rounded-lg text-slate-600 hover:bg-slate-100"
                        >
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                <div className="space-y-6 p-4 sm:p-6">
                    {/* Informations personnelles */}
                    <div>
                        <h3 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
                            <span className="text-indigo-600">👤</span> {t('sections.personal')}
                        </h3>
                        <div className="grid grid-cols-1 gap-4 rounded-xl bg-gray-50 p-4 min-[420px]:grid-cols-2">
                            <DetailItem label={t('fields.dob')} value={record.dob} />
                            <div className="flex flex-col">
                                <span className="text-xs font-semibold text-gray-500 mb-1">{t('fields.age')}</span>
                                <AgeDisplay age={record.age} />
                            </div>
                            <DetailItem label={t('fields.gender')} value={getGenderLabel(record.gender)} />
                            <DetailItem label={t('fields.phone')} value={[record.phone1, record.phone2].filter(Boolean).join(' / ') || 'N/A'} />
                            <DetailItem label={t('fields.address')} value={record.address} className="min-[420px]:col-span-2" />
                            <DetailItem label={t('fields.distance')} value={record.distance || t('values.unspecified')} />
                        </div>
                    </div>

                    {/* Paramètres médicaux */}
                    <div>
                        <h3 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
                            <span className="text-red-600">❤️</span> {t('sections.medical')}
                        </h3>
                        <div className="grid grid-cols-2 gap-4 rounded-xl bg-gray-50 p-4 sm:grid-cols-3">
                            <DetailItem label={t('fields.weight')} value={`${record.weight || '?'} kg`} />
                            <DetailItem label={t('fields.height')} value={`${record.height || '?'} cm`} />
                            <DetailItem label={t('fields.bmi')} value={record.bmi?.toString() || '?'} />
                            <DetailItem label={t('fields.bloodPressure')} value={record.blood_pressure || 'N/A'} />
                            <DetailItem label={t('fields.temperature')} value={`${record.temperature || '?'} °C`} />
                            <DetailItem label={t('fields.pulse')} value={`${record.heart_rate || '?'} bpm`} />
                            <DetailItem label={t('fields.respiratoryRate')} value={`${record.respiratory_rate || '?'} cpm`} />
                            <DetailItem label={t('fields.spo2')} value={`${record.spo2 || '?'} %`} />
                        </div>
                    </div>

                    {/* Consultation chirurgicale */}
                    <div>
                        <h3 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
                            <span className="text-rose-600">🏥</span> {t('sections.surgical')}
                        </h3>
                        <div className="bg-gray-50 p-4 rounded-xl space-y-3">
                            <DetailItem label={t('fields.clinicalDiagnosis')} value={record.clinical_diagnosis || 'N/A'} />
                            <DetailItem label={t('fields.interventionType')} value={record.intervention_type || 'N/A'} />
                            <DetailItem label={t('fields.observation')} value={record.observation || 'N/A'} />
                            <DetailItem label={t('fields.programmed')} value={record.program_mission ? t('values.yes') : t('values.no')} />
                            {record.program_mission === 1 && (
                                <DetailItem label={t('fields.planningDay')} value={record.planning_day || t('values.toBeDefined')} className="text-orange-600" />
                            )}
                        </div>
                    </div>

                    {/* Antécédents */}
                    <div>
                        <h3 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
                            <span className="text-amber-600">📋</span> {t('sections.history')}
                        </h3>
                        <div className="bg-gray-50 p-4 rounded-xl">
                            <div className="flex flex-wrap gap-2 mb-3">
                                {record.history_diabetes === 1 && <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-semibold">{t('history.diabetes')}</span>}
                                {record.history_hypertension === 1 && <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm font-semibold">{t('history.hypertension')}</span>}
                                {record.history_asthma === 1 && <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-semibold">{t('history.asthma')}</span>}
                                {record.history_cardiopathy === 1 && <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-semibold">{t('history.cardiopathy')}</span>}
                                {record.history_none === 1 && <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-semibold">{t('history.none')}</span>}
                            </div>
                            {record.history_others && (
                                <DetailItem label={t('fields.historyOthers')} value={record.history_others} />
                            )}
                            <div className="mt-3 grid grid-cols-1 gap-4 min-[420px]:grid-cols-2">
                                <DetailItem label={t('fields.asaScore')} value={record.asa_score?.toString() || 'N/A'} />
                                <DetailItem label={t('fields.anesthesiaType')} value={record.anesthesia_type || 'N/A'} />
                            </div>
                            {record.anesthesia_observation && (
                                <DetailItem label={t('fields.anesthesiaObservation')} value={record.anesthesia_observation} className="mt-3" />
                            )}
                        </div>
                    </div>
                </div>
                {record.public_id && <MedicalAuditTimeline publicId={record.public_id} />}
            </div>
        </div>
    );
}
