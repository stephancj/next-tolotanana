import Dexie, { Table } from 'dexie';

export interface MedicalRecord {
    id?: number;
    dossier_number: string;
    last_name: string;
    first_name: string;
    dob: string;
    age: number;
    gender: string;
    phone1: string;
    phone2: string;
    address: string;
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
    sync_status?: 'synced' | 'pending_update' | 'pending_delete';
}

export class TolotananaDB extends Dexie {
    medical_records!: Table<MedicalRecord>;

    constructor() {
        super('tolotananaDB');
        this.version(2).stores({
            medical_records: '++id, public_id, dossier_number, last_name, created_at, sync_status, deleted'
        }).upgrade(tx => {
            // Migration to version 2: Add default values for existing records
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
    }
}

export const db = new TolotananaDB();
