import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
async function main() {
  if (!process.argv.includes('--confirm')) throw new Error('Run with --confirm after creating a backup');
  const sql = neon(process.env.DATABASE_URL!);
  const result = await sql.transaction(tx => [
    tx.query(`delete from sync_changes where changed_at < now() - interval '30 days' and id <= coalesce((select min(last_cursor) from sync_devices where last_seen_at > now() - interval '90 days'), 0) returning id`),
    tx.query(`delete from sync_mutations where processed_at < now() - interval '180 days' returning mutation_id`),
    tx.query(`delete from sync_devices where last_seen_at < now() - interval '365 days' returning device_id`)
  ]);
  console.log({ pruned_changes: result[0].length, pruned_mutations: result[1].length, pruned_devices: result[2].length, audit_entries_deleted: 0 });
}
main().catch(error => { console.error(error); process.exit(1); });
