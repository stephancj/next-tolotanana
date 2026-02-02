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
    editions!: Table<Edition>;
    medical_records!: Table<MedicalRecord>;

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
        }).upgrade(async tx => {
            // Create default edition with a STATIC UUID to prevent duplicates across devices
            const defaultEdition: Edition = {
                public_id: 'f5cb4171-b3a2-4bb5-8d27-844f01b4a515', // Fixed UUID for Morondava 2026
                name: 'Mission Morondava 2026',
                place: 'Morondava',
                year: 2026,
                start_date: '2026-01-01',
                end_date: '2026-12-31',
                description: 'Mission médicale annuelle à Morondava',
                is_active: 1,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                deleted: 0,
                sync_status: 'pending_update'
            };

            const editionId = await tx.table('editions').add(defaultEdition);

            // Assign all existing medical records to the default edition
            return tx.table('medical_records').toCollection().modify(record => {
                if (!record.edition_id) {
                    record.edition_id = editionId as number;
                }
            });
        });
    }
}

export const db = new TolotananaDB();
