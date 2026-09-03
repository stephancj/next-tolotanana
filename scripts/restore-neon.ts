import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
import { createDecipheriv, createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

async function main() {
  const [file, confirmation] = process.argv.slice(2);
  if (!file || confirmation !== '--confirm') throw new Error('Usage: npm run db:restore -- <backup-file> --confirm');
  const secret = process.env.BACKUP_ENCRYPTION_KEY;
  if (!secret) throw new Error('BACKUP_ENCRYPTION_KEY is required');
  const envelope = JSON.parse(await readFile(file, 'utf8'));
  const decipher = createDecipheriv('aes-256-gcm', createHash('sha256').update(secret).digest(), Buffer.from(envelope.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));
  const backup = JSON.parse(Buffer.concat([decipher.update(Buffer.from(envelope.data, 'base64')), decipher.final()]).toString());
  const sql = neon(process.env.DATABASE_URL!);
  const order = ['editions', 'surgeons', 'edition_surgeons', 'medical_records', 'record_surgeons', 'sync_changes', 'sync_mutations', 'sync_entity_versions', 'sync_devices', 'medical_audit_log'];
  await sql.transaction(tx => [
    ...order.flatMap(table => {
      const rows = backup.tables[table] || [];
      if (!rows.length) return [];
      return [tx.query(`insert into ${table} select * from json_populate_recordset(null::${table}, $1::json) on conflict do nothing`, [JSON.stringify(rows)])];
    }),
    ...['editions', 'surgeons', 'medical_records', 'sync_changes', 'medical_audit_log'].map(table =>
      tx.query(`select setval(pg_get_serial_sequence('${table}', 'id'), greatest(coalesce((select max(id) from ${table}), 1), 1), true)`)
    )
  ]);
  console.log(`Restore completed from ${file}. Existing rows were not overwritten.`);
}
main().catch(error => { console.error(error); process.exit(1); });
