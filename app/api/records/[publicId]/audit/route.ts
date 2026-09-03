import { NextResponse } from 'next/server';
import { db } from '@/lib/neon-db';
import { medicalAuditLog } from '@/lib/schema';
import { and, desc, eq, lt } from 'drizzle-orm';
import { validUuid } from '@/lib/medical-audit';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: Promise<{ publicId: string }> }) {
    try {
        const publicId = validUuid((await params).publicId);
        if (!publicId) return NextResponse.json({ error: 'Invalid public ID' }, { status: 400 });
        const search = new URL(request.url).searchParams;
        const beforeId = Number(search.get('before_id') || 0);
        const requestedLimit = Number(search.get('limit') || 50);
        const limit = Math.min(100, Math.max(1, requestedLimit));
        const condition = beforeId > 0
            ? and(eq(medicalAuditLog.medical_record_public_id, publicId), lt(medicalAuditLog.id, beforeId))
            : eq(medicalAuditLog.medical_record_public_id, publicId);
        const entries = await db.select().from(medicalAuditLog)
            .where(condition).orderBy(desc(medicalAuditLog.id)).limit(limit);
        return NextResponse.json({
            entries,
            next_before_id: entries.length === limit ? entries[entries.length - 1].id : null
        });
    } catch (error) {
        console.error('Audit history error:', error);
        return NextResponse.json({ error: 'Failed to fetch audit history' }, { status: 500 });
    }
}
