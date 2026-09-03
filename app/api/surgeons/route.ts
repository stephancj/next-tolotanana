import { NextResponse } from 'next/server';
import { db } from '@/lib/neon-db';
import { surgeons } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

export async function GET(request: Request) {
    try {
        const activeOnly = new URL(request.url).searchParams.get('is_active');
        const rows = activeOnly
            ? await db.select().from(surgeons).where(eq(surgeons.is_active, 1))
            : await db.select().from(surgeons);
        return NextResponse.json(rows);
    } catch (error) {
        console.error(error); return NextResponse.json({ error: 'Failed to fetch surgeons' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const public_id = body.public_id || uuidv4();
        const [created] = await db.insert(surgeons).values({
            public_id, name: body.name || 'N/A', specialty: body.specialty || null,
            email: body.email || null, phone: body.phone || null, is_active: body.is_active ?? 1
        }).returning();
        return NextResponse.json(created);
    } catch (error) {
        console.error(error); return NextResponse.json({ error: 'Failed to create surgeon' }, { status: 500 });
    }
}
