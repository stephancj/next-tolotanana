
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
