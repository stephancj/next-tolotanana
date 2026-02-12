
import { NextResponse } from 'next/server';
import { db } from '@/lib/neon-db';
import { recordSurgeons } from '@/lib/schema';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { medical_record_id, surgeon_ids } = body;

        if (!medical_record_id || !Array.isArray(surgeon_ids)) {
            return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
        }

        // Transaction to replace surgeons
        // 1. Delete existing surgeons for this record
        await db.delete(recordSurgeons)
            .where(eq(recordSurgeons.medical_record_id, medical_record_id));

        // 2. Insert new surgeons
        if (surgeon_ids.length > 0) {
            const values = surgeon_ids.map((id: number) => ({
                medical_record_id,
                surgeon_id: id
            }));
            await db.insert(recordSurgeons).values(values);
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error assigning surgeons:', error);
        return NextResponse.json({ error: 'Failed to assign surgeons' }, { status: 500 });
    }
}
