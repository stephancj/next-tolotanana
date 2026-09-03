import { NextResponse } from 'next/server';
import { db } from '@/lib/neon-db';
import { editions, surgeons, editionSurgeons } from '@/lib/schema';
import { eq, and } from 'drizzle-orm';

async function resolveEditionId(value: string) {
    const numeric = Number(value);
    if (Number.isInteger(numeric) && numeric > 0) return numeric;
    const row = await db.select({ id: editions.id }).from(editions)
        .where(eq(editions.public_id, value)).limit(1);
    return row[0]?.id;
}

async function resolveSurgeonId(body: { surgeon_id?: number; surgeon_public_id?: string }) {
    if (body.surgeon_public_id) {
        const row = await db.select({ id: surgeons.id }).from(surgeons)
            .where(eq(surgeons.public_id, body.surgeon_public_id)).limit(1);
        return row[0]?.id;
    }
    return body.surgeon_id;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const editionId = await resolveEditionId((await params).id);
        if (!editionId) return NextResponse.json({ error: 'Invalid Edition ID' }, { status: 400 });
        const linked = await db.select({
            id: surgeons.id, public_id: surgeons.public_id, name: surgeons.name,
            specialty: surgeons.specialty, email: surgeons.email, phone: surgeons.phone,
            is_active: surgeons.is_active
        }).from(editionSurgeons)
            .innerJoin(surgeons, eq(editionSurgeons.surgeon_id, surgeons.id))
            .where(eq(editionSurgeons.edition_id, editionId));
        return NextResponse.json(linked);
    } catch (error) {
        console.error(error); return NextResponse.json({ error: 'Failed to fetch edition surgeons' }, { status: 500 });
    }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const editionId = await resolveEditionId((await params).id);
        const surgeonId = await resolveSurgeonId(await request.json());
        if (!editionId || !surgeonId) return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
        await db.insert(editionSurgeons).values({ edition_id: editionId, surgeon_id: surgeonId }).onConflictDoNothing();
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error(error); return NextResponse.json({ error: 'Failed to link surgeon' }, { status: 500 });
    }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const editionId = await resolveEditionId((await params).id);
        const surgeonId = await resolveSurgeonId(await request.json());
        if (!editionId || !surgeonId) return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
        await db.delete(editionSurgeons).where(and(
            eq(editionSurgeons.edition_id, editionId), eq(editionSurgeons.surgeon_id, surgeonId)
        ));
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error(error); return NextResponse.json({ error: 'Failed to remove surgeon' }, { status: 500 });
    }
}
