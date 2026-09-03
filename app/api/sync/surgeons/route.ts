import { NextResponse } from 'next/server';
import { db } from '@/lib/neon-db';
import { surgeons, syncMutations } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { validUuid } from '@/lib/medical-audit';

export async function POST(request: Request) {
    try {
        const { changes } = await request.json();
        if (!Array.isArray(changes)) return NextResponse.json({ processed: [], conflicts: [], errors: [] });
        const processed: Array<{ public_id: string; mutation_id: string; revision: number }> = [];
        const conflicts: Array<{ public_id: string; mutation_id: string; server: unknown }> = [];
        const errors: Array<{ id: string; error: string }> = [];
        for (const change of changes.slice(0, 100)) {
            try {
                const mutationId = validUuid(change.mutation_id);
                const publicId = validUuid(change.public_id);
                if (!mutationId || !publicId) throw new Error('Invalid IDs');
                const result = await db.transaction(async tx => {
                    const receipt = await tx.select().from(syncMutations).where(eq(syncMutations.mutation_id, mutationId)).limit(1);
                    if (receipt.length) return { kind: 'ok' as const, revision: receipt[0].revision };
                    const current = await tx.select().from(surgeons).where(eq(surgeons.public_id, publicId)).limit(1);
                    const revision = current[0]?.revision || 0;
                    if (current.length && Number(change.revision || 0) !== revision) return { kind: 'conflict' as const, server: current[0] };
                    const nextRevision = revision + 1;
                    const value = {
                        public_id: publicId, name: String(change.name || 'N/A'),
                        specialty: change.specialty || null, email: change.email || null, phone: change.phone || null,
                        is_active: change.is_active ? 1 : 0, deleted: Boolean(change.deleted),
                        created_at: change.created_at ? new Date(change.created_at) : new Date(),
                        updated_at: new Date(), revision: nextRevision
                    };
                    await tx.insert(surgeons).values(value).onConflictDoUpdate({ target: surgeons.public_id, set: value });
                    await tx.insert(syncMutations).values({ mutation_id: mutationId, entity: 'surgeon', public_id: publicId, revision: nextRevision });
                    return { kind: 'ok' as const, revision: nextRevision };
                });
                if (result.kind === 'conflict') conflicts.push({ public_id: publicId, mutation_id: mutationId, server: result.server });
                else processed.push({ public_id: publicId, mutation_id: mutationId, revision: result.revision });
            } catch (error) { errors.push({ id: change.public_id || 'unknown', error: String(error) }); }
        }
        return NextResponse.json({ processed, conflicts, errors });
    } catch (error) {
        console.error(error); return NextResponse.json({ error: 'Surgeon sync failed' }, { status: 500 });
    }
}
