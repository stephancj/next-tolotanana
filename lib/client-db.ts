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
}

export class TolotananaDB extends Dexie {
    medical_records!: Table<MedicalRecord>;

    constructor() {
        super('tolotananaDB');
        this.version(1).stores({
            medical_records: '++id, dossier_number, last_name, created_at'
        });
    }
}

export const db = new TolotananaDB();
