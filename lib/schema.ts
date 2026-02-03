import { pgTable, text, integer, real, boolean, timestamp, serial, uuid, primaryKey } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const editions = pgTable('editions', {
    id: serial('id').primaryKey(),
    public_id: uuid('public_id').notNull(),
    name: text('name').notNull(),
    place: text('place').notNull(),
    year: integer('year').notNull(),
    start_date: text('start_date'),
    end_date: text('end_date'),
    description: text('description'),
    is_active: integer('is_active').default(1),
    created_at: timestamp('created_at').defaultNow(),
    updated_at: timestamp('updated_at').defaultNow(),
    deleted: boolean('deleted').default(false)
});

export const surgeons = pgTable('surgeons', {
    id: serial('id').primaryKey(),
    public_id: uuid('public_id').notNull().unique(),
    name: text('name').notNull(),
    specialty: text('specialty'),
    email: text('email'),
    phone: text('phone'),
    is_active: integer('is_active').default(1),
    created_at: timestamp('created_at').defaultNow(),
    updated_at: timestamp('updated_at').defaultNow(),
    deleted: boolean('deleted').default(false)
});

export const editionSurgeons = pgTable('edition_surgeons', {
    edition_id: integer('edition_id').notNull().references(() => editions.id),
    surgeon_id: integer('surgeon_id').notNull().references(() => surgeons.id),
}, (t) => ({
    pk: primaryKey({ columns: [t.edition_id, t.surgeon_id] }),
}));

export const medicalRecords = pgTable('medical_records', {
    id: serial('id').primaryKey(),
    public_id: uuid('public_id').notNull().unique(), // The Sync UUID
    edition_id: integer('edition_id').references(() => editions.id),

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
    planning_day: text('planning_day'), // 'Lundi', 'Mardi', etc.

    // Pre-Op Check
    pre_op_checked: boolean('pre_op_checked').default(false),
    pre_op_checked_at: timestamp('pre_op_checked_at'),

    // Operation Details
    block_entry_time: text('block_entry_time'), // HH:mm
    block_exit_time: text('block_exit_time'), // HH:mm
    intervention_details: text('intervention_details'),
    diagnosis_category: text('diagnosis_category'),

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

export const recordSurgeons = pgTable('record_surgeons', {
    medical_record_id: integer('medical_record_id').notNull().references(() => medicalRecords.id),
    surgeon_id: integer('surgeon_id').notNull().references(() => surgeons.id),
    role: text('role'), // e.g., 'principal', 'assistant'
}, (t) => ({
    pk: primaryKey({ columns: [t.medical_record_id, t.surgeon_id] }),
}));

// Relations
export const editionsRelations = relations(editions, ({ many }) => ({
    medicalRecords: many(medicalRecords),
    surgeons: many(editionSurgeons),
}));

export const surgeonsRelations = relations(surgeons, ({ many }) => ({
    editions: many(editionSurgeons),
    records: many(recordSurgeons),
}));

export const editionSurgeonsRelations = relations(editionSurgeons, ({ one }) => ({
    edition: one(editions, {
        fields: [editionSurgeons.edition_id],
        references: [editions.id],
    }),
    surgeon: one(surgeons, {
        fields: [editionSurgeons.surgeon_id],
        references: [surgeons.id],
    }),
}));

export const medicalRecordsRelations = relations(medicalRecords, ({ one, many }) => ({
    edition: one(editions, {
        fields: [medicalRecords.edition_id],
        references: [editions.id],
    }),
    surgeons: many(recordSurgeons),
}));

export const recordSurgeonsRelations = relations(recordSurgeons, ({ one }) => ({
    record: one(medicalRecords, {
        fields: [recordSurgeons.medical_record_id],
        references: [medicalRecords.id],
    }),
    surgeon: one(surgeons, {
        fields: [recordSurgeons.surgeon_id],
        references: [surgeons.id],
    }),
}));
