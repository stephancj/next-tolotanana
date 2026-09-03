import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
import { createCipheriv, createHash, randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

async function main() {
  const secret = process.env.BACKUP_ENCRYPTION_KEY;
  if (!secret || secret.length < 16) throw new Error('BACKUP_ENCRYPTION_KEY (16+ characters) is required');
  const sql = neon(process.env.DATABASE_URL!);
  const tables = ['editions', 'surgeons', 'edition_surgeons', 'medical_records', 'record_surgeons', 'medical_audit_log', 'sync_changes', 'sync_mutations', 'sync_entity_versions', 'sync_devices'] as const;
  const data: Record<string, unknown[]> = {};
  for (const table of tables) data[table] = await sql.query(`select * from ${table}`);
  const payload = Buffer.from(JSON.stringify({ format: 1, created_at: new Date().toISOString(), tables: data }));
  const key = createHash('sha256').update(secret).digest(); const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv); const encrypted = Buffer.concat([cipher.update(payload), cipher.final()]);
  const envelope = { algorithm: 'aes-256-gcm', iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: encrypted.toString('base64') };
  await mkdir('backups', { recursive: true });
  const file = path.join('backups', `tolotanana-${new Date().toISOString().replaceAll(':', '-')}.json.enc`);
  await writeFile(file, JSON.stringify(envelope));
  console.log(`Encrypted backup written: ${file}`);
  console.log(Object.fromEntries(tables.map(table => [table, data[table].length])));
}
main().catch(error => { console.error(error); process.exit(1); });
