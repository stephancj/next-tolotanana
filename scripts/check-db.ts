
import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';

dotenv.config();

const sql = neon(process.env.DATABASE_URL!);

async function check() {
    console.log("Checking medical_records columns...");
    const cols = await sql`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'medical_records';
    `;
    console.log("medical_records columns:", cols.map(c => c.column_name).sort());

    console.log("Checking surgeons columns...");
    const sCols = await sql`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'surgeons';
    `;
    console.log("surgeons columns:", sCols.map(c => c.column_name).sort());

    console.log("Checking tables...");
    const tables = await sql`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public';
    `;
    console.log("Tables:", tables.map(t => t.table_name).sort());
}

check();
