
import { NextResponse } from 'next/server';
import { db } from '@/lib/neon-db';
import { editions } from '@/lib/schema';
import { desc, eq } from 'drizzle-orm';

// Force dynamic rendering (server-side only)
export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        // Récupérer uniquement les éditions actives et non supprimées
        const records = await db.select()
            .from(editions)
            .where(eq(editions.deleted, false))
            .orderBy(desc(editions.year));

        return NextResponse.json(records);
    } catch (error) {
        console.error('Error fetching editions:', error);
        return NextResponse.json({ error: 'Failed to fetch editions' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { editions: incomingEditions } = body;

        if (!incomingEditions || !Array.isArray(incomingEditions) || incomingEditions.length === 0) {
            return NextResponse.json({ success: true, processed: [] });
        }

        const processed: string[] = [];
        const errors: any[] = [];

        for (const edition of incomingEditions) {
            try {
                if (!edition.public_id) {
                    errors.push({ error: 'Missing public_id', edition });
                    continue;
                }

                const cleanEdition = {
                    public_id: edition.public_id,
                    name: edition.name,
                    place: edition.place,
                    year: Number(edition.year),
                    start_date: edition.start_date,
                    end_date: edition.end_date,
                    description: edition.description,
                    is_active: edition.is_active ? 1 : 0,
                    deleted: Boolean(edition.deleted),
                    created_at: edition.created_at ? new Date(edition.created_at) : new Date(),
                    updated_at: new Date()
                };

                await db.insert(editions)
                    .values(cleanEdition)
                    .onConflictDoUpdate({
                        target: editions.public_id,
                        set: cleanEdition
                    });

                processed.push(edition.public_id);
            } catch (err) {
                console.error(`Error processing edition ${edition.public_id}:`, err);
                errors.push({ id: edition.public_id, error: String(err) });
            }
        }

        return NextResponse.json({ success: true, processed, errors });
    } catch (error) {
        console.error('Error syncing editions:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
