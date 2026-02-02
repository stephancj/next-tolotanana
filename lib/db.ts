import Database from 'better-sqlite3';
import path from 'path';

// Initialize the database file in the project root
// Singleton instance
let dbInstance: Database.Database | null = null;

// Define table schema
const initDb = (db: Database.Database) => {
    const createTableQuery = `
    CREATE TABLE IF NOT EXISTS medical_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dossier_number TEXT,
      last_name TEXT,
      first_name TEXT,
      dob TEXT,
      age TEXT,
      gender TEXT, -- 'M' or 'F'
      phone1 TEXT,
      phone2 TEXT,
      address TEXT,
      distance TEXT DEFAULT 'non précisé',
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
      anesthesia_type TEXT,
      anesthesia_observation TEXT,
      
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

const migrateDb = (db: Database.Database) => {
    try {
        const columns = db.pragma('table_info(medical_records)') as ColumnInfo[];
        const hasAnesthesiaType = columns.some(col => col.name === 'anesthesia_type');
        const hasAnesthesiaObservation = columns.some(col => col.name === 'anesthesia_observation');
        const hasDistance = columns.some(col => col.name === 'distance');
        const ageColumn = columns.find(col => col.name === 'age');

        if (!hasAnesthesiaType) {
            db.exec('ALTER TABLE medical_records ADD COLUMN anesthesia_type TEXT');
            console.log('Added anesthesia_type column');
        }
        if (!hasAnesthesiaObservation) {
            db.exec('ALTER TABLE medical_records ADD COLUMN anesthesia_observation TEXT');
            console.log('Added anesthesia_observation column');
        }
        if (!hasDistance) {
            db.exec('ALTER TABLE medical_records ADD COLUMN distance TEXT DEFAULT "non précisé"');
            console.log('Added distance column');
        }

        // SQLite doesn't support ALTER COLUMN TYPE directly, so we need to recreate the table
        // But we'll only do this if age is still INTEGER
        if (ageColumn && ageColumn.type === 'INTEGER') {
            console.log('Migrating age column from INTEGER to TEXT...');

            // Create a new table with the correct schema
            db.exec(`
                CREATE TABLE medical_records_new (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    dossier_number TEXT,
                    last_name TEXT,
                    first_name TEXT,
                    dob TEXT,
                    age TEXT,
                    gender TEXT,
                    phone1 TEXT,
                    phone2 TEXT,
                    address TEXT,
                    distance TEXT DEFAULT "non précisé",
                    photo_url TEXT,
                    weight REAL,
                    height REAL,
                    bmi REAL,
                    blood_pressure TEXT,
                    temperature REAL,
                    heart_rate INTEGER,
                    respiratory_rate INTEGER,
                    spo2 INTEGER,
                    clinical_diagnosis TEXT,
                    intervention_type TEXT,
                    observation TEXT,
                    program_mission INTEGER DEFAULT 0,
                    history_diabetes INTEGER DEFAULT 0,
                    history_hypertension INTEGER DEFAULT 0,
                    history_asthma INTEGER DEFAULT 0,
                    history_cardiopathy INTEGER DEFAULT 0,
                    history_none INTEGER DEFAULT 0,
                    history_others TEXT,
                    asa_score INTEGER,
                    anesthesia_type TEXT,
                    anesthesia_observation TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Copy data, converting age INTEGER to TEXT with "ans" suffix
            db.exec(`
                INSERT INTO medical_records_new 
                SELECT 
                    id, dossier_number, last_name, first_name, dob,
                    CASE 
                        WHEN age = 0 THEN ''
                        WHEN age = 1 THEN '1 an'
                        ELSE age || ' ans'
                    END as age,
                    gender, phone1, phone2, address,
                    COALESCE(distance, 'non précisé') as distance,
                    photo_url, weight, height, bmi, blood_pressure,
                    temperature, heart_rate, respiratory_rate, spo2,
                    clinical_diagnosis, intervention_type, observation,
                    program_mission, history_diabetes, history_hypertension,
                    history_asthma, history_cardiopathy, history_none,
                    history_others, asa_score, anesthesia_type,
                    anesthesia_observation, created_at
                FROM medical_records
            `);

            // Drop old table and rename new one
            db.exec('DROP TABLE medical_records');
            db.exec('ALTER TABLE medical_records_new RENAME TO medical_records');

            console.log('Age column migrated to TEXT successfully');
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
