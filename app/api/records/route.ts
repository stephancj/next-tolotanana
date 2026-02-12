
import { NextResponse } from 'next/server';
import { db } from '@/lib/neon-db';
import { medicalRecords } from '@/lib/schema';
import { desc, eq, inArray } from 'drizzle-orm';

export async function GET() {
    try {
        const records = await db.select().from(medicalRecords).orderBy(desc(medicalRecords.created_at));
        return NextResponse.json(records);
    } catch (error) {
        console.error('Error fetching records:', error);
        return NextResponse.json({ error: 'Failed to fetch records' }, { status: 500 });
    }
}

export async function PATCH(req: Request) {
    try {
        const body = await req.json();
        const { id, ids, ...updates } = body;

        if (!id && (!ids || !Array.isArray(ids) || ids.length === 0)) {
            return NextResponse.json({ error: 'Record ID(s) required' }, { status: 400 });
        }

        // --- SANITIZAITON ---
        const sanitizedUpdates: Record<string, string | number | boolean | Date | null> = { ...updates };
        const dateFields = ['pre_op_call_at', 'pre_op_checked_at'];

        // 1. Sanitize Date Fields
        dateFields.forEach(field => {
            if (field in updates) {
                const val = updates[field];
                sanitizedUpdates[field] = val ? new Date(val) : null;
            }
        });

        // 2. Sanitize Booleans (just in case they come as numbers/strings)
        if ('pre_op_checked' in updates) {
            sanitizedUpdates.pre_op_checked = Boolean(updates.pre_op_checked);
        }

        // 3. Always update updated_at
        sanitizedUpdates.updated_at = new Date();

        let result;

        if (ids && Array.isArray(ids) && ids.length > 0) {
            // Bulk Update
            result = await db.update(medicalRecords)
                .set(sanitizedUpdates)
                .where(inArray(medicalRecords.id, ids))
                .returning();
        } else {
            // Single Update
            result = await db.update(medicalRecords)
                .set(sanitizedUpdates)
                .where(eq(medicalRecords.id, id))
                .returning();
        }

        return NextResponse.json({ success: true, count: result.length, records: result });

    } catch (error) {
        console.error('Error updating record:', error);
        return NextResponse.json({ error: 'Failed to update record' }, { status: 500 });
    }
}
