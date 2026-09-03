import { NextResponse } from 'next/server';
import { count, desc, eq } from 'drizzle-orm';
import { db } from '@/lib/neon-db';
import { editions, volunteerRegistrations } from '@/lib/schema';

export const dynamic = 'force-dynamic';

const configuredAdminKey = () => process.env.VOLUNTEER_ADMIN_KEY || (process.env.NODE_ENV === 'development' ? 'tolotagnana-dev' : '');
const isAdmin = (request: Request) => {
  const expected = configuredAdminKey();
  return Boolean(expected && request.headers.get('x-admin-key') === expected);
};

const authorize = (request: Request) => {
  if (!configuredAdminKey()) return NextResponse.json({ error: 'Configurez VOLUNTEER_ADMIN_KEY sur le serveur.' }, { status: 503 });
  if (!isAdmin(request)) return NextResponse.json({ error: 'Accès non autorisé.' }, { status: 401 });
  return null;
};

export async function GET(request: Request) {
  const denied = authorize(request);
  if (denied) return denied;

  const rows = await db.select({
    public_id: editions.public_id,
    name: editions.name,
    place: editions.place,
    year: editions.year,
    start_date: editions.start_date,
    end_date: editions.end_date,
    is_active: editions.is_active,
    registration_open: editions.registration_open,
    application_count: count(volunteerRegistrations.id),
  }).from(editions)
    .leftJoin(volunteerRegistrations, eq(volunteerRegistrations.edition_id, editions.id))
    .where(eq(editions.deleted, false))
    .groupBy(editions.id)
    .orderBy(desc(editions.year));

  return NextResponse.json(rows);
}

export async function PATCH(request: Request) {
  const denied = authorize(request);
  if (denied) return denied;

  const body = await request.json();
  if (typeof body.public_id !== 'string' || typeof body.registration_open !== 'boolean') {
    return NextResponse.json({ error: 'Mise à jour invalide.' }, { status: 400 });
  }

  const [updated] = await db.update(editions).set({
    registration_open: body.registration_open,
    updated_at: new Date(),
  }).where(eq(editions.public_id, body.public_id)).returning({
    public_id: editions.public_id,
    registration_open: editions.registration_open,
  });

  if (!updated) return NextResponse.json({ error: 'Édition introuvable.' }, { status: 404 });
  return NextResponse.json(updated);
}
