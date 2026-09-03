const IGNORED_FIELDS = new Set(['id', 'updated_at', 'revision']);

export type AuditAction = 'create' | 'update' | 'delete' | 'restore' | 'relation_update';

function plain(value: unknown): unknown {
    if (value === undefined) return null;
    return JSON.parse(JSON.stringify(value));
}

export function changedFields(
    before: Record<string, unknown> | null,
    after: Record<string, unknown>
): Record<string, { before: unknown; after: unknown }> {
    const result: Record<string, { before: unknown; after: unknown }> = {};
    const keys = new Set([...Object.keys(before || {}), ...Object.keys(after)]);
    for (const key of keys) {
        if (IGNORED_FIELDS.has(key)) continue;
        const oldValue = plain(before?.[key]);
        const newValue = plain(after[key]);
        if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
            result[key] = { before: oldValue, after: newValue };
        }
    }
    return result;
}

export function auditAction(
    before: Record<string, unknown> | null,
    after: Record<string, unknown>
): AuditAction {
    if (!before) return 'create';
    if (!before.deleted && Boolean(after.deleted)) return 'delete';
    if (Boolean(before.deleted) && !after.deleted) return 'restore';
    return 'update';
}

export function validUuid(value: unknown): string | null {
    return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
        ? value : null;
}

export function auditSnapshot(value: unknown): Record<string, unknown> | null {
    if (!value) return null;
    return plain(value) as Record<string, unknown>;
}
