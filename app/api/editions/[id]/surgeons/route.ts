
import { NextResponse } from 'next/server';
import { db } from '@/lib/neon-db';
import { surgeons, editionSurgeons } from '@/lib/schema';
import { eq, and } from 'drizzle-orm';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const editionId = parseInt(id);

        if (isNaN(editionId)) {
            return NextResponse.json({ error: 'Invalid Edition ID' }, { status: 400 });
        }

        // Fetch surgeons linked to this edition
        const linkedSurgeons = await db
            .select({
                id: surgeons.id,
                public_id: surgeons.public_id,
                name: surgeons.name,
                specialty: surgeons.specialty,
                email: surgeons.email,
                phone: surgeons.phone,
                is_active: surgeons.is_active,
            })
            .from(editionSurgeons)
            .innerJoin(surgeons, eq(editionSurgeons.surgeon_id, surgeons.id))
            .where(eq(editionSurgeons.edition_id, editionId));

        return NextResponse.json(linkedSurgeons);
    } catch (error) {
        console.error('Error fetching edition surgeons:', error);
        return NextResponse.json({ error: 'Failed to fetch edition surgeons' }, { status: 500 });
    }
}

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const editionId = parseInt(id);
        const { surgeon_id } = await request.json();

        if (isNaN(editionId) || !surgeon_id) {
            return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
        }

        // Link surgeon to edition
        // Ideally check if already exists to avoid unique constraint error, or use ON CONFLICT DO NOTHING
        // Drizzle specific: .onConflictDoNothing()

        await db.insert(editionSurgeons)
            .values({
                edition_id: editionId,
                surgeon_id: surgeon_id
            })
            .onConflictDoNothing();

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error linking surgeon to edition:', error);
        return NextResponse.json({ error: 'Failed to link surgeon' }, { status: 500 });
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const editionId = parseInt(id);
        const { surgeon_id } = await request.json();

        if (isNaN(editionId) || !surgeon_id) {
            return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
        }

        // Unlink surgeon from edition
        await db.delete(editionSurgeons)
            .where(
                and(
                    eq(editionSurgeons.edition_id, editionId),
                    eq(editionSurgeons.surgeon_id, surgeon_id)
                )
            );

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error removing surgeon from edition:', error);
        return NextResponse.json({ error: 'Failed to remove surgeon' }, { status: 500 });
    }
}
