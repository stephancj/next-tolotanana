
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

// Force dynamic rendering (server-side only)
export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const db = getDb();
        const stmt = db.prepare('SELECT * FROM medical_records ORDER BY created_at DESC');
        const records = stmt.all();
        return NextResponse.json(records);
    } catch (error) {
        console.error('Error fetching records:', error);
        return NextResponse.json({ error: 'Failed to fetch records' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const {
            dossier_number,
            last_name, first_name, dob, age, gender,
            phone1, phone2, address,
            weight, height, bmi, blood_pressure, temperature, heart_rate, respiratory_rate, spo2,
            clinical_diagnosis, intervention_type, observation, program_mission,
            history_diabetes, history_hypertension, history_asthma, history_cardiopathy, history_none, history_others, asa_score,
            anesthesia_type, anesthesia_observation
        } = body;

        // Explicitly convert boolean-like inputs to 0 or 1 for SQLite
        const toInt = (val: unknown) => (val ? 1 : 0);

        const db = getDb();
        const stmt = db.prepare(`
      INSERT INTO medical_records (
        dossier_number,
        last_name, first_name, dob, age, gender,
        phone1, phone2, address,
        weight, height, bmi, blood_pressure, temperature, heart_rate, respiratory_rate, spo2,
        clinical_diagnosis, intervention_type, observation, program_mission,
        history_diabetes, history_hypertension, history_asthma, history_cardiopathy, history_none, history_others, asa_score,
        anesthesia_type, anesthesia_observation
      ) VALUES (
        @dossier_number,
        @last_name, @first_name, @dob, @age, @gender,
        @phone1, @phone2, @address,
        @weight, @height, @bmi, @blood_pressure, @temperature, @heart_rate, @respiratory_rate, @spo2,
        @clinical_diagnosis, @intervention_type, @observation, @program_mission,
        @history_diabetes, @history_hypertension, @history_asthma, @history_cardiopathy, @history_none, @history_others, @asa_score,
        @anesthesia_type, @anesthesia_observation
      )
    `);

        const info = stmt.run({
            dossier_number: dossier_number || '',
            last_name, first_name, dob, age, gender,
            phone1: phone1 || '', phone2: phone2 || '', address: address || '',
            weight: parseFloat(weight) || 0,
            height: parseFloat(height) || 0,
            bmi: parseFloat(bmi) || 0,
            blood_pressure: blood_pressure || '',
            temperature: parseFloat(temperature) || 0,
            heart_rate: parseInt(heart_rate) || 0,
            respiratory_rate: parseInt(respiratory_rate) || 0,
            spo2: parseInt(spo2) || 0,
            clinical_diagnosis: clinical_diagnosis || '',
            intervention_type: intervention_type || '',
            observation: observation || '',
            program_mission: toInt(program_mission),
            history_diabetes: toInt(history_diabetes),
            history_hypertension: toInt(history_hypertension),
            history_asthma: toInt(history_asthma),
            history_cardiopathy: toInt(history_cardiopathy),
            history_none: toInt(history_none),
            history_others: history_others || '',
            asa_score: parseInt(asa_score) || 0,
            anesthesia_type: anesthesia_type || '',
            anesthesia_observation: anesthesia_observation || ''
        });

        return NextResponse.json({ id: info.lastInsertRowid, success: true });
    } catch (error) {
        console.error('Error creating record:', error);
        return NextResponse.json({ error: 'Failed to create record' }, { status: 500 });
    }
}
