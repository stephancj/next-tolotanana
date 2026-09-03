import { NextResponse } from 'next/server';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/lib/neon-db';
import { editions } from '@/lib/schema';
import { publicCorsHeaders } from '@/lib/public-cors';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const rows = await db.select({
            public_id: editions.public_id,
            name: editions.name,
            place: editions.place,
            year: editions.year,
            start_date: editions.start_date,
            end_date: editions.end_date,
        }).from(editions)
            .where(and(
                eq(editions.deleted, false),
                eq(editions.is_active, 1),
                eq(editions.registration_open, true),
            ))
            .orderBy(desc(editions.year));

        return NextResponse.json(rows, {
            headers: {
                ...publicCorsHeaders(request),
                'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
            },
        });
    } catch (error) {
        console.error('Failed to load public editions', error);
        return NextResponse.json(
            { error: 'Impossible de charger les éditions.' },
            { status: 500, headers: publicCorsHeaders(request) },
        );
    }
}
