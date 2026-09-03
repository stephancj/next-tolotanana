import { pgTable, text, integer, real, boolean, timestamp, serial, uuid, primaryKey, jsonb, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const editions = pgTable('editions', {
    id: serial('id').primaryKey(),
    public_id: uuid('public_id').notNull().unique(),
    name: text('name').notNull(),
    place: text('place').notNull(),
    year: integer('year').notNull(),
    start_date: text('start_date'),
    end_date: text('end_date'),
    description: text('description'),
    is_active: integer('is_active').default(1),
    registration_open: boolean('registration_open').notNull().default(false),
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
    deleted: boolean('deleted').default(false),
    revision: integer('revision').notNull().default(1)
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

    // Operation Day Workflow (Step 2, 5, 7, 8)
    pre_op_call: integer('pre_op_call').default(0),
    pre_op_call_at: timestamp('pre_op_call_at'),
    prescription_details: text('prescription_details'),
    pharmacy_status: text('pharmacy_status'),
    post_op_room: text('post_op_room'),
    post_op_bed: text('post_op_bed'),
    post_op_entry_time: text('post_op_entry_time'),
    discharge_time: text('discharge_time'),
    discharge_notes: text('discharge_notes'),

    // Sync Metadata
    created_at: timestamp('created_at').defaultNow(),
    updated_at: timestamp('updated_at').defaultNow(),
    deleted: boolean('deleted').default(false),
    revision: integer('revision').notNull().default(1)
});

// Durable idempotency receipts: retrying a mutation cannot apply it twice.
export const syncEntityVersions = pgTable('sync_entity_versions', {
    entity: text('entity').notNull(),
    public_id: uuid('public_id').notNull(),
    revision: integer('revision').notNull().default(0),
    updated_at: timestamp('updated_at').defaultNow().notNull()
}, (t) => [primaryKey({ columns: [t.entity, t.public_id] })]);

export const syncDevices = pgTable('sync_devices', {
    device_id: uuid('device_id').primaryKey(),
    last_cursor: integer('last_cursor').notNull().default(0),
    last_seen_at: timestamp('last_seen_at').defaultNow().notNull(),
    last_error: text('last_error'),
    app_version: text('app_version')
});

export const syncMutations = pgTable('sync_mutations', {
    mutation_id: uuid('mutation_id').primaryKey(),
    entity: text('entity').notNull(),
    public_id: uuid('public_id').notNull(),
    revision: integer('revision').notNull(),
    processed_at: timestamp('processed_at').defaultNow().notNull()
});

// Monotonic pull cursor. Payload keeps a stable snapshot for deterministic pulls.
export const syncChanges = pgTable('sync_changes', {
    id: serial('id').primaryKey(),
    entity: text('entity').notNull(),
    public_id: uuid('public_id').notNull(),
    revision: integer('revision').notNull(),
    payload: jsonb('payload').notNull(),
    changed_at: timestamp('changed_at').defaultNow().notNull()
});

// Append-only medical audit trail. Application routes only INSERT into this table.
export const medicalAuditLog = pgTable('medical_audit_log', {
    id: serial('id').primaryKey(),
    medical_record_public_id: uuid('medical_record_public_id').notNull(),
    mutation_id: uuid('mutation_id'),
    action: text('action').notNull(), // create, update, delete, restore, relation_update
    source: text('source').notNull(), // sync, api
    device_id: uuid('device_id'),
    user_id: text('user_id'), // ready for authentication later
    changed_fields: jsonb('changed_fields').notNull(),
    before_data: jsonb('before_data'),
    after_data: jsonb('after_data'),
    occurred_at: timestamp('occurred_at'), // client action time; created_at is authoritative receipt time
    created_at: timestamp('created_at').defaultNow().notNull()
}, (t) => [
    index('medical_audit_record_id_idx').on(t.medical_record_public_id, t.id),
    index('medical_audit_mutation_idx').on(t.mutation_id)
]);

export const volunteerRegistrations = pgTable('volunteer_registrations', {
    id: serial('id').primaryKey(),
    public_id: uuid('public_id').notNull().unique(),
    edition_id: integer('edition_id').notNull().references(() => editions.id),
    first_name: text('first_name').notNull(),
    last_name: text('last_name').notNull(),
    email: text('email').notNull(),
    phone: text('phone').notNull(),
    organization_type: text('organization_type').notNull().default('rotaract'),
    club_name: text('club_name').notNull(),
    club_status: text('club_status').notNull().default('membre'),
    city: text('city'),
    preferred_roles: text('preferred_roles').array().notNull(),
    availability: text('availability').notNull(),
    available_full_mission: boolean('available_full_mission').notNull().default(false),
    available_dates: jsonb('available_dates').notNull().default([]),
    has_previous_experience: boolean('has_previous_experience').notNull().default(false),
    previous_editions: jsonb('previous_editions').notNull().default([]),
    engagement_experience: text('engagement_experience'),
    skills: text('skills').array().notNull().default([]),
    other_skills: text('other_skills'),
    preferred_commissions: text('preferred_commissions').array().notNull().default([]),
    motivation: text('motivation'),
    contribution: text('contribution'),
    tshirt_size: text('tshirt_size'),
    dietary_preference: text('dietary_preference'),
    dietary_details: text('dietary_details'),
    allergies: text('allergies'),
    emergency_contact_name: text('emergency_contact_name'),
    emergency_contact_phone: text('emergency_contact_phone'),
    assigned_commission: text('assigned_commission'),
    status: text('status').notNull().default('pending'),
    consent: boolean('consent').notNull().default(false),
    created_at: timestamp('created_at').defaultNow().notNull(),
    updated_at: timestamp('updated_at').defaultNow().notNull()
}, (t) => [
    index('volunteer_registration_edition_idx').on(t.edition_id),
    index('volunteer_registration_email_idx').on(t.email)
]);

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
    volunteerRegistrations: many(volunteerRegistrations),
}));

export const volunteerRegistrationsRelations = relations(volunteerRegistrations, ({ one }) => ({
    edition: one(editions, {
        fields: [volunteerRegistrations.edition_id],
        references: [editions.id],
    }),
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
