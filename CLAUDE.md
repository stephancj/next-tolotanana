# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Tolotanana is a medical records management application for surgical missions, built with Next.js 16. The application manages patient records, surgical operations, and medical staff across different mission editions (campaigns).

**Key Feature**: Offline-first PWA with bidirectional sync between client and server databases.

## Development Commands

```bash
# Development
npm run dev              # Start Next.js dev server (with webpack)

# Build & Production
npm run build            # Production build
npm start                # Start production server

# Linting
npm run lint             # Run ESLint

# Data Migration Scripts
npm run migrate:ages                # Migrate age data format
npm run recalculate:ages            # Recalculate ages in Neon DB
npm run migrate:sqlite-editions     # Migrate editions to SQLite
npm run migrate:neon-editions       # Migrate editions to Neon
npm run migrate:all-editions        # Run both edition migrations
```

## Database Architecture

This application uses a **dual-database architecture** for offline-first functionality:

### Client-Side Database (Dexie/IndexedDB)
- **Location**: `lib/client-db.ts`
- **Purpose**: Offline storage, immediate UI updates
- **Tables**: `medical_records`, `editions`, `surgeons`, `edition_surgeons`, `record_surgeons`
- **Versioning**: Dexie schema versions track migrations (currently v5)
- **Sync Metadata**: Each record has `public_id` (UUID), `sync_status`, `updated_at`, `deleted` fields

### Server-Side Database (Neon Postgres)
- **Location**: `lib/neon-db.ts`
- **Purpose**: Cloud persistence, multi-device sync
- **ORM**: Drizzle ORM with schema at `lib/schema.ts`
- **Connection**: Serverless HTTP via `@neondatabase/serverless`

### Sync Mechanism
- **Endpoint**: `/app/api/sync/route.ts`
- **Push (POST)**: Client sends changes to server with `public_id` as deduplication key
- **Pull (GET)**: Client requests changes since last sync timestamp
- **Hook**: `app/hooks/useSync.ts` runs background sync every 30 seconds
- **Conflict Resolution**: Last-write-wins based on `updated_at` timestamp

### Legacy Database (SQLite)
- **Location**: `lib/db.ts`
- **File**: `tolotanana.db` in project root
- **Status**: Being phased out; migration scripts available
- **Note**: Contains auto-migration logic for schema evolution

## Schema Overview

Core entities and their relationships:

```
editions (mission campaigns)
  ├─→ medical_records (patients)
  │   └─→ record_surgeons (many-to-many with surgeons)
  └─→ edition_surgeons (many-to-many with surgeons)

surgeons (medical staff)
```

### Medical Records Fields Structure
- **Identity**: dossier_number, name, DOB, gender, contact, address, distance
- **Vitals**: weight, height, BMI, blood pressure, temperature, heart rate, respiratory rate, SpO2
- **Surgical**: clinical_diagnosis, intervention_type, observation, program_mission, planning_day
- **Pre-anesthetic**: medical history flags (diabetes, hypertension, asthma, cardiopathy), ASA score, anesthesia type
- **Pre-op**: pre_op_checked, pre_op_checked_at, pre_op_call, pre_op_call_at
- **Operation**: block_entry_time, block_exit_time, intervention_details, diagnosis_category
- **Post-op**: post_op_room, post_op_bed, post_op_entry_time
- **Discharge**: discharge_time, discharge_notes
- **Pharmacy**: prescription_details, pharmacy_status

## Application Views

The main app (`app/page.tsx`) manages navigation between these views:

1. **Dashboard**: Statistics and navigation hub
2. **Form**: Create/edit medical records (`FicheMedicale.tsx`)
3. **List**: Browse all records with search (`RecordList.tsx`)
4. **Surgeons**: Manage medical staff (`SurgeonManager.tsx`)
5. **Planning**: Weekly surgical schedule (`WeeklyPlanning.tsx`)
6. **Operation**: Operation day data entry (`OperationForm.tsx`)
7. **Workflow**: Multi-step operation day workflow (`WorkflowManager.tsx`)

## Edition Context

The application is **edition-scoped**: users select a mission edition (stored in localStorage via `lib/edition-storage.ts`) and all operations are filtered to that edition. The edition selector modal appears on startup if no valid edition is selected.

## Important Patterns

### Soft Deletes
All entities use soft deletes (`deleted: boolean/number`). Never hard-delete records; set the `deleted` flag instead.

### Integer Booleans vs True Booleans
- **Client (Dexie)**: Uses `number` (0/1) for boolean fields
- **Server (Neon)**:
  - Uses `integer` for some booleans (e.g., `program_mission`, `is_active`)
  - Uses `boolean` for others (e.g., `deleted`, `pre_op_checked`)
- **Sync Helpers**: `toInt()` and `toBool()` in `api/sync/route.ts` handle conversions

### UUID Sync Keys
- Each record has an auto-generated `public_id` (UUID) used as the sync deduplication key
- The server-side `id` (serial integer) is database-specific; `public_id` is universal

### Age Field Format
The `age` field is stored as TEXT (e.g., "5 ans", "1 an", "0 an") not as an integer. Migration scripts handle historical integer data.

## Drizzle ORM Commands

```bash
# Generate migration files from schema changes
npx drizzle-kit generate

# Push schema directly to database (no migration files)
npx drizzle-kit push

# Open Drizzle Studio (database GUI)
npx drizzle-kit studio
```

**Config**: `drizzle.config.ts` points to `lib/schema.ts` and requires `DATABASE_URL` environment variable.

## Environment Setup

Required environment variables (create `.env.local`):
```
DATABASE_URL=postgresql://...  # Neon Postgres connection string
```

## PWA Configuration

This is a Progressive Web App configured via `@ducanh2912/next-pwa`. Manifest and service worker settings are in the Next.js configuration. The app works offline and syncs when connectivity is restored.

## Migration Scripts Context

The `scripts/` directory contains one-time data migration utilities for transitioning between database formats or fixing data issues. These are typically run with `npm run <script-name>` and are NOT part of the regular development flow.
