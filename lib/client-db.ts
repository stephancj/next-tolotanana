import Dexie, { Table } from 'dexie';

export interface Edition {
    id?: number;
    public_id: string;
    name: string;
    place: string;
    year: number;
    start_date?: string;
    end_date?: string;
    description?: string;
    is_active: number;
    created_at: string;
    updated_at: string;
    deleted: number;
    sync_status?: 'synced' | 'pending_update' | 'pending_delete';
}

export interface MedicalRecord {
    id?: number;
    edition_id?: number; // Foreign key to editions
    dossier_number: string;
    last_name: string;
    first_name: string;
    dob: string;
    age: string;
    gender: string;
    phone1: string;
    phone2: string;
    address: string;
    distance: string;
    weight: number;
    height: number;
    bmi: number;
    blood_pressure: string;
    temperature: number;
    heart_rate: number;
    respiratory_rate: number;
    spo2: number;
    clinical_diagnosis: string;
    intervention_type: string;
    observation: string;
    program_mission: number;
    planning_day?: string; // 'Lundi', 'Mardi', etc.

    // Pre-Op Check
    pre_op_checked?: number; // 0 or 1
    pre_op_checked_at?: string;

    // Operation Details
    block_entry_time?: string;
    block_exit_time?: string;
    intervention_details?: string;
    diagnosis_category?: string;

    // Pre-Op Call (Step 2)
    pre_op_call?: number; // 0 or 1
    pre_op_call_at?: string;

    // Prescription & Pharmacy (Step 5)
    prescription_details?: string;
    pharmacy_status?: 'pending' | 'retrieved' | 'none';

    // Post-Op (Step 7)
    post_op_room?: string;
    post_op_bed?: string;
    post_op_entry_time?: string;

    // Discharge (Step 8)
    discharge_time?: string;
    discharge_notes?: string;

    // History (stored as boolean/number 0 or 1)
    history_diabetes: number;
    history_hypertension: number;
    history_asthma: number;
    history_cardiopathy: number;
    history_none: number;
    history_others: string;
    asa_score: number;
    anesthesia_type: string;
    anesthesia_observation: string;
    photo_url: string;

    created_at: string;

    // Sync Metadata
    public_id?: string; // UUID for sync
    updated_at?: string;
    deleted?: number; // 0 or 1 (Soft delete)
    sync_status?: 'synced' | 'pending_update' | 'pending_delete' | 'conflict';
    revision?: number; // Last server revision applied locally
    pending_mutation_id?: string; // Stable idempotency key for the current local change
    sync_error?: string;
}

export interface Surgeon {
    id?: number;
    public_id: string;
    name: string;
    specialty?: string;
    email?: string;
    phone?: string;
    is_active: number;
    created_at: string;
    updated_at: string;
    deleted: number;
    sync_status?: 'synced' | 'pending_update' | 'pending_delete' | 'conflict';
    revision?: number;
    pending_mutation_id?: string;
    sync_error?: string;
}

export interface EditionSurgeon {
    edition_id: number;
    surgeon_id: number;
}

export interface RecordSurgeon {
    id?: number;
    medical_record_id: number;
    surgeon_id: number;
    role?: string;
    sync_status?: 'synced' | 'pending_update' | 'pending_delete';
}

export interface SyncMeta {
    key: string;
    value: string;
}

export interface SyncConflict {
    id?: number;
    entity: string;
    public_id: string;
    local_data: unknown;
    server_data: unknown;
    created_at: string;
}

export interface RelationChange {
    record_public_id: string;
    surgeon_public_ids: string[];
    mutation_id: string;
    revision: number;
    updated_at: string;
}

export interface EditionRelationChange {
    edition_public_id: string;
    surgeon_public_ids: string[];
    mutation_id: string;
    revision: number;
    updated_at: string;
}

export class TolotananaDB extends Dexie {
    editions!: Table<Edition>;
    medical_records!: Table<MedicalRecord>;
    surgeons!: Table<Surgeon>;
    edition_surgeons!: Table<EditionSurgeon>;
    record_surgeons!: Table<RecordSurgeon>;
    sync_meta!: Table<SyncMeta>;
    sync_conflicts!: Table<SyncConflict>;
    relation_changes!: Table<RelationChange>;
    edition_relation_changes!: Table<EditionRelationChange>;

    constructor() {
        super('tolotananaDB');

        // Version 2: Initial schema with sync support
        this.version(2).stores({
            medical_records: '++id, public_id, dossier_number, last_name, created_at, sync_status, deleted'
        }).upgrade(tx => {
            return tx.table('medical_records').toCollection().modify(record => {
                if (!record.public_id) {
                    record.public_id = crypto.randomUUID();
                }
                if (!record.sync_status) {
                    record.sync_status = 'pending_update';
                }
                if (record.deleted === undefined) {
                    record.deleted = 0;
                }
                if (!record.updated_at) {
                    record.updated_at = new Date().toISOString();
                }
            });
        });

        // Version 3: Add editions table and edition_id to medical_records
        this.version(3).stores({
            editions: '++id, public_id, place, year, is_active, sync_status, deleted',
            medical_records: '++id, public_id, edition_id, dossier_number, last_name, created_at, sync_status, deleted'
        }).upgrade(async () => {
            // Version 3: Just creating the table, no default data.
            // Editions will be synced from server.
        });

        // Version 4: Surgeons and Operation Details
        this.version(4).stores({
            surgeons: '++id, public_id, name, is_active, sync_status, deleted',
            edition_surgeons: '[edition_id+surgeon_id], edition_id, surgeon_id',
            record_surgeons: '++id, medical_record_id, surgeon_id, sync_status',
        });

        // Version 5: Full Operation Day Workflow
        this.version(5).stores({
            medical_records: '++id, public_id, edition_id, dossier_number, last_name, created_at, sync_status, deleted'
        }).upgrade(async () => {
            // No index changes needed for new text fields, but bumping version to ensure consistency
        });

        // Version 6: durable sync cursor, conflicts and relation outbox.
        this.version(6).stores({
            medical_records: '++id, &public_id, edition_id, dossier_number, last_name, created_at, sync_status, deleted, pending_mutation_id',
            sync_meta: '&key',
            sync_conflicts: '++id, [entity+public_id], entity, public_id, created_at',
            relation_changes: '&record_public_id, mutation_id, updated_at'
        }).upgrade(tx => tx.table('medical_records').toCollection().modify(record => {
            record.revision = record.revision || 0;
            if (record.sync_status !== 'synced' && !record.pending_mutation_id) {
                record.pending_mutation_id = crypto.randomUUID();
            }
        }));

        this.version(7).stores({
            surgeons: '++id, &public_id, name, is_active, sync_status, deleted, pending_mutation_id',
            relation_changes: '&record_public_id, mutation_id, updated_at',
            edition_relation_changes: '&edition_public_id, mutation_id, updated_at'
        }).upgrade(tx => tx.table('surgeons').toCollection().modify(surgeon => {
            surgeon.revision = surgeon.revision || 0;
        }));
    }
}

export const db = new TolotananaDB();
