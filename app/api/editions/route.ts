
import { NextResponse } from 'next/server';
import { db } from '@/lib/neon-db';
import { editions } from '@/lib/schema';
import { and, desc, eq, sql } from 'drizzle-orm';

import { validateOperationDates } from '@/lib/operation-calendar';

// Force dynamic rendering (server-side only)
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const includeDeleted = new URL(request.url).searchParams.get('include_deleted') === '1';
        const base = db.select().from(editions).orderBy(desc(editions.year));
        const records = includeDeleted
            ? await base
            : await db.select().from(editions).where(eq(editions.deleted, false)).orderBy(desc(editions.year));

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
        const errors: Array<{ id?: string; error: string; edition?: unknown }> = [];

        for (const edition of incomingEditions) {
            try {
                if (!edition.public_id) {
                    errors.push({ error: 'Missing public_id', edition });
                    continue;
                }

                const registrationOpen = typeof edition.registration_open === 'boolean'
                    ? edition.registration_open
                    : undefined;
                if (edition.planning_mode !== undefined && !['dates', 'legacy_weekdays'].includes(edition.planning_mode)) throw new Error('Mode de planning invalide');
                const calendar = {
                    ...(edition.planning_mode === undefined ? {} : { planning_mode: edition.planning_mode }),
                    ...(edition.operation_dates === undefined ? {} : { operation_dates: validateOperationDates(edition.operation_dates, edition) }),
                };
                const cleanEdition = {
                    ...calendar,
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
                    .values({ ...cleanEdition, registration_open: registrationOpen ?? false })
                    .onConflictDoUpdate({
                        target: editions.public_id,
                        set: {
                            ...cleanEdition,
                            ...(registrationOpen === undefined ? {} : { registration_open: registrationOpen }),
                        }
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

// Only the operation calendar is changed; mission travel/screening dates remain separate.
export async function PATCH(req: Request) {
    const body = await req.json();
    const existing = (await db.select().from(editions).where(eq(editions.public_id, body.public_id)).limit(1))[0];
    if (!existing || existing.deleted) return NextResponse.json({ error: 'Édition introuvable.' }, { status: 404 });
    if (existing.planning_mode === 'legacy_weekdays') return NextResponse.json({ error: 'Le planning historique est conservé.' }, { status: 400 });
    let dates: string[];
    try { dates = validateOperationDates(body.operation_dates, existing); }
    catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Dates invalides.' }, { status: 400 }); }
    if (!body.updated_at || !Number.isFinite(new Date(body.updated_at).getTime())) return NextResponse.json({ error: 'Actualisez l’édition avant de modifier ses dates.' }, { status: 400 });
    const updated = await db.update(editions).set({ operation_dates: dates, planning_mode: 'dates', updated_at: new Date() })
        .where(and(eq(editions.public_id, existing.public_id), sql`date_trunc('milliseconds', ${editions.updated_at}) = ${new Date(body.updated_at).toISOString()}::timestamp`)).returning();
    if (!updated.length) return NextResponse.json({ error: 'Le calendrier a changé sur un autre appareil. Actualisez puis réessayez.' }, { status: 409 });
    return NextResponse.json(updated[0]);
}
