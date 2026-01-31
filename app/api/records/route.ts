
import { NextResponse } from 'next/server';
import { db } from '@/lib/neon-db';
import { medicalRecords } from '@/lib/schema';
import { desc } from 'drizzle-orm';

// Force dynamic rendering (server-side only)
export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const records = await db.select().from(medicalRecords).orderBy(desc(medicalRecords.created_at));
        return NextResponse.json(records);
    } catch (error) {
        console.error('Error fetching records:', error);
        return NextResponse.json({ error: 'Failed to fetch records' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();

        // Ensure boolean fields are boolean
        const sanitizeBoolean = (val: any) => val === true || val === 1 || val === '1';

        const recordData = {
            ...body,
            program_mission: sanitizeBoolean(body.program_mission),
            history_diabetes: sanitizeBoolean(body.history_diabetes),
            history_hypertension: sanitizeBoolean(body.history_hypertension),
            history_asthma: sanitizeBoolean(body.history_asthma),
            history_cardiopathy: sanitizeBoolean(body.history_cardiopathy),
            history_none: sanitizeBoolean(body.history_none),
            // Ensure numeric fields are numbers
            weight: body.weight ? String(body.weight) : '',
            height: body.height ? String(body.height) : '',
            bmi: body.bmi ? String(body.bmi) : '',
            temperature: body.temperature ? String(body.temperature) : '',
            heart_rate: body.heart_rate ? String(body.heart_rate) : '',
            respiratory_rate: body.respiratory_rate ? String(body.respiratory_rate) : '',
            spo2: body.spo2 ? String(body.spo2) : '',
            asa_score: body.asa_score ? String(body.asa_score) : '',
            deleted: false,
            created_at: new Date(),
            updated_at: new Date()
        };

        const result = await db.insert(medicalRecords).values(recordData).returning();

        return NextResponse.json({ id: result[0].id, success: true });
    } catch (error) {
        console.error('Error creating record:', error);
        return NextResponse.json({ error: 'Failed to create record' }, { status: 500 });
    }
}
