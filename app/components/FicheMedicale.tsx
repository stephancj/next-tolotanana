'use client';

import { useState } from 'react';

// Icons
const Icons = {
    User: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
    Phone: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>,
    Heart: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>,
    Activity: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>,
    Syringe: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>,
    Save: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
};

interface InputFieldProps {
    label: string;
    name: string;
    placeholder?: string;
    type?: string;
    value: string | number;
    onChange: React.ChangeEventHandler<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>;
    className?: string;
}

interface VitalCardProps {
    label: string;
    name: string;
    value: string | number;
    unit: string;
    icon: React.ReactNode;
    color?: string;
    onChange: React.ChangeEventHandler<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>;
}

const InputField = ({ label, name, placeholder, type = "text", value, onChange, className = "" }: InputFieldProps) => (
    <div className={`flex flex-col ${className}`}>
        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 pl-1">{label}</label>
        <input
            type={type}
            name={name}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            className="w-full p-3.5 bg-gray-50 border border-gray-100 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all shadow-sm font-medium text-gray-700 placeholder-gray-300"
        />
    </div>
);

const VitalCard = ({ label, name, value, unit, icon, onChange, color = "indigo" }: VitalCardProps) => (
    <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
        <div className={`absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity text-${color}-600`}>
            {icon}
        </div>
        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">{label}</label>
        <div className="flex items-baseline gap-1">
            <input
                name={name}
                value={value}
                onChange={onChange}
                type="number"
                placeholder="--"
                className="w-full bg-transparent text-2xl font-black text-gray-800 focus:outline-none p-0 border-none placeholder-gray-200"
            />
            <span className="text-xs font-bold text-gray-400">{unit}</span>
        </div>
    </div>
);


interface FicheMedicaleProps {
    initialData?: any;
    onSuccess?: () => void;
    onNew?: () => void;
}

interface FormState {
    dossier_number: string;
    last_name: string;
    first_name: string;
    dob: string;
    age: string | number;
    gender: string;
    phone1: string;
    phone2: string;
    address: string;
    weight: string | number;
    height: string | number;
    bmi: string | number;
    blood_pressure: string;
    temperature: string | number;
    heart_rate: string | number;
    respiratory_rate: string | number;
    spo2: string | number;
    clinical_diagnosis: string;
    intervention_type: string;
    observation: string;
    program_mission: boolean;
    history_diabetes: boolean;
    history_hypertension: boolean;
    history_asthma: boolean;
    history_cardiopathy: boolean;
    history_none: boolean;
    history_others: string;
    asa_score: string | number;
    anesthesia_type: string;
    anesthesia_observation: string;
    [key: string]: string | number | boolean; // Index signature for dynamic access
}

export default function FicheMedicale({ initialData, onSuccess, onNew }: FicheMedicaleProps) {
    const [loading, setLoading] = useState(false);

    const defaultState: FormState = {
        dossier_number: '',
        last_name: '',
        first_name: '',
        dob: '',
        age: '',
        gender: '',
        phone1: '',
        phone2: '',
        address: '',
        weight: '',
        height: '',
        bmi: '',
        blood_pressure: '',
        temperature: '',
        heart_rate: '',
        respiratory_rate: '',
        spo2: '',
        clinical_diagnosis: '',
        intervention_type: '',
        observation: '',
        program_mission: false,
        history_diabetes: false,
        history_hypertension: false,
        history_asthma: false,
        history_cardiopathy: false,
        history_none: false,
        history_others: '',
        asa_score: '',
        anesthesia_type: '',
        anesthesia_observation: ''
    };

    const [formData, setFormData] = useState<FormState>(initialData ? {
        ...defaultState,
        ...initialData,
        // Ensure boolean fields are actually booleans for checkboxes
        program_mission: !!initialData.program_mission,
        history_diabetes: !!initialData.history_diabetes,
        history_hypertension: !!initialData.history_hypertension,
        history_asthma: !!initialData.history_asthma,
        history_cardiopathy: !!initialData.history_cardiopathy,
        history_none: !!initialData.history_none,
    } : defaultState);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        const checked = (e.target as HTMLInputElement).checked;

        setFormData((prev: FormState) => {
            const next = {
                ...prev,
                [name]: type === 'checkbox' ? checked : value
            };

            // Auto-calculate BMI
            if (name === 'weight' || name === 'height') {
                const wStr = String(next.weight).replace(',', '.');
                const hStr = String(next.height).replace(',', '.');

                const w = parseFloat(wStr);
                const h = parseFloat(hStr); // height in input unit (usually cm)

                if (w > 0 && h > 0) {
                    // Heuristic: If height < 3.0, user likely entered meters.
                    // If height > 3.0, user likely entered cm.
                    // We also ignore very small values to prevent displaying crazy numbers while typing.

                    let heightInMeters = h;
                    let isValidHeight = false;

                    if (h > 40) {
                        // Likely cm (e.g. 160 cm)
                        heightInMeters = h / 100;
                        isValidHeight = true;
                    } else if (h < 3.0 && h > 0.4) {
                        // Likely meters (e.g. 1.6 m)
                        heightInMeters = h;
                        isValidHeight = true;
                    }

                    if (isValidHeight) {
                        next.bmi = (w / (heightInMeters * heightInMeters)).toFixed(1);
                    } else {
                        next.bmi = ''; // Clear if incomplete or invalid
                    }
                } else {
                    next.bmi = '';
                }
            }
            return next;
        });
    };

    const calculateAge = (dob: string) => {
        if (!dob) return '';
        const birthDate = new Date(dob);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        return age.toString();
    };

    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const dob = e.target.value;
        setFormData((prev: FormState) => ({
            ...prev,
            dob,
            age: calculateAge(dob)
        }));
    };

    const handleSubmit = async () => {
        setLoading(true);
        try {
            const payload = { ...formData };

            // Convert boolean to number (0 or 1)
            const recordToSave = {
                ...payload,
                program_mission: payload.program_mission ? 1 : 0,
                history_diabetes: payload.history_diabetes ? 1 : 0,
                history_hypertension: payload.history_hypertension ? 1 : 0,
                history_asthma: payload.history_asthma ? 1 : 0,
                history_cardiopathy: payload.history_cardiopathy ? 1 : 0,
                history_none: payload.history_none ? 1 : 0,

                // Ensure numeric fields are parsed correctly if they are strings in state
                age: parseInt(String(payload.age)) || 0,
                weight: parseFloat(String(payload.weight).replace(',', '.')) || 0,
                height: parseFloat(String(payload.height).replace(',', '.')) || 0,
                bmi: parseFloat(String(payload.bmi).replace(',', '.')) || 0,
                temperature: parseFloat(String(payload.temperature).replace(',', '.')) || 0,

                heart_rate: parseInt(String(payload.heart_rate)) || 0,
                respiratory_rate: parseInt(String(payload.respiratory_rate)) || 0,
                spo2: parseInt(String(payload.spo2)) || 0,
                asa_score: parseInt(String(payload.asa_score)) || 0,
                photo_url: '',
                created_at: initialData?.created_at || new Date().toISOString()
            };

            const dbModule = await import('@/lib/client-db');
            if (initialData && initialData.id) {
                await dbModule.db.medical_records.put({ ...recordToSave, id: initialData.id });
                alert('Fiche mise à jour avec succès');
            } else {
                await dbModule.db.medical_records.add(recordToSave);
                alert('Fiche enregistrée avec succès (Mode Offline)');
            }

            if (onSuccess) onSuccess();

            if (!initialData) {
                setFormData(defaultState);
            }
        } catch (e) {
            console.error(e);
            alert('Erreur lors de l\'enregistrement local');
        } finally {
            setLoading(false);
        }
    };

    const handleNew = () => {
        setFormData(defaultState);
        if (onNew) onNew();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };



    return (
        <div className="min-h-screen bg-slate-50/80 pb-32">
            {/* Header */}
            <header className="bg-white/80 backdrop-blur-xl sticky top-0 z-40 border-b border-indigo-50 px-6 py-4 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.05)]">
                <div className="max-w-[1600px] mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-[10px] md:text-xs font-bold text-indigo-400 tracking-[0.2em] uppercase mb-1">Fandidiana Maimaimpoana</h2>
                        <h1 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight flex items-center gap-2">
                            <span className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-lg shadow-lg shadow-indigo-200">✚</span>
                            Fiche <span className="text-indigo-600">Médicale</span>
                        </h1>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="px-4 py-2 bg-green-50 text-green-700 rounded-lg text-xs font-bold border border-green-100 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                            SYSTEM READY
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-[1600px] mx-auto p-4 md:p-8 grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">

                {/* LEFT COLUMN: IDENTITY */}
                <aside className="xl:col-span-4 space-y-6">
                    {/* DOSSIER */}
                    <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6 relative overflow-hidden group">
                        <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-indigo-500 to-purple-500"></div>
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Numéro de Dossier</label>
                        <input
                            type="text"
                            name="dossier_number"
                            value={formData.dossier_number}
                            onChange={handleChange}
                            className="w-full text-5xl font-black text-slate-800 placeholder-slate-200 bg-transparent border-none p-0 focus:ring-0"
                            placeholder="#0000"
                        />
                    </div>

                    {/* PERSONAL INFO */}
                    <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6 space-y-6">
                        <div className="flex items-center gap-4 mb-2 pb-4 border-b border-gray-50">
                            <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
                                <Icons.User />
                            </div>
                            <h3 className="text-lg font-bold text-slate-700">Identité du Patient</h3>
                        </div>

                        <div className="grid grid-cols-1 gap-4">
                            <InputField label="Nom (Anarana)" name="last_name" value={formData.last_name} onChange={handleChange} />
                            <InputField label="Prénom (Fanampin'anarana)" name="first_name" value={formData.first_name} onChange={handleChange} />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <InputField label="Date de Naissance" name="dob" type="date" value={formData.dob} onChange={handleDateChange} />
                            <InputField label="Âge (Taona)" name="age" type="number" value={formData.age} onChange={handleChange} />
                        </div>

                        <div>
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 block pl-1">Genre</label>
                            <div className="grid grid-cols-2 gap-3">
                                {['M', 'F'].map((g) => (
                                    <button
                                        key={g}
                                        type="button"
                                        onClick={() => setFormData(prev => ({ ...prev, gender: g }))}
                                        className={`py-3 px-4 rounded-xl border-2 font-bold transition-all ${formData.gender === g
                                            ? 'border-indigo-500 bg-indigo-50 text-indigo-700 shadow-sm'
                                            : 'border-slate-100 bg-white text-slate-400 hover:border-slate-200'
                                            }`}
                                    >
                                        {g === 'M' ? 'Masculin' : 'Féminin'}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* CONTACT */}
                    <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6 space-y-4">
                        <div className="flex items-center gap-4 mb-2 pb-4 border-b border-gray-50">
                            <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
                                <Icons.Phone />
                            </div>
                            <h3 className="text-lg font-bold text-slate-700">Contact</h3>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <InputField label="Tél 1" name="phone1" value={formData.phone1} onChange={handleChange} />
                            <InputField label="Tél 2" name="phone2" value={formData.phone2} onChange={handleChange} />
                        </div>
                        <InputField label="Adresse" name="address" value={formData.address} onChange={handleChange} />
                    </div>
                </aside>

                {/* RIGHT COLUMN: MEDICAL */}
                <section className="xl:col-span-8 space-y-6">

                    {/* VITALS */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <VitalCard label="Poids" name="weight" unit="kg" value={formData.weight} icon={<Icons.Activity />} color="blue" onChange={handleChange} />
                        <VitalCard label="Taille" name="height" unit="cm" value={formData.height} icon={<Icons.Activity />} color="blue" onChange={handleChange} />
                        <div className="bg-gradient-to-br from-indigo-600 to-purple-700 p-4 rounded-2xl shadow-lg hover:shadow-xl transition-shadow relative overflow-hidden text-white">
                            <div className="absolute top-0 right-0 p-2 opacity-20">
                                <Icons.Activity />
                            </div>
                            <label className="text-xs font-bold text-indigo-200 uppercase tracking-wider block mb-1">IMC / BMI</label>
                            <div className="flex items-baseline gap-1">
                                <input
                                    name="bmi"
                                    value={formData.bmi}
                                    onChange={handleChange}
                                    placeholder="--"
                                    className="w-full bg-transparent text-2xl font-black text-white focus:outline-none p-0 border-none placeholder-indigo-300"
                                />
                            </div>
                        </div>
                        <VitalCard label="Temp" name="temperature" unit="°C" value={formData.temperature} icon={<Icons.Activity />} color="orange" onChange={handleChange} />
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <VitalCard label="Tension" name="blood_pressure" unit="mmHg" value={formData.blood_pressure} icon={<Icons.Heart />} color="red" onChange={handleChange} />
                        <VitalCard label="Pouls" name="heart_rate" unit="bpm" value={formData.heart_rate} icon={<Icons.Heart />} color="red" onChange={handleChange} />
                        <VitalCard label="Resp." name="respiratory_rate" unit="cpm" value={formData.respiratory_rate} icon={<Icons.Activity />} color="teal" onChange={handleChange} />
                        <VitalCard label="SpO2" name="spo2" unit="%" value={formData.spo2} icon={<Icons.Activity />} color="cyan" onChange={handleChange} />
                    </div>

                    {/* SURGICAL */}
                    <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6 md:p-8">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center text-rose-600">
                                <Icons.Syringe />
                            </div>
                            <h3 className="text-xl font-bold text-slate-700">Consultation Chirurgicale</h3>
                        </div>

                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider pl-1">Diagnostic Clinique</label>
                                    <textarea
                                        name="clinical_diagnosis"
                                        value={formData.clinical_diagnosis}
                                        onChange={handleChange}
                                        className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl h-32 focus:bg-white focus:ring-2 focus:ring-rose-200 outline-none resize-none transition-all"
                                        placeholder="Description du diagnostic..."
                                    />
                                </div>
                                <div className="space-y-4">
                                    <InputField label="Type d'intervention" name="intervention_type" value={formData.intervention_type} onChange={handleChange} />
                                    <div className="p-4 bg-orange-50 rounded-2xl border border-orange-100">
                                        <label className="text-xs font-bold text-orange-400 uppercase tracking-wider mb-2 block">À programmer ?</label>
                                        <div className="flex gap-4">
                                            {[true, false].map(val => (
                                                <label key={String(val)} className="flex items-center gap-2 cursor-pointer">
                                                    <input
                                                        type="radio"
                                                        name="program_mission_radio"
                                                        checked={formData.program_mission === val}
                                                        onChange={() => setFormData(p => ({ ...p, program_mission: val }))}
                                                        className="w-5 h-5 text-orange-500 focus:ring-orange-400 bg-white"
                                                    />
                                                    <span className={`font-semibold ${formData.program_mission === val ? 'text-orange-700' : 'text-gray-500'}`}>
                                                        {val ? 'Oui' : 'Non'}
                                                    </span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider pl-1">Observation</label>
                                <textarea
                                    name="observation"
                                    value={formData.observation}
                                    onChange={handleChange}
                                    className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl h-24 focus:bg-white focus:ring-2 focus:ring-indigo-200 outline-none resize-none transition-all"
                                    placeholder="Notes additionnelles..."
                                />
                            </div>
                        </div>
                    </div>

                    {/* PRE-ANESTHESIA */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6 md:p-8">
                            <h3 className="text-lg font-bold text-slate-700 mb-4">Antécédents</h3>
                            <div className="space-y-2">
                                {([
                                    { k: 'history_diabetes', l: 'Diabète' },
                                    { k: 'history_hypertension', l: 'Hypertension' },
                                    { k: 'history_asthma', l: 'Asthme' },
                                    { k: 'history_cardiopathy', l: 'Cardiopathie' }
                                ] as { k: string; l: string }[]).map((item) => (
                                    <label key={item.k} className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 cursor-pointer transition-colors border border-transparent hover:border-gray-100">
                                        <span className="font-medium text-slate-600">{item.l}</span>
                                        <input
                                            type="checkbox"
                                            name={item.k}
                                            checked={!!formData[item.k]}
                                            onChange={handleChange}
                                            className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500 border-gray-300"
                                        />
                                    </label>
                                ))}
                                <input
                                    name="history_others"
                                    placeholder="Autres..."
                                    value={formData.history_others}
                                    onChange={handleChange}
                                    className="w-full mt-2 p-3 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-indigo-200 text-sm"
                                />
                            </div>
                        </div>

                        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6 md:p-8 flex flex-col justify-between">
                            <div>
                                <h3 className="text-lg font-bold text-slate-700 mb-4">Score ASA</h3>
                                <div className="grid grid-cols-3 gap-3">
                                    {[1, 2, 3, 4, 5, 6].map(score => (
                                        <label key={score} className="cursor-pointer">
                                            <input
                                                type="radio"
                                                name="asa_score"
                                                value={score}
                                                checked={formData.asa_score.toString() === score.toString()}
                                                onChange={handleChange}
                                                className="hidden"
                                            />
                                            <div className={`
                                                h-12 rounded-xl flex items-center justify-center font-black text-xl transition-all border-2
                                                ${formData.asa_score.toString() === score.toString()
                                                    ? 'bg-slate-800 text-white border-slate-800 scale-105 shadow-lg'
                                                    : 'bg-white text-gray-400 border-gray-100 hover:border-gray-200'}
                                            `}>
                                                {score}
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ANESTHESIA TYPE */}
                    <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6 md:p-8">
                        <h3 className="text-lg font-bold text-slate-700 mb-6">Type d&apos;anesthésie</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                            {['Locale', 'Locorégionale', 'Générale'].map((type) => (
                                <label key={type} className="cursor-pointer group">
                                    <input
                                        type="radio"
                                        name="anesthesia_type"
                                        value={type}
                                        checked={formData.anesthesia_type === type}
                                        onChange={handleChange}
                                        className="hidden"
                                    />
                                    <div className={`
                                        p-4 rounded-2xl border-2 transition-all text-center
                                        ${formData.anesthesia_type === type
                                            ? 'border-violet-500 bg-violet-50 text-violet-700 font-bold shadow-md'
                                            : 'border-slate-100 text-slate-500 hover:border-violet-200'}
                                    `}>
                                        {type}
                                    </div>
                                </label>
                            ))}
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider pl-1">Observation Anesthésie</label>
                            <textarea
                                name="anesthesia_observation"
                                value={formData.anesthesia_observation}
                                onChange={handleChange}
                                className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl h-24 focus:bg-white focus:ring-2 focus:ring-violet-200 outline-none resize-none transition-all"
                                placeholder="Remarques..."
                            />
                        </div>
                    </div>

                </section>
            </main>

            {/* FLOATING ACTION BAR */}
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-full px-6 flex justify-center z-50 pointer-events-none">
                <div className="bg-slate-900/90 backdrop-blur-md text-white px-2 py-2 rounded-2xl shadow-2xl border border-slate-700/50 flex items-center gap-2 pointer-events-auto scale-90 md:scale-100 transform transition-transform">
                    <button onClick={handleNew} className="p-4 hover:bg-white/10 rounded-xl transition-colors group relative">
                        <span className="text-xl">✨</span>
                        <span className="absolute -top-10 left-1/2 -translate-x-1/2 bg-black text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                            {initialData ? 'Annuler Modif.' : 'Nouveau'}
                        </span>
                    </button>
                    <div className="w-px h-8 bg-white/10"></div>
                    <button onClick={() => document.dispatchEvent(new CustomEvent('switchTab', { detail: 'list' }))} className="p-4 hover:bg-white/10 rounded-xl transition-colors group relative">
                        <span className="text-xl">📂</span>
                        <span className="absolute -top-10 left-1/2 -translate-x-1/2 bg-black text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">Liste</span>
                    </button>
                    <div className="w-px h-8 bg-white/10"></div>
                    <button
                        onClick={handleSubmit}
                        disabled={loading}
                        className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-lg shadow-indigo-900/30 font-bold transition-all flex items-center gap-3 active:scale-95 mx-2"
                    >
                        {loading ? <span className="animate-spin">⏳</span> : <Icons.Save />}
                        <span>Enregistrer</span>
                    </button>
                </div>
            </div>
        </div >
    );
}
