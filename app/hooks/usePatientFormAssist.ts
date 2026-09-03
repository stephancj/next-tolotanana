'use client';

import { useCallback, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type MedicalRecord } from '@/lib/client-db';

type PatientContext = {
    dossier_number: string;
    last_name: string;
    first_name: string;
    phone1: string;
    clinical_diagnosis: string;
    intervention_type: string;
};

export type AnesthesiaPrediction = {
    value: string;
    confidence: number;
    support: number;
    canAutoSelect: boolean;
};

const normalize = (value: unknown) => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('fr');

const canonicalSuggestion = (rawValue: string, field: keyof MedicalRecord) => {
    const value = rawValue.trim().replace(/\s+/g, ' ');
    let key = normalize(value)
        .replace(/[’']/g, ' ')
        .replace(/[^a-z0-9+/%\s-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    let preferred: string | undefined;

    if (field === 'intervention_type') {
        if (/^cure\s+chir(?:urgicale|ugicale|uricale|urgical|rugicale)?$/.test(key)) { key = 'cure chirurgicale'; preferred = 'Cure chirurgicale'; }
        else if (/^ex[ée]r[eè]se(?:\s+chirurgicale)?$/.test(key) || /^exerese(?:\s+chirurgicale)?$/.test(key)) { key = 'exerese'; preferred = 'Exérèse'; }
        else if (/^ch[ée]?i?loplastie$/.test(key) || /^chelopastie$/.test(key)) { key = 'cheiloplastie'; preferred = 'Chéiloplastie'; }
        else if (/^v[ée]loplastie$/.test(key)) { key = 'veloplastie'; preferred = 'Véloplastie'; }
        else if (/^palato[- ]?plastie$/.test(key)) { key = 'palatoplastie'; preferred = 'Palatoplastie'; }
    }

    if (field === 'address') {
        key = key.replace(/\s*\((loin|en ville|un peu loin)\)\s*$/, '').trim();
        if (/\s*\((loin|en ville|un peu loin)\)\s*$/i.test(value)) preferred = value.replace(/\s*\([^)]*\)\s*$/, '').trim();
    }

    if (field === 'observation' || field === 'anesthesia_observation') {
        key = key.replace(/\bpoumons\b/g, 'poumon').replace(/\blibres\b/g, 'libre').replace(/\bbien frappes\b/g, 'bien frappe');
        if (/^(poumon|pl)\s*(libre)?$/.test(key)) { key = 'poumon libre'; preferred = 'Poumons libres'; }
        else if (/^(bdc\s*)?(bien frappe|bf)(\s+regulier)?$/.test(key)) { key = 'bdc bien frappe'; preferred = 'BDC bien frappés et réguliers'; }
        else if (/^(pas d |aucune |0\s*)?allergie(s)?(\s*:?\s*(non|0))?$/.test(key) || /^allergie\s*:?\s*(non|0)$/.test(key)) { key = 'allergie aucune connue'; preferred = 'Allergies : aucune connue'; }
        else if ((key.includes('solide') && key.includes('6h') && key.includes('liquide') && key.includes('2h')) || /6\s*h\s*s.*2\s*h\s*l/.test(key)) {
            key = 'jeune preoperatoire solide 6h liquide clair 2h';
            preferred = 'Jeûne pré-opératoire : solide 6 h, liquide clair 2 h';
        }
    }

    return { key, preferred, value };
};

const rankedValues = (records: MedicalRecord[], field: keyof MedicalRecord, limit = 30, splitLines = false) => {
    const groups = new Map<string, { count: number; variants: Map<string, number>; preferred?: string }>();
    for (const record of records) {
        const rawValue = String(record[field] || '').trim();
        const recordValues = splitLines ? rawValue.split(/\r?\n|\s*[;•]\s*/g) : [rawValue];
        for (const candidate of recordValues) {
            const cleaned = canonicalSuggestion(candidate, field);
            if (!cleaned.key || cleaned.value.length < 2 || cleaned.value.length > 140) continue;
            const group = groups.get(cleaned.key) || { count: 0, variants: new Map<string, number>(), preferred: cleaned.preferred };
            group.count += 1;
            group.preferred ||= cleaned.preferred;
            group.variants.set(cleaned.value, (group.variants.get(cleaned.value) || 0) + 1);
            groups.set(cleaned.key, group);
        }
    }
    return [...groups.values()]
        .map(group => ({
            count: group.count,
            value: group.preferred || [...group.variants.entries()].sort((a, b) => b[1] - a[1] || b[0].length - a[0].length || a[0].localeCompare(b[0], 'fr'))[0][0]
        }))
        .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value, 'fr'))
        .slice(0, limit)
        .map(item => item.value);
};

export function usePatientFormAssist(editionId: number | undefined, currentId: number | undefined, context: PatientContext) {
    const queriedRecords = useLiveQuery<MedicalRecord[]>(
        () => db.medical_records.filter(record => record.deleted !== 1).toArray(),
        []
    );
    const records = useMemo(() => queriedRecords || [], [queriedRecords]);

    const suggestions = useMemo(() => ({
        addresses: rankedValues(records, 'address'),
        diagnoses: rankedValues(records, 'clinical_diagnosis'),
        interventions: rankedValues(records, 'intervention_type'),
        history: rankedValues(records, 'history_others', 20),
        observations: rankedValues(records, 'observation', 40, true),
        anesthesiaObservations: rankedValues(records, 'anesthesia_observation', 40, true),
    }), [records]);

    const duplicates = useMemo(() => {
        const dossier = normalize(context.dossier_number);
        const phone = normalize(context.phone1).replace(/\D/g, '');
        const lastName = normalize(context.last_name);
        const firstName = normalize(context.first_name);
        if (!dossier && phone.length < 6 && (!lastName || !firstName)) return [];

        return records.filter(record => {
            if (record.id === currentId || (editionId && record.edition_id !== editionId)) return false;
            const sameDossier = dossier && normalize(record.dossier_number) === dossier;
            const recordPhone = normalize(record.phone1).replace(/\D/g, '');
            const samePhone = phone.length >= 6 && recordPhone === phone;
            const sameName = lastName && firstName
                && normalize(record.last_name) === lastName
                && normalize(record.first_name) === firstName;
            return Boolean(sameDossier || samePhone || sameName);
        }).slice(0, 3);
    }, [context.dossier_number, context.first_name, context.last_name, context.phone1, currentId, editionId, records]);

    const predictAnesthesia = useCallback((diagnosis: string, intervention: string): AnesthesiaPrediction | null => {
        const normalizedDiagnosis = normalize(diagnosis);
        const normalizedIntervention = normalize(intervention);
        if (!normalizedDiagnosis && !normalizedIntervention) return null;
        const scores = new Map<string, { value: string; score: number }>();
        let totalScore = 0;
        let support = 0;
        for (const record of records) {
            const anesthesia = String(record.anesthesia_type || '').trim();
            if (!anesthesia) continue;
            let weight = 0;
            if (normalizedIntervention && normalize(record.intervention_type) === normalizedIntervention) weight += 2;
            if (normalizedDiagnosis && normalize(record.clinical_diagnosis) === normalizedDiagnosis) weight += 1;
            if (!weight) continue;
            support += 1;
            totalScore += weight;
            const key = normalize(anesthesia);
            const current = scores.get(key) || { value: anesthesia, score: 0 };
            current.score += weight;
            scores.set(key, current);
        }
        const winner = [...scores.values()].sort((a, b) => b.score - a.score)[0];
        if (!winner || !totalScore) return null;
        const confidence = winner.score / totalScore;
        return { value: winner.value, confidence, support, canAutoSelect: support >= 3 && confidence >= 0.8 };
    }, [records]);

    const anesthesiaPrediction = useMemo(
        () => predictAnesthesia(context.clinical_diagnosis, context.intervention_type),
        [context.clinical_diagnosis, context.intervention_type, predictAnesthesia]
    );

    return { suggestions, duplicates, anesthesiaPrediction, predictAnesthesia };
}
