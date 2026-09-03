'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { calculateAge } from '@/lib/age-utils';
import { MedicalRecord, db } from '@/lib/client-db';
import { useEdition } from '@/app/providers/EditionProvider';
import { useTranslations } from '@/app/providers/I18nProvider';
import { useRouter, useSearchParams } from 'next/navigation';
import { saveMedicalRecord } from '@/lib/local-records';
import { useFeedback } from '@/app/providers/FeedbackProvider';
import { usePatientFormAssist } from '@/app/hooks/usePatientFormAssist';

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
    error?: string;
    suggestions?: string[];
    required?: boolean;
    inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
    autoComplete?: string;
    onValueChange?: (value: string) => void;
}

interface VitalCardProps {
    label: string;
    name: string;
    value: string | number;
    unit: string;
    icon: React.ReactNode;
    color?: string;
    onChange: React.ChangeEventHandler<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>;
    error?: string;
}

const normalizeAutocomplete = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr').trim();

const ANESTHESIA_QUICK_SUGGESTIONS = [
    'Allergies : aucune connue',
    'Allergies : à préciser',
    'Évaluation respiratoire : poumons libres',
    'Évaluation respiratoire : anomalie à préciser',
    'Évaluation cardiovasculaire : BDC bien frappés et réguliers',
    'Évaluation cardiovasculaire : anomalie à préciser',
    'Mallampati / voies aériennes : Mallampati I',
    'Mallampati / voies aériennes : Mallampati II',
    'Mallampati / voies aériennes : Mallampati III',
    'Mallampati / voies aériennes : Mallampati IV',
    'Accès veineux : G18',
    'Accès veineux : G20',
    'Accès veineux : G22',
    'Accès veineux : G24',
    'Rachis / site du bloc : accessible',
    'Rachis / site du bloc : difficulté à préciser',
    'Risque ou stratégie d’intubation : matériel standard préparé',
    'Risque ou stratégie d’intubation : matériel d’intubation difficile préparé',
    'Jeûne pré-opératoire : solide 6 h, liquide clair 2 h',
    'Jeûne pré-opératoire : autre durée à préciser',
];

interface SmartAutocompleteInputProps {
    id: string;
    name: string;
    value: string;
    suggestions?: string[];
    onChange: React.ChangeEventHandler<HTMLInputElement>;
    onValueChange?: (value: string) => void;
    type?: string;
    placeholder?: string;
    inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
    autoComplete?: string;
    required?: boolean;
    error?: string;
    className?: string;
}

const SmartAutocompleteInput = ({ id, name, value, suggestions = [], onChange, onValueChange, type = 'text', placeholder, inputMode, autoComplete, required, error, className = '' }: SmartAutocompleteInputProps) => {
    const [open, setOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const normalizedValue = normalizeAutocomplete(value);
    const querySource = normalizedValue.includes('a renseigner') && value.includes(':') ? value.slice(0, value.indexOf(':')) : value;
    const query = normalizeAutocomplete(querySource);
    const queryTokens = query.split(/\s+/).filter(token => token.length > 1);
    const options = suggestions
        .map((option, index) => {
            const normalized = normalizeAutocomplete(option);
            const optionTokens = normalized.split(/\s+/);
            let score = query ? 0 : 1000 - index;
            if (query && normalized.startsWith(query)) score = 400;
            else if (query && normalized.includes(query)) score = 300;
            else if (queryTokens.length && queryTokens.every(token => optionTokens.some(optionToken => optionToken.startsWith(token) || token.startsWith(optionToken)))) score = 200 + queryTokens.length;
            return { option, normalized, score, index };
        })
        .filter(item => item.normalized !== query && item.score > 0)
        .sort((a, b) => b.score - a.score || a.index - b.index)
        .slice(0, 8)
        .map(item => item.option);
    const listId = `${id}-autocomplete-list`;
    useEffect(() => {
        if (!open || typeof window === 'undefined' || !window.matchMedia('(max-width: 639px)').matches) return;
        const keepInputVisible = () => inputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const timer = window.setTimeout(keepInputVisible, 280);
        window.visualViewport?.addEventListener('resize', keepInputVisible);
        return () => { window.clearTimeout(timer); window.visualViewport?.removeEventListener('resize', keepInputVisible); };
    }, [open]);
    const choose = (option: string) => {
        onValueChange?.(option);
        setOpen(false);
        setActiveIndex(0);
    };
    return <div className="relative">
        <input
            ref={inputRef}
            id={id}
            type={type}
            name={name}
            value={value}
            onChange={event => { onChange(event); setOpen(true); setActiveIndex(0); }}
            onFocus={() => setOpen(true)}
            onBlur={() => window.setTimeout(() => setOpen(false), 120)}
            onKeyDown={event => {
                if (!open || !options.length) return;
                if (event.key === 'ArrowDown') { event.preventDefault(); setActiveIndex(index => Math.min(index + 1, options.length - 1)); }
                if (event.key === 'ArrowUp') { event.preventDefault(); setActiveIndex(index => Math.max(index - 1, 0)); }
                if (event.key === 'Enter') { event.preventDefault(); choose(options[activeIndex]); }
                if (event.key === 'Escape') setOpen(false);
            }}
            placeholder={placeholder}
            inputMode={inputMode}
            autoComplete={autoComplete || 'off'}
            required={required}
            role={suggestions.length ? 'combobox' : undefined}
            aria-autocomplete={suggestions.length ? 'list' : undefined}
            aria-expanded={suggestions.length ? open : undefined}
            aria-controls={suggestions.length ? listId : undefined}
            aria-invalid={Boolean(error)}
            className={className}
        />
        {open && options.length > 0 && <div id={listId} role="listbox" className="mobile-scroll relative z-20 mt-2 max-h-44 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg sm:absolute sm:inset-x-0 sm:top-full sm:z-[70] sm:mt-1 sm:max-h-64 sm:shadow-2xl">{options.map((option, index) => <button key={option} type="button" role="option" aria-selected={index === activeIndex} onMouseDown={event => event.preventDefault()} onClick={() => choose(option)} className={`min-h-11 w-full rounded-lg px-3 py-2 text-left text-sm ${index === activeIndex ? 'bg-indigo-50 font-bold text-indigo-900' : 'text-slate-700 hover:bg-slate-50'}`}>{option}</button>)}</div>}
    </div>;
};

const InputField = ({ label, name, placeholder, type = "text", value, onChange, className = "", error, suggestions, required, inputMode, autoComplete, onValueChange }: InputFieldProps) => {
    const errorId = `${name}-error`;
    return <div className={`flex flex-col ${className}`}>
        <label className="clinical-label" htmlFor={name}>{label}{required && <span className="ml-1 text-red-600" aria-hidden>*</span>}</label>
        <SmartAutocompleteInput id={name} name={name} type={type} value={String(value)} onChange={onChange as React.ChangeEventHandler<HTMLInputElement>} onValueChange={onValueChange} suggestions={suggestions} placeholder={placeholder} inputMode={inputMode} autoComplete={autoComplete} required={required} error={error} className={`clinical-input font-medium placeholder:text-slate-300 ${error ? 'border-red-500 bg-red-50/40' : ''}`} />
        {error && <p id={errorId} className="mt-1.5 text-sm font-semibold text-red-700">{error}</p>}
    </div>;
};

interface DynamicAutocompleteLinesProps {
    label: string;
    name: 'observation' | 'anesthesia_observation';
    value: string;
    onValueChange: (value: string) => void;
    suggestions: string[];
    placeholder?: string;
    error?: string;
    required?: boolean;
}

const DynamicAutocompleteLines = ({ label, name, value, onValueChange, suggestions, placeholder, error, required }: DynamicAutocompleteLinesProps) => {
    const lines = value === '' ? [''] : value.split('\n');
    const updateLine = (index: number, nextValue: string) => onValueChange(lines.map((line, lineIndex) => lineIndex === index ? nextValue : line).join('\n'));
    const addLine = () => onValueChange([...lines, ''].join('\n'));
    const removeLine = (index: number) => onValueChange(lines.filter((_, lineIndex) => lineIndex !== index).join('\n'));

    return <fieldset id={name} className="space-y-2">
        <legend className="clinical-label">{label}{required && <span className="ml-1 text-red-600" aria-hidden>*</span>}</legend>
        {lines.map((line, index) => <div key={`${name}-${index}`} className="flex items-start gap-2">
            <div className="min-w-0 flex-1"><SmartAutocompleteInput id={`${name}_${index + 1}`} name={index === 0 ? name : `${name}_${index + 1}`} value={line} onChange={event => updateLine(index, event.target.value)} onValueChange={option => updateLine(index, option)} suggestions={suggestions} placeholder={placeholder} error={error} className={`clinical-input font-medium ${error ? 'border-red-500 bg-red-50/40' : ''}`} /></div>
            {lines.length > 1 && <button type="button" onClick={() => removeLine(index)} aria-label={`Supprimer la ligne ${index + 1}`} className="grid min-h-11 min-w-11 place-items-center rounded-lg border border-slate-300 bg-white text-xl font-bold text-slate-600 hover:bg-red-50 hover:text-red-700">×</button>}
        </div>)}
        <button type="button" onClick={addLine} className="flex min-h-11 items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-4 text-sm font-bold text-indigo-800 hover:bg-indigo-100"><span aria-hidden className="text-lg">+</span> Ajouter une ligne</button>
        {error && <p className="text-sm font-semibold text-red-700">{error}</p>}
    </fieldset>;
};

const VitalCard = ({ label, name, value, unit, icon, onChange, error }: VitalCardProps) => (
    <div className={`relative overflow-hidden rounded-xl border bg-white p-4 ${error ? 'border-red-500' : 'border-slate-200'}`}>
        <div className="absolute right-2 top-2 text-slate-300">
            {icon}
        </div>
        <label htmlFor={name} className="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-500">{label} <span className="text-red-600">*</span></label>
        <div className="flex items-baseline gap-1">
            <input
                id={name}
                name={name}
                value={value}
                onChange={onChange}
                type={name === 'blood_pressure' ? 'text' : 'number'}
                inputMode={name === 'blood_pressure' ? 'text' : 'decimal'}
                placeholder="--"
                aria-invalid={Boolean(error)}
                className="w-full border-none bg-transparent p-0 text-2xl font-black text-gray-800 placeholder-gray-200 focus:outline-none"
            />
            <span className="text-xs font-bold text-gray-400">{unit}</span>
        </div>
        {error && <p className="mt-2 text-xs font-semibold text-red-700">{error}</p>}
    </div>
);

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
    planning_day: string;
    history_diabetes: boolean;
    history_hypertension: boolean;
    history_asthma: boolean;
    history_cardiopathy: boolean;
    history_none: boolean;
    history_others: string;
    asa_score: string | number;
    anesthesia_type: string;
    anesthesia_observation: string;
    distance: string;
    block_entry_time: string;
    block_exit_time: string;
    intervention_details: string;
    diagnosis_category: string;
    [key: string]: string | number | boolean; // Index signature for dynamic access
}

const buildAnesthesiaObservationTemplate = (anesthesiaType: string, diagnosis: string) => {
    if (!anesthesiaType) return '';
    const normalizedType = anesthesiaType.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr');
    const normalizedDiagnosis = diagnosis.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr');
    const lines = [
        `Technique prévue : ${anesthesiaType}`,
        'Allergies : À renseigner',
        'Évaluation respiratoire : À renseigner',
        'Évaluation cardiovasculaire : À renseigner',
    ];
    if (normalizedType.includes('general')) {
        lines.push('Mallampati / voies aériennes : À renseigner', 'Accès veineux : À renseigner');
        if (normalizedDiagnosis.includes('fente') || normalizedDiagnosis.includes('palat')) lines.push('Risque ou stratégie d’intubation : À renseigner');
    }
    if (normalizedType.includes('locoreg')) lines.push('Rachis / site du bloc : À renseigner');
    lines.push('Jeûne pré-opératoire : solide 6 h, liquide clair 2 h (à confirmer selon l’âge et le protocole)');
    return lines.join('\n');
};

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
    planning_day: '',
    history_diabetes: false,
    history_hypertension: false,
    history_asthma: false,
    history_cardiopathy: false,
    history_none: false,
    history_others: '',
    asa_score: '',
    anesthesia_type: '',
    anesthesia_observation: '',
    distance: 'non précisé',
    block_entry_time: '',
    block_exit_time: '',
    intervention_details: '',
    diagnosis_category: '',
};

export default function FormPage() {
    const { currentEdition } = useEdition();
    const router = useRouter();
    const searchParams = useSearchParams();
    const idParam = searchParams.get('id');

    const [loading, setLoading] = useState(false);
    const [dirty, setDirty] = useState(false);
    const [hydrated, setHydrated] = useState(false);
    const [draftStatus, setDraftStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
    const [errors, setErrors] = useState<Record<string, string>>({});
    const { notify } = useFeedback();
    const [initialData, setInitialData] = useState<Partial<MedicalRecord> | null>(null);
    const originalDataRef = useRef<FormState>(defaultState);
    const anesthesiaAutoSelectedRef = useRef(false);

    // I18n Hooks
    const t = useTranslations('form');
    const tCommon = useTranslations('common');
    const tEnums = useTranslations('enums'); // For days and other enums if needed directly

    const [formData, setFormData] = useState<FormState>(defaultState);
    const currentId = idParam && !Number.isNaN(Number(idParam)) ? Number(idParam) : undefined;
    const draftKey = useMemo(() => `tolotanana:patient-draft:${currentEdition?.id || 'none'}:${currentId || 'new'}`, [currentEdition?.id, currentId]);
    const { suggestions, duplicates, anesthesiaPrediction, predictAnesthesia } = usePatientFormAssist(currentEdition?.id, currentId, {
        dossier_number: formData.dossier_number,
        last_name: formData.last_name,
        first_name: formData.first_name,
        phone1: formData.phone1,
        clinical_diagnosis: formData.clinical_diagnosis,
        intervention_type: formData.intervention_type,
    });

    const effectiveAnesthesiaType = formData.anesthesia_type || (anesthesiaPrediction?.canAutoSelect ? anesthesiaPrediction.value : '');
    const anesthesiaObservationTemplate = useMemo(
        () => buildAnesthesiaObservationTemplate(effectiveAnesthesiaType, formData.clinical_diagnosis),
        [effectiveAnesthesiaType, formData.clinical_diagnosis]
    );
    const anesthesiaObservationSuggestions = useMemo(() => {
        const values = [...ANESTHESIA_QUICK_SUGGESTIONS, ...suggestions.anesthesiaObservations];
        const seen = new Set<string>();
        return values.filter(value => { const key = normalizeAutocomplete(value); if (seen.has(key)) return false; seen.add(key); return true; });
    }, [suggestions.anesthesiaObservations]);
    const effectiveAnesthesiaObservation = formData.anesthesia_observation || anesthesiaObservationTemplate;

    const requiredValues = useMemo(() => [
        formData.dossier_number, formData.last_name, formData.first_name, formData.dob, formData.age,
        formData.gender, formData.phone1, formData.address, formData.distance, formData.weight,
        formData.height, formData.bmi, formData.blood_pressure, formData.temperature, formData.heart_rate,
        formData.respiratory_rate, formData.spo2, formData.clinical_diagnosis, formData.intervention_type,
        formData.observation, formData.asa_score, effectiveAnesthesiaType, formData.anesthesia_observation,
        formData.program_mission ? formData.planning_day : 'non-programmé',
        (formData.history_diabetes || formData.history_hypertension || formData.history_asthma || formData.history_cardiopathy || formData.history_none || formData.history_others) ? 'historique' : ''
    ], [effectiveAnesthesiaType, formData]);
    const completion = Math.round(requiredValues.filter(value => String(value).trim()).length / requiredValues.length * 100);

    // Load the saved record first, then recover a newer local draft if one exists.
    useEffect(() => {
        let active = true;
        const load = async () => {
            setHydrated(false);
            let base = defaultState;
            let record: MedicalRecord | undefined;
            if (currentId) record = await db.medical_records.get(currentId);
            if (record) {
                base = {
                    ...defaultState,
                    ...record,
                    program_mission: !!record.program_mission,
                    planning_day: record.planning_day || '',
                    history_diabetes: !!record.history_diabetes,
                    history_hypertension: !!record.history_hypertension,
                    history_asthma: !!record.history_asthma,
                    history_cardiopathy: !!record.history_cardiopathy,
                    history_none: !!record.history_none,
                    block_entry_time: record.block_entry_time || '',
                    block_exit_time: record.block_exit_time || '',
                    intervention_details: record.intervention_details || '',
                    diagnosis_category: record.diagnosis_category || '',
                };
            }
            if (!active) return;
            setInitialData(record || null);
            originalDataRef.current = base;
            let next = base;
            let restored = false;
            try {
                const raw = window.localStorage.getItem(draftKey);
                if (raw) {
                    const draft = JSON.parse(raw) as { data?: FormState; savedAt?: string };
                    const newerThanRecord = !record?.updated_at || String(draft.savedAt || '') > record.updated_at;
                    if (draft.data && newerThanRecord) { next = { ...base, ...draft.data }; restored = true; }
                }
            } catch { window.localStorage.removeItem(draftKey); }
            anesthesiaAutoSelectedRef.current = false;
            setFormData(next);
            setDirty(restored);
            setErrors({});
            setDraftStatus(restored ? 'saved' : 'idle');
            setHydrated(true);
            if (restored) notify('Brouillon local restauré. Aucune saisie n’a été perdue.', 'info', {
                label: 'Ignorer',
                run: () => {
                    window.localStorage.removeItem(draftKey);
                    setFormData(originalDataRef.current);
                    setDirty(false);
                    setDraftStatus('idle');
                }
            });
        };
        void load().catch(error => { console.error('Failed to load record:', error); setHydrated(true); });
        return () => { active = false; };
    }, [currentId, draftKey, notify]);

    useEffect(() => {
        if (!hydrated || !dirty) return;
        const timer = window.setTimeout(() => {
            window.localStorage.setItem(draftKey, JSON.stringify({ data: formData, savedAt: new Date().toISOString() }));
            setDraftStatus('saved');
        }, 450);
        return () => window.clearTimeout(timer);
    }, [draftKey, dirty, formData, hydrated]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setDirty(true);
        setDraftStatus('saving');
        const { name, value, type } = e.target;
        setErrors(previous => { const next = { ...previous }; delete next[name]; return next; });
        const checked = (e.target as HTMLInputElement).checked;
        if (name === 'anesthesia_type') anesthesiaAutoSelectedRef.current = false;

        setFormData((prev: FormState) => {
            const next = {
                ...prev,
                [name]: type === 'checkbox' ? checked : value
            };
            if (name === 'history_none' && checked) {
                next.history_diabetes = false; next.history_hypertension = false; next.history_asthma = false;
                next.history_cardiopathy = false; next.history_others = '';
            } else if ((name.startsWith('history_') && name !== 'history_none') && (checked || value)) next.history_none = false;

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
            if ((name === 'clinical_diagnosis' || name === 'intervention_type') && (!prev.anesthesia_type || anesthesiaAutoSelectedRef.current)) {
                const prediction = predictAnesthesia(String(next.clinical_diagnosis), String(next.intervention_type));
                if (prediction?.canAutoSelect) {
                    next.anesthesia_type = prediction.value;
                    anesthesiaAutoSelectedRef.current = true;
                } else if (anesthesiaAutoSelectedRef.current) {
                    next.anesthesia_type = '';
                    anesthesiaAutoSelectedRef.current = false;
                }
            }
            return next;
        });
    };

    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setDirty(true);
        setDraftStatus('saving');
        setErrors(previous => { const next = { ...previous }; delete next.dob; delete next.age; return next; });
        const dob = e.target.value;
        setFormData((prev: FormState) => ({
            ...prev,
            dob,
            age: calculateAge(dob)
        }));
    };

    const setField = (name: keyof FormState, value: FormState[keyof FormState]) => {
        setDirty(true);
        setDraftStatus('saving');
        setErrors(previous => { const next = { ...previous }; delete next[String(name)]; if (String(name).startsWith('history_')) delete next.history; return next; });
        setFormData(previous => {
            const next = { ...previous, [name]: value };
            if ((name === 'clinical_diagnosis' || name === 'intervention_type') && (!previous.anesthesia_type || anesthesiaAutoSelectedRef.current)) {
                const prediction = predictAnesthesia(String(next.clinical_diagnosis), String(next.intervention_type));
                if (prediction?.canAutoSelect) {
                    next.anesthesia_type = prediction.value;
                    anesthesiaAutoSelectedRef.current = true;
                }
            }
            return next;
        });
    };

    const validate = () => {
        const next: Record<string, string> = {};
        const required: Array<[keyof FormState, string]> = [
            ['dossier_number', 'Numéro de dossier requis'], ['last_name', 'Nom requis'], ['first_name', 'Prénom requis'],
            ['dob', 'Date de naissance requise'], ['age', 'Âge requis'], ['gender', 'Sexe requis'],
            ['phone1', 'Téléphone principal requis'], ['address', 'Adresse requise'], ['distance', 'Distance requise'],
            ['weight', 'Poids requis'], ['height', 'Taille requise'], ['bmi', 'IMC requis'],
            ['blood_pressure', 'Tension artérielle requise'], ['temperature', 'Température requise'],
            ['heart_rate', 'Fréquence cardiaque requise'], ['respiratory_rate', 'Fréquence respiratoire requise'],
            ['spo2', 'SpO₂ requise'], ['clinical_diagnosis', 'Diagnostic requis'],
            ['intervention_type', 'Intervention requise'], ['observation', 'Observation requise'],
            ['asa_score', 'Score ASA requis'],
        ];
        for (const [field, message] of required) if (!String(formData[field] ?? '').trim()) next[field] = message;
        if (!effectiveAnesthesiaType) next.anesthesia_type = 'Type d’anesthésie requis';
        if (!effectiveAnesthesiaObservation.trim()) next.anesthesia_observation = 'Observation anesthésique requise';
        else if (effectiveAnesthesiaObservation.includes('À renseigner')) next.anesthesia_observation = 'Complétez les lignes préremplies marquées « À renseigner »';
        if (formData.program_mission && !formData.planning_day) next.planning_day = 'Jour de planning requis';
        if (!(formData.history_diabetes || formData.history_hypertension || formData.history_asthma || formData.history_cardiopathy || formData.history_none || formData.history_others.trim())) next.history = 'Renseignez au moins un antécédent ou « Aucun »';
        if (Number(formData.spo2) > 100) next.spo2 = 'La SpO₂ ne peut pas dépasser 100 %';
        if (Number(formData.temperature) && (Number(formData.temperature) < 25 || Number(formData.temperature) > 45)) next.temperature = 'Vérifiez la température saisie';
        return next;
    };

    const handleSubmit = async (createAnother = false) => {
        const nextErrors = validate();
        if (Object.keys(nextErrors).length) {
            setErrors(nextErrors);
            const firstField = Object.keys(nextErrors)[0];
            notify(`${Object.keys(nextErrors).length} champ(s) nécessaire(s) restent à compléter.`, 'error');
            const target = document.querySelector<HTMLElement>(`[name="${firstField}"], #${firstField}`);
            target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            window.setTimeout(() => target?.focus(), 350);
            return;
        }
        setLoading(true);
        try {
            const payload = { ...formData, anesthesia_type: effectiveAnesthesiaType, anesthesia_observation: effectiveAnesthesiaObservation };

            // Convert boolean to number (0 or 1)
            const recordToSave = {
                ...payload,
                program_mission: payload.program_mission ? 1 : 0,
                planning_day: payload.program_mission ? payload.planning_day : '',
                history_diabetes: payload.history_diabetes ? 1 : 0,
                history_hypertension: payload.history_hypertension ? 1 : 0,
                history_asthma: payload.history_asthma ? 1 : 0,
                history_cardiopathy: payload.history_cardiopathy ? 1 : 0,
                history_none: payload.history_none ? 1 : 0,

                // Ensure numeric fields are parsed correctly if they are strings in state
                age: String(payload.age) || '',
                weight: parseFloat(String(payload.weight).replace(',', '.')) || 0,
                height: parseFloat(String(payload.height).replace(',', '.')) || 0,
                bmi: parseFloat(String(payload.bmi).replace(',', '.')) || 0,
                temperature: parseFloat(String(payload.temperature).replace(',', '.')) || 0,

                heart_rate: parseInt(String(payload.heart_rate)) || 0,
                respiratory_rate: parseInt(String(payload.respiratory_rate)) || 0,
                spo2: parseInt(String(payload.spo2)) || 0,
                asa_score: parseInt(String(payload.asa_score)) || 0,
                distance: String(payload.distance || 'non précisé'),
                photo_url: '',
                created_at: initialData?.created_at || new Date().toISOString(),
                edition_id: currentEdition?.id
            };

            await saveMedicalRecord(recordToSave, initialData?.id);
            window.localStorage.removeItem(draftKey);
            setDirty(false);
            setDraftStatus('idle');
            notify(initialData?.id ? t('messages.updateSuccess') : 'Dossier enregistré sur cette tablette.', 'success');
            if (createAnother) {
                originalDataRef.current = defaultState;
                setInitialData(null);
                setFormData(defaultState);
                setErrors({});
                router.replace('/form');
                window.scrollTo({ top: 0, behavior: 'smooth' });
            } else router.push('/list');

        } catch (e) {
            console.error(e);
            notify(t('messages.saveError'), 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleNew = () => {
        window.localStorage.removeItem(draftKey);
        setDirty(false);
        setDraftStatus('idle');
        setErrors({});
        setFormData(defaultState);
        router.push('/form'); // Clear ID
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    return (
        <div className="clinical-form min-h-screen bg-slate-50 pb-40 sm:pb-28" onKeyDown={event => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); void handleSubmit(); } }}>
            {/* Header */}
            <header className="sticky top-16 z-40 border-b border-slate-200 bg-white px-4 py-3 md:px-6">
                <div className="mx-auto flex max-w-[1600px] items-start justify-between gap-2">
                    <div>
                        <div className="flex flex-wrap items-center gap-2"><h2 className="text-xs font-bold uppercase tracking-[0.16em] text-indigo-700">{t('header.title')}</h2><span className={`rounded-full px-2 py-0.5 text-xs font-bold ${dirty ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>{dirty ? draftStatus === 'saved' ? 'Brouillon local' : 'Sauvegarde locale…' : 'Enregistré'}</span><span className="text-xs font-bold text-slate-500">{completion}% complété</span></div>
                        <h1 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">
                            {t('header.subtitle')}
                        </h1>
                    </div>
                    <button
                        onClick={() => router.push('/dashboard')}
                        className="flex min-h-11 shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-600 transition hover:bg-slate-50 sm:px-4"
                    >
                        <span>←</span> {tCommon('back')}
                    </button>
                </div>
                <div className="mx-auto mt-3 h-1.5 max-w-[1600px] overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-label="Dossier complété" aria-valuenow={completion} aria-valuemin={0} aria-valuemax={100}><div className="h-full bg-indigo-600 transition-[width] duration-200" style={{ width: `${completion}%` }} /></div>
                <nav aria-label="Sections du dossier" className="mobile-scroll mx-auto mt-2 flex max-w-[1600px] gap-1 overflow-x-auto pb-1 text-sm font-bold text-slate-600"><a href="#identity" className="min-h-10 whitespace-nowrap rounded-lg px-3 py-2 hover:bg-slate-100">1. Identité</a><a href="#vitals" className="min-h-10 whitespace-nowrap rounded-lg px-3 py-2 hover:bg-slate-100">2. Constantes</a><a href="#surgical" className="min-h-10 whitespace-nowrap rounded-lg px-3 py-2 hover:bg-slate-100">3. Consultation</a><a href="#anesthesia" className="min-h-10 whitespace-nowrap rounded-lg px-3 py-2 hover:bg-slate-100">4. Anesthésie</a></nav>
            </header>

            <main className="mx-auto grid max-w-[1440px] grid-cols-1 items-start gap-6 p-4 md:p-7 xl:grid-cols-12">

                {/* LEFT COLUMN: IDENTITY */}
                <aside id="identity" className="scroll-mt-36 space-y-5 xl:col-span-4">
                    {/* DOSSIER */}
                    <div className="group relative overflow-hidden rounded-3xl border border-slate-100 bg-white p-4 shadow-sm sm:p-6">
                        <label htmlFor="dossier_number" className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">{t('dossierNumber')} <span className="text-red-600">*</span></label>
                        <input
                            id="dossier_number"
                            type="text"
                            name="dossier_number"
                            value={formData.dossier_number}
                            onChange={handleChange}
                            inputMode="numeric"
                            autoComplete="off"
                            aria-invalid={Boolean(errors.dossier_number)}
                            className={`w-full border-none bg-transparent p-0 text-5xl font-black text-slate-800 placeholder-slate-200 focus:ring-0 ${errors.dossier_number ? 'rounded-lg bg-red-50' : ''}`}
                            placeholder={t('dossierPlaceholder')}
                        />
                        {errors.dossier_number && <p className="mt-2 text-sm font-semibold text-red-700">{errors.dossier_number}</p>}
                    </div>

                    {duplicates.length > 0 && <section aria-labelledby="duplicate-title" className="rounded-xl border border-amber-300 bg-amber-50 p-4"><h3 id="duplicate-title" className="font-black text-amber-950">Patient similaire trouvé</h3><p className="mt-1 text-sm text-amber-800">Vérifiez avant de créer un doublon.</p><div className="mt-3 space-y-2">{duplicates.map(record => <button key={record.public_id} type="button" onClick={() => router.push(`/form?id=${record.id}`)} className="flex min-h-11 w-full items-center justify-between rounded-lg border border-amber-200 bg-white px-3 text-left text-sm"><span><strong className="block text-slate-900">{record.last_name} {record.first_name}</strong><span className="text-slate-500">Dossier {record.dossier_number || 'sans numéro'}</span></span><span className="font-bold text-indigo-700">Ouvrir</span></button>)}</div></section>}

                    {/* PERSONAL INFO */}
                    <div className="space-y-6 rounded-3xl border border-slate-100 bg-white p-4 shadow-sm sm:p-6">
                        <div className="flex items-center gap-4 mb-2 pb-4 border-b border-gray-50">
                            <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
                                <Icons.User />
                            </div>
                            <h3 className="text-lg font-bold text-slate-700">{t('identity.title')}</h3>
                        </div>

                        <div className="grid grid-cols-1 gap-4">
                            <InputField label={t('identity.lastNameMalagasy')} name="last_name" value={formData.last_name} onChange={handleChange} error={errors.last_name} required autoComplete="family-name" />
                            <InputField label={t('identity.firstNameMalagasy')} name="first_name" value={formData.first_name} onChange={handleChange} error={errors.first_name} required autoComplete="given-name" />
                        </div>

                        <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2">
                            <InputField label={t('identity.dob')} name="dob" type="date" value={formData.dob} onChange={handleDateChange} error={errors.dob} required autoComplete="bday" />
                            <InputField label={t('identity.ageMalagasy')} name="age" type="text" value={formData.age} onChange={handleChange} error={errors.age} required inputMode="numeric" />
                        </div>

                        <div id="gender">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 block pl-1">{t('identity.gender')} <span className="text-red-600">*</span></label>
                            <div className="grid grid-cols-2 gap-3">
                                {['M', 'F'].map((g) => (
                                    <button
                                        key={g}
                                        type="button"
                                        onClick={() => setField('gender', g)}
                                        className={`py-3 px-4 rounded-xl border-2 font-bold transition-all ${formData.gender === g
                                            ? 'border-indigo-500 bg-indigo-50 text-indigo-700 shadow-sm'
                                            : 'border-slate-100 bg-white text-slate-400 hover:border-slate-200'
                                            }`}
                                    >
                                        {g === 'M' ? t('identity.male') : t('identity.female')}
                                    </button>
                                ))}
                            </div>
                            {errors.gender && <p className="mt-2 text-sm font-semibold text-red-700">{errors.gender}</p>}
                        </div>
                    </div>

                    {/* CONTACT */}
                    <div className="space-y-4 rounded-3xl border border-slate-100 bg-white p-4 shadow-sm sm:p-6">
                        <div className="flex items-center gap-4 mb-2 pb-4 border-b border-gray-50">
                            <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
                                <Icons.Phone />
                            </div>
                            <h3 className="text-lg font-bold text-slate-700">{t('contact.title')}</h3>
                        </div>
                        <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2">
                            <InputField label={t('contact.phone1')} name="phone1" value={formData.phone1} onChange={handleChange} error={errors.phone1} required inputMode="tel" autoComplete="tel" />
                            <InputField label={t('contact.phone2')} name="phone2" value={formData.phone2} onChange={handleChange} inputMode="tel" />
                        </div>
                        <InputField label={t('contact.address')} name="address" value={formData.address} onChange={handleChange} error={errors.address} suggestions={suggestions.addresses} onValueChange={value => setField('address', value)} required autoComplete="street-address" />

                        <div>
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 block pl-1">{t('contact.distance')}</label>
                            <div className="grid grid-cols-2 gap-3">
                                {[
                                    { value: 'en ville', label: 'inCity' },
                                    { value: 'un peu loin', label: 'nearby' },
                                    { value: 'loin', label: 'far' },
                                    { value: 'non précisé', label: 'unspecified' }
                                ].map((option) => (
                                    <button
                                        key={option.value}
                                        type="button"
                                        onClick={() => setField('distance', option.value)}
                                        className={`py-3 px-4 rounded-xl border-2 font-bold transition-all text-sm ${formData.distance === option.value
                                            ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm'
                                            : 'border-slate-100 bg-white text-slate-400 hover:border-slate-200'
                                            }`}
                                    >
                                        {tEnums(`distance.${option.label}`)}
                                    </button>
                                ))}
                            </div>
                            {errors.distance && <p className="mt-2 text-sm font-semibold text-red-700">{errors.distance}</p>}
                        </div>
                        <a href="#vitals" className="flex min-h-11 items-center justify-center rounded-lg bg-slate-900 px-4 font-bold text-white">Continuer vers les constantes ↓</a>
                    </div>
                </aside>

                {/* RIGHT COLUMN: MEDICAL */}
                <section className="space-y-5 xl:col-span-8">

                    <div id="vitals" className="scroll-mt-36" />
                    {/* VITALS */}
                    <div className="grid grid-cols-1 gap-4 min-[380px]:grid-cols-2 md:grid-cols-4">
                        <VitalCard label={t('vitals.weight')} name="weight" unit="kg" value={formData.weight} icon={<Icons.Activity />} color="blue" onChange={handleChange} error={errors.weight} />
                        <VitalCard label={t('vitals.height')} name="height" unit="cm" value={formData.height} icon={<Icons.Activity />} color="blue" onChange={handleChange} error={errors.height} />
                        <div className={`relative overflow-hidden rounded-xl border bg-white p-4 text-slate-900 ${errors.bmi ? 'border-red-500' : 'border-slate-200'}`}>
                            <div className="absolute top-0 right-0 p-2 opacity-20">
                                <Icons.Activity />
                            </div>
                            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">{t('vitals.bmi')}</label>
                            <div className="flex items-baseline gap-1">
                                <input
                                    name="bmi"
                                    value={formData.bmi}
                                    onChange={handleChange}
                                    placeholder="--"
                                    className="w-full border-none bg-transparent p-0 text-2xl font-black text-slate-900 placeholder-slate-300 focus:outline-none"
                                />
                            </div>
                            {errors.bmi && <p className="mt-2 text-xs font-semibold text-red-700">{errors.bmi}</p>}
                        </div>
                        <VitalCard label={t('vitals.temp')} name="temperature" unit="°C" value={formData.temperature} icon={<Icons.Activity />} color="orange" onChange={handleChange} error={errors.temperature} />
                    </div>
                    <div className="grid grid-cols-1 gap-4 min-[380px]:grid-cols-2 md:grid-cols-4">
                        <VitalCard label={t('vitals.bloodPressure')} name="blood_pressure" unit="mmHg" value={formData.blood_pressure} icon={<Icons.Heart />} color="red" onChange={handleChange} error={errors.blood_pressure} />
                        <VitalCard label={t('vitals.pulse')} name="heart_rate" unit="bpm" value={formData.heart_rate} icon={<Icons.Heart />} color="red" onChange={handleChange} error={errors.heart_rate} />
                        <VitalCard label={t('vitals.respiration')} name="respiratory_rate" unit="cpm" value={formData.respiratory_rate} icon={<Icons.Activity />} color="teal" onChange={handleChange} error={errors.respiratory_rate} />
                        <VitalCard label={t('vitals.spo2')} name="spo2" unit="%" value={formData.spo2} icon={<Icons.Activity />} color="cyan" onChange={handleChange} error={errors.spo2} />
                    </div>
                    <a href="#surgical" className="flex min-h-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 font-bold text-slate-800">Continuer vers la consultation ↓</a>

                    {/* SURGICAL */}
                    <div id="surgical" className="scroll-mt-36 rounded-xl border border-slate-200 bg-white p-5 md:p-7">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center text-rose-600">
                                <Icons.Syringe />
                            </div>
                            <h3 className="text-xl font-bold text-slate-700">{t('surgical.title')}</h3>
                        </div>

                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <InputField label={t('surgical.clinicalDiagnosis')} name="clinical_diagnosis" value={formData.clinical_diagnosis} onChange={handleChange} placeholder={t('surgical.clinicalDiagnosisPlaceholder')} suggestions={suggestions.diagnoses} onValueChange={value => setField('clinical_diagnosis', value)} error={errors.clinical_diagnosis} required />
                                <div className="space-y-4">
                                    <InputField label={t('surgical.interventionType')} name="intervention_type" value={formData.intervention_type} onChange={handleChange} suggestions={suggestions.interventions} onValueChange={value => setField('intervention_type', value)} error={errors.intervention_type} required />
                                    <div className="p-4 bg-orange-50 rounded-2xl border border-orange-100">
                                        <label className="text-xs font-bold text-orange-400 uppercase tracking-wider mb-2 block">{t('surgical.toSchedule')}</label>
                                        <div className="flex gap-4">
                                            {[true, false].map(val => (
                                                <label key={String(val)} className="flex items-center gap-2 cursor-pointer">
                                                    <input
                                                        type="radio"
                                                        name="program_mission_radio"
                                                        checked={formData.program_mission === val}
                                                        onChange={() => {
                                                            setField('program_mission', val);
                                                            setField('planning_day', val && !formData.planning_day ? 'A définir' : (!val ? '' : formData.planning_day));
                                                        }}
                                                        className="w-5 h-5 text-orange-500 focus:ring-orange-400 bg-white"
                                                    />
                                                    <span className={`font-semibold ${formData.program_mission === val ? 'text-orange-700' : 'text-gray-500'}`}>
                                                        {val ? 'Oui' : 'Non'}
                                                    </span>
                                                </label>
                                            ))}
                                        </div>

                                        {/* PLANNING DAY SELECTOR */}
                                        {formData.program_mission && (
                                            <div id="planning_day" className="mt-4 pt-4 border-t border-orange-200/50 animate-fadeIn">
                                                <label className="text-xs font-bold text-orange-400 uppercase tracking-wider mb-2 block">{t('surgical.plannedDay')}</label>
                                                <div className="flex flex-wrap gap-2">
                                                    {[
                                                        { value: 'A définir', label: 'toDefine' },
                                                        { value: 'Lundi', label: 'monday' },
                                                        { value: 'Mardi', label: 'tuesday' },
                                                        { value: 'Mercredi', label: 'wednesday' },
                                                        { value: 'Jeudi', label: 'thursday' },
                                                        { value: 'Vendredi', label: 'friday' }
                                                    ].map(day => (
                                                        <button
                                                            key={day.value}
                                                            type="button"
                                                            onClick={() => setField('planning_day', day.value)}
                                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${formData.planning_day === day.value
                                                                ? 'bg-orange-500 text-white border-orange-500 shadow-sm'
                                                                : 'bg-white text-gray-500 border-orange-100 hover:border-orange-200 hover:bg-orange-50'
                                                                }`}
                                                        >
                                                            {tEnums(`days.${day.label}`)}
                                                        </button>
                                                    ))}
                                                </div>
                                                {errors.planning_day && <p className="mt-2 text-sm font-semibold text-red-700">{errors.planning_day}</p>}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <DynamicAutocompleteLines
                                label={t('surgical.observation')}
                                name="observation"
                                value={formData.observation}
                                onValueChange={value => setField('observation', value)}
                                suggestions={suggestions.observations}
                                placeholder={t('surgical.observationPlaceholder')}
                                error={errors.observation}
                                required
                            />
                            <a href="#anesthesia" className="flex min-h-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 font-bold text-slate-800">Continuer vers l’anesthésie ↓</a>
                        </div>
                    </div>


                    {/* PRE-ANESTHESIA */}
                    <div id="anesthesia" className="scroll-mt-36 grid grid-cols-1 gap-5 lg:grid-cols-2">
                        <div id="history" className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm sm:p-6 md:p-8">
                            <h3 className="text-lg font-bold text-slate-700 mb-4">{t('anesthesia.history')} <span className="text-red-600">*</span></h3>
                            <div className="space-y-2">
                                {([
                                    { k: 'history_diabetes', l: t('anesthesia.diabetes') },
                                    { k: 'history_hypertension', l: t('anesthesia.hypertension') },
                                    { k: 'history_asthma', l: t('anesthesia.asthma') },
                                    { k: 'history_cardiopathy', l: t('anesthesia.cardiopathy') },
                                    { k: 'history_none', l: 'Aucun antécédent' }
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
                                <InputField name="history_others" label="Autres antécédents" placeholder={t('anesthesia.othersPlaceholder')} value={formData.history_others} onChange={handleChange} suggestions={suggestions.history} onValueChange={value => setField('history_others', value)} />
                                {errors.history && <p className="text-sm font-semibold text-red-700">{errors.history}</p>}
                            </div>
                        </div>

                        <div className="flex flex-col justify-between rounded-3xl border border-slate-100 bg-white p-4 shadow-sm sm:p-6 md:p-8">
                            <div>
                                <h3 className="text-lg font-bold text-slate-700 mb-4">{t('anesthesia.asaScore')} <span className="text-red-600">*</span></h3>
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
                                {errors.asa_score && <p className="mt-3 text-sm font-semibold text-red-700">{errors.asa_score}</p>}
                            </div>
                        </div>
                    </div>

                    {/* ANESTHESIA TYPE */}
                    <div className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm sm:p-6 md:p-8">
                        <h3 className="text-lg font-bold text-slate-700 mb-3">{t('anesthesia.anesthesiaType')} <span className="text-red-600">*</span></h3>
                        {anesthesiaPrediction && anesthesiaPrediction.support >= 2 && <div className={`mb-5 rounded-xl border p-3 text-sm ${anesthesiaPrediction.canAutoSelect ? 'border-indigo-200 bg-indigo-50 text-indigo-950' : 'border-slate-200 bg-slate-50 text-slate-700'}`}><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><p><strong>{anesthesiaPrediction.canAutoSelect && effectiveAnesthesiaType === anesthesiaPrediction.value ? 'Préselection intelligente' : 'Suggestion historique'} :</strong> {anesthesiaPrediction.value}<span className="ml-1 text-xs">({Math.round(anesthesiaPrediction.confidence * 100)} %, {anesthesiaPrediction.support} dossiers similaires)</span></p>{effectiveAnesthesiaType !== anesthesiaPrediction.value && <button type="button" onClick={() => { anesthesiaAutoSelectedRef.current = false; setField('anesthesia_type', anesthesiaPrediction.value); }} className="min-h-10 rounded-lg border border-indigo-300 bg-white px-3 font-bold text-indigo-800">Utiliser</button>}</div><p className="mt-1 text-xs">À vérifier par l’équipe médicale, cette proposition ne remplace pas la décision clinique.</p></div>}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                            {[
                                { value: 'Locale', label: 'local' },
                                { value: 'Locorégionale', label: 'regional' },
                                { value: 'Générale', label: 'general' }
                            ].map((type) => (
                                <label key={type.value} className="cursor-pointer group">
                                    <input
                                        type="radio"
                                        name="anesthesia_type"
                                        value={type.value}
                                        checked={effectiveAnesthesiaType === type.value}
                                        onChange={handleChange}
                                        className="hidden"
                                    />
                                    <div className={`
                                        p-4 rounded-2xl border-2 transition-all text-center
                                        ${effectiveAnesthesiaType === type.value
                                            ? 'border-violet-500 bg-violet-50 text-violet-700 font-bold shadow-md'
                                            : 'border-slate-100 text-slate-500 hover:border-violet-200'}
                                    `}>
                                        {t(`anesthesia.${type.label}`)}
                                    </div>
                                </label>
                            ))}
                        </div>
                        {errors.anesthesia_type && <p className="mb-4 text-sm font-semibold text-red-700">{errors.anesthesia_type}</p>}
                        <div className="mb-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600"><strong>Saisie rapide :</strong> touchez une ligne pour afficher immédiatement les valeurs compatibles avec sa rubrique. Tapez quelques lettres pour filtrer, utilisez ↑/↓ puis Entrée au clavier. Chaque proposition reste entièrement modifiable.</div>
                        <DynamicAutocompleteLines
                            label={t('anesthesia.anesthesiaObservation')}
                            name="anesthesia_observation"
                            value={effectiveAnesthesiaObservation}
                            onValueChange={value => setField('anesthesia_observation', value)}
                            suggestions={anesthesiaObservationSuggestions}
                            placeholder={t('anesthesia.anesthesiaObservationPlaceholder')}
                            error={errors.anesthesia_observation}
                            required
                        />
                    </div>

                </section>
            </main>

            {/* Persistent rush-mode actions */}
            <div className="mobile-safe-bottom fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 px-4 pt-3 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur no-print">
                <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-2"><p className="hidden flex-1 text-sm font-semibold text-slate-600 md:block">{dirty ? draftStatus === 'saved' ? 'Brouillon sécurisé localement.' : 'Sauvegarde du brouillon…' : 'Dossier enregistré sur cette tablette.'} <span className="text-slate-400">Ctrl/⌘ + S</span></p><button onClick={handleNew} className="min-h-12 rounded-lg border border-slate-300 px-4 font-bold text-slate-700">{initialData ? 'Annuler' : 'Vider'}</button><button onClick={() => router.push('/list')} className="hidden min-h-12 rounded-lg border border-slate-300 px-4 font-bold text-slate-700 sm:block">Patients</button><button onClick={() => void handleSubmit()} disabled={loading} className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-5 font-bold text-white hover:bg-indigo-700 disabled:opacity-50 sm:flex-none">{loading ? <span className="animate-spin">◌</span> : <Icons.Save />}<span>{loading ? 'Enregistrement…' : tCommon('save')}</span></button><button onClick={() => void handleSubmit(true)} disabled={loading || Boolean(initialData)} className="min-h-11 basis-full rounded-lg border border-indigo-300 bg-indigo-50 px-4 text-sm font-bold text-indigo-800 disabled:hidden sm:min-h-12 sm:basis-auto">Enregistrer et nouveau</button></div>
            </div>
        </div >
    );
}
