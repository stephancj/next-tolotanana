import { NextResponse } from 'next/server';
import { db } from '@/lib/neon-db';
import { editions, surgeons, editionSurgeons, syncEntityVersions, syncMutations } from '@/lib/schema';
import { and, eq, inArray } from 'drizzle-orm';
import { validUuid } from '@/lib/medical-audit';

const ENTITY = 'edition_surgeons';
export async function POST(request: Request) {
    try {
        const { updates } = await request.json();
        const processed: Array<{ public_id: string; mutation_id: string; revision: number }> = [];
        const conflicts: Array<{ public_id: string; mutation_id: string; revision: number; server: string[] }> = [];
        for (const update of Array.isArray(updates) ? updates.slice(0, 100) : []) {
            const mutationId = validUuid(update.mutation_id); const publicId = validUuid(update.edition_public_id);
            if (!mutationId || !publicId) continue;
            const result = await db.transaction(async tx => {
                const receipt = await tx.select().from(syncMutations).where(eq(syncMutations.mutation_id, mutationId)).limit(1);
                if (receipt.length) return { ok: true as const, revision: receipt[0].revision };
                const edition = await tx.select({ id: editions.id }).from(editions).where(eq(editions.public_id, publicId)).limit(1);
                if (!edition.length) throw new Error('Edition not found');
                const version = await tx.select().from(syncEntityVersions).where(and(eq(syncEntityVersions.entity, ENTITY), eq(syncEntityVersions.public_id, publicId))).limit(1);
                const revision = version[0]?.revision || 0;
                const existing = await tx.select({ public_id: surgeons.public_id }).from(editionSurgeons)
                    .innerJoin(surgeons, eq(editionSurgeons.surgeon_id, surgeons.id)).where(eq(editionSurgeons.edition_id, edition[0].id));
                if (Number(update.revision || 0) !== revision) return { ok: false as const, revision, server: existing.map(x => x.public_id) };
                const publicIds: string[] = Array.isArray(update.surgeon_public_ids) ? update.surgeon_public_ids : [];
                const rows = publicIds.length ? await tx.select({ id: surgeons.id }).from(surgeons).where(inArray(surgeons.public_id, publicIds)) : [];
                await tx.delete(editionSurgeons).where(eq(editionSurgeons.edition_id, edition[0].id));
                if (rows.length) await tx.insert(editionSurgeons).values(rows.map(x => ({ edition_id: edition[0].id, surgeon_id: x.id })));
                const next = revision + 1;
                await tx.insert(syncEntityVersions).values({ entity: ENTITY, public_id: publicId, revision: next })
                    .onConflictDoUpdate({ target: [syncEntityVersions.entity, syncEntityVersions.public_id], set: { revision: next, updated_at: new Date() } });
                await tx.insert(syncMutations).values({ mutation_id: mutationId, entity: ENTITY, public_id: publicId, revision: next });
                return { ok: true as const, revision: next };
            });
            if (result.ok) processed.push({ public_id: publicId, mutation_id: mutationId, revision: result.revision });
            else conflicts.push({ public_id: publicId, mutation_id: mutationId, revision: result.revision, server: result.server });
        }
        return NextResponse.json({ processed, conflicts });
    } catch (error) { console.error(error); return NextResponse.json({ error: 'Edition relation sync failed' }, { status: 500 }); }
}

export async function GET() {
    const editionRows = await db.select({ id: editions.id, public_id: editions.public_id }).from(editions);
    const links = await db.select({ edition_id: editionSurgeons.edition_id, surgeon_public_id: surgeons.public_id })
        .from(editionSurgeons).innerJoin(surgeons, eq(editionSurgeons.surgeon_id, surgeons.id));
    const versions = await db.select().from(syncEntityVersions).where(eq(syncEntityVersions.entity, ENTITY));
    return NextResponse.json(editionRows.map(e => ({
        edition_public_id: e.public_id,
        surgeon_public_ids: links.filter(x => x.edition_id === e.id).map(x => x.surgeon_public_id),
        revision: versions.find(x => x.public_id === e.public_id)?.revision || 0
    })));
}
