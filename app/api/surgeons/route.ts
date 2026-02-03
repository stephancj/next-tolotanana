
import { NextResponse } from 'next/server';
import { db } from '@/lib/neon-db';
import { surgeons } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const isActive = searchParams.get('is_active');

        let query = db.select().from(surgeons);

        if (isActive) {
            query.where(eq(surgeons.is_active, 1));
        }

        const allSurgeons = await query;
        return NextResponse.json(allSurgeons);
    } catch (error) {
        console.error('Error fetching surgeons:', error);
        return NextResponse.json({ error: 'Failed to fetch surgeons' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();

        let { name, specialty, email, phone, public_id, is_active } = body;

        // Ensure public_id is generated
        if (!public_id) {
            public_id = uuidv4();
        }

        const newSurgeon = await db.insert(surgeons).values({
            public_id,
            name: name || 'N/A',
            specialty: specialty || null,
            email: email || null,
            phone: phone || null,
            is_active: is_active ?? 1
        }).returning();

        return NextResponse.json(newSurgeon[0]);
    } catch (error) {
        console.error('Error creating surgeon:', error);
        return NextResponse.json({ error: 'Failed to create surgeon' }, { status: 500 });
    }
}
