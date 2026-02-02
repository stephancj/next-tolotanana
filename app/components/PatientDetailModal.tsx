'use client';

import { MedicalRecord } from '@/lib/client-db';

interface PatientDetailModalProps {
    record: MedicalRecord;
    onClose: () => void;
}

const AgeDisplay = ({ age }: { age: string | number }) => {
    const ageStr = String(age || '?');

    // Determine color based on unit
    let bgColor = 'bg-gray-100';
    let textColor = 'text-gray-700';

    if (ageStr.includes('semaine')) {
        bgColor = 'bg-pink-100';
        textColor = 'text-pink-700';
    } else if (ageStr.includes('mois')) {
        bgColor = 'bg-purple-100';
        textColor = 'text-purple-700';
    } else if (ageStr.includes('an')) {
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
            <div className="text-gray-800 font-medium">{value || 'N/A'}</div>
        </div>
    );
}

export default function PatientDetailModal({ record, onClose }: PatientDetailModalProps) {
    if (!record) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-fadeIn" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <div className="sticky top-0 bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6 rounded-t-2xl z-10">
                    <div className="flex justify-between items-start">
                        <div>
                            <h2 className="text-2xl font-bold">{record.last_name} {record.first_name}</h2>
                            <p className="text-indigo-100 mt-1">Dossier: {record.dossier_number || 'N/A'}</p>
                        </div>
                        <button
                            onClick={onClose}
                            className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition"
                        >
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                <div className="p-6 space-y-6">
                    {/* Informations personnelles */}
                    <div>
                        <h3 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
                            <span className="text-indigo-600">👤</span> Informations Personnelles
                        </h3>
                        <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-xl">
                            <DetailItem label="Date de naissance" value={record.dob} />
                            <div className="flex flex-col">
                                <span className="text-xs font-semibold text-gray-500 mb-1">Âge</span>
                                <AgeDisplay age={record.age} />
                            </div>
                            <DetailItem label="Genre" value={record.gender === 'M' ? 'Masculin' : record.gender === 'F' ? 'Féminin' : record.gender} />
                            <DetailItem label="Téléphone" value={[record.phone1, record.phone2].filter(Boolean).join(' / ') || 'N/A'} />
                            <DetailItem label="Adresse" value={record.address} className="col-span-2" />
                            <DetailItem label="Distance" value={record.distance || 'non précisé'} />
                        </div>
                    </div>

                    {/* Paramètres médicaux */}
                    <div>
                        <h3 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
                            <span className="text-red-600">❤️</span> Paramètres Médicaux
                        </h3>
                        <div className="grid grid-cols-3 gap-4 bg-gray-50 p-4 rounded-xl">
                            <DetailItem label="Poids" value={`${record.weight || '?'} kg`} />
                            <DetailItem label="Taille" value={`${record.height || '?'} cm`} />
                            <DetailItem label="IMC" value={record.bmi?.toString() || '?'} />
                            <DetailItem label="Tension" value={record.blood_pressure || 'N/A'} />
                            <DetailItem label="Température" value={`${record.temperature || '?'} °C`} />
                            <DetailItem label="Pouls" value={`${record.heart_rate || '?'} bpm`} />
                            <DetailItem label="Resp." value={`${record.respiratory_rate || '?'} cpm`} />
                            <DetailItem label="SpO2" value={`${record.spo2 || '?'} %`} />
                        </div>
                    </div>

                    {/* Consultation chirurgicale */}
                    <div>
                        <h3 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
                            <span className="text-rose-600">🏥</span> Consultation Chirurgicale
                        </h3>
                        <div className="bg-gray-50 p-4 rounded-xl space-y-3">
                            <DetailItem label="Diagnostic clinique" value={record.clinical_diagnosis || 'N/A'} />
                            <DetailItem label="Type d'intervention" value={record.intervention_type || 'N/A'} />
                            <DetailItem label="Observation" value={record.observation || 'N/A'} />
                            <DetailItem label="À programmer" value={record.program_mission ? 'Oui' : 'Non'} />
                            {record.program_mission === 1 && (
                                <DetailItem label="Jour Prévu" value={record.planning_day || 'A définir'} className="text-orange-600" />
                            )}
                        </div>
                    </div>

                    {/* Antécédents */}
                    <div>
                        <h3 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
                            <span className="text-amber-600">📋</span> Antécédents
                        </h3>
                        <div className="bg-gray-50 p-4 rounded-xl">
                            <div className="flex flex-wrap gap-2 mb-3">
                                {record.history_diabetes === 1 && <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-semibold">Diabète</span>}
                                {record.history_hypertension === 1 && <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm font-semibold">Hypertension</span>}
                                {record.history_asthma === 1 && <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-semibold">Asthme</span>}
                                {record.history_cardiopathy === 1 && <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-semibold">Cardiopathie</span>}
                                {record.history_none === 1 && <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-semibold">Aucun connu</span>}
                            </div>
                            {record.history_others && (
                                <DetailItem label="Autres antécédents" value={record.history_others} />
                            )}
                            <div className="grid grid-cols-2 gap-4 mt-3">
                                <DetailItem label="Score ASA" value={record.asa_score?.toString() || 'N/A'} />
                                <DetailItem label="Type d'anesthésie" value={record.anesthesia_type || 'N/A'} />
                            </div>
                            {record.anesthesia_observation && (
                                <DetailItem label="Observation anesthésie" value={record.anesthesia_observation} className="mt-3" />
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
