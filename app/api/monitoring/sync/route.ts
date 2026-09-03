import { NextResponse } from 'next/server';
import { db } from '@/lib/neon-db';
import { medicalAuditLog, syncChanges, syncDevices, syncMutations } from '@/lib/schema';
import { desc, eq, sql } from 'drizzle-orm';
import { validUuid } from '@/lib/medical-audit';

export const dynamic = 'force-dynamic';
export async function GET() {
    try {
        const [counts, devices] = await Promise.all([
            db.select({
                changes: sql<number>`count(distinct ${syncChanges.id})`,
                mutations: sql<number>`(select count(*) from ${syncMutations})`,
                audit_entries: sql<number>`(select count(*) from ${medicalAuditLog})`,
                latest_cursor: sql<number>`coalesce(max(${syncChanges.id}), 0)`
            }).from(syncChanges),
            db.select().from(syncDevices).orderBy(desc(syncDevices.last_seen_at)).limit(100)
        ]);
        const latest = Number(counts[0]?.latest_cursor || 0);
        return NextResponse.json({
            ...counts[0], devices: devices.map(device => ({
                ...device, lag: Math.max(0, latest - device.last_cursor),
                stale: Date.now() - new Date(device.last_seen_at).getTime() > 7 * 86400000
            }))
        });
    } catch (error) { console.error(error); return NextResponse.json({ error: 'Monitoring unavailable' }, { status: 500 }); }
}

export async function POST(request: Request) {
    try {
        const body = await request.json(); const deviceId = validUuid(body.device_id);
        if (!deviceId) return NextResponse.json({ error: 'Invalid device' }, { status: 400 });
        await db.update(syncDevices).set({
            last_seen_at: new Date(), last_error: typeof body.error === 'string' ? body.error.slice(0, 500) : null
        }).where(eq(syncDevices.device_id, deviceId));
        return NextResponse.json({ success: true });
    } catch { return NextResponse.json({ error: 'Monitoring update failed' }, { status: 500 }); }
}
