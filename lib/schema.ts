import { pgTable, text, integer, real, boolean, timestamp, serial, uuid } from 'drizzle-orm/pg-core';

export const medicalRecords = pgTable('medical_records', {
    id: serial('id').primaryKey(),
    public_id: uuid('public_id').notNull().unique(), // The Sync UUID

    dossier_number: text('dossier_number'),
    last_name: text('last_name'),
    first_name: text('first_name'),
    dob: text('dob'),
    age: text('age'),
    gender: text('gender'),
    phone1: text('phone1'),
    phone2: text('phone2'),
    address: text('address'),
    distance: text('distance').default('non précisé'),
    photo_url: text('photo_url'),

    // Medical Parameters
    weight: real('weight'),
    height: real('height'),
    bmi: real('bmi'),
    blood_pressure: text('blood_pressure'),
    temperature: real('temperature'),
    heart_rate: integer('heart_rate'),
    respiratory_rate: integer('respiratory_rate'),
    spo2: integer('spo2'),

    // Surgical Consultation
    clinical_diagnosis: text('clinical_diagnosis'),
    intervention_type: text('intervention_type'),
    observation: text('observation'),
    program_mission: integer('program_mission').default(0), // 0 or 1

    // Pre-anesthetic Consultation
    history_diabetes: integer('history_diabetes').default(0),
    history_hypertension: integer('history_hypertension').default(0),
    history_asthma: integer('history_asthma').default(0),
    history_cardiopathy: integer('history_cardiopathy').default(0),
    history_none: integer('history_none').default(0),
    history_others: text('history_others'),
    asa_score: integer('asa_score'),
    anesthesia_type: text('anesthesia_type'),
    anesthesia_observation: text('anesthesia_observation'),

    // Sync Metadata
    created_at: timestamp('created_at').defaultNow(),
    updated_at: timestamp('updated_at').defaultNow(),
    deleted: boolean('deleted').default(false)
});
