import Database from 'better-sqlite3';
import path from 'path';

// Initialize the database file in the project root
// Singleton instance
let dbInstance: any = null;

// Define table schema
const initDb = (db: any) => {
    const createTableQuery = `
    CREATE TABLE IF NOT EXISTS medical_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dossier_number TEXT,
      last_name TEXT,
      first_name TEXT,
      dob TEXT,
      age INTEGER,
      gender TEXT, -- 'M' or 'F'
      phone1 TEXT,
      phone2 TEXT,
      address TEXT,
      photo_url TEXT,
      
      -- Medical Parameters
      weight REAL,
      height REAL,
      bmi REAL,
      blood_pressure TEXT,
      temperature REAL,
      heart_rate INTEGER,
      respiratory_rate INTEGER,
      spo2 INTEGER,
      
      -- Surgical Consultation
      clinical_diagnosis TEXT,
      intervention_type TEXT,
      observation TEXT,
      program_mission INTEGER DEFAULT 0, -- 0 (No) or 1 (Yes)
      
      -- Pre-anesthetic Consultation
      history_diabetes INTEGER DEFAULT 0,
      history_hypertension INTEGER DEFAULT 0,
      history_asthma INTEGER DEFAULT 0,
      history_cardiopathy INTEGER DEFAULT 0,
      history_none INTEGER DEFAULT 0,
      history_others TEXT,
      asa_score INTEGER,
      
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `;

    try {
        db.exec(createTableQuery);
        console.log('Database initialized successfully');
    } catch (err) {
        console.error('Error initializing database:', err);
    }
};

interface ColumnInfo {
    cid: number;
    name: string;
    type: string;
    notnull: number;
    dflt_value: string | null;
    pk: number;
}

const migrateDb = (db: any) => {
    try {
        const columns = db.pragma('table_info(medical_records)') as ColumnInfo[];
        const hasAnesthesiaType = columns.some(col => col.name === 'anesthesia_type');
        const hasAnesthesiaObservation = columns.some(col => col.name === 'anesthesia_observation');

        if (!hasAnesthesiaType) {
            db.exec('ALTER TABLE medical_records ADD COLUMN anesthesia_type TEXT');
            console.log('Added anesthesia_type column');
        }
        if (!hasAnesthesiaObservation) {
            db.exec('ALTER TABLE medical_records ADD COLUMN anesthesia_observation TEXT');
            console.log('Added anesthesia_observation column');
        }
    } catch (err) {
        console.error('Migration error:', err);
    }
};

export const getDb = () => {
    if (!dbInstance) {
        const dbPath = path.join(process.cwd(), 'tolotanana.db');
        dbInstance = new Database(dbPath, { verbose: console.log });
        dbInstance.pragma('journal_mode = WAL');

        // Initialize and migrate on first connection
        initDb(dbInstance);
        migrateDb(dbInstance);
    }
    return dbInstance;
};
