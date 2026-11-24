import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { MedicalRecord } from './client-db';
import { ageInMonths, EMPTY_FILTERS, matchesPatient, type PatientFilters } from './patient-filters';

const patient = (values: Partial<MedicalRecord> = {}) => ({
  age: '6 mois', gender: 'F', phone1: '0341234567', phone2: '0329876543',
  address: 'Ampitatafika', clinical_diagnosis: 'Fente palatine (déclaré)',
  diagnosis_category: 'Fente Labio-Palatine', distance: 'Loin', program_mission: 0,
  observation: '', ...values,
}) as MedicalRecord;
const matches = (record: MedicalRecord, filters: Partial<PatientFilters>, surgeons: number[] = []) => matchesPatient(record, { ...EMPTY_FILTERS, ...filters }, surgeons);

test('age bounds compare weeks, months and years numerically, including compound ages', () => {
  assert.equal(ageInMonths('1 an et 6 mois'), 18);
  assert.equal(ageInMonths(''), null);
  assert.equal(ageInMonths(null), null);
  assert.equal(matches(patient(), { ageMax: '1' }), true);
  assert.equal(matches(patient({ age: '18 mois' }), { ageMax: '1' }), false);
  assert.equal(matches(patient({ age: '3 semaines' }), { ageMax: '1', ageUnit: 'months' }), true);
  assert.equal(matches(patient({ age: '' }), { ageMax: '2' }), false);
  assert.equal(matches(patient({ age: '0 mois' }), { ageUnknown: true }), false);
  assert.equal(matches(patient({ age: '' }), { ageUnknown: true }), true);
  assert.equal(matches(patient({ age: '2 ans' }), { ageMin: '2', ageMax: '2' }), true);
});

test('historical diagnosis labels, cleft types and laterality remain distinct', () => {
  assert.equal(matches(patient({ diagnosis_category: 'Fente' }), { category: 'fente' }), true);
  assert.equal(matches(patient({ clinical_diagnosis: 'Fente labio-palatine bilatérale' }), { cleftType: 'both', laterality: 'bilateral' }), true);
  assert.equal(matches(patient({ clinical_diagnosis: 'Fente palatine unilatérale' }), { laterality: 'bilateral' }), false);
  assert.equal(matches(patient({ clinical_diagnosis: 'Fente de la lèvre et de la gencive (déclaré)' }), { cleftType: 'lip' }), true);
  assert.equal(matches(patient({ diagnosis_category: 'Hernie', clinical_diagnosis: 'Hernie' }), { cleftType: 'unknown' }), false);
  assert.equal(matches(patient({ clinical_diagnosis: '', diagnosis_category: 'Non précisé' }), { category: 'unknown' }), true);
});

test('null status does not mean explicitly no; integer and boolean values work', () => {
  for (const field of ['pre_op_call', 'pre_op_checked'] as const) {
    const filter = field === 'pre_op_call' ? 'called' : 'preOp';
    assert.equal(matches(patient({ [field]: null } as unknown as Partial<MedicalRecord>), { [filter]: 'no' }), false);
    assert.equal(matches(patient({ [field]: null } as unknown as Partial<MedicalRecord>), { [filter]: 'unknown' }), true);
    assert.equal(matches(patient({ [field]: 0 }), { [filter]: 'no' }), true);
    assert.equal(matches(patient({ [field]: true } as unknown as Partial<MedicalRecord>), { [filter]: 'yes' }), true);
  }
});

test('distance and undefined planning normalize case, accents, nulls and legacy values', () => {
  assert.equal(matches(patient(), { distance: 'loin' }), true);
  assert.equal(matches(patient({ distance: 'Non précisé' }), { distance: 'unknown' }), true);
  for (const planning_day of [undefined, '', 'A définir', 'À définir', 'Jour à définir']) {
    assert.equal(matches(patient({ planning_day }), { day: 'undefined' }), true);
  }
  assert.equal(matches(patient({ planning_day: 'Lundi' }), { day: 'undefined' }), false);
});

test('search includes second phone and address with normalized phone punctuation', () => {
  assert.equal(matches(patient(), { query: '032 98 765 43' }), true);
  assert.equal(matches(patient(), { query: 'ampitatafika' }), true);
  assert.equal(matches(patient(), { query: 'déclaré' }), true);
  assert.equal(matches(patient(), { query: 'inconnu' }), false);
});

test('photo filters read photo-labelled note links, not arbitrary Google Sheet links', () => {
  assert.equal(matches(patient({ observation: 'Photos (lien privé source) : https://drive.google.com/file/d/example/view' }), { photo: 'yes' }), true);
  assert.equal(matches(patient({ observation: 'Photos : https://docs.google.com/document/d/example/edit' }), { photo: 'yes' }), true);
  assert.equal(matches(patient({ observation: 'Source Google Sheets : https://docs.google.com/spreadsheets/d/example/edit' }), { photo: 'yes' }), false);
});

test('combined filters, missing fields, surgeon relations and sync are respected', () => {
  assert.equal(matches(patient({ pre_op_call: 0 }), { distance: 'loin', called: 'no', programmed: 'no' }), true);
  assert.equal(matches(patient({ pre_op_call: 1 }), { distance: 'loin', called: 'no' }), false);
  assert.equal(matches(patient({ phone1: '', phone2: '' }), { incomplete: 'phone' }), true);
  assert.equal(matches(patient({ phone1: '' }), { incomplete: 'phone' }), false);
  assert.equal(matches(patient(), { surgeon: '42' }, [42]), true);
  assert.equal(matches(patient(), { surgeon: 'none' }, [42]), false);
  assert.equal(matches(patient({ sync_status: 'pending_delete' }), { sync: 'pending' }), true);
});
