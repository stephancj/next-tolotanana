import type { MedicalRecord } from './client-db';

export const DIAGNOSES = [
  ['fente', 'Fente labio-palatine'], ['burn', 'Brûlure / cicatrice'], ['hernia', 'Hernie'],
  ['lipoma', 'Lipome'], ['cyst', 'Kyste'], ['mass', 'Tumeur / masse'],
  ['urology', 'Urologie'], ['pain', 'Douleur / gastrique'], ['other', 'Autre'], ['unknown', 'Non renseigné'],
] as const;

export interface PatientFilters {
  query: string; category: string; cleftType: string; laterality: string;
  ageMin: string; ageMax: string; ageUnit: 'years' | 'months'; ageUnknown: boolean;
  distance: string; called: string; preOp: string; incomplete: string; gender: string;
  surgeon: string; photo: string; sync: string; day: string; programmed: string;
}

export const EMPTY_FILTERS: PatientFilters = {
  query: '', category: '', cleftType: '', laterality: '', ageMin: '', ageMax: '', ageUnit: 'years', ageUnknown: false,
  distance: '', called: '', preOp: '', incomplete: '', gender: '', surgeon: '', photo: '', sync: '', day: '', programmed: '',
};

export function normalize(value: unknown): string {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
}

// The age text can include both years and months. An absent age must never become zero.
export function ageInMonths(value: unknown): number | null {
  const text = normalize(value).replace(',', '.');
  if (!text) return null;
  if (/^<\s*1\s+semaine/.test(text)) return 0;
  if (/^<\s*1\s+an/.test(text)) return 0;
  const years = text.match(/(\d+(?:\.\d+)?)\s*ans?\b/);
  const months = text.match(/(\d+(?:\.\d+)?)\s*mois\b/);
  const weeks = text.match(/(\d+(?:\.\d+)?)\s*semaines?\b/);
  if (years || months || weeks) return Number(years?.[1] || 0) * 12 + Number(months?.[1] || 0) + Number(weeks?.[1] || 0) * 12 / 52;
  return /^\d+(?:\.\d+)?$/.test(text) ? Number(text) * 12 : null;
}

function triState(value: unknown): string {
  if (value === 1 || value === true || value === '1') return 'yes';
  if (value === 0 || value === false || value === '0') return 'no';
  return 'unknown';
}

export function diagnosisCategory(record: MedicalRecord): string {
  const category = normalize(record.diagnosis_category);
  const text = normalize(record.clinical_diagnosis);
  if (category.includes('fente')) return 'fente';
  if (category.includes('reparatrice') || category.includes('brulure') || category.includes('cicatrice')) return 'burn';
  const known: Record<string, string> = { hernie: 'hernia', lipome: 'lipoma', kyste: 'cyst', 'tumeur / masse': 'mass', urologie: 'urology', 'douleur / gastrique': 'pain', autre: 'other' };
  if (known[category]) return known[category];
  if (text.includes('fente')) return 'fente';
  return !text || ['non precise', 'non renseigne'].includes(category) ? 'unknown' : 'other';
}

export function hasPhotoLink(record: MedicalRecord): boolean {
  return Boolean(record.photo_url?.trim()) || /photos?[^\n]*https?:\/\/\S+/i.test(record.observation || '');
}

function missingFields(record: MedicalRecord): string[] {
  const missing = [];
  if (!record.phone1?.trim() && !record.phone2?.trim()) missing.push('phone');
  if (!record.dob?.trim() && ageInMonths(record.age) === null) missing.push('age');
  if (!['m', 'f'].includes(normalize(record.gender))) missing.push('gender');
  if (!record.address?.trim()) missing.push('address');
  if (!record.clinical_diagnosis?.trim()) missing.push('diagnosis');
  return missing;
}

export function matchesPatient(record: MedicalRecord, filters: PatientFilters, surgeonIds: readonly number[] = []): boolean {
  const f = filters;
  const query = normalize(f.query);
  if (query) {
    const text = normalize([record.dossier_number, record.last_name, record.first_name, record.phone1, record.phone2, record.address, record.clinical_diagnosis].filter(Boolean).join(' '));
    // Spaces and punctuation in phone input do not change the match.
    const phoneQuery = query.replace(/\D/g, '');
    const phoneMatch = /^[+\d\s()./-]+$/.test(query) && phoneQuery.length >= 3 && [record.phone1, record.phone2].some(p => String(p || '').replace(/\D/g, '').includes(phoneQuery));
    if (!text.includes(query) && !phoneMatch) return false;
  }
  const category = diagnosisCategory(record);
  if (f.category && f.category !== category) return false;
  const diagnosis = normalize(record.clinical_diagnosis);
  if (f.cleftType || f.laterality) {
    if (category !== 'fente') return false;
    const labial = /labial|labio|levre/.test(diagnosis);
    const palatal = /palatin|palais/.test(diagnosis);
    const type = labial && palatal ? 'both' : labial ? 'lip' : palatal ? 'palate' : 'unknown';
    const side = /bilateral/.test(diagnosis) ? 'bilateral' : /unilateral/.test(diagnosis) ? 'unilateral' : 'unknown';
    if (f.cleftType && type !== f.cleftType || f.laterality && side !== f.laterality) return false;
  }
  const age = ageInMonths(record.age);
  if (f.ageUnknown && age !== null) return false;
  if (f.ageMin !== '' || f.ageMax !== '') {
    const factor = f.ageUnit === 'years' ? 12 : 1;
    if (age === null || f.ageMin !== '' && age < Number(f.ageMin) * factor || f.ageMax !== '' && age > Number(f.ageMax) * factor) return false;
  }
  const distance = normalize(record.distance);
  if (f.distance === 'unknown' ? distance && !['non precise', 'non renseigne'].includes(distance) : f.distance && distance !== f.distance) return false;
  if (f.called && triState(record.pre_op_call) !== f.called) return false;
  if (f.preOp && triState(record.pre_op_checked) !== f.preOp) return false;
  if (f.gender && (f.gender === 'unknown' ? ['m', 'f'].includes(normalize(record.gender)) : normalize(record.gender) !== f.gender)) return false;
  if (f.incomplete) {
    const missing = missingFields(record);
    if (f.incomplete === 'any' ? !missing.length : !missing.includes(f.incomplete)) return false;
  }
  if (f.surgeon && (f.surgeon === 'none' ? surgeonIds.length > 0 : !surgeonIds.includes(Number(f.surgeon)))) return false;
  if (f.photo && hasPhotoLink(record) !== (f.photo === 'yes')) return false;
  const sync = record.sync_status === 'synced' ? 'synced' : record.sync_status === 'conflict' ? 'conflict' : 'pending';
  if (f.sync && sync !== f.sync) return false;
  const day = normalize(record.planning_day);
  const undefinedDay = !day || ['a definir', 'jour a definir', 'non precise'].includes(day);
  if (f.day && (f.day === 'undefined' ? !undefinedDay : day !== normalize(f.day))) return false;
  if (f.programmed && (record.program_mission === 1) !== (f.programmed === 'yes')) return false;
  return true;
}

export function activeFilterCount(filters: PatientFilters): number {
  return Object.entries(filters).filter(([key, value]) => !['query', 'ageUnit'].includes(key) && Boolean(value)).length;
}
